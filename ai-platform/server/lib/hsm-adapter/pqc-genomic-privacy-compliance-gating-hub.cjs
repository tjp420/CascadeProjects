'use strict';

/**
 * Track 99: PQC Genomic Privacy Compliance Gating Hub.
 *
 * Interlocking genomic privacy authority endpoint coordinator
 * that instantiates multi-party genomic compliance verification
 * pools using homomorphically split Pedersen commitments over
 * DNA sequence access hashes, consent probability digests, and
 * genomic privacy authority identity hashes. Parses GENOGATE
 * packets, enforces maxComplianceChainDepth, and tracks state
 * transitions alongside the minGenomicQuorum boundary.
 *
 * @module hsm-adapter/pqc-genomic-privacy-compliance-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcGenomicPrivacyComplianceGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireGenomicPrivacyAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.genomicPrivacyAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('GENOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'genomic privacy authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('GENOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'genomic privacy authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('GENOGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('GENOGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.consentWindowSeconds === 'number' && request.consentWindowSeconds > (this.policy.maxConsentWindowSeconds || 31536000)) {
      throw new HsmAdapterError('GENOGATE_CONSENT_WINDOW_EXCEEDED', `consent window seconds ${request.consentWindowSeconds} exceeds maximum ${this.policy.maxConsentWindowSeconds}`);
    }
    if (typeof request.complianceChainDepth === 'number' && request.complianceChainDepth > (this.policy.maxComplianceChainDepth || 20)) {
      throw new HsmAdapterError('GENOGATE_COMPLIANCE_DEPTH_EXCEEDED', `compliance chain depth ${request.complianceChainDepth} exceeds maximum ${this.policy.maxComplianceChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('GENOGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedDnaSequenceAccessCommitment: request.blindedDnaSequenceAccessCommitment,
      blindedConsentProbabilityCommitment: request.blindedConsentProbabilityCommitment,
      blindedGenomicPrivacyAuthorityIdentityCommitment: request.blindedGenomicPrivacyAuthorityIdentityCommitment,
      consentWindowSeconds: request.consentWindowSeconds,
      complianceChainDepth: request.complianceChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      genomicClaimVerified: false,
      consentAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('GENOMIC_COMPLIANCE_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markGenomicClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('GENOGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.genomicClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('GENOGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.genomicClaimVerified) {
      throw new HsmAdapterError('GENOGATE_GENOMIC_CLAIM_NOT_VERIFIED', `pool ${request.poolId} genomic claim not verified`);
    }
    if (this.policy.requireGenomicEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.genomicEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('GENOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'genomic ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('GENOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'genomic ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minGenomicQuorum || 6)) {
      throw new HsmAdapterError('GENOGATE_QUORUM_INSUFFICIENT', `genomic quorum signatures ${signatures.length} below minimum ${this.policy.minGenomicQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.consentAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('CONSENT_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('GENOGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedDnaSequenceAccessCommitment || !request.blindedConsentProbabilityCommitment || !request.blindedGenomicPrivacyAuthorityIdentityCommitment) {
    throw new HsmAdapterError('GENOGATE_FIELDS_MISSING', 'blindedDnaSequenceAccessCommitment, blindedConsentProbabilityCommitment, and blindedGenomicPrivacyAuthorityIdentityCommitment are required');
  }
  if (typeof request.consentWindowSeconds !== 'number') {
    throw new HsmAdapterError('GENOGATE_FIELDS_MISSING', 'consentWindowSeconds is required');
  }
  if (typeof request.complianceChainDepth !== 'number') {
    throw new HsmAdapterError('GENOGATE_FIELDS_MISSING', 'complianceChainDepth is required');
  }
  if (policy.requireGenomicPrivacyAuthorityInitializerAttestation && !request.genomicPrivacyAuthorityInitializerAttestation) {
    throw new HsmAdapterError('GENOGATE_AUTHORITY_ATTESTATION_MISSING', 'genomic privacy authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('GENOGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireGenomicEthicsOversightCommitteeAttestation && !request.genomicEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('GENOGATE_OVERSIGHT_ATTESTATION_MISSING', 'genomic ethics oversight committee attestation is required');
  }
}

module.exports = { PqcGenomicPrivacyComplianceGatingHub };
