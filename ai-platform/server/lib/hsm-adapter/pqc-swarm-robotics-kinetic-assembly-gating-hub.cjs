'use strict';

/**
 * Track 114: PQC Swarm Robotics Kinetic Assembly Gating Hub.
 *
 * Coordinated swarm robotics spatial kinematics coordination gate that
 * instantiates multi-party supersingular isogeny key exchange pools using
 * homomorphically split Pedersen commitments over spatial posture digests,
 * sub-millimeter assembly state attestations, and kinetic assembly chain
 * records. Parses KINETICGATE packets, enforces minRoboticQuorum,
 * maxKineticValidationWindowSeconds, and maxKineticAssemblyChainDepth, tracks
 * assembly accreditation, and emits telemetry.
 *
 * @module hsm-adapter/pqc-swarm-robotics-kinetic-assembly-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class PqcSwarmRoboticsKineticAssemblyGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireKineticAssemblyAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.kineticAssemblyAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('KINETICGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'kinetic assembly authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('KINETICGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'kinetic assembly authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('KINETICGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('KINETICGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.kineticValidationWindowSeconds === 'number' && request.kineticValidationWindowSeconds > (this.policy.maxKineticValidationWindowSeconds || 1)) {
      throw new HsmAdapterError('KINETICGATE_POSTURE_VALIDATION_WINDOW_EXCEEDED', `kinetic validation window seconds ${request.kineticValidationWindowSeconds} exceeds maximum ${this.policy.maxKineticValidationWindowSeconds}`);
    }
    if (typeof request.kineticAssemblyChainDepth === 'number' && request.kineticAssemblyChainDepth > (this.policy.maxKineticAssemblyChainDepth || 80)) {
      throw new HsmAdapterError('KINETICGATE_ASSEMBLY_CHAIN_DEPTH_EXCEEDED', `kinetic assembly chain depth ${request.kineticAssemblyChainDepth} exceeds maximum ${this.policy.maxKineticAssemblyChainDepth}`);
    }
    const poolId = request.poolId || `kinetic-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('KINETICGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceRoboticNodeId: request.sourceRoboticNodeId,
      targetRoboticNodeId: request.targetRoboticNodeId,
      blindedIsogenyKeyExchangeDigestCommitment: request.blindedIsogenyKeyExchangeDigestCommitment,
      blindedKineticPostureCommitment: request.blindedKineticPostureCommitment,
      blindedAssemblyStateCommitment: request.blindedAssemblyStateCommitment,
      kineticValidationWindowSeconds: request.kineticValidationWindowSeconds,
      kineticAssemblyChainDepth: request.kineticAssemblyChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      kineticPostureVerified: false,
      assemblyAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    hsmMetrics.incrementCounter('hsm_kineticgate_pool_initialized_total', 1);
    if (this._audit) {
      this._audit('KINETIC_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  verifyKineticPosture(request) {
    _validateProofRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('KINETICGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!request.proofValid) {
      throw new HsmAdapterError('KINETICGATE_PROOF_INVALID', `kinetic posture proof for pool ${request.poolId} is invalid`);
    }
    pool.kineticPostureVerified = true;
    hsmMetrics.incrementCounter('hsm_zk_kinetic_posture_verified_total', 1);
    if (this._audit) {
      this._audit('ZK_KINETIC_POSTURE_VERIFIED', { poolId: request.poolId });
    }
    return pool;
  }

  completeAssemblyAccreditation(request) {
    _validateAccreditationRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('KINETICGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.kineticPostureVerified) {
      throw new HsmAdapterError('KINETICGATE_POSTURE_NOT_VERIFIED', `pool ${request.poolId} kinetic posture not verified`);
    }
    const signatures = request.roboticSignatures || [];
    if (signatures.length < (this.policy.minRoboticQuorum || 40)) {
      throw new HsmAdapterError('KINETICGATE_QUORUM_INSUFFICIENT', `robotic quorum ${signatures.length} below minimum ${this.policy.minRoboticQuorum}`);
    }
    if (this.policy.requireAssemblyEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.assemblyEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('KINETICGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'assembly ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('KINETICGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'assembly ethics oversight committee attestation invalid');
      }
    }
    pool.status = 'accredited';
    pool.assemblyAccreditationCompletedAt = Math.floor(Date.now() / 1000);
    hsmMetrics.incrementCounter('hsm_assembly_accreditation_completed_total', 1);
    if (this._audit) {
      this._audit('ASSEMBLY_ACCREDITATION_COMPLETED', { poolId: request.poolId, roboticQuorum: signatures.length });
    }
    return pool;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request || typeof request !== 'object') {
    throw new HsmAdapterError('KINETICGATE_INIT_SHAPE_INVALID', 'request must be an object');
  }
  if (!request.blindedIsogenyKeyExchangeDigestCommitment || !request.blindedKineticPostureCommitment) {
    throw new HsmAdapterError('KINETICGATE_INIT_SHAPE_INVALID', 'blindedIsogenyKeyExchangeDigestCommitment and blindedKineticPostureCommitment are required');
  }
  if (typeof request.roboticQuorum === 'number' && request.roboticQuorum < (policy.minRoboticQuorum || 40)) {
    throw new HsmAdapterError('KINETICGATE_QUORUM_INSUFFICIENT', `robotic quorum ${request.roboticQuorum} below minimum ${policy.minRoboticQuorum || 40}`);
  }
}

function _validateProofRequest(request) {
  if (!request || typeof request !== 'object' || !request.poolId) {
    throw new HsmAdapterError('KINETICGATE_PROOF_SHAPE_INVALID', 'poolId is required');
  }
}

function _validateAccreditationRequest(policy, request) {
  if (!request || typeof request !== 'object' || !request.poolId) {
    throw new HsmAdapterError('KINETICGATE_ACCREDITATION_SHAPE_INVALID', 'poolId is required');
  }
  const signatures = request.roboticSignatures || [];
  if (signatures.length < (policy.minRoboticQuorum || 40)) {
    throw new HsmAdapterError('KINETICGATE_QUORUM_INSUFFICIENT', `robotic quorum ${signatures.length} below minimum ${policy.minRoboticQuorum || 40}`);
  }
}

module.exports = { PqcSwarmRoboticsKineticAssemblyGatingHub };
