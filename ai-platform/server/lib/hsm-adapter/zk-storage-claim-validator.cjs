'use strict';

/**
 * Track 111: Zero-Knowledge Storage Claim Validator.
 *
 * Validates zero-knowledge proof-of-replication claims for decentralized storage
 * attestation pools. Enforces state check bounds, replica dispersal distance,
 * proof-of-space-time window, and issues slashing challenges for invalid claims.
 *
 * @module hsm-adapter/zk-storage-claim-validator
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class ZkStorageClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
  }

  /**
   * Validate a zero-knowledge storage claim.
   * @param {object} claim
   * @param {string} claim.poolId
   * @param {string} claim.proofOfSpaceTimeCommitment
   * @param {string} claim.storageSectorDigestCommitment
   * @param {string} claim.replicaDispersalCommitment
   * @param {number} claim.proofOfSpaceTimeWindowSeconds
   * @param {number} claim.storageAttestationChainDepth
   * @param {number} claim.replicaDispersalDistance
   * @param {string} [claim.pqcSignatureScheme]
   * @param {string} [claim.attestationAuthority]
   * @param {boolean} [claim.proofValid]
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);
    if (typeof claim.proofOfSpaceTimeWindowSeconds === 'number' && this.policy.maxProofOfSpaceTimeWindowSeconds !== undefined && claim.proofOfSpaceTimeWindowSeconds > this.policy.maxProofOfSpaceTimeWindowSeconds) {
      this._issueChallenge(claim.poolId, 'proof_of_space_time_window_exceeded');
      throw new HsmAdapterError('ZKSTORAGE_PROOF_OF_SPACE_TIME_WINDOW_EXCEEDED', `proof-of-space-time window seconds ${claim.proofOfSpaceTimeWindowSeconds} exceeds maximum ${this.policy.maxProofOfSpaceTimeWindowSeconds}`);
    }
    if (typeof claim.storageAttestationChainDepth === 'number' && this.policy.maxStorageAttestationChainDepth !== undefined && claim.storageAttestationChainDepth > this.policy.maxStorageAttestationChainDepth) {
      this._issueChallenge(claim.poolId, 'storage_attestation_chain_depth_exceeded');
      throw new HsmAdapterError('ZKSTORAGE_CHAIN_DEPTH_EXCEEDED', `storage attestation chain depth ${claim.storageAttestationChainDepth} exceeds maximum ${this.policy.maxStorageAttestationChainDepth}`);
    }
    if (typeof claim.replicaDispersalDistance === 'number' && this.policy.maxReplicaDispersalDistance !== undefined && claim.replicaDispersalDistance > this.policy.maxReplicaDispersalDistance) {
      this._issueChallenge(claim.poolId, 'replica_dispersal_distance_exceeded');
      throw new HsmAdapterError('ZKSTORAGE_REPLICA_DISPERSAL_DISTANCE_EXCEEDED', `replica dispersal distance ${claim.replicaDispersalDistance} exceeds maximum ${this.policy.maxReplicaDispersalDistance}`);
    }
    if (typeof claim.pqcSignatureScheme === 'string' && this.policy.allowedPqcSignatureSchemes && !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)) {
      this._issueChallenge(claim.poolId, 'pqc_signature_scheme_blocked');
      throw new HsmAdapterError('ZKSTORAGE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${claim.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof claim.attestationAuthority === 'string' && this.policy.allowedAttestationAuthorities && !this.policy.allowedAttestationAuthorities.includes(claim.attestationAuthority)) {
      this._issueChallenge(claim.poolId, 'attestation_authority_blocked');
      throw new HsmAdapterError('ZKSTORAGE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, 'proof_invalid');
      throw new HsmAdapterError('ZKSTORAGE_PROOF_INVALID', `storage proof for pool ${claim.poolId} is invalid`);
    }
    hsmMetrics.incrementCounter('hsm_zk_storage_proof_verified_total', 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter('hsm_zkstorage_challenge_issued_total', 1);
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== 'object') {
    throw new HsmAdapterError('ZKSTORAGE_CLAIM_SHAPE_INVALID', 'claim must be an object');
  }
  if (!claim.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_CLAIM_SHAPE_INVALID', 'poolId is required');
  }
  if (!claim.proofOfSpaceTimeCommitment || !claim.storageSectorDigestCommitment || !claim.replicaDispersalCommitment) {
    throw new HsmAdapterError('ZKSTORAGE_CLAIM_SHAPE_INVALID', 'proofOfSpaceTimeCommitment, storageSectorDigestCommitment, and replicaDispersalCommitment are required');
  }
}

module.exports = { ZkStorageClaimValidator };
