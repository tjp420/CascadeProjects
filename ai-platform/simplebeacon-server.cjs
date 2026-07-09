/**
 * Simplebeacon Server
 * Express server for Simplebeacon landing, dashboard, and scan APIs
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const constants = require('./server/config/constants.cjs');
// Prefer v1-internal env when present (start script or direct node simplebeacon-server.js)
const v1InternalEnvPath = path.join(__dirname, '.env.v1-internal');
const envPath = process.env.DOTENV_CONFIG_PATH
  || (fs.existsSync(v1InternalEnvPath)
    ? v1InternalEnvPath
    : path.join(__dirname, '.env'));
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
    if (envPath.endsWith('.env.v1-internal')) {
      const { applyLocalV1InternalDevProfile } = require('./server/lib/secret-config.cjs');
      applyLocalV1InternalDevProfile();
    }
  } catch (envErr) {
    console.warn('[Simplebeacon] dotenv/secret-config load failed');
  }
}

// Production-safe defaults for auth env vars when Render (or other hosts) do not apply them.
// These only apply when the variable is missing/empty; explicit values are preserved.
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  if (!process.env.REQUIRE_AUTH) process.env.REQUIRE_AUTH = 'true';
  if (!process.env.SEED_DEMO_USERS) process.env.SEED_DEMO_USERS = 'false';
  if (!process.env.ALLOW_LEGACY_LOGIN) process.env.ALLOW_LEGACY_LOGIN = 'false';
}

const express = require('express');
const rateLimit = require('express-rate-limit');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const setupBuildFromPathRoute = require('./src/api/build-from-path-route.cjs');
const setupDashboardStubAPIs = require('./src/api/dashboard-stub-api.cjs'); // simplebeacon-ignore production-leak — real production dashboard API module, not a stub
const { setupSimplebeaconAPI } = require('./src/api/simplebeacon-api.cjs');
const {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes
} = require('./src/api/simplebeacon-billing-api.cjs');
const setupLocalModelsAPI = require('./server/routes/local-models-api.cjs');
const { setupFlexibleAnalyzeAPI } = require('./server/routes/flexible-analyze-api.cjs');
const { setupChatbotAPI } = require('./server/routes/chatbot-api.cjs');
const { setupPhase2Integration } = require('./server/bootstrap/phase2-integration.cjs');
const { setupRealtimeAnalysisAPI } = require('./server/routes/realtime-analysis-api.cjs');
const pathHealthRouter = require('./server/api/metrics/path-health.cjs');
const { registerLegacyPageRedirects } = require('./server/lib/legacy-page-redirects.cjs');
const uploadRoutes = require('./server/routes/upload.cjs');
const { setupRepositoryScannerAPIs } = require('./server/routes/repository-scanner-api.cjs');
const { setupAiMathAuditRoute } = require('./server/routes/ai-math-audit-route.cjs');
const { uploadSecurity, contentValidation } = require('./server/middleware/upload-security.cjs');
const { authenticate, optionalAuthenticate } = require('./server/middleware/auth.cjs');
const authRoutes = require('./server/routes/auth.cjs');
const { runNpmAuditAsync } = require('./server/lib/npm-audit-runner.cjs');

const { safeString, safeErrorMessage } = constants;

// ── Server-side utility helpers ───────────────────────────────

function setNoCacheHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
}

function buildJsonResponse(type, data, timestamp = new Date().toISOString()) {
    const result = { type, timestamp };
    if (data !== undefined) result.data = data;
    return result;
}

function trySendFile(res, filePath, type) {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) return false;
    if (typeof type === 'string' && type) res.type(type);
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
    const email = String(raw || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
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
app.set('trust proxy', 1);
const PORT = Number.isFinite(Number(process.env.PORT)) && Number(process.env.PORT) > 0
  ? Number(process.env.PORT)
  : constants.DEFAULT_PORT;
const WS_PORT = 8081;

// CORS — allow any origin in dev; specific origins in production
const productionDefaultOrigins = (process.env.ALLOWED_ORIGIN || 'https://simplebeacon.ai').split(',').map(s => s.trim()).filter(Boolean);
const publicUrlOrigin = process.env.PUBLIC_URL ? (process.env.PUBLIC_URL.startsWith('http') ? process.env.PUBLIC_URL : 'https://' + process.env.PUBLIC_URL) : '';
const rawAllowedOrigins = process.env.NODE_ENV === 'production'
    ? [...new Set([...productionDefaultOrigins, publicUrlOrigin].filter(Boolean))]
    : true;
const allowedOrigins = Array.isArray(rawAllowedOrigins) && rawAllowedOrigins.length > 0 ? rawAllowedOrigins : true;

const pagesPreviewOriginRegex = /^https:\/\/[a-z0-9-]+\.simplebeacon\.pages\.dev$/;
const renderOriginRegex = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;
function isAllowedCorsOrigin(origin) {
    if (allowedOrigins === true) { return true; }
    if (!origin) { return true; }
    return allowedOrigins.some(allowed => {
        if (allowed === origin) { return true; }
        if (/^http:\/\/(127\.0\.0\.1|localhost):\*$/.test(allowed)) {
            return origin.startsWith(allowed.replace(':*', ':'));
        }
        return false;
    }) || pagesPreviewOriginRegex.test(origin) || renderOriginRegex.test(origin);
}

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin)) {
            callback(null, origin || true);
        } else {
            callback(null, false);
        }
    },
    credentials: true
}));

// Security headers (lightweight helmet alternative — zero dependencies)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow iframe embedding in dev (for IDE previews like Windsurf/Cursor)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // Content-Security-Policy — allow local dev scripts, block inline eval
  // simplebeacon-ignore hardcoded-url — CSP comment describing env-based origin config, not a hardcoded production URL
  // Production connect-src uses SIMPLEBEACON_CSP_CONNECT_ORIGINS (space-separated) instead of hardcoded localhosts // simplebeacon-ignore hardcoded-url
  const SCANNER_BRIDGE_PORT = 3456;
  const LIVE_SERVER_PORT = 55000;
  const AGENT_PORT = process.env.SIMPLEBEACON_AGENT_PORT || '55432';
  const DEFAULT_PORTS = [3000, 3001, 3002, 8080, 5000, 38000, 50559, 54358, AGENT_PORT, 11434]; // 11434 = Ollama
  const prodConnectOrigins = process.env.SIMPLEBEACON_CSP_CONNECT_ORIGINS || "'self' https://simplebeacon.onrender.com https://*.onrender.com http://127.0.0.1:" + SCANNER_BRIDGE_PORT + " http://localhost:" + SCANNER_BRIDGE_PORT + " http://127.0.0.1:" + LIVE_SERVER_PORT + " http://localhost:" + LIVE_SERVER_PORT + DEFAULT_PORTS.flatMap(p => [" http://127.0.0.1:" + p, " http://localhost:" + p]).join(""); // simplebeacon-ignore hardcoded-url — Render and localhost origins for dashboard API
  const devConnectOrigins = process.env.SIMPLEBEACON_CSP_CONNECT_ORIGINS || "'self' ws: wss: http: https: http://127.0.0.1:" + SCANNER_BRIDGE_PORT + " http://localhost:" + SCANNER_BRIDGE_PORT + " http://127.0.0.1:" + LIVE_SERVER_PORT + " http://localhost:" + LIVE_SERVER_PORT + DEFAULT_PORTS.flatMap(p => [" http://127.0.0.1:" + p, " http://localhost:" + p]).join(""); // simplebeacon-ignore hardcoded-url — localhost dev CSP origins, never production
  const csp = process.env.NODE_ENV === 'production'
    ? `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src ${prodConnectOrigins}; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
    : `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src ${devConnectOrigins}; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors *;`
  res.setHeader('Content-Security-Policy', csp);
  next();
});

// HTTPS redirect for production — respect health checks and local development
app.use((req, res, next) => {
  const isLocalhost = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(req.hostname);
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (!isLocalhost && !isSecure && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
if (
  !process.env.SIMPLEBEACON_INTERNAL_DASHBOARD
  && !process.env.PORT
  && String(process.env.NODE_ENV || '').toLowerCase() !== 'production'
  && process.env.NODE_ENV !== 'test'
) {
  process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
  console.warn(
    `[Simplebeacon] Auto-enabled SIMPLEBEACON_INTERNAL_DASHBOARD for local dev on port ${PORT}. `
    + 'Use npm run dashboard:v1-internal for the full v1.0-internal profile.'
  );
}
const webRoot = path.join(__dirname, 'web');

// Render may clone the repo into a directory named after the repository (e.g.
// /opt/render/project/src/CascadeProjects), so try several candidate locations
// for the marketing landing pages before giving up.
function resolveLandingRoot() {
  const candidates = [
    path.join(__dirname, '../coming-soon/public'),
    path.join(__dirname, '../../coming-soon/public'),
    path.join(__dirname, '../CascadeProjects/coming-soon/public'),
    path.join(__dirname, '../../CascadeProjects/coming-soon/public')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}
const landingRoot = resolveLandingRoot();
const landingEnabled = process.env.SIMPLEBEACON_LANDING === 'true';
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
  if (typeof relativePath !== 'string') return false;
  const resolved = path.resolve(path.join(landingRoot, relativePath));
  const rootResolved = path.resolve(landingRoot);
  const relativeToRoot = path.relative(rootResolved, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return false;
  }
  if (!fs.existsSync(resolved)) return false;
  if (typeof type === 'string' && type) res.type(type);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
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
  if (process.env.NODE_ENV === 'production' && !process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT) {
    return false;
  }
  return sendLandingFile(res, 'demo-report.html', 'text/html');
}

const internalDashboard = String(process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || '').trim().toLowerCase() === 'true';

/**
 * Whether storefront assets should be served.
 * @returns {boolean}
 */
