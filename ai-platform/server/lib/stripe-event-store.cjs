/**
 * Stripe processed-event store — file-based idempotency guard.
 *
 * Tracks Stripe event IDs that have been processed to prevent double-processing
 * on Stripe webhook retries. Follows the same file-store pattern as
 * simplebeacon-subscription-store.cjs (in-memory cache + atomic file writes).
 *
 * @module stripe-event-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const PROJECT_ROOT = path.join(__dirname, '..');
const STORE_PATH = process.env.STRIPE_EVENT_STORE
  || path.join(PROJECT_ROOT, '.simplebeacon', 'stripe-events.json');

/** In-memory set of processed event IDs. */
let _processedEvents = null;
/** True when the cache needs to be reloaded from disk. */
let _cacheDirty = true;
/** Prevent concurrent writes. */
let _writeInProgress = false;
/** Queue of pending write promises. */
const _writeQueue = [];

/** Max events to retain in the store (FIFO eviction). */
const MAX_EVENTS = 10000;

/** Mutex lock for recordProcessedEvent — prevents race conditions on concurrent calls. */
let _recordLock = Promise.resolve();

/**
 * Queue a function behind the record lock so only one recordProcessedEvent
 * call executes its critical section at a time.
 * @param {Function} fn - Async function to execute under lock.
 * @returns {Promise<any>}
 */
function withLock(fn) {
  const next = _recordLock.then(fn, fn);
  _recordLock = next.then(() => undefined, () => undefined);
  return next;
}

/**
 * Load processed events from disk into memory.
 * @returns {Promise<Set<string>>}
 */
async function loadProcessedEvents() {
  if (!_cacheDirty && _processedEvents) {
    return _processedEvents;
  }
  try {
    const raw = await fs.promises.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed.eventIds) ? parsed.eventIds : [];
    _processedEvents = new Set(ids);
    _cacheDirty = false;
    return _processedEvents;
  } catch {
    _processedEvents = new Set();
    _cacheDirty = false;
    return _processedEvents;
  }
}

/**
 * Atomically write the event store to disk.
 * Uses tmp-file + rename to prevent partial writes.
 * @param {Set<string>} events
 * @returns {Promise<void>}
 */
async function writeProcessedEvents(events) {
  if (_writeInProgress) {
    return new Promise((resolve, reject) => {
      _writeQueue.push({ events, resolve, reject });
    });
  }
  _writeInProgress = true;

  const drainQueue = () => {
    if (_writeQueue.length === 0) {
      _writeInProgress = false;
      return;
    }
    const { events: nextEvents, resolve, reject } = _writeQueue.shift();
    doWrite(nextEvents).then(resolve).catch(reject).finally(drainQueue);
  };

  async function doWrite(events) {
    const dir = path.dirname(STORE_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    const ids = Array.from(events).slice(-MAX_EVENTS);
    const payload = JSON.stringify({
      eventIds: ids,
      updatedAt: new Date().toISOString(),
      count: ids.length
    }, null, 2);
    const tmpPath = STORE_PATH + '.tmp';
    await fs.promises.writeFile(tmpPath, payload + '\n', 'utf8');
    await fs.promises.rename(tmpPath, STORE_PATH);
  }

  try {
    await doWrite(events);
  } finally {
    _writeInProgress = false;
    drainQueue();
  }
}

/**
 * Check if an event ID has been processed, and mark it as processed if not.
 * This is the atomic idempotency guard — it returns true only for the first
 * call with a given event ID, and false for all subsequent calls.
 *
 * @param {string} eventId - Stripe event ID (e.g., evt_123abc)
 * @returns {Promise<boolean>} - true if first seen (process it), false if duplicate (skip it)
 */
async function recordProcessedEvent(eventId) {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }

  return withLock(async () => {
    const events = await loadProcessedEvents();

    if (events.has(eventId)) {
      logger.info('[StripeEventStore] Duplicate event detected, skipping:', eventId);
      return false;
    }

    events.add(eventId);
    await writeProcessedEvents(events);
    return true;
  });
}

/**
 * Clear the in-memory cache. Useful for tests.
 * @returns {void}
 */
function clearCache() {
  _processedEvents = null;
  _cacheDirty = true;
}

/**
 * Get the current count of processed events.
 * @returns {Promise<number>}
 */
async function getProcessedCount() {
  const events = await loadProcessedEvents();
  return events.size;
}

module.exports = {
  recordProcessedEvent,
  clearCache,
  getProcessedCount,
  STORE_PATH,
  MAX_EVENTS
};
