/**
 * Auth routes tests — server/routes/auth.cjs
 *
 * Covers POST /login, POST /logout, POST /refresh, GET /me.
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('../server/routes/auth.cjs');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });
  return app;
}

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    process.env.SIMPLEBEACON_ADMIN_EMAILS = 'admin@example.com';
    process.env.SIMPLEBEACON_EMERGENCY_EMAIL = 'admin@example.com';
    process.env.SIMPLEBEACON_EMERGENCY_PASSWORD = 'any';
  });

  describe('POST /api/auth/login', () => {
    test('returns token and user for valid admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'any' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.trustLevel).toBe('gold');
      expect(res.body.user.email).toBe('admin@example.com');
    });

    test('returns token and bronze user for non-admin credentials', async () => {
      process.env.SIMPLEBEACON_EMERGENCY_EMAIL = 'user@example.com';
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'any' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('user@example.com');
    });

    test('rejects missing email or password with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: '', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    test('returns success when unauthenticated', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('returns new token for authenticated user', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'any' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.token).not.toBe(token);
    });

    test('returns 401 without token when unauthenticated', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns user info for authenticated request', async () => {
      process.env.SIMPLEBEACON_EMERGENCY_EMAIL = 'user@example.com';
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'any' });
      const token = loginRes.body.token;

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user@example.com');
    });

    test('returns guest user when unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe('guest');
    });
  });
});