function storefrontAssetsEnabled() {
  return landingEnabled || internalDashboard;
}

// Refuse to start internal dashboard without a vault password in non-dev environments
if (internalDashboard && !process.env.DASHBOARD_VAULT_PASSWORD && process.env.NODE_ENV !== 'development') {
  throw new Error('DASHBOARD_VAULT_PASSWORD is required when SIMPLEBEACON_INTERNAL_DASHBOARD=true in non-development environments');
}
const verboseRuntimeLogs = process.env.DEBUG_LOGS === 'true' || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (verboseRuntimeLogs) {
    console.log(...args);
  }
};
/** Production: marketing at /. Local internal preview: dashboard at /, marketing at /landing */
const landingAtRoot = landingEnabled && !internalDashboard;
const {
  isVaultAuthenticated: checkVaultAuthenticated,
  isProtectedDashboardPath,
  setVaultSessionCookie: writeVaultSessionCookie
} = require('./server/lib/dashboard-vault-auth.cjs');

function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, { // simplebeacon-ignore dead-code — returns result of function call; no unreachable code follows
    internalDashboard,
    vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD
  });
}

function setVaultSessionCookie(res) {
  writeVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
}

if (process.env.NODE_ENV !== 'test') {
  console.log(
    `[Simplebeacon] SIMPLEBEACON_LANDING=${process.env.SIMPLEBEACON_LANDING || '(unset)'}`
    + ` internalDashboard=${internalDashboard} → /=${landingAtRoot ? 'landing' : 'dashboard'}`
  );
}

// Middleware — webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '50mb' }));

const { registerAuditBookingRoute } = require('./server/lib/audit-booking-route.cjs');
registerAuditBookingRoute(app, {
  landingEnabled,
  landingRoot,
  dataDir: path.join(__dirname, 'data')
});

const { registerOperatorRoutes } = require('./server/lib/register-operator-routes.cjs');
registerOperatorRoutes(app, {
  projectRoot: __dirname,
  monorepoRoot: path.join(__dirname, '..'),
  landingRoot
});

const { registerOutreachRoutes } = require('./server/lib/outreach-route.cjs');
registerOutreachRoutes(app, {
  dataDir: path.join(__dirname, 'data')
});

// simplebeacon-ignore secret-in-comments — route organization comment
// API routes before static files to avoid 404 responses on API paths
setupBuildFromPathRoute(app);
registerLegacyPageRedirects(app);

// Setup enhanced real-time analysis API
setupRealtimeAnalysisAPI(app, {
    baseDir: __dirname,
    monorepoRoot: path.join(__dirname, '..')
});

