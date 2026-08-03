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
        if (!result.verified) {
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
    if (typeof request.livenessMetricDepth === 'number' && request.livenessMetricDepth > (this.policy.maxLivenessMetricDepth || 16)) {
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
      status: 'open',
      biometricClaimVerified: false,
      livenessAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('BIOMETRIC_GATING_POOL_INITIALIZED', { ...pool });
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
        if (!result.verified) {
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
    pool.status = 'accredited';
    pool.livenessAccreditationCompletedAt = now;
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

module.exports = { PqcBiometricVerificationGatingHub };
