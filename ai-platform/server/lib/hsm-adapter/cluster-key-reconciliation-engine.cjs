'use strict';

/**
 * Track 35: Cluster Key Reconciliation.
 *
 * Detects split-brain key divergence across cluster nodes and reconciles
 * divergent keys via quorum-voted key epoch advancement. Provides secure
 * multi-region state comparison for cryptographic key material with
 * anti-rollback protection.
 *
 * Components:
 *   - KeyEpochTracker: per-node, per-key monotonic epoch tracker
 *   - Divergence detection: scans for key epoch mismatches
 *   - Reconciliation state machine: SCANNING → DIVERGENT → RECONCILING →
 *     RECONCILED (with QUARANTINED terminal)
 *   - BFT quorum gating: key epoch promotion requires t-of-N votes
 *   - Anti-rollback: key epochs must be strictly monotonic
 *   - Split-brain detection: divergent nodes isolated from quorum
 *
 * @module hsm-adapter/cluster-key-reconciliation-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { incrementCounter } = require('./hsm-metrics.cjs');
const {
  ensureSameTenant,
  isValidTenantId,
  TENANT_FIELD,
  DEFAULT_TENANT,
} = require('../replication-tenant-context.cjs');

// ── Reconciliation states ────────────────────────────────────────
const RECONCILIATION_STATE = {
  SCANNING: 'scanning',
  DIVERGENT: 'divergent',
  RECONCILING: 'reconciling',
  RECONCILED: 'reconciled',
  QUARANTINED: 'quarantined',
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [RECONCILIATION_STATE.SCANNING]: [RECONCILIATION_STATE.DIVERGENT, RECONCILIATION_STATE.RECONCILED],
  [RECONCILIATION_STATE.DIVERGENT]: [RECONCILIATION_STATE.RECONCILING, RECONCILIATION_STATE.QUARANTINED],
  [RECONCILIATION_STATE.RECONCILING]: [RECONCILIATION_STATE.RECONCILED, RECONCILIATION_STATE.QUARANTINED],
  [RECONCILIATION_STATE.RECONCILED]: [],
  [RECONCILIATION_STATE.QUARANTINED]: [],
};

// ── Divergence severity ──────────────────────────────────────────
const DIVERGENCE_SEVERITY = {
  NONE: 'none',
  MINOR: 'minor',
  CRITICAL: 'critical',
};

// ── Node health states ───────────────────────────────────────────
const NODE_HEALTH = {
  HEALTHY: 'healthy',
  DIVERGENT: 'divergent',
  QUARANTINED: 'quarantined',
};

/**
 * Compute a SHA-256 fingerprint of key material.
 * @param {string|Buffer} keyMaterial
 * @returns {string} hex digest
 */
function computeKeyFingerprint(keyMaterial) {
  return crypto.createHash('sha256').update(keyMaterial).digest('hex');
}

/**
 * KeyEpochTracker — per-node, per-key epoch tracker.
 *
 * Tracks the current epoch and fingerprint of a key on each node.
 */
class KeyEpochTracker {
  constructor() {
    this._keys = new Map(); // keyId -> { epochs: Map<nodeId, {epoch, fingerprint}>, promotedEpoch }
  }

  /**
   * Register a key's epoch and fingerprint for a node.
   * @param {string} keyId
   * @param {string} nodeId
   * @param {number} epoch
   * @param {string} fingerprint
   */
  registerNodeKey(keyId, nodeId, epoch, fingerprint) {
    if (!this._keys.has(keyId)) {
      this._keys.set(keyId, { epochs: new Map(), promotedEpoch: 0 });
    }
    const keyState = this._keys.get(keyId);
    keyState.epochs.set(nodeId, { epoch, fingerprint });
  }

  /**
   * Get the epoch and fingerprint for a node's key.
   * @param {string} keyId
   * @param {string} nodeId
   * @returns {object|null}
   */
  getNodeKey(keyId, nodeId) {
    const keyState = this._keys.get(keyId);
    if (!keyState) return null;
    return keyState.epochs.get(nodeId) || null;
  }