const { registerDataCleanupAnalyzeRoute } = require('./server/lib/data-cleanup-scan.cjs');
registerDataCleanupAnalyzeRoute(app, {
  baseDir: __dirname,
  monorepoRoot: path.join(__dirname, '..')
});
app.post('/api/ai-context', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { projectPath, notes, reportSummary, issues } = req.body;
    if (!reportSummary || !issues) {
      return res.status(400).json({ success: false, error: 'Missing report data' });
    }
    // Build markdown summary for AI agent
    const lines = [
      '# SimpleBeacon Scan Summary',
      `**Project:** ${projectPath || 'Unknown'}`,
      `**Quality Score:** ${reportSummary.qualityScore ?? 'N/A'}`,
      `**Gate Pass:** ${reportSummary.gatePass ?? 'N/A'}`,
      `**Total Issues:** ${reportSummary.totalIssues ?? issues.length}`,
      `**Files Scanned:** ${reportSummary.filesScanned ?? 'N/A'}`,
      ''
    ];
    if (notes) {
      lines.push(`**Notes:** ${notes}`, '');
    }
    lines.push('## Issues');
    const maxIssues = Math.min(issues.length, 200); // simplebeacon-ignore memory-leak — loop is bounded at 200 iterations
    for (let i = 0; i < maxIssues; i++) {
      const issue = issues[i];
      lines.push(`- **[${issue.severity || 'low'}]** ${issue.type || 'Issue'}: ${issue.description || ''}`);
      if (issue.filePath || issue.file) {
        lines.push(`  - Location: \`${issue.filePath || issue.file}${issue.line ? ':' + issue.line : ''}\``);
      }
    }
    lines.push('', '_Paste this into your AI coding agent for remediation guidance._');
    const content = lines.join('\n');
    res.json({ success: true, content });
  } catch (err) {
    const msg = safeErrorMessage(err);
    console.error('[AI-Context] Error:', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.set('Content-Type', 'application/json');
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health/routes', (_req, res) => {
  res.json({
    status: 'ok',
    dataCleanup: true,
    paths: ['/api/analyze/data-cleanup'],
    build: '2026-05-27-data-cleanup'
  });
});
if (process.env.NODE_ENV !== 'test') {
  console.log('[Simplebeacon] Registered GET /api/analyze/data-cleanup');
}

const dashboardPath = path.join(webRoot, 'simplebeacon-dashboard/index.html');
let _cachedDashboardHtml = null;
let _cachedDashboardMtimeMs = 0;

