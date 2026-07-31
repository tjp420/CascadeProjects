'use strict';

/**
 * Log stream metrics — burst detection + request metrics aggregation.
 *
 * Tracks sliding-window log counts per level to detect burst patterns
 * (e.g., 10+ errors in 30 seconds). Aggregates HTTP request metrics
 * (latency, throughput, error rate). Emits events via callback.
 *
 * Memory-safe: sliding windows prune entries older than the window size.
 */

const BURST_WINDOW_MS = 30 * 1000; // 30 seconds
const BURST_THRESHOLDS = {
  error: 10,   // 10+ errors in 30s = burst
  warn: 20,    // 20+ warnings in 30s = burst
  info: 100,   // 100+ info logs in 30s = burst (unusual activity)
};

// Sliding-window log counts: { [level]: number[] (timestamps) }
const logWindows = { error: [], warn: [], info: [], debug: [] };

// Request metrics for current window
let requestMetrics = {
  total: 0,
  errors: 0,
  totalLatencyMs: 0,
  statusCodes: {}, // { [code]: count }
  windowStart: Date.now(),
};

// Callbacks for burst + metrics events
let burstCallback = null;
let metricsCallback = null;

/**
 * Set the burst detection callback.
 * @param {function|null} fn — receives { type: 'BURST_DETECTED', level, count, windowMs, threshold, timestamp }
 */
function setBurstCallback(fn) {
  burstCallback = typeof fn === 'function' ? fn : null;
}

/**
 * Set the metrics update callback.
 * @param {function|null} fn — receives metrics snapshot object
 */
function setMetricsCallback(fn) {
  metricsCallback = typeof fn === 'function' ? fn : null;
}

/**
 * Prune entries older than the burst window from a sliding window array.
 * @param {number[]} timestamps
 * @returns {number[]} pruned array
 */
function pruneWindow(timestamps) {
  const cutoff = Date.now() - BURST_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  return timestamps;
}

/**
 * Record a log event and check for burst patterns.
 * @param {{ level: string, message: string, timestamp: string }} entry
 */
function recordLogEvent(entry) {
  const level = entry.level || 'info';
  if (!logWindows[level]) return;

  const now = Date.now();
  logWindows[level].push(now);
  pruneWindow(logWindows[level]);

  // Check for burst
  const threshold = BURST_THRESHOLDS[level];
  if (threshold && logWindows[level].length >= threshold) {
    if (burstCallback) {
      try {
        burstCallback({
          type: 'BURST_DETECTED',
          level,
          count: logWindows[level].length,
          windowMs: BURST_WINDOW_MS,
          threshold,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // callback errors never block metrics
      }
    }
    // Reset window after burst detected to avoid spamming
    logWindows[level] = [];
  }
}

/**
 * Record an HTTP request metric.
 * @param {{ method: string, statusCode: number, durationMs: number }} req
 */
function recordRequest({ method, statusCode, durationMs }) {
  requestMetrics.total++;
  requestMetrics.totalLatencyMs += durationMs;
  const code = String(statusCode);
  requestMetrics.statusCodes[code] = (requestMetrics.statusCodes[code] || 0) + 1;
  if (statusCode >= 400) {
    requestMetrics.errors++;
  }
}

/**
 * Get a snapshot of current metrics and reset the window.
 * @returns {{ requests: number, avgLatencyMs: number, errorRate: number, throughput: number, statusCodes: object, windowMs: number }}
 */
function getMetricsSnapshot() {
  const now = Date.now();
  const windowMs = now - requestMetrics.windowStart;
  const avgLatencyMs = requestMetrics.total > 0
    ? Math.round(requestMetrics.totalLatencyMs / requestMetrics.total)
    : 0;
  const errorRate = requestMetrics.total > 0
    ? Math.round((requestMetrics.errors / requestMetrics.total) * 1000) / 10
    : 0;
  const throughput = windowMs > 0
    ? Math.round((requestMetrics.total / (windowMs / 1000)) * 10) / 10
    : 0;

  const snapshot = {
    requests: requestMetrics.total,
    avgLatencyMs,
    errorRate,
    throughput,
    statusCodes: { ...requestMetrics.statusCodes },
    windowMs,
  };

  // Reset window
  requestMetrics = {
    total: 0,
    errors: 0,
    totalLatencyMs: 0,
    statusCodes: {},
    windowStart: now,
  };

  return snapshot;
}

/**
 * Start periodic metrics broadcasting.
 * @param {number} intervalMs — broadcast interval (default 5s)
 * @returns {NodeJS.Timeout} interval handle
 */
function startMetricsBroadcaster(intervalMs = 5000) {
  return setInterval(() => {
    if (!metricsCallback) return;
    const snapshot = getMetricsSnapshot();
    if (snapshot.requests === 0) return; // skip empty windows
    try {
      metricsCallback({
        type: 'METRICS_UPDATE',
        data: snapshot,
      });
    } catch {
      // callback errors never block
    }
  }, intervalMs);
}

module.exports = {
  recordLogEvent,
  recordRequest,
  getMetricsSnapshot,
  setBurstCallback,
  setMetricsCallback,
  startMetricsBroadcaster,
  BURST_WINDOW_MS,
  BURST_THRESHOLDS,
};