  /**
   * Get all node entries for a key.
   * @param {string} keyId
   * @returns {Map}
   */
  getKeyNodes(keyId) {
    const keyState = this._keys.get(keyId);
    if (!keyState) return new Map();
    return keyState.epochs;
  }

  /**
   * Get all registered key IDs.
   * @returns {string[]}
   */
  keyIds() {
    return Array.from(this._keys.keys());
  }

  /**
   * Get the promoted (committed) epoch for a key.
   * @param {string} keyId
   * @returns {number}
   */
  getPromotedEpoch(keyId) {
    const keyState = this._keys.get(keyId);
    return keyState ? keyState.promotedEpoch : 0;
  }

  /**
   * Set the promoted epoch for a key.
   * @param {string} keyId
   * @param {number} epoch
   */
  setPromotedEpoch(keyId, epoch) {
    if (!this._keys.has(keyId)) {
      this._keys.set(keyId, { epochs: new Map(), promotedEpoch: 0 });
    }
    this._keys.get(keyId).promotedEpoch = epoch;
  }

  /**
   * Detect divergence for a key across nodes.
   * @param {string} keyId
   * @returns {object} divergence report
   */
  detectDivergence(keyId) {
    const nodes = this.getKeyNodes(keyId);
    if (nodes.size === 0) {
      return { keyId, severity: DIVERGENCE_SEVERITY.NONE, divergentNodes: [], quorumEpoch: null };
    }

    // Group nodes by fingerprint
    const fingerprintGroups = new Map(); // fingerprint -> [{ nodeId, epoch }]
    for (const [nodeId, { epoch, fingerprint }] of nodes) {
      if (!fingerprintGroups.has(fingerprint)) {
        fingerprintGroups.set(fingerprint, []);
      }
      fingerprintGroups.get(fingerprint).push({ nodeId, epoch });
    }

    if (fingerprintGroups.size === 1) {
      // All nodes agree
      const allNodes = Array.from(nodes.values());
      const maxEpoch = Math.max(...allNodes.map((n) => n.epoch));
      return {
        keyId,
        severity: DIVERGENCE_SEVERITY.NONE,
        divergentNodes: [],
        quorumEpoch: maxEpoch,
        fingerprintGroups: 1,
      };
    }

    // Divergence detected — find the majority fingerprint
    let majorityFingerprint = null;
    let majorityCount = 0;
    for (const [fp, group] of fingerprintGroups) {
      if (group.length > majorityCount) {
        majorityCount = group.length;
        majorityFingerprint = fp;
      }
    }

    // Divergent nodes are those not in the majority group
    const divergentNodes = [];
    for (const [nodeId, { epoch, fingerprint }] of nodes) {
      if (fingerprint !== majorityFingerprint) {
        divergentNodes.push({ nodeId, epoch, fingerprint });
      }
    }

    // Severity: critical if no majority can form quorum
    const severity = majorityCount >= Math.floor(nodes.size / 2) + 1
      ? DIVERGENCE_SEVERITY.MINOR
      : DIVERGENCE_SEVERITY.CRITICAL;

    // Quorum epoch is the max epoch in the majority group
    const majorityEpochs = fingerprintGroups.get(majorityFingerprint).map((n) => n.epoch);
    const quorumEpoch = Math.max(...majorityEpochs);

    return {
      keyId,
      severity,
      divergentNodes,
      quorumEpoch,
      majorityFingerprint,
      majorityCount,
      fingerprintGroups: fingerprintGroups.size,
    };
  }
}

/**
 * ClusterKeyReconciliationEngine.
 *
 * Manages the full lifecycle of cluster key reconciliation with
 * BFT-gated epoch promotion, split-brain detection, and anti-rollback.
 */
