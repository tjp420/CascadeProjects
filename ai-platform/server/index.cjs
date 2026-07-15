// simplebeacon-ignore: debugArtifacts
'use strict';

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
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const constants = require('./config/constants.cjs');

// Prefer v1-internal env when present (mirrors simplebeacon-server.cjs)
const v1InternalEnvPath = path.join(__dirname, '..', '.env.v1-internal');
const envPath = process.env.DOTENV_CONFIG_PATH
  || (fs.existsSync(v1InternalEnvPath)
    ? v1InternalEnvPath
    : path.join(__dirname, '..', '.env'));
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const logger = require('./lib/app-logger.cjs');
const { resolveCorsOptions } = require('./lib/cors-config.cjs');

// Import enhanced security middleware
const { 
  createRateLimiter, 
  securityHeaders, 
  requestLogger, 
  ipProtection, 
  securityErrorHandler 
} = require('./middleware/security.cjs');
const { 
  authenticate,
  optionalAuthenticate,
  handleLogin, 
  handleTokenRefresh
} = require('./middleware/auth.cjs');
const { 
  initializeAudit, 
  auditAIOperation, 
  auditSecurity,
  auditDataAccess,
  logSystemEvent,
  logSecurityEvent
} = require('./middleware/audit.cjs');

// Import upload routes and security
const uploadRoutes = require('./routes/upload.cjs');
const { uploadSecurity, contentValidation } = require('./middleware/upload-security.cjs');
const { setupFlexibleAnalyzeAPI } = require('./routes/flexible-analyze-api.cjs');
const { setupAiMathAuditRoute } = require('./routes/ai-math-audit-route.cjs');
const tokenAuthRoutes = require('./routes/token-auth.cjs');
const { setupMockDataAPI } = require('./routes/mock-data-api.cjs');
const { setupChatbotAPI } = require('./routes/chatbot-api.cjs');
const setupLocalModelsAPI = require('./routes/local-models-api.cjs');
const { setupSimplebeaconAPI } = require('../src/api/simplebeacon-api.cjs');
const setupDashboardStubAPIs = require('../src/api/dashboard-stub-api.cjs');
const { setupTrustAPI } = require('../src/api/trust-api.cjs');
const {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes
} = require('../src/api/simplebeacon-billing-api.cjs');
const pathHealthRouter = require('./api/metrics/path-health.cjs');
const { runNpmAuditAsync } = require('./lib/npm-audit-runner.cjs');
const { registerEuAiActSprintRoute } = require('./lib/eu-ai-act-sprint-route.cjs');
const { registerComplianceSchemaRoute } = require('./routes/compliance-schema-api.cjs');
const { setupPrIntegrationAPI } = require('./routes/pr-integration-api.cjs');
const fixOrchestratorRouter = require('./routes/fix-orchestrator-api.cjs');
const ssoRoutes = require('./routes/sso-routes.cjs');
const { setupWorkspaceRoutes, requirePermission, setWorkspaceRlsContext } = require('./lib/rbac.cjs');
const auditLogRouter = require('./routes/audit.cjs');
const authRoutes = require('./routes/auth-routes.cjs');
const DatabaseAdapter = require('./lib/database-adapter.cjs');

const app = express();
app.set('trust proxy', 1); // Trust first proxy hop for rate-limit IP accuracy
let rawPort = process.env.PORT || constants.DEFAULT_PORT;
let PORT = Number.isFinite(Number(rawPort)) && Number(rawPort) > 0 ? Number(rawPort) : constants.DEFAULT_PORT;

// Initialize audit system
initializeAudit().catch(console.error);

