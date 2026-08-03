'use strict';

/**
 * Tests for Track 111 zero-knowledge decentralized storage attestation gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/zk-decentralized-storage/policy
 *   - POST /api/vault/zk-decentralized-storage/policy/validate
 *   - GET  /api/vault/zk-decentralized-storage/telemetry
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

describe('Track 111 Zero-Knowledge Decentralized Storage Attestation Gating routes', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('GET /api/vault/zk-decentralized-storage/policy returns Track 111 defaults', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app).get('/api/vault/zk-decentralized-storage/policy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minReplicationFactor: 3,
      maxProofOfSpaceTimeWindowSeconds: 300,
      maxStorageAttestationChainDepth: 46,
      maxReplicaDispersalDistance: 12,
      allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
      requireStorageAuthorityInitializerAttestation: true,
      requireStorageEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ['mock-authority'],
      banMalformedOrOutOfOrderStorageClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test('POST .../validate accepts a valid configuration', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/zk-decentralized-storage/policy/validate')
      .send({
        replicationFactor: 3,
        proofOfSpaceTimeWindowSeconds: 300,
        storageAttestationChainDepth: 46,
        replicaDispersalDistance: 12,
        pqcSignatureScheme: 'ML-DSA-65',
        storageAuthorityInitializerAttestation: true,
        storageEthicsOversightCommitteeAttestation: true,
        attestationAuthority: 'mock-authority',
        banMalformedOrOutOfOrderStorageClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('POST .../validate returns 400 for replicationFactor below minimum', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/zk-decentralized-storage/policy/validate')
      .send({
        replicationFactor: 1,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/replication factor/);
  });

  test('POST .../validate returns 400 for disallowed PQC signature scheme', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/zk-decentralized-storage/policy/validate')
      .send({
        pqcSignatureScheme: 'falcon-512',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test('POST .../validate returns 400 for proof-of-space-time window too large', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    const res = await request(app)
      .post('/api/vault/zk-decentralized-storage/policy/validate')
      .send({
        proofOfSpaceTimeWindowSeconds: 9999,
        pqcSignatureScheme: 'ML-DSA-65',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toMatch(/proof-of-space-time window seconds/);
  });

  test('GET /api/vault/zk-decentralized-storage/telemetry returns Track 111 counters', async () => {
    const app = buildApp({ id: 'admin1', role: 'admin', permissions: ['admin:all'] });
    hsmMetrics.incrementCounter('hsm_zkstorage_pool_initialized_total', 3);
    hsmMetrics.incrementCounter('hsm_zk_storage_proof_verified_total', 7);
    hsmMetrics.incrementCounter('hsm_zkstorage_replication_accreditation_completed_total', 2);
    hsmMetrics.incrementCounter('hsm_zkstorage_dispersal_completed_total', 4);
    hsmMetrics.incrementCounter('hsm_zkstorage_slash_recorded_total', 1);
    hsmMetrics.incrementCounter('hsm_zkstorage_challenge_issued_total', 5);

    const res = await request(app).get('/api/vault/zk-decentralized-storage/telemetry');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_zkstorage_pool_initialized_total: 3,
      hsm_zk_storage_proof_verified_total: 7,
      hsm_zkstorage_replication_accreditation_completed_total: 2,
      hsm_zkstorage_dispersal_completed_total: 4,
      hsm_zkstorage_slash_recorded_total: 1,
      hsm_zkstorage_challenge_issued_total: 5,
    });
  });

  test('non-admin users are rejected with 403', async () => {
    const app = buildApp({ id: 'user1', role: 'viewer', permissions: [] });
    const res = await request(app).get('/api/vault/zk-decentralized-storage/policy');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_permissions');
  });
});
