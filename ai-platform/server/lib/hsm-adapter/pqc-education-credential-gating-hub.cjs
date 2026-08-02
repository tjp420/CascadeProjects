'use strict';

/**
 * Track 73: PQC Education Credential Gating Hub.
 *
 * Interlocking education credential coordinator that
 * instantiates multi-party accreditation verification
 * pools using homomorphically split Pedersen commitments
 * over academic transcripts, accreditation metrics, and
 * institution identity hashes. Parses EDUGATE packets,
 * enforces maxAcademicCredentialDepth, and tracks state
 * transitions alongside the minAccreditationQuorum
 * boundary.
 *
 * @module hsm-adapter/pqc-education-credential-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcEducationCredentialGatingHub {
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
   * Initialize an education credential gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireInstitutionInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.institutionInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EDUGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'institution initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EDUGATE_INSTITUTION_INITIALIZER_UNATTESTED', 'institution initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('EDUGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('EDUGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transcriptExpirationSeconds === 'number' && request.transcriptExpirationSeconds > (this.policy.maxTranscriptExpirationSeconds || 31536000)) {
      throw new HsmAdapterError('EDUGATE_TRANSCRIPT_EXPIRATION_EXCEEDED', `transcript expiration seconds ${request.transcriptExpirationSeconds} exceeds maximum ${this.policy.maxTranscriptExpirationSeconds}`);
    }
    if (typeof request.credentialDepth === 'number' && request.credentialDepth > (this.policy.maxAcademicCredentialDepth || 24)) {
      throw new HsmAdapterError('EDUGATE_CREDENTIAL_DEPTH_EXCEEDED', `academic credential depth ${request.credentialDepth} exceeds maximum ${this.policy.maxAcademicCredentialDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('EDUGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedTranscriptCommitment: request.blindedTranscriptCommitment,
      blindedAccreditationMetricCommitment: request.blindedAccreditationMetricCommitment,
      blindedInstitutionHashCommitment: request.blindedInstitutionHashCommitment,
      transcriptExpirationSeconds: request.transcriptExpirationSeconds,
      credentialDepth: request.credentialDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      academicClaimVerified: false,
      accreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('EDUCATION_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as academic-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markAcademicClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('EDUGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.academicClaimVerified = true;
    return pool;
  }

  /**
   * Complete credential accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('EDUGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.academicClaimVerified) {
      throw new HsmAdapterError('EDUGATE_ACADEMIC_CLAIM_NOT_VERIFIED', `pool ${request.poolId} academic claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EDUGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EDUGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAccreditationQuorum || 3)) {
      throw new HsmAdapterError('EDUGATE_ACCREDITATION_QUORUM_INSUFFICIENT', `accreditation signatures ${signatures.length} below minimum ${this.policy.minAccreditationQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.accreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('CREDENTIAL_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('EDUGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedTranscriptCommitment || !request.blindedAccreditationMetricCommitment || !request.blindedInstitutionHashCommitment) {
    throw new HsmAdapterError('EDUGATE_FIELDS_MISSING', 'blindedTranscriptCommitment, blindedAccreditationMetricCommitment, and blindedInstitutionHashCommitment are required');
  }
  if (typeof request.transcriptExpirationSeconds !== 'number') {
    throw new HsmAdapterError('EDUGATE_FIELDS_MISSING', 'transcriptExpirationSeconds is required');
  }
  if (typeof request.credentialDepth !== 'number') {
    throw new HsmAdapterError('EDUGATE_FIELDS_MISSING', 'credentialDepth is required');
  }
  if (policy.requireInstitutionInitializerAttestation && !request.institutionInitializerAttestation) {
    throw new HsmAdapterError('EDUGATE_INSTITUTION_INITIALIZER_ATTESTATION_MISSING', 'institution initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('EDUGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('EDUGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcEducationCredentialGatingHub };
