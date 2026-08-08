'use strict';

/**
 * Webhook Event Log — stores recent Stripe webhook events with rich metadata
 * for dashboard visualization. Keeps the last 500 events in a file-based store.
 *
 * This is separate from the idempotency event store (stripe-event-store.cjs)
 * which only stores event IDs. This module stores full event metadata for
 * dashboard display and monitoring.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const PROJECT_ROOT = path.join(__dirname, '..');
const LOG_PATH = process.env.WEBHOOK_EVENT_LOG
  || path.join(PROJECT_ROOT, '.simplebeacon', 'webhook-event-log.json');
const MAX_EVENTS = 500;

let _cache = null;
let _cacheDirty = true;
let _writeInProgress = false;
const _writeQueue = [];

function loadLog() {
  if (!_cacheDirty && _cache) return _cache;
  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    _cache = Array.isArray(parsed.events) ? parsed.events : [];
    _cacheDirty = false;
    return _cache;
  } catch {
    _cache = [];
    _cacheDirty = false;
    return _cache;
  }
}

function persistLog(events) {
  if (_writeInProgress) {
    return new Promise((resolve, reject) => { _writeQueue.push({ events, resolve, reject }); });
  }
  _writeInProgress = true;

  async function doWrite(evts) {
    const dir = path.dirname(LOG_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    const payload = JSON.stringify({ events: evts, updatedAt: new Date().toISOString(), count: evts.length }, null, 2);
    const tmpPath = LOG_PATH + '.tmp';
    await fs.promises.writeFile(tmpPath, payload + '\n', 'utf8');
    try {
      await fs.promises.rename(tmpPath, LOG_PATH);
    } catch {
      fs.writeFileSync(LOG_PATH, payload + '\n', 'utf8');
      try { await fs.promises.unlink(tmpPath).catch(() => {}); } catch {}
    }
  }

  return (async () => {
    try {
      await doWrite(events);
    } finally {
      _writeInProgress = false;
      if (_writeQueue.length > 0) {
        const { events: next, resolve, reject } = _writeQueue.shift();
        persistLog(next).then(resolve).catch(reject);
      }
    }
  })();
}

/**
 * Record a webhook event in the log.
 * @param {Object} entry - Event metadata
 * @param {string} entry.eventId - Stripe event ID
 * @param {string} entry.eventType - Stripe event type (e.g. invoice.payment_failed)
 * @param {string} [entry.customerEmail] - Customer email (if available)
 * @param {string} entry.status - Processing status (processed, ignored, duplicate, error)
 * @param {string} [entry.tier] - Subscription tier (if known)
 * @param {string} [entry.amount] - Formatted amount (if applicable)
 * @param {string} [entry.reason] - Failure/dispute reason (if applicable)
 * @param {string} [entry.detail] - Additional detail string
 * @returns {Promise<void>}
 */
async function logWebhookEvent(entry) {
  if (!entry || !entry.eventId) return;
  const events = loadLog();
  const record = {
    eventId: entry.eventId,
    eventType: entry.eventType || 'unknown',
    customerEmail: entry.customerEmail || null,
    status: entry.status || 'processed',
    tier: entry.tier || null,
    amount: entry.amount || null,
    reason: entry.reason || null,
    detail: entry.detail || null,
    timestamp: new Date().toISOString()
  };
  events.unshift(record);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  _cacheDirty = true;
  try {
    await persistLog(events);
    _cacheDirty = false;
  } catch (err) {
    logger.error('[WebhookEventLog] Failed to persist:', err.message);
  }
}

/**
 * Get recent webhook events, optionally filtered.
 * @param {Object} [opts] - Filter options
 * @param {string} [opts.eventType] - Filter by event type
 * @param {string} [opts.status] - Filter by status
 * @param {number} [opts.limit] - Max events to return (default 50)
 * @returns {Array} Array of event records
 */
function getRecentEvents(opts = {}) {
  const events = loadLog();
  let filtered = events;
  if (opts.eventType) {
    filtered = filtered.filter(e => e.eventType === opts.eventType);
  }
  if (opts.status) {
    filtered = filtered.filter(e => e.status === opts.status);
  }
  const limit = opts.limit || 50;
  return filtered.slice(0, limit);
}

/**
 * Get summary statistics of recent webhook events.
 * @returns {Object} Stats object with counts by type, status, etc.
 */
function getStats() {
  const events = loadLog();
  const byType = {};
  const byStatus = {};
  let last24h = 0;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    if (new Date(e.timestamp).getTime() > cutoff) last24h++;
  }

  return {
    total: events.length,
    last24h,
    byType,
    byStatus,
    oldestEvent: events.length > 0 ? events[events.length - 1].timestamp : null,
    newestEvent: events.length > 0 ? events[0].timestamp : null
  };
}

function clearCache() {
  _cache = null;
  _cacheDirty = true;
}

module.exports = {
  logWebhookEvent,
  getRecentEvents,
  getStats,
  clearCache,
  LOG_PATH,
  MAX_EVENTS
};
