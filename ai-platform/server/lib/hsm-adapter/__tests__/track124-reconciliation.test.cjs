'use strict';

/**
 * Track 124: Per-op tenant boundary enforcement across reconciliation,
 * enclave sync, and cross-cluster migration engines.
 */

const { ClusterKeyReconciliationEngine, RECONCILIATION_STATE } = require('../cluster-key-reconciliation-engine.cjs');
const { CrossEnclaveStateSync } = require('../cross-enclave-state-sync.cjs');
const { CrossClusterMigrationEngine, MIGRATION_STATE } = require('../cross-cluster-migration-engine.cjs');
const { ensureSameTenant } = require('../../replication-tenant-context.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 124: reconciliation tenant boundary enforcement', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  const NODES = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
  const KEY_A = 'key-a';
  const TENANT_A = 'tenant-a';
  const TENANT_B = 'tenant-b';
  const SHARDS = [
    { shardId: 'shard-a', entryCount: 10, vectorClockSnapshot: { 'node-1': 1 } },
  ];

  function seedDivergentKey(engine) {
    engine.registerKey(KEY_A, 'node-1', 5, 'v5', TENANT_A);
    engine.registerKey(KEY_A, 'node-2', 5, 'v5', TENANT_A);
    engine.registerKey(KEY_A, 'node-3', 5, 'v5', TENANT_A);
    engine.registerKey(KEY_A, 'node-4', 3, 'v3', TENANT_A);
    engine.registerKey(KEY_A, 'node-5', 3, 'v3', TENANT_A);
    engine.scan();
    expect(engine.getReconciliationState(KEY_A).state).toBe(RECONCILIATION_STATE.DIVERGENT);
  }

  describe('ensureSameTenant (shared gate)', () => {
    test('allows matching tenant identifiers', () => {
      expect(() => ensureSameTenant(TENANT_A, TENANT_A)).not.toThrow();
    });

    test('rejects cross-tenant mismatch and increments isolation counter', () => {
      const before = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(() => ensureSameTenant(TENANT_A, TENANT_B)).toThrow(/zk_isolation_violation/);
      const after = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(after).toBe(before + 1);
    });

    test('rejects invalid tenant identifiers', () => {
      expect(() => ensureSameTenant('', TENANT_A)).toThrow(/zk_isolation_violation/);
    });
  });

  describe('cluster-key-reconciliation-engine (orchestrator)', () => {
    test('matching tenant: register → reconcile succeeds', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      seedDivergentKey(engine);
      const result = engine.beginReconciliation(KEY_A, 5, TENANT_A);
      expect(result.state).toBe(RECONCILIATION_STATE.RECONCILING);
    });

    test('cross-tenant mismatch truncates reconciliation', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      seedDivergentKey(engine);
      const before = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(() => engine.beginReconciliation(KEY_A, 5, TENANT_B)).toThrow(HsmAdapterError);
      const after = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(after).toBe(before + 1);
    });

    test('cross-tenant votePromotion is rejected', () => {
      const engine = new ClusterKeyReconciliationEngine({ clusterNodes: NODES, minQuorumNodes: 3 });
      seedDivergentKey(engine);
      engine.beginReconciliation(KEY_A, 5, TENANT_A);
      expect(() => engine.votePromotion(KEY_A, 'node-1', 5, TENANT_B)).toThrow(HsmAdapterError);
    });
  });

  describe('cross-enclave-state-sync (enclave sync worker)', () => {
    test('matching tenant: block replication sync succeeds', () => {
      const sync = new CrossEnclaveStateSync({ replicationFactor: 2, minSyncQuorum: 2, maxEnclaves: 4 });
      sync.registerEnclave('e1', { tenantId: TENANT_A });
      sync.registerEnclave('e2', { tenantId: TENANT_A });
      sync.registerEnclave('e3', { tenantId: TENANT_A });
      sync.createShard('shard-1', TENANT_A);
      const remoteState = { cfg: { value: { mode: 'live' }, timestamp: 100, enclaveId: 'e2', sequence: 1 } };
      const result = sync.syncState('shard-1', 'e2', remoteState, { e2: 1 }, TENANT_A);
      expect(result.merged).toBe(1);
    });

    test('cross-tenant sync is rejected before merge', () => {
      const sync = new CrossEnclaveStateSync({ replicationFactor: 2, minSyncQuorum: 2, maxEnclaves: 4 });
      sync.registerEnclave('e1', { tenantId: TENANT_A });
      sync.registerEnclave('e2', { tenantId: TENANT_A });
      sync.registerEnclave('e3', { tenantId: TENANT_A });
      sync.createShard('shard-1', TENANT_A);
      const before = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(() => sync.syncState('shard-1', 'e2', {}, {}, TENANT_B)).toThrow(HsmAdapterError);
      const after = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(after).toBe(before + 1);
    });
  });

  describe('cross-cluster-migration-engine (migration router)', () => {
    test('matching tenant: migration lifecycle proceeds through attest', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: NODES.slice(0, 3), minQuorumNodes: 2 });
      const manifest = engine.initiate({
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
      }, TENANT_A);
      engine.attest(manifest.migrationId, 'mock-authority', 'token', TENANT_A);
      expect(engine.getMigrationState(manifest.migrationId).state).toBe(MIGRATION_STATE.ATTESTED);
    });

    test('cross-tenant attest is rejected', () => {
      const engine = new CrossClusterMigrationEngine({ destinationNodes: NODES.slice(0, 3), minQuorumNodes: 2 });
      const manifest = engine.initiate({
        sourceCluster: 'east',
        destinationCluster: 'west',
        shards: SHARDS,
      }, TENANT_A);
      const before = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(() => engine.attest(manifest.migrationId, 'mock-authority', 'token', TENANT_B)).toThrow(HsmAdapterError);
      const after = hsmMetrics.getMetrics().hsm_zk_tenant_isolation_violation_total || 0;
      expect(after).toBe(before + 1);
    });
  });
});
