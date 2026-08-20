"use strict";

/**
 * Track 113: Prometheus-style telemetry registry for the hybrid identity ratchet.
 *
 * @module crypto/ratchet/ratchet-metrics
 */

const DURATION_BUCKETS_MS = [
  1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

class RatchetMetrics {
  constructor() {
    this._durations = new Map(); // mode -> { sum, count, buckets }
    this._failures = new Map(); // reason -> count
  }

  observeHandshakeDuration(mode, durationMs) {
    if (!this._durations.has(mode)) {
      this._durations.set(mode, { sum: 0, count: 0, buckets: new Map() });
    }
    const h = this._durations.get(mode);
    const ms = Number(durationMs);
    h.sum += ms;
    h.count += 1;
    for (const b of DURATION_BUCKETS_MS) {
      if (ms <= b) {
        h.buckets.set(b, (h.buckets.get(b) || 0) + 1);
      }
    }
  }

  incrementHandshakeFailed(reason) {
    if (typeof reason !== "string" || !reason) {
      reason = "unknown";
    }
    this._failures.set(reason, (this._failures.get(reason) || 0) + 1);
  }

  snapshot() {
    const durations = {};
    for (const [mode, h] of this._durations) {
      durations[mode] = {
        sum: h.sum,
        count: h.count,
        buckets: Object.fromEntries(h.buckets),
      };
    }
    const failures = Object.fromEntries(this._failures);
    return {
      identity_handshake_duration_ms: durations,
      identity_handshake_failed_total: failures,
    };
  }
}

function reasonFromError(err) {
  if (err && err.code) {
    switch (err.code) {
      case "SIGNATURE_INVALID":
        return "signature_invalid";
      case "CLASSICAL_DEPRECATION_DEADLINE":
        return "expired_deadline";
      case "INVALID_HANDSHAKE":
      case "INVALID_HANDSHAKE_VERSION":
        return "invalid_handshake";
      case "INVALID_PUBLIC_KEY":
      case "INVALID_HYBRID_KEY_LAYOUT":
      case "UNSUPPORTED_HYBRID_KEY_VERSION":
        return "invalid_public_key";
      case "PQC_DECAPSULATE_FAILED":
      case "PQC_ENCAPSULATE_FAILED":
      case "PQC_BOOTSTRAP_FAILED":
        return "pqc_error";
      default:
        return err.code.toLowerCase();
    }
  }
  return "unknown";
}

module.exports = { RatchetMetrics, reasonFromError };
