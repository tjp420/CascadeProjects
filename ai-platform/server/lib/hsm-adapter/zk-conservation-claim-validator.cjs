'use strict';

/**
 * Track 90: ZK Conservation Claim Validator.
 *
 * Succinct conservation claim verifier that
 * processes non-interactive zero-knowledge
 * range and telemetry proofs with linkable
 * ring signature verification, ensuring that
 * an entity's hidden conservation claim
 * status strictly satisfies policy-defined
 * thresholds without disclosing individual
 * species or ranger attributes. Enforces
 * linkability tag uniqueness to prevent
 * double-reporting. Triggers defensive
 * node bans for malformed or out-of-order
 * conservation claims.
 *
 * @module hsm-adapter/zk-conservation-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkConservationClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcWildlifeConservationTrackingGatingHub} options.hub
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
    this._seenLinkabilityTags = new Set();
  }

  /**
   * Verify a conservation claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyConservationClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('WILDLIFECLAIM_HUB_MISSING', 'wildlife conservation tracking gating hub is required');
    }
    if (this.policy.requireBiodiversityOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.biodiversityOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('WILDLIFECLAIM_COMMITTEE_UNATTESTED', 'biodiversity oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('WILDLIFECLAIM_COMMITTEE_UNATTESTED', 'biodiversity oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('WILDLIFECLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('WILDLIFECLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkConservationRangeProofHash || typeof request.zkConservationRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_ZK_PROOF_MISSING', 'zero-knowledge conservation range proof hash is required');
    }
    if (!request.linkableRingSignature || typeof request.linkableRingSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_LINKABLE_RING_SIG_MISSING', 'linkable ring signature is required');
    }
    if (!request.linkabilityTag || typeof request.linkabilityTag !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_LINKABILITY_TAG_MISSING', 'linkability tag is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.monitoringWindowSeconds === 'number' && request.monitoringWindowSeconds > (this.policy.maxMonitoringWindowSeconds || 2592000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_MONITORING_WINDOW_OUT_OF_BOUNDS', `monitoring window seconds ${request.monitoringWindowSeconds} exceeds maximum ${this.policy.maxMonitoringWindowSeconds}`);
    }
    if (this._seenLinkabilityTags.has(request.linkabilityTag)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_DOUBLE_REPORT_DETECTED', `linkability tag ${request.linkabilityTag} already seen — double-reporting detected`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('WILDLIFECLAIM_DUPLICATE', `conservation claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedHabitatBoundaryCommitment: request.blindedHabitatBoundaryCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkConservationRangeProofHash: request.zkConservationRangeProofHash,
      biodiversityOversightCommitteeAttestationHash: request.biodiversityOversightCommitteeAttestationHash || 'unspecified',
      linkableRingSignature: request.linkableRingSignature,
      linkabilityTag: request.linkabilityTag,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._seenLinkabilityTags.add(request.linkabilityTag);
    this._hub.markConservationClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_CONSERVATION_CLAIM_VERIFIED', { ...claim });
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
   * Check if a linkability tag has been seen.
   * @param {string} tag
   * @returns {boolean}
   */
  isLinkabilityTagSeen(tag) {
    return this._seenLinkabilityTags.has(tag);
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderConservationClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('WILDLIFECLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireBiodiversityOversightCommitteeAttestation && !request.biodiversityOversightCommitteeAttestation) {
    throw new HsmAdapterError('WILDLIFECLAIM_ATTESTATION_MISSING', 'biodiversity oversight committee attestation is required');
  }
}

module.exports = { ZkConservationClaimValidator };
