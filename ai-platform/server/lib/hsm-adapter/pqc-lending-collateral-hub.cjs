'use strict';

/**
 * Track 66: PQC Lending Collateral Hub.
 *
 * Interlocking collateral coordinator that instantiates
 * multi-party borrowing pools using homomorphically additive
 * Pedersen commitments over borrow values, locked collateral
 * parameters, and safety margins. Parses LENDPOOL packets,
 * enforces maxBorrowValueCap, and tracks state transitions
 * alongside the minLiquidationSignatureQuorum boundary.
 *
 * Extended with collateral rebalancing, batch pool
 * initialization, committee signature aggregation, pool
 * cancellation, cross-chain settlement, and summary statistics.
 *
 * @module hsm-adapter/pqc-lending-collateral-hub
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

class PqcLendingCollateralHub {
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
   * Initialize a lending pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError('LENDPOOL_MAX_POOLS',
        `maximum ${this._maxPools} pools reached`);
    }
    if (this.policy.requireBorrowerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.borrowerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LENDPOOL_BORROWER_UNATTESTED', 'borrower attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LENDPOOL_BORROWER_UNATTESTED', 'borrower attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('LENDPOOL_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('LENDPOOL_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.ltvRatio === 'number' && request.ltvRatio < (this.policy.minLtvRatio || 50)) {
      throw new HsmAdapterError('LENDPOOL_LTV_INSUFFICIENT', `LTV ratio ${request.ltvRatio}% below minimum ${this.policy.minLtvRatio}%`);
    }
    if (typeof request.borrowValueCap === 'number' && request.borrowValueCap > (this.policy.maxBorrowValueCap || 1000000000)) {
      throw new HsmAdapterError('LENDPOOL_BORROW_CAP_EXCEEDED', `borrow value cap ${request.borrowValueCap} exceeds maximum ${this.policy.maxBorrowValueCap}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('LENDPOOL_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedBorrowValueCommitment: request.blindedBorrowValueCommitment,
      blindedCollateralCommitment: request.blindedCollateralCommitment,
      blindedSafetyMarginCommitment: request.blindedSafetyMarginCommitment,
      ltvRatio: request.ltvRatio,
      borrowValueCap: request.borrowValueCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      solvencyVerified: false,
      liquidatedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit('LENDING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple lending pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('LENDPOOL_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('LENDPOOL_BATCH_TOO_LARGE',
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
          error: err.code || 'LENDPOOL_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('LENDPOOL_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
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
   * Mark a pool as solvency-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markSolvencyVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.solvencyVerified = true;
    return pool;
  }

  /**
   * Rebalance collateral for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceCollateral(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('LENDPOOL_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN && pool.status !== POOL_STATUS.REBALANCING) {
      throw new HsmAdapterError('LENDPOOL_NOT_REBALANCEABLE',
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('LENDPOOL_REBALANCE_DIRECTION_INVALID',
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(', ')}`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('LENDPOOL_REBALANCE_AMOUNT_INVALID',
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
      newLtvRatio: request.newLtvRatio || pool.ltvRatio,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newLtvRatio !== undefined) {
      pool.ltvRatio = request.newLtvRatio;
    }
    if (this._audit) {
      this._audit('LENDPOOL_COLLATERAL_REBALANCED', { ...rebalance });
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
   * Liquidate a collateral pool after quorum.
   * @param {object} request
   * @returns {object}
   */
  liquidatePool(request) {
    _validateLiquidateRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.solvencyVerified) {
      throw new HsmAdapterError('LENDPOOL_SOLVENCY_NOT_VERIFIED', `pool ${request.poolId} solvency not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LENDPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LENDPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minLiquidationSignatureQuorum || 3)) {
      throw new HsmAdapterError('LENDPOOL_LIQUIDATION_QUORUM_INSUFFICIENT', `liquidation signatures ${signatures.length} below minimum ${this.policy.minLiquidationSignatureQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.LIQUIDATED;
    pool.liquidatedAt = now;
    const liquidationId = request.liquidationId || `liq-${crypto.randomBytes(4).toString('hex')}`;
    const liquidation = {
      liquidationId,
      poolId: request.poolId,
      liquidationSignatureCount: signatures.length,
      liquidatedAt: now,
    };
    this._liquidateCount++;
    if (this._audit) {
      this._audit('COLLATERAL_POOL_LIQUIDATED', { ...liquidation });
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
      throw new HsmAdapterError('LENDPOOL_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.LIQUIDATED) {
      throw new HsmAdapterError('LENDPOOL_NOT_LIQUIDATED',
        `pool ${request.poolId} status is ${pool.status}, expected liquidated`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('LENDPOOL_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('LENDPOOL_SETTLE_CHAIN_MISMATCH',
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
      this._audit('LENDPOOL_SETTLED', { ...settlement });
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
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('LENDPOOL_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minLiquidationSignatureQuorum || 3)) {
      throw new HsmAdapterError('LENDPOOL_LIQUIDATION_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} signatures below minimum ${this.policy.minLiquidationSignatureQuorum || 3}`);
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
      this._audit('LENDPOOL_SIGNATURES_AGGREGATED', { poolId, count: partialSignatures.length });
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
      throw new HsmAdapterError('LENDPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (pool.status === POOL_STATUS.LIQUIDATED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('LENDPOOL_ALREADY_LIQUIDATED',
        `pool ${poolId} has been liquidated/settled and cannot be cancelled`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('LENDPOOL_ALREADY_CANCELLED',
        `pool ${poolId} is already cancelled`);
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('LENDPOOL_CANCELLED', { poolId });
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
      ltvRatio: p.ltvRatio,
      borrowValueCap: p.borrowValueCap,
      solvencyVerified: p.solvencyVerified,
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
    throw new HsmAdapterError('LENDPOOL_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedBorrowValueCommitment || !request.blindedCollateralCommitment || !request.blindedSafetyMarginCommitment) {
    throw new HsmAdapterError('LENDPOOL_FIELDS_MISSING', 'blindedBorrowValueCommitment, blindedCollateralCommitment, and blindedSafetyMarginCommitment are required');
  }
  if (typeof request.ltvRatio !== 'number') {
    throw new HsmAdapterError('LENDPOOL_FIELDS_MISSING', 'ltvRatio is required');
  }
  if (policy.requireBorrowerAttestation && !request.borrowerAttestation) {
    throw new HsmAdapterError('LENDPOOL_BORROWER_ATTESTATION_MISSING', 'borrower attestation is required');
  }
}

function _validateLiquidateRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('LENDPOOL_LIQUIDATE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('LENDPOOL_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = {
  PqcLendingCollateralHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
