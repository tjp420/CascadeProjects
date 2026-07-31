'use strict';

/**
 * Analytics Cache Manager — Incremental multi-dimensional cache for
 * dashboard metric aggregation with O(1) read latency.
 *
 * Architecture:
 *   - Time-bucketed (hourly) in-memory cache per org
 *   - Tracks volume, action distribution, top-10 actors, top-10 entities
 *   - Risk Density Index: rolling count of high-severity actions
 *     (DELETE, RUN, EVALUATE) against baseline activity
 *   - Stream-based bootstrap from audit log on cache miss (non-blocking)
 *   - Automatic pruning of buckets older than the retention window
 *
 * @module analytics-cache-manager
 */

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_WINDOW_HOURS = 24;
const TOP_K = 10;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000; // Prune every 10 minutes
const RISK_ACTIONS = new Set(['DELETE', 'RUN', 'EVALUATE']);

// orgId -> Map<hourBucket, { volume, actions, actors, entities, riskCount }>
const cache = new Map();

// orgId -> boolean (whether cache has been bootstrapped)
const bootstrapped = new Set();

// Bootstrap function — set by the caller to avoid circular deps
let bootstrapFn = null;

// Analytics broadcaster callback — injected by the server to push
// ANALYTICS_UPDATE frames over WebSocket to connected dashboard clients.
let analyticsBroadcaster = null;

// Last prune timestamp
let lastPruneAt = 0;

// Broadcast throttle — avoid flooding WebSocket on every single event.
// We broadcast at most once per BROADCAST_THROTTLE_MS per org.
const BROADCAST_THROTTLE_MS = 5000; // 5 seconds
const lastBroadcastAt = new Map(); // orgId -> timestamp

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a bootstrap function that reads historical audit entries
 * for an org and feeds them into the cache. The function should accept
 * (orgId, callback) where callback is called for each entry.
 *
 * @param {function} fn — async function(orgId, entryCallback)
 */
function setBootstrapFunction(fn) {
  bootstrapFn = typeof fn === 'function' ? fn : null;
}

/**
 * Register a broadcast callback invoked when analytics metrics are updated.
 * The callback receives { type: 'ANALYTICS_UPDATE', orgId, summary }.
 * Throttled to at most once per BROADCAST_THROTTLE_MS per org.
 *
 * @param {function|null} fn — broadcast function or null to clear
 */
function setAnalyticsBroadcaster(fn) {
  analyticsBroadcaster = typeof fn === 'function' ? fn : null;
}

/**
 * Broadcast analytics update to connected WebSocket clients.
 * Throttled per org to avoid flooding.
 * @param {string} orgId
 */
function maybeBroadcastAnalytics(orgId) {
  if (!analyticsBroadcaster) return;

  const now = Date.now();
  const lastSent = lastBroadcastAt.get(orgId) || 0;
  if (now - lastSent < BROADCAST_THROTTLE_MS) return;

  lastBroadcastAt.set(orgId, now);

  try {
    const summary = buildSummary(orgId, DEFAULT_WINDOW_HOURS);
    analyticsBroadcaster({
      type: 'ANALYTICS_UPDATE',
      orgId,
      summary,
    });
  } catch {
    // Broadcast errors must never block cache operations
  }
}

/**
 * Track a cached metric incrementally from a single audit entry.
 * Called from audit-logger.log() via setImmediate — non-blocking.
 *
 * @param {string} orgId
 * @param {object} entry — { action, actorId, entity, timestamp, severity }
 */
function trackCachedMetric(orgId, entry) {
  const scopedOrgId = orgId || 'default';
  const timestamp = new Date(entry.timestamp).getTime();
  const hourBucket = Math.floor(timestamp / HOUR_MS) * HOUR_MS;

  if (!cache.has(scopedOrgId)) {
    cache.set(scopedOrgId, new Map());
  }
  const orgCache = cache.get(scopedOrgId);

  if (!orgCache.has(hourBucket)) {
    orgCache.set(hourBucket, {
      volume: 0,
      actions: {},
      actors: {},
      entities: {},
      riskCount: 0,
    });
  }

  const bucket = orgCache.get(hourBucket);
  bucket.volume += 1;

  const action = entry.action || 'unknown';
  bucket.actions[action] = (bucket.actions[action] || 0) + 1;

  const actor = entry.actorId || 'unknown';
  bucket.actors[actor] = (bucket.actors[actor] || 0) + 1;

  const entity = entry.entity || 'unknown';
  bucket.entities[entity] = (bucket.entities[entity] || 0) + 1;

  if (RISK_ACTIONS.has(action)) {
    bucket.riskCount += 1;
  }

  // Periodic prune
  const now = Date.now();
  if (now - lastPruneAt > PRUNE_INTERVAL_MS) {
    pruneStaleBuckets(now);
    lastPruneAt = now;
  }
}

/**
 * Get the dashboard summary for an org.
 * Returns O(1) from cache if available, otherwise triggers bootstrap.
 *
 * @param {string} orgId
 * @param {object} [opts]
 * @param {number} [opts.windowHours=24] — Rolling window in hours
 * @returns {object} Dashboard summary
 */
async function getDashboardSummary(orgId, opts = {}) {
  const scopedOrgId = orgId || 'default';
  const windowHours = opts.windowHours || DEFAULT_WINDOW_HOURS;

  // Bootstrap on first access
  if (!bootstrapped.has(scopedOrgId) && bootstrapFn) {
    await bootstrapFromLog(scopedOrgId);
  }

  return buildSummary(scopedOrgId, windowHours);
}

