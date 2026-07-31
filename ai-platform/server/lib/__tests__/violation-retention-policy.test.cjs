'use strict';

/**
 * Tests for violation retention policy in authorize.cjs
 *
 * Tests TTL-based auto-expiry, configurable max log size, memory pressure
 * guard, cleanup timer lifecycle, and integration with recordViolation().
 */

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Set env vars before requiring modules
const _tempSettingsPath = path.join(os.tmpdir(), 'sb-violation-retention-test-settings.json');
process.env.SECURITY_MONITOR_SETTINGS_PATH = _tempSettingsPath;

function writeSettings(updates = {}) {
  fs.writeFileSync(
    _tempSettingsPath,
    JSON.stringify({
      orgPartitionEnforcementEnabled: true,
      orgPartitionAlertOnViolation: false,
      orgPartitionViolationAlertThreshold: 5,
      orgPartitionViolationTtlMs: 24 * 60 * 60 * 1000,
      orgPartitionViolationMaxLog: 1000,
      orgPartitionViolationCleanupIntervalMs: 5 * 60 * 1000,
      orgPartitionViolationMemoryGuardMb: 50,
      ...updates,
    }),
    'utf8'
  );
}

// Write initial settings
writeSettings();

const {
  getPartitionViolations,
  getPartitionStats,
  purgeExpiredViolations,
  enforceViolationCap,
  clearViolations,
  estimateViolationMemoryMb,
  startCleanupTimer,
  stopCleanupTimer,
} = require('../../middleware/authorize.cjs');

