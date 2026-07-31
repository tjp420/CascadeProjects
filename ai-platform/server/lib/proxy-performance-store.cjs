'use strict';

/**
 * Proxy Performance Metrics Store — High-resolution window observer
 * tracking time-to-first-token (TTFT), queue backpressures, token
 * generation velocity, and multi-region provider latencies.
 *
 * Uses a sliding window ring buffer for recent metrics and aggregate
 * rollups for historical analysis.
 *
 * @module proxy-performance-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const STORE_PATH =
  process.env.PROXY_PERF_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'proxy-performance.json');

const WINDOW_SIZE = 300;          // Keep last 300 requests in ring buffer
const ROLLUP_INTERVAL_MS = 60000; // 1-minute rollups
const MAX_ROLLUPS = 1440;         // 24 hours of minute rollups
const QUEUE_TRACKING_WINDOW_MS = 10000; // 10-second window for backpressure

// In-memory ring buffer for recent requests
const _ringBuffer = [];
let _ringIdx = 0;

// In-memory queue depth tracker
const _queueDepths = []; // { timestamp, depth }

// Persisted rollups
let _rollups = [];
let _cacheDirty = true;

// Provider latency profiles (persisted)
let _providerProfiles = {};

function readStore() {
  if (!_cacheDirty) return { rollups: _rollups, providerProfiles: _providerProfiles };
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      _rollups = parsed.rollups || [];
      _providerProfiles = parsed.providerProfiles || {};
    }
  } catch {
    _rollups = [];
    _providerProfiles = {};
  }
  _cacheDirty = false;
  return { rollups: _rollups, providerProfiles: _providerProfiles };
}

function writeStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({
    rollups: _rollups,
    providerProfiles: _providerProfiles,
  }, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

// ── Request Metrics Recording ───────────────────────────────────────────────

/**
 * Record a single inference request's performance metrics.
 * @param {object} metrics
 * @param {string} metrics.provider — ollama, openai, anthropic
 * @param {string} metrics.model — model name
 * @param {number} metrics.queuedAt — timestamp when request was queued (ms)
 * @param {number} metrics.dispatchedAt — timestamp when request was sent to provider (ms)
 * @param {number} metrics.firstTokenAt — timestamp of first token received (ms)
 * @param {number} metrics.completedAt — timestamp when response completed (ms)
 * @param {number} metrics.tokenCount — total tokens generated
 * @param {number} metrics.requestSize — request body size in bytes
 * @param {number} metrics.responseSize — response body size in bytes
 * @param {boolean} metrics.success — whether request succeeded
 * @param {string} metrics.errorType — error type if failed
 * @param {string} metrics.userId — user identifier
 * @param {string} metrics.requestId — unique request ID
 */
function recordRequest(metrics) {
  try {
    const now = Date.now();
    const entry = {
      timestamp: now,
      provider: metrics.provider || 'unknown',
      model: metrics.model || '',
      userId: metrics.userId || 'anonymous',
      requestId: metrics.requestId || `req-${now}`,
      success: metrics.success !== false,

      // Time-to-first-token: from dispatch to first token
      ttftMs: metrics.firstTokenAt && metrics.dispatchedAt
        ? metrics.firstTokenAt - metrics.dispatchedAt
        : null,

      // Queue wait: from queued to dispatched
      queueWaitMs: metrics.dispatchedAt && metrics.queuedAt
        ? metrics.dispatchedAt - metrics.queuedAt
        : null,

      // Total inference: from dispatch to completion
      inferenceDurationMs: metrics.completedAt && metrics.dispatchedAt
        ? metrics.completedAt - metrics.dispatchedAt
        : null,

      // Token generation velocity (tokens/sec)
      tokenVelocity: metrics.tokenCount && metrics.firstTokenAt && metrics.completedAt
        ? Math.round((metrics.tokenCount / ((metrics.completedAt - metrics.firstTokenAt) / 1000)) * 10) / 10
        : null,

      tokenCount: metrics.tokenCount || null,
      requestSizeBytes: metrics.requestSize || null,
      responseSizeBytes: metrics.responseSize || null,
      errorType: metrics.errorType || null,
    };

    // Add to ring buffer
    if (_ringBuffer.length < WINDOW_SIZE) {
      _ringBuffer.push(entry);
    } else {
      _ringBuffer[_ringIdx] = entry;
      _ringIdx = (_ringIdx + 1) % WINDOW_SIZE;
    }

    // Update provider profile
    updateProviderProfile(entry);

    // Check if we need to create a rollup
    maybeCreateRollup(now);

    return { success: true };
  } catch (err) {
    logger.warn('[ProxyPerf] recordRequest failed:', err.message);
    return { success: false, error: err.message };
  }
}