class ClusterKeyReconciliationEngine {
  /**
   * @param {object} options
   * @param {string[]} options.clusterNodes
   * @param {number} [options.minQuorumNodes]
   * @param {number} [options.maxEpochRollbackAttempts] — max attempts before quarantine
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (!Array.isArray(options.clusterNodes) || options.clusterNodes.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'clusterNodes must be a non-empty array');
    }
    this.clusterNodes = new Set(options.clusterNodes);
    this.minQuorumNodes = options.minQuorumNodes || Math.floor(options.clusterNodes.length / 2) + 1;
    this.maxEpochRollbackAttempts = options.maxEpochRollbackAttempts || 3;
    this._audit = options.audit || null;

    this._tracker = new KeyEpochTracker();
    this._nodeHealth = new Map(); // nodeId -> NODE_HEALTH
    for (const nodeId of options.clusterNodes) {
      this._nodeHealth.set(nodeId, NODE_HEALTH.HEALTHY);
    }

    // Per-key reconciliation state
    this._reconciliationStates = new Map(); // keyId -> state
    this._promotionVotes = new Map(); // keyId -> Map<nodeId, votedEpoch>
    this._rollbackAttempts = new Map(); // keyId -> count

    // Track 124: per-key tenant isolation
    this._keyTenants = new Map(); // keyId -> tenantId
  }

  /**
   * Register a key's epoch and fingerprint for a node.
   * @param {string} keyId
   * @param {string} nodeId
   * @param {number} epoch
   * @param {string|Buffer} keyMaterial
   */
  registerKey(keyId, nodeId, epoch, keyMaterial, tenantId = DEFAULT_TENANT) {
    this._validateNode(nodeId);
    this._validateTenant(tenantId);
    this._ensureKeyTenant(keyId, tenantId);
    const fingerprint = computeKeyFingerprint(keyMaterial);
    this._tracker.registerNodeKey(keyId, nodeId, epoch, fingerprint);
    this._keyTenants.set(keyId, tenantId);

    this._emitAudit('KEY_REGISTERED', { keyId, nodeId, epoch, fingerprint, tenantId });
  }

  /**
   * Scan all registered keys for divergence.
   * @returns {object[]} divergence reports
   */
  scan() {
    const reports = [];
    for (const keyId of this._tracker.keyIds()) {
      const report = this._tracker.detectDivergence(keyId);
      reports.push(report);

      if (report.severity === DIVERGENCE_SEVERITY.NONE) {
        // All nodes agree — update promoted epoch
        this._tracker.setPromotedEpoch(keyId, report.quorumEpoch);
        this._reconciliationStates.set(keyId, RECONCILIATION_STATE.RECONCILED);
      } else {
        // Divergence detected — set promoted epoch to the quorum epoch
        // (the majority's max epoch) so anti-rollback can be enforced
        if (report.quorumEpoch !== null && report.quorumEpoch !== undefined) {
          this._tracker.setPromotedEpoch(keyId, report.quorumEpoch);
        }
        this._reconciliationStates.set(keyId, RECONCILIATION_STATE.DIVERGENT);

        // Mark divergent nodes
        for (const { nodeId } of report.divergentNodes) {
          this._nodeHealth.set(nodeId, NODE_HEALTH.DIVERGENT);
        }

        const tenantId = this._keyTenants.get(keyId) || DEFAULT_TENANT;
        this._emitAudit('KEY_DIVERGENCE_DETECTED', {
          keyId,
          severity: report.severity,
          divergentCount: report.divergentNodes.length,
          tenantId,
        });
      }
    }
    return reports;
  }

