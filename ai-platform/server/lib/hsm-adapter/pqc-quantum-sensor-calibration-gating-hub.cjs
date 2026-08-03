'use strict';

/**
 * Track 100: PQC Quantum Sensor Network Calibration Gating Hub.
 *
 * Interlocking quantum metrology authority endpoint coordinator
 * that instantiates multi-party quantum sensor calibration verification
 * pools using homomorphically split Pedersen commitments over
 * quantum measurement hashes, calibration probability digests, and
 * quantum metrology authority identity hashes. Parses QUANTGATE
 * packets, enforces maxCalibrationChainDepth, and tracks state
 * transitions alongside the minQuantumQuorum boundary.
 *
 * @module hsm-adapter/pqc-quantum-sensor-calibration-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcQuantumSensorCalibrationGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireQuantumMetrologyAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.quantumMetrologyAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('QUANTGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'quantum metrology authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('QUANTGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'quantum metrology authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('QUANTGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('QUANTGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.calibrationWindowSeconds === 'number' && request.calibrationWindowSeconds > (this.policy.maxCalibrationWindowSeconds || 7776000)) {
      throw new HsmAdapterError('QUANTGATE_CALIBRATION_WINDOW_EXCEEDED', `calibration window seconds ${request.calibrationWindowSeconds} exceeds maximum ${this.policy.maxCalibrationWindowSeconds}`);
    }
    if (typeof request.calibrationChainDepth === 'number' && request.calibrationChainDepth > (this.policy.maxCalibrationChainDepth || 22)) {
      throw new HsmAdapterError('QUANTGATE_CALIBRATION_DEPTH_EXCEEDED', `calibration chain depth ${request.calibrationChainDepth} exceeds maximum ${this.policy.maxCalibrationChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('QUANTGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedQuantumMeasurementCommitment: request.blindedQuantumMeasurementCommitment,
      blindedCalibrationProbabilityCommitment: request.blindedCalibrationProbabilityCommitment,
      blindedQuantumMetrologyAuthorityIdentityCommitment: request.blindedQuantumMetrologyAuthorityIdentityCommitment,
      calibrationWindowSeconds: request.calibrationWindowSeconds,
      calibrationChainDepth: request.calibrationChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      quantumClaimVerified: false,
      calibrationAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('QUANTUM_CALIBRATION_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markQuantumClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('QUANTGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.quantumClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('QUANTGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.quantumClaimVerified) {
      throw new HsmAdapterError('QUANTGATE_QUANTUM_CLAIM_NOT_VERIFIED', `pool ${request.poolId} quantum claim not verified`);
    }
    if (this.policy.requireQuantumStandardsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.quantumStandardsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('QUANTGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'quantum standards oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('QUANTGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'quantum standards oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minQuantumQuorum || 7)) {
      throw new HsmAdapterError('QUANTGATE_QUORUM_INSUFFICIENT', `quantum quorum signatures ${signatures.length} below minimum ${this.policy.minQuantumQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.calibrationAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('CALIBRATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('QUANTGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedQuantumMeasurementCommitment || !request.blindedCalibrationProbabilityCommitment || !request.blindedQuantumMetrologyAuthorityIdentityCommitment) {
    throw new HsmAdapterError('QUANTGATE_FIELDS_MISSING', 'blindedQuantumMeasurementCommitment, blindedCalibrationProbabilityCommitment, and blindedQuantumMetrologyAuthorityIdentityCommitment are required');
  }
  if (typeof request.calibrationWindowSeconds !== 'number') {
    throw new HsmAdapterError('QUANTGATE_FIELDS_MISSING', 'calibrationWindowSeconds is required');
  }
  if (typeof request.calibrationChainDepth !== 'number') {
    throw new HsmAdapterError('QUANTGATE_FIELDS_MISSING', 'calibrationChainDepth is required');
  }
  if (policy.requireQuantumMetrologyAuthorityInitializerAttestation && !request.quantumMetrologyAuthorityInitializerAttestation) {
    throw new HsmAdapterError('QUANTGATE_AUTHORITY_ATTESTATION_MISSING', 'quantum metrology authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('QUANTGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireQuantumStandardsOversightCommitteeAttestation && !request.quantumStandardsOversightCommitteeAttestation) {
    throw new HsmAdapterError('QUANTGATE_OVERSIGHT_ATTESTATION_MISSING', 'quantum standards oversight committee attestation is required');
  }
}

module.exports = { PqcQuantumSensorCalibrationGatingHub };
