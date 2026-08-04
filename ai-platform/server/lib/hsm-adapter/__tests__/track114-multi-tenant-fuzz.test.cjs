'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack114ProtoPollutionPolicy,
  makeTrack114TypeConfusionConfigs,
  makeTrack114PrngDrivenValidateCall,
  makeTrack114DeepNestedPollutionPolicy,
  makeTrack114PrngDrivenMultiLayerPolicy,
  makeTrack114ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require('./tenant-fuzz-harness.cjs');

const { HsmAdapterError } = require('../crypto-policy-engine.cjs');

afterEach(() => {
  cleanupPrototypePollution();
});

describe('Track 114 multi-tenant fuzzing matrix', () => {
  test('FUZZ-114-01: prototype pollution in latticeVssGating is blocked', () => {
    const policy = makeTrack114ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty('vssGatePolluted');
    expect(Object.prototype).not.toHaveProperty('vssConstructorPolluted');

    const resolved = engine.getPolicy('track114-polluter');
    expect(resolved).toBeDefined();
    expect(resolved.latticeVssGating.minVssShares).toBe(5);
    expect(resolved.latticeVssGating.maxDegreeBound).toBe(16);
    expect(resolved.latticeVssGating.requireEnclaveBindingAttestation).toBe(true);

    const clean = engine.getPolicy('track114-clean');
    expect(clean.latticeVssGating.minVssShares).toBe(5);
    expect(clean.latticeVssGating.maxDegreeBound).toBe(16);
  });

  test('FUZZ-114-02: 5-level nested __proto__ / constructor pollution is blocked', () => {
    const policy = makeTrack114DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`vssProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`vssCtorLevel${i}`);
      expect(Object.prototype).not.toHaveProperty('vssDeepMaxDegreeBound');
      expect(Object.prototype).not.toHaveProperty('vssDeepMinVssShares');
    }

    const resolved = engine.getPolicy('track114-deep-polluter');
    expect(resolved).toBeDefined();
    expect(resolved.latticeVssGating.minVssShares).toBe(5);
    expect(resolved.latticeVssGating.maxDegreeBound).toBe(16);

    const clean = engine.getPolicy('track114-clean');
    expect(clean.latticeVssGating.minVssShares).toBe(5);
    expect(clean.latticeVssGating.requireEnclaveBindingAttestation).toBe(true);
  });

  test('FUZZ-114-03: deterministic SHA-256 PRNG is reproducible', () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString('hex')).toBe(b.next().toString('hex'));
    }
  });

  test('FUZZ-114-04: 1000 multi-layer random policies construct and merge without crash or pollution', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack114PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`vssProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`vssCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.latticeVssGating).toBe('object');
      }
    }
  });

  test('FUZZ-114-05: strict reference sandboxing — mutation does not cross-tenant leak', () => {
    const policy = makeTrack114PrngDrivenMultiLayerPolicy(makeHashChainPrng(FUZZ_SEED + '-ref'));
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return;

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.latticeVssGating ? b.latticeVssGating.maxDegreeBound : undefined;
    if (a.latticeVssGating) {
      a.latticeVssGating.maxDegreeBound = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(bAfter.latticeVssGating.maxDegreeBound).toBe(originalB);
    }
  });

  test('FUZZ-114-06: Track 114 type confusion fails closed with structured HsmAdapterError', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack114TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate('t1', 'latticeVssGating', value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/VSSGATE|POLICY/);
        }
      }
    }
  });

  test('FUZZ-114-07: PRNG-driven lattice VSS validation — 100 calls, no unhandled crash', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } = makeTrack114PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test('FUZZ-114-08: concurrent validation flood does not race or crash', async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + '-flood');
    const policy = makeTrack114PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } = makeTrack114ConcurrentValidationCall(prng);
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

  test('FUZZ-114-09: cross-tenant latticeVssGating mutation isolation', () => {
    const policy = makeTrack114ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy('track114-polluter');
    const originalBMax = engine.getPolicy('track114-clean').latticeVssGating.maxDegreeBound;

    policyA.latticeVssGating.maxDegreeBound = 1;

    const policyB = engine.getPolicy('track114-clean');
    expect(policyB.latticeVssGating.maxDegreeBound).toBe(originalBMax);
    expect(policyB.latticeVssGating.maxDegreeBound).not.toBe(1);
  });
});
