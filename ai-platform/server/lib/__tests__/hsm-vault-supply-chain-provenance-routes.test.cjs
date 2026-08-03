'use strict';

/**
 * Tests for Track 76 v2 supply chain provenance gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/supply-chain-provenance/policy
 *   - POST /api/vault/supply-chain-provenance/policy/validate
 *   - GET  /api/vault/supply-chain-provenance/telemetry
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

describe('Track 76 v2 Supply Chain Provenance Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/supply-chain-provenance/policy returns Track 76 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/supply-chain-provenance/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minSupplierCheckpointQuorum: 3,
      maxTransitExpirationSeconds: 7776000,
      maxComponentLineageDepth: 64,
      maxBatchSize: 50,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireFactoryEndpointInitializerAttestation: true,
      requireClearingCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderProvenanceClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/supply-chain-provenance/policy/validate')
      .send({
        supplierCheckpointQuorum: 3,
        transitExpirationSeconds: 7776000,
        componentLineageDepth: 64,
        maxBatchSize: 50,
        pqcSignatureScheme: 'ML-DSA-65',
        factoryEndpointInitializerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderProvenanceClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for supplierCheckpointQuorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/supply-chain-provenance/policy/validate')
      .send({
        supplierCheckpointQuorum: 1,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/supplier checkpoint quorum/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/supply-chain-provenance/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/supply-chain-provenance/telemetry returns Track 76 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_supplygate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_provenance_claim_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_lineage_accreditation_completed_total', 2);
    hsmMetrics.incrementCounter('hsm_supplygate_settled_total', 1);
    hsmMetrics.incrementCounter('hsm_supplygate_rebalanced_total', 1);
    hsmMetrics.incrementCounter('hsm_supplygate_slash_recorded_total', 1);
    hsmMetrics.incrementCounter('hsm_provenance_batch_verified_total', 1);

    const res = await request(app).get('/api/vault/supply-chain-provenance/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_supplygate_pool_initialized_total: 3,
      hsm_zk_provenance_claim_verified_total: 7,
      hsm_lineage_accreditation_completed_total: 2,
      hsm_supplygate_settled_total: 1,
      hsm_supplygate_rebalanced_total: 1,
      hsm_supplygate_slash_recorded_total: 1,
      hsm_provenance_batch_verified_total: 1,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/supply-chain-provenance/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
