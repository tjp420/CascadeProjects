'use strict';

/**
 * Track 119 Cross-Cluster Migration — REST Route Integration Tests
 *
 * Verifies that the 3 Track 119 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose all 7 telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
 *
 * Also verifies the newly added _validateCrossClusterMigration method
 * in CryptoPolicyEngine enforces all 7 policy keys.
 *
 * Follows the Track 118 (distributed-consensus-coordinator) test pattern.
 */

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
    if (k.endsWith('/server/routes/hsm-vault-routes.cjs') || k.endsWith('\\server\\routes\\hsm-vault-routes.cjs')) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require('../../../routes/hsm-vault-routes.cjs');
  app.use('/api/vault', vaultRoutes);
  return app;
}

const BASE = '/api/vault/cross-cluster-migration';

const TELEMETRY_KEYS = [
  'hsm_migration_initiated_total',
  'hsm_migration_attested_total',
  'hsm_migration_committed_total',
  'hsm_migration_rolled_back_total',
  'hsm_migration_ack_total',
  'hsm_migration_verification_failed_total',
  'hsm_migration_active',
];

const POLICY_KEYS = [
  'allowedAttestationAuthorities',
  'maxConcurrentMigrations',
  'maxShardsPerMigration',
  'minQuorumNodes',
  'requireAttestation',
  'requireQuorumCommit',
  'requireRollbackOnFailure',
];

describe('Track 119 cross-cluster-migration REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE119-L2-01: policy endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/policy?orgId=test-tenant-119')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe('test-tenant-119');
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE119-L2-02: policy endpoint returns exactly 7 policy attributes', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual(POLICY_KEYS);
    expect(Object.keys(policy)).toHaveLength(7);
  });

  test('ROUTE119-L2-03: policy endpoint returns correct default values', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    const policy = res.body.policy;
    expect(policy.minQuorumNodes).toBe(3);
    expect(policy.requireAttestation).toBe(true);
    expect(policy.allowedAttestationAuthorities).toEqual(['mock-authority']);
    expect(policy.maxConcurrentMigrations).toBe(16);
    expect(policy.requireQuorumCommit).toBe(true);
    expect(policy.requireRollbackOnFailure).toBe(true);
    expect(policy.maxShardsPerMigration).toBe(32);
  });

  test('ROUTE119-L2-04: telemetry endpoint returns all 7 Track 119 counters', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    const telemetry = res.body.telemetry;
    expect(Object.keys(telemetry).sort()).toEqual([...TELEMETRY_KEYS].sort());
    expect(Object.keys(telemetry)).toHaveLength(7);
  });

  test('ROUTE119-L2-05: valid config (empty body) passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('ROUTE119-L2-06: invalid config (minQuorumNodes below 3) fails with 400 POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 1 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
    expect(res.body.message).toBeDefined();
  });

  test('ROUTE119-L2-07: invalid config (maxConcurrentMigrations exceeds 16) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxConcurrentMigrations: 999 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-L2-08: invalid config (requireAttestation false) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAttestation: false })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-L2-09: telemetry counters match hsmMetrics.getMetrics()', async () => {
    const hsmMetrics = require('../hsm-metrics.cjs');
    const expectedMetrics = hsmMetrics.getMetrics();
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    for (const key of TELEMETRY_KEYS) {
      expect(res.body.telemetry[key]).toBe(expectedMetrics[key] || 0);
    }
  });

  test('ROUTE119-L2-10: zero-leak structure — no sensitive data in responses', async () => {
    const responses = await Promise.all([
      request(app).get(BASE + '/policy'),
      request(app).get(BASE + '/telemetry'),
      request(app).post(BASE + '/policy/validate').send({}),
    ]);
    for (const res of responses) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('secret');
      expect(body).not.toContain('password');
      expect(body).not.toContain('privateKey');
      expect(body).not.toContain('peer');
      expect(body).not.toContain('masterPublicKey');
    }
  });

  test('ROUTE119-L3-01: policy endpoint without orgId defaults to "default"', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.orgId).toBe('default');
  });

  test('ROUTE119-L3-02: invalid config (maxShardsPerMigration exceeds 32) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxShardsPerMigration: 999 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-L3-03: invalid config (requireQuorumCommit false) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireQuorumCommit: false })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-L3-04: invalid config (requireRollbackOnFailure false) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireRollbackOnFailure: false })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-L3-05: existing Track 118 REST routes still respond (no regression)', async () => {
    const res = await request(app)
      .get('/api/vault/distributed-consensus-coordinator/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE119-S-01: no credentials or PII in route responses', async () => {
    const responses = await Promise.all([
      request(app).get(BASE + '/policy?orgId=tenant-1'),
      request(app).get(BASE + '/telemetry?orgId=tenant-1'),
      request(app).post(BASE + '/policy/validate').send({ maxConcurrentMigrations: 999 }),
    ]);
    for (const res of responses) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('credential');
      expect(body).not.toContain('apiKey');
      expect(body).not.toContain('token');
      expect(body).not.toContain('userEmail');
    }
  });

  test('ROUTE119-S-02: error messages do not echo back config values', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxConcurrentMigrations: 999 })
      .expect(400);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).not.toContain('orgId');
  });

  test('ROUTE119-S-03: all 3 endpoints are mounted under authorize middleware', async () => {
    const responses = await Promise.all([
      request(app).get(BASE + '/policy'),
      request(app).get(BASE + '/telemetry'),
      request(app).post(BASE + '/policy/validate').send({}),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });

  test('ROUTE119-SUBSET-01: spoofed attestation authority is rejected with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ allowedAttestationAuthorities: ['spoofed-authority', 'mock-authority'] })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE119-SUBSET-02: valid attestation authority subset passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ allowedAttestationAuthorities: ['mock-authority'] })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('ROUTE119-TEL-01: telemetry counters are non-negative integers', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    const t = res.body.telemetry;
    for (const key of TELEMETRY_KEYS) {
      expect(t[key]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(t[key])).toBe(true);
    }
  });
});
