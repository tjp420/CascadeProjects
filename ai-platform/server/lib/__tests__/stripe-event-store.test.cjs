'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Require the module once — we'll use setStorePath + clearCache to reset state
// between tests instead of delete require.cache (which is unreliable under Jest).
const mod = require('../stripe-event-store.cjs');

describe('stripe-event-store', () => {
  let tempStorePath;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-event-store-'));
    tempStorePath = path.join(tempDir, 'stripe-events.json');
    mod.setStorePath(tempStorePath);
    mod.clearCache();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exports expected functions', () => {
    assert.strictEqual(typeof mod.recordProcessedEvent, 'function');
    assert.strictEqual(typeof mod.clearCache, 'function');
    assert.strictEqual(typeof mod.getProcessedCount, 'function');
  });

  it('returns true for first-seen event', async () => {
    const result = await mod.recordProcessedEvent('evt_test_001');
    assert.strictEqual(result, true, 'first event should return true');
  });

  it('returns false for duplicate event', async () => {
    await mod.recordProcessedEvent('evt_test_002');
    const result = await mod.recordProcessedEvent('evt_test_002');
    assert.strictEqual(result, false, 'duplicate event should return false');
  });

  it('persists events across cache clears', async () => {
    await mod.recordProcessedEvent('evt_test_003');
    mod.clearCache();
    const result = await mod.recordProcessedEvent('evt_test_003');
    assert.strictEqual(result, false, 'event should still be duplicate after cache clear');
  });

  it('persists events to disk file', async () => {
    await mod.recordProcessedEvent('evt_test_004');
    await mod.recordProcessedEvent('evt_test_005');
    assert.ok(fs.existsSync(tempStorePath), 'store file should exist on disk');
    const raw = JSON.parse(fs.readFileSync(tempStorePath, 'utf8'));
    assert.ok(Array.isArray(raw.eventIds), 'store should have eventIds array');
    assert.ok(raw.eventIds.includes('evt_test_004'), 'should contain evt_test_004');
    assert.ok(raw.eventIds.includes('evt_test_005'), 'should contain evt_test_005');
    assert.strictEqual(raw.count, 2, 'count should be 2');
  });

  it('returns false for empty or invalid event ID', async () => {
    assert.strictEqual(await mod.recordProcessedEvent(''), false);
    assert.strictEqual(await mod.recordProcessedEvent(null), false);
    assert.strictEqual(await mod.recordProcessedEvent(undefined), false);
    assert.strictEqual(await mod.recordProcessedEvent(123), false);
  });

  it('handles multiple unique events correctly', async () => {
    const results = await Promise.all([
      mod.recordProcessedEvent('evt_a'),
      mod.recordProcessedEvent('evt_b'),
      mod.recordProcessedEvent('evt_c')
    ]);

    // All should be first-seen (true)
    for (const r of results) {
      assert.strictEqual(r, true, 'each unique event should return true');
    }

    const count = await mod.getProcessedCount();
    assert.strictEqual(count, 3, 'should have 3 processed events');
  });

  it('creates store directory if it does not exist', async () => {
    // Remove the temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });
    assert.ok(!fs.existsSync(tempDir), 'dir should not exist');

    const result = await mod.recordProcessedEvent('evt_test_006');
    assert.strictEqual(result, true, 'should process event successfully');
    assert.ok(fs.existsSync(tempStorePath), 'store file should be created');
  });
});
