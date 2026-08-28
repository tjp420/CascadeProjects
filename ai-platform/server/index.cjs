// simplebeacon-ignore: debugArtifacts
"use strict";

/**
 * @module simplebeacon-server
 * Main AI Platform server entry point.
 *
 * Bootstraps an Express application with security middleware, audit logging,
 * rate limiting, authentication, and a wide variety of API routes.
 *
 * @example <caption>Basic usage</caption>
 * const app = require('./server/index.cjs');
 * // app is already listening if this module is required directly
 *
 * @example <caption>Health check</caption>
 * curl http://localhost:3000/health
 *
 * @file server/index.cjs
 */

// simplebeacon:production-leak-intent - server routes use template literals for HTML injection and API responses, not mock data leaks
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const constants = require("./config/constants.cjs");

// Prefer v1-internal env when present (mirrors simplebeacon-server.cjs)
const v1InternalEnvPath = path.join(__dirname, "..", ".env.v1-internal");
const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(v1InternalEnvPath)
    ? v1InternalEnvPath
    : path.join(__dirname, "..", ".env"));
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

// Validate critical Stripe/billing env vars before loading app modules
const { validateEnvironment } = require("./config/validate-env.cjs");
validateEnvironment();

// Initialize Sentry (no-op if SENTRY_DSN not set)
const { initSentry, captureException: sentryCapture } = require("./lib/sentry.cjs");
initSentry();

process.on("unhandledRejection", (reason) => {
  console.error("[UnhandledRejection]", reason);
  sentryCapture(reason);
});
process.on("uncaughtException", (err) => {
  console.error("[UncaughtException]", err);
  sentryCapture(err);
  process.exit(1);
});

// Diagnostic: log presence of REPORT_SIGNING_KEY (do not log the key value)
try {
  const logger = require("./lib/app-logger.cjs");
  logger.info("[EnvDiagnostic] REPORT_SIGNING_KEY configured:", {
    present: !!process.env.REPORT_SIGNING_KEY,
  });
} catch (e) {
  /* ignore logging errors */
}

const logger = require("./lib/app-logger.cjs");
const { resolveCorsOptions } = require("./lib/cors-config.cjs");
const {
  appendContactSubmission,
} = require("./lib/contact-submissions-store.cjs");
const { sendEmail } = require("./lib/email-service.cjs");

// Import enhanced security middleware
const {
  createRateLimiter,
  securityHeaders,
  requestLogger,
  ipProtection,
  securityErrorHandler,
} = require("./middleware/security.cjs");
const {
  authenticate,
  optionalAuthenticate,
  handleLogin,
  handleTokenRefresh,
} = require("./middleware/auth.cjs");
const {
  initializeAudit,
  auditAIOperation,
  auditSecurity,
  auditDataAccess,
  logSystemEvent,
  logSecurityEvent,
} = require("./middleware/audit.cjs");

// Import upload routes and security
const uploadRoutes = require("./routes/upload.cjs");
const {
  uploadSecurity,
  contentValidation,
} = require("./middleware/upload-security.cjs");
const {
  setupFlexibleAnalyzeAPI,
} = require("./routes/flexible-analyze-api.cjs");
const { setupAiMathAuditRoute } = require("./routes/ai-math-audit-route.cjs");
const tokenAuthRoutes = require("./routes/token-auth.cjs");
const { setupMockDataAPI } = require("./routes/mock-data-api.cjs");
const { setupChatbotAPI } = require("./routes/chatbot-api.cjs");
const { setupWebAuthnAPI } = require("./routes/webauthn-api.cjs");
const { setupAdminAPI } = require("./routes/admin-api.cjs");
const setupLocalModelsAPI = require("./routes/local-models-api.cjs");
const { setupSimplebeaconAPI } = require("../src/api/simplebeacon-api.cjs");
const setupDashboardStubAPIs = require("../src/api/dashboard-stub-api.cjs");
const { setupTrustAPI } = require("../src/api/trust-api.cjs");
const setupExternalWeatherAPI = require("./routes/external-weather-api.cjs");
const setupOracleSearch = require("./routes/oracle-search.cjs");
const {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
} = require("../src/api/simplebeacon-billing-api.cjs");
const {
  setupEnterpriseOnboardingRoutes,
} = require("../src/api/enterprise-onboarding.cjs");
const licenseSeatRoutes = require("../src/api/license-seat-routes.cjs");
const pathHealthRouter = require("./api/metrics/path-health.cjs");
const { runNpmAuditAsync } = require("./lib/npm-audit-runner.cjs");
const {
  registerEuAiActSprintRoute,
} = require("./lib/eu-ai-act-sprint-route.cjs");
const {
  registerComplianceSchemaRoute,
} = require("./routes/compliance-schema-api.cjs");
const { setupPrIntegrationAPI } = require("./routes/pr-integration-api.cjs");
const fixOrchestratorRouter = require("./routes/fix-orchestrator-api.cjs");
const ssoRoutes = require("./routes/sso-routes.cjs");
const ssoConfigRoutes = require("./routes/sso-config-routes.cjs");
const ssoAuthHandler = require("./routes/sso-auth-handler.cjs");
const tokenBudgetRoutes = require("./routes/token-budget-allocation-routes.cjs");
const workspaceConfigRoutes = require("./routes/workspace-config-routes.cjs");
const fineTuningTelemetryRoutes = require("./routes/fine-tuning-telemetry-routes.cjs");
const tokenThrottleRoutes = require("./routes/token-throttle-routes.cjs");
const hsmVaultRoutes = require("./routes/hsm-vault-routes.cjs");
const track112UploadRoutes = require("./routes/track112-upload-routes.cjs");
const replicationRoutes = require("./routes/replication-routes.cjs");
const healthDiagnosticsRouter = require("./routes/health-diagnostics.cjs");
const { registerOutreachRoutes } = require("./lib/outreach-route.cjs");
const {
  setupWorkspaceRoutes,
  requirePermission,
  setWorkspaceRlsContext,
} = require("./lib/rbac.cjs");
const auditLogRouter = require("./routes/audit.cjs");
const authRoutes = require("./routes/auth-routes.cjs");
const DatabaseAdapter = require("./lib/database-adapter.cjs");
const {
  whitelabelMiddleware,
  buildBrandInjection,
} = require("./lib/whitelabel-middleware.cjs");
const whitelabelRoutes = require("./routes/whitelabel-routes.cjs");

const app = express();
app.set("trust proxy", 1); // Trust first proxy hop for rate-limit IP accuracy
let rawPort = process.env.PORT || constants.DEFAULT_PORT;
let PORT =
  Number.isFinite(Number(rawPort)) && Number(rawPort) > 0
    ? Number(rawPort)
    : constants.DEFAULT_PORT;

// Initialize audit system (skip in test to avoid open handles)
if (process.env.NODE_ENV !== "test") {
  initializeAudit().catch((err) => logger.error("Audit init failed:", err));
}

