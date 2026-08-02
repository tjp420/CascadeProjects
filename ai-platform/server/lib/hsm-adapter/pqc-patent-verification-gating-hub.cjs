'use strict';

/**
 * Track 74: PQC Patent Verification Gating Hub.
 *
 * Interlocking intellectual property patent verification
 * coordinator that instantiates multi-party licensing
 * verification pools using homomorphically split Pedersen
 * commitments over patent claims, licensing metrics, and
 * inventor identity hashes. Parses PATENTGATE packets,
 * enforces maxClaimScopeDepth, and tracks state
 * transitions alongside the minLicensingQuorum boundary.
 *
 * @module hsm-adapter/pqc-patent-verification-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcPatentVerificationGatingHub {
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
   * Initialize a patent verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requirePatentOfficeInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.patentOfficeInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('PATENTGATE_PATENT_OFFICE_INITIALIZER_UNATTESTED', 'patent office initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('PATENTGATE_PATENT_OFFICE_INITIALIZER_UNATTESTED', 'patent office initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('PATENTGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('PATENTGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.patentExpirationSeconds === 'number' && request.patentExpirationSeconds > (this.policy.maxPatentExpirationSeconds || 47304000)) {
      throw new HsmAdapterError('PATENTGATE_PATENT_EXPIRATION_EXCEEDED', `patent expiration seconds ${request.patentExpirationSeconds} exceeds maximum ${this.policy.maxPatentExpirationSeconds}`);
    }
    if (typeof request.claimScopeDepth === 'number' && request.claimScopeDepth > (this.policy.maxClaimScopeDepth || 32)) {
      throw new HsmAdapterError('PATENTGATE_CLAIM_SCOPE_DEPTH_EXCEEDED', `claim scope depth ${request.claimScopeDepth} exceeds maximum ${this.policy.maxClaimScopeDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('PATENTGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedPatentClaimCommitment: request.blindedPatentClaimCommitment,
      blindedLicensingMetricCommitment: request.blindedLicensingMetricCommitment,
      blindedInventorHashCommitment: request.blindedInventorHashCommitment,
      patentExpirationSeconds: request.patentExpirationSeconds,
      claimScopeDepth: request.claimScopeDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      patentClaimVerified: false,
      licenseAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('PATENT_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as patent-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markPatentClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('PATENTGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.patentClaimVerified = true;
    return pool;
  }

  /**
   * Complete patent license accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('PATENTGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.patentClaimVerified) {
      throw new HsmAdapterError('PATENTGATE_PATENT_CLAIM_NOT_VERIFIED', `pool ${request.poolId} patent claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('PATENTGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('PATENTGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minLicensingQuorum || 3)) {
      throw new HsmAdapterError('PATENTGATE_LICENSING_QUORUM_INSUFFICIENT', `licensing signatures ${signatures.length} below minimum ${this.policy.minLicensingQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.licenseAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('PATENT_LICENSE_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('PATENTGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedPatentClaimCommitment || !request.blindedLicensingMetricCommitment || !request.blindedInventorHashCommitment) {
    throw new HsmAdapterError('PATENTGATE_FIELDS_MISSING', 'blindedPatentClaimCommitment, blindedLicensingMetricCommitment, and blindedInventorHashCommitment are required');
  }
  if (typeof request.patentExpirationSeconds !== 'number') {
    throw new HsmAdapterError('PATENTGATE_FIELDS_MISSING', 'patentExpirationSeconds is required');
  }
  if (typeof request.claimScopeDepth !== 'number') {
    throw new HsmAdapterError('PATENTGATE_FIELDS_MISSING', 'claimScopeDepth is required');
  }
  if (policy.requirePatentOfficeInitializerAttestation && !request.patentOfficeInitializerAttestation) {
    throw new HsmAdapterError('PATENTGATE_PATENT_OFFICE_INITIALIZER_ATTESTATION_MISSING', 'patent office initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('PATENTGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('PATENTGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcPatentVerificationGatingHub };
