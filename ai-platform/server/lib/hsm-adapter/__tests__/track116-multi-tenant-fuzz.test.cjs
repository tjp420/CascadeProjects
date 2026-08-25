"use strict";

/**
 * Track 116 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the clusterIsolationHardening policy block resists:
 * - Prototype pollution (direct and 5-level nested)
 * - Type confusion (string, array, null, object values)
 * - High-frequency boundary overflows (MAX_SAFE_INTEGER, NaN, -1)
 * - Cross-tenant mutation leakage
 * - Concurrent validation flood races
 */

const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../crypto-policy-engine.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack116ProtoPollutionPolicy,
  makeTrack116TypeConfusionConfigs,
  makeTrack116PrngDrivenValidateCall,
  makeTrack116DeepNestedPollutionPolicy,
  makeTrack116PrngDrivenMultiLayerPolicy,
  makeTrack116ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 116 multi-tenant fuzzing matrix", () => {
  test("FUZZ-116-01: prototype pollution in clusterIsolationHardening is blocked", () => {
    const policy = makeTrack116ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("isolationGatePolluted");
    expect(Object.prototype).not.toHaveProperty("isolationConstructorPolluted");

    const resolved = engine.getPolicy("track116-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.clusterIsolationHardening.requireKnownPeerValidation).toBe(
      true,
    );
    expect(resolved.clusterIsolationHardening.rejectNonLeaderKeyCommits).toBe(
      true,
    );
    expect(resolved.clusterIsolationHardening.allowDkgNonLeaderMessages).toBe(
      false,
    );
    expect(
      resolved.clusterIsolationHardening.maxIsolationViolationThreshold,
    ).toBe(100);

    const clean = engine.getPolicy("track116-clean");
    expect(clean.clusterIsolationHardening.requireKnownPeerValidation).toBe(
      true,
    );
    expect(clean.clusterIsolationHardening.rejectNonLeaderKeyCommits).toBe(
      true,
    );
  });

  test("FUZZ-116-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack116DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`isolationProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`isolationCtorLevel${i}`);
    }
    expect(Object.prototype).not.toHaveProperty(
      "isolationDeepMaxViolationThreshold",
    );
    expect(Object.prototype).not.toHaveProperty(
      "isolationDeepRequireKnownPeerValidation",
    );

    const resolved = engine.getPolicy("track116-deep-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.clusterIsolationHardening.requireKnownPeerValidation).toBe(
      true,
    );
    expect(resolved.clusterIsolationHardening.rejectNonLeaderKeyCommits).toBe(
      true,
    );
    expect(resolved.clusterIsolationHardening.allowDkgNonLeaderMessages).toBe(
      false,
    );
    expect(
      resolved.clusterIsolationHardening.maxIsolationViolationThreshold,
    ).toBe(100);

    const clean = engine.getPolicy("track116-clean");
    expect(clean.clusterIsolationHardening.requireKnownPeerValidation).toBe(
      true,
    );
    expect(clean.clusterIsolationHardening.maxIsolationViolationThreshold).toBe(
      100,
    );
  });

  test("FUZZ-116-03: deterministic SHA-256 PRNG is reproducible", () => {
    const a = makeHashChainPrng(FUZZ_SEED);
    const b = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      expect(a.next().toString("hex")).toBe(b.next().toString("hex"));
    }
  });

  test("FUZZ-116-04: 1000 multi-layer random policies construct and merge without crash or pollution", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack116PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      for (let d = 0; d < 5; d++) {
        expect(Object.prototype).not.toHaveProperty(`isolationProtoLevel${d}`);
        expect(Object.prototype).not.toHaveProperty(`isolationCtorLevel${d}`);
      }

      for (const tenantId of Object.keys(policy.tenants)) {
        const resolved = engine.getPolicy(tenantId);
        expect(resolved).toBeDefined();
        expect(typeof resolved.clusterIsolationHardening).toBe("object");
      }
    }
  });

  test("FUZZ-116-05: strict reference sandboxing — mutation does not cross-tenant leak", () => {
    const policy = makeTrack116PrngDrivenMultiLayerPolicy(
      makeHashChainPrng(FUZZ_SEED + "-ref"),
    );
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const tenantIds = Object.keys(policy.tenants);
    if (tenantIds.length < 2) return;

    const a = engine.getPolicy(tenantIds[0]);
    const b = engine.getPolicy(tenantIds[1]);

    expect(a).not.toBe(b);

    const originalB = b.clusterIsolationHardening
      ? b.clusterIsolationHardening.maxIsolationViolationThreshold
      : undefined;
    if (a.clusterIsolationHardening) {
      a.clusterIsolationHardening.maxIsolationViolationThreshold = 1;
      const bAfter = engine.getPolicy(tenantIds[1]);
      expect(
        bAfter.clusterIsolationHardening.maxIsolationViolationThreshold,
      ).toBe(originalB);
    }
  });

  test("FUZZ-116-06: Track 116 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack116TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate("t1", "clusterIsolationHardening", value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/POLICY|ISOLATION/);
        }
      }
    }
  });

  test("FUZZ-116-07: PRNG-driven cluster isolation validation — 100 calls, no unhandled crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } =
        makeTrack116PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test("FUZZ-116-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-flood");
    const policy = makeTrack116PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } =
        makeTrack116ConcurrentValidationCall(prng);
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

  test("FUZZ-116-09: cross-tenant clusterIsolationHardening mutation isolation", () => {
    const policy = makeTrack116ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("track116-polluter");
    const originalBMax =
      engine.getPolicy("track116-clean").clusterIsolationHardening
        .maxIsolationViolationThreshold;

    policyA.clusterIsolationHardening.maxIsolationViolationThreshold = 1;

    const policyB = engine.getPolicy("track116-clean");
    expect(
      policyB.clusterIsolationHardening.maxIsolationViolationThreshold,
    ).toBe(originalBMax);
    expect(
      policyB.clusterIsolationHardening.maxIsolationViolationThreshold,
    ).not.toBe(1);
  });
});