  /**
   * Begin reconciliation for a divergent key.
   * @param {string} keyId
   * @param {number} targetEpoch
   */
  beginReconciliation(keyId, targetEpoch, tenantId = DEFAULT_TENANT) {
    this._validateTenant(tenantId);
    this._ensureKeyTenant(keyId, tenantId);
    const state = this._reconciliationStates.get(keyId);
    if (state !== RECONCILIATION_STATE.DIVERGENT) {
      throw new HsmAdapterError(
        'RECONCILIATION_NOT_DIVERGENT',
        `key ${keyId} is in state ${state || 'untracked'}, must be divergent`,
      );
    }

    // Anti-rollback: target epoch must be >= current promoted epoch
    const currentEpoch = this._tracker.getPromotedEpoch(keyId);
    if (targetEpoch < currentEpoch) {
      const attempts = (this._rollbackAttempts.get(keyId) || 0) + 1;
      this._rollbackAttempts.set(keyId, attempts);
      this._emitAudit('KEY_EPOCH_ROLLBACK_BLOCKED', { keyId, targetEpoch, currentEpoch, attempts, tenantId });

      if (attempts >= this.maxEpochRollbackAttempts) {
        this._transition(keyId, RECONCILIATION_STATE.QUARANTINED);
        throw new HsmAdapterError(
          'RECONCILIATION_QUARANTINED',
          `key ${keyId} quarantined after ${attempts} rollback attempts`,
        );
      }
      throw new HsmAdapterError(
        'KEY_EPOCH_ROLLBACK_BLOCKED',
        `target epoch ${targetEpoch} < current epoch ${currentEpoch} for key ${keyId}`,
      );
    }

    this._transition(keyId, RECONCILIATION_STATE.RECONCILING);
    this._promotionVotes.set(keyId, new Map());

    this._emitAudit('RECONCILIATION_STARTED', { keyId, targetEpoch, currentEpoch, tenantId });
    return { keyId, targetEpoch, state: RECONCILIATION_STATE.RECONCILING };
  }

  /**
   * Cast a vote for a key epoch promotion from a healthy node.
   * @param {string} keyId
   * @param {string} nodeId
   * @param {number} votedEpoch
   */
  votePromotion(keyId, nodeId, votedEpoch, tenantId = DEFAULT_TENANT) {
    this._validateNode(nodeId);
    this._validateTenant(tenantId);
    this._ensureKeyTenant(keyId, tenantId);

    // Only healthy nodes can vote
    if (this._nodeHealth.get(nodeId) !== NODE_HEALTH.HEALTHY) {
      throw new HsmAdapterError(
        'NODE_NOT_HEALTHY',
        `node ${nodeId} is ${this._nodeHealth.get(nodeId)} and cannot vote on key promotion`,
      );
    }

    const state = this._reconciliationStates.get(keyId);
    if (state !== RECONCILIATION_STATE.RECONCILING) {
      throw new HsmAdapterError(
        'RECONCILIATION_NOT_IN_PROGRESS',
        `key ${keyId} is in state ${state}, must be reconciling`,
      );
    }

    if (!this._promotionVotes.has(keyId)) {
      this._promotionVotes.set(keyId, new Map());
    }
    const votes = this._promotionVotes.get(keyId);
    votes.set(nodeId, votedEpoch);

    this._emitAudit('PROMOTION_VOTED', { keyId, nodeId, votedEpoch, totalVotes: votes.size, tenantId });

    // Check if quorum reached
    if (votes.size >= this.minQuorumNodes) {
      this._promoteKey(keyId, votedEpoch);
    }

    return {
      keyId,
      nodeId,
      votedEpoch,
      totalVotes: votes.size,
      quorumReached: votes.size >= this.minQuorumNodes,
      state: this._reconciliationStates.get(keyId),
    };
  }

  /**
   * Promote a key to a new epoch after quorum is reached.
   * @param {string} keyId
   * @param {number} newEpoch
   */
  _promoteKey(keyId, newEpoch) {
    this._tracker.setPromotedEpoch(keyId, newEpoch);
    this._transition(keyId, RECONCILIATION_STATE.RECONCILED);

    // Reset divergent nodes to healthy (they'll need to catch up)
    for (const [nodeId, health] of this._nodeHealth) {
      if (health === NODE_HEALTH.DIVERGENT) {
        this._nodeHealth.set(nodeId, NODE_HEALTH.HEALTHY);
      }
    }

    const tenantId = this._keyTenants.get(keyId) || DEFAULT_TENANT;
    this._emitAudit('KEY_PROMOTED', { keyId, newEpoch, quorumVotes: this._promotionVotes.get(keyId).size, tenantId });
  }

