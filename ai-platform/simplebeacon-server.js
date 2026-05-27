/**
 * Simplebeacon Server
 * Express server for Simplebeacon landing, dashboard, and scan APIs
 */

const path = require('path');
const fs = require('fs');

// Prefer v1-internal env when present (start script or direct node simplebeacon-server.js)
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

const setupBuildFromPathRoute = require('./src/api/build-from-path-route');
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
  return res.status(404).send('Simplebeacon dashboard not found');
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
  return res.status(404).send('Community pricing page not found');
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

    } catch (error) {
        console.error('❌ Phase 2 bootstrap failed, using stub APIs only:', error.message);
        setupDashboardStubAPIs(app, webRoot);
        require('./src/api/trust-api').setupTrustAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
        require('./src/api/optimization-api').setupOptimizationAPI(app, { platformRoot: __dirname, monorepoRoot: path.join(__dirname, '..') });
    }
}

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
    console.log(`🚀 Simplebeacon server running on http://localhost:${PORT}`);
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
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    debugLog('🔌 WebSocket client connected');

    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to Simplebeacon WebSocket server',
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
  console.warn('[Simplebeacon] Legacy WebSocket error:', err.message);
});
legacyWss.on('listening', () => {
  console.log(`🌐 Legacy WebSocket server running on ws://localhost:${WS_PORT}`);
});
legacyWss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to legacy Simplebeacon WebSocket server',
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
