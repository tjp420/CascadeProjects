'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../../../middleware/authorize.cjs', () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock('../../../lib/admin-throttle.cjs', () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock('../../../lib/hsm-vault.cjs', () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

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

describe('Track 32 ring-gating REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE32-L2-01: full happy path OPEN -> KEYS_COLLECTED -> PROOF_VALIDATED -> ACCREDITED', async () => {
    const init = await request(app)
      .post('/api/vault/ring-gating/pool')
      .send({})
      .expect(201);
    expect(init.body.success).toBe(true);
    expect(init.body.poolId).toBeDefined();
    expect(init.body.status).toBe('OPEN');
    const poolId = init.body.poolId;

    const keys = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/keys`)
      .send({ anonymitySet: new Array(32).fill('pubkey-') })
      .expect(200);
    expect(keys.body.status).toBe('KEYS_COLLECTED');
    expect(keys.body.ringSize).toBe(32);

    const validate = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/validate`)
      .send({
        claim: {},
        linkabilityToken: 'token-abc',
        blindedLinkabilityAttestation: true,
      })
      .expect(200);
    expect(validate.body.status).toBe('PROOF_VALIDATED');

    const accredit = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/accredit`)
      .expect(200);
    expect(accredit.body.status).toBe('ACCREDITED');
  });

  test('ROUTE32-L2-02: out-of-order accredit returns 400 with RINGGATE_INVALID_TRANSITION', async () => {
    const init = await request(app)
      .post('/api/vault/ring-gating/pool')
      .expect(201);
    const poolId = init.body.poolId;

    const res = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/accredit`)
      .expect(400);
    expect(res.body.error).toMatch(/RINGGATE_INVALID_TRANSITION/);
  });

  test('ROUTE32-L2-03: ring size below minimum returns 400 with RINGCLAIM_INVALID_ANONYMITY_SET_SIZE', async () => {
    const init = await request(app)
      .post('/api/vault/ring-gating/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/ring-gating/${poolId}/keys`)
      .send({ anonymitySet: new Array(8).fill('pubkey-') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/validate`)
      .send({
        claim: {},
        linkabilityToken: 'token-abc',
        blindedLinkabilityAttestation: true,
      })
      .expect(400);
    expect(res.body.error).toMatch(/RINGCLAIM_INVALID_ANONYMITY_SET_SIZE/);
  });

  test('ROUTE32-L2-04: missing linkability attestation returns 400 with RINGCLAIM_UNATTESTED_LINKABILITY', async () => {
    const init = await request(app)
      .post('/api/vault/ring-gating/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/ring-gating/${poolId}/keys`)
      .send({ anonymitySet: new Array(32).fill('pubkey-') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/ring-gating/${poolId}/validate`)
      .send({
        claim: {},
        blindedLinkabilityAttestation: false,
      })
      .expect(400);
    expect(res.body.error).toMatch(/RINGCLAIM_UNATTESTED_LINKABILITY/);
  });

  test('ROUTE32-L2-05: telemetry endpoint never emits raw keys or tokens', async () => {
    const init = await request(app)
      .post('/api/vault/ring-gating/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/ring-gating/${poolId}/keys`)
      .send({ anonymitySet: new Array(32).fill('secret-pubkey-') })
      .expect(200);

    const res = await request(app)
      .get('/api/vault/ring-gating/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    expect(res.body.telemetry.hsm_ringgate_pool_initialized_total).toBeGreaterThanOrEqual(1);
    // No raw key material should appear in telemetry
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret-pubkey-');
    expect(body).not.toContain('linkabilityToken');
  });

  test('ROUTE32-L3-01: unknown poolId on /keys returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/ring-gating/nonexistent/keys')
      .send({ anonymitySet: [] })
      .expect(404);
    expect(res.body.error).toMatch(/ring_pool_not_found/);
  });

  test('ROUTE32-L3-02: unknown poolId on /accredit returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/ring-gating/nonexistent/accredit')
      .expect(404);
    expect(res.body.error).toMatch(/ring_pool_not_found/);
  });
});
