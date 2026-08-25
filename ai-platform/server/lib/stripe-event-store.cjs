/**
 * Stripe processed-event store — file-based idempotency guard.
 *
 * Factory-based implementation to allow isolated instances for tests while
 * retaining a default singleton for runtime compatibility.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

function createEventStore(options = {}) {
  const projectRoot = path.join(__dirname, '..');
  const STORE = options.storePath || process.env.STRIPE_EVENT_STORE || path.join(projectRoot, '.simplebeacon', 'stripe-events.json');
  const MAX = options.maxEvents || 10000;

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
    if (!_cacheDirty && _processedEvents) return _processedEvents;
    try {
      const raw = await fs.promises.readFile(STORE, 'utf8');
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
      return new Promise((resolve, reject) => { _writeQueue.push({ events, resolve, reject }); });
    }
    _writeInProgress = true;

    const drainQueue = () => {
      if (_writeQueue.length === 0) { _writeInProgress = false; return; }
      const { events: nextEvents, resolve, reject } = _writeQueue.shift();
      doWrite(nextEvents).then(resolve).catch(reject).finally(drainQueue);
    };

    async function doWrite(events) {
      const dir = path.dirname(STORE);
      await fs.promises.mkdir(dir, { recursive: true });
      const ids = Array.from(events).slice(-MAX);
      const payload = JSON.stringify({ eventIds: ids, updatedAt: new Date().toISOString(), count: ids.length }, null, 2);
      const tmpPath = STORE + '.tmp';
      await fs.promises.writeFile(tmpPath, payload + '\n', 'utf8');
      // Try to flush before rename
      try {
        const fd = fs.openSync(tmpPath, 'r');
        try { fs.fsyncSync(fd); } catch (_) {}
        fs.closeSync(fd);
      } catch (_) {}
      try {
        await fs.promises.rename(tmpPath, STORE);
      } catch (err) {
        console.error('stripe-event-store.cjs error:', err);
        // On failure (Windows EPERM etc.) fall back to sync write
          fs.writeFileSync(STORE, payload + '\n', 'utf8');
        try { await fs.promises.unlink(tmpPath).catch(() => {}); } catch (_) {}
      }
    }

    try {
      await doWrite(events);
    } finally {
      _writeInProgress = false;
      drainQueue();
    }
  }

  async function recordProcessedEvent(eventId) {
    if (!eventId || typeof eventId !== 'string') return false;
    return withLock(async () => {
      const events = await loadProcessedEvents();
      if (events.has(eventId)) { logger.info('[StripeEventStore] Duplicate event detected, skipping:', eventId); return false; }
      events.add(eventId);
      await writeProcessedEvents(events);
      return true;
    });
  }

  function clearCache() { _processedEvents = null; _cacheDirty = true; }

  async function getProcessedCount() { const events = await loadProcessedEvents(); return events.size; }

  return {
    recordProcessedEvent,
    clearCache,
    getProcessedCount,
    STORE_PATH: STORE,
    MAX_EVENTS: MAX
  };
}

// default singleton for runtime compatibility
const defaultStore = createEventStore();
module.exports = defaultStore;
module.exports.createEventStore = createEventStore;
