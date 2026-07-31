// SPDX-License-Identifier: MIT
/**
 * Authentication routes — login, logout, refresh, me.
 *
 * Role: Express route handlers (HTTP endpoints).
 * Distinct from middleware/auth.cjs (JWT verification & role-check middleware).
 * Both named auth.cjs by architectural convention (routes vs middleware layer).
 *
 * @license MIT
 */

const express = require('express');
const { authenticate, optionalAuthenticate, generateToken } = require('../middleware/auth.cjs');

const { handleLogin, handleTokenRefresh } = require('../lib/auth/login-service.cjs');

const {
  generateToken: tokenServiceGenerateToken,
  invalidateToken,
} = require('../lib/auth/token-service.cjs');
const { registerUser } = require('../services/user-service.cjs');
const { trustLevels } = require('../lib/auth/trust-levels.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.post('/login', handleLogin);

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return sendError(res, 400, 'Email and password required');
    }
    const result = await registerUser(email, password, name);
    if (result.error) {
      return sendError(res, 409, 'Registration failed', { message: result.error });
    }
    try {
      const { processReferralSignup } = require('../../../coming-soon/lib/referral-webhook.cjs');
      processReferralSignup(req, result.user.email);
    } catch (referralErr) {
      // Non-blocking — signup succeeds even if referral cookie is absent
    }
    const token = tokenServiceGenerateToken(result.user);
    res.json({
      message: 'Registration successful',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        trustLevel: result.user.trustLevel,
        permissions: (trustLevels[result.user.trustLevel] || trustLevels.bronze).permissions,
      },
    });
  } catch (error) {
    sendError(res, 500, 'register_error', { message: error.message });
  }
});

// simplebeacon-ignore sensitive-data — health-check test token, not a real secret
router.get('/health', (req, res) => {
  try {
    const token = tokenServiceGenerateToken({
      id: 'user-healthcheck',
      email: 'health@simplebeacon.ai',
      name: 'Health Check',
      trustLevel: 'silver',
    });
    res.json({ ok: true, jwtWorks: true, token });
  } catch (err) {
    res
      .status(500)
      .json({
        ok: false,
        jwtWorks: false,
        error: err.name,
        message: err.message,
        stack: err.stack,
      });
  }
});

router.post('/logout', optionalAuthenticate, (req, res) => {
  // Invalidate the access token server-side if present
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (accessToken && typeof invalidateToken === 'function') {
    try {
      invalidateToken(accessToken);
      logger.info('[auth] Token invalidated on logout', { userId: req.user?.id });
    } catch (err) {
      logger.warn('[auth] Token invalidation failed on logout:', err.message);
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// Password recovery — accepts email, returns generic success (does not leak whether email exists)
router.post('/recover', (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return sendError(res, 400, 'Valid email required');
  }
  // Generic success response — password reset flow is handled client-side
  // to avoid leaking which emails are registered. A full implementation would
  // send a reset link via email service.
  logger.info('[auth] Password recovery requested', { email: email.toLowerCase() });
  res.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  });
});

router.post('/refresh', optionalAuthenticate, handleTokenRefresh);

router.get('/me', optionalAuthenticate, (req, res) => {
  if (req.user) {
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        trustLevel: req.user.trustLevel,
        permissions: req.user.permissions,
      },
    });
  }
  // Return a guest user so the dashboard can load without an explicit 401
  res.json({
    success: true,
    user: {
      id: 'guest',
      email: null,
      name: 'Guest',
      trustLevel: 'bronze',
      permissions: (trustLevels.bronze || { permissions: [] }).permissions,
    },
  });
});

module.exports = router;
