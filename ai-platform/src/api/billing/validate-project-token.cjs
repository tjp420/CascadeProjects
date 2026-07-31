// simplebeacon-ignore workspace-health
'use strict';

const {
  generateLicenseToken,
  verifyLicenseToken,
} = require('../../../server/lib/simplebeacon-proxy.cjs');

function validateProjectToken(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.body?.licenseToken || req.query?.licenseToken || '';

  if (!token) {
    return res
      .status(401)
      .json({
        error: 'missing_token',
        message: 'License token required. Paste the token from your payment email.',
      });
  }

  const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
  if (!secret) {
    return res
      .status(503)
      .json({
        error: 'license_secret_not_configured',
        message: 'License verification is not configured.',
      });
  }
  const payload = verifyLicenseToken(token, secret);
  if (!payload) {
    return res
      .status(403)
      .json({ error: 'invalid_token', message: 'License token is invalid or expired.' });
  }

  req.licensePayload = payload;
  req.projectContext = {
    email: payload.email,
    tier: payload.tier,
    product: payload.product,
    features: payload.features || [],
    projectName: payload.projectName || 'default-project',
    clientName: payload.clientName || payload.email,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };

  next();
}

module.exports = { validateProjectToken };
