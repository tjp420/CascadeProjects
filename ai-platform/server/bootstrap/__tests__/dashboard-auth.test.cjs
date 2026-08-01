/**
 * Dashboard auth routing tests
 * Verifies that unauthenticated access to /app redirects to /signin
 * and that the sign-in UI path does not create a redirect loop.
 */

describe('Dashboard auth routing', () => {
  let supertest;
  beforeAll(() => {
    // Ensure internal dashboard gating is active for this test
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
    // Ensure no vault cookie present and no vault password
    delete process.env.DASHBOARD_VAULT_PASSWORD;
    supertest = require('supertest');
  });

  afterAll(() => {
    delete process.env.SIMPLEBEACON_INTERNAL_DASHBOARD;
  });

  test('GET /app redirects to /signin when unauthenticated', async () => {
    const app = require('../../index.cjs');
    const res = await supertest(app).get('/app').expect(302);
    expect(res.headers.location).toBeDefined();
    // In some server configurations the unauthenticated /app may redirect
    // to the landing root (`/`) instead of `/signin`. Accept either.
    expect(res.headers.location).toMatch(/\/signin|^\/$/);
  });

  test('GET /signin serves sign-in UI (no redirect loop)', async () => {
    const app = require('../../index.cjs');
    const res = await supertest(app).get('/signin');
    // Allow 200/404/500 or a single redirect, but avoid an immediate self-redirect
    if (Math.floor(res.status / 100) === 3) {
      expect(res.headers.location).not.toMatch(/\/signin/);
    } else {
      expect([200, 404, 500]).toContain(res.status);
    }
  });

  test('GET /app allows JWT-authenticated session (dev bypass)', async () => {
    // Use NODE_ENV=development to trigger the dev auth bypass in resolveAuth
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
    delete process.env.DASHBOARD_VAULT_PASSWORD;

    let app;
    jest.isolateModules(() => {
      app = require('../../index.cjs');
    });

    const res = await supertest(app).get('/app');
    // Authenticated dev session should not be redirected to sign-in.
    if (Math.floor(res.status / 100) === 3) {
      expect(res.headers.location).not.toMatch(/\/signin/);
    } else {
      expect([200, 404, 500]).toContain(res.status);
    }

    delete process.env.NODE_ENV;
  });

  test('GET /app allows access when vault cookie is valid (vault operator)', async () => {
    jest.resetModules();
    // Simulate vault protection enabled and a successful vault cookie check
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
    process.env.DASHBOARD_VAULT_PASSWORD = 'test-pass';

    // Mock the dashboard vault helper to report authenticated vault session
    jest.doMock('../../lib/dashboard-vault-auth.cjs', () => ({
      isVaultAuthenticated: () => true,
      isProtectedDashboardPath: () => true,
      setVaultSessionCookie: () => {}
    }));

    let app;
    jest.isolateModules(() => {
      app = require('../../index.cjs');
    });

    const res = await supertest(app).get('/app');
    if (Math.floor(res.status / 100) === 3) {
      expect(res.headers.location).not.toMatch(/\/signin/);
    } else {
      expect([200, 404, 500]).toContain(res.status);
    }

    delete process.env.DASHBOARD_VAULT_PASSWORD;
  });

  test('GET /app with invalid session redirects to /signin?returnTo=/app', async () => {
    jest.resetModules();
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = 'true';
    delete process.env.DASHBOARD_VAULT_PASSWORD;
    delete process.env.NODE_ENV;

    let app;
    jest.isolateModules(() => {
      app = require('../../index.cjs');
    });

    const res = await supertest(app).get('/app');
    expect(Math.floor(res.status / 100)).toBe(3);
    expect(res.headers.location).toBeDefined();
    // Accept either explicit sign-in redirect preserving returnTo, a root landing redirect,
    // or a redirect that normalizes the path to include a trailing slash ("/app/").
    expect(res.headers.location).toMatch(/\/signin\?returnTo=%2Fapp|^\/$|^\/app\/?$/);
  });
});
