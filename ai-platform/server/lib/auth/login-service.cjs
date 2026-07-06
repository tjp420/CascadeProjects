'use strict';

const createError = require('http-errors');
const { trustLevels } = require('./trust-levels.cjs');
const { generateToken } = require('./token-service.cjs');
const { auditAuth } = require('./audit-service.cjs');
const { authenticateUser } = require('../../services/user-service.cjs');

async function handleLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, 'Email and password required');
    }

    const userResult = await authenticateUser(req.db || null, email, password);
    if (!userResult) {
      auditAuth('login_failed', { email }, req);
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    const match = userResult.user;
    const adminEmails = (process.env.SIMPLEBEACON_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const isAdmin = adminEmails.length > 0 ? adminEmails.includes(email) : false;

    const user = {
      id: match.id || (isAdmin ? 'admin-' + Date.now() : 'user-' + Date.now()),
      email: match.email,
      name: match.name || email.split('@')[0],
      trustLevel: isAdmin ? 'gold' : (match.trustLevel || 'bronze'),
      createdAt: match.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      successfulAnalyses: match.successfulAnalyses || (isAdmin ? 100 : 5),
      securityIncidents: match.securityIncidents || 0,
      communityContributions: match.communityContributions || (isAdmin ? 50 : 0),
      verificationStatus: match.verificationStatus || (isAdmin ? 'verified' : 'email')
    };

    const token = generateToken(user);
    auditAuth('login_success', user, req);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        trustLevel: user.trustLevel,
        permissions: trustLevels[user.trustLevel].permissions
      }
    });
  } catch (error) {
    auditAuth('login_failed', { email: req.body?.email }, req);
    console.error('[Login] Error during login:', error?.message, error?.stack);
    // Let validation errors (4xx) pass through to the Express error handler
    if (error?.status && error.status < 500) {
      return next(error);
    }
    return res.status(500).json({
      error: error?.name || 'login_error',
      message: error?.message || 'Login failed due to a server error.',
      stack: error?.stack
    });
  }
}

function handleTokenRefresh(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid token required for refresh'
      });
    }
    const newToken = generateToken(req.user);
    auditAuth('token_refresh', req.user, req);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { handleLogin, handleTokenRefresh };
