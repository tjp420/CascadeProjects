'use strict';

/**
 * Tests for GET /api/vault/recovery/status — threshold account recovery telemetry endpoint.
 *
 * Verifies that the route:
 *   1. Returns 200 with JSON containing recovery counters
 *   2. Includes all 7 expected recovery metric names
 *   3. Requires admin:all authorization
 *   4. Returns 403 for non-admin users
 *   5. Returns correct counter values after incrementing
 */

const express = require('express');
const request = require('supertest');

// Mock authorize so we can control admin access
jest.mock('../../middleware/authorize.cjs', () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      const perms = (req.user && req.user.permissions) || [];
      if (perms.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        required: permission,
      });
    };
  },
}));

// Mock admin-throttle to pass through
jest.mock('../../lib/admin-throttle.cjs', () => ({
  middleware: function (req, res, next) { next(); },
}));

// Mock hsm-vault to avoid requiring real HSM infrastructure
jest.mock('../../lib/hsm-vault.cjs', () => ({
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  getHsmVersions: jest.fn().mockReturnValue({ primary: 'test', secondary: 'test' }),
}));

const hsmMetrics = require('../../lib/hsm-adapter/hsm-metrics.cjs');

function buildApp(user) {
  const app = express();
  const router = require('../../routes/hsm-vault-routes.cjs');
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/vault', router);
  return app;
}

describe('GET /api/vault/recovery/status', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('returns 200 with JSON for admin', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });

    const res = await request(app).get('/api/vault/recovery/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.counters).toBeDefined();
  });

  test('includes all 7 expected recovery counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });

    const res = await request(app).get('/api/vault/recovery/status');

    const expectedCounters = [
      'hsm_recovery_requested_total',
      'hsm_recovery_approved_total',
      'hsm_recovery_executed_total',
      'hsm_recovery_rejected_total',
      'hsm_recovery_replay_blocked_total',
      'hsm_recovery_time_lock_blocked_total',
      'hsm_recovery_active',
    ];
    for (const name of expectedCounters) {
      expect(res.body.counters).toHaveProperty(name);
    }
  });

  test('returns correct counter values after incrementing', async () => {
    hsmMetrics.incrementCounter('hsm_recovery_requested_total', 5);
    hsmMetrics.incrementCounter('hsm_recovery_executed_total', 3);
    hsmMetrics.incrementCounter('hsm_recovery_rejected_total', 1);

    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });

    const res = await request(app).get('/api/vault/recovery/status');

    expect(res.body.counters.hsm_recovery_requested_total).toBe(5);
    expect(res.body.counters.hsm_recovery_executed_total).toBe(3);
    expect(res.body.counters.hsm_recovery_rejected_total).toBe(1);
  });

  test('returns 403 for non-admin users', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });

    const res = await request(app).get('/api/vault/recovery/status');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });

  test('returns 403 without user context', async () => {
    const app = buildApp(null);

    const res = await request(app).get('/api/vault/recovery/status');

    expect(res.status).toBe(403);
  });

  test('only includes hsm_recovery_* counters (no leakage)', async () => {
    // Increment some non-recovery counters
    hsmMetrics.incrementCounter('hsm_wrap_total', 10);
    hsmMetrics.incrementCounter('hsm_p2p_route_discovered_total', 5);

    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });

    const res = await request(app).get('/api/vault/recovery/status');

    // Should NOT include non-recovery counters
    expect(res.body.counters).not.toHaveProperty('hsm_wrap_total');
    expect(res.body.counters).not.toHaveProperty('hsm_p2p_route_discovered_total');
  });
});
