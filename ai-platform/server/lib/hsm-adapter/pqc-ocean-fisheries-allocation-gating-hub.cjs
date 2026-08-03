'use strict';

/**
 * Track 94: PQC Ocean Fisheries Allocation Gating Hub.
 *
 * Interlocking RFMO authority endpoint
 * coordinator that instantiates multi-party
 * fisheries verification pools using
 * homomorphically split Pedersen commitments
 * over vessel catch telemetry hashes, quota
 * allocation digests, and maritime authority
 * identity hashes. Parses FISHERIESGATE
 * packets, enforces
 * maxVesselTelemetryChainDepth, and tracks
 * state transitions alongside the
 * minMaritimeQuorum boundary.
 *
 * @module hsm-adapter/pqc-ocean-fisheries-allocation-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcOceanFisheriesAllocationGatingHub {
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
   * Initialize an ocean fisheries allocation verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireRfmoAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.rfmoAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('FISHERIESGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'RFMO authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('FISHERIESGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'RFMO authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('FISHERIESGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('FISHERIESGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.catchTrackingWindowSeconds === 'number' && request.catchTrackingWindowSeconds > (this.policy.maxCatchTrackingWindowSeconds || 2592000)) {
      throw new HsmAdapterError('FISHERIESGATE_TRACKING_WINDOW_EXCEEDED', `catch tracking window seconds ${request.catchTrackingWindowSeconds} exceeds maximum ${this.policy.maxCatchTrackingWindowSeconds}`);
    }
    if (typeof request.vesselTelemetryChainDepth === 'number' && request.vesselTelemetryChainDepth > (this.policy.maxVesselTelemetryChainDepth || 12)) {
      throw new HsmAdapterError('FISHERIESGATE_TELEMETRY_DEPTH_EXCEEDED', `vessel telemetry chain depth ${request.vesselTelemetryChainDepth} exceeds maximum ${this.policy.maxVesselTelemetryChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('FISHERIESGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedCatchTelemetryCommitment: request.blindedCatchTelemetryCommitment,
      blindedQuotaAllocationCommitment: request.blindedQuotaAllocationCommitment,
      blindedMaritimeAuthorityIdentityCommitment: request.blindedMaritimeAuthorityIdentityCommitment,
      catchTrackingWindowSeconds: request.catchTrackingWindowSeconds,
      vesselTelemetryChainDepth: request.vesselTelemetryChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      catchClaimVerified: false,
      quotaAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('FISHERIES_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as catch-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markCatchClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('FISHERIESGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.catchClaimVerified = true;
    return pool;
  }

  /**
   * Complete quota accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('FISHERIESGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.catchClaimVerified) {
      throw new HsmAdapterError('FISHERIESGATE_CATCH_CLAIM_NOT_VERIFIED', `pool ${request.poolId} catch claim not verified`);
    }
    if (this.policy.requireMarineSanctuaryOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.marineSanctuaryOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('FISHERIESGATE_SANCTUARY_COMMITTEE_UNATTESTED', 'marine sanctuary oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('FISHERIESGATE_SANCTUARY_COMMITTEE_UNATTESTED', 'marine sanctuary oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minMaritimeQuorum || 5)) {
      throw new HsmAdapterError('FISHERIESGATE_QUORUM_INSUFFICIENT', `maritime signatures ${signatures.length} below minimum ${this.policy.minMaritimeQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.quotaAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('QUOTA_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('FISHERIESGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedCatchTelemetryCommitment || !request.blindedQuotaAllocationCommitment || !request.blindedMaritimeAuthorityIdentityCommitment) {
    throw new HsmAdapterError('FISHERIESGATE_FIELDS_MISSING', 'blindedCatchTelemetryCommitment, blindedQuotaAllocationCommitment, and blindedMaritimeAuthorityIdentityCommitment are required');
  }
  if (typeof request.catchTrackingWindowSeconds !== 'number') {
    throw new HsmAdapterError('FISHERIESGATE_FIELDS_MISSING', 'catchTrackingWindowSeconds is required');
  }
  if (typeof request.vesselTelemetryChainDepth !== 'number') {
    throw new HsmAdapterError('FISHERIESGATE_FIELDS_MISSING', 'vesselTelemetryChainDepth is required');
  }
  if (policy.requireRfmoAuthorityInitializerAttestation && !request.rfmoAuthorityInitializerAttestation) {
    throw new HsmAdapterError('FISHERIESGATE_AUTHORITY_ATTESTATION_MISSING', 'RFMO authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('FISHERIESGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireMarineSanctuaryOversightCommitteeAttestation && !request.marineSanctuaryOversightCommitteeAttestation) {
    throw new HsmAdapterError('FISHERIESGATE_SANCTUARY_ATTESTATION_MISSING', 'marine sanctuary oversight committee attestation is required');
  }
}

module.exports = { PqcOceanFisheriesAllocationGatingHub };
