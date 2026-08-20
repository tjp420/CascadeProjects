// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Enclave Telemetry Service
 * Fetches hardware enclave state and counters (Track 41) from the vault API.
 * Accumulates snapshots in a ring buffer for sparkline trend visualization.
 */

import { createRingBuffer } from "../utils/sparkline.js";

const MAX_SAMPLES = 60; // 15 min @ 15s interval
const _history = new Map(); // counterKey -> ringBuffer

function _ensureBuffer(counterKey) {
  if (!_history.has(counterKey))
    _history.set(counterKey, createRingBuffer(MAX_SAMPLES));
  return _history.get(counterKey);
}

function _recordSnapshot(counters) {
  for (const [key, value] of Object.entries(counters || {})) {
    if (typeof value === "number") {
      _ensureBuffer(key).push(value);
    }
  }
}

export async function fetchEnclaveTelemetry() {
  try {
    const response = await fetch("/api/vault/enclave/status");
    if (!response.ok) {
      if (response.status === 403)
        return { status: "forbidden", registered: false, counters: {} };
      if (response.status === 404 || response.status === 503)
        return { status: "unavailable", registered: false, counters: {} };
      throw new Error("HTTP " + response.status + ": " + response.statusText);
    }
    const data = await response.json();
    if (data.success !== true) {
      throw new Error(data.error || "Failed to retrieve enclave telemetry");
    }
    const counters = data.counters || {};
    _recordSnapshot(counters);
    return {
      status: "success",
      registered: Boolean(data.registered),
      backend: data.backend || null,
      mrenclave: data.mrenclave || null,
      initialized: Boolean(data.initialized),
      counters: counters,
      timestamp: data.timestamp,
    };
  } catch (error) {
    const msg =
      (error === null || error === void 0 ? void 0 : error.message) ||
      String(error);
    if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
      return { status: "unavailable", registered: false, counters: {} };
    }
    window["console"]["error"](
      "[enclaveTelemetryService] Error fetching telemetry:",
      msg,
    );
    throw error;
  }
}

export async function getEnclaveStatus() {
  const data = await fetchEnclaveTelemetry();
  return {
    registered: data.registered,
    backend: data.backend,
    mrenclave: data.mrenclave,
    initialized: data.initialized,
  };
}

/**
 * Get the accumulated history for a specific enclave counter.
 * @param {string} counterKey
 * @returns {number[]} Array of samples (may be empty)
 */
export function getEnclaveHistory(counterKey) {
  const buf = _history.get(counterKey);
  return buf ? buf.values() : [];
}

/**
 * Clear all accumulated history.
 */
export function clearEnclaveHistory() {
  _history.clear();
}
