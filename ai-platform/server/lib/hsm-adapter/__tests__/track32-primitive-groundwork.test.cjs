'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 32 primitive groundwork', () => {
  test('DEFAULT_POLICY exposes ringGating constraints', () => {
    const { DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
    expect(DEFAULT_POLICY.ringGating).toBeDefined();
    expect(DEFAULT_POLICY.ringGating.minRingSize).toBe(16);
    expect(DEFAULT_POLICY.ringGating.maxRingSize).toBe(128);
    expect(DEFAULT_POLICY.ringGating.requireBlindedLinkabilityAttestation).toBe(true);
  });

  test('CryptoPolicyEngine validates ringGating operation', () => {
    const engine = new CryptoPolicyEngine();
    const result = engine.validate('t1', 'ringGating', {
      ringSize: 32,
      blindedLinkabilityAttestation: true,
      attestationAuthority: 'mock-authority',
      blindingType: 'pedersen',
      canonicalPayloadLayout: true,
    });
    expect(result).toBe(true);
  });

  test('ringGating rejects ring size below minimum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'ringGating', {
        ringSize: 8,
        blindedLinkabilityAttestation: true,
        attestationAuthority: 'mock-authority',
        blindingType: 'pedersen',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('RINGGATE_POLICY_VIOLATION');
    }
  });

  test('ringGating rejects ring size above maximum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'ringGating', {
        ringSize: 200,
        blindedLinkabilityAttestation: true,
        attestationAuthority: 'mock-authority',
        blindingType: 'pedersen',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('RINGGATE_POLICY_VIOLATION');
    }
  });

  test('hsm-metrics exposes Track 32 ring counters', () => {
    const all = hsmMetrics.getMetrics();
    expect(typeof all.hsm_ringgate_pool_initialized_total).toBe('number');
    expect(typeof all.hsm_zk_ring_claim_verified_total).toBe('number');
    expect(typeof all.hsm_ring_accreditation_completed_total).toBe('number');
  });
});