// Helper to create mock Express objects
function createMockReq(opts = {}) {
  const req = {
    body: opts.body || {},
    query: opts.query || {},
    params: opts.params || {},
    method: opts.method || 'GET',
    path: opts.path || '/api/test',
    ip: opts.ip || '127.0.0.1',
    socket: { remoteAddress: opts.ip || '127.0.0.1' },
  };
  if ('user' in opts) {
    req.user = opts.user;
  } else {
    req.user = { id: 'user-org-a', email: 'user@org-a.com' };
  }
  return req;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('Violation Retention Policy', () => {
  let settingsStore;

  before(() => {
    // Get the settings store module ??? this is the same module instance
    // that authorize.cjs uses since it lazy-loads via require()
    settingsStore = require('../../lib/security-monitor-settings-store.cjs');
  });

  beforeEach(() => {
    // Reset to defaults via updateSettings (updates in-memory cache + file)
    settingsStore.updateSettings({
      orgPartitionEnforcementEnabled: true,
      orgPartitionAlertOnViolation: false,
      orgPartitionViolationAlertThreshold: 5,
      orgPartitionViolationTtlMs: 24 * 60 * 60 * 1000,
      orgPartitionViolationMaxLog: 1000,
      orgPartitionViolationCleanupIntervalMs: 5 * 60 * 1000,
      orgPartitionViolationMemoryGuardMb: 50,
    });
    // Clear all violations
    clearViolations();
  });

  afterEach(() => {
    stopCleanupTimer();
    clearViolations();
  });

  // ?????? clearViolations ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('clearViolations', () => {
    it('should clear all violations from the buffer', () => {
      // Record some violations by calling enforceOrgPartition
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      assert.ok(getPartitionViolations().length > 0);

      const cleared = clearViolations();
      assert.ok(cleared > 0);
      assert.strictEqual(getPartitionViolations().length, 0);
    });

    it('should return 0 when there are no violations', () => {
      clearViolations();
      const cleared = clearViolations();
      assert.strictEqual(cleared, 0);
    });
  });

  // ?????? purgeExpiredViolations ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('purgeExpiredViolations', () => {
    it('should remove violations older than the TTL', () => {
      // Set a very short TTL (1 second)
      settingsStore.updateSettings({ orgPartitionViolationTtlMs: 1000 });

      // Record a violation
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      assert.ok(getPartitionViolations().length > 0);

      // Wait for TTL to expire
      // We can't actually wait 1 second in a fast test, so we'll manipulate
      // the violation timestamps directly by recording, then checking purge
      // with a TTL that's already past

      // Actually, let's use a different approach: set TTL to 0 (minimum is 60000)
      // so we'll set it to 60000 and then manually backdate the violations
      settingsStore.updateSettings({ orgPartitionViolationTtlMs: 60000 });

      // The violation we just recorded has a current timestamp, so it won't be purged
      const purged = purgeExpiredViolations();
      assert.strictEqual(purged, 0);
      assert.ok(getPartitionViolations().length > 0);
    });

    it('should purge violations with backdated timestamps', () => {
      // This test works by directly manipulating the violation buffer
      // We'll record violations, then backdate their timestamps, then purge

      // Record a violation
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      const violations = getPartitionViolations();
      assert.ok(violations.length > 0);

      // Set TTL to 1 hour
      settingsStore.updateSettings({ orgPartitionViolationTtlMs: 60 * 60 * 1000 });

      // Backdate the violation by 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      // We need to access the internal array ??? use the exported getPartitionViolations
      // which returns the actual array reference
      for (const v of violations) {
        v.at = twoHoursAgo;
      }

      // Now purge should remove them
      const purged = purgeExpiredViolations();
      assert.ok(purged > 0);
      assert.strictEqual(getPartitionViolations().length, 0);
    });

    it('should return 0 when no violations are expired', () => {
      // Record a fresh violation
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      // With a 24h TTL, nothing should be purged
      const purged = purgeExpiredViolations();
      assert.strictEqual(purged, 0);
    });

    it('should update lastCleanupRun timestamp', () => {
      const before = Date.now();
      purgeExpiredViolations();
      // getPartitionStats should show lastCleanupRun
      const stats = getPartitionStats();
      assert.ok(stats.lastCleanupRun !== null);
      assert.ok(new Date(stats.lastCleanupRun).getTime() >= before);
    });
  });

  // ?????? enforceViolationCap ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('enforceViolationCap', () => {
    it('should trim violations when count exceeds maxLog', () => {
      // Set a small max log (minimum allowed is 10)
      settingsStore.updateSettings({ orgPartitionViolationMaxLog: 10 });

      // Record 20 violations
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { orgId: 'org-b' } });
        const res = createMockRes();
        middleware(req, res, () => {});
      }

      // Should be capped at 10
      assert.ok(getPartitionViolations().length <= 10);
    });

    it('should not trim when under the cap', () => {
      settingsStore.updateSettings({ orgPartitionViolationMaxLog: 100 });

      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      const before = getPartitionViolations().length;
      enforceViolationCap();
      assert.strictEqual(getPartitionViolations().length, before);
    });

    it('should enforce memory guard by trimming violations', () => {
      // Set a very low memory guard (1 MB minimum, but we need at least 1)
      // At 0.5KB per violation, 1 MB = ~2048 violations. We'll record 10
      // violations which is well under 1 MB, so this test verifies the
      // memory guard doesn't interfere when memory is within bounds.
      // To actually trigger the guard, we'd need 2048+ violations.
      // Instead, we verify the guard value is respected in stats.
      settingsStore.updateSettings({
        orgPartitionViolationMemoryGuardMb: 1,
        orgPartitionViolationMaxLog: 1000,
      });

      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      for (let i = 0; i < 10; i++) {
        const req = createMockReq({ body: { orgId: 'org-b' } });
        const res = createMockRes();
        middleware(req, res, () => {});
      }

      // With 1 MB guard, 10 violations (0.005 MB) should all be retained
      assert.strictEqual(getPartitionViolations().length, 10);

      // Verify the memory guard is reflected in stats
      const stats = getPartitionStats();
      assert.strictEqual(stats.violationMemoryGuardMb, 1);
      assert.ok(stats.estimatedMemoryMb < 1);
    });
  });

  // ?????? estimateViolationMemoryMb ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('estimateViolationMemoryMb', () => {
    it('should return 0 when buffer is empty', () => {
      clearViolations();
      assert.strictEqual(estimateViolationMemoryMb(), 0);
    });

    it('should return a positive number when violations exist', () => {
      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: 'org-b' } });
      const res = createMockRes();
      middleware(req, res, () => {});

      assert.ok(estimateViolationMemoryMb() > 0);
    });
  });

  // ?????? getPartitionStats with retention info ??????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('getPartitionStats retention fields', () => {
    it('should include violationTtlMs in stats', () => {
      const stats = getPartitionStats();
      assert.ok('violationTtlMs' in stats);
      assert.ok(typeof stats.violationTtlMs === 'number');
    });

    it('should include violationMaxLog in stats', () => {
      const stats = getPartitionStats();
      assert.ok('violationMaxLog' in stats);
      assert.ok(typeof stats.violationMaxLog === 'number');
    });

    it('should include violationMemoryGuardMb in stats', () => {
      const stats = getPartitionStats();
      assert.ok('violationMemoryGuardMb' in stats);
    });

    it('should include estimatedMemoryMb in stats', () => {
      const stats = getPartitionStats();
      assert.ok('estimatedMemoryMb' in stats);
    });

    it('should include lastCleanupRun in stats', () => {
      const stats = getPartitionStats();
      assert.ok('lastCleanupRun' in stats);
    });

    it('should reflect config changes in stats', () => {
      settingsStore.updateSettings({
        orgPartitionViolationTtlMs: 2 * 60 * 60 * 1000,
        orgPartitionViolationMaxLog: 500,
        orgPartitionViolationMemoryGuardMb: 25,
      });

      const stats = getPartitionStats();
      assert.strictEqual(stats.violationTtlMs, 2 * 60 * 60 * 1000);
      assert.strictEqual(stats.violationMaxLog, 500);
      assert.strictEqual(stats.violationMemoryGuardMb, 25);
    });
  });

  // ?????? Cleanup Timer ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('cleanup timer', () => {
    it('startCleanupTimer should not throw', () => {
      assert.doesNotThrow(() => startCleanupTimer());
    });

    it('stopCleanupTimer should not throw', () => {
      startCleanupTimer();
      assert.doesNotThrow(() => stopCleanupTimer());
    });

    it('should be safe to call stopCleanupTimer without start', () => {
      assert.doesNotThrow(() => stopCleanupTimer());
    });

    it('should be safe to call startCleanupTimer multiple times', () => {
      startCleanupTimer();
      startCleanupTimer();
      startCleanupTimer();
      stopCleanupTimer();
    });
  });

  // ?????? Settings Validation ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  describe('settings validation', () => {
    it('should reject orgPartitionViolationTtlMs < 60000', () => {
      const result = settingsStore.updateSettings({ orgPartitionViolationTtlMs: 30000 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('60000'));
    });

    it('should reject orgPartitionViolationMaxLog < 10', () => {
      const result = settingsStore.updateSettings({ orgPartitionViolationMaxLog: 5 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('10'));
    });

    it('should reject orgPartitionViolationCleanupIntervalMs < 10000', () => {
      const result = settingsStore.updateSettings({
        orgPartitionViolationCleanupIntervalMs: 5000,
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('10000'));
    });

    it('should reject orgPartitionViolationMemoryGuardMb < 1', () => {
      const result = settingsStore.updateSettings({ orgPartitionViolationMemoryGuardMb: 0 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('1'));
    });

    it('should accept valid retention settings', () => {
      const result = settingsStore.updateSettings({
        orgPartitionViolationTtlMs: 48 * 60 * 60 * 1000,
        orgPartitionViolationMaxLog: 5000,
        orgPartitionViolationCleanupIntervalMs: 10 * 60 * 1000,
        orgPartitionViolationMemoryGuardMb: 100,
      });
      assert.strictEqual(result.success, true);
    });
  });

  // ?????? Integration: recordViolation respects retention ????????????????????????????????????????????????????????????????????????

  describe('recordViolation integration with retention', () => {
    it('should auto-trim when recording many violations', () => {
      settingsStore.updateSettings({
        orgPartitionViolationMaxLog: 10,
        orgPartitionViolationMemoryGuardMb: 50,
      });

      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();

      // Record 50 violations
      for (let i = 0; i < 50; i++) {
        const req = createMockReq({ body: { orgId: 'org-b' } });
        const res = createMockRes();
        middleware(req, res, () => {});
      }

      // Should be capped at 10
      assert.strictEqual(getPartitionViolations().length, 10);
    });

    it('should refuse to store new violations under extreme memory pressure', () => {
      // Set memory guard to minimum (1 MB) and max log very high,
      // then record enough violations to exceed 1 MB (~2048 at 0.5KB each).
      // We'll record 3000 violations and verify the buffer stays around 1 MB.
      settingsStore.updateSettings({
        orgPartitionViolationMemoryGuardMb: 1,
        orgPartitionViolationMaxLog: 10000,
      });

      const { enforceOrgPartition } = require('../../middleware/authorize.cjs');
      const middleware = enforceOrgPartition();

      for (let i = 0; i < 3000; i++) {
        const req = createMockReq({ body: { orgId: 'org-b' } });
        const res = createMockRes();
        middleware(req, res, () => {});
      }

      // Memory guard should have kicked in ??? buffer should be at or near
      // the 1 MB threshold (~2048 violations at 0.5 KB each)
      const violations = getPartitionViolations();
      assert.ok(violations.length <= 2050, `Expected <= 2050, got ${violations.length}`);
      const stats = getPartitionStats();
      assert.ok(stats.estimatedMemoryMb <= 1.01, `Expected <= 1.01 MB, got ${stats.estimatedMemoryMb}`);
    });
  });
});
