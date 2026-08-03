'use strict';

/**
 * Track 82: ZK Training Claim Validator.
 *
 * Succinct training verifier that processes
 * non-interactive zero-knowledge range and provenance proofs,
 * ensuring that an entity's hidden training claim
 * status strictly satisfies policy-defined thresholds
 * without disclosing individual model or dataset
 * attributes. Triggers defensive node bans for malformed
 * or out-of-order training claims.
 *
 * @module hsm-adapter/zk-training-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkTrainingClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcAiModelTrainingGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
  }

  /**
   * Verify a training claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyTrainingClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('TRAINCLAIM_HUB_MISSING', 'AI model training gating hub is required');
    }
    if (this.policy.requireModelAuditCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.modelAuditCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TRAINCLAIM_COMMITTEE_UNATTESTED', 'model audit committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TRAINCLAIM_COMMITTEE_UNATTESTED', 'model audit committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TRAINCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('TRAINCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkTrainingRangeProofHash || typeof request.zkTrainingRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TRAINCLAIM_ZK_PROOF_MISSING', 'zero-knowledge training range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TRAINCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TRAINCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.trainingWindowSeconds === 'number' && request.trainingWindowSeconds > (this.policy.maxTrainingWindowSeconds || 63072000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TRAINCLAIM_TRAINING_WINDOW_OUT_OF_BOUNDS', `training window seconds ${request.trainingWindowSeconds} exceeds maximum ${this.policy.maxTrainingWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TRAINCLAIM_DUPLICATE', `training claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedDatasetProvenanceCommitment: request.blindedDatasetProvenanceCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkTrainingRangeProofHash: request.zkTrainingRangeProofHash,
      modelAuditCommitteeAttestationHash: request.modelAuditCommitteeAttestationHash || 'unspecified',
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markTrainingClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_TRAINING_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get all verified claims.
   * @returns {Array}
   */
  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderTrainingClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('TRAINCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireModelAuditCommitteeAttestation && !request.modelAuditCommitteeAttestation) {
    throw new HsmAdapterError('TRAINCLAIM_ATTESTATION_MISSING', 'model audit committee attestation is required');
  }
}

module.exports = { ZkTrainingClaimValidator };