// HTTPS redirect for production ΓÇö respect health checks and local development
app.use((req, res, next) => {
  const isLocalhost = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(
    req.hostname,
  );
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const publicUrl =
    process.env.PUBLIC_APP_URL || process.env.SIMPLEBEACON_APP_URL;
  if (
    !isLocalhost &&
    !isSecure &&
    process.env.NODE_ENV === "production" &&
    publicUrl
  ) {
    try {
      const target = new URL(req.url, publicUrl).href;
      if (!target.startsWith(publicUrl)) {
        return res.status(400).send("Invalid redirect target");
      }
      return res.redirect(301, target);
    } catch {
      return res.status(400).send("Invalid request URL");
    }
  }
  next();
});

// Enhanced security middleware stack
app.use(requestLogger);
app.use(securityHeaders);
app.use(ipProtection);

// Rate limiting with trust-level awareness
// Base rate limit for general API routes (raised for dashboard dev mode)
app.use(
  "/api/",
  createRateLimiter({
    max: constants.MAX_RATE_LIMIT, // Base rate limit ΓÇö dashboard fires many concurrent requests on load
  }),
);

// Higher rate limit for analyze endpoints (complete scan makes sequential requests)
app.use(
  "/api/analyze/",
  createRateLimiter({
    windowMs: constants.RATE_LIMIT_WINDOW_MS,
    max: constants.MAX_ANALYZE_RATE_LIMIT, // Allow up to 1000 requests per 15 minutes for scan operations
  }),
);

// Handle Private Network Access (PNA) preflight from browsers.
// When a secure page attempts to fetch a loopback address, browsers send
// `Access-Control-Request-Private-Network: true` in the preflight. The server
// must respond with `Access-Control-Allow-Private-Network: true` to permit access.
app.use((req, res, next) => {
  try {
    const acrpn = req.headers["access-control-request-private-network"];
    if (typeof acrpn !== "undefined") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      // helpful cache for preflight
      res.setHeader("Access-Control-Max-Age", "86400");
    }
  } catch (e) {
    console.error("index.cjs error:", e);
    // ignore header-setting errors
  }
  next();
});

// Explicitly handle OPTIONS preflight early so browsers receive the
// required PNA + CORS headers even when other middleware short-circuits.
app.options(/.*/, (req, res) => {
  try {
    const acrpn = req.headers["access-control-request-private-network"];
    if (typeof acrpn !== "undefined") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
  } catch (e) {
    console.error("index.cjs error:", e);
    // ignore
  }

  // Reflect origin when present (the `cors` middleware will also validate this later)
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Accept,Authorization,X-Token-Password,X-SimpleBeacon-Bridge-Token,x-simplebeacon-bridge-token,Access-Control-Request-Private-Network",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  return res.sendStatus(204);
});

app.use(
  cors(
    resolveCorsOptions({
      devFallbackOrigin:
        process.env.CORS_ORIGIN || process.env.SIMPLEBEACON_DEV_CORS_ORIGIN,
    }),
  ),
);

// Ensure local analyze backend (dev ports) are permitted by CSP connect-src.
// This middleware augments any existing Content-Security-Policy header by
// appending the local endpoints we rely on during development and hosted-preview.
app.use((req, res, next) => {
  try {
    const existing = res.getHeader("Content-Security-Policy");
    const connectExtras = "http://127.0.0.1:8081 http://localhost:8081";
    let csp = "";

    if (typeof existing === "string") csp = existing;
    else if (Array.isArray(existing)) csp = existing.join(" ");

    // If there's already a connect-src directive, append our extras if missing
    if (csp && /connect-src[^;]*/i.test(csp)) {
      const m = csp.match(/(connect-src[^;]*)/i);
      if (m) {
        const connectSrc = m[1];
        if (!/127\.0\.0\.1:8081/.test(connectSrc)) {
          const replaced = csp.replace(
            /(connect-src[^;]*)/i,
            `${connectSrc} ${connectExtras}`,
          );
          res.setHeader("Content-Security-Policy", replaced);
        }
      }
    } else {
      // No existing CSP or no connect-src: add a connect-src allowing local dev
      // with wildcard ports so the dashboard's port-scanning probes work.
      const base = csp && csp.length ? csp + "; " : "";
      const newCsp = `${base}connect-src 'self' ws: wss: https://cloudflareinsights.com https://*.onrender.com http://127.0.0.1:* http://localhost:* https://localhost:*;`;
      res.setHeader("Content-Security-Policy", newCsp);
    }
  } catch (e) {
    console.error("index.cjs error:", e);
    // Don't break request flow for header setting errors
  }
  return next();
});

// Billing webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);

// Whitelabel sub-domain routing ΓÇö resolve partner brand from hostname
// Mounted before dashboard routes so req.brand is available for HTML injection
app.use(whitelabelMiddleware);

app.use(
  express.json({
    limit: constants.safeJsonLimit(process.env.EXPRESS_JSON_LIMIT),
  }),
);
app.use(express.urlencoded({ extended: true }));

const comingSoonRoot = path.join(__dirname, "../../coming-soon");
const landingRoot = path.join(comingSoonRoot, "public");
const webRoot = path.join(__dirname, "../web");
const internalDashboard =
  process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === "true";
const landingEnabled = process.env.SIMPLEBEACON_LANDING === "true";
const landingRootExists = fs.existsSync(landingRoot);
const landingAtRoot = landingEnabled && !internalDashboard;

/**
 * Whether storefront assets should be served.
 * @returns {boolean}
 */
function storefrontAssetsEnabled() {
  return landingEnabled || internalDashboard || landingRootExists;
}

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
 * Send landing index.
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function sendLandingIndex(res) {
  const landingIndex = path.join(landingRoot, "index.html");
  if (!fs.existsSync(landingIndex)) return false;
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  res.sendFile(landingIndex);
  return true;
}

/**
 * Send demo report if allowed.
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function sendDemoReport(res) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT
  ) {
    return false;
  }
  return sendLandingFile(res, "demo-report.html", "text/html");
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

const {
  isVaultAuthenticated: checkVaultAuthenticated,
  isProtectedDashboardPath,
  setVaultSessionCookie,
} = require("./lib/dashboard-vault-auth.cjs");

/**
 * Is vault authenticated.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, {
    internalDashboard:
      internalDashboard || Boolean(process.env.DASHBOARD_VAULT_PASSWORD),
    vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD,
  });
}

/**
 * Send coming soon index.
 * @param {Object} res
 * @returns {void}
 */
function sendComingSoonIndex(res) {
  res.sendFile(path.join(landingRoot, "index.html"));
}

const dashboardPath = path.join(webRoot, "simplebeacon-dashboard/index.html");
let _cachedDashboardHtml = null;
let _cachedDashboardMtimeMs = 0;

