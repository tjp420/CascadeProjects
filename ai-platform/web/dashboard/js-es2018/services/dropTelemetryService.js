// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Drop Telemetry Service
 * Reads client-side drag-and-drop telemetry counters.
 * Accumulates snapshots in a ring buffer for sparkline trend visualization.
 */

import { createRingBuffer } from "../utils/sparkline.js";

const MAX_SAMPLES = 60; // 10 min @ 10s interval

let counters = {
  totalDrops: 0,
  filesDropped: 0,
  preReadSuccesses: 0,
  preReadSkips: 0,
  preReadFailures: 0,
  firefoxBypass: 0,
  traversalErrors: 0,
};

const _history = new Map(); // counterKey -> ringBuffer

function _ensureBuffer(counterKey) {
  if (!_history.has(counterKey))
    _history.set(counterKey, createRingBuffer(MAX_SAMPLES));
  return _history.get(counterKey);
}

function _recordSnapshot() {
  for (const [key, value] of Object.entries(counters)) {
    if (typeof value === "number") {
      _ensureBuffer(key).push(value);
    }
  }
}

export function incrementDropCounter(key, amount) {
  if (counters[key] !== undefined) {
    counters[key] += amount || 1;
  }
}

export function getDropTelemetry() {
  return { ...counters };
}

export function resetDropTelemetry() {
  counters = {
    totalDrops: 0,
    filesDropped: 0,
    preReadSuccesses: 0,
    preReadSkips: 0,
    preReadFailures: 0,
    firefoxBypass: 0,
    traversalErrors: 0,
  };
  _history.clear();
}

export async function fetchDropTelemetry() {
  _recordSnapshot();
  return { status: "success", counters: getDropTelemetry() };
}

/**
 * Get the accumulated history for a specific drop counter.
 * @param {string} counterKey
 * @returns {number[]} Array of samples (may be empty)
 */
export function getDropHistory(counterKey) {
  const buf = _history.get(counterKey);
  return buf ? buf.values() : [];
}

/**
 * Clear all accumulated history.
 */
export function clearDropHistory() {
  _history.clear();
}
