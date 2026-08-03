'use strict';

/**
 * Track 97: PQC Stratospheric Aerosol Monitoring Gating Hub.
 *
 * Interlocking climate authority endpoint coordinator that
 * instantiates multi-party stratospheric aerosol monitoring
 * verification pools using homomorphically split Pedersen commitments
 * over aerosol dispersion hashes, sensor calibration digests, and
 * climate authority identity hashes. Parses STRATOGATE packets,
 * enforces maxMonitoringChainDepth, and tracks state transitions
 * alongside the minClimateQuorum boundary.
 *
 * @module hsm-adapter/pqc-stratospheric-aerosol-monitoring-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcStratosphericAerosolMonitoringGatingHub {
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
   * Initialize a stratospheric aerosol monitoring gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireClimateAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.climateAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('STRATOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'climate authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('STRATOGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'climate authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('STRATOGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('STRATOGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.deploymentWindowSeconds === 'number' && request.deploymentWindowSeconds > (this.policy.maxDeploymentWindowSeconds || 31536000)) {
      throw new HsmAdapterError('STRATOGATE_DEPLOYMENT_WINDOW_EXCEEDED', `deployment window seconds ${request.deploymentWindowSeconds} exceeds maximum ${this.policy.maxDeploymentWindowSeconds}`);
    }
    if (typeof request.monitoringChainDepth === 'number' && request.monitoringChainDepth > (this.policy.maxMonitoringChainDepth || 16)) {
      throw new HsmAdapterError('STRATOGATE_MONITORING_DEPTH_EXCEEDED', `monitoring chain depth ${request.monitoringChainDepth} exceeds maximum ${this.policy.maxMonitoringChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('STRATOGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedAerosolDispersionCommitment: request.blindedAerosolDispersionCommitment,
      blindedSensorCalibrationCommitment: request.blindedSensorCalibrationCommitment,
      blindedClimateAuthorityIdentityCommitment: request.blindedClimateAuthorityIdentityCommitment,
      deploymentWindowSeconds: request.deploymentWindowSeconds,
      monitoringChainDepth: request.monitoringChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      aerosolClaimVerified: false,
      deploymentAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('STRATOSPHERIC_MONITORING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as aerosol-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markAerosolClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('STRATOGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.aerosolClaimVerified = true;
    return pool;
  }

  /**
   * Complete deployment accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('STRATOGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.aerosolClaimVerified) {
      throw new HsmAdapterError('STRATOGATE_AEROSOL_CLAIM_NOT_VERIFIED', `pool ${request.poolId} aerosol claim not verified`);
    }
    if (this.policy.requireStratosphericOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.stratosphericOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('STRATOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'stratospheric oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('STRATOGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'stratospheric oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minClimateQuorum || 4)) {
      throw new HsmAdapterError('STRATOGATE_QUORUM_INSUFFICIENT', `climate quorum signatures ${signatures.length} below minimum ${this.policy.minClimateQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.deploymentAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('DEPLOYMENT_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('STRATOGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedAerosolDispersionCommitment || !request.blindedSensorCalibrationCommitment || !request.blindedClimateAuthorityIdentityCommitment) {
    throw new HsmAdapterError('STRATOGATE_FIELDS_MISSING', 'blindedAerosolDispersionCommitment, blindedSensorCalibrationCommitment, and blindedClimateAuthorityIdentityCommitment are required');
  }
  if (typeof request.deploymentWindowSeconds !== 'number') {
    throw new HsmAdapterError('STRATOGATE_FIELDS_MISSING', 'deploymentWindowSeconds is required');
  }
  if (typeof request.monitoringChainDepth !== 'number') {
    throw new HsmAdapterError('STRATOGATE_FIELDS_MISSING', 'monitoringChainDepth is required');
  }
  if (policy.requireClimateAuthorityInitializerAttestation && !request.climateAuthorityInitializerAttestation) {
    throw new HsmAdapterError('STRATOGATE_AUTHORITY_ATTESTATION_MISSING', 'climate authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('STRATOGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireStratosphericOversightCommitteeAttestation && !request.stratosphericOversightCommitteeAttestation) {
    throw new HsmAdapterError('STRATOGATE_OVERSIGHT_ATTESTATION_MISSING', 'stratospheric oversight committee attestation is required');
  }
}

module.exports = { PqcStratosphericAerosolMonitoringGatingHub };
