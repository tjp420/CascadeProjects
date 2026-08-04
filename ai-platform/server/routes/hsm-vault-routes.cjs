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
const crypto = require('crypto');
const hsm = require('../lib/hsm-vault.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const { middleware: adminThrottle } = require('../lib/admin-throttle.cjs');
const { RecursiveProofAggregationEngine } = require('../lib/hsm-adapter/recursive-proof-aggregation-engine.cjs');
const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
const baseAdapter = require('../lib/hsm-adapter/base-adapter.cjs');
const { PqcHomomorphicDatabaseLookupGatingHub } = require('../lib/hsm-adapter/pqc-homomorphic-lookup-gating-hub.cjs');
const { PqcBlindedRingSignatureGatingHub } = require('../lib/hsm-adapter/pqc-blinded-ring-signature-gating-hub.cjs');
const { PqcDirectAccumulatorMembershipGatingHub } = require('../lib/hsm-adapter/pqc-direct-accumulator-membership-gating-hub.cjs');
const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
const SessionStore = require('../lib/crypto/ratchet/session-store.cjs');
const { encryptEnvelope } = require('../lib/crypto/ratchet/envelope-crypto.cjs');

const router = express.Router();

// In-memory registry for Track 31 lookup gating pools (per-process; persistent storage out of scope)
const lookupGatingPools = new Map();

// In-memory registry for Track 32 ring gating pools (per-process; persistent storage out of scope)
const ringGatingPools = new Map();

// Shared policy engine instance for Track 32 ring gating
const ringGatingPolicyEngine = new CryptoPolicyEngine();

// In-memory registry for Track 33 accumulator gating pools (per-process; persistent storage out of scope)
const accumulatorGatingPools = new Map();

// Shared policy engine instance for Track 33 accumulator gating
const accumulatorGatingPolicyEngine = new CryptoPolicyEngine();

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


// ── Track 61: Recursive Proof Aggregation endpoints ────────────────────────────

function getRecursiveProofEngine() {
  return baseAdapter.getRecursiveProofAggregationEngine();
}

function requireRecursiveProofEngine(res) {
  const engine = getRecursiveProofEngine();
  if (!engine) {
    sendError(res, 503, 'recursive_proof_engine_unavailable', {
      message: 'No RecursiveProofAggregationEngine is registered with the HSM adapter.',
    });
    return null;
  }
  return engine;
}

// Register a default engine for this process if none is provided by the adapter.
if (!baseAdapter.getRecursiveProofAggregationEngine()) {
  baseAdapter.registerRecursiveProofAggregationEngine(new RecursiveProofAggregationEngine({
    audit: (event) => {
      switch (event) {
        case 'PROOF_SUBMITTED':
          hsmMetrics.incrementCounter('hsm_recursive_proof_submitted_total');
          hsmMetrics.incrementCounter('hsm_recursive_proofs_active');
          break;
        case 'PROOFS_FOLDED':
          hsmMetrics.incrementCounter('hsm_recursive_proofs_folded_total');
          break;
        case 'CHAIN_AGGREGATED':
          hsmMetrics.incrementCounter('hsm_recursive_chain_aggregations_total');
          hsmMetrics.incrementCounter('hsm_recursive_aggregations_active');
          break;
        case 'TREE_AGGREGATED':
          hsmMetrics.incrementCounter('hsm_recursive_tree_aggregations_total');
          hsmMetrics.incrementCounter('hsm_recursive_aggregations_active');
          break;
        case 'VDF_PROOFS_AGGREGATED':
          hsmMetrics.incrementCounter('hsm_recursive_vdf_aggregations_total');
          hsmMetrics.incrementCounter('hsm_recursive_aggregations_active');
          break;
        case 'MIXNET_STATE_COMPRESSED':
          hsmMetrics.incrementCounter('hsm_recursive_mixnet_compressions_total');
          hsmMetrics.incrementCounter('hsm_recursive_aggregations_active');
          break;
        case 'AGG_VERIFIED':
          hsmMetrics.incrementCounter('hsm_recursive_aggregations_verified_total');
          break;
      }
    },
  }));
}

function handleHsmError(res, err) {
  hsmMetrics.incrementCounter('hsm_recursive_aggregations_failed_total');
  sendError(res, err.code ? (err.statusCode || 400) : 500, err.code || 'recursive_aggregation_error', { message: err.message });
}

// POST /api/vault/recursive-aggregation/proof
router.post('/recursive-aggregation/proof', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const result = engine.submitProof(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/fold
router.post('/recursive-aggregation/fold', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { proofId1, proofId2, foldedProofId } = req.body || {};
    const result = engine.foldProofs(proofId1, proofId2, foldedProofId);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/aggregate/chain
router.post('/recursive-aggregation/aggregate/chain', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { proofIds, aggId } = req.body || {};
    const result = engine.aggregateChain(proofIds, aggId);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/aggregate/tree
router.post('/recursive-aggregation/aggregate/tree', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { proofIds, aggId } = req.body || {};
    const result = engine.aggregateTree(proofIds, aggId);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/aggregate/vdf
router.post('/recursive-aggregation/aggregate/vdf', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { proofIds } = req.body || {};
    const result = engine.aggregateVdfProofs(proofIds);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/compress/mixnet
router.post('/recursive-aggregation/compress/mixnet', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { proofIds } = req.body || {};
    const result = engine.compressMixnetState(proofIds);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// POST /api/vault/recursive-aggregation/verify
router.post('/recursive-aggregation/verify', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const { aggId } = req.body || {};
    const result = engine.verifyAggregation(aggId);
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// GET /api/vault/recursive-aggregation/aggregations/:aggId
router.get('/recursive-aggregation/aggregations/:aggId', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const result = engine.getAggregation(req.params.aggId);
    if (!result) return sendError(res, 404, 'aggregation_not_found', { message: `aggregation ${req.params.aggId} not found` });
    res.json({ success: true, ...result });
  } catch (err) {
    handleHsmError(res, err);
  }
});

// GET /api/vault/recursive-aggregation/status
router.get('/recursive-aggregation/status', authorize('admin:all'), function (req, res) {
  try {
    const engine = requireRecursiveProofEngine(res);
    if (!engine) return;
    const all = hsmMetrics.getMetrics();
    const counters = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('hsm_recursive_') && typeof value === 'number') {
        counters[key] = value;
      }
    }
    res.json({ success: true, timestamp: Date.now(), counters, stats: engine.getStats() });
  } catch (err) {
    handleHsmError(res, err);
  }
});


// Track 105: Decentralized Identity Proof Gating policy administration and telemetry

// GET /api/vault/decentralized-identity/policy — expose active Track 105 policy defaults and bounds
router.get('/decentralized-identity/policy', authorize('admin:all'), function (req, res) {
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqDecentralizedIdentityProofGating,
    });
  } catch (err) {
    sendError(res, 500, 'decentralized_identity_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/decentralized-identity/policy/validate — validate a proposed Track 105 configuration
router.post('/decentralized-identity/policy/validate', authorize('admin:all'), function (req, res) {
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqDecentralizedIdentityProofGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'decentralized_identity_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/decentralized-identity/telemetry — expose Track 105 telemetry counters
router.get('/decentralized-identity/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_didgate_pool_initialized_total: allMetrics.hsm_didgate_pool_initialized_total || 0,
      hsm_zk_identity_claim_verified_total: allMetrics.hsm_zk_identity_claim_verified_total || 0,
      hsm_revocation_accreditation_completed_total: allMetrics.hsm_revocation_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'decentralized_identity_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 108: Space-Based Laser Communication Mesh Gating policy administration and telemetry

// GET /api/vault/space-based-laser-mesh/policy — expose active Track 108 policy defaults and bounds
router.get('/space-based-laser-mesh/policy', authorize('admin:all'), function (req, res) {
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqSpaceBasedLaserCommunicationMeshGating,
    });
  } catch (err) {
    sendError(res, 500, 'laser_mesh_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/space-based-laser-mesh/policy/validate — validate a proposed Track 108 configuration
router.post('/space-based-laser-mesh/policy/validate', authorize('admin:all'), function (req, res) {
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqSpaceBasedLaserCommunicationMeshGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'laser_mesh_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/space-based-laser-mesh/telemetry — expose Track 108 telemetry counters
router.get('/space-based-laser-mesh/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_lasergate_pool_initialized_total: allMetrics.hsm_lasergate_pool_initialized_total || 0,
      hsm_zk_laser_mesh_claim_verified_total: allMetrics.hsm_zk_laser_mesh_claim_verified_total || 0,
      hsm_handoff_accreditation_completed_total: allMetrics.hsm_handoff_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'laser_mesh_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 109: Quantum Key Distribution Link-Switch Gating policy administration and telemetry

// GET /api/vault/qkd-link-switch/policy — expose active Track 109 policy defaults and bounds
router.get('/qkd-link-switch/policy', authorize('admin:all'), function (req, res) {
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqQuantumKeyDistributionLinkSwitchGating,
    });
  } catch (err) {
    sendError(res, 500, 'qkd_link_switch_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/qkd-link-switch/policy/validate — validate a proposed Track 109 configuration
router.post('/qkd-link-switch/policy/validate', authorize('admin:all'), function (req, res) {
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqQuantumKeyDistributionLinkSwitchGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'qkd_link_switch_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/qkd-link-switch/telemetry — expose Track 109 telemetry counters
router.get('/qkd-link-switch/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_qkdswitchgate_pool_initialized_total: allMetrics.hsm_qkdswitchgate_pool_initialized_total || 0,
      hsm_zk_qkd_link_claim_verified_total: allMetrics.hsm_zk_qkd_link_claim_verified_total || 0,
      hsm_entanglement_accreditation_completed_total: allMetrics.hsm_entanglement_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'qkd_link_switch_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 110: Holographic Storage Content-Addressable Gating policy administration and telemetry

// GET /api/vault/holographic-storage/policy — expose active Track 110 policy defaults and bounds
router.get('/holographic-storage/policy', authorize('admin:all'), function (req, res) {
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqHolographicStorageContentAddressableGating,
    });
  } catch (err) {
    sendError(res, 500, 'holographic_storage_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/holographic-storage/policy/validate — validate a proposed Track 110 configuration
router.post('/holographic-storage/policy/validate', authorize('admin:all'), function (req, res) {
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqHolographicStorageContentAddressableGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'holographic_storage_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/holographic-storage/telemetry — expose Track 110 telemetry counters
router.get('/holographic-storage/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_hologate_pool_initialized_total: allMetrics.hsm_hologate_pool_initialized_total || 0,
      hsm_zk_holographic_claim_verified_total: allMetrics.hsm_zk_holographic_claim_verified_total || 0,
      hsm_phase_accreditation_completed_total: allMetrics.hsm_phase_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'holographic_storage_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 76: Supply Chain Provenance Gating v2 policy administration and telemetry

// GET /api/vault/supply-chain-provenance/policy — expose active Track 76 policy defaults and bounds
router.get('/supply-chain-provenance/policy', authorize('admin:all'), function (req, res) {
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqSupplyChainProvenanceGating,
    });
  } catch (err) {
    sendError(res, 500, 'supply_chain_provenance_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/supply-chain-provenance/policy/validate — validate a proposed Track 76 configuration
router.post('/supply-chain-provenance/policy/validate', authorize('admin:all'), function (req, res) {
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqSupplyChainProvenanceGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'supply_chain_provenance_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/supply-chain-provenance/telemetry — expose Track 76 telemetry counters
router.get('/supply-chain-provenance/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_supplygate_pool_initialized_total: allMetrics.hsm_supplygate_pool_initialized_total || 0,
      hsm_zk_provenance_claim_verified_total: allMetrics.hsm_zk_provenance_claim_verified_total || 0,
      hsm_lineage_accreditation_completed_total: allMetrics.hsm_lineage_accreditation_completed_total || 0,
      hsm_supplygate_settled_total: allMetrics.hsm_supplygate_settled_total || 0,
      hsm_supplygate_rebalanced_total: allMetrics.hsm_supplygate_rebalanced_total || 0,
      hsm_supplygate_slash_recorded_total: allMetrics.hsm_supplygate_slash_recorded_total || 0,
      hsm_provenance_batch_verified_total: allMetrics.hsm_provenance_batch_verified_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'supply_chain_provenance_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 111: Zero-Knowledge Decentralized Storage Attestation Gating (unavailable — 503 guarded)
// When the ZK decentralized storage gating hub is registered, flip ZK_DECENTRALIZED_STORAGE_GATING_ENABLED to true.
const ZK_DECENTRALIZED_STORAGE_GATING_ENABLED = true;

function requireZkDecentralizedStorageGating(res) {
  if (!ZK_DECENTRALIZED_STORAGE_GATING_ENABLED) {
    sendError(res, 503, 'zk_decentralized_storage_gating_unavailable', {
      message: 'Track 111 Zero-Knowledge Decentralized Storage Attestation Gating is not yet available.',
    });
    return false;
  }
  return true;
}

// GET /api/vault/zk-decentralized-storage/policy — expose active Track 111 policy defaults and bounds
router.get('/zk-decentralized-storage/policy', authorize('admin:all'), function (req, res) {
  if (!requireZkDecentralizedStorageGating(res)) return;
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqZkDecentralizedStorageAttestationGating,
    });
  } catch (err) {
    sendError(res, 500, 'zk_decentralized_storage_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/zk-decentralized-storage/policy/validate — validate a proposed Track 111 configuration
router.post('/zk-decentralized-storage/policy/validate', authorize('admin:all'), function (req, res) {
  if (!requireZkDecentralizedStorageGating(res)) return;
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqZkDecentralizedStorageAttestationGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'zk_decentralized_storage_policy_validate_failed', { message: err.message });
  }
});

// Track 112: Bio-Digital Interface Neural-Telemetry Gating (unavailable — 503 guarded)
// When the bio-digital neural telemetry gating hub is registered, flip BIO_DIGITAL_NEURAL_TELEMETRY_GATING_ENABLED to true.
const BIO_DIGITAL_NEURAL_TELEMETRY_GATING_ENABLED = true;

function requireBioDigitalNeuralTelemetryGating(res) {
  if (!BIO_DIGITAL_NEURAL_TELEMETRY_GATING_ENABLED) {
    sendError(res, 503, 'bio_digital_neural_telemetry_gating_unavailable', {
      message: 'Track 112 Bio-Digital Interface Neural-Telemetry Gating is not yet available.',
    });
    return false;
  }
  return true;
}

// GET /api/vault/bio-digital-neural-telemetry/policy — expose active Track 112 policy defaults and bounds
router.get('/bio-digital-neural-telemetry/policy', authorize('admin:all'), function (req, res) {
  if (!requireBioDigitalNeuralTelemetryGating(res)) return;
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqBioDigitalInterfaceNeuralTelemetryGating,
    });
  } catch (err) {
    sendError(res, 500, 'bio_digital_neural_telemetry_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/bio-digital-neural-telemetry/policy/validate — validate a proposed Track 112 configuration
router.post('/bio-digital-neural-telemetry/policy/validate', authorize('admin:all'), function (req, res) {
  if (!requireBioDigitalNeuralTelemetryGating(res)) return;
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqBioDigitalInterfaceNeuralTelemetryGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'bio_digital_neural_telemetry_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/bio-digital-neural-telemetry/telemetry — expose Track 112 telemetry counters
router.get('/bio-digital-neural-telemetry/telemetry', authorize('admin:all'), function (req, res) {
  if (!requireBioDigitalNeuralTelemetryGating(res)) return;
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_neurogate_pool_initialized_total: allMetrics.hsm_neurogate_pool_initialized_total || 0,
      hsm_zk_neural_telemetry_verified_total: allMetrics.hsm_zk_neural_telemetry_verified_total || 0,
      hsm_synapse_accreditation_completed_total: allMetrics.hsm_synapse_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'bio_digital_neural_telemetry_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 113: Autonomous Drone Swarm Mesh-Routing Gating (unavailable — 503 guarded)
// When the drone swarm mesh-routing gating hub is registered, flip DRONE_SWARM_MESH_ROUTING_GATING_ENABLED to true.
const DRONE_SWARM_MESH_ROUTING_GATING_ENABLED = true;

function requireAutonomousDroneSwarmMeshRoutingGating(res) {
  if (!DRONE_SWARM_MESH_ROUTING_GATING_ENABLED) {
    sendError(res, 503, 'autonomous_drone_swarm_mesh_routing_gating_unavailable', {
      message: 'Track 113 Autonomous Drone Swarm Mesh-Routing Gating is not yet available.',
    });
    return false;
  }
  return true;
}

// GET /api/vault/autonomous-drone-swarm-mesh-routing/policy — expose active Track 113 policy defaults and bounds
router.get('/autonomous-drone-swarm-mesh-routing/policy', authorize('admin:all'), function (req, res) {
  if (!requireAutonomousDroneSwarmMeshRoutingGating(res)) return;
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqAutonomousDroneSwarmMeshRoutingGating,
    });
  } catch (err) {
    sendError(res, 500, 'autonomous_drone_swarm_mesh_routing_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/autonomous-drone-swarm-mesh-routing/policy/validate — validate a proposed Track 113 configuration
router.post('/autonomous-drone-swarm-mesh-routing/policy/validate', authorize('admin:all'), function (req, res) {
  if (!requireAutonomousDroneSwarmMeshRoutingGating(res)) return;
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqAutonomousDroneSwarmMeshRoutingGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'autonomous_drone_swarm_mesh_routing_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/autonomous-drone-swarm-mesh-routing/telemetry — expose Track 113 telemetry counters
router.get('/autonomous-drone-swarm-mesh-routing/telemetry', authorize('admin:all'), function (req, res) {
  if (!requireAutonomousDroneSwarmMeshRoutingGating(res)) return;
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_dronegate_pool_initialized_total: allMetrics.hsm_dronegate_pool_initialized_total || 0,
      hsm_zk_swarm_routing_verified_total: allMetrics.hsm_zk_swarm_routing_verified_total || 0,
      hsm_topology_accreditation_completed_total: allMetrics.hsm_topology_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'autonomous_drone_swarm_mesh_routing_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 114: Swarm Robotics Kinetic Assembly Gating (unavailable — 503 guarded)
// When the swarm robotics kinetic assembly gating hub is registered, flip SWARM_ROBOTICS_KINETIC_ASSEMBLY_GATING_ENABLED to true.
const SWARM_ROBOTICS_KINETIC_ASSEMBLY_GATING_ENABLED = true;

function requireSwarmRoboticsKineticAssemblyGating(res) {
  if (!SWARM_ROBOTICS_KINETIC_ASSEMBLY_GATING_ENABLED) {
    sendError(res, 503, 'swarm_robotics_kinetic_assembly_gating_unavailable', {
      message: 'Track 114 Swarm Robotics Kinetic Assembly Gating is not yet available.',
    });
    return false;
  }
  return true;
}

// GET /api/vault/swarm-robotics-kinetic-assembly/policy — expose active Track 114 policy defaults and bounds
router.get('/swarm-robotics-kinetic-assembly/policy', authorize('admin:all'), function (req, res) {
  if (!requireSwarmRoboticsKineticAssemblyGating(res)) return;
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqSwarmRoboticsKineticAssemblyGating,
    });
  } catch (err) {
    sendError(res, 500, 'swarm_robotics_kinetic_assembly_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/swarm-robotics-kinetic-assembly/policy/validate — validate a proposed Track 114 configuration
router.post('/swarm-robotics-kinetic-assembly/policy/validate', authorize('admin:all'), function (req, res) {
  if (!requireSwarmRoboticsKineticAssemblyGating(res)) return;
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqSwarmRoboticsKineticAssemblyGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'swarm_robotics_kinetic_assembly_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/swarm-robotics-kinetic-assembly/telemetry — expose Track 114 telemetry counters
router.get('/swarm-robotics-kinetic-assembly/telemetry', authorize('admin:all'), function (req, res) {
  if (!requireSwarmRoboticsKineticAssemblyGating(res)) return;
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_kineticgate_pool_initialized_total: allMetrics.hsm_kineticgate_pool_initialized_total || 0,
      hsm_zk_kinetic_posture_verified_total: allMetrics.hsm_zk_kinetic_posture_verified_total || 0,
      hsm_assembly_accreditation_completed_total: allMetrics.hsm_assembly_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'swarm_robotics_kinetic_assembly_telemetry_fetch_failed', { message: err.message });
  }
});

// Track 115: Multi-Enclave Confidential Mesh State-Reconciliation Gating (unavailable — 503 guarded)
const MULTI_ENCLAVE_CONFIDENTIAL_MESH_STATE_RECONCILIATION_GATING_ENABLED = true;

function requireMultiEnclaveConfidentialMeshStateReconciliationGating(res) {
  if (!MULTI_ENCLAVE_CONFIDENTIAL_MESH_STATE_RECONCILIATION_GATING_ENABLED) {
    sendError(res, 503, 'multi_enclave_confidential_mesh_state_reconciliation_gating_unavailable', {
      message: 'Track 115 Multi-Enclave Confidential Mesh State-Reconciliation Gating is not yet available.',
    });
    return false;
  }
  return true;
}

// GET /api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy — expose active Track 115 policy defaults and bounds
router.get('/multi-enclave-confidential-mesh-state-reconciliation/policy', authorize('admin:all'), function (req, res) {
  if (!requireMultiEnclaveConfidentialMeshStateReconciliationGating(res)) return;
  try {
    const { DEFAULT_POLICY } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      policy: DEFAULT_POLICY.pqMultiEnclaveConfidentialMeshStateReconciliationGating,
    });
  } catch (err) {
    sendError(res, 500, 'multi_enclave_confidential_mesh_state_reconciliation_policy_fetch_failed', { message: err.message });
  }
});

// POST /api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate — validate a proposed Track 115 configuration
router.post('/multi-enclave-confidential-mesh-state-reconciliation/policy/validate', authorize('admin:all'), function (req, res) {
  if (!requireMultiEnclaveConfidentialMeshStateReconciliationGating(res)) return;
  try {
    const { CryptoPolicyEngine } = require('../lib/hsm-adapter/crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const tenantId = resolveOrgId(req);
    const config = req.body || {};
    engine.validate(tenantId, 'pqMultiEnclaveConfidentialMeshStateReconciliationGating', config);
    res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'POLICY_VIOLATION_BLOCKED') {
      return sendError(res, 400, 'POLICY_VIOLATION_BLOCKED', { message: err.message });
    }
    sendError(res, 500, 'multi_enclave_confidential_mesh_state_reconciliation_policy_validate_failed', { message: err.message });
  }
});

// GET /api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry — expose Track 115 telemetry counters
router.get('/multi-enclave-confidential-mesh-state-reconciliation/telemetry', authorize('admin:all'), function (req, res) {
  if (!requireMultiEnclaveConfidentialMeshStateReconciliationGating(res)) return;
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_meshgate_pool_initialized_total: allMetrics.hsm_meshgate_pool_initialized_total || 0,
      hsm_zk_mesh_state_reconciled_total: allMetrics.hsm_zk_mesh_state_reconciled_total || 0,
      hsm_epoch_finality_completed_total: allMetrics.hsm_epoch_finality_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'multi_enclave_confidential_mesh_state_reconciliation_telemetry_fetch_failed', { message: err.message });
  }
});

// GET /api/vault/zk-decentralized-storage/telemetry — expose Track 111 telemetry counters
router.get('/zk-decentralized-storage/telemetry', authorize('admin:all'), function (req, res) {
  if (!requireZkDecentralizedStorageGating(res)) return;
  try {
    const hsmMetrics = require('../lib/hsm-adapter/hsm-metrics.cjs');
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_zkstorage_pool_initialized_total: allMetrics.hsm_zkstorage_pool_initialized_total || 0,
      hsm_zk_storage_proof_verified_total: allMetrics.hsm_zk_storage_proof_verified_total || 0,
      hsm_zkstorage_replication_accreditation_completed_total: allMetrics.hsm_zkstorage_replication_accreditation_completed_total || 0,
      hsm_zkstorage_dispersal_completed_total: allMetrics.hsm_zkstorage_dispersal_completed_total || 0,
      hsm_zkstorage_slash_recorded_total: allMetrics.hsm_zkstorage_slash_recorded_total || 0,
      hsm_zkstorage_challenge_issued_total: allMetrics.hsm_zkstorage_challenge_issued_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'zk_decentralized_storage_telemetry_fetch_failed', { message: err.message });
  }
});

function resolveLookupGatingPool(poolId) {
  const pool = lookupGatingPools.get(poolId);
  if (!pool) return null;
  return pool;
}

// POST /api/vault/lookup-gating/pool — create a Track 31 lookup gating pool
router.post('/lookup-gating/pool', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const policy = (req.body && req.body.policy) || {};
  const hub = new PqcHomomorphicDatabaseLookupGatingHub({ policy });
  lookupGatingPools.set(hub.poolId, { hub, orgId, createdAt: Date.now() });
  res.json({
    success: true,
    orgId,
    poolId: hub.poolId,
    state: hub.state,
  });
}));

// GET /api/vault/lookup-gating/telemetry — expose Track 31 telemetry counters
router.get('/lookup-gating/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_lookupgate_pool_initialized_total: allMetrics.hsm_lookupgate_pool_initialized_total || 0,
      hsm_zk_lookup_claim_verified_total: allMetrics.hsm_zk_lookup_claim_verified_total || 0,
      hsm_lookup_accreditation_completed_total: allMetrics.hsm_lookup_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'lookup_gating_telemetry_fetch_failed', { message: err.message });
  }
});

// GET /api/vault/lookup-gating/:poolId — get pool status
router.get('/lookup-gating/:poolId', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveLookupGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'lookup_pool_not_found');
  res.json({
    success: true,
    orgId,
    poolId: entry.hub.poolId,
    state: entry.hub.state,
  });
}));

// POST /api/vault/lookup-gating/:poolId/query — submit a blinded query
router.post('/lookup-gating/:poolId/query', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveLookupGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'lookup_pool_not_found');
  const query = (req.body && req.body.query) || {};
  try {
    const state = entry.hub.submitQuery(query);
    res.json({ success: true, orgId, poolId: entry.hub.poolId, state });
  } catch (err) {
    sendError(res, 400, err.code || 'LOOKUPGATE_INVALID_INPUT', { message: err.message });
  }
}));

// POST /api/vault/lookup-gating/:poolId/validate — validate a ZK lookup claim
router.post('/lookup-gating/:poolId/validate', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveLookupGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'lookup_pool_not_found');
  const claim = (req.body && req.body.claim) || {};
  try {
    const state = entry.hub.validateProof(claim);
    res.json({ success: true, orgId, poolId: entry.hub.poolId, state });
  } catch (err) {
    sendError(res, 400, err.code || 'LOOKUPCLAIM_INVALID_INPUT', { message: err.message });
  }
}));

// POST /api/vault/lookup-gating/:poolId/accredit — finalize accreditation
router.post('/lookup-gating/:poolId/accredit', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveLookupGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'lookup_pool_not_found');
  try {
    const state = entry.hub.accredit();
    res.json({ success: true, orgId, poolId: entry.hub.poolId, state });
  } catch (err) {
    sendError(res, 400, err.code || 'LOOKUPGATE_INVALID_STATE', { message: err.message });
  }
}));

// GET /api/vault/lookup-gating/telemetry — expose Track 31 telemetry counters
router.get('/lookup-gating/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_lookupgate_pool_initialized_total: allMetrics.hsm_lookupgate_pool_initialized_total || 0,
      hsm_zk_lookup_claim_verified_total: allMetrics.hsm_zk_lookup_claim_verified_total || 0,
      hsm_lookup_accreditation_completed_total: allMetrics.hsm_lookup_accreditation_completed_total || 0,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'lookup_gating_telemetry_fetch_failed', { message: err.message });
  }
});

// ── Track 113: PQC Handshake Endpoint Integration ──────────────────────────────

function handshakeProofIsValid(record, clientProof) {
  // Placeholder verification: clientProof must match a deterministic digest of the session id.
  if (typeof clientProof !== 'string' || !clientProof) return false;
  const expected = crypto.createHmac('sha256', record.sessionId).update('track113-proof-challenge').digest('hex');
  const proofBuf = Buffer.from(clientProof);
  const expectedBuf = Buffer.from(expected);
  if (proofBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(proofBuf, expectedBuf);
}

// POST /api/vault/handshake/init — initialize an encrypted handshake session
router.post('/handshake/init', authorize('admin:all'), runAsync(async (req, res) => {
  const clientId = (req.body && req.body.clientId) || 'default-client';
  const handshakeDigest = (req.body && req.body.handshakeDigest) || '';
  const lifecycleTimeout = (req.body && typeof req.body.lifecycleTimeout === 'number') ? req.body.lifecycleTimeout : 3600000;
  if (!clientId || !handshakeDigest) return sendError(res, 400, 'HANDSHAKE_MISSING_PARAMETERS');

  const sessionId = crypto.randomBytes(16).toString('hex');
  const tenantId = resolveOrgId(req);
  const now = Date.now();
  const handshakeDigestEncrypted = encryptEnvelope(handshakeDigest, process.env.TRACK113_KEK);
  const record = SessionStore.create({
    sessionId,
    tenantId,
    clientId,
    status: 'INITIALIZED',
    handshakeDigestEncrypted,
    lifecycleTimeout,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + lifecycleTimeout,
  });

  res.status(201).json({
    success: true,
    orgId: tenantId,
    sessionId: record.sessionId,
    status: record.status,
    expiresAt: record.expiresAt,
  });
}));

// POST /api/vault/handshake/verify — verify a client proof and authenticate
router.post('/handshake/verify', authorize('admin:all'), runAsync(async (req, res) => {
  const sessionId = (req.body && req.body.sessionId) || '';
  const clientProof = (req.body && req.body.clientProof) || '';
  const expectedStateDigest = (req.body && req.body.expectedStateDigest) || '';
  if (!sessionId || !clientProof || !expectedStateDigest) return sendError(res, 400, 'HANDSHAKE_MISSING_PARAMETERS');

  const record = SessionStore.get(sessionId);
  if (!record) return sendError(res, 404, 'HANDSHAKE_SESSION_NOT_FOUND');
  if (record.status !== 'INITIALIZED') return sendError(res, 400, 'HANDSHAKE_INVALID_STATE');

  // verify client proof; expectedStateDigest is accepted as a caller-supplied structural check
  if (!handshakeProofIsValid(record, clientProof)) return sendError(res, 400, 'HANDSHAKE_INVALID_PROOF');

  record.status = 'VERIFIED';
  record.authenticatedAt = Date.now();
  record.updatedAt = Date.now();
  SessionStore.set(sessionId, record);

  res.json({
    success: true,
    orgId: record.tenantId || resolveOrgId(req),
    sessionId: record.sessionId,
    status: record.status,
    authenticatedAt: record.authenticatedAt,
  });
}));

// GET /api/vault/handshake/:sessionId/telemetry — session audit stream
router.get('/handshake/:sessionId/telemetry', authorize('admin:all'), runAsync(async (req, res) => {
  const sessionId = req.params.sessionId || '';
  const record = SessionStore.get(sessionId);
  if (!record) return sendError(res, 404, 'HANDSHAKE_SESSION_NOT_FOUND');
  res.json({
    success: true,
    orgId: record.tenantId || resolveOrgId(req),
    sessionId: record.sessionId,
    status: record.status,
    clientId: record.clientId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    authenticatedAt: record.authenticatedAt,
    expiresAt: record.expiresAt,
    // handshakeDigest intentionally omitted; never expose raw digest or keys
  });
}));


// ── Track 32: PQC Blinded Ring-Signature Gating Hub endpoints ─────────────────

function resolveRingGatingPool(poolId) {
  const pool = ringGatingPools.get(poolId);
  if (!pool) return null;
  return pool;
}

// POST /api/vault/ring-gating/pool — initialize a Track 32 ring gating pool
router.post('/ring-gating/pool', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const hub = new PqcBlindedRingSignatureGatingHub(orgId, ringGatingPolicyEngine);
  const poolId = crypto.randomBytes(16).toString('hex');
  ringGatingPools.set(poolId, { hub, orgId, createdAt: Date.now() });
  res.status(201).json({
    success: true,
    orgId,
    poolId,
    status: hub.state,
  });
}));

// POST /api/vault/ring-gating/:poolId/keys — collect anonymity set
router.post('/ring-gating/:poolId/keys', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveRingGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'ring_pool_not_found');
  const anonymitySet = (req.body && req.body.anonymitySet) || [];
  if (!Array.isArray(anonymitySet)) return sendError(res, 400, 'RINGGATE_INVALID_KEYS');
  try {
    const status = entry.hub.collectKeys(anonymitySet);
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
      ringSize: entry.hub.keys.length,
    });
  } catch (err) {
    sendError(res, 400, err.code || 'RINGGATE_INVALID_TRANSITION', { message: err.message });
  }
}));

// POST /api/vault/ring-gating/:poolId/validate — validate ZK ring proof
router.post('/ring-gating/:poolId/validate', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveRingGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'ring_pool_not_found');
  const claim = (req.body && req.body.claim) || {};
  const linkabilityToken = (req.body && req.body.linkabilityToken) || undefined;
  const blindedLinkabilityAttestation = (req.body && req.body.blindedLinkabilityAttestation) || undefined;
  try {
    const status = entry.hub.validateProof({
      ...claim,
      linkabilityToken,
      blindedLinkabilityAttestation,
    });
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
    });
  } catch (err) {
    const code = err.message && err.message.includes('RINGCLAIM_INVALID_ANONYMITY_SET_SIZE')
      ? 'RINGCLAIM_INVALID_ANONYMITY_SET_SIZE'
      : err.message && err.message.includes('RINGCLAIM_UNATTESTED_LINKABILITY')
        ? 'RINGCLAIM_UNATTESTED_LINKABILITY'
        : err.code || 'RINGGATE_INVALID_TRANSITION';
    sendError(res, 400, code, { message: err.message });
  }
}));

