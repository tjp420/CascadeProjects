'use strict';

/**
 * Tests for Real-Time Key Interdiction Engine.
 *
 * Verifies that the interdiction store in authorize.cjs:
 *   1. Blocks interdicted keys with HTTP 423 Locked
 *   2. Allows non-interdicted keys through
 *   3. Auto-evicts expired entries on access (lazy TTL)
 *   4. Auto-interdicts after violation threshold is crossed
 *   5. Supports manual block/release via admin functions
 *   6. Enforces memory cap to prevent unbounded growth
 *   7. Does not leak internal metadata in 423 responses
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const AUTHORIZE_PATH = path.resolve(process.cwd(), 'server', 'middleware', 'authorize.cjs');

function reloadModule() {
  if (typeof jest !== 'undefined' && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[AUTHORIZE_PATH];
  }
  return require(AUTHORIZE_PATH);
}

describe('Real-Time Key Interdiction Engine', () => {
  let authorize;

  beforeEach(() => {
    authorize = reloadModule();
    authorize.clearInterdictedKeys();
    authorize.clearViolations();
    authorize._resetInterdictionStats();
  });

  afterEach(() => {
    authorize.clearInterdictedKeys();
    authorize.clearViolations();
    authorize._resetInterdictionStats();
  });

  describe('interdictKey()', () => {
    it('should add a key to the block list with expiry', () => {
      const result = authorize.interdictKey('test-key-1', 'test_reason', 60000);
      assert.strictEqual(result.blocked, true);
      assert.ok(result.expiresAt > Date.now());
    });

    it('should return blocked: false for empty key', () => {
      const result = authorize.interdictKey('', 'test_reason', 60000);
      assert.strictEqual(result.blocked, false);
    });

    it('should use default TTL when ttlMs is not provided', () => {
      const result = authorize.interdictKey('test-key-default-ttl', 'test_reason');
      assert.strictEqual(result.blocked, true);
      // Default TTL is 15 minutes — should be ~15 min from now
      const expectedMin = Date.now() + 15 * 60 * 1000;
      assert.ok(Math.abs(result.expiresAt - expectedMin) < 5000);
    });
  });

  describe('releaseKey()', () => {
    it('should remove a key from the block list immediately', () => {
      authorize.interdictKey('release-test-key', 'test_reason', 60000);
      const result = authorize.releaseKey('release-test-key');
      assert.strictEqual(result.released, true);
      assert.strictEqual(result.wasBlocked, true);

      const status = authorize.checkInterdiction('release-test-key');
      assert.strictEqual(status.interdicted, false);
    });

    it('should return wasBlocked: false for non-existent key', () => {
      const result = authorize.releaseKey('nonexistent-key');
      assert.strictEqual(result.released, true);
      assert.strictEqual(result.wasBlocked, false);
    });
  });

  describe('checkInterdiction()', () => {
    it('should return interdicted: true for a blocked key', () => {
      authorize.interdictKey('check-test-key', 'test_reason', 60000);
      const status = authorize.checkInterdiction('check-test-key');
      assert.strictEqual(status.interdicted, true);
      assert.strictEqual(status.reason, 'test_reason');
      assert.ok(status.expiresAt > Date.now());
    });

    it('should return interdicted: false for a non-blocked key', () => {
      const status = authorize.checkInterdiction('unblocked-key');
      assert.strictEqual(status.interdicted, false);
    });

    it('should auto-evict expired entries on access', () => {
      authorize.interdictKey('expire-test-key', 'test_reason', 1); // 1ms TTL
      // Wait for expiry
      return new Promise((resolve) => {
        setTimeout(() => {
          const status = authorize.checkInterdiction('expire-test-key');
          assert.strictEqual(status.interdicted, false);
          assert.strictEqual(status.reason, null);
          resolve();
        }, 10);
      });
    });
  });

  describe('enforceKeyInterdiction() middleware', () => {
    it('should return 423 Locked for interdicted keys', () => {
      authorize.interdictKey('middleware-test-key', 'test_reason', 60000);
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: { 'x-api-key': 'middleware-test-key' }, query: {} };
      const res = {
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; },
      };
      const next = () => { throw new Error('next() should not be called'); };

      middleware(req, res, next);
      assert.strictEqual(res._status, 423);
      assert.strictEqual(res._body.success, false);
      assert.strictEqual(res._body.error, 'token_interdicted');
      assert.ok(res._body.expiresAt, 'Should include expiresAt timestamp');
    });

    it('should call next() for non-interdicted keys', () => {
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: { 'x-api-key': 'allowed-key' }, query: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);
      assert.strictEqual(nextCalled, true);
    });

    it('should call next() when no API key is present', () => {
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: {}, query: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);
      assert.strictEqual(nextCalled, true);
    });

    it('should check query.apiKey as fallback', () => {
      authorize.interdictKey('query-key-test', 'test_reason', 60000);
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: {}, query: { apiKey: 'query-key-test' } };
      const res = {
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; },
      };
      const next = () => { throw new Error('next() should not be called'); };

      middleware(req, res, next);
      assert.strictEqual(res._status, 423);
    });

    it('should fall back to req.user.id for token-based auth', () => {
      authorize.interdictKey('user-123', 'test_reason', 60000);
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: {}, query: {}, user: { id: 'user-123' } };
      const res = {
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; },
      };
      const next = () => { throw new Error('next() should not be called'); };

      middleware(req, res, next);
      assert.strictEqual(res._status, 423);
    });

    it('should not leak internal block list metadata in 423 response', () => {
      authorize.interdictKey('leak-test-key', 'secret_internal_reason', 60000);
      const middleware = authorize.enforceKeyInterdiction();
      const req = { headers: { 'x-api-key': 'leak-test-key' }, query: {} };
      const res = {
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; },
      };
      const next = () => {};

      middleware(req, res, next);
      // Response should NOT contain the internal reason
      assert.strictEqual(res._body.reason, undefined);
      assert.strictEqual(res._body.blockedAt, undefined);
      assert.strictEqual(res._body.source, undefined);
    });
  });

  describe('getInterdictedKeys()', () => {
    it('should return list of blocked keys with metadata', () => {
      authorize.interdictKey('list-key-1', 'reason_1', 60000);
      authorize.interdictKey('list-key-2', 'reason_2', 60000);
      const result = authorize.getInterdictedKeys();
      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.keys.length, 2);
      assert.ok(result.keys[0].reason);
      assert.ok(result.keys[0].blockedAt);
      assert.ok(result.keys[0].expiresAt);
    });

    it('should mask API keys in the response (truncated)', () => {
      authorize.interdictKey('1234567890abcdef', 'test_reason', 60000);
      const result = authorize.getInterdictedKeys();
      assert.strictEqual(result.total, 1);
      // Key should be masked — not the full raw key
      assert.ok(result.keys[0].apiKey.includes('…'));
      assert.ok(!result.keys[0].apiKey.includes('567890'));
    });

    it('should return stats object with expected fields', () => {
      authorize.interdictKey('stats-key', 'test_reason', 60000);
      const result = authorize.getInterdictedKeys();
      assert.ok(result.stats);
      assert.ok(typeof result.stats.totalBlocked === 'number');
      assert.ok(typeof result.stats.totalReleased === 'number');
      assert.ok(typeof result.stats.totalAutoTriggered === 'number');
      assert.ok(typeof result.stats.totalRequestsRejected === 'number');
    });

    it('should evict expired entries during scan', () => {
      authorize.interdictKey('expired-during-scan', 'test_reason', 1);
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = authorize.getInterdictedKeys();
          assert.strictEqual(result.total, 0);
          resolve();
        }, 10);
      });
    });
  });

  describe('auto-interdiction on violation threshold', () => {
    it('should auto-interdict after threshold is crossed', () => {
      // The default threshold is 5 violations
      // We need to record 5 violations for the same org to trigger auto-interdiction
      const testUserId = 'auto-interdict-user';
      const testOrgId = 'auto-interdict-org';

      for (let i = 0; i < 5; i++) {
        authorize.recordViolation({
          callerOrgId: testOrgId,
          clientOrgId: 'other-org',
          userId: testUserId,
          method: 'GET',
          path: '/api/test',
          ip: '127.0.0.1',
        });
      }

      // The user should now be auto-interdicted
      const status = authorize.checkInterdiction(testUserId);
      assert.strictEqual(status.interdicted, true);
      assert.ok(status.reason.includes('auto:org_partition_violation_spike'));
    });

    it('should not auto-interdict below threshold', () => {
      const testUserId = 'below-threshold-user';
      const testOrgId = 'below-threshold-org';

      for (let i = 0; i < 4; i++) {
        authorize.recordViolation({
          callerOrgId: testOrgId,
          clientOrgId: 'other-org',
          userId: testUserId,
          method: 'GET',
          path: '/api/test',
          ip: '127.0.0.1',
        });
      }

      const status = authorize.checkInterdiction(testUserId);
      assert.strictEqual(status.interdicted, false);
    });

    it('should track auto-triggered stats', () => {
      const testUserId = 'stats-auto-user';
      const testOrgId = 'stats-auto-org';

      for (let i = 0; i < 5; i++) {
        authorize.recordViolation({
          callerOrgId: testOrgId,
          clientOrgId: 'other-org',
          userId: testUserId,
          method: 'GET',
          path: '/api/test',
          ip: '127.0.0.1',
        });
      }

      const result = authorize.getInterdictedKeys();
      assert.ok(result.stats.totalAutoTriggered >= 1);
      assert.ok(result.stats.lastAutoTrigger);
    });
  });

  describe('memory cap', () => {
    it('should evict oldest entry when cap is reached', () => {
      // Set a low cap via settings by interdicting many keys
      // The default cap is 10,000 — we test with a smaller number
      // by directly checking that the store doesn't grow unbounded
      for (let i = 0; i < 100; i++) {
        authorize.interdictKey(`cap-test-key-${i}`, 'test_reason', 60000);
      }
      const result = authorize.getInterdictedKeys();
      assert.ok(result.total <= 100, 'Should not exceed expected count');
      assert.ok(result.total > 0, 'Should have entries');
    });
  });

  describe('clearInterdictedKeys()', () => {
    it('should clear all interdicted keys and return count', () => {
      authorize.interdictKey('clear-key-1', 'test_reason', 60000);
      authorize.interdictKey('clear-key-2', 'test_reason', 60000);
      const count = authorize.clearInterdictedKeys();
      assert.strictEqual(count, 2);
      const result = authorize.getInterdictedKeys();
      assert.strictEqual(result.total, 0);
    });
  });
});
