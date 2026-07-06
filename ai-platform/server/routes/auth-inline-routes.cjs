const express = require('express');
const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const {
  authenticate,
  generateToken
} = require('../middleware/auth.cjs');

const {
  handleLogin,
  handleTokenRefresh
} = require('../lib/auth/login-service.cjs');
const { validateInput } = require('../middleware/security.cjs');
const { registerUser } = require('../services/user-service.cjs');
const { getLicenseToken, insertLicenseToken } = require('../lib/token-db.cjs');
const { isDatabaseEnabled, getDatabaseConfig } = require('../config/database.cjs');
const DatabaseAdapter = require('../lib/database-adapter.cjs');

const router = express.Router();

let dbAdapter = null;
if (isDatabaseEnabled()) {
  try {
    dbAdapter = new DatabaseAdapter(getDatabaseConfig());
  } catch (e) {
    console.warn('[Auth] Database adapter creation failed:', e.message);
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

router.post('/auth/register', authLoginRateLimit, validateInput('login'), async (req, res, next) => {
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

router.post('/auth/refresh', authenticate, handleTokenRefresh);

router.get('/auth/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    authenticated: true,
    timestamp: new Date().toISOString()
  });
});

router.post('/auth/logout', (req, res) => {
  res.json({ message: 'Logged out', timestamp: new Date().toISOString() });
});

// License token status check (known = login, unknown = register)
router.post('/auth/token-status', (req, res) => {
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

router.post('/auth/register-token', (req, res) => {
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
router.post('/tokens/sandbox', (req, res) => {
  const sandboxToken = generateToken({
    id: 'sandbox-' + Date.now(),
    email: 'sandbox@local.dev',
    name: 'Developer Sandbox',
    trustLevel: 'gold'
  });
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

module.exports = router;
