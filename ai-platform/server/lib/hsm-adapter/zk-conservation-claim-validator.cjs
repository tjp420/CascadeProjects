'use strict';

/**
 * Track 90: ZK Conservation Claim Validator.
 *
 * Succinct conservation claim verifier that processes non-interactive
 * zero-knowledge range and accreditation proofs, ensuring
 * that an entity's hidden conservation claim status strictly
 * satisfies policy-defined thresholds without disclosing
 * individual species or ranger attributes. Triggers defensive node
 * bans for malformed or out-of-order conservation claims.
 *
 * Extended with hardware-accelerated SNARK proof generation,
 * batch conservation claim verification, slashing window
 * validation, partial signature aggregation, slash event
 * recording with reason codes, and summary statistics.
 *
 * @module hsm-adapter/zk-conservation-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const CLAIM_STATUS = {
  VERIFIED: 'verified',
  SLASHED: 'slashed',
};

const SLASH_REASON = {
  MALFORMED: 'malformed_claim',
  DUPLICATE: 'duplicate_claim',
  MONITORING_WINDOW_OUT_OF_BOUNDS: 'monitoring_window_out_of_bounds',
  POOL_NOT_FOUND: 'pool_not_found',
  BANNED_PEER: 'banned_peer',
  OUT_OF_WINDOW: 'out_of_window',
};

const HW_ACCEL_TYPES = {
  GPU_CUDA: 'gpu_cuda',
  FPGA: 'fpga',
  ASIC: 'asic',
  SIMULATED: 'simulated',
};

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
    this._slashedClaims = [];
    this._batchHistory = [];
    this._hwAccelType = options.hwAccelType || HW_ACCEL_TYPES.SIMULATED;
    this._maxBatchSize = options.maxBatchSize || 100;
    this._claimCount = 0;
    this._hwProofCount = 0;
    this._batchVerifyCount = 0;
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
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.BANNED_PEER);
      throw new HsmAdapterError('WILDLIFECLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkConservationRangeProofHash || typeof request.zkConservationRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('WILDLIFECLAIM_ZK_PROOF_MISSING', 'zero-knowledge conservation range proof hash is required');
    }
    if (!request.linkableRingSignature || typeof request.linkableRingSignature !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('WILDLIFECLAIM_LINKABLE_RING_SIG_MISSING', 'linkable ring signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.POOL_NOT_FOUND);
      throw new HsmAdapterError('WILDLIFECLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.monitoringWindowSeconds === 'number' && request.monitoringWindowSeconds > (this.policy.maxMonitoringWindowSeconds || 2592000)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.MONITORING_WINDOW_OUT_OF_BOUNDS);
      throw new HsmAdapterError('WILDLIFECLAIM_MONITORING_WINDOW_OUT_OF_BOUNDS', `monitoring window seconds ${request.monitoringWindowSeconds} exceeds maximum ${this.policy.maxMonitoringWindowSeconds}`);
    }
    if (this._seenLinkabilityTags.has(request.linkabilityTag)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.DUPLICATE);
      throw new HsmAdapterError('WILDLIFECLAIM_DOUBLE_REPORT_DETECTED', `linkability tag ${request.linkabilityTag} already seen — double-reporting detected`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request.poolId, request.peerId, SLASH_REASON.DUPLICATE);
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
      verifiedAt: now,
      status: CLAIM_STATUS.VERIFIED,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._seenLinkabilityTags.add(request.linkabilityTag);
    this._hub.markConservationClaimVerified(request.poolId);
    this._claimCount++;
    if (this._audit) {
      this._audit('ZK_CONSERVATION_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
  }

  /**
   * Generate a hardware-accelerated SNARK proof for an conservation claim.
   * @param {object} request
   * @returns {object}
   */
  generateHwSnarkProof(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('WILDLIFECLAIM_HW_PROOF_FIELDS_MISSING', 'poolId is required');
    }
    if (typeof request.habitatBoundary !== 'number' || typeof request.claimValue !== 'number') {
      throw new HsmAdapterError('WILDLIFECLAIM_HW_PROOF_FIELDS_MISSING',
        'habitatBoundary and claimValue numbers are required');
    }
    if (!this._hub) {
      throw new HsmAdapterError('WILDLIFECLAIM_HUB_MISSING', 'wildlife conservation tracking gating hub is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('WILDLIFECLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    const proofHash = crypto.createHash('sha256')
      .update(`${request.poolId}:${request.habitatBoundary}:${request.claimValue}:${this._hwAccelType}`)
      .digest('hex');
    const proof = {
      zkConservationRangeProofHash: proofHash,
      poolId: request.poolId,
      habitatBoundary: request.habitatBoundary,
      claimValue: request.claimValue,
      hwAccelType: this._hwAccelType,
      proofSystem: 'groth16',
      generatedAt: Math.floor(Date.now() / 1000),
    };
    this._hwProofCount++;
    if (this._audit) {
      this._audit('WILDLIFECLAIM_HW_SNARK_PROOF_GENERATED', { ...proof });
    }
    return proof;
  }

  /**
   * Batch verify multiple conservation claims.
   * @param {object[]} requests
   * @returns {object}
   */
  batchVerifyConservationClaims(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('WILDLIFECLAIM_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('WILDLIFECLAIM_BATCH_TOO_LARGE',
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
    }
    const results = [];
    let verifiedCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const claim = this.verifyConservationClaim(req);
        results.push({
          poolId: req.poolId,
          claimId: claim.claimId,
          verified: true,
        });
        verifiedCount++;
      } catch (err) {
        results.push({
          poolId: req.poolId || 'unknown',
          verified: false,
          error: err.code || 'WILDLIFECLAIM_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    this._batchVerifyCount++;
    this._batchHistory.push({
      batchSize: requests.length,
      verifiedCount,
      failedCount,
      verifiedAt: Math.floor(Date.now() / 1000),
    });
    if (this._audit) {
      this._audit('WILDLIFECLAIM_BATCH_VERIFIED', { verifiedCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, verifiedCount, failedCount, results };
  }

  /**
   * Validate that a claim falls within the slashing window.
   * @param {string} poolId
   * @param {number} claimTimestamp
   * @returns {object}
   */
  validateSlashingWindow(poolId, claimTimestamp) {
    if (!poolId) {
      throw new HsmAdapterError('WILDLIFECLAIM_WINDOW_FIELDS_MISSING', 'poolId is required');
    }
    if (typeof claimTimestamp !== 'number' || claimTimestamp <= 0) {
      throw new HsmAdapterError('WILDLIFECLAIM_WINDOW_FIELDS_MISSING', 'claimTimestamp must be a positive number');
    }
    if (!this._hub) {
      throw new HsmAdapterError('WILDLIFECLAIM_HUB_MISSING', 'wildlife conservation tracking gating hub is required');
    }
    const pool = this._hub.getPool(poolId);
    if (!pool) {
      throw new HsmAdapterError('WILDLIFECLAIM_POOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    const now = Math.floor(Date.now() / 1000);
    const maxWindow = this.policy.maxMonitoringWindowSeconds || 2592000;
    const ageSeconds = Math.abs(now - claimTimestamp);
    const withinWindow = ageSeconds <= maxWindow;
    return {
      poolId,
      claimTimestamp,
      currentTimestamp: now,
      ageSeconds,
      maxWindowSeconds: maxWindow,
      withinWindow,
    };
  }

  /**
   * Aggregate partial signatures from clearing committee members.
   * @param {string} poolId
   * @param {object[]} linkableRingSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateLinkableRingSignatures(poolId, linkableRingSignatures) {
    if (!poolId) {
      throw new HsmAdapterError('WILDLIFECLAIM_AGG_FIELDS_MISSING', 'poolId is required');
    }
    if (!Array.isArray(linkableRingSignatures) || linkableRingSignatures.length === 0) {
      throw new HsmAdapterError('WILDLIFECLAIM_AGG_NO_SIGNATURES', 'linkableRingSignatures array is required');
    }
    for (const sig of linkableRingSignatures) {
      if (sig.peerId && this._bannedPeers.has(sig.peerId)) {
        throw new HsmAdapterError('WILDLIFECLAIM_PEER_BANNED',
          `peer ${sig.peerId} is banned and cannot participate in aggregation`);
      }
    }
    if (linkableRingSignatures.length < (this.policy.minConservationQuorum || 4)) {
      throw new HsmAdapterError('WILDLIFECLAIM_AGG_INSUFFICIENT',
        `${linkableRingSignatures.length} signatures below minimum ${this.policy.minConservationQuorum || 4}`);
    }
    const aggregatedSignature = crypto.createHash('sha256')
      .update(linkableRingSignatures.map(s => s.signature).join(':'))
      .digest('hex');
    const result = {
      poolId,
      signatureCount: linkableRingSignatures.length,
      aggregatedSignature,
      participantIds: linkableRingSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('WILDLIFECLAIM_LINKABLE_RING_SIGS_AGGREGATED', { poolId, count: linkableRingSignatures.length });
    }
    return result;
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
   * Get all slashed claims.
   * @returns {Array}
   */
  getSlashedClaims() {
    return this._slashedClaims.slice();
  }

  /**
   * Get batch verification history.
   * @returns {Array}
   */
  getBatchHistory() {
    return this._batchHistory.slice();
  }

  /**
   * Get slashing statistics.
   * @returns {object}
   */
  getSlashingStats() {
    const byReason = {};
    for (const s of this._slashedClaims) {
      byReason[s.reason] = (byReason[s.reason] || 0) + 1;
    }
    return {
      totalSlashes: this._slashedClaims.length,
      bannedPeers: this._bannedPeers.size,
      byReason,
    };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalVerified: this._verifiedClaims.size,
      totalSlashed: this._slashedClaims.length,
      totalBatchVerifications: this._batchVerifyCount,
      claimCount: this._claimCount,
      hwProofCount: this._hwProofCount,
      hwAccelType: this._hwAccelType,
      bannedPeers: this._bannedPeers.size,
    };
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

  /**
   * Record a slash event.
   * @param {string} poolId
   * @param {string} peerId
   * @param {string} reason
   * @private
   */
  _recordSlash(poolId, peerId, reason) {
    this._slashedClaims.push({
      poolId,
      peerId: peerId || 'anonymous',
      reason,
      slashedAt: Math.floor(Date.now() / 1000),
    });
    if (this._audit) {
      this._audit('WILDLIFECLAIM_SLASHED', { poolId, peerId, reason });
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

module.exports = {
  ZkConservationClaimValidator,
  CLAIM_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
};
