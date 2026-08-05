'use strict';

const fs = require('fs');
const {
  wrapWithTenantGovernance,
  validateTenantId,
  resolvePolicy,
} = require('../hsm-adapter/zk-tenant-governance.cjs');
const { CryptoPolicyEngine } = require('../hsm-adapter/crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

describe('Track 125: ZK Validator Isolation Integration', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  describe('Validator wrapping integration', () => {
    const validators = [
      { file: 'zk-energy-claim-validator.cjs', class: 'ZkEnergyClaimValidator', method: 'verifyEnergyClaim', domain: 'energyGating', metric: 'energy' },
      { file: 'zk-biometric-claim-validator.cjs', class: 'ZkBiometricClaimValidator', method: 'verifyBiometricClaim', domain: 'biometricGating', metric: 'biometric' },
      { file: 'zk-neural-claim-validator.cjs', class: 'ZkNeuralClaimValidator', method: 'verifyNeuralClaim', domain: 'neuralGating', metric: 'neural' },
      { file: 'zk-lookup-claim-validator.cjs', class: 'ZkLookupClaimValidator', method: 'validate', domain: 'lookupGating', metric: 'lookup' },
      { file: 'zk-storage-claim-validator.cjs', class: 'ZkStorageClaimValidator', method: 'validateClaim', domain: 'storageGating', metric: 'storage' },
      { file: 'zk-authentication-claim-validator.cjs', class: 'ZkAuthenticationClaimValidator', method: 'verifyAuthenticationClaim', domain: 'authenticationGating', metric: 'authentication' },
      { file: 'zk-drone-claim-validator.cjs', class: 'ZkDroneClaimValidator', method: 'validateClaim', domain: 'droneGating', metric: 'drone' },
      { file: 'zk-genomic-claim-validator.cjs', class: 'ZkGenomicClaimValidator', method: 'verifyGenomicClaim', domain: 'genomicGating', metric: 'genomic' },
      { file: 'zk-insurance-claim-validator.cjs', class: 'ZkInsuranceClaimValidator', method: 'verifyClaimAudit', domain: 'insuranceGating', metric: 'insurance' },
      { file: 'zk-quantum-claim-validator.cjs', class: 'ZkQuantumClaimValidator', method: 'verifyQuantumClaim', domain: 'quantumGating', metric: 'quantum' },
    ];

    for (const v of validators) {
      test('MIG: ' + v.class + ' can be wrapped with tenant governance', () => {
        const filePath = __dirname + '/../hsm-adapter/' + v.file;
        expect(fs.existsSync(filePath)).toBe(true);

        const module = require('../hsm-adapter/' + v.file);
        const ValidatorClass = module[v.class];
        expect(ValidatorClass).toBeDefined();

        let instance;
        try {
          instance = new ValidatorClass({ policy: {} });
        } catch (e) {
          instance = new ValidatorClass({});
        }
        expect(instance).toBeTruthy();

        const engine = new CryptoPolicyEngine();
        expect(() => wrapWithTenantGovernance(instance, engine, v.domain, v.method, v.metric)).not.toThrow();
        expect(typeof instance.validateTenant).toBe('function');
      });
    }

    test('MIG: all 10 validator files exist', () => {
      for (const v of validators) {
        const filePath = __dirname + '/../hsm-adapter/' + v.file;
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });

  describe('Energy validator detailed integration', () => {
    test('MIG-01: energy validator with tenant governance resolves per-tenant policy', () => {
      const { ZkEnergyClaimValidator } = require('../hsm-adapter/zk-energy-claim-validator.cjs');
      const engine = new CryptoPolicyEngine();

      const mockHub = { getPool: () => ({ id: 'p1' }), markEnergyClaimVerified: () => {} };
      const validator = new ZkEnergyClaimValidator({
        policy: {},
        hub: mockHub,
        attestationClient: null,
      });

      wrapWithTenantGovernance(validator, engine, 'energyGating', 'verifyEnergyClaim', 'energy');

      expect(typeof validator.validateTenant).toBe('function');
      expect(() => validator.validateTenant('../bad', { poolId: 'p1' })).toThrow('invalid tenant ID');
      expect(hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total).toBe(1);
    });

    test('MIG-01b: energy validator tracks metrics on verification failure', () => {
      const { ZkEnergyClaimValidator } = require('../hsm-adapter/zk-energy-claim-validator.cjs');
      const engine = new CryptoPolicyEngine();

      const validator = new ZkEnergyClaimValidator({ policy: {}, hub: null });
      wrapWithTenantGovernance(validator, engine, 'energyGating', 'verifyEnergyClaim', 'energy');

      expect(() => validator.validateTenant('tenant-1', { poolId: 'p1' })).toThrow();
      expect(hsmMetrics.getMetrics().hsm_zk_energy_claim_failed_total).toBe(1);
    });
  });

  describe('Biometric validator detailed integration', () => {
    test('MIG-02: biometric validator can be wrapped', () => {
      const { ZkBiometricClaimValidator } = require('../hsm-adapter/zk-biometric-claim-validator.cjs');
      const engine = new CryptoPolicyEngine();
      const validator = new ZkBiometricClaimValidator({ policy: {} });
      wrapWithTenantGovernance(validator, engine, 'biometricGating', 'verifyBiometricClaim', 'biometric');
      expect(typeof validator.validateTenant).toBe('function');
    });
  });

  describe('Neural validator detailed integration', () => {
    test('MIG-03: neural validator can be wrapped', () => {
      const { ZkNeuralClaimValidator } = require('../hsm-adapter/zk-neural-claim-validator.cjs');
      const engine = new CryptoPolicyEngine();
      const validator = new ZkNeuralClaimValidator({ policy: {} });
      wrapWithTenantGovernance(validator, engine, 'neuralGating', 'verifyNeuralClaim', 'neural');
      expect(typeof validator.validateTenant).toBe('function');
    });
  });

  describe('Policy engine integration', () => {
    test('POL: all 9 new policy sections are accessible via getPolicy', () => {
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      const sections = ['energyGating', 'biometricGating', 'neuralGating',
        'storageGating', 'authenticationGating', 'droneGating', 'genomicGating',
        'insuranceGating', 'quantumGating'];
      for (const section of sections) {
        expect(policy[section]).toBeDefined();
        expect(policy[section].requireCanonicalPayloadLayout).toBe(true);
      }
    });

    test('POL: per-tenant policy isolation works', () => {
      const engine = new CryptoPolicyEngine();
      const defaultPolicy = engine.getPolicy('default');
      expect(defaultPolicy.energyGating).toBeDefined();

      const customPolicy = engine.getPolicy('tenant-X');
      expect(customPolicy.energyGating).toBeDefined();
      expect(customPolicy.energyGating.requireClearingCommitteeAttestation).toBe(
        defaultPolicy.energyGating.requireClearingCommitteeAttestation
      );
    });
  });

  describe('Backward compatibility', () => {
    test('BC-01: validators still work without tenant governance (original method)', () => {
      const { ZkEnergyClaimValidator } = require('../hsm-adapter/zk-energy-claim-validator.cjs');
      const validator = new ZkEnergyClaimValidator({ policy: { requireClearingCommitteeAttestation: false } });
      expect(typeof validator.verifyEnergyClaim).toBe('function');
      expect(validator.validateTenant).toBeUndefined();
    });

    test('BC-02: existing governed validators (ring, accumulator) still work', () => {
      const { ZkRingClaimValidator } = require('../hsm-adapter/zk-ring-claim-validator.cjs');
      const { ZkAccumulatorClaimValidator } = require('../hsm-adapter/zk-accumulator-claim-validator.cjs');
      const engine = new CryptoPolicyEngine();

      const ringValidator = new ZkRingClaimValidator(engine);
      expect(typeof ringValidator.validate).toBe('function');

      const accumulatorValidator = new ZkAccumulatorClaimValidator(engine);
      expect(typeof accumulatorValidator.validate).toBe('function');
    });
  });
});
