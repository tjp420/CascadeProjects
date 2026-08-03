'use strict';

/**
 * Track 93: PQC Cultural Heritage Provenance Gating Hub.
 *
 * Interlocking cultural heritage provenance coordinator that
 * instantiates multi-party provenance verification
 * pools using homomorphically split Pedersen commitments
 * over artwork material composition hashes, provenance chain ancestry digests, and
 * collector identity hashes. Parses HERITAGEGATE packets,
 * enforces maxProvenanceChainDepth, and tracks state
 * transitions alongside the minAuthenticationQuorum
 * boundary.
 *
 * Extended with batch pool initialization, provenance chain
 * depth rebalancing, committee signature aggregation,
 * pool cancellation, cross-chain settlement, and
 * summary statistics.
 *
 * @module hsm-adapter/pqc-cultural-heritage-provenance-gating-hub
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

class PqcCulturalHeritageProvenanceGatingHub {
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
   * Initialize an cultural heritage provenance gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError('HERITAGEGATE_MAX_POOLS',
        `maximum ${this._maxPools} pools reached`);
    }
    if (this.policy.requireUnescoAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.unescoAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HERITAGEGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'UNESCO authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HERITAGEGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'UNESCO authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('HERITAGEGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('HERITAGEGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.authenticationWindowSeconds === 'number' && request.authenticationWindowSeconds > (this.policy.maxAuthenticationWindowSeconds || 15552000)) {
      throw new HsmAdapterError('HERITAGEGATE_AUTHENTICATION_WINDOW_EXCEEDED', `authentication window seconds ${request.authenticationWindowSeconds} exceeds maximum ${this.policy.maxAuthenticationWindowSeconds}`);
    }
    if (typeof request.provenanceChainDepth === 'number' && request.provenanceChainDepth > (this.policy.maxProvenanceChainDepth || 20)) {
      throw new HsmAdapterError('HERITAGEGATE_PROVENANCE_DEPTH_EXCEEDED', `provenance chain depth ${request.provenanceChainDepth} exceeds maximum ${this.policy.maxProvenanceChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('HERITAGEGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedMaterialCompositionCommitment: request.blindedMaterialCompositionCommitment,
      blindedProvenanceChainCommitment: request.blindedProvenanceChainCommitment,
      blindedCollectorIdentityCommitment: request.blindedCollectorIdentityCommitment,
      authenticationWindowSeconds: request.authenticationWindowSeconds,
      provenanceChainDepth: request.provenanceChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      authenticationClaimVerified: false,
      provenanceAccreditationCompletedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit('HERITAGE_GATING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple cultural heritage provenance gating pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('HERITAGEGATE_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('HERITAGEGATE_BATCH_TOO_LARGE',
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
          error: err.code || 'HERITAGEGATE_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('HERITAGEGATE_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
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
   * Mark a pool as authentication-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markAuthenticationClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.authenticationClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance provenance chain depth for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceProvenanceChainDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('HERITAGEGATE_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.OPEN && pool.status !== POOL_STATUS.REBALANCING) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_REBALANCEABLE',
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('HERITAGEGATE_REBALANCE_DIRECTION_INVALID',
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(', ')}`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('HERITAGEGATE_REBALANCE_AMOUNT_INVALID',
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
      newProvenanceChainDepth: request.newProvenanceChainDepth !== undefined ? request.newProvenanceChainDepth : pool.provenanceChainDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newProvenanceChainDepth !== undefined) {
      if (request.newProvenanceChainDepth > (this.policy.maxProvenanceChainDepth || 20)) {
        throw new HsmAdapterError('HERITAGEGATE_PROVENANCE_DEPTH_EXCEEDED',
          `new provenance chain depth ${request.newProvenanceChainDepth} exceeds maximum ${this.policy.maxProvenanceChainDepth}`);
      }
      pool.provenanceChainDepth = request.newProvenanceChainDepth;
    }
    if (this._audit) {
      this._audit('HERITAGEGATE_PROVENANCE_DEPTH_REBALANCED', { ...rebalance });
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
   * Complete provenance accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.authenticationClaimVerified) {
      throw new HsmAdapterError('HERITAGEGATE_AUTHENTICATION_CLAIM_NOT_VERIFIED', `pool ${request.poolId} authentication claim not verified`);
    }
    if (this.policy.requireCulturalHeritageOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.culturalHeritageOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HERITAGEGATE_HERITAGE_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HERITAGEGATE_HERITAGE_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAuthenticationQuorum || 4)) {
      throw new HsmAdapterError('HERITAGEGATE_ACCREDITATION_QUORUM_INSUFFICIENT', `accreditation signatures ${signatures.length} below minimum ${this.policy.minAuthenticationQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.ACCREDITED;
    pool.provenanceAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    this._accreditCount++;
    if (this._audit) {
      this._audit('PROVENANCE_ACCREDITATION_COMPLETED', { ...completion });
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
      throw new HsmAdapterError('HERITAGEGATE_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_ACCREDITED',
        `pool ${request.poolId} status is ${pool.status}, expected accredited`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('HERITAGEGATE_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('HERITAGEGATE_SETTLE_CHAIN_MISMATCH',
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
      this._audit('HERITAGEGATE_SETTLED', { ...settlement });
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
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('HERITAGEGATE_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minAuthenticationQuorum || 4)) {
      throw new HsmAdapterError('HERITAGEGATE_ACCREDITATION_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} signatures below minimum ${this.policy.minAuthenticationQuorum || 4}`);
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
      this._audit('HERITAGEGATE_SIGNATURES_AGGREGATED', { poolId, count: partialSignatures.length });
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
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (pool.status === POOL_STATUS.ACCREDITED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('HERITAGEGATE_ALREADY_ACCREDITED',
        `pool ${poolId} has been accredited/settled and cannot be cancelled`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('HERITAGEGATE_ALREADY_CANCELLED',
        `pool ${poolId} is already cancelled`);
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('HERITAGEGATE_CANCELLED', { poolId });
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
      provenanceChainDepth: p.provenanceChainDepth,
      authenticationWindowSeconds: p.authenticationWindowSeconds,
      authenticationClaimVerified: p.authenticationClaimVerified,
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
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedMaterialCompositionCommitment || !request.blindedProvenanceChainCommitment || !request.blindedCollectorIdentityCommitment) {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'blindedMaterialCompositionCommitment, blindedProvenanceChainCommitment, and blindedCollectorIdentityCommitment are required');
  }
  if (typeof request.authenticationWindowSeconds !== 'number') {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'authenticationWindowSeconds is required');
  }
  if (typeof request.provenanceChainDepth !== 'number') {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'provenanceChainDepth is required');
  }
  if (policy.requireUnescoAuthorityInitializerAttestation && !request.unescoAuthorityInitializerAttestation) {
    throw new HsmAdapterError('HERITAGEGATE_INSTITUTION_INITIALIZER_ATTESTATION_MISSING', 'UNESCO authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('HERITAGEGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireCulturalHeritageOversightCommitteeAttestation && !request.culturalHeritageOversightCommitteeAttestation) {
    throw new HsmAdapterError('HERITAGEGATE_CLEARING_ATTESTATION_MISSING', 'cultural heritage oversight committee attestation is required');
  }
}

module.exports = {
  PqcCulturalHeritageProvenanceGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
