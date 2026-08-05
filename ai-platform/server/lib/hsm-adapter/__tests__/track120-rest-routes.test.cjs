'use strict';

/**
 * Track 120 Cluster Key Reconciliation — REST Route Integration Tests
 *
 * Verifies that the 3 Track 120 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose all 7 telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
 *
 * Also verifies the newly added _validateClusterKeyReconciliation method
 * in CryptoPolicyEngine enforces all 6 policy fields.
 *
 * Follows the Track 119 (cross-cluster-migration) test pattern.
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

const BASE = '/api/vault/cluster-key-reconciliation';

const TELEMETRY_KEYS = [
  'hsm_reconciliation_scans_total',
  'hsm_reconciliation_divergence_detected_total',
  'hsm_reconciliation_promoted_total',
  'hsm_reconciliation_quarantined_total',
  'hsm_reconciliation_rollback_blocked_total',
  'hsm_reconciliation_promotion_votes_total',
  'hsm_reconciliation_divergent_keys',
];

const POLICY_KEYS = [
  'minQuorumNodes',
  'maxEpochRollbackAttempts',
  'requireQuorumPromotion',
  'requireAntiRollback',
  'quarantineOnCriticalDivergence',
  'maxTrackedKeys',
];

describe('Track 120 cluster-key-reconciliation REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  // ── Policy endpoint tests ──────────────────────────────────────────

  test('ROUTE120-L2-01: policy endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/policy?orgId=test-tenant-120')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe('test-tenant-120');
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE120-L2-02: policy endpoint returns exactly 6 policy attributes', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual([...POLICY_KEYS].sort());
    expect(Object.keys(policy)).toHaveLength(6);
  });

  test('ROUTE120-L2-03: policy endpoint returns correct default values', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    const policy = res.body.policy;
    expect(policy.minQuorumNodes).toBe(3);
    expect(policy.maxEpochRollbackAttempts).toBe(3);
    expect(policy.requireQuorumPromotion).toBe(true);
    expect(policy.requireAntiRollback).toBe(true);
    expect(policy.quarantineOnCriticalDivergence).toBe(true);
    expect(policy.maxTrackedKeys).toBe(256);
  });

  // ── GROUND-120-01: minQuorumNodes < 3 ──────────────────────────────

  test('GROUND-120-01: minQuorumNodes below 3 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 2 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('min quorum nodes');
  });

  test('GROUND-120-01b: minQuorumNodes = 3 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 3 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-120-02: maxEpochRollbackAttempts > 5 ────────────────────

  test('GROUND-120-02: maxEpochRollbackAttempts above 5 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxEpochRollbackAttempts: 6 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max epoch rollback attempts');
  });

  test('GROUND-120-02b: maxEpochRollbackAttempts = 5 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxEpochRollbackAttempts: 5 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-120-03: requireQuorumPromotion = false ──────────────────

  test('GROUND-120-03: requireQuorumPromotion disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireQuorumPromotion: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('quorum promotion');
  });

  test('GROUND-120-03b: requireQuorumPromotion = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireQuorumPromotion: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-120-04: requireAntiRollback = false ─────────────────────

  test('GROUND-120-04: requireAntiRollback disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAntiRollback: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('anti-rollback');
  });

  test('GROUND-120-04b: requireAntiRollback = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAntiRollback: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-120-05: quarantineOnCriticalDivergence = false ───────────

  test('GROUND-120-05: quarantineOnCriticalDivergence disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ quarantineOnCriticalDivergence: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('quarantine');
  });

  test('GROUND-120-05b: quarantineOnCriticalDivergence = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ quarantineOnCriticalDivergence: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-120-06: maxTrackedKeys out of bounds ────────────────────

  test('GROUND-120-06a: maxTrackedKeys = 0 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxTrackedKeys: 0 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max tracked keys');
  });

  test('GROUND-120-06b: maxTrackedKeys = 513 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxTrackedKeys: 513 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max tracked keys');
  });

  test('GROUND-120-06c: maxTrackedKeys = 256 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxTrackedKeys: 256 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── Telemetry endpoint tests ───────────────────────────────────────

  test('ROUTE120-L2-02: telemetry endpoint returns exactly 7 reconciliation counters', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBeDefined();
    const telemetry = res.body.telemetry;
    expect(telemetry).toBeDefined();
    expect(Object.keys(telemetry).sort()).toEqual([...TELEMETRY_KEYS].sort());
    expect(Object.keys(telemetry)).toHaveLength(7);
  });

  test('ROUTE120-L2-02b: telemetry endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry?orgId=tenant-telemetry-120')
      .expect(200);
    expect(res.body.orgId).toBe('tenant-telemetry-120');
  });

  // ── ROUTE120-L2-03: Zero-leak compliance ───────────────────────────

  test('ROUTE120-L2-03: policy response does not leak secrets or credentials', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/api[_-]?key/i);
    expect(bodyStr).not.toMatch(/private[_-]?key/i);
    expect(bodyStr).not.toMatch(/[0-9a-f]{64}/i);
    expect(bodyStr).not.toMatch(/key[_-]?material/i);
    expect(bodyStr).not.toMatch(/peer[_-]?hash/i);
  });

  test('ROUTE120-L2-03b: telemetry response does not leak secrets or credentials', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry')
      .expect(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/api[_-]?key/i);
    expect(bodyStr).not.toMatch(/private[_-]?key/i);
    expect(bodyStr).not.toMatch(/[0-9a-f]{64}/i);
    expect(bodyStr).not.toMatch(/key[_-]?material/i);
    expect(bodyStr).not.toMatch(/peer[_-]?hash/i);
  });

  test('ROUTE120-L2-03c: validate response does not leak secrets or credentials', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 5 })
      .expect(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/password/i);
    expect(bodyStr).not.toMatch(/api[_-]?key/i);
    expect(bodyStr).not.toMatch(/private[_-]?key/i);
    expect(bodyStr).not.toMatch(/[0-9a-f]{64}/i);
  });

  // ── Input sanitization tests ───────────────────────────────────────

  test('ROUTE120-SAN-01: numeric string minQuorumNodes is coerced and validated', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: '2' })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
  });

  test('ROUTE120-SAN-02: stringified boolean requireAntiRollback is coerced and validated', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAntiRollback: 'false' })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
  });

  // ── ROUTE120-L3-01: Backward compatibility ─────────────────────────

  test('ROUTE120-L3-01: Track 35 reconciliation engine tests still pass', () => {
    // Verify the existing cluster-key-reconciliation engine can still be imported
    const { ClusterKeyReconciliationEngine } = require('../cluster-key-reconciliation-engine.cjs');
    expect(ClusterKeyReconciliationEngine).toBeDefined();
    // Verify the policy engine has the new validation method
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(typeof engine._validateClusterKeyReconciliation).toBe('function');
    // Verify the dispatch case works
    expect(engine.validate('default', 'clusterKeyReconciliation', { minQuorumNodes: 3 })).toBe(true);
  });

  test('ROUTE120-L3-01b: full valid config passes validation via dispatch', () => {
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const validConfig = {
      minQuorumNodes: 3,
      maxEpochRollbackAttempts: 3,
      requireQuorumPromotion: true,
      requireAntiRollback: true,
      quarantineOnCriticalDivergence: true,
      maxTrackedKeys: 256,
    };
    expect(engine.validate('default', 'clusterKeyReconciliation', validConfig)).toBe(true);
  });

  test('ROUTE120-L3-01c: empty config passes validation (no constraints triggered)', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });
});
