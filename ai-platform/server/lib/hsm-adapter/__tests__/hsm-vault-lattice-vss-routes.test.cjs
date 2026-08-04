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

describe('Track 114 lattice-vss REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE114-L2-01: full happy path OPEN -> SHARES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .send({})
      .expect(201);
    expect(init.body.success).toBe(true);
    expect(init.body.poolId).toBeDefined();
    expect(init.body.status).toBe('OPEN');
    const poolId = init.body.poolId;

    const shares = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('lattice-share') })
      .expect(200);
    expect(shares.body.status).toBe('SHARES_COLLECTED');
    expect(shares.body.shareCount).toBe(8);

    const validate = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/validate`)
      .send({
        claim: {
          enclaveBindingAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { degreeBound: 8 },
      })
      .expect(200);
    expect(validate.body.status).toBe('PROOF_VALIDATED');

    const accredit = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/accredit`)
      .expect(200);
    expect(accredit.body.status).toBe('ACCREDITED');
  });

  test('ROUTE114-L2-02: out-of-order accredit returns 400 with VSSGATE_INVALID_TRANSITION', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    const res = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/accredit`)
      .expect(400);
    expect(res.body.error).toMatch(/VSSGATE_INVALID_TRANSITION/);
  });

  test('ROUTE114-L2-03: insufficient shares returns 400 with VSSCLAIM_INSUFFICIENT_SHARES', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/shares`)
      .send({ shares: new Array(3).fill('lattice-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/validate`)
      .send({
        claim: {
          enclaveBindingAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { degreeBound: 8 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VSSCLAIM_INSUFFICIENT_SHARES/);
  });

  test('ROUTE114-L2-04: degree bound exceeded returns 400 with VSSCLAIM_DEGREE_BOUND_EXCEEDED', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('lattice-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/validate`)
      .send({
        claim: {
          enclaveBindingAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { degreeBound: 32 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VSSCLAIM_DEGREE_BOUND_EXCEEDED/);
  });

  test('ROUTE114-L2-05: missing enclave binding attestation returns 400 with VSSCLAIM_UNATTESTED_BINDING', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('lattice-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/validate`)
      .send({
        claim: {
          enclaveBindingAttestation: false,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { degreeBound: 8 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VSSCLAIM_UNATTESTED_BINDING/);
  });

  test('ROUTE114-L2-06: telemetry endpoint never emits raw share tokens or polynomial data', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('secret-lattice-share-token') })
      .expect(200);

    const res = await request(app)
      .get('/api/vault/lattice-vss/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    expect(res.body.telemetry.hsm_vssgate_pool_initialized_total).toBeGreaterThanOrEqual(1);
    // No raw share material should appear in telemetry
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret-lattice-share-token');
  });

  test('ROUTE114-L3-01: unknown poolId on /shares returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/lattice-vss/nonexistent/shares')
      .send({ shares: [] })
      .expect(404);
    expect(res.body.error).toMatch(/lattice_vss_pool_not_found/);
  });

  test('ROUTE114-L3-02: unknown poolId on /accredit returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/lattice-vss/nonexistent/accredit')
      .expect(404);
    expect(res.body.error).toMatch(/lattice_vss_pool_not_found/);
  });
});
