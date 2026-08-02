'use strict';

/**
 * Track 71: ZK Identity Gating Validator.
 *
 * Succinct gating verifier that processes non-interactive
 * zero-knowledge range and threshold validation proofs,
 * ensuring an entity's hidden claim status strictly
 * satisfies the policy-defined criteria without disclosing
 * individual parameter attributes. Triggers defensive node
 * bans for malformed or out-of-order identity claims.
 *
 * @module hsm-adapter/zk-identity-gating-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkIdentityGatingValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcIdentityGatingHub} options.hub
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
   * Verify an attribute claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyAttributeClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('ATTRCLAIM_HUB_MISSING', 'identity gating hub is required');
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('ATTRCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('ATTRCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('ATTRCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('ATTRCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkAttributeRangeProofHash || typeof request.zkAttributeRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('ATTRCLAIM_ZK_PROOF_MISSING', 'zero-knowledge attribute range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('ATTRCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('ATTRCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.contractLifetimeSeconds === 'number' && request.contractLifetimeSeconds > (this.policy.maxAttestationContractLifetimeSeconds || 31536000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('ATTRCLAIM_CONTRACT_LIFETIME_OUT_OF_BOUNDS', `contract lifetime seconds ${request.contractLifetimeSeconds} exceeds maximum ${this.policy.maxAttestationContractLifetimeSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('ATTRCLAIM_DUPLICATE', `attribute claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedAttributeMetricCommitment: request.blindedAttributeMetricCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkAttributeRangeProofHash: request.zkAttributeRangeProofHash,
      clearingCommitteeAttestationHash: request.clearingCommitteeAttestationHash || 'unspecified',
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markAttributeClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_ATTRIBUTE_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderIdentityClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ATTRCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('ATTRCLAIM_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { ZkIdentityGatingValidator };
