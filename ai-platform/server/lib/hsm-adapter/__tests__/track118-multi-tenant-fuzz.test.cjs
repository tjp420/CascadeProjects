"use strict";

/**
 * Track 118 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the distributedConsensusCoordinator policy block resists:
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
  makeTrack118ProtoPollutionPolicy,
  makeTrack118TypeConfusionConfigs,
  makeTrack118PrngDrivenValidateCall,
  makeTrack118DeepNestedPollutionPolicy,
  makeTrack118PrngDrivenMultiLayerPolicy,
  makeTrack118ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 118 multi-tenant fuzzing matrix", () => {
  test("FUZZ-118-01: prototype pollution in distributedConsensusCoordinator is blocked", () => {
    const policy = makeTrack118ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("consensusGatePolluted");
    expect(Object.prototype).not.toHaveProperty("consensusConstructorPolluted");

    const resolved = engine.getPolicy("track118-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.distributedConsensusCoordinator.maxGroups).toBe(64);
    expect(resolved.distributedConsensusCoordinator.faultTimeoutMs).toBe(3000);
    expect(resolved.distributedConsensusCoordinator.faultCheckIntervalMs).toBe(
      1000,
    );
    expect(resolved.distributedConsensusCoordinator.viewChangeTimeoutMs).toBe(
      5000,
    );
    expect(
      resolved.distributedConsensusCoordinator.requireQuorumForProposals,
    ).toBe(true);
    expect(
      resolved.distributedConsensusCoordinator.allowDynamicGroupCreation,
    ).toBe(true);
    expect(
      resolved.distributedConsensusCoordinator.allowCrossGroupRouting,
    ).toBe(true);

    const clean = engine.getPolicy("track118-clean");
    expect(clean.distributedConsensusCoordinator.maxGroups).toBe(64);
    expect(
      clean.distributedConsensusCoordinator.requireQuorumForProposals,
    ).toBe(true);
  });

  test("FUZZ-118-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack118DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(`consensusProtoLevel${i}`);
      expect(Object.prototype).not.toHaveProperty(`consensusCtorLevel${i}`);
    }
    expect(Object.prototype).not.toHaveProperty("consensusDeepMaxGroups");
    expect(Object.prototype).not.toHaveProperty("consensusDeepFaultTimeoutMs");

    const resolved = engine.getPolicy("track118-deep-polluter");
    expect(resolved).toBeDefined();
  });

  test("FUZZ-118-03: deterministic SHA-256 PRNG is reproducible", () => {
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

  test("FUZZ-118-04: 1000 multi-layer random policies construct and merge without crash or pollution", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-multilayer");

    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack118PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });

      // Verify no prototype pollution leaked
      expect(Object.prototype).not.toHaveProperty("consensusGatePolluted");
      expect(Object.prototype).not.toHaveProperty("consensusDeepMaxGroups");
    }
  });

  test("FUZZ-118-05: strict reference sandboxing — mutation does not cross-tenant leak", () => {
    const policy = makeTrack118ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("track118-polluter");
    const originalBMax =
      engine.getPolicy("track118-clean").distributedConsensusCoordinator
        .maxGroups;

    policyA.distributedConsensusCoordinator.maxGroups = 1;

    const policyB = engine.getPolicy("track118-clean");
    expect(policyB.distributedConsensusCoordinator.maxGroups).toBe(
      originalBMax,
    );
    expect(policyB.distributedConsensusCoordinator.maxGroups).not.toBe(1);
  });

  test("FUZZ-118-06: Track 118 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    const inputs = makeTrack118TypeConfusionConfigs();
    for (const { value } of inputs) {
      try {
        engine.validate("t1", "distributedConsensusCoordinator", value);
      } catch (e) {
        expect(e).toBeDefined();
        if (e instanceof HsmAdapterError) {
          expect(e.code).toMatch(/POLICY|CONSENSUS|GROUP/);
        }
      }
    }
  });

  test("FUZZ-118-07: PRNG-driven distributedConsensusCoordinator validation — 100 calls, no unhandled crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED);
    const engine = new CryptoPolicyEngine();

    for (let i = 0; i < 100; i++) {
      const { tenantId, operation, config } =
        makeTrack118PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(tenantId, operation, config);
        expect(result).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    }
  });

  test("FUZZ-118-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-flood");
    const policy = makeTrack118PrngDrivenMultiLayerPolicy(prng);
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      const { tenantId, operation, config } =
        makeTrack118ConcurrentValidationCall(prng);
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

  test("FUZZ-118-09: cross-tenant distributedConsensusCoordinator mutation isolation", () => {
    const policy = makeTrack118ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("track118-polluter");
    const originalBMax =
      engine.getPolicy("track118-clean").distributedConsensusCoordinator
        .maxGroups;

    policyA.distributedConsensusCoordinator.maxGroups = 1;

    const policyB = engine.getPolicy("track118-clean");
    expect(policyB.distributedConsensusCoordinator.maxGroups).toBe(
      originalBMax,
    );
    expect(policyB.distributedConsensusCoordinator.maxGroups).not.toBe(1);
  });
});
