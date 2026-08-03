'use strict';

/**
 * Track 110: PQC Holographic Storage Content-Addressable Gating Hub.
 *
 * High-density optical holographic storage volumetric sector targeting gate
 * that instantiates multi-party holographic verification pools using
 * homomorphically split Pedersen commitments over volumetric sector digests,
 * holographic state digests, and raw interference pattern phase attestation
 * hashes. Parses HOLOGATE packets, enforces maxVolumetricChainDepth, and
 * tracks state transitions alongside the minHolographicQuorum boundary.
 *
 * @module hsm-adapter/pqc-holographic-storage-content-addressable-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcHolographicStorageContentAddressableGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireHolographicStorageAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.holographicStorageAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HOLOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'holographic storage authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HOLOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'holographic storage authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('HOLOGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('HOLOGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.phaseValidationWindowSeconds === 'number' && request.phaseValidationWindowSeconds > (this.policy.maxPhaseValidationWindowSeconds || 10)) {
      throw new HsmAdapterError('HOLOGATE_PHASE_VALIDATION_WINDOW_EXCEEDED', `phase validation window seconds ${request.phaseValidationWindowSeconds} exceeds maximum ${this.policy.maxPhaseValidationWindowSeconds}`);
    }
    if (typeof request.volumetricChainDepth === 'number' && request.volumetricChainDepth > (this.policy.maxVolumetricChainDepth || 50)) {
      throw new HsmAdapterError('HOLOGATE_VOLUMETRIC_DEPTH_EXCEEDED', `volumetric chain depth ${request.volumetricChainDepth} exceeds maximum ${this.policy.maxVolumetricChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('HOLOGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceVolumetricSectorId: request.sourceVolumetricSectorId,
      targetVolumetricSectorId: request.targetVolumetricSectorId,
      blindedVolumetricSectorDigestCommitment: request.blindedVolumetricSectorDigestCommitment,
      blindedHolographicStateCommitment: request.blindedHolographicStateCommitment,
      blindedInterferencePatternPhaseCommitment: request.blindedInterferencePatternPhaseCommitment,
      phaseValidationWindowSeconds: request.phaseValidationWindowSeconds,
      volumetricChainDepth: request.volumetricChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      holographicClaimVerified: false,
      phaseAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('HOLOGRAPHIC_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markHolographicClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('HOLOGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.holographicClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('HOLOGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.holographicClaimVerified) {
      throw new HsmAdapterError('HOLOGATE_HOLOGRAPHIC_CLAIM_NOT_VERIFIED', `pool ${request.poolId} holographic claim not verified`);
    }
    if (this.policy.requireHolographicEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.holographicEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('HOLOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'holographic ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('HOLOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'holographic ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minHolographicQuorum || 20)) {
      throw new HsmAdapterError('HOLOGATE_QUORUM_INSUFFICIENT', `holographic quorum signatures ${signatures.length} below minimum ${this.policy.minHolographicQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.phaseAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('PHASE_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('HOLOGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.sourceVolumetricSectorId || !request.targetVolumetricSectorId) {
    throw new HsmAdapterError('HOLOGATE_FIELDS_MISSING', 'sourceVolumetricSectorId and targetVolumetricSectorId are required');
  }
  if (!request.blindedVolumetricSectorDigestCommitment || !request.blindedHolographicStateCommitment || !request.blindedInterferencePatternPhaseCommitment) {
    throw new HsmAdapterError('HOLOGATE_FIELDS_MISSING', 'blindedVolumetricSectorDigestCommitment, blindedHolographicStateCommitment, and blindedInterferencePatternPhaseCommitment are required');
  }
  if (typeof request.phaseValidationWindowSeconds !== 'number') {
    throw new HsmAdapterError('HOLOGATE_FIELDS_MISSING', 'phaseValidationWindowSeconds is required');
  }
  if (typeof request.volumetricChainDepth !== 'number') {
    throw new HsmAdapterError('HOLOGATE_FIELDS_MISSING', 'volumetricChainDepth is required');
  }
  if (policy.requireHolographicStorageAuthorityInitializerAttestation && !request.holographicStorageAuthorityInitializerAttestation) {
    throw new HsmAdapterError('HOLOGATE_AUTHORITY_ATTESTATION_MISSING', 'holographic storage authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('HOLOGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireHolographicEthicsOversightCommitteeAttestation && !request.holographicEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('HOLOGATE_OVERSIGHT_ATTESTATION_MISSING', 'holographic ethics oversight committee attestation is required');
  }
}

module.exports = { PqcHolographicStorageContentAddressableGatingHub };
