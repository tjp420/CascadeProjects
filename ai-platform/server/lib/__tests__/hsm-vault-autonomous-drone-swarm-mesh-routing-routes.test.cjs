'use strict';

/**
 * Tests for Track 113 autonomous drone swarm mesh-routing gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/autonomous-drone-swarm-mesh-routing/policy
 *   - POST /api/vault/autonomous-drone-swarm-mesh-routing/policy/validate
 *   - GET  /api/vault/autonomous-drone-swarm-mesh-routing/telemetry
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

describe('Track 113 Autonomous Drone Swarm Mesh-Routing Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/autonomous-drone-swarm-mesh-routing/policy returns Track 113 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/autonomous-drone-swarm-mesh-routing/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minSwarmQuorum: 32,
      maxTrajectoryValidationWindowSeconds: 5,
      maxSwarmTopologicalChainDepth: 72,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireDroneMeshAuthorityInitializerAttestation: true,
      requireSwarmEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderDroneMeshClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/autonomous-drone-swarm-mesh-routing/policy/validate')
      .send({
        swarmQuorum: 32,
        trajectoryValidationWindowSeconds: 5,
        swarmTopologicalChainDepth: 72,
        pqcSignatureScheme: 'ML-DSA-65',
        droneMeshAuthorityInitializerAttestation: true,
        swarmEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderDroneMeshClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for swarm quorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/autonomous-drone-swarm-mesh-routing/policy/validate')
      .send({
        swarmQuorum: 5,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/swarm quorum/);
  });

  test('POST .../validate returns 400 for trajectory window exceeding 5 seconds', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/autonomous-drone-swarm-mesh-routing/policy/validate')
      .send({
        trajectoryValidationWindowSeconds: 6,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/trajectory validation window seconds/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/autonomous-drone-swarm-mesh-routing/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/autonomous-drone-swarm-mesh-routing/telemetry returns Track 113 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_dronegate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_swarm_routing_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_topology_accreditation_completed_total', 2);

    const res = await request(app).get('/api/vault/autonomous-drone-swarm-mesh-routing/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_dronegate_pool_initialized_total: 3,
      hsm_zk_swarm_routing_verified_total: 7,
      hsm_topology_accreditation_completed_total: 2,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/autonomous-drone-swarm-mesh-routing/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
