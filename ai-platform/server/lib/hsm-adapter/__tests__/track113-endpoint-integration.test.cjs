'use strict';

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

jest.mock('../../../middleware/authorize.cjs', () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock('../../../lib/admin-throttle.cjs', () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock('../../../lib/hsm-vault.cjs', () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

// Use an isolated base directory for session files to avoid pollution
process.env.NODE_ENV = 'test';
process.env.RATCHET_SESSIONS_DIR = path.join(__dirname, '..', '..', '..', '.data', 'ratchet-sessions-track113-test');
process.env.TRACK113_KEK = 'test-kek-track113-00000000000000000000000000';

const SessionStore = require('../../../lib/crypto/ratchet/session-store.cjs');

function createTestApp() {
  const app = express();
  app.use(express.json());
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith('/server/routes/hsm-vault-routes.cjs')) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require('../../../routes/hsm-vault-routes.cjs');
  app.use('/api/vault', vaultRoutes);
  return app;
}

describe('Track 113 handshake endpoint integration', () => {
  let app;

  beforeEach(() => {
    SessionStore.clear();
    app = createTestApp();
  });

  afterAll(() => {
    SessionStore.stopPurger();
  });

  test('POST /api/vault/handshake/init creates encrypted session', async () => {
    const res = await request(app)
      .post('/api/vault/handshake/init')
      .send({ clientId: 'client-a', handshakeDigest: 'track113-digest-001', lifecycleTimeout: 60000 })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.status).toBe('INITIALIZED');
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());

    const record = SessionStore.get(res.body.sessionId);
    const baseDir = process.env.RATCHET_SESSIONS_DIR;
    const p = path.join(baseDir, record.tenantId || 'default', `${record.sessionId}.json`);
    const raw = fs.readFileSync(p, 'utf8');
    expect(raw).not.toContain('track113-digest-001');
    expect(raw).toContain('handshakeDigestEncrypted');
  });

  test('POST /api/vault/handshake/verify authenticates valid proof', async () => {
    const init = await request(app)
      .post('/api/vault/handshake/init')
      .send({ clientId: 'client-a', handshakeDigest: 'track113-digest-002' });
    const sessionId = init.body.sessionId;

    const expected = require('crypto').createHmac('sha256', sessionId).update('track113-proof-challenge').digest('hex');
    const res = await request(app)
      .post('/api/vault/handshake/verify')
      .send({ sessionId, clientProof: expected, expectedStateDigest: 'any-digest' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.authenticatedAt).toBeGreaterThan(0);
  });

  test('POST /api/vault/handshake/verify fails with missing session', async () => {
    const res = await request(app)
      .post('/api/vault/handshake/verify')
      .send({ sessionId: 'dead-beef', clientProof: 'x', expectedStateDigest: 'y' })
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/vault/handshake/verify fails with invalid proof', async () => {
    const init = await request(app)
      .post('/api/vault/handshake/init')
      .send({ clientId: 'client-a', handshakeDigest: 'track113-digest-003' });
    const res = await request(app)
      .post('/api/vault/handshake/verify')
      .send({ sessionId: init.body.sessionId, clientProof: 'wrong-proof', expectedStateDigest: 'z' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/vault/handshake/:sessionId/telemetry never exposes handshakeDigest', async () => {
    const init = await request(app)
      .post('/api/vault/handshake/init')
      .send({ clientId: 'client-a', handshakeDigest: 'track113-digest-004' });
    const res = await request(app)
      .get(`/api/vault/handshake/${init.body.sessionId}/telemetry`)
      .expect(200);
    expect(res.body).not.toHaveProperty('handshakeDigest');
    expect(res.body.status).toBe('INITIALIZED');
  });

  test('POST /api/vault/handshake/init rejects missing parameters', async () => {
    const res = await request(app)
      .post('/api/vault/handshake/init')
      .send({})
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});
