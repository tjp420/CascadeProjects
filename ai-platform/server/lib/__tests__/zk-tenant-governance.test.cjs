'use strict';

const {
  validateTenantId,
  resolvePolicy,
  trackVerification,
  wrapWithTenantGovernance,
  DEFAULT_TENANT,
} = require('../hsm-adapter/zk-tenant-governance.cjs');
const { CryptoPolicyEngine } = require('../hsm-adapter/crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

describe('Track 125: ZK Tenant Governance', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GOV-01a: valid tenant IDs pass validation', () => {
    expect(validateTenantId('tenant-1')).toBe(true);
    expect(validateTenantId('tenant_1')).toBe(true);
    expect(validateTenantId('a')).toBe(true);
  });

  test('GOV-01b: invalid tenant IDs are rejected', () => {
    expect(validateTenantId('')).toBe(false);
    expect(validateTenantId(null)).toBe(false);
    expect(validateTenantId(123)).toBe(false);
    expect(validateTenantId('../traversal')).toBe(false);
    expect(validateTenantId('tenant with spaces')).toBe(false);
    expect(validateTenantId('a'.repeat(129))).toBe(false);
  });

  test('GOV-02a: resolvePolicy returns domain-specific policy for tenant', () => {
    const engine = new CryptoPolicyEngine();
    const policy = resolvePolicy(engine, 'default', 'energyGating');
    expect(policy).toBeTruthy();
    expect(policy.requireClearingCommitteeAttestation).toBe(true);
    expect(policy.allowedAttestationAuthorities).toBeDefined();
  });

  test('GOV-02b: resolvePolicy throws for invalid tenant ID', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => resolvePolicy(engine, '../bad', 'energyGating')).toThrow('invalid tenant ID');
    expect(hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total).toBe(1);
  });

  test('GOV-02c: resolvePolicy throws for unknown domain', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => resolvePolicy(engine, 'default', 'nonExistentGating')).toThrow('unknown domain');
  });

  test('GOV-02d: resolvePolicy returns biometricGating policy', () => {
    const engine = new CryptoPolicyEngine();
    const policy = resolvePolicy(engine, 'default', 'biometricGating');
    expect(policy.requireClearingCommitteeAttestation).toBe(true);
  });

  test('GOV-02e: resolvePolicy returns neuralGating policy', () => {
    const engine = new CryptoPolicyEngine();
    const policy = resolvePolicy(engine, 'default', 'neuralGating');
    expect(policy.requireNeuralEthicsOversightCommitteeAttestation).toBe(true);
  });

  test('GOV-02f: resolvePolicy returns all 9 new policy sections', () => {
    const engine = new CryptoPolicyEngine();
    const domains = ['energyGating', 'biometricGating', 'neuralGating',
      'storageGating', 'authenticationGating', 'droneGating', 'genomicGating',
      'insuranceGating', 'quantumGating'];
    for (const domain of domains) {
      const policy = resolvePolicy(engine, 'default', domain);
      expect(policy).toBeTruthy();
      expect(policy.allowedAttestationAuthorities).toBeDefined();
    }
  });

  test('GOV-03a: trackVerification increments verified counter', () => {
    trackVerification('energy', 'tenant-1', 'verified');
    expect(hsmMetrics.getMetrics().hsm_zk_energy_claim_verified_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_zk_tenant_context_validated_total).toBe(1);
  });

  test('GOV-03b: trackVerification increments failed counter', () => {
    trackVerification('biometric', 'tenant-1', 'failed');
    expect(hsmMetrics.getMetrics().hsm_zk_biometric_claim_failed_total).toBe(1);
  });

  test('GOV-04a: wrapWithTenantGovernance adds validateTenant method', () => {
    const engine = new CryptoPolicyEngine();
    const mockValidator = {
      policy: {},
      verifyTestClaim: function(req) { return { verified: true, request: req }; },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    expect(typeof mockValidator.validateTenant).toBe('function');
    expect(typeof mockValidator.validate).toBe('function');
  });

  test('GOV-04b: wrapped validator resolves per-tenant policy', () => {
    const engine = new CryptoPolicyEngine();
    let capturedPolicy = null;
    const mockValidator = {
      policy: {},
      verifyTestClaim: function(req) {
        capturedPolicy = this.policy;
        return { verified: true };
      },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    mockValidator.validateTenant('tenant-1', { poolId: 'p1' });
    expect(capturedPolicy).toBeTruthy();
    expect(capturedPolicy.requireClearingCommitteeAttestation).toBe(true);
  });

  test('GOV-04c: wrapped validator restores original policy after call', () => {
    const engine = new CryptoPolicyEngine();
    const originalPolicy = { custom: true };
    const mockValidator = {
      policy: originalPolicy,
      verifyTestClaim: function(req) { return { verified: true }; },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    mockValidator.validateTenant('tenant-1', { poolId: 'p1' });
    expect(mockValidator.policy).toBe(originalPolicy);
  });

  test('GOV-04d: wrapped validator tracks metrics on success', () => {
    const engine = new CryptoPolicyEngine();
    const mockValidator = {
      policy: {},
      verifyTestClaim: function(req) { return { verified: true }; },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    mockValidator.validateTenant('tenant-1', { poolId: 'p1' });
    expect(hsmMetrics.getMetrics().hsm_zk_energy_claim_verified_total).toBe(1);
  });

  test('GOV-04e: wrapped validator tracks metrics on failure and rethrows', () => {
    const engine = new CryptoPolicyEngine();
    const mockValidator = {
      policy: {},
      verifyTestClaim: function(req) { throw new Error('VERIFICATION_FAILED'); },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    expect(() => mockValidator.validateTenant('tenant-1', { poolId: 'p1' })).toThrow('VERIFICATION_FAILED');
    expect(hsmMetrics.getMetrics().hsm_zk_energy_claim_failed_total).toBe(1);
  });

  test('GOV-04f: wrapped validator restores policy even on failure', () => {
    const engine = new CryptoPolicyEngine();
    const originalPolicy = { custom: true };
    const mockValidator = {
      policy: originalPolicy,
      verifyTestClaim: function(req) { throw new Error('FAIL'); },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    try { mockValidator.validateTenant('tenant-1', {}); } catch (e) {}
    expect(mockValidator.policy).toBe(originalPolicy);
  });

  test('GOV-04g: wrapped validator rejects invalid tenant ID', () => {
    const engine = new CryptoPolicyEngine();
    const mockValidator = {
      policy: {},
      verifyTestClaim: function(req) { return { verified: true }; },
    };
    wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
    expect(() => mockValidator.validateTenant('../bad', {})).toThrow('invalid tenant ID');
    expect(hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total).toBe(1);
  });

  describe('MET: hsm-metrics ZK counters', () => {
    test('MET-01: hsm_zk_energy_claim_verified_total exists', () => {
      hsmMetrics.incrementCounter('hsm_zk_energy_claim_verified_total');
      expect(hsmMetrics.getMetrics().hsm_zk_energy_claim_verified_total).toBe(1);
    });

    test('MET-02: hsm_zk_biometric_claim_verified_total exists', () => {
      hsmMetrics.incrementCounter('hsm_zk_biometric_claim_verified_total');
      expect(hsmMetrics.getMetrics().hsm_zk_biometric_claim_verified_total).toBe(1);
    });

    test('MET-03: hsm_zk_tenant_isolation_violation_total exists', () => {
      hsmMetrics.incrementCounter('hsm_zk_tenant_isolation_violation_total');
      expect(hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total).toBe(1);
    });

    test('MET-04: hsm_zk_tenant_context_validated_total exists', () => {
      hsmMetrics.incrementCounter('hsm_zk_tenant_context_validated_total');
      expect(hsmMetrics.getMetrics().hsm_zk_tenant_context_validated_total).toBe(1);
    });

    test('MET-05: all 16 new ZK counters exist', () => {
      const counters = ['hsm_zk_energy_claim_verified_total', 'hsm_zk_energy_claim_failed_total',
        'hsm_zk_biometric_claim_verified_total', 'hsm_zk_biometric_claim_failed_total',
        'hsm_zk_neural_claim_verified_total', 'hsm_zk_neural_claim_failed_total',
        'hsm_zk_lookup_claim_verified_total', 'hsm_zk_lookup_claim_failed_total',
        'hsm_zk_storage_claim_verified_total', 'hsm_zk_storage_claim_failed_total',
        'hsm_zk_authentication_claim_verified_total', 'hsm_zk_authentication_claim_failed_total',
        'hsm_zk_genomic_claim_verified_total', 'hsm_zk_genomic_claim_failed_total',
        'hsm_zk_insurance_claim_verified_total', 'hsm_zk_insurance_claim_failed_total',
        'hsm_zk_quantum_claim_verified_total', 'hsm_zk_quantum_claim_failed_total',
        'hsm_zk_tenant_isolation_violation_total', 'hsm_zk_tenant_context_validated_total'];
      for (const name of counters) {
        hsmMetrics.incrementCounter(name);
        expect(hsmMetrics.getMetrics()[name]).toBe(1);
        hsmMetrics.reset();
      }
    });
  });

  describe('POL: crypto-policy-engine new sections', () => {
    test('POL-01: energyGating exists with correct defaults', () => {
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.energyGating).toBeDefined();
      expect(policy.energyGating.requireClearingCommitteeAttestation).toBe(true);
      expect(policy.energyGating.allowedAttestationAuthorities).toEqual(['mock-authority']);
    });

    test('POL-02: biometricGating exists with correct defaults', () => {
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.biometricGating).toBeDefined();
      expect(policy.biometricGating.requireClearingCommitteeAttestation).toBe(true);
    });

    test('POL-03: neuralGating exists with correct defaults', () => {
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.neuralGating).toBeDefined();
      expect(policy.neuralGating.requireNeuralEthicsOversightCommitteeAttestation).toBe(true);
    });

    test('POL-04: all 9 new policy sections exist', () => {
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      const sections = ['energyGating', 'biometricGating', 'neuralGating',
        'storageGating', 'authenticationGating', 'droneGating', 'genomicGating',
        'insuranceGating', 'quantumGating'];
      for (const section of sections) {
        expect(policy[section]).toBeDefined();
        expect(policy[section].allowedAttestationAuthorities).toBeDefined();
      }
    });
  });

  describe('Security invariants', () => {
    test('SEC-01: path traversal in tenantId is rejected', () => {
      expect(validateTenantId('../../../etc/passwd')).toBe(false);
    });

    test('SEC-02: wrapped validator prevents cross-tenant policy leakage', () => {
      const engine = new CryptoPolicyEngine();
      const mockValidator = {
        policy: {},
        verifyTestClaim: function(req) { return { policy: this.policy }; },
      };
      wrapWithTenantGovernance(mockValidator, engine, 'energyGating', 'verifyTestClaim', 'energy');
      const resultA = mockValidator.validateTenant('tenant-A', {});
      const resultB = mockValidator.validateTenant('tenant-B', {});
      expect(resultA.policy).toEqual(resultB.policy);
      expect(resultA.policy.requireClearingCommitteeAttestation).toBe(true);
    });
  });
});
