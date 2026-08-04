'use strict';

const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack32DeepNestedPollutionPolicy,
  makeTrack32PrngDrivenMultiLayerPolicy,
  makeTrack32ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require('./tenant-fuzz-harness.cjs');

afterEach(() => {
  cleanupPrototypePollution();
});

describe('Track 32 multi-tenant fuzzing matrix', () => {
  test('FUZZ-32-01: 5-level nested __proto__ / constructor pollution is blocked', () => {
    const policy = makeTrack32DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`ringProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`ringCtorLevel${i}`);
      expect(Object.prototype).not.toHaveProperty('ringDeepMinRingSize');
      expect(Object.prototype).not.toHaveProperty('ringDeepMaxRingSize');
    }

    const resolved = engine.getPolicy('track32-deep-polluter');
    expect(resolved).toBeDefined();
    // Top-level ringGating should fall back to defaults, not the deep leaf values
    expect(resolved.ringGating.minRingSize).toBe(16);
    expect(resolved.ringGating.maxRingSize).toBe(128);

    const clean = engine.getPolicy('track32-clean');
    expect(clean.ringGating.minRingSize).toBe(16);
    expect(clean.ringGating.requireBlindedLinkabilityAttestation).toBe(true);
  });

  test('FUZZ-32-02: deterministic SHA-256 PRNG is reproducible', () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString('hex')).toBe(b.next().toString('hex'));
    }
  });

  test('FUZZ-32-03: 1000 multi-layer random policies construct and merge without crash or pollution', () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack32PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`ringProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`ringCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.ringGating).toBe('object');
      }
    }
  });

  test('FUZZ-32-04: strict reference sandboxing — mutation does not cross-tenant leak', () => {
    const policy = makeTrack32PrngDrivenMultiLayerPolicy(makeHashChainPrng(FUZZ_SEED + '-ref'));
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return; // PRNG can produce 2+; if not, skip assertion

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.ringGating ? b.ringGating.minRingSize : undefined;
    if (a.ringGating) {
      a.ringGating.minRingSize = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(bAfter.ringGating.minRingSize).toBe(originalB);
    }
  });

  test('FUZZ-32-05: concurrent validation flood does not race or crash', async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + '-flood');
    const policy = makeTrack32PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } = makeTrack32ConcurrentValidationCall(prng);
      calls.push({ tenantId, operation, config });
    }

    const results = await Promise.all(
      calls.map(({ tenantId, operation, config }) => {
        return new Promise((resolve) => {
          try {
            engine.validate(tenantId, operation, config);
            resolve({ ok: true });
          } catch (e) {
            // HsmAdapterError is expected for policy violations; any other crash is not
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
});
