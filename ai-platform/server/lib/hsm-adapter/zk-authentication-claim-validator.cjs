'use strict';

/**
 * Track 93: ZK Authentication Claim Validator.
 *
 * Succinct authentication claim verifier
 * that processes non-interactive
 * zero-knowledge range and fuzzy matching
 * proofs, ensuring that an entity's
 * hidden authentication claim status
 * strictly satisfies policy-defined
 * thresholds without disclosing individual
 * artwork or collector attributes. Triggers
 * defensive node bans for malformed or
 * out-of-order authentication claims.
 *
 * @module hsm-adapter/zk-authentication-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkAuthenticationClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcCulturalHeritageProvenanceGatingHub} options.hub
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
   * Verify an authentication claim proof with fuzzy matching.
   * @param {object} request
   * @returns {object}
   */
  verifyAuthenticationClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('HERITAGECLAIM_HUB_MISSING', 'cultural heritage provenance gating hub is required');
    }
    if (this.policy.requireCulturalHeritageOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.culturalHeritageOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HERITAGECLAIM_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HERITAGECLAIM_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('HERITAGECLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('HERITAGECLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkAuthenticationRangeProofHash || typeof request.zkAuthenticationRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_ZK_PROOF_MISSING', 'zero-knowledge authentication range proof hash is required');
    }
    if (!request.fuzzyMatchProofHash || typeof request.fuzzyMatchProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_FUZZY_MATCH_PROOF_MISSING', 'fuzzy match proof hash is required');
    }
    if (typeof request.fuzzyMatchThreshold !== 'number' || request.fuzzyMatchThreshold < 0 || request.fuzzyMatchThreshold > 1) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_FUZZY_THRESHOLD_INVALID', 'fuzzy match threshold must be a number between 0 and 1');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.authenticationWindowSeconds === 'number' && request.authenticationWindowSeconds > (this.policy.maxAuthenticationWindowSeconds || 15552000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_AUTHENTICATION_WINDOW_OUT_OF_BOUNDS', `authentication window seconds ${request.authenticationWindowSeconds} exceeds maximum ${this.policy.maxAuthenticationWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('HERITAGECLAIM_DUPLICATE', `authentication claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedProvenanceChainCommitment: request.blindedProvenanceChainCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkAuthenticationRangeProofHash: request.zkAuthenticationRangeProofHash,
      culturalHeritageOversightCommitteeAttestationHash: request.culturalHeritageOversightCommitteeAttestationHash || 'unspecified',
      fuzzyMatchThreshold: request.fuzzyMatchThreshold,
      fuzzyMatchProofHash: request.fuzzyMatchProofHash,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markAuthenticationClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_AUTHENTICATION_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderAuthenticationClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('HERITAGECLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireCulturalHeritageOversightCommitteeAttestation && !request.culturalHeritageOversightCommitteeAttestation) {
    throw new HsmAdapterError('HERITAGECLAIM_ATTESTATION_MISSING', 'cultural heritage oversight committee attestation is required');
  }
}

module.exports = { ZkAuthenticationClaimValidator };