// HTTPS redirect for production — respect health checks and local development
app.use((req, res, next) => {
  const isLocalhost = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(req.hostname);
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const publicUrl = process.env.PUBLIC_APP_URL || process.env.SIMPLEBEACON_APP_URL;
  if (!isLocalhost && !isSecure && process.env.NODE_ENV === 'production' && publicUrl) {
    try {
      const target = new URL(req.url, publicUrl).href;
      if (!target.startsWith(publicUrl)) {
        return res.status(400).send('Invalid redirect target');
      }
      return res.redirect(301, target);
    } catch {
      return res.status(400).send('Invalid request URL');
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
app.use('/api/', createRateLimiter({
  max: constants.MAX_RATE_LIMIT // Base rate limit — dashboard fires many concurrent requests on load
}));

// Higher rate limit for analyze endpoints (complete scan makes sequential requests)
app.use('/api/analyze/', createRateLimiter({
  windowMs: constants.RATE_LIMIT_WINDOW_MS,
  max: constants.MAX_ANALYZE_RATE_LIMIT // Allow up to 1000 requests per 15 minutes for scan operations
}));

app.use(cors(resolveCorsOptions({
  devFallbackOrigin: process.env.CORS_ORIGIN || process.env.SIMPLEBEACON_DEV_CORS_ORIGIN
})));

// Billing webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);

app.use(express.json({ limit: constants.safeJsonLimit(process.env.EXPRESS_JSON_LIMIT) }));
app.use(express.urlencoded({ extended: true }));

const comingSoonRoot = path.join(__dirname, '../../coming-soon');
const webRoot = path.join(__dirname, '../web');
const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true';

// Refuse to start internal dashboard without a vault password in non-dev environments
if (internalDashboard && !process.env.DASHBOARD_VAULT_PASSWORD && process.env.NODE_ENV !== 'development') {
  throw new Error('DASHBOARD_VAULT_PASSWORD is required when SIMPLEBEACON_INTERNAL_DASHBOARD=true in non-development environments');
}

const {
  isVaultAuthenticated: checkVaultAuthenticated,
  isProtectedDashboardPath,
  setVaultSessionCookie
} = require('./lib/dashboard-vault-auth.cjs');

/**
 * Is vault authenticated.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, {
    internalDashboard: internalDashboard || Boolean(process.env.DASHBOARD_VAULT_PASSWORD),
    vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD
  });
}

/**
 * Send coming soon index.
 * @param {Object} res
 * @returns {void}
 */
function sendComingSoonIndex(res) {
  res.sendFile(path.join(comingSoonRoot, 'index.html'));
}

const dashboardPath = path.join(webRoot, 'simplebeacon-dashboard/index.html');
let cachedDashboardHtml = null;
try {
  cachedDashboardHtml = fs.readFileSync(dashboardPath, 'utf8');
} catch {
  cachedDashboardHtml = null;
}

/**
 * Load dashboard html.
 * @returns {string|null}
 */
function loadDashboardHtml() {
  try {
    return fs.readFileSync(dashboardPath, 'utf8');
  } catch {
    return cachedDashboardHtml;
  }
}

/**
 * Send simplebeacon dashboard.
 * @param {Object} res
 * @returns {void}
 */
function sendSimplebeaconDashboard(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const html = loadDashboardHtml();
  if (html === null) {
    return res.status(404).send('Simplebeacon dashboard not found');
  }

  // Automatically set vault cookie for smooth dev experience
  if (process.env.DASHBOARD_VAULT_PASSWORD) {
    setVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
  }

  res.send(html);
}

// Public storefront — same paywall as simplebeacon.ai (coming-soon/)
// When internalDashboard is enabled, serve the dashboard instead of the landing page
app.get('/', createRateLimiter({ max: 300 }), (req, res) => {
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  sendComingSoonIndex(res);
});
app.get(['/landing', '/landing/'], (req, res) => {
  if (internalDashboard) {
    return sendSimplebeaconDashboard(res);
  }
  sendComingSoonIndex(res);
});
app.get('/sample-report', (req, res) => {
  res.sendFile(path.join(comingSoonRoot, 'sample-report.html'));
});

const VAULT_AUTH_EXACT_PATHS = new Set([
  '/api/health',
  '/api/theme',
  '/api/platform/status',
  '/api/security/npm-audit',
  '/api/reports/upload',
  '/api/analyze',
  '/api/free-token',
  '/api/tokens/sandbox'
]);

const VAULT_AUTH_PREFIX_PATHS = [
  '/api/simplebeacon/billing/webhook',
  '/api/simplebeacon/billing',
  '/api/simplebeacon/scan',
  '/api/simplebeacon/report',
  '/api/simplebeacon/baseline',
  '/api/simplebeacon/config',
  '/api/simplebeacon/history',
  '/api/simplebeacon/user',
  '/api/simplebeacon/entitlements',
  '/api/chatbot/',
  '/api/auth/',
  '/api/dev-tools/',
  '/api/coverage-reports/',
  '/api/dashboard-home',
  '/api/help',
  '/api/quality/',
  '/api/security/',
  '/api/optimization/',
  '/api/analyze/',
  '/api/operator/',
  '/api/reports/status/'
];

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') return next();
  if (!process.env.DASHBOARD_VAULT_PASSWORD) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (VAULT_AUTH_EXACT_PATHS.has(req.path)) return next();
  for (const prefix of VAULT_AUTH_PREFIX_PATHS) {
    if (req.path.startsWith(prefix)) return next();
  }
  if (isVaultAuthenticated(req)) return next();
  return res.status(403).json({
    error: 'vault_required',
    message: 'Internal dashboard requires vault authentication.'
  });
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') return next();
  if (!process.env.DASHBOARD_VAULT_PASSWORD) return next();
  if (!isProtectedDashboardPath(req.path)) return next();
  if (isVaultAuthenticated(req)) return next();
  return res.redirect(302, '/');
});

// Private dashboard — unlocks vault session, then opens the marketing sample report
app.get('/private-dashboard-vault', async (req, res) => {
  try {
    const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
    if (!vaultPassword || req.query.password !== vaultPassword) {
      return res.status(403).send('Unauthorized Access: Private Vault is Locked.');
    }
    setVaultSessionCookie(res, vaultPassword);
    const samplePath = path.join(comingSoonRoot, 'sample-report.html');
    try {
      await fs.promises.access(samplePath);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.sendFile(samplePath);
    } catch {
      return res.status(404).send('sample-report.html not found — run: cd ai-platform && npm run build:sample-report');
    }
  } catch (err) {
    logger.error('[private-dashboard-vault] error:', err.message);
    return res.status(500).send('Internal server error');
  }
});

// Storefront static assets — serve marketing site from root
app.use('/', express.static(comingSoonRoot, { index: false }));

// Prevent browser caching of dashboard HTML/JS so updated client code always loads
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Dashboard-specific asset routes (serve from web/simplebeacon-dashboard/)
const dashDir = path.join(webRoot, 'simplebeacon-dashboard');
// JS module directories — disable etag to prevent Firefox from reusing stale cached versions
const noStoreStatic = (dir) => express.static(dir, {
  etag: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Vary', '*');
    }
  }
});

