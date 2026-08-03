'use strict';

/**
 * Track 108: PQC Space-Based Laser Communication Mesh Gating Hub.
 *
 * Satellite-to-satellite high-bandwidth laser mesh communication routing gate
 * that instantiates multi-party laser mesh verification pools using
 * homomorphically split Pedersen commitments over laser link digests,
 * timed-release key digests, and orbital handoff identity hashes. Parses
 * LASERGATE packets, enforces maxLaserMeshChainDepth, and tracks state
 * transitions alongside the minLaserMeshQuorum boundary.
 *
 * @module hsm-adapter/pqc-space-based-laser-communication-mesh-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSpaceBasedLaserCommunicationMeshGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireLaserMeshAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.laserMeshAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LASERGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'laser mesh authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LASERGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'laser mesh authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('LASERGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('LASERGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.handoffWindowSeconds === 'number' && request.handoffWindowSeconds > (this.policy.maxHandoffWindowSeconds || 300)) {
      throw new HsmAdapterError('LASERGATE_HANDOFF_WINDOW_EXCEEDED', `handoff window seconds ${request.handoffWindowSeconds} exceeds maximum ${this.policy.maxHandoffWindowSeconds}`);
    }
    if (typeof request.laserMeshChainDepth === 'number' && request.laserMeshChainDepth > (this.policy.maxLaserMeshChainDepth || 40)) {
      throw new HsmAdapterError('LASERGATE_LASER_MESH_DEPTH_EXCEEDED', `laser mesh chain depth ${request.laserMeshChainDepth} exceeds maximum ${this.policy.maxLaserMeshChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('LASERGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceSatelliteId: request.sourceSatelliteId,
      targetSatelliteId: request.targetSatelliteId,
      blindedLaserLinkDigestCommitment: request.blindedLaserLinkDigestCommitment,
      blindedTimedReleaseKeyCommitment: request.blindedTimedReleaseKeyCommitment,
      blindedOrbitalHandoffIdentityCommitment: request.blindedOrbitalHandoffIdentityCommitment,
      handoffWindowSeconds: request.handoffWindowSeconds,
      laserMeshChainDepth: request.laserMeshChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      laserMeshClaimVerified: false,
      handoffAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('LASER_MESH_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markLaserMeshClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('LASERGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.laserMeshClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('LASERGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.laserMeshClaimVerified) {
      throw new HsmAdapterError('LASERGATE_LASER_MESH_CLAIM_NOT_VERIFIED', `pool ${request.poolId} laser mesh claim not verified`);
    }
    if (this.policy.requireLaserEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.laserEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LASERGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'laser ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LASERGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'laser ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minLaserMeshQuorum || 16)) {
      throw new HsmAdapterError('LASERGATE_QUORUM_INSUFFICIENT', `laser mesh quorum signatures ${signatures.length} below minimum ${this.policy.minLaserMeshQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.handoffAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('HANDOFF_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('LASERGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.sourceSatelliteId || !request.targetSatelliteId) {
    throw new HsmAdapterError('LASERGATE_FIELDS_MISSING', 'sourceSatelliteId and targetSatelliteId are required');
  }
  if (!request.blindedLaserLinkDigestCommitment || !request.blindedTimedReleaseKeyCommitment || !request.blindedOrbitalHandoffIdentityCommitment) {
    throw new HsmAdapterError('LASERGATE_FIELDS_MISSING', 'blindedLaserLinkDigestCommitment, blindedTimedReleaseKeyCommitment, and blindedOrbitalHandoffIdentityCommitment are required');
  }
  if (typeof request.handoffWindowSeconds !== 'number') {
    throw new HsmAdapterError('LASERGATE_FIELDS_MISSING', 'handoffWindowSeconds is required');
  }
  if (typeof request.laserMeshChainDepth !== 'number') {
    throw new HsmAdapterError('LASERGATE_FIELDS_MISSING', 'laserMeshChainDepth is required');
  }
  if (policy.requireLaserMeshAuthorityInitializerAttestation && !request.laserMeshAuthorityInitializerAttestation) {
    throw new HsmAdapterError('LASERGATE_AUTHORITY_ATTESTATION_MISSING', 'laser mesh authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('LASERGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireLaserEthicsOversightCommitteeAttestation && !request.laserEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('LASERGATE_OVERSIGHT_ATTESTATION_MISSING', 'laser ethics oversight committee attestation is required');
  }
}

module.exports = { PqcSpaceBasedLaserCommunicationMeshGatingHub };
