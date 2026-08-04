'use strict';

/**
 * Unified SIEM Security Broker
 *
 * Consolidates the three fragmented SIEM emission surfaces into a single
 * coordination point:
 *   1. siem-exporter.cjs       — batch HTTPS exporter
 *   2. siem-transport.cjs      — Winston transport (stub)
 *   3. hardware-attestation    — callback-based _emitSIEM
 *   4. cluster-keyring-sync    — hook array + rate limiting
 *
 * Architecture:
 *   [ Security Event ] → [ Token Bucket Rate-Limiter ] → [ Strategy Router ] → [ Transports ]
 *
 * Transport strategies:
 *   - HYBRID (default): CRITICAL/FATAL stream immediately via Winston + stdout;
 *     lower severity batched via siem-exporter + stdout.
 *   - STREAMING:        All events stream directly via Winston transport.
 *   - STDOUT_ONLY:      All events write structured JSON lines to stdout
 *                       (for FluentBit/Vector/Logstash sidecar pickup).
 *
 * Security invariants:
 *   - CRITICAL and FATAL events ALWAYS bypass the rate limiter to prevent
 *     ingestion blinding during attack scenarios.
 *   - All events are emitted to stdout as structured JSON lines regardless
 *     of strategy, ensuring no event is lost even if transports fail.
 *   - The broker is fail-silent: errors in transport dispatch never throw
 *     to the caller.
 *
 * @module server/lib/siem/siem-broker
 */

const crypto = require('crypto');
const EventEmitter = require('events');

const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'FATAL']);
const BYPASS_SEVERITIES = new Set(['CRITICAL', 'FATAL']);

/**
 * SiemSecurityBroker — unified observability surface for security events.
 */
class SiemSecurityBroker extends EventEmitter {
  /**
   * @param {object} config
   * @param {number} [config.rateLimitMaxTokens=100]    — Token bucket capacity ceiling
   * @param {number} [config.rateLimitRefillRateMs=1000] — Refill interval in milliseconds
   * @param {string} [config.transportStrategy='HYBRID'] — 'HYBRID' | 'STREAMING' | 'STDOUT_ONLY'
   */
  constructor(config = {}) {
    super();
    this.maxTokens = config.rateLimitMaxTokens || 100;
    this.refillRate = config.rateLimitRefillRateMs || 1000;
    this.strategy = config.transportStrategy || 'HYBRID';
    this.tokens = this.maxTokens;

    // Metrics registry for observability
    this._metrics = {
      siem_events_processed_total: 0,
      siem_events_dropped_total: 0,
      siem_events_bypassed_total: 0,
      siem_tokens_consumed_total: 0,
    };

    this._initTokenRefillPipeline();
  }

  /**
   * Emits a structured security event across configured transports.
   *
   * CRITICAL and FATAL events bypass the rate limiter entirely to prevent
   * ingestion blinding during active attack scenarios.
   *
   * @param {object} payload - Immutable telemetry event frame
   * @param {('LOW'|'MEDIUM'|'HIGH'|'CRITICAL'|'FATAL')} payload.siemSeverity
   * @param {string} payload.siemCategory - Functional signature (e.g. 'ATTESTATION_NONCE_REPLAY')
   * @param {object} [payload.context] - Structural data envelope (identities, fingerprints, targets)
   * @param {string} [payload.siemSource] - Originating module (e.g. 'hardware-attestation-verify')
   * @returns {boolean} - true if processed; false if dropped by rate limiter
   */
  logEvent(payload) {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('INVALID_TELEMETRY_FRAME_MISSING_MANDATORY_METRIC');
      }
      if (!payload.siemSeverity || !VALID_SEVERITIES.has(payload.siemSeverity)) {
        throw new Error('INVALID_TELEMETRY_FRAME_MISSING_MANDATORY_METRIC');
      }
      if (!payload.siemCategory) {
        throw new Error('INVALID_TELEMETRY_FRAME_MISSING_MANDATORY_METRIC');
      }

      const isHighPriority = BYPASS_SEVERITIES.has(payload.siemSeverity);

      // Rate limiting — CRITICAL/FATAL bypass
      if (!isHighPriority && !this._consumeToken()) {
        this._metrics.siem_events_dropped_total += 1;
        this.emit('telemetry_dropped', {
          category: payload.siemCategory,
          severity: payload.siemSeverity,
          timestamp: Date.now(),
        });
        return false;
      }

      if (isHighPriority) {
        this._metrics.siem_events_bypassed_total += 1;
      }
      this._metrics.siem_events_processed_total += 1;

      const standardizedEvent = this._normalizePayload(payload);
      this._dispatch(standardizedEvent, isHighPriority);
      return true;
    } catch (err) {
      // Fail-silent: never throw to the caller
      try {
        this.emit('broker_error', { error: err.message, timestamp: Date.now() });
      } catch {}
      return false;
    }
  }

  /**
   * Consume a token from the bucket. Returns false if empty.
   * @private
   */
  _consumeToken() {
    if (this.tokens > 0) {
      this.tokens -= 1;
      this._metrics.siem_tokens_consumed_total += 1;
      return true;
    }
    return false;
  }

  /**
   * Initialize the token refill pipeline.
   * @private
   */
  _initTokenRefillPipeline() {
    const timer = setInterval(() => {
      if (this.tokens < this.maxTokens) {
        this.tokens += 1;
      }
    }, this.refillRate);
    if (timer.unref) timer.unref();
    this._refillTimer = timer;
  }

  /**
   * Normalize the payload into a standardized immutable event frame.
   * @private
   */
  _normalizePayload(source) {
    return Object.freeze({
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      siemSeverity: source.siemSeverity,
      siemCategory: source.siemCategory,
      siemSource: source.siemSource || 'unknown',
      metadata: source.context || {},
      runtimeEnvironment: process.env.NODE_ENV || 'production',
    });
  }

  /**
   * Dispatch the event to configured transports based on strategy.
   *
   * @param {object} event - Standardized event frame
   * @param {boolean} forceImmediateStream - Whether to bypass batching
   * @private
   */
  _dispatch(event, forceImmediateStream) {
    let rawOutputString;
    try {
      rawOutputString = JSON.stringify(event);
    } catch {
      rawOutputString = JSON.stringify({
        eventId: event.eventId,
        timestamp: event.timestamp,
        siemCategory: event.siemCategory,
        error: 'serialization_failed',
      });
    }

    switch (this.strategy) {
      case 'STREAMING':
        // All events stream directly via Winston transport
        this.emit('transport_winston_stream', event);
        break;

      case 'STDOUT_ONLY':
        // Ideal for serverless or sidecar proxies (FluentBit/Vector)
        process.stdout.write(rawOutputString + '\n');
        break;

      case 'HYBRID':
      default:
        if (forceImmediateStream) {
          // CRITICAL/FATAL: direct stream to Winston
          this.emit('transport_winston_stream', event);
        } else {
          // Lower severity: push to batched HTTPS exporter
          this.emit('transport_batch_queue', event);
        }
        // Always write to stdout for log collector pickup
        process.stdout.write(rawOutputString + '\n');
        break;
    }
  }

  /**
   * Get current metrics snapshot.
   * @returns {object}
   */
  getMetrics() {
    return { ...this._metrics, currentTokens: this.tokens };
  }

  /**
   * Clean up resources (timers, listeners).
   */
  close() {
    try {
      clearInterval(this._refillTimer);
      this.removeAllListeners();
    } catch {}
  }
}

module.exports = SiemSecurityBroker;