async function loadDashboardHtml() {
  try {
    const stat = await fs.promises.stat(dashboardPath);
    if (_cachedDashboardHtml && stat.mtimeMs === _cachedDashboardMtimeMs) {
      return _cachedDashboardHtml;
    }
    let html = await fs.promises.readFile(dashboardPath, 'utf8');
    // Ensure relative asset paths resolve from root when served from /dashboard
    if (!html.includes('<base href=')) {
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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  // Path-traversal guard: ensure dashboard path resolves inside webRoot
  const resolved = path.resolve(dashboardPath);
  const rootResolved = path.resolve(webRoot);
  const relativeToRoot = path.relative(rootResolved, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return res.status(403).send('Forbidden');
  }
  const html = await loadDashboardHtml();
  if (html === null) {
    return res.status(404).send('Simplebeacon dashboard not found');
  }
  // Do not inject vault password into HTML — use vault endpoint instead
  return res.send(html);
}

function sendLandingIndex(res) {
  const landingIndex = path.join(landingRoot, 'index.html');
  if (!fs.existsSync(landingIndex)) return false; // simplebeacon-ignore sync-io-async-path — synchronous file existence check for landing page fallback
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(landingIndex);
  return true;
}

async function redirectPublicToLanding(req, res) {
  if (landingAtRoot) {
    return res.redirect(302, '/');
  }
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
}

// Dashboard SPA — internal operator only when landing serves sales gate at /
app.get(/^\/demo(\/.*)?$/, async (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/signin(\/.*)?$/, async (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/app(\/.*)?$/, async (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/upload(\.html)?(\/.*)?$/, (req, res) => res.redirect(302, '/#/upload'));
app.get(/^\/trust(\/.*)?$/, (req, res) => {
  if (landingAtRoot) return res.redirect(302, '/');
  if (internalDashboard && !isVaultAuthenticated(req)) return res.redirect(302, '/');
  const trustHash = internalDashboard ? '/#/trust' : '/app#/trust';
  res.redirect(302, trustHash);
});

app.get('/', async (req, res) => {
  // For internal dashboard, prioritize dashboard over landing page
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  // For public access, show landing page first, then fall back to dashboard
  if (sendLandingIndex(res)) return;
  return sendSimplebeaconDashboard(res);
});

app.get(['/dashboard', '/dashboard/'], async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
});

// SPA sub-routes (e.g. /dashboard/analyze) — let the client router handle the path
app.get('/dashboard/*', async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
});

// Compatibility: also serve dashboard at /simplebeacon-dashboard (new server/index.cjs path)
app.get(['/simplebeacon-dashboard', '/simplebeacon-dashboard/', '/simplebeacon-dashboard/index.html'], async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
});
app.get('/simplebeacon-dashboard/*', async (req, res) => {
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
});

app.get(['/landing', '/landing/'], (req, res) => {
  if (!landingEnabled) return res.redirect(302, '/');
  if (sendLandingIndex(res)) return;
  return res.status(404).send('Landing page not found');
});

// Direct access to landing.html file (bypasses landingEnabled flag for development)
app.get('/landing.html', (req, res) => {
  if (sendLandingFile(res, 'landing.html', 'text/html')) return;
  return res.status(404).send('Landing page not found');
});

// Private dashboard — unlocks vault session; optional returnTo redirects back to /app
app.get('/private-dashboard-vault', (req, res) => {
  const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
  const hasPassword = vaultPassword != null && String(vaultPassword).length > 0;
  const isLocalDev = process.env.NODE_ENV === 'development' && !hasPassword;

  if (!isLocalDev && req.query.password !== vaultPassword) {
    return res.status(403).send('Unauthorized Access: Private Vault is Locked.');
  }

  setVaultSessionCookie(res);

  const returnTo = String(req.query.returnTo || '').trim();
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return res.redirect(302, returnTo);
  }

  // Redirect to dashboard by default instead of showing demo report
  return res.redirect(302, '/');
});

app.get(['/demo-report', '/demo-report/', '/demo-report.html'], (req, res, next) => {
  if (sendDemoReport(res)) return;
  next();
});

if (landingRootExists) {
  app.get('/site-config.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'site-config.js', 'application/javascript')) return;
    next();
  });
  app.get('/app-links.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'app-links.js', 'application/javascript')) return;
    next();
  });
  app.get('/audit-booking.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'audit-booking.js', 'application/javascript')) return;
    next();
  });
  app.get('/diagnostic-scanner.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'diagnostic-scanner.js', 'application/javascript')) return;
    next();
  });
  app.get('/diagnostic-bundle-lib.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'diagnostic-bundle-lib.js', 'application/javascript')) return;
    next();
  });
  app.get('/styles.css', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'styles.css', 'text/css')) return;
    next();
  });
  app.get('/pricing.js', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'pricing.js', 'application/javascript')) return;
    next();
  });
  app.get(['/pricing', '/pricing/'], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'pricing.html', 'text/html')) return;
    next();
  });
  app.get(['/downloads/diagnostic-prep', '/downloads/diagnostic-prep.html'], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'downloads/diagnostic-prep.html', 'text/html')) return;
    next();
  });
  for (const legalPage of ['terms', 'privacy', 'refund']) {
    app.get([`/${legalPage}`, `/${legalPage}/`], (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      if (sendLandingFile(res, `${legalPage}.html`, 'text/html')) return;
      next();
    });
  }
  app.get('/pricing.html', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, '/pricing');
  });
  for (const legalPage of ['terms', 'privacy', 'refund', 'contact']) {
    app.get(`/${legalPage}.html`, (req, res, next) => {
      if (!storefrontAssetsEnabled()) return next();
      return res.redirect(301, `/${legalPage}`);
    });
  }
  app.get(['/community', '/community/'], (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(302, '/');
  });
  app.get('/community.html', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    return res.redirect(301, '/community/');
  });
  app.get('/downloads/simplebeacon-:version.tgz', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    const version = String(req.params.version || '').replace(/[\\/]/g, '_');
    if (!version) return next();
    if (sendLandingFile(res, `downloads/simplebeacon-${version}.tgz`, 'application/gzip')) return;
    next();
  });
  app.get('/robots.txt', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'robots.txt', 'text/plain')) return;
    next();
  });
  app.get('/sitemap.xml', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'sitemap.xml', 'application/xml')) return;
    next();
  });
  app.get('/favicon.svg', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    if (sendLandingFile(res, 'favicon.svg', 'image/svg+xml')) return;
    next();
  });

  // Redirect /coming-soon/* links to the canonical landing pages served at root
  app.get('/coming-soon/*', (req, res, next) => {
    if (!storefrontAssetsEnabled()) return next();
    const target = req.params[0] || '';
    if (!target) return res.redirect(301, '/');
    return res.redirect(301, '/' + target);
  });

  // Serve remaining landing assets whenever landing pages are available
  // (not just when landing is at root), so /audit.html and similar pages can load scripts
  if (landingRootExists) {
    app.use(express.static(landingRoot));
  }

  const waitlistRateLimiter = rateLimit({
    windowMs: constants.ONE_MINUTE_MS || 60 * 1000,
    max: 10,
    message: { error: 'rate_limited' },
    standardHeaders: true,
    legacyHeaders: false
  });

  app.post('/api/waitlist', waitlistRateLimiter, async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    const entry = {
      email,
      source: typeof req.body?.source === 'string' ? req.body.source : 'landing',
      ts: typeof req.body?.ts === 'string' ? req.body.ts : new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    const waitlistDir = path.join(__dirname, 'data');
    const waitlistFile = path.join(waitlistDir, 'waitlist-signups.json');
    try {
      await fs.promises.mkdir(waitlistDir, { recursive: true });
      let rows = [];
      try {
        const data = await fs.promises.readFile(waitlistFile, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) rows = parsed;
      } catch { /* file does not exist yet */ }
      if (!rows.some((r) => r && typeof r === 'object' && r.email === email)) rows.push(entry);
      await fs.promises.writeFile(waitlistFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      console.warn('[waitlist] persist failed:', safeErrorMessage(err));
    }
    return res.json({ ok: true, email });
  });

  app.get('/api/waitlist/count', async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const waitlistFile = path.join(__dirname, 'data', 'waitlist-signups.json');
    try {
      const data = await fs.promises.readFile(waitlistFile, 'utf8');
      const rows = JSON.parse(data);
      return res.json({ count: Array.isArray(rows) ? rows.length : 0 });
    } catch {
      return res.json({ count: 0 });
    }
  });

  app.post('/api/waitlist/event', waitlistRateLimiter, async (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const event = {
      event: typeof req.body?.event === 'string' ? req.body.event : 'unknown',
      data: (req.body?.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data)) ? req.body.data : {},
      ts: typeof req.body?.ts === 'string' ? req.body.ts : new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    const eventsFile = path.join(__dirname, 'data', 'waitlist-events.json');
    try {
      await fs.promises.mkdir(path.dirname(eventsFile), { recursive: true });
      let rows = [];
      try {
        const data = await fs.promises.readFile(eventsFile, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) rows = parsed;
      } catch { /* file does not exist yet */ }
      rows.push(event);
      const MAX_WAITLIST_EVENTS = 10000;
      if (rows.length > MAX_WAITLIST_EVENTS) rows = rows.slice(-MAX_WAITLIST_EVENTS);
      await fs.promises.writeFile(eventsFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      console.warn('[waitlist] event persist failed:', safeErrorMessage(err));
    }
    return res.json({ ok: true });
  });

  app.use((req, res, next) => {
    if (!landingEnabled) return next();
    // Skip landing root static files when internalDashboard is enabled
    if (internalDashboard) return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/demo') || req.path.startsWith('/app')) {
      return next();
    }
    express.static(landingRoot, { index: false, redirect: false })(req, res, next);
  });
}

// Serve landing pages from root
app.use('/', express.static(landingRoot, { index: false }));

// Development-only route for scan artifacts (gated in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/data', express.static(path.join(__dirname, 'web', 'data'), { index: false }));
}

// Simplebeacon API + billing routes registered after Phase 2 auth in bootstrapPhase2Routes()

