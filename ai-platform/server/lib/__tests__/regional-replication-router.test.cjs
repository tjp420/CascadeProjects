'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  RegionalReplicationRouter,
  CONFLICT_STRATEGIES,
  SYNC_STATUS,
  hashPayload,
  validatePayload
} = require('../regional-replication-router.cjs');

/**
 * Test zones — no real endpoints, uses mock fetch.
 */
const TEST_ZONES = [
  { id: 'us-east', endpoint: 'https://us.example.com/api/replication', apiKeyEnv: 'TEST_US_KEY' },
  { id: 'eu-west', endpoint: 'https://eu.example.com/api/replication', apiKeyEnv: 'TEST_EU_KEY' },
  { id: 'ap-southeast', endpoint: 'https://ap.example.com/api/replication', apiKeyEnv: 'TEST_AP_KEY' }
];

/**
 * Create a mock fetch function that succeeds.
 * @returns {Function}
 */
function mockFetchSuccess() {
  return async (url, opts) => {
    return { acknowledged: true, url, mock: true };
  };
}

/**
 * Create a mock fetch function that fails N times then succeeds.
 * @param {number} failCount
 * @returns {Function}
 */
function mockFetchFailThenSucceed(failCount) {
  let calls = 0;
  return async (url, opts) => {
    calls++;
    if (calls <= failCount) {
      throw new Error(`Simulated failure ${calls}`);
    }
    return { acknowledged: true, url, attempt: calls };
  };
}

/**
 * Create a mock fetch function that always fails.
 * @returns {Function}
 */
function mockFetchAlwaysFail() {
  return async () => {
    throw new Error('Permanent failure');
  };
}

