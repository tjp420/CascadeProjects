'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createStripeEventStore } = require('../stripe-event-store.cjs');

describe('stripe-event-store (factory pattern)', () => {
  let tempStorePath;
  let store;

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-event-store-'));
    tempStorePath = path.join(tempDir, 'stripe-events.json');
    store = createStripeEventStore({ storePath: tempStorePath });
  });

  afterEach(() => {
    const dir = path.dirname(tempStorePath);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exports expected functions', () => {
    assert.strictEqual(typeof store.recordProcessedEvent, 'function');
    assert.strictEqual(typeof store.clearCache, 'function');
    assert.strictEqual(typeof store.getProcessedCount, 'function');
  });

  it('exposes storePath and maxEvents', () => {
    assert.strictEqual(store.storePath, tempStorePath);
    assert.strictEqual(store.maxEvents, 10000);
  });

  it('returns true for first-seen event', async () => {
    const result = await store.recordProcessedEvent('evt_test_001');
    assert.strictEqual(result, true, 'first event should return true');
  });

  it('returns false for duplicate event', async () => {
    await store.recordProcessedEvent('evt_test_002');
    const result = await store.recordProcessedEvent('evt_test_002');
    assert.strictEqual(result, false, 'duplicate event should return false');
  });

  it('persists events across cache clears', async () => {
    await store.recordProcessedEvent('evt_test_003');
    store.clearCache();
    const result = await store.recordProcessedEvent('evt_test_003');
    assert.strictEqual(result, false, 'event should still be duplicate after cache clear');
  });

  it('persists events to disk file', async () => {
    await store.recordProcessedEvent('evt_test_004');
    await store.recordProcessedEvent('evt_test_005');

    assert.ok(fs.existsSync(tempStorePath), 'store file should exist on disk');
    const raw = JSON.parse(fs.readFileSync(tempStorePath, 'utf8'));
    assert.ok(Array.isArray(raw.eventIds), 'store should have eventIds array');
    assert.ok(raw.eventIds.includes('evt_test_004'), 'should contain evt_test_004');
    assert.ok(raw.eventIds.includes('evt_test_005'), 'should contain evt_test_005');
    assert.strictEqual(raw.count, 2, 'count should be 2');
  });

  it('returns false for empty or invalid event ID', async () => {
    assert.strictEqual(await store.recordProcessedEvent(''), false);
    assert.strictEqual(await store.recordProcessedEvent(null), false);
    assert.strictEqual(await store.recordProcessedEvent(undefined), false);
    assert.strictEqual(await store.recordProcessedEvent(123), false);
  });

  it('handles multiple unique events correctly', async () => {
    const results = await Promise.all([
      store.recordProcessedEvent('evt_a'),
      store.recordProcessedEvent('evt_b'),
      store.recordProcessedEvent('evt_c')
    ]);

    for (const r of results) {
      assert.strictEqual(r, true, 'each unique event should return true');
    }

    const count = await store.getProcessedCount();
    assert.strictEqual(count, 3, 'should have 3 processed events');
  });

  it('creates store directory if it does not exist', async () => {
    const dir = path.dirname(tempStorePath);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.ok(!fs.existsSync(dir), 'dir should not exist');

    const result = await store.recordProcessedEvent('evt_test_006');
    assert.strictEqual(result, true, 'should process event successfully');
    assert.ok(fs.existsSync(tempStorePath), 'store file should be created');
  });

  it('isolates state between factory instances', async () => {
    const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-event-store-2-'));
    const storePath2 = path.join(tempDir2, 'stripe-events.json');
    const store2 = createStripeEventStore({ storePath: storePath2 });

    try {
      await store.recordProcessedEvent('evt_isolated_001');
      const result = await store2.recordProcessedEvent('evt_isolated_001');
      assert.strictEqual(result, true, 'second instance should not see first instance events');

      const count1 = await store.getProcessedCount();
      const count2 = await store2.getProcessedCount();
      assert.strictEqual(count1, 1, 'store1 should have 1 event');
      assert.strictEqual(count2, 1, 'store2 should have 1 event');
    } finally {
      fs.rmSync(tempDir2, { recursive: true, force: true });
    }
  });

  it('default singleton export is backwards-compatible', () => {
    const singleton = require('../stripe-event-store.cjs');
    assert.strictEqual(typeof singleton.recordProcessedEvent, 'function');
    assert.strictEqual(typeof singleton.clearCache, 'function');
    assert.strictEqual(typeof singleton.getProcessedCount, 'function');
    assert.strictEqual(typeof singleton.createStripeEventStore, 'function');
  });
});
