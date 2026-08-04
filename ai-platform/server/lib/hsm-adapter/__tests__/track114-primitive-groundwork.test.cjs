'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 114 primitive groundwork', () => {
  test('DEFAULT_POLICY exposes latticeVssGating constraints', () => {
    const { DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
    expect(DEFAULT_POLICY.latticeVssGating).toBeDefined();
    expect(DEFAULT_POLICY.latticeVssGating.minVssShares).toBe(5);
    expect(DEFAULT_POLICY.latticeVssGating.maxDegreeBound).toBe(16);
    expect(DEFAULT_POLICY.latticeVssGating.requireEnclaveBindingAttestation).toBe(true);
  });

  test('CryptoPolicyEngine validates latticeVssGating operation', () => {
    const engine = new CryptoPolicyEngine();
    const result = engine.validate('t1', 'latticeVssGating', {
      vssShares: 8,
      degreeBound: 8,
      enclaveBindingAttestation: true,
      attestationAuthority: 'mock-authority',
      latticeScheme: 'module-lwr',
      canonicalPayloadLayout: true,
    });
    expect(result).toBe(true);
  });

  test('latticeVssGating rejects vss shares below minimum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVssGating', {
        vssShares: 3,
        degreeBound: 8,
        enclaveBindingAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVssGating rejects degree bound above maximum', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVssGating', {
        vssShares: 8,
        degreeBound: 32,
        enclaveBindingAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVssGating rejects missing enclave binding attestation', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVssGating', {
        vssShares: 8,
        degreeBound: 8,
        enclaveBindingAttestation: false,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'module-lwr',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VSSGATE_POLICY_VIOLATION');
    }
  });

  test('latticeVssGating rejects disallowed lattice scheme', () => {
    const engine = new CryptoPolicyEngine();
    try {
      engine.validate('t1', 'latticeVssGating', {
        vssShares: 8,
        degreeBound: 8,
        enclaveBindingAttestation: true,
        attestationAuthority: 'mock-authority',
        latticeScheme: 'unsupported-scheme',
        canonicalPayloadLayout: true,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('VSSGATE_POLICY_VIOLATION');
    }
  });

  test('hsm-metrics exposes Track 114 VSS counters', () => {
    const all = hsmMetrics.getMetrics();
    expect(typeof all.hsm_vssgate_pool_initialized_total).toBe('number');
    expect(typeof all.hsm_zk_vss_claim_verified_total).toBe('number');
    expect(typeof all.hsm_vss_accreditation_completed_total).toBe('number');
  });
});
