'use strict';

/**
 * E2E Integration Tests for partition enforcement API endpoints.
 * Uses supertest to mount audit-routes on a real Express app with
 * mock authentication middleware that injects test users.
 *
 * Tests the full request path: authenticate ΓåÆ authorize ΓåÆ route handler ΓåÆ audit log
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set env vars before requiring modules
const _tempSettingsPath = path.join(os.tmpdir(), 'sb-e2e-partition-settings.json');
process.env.SECURITY_MONITOR_SETTINGS_PATH = _tempSettingsPath;

// Write default settings (matching DEFAULT_SETTINGS)
fs.writeFileSync(
  _tempSettingsPath,
  JSON.stringify({
    orgPartitionEnforcementEnabled: true,
    orgPartitionAlertOnViolation: true,
    orgPartitionViolationAlertThreshold: 5,
  }),
  'utf8'
);

// Mock the authenticate middleware from auth.cjs so we can inject test users.
// The real authenticate checks JWT tokens; we bypass it for E2E integration tests.
// auth.cjs uses Object.freeze() so we must use jest.mock() to replace it.
jest.mock('../../middleware/auth.cjs', () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({
      success: false,
      error: 'authentication_required',
      message: 'Authentication required',
    });
  },
}));

// Mock users for testing
const ADMIN_USER = {
  id: 'admin@org-a.com',
  email: 'admin@org-a.com',
  role: 'admin',
  permissions: ['admin:all'],
};

const REGULAR_USER = {
  id: 'user@org-a.com',
  email: 'user@org-a.com',
  role: 'developer',
};

const OTHER_ORG_USER = {
  id: 'user@org-b.com',
  email: 'user@org-b.com',
  role: 'developer',
};

// Build the test app with mock auth
function createTestApp(user) {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware ΓÇö injects the test user
  app.use((req, res, next) => {
    if (user) {
      req.user = user;
    }
    next();
  });

  // Mount audit routes
  const auditRoutes = require('../../routes/audit-routes.cjs');
  app.use('/api/audit', auditRoutes);

  return app;
}

describe('Partition Enforcement E2E Integration', () => {
  let adminApp;
  let regularApp;
  let noAuthApp;
  let settingsStore;

  before(() => {
    // Require the settings store once ΓÇö we'll use updateSettings() to reset
    // the in-memory cache between tests instead of deleting the require cache
    // (which conflicts with jest.mock for auth.cjs).
    settingsStore = require('../../lib/security-monitor-settings-store.cjs');

    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
    noAuthApp = createTestApp(null);
  });

  beforeEach(() => {
    // Reset settings to defaults via updateSettings() ΓÇö this updates both
    // the in-memory cache and the persisted file, so all modules see the
    // same state without needing require.cache deletion.
    settingsStore.updateSettings({
      orgPartitionEnforcementEnabled: true,
      orgPartitionAlertOnViolation: true,
      orgPartitionViolationAlertThreshold: 5,
    });
  });

  after(() => {
    try {
      if (fs.existsSync(_tempSettingsPath)) fs.unlinkSync(_tempSettingsPath);
    } catch {}
  });

  // ΓöÇΓöÇ GET /api/audit/partition-status ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/audit/partition-status', () => {
    it('should return 200 with enforcement status for authenticated user', async () => {
      const res = await request(regularApp).get('/api/audit/partition-status');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.enforcementEnabled, true);
      assert.ok(typeof res.body.totalViolations === 'number');
      assert.ok(Array.isArray(res.body.recentViolations));
      assert.strictEqual(res.body.callerOrgId, 'user@org-a.com');
    });

    it('should include alert config in status response', async () => {
      const res = await request(regularApp).get('/api/audit/partition-status');

      assert.strictEqual(res.status, 200);
      assert.ok('alertOnViolation' in res.body);
      assert.ok('violationAlertThreshold' in res.body);
    });
  });

  // ΓöÇΓöÇ GET /api/audit/partition-config ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/audit/partition-config', () => {
    it('should return config for admin user', async () => {
      const res = await request(adminApp).get('/api/audit/partition-config');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.config);
      assert.strictEqual(res.body.config.orgPartitionEnforcementEnabled, true);
      assert.strictEqual(res.body.config.orgPartitionAlertOnViolation, true);
      assert.strictEqual(res.body.config.orgPartitionViolationAlertThreshold, 5);
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).get('/api/audit/partition-config');

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error, 'insufficient_permissions');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(noAuthApp).get('/api/audit/partition-config');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ΓöÇΓöÇ PUT /api/audit/partition-config ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('PUT /api/audit/partition-config', () => {
    it('should update config for admin user', async () => {
      const res = await request(adminApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionEnforcementEnabled: false });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.config.orgPartitionEnforcementEnabled, false);
    });

    it('should update violation alert threshold', async () => {
      const res = await request(adminApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionViolationAlertThreshold: 10 });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.config.orgPartitionViolationAlertThreshold, 10);
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionEnforcementEnabled: false });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'insufficient_permissions');
    });

    it('should reject invalid threshold (< 1) with 400', async () => {
      const res = await request(adminApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionViolationAlertThreshold: 0 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ΓöÇΓöÇ GET /api/audit/partition-violations/export ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  describe('GET /api/audit/partition-violations/export', () => {
    it('should export violations as JSON for admin user', async () => {
      const res = await request(adminApp).get('/api/audit/partition-violations/export?format=json');

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-disposition'].includes('attachment'));
      assert.ok(res.headers['content-disposition'].includes('.json'));
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.totalViolations === 'number');
      assert.ok(Array.isArray(res.body.violations));
    });

    it('should export violations as CSV for admin user', async () => {
      const res = await request(adminApp).get('/api/audit/partition-violations/export?format=csv');

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.headers['content-disposition'].includes('.csv'));
      // CSV should start with header row
      assert.ok(res.text.startsWith('timestamp,callerOrgId,clientOrgId'));
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).get('/api/audit/partition-violations/export');

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'insufficient_permissions');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(noAuthApp).get('/api/audit/partition-violations/export');

      assert.strictEqual(res.status, 401);
    });
  });

  // ΓöÇΓöÇ Full request path: partition-status ΓåÆ config update ΓåÆ status reflects change ΓöÇΓöÇ

  describe('Full config update cycle', () => {
    it('should reflect config changes in partition-status endpoint', async () => {
      // 1. Get initial status ΓÇö enforcement should be enabled (from beforeEach defaults)
      const initial = await request(regularApp).get('/api/audit/partition-status');
      assert.strictEqual(initial.body.enforcementEnabled, true);

      // 2. Update config via admin ΓÇö disable enforcement
      const update = await request(adminApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionEnforcementEnabled: false });
      assert.strictEqual(update.status, 200);
      assert.strictEqual(update.body.config.orgPartitionEnforcementEnabled, false);

      // 3. Get updated status ΓÇö should reflect the change
      //    updateSettings() updates the in-memory cache, so getPartitionStats()
      //    should return the updated values without needing a module re-require.
      const updated = await request(adminApp).get('/api/audit/partition-status');
      assert.strictEqual(updated.body.enforcementEnabled, false);
    });

    it('should reflect threshold changes in partition-status endpoint', async () => {
      // Update threshold
      const update = await request(adminApp)
        .put('/api/audit/partition-config')
        .send({ orgPartitionViolationAlertThreshold: 15 });
      assert.strictEqual(update.status, 200);

      // Verify status reflects new threshold
      const status = await request(adminApp).get('/api/audit/partition-status');
      assert.strictEqual(status.body.violationAlertThreshold, 15);
    });
  });
});
