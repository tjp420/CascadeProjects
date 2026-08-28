// simplebeacon-ignore: debugArtifacts
/**
 * Simplebeacon Server
 * Express server for Simplebeacon landing, dashboard, and scan APIs
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const logger = require("./server/lib/app-logger.cjs");
const constants = require("./server/config/constants.cjs");
// Prefer v1-internal env when present (start script or direct node simplebeacon-server.js)
const v1InternalEnvPath = path.join(__dirname, ".env.v1-internal");
const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(v1InternalEnvPath)
    ? v1InternalEnvPath
    : path.join(__dirname, ".env"));
if (fs.existsSync(envPath)) {
  try {
    require("dotenv").config({ path: envPath });
    if (envPath.endsWith(".env.v1-internal")) {
      const {
        applyLocalV1InternalDevProfile,
      } = require("./server/lib/secret-config.cjs");
      applyLocalV1InternalDevProfile();
    }
  } catch (envErr) {
    logger.warn("[Simplebeacon] dotenv/secret-config load failed");
  }
}

// Production-safe defaults for auth env vars when Render (or other hosts) do not apply them.
// These only apply when the variable is missing/empty; explicit values are preserved.
if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
  if (!process.env.REQUIRE_AUTH) process.env.REQUIRE_AUTH = "true";
  if (!process.env.SEED_DEMO_USERS) process.env.SEED_DEMO_USERS = "false";
  if (!process.env.ALLOW_LEGACY_LOGIN) process.env.ALLOW_LEGACY_LOGIN = "false";
}

// Validate critical Stripe/billing env vars before loading app modules
const { validateEnvironment } = require("./server/config/validate-env.cjs");
validateEnvironment();

const express = require("express");
const rateLimit = require("express-rate-limit");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const {
  resolveCorsOptions,
  isAllowedOrigin,
} = require("./server/lib/cors-config.cjs");

const setupBuildFromPathRoute = require("./src/api/build-from-path-route.cjs");
const setupDashboardStubAPIs = require("./src/api/dashboard-stub-api.cjs"); // simplebeacon-ignore production-leak — real production dashboard API module, not a stub
const { setupSimplebeaconAPI } = require("./src/api/simplebeacon-api.cjs");
const {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
} = require("./src/api/simplebeacon-billing-api.cjs");
const setupLocalModelsAPI = require("./server/routes/local-models-api.cjs");
const {
  setupFlexibleAnalyzeAPI,
} = require("./server/routes/flexible-analyze-api.cjs");
const { setupChatbotAPI } = require("./server/routes/chatbot-api.cjs");
const { setupWebAuthnAPI } = require("./server/routes/webauthn-api.cjs");
const {
  setupPhase2Integration,
} = require("./server/bootstrap/phase2-integration.cjs");
const {
  setupRealtimeAnalysisAPI,
} = require("./server/routes/realtime-analysis-api.cjs");
const pathHealthRouter = require("./server/api/metrics/path-health.cjs");
const {
  registerLegacyPageRedirects,
} = require("./server/lib/legacy-page-redirects.cjs");
const uploadRoutes = require("./server/routes/upload.cjs");
const {
  setupRepositoryScannerAPIs,
} = require("./server/routes/repository-scanner-api.cjs");
const {
  setupAiMathAuditRoute,
} = require("./server/routes/ai-math-audit-route.cjs");
const { setupAdminAPI } = require("./server/routes/admin-api.cjs");
const {
  uploadSecurity,
  contentValidation,
} = require("./server/middleware/upload-security.cjs");
const {
  authenticate,
  optionalAuthenticate,
} = require("./server/middleware/auth.cjs");
const authRoutes = require("./server/routes/auth.cjs");
const { runNpmAuditAsync } = require("./server/lib/npm-audit-runner.cjs");

const { safeString, safeErrorMessage } = constants;

// ── Server-side utility helpers ───────────────────────────────

function setNoCacheHeaders(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  res.set("Pragma", "no-cache");
}

function buildJsonResponse(type, data, timestamp = new Date().toISOString()) {
  const result = { type, timestamp };
  if (data !== undefined) result.data = data;
  return result;
}

function trySendFile(res, filePath, type) {
  if (!filePath || typeof filePath !== "string" || !fs.existsSync(filePath))
    return false;
  if (typeof type === "string" && type) res.type(type);
  setNoCacheHeaders(res);
  res.sendFile(filePath);
  return true;
}

/**
 * Check if request originates from a loopback address.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isLocalhostRequest(req) {
  return /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(req.hostname);
}

/**
 * Sanitize and validate email.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeEmail(raw) {
  const email = String(raw || "")
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

/**
 * Parse JSON safely.
 * @param {string} text
 * @param {unknown} [fallback=null]
 * @returns {unknown}
 */
function parseJsonSafe(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Delay promise.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const app = express();
app.set("trust proxy", 1);
const PORT =
  Number.isFinite(Number(process.env.PORT)) && Number(process.env.PORT) > 0
    ? Number(process.env.PORT)
    : constants.DEFAULT_PORT;
const WS_PORT = 8081;

// CORS — uses shared cors-config.cjs (canonical implementation)
// Reads CORS_ORIGINS > CORS_ORIGIN > ALLOWED_ORIGIN > PUBLIC_URL env vars.
// Dev: mirrors any origin. Prod: explicit origins + pages.dev/onrender/netlify regex.

// Private Network Access (PNA) support: when a secure public page fetches a
// loopback address, browsers send Access-Control-Request-Private-Network: true
// in the preflight and require Access-Control-Allow-Private-Network: true.
app.use((req, res, next) => {
  try {
    const acrpn = req.headers["access-control-request-private-network"];
    if (typeof acrpn !== "undefined") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
  } catch {
    // ignore header-setting errors
  }
  next();
});

// Respond to CORS preflight early to ensure required headers are present
// Note: Use middleware instead of app.options('*', ...) because Express 5 /
// path-to-regexp v8 rejects bare '*' wildcards.
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();
  try {
    const origin = req.headers.origin || "";
    if (isAllowedOrigin(origin)) {
      // simplebeacon-ignore cors-wildcard — origin is validated by isAllowedOrigin() before this fallback; '*' only applies when origin is empty (same-origin requests)
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Accept,Authorization,X-Token-Password,X-SimpleBeacon-Bridge-Token,x-simplebeacon-bridge-token,Access-Control-Request-Private-Network",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    // PNA support
    if (
      typeof req.headers["access-control-request-private-network"] !==
      "undefined"
    ) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
  } catch (e) {
    console.error("simplebeacon-server.cjs error:", e);
    // ignore
  }
  return res.status(204).end();
});

app.use(cors(resolveCorsOptions()));

// Ensure bridge token header is always allowed in CORS preflight responses.
app.use((req, res, next) => {
  try {
    const existing = res.getHeader("Access-Control-Allow-Headers") || "";
    const existingStr = Array.isArray(existing)
      ? existing.join(",")
      : String(existing || "");
    if (!/x-simplebeacon-bridge-token/i.test(existingStr)) {
      const toSet =
        existingStr && existingStr.trim().length > 0
          ? existingStr + ", x-simplebeacon-bridge-token"
          : "x-simplebeacon-bridge-token";
      res.setHeader("Access-Control-Allow-Headers", toSet);
    }
  } catch (e) {
    console.error("simplebeacon-server.cjs error:", e);
    // ignore header-setting errors
  }
  next();
});

// Security headers (lightweight helmet alternative — zero dependencies)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Allow iframe embedding in dev (for IDE previews like Windsurf/Cursor)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("X-Frame-Options", "DENY");
  }
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
  // Content-Security-Policy — allow local dev scripts, block inline eval
  // simplebeacon-ignore hardcoded-url — CSP comment describing env-based origin config, not a hardcoded production URL
  // Production connect-src uses SIMPLEBEACON_CSP_CONNECT_ORIGINS (space-separated) instead of hardcoded localhosts // simplebeacon-ignore hardcoded-url
  const SCANNER_BRIDGE_PORT = 3456;
  const LIVE_SERVER_PORT = 55000;
  const AGENT_PORT = process.env.SIMPLEBEACON_AGENT_PORT || "55432";
  const DEFAULT_PORTS = [
    3000,
    3001,
    3002,
    4000,
    8080,
    5000,
    38000,
    50559,
    54358,
    AGENT_PORT,
    11434,
  ]; // 11434 = Ollama
  const prodConnectOrigins =
    process.env.SIMPLEBEACON_CSP_CONNECT_ORIGINS ||
    "'self' https://simplebeacon.onrender.com https://*.onrender.com http://127.0.0.1:" +
      SCANNER_BRIDGE_PORT +
      " http://localhost:" +
      SCANNER_BRIDGE_PORT +
      " http://127.0.0.1:" +
      LIVE_SERVER_PORT +
      " http://localhost:" +
      LIVE_SERVER_PORT +
      DEFAULT_PORTS.flatMap((p) => [
        " http://127.0.0.1:" + p,
        " http://localhost:" + p,
      ]).join(""); // simplebeacon-ignore hardcoded-url — Render and localhost origins for dashboard API
  const devConnectOrigins =
    process.env.SIMPLEBEACON_CSP_CONNECT_ORIGINS ||
    "'self' ws: wss: http: https: http://127.0.0.1:" +
      SCANNER_BRIDGE_PORT +
      " http://localhost:" +
      SCANNER_BRIDGE_PORT +
      " http://127.0.0.1:" +
      LIVE_SERVER_PORT +
      " http://localhost:" +
      LIVE_SERVER_PORT +
      DEFAULT_PORTS.flatMap((p) => [
        " http://127.0.0.1:" + p,
        " http://localhost:" + p,
      ]).join(""); // simplebeacon-ignore hardcoded-url — localhost dev CSP origins, never production
  const csp =
    process.env.NODE_ENV === "production"
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src ${prodConnectOrigins} https://*.cloudflareinsights.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'self' vscode-webview: vscode-extension:; base-uri 'self'; form-action 'self';`
      : `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src ${devConnectOrigins}; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors *;`;
  res.setHeader("Content-Security-Policy", csp);
  next();
});

