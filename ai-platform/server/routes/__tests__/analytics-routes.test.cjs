'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');
const path = require('path');

const ROUTE_PATH = require.resolve('../analytics-routes.cjs');

// Detect Jest runtime — Jest uses its own module system that bypasses
// Node's Module._load, so we need jest.doMock() for module stubbing.
const IS_JEST = typeof jest !== 'undefined' && typeof jest.doMock === 'function';

/**
 * Load the analytics-routes module with stubbed dependencies so we don't
 * pull in the full auth middleware stack, SIEM broker, or persistent stores.
 *
 * Under Jest: uses jest.doMock() + jest.isolateModules() for module stubbing.
 * Under node --test: uses Module._load interception + require.cache injection.
 */
function loadAnalyticsModule(stubs) {
  // Map of module relative paths (from the route module) to stub implementations
  const mockMap = {
    '../lib/app-logger.cjs': stubs['app-logger.cjs'],
    '../middleware/auth.cjs': stubs['auth.cjs'],
    '../middleware/authorize.cjs': stubs['authorize.cjs'],
    '../middleware/validate-params.cjs': stubs['validate-params.cjs'],
    '../lib/usage-analytics-store.cjs': stubs['usage-analytics-store.cjs'],
    '../lib/ticket-status-store.cjs': stubs['ticket-status-store.cjs'],
    '../lib/webhook-config-store.cjs': stubs['webhook-config-store.cjs'],
    '../lib/report-schedule-store.cjs': stubs['report-schedule-store.cjs'],
    '../lib/report-scheduler.cjs': stubs['report-scheduler.cjs'],
    '../lib/audit-logger.cjs': stubs['audit-logger.cjs'],
    '../lib/response-helpers.cjs': stubs['response-helpers.cjs'],
    '../lib/siem/siem-broker.cjs': stubs['siem-broker.cjs'],
  };

  if (IS_JEST) {
    // Jest path: use jest.doMock for each stub, then isolate and require.
    const routeDir = path.dirname(ROUTE_PATH);
    for (const [relPath, impl] of Object.entries(mockMap)) {
      if (!impl) continue;
      // Resolve to the absolute path as seen from the route module's directory
      const absPath = path.resolve(routeDir, relPath);
      jest.doMock(absPath, () => impl, { virtual: false });
    }
    let router;
    jest.isolateModules(() => {
      router = require('../analytics-routes.cjs');
    });
    return router;
  }

  // Node native test runner path: Module._load interception + require.cache
  delete require.cache[ROUTE_PATH];

  const injected = [];
  const routeDir = path.dirname(ROUTE_PATH);
  for (const [relPath, impl] of Object.entries(mockMap)) {
    if (!impl) continue;
    const absPath = path.resolve(routeDir, relPath);
    const candidates = new Set();
    candidates.add(absPath);
    candidates.add(absPath.replace(/\.cjs$/, ''));
    candidates.add(absPath + '.js');
    candidates.add(absPath + '.cjs');
    candidates.add(path.join(absPath, 'index.cjs'));
    try {
      const resolved = require.resolve(path.join(path.dirname(ROUTE_PATH), relPath));
      candidates.add(resolved);
    } catch (_) {}

    for (const cand of candidates) {
      if (!cand) continue;
      require.cache[cand] = {
        id: cand,
        filename: cand,
        loaded: true,
        exports: impl,
        children: [],
        paths: Module._nodeModulePaths(path.dirname(cand))
      };
      injected.push(cand);
    }
  }

  const origLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    try {
      if (parent && parent.filename && parent.filename.startsWith(routeDir)) {
        if (mockMap[request]) return mockMap[request];
        const simple = request.replace(/^(?:\.\/|\.\.|\/)+/, '');
        for (const rel of Object.keys(mockMap)) {
          if (rel.endsWith(simple) || rel.endsWith(request) || rel.indexOf(simple) !== -1) {
            return mockMap[rel];
          }
        }
      }
    } catch (e) {
      // swallow and fall back to original loader
    }
    return origLoad.apply(this, arguments);
  };

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const router = require('../analytics-routes.cjs');
  Module._load = origLoad;

  for (const id of injected) delete require.cache[id];
  return router;
}