function updateProviderProfile(entry) {
  const key = `${entry.provider}:${entry.model || 'default'}`;
  if (!_providerProfiles[key]) {
    _providerProfiles[key] = {
      provider: entry.provider,
      model: entry.model || 'default',
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      ttftSamples: [],
      inferenceDurationSamples: [],
      queueWaitSamples: [],
      tokenVelocitySamples: [],
      lastUpdated: null,
    };
  }

  const profile = _providerProfiles[key];
  profile.totalRequests++;
  if (entry.success) profile.successCount++;
  else profile.failureCount++;

  if (entry.ttftMs !== null) profile.ttftSamples.push(entry.ttftMs);
  if (entry.inferenceDurationMs !== null) profile.inferenceDurationSamples.push(entry.inferenceDurationMs);
  if (entry.queueWaitMs !== null) profile.queueWaitSamples.push(entry.queueWaitMs);
  if (entry.tokenVelocity !== null) profile.tokenVelocitySamples.push(entry.tokenVelocity);

  // Keep sample arrays bounded
  const MAX_SAMPLES = 500;
  if (profile.ttftSamples.length > MAX_SAMPLES) profile.ttftSamples = profile.ttftSamples.slice(-MAX_SAMPLES);
  if (profile.inferenceDurationSamples.length > MAX_SAMPLES) profile.inferenceDurationSamples = profile.inferenceDurationSamples.slice(-MAX_SAMPLES);
  if (profile.queueWaitSamples.length > MAX_SAMPLES) profile.queueWaitSamples = profile.queueWaitSamples.slice(-MAX_SAMPLES);
  if (profile.tokenVelocitySamples.length > MAX_SAMPLES) profile.tokenVelocitySamples = profile.tokenVelocitySamples.slice(-MAX_SAMPLES);

  profile.lastUpdated = new Date().toISOString();
}

// ── Queue Backpressure Tracking ─────────────────────────────────────────────

let _activeRequests = 0;
let _maxConcurrent = 0;

function requestQueued() {
  _activeRequests++;
  if (_activeRequests > _maxConcurrent) _maxConcurrent = _activeRequests;
  _queueDepths.push({ timestamp: Date.now(), depth: _activeRequests });
  pruneQueueDepths();
}

function requestDequeued() {
  _activeRequests = Math.max(0, _activeRequests - 1);
  _queueDepths.push({ timestamp: Date.now(), depth: _activeRequests });
  pruneQueueDepths();
}

function pruneQueueDepths() {
  const cutoff = Date.now() - QUEUE_TRACKING_WINDOW_MS;
  while (_queueDepths.length > 0 && _queueDepths[0].timestamp < cutoff) {
    _queueDepths.shift();
  }
}

function getQueueBackpressure() {
  pruneQueueDepths();
  const current = _activeRequests;
  const peak = _queueDepths.reduce((max, d) => Math.max(max, d.depth), 0);
  const avg = _queueDepths.length > 0
    ? Math.round(_queueDepths.reduce((sum, d) => sum + d.depth, 0) / _queueDepths.length * 10) / 10
    : 0;
  return {
    currentDepth: current,
    peakDepth: peak,
    avgDepth: avg,
    maxConcurrentObserved: _maxConcurrent,
    samplesInWindow: _queueDepths.length,
  };
}

// ── Rollups ─────────────────────────────────────────────────────────────────

function maybeCreateRollup(now) {
  const { rollups } = readStore();
  const lastRollup = rollups[rollups.length - 1];
  const rollupStart = Math.floor(now / ROLLUP_INTERVAL_MS) * ROLLUP_INTERVAL_MS;

  if (lastRollup && lastRollup.intervalStart >= rollupStart) return;

  // Collect recent entries for this interval
  const intervalEnd = rollupStart + ROLLUP_INTERVAL_MS;
  const intervalEntries = _ringBuffer.filter(
    (e) => e.timestamp >= rollupStart && e.timestamp < intervalEnd
  );

  if (intervalEntries.length === 0 && lastRollup) return;

  const rollup = computeRollup(rollupStart, intervalEnd, intervalEntries);
  _rollups.push(rollup);

  // Prune old rollups
  if (_rollups.length > MAX_ROLLUPS) {
    _rollups = _rollups.slice(-MAX_ROLLUPS);
  }

  writeStore();
}

