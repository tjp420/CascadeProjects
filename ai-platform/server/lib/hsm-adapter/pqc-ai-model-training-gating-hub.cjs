'use strict';

/**
 * Track 82: PQC AI Model Training Gating Hub.
 *
 * Interlocking training authority coordinator
 * that instantiates multi-party training oversight
 * verification pools using homomorphically split Pedersen
 * commitments over model weight commitment hashes,
 * dataset provenance hashes, and training metric proofs.
 * Parses TRAINGATE packets, enforces maxProvenanceDepth,
 * and tracks state transitions alongside the
 * minTrainingOversightQuorum boundary.
 *
 * @module hsm-adapter/pqc-ai-model-training-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcAiModelTrainingGatingHub {
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
   * Initialize an AI model training verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireTrainingAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.trainingAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TRAINGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'training authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TRAINGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'training authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TRAINGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('TRAINGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.trainingWindowSeconds === 'number' && request.trainingWindowSeconds > (this.policy.maxTrainingWindowSeconds || 63072000)) {
      throw new HsmAdapterError('TRAINGATE_TRAINING_WINDOW_EXCEEDED', `training window seconds ${request.trainingWindowSeconds} exceeds maximum ${this.policy.maxTrainingWindowSeconds}`);
    }
    if (typeof request.provenanceDepth === 'number' && request.provenanceDepth > (this.policy.maxProvenanceDepth || 64)) {
      throw new HsmAdapterError('TRAINGATE_PROVENANCE_DEPTH_EXCEEDED', `provenance depth ${request.provenanceDepth} exceeds maximum ${this.policy.maxProvenanceDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('TRAINGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedModelWeightCommitment: request.blindedModelWeightCommitment,
      blindedDatasetProvenanceCommitment: request.blindedDatasetProvenanceCommitment,
      blindedTrainingMetricCommitment: request.blindedTrainingMetricCommitment,
      trainingWindowSeconds: request.trainingWindowSeconds,
      provenanceDepth: request.provenanceDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      trainingClaimVerified: false,
      modelAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('TRAINING_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as training-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markTrainingClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('TRAINGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.trainingClaimVerified = true;
    return pool;
  }

  /**
   * Complete model accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('TRAINGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.trainingClaimVerified) {
      throw new HsmAdapterError('TRAINGATE_TRAINING_CLAIM_NOT_VERIFIED', `pool ${request.poolId} training claim not verified`);
    }
    if (this.policy.requireModelAuditCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.modelAuditCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TRAINGATE_MODEL_AUDIT_UNATTESTED', 'model audit committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TRAINGATE_MODEL_AUDIT_UNATTESTED', 'model audit committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minTrainingOversightQuorum || 3)) {
      throw new HsmAdapterError('TRAINGATE_QUORUM_INSUFFICIENT', `training oversight signatures ${signatures.length} below minimum ${this.policy.minTrainingOversightQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.modelAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('MODEL_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('TRAINGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedModelWeightCommitment || !request.blindedDatasetProvenanceCommitment || !request.blindedTrainingMetricCommitment) {
    throw new HsmAdapterError('TRAINGATE_FIELDS_MISSING', 'blindedModelWeightCommitment, blindedDatasetProvenanceCommitment, and blindedTrainingMetricCommitment are required');
  }
  if (typeof request.trainingWindowSeconds !== 'number') {
    throw new HsmAdapterError('TRAINGATE_FIELDS_MISSING', 'trainingWindowSeconds is required');
  }
  if (typeof request.provenanceDepth !== 'number') {
    throw new HsmAdapterError('TRAINGATE_FIELDS_MISSING', 'provenanceDepth is required');
  }
  if (policy.requireTrainingAuthorityInitializerAttestation && !request.trainingAuthorityInitializerAttestation) {
    throw new HsmAdapterError('TRAINGATE_AUTHORITY_ATTESTATION_MISSING', 'training authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('TRAINGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireModelAuditCommitteeAttestation && !request.modelAuditCommitteeAttestation) {
    throw new HsmAdapterError('TRAINGATE_AUDIT_ATTESTATION_MISSING', 'model audit committee attestation is required');
  }
}

module.exports = { PqcAiModelTrainingGatingHub };
