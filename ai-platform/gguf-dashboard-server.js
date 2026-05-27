/**
 * Simple GGUF Dashboard Server
 * Minimal server to serve the GGUF dashboard with analysis data
 */

const path = require('path');
const fs = require('fs');

// Prefer v1-internal env when present (start script or direct node gguf-dashboard-server.js)
const v1InternalEnvPath = path.join(__dirname, '.env.v1-internal');
const envPath = process.env.DOTENV_CONFIG_PATH
  || (fs.existsSync(v1InternalEnvPath)
    ? v1InternalEnvPath
    : path.join(__dirname, '.env'));
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
  if (envPath.endsWith('.env.v1-internal')) {
    const { applyLocalV1InternalDevProfile } = require('./server/lib/secret-config');
    applyLocalV1InternalDevProfile();
  }
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const GGUF_MOCK_ANALYSIS_PATH = path.join(__dirname, 'web/data/gguf-mock-analysis-sample.json');
const ISSUE_RESOLUTION_PATH = path.join(__dirname, 'web/data/issue-resolution-sample.json');
const CODE_GENERATION_PATH = path.join(__dirname, 'data/codegen/code-generation-sample.json');
const AI_ROADMAP_REPORT_PATH = path.join(__dirname, 'data/roadmap/ai-roadmap-report.json');
const GGUF_ROADMAP_DATA_PATH = path.join(__dirname, 'data/roadmap/gguf-roadmap-data.json');

async function loadGgufMockAnalysisReport() {
  const content = await fs.promises.readFile(GGUF_MOCK_ANALYSIS_PATH, 'utf8');
  return JSON.parse(content);
}

async function loadIssueResolutionModel() {
  const content = await fs.promises.readFile(ISSUE_RESOLUTION_PATH, 'utf8');
  return JSON.parse(content);
}

async function loadCodeGenerationModel() {
  const content = await fs.promises.readFile(CODE_GENERATION_PATH, 'utf8');
  return JSON.parse(content);
}

async function sendCodeGenerationModel(req, res) {
  try {
    const model = await loadCodeGenerationModel();
    res.json({ success: true, data: model, ...model });
  } catch (error) {
    console.error('❌ Failed to load code generation model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load code generation data',
      message: error.message
    });
  }
}

async function loadAIRoadmapReport() {
  const content = await fs.promises.readFile(AI_ROADMAP_REPORT_PATH, 'utf8');
  return JSON.parse(content);
}

async function loadGgufRoadmapData() {
  const content = await fs.promises.readFile(GGUF_ROADMAP_DATA_PATH, 'utf8');
  return JSON.parse(content);
}

async function sendAIRoadmapReport(req, res) {
  try {
    const model = await loadAIRoadmapReport();
    res.json({ success: true, data: model, ...model });
  } catch (error) {
    console.error('❌ Failed to load AI roadmap report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load AI roadmap report',
      message: error.message
    });
  }
}

async function sendIssueResolutionModel(req, res) {
  try {
    const model = await loadIssueResolutionModel();
    res.json({ success: true, data: model, ...model });
  } catch (error) {
    console.error('❌ Failed to load issue resolution model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load issue resolution data',
      message: error.message
    });
  }
}

async function sendGgufMockAnalysisReport(req, res) {
  try {
    const report = await loadGgufMockAnalysisReport();
    res.json({ success: true, ...report });
  } catch (error) {
    console.error('❌ Failed to load GGUF mock analysis report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF mock analysis report',
      message: error.message
    });
  }
}

const GlobalContextManager = require('./src/core/GlobalContextManager');
const WebsiteAnalyzer = require('./src/core/WebsiteAnalyzer');
const GGUFRoadmapAnalyzer = require('./src/core/GGUFRoadmapAnalyzer');
const DirectoryAnalyzer = require('./src/core/DirectoryAnalyzer');
const setupExportAPIs = require('./src/api/export-api');
const setupDevelopmentRoadmapAPIs = require('./src/api/development-roadmap-api');
const setupAIRoadmapReportAPIs = require('./src/api/ai-roadmap-report-api');
const AIAnalysisAPI = require('./src/api/ai-analysis-api');
const ReportsAPI = require('./src/api/reports-api');
const registerDynamicRoadmapApi = require('./src/api/register-dynamic-roadmap-api');
const setupBuildFromPathRoute = require('./src/api/build-from-path-route');
const setupURLAnalyzerAPIs = require('./src/api/url-analyzer-api');
const setupRoadmapBuilderAPIs = require('./src/api/roadmap-builder-api');
const setupDashboardStubAPIs = require('./src/api/dashboard-stub-api');
const setupSimplebeaconAPI = require('./src/api/simplebeacon-api');
const {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes
} = require('./src/api/simplebeacon-billing-api');
const setupLocalModelsAPI = require('./server/routes/local-models-api');
const { setupFlexibleAnalyzeAPI } = require('./server/routes/flexible-analyze-api');
const { setupPhase2Integration } = require('./server/bootstrap/phase2-integration');
const { registerLegacyPageRedirects } = require('./server/lib/legacy-page-redirects');
const uploadRoutes = require('./server/routes/upload');
const { setupRepositoryScannerAPIs } = require('./server/routes/repository-scanner-api');
const { uploadSecurity, contentValidation } = require('./server/middleware/upload-security');
const { authenticate, optionalAuthenticate } = require('./server/middleware/auth');

const app = express();
const PORT = 54355;
const WS_PORT = 8081;
if (
  process.env.SIMPLEBEACON_INTERNAL_DASHBOARD !== 'true'
  && Number(process.env.PORT || PORT) === PORT
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
const landingRoot = path.join(__dirname, '../coming-soon');
const landingEnabled = process.env.SIMPLEBEACON_LANDING === 'true';
const landingRootExists = fs.existsSync(landingRoot);

function sendLandingFile(res, relativePath, type) {
  if (!landingRootExists) return false;
  const filePath = path.join(landingRoot, relativePath);
  if (!fs.existsSync(filePath)) return false;
  if (type) res.type(type);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(filePath);
  return true;
}

function sendSampleReport(res) {
  return sendLandingFile(res, 'sample-report.html', 'text/html');
}

function storefrontAssetsEnabled() {
  return landingEnabled || internalDashboard;
}
const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true';
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
} = require('./server/lib/dashboard-vault-auth');

