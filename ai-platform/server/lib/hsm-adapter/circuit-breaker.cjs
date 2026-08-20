"use strict";

/**
 * Stage 3: Adaptive circuit breaker for HSM adapter operations.
 *
 * Follows the pattern established by cloud-inference-service.cjs
 * (threshold=5, timeout=60s, half-open probe) but extracted into a
 * reusable class so all HSM adapters can share the same resilience
 * semantics.
 *
 * States:
 *   CLOSED    — Normal operation, all requests pass through.
 *   OPEN      — Failures exceeded threshold; all requests rejected
 *               with CIRCUIT_OPEN error until cooldown expires.
 *   HALF_OPEN — Cooldown expired; one probe request is allowed
 *               through. On success → CLOSED. On failure → OPEN.
 *
 * State transitions are emitted via the onTransition callback so
 * the adapter can route them through the _audit() pipeline.
 *
 * @module hsm-adapter/circuit-breaker
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

const STATES = {
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half-open",
};

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30 * 1000; // 30 seconds

/**
 * Circuit breaker for a single HSM provider instance.
 */
class CircuitBreaker {
  /**
   * @param {object} [options]
   * @param {number} [options.threshold=5] - consecutive failures to open
   * @param {number} [options.cooldownMs=30000] - half-open cooldown period
   * @param {Function} [options.onTransition] - callback(state, prev, info)
   * @param {string} [options.name] - provider name for logging
   */
  constructor(options = {}) {
    this.threshold = options.threshold || DEFAULT_THRESHOLD;
    this.cooldownMs = options.cooldownMs || DEFAULT_COOLDOWN_MS;
    this.onTransition = options.onTransition || null;
    this.name = options.name || "hsm";

    this._state = STATES.CLOSED;
    this._failures = 0;
    this._lastFailure = 0;
    this._probePending = false;
  }

  /**
   * Current state.
   * @returns {string} STATES.CLOSED | STATES.OPEN | STATES.HALF_OPEN
   */
  get state() {
    return this._state;
  }

  /**
   * Check if a request is allowed through.
   * @returns {boolean} true if request should be rejected (circuit open)
   */
  isBlocked() {
    if (this._state === STATES.CLOSED) {
      return false;
    }

    if (this._state === STATES.OPEN) {
      const elapsed = Date.now() - this._lastFailure;
      if (elapsed >= this.cooldownMs) {
        // Transition to half-open: allow one probe
        if (this._probePending) {
          return true; // Another probe is already in flight
        }
        this._transition(STATES.HALF_OPEN);
        this._probePending = true;
        return false;
      }
      return true; // Still in cooldown
    }

    // HALF_OPEN: only one probe at a time
    if (this._state === STATES.HALF_OPEN) {
      return this._probePending; // Block if probe already in flight
    }

    return false;
  }

  /**
   * Record a successful operation.
   */
  recordSuccess() {
    if (this._state !== STATES.CLOSED) {
      this._transition(STATES.CLOSED);
    }
    this._failures = 0;
    this._probePending = false;
  }

  /**
   * Record a failed operation.
   * @param {Error} [err] - the error that caused the failure
   */
  recordFailure(err) {
    this._failures++;
    this._lastFailure = Date.now();
    this._probePending = false;

    if (this._state === STATES.HALF_OPEN) {
      // Probe failed — reopen circuit
      this._transition(STATES.OPEN, {
        reason: "probe_failed",
        error: err && err.message,
      });
    } else if (
      this._failures >= this.threshold &&
      this._state === STATES.CLOSED
    ) {
      this._transition(STATES.OPEN, {
        reason: "threshold_exceeded",
        failures: this._failures,
      });
    }
  }

  /**
   * Force-reset the circuit breaker to CLOSED state.
   * Primarily for testing or manual intervention.
   */
  reset() {
    this._transition(STATES.CLOSED, { reason: "manual_reset" });
    this._failures = 0;
    this._probePending = false;
  }

  /**
   * Get a snapshot of internal state for observability.
   * @returns {object} state snapshot
   */
  getSnapshot() {
    return {
      state: this._state,
      failures: this._failures,
      threshold: this.threshold,
      cooldownMs: this.cooldownMs,
      lastFailure: this._lastFailure,
      probePending: this._probePending,
    };
  }

  /**
   * Transition to a new state and emit the transition callback.
   * @param {string} newState
   * @param {object} [info] - extra context about the transition
   * @private
   */
  _transition(newState, info = {}) {
    const prev = this._state;
    if (prev === newState) return;
    this._state = newState;
    if (this.onTransition) {
      this.onTransition(newState, prev, { name: this.name, ...info });
    }
  }
}

module.exports = {
  CircuitBreaker,
  STATES,
  DEFAULT_THRESHOLD,
  DEFAULT_COOLDOWN_MS,
};