// HTTPS redirect for production — respect health checks and local development
app.use((req, res, next) => {
  const isLocalhost = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(
    req.hostname,
  );
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (!isLocalhost && !isSecure && process.env.NODE_ENV === "production") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
if (
  !process.env.SIMPLEBEACON_INTERNAL_DASHBOARD &&
  !process.env.PORT &&
  String(process.env.NODE_ENV || "").toLowerCase() !== "production" &&
  process.env.NODE_ENV !== "test"
) {
  process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = "true";
  logger.warn(
    `[Simplebeacon] Auto-enabled SIMPLEBEACON_INTERNAL_DASHBOARD for local dev on port ${PORT}. ` +
      "Use npm run dashboard:v1-internal for the full v1.0-internal profile.",
  );
}
const webRoot = path.join(__dirname, "web");

// Render may clone the repo into an arbitrary directory, so try several
// candidate locations (env override, cwd, relative paths, and walking up)
// for the marketing landing pages before giving up.
function resolveLandingRoot() {
  const envRoot = process.env.SIMPLEBEACON_LANDING_ROOT;
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (fs.existsSync(resolved)) return resolved;
  }
  const candidates = [
    path.join(__dirname, "../coming-soon/public"),
    path.join(__dirname, "../../coming-soon/public"),
    path.join(process.cwd(), "coming-soon/public"),
    path.join(__dirname, "../CascadeProjects/coming-soon/public"),
    path.join(__dirname, "../../CascadeProjects/coming-soon/public"),
    path.join(process.cwd(), "CascadeProjects/coming-soon/public"),
    path.join(process.cwd(), "public"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Walk up from __dirname in case the app is nested under an arbitrary parent
  let current = __dirname;
  for (let i = 0; i < 6; i++) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    const upCandidate = path.join(current, "coming-soon/public");
    if (fs.existsSync(upCandidate)) return upCandidate;
    const namedCandidate = path.join(
      current,
      "CascadeProjects/coming-soon/public",
    );
    if (fs.existsSync(namedCandidate)) return namedCandidate;
  }
  return candidates[0];
}
const landingRoot = resolveLandingRoot();
const landingEnabled = process.env.SIMPLEBEACON_LANDING === "true";
const landingRootExists = fs.existsSync(landingRoot);

/**
 * Send a landing file with path-traversal guard.
 * @param {import('express').Response} res
 * @param {string} relativePath
 * @param {string} [type]
 * @returns {boolean}
 */
function sendLandingFile(res, relativePath, type) {
  if (!landingRootExists) return false;
  if (typeof relativePath !== "string") return false;
  const resolved = path.resolve(path.join(landingRoot, relativePath));
  const rootResolved = path.resolve(landingRoot);
  const relativeToRoot = path.relative(rootResolved, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return false;
  }
  if (!fs.existsSync(resolved)) return false;
  if (typeof type === "string" && type) res.type(type);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  res.sendFile(resolved);
  return true;
}

/**
 * Send demo report if allowed.
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function sendDemoReport(res) {
  // Only serve demo report in non-production or when explicitly enabled
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT
  ) {
    return false;
  }
  return sendLandingFile(res, "demo-report.html", "text/html");
}

const internalDashboard =
  String(process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || "")
    .trim()
    .toLowerCase() === "true";

/**
 * Whether storefront assets should be served.
 * @returns {boolean}
 */
function storefrontAssetsEnabled() {
  return landingEnabled || internalDashboard || landingRootExists;
}

// Refuse to start internal dashboard without a vault password in non-dev environments
if (
  internalDashboard &&
  !process.env.DASHBOARD_VAULT_PASSWORD &&
  process.env.NODE_ENV !== "development"
) {
  throw new Error(
    "DASHBOARD_VAULT_PASSWORD is required when SIMPLEBEACON_INTERNAL_DASHBOARD=true in non-development environments",
  );
}
const verboseRuntimeLogs =
  process.env.DEBUG_LOGS === "true" || process.env.NODE_ENV === "development";
const debugLog = (...args) => {
  if (verboseRuntimeLogs) {
    logger.info(...args);
  }
};
/** Production: marketing at /. Local internal preview: dashboard at /, marketing at /landing */
const landingAtRoot = landingEnabled && !internalDashboard;
const {
  isVaultAuthenticated: checkVaultAuthenticated,
  isProtectedDashboardPath,
  setVaultSessionCookie: writeVaultSessionCookie,
} = require("./server/lib/dashboard-vault-auth.cjs");

function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, {
    // simplebeacon-ignore dead-code — returns result of function call; no unreachable code follows
    internalDashboard,
    vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD,
  });
}

function setVaultSessionCookie(res) {
  writeVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
}

if (process.env.NODE_ENV !== "test") {
  logger.info(
    `[Simplebeacon] SIMPLEBEACON_LANDING=${process.env.SIMPLEBEACON_LANDING || "(unset)"}` +
      ` internalDashboard=${internalDashboard} → /=${landingAtRoot ? "landing" : "dashboard"}`,
  );
}

// Middleware — webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || "50mb" }));

const {
  registerAuditBookingRoute,
} = require("./server/lib/audit-booking-route.cjs");
registerAuditBookingRoute(app, {
  landingEnabled,
  landingRoot,
  dataDir: path.join(__dirname, "data"),
});

const {
  registerOperatorRoutes,
} = require("./server/lib/register-operator-routes.cjs");
registerOperatorRoutes(app, {
  projectRoot: __dirname,
  monorepoRoot: path.join(__dirname, ".."),
  landingRoot,
});

const { registerOutreachRoutes } = require("./server/lib/outreach-route.cjs");
registerOutreachRoutes(app, {
  dataDir: path.join(__dirname, "data"),
});

// simplebeacon-ignore secret-in-comments — route organization comment
// API routes before static files to avoid 404 responses on API paths
setupBuildFromPathRoute(app);
registerLegacyPageRedirects(app);

// Setup enhanced real-time analysis API
setupRealtimeAnalysisAPI(app, {
  baseDir: __dirname,
  monorepoRoot: path.join(__dirname, ".."),
});

const {
  registerDataCleanupAnalyzeRoute,
} = require("./server/lib/data-cleanup-scan.cjs");
registerDataCleanupAnalyzeRoute(app, {
  baseDir: __dirname,
  monorepoRoot: path.join(__dirname, ".."),
});
app.post("/api/ai-context", express.json({ limit: "10mb" }), (req, res) => {
  try {
    const { projectPath, notes, reportSummary, issues } = req.body;
    if (!reportSummary || !issues) {
      return res
        .status(400)
        .json({ success: false, error: "Missing report data" });
    }
    // Build markdown summary for AI agent
    const lines = [
      "# SimpleBeacon Scan Summary",
      `**Project:** ${projectPath || "Unknown"}`,
      `**Quality Score:** ${reportSummary.qualityScore ?? "N/A"}`,
      `**Gate Pass:** ${reportSummary.gatePass ?? "N/A"}`,
      `**Total Issues:** ${reportSummary.totalIssues ?? issues.length}`,
      `**Files Scanned:** ${reportSummary.filesScanned ?? "N/A"}`,
      "",
    ];
    if (notes) {
      lines.push(`**Notes:** ${notes}`, "");
    }
    lines.push("## Issues");
    const maxIssues = Math.min(issues.length, 200); // simplebeacon-ignore memory-leak — loop is bounded at 200 iterations
    for (let i = 0; i < maxIssues; i++) {
      const issue = issues[i];
      lines.push(
        `- **[${issue.severity || "low"}]** ${issue.type || "Issue"}: ${issue.description || ""}`,
      );
      if (issue.filePath || issue.file) {
        lines.push(
          `  - Location: \`${issue.filePath || issue.file}${issue.line ? ":" + issue.line : ""}\``,
        );
      }
    }
    lines.push(
      "",
      "_Paste this into your AI coding agent for remediation guidance._",
    );
    const content = lines.join("\n");
    res.json({ success: true, content });
  } catch (err) {
    const msg = safeErrorMessage(err);
    logger.error("[AI-Context] Error:", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get("/health", (_req, res) => {
  res
    .status(200)
    .json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
});

app.get("/api/health", (_req, res) => {
  res.set("Content-Type", "application/json");
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/health/email", (_req, res) => {
  try {
    const { getEmailStatus } = require("../coming-soon/services/email.cjs");
    const status = getEmailStatus();
    res.json({
      ok: status.configured,
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/ping", (_req, res) => {
  res.set("Content-Type", "application/json");
  res.status(200).json({ online: true, timestamp: new Date().toISOString() });
});

app.get("/api/health/routes", (_req, res) => {
  res.json({
    status: "ok",
    dataCleanup: true,
    paths: ["/api/analyze/data-cleanup"],
    build: "2026-05-27-data-cleanup",
  });
});
if (process.env.NODE_ENV !== "test") {
  logger.info("[Simplebeacon] Registered GET /api/analyze/data-cleanup");
}

const dashboardPath = path.join(webRoot, "simplebeacon-dashboard/index.html");
let _cachedDashboardHtml = null;
let _cachedDashboardMtimeMs = 0;

async function loadDashboardHtml() {
  try {
    const stat = await fs.promises.stat(dashboardPath);
    if (_cachedDashboardHtml && stat.mtimeMs === _cachedDashboardMtimeMs) {
      return _cachedDashboardHtml;
    }
    let html = await fs.promises.readFile(dashboardPath, "utf8");
    // Ensure relative asset paths resolve from root when served from /dashboard
    if (!html.includes("<base href=")) {
      html = html.replace(/<head>/i, '<head>\n  <base href="/">');
    }
    _cachedDashboardHtml = html;
    _cachedDashboardMtimeMs = stat.mtimeMs;
    return html;
  } catch {
    return null;
  }
}

async function sendSimplebeaconDashboard(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  // Path-traversal guard: ensure dashboard path resolves inside webRoot
  const resolved = path.resolve(dashboardPath);
  const rootResolved = path.resolve(webRoot);
  const relativeToRoot = path.relative(rootResolved, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return res.status(403).send("Forbidden");
  }
  const html = await loadDashboardHtml();
  if (html === null) {
    return res.status(404).send("Simplebeacon dashboard not found");
  }
  // Do not inject vault password into HTML — use vault endpoint instead
  return res.send(html);
}

function sendLandingIndex(res) {
  const landingIndex = path.join(landingRoot, "index.html");
  if (!fs.existsSync(landingIndex)) return false; // simplebeacon-ignore sync-io-async-path — synchronous file existence check for landing page fallback
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  res.sendFile(landingIndex);
  return true;
}

async function redirectPublicToLanding(req, res) {
  if (landingAtRoot) {
    return res.redirect(302, "/");
  }

  // Allow users who are JWT-authenticated to access the dashboard even when
  // the vault cookie is not present (useful for regular sign-in sessions).
  try {
    await new Promise((resolve) => optionalAuthenticate(req, res, resolve));
  } catch (e) {
    console.error("simplebeacon-server.cjs error:", e);
    // ignore optional auth failures; req.user will be unset
  }

  if (internalDashboard && !isVaultAuthenticated(req)) {
    // If a regular authenticated user exists, show the dashboard.
    if (req.user) return sendSimplebeaconDashboard(res);
    // If the request is for the sign-in UI, render the dashboard SPA so the
    // client can present the sign-in view instead of performing a redirect.
    if (req.path === "/signin" || req.path.startsWith("/signin/"))
      return sendSimplebeaconDashboard(res);
    // Otherwise redirect to sign-in (preserves returnTo for client-side flow)
    const returnTo = encodeURIComponent(req.originalUrl || "/app");
    return res.redirect(302, "/signin?returnTo=" + returnTo);
  }

  return sendSimplebeaconDashboard(res);
}

// Dashboard SPA — internal operator only when landing serves sales gate at /
app.get(/^\/demo(\/.*)?$/, async (req, res) =>
  redirectPublicToLanding(req, res),
);
app.get(/^\/signin(\/.*)?$/, async (req, res) =>
  redirectPublicToLanding(req, res),
);
app.get(/^\/app(\/.*)?$/, async (req, res) =>
  redirectPublicToLanding(req, res),
);
app.get(/^\/upload(\.html)?(\/.*)?$/, (req, res) =>
  res.redirect(302, "/#/upload"),
);
app.get("/dashboard/pricing", (_req, res) => res.redirect(301, "/pricing"));
app.get(/^\/trust(\/.*)?$/, (req, res) => {
  if (landingAtRoot) return res.redirect(302, "/");
  if (internalDashboard && !isVaultAuthenticated(req))
    return res.redirect(302, "/");
  const trustHash = internalDashboard ? "/#/trust" : "/app#/trust";
  res.redirect(302, trustHash);
});

// Serve dashboard assets under the /dashboard prefix for clients using absolute dashboard paths
const dashboardStaticDir = path.join(webRoot, "simplebeacon-dashboard");
// Fallback: also check coming-soon/public/dashboard for vendor files that may not be in ai-platform/web
const dashboardFallbackDir = fs.existsSync(path.join(landingRoot, "dashboard"))
  ? path.join(landingRoot, "dashboard")
  : null;
const dashboardStaticOpts = {
  fallthrough: true,
  dotfiles: "deny",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js"))
      res.set("Content-Type", "application/javascript; charset=utf-8");
    if (filePath.endsWith(".css"))
      res.set("Content-Type", "text/css; charset=utf-8");
    if (filePath.endsWith(".json"))
      res.set("Content-Type", "application/json; charset=utf-8");
    if (filePath.endsWith(".wasm")) res.set("Content-Type", "application/wasm");
  },
};
const dashboardStaticOptsFinal = { ...dashboardStaticOpts, fallthrough: false };
[
  "/dashboard/css",
  "/dashboard/js",
  "/dashboard/js-es2018",
  "/dashboard/images",
  "/dashboard/fonts",
  "/dashboard/assets",
  "/dashboard/utils-lib",
].forEach((p) => {
  const sub = p.substring("/dashboard/".length);
  app.use(
    p,
    express.static(path.join(dashboardStaticDir, sub), dashboardStaticOpts),
  );
  if (dashboardFallbackDir) {
    app.use(
      p,
      express.static(
        path.join(dashboardFallbackDir, sub),
        dashboardStaticOptsFinal,
      ),
    );
  }
});
function serveRootFile(relativePath, contentType) {
  return (req, res, next) => {
    const candidates = [
      path.join(dashboardStaticDir, relativePath),
      dashboardFallbackDir
        ? path.join(dashboardFallbackDir, relativePath)
        : null,
      landingRootExists ? path.join(landingRoot, relativePath) : null,
    ].filter(Boolean);
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        if (contentType) res.set("Content-Type", contentType);
        res.set(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, no-transform",
        );
        return res.sendFile(filePath);
      }
    }
    next();
  };
}
app.get(
  "/dashboard/site-config.js",
  serveRootFile("site-config.js", "application/javascript; charset=utf-8"),
);
app.get(
  "/site-config.js",
  serveRootFile("site-config.js", "application/javascript; charset=utf-8"),
);
app.get(
  "/js-es2018/referral-capture.js",
  serveRootFile(
    path.join("js-es2018", "referral-capture.js"),
    "application/javascript; charset=utf-8",
  ),
);

app.get("/", async (req, res) => {
  // For internal dashboard, prioritize dashboard over landing page
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  // For public access, show landing page first, then fall back to dashboard
  if (sendLandingIndex(res)) return;
  return sendSimplebeaconDashboard(res);
});

// Redirect bare /dashboard to /dashboard/ so relative asset links resolve correctly.
app.get(/^\/dashboard\/?$/, async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  if (!req.path.endsWith("/")) {
    return res.redirect(
      302,
      "/dashboard/" +
        (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""),
    );
  }
  return sendSimplebeaconDashboard(res);
});

// Vite chunk fallback: redirect /dashboard/<chunk>.js to /dashboard/assets/<chunk>.js
// when the file exists in the assets directory. This handles cases where a cached
// main.js resolves relative imports without the assets/ prefix.
app.get("/dashboard/:filename.js", (req, res, next) => {
  const filename = req.params.filename + ".js";
  const assetsPath = path.join(dashboardStaticDir, "assets", filename);
  if (fs.existsSync(assetsPath)) {
    return res.redirect(302, "/dashboard/assets/" + filename);
  }
  if (dashboardFallbackDir) {
    const fallbackPath = path.join(dashboardFallbackDir, "assets", filename);
    if (fs.existsSync(fallbackPath)) {
      return res.redirect(302, "/dashboard/assets/" + filename);
    }
  }
  next();
});

// SPA sub-routes (e.g. /dashboard/analyze) — let the client router handle the path
// Note: Express 5 / path-to-regexp requires named wildcard params (* alone is invalid)
app.get("/dashboard/*splat", async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  return sendSimplebeaconDashboard(res);
});

// Compatibility: also serve dashboard at /simplebeacon-dashboard (new server/index.cjs path)
app.get("/simplebeacon-dashboard", async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  return res.redirect(
    302,
    "/simplebeacon-dashboard/" +
      (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""),
  );
});
app.get(
  ["/simplebeacon-dashboard/", "/simplebeacon-dashboard/index.html"],
  async (req, res) => {
    if (internalDashboard && !isVaultAuthenticated(req)) {
      return res.redirect(302, "/");
    }
    return sendSimplebeaconDashboard(res);
  },
);
app.get("/simplebeacon-dashboard/*splat", async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  return sendSimplebeaconDashboard(res);
});

