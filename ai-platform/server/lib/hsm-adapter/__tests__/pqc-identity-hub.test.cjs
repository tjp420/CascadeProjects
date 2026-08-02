'use strict';

/**
 * Track 51: PQC identity hub tests.
 */
const { PqcIdentityHubRouter } = require('../pqc-identity-hub-router.cjs');
const { ThresholdIdentityIssuer } = require('../threshold-identity-issuer.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minIssuanceQuorum: 3,
  maxCommitteeSize: 10,
  kemAlgorithm: 'ML-KEM-1024',
  requireHostAttestation: true,
  requireCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  maxIdentityAgeSeconds: 86400,
  banUnattestedPeers: true,
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

function basePacket() {
  return {
    entityId: 'entity-1',
    kemPublicKey: 'mock-kem-public-key-1024',
    kemAlgorithm: 'ML-KEM-1024',
    registrationEpoch: Math.floor(Date.now() / 1000),
    hostAttestation: mockAttestation(),
  };
}

describe('Track 51 PQC identity hub', () => {
  test('PqcIdentityHubRouter registers a new identity', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const router = new PqcIdentityHubRouter({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const identity = router.register(basePacket());
    expect(identity.status).toBe('registered');
    expect(identity.kemPublicKeyHash).toBeDefined();
    expect(events.some((e) => e.event === 'PQC_IDENTITY_HUB_REGISTERED')).toBe(true);
  });

  test('ThresholdIdentityIssuer reaches quorum and commits', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ThresholdIdentityIssuer({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    issuer.initiate({
      entityId: 'entity-1',
      identityHash: 'hash-1',
      hostAttestation: mockAttestation(),
    });
    issuer.sign('entity-1', 'c-1', mockAttestation(), 'sig-1');
    issuer.sign('entity-1', 'c-2', mockAttestation(), 'sig-2');
    const result = issuer.sign('entity-1', 'c-3', mockAttestation(), 'sig-3');
    expect(result.status).toBe('committed');
    expect(events.some((e) => e.event === 'IDENTITY_ISSUANCE_QUORUM_COMMITTED')).toBe(true);
  });

  test('PqcIdentityHubRouter rejects and bans un-attested host', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const router = new PqcIdentityHubRouter({
      policy: POLICY,
      attestationClient,
    });
    const packet = basePacket();
    packet.hostAttestation = { authority: 'bad' };
    expect(() => router.register(packet)).toThrow(HsmAdapterError);
    expect(router.isBanned('entity-1')).toBe(true);
  });

  test('ThresholdIdentityIssuer rejects un-attested committee member', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const issuer = new ThresholdIdentityIssuer({
      policy: POLICY,
      attestationClient,
    });
    issuer.initiate({
      entityId: 'entity-1',
      identityHash: 'hash-1',
      hostAttestation: mockAttestation(),
    });
    expect(() => issuer.sign('entity-1', 'c-1', { authority: 'bad' }, 'sig-1')).toThrow(HsmAdapterError);
  });

  test('ThresholdIdentityIssuer rejects insufficient quorum', () => {
    const issuer = new ThresholdIdentityIssuer({ policy: POLICY });
    issuer.initiate({
      entityId: 'entity-1',
      identityHash: 'hash-1',
      hostAttestation: mockAttestation(),
    });
    issuer.sign('entity-1', 'c-1', mockAttestation(), 'sig-1');
    const status = issuer.getStatus('entity-1');
    expect(status.status).toBe('pending');
  });

  test('PqcIdentityHubRouter rejects wrong KEM algorithm', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const router = new PqcIdentityHubRouter({
      policy: POLICY,
      attestationClient,
    });
    const packet = basePacket();
    packet.kemAlgorithm = 'ML-KEM-512';
    expect(() => router.register(packet)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates PQC identity hub configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqcIdentityHub', {
      issuanceQuorum: 3,
      committeeSize: 5,
      kemAlgorithm: 'ML-KEM-1024',
      hostAttestation: true,
      committeeAttestation: true,
      attestationAuthority: 'mock-authority',
      identityAgeSeconds: 3600,
      banUnattestedPeers: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqcIdentityHub', { issuanceQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { committeeSize: 20 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { kemAlgorithm: 'ML-KEM-512' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { hostAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { committeeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { identityAgeSeconds: 100000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { banUnattestedPeers: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqcIdentityHub', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
