'use strict';

/**
 * HSM Vault API
 *
 * Exposes handshake, status, and HSM-backed decrypt endpoints for the
 * multi-region key custody architecture.
 *
 * @module hsm-vault-routes
 */

const express = require('express');
const hsm = require('../lib/hsm-vault.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function resolveOrgId(req) {
  return req.orgId || req.query.orgId || req.body.orgId || 'default';
}

// GET /api/vault/status?orgId=...
router.get('/status', authorize('admin:all'), function (req, res) {
  try {
    const provider = process.env.HSM_PROVIDER || 'mockhsm';
    const keyId = process.env.HSM_KEY_ID || null;
    const region = process.env.HSM_REGION || 'us-east-1';
    const handshake = hsm.hsmHandshake(provider, keyId, region);
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      provider,
      keyId,
      region,
      ...handshake,
    });
  } catch (err) {
    sendError(res, 500, 'hsm_status_failed', { message: err.message });
  }
});

// POST /api/vault/handshake
router.post('/handshake', authorize('admin:all'), function (req, res) {
  try {
    const provider = (req.body && req.body.provider) || process.env.HSM_PROVIDER || 'mockhsm';
    const keyId = (req.body && req.body.keyId) || process.env.HSM_KEY_ID || null;
    const region = (req.body && req.body.region) || process.env.HSM_REGION || 'us-east-1';
    const handshake = hsm.hsmHandshake(provider, keyId, region);
    res.json({ success: true, ...handshake });
  } catch (err) {
    sendError(res, 500, 'hsm_handshake_failed', { message: err.message });
  }
});

// POST /api/vault/decrypt
router.post('/decrypt', authorize('admin:all'), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const ciphertext = (req.body && req.body.ciphertext) || null;
    if (!ciphertext) return sendError(res, 400, 'missing_ciphertext');
    const plaintext = hsm.decryptWithHsm(orgId, ciphertext);
    res.json({ success: true, orgId, plaintext });
  } catch (err) {
    sendError(res, 500, 'hsm_decrypt_failed', { message: err.message });
  }
});

module.exports = router;
