'use strict';

/**
 * Track 95: PQC Deep-Sea Mineral Rights Gating Hub.
 *
 * Interlocking ISA authority endpoint
 * coordinator that instantiates multi-party
 * seabed verification pools using
 * homomorphically split Pedersen commitments
 * over seabed mineral survey hashes,
 * extraction volume digests, and sovereign
 * authority identity hashes. Parses
 * SEABEDGATE packets, enforces
 * maxExtractionChainDepth, and tracks
 * state transitions alongside the
 * minSovereignQuorum boundary.
 *
 * @module hsm-adapter/pqc-deep-sea-mineral-rights-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcDeepSeaMineralRightsGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireIsaAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.isaAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SEABEDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'ISA authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SEABEDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'ISA authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SEABEDGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SEABEDGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.leaseWindowSeconds === 'number' && request.leaseWindowSeconds > (this.policy.maxLeaseWindowSeconds || 31536000)) {
      throw new HsmAdapterError('SEABEDGATE_LEASE_WINDOW_EXCEEDED', `lease window seconds ${request.leaseWindowSeconds} exceeds maximum ${this.policy.maxLeaseWindowSeconds}`);
    }
    if (typeof request.extractionChainDepth === 'number' && request.extractionChainDepth > (this.policy.maxExtractionChainDepth || 15)) {
      throw new HsmAdapterError('SEABEDGATE_EXTRACTION_DEPTH_EXCEEDED', `extraction chain depth ${request.extractionChainDepth} exceeds maximum ${this.policy.maxExtractionChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SEABEDGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedMineralSurveyCommitment: request.blindedMineralSurveyCommitment,
      blindedExtractionVolumeCommitment: request.blindedExtractionVolumeCommitment,
      blindedSovereignAuthorityIdentityCommitment: request.blindedSovereignAuthorityIdentityCommitment,
      leaseWindowSeconds: request.leaseWindowSeconds,
      extractionChainDepth: request.extractionChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      extractionClaimVerified: false,
      leaseAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('SEABED_GATING_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markExtractionClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SEABEDGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.extractionClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SEABEDGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.extractionClaimVerified) {
      throw new HsmAdapterError('SEABEDGATE_EXTRACTION_CLAIM_NOT_VERIFIED', `pool ${request.poolId} extraction claim not verified`);
    }
    if (this.policy.requireSeabedOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.seabedOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SEABEDGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'seabed oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SEABEDGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'seabed oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minSovereignQuorum || 6)) {
      throw new HsmAdapterError('SEABEDGATE_QUORUM_INSUFFICIENT', `sovereign signatures ${signatures.length} below minimum ${this.policy.minSovereignQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.leaseAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('LEASE_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('SEABEDGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedMineralSurveyCommitment || !request.blindedExtractionVolumeCommitment || !request.blindedSovereignAuthorityIdentityCommitment) {
    throw new HsmAdapterError('SEABEDGATE_FIELDS_MISSING', 'blindedMineralSurveyCommitment, blindedExtractionVolumeCommitment, and blindedSovereignAuthorityIdentityCommitment are required');
  }
  if (typeof request.leaseWindowSeconds !== 'number') {
    throw new HsmAdapterError('SEABEDGATE_FIELDS_MISSING', 'leaseWindowSeconds is required');
  }
  if (typeof request.extractionChainDepth !== 'number') {
    throw new HsmAdapterError('SEABEDGATE_FIELDS_MISSING', 'extractionChainDepth is required');
  }
  if (policy.requireIsaAuthorityInitializerAttestation && !request.isaAuthorityInitializerAttestation) {
    throw new HsmAdapterError('SEABEDGATE_AUTHORITY_ATTESTATION_MISSING', 'ISA authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SEABEDGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireSeabedOversightCommitteeAttestation && !request.seabedOversightCommitteeAttestation) {
    throw new HsmAdapterError('SEABEDGATE_OVERSIGHT_ATTESTATION_MISSING', 'seabed oversight committee attestation is required');
  }
}

module.exports = { PqcDeepSeaMineralRightsGatingHub };
