'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 33 primitive groundwork', () => {
  test('DEFAULT_POLICY exposes accumulatorGating constraints', () => {
    const { DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
    expect(DEFAULT_POLICY.accumulatorGating).toBeDefined();
    expect(DEFAULT_POLICY.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(DEFAULT_POLICY.accumulatorGating.minWitnessQuorum).toBe(8);
    expect(DEFAULT_POLICY.accumulatorGating.requireEnclaveMembershipAttestation).toBe(true);
  });

  test('CryptoPolicyEngine validates accumulatorGating operation', () => {
    const engine = new CryptoPolicyEngine();
    const result = engine.validate('t1', 'accumulatorGating', {
      accumulatorSize: 1024,
      witnessQuorum: 12,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    });
    expect(result).toBe(true);
  });

  test('accumulatorGating rejects accumulator size above maximum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'accumulatorGating', {
        accumulatorSize: 100000,
        witnessQuorum: 12,
        enclaveMembershipAttestation: true,
        attestationAuthority: 'mock-authority',
        accumulatorType: 'rsa-accumulator',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('ACCUMULATORGATE_POLICY_VIOLATION');
    }
  });

  test('accumulatorGating rejects witness quorum below minimum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'accumulatorGating', {
        accumulatorSize: 1024,
        witnessQuorum: 4,
        enclaveMembershipAttestation: true,
        attestationAuthority: 'mock-authority',
        accumulatorType: 'rsa-accumulator',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('ACCUMULATORGATE_POLICY_VIOLATION');
    }
  });

  test('accumulatorGating rejects missing enclave membership attestation', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'accumulatorGating', {
        accumulatorSize: 1024,
        witnessQuorum: 12,
        enclaveMembershipAttestation: false,
        attestationAuthority: 'mock-authority',
        accumulatorType: 'rsa-accumulator',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('ACCUMULATORGATE_POLICY_VIOLATION');
    }
  });

  test('hsm-metrics exposes Track 33 accumulator counters', () => {
    const all = hsmMetrics.getMetrics();
    expect(typeof all.hsm_accumulatorgate_pool_initialized_total).toBe('number');
    expect(typeof all.hsm_zk_accumulator_claim_verified_total).toBe('number');
    expect(typeof all.hsm_accumulator_accreditation_completed_total).toBe('number');
  });
});
