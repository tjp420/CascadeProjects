'use strict';

// Universal runner shim: prefer existing Jest globals, fall back to Node's test harness
const nodeTest = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

const describe = typeof global.describe === 'function' ? global.describe : ((name, fn) => nodeTest(name, fn));
const it = typeof global.it === 'function' ? global.it : ((name, fn) => nodeTest(name, fn));

// Provide a lightweight auth middleware stub by injecting into require.cache
function injectAuthStub() {
  try {
    const resolved = require.resolve('../../middleware/auth.cjs');
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: {
        authenticate: function mockAuthenticate(req, res, next) {
          if (req.user) return next();
          return res.status(401).json({ success: false, error: 'authentication_required' });
        }
      }
    };
  } catch (e) {
    // If resolution fails, tests will load real middleware; that's acceptable for CI where jest.mock is available.
  }
}

// helper to reset caches and inject auth stub when running under node:test
function setupMocks() {
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith('/server/lib/key-rotation-store.cjs') || k.endsWith('/server/routes/audit-routes.cjs') || k.endsWith('/server/middleware/auth.cjs') || k.endsWith('/server/middleware/authorize.cjs')) {
      delete require.cache[k];
    }
  }
  injectAuthStub();
}

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

describe('POST /api/audit/key/purge', () => {

  it('allows an admin to purge stale keys and returns purged=1 when purge happened', async () => {
    setupMocks();
    // Simple mock function with call tracking
    function makeMock(fn) {
      const calls = [];
      const wrapper = (...args) => {
        calls.push(args);
        return fn(...args);
      };
      wrapper.calls = calls;
      return wrapper;
    }

    const purgeMock = makeMock(() => true);
    const getRotationStatusMock = makeMock(() => ({ hasPrevious: true, graceExpired: false }));

    // Inject mock into require.cache so audit-routes will use it
    try {
      const resolved = require.resolve('../../lib/key-rotation-store.cjs');
      require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: {
          purgeExpiredKeys: purgeMock,
          getRotationStatus: getRotationStatusMock,
        }
      };
    } catch (e) {
      // ignore
    }

    const app = createTestApp(ADMIN_USER);
    const res = await request(app).post('/api/audit/key/purge').send({ force: true });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.purged, 1);
    assert.ok(purgeMock.calls.length > 0, 'purgeExpiredKeys should have been called');
    assert.strictEqual(purgeMock.calls[0][0], true, 'purgeExpiredKeys should be called with force=true');
  });

  it('denies access to non-admin users (403)', async () => {
    setupMocks();
    function makeMock(fn) {
      const calls = [];
      const wrapper = (...args) => {
        calls.push(args);
        return fn(...args);
      };
      wrapper.calls = calls;
      return wrapper;
    }

    const purgeMock = makeMock(() => true);
    // Inject mock into require.cache
    try {
      const resolved = require.resolve('../../lib/key-rotation-store.cjs');
      require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: {
          purgeExpiredKeys: purgeMock,
          getRotationStatus: () => ({}),
        }
      };
    } catch (e) {
      // ignore
    }

    const app = createTestApp(REGULAR_USER);
    const res = await request(app).post('/api/audit/key/purge');

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'insufficient_permissions');
    // Ensure purge was not called
    assert.strictEqual(purgeMock.calls.length, 0);
  });
});
