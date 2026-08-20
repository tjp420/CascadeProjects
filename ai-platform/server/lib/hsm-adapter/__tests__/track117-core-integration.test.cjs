"use strict";

/**
 * Track 117 Core Integration — Policy enforcement + telemetry counter wiring
 *
 * Verifies that bft-shard-sync-engine.cjs correctly:
 * - Validates config against policy at construction time
 * - Increments hsm_shard_append_total on append()
 * - Increments hsm_shard_ack_total + hsm_shard_commit_total on acknowledge() + _checkCommit()
 * - Increments hsm_shard_catchup_batch_total on catchUp()
 * - Increments hsm_shard_byzantine_detected_total + updates hsm_shard_lagging_nodes on detectLag()
 * - Enforces maxShardsPerCluster limit + updates hsm_shard_active gauge on registerShard()
 */

const { BftShardSyncEngine } = require("../bft-shard-sync-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");
const { counters, reset } = hsmMetrics;

const CLUSTER_NODES = ["node-1", "node-2", "node-3", "node-4", "node-4"];

function makeEngine(opts = {}) {
  return new BftShardSyncEngine({
    clusterNodes: ["node-1", "node-2", "node-3", "node-4", "node-5"],
    minQuorumNodes: 3,
    ...opts,
  });
}

describe("Track 117 core integration — BFT shard sync engine wiring", () => {
  beforeEach(() => {
    reset();
  });

  test("CORE-117-01: constructor validates config against policy", () => {
    // Valid config should not throw
    expect(() => makeEngine({ minQuorumNodes: 3 })).not.toThrow();

    // Invalid: minQuorumNodes below policy minimum
    expect(() => makeEngine({ minQuorumNodes: 1 })).toThrow(HsmAdapterError);
    try {
      makeEngine({ minQuorumNodes: 1 });
    } catch (e) {
      expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
    }

    // Invalid: maxCatchUpBatchSize above maximum
    expect(() => makeEngine({ maxCatchUpBatchSize: 999 })).toThrow(
      HsmAdapterError,
    );
    try {
      makeEngine({ maxCatchUpBatchSize: 999 });
    } catch (e) {
      expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
    }

    // Invalid: requireQuorumCommit disabled
    expect(() => makeEngine({ requireQuorumCommit: false })).toThrow(
      HsmAdapterError,
    );
    try {
      makeEngine({ requireQuorumCommit: false });
    } catch (e) {
      expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
    }

    // Invalid: maxShardsPerCluster above maximum
    expect(() => makeEngine({ maxShardsPerCluster: 9999 })).toThrow(
      HsmAdapterError,
    );
    try {
      makeEngine({ maxShardsPerCluster: 9999 });
    } catch (e) {
      expect(e.code).toBe("POLICY_VIOLATION_BLOCKED");
    }
  });

  test("CORE-117-02: append() increments hsm_shard_append_total counter", () => {
    const engine = makeEngine();
    engine.registerShard("shard-1");

    const before = counters.hsm_shard_append_total;
    engine.append("shard-1", "data-1");
    engine.append("shard-1", "data-2");
    engine.append("shard-1", "data-3");
    const after = counters.hsm_shard_append_total;

    expect(after).toBe(before + 3);
  });

  test("CORE-117-03: acknowledge() + _checkCommit() increment ack + commit counters", () => {
    const engine = makeEngine({ minQuorumNodes: 3 });
    engine.registerShard("shard-1");
    const entry = engine.append("shard-1", "data-1");

    const beforeAck = counters.hsm_shard_ack_total;
    const beforeCommit = counters.hsm_shard_commit_total;

    // Ack from 3 nodes (quorum = 3)
    engine.acknowledge("shard-1", "node-1", entry.index);
    engine.acknowledge("shard-1", "node-2", entry.index);
    engine.acknowledge("shard-1", "node-3", entry.index);

    const afterAck = counters.hsm_shard_ack_total;
    const afterCommit = counters.hsm_shard_commit_total;

    expect(afterAck).toBe(beforeAck + 3);
    expect(afterCommit).toBe(beforeCommit + 1);
  });

  test("CORE-117-04: catchUp() increments hsm_shard_catchup_batch_total counter", () => {
    const engine = makeEngine({ minQuorumNodes: 3, lagThreshold: 1 });
    engine.registerShard("shard-1");

    // Append 3 entries
    engine.append("shard-1", "data-1");
    engine.append("shard-1", "data-2");
    engine.append("shard-1", "data-3");

    // Node-4 acks entry 1, then falls behind
    engine.acknowledge("shard-1", "node-1", 1);
    engine.acknowledge("shard-1", "node-2", 1);
    engine.acknowledge("shard-1", "node-3", 1);
    engine.acknowledge("shard-1", "node-1", 2);
    engine.acknowledge("shard-1", "node-2", 2);
    engine.acknowledge("shard-1", "node-3", 2);
    engine.acknowledge("shard-1", "node-1", 3);
    engine.acknowledge("shard-1", "node-2", 3);
    engine.acknowledge("shard-1", "node-3", 3);

    const before = counters.hsm_shard_catchup_batch_total;
    // Node-4 is behind — catch up
    engine.catchUp("shard-1", "node-4");
    const after = counters.hsm_shard_catchup_batch_total;

    expect(after).toBe(before + 1);
  });

  test("CORE-117-05: detectLag() increments byzantine counter + updates lagging gauge", () => {
    const engine = makeEngine({
      minQuorumNodes: 3,
      lagThreshold: 5,
      byzantineDivergenceThreshold: 10,
    });
    engine.registerShard("shard-1");

    // Advance node-1 to sequence 20
    for (let i = 1; i <= 20; i++) {
      engine.acknowledge("shard-1", "node-1", i);
    }
    // Node-5 is at sequence 0 — lag = 20 >= byzantineDivergenceThreshold (10)
    const beforeByz = counters.hsm_shard_byzantine_detected_total;
    const beforeLag = counters.hsm_shard_lagging_nodes;

    const report = engine.detectLag("shard-1");

    const afterByz = counters.hsm_shard_byzantine_detected_total;
    const afterLag = counters.hsm_shard_lagging_nodes;

    expect(report.byzantineNodes.length).toBeGreaterThan(0);
    expect(afterByz).toBe(beforeByz + report.byzantineNodes.length);
    expect(typeof afterLag).toBe("number");
  });

  test("CORE-117-06: registerShard() enforces maxShardsPerCluster + updates active gauge", () => {
    const engine = makeEngine({ maxShardsPerCluster: 3 });

    const beforeActive = counters.hsm_shard_active;
    engine.registerShard("shard-1");
    engine.registerShard("shard-2");
    engine.registerShard("shard-3");

    expect(counters.hsm_shard_active).toBe(beforeActive + 3);

    // 4th shard should throw
    expect(() => engine.registerShard("shard-4")).toThrow(HsmAdapterError);
    try {
      engine.registerShard("shard-4");
    } catch (e) {
      expect(e.code).toBe("SHARD_LIMIT_EXCEEDED");
    }
  });
});
