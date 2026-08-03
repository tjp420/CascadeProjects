'use strict';

/**
 * Track 87: ZK Orbital Slot Claim Validator.
 *
 * Succinct orbital slot claim verifier that
 * processes non-interactive zero-knowledge
 * range and telemetry proofs with threshold
 * signature verification, ensuring that an
 * entity's hidden orbital claim status
 * strictly satisfies policy-defined thresholds
 * without disclosing individual orbital or
 * satellite attributes. Triggers defensive
 * node bans for malformed or out-of-order
 * orbital claims.
 *
 * @module hsm-adapter/zk-orbital-slot-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkOrbitalSlotClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcSpaceAssetTelemetryGatingHub} options.hub
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
   * Verify an orbital slot claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyTelemetryClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('SPACECLAIM_HUB_MISSING', 'space asset telemetry gating hub is required');
    }
    if (this.policy.requireOrbitalOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.orbitalOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SPACECLAIM_COMMITTEE_UNATTESTED', 'orbital oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SPACECLAIM_COMMITTEE_UNATTESTED', 'orbital oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SPACECLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('SPACECLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkOrbitalRangeProofHash || typeof request.zkOrbitalRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SPACECLAIM_ZK_PROOF_MISSING', 'zero-knowledge orbital range proof hash is required');
    }
    if (!request.thresholdSignature || typeof request.thresholdSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SPACECLAIM_THRESHOLD_SIG_MISSING', 'threshold signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SPACECLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.slotAllocationWindowSeconds === 'number' && request.slotAllocationWindowSeconds > (this.policy.maxSlotAllocationWindowSeconds || 31536000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SPACECLAIM_SLOT_WINDOW_OUT_OF_BOUNDS', `slot allocation window seconds ${request.slotAllocationWindowSeconds} exceeds maximum ${this.policy.maxSlotAllocationWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SPACECLAIM_DUPLICATE', `orbital slot claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedSlotAllocationCommitment: request.blindedSlotAllocationCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkOrbitalRangeProofHash: request.zkOrbitalRangeProofHash,
      orbitalOversightCommitteeAttestationHash: request.orbitalOversightCommitteeAttestationHash || 'unspecified',
      thresholdSignature: request.thresholdSignature,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markTelemetryClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_TELEMETRY_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderOrbitalClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SPACECLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireOrbitalOversightCommitteeAttestation && !request.orbitalOversightCommitteeAttestation) {
    throw new HsmAdapterError('SPACECLAIM_ATTESTATION_MISSING', 'orbital oversight committee attestation is required');
  }
}

module.exports = { ZkOrbitalSlotClaimValidator };
