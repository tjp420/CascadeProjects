'use strict';

// Simple SIEM exporter: batches events and ships them to an HTTPS endpoint.
// Non-blocking and fail-silent to avoid impacting request paths.

const { setInterval } = require('timers');
const fetch = global.fetch || require('node-fetch');
const logger = require('./app-logger.cjs');

const SIEM_ENDPOINT = process.env.SIEM_ENDPOINT || null;
const SIEM_API_KEY = process.env.SIEM_API_KEY || null;

function getBatchSize() {
  const v = parseInt(process.env.SIEM_BATCH_SIZE, 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

const FLUSH_MS = parseInt(process.env.SIEM_FLUSH_MS, 10) || 5000;
const RETRY_BASE_MS = parseInt(process.env.SIEM_RETRY_BASE_MS, 10) || 100;
const RETRY_MAX_MS = parseInt(process.env.SIEM_RETRY_MAX_MS, 10) || 60 * 1000;
const RETRY_MAX_ATTEMPTS = parseInt(process.env.SIEM_RETRY_MAX_ATTEMPTS, 10) || 5;

let queue = [];
let flushing = false;
let _totalSendAttempts = 0;
// In-memory metrics registry (thread-safe for single-node process)
const _metrics = {
  siem_delivery_retries_total: 0,
  siem_delivery_dropped_total: 0,
};

function enqueue(event) {
  try {
    if (!event || typeof event !== 'object') return;
    queue.push(event);
    if (queue.length >= getBatchSize()) flush().catch(() => {});
  } catch (e) {
    // swallow
  }
}

async function flush() {
  if (flushing || queue.length === 0) return;
  if (!SIEM_ENDPOINT) {
    // No endpoint configured; drop events after a local noop
    queue = [];
    return;
  }
  flushing = true;
  const payload = queue.splice(0, getBatchSize());

  // Non-blocking send with retries
  sendBatch(payload).catch(() => {});

  flushing = false;
}

async function sendBatch(batch, attempt = 0) {
  _totalSendAttempts++;
  try {
    await fetch(SIEM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SIEM_API_KEY ? { Authorization: `Bearer ${SIEM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ events: batch, source: 'ai-platform' }),
      timeout: 5000,
    });
    return true;
  } catch (e) {
    if (attempt < RETRY_MAX_ATTEMPTS) {
      // record a retry attempt for observability
      try { _metrics.siem_delivery_retries_total += 1; } catch (mErr) {}
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, attempt));
      try {
        logger.warn('[SIEM Exporter] sendBatch failed, scheduling retry', { attempt, delay, error: e && e.message });
        setTimeout(() => {
          sendBatch(batch, attempt + 1).catch(() => {});
        }, delay);
      } catch (s) {
        // ignore scheduling failure
      }
    } else {
      // Retries exhausted: re-enqueue to head with trim
      try {
        logger.error('[SIEM Exporter] sendBatch retries exhausted, re-enqueueing batch (trim to 1000)', { attempts: attempt + 1, error: e && e.message });
        // compute drop count when trimming to protect memory
        const beforeConcatLen = queue.length;
        const concatenated = batch.concat(queue);
        queue = concatenated.slice(0, 1000);
        const dropped = Math.max(0, concatenated.length - queue.length);
        if (dropped > 0) {
          try { _metrics.siem_delivery_dropped_total += dropped; } catch (mErr) {}
        }
      } catch (err) {
        logger.error('[SIEM Exporter] failed to re-enqueue batch after retries exhausted', { error: err && err.message });
      }
    }
    return false;
  }
}

// Periodic flush
const _timer = setInterval(() => {
  try { flush().catch(() => {}); } catch {}
}, FLUSH_MS);
if (_timer.unref) _timer.unref();

function close() {
  try { clearInterval(_timer); } catch {}
}

module.exports = {
  enqueue,
  flush,
  close,
  sendBatch,
  _debug: {
    getQueue: () => queue,
    isFlushing: () => flushing,
    getBatchSize,
    resetQueue: () => { queue = []; flushing = false; },
    getTotalSendAttempts: () => _totalSendAttempts,
    getMetrics: () => ({ ..._metrics }),
  },
};
