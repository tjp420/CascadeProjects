'use strict';

// Simple SIEM exporter: batches events and ships them to an HTTPS endpoint.
// Non-blocking and fail-silent to avoid impacting request paths.

const { setInterval } = require('timers');
const fetch = global.fetch || require('node-fetch');

const SIEM_ENDPOINT = process.env.SIEM_ENDPOINT || null;
const SIEM_API_KEY = process.env.SIEM_API_KEY || null;
const BATCH_SIZE = parseInt(process.env.SIEM_BATCH_SIZE, 10) || 10;
const FLUSH_MS = parseInt(process.env.SIEM_FLUSH_MS, 10) || 5000;

let queue = [];
let flushing = false;

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
  try {
    await fetch(SIEM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SIEM_API_KEY ? { Authorization: `Bearer ${SIEM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ events: payload, source: 'ai-platform' }),
      timeout: 5000,
    });
  } catch (e) {
    // On failure, re-enqueue to try later, but avoid infinite growth
    try { queue = payload.concat(queue).slice(0, 1000); } catch {}
  } finally {
    flushing = false;
  }
}

// Periodic flush
const _timer = setInterval(() => {
  try { flush().catch(() => {}); } catch {}
}, FLUSH_MS);
if (_timer.unref) _timer.unref();

module.exports = {
  enqueue,
  flush,
  _debug: {
    getQueue: () => queue,
    isFlushing: () => flushing,
  },
};
