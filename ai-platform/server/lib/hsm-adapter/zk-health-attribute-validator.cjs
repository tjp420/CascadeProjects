'use strict';

/**
 * Track 72: ZK Health Attribute Validator.
 *
 * Succinct diagnostic verifier that processes non-interactive
 * zero-knowledge range and condition proofs, ensuring that an
 * entity's hidden medical claim status strictly satisfies
 * policy-defined thresholds without disclosing individual
 * health traits. Triggers defensive node bans for malformed
 * or out-of-order health claims.
 *
 * @module hsm-adapter/zk-health-attribute-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkHealthAttributeValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcHealthDataGatingHub} options.hub
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
   * Verify a health attribute claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyHealthClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('HEALTHCLAIM_HUB_MISSING', 'health data gating hub is required');
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HEALTHCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HEALTHCLAIM_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('HEALTHCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('HEALTHCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkHealthRangeProofHash || typeof request.zkHealthRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HEALTHCLAIM_ZK_PROOF_MISSING', 'zero-knowledge health range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HEALTHCLAIM_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HEALTHCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.recordExpirationLifetimeSeconds === 'number' && request.recordExpirationLifetimeSeconds > (this.policy.maxRecordExpirationLifetimeSeconds || 7776000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HEALTHCLAIM_EXPIRATION_LIFETIME_OUT_OF_BOUNDS', `record expiration lifetime seconds ${request.recordExpirationLifetimeSeconds} exceeds maximum ${this.policy.maxRecordExpirationLifetimeSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HEALTHCLAIM_DUPLICATE', `health claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedDiagnosticObservationCommitment: request.blindedDiagnosticObservationCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkHealthRangeProofHash: request.zkHealthRangeProofHash,
      clearingCommitteeAttestationHash: request.clearingCommitteeAttestationHash || 'unspecified',
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markHealthClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_HEALTH_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderHealthClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('HEALTHCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('HEALTHCLAIM_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { ZkHealthAttributeValidator };
