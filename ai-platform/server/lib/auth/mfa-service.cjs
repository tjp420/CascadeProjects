'use strict';

const speakeasy = require('speakeasy');
const { trustLevels } = require('./trust-levels.cjs');

const _mfaSessions = new Map();

// MFA verification middleware
function verifyMFA(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const trustConfig = trustLevels[user.trustLevel || 'bronze'];

  if (trustConfig.mfaRequired && !req.session?.mfaVerified) {
    return res.status(403).json({
      error: 'MFA Required',
      message: 'Multi-factor authentication required for this access level',
      mfaRequired: true,
    });
  }

  next();
}

// Generate MFA secret
function generateMFASecret(user) {
  if (!user || typeof user !== 'object' || !user.email) {
    throw new TypeError('generateMFASecret requires a valid user with email');
  }
  return speakeasy.generateSecret({
    name: `Cascade AI (${user.email})`,
    issuer: 'Cascade AI Platform',
    length: 32,
  });
}

// Verify MFA token
function verifyMFAToken(secret, token) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2,
  });
}

module.exports = { verifyMFA, generateMFASecret, verifyMFAToken, _mfaSessions };
