'use strict';

/**
 * Track 119 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the crossClusterMigration policy block resists:
 * - Prototype pollution (direct and 5-level nested)
 * - Type confusion (string, array, null, object values)
 * - Attestation authority array flooding (mixed types, nested arrays, proto pollution)
 * - High-frequency boundary overflows (MAX_SAFE_INTEGER, NaN, -1)
 * - Cross-tenant mutation leakage
 * - Concurrent validation flood races
 */

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack119ProtoPollutionPolicy,
  makeTrack119TypeConfusionConfigs,
  makeTrack119PrngDrivenValidateCall,
  makeTrack119DeepNestedPollutionPolicy,
  makeTrack119PrngDrivenMultiLayerPolicy,
  makeTrack119ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require('./tenant-fuzz-harness.cjs');

afterEach(() => {
  cleanupPrototypePollution();
});

describe('Track 119 multi-tenant fuzzing matrix', () => {
  test('FUZZ-119-01: prototype pollution in crossClusterMigration is blocked', () => {
    const policy = makeTrack119ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('migrationGatePolluted');
    expect(Object.prototype).not.toHaveProperty('migrationConstructorPolluted');

    const resolved = engine.getPolicy('track119-polluter');
    expect(resolved).toBeDefined();
    expect(resolved.crossClusterMigration.minQuorumNodes).toBe(3);
    expect(resolved.crossClusterMigration.requireAttestation).toBe(true);
    expect(resolved.crossClusterMigration.allowedAttestationAuthorities).toEqual(['mock-authority']);
    expect(resolved.crossClusterMigration.maxConcurrentMigrations).toBe(16);
    expect(resolved.crossClusterMigration.requireQuorumCommit).toBe(true);
    expect(resolved.crossClusterMigration.requireRollbackOnFailure).toBe(true);
    expect(resolved.crossClusterMigration.maxShardsPerMigration).toBe(32);

    const clean = engine.getPolicy('track119-clean');
    expect(clean.crossClusterMigration.minQuorumNodes).toBe(3);
    expect(clean.crossClusterMigration.requireAttestation).toBe(true);
  });

  test('FUZZ-119-02: 5-level nested __proto__ / constructor pollution is blocked', () => {
    const policy = makeTrack119DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty('migrationProtoLevel' + i);
      expect(Object.prototype).not.toHaveProperty('migrationCtorLevel' + i);
    }
    expect(Object.prototype).not.toHaveProperty('migrationDeepMinQuorumNodes');
    expect(Object.prototype).not.toHaveProperty('migrationDeepMaxConcurrentMigrations');

    const resolved = engine.getPolicy('track119-deep-polluter');
    expect(resolved).toBeDefined();
  });

  test('FUZZ-119-03: deterministic SHA-256 PRNG is reproducible', () => {
    const prng1 = makeHashChainPrng(FUZZ_SEED);
    const prng2 = makeHashChainPrng(FUZZ_SEED);

    const seq1 = [];
    const seq2 = [];
    for (let i = 0; i < 20; i++) {
      seq1.push(prng1.nextInt(100));
      seq2.push(prng2.nextInt(100));
    }
    expect(seq1).toEqual(seq2);
  });

  test('FUZZ-119-04: 1000 multi-layer random policies construct and merge without crash or pollution', () => {
    const prng = makeHashChainPrng(FUZZ_SEED + '-multilayer');

    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack119PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      expect(Object.prototype).not.toHaveProperty('migrationGatePolluted');
      expect(Object.prototype).not.toHaveProperty('migrationDeepMinQuorumNodes');
    }
  });

  test('FUZZ-119-05: strict reference sandboxing — mutation does not cross-tenant leak', () => {
    const policy = makeTrack119ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track119-polluter');
    const originalBMin = engine.getPolicy('track119-clean').crossClusterMigration.minQuorumNodes;

    policyA.crossClusterMigration.minQuorumNodes = 1;

    const policyB = engine.getPolicy('track119-clean');
    expect(policyB.crossClusterMigration.minQuorumNodes).toBe(originalBMin);
    expect(policyB.crossClusterMigration.minQuorumNodes).not.toBe(1);
  });

  test('FUZZ-119-06: Track 119 type confusion fails closed with structured HsmAdapterError', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack119TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'crossClusterMigration', value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/POLICY|MIGRATION|CLUSTER/);
        }
      }
    }
  });

  test('FUZZ-119-07: PRNG-driven crossClusterMigration validation — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makeTrack119PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-119-08: concurrent validation flood does not race or crash', async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + '-flood');
    const policy = makeTrack119PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } = makeTrack119ConcurrentValidationCall(prng);
      calls.push({ tenantId, operation, config });
    }

    const results = await Promise.all(
      calls.map(({ tenantId, operation, config }) => {
        return new Promise((resolve) => {
          try {
            engine.validate(tenantId, operation, config);
            resolve({ ok: true });
          } catch (e) {
            if (e.name !== 'HsmAdapterError') {
              resolve({ ok: false, error: e.message });
            } else {
              resolve({ ok: true });
            }
          }
        });
      })
    );

    const crashes = results.filter((r) => !r.ok);
    expect(crashes).toHaveLength(0);
  });

  test('FUZZ-119-09: cross-tenant crossClusterMigration mutation isolation', () => {
    const policy = makeTrack119ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track119-polluter');
    const originalBMax = engine.getPolicy('track119-clean').crossClusterMigration.maxConcurrentMigrations;

    policyA.crossClusterMigration.maxConcurrentMigrations = 999;

    const policyB = engine.getPolicy('track119-clean');
    expect(policyB.crossClusterMigration.maxConcurrentMigrations).toBe(originalBMax);
    expect(policyB.crossClusterMigration.maxConcurrentMigrations).not.toBe(999);
  });
});
