'use strict';

/**
 * Track 121 Multiparty Re-Keying — REST Route Integration Tests
 *
 * Verifies that the 3 Track 121 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose all 7 telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
 *
 * Also verifies the newly added _validateMultipartyReKeying method
 * in CryptoPolicyEngine enforces all 7 policy fields.
 *
 * Follows the Track 120 (cluster-key-reconciliation) test pattern.
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

const BASE = '/api/vault/multiparty-re-keying';

const TELEMETRY_KEYS = [
  'hsm_rekey_proposed_total',
  'hsm_rekey_resharing_submitted_total',
  'hsm_rekey_verified_total',
  'hsm_rekey_committed_total',
  'hsm_rekey_aborted_total',
  'hsm_rekey_rollback_blocked_total',
  'hsm_rekey_active',
];

const POLICY_KEYS = [
  'minQuorumNodes',
  'maxReKeyingEpochs',
  'requireQuorumCommit',
  'requireAntiRollback',
  'requireShareZeroization',
  'allowThresholdAdjustment',
  'maxShareholders',
];

describe('Track 121 multiparty-re-keying REST route integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  // ── Policy endpoint tests ──────────────────────────────────────────

  test('ROUTE121-L2-01: policy endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/policy?orgId=test-tenant-121')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe('test-tenant-121');
    expect(res.body.policy).toBeDefined();
  });

  test('ROUTE121-L2-02: policy endpoint returns exactly 7 policy attributes', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual([...POLICY_KEYS].sort());
    expect(Object.keys(policy)).toHaveLength(7);
  });

  test('ROUTE121-L2-03: policy endpoint returns correct default values', async () => {
    const res = await request(app)
      .get(BASE + '/policy')
      .expect(200);
    const policy = res.body.policy;
    expect(policy.minQuorumNodes).toBe(3);
    expect(policy.maxReKeyingEpochs).toBe(1000);
    expect(policy.requireQuorumCommit).toBe(true);
    expect(policy.requireAntiRollback).toBe(true);
    expect(policy.requireShareZeroization).toBe(true);
    expect(policy.allowThresholdAdjustment).toBe(true);
    expect(policy.maxShareholders).toBe(32);
  });

  // ── GROUND-121-01: minQuorumNodes < 3 ──────────────────────────────

  test('GROUND-121-01: minQuorumNodes below 3 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 2 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('min quorum nodes');
  });

  test('GROUND-121-01b: minQuorumNodes = 3 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: 3 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-121-02: maxReKeyingEpochs > 10000 ───────────────────────

  test('GROUND-121-02: maxReKeyingEpochs above 10000 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxReKeyingEpochs: 10001 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max re-keying epochs');
  });

  test('GROUND-121-02b: maxReKeyingEpochs = 10000 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxReKeyingEpochs: 10000 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-121-03: requireQuorumCommit = false ─────────────────────

  test('GROUND-121-03: requireQuorumCommit disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireQuorumCommit: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('quorum commit');
  });

  test('GROUND-121-03b: requireQuorumCommit = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireQuorumCommit: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-121-04: requireAntiRollback = false ─────────────────────

  test('GROUND-121-04: requireAntiRollback disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAntiRollback: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('anti-rollback');
  });

  test('GROUND-121-04b: requireAntiRollback = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireAntiRollback: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-121-05: requireShareZeroization = false ─────────────────

  test('GROUND-121-05: requireShareZeroization disabled throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireShareZeroization: false })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('share zeroization');
  });

  test('GROUND-121-05b: requireShareZeroization = true passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireShareZeroization: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── GROUND-121-06: maxShareholders out of bounds ───────────────────

  test('GROUND-121-06a: maxShareholders = 0 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxShareholders: 0 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max shareholders');
  });

  test('GROUND-121-06b: maxShareholders = 65 throws POLICY_VIOLATION_BLOCKED', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxShareholders: 65 })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
    expect(res.body.message).toContain('max shareholders');
  });

  test('GROUND-121-06c: maxShareholders = 64 passes validation', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ maxShareholders: 64 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  // ── allowThresholdAdjustment: inverse guard test ───────────────────

  test('GROUND-121-07: allowThresholdAdjustment = true passes when default policy allows it', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ allowThresholdAdjustment: true })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('GROUND-121-07b: allowThresholdAdjustment = false passes (tightening is allowed)', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ allowThresholdAdjustment: false })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test('GROUND-121-07c: allowThresholdAdjustment = true throws when tenant policy restricts it', async () => {
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        'restricted-tenant': {
          multipartyReKeying: { allowThresholdAdjustment: false },
        },
      },
    });
    expect(() => {
      engine.validate('restricted-tenant', 'multipartyReKeying', { allowThresholdAdjustment: true });
    }).toThrow(/threshold adjustment cannot be enabled/);
  });

  // ── Telemetry endpoint tests ───────────────────────────────────────

  test('ROUTE121-L2-02t: telemetry endpoint returns exactly 7 rekey counters', async () => {
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

  test('ROUTE121-L2-02tb: telemetry endpoint returns orgId via resolveOrgId', async () => {
    const res = await request(app)
      .get(BASE + '/telemetry?orgId=tenant-telemetry-121')
      .expect(200);
    expect(res.body.orgId).toBe('tenant-telemetry-121');
  });

  // ── ROUTE121-L2-03: Zero-leak compliance ───────────────────────────

  test('ROUTE121-L2-03: policy response does not leak secrets or credentials', async () => {
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

  test('ROUTE121-L2-03b: telemetry response does not leak secrets or credentials', async () => {
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

  test('ROUTE121-L2-03c: validate response does not leak secrets or credentials', async () => {
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

  test('ROUTE121-SAN-01: numeric string minQuorumNodes is coerced and validated', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ minQuorumNodes: '2' })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
  });

  test('ROUTE121-SAN-02: stringified boolean requireShareZeroization is coerced and validated', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({ requireShareZeroization: 'false' })
      .expect(400);
    expect(res.body.error).toBe('POLICY_VIOLATION_BLOCKED');
  });

  // ── ROUTE121-L3-01: Backward compatibility ─────────────────────────

  test('ROUTE121-L3-01: existing multiparty re-keying engine still works', () => {
    const { MultipartyReKeyingEngine } = require('../multiparty-rekeying-engine.cjs');
    expect(MultipartyReKeyingEngine).toBeDefined();
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(typeof engine._validateMultipartyReKeying).toBe('function');
    expect(engine.validate('default', 'multipartyReKeying', { minQuorumNodes: 3 })).toBe(true);
  });

  test('ROUTE121-L3-01b: full valid config passes validation via dispatch', () => {
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({ default: {} });
    const validConfig = {
      minQuorumNodes: 3,
      maxReKeyingEpochs: 1000,
      requireQuorumCommit: true,
      requireAntiRollback: true,
      requireShareZeroization: true,
      allowThresholdAdjustment: true,
      maxShareholders: 32,
    };
    expect(engine.validate('default', 'multipartyReKeying', validConfig)).toBe(true);
  });

  test('ROUTE121-L3-01c: empty config passes validation (no constraints triggered)', async () => {
    const res = await request(app)
      .post(BASE + '/policy/validate')
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });
});
