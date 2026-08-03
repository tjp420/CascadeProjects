'use strict';

/**
 * Tests for Track 113: PQC Autonomous Drone Swarm Mesh-Routing Gating Hub.
 */

const { PqcAutonomousDroneSwarmMeshRoutingGatingHub } = require('../pqc-autonomous-drone-swarm-mesh-routing-gating-hub.cjs');
const { ZkDroneClaimValidator } = require('../zk-drone-claim-validator.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

const DEFAULT_POLICY = {
  minSwarmQuorum: 32,
  maxTrajectoryValidationWindowSeconds: 5,
  maxSwarmTopologicalChainDepth: 72,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireDroneMeshAuthorityInitializerAttestation: false,
  requireSwarmEthicsOversightCommitteeAttestation: false,
};

function makeHub() {
  return new PqcAutonomousDroneSwarmMeshRoutingGatingHub({ policy: DEFAULT_POLICY });
}

function makeValidator() {
  return new ZkDroneClaimValidator({ policy: DEFAULT_POLICY });
}

function expectErrorCode(fn, code) {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err.code;
  }
}

describe('Track 113 PQC Autonomous Drone Swarm Mesh-Routing Gating Hub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('initializes a drone swarm mesh-routing pool and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      blindedSwarmTopologySliceCommitment: 'topology-commit',
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      swarmQuorum: 40,
      trajectoryValidationWindowSeconds: 5,
      swarmTopologicalChainDepth: 48,
    });
    expect(pool).toMatchObject({
      status: 'open',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    expect(hub.getPool(pool.poolId)).toEqual(pool);
    expect(hsmMetrics.getMetrics().hsm_dronegate_pool_initialized_total).toBe(1);
  });

  test('rejects initialize when trajectory validation window exceeds 5 seconds', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      trajectoryValidationWindowSeconds: 6,
      pqcSignatureScheme: 'ML-DSA-65',
    }), 'DRONEGATE_TRAJECTORY_WINDOW_EXCEEDED');
    expect(code).toBe('DRONEGATE_TRAJECTORY_WINDOW_EXCEEDED');
  });

  test('rejects initialize with disallowed PQC scheme', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      pqcSignatureScheme: 'falcon-512',
    }), 'DRONEGATE_PQC_SCHEME_BLOCKED');
    expect(code).toBe('DRONEGATE_PQC_SCHEME_BLOCKED');
  });

  test('verifies swarm routing and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    const verified = hub.verifySwarmRouting({ poolId: pool.poolId, proofValid: true });
    expect(verified.swarmRoutingVerified).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_swarm_routing_verified_total).toBe(1);
  });

  test('completes topology accreditation with sufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    hub.verifySwarmRouting({ poolId: pool.poolId, proofValid: true });
    const result = hub.completeTopologyAccreditation({
      poolId: pool.poolId,
      swarmSignatures: new Array(32).fill('sig'),
    });
    expect(result.status).toBe('accredited');
    expect(hsmMetrics.getMetrics().hsm_topology_accreditation_completed_total).toBe(1);
  });

  test('rejects topology accreditation with insufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedMultivariateQuadraticSignatureDigestCommitment: 'mq-commit',
      blindedKineticTrajectoryCommitment: 'trajectory-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    hub.verifySwarmRouting({ poolId: pool.poolId, proofValid: true });
    const code = expectErrorCode(() => hub.completeTopologyAccreditation({
      poolId: pool.poolId,
      swarmSignatures: new Array(11).fill('sig'),
    }), 'DRONEGATE_QUORUM_INSUFFICIENT');
    expect(code).toBe('DRONEGATE_QUORUM_INSUFFICIENT');
  });
});

describe('Track 113 ZkDroneClaimValidator', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('validates a fresh claim within 5-second window', () => {
    const validator = makeValidator();
    const result = validator.validateClaim({
      poolId: 'drone-1',
      multivariateQuadraticSignatureDigest: 'digest-1',
      timestampMs: Date.now() - 1000,
      proofValid: true,
    });
    expect(result.valid).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_swarm_routing_verified_total).toBe(1);
  });

  test('drops a claim 5001ms old with TRAJECTORY_VALIDATION_WINDOW_EXCEEDED', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'drone-1',
      multivariateQuadraticSignatureDigest: 'digest-1',
      timestampMs: Date.now() - 5001,
      proofValid: true,
    }), 'DRONECLAIM_TRAJECTORY_VALIDATION_WINDOW_EXCEEDED');
    expect(code).toBe('DRONECLAIM_TRAJECTORY_VALIDATION_WINDOW_EXCEEDED');
  });

  test('rejects a claim with excessive swarm topological chain depth', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'drone-1',
      multivariateQuadraticSignatureDigest: 'digest-1',
      timestampMs: Date.now(),
      swarmTopologicalChainDepth: 100,
      proofValid: true,
    }), 'DRONECLAIM_TOPOLOGICAL_CHAIN_DEPTH_EXCEEDED');
    expect(code).toBe('DRONECLAIM_TOPOLOGICAL_CHAIN_DEPTH_EXCEEDED');
  });

  test('rejects a claim with disallowed PQC signature scheme', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'drone-1',
      multivariateQuadraticSignatureDigest: 'digest-1',
      timestampMs: Date.now(),
      pqcSignatureScheme: 'falcon-512',
      proofValid: true,
    }), 'DRONECLAIM_PQC_SCHEME_BLOCKED');
    expect(code).toBe('DRONECLAIM_PQC_SCHEME_BLOCKED');
  });
});
