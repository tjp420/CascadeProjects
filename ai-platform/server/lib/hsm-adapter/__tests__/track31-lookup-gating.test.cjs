'use strict';

/**
 * Track 31: Homomorphic Database Lookup Gating Hub — Groundwork tests.
 */

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const { counters } = require('../hsm-metrics.cjs');

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
