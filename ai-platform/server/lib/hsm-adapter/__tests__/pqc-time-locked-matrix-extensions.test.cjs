'use strict';

/**
 * Track 62: PQC Time-Locked Matrix Routing and Temporal Validity
 * Verification — extension tests.
 *
 * Tests the new lattice-based time locks, ML-KEM encapsulation,
 * matrix routing, batch verification, committee aggregation, and
 * slashing windows added to the existing Track 62 modules.
 */
const { PqcTimeLockedMatrixRouter, MATRIX_STATUS } = require('../pqc-time-locked-matrix-router.cjs');
const { MpcTemporalValidityVerifier, PROOF_STATUS, SLASH_REASON } = require('../mpc-temporal-validity-verifier.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minTimeDelaySeconds: 3600,
  minCommitteeQuorum: 3,
  maxPayloadBytes: 1048576,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireSubmitterAttestation: true,
  requireVerifierRelayAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banPrematureOrMalformedProofs: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    encryptedPayload: 'encrypted-payload-data-001',
    encryptedPayloadHash: 'hash-001',
    vdfDifficulty: 1,
    timeDelaySeconds: 3600,
    pqcSignatureScheme: 'ML-DSA-65',
    submitterAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function baseProofRequest(matrixId) {
  return {
    matrixId: matrixId || 'matrix-001',
    elapsedDurationSeconds: 3600,
    timeAnchorTick: 1000,
    zkProofHash: 'zk-proof-hash-001',
    verifierRelayAttestation: mockAttestation(),
    verifierRelayAttestationHash: 'relay-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
  };
}

function setupRouterAndVerifier() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const router = new PqcTimeLockedMatrixRouter({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const verifier = new MpcTemporalValidityVerifier({
    policy: POLICY,
    router,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, router, verifier };
}

function setupAndInitMatrix() {
  const ctx = setupRouterAndVerifier();
  const matrix = ctx.router.initializeMatrix(baseInitRequest());
  matrix.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
  return { ...ctx, matrix };
}

describe('Track 62 PQC Time-Locked Matrix extensions', () => {
  describe('PqcTimeLockedMatrixRouter — lattice-based time locks', () => {
    test('initializes matrix with lattice time-lock parameters', () => {
      const { router } = setupRouterAndVerifier();
      const matrix = router.initializeMatrix(baseInitRequest());
      expect(matrix.latticeTimeLock).toBeDefined();
      expect(matrix.latticeTimeLock.dimension).toBe(256);
      expect(matrix.latticeTimeLock.difficulty).toBe(1);
      expect(matrix.latticeTimeLock.seed).toBeDefined();
      expect(matrix.latticeTimeLock.latticeHash).toBeDefined();
    });

    test('initializes matrix with ML-KEM encapsulation envelope', () => {
      const { router } = setupRouterAndVerifier();
      const matrix = router.initializeMatrix(baseInitRequest());
      expect(matrix.mlKemEnvelope).toBeDefined();
      expect(matrix.mlKemEnvelope.kemAlgorithm).toBe('ML-KEM-768');
      expect(matrix.mlKemEnvelope.encapsulatedKey).toBeDefined();
    });

    test('MATRIX_STATUS constants are exported', () => {
      expect(MATRIX_STATUS.LOCKED).toBe('locked');
      expect(MATRIX_STATUS.ROUTING).toBe('routing');
      expect(MATRIX_STATUS.RELEASED).toBe('released');
      expect(MATRIX_STATUS.EXPIRED).toBe('expired');
    });
  });

  describe('PqcTimeLockedMatrixRouter — matrix routing', () => {
    test('registers routing nodes', () => {
      const { router } = setupRouterAndVerifier();
      const result = router.registerRoutingNode({
        nodeId: 'node-1',
        enclaveId: 'enclave-1',
        region: 'us-east',
      });
      expect(result.nodeId).toBe('node-1');
      expect(result.status).toBe('active');
    });

    test('rejects routing node with missing nodeId', () => {
      const { router } = setupRouterAndVerifier();
      expect(() => router.registerRoutingNode({ enclaveId: 'e1' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects duplicate routing node', () => {
      const { router } = setupRouterAndVerifier();
      router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      expect(() => router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e2' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects routing node with missing enclaveId', () => {
      const { router } = setupRouterAndVerifier();
      expect(() => router.registerRoutingNode({ nodeId: 'n1' }))
        .toThrow(HsmAdapterError);
    });

    test('routes a matrix through time-lock nodes', () => {
      const ctx = setupAndInitMatrix();
      const matrixId = ctx.matrix.matrixId;
      ctx.router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      ctx.router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      ctx.router.registerRoutingNode({ nodeId: 'n3', enclaveId: 'e3' });
      const result = ctx.router.routeMatrix(matrixId);
      expect(result.routingPath.length).toBe(3);
      expect(result.status).toBe(MATRIX_STATUS.ROUTING);
    });

    test('routes a matrix with explicit path', () => {
      const ctx = setupAndInitMatrix();
      const matrixId = ctx.matrix.matrixId;
      ctx.router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      ctx.router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      const result = ctx.router.routeMatrix(matrixId, ['n1', 'n2']);
      expect(result.routingPath).toEqual(['n1', 'n2']);
    });

    test('rejects routing unknown matrix', () => {
      const { router } = setupRouterAndVerifier();
      router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      expect(() => router.routeMatrix('unknown'))
        .toThrow(HsmAdapterError);
    });

    test('rejects routing with insufficient nodes', () => {
      const ctx = setupAndInitMatrix();
      ctx.router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      expect(() => ctx.router.routeMatrix(ctx.matrix.matrixId))
        .toThrow(HsmAdapterError);
    });

    test('rejects routing with unavailable explicit node', () => {
      const ctx = setupAndInitMatrix();
      ctx.router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      ctx.router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      expect(() => ctx.router.routeMatrix(ctx.matrix.matrixId, ['n1', 'unknown']))
        .toThrow(HsmAdapterError);
    });

    test('rejects routing already-routed matrix', () => {
      const ctx = setupAndInitMatrix();
      const matrixId = ctx.matrix.matrixId;
      ctx.router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      ctx.router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      ctx.router.registerRoutingNode({ nodeId: 'n3', enclaveId: 'e3' });
      ctx.router.routeMatrix(matrixId);
      expect(() => ctx.router.routeMatrix(matrixId))
        .toThrow(HsmAdapterError);
    });
  });

  describe('PqcTimeLockedMatrixRouter — committee signature aggregation', () => {
    test('aggregates committee signatures', () => {
      const ctx = setupAndInitMatrix();
      const result = ctx.router.aggregateCommitteeSignatures(ctx.matrix.matrixId, [
        'sig-a', 'sig-b', 'sig-c', 'sig-d',
      ]);
      expect(result.signatureCount).toBe(4);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitMatrix();
      expect(() => ctx.router.aggregateCommitteeSignatures(ctx.matrix.matrixId, ['sig-a']))
        .toThrow(HsmAdapterError);
    });

    test('rejects aggregation with no signatures', () => {
      const ctx = setupAndInitMatrix();
      expect(() => ctx.router.aggregateCommitteeSignatures(ctx.matrix.matrixId, []))
        .toThrow(HsmAdapterError);
    });

    test('rejects aggregation for unknown matrix', () => {
      const { router } = setupRouterAndVerifier();
      expect(() => router.aggregateCommitteeSignatures('unknown', ['a', 'b', 'c']))
        .toThrow(HsmAdapterError);
    });
  });

  describe('PqcTimeLockedMatrixRouter — lattice key generation', () => {
    test('generates a lattice key pair', () => {
      const { router } = setupRouterAndVerifier();
      const result = router.generateLatticeKeyPair('lk-1');
      expect(result.keyId).toBe('lk-1');
      expect(result.publicKey).toBeDefined();
    });

    test('rejects duplicate lattice key', () => {
      const { router } = setupRouterAndVerifier();
      router.generateLatticeKeyPair('lk-1');
      expect(() => router.generateLatticeKeyPair('lk-1'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('PqcTimeLockedMatrixRouter — expiration and queries', () => {
    test('expires a matrix', () => {
      const ctx = setupAndInitMatrix();
      const matrixId = ctx.matrix.matrixId;
      const result = ctx.router.expireMatrix(matrixId);
      expect(result.expired).toBe(true);
      const matrix = ctx.router.getMatrix(matrixId);
      expect(matrix.status).toBe(MATRIX_STATUS.EXPIRED);
    });

    test('rejects expiring unknown matrix', () => {
      const { router } = setupRouterAndVerifier();
      expect(() => router.expireMatrix('unknown'))
        .toThrow(HsmAdapterError);
    });

    test('rejects double-expiring a matrix', () => {
      const ctx = setupAndInitMatrix();
      const matrixId = ctx.matrix.matrixId;
      ctx.router.expireMatrix(matrixId);
      expect(() => ctx.router.expireMatrix(matrixId))
        .toThrow(HsmAdapterError);
    });

    test('returns routing nodes list', () => {
      const { router } = setupRouterAndVerifier();
      router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1' });
      router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2' });
      expect(router.getRoutingNodes().length).toBe(2);
    });

    test('returns routing node info', () => {
      const { router } = setupRouterAndVerifier();
      router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1', region: 'us' });
      const node = router.getRoutingNode('n1');
      expect(node).not.toBeNull();
      expect(node.nodeId).toBe('n1');
      expect(node.region).toBe('us');
    });

    test('returns null for unknown routing node', () => {
      const { router } = setupRouterAndVerifier();
      expect(router.getRoutingNode('unknown')).toBeNull();
    });

    test('returns matrices list', () => {
      const { router } = setupAndInitMatrix();
      expect(router.getMatrices().length).toBe(1);
    });

    test('returns summary stats', () => {
      const { router } = setupAndInitMatrix();
      const stats = router.getStats();
      expect(stats.totalMatrices).toBe(1);
      expect(stats.matricesByStatus).toBeDefined();
    });
  });

  describe('MpcTemporalValidityVerifier — batch verification', () => {
    test('batch verifies multiple temporal proofs', () => {
      const { router, verifier } = setupRouterAndVerifier();
      // Initialize 3 matrices
      const matrices = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.matrixId = `matrix-batch-${i}`;
        const m = router.initializeMatrix(req);
        m.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
        matrices.push(m);
      }
      // Batch verify
      const batch = matrices.map(m => baseProofRequest(m.matrixId));
      const result = verifier.batchVerifyTemporalProofs(batch);
      expect(result.totalRequests).toBe(3);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch verification handles mixed valid/invalid proofs', () => {
      const { router, verifier } = setupRouterAndVerifier();
      // Initialize 2 valid matrices
      for (let i = 0; i < 2; i++) {
        const req = baseInitRequest();
        req.matrixId = `matrix-mix-${i}`;
        const m = router.initializeMatrix(req);
        m.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
      }
      // Batch: 2 valid + 1 invalid (unknown matrix)
      const batch = [
        baseProofRequest('matrix-mix-0'),
        baseProofRequest('matrix-mix-1'),
        baseProofRequest('unknown-matrix'),
      ];
      const result = verifier.batchVerifyTemporalProofs(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test('rejects empty batch', () => {
      const { verifier } = setupRouterAndVerifier();
      expect(() => verifier.batchVerifyTemporalProofs([]))
        .toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { router, verifier } = setupRouterAndVerifier();
      const bigBatch = Array.from({ length: 101 }, () => baseProofRequest('x'));
      expect(() => verifier.batchVerifyTemporalProofs(bigBatch))
        .toThrow(HsmAdapterError);
    });

    test('records batch history', () => {
      const { router, verifier } = setupRouterAndVerifier();
      const req = baseInitRequest();
      req.matrixId = 'matrix-bh';
      const m = router.initializeMatrix(req);
      m.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
      verifier.batchVerifyTemporalProofs([baseProofRequest('matrix-bh')]);
      expect(verifier.getBatchHistory().length).toBe(1);
    });
  });

  describe('MpcTemporalValidityVerifier — committee aggregation', () => {
    test('aggregates partial signatures', () => {
      const { verifier } = setupAndInitMatrix();
      const result = verifier.aggregatePartialSignatures('matrix-001', [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with insufficient signatures', () => {
      const { verifier } = setupAndInitMatrix();
      expect(() => verifier.aggregatePartialSignatures('matrix-001', [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with banned peer', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      // Ban a peer first
      const proofReq = baseProofRequest(matrix.matrixId);
      proofReq.zkProofHash = null;
      proofReq.peerId = 'bad-peer';
      try { verifier.verifyTemporalProof(proofReq); } catch (e) { /* expected */ }
      expect(verifier.isPeerBanned('bad-peer')).toBe(true);
      expect(() => verifier.aggregatePartialSignatures(matrix.matrixId, [
        { peerId: 'bad-peer', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with no signatures', () => {
      const { verifier } = setupAndInitMatrix();
      expect(() => verifier.aggregatePartialSignatures('matrix-001', []))
        .toThrow(HsmAdapterError);
    });

    test('rejects aggregation with missing matrixId', () => {
      const { verifier } = setupAndInitMatrix();
      expect(() => verifier.aggregatePartialSignatures('', [
        { peerId: 'p1', signature: 's1' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('MpcTemporalValidityVerifier — slashing window validation', () => {
    test('validates proof within slashing window', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      const proofTs = Math.floor(Date.now() / 1000);
      const result = verifier.validateSlashingWindow(matrix.matrixId, proofTs);
      expect(result.withinWindow).toBe(true);
    });

    test('detects proof outside slashing window', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      // Proof timestamp way before release
      const proofTs = matrix.releaseTimestamp - 10000;
      const result = verifier.validateSlashingWindow(matrix.matrixId, proofTs);
      expect(result.withinWindow).toBe(false);
    });

    test('rejects validation for unknown matrix', () => {
      const { verifier } = setupRouterAndVerifier();
      expect(() => verifier.validateSlashingWindow('unknown', 1000))
        .toThrow(HsmAdapterError);
    });

    test('rejects validation with invalid timestamp', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      expect(() => verifier.validateSlashingWindow(matrix.matrixId, 'bad'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('MpcTemporalValidityVerifier — slashing and stats', () => {
    test('records slashes for premature proofs', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      matrix.releaseTimestamp = Math.floor(Date.now() / 1000) + 7200;
      const proofReq = baseProofRequest(matrix.matrixId);
      proofReq.peerId = 'peer-slash';
      try { verifier.verifyTemporalProof(proofReq); } catch (e) { /* expected */ }
      const stats = verifier.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('returns slashed proofs list', () => {
      const { verifier, matrix } = setupAndInitMatrix();
      matrix.releaseTimestamp = Math.floor(Date.now() / 1000) + 7200;
      const proofReq = baseProofRequest(matrix.matrixId);
      proofReq.peerId = 'peer-slash-2';
      try { verifier.verifyTemporalProof(proofReq); } catch (e) { /* expected */ }
      expect(verifier.getSlashedProofs().length).toBeGreaterThan(0);
    });

    test('returns summary stats', () => {
      const { verifier } = setupAndInitMatrix();
      const stats = verifier.getStats();
      expect(stats.totalVerified).toBeDefined();
      expect(stats.totalBatches).toBeDefined();
    });

    test('PROOF_STATUS and SLASH_REASON constants are exported', () => {
      expect(PROOF_STATUS.VERIFIED).toBe('verified');
      expect(PROOF_STATUS.SLASHED).toBe('slashed');
      expect(SLASH_REASON.PREMATURE).toBe('premature_decryption');
      expect(SLASH_REASON.DUPLICATE).toBe('duplicate_proof');
    });
  });

  describe('full Track 62 extended flow', () => {
    test('complete init -> route -> aggregate -> verify -> batch flow', () => {
      const { router, verifier } = setupRouterAndVerifier();
      // Register routing nodes
      router.registerRoutingNode({ nodeId: 'n1', enclaveId: 'e1', region: 'us' });
      router.registerRoutingNode({ nodeId: 'n2', enclaveId: 'e2', region: 'eu' });
      router.registerRoutingNode({ nodeId: 'n3', enclaveId: 'e3', region: 'asia' });
      // Generate lattice key
      router.generateLatticeKeyPair('lk-1');
      // Initialize matrix
      const req = baseInitRequest();
      req.matrixId = 'matrix-full-flow';
      const matrix = router.initializeMatrix(req);
      expect(matrix.latticeTimeLock).toBeDefined();
      expect(matrix.mlKemEnvelope).toBeDefined();
      // Route matrix
      const routeResult = router.routeMatrix('matrix-full-flow');
      expect(routeResult.status).toBe(MATRIX_STATUS.ROUTING);
      // Aggregate committee signatures
      const sigResult = router.aggregateCommitteeSignatures('matrix-full-flow', [
        'sig-a', 'sig-b', 'sig-c', 'sig-d', 'sig-e',
      ]);
      expect(sigResult.signatureCount).toBe(5);
      // Override release timestamp for verification
      matrix.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
      // Verify temporal proof
      const proofResult = verifier.verifyTemporalProof(baseProofRequest('matrix-full-flow'));
      expect(proofResult.status).toBe(PROOF_STATUS.VERIFIED);
      // Validate slashing window
      const windowResult = verifier.validateSlashingWindow(
        'matrix-full-flow',
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      // Verify stats
      const vStats = verifier.getStats();
      expect(vStats.verifyCount).toBeGreaterThan(0);
      const rStats = router.getStats();
      expect(rStats.totalMatrices).toBe(1);
      expect(rStats.totalRoutingNodes).toBe(3);
    });
  });
});
