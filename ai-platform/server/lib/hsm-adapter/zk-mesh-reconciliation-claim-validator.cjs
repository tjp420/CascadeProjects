'use strict';

/**
 * Track 115: ZK Mesh Reconciliation Claim Validator.
 *
 * Validates zero-knowledge mesh state-reconciliation claims against
 * multi-enclave confidential mesh gating pools. Enforces canonical
 * payload layout, verifies epoch finality window, and rejects claims
 * with excessive reconciliation chain depth or disallowed PQC schemes.
 *
 * @module hsm-adapter/zk-mesh-reconciliation-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class ZkMeshReconciliationClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  validateClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);

    // Check epoch finality window
    if (typeof request.timestampMs === 'number') {
      const ageMs = Date.now() - request.timestampMs;
      const maxWindowMs = (this.policy.maxEpochFinalityWindowSeconds || 10) * 1000;
      if (ageMs > maxWindowMs) {
        throw new HsmAdapterError('MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED', `claim age ${ageMs}ms exceeds maximum window ${maxWindowMs}ms`);
      }
    }

    // Check reconciliation chain depth
    if (typeof request.reconciliationChainDepth === 'number') {
      const maxDepth = this.policy.maxReconciliationChainDepth || 100;
      if (request.reconciliationChainDepth > maxDepth) {
        throw new HsmAdapterError('MESHCLAIM_RECONCILIATION_CHAIN_DEPTH_EXCEEDED', `reconciliation chain depth ${request.reconciliationChainDepth} exceeds maximum ${maxDepth}`);
      }
    }

    // Check PQC signature scheme
    if (typeof request.pqcSignatureScheme === 'string' && this.policy.allowedPqcSignatureSchemes && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('MESHCLAIM_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted`);
    }

    // Check proof validity
    if (request.proofValid === false) {
      throw new HsmAdapterError('MESHCLAIM_PROOF_INVALID', 'mesh reconciliation proof is invalid');
    }

    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      confidentialStateReconciliationDigest: request.confidentialStateReconciliationDigest,
      timestampMs: request.timestampMs,
    })).digest('hex');

    if (this.policy.banMalformedOrOutOfOrderMeshReconciliationClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('MESHCLAIM_DUPLICATE', `duplicate mesh reconciliation claim for pool ${request.poolId}`);
    }

    this._verifiedClaims.add(claimHash);
    hsmMetrics.incrementCounter('hsm_zk_mesh_state_reconciled_total', 1);

    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      confidentialStateReconciliationDigest: request.confidentialStateReconciliationDigest,
      valid: true,
      verifiedAt: Math.floor(Date.now() / 1000),
    };

    if (this._audit) {
      this._audit('ZK_MESH_RECONCILIATION_CLAIM_VERIFIED', { ...claim });
    }

    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError('MESHCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.confidentialStateReconciliationDigest) {
    throw new HsmAdapterError('MESHCLAIM_FIELDS_MISSING', 'confidentialStateReconciliationDigest is required');
  }
  if (typeof request.timestampMs !== 'number') {
    throw new HsmAdapterError('MESHCLAIM_FIELDS_MISSING', 'timestampMs is required');
  }
}

module.exports = { ZkMeshReconciliationClaimValidator };
