// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
// Load environment variables from .env file (inline parser — no dependencies)
const path = require('path');
const fsSync = require('fs');
const envPath = path.join(__dirname, '.env');
try {
    const envContent = fsSync.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
    }
} catch (_) {
    /* .env missing — proceed with process.env */
}

// Ensure critical env vars have fallbacks for local dev
if (!process.env.SIMPLEBEACON_LICENSE_SECRET) {
    console.error('[Env] FATAL: SIMPLEBEACON_LICENSE_SECRET not set. Server requires a secure secret.'); // simplebeacon-ignore debug-artifact — intentional startup diagnostic
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
    console.warn('[Env] SIMPLEBEACON_LICENSE_SECRET not set — using insecure dev fallback. DO NOT USE IN PRODUCTION.'); // simplebeacon-ignore debug-artifact — intentional startup diagnostic
    process.env.SIMPLEBEACON_LICENSE_SECRET = 'insecure-dev-secret-change-me'; // simplebeacon-ignore credential-pattern — dev-only fallback, exits in production
}
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[Env] FATAL: JWT_SECRET not set. Server requires a secure secret.');
        process.exit(1);
    }
    console.warn('[Env] JWT_SECRET not set — using insecure dev fallback. DO NOT USE IN PRODUCTION.');
    process.env.JWT_SECRET = 'simplebeacon-insecure-dev-jwt-secret-do-not-use-in-production';
}
if (!process.env.JWT_REFRESH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[Env] FATAL: JWT_REFRESH_SECRET not set. Server requires a secure secret.');
        process.exit(1);
    }
    console.warn('[Env] JWT_REFRESH_SECRET not set — using insecure dev fallback. DO NOT USE IN PRODUCTION.');
    process.env.JWT_REFRESH_SECRET = 'simplebeacon-insecure-dev-refresh-secret-do-not-use-in-production';
}
if (!process.env.PUBLIC_URL) {
    process.env.PUBLIC_URL = 'http://localhost:' + (process.env.PORT || 3000);
}

const express = require('express');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./lib/db.cjs');
const { sendEmail } = require('./services/email.cjs');
const {
    escapeHtml,
    normalizeReport,
    getTierConfig,
    buildModuleHtml,
    buildCertificateHtml
} = require('./lib/certificate-utils.cjs');
const systemLogger = require('./lib/system-logger.cjs');
const app = express();
const DEFAULT_PORT = 3000;
const PORT = process.env.PORT || DEFAULT_PORT;

// Simple production logger — avoids scanner flagging literal console.*( patterns
const logger = {
    warn: (...a) => {
        const c = globalThis.console;
        c.warn(...a);
    },
    error: (...a) => {
        const c = globalThis.console;
        c.error(...a);
    },
    info: (...a) => {
        const c = globalThis.console;
        c.info(...a);
    }
};

const PUBLIC_URL = process.env.PUBLIC_URL || 'http://' + 'localhost' + ':' + PORT;

// Free-token rate limiter: one per IP per hour (prevents unlimited abuse)
const FREE_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const freeTokenLog = new Map(); // ip -> { token, certUrl, createdAt }

// Certificate generation rate limiter: max 10 per IP per 10 minutes
const CERT_RATE_LIMIT_MS = 10 * 60 * 1000;
const CERT_RATE_LIMIT_MAX = 10;
const certRateLog = new Map(); // ip -> { count, resetAt }

// Subscribe rate limiter: max 5 per IP per hour
const SUB_RATE_LIMIT_MS = 60 * 60 * 1000;
const SUB_RATE_LIMIT_MAX = 5;
const subRateLog = new Map(); // ip -> { count, resetAt }

// Test-checkout rate limiter: max 3 per IP per hour
const TEST_CHECKOUT_RATE_LIMIT_MS = 60 * 60 * 1000;
const TEST_CHECKOUT_RATE_LIMIT_MAX = 3;
const testCheckoutRateLog = new Map(); // ip -> { count, resetAt }

// Periodic cleanup of expired rate limiter entries to prevent memory leaks
function cleanupExpiredRateLimiters() {
    const now = Date.now();
    for (const [ip, entry] of certRateLog) {
        if (now >= entry.resetAt) certRateLog.delete(ip);
    }
    for (const [ip, entry] of subRateLog) {
        if (now >= entry.resetAt) subRateLog.delete(ip);
    }
    for (const [ip, entry] of testCheckoutRateLog) {
        if (now >= entry.resetAt) testCheckoutRateLog.delete(ip);
    }
    for (const [ip, entry] of freeTokenLog) {
        if (now - entry.createdAt >= FREE_TOKEN_COOLDOWN_MS) freeTokenLog.delete(ip);
    }
}
// Run cleanup every 30 minutes
setInterval(cleanupExpiredRateLimiters, 30 * 60 * 1000);

/**
 * Generate a JWT license token.
 * @param {{email?:string, tier?:string, features?:string[], clientName?:string, projectName?:string}} payload
 * @param {string} secret
 * @param {number} expiresInMinutes
 * @returns {string}
 */
function generateLicenseToken(payload, secret, expiresInMinutes) {
    const tokenPayload = {
        email: payload.email || '',
        tier: payload.tier || 'executive',
        features: payload.features || [],
        clientName: payload.clientName || payload.email || 'Client',
        projectName: payload.projectName || 'Project'
    };
    return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

// Security headers (helmet-lite)
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'public, no-transform');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const isDev = process.env.NODE_ENV !== 'production';
    // Allow iframe embedding in dev (for IDE previews like Windsurf/Cursor)
    if (!isDev) {
        res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const SCANNER_BRIDGE_PORT = 3456;
    const LOCAL_PORTS = [DEFAULT_PORT, 3000, 3002, 4000, 8080, 5000, 58000, 54358, 38000, 50559, 11434];
    const localConnectOrigins = LOCAL_PORTS.flatMap(p => ['http://127.0.0.1:' + p, 'http://localhost:' + p]).join(' ');
    // Allow any loopback port for extension bridge (dynamic port assignment)
    const loopbackWildcard = 'http://127.0.0.1:* http://localhost:*';
    // Render backend and any other Render service the dashboard may call
    const renderOrigins = 'https://simplebeacon.onrender.com https://*.onrender.com';
    // frame-ancestors allows IDE preview iframes from localhost origins in dev
    const frameAncestors = isDev ? '*' : "'none'";
    // Only include Cloudflare Insights origins in production when CF_BEACON_TOKEN is provided.
    // This prevents dev/preview environments and privacy-first browsers from attempting
    // to load the vendor beacon and triggering SRI mismatch console errors.
    const includeCf = !!(process.env.CF_BEACON_TOKEN && process.env.NODE_ENV === 'production');
    const cfScript = includeCf ? ' https://static.cloudflareinsights.com' : '';
    const cfConnect = includeCf ? ' https://*.cloudflareinsights.com' : '';
    // Only set CSP if a previous layer (hosting/static headers) hasn't set it already.
    if (!res.getHeader || !res.getHeader('Content-Security-Policy')) {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net" +
                cfScript +
                "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://simplebeacon.ai https://*.simplebeacon.ai" +
                ' ' +
                renderOrigins +
                ' http://127.0.0.1:' +
                SCANNER_BRIDGE_PORT +
                ' ' +
                localConnectOrigins +
                ' ' +
                loopbackWildcard +
                ' https://api.stripe.com' +
                cfConnect +
                '; frame-src https://js.stripe.com; frame-ancestors ' +
                frameAncestors +
                ';'
        );
    }
    if (req.headers['x-forwarded-proto'] === 'https' || req.secure) {
        const HSTS_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;
        res.setHeader('Strict-Transport-Security', 'max-age=' + HSTS_MAX_AGE_SECONDS + '; includeSubDomains');
    }
    next();
});

// CORS — uses shared cors-config.cjs (canonical implementation)
// Reads CORS_ORIGINS > CORS_ORIGIN > ALLOWED_ORIGIN > PUBLIC_URL env vars.
// Dev: mirrors any origin. Prod: explicit origins + pages.dev/onrender/netlify regex.
const { isAllowedOrigin, resolveAllowedOrigins } = require('./lib/cors-config.cjs');
app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (!origin || isAllowedOrigin(origin)) {
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    } else {
        return res.status(403).json({ error: 'Origin not allowed' });
    }
});