app.use('/js-es2018', noStoreStatic(path.join(dashDir, 'js-es2018')));
app.use('/js', noStoreStatic(path.join(dashDir, 'js')));
app.use('/dashboard/js-es2018', noStoreStatic(path.join(dashDir, 'js-es2018')));
app.use('/dashboard/js', noStoreStatic(path.join(dashDir, 'js')));
for (const p of ['/css', '/images', '/fonts', '/assets']) {
  app.use(p, express.static(path.join(dashDir, p.substring(1))));
}
// Also serve under /dashboard/ prefix so relative paths work for /dashboard/* routes
for (const p of ['/dashboard/css', '/dashboard/images', '/dashboard/fonts', '/dashboard/assets']) {
  const sub = p.replace('/dashboard/', '');
  app.use(p, express.static(path.join(dashDir, sub)));
}
app.use('/site-config.js', express.static(path.join(dashDir, 'site-config.js')));

// Fallback: serve coming-soon assets from root for pages served under /coming-soon/
for (const p of ['/css', '/js', '/images', '/fonts', '/assets']) {
  app.use(p, express.static(path.join(comingSoonRoot, p.substring(1))));
}

// Public data files (e.g. trust-verification.json)
const publicDir = path.join(__dirname, '..', 'public');
app.use('/public', express.static(publicDir, { index: false }));

// Inject runtime configuration into dashboard HTML
// This route MUST come before catch-all static middleware
app.get(['/simplebeacon-dashboard', '/simplebeacon-dashboard/', '/simplebeacon-dashboard/index.html'], async (req, res) => {
  const indexPath = path.join(webRoot, 'simplebeacon-dashboard', 'index.html');
  let html;
  try {
    html = await fs.promises.readFile(indexPath, 'utf8');
  } catch {
    return res.status(404).send('index.html not found');
  }

  const runtimeConfig = JSON.stringify({
    DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || `http://localhost:${PORT}`,
    OLLAMA_DEFAULT_URL: process.env.OLLAMA_DEFAULT_URL || `http://127.0.0.1:${constants.OLLAMA_PORT}` // simplebeacon-ignore hardcoded-url — default Ollama localhost URL for client-side settings
  });
  const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
  html = html.replace('<head>', `<head>${injectScript}`);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(html);
});

