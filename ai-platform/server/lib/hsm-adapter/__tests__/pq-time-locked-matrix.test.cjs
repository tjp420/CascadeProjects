'use strict';

/**
 * Track 62: PQ Time-Locked Matrix tests.
 */
const { PqcTimeLockedMatrixRouter } = require('../pqc-time-locked-matrix-router.cjs');
const { MpcTemporalValidityVerifier } = require('../mpc-temporal-validity-verifier.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minTimeDelaySeconds: 3600,
  minCommitteeQuorum: 3,
  maxPayloadBytes: 1048576,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireSubmitterAttestation: true,
  requireVerifierRelayAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banPrematureOrMalformedProofs: true,
  requireCanonicalPayloadLayout: true,
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
  const attestationClient = new MockAttestationClient();
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
  // Override release timestamp to past for valid decryption tests
  matrix.releaseTimestamp = Math.floor(Date.now() / 1000) - 100;
  return { ...ctx, matrix };
}

describe('Track 62 PQ time-locked matrix', () => {
  test('PqcTimeLockedMatrixRouter initializes a matrix and emits TIME_LOCK_MATRIX_INITIALIZED', () => {
    const { events, router } = setupRouterAndVerifier();
    const matrix = router.initializeMatrix(baseInitRequest());
    expect(matrix.status).toBe('locked');
    expect(matrix.matrixId).toBeDefined();
    expect(events.some((e) => e.event === 'TIME_LOCK_MATRIX_INITIALIZED')).toBe(true);
  });

  test('MpcTemporalValidityVerifier verifies a valid temporal proof and emits TEMPORAL_DECRYPTION_PROVE_VERIFIED', () => {
    const { events, verifier, matrix } = setupAndInitMatrix();
    const proof = verifier.verifyTemporalProof(baseProofRequest(matrix.matrixId));
    expect(proof.proofId).toBeDefined();
    expect(events.some((e) => e.event === 'TEMPORAL_DECRYPTION_PROVE_VERIFIED')).toBe(true);
  });

  test('PqcTimeLockedMatrixRouter releases payload after verified temporal duration passes', () => {
    const { verifier, router, matrix } = setupAndInitMatrix();
    expect(router.isReadyForDecryption(matrix.matrixId)).toBe(true);
    verifier.verifyTemporalProof(baseProofRequest(matrix.matrixId));
    expect(matrix.status).toBe('released');
  });

  test('PqcTimeLockedMatrixRouter rejects insufficient committee quorum', () => {
    const router = new PqcTimeLockedMatrixRouter({ policy: POLICY });
    const request = baseInitRequest();
    request.committeeSignatures = ['sig-a'];
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('PqcTimeLockedMatrixRouter rejects time delay below minimum', () => {
    const router = new PqcTimeLockedMatrixRouter({ policy: POLICY });
    const request = baseInitRequest();
    request.timeDelaySeconds = 60;
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('PqcTimeLockedMatrixRouter rejects payload exceeding maximum', () => {
    const router = new PqcTimeLockedMatrixRouter({ policy: POLICY });
    const request = baseInitRequest();
    request.payloadBytes = 2000000;
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('PqcTimeLockedMatrixRouter rejects un-attested submitter', () => {
    const attestationClient = new MockAttestationClient();
    const router = new PqcTimeLockedMatrixRouter({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.submitterAttestation = { authority: 'bad' };
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('MpcTemporalValidityVerifier rejects un-attested verifier relay', () => {
    const { router } = setupAndInitMatrix();
    const attestationClient = new MockAttestationClient();
    const verifier = new MpcTemporalValidityVerifier({ policy: POLICY, router, attestationClient });
    const proofReq = baseProofRequest(router.getMatrixCount() > 0 ? 'matrix-001' : 'matrix-001');
    proofReq.verifierRelayAttestation = { authority: 'bad' };
    expect(() => verifier.verifyTemporalProof(proofReq)).toThrow(HsmAdapterError);
  });

  test('PqcTimeLockedMatrixRouter rejects unpermitted PQC signature scheme', () => {
    const router = new PqcTimeLockedMatrixRouter({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('PqcTimeLockedMatrixRouter rejects duplicate matrix initialization', () => {
    const { router } = setupRouterAndVerifier();
    const request = baseInitRequest();
    request.matrixId = 'matrix-dup';
    router.initializeMatrix(request);
    expect(() => router.initializeMatrix(request)).toThrow(HsmAdapterError);
  });

  test('MpcTemporalValidityVerifier rejects premature decryption attempts', () => {
    const { verifier, matrix } = setupAndInitMatrix();
    // Set release timestamp to future
    matrix.releaseTimestamp = Math.floor(Date.now() / 1000) + 7200;
    const proofReq = baseProofRequest(matrix.matrixId);
    expect(() => verifier.verifyTemporalProof(proofReq)).toThrow(HsmAdapterError);
  });

  test('MpcTemporalValidityVerifier bans peers broadcasting malformed proofs', () => {
    const { verifier, matrix } = setupAndInitMatrix();
    const proofReq = baseProofRequest(matrix.matrixId);
    proofReq.zkProofHash = null;
    proofReq.peerId = 'peer-bad';
    expect(() => verifier.verifyTemporalProof(proofReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('MpcTemporalValidityVerifier bans peers broadcasting premature proofs', () => {
    const { verifier, matrix } = setupAndInitMatrix();
    matrix.releaseTimestamp = Math.floor(Date.now() / 1000) + 7200;
    const proofReq = baseProofRequest(matrix.matrixId);
    proofReq.peerId = 'peer-bad';
    expect(() => verifier.verifyTemporalProof(proofReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('MpcTemporalValidityVerifier bans peers broadcasting duplicate proofs', () => {
    const { verifier, matrix } = setupAndInitMatrix();
    const proofReq = baseProofRequest(matrix.matrixId);
    proofReq.peerId = 'peer-bad';
    verifier.verifyTemporalProof(proofReq);
    const dupReq = baseProofRequest(matrix.matrixId);
    dupReq.peerId = 'peer-bad';
    expect(() => verifier.verifyTemporalProof(dupReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq time-locked matrix configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', {
      timeDelaySeconds: 3600,
      committeeQuorum: 3,
      payloadBytes: 1024,
      pqcSignatureScheme: 'ML-DSA-65',
      submitterAttestation: true,
      verifierRelayAttestation: true,
      attestationAuthority: 'mock-authority',
      banPrematureOrMalformedProofs: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { timeDelaySeconds: 60 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { committeeQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { payloadBytes: 2000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { submitterAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { verifierRelayAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { banPrematureOrMalformedProofs: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTimeLockedMatrix', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