/**
 * Load dashboard html with mtime-based caching.
 * @returns {Promise<string|null>}
 */
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

/**
 * Send simplebeacon dashboard.
 * @param {Object} res
 * @returns {Promise<void>}
 */
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

  // Automatically set vault cookie for smooth dev experience
  if (process.env.DASHBOARD_VAULT_PASSWORD) {
    setVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
  }

  return res.send(html);
}

// Public storefront ΓÇö same paywall as simplebeacon.ai (coming-soon/public/)
// When internalDashboard is enabled, serve the dashboard instead of the landing page
app.get("/", createRateLimiter({ max: 300 }), (req, res) => {
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  if (sendLandingIndex(res)) return;
  sendComingSoonIndex(res);
});
app.get(["/landing", "/landing/"], (req, res) => {
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  sendComingSoonIndex(res);
});
app.get("/sample-report", (req, res) => {
  res.sendFile(path.join(landingRoot, "sample-report.html"));
});

const VAULT_AUTH_EXACT_PATHS = new Set([
  "/api/health",
  "/api/theme",
  "/api/platform/status",
  "/api/security/npm-audit",
  "/api/reports/upload",
  "/api/analyze",
  "/api/free-token",
  "/api/tokens/sandbox",
  "/api/create-checkout-session",
  "/api/checkout/webhook",
  "/api/license/validate",
]);

const VAULT_AUTH_PREFIX_PATHS = [
  "/api/simplebeacon/billing/webhook",
  "/api/simplebeacon/billing",
  "/api/simplebeacon/scan",
  "/api/simplebeacon/ollama/",
  "/api/simplebeacon/report",
  "/api/simplebeacon/baseline",
  "/api/simplebeacon/config",
  "/api/simplebeacon/history",
  "/api/simplebeacon/user",
  "/api/user",
  "/api/simplebeacon/entitlements",
  "/api/chatbot/",
  "/api/auth/",
  "/api/dev-tools/",
  "/api/coverage-reports/",
  "/api/dashboard-home",
  "/api/help",
  "/api/quality/",
  "/api/security/",
  "/api/optimization/",
  "/api/analyze/",
  "/api/find-folder",
  "/api/operator/",
  "/api/reports/status/",
  "/api/track112/",
];

app.use((req, res, next) => {
  if (req.path.startsWith("/api/whitelabel")) {
    logger.info(
      `[DEBUG-VAULT] path=${req.path} NODE_ENV=${process.env.NODE_ENV} VAULT_PWD_SET=${!!process.env.DASHBOARD_VAULT_PASSWORD}`,
    );
  }
  if (process.env.NODE_ENV === "development") return next();
  if (!process.env.DASHBOARD_VAULT_PASSWORD) return next();
  if (!req.path.startsWith("/api/")) return next();
  if (VAULT_AUTH_EXACT_PATHS.has(req.path)) return next();
  for (const prefix of VAULT_AUTH_PREFIX_PATHS) {
    if (req.path.startsWith(prefix)) return next();
  }
  if (isVaultAuthenticated(req)) return next();
  return res.status(403).json({
    error: "vault_required",
    message: "Internal dashboard requires vault authentication.",
  });
});

// Development-only: simple stub endpoints to facilitate local UI testing
if (process.env.SIMPLEBEACON_DEV_STUBS === "true") {
  logger.info(
    "[DevStubs] SIMPLEBEACON_DEV_STUBS=true ΓÇö registering dev-only auth stubs",
  );
  app.post("/api/auth/token-status", express.json(), (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "Token required" });
    // Accept any well-formed JWT-like string in dev stub mode
    const parts = String(token).split(".");
    if (parts.length !== 3)
      return res.status(400).json({ registered: false, valid: false });
    try {
      const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const pad = payloadB64.length % 4;
      const padded = payloadB64 + (pad ? "=".repeat(4 - pad) : "");
      const payload = JSON.parse(
        Buffer.from(padded, "base64").toString("utf8"),
      );
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp || 0;
      return res.json({
        registered: true,
        valid: exp > now,
        email: payload.email || null,
        tier: payload.tier || "dev",
        expiry: exp || null,
      });
    } catch (err) {
      return res.status(400).json({ registered: false, valid: false });
    }
  });

  // Also allow token check via Authorization header
  app.post(
    "/api/auth/session",
    (req, res, next) => {
      const auth = req.get("authorization") || "";
      const m = auth.match(/^Bearer\s+(.*)$/i);
      if (!m) return res.status(401).json({ error: "Authorization required" });
      req.body = req.body || {};
      req.body.token = m[1];
      return next();
    },
    express.json(),
    (req, res) => {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: "Token required" });
      const parts = String(token).split(".");
      if (parts.length !== 3)
        return res.status(400).json({ registered: false, valid: false });
      try {
        const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = payloadB64.length % 4;
        const padded = payloadB64 + (pad ? "=".repeat(4 - pad) : "");
        const payload = JSON.parse(
          Buffer.from(padded, "base64").toString("utf8"),
        );
        const now = Math.floor(Date.now() / 1000);
        const exp = payload.exp || 0;
        return res.json({
          success: true,
          registered: true,
          valid: exp > now,
          email: payload.email || null,
          tier: payload.tier || "dev",
          expiry: exp || null,
        });
      } catch (err) {
        return res.status(400).json({ registered: false, valid: false });
      }
    },
  );
}

app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();
  if (!process.env.DASHBOARD_VAULT_PASSWORD) return next();
  if (!isProtectedDashboardPath(req.path)) return next();
  if (isVaultAuthenticated(req)) return next();
  return res.redirect(302, "/");
});

// Private dashboard ΓÇö unlocks vault session, then opens the marketing sample report
app.get("/private-dashboard-vault", async (req, res) => {
  try {
    const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
    if (!vaultPassword || req.query.password !== vaultPassword) {
      return res
        .status(403)
        .send("Unauthorized Access: Private Vault is Locked.");
    }
    setVaultSessionCookie(res, vaultPassword);
    const samplePath = path.join(landingRoot, "sample-report.html");
    try {
      await fs.promises.access(samplePath);
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, no-transform",
      );
      return res.sendFile(samplePath);
    } catch {
      return res
        .status(404)
        .send(
          "sample-report.html not found ΓÇö run: cd ai-platform && npm run build:sample-report",
        );
    }
  } catch (err) {
    logger.error("[private-dashboard-vault] error:", err.message);
    return res.status(500).send("Internal server error");
  }
});

