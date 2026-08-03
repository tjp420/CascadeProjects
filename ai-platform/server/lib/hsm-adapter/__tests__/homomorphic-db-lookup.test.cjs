'use strict';

/**
 * Track 49: Homomorphic database lookup tests.
 */
const { HomomorphicDbLookupEngine } = require('../homomorphic-db-lookup-engine.cjs');
const { ZkMatchAttestation } = require('../zk-match-attestation.cjs');
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
  maxEncryptedColumnsPerQuery: 8,
  allowedBlindingTypes: ['pedersen', 'exponential-elgamal'],
  requireQueryAttestation: true,
  allowedQueryAuthorities: ['mock-authority'],
  maxQueryAgeSeconds: 60,
  requireZkMatchAttestation: true,
  allowCrossTenantTables: true,
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

function baseQuery() {
  return {
    tenantId: 'tenant-a',
    tableAlias: 'users',
    encryptedFilterHash: 'hash-1',
    requestedColumns: 'id,status',
    queryEpoch: Math.floor(Date.now() / 1000),
    encryptedFilters: [1n, 2n],
    blindingType: 'pedersen',
    attestation: mockAttestation(),
    records: [
      { id: 'r-1', encryptedColumns: [1n, 1n] },
      { id: 'r-2', encryptedColumns: [2n, 3n] },
    ],
  };
}

describe('Track 49 homomorphic DB lookup', () => {
  test('HomomorphicDbLookupEngine returns matching records', () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicDbLookupEngine({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = engine.execute(baseQuery());
    expect(result.matches.length).toBe(2);
    expect(events.some((e) => e.event === 'HOMOMORPHIC_DB_QUERY_INITIATED')).toBe(true);
  });

  test('ZkMatchAttestation generates and verifies a proof', () => {
    const events = [];
    const attestation = new ZkMatchAttestation({
      policy: POLICY,
      audit: (event, info) => events.push({ event, info }),
    });
    const query = baseQuery();
    const matches = [{ recordId: 'r-1' }];
    const proof = attestation.generate(query, matches);
    const result = attestation.verify(query, matches, proof);
    expect(result.verified).toBe(true);
    expect(events.some((e) => e.event === 'ZK_LOOKUP_MATCH_VERIFIED')).toBe(true);
  });

  test('HomomorphicDbLookupEngine rejects un-attested query', () => {
    const attestationClient = new MockAttestationClient();
    const engine = new HomomorphicDbLookupEngine({
      policy: POLICY,
      attestationClient,
    });
    const query = baseQuery();
    query.attestation = { authority: 'bad' };
    expect(() => engine.execute(query)).toThrow(HsmAdapterError);
  });

  test('HomomorphicDbLookupEngine rejects too many encrypted columns', () => {
    const engine = new HomomorphicDbLookupEngine({ policy: POLICY });
    const query = baseQuery();
    query.encryptedFilters = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n];
    expect(() => engine.execute(query)).toThrow(HsmAdapterError);
  });

  test('HomomorphicDbLookupEngine rejects disallowed blinding type', () => {
    const engine = new HomomorphicDbLookupEngine({ policy: POLICY });
    const query = baseQuery();
    query.blindingType = 'plain';
    expect(() => engine.execute(query)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates homomorphic DB lookup configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'homomorphicDbLookup', {
      encryptedColumns: 4,
      blindingType: 'pedersen',
      queryAttestation: true,
      queryAuthority: 'mock-authority',
      queryAgeSeconds: 30,
      zkMatchAttestation: true,
      crossTenantTables: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'homomorphicDbLookup', { encryptedColumns: 10 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { blindingType: 'plain' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { queryAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { queryAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { queryAgeSeconds: 120 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { zkMatchAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'homomorphicDbLookup', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
