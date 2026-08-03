'use strict';

/**
 * Tests for Track 108 space-based laser communication mesh gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/space-based-laser-mesh/policy
 *   - POST /api/vault/space-based-laser-mesh/policy/validate
 *   - GET  /api/vault/space-based-laser-mesh/telemetry
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

describe('Track 108 Space-Based Laser Communication Mesh Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/space-based-laser-mesh/policy returns Track 108 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/space-based-laser-mesh/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minLaserMeshQuorum: 16,
      maxHandoffWindowSeconds: 300,
      maxLaserMeshChainDepth: 40,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireLaserMeshAuthorityInitializerAttestation: true,
      requireLaserEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderLaserMeshClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/space-based-laser-mesh/policy/validate')
      .send({
        laserMeshQuorum: 16,
        handoffWindowSeconds: 300,
        laserMeshChainDepth: 40,
        pqcSignatureScheme: 'ML-DSA-65',
        laserMeshAuthorityInitializerAttestation: true,
        laserEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderLaserMeshClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for laserMeshQuorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/space-based-laser-mesh/policy/validate')
      .send({
        laserMeshQuorum: 5,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/laser mesh quorum/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/space-based-laser-mesh/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/space-based-laser-mesh/telemetry returns Track 108 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_lasergate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_laser_mesh_claim_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_handoff_accreditation_completed_total', 2);

    const res = await request(app).get('/api/vault/space-based-laser-mesh/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_lasergate_pool_initialized_total: 3,
      hsm_zk_laser_mesh_claim_verified_total: 7,
      hsm_handoff_accreditation_completed_total: 2,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/space-based-laser-mesh/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
