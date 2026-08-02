'use strict';

/**
 * Stage 3: HSM adapter metrics registry.
 *
 * In-memory counters and histograms for HSM operations, exposed in
 * Prometheus exposition format. Follows the pattern established by
 * siem-exporter.cjs (in-memory counters) and the /api/agentic/metrics
 * endpoint (text/plain; version=0.0.4).
 *
 * @module hsm-adapter/hsm-metrics
 */

// ── Counters ────────────────────────────────────────────────────
const counters = {
  hsm_wrap_total: 0,
  hsm_wrap_failures_total: 0,
  hsm_unwrap_total: 0,
  hsm_unwrap_failures_total: 0,
  hsm_create_kek_total: 0,
  hsm_create_kek_failures_total: 0,
  hsm_rotate_kek_total: 0,
  hsm_zeroize_total: 0,
  hsm_circuit_opened_total: 0,
  hsm_circuit_closed_total: 0,
  hsm_circuit_half_open_total: 0,
  // Track 33: Recovery sync counters
  hsm_recovery_started_total: 0,
  hsm_recovery_synced_total: 0,
  hsm_recovery_failures_total: 0,
  hsm_recovery_catchup_batches_total: 0,
};

// ── Histograms (bucketed) ───────────────────────────────────────
// Latency histograms with buckets in milliseconds.
// Bucket boundaries chosen for HSM operations (typically 10-500ms).
const LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

const histograms = {
  hsm_wrap_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
  hsm_unwrap_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
  hsm_create_kek_duration_ms: { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length + 1).fill(0), sum: 0, count: 0 },
};

// Metadata for Prometheus exposition
const META = {
  hsm_wrap_total: { help: 'Total HSM wrapKey operations initiated.', type: 'counter' },
  hsm_wrap_failures_total: { help: 'Total HSM wrapKey operations that failed.', type: 'counter' },
  hsm_unwrap_total: { help: 'Total HSM unwrapKey operations initiated.', type: 'counter' },
  hsm_unwrap_failures_total: { help: 'Total HSM unwrapKey operations that failed.', type: 'counter' },
  hsm_create_kek_total: { help: 'Total KEK creation operations initiated.', type: 'counter' },
  hsm_create_kek_failures_total: { help: 'Total KEK creation operations that failed.', type: 'counter' },
  hsm_rotate_kek_total: { help: 'Total KEK rotation operations initiated.', type: 'counter' },
  hsm_zeroize_total: { help: 'Total KEK zeroization operations completed.', type: 'counter' },
  hsm_circuit_opened_total: { help: 'Total times the HSM circuit breaker transitioned to OPEN state.', type: 'counter' },
  hsm_circuit_closed_total: { help: 'Total times the HSM circuit breaker transitioned to CLOSED state.', type: 'counter' },
  hsm_circuit_half_open_total: { help: 'Total times the HSM circuit breaker transitioned to HALF-OPEN state.', type: 'counter' },
  hsm_recovery_started_total: { help: 'Total cluster node recovery sessions started.', type: 'counter' },
  hsm_recovery_synced_total: { help: 'Total cluster node recovery sessions that reached synced state.', type: 'counter' },
  hsm_recovery_failures_total: { help: 'Total cluster node recovery sessions that failed.', type: 'counter' },
  hsm_recovery_catchup_batches_total: { help: 'Total catch-up batches applied during recovery sync.', type: 'counter' },
  hsm_wrap_duration_ms: { help: 'Latency of HSM wrapKey operations in milliseconds.', type: 'histogram' },
  hsm_unwrap_duration_ms: { help: 'Latency of HSM unwrapKey operations in milliseconds.', type: 'histogram' },
  hsm_create_kek_duration_ms: { help: 'Latency of KEK creation operations in milliseconds.', type: 'histogram' },
};

/**
 * Increment a counter.
 * @param {string} name - counter name
 * @param {number} [value=1] - increment amount
 */
function incrementCounter(name, value = 1) {
  if (counters[name] !== undefined) {
    counters[name] += value;
  }
}

/**
 * Observe a latency value in a histogram.
 * @param {string} name - histogram name
 * @param {number} durationMs - observed duration in milliseconds
 */
function observeHistogram(name, durationMs) {
  const h = histograms[name];
  if (!h) return;
  h.sum += durationMs;
  h.count++;
  for (let i = 0; i < h.buckets.length; i++) {
    if (durationMs <= h.buckets[i]) {
      h.counts[i]++;
      return;
    }
  }
  // Overflow bucket (+Inf)
  h.counts[h.counts.length - 1]++;
}

/**
 * Reset all metrics to zero. Primarily for testing.
 */
function reset() {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
  for (const key of Object.keys(histograms)) {
    histograms[key].counts.fill(0);
    histograms[key].sum = 0;
    histograms[key].count = 0;
  }
}

/**
 * Get all metrics as a flat object (for programmatic access).
 * @returns {object} metric name -> value
 */
function getMetrics() {
  const result = { ...counters };
  for (const [name, h] of Object.entries(histograms)) {
    result[`${name}_count`] = h.count;
    result[`${name}_sum`] = h.sum;
    for (let i = 0; i < h.buckets.length; i++) {
      result[`${name}_bucket{le="${h.buckets[i]}"}`] = h.counts[i];
    }
    result[`${name}_bucket{le="+Inf"}`] = h.count;
  }
  return result;
}

/**
 * Render metrics in Prometheus exposition format.
 * @returns {string} Prometheus text format
 */
function renderPrometheus() {
  const lines = [];

  // Counters
  for (const [name, value] of Object.entries(counters)) {
    const meta = META[name];
    if (!meta) continue;
    lines.push(`# HELP ${name} ${meta.help}`);
    lines.push(`# TYPE ${name} ${meta.type}`);
    lines.push(`${name} ${value}`);
  }

  // Histograms
  for (const [name, h] of Object.entries(histograms)) {
    const meta = META[name];
    if (!meta) continue;
    lines.push(`# HELP ${name} ${meta.help}`);
    lines.push(`# TYPE ${name} ${meta.type}`);
    // Cumulative bucket counts
    let cumulative = 0;
    for (let i = 0; i < h.buckets.length; i++) {
      cumulative += h.counts[i];
      lines.push(`${name}_bucket{le="${h.buckets[i]}"} ${cumulative}`);
    }
    cumulative += h.counts[h.counts.length - 1];
    lines.push(`${name}_bucket{le="+Inf"} ${cumulative}`);
    lines.push(`${name}_sum ${h.sum}`);
    lines.push(`${name}_count ${h.count}`);
  }

  return lines.join('\n') + '\n';
}

module.exports = {
  incrementCounter,
  observeHistogram,
  reset,
  getMetrics,
  renderPrometheus,
  counters,
  histograms,
};
