'use strict';

/**
 * HSM Vault API
 *
 * Exposes handshake, status, decrypt, failover, and rotation endpoints for the
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

function runAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET /api/vault/status?orgId=...
router.get('/status', authorize('admin:all'), runAsync(async (req, res) => {
  const provider = process.env.HSM_PROVIDER || 'mockhsm';
  const keyId = process.env.HSM_KEY_ID || null;
  const region = process.env.HSM_REGION || 'us-east-1';
  const handshake = await hsm.hsmHandshake(provider, keyId, region);
  res.json({
    success: true,
    orgId: resolveOrgId(req),
    provider,
    keyId,
    region,
    ...handshake,
  });
}));

// POST /api/vault/handshake
router.post('/handshake', authorize('admin:all'), runAsync(async (req, res) => {
  const provider = (req.body && req.body.provider) || process.env.HSM_PROVIDER || 'mockhsm';
  const keyId = (req.body && req.body.keyId) || process.env.HSM_KEY_ID || null;
  const region = (req.body && req.body.region) || process.env.HSM_REGION || 'us-east-1';
  const handshake = await hsm.hsmHandshake(provider, keyId, region);
  res.json({ success: true, ...handshake });
}));

// POST /api/vault/decrypt
router.post('/decrypt', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const ciphertext = (req.body && req.body.ciphertext) || null;
  if (!ciphertext) return sendError(res, 400, 'missing_ciphertext');
  const plaintext = await hsm.decryptWithHsm(orgId, ciphertext);
  res.json({ success: true, orgId, plaintext });
}));

// POST /api/vault/failover
router.post('/failover', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const key = await hsm.deriveWithFailover(orgId);
  const fingerprint = require('crypto')
    .createHash('sha256')
    .update(key)
    .digest('hex')
    .slice(0, 16);
  res.json({
    success: true,
    orgId,
    fingerprint,
    versions: hsm.getHsmVersions(),
  });
}));

// POST /api/vault/rotate
router.post('/rotate', authorize('admin:all'), runAsync(async (req, res) => {
  const newKeyId = (req.body && req.body.newKeyId) || null;
  const newRegion = (req.body && req.body.newRegion) || null;
  const result = await hsm.hsmRotate(newKeyId, newRegion);
  res.json({ success: true, ...result });
}));

module.exports = router;
