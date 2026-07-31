// SPDX-License-Identifier: MIT
/**
 * License token routes — validation, registration, and sandbox generation.
 *
 * Extracted from auth-inline-routes.cjs to separate auth concerns from
 * license/token management. Mount paths preserved for backward compatibility:
 *   POST /auth/token-status   — license token status check
 *   POST /license/validate    — public CLI/CI license validation
 *   POST /auth/register-token — register license token with email
 *   POST /tokens/sandbox      — generate sandbox token for testing
 *
 * @license MIT
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const { generateToken } = require('../middleware/auth.cjs');
const { getLicenseToken, insertLicenseToken } = require('../lib/token-db.cjs');
const { verifyLicenseToken } = require('../lib/simplebeacon-proxy.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function resolveLicenseSecret() {
  const secret = (process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  return secret || null;
}

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
      registeredAt: entry?.registered_at || (claims.iat ? new Date(claims.iat * 1000).toISOString() : null),
      expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null
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
