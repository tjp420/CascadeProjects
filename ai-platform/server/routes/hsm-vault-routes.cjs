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

// ── Track 40: Distributed Consensus Coordinator endpoints ─────────────────────
// All endpoints require admin:all authorization (enforced by router.use(authBeforeThrottle) above).

/**
 * Helper: get the registered DistributedConsensusCoordinator instance.
 * Returns null if no coordinator is registered.
 */
function getCoordinator() {
  const baseAdapter = require('../lib/hsm-adapter/base-adapter.cjs');
  if (baseAdapter.getConsensusCoordinator && typeof baseAdapter.getConsensusCoordinator === 'function') {
    return baseAdapter.getConsensusCoordinator();
  }
  return null;
}

/**
 * Helper: require a coordinator or send a 503 error.
 * @returns {object|null} the coordinator, or null if response was sent
 */
function requireCoordinator(res) {
  const coordinator = getCoordinator();
  if (!coordinator) {
    sendError(res, 503, 'coordinator_not_registered', {
      message: 'No DistributedConsensusCoordinator instance is registered.',
    });
    return null;
  }
  return coordinator;
}

// GET /api/vault/consensus/coordinator/status — aggregated coordinator state + telemetry counters
router.get('/consensus/coordinator/status', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const coordCounters = {};
    for (const [key, value] of Object.entries(allMetrics)) {
      if (key.startsWith('hsm_consensus_coord_') && typeof value === 'number') {
        coordCounters[key] = value;
      }
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      state: coordinator.getAggregatedState(),
      counters: coordCounters,
    });
  } catch (err) {
    sendError(res, 500, 'coordinator_status_failed', { message: err.message });
  }
});

// GET /api/vault/consensus/groups — list all consensus groups
router.get('/consensus/groups', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const groupIds = coordinator.listGroups();
    const groups = groupIds.map(id => coordinator.getGroup(id));

    res.json({ success: true, timestamp: Date.now(), groups, total: groups.length });
  } catch (err) {
    sendError(res, 500, 'consensus_groups_list_failed', { message: err.message });
  }
});

// GET /api/vault/consensus/groups/:groupId — get a specific group's state
router.get('/consensus/groups/:groupId', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const group = coordinator.getGroup(req.params.groupId);
    if (!group) {
      return sendError(res, 404, 'group_not_found', { groupId: req.params.groupId });
    }

    res.json({ success: true, timestamp: Date.now(), group });
  } catch (err) {
    sendError(res, 500, 'consensus_group_get_failed', { message: err.message });
  }
});

// POST /api/vault/consensus/groups — create a new consensus group
router.post('/consensus/groups', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const { groupId, clusterNodes, topic, keyRange } = req.body || {};
    if (!groupId) {
      return sendError(res, 400, 'missing_group_id', { message: 'groupId is required' });
    }
    if (!Array.isArray(clusterNodes) || clusterNodes.length === 0) {
      return sendError(res, 400, 'missing_cluster_nodes', { message: 'clusterNodes must be a non-empty array' });
    }

    const result = coordinator.createGroup({ groupId, clusterNodes, topic, keyRange });
    res.status(201).json({ success: true, timestamp: Date.now(), group: result });
  } catch (err) {
    if (err.code === 'GROUP_EXISTS') {
      return sendError(res, 409, 'group_already_exists', { message: err.message });
    }
    if (err.code === 'MAX_GROUPS_EXCEEDED') {
      return sendError(res, 507, 'max_groups_exceeded', { message: err.message });
    }
    if (err.code === 'INVALID_INPUT') {
      return sendError(res, 400, 'invalid_input', { message: err.message });
    }
    sendError(res, 500, 'consensus_group_create_failed', { message: err.message });
  }
});

// DELETE /api/vault/consensus/groups/:groupId — destroy a consensus group
router.delete('/consensus/groups/:groupId', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    coordinator.destroyGroup(req.params.groupId);
    res.json({ success: true, timestamp: Date.now(), groupId: req.params.groupId, destroyed: true });
  } catch (err) {
    if (err.code === 'GROUP_NOT_FOUND') {
      return sendError(res, 404, 'group_not_found', { groupId: req.params.groupId });
    }
    sendError(res, 500, 'consensus_group_destroy_failed', { message: err.message });
  }
});