function computeRollup(start, end, entries) {
  const ttfts = entries.map((e) => e.ttftMs).filter((v) => v !== null);
  const durations = entries.map((e) => e.inferenceDurationMs).filter((v) => v !== null);
  const queueWaits = entries.map((e) => e.queueWaitMs).filter((v) => v !== null);
  const velocities = entries.map((e) => e.tokenVelocity).filter((v) => v !== null);

  const byProvider = {};
  for (const e of entries) {
    if (!byProvider[e.provider]) byProvider[e.provider] = { count: 0, success: 0, fail: 0 };
    byProvider[e.provider].count++;
    if (e.success) byProvider[e.provider].success++;
    else byProvider[e.provider].fail++;
  }

  return {
    intervalStart: start,
    intervalEnd: end,
    totalRequests: entries.length,
    successCount: entries.filter((e) => e.success).length,
    failureCount: entries.filter((e) => !e.success).length,
    ttftAvg: ttfts.length > 0 ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : null,
    ttftP50: ttfts.length > 0 ? percentile(ttfts, 50) : null,
    ttftP95: ttfts.length > 0 ? percentile(ttfts, 95) : null,
    ttftP99: ttfts.length > 0 ? percentile(ttfts, 99) : null,
    durationAvg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    durationP50: durations.length > 0 ? percentile(durations, 50) : null,
    durationP95: durations.length > 0 ? percentile(durations, 95) : null,
    queueWaitAvg: queueWaits.length > 0 ? Math.round(queueWaits.reduce((a, b) => a + b, 0) / queueWaits.length) : null,
    tokenVelocityAvg: velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length * 10) / 10 : null,
    byProvider,
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Query Functions ─────────────────────────────────────────────────────────

function getRecentMetrics(limit = 50) {
  const sorted = [..._ringBuffer].sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

function getProviderProfiles() {
  const result = {};
  for (const [key, profile] of Object.entries(_providerProfiles)) {
    const ttftSamples = profile.ttftSamples;
    const durSamples = profile.inferenceDurationSamples;
    const qWaitSamples = profile.queueWaitSamples;
    const velSamples = profile.tokenVelocitySamples;

    result[key] = {
      provider: profile.provider,
      model: profile.model,
      totalRequests: profile.totalRequests,
      successCount: profile.successCount,
      failureCount: profile.failureCount,
      successRate: profile.totalRequests > 0
        ? Math.round((profile.successCount / profile.totalRequests) * 10000) / 100
        : 0,
      ttft: {
        avg: ttftSamples.length > 0 ? Math.round(ttftSamples.reduce((a, b) => a + b, 0) / ttftSamples.length) : null,
        p50: percentile(ttftSamples, 50),
        p95: percentile(ttftSamples, 95),
        p99: percentile(ttftSamples, 99),
        min: ttftSamples.length > 0 ? Math.min(...ttftSamples) : null,
        max: ttftSamples.length > 0 ? Math.max(...ttftSamples) : null,
      },
      inferenceDuration: {
        avg: durSamples.length > 0 ? Math.round(durSamples.reduce((a, b) => a + b, 0) / durSamples.length) : null,
        p50: percentile(durSamples, 50),
        p95: percentile(durSamples, 95),
        p99: percentile(durSamples, 99),
      },
      queueWait: {
        avg: qWaitSamples.length > 0 ? Math.round(qWaitSamples.reduce((a, b) => a + b, 0) / qWaitSamples.length) : null,
        p50: percentile(qWaitSamples, 50),
        p95: percentile(qWaitSamples, 95),
      },
      tokenVelocity: {
        avg: velSamples.length > 0 ? Math.round(velSamples.reduce((a, b) => a + b, 0) / velSamples.length * 10) / 10 : null,
        p50: percentile(velSamples, 50),
        max: velSamples.length > 0 ? Math.max(...velSamples) : null,
      },
      lastUpdated: profile.lastUpdated,
    };
  }
  return result;
}

function getRollups(limit = 60) {
  const { rollups } = readStore();
  return rollups.slice(-limit);
}

function getStats() {
  const entries = _ringBuffer;
  const ttfts = entries.map((e) => e.ttftMs).filter((v) => v !== null);
  const durations = entries.map((e) => e.inferenceDurationMs).filter((v) => v !== null);
  const velocities = entries.map((e) => e.tokenVelocity).filter((v) => v !== null);

  const byProvider = {};
  for (const e of entries) {
    if (!byProvider[e.provider]) byProvider[e.provider] = { total: 0, success: 0, fail: 0 };
    byProvider[e.provider].total++;
    if (e.success) byProvider[e.provider].success++;
    else byProvider[e.provider].fail++;
  }

  return {
    windowSize: entries.length,
    totalInWindow: entries.length,
    successCount: entries.filter((e) => e.success).length,
    failureCount: entries.filter((e) => !e.success).length,
    ttftAvg: ttfts.length > 0 ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : null,
    ttftP50: percentile(ttfts, 50),
    ttftP95: percentile(ttfts, 95),
    ttftP99: percentile(ttfts, 99),
    durationAvg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    durationP50: percentile(durations, 50),
    durationP95: percentile(durations, 95),
    tokenVelocityAvg: velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length * 10) / 10 : null,
                tokenVelocityMax: velocities.length > 0 ? Math.max(...velocities) : null,
    byProvider,
    queueBackpressure: getQueueBackpressure(),
    providerProfileCount: Object.keys(_providerProfiles).length,
  };
}

function resetMetrics() {
  _ringBuffer.length = 0;
  _ringIdx = 0;
  _queueDepths.length = 0;
  _activeRequests = 0;
  _maxConcurrent = 0;
  _rollups = [];
  _providerProfiles = {};
  _cacheDirty = true;
  writeStore();
  return { success: true };
}

module.exports = {
  recordRequest,
  requestQueued,
  requestDequeued,
  getQueueBackpressure,
  getRecentMetrics,
  getProviderProfiles,
  getRollups,
  getStats,
  resetMetrics,
};
