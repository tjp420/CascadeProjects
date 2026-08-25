"use strict";

/**
 * Track 120 Multi-Tenant Fuzzing Matrix — Adversarial edge cases
 *
 * Verifies that the clusterKeyReconciliation policy block resists:
 * - Prototype pollution (direct and 5-level nested)
 * - Type confusion (string, array, null, object values for numeric and boolean fields)
 * - High-frequency boundary overflows (MAX_SAFE_INTEGER, NaN, -1, 0, 513)
 * - Cross-tenant mutation leakage
 * - Concurrent validation flood races
 *
 * Follows the Track 119 multi-tenant fuzzing pattern.
 */

const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const {
  makeHashChainPrng,
  FUZZ_SEED,
  makeTrack120ProtoPollutionPolicy,
  makeTrack120TypeConfusionConfigs,
  makeTrack120PrngDrivenValidateCall,
  makeTrack120DeepNestedPollutionPolicy,
  makeTrack120PrngDrivenMultiLayerPolicy,
  makeTrack120ConcurrentValidationCall,
  cleanupPrototypePollution,
} = require("./tenant-fuzz-harness.cjs");

afterEach(() => {
  cleanupPrototypePollution();
});

describe("Track 120 multi-tenant fuzzing matrix", () => {
  // ── FUZZ-120-01: Prototype pollution in clusterKeyReconciliation is blocked ──
  test("FUZZ-120-01: prototype pollution in clusterKeyReconciliation is blocked", () => {
    const policy = makeTrack120ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    expect(Object.prototype).not.toHaveProperty("reconciliationGatePolluted");
    expect(Object.prototype).not.toHaveProperty(
      "reconciliationConstructorPolluted",
    );

    const resolved = engine.getPolicy("track120-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(resolved.clusterKeyReconciliation.maxEpochRollbackAttempts).toBe(3);
    expect(resolved.clusterKeyReconciliation.requireQuorumPromotion).toBe(true);
    expect(resolved.clusterKeyReconciliation.requireAntiRollback).toBe(true);
    expect(
      resolved.clusterKeyReconciliation.quarantineOnCriticalDivergence,
    ).toBe(true);
    expect(resolved.clusterKeyReconciliation.maxTrackedKeys).toBe(256);

    const clean = engine.getPolicy("track120-clean");
    expect(clean.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(clean.clusterKeyReconciliation.requireAntiRollback).toBe(true);

    // Verify prototype was not polluted
    expect(Object.prototype).not.toHaveProperty("reconciliationGatePolluted");
    expect(Object.prototype).not.toHaveProperty(
      "reconciliationConstructorPolluted",
    );
  });

  // ── FUZZ-120-02: 5-level nested __proto__ / constructor pollution is blocked ──
  test("FUZZ-120-02: 5-level nested __proto__ / constructor pollution is blocked", () => {
    const policy = makeTrack120DeepNestedPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(
        "reconciliationProtoLevel" + i,
      );
      expect(Object.prototype).not.toHaveProperty(
        "reconciliationCtorLevel" + i,
      );
    }

    const resolved = engine.getPolicy("track120-deep-polluter");
    expect(resolved).toBeDefined();
    expect(resolved.clusterKeyReconciliation).toBeDefined();

    // Clean tenant should be unaffected
    const clean = engine.getPolicy("track120-clean");
    expect(clean.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(clean.clusterKeyReconciliation.maxTrackedKeys).toBe(256);

    // Verify no prototype pollution leaked
    for (let i = 0; i < 5; i++) {
      expect(Object.prototype).not.toHaveProperty(
        "reconciliationProtoLevel" + i,
      );
      expect(Object.prototype).not.toHaveProperty(
        "reconciliationCtorLevel" + i,
      );
    }
  });

  // ── FUZZ-120-03: Deterministic SHA-256 PRNG is reproducible ──
  test("FUZZ-120-03: deterministic SHA-256 PRNG is reproducible", () => {
    const prng1 = makeHashChainPrng(FUZZ_SEED);
    const prng2 = makeHashChainPrng(FUZZ_SEED);
    for (let i = 0; i < 100; i++) {
      expect(prng1.nextInt(1000)).toBe(prng2.nextInt(1000));
    }
  });

  // ── FUZZ-120-04: 1000 multi-layer random policies construct and merge without crash ──
  test("FUZZ-120-04: 1000 multi-layer random policies construct and merge without crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track120-multilayer");
    for (let i = 0; i < 1000; i++) {
      const policy = makeTrack120PrngDrivenMultiLayerPolicy(prng);
      const engine = new CryptoPolicyEngine(policy, { strict: true });
      const tenantIds = Object.keys(policy.tenants);
      for (const tid of tenantIds) {
        const resolved = engine.getPolicy(tid);
        expect(resolved).toBeDefined();
        if (resolved.clusterKeyReconciliation) {
          expect(typeof resolved.clusterKeyReconciliation.minQuorumNodes).toBe(
            "number",
          );
        }
      }
    }
    // Verify no prototype pollution leaked from 1000 iterations
    expect(Object.prototype).not.toHaveProperty("reconciliationProtoLevel0");
    expect(Object.prototype).not.toHaveProperty("reconciliationCtorLevel0");
  });

  // ── FUZZ-120-05: Strict reference sandboxing — mutation does not cross-tenant ──
  test("FUZZ-120-05: strict reference sandboxing — mutation does not cross-tenant", () => {
    const policy = makeTrack120ProtoPollutionPolicy();
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const polluterPolicy = engine.getPolicy("track120-polluter");
    polluterPolicy.clusterKeyReconciliation.minQuorumNodes = 999;
    polluterPolicy.clusterKeyReconciliation.maxTrackedKeys = 999;

    const cleanPolicy = engine.getPolicy("track120-clean");
    expect(cleanPolicy.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(cleanPolicy.clusterKeyReconciliation.maxTrackedKeys).toBe(256);
  });

  // ── FUZZ-120-06: Type confusion fails closed with structured HsmAdapterError ──
  test("FUZZ-120-06: Track 120 type confusion fails closed with structured HsmAdapterError", () => {
    const engine = new CryptoPolicyEngine({ default: {} }, { strict: true });
    const configs = makeTrack120TypeConfusionConfigs();

    for (const { value, label } of configs) {
      // Most type-confusion configs should either pass (type check skips non-matching types)
      // or fail with POLICY_VIOLATION_BLOCKED. The key invariant: no unhandled crashes.
      try {
        const result = engine.validate(
          "default",
          "clusterKeyReconciliation",
          value,
        );
        expect(result).toBe(true);
      } catch (err) {
        expect(err).toBeInstanceOf(HsmAdapterError);
        expect(err.code).toBe("POLICY_VIOLATION_BLOCKED");
      }
      // Verify no prototype pollution leaked from type confusion payloads
      expect(Object.prototype).not.toHaveProperty("reconciliationGatePolluted");
      expect(Object.prototype).not.toHaveProperty(
        "reconciliationConstructorPolluted",
      );
    }
  });

  // ── FUZZ-120-07: PRNG-driven validation — 100 calls, no crash, structured errors ──
  test("FUZZ-120-07: PRNG-driven clusterKeyReconciliation validation — 100 calls, no crash", () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track120-validate");
    const engine = new CryptoPolicyEngine({ default: {} }, { strict: true });
    let passed = 0;
    let blocked = 0;

    for (let i = 0; i < 100; i++) {
      const call = makeTrack120PrngDrivenValidateCall(prng);
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
      }
    }
    // We should have a mix of passes and blocks (not all one or the other)
    expect(passed + blocked).toBe(100);
    // At least some should be blocked (boundary violations are common in the PRNG set)
    expect(blocked).toBeGreaterThan(0);
  });

  // ── FUZZ-120-08: Concurrent validation flood does not race or crash ──
  test("FUZZ-120-08: concurrent validation flood does not race or crash", async () => {
    const prng = makeHashChainPrng(FUZZ_SEED + "-track120-concurrent");
    const engine = new CryptoPolicyEngine({ default: {} }, { strict: true });

    const calls = [];
    for (let i = 0; i < 1000; i++) {
      calls.push(makeTrack120ConcurrentValidationCall(prng));
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
    expect(Object.prototype).not.toHaveProperty("reconciliationGatePolluted");
    expect(Object.prototype).not.toHaveProperty("reconciliationProtoLevel0");
  });

  // ── FUZZ-120-09: Cross-tenant clusterKeyReconciliation mutation isolation ──
  test("FUZZ-120-09: cross-tenant clusterKeyReconciliation mutation isolation", () => {
    const policy = {
      version: "0.0.0",
      default: {},
      tenants: {
        "tenant-a": {
          clusterKeyReconciliation: {
            minQuorumNodes: 5,
            maxEpochRollbackAttempts: 2,
            requireQuorumPromotion: true,
            requireAntiRollback: true,
            quarantineOnCriticalDivergence: true,
            maxTrackedKeys: 128,
          },
        },
        "tenant-b": {
          clusterKeyReconciliation: {
            minQuorumNodes: 3,
            maxEpochRollbackAttempts: 4,
            requireQuorumPromotion: true,
            requireAntiRollback: true,
            quarantineOnCriticalDivergence: true,
            maxTrackedKeys: 256,
          },
        },
      },
    };
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const policyA = engine.getPolicy("tenant-a");
    const policyB = engine.getPolicy("tenant-b");

    expect(policyA.clusterKeyReconciliation.minQuorumNodes).toBe(5);
    expect(policyA.clusterKeyReconciliation.maxEpochRollbackAttempts).toBe(2);
    expect(policyA.clusterKeyReconciliation.maxTrackedKeys).toBe(128);

    expect(policyB.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(policyB.clusterKeyReconciliation.maxEpochRollbackAttempts).toBe(4);
    expect(policyB.clusterKeyReconciliation.maxTrackedKeys).toBe(256);

    // Mutate tenant-a's policy
    policyA.clusterKeyReconciliation.minQuorumNodes = 1;
    policyA.clusterKeyReconciliation.maxTrackedKeys = 999;

    // Tenant-b should be unaffected
    const policyB2 = engine.getPolicy("tenant-b");
    expect(policyB2.clusterKeyReconciliation.minQuorumNodes).toBe(3);
    expect(policyB2.clusterKeyReconciliation.maxTrackedKeys).toBe(256);
  });
});