// POST /api/vault/ring-gating/:poolId/accredit — finalize accreditation
router.post('/ring-gating/:poolId/accredit', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveRingGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'ring_pool_not_found');
  try {
    const status = entry.hub.accredit();
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
    });
  } catch (err) {
    sendError(res, 400, err.code || 'RINGGATE_INVALID_TRANSITION', { message: err.message });
  }
}));

// GET /api/vault/ring-gating/telemetry — expose Track 32 telemetry counters (no raw keys/tokens)
router.get('/ring-gating/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_ringgate_pool_initialized_total: allMetrics.hsm_ringgate_pool_initialized_total || 0,
      hsm_zk_ring_claim_verified_total: allMetrics.hsm_zk_ring_claim_verified_total || 0,
      hsm_ring_accreditation_completed_total: allMetrics.hsm_ring_accreditation_completed_total || 0,
      activePools: ringGatingPools.size,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'ring_gating_telemetry_fetch_failed', { message: err.message });
  }
});

// GET /api/vault/ring-gating/:poolId — get pool status (no raw keys or tokens)
router.get('/ring-gating/:poolId', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveRingGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'ring_pool_not_found');
  res.json({
    success: true,
    orgId,
    poolId: req.params.poolId,
    status: entry.hub.state,
    ringSize: entry.hub.keys.length,
  });
}));


