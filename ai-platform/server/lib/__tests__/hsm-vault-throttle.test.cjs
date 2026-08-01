'use strict';

/**
 * E-04 test suite for hsm-vault-routes.cjs throttle ordering.
 *
 * Verifies the authBeforeThrottle chain:
 *   1. authorize('admin:all') runs BEFORE adminThrottle
 *   2. Non-admin users get 403 (auth rejection), not 429 (throttle)
 *   3. Admin users that are throttled get 429
 *   4. Admin users that are not throttled reach the route handler
 *
 * Uses jest.mock to replace admin-throttle with a spy and authorize
 * with a controllable mock, so we can assert middleware call order.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

// Spy state
let throttleCallCount = 0;
let throttleShouldBlock = false;
let authorizeCallCount = 0;

// Mock authorize — simulates admin:all check
jest.mock('../../middleware/authorize.cjs', () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      authorizeCallCount++;
      // Check if user has the required permission
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

// Mock admin-throttle — spy that counts invocations
jest.mock('../../lib/admin-throttle.cjs', () => ({
  middleware: function spyThrottle(req, res, next) {
    throttleCallCount++;
    if (throttleShouldBlock) {
      return res.status(429).json({ success: false, error: 'admin_throttled' });
    }
    next();
  },
  CAPACITY: 20,
  LEAK_RATE: 5,
  RESERVE_PCT: 25,
  getClientIp: () => '10.0.0.1',
  getSubnet: () => '10.0.0.0/24',
  consume: jest.fn(),
  consumeSubnet: jest.fn(),
  recordPenalty: jest.fn(),
  checkAdminRequest: jest.fn(),
  _probeRedisHealth: jest.fn(),
  _isRedisEnabled: () => false,
}));

// Mock hsm-vault to avoid real HSM calls
jest.mock('../../lib/hsm-vault.cjs', () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: 'ok', provider: 'mockhsm' }),
  decryptWithHsm: jest.fn().mockResolvedValue('decrypted-text'),
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.from('fake-key')),
  getHsmVersions: jest.fn().mockReturnValue({ current: 'v1', previous: 'v0' }),
  hsmRotate: jest.fn().mockResolvedValue({ rotated: true, newKeyId: 'k2' }),
}));

const ADMIN_USER = {
  id: 'admin@org-test.com',
  email: 'admin@org-test.com',
  role: 'admin',
  permissions: ['admin:all'],
};

const REGULAR_USER = {
  id: 'user@org-test.com',
  email: 'user@org-test.com',
  role: 'developer',
  permissions: [],
};

function createTestApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (user) req.user = user;
    next();
  });
  // Clear require cache so mocks are fresh
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith('/server/routes/hsm-vault-routes.cjs')) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require('../../routes/hsm-vault-routes.cjs');
  app.use('/api/vault', vaultRoutes);
  return app;
}

describe('E-04: hsm-vault-routes authBeforeThrottle ordering', () => {
  let adminApp;
  let regularApp;

  beforeEach(() => {
    throttleCallCount = 0;
    throttleShouldBlock = false;
    authorizeCallCount = 0;

    const cacheKeys = Object.keys(require.cache || {});
    for (const k of cacheKeys) {
      if (k.endsWith('/server/routes/hsm-vault-routes.cjs')) {
        delete require.cache[k];
      }
    }
    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
  });

  it('non-admin user gets 403 (auth rejection), NOT 429 (throttle)', async () => {
    const res = await request(regularApp).get('/api/vault/status');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'insufficient_permissions');
    // authorize was called (by both authBeforeThrottle and the route-level guard)
    assert.ok(authorizeCallCount >= 1, 'authorize should have been called');
    // throttle should NOT have been called — auth rejected before throttle ran
    assert.strictEqual(throttleCallCount, 0, 'adminThrottle was called even though auth failed — ordering bug!');
  });

  it('admin user with throttle allowing traffic reaches the route handler', async () => {
    const res = await request(adminApp).get('/api/vault/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // Both authorize and throttle were called
    assert.ok(authorizeCallCount >= 1, 'authorize should have been called');
    assert.ok(throttleCallCount >= 1, 'adminThrottle should have been called for admin user');
  });

  it('admin user with throttle blocking gets 429', async () => {
    throttleShouldBlock = true;
    const res = await request(adminApp).get('/api/vault/status');
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.body.error, 'admin_throttled');
  });

  it('authorize runs before adminThrottle (call order verification)', async () => {
    // For a non-admin user: authorize is called, throttle is NOT.
    // This proves authorize runs first and short-circuits before throttle.
    const res = await request(regularApp).post('/api/vault/rotate').send({});
    assert.strictEqual(res.status, 403);
    assert.strictEqual(throttleCallCount, 0, 'throttle ran before auth rejected — D-02 regression!');
  });

  it('POST /api/vault/handshake works for admin when throttle allows', async () => {
    const res = await request(adminApp).post('/api/vault/handshake').send({
      provider: 'mockhsm',
      keyId: 'test-key',
      region: 'us-east-1',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('POST /api/vault/decrypt returns 400 for missing ciphertext', async () => {
    const res = await request(adminApp).post('/api/vault/decrypt').send({});
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/vault/failover returns success with fingerprint', async () => {
    const res = await request(adminApp).post('/api/vault/failover').send({});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.fingerprint, 'should have a fingerprint');
  });

  it('non-admin user gets 403 on all vault routes (not 429)', async () => {
    const routes = [
      { method: 'get', path: '/api/vault/status' },
      { method: 'post', path: '/api/vault/handshake' },
      { method: 'post', path: '/api/vault/decrypt' },
      { method: 'post', path: '/api/vault/failover' },
      { method: 'post', path: '/api/vault/rotate' },
    ];
    for (const route of routes) {
      throttleCallCount = 0;
      const res = await request(regularApp)[route.method](route.path).send({});
      assert.strictEqual(res.status, 403, `${route.method.toUpperCase()} ${route.path} should return 403 for non-admin`);
      assert.strictEqual(throttleCallCount, 0, `throttle was called for non-admin on ${route.path}`);
    }
  });
});
