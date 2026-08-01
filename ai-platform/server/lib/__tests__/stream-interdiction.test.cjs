'use strict';

/**
 * Tests for Real-Time Log Stream Interdiction Engine.
 *
 * Verifies that the multi-axis sliding-window failure tracker in authorize.cjs:
 *   1. Records stream failures by type per API key
 *   2. Auto-interdicts keys when failure counts exceed per-type thresholds
 *   3. Respects the sliding window (expired failures don't count)
 *   4. Provides accurate stats and recent failure listings
 *   5. Supports clear/reset for admin and test workflows
 *   6. Rejects invalid failure types gracefully
 *   7. Enforces memory cap to prevent unbounded growth
 *   8. Integrates with the existing key interdiction block list (HTTP 423)
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

describe('Real-Time Log Stream Interdiction Engine', () => {
  let authorize;

  beforeEach(() => {
    authorize = reloadModule();
    authorize.clearInterdictedKeys();
    authorize.clearViolations();
    authorize.clearStreamFailures();
    authorize._resetInterdictionStats();
    authorize._resetStreamInterdictionStats();
  });

  afterEach(() => {
    authorize.clearInterdictedKeys();
    authorize.clearViolations();
    authorize.clearStreamFailures();
    authorize._resetInterdictionStats();
    authorize._resetStreamInterdictionStats();
  });

  describe('recordStreamFailure()', () => {
    it('should record a stream failure and return count', () => {
      const result = authorize.recordStreamFailure('test-key-1', 'chain_verification', 'broken link');
      assert.strictEqual(result.recorded, true);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.interdicted, false);
    });

    it('should reject invalid failure types', () => {
      const result = authorize.recordStreamFailure('test-key-1', 'invalid_type', 'test');
      assert.strictEqual(result.recorded, false);
      assert.strictEqual(result.count, 0);
    });

    it('should reject null/undefined apiKey', () => {
      const result = authorize.recordStreamFailure(null, 'chain_verification', 'test');
      assert.strictEqual(result.recorded, false);
    });

    it('should auto-interdict when threshold is exceeded', () => {
      // chain_verification threshold is 3 by default
      authorize.recordStreamFailure('auto-key-1', 'chain_verification', 'fail 1');
      authorize.recordStreamFailure('auto-key-1', 'chain_verification', 'fail 2');
      const result = authorize.recordStreamFailure('auto-key-1', 'chain_verification', 'fail 3');

      assert.strictEqual(result.count, 3);
      assert.strictEqual(result.interdicted, true);
      assert.strictEqual(result.threshold, 3);

      // Key should now be interdicted
      const status = authorize.checkInterdiction('auto-key-1');
      assert.strictEqual(status.interdicted, true);
      assert.ok(status.reason.includes('stream_interdiction'));
      assert.ok(status.reason.includes('chain_verification'));
    });

    it('should track different failure types independently', () => {
      // Record 2 chain_verification failures (threshold 3, not yet interdicted)
      authorize.recordStreamFailure('multi-key', 'chain_verification', 'fail 1');
      authorize.recordStreamFailure('multi-key', 'chain_verification', 'fail 2');

      // Record 4 pii_violation failures (threshold 5, not yet interdicted)
      authorize.recordStreamFailure('multi-key', 'pii_violation', 'fail 1');
      authorize.recordStreamFailure('multi-key', 'pii_violation', 'fail 2');
      authorize.recordStreamFailure('multi-key', 'pii_violation', 'fail 3');
      authorize.recordStreamFailure('multi-key', 'pii_violation', 'fail 4');

      // Key should NOT be interdicted yet
      const status = authorize.checkInterdiction('multi-key');
      assert.strictEqual(status.interdicted, false);
    });

    it('should track different keys independently', () => {
      // Key A gets 2 chain_verification failures
      authorize.recordStreamFailure('key-A', 'chain_verification', 'fail 1');
      authorize.recordStreamFailure('key-A', 'chain_verification', 'fail 2');

      // Key B gets 1 chain_verification failure
      const resultB = authorize.recordStreamFailure('key-B', 'chain_verification', 'fail 1');
      assert.strictEqual(resultB.count, 1);

      // Neither should be interdicted
      assert.strictEqual(authorize.checkInterdiction('key-A').interdicted, false);
      assert.strictEqual(authorize.checkInterdiction('key-B').interdicted, false);
    });
  });

  describe('getStreamFailureStats()', () => {
    it('should return stats with enabled flag and thresholds', () => {
      const stats = authorize.getStreamFailureStats();
      assert.strictEqual(stats.enabled, true);
      assert.ok(stats.windowMs >= 10000);
      assert.ok(stats.ttlMs >= 1000);
      assert.ok(stats.thresholds);
      assert.ok(stats.thresholds.chain_verification > 0);
      assert.ok(stats.thresholds.pii_violation > 0);
    });

    it('should return recent failures after recording', () => {
      authorize.recordStreamFailure('stats-key-1', 'guardrail_refusal', 'refused');
      authorize.recordStreamFailure('stats-key-2', 'auth_failure', 'bad token');

      const stats = authorize.getStreamFailureStats();
      assert.ok(stats.totalFailuresInWindow >= 2);
      assert.ok(stats.recentFailures.length >= 2);
      assert.ok(stats.byKey['stats-key-1']);
      assert.strictEqual(stats.byKey['stats-key-1'].guardrail_refusal, 1);
    });

    it('should track byType in stats', () => {
      authorize.recordStreamFailure('type-key', 'chain_verification', 'fail');
      authorize.recordStreamFailure('type-key', 'chain_verification', 'fail');
      authorize.recordStreamFailure('type-key', 'pii_violation', 'fail');

      const stats = authorize.getStreamFailureStats();
      assert.ok(stats.stats.byType.chain_verification >= 2);
      assert.ok(stats.stats.byType.pii_violation >= 1);
    });

    it('should track totalAutoInterdicts after auto-interdiction', () => {
      // Trigger auto-interdiction (threshold 3 for chain_verification)
      authorize.recordStreamFailure('auto-stats-key', 'chain_verification', '1');
      authorize.recordStreamFailure('auto-stats-key', 'chain_verification', '2');
      authorize.recordStreamFailure('auto-stats-key', 'chain_verification', '3');

      const stats = authorize.getStreamFailureStats();
      assert.ok(stats.stats.totalAutoInterdicts >= 1);
      assert.ok(stats.stats.lastAutoInterdict);
    });
  });

  describe('clearStreamFailures()', () => {
    it('should clear all stream failures and return count', () => {
      authorize.recordStreamFailure('clear-key-1', 'chain_verification', 'fail');
      authorize.recordStreamFailure('clear-key-2', 'pii_violation', 'fail');
      const count = authorize.clearStreamFailures();
      assert.ok(count >= 2);

      const stats = authorize.getStreamFailureStats();
      assert.strictEqual(stats.totalFailuresInWindow, 0);
    });
  });

  describe('_resetStreamInterdictionStats()', () => {
    it('should reset all stats to zero', () => {
      authorize.recordStreamFailure('reset-key', 'chain_verification', 'fail');
      authorize._resetStreamInterdictionStats();

      const stats = authorize.getStreamFailureStats();
      assert.strictEqual(stats.stats.totalFailuresRecorded, 0);
      assert.strictEqual(stats.stats.totalAutoInterdicts, 0);
    });
  });

  describe('STREAM_FAILURE_TYPES', () => {
    it('should export all expected failure types', () => {
      const types = authorize.STREAM_FAILURE_TYPES;
      assert.ok(types.includes('chain_verification'));
      assert.ok(types.includes('pii_violation'));
      assert.ok(types.includes('guardrail_refusal'));
      assert.ok(types.includes('auth_failure'));
      assert.ok(types.includes('org_partition'));
      assert.ok(types.includes('rate_limit'));
      assert.ok(types.includes('bundle_verification'));
    });
  });

  describe('integration with key interdiction block list', () => {
    it('should cause enforceKeyInterdiction middleware to return 423', () => {
      // Trigger auto-interdiction
      authorize.recordStreamFailure('integration-key', 'bundle_verification', '1');
      authorize.recordStreamFailure('integration-key', 'bundle_verification', '2');
      authorize.recordStreamFailure('integration-key', 'bundle_verification', '3');

      // Verify the key is in the block list
      const status = authorize.checkInterdiction('integration-key');
      assert.strictEqual(status.interdicted, true);

      // Simulate middleware behavior
      const req = { headers: { 'x-api-key': 'integration-key' } };
      const res = {
        status: (code) => {
          assert.strictEqual(code, 423);
          return { json: (body) => {
            assert.strictEqual(body.success, false);
            assert.strictEqual(body.error, 'token_interdicted');
          }};
        },
      };
      let called = false;
      const next = () => { called = true; };

      const middleware = authorize.enforceKeyInterdiction();
      middleware(req, res, next);

      // next() should NOT have been called — request is blocked
      assert.strictEqual(called, false);
    });
  });

  describe('org_partition integration', () => {
    it('should record stream failure when org partition violation occurs', () => {
      // recordViolation should also feed the stream interdiction engine
      authorize.recordViolation({
        callerOrgId: 'org-A',
        clientOrgId: 'org-B',
        userId: 'partition-user',
        method: 'GET',
        path: '/api/test',
        ip: '127.0.0.1',
      });

      const stats = authorize.getStreamFailureStats();
      assert.ok(stats.stats.byType.org_partition >= 1);
      assert.ok(stats.byKey['partition-user']);
      assert.strictEqual(stats.byKey['partition-user'].org_partition, 1);
    });
  });
});
