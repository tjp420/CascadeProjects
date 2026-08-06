// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const express = require('express');
const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const logger = require('../lib/app-logger.cjs');
const {
  authenticate,
  optionalAuthenticate,
  generateToken
} = require('../middleware/auth.cjs');

const {
  handleLogin,
  handleTokenRefresh
} = require('../lib/auth/login-service.cjs');
const { validateInput } = require('../middleware/security.cjs');
const { getLicenseToken, insertLicenseToken } = require('../lib/token-db.cjs');
const { verifyLicenseToken } = require('../lib/simplebeacon-proxy.cjs');
const { isDatabaseEnabled, getDatabaseConfig } = require('../config/database.cjs');
const DatabaseAdapter = require('../lib/database-adapter.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function resolveLicenseSecret() {
  const secret = (process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  return secret || null;
}

let dbAdapter = null;
if (isDatabaseEnabled()) {
  try {
    dbAdapter = new DatabaseAdapter(getDatabaseConfig());
  } catch (e) {
    logger.warn('[Auth] Database adapter creation failed:', e.message);
  }
}

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

router.post('/auth/login', authLoginRateLimit, validateInput('login'), (req, res, next) => {
  if (dbAdapter) req.db = dbAdapter;
  next();
}, handleLogin);

router.post('/auth/register', authLoginRateLimit, async (req, res, next) => {
  try {
    const { handleRegister } = require('../lib/auth/registration-service.cjs');
    return await handleRegister(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/auth/refresh', authenticate, handleTokenRefresh);

router.get('/auth/me', optionalAuthenticate, (req, res) => {
  if (req.user) {
    res.json({
      user: req.user,
      authenticated: true,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      user: null,
      authenticated: false,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/auth/logout', (req, res) => {
  res.json({ message: 'Logged out', timestamp: new Date().toISOString() });
});

// License token status check (cryptographic validation + registry lookup)
router.post('/auth/token-status', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ registered: false, valid: false, error: 'Token required' });
  }

  const secret = resolveLicenseSecret();
  if (!secret) {
    return res.status(503).json({
      registered: false,
      valid: false,
      error: 'License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured'
    });
  }

  const claims = verifyLicenseToken(token, secret);
  if (claims) {
    const email = claims.sub || claims.email || null;
    const tier = claims.tier || 'developer';
    const entry = getLicenseToken(token);
    return res.json({
      registered: true,
      valid: true,
      email: entry?.email || email,
      tier: entry?.tier || tier,
      features: claims.features || [],
      registeredAt: entry?.registered_at || (claims.iat ? new Date(claims.iat * 1000).toISOString() : null),
      expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
      expiry: claims.exp || null
    });
  }

  const entry = getLicenseToken(token);
  if (entry) {
    return res.json({
      registered: true,
      valid: false,
      email: entry.email,
      tier: entry.tier,
      registeredAt: entry.registered_at
    });
  }
  return res.json({ registered: false, valid: false });
});

// Public license validation endpoint used by CLI/GitHub Action in CI
router.post('/license/validate', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ active: false, sandbox: true, registered: false, valid: false, error: 'Token required' });
  }

  const secret = resolveLicenseSecret();
  if (!secret) {
    return res.status(503).json({
      active: false,
      sandbox: true,
      registered: false,
      valid: false,
      error: 'License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured'
    });
  }

  const claims = verifyLicenseToken(token, secret);
  const entry = getLicenseToken(token);
  const registered = !!claims || !!entry;
  const active = registered && claims !== null;
  const tier = entry?.tier || claims?.tier || 'developer';
  const upgradeUrl = process.env.SIMPLEBEACON_UPGRADE_URL || 'https://simplebeacon.ai/pricing';

  res.json({
    active,
    sandbox: !active,
    registered,
    valid: !!claims,
    email: entry?.email || claims?.sub || claims?.email || null,
    tier,
    features: claims?.features || [],
    expiry: claims?.exp || null,
    upgradeUrl
  });
});

router.post('/auth/register-token', (req, res) => {
  const { token, email } = req.body || {};
  if (!token || typeof token !== 'string') {
    return sendError(res, 400, 'Token required');
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return sendError(res, 400, 'Valid email required');
  }
  const existing = getLicenseToken(token);
  if (existing) {
    return sendError(res, 409, 'Token already registered', { email: existing.email });
  }
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

// NOTE: /tokens/sandbox is handled by coming-soon/routes/free-token.cjs which is
// mounted at /api and provides email verification + validation code flow.
// The previous stub here shadowed that handler because auth-inline-routes.cjs
// is mounted before free-token.cjs in index.cjs. Removed to fix the conflict.

module.exports = router;
