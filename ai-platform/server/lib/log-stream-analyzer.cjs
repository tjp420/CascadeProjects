'use strict';

/**
 * Log Stream Analyzer — Real-time sliding-window processor for
 * burst detection and statistical anomaly analysis.
 *
 * Architecture:
 *   - In-memory ring buffer per org (sliding 5-second window)
 *   - Burst detection: flags when event count exceeds threshold
 *     within the rolling window
 *   - Statistical anomaly: computes moving Z-scores over a 1-hour
 *     baseline window, tracking deviations per-actor AND per-entity
 *   - Emits LOG_STREAM_BURST and LOG_STREAM_ANOMALY events via
 *     a configurable callback (wired to alert dispatcher + WS broadcast)
 *
 * @module log-stream-analyzer
 */

// ── Configuration ────────────────────────────────────────────────────────────

const BURST_WINDOW_MS = 5000;       // 5-second rolling window
const BURST_THRESHOLD = 100;        // 100 events in 5s = burst
const ANOMALY_BASELINE_MS = 60 * 60 * 1000;  // 1-hour baseline
const ANOMALY_Z_THRESHOLD = 3.0;    // 3 sigma = anomaly
const ANOMALY_MIN_SAMPLES = 10;     // Need at least 10 samples for Z-score
const PRUNE_INTERVAL_MS = 60 * 1000; // Prune stale orgs every 60s

// ── State ────────────────────────────────────────────────────────────────────

// orgId -> Array of { timestamp, action, actorId, entity }
const burstBuffer = new Map();

// orgId -> { actor: Map<actorId, number[]>, entity: Map<entity, number[]> }
// Each number[] is a list of event counts per 1-minute bucket
const anomalyBaseline = new Map();

// Callback for emitting stream events
let streamEventCallback = null;

// Last prune timestamp
let lastPruneAt = 0;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a callback to receive stream events.
 * Callback receives { type, orgId, data }.
 * @param {function|null} fn
 */
function setStreamEventCallback(fn) {
  streamEventCallback = typeof fn === 'function' ? fn : null;
}

/**
 * Get the current burst threshold (events per window).
 * @returns {number}
 */
function getBurstThreshold() {
  return BURST_THRESHOLD;
}

/**
 * Get the current burst window size in milliseconds.
 * @returns {number}
 */
function getBurstWindowMs() {
  return BURST_WINDOW_MS;
}

/**
 * Ingest a stream event into the sliding-window processor.
 * Called non-blocking via setImmediate from audit-logger.
 *
 * @param {object} event — { orgId, action, actorId, entity, timestamp }
 */
function ingestStreamEvent(event) {
  const now = (event.timestamp && new Date(event.timestamp).getTime()) || Date.now();
  const orgId = event.orgId || 'default';
  const action = event.action || 'unknown';
  const actorId = event.actorId || 'unknown';
  const entity = event.entity || 'unknown';

  // ── Burst detection (5-second rolling window) ──
  if (!burstBuffer.has(orgId)) burstBuffer.set(orgId, []);
  const events = burstBuffer.get(orgId);
  events.push({ timestamp: now, action, actorId, entity });

  // Prune expired events from the burst window
  const burstCutoff = now - BURST_WINDOW_MS;
  while (events.length && events[0].timestamp < burstCutoff) {
    events.shift();
  }

  // Check burst threshold
  if (events.length >= BURST_THRESHOLD) {
    emitStreamEvent('LOG_STREAM_BURST', orgId, {
      severity: 'high',
      message: `Burst detected: ${events.length} events in ${BURST_WINDOW_MS / 1000}s`,
      data: {
        eventCount: events.length,
        windowMs: BURST_WINDOW_MS,
        threshold: BURST_THRESHOLD,
        actions: countByField(events, 'action'),
        actors: countByField(events, 'actorId'),
      },
    });
  }

  // ── Anomaly detection (1-hour baseline, per-actor + per-entity) ──
  updateAnomalyBaseline(orgId, actorId, entity, now);

  // Periodic prune of stale org buffers
  if (now - lastPruneAt > PRUNE_INTERVAL_MS) {
    pruneStaleOrgs(now);
    lastPruneAt = now;
  }
}

/**
 * Update the anomaly baseline for an org, tracking per-actor and per-entity.
 * Uses 1-minute buckets of event counts.
 */
function updateAnomalyBaseline(orgId, actorId, entity, now) {
  if (!anomalyBaseline.has(orgId)) {
    anomalyBaseline.set(orgId, {
      actor: new Map(),
      entity: new Map(),
    });
  }
  const baseline = anomalyBaseline.get(orgId);
  const bucketKey = Math.floor(now / 60000); // 1-minute bucket

  // Update actor bucket
  updateBucketMap(baseline.actor, actorId, bucketKey);
  // Update entity bucket
  updateBucketMap(baseline.entity, entity, bucketKey);

  // Check for anomalies
  checkAnomaly(baseline.actor, actorId, orgId, 'actor', now);
  checkAnomaly(baseline.entity, entity, orgId, 'entity', now);
}