// SPA fallback for dashboard sub-routes (e.g. /simplebeacon-dashboard/analyze)
app.get('/simplebeacon-dashboard/*', async (req, res) => {
  const indexPath = path.join(webRoot, 'simplebeacon-dashboard', 'index.html');
  let html;
  try {
    html = await fs.promises.readFile(indexPath, 'utf8');
  } catch {
    return res.status(404).send('index.html not found');
  }
  const runtimeConfig = JSON.stringify({
    DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || `http://localhost:${PORT}`,
    OLLAMA_DEFAULT_URL: process.env.OLLAMA_DEFAULT_URL || `http://127.0.0.1:${constants.OLLAMA_PORT}`
  });
  const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
  html = html.replace('<head>', `<head>${injectScript}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(html);
});

// Compatibility: also serve dashboard at /dashboard (legacy simplebeacon-server.cjs path)
app.get(['/dashboard', '/dashboard/'], async (req, res) => {
  const indexPath = path.join(webRoot, 'simplebeacon-dashboard', 'index.html');
  let html;
  try {
    html = await fs.promises.readFile(indexPath, 'utf8');
  } catch {
    return res.status(404).send('index.html not found');
  }
  const runtimeConfig = JSON.stringify({
    DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || `http://localhost:${PORT}`,
    OLLAMA_DEFAULT_URL: process.env.OLLAMA_DEFAULT_URL || `http://127.0.0.1:${constants.OLLAMA_PORT}`
  });
  const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
  html = html.replace('<head>', `<head>${injectScript}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(html);
});

// SPA fallback for /dashboard/* sub-routes
app.get('/dashboard/*', async (req, res) => {
  const indexPath = path.join(webRoot, 'simplebeacon-dashboard', 'index.html');
  let html;
  try {
    html = await fs.promises.readFile(indexPath, 'utf8');
  } catch {
    return res.status(404).send('index.html not found');
  }
  const runtimeConfig = JSON.stringify({
    DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || `http://localhost:${PORT}`,
    OLLAMA_DEFAULT_URL: process.env.OLLAMA_DEFAULT_URL || `http://127.0.0.1:${constants.OLLAMA_PORT}`
  });
  const injectScript = `<script>window.__SIMPLEBEACON_ENV__=${runtimeConfig};</script>`;
  html = html.replace('<head>', `<head>${injectScript}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(html);
});

// Dashboard / web assets (vault-gated when DASHBOARD_VAULT_PASSWORD is set)
// Must come AFTER specific routes so it only serves unmatched paths
const _webRootStatic = express.static(webRoot, { index: false });
app.use((req, res, next) => {
  const skipVault = !process.env.DASHBOARD_VAULT_PASSWORD || process.env.NODE_ENV === 'development';
  if (skipVault) {
    return _webRootStatic(req, res, next);
  }
  if (isProtectedDashboardPath(req.path) && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return _webRootStatic(req, res, next);
});
app.use('/assets', express.static(path.join(webRoot, 'assets')));

// Health, status, and VS Code heartbeat routes
app.use('/api', require('./routes/health-routes.cjs'));

// Meta routes — project structure, releases, backlog
app.use('/api', require('./routes/meta-routes.cjs'));

// Mock data API routes
setupMockDataAPI(app, { baseDir: path.join(__dirname, '..') });

// Authentication routes (login, register, refresh, token status, sandbox)
app.use('/api', require('./routes/auth-inline-routes.cjs'));

// Token authentication routes (TAS-1.0 flat capability mesh)
app.use('/auth', tokenAuthRoutes);

// Protected API routes with audit logging
app.use('/api/mock-analysis', auditAIOperation);
app.use('/api/project-structure', auditDataAccess);
app.use('/api/security', auditSecurity);

app.post('/api/security/npm-audit', async (req, res) => {
  try {
    const platformRoot = path.join(__dirname, '..');
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
      error: (error && typeof error.message === 'string') ? error.message : constants.safeString(error)
    });
  }
});

// Flexible analyze API — codebase scan and inventory (shared path-safety with simplebeacon-server)
// Proxy legacy bare POST /api/analyze to the flexible analysis endpoint.
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/api/analyze') {
        req.url = '/api/analyze/flexible';
    }
    next();
});

const platformRoot = path.join(__dirname, '..');
setupFlexibleAnalyzeAPI(app, {
    baseDir: platformRoot,
    monorepoRoot: path.join(platformRoot, '..')
});

// AI Math Audit route — deterministic model-log analysis
setupAiMathAuditRoute(app, platformRoot);

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

// Theme endpoint for the dashboard to poll the server-side default theme.
app.get('/api/theme', (_req, res) => {
    res.json({ theme: process.env.DEFAULT_THEME || 'dark' });
});

// Chatbot API — AI-powered code assistance
setupChatbotAPI(app);

// Stub endpoints for dashboard client features not available in local dev
// Note: /api/chatbot/providers is handled by setupChatbotAPI using actual provider credentials.
app.get('/api/prompts/get', (_req, res) => res.json({ prompts: [], userId: _req.query.userId || 'anonymous' }));
app.get('/data/re-attestation-metadata.json', (_req, res) => res.json({ attestations: [], generatedAt: new Date().toISOString() }));

// Local models API — Ollama and local model management
setupLocalModelsAPI(app, {
    baseDir: platformRoot
});

// Workspace API — multi-tenant with RLS transaction guardrails
// Only mount if database is configured; otherwise skip gracefully
const { isDatabaseEnabled, getDatabaseConfig } = require('./config/database.cjs');
if (isDatabaseEnabled()) {
    try {
        const dbAdapter = new DatabaseAdapter(getDatabaseConfig());
        app.use('/api/workspaces', authenticate, setupWorkspaceRoutes(dbAdapter));
        logger.info('[Workspaces] RLS workspace routes mounted at /api/workspaces');
    } catch (e) {
        logger.warn('[Workspaces] Database not configured — workspace routes skipped:', e.message);
    }
} else {
    logger.info('[Workspaces] Database disabled — workspace routes not mounted');
}

// FixOrchestrator 2.0 — auto-remediation preview / apply
// Mounted with auth + RBAC + RLS transaction guardrails
const fixoDbAdapter = isDatabaseEnabled() ? new DatabaseAdapter(getDatabaseConfig()) : null;
app.use('/api/v2/fixes', authenticate, requirePermission('remediation:write'), (req, res, next) => {
    if (fixoDbAdapter) req.db = fixoDbAdapter;
    next();
}, setWorkspaceRlsContext, fixOrchestratorRouter);
logger.info('[FixOrchestrator] RLS-scoped routes mounted at /api/v2/fixes');

// Simplebeacon dashboard API — scan report, baseline, config, history
// Authenticate vault sessions for user routes so req.user is populated
app.use('/api/simplebeacon/user', authenticate);
try {
    setupSimplebeaconAPI(app);
} catch (e) {
    console.warn('[Simplebeacon] simplebeacon-api setup skipped:', e.message);
}

// Audit log retrieval API — paginated, strict memory limits (default LIMIT 50, max 200)
app.use('/api/v2/audit', auditLogRouter);

// Auth rotation & blocklist routes
app.use('/api/v2/auth', authRoutes);

// Enterprise SSO — SAML + OIDC callbacks
app.use('/api/v2/auth/sso', ssoRoutes);
logger.info('[SSO] Enterprise SSO routes mounted at /api/v2/auth/sso');

// Dashboard stub APIs — dashboard-home, dev-tools, coverage-reports, security, quality, help
try {
    setupDashboardStubAPIs(app, webRoot, { authMiddleware: optionalAuthenticate });
} catch (e) {
    console.warn('[Simplebeacon] dashboard-stub-api setup skipped:', e.message);
}

// Optimization API
try {
    require('../src/api/optimization-api.cjs').setupOptimizationAPI(app, { platformRoot: path.join(__dirname, '..'), monorepoRoot: path.join(__dirname, '../..') });
} catch (e) {
    console.warn('[Simplebeacon] optimization-api setup skipped:', e.message);
}

// Trust verification API
// Public trust endpoints served without auth for badge/verify/verification
// Gate-protected endpoints require authenticate middleware
try {
    setupTrustAPI(app, { platformRoot: path.join(__dirname, '..'), monorepoRoot: path.join(__dirname, '../..') });
} catch (e) {
    console.warn('[Simplebeacon] trust-api setup skipped:', e.message);
}

// EU AI Act sprint route
try {
    registerEuAiActSprintRoute(app, { projectRoot: path.join(__dirname, '..') });
} catch (e) {
    console.warn('[Simplebeacon] EU AI Act sprint route setup skipped:', e.message);
}

// Simplebeacon billing — checkout, subscription status, license tokens
try {
    setupSimplebeaconBillingRoutes(app);
} catch (e) {
    console.warn('[Simplebeacon] billing routes setup skipped:', e.message);
}

// Public compliance schema endpoint — no auth, no project access, no code upload
try {
    registerComplianceSchemaRoute(app);
} catch (e) {
    console.warn('[Simplebeacon] Compliance schema route setup skipped:', e.message);
}

// PR integration API — secure GitHub Action report ingestion
try {
    setupPrIntegrationAPI(app);
} catch (e) {
    console.warn('[Simplebeacon] PR integration API setup skipped:', e.message);
}

// Free token routes — community/sandbox token generation from coming-soon
try {
    const freeTokenRouter = require('../../coming-soon/dist/routes/free-token.cjs');
    app.use(freeTokenRouter);
} catch {
    try {
        const freeTokenRoutes = require('../../coming-soon/routes/free-token.cjs');
        app.use(freeTokenRoutes);
    } catch (e) {
        console.warn('[FreeToken] free-token routes not loaded');
    }
}

// Health probe endpoint (used by browser integrations)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Agent routes — AI execution status
app.use('/api', require('./routes/agent-routes.cjs'));

// Path health metrics API
app.use('/api/metrics/path-health', pathHealthRouter);

// Custom prompt service (user-defined analysis prompts)
try {
    const promptService = require('./services/prompt-service.cjs');
    app.use('/api/prompts', promptService);
} catch (e) {
    console.warn('[PromptService] prompt-service routes not loaded');
}

// Upload API disabled — source code never leaves your machine per privacy promise.
// To re-enable: uncomment the next line.
// app.use('/api/upload', optionalAuthenticate, uploadSecurity, contentValidation, uploadRoutes);

// AI Context routes — scan data + notes to .simplebeacon/ai-context.md
app.use('/api', require('./routes/ai-context-routes.cjs'));

// Static file serving for saved scan data exports
app.use('/data', express.static(path.join(__dirname, '../web/data'), { index: false }));

// Static file serving for JavaScript files
app.use('/src', express.static(path.join(__dirname, '../src'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Enhanced error handling with security
app.use(securityErrorHandler);
app.use((err, req, res, _next) => {
  const safeErr = constants.safeString(err);
  const stack = err && typeof err.stack === 'string' ? err.stack : safeErr;
  console.error(stack);

  // Log security-related errors
  const status = (err && typeof err.status === 'number' && Number.isFinite(err.status)) ? err.status : 500;
  if (status >= 400) {
    logSecurityEvent('application_error', {
      error: err && typeof err.message === 'string' ? err.message : safeErr,
      stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    }, req.user, req);
  }

  res.status(status).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? (err && typeof err.message === 'string' ? err.message : safeErr) : 'Internal server error',
    requestId: req.requestId || req.id || 'unknown'
  });
});

// 404 handler with audit logging
app.use('*', (req, res) => {
  logSecurityEvent('route_not_found', {
    url: req.originalUrl,
    method: req.method
  }, req.user, req);
  
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    requestId: req.requestId || req.id || 'unknown'
  });
});

const { createStartupManager } = require('./lib/server-startup.cjs');
const startup = createStartupManager({ app, logger, logSystemEvent, constants });
startup.startServer(Number(PORT), constants.MAX_RETRIES, (port) => { PORT = port; });

module.exports = app;
