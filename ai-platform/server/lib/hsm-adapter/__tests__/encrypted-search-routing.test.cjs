'use strict';

/**
 * Track 56: Encrypted search routing tests.
 */
const { EncryptedSearchRouter } = require('../encrypted-search-router.cjs');
const { MpcSearchMatchVerifier } = require('../mpc-search-match-verifier.cjs');
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
  maxKeywordsPerQuery: 32,
  maxIndexTraversalDepth: 16,
  allowedBlindingCurves: ['P-256', 'P-384', 'P-521'],
  requireSubmitterAttestation: true,
  requireIndexNodeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  minVerificationQuorum: 3,
  isolateLowQuorumIndexNodes: true,
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

function baseIndexNodes() {
  return [
    { nodeId: 'idx-a', attestation: mockAttestation() },
    { nodeId: 'idx-b', attestation: mockAttestation() },
    { nodeId: 'idx-c', attestation: mockAttestation() },
  ];
}

function baseRouteRequest() {
  return {
    sourceTenantId: 'tenant-a',
    keywords: ['keyword-1', 'keyword-2'],
    indexNodes: baseIndexNodes(),
    traversalDepth: 4,
    blindingCurve: 'P-256',
    submitterAttestation: mockAttestation(),
  };
}

describe('Track 56 encrypted search routing', () => {
  test('EncryptedSearchRouter routes an encrypted search query', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const router = new EncryptedSearchRouter({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const query = router.route(baseRouteRequest());
    expect(query.status).toBe('routed');
    expect(query.queryId).toBeDefined();
    expect(events.some((e) => e.event === 'ENCRYPTED_SEARCH_ROUTED')).toBe(true);
  });

  test('MpcSearchMatchVerifier aggregates evaluations and verifies match', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const router = new EncryptedSearchRouter({
      policy: POLICY,
      attestationClient,
    });
    const query = router.route(baseRouteRequest());
    const verifier = new MpcSearchMatchVerifier({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const session = verifier.initiate({
      verificationId: 'verify-1',
      query,
      committeeNodes: baseIndexNodes(),
    });
    expect(session.status).toBe('pending');
    verifier.submit('verify-1', 'idx-a', 'eval-a');
    verifier.submit('verify-1', 'idx-b', 'eval-b');
    const result = verifier.submit('verify-1', 'idx-c', 'eval-c');
    expect(result.status).toBe('verified');
    expect(events.some((e) => e.event === 'MPC_INDEX_MATCH_VERIFIED')).toBe(true);
  });

  test('EncryptedSearchRouter rejects un-attested submitter', () => {
    const attestationClient = new MockAttestationClient();
    const router = new EncryptedSearchRouter({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRouteRequest();
    request.submitterAttestation = { authority: 'bad' };
    expect(() => router.route(request)).toThrow(HsmAdapterError);
  });

  test('EncryptedSearchRouter rejects un-attested index node', () => {
    const attestationClient = new MockAttestationClient();
    const router = new EncryptedSearchRouter({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRouteRequest();
    request.indexNodes[0].attestation = { authority: 'bad' };
    expect(() => router.route(request)).toThrow(HsmAdapterError);
  });

  test('EncryptedSearchRouter rejects excessive keywords per query', () => {
    const router = new EncryptedSearchRouter({ policy: POLICY });
    const request = baseRouteRequest();
    request.keywords = Array(40).fill('kw');
    expect(() => router.route(request)).toThrow(HsmAdapterError);
  });

  test('EncryptedSearchRouter rejects traversal depth exceeding maximum', () => {
    const router = new EncryptedSearchRouter({ policy: POLICY });
    const request = baseRouteRequest();
    request.traversalDepth = 32;
    expect(() => router.route(request)).toThrow(HsmAdapterError);
  });

  test('EncryptedSearchRouter rejects unpermitted blinding curve', () => {
    const router = new EncryptedSearchRouter({ policy: POLICY });
    const request = baseRouteRequest();
    request.blindingCurve = 'secp256k1';
    expect(() => router.route(request)).toThrow(HsmAdapterError);
  });

  test('MpcSearchMatchVerifier isolates low quorum committee nodes', () => {
    const verifier = new MpcSearchMatchVerifier({ policy: POLICY });
    expect(() => verifier.initiate({
      verificationId: 'verify-bad',
      query: { queryId: 'q1' },
      committeeNodes: [
        { nodeId: 'idx-a', attestation: mockAttestation() },
        { nodeId: 'idx-b', attestation: mockAttestation() },
      ],
    })).toThrow(HsmAdapterError);
    expect(verifier.isNodeIsolated('idx-a')).toBe(true);
    expect(verifier.isNodeIsolated('idx-b')).toBe(true);
  });

  test('MpcSearchMatchVerifier rejects unauthorized node submission', () => {
    const attestationClient = new MockAttestationClient();
    const verifier = new MpcSearchMatchVerifier({
      policy: POLICY,
      attestationClient,
    });
    verifier.initiate({
      verificationId: 'verify-2',
      query: { queryId: 'q1' },
      committeeNodes: baseIndexNodes(),
    });
    expect(() => verifier.submit('verify-2', 'idx-unknown', 'eval')).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates encrypted search routing configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'encryptedSearchRouting', {
      keywordsPerQuery: 10,
      indexTraversalDepth: 8,
      blindingCurve: 'P-256',
      submitterAttestation: true,
      indexNodeAttestation: true,
      attestationAuthority: 'mock-authority',
      verificationQuorum: 3,
      isolateLowQuorumIndexNodes: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'encryptedSearchRouting', { keywordsPerQuery: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { indexTraversalDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { blindingCurve: 'secp256k1' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { submitterAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { indexNodeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { verificationQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { isolateLowQuorumIndexNodes: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'encryptedSearchRouting', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
