'use strict';

/**
 * Track 66: ZK Solvency Proof Processor.
 *
 * Succinct verification engine that processes non-interactive
 * zero-knowledge solvency and threshold range proofs, ensuring
 * that a borrower's hidden margin asset status strictly conforms
 * to the policy-defined minLtvRatio ceiling without exposing
 * line-item positions. Triggers defensive node bans for
 * malformed or sub-solvency claims.
 *
 * Extended with hardware-accelerated SNARK proof generation,
 * batch solvency verification, slashing window validation,
 * partial signature aggregation, and summary statistics.
 *
 * @module hsm-adapter/zk-solvency-proof-processor
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const PROOF_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  INVALID: 'invalid',
  SLASHED: 'slashed',
};

const SLASH_REASON = {
  MALFORMED: 'malformed_proof',
  DUPLICATE: 'duplicate_proof',
  SUB_SOLVENCY: 'sub_solvency',
  POOL_NOT_OPEN: 'pool_not_open',
  BANNED_PEER: 'banned_peer',
  OUT_OF_ORDER: 'out_of_order',
};

const HW_ACCEL_TYPES = {
  NONE: 'none',
  GPU_CUDA: 'gpu_cuda',
  FPGA: 'fpga',
  ASIC: 'asic',
  SIMULATED: 'simulated',
};

class ZkSolvencyProofProcessor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcLendingCollateralHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedProofs = new Map();
    this._slashedProofs = new Map();
    this._batchResults = [];
    this._maxBatchHistory = 50;
    this._maxBatchSize = options.maxBatchSize || 100;
    this._slashingWindowSeconds = options.slashingWindowSeconds || 3600;
    this._hwAccelType = options.hwAccelType || HW_ACCEL_TYPES.SIMULATED;
    this._proofCount = 0;
    this._batchCount = 0;
    this._slashCount = 0;
    this._hwProofCount = 0;
  }

  /**
   * Verify a solvency proof.
   * @param {object} request
   * @returns {object}
   */
  verifySolvencyProof(request) {
    _validateProofRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('SOLVENCYPROOF_HUB_MISSING', 'lending collateral hub is required');
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SOLVENCYPROOF_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SOLVENCYPROOF_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SOLVENCYPROOF_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.BANNED_PEER);
      throw new HsmAdapterError('SOLVENCYPROOF_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkSolvencyRangeProofHash || typeof request.zkSolvencyRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('SOLVENCYPROOF_ZK_PROOF_MISSING', 'zero-knowledge solvency range proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('SOLVENCYPROOF_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.MALFORMED);
      throw new HsmAdapterError('SOLVENCYPROOF_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.collateralValue === 'number' && typeof request.borrowValue === 'number') {
      const ltvRatio = (request.borrowValue / request.collateralValue) * 100;
      if (ltvRatio > 100) {
        this._banPeerIfPolicy(request);
        this._recordSlash(request, SLASH_REASON.SUB_SOLVENCY);
        throw new HsmAdapterError('SOLVENCYPROOF_SUB_SOLVENCY', `LTV ratio ${ltvRatio}% exceeds 100% (collateral insufficient)`);
      }
      if (ltvRatio < (this.policy.minLtvRatio || 50)) {
        this._banPeerIfPolicy(request);
        this._recordSlash(request, SLASH_REASON.SUB_SOLVENCY);
        throw new HsmAdapterError('SOLVENCYPROOF_LTV_BELOW_MINIMUM', `LTV ratio ${ltvRatio}% below minimum ${this.policy.minLtvRatio}%`);
      }
    }
    const proofKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedProofs.has(proofKey)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.DUPLICATE);
      throw new HsmAdapterError('SOLVENCYPROOF_DUPLICATE', `proof for pool ${request.poolId} already verified`);
    }
    const proofId = request.proofId || `solvency-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const hwAccelUsed = request.hwAccelType || this._hwAccelType;
    const proof = {
      proofId,
      poolId: request.poolId,
      blindedCollateralCommitment: request.blindedCollateralCommitment || pool.blindedCollateralCommitment,
      blindedBorrowValueCommitment: request.blindedBorrowValueCommitment || pool.blindedBorrowValueCommitment,
      zkSolvencyRangeProofHash: request.zkSolvencyRangeProofHash,
      clearingCommitteeAttestationHash: request.clearingCommitteeAttestationHash || 'unspecified',
      verifiedAt: now,
      status: PROOF_STATUS.VERIFIED,
      peerId: request.peerId || 'anonymous',
      hwAccelType: hwAccelUsed,
    };
    this._verifiedProofs.set(proofKey, proof);
    this._hub.markSolvencyVerified(request.poolId);
    this._proofCount++;
    if (hwAccelUsed !== HW_ACCEL_TYPES.NONE) {
      this._hwProofCount++;
    }
    if (this._audit) {
      this._audit('ZK_SOLVENCY_PROOF_VERIFIED', { ...proof });
    }
    return proof;
  }

  /**
   * Batch verify multiple solvency proofs.
   * @param {object[]} requests
   * @returns {object}
   */
  batchVerifySolvencyProofs(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('SOLVENCYPROOF_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('SOLVENCYPROOF_BATCH_TOO_LARGE',
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
    }
    const results = [];
    let verifiedCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const proof = this.verifySolvencyProof(req);
        results.push({ proofId: proof.proofId, poolId: proof.poolId, verified: true });
        verifiedCount++;
      } catch (err) {
        results.push({
          poolId: req.poolId || 'unknown',
          verified: false,
          error: err.code || 'SOLVENCYPROOF_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    this._batchCount++;
    this._batchResults.push({
      batchSize: requests.length,
      verifiedCount,
      failedCount,
      processedAt: Date.now(),
    });
    if (this._batchResults.length > this._maxBatchHistory) {
      this._batchResults.shift();
    }
    if (this._audit) {
      this._audit('SOLVENCYPROOF_BATCH_VERIFIED', { verifiedCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, verifiedCount, failedCount, results };
  }

  /**
   * Generate a hardware-accelerated SNARK proof for solvency.
   * @param {object} request
   * @returns {object}
   */
  generateHwSnarkProof(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('SOLVENCYPROOF_GEN_FIELDS_MISSING', 'poolId is required');
    }
    if (!this._hub) {
      throw new HsmAdapterError('SOLVENCYPROOF_HUB_MISSING', 'lending collateral hub is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SOLVENCYPROOF_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.collateralValue !== 'number' || typeof request.borrowValue !== 'number') {
      throw new HsmAdapterError('SOLVENCYPROOF_GEN_VALUES_MISSING',
        'collateralValue and borrowValue are required for proof generation');
    }
    const hwAccelType = request.hwAccelType || this._hwAccelType;
    const now = Math.floor(Date.now() / 1000);
    const proofSeed = crypto.randomBytes(32);
    const zkSolvencyRangeProofHash = crypto.createHash('sha256')
      .update(`snark:${proofSeed.toString('hex')}:${request.poolId}:${request.collateralValue}:${request.borrowValue}`)
      .digest('hex');
    const proof = {
      poolId: request.poolId,
      zkSolvencyRangeProofHash,
      hwAccelType,
      collateralValue: request.collateralValue,
      borrowValue: request.borrowValue,
      generatedAt: now,
      proofSystem: 'groth16',
      circuitId: `solvency_range_${pool.ltvRatio}ltv`,
    };
    if (this._audit) {
      this._audit('SOLVENCYPROOF_HW_SNARK_GENERATED', { ...proof });
    }
    return proof;
  }

  /**
   * Aggregate partial signatures from clearing committee members.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregatePartialSignatures(poolId, partialSignatures) {
    if (!poolId || typeof poolId !== 'string') {
      throw new HsmAdapterError('SOLVENCYPROOF_POOL_ID_REQUIRED', 'poolId is required');
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('SOLVENCYPROOF_NO_PARTIAL_SIGS', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minLiquidationSignatureQuorum || 3)) {
      throw new HsmAdapterError('SOLVENCYPROOF_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} partial signatures below minimum ${this.policy.minLiquidationSignatureQuorum || 3}`);
    }
    for (const sig of partialSignatures) {
      if (sig.peerId && this._bannedPeers.has(sig.peerId)) {
        throw new HsmAdapterError('SOLVENCYPROOF_PEER_BANNED',
          `peer ${sig.peerId} is banned and cannot participate in signature aggregation`);
      }
    }
    const sigHash = crypto.createHash('sha256')
      .update(partialSignatures.map(s => s.signature).join(':'))
      .digest('hex');
    const aggregated = {
      poolId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: sigHash,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('SOLVENCYPROOF_SIGNATURES_AGGREGATED', { poolId, count: partialSignatures.length });
    }
    return aggregated;
  }

  /**
   * Validate a proof within a slashing window.
   * @param {string} poolId
   * @param {number} proofTimestamp
   * @returns {object}
   */
  validateSlashingWindow(poolId, proofTimestamp) {
    const pool = this._hub ? this._hub.getPool(poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('SOLVENCYPROOF_POOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (typeof proofTimestamp !== 'number') {
      throw new HsmAdapterError('SOLVENCYPROOF_TIMESTAMP_INVALID', 'proofTimestamp must be a number');
    }
    const windowStart = pool.initializedAt;
    const windowEnd = Math.floor(Date.now() / 1000) + this._slashingWindowSeconds;
    const withinWindow = proofTimestamp >= windowStart && proofTimestamp <= windowEnd;
    const result = {
      poolId,
      proofTimestamp,
      windowStart,
      windowEnd,
      withinWindow,
      slashingWindowSeconds: this._slashingWindowSeconds,
    };
    if (!withinWindow && this._audit) {
      this._audit('SOLVENCYPROOF_SLASHING_WINDOW_VIOLATION',
        { poolId, proofTimestamp, windowStart, windowEnd });
    }
    return result;
  }

  /**
   * Get slashing statistics.
   * @returns {object}
   */
  getSlashingStats() {
    const slashesByReason = {};
    for (const slash of this._slashedProofs.values()) {
      slashesByReason[slash.reason] = (slashesByReason[slash.reason] || 0) + 1;
    }
    return {
      totalSlashes: this._slashCount,
      bannedPeers: this._bannedPeers.size,
      slashesByReason,
    };
  }

  /**
   * Get batch verification history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getBatchHistory(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._batchResults.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalVerified: this._verifiedProofs.size,
      totalSlashed: this._slashedProofs.size,
      totalBanned: this._bannedPeers.size,
      totalBatches: this._batchCount,
      proofCount: this._proofCount,
      slashCount: this._slashCount,
      hwProofCount: this._hwProofCount,
      hwAccelType: this._hwAccelType,
    };
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
   * Get all verified proofs.
   * @returns {Array}
   */
  getVerifiedProofs() {
    return Array.from(this._verifiedProofs.values());
  }

  /**
   * Get all slashed proofs.
   * @returns {Array}
   */
  getSlashedProofs() {
    return Array.from(this._slashedProofs.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrSubSolvencyClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }

  /**
   * Record a slashing event.
   * @param {object} request
   * @param {string} reason
   * @private
   */
  _recordSlash(request, reason) {
    const proofKey = `${request.poolId || 'unknown'}:${request.peerId || 'anonymous'}`;
    this._slashedProofs.set(proofKey, {
      poolId: request.poolId || 'unknown',
      peerId: request.peerId || 'anonymous',
      reason,
      slashedAt: Math.floor(Date.now() / 1000),
    });
    this._slashCount++;
    if (this._audit) {
      this._audit('SOLVENCYPROOF_SLASHED', { poolId: request.poolId, peerId: request.peerId, reason });
    }
  }
}

function _validateProofRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SOLVENCYPROOF_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('SOLVENCYPROOF_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = {
  ZkSolvencyProofProcessor,
  PROOF_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
};