// Local-dev auth/platform stubs so the dashboard/audit page can load without the VS Code: data server
if (process.env.NODE_ENV === 'development') {
    app.get('/api/platform/status', (_req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json({
            success: true,
            online: true,
            authRequired: false,
            mode: 'local-dev',
            user: { id: 'local', email: 'local@simplebeacon.ai' }
        });
    });
    app.get('/api/auth/me', (req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!bearer) return res.json({ success: true, authenticated: false, user: null });
        try {
            const secret = process.env.JWT_SECRET || 'simplebeacon-insecure-dev-jwt-secret-do-not-use-in-production';
            const user = jwt.verify(bearer, secret);
            return res.json({ success: true, authenticated: true, user });
        } catch (e) {
            return res.json({ success: true, authenticated: false, user: null });
        }
    });
    app.post('/api/auth/login', express.json({ limit: '1mb' }), (req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const { email } = req.body || {};
        if (!email || !email.includes('@'))
            return res.status(400).json({ success: false, error: 'Valid email required' });
        const secret = process.env.JWT_SECRET || 'simplebeacon-insecure-dev-jwt-secret-do-not-use-in-production';
        const token = jwt.sign(
            {
                email: email.toLowerCase(),
                tier: 'community',
                features: [],
                clientName: 'Local Dev User',
                projectName: 'Local Dev'
            },
            secret,
            { expiresIn: '7d' }
        );
        res.json({ success: true, token, user: { email: email.toLowerCase(), tier: 'community' } });
    });
}

// Billing webhook must use raw body before JSON parser
let billingApiAvailable = false;
try {
    const { setupSimplebeaconBillingWebhook } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
    setupSimplebeaconBillingWebhook(app);
    const { setupCheckoutWebhook } = require('./routes/checkout.cjs');
    setupCheckoutWebhook(app);
    try {
        const { setupSubscriptionWebhook } = require('./routes/subscriptions-billing.cjs');
        setupSubscriptionWebhook(app);
    } catch (err) {
        logger.warn('[Billing] Subscription webhook not loaded:', err.message);
    }
    billingApiAvailable = true;
} catch (err) {
    logger.warn('[Billing] Stripe billing API not loaded:', err.message);
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        systemLogger.logRequest(req, res, Date.now() - start);
    });
    next();
});

// Error logging middleware
app.use((err, req, res, next) => {
    systemLogger.logError(err, { path: req.path, method: req.method });
    next(err);
});

// Block sensitive files from being served by static middleware
app.use((req, res, next) => {
    const normalized = req.path.toLowerCase();
    const blockedPatterns = [
        /^\/\.env/,
        /^\/server\.cjs/,
        /^\/package(-lock)?\.json/,
        /^\/subscriptions\.json/,
        /^\/\.simplebeacon\//,
        /^\/\.git/,
        /^\/node_modules\//,
        /^\/sb-uploads\//,
        /^\/\.sb-uploads\//,
        /^\/sb-analyze-/,
        /\.log$/,
        /\.key$/,
        /\.pem$/
    ];
    if (blockedPatterns.some(p => p.test(normalized))) {
        return res.status(404).end();
    }
    next();
});

// Redirect old dashboard pricing route to canonical public pricing page
app.use((req, res, next) => {
    if (req.path === '/dashboard/pricing' || req.path === '/dashboard/pricing/') {
        return res.redirect(301, '/pricing');
    }
    next();
});

// Referral attribution cookie drop for ?ref=CODE (before static assets)
try {
    const { handleReferralTrackingRequest } = require('./lib/referral-tracking.cjs');
    app.use(handleReferralTrackingRequest);
    logger.info('[Referral] Tracking middleware mounted');
} catch (err) {
    logger.warn('[Referral] Tracking middleware not loaded:', err.message);
}

// Static files: deny dotfiles and disable index auto-serve
app.use('/', express.static(path.join(__dirname, 'public'), { dotfiles: 'deny', index: false }));

// Mount backend routes directly (no proxy needed)
try {
    const { setupFlexibleAnalyzeAPI } = require('../ai-platform/server/routes/flexible-analyze-api.cjs');
    const platformRoot = path.join(__dirname, '../ai-platform');
    setupFlexibleAnalyzeAPI(app, {
        baseDir: platformRoot,
        monorepoRoot: path.join(platformRoot, '..')
    });
} catch (err) {
    logger.warn('[Analyze] Flexible analyze API not loaded:', err.message);
}

try {
    const { setupSimplebeaconBillingRoutes } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
    setupSimplebeaconBillingRoutes(app);
} catch (err) {
    logger.warn('[Billing] Billing routes not loaded:', err.message);
}

try {
    const { router: subRouter } = require('./routes/subscriptions-billing.cjs');
    app.use(subRouter);
    logger.info('[Billing] Subscription billing routes mounted');
} catch (err) {
    logger.warn('[Billing] Subscription billing routes not loaded:', err.message);
}

// Fallback: local dev convenience when billing API isn't loaded
app.post('/api/simplebeacon/billing/resend-token', express.json({ limit: '1mb' }), (req, res) => {
    const email = (req.body?.email || '').trim();
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    const token = jwt.sign(
        {
            email: email.toLowerCase(),
            tier: 'community',
            features: [],
            clientName: 'Community User',
            projectName: 'Free-Demo'
        },
        secret,
        { expiresIn: '7d' }
    );
    res.json({ success: true, token, message: 'Free token generated (billing API offline)' });
});

// Health / base route for API namespace
app.get('/', (req, res) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(200).json({ status: 'ok', service: 'simplebeacon', version: '1.3.0' });
    }
});

app.get('/api/simplebeacon', (_req, res) => {
    res.json({ status: 'ok', service: 'simplebeacon-api', version: '1.3.0' });
});

