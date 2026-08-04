'use strict';

/**
 * Track 117 BFT Shard Sync — REST Route Integration Tests
 *
 * Verifies that the 3 Track 117 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose all 8 telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
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
    if (k.endsWith('/server/routes/hsm-vault-routes.cjs')) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require('../../../routes/hsm-vault-routes.cjs');
  app.use('/api/vault', vaultRoutes);
  return app;
}

describe('Track 117 bft-shard-sync REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('ROUTE117-L2-01: policy endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/policy?orgId=test-tenant-117')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe('test-tenant-117');
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE117-L2-02: telemetry endpoint returns all 8 BFT counters', async () => {
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    const telemetry = res.body.telemetry;
    expect(Object.keys(telemetry).sort()).toEqual([
      'hsm_shard_ack_total',
      'hsm_shard_active',
      'hsm_shard_append_total',
      'hsm_shard_byzantine_detected_total',
      'hsm_shard_catchup_batch_total',
      'hsm_shard_commit_total',
      'hsm_shard_lagging_nodes',
      'hsm_shard_limit_exceeded_total',
    ]);
    expect(Object.keys(telemetry)).toHaveLength(8);
  });

  test('ROUTE117-L2-03: zero-leak structure — no unmapped keys or internal state', async () => {
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/telemetry')
      .expect(200);
    const body = JSON.stringify(res.body);
    // Zero-leak: no peer addresses, no message content, no key material
    expect(body).not.toContain('secret');
    expect(body).not.toContain('password');
    expect(body).not.toContain('privateKey');
    expect(body).not.toContain('peer');
    expect(body).not.toContain('activeHex');
    expect(body).not.toContain('previousHex');
    expect(body).not.toContain('masterPublicKey');
  });

  test('ROUTE117-L2-04: valid config (empty body) passes validation', async () => {
    const res = await request(app)
      .post('/api/vault/bft-shard-sync/policy/validate')
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('ROUTE117-L2-05: invalid config fails with 400 POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post('/api/vault/bft-shard-sync/policy/validate')
      .send({ minQuorumNodes: 1 })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
    expect(res.body.message).toBeDefined();
    // Zero-leak: error message should not echo back the config value
    expect(res.body.message).not.toContain('minQuorumNodes');
  });

  test('ROUTE117-L2-06: policy endpoint returns exactly 7 policy attributes', async () => {
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual([
      'byzantineDivergenceThreshold',
      'lagThreshold',
      'maxCatchUpBatchSize',
      'maxShardsPerCluster',
      'minQuorumNodes',
      'requireAntiReplay',
      'requireQuorumCommit',
    ]);
    expect(Object.keys(policy)).toHaveLength(7);
    expect(policy.minQuorumNodes).toBe(3);
    expect(policy.maxCatchUpBatchSize).toBe(64);
    expect(policy.lagThreshold).toBe(8);
    expect(policy.byzantineDivergenceThreshold).toBe(100);
    expect(policy.requireQuorumCommit).toBe(true);
    expect(policy.requireAntiReplay).toBe(true);
    expect(policy.maxShardsPerCluster).toBe(128);
  });

  test('ROUTE117-L2-07: telemetry counters match hsmMetrics.getMetrics()', async () => {
    const hsmMetrics = require('../hsm-metrics.cjs');
    const expectedMetrics = hsmMetrics.getMetrics();
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/telemetry')
      .expect(200);
    expect(res.body.telemetry.hsm_shard_append_total).toBe(expectedMetrics.hsm_shard_append_total || 0);
    expect(res.body.telemetry.hsm_shard_ack_total).toBe(expectedMetrics.hsm_shard_ack_total || 0);
    expect(res.body.telemetry.hsm_shard_commit_total).toBe(expectedMetrics.hsm_shard_commit_total || 0);
    expect(res.body.telemetry.hsm_shard_catchup_batch_total).toBe(expectedMetrics.hsm_shard_catchup_batch_total || 0);
    expect(res.body.telemetry.hsm_shard_byzantine_detected_total).toBe(expectedMetrics.hsm_shard_byzantine_detected_total || 0);
    expect(res.body.telemetry.hsm_shard_limit_exceeded_total).toBe(expectedMetrics.hsm_shard_limit_exceeded_total || 0);
    expect(res.body.telemetry.hsm_shard_lagging_nodes).toBe(expectedMetrics.hsm_shard_lagging_nodes || 0);
    expect(res.body.telemetry.hsm_shard_active).toBe(expectedMetrics.hsm_shard_active || 0);
  });

  test('ROUTE117-L2-08: telemetry counters are non-negative integers', async () => {
    const res = await request(app)
      .get('/api/vault/bft-shard-sync/telemetry')
      .expect(200);
    const t = res.body.telemetry;
    const keys = [
      'hsm_shard_append_total',
      'hsm_shard_ack_total',
      'hsm_shard_commit_total',
      'hsm_shard_catchup_batch_total',
      'hsm_shard_byzantine_detected_total',
      'hsm_shard_limit_exceeded_total',
      'hsm_shard_lagging_nodes',
      'hsm_shard_active',
    ];
    for (const key of keys) {
      expect(t[key]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(t[key])).toBe(true);
    }
  });
});
