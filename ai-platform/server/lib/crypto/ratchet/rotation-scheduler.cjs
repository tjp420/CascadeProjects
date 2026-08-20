"use strict";

/**
 * Track 113: In-memory rotation scheduler for hybrid identity ratchets.
 *
 * Monitors message count and wall-clock duration, emits a single
 * `QUANTUM_ROTATE_PENDING` warning at the configured threshold, and a
 * `QUANTUM_ROTATE_REQUIRED` event when either bound is reached.
 *
 * @module crypto/ratchet/rotation-scheduler
 */

const DEFAULT_MAX_MESSAGES = 10_000;
const DEFAULT_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WARNING_RATIO = 0.8;

class RotationScheduler extends require("node:events").EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxMessages=10000]
   * @param {number} [opts.maxDurationMs=86400000]
   * @param {number} [opts.warningRatio=0.8] — ratio of maxMessages before pending event
   * @param {number} [opts.checkIntervalMs=1000]
   */
  constructor(opts = {}) {
    super();
    this.maxMessages =
      typeof opts.maxMessages === "number"
        ? opts.maxMessages
        : DEFAULT_MAX_MESSAGES;
    this.maxDurationMs =
      typeof opts.maxDurationMs === "number"
        ? opts.maxDurationMs
        : DEFAULT_MAX_DURATION_MS;
    this.warningRatio =
      typeof opts.warningRatio === "number"
        ? opts.warningRatio
        : DEFAULT_WARNING_RATIO;
    this.checkIntervalMs =
      typeof opts.checkIntervalMs === "number" ? opts.checkIntervalMs : 1000;

    this._stepCount = 0;
    this._startTime = Date.now();
    this._pendingEmitted = false;
    this._requiredEmitted = false;
    this._timer = null;
  }

  start() {
    this._startTime = Date.now();
    this._stopTimer();
    this._timer = setInterval(
      () => this._checkDuration(),
      this.checkIntervalMs,
    );
    if (this._timer.unref) this._timer.unref();
  }

  close() {
    this._stopTimer();
  }

  reset() {
    this._stepCount = 0;
    this._startTime = Date.now();
    this._pendingEmitted = false;
    this._requiredEmitted = false;
  }

  recordStep() {
    this._stepCount += 1;
    this._checkThresholds();
    return this._stepCount;
  }

  getState() {
    return {
      stepCount: this._stepCount,
      startTime: this._startTime,
      elapsedMs: Date.now() - this._startTime,
      pendingEmitted: this._pendingEmitted,
      requiredEmitted: this._requiredEmitted,
    };
  }

  _checkThresholds() {
    const warningLimit = Math.floor(this.maxMessages * this.warningRatio);
    if (
      !this._pendingEmitted &&
      this._stepCount >= warningLimit &&
      this._stepCount < this.maxMessages
    ) {
      this._pendingEmitted = true;
      this.emit("QUANTUM_ROTATE_PENDING", {
        stepCount: this._stepCount,
        maxMessages: this.maxMessages,
        threshold: warningLimit,
      });
    }
    if (!this._requiredEmitted && this._stepCount >= this.maxMessages) {
      this._requiredEmitted = true;
      this.emit("QUANTUM_ROTATE_REQUIRED", {
        reason: "max_messages",
        stepCount: this._stepCount,
      });
    }
  }

  _checkDuration() {
    const elapsed = Date.now() - this._startTime;
    if (!this._requiredEmitted && elapsed >= this.maxDurationMs) {
      this._requiredEmitted = true;
      this.emit("QUANTUM_ROTATE_REQUIRED", {
        reason: "max_duration",
        elapsedMs: elapsed,
      });
    }
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = {
  RotationScheduler,
  DEFAULT_MAX_MESSAGES,
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_WARNING_RATIO,
};
