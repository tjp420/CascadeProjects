// simplebeacon:production-leak-intent - server routes use template literals for HTML injection and API responses, not mock data leaks
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
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
const { calculateFileQuality, contentNeedsValidation } = require('./lib/file-quality-heuristics.cjs');

// Import enhanced security middleware
const { 
  createRateLimiter, 
  securityHeaders, 
  requestLogger, 
  ipProtection, 
  securityErrorHandler,
  validateInput 
} = require('./middleware/security.cjs');
const { 
  authenticate,
  optionalAuthenticate,
  handleLogin, 
  handleTokenRefresh,
  generateToken
} = require('./middleware/auth.cjs');
const { 
  initializeAudit, 
  auditAIOperation, 
  auditSecurity,
  auditDataAccess,
  logSystemEvent,
  logSecurityEvent
} = require('./middleware/audit.cjs');
const { registerUser } = require('./services/user-service.cjs');

// Import upload routes and security
const uploadRoutes = require('./routes/upload.cjs');
const { uploadSecurity, contentValidation } = require('./middleware/upload-security.cjs');
const { setupFlexibleAnalyzeAPI } = require('./routes/flexible-analyze-api.cjs');
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
// const { runLocalAgent } = require('../../ai-agent/orchestrator.cjs');
const pathHealthRouter = require('./api/metrics/path-health.cjs');
const { runNpmAuditAsync } = require('./lib/npm-audit-runner.cjs');
const { registerEuAiActSprintRoute } = require('./lib/eu-ai-act-sprint-route.cjs');
const { registerComplianceSchemaRoute } = require('./routes/compliance-schema-api.cjs');
const { setupPrIntegrationAPI } = require('./routes/pr-integration-api.cjs');
const freeTokenRouter = require('../../coming-soon/dist/routes/free-token.cjs');

const app = express();
app.set('trust proxy', 1); // Trust first proxy hop for rate-limit IP accuracy
let PORT = process.env.PORT || constants.DEFAULT_PORT;

// Preload package.json at startup to avoid sync reads in route handlers
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let cachedPackageJson = null;
try {
  cachedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')); // simplebeacon-ignore sync-io — startup preload before server starts
} catch {
  cachedPackageJson = { version: '1.0.0' };
}

/**
 * Get package json.
 * @returns {any}
 */
function getPackageJson() {
  return cachedPackageJson;
}

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

const authLoginRateLimit = rateLimit({
  windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || constants.RATE_LIMIT_WINDOW_MS),
  max: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || constants.AUTH_RATE_LIMIT),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please wait before trying to sign in again.'
  }
});

// Billing webhook must use raw body before JSON parser
setupSimplebeaconBillingWebhook(app);

app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true }));

const comingSoonRoot = path.join(__dirname, '../../coming-soon');
const webRoot = path.join(__dirname, '../web');
const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true';

// Agent execution status (in-memory, no castles)
let currentAgentStatus = { status: 'idle', goal: null, startedAt: null, completedAt: null, error: null };

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
 * @param {any} req
 * @returns {any}
 */
function isVaultAuthenticated(req) {
  return checkVaultAuthenticated(req, {
    internalDashboard: internalDashboard || Boolean(process.env.DASHBOARD_VAULT_PASSWORD),
    vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD
  });
}

/**
 * Send coming soon index.
 * @param {Array} res
 * @returns {any}
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
 * @returns {any}
 */
function loadDashboardHtml() {
  return cachedDashboardHtml;
}

/**
 * Send simplebeacon dashboard.
 * @param {Array} res
 * @returns {any}
 */
