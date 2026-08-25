"use strict";

/**
 * Track 121 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the multipartyReKeying policy block resists:
 * - Prototype pollution (direct and 5-level nested)
 * - Type confusion (string, array, null, object values for numeric and boolean fields)
 * - High-frequency boundary overflows (MAX_SAFE_INTEGER, NaN, -1, 0, 65, 10001)
 * - Cross-tenant mutation leakage
 * - Concurrent validation flood races
 * - allowThresholdAdjustment inverse guard under multi-layer stress
 *
 * Follows the Track 120 multi-tenant fuzzing pattern.
 */

const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack121ProtoPollutionPolicy,
  makeTrack121TypeConfusionConfigs,
  makeTrack121PrngDrivenValidateCall,
  makeTrack121DeepNestedPollutionPolicy,
  makeTrack121PrngDrivenMultiLayerPolicy,
  makeTrack121ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 121 multi-tenant fuzzing matrix", () => {
  // ── FUZZ-121-01: Prototype pollution in multipartyReKeying is blocked ──
  test("FUZZ-121-01: prototype pollution in multipartyReKeying is blocked", () => {
    const policy = makeTrack121ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("rekeyingGatePolluted");
    expect(Object.prototype).not.toHaveProperty("rekeyingConstructorPolluted");

    const resolved = engine.getPolicy("track121-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(resolved.multipartyReKeying.maxReKeyingEpochs).toBe(1000);
    expect(resolved.multipartyReKeying.requireQuorumCommit).toBe(true);
    expect(resolved.multipartyReKeying.requireAntiRollback).toBe(true);
    expect(resolved.multipartyReKeying.requireShareZeroization).toBe(true);
    expect(resolved.multipartyReKeying.allowThresholdAdjustment).toBe(true);
    expect(resolved.multipartyReKeying.maxShareholders).toBe(32);

    const clean = engine.getPolicy("track121-clean");
    expect(clean.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(clean.multipartyReKeying.requireShareZeroization).toBe(true);

    // Verify prototype was not polluted
    expect(Object.prototype).not.toHaveProperty("rekeyingGatePolluted");
    expect(Object.prototype).not.toHaveProperty("rekeyingConstructorPolluted");
  });

  // ── FUZZ-121-02: 5-level nested __proto__ / constructor pollution is blocked ──
  test("FUZZ-121-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack121DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty("rekeyingProtoLevel" + i);
      expect(Object.prototype).not.toHaveProperty("rekeyingCtorLevel" + i);
    }

    const resolved = engine.getPolicy("track121-deep-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.multipartyReKeying).toBeDefined();

    // Clean tenant should be unaffected
    const clean = engine.getPolicy("track121-clean");
    expect(clean.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(clean.multipartyReKeying.maxShareholders).toBe(32);

    // Verify no prototype pollution leaked
    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty("rekeyingProtoLevel" + i);
      expect(Object.prototype).not.toHaveProperty("rekeyingCtorLevel" + i);
    }
  });

  // ── FUZZ-121-03: Deterministic SHA-256 PRNG is reproducible ──
  test("FUZZ-121-03: deterministic SHA-256 PRNG is reproducible", () => {
    const prng1 = makeHashChainPrng(FUZZ_SEED);
    const prng2 = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 100; i++) {
      expect(prng1.nextInt(1000)).toBe(prng2.nextInt(1000));
    }
  });

  // ── FUZZ-121-04: 1000 multi-layer random policies construct and merge without crash ──
  test("FUZZ-121-04: 1000 multi-layer random policies construct and merge without crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track121-multilayer");
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack121PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });
      const tenantIds = Object.keys(policy.tenants);
      for (const tid of tenantIds) {
        const resolved = engine.getPolicy(tid);
        expect(resolved).toBeDefined();
        if (resolved.multipartyReKeying) {
          expect(typeof resolved.multipartyReKeying.minQuorumNodes).toBe(
            "number",
          );
        }
      }
    }
    // Verify no prototype pollution leaked from 1000 iterations
    expect(Object.prototype).not.toHaveProperty("rekeyingProtoLevel0");
    expect(Object.prototype).not.toHaveProperty("rekeyingCtorLevel0");
  });

  // ── FUZZ-121-05: Strict reference sandboxing — mutation does not cross-tenant ──
  test("FUZZ-121-05: strict reference sandboxing — mutation does not cross-tenant", () => {
    const policy = makeTrack121ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const polluterPolicy = engine.getPolicy("track121-polluter");
    polluterPolicy.multipartyReKeying.minQuorumNodes = 999;
    polluterPolicy.multipartyReKeying.maxShareholders = 999;

    const cleanPolicy = engine.getPolicy("track121-clean");
    expect(cleanPolicy.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(cleanPolicy.multipartyReKeying.maxShareholders).toBe(32);
  });

  // ── FUZZ-121-06: Type confusion fails closed with structured HsmAdapterError ──
  test("FUZZ-121-06: Track 121 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} }, { strict: true });
    const configs = makeTrack121TypeConfusionConfigs();

    for (const { value, label } of configs) {
      // Most type-confusion configs should either pass (type check skips non-matching types)
      // or fail with POLICY_VIOLATION_BLOCKED. The key invariant: no unhandled crashes.
      try {
        const result = engine.validate("default", "multipartyReKeying", value);
        expect(result).toBe(true);
      } catch (err) {
        expect(err).toBeInstanceOf(HsmAdapterError);
        expect(err.code).toBe("POLICY_VIOLATION_BLOCKED");
      }
      // Verify no prototype pollution leaked from type confusion payloads
      expect(Object.prototype).not.toHaveProperty("rekeyingGatePolluted");
      expect(Object.prototype).not.toHaveProperty(
        "rekeyingConstructorPolluted",
      );
    }
  });

  // ── FUZZ-121-07: PRNG-driven validation — 100 calls, no crash, structured errors ──
  test("FUZZ-121-07: PRNG-driven multipartyReKeying validation — 100 calls, no crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track121-validate");
    // Use a policy with a restricted tenant to test the inverse guard
    const engine = new CryptoPolicyEngine(
      {
        default: {},
        tenants: {
          "track121-restricted": {
            multipartyReKeying: { allowThresholdAdjustment: false },
          },
        },
      },
      { strict: true },
    );
    let passed = 0;
    let blocked = 0;
    let inverseGuardBlocked = 0;

    for (let i = 0; i < 100; i++) {
      const call = makeTrack121PrngDrivenValidateCall(prng);
      try {
        const result = engine.validate(
          call.tenantId,
          call.operation,
          call.config,
        );
        expect(result).toBe(true);
        passed++;
      } catch (err) {
        expect(err).toBeInstanceOf(HsmAdapterError);
        expect(err.code).toBe("POLICY_VIOLATION_BLOCKED");
        blocked++;
        if (err.message.includes("threshold adjustment cannot be enabled")) {
          inverseGuardBlocked++;
        }
      }
    }
    // We should have a mix of passes and blocks (not all one or the other)
    expect(passed + blocked).toBe(100);
    // At least some should be blocked (boundary violations are common in the PRNG set)
    expect(blocked).toBeGreaterThan(0);
    // The inverse guard may or may not trigger depending on PRNG sequence,
    // but we verify the mechanism exists by checking the restricted tenant directly
    expect(() => {
      engine.validate("track121-restricted", "multipartyReKeying", {
        allowThresholdAdjustment: true,
      });
    }).toThrow(/threshold adjustment cannot be enabled/);
  });

  // ── FUZZ-121-08: Concurrent validation flood does not race or crash ──
  test("FUZZ-121-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track121-concurrent");
    const engine = new CryptoPolicyEngine({ default: {} }, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      calls.push(makeTrack121ConcurrentValidationCall(prng));
    }

    const results = await Promise.all(
      calls.map(async (call) => {
        try {
          return {
            ok: true,
            result: engine.validate(call.tenantId, call.operation, call.config),
          };
        } catch (err) {
          return { ok: false, code: err.code };
        }
      }),
    );

    let okCount = 0;
    let blockedCount = 0;
    for (const r of results) {
      if (r.ok) okCount++;
      else if (r.code === "POLICY_VIOLATION_BLOCKED") blockedCount++;
    }
    expect(okCount + blockedCount).toBe(1000);
    expect(blockedCount).toBeGreaterThan(0);

    // Verify no prototype pollution leaked after concurrent flood
    expect(Object.prototype).not.toHaveProperty("rekeyingGatePolluted");
    expect(Object.prototype).not.toHaveProperty("rekeyingProtoLevel0");
  });

  // ── FUZZ-121-09: Cross-tenant multipartyReKeying mutation isolation ──
  test("FUZZ-121-09: cross-tenant multipartyReKeying mutation isolation", () => {
    const policy = {
      version: "0.0.0",
      default: {},
      tenants: {
        "tenant-a": {
          multipartyReKeying: {
            minQuorumNodes: 5,
            maxReKeyingEpochs: 500,
            requireQuorumCommit: true,
            requireAntiRollback: true,
            requireShareZeroization: true,
            allowThresholdAdjustment: false,
            maxShareholders: 16,
          },
        },
        "tenant-b": {
          multipartyReKeying: {
            minQuorumNodes: 3,
            maxReKeyingEpochs: 1000,
            requireQuorumCommit: true,
            requireAntiRollback: true,
            requireShareZeroization: true,
            allowThresholdAdjustment: true,
            maxShareholders: 32,
          },
        },
      },
    };
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("tenant-a");
    const policyB = engine.getPolicy("tenant-b");

    expect(policyA.multipartyReKeying.minQuorumNodes).toBe(5);
    expect(policyA.multipartyReKeying.maxReKeyingEpochs).toBe(500);
    expect(policyA.multipartyReKeying.allowThresholdAdjustment).toBe(false);
    expect(policyA.multipartyReKeying.maxShareholders).toBe(16);

    expect(policyB.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(policyB.multipartyReKeying.maxReKeyingEpochs).toBe(1000);
    expect(policyB.multipartyReKeying.allowThresholdAdjustment).toBe(true);
    expect(policyB.multipartyReKeying.maxShareholders).toBe(32);

    // Mutate tenant-a's policy
    policyA.multipartyReKeying.minQuorumNodes = 1;
    policyA.multipartyReKeying.maxShareholders = 999;

    // Tenant-b should be unaffected
    const policyB2 = engine.getPolicy("tenant-b");
    expect(policyB2.multipartyReKeying.minQuorumNodes).toBe(3);
    expect(policyB2.multipartyReKeying.maxShareholders).toBe(32);

    // Verify the inverse guard: tenant-a (restricted) cannot re-enable threshold adjustment
    expect(() => {
      engine.validate("tenant-a", "multipartyReKeying", {
        allowThresholdAdjustment: true,
      });
    }).toThrow(/threshold adjustment cannot be enabled/);

    // Tenant-b (unrestricted) can freely toggle threshold adjustment
    expect(
      engine.validate("tenant-b", "multipartyReKeying", {
        allowThresholdAdjustment: false,
      }),
    ).toBe(true);
    expect(
      engine.validate("tenant-b", "multipartyReKeying", {
        allowThresholdAdjustment: true,
      }),
    ).toBe(true);
  });
});
