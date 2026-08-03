'use strict';

/**
 * Track 60: PQC Homomorphic Identity Bridge tests.
 */
const { PqcHomomorphicIdentityBridgeHub } = require('../pqc-homomorphic-identity-bridge-hub.cjs');
const { MpcHomomorphicConsensusVerifier } = require('../mpc-homomorphic-consensus-verifier.cjs');
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
  minCrossChainQuorum: 3,
  maxHomomorphicMatrixDepth: 32,
  maxIdentityProofWindowSeconds: 86400,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireRouterAttestation: true,
  requireCommitteeVerifierAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderProofs: true,
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
    targetChainId: 'chain-b',
    matrixDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    identityProofWindowSeconds: 3600,
    routerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseAssertionRequest(bridgeId, entityIdHash) {
  return {
    bridgeId,
    entityIdHash,
    thresholdGroupHash: 'group-hash-001',
    zkProofHash: 'zk-proof-hash-001',
    partialSignature: 'partial-sig-001',
    committeeVerifierAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function setupHubAndVerifier() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcHomomorphicIdentityBridgeHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const verifier = new MpcHomomorphicConsensusVerifier({
    policy: POLICY,
    bridge: hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, verifier };
}

describe('Track 60 PQC homomorphic identity bridge', () => {
  test('PqcHomomorphicIdentityBridgeHub initializes a bridge and emits HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED', () => {
    const { events, hub } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    expect(bridge.status).toBe('active');
    expect(bridge.bridgeId).toBeDefined();
    expect(events.some((e) => e.event === 'HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED')).toBe(true);
  });

  test('MpcHomomorphicConsensusVerifier processes a valid cross-chain identity assertion', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    const assertion = verifier.processAssertion(baseAssertionRequest(bridge.bridgeId, 'entity-001'));
    expect(assertion.assertionId).toBeDefined();
    expect(assertion.entityIdHash).toBe('entity-001');
  });

  test('MpcHomomorphicConsensusVerifier finalizes consensus after quorum and emits MPC_CROSS_CHAIN_CONSENSUS_FINALIZED', () => {
    const { events, hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    verifier.processAssertion(baseAssertionRequest(bridge.bridgeId, 'entity-001'));
    verifier.processAssertion(baseAssertionRequest(bridge.bridgeId, 'entity-002'));
    verifier.processAssertion(baseAssertionRequest(bridge.bridgeId, 'entity-003'));
    const result = verifier.checkAndFinalize(bridge.bridgeId);
    expect(result.finalized).toBe(true);
    expect(result.assertionCount).toBe(3);
    expect(events.some((e) => e.event === 'MPC_CROSS_CHAIN_CONSENSUS_FINALIZED')).toBe(true);
  });

  test('MpcHomomorphicConsensusVerifier refuses finalization before quorum', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    verifier.processAssertion(baseAssertionRequest(bridge.bridgeId, 'entity-001'));
    const result = verifier.checkAndFinalize(bridge.bridgeId);
    expect(result.finalized).toBe(false);
  });

  test('PqcHomomorphicIdentityBridgeHub rejects un-attested router', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.routerAttestation = { authority: 'bad' };
    expect(() => hub.initializeBridge(request)).toThrow(HsmAdapterError);
  });

  test('MpcHomomorphicConsensusVerifier rejects un-attested committee verifier', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    const assertReq = baseAssertionRequest(bridge.bridgeId, 'entity-001');
    assertReq.committeeVerifierAttestation = { authority: 'bad' };
    expect(() => verifier.processAssertion(assertReq)).toThrow(HsmAdapterError);
  });

  test('PqcHomomorphicIdentityBridgeHub rejects matrix depth exceeding maximum', () => {
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY });
    const request = baseInitRequest();
    request.matrixDepth = 64;
    expect(() => hub.initializeBridge(request)).toThrow(HsmAdapterError);
  });

  test('PqcHomomorphicIdentityBridgeHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializeBridge(request)).toThrow(HsmAdapterError);
  });

  test('PqcHomomorphicIdentityBridgeHub rejects identity proof window exceeding maximum', () => {
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY });
    const request = baseInitRequest();
    request.identityProofWindowSeconds = 200000;
    expect(() => hub.initializeBridge(request)).toThrow(HsmAdapterError);
  });

  test('PqcHomomorphicIdentityBridgeHub evaluateEncryptedDotProduct computes correctly', () => {
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY });
    const result = hub.evaluateEncryptedDotProduct([1, 2, 3], [4, 5, 6]);
    expect(result).toBe(32);
  });

  test('PqcHomomorphicIdentityBridgeHub evaluateEncryptedDotProduct rejects mismatched vectors', () => {
    const hub = new PqcHomomorphicIdentityBridgeHub({ policy: POLICY });
    expect(() => hub.evaluateEncryptedDotProduct([1, 2], [1, 2, 3])).toThrow(HsmAdapterError);
  });

  test('MpcHomomorphicConsensusVerifier bans peers broadcasting duplicate assertions', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    const assertReq = baseAssertionRequest(bridge.bridgeId, 'entity-001');
    assertReq.peerId = 'peer-bad';
    verifier.processAssertion(assertReq);
    const dupReq = baseAssertionRequest(bridge.bridgeId, 'entity-001');
    dupReq.peerId = 'peer-bad';
    expect(() => verifier.processAssertion(dupReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('MpcHomomorphicConsensusVerifier bans peers broadcasting missing zk proofs', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const bridge = hub.initializeBridge(baseInitRequest());
    const assertReq = baseAssertionRequest(bridge.bridgeId, 'entity-001');
    assertReq.zkProofHash = null;
    assertReq.peerId = 'peer-bad';
    expect(() => verifier.processAssertion(assertReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('MpcHomomorphicConsensusVerifier bans peers voting on inactive bridges', () => {
    const { hub, verifier } = setupHubAndVerifier();
    const assertReq = baseAssertionRequest('nonexistent-bridge', 'entity-001');
    assertReq.peerId = 'peer-bad';
    expect(() => verifier.processAssertion(assertReq)).toThrow(HsmAdapterError);
    expect(verifier.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pqc homomorphic identity bridge configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', {
      crossChainQuorum: 3,
      homomorphicMatrixDepth: 16,
      identityProofWindowSeconds: 3600,
      pqcSignatureScheme: 'ML-DSA-65',
      routerAttestation: true,
      committeeVerifierAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderProofs: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { crossChainQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { homomorphicMatrixDepth: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { identityProofWindowSeconds: 200000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { routerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { committeeVerifierAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { banMalformedOrOutOfOrderProofs: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcHomomorphicIdentityBridge', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
