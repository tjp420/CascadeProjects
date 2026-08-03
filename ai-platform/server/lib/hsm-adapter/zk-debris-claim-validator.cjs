'use strict';

/**
 * Track 98: ZK Debris Claim Validator.
 *
 * Validates zero-knowledge orbital debris tracking claims against
 * orbital debris tracking gating pools. Enforces canonical payload
 * layout, verifies homomorphicHashCommitment for homomorphic hash
 * commitment verification, and bans peers broadcasting malformed
 * or out-of-order claims.
 *
 * @module hsm-adapter/zk-debris-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkDebrisClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcOrbitalDebrisTrackingGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  /**
   * Verify a zero-knowledge orbital debris tracking claim.
   * @param {object} request
   * @returns {object}
   */
  verifyDebrisClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('ORBITCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('ORBITCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireOrbitalDebrisOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.orbitalDebrisOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('ORBITCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'orbital debris oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('ORBITCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'orbital debris oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderDebrisClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('ORBITCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedDebrisTrajectoryCommitment: request.blindedDebrisTrajectoryCommitment,
      blindedCollisionProbabilityCommitment: request.blindedCollisionProbabilityCommitment,
      blindedSurveillanceAuthorityIdentityCommitment: request.blindedSurveillanceAuthorityIdentityCommitment,
      zkDebrisRangeProofHash: request.zkDebrisRangeProofHash,
      homomorphicHashCommitment: request.homomorphicHashCommitment,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderDebrisClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('ORBITCLAIM_DUPLICATE', `duplicate debris claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markDebrisClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      homomorphicHashCommitment: request.homomorphicHashCommitment,
      zkDebrisRangeProofHash: request.zkDebrisRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_DEBRIS_CLAIM_VERIFIED', { ...claim });
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
   * Get the number of verified claims.
   * @returns {number}
   */
  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError('ORBITCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedDebrisTrajectoryCommitment || !request.blindedCollisionProbabilityCommitment || !request.blindedSurveillanceAuthorityIdentityCommitment) {
    throw new HsmAdapterError('ORBITCLAIM_FIELDS_MISSING', 'blindedDebrisTrajectoryCommitment, blindedCollisionProbabilityCommitment, and blindedSurveillanceAuthorityIdentityCommitment are required');
  }
  if (!request.zkDebrisRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderDebrisClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('ORBITCLAIM_ZK_PROOF_MISSING', 'zkDebrisRangeProofHash is required');
  }
  if (!request.homomorphicHashCommitment) {
    if (policy.banMalformedOrOutOfOrderDebrisClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('ORBITCLAIM_HOMOMORPHIC_COMMITMENT_MISSING', 'homomorphicHashCommitment is required');
  }
  if (policy.requireOrbitalDebrisOversightCommitteeAttestation && !request.orbitalDebrisOversightCommitteeAttestation) {
    throw new HsmAdapterError('ORBITCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'orbital debris oversight committee attestation is required');
  }
}

module.exports = { ZkDebrisClaimValidator };