function sendSimplebeaconDashboard(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const html = loadDashboardHtml();
  if (html === null) {
    return res.status(404).send('Simplebeacon dashboard not found');
  }

  // Automatically set vault cookie for smooth dev experience
  if (process.env.DASHBOARD_VAULT_PASSWORD) {
    const { setVaultSessionCookie } = require('./lib/dashboard-vault-auth.cjs');
    setVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
  }

  res.send(html);
  return true;
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

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') return next();
  if (!process.env.DASHBOARD_VAULT_PASSWORD) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/api/simplebeacon/billing/webhook')) return next();
  if (req.path.startsWith('/api/simplebeacon/billing')) return next();
  if (req.path.startsWith('/api/simplebeacon/scan')) return next();
  if (req.path.startsWith('/api/simplebeacon/report')) return next();
  if (req.path.startsWith('/api/simplebeacon/baseline')) return next();
  if (req.path.startsWith('/api/simplebeacon/config')) return next();
  if (req.path.startsWith('/api/simplebeacon/history')) return next();
  if (req.path.startsWith('/api/simplebeacon/user')) return next();
  if (req.path.startsWith('/api/simplebeacon/entitlements')) return next();
  if (req.path.startsWith('/api/chatbot/')) return next();
  if (req.path.startsWith('/api/auth/')) return next();
  if (req.path.startsWith('/api/dev-tools/')) return next();
  if (req.path.startsWith('/api/coverage-reports/')) return next();
  if (req.path.startsWith('/api/dashboard-home')) return next();
  if (req.path.startsWith('/api/help')) return next();
  if (req.path.startsWith('/api/quality/')) return next();
  if (req.path.startsWith('/api/security/')) return next();
  if (req.path.startsWith('/api/optimization/')) return next();
  if (req.path.startsWith('/api/analyze/')) return next();
  if (req.path.startsWith('/api/operator/')) return next();
  if (req.path === '/api/health') return next();
  if (req.path === '/api/platform/status') return next();
  if (req.path === '/api/security/npm-audit') return next();
  if (req.path === '/api/reports/upload') return next();
  if (req.path.startsWith('/api/reports/status/')) return next();
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
  if (req.query.password !== process.env.DASHBOARD_VAULT_PASSWORD) {
    return res.status(403).send('Unauthorized Access: Private Vault is Locked.');
  }
  setVaultSessionCookie(res, process.env.DASHBOARD_VAULT_PASSWORD);
  const samplePath = path.join(comingSoonRoot, 'sample-report.html');
  try {
    await fs.promises.access(samplePath);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.sendFile(samplePath);
  } catch {
    return res.status(404).send('sample-report.html not found — run: cd ai-platform && npm run build:sample-report');
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
['/css', '/js', '/js-es2018', '/images', '/fonts', '/assets'].forEach((p) => {
  app.use(p, express.static(path.join(dashDir, p.substring(1))));
});
app.use('/site-config.js', express.static(path.join(dashDir, 'site-config.js')));

// Fallback: serve coming-soon assets from root for pages served under /coming-soon/
['/css', '/js', '/images', '/fonts', '/assets'].forEach((p) => {
  app.use(p, express.static(path.join(comingSoonRoot, p.substring(1))));
});

// Dashboard assets served under /simplebeacon-dashboard/ prefix
app.use('/simplebeacon-dashboard', express.static(dashDir));

// Dashboard / web assets (vault-gated when DASHBOARD_VAULT_PASSWORD is set)
app.use((req, res, next) => {
  const skipVault = !process.env.DASHBOARD_VAULT_PASSWORD || process.env.NODE_ENV === 'development';
  if (skipVault) {
    return express.static(webRoot, { index: false })(req, res, next);
  }
  if (isProtectedDashboardPath(req.path) && !isVaultAuthenticated(req)) {
    return res.redirect(302, '/');
  }
  return express.static(webRoot, { index: false })(req, res, next);
});
app.use('/assets', express.static(path.join(webRoot, 'assets')));

// Inject runtime configuration into dashboard HTML
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

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    platform: 'Simplebeacon',
    version: '1.0.0'
  });
});

// VS Code Extension heartbeat bridge
const vscodeExtensionStatus = { active: false, lastPing: 0, version: '' };
const VSCODE_HEARTBEAT_TIMEOUT_MS = 30000;

app.post('/api/vscode-heartbeat', express.json({ limit: '1kb' }), (req, res) => {
  const { version } = req.body || {};
  vscodeExtensionStatus.active = true;
  vscodeExtensionStatus.lastPing = Date.now();
  vscodeExtensionStatus.version = version || 'unknown';
  res.json({ success: true, received: true });
});

app.get('/api/vscode-status', (_req, res) => {
  const now = Date.now();
  const isActive = vscodeExtensionStatus.active && (now - vscodeExtensionStatus.lastPing) < VSCODE_HEARTBEAT_TIMEOUT_MS;
  res.json({ active: isActive, lastPing: vscodeExtensionStatus.lastPing, version: vscodeExtensionStatus.version, enhancedScanAvailable: isActive });
});

app.get('/api/status', (req, res) => {
  res.json({
    platform: 'Simplebeacon',
    status: 'operational',
    features: {
      ai_system: 'ready',
      web_interface: 'active',
      api_endpoints: 'available',
      tools: 'integrated'
    },
    statistics: {
      files_processed: constants.FILES_PROCESSED_STAT,
      consolidation_complete: true,
      reduction_rate: constants.REDUCTION_RATE_STAT
    }
  });
});

