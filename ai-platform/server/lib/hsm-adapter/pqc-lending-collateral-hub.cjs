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
 * @module hsm-adapter/pqc-lending-collateral-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

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
  }

  /**
   * Initialize a lending pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
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
      status: 'open',
      solvencyVerified: false,
      liquidatedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('LENDING_POOL_INITIALIZED', { ...pool });
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
    pool.status = 'liquidated';
    pool.liquidatedAt = now;
    const liquidationId = request.liquidationId || `liq-${crypto.randomBytes(4).toString('hex')}`;
    const liquidation = {
      liquidationId,
      poolId: request.poolId,
      liquidationSignatureCount: signatures.length,
      liquidatedAt: now,
    };
    if (this._audit) {
      this._audit('COLLATERAL_POOL_LIQUIDATED', { ...liquidation });
    }
    return liquidation;
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

module.exports = { PqcLendingCollateralHub };