// Public dashboard route (standalone coming-soon/public/dashboard copy)
// Injects runtime env so it can reach the ai-platform server proxy regardless of the serving port.
app.get(
  ["/public/dashboard", "/public/dashboard/", "/public/dashboard/index.html"],
  async (req, res) => {
    const indexPath = path.join(landingRoot, "dashboard", "index.html");
    let html;
    try {
      html = await fs.promises.readFile(indexPath, "utf8");
    } catch {
      return res.status(404).send("index.html not found");
    }

    const runtimeConfig = JSON.stringify({
      DASHBOARD_BASE_URL:
        process.env.DASHBOARD_BASE_URL ||
        `${req.protocol}://${req.get("host") || "localhost:" + PORT}`,
      OLLAMA_DEFAULT_URL:
        process.env.OLLAMA_DEFAULT_URL ||
        `http://127.0.0.1:${constants.OLLAMA_PORT}`,
    });
    const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
    html = html.replace("<head>", `<head>${injectScript}`);

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, no-transform",
    );
    res.send(html);
  },
);

// Storefront static assets ΓÇö serve marketing site from landing root (coming-soon/public/)
app.use("/", express.static(landingRoot, { index: false }));

// Prevent browser caching of dashboard HTML/JS so updated client code always loads
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (ext === ".html" || ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, no-transform",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Dashboard-specific asset routes (serve from web/simplebeacon-dashboard/)
const dashDir = path.join(webRoot, "simplebeacon-dashboard");
// JS module directories ΓÇö disable etag to prevent Firefox from reusing stale cached versions
const noStoreStatic = (dir) =>
  express.static(dir, {
    etag: false,
    redirect: false,
    setHeaders: (res, path) => {
      if (path.endsWith(".js") || path.endsWith(".mjs")) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, no-transform",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Vary", "*");
      }
    },
  });

app.use("/js-es2018", noStoreStatic(path.join(dashDir, "js-es2018")));
app.use("/js", noStoreStatic(path.join(dashDir, "js")));
app.use("/utils-lib", noStoreStatic(path.join(dashDir, "utils-lib")));
app.use("/dashboard/js-es2018", noStoreStatic(path.join(dashDir, "js-es2018")));
app.use("/dashboard/js", noStoreStatic(path.join(dashDir, "js")));
app.use("/dashboard/utils-lib", noStoreStatic(path.join(dashDir, "utils-lib")));
for (const p of ["/css", "/images", "/fonts"]) {
  app.use(p, express.static(path.join(dashDir, p.substring(1))));
}
app.use("/assets", noStoreStatic(path.join(dashDir, "assets")));
// Also serve under /dashboard/ prefix so relative paths work for /dashboard/* routes
for (const p of [
  "/dashboard/css",
  "/dashboard/images",
  "/dashboard/fonts",
  "/dashboard/utils-lib",
]) {
  const sub = p.replace("/dashboard/", "");
  app.use(p, express.static(path.join(dashDir, sub)));
}
app.use("/dashboard/assets", noStoreStatic(path.join(dashDir, "assets")));
app.get("/site-config.js", (req, res, next) => {
  const filePath = path.join(dashDir, "site-config.js");
  if (fs.existsSync(filePath)) {
    res.set("Content-Type", "application/javascript; charset=utf-8");
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, no-transform",
    );
    return res.sendFile(filePath);
  }
  next();
});
app.get("/js-es2018/referral-capture.js", (req, res, next) => {
  const candidates = [
    path.join(dashDir, "js-es2018", "referral-capture.js"),
    path.join(landingRoot, "dashboard", "js-es2018", "referral-capture.js"),
    path.join(landingRoot, "js-es2018", "referral-capture.js"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      res.set("Content-Type", "application/javascript; charset=utf-8");
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, no-transform",
      );
      return res.sendFile(filePath);
    }
  }
  next();
});

// Dashboard static asset fallback ΓÇö also check coming-soon/public/dashboard for vendor files
const dashboardFallbackDir = fs.existsSync(path.join(landingRoot, "dashboard"))
  ? path.join(landingRoot, "dashboard")
  : null;
if (dashboardFallbackDir) {
  for (const p of [
    "/dashboard/css",
    "/dashboard/js",
    "/dashboard/js-es2018",
    "/dashboard/images",
    "/dashboard/fonts",
    "/dashboard/assets",
    "/dashboard/utils-lib",
  ]) {
    const sub = p.replace("/dashboard/", "");
    app.use(
      p,
      express.static(path.join(dashboardFallbackDir, sub), {
        fallthrough: false,
      }),
    );
  }
  app.get("/dashboard/site-config.js", (req, res, next) => {
    const filePath = path.join(dashboardFallbackDir, "site-config.js");
    if (fs.existsSync(filePath)) {
      res.set("Content-Type", "application/javascript; charset=utf-8");
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, no-transform",
      );
      return res.sendFile(filePath);
    }
    next();
  });
}

// Fallback: serve landing assets from root for pages served under /coming-soon/
for (const p of ["/css", "/js", "/images", "/fonts", "/assets"]) {
  app.use(p, express.static(path.join(landingRoot, p.substring(1))));
}

// Public data files (e.g. trust-verification.json)
const publicDir = path.join(__dirname, "..", "public");
app.use("/public", express.static(publicDir, { index: false }));

// === Legacy SPA redirects (consolidated from simplebeacon-server.cjs) ===
async function redirectPublicToLanding(req, res) {
  if (landingAtRoot) {
    return res.redirect(302, "/");
  }
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  return sendSimplebeaconDashboard(res);
}

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

// === Storefront landing page routes (clean URLs) ===
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
  for (const legalPage of ["terms", "privacy", "refund", "contact"]) {
    app.get([`/${legalPage}`, `/${legalPage}/`], (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      if (sendLandingFile(res, `${legalPage}.html`, "text/html")) return;
      next();
    });
  }
  // .html ΓåÆ clean URL redirects
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
}

// Direct access to landing.html (bypasses landingEnabled flag for development)
app.get("/landing.html", (req, res) => {
  if (sendLandingFile(res, "landing.html", "text/html")) return;
  return res.status(404).send("Landing page not found");
});

// Demo report routes
app.get(
  ["/demo-report", "/demo-report/", "/demo-report.html"],
  (req, res, next) => {
    if (sendDemoReport(res)) return;
    next();
  },
);

// Inject runtime configuration into dashboard HTML
// This route MUST come before catch-all static middleware
// Uses mtime-cached HTML with <base href> injection from loadDashboardHtml()
async function sendDashboardWithRuntimeConfig(req, res) {
  let html = await loadDashboardHtml();
  if (html === null) {
    return res.status(404).send("index.html not found");
  }
  const runtimeConfig = JSON.stringify({
    DASHBOARD_BASE_URL:
      process.env.DASHBOARD_BASE_URL ||
      `${req.protocol}://${req.get("host") || "localhost:" + PORT}`,
    OLLAMA_DEFAULT_URL:
      process.env.OLLAMA_DEFAULT_URL ||
      `http://127.0.0.1:${constants.OLLAMA_PORT}`, // simplebeacon-ignore hardcoded-url ΓÇö default Ollama localhost URL for client-side settings
  });
  const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
  // Inject whitelabel brand config + CSS (resolved by whitelabel-middleware)
  const brandInjection = buildBrandInjection(
    req.brand,
    req.whitelabelPartner ? req.whitelabelPartner.partnerId : null,
  );
  // Inject after <head> (or after <base href> if already present from loadDashboardHtml)
  html = html.replace(
    /<head>(\s*<base href="[^"]*">)?/,
    `<head>$1${injectScript}\n${brandInjection}`,
  );
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, no-transform");
  return res.send(html);
}

