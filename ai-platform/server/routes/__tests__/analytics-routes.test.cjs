'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');

const ROUTE_PATH = require.resolve('../analytics-routes.cjs');

/**
 * Load the analytics-routes module with stubbed dependencies so we don't
 * pull in the full auth middleware stack, SIEM broker, or persistent stores.
 */
function loadAnalyticsModule(stubs) {
  delete require.cache[ROUTE_PATH];
  const originalLoad = Module._load;
  Module._load = function patchedLoad(requestPath, parent, isMain) {
    // Match by basename to handle relative path variations
    const basename = requestPath.split('/').pop();
    for (const key of Object.keys(stubs)) {
      const stubBasename = key.split('/').pop();
      if (stubBasename === basename) return stubs[key];
    }
    return originalLoad.call(this, requestPath, parent, isMain);
  };
  try {
    return require('../analytics-routes.cjs');
  } finally {
    Module._load = originalLoad;
  }
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
