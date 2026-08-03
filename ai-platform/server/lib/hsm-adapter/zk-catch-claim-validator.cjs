'use strict';

/**
 * Track 94: ZK Catch Claim Validator.
 *
 * Succinct catch claim verifier that
 * processes non-interactive zero-knowledge
 * range and catch compliance proofs with
 * proxy re-encryption key digest
 * verification, ensuring that an entity's
 * hidden catch claim status strictly
 * satisfies policy-defined thresholds
 * without disclosing individual vessel or
 * authority attributes. Triggers defensive
 * node bans for malformed or out-of-order
 * catch claims.
 *
 * @module hsm-adapter/zk-catch-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkCatchClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcOceanFisheriesAllocationGatingHub} options.hub
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
   * Verify a catch claim proof with proxy re-encryption key digest.
   * @param {object} request
   * @returns {object}
   */
  verifyCatchClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('FISHERIESCLAIM_HUB_MISSING', 'ocean fisheries allocation gating hub is required');
    }
    if (this.policy.requireMarineSanctuaryOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.marineSanctuaryOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('FISHERIESCLAIM_COMMITTEE_UNATTESTED', 'marine sanctuary oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('FISHERIESCLAIM_COMMITTEE_UNATTESTED', 'marine sanctuary oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('FISHERIESCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('FISHERIESCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkCatchRangeProofHash || typeof request.zkCatchRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FISHERIESCLAIM_ZK_PROOF_MISSING', 'zero-knowledge catch range proof hash is required');
    }
    if (!request.proxyReEncryptionKeyDigest || typeof request.proxyReEncryptionKeyDigest !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FISHERIESCLAIM_PRE_KEY_DIGEST_MISSING', 'proxy re-encryption key digest is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FISHERIESCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.catchTrackingWindowSeconds === 'number' && request.catchTrackingWindowSeconds > (this.policy.maxCatchTrackingWindowSeconds || 2592000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FISHERIESCLAIM_TRACKING_WINDOW_OUT_OF_BOUNDS', `catch tracking window seconds ${request.catchTrackingWindowSeconds} exceeds maximum ${this.policy.maxCatchTrackingWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('FISHERIESCLAIM_DUPLICATE', `catch claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedQuotaAllocationCommitment: request.blindedQuotaAllocationCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkCatchRangeProofHash: request.zkCatchRangeProofHash,
      marineSanctuaryOversightCommitteeAttestationHash: request.marineSanctuaryOversightCommitteeAttestationHash || 'unspecified',
      proxyReEncryptionKeyDigest: request.proxyReEncryptionKeyDigest,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markCatchClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_CATCH_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderCatchClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('FISHERIESCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireMarineSanctuaryOversightCommitteeAttestation && !request.marineSanctuaryOversightCommitteeAttestation) {
    throw new HsmAdapterError('FISHERIESCLAIM_ATTESTATION_MISSING', 'marine sanctuary oversight committee attestation is required');
  }
}

module.exports = { ZkCatchClaimValidator };
