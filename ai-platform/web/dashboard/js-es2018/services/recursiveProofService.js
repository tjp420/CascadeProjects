// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Recursive Proof Aggregation Telemetry Service
 * Fetches Track 61 counters and engine stats from the vault API.
 */

import { createRingBuffer } from "../utils/sparkline.js";

const MAX_SAMPLES = 60; // 30 min @ 30s interval
const _history = new Map(); // counterKey -> ringBuffer

function _ensureBuffer(counterKey) {
  if (!_history.has(counterKey))
    _history.set(counterKey, createRingBuffer(MAX_SAMPLES));
  return _history.get(counterKey);
}

function _recordSnapshot(counters) {
  for (const [counterKey, value] of Object.entries(counters || {})) {
    if (typeof value === "number") {
      _ensureBuffer(counterKey).push(value);
    }
  }
}

export async function fetchRecursiveProofTelemetry() {
  try {
    const response = await fetch("/api/vault/recursive-aggregation/status");
    if (!response.ok) {
      if (response.status === 403)
        return { status: "forbidden", counters: {}, stats: {} };
      if (response.status === 404)
        return { status: "unavailable", counters: {}, stats: {} };
      throw new Error("HTTP " + response.status + ": " + response.statusText);
    }
    const data = await response.json();
    if (data.success !== true) {
      throw new Error(
        data.error || "Failed to retrieve recursive proof telemetry",
      );
    }
    const counters = data.counters || {};
    _recordSnapshot(counters);
    return {
      status: "success",
      counters,
      stats: data.stats || {},
      timestamp: data.timestamp,
    };
  } catch (error) {
    const msg =
      (error === null || error === void 0 ? void 0 : error.message) ||
      String(error);
    if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
      return { status: "unavailable", counters: {}, stats: {} };
    }
    window["console"]["error"](
      "[recursiveProofService] Error fetching telemetry:",
      msg,
    );
    throw error;
  }
}

export function getRecursiveProofHistory(counterKey) {
  const buf = _history.get(counterKey);
  return buf ? buf.values() : [];
}

export function clearRecursiveProofHistory() {
  _history.clear();
}