// ── Track 33: PQC Direct Accumulator Membership Proof Gating Hub endpoints ────

function resolveAccumulatorGatingPool(poolId) {
  const pool = accumulatorGatingPools.get(poolId);
  if (!pool) return null;
  return pool;
}

// POST /api/vault/accumulator-gating/pool — initialize a Track 33 accumulator gating pool
router.post('/accumulator-gating/pool', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const hub = new PqcDirectAccumulatorMembershipGatingHub(orgId, accumulatorGatingPolicyEngine);
  const poolId = crypto.randomBytes(16).toString('hex');
  accumulatorGatingPools.set(poolId, { hub, orgId, createdAt: Date.now() });
  res.status(201).json({
    success: true,
    orgId,
    poolId,
    status: hub.state,
  });
}));

// POST /api/vault/accumulator-gating/:poolId/witnesses — collect witness set
router.post('/accumulator-gating/:poolId/witnesses', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveAccumulatorGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'accumulator_pool_not_found');
  const witnesses = (req.body && req.body.witnesses) || [];
  if (!Array.isArray(witnesses)) return sendError(res, 400, 'ACCUMULATORGATE_INVALID_WITNESSES');
  try {
    const status = entry.hub.collectWitnesses(witnesses);
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
      witnessCount: entry.hub.witnesses.length,
    });
  } catch (err) {
    sendError(res, 400, err.code || 'ACCUMULATORGATE_INVALID_TRANSITION', { message: err.message });
  }
}));