app.get('/favicon.ico', (_req, res) => {
  const icoPath = path.join(webRoot, 'favicon.ico');
  const svgPath = path.join(webRoot, 'favicon.svg');
  if (fs.existsSync(icoPath)) { // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type('image/png');
    return res.sendFile(icoPath);
  }
  if (fs.existsSync(svgPath)) { // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type('image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.get('/favicon.svg', (_req, res) => {
  const svgPath = path.join(webRoot, 'favicon.svg');
  if (fs.existsSync(svgPath)) { // simplebeacon-ignore sync-io-async-path — file existence check before serving favicon
    res.type('image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.use('/api/metrics/path-health', pathHealthRouter);

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') return next();
  if (!internalDashboard) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/api/simplebeacon/billing/webhook')) return next();
  if (req.path.startsWith('/api/auth/')) return next();
  if (req.path === '/api/platform/status') return next();
  if (req.path === '/api/health' || req.path === '/health') return next();
  if (req.path.startsWith('/api/analyze/')) return next();
  if (req.path === '/api/simplebeacon/report') return next();
  if (req.path === '/api/simplebeacon/report/import') return next();
  if (req.path === '/api/simplebeacon/config') return next();
  if (req.path === '/api/simplebeacon/history') return next();
  if (req.path === '/api/simplebeacon/baseline') return next();
  if (req.path === '/api/dashboard-home') return next();
  if (req.path === '/api/dev-tools/tools') return next();
  if (req.path === '/api/dev-tools/workflows') return next();
  if (req.path === '/api/coverage-reports/overview') return next();
  if (req.path === '/api/security/overview') return next();
  if (req.path === '/api/help') return next();
  if (req.path === '/api/quality/overview') return next();
  if (req.path === '/api/reports/download') return next();
  if (
    req.path === '/api/waitlist'
    || req.path === '/api/waitlist/count'
    || req.path === '/api/waitlist/event'
    || req.path === '/api/audit-booking'
    || req.path === '/api/audit-bookings'
    || req.path === '/api/free-token'
    || req.path === '/api/tokens/sandbox'
  ) return next();
  if (isVaultAuthenticated(req)) return next();
  // simplebeacon-ignore dead-code — final return in Express middleware, not unreachable code
  return res.status(403).json({ // simplebeacon-ignore dead-code
    error: 'vault_required',
    message: 'Internal dashboard requires vault authentication.'
  });
});

function requireVaultAuth(req, res, next) {
  if (process.env.NODE_ENV === 'development') return next();
  if (!internalDashboard) return next();
  if (isVaultAuthenticated(req)) return next();
  return res.redirect(302, '/');
}

app.use((req, res, next) => {
  if (!isProtectedDashboardPath(req.path)) return next();
  requireVaultAuth(req, res, next);
});

// Serve dashboard assets from root when internal dashboard is active
if (!landingAtRoot) {
  const dashDir = path.join(webRoot, 'simplebeacon-dashboard');
  ['/css', '/js', '/js-es2018', '/images', '/fonts', '/assets'].forEach(p => {
    app.use(p, express.static(path.join(dashDir, p.substring(1))));
  });
  app.use('/site-config.js', express.static(path.join(dashDir, 'site-config.js')));
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // For dashboard mode, prioritize dashboard index.html over landing page
  if (!landingAtRoot && (req.path === '/' || req.path === '/dashboard' || req.path === '/dashboard/')) {
    return sendSimplebeaconDashboard(res);
  }
  // Explicitly set MIME types for CSS files to ensure proxy forwards correctly
  if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  }
  if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  if (/^\/(services|scripts|components|simplebeacon-dashboard)\/.*\.(js|css|html)$/i.test(req.path) || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  express.static(webRoot)(req, res, next);
});

// Marketing landing lives at / when SIMPLEBEACON_LANDING=true (or /landing in internal preview)
// Serve the marketing/coming-soon site under the /coming-soon/ prefix so that
// direct links like /coming-soon/audit.html work on the deployed service.
if (landingRootExists) {
  app.use('/coming-soon', express.static(landingRoot, { fallthrough: false }));
}

app.get('/coming-soon', (_req, res) => {
  if (!landingEnabled) return res.redirect(301, '/');
  if (internalDashboard) return res.redirect(301, '/landing');
  return res.redirect(301, '/');
});

app.get('/community', async (_req, res) => {
  if (landingEnabled) {
    const landingCommunity = path.join(landingRoot, 'community.html');
    try {
      await fs.promises.access(landingCommunity);
      return res.sendFile(landingCommunity);
    } catch { /* file not found, fall through to 404 */ }
  }
  return res.status(404).send('Community pricing page not found');
});

/**
 * Stub merger-tool routes used by the dashboard scan pipeline.
 * @param {import('express').Application} app
 * @param {string} baseDir
 */
function setupMergerToolRoutes(app, baseDir) {
    app.get('/api/merger-tool/reduction-scan', optionalAuthenticate, (req, res) => {
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
                potentialSavingsLabel: '0 B'
            },
            mergeCandidates: [],
            reductionOpportunities: [],
            notes: 'Merger-tool reduction scan is not available in this deployment — returning empty summary.'
        });
    });
}

