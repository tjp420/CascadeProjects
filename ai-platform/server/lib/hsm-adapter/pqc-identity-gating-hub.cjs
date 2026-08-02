'use strict';

/**
 * Track 71: PQC Identity Gating Hub.
 *
 * Interlocking attestation coordinator that instantiates
 * multi-party claim verification pools using homomorphically
 * split Pedersen commitments over raw credentials, attribute
 * metrics, and identity hashes. Parses IDGATE packets,
 * enforces maxCredentialDepth, and tracks state transitions
 * alongside the minAttestationQuorum boundary.
 *
 * @module hsm-adapter/pqc-identity-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcIdentityGatingHub {
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
   * Initialize an identity gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireIdentityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.identityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('IDGATE_IDENTITY_INITIALIZER_UNATTESTED', 'identity initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('IDGATE_IDENTITY_INITIALIZER_UNATTESTED', 'identity initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('IDGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('IDGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.attestationContractLifetimeSeconds === 'number' && request.attestationContractLifetimeSeconds > (this.policy.maxAttestationContractLifetimeSeconds || 31536000)) {
      throw new HsmAdapterError('IDGATE_CONTRACT_LIFETIME_EXCEEDED', `attestation contract lifetime seconds ${request.attestationContractLifetimeSeconds} exceeds maximum ${this.policy.maxAttestationContractLifetimeSeconds}`);
    }
    if (typeof request.credentialDepth === 'number' && request.credentialDepth > (this.policy.maxCredentialDepth || 16)) {
      throw new HsmAdapterError('IDGATE_CREDENTIAL_DEPTH_EXCEEDED', `credential depth ${request.credentialDepth} exceeds maximum ${this.policy.maxCredentialDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('IDGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedRawCredentialCommitment: request.blindedRawCredentialCommitment,
      blindedAttributeMetricCommitment: request.blindedAttributeMetricCommitment,
      blindedIdentityHashCommitment: request.blindedIdentityHashCommitment,
      attestationContractLifetimeSeconds: request.attestationContractLifetimeSeconds,
      credentialDepth: request.credentialDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      attributeClaimVerified: false,
      gatingCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('IDENTITY_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as attribute-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markAttributeClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('IDGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.attributeClaimVerified = true;
    return pool;
  }

  /**
   * Complete sovereign identity gating after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeGating(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('IDGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.attributeClaimVerified) {
      throw new HsmAdapterError('IDGATE_ATTRIBUTE_CLAIM_NOT_VERIFIED', `pool ${request.poolId} attribute claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('IDGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('IDGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAttestationQuorum || 3)) {
      throw new HsmAdapterError('IDGATE_COMPLETION_QUORUM_INSUFFICIENT', `attestation signatures ${signatures.length} below minimum ${this.policy.minAttestationQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'completed';
    pool.gatingCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('SOVEREIGN_IDENTITY_GATING_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('IDGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedRawCredentialCommitment || !request.blindedAttributeMetricCommitment || !request.blindedIdentityHashCommitment) {
    throw new HsmAdapterError('IDGATE_FIELDS_MISSING', 'blindedRawCredentialCommitment, blindedAttributeMetricCommitment, and blindedIdentityHashCommitment are required');
  }
  if (typeof request.attestationContractLifetimeSeconds !== 'number') {
    throw new HsmAdapterError('IDGATE_FIELDS_MISSING', 'attestationContractLifetimeSeconds is required');
  }
  if (typeof request.credentialDepth !== 'number') {
    throw new HsmAdapterError('IDGATE_FIELDS_MISSING', 'credentialDepth is required');
  }
  if (policy.requireIdentityInitializerAttestation && !request.identityInitializerAttestation) {
    throw new HsmAdapterError('IDGATE_IDENTITY_INITIALIZER_ATTESTATION_MISSING', 'identity initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('IDGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('IDGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcIdentityGatingHub };
