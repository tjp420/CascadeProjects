'use strict';

const crypto = require('crypto');
const {
  BftShardSyncEngine,
  ShardVectorClock,
  ShardEntry,
  ENTRY_STATE,
  NODE_SYNC_STATE,
} = require('../bft-shard-sync-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('BftShardSyncEngine — Track 32 BFT Shard Sync', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  const NODES = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path shard sync lifecycle', () => {
    test('register → append → ack (quorum) → commit', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerShard('shard-a');

      const entry = engine.append('shard-a', 'test-data-1');
      expect(entry.state).toBe(ENTRY_STATE.PENDING);
      expect(entry.index).toBe(1);

      // 3 nodes acknowledge (quorum = 3)
      engine.acknowledge('shard-a', 'node-1', 1);
      engine.acknowledge('shard-a', 'node-2', 1);
      expect(entry.state).toBe(ENTRY_STATE.PENDING); // not yet committed

      engine.acknowledge('shard-a', 'node-3', 1);
      expect(entry.state).toBe(ENTRY_STATE.COMMITTED);

      expect(engine.commitIndex('shard-a')).toBe(1);
    });
  });

  // ── L2.02: ShardVectorClock tracks per-node position ──
  describe('L2.02: ShardVectorClock', () => {
    test('tracks per-node replication position', () => {
      const vc = new ShardVectorClock('shard-a', NODES);
      expect(vc.get('node-1')).toBe(0);
      expect(vc.get('node-2')).toBe(0);

      vc.advance('node-1', 5);
      vc.advance('node-2', 3);
      expect(vc.get('node-1')).toBe(5);
      expect(vc.get('node-2')).toBe(3);
    });

    test('minSequence returns the minimum across all nodes', () => {
      const vc = new ShardVectorClock('shard-a', NODES);
      vc.advance('node-1', 10);
      vc.advance('node-2', 5);
      vc.advance('node-3', 8);
      vc.advance('node-4', 3);
      vc.advance('node-5', 7);
      expect(vc.minSequence()).toBe(3);
    });

    test('maxSequence returns the maximum across all nodes', () => {
      const vc = new ShardVectorClock('shard-a', NODES);
      vc.advance('node-1', 10);
      vc.advance('node-2', 5);
      vc.advance('node-3', 8);
      expect(vc.maxSequence()).toBe(10);
    });

    test('quorumSequence returns the t-th smallest', () => {
      const vc = new ShardVectorClock('shard-a', NODES);
      vc.advance('node-1', 10);
      vc.advance('node-2', 5);
      vc.advance('node-3', 8);
      vc.advance('node-4', 3);
      vc.advance('node-5', 7);
      // sorted: [3, 5, 7, 8, 10], quorum=3 -> 3rd smallest = 7
      expect(vc.quorumSequence(3)).toBe(7);
    });

    test('snapshot returns all node sequences', () => {
      const vc = new ShardVectorClock('shard-a', ['node-1', 'node-2']);
      vc.advance('node-1', 5);
      vc.advance('node-2', 3);
      const snap = vc.snapshot();
      expect(snap).toEqual({ 'node-1': 5, 'node-2': 3 });
    });
  });

  // ── L2.03: Quorum acknowledgment gates commit ──
  describe('L2.03: quorum commit gating', () => {
    test('entry not committed until quorum reached', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 4 });
      engine.registerShard('shard-a');
      const entry = engine.append('shard-a', 'data');

      engine.acknowledge('shard-a', 'node-1', 1);
      engine.acknowledge('shard-a', 'node-2', 1);
      engine.acknowledge('shard-a', 'node-3', 1);
      expect(entry.state).toBe(ENTRY_STATE.PENDING); // 3 < 4

      engine.acknowledge('shard-a', 'node-4', 1);
      expect(entry.state).toBe(ENTRY_STATE.COMMITTED); // 4 >= 4
    });

    test('quorumCommitPoint returns the t-th smallest sequence', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerShard('shard-a');
      engine.append('shard-a', 'd1');
      engine.append('shard-a', 'd2');
      engine.append('shard-a', 'd3');

      engine.acknowledge('shard-a', 'node-1', 1);
      engine.acknowledge('shard-a', 'node-1', 2);
      engine.acknowledge('shard-a', 'node-1', 3);
      engine.acknowledge('shard-a', 'node-2', 1);
      engine.acknowledge('shard-a', 'node-2', 2);
      engine.acknowledge('shard-a', 'node-2', 3);
      engine.acknowledge('shard-a', 'node-3', 1);
      engine.acknowledge('shard-a', 'node-3', 2);
      engine.acknowledge('shard-a', 'node-3', 3);

      // sorted: [0, 0, 3, 3, 3], quorum=3 -> 3rd smallest = 3
      expect(engine.quorumCommitPoint('shard-a')).toBe(3);
    });
  });

  // ── L2.04: Sliding-window catch-up detects lagging nodes ──
  describe('L2.04/L2.05: catch-up detection and streaming', () => {
    test('detectLag identifies lagging nodes', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3, lagThreshold: 3 });
      engine.registerShard('shard-a');

      // Append 5 entries
      for (let i = 0; i < 5; i++) engine.append('shard-a', `d${i}`);

      // node-1 and node-2 acknowledge all 5
      for (let i = 1; i <= 5; i++) {
        engine.acknowledge('shard-a', 'node-1', i);
        engine.acknowledge('shard-a', 'node-2', i);
      }
      // node-3 acknowledges only 1 (lag = 4)
      engine.acknowledge('shard-a', 'node-3', 1);

      const report = engine.detectLag('shard-a');
      expect(report.laggingNodes.length).toBeGreaterThanOrEqual(1);
      const laggingNode3 = report.laggingNodes.find((n) => n.nodeId === 'node-3');
      expect(laggingNode3).toBeDefined();
      expect(laggingNode3.lag).toBe(4);
    });

    test('catchUp streams missing entries to lagging node', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3, lagThreshold: 2 });
      engine.registerShard('shard-a');

      for (let i = 0; i < 5; i++) engine.append('shard-a', `d${i}`);
      for (let i = 1; i <= 5; i++) {
        engine.acknowledge('shard-a', 'node-1', i);
        engine.acknowledge('shard-a', 'node-2', i);
      }

      const result = engine.catchUp('shard-a', 'node-3');
      expect(result.batchSize).toBe(5);
      expect(result.fromSeq).toBe(0);
      expect(result.toSeq).toBe(5);
      expect(result.entries.length).toBe(5);
    });

    test('catchUp returns empty batch for up-to-date node', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerShard('shard-a');
      engine.append('shard-a', 'd1');
      engine.acknowledge('shard-a', 'node-1', 1);

      const result = engine.catchUp('shard-a', 'node-1');
      expect(result.batchSize).toBe(0);
    });

    test('syncCycle runs full detect + catch-up', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3, lagThreshold: 2 });
      engine.registerShard('shard-a');

      for (let i = 0; i < 5; i++) engine.append('shard-a', `d${i}`);
      for (let i = 1; i <= 5; i++) {
        engine.acknowledge('shard-a', 'node-1', i);
        engine.acknowledge('shard-a', 'node-2', i);
      }

      const report = engine.syncCycle('shard-a');
      expect(report.lagReport.laggingNodes.length).toBeGreaterThanOrEqual(1);
      expect(report.catchUps.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── L2.06: Multiple shards tracked independently ──
  describe('L2.06: multiple shards independent', () => {
    test('shards are tracked independently', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerShard('shard-a');
      engine.registerShard('shard-b');

      engine.append('shard-a', 'a1');
      engine.append('shard-b', 'b1');
      engine.append('shard-b', 'b2');

      expect(engine.commitIndex('shard-a')).toBe(0);
      expect(engine.commitIndex('shard-b')).toBe(0);

      engine.acknowledge('shard-b', 'node-1', 1);
      engine.acknowledge('shard-b', 'node-2', 1);
      engine.acknowledge('shard-b', 'node-3', 1);

      expect(engine.commitIndex('shard-b')).toBe(1);
      expect(engine.commitIndex('shard-a')).toBe(0); // unaffected
    });
  });

  // ── L2.07/L2.08: Policy validation ──
  describe('L2.07/L2.08: policy validation', () => {
    test('CryptoPolicyEngine includes bftShardSync block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.bftShardSync).toBeDefined();
      expect(policy.bftShardSync.minQuorumNodes).toBe(3);
      expect(policy.bftShardSync.maxCatchUpBatchSize).toBe(64);
      expect(policy.bftShardSync.requireQuorumCommit).toBe(true);
    });

    test('tenant policy can override bftShardSync settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { bftShardSync: { minQuorumNodes: 5 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.bftShardSync.minQuorumNodes).toBe(5);
    });
  });

  // ── L3.01: Byzantine node detection ──
  describe('L3.01/L3.02: byzantine detection and quarantine', () => {
    test('node with extreme divergence is flagged as byzantine', () => {
      const engine = new BftShardSyncEngine({
        clusterNodes: NODES,
        minQuorumNodes: 3,
        byzantineDivergenceThreshold: 10,
      });
      engine.registerShard('shard-a');

      // Append 15 entries
      for (let i = 0; i < 15; i++) engine.append('shard-a', `d${i}`);

      // node-1 and node-2 acknowledge all 15
      for (let i = 1; i <= 15; i++) {
        engine.acknowledge('shard-a', 'node-1', i);
        engine.acknowledge('shard-a', 'node-2', i);
      }
      // node-3 acknowledges only 1 (divergence = 14)
      engine.acknowledge('shard-a', 'node-3', 1);

      const report = engine.detectLag('shard-a');
      expect(report.byzantineNodes.length).toBeGreaterThanOrEqual(1);
      const byzantineNode3 = report.byzantineNodes.find((n) => n.nodeId === 'node-3');
      expect(byzantineNode3).toBeDefined();
    });

    test('quarantined node is excluded from synced state', () => {
      const engine = new BftShardSyncEngine({
        clusterNodes: NODES,
        minQuorumNodes: 3,
        byzantineDivergenceThreshold: 5,
      });
      engine.registerShard('shard-a');

      for (let i = 0; i < 10; i++) engine.append('shard-a', `d${i}`);
      for (let i = 1; i <= 10; i++) {
        engine.acknowledge('shard-a', 'node-1', i);
        engine.acknowledge('shard-a', 'node-2', i);
      }

      engine.detectLag('shard-a'); // node-3,4,5 are byzantine
      expect(engine.getNodeState('node-3')).toBe(NODE_SYNC_STATE.QUARANTINED);
      expect(engine.getNodeState('node-1')).toBe(NODE_SYNC_STATE.SYNCED);
    });
  });

  // ── L3.03: Anti-replay ──
  describe('L3.03: anti-replay protection', () => {
    test('stale sequence rejected', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerShard('shard-a');
      engine.append('shard-a', 'd1');

      engine.acknowledge('shard-a', 'node-1', 1);
      expect(() => engine.acknowledge('shard-a', 'node-1', 1)).toThrow(HsmAdapterError);
    });

    test('decreasing sequence rejected', () => {
      const vc = new ShardVectorClock('shard-a', ['node-1']);
      vc.advance('node-1', 5);
      expect(() => vc.advance('node-1', 3)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.04: Cannot commit without quorum ──
  describe('L3.04: cannot commit without quorum', () => {
    test('entry stays pending with insufficient acks', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 4 });
      engine.registerShard('shard-a');
      const entry = engine.append('shard-a', 'data');

      engine.acknowledge('shard-a', 'node-1', 1);
      engine.acknowledge('shard-a', 'node-2', 1);
      engine.acknowledge('shard-a', 'node-3', 1);

      expect(entry.state).toBe(ENTRY_STATE.PENDING);
      expect(engine.commitIndex('shard-a')).toBe(0);
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes shard sync counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_shard_append_total', 0);
      expect(metrics).toHaveProperty('hsm_shard_ack_total', 0);
      expect(metrics).toHaveProperty('hsm_shard_commit_total', 0);
      expect(metrics).toHaveProperty('hsm_shard_catchup_batch_total', 0);
      expect(metrics).toHaveProperty('hsm_shard_byzantine_detected_total', 0);
      expect(metrics).toHaveProperty('hsm_shard_lagging_nodes', 0);
      expect(metrics).toHaveProperty('hsm_shard_active', 0);
    });

    test('incrementCounter works for shard counters', () => {
      hsmMetrics.incrementCounter('hsm_shard_append_total', 5);
      hsmMetrics.incrementCounter('hsm_shard_commit_total', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_shard_append_total).toBe(5);
      expect(metrics.hsm_shard_commit_total).toBe(3);
    });

    test('Prometheus output includes shard sync metrics', () => {
      hsmMetrics.incrementCounter('hsm_shard_append_total', 2);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_shard_append_total');
      expect(output).toContain('# TYPE hsm_shard_append_total counter');
      expect(output).toContain('hsm_shard_append_total 2');
    });
  });

  // ── Engine state telemetry ──
  describe('getEngineState telemetry', () => {
    test('returns correct engine state', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      expect(engine.getEngineState().activeShards).toBe(0);
      expect(engine.getEngineState().clusterSize).toBe(5);
      expect(engine.getEngineState().minQuorumNodes).toBe(3);

      engine.registerShard('shard-a');
      expect(engine.getEngineState().activeShards).toBe(1);
    });
  });

  // ── Error cases ──
  describe('error cases', () => {
    test('registerShard throws for duplicate shard', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES });
      engine.registerShard('shard-a');
      expect(() => engine.registerShard('shard-a')).toThrow(HsmAdapterError);
    });

    test('append throws for unknown shard', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES });
      expect(() => engine.append('unknown', 'data')).toThrow(HsmAdapterError);
    });

    test('acknowledge throws for unknown node', () => {
      const engine = new BftShardSyncEngine({ clusterNodes: NODES });
      engine.registerShard('shard-a');
      engine.append('shard-a', 'd1');
      expect(() => engine.acknowledge('shard-a', 'unknown-node', 1)).toThrow(HsmAdapterError);
    });

    test('constructor throws for empty cluster', () => {
      expect(() => new BftShardSyncEngine({ clusterNodes: [] })).toThrow(HsmAdapterError);
    });

    test('ShardVectorClock throws for unknown node', () => {
      const vc = new ShardVectorClock('shard-a', ['node-1']);
      expect(() => vc.get('unknown')).toThrow(HsmAdapterError);
    });

    test('ShardVectorClock throws for invalid quorum size', () => {
      const vc = new ShardVectorClock('shard-a', ['node-1', 'node-2']);
      expect(() => vc.quorumSequence(0)).toThrow(HsmAdapterError);
      expect(() => vc.quorumSequence(3)).toThrow(HsmAdapterError);
    });
  });

  // ── ShardEntry unit tests ──
  describe('ShardEntry', () => {
    test('computes hash from data', () => {
      const entry = new ShardEntry(1, 'test-data', Date.now());
      expect(entry.hash).toBe(crypto.createHash('sha256').update('test-data').digest('hex'));
    });

    test('starts in PENDING state with no acknowledgments', () => {
      const entry = new ShardEntry(1, 'data', Date.now());
      expect(entry.state).toBe(ENTRY_STATE.PENDING);
      expect(entry.acknowledgedBy.size).toBe(0);
    });
  });
});