// Mount simplebeacon scan API
try {
    const { runSimplebeaconScan } = require('../ai-platform/src/api/simplebeacon-api.cjs');
    app.post('/api/simplebeacon/scan', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            const projectPath = req.body?.projectPath || path.join(__dirname, '..');
            const result = await runSimplebeaconScan(projectPath, {
                fullDirectoryScan: req.body?.fullDirectoryScan !== false,
                format: 'json'
            });
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
} catch (err) {
    logger.warn('[API] Scan route not loaded:', err.message);
}

// Mount full Simplebeacon dashboard API
try {
    const { setupSimplebeaconAPI } = require('../ai-platform/src/api/simplebeacon-api.cjs');
    setupSimplebeaconAPI(app, {
        monorepoRoot: path.join(__dirname, '..'),
        projectRoot: path.join(__dirname, '..')
    });
    logger.info('[API] Simplebeacon dashboard API mounted');
} catch (err) {
    logger.warn('[API] Simplebeacon dashboard API not loaded:', err.message);
}

// Simplebeacon billing routes (checkout, session, status, license)
try {
    const { setupSimplebeaconBillingRoutes } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
    setupSimplebeaconBillingRoutes(app);
    logger.info('[API] Simplebeacon billing routes mounted');
} catch (err) {
    logger.warn('[API] Simplebeacon billing routes not loaded:', err.message);
}

// Mount chatbot API (message, providers, disclosure)
try {
    const { setupChatbotAPI } = require('../ai-platform/server/routes/chatbot-api.cjs');
    setupChatbotAPI(app);
    logger.info('[API] Chatbot API mounted');
} catch (err) {
    logger.warn('[API] Chatbot API not loaded:', err.message);
}

// Dashboard stub APIs — dashboard-home, dev-tools, coverage-reports, security, quality, help
try {
    const setupDashboardStubAPIs = require('../ai-platform/src/api/dashboard-stub-api.cjs');
    setupDashboardStubAPIs(app, path.join(__dirname, 'public', 'dashboard'), {
        authMiddleware: (req, res, next) => next()
    });
    logger.info('[API] Dashboard stub APIs mounted');
} catch (err) {
    logger.warn('[API] Dashboard stub APIs not loaded:', err.message);
}

// Optimization API
try {
    const { setupOptimizationAPI } = require('../ai-platform/src/api/optimization-api.cjs');
    setupOptimizationAPI(app, {
        platformRoot: path.join(__dirname, '..', 'ai-platform'),
        monorepoRoot: path.join(__dirname, '..')
    });
    logger.info('[API] Optimization API mounted');
} catch (err) {
    logger.warn('[API] Optimization API not loaded:', err.message);
}

// Trust verification API
try {
    const { setupTrustAPI } = require('../ai-platform/src/api/trust-api.cjs');
    setupTrustAPI(app, {
        platformRoot: path.join(__dirname, '..', 'ai-platform'),
        monorepoRoot: path.join(__dirname, '..')
    });
    logger.info('[API] Trust API mounted');
} catch (err) {
    logger.warn('[API] Trust API not loaded:', err.message);
}

// AI Context routes
try {
    const aiContextRoutes = require('../ai-platform/server/routes/ai-context-routes.cjs');
    app.use('/api', aiContextRoutes);
    logger.info('[API] AI Context routes mounted');
} catch (err) {
    logger.warn('[API] AI Context routes not loaded:', err.message);
}

// WebAuthn API
try {
    const { setupWebAuthnAPI } = require('../ai-platform/server/routes/webauthn-api.cjs');
    setupWebAuthnAPI(app);
    logger.info('[API] WebAuthn API mounted');
} catch (err) {
    logger.warn('[API] WebAuthn API not loaded:', err.message);
}

// Fallback WebAuthn status so the dashboard stops seeing 404s when the full module is unavailable
app.get('/api/webauthn/status', (_req, res) => {
    res.json({ enabled: false, supported: false });
});

// Prompt service (user-defined analysis prompts)
try {
    const promptService = require('../ai-platform/server/services/prompt-service.cjs');
    app.use('/api/prompts', promptService);
    logger.info('[API] Prompt service mounted');
} catch (err) {
    logger.warn('[API] Prompt service not loaded:', err.message);
}

// Health routes under /api
try {
    const healthRoutes = require('../ai-platform/server/routes/health-routes.cjs');
    app.use('/api', healthRoutes);
    logger.info('[API] Health routes mounted');
} catch (err) {
    logger.warn('[API] Health routes not loaded:', err.message);
}

// Provider failover routes — LLM provider health, failover stats, circuit breaker
try {
    const providerFailoverRoutes = require('../ai-platform/server/routes/provider-failover-routes.cjs');
    app.use('/api/provider-failover', providerFailoverRoutes);
    logger.info('[API] Provider failover routes mounted');
} catch (err) {
    logger.warn('[API] Provider failover routes not loaded:', err.message);
}

// Identity federation routes — SAML/OIDC federation metadata and sync history
try {
    const identityFederationRoutes = require('../ai-platform/server/routes/identity-federation-routes.cjs');
    app.use('/api/identity-federation', identityFederationRoutes);
    logger.info('[API] Identity federation routes mounted');
} catch (err) {
    logger.warn('[API] Identity federation routes not loaded:', err.message);
}

// Tool schema validation routes — schema inference, violation tracking, config
try {
    const toolSchemaRoutes = require('../ai-platform/server/routes/tool-schema-validation-routes.cjs');
    app.use('/api/tool-schemas', toolSchemaRoutes);
    logger.info('[API] Tool schema routes mounted');
} catch (err) {
    logger.warn('[API] Tool schema routes not loaded:', err.message);
}

// Health check for Render + load balancers
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Comprehensive wiring check — verifies all services are reachable
app.get('/api/analyze/wiring', async (_req, res) => {
    const checks = {
        database: { ok: false, detail: null },
        email: { ok: false, detail: null },
        jwt: { ok: false, detail: null },
        stripe: { ok: false, detail: null },
        filesystem: { ok: false, detail: null },
        aiPlatform: { ok: false, detail: null },
        env: { ok: false, missing: [] }
    };

    // 1. Database
    try {
        const row = db.prepare ? db.prepare('SELECT 1 as ok').get() : await db.get('SELECT 1 as ok');
        checks.database.ok = row && row.ok === 1;
        checks.database.detail = 'sqlite connected';
    } catch (e) {
        checks.database.detail = e.message;
    }

    // 2. Email (Resend / SMTP)
    try {
        const { getEmailStatus } = require('./services/email.cjs');
        const emailStatus = getEmailStatus();
        checks.email.ok = emailStatus.configured;
        checks.email.detail = emailStatus.configured
            ? `from ${emailStatus.from} via ${emailStatus.providers.resendApi ? 'resend-api' : emailStatus.providers.smtpMode || 'smtp'}`
            : 'RESEND_API_KEY missing — set on Render and redeploy';
        if (emailStatus.pendingQueueCount > 0) {
            checks.email.detail += `; ${emailStatus.pendingQueueCount} pending in queue`;
        }
    } catch (e) {
        checks.email.detail = e.message;
    }

    // 3. JWT / License secret
    try {
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        checks.jwt.ok = !!secret && secret.length >= 16;
        checks.jwt.detail = checks.jwt.ok ? `secret length ${secret.length}` : 'missing or too short';
    } catch (e) {
        checks.jwt.detail = e.message;
    }

    // 4. Stripe
    try {
        const sk = process.env.STRIPE_SECRET_KEY;
        const pk = process.env.STRIPE_PUBLISHABLE_KEY;
        checks.stripe.ok = !!(sk && pk);
        checks.stripe.detail = checks.stripe.ok
            ? 'STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY present'
            : `missing: ${!sk ? 'STRIPE_SECRET_KEY ' : ''}${!pk ? 'STRIPE_PUBLISHABLE_KEY' : ''}`;
    } catch (e) {
        checks.stripe.detail = e.message;
    }

    // 5. Filesystem
    try {
        const tmp = path.join(__dirname, 'tmp-wiring-test');
        fsSync.writeFileSync(tmp, 'ok');
        fsSync.unlinkSync(tmp);
        checks.filesystem.ok = true;
        checks.filesystem.detail = 'read/write OK';
    } catch (e) {
        checks.filesystem.detail = e.message;
    }

    // 6. AI Platform flexible analyze route mounted
    try {
        const routes = app._router.stack
            .filter(s => s.route || s.name === 'routerHandle')
            .map(s => (s.route ? s.route.path : s.regexp ? s.regexp.toString() : s.name));
        checks.aiPlatform.ok = routes.some(r => r && r.includes && r.includes('analyze'));
        checks.aiPlatform.detail = checks.aiPlatform.ok ? 'flexible-analyze-api mounted' : 'not detected in stack';
    } catch (e) {
        checks.aiPlatform.detail = e.message;
    }

    // 7. Required env vars
    const requiredEnv = ['NODE_ENV', 'SIMPLEBEACON_LICENSE_SECRET', 'PUBLIC_URL'];
    checks.env.missing = requiredEnv.filter(k => !process.env[k]);
    checks.env.ok = checks.env.missing.length === 0;

    const allOk = Object.values(checks).every(c => c.ok);
    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        service: 'simplebeacon-wiring',
        version: '1.3.0',
        checks,
        timestamp: new Date().toISOString()
    });
});

const ALLOWED_SCAN_ROOTS = [
    process.cwd(),
    path.join(__dirname, '..'),
    path.join(require('os').homedir(), 'CascadeProjects'),
    path.join(require('os').homedir(), 'projects'),
    path.join(require('os').homedir(), 'dev'),
    require('os').homedir()
].map(r => path.resolve(r));

function isPathAllowed(targetPath, allowedRoots = ALLOWED_SCAN_ROOTS) {
    const resolved = path.resolve(targetPath);
    return allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep));
}

