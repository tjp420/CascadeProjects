'use strict';

/**
 * Track 80: PQC VRF Audit Sortition Gating Hub.
 *
 * Interlocking sortition authority coordinator
 * that instantiates multi-party sortition
 * verification pools using homomorphically split Pedersen
 * commitments over validator stake hashes, sortition
 * seed metrics, and selection entropy hashes. Parses
 * SORTGATE packets, enforces maxEntropyDepth, and
 * tracks state transitions alongside the
 * minSortitionQuorum boundary.
 *
 * @module hsm-adapter/pqc-vrf-audit-sortition-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcVrfAuditSortitionGatingHub {
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
   * Initialize a sortition verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireSortitionAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.sortitionAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SORTGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'sortition authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SORTGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'sortition authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SORTGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SORTGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.sortitionEpochSeconds === 'number' && request.sortitionEpochSeconds > (this.policy.maxSortitionEpochSeconds || 2592000)) {
      throw new HsmAdapterError('SORTGATE_EPOCH_EXCEEDED', `sortition epoch seconds ${request.sortitionEpochSeconds} exceeds maximum ${this.policy.maxSortitionEpochSeconds}`);
    }
    if (typeof request.entropyDepth === 'number' && request.entropyDepth > (this.policy.maxEntropyDepth || 16)) {
      throw new HsmAdapterError('SORTGATE_ENTROPY_DEPTH_EXCEEDED', `entropy depth ${request.entropyDepth} exceeds maximum ${this.policy.maxEntropyDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SORTGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedStakeHashCommitment: request.blindedStakeHashCommitment,
      blindedSortitionSeedCommitment: request.blindedSortitionSeedCommitment,
      blindedEntropyHashCommitment: request.blindedEntropyHashCommitment,
      sortitionEpochSeconds: request.sortitionEpochSeconds,
      entropyDepth: request.entropyDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      sortitionClaimVerified: false,
      validatorAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('SORTITION_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as sortition-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markSortitionClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SORTGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.sortitionClaimVerified = true;
    return pool;
  }

  /**
   * Complete validator accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SORTGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.sortitionClaimVerified) {
      throw new HsmAdapterError('SORTGATE_SORTITION_CLAIM_NOT_VERIFIED', `pool ${request.poolId} sortition claim not verified`);
    }
    if (this.policy.requireAuditCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.auditCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SORTGATE_AUDIT_COMMITTEE_UNATTESTED', 'audit committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SORTGATE_AUDIT_COMMITTEE_UNATTESTED', 'audit committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minSortitionQuorum || 3)) {
      throw new HsmAdapterError('SORTGATE_QUORUM_INSUFFICIENT', `sortition signatures ${signatures.length} below minimum ${this.policy.minSortitionQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.validatorAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('VALIDATOR_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('SORTGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedStakeHashCommitment || !request.blindedSortitionSeedCommitment || !request.blindedEntropyHashCommitment) {
    throw new HsmAdapterError('SORTGATE_FIELDS_MISSING', 'blindedStakeHashCommitment, blindedSortitionSeedCommitment, and blindedEntropyHashCommitment are required');
  }
  if (typeof request.sortitionEpochSeconds !== 'number') {
    throw new HsmAdapterError('SORTGATE_FIELDS_MISSING', 'sortitionEpochSeconds is required');
  }
  if (typeof request.entropyDepth !== 'number') {
    throw new HsmAdapterError('SORTGATE_FIELDS_MISSING', 'entropyDepth is required');
  }
  if (policy.requireSortitionAuthorityInitializerAttestation && !request.sortitionAuthorityInitializerAttestation) {
    throw new HsmAdapterError('SORTGATE_AUTHORITY_ATTESTATION_MISSING', 'sortition authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SORTGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireAuditCommitteeAttestation && !request.auditCommitteeAttestation) {
    throw new HsmAdapterError('SORTGATE_AUDIT_ATTESTATION_MISSING', 'audit committee attestation is required');
  }
}

module.exports = { PqcVrfAuditSortitionGatingHub };