// Real Project Structure API
app.get('/api/project-structure', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Scan actual project directory
    const projectPath = path.join(__dirname, '..');
    const files = {};
    
/**
 * Scan directory.
 * @param {string} dirPath
 * @param {string} basePath
 * @returns {any}
 */
    const scanDirectory = async (dirPath, basePath = '') => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        const relativePath = path.join(basePath, item.name);
        
        if (item.isDirectory()) {
          await scanDirectory(itemPath, relativePath);
        } else {
          // Analyze file type and status based on content
          const content = await fs.readFile(itemPath, 'utf8');
          const status = analyzeFileStatus(content, item.name);
          
          files[relativePath] = {
            type: getFileType(item.name, content),
            status: status,
            lastModified: item.mtime,
            size: item.size
          };
        }
      }
    };
    
    await scanDirectory(projectPath);
    
    res.json({ files });
  } catch (error) {
    console.error('Project structure scan error:', error);
    res.status(500).json({ error: 'Failed to scan project structure' });
  }
});

// Releases API
app.get('/api/releases', (req, res) => {
  try {
    const packageJson = getPackageJson();
    const releases = [
      {
        version: packageJson.version || '2.0.0',
        name: 'Current Release',
        description: 'AI Data Processing Platform with technical debt management',
        date: new Date().toISOString().split('T')[0],
        status: 'released'
      },
      {
        version: '2.1.0',
        name: 'Enhanced Analytics',
        description: 'Enhanced analytics and reporting features with mock data analyzer',
        date: '2026-06-15',
        status: 'upcoming'
      },
      {
        version: '2.2.0',
        name: 'Mobile & Performance',
        description: 'Mobile interface and performance improvements',
        date: '2026-08-01',
        status: 'planned'
      }
    ];
    
    res.json(releases);
  } catch (error) {
    console.error('Releases analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze releases' });
  }
});

// Feature Backlog API
app.get('/api/backlog', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Scan for TODO, FIXME, and other development markers
    const projectPath = path.join(__dirname, '..');
    const backlog = [];
    
/**
 * Scan for backlog items.
 * @param {string} dirPath
 * @returns {any}
 */
    const scanForBacklogItems = async (dirPath) => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          await scanForBacklogItems(itemPath);
        } else if (item.name.match(/\.(js|py|html|md|json|yml|txt)$/i)) {
          try {
            const content = await fs.readFile(itemPath, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
              // Look for TODO, FIXME, etc.
              if (line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|NOTE)/i)) {
                backlog.push({
                  title: line.split(/\s+/).slice(1).join(' ').substring(0, 50),
                  file: item.name,
                  line: index + 1,
                  priority: line.includes('TODO') ? 'medium' : line.includes('FIXME') ? 'high' : 'low',
                  status: 'planned',
                  estimate: estimateWork(line)
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    };
    
    await scanForBacklogItems(projectPath);
    
    res.json(backlog);
  } catch (error) {
    console.error('Backlog scan error:', error);
    res.status(500).json({ error: 'Failed to scan backlog' });
  }
});

// Mock data API routes
setupMockDataAPI(app, { baseDir: path.join(__dirname, '..') });

// Helper functions for project-structure and backlog routes
/**
 * Get file type.
 * @param {string} filename
 * @param {any} content
 * @returns {any}
 */
function getFileType(filename, content) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.js' || ext === '.py') return content.includes('test') ? 'test' : 'development';
  if (ext === '.html') return 'web';
  if (ext === '.md') return 'documentation';
  if (ext === '.json' || ext === '.yaml' || ext === '.yml') return 'configuration';
  return 'other';
}

/**
 * Analyze file status.
 * @param {any} content
 * @param {string} _filename
 * @returns {any}
 */
function analyzeFileStatus(content, _filename) {
  if (contentNeedsValidation(content)) return 'planned';
  if (content.includes('// IN PROGRESS') || content.includes('# IN PROGRESS')) return 'in-progress';
  if (content.includes('// COMPLETED') || content.includes('# COMPLETED')) return 'completed';
  return 'planned';
}

/**
 * Estimate work.
 * @param {any} line
 * @returns {any}
 */
function estimateWork(line) {
  if (line.includes('small') || line.includes('quick')) return '1 day';
  if (line.includes('medium')) return '3 days';
  if (line.includes('large') || line.includes('complex')) return '1 week';
  return 'Unestimated';
}

