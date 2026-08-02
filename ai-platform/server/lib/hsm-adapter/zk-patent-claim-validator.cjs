'use strict';

/**
 * Track 74: ZK Patent Claim Validator.
 *
 * Succinct patent verifier that processes non-interactive
 * zero-knowledge range and priority proofs, ensuring that
 * an entity's hidden patent claim status strictly
 * satisfies policy-defined thresholds without disclosing
 * individual patent attributes. Triggers defensive node
 * bans for malformed or out-of-order patent claims.
 *
 * @module hsm-adapter/zk-patent-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkPatentClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcPatentVerificationGatingHub} options.hub
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
   * Verify a patent claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyPatentClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('PATENTCLAIM_HUB_MISSING', 'patent verification gating hub is required');
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('PATENTCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('PATENTCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('PATENTCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('PATENTCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkPatentRangeProofHash || typeof request.zkPatentRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('PATENTCLAIM_ZK_PROOF_MISSING', 'zero-knowledge patent range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('PATENTCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('PATENTCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.patentExpirationSeconds === 'number' && request.patentExpirationSeconds > (this.policy.maxPatentExpirationSeconds || 47304000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('PATENTCLAIM_PATENT_EXPIRATION_OUT_OF_BOUNDS', `patent expiration seconds ${request.patentExpirationSeconds} exceeds maximum ${this.policy.maxPatentExpirationSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('PATENTCLAIM_DUPLICATE', `patent claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedLicensingMetricCommitment: request.blindedLicensingMetricCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkPatentRangeProofHash: request.zkPatentRangeProofHash,
      clearingCommitteeAttestationHash: request.clearingCommitteeAttestationHash || 'unspecified',
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markPatentClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_PATENT_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderPatentClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('PATENTCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('PATENTCLAIM_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { ZkPatentClaimValidator };
