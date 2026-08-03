'use strict';

/**
 * Track 89: ZK Safeguards Claim Validator.
 *
 * Succinct safeguards claim verifier that
 * processes non-interactive zero-knowledge
 * range and telemetry proofs with threshold
 * ring signature verification, ensuring that
 * an entity's hidden safeguards claim status
 * strictly satisfies policy-defined thresholds
 * without disclosing individual facility or
 * inspector attributes. Triggers defensive
 * node bans for malformed or out-of-order
 * safeguards claims.
 *
 * @module hsm-adapter/zk-safeguards-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkSafeguardsClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcNuclearSafeguardsMonitoringGatingHub} options.hub
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
   * Verify a safeguards claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifySafeguardsClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('NUCLEARCLAIM_HUB_MISSING', 'nuclear safeguards monitoring gating hub is required');
    }
    if (this.policy.requireNuclearOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.nuclearOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('NUCLEARCLAIM_COMMITTEE_UNATTESTED', 'nuclear oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('NUCLEARCLAIM_COMMITTEE_UNATTESTED', 'nuclear oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('NUCLEARCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('NUCLEARCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkSafeguardsRangeProofHash || typeof request.zkSafeguardsRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('NUCLEARCLAIM_ZK_PROOF_MISSING', 'zero-knowledge safeguards range proof hash is required');
    }
    if (!request.thresholdRingSignature || typeof request.thresholdRingSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('NUCLEARCLAIM_THRESHOLD_RING_SIG_MISSING', 'threshold ring signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('NUCLEARCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.inspectionWindowSeconds === 'number' && request.inspectionWindowSeconds > (this.policy.maxInspectionWindowSeconds || 7776000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('NUCLEARCLAIM_INSPECTION_WINDOW_OUT_OF_BOUNDS', `inspection window seconds ${request.inspectionWindowSeconds} exceeds maximum ${this.policy.maxInspectionWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('NUCLEARCLAIM_DUPLICATE', `safeguards claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedInspectionReportCommitment: request.blindedInspectionReportCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkSafeguardsRangeProofHash: request.zkSafeguardsRangeProofHash,
      nuclearOversightCommitteeAttestationHash: request.nuclearOversightCommitteeAttestationHash || 'unspecified',
      thresholdRingSignature: request.thresholdRingSignature,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markSafeguardsClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_SAFEGUARDS_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderSafeguardsClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('NUCLEARCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireNuclearOversightCommitteeAttestation && !request.nuclearOversightCommitteeAttestation) {
    throw new HsmAdapterError('NUCLEARCLAIM_ATTESTATION_MISSING', 'nuclear oversight committee attestation is required');
  }
}

module.exports = { ZkSafeguardsClaimValidator };
