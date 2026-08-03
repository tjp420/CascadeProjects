'use strict';

const express = require('express');
const request = require('supertest');

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

jest.mock('../../lib/admin-throttle.cjs', () => ({
  middleware: function (req, res, next) { next(); },
}));

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

describe('GET /api/vault/replication/status', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('returns 200 with JSON for admin', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.groups).toBeDefined();
  });

  test('includes all 5 track groups', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    expect(res.body.groups).toHaveProperty('migration');
    expect(res.body.groups).toHaveProperty('reconciliation');
    expect(res.body.groups).toHaveProperty('zkProofOfAssets');
    expect(res.body.groups).toHaveProperty('multipartyReKeying');
    expect(res.body.groups).toHaveProperty('encryptedP2PRouting');
  });

  test('each group has 7 counters (35 total)', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    for (const group of Object.values(res.body.groups)) {
      expect(Object.keys(group).length).toBe(7);
    }
  });

  test('includes all expected migration counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    const expectedMigration = [
      'hsm_migration_initiated_total',
      'hsm_migration_attested_total',
      'hsm_migration_committed_total',
      'hsm_migration_rolled_back_total',
      'hsm_migration_ack_total',
      'hsm_migration_verification_failed_total',
      'hsm_migration_active',
    ];
    for (const name of expectedMigration) {
      expect(res.body.groups.migration).toHaveProperty(name);
    }
  });

  test('returns correct counter values after incrementing', async () => {
    hsmMetrics.incrementCounter('hsm_migration_initiated_total', 5);
    hsmMetrics.incrementCounter('hsm_p2p_route_discovered_total', 3);
    hsmMetrics.incrementCounter('hsm_rekey_proposed_total', 2);
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    expect(res.body.groups.migration.hsm_migration_initiated_total).toBe(5);
    expect(res.body.groups.encryptedP2PRouting.hsm_p2p_route_discovered_total).toBe(3);
    expect(res.body.groups.multipartyReKeying.hsm_rekey_proposed_total).toBe(2);
  });

  test('returns 403 for non-admin users', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/replication/status');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });

  test('returns 403 without user context', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/api/vault/replication/status');
    expect(res.status).toBe(403);
  });

  test('only includes replication counters (no leakage)', async () => {
    hsmMetrics.incrementCounter('hsm_wrap_total', 10);
    hsmMetrics.incrementCounter('hsm_recovery_requested_total', 5);
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/replication/status');
    for (const group of Object.values(res.body.groups)) {
      expect(group).not.toHaveProperty('hsm_wrap_total');
      expect(group).not.toHaveProperty('hsm_recovery_requested_total');
    }
  });
});
