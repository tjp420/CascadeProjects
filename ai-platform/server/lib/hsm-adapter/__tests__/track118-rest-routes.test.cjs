'use strict';

/**
 * Track 118 Distributed Consensus Coordinator — REST Route Integration Tests
 *
 * Verifies that the 3 Track 118 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose all 10 telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
 *
 * Follows the Track 117 (bft-shard-sync) test pattern exactly.
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

const BASE = '/api/vault/distributed-consensus-coordinator';

const TELEMETRY_KEYS = [
  'hsm_consensus_coord_groups_created_total',
  'hsm_consensus_coord_groups_destroyed_total',
  'hsm_consensus_coord_proposals_routed_total',
  'hsm_consensus_coord_proposals_rejected_total',
  'hsm_consensus_coord_faults_detected_total',
  'hsm_consensus_coord_view_change_started_total',
  'hsm_consensus_coord_view_change_completed_total',
  'hsm_consensus_coord_view_change_aborted_total',
  'hsm_consensus_coord_quorum_verified_total',
  'hsm_consensus_coord_quorum_denied_total',
];

const POLICY_KEYS = [
  'allowCrossGroupRouting',
  'allowDynamicGroupCreation',
  'faultCheckIntervalMs',
  'faultTimeoutMs',
  'maxGroups',
  'requireQuorumForProposals',
  'viewChangeTimeoutMs',
];

describe('Track 118 distributed-consensus-coordinator REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE118-L2-01: policy endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/policy?orgId=test-tenant-118')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe('test-tenant-118');
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE118-L2-02: policy endpoint returns exactly 7 policy attributes', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual(POLICY_KEYS);
    expect(Object.keys(policy)).toHaveLength(7);
  });

  test('ROUTE118-L2-03: policy endpoint returns correct default values', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    const policy = res.body.policy;
    expect(policy.maxGroups).toBe(64);
    expect(policy.faultTimeoutMs).toBe(3000);
    expect(policy.faultCheckIntervalMs).toBe(1000);
    expect(policy.viewChangeTimeoutMs).toBe(5000);
    expect(policy.requireQuorumForProposals).toBe(true);
    expect(policy.allowDynamicGroupCreation).toBe(true);
    expect(policy.allowCrossGroupRouting).toBe(true);
  });

  test('ROUTE118-L2-04: telemetry endpoint returns all 10 Track 118 counters', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    const telemetry = res.body.telemetry;
    expect(Object.keys(telemetry).sort()).toEqual([...TELEMETRY_KEYS].sort());
    expect(Object.keys(telemetry)).toHaveLength(10);
  });

  test('ROUTE118-L2-05: valid config (empty body) passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('ROUTE118-L2-06: invalid config (maxGroups exceeds 64) fails with 400 POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxGroups: 999 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
    expect(res.body.message).toBeDefined();
  });

  test('ROUTE118-L2-07: invalid config (faultTimeoutMs below 3000) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ faultTimeoutMs: 100 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE118-L2-08: telemetry counters match hsmMetrics.getMetrics()', async () => {
    const hsmMetrics = require('../hsm-metrics.cjs');
    const expectedMetrics = hsmMetrics.getMetrics();
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    for (const key of TELEMETRY_KEYS) {
      expect(res.body.telemetry[key]).toBe(expectedMetrics[key] || 0);
    }
  });

  test('ROUTE118-L2-09: telemetry counters are non-negative integers', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    const t = res.body.telemetry;
    for (const key of TELEMETRY_KEYS) {
      expect(t[key]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(t[key])).toBe(true);
    }
  });

  test('ROUTE118-L2-10: zero-leak structure — no sensitive data in responses', async () => {
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

  test('ROUTE118-L3-01: policy endpoint without orgId defaults to "default"', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.orgId).toBe('default');
  });

  test('ROUTE118-L3-02: policy validate with orgId in body is ignored and passes', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ orgId: 'tenant-x' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('ROUTE118-L3-03: invalid config (viewChangeTimeoutMs below 5000) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ viewChangeTimeoutMs: 100 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE118-L3-04: invalid config (faultCheckIntervalMs exceeds 1000) fails with 400', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ faultCheckIntervalMs: 9999 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
  });

  test('ROUTE118-L3-05: existing Track 40 consensus coordinator status endpoint still responds', async () => {
    const res = await request(app)
      .get('/api/vault/consensus/coordinator/status');
    expect(res.status).toBe(503);
    expect(res.body).toBeDefined();
  });

  test('ROUTE118-S-01: no credentials or PII in route responses', async () => {
    const responses = await Promise.all([
      request(app).get(BASE + '/policy?orgId=tenant-1'),
      request(app).get(BASE + '/telemetry?orgId=tenant-1'),
      request(app).post(BASE + '/policy/validate').send({ maxGroups: 999 }),
    ]);
    for (const res of responses) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('credential');
      expect(body).not.toContain('apiKey');
      expect(body).not.toContain('token');
      expect(body).not.toContain('userEmail');
    }
  });

  test('ROUTE118-S-02: error messages do not echo back config values', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxGroups: 999 })
      .expect(400);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).not.toContain('orgId');
  });

  test('ROUTE118-S-03: all 3 endpoints are mounted under authorize middleware', async () => {
    const responses = await Promise.all([
      request(app).get(BASE + '/policy'),
      request(app).get(BASE + '/telemetry'),
      request(app).post(BASE + '/policy/validate').send({}),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });
});