  /**
   * Force quarantine a key (manual operator intervention).
   * @param {string} keyId
   * @param {string} [reason]
   */
  quarantine(keyId, reason = 'manual') {
    const state = this._reconciliationStates.get(keyId);
    if (state === RECONCILIATION_STATE.RECONCILED) {
      throw new HsmAdapterError('RECONCILIATION_ALREADY_RECONCILED', `key ${keyId} already reconciled`);
    }
    if (state === RECONCILIATION_STATE.QUARANTINED) {
      throw new HsmAdapterError('RECONCILIATION_ALREADY_QUARANTINED', `key ${keyId} already quarantined`);
    }
    this._transition(keyId, RECONCILIATION_STATE.QUARANTINED);
    const tenantId = this._keyTenants.get(keyId) || DEFAULT_TENANT;
    this._emitAudit('KEY_QUARANTINED', { keyId, reason, tenantId });
    return { keyId, state: RECONCILIATION_STATE.QUARANTINED, reason };
  }

  /**
   * Get the reconciliation state for a key.
   * @param {string} keyId
   * @returns {object}
   */
  getReconciliationState(keyId) {
    const state = this._reconciliationStates.get(keyId) || RECONCILIATION_STATE.SCANNING;
    const promotedEpoch = this._tracker.getPromotedEpoch(keyId);
    const votes = this._promotionVotes.get(keyId);
    return {
      keyId,
      state,
      promotedEpoch,
      voteCount: votes ? votes.size : 0,
      quorumRequired: this.minQuorumNodes,
    };
  }

  /**
   * Get the health status of a node.
   * @param {string} nodeId
   * @returns {string}
   */
  getNodeHealth(nodeId) {
    this._validateNode(nodeId);
    return this._nodeHealth.get(nodeId);
  }

  /**
   * Get the key fingerprint for a node's key.
   * @param {string} keyId
   * @param {string} nodeId
   * @returns {string|null}
   */
  getKeyFingerprint(keyId, nodeId) {
    const nodeKey = this._tracker.getNodeKey(keyId, nodeId);
    return nodeKey ? nodeKey.fingerprint : null;
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    const nodeHealth = {};
    for (const [nodeId, health] of this._nodeHealth) {
      nodeHealth[nodeId] = health;
    }
    return {
      trackedKeys: this._tracker.keyIds().length,
      clusterSize: this.clusterNodes.size,
      minQuorumNodes: this.minQuorumNodes,
      nodeHealth,
    };
  }

  /**
   * Validate that a node is part of the cluster.
   * @param {string} nodeId
   */
  _validateNode(nodeId) {
    if (!this.clusterNodes.has(nodeId)) {
      throw new HsmAdapterError('NODE_UNKNOWN', `node ${nodeId} not in cluster`);
    }
  }

  /**
   * Validate a tenant identifier.
   * @param {string} tenantId
   */
  _validateTenant(tenantId) {
    if (!isValidTenantId(tenantId)) {
      incrementCounter('hsm_replication_tenant_isolation_violation_total');
      incrementCounter('hsm_zk_tenant_isolation_violation_total');
      throw new HsmAdapterError('INVALID_TENANT_ID', `invalid tenantId: ${tenantId}`);
    }
  }

  /**
   * Ensure an operation targets the same tenant as the key's registration.
   * @param {string} keyId
   * @param {string} tenantId
   */
  _ensureKeyTenant(keyId, tenantId) {
    const stored = this._keyTenants.get(keyId);
    if (stored === undefined) {
      return;
    }
    try {
      ensureSameTenant(stored, tenantId, { action: 'cross_tenant_reconciliation_rejected' });
    } catch (err) {
      throw new HsmAdapterError(
        'CROSS_TENANT_KEY_RECONCILIATION',
        err.message,
      );
    }
  }

  /**
   * Transition a key's reconciliation state.
   * @param {string} keyId
   * @param {string} newState
   */
  _transition(keyId, newState) {
    const currentState = this._reconciliationStates.get(keyId) || RECONCILIATION_STATE.SCANNING;
    const allowed = VALID_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        'RECONCILIATION_INVALID_TRANSITION',
        `cannot transition key ${keyId} from ${currentState} to ${newState}`,
      );
    }
    this._reconciliationStates.set(keyId, newState);
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  ClusterKeyReconciliationEngine,
  KeyEpochTracker,
  computeKeyFingerprint,
  RECONCILIATION_STATE,
  VALID_TRANSITIONS,
  DIVERGENCE_SEVERITY,
  NODE_HEALTH,
};
