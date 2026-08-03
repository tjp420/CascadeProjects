'use strict';

/**
 * Track 78: PQC Financial Derivatives Gating Hub.
 *
 * Interlocking financial derivatives verification
 * coordinator that instantiates multi-party clearing
 * house verification pools using homomorphically split
 * Pedersen commitments over derivative contract terms,
 * counterparty risk metrics, and settlement identity
 * hashes. Parses DERIVGATE packets, enforces
 * maxRiskMetricDepth, and tracks state transitions
 * alongside the minClearingHouseQuorum boundary.
 *
 * @module hsm-adapter/pqc-financial-derivatives-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcFinancialDerivativesGatingHub {
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
   * Initialize a financial derivatives gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireClearingHouseInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingHouseInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DERIVGATE_CLEARING_HOUSE_INITIALIZER_UNATTESTED', 'clearing house initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DERIVGATE_CLEARING_HOUSE_INITIALIZER_UNATTESTED', 'clearing house initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('DERIVGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('DERIVGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.contractExpirationSeconds === 'number' && request.contractExpirationSeconds > (this.policy.maxContractExpirationSeconds || 31536000)) {
      throw new HsmAdapterError('DERIVGATE_CONTRACT_EXPIRATION_EXCEEDED', `contract expiration seconds ${request.contractExpirationSeconds} exceeds maximum ${this.policy.maxContractExpirationSeconds}`);
    }
    if (typeof request.riskMetricDepth === 'number' && request.riskMetricDepth > (this.policy.maxRiskMetricDepth || 32)) {
      throw new HsmAdapterError('DERIVGATE_RISK_DEPTH_EXCEEDED', `risk metric depth ${request.riskMetricDepth} exceeds maximum ${this.policy.maxRiskMetricDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('DERIVGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedContractTermsCommitment: request.blindedContractTermsCommitment,
      blindedCounterpartyRiskCommitment: request.blindedCounterpartyRiskCommitment,
      blindedSettlementHashCommitment: request.blindedSettlementHashCommitment,
      contractExpirationSeconds: request.contractExpirationSeconds,
      riskMetricDepth: request.riskMetricDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      derivativeClaimVerified: false,
      riskAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('DERIVATIVE_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as derivative-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markDerivativeClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('DERIVGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.derivativeClaimVerified = true;
    return pool;
  }

  /**
   * Complete counterparty risk accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('DERIVGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.derivativeClaimVerified) {
      throw new HsmAdapterError('DERIVGATE_DERIVATIVE_CLAIM_NOT_VERIFIED', `pool ${request.poolId} derivative claim not verified`);
    }
    if (this.policy.requireRiskCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.riskCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DERIVGATE_RISK_COMMITTEE_UNATTESTED', 'risk committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DERIVGATE_RISK_COMMITTEE_UNATTESTED', 'risk committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minClearingHouseQuorum || 3)) {
      throw new HsmAdapterError('DERIVGATE_QUORUM_INSUFFICIENT', `clearing house signatures ${signatures.length} below minimum ${this.policy.minClearingHouseQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.riskAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('COUNTERPARTY_RISK_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('DERIVGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedContractTermsCommitment || !request.blindedCounterpartyRiskCommitment || !request.blindedSettlementHashCommitment) {
    throw new HsmAdapterError('DERIVGATE_FIELDS_MISSING', 'blindedContractTermsCommitment, blindedCounterpartyRiskCommitment, and blindedSettlementHashCommitment are required');
  }
  if (typeof request.contractExpirationSeconds !== 'number') {
    throw new HsmAdapterError('DERIVGATE_FIELDS_MISSING', 'contractExpirationSeconds is required');
  }
  if (typeof request.riskMetricDepth !== 'number') {
    throw new HsmAdapterError('DERIVGATE_FIELDS_MISSING', 'riskMetricDepth is required');
  }
  if (policy.requireClearingHouseInitializerAttestation && !request.clearingHouseInitializerAttestation) {
    throw new HsmAdapterError('DERIVGATE_CLEARING_HOUSE_ATTESTATION_MISSING', 'clearing house initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('DERIVGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireRiskCommitteeAttestation && !request.riskCommitteeAttestation) {
    throw new HsmAdapterError('DERIVGATE_RISK_COMMITTEE_ATTESTATION_MISSING', 'risk committee attestation is required');
  }
}

module.exports = { PqcFinancialDerivativesGatingHub };
