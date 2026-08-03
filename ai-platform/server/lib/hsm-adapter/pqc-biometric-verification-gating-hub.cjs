'use strict';

/**
 * Track 77: PQC Biometric Verification Gating Hub.
 *
 * Interlocking biometric identity verification coordinator
 * that instantiates multi-party biometric authority
 * verification pools using homomorphically split Pedersen
 * commitments over biometric template hashes, liveness
 * detection metrics, and subject identity hashes. Parses
 * BIOMETRICGATE packets, enforces maxLivenessMetricDepth,
 * and tracks state transitions alongside the
 * minBiometricAuthorityQuorum boundary.
 *
 * @module hsm-adapter/pqc-biometric-verification-gating-hub
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

class PqcBiometricVerificationGatingHub {
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
    this._maxBatchSize = typeof this.policy.maxBatchSize === 'number' ? this.policy.maxBatchSize : 50;
    this._initCount = 0;
    this._accreditCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a biometric verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireBiometricAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.biometricAuthorityInitializerAttestation);
        if (result && (result.verified === false || result.valid === false)) {
          throw new HsmAdapterError('BIOMETRICGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'biometric authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('BIOMETRICGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'biometric authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('BIOMETRICGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('BIOMETRICGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.templateExpirationSeconds === 'number' && request.templateExpirationSeconds > (this.policy.maxTemplateExpirationSeconds || 15552000)) {
      throw new HsmAdapterError('BIOMETRICGATE_TEMPLATE_EXPIRATION_EXCEEDED', `template expiration seconds ${request.templateExpirationSeconds} exceeds maximum ${this.policy.maxTemplateExpirationSeconds}`);
    }
    if (typeof request.livenessMetricDepth === 'number' && request.livenessMetricDepth > (this.policy.maxLivenessMetricDepth || 24)) {
      throw new HsmAdapterError('BIOMETRICGATE_LIVENESS_DEPTH_EXCEEDED', `liveness metric depth ${request.livenessMetricDepth} exceeds maximum ${this.policy.maxLivenessMetricDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('BIOMETRICGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedTemplateHashCommitment: request.blindedTemplateHashCommitment,
      blindedLivenessMetricCommitment: request.blindedLivenessMetricCommitment,
      blindedSubjectHashCommitment: request.blindedSubjectHashCommitment,
      templateExpirationSeconds: request.templateExpirationSeconds,
      livenessMetricDepth: request.livenessMetricDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      rebalanceEpoch: 0,
      settlementStatus: 'pending',
      settledAt: null,
      cancelledAt: null,
      biometricClaimVerified: false,
      livenessAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount += 1;
    if (this._audit) {
      this._audit('BIOMETRIC_GATING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple pools.
   * @param {Array<object>} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('BIOMETRICGATE_BATCH_EMPTY', 'batch initialization requires at least one request');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('BIOMETRICGATE_BATCH_TOO_LARGE', `batch size ${requests.length} exceeds maximum ${this._maxBatchSize}`);
    }
    let successCount = 0;
    let failedCount = 0;
    const results = [];
    for (const request of requests) {
      try {
        const pool = this.initializePool(request);
        results.push({ success: true, pool });
        successCount += 1;
      } catch (err) {
        results.push({ success: false, error: err.message });
        failedCount += 1;
      }
    }
    return { successCount, failedCount, results };
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
   * Get all pools.
   * @returns {Array<object>}
   */
  getPools() {
    return Array.from(this._pools.values());
  }

  /**
   * Mark a pool as biometric-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markBiometricClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.biometricClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance the liveness metric depth of a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceLivenessMetricDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_FIELDS_MISSING', 'poolId is required');
    }
    if (!Object.values(REBALANCE_DIRECTION).includes(request.direction)) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_DIRECTION_INVALID', `rebalance direction ${request.direction} is not valid`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_AMOUNT_INVALID', 'rebalance amount must be a positive number');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status === POOL_STATUS.ACCREDITED || pool.status === POOL_STATUS.SETTLED || pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('BIOMETRICGATE_REBALANCE_STATUS_INVALID', `pool ${request.poolId} cannot be rebalanced in status ${pool.status}`);
    }

    let newDepth = pool.livenessMetricDepth;
    if (typeof request.newLivenessMetricDepth === 'number') {
      newDepth = request.newLivenessMetricDepth;
    } else if (request.direction === REBALANCE_DIRECTION.INCREASE) {
      newDepth = pool.livenessMetricDepth + request.rebalanceAmount;
    } else {
      newDepth = Math.max(1, pool.livenessMetricDepth - request.rebalanceAmount);
    }
    if (newDepth > (this.policy.maxLivenessMetricDepth || 24)) {
      throw new HsmAdapterError('BIOMETRICGATE_LIVENESS_DEPTH_EXCEEDED', `rebalanced liveness metric depth ${newDepth} exceeds maximum ${this.policy.maxLivenessMetricDepth}`);
    }
    pool.livenessMetricDepth = newDepth;
    pool.rebalanceEpoch = (pool.rebalanceEpoch || 0) + 1;
    if (pool.status !== POOL_STATUS.CANCELLED && pool.status !== POOL_STATUS.SETTLED) {
      pool.status = POOL_STATUS.REBALANCING;
    }
    const now = Math.floor(Date.now() / 1000);
    const rebalanceId = `rebalance-${crypto.randomBytes(4).toString('hex')}`;
    const rebalance = {
      rebalanceId,
      poolId: request.poolId,
      direction: request.direction,
      rebalanceAmount: request.rebalanceAmount,
      newLivenessMetricDepth: newDepth,
      rebalanceEpoch: pool.rebalanceEpoch,
      rebalancedAt: now,
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount += 1;
    if (this._audit) {
      this._audit('BIOMETRIC_GATING_LIVENESS_REBALANCED', { ...rebalance });
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
   * Settle a pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_FIELDS_MISSING', 'poolId is required');
    }
    if (!request.targetChainId) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_FIELDS_MISSING', 'targetChainId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_NOT_ACCREDITED', `pool ${request.poolId} is not accredited`);
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError('BIOMETRICGATE_SETTLE_CHAIN_MISMATCH', `target chain ${request.targetChainId} does not match ${pool.targetChainId}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId = `settlement-${crypto.randomBytes(4).toString('hex')}`;
    const settlement = {
      settlementId,
      poolId: request.poolId,
      targetChainId: request.targetChainId,
      settledAt: now,
    };
    pool.status = POOL_STATUS.SETTLED;
    pool.settlementStatus = 'settled';
    pool.settledAt = now;
    this._settlements.set(request.poolId, settlement);
    this._settleCount += 1;
    if (this._audit) {
      this._audit('BIOMETRIC_GATING_POOL_SETTLED', { ...settlement });
    }
    return settlement;
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
   * Aggregate committee signatures for a pool.
   * @param {string} poolId
   * @param {Array<object>} signatures
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, signatures) {
    if (!poolId || typeof poolId !== 'string') {
      throw new HsmAdapterError('BIOMETRICGATE_AGGREGATE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (!Array.isArray(signatures) || signatures.length === 0) {
      throw new HsmAdapterError('BIOMETRICGATE_AGGREGATE_SIGNATURES_MISSING', 'signatures are required');
    }
    const quorum = this.policy.minBiometricAuthorityQuorum || 3;
    if (signatures.length < quorum) {
      throw new HsmAdapterError('BIOMETRICGATE_AGGREGATE_QUORUM_INSUFFICIENT', `signatures ${signatures.length} below minimum ${quorum}`);
    }
    const sorted = [...signatures].sort((a, b) => String(a.peerId).localeCompare(String(b.peerId)));
    const payload = sorted.map((s) => `${s.peerId}=${s.signature}`).join('&');
    const aggregatedSignature = crypto.createHash('sha256').update(`${poolId}:${payload}`).digest('hex');
    return { signatureCount: signatures.length, aggregatedSignature };
  }

  /**
   * Cancel a pool.
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    if (!poolId || typeof poolId !== 'string') {
      throw new HsmAdapterError('BIOMETRICGATE_CANCEL_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError('BIOMETRICGATE_CANCEL_ALREADY_CANCELLED', `pool ${poolId} is already cancelled`);
    }
    if (pool.status === POOL_STATUS.ACCREDITED || pool.status === POOL_STATUS.SETTLED) {
      throw new HsmAdapterError('BIOMETRICGATE_CANCEL_STATUS_INVALID', `pool ${poolId} cannot be cancelled in status ${pool.status}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const cancelId = `cancel-${crypto.randomBytes(4).toString('hex')}`;
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = now;
    this._cancelCount += 1;
    const result = { cancelled: true, cancelId, poolId, cancelledAt: now };
    if (this._audit) {
      this._audit('BIOMETRIC_GATING_POOL_CANCELLED', { ...result });
    }
    return result;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const poolsByStatus = {};
    for (const pool of this._pools.values()) {
      poolsByStatus[pool.status] = (poolsByStatus[pool.status] || 0) + 1;
    }
    return {
      totalPools: this._pools.size,
      poolsByStatus,
      initCount: this._initCount,
      accreditCount: this._accreditCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }

  /**
   * Complete liveness attestation accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('BIOMETRICGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.biometricClaimVerified) {
      throw new HsmAdapterError('BIOMETRICGATE_BIOMETRIC_CLAIM_NOT_VERIFIED', `pool ${request.poolId} biometric claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (result && (result.verified === false || result.valid === false)) {
          throw new HsmAdapterError('BIOMETRICGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('BIOMETRICGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minBiometricAuthorityQuorum || 3)) {
      throw new HsmAdapterError('BIOMETRICGATE_QUORUM_INSUFFICIENT', `biometric authority signatures ${signatures.length} below minimum ${this.policy.minBiometricAuthorityQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.ACCREDITED;
    pool.livenessAccreditationCompletedAt = now;
    this._accreditCount += 1;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('BIOMETRICGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedTemplateHashCommitment || !request.blindedLivenessMetricCommitment || !request.blindedSubjectHashCommitment) {
    throw new HsmAdapterError('BIOMETRICGATE_FIELDS_MISSING', 'blindedTemplateHashCommitment, blindedLivenessMetricCommitment, and blindedSubjectHashCommitment are required');
  }
  if (typeof request.templateExpirationSeconds !== 'number') {
    throw new HsmAdapterError('BIOMETRICGATE_FIELDS_MISSING', 'templateExpirationSeconds is required');
  }
  if (typeof request.livenessMetricDepth !== 'number') {
    throw new HsmAdapterError('BIOMETRICGATE_FIELDS_MISSING', 'livenessMetricDepth is required');
  }
  if (policy.requireBiometricAuthorityInitializerAttestation && !request.biometricAuthorityInitializerAttestation) {
    throw new HsmAdapterError('BIOMETRICGATE_AUTHORITY_ATTESTATION_MISSING', 'biometric authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('BIOMETRICGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('BIOMETRICGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcBiometricVerificationGatingHub, POOL_STATUS, REBALANCE_DIRECTION };
