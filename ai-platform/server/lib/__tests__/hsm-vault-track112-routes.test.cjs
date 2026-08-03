'use strict';

const express = require('express');
const request = require('supertest');

// Mock authorize so we can simulate admin vs non-admin
jest.mock('../../middleware/authorize.cjs', () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      const perms = (req.user && req.user.permissions) || [];
      if (perms.includes(permission)) return next();
      return res.status(403).json({ success: false, error: 'insufficient_permissions', required: permission });
    };
  },
}));

// Reuse sendError behavior from app helpers so responses match
const router = require('../../routes/track112-routes.cjs');
const hsmMetrics = require('../../lib/hsm-adapter/hsm-metrics.cjs');

function buildApp(user) {
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/track112', router);
  return app;
}

describe('Track112 routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });
  test('GET /api/track112/health returns 200', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/api/track112/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/track112/ingest rejects payloads exceeding size limit', async () => {
    const app = buildApp(null);
    const big = 'x'.repeat(64 * 1024 + 10);
    const res = await request(app)
      .post('/api/track112/ingest')
      .send({ payload: big })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('payload_too_large');
  });

  test('POST /api/track112/scan requires admin permissions', async () => {
    const app = buildApp({ id: 'user1', permissions: [] });
    const res = await request(app).post('/api/track112/scan').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });

  test('POST /api/track112/scan allows admin', async () => {
    const app = buildApp({ id: 'admin1', permissions: ['admin:all'] });
    const res = await request(app).post('/api/track112/scan').send({});
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBeDefined();
  });

  test('ingest/scan/proof increment their respective hsm metrics', async () => {
    // Ingest (public)
    const appPublic = buildApp(null);
    const small = { foo: 'bar' };
    const r1 = await request(appPublic).post('/api/track112/ingest').send({ payload: small });
    expect(r1.status).toBe(200);

    // Scan (admin)
    const appAdmin = buildApp({ id: 'admin1', permissions: ['admin:all'] });
    const r2 = await request(appAdmin).post('/api/track112/scan').send({});
    expect(r2.status).toBe(200);

    // Proof (admin)
    const r3 = await request(appAdmin).post('/api/track112/proof').send({ proof: { ok: true } });
    expect(r3.status).toBe(200);

    // Now fetch metrics and assert counters are 1
    const m = await request(appAdmin).get('/api/track112/metrics');
    expect(m.status).toBe(200);
    expect(m.body.metrics.hsm_track112_ingest_total).toBe(1);
    expect(m.body.metrics.hsm_track112_scans_initiated_total).toBe(1);
    expect(m.body.metrics.hsm_track112_proofs_verified_total).toBe(1);
  });
});
