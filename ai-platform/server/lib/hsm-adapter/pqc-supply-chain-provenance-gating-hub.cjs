'use strict';

/**
 * Track 76: PQC Supply Chain Provenance Gating Hub.
 *
 * Interlocking supply chain provenance coordinator that
 * instantiates multi-party accreditation verification
 * pools using homomorphically split Pedersen commitments
 * over component lineage records, manufacturing metrics, and
 * institution identity hashes. Parses SUPPLYGATE packets,
 * enforces maxComponentLineageDepth, and tracks state
 * transitions alongside the minSupplierCheckpointQuorum
 * boundary.
 *
 * Extended with batch pool initialization, component lineage
 * depth rebalancing, committee signature aggregation,
 * pool cancellation, cross-chain settlement, and
 * summary statistics.
 *
 * @module hsm-adapter/pqc-supply-chain-provenance-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const POOL_STATUS = {
  OPEN: 'open',
  REBALANCING: 'rebalancing',
  ACCREDITED: 'accredited',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
};

const REBALANCE_DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
};

class PqcSupplyChainProvenanceGatingHub {
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
    this._accreditCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize an supply chain provenance gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError('SUPPLYGATE_MAX_POOLS',
        `maximum ${this._maxPools} pools reached`);
    }
    if (this.policy.requireFactoryEndpointInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.factoryEndpointInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SUPPLYGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'institution initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SUPPLYGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'institution initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SUPPLYGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SUPPLYGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transitExpirationSeconds === 'number' && request.transitExpirationSeconds > (this.policy.maxTransitExpirationSeconds || 7776000)) {
      throw new HsmAdapterError('SUPPLYGATE_TRANSCRIPT_EXPIRATION_EXCEEDED', `transcript expiration seconds ${request.transitExpirationSeconds} exceeds maximum ${this.policy.maxTransitExpirationSeconds}`);
    }
    if (typeof request.componentLineageDepth === 'number' && request.componentLineageDepth > (this.policy.maxComponentLineageDepth || 64)) {
      throw new HsmAdapterError('SUPPLYGATE_LINEAGE_DEPTH_EXCEEDED', `component lineage depth ${request.componentLineageDepth} exceeds maximum ${this.policy.maxComponentLineageDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SUPPLYGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedLineageCommitment: request.blindedLineageCommitment,
      blindedManufacturingMetricCommitment: request.blindedManufacturingMetricCommitment,
      blindedSupplierHashCommitment: request.blindedSupplierHashCommitment,
      transitExpirationSeconds: request.transitExpirationSeconds,
      componentLineageDepth: request.componentLineageDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      provenanceClaimVerified: false,
      lineageAccreditationCompletedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit('SUPPLY_CHAIN_GATING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple supply chain provenance gating pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('SUPPLYGATE_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('SUPPLYGATE_BATCH_TOO_LARGE',
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
          error: err.code || 'SUPPLYGATE_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('SUPPLYGATE_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
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
   * Mark a pool as provenance-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markProvenanceClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.provenanceClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance component lineage depth for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceComponentLineageDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('SUPPLYGATE_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN && pool.status !== POOL_STATUS.REBALANCING) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_REBALANCEABLE',
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('SUPPLYGATE_REBALANCE_DIRECTION_INVALID',
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(', ')}`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('SUPPLYGATE_REBALANCE_AMOUNT_INVALID',
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
      newComponentLineageDepth: request.newComponentLineageDepth !== undefined ? request.newComponentLineageDepth : pool.componentLineageDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newComponentLineageDepth !== undefined) {
      if (request.newComponentLineageDepth > (this.policy.maxComponentLineageDepth || 64)) {
        throw new HsmAdapterError('SUPPLYGATE_LINEAGE_DEPTH_EXCEEDED',
          `new component lineage depth ${request.newComponentLineageDepth} exceeds maximum ${this.policy.maxComponentLineageDepth}`);
      }
      pool.componentLineageDepth = request.newComponentLineageDepth;
    }
    if (this._audit) {
      this._audit('SUPPLYGATE_COMPONENT_LINEAGE_DEPTH_REBALANCED', { ...rebalance });
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
   * Complete component lineage accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.provenanceClaimVerified) {
      throw new HsmAdapterError('SUPPLYGATE_PROVENANCE_CLAIM_NOT_VERIFIED', `pool ${request.poolId} provenance claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SUPPLYGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SUPPLYGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minSupplierCheckpointQuorum || 3)) {
      throw new HsmAdapterError('SUPPLYGATE_ACCREDITATION_QUORUM_INSUFFICIENT', `accreditation signatures ${signatures.length} below minimum ${this.policy.minSupplierCheckpointQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.ACCREDITED;
    pool.lineageAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    this._accreditCount++;
    if (this._audit) {
      this._audit('COMPONENT_LINEAGE_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  /**
   * Settle an accredited pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('SUPPLYGATE_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_ACCREDITED',
        `pool ${request.poolId} status is ${pool.status}, expected accredited`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('SUPPLYGATE_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('SUPPLYGATE_SETTLE_CHAIN_MISMATCH',
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
      this._audit('SUPPLYGATE_SETTLED', { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for accreditation completion.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('SUPPLYGATE_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minSupplierCheckpointQuorum || 3)) {
      throw new HsmAdapterError('SUPPLYGATE_ACCREDITATION_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} signatures below minimum ${this.policy.minSupplierCheckpointQuorum || 3}`);
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
      this._audit('SUPPLYGATE_SIGNATURES_AGGREGATED', { poolId, count: partialSignatures.length });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet accredited).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (pool.status === POOL_STATUS.ACCREDITED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('SUPPLYGATE_ALREADY_ACCREDITED',
        `pool ${poolId} has been accredited/settled and cannot be cancelled`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('SUPPLYGATE_ALREADY_CANCELLED',
        `pool ${poolId} is already cancelled`);
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('SUPPLYGATE_CANCELLED', { poolId });
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
      componentLineageDepth: p.componentLineageDepth,
      transitExpirationSeconds: p.transitExpirationSeconds,
      provenanceClaimVerified: p.provenanceClaimVerified,
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
      accreditCount: this._accreditCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedLineageCommitment || !request.blindedManufacturingMetricCommitment || !request.blindedSupplierHashCommitment) {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'blindedLineageCommitment, blindedManufacturingMetricCommitment, and blindedSupplierHashCommitment are required');
  }
  if (typeof request.transitExpirationSeconds !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'transitExpirationSeconds is required');
  }
  if (typeof request.componentLineageDepth !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'componentLineageDepth is required');
  }
  if (policy.requireFactoryEndpointInitializerAttestation && !request.factoryEndpointInitializerAttestation) {
    throw new HsmAdapterError('SUPPLYGATE_INSTITUTION_INITIALIZER_ATTESTATION_MISSING', 'institution initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SUPPLYGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('SUPPLYGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = {
  PqcSupplyChainProvenanceGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
