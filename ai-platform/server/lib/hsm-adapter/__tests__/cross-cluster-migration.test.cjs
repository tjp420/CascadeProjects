'use strict';

const crypto = require('crypto');
const {
  CrossClusterMigrationEngine,
  MigrationManifest,
  MIGRATION_STATE,
  VALID_TRANSITIONS,
} = require('../cross-cluster-migration-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('CrossClusterMigrationEngine — Track 34 Cross-Cluster Migration', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  const DEST_NODES = ['dest-1', 'dest-2', 'dest-3', 'dest-4', 'dest-5'];
  const SHARDS = [
    { shardId: 'shard-a', entryCount: 100, vectorClockSnapshot: { 'node-1': 100, 'node-2': 100 } },
    { shardId: 'shard-b', entryCount: 50, vectorClockSnapshot: { 'node-1': 50, 'node-2': 50 } },
  ];

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path migration lifecycle', () => {
    test('initiate → attest → transfer → verify → ack (quorum) → commit', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({
        sourceCluster: 'cluster-east',
        destinationCluster: 'cluster-west',
        shards: SHARDS,
      });

      expect(manifest.migrationId).toBe('migration-1');
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.INITIATED);

      engine.attest(manifest.migrationId, 'mock-authority', 'attest-token');
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.ATTESTED);

      engine.beginTransfer(manifest.migrationId);
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.TRANSFERRING);

      engine.verify(manifest.migrationId, true);
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.VERIFYING);

      // 3 nodes acknowledge (quorum = 3)
      const r1 = engine.acknowledge(manifest.migrationId, 'dest-1');
      expect(r1.committed).toBe(false);
      engine.acknowledge(manifest.migrationId, 'dest-2');
      const r3 = engine.acknowledge(manifest.migrationId, 'dest-3');
      expect(r3.committed).toBe(true);

      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.COMMITTED);
    });
  });

  // ── L2.02: MigrationManifest ──
  describe('L2.02: MigrationManifest', () => {
    test('carries shard IDs, vector-clock snapshot, and entry counts', () => {
      const manifest = new MigrationManifest({
        migrationId: 'migration-test',
        sourceCluster: 'cluster-east',
        destinationCluster: 'cluster-west',
        shards: SHARDS,
      });

      expect(manifest.shardIds()).toEqual(['shard-a', 'shard-b']);
      expect(manifest.totalEntryCount()).toBe(150);
      expect(manifest.shards[0].vectorClockSnapshot).toBeDefined();
      expect(manifest.shards[0].vectorClockSnapshot['node-1']).toBe(100);
    });

    test('computes a deterministic hash', () => {
      const manifest1 = new MigrationManifest({
        migrationId: 'm1',
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
        timestamp: 1000,
      });
      const manifest2 = new MigrationManifest({
        migrationId: 'm1',
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
        timestamp: 1000,
      });
      expect(manifest1.hash).toBe(manifest2.hash);
    });

    test('verifyIntegrity returns true for unmodified manifest', () => {
      const manifest = new MigrationManifest({
        migrationId: 'm1',
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
      });
      expect(manifest.verifyIntegrity()).toBe(true);
    });

    test('verifyIntegrity returns false for tampered manifest', () => {
      const manifest = new MigrationManifest({
        migrationId: 'm1',
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
      });
      manifest.shards[0].entryCount = 999; // tamper
      expect(manifest.verifyIntegrity()).toBe(false);
    });

    test('attest attaches attestation', () => {
      const manifest = new MigrationManifest({
        migrationId: 'm1',
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
      });
      expect(manifest.attestation).toBeNull();
      manifest.attest('mock-authority', 'token');
      expect(manifest.attestation).toBeDefined();
      expect(manifest.attestation.authority).toBe('mock-authority');
    });
  });

  // ── L2.03: BFT quorum commit gating ──
  describe('L2.03: quorum commit gating', () => {
    test('migration not committed until quorum reached', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 4 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);

      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      engine.acknowledge(manifest.migrationId, 'dest-3');
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.VERIFYING); // 3 < 4

      engine.acknowledge(manifest.migrationId, 'dest-4');
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.COMMITTED); // 4 >= 4
    });
  });

  // ── L2.04: Multiple shards in single migration ──
  describe('L2.04: multiple shards in single migration', () => {
    test('multiple shards are migrated together', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: [
          { shardId: 'shard-a', entryCount: 100, vectorClockSnapshot: {} },
          { shardId: 'shard-b', entryCount: 200, vectorClockSnapshot: {} },
          { shardId: 'shard-c', entryCount: 300, vectorClockSnapshot: {} },
        ],
      });

      const state = engine.getMigrationState(manifest.migrationId);
      expect(state.manifest.shardIds).toEqual(['shard-a', 'shard-b', 'shard-c']);
      expect(state.manifest.totalEntryCount).toBe(600);
    });
  });

  // ── L2.05: State machine valid transitions ──
  describe('L2.05: state machine transitions', () => {
    test('valid transitions are enforced', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });

      // Cannot skip attest
      expect(() => engine.beginTransfer(manifest.migrationId)).toThrow(HsmAdapterError);

      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      // Cannot skip transfer
      expect(() => engine.verify(manifest.migrationId, true)).toThrow(HsmAdapterError);

      engine.beginTransfer(manifest.migrationId);
      // Cannot ack before verify
      expect(() => engine.acknowledge(manifest.migrationId, 'dest-1')).toThrow(HsmAdapterError);

      engine.verify(manifest.migrationId, true);
      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      engine.acknowledge(manifest.migrationId, 'dest-3');
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.COMMITTED);
    });

    test('cannot transition from committed to any state', () => {
      expect(VALID_TRANSITIONS[MIGRATION_STATE.COMMITTED]).toEqual([]);
    });

    test('cannot transition from rolled_back to any state', () => {
      expect(VALID_TRANSITIONS[MIGRATION_STATE.ROLLED_BACK]).toEqual([]);
    });
  });

  // ── L2.06/L2.07/L2.08: Policy and attestation ──
  describe('L2.06/L2.07/L2.08: policy and attestation', () => {
    test('CryptoPolicyEngine includes crossClusterMigration block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.crossClusterMigration).toBeDefined();
      expect(policy.crossClusterMigration.minQuorumNodes).toBe(3);
      expect(policy.crossClusterMigration.requireAttestation).toBe(true);
      expect(policy.crossClusterMigration.maxConcurrentMigrations).toBe(16);
    });

    test('tenant policy can override crossClusterMigration settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { crossClusterMigration: { minQuorumNodes: 5 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.crossClusterMigration.minQuorumNodes).toBe(5);
    });

    test('attestation required before transfer begins', () => {
      const engine = new CrossClusterMigrationEngine({
        destinationNodes: DEST_NODES,
        minQuorumNodes: 3,
        requireAttestation: true,
      });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });

      // Should throw when trying to transfer without attestation
      expect(() => engine.beginTransfer(manifest.migrationId)).toThrow(HsmAdapterError);
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.INITIATED);
    });

    test('manifest includes vector-clock checkpoint', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: [{ shardId: 'shard-a', entryCount: 100, vectorClockSnapshot: { 'node-1': 100, 'node-2': 100, 'node-3': 99 } }],
      });

      expect(manifest.shards[0].vectorClockSnapshot).toEqual({ 'node-1': 100, 'node-2': 100, 'node-3': 99 });
    });
  });

  // ── L3.01: Rollback on verification failure ──
  describe('L3.01: rollback on verification failure', () => {
    test('verification failure rolls back migration', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, false);

      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.ROLLED_BACK);
    });
  });

  // ── L3.02: Rollback on quorum failure ──
  describe('L3.02: rollback on quorum failure', () => {
    test('manual rollback when quorum not reached', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);

      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      // Only 2 acks, quorum is 3 — rollback
      const result = engine.rollback(manifest.migrationId, 'quorum not reached');
      expect(result.status).toBe(MIGRATION_STATE.ROLLED_BACK);
    });
  });

  // ── L3.03: Replay protection — duplicate migration ID ──
  describe('L3.03/L3.04: replay protection', () => {
    test('migration IDs are unique and monotonic', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const m1 = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      const m2 = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      expect(m1.migrationId).toBe('migration-1');
      expect(m2.migrationId).toBe('migration-2');
      expect(m1.migrationId).not.toBe(m2.migrationId);
    });

    test('committed migration cannot be acked again', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);
      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      engine.acknowledge(manifest.migrationId, 'dest-3');

      // Already committed — further ack should fail
      expect(() => engine.acknowledge(manifest.migrationId, 'dest-4')).toThrow(HsmAdapterError);
    });
  });

  // ── L3.05: Unauthorized attestation authority ──
  describe('L3.05: unauthorized attestation', () => {
    test('unauthorized attestation authority rejected', () => {
      const engine = new CrossClusterMigrationEngine({
        destinationNodes: DEST_NODES,
        minQuorumNodes: 3,
        allowedAttestationAuthorities: ['mock-authority'],
      });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });

      expect(() => engine.attest(manifest.migrationId, 'evil-authority', 'token')).toThrow(HsmAdapterError);
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.ROLLED_BACK);
    });
  });

  // ── L3.06: Cannot commit without quorum ──
  describe('L3.06: cannot commit without quorum', () => {
    test('migration stays in verifying state with insufficient acks', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 4 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);

      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      engine.acknowledge(manifest.migrationId, 'dest-3');

      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.VERIFYING);
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes migration counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_migration_initiated_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_attested_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_committed_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_rolled_back_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_ack_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_verification_failed_total', 0);
      expect(metrics).toHaveProperty('hsm_migration_active', 0);
    });

    test('incrementCounter works for migration counters', () => {
      hsmMetrics.incrementCounter('hsm_migration_initiated_total', 3);
      hsmMetrics.incrementCounter('hsm_migration_committed_total', 2);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_migration_initiated_total).toBe(3);
      expect(metrics.hsm_migration_committed_total).toBe(2);
    });

    test('Prometheus output includes migration metrics', () => {
      hsmMetrics.incrementCounter('hsm_migration_initiated_total', 1);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_migration_initiated_total');
      expect(output).toContain('# TYPE hsm_migration_initiated_total counter');
      expect(output).toContain('hsm_migration_initiated_total 1');
    });
  });

  // ── Engine state telemetry ──
  describe('getEngineState telemetry', () => {
    test('returns correct engine state', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      expect(engine.getEngineState().totalMigrations).toBe(0);
      expect(engine.getEngineState().activeMigrations).toBe(0);
      expect(engine.getEngineState().destinationClusterSize).toBe(5);
      expect(engine.getEngineState().minQuorumNodes).toBe(3);

      engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      expect(engine.getEngineState().totalMigrations).toBe(1);
      expect(engine.getEngineState().activeMigrations).toBe(1);
    });
  });

  // ── Concurrency limit ──
  describe('concurrency limit', () => {
    test('max concurrent migrations enforced', () => {
      const engine = new CrossClusterMigrationEngine({
        destinationNodes: DEST_NODES,
        minQuorumNodes: 3,
        maxConcurrentMigrations: 2,
      });
      engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      expect(() => engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS })).toThrow(HsmAdapterError);
    });
  });

  // ── Rollback edge cases ──
  describe('rollback edge cases', () => {
    test('cannot rollback committed migration', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);
      engine.acknowledge(manifest.migrationId, 'dest-1');
      engine.acknowledge(manifest.migrationId, 'dest-2');
      engine.acknowledge(manifest.migrationId, 'dest-3');

      expect(() => engine.rollback(manifest.migrationId)).toThrow(HsmAdapterError);
    });

    test('cannot rollback already rolled back migration', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.rollback(manifest.migrationId);

      expect(() => engine.rollback(manifest.migrationId)).toThrow(HsmAdapterError);
    });
  });

  // ── Error cases ──
  describe('error cases', () => {
    test('constructor throws for empty destination nodes', () => {
      expect(() => new CrossClusterMigrationEngine({ destinationNodes: [] })).toThrow(HsmAdapterError);
    });

    test('attest throws for unknown migration', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES });
      expect(() => engine.attest('unknown', 'mock-authority', 'token')).toThrow(HsmAdapterError);
    });

    test('acknowledge throws for unknown node', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES, minQuorumNodes: 3 });
      const manifest = engine.initiate({ sourceCluster: 'east', destinationCluster: 'west', shards: SHARDS });
      engine.attest(manifest.migrationId, 'mock-authority', 'token');
      engine.beginTransfer(manifest.migrationId);
      engine.verify(manifest.migrationId, true);
      expect(() => engine.acknowledge(manifest.migrationId, 'unknown-node')).toThrow(HsmAdapterError);
    });

    test('getMigrationState throws for unknown migration', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: DEST_NODES });
      expect(() => engine.getMigrationState('unknown')).toThrow(HsmAdapterError);
    });
  });
});
