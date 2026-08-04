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

describe('Track 115 lattice-vfhss REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE115-L2-01: full happy path OPEN -> SHARES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .send({})
      .expect(201);
    expect(init.body.success).toBe(true);
    expect(init.body.poolId).toBeDefined();
    expect(init.body.status).toBe('OPEN');
    const poolId = init.body.poolId;

    const shares = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('vfhss-share') })
      .expect(200);
    expect(shares.body.status).toBe('SHARES_COLLECTED');
    expect(shares.body.shareCount).toBe(8);

    const validate = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/validate`)
      .send({
        claim: {
          enclaveEvaluationAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { homomorphicDepth: 8 },
      })
      .expect(200);
    expect(validate.body.status).toBe('PROOF_VALIDATED');

    const accredit = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/accredit`)
      .expect(200);
    expect(accredit.body.status).toBe('ACCREDITED');
  });

  test('ROUTE115-L2-02: out-of-order accredit returns 400 with VFHSSGATE_INVALID_TRANSITION', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    const res = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/accredit`)
      .expect(400);
    expect(res.body.error).toMatch(/VFHSSGATE_INVALID_TRANSITION/);
  });

  test('ROUTE115-L2-03: insufficient shares returns 400 with VFHSSCLAIM_INSUFFICIENT_SHARES', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(3).fill('vfhss-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/validate`)
      .send({
        claim: {
          enclaveEvaluationAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { homomorphicDepth: 8 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VFHSSCLAIM_INSUFFICIENT_SHARES/);
  });

  test('ROUTE115-L2-04: homomorphic depth exceeded returns 400 with VFHSSCLAIM_HOMOMORPHIC_DEPTH_EXCEEDED', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('vfhss-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/validate`)
      .send({
        claim: {
          enclaveEvaluationAttestation: true,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { homomorphicDepth: 32 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VFHSSCLAIM_HOMOMORPHIC_DEPTH_EXCEEDED/);
  });

  test('ROUTE115-L2-05: missing enclave evaluation attestation returns 400 with VFHSSCLAIM_UNATTESTED_EVALUATION', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('vfhss-share') })
      .expect(200);

    const res = await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/validate`)
      .send({
        claim: {
          enclaveEvaluationAttestation: false,
          attestationAuthority: 'mock-authority',
          latticeScheme: 'module-lwr',
          canonicalPayloadLayout: true,
        },
        manifest: { homomorphicDepth: 8 },
      })
      .expect(400);
    expect(res.body.error).toMatch(/VFHSSCLAIM_UNATTESTED_EVALUATION/);
  });

  test('ROUTE115-L2-06: telemetry endpoint never emits raw share tokens or polynomial data', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('secret-vfhss-share-token') })
      .expect(200);

    const res = await request(app)
      .get('/api/vault/lattice-vfhss/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    expect(res.body.telemetry.hsm_vfhssgate_pool_initialized_total).toBeGreaterThanOrEqual(1);
    // No raw share material should appear in telemetry
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret-vfhss-share-token');
  });

  test('ROUTE115-L3-01: unknown poolId on /shares returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/lattice-vfhss/nonexistent/shares')
      .send({ shares: [] })
      .expect(404);
    expect(res.body.error).toMatch(/lattice_vfhss_pool_not_found/);
  });

  test('ROUTE115-L3-02: unknown poolId on /accredit returns 404', async () => {
    const res = await request(app)
      .post('/api/vault/lattice-vfhss/nonexistent/accredit')
      .expect(404);
    expect(res.body.error).toMatch(/lattice_vfhss_pool_not_found/);
  });

  test('ROUTE115-L3-03: GET pool status returns state and count (no raw shares)', async () => {
    const init = await request(app)
      .post('/api/vault/lattice-vfhss/pool')
      .expect(201);
    const poolId = init.body.poolId;

    await request(app)
      .post(`/api/vault/lattice-vfhss/${poolId}/shares`)
      .send({ shares: new Array(8).fill('classified-vfhss-share') })
      .expect(200);

    const res = await request(app)
      .get(`/api/vault/lattice-vfhss/${poolId}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('SHARES_COLLECTED');
    expect(res.body.shareCount).toBe(8);
    // No raw share material should appear in status
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('classified-vfhss-share');
  });
});