app.get(
  [
    "/simplebeacon-dashboard",
    "/simplebeacon-dashboard/",
    "/simplebeacon-dashboard/index.html",
  ],
  async (req, res) => {
    return sendDashboardWithRuntimeConfig(req, res);
  },
);

// SPA fallback for dashboard sub-routes (e.g. /simplebeacon-dashboard/analyze)
app.get(/^\/simplebeacon-dashboard\/.*$/, async (req, res) => {
  return sendDashboardWithRuntimeConfig(req, res);
});

// Compatibility: also serve dashboard at /dashboard (legacy simplebeacon-server.cjs path)
app.get(["/dashboard", "/dashboard/"], async (req, res) => {
  return sendDashboardWithRuntimeConfig(req, res);
});

// Vite chunk fallback: redirect /dashboard/<chunk>.js to /dashboard/assets/<chunk>.js
// when the file exists in the assets directory. Handles stale cached main.js
// that resolves relative imports without the assets/ prefix.
app.get("/dashboard/:filename.js", (req, res, next) => {
  const filename = req.params.filename + ".js";
  const assetsPath = path.join(dashDir, "assets", filename);
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

// SPA fallback for /dashboard/* sub-routes
app.get(/^\/dashboard\/.*$/, async (req, res) => {
  return sendDashboardWithRuntimeConfig(req, res);
});

// Dashboard / web assets (vault-gated when DASHBOARD_VAULT_PASSWORD is set)
// Must come AFTER specific routes so it only serves unmatched paths
const _webRootStatic = express.static(webRoot, {
  index: false,
  redirect: false,
});
app.use((req, res, next) => {
  const skipVault =
    !process.env.DASHBOARD_VAULT_PASSWORD ||
    process.env.NODE_ENV === "development";
  if (skipVault) {
    return _webRootStatic(req, res, next);
  }
  if (isProtectedDashboardPath(req.path) && !isVaultAuthenticated(req)) {
    return res.redirect(302, "/");
  }
  return _webRootStatic(req, res, next);
});
app.use("/assets", express.static(path.join(webRoot, "assets")));

// Debug: log all /api/whitelabel requests before route mount
app.use("/api/whitelabel", (req, res, next) => {
  logger.info(
    `[DEBUG-WL] ${req.method} ${req.originalUrl} path=${req.path} reached whitelabel router`,
  );
  next();
});

// Whitelabel partner branding API - public resolve endpoint for dashboard BrandContext
// Mounted after whitelabelMiddleware so req.brand is populated; resolve returns default brand for unknown domains
app.use("/api/whitelabel", whitelabelRoutes);

// Health, status, and VS Code heartbeat routes
app.use("/api", require("./routes/health-routes.cjs"));

// Stripe webhook ΓÇö must use raw body, mounted before express.json() middleware
app.use("/api/stripe", require("./routes/stripe-webhook-routes.cjs"));

// Webhook events dashboard API — list and stats for recent Stripe webhook events
app.use("/api/webhook-events", require("./routes/webhook-events-routes.cjs"));

// Daily ops report API — manual trigger and scheduler status
app.use("/api/ops-report", require("./routes/ops-report-routes.cjs"));

// Billing API — proration preview and tier pricing
app.use("/api/billing", require("./routes/billing-routes.cjs"));

// Ollama health API — connection status, models, latency for dashboard widget
app.use("/api/ollama", require("./routes/ollama-health-routes.cjs"));

// Start the daily ops report scheduler (if enabled via OPS_REPORT_ENABLED=true)
const {
  startScheduler: startOpsReportScheduler,
} = require("./lib/daily-ops-report.cjs");
startOpsReportScheduler();

// /api/status is already handled by health-routes.cjs (mounted at /api above).

// Meta routes ΓÇö project structure, releases, backlog
app.use("/api", require("./routes/meta-routes.cjs"));

// Mock data API routes
setupMockDataAPI(app, { baseDir: path.join(__dirname, "..") });

// Authentication routes (login, register, refresh, token status, sandbox)
app.use("/api", require("./routes/auth-inline-routes.cjs"));

// Token authentication routes (TAS-1.0 flat capability mesh)
app.use("/auth", tokenAuthRoutes);

// Protected API routes with audit logging
app.use("/api/mock-analysis", auditAIOperation);
app.use("/api/project-structure", auditDataAccess);
app.use("/api/security", auditSecurity);

app.post("/api/security/npm-audit", async (req, res) => {
  try {
    const platformRoot = path.join(__dirname, "..");
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
      error:
        error && typeof error.message === "string"
          ? error.message
          : constants.safeString(error),
    });
  }
});

// Flexible analyze API ΓÇö codebase scan and inventory (shared path-safety with simplebeacon-server)
// Proxy legacy bare POST /api/analyze to the flexible analysis endpoint.
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/analyze") {
    req.url = "/api/analyze/flexible";
  }
  next();
});

const platformRoot = path.join(__dirname, "..");
setupFlexibleAnalyzeAPI(app, {
  baseDir: platformRoot,
  monorepoRoot: path.join(platformRoot, ".."),
});

// AI Math Audit route ΓÇö deterministic model-log analysis
setupAiMathAuditRoute(app, platformRoot);

// Pricing config endpoint ΓÇö serves Stripe URLs from environment variables
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

// Theme endpoint for the dashboard to poll the server-side default theme.
app.get("/api/theme", (_req, res) => {
  res.json({ theme: process.env.DEFAULT_THEME || "dark" });
});

// Chatbot API ΓÇö AI-powered code assistance
setupChatbotAPI(app);

// Browser notification bridge ΓÇö no-op sink for legacy dashboard / extension heartbeat events
app.post("/api/notify", (req, res) => {
  res.json({ success: true, received: true });
});

// Note: unauthenticated fallback for browser-error POST removed to require
// authentication. Client-side reporting should POST to the authenticated
// endpoint mounted by `setupSimplebeaconAPI` at
// `/api/simplebeacon/report/browser-error` which enforces user authentication
// and emits audit logs. This strengthens ingestion security and ensures
// audit attribution.

// Path verification ΓÇö used by the Analyze page to validate candidate scan paths
app.post("/api/verify-path", (req, res) => {
  const candidate = String(req.body?.path || "").trim();
  if (!candidate) {
    return res.json({ success: false, error: "No path provided" });
  }
  try {
    const fs = require("fs");
    const resolved = require("path").resolve(candidate);
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      return res.json({
        success: true,
        path: resolved,
        isDirectory: stat.isDirectory(),
      });
    }
    return res.json({
      success: false,
      error: `Path does not exist: ${resolved}`,
    });
  } catch (e) {
    return res.json({
      success: false,
      error: e.message || "Path verification failed",
    });
  }
});

