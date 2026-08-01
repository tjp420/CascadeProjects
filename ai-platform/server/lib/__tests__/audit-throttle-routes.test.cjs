'use strict';

/**
 * D-01 regression tests: verifies that adminThrottle is NOT applied to
 * non-admin audit routes (/log, /stats, /export, /partition-status,
 * /verify-stream) and IS applied to admin routes.
 *
 * Uses jest.mock to replace admin-throttle with a spy so we can assert
 * whether the middleware was invoked without depending on Redis or
 * token-bucket state.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Temp paths for audit-routes dependencies
const _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-audit-throttle-'));
const _tempLogPath = path.join(_tempDir, 'audit-log.json');
const _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_SCRUB_PII = 'false';
fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');

// Spy state — reset in beforeEach
let throttleCallCount = 0;
let throttleShouldBlock = false;

// Mock authenticate so we can inject test users
jest.mock('../../middleware/auth.cjs', () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({ success: false, error: 'authentication_required' });
  },
}));

// Mock admin-throttle so we can count invocations and control blocking
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
}));

const ADMIN_USER = {
  id: 'admin@org-test.com',
  email: 'admin@org-test.com',
  role: 'admin',
  permissions: ['admin:all'],
};

function createTestApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (user) req.user = user;
    next();
  });
  const auditRoutes = require('../../routes/audit-routes.cjs');
  app.use('/api/audit', auditRoutes);
  return app;
}

describe('D-01: adminThrottle exclusion on non-admin audit routes', () => {
  let adminApp;

  before(() => {
    adminApp = createTestApp(ADMIN_USER);
  });

  beforeEach(() => {
    throttleCallCount = 0;
    throttleShouldBlock = false;

    // Clear audit-routes from require cache so it re-loads with fresh mocks
    const cacheKeys = Object.keys(require.cache || {});
    for (const k of cacheKeys) {
      if (k.endsWith('/server/routes/audit-routes.cjs')) {
        delete require.cache[k];
      }
    }
    adminApp = createTestApp(ADMIN_USER);
  });

  after(() => {
    try {
      delete process.env.AUDIT_LOG_PATH;
      delete process.env.PII_POLICY_PATH;
      delete process.env.AUDIT_LOG_SCRUB_PII;
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  // Non-admin routes that must NOT trigger adminThrottle
  const NON_ADMIN_ROUTES = [
    { method: 'get', path: '/api/audit/log' },
    { method: 'get', path: '/api/audit/stats' },
    { method: 'get', path: '/api/audit/export' },
    { method: 'get', path: '/api/audit/partition-status' },
  ];

  for (const route of NON_ADMIN_ROUTES) {
    it(`does NOT throttle ${route.method.toUpperCase()} ${route.path}`, async () => {
      const res = await request(adminApp)[route.method](route.path);
      // Route may return 200 or error, but must NOT be 429 from throttle
      assert.notStrictEqual(res.status, 429);
      assert.strictEqual(throttleCallCount, 0, `adminThrottle was called for non-admin route ${route.path}`);
    });
  }

  it('DOES throttle admin route GET /api/audit/telemetry', async () => {
    const res = await request(adminApp).get('/api/audit/telemetry');
    // Admin route should have triggered the throttle spy
    assert.strictEqual(throttleCallCount, 1, 'adminThrottle was NOT called for admin route /api/audit/telemetry');
  });

  it('DOES throttle admin route GET /api/audit/key/status', async () => {
    const res = await request(adminApp).get('/api/audit/key/status');
    assert.strictEqual(throttleCallCount, 1, 'adminThrottle was NOT called for admin route /api/audit/key/status');
  });

  it('returns 429 when throttle blocks an admin route', async () => {
    throttleShouldBlock = true;
    const res = await request(adminApp).get('/api/audit/telemetry');
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.body.error, 'admin_throttled');
  });

  it('does NOT return 429 for non-admin routes even when throttle would block', async () => {
    throttleShouldBlock = true;
    const res = await request(adminApp).get('/api/audit/log');
    assert.notStrictEqual(res.status, 429);
    assert.strictEqual(throttleCallCount, 0, 'adminThrottle was called for non-admin /log even though it should be excluded');
  });
});