describe('regional-replication-router', () => {

  describe('hashPayload', () => {
    it('produces a stable 16-char hex hash', () => {
      const h1 = hashPayload({ type: 'scan', data: { id: 1 } });
      const h2 = hashPayload({ type: 'scan', data: { id: 1 } });
      assert.strictEqual(h1, h2);
      assert.strictEqual(h1.length, 16);
      assert.match(h1, /^[0-9a-f]{16}$/);
    });

    it('produces different hashes for different payloads', () => {
      const h1 = hashPayload({ type: 'scan', data: { id: 1 } });
      const h2 = hashPayload({ type: 'scan', data: { id: 2 } });
      assert.notStrictEqual(h1, h2);
    });
  });

  describe('validatePayload', () => {
    it('accepts a valid payload', () => {
      assert.doesNotThrow(() => validatePayload({ type: 'scan', data: { id: 1 } }));
    });

    it('rejects null', () => {
      assert.throws(() => validatePayload(null), /non-null object/);
    });

    it('rejects missing type', () => {
      assert.throws(() => validatePayload({ data: {} }), /string "type"/);
    });

    it('rejects missing data', () => {
      assert.throws(() => validatePayload({ type: 'scan' }), /object "data"/);
    });
  });

  describe('constructor', () => {
    it('initializes with default zones', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      const status = router.getStatus();
      assert.ok(status['us-east'], 'should have us-east zone');
      assert.ok(status['eu-west'], 'should have eu-west zone');
      assert.ok(status['ap-southeast'], 'should have ap-southeast zone');
    });

    it('initializes with custom zones', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const status = router.getStatus();
      assert.ok(status['us-east']);
      assert.ok(status['eu-west']);
      assert.ok(status['ap-southeast']);
    });

    it('accepts custom retry config', () => {
      const router = new RegionalReplicationRouter({
        fetchFn: mockFetchSuccess(),
        retry: { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 500 }
      });
      assert.strictEqual(router.retry.maxAttempts, 5);
      assert.strictEqual(router.retry.baseDelayMs, 100);
    });
  });

  describe('registerZone', () => {
    it('registers a new zone', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      router.registerZone({ id: 'sa-east', endpoint: 'https://sa.example.com' });
      assert.ok(router.zones.get('sa-east'));
    });

    it('throws on missing zone id', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      assert.throws(() => router.registerZone({}), /must have an id/);
    });
  });

  describe('getStatus', () => {
    it('returns status for all zones', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const status = router.getStatus();
      assert.strictEqual(Object.keys(status).length, 3);
      for (const id of Object.keys(status)) {
        assert.strictEqual(status[id].status, SYNC_STATUS.IDLE);
        assert.strictEqual(status[id].syncCount, 0);
      }
    });

    it('returns status for a single zone', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const status = router.getZoneStatus('us-east');
      assert.strictEqual(status.id, 'us-east');
      assert.strictEqual(status.status, SYNC_STATUS.IDLE);
    });

    it('returns null for unknown zone', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      assert.strictEqual(router.getZoneStatus('unknown'), null);
    });
  });

  describe('sync', () => {
    it('syncs a payload to a single zone successfully', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const result = await router.sync('us-east', { type: 'scan', data: { id: 'test-1' } });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, SYNC_STATUS.SUCCESS);
      assert.strictEqual(result.zoneId, 'us-east');

      const status = router.getZoneStatus('us-east');
      assert.strictEqual(status.status, SYNC_STATUS.SUCCESS);
      assert.strictEqual(status.syncCount, 1);
      assert.ok(status.lastSync);
    });

    it('throws on unknown zone', async () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      await assert.rejects(
        router.sync('unknown', { type: 'scan', data: {} }),
        /Unknown zone/
      );
    });

    it('throws on invalid payload', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      await assert.rejects(
        router.sync('us-east', null),
        /non-null object/
      );
    });

    it('retries on transient failure then succeeds', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchFailThenSucceed(1),
        retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 }
      });
      const result = await router.sync('us-east', { type: 'scan', data: { id: 'retry-1' } });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempt, 2);
      const status = router.getZoneStatus('us-east');
      assert.strictEqual(status.syncCount, 1);
      assert.strictEqual(status.failCount, 0);
    });

    it('marks zone as degraded after max retries exhausted', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchAlwaysFail(),
        retry: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
      });
      const result = await router.sync('us-east', { type: 'scan', data: { id: 'fail-1' } });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, SYNC_STATUS.DEGRADED);
      assert.strictEqual(result.attempts, 2);
      const status = router.getZoneStatus('us-east');
      assert.strictEqual(status.status, SYNC_STATUS.DEGRADED);
      assert.strictEqual(status.failCount, 1);
      assert.ok(status.lastError);
    });

    it('succeeds without endpoint (local dev mode)', async () => {
      const router = new RegionalReplicationRouter({
        zones: [{ id: 'local', endpoint: '', apiKeyEnv: null }],
        fetchFn: mockFetchSuccess()
      });
      const result = await router.sync('local', { type: 'scan', data: { id: 'local-1' } });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result.mock, true);
    });
  });

  describe('syncAll', () => {
    it('syncs a payload to all zones', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const results = await router.syncAll({ type: 'scan', data: { id: 'all-1' } });
      assert.strictEqual(Object.keys(results).length, 3);
      for (const zoneId of Object.keys(results)) {
        assert.strictEqual(results[zoneId].success, true);
      }
    });

    it('continues syncing other zones if one fails', async () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: async (url) => {
          if (url.includes('eu.example.com')) throw new Error('EU zone down');
          return { acknowledged: true };
        },
        retry: { maxAttempts: 1, baseDelayMs: 10, maxDelayMs: 50 }
      });
      const results = await router.syncAll({ type: 'scan', data: { id: 'mixed-1' } });
      assert.strictEqual(results['us-east'].success, true);
      assert.strictEqual(results['eu-west'].success, false);
      assert.strictEqual(results['ap-southeast'].success, true);
    });
  });

  describe('conflict detection and resolution', () => {
    it('detects a conflict when same version has different content', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa', timestamp: '2026-01-01T00:00:00Z' };
      const incoming = { type: 'scan', version: 'v1', sourceHash: 'bbb', timestamp: '2026-01-02T00:00:00Z' };
      assert.strictEqual(router.detectConflict(existing, incoming), true);
    });

    it('does not detect conflict for different versions', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa' };
      const incoming = { type: 'scan', version: 'v2', sourceHash: 'bbb' };
      assert.strictEqual(router.detectConflict(existing, incoming), false);
    });

    it('does not detect conflict for different types', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa' };
      const incoming = { type: 'telemetry', version: 'v1', sourceHash: 'bbb' };
      assert.strictEqual(router.detectConflict(existing, incoming), false);
    });

    it('records and retrieves a conflict', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa', timestamp: '2026-01-01T00:00:00Z' };
      const incoming = { type: 'scan', version: 'v1', sourceHash: 'bbb', timestamp: '2026-01-02T00:00:00Z' };
      router.recordConflict('us-east', existing, incoming);
      const conflicts = router.getConflicts();
      assert.strictEqual(conflicts.length, 1);
      assert.strictEqual(conflicts[0].zoneId, 'us-east');
      assert.strictEqual(conflicts[0].resolved, false);
    });

    it('resolves a conflict with latest-wins strategy', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa', timestamp: '2026-01-01T00:00:00Z' };
      const incoming = { type: 'scan', version: 'v1', sourceHash: 'bbb', timestamp: '2026-01-02T00:00:00Z' };
      router.recordConflict('us-east', existing, incoming);
      const conflictId = 'us-east:scan';
      const result = router.resolveConflict(conflictId, CONFLICT_STRATEGIES.LATEST_WINS);
      assert.strictEqual(result.resolved, true);
      assert.strictEqual(result.winner, 'v1');
      assert.strictEqual(router.getConflicts().length, 0);
    });

    it('resolves a conflict with manual strategy', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      const existing = { type: 'scan', version: 'v1', sourceHash: 'aaa', timestamp: '2026-01-01T00:00:00Z' };
      const incoming = { type: 'scan', version: 'v1', sourceHash: 'bbb', timestamp: '2026-01-02T00:00:00Z' };
      router.recordConflict('us-east', existing, incoming);
      const manualPayload = { type: 'scan', version: 'v1-manual', sourceHash: 'ccc', timestamp: '2026-01-03T00:00:00Z' };
      const result = router.resolveConflict('us-east:scan', CONFLICT_STRATEGIES.MANUAL, manualPayload);
      assert.strictEqual(result.resolved, true);
      assert.strictEqual(result.winner, 'v1-manual');
    });

    it('throws when resolving unknown conflict', () => {
      const router = new RegionalReplicationRouter({ fetchFn: mockFetchSuccess() });
      assert.throws(
        () => router.resolveConflict('unknown', CONFLICT_STRATEGIES.LATEST_WINS),
        /Conflict not found/
      );
    });

    it('throws when manual strategy lacks payload', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      router.recordConflict('us-east',
        { type: 'scan', version: 'v1', sourceHash: 'aaa', timestamp: '2026-01-01T00:00:00Z' },
        { type: 'scan', version: 'v1', sourceHash: 'bbb', timestamp: '2026-01-02T00:00:00Z' }
      );
      assert.throws(
        () => router.resolveConflict('us-east:scan', CONFLICT_STRATEGIES.MANUAL),
        /manualPayload required/
      );
    });
  });

  describe('getZoneApiKey', () => {
    it('reads API key from environment', () => {
      process.env.TEST_US_KEY = 'secret-key-123';
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      assert.strictEqual(router.getZoneApiKey('us-east'), 'secret-key-123');
      delete process.env.TEST_US_KEY;
    });

    it('returns null when env var is not set', () => {
      const router = new RegionalReplicationRouter({
        zones: TEST_ZONES,
        fetchFn: mockFetchSuccess()
      });
      assert.strictEqual(router.getZoneApiKey('eu-west'), null);
    });
  });
});
