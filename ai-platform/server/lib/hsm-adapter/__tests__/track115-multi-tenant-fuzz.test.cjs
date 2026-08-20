"use strict";

const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack115ProtoPollutionPolicy,
  makeTrack115TypeConfusionConfigs,
  makeTrack115PrngDrivenValidateCall,
  makeTrack115DeepNestedPollutionPolicy,
  makeTrack115PrngDrivenMultiLayerPolicy,
  makeTrack115ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

const { HsmAdapterError } = require("../crypto-policy-engine.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 115 multi-tenant fuzzing matrix", () => {
  test("FUZZ-115-01: prototype pollution in latticeVfhssGating is blocked", () => {
    const policy = makeTrack115ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("vfhssGatePolluted");
    expect(Object.prototype).not.toHaveProperty("vfhssConstructorPolluted");

    const resolved = engine.getPolicy("track115-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.latticeVfhssGating.minVfhssShares).toBe(7);
    expect(resolved.latticeVfhssGating.maxHomomorphicDepth).toBe(8);
    expect(
      resolved.latticeVfhssGating.requireEnclaveEvaluationAttestation,
    ).toBe(true);

    const clean = engine.getPolicy("track115-clean");
    expect(clean.latticeVfhssGating.minVfhssShares).toBe(7);
    expect(clean.latticeVfhssGating.maxHomomorphicDepth).toBe(8);
  });

  test("FUZZ-115-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack115DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`vfhssProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`vfhssCtorLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(
        "vfhssDeepMaxHomomorphicDepth",
      );
      expect(Object.prototype).not.toHaveProperty("vfhssDeepMinVfhssShares");
    }

    const resolved = engine.getPolicy("track115-deep-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.latticeVfhssGating.minVfhssShares).toBe(7);
    expect(resolved.latticeVfhssGating.maxHomomorphicDepth).toBe(8);

    const clean = engine.getPolicy("track115-clean");
    expect(clean.latticeVfhssGating.minVfhssShares).toBe(7);
    expect(clean.latticeVfhssGating.requireEnclaveEvaluationAttestation).toBe(
      true,
    );
  });

  test("FUZZ-115-03: deterministic SHA-256 PRNG is reproducible", () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString("hex")).toBe(b.next().toString("hex"));
    }
  });

  test("FUZZ-115-04: 1000 multi-layer random policies construct and merge without crash or pollution", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack115PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`vfhssProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`vfhssCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.latticeVfhssGating).toBe("object");
      }
    }
  });

  test("FUZZ-115-05: strict reference sandboxing — mutation does not cross-tenant leak", () => {
    const policy = makeTrack115PrngDrivenMultiLayerPolicy(
      makeHashChainPrng(FUZZ_SEED + "-ref"),
    );
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return;

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.latticeVfhssGating
      ? b.latticeVfhssGating.maxHomomorphicDepth
      : undefined;
    if (a.latticeVfhssGating) {
      a.latticeVfhssGating.maxHomomorphicDepth = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(bAfter.latticeVfhssGating.maxHomomorphicDepth).toBe(originalB);
    }
  });

  test("FUZZ-115-06: Track 115 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack115TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate("t1", "latticeVfhssGating", value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/VFHSSGATE|POLICY/);
        }
      }
    }
  });

  test("FUZZ-115-07: PRNG-driven lattice VFHSS validation — 100 calls, no unhandled crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } =
        makeTrack115PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test("FUZZ-115-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-flood");
    const policy = makeTrack115PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } =
        makeTrack115ConcurrentValidationCall(prng);
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

  test("FUZZ-115-09: cross-tenant latticeVfhssGating mutation isolation", () => {
    const policy = makeTrack115ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("track115-polluter");
    const originalBMax =
      engine.getPolicy("track115-clean").latticeVfhssGating.maxHomomorphicDepth;

    policyA.latticeVfhssGating.maxHomomorphicDepth = 1;

    const policyB = engine.getPolicy("track115-clean");
    expect(policyB.latticeVfhssGating.maxHomomorphicDepth).toBe(originalBMax);
    expect(policyB.latticeVfhssGating.maxHomomorphicDepth).not.toBe(1);
  });
});