// Authentication routes
app.post('/api/auth/login', authLoginRateLimit, validateInput('login'), handleLogin);
app.post('/api/auth/register', authLoginRateLimit, validateInput('login'), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await registerUser(email, password, req.body.name);
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }
    const token = generateToken(result.user);
    res.json({
      message: 'Account created successfully',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        trustLevel: result.user.trustLevel
      }
    });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/refresh', authenticate, handleTokenRefresh);
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    authenticated: true,
    timestamp: new Date().toISOString()
  });
});
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out', timestamp: new Date().toISOString() });
});

// Token authentication routes (TAS-1.0 flat capability mesh)
app.use('/auth', tokenAuthRoutes);

// License token status check (known = login, unknown = register)
const { getLicenseToken, insertLicenseToken } = require('./lib/token-db.cjs');
app.post('/api/auth/token-status', (req, res) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ registered: false, error: 'Token required' });
    }
    const entry = getLicenseToken(token);
    if (entry) {
        return res.json({ registered: true, email: entry.email, tier: entry.tier, registeredAt: entry.registered_at });
    }
    return res.json({ registered: false });
});

app.post('/api/auth/register-token', (req, res) => {
    const { token, email } = req.body || {};
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }
    const existing = getLicenseToken(token);
    if (existing) {
        return res.status(409).json({ error: 'Token already registered', email: existing.email });
    }
    // Decode tier from token (best-effort)
    let tier = 'community';
    try {
        const parts = token.split('.');
        const payloadBase64 = parts.length === 2 ? parts[0] : parts[1];
        if (payloadBase64) {
            const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
            const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            tier = json.tier || json.product || 'community';
        }
    } catch { /* ignore decode errors */ }
    insertLicenseToken({ token, email: email.toLowerCase(), tier, registered_at: new Date().toISOString() });
    res.json({ success: true, registered: true, tier });
});

// Sandbox token generation for local/internal dashboard testing
app.post('/api/tokens/sandbox', (req, res) => {
  const sandboxToken = generateToken({
    id: 'sandbox-' + Date.now(),
    email: 'sandbox@local.dev',
    name: 'Developer Sandbox',
    trustLevel: 'gold'
  });
  // Auto-register so /api/auth/token-status treats it as known (direct login)
  insertLicenseToken({
    token: sandboxToken,
    email: 'sandbox@local.dev',
    tier: 'community',
    registered_at: new Date().toISOString()
  });
  res.json({
    success: true,
    token: sandboxToken,
    tier: 'sandbox',
    message: 'Sandbox token generated — limited to 100 requests/day'
  });
});

// Platform status
app.get('/api/platform/status', (req, res) => {
  res.json({
    phase: 1,
    authRequired: process.env.REQUIRE_AUTH === 'true',
    features: {
      jwtAuth: true,
      demoUsers: true,
      stubApis: true
    },
    timestamp: new Date().toISOString()
  });
});

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
      error: error.message || 'npm audit failed'
    });
  }
});

// Enhanced API routes with authentication
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    platform: 'Simplebeacon',
    version: '1.0.0',
    security: {
      rateLimiting: 'enabled',
      authentication: 'enabled',
      auditLogging: 'enabled'
    }
  });
});

app.get('/api/status', authenticate, (req, res) => {
  res.json({
    platform: 'Simplebeacon',
    status: 'operational',
    user: {
      id: req.user.id,
      email: req.user.email,
      trustLevel: req.user.trustLevel
    },
    features: {
      ai_system: 'ready',
      web_interface: 'active',
      api_endpoints: 'available',
      tools: 'integrated',
      security: 'enhanced',
      audit_logging: 'active'
    },
    statistics: {
      files_processed: constants.FILES_PROCESSED_STAT,
      consolidation_complete: true,
      reduction_rate: constants.REDUCTION_RATE_STAT,
      security_score: '95%',
      uptime: '99.9%'
    }
  });
});

