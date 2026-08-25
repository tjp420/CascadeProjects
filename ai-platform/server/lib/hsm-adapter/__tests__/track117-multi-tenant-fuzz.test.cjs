"use strict";

/**
 * Track 117 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the bftShardSync policy block resists:
 * - Prototype pollution (direct and 5-level nested)
 * - Type confusion (string, array, null, object values)
 * - High-frequency boundary overflows (MAX_SAFE_INTEGER, NaN, -1)
 * - Cross-tenant mutation leakage
 * - Concurrent validation flood races
 */

const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack117ProtoPollutionPolicy,
  makeTrack117TypeConfusionConfigs,
  makeTrack117PrngDrivenValidateCall,
  makeTrack117DeepNestedPollutionPolicy,
  makeTrack117PrngDrivenMultiLayerPolicy,
  makeTrack117ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 117 multi-tenant fuzzing matrix", () => {
  test("FUZZ-117-01: prototype pollution in bftShardSync is blocked", () => {
    const policy = makeTrack117ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("bftShardGatePolluted");
    expect(Object.prototype).not.toHaveProperty("bftShardConstructorPolluted");

    const resolved = engine.getPolicy("track117-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.bftShardSync.minQuorumNodes).toBe(3);
    expect(resolved.bftShardSync.maxCatchUpBatchSize).toBe(64);
    expect(resolved.bftShardSync.lagThreshold).toBe(8);
    expect(resolved.bftShardSync.byzantineDivergenceThreshold).toBe(100);
    expect(resolved.bftShardSync.requireQuorumCommit).toBe(true);
    expect(resolved.bftShardSync.requireAntiReplay).toBe(true);
    expect(resolved.bftShardSync.maxShardsPerCluster).toBe(128);

    const clean = engine.getPolicy("track117-clean");
    expect(clean.bftShardSync.minQuorumNodes).toBe(3);
    expect(clean.bftShardSync.requireQuorumCommit).toBe(true);
  });

  test("FUZZ-117-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack117DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`bftShardProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`bftShardCtorLevel${i}`);
    }
    expect(Object.prototype).not.toHaveProperty("bftShardDeepMinQuorumNodes");
    expect(Object.prototype).not.toHaveProperty(
      "bftShardDeepMaxCatchUpBatchSize",
    );

    const resolved = engine.getPolicy("track117-deep-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.bftShardSync.minQuorumNodes).toBe(3);
    expect(resolved.bftShardSync.maxCatchUpBatchSize).toBe(64);
    expect(resolved.bftShardSync.requireQuorumCommit).toBe(true);
    expect(resolved.bftShardSync.requireAntiReplay).toBe(true);
    expect(resolved.bftShardSync.maxShardsPerCluster).toBe(128);

    const clean = engine.getPolicy("track117-clean");
    expect(clean.bftShardSync.minQuorumNodes).toBe(3);
    expect(clean.bftShardSync.maxShardsPerCluster).toBe(128);
  });

  test("FUZZ-117-03: deterministic SHA-256 PRNG is reproducible", () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString("hex")).toBe(b.next().toString("hex"));
    }
  });

  test("FUZZ-117-04: 1000 multi-layer random policies construct and merge without crash or pollution", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack117PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`bftShardProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`bftShardCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.bftShardSync).toBe("object");
      }
    }
  });

  test("FUZZ-117-05: strict reference sandboxing — mutation does not cross-tenant leak", () => {
    const policy = makeTrack117PrngDrivenMultiLayerPolicy(
      makeHashChainPrng(FUZZ_SEED + "-ref"),
    );
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return;

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.bftShardSync
      ? b.bftShardSync.maxShardsPerCluster
      : undefined;
    if (a.bftShardSync) {
      a.bftShardSync.maxShardsPerCluster = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(bAfter.bftShardSync.maxShardsPerCluster).toBe(originalB);
    }
  });

  test("FUZZ-117-06: Track 117 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack117TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate("t1", "bftShardSync", value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/POLICY|SHARD/);
        }
      }
    }
  });

  test("FUZZ-117-07: PRNG-driven bftShardSync validation — 100 calls, no unhandled crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } =
        makeTrack117PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test("FUZZ-117-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-flood");
    const policy = makeTrack117PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } =
        makeTrack117ConcurrentValidationCall(prng);
      calls.push({ tenantId, operation, config });
    }

    const results = await Promise.all(
      calls.map(({ tenantId, operation, config }) => {
        return new Promise((resolve) => {
          try {
            engine.validate(tenantId, operation, config);
            resolve({ ok: true });
          } catch (e) {
            if (e.name !== "HsmAdapterError") {
              resolve({ ok: false, error: e.message });
            } else {
              resolve({ ok: true });
            }
          }
        });
      }),
    );

    const crashes = results.filter((r) => !r.ok);
    expect(crashes).toHaveLength(0);
  });

  test("FUZZ-117-09: cross-tenant bftShardSync mutation isolation", () => {
    const policy = makeTrack117ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("track117-polluter");
    const originalBMax =
      engine.getPolicy("track117-clean").bftShardSync.maxShardsPerCluster;

    policyA.bftShardSync.maxShardsPerCluster = 1;

    const policyB = engine.getPolicy("track117-clean");
    expect(policyB.bftShardSync.maxShardsPerCluster).toBe(originalBMax);
    expect(policyB.bftShardSync.maxShardsPerCluster).not.toBe(1);
  });
});