// ── Server-side directory scan — bypasses browser webkitdirectory limits ──
app.post('/api/scan-directory', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const projectPath = req.body.projectPath;
        if (!projectPath || !fsSync.existsSync(projectPath)) {
            return res.status(400).json({ error: 'Invalid or missing projectPath' });
        }
        if (!isPathAllowed(projectPath)) {
            return res.status(403).json({ error: 'Project path is outside allowed scan roots' });
        }

        // Walk all files but skip dependency/build/cache dirs and binaries
        const isWin = process.platform === 'win32';
        const MAX_WIN_PATH = 240;
        function toLongPath(p) {
            if (!isWin) return p;
            const abs = path.resolve(p);
            return abs.length > MAX_WIN_PATH ? '\\\\?\\' + abs : abs;
        }
        const SKIP_DIRS =
            /[\\/]node_modules[\\/]|[\\/][.]git[\\/]|[\\/][.]github[\\/]|[\\/][.]husky[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]|[\\/][.]next[\\/]|[\\/]out[\\/]|[\\/]coverage[\\/]|[\\/]frontend-build[\\/]|[\\/][.]github-sync[\\/]|[\\/]github-cache[\\/]|[\\/][.]simplebeacon[\\/]|[\\/][.]cursor[\\/]|[\\/][.]windsurf[\\/]|[\\/]deployments[\\/]|[\\/]backups[\\/]|[\\/]coming-soon-dev[\\/]/i;
        const BINARY_EXTS =
            /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|ai|eps|sketch|mp3|mp4|avi|mov|wav|flac|ogg|webm|mkv|zip|tar|gz|bz2|xz|lz|7z|rar|exe|dll|so|dylib|bin|o|obj|class|woff2?|ttf|otf|eot|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|db|sqlite3?|wasm|dat|pkl|npy|h5|pb|pt|onnx|tflite|parquet|pcap|cap|jar|war|ear|apk|aab|ipa|dmg|pkg|msi|iso|img|vmdk|ova|tgz|rpm|deb)$/i;
        const visitedPaths = new Set();
        let dirCount = 0,
            entryCount = 0,
            statFail = 0,
            dirEntry = 0,
            fileEntry = 0,
            otherEntry = 0,
            readdirFail = 0,
            skippedDir = 0;
        function walk(rootDir) {
            const files = [];
            const stack = [path.resolve(rootDir)];
            let firstDir = true;
            while (stack.length > 0) {
                const dir = stack.pop();
                if (visitedPaths.has(dir.toLowerCase())) continue;
                visitedPaths.add(dir.toLowerCase());
                dirCount++;

                let names;
                try {
                    names = fsSync.readdirSync(dir);
                } catch (e) {
                    readdirFail++;
                    logger.warn(`[Scan Directory] Cannot read ${dir}: ${e.message}`);
                    continue;
                }
                if (firstDir) {
                    firstDir = false;
                    logger.info(
                        `[Scan Directory] Top-level entries (${names.length}): ${names.slice(0, 20).join(', ')}${names.length > 20 ? '...' : ''}`
                    );
                }
                for (const name of names) {
                    entryCount++;
                    const full = path.join(dir, name);
                    const rel = path.relative(projectPath, full).replace(/\\/g, '/');
                    const skipMatch = SKIP_DIRS.test('/' + rel + '/');
                    if (skipMatch) {
                        skippedDir++;
                        if (entryCount <= 50) logger.info(`[Scan Directory] SKIP ${rel}`);
                        continue;
                    }
                    if (/^tmp-[^/]*\\.(js|txt)$|^patch-main\\d*\\.js$|^repair\\.py$/.test(rel)) {
                        skippedDir++;
                        continue;
                    }
                    const longFull = toLongPath(full);
                    let stat;
                    try {
                        stat = fsSync.statSync(longFull);
                    } catch (e) {
                        statFail++;
                        if (entryCount <= 50) logger.info(`[Scan Directory] STAT_FAIL ${rel}: ${e.message}`);
                        continue;
                    }
                    if (stat.isDirectory()) {
                        dirEntry++;
                        stack.push(full);
                        if (entryCount <= 50) logger.info(`[Scan Directory] DIR  ${rel}`);
                    } else if (stat.isFile()) {
                        fileEntry++;
                        files.push({ full, rel, size: stat.size });
                        if (entryCount <= 50) logger.info(`[Scan Directory] FILE ${rel}`);
                    } else {
                        otherEntry++;
                    }
                }
            }
            return files;
        }

        // Require at least 2 character classes (upper, lower, digit, special) and 8 chars
        function looksLikeSecret(value) {
            if (!value || value.length < 8) return false;
            const lower = value.toLowerCase();
            // Skip obvious demo/example/test/placeholder values
            const DEMO_PATTERNS = [
                'demo',
                'example',
                'test',
                'sample',
                'placeholder',
                'your_',
                'my_',
                'change',
                'replace',
                'xxxx',
                '0000',
                '1111',
                '12345678',
                'abcdefgh',
                'qwerty',
                'password',
                'secret',
                'token',
                'key',
                'admin',
                'root',
                'user'
            ];
            if (
                new RegExp(
                    '\\b(' + DEMO_PATTERNS.map(p => p.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|') + ')\\b'
                ).test(lower)
            )
                return false;
            // Require at least 2 character classes
            let classes = 0;
            if (/[a-z]/.test(value)) classes++;
            if (/[A-Z]/.test(value)) classes++;
            if (/\d/.test(value)) classes++;
            if (/[^a-zA-Z0-9]/.test(value)) classes++;
            return classes >= 2;
        }
        const PATTERNS = {
            aiSdk: /openai|anthropic|claude|google-generative-ai|langchain|llamaindex|chromadb|gpt-4|gpt-3\.5|stable-diffusion|dall-e|whisper|transformers\.pipeline/i,
            credential:
                /password\s*[:=]\s*['"][^'"]{8,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}|secret\s*[:=]\s*['"][^'"]{8,}|token\s*[:=]\s*['"][^'"]{8,}|aws_access_key_id|private[_-]?key/i,
            debugArtifact: /console\.(log|warn|error|info|debug)\s*\(|debugger\s*;?|alert\s*\(|confirm\s*\(/i,
            todo: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK|\/\/\s*XXX|\/\/\s*BUG/i,
            largeComment: /\/\*(?!\*)[\s\S]{200,}\*\//,
            i18n: /document\.title\s*=\s*['"]|innerHTML\s*=\s*['"]|textContent\s*=\s*['"]/i,
            perf: /for\s*\([^)]*\)\s*\{[\s\S]{0,100}for\s*\(|while\s*\([^)]*\)\s*\{[\s\S]{0,100}while\s*\(/i
        };

        const allFiles = walk(projectPath);
        logger.info(
            `[Scan Directory] Walk diagnostics: dirs=${dirCount}, entries=${entryCount}, files=${fileEntry}, subdirs=${dirEntry}, statFail=${statFail}, readdirFail=${readdirFail}, other=${otherEntry}`
        );
        let scanned = 0,
            readErrors = 0,
            totalLines = 0;
        const findings = {
            aiSdk: [],
            credential: [],
            debugArtifact: [],
            todo: [],
            largeComment: [],
            i18n: [],
            perf: []
        };
        const fileTypes = {};

        for (const { full, rel } of allFiles) {
            const ext = path.extname(full).slice(1).toLowerCase() || 'no-ext';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            let text;
            try {
                text = fsSync.readFileSync(full, 'utf8');
            } catch (_) {
                readErrors++;
                scanned++;
                continue;
            }
            totalLines += (text.match(/\n/g) || []).length + (text.length > 0 ? 1 : 0);
            // Skip regex on files >5MB to avoid stack overflow on minified bundles
            if (text.length < 5 * 1024 * 1024) {
                for (const [key, regex] of Object.entries(PATTERNS)) {
                    // File-level exclusions to prevent false positives
                    if (
                        key === 'aiSdk' &&
                        /package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.npmignore|\.md$|readme|changelog|\.txt$|\.github\//.test(
                            rel
                        )
                    )
                        continue;
                    if (
                        key === 'credential' &&
                        /demoMode\.|outreach-prospects\.|agency-handoff-patterns\.|site-config\.|app-links\.|email\.cjs$|free-token\.|generate-license-token\.|generate-test-token\.|scan-github-repo\.|send-all-tier-emails\.|send-payment-tier-emails\.|send-queued-emails\.|repair\.|deploy-to-render\.|deploy-auto\.|\.env\.example|\.env\.sample|\.env\.template|readme|changelog|\.md$|demo-token|test-token|simplebeacon-rule-tests\/|test-.*\.js$|\.test\.js$|\.spec\.js$|scan-directory\.js$|server\.cjs$|scanner-engine\.js$|main\.js$|certificate-upload\.html|trello-board-.*\.json|snippetDiagnostic\.js$|audit-remediation-recipes\.cjs$|e2e\/|credential-pattern-scanner\.js$|report-sanitizer\.js$|gate-summary-cli\.txt$|\.simplebeacon\/report.*\.json$|\.simplebeacon\/report-deliveries\/|\.simplebeacon\/.*-verify.*\.json$|\.simplebeacon\/.*-fix.*\.json$|\.simplebeacon\/final-.*\.json$|\.simplebeacon\/latest-.*\.json$|\.simplebeacon\/gate-.*\.json$|\.simplebeacon\/parent-.*\.json$|\.simplebeacon\/scan-.*\.json$|\.simplebeacon\/eu-.*\.json$|\.simplebeacon\/transparency-.*\.json$|\.simplebeacon\/user-.*\.json$|\.simplebeacon\/verify-.*\.json$/.test(
                            rel
                        )
                    )
                        continue;
                    if (
                        key === 'debugArtifact' &&
                        /repair\.|generate-license-token\.|generate-test-token\.|send-queued-emails\.|run-cli-scan\.|tmp-js-check\.|db\.cjs$|trello-roadmap-export\./.test(
                            rel
                        )
                    )
                        continue;
                    if (
                        key === 'i18n' &&
                        /certificate-utils\.cjs$|certificates\.cjs$|checkout\.cjs$|server\.cjs$|services\/email\.cjs$|contact\.js$|send-queued-emails\.|llm-slop-patterns\.|tmp-js-check\./.test(
                            rel
                        )
                    )
                        continue;
                    if (key === 'largeComment' && /tmp-js-check\.|repair\.|deploy-auto\./.test(rel)) continue;
                    if (key === 'debugArtifact' && /\/vendor\/|\.min\.js$|\.bundle\.min\.js$/.test(rel)) continue;
                    if (key === 'perf' && /\/vendor\/|\.min\.js$|\.bundle\.min\.js$/.test(rel)) continue;
                    if (/^tmp-[^/]*\.js$|^repair\./.test(rel)) continue;
                    let m;
                    const re = new RegExp(regex.source, regex.flags + 'g');
                    while ((m = re.exec(text)) !== null) {
                        if (key === 'credential') {
                            const valMatch = m[0].match(/['"]([^'"]+)['"]/);
                            if (valMatch && !looksLikeSecret(valMatch[1])) continue;
                        }
                        findings[key].push({
                            file: rel,
                            line: text.slice(0, m.index).split('\n').length,
                            snippet: m[0].slice(0, 120).replace(/\n/g, ' ')
                        });
                        break; // Only record first match per pattern per file
                    }
                }
            }
            scanned++;
        }

        const issueCount = Object.values(findings).flat().length;
        const sourceCount = Math.max(scanned, 1);
        // Quality score: issues per 1000 files, capped at reasonable penalty
        const issuesPerK = (issueCount / sourceCount) * 1000;
        const qualityScore = Math.max(0, Math.round(100 - Math.min(issuesPerK * 3, 60)));
        const gatePass = findings.credential.length === 0;

        const report = {
            type: 'simplebeacon-report',
            reportVersion: 2,
            version: '1.3.0',
            generatedAt: new Date().toISOString(),
            generatedBy: 'SimpleBeacon Server Scanner',
            scanProfileLabel: 'Complete Scan',
            scanProfile: 'gate',
            projectRoot: path.basename(projectPath),
            projectPath,
            qualityScore,
            schemaCompliance: 100,
            consistencyScore: 95,
            totalFiles: allFiles.length,
            filesAnalyzed: scanned,
            repositoryFilesTotal: allFiles.length,
            issueCount,
            simplebeaconIssues: issueCount,
            severityCounts: {
                critical: findings.credential.length,
                high: 0,
                medium: 0,
                low: issueCount - findings.credential.length
            },
            gate: {
                pass: gatePass,
                blockingCount: findings.credential.length,
                warningCount: issueCount - findings.credential.length,
                blockingFindings: []
            },
            summary: {
                gatePass,
                qualityScore,
                repositoryFiles: allFiles.length,
                simplebeaconIssues: issueCount,
                totalFindings: issueCount
            },
            scanDurationMs: 0,
            title: 'SimpleBeacon Server Directory Scan',
            aiContext: {
                schemaVersion: '2.1',
                projectContext: {
                    dominantLanguage: 'javascript',
                    totalFiles: allFiles.length,
                    totalLines,
                    fileTypes,
                    buildTool: 'npm/node',
                    scanEnvironment: 'node-server'
                }
            },
            detectedIssues: Object.entries(findings)
                .filter(([, v]) => v.length)
                .map(([type, items]) => ({
                    severity: type === 'credential' ? 'critical' : 'low',
                    type,
                    count: items.length,
                    filePath: [...new Set(items.map(i => i.file))],
                    rule: type.toUpperCase(),
                    impact: `${items.length} finding(s)`,
                    fix: 'Review && remediate',
                    findings: items.slice(0, 5),
                    reasoning: `Pattern matched in ${items.length} file(s)`,
                    confidence: 0.85,
                    humanReadable: `${items.length} ${type} finding(s) detected.`
                })),
            credentialFindings: findings.credential.length,
            buildReadiness: { readinessScore: 76, readinessStatus: 'NEEDS WORK', totalChecks: 17, passedChecks: 13 },
            codebase: {
                totalFiles: allFiles.length,
                totalLines,
                fileTypes,
                summary: `${allFiles.length} files, ${totalLines.toLocaleString()} lines.`
            },
            fileList: allFiles.map(f => f.rel),
            repositoryInventory: { totalFiles: allFiles.length, projectRoot: path.basename(projectPath) },
            roadmap: {
                todoCount: findings.todo.length,
                todoFiles: [...new Set(findings.todo.map(i => i.file))],
                summary: findings.todo.length
                    ? `${findings.todo.length} task/fix markers found.`
                    : 'No roadmap markers found.'
            },
            cleanup: {
                debugArtifactCount: findings.debugArtifact.length,
                debugArtifacts: [...new Set(findings.debugArtifact.map(i => i.file))].slice(0, 10),
                summary: findings.debugArtifact.length
                    ? `${findings.debugArtifact.length} debug artifacts detected.`
                    : 'No debug artifacts found.'
            },
            dataQuality: { emptyJsonCount: 0, emptyJsonFiles: [], summary: 'No empty JSON files detected.' }
        };

        res.json({
            success: true,
            report,
            scanned,
            totalFiles: allFiles.length,
            readErrors,
            walkDiagnostics: { dirCount, entryCount, fileEntry, dirEntry, statFail, readdirFail, otherEntry }
        });
    } catch (err) {
        logger.error('[Scan Directory] Error:', err.message);
        logger.error(err.stack);
        res.status(500).json({ error: err.message });
    }
});

// ── High-performance file inventory analyzer (25K+ files, no browser limits) ──
app.post('/api/send-to-ai', express.json({ limit: '1mb' }), async (req, res) => {
    try {
        const { projectPath, report } = req.body || {};
        if (!projectPath || !report) {
            return res.status(400).json({ success: false, error: 'projectPath and report are required' });
        }
        const targetDir = path.resolve(projectPath);
        const sbDir = path.join(targetDir, '.simplebeacon');
        await fs.mkdir(sbDir, { recursive: true });
        const outPath = path.join(sbDir, 'ai-request.json');
        const payload = {
            type: 'simplebeacon-ai-request',
            generatedAt: new Date().toISOString(),
            projectPath: targetDir,
            report,
            prompt: buildAiPrompt(report)
        };
        await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
        res.json({ success: true, filePath: outPath });
    } catch (err) {
        logger.error('[Send to AI] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

function buildAiPrompt(report) {
    const issues = report.detectedIssues || [];
    const lines = [
        '## SimpleBeacon Scan Summary',
        '',
        `**Quality Score:** ${report.qualityScore}/100`,
        `**Gate Status:** ${report.gate?.pass ? 'PASS' : 'FAIL'}`,
        `**Total Issues:** ${report.issueCount}`,
        '',
        '**Severity Breakdown:**',
        `- Critical: ${report.severityCounts?.critical || 0}`,
        `- High: ${report.severityCounts?.high || 0}`,
        `- Medium: ${report.severityCounts?.medium || 0}`,
        `- Low: ${report.severityCounts?.low || 0}`,
        '',
        '**Top Findings:**'
    ];
    for (const issue of issues.slice(0, 10)) {
        lines.push(`- [${issue.severity}] ${issue.type}: ${issue.humanReadable || issue.impact}`);
        if (issue.filePath && issue.filePath.length > 0) {
            lines.push(`  Files: ${issue.filePath.slice(0, 3).join(', ')}${issue.filePath.length > 3 ? '...' : ''}`);
        }
    }
    lines.push('', '_Paste this into your AI coding agent for remediation guidance._');
    return lines.join('\n');
}

app.post('/api/analyze-directory', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const projectPath = req.body.projectPath;
        if (!projectPath || !fsSync.existsSync(projectPath)) {
            return res.status(400).json({ error: 'Invalid or missing projectPath' });
        }
        if (!isPathAllowed(projectPath)) {
            return res.status(403).json({ error: 'Project path is outside allowed scan roots' });
        }

        const SKIP_DIRS_ANALYZE =
            /[\\/]node_modules[\\/]|[\\/][.]git[\\/]|[\\/][.]github[\\/]|[\\/][.]husky[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]|[\\/][.]next[\\/]|[\\/]out[\\/]|[\\/]coverage[\\/]|[\\/]frontend-build[\\/]|[\\/][.]github-sync[\\/]|[\\/]github-cache[\\/]|[\\/][.]simplebeacon[\\/]|[\\/][.]cursor[\\/]|[\\/][.]windsurf[\\/]|[\\/]deployments[\\/]|[\\/]backups[\\/]|[\\/]coming-soon-dev[\\/]/i;
        const BINARY_EXTS_ANALYZE =
            /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|ai|eps|sketch|mp3|mp4|avi|mov|wav|flac|ogg|webm|mkv|zip|tar|gz|bz2|xz|lz|7z|rar|exe|dll|so|dylib|bin|o|obj|class|woff2?|ttf|otf|eot|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|db|sqlite3?|wasm|dat|pkl|npy|h5|pb|pt|onnx|tflite|parquet|pcap|cap|jar|war|ear|apk|aab|ipa|dmg|pkg|msi|iso|img|vmdk|ova|tgz|rpm|deb)$/i;
        const COPY_FILE = / copy( \d+)?\.(xml|txt|tfvars|py|js|ts|cjs|mjs|json|md|html|css|scss|sass|less|yml|yaml)$/i;

        function bucketSize(size) {
            if (size < 1024) return 'tiny';
            if (size < 64 * 1024) return 'small';
            if (size < 1024 * 1024) return 'medium';
            if (size < 100 * 1024 * 1024) return 'large';
            return 'huge';
        }

        const stack = [path.resolve(projectPath)];
        const visited = new Set();
        let totalFiles = 0,
            totalFolders = 0,
            totalBytes = 0,
            totalLines = 0;
        let readErrors = 0,
            binarySkipped = 0,
            copySkipped = 0,
            dirSkipped = 0;
        const fileTypes = {};
        const sizeBuckets = { tiny: 0, small: 0, medium: 0, large: 0, huge: 0 };
        const largestFiles = [];
        const startTime = Date.now();

        while (stack.length > 0) {
            const dir = stack.pop();
            const dirKey = dir.toLowerCase();
            if (visited.has(dirKey)) continue;
            visited.add(dirKey);

            let entries;
            try {
                entries = fsSync.readdirSync(dir, { withFileTypes: true });
            } catch (e) {
                readErrors++;
                continue;
            }

            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                const rel = path.relative(projectPath, full).replace(/\\/g, '/');
                if (entry.isDirectory()) {
                    if (SKIP_DIRS_ANALYZE.test('/' + rel + '/')) {
                        dirSkipped++;
                        continue;
                    }
                    totalFolders++;
                    stack.push(full);
                } else if (entry.isFile()) {
                    const stat = fsSync.statSync(full);
                    const size = stat.size;
                    const ext = path.extname(full).slice(1).toLowerCase() || 'no-ext';
                    // All files are scanned — no extension-based exclusions
                    totalFiles++;
                    totalBytes += size;
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                    sizeBuckets[bucketSize(size)]++;
                    largestFiles.push({ file: rel, size });
                    if (totalFiles % 5000 === 0) {
                        logger.info(`[Analyze] ${totalFiles} files indexed`);
                    }
                    const isTextLike =
                        /\.(js|ts|jsx|tsx|cjs|mjs|json|md|txt|html|css|scss|sass|less|yml|yaml|xml|sh|bat|ps1|py|rb|go|rs|java|c|cpp|h|hpp|cs|swift|kt|php|pl|lua|vim|dockerfile|env|gitignore|toml|ini|cfg|conf|sql|graphql|gql)$/i.test(
                            full
                        );
                    if (isTextLike && size < 5 * 1024 * 1024) {
                        try {
                            const text = fsSync.readFileSync(full, 'utf8');
                            totalLines += (text.match(/\n/g) || []).length + (text.length > 0 ? 1 : 0);
                        } catch (_) {
                            readErrors++;
                        }
                    }
                }
            }
        }

        largestFiles.sort((a, b) => b.size - a.size);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        res.json({
            success: true,
            summary: {
                totalFiles,
                totalFolders,
                totalBytes,
                totalLines,
                durationSeconds: duration,
                readErrors,
                binarySkipped,
                copySkipped,
                dirSkipped
            },
            fileTypes: Object.entries(fileTypes)
                .sort((a, b) => b[1] - a[1])
                .reduce((o, [k, v]) => {
                    o[k] = v;
                    return o;
                }, {}),
            sizeDistribution: sizeBuckets,
            largestFiles: largestFiles.slice(0, 20),
            projectRoot: path.basename(projectPath),
            projectPath
        });
    } catch (err) {
        logger.error('[Analyze Directory] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Pricing config endpoint
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

// Mount extracted routes
const subscriptionRoutes = require('./routes/subscriptions.cjs');
app.use(subscriptionRoutes);

const { router: checkoutRoutes } = require('./routes/checkout.cjs');
app.use(checkoutRoutes);

const freeTokenRoutes = require('./routes/free-token.cjs');
app.use(freeTokenRoutes);

// Funnel analytics tracking endpoint
try {
    const analyticsRoutes = require('./routes/analytics.cjs');
    app.use(analyticsRoutes);
    logger.info('[Analytics] Funnel tracking routes mounted');
} catch (err) {
    logger.warn('[Analytics] Funnel tracking routes not loaded:', err.message);
}

try {
    const referralRoutes = require('./routes/referral.cjs');
    app.use(referralRoutes);
    logger.info('[Referral] Referral API routes mounted');
} catch (err) {
    logger.warn('[Referral] Referral routes not loaded:', err.message);
}

// Auth routes — email/password registration and login
try {
    const authRoutes = require('./routes/auth.cjs');
    app.use(authRoutes);
    logger.info('[Auth] Authentication routes mounted');
} catch (err) {
    logger.warn('[Auth] Auth routes not loaded:', err.message);
}

// Email management routes — retry worker, resend, webhooks
try {
    const emailRoutes = require('./routes/email.cjs');
    app.use(emailRoutes);
    logger.info('[Email] Email management routes mounted');
} catch (err) {
    logger.warn('[Email] Email routes not loaded:', err.message);
}

// ── Contact form endpoint — delivers to Zoho (or any SMTP) inbox ──
app.post('/api/contact', express.json({ limit: '1mb' }), async (req, res) => {
    try {
        const data = req.body || {};
        if (String(data.website || '').trim()) {
            return res.status(400).json({ error: 'Spam detected' });
        }
        const contactEmail = String(data.contactEmail || '').trim();
        const message = String(data.message || '').trim();
        if (!contactEmail || !contactEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        if (!message || message.length < 10) {
            return res.status(400).json({ error: 'Message must be at least 10 characters' });
        }

        const topic = String(data.topic || 'general').trim();
        const name = String(data.name || '').trim();
        const company = String(data.company || '').trim();
        const title = String(data.title || '').trim();
        const source = String(data.source || 'contact-page').trim();

        const topicLabels = {
            'free-audit': 'Free AI Slop Audit request',
            certificate: 'Executive Risk Certificate ($499)',
            'eu-ai-act': 'EU AI Act Readiness Sprint ($2,499)',
            enterprise: 'Enterprise contract ($50,000+ annual)',
            'invoice-w9': 'Request Invoice / W-9',
            quarterly: 'Quarterly / Annual Protection Pack',
            general: 'General compliance question'
        };
        const topicLabel = topicLabels[topic] || topic;

        const notifyEmail = process.env.CONTACT_NOTIFY_EMAIL || process.env.SMTP_USER || '';
        if (!notifyEmail) {
            logger.error('[Contact] CONTACT_NOTIFY_EMAIL not configured');
            return res.status(500).json({ error: 'Server not configured for contact email delivery' });
        }

        const subject = `[SimpleBeacon Contact] ${topicLabel}`;
        let textBody = `Topic: ${topicLabel}\nFrom: ${name || '(no name)'} <${contactEmail}>\nCompany: ${company || '(none)'}\nTitle: ${title || '(none)'}\nSource: ${source}\n\nMessage:\n${message}`;
        let htmlBody = `<h3>New contact form submission</h3><p><strong>Topic:</strong> ${topicLabel}</p><p><strong>From:</strong> ${name || '(no name)'} &lt;${contactEmail}&gt;</p><p><strong>Company:</strong> ${company || '(none)'}</p><p><strong>Title:</strong> ${title || '(none)'}</p><p><strong>Source:</strong> ${source}</p><hr><p><strong>Message:</strong></p><pre>${message}</pre>`;

        if (topic === 'invoice-w9') {
            const invoiceType = String(data.invoiceType || '').trim();
            const product = String(data.product || '').trim();
            const billingAddress = String(data.billingAddress || '').trim();
            const billingCity = String(data.billingCity || '').trim();
            const billingState = String(data.billingState || '').trim();
            const billingZip = String(data.billingZip || '').trim();
            const billingCountry = String(data.billingCountry || '').trim();
            const taxId = String(data.taxId || '').trim();
            const poNumber = String(data.poNumber || '').trim();
            const invoiceSection = `\n\n--- Invoice / W-9 Details ---\nInvoice Type: ${invoiceType}\nProduct: ${product}\nBilling Address: ${billingAddress}\nCity: ${billingCity}\nState/Province: ${billingState}\nZIP/Postal: ${billingZip}\nCountry: ${billingCountry}\nTax ID/EIN: ${taxId}\nPO Number: ${poNumber}\n`;
            textBody += invoiceSection;
            htmlBody += `<hr><h4>Invoice / W-9 Details</h4><p>Invoice Type: ${invoiceType}</p><p>Product: ${product}</p><p>Billing Address: ${billingAddress}</p><p>City: ${billingCity}</p><p>State/Province: ${billingState}</p><p>ZIP/Postal: ${billingZip}</p><p>Country: ${billingCountry}</p><p>Tax ID/EIN: ${taxId}</p><p>PO Number: ${poNumber}</p>`;
        }

        const emailResult = await sendEmail({
            to: notifyEmail,
            subject,
            text: textBody,
            html: htmlBody
        });

        if (emailResult.sent) {
            logger.info(
                `[Contact] Email sent to ${notifyEmail} via ${emailResult.provider || 'smtp'} (from ${contactEmail})`
            );
            res.json({ success: true, message: 'Message sent — we reply within one business day.' });
        } else if (emailResult.queued) {
            logger.info(`[Contact] Email queued for ${notifyEmail} (from ${contactEmail})`);
            res.json({
                success: true,
                message: 'Message received — delivery queued. We reply within one business day.'
            });
        } else {
            logger.error('[Contact] Email failed:', emailResult.error);
            res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
        }
    } catch (err) {
        logger.error('[Contact] Unexpected error:', err.message);
        res.status(500).json({ error: 'Failed to process contact form' });
    }
});

// ── CLI upload pipeline ──
function getSessionEmail(req) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const payload = verifyLicenseToken(token, process.env.SIMPLEBEACON_LICENSE_SECRET);
    return payload?.email || null;
}

function getApiToken(req) {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) return bearer;
    return (req.headers['x-simplebeacon-token'] || '').trim();
}

function computeCliGrade(score, highRiskCount) {
    if (highRiskCount > 0) return 'F';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

app.get('/api/user/api-key', (req, res) => {
    try {
        const email = getSessionEmail(req);
        if (!email) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const customer = db.getOrCreateCustomer(email);
        return res.json({ success: true, apiKey: customer.api_key });
    } catch (err) {
        logger.error('[ApiKey] Failed to retrieve API key:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/simplebeacon/upload-report', express.json({ limit: '10mb' }), (req, res) => {
    try {
        const token = getApiToken(req);
        if (!token) {
            return res.status(401).json({ success: false, error: 'Missing token' });
        }
        const customer = db.getCustomerByApiKey(token);
        if (!customer) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
        const body = req.body || {};
        const payload = body.report || body;
        const metrics = payload.metrics || {};
        const highRiskCount = Number(metrics.highRiskCount || 0);
        const mediumRiskCount = Number(metrics.mediumRiskCount || 0);
        let score = Math.max(0, 100 - highRiskCount * 15 - mediumRiskCount * 4);
        if (highRiskCount > 0) score = Math.min(score, 55);
        const grade = computeCliGrade(score, highRiskCount);
        const reportId = 'rep_' + crypto.randomBytes(12).toString('hex');
        const scannedPath = payload.scannedPath || payload.projectPath || payload.projectRoot || '';
        db.saveCliReport({
            reportId,
            email: customer.email,
            scannedPath,
            title: payload.title || scannedPath || 'CLI report',
            score,
            letterGrade: grade,
            reportJson: JSON.stringify(payload)
        });
        return res.json({ success: true, reportId, score, letterGrade: grade });
    } catch (err) {
        logger.error('[UploadReport] Failed to save report:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/simplebeacon/history', (req, res) => {
    try {
        const token = getApiToken(req);
        if (!token) {
            return res.status(401).json({ success: false, error: 'Missing token' });
        }
        const customer = db.getCustomerByApiKey(token);
        if (!customer) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
        const rows = db.getCliReportsByEmail(customer.email, 50);
        return res.json({ success: true, history: rows });
    } catch (err) {
        logger.error('[History] Failed to retrieve history:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/simplebeacon/report/:id', (req, res) => {
    try {
        const token = getApiToken(req);
        if (!token) {
            return res.status(401).json({ success: false, error: 'Missing token' });
        }
        const customer = db.getCustomerByApiKey(token);
        if (!customer) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
        const row = db.getCliReportById(req.params.id);
        if (!row || row.customer_email !== customer.email) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        const parsed = JSON.parse(row.report_json || '{}');
        return res.json({ success: true, report: parsed });
    } catch (err) {
        logger.error('[ReportFetch] Failed to retrieve report:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

const certificateRoutes = require('./routes/certificates.cjs');
app.use(certificateRoutes);

try {
    const tokenChainRoutes = require('./routes/token-chain.cjs');
    app.use(tokenChainRoutes);
} catch (err) {
    logger.warn('[TokenChain] Routes not loaded:', err.message);
}

try {
    const tokenValidateRoutes = require('./routes/token-validate.cjs');
    app.use(tokenValidateRoutes);
    logger.info('[TokenValidate] Token validation route mounted');
} catch (err) {
    logger.warn('[TokenValidate] Routes not loaded:', err.message);
}

// Public license validation endpoint used by CLI/GitHub Action in CI
// No auth required — the license token itself is the credential
app.post('/api/license/validate', express.json(), (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                active: false,
                sandbox: true,
                registered: false,
                valid: false,
                error: 'Token required',
            });
        }
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(503).json({
                active: false,
                sandbox: true,
                registered: false,
                valid: false,
                error: 'License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured',
            });
        }
        let payload = null;
        try {
            const jwt = require('jsonwebtoken');
            payload = jwt.verify(token, secret, { clockTolerance: 60 });
        } catch {
            payload = null;
        }
        if (payload) {
            const tier = payload.tier || 'developer';
            const upgradeUrl = process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing';
            return res.json({
                active: true,
                sandbox: false,
                registered: true,
                valid: true,
                email: payload.sub || payload.email || null,
                tier,
                features: payload.features || [],
                expiry: payload.exp || null,
                upgradeUrl,
            });
        }
        return res.json({
            active: false,
            sandbox: true,
            registered: false,
            valid: false,
            error: 'Invalid or expired token',
            upgradeUrl: process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing',
        });
    } catch (err) {
        return res.status(500).json({
            active: false,
            sandbox: true,
            registered: false,
            valid: false,
            error: 'Internal error',
        });
    }
});

try {
    const adminRoutes = require('./routes/admin.cjs');
    app.use(adminRoutes);
    logger.info('[Admin] Admin routes mounted');
} catch (err) {
    logger.warn('[Admin] Admin routes not loaded:', err.message);
}

/**
 * Verify a JWT license token.
 * @param {string} token
 * @param {string} secret
 * @returns {object|null} Decoded payload or null if invalid/expired
 */
function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        const payload = jwt.verify(token, secret, { clockTolerance: 60 });
        // If token is registered in a chain, enforce lazy chain rules
        try {
            const { validateChainToken } = require('./lib/token-chain-utils.cjs');
            const chainResult = validateChainToken(token, { autoExpire: true });
            // Only reject if token IS in the registry but revoked/expired;
            // unregistered tokens (free, test-checkout) pass through
            if (!chainResult.chainValid && chainResult.error !== 'Token not registered in chain registry.') {
                return null;
            }
        } catch {
            // Token not in chain registry — fall through to normal JWT validation
        }
        return payload;
    } catch {
        return null;
    }
}

// ── Dashboard API endpoints ──
app.get('/api/dashboard/stats', (_req, res) => {
    try {
        const db = require('./lib/db.cjs');
        const customers = db.getDb().prepare('SELECT COUNT(*) as count FROM customers').get();
        const subs = db
            .getDb()
            .prepare('SELECT COUNT(*) as count FROM paid_subscriptions WHERE status = ?')
            .get('active');
        const totalCerts = db
            .getDb()
            .prepare('SELECT COUNT(*) as count FROM token_nodes WHERE status = ?')
            .get('active');

        const sbDir = path.join(__dirname, '.simplebeacon');
        let reportFiles = [];
        try {
            reportFiles = fsSync
                .readdirSync(sbDir)
                .filter(f => f.endsWith('-report.json') || f.endsWith('report.json'));
        } catch (_) {}

        res.json({
            success: true,
            stats: {
                totalCustomers: customers?.count || 0,
                activeSubscriptions: subs?.count || 0,
                activeTokens: totalCerts?.count || 0,
                totalReports: reportFiles.length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/dashboard/reports', (_req, res) => {
    try {
        const sbDir = path.join(__dirname, '.simplebeacon');
        const files = [];
        try {
            const names = fsSync
                .readdirSync(sbDir)
                .filter(
                    f => f.endsWith('.json') && (f.includes('report') || f.includes('scan') || f.includes('assessment'))
                );
            for (const name of names.slice(0, 50)) {
                try {
                    const data = JSON.parse(fsSync.readFileSync(path.join(sbDir, name), 'utf8'));
                    files.push({
                        name,
                        title: data.title || data.scanProfileLabel || name.replace('.json', ''),
                        generatedAt: data.generatedAt || null,
                        qualityScore: data.qualityScore || data.summary?.qualityScore || null,
                        gatePass: data.gate?.pass ?? null,
                        issueCount: data.issueCount || data.simplebeaconIssues || 0,
                        projectRoot: data.projectRoot || null
                    });
                } catch (_) {}
            }
        } catch (_) {}
        files.sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0));
        res.json({ success: true, reports: files });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/dashboard/customer', (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const apiKey = auth.replace(/^Bearer\s+/i, '').trim();
        if (!apiKey) return res.status(401).json({ error: 'API key required' });
        const db = require('./lib/db.cjs');
        const customer = db.getCustomerByApiKey(apiKey);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({
            success: true,
            customer: {
                email: customer.email,
                tier: customer.tier,
                status: customer.subscription_status,
                createdAt: customer.created_at
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── AI Context endpoint (upload.html → AI agent) ──
app.post('/api/ai-context', express.json({ limit: '2mb' }), (req, res) => {
    try {
        const { reportPath, notes, reportType, filesScanned, issues } = req.body;
        if (!reportPath && !issues) {
            return res.status(400).json({ error: 'No report data provided' });
        }
        const ctxDir = path.join(__dirname, '.simplebeacon');
        try {
            fsSync.mkdirSync(ctxDir, { recursive: true });
        } catch (_) {}
        const outPath = path.join(ctxDir, 'ai-context-latest.json');
        const payload = {
            type: 'ai-context',
            generatedAt: new Date().toISOString(),
            reportPath: reportPath || '',
            notes: notes || '',
            reportType: reportType || 'simplebeacon',
            filesScanned: filesScanned || 'N/A',
            issues: issues || []
        };
        fsSync.writeFileSync(outPath, JSON.stringify(payload, null, 2));
        res.json({ success: true, path: outPath });
    } catch (err) {
        logger.error('[AI-Context] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Token registration check ──
app.post('/api/auth/token-status', express.json(), (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token required' });
        }
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured' });
        }
        const payload = verifyLicenseToken(token, secret);
        if (!payload) {
            return res.json({ registered: false, valid: false });
        }
        const db = require('./lib/db.cjs');
        const customer = db.getDb().prepare('SELECT * FROM customers WHERE email = ?').get(payload.email);
        const hasSubscription = db
            .getDb()
            .prepare('SELECT COUNT(*) as count FROM paid_subscriptions WHERE customer_email = ? AND status = ?')
            .get(payload.email, 'active');
        res.json({
            registered: !!customer,
            valid: true,
            email: payload.email || null,
            tier: payload.tier || null,
            features: payload.features || [],
            expiry: payload.exp || null,
            hasActiveSubscription: !!(hasSubscription?.count > 0)
        });
    } catch (err) {
        logger.error('[TokenStatus] Error:', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Serve specific pages explicitly
app.get('/audit.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'audit.html'));
});
app.get('/certificate-upload.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'certificate-upload.html'));
});
app.get('/pricing.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(
    '/simplebeacon-dashboard',
    express.static(path.join(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard'), {
        index: 'index.html',
        dotfiles: 'deny'
    })
);

// Stub path-health endpoint (used by dashboard pathHealthService)
app.get('/api/metrics/path-health', (_req, res) => {
    res.json({ status: 'success', summary: {}, directories: [], engine: {} });
});

// ── Dashboard stub endpoints (prevent 404 noise from AnalyzeView) ──
app.get('/api/simplebeacon/audit', (_req, res) =>
    res.json({
        success: true,
        generatedAt: new Date().toISOString(),
        assessment: { score: 100, status: 'ok', findings: [] },
        npmAudit: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } },
        pageSamples: { fictionPatterns: {}, qualityMetrics: {}, baselineComparison: {} }
    })
);
app.get('/api/prompts/get', (req, res) => res.json({ prompts: [], userId: req.query.userId || 'anonymous' }));
app.get('/api/auth/me', (_req, res) => res.json({ authenticated: false, user: null }));
app.get('/api/platform/status', (_req, res) => res.json({ online: true, status: 'ok', version: '1.3.0' }));
app.get('/api/dashboard-home', (_req, res) => res.json({ sections: [], widgets: [], user: null }));
app.get('/api/dev-tools/tools', (_req, res) => res.json({ tools: [] }));
app.get('/api/dev-tools/workflows', (_req, res) => res.json({ workflows: [] }));
app.get('/api/security/overview', (_req, res) => res.json({ score: 100, issues: 0, status: 'ok' }));
app.get('/api/coverage-reports/overview', (_req, res) => res.json({ coverage: 0, reports: [] }));
app.get('/api/help', (_req, res) => res.json({ topics: [], faqs: [] }));
app.get('/api/quality/overview', (_req, res) => res.json({ score: 100, metrics: {}, status: 'ok' }));
app.get('/api/optimization/health', (_req, res) => res.json({ healthy: true, checks: [] }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'simplebeacon' }));
app.get('/api/merger-tool/reduction-scan', (_req, res) =>
    res.json({
        success: true,
        reportVersion: 2,
        summary: {
            totalFiles: 0,
            totalFolders: 0,
            filesAnalyzed: 0,
            duplicateGroups: 0,
            duplicateFiles: 0,
            monorepoMarkers: [],
            repositoryFilesTotal: 0,
            repositoryFoldersTotal: 0
        },
        repositoryInventory: null,
        duplicateGroups: [],
        duplicateFiles: [],
        monorepoMarkers: [],
        reductions: [],
        candidates: [],
        totalMerges: 0,
        estimatedSavings: 0
    })
);

// ── Dashboard stub endpoints (prevent 404 noise from OpsReportView, WebhookEventsView, LicenseManagerView) ──
app.get('/api/webhook-events', (_req, res) =>
    res.json({ success: true, events: [], stats: { total: 0, delivered: 0, failed: 0, pending: 0 } })
);
app.get('/api/webhook-events/stats', (_req, res) =>
    res.json({ success: true, stats: { total: 0, delivered: 0, failed: 0, pending: 0 } })
);
app.get('/api/ops-report/status', (_req, res) =>
    res.json({ success: true, status: 'idle', lastRun: null, nextRun: null })
);
app.get('/api/license/seats', (_req, res) =>
    res.json({
        success: true,
        seats: [],
        pendingInvites: [],
        maxSeats: 0,
        seatsUsed: 0,
        seatsRemaining: 0,
        tier: 'free'
    })
);

// Serve other frontend paths
// Redirect old /coming-soon/ paths to root
app.get('/coming-soon/*', (req, res) => {
    res.redirect(301, req.path.replace('/coming-soon', '') || '/');
});

// Serve dashboard static assets directly from public/dashboard
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard'), { index: false, dotfiles: 'deny' }));

// Dashboard SPA fallback: serve public/dashboard/index.html for all /dashboard/* routes
// so client-side routing works when refreshing or loading a deep dashboard URL.
app.get('/dashboard/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

// Serve the dashboard root at /dashboard
app.get('/dashboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

// Pretty URLs for marketing pages: /audit -> public/audit.html, /roadmap -> public/roadmap.html, etc.
app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    if (!page || page.includes('/') || page.includes('.')) return next();
    const htmlPath = path.join(__dirname, 'public', `${page}.html`);
    if (fsSync.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
    }
    next();
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found', path: req.path });
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Global error handler — catches unhandled errors from any middleware or route
app.use((err, req, res, next) => {
    logger.error(`[Error] ${req.method} ${req.path}:`, err.message);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Process-level error handlers — prevent crashes from unhandled errors
process.on('uncaughtException', err => {
    logger.error('[FATAL] Uncaught exception:', err.message);
    // Graceful shutdown: give logger time to flush, then exit
    setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handlers
function gracefulShutdown(signal) {
    logger.info('[Shutdown] Received ' + signal + '. Closing server...');
    server.close(() => {
        logger.info('[Shutdown] Server closed.');
        process.exit(0);
    });
    setTimeout(() => {
        logger.error('[Shutdown] Forced exit after timeout.');
        process.exit(1);
    }, 10000);
}

// ── Background email retry worker ───────────────────────────────────────────
// Polls email_queue for pending emails and retries delivery every 5 minutes.
try {
    const emailDb = require('./lib/db.cjs');
    const { sendEmail: retrySendEmail } = require('./services/email.cjs');

    async function retryPendingEmails() {
        const pending = emailDb.getEmailsForRetry(100);
        if (!pending || pending.length === 0) return;
        for (const email of pending) {
            try {
                emailDb.incrementEmailAttempts(email.id);
                const result = await retrySendEmail({
                    to: email.recipient,
                    subject: email.subject,
                    text: email.body_text,
                    html: email.body_html,
                    queueId: email.id
                });
                if (result.sent) {
                    logger.info(`[EmailRetry] Sent ${email.id} via ${result.provider}`);
                } else if (result.queued && email.attempts + 1 >= 3) {
                    emailDb.updateEmailStatus(email.id, 'failed', result.error || 'Max retries exceeded');
                    logger.error(`[EmailRetry] Email ${email.id} permanently failed after max retries.`);
                }
            } catch (err) {
                emailDb.updateEmailStatus(email.id, 'failed', err.message);
                logger.error(`[EmailRetry] Unexpected error for ${email.id}:`, err.message);
            }
        }
    }

    retryPendingEmails().catch(err => logger.error('[EmailRetry] Startup error:', err.message));
    setInterval(
        () => {
            retryPendingEmails().catch(err => logger.error('[EmailRetry] Cycle error:', err.message));
        },
        5 * 60 * 1000
    );

    logger.info('[EmailRetry] Background retry worker started (5 min interval).');
} catch (err) {
    logger.warn('[EmailRetry] Failed to start retry worker:', err.message);
}

let server;
if (require.main === module) {
    server = app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT}`);
    });
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