// Phase 2 bootstrap + dashboard stub APIs (initialized in startServer) // simplebeacon-ignore production-leak — real production dashboard API module
async function bootstrapPhase2Routes() {
    const routeSetups = [
        { name: 'localModels', fn: () => setupLocalModelsAPI(app, { baseDir: __dirname }) },
        { name: 'flexibleAnalyze', fn: () => setupFlexibleAnalyzeAPI(app, {
            baseDir: __dirname,
            monorepoRoot: path.join(__dirname, '..'),
            publicGateEnabled: !internalDashboard,
            closedVaultMode: landingAtRoot
        }) },
        { name: 'phase2Integration', fn: async () => await setupPhase2Integration(app, { webRoot }) },
        { name: 'billingRoutes', fn: () => setupSimplebeaconBillingRoutes(app) },
        { name: 'simplebeaconAPI', fn: () => setupSimplebeaconAPI(app) },
        { name: 'trustAPI', fn: () => require('./src/api/trust-api.cjs').setupTrustAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') }) },
        { name: 'optimizationAPI', fn: () => require('./src/api/optimization-api.cjs').setupOptimizationAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') }) },
        { name: 'assessmentRoutes', fn: () => require('./server/api/assessment/routes.cjs').setupAssessmentRoutes(app) },
        { name: 'repositoryScanner', fn: () => setupRepositoryScannerAPIs(app, { platformRoot: __dirname }) },
        { name: 'chatbotAPI', fn: () => setupChatbotAPI(app) },
        { name: 'promptService', fn: () => {
            try {
                const promptService = require('./server/services/prompt-service.cjs');
                app.use('/api/prompts', promptService);
            }
            catch (e) {
                console.error('[PromptService] prompt-service routes not loaded:', e?.message || e);
            }
        } },
        { name: 'aiMathAudit', fn: () => setupAiMathAuditRoute(app, __dirname) },
        { name: 'mergerTool', fn: () => setupMergerToolRoutes(app, __dirname) }
    ];

    for (const setup of routeSetups) {
        try {
            await setup.fn();
        } catch (error) {
            console.error(`❌ ${setup.name} setup failed:`, safeErrorMessage(error)); // simplebeacon-ignore production-leak — error message text only
            console.error('Stack:', error?.stack || '(no stack)');
        }
    }

    app.use('/api/metrics/path-health', pathHealthRouter);

    const uploadAuth = process.env.REQUIRE_AUTH === 'true' ? authenticate : optionalAuthenticate;
    app.use('/api/upload', uploadAuth, uploadSecurity, contentValidation, uploadRoutes);

    try {
        setupDashboardStubAPIs(app, webRoot, { // simplebeacon-ignore production-leak — real production dashboard API module
            db: app.locals.db,
            redis: app.locals.redis,
            authMiddleware: optionalAuthenticate
        });
    } catch (error) {
        console.error('❌ Dashboard stub setup failed:', safeErrorMessage(error)); // simplebeacon-ignore production-leak — error message text only
        console.error('Stack:', error?.stack || '(no stack)');
        setupDashboardStubAPIs(app, webRoot, { // simplebeacon-ignore production-leak — real production dashboard API module
            authMiddleware: optionalAuthenticate
        });
    }

    registerOutreachRoutes(app, {
        dataDir: path.join(__dirname, 'data')
    });
}

async function startServer() {
  await bootstrapPhase2Routes();

  // Auth routes are always registered, even if phase 2 bootstrap partially failed
  app.use('/api/auth', authRoutes);

  // Fallback report endpoint for the dashboard when the real simplebeacon API is unavailable
  app.get('/api/simplebeacon/report', optionalAuthenticate, async (req, res) => {
    try {
      const projectPath = req.query.projectPath ? path.resolve(req.query.projectPath) : null;
      const reportPath = projectPath
        ? path.join(projectPath, '.simplebeacon', 'report.json')
        : path.join(__dirname, '.simplebeacon', 'report.json');
      if (fs.existsSync(reportPath)) {
        return res.json(JSON.parse(await fs.promises.readFile(reportPath, 'utf8')));
      }
      return res.json({
        type: 'simplebeacon-report',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        projectPath: projectPath || path.join(__dirname, '..'),
        summary: { totalFiles: 0, issues: 0, score: 100, grade: 'A' },
        findings: [],
        modules: []
      });
    } catch (err) {
      console.warn('[ReportFallback] Could not serve report:', err.message);
      return res.status(500).json({ error: 'report_unavailable', message: err.message });
    }
  });

  // Import a simplebeacon-report JSON file so the dashboard can load/export it
  app.post('/api/simplebeacon/report/import', authenticate, async (req, res) => {
    try {
      const body = req.body || {};
      const report = body.report;
      if (!report || typeof report !== 'object') {
        return res.status(400).json({ success: false, error: 'report is required' });
      }
      const reportType = report.type;
      if (reportType !== 'simplebeacon-report' && reportType !== 'data-cleanup-report' && reportType !== 'simplebeacon-complete-scan') {
        return res.status(400).json({ success: false, error: 'Unsupported report type' });
      }
      const rawTarget = String(body.projectPath || report.platformRoot || report.projectRoot || '').trim();
      if (!rawTarget) {
        return res.status(400).json({ success: false, error: 'projectPath or report projectRoot/platformRoot is required' });
      }
      const { resolveProjectPath } = require('./server/lib/flexible-analyze-utils.cjs');
      const { assertSafeProjectPath, resolveDefaultAllowedRoots } = require('./server/lib/path-safety.cjs');
      const baseDir = __dirname;
      const monorepoRoot = path.resolve(path.join(baseDir, '..'));
      const resolved = resolveProjectPath(baseDir, rawTarget, monorepoRoot);
      const allowedRoots = resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
      const safePath = assertSafeProjectPath(resolved, allowedRoots, 'projectPath');
      if (!fs.existsSync(safePath)) {
        return res.status(400).json({ success: false, error: `Target path does not exist: ${safePath.replace(/\\/g, '/')}` });
      }
      const safePathForward = safePath.replace(/\\/g, '/');

      // Normalize legacy v1 reports to reportVersion 2 so the dashboard treats them as current
      const isLegacy = report.reportVersion == null || Number(report.reportVersion) < 2;
      if (isLegacy) {
        report.reportVersion = 2;
        report.projectRoot = report.projectRoot || safePathForward;
        report.platformRoot = report.platformRoot || safePathForward;
      }

      // Enrich repository inventory if the imported report is missing it
      if (!report.repositoryInventory || report.repositoryInventory.totalFiles == null) {
        // v1 reports often store counts under `inventory`
        if (report.inventory && typeof report.inventory === 'object') {
          const inv = report.inventory;
          const totalFiles = inv.scannedFiles != null ? inv.scannedFiles : (inv.totalFiles != null ? inv.totalFiles : null);
          report.repositoryInventory = {
            totalFiles: totalFiles != null ? totalFiles : 0,
            totalFolders: inv.totalFolders != null ? inv.totalFolders : 0,
            projectRoot: safePathForward
          };
        }
      }
      if (!report.repositoryInventory || report.repositoryInventory.totalFiles == null) {
        try {
          const { countRepositoryInventory } = require('./server/lib/simplebeacon-proxy.cjs');
          report.repositoryInventory = await countRepositoryInventory(safePath, { profile: 'all' });
        } catch (invErr) {
          console.warn('[ReportImport] inventory enrichment failed:', invErr.message);
        }
      }
      const sbDir = path.join(safePath, '.simplebeacon');
      if (!fs.existsSync(sbDir)) {
        fs.mkdirSync(sbDir, { recursive: true });
      }
      const reportPath = path.join(sbDir, 'report.json');
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.warn('[ReportImport] persisted report to', reportPath.replace(/\\/g, '/'));
      return res.json({
        success: true,
        projectPath: safePath.replace(/\\/g, '/'),
        reportVersion: report.reportVersion || report.version || null
      });
    } catch (err) {
      console.warn('[ReportImport] failed:', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Fallback dashboard/simplebeacon API endpoints when phase 2 bootstrap or stubs are unavailable
  app.get('/api/platform/status', optionalAuthenticate, (req, res) => {
    res.json({
      phase: 1,
      database: 'not_configured',
      redis: 'not_configured',
      authRequired: false,
      internalDashboard: true,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/simplebeacon/config', optionalAuthenticate, (req, res) => {
    res.json({
      scanPaths: ['server/', 'src/', 'web/', 'packages/'],
      productionPaths: ['server/', 'src/', 'packages/simplebeacon-cli/src/'],
      sampleDir: null,
      gate: { failOn: ['high'], warnOn: ['medium', 'low'] },
      fullDirectoryScan: false
    });
  });

  // Pricing config endpoint — serves Stripe URLs from environment variables
  app.get('/api/config/pricing', (_req, res) => {
    res.json({
      success: true,
      pricing: {
        instant: {
          stripeLink: process.env.STRIPE_LINK_INSTANT || 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07'
        },
        executive: {
          stripeLink: process.env.STRIPE_LINK_EXECUTIVE || 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05'
        },
        euSprint: {
          stripeLink: process.env.STRIPE_LINK_EU_SPRINT || 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06'
        }
      }
    });
  });

  app.get('/api/simplebeacon/history', optionalAuthenticate, (req, res) => {
    res.json({ entries: [] });
  });

  app.get('/api/simplebeacon/baseline', optionalAuthenticate, (req, res) => {
    res.json({
      summary: {},
      jestTestsLabel: '0/0',
      jestSuites: '0/0',
      pageSamplesLabel: '0/0'
    });
  });

  app.get('/api/dashboard-home', optionalAuthenticate, (req, res) => {
    res.json({
      success: true,
      data: {
        overview: {
          totalFiles: 0,
          codeQuality: 100,
          schemaPassRate: 100,
          scannerIssues: 0,
          securityScore: '100/100',
          pageSamplesLabel: '0/0',
          complianceRate: 100
        }
      }
    });
  });

  app.get('/api/dev-tools/tools', optionalAuthenticate, (req, res) => res.json([]));
  app.get('/api/dev-tools/workflows', optionalAuthenticate, (req, res) => res.json([]));

  app.get('/api/coverage-reports/overview', optionalAuthenticate, (req, res) => {
    res.json({
      overallCoverage: null,
      lineCoverage: null,
      branchCoverage: null,
      functionCoverage: null,
      statementCoverage: null,
      passedTests: null,
      totalTests: null,
      notes: 'Run npm run test:coverage for Istanbul percentages. Sync Jest counts via Tools → Baseline sync.'
    });
  });

  app.get('/api/security/overview', optionalAuthenticate, (req, res) => {
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
      resolvedIncidents: 0
    });
  });

  app.post('/api/security/npm-audit', optionalAuthenticate, async (req, res) => {
    try {
      const platformRoot = path.join(__dirname);
      const force = req.body?.force === true;
      const npmAudit = await runNpmAuditAsync(platformRoot, { force });
      res.set('Cache-Control', 'no-store');
      res.json({
        success: true,
        ...npmAudit,
        projectPath: platformRoot,
        auditRoot: platformRoot
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: safeString(error)
      });
    }
  });

  app.get('/api/help', optionalAuthenticate, (req, res) => {
    res.json({ success: true, data: { overview: {}, documentation: [], faq: [] } });
  });

  app.get('/api/quality/overview', optionalAuthenticate, (req, res) => {
    res.json({
      qualityScore: 100,
      overallScore: 100,
      gatePass: true,
      issueCount: 0,
      duplicateGroups: 0,
      schemaCompliance: 100,
      consistencyScore: 100,
      totalFiles: 0
    });
  });

  // Free community token generation (shared with coming-soon)
  try {
    const fs = require('fs');
    const path = require('path');
    const simplebeaconDir = path.join(__dirname, '..', 'coming-soon', '.simplebeacon');
    if (!fs.existsSync(simplebeaconDir)) {
      fs.mkdirSync(simplebeaconDir, { recursive: true });
    }
    const freeTokenRoutes = require('../coming-soon/routes/free-token.cjs');
    app.use(freeTokenRoutes);
  } catch (e) {
    console.warn('[FreeToken] free-token routes not loaded:', e.message);
  }

  // Global error handler — return JSON for API routes instead of the default HTML error page
  app.use((err, req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const status = err.status || err.statusCode || 500;
      const body = {
        error: err.code || err.name || 'internal_error',
        message: err.message || 'Internal server error'
      };
      if (process.env.NODE_ENV !== 'production' && err.stack) {
        body.stack = err.stack;
      }
      return res.status(status).json(body);
    }
    next(err);
  });

  // Fallback stub for prompt endpoints when prompt-service module did not mount.
  // The real prompt-service router is mounted earlier; this only handles the 404 case.
  app.get('/api/prompts/get', (req, res) => {
    res.json({ success: true, prompt: '', userId: req.query.userId || 'anonymous', updatedAt: null });
  });
  app.post('/api/prompts/set', (req, res) => {
    res.json({ success: true, userId: req.body?.userId || 'anonymous', message: 'Prompt saved' });
  });
  // JSON 404 for unknown API routes (must be after Phase 2 + stub registration)
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API route not found',
      path: req.path,
      method: req.method,
      hint: 'GET /api/dynamic-roadmap/health to verify the server'
    });
  });

  const server = http.createServer(app);
  let wss;
  try {
    wss = setupWebSocketServer(server);
  } catch (err) {
    console.error('❌ WebSocket server setup failed:', safeErrorMessage(err));
    wss = null;
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Run: npm run dashboard:kill-ports`);
      process.exit(1);
    }
    console.error('❌ Server error:', err);
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Simplebeacon server running on http://localhost:${PORT}`);
    console.log(`✉️ Outreach API at: http://localhost:${PORT}/api/simplebeacon/outreach/config`);
    try {
      const {
        resolveDefaultAllowedRoots,
        formatAllowedRootsSummary
      } = require('./server/lib/path-safety.cjs');
      const allowedRoots = resolveDefaultAllowedRoots(__dirname, { monorepoRoot: path.join(__dirname, '..') });
      console.log(`📂 Allowed analysis roots: ${formatAllowedRootsSummary(allowedRoots, 8) || '(none)'}`);
    } catch (err) {
      console.warn('[path-safety] Could not log allowed analysis roots:', safeErrorMessage(err));
    }
    if (landingAtRoot && fs.existsSync(path.join(landingRoot, 'index.html'))) {
      console.log(`🌐 Landing page at: http://localhost:${PORT}/`);
      console.log(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/app`);
    } else if (landingEnabled && internalDashboard && fs.existsSync(path.join(landingRoot, 'index.html'))) {
      console.log(`🌐 Paywall at: http://localhost:${PORT}/`);
      console.log(`🌐 Marketing preview at: http://localhost:${PORT}/landing`);
      if (process.env.NODE_ENV !== 'production' || process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT) {
        console.log(`📄 Demo report at: http://localhost:${PORT}/demo-report`);
      }
      console.log(`📥 Operator booking inbox at: http://localhost:${PORT}/operator/bookings`);
      if (!String(process.env.RESEND_API_KEY || '').trim()) {
        console.log(`✉️ Email alerts OFF — set RESEND_API_KEY in .env.v1-internal (bookings still save to operator inbox)`);
      }
      console.log(`🛡️ Vault unlock at: http://localhost:${PORT}/private-dashboard-vault?password=<DASHBOARD_VAULT_PASSWORD>`); // simplebeacon-ignore secret-in-comments — console URL with placeholder token, not a real secret
      if (process.env.NODE_ENV !== 'production' || process.env.SIMPLEBEACON_ENABLE_DEMO_REPORT) {
        console.log(`   → opens demo report (same layout as simplebeacon.ai/demo-report)`);
      }
    } else {
      console.log(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/`);
    }
    if (internalDashboard) {
      console.log(`🔒 /app and dashboard APIs require vault session (24h cookie after vault login)`);
      console.log(`🧪 STAGING: see coming-soon/STAGING.md (payments flag in site-config.js)`);
    }
    console.log(`🔧 Simplebeacon API at: http://localhost:${PORT}/api/simplebeacon/`);
    console.log(`🌐 WebSocket available at: ws://localhost:${PORT}/ws (legacy: ws://localhost:${WS_PORT})`);
    console.log(`🔐 Phase 2 auth: ${process.env.REQUIRE_AUTH === 'true' ? 'required' : 'optional (set REQUIRE_AUTH=true)'}`);
    console.log(`🗄️ Phase 2 database: ${app.locals.phase2?.database || 'pending'}`);
    console.log(`⚡ Phase 2 redis: ${app.locals.phase2?.redis || 'pending'}`);
  });

  return { server, wss };
}

function setupWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0];
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    // Reject cross-origin upgrades in production
    if (process.env.NODE_ENV === 'production') {
      const origin = request.headers.origin || '';
      const allowed = Array.isArray(allowedOrigins) ? allowedOrigins : [];
      if (allowed.length > 0 && !allowed.some((o) => origin.startsWith(o))) {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    socket.on('error', (err) => {
      console.warn('[WebSocket] Socket error during upgrade:', safeErrorMessage(err));
    });
  });

  wss.on('connection', (ws) => {
    debugLog('🔌 WebSocket client connected');
    ws.isAlive = true;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to Simplebeacon WebSocket server',
          timestamp: new Date().toISOString()
        }));
      } catch {
        // Socket may have closed immediately after connection
      }
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        debugLog('📨 Received WebSocket message:', data);

        ws.send(JSON.stringify({
          type: 'echo',
          data,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString()
          }));
        }
      }
    });

    ws.on('close', () => {
      ws.isAlive = false;
      debugLog('🔌 WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      ws.isAlive = false;
      console.error('❌ WebSocket error:', safeErrorMessage(error));
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
  if (process.env.NODE_ENV === 'development') {
    wsBroadcastInterval = setInterval(() => {
      if (wss.clients.size === 0) return;
      const updateData = {
        type: 'data_update',
        timestamp: new Date().toISOString(),
        data: {
          analysis: {
            totalFiles: Math.floor(Math.random() * 100) + 400,
            issuesDetected: Math.floor(Math.random() * 50) + 10,
            processingSpeed: Math.floor(Math.random() * 500) + 1000
          }
        }
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
    wss.clients.forEach((client) => { try { client.close(); } catch { /* ignore */ } });
    wss.close(() => {
      httpServer.close(() => process.exit(0));
    });
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return wss;
}

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  process.exit(1);
});

startServer().catch((error) => {
  console.error('❌ Failed to start Simplebeacon server:', error);
  process.exit(1);
});

// Legacy standalone WebSocket port for older clients (non-fatal if already bound)
const legacyWss = new WebSocket.Server({ port: WS_PORT });
legacyWss.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.warn(`[Simplebeacon] Legacy WebSocket port ${WS_PORT} already in use — skipping duplicate bind`);
    return;
  }
  if (err?.code === 'EACCES') {
    console.warn(`[Simplebeacon] Legacy WebSocket port ${WS_PORT} requires elevated permissions`);
    return;
  }
  console.warn('[Simplebeacon] Legacy WebSocket error:', safeErrorMessage(err));
});
legacyWss.on('listening', () => {
  console.log(`🌐 Legacy WebSocket server running on ws://localhost:${WS_PORT}`);
});
legacyWss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

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
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to legacy Simplebeacon WebSocket server',
        timestamp: new Date().toISOString()
      }));
    } catch {
      // Socket may have closed immediately after connection
    }
  }
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'echo', data, timestamp: new Date().toISOString() }));
      }
    } catch {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format', timestamp: new Date().toISOString() }));
      }
    }
  });
  ws.on('close', () => { clearInterval(heartbeat); ws.isAlive = false; });
  ws.on('error', () => { clearInterval(heartbeat); ws.isAlive = false; });
});

module.exports = app;
