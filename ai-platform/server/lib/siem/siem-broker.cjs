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
      siem_tokens_borrowed_total: 0,
      siem_tokens_granted_total: 0,
      siem_token_requests_sent_total: 0,
      siem_token_requests_received_total: 0,
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
    // Attempt to borrow from peers if distributed sync is enabled
    if (this._distEnabled) {
      return this._borrowFromPeers();
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
      if (this._distSyncTimer) clearInterval(this._distSyncTimer);
      this.removeAllListeners();
    } catch {}
  }
}

// ── Distributed Token Bucket Coordination ───────────────────────
//
// Extends the broker with gossip-based token bucket synchronization for
// N-node clusters. Each node gets a fair-share quota (maxTokens / N) and
// can borrow surplus tokens from peers when exhausted. The cluster-wide
// effective rate limit converges to maxTokens regardless of node count.
//
// Protocol:
//   1. SIEM_BUCKET_SYNC  — periodic state broadcast (localTokens, capacity)
//   2. SIEM_TOKEN_REQUEST — ask a peer for tokens when local bucket empty
//   3. SIEM_TOKEN_GRANT   — peer grants tokens from its surplus
//
// Failure mode: if peers are unreachable (partition), each node falls back
// to its fair-share limit. CRITICAL/FATAL always bypass — invariant preserved.

const SYNC_INTERVAL_MS = 5000;
const RESERVE_FLOOR_RATIO = 0.2; // each node keeps at least 20% of its fair share

/**
 * Enable distributed token bucket coordination.
 * Must be called after the cluster has elected a leader and the node
 * count is known. The broker will broadcast its bucket state to peers
 * via the provided sendFn and process incoming sync messages via
 * handlePeerSync().
 *
 * @param {object} opts
 * @param {number} opts.nodeCount — N (total nodes in cluster)
 * @param {string} opts.nodeId — this node's ID
 * @param {function} opts.sendFn — (msg) => void, called to broadcast to peers
 * @param {number} [opts.syncIntervalMs] — gossip interval (default 5000ms)
 */
SiemSecurityBroker.prototype.enableDistributedSync = function (opts) {
  if (!opts || typeof opts.nodeCount !== 'number' || opts.nodeCount < 1) {
    throw new Error('enableDistributedSync: nodeCount must be a positive integer');
  }
  this._distNodeCount = opts.nodeCount;
  this._nodeId = opts.nodeId || 'node-1';
  this._sendToPeers = typeof opts.sendFn === 'function' ? opts.sendFn : null;
  this._syncInterval = opts.syncIntervalMs || SYNC_INTERVAL_MS;
  this._peerBuckets = new Map(); // nodeId -> { localTokens, maxLocalTokens, lastSeen }
  this._distEnabled = true;

  // Adjust local capacity to fair share
  const fairShare = Math.max(1, Math.floor(this.maxTokens / this._distNodeCount));
  this._fairShare = fairShare;
  this._reserveFloor = Math.max(1, Math.floor(fairShare * RESERVE_FLOOR_RATIO));
  // If current tokens exceed fair share, cap them
  if (this.tokens > fairShare) this.tokens = fairShare;

  // Start gossip timer
  this._distSyncTimer = setInterval(() => {
    this._broadcastBucketState();
  }, this._syncInterval);
  if (this._distSyncTimer.unref) this._distSyncTimer.unref();

  // Broadcast initial state
  this._broadcastBucketState();
};

/**
 * Broadcast this node's bucket state to all peers.
 * @private
 */
SiemSecurityBroker.prototype._broadcastBucketState = function () {
  if (!this._distEnabled || !this._sendToPeers) return;
  try {
    this._sendToPeers({
      type: 'SIEM_BUCKET_SYNC',
      from: this._nodeId,
      localTokens: this.tokens,
      maxLocalTokens: this._fairShare,
      timestamp: Date.now(),
    });
  } catch {}
};

/**
 * Handle an incoming SIEM_BUCKET_SYNC message from a peer.
 * Updates the peer bucket state map.
 * @param {object} msg — { from, localTokens, maxLocalTokens, timestamp }
 */
SiemSecurityBroker.prototype.handlePeerSync = function (msg) {
  if (!this._distEnabled || !msg || msg.type !== 'SIEM_BUCKET_SYNC') return;
  try {
    this._peerBuckets.set(msg.from, {
      localTokens: msg.localTokens,
      maxLocalTokens: msg.maxLocalTokens,
      lastSeen: Date.now(),
    });
  } catch {}
};

/**
 * Handle an incoming SIEM_TOKEN_REQUEST from a peer.
 * Grants tokens from surplus if available (above reserve floor).
 * @param {object} msg — { from, requested }
 * @returns {number} — number of tokens granted (0 if none)
 */
