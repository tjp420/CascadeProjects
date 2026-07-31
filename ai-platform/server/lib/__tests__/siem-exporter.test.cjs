'use strict';

const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');

const SIEM_PATH = path.resolve(process.cwd(), 'server', 'lib', 'siem-exporter.cjs');

function withEnv(env) {
  const orig = {};
  for (const k of Object.keys(env)) {
    orig[k] = process.env[k];
    process.env[k] = env[k];
  }
  return () => {
    for (const k of Object.keys(env)) {
      if (orig[k] === undefined) delete process.env[k]; else process.env[k] = orig[k];
    }
  };
}

function reloadSiem() {
  // Clean up previous module instance (clear interval timer)
  const cached = require.cache[SIEM_PATH];
  if (cached && cached.exports && typeof cached.exports.close === 'function') {
    cached.exports.close();
  }
  // Use Jest's module reset if available (Jest's module cache doesn't
  // always respect delete require.cache). Fall back to delete for node:test.
  if (typeof jest !== 'undefined' && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[SIEM_PATH];
  }
  return require(SIEM_PATH);
}

describe('siem-exporter (unit)', () => {
  it('flushes a full batch and posts mapped payload', async () => {
    const restore = withEnv({ SIEM_BATCH_SIZE: '3', SIEM_ENDPOINT: 'https://siem.test/ingest', SIEM_API_KEY: 'testkey' });
    try {
      const calls = [];
      global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200 };
      };

      const se = reloadSiem();

      se.enqueue({ foo: 1 });
      se.enqueue({ foo: 2 });
      se.enqueue({ foo: 3 });

      // Force a flush rather than waiting on interval
      await se.flush();

      assert.equal(calls.length, 1, 'Expected exactly one outbound fetch call');
      const call = calls[0];
      assert.equal(call.url, 'https://siem.test/ingest');
      assert.ok(call.opts.headers['Content-Type'], 'application/json');
      assert.equal(call.opts.headers.Authorization, 'Bearer testkey');
      const body = JSON.parse(call.opts.body);
      assert.equal(body.source, 'ai-platform');
      assert.equal(Array.isArray(body.events), true);
      assert.equal(body.events.length, 3);
      // queue drained
      assert.equal(se._debug.getQueue().length, 0);
    } finally {
      delete global.fetch;
      restore();
    }
  });

  it('re-enqueues on network failure and bounds queue to 1000', async () => {
    const restore = withEnv({ SIEM_BATCH_SIZE: '10', SIEM_ENDPOINT: 'https://siem.test/ingest', SIEM_RETRY_BASE_MS: '1', SIEM_RETRY_MAX_ATTEMPTS: '3' });
    try {
      // fetch always throws to simulate outage
      global.fetch = async () => { throw new Error('network down'); };

      const se = reloadSiem();
      se._debug.resetQueue();

      // Verify BATCH_SIZE was correctly loaded from env
      assert.equal(se._debug.getBatchSize(), 10, 'BATCH_SIZE should be 10');

      // populate queue beyond 1000 to exercise the trim behavior
      const preQ = se._debug.getQueue();
      for (let i = 0; i < 1205; i++) preQ.push({ i });
      // ensure initial state
      assert.ok(preQ.length >= 1205, 'precondition: queue seeded');

      // call flush which will attempt to send then on failure re-enqueue and trim
      await se.flush();

      // Wait for retries to exhaust and queue to be trimmed.
      // flush() is fire-and-forget (doesn't await sendBatch), so we poll
      // until the queue is trimmed or timeout.
      const timeoutAt = Date.now() + 3000;
      while (Date.now() < timeoutAt) {
        const q = se._debug.getQueue();
        if (q.length <= 1000) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
      }

      const postQ = se._debug.getQueue();
      // queue should be trimmed to at most 1000 after retries exhausted
      assert.ok(postQ.length <= 1000, `queue trimmed to <=1000, actual=${postQ.length}`);
      // confirm that at least one send attempt occurred
      assert.ok(se._debug.getTotalSendAttempts() >= 1, `expected send attempts >= 1, actual=${se._debug.getTotalSendAttempts()}`);
      // metrics should reflect observed retries and possible drops
      const metrics = se._debug.getMetrics();
      assert.ok(typeof metrics.siem_delivery_retries_total === 'number', 'metrics.retries_total present');
      assert.ok(metrics.siem_delivery_retries_total >= 1, `expected retries >= 1, actual=${metrics.siem_delivery_retries_total}`);
      assert.ok(typeof metrics.siem_delivery_dropped_total === 'number', 'metrics.dropped_total present');
    } finally {
      delete global.fetch;
      restore();
    }
  });

  it('enqueue is no-op for invalid events and does not throw', async () => {
    const restore = withEnv({ SIEM_BATCH_SIZE: '2', SIEM_ENDPOINT: '' });
    try {
      // ensure a harmless fetch impl exists so module doesn't require node-fetch
      global.fetch = async () => ({ ok: true, status: 200 });
      const se = reloadSiem();
      // invalid inputs
      se.enqueue(null);
      se.enqueue('string');
      se.enqueue({ ok: true });
      // flush should not throw even if endpoint is empty
      await se.flush();
      assert.ok(Array.isArray(se._debug.getQueue()));
    } finally {
      delete global.fetch;
      restore();
    }
  });
});