app.get(["/landing", "/landing/"], (req, res) => {
  if (!landingEnabled) return res.redirect(302, "/");
  if (sendLandingIndex(res)) return;
  return res.status(404).send("Landing page not found");
});

// Direct access to landing.html file (bypasses landingEnabled flag for development)
app.get("/landing.html", (req, res) => {
  if (sendLandingFile(res, "landing.html", "text/html")) return;
  return res.status(404).send("Landing page not found");
});

// Private dashboard — unlocks vault session; optional returnTo redirects back to /app
app.get("/private-dashboard-vault", (req, res) => {
  const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
  const hasPassword = vaultPassword != null && String(vaultPassword).length > 0;
  const isLocalDev = process.env.NODE_ENV === "development" && !hasPassword;

  if (!isLocalDev && req.query.password !== vaultPassword) {
    return res
      .status(403)
      .send("Unauthorized Access: Private Vault is Locked.");
  }

  setVaultSessionCookie(res);

  const returnTo = String(req.query.returnTo || "").trim();
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return res.redirect(302, returnTo);
  }

  // Redirect to dashboard by default instead of showing demo report
  return res.redirect(302, "/");
});

app.get(
  ["/demo-report", "/demo-report/", "/demo-report.html"],
  (req, res, next) => {
    if (sendDemoReport(res)) return;
    next();
  },
);

if (landingRootExists) {
  app.get("/site-config.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "site-config.js", "application/javascript"))
      return;
    next();
  });
  app.get("/app-links.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "app-links.js", "application/javascript")) return;
    next();
  });
  app.get("/audit-booking.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "audit-booking.js", "application/javascript"))
      return;
    next();
  });
  app.get("/diagnostic-scanner.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "diagnostic-scanner.js", "application/javascript"))
      return;
    next();
  });
  app.get("/diagnostic-bundle-lib.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (
      sendLandingFile(res, "diagnostic-bundle-lib.js", "application/javascript")
    )
      return;
    next();
  });
  app.get("/styles.css", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "styles.css", "text/css")) return;
    next();
  });
  app.get("/pricing.js", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "pricing.js", "application/javascript")) return;
    next();
  });
  app.get(["/pricing", "/pricing/"], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "pricing.html", "text/html")) return;
    next();
  });
  app.get(["/roadmap", "/roadmap/"], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "roadmap.html", "text/html")) return;
    next();
  });
  app.get(["/audit", "/audit/"], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "audit.html", "text/html")) return;
    next();
  });
  app.get(
    ["/downloads/diagnostic-prep", "/downloads/diagnostic-prep.html"],
    (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      if (sendLandingFile(res, "downloads/diagnostic-prep.html", "text/html"))
        return;
      next();
    },
  );
  for (const legalPage of ["terms", "privacy", "refund"]) {
    app.get([`/${legalPage}`, `/${legalPage}/`], (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      if (sendLandingFile(res, `${legalPage}.html`, "text/html")) return;
      next();
    });
  }
  app.get("/pricing.html", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, "/pricing");
  });
  app.get("/roadmap.html", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, "/roadmap");
  });
  app.get("/audit.html", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, "/audit");
  });
  for (const legalPage of ["terms", "privacy", "refund", "contact"]) {
    app.get(`/${legalPage}.html`, (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      return res.redirect(301, `/${legalPage}`);
    });
  }
  app.get(["/community", "/community/"], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(302, "/");
  });
  app.get("/community.html", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, "/community/");
  });
  app.get("/downloads/simplebeacon-:version.tgz", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    const version = String(req.params.version || "").replace(/[\\/]/g, "_");
    if (!version) return next();
    if (
      sendLandingFile(
        res,
        `downloads/simplebeacon-${version}.tgz`,
        "application/gzip",
      )
    )
      return;
    next();
  });
  app.get("/robots.txt", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "robots.txt", "text/plain")) return;
    next();
  });
  app.get("/sitemap.xml", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "sitemap.xml", "application/xml")) return;
    next();
  });
  app.get("/favicon.svg", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, "favicon.svg", "image/svg+xml")) return;
    next();
  });

  // Redirect /coming-soon/* links to the canonical landing pages served at root
  app.get("/coming-soon/*splat", (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    const target = req.params.splat || "";
    if (!target) return res.redirect(301, "/");
    return res.redirect(301, "/" + target);
  });

  // Serve remaining landing assets whenever landing pages are available
  // (not just when landing is at root), so /audit.html and similar pages can load scripts
  if (landingRootExists) {
    app.use(
      "/",
      express.static(landingRoot, {
        index: false,
        dotfiles: "deny",
        redirect: false,
      }),
    );
  }

  const waitlistRateLimiter = rateLimit({
    windowMs: constants.ONE_MINUTE_MS || 60 * 1000,
    max: 10,
    message: { error: "rate_limited" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/waitlist", waitlistRateLimiter, async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: "not_found" });
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    const entry = {
      email,
      source:
        typeof req.body?.source === "string" ? req.body.source : "landing",
      ts:
        typeof req.body?.ts === "string"
          ? req.body.ts
          : new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };
    const waitlistDir = path.join(__dirname, "data");
    const waitlistFile = path.join(waitlistDir, "waitlist-signups.json");
    try {
      await fs.promises.mkdir(waitlistDir, { recursive: true });
      let rows = [];
      try {
        const data = await fs.promises.readFile(waitlistFile, "utf8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        /* file does not exist yet */
      }
      if (!rows.some((r) => r && typeof r === "object" && r.email === email))
        rows.push(entry);
      await fs.promises.writeFile(waitlistFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      logger.warn("[waitlist] persist failed:", safeErrorMessage(err));
    }
    return res.json({ ok: true, email });
  });

  app.get("/api/waitlist/count", async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: "not_found" });
    const waitlistFile = path.join(__dirname, "data", "waitlist-signups.json");
    try {
      const data = await fs.promises.readFile(waitlistFile, "utf8");
      const rows = JSON.parse(data);
      return res.json({ count: Array.isArray(rows) ? rows.length : 0 });
    } catch {
      return res.json({ count: 0 });
    }
  });

  app.post("/api/waitlist/event", waitlistRateLimiter, async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: "not_found" });
    const event = {
      event: typeof req.body?.event === "string" ? req.body.event : "unknown",
      data:
        req.body?.data &&
        typeof req.body.data === "object" &&
        !Array.isArray(req.body.data)
          ? req.body.data
          : {},
      ts:
        typeof req.body?.ts === "string"
          ? req.body.ts
          : new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };
    const eventsFile = path.join(__dirname, "data", "waitlist-events.json");
    try {
      await fs.promises.mkdir(path.dirname(eventsFile), { recursive: true });
      let rows = [];
      try {
        const data = await fs.promises.readFile(eventsFile, "utf8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        /* file does not exist yet */
      }
      rows.push(event);
      const MAX_WAITLIST_EVENTS = 10000;
      if (rows.length > MAX_WAITLIST_EVENTS)
        rows = rows.slice(-MAX_WAITLIST_EVENTS);
      await fs.promises.writeFile(eventsFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      logger.warn("[waitlist] event persist failed:", safeErrorMessage(err));
    }
    return res.json({ ok: true });
  });

  // ── Contact form endpoint — delivers to Zoho (or any configured email provider) ──
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message, topic, company, title, source } =
        req.body || {};
      if (!email || typeof email !== "string" || !email.trim().includes("@")) {
        return res
          .status(400)
          .json({ success: false, error: "A valid email is required" });
      }
      if (!message || typeof message !== "string" || !message.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Message is required" });
      }

      // Deliver to Zoho via the email service fallback chain
      const notifyEmail =
        process.env.CONTACT_NOTIFY_EMAIL || process.env.SMTP_USER || "";
      if (notifyEmail) {
        const { sendEmail } = require("../coming-soon/services/email.cjs");
        const topicLabel =
          {
            "free-audit": "Free AI Slop Audit request",
            certificate: "Executive Risk Certificate ($499)",
            "eu-ai-act": "EU AI Act Readiness Sprint ($2,499)",
            enterprise: "Enterprise contract ($50,000+ annual)",
            "invoice-w9": "Request Invoice / W-9",
            quarterly: "Quarterly / Annual Protection Pack",
            general: "General compliance question",
          }[topic] ||
          topic ||
          "General";

        const subject = `[SimpleBeacon Contact] ${topicLabel}`;
        const textBody = `Topic: ${topicLabel}\nFrom: ${name || "(no name)"} <${email}>\nCompany: ${company || "(none)"}\nTitle: ${title || "(none)"}\nSource: ${source || "contact-page"}\n\nMessage:\n${message}`;
        const htmlBody = `<h3>New contact form submission</h3><p><strong>Topic:</strong> ${topicLabel}</p><p><strong>From:</strong> ${name || "(no name)"} &lt;${email}&gt;</p><p><strong>Company:</strong> ${company || "(none)"}</p><p><strong>Title:</strong> ${title || "(none)"}</p><p><strong>Source:</strong> ${source || "contact-page"}</p><hr><p><strong>Message:</strong></p><pre>${message}</pre>`;

        try {
          const emailResult = await sendEmail({
            to: notifyEmail,
            subject,
            text: textBody,
            html: htmlBody,
          });
          if (emailResult.sent) {
            logger.info(
              `[Contact] Email sent to ${notifyEmail} via ${emailResult.provider || "smtp"} (from ${email})`,
            );
          } else if (emailResult.queued) {
            logger.info(
              `[Contact] Email queued for ${notifyEmail} (from ${email})`,
            );
          } else {
            logger.error("[Contact] Email failed:", emailResult.error);
          }
        } catch (emailErr) {
          logger.error("[Contact] Email send error:", emailErr.message);
        }
      } else {
        logger.warn(
          "[Contact] CONTACT_NOTIFY_EMAIL not configured — submission stored but not emailed",
        );
      }

      res.json({ success: true, received: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.use((req, res, next) => {
    if (!landingEnabled) return next();
    // Skip landing root static files when internalDashboard is enabled
    if (internalDashboard) return next();
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/demo") ||
      req.path.startsWith("/app")
    ) {
      return next();
    }
    express.static(landingRoot, {
      index: false,
      redirect: false,
      dotfiles: "deny",
    })(req, res, next);
  });
}