function sanitizeServerInput(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/{{/g, "&#x7B;&#x7B;")
    .replace(/}}/g, "&#x7D;&#x7D;");
}

function sanitizeRequestBody(body) {
  if (!body || typeof body !== "object") return body;
  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] =
      typeof value === "string" ? sanitizeServerInput(value) : value;
  }
  return sanitized;
}

app.post("/api/contact", async (req, res) => {
  try {
    req.body = sanitizeRequestBody(req.body);
    const { name, message, topic, company, title, source } = req.body || {};
    const email = String(
      req.body?.email || req.body?.contactEmail || "",
    ).trim();
    if (!email || !email.includes("@")) {
      return res
        .status(400)
        .json({ success: false, error: "A valid email is required" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    // Store the submission locally
    const result = appendContactSubmission({ name, email, message });

    // Deliver to Zoho (or whatever email provider is configured) via the email service
    const notifyEmail =
      process.env.CONTACT_NOTIFY_EMAIL || process.env.SMTP_USER || "";
    if (notifyEmail) {
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
    }

    res.json({ success: true, received: true, id: result.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// WebAuthn passkey registration / authentication (dashboard Profile + Sign-in)
setupWebAuthnAPI(app);

// Admin dashboard stats, users, sessions (requires admin role)
setupAdminAPI(app, { platformRoot: path.join(__dirname, "..") });

// Per-user AI provider keys (OpenAI, Anthropic, Ollama) ΓÇö encrypted at rest
const {
  getUserAiKeysPublic,
  saveUserAiKeys,
  clearUserAiKeys,
} = require("./lib/user-ai-keys-store.cjs");
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

// Stub endpoints for dashboard client features not available in local dev
// Note: /api/chatbot/providers is handled by setupChatbotAPI using actual provider credentials.
app.get("/api/prompts/get", (_req, res) =>
  res.json({ prompts: [], userId: _req.query.userId || "anonymous" }),
);
app.get("/data/re-attestation-metadata.json", (_req, res) =>
  res.json({ attestations: [], generatedAt: new Date().toISOString() }),
);

// Local models API ΓÇö Ollama and local model management
setupLocalModelsAPI(app, {
  baseDir: platformRoot,
});

// Workspace API ΓÇö multi-tenant with RLS transaction guardrails
// Only mount if database is configured; otherwise skip gracefully
const {
  isDatabaseEnabled,
  getDatabaseConfig,
} = require("./config/database.cjs");
if (isDatabaseEnabled()) {
  try {
    const dbAdapter = new DatabaseAdapter(getDatabaseConfig());
    app.use("/api/workspaces", authenticate, setupWorkspaceRoutes(dbAdapter));
    logger.info("[Workspaces] RLS workspace routes mounted at /api/workspaces");
  } catch (e) {
    logger.warn(
      "[Workspaces] Database not configured ΓÇö workspace routes skipped:",
      e.message,
    );
  }
} else {
  logger.info(
    "[Workspaces] Database disabled ΓÇö workspace routes not mounted",
  );
}

// FixOrchestrator 2.0 ΓÇö auto-remediation preview / apply
// Mounted with auth + RBAC + RLS transaction guardrails
const fixoDbAdapter = isDatabaseEnabled()
  ? new DatabaseAdapter(getDatabaseConfig())
  : null;
// Read-only strategies endpoint ΓÇö only requires authentication, not remediation:write
const fixStrategiesRouter = express.Router();
fixStrategiesRouter.get("/strategies", (_req, res) => {
  // simplebeacon-ignore: debugArtifacts ΓÇö strategy map keys are string identifiers, not debug statements
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
app.use(
  "/api/v2/fixes",
  authenticate,
  requirePermission("remediation:write"),
  (req, res, next) => {
    if (fixoDbAdapter) req.db = fixoDbAdapter;
    next();
  },
  setWorkspaceRlsContext,
  fixOrchestratorRouter,
);
logger.info("[FixOrchestrator] RLS-scoped routes mounted at /api/v2/fixes");

// Backward-compatible archive download endpoint used by dashboard bundles.
// Serves files from ai-platform/.simplebeacon/archive by filename query param.
app.get("/api/v2/archive/download", (req, res) => {
  try {
    const name = req.query.name;
    if (!name)
      return res.status(400).json({ success: false, error: "Missing name" });
    const archiveDir = path.join(__dirname, "..", ".simplebeacon", "archive");
    const filePath = path.join(archiveDir, path.basename(String(name)));
    if (!filePath.startsWith(archiveDir))
      return res.status(403).json({ success: false, error: "Invalid path" });
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, error: "Not found" });
    return res.sendFile(filePath);
  } catch (err) {
    logger.error("[Archive] download failed: " + err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
// Simplebeacon dashboard API ΓÇö scan report, baseline, config, history
// Authenticate vault sessions for user routes so req.user is populated
app.use("/api/simplebeacon/user", authenticate);
try {
  setupSimplebeaconAPI(app);
} catch (e) {
  logger.warn("[Simplebeacon] simplebeacon-api setup skipped:", e.message);
}

// Audit log retrieval API ΓÇö paginated, strict memory limits (default LIMIT 50, max 200)
app.use("/api/v2/audit", auditLogRouter);

// Auth rotation & blocklist routes
app.use("/api/v2/auth", authRoutes);

// Enterprise SSO ΓÇö SAML + OIDC callbacks
app.use("/api/v2/auth/sso", ssoRoutes);
logger.info("[SSO] Enterprise SSO routes mounted at /api/v2/auth/sso");

// SSO auth handler ΓÇö OIDC/SAML login flows + domain resolution for login page
app.use("/api/sso", ssoAuthHandler);
logger.info("[SSO] Auth handler routes mounted at /api/sso");

// Enterprise SSO configuration ΓÇö CRUD endpoints for per-org provider configs
app.use("/api/enterprise/sso", ssoConfigRoutes);
logger.info("[SSO] SSO config routes mounted at /api/enterprise/sso");

// Enterprise analytics facade ΓÇö compact payload for admin dashboard
try {
  const enterpriseAnalytics = require("./routes/enterprise-analytics-routes.cjs");
  app.use("/api/enterprise/analytics", enterpriseAnalytics);
  logger.info("[Enterprise] Analytics mounted at /api/enterprise/analytics");
} catch (e) {
  logger.warn("[Enterprise] Analytics route not mounted:", e?.message || e);
}

// SimpleBeacon admin dashboard analytics ΓÇö scan metrics, trends, posture scores
try {
  const analyticsRouter = require("./routes/analytics-routes.cjs");
  app.use("/api/analytics", analyticsRouter);
  logger.info("[Analytics] Usage analytics mounted at /api/analytics");
} catch (e) {
  logger.warn(
    "[Analytics] Usage analytics route not mounted:",
    e?.message || e,
  );
}

// Scan counter — free-tier paywall enforcement
try {
  const scanCounterRouter = require("./routes/scan-counter-routes.cjs");
  app.use("/api/scans", scanCounterRouter);
  logger.info("[ScanCounter] Scan counter routes mounted at /api/scans");
} catch (e) {
  logger.warn("[ScanCounter] Scan counter route not mounted:", e?.message || e);
}

// Dashboard stub APIs ΓÇö dashboard-home, dev-tools, coverage-reports, security, quality, help
try {
  setupDashboardStubAPIs(app, webRoot, {
    authMiddleware: optionalAuthenticate,
  });
} catch (e) {
  logger.warn("[Simplebeacon] dashboard-stub-api setup skipped:", e.message);
}

// Optimization API
try {
  require("../src/api/optimization-api.cjs").setupOptimizationAPI(app, {
    platformRoot: path.join(__dirname, ".."),
    monorepoRoot: path.join(__dirname, "../.."),
  });
} catch (e) {
  logger.warn("[Simplebeacon] optimization-api setup skipped:", e.message);
}

// Trust verification API
// Public trust endpoints served without auth for badge/verify/verification
// Gate-protected endpoints require authenticate middleware
try {
  setupTrustAPI(app, {
    platformRoot: path.join(__dirname, ".."),
    monorepoRoot: path.join(__dirname, "../.."),
  });
} catch (e) {
  logger.warn("[Simplebeacon] trust-api setup skipped:", e.message);
}

// External integrations (dev-friendly) ΓÇö weather lookup
try {
  if (
    process.env.ENABLE_EXTERNAL_APIS === "true" ||
    process.env.NODE_ENV === "development"
  ) {
    setupExternalWeatherAPI(app);
    // Oracle search (SerpAPI) - optional external API integration
    try {
      setupOracleSearch(app);
    } catch (e) {
      logger.warn("[OracleSearch] setup skipped:", e.message);
    }
  } else {
    logger.info(
      "[ExternalWeather] Disabled - set ENABLE_EXTERNAL_APIS=true to enable",
    );
  }
} catch (e) {
  logger.warn("[ExternalWeather] setup skipped:", e.message);
}

// EU AI Act sprint route
try {
  registerEuAiActSprintRoute(app, { projectRoot: path.join(__dirname, "..") });
} catch (e) {
  logger.warn(
    "[Simplebeacon] EU AI Act sprint route setup skipped:",
    e.message,
  );
}

// Simplebeacon billing ΓÇö checkout, subscription status, license tokens
try {
  setupSimplebeaconBillingRoutes(app);
} catch (e) {
  logger.warn("[Simplebeacon] billing routes setup skipped:", e.message);
}

// Enterprise onboarding ΓÇö organization provisioning, seat management, Azure DevOps integration
try {
  setupEnterpriseOnboardingRoutes(app);
} catch (e) {
  logger.warn("[Enterprise] onboarding routes setup skipped:", e.message);
}

// License seat management ── self-service seat roster for team admins
try {
  app.use("/api/license", licenseSeatRoutes);
} catch (e) {
  logger.warn(
    "[LicenseSeats] seat management routes setup skipped:",
    e.message,
  );
}

// Public compliance schema endpoint ΓÇö no auth, no project access, no code upload
try {
  registerComplianceSchemaRoute(app);
} catch (e) {
  logger.warn(
    "[Simplebeacon] Compliance schema route setup skipped:",
    e.message,
  );
}

// PR integration API ΓÇö secure GitHub Action report ingestion
try {
  setupPrIntegrationAPI(app);
} catch (e) {
  logger.warn("[Simplebeacon] PR integration API setup skipped:", e.message);
}

// Free token routes ΓÇö community/sandbox token generation from coming-soon
try {
  const freeTokenRouter = require("../../coming-soon/dist/routes/free-token.cjs");
  app.use(freeTokenRouter);
} catch {
  try {
    const freeTokenRoutes = require("../../coming-soon/routes/free-token.cjs");
    app.use(freeTokenRoutes);
  } catch (e) {
    logger.warn("[FreeToken] free-token routes not loaded");
  }
}

// One-time checkout routes — certificate passes ($149/$499/$2,499) from coming-soon
// Required because the pricing page calls /api/create-checkout-session for one-time products
// The billing webhook at /api/simplebeacon/billing/webhook already handles the webhook side
try {
  if (!process.env.PUBLIC_URL) {
    process.env.PUBLIC_URL =
      process.env.SIMPLEBEACON_APP_URL ||
      process.env.PUBLIC_APP_URL ||
      "https://simplebeacon.ai";
  }
  const {
    router: checkoutRouter,
  } = require("../../coming-soon/routes/checkout.cjs");
  app.use(checkoutRouter);
  logger.info("[Checkout] One-time checkout routes mounted");
} catch (e) {
  logger.warn("[Checkout] Checkout routes not loaded:", e.message);
}

// Health probe endpoint (used by browser integrations)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Agent routes ΓÇö AI execution status
app.use("/api", require("./routes/agent-routes.cjs"));

// Path health metrics API
app.use("/api/metrics/path-health", pathHealthRouter);

// Custom prompt service (user-defined analysis prompts)
try {
  const promptService = require("./services/prompt-service.cjs");
  app.use("/api/prompts", promptService);
} catch (e) {
  logger.warn("[PromptService] prompt-service routes not loaded");
}

// Upload API disabled ΓÇö source code never leaves your machine per privacy promise.
// To re-enable: uncomment the next line.
// app.use('/api/upload', optionalAuthenticate, uploadSecurity, contentValidation, uploadRoutes);

// AI Context routes ΓÇö scan data + notes to .simplebeacon/ai-context.md
app.use("/api", require("./routes/ai-context-routes.cjs"));

// Token budget allocation routes ΓÇö per-org fiscal guardrails
app.use("/api/token-budget", tokenBudgetRoutes);

// Workspace configuration routes ΓÇö admin telemetry for sandbox + budget controls
app.use("/api/workspace", workspaceConfigRoutes);

// Fine-tuning telemetry routes ΓÇö conversation dataset collection and export
app.use("/api/telemetry", fineTuningTelemetryRoutes);

// Outreach routes — email campaign config, sent log, send, and prospects
registerOutreachRoutes(app, {
  dataDir: path.join(__dirname, "..", "data"),
  prefixes: ["/api/outreach", "/api/simplebeacon/outreach"],
});

// Enterprise organizations — list, onboard, trial
const enterpriseDb = isDatabaseEnabled()
  ? new DatabaseAdapter(getDatabaseConfig())
  : null;
app.get("/api/enterprise/organizations", async (req, res) => {
  try {
    if (!enterpriseDb) {
      return res.json({ organizations: [] });
    }
    const orgs = await enterpriseDb.query(
      "SELECT org_id, name, plan, seats, created_at FROM organizations ORDER BY created_at DESC LIMIT 100",
    );
    res.json({ organizations: orgs || [] });
  } catch (err) {
    logger.warn("[enterprise] organizations query failed:", err.message);
    res.json({ organizations: [] });
  }
});

app.post("/api/enterprise/onboard", async (req, res) => {
  try {
    const { companyName, adminEmail, plan = "trial" } = req.body || {};
    if (!companyName || !adminEmail) {
      return res
        .status(400)
        .json({
          success: false,
          error: "companyName and adminEmail are required",
        });
    }
    if (!enterpriseDb) {
      return res.json({
        success: true,
        orgId: `org_${Date.now()}`,
        companyName,
        adminEmail,
        plan,
      });
    }
    const orgId = `org_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await enterpriseDb.query(
      "INSERT INTO organizations (org_id, name, plan, seats, created_at) VALUES (?, ?, ?, 1, ?)",
      [orgId, companyName, plan, new Date().toISOString()],
    );
    res.json({ success: true, orgId, companyName, adminEmail });
  } catch (err) {
    logger.warn("[enterprise] onboard failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/enterprise/trial", async (req, res) => {
  try {
    const { companyName, adminEmail } = req.body || {};
    if (!companyName || !adminEmail) {
      return res
        .status(400)
        .json({
          success: false,
          error: "companyName and adminEmail are required",
        });
    }
    res.json({
      success: true,
      trialStarted: true,
      companyName,
      adminEmail,
      trialEndsAt: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Provider failover routes ΓÇö LLM provider health, failover stats, circuit breaker
try {
  const providerFailoverRoutes = require("./routes/provider-failover-routes.cjs");
  app.use("/api/provider-failover", providerFailoverRoutes);
  logger.info("[Provider-Failover] Routes mounted at /api/provider-failover");
} catch (e) {
  logger.warn("[Provider-Failover] Routes not mounted:", e?.message || e);
}

// Identity federation routes ΓÇö SAML/OIDC federation metadata and sync history
try {
  const identityFederationRoutes = require("./routes/identity-federation-routes.cjs");
  app.use("/api/identity-federation", identityFederationRoutes);
  logger.info(
    "[Identity-Federation] Routes mounted at /api/identity-federation",
  );
} catch (e) {
  logger.warn("[Identity-Federation] Routes not mounted:", e?.message || e);
}

// Tool schema validation routes ΓÇö schema inference, violation tracking, config
try {
  const toolSchemaRoutes = require("./routes/tool-schema-validation-routes.cjs");
  app.use("/api/tool-schemas", toolSchemaRoutes);
  logger.info("[ToolSchema] Routes mounted at /api/tool-schemas");
} catch (e) {
  logger.warn("[ToolSchema] Routes not mounted:", e?.message || e);
}

// Token-throttling backpressure mesh ΓÇö LLM provider RPM/TPM smoothing
app.use("/api/token-throttle", tokenThrottleRoutes);

// HSM Vault ΓÇö multi-region key custody handshake and decrypt
app.use("/api/vault", hsmVaultRoutes);

// Track 112 — disk-backed multipart upload session routes
app.use("/api/track112", track112UploadRoutes);

// Regional replication — cross-zone scan report & telemetry sync
app.use("/api/replication", replicationRoutes);

// Health diagnostics — automated infrastructure health checks
app.use("/api/v1/health/diagnostics", healthDiagnosticsRouter);
// Start the background health check cron (15-minute interval)
if (typeof healthDiagnosticsRouter.startHealthCheckCron === "function") {
  healthDiagnosticsRouter.startHealthCheckCron();
}

// Static file serving for saved scan data exports
app.use(
  "/data",
  express.static(path.join(__dirname, "../web/data"), { index: false }),
);

// Static file serving for JavaScript files
app.use(
  "/src",
  express.static(path.join(__dirname, "../src"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      }
    },
  }),
);

// Enhanced error handling with security
app.use(securityErrorHandler);
app.use((err, req, res, _next) => {
  const safeErr = constants.safeString(err);
  const stack = err && typeof err.stack === "string" ? err.stack : safeErr;
  logger.error(stack);

  // Log security-related errors
  const status =
    err && typeof err.status === "number" && Number.isFinite(err.status)
      ? err.status
      : 500;
  if (status >= 400) {
    logSecurityEvent(
      "application_error",
      {
        error: err && typeof err.message === "string" ? err.message : safeErr,
        stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
      },
      req.user,
      req,
    );
  }

  res.status(status).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err && typeof err.message === "string"
          ? err.message
          : safeErr
        : "Internal server error",
    requestId: req.requestId || req.id || "unknown",
  });
});

// Diagnostic: simple POST echo to verify POST routing and auth behavior
app.post("/api/_diagnostic/report-upload-test", express.json(), (req, res) => {
  res.json({
    success: true,
    received: true,
    bodyPreview:
      req.body && typeof req.body === "object"
        ? Object.keys(req.body).slice(0, 5)
        : null,
  });
});

// Internal program improvement report — admin-only, privacy-safe aggregate telemetry
app.get("/api/admin/improvement-report", async (req, res) => {
  try {
    const userEmail = String(
      (req.user && (req.user.email || req.user.sub)) || "",
    ).toLowerCase();
    const superAdminEmail = String(
      process.env.SUPER_ADMIN_EMAIL || "admin@simplebeacon.ai",
    ).toLowerCase();
    if (!userEmail || userEmail !== superAdminEmail) {
      return res
        .status(403)
        .json({ error: "admin_required", message: "Admin access required." });
    }
    const { summarizeAllTelemetry } = require("./lib/ci-telemetry-store.cjs");
    const {
      generateImprovementReportMarkdown,
    } = require("./cron/internal-improvement-report.cjs");
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const summary = summarizeAllTelemetry({ days });
    const markdown = generateImprovementReportMarkdown(summary);
    return res.json({ success: true, days, summary, markdown });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Could not generate improvement report" });
  }
});

// 404 handler with audit logging
app.use(/.*/, (req, res) => {
  logSecurityEvent(
    "route_not_found",
    {
      url: req.originalUrl,
      method: req.method,
    },
    req.user,
    req,
  );

  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    requestId: req.requestId || req.id || "unknown",
  });
});

const { createStartupManager } = require("./lib/server-startup.cjs");
const startup = createStartupManager({
  app,
  logger,
  logSystemEvent,
  constants,
});
if (process.env.NODE_ENV !== "test") {
  startup.startServer(Number(PORT), constants.MAX_RETRIES, (port) => {
    PORT = port;
  });
}

module.exports = app;
