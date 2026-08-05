'use strict';

/**
 * Unit tests for Tenant Network Isolation Middleware
 *
 * Verifies that the middleware correctly:
 * - Extracts tenantId from various request sources
 * - Validates against an allowlist
 * - Rejects missing/unknown tenants with 403
 * - Enforces per-tenant rate limiting
 * - Bypasses health endpoints and public routes
 * - Allows admin bypass for authorized users
 * - Logs violations to SIEM hook
 */

const express = require('express');
const request = require('supertest');
const { createTenantNetworkIsolation } = require('../middleware/tenant-network-isolation.cjs');

function createTestApp(options = {}) {
  const app = express();
  app.use(express.json());
  const siemEvents = [];
  const middleware = createTenantNetworkIsolation({
    allowedTenants: options.allowedTenants || ['tenant-a', 'tenant-b'],
    siemHook: (event) => siemEvents.push(event),
    adminCheck: options.adminCheck || ((req) => req.user?.permissions?.includes('admin:all')),
    tenantRateLimit: options.tenantRateLimit || 5,
    rateLimitWindowMs: options.rateLimitWindowMs || 60000,
    bypassPaths: options.bypassPaths,
  });
  app.use(middleware);
  app.use((req, res) => {
    res.json({ success: true, tenantId: req.tenantId, scope: req.tenantNetworkScope });
  });
  return { app, siemEvents };
}

describe('Tenant Network Isolation Middleware', () => {
  test('TENANT-NET-01: extracts tenantId from header', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res.body.tenantId).toBe('tenant-a');
    expect(res.body.scope).toBe('tenant');
  });

  test('TENANT-NET-01b: extracts tenantId from query param', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/data?orgId=tenant-b').expect(200);
    expect(res.body.tenantId).toBe('tenant-b');
  });

  test('TENANT-NET-01c: extracts tenantId from body', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/data').send({ orgId: 'tenant-a' }).expect(200);
    expect(res.body.tenantId).toBe('tenant-a');
  });

  test('TENANT-NET-02: validates tenantId against allowlist', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res.body.tenantId).toBe('tenant-a');
  });

  test('TENANT-NET-03: rejects missing tenantId with 403', async () => {
    const { app, siemEvents } = createTestApp();
    const res = await request(app).get('/api/data').expect(403);
    expect(res.body.error).toBe('TENANT_NETWORK_ISOLATION_VIOLATION');
    expect(siemEvents.length).toBe(1);
    expect(siemEvents[0].siemCategory).toBe('TENANT_NETWORK_ISOLATION_VIOLATION');
    expect(siemEvents[0].context.reason).toBe('missing_tenant_id');
  });

  test('TENANT-NET-03b: rejects unknown tenantId with 403', async () => {
    const { app, siemEvents } = createTestApp();
    const res = await request(app).get('/api/data').set('x-tenant-id', 'unknown-tenant').expect(403);
    expect(res.body.error).toBe('TENANT_NETWORK_ISOLATION_VIOLATION');
    expect(siemEvents.length).toBe(1);
    expect(siemEvents[0].context.reason).toBe('unknown_tenant');
    expect(siemEvents[0].context.tenantId).toBe('unknown-tenant');
  });

  test('TENANT-NET-04: attaches req.tenantId and req.tenantNetworkScope', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res.body.tenantId).toBe('tenant-a');
    expect(res.body.scope).toBe('tenant');
  });

  test('TENANT-NET-05: logs isolation violations to SIEM with tenant context', async () => {
    const { app, siemEvents } = createTestApp();
    await request(app).get('/api/data').set('x-tenant-id', 'evil-tenant');
    expect(siemEvents.length).toBe(1);
    expect(siemEvents[0].siemSeverity).toBe('HIGH');
    expect(siemEvents[0].context.tenantId).toBe('evil-tenant');
    expect(siemEvents[0].context.method).toBe('GET');
    expect(siemEvents[0].context.path).toBe('/api/data');
  });

  test('TENANT-NET-06: per-tenant rate limiting returns 429', async () => {
    const { app, siemEvents } = createTestApp({ tenantRateLimit: 2 });
    // First 2 requests pass
    await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    // Third request hits rate limit
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(429);
    expect(res.body.error).toBe('TENANT_RATE_LIMIT_EXCEEDED');
    expect(res.body.tenantId).toBe('tenant-a');
    expect(siemEvents.length).toBe(1);
    expect(siemEvents[0].context.reason).toBe('tenant_rate_limit_exceeded');
  });

  test('TENANT-NET-06b: per-tenant rate limits are independent', async () => {
    const { app } = createTestApp({ tenantRateLimit: 2 });
    // Exhaust tenant-a
    await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(429);
    // tenant-b should still work
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-b').expect(200);
    expect(res.body.tenantId).toBe('tenant-b');
  });

  test('TENANT-NET-07: bypasses health endpoints', async () => {
    const { app } = createTestApp();
    await request(app).get('/health').expect(200);
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/status').expect(200);
  });

  test('TENANT-NET-07b: bypasses root and dashboard paths', async () => {
    const { app } = createTestApp();
    await request(app).get('/').expect(200);
    await request(app).get('/dashboard').expect(200);
  });

  test('TENANT-NET-08: admin bypass skips rate limit', async () => {
    const app = express();
    app.use(express.json());
    // Simulate authenticated admin user
    app.use((req, res, next) => { req.user = { permissions: ['admin:all'] }; next(); });
    const siemEvents = [];
    app.use(createTenantNetworkIsolation({
      allowedTenants: ['tenant-a', 'tenant-b'],
      siemHook: (e) => siemEvents.push(e),
      adminCheck: (req) => req.user?.permissions?.includes('admin:all'),
      tenantRateLimit: 1,
    }));
    app.use((req, res) => res.json({ tenantId: req.tenantId, scope: req.tenantNetworkScope }));
    // First request as admin
    const res1 = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res1.body.scope).toBe('admin');
    // Second request as admin should still pass (no rate limit)
    const res2 = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res2.body.scope).toBe('admin');
  });

  test('TENANT-NET-08b: admin bypass still attaches tenantId', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = { permissions: ['admin:all'] }; next(); });
    app.use(createTenantNetworkIsolation({
      allowedTenants: ['tenant-a', 'tenant-b'],
      adminCheck: (req) => req.user?.permissions?.includes('admin:all'),
    }));
    app.use((req, res) => res.json({ tenantId: req.tenantId, scope: req.tenantNetworkScope }));
    const res = await request(app).get('/api/data').set('x-tenant-id', 'tenant-a').expect(200);
    expect(res.body.tenantId).toBe('tenant-a');
    expect(res.body.scope).toBe('admin');
  });

  test('TENANT-NET-09: empty string tenantId is rejected', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/data').set('x-tenant-id', '   ').expect(403);
    expect(res.body.error).toBe('TENANT_NETWORK_ISOLATION_VIOLATION');
  });

  test('TENANT-NET-10: no allowlist configured allows all non-empty tenants', async () => {
    const app = express();
    app.use(express.json());
    app.use(createTenantNetworkIsolation({}));
    app.use((req, res) => res.json({ tenantId: req.tenantId }));
    const res = await request(app).get('/api/data').set('x-tenant-id', 'any-tenant').expect(200);
    expect(res.body.tenantId).toBe('any-tenant');
  });

  test('TENANT-NET-11: custom bypass paths work', async () => {
    const { app } = createTestApp({ bypassPaths: ['/custom-health'] });
    await request(app).get('/custom-health').expect(200);
    // Default bypass paths should no longer work
    await request(app).get('/health').expect(403);
  });
});
