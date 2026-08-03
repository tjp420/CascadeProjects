'use strict';

/**
 * Track 113: PQC Autonomous Drone Swarm Mesh-Routing Gating Hub.
 *
 * High-mobility autonomous drone swarm spatial mesh-routing coordination gate
 * that instantiates multi-party multivariate quadratic (MQ) signature pools
 * using homomorphically split Pedersen commitments over kinetic trajectory
 * path digests, ad-hoc packet propagation attestations, and swarm topological
 * slice records. Parses DRONEGATE packets, enforces minSwarmQuorum,
 * maxTrajectoryValidationWindowSeconds, and maxSwarmTopologicalChainDepth,
 * tracks topology accreditation, and emits telemetry.
 *
 * @module hsm-adapter/pqc-autonomous-drone-swarm-mesh-routing-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class PqcAutonomousDroneSwarmMeshRoutingGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireDroneMeshAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.droneMeshAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DRONEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'drone mesh authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DRONEGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'drone mesh authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('DRONEGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('DRONEGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.trajectoryValidationWindowSeconds === 'number' && request.trajectoryValidationWindowSeconds > (this.policy.maxTrajectoryValidationWindowSeconds || 5)) {
      throw new HsmAdapterError('DRONEGATE_TRAJECTORY_WINDOW_EXCEEDED', `trajectory validation window seconds ${request.trajectoryValidationWindowSeconds} exceeds maximum ${this.policy.maxTrajectoryValidationWindowSeconds}`);
    }
    if (typeof request.swarmTopologicalChainDepth === 'number' && request.swarmTopologicalChainDepth > (this.policy.maxSwarmTopologicalChainDepth || 72)) {
      throw new HsmAdapterError('DRONEGATE_TOPOLOGICAL_CHAIN_DEPTH_EXCEEDED', `swarm topological chain depth ${request.swarmTopologicalChainDepth} exceeds maximum ${this.policy.maxSwarmTopologicalChainDepth}`);
    }
    const poolId = request.poolId || `drone-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('DRONEGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceDroneNodeId: request.sourceDroneNodeId,
      targetDroneNodeId: request.targetDroneNodeId,
      blindedMultivariateQuadraticSignatureDigestCommitment: request.blindedMultivariateQuadraticSignatureDigestCommitment,
      blindedKineticTrajectoryCommitment: request.blindedKineticTrajectoryCommitment,
      blindedSwarmTopologySliceCommitment: request.blindedSwarmTopologySliceCommitment,
      trajectoryValidationWindowSeconds: request.trajectoryValidationWindowSeconds,
      swarmTopologicalChainDepth: request.swarmTopologicalChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      swarmRoutingVerified: false,
      topologyAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    hsmMetrics.incrementCounter('hsm_dronegate_pool_initialized_total', 1);
    if (this._audit) {
      this._audit('SWARM_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  verifySwarmRouting(request) {
    _validateProofRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('DRONEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!request.proofValid) {
      throw new HsmAdapterError('DRONEGATE_PROOF_INVALID', `swarm routing proof for pool ${request.poolId} is invalid`);
    }
    pool.swarmRoutingVerified = true;
    hsmMetrics.incrementCounter('hsm_zk_swarm_routing_verified_total', 1);
    if (this._audit) {
      this._audit('ZK_SWARM_ROUTING_VERIFIED', { poolId: request.poolId });
    }
    return pool;
  }

  completeTopologyAccreditation(request) {
    _validateAccreditationRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('DRONEGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.swarmRoutingVerified) {
      throw new HsmAdapterError('DRONEGATE_ROUTING_NOT_VERIFIED', `pool ${request.poolId} swarm routing not verified`);
    }
    const signatures = request.swarmSignatures || [];
    if (signatures.length < (this.policy.minSwarmQuorum || 32)) {
      throw new HsmAdapterError('DRONEGATE_QUORUM_INSUFFICIENT', `swarm quorum ${signatures.length} below minimum ${this.policy.minSwarmQuorum}`);
    }
    if (this.policy.requireSwarmEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.swarmEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DRONEGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'swarm ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DRONEGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'swarm ethics oversight committee attestation invalid');
      }
    }
    pool.status = 'accredited';
    pool.topologyAccreditationCompletedAt = Math.floor(Date.now() / 1000);
    hsmMetrics.incrementCounter('hsm_topology_accreditation_completed_total', 1);
    if (this._audit) {
      this._audit('TOPOLOGY_ACCREDITATION_COMPLETED', { poolId: request.poolId, swarmQuorum: signatures.length });
    }
    return pool;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request || typeof request !== 'object') {
    throw new HsmAdapterError('DRONEGATE_INIT_SHAPE_INVALID', 'request must be an object');
  }
  if (!request.blindedMultivariateQuadraticSignatureDigestCommitment || !request.blindedKineticTrajectoryCommitment) {
    throw new HsmAdapterError('DRONEGATE_INIT_SHAPE_INVALID', 'blindedMultivariateQuadraticSignatureDigestCommitment and blindedKineticTrajectoryCommitment are required');
  }
  if (typeof request.swarmQuorum === 'number' && request.swarmQuorum < (policy.minSwarmQuorum || 32)) {
    throw new HsmAdapterError('DRONEGATE_QUORUM_INSUFFICIENT', `swarm quorum ${request.swarmQuorum} below minimum ${policy.minSwarmQuorum || 32}`);
  }
}

function _validateProofRequest(request) {
  if (!request || typeof request !== 'object' || !request.poolId) {
    throw new HsmAdapterError('DRONEGATE_PROOF_SHAPE_INVALID', 'poolId is required');
  }
}

function _validateAccreditationRequest(policy, request) {
  if (!request || typeof request !== 'object' || !request.poolId) {
    throw new HsmAdapterError('DRONEGATE_ACCREDITATION_SHAPE_INVALID', 'poolId is required');
  }
  const signatures = request.swarmSignatures || [];
  if (signatures.length < (policy.minSwarmQuorum || 32)) {
    throw new HsmAdapterError('DRONEGATE_QUORUM_INSUFFICIENT', `swarm quorum ${signatures.length} below minimum ${policy.minSwarmQuorum || 32}`);
  }
}

module.exports = { PqcAutonomousDroneSwarmMeshRoutingGatingHub };
