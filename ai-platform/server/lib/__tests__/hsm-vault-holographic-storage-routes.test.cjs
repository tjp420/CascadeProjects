'use strict';

/**
 * Tests for Track 110 holographic storage content-addressable gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/holographic-storage/policy
 *   - POST /api/vault/holographic-storage/policy/validate
 *   - GET  /api/vault/holographic-storage/telemetry
 */

const express = require('express');
const request = require('supertest');

// Mock authorize so we can control admin access
jest.mock('../../middleware/authorize.cjs', () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      const perms = (req.user && req.user.permissions) || [];
      if (perms.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        required: permission,
      });
    };
  },
}));

// Mock admin-throttle to pass through
jest.mock('../../lib/admin-throttle.cjs', () => ({
  middleware: function (req, res, next) { next(); },
}));

// Mock hsm-vault to avoid requiring real HSM infrastructure
jest.mock('../../lib/hsm-vault.cjs', () => ({
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  getHsmVersions: jest.fn().mockReturnValue({ primary: 'test', secondary: 'test' }),
}));

const hsmMetrics = require('../../lib/hsm-adapter/hsm-metrics.cjs');

function buildApp(user) {
  const app = express();
  const router = require('../../routes/hsm-vault-routes.cjs');
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/api/vault', router);
  return app;
}

describe('Track 110 Holographic Storage Content-Addressable Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/holographic-storage/policy returns Track 110 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/holographic-storage/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minHolographicQuorum: 20,
      maxPhaseValidationWindowSeconds: 10,
      maxVolumetricChainDepth: 50,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireHolographicStorageAuthorityInitializerAttestation: true,
      requireHolographicEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderHolographicClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/holographic-storage/policy/validate')
      .send({
        holographicQuorum: 20,
        phaseValidationWindowSeconds: 10,
        volumetricChainDepth: 50,
        pqcSignatureScheme: 'ML-DSA-65',
        holographicStorageAuthorityInitializerAttestation: true,
        holographicEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderHolographicClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for holographicQuorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/holographic-storage/policy/validate')
      .send({
        holographicQuorum: 5,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/holographic quorum/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/holographic-storage/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/holographic-storage/telemetry returns Track 110 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_hologate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_holographic_claim_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_phase_accreditation_completed_total', 2);

    const res = await request(app).get('/api/vault/holographic-storage/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_hologate_pool_initialized_total: 3,
      hsm_zk_holographic_claim_verified_total: 7,
      hsm_phase_accreditation_completed_total: 2,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/holographic-storage/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