// POST /api/vault/consensus/proposals — route a proposal to the appropriate group
router.post('/consensus/proposals', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const proposal = req.body || {};
    if (!proposal.groupId && !proposal.topic && !proposal.key) {
      return sendError(res, 400, 'no_routing_key', { message: 'Proposal must specify groupId, topic, or key' });
    }

    const result = coordinator.routeProposal(proposal);
    if (result.accepted) {
      res.json({ success: true, timestamp: Date.now(), ...result });
    } else {
      const status = result.reason === 'group_not_found' ? 404
        : result.reason === 'quorum_not_met' ? 503
        : 400;
      res.status(status).json({ success: false, timestamp: Date.now(), ...result });
    }
  } catch (err) {
    sendError(res, 500, 'consensus_proposal_route_failed', { message: err.message });
  }
});

// POST /api/vault/consensus/heartbeat — record a heartbeat from a node
router.post('/consensus/heartbeat', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const { nodeId, groupId, leaderId } = req.body || {};
    if (!nodeId || !groupId) {
      return sendError(res, 400, 'missing_params', { message: 'nodeId and groupId are required' });
    }

    coordinator.recordHeartbeat(nodeId, groupId, { leaderId });
    res.json({ success: true, timestamp: Date.now(), nodeId, groupId });
  } catch (err) {
    if (err.code === 'GROUP_NOT_FOUND' || err.code === 'NODE_NOT_IN_GROUP') {
      return sendError(res, 404, err.code.toLowerCase(), { message: err.message });
    }
    sendError(res, 500, 'consensus_heartbeat_failed', { message: err.message });
  }
});

// POST /api/vault/consensus/view-change — initiate a view change
router.post('/consensus/view-change', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const { groupId, failedLeaderId, candidateId } = req.body || {};
    if (!groupId || !failedLeaderId || !candidateId) {
      return sendError(res, 400, 'missing_params', { message: 'groupId, failedLeaderId, and candidateId are required' });
    }

    const result = coordinator.initiateViewChange(groupId, failedLeaderId, candidateId);
    if (result.accepted) {
      res.json({ success: true, timestamp: Date.now(), ...result });
    } else {
      res.status(409).json({ success: false, timestamp: Date.now(), ...result });
    }
  } catch (err) {
    if (err.code === 'GROUP_NOT_FOUND') {
      return sendError(res, 404, 'group_not_found', { message: err.message });
    }
    sendError(res, 500, 'consensus_view_change_failed', { message: err.message });
  }
});

// POST /api/vault/consensus/view-change/vote — cast a vote for an ongoing view change
router.post('/consensus/view-change/vote', authorize('admin:all'), function (req, res) {
  try {
    const coordinator = requireCoordinator(res);
    if (!coordinator) return;

    const { groupId, voterId, candidateId } = req.body || {};
    if (!groupId || !voterId || !candidateId) {
      return sendError(res, 400, 'missing_params', { message: 'groupId, voterId, and candidateId are required' });
    }

    const result = coordinator.castViewChangeVote(groupId, voterId, candidateId);
    if (result.accepted) {
      res.json({ success: true, timestamp: Date.now(), ...result });
    } else {
      res.status(409).json({ success: false, timestamp: Date.now(), ...result });
    }
  } catch (err) {
    sendError(res, 500, 'consensus_view_change_vote_failed', { message: err.message });
  }
});


// ── Track 41: Hardware Enclave Isolation endpoints ───────────────────────────
// All endpoints require admin:all authorization (enforced by router.use(authBeforeThrottle) above).

/**
 * Helper: get the registered HardwareEnclaveAdapter instance.
 * Returns null if no adapter is registered.
 */
function getEnclaveAdapter() {
  const baseAdapter = require('../lib/hsm-adapter/base-adapter.cjs');
  if (baseAdapter.getHardwareEnclaveAdapter && typeof baseAdapter.getHardwareEnclaveAdapter === 'function') {
    return baseAdapter.getHardwareEnclaveAdapter();
  }
  return null;
}

/**
 * Helper: require an enclave adapter or send a 503 error.
 * @returns {object|null} the adapter, or null if response was sent
 */
function requireEnclaveAdapter(res) {
  const adapter = getEnclaveAdapter();
  if (!adapter) {
    sendError(res, 503, 'enclave_not_registered', {
      message: 'No HardwareEnclaveAdapter instance is registered.',
    });
    return null;
  }
  return adapter;
}

// GET /api/vault/enclave/status — enclave state + telemetry counters
router.get('/enclave/status', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const enclaveCounters = {};
    for (const [key, value] of Object.entries(allMetrics)) {
      if (key.startsWith('hsm_enclave_') && typeof value === 'number') {
        enclaveCounters[key] = value;
      }
    }
    const adapter = getEnclaveAdapter();
    res.json({
      success: true,
      timestamp: Date.now(),
      registered: Boolean(adapter),
      backend: adapter ? adapter.backend : null,
      mrenclave: adapter ? adapter.mrenclave : null,
      initialized: adapter ? adapter._initialized : false,
      counters: enclaveCounters,
    });
  } catch (err) {
    sendError(res, 500, 'enclave_status_failed', { message: err.message });
  }
});

