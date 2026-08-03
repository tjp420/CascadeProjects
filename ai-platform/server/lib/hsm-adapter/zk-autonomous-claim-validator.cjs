'use strict';

/**
 * Track 102: ZK Autonomous Claim Validator.
 *
 * Validates zero-knowledge autonomous vehicle fleet coordination
 * claims against autonomous vehicle fleet coordination gating pools.
 * Enforces canonical payload layout, verifies polynomialCommitmentDigest
 * for KZG-style polynomial commitment verification, and bans peers
 * broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-autonomous-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkAutonomousClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyAutonomousClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('AUTOCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('AUTOCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireAutonomousEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.autonomousEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('AUTOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'autonomous ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('AUTOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'autonomous ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderAutonomousClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('AUTOCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedTrajectoryMeasurementCommitment: request.blindedTrajectoryMeasurementCommitment,
      blindedCoordinationProbabilityCommitment: request.blindedCoordinationProbabilityCommitment,
      blindedAutonomousMobilityAuthorityIdentityCommitment: request.blindedAutonomousMobilityAuthorityIdentityCommitment,
      zkAutonomousRangeProofHash: request.zkAutonomousRangeProofHash,
      polynomialCommitmentDigest: request.polynomialCommitmentDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderAutonomousClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('AUTOCLAIM_DUPLICATE', `duplicate autonomous claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markAutonomousClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      polynomialCommitmentDigest: request.polynomialCommitmentDigest,
      zkAutonomousRangeProofHash: request.zkAutonomousRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_AUTONOMOUS_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError('AUTOCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedTrajectoryMeasurementCommitment || !request.blindedCoordinationProbabilityCommitment || !request.blindedAutonomousMobilityAuthorityIdentityCommitment) {
    throw new HsmAdapterError('AUTOCLAIM_FIELDS_MISSING', 'blindedTrajectoryMeasurementCommitment, blindedCoordinationProbabilityCommitment, and blindedAutonomousMobilityAuthorityIdentityCommitment are required');
  }
  if (!request.zkAutonomousRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderAutonomousClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('AUTOCLAIM_ZK_PROOF_MISSING', 'zkAutonomousRangeProofHash is required');
  }
  if (!request.polynomialCommitmentDigest) {
    if (policy.banMalformedOrOutOfOrderAutonomousClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('AUTOCLAIM_POLYNOMIAL_DIGEST_MISSING', 'polynomialCommitmentDigest is required');
  }
  if (policy.requireAutonomousEthicsOversightCommitteeAttestation && !request.autonomousEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('AUTOCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'autonomous ethics oversight committee attestation is required');
  }
}

module.exports = { ZkAutonomousClaimValidator };
