'use strict';

/**
 * Tests for Track 105 decentralized identity proof gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/decentralized-identity/policy
 *   - POST /api/vault/decentralized-identity/policy/validate
 *   - GET  /api/vault/decentralized-identity/telemetry
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

describe('Track 105 Decentralized Identity Proof Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/decentralized-identity/policy returns Track 105 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/decentralized-identity/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minIdentityQuorum: 12,
      maxRevocationWindowSeconds: 86400,
      maxIdentityChainDepth: 32,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireIdentityAuthorityInitializerAttestation: true,
      requireIdentityEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderIdentityClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST /api/vault/decentralized-identity/policy/validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/decentralized-identity/policy/validate')
      .send({
        identityQuorum: 12,
        revocationWindowSeconds: 86400,
        identityChainDepth: 32,
        pqcSignatureScheme: 'ML-DSA-65',
        identityAuthorityInitializerAttestation: true,
        identityEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderIdentityClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for identityQuorum below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/decentralized-identity/policy/validate')
      .send({
        identityQuorum: 5,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/identity quorum/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/decentralized-identity/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('GET /api/vault/decentralized-identity/telemetry returns Track 105 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_didgate_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_identity_claim_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_revocation_accreditation_completed_total', 2);

    const res = await request(app).get('/api/vault/decentralized-identity/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_didgate_pool_initialized_total: 3,
      hsm_zk_identity_claim_verified_total: 7,
      hsm_revocation_accreditation_completed_total: 2,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/decentralized-identity/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
