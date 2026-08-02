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
const { middleware: adminThrottle } = require('../lib/admin-throttle.cjs');

const router = express.Router();

// Apply token-bucket defense to all admin HSM vault routes, after auth
function authBeforeThrottle(req, res, next) {
  authorize('admin:all')(req, res, (err) => {
    if (err) return next(err);
    adminThrottle(req, res, next);
  });
}
router.use(authBeforeThrottle);

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

// GET /api/vault/metrics — expose HSM adapter metrics in Prometheus exposition format
router.get('/metrics', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const output = hsmMetrics.renderPrometheus();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(output);
  } catch (err) {
    sendError(res, 500, 'hsm_metrics_failed', { message: err.message });
  }
});

// GET /api/vault/consensus/status — expose consensus engine state and telemetry counters
router.get('/consensus/status', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();

    // Extract consensus-specific counters
    const consensusCounters = {};
    for (const [key, value] of Object.entries(allMetrics)) {
      if (key.startsWith('hsm_consensus_') && typeof value === 'number') {
        consensusCounters[key] = value;
      }
    }

    // If a consensus engine instance is registered, include its state
    let engineState = null;
    const baseAdapter = require('../lib/hsm-adapter/base-adapter.cjs');
    if (baseAdapter.getConsensusEngine && typeof baseAdapter.getConsensusEngine === 'function') {
      const engine = baseAdapter.getConsensusEngine();
      if (engine && typeof engine.getState === 'function') {
        engineState = engine.getState();
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      engine: engineState,
      counters: consensusCounters,
    });
  } catch (err) {
    sendError(res, 500, 'consensus_status_failed', { message: err.message });
  }
});

// POST /api/vault/rotate
router.post('/rotate', authorize('admin:all'), runAsync(async (req, res) => {
  const newKeyId = (req.body && req.body.newKeyId) || null;
  const newRegion = (req.body && req.body.newRegion) || null;
  const result = await hsm.hsmRotate(newKeyId, newRegion);
  res.json({ success: true, ...result });
}));

// GET /api/vault/recovery/status — expose threshold account recovery telemetry
router.get('/recovery/status', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();

    // Extract recovery-specific counters
    const recoveryCounters = {};
    for (const [key, value] of Object.entries(allMetrics)) {
      if (key.startsWith('hsm_recovery_') && typeof value === 'number') {
        recoveryCounters[key] = value;
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      counters: recoveryCounters,
    });
  } catch (err) {
    sendError(res, 500, 'recovery_status_failed', { message: err.message });
  }
});

// GET /api/vault/replication/status - expose core replication telemetry (Tracks 34-38)
router.get('/replication/status', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const groups = {
      migration: {},
      reconciliation: {},
      zkProofOfAssets: {},
      multipartyReKeying: {},
      encryptedP2PRouting: {},
    };
    const prefixMap = [
      { prefix: 'hsm_migration_', group: 'migration' },
      { prefix: 'hsm_reconciliation_', group: 'reconciliation' },
      { prefix: 'hsm_poa_', group: 'zkProofOfAssets' },
      { prefix: 'hsm_rekey_', group: 'multipartyReKeying' },
      { prefix: 'hsm_p2p_', group: 'encryptedP2PRouting' },
    ];
    for (const [key, value] of Object.entries(allMetrics)) {
      if (typeof value !== 'number') continue;
      for (const { prefix, group } of prefixMap) {
        if (key.startsWith(prefix)) {
          groups[group][key] = value;
          break;
        }
      }
    }
    res.json({ success: true, timestamp: Date.now(), groups });
  } catch (err) {
    sendError(res, 500, 'replication_status_failed', { message: err.message });
  }
});

module.exports = router;
