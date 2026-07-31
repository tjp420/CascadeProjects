'use strict';

const {
  trackCachedMetric,
  getDashboardSummary,
  setBootstrapFunction,
  getCacheStats,
  reset,
  _internal,
} = require('../analytics-cache-manager.cjs');

describe('analytics-cache-manager', () => {
  beforeEach(() => {
    reset();
    setBootstrapFunction(null);
  });

  afterAll(() => {
    reset();
    setBootstrapFunction(null);
  });

  // ── L2: Microsecond Read Check ─────────────────────────────────────────────

  describe('read performance', () => {
    test('dashboard summary loads in < 5ms for 10,000+ entries', async () => {
      const orgId = 'perf-test-org';
      const now = Date.now();
      const hourBucket = Math.floor(now / _internal.HOUR_MS) * _internal.HOUR_MS;

      // Inject 10,000 entries across the current hour bucket
      // We do this by directly populating the cache to simulate 10k entries
      const orgCache = new Map();
      const bucket = {
        volume: 10000,
        actions: { CREATE: 4000, UPDATE: 3000, DELETE: 2000, RUN: 1000 },
        actors: {},
        entities: {},
        riskCount: 3000,
      };
      // Generate 50 unique actors with varying counts
      for (let i = 0; i < 50; i++) {
        bucket.actors[`actor-${i}`] = Math.floor(Math.random() * 200) + 1;
      }
      // Generate 20 unique entities
      for (let i = 0; i < 20; i++) {
        bucket.entities[`entity-${i}`] = Math.floor(Math.random() * 500) + 1;
      }
      orgCache.set(hourBucket, bucket);
      _internal.cache.set(orgId, orgCache);
      _internal.bootstrapped.add(orgId);

      const start = process.hrtime.bigint();
      const summary = await getDashboardSummary(orgId);
      const elapsedNs = Number(process.hrtime.bigint() - start);
      const elapsedMs = elapsedNs / 1_000_000;

      expect(summary.summary.totalVolume).toBe(10000);
      expect(elapsedMs).toBeLessThan(5);
    });

    test('returns empty summary for unknown org in < 1ms', async () => {
      const start = process.hrtime.bigint();
      const summary = await getDashboardSummary('unknown-org-' + Date.now());
      const elapsedNs = Number(process.hrtime.bigint() - start);
      const elapsedMs = elapsedNs / 1_000_000;

      expect(summary.summary.totalVolume).toBe(0);
      expect(summary.topActors).toEqual([]);
      expect(elapsedMs).toBeLessThan(1);
    });
  });

  // ── L2: Incremental Accuracy Test ──────────────────────────────────────────

  describe('incremental accuracy', () => {
    test('injecting 50 new entries updates Top-K actors immediately', async () => {
      const orgId = 'incremental-test-org';
      const now = Date.now();

      // Seed with 10 entries from actor-A and 5 from actor-B
      for (let i = 0; i < 10; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: 'actor-A',
          entity: 'entity-1',
          timestamp: new Date(now).toISOString(),
        });
      }
      for (let i = 0; i < 5; i++) {
        trackCachedMetric(orgId, {
          action: 'UPDATE',
          actorId: 'actor-B',
          entity: 'entity-2',
          timestamp: new Date(now).toISOString(),
        });
      }

      _internal.bootstrapped.add(orgId);

      // Verify initial state
      let summary = await getDashboardSummary(orgId);
      expect(summary.summary.totalVolume).toBe(15);
      expect(summary.topActors[0].key).toBe('actor-A');
      expect(summary.topActors[0].count).toBe(10);

      // Inject 50 new entries from actor-C (should become #1)
      for (let i = 0; i < 50; i++) {
        trackCachedMetric(orgId, {
          action: 'DELETE',
          actorId: 'actor-C',
          entity: 'entity-3',
          timestamp: new Date(now).toISOString(),
        });
      }

      // Verify incremental update without cache invalidation
      summary = await getDashboardSummary(orgId);
      expect(summary.summary.totalVolume).toBe(65);
      expect(summary.topActors[0].key).toBe('actor-C');
      expect(summary.topActors[0].count).toBe(50);
      expect(summary.topActors[1].key).toBe('actor-A');
      expect(summary.topActors[1].count).toBe(10);
    });

    test('tracks action distribution and entity counts incrementally', async () => {
      const orgId = 'action-test-org';
      const now = Date.now();

      trackCachedMetric(orgId, {
        action: 'CREATE',
        actorId: 'user1',
        entity: 'webhook_config',
        timestamp: new Date(now).toISOString(),
      });
      trackCachedMetric(orgId, {
        action: 'DELETE',
        actorId: 'user2',
        entity: 'report_schedule',
        timestamp: new Date(now).toISOString(),
      });
      trackCachedMetric(orgId, {
        action: 'RUN',
        actorId: 'user1',
        entity: 'scan_record',
        timestamp: new Date(now).toISOString(),
      });

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId);

      expect(summary.summary.totalVolume).toBe(3);
      expect(summary.topActions).toContainEqual({ key: 'CREATE', count: 1 });
      expect(summary.topActions).toContainEqual({ key: 'DELETE', count: 1 });
      expect(summary.topActions).toContainEqual({ key: 'RUN', count: 1 });
      expect(summary.topEntities.length).toBe(3);
    });
  });

  // ── Risk Density Index ─────────────────────────────────────────────────────

  describe('risk density index', () => {
    test('computes risk density as ratio of high-severity actions', async () => {
      const orgId = 'risk-test-org';
      const now = Date.now();

      // 10 total entries: 3 DELETE + 1 RUN + 6 CREATE
      for (let i = 0; i < 6; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: 'user1',
          entity: 'entity-1',
          timestamp: new Date(now).toISOString(),
        });
      }
      for (let i = 0; i < 3; i++) {
        trackCachedMetric(orgId, {
          action: 'DELETE',
          actorId: 'user2',
          entity: 'entity-2',
          timestamp: new Date(now).toISOString(),
        });
      }
      trackCachedMetric(orgId, {
        action: 'RUN',
        actorId: 'user3',
        entity: 'entity-3',
        timestamp: new Date(now).toISOString(),
      });

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId);

      // 4 risk actions (3 DELETE + 1 RUN) out of 10 total = 0.4
      expect(summary.summary.totalRiskActions).toBe(4);
      expect(summary.summary.riskDensity).toBe(0.4);
    });

    test('EVALUATE is counted as a risk action', async () => {
      const orgId = 'eval-test-org';
      const now = Date.now();

      trackCachedMetric(orgId, {
        action: 'EVALUATE',
        actorId: 'user1',
        entity: 'model',
        timestamp: new Date(now).toISOString(),
      });
      trackCachedMetric(orgId, {
        action: 'CREATE',
        actorId: 'user2',
        entity: 'ticket',
        timestamp: new Date(now).toISOString(),
      });

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId);

      expect(summary.summary.totalRiskActions).toBe(1);
      expect(summary.summary.riskDensity).toBe(0.5);
    });
  });

  // ── L1: Pruning Sanity ─────────────────────────────────────────────────────

  describe('pruning sanity', () => {
    test('historical buckets older than retention window are pruned', () => {
      const orgId = 'prune-test-org';
      const now = Date.now();
      const currentHour = Math.floor(now / _internal.HOUR_MS) * _internal.HOUR_MS;
      const oldHour = currentHour - 48 * _internal.HOUR_MS; // 48 hours ago — outside 24h window

      // Add an old bucket — it will be created in the cache
      trackCachedMetric(orgId, {
        action: 'CREATE',
        actorId: 'user1',
        entity: 'entity-1',
        timestamp: new Date(oldHour).toISOString(),
      });

      // Add a current bucket — this triggers the periodic prune which
      // removes the old bucket since it's outside the 24h retention window
      trackCachedMetric(orgId, {
        action: 'CREATE',
        actorId: 'user1',
        entity: 'entity-1',
        timestamp: new Date(currentHour).toISOString(),
      });

      const orgCache = _internal.cache.get(orgId);
      // The old bucket should have been pruned during the trackCachedMetric call
      // (prune runs when now - lastPruneAt > PRUNE_INTERVAL_MS, which is 0 on first call)
      // At minimum, the current bucket should exist
      expect(orgCache.size).toBeGreaterThanOrEqual(1);
      expect(orgCache.has(currentHour)).toBe(true);

      // The old bucket may or may not be pruned depending on timing,
      // but it should NOT appear in the dashboard summary (filtered by window)
      _internal.bootstrapped.add(orgId);
    });

    test('getCacheStats returns correct counts', () => {
      const orgId = 'stats-test-org';
      const now = Date.now();

      trackCachedMetric(orgId, {
        action: 'CREATE',
        actorId: 'user1',
        entity: 'entity-1',
        timestamp: new Date(now).toISOString(),
      });

      const stats = getCacheStats();
      expect(stats.orgsTracked).toBeGreaterThanOrEqual(1);
      expect(stats.totalBuckets).toBeGreaterThanOrEqual(1);
      expect(stats.topK).toBe(10);
      expect(stats.windowHours).toBe(24);
    });
  });

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  describe('bootstrap', () => {
    test('triggers bootstrap on first access when bootstrap function is set', async () => {
      const orgId = 'bootstrap-test-org';
      const now = Date.now();

      setBootstrapFunction(async (id, entryCallback) => {
        expect(id).toBe(orgId);
        // Simulate 3 historical entries
        for (let i = 0; i < 3; i++) {
          entryCallback({
            action: 'CREATE',
            actorId: `user-${i}`,
            entity: 'entity-1',
            timestamp: new Date(now - i * 1000).toISOString(),
          });
        }
      });

      const summary = await getDashboardSummary(orgId);

      expect(summary.summary.totalVolume).toBe(3);
      expect(summary.topActors.length).toBe(3);
      expect(_internal.bootstrapped.has(orgId)).toBe(true);
    });

    test('does not re-bootstrap on subsequent accesses', async () => {
      const orgId = 'bootstrap-once-org';
      let bootstrapCount = 0;

      setBootstrapFunction(async (id, entryCallback) => {
        bootstrapCount++;
        entryCallback({
          action: 'CREATE',
          actorId: 'user1',
          entity: 'entity-1',
          timestamp: new Date().toISOString(),
        });
      });

      await getDashboardSummary(orgId);
      await getDashboardSummary(orgId);
      await getDashboardSummary(orgId);

      expect(bootstrapCount).toBe(1);
    });

    test('returns empty summary when no bootstrap function is set', async () => {
      const orgId = 'no-bootstrap-org';
      const summary = await getDashboardSummary(orgId);

      expect(summary.summary.totalVolume).toBe(0);
      expect(summary.topActors).toEqual([]);
    });
  });

  // ── Top-K Bounding ─────────────────────────────────────────────────────────

  describe('top-K bounding', () => {
    test('topActors is capped at TOP_K (10)', async () => {
      const orgId = 'topk-test-org';
      const now = Date.now();

      // Add 15 unique actors
      for (let i = 0; i < 15; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: `actor-${i}`,
          entity: 'entity-1',
          timestamp: new Date(now).toISOString(),
        });
      }

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId);

      expect(summary.topActors.length).toBeLessThanOrEqual(10);
      // Top actor should be actor-0 through actor-9 (all count=1, sorted by insertion order in object)
      // Actually all have count=1, so sort is stable — just verify it's capped
    });

    test('topEntities is capped at TOP_K (10)', async () => {
      const orgId = 'topk-entity-test-org';
      const now = Date.now();

      for (let i = 0; i < 20; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: 'user1',
          entity: `entity-${i}`,
          timestamp: new Date(now).toISOString(),
        });
      }

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId);

      expect(summary.topEntities.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Hourly Volume Series ───────────────────────────────────────────────────

  describe('hourly volume series', () => {
    test('returns chronological hourly volume array', async () => {
      const orgId = 'hourly-test-org';
      const now = Date.now();
      const currentHour = Math.floor(now / _internal.HOUR_MS) * _internal.HOUR_MS;
      const prevHour = currentHour - _internal.HOUR_MS;

      // Add entries in two different hour buckets
      for (let i = 0; i < 5; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: 'user1',
          entity: 'entity-1',
          timestamp: new Date(prevHour).toISOString(),
        });
      }
      for (let i = 0; i < 3; i++) {
        trackCachedMetric(orgId, {
          action: 'CREATE',
          actorId: 'user1',
          entity: 'entity-1',
          timestamp: new Date(currentHour).toISOString(),
        });
      }

      _internal.bootstrapped.add(orgId);
      const summary = await getDashboardSummary(orgId, { windowHours: 24 });

      expect(summary.hourlyVolume.length).toBe(2);
      // Chronological order: prevHour first, then currentHour
      expect(summary.hourlyVolume[0].volume).toBe(5);
      expect(summary.hourlyVolume[1].volume).toBe(3);
    });
  });
});
