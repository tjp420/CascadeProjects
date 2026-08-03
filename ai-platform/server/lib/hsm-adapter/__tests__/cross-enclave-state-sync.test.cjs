'use strict';

/**
 * Track 44: Distributed Sharding and Cross-Enclave State Sync tests.
 */
const { CrossEnclaveStateSync, DEFAULT_OPTIONS, ENCLAVE_STATUS, SYNC_OP_TYPE } = require('../cross-enclave-state-sync.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 44: CrossEnclaveStateSync', () => {
  let sync;

  beforeEach(() => {
    sync = new CrossEnclaveStateSync({ replicationFactor: 3, minSyncQuorum: 2, maxEnclaves: 10 });
  });

  describe('enclave management', () => {
    test('registerEnclave adds an enclave', () => {
      sync.registerEnclave('enclave-1');
      const enclaves = sync.getEnclaves();
      expect(enclaves.length).toBe(1);
      expect(enclaves[0].id).toBe('enclave-1');
      expect(enclaves[0].status).toBe(ENCLAVE_STATUS.ACTIVE);
    });

    test('registerEnclave rejects empty ID', () => {
      expect(() => sync.registerEnclave('')).toThrow(HsmAdapterError);
    });

    test('registerEnclave rejects duplicate', () => {
      sync.registerEnclave('enclave-1');
      expect(() => sync.registerEnclave('enclave-1')).toThrow(HsmAdapterError);
    });

    test('registerEnclave enforces max limit', () => {
      const small = new CrossEnclaveStateSync({ maxEnclaves: 2, replicationFactor: 1, minSyncQuorum: 1 });
      small.registerEnclave('e1');
      small.registerEnclave('e2');
      expect(() => small.registerEnclave('e3')).toThrow(HsmAdapterError);
    });

    test('unregisterEnclave removes and reassigns shards', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.registerEnclave('e4');
      const assignment = sync.createShard('shard-1');
      expect(assignment.enclaveIds).toContain('e1');
      sync.unregisterEnclave('e1');
      const shard = sync.getShard('shard-1');
      expect(shard.enclaveIds).not.toContain('e1');
    });

    test('unregisterEnclave rejects unknown enclave', () => {
      expect(() => sync.unregisterEnclave('unknown')).toThrow(HsmAdapterError);
    });

    test('heartbeat updates enclave status', () => {
      sync.registerEnclave('e1');
      sync.heartbeat('e1', { status: ENCLAVE_STATUS.DEGRADED, load: 5 });
      const e = sync.getEnclaves()[0];
      expect(e.status).toBe(ENCLAVE_STATUS.DEGRADED);
      expect(e.load).toBe(5);
    });

    test('heartbeat rejects unknown enclave', () => {
      expect(() => sync.heartbeat('unknown')).toThrow(HsmAdapterError);
    });

    test('getActiveEnclaves filters by status', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.heartbeat('e2', { status: ENCLAVE_STATUS.OFFLINE });
      const active = sync.getActiveEnclaves();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('e1');
    });
  });

  describe('shard creation', () => {
    test('createShard assigns enclaves', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      const result = sync.createShard('shard-1');
      expect(result.shardId).toBe('shard-1');
      expect(result.enclaveIds.length).toBe(3);
    });

    test('createShard rejects empty ID', () => {
      expect(() => sync.createShard('')).toThrow(HsmAdapterError);
    });

    test('createShard rejects duplicate', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.createShard('shard-1');
      expect(() => sync.createShard('shard-1')).toThrow(HsmAdapterError);
    });

    test('createShard fails with insufficient enclaves', () => {
      sync.registerEnclave('e1');
      expect(() => sync.createShard('shard-1')).toThrow(HsmAdapterError);
    });

    test('createShard respects replication factor', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.registerEnclave('e4');
      sync.registerEnclave('e5');
      const result = sync.createShard('shard-1');
      expect(result.enclaveIds.length).toBe(3); // replicationFactor
    });
  });

  describe('writeState and readState', () => {
    test('writeState stores a value', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      const result = sync.writeState('shard-1', 'key-1', { data: 'value' }, 'e1');
      expect(result.shardId).toBe('shard-1');
      expect(result.key).toBe('key-1');
      expect(result.sequence).toBe(1);
    });

    test('readState retrieves a value', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.writeState('shard-1', 'key-1', { data: 'value' }, 'e1');
      const entry = sync.readState('shard-1', 'key-1');
      expect(entry).not.toBeNull();
      expect(entry.value.data).toBe('value');
      expect(entry.enclaveId).toBe('e1');
    });

    test('readState returns null for missing key', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      expect(sync.readState('shard-1', 'missing')).toBeNull();
    });

    test('writeState rejects unassigned enclave', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.registerEnclave('e4');
      sync.createShard('shard-1');
      // e4 is not assigned to shard-1 (replicationFactor=3, 4 enclaves)
      const shard = sync.getShard('shard-1');
      const unassigned = ['e1', 'e2', 'e3', 'e4'].find(e => !shard.enclaveIds.includes(e));
      expect(() => sync.writeState('shard-1', 'key-1', {}, unassigned)).toThrow(HsmAdapterError);
    });

    test('writeState rejects unknown shard', () => {
      expect(() => sync.writeState('unknown', 'key', {}, 'e1')).toThrow(HsmAdapterError);
    });

    test('writeState rejects oversized state', () => {
      const small = new CrossEnclaveStateSync({
        replicationFactor: 1, minSyncQuorum: 1, maxStateSizeBytes: 100,
      });
      small.registerEnclave('e1');
      small.createShard('shard-1');
      const bigValue = { data: 'x'.repeat(200) };
      expect(() => small.writeState('shard-1', 'key', bigValue, 'e1')).toThrow(HsmAdapterError);
    });

    test('writeState advances vector clock', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.writeState('shard-1', 'key-1', {}, 'e1');
      sync.writeState('shard-1', 'key-2', {}, 'e1');
      const vc = sync.getVectorClock('shard-1');
      expect(vc['e1']).toBe(2);
    });
  });

  describe('syncState', () => {
    test('merges new keys from remote', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      const result = sync.syncState('shard-1', 'e2', {
        'remote-key': { value: { data: 'remote' }, timestamp: Date.now(), enclaveId: 'e2', sequence: 1 },
      }, { e2: 1 });
      expect(result.merged).toBe(1);
      const entry = sync.readState('shard-1', 'remote-key');
      expect(entry.value.data).toBe('remote');
    });

    test('skips entries where local is newer', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.writeState('shard-1', 'key-1', { data: 'local' }, 'e1');
      const result = sync.syncState('shard-1', 'e2', {
        'key-1': { value: { data: 'remote' }, timestamp: 1, enclaveId: 'e2', sequence: 1 },
      }, { e2: 1 });
      expect(result.skipped).toBe(1);
      const entry = sync.readState('shard-1', 'key-1');
      expect(entry.value.data).toBe('local');
    });

    test('accepts remote when remote is newer', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.writeState('shard-1', 'key-1', { data: 'local' }, 'e1');
      const futureTs = Date.now() + 10000;
      const result = sync.syncState('shard-1', 'e2', {
        'key-1': { value: { data: 'remote' }, timestamp: futureTs, enclaveId: 'e2', sequence: 1 },
      }, { e2: 1 });
      expect(result.merged).toBe(1);
      const entry = sync.readState('shard-1', 'key-1');
      expect(entry.value.data).toBe('remote');
    });

    test('rejects sync from unassigned enclave', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.registerEnclave('e4');
      sync.createShard('shard-1');
      const shard = sync.getShard('shard-1');
      const unassigned = ['e1', 'e2', 'e3', 'e4'].find(e => !shard.enclaveIds.includes(e));
      expect(() => sync.syncState('shard-1', unassigned, {}, {})).toThrow(HsmAdapterError);
    });

    test('rejects sync for unknown shard', () => {
      expect(() => sync.syncState('unknown', 'e1', {}, {})).toThrow(HsmAdapterError);
    });

    test('merges vector clock from remote', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.syncState('shard-1', 'e2', {}, { e2: 5, e3: 3 });
      const vc = sync.getVectorClock('shard-1');
      expect(vc['e2']).toBe(5);
      expect(vc['e3']).toBe(3);
    });
  });

  describe('detectStaleEnclaves', () => {
    test('marks enclaves with old heartbeats as offline', () => {
      const fastSync = new CrossEnclaveStateSync({
        replicationFactor: 1, minSyncQuorum: 1, syncTimeoutMs: 50,
      });
      fastSync.registerEnclave('e1');
      fastSync.registerEnclave('e2');
      return new Promise(resolve => setTimeout(resolve, 150)).then(() => {
        const stale = fastSync.detectStaleEnclaves();
        expect(stale.length).toBe(2);
        const enclaves = fastSync.getEnclaves();
        expect(enclaves.every(e => e.status === ENCLAVE_STATUS.OFFLINE)).toBe(true);
      });
    });

    test('does not mark active enclaves as stale', () => {
      sync.registerEnclave('e1');
      sync.heartbeat('e1');
      const stale = sync.detectStaleEnclaves();
      expect(stale.length).toBe(0);
    });
  });

  describe('getShards and getShard', () => {
    test('getShards returns all shards', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.createShard('shard-2');
      const shards = sync.getShards();
      expect(shards.length).toBe(2);
    });

    test('getShard returns shard info', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      const shard = sync.getShard('shard-1');
      expect(shard.id).toBe('shard-1');
      expect(shard.enclaveIds.length).toBe(3);
      expect(shard.vectorClock).toBeDefined();
    });

    test('getShard returns null for unknown', () => {
      expect(sync.getShard('unknown')).toBeNull();
    });
  });

  describe('getSyncLog', () => {
    test('returns recent sync operations', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.syncState('shard-1', 'e2', { 'k': { value: 1, timestamp: Date.now(), enclaveId: 'e2', sequence: 1 } }, { e2: 1 });
      const log = sync.getSyncLog();
      expect(log.length).toBe(1);
      expect(log[0].shardId).toBe('shard-1');
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.writeState('shard-1', 'key-1', { data: 1 }, 'e1');
      const stats = sync.getStats();
      expect(stats.enclaveCount).toBe(3);
      expect(stats.activeEnclaves).toBe(3);
      expect(stats.shardCount).toBe(1);
      expect(stats.totalKeys).toBe(1);
      expect(stats.replicationFactor).toBe(3);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      sync.reset();
      expect(sync.getEnclaves().length).toBe(0);
      expect(sync.getShards().length).toBe(0);
    });
  });

  describe('round-robin assignment', () => {
    test('uses round-robin strategy when configured', () => {
      const rr = new CrossEnclaveStateSync({
        replicationFactor: 2, minSyncQuorum: 1,
        shardAssignmentStrategy: 'round-robin',
      });
      rr.registerEnclave('e1');
      rr.registerEnclave('e2');
      rr.registerEnclave('e3');
      const result = rr.createShard('shard-1');
      expect(result.enclaveIds.length).toBe(2);
    });
  });

  describe('conflict resolution', () => {
    test('last-writer-wins rejects stale writes', () => {
      sync.registerEnclave('e1');
      sync.registerEnclave('e2');
      sync.registerEnclave('e3');
      sync.createShard('shard-1');
      // Write with current timestamp
      sync.writeState('shard-1', 'key-1', { data: 'first' }, 'e1');
      // Manually set an older timestamp entry, then try to write older
      const shard = sync._shards.get('shard-1');
      shard.state.get('key-1').timestamp = Date.now() + 10000; // future
      const result = sync.writeState('shard-1', 'key-1', { data: 'stale' }, 'e2');
      expect(result.conflict).toBe(true);
      expect(result.resolved).toBe('rejected-stale');
    });
  });
});
