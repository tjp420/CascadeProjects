'use strict';

/**
 * Track 53: Homomorphic key sharding tests.
 */
const { HomomorphicKeyShardDisperser } = require('../homomorphic-key-shard-disperser.cjs');
const { MultiPlatformShardCombiner } = require('../multi-platform-shard-combiner.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minTargetPlatformQuorum: 3,
  maxShardDepth: 8,
  signatureTimeoutSeconds: 300,
  requireLocalNodeAttestation: true,
  requireDestinationAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  kemAlgorithm: 'ML-KEM-1024',
  isolateLowQuorumDestinations: true,
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

function baseDestinations() {
  return [
    { platformId: 'platform-a', destinationAttestation: mockAttestation() },
    { platformId: 'platform-b', destinationAttestation: mockAttestation() },
    { platformId: 'platform-c', destinationAttestation: mockAttestation() },
  ];
}

function baseDisperseRequest() {
  return {
    sourcePlatformId: 'platform-source',
    destinations: baseDestinations(),
    kemAlgorithm: 'ML-KEM-1024',
    shardDepth: 4,
    localNodeAttestation: mockAttestation(),
  };
}

describe('Track 53 homomorphic key sharding', () => {
  test('HomomorphicKeyShardDisperser disperses shards to multiple platforms', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const disperser = new HomomorphicKeyShardDisperser({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = disperser.disperse(baseDisperseRequest());
    expect(result.dispersed).toBe(3);
    expect(result.shards.length).toBe(3);
    expect(events.filter((e) => e.event === 'HOMOMORPHIC_SHARD_DISPERSED').length).toBe(3);
  });

  test('MultiPlatformShardCombiner aggregates evaluations and verifies', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const disperser = new HomomorphicKeyShardDisperser({
      policy: POLICY,
      attestationClient,
    });
    const result = disperser.disperse(baseDisperseRequest());
    const combiner = new MultiPlatformShardCombiner({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const session = combiner.initiate({
      combinationId: 'combo-1',
      shards: result.shards,
    });
    expect(session.status).toBe('pending');
    const now = Math.floor(Date.now() / 1000);
    combiner.submit('combo-1', 'platform-a', mockAttestation(), 'eval-a', now);
    combiner.submit('combo-1', 'platform-b', mockAttestation(), 'eval-b', now);
    const final = combiner.submit('combo-1', 'platform-c', mockAttestation(), 'eval-c', now);
    expect(final.status).toBe('verified');
    expect(events.some((e) => e.event === 'CROSS_PLATFORM_COMBINER_VERIFIED')).toBe(true);
  });

  test('HomomorphicKeyShardDisperser rejects un-attested local node', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const disperser = new HomomorphicKeyShardDisperser({
      policy: POLICY,
      attestationClient,
    });
    const request = baseDisperseRequest();
    request.localNodeAttestation = { authority: 'bad' };
    expect(() => disperser.disperse(request)).toThrow(HsmAdapterError);
  });

  test('HomomorphicKeyShardDisperser rejects un-attested destination', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const disperser = new HomomorphicKeyShardDisperser({
      policy: POLICY,
      attestationClient,
    });
    const request = baseDisperseRequest();
    request.destinations[0].destinationAttestation = { authority: 'bad' };
    expect(() => disperser.disperse(request)).toThrow(HsmAdapterError);
  });

  test('HomomorphicKeyShardDisperser rejects insufficient target quorum', () => {
    const disperser = new HomomorphicKeyShardDisperser({ policy: POLICY });
    const request = baseDisperseRequest();
    request.destinations = [baseDestinations()[0]];
    expect(() => disperser.disperse(request)).toThrow(HsmAdapterError);
  });

  test('HomomorphicKeyShardDisperser rejects shard depth exceeding maximum', () => {
    const disperser = new HomomorphicKeyShardDisperser({ policy: POLICY });
    const request = baseDisperseRequest();
    request.shardDepth = 16;
    expect(() => disperser.disperse(request)).toThrow(HsmAdapterError);
  });

  test('HomomorphicKeyShardDisperser rejects wrong KEM algorithm', () => {
    const disperser = new HomomorphicKeyShardDisperser({ policy: POLICY });
    const request = baseDisperseRequest();
    request.kemAlgorithm = 'ML-KEM-512';
    expect(() => disperser.disperse(request)).toThrow(HsmAdapterError);
  });

  test('MultiPlatformShardCombiner isolates low quorum destinations', () => {
    const combiner = new MultiPlatformShardCombiner({ policy: POLICY });
    expect(() => combiner.initiate({
      combinationId: 'combo-bad',
      shards: [
        { destinationPlatformId: 'platform-a' },
        { destinationPlatformId: 'platform-b' },
      ],
    })).toThrow(HsmAdapterError);
    expect(combiner.isIsolated('platform-a')).toBe(true);
    expect(combiner.isIsolated('platform-b')).toBe(true);
  });

  test('MultiPlatformShardCombiner rejects expired signatures', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const disperser = new HomomorphicKeyShardDisperser({
      policy: POLICY,
      attestationClient,
    });
    const result = disperser.disperse(baseDisperseRequest());
    const combiner = new MultiPlatformShardCombiner({
      policy: POLICY,
      attestationClient,
    });
    combiner.initiate({ combinationId: 'combo-2', shards: result.shards });
    expect(() => combiner.submit('combo-2', 'platform-a', mockAttestation(), 'eval-a', 1)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates homomorphic key sharding configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'homomorphicKeySharding', {
      targetPlatformQuorum: 3,
      shardDepth: 4,
      signatureAgeSeconds: 100,
      localNodeAttestation: true,
      destinationAttestation: true,
      attestationAuthority: 'mock-authority',
      kemAlgorithm: 'ML-KEM-1024',
      isolateLowQuorumDestinations: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'homomorphicKeySharding', { targetPlatformQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { shardDepth: 16 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { signatureAgeSeconds: 600 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { localNodeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { destinationAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { kemAlgorithm: 'ML-KEM-512' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { isolateLowQuorumDestinations: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicKeySharding', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
