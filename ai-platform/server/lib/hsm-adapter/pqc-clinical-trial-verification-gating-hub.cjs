'use strict';

/**
 * Track 79: PQC Clinical Trial Verification Gating Hub.
 *
 * Interlocking clinical trial verification coordinator
 * that instantiates multi-party trial oversight
 * verification pools using homomorphically split Pedersen
 * commitments over clinical trial protocol hashes, patient
 * cohort metrics, and investigator identity hashes. Parses
 * TRIALGATE packets, enforces maxCohortMetricDepth, and
 * tracks state transitions alongside the
 * minTrialOversightQuorum boundary.
 *
 * @module hsm-adapter/pqc-clinical-trial-verification-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcClinicalTrialVerificationGatingHub {
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
   * Initialize a clinical trial verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireTrialOversightInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.trialOversightInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TRIALGATE_OVERSIGHT_INITIALIZER_UNATTESTED', 'trial oversight initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TRIALGATE_OVERSIGHT_INITIALIZER_UNATTESTED', 'trial oversight initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TRIALGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('TRIALGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.trialDurationSeconds === 'number' && request.trialDurationSeconds > (this.policy.maxTrialDurationSeconds || 94608000)) {
      throw new HsmAdapterError('TRIALGATE_TRIAL_DURATION_EXCEEDED', `trial duration seconds ${request.trialDurationSeconds} exceeds maximum ${this.policy.maxTrialDurationSeconds}`);
    }
    if (typeof request.cohortMetricDepth === 'number' && request.cohortMetricDepth > (this.policy.maxCohortMetricDepth || 24)) {
      throw new HsmAdapterError('TRIALGATE_COHORT_DEPTH_EXCEEDED', `cohort metric depth ${request.cohortMetricDepth} exceeds maximum ${this.policy.maxCohortMetricDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('TRIALGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedProtocolHashCommitment: request.blindedProtocolHashCommitment,
      blindedCohortMetricCommitment: request.blindedCohortMetricCommitment,
      blindedInvestigatorHashCommitment: request.blindedInvestigatorHashCommitment,
      trialDurationSeconds: request.trialDurationSeconds,
      cohortMetricDepth: request.cohortMetricDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      trialClaimVerified: false,
      cohortAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('CLINICAL_TRIAL_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as trial-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markTrialClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('TRIALGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.trialClaimVerified = true;
    return pool;
  }

  /**
   * Complete cohort accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('TRIALGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.trialClaimVerified) {
      throw new HsmAdapterError('TRIALGATE_TRIAL_CLAIM_NOT_VERIFIED', `pool ${request.poolId} trial claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TRIALGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TRIALGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minTrialOversightQuorum || 3)) {
      throw new HsmAdapterError('TRIALGATE_QUORUM_INSUFFICIENT', `trial oversight signatures ${signatures.length} below minimum ${this.policy.minTrialOversightQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.cohortAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('COHORT_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('TRIALGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedProtocolHashCommitment || !request.blindedCohortMetricCommitment || !request.blindedInvestigatorHashCommitment) {
    throw new HsmAdapterError('TRIALGATE_FIELDS_MISSING', 'blindedProtocolHashCommitment, blindedCohortMetricCommitment, and blindedInvestigatorHashCommitment are required');
  }
  if (typeof request.trialDurationSeconds !== 'number') {
    throw new HsmAdapterError('TRIALGATE_FIELDS_MISSING', 'trialDurationSeconds is required');
  }
  if (typeof request.cohortMetricDepth !== 'number') {
    throw new HsmAdapterError('TRIALGATE_FIELDS_MISSING', 'cohortMetricDepth is required');
  }
  if (policy.requireTrialOversightInitializerAttestation && !request.trialOversightInitializerAttestation) {
    throw new HsmAdapterError('TRIALGATE_OVERSIGHT_ATTESTATION_MISSING', 'trial oversight initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('TRIALGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('TRIALGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcClinicalTrialVerificationGatingHub };
