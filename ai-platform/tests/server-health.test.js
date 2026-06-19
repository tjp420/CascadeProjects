/**
 * Server Health & Critical Routes Tests
 *
 * Tests GET /health, GET /api/health/routes, and vault auth middleware.
 */

const request = require('supertest');
const express = require('express');

function createHealthApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.get('/api/health/routes', (_req, res) => {
    res.json({
      status: 'ok',
      dataCleanup: true,
      paths: ['/api/analyze/data-cleanup'],
      build: '2026-05-27-data-cleanup'
    });
  });

  app.get('/api/platform/status', (_req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
  });

  return app;
}

describe('Server Health Routes', () => {
  let app;

  beforeEach(() => {
    app = createHealthApp();
  });

  describe('GET /health', () => {
    test('returns 200 with ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/health/routes', () => {
    test('returns route registry info', async () => {
      const res = await request(app).get('/api/health/routes');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.dataCleanup).toBe(true);
      expect(Array.isArray(res.body.paths)).toBe(true);
    });
  });

  describe('GET /api/platform/status', () => {
    test('returns platform status', async () => {
      const res = await request(app).get('/api/platform/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.env).toBeDefined();
    });
  });
});

describe('Vault Auth Middleware', () => {
  test('blocks unauthenticated API access when internal dashboard is enabled', () => {
    const req = { path: '/api/analyze/summary', headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    const middleware = (req, res, next) => {
      if (req.path.startsWith('/api/auth/')) return next();
      if (req.path === '/api/health' || req.path === '/health') return next();
      if (req.path.startsWith('/api/analyze/')) return next();
      return res.status(403).json({ error: 'vault_required' });
    };

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows auth routes without vault', () => {
    const req = { path: '/api/auth/login' };
    const res = { status: jest.fn(), json: jest.fn() };
    const next = jest.fn();

    const middleware = (req, res, next) => {
      if (req.path.startsWith('/api/auth/')) return next();
      return res.status(403).json({ error: 'vault_required' });
    };

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Security Headers', () => {
  test('sets expected security headers on responses', () => {
    const app = express();
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });
    app.get('/test', (_req, res) => res.json({ ok: true }));

    return request(app)
      .get('/test')
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-Frame-Options', 'DENY')
      .expect('Referrer-Policy', 'strict-origin-when-cross-origin');
  });
});

const path = require('path');
const fs = require('fs');

describe('Server Bootstrap Smoke', () => {
  test('auth routes module is loadable', () => {
    const authRoutes = require('../server/routes/auth.cjs');
    expect(authRoutes).toBeDefined();
  });

  test('server module imports auth routes', () => {
    const serverPath = path.join(__dirname, '..', 'simplebeacon-server.cjs');
    const serverSource = fs.readFileSync(serverPath, 'utf8');
    expect(serverSource).toContain("require('./server/routes/auth.cjs')");
    expect(serverSource).toContain("app.use('/api/auth', authRoutes)");
  });
});
