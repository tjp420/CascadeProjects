'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 115 primitive groundwork', () => {
  test('DEFAULT_POLICY exposes latticeVfhssGating constraints', () => {
    const { DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
    expect(DEFAULT_POLICY.latticeVfhssGating).toBeDefined();
    expect(DEFAULT_POLICY.latticeVfhssGating.minVfhssShares).toBe(7);
    expect(DEFAULT_POLICY.latticeVfhssGating.maxHomomorphicDepth).toBe(8);
    expect(DEFAULT_POLICY.latticeVfhssGating.requireEnclaveEvaluationAttestation).toBe(true);
  });

  test('CryptoPolicyEngine validates latticeVfhssGating operation', () => {
    const engine = new CryptoPolicyEngine();
    const result = engine.validate('t1', 'latticeVfhssGating', {
      vfhssShares: 8,
      homomorphicDepth: 4,
      enclaveEvaluationAttestation: true,
      attestationAuthority: 'mock-authority',
      latticeScheme: 'module-lwr',
      canonicalPayloadLayout: true,
    });
    expect(result).toBe(true);
  });

  test('latticeVfhssGating rejects vfhss shares below minimum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVfhssGating', {
        vfhssShares: 3,
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VFHSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVfhssGating rejects homomorphic depth above maximum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVfhssGating', {
        vfhssShares: 8,
        homomorphicDepth: 16,
        enclaveEvaluationAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VFHSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVfhssGating rejects missing enclave evaluation attestation', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVfhssGating', {
        vfhssShares: 8,
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: false,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VFHSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVfhssGating rejects disallowed lattice scheme', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVfhssGating', {
        vfhssShares: 8,
        homomorphicDepth: 4,
        enclaveEvaluationAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'unsupported-scheme',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VFHSSGATE_POLICY_VIOLATION');
    }
  });

  test('hsm-metrics exposes Track 115 VFHSS counters', () => {
    const all = hsmMetrics.getMetrics();
    expect(typeof all.hsm_vfhssgate_pool_initialized_total).toBe('number');
    expect(typeof all.hsm_zk_vfhss_claim_verified_total).toBe('number');
    expect(typeof all.hsm_vfhss_accreditation_completed_total).toBe('number');
  });
});
