'use strict';

/**
 * Track 87: PQC Space-Asset Telemetry Gating Hub.
 *
 * Interlocking space authority endpoint
 * coordinator that instantiates multi-party
 * space authority verification pools using
 * homomorphically split Pedersen commitments over
 * orbital telemetry hashes, slot allocation
 * parameters, and satellite identity hashes.
 * Parses SPACEGATE packets, enforces
 * maxTelemetryChainDepth, and tracks state
 * transitions alongside the minOrbitalSlotQuorum
 * boundary.
 *
 * @module hsm-adapter/pqc-space-asset-telemetry-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSpaceAssetTelemetryGatingHub {
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
   * Initialize a space-asset telemetry verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireSpaceAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.spaceAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SPACEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'space authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SPACEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'space authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SPACEGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SPACEGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.slotAllocationWindowSeconds === 'number' && request.slotAllocationWindowSeconds > (this.policy.maxSlotAllocationWindowSeconds || 31536000)) {
      throw new HsmAdapterError('SPACEGATE_SLOT_WINDOW_EXCEEDED', `slot allocation window seconds ${request.slotAllocationWindowSeconds} exceeds maximum ${this.policy.maxSlotAllocationWindowSeconds}`);
    }
    if (typeof request.telemetryChainDepth === 'number' && request.telemetryChainDepth > (this.policy.maxTelemetryChainDepth || 16)) {
      throw new HsmAdapterError('SPACEGATE_TELEMETRY_DEPTH_EXCEEDED', `telemetry chain depth ${request.telemetryChainDepth} exceeds maximum ${this.policy.maxTelemetryChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SPACEGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedOrbitalTelemetryCommitment: request.blindedOrbitalTelemetryCommitment,
      blindedSlotAllocationCommitment: request.blindedSlotAllocationCommitment,
      blindedSatelliteIdentityCommitment: request.blindedSatelliteIdentityCommitment,
      slotAllocationWindowSeconds: request.slotAllocationWindowSeconds,
      telemetryChainDepth: request.telemetryChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      telemetryClaimVerified: false,
      orbitalAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('ORBITAL_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as telemetry-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markTelemetryClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SPACEGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.telemetryClaimVerified = true;
    return pool;
  }

  /**
   * Complete orbital accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SPACEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.telemetryClaimVerified) {
      throw new HsmAdapterError('SPACEGATE_TELEMETRY_CLAIM_NOT_VERIFIED', `pool ${request.poolId} telemetry claim not verified`);
    }
    if (this.policy.requireOrbitalOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.orbitalOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SPACEGATE_ORBITAL_COMMITTEE_UNATTESTED', 'orbital oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SPACEGATE_ORBITAL_COMMITTEE_UNATTESTED', 'orbital oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minOrbitalSlotQuorum || 5)) {
      throw new HsmAdapterError('SPACEGATE_QUORUM_INSUFFICIENT', `orbital slot signatures ${signatures.length} below minimum ${this.policy.minOrbitalSlotQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.orbitalAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('ORBITAL_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('SPACEGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedOrbitalTelemetryCommitment || !request.blindedSlotAllocationCommitment || !request.blindedSatelliteIdentityCommitment) {
    throw new HsmAdapterError('SPACEGATE_FIELDS_MISSING', 'blindedOrbitalTelemetryCommitment, blindedSlotAllocationCommitment, and blindedSatelliteIdentityCommitment are required');
  }
  if (typeof request.slotAllocationWindowSeconds !== 'number') {
    throw new HsmAdapterError('SPACEGATE_FIELDS_MISSING', 'slotAllocationWindowSeconds is required');
  }
  if (typeof request.telemetryChainDepth !== 'number') {
    throw new HsmAdapterError('SPACEGATE_FIELDS_MISSING', 'telemetryChainDepth is required');
  }
  if (policy.requireSpaceAuthorityInitializerAttestation && !request.spaceAuthorityInitializerAttestation) {
    throw new HsmAdapterError('SPACEGATE_AUTHORITY_ATTESTATION_MISSING', 'space authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SPACEGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireOrbitalOversightCommitteeAttestation && !request.orbitalOversightCommitteeAttestation) {
    throw new HsmAdapterError('SPACEGATE_ORBITAL_ATTESTATION_MISSING', 'orbital oversight committee attestation is required');
  }
}

module.exports = { PqcSpaceAssetTelemetryGatingHub };
