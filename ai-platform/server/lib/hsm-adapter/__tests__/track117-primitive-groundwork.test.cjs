"use strict";

/**
 * Track 117 Primitive Groundwork — BFT Shard Sync Policy Formalization
 *
 * Verifies that the bftShardSync policy block has:
 * - A working _validateBftShardSync validation method
 * - Operation dispatch for 'bftShardSync'
 * - Correct default values matching the schema
 * - Clean tenant merge support
 * - All 7 telemetry counters registered in hsm-metrics.cjs
 */

const {
  CryptoPolicyEngine,
  DEFAULT_POLICY,
} = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("Track 117 primitive groundwork — bftShardSync policy formalization", () => {
  test("GROUND-117-01: schema validation rejects malformed config", () => {
    const engine = new CryptoPolicyEngine({ default: {} });

    // Helper: verify a config throws HsmAdapterError with POLICY_VIOLATION_BLOCKED
    function expectViolation(config) {
      try {
        engine.validate("t1", "bftShardSync", config);
        throw new Error("expected validation to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
      }
    }

    // minQuorumNodes below minimum
    expectViolation({ minQuorumNodes: 1 });

    // maxCatchUpBatchSize above maximum
    expectViolation({ maxCatchUpBatchSize: 999 });

    // lagThreshold above maximum
    expectViolation({ lagThreshold: 999 });

    // byzantineDivergenceThreshold above maximum
    expectViolation({ byzantineDivergenceThreshold: 9999 });

    // requireQuorumCommit disabled when enforced
    expectViolation({ requireQuorumCommit: false });

    // requireAntiReplay disabled when enforced
    expectViolation({ requireAntiReplay: false });

    // maxShardsPerCluster above maximum
    expectViolation({ maxShardsPerCluster: 9999 });
  });

  test("GROUND-117-02: DEFAULT_POLICY merges cleanly with tenant overrides", () => {
    const policy = {
      version: "0.0.0",
      default: {},
      tenants: {
        "tenant-117-override": {
          bftShardSync: {
            lagThreshold: 16,
            maxCatchUpBatchSize: 32,
          },
        },
      },
    };
    const engine = new CryptoPolicyEngine(policy, { strict: true });

    const resolved = engine.getPolicy("tenant-117-override");
    expect(resolved).toBeDefined();
    expect(resolved.bftShardSync).toBeDefined();
    // Overridden values
    expect(resolved.bftShardSync.lagThreshold).toBe(16);
    expect(resolved.bftShardSync.maxCatchUpBatchSize).toBe(32);
    // Default values remain for un-overridden attributes
    expect(resolved.bftShardSync.minQuorumNodes).toBe(3);
    expect(resolved.bftShardSync.byzantineDivergenceThreshold).toBe(100);
    expect(resolved.bftShardSync.requireQuorumCommit).toBe(true);
    expect(resolved.bftShardSync.requireAntiReplay).toBe(true);
    expect(resolved.bftShardSync.maxShardsPerCluster).toBe(128);
  });

  test("GROUND-117-03: all 7 bftShardSync telemetry counters register and expose", () => {
    const metrics = hsmMetrics.getMetrics();
    const requiredCounters = [
      "hsm_shard_append_total",
      "hsm_shard_ack_total",
      "hsm_shard_commit_total",
      "hsm_shard_catchup_batch_total",
      "hsm_shard_byzantine_detected_total",
      "hsm_shard_lagging_nodes",
      "hsm_shard_active",
    ];
    for (const counter of requiredCounters) {
      expect(metrics).toHaveProperty(counter);
      expect(typeof metrics[counter]).toBe("number");
    }
  });

  test("GROUND-117-04: all modified files load without error", () => {
    // Re-require the policy engine to verify it loads cleanly
    delete require.cache[require.resolve("../crypto-policy-engine.cjs")];
    expect(() => {
      const {
        CryptoPolicyEngine: CPE,
      } = require("../crypto-policy-engine.cjs");
      const engine = new CPE({ default: {} });
      expect(engine).toBeInstanceOf(CPE);
    }).not.toThrow();
  });

  test("GROUND-117-05: defaults to strict production hardening limits", () => {
    const defaults = DEFAULT_POLICY.bftShardSync;
    expect(defaults).toBeDefined();
    expect(defaults.minQuorumNodes).toBe(3);
    expect(defaults.maxCatchUpBatchSize).toBe(64);
    expect(defaults.lagThreshold).toBe(8);
    expect(defaults.byzantineDivergenceThreshold).toBe(100);
    expect(defaults.requireQuorumCommit).toBe(true);
    expect(defaults.requireAntiReplay).toBe(true);
    expect(defaults.maxShardsPerCluster).toBe(128);

    // Verify validate() with empty config passes (uses defaults)
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(engine.validate("t1", "bftShardSync", {})).toBe(true);

    // Verify validate() with valid config within bounds passes
    expect(
      engine.validate("t1", "bftShardSync", {
        minQuorumNodes: 5,
        maxCatchUpBatchSize: 32,
        lagThreshold: 4,
        byzantineDivergenceThreshold: 50,
        requireQuorumCommit: true,
        requireAntiReplay: true,
        maxShardsPerCluster: 64,
      }),
    ).toBe(true);
  });
});
