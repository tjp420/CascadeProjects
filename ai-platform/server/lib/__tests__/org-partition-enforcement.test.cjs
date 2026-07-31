'use strict';

/**
 * Tests for org partition enforcement middleware (authorize.cjs)
 * Tests enforceOrgPartition(), getPartitionStats(), getPartitionViolations()
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Set env vars before requiring modules
const _tempSettingsPath = path.join(os.tmpdir(), 'sb-partition-test-settings.json');
process.env.SECURITY_MONITOR_SETTINGS_PATH = _tempSettingsPath;

// Write default settings to temp path
fs.writeFileSync(
  _tempSettingsPath,
  JSON.stringify({
    orgPartitionEnforcementEnabled: true,
    orgPartitionAlertOnViolation: false, // disable alerting to avoid alert-dispatcher dependency
    orgPartitionViolationAlertThreshold: 5,
  }),
  'utf8'
);

const {
  enforceOrgPartition,
  getPartitionStats,
  getPartitionViolations,
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
  // Only set user if explicitly provided (including null)
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

describe('enforceOrgPartition', () => {
  let settingsBackup;

  beforeEach(() => {
    // Reset settings to defaults
    fs.writeFileSync(
      _tempSettingsPath,
      JSON.stringify({
        orgPartitionEnforcementEnabled: true,
        orgPartitionAlertOnViolation: false,
        orgPartitionViolationAlertThreshold: 5,
      }),
      'utf8'
    );
  });

  afterEach(() => {
    // Clean up settings cache by re-requiring
    try {
      delete require.cache[require.resolve('../../lib/security-monitor-settings-store.cjs')];
      delete require.cache[require.resolve('../../middleware/authorize.cjs')];
    } catch {}
  });

  it('should pass through when no client orgId is provided', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
    assert.strictEqual(req.resolvedOrgId, 'user-org-a');
  });

  it('should pass through when client orgId matches caller orgId', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ body: { orgId: 'user-org-a' } });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
    assert.strictEqual(req.resolvedOrgId, 'user-org-a');
  });

  it('should reject with 403 when client orgId differs from caller orgId', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ body: { orgId: 'org-b' } });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'org_partition_violation');
    assert.strictEqual(res.body.callerOrgId, 'user-org-a');
    assert.strictEqual(res.body.requestedOrgId, 'org-b');
  });

  it('should reject with 401 when no user is authenticated', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ user: null });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'authentication_required');
  });

  it('should extract orgId from query params', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ query: { orgId: 'org-c' } });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(res.statusCode, 403);
  });

  it('should extract orgId from route params', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ params: { orgId: 'org-d' } });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(res.statusCode, 403);
  });

  it('should record violations in the violation log', () => {
    const middleware = enforceOrgPartition();
    const req = createMockReq({ body: { orgId: 'org-e' }, method: 'POST', path: '/api/test' });
    const res = createMockRes();
    middleware(req, res, () => {});

    const violations = getPartitionViolations();
    const last = violations[0];
    assert.ok(last, 'should have at least one violation');
    assert.strictEqual(last.clientOrgId, 'org-e');
    assert.strictEqual(last.callerOrgId, 'user-org-a');
    assert.strictEqual(last.method, 'POST');
    assert.strictEqual(last.path, '/api/test');
    assert.ok(last.at, 'should have a timestamp');
  });

  it('should allow through when enforcement is disabled', () => {
    // Disable enforcement via the settings store API
    const settingsStore = require('../../lib/security-monitor-settings-store.cjs');
    settingsStore.updateSettings({ orgPartitionEnforcementEnabled: false });

    const middleware = enforceOrgPartition();
    const req = createMockReq({ body: { orgId: 'org-f' } });
    const res = createMockRes();
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    assert.strictEqual(called, true);
    assert.strictEqual(req.resolvedOrgId, 'org-f');
    assert.strictEqual(req.partitionEnforcementBypassed, true);

    // Re-enable for subsequent tests
    settingsStore.updateSettings({ orgPartitionEnforcementEnabled: true });
  });
});

describe('getPartitionStats', () => {
  it('should return enforcement status and violation count', () => {
    const stats = getPartitionStats();
    assert.ok(typeof stats.totalViolations === 'number');
    assert.ok(Array.isArray(stats.recentViolations));
    assert.ok(typeof stats.enforcementEnabled === 'boolean');
    assert.ok(typeof stats.alertOnViolation === 'boolean');
    assert.ok(typeof stats.violationAlertThreshold === 'number');
  });

  it('should limit recentViolations to 10 entries', () => {
    // Generate 15 violations
    for (let i = 0; i < 15; i++) {
      const middleware = enforceOrgPartition();
      const req = createMockReq({ body: { orgId: `org-overflow-${i}` } });
      const res = createMockRes();
      middleware(req, res, () => {});
    }
    const stats = getPartitionStats();
    assert.ok(stats.recentViolations.length <= 10, 'should cap at 10 recent violations');
  });
});
