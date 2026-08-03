'use strict';

/**
 * Track 52: ZK access token attestation tests.
 */
const { ZkAccessTokenBroker } = require('../zk-access-token-broker.cjs');
const { ZkAttestationContractVerifier } = require('../zk-attestation-contract-verifier.cjs');
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
  minSignatureQuorum: 3,
  maxTokenLifetimeSeconds: 3600,
  permittedCurves: ['P-256', 'P-384', 'P-521'],
  requireBrokerAttestation: true,
  requireVerifierAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banExpiredProofNodes: true,
  maxScopesPerToken: 8,
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

function baseRequest() {
  return {
    tokenId: 'token-1',
    scopes: ['read', 'write'],
    curve: 'P-256',
    tokenLifetimeSeconds: 3600,
    brokerAttestation: mockAttestation(),
  };
}

describe('Track 52 ZK access token attestation', () => {
  test('ZkAccessTokenBroker issues a token with quorum', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const broker = new ZkAccessTokenBroker({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const token = broker.issue(baseRequest());
    expect(token.status).toBe('pending');
    expect(events.some((e) => e.event === 'ZK_ACCESS_TOKEN_ISSUED')).toBe(true);

    broker.sign('token-1', 'c-1', 'sig-1');
    broker.sign('token-1', 'c-2', 'sig-2');
    const result = broker.sign('token-1', 'c-3', 'sig-3');
    expect(result.status).toBe('issued');
  });

  test('ZkAttestationContractVerifier generates and verifies a proof', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const broker = new ZkAccessTokenBroker({
      policy: POLICY,
      attestationClient,
    });
    const token = broker.issue(baseRequest());
    broker.sign('token-1', 'c-1', 'sig-1');
    broker.sign('token-1', 'c-2', 'sig-2');
    broker.sign('token-1', 'c-3', 'sig-3');

    const verifier = new ZkAttestationContractVerifier({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const proof = verifier.generate(token);
    const result = verifier.verify(token, proof, mockAttestation());
    expect(result.verified).toBe(true);
    expect(events.some((e) => e.event === 'ATTESTATION_CONTRACT_VERIFIED')).toBe(true);
  });

  test('ZkAccessTokenBroker rejects un-attested broker', () => {
    const attestationClient = new MockAttestationClient();
    const broker = new ZkAccessTokenBroker({
      policy: POLICY,
      attestationClient,
    });
    const request = baseRequest();
    request.brokerAttestation = { authority: 'bad' };
    expect(() => broker.issue(request)).toThrow(HsmAdapterError);
  });

  test('ZkAccessTokenBroker rejects too many scopes', () => {
    const broker = new ZkAccessTokenBroker({ policy: POLICY });
    const request = baseRequest();
    request.scopes = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
    expect(() => broker.issue(request)).toThrow(HsmAdapterError);
  });

  test('ZkAccessTokenBroker rejects disallowed curve', () => {
    const broker = new ZkAccessTokenBroker({ policy: POLICY });
    const request = baseRequest();
    request.curve = 'secp256k1';
    expect(() => broker.issue(request)).toThrow(HsmAdapterError);
  });

  test('ZkAttestationContractVerifier rejects expired token and bans node', () => {
    const attestationClient = new MockAttestationClient();
    const broker = new ZkAccessTokenBroker({
      policy: POLICY,
      attestationClient,
    });
    const token = broker.issue(baseRequest());
    token.nodeId = 'node-bad';
    token.expiryEpoch = 1;
    token.status = 'issued';

    const verifier = new ZkAttestationContractVerifier({
      policy: POLICY,
      attestationClient,
    });
    const proof = verifier.generate(token);
    expect(() => verifier.verify(token, proof, mockAttestation(), 9999)).toThrow(HsmAdapterError);
    expect(verifier.isBanned('node-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates ZK token attestation configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'zkTokenAttestation', {
      signatureQuorum: 3,
      tokenLifetimeSeconds: 3600,
      curve: 'P-256',
      brokerAttestation: true,
      verifierAttestation: true,
      attestationAuthority: 'mock-authority',
      scopesPerToken: 4,
      banExpiredProofNodes: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'zkTokenAttestation', { signatureQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { tokenLifetimeSeconds: 7200 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { curve: 'secp256k1' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { brokerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { verifierAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { scopesPerToken: 10 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { banExpiredProofNodes: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'zkTokenAttestation', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