/**
 * Build the dashboard summary from the in-memory cache.
 * @param {string} orgId
 * @param {number} windowHours
 * @returns {object}
 */
function buildSummary(orgId, windowHours) {
  const orgCache = cache.get(orgId);
  if (!orgCache) {
    return emptySummary(orgId, windowHours);
  }

  const now = Date.now();
  const windowStart = Math.floor((now - windowHours * HOUR_MS) / HOUR_MS) * HOUR_MS;

  // Aggregate buckets within the rolling window
  let totalVolume = 0;
  let totalRisk = 0;
  const actionsAgg = {};
  const actorsAgg = {};
  const entitiesAgg = {};
  const hourlyVolume = []; // [{ hour, volume, riskCount }]

  for (const [bucketTime, bucket] of orgCache) {
    if (bucketTime < windowStart) continue;
    totalVolume += bucket.volume;
    totalRisk += bucket.riskCount;

    for (const [a, c] of Object.entries(bucket.actions)) {
      actionsAgg[a] = (actionsAgg[a] || 0) + c;
    }
    for (const [a, c] of Object.entries(bucket.actors)) {
      actorsAgg[a] = (actorsAgg[a] || 0) + c;
    }
    for (const [e, c] of Object.entries(bucket.entities)) {
      entitiesAgg[e] = (entitiesAgg[e] || 0) + c;
    }

    hourlyVolume.push({
      hour: new Date(bucketTime).toISOString(),
      volume: bucket.volume,
      riskCount: bucket.riskCount,
    });
  }

  // Sort hourly volume chronologically
  hourlyVolume.sort((a, b) => a.hour.localeCompare(b.hour));

  // Compute Top-K
  const topActors = topK(actorsAgg, TOP_K);
  const topEntities = topK(entitiesAgg, TOP_K);
  const topActions = topK(actionsAgg, TOP_K);

  // Risk Density Index: ratio of high-severity actions to total
  const riskDensity = totalVolume > 0 ? totalRisk / totalVolume : 0;

  return {
    orgId,
    generatedAt: new Date().toISOString(),
    windowHours,
    windowStart: new Date(windowStart).toISOString(),
    summary: {
      totalVolume,
      totalRiskActions: totalRisk,
      riskDensity: Number(riskDensity.toFixed(4)),
      uniqueActors: Object.keys(actorsAgg).length,
      uniqueEntities: Object.keys(entitiesAgg).length,
    },
    topActors,
    topEntities,
    topActions,
    hourlyVolume,
  };
}

/**
 * Bootstrap the cache from the audit log using a non-blocking stream.
 * @param {string} orgId
 */
async function bootstrapFromLog(orgId) {
  if (!bootstrapFn) {
    bootstrapped.add(orgId);
    return;
  }

  // Clear existing cache for this org before bootstrap
  cache.set(orgId, new Map());

  await bootstrapFn(orgId, (entry) => {
    trackCachedMetric(orgId, entry);
  });

  bootstrapped.add(orgId);
}

/**
 * Get the top K entries from a frequency map.
 * @param {object} freqMap
 * @param {number} k
 * @returns {Array<{ key: string, count: number }>}
 */
function topK(freqMap, k) {
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Return an empty summary structure.
 */
function emptySummary(orgId, windowHours) {
  return {
    orgId,
    generatedAt: new Date().toISOString(),
    windowHours,
    windowStart: new Date(Date.now() - windowHours * HOUR_MS).toISOString(),
    summary: {
      totalVolume: 0,
      totalRiskActions: 0,
      riskDensity: 0,
      uniqueActors: 0,
      uniqueEntities: 0,
    },
    topActors: [],
    topEntities: [],
    topActions: [],
    hourlyVolume: [],
  };
}

/**
 * Prune buckets older than the retention window.
 * @param {number} now
 */
function pruneStaleBuckets(now) {
  const retentionStart = Math.floor((now - DEFAULT_WINDOW_HOURS * HOUR_MS) / HOUR_MS) * HOUR_MS;

  for (const [orgId, orgCache] of cache) {
    for (const [bucketTime] of orgCache) {
      if (bucketTime < retentionStart) {
        orgCache.delete(bucketTime);
      }
    }
    // Remove empty org caches
    if (orgCache.size === 0) {
      cache.delete(orgId);
      bootstrapped.delete(orgId);
    }
  }
}

/**
 * Get cache stats for monitoring.
 * @returns {object}
 */
function getCacheStats() {
  let totalBuckets = 0;
  for (const orgCache of cache.values()) {
    totalBuckets += orgCache.size;
  }
  return {
    orgsTracked: cache.size,
    totalBuckets,
    topK: TOP_K,
    windowHours: DEFAULT_WINDOW_HOURS,
    bootstrappedOrgs: bootstrapped.size,
  };
}

/**
 * Clear all cache state (for testing).
 */
function reset() {
  cache.clear();
  bootstrapped.clear();
  lastPruneAt = 0;
}

module.exports = {
  trackCachedMetric,
  getDashboardSummary,
  setBootstrapFunction,
  getCacheStats,
  reset,
  // Exposed for testing
  _internal: {
    cache,
    bootstrapped,
    HOUR_MS,
    TOP_K,
    DEFAULT_WINDOW_HOURS,
    PRUNE_INTERVAL_MS,
  },
};
