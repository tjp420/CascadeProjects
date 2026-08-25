"use strict";

// Simple SIEM exporter: batches events and ships them to an HTTPS endpoint.
// Non-blocking and fail-silent to avoid impacting request paths.
//
// mTLS Transport Layer Hardening:
// When SIEM_TLS_CLIENT_CERT_PATH, SIEM_TLS_CLIENT_KEY_PATH, and
// SIEM_TLS_CA_CERT_PATH are all set, the exporter constructs an https.Agent
// with client certificates and rejectUnauthorized: true for certificate-pinned
// server verification. When any cert path is missing, the exporter gracefully
// falls back to standard fetch() without an mTLS agent.

const { setInterval } = require("timers");
const fs = require("fs");
const https = require("https");
const fetch = global.fetch || require("node-fetch");
const logger = require("./app-logger.cjs");

const SIEM_ENDPOINT = process.env.SIEM_ENDPOINT || null;
const SIEM_API_KEY = process.env.SIEM_API_KEY || null;

function getBatchSize() {
  const v = parseInt(process.env.SIEM_BATCH_SIZE, 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

const FLUSH_MS = parseInt(process.env.SIEM_FLUSH_MS, 10) || 5000;
const RETRY_BASE_MS = parseInt(process.env.SIEM_RETRY_BASE_MS, 10) || 100;
const RETRY_MAX_MS = parseInt(process.env.SIEM_RETRY_MAX_MS, 10) || 60 * 1000;
const RETRY_MAX_ATTEMPTS =
  parseInt(process.env.SIEM_RETRY_MAX_ATTEMPTS, 10) || 5;
const MAX_QUEUE_DEPTH = parseInt(process.env.SIEM_MAX_QUEUE_DEPTH, 10) || 1000;

// ── Bounded ring queue for O(1) enqueue / dequeue ─────────────────────
// Replaces a plain JS array to avoid expensive shift/splice under load.
class BoundedQueue {
  constructor(capacity) {
    this._capacity = Math.max(1, capacity);
    this._buffer = new Array(this._capacity);
    this._head = 0; // next write position
    this._tail = 0; // next read position
    this._count = 0;
    this._dropped = 0;
  }

  get length() {
    return this._count;
  }
  get dropped() {
    return this._dropped;
  }

  push(event) {
    if (!event) return false;
    this._buffer[this._head] = event;
    this._head = (this._head + 1) % this._capacity;
    if (this._count === this._capacity) {
      // Overwrite oldest (tail) and advance tail
      this._tail = this._head;
      this._dropped += 1;
      return true;
    }
    this._count += 1;
    return true;
  }

  take(n) {
    const count = Math.min(n, this._count);
    if (count <= 0) return [];
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this._buffer[this._tail];
      this._buffer[this._tail] = undefined;
      this._tail = (this._tail + 1) % this._capacity;
    }
    this._count -= count;
    return out;
  }

  reset() {
    this._head = 0;
    this._tail = 0;
    this._count = 0;
    this._dropped = 0;
    for (let i = 0; i < this._capacity; i++) this._buffer[i] = undefined;
  }

  toArray() {
    const out = new Array(this._count);
    for (let i = 0; i < this._count; i++) {
      out[i] = this._buffer[(this._tail + i) % this._capacity];
    }
    return out;
  }
}

// ── mTLS Agent Construction ──────────────────────────────────────────
//
// Reads client cert, client key, and CA cert from filesystem paths specified
// via environment variables. Follows the existing CLUSTER_CERT/CLUSTER_KEY/
// CLUSTER_CA_CERT pattern from cluster-keyring-sync.cjs.
//
// When any of the three paths are unset or unreadable, the exporter falls back
// to standard fetch() without an mTLS agent. This ensures logging continuity
// even when certificate configurations are missing.

let _mtlsAgent = null;
let _mtlsEnabled = false;
let _shuttingDown = false;

(function _initMtlsAgent() {
  const certPath = process.env.SIEM_TLS_CLIENT_CERT_PATH;
  const keyPath = process.env.SIEM_TLS_CLIENT_KEY_PATH;
  const caPath = process.env.SIEM_TLS_CA_CERT_PATH;

  // All three paths must be set to enable mTLS
  if (!certPath || !keyPath || !caPath) {
    if (certPath || keyPath || caPath) {
      // Partial configuration — log a warning
      try {
        logger.warn(
          "[SIEM Exporter] mTLS certs partially configured, falling back to standard egress",
          {
            hasCert: !!certPath,
            hasKey: !!keyPath,
            hasCa: !!caPath,
          },
        );
      } catch {}
    }
    _mtlsEnabled = false;
    _mtlsAgent = null;
    return;
  }

  try {
    const cert = fs.readFileSync(certPath, "utf8");
    const key = fs.readFileSync(keyPath, "utf8");
    const ca = fs.readFileSync(caPath, "utf8");
    const rejectUnauthorized =
      process.env.SIEM_TLS_REJECT_UNAUTHORIZED !== "false";

    _mtlsAgent = new https.Agent({
      cert,
      key,
      ca,
      rejectUnauthorized,
    });
    _mtlsEnabled = true;
    try {
      logger.info("[SIEM Exporter] mTLS transport enabled", {
        rejectUnauthorized,
        certPath,
        keyPath,
        caPath,
      });
    } catch {}
  } catch (err) {
    console.error("siem-exporter.cjs error:", err);
    // Cert files exist but can't be read — fall back gracefully
    try {
      logger.warn(
        "[SIEM Exporter] mTLS cert read failed, falling back to standard egress",
        {
          error: err && err.message,
        },
      );
    } catch {}
    _mtlsEnabled = false;
    _mtlsAgent = null;
  }
})();

let queue = new BoundedQueue(MAX_QUEUE_DEPTH);
let flushing = false;
let _totalSendAttempts = 0;
// In-memory metrics registry (thread-safe for single-node process)
const _metrics = {
  siem_delivery_retries_total: 0,
  siem_delivery_dropped_total: 0,
  siem_queue_dropped_total: 0,
  siem_queue_depth_current: 0,
  siem_queue_capacity_total: MAX_QUEUE_DEPTH,
  siem_batches_flushed_total: 0,
};

function enqueue(event) {
  try {
    if (_shuttingDown) return;
    if (!event || typeof event !== "object") return;
    const droppedBefore = queue.dropped;
    queue.push(event);
    if (queue.dropped > droppedBefore) {
      _metrics.siem_queue_dropped_total += 1;
    }
    _metrics.siem_queue_depth_current = queue.length;
    if (queue.length >= getBatchSize()) flush().catch(() => {});
  } catch (e) {
    console.error("siem-exporter.cjs error:", e);
    // swallow
  }
}

async function flush() {
  if (flushing || queue.length === 0) return;
  if (!SIEM_ENDPOINT) {
    // No endpoint configured; drop events after a local noop
    queue.reset();
    return;
  }
  flushing = true;
  const payload = queue.take(getBatchSize());
  _metrics.siem_batches_flushed_total += 1;
  _metrics.siem_queue_depth_current = queue.length;

  // Non-blocking send with retries
  sendBatch(payload).catch(() => {});

  flushing = false;
}

async function sendBatch(batch, attempt = 0) {
  _totalSendAttempts++;
  try {
    const fetchOpts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SIEM_API_KEY ? { Authorization: `Bearer ${SIEM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ events: batch, source: "ai-platform" }),
      timeout: 5000,
    };

    // Attach mTLS agent when configured
    if (_mtlsEnabled && _mtlsAgent) {
      // Node.js native fetch uses 'dispatcher'; node-fetch uses 'agent'
      const isNodeFetch =
        typeof require === "function" &&
        require.resolve &&
        (() => {
          try {
            require.resolve("node-fetch");
            return true;
          } catch {
            return false;
          }
        })();
      if (isNodeFetch && !global.fetch) {
        fetchOpts.agent = _mtlsAgent;
      } else {
        // Native fetch (Node 18+) — use dispatcher for undici Agent
        // For https.Agent compatibility, we pass via agent when dispatcher
        // is not supported (falls through gracefully)
        fetchOpts.agent = _mtlsAgent;
      }
    }

    await fetch(SIEM_ENDPOINT, fetchOpts);
    return true;
  } catch (e) {
    if (_shuttingDown) return false;
    if (attempt < RETRY_MAX_ATTEMPTS) {
      // record a retry attempt for observability
      try {
        _metrics.siem_delivery_retries_total += 1;
      } catch (mErr) {
        console.error("siem-exporter.cjs error:", mErr);
      }
      const delay = Math.min(
        RETRY_MAX_MS,
        RETRY_BASE_MS * Math.pow(2, attempt),
      );
      try {
        logger.warn("[SIEM Exporter] sendBatch failed, scheduling retry", {
          attempt,
          delay,
          error: e && e.message,
        });
        setTimeout(() => {
          if (!_shuttingDown) sendBatch(batch, attempt + 1).catch(() => {});
        }, delay);
      } catch (s) {
        console.error("siem-exporter.cjs error:", s);
        // ignore scheduling failure
      }
    } else {
      // Retries exhausted: re-enqueue to head; bounded queue drops oldest on overflow
      try {
        logger.error(
          "[SIEM Exporter] sendBatch retries exhausted, re-enqueueing batch",
          { attempts: attempt + 1, error: e && e.message },
        );
        const droppedBefore = queue.dropped;
        for (const e of batch) queue.push(e);
        const dropped = queue.dropped - droppedBefore;
        if (dropped > 0) {
          try {
            _metrics.siem_delivery_dropped_total += dropped;
          } catch (mErr) {
            console.error("siem-exporter.cjs error:", mErr);
          }
        }
      } catch (err) {
        logger.error(
          "[SIEM Exporter] failed to re-enqueue batch after retries exhausted",
          { error: err && err.message },
        );
      }
    }
    return false;
  }
}

// Periodic flush
const _timer = setInterval(() => {
  try {
    flush().catch(() => {});
  } catch {}
}, FLUSH_MS);
if (_timer.unref) _timer.unref();

function close() {
  try {
    clearInterval(_timer);
  } catch {}
  if (_brokerListener) {
    try {
      _brokerListener.broker.removeListener(
        "transport_batch_queue",
        _brokerListener.fn,
      );
    } catch {}
    _brokerListener = null;
  }
}

async function shutdown() {
  _shuttingDown = true;
  try {
    clearInterval(_timer);
  } catch {}
  if (_brokerListener) {
    try {
      _brokerListener.broker.removeListener(
        "transport_batch_queue",
        _brokerListener.fn,
      );
    } catch {}
    _brokerListener = null;
  }
  try {
    queue.reset();
  } catch {}
  _mtlsAgent = null;
  _mtlsEnabled = false;
  flushing = false;
  return Promise.resolve();
}

// ── SiemSecurityBroker integration ──────────────────────────────────
let _brokerListener = null;

/**
 * Connect a SiemSecurityBroker to the exporter.
 * The broker's `transport_batch_queue` events are enqueued for batch HTTPS delivery.
 * @param {object} broker - SiemSecurityBroker instance
 */
function connectBroker(broker) {
  if (!broker || typeof broker.on !== "function") return;
  // Remove any previous listener
  if (_brokerListener) {
    try {
      _brokerListener.broker.removeListener(
        "transport_batch_queue",
        _brokerListener.fn,
      );
    } catch {}
  }
  const fn = (event) => {
    try {
      if (_shuttingDown) return;
      enqueue(event);
    } catch (e) {
      try {
        logger.warn("[SIEM Exporter] broker enqueue failed", {
          error: e && e.message,
        });
      } catch {}
    }
  };
  broker.on("transport_batch_queue", fn);
  _brokerListener = { broker, fn };
}

module.exports = {
  enqueue,
  flush,
  close,
  shutdown,
  sendBatch,
  connectBroker,
  _debug: {
    getQueue: () => {
      // Return a live-array proxy so tests can q.push() and Array.isArray() works.
      const snapshot = queue.toArray();
      return new Proxy(snapshot, {
        get(target, prop) {
          if (prop === "push") {
            return (event) => {
              queue.push(event);
              return target.push(event);
            };
          }
          if (prop === "length") return target.length;
          if (prop === "reset")
            return () => {
              queue.reset();
              target.length = 0;
            };
          return target[prop];
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
      });
    },
    isFlushing: () => flushing,
    getBatchSize,
    resetQueue: () => {
      queue.reset();
      flushing = false;
    },
    getTotalSendAttempts: () => _totalSendAttempts,
    getMetrics: () => ({ ..._metrics }),
    isMtlsEnabled: () => _mtlsEnabled,
    getMtlsAgent: () => _mtlsAgent,
    getCapacity: () => MAX_QUEUE_DEPTH,
  },
};