function createTestApp(options) {
  options = options || {};
  const stubs = {
    'app-logger.cjs': {
      info() {},
      warn() {},
      error() {}
    },
    'auth.cjs': {
      authenticate: (req, res, next) => {
        if (options.denyAuth) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = options.authUser || { id: 'test-user', email: 'test@example.com' };
        next();
      },
      optionalAuthenticate: (req, res, next) => {
        if (options.authUser) req.user = options.authUser;
        next();
      }
    },
    'authorize.cjs': {
      authorize: () => (req, res, next) => next()
    },
    'validate-params.cjs': {
      validateParam: () => (req, res, next) => next(),
      VALIDATION_PATTERNS: {}
    },
    'usage-analytics-store.cjs': {
      getGlobalStats: () => ({}),
      getOrgSummary: () => ({}),
      getTrendData: () => [],
      getViolationHeatmap: () => ({}),
      getTopRepositories: () => [],
      getDistinctRepositories: () => [],
      getDistinctBranches: () => [],
      recordScan: () => ({ scanId: 'test', postureScore: 80 }),
      getPaginatedScans: () => ({ scans: [], total: 0 }),
      getViolations: () => ({ violations: [], total: 0 })
    },
    'ticket-status-store.cjs': {
      markTicketed: () => {},
      unmarkTicketed: () => {},
      getTicketStatuses: () => ({}),
      getTicketedCount: () => 0
    },
    'webhook-config-store.cjs': {
      getConfig: () => null,
      saveConfig: () => {},
      deleteConfig: () => {},
      getAllConfigs: () => []
    },
    'report-schedule-store.cjs': {
      getAllSchedules: () => [],
      saveSchedule: () => {},
      deleteSchedule: () => {},
      getSchedule: () => null
    },
    'report-scheduler.cjs': {
      setAnalyticsStore: () => {},
      startScheduler: () => {},
      stopScheduler: () => {},
      runSchedule: () => {}
    },
    'audit-logger.cjs': {
      log: () => {}
    },
    'response-helpers.cjs': {
      sendError: (res, code, msg, extra) => {
        res.status(code).json({ success: false, error: msg, ...extra });
        return res;
      },
      sendSuccess: (res, data) => {
        res.status(200).json({ success: true, ...data });
        return res;
      }
    },
    'siem-broker.cjs': function MockSiemBroker() {
      this.getClusterTelemetry = () => ({});
    }
  };

  const router = loadAnalyticsModule(stubs);
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', router);
  return app;
}

describe('Admin Dashboard Analytics API — /summary endpoint', () => {

  beforeEach(() => {
    delete process.env.TELEMETRY_SALT;
  });

  afterEach(() => {
    delete process.env.TELEMETRY_SALT;
  });

  it('should export an Express router', () => {
    const app = createTestApp();
    assert.strictEqual(typeof app, 'function', 'express app should be a function');
  });

  it('should return 400 Bad Request when project param is omitted', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error, 'should have an error message');
  });

  it('should return 200 with aggregated metrics when project is provided', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary?project=my-repo');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.projectSignature, 'should have projectSignature');
    assert.strictEqual(res.body.projectSignature.length, 16,
      'project signature should be 16 chars (truncated HMAC)');
    assert.strictEqual(res.body.queryWindowDays, 30, 'default days should be 30');

    const m = res.body.metrics;
    assert.ok(m, 'should have metrics object');
    assert.strictEqual(m.totalScans, 0, 'mock store returns empty records');
    assert.strictEqual(m.averageComplianceScore, 0);
    assert.strictEqual(m.currentGrade, 'F');
    assert.ok(m.timelineData, 'should have timeline data array');
    assert.ok(Array.isArray(m.timelineData));
  });

  it('should respect custom days query parameter', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary?project=test&days=7');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.queryWindowDays, 7);
  });

  it('should clamp days parameter to max 365', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary?project=test&days=9999');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.queryWindowDays, 365, 'should clamp to 365');
  });

  it('should clamp negative days to 1', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary?project=test&days=-5');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.queryWindowDays, 1, 'should clamp to 1');
  });

  it('should use default 30 days for invalid days value', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/analytics/summary?project=test&days=abc');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.queryWindowDays, 30, 'should default to 30');
  });

  it('should produce consistent project signatures for the same project name', async () => {
    const app = createTestApp();
    const res1 = await request(app).get('/api/analytics/summary?project=my-repo');
    const res2 = await request(app).get('/api/analytics/summary?project=my-repo');

    assert.strictEqual(res1.body.projectSignature, res2.body.projectSignature,
      'same project name should produce same signature');
  });

  it('should produce different signatures for different project names', async () => {
    const app = createTestApp();
    const res1 = await request(app).get('/api/analytics/summary?project=project-alpha');
    const res2 = await request(app).get('/api/analytics/summary?project=project-beta');

    assert.notStrictEqual(res1.body.projectSignature, res2.body.projectSignature,
      'different project names should produce different signatures');
  });

  it('should require authentication (401 when auth denied)', async () => {
    const app = createTestApp({ denyAuth: true });
    const res = await request(app).get('/api/analytics/summary?project=test');

    assert.strictEqual(res.status, 401);
  });
});
