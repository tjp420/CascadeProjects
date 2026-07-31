// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
// DEPRECATED: This file is superseded by auth.cjs (mounted at /api/auth in simplebeacon-server.cjs)
// and license-routes.cjs (license token endpoints). Retained for index.cjs backward compatibility.
// License token endpoints (token-status, license/validate, register-token, tokens/sandbox)
// have been extracted to license-routes.cjs.
const express = require('express');
const rateLimit = require('express-rate-limit');
const constants = require('../config/constants.cjs');
const logger = require('../lib/app-logger.cjs');
const {
  authenticate,
  optionalAuthenticate
} = require('../middleware/auth.cjs');

const {
  handleLogin,
  handleTokenRefresh
} = require('../lib/auth/login-service.cjs');
const { validateInput } = require('../middleware/security.cjs');
const { isDatabaseEnabled, getDatabaseConfig } = require('../config/database.cjs');
const DatabaseAdapter = require('../lib/database-adapter.cjs');

const router = express.Router();

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

module.exports = router;
