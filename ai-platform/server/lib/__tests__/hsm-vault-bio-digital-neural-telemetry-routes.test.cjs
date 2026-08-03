'use strict';

/**
 * Tests for Track 112 bio-digital interface neural-telemetry gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/bio-digital-neural-telemetry/policy
 *   - POST /api/vault/bio-digital-neural-telemetry/policy/validate
 *   - GET  /api/vault/bio-digital-neural-telemetry/telemetry
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

describe('Track 112 Bio-Digital Interface Neural-Telemetry Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/bio-digital-neural-telemetry/policy returns Track 112 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/bio-digital-neural-telemetry/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minNeuralQuorum: 24,
      maxNeuralTelemetryWindowSeconds: 2,
      maxSynapseChainDepth: 64,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireNeuroTelemetryAuthorityInitializerAttestation: true,
      requireBioEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderNeuralTelemetryClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/bio-digital-neural-telemetry/policy/validate')
      .send({
        neuralQuorum: 24,
        neuralTelemetryWindowSeconds: 2,
        synapseChainDepth: 64,
        pqcSignatureScheme: 'ML-DSA-65',
        neuroTelemetryAuthorityInitializerAttestation: true,
        bioEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderNeuralTelemetryClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for neural quorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/bio-digital-neural-telemetry/policy/validate')
      .send({
        neuralQuorum: 5,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/neural quorum/);
  });

  test('POST .../validate returns 400 for neural telemetry window exceeding 2 seconds', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/bio-digital-neural-telemetry/policy/validate')
      .send({
        neuralTelemetryWindowSeconds: 3,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/neural telemetry window seconds/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/bio-digital-neural-telemetry/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/bio-digital-neural-telemetry/telemetry returns Track 112 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_neurogate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_neural_telemetry_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_synapse_accreditation_completed_total', 2);
    hsmMetrics.incrementCounter('hsm_neurogate_challenge_issued_total', 1);

    const res = await request(app).get('/api/vault/bio-digital-neural-telemetry/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_neurogate_pool_initialized_total: 3,
      hsm_zk_neural_telemetry_verified_total: 7,
      hsm_synapse_accreditation_completed_total: 2,
    });
    // challenge counter is intentionally not exposed on the telemetry route
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/bio-digital-neural-telemetry/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