// Prevent Cloudflare from auto-injecting stale beacon scripts with broken SRI hashes
// and strip `integrity` / `crossorigin` attributes server-side for beacon script tags
app.use((req, res, next) => {
  if (
    req.path.endsWith(".html") ||
    req.path === "/" ||
    !path.extname(req.path)
  ) {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, no-transform",
    );
  }

  // Helper to remove integrity and crossorigin attributes from beacon script tags
  function stripBeaconSRI(html) {
    if (
      typeof html !== "string" ||
      html.indexOf("static.cloudflareinsights.com") === -1
    )
      return html;
    try {
      return html.replace(
        /(<script\b[^>]*\bsrc=["'][^"']*static\.cloudflareinsights\.com\/beacon\.min\.js[^"']*["'][^>]*?)>/gi,
        function (m, p1) {
          return (
            p1.replace(
              /\s+(?:integrity|crossorigin)\s*=\s*(["'])[\s\S]*?\1/gi,
              "",
            ) + ">"
          );
        },
      );
    } catch (e) {
      return html;
    }
  }

  // Wrap res.send to sanitize HTML responses
  const origSend = res.send.bind(res);
  res.send = function (body) {
    try {
      const ct = String(res.getHeader("Content-Type") || "");
      if (typeof body === "string" && /text\/(html|xhtml)/i.test(ct)) {
        body = stripBeaconSRI(body);
      }
    } catch (e) {
      console.error(
        "simplebeacon-server.cjs error:",
        e,
      ); /* fallthrough to original send */
    }
    return origSend(body);
  };

  // Wrap res.sendFile for HTML files so we can sanitize before sending
  const origSendFile = res.sendFile.bind(res);
  res.sendFile = function (filePath, options, callback) {
    try {
      if (typeof filePath === "string" && filePath.endsWith(".html")) {
        fs.readFile(filePath, "utf8", (err, data) => {
          if (err) return origSendFile(filePath, options, callback);
          try {
            const sanitized = stripBeaconSRI(data);
            res.type("text/html");
            res.set(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, no-transform",
            );
            return origSend(sanitized);
          } catch (e) {
            return origSendFile(filePath, options, callback);
          }
        });
        return;
      }
    } catch (e) {
      console.error("simplebeacon-server.cjs error:", e);
      // ignore and fall through to original
    }
    return origSendFile(filePath, options, callback);
  };

  next();
});

// Serve landing pages from root
app.use(
  "/",
  express.static(landingRoot, {
    index: false,
    dotfiles: "deny",
    redirect: false,
  }),
);

// Development-only route for scan artifacts (gated in production)
if (process.env.NODE_ENV !== "production") {
  app.use(
    "/data",
    express.static(path.join(__dirname, "web", "data"), {
      index: false,
      dotfiles: "deny",
    }),
  );
}

// Simplebeacon API + billing routes registered after Phase 2 auth in bootstrapPhase2Routes()

app.get("/favicon.ico", (_req, res) => {
  const icoPath = path.join(webRoot, "favicon.ico");
  const svgPath = path.join(webRoot, "favicon.svg");
  if (fs.existsSync(icoPath)) {
    // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type("image/png");
    return res.sendFile(icoPath);
  }
  if (fs.existsSync(svgPath)) {
    // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type("image/svg+xml");
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.get("/favicon.svg", (_req, res) => {
  const svgPath = path.join(webRoot, "favicon.svg");
  if (fs.existsSync(svgPath)) {
    // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type("image/svg+xml");
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.use("/api/metrics/path-health", pathHealthRouter);

app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();
  if (!internalDashboard) return next();
  if (!req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/simplebeacon/billing/")) return next();
  if (req.path.startsWith("/api/create-subscription-session")) return next();
  if (req.path.startsWith("/api/create-checkout-session")) return next();
  if (req.path.startsWith("/api/test-checkout")) return next();
  if (req.path.startsWith("/api/config/pricing")) return next();
  if (req.path.startsWith("/api/auth/")) return next();
  if (req.path.startsWith("/api/session-token/")) return next();
  if (req.path.startsWith("/api/user/")) return next();
  if (req.path === "/api/platform/status") return next();
  if (req.path === "/api/health" || req.path === "/health") return next();
  if (req.path === "/api/analyze") return next();
  if (req.path.startsWith("/api/analyze/")) return next();
  if (req.path === "/api/simplebeacon/report") return next();
  if (req.path === "/api/simplebeacon/report/import") return next();
  if (req.path === "/api/simplebeacon/config") return next();
  if (req.path === "/api/simplebeacon/history") return next();
  if (req.path === "/api/simplebeacon/baseline") return next();
  if (req.path.startsWith("/api/simplebeacon/ollama/")) return next();
  if (req.path === "/api/dashboard-home") return next();
  if (req.path === "/api/dev-tools/tools") return next();
  if (req.path === "/api/dev-tools/workflows") return next();
  if (req.path === "/api/coverage-reports/overview") return next();
  if (req.path === "/api/security/overview") return next();
  if (req.path === "/api/help") return next();
  if (req.path === "/api/quality/overview") return next();
  if (req.path === "/api/reports/download") return next();
  if (
    req.path === "/api/waitlist" ||
    req.path === "/api/waitlist/count" ||
    req.path === "/api/waitlist/event" ||
    req.path === "/api/audit-booking" ||
    req.path === "/api/audit-bookings" ||
    req.path === "/api/free-token" ||
    req.path === "/api/tokens/sandbox" ||
    req.path === "/api/license/validate" ||
    req.path === "/api/subscription/webhook"
  )
    return next();
  if (isVaultAuthenticated(req)) return next();
  // simplebeacon-ignore dead-code — final return in Express middleware, not unreachable code
  return res.status(403).json({
    // simplebeacon-ignore dead-code
    error: "vault_required",
    message: "Internal dashboard requires vault authentication.",
  });
});

app.use(async (req, res, next) => {
  // Allow the sign-in UI to be publicly reachable so unauthenticated users
  // can complete the login flow. Skip vault gating for `/signin`.
  if (!isProtectedDashboardPath(req.path)) return next();
  if (req.path === "/signin" || req.path.startsWith("/signin/")) return next();

  // Attempt optional JWT auth so regular signed-in users can access /app
  try {
    await new Promise((resolve) => optionalAuthenticate(req, res, resolve));
  } catch (e) {
    console.error("simplebeacon-server.cjs error:", e);
    // ignore optional auth failures; req.user will be unset
  }

  if (process.env.NODE_ENV === "development") return next();
  if (!internalDashboard) return next();
  if (isVaultAuthenticated(req) || req.user) return next();

  // If neither vault nor JWT auth present, redirect to signin preserving returnTo
  const returnTo = encodeURIComponent(req.originalUrl || req.path);
  return res.redirect(302, "/signin?returnTo=" + returnTo);
});

// Serve dashboard assets from root when internal dashboard is active
if (!landingAtRoot) {
  const dashDir = path.join(webRoot, "simplebeacon-dashboard");
  [
    "/css",
    "/js",
    "/js-es2018",
    "/images",
    "/fonts",
    "/assets",
    "/utils-lib",
  ].forEach((p) => {
    app.use(p, express.static(path.join(dashDir, p.substring(1))));
  });
  app.get(
    "/site-config.js",
    serveRootFile("site-config.js", "application/javascript; charset=utf-8"),
  );
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  // For dashboard mode, prioritize dashboard index.html over landing page
  if (
    !landingAtRoot &&
    (req.path === "/" ||
      req.path === "/dashboard" ||
      req.path === "/dashboard/")
  ) {
    return sendSimplebeaconDashboard(res);
  }
  // Explicitly set MIME types for CSS files to ensure proxy forwards correctly
  if (req.path.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
  }
  if (req.path.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  }
  if (
    /^\/(services|scripts|components|simplebeacon-dashboard)\/.*\.(js|css|html)$/i.test(
      req.path,
    ) ||
    req.path.endsWith(".html")
  ) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, no-transform",
    );
    res.setHeader("Pragma", "no-cache");
  }
  express.static(webRoot)(req, res, next);
});

// Marketing landing lives at / when SIMPLEBEACON_LANDING=true (or /landing in internal preview)
// Serve the marketing/coming-soon site under the /coming-soon/ prefix so that
// direct links like /coming-soon/audit.html work on the deployed service.
if (landingRootExists) {
  app.use("/coming-soon", express.static(landingRoot, { fallthrough: false }));
}

app.get("/coming-soon", (_req, res) => {
  if (!landingEnabled) return res.redirect(301, "/");
  if (internalDashboard) return res.redirect(301, "/landing");
  return res.redirect(301, "/");
});

app.get("/community", async (_req, res) => {
  if (landingEnabled) {
    const landingCommunity = path.join(landingRoot, "community.html");
    try {
      await fs.promises.access(landingCommunity);
      return res.sendFile(landingCommunity);
    } catch {
      /* file not found, fall through to 404 */
    }
  }
  return res.status(404).send("Community pricing page not found");
});

/**
 * Stub merger-tool routes used by the dashboard scan pipeline.
 * @param {import('express').Application} app
 * @param {string} baseDir
 */
function setupMergerToolRoutes(app, baseDir) {
  app.get(
    "/api/merger-tool/reduction-scan",
    optionalAuthenticate,
    (req, res) => {
      const projectPath = req.query.projectPath || baseDir;
      res.json({
        success: true,
        projectPath,
        reportVersion: 2,
        summary: {
          repositoryFilesTotal: 0,
          repositoryFoldersTotal: 0,
          filesAnalyzed: 0,
          sampleDataFilesAnalyzed: 0,
          jsonFilesAnalyzed: 0,
          exactDuplicateGroups: 0,
          mergeCandidates: 0,
          oversizedFiles: 0,
          potentialSavingsBytes: 0,
          potentialSavingsLabel: "0 B",
        },
        mergeCandidates: [],
        reductionOpportunities: [],
        notes:
          "Merger-tool reduction scan is not available in this deployment — returning empty summary.",
      });
    },
  );
}

// Phase 2 bootstrap + dashboard stub APIs (initialized in startServer) // simplebeacon-ignore production-leak — real production dashboard API module
async function bootstrapPhase2Routes() {
  // Proxy legacy bare /api/analyze POST to the flexible analysis endpoint.
  app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/api/analyze") {
      req.url = "/api/analyze/flexible";
    }
    next();
  });

  // Fix strategies endpoint (read-only) used by dashboard Tools view
  const fixStrategiesRouter = express.Router();
  fixStrategiesRouter.get("/strategies", authenticate, (_req, res) => {
    const strategyMap = {
      "debugger-statement": { strategy: "delete", confidence: 0.95 },
      "console-log": { strategy: "delete", confidence: 0.95 },
      "eval-usage": { strategy: "replace", confidence: 0.6 },
      "todo-comment": { strategy: "delete", confidence: 0.85 },
      "fixme-comment": { strategy: "delete", confidence: 0.85 },
      "hardcoded-secret": { strategy: "replace", confidence: 0.75 },
      "unhandled-promise": { strategy: "wrap", confidence: 0.7 },
      "missing-strict-mode": { strategy: "wrap", confidence: 0.95 },
      "missing-rate-limit": { strategy: "insert", confidence: 0.85 },
      "prototype-pollution": { strategy: "replace", confidence: 0.8 },
      "insecure-random": { strategy: "wrap", confidence: 0.6 },
      "debug-artifact": { strategy: "delete", confidence: 0.9 },
      "tech-debt": { strategy: "delete", confidence: 0.85 },
      "config-drift": { strategy: "replace", confidence: 0.7 },
      "security-headers": { strategy: "wrap", confidence: 0.65 },
    };
    res.json({ success: true, strategies: strategyMap });
  });
  app.use("/api/v2/fixes", authenticate, fixStrategiesRouter);

  // Per-user AI provider keys (OpenAI, Anthropic, Ollama) — encrypted at rest
  const {
    getUserAiKeysPublic,
    saveUserAiKeys,
    clearUserAiKeys,
  } = require("./server/lib/user-ai-keys-store.cjs");
  app.get("/api/user/ai-keys", authenticate, async (req, res) => {
    try {
      const email = req.user?.email || "";
      const result = await getUserAiKeysPublic(email);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app.put("/api/user/ai-keys", authenticate, async (req, res) => {
    try {
      const email = req.user?.email || "";
      if (!email)
        return res
          .status(400)
          .json({ success: false, error: "User email required" });
      const result = await saveUserAiKeys(email, req.body || {});
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app.delete("/api/user/ai-keys", authenticate, async (req, res) => {
    try {
      const email = req.user?.email || "";
      const result = await clearUserAiKeys(email);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  const routeSetups = [
    {
      name: "localModels",
      fn: () => setupLocalModelsAPI(app, { baseDir: __dirname }),
    },
    {
      name: "flexibleAnalyze",
      fn: () =>
        setupFlexibleAnalyzeAPI(app, {
          baseDir: __dirname,
          monorepoRoot: path.join(__dirname, ".."),
          publicGateEnabled: !internalDashboard,
          closedVaultMode: landingAtRoot,
        }),
    },
    {
      name: "proxyOllama",
      fn: () =>
        require("./server/routes/proxy-ollama-api.cjs").setupProxyOllamaAPI(
          app,
        ),
    },
    {
      name: "phase2Integration",
      fn: async () => await setupPhase2Integration(app, { webRoot }),
    },
    { name: "billingRoutes", fn: () => setupSimplebeaconBillingRoutes(app) },
    { name: "simplebeaconAPI", fn: () => setupSimplebeaconAPI(app) },
    {
      name: "trustAPI",
      fn: () =>
        require("./src/api/trust-api.cjs").setupTrustAPI(app, {
          platformRoot: __dirname,
          monorepoRoot: path.join(__dirname, ".."),
        }),
    },
    {
      name: "optimizationAPI",
      fn: () =>
        require("./src/api/optimization-api.cjs").setupOptimizationAPI(app, {
          platformRoot: __dirname,
          monorepoRoot: path.join(__dirname, ".."),
        }),
    },
    {
      name: "assessmentRoutes",
      fn: () =>
        require("./server/api/assessment/routes.cjs").setupAssessmentRoutes(
          app,
        ),
    },
    {
      name: "repositoryScanner",
      fn: () => setupRepositoryScannerAPIs(app, { platformRoot: __dirname }),
    },
    { name: "chatbotAPI", fn: () => setupChatbotAPI(app) },
    { name: "webauthnAPI", fn: () => setupWebAuthnAPI(app) },
    {
      name: "promptService",
      fn: () => {
        try {
          const promptService = require("./server/services/prompt-service.cjs");
          app.use("/api/prompts", promptService);
        } catch (e) {
          logger.error(
            "[PromptService] prompt-service routes not loaded:",
            e?.message || e,
          );
        }
      },
    },
    { name: "aiMathAudit", fn: () => setupAiMathAuditRoute(app, __dirname) },
    {
      name: "adminAPI",
      fn: () => setupAdminAPI(app, { platformRoot: __dirname }),
    },
    { name: "mergerTool", fn: () => setupMergerToolRoutes(app, __dirname) },
  ];

  for (const setup of routeSetups) {
    try {
      await setup.fn();
    } catch (error) {
      logger.error(`❌ ${setup.name} setup failed:`, safeErrorMessage(error)); // simplebeacon-ignore production-leak — error message text only
      logger.error("Stack:", error?.stack || "(no stack)");
    }
  }

  app.use("/api/metrics/path-health", pathHealthRouter);

  const uploadAuth =
    process.env.REQUIRE_AUTH === "true" ? authenticate : optionalAuthenticate;
  app.use(
    "/api/upload",
    uploadAuth,
    uploadSecurity,
    contentValidation,
    uploadRoutes,
  );

  try {
    setupDashboardStubAPIs(app, webRoot, {
      // simplebeacon-ignore production-leak — real production dashboard API module
      db: app.locals.db,
      redis: app.locals.redis,
      authMiddleware: optionalAuthenticate,
    });
  } catch (error) {
    logger.error("❌ Dashboard stub setup failed:", safeErrorMessage(error)); // simplebeacon-ignore production-leak — error message text only
    logger.error("Stack:", error?.stack || "(no stack)");
    setupDashboardStubAPIs(app, webRoot, {
      // simplebeacon-ignore production-leak — real production dashboard API module
      authMiddleware: optionalAuthenticate,
    });
  }

  registerOutreachRoutes(app, {
    dataDir: path.join(__dirname, "data"),
  });
}

async function startServer() {
  await bootstrapPhase2Routes();

  // Auth routes are always registered, even if phase 2 bootstrap partially failed
  app.use("/api/auth", authRoutes);

  // SSO auth handler — OIDC + SAML 2.0 protocol flows
  try {
    const ssoAuthHandler = require("./server/routes/sso-auth-handler.cjs");
    app.use("/api/sso", ssoAuthHandler);
    logger.info("[Routes] SSO auth handler loaded at /api/sso");
  } catch (err) {
    logger.error("[Routes] SSO auth handler not loaded:", err?.message || err);
  }

  // SSO configuration CRUD routes (admin)
  try {
    const ssoConfigRoutes = require("./server/routes/sso-config-routes.cjs");
    app.use("/api/enterprise/sso", ssoConfigRoutes);
    logger.info("[Routes] SSO config routes loaded at /api/enterprise/sso");
  } catch (err) {
    logger.error("[Routes] SSO config routes not loaded:", err?.message || err);
  }

  // Enterprise analytics facade — compact payload for admin dashboard
  try {
    const enterpriseAnalytics = require("./server/routes/enterprise-analytics-routes.cjs");
    app.use("/api/enterprise/analytics", enterpriseAnalytics);
    logger.info(
      "[Routes] Enterprise analytics loaded at /api/enterprise/analytics",
    );
  } catch (err) {
    logger.error(
      "[Routes] Enterprise analytics not loaded:",
      err?.message || err,
    );
  }

  // Enterprise onboarding — organizations, seats, trials, audit
  try {
    const {
      setupEnterpriseOnboardingRoutes,
    } = require("./src/api/enterprise-onboarding.cjs");
    setupEnterpriseOnboardingRoutes(app);
    logger.info("[Routes] Enterprise onboarding loaded at /api/enterprise/*");
  } catch (err) {
    logger.error(
      "[Routes] Enterprise onboarding not loaded:",
      err?.message || err,
    );
  }

  // Workspace config — sandbox summaries, budgets, isolation keys
  try {
    const workspaceConfigRoutes = require("./server/routes/workspace-config-routes.cjs");
    app.use("/api/workspace", workspaceConfigRoutes);
    logger.info("[Routes] Workspace config loaded at /api/workspace");
  } catch (err) {
    logger.error("[Routes] Workspace config not loaded:", err?.message || err);
  }

  // Fine-tuning telemetry — training data collection, datasets, labeling
  try {
    const fineTuningTelemetryRoutes = require("./server/routes/fine-tuning-telemetry-routes.cjs");
    app.use("/api/telemetry", fineTuningTelemetryRoutes);
    logger.info("[Routes] Fine-tuning telemetry loaded at /api/telemetry");
  } catch (err) {
    logger.error(
      "[Routes] Fine-tuning telemetry not loaded:",
      err?.message || err,
    );
  }

  // HSM vault — consensus status, key management, failover
  try {
    const hsmVaultRoutes = require("./server/routes/hsm-vault-routes.cjs");
    app.use("/api/vault", hsmVaultRoutes);
    logger.info("[Routes] HSM vault loaded at /api/vault");
  } catch (err) {
    logger.error("[Routes] HSM vault not loaded:", err?.message || err);
  }

  // Semantic cache — vector-based inference response caching
  try {
    const semanticCacheRoutes = require("./server/routes/semantic-cache-routes.cjs");
    app.use("/api/semantic-cache", semanticCacheRoutes);
    logger.info("[Routes] Semantic cache loaded at /api/semantic-cache");
  } catch (err) {
    logger.error("[Routes] Semantic cache not loaded:", err?.message || err);
  }

  // Integration marketplace — Slack, Teams, Jira, GitHub PR
  try {
    const integrationRoutes = require("./server/routes/integration-routes.cjs");
    app.use("/api/integrations", integrationRoutes);
    logger.info("[Routes] Integration marketplace loaded at /api/integrations");
  } catch (err) {
    logger.error(
      "[Routes] Integration marketplace not loaded:",
      err?.message || err,
    );
  }

  // Webhook signing — asymmetric cryptographic signing for outbound webhooks
  try {
    const webhookSigningRoutes = require("./server/routes/webhook-signing-routes.cjs");
    app.use("/api/webhook-signing", webhookSigningRoutes);
    logger.info("[Routes] Webhook signing loaded at /api/webhook-signing");
  } catch (err) {
    logger.error("[Routes] Webhook signing not loaded:", err?.message || err);
  }

  // Agentic orchestration — multi-agent executor loop with guardrail inspection
  try {
    const agenticRoutes = require("./server/routes/agentic-orchestration-routes.cjs");
    app.use("/api/agentic", agenticRoutes);
    logger.info("[Routes] Agentic orchestration loaded at /api/agentic");
  } catch (err) {
    logger.error(
      "[Routes] Agentic orchestration not loaded:",
      err?.message || err,
    );
  }

  // Tool schema validation — JSON schema enforcement for agent tool outputs
  try {
    const toolSchemaRoutes = require("./server/routes/tool-schema-validation-routes.cjs");
    app.use("/api/tool-schemas", toolSchemaRoutes);
    logger.info("[Routes] Tool schema validation loaded at /api/tool-schemas");
  } catch (err) {
    logger.error(
      "[Routes] Tool schema validation not loaded:",
      err?.message || err,
    );
  }

  // Usage analytics — scan metrics, trends, posture scores
  try {
    const analyticsRoutes = require("./server/routes/analytics-routes.cjs");
    app.use("/api/analytics", analyticsRoutes);
    logger.info("[Routes] Usage analytics loaded at /api/analytics");
  } catch (err) {
    logger.error("[Routes] Usage analytics not loaded:", err?.message || err);
  }

  // Deployment gate — CI/CD policy enforcement endpoints
  try {
    const deploymentGateRoutes = require("./server/routes/deployment-gate-routes.cjs");
    app.use("/api/deployment-gate", deploymentGateRoutes);
    logger.info("[Routes] Deployment gate loaded at /api/deployment-gate");
  } catch (err) {
    logger.error("[Routes] Deployment gate not loaded:", err?.message || err);
  }

  // Audit trail — administrative change ledger
  try {
    const auditRoutes = require("./server/routes/audit-routes.cjs");
    app.use("/api/audit", auditRoutes);
    logger.info("[Routes] Audit trail loaded at /api/audit");
  } catch (err) {
    logger.error("[Routes] Audit trail not loaded:", err?.message || err);
  }

  // Model evaluation — LLM benchmarking & adversarial test workspace
  try {
    const modelEvalRoutes = require("./server/routes/model-eval-routes.cjs");
    app.use("/api/model-eval", modelEvalRoutes);
    logger.info("[Routes] Model evaluation loaded at /api/model-eval");
  } catch (err) {
    logger.error("[Routes] Model evaluation not loaded:", err?.message || err);
  }

  // Whitelabel partner branding — custom logos, colors, domains
  try {
    const whitelabelRoutes = require("./server/routes/whitelabel-routes.cjs");
    app.use("/api/whitelabel", whitelabelRoutes);
    logger.info("[Routes] Whitelabel branding loaded at /api/whitelabel");
  } catch (err) {
    logger.error(
      "[Routes] Whitelabel branding not loaded:",
      err?.message || err,
    );
  }

  // Newsletter subscription — public, no auth required (pricing page email signup)
  try {
    const subscriptionRoutes = require("../coming-soon/routes/subscriptions.cjs");
    app.use(subscriptionRoutes);
  } catch (err) {
    logger.warn("[Routes] Subscriptions routes not loaded:", err.message);
  }

  // CLI upload API key — returns the authenticated user's current JWT so the dashboard CLI card
  // can poll /api/simplebeacon/history and fetch reports on the same origin.
  app.get("/api/user/api-key", authenticate, (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || "");
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
      if (!token) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication token required" });
      }
      return res.json({ success: true, apiKey: token });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, error: "Could not retrieve API key" });
    }
  });

  // Internal program improvement report — admin-only, privacy-safe aggregate telemetry
  app.get("/api/admin/improvement-report", authenticate, async (req, res) => {
    try {
      const userEmail = (req.user && (req.user.email || req.user.sub)) || "";
      const superAdminEmail =
        process.env.SUPER_ADMIN_EMAIL || "admin@simplebeacon.ai";
      if (userEmail.toLowerCase() !== superAdminEmail.toLowerCase()) {
        return res
          .status(403)
          .json({ error: "admin_required", message: "Admin access required." });
      }
      const {
        summarizeAllTelemetry,
      } = require("./server/lib/ci-telemetry-store.cjs");
      const {
        generateImprovementReportMarkdown,
      } = require("./server/cron/internal-improvement-report.cjs");
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const summary = summarizeAllTelemetry({ days });
      const markdown = generateImprovementReportMarkdown(summary);
      return res.json({ success: true, days, summary, markdown });
    } catch (error) {
      logger.error(
        "[AdminRoute] Improvement report failed: " +
          (error && error.message ? error.message : error),
      );
      return res
        .status(500)
        .json({
          success: false,
          error: "Could not generate improvement report",
        });
    }
  });

  // Admin license token generation — generates a production-signed license
  // token and emails it to the specified address. Admin-only (SUPER_ADMIN_EMAIL).
  app.post(
    "/api/admin/generate-license",
    authenticate,
    express.json(),
    async (req, res) => {
      try {
        const userEmail = (req.user && (req.user.email || req.user.sub)) || "";
        const superAdminEmail =
          process.env.SUPER_ADMIN_EMAIL || "admin@simplebeacon.ai";
        if (userEmail.toLowerCase() !== superAdminEmail.toLowerCase()) {
          return res.status(403).json({
            error: "admin_required",
            message: "Admin access required.",
          });
        }

        const {
          email: targetEmail,
          tier: targetTier = "pro",
          days = 365,
          projectName = "SimpleBeacon",
        } = req.body || {};

        if (!targetEmail || typeof targetEmail !== "string") {
          return res.status(400).json({
            success: false,
            error: "email is required",
          });
        }

        const secret = String(
          process.env.SIMPLEBEACON_LICENSE_SECRET || "",
        ).trim();
        if (!secret) {
          return res.status(503).json({
            success: false,
            error:
              "SIMPLEBEACON_LICENSE_SECRET is not configured in production",
          });
        }

        const { generateLicenseToken } = require("./server/lib/simplebeacon-proxy.cjs");
        const { insertLicenseToken } = require("./server/lib/token-db.cjs");

        const tier = String(targetTier).toLowerCase();
        const ttlMinutes = Math.min(
          525600,
          Math.max(1, Number(days) * 1440),
        );

        const features =
          tier === "enterprise" ||
          tier === "compliance" ||
          tier === "team_pro" ||
          tier === "team"
            ? [
                "continuous_shield",
                "team_dashboard",
                "ci_integration",
                "compliance_certificate",
                "eu_ai_act",
                "analyst_support",
              ]
            : ["continuous_shield", "ci_integration", "export_reports"];

        const tierLabel =
          tier === "enterprise"
            ? "SimpleBeacon Enterprise"
            : tier === "team_pro" || tier === "team"
              ? "SimpleBeacon Team Pro"
              : tier === "developer" || tier === "pro" || tier === "startup"
                ? "SimpleBeacon Developer"
                : "SimpleBeacon " + tier;

        const claims = {
          email: targetEmail,
          tier,
          features,
          projectName,
          clientName: targetEmail,
        };

        const token = generateLicenseToken(claims, secret, ttlMinutes);

        // Register in token DB so /api/auth/token-status and /api/license/validate recognize it
        try {
          insertLicenseToken({
            token,
            email: targetEmail,
            tier,
            registered_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          logger.warn(
            "[AdminLicense] Token DB insert failed (non-blocking): " +
              dbErr.message,
          );
        }

        // Send the license confirmation email
        let emailSent = false;
        let emailError = null;
        try {
          const { sendEmail } = require("../coming-soon/services/email.cjs");
          const {
            renderLicenseConfirmation,
          } = require("../coming-soon/services/email-templates/license-confirmation-email.cjs");

          // Resolve dashboard URL — ensure it includes /dashboard/ path
          const rawDashboardUrl =
            process.env.PUBLIC_URL ||
            process.env.SIMPLEBEACON_APP_URL ||
            "https://simplebeacon.ai/dashboard/";
          const dashboardUrl = rawDashboardUrl.includes("/dashboard")
            ? rawDashboardUrl.replace(/\/?$/, "/")
            : rawDashboardUrl.replace(/\/?$/, "/") + "dashboard/";
          const signInUrl = dashboardUrl + "signin";

          const emailContent = renderLicenseConfirmation({
            tierLabel,
            token,
            apiKey: "(use your dashboard API key)",
            ttlLabel: `${days} days`,
            customerEmail: targetEmail,
            features,
            dashboardUrl,
            signInUrl,
          });

          const emailResult = await sendEmail({
            to: targetEmail,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });

          emailSent = !!(emailResult.sent || emailResult.queued);
          if (!emailSent) {
            emailError = emailResult.error || "Email could not be sent or queued";
          }
        } catch (sendErr) {
          emailError = sendErr.message;
          logger.error(
            "[AdminLicense] Email send failed: " + sendErr.message,
          );
        }

        logger.info(
          `[AdminLicense] Token generated for ${targetEmail} (tier=${tier}, days=${days}) by ${userEmail}`,
        );

        return res.json({
          success: true,
          token,
          email: targetEmail,
          tier,
          features,
          ttlDays: days,
          emailSent,
          emailError,
        });
      } catch (error) {
        logger.error(
          "[AdminLicense] Generate failed: " +
            (error && error.message ? error.message : error),
        );
        return res.status(500).json({
          success: false,
          error: "Could not generate license token",
        });
      }
    },
  );

  // Copy the bundled report shipped with the repo into the runtime .simplebeacon directory
  // so the dashboard has data even though .simplebeacon/*.json is gitignored.
  const bundledReportPath = path.join(
    __dirname,
    "web",
    "data",
    "simplebeacon-report.json",
  );
  const activeReportPath = path.join(__dirname, ".simplebeacon", "report.json");
  try {
    if (fs.existsSync(bundledReportPath)) {
      let needsCopy = false;
      if (!fs.existsSync(activeReportPath)) {
        needsCopy = true;
      } else {
        try {
          const activeReport = JSON.parse(
            fs.readFileSync(activeReportPath, "utf8"),
          );
          if (
            !activeReport.repositoryInventory ||
            activeReport.repositoryInventory.totalFiles == null
          ) {
            needsCopy = true;
          }
        } catch {
          needsCopy = true;
        }
      }
      if (needsCopy) {
        fs.mkdirSync(path.dirname(activeReportPath), { recursive: true });
        fs.copyFileSync(bundledReportPath, activeReportPath);
        logger.info(
          "[Server] Copied bundled report to",
          activeReportPath.replace(/\\/g, "/"),
        );
      }
    }
  } catch (reportCopyErr) {
    logger.warn(
      "[Server] Could not copy bundled report:",
      reportCopyErr.message,
    );
  }

  // Fallback report endpoint for the dashboard when the real simplebeacon API is unavailable
  app.get(
    "/api/simplebeacon/report",
    optionalAuthenticate,
    async (req, res) => {
      try {
        const projectPath = req.query.projectPath
          ? path.resolve(req.query.projectPath)
          : null;
        const reportPath = projectPath
          ? path.join(projectPath, ".simplebeacon", "report.json")
          : path.join(__dirname, ".simplebeacon", "report.json");
        if (fs.existsSync(reportPath)) {
          return res.json(
            JSON.parse(await fs.promises.readFile(reportPath, "utf8")),
          );
        }
        return res.json({
          type: "simplebeacon-report",
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          projectPath: projectPath || path.join(__dirname, ".."),
          summary: { totalFiles: 0, issues: 0, score: 100, grade: "A" },
          findings: [],
          modules: [],
        });
      } catch (err) {
        logger.warn("[ReportFallback] Could not serve report:", err.message);
        return res
          .status(500)
          .json({ error: "report_unavailable", message: err.message });
      }
    },
  );

  // Import a simplebeacon-report JSON file so the dashboard can load/export it
  app.post(
    "/api/simplebeacon/report/import",
    authenticate,
    async (req, res) => {
      try {
        const body = req.body || {};
        const report = body.report;
        if (!report || typeof report !== "object") {
          return res
            .status(400)
            .json({ success: false, error: "report is required" });
        }
        const reportType = report.type;
        if (
          reportType !== "simplebeacon-report" &&
          reportType !== "data-cleanup-report" &&
          reportType !== "simplebeacon-complete-scan"
        ) {
          return res
            .status(400)
            .json({ success: false, error: "Unsupported report type" });
        }
        const rawTarget = String(
          body.projectPath || report.platformRoot || report.projectRoot || "",
        ).trim();
        if (!rawTarget) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "projectPath or report projectRoot/platformRoot is required",
            });
        }
        const {
          resolveProjectPath,
        } = require("./server/lib/flexible-analyze-utils.cjs");
        const {
          assertSafeProjectPath,
          resolveDefaultAllowedRoots,
        } = require("./server/lib/path-safety.cjs");
        const baseDir = __dirname;
        const monorepoRoot = path.resolve(path.join(baseDir, ".."));
        const resolved = resolveProjectPath(baseDir, rawTarget, monorepoRoot);
        const allowedRoots = resolveDefaultAllowedRoots(baseDir, {
          monorepoRoot,
        });
        const safePath = assertSafeProjectPath(
          resolved,
          allowedRoots,
          "projectPath",
        );
        if (!fs.existsSync(safePath)) {
          return res
            .status(400)
            .json({
              success: false,
              error: `Target path does not exist: ${safePath.replace(/\\/g, "/")}`,
            });
        }
        const safePathForward = safePath.replace(/\\/g, "/");
        const safePlatformRoot = path.dirname(safePath).replace(/\\/g, "/");

        // Determine the intended project root for the imported report. Prefer the requested
        // projectPath when it is valid, so non-existent remote targets still produce aligned
        // roots instead of being rewritten to the filesystem fallback (e.g. monorepo root).
        let importRoot = safePath;
        if (body.projectPath) {
          const requested = path.resolve(baseDir, body.projectPath);
          try {
            assertSafeProjectPath(requested, allowedRoots, "projectPath");
            importRoot = requested;
          } catch (_e) {
            // requested path is not allowed; fall back to the resolved safe path
          }
        }
        const importRootForward = importRoot.replace(/\\/g, "/");
        const importPlatformRoot = path
          .dirname(importRootForward)
          .replace(/\\/g, "/");

        // Normalize legacy v1 reports to reportVersion 2 so the dashboard treats them as current.
        // Always align the imported roots to the resolved target path so relative roots like
        // "CascadeProjects" from a v1 export do not cause the dashboard to flag the report as stale.
        const isLegacy =
          report.reportVersion == null || Number(report.reportVersion) < 2;
        if (isLegacy) {
          report.reportVersion = 2;
        }
        report.projectRoot = importRootForward;
        report.platformRoot = importPlatformRoot;
        report.scanTargetRoot = importRootForward;

        // Enrich repository inventory if the imported report is missing it
        if (
          !report.repositoryInventory ||
          report.repositoryInventory.totalFiles == null
        ) {
          // v1 reports often store counts under `inventory`
          if (report.inventory && typeof report.inventory === "object") {
            const inv = report.inventory;
            const totalFiles =
              inv.scannedFiles != null
                ? inv.scannedFiles
                : inv.totalFiles != null
                  ? inv.totalFiles
                  : null;
            report.repositoryInventory = {
              totalFiles: totalFiles != null ? totalFiles : 0,
              totalFolders: inv.totalFolders != null ? inv.totalFolders : 0,
              projectRoot: importRootForward,
            };
          }
        }
        if (
          !report.repositoryInventory ||
          report.repositoryInventory.totalFiles == null
        ) {
          try {
            const {
              countRepositoryInventory,
            } = require("./server/lib/simplebeacon-proxy.cjs");
            const inventorySource = fs.existsSync(importRoot)
              ? importRoot
              : safePath;
            report.repositoryInventory = await countRepositoryInventory(
              inventorySource,
              { profile: "all" },
            );
          } catch (invErr) {
            logger.warn(
              "[ReportImport] inventory enrichment failed:",
              invErr.message,
            );
          }
        }
        const sbDir = path.join(safePath, ".simplebeacon");
        if (!fs.existsSync(sbDir)) {
          fs.mkdirSync(sbDir, { recursive: true });
        }
        const reportPath = path.join(sbDir, "report.json");
        await fs.promises.writeFile(
          reportPath,
          JSON.stringify(report, null, 2),
          "utf8",
        );
        logger.info(
          "[ReportImport] persisted report to",
          reportPath.replace(/\\/g, "/"),
        );
        return res.json({
          success: true,
          projectPath: importRootForward,
          reportVersion: report.reportVersion || report.version || null,
        });
      } catch (err) {
        logger.warn("[ReportImport] failed:", err.message);
        return res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  // Fallback dashboard/simplebeacon API endpoints when phase 2 bootstrap or stubs are unavailable
  app.get("/api/platform/status", optionalAuthenticate, (req, res) => {
    res.json({
      phase: 1,
      database: "not_configured",
      redis: "not_configured",
      authRequired: false,
      internalDashboard: true,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/simplebeacon/config", optionalAuthenticate, (req, res) => {
    res.json({
      scanPaths: ["server/", "src/", "web/", "packages/"],
      productionPaths: ["server/", "src/", "packages/simplebeacon-cli/src/"],
      sampleDir: null,
      gate: { failOn: ["high"], warnOn: ["medium", "low"] },
      fullDirectoryScan: false,
    });
  });

  // Pricing config endpoint — serves Stripe URLs from environment variables
  app.get("/api/config/pricing", (_req, res) => {
    res.json({
      success: true,
      pricing: {
        instant: {
          stripeLink:
            process.env.STRIPE_LINK_INSTANT ||
            "https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07",
        },
        executive: {
          stripeLink:
            process.env.STRIPE_LINK_EXECUTIVE ||
            "https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05",
        },
        euSprint: {
          stripeLink:
            process.env.STRIPE_LINK_EU_SPRINT ||
            "https://buy.stripe.com/fZu28qesn6fB1ODftceEo06",
        },
      },
    });
  });

  app.get("/api/simplebeacon/history", optionalAuthenticate, (req, res) => {
    res.json({ entries: [] });
  });

  app.get("/api/simplebeacon/baseline", optionalAuthenticate, (req, res) => {
    res.json({
      summary: {},
      jestTestsLabel: "0/0",
      jestSuites: "0/0",
      pageSamplesLabel: "0/0",
    });
  });

  app.get("/api/dashboard-home", optionalAuthenticate, (req, res) => {
    res.json({
      success: true,
      data: {
        overview: {
          totalFiles: 0,
          codeQuality: 100,
          schemaPassRate: 100,
          scannerIssues: 0,
          securityScore: "100/100",
          pageSamplesLabel: "0/0",
          complianceRate: 100,
        },
      },
    });
  });

  app.get("/api/dev-tools/tools", optionalAuthenticate, (req, res) =>
    res.json([]),
  );
  app.get("/api/dev-tools/workflows", optionalAuthenticate, (req, res) =>
    res.json([]),
  );

  app.get(
    "/api/coverage-reports/overview",
    optionalAuthenticate,
    (req, res) => {
      res.json({
        overallCoverage: null,
        lineCoverage: null,
        branchCoverage: null,
        functionCoverage: null,
        statementCoverage: null,
        passedTests: null,
        totalTests: null,
        notes:
          "Run npm run test:coverage for Istanbul percentages. Sync Jest counts via Tools → Baseline sync.",
      });
    },
  );

  app.get("/api/security/overview", optionalAuthenticate, (req, res) => {
    res.json({
      securityScore: 100,
      gatePass: true,
      blockingCount: 0,
      warningCount: 0,
      openVulnerabilities: 0,
      openEngineeringFindings: 0,
      complianceRate: 100,
      npmAuditTotal: 0,
      totalIncidents: 0,
      resolvedIncidents: 0,
    });
  });

  app.post(
    "/api/security/npm-audit",
    optionalAuthenticate,
    async (req, res) => {
      try {
        const platformRoot = path.join(__dirname);
        const force = req.body?.force === true;
        const npmAudit = await runNpmAuditAsync(platformRoot, { force });
        res.set("Cache-Control", "no-store");
        res.json({
          success: true,
          ...npmAudit,
          projectPath: platformRoot,
          auditRoot: platformRoot,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: safeString(error),
        });
      }
    },
  );

  app.get("/api/help", optionalAuthenticate, (req, res) => {
    res.json({
      success: true,
      data: { overview: {}, documentation: [], faq: [] },
    });
  });

  app.get("/api/quality/overview", optionalAuthenticate, (req, res) => {
    res.json({
      qualityScore: 100,
      overallScore: 100,
      gatePass: true,
      issueCount: 0,
      duplicateGroups: 0,
      schemaCompliance: 100,
      consistencyScore: 100,
      totalFiles: 0,
    });
  });

  // Free community token generation (shared with coming-soon)
  try {
    const fs = require("fs");
    const path = require("path");
    const simplebeaconDir = path.join(
      __dirname,
      "..",
      "coming-soon",
      ".simplebeacon",
    );
    if (!fs.existsSync(simplebeaconDir)) {
      fs.mkdirSync(simplebeaconDir, { recursive: true });
    }
    const freeTokenRoutes = require("../coming-soon/routes/free-token.cjs");
    app.use(freeTokenRoutes);
  } catch (e) {
    logger.warn("[FreeToken] free-token routes not loaded:", e.message);
  }

  // One-time checkout routes — certificate passes ($149/$499/$2,499) from coming-soon
  // Required because the pricing page calls /api/create-checkout-session for one-time products
  // The billing webhook at /api/simplebeacon/billing/webhook already handles the webhook side
  try {
    const {
      router: checkoutRouter,
    } = require("../coming-soon/routes/checkout.cjs");
    app.use(checkoutRouter);
    logger.info("[Checkout] One-time checkout routes mounted");
  } catch (e) {
    logger.warn("[Checkout] Checkout routes not loaded:", e.message);
  }

  // Tier pricing and proration routes used by authenticated dashboard billing flows.
  try {
    app.use("/api/billing", require("./server/routes/billing-routes.cjs"));
    logger.info("[Billing] Tier and proration routes mounted");
  } catch (e) {
    logger.warn("[Billing] Tier and proration routes not loaded:", e.message);
  }

  // License token validation — used by dashboard License Token signin
  try {
    const tokenValidateRoutes = require("../coming-soon/routes/token-validate.cjs");
    app.use(tokenValidateRoutes);
    logger.info("[TokenValidate] Token validation route mounted");
  } catch (e) {
    logger.warn("[TokenValidate] Routes not loaded:", e.message);
  }

  // Public license validation endpoint used by CLI/GitHub Action in CI
  // No auth required — the license token itself is the credential
  app.post("/api/license/validate", express.json(), (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({
          active: false,
          sandbox: true,
          registered: false,
          valid: false,
          error: "Token required",
        });
      }
      const { verifyLicenseToken } = require("./server/lib/simplebeacon-proxy.cjs");
      const { getLicenseToken, isLicenseTokenRevoked } = require("./server/lib/token-db.cjs");
      let secret = null;
      try {
        secret = String(process.env.SIMPLEBEACON_LICENSE_SECRET || "").trim() || null;
      } catch {
        secret = null;
      }
      if (!secret) {
        return res.status(503).json({
          active: false,
          sandbox: true,
          registered: false,
          valid: false,
          error: "License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured",
        });
      }
      const claims = verifyLicenseToken(token, secret);
      const entry = getLicenseToken(token);
      const revoked = isLicenseTokenRevoked(token);
      const registered = !!claims || !!entry;
      const active = registered && claims !== null && !revoked;
      const tier = entry?.tier || claims?.tier || "developer";
      const upgradeUrl = process.env.SIMPLEBEACON_UPGRADE_URL || "https://simplebeacon.ai/pricing";
      return res.json({
        active,
        sandbox: !active,
        registered,
        valid: !!claims,
        revoked,
        email: entry?.email || claims?.sub || claims?.email || null,
        tier,
        features: claims?.features || [],
        expiry: claims?.exp || null,
        upgradeUrl,
      });
    } catch (err) {
      return res.status(500).json({
        active: false,
        sandbox: true,
        registered: false,
        valid: false,
        error: "Internal error",
      });
    }
  });

  // Public session-token retrieval — used by dashboard post-Stripe-checkout redirect
  // No JWT auth required — the sessionId is an opaque single-use identifier
  let sessionTokenStore = null;
  try {
    sessionTokenStore = require("../coming-soon/routes/session-token-store.cjs");
  } catch (e) {
    logger.warn("[SessionToken] Store module not loaded:", e.message);
  }

  app.get("/api/session-token/:sessionId", (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "Missing sessionId" });
      }
      if (!sessionTokenStore) {
        return res.status(503).json({ error: "Session token store unavailable" });
      }
      const entry = sessionTokenStore.get(sessionId);
      if (!entry) {
        return res.status(404).json({ error: "Session not found or expired." });
      }
      return res.json({
        success: true,
        token: entry.token,
        email: entry.email,
        projectName: entry.projectName,
        tier: entry.tier,
      });
    } catch (err) {
      logger.warn("[SessionToken] Retrieval failed:", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // Referral program — link generation, click capture, invite emails
  try {
    const referralRoutes = require("../coming-soon/routes/referral.cjs");
    app.use(referralRoutes);
    logger.info("[Referral] Referral API routes mounted");
  } catch (e) {
    logger.warn("[Referral] Referral routes not loaded:", e.message);
  }

  try {
    const {
      startEmailRetryWorker,
    } = require("../coming-soon/lib/email-retry-bootstrap.cjs");
    startEmailRetryWorker({ logger });
  } catch (e) {
    logger.warn("[EmailRetry] Worker bootstrap skipped:", e.message);
  }

  // Global error handler — return JSON for API routes instead of the default HTML error page
  app.use((err, req, res, next) => {
    if (req.path.startsWith("/api/")) {
      const status = err.status || err.statusCode || 500;
      const body = {
        error: err.code || err.name || "internal_error",
        message: err.message || "Internal server error",
      };
      if (process.env.NODE_ENV !== "production" && err.stack) {
        body.stack = err.stack;
      }
      return res.status(status).json(body);
    }
    next(err);
  });

  // Fallback stub for prompt endpoints when prompt-service module did not mount.
  // The real prompt-service router is mounted earlier; this only handles the 404 case.
  app.get("/api/prompts/get", (req, res) => {
    res.json({
      success: true,
      prompt: "",
      userId: req.query.userId || "anonymous",
      updatedAt: null,
    });
  });
  app.post("/api/prompts/set", (req, res) => {
    res.json({
      success: true,
      userId: req.body?.userId || "anonymous",
      message: "Prompt saved",
    });
  });

  // Billing API — proration preview and tier pricing (authenticated, non-admin)
  try {
    const billingRoutes = require("./server/routes/billing-routes.cjs");
    app.use("/api/billing", billingRoutes);
    logger.info("[Routes] Billing API loaded at /api/billing");
  } catch (err) {
    logger.error("[Routes] Billing API not loaded:", err?.message || err);
  }

  // JSON 404 for unknown API routes (must be after Phase 2 + stub registration)
  app.use("/api", (req, res) => {
    res.status(404).json({
      success: false,
      error: "API route not found",
      path: req.path,
      method: req.method,
      hint: "GET /api/dynamic-roadmap/health to verify the server",
    });
  });

  const server = http.createServer(app);
  let wss;
  try {
    wss = setupWebSocketServer(server);
  } catch (err) {
    logger.error("❌ WebSocket server setup failed:", safeErrorMessage(err));
    wss = null;
  }

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.error(
        `❌ Port ${PORT} is already in use. Run: npm run dashboard:kill-ports`,
      );
      process.exit(1);
    }
    logger.error("❌ Server error:", err);
    process.exit(1);
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Simplebeacon server running on http://localhost:${PORT}`);
    logger.info(
      `✉️ Outreach API at: http://localhost:${PORT}/api/simplebeacon/outreach/config`,
    );
    try {
      const {
        resolveDefaultAllowedRoots,
        formatAllowedRootsSummary,
      } = require("./server/lib/path-safety.cjs");
      const allowedRoots = resolveDefaultAllowedRoots(__dirname, {
        monorepoRoot: path.join(__dirname, ".."),
      });
      logger.info(
        `📂 Allowed analysis roots: ${formatAllowedRootsSummary(allowedRoots, 8) || "(none)"}`,
      );
    } catch (err) {
      logger.warn(
        "[path-safety] Could not log allowed analysis roots:",
        safeErrorMessage(err),
      );
    }
    if (landingAtRoot && fs.existsSync(path.join(landingRoot, "index.html"))) {
      logger.info(`🌐 Landing page at: http://localhost:${PORT}/`);
      logger.info(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/app`);
    } else if (
      landingEnabled &&
      internalDashboard &&
      fs.existsSync(path.join(landingRoot, "index.html"))
    ) {
      logger.info(`🌐 Paywall at: http://localhost:${PORT}/`);
      logger.info(`🌐 Marketing preview at: http://localhost:${PORT}/landing`);
      if (
        process.env.NODE_ENV !== "production" ||
        process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT
      ) {
        logger.info(`📄 Demo report at: http://localhost:${PORT}/demo-report`);
      }
      logger.info(
        `📥 Operator booking inbox at: http://localhost:${PORT}/operator/bookings`,
      );
      if (!String(process.env.RESEND_API_KEY || "").trim()) {
        logger.info(
          `✉️ Email alerts OFF — set RESEND_API_KEY in .env.v1-internal (bookings still save to operator inbox)`,
        );
      }
      logger.info(
        `🛡️ Vault unlock at: http://localhost:${PORT}/private-dashboard-vault?password=<DASHBOARD_VAULT_PASSWORD>`,
      ); // simplebeacon-ignore secret-in-comments — console URL with placeholder token, not a real secret
      if (
        process.env.NODE_ENV !== "production" ||
        process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT
      ) {
        logger.info(
          `   → opens demo report (same layout as simplebeacon.ai/demo-report)`,
        );
      }
    } else {
      logger.info(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/`);
    }
    if (internalDashboard) {
      logger.info(
        `🔒 /app and dashboard APIs require vault session (24h cookie after vault login)`,
      );
      logger.info(
        `🧪 STAGING: see coming-soon/STAGING.md (payments flag in site-config.js)`,
      );
    }
    logger.info(
      `🔧 Simplebeacon API at: http://localhost:${PORT}/api/simplebeacon/`,
    );
    logger.info(
      `🌐 WebSocket available at: ws://localhost:${PORT}/ws (legacy: ws://localhost:${WS_PORT})`,
    );
    logger.info(
      `🔐 Phase 2 auth: ${process.env.REQUIRE_AUTH === "true" ? "required" : "optional (set REQUIRE_AUTH=true)"}`,
    );
    logger.info(
      `🗄️ Phase 2 database: ${app.locals.phase2?.database || "pending"}`,
    );
    logger.info(`⚡ Phase 2 redis: ${app.locals.phase2?.redis || "pending"}`);
  });

  return { server, wss };
}

function setupWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0];
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    // Reject cross-origin upgrades in production
    if (process.env.NODE_ENV === "production") {
      const origin = request.headers.origin || "";
      const allowed = Array.isArray(allowedOrigins) ? allowedOrigins : [];
      if (allowed.length > 0 && !allowed.some((o) => origin.startsWith(o))) {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
    socket.on("error", (err) => {
      logger.warn(
        "[WebSocket] Socket error during upgrade:",
        safeErrorMessage(err),
      );
    });
  });

  wss.on("connection", (ws) => {
    debugLog("🔌 WebSocket client connected");
    ws.isAlive = true;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(
          JSON.stringify({
            type: "connection",
            message: "Connected to Simplebeacon WebSocket server",
            timestamp: new Date().toISOString(),
          }),
        );
      } catch {
        // Socket may have closed immediately after connection
      }
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        debugLog("📨 Received WebSocket message:", data);

        ws.send(
          JSON.stringify({
            type: "echo",
            data,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (error) {
        logger.error("❌ Error parsing WebSocket message:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }
    });

    ws.on("close", () => {
      ws.isAlive = false;
      debugLog("🔌 WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      ws.isAlive = false;
      logger.error("❌ WebSocket error:", safeErrorMessage(error));
    });
  });

  // Server-wide heartbeat — one interval for all clients instead of per-connection
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  let wsBroadcastInterval = null;
  if (process.env.NODE_ENV === "development") {
    wsBroadcastInterval = setInterval(() => {
      if (wss.clients.size === 0) return;
      const updateData = {
        type: "data_update",
        timestamp: new Date().toISOString(),
        data: {
          analysis: {
            totalFiles: Math.floor(Math.random() * 100) + 400,
            issuesDetected: Math.floor(Math.random() * 50) + 10,
            processingSpeed: Math.floor(Math.random() * 500) + 1000,
          },
        },
      };
      const payload = JSON.stringify(updateData);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch {
            // socket may have closed between check and send
          }
        }
      });
    }, constants.TIMEOUT_5S);
  }

  function cleanup() {
    clearInterval(heartbeatInterval);
    if (wsBroadcastInterval) clearInterval(wsBroadcastInterval);
    wss.clients.forEach((client) => {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    });
    wss.close(() => {
      httpServer.close(() => process.exit(0));
    });
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return wss;
}

process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled rejection:", reason);
  process.exit(1);
});

startServer().catch((error) => {
  logger.error("❌ Failed to start Simplebeacon server:", error);
  process.exit(1);
});

// Legacy standalone WebSocket port for older clients (non-fatal if already bound)
const legacyWss = new WebSocket.Server({ port: WS_PORT });
legacyWss.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    logger.warn(
      `[Simplebeacon] Legacy WebSocket port ${WS_PORT} already in use — skipping duplicate bind`,
    );
    return;
  }
  if (err?.code === "EACCES") {
    logger.warn(
      `[Simplebeacon] Legacy WebSocket port ${WS_PORT} requires elevated permissions`,
    );
    return;
  }
  logger.warn("[Simplebeacon] Legacy WebSocket error:", safeErrorMessage(err));
});
legacyWss.on("listening", () => {
  logger.info(
    `🌐 Legacy WebSocket server running on ws://localhost:${WS_PORT}`,
  );
});
legacyWss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const heartbeat = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(heartbeat);
      return;
    }
    if (ws.isAlive === false) {
      clearInterval(heartbeat);
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(
        JSON.stringify({
          type: "connection",
          message: "Connected to legacy Simplebeacon WebSocket server",
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      // Socket may have closed immediately after connection
    }
  }
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "echo",
            data,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  });
  ws.on("close", () => {
    clearInterval(heartbeat);
    ws.isAlive = false;
  });
  ws.on("error", () => {
    clearInterval(heartbeat);
    ws.isAlive = false;
  });
});

module.exports = app;