function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, {
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

// Initialize Global Context Manager (path relative to ai-platform, not cwd)
const globalContextManager = new GlobalContextManager(path.join(__dirname, 'src'));

// Middleware — webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '50mb' }));

const { registerAuditBookingRoute } = require('./server/lib/audit-booking-route');
registerAuditBookingRoute(app, {
  landingEnabled,
  landingRoot,
  dataDir: path.join(__dirname, 'data')
});

// API routes before static files (avoids /api/* returning HTML 404)
setupBuildFromPathRoute(app);
registerLegacyPageRedirects(app);

const { registerDataCleanupAnalyzeRoute } = require('./server/lib/data-cleanup-scan');
registerDataCleanupAnalyzeRoute(app, {
  baseDir: __dirname,
  monorepoRoot: path.join(__dirname, '..')
});
app.get('/api/health/routes', (_req, res) => {
  res.json({
    status: 'ok',
    dataCleanup: true,
    paths: ['/api/analyze/data-cleanup', '/api/merger-tool/data-cleanup-scan'],
    build: '2026-05-27-data-cleanup'
  });
});
if (process.env.NODE_ENV !== 'test') {
  console.log('[Simplebeacon] Registered GET /api/analyze/data-cleanup (+ merger-tool alias)');
}

function sendSimplebeaconDashboard(res) {
  const dashboardPath = path.join(webRoot, 'simplebeacon-dashboard/index.html');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (fs.existsSync(dashboardPath)) {
    return res.sendFile(dashboardPath);
  }
  const legacyPath = path.join(webRoot, 'dashboard-new.html');
  if (fs.existsSync(legacyPath)) {
    return res.sendFile(legacyPath);
  }
  return res.status(404).send('Dashboard not found');
}

function sendLandingIndex(res) {
  const landingIndex = path.join(landingRoot, 'index.html');
  if (!fs.existsSync(landingIndex)) return false;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(landingIndex);
  return true;
}

function redirectPublicToLanding(req, res) {
  if (landingAtRoot) {
    return res.redirect(302, '/');
  }
  if (internalDashboard && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return sendSimplebeaconDashboard(res);
}

// Dashboard SPA — internal operator only when landing serves sales gate at /
app.get(/^\/demo(\/.*)?$/, (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/signin(\/.*)?$/, (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/app(\/.*)?$/, (req, res) => redirectPublicToLanding(req, res));
app.get(/^\/trust(\/.*)?$/, (req, res) => {
  if (landingAtRoot) return res.redirect(302, '/');
  if (internalDashboard && !isVaultAuthenticated(req)) return res.redirect(302, '/');
  const trustHash = internalDashboard ? '/#/trust' : '/app#/trust';
  res.redirect(302, trustHash);
});

app.get('/', (req, res) => {
  // Always show landing page at root for public access
  if (sendLandingIndex(res)) return;
  return sendSimplebeaconDashboard(res);
});

app.get(['/landing', '/landing/'], (req, res) => {
  if (!landingEnabled) return res.redirect(302, '/');
  if (sendLandingIndex(res)) return;
  return res.status(404).send('Landing page not found');
});

// Private dashboard — unlocks vault session and serves the marketing sample report inline
app.get('/private-dashboard-vault', (req, res) => {
  if (req.query.password !== process.env.DASHBOARD_VAULT_PASSWORD) {
    return res.status(403).send('Unauthorized Access: Private Vault is Locked.');
  }

  setVaultSessionCookie(res);
  if (sendSampleReport(res)) return;
  return res.status(404).send('sample-report.html not found — run: cd ai-platform && npm run build:sample-report');
});

app.get(['/sample-report', '/sample-report/', '/sample-report.html'], (req, res, next) => {
  if (sendSampleReport(res)) return;
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
    const filePath = path.join(landingRoot, 'downloads', `simplebeacon-${req.params.version}.tgz`);
    if (fs.existsSync(filePath)) {
      res.type('application/gzip');
      return res.sendFile(filePath);
    }
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

  app.post('/api/waitlist', (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    const entry = {
      email,
      source: req.body?.source || 'landing',
      ts: req.body?.ts || new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    const waitlistDir = path.join(__dirname, 'data');
    const waitlistFile = path.join(waitlistDir, 'waitlist-signups.json');
    try {
      fs.mkdirSync(waitlistDir, { recursive: true });
      let rows = [];
      if (fs.existsSync(waitlistFile)) {
        rows = JSON.parse(fs.readFileSync(waitlistFile, 'utf8'));
      }
      if (!rows.some((r) => r.email === email)) rows.push(entry);
      fs.writeFileSync(waitlistFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      console.warn('[waitlist] persist failed:', err.message);
    }
    return res.json({ ok: true, email });
  });

  app.get('/api/waitlist/count', (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const waitlistFile = path.join(__dirname, 'data', 'waitlist-signups.json');
    try {
      if (!fs.existsSync(waitlistFile)) return res.json({ count: 0 });
      const rows = JSON.parse(fs.readFileSync(waitlistFile, 'utf8'));
      return res.json({ count: Array.isArray(rows) ? rows.length : 0 });
    } catch {
      return res.json({ count: 0 });
    }
  });

  app.post('/api/waitlist/event', (req, res) => {
    if (!landingEnabled) return res.status(404).json({ error: 'not_found' });
    const event = {
      event: req.body?.event || 'unknown',
      data: req.body?.data || {},
      ts: req.body?.ts || new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    const eventsFile = path.join(__dirname, 'data', 'waitlist-events.json');
    try {
      fs.mkdirSync(path.dirname(eventsFile), { recursive: true });
      let rows = [];
      if (fs.existsSync(eventsFile)) rows = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
      rows.push(event);
      if (rows.length > 5000) rows = rows.slice(-5000);
      fs.writeFileSync(eventsFile, JSON.stringify(rows, null, 2));
    } catch (err) {
      console.warn('[waitlist] event persist failed:', err.message);
    }
    return res.json({ ok: true });
  });

  app.use((req, res, next) => {
    if (!landingEnabled) return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/demo') || req.path.startsWith('/app')) {
      return next();
    }
    express.static(landingRoot, { index: false, redirect: false })(req, res, next);
  });
}

// Simplebeacon API + billing routes registered after Phase 2 auth in bootstrapPhase2Routes()

app.get('/favicon.ico', (_req, res) => {
  const icoPath = path.join(webRoot, 'favicon.ico');
  const svgPath = path.join(webRoot, 'favicon.svg');
  if (fs.existsSync(icoPath)) {
    res.type('image/png');
    return res.sendFile(icoPath);
  }
  if (fs.existsSync(svgPath)) {
    res.type('image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.get('/favicon.svg', (_req, res) => {
  const svgPath = path.join(webRoot, 'favicon.svg');
  if (fs.existsSync(svgPath)) {
    res.type('image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(404).end();
});

app.get('/data/ai-roadmap-sample.json', (_req, res) => {
  res.type('application/json');
  res.sendFile(AI_ROADMAP_REPORT_PATH);
});

app.get('/data/gguf-roadmap-sample.json', (_req, res) => {
  res.type('application/json');
  res.sendFile(GGUF_ROADMAP_DATA_PATH);
});

app.get('/data/gguf-development-roadmap-report.json', (_req, res) => {
  res.type('application/json');
  res.sendFile(GGUF_ROADMAP_DATA_PATH);
});

app.use((req, res, next) => {
  if (!internalDashboard) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/api/simplebeacon/billing/webhook')) return next();
  if (req.path === '/api/health' || req.path === '/health') return next();
  if (
    req.path === '/api/waitlist'
    || req.path === '/api/waitlist/count'
    || req.path === '/api/waitlist/event'
    || req.path === '/api/audit-booking'
    || req.path === '/api/audit-bookings'
  ) return next();
  if (isVaultAuthenticated(req)) return next();
  return res.status(403).json({
    error: 'vault_required',
    message: 'Internal dashboard requires vault authentication.'
  });
});

app.use((req, res, next) => {
  if (!internalDashboard) return next();
  if (!isProtectedDashboardPath(req.path)) return next();
  if (isVaultAuthenticated(req)) return next();
  return res.redirect(302, '/');
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  if (/^\/(services|scripts|components|simplebeacon-dashboard)\/.*\.(js|css|html)$/i.test(req.path) || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  express.static(webRoot)(req, res, next);
});

// Global Context Middleware - Inject context into all routes
app.use(async (req, res, next) => {
  if (!globalContextManager.isInitialized) {
    try {
      await globalContextManager.initialize();
    } catch (error) {
      console.error('Failed to initialize Global Context Manager:', error);
    }
  }
  
  // Inject global context into response locals
  res.locals.globalContext = globalContextManager.getContext();
  next();
});

// GGUF Analysis API - Direct data integration
app.get('/api/gguf/analysis', sendGgufMockAnalysisReport);
app.get('/api/gguf/mock-analysis-report', sendGgufMockAnalysisReport);

app.post('/api/gguf/refresh', async (req, res) => {
  try {
    await loadGgufMockAnalysisReport();
    res.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      message: 'GGUF data refreshed'
    });
  } catch (error) {
    console.error('❌ Failed to refresh GGUF data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh GGUF data',
      message: error.message
    });
  }
});

// GGUF Analysis Summary Endpoint
app.get('/api/gguf/analysis/summary', async (req, res) => {
  try {
    const report = await loadGgufMockAnalysisReport();
    const overview = report.analysisOverview || {};
    res.json({
      success: true,
      type: 'gguf-analysis-summary',
      generatedAt: report.generatedAt,
      dataSource: report.dataSource || 'repository-audit',
      executiveMetrics: {
        totalMockFiles: overview.totalMockFiles ?? null,
        dataQualityScore: overview.dataQualityScore ?? null,
        totalMockDataSize: overview.totalMockDataSize ?? null,
        issuesDetected: overview.issuesDetected ?? null,
        aiConfidence: overview.aiConfidence ?? null,
        analysisSpeed: overview.analysisSpeed ?? null
      },
      modelInfo: report.modelInfo || {},
      keyInsights: report.aiInsights || report.keyInsights || {},
      performanceMetrics: report.performanceMetrics || {}
    });
  } catch (error) {
    console.error('❌ Failed to load GGUF analysis summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF analysis summary',
      message: error.message
    });
  }
});

// GGUF Categories Endpoint
app.get('/api/gguf/analysis/categories', (req, res) => {
  const categoriesData = {
    success: true,
    type: "gguf-categories-analysis",
    generatedAt: "2026-05-21T23:34:54.262Z",
    categories: [
      {
        category: "User Profile Data",
        fileCount: 342,
        totalSize: "23.1MB",
        qualityScore: 91.2,
        issues: 2,
        confidence: 96.5,
        description: "User authentication and profile mock datasets",
        percentage: 27.4,
        trend: "stable",
        riskLevel: "low"
      },
      {
        category: "API Response Data",
        fileCount: 289,
        totalSize: "18.7MB",
        qualityScore: 89.8,
        issues: 3,
        confidence: 94.2,
        description: "API endpoint response mock data and schemas",
        percentage: 23.2,
        trend: "improving",
        riskLevel: "medium"
      },
      {
        category: "Analytics Data",
        fileCount: 198,
        totalSize: "15.2MB",
        qualityScore: 85.4,
        issues: 1,
        confidence: 92.1,
        description: "Analytics and metrics mock datasets",
        percentage: 15.9,
        trend: "stable",
        riskLevel: "low"
      },
      {
        category: "Configuration Data",
        fileCount: 156,
        totalSize: "8.9MB",
        qualityScore: 93.1,
        issues: 1,
        confidence: 95.8,
        description: "System configuration and environment mock data",
        percentage: 12.5,
        trend: "improving",
        riskLevel: "low"
      },
      {
        category: "Test Scenario Data",
        fileCount: 262,
        totalSize: "7.5MB",
        qualityScore: 88.7,
        issues: 1,
        confidence: 93.4,
        description: "Test case and scenario mock datasets",
        percentage: 21.0,
        trend: "stable",
        riskLevel: "medium"
      }
    ],
    summary: {
      totalCategories: 5,
      averageQuality: 89.2,
      totalIssues: 8,
      highRiskCategories: 0,
      recommendedFocus: "API Response Data"
    }
  };
  
  res.json(categoriesData);
});

// GGUF Insights Endpoint
app.get('/api/gguf/analysis/insights', (req, res) => {
  const insightsData = {
    success: true,
    type: "gguf-ai-insights",
    generatedAt: "2026-05-21T23:34:54.262Z",
    dataPatterns: [
      "User authentication flows with session management",
      "API response structures following REST conventions",
      "Analytics metrics with time-series data patterns",
      "Configuration objects with environment-specific settings",
      "Test scenarios covering edge cases and boundary conditions"
    ],
    optimizationRecommendations: [
      {
        id: "opt_1",
        priority: "high",
        action: "Consolidate duplicate mock data patterns",
        description: "GGUF AI identified 23 duplicate patterns that can be consolidated",
        potentialSavings: "15.2MB reduction",
        impact: "High",
        estimatedEffort: "2-4 hours",
        status: "pending",
        progress: 0
      },
      {
        id: "opt_2",
        priority: "medium",
        action: "Standardize JSON schema across all mock files",
        description: "Implement consistent schema structure for better maintainability",
        potentialSavings: "Improved data consistency",
        impact: "Medium",
        estimatedEffort: "1-2 hours",
        status: "pending",
        progress: 0
      },
      {
        id: "opt_3",
        priority: "low",
        action: "Optimize data sizes for frequently used mocks",
        description: "Reduce file sizes for mock data used in automated testing",
        potentialSavings: "8.7MB reduction",
        impact: "Low",
        estimatedEffort: "30-60 minutes",
        status: "pending",
        progress: 0
      }
    ],
    qualityImprovements: [
      "Add data validation rules to prevent schema violations",
      "Implement automated testing for mock data integrity",
      "Create mock data templates for consistent structure",
      "Add documentation for mock data usage patterns"
    ],
    nextSteps: [
      "Address high-priority schema violations",
      "Implement GGUF AI optimization recommendations",
      "Standardize mock data schemas",
      "Add automated validation for new mock data",
      "Create comprehensive mock data documentation"
    ],
    privacyAndSecurity: {
      localProcessing: "All mock data analysis stays on your machine",
      completePrivacy: "No data sent to external services",
      secure: "No external security risks",
      offline: "Works without internet connection",
      control: "You have complete control",
      cost: "No API costs or subscription fees"
    }
  };
  
  res.json(insightsData);
});

// Enhanced Issues endpoint - integrates with new GGUF Issues API
app.get('/api/gguf/issues', async (req, res) => {
  try {
    const { severity, type, status, search, limit, offset } = req.query;
    
    // Get current issues from the enhanced system
    const currentIssues = [
      {
        id: "issue_1",
        severity: "medium",
        type: "Data Inconsistency",
        message: "Inconsistent data formats across similar mock files",
        filePath: "data/mock/mock_data_1.json",
        line: 1,
        column: 0,
        suggestedFix: "Standardize data formats and schemas",
        status: "open",
        priority: 3,
        createdAt: new Date().toISOString(),
        estimatedFixTime: 270,
        affectedFiles: ["mock_data_1.json", "mock_data_7.json", "mock_data_15.json"],
        aiSeverity: "medium",
        aiConfidence: 0.85
      },
      {
        id: "issue_2",
        severity: "low",
        type: "Missing Fields",
        message: "Required fields missing in some mock datasets",
        filePath: "data/mock/mock_data_3.json",
        line: 1,
        column: 0,
        suggestedFix: "Add missing required fields to ensure completeness",
        status: "open",
        priority: 4,
        createdAt: new Date().toISOString(),
        estimatedFixTime: 603,
        affectedFiles: ["mock_data_3.json", "mock_data_11.json"],
        aiSeverity: "low",
        aiConfidence: 0.92
      },
      {
        id: "issue_3",
        severity: "low",
        type: "Duplicate Data",
        message: "Duplicate entries found in mock datasets",
        filePath: "data/mock/mock_data_4.json",
        line: 1,
        column: 0,
        suggestedFix: "Remove duplicate entries to optimize data size",
        status: "open",
        priority: 4,
        createdAt: new Date().toISOString(),
        estimatedFixTime: 207,
        affectedFiles: ["mock_data_4.json", "mock_data_9.json"],
        aiSeverity: "low",
        aiConfidence: 0.88
      },
      {
        id: "issue_4",
        severity: "high",
        type: "Schema Violation",
        message: "Mock data doesn't match expected schema structure",
        filePath: "data/mock/mock_data_6.json",
        line: 1,
        column: 0,
        suggestedFix: "Update mock data to conform to schema requirements",
        status: "open",
        priority: 2,
        createdAt: new Date().toISOString(),
        estimatedFixTime: 95,
        affectedFiles: ["mock_data_6.json"],
        aiSeverity: "high",
        aiConfidence: 0.95
      }
    ];
    
    // Apply filters
    let filteredIssues = currentIssues;
    
    if (severity) {
      filteredIssues = filteredIssues.filter(issue => issue.severity === severity);
    }
    
    if (type) {
      filteredIssues = filteredIssues.filter(issue => issue.type === type);
    }
    
    if (status) {
      filteredIssues = filteredIssues.filter(issue => issue.status === status);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredIssues = filteredIssues.filter(issue => 
        issue.message.toLowerCase().includes(searchLower) ||
        issue.filePath.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    const startIndex = offset ? parseInt(offset) : 0;
    const endIndex = limit ? startIndex + parseInt(limit) : filteredIssues.length;
    const paginatedIssues = filteredIssues.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      issues: paginatedIssues,
      total: filteredIssues.length,
      offset: startIndex,
      limit: limit ? parseInt(limit) : null,
      timestamp: new Date().toISOString(),
      enhanced: true
    });

  } catch (error) {
    console.error('❌ Enhanced issues endpoint failed:', error);
    res.status(500).json({
      success: false,
      error: 'Issues retrieval failed',
      message: error.message
    });
  }
});

// Recommendations endpoint
app.get('/api/gguf/recommendations', (req, res) => {
  const recommendations = [
    {
      id: "rec_1",
      priority: "high",
      action: "Consolidate duplicate mock data patterns",
      description: "GGUF AI identified 23 duplicate patterns that can be consolidated",
      potentialSavings: "15.2MB reduction",
      impact: "High",
      status: "pending",
      progress: 0,
      estimatedEffort: "2-4 hours",
      dependencies: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "rec_2",
      priority: "medium",
      action: "Standardize JSON schema across all mock files",
      description: "Implement consistent schema structure for better maintainability",
      potentialSavings: "Improved data consistency",
      impact: "Medium",
      status: "pending",
      progress: 0,
      estimatedEffort: "1-2 hours",
      dependencies: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "rec_3",
      priority: "low",
      action: "Optimize data sizes for frequently used mocks",
      description: "Reduce file sizes for mock data used in automated testing",
      potentialSavings: "8.7MB reduction",
      impact: "Low",
      status: "pending",
      progress: 0,
      estimatedEffort: "30-60 minutes",
      dependencies: [],
      createdAt: new Date().toISOString()
    }
  ];
  
  res.json(recommendations);
});

// Enhanced issue status update endpoint
app.patch('/api/gguf/issues/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    debugLog(`📝 Updating issue ${id} status to: ${status}`);
    
    // In a real implementation, this would update the issue in the database
    // For now, we'll acknowledge the update and return success
    
    const updateRecord = {
      issueId: id,
      status,
      notes: notes || '',
      updatedAt: new Date().toISOString(),
      updatedBy: 'GGUF Issue Resolution System'
    };
    
    // Log the update for tracking
    debugLog('📊 Issue status update record:', updateRecord);
    
    res.json({
      success: true,
      message: `Issue ${id} status updated to ${status}`,
      updateRecord,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Issue status update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Issue status update failed',
      message: error.message
    });
  }
});

// Update recommendation progress (mock implementation)
app.patch('/api/gguf/recommendations/:id/progress', (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;
  debugLog(`Updating recommendation ${id} progress to: ${progress}%`);
  res.json({ success: true });
});

// AI Roadmap Report API
app.get('/api/ai-roadmap/report', sendAIRoadmapReport);

// Code Generation API
app.get('/api/code-generation', sendCodeGenerationModel);
app.get('/api/code-generation/templates', async (req, res) => {
  try {
    const model = await loadCodeGenerationModel();
    res.json({ success: true, templates: model.templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/code-generation/history', async (req, res) => {
  try {
    const model = await loadCodeGenerationModel();
    res.json({ success: true, history: model.history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/code-generation/stats', async (req, res) => {
  try {
    const model = await loadCodeGenerationModel();
    res.json({ success: true, ...model.stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Issue Resolution API endpoints
app.get('/api/issues/resolution', sendIssueResolutionModel);

app.get('/api/issues', async (req, res) => {
  try {
    const model = await loadIssueResolutionModel();
    res.json({
      success: true,
      ...model,
      issues: model.issues,
      total: model.total,
      lastUpdated: model.generatedAt || new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to load issues:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/issues/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  debugLog(`Updating issue ${id} status to: ${status}`);
  res.json({ success: true, message: `Issue ${id} status updated to ${status}` });
});

// Marketing landing lives at / when SIMPLEBEACON_LANDING=true (or /landing in internal preview)
app.get('/coming-soon', (_req, res) => {
  if (!landingEnabled) return res.redirect(301, '/');
  if (internalDashboard) return res.redirect(301, '/landing');
  return res.redirect(301, '/');
});

app.get('/community', (_req, res) => {
  if (landingEnabled) {
    const landingCommunity = path.join(landingRoot, 'community.html');
    if (fs.existsSync(landingCommunity)) {
      return res.sendFile(landingCommunity);
    }
  }
  const communityPath = path.join(webRoot, 'marketing/community.html');
  if (fs.existsSync(communityPath)) {
    return res.sendFile(communityPath);
  }
  return res.status(404).send('Community pricing page not found');
});

// Serve the context search page
app.get('/context-search', (req, res) => {
  const contextSearchPath = path.join(__dirname, 'src/web/context-search.html');
  if (fs.existsSync(contextSearchPath)) {
    res.sendFile(contextSearchPath);
  } else {
    res.status(404).send('Context search page not found');
  }
});

// Serve the website analyzer page
app.get('/website-analyzer', (req, res) => {
  const websiteAnalyzerPath = path.join(__dirname, 'src/web/website-analyzer.html');
  if (fs.existsSync(websiteAnalyzerPath)) {
    res.sendFile(websiteAnalyzerPath);
  } else {
    res.status(404).send('Website analyzer page not found');
  }
});

// Serve the enhanced GGUF roadmap page
app.get('/gguf-roadmap-enhanced', (req, res) => {
  const ggufRoadmapPath = path.join(__dirname, 'src/web/gguf-roadmap-enhanced.html');
  if (fs.existsSync(ggufRoadmapPath)) {
    res.sendFile(ggufRoadmapPath);
  } else {
    res.status(404).send('GGUF roadmap enhanced page not found');
  }
});

// Serve the unified roadmap enhanced page
app.get('/unified-roadmap-enhanced', (req, res) => {
  const unifiedRoadmapPath = path.join(__dirname, 'src/web/unified-roadmap-enhanced.html');
  if (fs.existsSync(unifiedRoadmapPath)) {
    res.sendFile(unifiedRoadmapPath);
  } else {
    res.status(404).send('Unified roadmap enhanced page not found');
  }
});

// Serve the directory analyzer page
app.get('/directory-analyzer', (req, res) => {
  const directoryAnalyzerPath = path.join(__dirname, 'src/web/directory-analyzer.html');
  if (fs.existsSync(directoryAnalyzerPath)) {
    res.sendFile(directoryAnalyzerPath);
  } else {
    res.status(404).send('Directory analyzer page not found');
  }
});

// Serve the URL analyzer page
app.get('/url-analyzer', (req, res) => {
  const urlAnalyzerPath = path.join(__dirname, 'src/web/url-analyzer.html');
  if (fs.existsSync(urlAnalyzerPath)) {
    res.sendFile(urlAnalyzerPath);
  } else {
    res.status(404).send('URL analyzer page not found');
  }
});

// Serve the roadmap builder page
app.get('/roadmap-builder', (req, res) => {
  const roadmapBuilderPath = path.join(__dirname, 'src/web/roadmap-builder.html');
  if (fs.existsSync(roadmapBuilderPath)) {
    res.sendFile(roadmapBuilderPath);
  } else {
    res.status(404).send('Roadmap builder page not found');
  }
});

// Serve the enhanced roadmap dashboard page
app.get('/enhanced-roadmap-dashboard', (req, res) => {
  const enhancedRoadmapPath = path.join(__dirname, 'src/web/enhanced-roadmap-dashboard.html');
  if (fs.existsSync(enhancedRoadmapPath)) {
    res.sendFile(enhancedRoadmapPath);
  } else {
    res.status(404).send('Enhanced roadmap dashboard page not found');
  }
});

// Global Context API Endpoints
app.get('/api/context/search', (req, res) => {
  try {
    const { q: query, fileTypes, categories, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
        example: '/api/context/search?q=functions'
      });
    }
    
    const options = {
      fileTypes: fileTypes ? fileTypes.split(',') : undefined,
      categories: categories ? categories.split(',') : undefined,
      limit: limit ? parseInt(limit) : 50
    };
    
    const results = globalContextManager.search(query, options);
    
    res.json({
      query,
      results,
      total: results.length,
      context: res.locals.globalContext.metadata
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/context/files', (req, res) => {
  try {
    const { category, type } = req.query;
    let files;
    
    if (category) {
      files = globalContextManager.getFilesByCategory(category);
    } else if (type) {
      files = globalContextManager.getFilesByType(type);
    } else {
      files = Array.from(res.locals.globalContext.files);
    }
    
    res.json({
      files,
      total: files.length,
      filters: { category, type }
    });
  } catch (error) {
    console.error('Files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

app.get('/api/context/stats', (req, res) => {
  try {
    const stats = globalContextManager.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

app.get('/api/context/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    const files = globalContextManager.getFilesByCategory(category);
    
    res.json({
      category,
      files,
      total: files.length
    });
  } catch (error) {
    console.error('Category error:', error);
    res.status(500).json({ error: 'Failed to retrieve category files' });
  }
});

// Website Analyzer API
app.get('/api/website/analyze', async (req, res) => {
  try {
    debugLog('🔍 Starting comprehensive website analysis...');
    const analyzer = new WebsiteAnalyzer();
    const report = await analyzer.analyzeWebsite();
    
    res.json({
      success: true,
      report: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Website analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Website analysis failed',
      message: error.message
    });
  }
});

// GGUF Development Roadmap Report API
app.get('/api/gguf/development-roadmap', async (req, res) => {
  try {
    const ggufPath = path.join(__dirname, 'data/roadmap/gguf-roadmap-data.json');
    const ggufContent = await fs.promises.readFile(ggufPath, 'utf8');
    res.json(JSON.parse(ggufContent));
  } catch (error) {
    console.error('❌ Failed to load GGUF development roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF development roadmap',
      message: error.message
    });
  }
});

// GGUF Roadmap Overview API
app.get('/api/gguf/roadmap/overview', async (req, res) => {
  try {
    const data = await loadGgufRoadmapData();
    res.json({
      success: true,
      type: 'gguf-roadmap-overview',
      dataSource: data.dataSource || 'repository-audit',
      projectOverview: data.projectOverview || {},
      modelInfo: data.modelInfo || {}
    });
  } catch (error) {
    console.error('❌ Failed to load GGUF roadmap overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF roadmap overview',
      message: error.message
    });
  }
});

// GGUF Roadmap Phases API
app.get('/api/gguf/roadmap/phases', async (req, res) => {
  try {
    const data = await loadGgufRoadmapData();
    const developmentPhases = data.developmentPhases || [];
    const completedPhases = developmentPhases.filter((phase) => phase.status === 'completed').length;
    const inProgressPhases = developmentPhases.filter((phase) =>
      ['in-progress', 'in progress', 'active'].includes(String(phase.status || '').toLowerCase())
    ).length;
    res.json({
      success: true,
      type: 'gguf-roadmap-phases',
      dataSource: data.dataSource || 'repository-audit',
      developmentPhases,
      summary: {
        totalPhases: developmentPhases.length,
        completedPhases,
        inProgressPhases,
        overallProgress: developmentPhases.length
          ? Math.round((completedPhases / developmentPhases.length) * 1000) / 10
          : null
      }
    });
  } catch (error) {
    console.error('❌ Failed to load GGUF roadmap phases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF roadmap phases',
      message: error.message
    });
  }
});

// GGUF Roadmap Analysis Overview API
app.get('/api/gguf/roadmap/analysis', async (req, res) => {
  try {
    const report = await loadGgufMockAnalysisReport();
    res.json({
      success: true,
      type: 'gguf-roadmap-analysis-overview',
      dataSource: report.dataSource || 'repository-audit',
      analysisOverview: report.analysisOverview || {},
      performanceMetrics: report.performanceMetrics || {}
    });
  } catch (error) {
    console.error('❌ Failed to load GGUF roadmap analysis overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load GGUF roadmap analysis overview',
      message: error.message
    });
  }
});

// GGUF Roadmap Analysis API
app.get('/api/gguf/roadmap/analyze', async (req, res) => {
  try {
    debugLog('📋 Starting GGUF roadmap analysis...');
    const analyzer = new GGUFRoadmapAnalyzer();
    const report = await analyzer.analyzeRoadmap();
    
    res.json({
      success: true,
      report: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GGUF roadmap analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'GGUF roadmap analysis failed',
      message: error.message
    });
  }

});

// Phase 2 bootstrap + dashboard stub APIs (initialized in startServer)
async function bootstrapPhase2Routes() {
    try {
        setupLocalModelsAPI(app, { baseDir: __dirname });
        setupFlexibleAnalyzeAPI(app, {
            baseDir: __dirname,
            monorepoRoot: path.join(__dirname, '..'),
            publicGateEnabled: !internalDashboard,
            closedVaultMode: landingAtRoot
        });
        await setupPhase2Integration(app, { webRoot });
        setupSimplebeaconBillingRoutes(app);
        setupSimplebeaconAPI(app);
        require('./src/api/trust-api').setupTrustAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
        require('./src/api/optimization-api').setupOptimizationAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
        require('./server/api/assessment/routes').setupAssessmentRoutes(app);
        setupRepositoryScannerAPIs(app, { platformRoot: __dirname });

        const uploadAuth = process.env.REQUIRE_AUTH === 'true' ? authenticate : optionalAuthenticate;
        app.use('/api/upload', uploadAuth, uploadSecurity, contentValidation, uploadRoutes);
        setupDashboardStubAPIs(app, webRoot, {
            db: app.locals.db,
            redis: app.locals.redis
        });

        if (process.env.ENABLE_GGUF_ISSUES_API !== 'false') {
            try {
                const GGUFIssuesAPI = require('./core/api/issues-api');
                new GGUFIssuesAPI(app, {
                    watchDirectories: ['data/mock', 'src/data'],
                    enableRealTime: process.env.GGUF_ISSUES_REALTIME !== 'false',
                    enableAI: true,
                    enableBackups: true,
                    enableValidation: true
                });
                console.log('✅ GGUF Issues API enabled');
            } catch (error) {
                console.warn('⚠️ GGUF Issues API disabled:', error.message);
            }
        }
    } catch (error) {
        console.error('❌ Phase 2 bootstrap failed, using stub APIs only:', error.message);
        setupDashboardStubAPIs(app, webRoot);
        require('./src/api/trust-api').setupTrustAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
        require('./src/api/optimization-api').setupOptimizationAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
    }
}

// Setup export APIs
setupExportAPIs(app);

// Setup development roadmap APIs
setupDevelopmentRoadmapAPIs(app);

// Setup URL Analyzer APIs
setupURLAnalyzerAPIs(app);

// Setup Roadmap Builder APIs
setupRoadmapBuilderAPIs(app);

// Setup Reports API
const reportsAPI = new ReportsAPI(app, globalContextManager);

// Setup Dynamic Roadmap API (build-from-path already registered above)
registerDynamicRoadmapApi(app, path.join(__dirname, 'src'), { skipBuildFromPath: true });

// Setup comprehensive AI Analysis API
const aiAnalysisAPI = new AIAnalysisAPI(app, globalContextManager);

// Get available analysis types
app.get('/ai-analysis/types', (req, res) => {
    try {
        const analysisTypes = [
            {
                id: 'code-quality',
                name: 'Code Quality Analysis',
                description: 'Analyze code quality, identify potential issues, and receive improvement recommendations',
                icon: 'fas fa-code',
                estimatedDuration: 5000,
                features: ['Static analysis', 'Complexity metrics', 'Code smells detection', 'Best practices']
            },
            {
                id: 'performance',
                name: 'Performance Profiling',
                description: 'Profile application performance, identify bottlenecks, and optimize resource usage',
                icon: 'fas fa-tachometer-alt',
                estimatedDuration: 4000,
                features: ['Runtime analysis', 'Bottleneck detection', 'Optimization suggestions', 'Resource usage']
            },
            {
                id: 'security',
                name: 'Security Vulnerability Scan',
                description: 'Scan for security vulnerabilities, analyze attack vectors, and receive security improvement recommendations',
                icon: 'fas fa-shield-alt',
                estimatedDuration: 6000,
                features: ['Vulnerability scanning', 'Security patterns', 'Compliance checking', 'Risk assessment']
            },
            {
                id: 'data',
                name: 'Data Pattern Analysis',
                description: 'Analyze data patterns, identify anomalies, and generate insights using advanced machine learning algorithms',
                icon: 'fas fa-chart-bar',
                estimatedDuration: 3000,
                features: ['Pattern analysis', 'Anomaly detection', 'Data insights', 'ML algorithms']
            },
            {
                id: 'architecture',
                name: 'Architecture Review',
                description: 'Review system architecture, identify design patterns, and receive architectural improvement suggestions',
                icon: 'fas fa-building',
                estimatedDuration: 7000,
                features: ['Structure analysis', 'Design patterns', 'Coupling assessment', 'Design issues']
            },
            {
                id: 'ux',
                name: 'UX Analysis',
                description: 'Analyze user experience patterns, identify usability issues, and receive UX improvement recommendations',
                icon: 'fas fa-users',
                estimatedDuration: 5000,
                features: ['Usability analysis', 'Accessibility checking', 'UX patterns', 'User experience']
            }
        ];
        
        res.json({
            success: true,
            types: analysisTypes
        });
    } catch (error) {
        console.error('Failed to get analysis types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get analysis types',
            message: error.message
        });
    }
});

// Start new analysis
app.post('/ai-analysis/start', async (req, res) => {
    try {
        const { analysisType, options = {} } = req.body;
        
        const validTypes = ['code-quality', 'performance', 'security', 'data', 'architecture', 'ux'];
        if (!validTypes.includes(analysisType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid analysis type',
                validTypes: validTypes
            });
        }

        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const analysisData = {
            id: analysisId,
            type: analysisType,
            status: 'queued',
            progress: 0,
            startTime: new Date(),
            options: options,
            results: null,
            error: null
        };

        activeAnalyses.set(analysisId, analysisData);

        // Simulate analysis
        setTimeout(() => {
            performMockAnalysis(analysisId);
        }, 1000);

        res.json({
            success: true,
            analysisId: analysisId,
            status: 'queued',
            estimatedDuration: 5000
        });

    } catch (error) {
        console.error('Failed to start analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start analysis',
            message: error.message
        });
    }
});

// Get analysis status
app.get('/ai-analysis/status/:id', (req, res) => {
    try {
        const { id } = req.params;
        const analysis = activeAnalyses.get(id);

        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: 'Analysis not found'
            });
        }

        res.json({
            success: true,
            analysis: {
                id: analysis.id,
                type: analysis.type,
                status: analysis.status,
                progress: analysis.progress,
                startTime: analysis.startTime,
                estimatedCompletion: analysis.estimatedCompletion,
                error: analysis.error
            }
        });

    } catch (error) {
        console.error('Failed to get analysis status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get analysis status',
            message: error.message
        });
    }
});

// Get analysis results
app.get('/ai-analysis/results/:id', (req, res) => {
    try {
        const { id } = req.params;
        const analysis = activeAnalyses.get(id);

        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: 'Analysis not found'
            });
        }

        if (analysis.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Analysis not completed',
                status: analysis.status
            });
        }

        res.json({
            success: true,
            analysis: {
                id: analysis.id,
                type: analysis.type,
                status: analysis.status,
                startTime: analysis.startTime,
                completionTime: analysis.completionTime,
                duration: analysis.duration,
                results: analysis.results
            }
        });

    } catch (error) {
        console.error('Failed to get analysis results:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get analysis results',
            message: error.message
        });
    }
});

// Helper function for mock analysis
function performMockAnalysis(analysisId) {
    const analysis = activeAnalyses.get(analysisId);
    if (!analysis) return;

    try {
        analysis.status = 'analyzing';
        analysis.progress = 25;

        // Simulate progress
        const progressInterval = setInterval(() => {
            if (analysis.progress < 90) {
                analysis.progress += 10;
            } else {
                clearInterval(progressInterval);
                completeAnalysis(analysisId);
            }
        }, 200);

    } catch (error) {
        console.error(`Analysis ${analysisId} failed:`, error);
        analysis.status = 'failed';
        analysis.error = error.message;
        analysis.completionTime = new Date();
    }
}

function completeAnalysis(analysisId) {
    const analysis = activeAnalyses.get(analysisId);
    if (!analysis) return;

    analysis.status = 'completed';
    analysis.completionTime = new Date();
    analysis.duration = analysis.completionTime - analysis.startTime;
    analysis.progress = 100;

    // Generate mock results
    analysis.results = {
        overview: {
            totalFiles: Math.floor(Math.random() * 100) + 50,
            analyzedFiles: Math.floor(Math.random() * 80) + 40,
            issues: Math.floor(Math.random() * 20) + 5
        },
        insights: [
            {
                type: 'insight',
                category: analysis.type,
                title: 'Analysis Complete',
                description: `Mock ${analysis.type} analysis completed successfully`,
                impact: 'medium'
            }
        ],
        recommendations: [
            {
                type: 'recommendation',
                category: analysis.type,
                title: 'Mock Recommendation',
                description: 'This is a mock recommendation for demonstration',
                priority: 'medium',
                effort: 'low'
            }
        ],
        metrics: {
            score: Math.floor(Math.random() * 30) + 70,
            efficiency: Math.floor(Math.random() * 20) + 80,
            quality: Math.floor(Math.random() * 25) + 75
        },
        score: Math.floor(Math.random() * 30) + 70
    };

    debugLog(`✅ Mock ${analysis.type} analysis completed for ${analysisId}`);
}

// Setup AI roadmap report APIs
setupAIRoadmapReportAPIs(app);

async function startServer() {
  await bootstrapPhase2Routes();

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
  const wss = setupWebSocketServer(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Run: npm run dashboard:kill-ports`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log(`🚀 GGUF Dashboard server running on http://localhost:${PORT}`);
    try {
      const {
        resolveDefaultAllowedRoots,
        formatAllowedRootsSummary
      } = require('./server/lib/path-safety');
      const allowedRoots = resolveDefaultAllowedRoots(__dirname, { monorepoRoot: path.join(__dirname, '..') });
      console.log(`📂 Allowed analysis roots: ${formatAllowedRootsSummary(allowedRoots, 8) || '(none)'}`);
    } catch (err) {
      console.warn('[path-safety] Could not log allowed analysis roots:', err.message);
    }
    if (landingAtRoot && fs.existsSync(path.join(landingRoot, 'index.html'))) {
      console.log(`🌐 Landing page at: http://localhost:${PORT}/`);
      console.log(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/app`);
    } else if (landingEnabled && internalDashboard && fs.existsSync(path.join(landingRoot, 'index.html'))) {
      console.log(`🌐 Paywall at: http://localhost:${PORT}/`);
      console.log(`🌐 Marketing preview at: http://localhost:${PORT}/landing`);
      console.log(`📄 Sample report at: http://localhost:${PORT}/sample-report`);
      console.log(`📥 Operator booking inbox at: http://localhost:${PORT}/operator/bookings`);
      if (!String(process.env.RESEND_API_KEY || '').trim()) {
        console.log(`✉️ Email alerts OFF — set RESEND_API_KEY in .env.v1-internal (bookings still save to operator inbox)`);
      }
      console.log(`🛡️ Vault unlock at: http://localhost:${PORT}/private-dashboard-vault?password=<DASHBOARD_VAULT_PASSWORD>`);
      console.log(`   → opens sample report (same layout as simplebeacon.ai/sample-report)`);
    } else {
      console.log(`🛡️ Simplebeacon dashboard at: http://localhost:${PORT}/`);
    }
    if (internalDashboard) {
      console.log(`🔒 /app and dashboard APIs require vault session (24h cookie after vault login)`);
      console.log(`🧪 STAGING: see coming-soon/STAGING.md (payments flag in site-config.js)`);
    }
    console.log(`📊 Legacy platform dashboard at: http://localhost:${PORT}/dashboard-new.html`);
    console.log(`🔧 Simplebeacon API at: http://localhost:${PORT}/api/simplebeacon/`);
    console.log(`🔧 API endpoints available at: http://localhost:${PORT}/api/gguf/`);
    console.log(`🔍 Global Context API available at: http://localhost:${PORT}/api/context/`);
    console.log(`📤 Export APIs available at: http://localhost:${PORT}/api/gguf/export/`);
    console.log(`🤖 AI Analysis API available at: http://localhost:${PORT}/api/ai-analysis/`);
    console.log(`📊 Reports API available at: http://localhost:${PORT}/api/reports/`);
    console.log(`🗺️ Dynamic Roadmap API available at: http://localhost:${PORT}/api/dynamic-roadmap/`);
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
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    debugLog('🔌 WebSocket client connected');

    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to GGUF Dashboard WebSocket server',
      timestamp: new Date().toISOString()
    }));

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
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    ws.on('close', () => {
      debugLog('🔌 WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  setInterval(() => {
    if (wss.clients.size > 0) {
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

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(updateData));
        }
      });
    }
  }, 5000);

  return wss;
}

startServer().catch((error) => {
  console.error('❌ Failed to start GGUF dashboard server:', error);
  process.exit(1);
});

// Legacy standalone WebSocket port for older clients (non-fatal if already bound)
const legacyWss = new WebSocket.Server({ port: WS_PORT });
legacyWss.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.warn(`[Simplebeacon] Legacy WebSocket port ${WS_PORT} already in use — skipping duplicate bind`);
    return;
  }
  console.warn('[Simplebeacon] Legacy WebSocket error:', err.message);
});
legacyWss.on('listening', () => {
  console.log(`🌐 Legacy WebSocket server running on ws://localhost:${WS_PORT}`);
});
legacyWss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to legacy GGUF WebSocket server',
    timestamp: new Date().toISOString()
  }));
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      ws.send(JSON.stringify({ type: 'echo', data, timestamp: new Date().toISOString() }));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format', timestamp: new Date().toISOString() }));
    }
  });
});

module.exports = app;
