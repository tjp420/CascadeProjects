'use strict';

/**
 * Track 67: PQC Insurance Underwriting Hub.
 *
 * Interlocking coverage coordinator that instantiates
 * multi-party risk pools using homomorphically additive
 * Pedersen commitments over premium values, underwriting
 * reserves, and max claim limits. Parses INSPAULT packets,
 * enforces maxPoolRiskExposureCap, and tracks state
 * transitions alongside the minClaimQuorum boundary.
 *
 * Extended with risk rebalancing, batch pool initialization,
 * committee signature aggregation, pool cancellation,
 * cross-chain settlement, and summary statistics.
 *
 * @module hsm-adapter/pqc-insurance-underwriting-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const POOL_STATUS = {
  OPEN: 'open',
  REBALANCING: 'rebalancing',
  LIQUIDATED: 'liquidated',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
};

const REBALANCE_DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
};

class PqcInsuranceUnderwritingHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
    this._settlements = new Map();
    this._rebalances = new Map();
    this._maxPools = options.maxPools || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._liquidateCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize an insurance underwriting pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError('INSPAULT_MAX_POOLS',
        `maximum ${this._maxPools} pools reached`);
    }
    if (this.policy.requireCoverageInitiatorAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.coverageInitiatorAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('INSPAULT_COVERAGE_INITIATOR_UNATTESTED', 'coverage initiator attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('INSPAULT_COVERAGE_INITIATOR_UNATTESTED', 'coverage initiator attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('INSPAULT_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('INSPAULT_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.reserveRatio === 'number' && request.reserveRatio < (this.policy.minReserveRatio || 30)) {
      throw new HsmAdapterError('INSPAULT_RESERVE_RATIO_INSUFFICIENT', `reserve ratio ${request.reserveRatio}% below minimum ${this.policy.minReserveRatio}%`);
    }
    if (typeof request.poolRiskExposureCap === 'number' && request.poolRiskExposureCap > (this.policy.maxPoolRiskExposureCap || 1000000000)) {
      throw new HsmAdapterError('INSPAULT_RISK_EXPOSURE_CAP_EXCEEDED', `pool risk exposure cap ${request.poolRiskExposureCap} exceeds maximum ${this.policy.maxPoolRiskExposureCap}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('INSPAULT_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedPremiumCommitment: request.blindedPremiumCommitment,
      blindedReserveCommitment: request.blindedReserveCommitment,
      blindedMaxClaimCommitment: request.blindedMaxClaimCommitment,
      reserveRatio: request.reserveRatio,
      poolRiskExposureCap: request.poolRiskExposureCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      claimEligibilityVerified: false,
      liquidatedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit('INSURANCE_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple insurance underwriting pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('INSPAULT_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('INSPAULT_BATCH_TOO_LARGE',
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const pool = this.initializePool(req);
        results.push({ poolId: pool.poolId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({
          poolId: req.poolId || 'auto',
          initialized: false,
          error: err.code || 'INSPAULT_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('INSPAULT_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, successCount, failedCount, results };
  }

  /**
   * Get a pool by id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  /**
   * Mark a pool as claim-eligibility-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markClaimEligibilityVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.claimEligibilityVerified = true;
    return pool;
  }

  /**
   * Rebalance risk exposure for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceRiskExposure(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('INSPAULT_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN && pool.status !== POOL_STATUS.REBALANCING) {
      throw new HsmAdapterError('INSPAULT_NOT_REBALANCEABLE',
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('INSPAULT_REBALANCE_DIRECTION_INVALID',
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(', ')}`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('INSPAULT_REBALANCE_AMOUNT_INVALID',
        'rebalanceAmount must be a positive number');
    }
    const newEpoch = pool.rebalanceEpoch + 1;
    pool.rebalanceEpoch = newEpoch;
    pool.status = POOL_STATUS.REBALANCING;
    const rebalanceId = request.rebalanceId || `rebal-${crypto.randomBytes(4).toString('hex')}`;
    const rebalance = {
      rebalanceId,
      poolId: request.poolId,
      direction,
      rebalanceAmount: request.rebalanceAmount,
      rebalanceEpoch: newEpoch,
      newReserveRatio: request.newReserveRatio || pool.reserveRatio,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newReserveRatio !== undefined) {
      pool.reserveRatio = request.newReserveRatio;
    }
    if (this._audit) {
      this._audit('INSPAULT_RISK_REBALANCED', { ...rebalance });
    }
    return rebalance;
  }

  /**
   * Get a rebalance record by id.
   * @param {string} rebalanceId
   * @returns {object|null}
   */
  getRebalance(rebalanceId) {
    return this._rebalances.get(rebalanceId) || null;
  }

  /**
   * Liquidate an underwriting pool after quorum.
   * @param {object} request
   * @returns {object}
   */
  liquidatePool(request) {
    _validateLiquidateRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.claimEligibilityVerified) {
      throw new HsmAdapterError('INSPAULT_CLAIM_ELIGIBILITY_NOT_VERIFIED', `pool ${request.poolId} claim eligibility not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('INSPAULT_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('INSPAULT_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minClaimQuorum || 3)) {
      throw new HsmAdapterError('INSPAULT_LIQUIDATION_QUORUM_INSUFFICIENT', `claim signatures ${signatures.length} below minimum ${this.policy.minClaimQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.LIQUIDATED;
    pool.liquidatedAt = now;
    const liquidationId = request.liquidationId || `liq-${crypto.randomBytes(4).toString('hex')}`;
    const liquidation = {
      liquidationId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      liquidatedAt: now,
    };
    this._liquidateCount++;
    if (this._audit) {
      this._audit('UNDERWRITING_POOL_LIQUIDATED', { ...liquidation });
    }
    return liquidation;
  }

  /**
   * Settle a liquidated pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('INSPAULT_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.LIQUIDATED) {
      throw new HsmAdapterError('INSPAULT_NOT_LIQUIDATED',
        `pool ${request.poolId} status is ${pool.status}, expected liquidated`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('INSPAULT_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('INSPAULT_SETTLE_CHAIN_MISMATCH',
        `settlement chain ${request.targetChainId} does not match pool target ${pool.targetChainId}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId = request.settlementId || `settle-${crypto.randomBytes(4).toString('hex')}`;
    const settlement = {
      settlementId,
      poolId: request.poolId,
      targetChainId: request.targetChainId,
      settlementProofHash: request.settlementProofHash || crypto.createHash('sha256')
        .update(`${request.poolId}:${request.targetChainId}:${now}`)
        .digest('hex'),
      settledAt: now,
    };
    pool.status = POOL_STATUS.SETTLED;
    pool.settlementStatus = 'settled';
    pool.settledAt = now;
    this._settlements.set(request.poolId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit('INSPAULT_SETTLED', { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for pool liquidation.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('INSPAULT_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minClaimQuorum || 3)) {
      throw new HsmAdapterError('INSPAULT_LIQUIDATION_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} signatures below minimum ${this.policy.minClaimQuorum || 3}`);
    }
    const aggregatedSig = crypto.createHash('sha256')
      .update(partialSignatures.map(s => s.signature).join(':'))
      .digest('hex');
    const result = {
      poolId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('INSPAULT_SIGNATURES_AGGREGATED', { poolId, count: partialSignatures.length });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet liquidated).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('INSPAULT_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (pool.status === POOL_STATUS.LIQUIDATED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('INSPAULT_ALREADY_LIQUIDATED',
        `pool ${poolId} has been liquidated/settled and cannot be cancelled`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('INSPAULT_ALREADY_CANCELLED',
        `pool ${poolId} is already cancelled`);
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('INSPAULT_CANCELLED', { poolId });
    }
    return { poolId, cancelled: true };
  }

  /**
   * Get a settlement record by pool id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getSettlement(poolId) {
    return this._settlements.get(poolId) || null;
  }

  /**
   * Get all pools (metadata only).
   * @returns {object[]}
   */
  getPools() {
    return Array.from(this._pools.values()).map(p => ({
      poolId: p.poolId,
      sourceTenantId: p.sourceTenantId,
      targetChainId: p.targetChainId,
      status: p.status,
      reserveRatio: p.reserveRatio,
      poolRiskExposureCap: p.poolRiskExposureCap,
      claimEligibilityVerified: p.claimEligibilityVerified,
    }));
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const poolsByStatus = {};
    for (const p of this._pools.values()) {
      poolsByStatus[p.status] = (poolsByStatus[p.status] || 0) + 1;
    }
    return {
      totalPools: this._pools.size,
      totalSettlements: this._settlements.size,
      totalRebalances: this._rebalances.size,
      poolsByStatus,
      initCount: this._initCount,
      liquidateCount: this._liquidateCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('INSPAULT_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedPremiumCommitment || !request.blindedReserveCommitment || !request.blindedMaxClaimCommitment) {
    throw new HsmAdapterError('INSPAULT_FIELDS_MISSING', 'blindedPremiumCommitment, blindedReserveCommitment, and blindedMaxClaimCommitment are required');
  }
  if (typeof request.reserveRatio !== 'number') {
    throw new HsmAdapterError('INSPAULT_FIELDS_MISSING', 'reserveRatio is required');
  }
  if (policy.requireCoverageInitiatorAttestation && !request.coverageInitiatorAttestation) {
    throw new HsmAdapterError('INSPAULT_COVERAGE_INITIATOR_ATTESTATION_MISSING', 'coverage initiator attestation is required');
  }
}

function _validateLiquidateRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('INSPAULT_LIQUIDATE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('INSPAULT_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = {
  PqcInsuranceUnderwritingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
