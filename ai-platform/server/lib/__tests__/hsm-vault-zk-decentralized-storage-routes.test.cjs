'use strict';

/**
 * Tests for Track 111 zero-knowledge decentralized storage attestation gating admin endpoints.
 * Track 111 is currently unavailable (503 guarded) while the hub and validator are staged.
 *
 * Routes:
 *   - GET  /api/vault/zk-decentralized-storage/policy
 *   - POST /api/vault/zk-decentralized-storage/policy/validate
 *   - GET  /api/vault/zk-decentralized-storage/telemetry
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

function buildApp(user) {
  const app = express();
  const router = require('../../routes/hsm-vault-routes.cjs');
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/vault', router);
  return app;
}

describe('Track 111 Zero-Knowledge Decentralized Storage Attestation Gating routes (503 guarded)', () => {
  test('GET /api/vault/zk-decentralized-storage/policy returns 503 unavailable', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/zk-decentralized-storage/policy');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('zk_decentralized_storage_gating_unavailable');
    expect(res.body.message).toMatch(/not yet available/);
  });

  test('POST /api/vault/zk-decentralized-storage/policy/validate returns 503 unavailable', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/zk-decentralized-storage/policy/validate')
      .send({ zkStorageQuorum: 22 });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('zk_decentralized_storage_gating_unavailable');
  });

  test('GET /api/vault/zk-decentralized-storage/telemetry returns 503 unavailable', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/zk-decentralized-storage/telemetry');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('zk_decentralized_storage_gating_unavailable');
  });

  test('non-admin users are rejected with 403 before 503 guard', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/zk-decentralized-storage/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
