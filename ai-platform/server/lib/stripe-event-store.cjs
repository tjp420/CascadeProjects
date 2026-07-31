/**
 * Stripe processed-event store — file-based idempotency guard.
 *
 * Tracks Stripe event IDs that have been processed to prevent double-processing
 * on Stripe webhook retries. Uses a Factory Pattern so each instance has
 * isolated in-memory state, preventing cross-test contamination.
 *
 * The default export is a singleton created by the factory for backwards
 * compatibility with existing server bootstrap and route handlers.
 *
 * @module stripe-event-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_STORE_PATH = process.env.STRIPE_EVENT_STORE
  || path.join(PROJECT_ROOT, '.simplebeacon', 'stripe-events.json');

const MAX_EVENTS = 10000;

/**
 * Factory: create an isolated Stripe event store instance.
 *
 * Each instance maintains its own in-memory cache, write queue, and mutex
 * lock, preventing state leakage between tests or concurrent consumers.
 *
 * @param {object} [options]
 * @param {string} [options.storePath] - Path to the JSON store file.
 * @param {number} [options.maxEvents] - Max events to retain (FIFO eviction).
 * @returns {object} Isolated store instance.
 */
function createStripeEventStore(options = {}) {
  const storePath = options.storePath || DEFAULT_STORE_PATH;
  const maxEvents = options.maxEvents || MAX_EVENTS;

  let _processedEvents = null;
  let _cacheDirty = true;
  let _writeInProgress = false;
  const _writeQueue = [];
  let _recordLock = Promise.resolve();

  function withLock(fn) {
    const next = _recordLock.then(fn, fn);
    _recordLock = next.then(() => undefined, () => undefined);
    return next;
  }

  async function loadProcessedEvents() {
    if (!_cacheDirty && _processedEvents) {
      return _processedEvents;
    }
    try {
      const raw = await fs.promises.readFile(storePath, 'utf8');
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
      const dir = path.dirname(storePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const ids = Array.from(events).slice(-maxEvents);
      const payload = JSON.stringify({
        eventIds: ids,
        updatedAt: new Date().toISOString(),
        count: ids.length
      }, null, 2);
      const tmpPath = storePath + '.tmp';
      await fs.promises.writeFile(tmpPath, payload + '\n', 'utf8');
      await fs.promises.rename(tmpPath, storePath);
    }

    try {
      await doWrite(events);
    } finally {
      _writeInProgress = false;
      drainQueue();
    }
  }

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

  function clearCache() {
    _processedEvents = null;
    _cacheDirty = true;
  }

  async function getProcessedCount() {
    const events = await loadProcessedEvents();
    return events.size;
  }

  return {
    recordProcessedEvent,
    clearCache,
    getProcessedCount,
    storePath,
    maxEvents,
  };
}

// ── Default singleton (backwards-compatible with existing consumers) ─────────

const defaultStore = createStripeEventStore();

module.exports = {
  createStripeEventStore,
  recordProcessedEvent: defaultStore.recordProcessedEvent,
  clearCache: defaultStore.clearCache,
  getProcessedCount: defaultStore.getProcessedCount,
  STORE_PATH: DEFAULT_STORE_PATH,
  MAX_EVENTS,
};