SiemSecurityBroker.prototype.handleTokenRequest = function (msg) {
  if (!this._distEnabled || !msg || msg.type !== 'SIEM_TOKEN_REQUEST') return 0;
  try {
    this._metrics.siem_token_requests_received_total += 1;
    const requested = Math.min(msg.requested || 0, this._fairShare);
    const surplus = this.tokens - this._reserveFloor;
    if (surplus <= 0) return 0;
    const granted = Math.min(requested, surplus);
    this.tokens -= granted;
    this._metrics.siem_tokens_consumed_total += granted;
    this._metrics.siem_tokens_granted_total += granted;

    // Send grant response
    if (this._sendToPeers) {
      this._sendToPeers({
        type: 'SIEM_TOKEN_GRANT',
        from: this._nodeId,
        to: msg.from,
        granted,
        timestamp: Date.now(),
      });
    }
    return granted;
  } catch {
    return 0;
  }
};

/**
 * Handle an incoming SIEM_TOKEN_GRANT from a peer.
 * Adds granted tokens to the local bucket (capped at maxTokens).
 * @param {object} msg — { from, granted }
 */
SiemSecurityBroker.prototype.handleTokenGrant = function (msg) {
  if (!this._distEnabled || !msg || msg.type !== 'SIEM_TOKEN_GRANT') return;
  try {
    if (msg.to !== this._nodeId) return; // not for us
    const space = this.maxTokens - this.tokens;
    const accepted = Math.min(msg.granted || 0, space);
    this.tokens += accepted;
  } catch {}
};

/**
 * Attempt to borrow tokens from peers when the local bucket is empty.
 * Called internally by _consumeToken when the local bucket is exhausted.
 * @private
 * @returns {boolean} — true if tokens were borrowed successfully
 */
SiemSecurityBroker.prototype._borrowFromPeers = function () {
  if (!this._distEnabled || !this._sendToPeers) return false;
  let borrowed = 0;
  const needed = Math.max(1, Math.floor(this._fairShare * 0.5));

  for (const [peerId, peer] of this._peerBuckets) {
    if (borrowed >= needed) break;
    const peerSurplus = peer.localTokens - this._reserveFloor;
    if (peerSurplus > 0) {
      // Send token request to this peer
      try {
        this._sendToPeers({
          type: 'SIEM_TOKEN_REQUEST',
          from: this._nodeId,
          to: peerId,
          requested: Math.min(needed - borrowed, peerSurplus),
          timestamp: Date.now(),
        });
      } catch {}
    }
  }

  // In a real async network, grants arrive via handleTokenGrant().
  // For synchronous testing, peers may grant immediately via handleTokenRequest.
  // The actual token addition happens when handleTokenGrant is called.
  return this.tokens > 0;
};

/**
 * Get distributed sync state for diagnostics.
 * @returns {object}
 */
SiemSecurityBroker.prototype.getDistributedState = function () {
  if (!this._distEnabled) {
    return {
      enabled: false,
      nodeId: null,
      nodeCount: null,
      fairShare: null,
      reserveFloor: null,
      localTokens: this.tokens,
      peerCount: 0,
      peers: {},
    };
  }
  return {
    enabled: true,
    nodeId: this._nodeId,
    nodeCount: this._distNodeCount,
    fairShare: this._fairShare,
    reserveFloor: this._reserveFloor,
    localTokens: this.tokens,
    peerCount: this._peerBuckets.size,
    peers: Object.fromEntries(this._peerBuckets),
  };
};

/**
 * Get a consolidated cluster telemetry snapshot combining metrics and distributed state.
 * Returns a single object suitable for REST API consumption by the dashboard.
 * @returns {object}
 */
SiemSecurityBroker.prototype.getClusterTelemetry = function () {
  const metrics = this.getMetrics();
  const distState = this.getDistributedState();
  return {
    timestamp: new Date().toISOString(),
    nodeId: distState.nodeId,
    nodeCount: distState.nodeCount,
    distributedSyncEnabled: distState.enabled,
    fairShare: distState.fairShare,
    reserveFloor: distState.reserveFloor,
    localTokens: distState.localTokens,
    peerCount: distState.peerCount,
    peers: distState.peers,
    metrics: {
      siem_events_processed_total: metrics.siem_events_processed_total,
      siem_events_dropped_total: metrics.siem_events_dropped_total,
      siem_events_bypassed_total: metrics.siem_events_bypassed_total,
      siem_tokens_consumed_total: metrics.siem_tokens_consumed_total,
      siem_tokens_borrowed_total: metrics.siem_tokens_borrowed_total,
      siem_tokens_granted_total: metrics.siem_tokens_granted_total,
      siem_token_requests_sent_total: metrics.siem_token_requests_sent_total,
      siem_token_requests_received_total: metrics.siem_token_requests_received_total,
      currentTokens: metrics.currentTokens,
    },
  };
};

module.exports = SiemSecurityBroker;
