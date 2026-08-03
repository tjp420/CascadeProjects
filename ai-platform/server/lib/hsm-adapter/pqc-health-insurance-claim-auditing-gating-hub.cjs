'use strict';

/**
 * Track 86: PQC Health Insurance Claim Auditing Gating Hub.
 *
 * Interlocking insurance authority endpoint
 * coordinator that instantiates multi-party
 * insurance authority verification pools using
 * homomorphically split Pedersen commitments over
 * encrypted diagnostic billing sequences, actuarial
 * risk codes, and policy payout commitment hashes.
 * Parses INSURANCEGATE packets, enforces
 * maxBillingSequenceDepth, and tracks state
 * transitions alongside the minClaimsAuditQuorum
 * boundary.
 *
 * @module hsm-adapter/pqc-health-insurance-claim-auditing-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcHealthInsuranceClaimAuditingGatingHub {
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
   * Initialize an insurance claim auditing verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireInsuranceAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.insuranceAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('INSURANCEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'insurance authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('INSURANCEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'insurance authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('INSURANCEGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('INSURANCEGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.claimWindowSeconds === 'number' && request.claimWindowSeconds > (this.policy.maxClaimWindowSeconds || 5184000)) {
      throw new HsmAdapterError('INSURANCEGATE_CLAIM_WINDOW_EXCEEDED', `claim window seconds ${request.claimWindowSeconds} exceeds maximum ${this.policy.maxClaimWindowSeconds}`);
    }
    if (typeof request.billingSequenceDepth === 'number' && request.billingSequenceDepth > (this.policy.maxBillingSequenceDepth || 24)) {
      throw new HsmAdapterError('INSURANCEGATE_BILLING_DEPTH_EXCEEDED', `billing sequence depth ${request.billingSequenceDepth} exceeds maximum ${this.policy.maxBillingSequenceDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('INSURANCEGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedDiagnosticBillingCommitment: request.blindedDiagnosticBillingCommitment,
      blindedActuarialRiskCodeCommitment: request.blindedActuarialRiskCodeCommitment,
      blindedPayoutCommitment: request.blindedPayoutCommitment,
      claimWindowSeconds: request.claimWindowSeconds,
      billingSequenceDepth: request.billingSequenceDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      claimAuditVerified: false,
      actuarialAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('INSURANCE_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as claim-audit-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markClaimAuditVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('INSURANCEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.claimAuditVerified = true;
    return pool;
  }

  /**
   * Complete actuarial accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('INSURANCEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.claimAuditVerified) {
      throw new HsmAdapterError('INSURANCEGATE_CLAIM_AUDIT_NOT_VERIFIED', `pool ${request.poolId} claim audit not verified`);
    }
    if (this.policy.requireActuarialCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.actuarialCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('INSURANCEGATE_ACTUARIAL_COMMITTEE_UNATTESTED', 'actuarial committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('INSURANCEGATE_ACTUARIAL_COMMITTEE_UNATTESTED', 'actuarial committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minClaimsAuditQuorum || 3)) {
      throw new HsmAdapterError('INSURANCEGATE_QUORUM_INSUFFICIENT', `claims audit signatures ${signatures.length} below minimum ${this.policy.minClaimsAuditQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.actuarialAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('ACTUARIAL_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('INSURANCEGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedDiagnosticBillingCommitment || !request.blindedActuarialRiskCodeCommitment || !request.blindedPayoutCommitment) {
    throw new HsmAdapterError('INSURANCEGATE_FIELDS_MISSING', 'blindedDiagnosticBillingCommitment, blindedActuarialRiskCodeCommitment, and blindedPayoutCommitment are required');
  }
  if (typeof request.claimWindowSeconds !== 'number') {
    throw new HsmAdapterError('INSURANCEGATE_FIELDS_MISSING', 'claimWindowSeconds is required');
  }
  if (typeof request.billingSequenceDepth !== 'number') {
    throw new HsmAdapterError('INSURANCEGATE_FIELDS_MISSING', 'billingSequenceDepth is required');
  }
  if (policy.requireInsuranceAuthorityInitializerAttestation && !request.insuranceAuthorityInitializerAttestation) {
    throw new HsmAdapterError('INSURANCEGATE_AUTHORITY_ATTESTATION_MISSING', 'insurance authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('INSURANCEGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireActuarialCommitteeAttestation && !request.actuarialCommitteeAttestation) {
    throw new HsmAdapterError('INSURANCEGATE_ACTUARIAL_ATTESTATION_MISSING', 'actuarial committee attestation is required');
  }
}

module.exports = { PqcHealthInsuranceClaimAuditingGatingHub };
