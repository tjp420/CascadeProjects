'use strict';

// Simple SIEM exporter: batches events and ships them to an HTTPS endpoint.
// Non-blocking and fail-silent to avoid impacting request paths.

const { setInterval } = require('timers');
const fetch = global.fetch || require('node-fetch');

const SIEM_ENDPOINT = process.env.SIEM_ENDPOINT || null;
const SIEM_API_KEY = process.env.SIEM_API_KEY || null;
const BATCH_SIZE = parseInt(process.env.SIEM_BATCH_SIZE, 10) || 10;
const FLUSH_MS = parseInt(process.env.SIEM_FLUSH_MS, 10) || 5000;
const RETRY_BASE_MS = parseInt(process.env.SIEM_RETRY_BASE_MS, 10) || 100;
const RETRY_MAX_MS = parseInt(process.env.SIEM_RETRY_MAX_MS, 10) || 60 * 1000;
const RETRY_MAX_ATTEMPTS = parseInt(process.env.SIEM_RETRY_MAX_ATTEMPTS, 10) || 5;

let queue = [];
let flushing = false;
let _totalSendAttempts = 0;

function enqueue(event) {
  try {
    if (!event || typeof event !== 'object') return;
    queue.push(event);
    if (queue.length >= BATCH_SIZE) flush().catch(() => {});
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
  const payload = queue.splice(0, BATCH_SIZE);

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
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, attempt));
      try {
        setTimeout(() => {
          sendBatch(batch, attempt + 1).catch(() => {});
        }, delay);
      } catch (s) {
        // ignore scheduling failure
      }
    } else {
      // Retries exhausted: re-enqueue to head with trim
      try {
        queue = batch.concat(queue).slice(0, 1000);
      } catch {}
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
    getBatchSize: () => BATCH_SIZE,
    resetQueue: () => { queue = []; flushing = false; },
    getTotalSendAttempts: () => _totalSendAttempts,
  },
};
