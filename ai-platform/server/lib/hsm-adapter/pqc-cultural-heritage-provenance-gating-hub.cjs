'use strict';

/**
 * Track 93: PQC Cultural Heritage Provenance Gating Hub.
 *
 * Interlocking UNESCO authority endpoint
 * coordinator that instantiates multi-party
 * cultural heritage verification pools using
 * homomorphically split Pedersen commitments
 * over artwork material composition hashes,
 * provenance chain ancestry digests, and
 * collector identity hashes. Parses
 * HERITAGEGATE packets, enforces
 * maxProvenanceChainDepth, and tracks state
 * transitions alongside the
 * minAuthenticationQuorum boundary.
 *
 * @module hsm-adapter/pqc-cultural-heritage-provenance-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcCulturalHeritageProvenanceGatingHub {
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
   * Initialize a cultural heritage provenance verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireUnescoAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.unescoAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HERITAGEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'UNESCO authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HERITAGEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'UNESCO authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('HERITAGEGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('HERITAGEGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.authenticationWindowSeconds === 'number' && request.authenticationWindowSeconds > (this.policy.maxAuthenticationWindowSeconds || 15552000)) {
      throw new HsmAdapterError('HERITAGEGATE_AUTHENTICATION_WINDOW_EXCEEDED', `authentication window seconds ${request.authenticationWindowSeconds} exceeds maximum ${this.policy.maxAuthenticationWindowSeconds}`);
    }
    if (typeof request.provenanceChainDepth === 'number' && request.provenanceChainDepth > (this.policy.maxProvenanceChainDepth || 20)) {
      throw new HsmAdapterError('HERITAGEGATE_PROVENANCE_DEPTH_EXCEEDED', `provenance chain depth ${request.provenanceChainDepth} exceeds maximum ${this.policy.maxProvenanceChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('HERITAGEGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedMaterialCompositionCommitment: request.blindedMaterialCompositionCommitment,
      blindedProvenanceChainCommitment: request.blindedProvenanceChainCommitment,
      blindedCollectorIdentityCommitment: request.blindedCollectorIdentityCommitment,
      authenticationWindowSeconds: request.authenticationWindowSeconds,
      provenanceChainDepth: request.provenanceChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      authenticationClaimVerified: false,
      provenanceAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('HERITAGE_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as authentication-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markAuthenticationClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.authenticationClaimVerified = true;
    return pool;
  }

  /**
   * Complete provenance accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('HERITAGEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.authenticationClaimVerified) {
      throw new HsmAdapterError('HERITAGEGATE_AUTHENTICATION_CLAIM_NOT_VERIFIED', `pool ${request.poolId} authentication claim not verified`);
    }
    if (this.policy.requireCulturalHeritageOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.culturalHeritageOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HERITAGEGATE_HERITAGE_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HERITAGEGATE_HERITAGE_COMMITTEE_UNATTESTED', 'cultural heritage oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAuthenticationQuorum || 4)) {
      throw new HsmAdapterError('HERITAGEGATE_QUORUM_INSUFFICIENT', `authentication signatures ${signatures.length} below minimum ${this.policy.minAuthenticationQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.provenanceAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('PROVENANCE_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedMaterialCompositionCommitment || !request.blindedProvenanceChainCommitment || !request.blindedCollectorIdentityCommitment) {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'blindedMaterialCompositionCommitment, blindedProvenanceChainCommitment, and blindedCollectorIdentityCommitment are required');
  }
  if (typeof request.authenticationWindowSeconds !== 'number') {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'authenticationWindowSeconds is required');
  }
  if (typeof request.provenanceChainDepth !== 'number') {
    throw new HsmAdapterError('HERITAGEGATE_FIELDS_MISSING', 'provenanceChainDepth is required');
  }
  if (policy.requireUnescoAuthorityInitializerAttestation && !request.unescoAuthorityInitializerAttestation) {
    throw new HsmAdapterError('HERITAGEGATE_AUTHORITY_ATTESTATION_MISSING', 'UNESCO authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('HERITAGEGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireCulturalHeritageOversightCommitteeAttestation && !request.culturalHeritageOversightCommitteeAttestation) {
    throw new HsmAdapterError('HERITAGEGATE_HERITAGE_ATTESTATION_MISSING', 'cultural heritage oversight committee attestation is required');
  }
}

module.exports = { PqcCulturalHeritageProvenanceGatingHub };
