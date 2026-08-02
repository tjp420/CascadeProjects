'use strict';

/**
 * Track 63: PQC Blind Option Pool Hub.
 *
 * Interlocking contract coordinator that instantiates blinded option
 * pools using homomorphically additive Pedersen commitments over
 * values, strikes, and collateral thresholds. Parses OPTPOOL packets,
 * enforces maxContractLifetimeSeconds, and tracks state transitions
 * alongside the minExecutionSignatureQuorum.
 *
 * @module hsm-adapter/pqc-blind-option-pool-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcBlindOptionPoolHub {
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
  }

  /**
   * Initialize a blind option pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.initializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('OPTPOOL_INITIALIZER_UNATTESTED', 'initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('OPTPOOL_INITIALIZER_UNATTESTED', 'initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('OPTPOOL_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('OPTPOOL_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.collateralRatio === 'number' && request.collateralRatio < (this.policy.minCollateralRatio || 150)) {
      throw new HsmAdapterError('OPTPOOL_COLLATERAL_INSUFFICIENT', `collateral ratio ${request.collateralRatio}% below minimum ${this.policy.minCollateralRatio}%`);
    }
    const now = Math.floor(Date.now() / 1000);
    const lifetime = request.expirationTimestamp - now;
    if (lifetime > (this.policy.maxContractLifetimeSeconds || 2592000)) {
      throw new HsmAdapterError('OPTPOOL_LIFETIME_EXCEEDED', `contract lifetime ${lifetime}s exceeds maximum ${this.policy.maxContractLifetimeSeconds}s`);
    }
    if (lifetime <= 0) {
      throw new HsmAdapterError('OPTPOOL_EXPIRED', `contract expiration ${request.expirationTimestamp} is in the past`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('OPTPOOL_DUPLICATE', `pool ${poolId} already exists`);
    }
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedValueCommitment: request.blindedValueCommitment,
      blindedStrikeCommitment: request.blindedStrikeCommitment,
      blindedCollateralCommitment: request.blindedCollateralCommitment,
      collateralRatio: request.collateralRatio,
      expirationTimestamp: request.expirationTimestamp,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      marginVerified: false,
      executedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('BLIND_OPTION_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as margin-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markMarginVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('OPTPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.marginVerified = true;
    return pool;
  }

  /**
   * Execute a cleared option contract.
   * @param {object} request
   * @returns {object}
   */
  executeContract(request) {
    _validateExecRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('OPTPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.marginVerified) {
      throw new HsmAdapterError('OPTPOOL_MARGIN_NOT_VERIFIED', `pool ${request.poolId} margin not verified`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > pool.expirationTimestamp) {
      throw new HsmAdapterError('OPTPOOL_CONTRACT_EXPIRED', `pool ${request.poolId} expired at ${pool.expirationTimestamp}`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('OPTPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('OPTPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minExecutionSignatureQuorum || 3)) {
      throw new HsmAdapterError('OPTPOOL_EXEC_QUORUM_INSUFFICIENT', `execution signatures ${signatures.length} below minimum ${this.policy.minExecutionSignatureQuorum}`);
    }
    pool.status = 'executed';
    pool.executedAt = now;
    const execId = request.execId || `exec-${crypto.randomBytes(4).toString('hex')}`;
    const execution = {
      execId,
      poolId: request.poolId,
      executionSignatureCount: signatures.length,
      executedAt: now,
    };
    if (this._audit) {
      this._audit('BLIND_OPTION_CONTRACT_EXECUTED', { ...execution });
    }
    return execution;
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
    throw new HsmAdapterError('OPTPOOL_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedValueCommitment || !request.blindedStrikeCommitment || !request.blindedCollateralCommitment) {
    throw new HsmAdapterError('OPTPOOL_FIELDS_MISSING', 'blindedValueCommitment, blindedStrikeCommitment, and blindedCollateralCommitment are required');
  }
  if (typeof request.collateralRatio !== 'number') {
    throw new HsmAdapterError('OPTPOOL_FIELDS_MISSING', 'collateralRatio is required');
  }
  if (typeof request.expirationTimestamp !== 'number') {
    throw new HsmAdapterError('OPTPOOL_FIELDS_MISSING', 'expirationTimestamp is required');
  }
  if (policy.requireInitializerAttestation && !request.initializerAttestation) {
    throw new HsmAdapterError('OPTPOOL_INITIALIZER_ATTESTATION_MISSING', 'initializer attestation is required');
  }
}

function _validateExecRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('OPTPOOL_EXEC_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('OPTPOOL_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcBlindOptionPoolHub };
