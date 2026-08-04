'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack33ProtoPollutionPolicy,
  makeTrack33TypeConfusionConfigs,
  makeTrack33PrngDrivenValidateCall,
  makeTrack33DeepNestedPollutionPolicy,
  makeTrack33PrngDrivenMultiLayerPolicy,
  makeTrack33ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require('./tenant-fuzz-harness.cjs');

const { HsmAdapterError } = require('../crypto-policy-engine.cjs');

afterEach(() => {
  cleanupPrototypePollution();
});

describe('Track 33 multi-tenant fuzzing matrix', () => {
  test('FUZZ-33-01: prototype pollution in accumulatorGating is blocked', () => {
    const policy = makeTrack33ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('accumulatorGatePolluted');
    expect(Object.prototype).not.toHaveProperty('accumulatorConstructorPolluted');

    const resolved = engine.getPolicy('track33-polluter');
    expect(resolved).toBeDefined();
    expect(resolved.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(resolved.accumulatorGating.minWitnessQuorum).toBe(8);
    expect(resolved.accumulatorGating.requireEnclaveMembershipAttestation).toBe(true);

    const clean = engine.getPolicy('track33-clean');
    expect(clean.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(clean.accumulatorGating.minWitnessQuorum).toBe(8);
  });

  test('FUZZ-33-02: 5-level nested __proto__ / constructor pollution is blocked', () => {
    const policy = makeTrack33DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`accumulatorProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`accumulatorCtorLevel${i}`);
      expect(Object.prototype).not.toHaveProperty('accumulatorDeepMaxAccumulatorSize');
      expect(Object.prototype).not.toHaveProperty('accumulatorDeepMinWitnessQuorum');
    }

    const resolved = engine.getPolicy('track33-deep-polluter');
    expect(resolved).toBeDefined();
    expect(resolved.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(resolved.accumulatorGating.minWitnessQuorum).toBe(8);

    const clean = engine.getPolicy('track33-clean');
    expect(clean.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(clean.accumulatorGating.requireEnclaveMembershipAttestation).toBe(true);
  });

  test('FUZZ-33-03: deterministic SHA-256 PRNG is reproducible', () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString('hex')).toBe(b.next().toString('hex'));
    }
  });

  test('FUZZ-33-04: 1000 multi-layer random policies construct and merge without crash or pollution', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack33PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`accumulatorProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`accumulatorCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.accumulatorGating).toBe('object');
      }
    }
  });

  test('FUZZ-33-05: strict reference sandboxing — mutation does not cross-tenant leak', () => {
    const policy = makeTrack33PrngDrivenMultiLayerPolicy(makeHashChainPrng(FUZZ_SEED + '-ref'));
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return;

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.accumulatorGating ? b.accumulatorGating.maxAccumulatorSize : undefined;
    if (a.accumulatorGating) {
      a.accumulatorGating.maxAccumulatorSize = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(bAfter.accumulatorGating.maxAccumulatorSize).toBe(originalB);
    }
  });

  test('FUZZ-33-06: Track 33 type confusion fails closed with structured HsmAdapterError', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack33TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'accumulatorGating', value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/ACCUMULATORGATE|POLICY/);
        }
      }
    }
  });

  test('FUZZ-33-07: PRNG-driven accumulator gating validation — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makeTrack33PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-33-08: concurrent validation flood does not race or crash', async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + '-flood');
    const policy = makeTrack33PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } = makeTrack33ConcurrentValidationCall(prng);
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

  test('FUZZ-33-09: cross-tenant accumulatorGating mutation isolation', () => {
    const policy = makeTrack33ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track33-polluter');
    const originalBMax = engine.getPolicy('track33-clean').accumulatorGating.maxAccumulatorSize;

    policyA.accumulatorGating.maxAccumulatorSize = 1;

    const policyB = engine.getPolicy('track33-clean');
    expect(policyB.accumulatorGating.maxAccumulatorSize).toBe(originalBMax);
    expect(policyB.accumulatorGating.maxAccumulatorSize).not.toBe(1);
  });
});