// POST /api/vault/accumulator-gating/:poolId/validate — validate ZK accumulator membership claim
router.post('/accumulator-gating/:poolId/validate', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveAccumulatorGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'accumulator_pool_not_found');
  const claim = (req.body && req.body.claim) || {};
  const manifest = (req.body && req.body.manifest) || {};
  try {
    const status = entry.hub.validateProof({
      ...claim,
      accumulatorSize: manifest.accumulatorSize || claim.accumulatorSize,
    });
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
    });
  } catch (err) {
    const msg = err.message || '';
    const code = msg.includes('ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED')
      ? 'ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED'
      : msg.includes('ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM')
        ? 'ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM'
        : msg.includes('ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP')
          ? 'ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP'
          : err.code || 'ACCUMULATORGATE_INVALID_TRANSITION';
    sendError(res, 400, code, { message: err.message });
  }
}));

// POST /api/vault/accumulator-gating/:poolId/accredit — finalize accreditation
router.post('/accumulator-gating/:poolId/accredit', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveAccumulatorGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'accumulator_pool_not_found');
  try {
    const status = entry.hub.accredit();
    res.json({
      success: true,
      orgId,
      poolId: req.params.poolId,
      status,
    });
  } catch (err) {
    sendError(res, 400, err.code || 'ACCUMULATORGATE_INVALID_TRANSITION', { message: err.message });
  }
}));