// Flexible analyze API — codebase scan and inventory (shared path-safety with simplebeacon-server)
const platformRoot = path.join(__dirname, '..');
setupFlexibleAnalyzeAPI(app, {
    baseDir: platformRoot,
    monorepoRoot: path.join(platformRoot, '..')
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

// Chatbot API — AI-powered code assistance
setupChatbotAPI(app);

// Stub endpoints for dashboard client features not available in local dev
app.get('/api/chatbot/providers', (_req, res) => res.json({ providers: [], enabled: false }));
app.get('/api/prompts/get', (_req, res) => res.json({ prompts: [], userId: _req.query.userId || 'anonymous' }));
app.get('/data/re-attestation-metadata.json', (_req, res) => res.json({ attestations: [], generatedAt: new Date().toISOString() }));

// Local models API — Ollama and local model management
setupLocalModelsAPI(app, {
    baseDir: platformRoot
});

// Simplebeacon dashboard API — scan report, baseline, config, history
// Authenticate vault sessions for user routes so req.user is populated
app.use('/api/simplebeacon/user', authenticate);
try {
    setupSimplebeaconAPI(app);
} catch (e) {
    console.warn('[Simplebeacon] simplebeacon-api setup skipped:', e.message);
}

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
    app.use(freeTokenRouter);
} catch (e) {
    console.warn('[Simplebeacon] Free token routes setup skipped. Check configuration profiles.');
}

// Pricing config endpoint (used by coming-soon site pages)
app.get('/api/config/pricing', (_req, res) => {
    res.json({
        success: true,
        pricing: {
            instant: { stripeLink: process.env.STRIPE_LINK_INSTANT || '' },
            executive: { stripeLink: process.env.STRIPE_LINK_EXECUTIVE || '' },
            euSprint: { stripeLink: process.env.STRIPE_LINK_EU_SPRINT || '' }
        }
    });
});

// Health probe endpoint (used by browser integrations)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Local AI Agent API routes (Step 3 — deterministic state machine loop)
app.post('/api/agent/execute', (req, res) => {
    const { goal } = req.body || {};
    if (!goal || typeof goal !== 'string') {
        return res.status(400).json({ success: false, error: 'goal (string) is required in request body' });
    }
    // Agent execution not currently available - orchestrator.js not implemented
    return res.status(501).json({ success: false, error: 'Agent execution not implemented' });

    // Agent execution temporarily disabled
    /*
    currentAgentStatus = { status: 'running', goal, startedAt: new Date().toISOString(), completedAt: null, error: null };
    res.status(202).json({ success: true, message: 'Agent execution started', goal });

    runLocalAgent(goal)
        .then((result) => {
            currentAgentStatus = {
                status: result.success ? 'completed' : 'failed',
                goal,
                startedAt: currentAgentStatus.startedAt,
                completedAt: new Date().toISOString(),
                error: result.error || null
            };
        })
        .catch((err) => {
            currentAgentStatus = {
                status: 'failed',
                goal,
                startedAt: currentAgentStatus.startedAt,
                completedAt: new Date().toISOString(),
                error: err.message
            };
        });
    */
});

app.get('/api/agent/status', (_req, res) => {
    res.json(currentAgentStatus);
});

// Path health metrics API
app.use('/api/metrics/path-health', pathHealthRouter);

// Custom prompt service (user-defined analysis prompts)
try {
    const promptService = require('./services/prompt-service.cjs');
    app.use('/api/prompts', promptService);
} catch (e) {
    console.warn('[PromptService] prompt-service routes not loaded');
}

// Free community token generation (shared with coming-soon)
try {
    const freeTokenRoutes = require('../../coming-soon/routes/free-token.cjs');
    app.use(freeTokenRoutes);
} catch (e) {
    console.warn('[FreeToken] free-token routes not loaded');
}

// Upload API disabled — source code never leaves your machine per privacy promise.
// To re-enable: uncomment the next line.
// app.use('/api/upload', optionalAuthenticate, uploadSecurity, contentValidation, uploadRoutes);

// AI Context endpoint — receive scan data + notes from website and write to .simplebeacon/ai-context.md
app.post('/api/ai-context', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { projectPath, notes, reportSummary, issues } = req.body || {};
        if (!projectPath || typeof projectPath !== 'string') {
            return res.status(400).json({ success: false, error: 'projectPath is required' });
        }

        // Resolve relative paths against the platform root (repo root) instead of server cwd
        const platformRoot = path.join(__dirname, '..', '..');
        const safePath = path.isAbsolute(projectPath) ? path.resolve(projectPath) : path.resolve(platformRoot, projectPath);
        const sbDir = path.join(safePath, '.simplebeacon');
        const contextPath = path.join(sbDir, 'ai-context.md');

        // Ensure .simplebeacon directory exists
        await fs.promises.mkdir(sbDir, { recursive: true });

        const timestamp = new Date().toISOString();
        let md = `# AI Context — SimpleBeacon Scan\n\n**Generated:** ${timestamp}\n**Project:** ${safePath}\n\n`;

        if (notes && typeof notes === 'string') {
            md += `## User Notes\n\n${notes}\n\n`;
        }

        if (reportSummary && typeof reportSummary === 'object') {
            md += `## Scan Summary\n\n`;
            md += `- **Gate Pass:** ${reportSummary.gatePass ?? 'N/A'}\n`;
            md += `- **Quality Score:** ${reportSummary.qualityScore ?? 'N/A'}\n`;
            md += `- **Total Issues:** ${reportSummary.totalIssues ?? 'N/A'}\n`;
            md += `- **Files Scanned:** ${reportSummary.filesScanned ?? 'N/A'}\n`;
            md += `- **Report Type:** ${reportSummary.reportType ?? 'N/A'}\n\n`;
        }

        if (Array.isArray(issues) && issues.length > 0) {
            md += `## Issues (${issues.length})\n\n`;
            for (const issue of issues.slice(0, 50)) {
                const sev = issue.severity || issue.type || 'unknown';
                const file = issue.filePath || issue.file || 'N/A';
                const line = issue.line || issue.lineNumber || '';
                const desc = issue.description || issue.message || issue.title || JSON.stringify(issue).slice(0, 200);
                md += `- **[${sev.toUpperCase()}]** ${desc} — \`${file}${line ? ':' + line : ''}\`\n`;
            }
            if (issues.length > 50) {
                md += `\n... and ${issues.length - 50} more issues.\n`;
            }
            md += '\n';
        }

        md += `## Next Steps\n\n1. Review the issues above\n2. Run fixes via: \`npx simplebeacon scan --fix\`\n3. Or ask the AI agent to fix specific files\n`;

        await fs.promises.writeFile(contextPath, md, 'utf8');
        res.json({ success: true, path: contextPath, content: md, message: 'AI context saved. Mention @.simplebeacon/ai-context.md in chat.' });
    } catch (err) {
        console.error('[AI-Context]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai-context — retrieve the current AI context markdown for the AI agent
app.get('/api/ai-context', async (req, res) => {
    try {
        const projectPath = req.query.projectPath || process.cwd();
        const platformRoot = path.join(__dirname, '..', '..');
        const safePath = path.isAbsolute(projectPath) ? path.resolve(projectPath) : path.resolve(platformRoot, projectPath);
        const contextPath = path.join(safePath, '.simplebeacon', 'ai-context.md');

        try {
            const content = await fs.promises.readFile(contextPath, 'utf8');
            res.json({ success: true, path: contextPath, content });
        } catch {
            res.status(404).json({ success: false, error: 'No AI context file found. Upload a report and click "Send to AI Agent" first.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

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
  console.error(err.stack);
  
  // Log security-related errors
  if (err.status >= 400) {
    logSecurityEvent('application_error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    }, req.user, req);
  }
  
  res.status(err.status || 500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    requestId: req.requestId
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
    requestId: req.requestId
  });
});

/**
 * Log server startup.
 * @param {number} port
 * @returns {any}
 */
function logServerStartup(port) {
  logger.info(`Simplebeacon server running on port ${port}`);
  logger.info(`Dashboard listening on port ${port} (set PUBLIC_BASE_URL for absolute links)`);
  logger.info(`API Health: /api/health`);
  logger.info(`Status: /api/status`);
  logger.info('Security: Enhanced security features enabled');
  logger.info('Audit: Comprehensive audit logging active');
  logSystemEvent('server_start', {
    port,
    environment: process.env.NODE_ENV || 'development',
    security: { rateLimiting: true, authentication: true, auditLogging: true }
  });
}

/**
 * Handle server error.
 * @param {any} server
 * @param {any} err
 * @param {number} attemptPort
 * @param {Array} maxRetries
 * @returns {any}
 */
function handleServerError(server, err, attemptPort, maxRetries) {
  if (err.code === 'EADDRINUSE' && maxRetries > 0) {
    logger.warn(`Port ${attemptPort} in use — trying ${attemptPort + 1}`);
    server.close();
    startServer(attemptPort + 1, maxRetries - 1);
  } else {
    logger.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  }
}

// Start server with enhanced logging — auto-increment port on EADDRINUSE
/**
 * Start server.
 * @param {number} attemptPort
 * @param {Array} maxRetries
 * @returns {any}
 */
function startServer(attemptPort, maxRetries = constants.MAX_RETRIES) {
  const server = app.listen(attemptPort, () => {
    PORT = attemptPort;
    logServerStartup(PORT);
  });
  server.on('error', (err) => handleServerError(server, err, attemptPort, maxRetries));
}

startServer(Number(PORT));

module.exports = app;
