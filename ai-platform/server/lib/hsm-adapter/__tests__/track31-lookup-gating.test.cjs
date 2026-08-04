'use strict';

/**
 * Track 31: Homomorphic Database Lookup Gating Hub — Groundwork tests.
 */

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const { PqcHomomorphicDatabaseLookupGatingHub } = require('../pqc-homomorphic-lookup-gating-hub.cjs');
const { ZkLookupClaimValidator } = require('../zk-lookup-claim-validator.cjs');
const { counters, reset } = require('../hsm-metrics.cjs');

describe('Track 31 lookup gating groundwork', () => {
  test('CryptoPolicyEngine validates compliant lookup gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'lookupGating', {
      lookupQuorum: 12,
      lookupDepth: 16,
      encryptedQueryAttestation: true,
      attestationAuthority: 'mock-authority',
      blindingType: 'pedersen',
      queryAgeSeconds: 30,
      canonicalPayloadLayout: true,
    })).not.toThrow();
  });

  test('CryptoPolicyEngine rejects insufficient lookup quorum', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'lookupGating', {
      lookupQuorum: 5,
    })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine rejects excessive lookup depth', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'lookupGating', {
      lookupDepth: 50,
    })).toThrow(HsmAdapterError);
  });

  test('hsm-metrics exposes Track 31 lookup gate counters', () => {
    expect(typeof counters.hsm_lookupgate_pool_initialized_total).toBe('number');
    expect(typeof counters.hsm_zk_lookup_claim_verified_total).toBe('number');
    expect(typeof counters.hsm_lookup_accreditation_completed_total).toBe('number');
  });
});

describe('Track 31 gating hub & validator', () => {
  beforeEach(() => reset());

  function validClaim() {
    const voters = Array.from({ length: 12 }, (_, i) => `voter-${i}`);
    return {
      voters,
      queryTree: { a: { b: 'leaf' } },
      digest: 'homomorphic-lookup-digest-001',
      attestation: true,
    };
  }

  test('hub advances valid query from OPEN to ACCREDITED', () => {
    const hub = new PqcHomomorphicDatabaseLookupGatingHub({});
    expect(hub.state).toBe('OPEN');
    hub.submitQuery({ encryptedQuery: { table: 'x' }, attestation: true });
    expect(hub.state).toBe('QUERY_BLINDED');
    hub.validateProof(validClaim());
    expect(hub.state).toBe('PROOF_VALIDATED');
    hub.accredit();
    expect(hub.state).toBe('ACCREDITED');
    expect(counters.hsm_lookupgate_pool_initialized_total).toBe(1);
    expect(counters.hsm_zk_lookup_claim_verified_total).toBe(1);
    expect(counters.hsm_lookup_accreditation_completed_total).toBe(1);
  });

  test('validator rejects insufficient quorum', () => {
    const v = new ZkLookupClaimValidator({});
    expect(() => v.validate({ voters: ['a'], attestation: true, digest: 'd' })).toThrow(HsmAdapterError);
  });

  test('validator rejects missing attestation', () => {
    const v = new ZkLookupClaimValidator({});
    const voters = Array.from({ length: 12 }, (_, i) => `voter-${i}`);
    expect(() => v.validate({ voters, attestation: false, digest: 'd' })).toThrow(HsmAdapterError);
  });

  test('validator rejects excessive query depth', () => {
    const v = new ZkLookupClaimValidator({});
    const voters = Array.from({ length: 12 }, (_, i) => `voter-${i}`);
    const deep = { child: null };
    let current = deep;
    for (let i = 0; i < 33; i += 1) {
      current.child = {};
      current = current.child;
    }
    expect(() => v.validate({ voters, attestation: true, digest: 'd', queryTree: deep })).toThrow(HsmAdapterError);
  });

  test('hub blocks out-of-order accreditation', () => {
    const hub = new PqcHomomorphicDatabaseLookupGatingHub({});
    hub.submitQuery({ encryptedQuery: {}, attestation: true });
    expect(() => hub.accredit()).toThrow(HsmAdapterError);
    expect(hub.state).toBe('QUERY_BLINDED');
  });
});
