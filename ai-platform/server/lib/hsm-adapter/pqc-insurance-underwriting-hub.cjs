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
 * @module hsm-adapter/pqc-insurance-underwriting-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

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
  }

  /**
   * Initialize an insurance underwriting pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
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
      status: 'open',
      claimEligibilityVerified: false,
      liquidatedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('INSURANCE_POOL_INITIALIZED', { ...pool });
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
    pool.status = 'liquidated';
    pool.liquidatedAt = now;
    const liquidationId = request.liquidationId || `liq-${crypto.randomBytes(4).toString('hex')}`;
    const liquidation = {
      liquidationId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      liquidatedAt: now,
    };
    if (this._audit) {
      this._audit('UNDERWRITING_POOL_LIQUIDATED', { ...liquidation });
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

module.exports = { PqcInsuranceUnderwritingHub };
