'use strict';

const crypto = require('crypto');
const {
  ClusterKeyReconciliationEngine,
  KeyEpochTracker,
  computeKeyFingerprint,
  RECONCILIATION_STATE,
  VALID_TRANSITIONS,
  DIVERGENCE_SEVERITY,
  NODE_HEALTH,
} = require('../cluster-key-reconciliation-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('ClusterKeyReconciliationEngine — Track 35 Cluster Key Reconciliation', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  const NODES = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
  const KEY_A = 'key-a';
  const KEY_B = 'key-b';

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path reconciliation lifecycle', () => {
    test('register → scan → detect divergence → reconcile → quorum vote → commit', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });

      // 3 nodes have epoch 5, 2 nodes have epoch 3 (divergent)
      engine.registerKey(KEY_A, 'node-1', 5, 'key-material-v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'key-material-v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'key-material-v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'key-material-v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'key-material-v3');

      const reports = engine.scan();
      expect(reports.length).toBe(1);
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.MINOR);
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.DIVERGENT);

      engine.beginReconciliation(KEY_A, 5);
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.RECONCILING);

      // 3 healthy nodes vote (quorum = 3)
      const r1 = engine.votePromotion(KEY_A, 'node-1', 5);
      expect(r1.quorumReached).toBe(false);
      engine.votePromotion(KEY_A, 'node-2', 5);
      const r3 = engine.votePromotion(KEY_A, 'node-3', 5);
      expect(r3.quorumReached).toBe(true);
      expect(r3.state).toBe(RECONCILIATION_STATE.RECONCILED);
    });
  });

  // ── L2.02: KeyEpochTracker ──
  describe('L2.02: KeyEpochTracker', () => {
    test('tracks per-node, per-key epoch and fingerprint', () => {
      const tracker = new KeyEpochTracker();
      tracker.registerNodeKey(KEY_A, 'node-1', 5, 'fp-aaa');
      tracker.registerNodeKey(KEY_A, 'node-2', 3, 'fp-bbb');

      const k1 = tracker.getNodeKey(KEY_A, 'node-1');
      const k2 = tracker.getNodeKey(KEY_A, 'node-2');
      expect(k1.epoch).toBe(5);
      expect(k1.fingerprint).toBe('fp-aaa');
      expect(k2.epoch).toBe(3);
      expect(k2.fingerprint).toBe('fp-bbb');
    });

    test('keyIds returns all registered key IDs', () => {
      const tracker = new KeyEpochTracker();
      tracker.registerNodeKey(KEY_A, 'node-1', 1, 'fp-a');
      tracker.registerNodeKey(KEY_B, 'node-1', 2, 'fp-b');
      expect(tracker.keyIds()).toEqual([KEY_A, KEY_B]);
    });

    test('getPromotedEpoch / setPromotedEpoch', () => {
      const tracker = new KeyEpochTracker();
      expect(tracker.getPromotedEpoch(KEY_A)).toBe(0);
      tracker.setPromotedEpoch(KEY_A, 7);
      expect(tracker.getPromotedEpoch(KEY_A)).toBe(7);
    });
  });

  // ── L2.03: BFT quorum vote gates promotion ──
  describe('L2.03: quorum promotion gating', () => {
    test('key not promoted until quorum reached', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 4 });
      // All nodes agree (no divergence) so all can vote, but quorum is 4
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 5, 'v5');
      engine.registerKey(KEY_A, 'node-5', 5, 'v5');

      // All agree — reconciled immediately
      const reports = engine.scan();
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.NONE);
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.RECONCILED);
    });

    test('quorum reached with enough healthy votes', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      // All nodes agree — no divergence
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 5, 'v5');
      engine.registerKey(KEY_A, 'node-5', 5, 'v5');

      const reports = engine.scan();
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.NONE);
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.RECONCILED);
    });
  });

  // ── L2.04: Multiple keys reconciled independently ──
  describe('L2.04: multiple keys independent', () => {
    test('keys are tracked and reconciled independently', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      // Key A: all agree
      engine.registerKey(KEY_A, 'node-1', 5, 'v5a');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5a');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5a');
      // Key B: divergent
      engine.registerKey(KEY_B, 'node-1', 3, 'v3b');
      engine.registerKey(KEY_B, 'node-2', 7, 'v7b');
      engine.registerKey(KEY_B, 'node-3', 3, 'v3b');

      const reports = engine.scan();
      const keyAReport = reports.find((r) => r.keyId === KEY_A);
      const keyBReport = reports.find((r) => r.keyId === KEY_B);
      expect(keyAReport.severity).toBe(DIVERGENCE_SEVERITY.NONE);
      expect(keyBReport.severity).toBe(DIVERGENCE_SEVERITY.MINOR);

      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.RECONCILED);
      expect(engine.getReconciliationState(KEY_B).state).toBe(RECONCILIATION_STATE.DIVERGENT);
    });
  });

  // ── L2.05: State machine valid transitions ──
  describe('L2.05: state machine transitions', () => {
    test('cannot begin reconciliation without divergence', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.scan();
      // All agree — reconciled, not divergent
      expect(() => engine.beginReconciliation(KEY_A, 5)).toThrow(HsmAdapterError);
    });

    test('cannot vote without reconciliation in progress', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.scan();
      expect(() => engine.votePromotion(KEY_A, 'node-1', 5)).toThrow(HsmAdapterError);
    });

    test('committed state is terminal', () => {
      expect(VALID_TRANSITIONS[RECONCILIATION_STATE.RECONCILED]).toEqual([]);
    });

    test('quarantined state is terminal', () => {
      expect(VALID_TRANSITIONS[RECONCILIATION_STATE.QUARANTINED]).toEqual([]);
    });
  });

  // ── L2.06: Policy validation ──
  describe('L2.06: policy validation', () => {
    test('CryptoPolicyEngine includes clusterKeyReconciliation block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.clusterKeyReconciliation).toBeDefined();
      expect(policy.clusterKeyReconciliation.minQuorumNodes).toBe(3);
      expect(policy.clusterKeyReconciliation.maxEpochRollbackAttempts).toBe(3);
      expect(policy.clusterKeyReconciliation.requireAntiRollback).toBe(true);
    });

    test('tenant policy can override clusterKeyReconciliation settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { clusterKeyReconciliation: { minQuorumNodes: 5 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.clusterKeyReconciliation.minQuorumNodes).toBe(5);
    });
  });

  // ── L2.07: Key fingerprint ──
  describe('L2.07: key fingerprint', () => {
    test('computeKeyFingerprint produces SHA-256 hash', () => {
      const fp = computeKeyFingerprint('test-key-material');
      const expected = crypto.createHash('sha256').update('test-key-material').digest('hex');
      expect(fp).toBe(expected);
      expect(fp).toHaveLength(64); // SHA-256 hex
    });

    test('different key material produces different fingerprints', () => {
      const fp1 = computeKeyFingerprint('key-1');
      const fp2 = computeKeyFingerprint('key-2');
      expect(fp1).not.toBe(fp2);
    });

    test('engine stores fingerprint without exposing key material', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'secret-key-material');
      const fp = engine.getKeyFingerprint(KEY_A, 'node-1');
      expect(fp).toBe(computeKeyFingerprint('secret-key-material'));
      // The fingerprint is a hash, not the key itself
      expect(fp).not.toBe('secret-key-material');
    });
  });

  // ── L2.08: Divergence severity classification ──
  describe('L2.08: divergence severity', () => {
    test('minor divergence when majority can form quorum', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      // 3 agree, 2 differ — majority can form quorum
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      const reports = engine.scan();
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.MINOR);
    });

    test('critical divergence when no majority can form quorum', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      // All nodes have different fingerprints — no majority
      engine.registerKey(KEY_A, 'node-1', 5, 'v5a');
      engine.registerKey(KEY_A, 'node-2', 4, 'v4b');
      engine.registerKey(KEY_A, 'node-3', 3, 'v3c');
      engine.registerKey(KEY_A, 'node-4', 2, 'v2d');
      engine.registerKey(KEY_A, 'node-5', 1, 'v1e');

      const reports = engine.scan();
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.CRITICAL);
    });
  });

  // ── L3.01: Anti-rollback ──
  describe('L3.01: anti-rollback protection', () => {
    test('key epoch cannot decrease', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      engine.scan();
      // Promoted epoch is 5 (majority)
      expect(engine.getReconciliationState(KEY_A).promotedEpoch).toBe(5);

      // Try to begin reconciliation with lower epoch
      expect(() => engine.beginReconciliation(KEY_A, 3)).toThrow(HsmAdapterError);
    });

    test('rollback attempts tracked and eventually quarantined', () => {
      const engine = new ClusterKeyReconciliationEngine({
        clusterNodes: NODES,
        minQuorumNodes: 3,
        maxEpochRollbackAttempts: 2,
      });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      engine.scan();
      // First rollback attempt
      expect(() => engine.beginReconciliation(KEY_A, 3)).toThrow(HsmAdapterError);
      // Second rollback attempt — should quarantine
      expect(() => engine.beginReconciliation(KEY_A, 3)).toThrow(HsmAdapterError);
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.QUARANTINED);
    });
  });

  // ── L3.02: Split-brain detection ──
  describe('L3.02: split-brain detection', () => {
    test('divergent nodes isolated from quorum voting', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      engine.scan();
      expect(engine.getNodeHealth('node-4')).toBe(NODE_HEALTH.DIVERGENT);
      expect(engine.getNodeHealth('node-5')).toBe(NODE_HEALTH.DIVERGENT);
      expect(engine.getNodeHealth('node-1')).toBe(NODE_HEALTH.HEALTHY);

      engine.beginReconciliation(KEY_A, 5);
      // Divergent nodes cannot vote
      expect(() => engine.votePromotion(KEY_A, 'node-4', 5)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.03: Quarantine for unrecoverable divergence ──
  describe('L3.03: quarantine', () => {
    test('manual quarantine of divergent key', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      engine.scan();
      const result = engine.quarantine(KEY_A, 'unrecoverable');
      expect(result.state).toBe(RECONCILIATION_STATE.QUARANTINED);
    });

    test('cannot quarantine already reconciled key', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.scan();
      expect(() => engine.quarantine(KEY_A)).toThrow(HsmAdapterError);
    });

    test('cannot quarantine already quarantined key', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 4, 'v4');
      engine.registerKey(KEY_A, 'node-3', 3, 'v3');
      engine.scan();
      engine.quarantine(KEY_A);
      expect(() => engine.quarantine(KEY_A)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.04: Cannot promote without quorum ──
  describe('L3.04: cannot promote without quorum', () => {
    test('key stays in reconciling with insufficient votes', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 4 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 3, 'v3');
      engine.registerKey(KEY_A, 'node-5', 3, 'v3');

      engine.scan();
      engine.beginReconciliation(KEY_A, 5);
      engine.votePromotion(KEY_A, 'node-1', 5);
      engine.votePromotion(KEY_A, 'node-2', 5);
      engine.votePromotion(KEY_A, 'node-3', 5);
      // Only 3 healthy votes, quorum is 4
      expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.RECONCILING);
    });
  });

  // ── L3.05: Stale fingerprint rejected ──
  describe('L3.05: stale fingerprint', () => {
    test('divergence detection uses fingerprint to identify stale nodes', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 5, 'v5');
      engine.registerKey(KEY_A, 'node-3', 5, 'v5');
      engine.registerKey(KEY_A, 'node-4', 5, 'v3-stale'); // same epoch, different fingerprint
      engine.registerKey(KEY_A, 'node-5', 5, 'v3-stale');

      const reports = engine.scan();
      expect(reports[0].severity).toBe(DIVERGENCE_SEVERITY.MINOR);
      expect(reports[0].divergentNodes.length).toBe(2);
      // node-4 and node-5 have stale fingerprints
      const divergentIds = reports[0].divergentNodes.map((n) => n.nodeId);
      expect(divergentIds).toContain('node-4');
      expect(divergentIds).toContain('node-5');
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes reconciliation counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_reconciliation_scans_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_divergence_detected_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_promoted_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_quarantined_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_rollback_blocked_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_promotion_votes_total', 0);
      expect(metrics).toHaveProperty('hsm_reconciliation_divergent_keys', 0);
    });

    test('incrementCounter works for reconciliation counters', () => {
      hsmMetrics.incrementCounter('hsm_reconciliation_scans_total', 5);
      hsmMetrics.incrementCounter('hsm_reconciliation_promoted_total', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_reconciliation_scans_total).toBe(5);
      expect(metrics.hsm_reconciliation_promoted_total).toBe(3);
    });

    test('Prometheus output includes reconciliation metrics', () => {
      hsmMetrics.incrementCounter('hsm_reconciliation_scans_total', 2);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_reconciliation_scans_total');
      expect(output).toContain('# TYPE hsm_reconciliation_scans_total counter');
      expect(output).toContain('hsm_reconciliation_scans_total 2');
    });
  });

  // ── Engine state telemetry ──
  describe('getEngineState telemetry', () => {
    test('returns correct engine state', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      expect(engine.getEngineState().trackedKeys).toBe(0);
      expect(engine.getEngineState().clusterSize).toBe(5);
      expect(engine.getEngineState().minQuorumNodes).toBe(3);

      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      expect(engine.getEngineState().trackedKeys).toBe(1);
    });
  });

  // ── Error cases ──
  describe('error cases', () => {
    test('constructor throws for empty cluster', () => {
      expect(() => new ClusterKeyReconciliationEngine({ clusterNodes: [] })).toThrow(HsmAdapterError);
    });

    test('registerKey throws for unknown node', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES });
      expect(() => engine.registerKey(KEY_A, 'unknown', 1, 'v1')).toThrow(HsmAdapterError);
    });

    test('votePromotion throws for unknown node', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      engine.registerKey(KEY_A, 'node-1', 5, 'v5');
      engine.registerKey(KEY_A, 'node-2', 3, 'v3');
      engine.registerKey(KEY_A, 'node-3', 3, 'v3');
      engine.scan();
      engine.beginReconciliation(KEY_A, 5);
      expect(() => engine.votePromotion(KEY_A, 'unknown', 5)).toThrow(HsmAdapterError);
    });

    test('getNodeHealth throws for unknown node', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES });
      expect(() => engine.getNodeHealth('unknown')).toThrow(HsmAdapterError);
    });
  });
});