/**
 * Update a bucket map with a new event count.
 * @param {Map<string, Map<number, number>>} map
 * @param {string} key — actorId or entity
 * @param {number} bucketKey
 */
function updateBucketMap(map, key, bucketKey) {
  if (!map.has(key)) map.set(key, new Map());
  const buckets = map.get(key);
  buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
}

/**
 * Check if the current bucket count for a key is a statistical anomaly.
 * Computes Z-score against the historical bucket counts.
 *
 * @param {Map<string, Map<number, number>>} map
 * @param {string} key — actorId or entity
 * @param {string} orgId
 * @param {string} dimension — 'actor' or 'entity'
 * @param {number} now
 */
function checkAnomaly(map, key, orgId, dimension, now) {
  const buckets = map.get(key);
  if (!buckets) return;

  const baselineCutoff = now - ANOMALY_BASELINE_MS;
  const baselineCutoffBucket = Math.floor(baselineCutoff / 60000);

  // Collect historical bucket counts (exclude current bucket)
  const currentBucket = Math.floor(now / 60000);
  const counts = [];
  for (const [bucket, count] of buckets) {
    if (bucket < baselineCutoffBucket) {
      buckets.delete(bucket); // prune old buckets
      continue;
    }
    if (bucket !== currentBucket) {
      counts.push(count);
    }
  }

  if (counts.length < ANOMALY_MIN_SAMPLES) return;

  // Compute mean and standard deviation
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return; // No variation — can't compute Z-score

  const currentCount = buckets.get(currentBucket) || 0;
  const zScore = (currentCount - mean) / stdDev;

  if (zScore >= ANOMALY_Z_THRESHOLD) {
    emitStreamEvent('LOG_STREAM_ANOMALY', orgId, {
      severity: 'medium',
      message: `Anomaly detected: ${dimension} "${key}" Z-score ${zScore.toFixed(2)} (mean=${mean.toFixed(1)}, current=${currentCount})`,
      data: {
        dimension,
        key,
        zScore: Number(zScore.toFixed(4)),
        mean: Number(mean.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        currentCount,
        baselineSamples: counts.length,
      },
    });
  }
}

/**
 * Count events by a given field.
 * @param {Array} events
 * @param {string} field
 * @returns {object}
 */
function countByField(events, field) {
  const counts = {};
  for (const e of events) {
    const v = e[field] || 'unknown';
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

/**
 * Emit a stream event to the registered callback.
 * @param {string} type — LOG_STREAM_BURST or LOG_STREAM_ANOMALY
 * @param {string} orgId
 * @param {object} payload — { severity, message, data }
 */
function emitStreamEvent(type, orgId, payload) {
  if (!streamEventCallback) return;
  try {
    streamEventCallback({ type, orgId, ...payload });
  } catch {
    // Callback errors should never block the stream pipeline
  }
}

/**
 * Prune stale org buffers that have had no activity.
 * @param {number} now
 */
function pruneStaleOrgs(now) {
  const staleCutoff = now - ANOMALY_BASELINE_MS;

  for (const [orgId, events] of burstBuffer) {
    // Prune burst buffer
    const burstCutoff = now - BURST_WINDOW_MS;
    while (events.length && events[0].timestamp < burstCutoff) {
      events.shift();
    }
    // Remove empty burst buffers
    if (events.length === 0) {
      burstBuffer.delete(orgId);
    }
  }

  // Prune old anomaly baseline buckets
  for (const [orgId, baseline] of anomalyBaseline) {
    const baselineCutoffBucket = Math.floor(staleCutoff / 60000);
    let hasData = false;

    for (const buckets of [baseline.actor, baseline.entity]) {
      for (const [key, bucketMap] of buckets) {
        for (const [bucket] of bucketMap) {
          if (bucket < baselineCutoffBucket) {
            bucketMap.delete(bucket);
          }
        }
        if (bucketMap.size === 0) {
          buckets.delete(key);
        } else {
          hasData = true;
        }
      }
    }

    if (!hasData) {
      anomalyBaseline.delete(orgId);
    }
  }
}

/**
 * Get current buffer stats for monitoring/debugging.
 * @returns {object}
 */
function getStats() {
  return {
    orgsTracked: burstBuffer.size,
    anomalyOrgsTracked: anomalyBaseline.size,
    burstThreshold: BURST_THRESHOLD,
    burstWindowMs: BURST_WINDOW_MS,
    anomalyZThreshold: ANOMALY_Z_THRESHOLD,
    anomalyBaselineMs: ANOMALY_BASELINE_MS,
  };
}

/**
 * Clear all buffers (for testing).
 */
function reset() {
  burstBuffer.clear();
  anomalyBaseline.clear();
  lastPruneAt = 0;
}

module.exports = {
  ingestStreamEvent,
  setStreamEventCallback,
  getBurstThreshold,
  getBurstWindowMs,
  getStats,
  reset,
  // Exposed for testing
  _internal: {
    burstBuffer,
    anomalyBaseline,
    BURST_WINDOW_MS,
    BURST_THRESHOLD,
    ANOMALY_Z_THRESHOLD,
    ANOMALY_MIN_SAMPLES,
  },
};