// POST /api/vault/enclave/initialize — initialize the enclave with an attestation document
router.post('/enclave/initialize', authorize('admin:all'), async function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    const attestationDocument = req.body && req.body.attestationDocument;
    if (!attestationDocument) {
      return sendError(res, 400, 'missing_params', { message: 'attestationDocument is required' });
    }
    const result = await adapter.initialize(attestationDocument);
    res.json({ success: true, timestamp: Date.now(), ...result });
  } catch (err) {
    if (err.code === 'ENCLAVE_ATTESTATION_REQUIRED' || err.code === 'ATTESTATION_UNTRUSTED_AUTHORITY' ||
        err.code === 'ATTESTATION_UNTRUSTED_MEASUREMENT' || err.code === 'ATTESTATION_EXPIRED' ||
        err.code === 'ATTESTATION_SIGNATURE_INVALID' || err.code === 'ATTESTATION_INVALID_DOCUMENT') {
      return sendError(res, 403, err.code.toLowerCase(), { message: err.message });
    }
    sendError(res, 500, 'enclave_initialize_failed', { message: err.message });
  }
});

// POST /api/vault/enclave/seal — seal plaintext inside the enclave boundary
router.post('/enclave/seal', authorize('admin:all'), async function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    const { plaintext } = req.body || {};
    if (plaintext === undefined || plaintext === null) {
      return sendError(res, 400, 'missing_params', { message: 'plaintext is required' });
    }
    const result = await adapter.seal(plaintext);
    res.json({ success: true, timestamp: Date.now(), ...result });
  } catch (err) {
    if (err.code === 'ENCLAVE_NOT_INITIALIZED') {
      return sendError(res, 409, err.code.toLowerCase(), { message: err.message });
    }
    sendError(res, 500, 'enclave_seal_failed', { message: err.message });
  }
});

// POST /api/vault/enclave/unseal — unseal ciphertext inside the enclave boundary
router.post('/enclave/unseal', authorize('admin:all'), async function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    const { ciphertext } = req.body || {};
    if (!ciphertext) {
      return sendError(res, 400, 'missing_params', { message: 'ciphertext is required' });
    }
    const plain = await adapter.unseal(ciphertext);
    res.json({ success: true, timestamp: Date.now(), plaintext: plain.toString('utf8') });
  } catch (err) {
    if (err.code === 'ENCLAVE_NOT_INITIALIZED') {
      return sendError(res, 409, err.code.toLowerCase(), { message: err.message });
    }
    sendError(res, 500, 'enclave_unseal_failed', { message: err.message });
  }
});

// POST /api/vault/enclave/provision-key — provision a key after attestation
router.post('/enclave/provision-key', authorize('admin:all'), async function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    const { keyMaterial } = req.body || {};
    if (!keyMaterial) {
      return sendError(res, 400, 'missing_params', { message: 'keyMaterial is required' });
    }
    const result = await adapter.provisionKey(keyMaterial);
    res.status(201).json({ success: true, timestamp: Date.now(), ...result });
  } catch (err) {
    if (err.code === 'ENCLAVE_NOT_INITIALIZED') {
      return sendError(res, 409, err.code.toLowerCase(), { message: err.message });
    }
    sendError(res, 500, 'enclave_provision_key_failed', { message: err.message });
  }
});

// GET /api/vault/enclave/attestation/verify — check if a measurement is verified & cached
router.get('/enclave/attestation/verify', authorize('admin:all'), function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    const measurement = req.query.measurement;
    if (!measurement) {
      return sendError(res, 400, 'missing_params', { message: 'measurement query param is required' });
    }
    const isVerified = adapter._attestationClient.isVerified(measurement);
    res.json({ success: true, timestamp: Date.now(), measurement, verified: isVerified });
  } catch (err) {
    sendError(res, 500, 'enclave_attestation_verify_failed', { message: err.message });
  }
});

// POST /api/vault/enclave/attestation/clear-cache — clear the attestation cache
router.post('/enclave/attestation/clear-cache', authorize('admin:all'), function (req, res) {
  try {
    const adapter = requireEnclaveAdapter(res);
    if (!adapter) return;
    adapter._attestationClient.clearCache();
    res.json({ success: true, timestamp: Date.now(), cleared: true });
  } catch (err) {
    sendError(res, 500, 'enclave_attestation_clear_cache_failed', { message: err.message });
  }
});


module.exports = router;