// GET /api/vault/accumulator-gating/telemetry — expose Track 33 telemetry counters (no raw witness tokens or digests)
router.get('/accumulator-gating/telemetry', authorize('admin:all'), function (req, res) {
  try {
    const allMetrics = hsmMetrics.getMetrics();
    const telemetry = {
      hsm_accumulatorgate_pool_initialized_total: allMetrics.hsm_accumulatorgate_pool_initialized_total || 0,
      hsm_zk_accumulator_claim_verified_total: allMetrics.hsm_zk_accumulator_claim_verified_total || 0,
      hsm_accumulator_accreditation_completed_total: allMetrics.hsm_accumulator_accreditation_completed_total || 0,
      activePools: accumulatorGatingPools.size,
    };
    res.json({
      success: true,
      orgId: resolveOrgId(req),
      telemetry,
    });
  } catch (err) {
    sendError(res, 500, 'accumulator_gating_telemetry_fetch_failed', { message: err.message });
  }
});

// GET /api/vault/accumulator-gating/:poolId — get pool status (no raw witness tokens or digests)
router.get('/accumulator-gating/:poolId', authorize('admin:all'), runAsync(async (req, res) => {
  const orgId = resolveOrgId(req);
  const entry = resolveAccumulatorGatingPool(req.params.poolId);
  if (!entry) return sendError(res, 404, 'accumulator_pool_not_found');
  res.json({
    success: true,
    orgId,
    poolId: req.params.poolId,
    status: entry.hub.state,
    witnessCount: entry.hub.witnesses.length,
  });
}));

module.exports = router;
