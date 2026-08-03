'use strict';

/**
 * Track 76: PQC Supply Chain Provenance Gating Hub.
 *
 * Interlocking supply chain provenance verification
 * coordinator that instantiates multi-party supplier
 * checkpoint verification pools using homomorphically split
 * Pedersen commitments over component lineage records,
 * supplier identity hashes, and manufacturing metric
 * commitments. Parses SUPPLYGATE packets, enforces
 * maxComponentLineageDepth, and tracks state transitions
 * alongside the minSupplierCheckpointQuorum boundary.
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
    this._rebalances = new Map();
    this._maxBatchSize = options.maxBatchSize || 50;
    this._rebalanceCount = 0;
    this._settlements = new Map();
    this._initCount = 0;
    this._accreditCount = 0;
    this._settleCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a supply chain provenance gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireFactoryEndpointInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.factoryEndpointInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_INITIALIZER_UNATTESTED', 'factory endpoint initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_INITIALIZER_UNATTESTED', 'factory endpoint initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SUPPLYGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SUPPLYGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transitExpirationSeconds === 'number' && request.transitExpirationSeconds > (this.policy.maxTransitExpirationSeconds || 7776000)) {
      throw new HsmAdapterError('SUPPLYGATE_TRANSIT_EXPIRATION_EXCEEDED', `transit expiration seconds ${request.transitExpirationSeconds} exceeds maximum ${this.policy.maxTransitExpirationSeconds}`);
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
      blindedSupplierHashCommitment: request.blindedSupplierHashCommitment,
      blindedManufacturingMetricCommitment: request.blindedManufacturingMetricCommitment,
      transitExpirationSeconds: request.transitExpirationSeconds,
      componentLineageDepth: request.componentLineageDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      provenanceClaimVerified: false,
      lineageAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit('SUPPLY_CHAIN_GATING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
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
      throw new HsmAdapterError('SUPPLYGATE_QUORUM_INSUFFICIENT', `supplier checkpoint signatures ${signatures.length} below minimum ${this.policy.minSupplierCheckpointQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    this._accreditCount++;
    pool.lineageAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
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
    if (!request || !request.poolId) throw new HsmAdapterError('SUPPLYGATE_SETTLE_FIELDS_MISSING', 'poolId is required');
    if (!request.targetChainId) throw new HsmAdapterError('SUPPLYGATE_SETTLE_FIELDS_MISSING', 'targetChainId is required');
    const pool = this._pools.get(request.poolId);
    if (!pool) throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    if (pool.status !== POOL_STATUS.ACCREDITED) throw new HsmAdapterError('SUPPLYGATE_NOT_ACCREDITED', `pool ${request.poolId} is not accredited`);
    if (pool.targetChainId !== request.targetChainId) throw new HsmAdapterError('SUPPLYGATE_TARGET_CHAIN_MISMATCH', `targetChainId mismatch`);
    const settlementId = request.settlementId || `settle-${crypto.randomBytes(4).toString('hex')}`;
    const settlement = { settlementId, poolId: request.poolId, targetChainId: request.targetChainId, settledAt: Math.floor(Date.now()/1000) };
    this._settlements.set(request.poolId, settlement);
    pool.status = POOL_STATUS.SETTLED;
    this._settleCount++;
    if (this._audit) this._audit('SUPPLYGATE_POOL_SETTLED', { ...settlement });
    return settlement;
  }

  getSettlement(poolId) {
    return this._settlements.get(poolId) || null;
  }

  /**
   * Aggregate committee signatures for a pool.
   */
  aggregateCommitteeSignatures(poolId, signatures) {
    if (!poolId) throw new HsmAdapterError('SUPPLYGATE_AGG_FIELDS_MISSING', 'poolId is required');
    if (!Array.isArray(signatures) || signatures.length === 0) throw new HsmAdapterError('SUPPLYGATE_AGG_NO_SIGNATURES', 'signatures array is required');
    const pool = this._pools.get(poolId);
    if (!pool) throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    if (signatures.length < (this.policy.minSupplierCheckpointQuorum || 3)) throw new HsmAdapterError('SUPPLYGATE_AGG_INSUFFICIENT', 'insufficient signatures');
    const aggregatedSignature = crypto.createHash('sha256').update(signatures.map(s=>s.signature).join(':')).digest('hex');
    const result = { poolId, signatureCount: signatures.length, aggregatedSignature, participantIds: signatures.map(s=>s.peerId||'anonymous'), aggregatedAt: Math.floor(Date.now()/1000) };
    if (this._audit) this._audit('SUPPLYGATE_COMMITTEE_SIGS_AGGREGATED', { poolId, count: signatures.length });
    return result;
  }

  /**
   * Cancel an open pool.
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    if (pool.status === POOL_STATUS.CANCELLED) throw new HsmAdapterError('SUPPLYGATE_ALREADY_CANCELLED', `pool ${poolId} already cancelled`);
    if (pool.status === POOL_STATUS.ACCREDITED) throw new HsmAdapterError('SUPPLYGATE_CANNOT_CANCEL_ACCREDITED', `pool ${poolId} already accredited`);
    pool.status = POOL_STATUS.CANCELLED;
    this._cancelCount++;
    if (this._audit) this._audit('SUPPLYGATE_POOL_CANCELLED', { poolId });
    return { cancelled: true, poolId };
  }

  /**
   * Return list of pools.
   */
  getPools() {
    return Array.from(this._pools.values());
  }

  /**
   * Summary stats.
   */
  getStats() {
    const poolsByStatus = {};
    for (const p of this._pools.values()) poolsByStatus[p.status] = (poolsByStatus[p.status]||0)+1;
    return { totalPools: this._pools.size, poolsByStatus, initCount: this._initCount, accreditCount: this._accreditCount, settleCount: this._settleCount, rebalanceCount: this._rebalanceCount, cancelCount: this._cancelCount };
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }

  /**
   * Batch initialize multiple pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('SUPPLYGATE_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('SUPPLYGATE_BATCH_TOO_LARGE', `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
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
        results.push({ poolId: req.poolId || 'auto', initialized: false, error: err.code || 'SUPPLYGATE_BATCH_ERROR' });
        failedCount++;
      }
    }
    if (this._audit) this._audit('SUPPLY_GATE_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
    return { totalRequests: requests.length, successCount, failedCount, results };
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
      throw new HsmAdapterError('SUPPLYGATE_NOT_REBALANCEABLE', `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('SUPPLYGATE_REBALANCE_DIRECTION_INVALID', `direction ${direction} is not valid`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('SUPPLYGATE_REBALANCE_AMOUNT_INVALID', 'rebalanceAmount must be a positive number');
    }
    const newEpoch = (pool.rebalanceEpoch || 0) + 1;
    pool.rebalanceEpoch = newEpoch;
    pool.status = POOL_STATUS.REBALANCING;
    const rebalanceId = request.rebalanceId || `rebal-${crypto.randomBytes(4).toString('hex')}`;
    const rebalance = {
      rebalanceId,
      poolId: request.poolId,
      direction,
      rebalanceAmount: request.rebalanceAmount,
      rebalanceEpoch: newEpoch,
      newComponentLineageDepth: request.newComponentLineageDepth || pool.componentLineageDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newComponentLineageDepth !== undefined) {
      pool.componentLineageDepth = request.newComponentLineageDepth;
    }
    if (this._audit) this._audit('SUPPLYGATE_LINEAGE_REBALANCED', { ...rebalance });
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
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedLineageCommitment || !request.blindedSupplierHashCommitment || !request.blindedManufacturingMetricCommitment) {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'blindedLineageCommitment, blindedSupplierHashCommitment, and blindedManufacturingMetricCommitment are required');
  }
  if (typeof request.transitExpirationSeconds !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'transitExpirationSeconds is required');
  }
  if (typeof request.componentLineageDepth !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'componentLineageDepth is required');
  }
  if (policy.requireFactoryEndpointInitializerAttestation && !request.factoryEndpointInitializerAttestation) {
    throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_ATTESTATION_MISSING', 'factory endpoint initializer attestation is required');
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

module.exports = { PqcSupplyChainProvenanceGatingHub, POOL_STATUS, REBALANCE_DIRECTION };
