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
const {
  authenticate,
  optionalAuthenticate,
  generateToken
} = require('../middleware/auth.cjs');

const {
  handleLogin,
  handleTokenRefresh
} = require('../lib/auth/login-service.cjs');

const { generateToken: tokenServiceGenerateToken } = require('../lib/auth/token-service.cjs');

const router = express.Router();

router.post('/login', handleLogin);

router.get('/health', (req, res) => {
  try {
    const token = tokenServiceGenerateToken({
      id: 'user-healthcheck',
      email: 'health@simplebeacon.ai',
      name: 'Health Check',
      trustLevel: 'silver'
    });
    res.json({ ok: true, jwtWorks: true, token });
  } catch (err) {
    res.status(500).json({ ok: false, jwtWorks: false, error: err.name, message: err.message, stack: err.stack });
  }
});

router.post('/logout', optionalAuthenticate, (req, res) => {
  // JWT is stateless; logout is client-side token discard.
  // For future sessions, we could add a token denylist here.
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/refresh', optionalAuthenticate, handleTokenRefresh);

router.get('/me', optionalAuthenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      trustLevel: req.user.trustLevel,
      permissions: req.user.permissions
    }
  });
});

module.exports = router;
