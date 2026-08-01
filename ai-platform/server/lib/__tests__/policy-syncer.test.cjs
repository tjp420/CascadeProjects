const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { reconcilePolicy, getActivePolicy, clearCache, POLICY_STORE_DIR } = require('../policy-syncer.cjs');
const { enforceCompliancePolicy } = require('../../middleware/compliance-guard.cjs');

// Universal shim hook mapping Node's native test runner to Jest compatibility frames
const describe = (name, fn) => {
  if (typeof global.describe === 'function') return global.describe(name, fn);
  return test(name, fn);
};

const it = (name, fn) => {
  if (typeof global.it === 'function') return global.it(name, fn);
  return test(name, fn);
};

describe('Multi-Tenant Compliance Policy Syncer Engine Suite', () => {
  const mockOrgId = 'org-compliance-syncer-test';

  // Universal hook resolver targeting both runner environments
  const setupHook = typeof beforeEach === 'function' ? beforeEach : (fn) => test.beforeEach(fn);

  setupHook(() => {
    clearCache();
    if (fs.existsSync(POLICY_STORE_DIR)) {
      fs.rmSync(POLICY_STORE_DIR, { recursive: true, force: true });
    }
  });

  it('should successfully sync and save an incoming central policy blueprint', async () => {
    const mockPayload = {
      policyId: 'pol_sox_compliance',
      version: '1.0.0',
      rules: [{ ruleId: 'rule_1', effect: 'DENY' }]
    };

    const synced = await reconcilePolicy(mockOrgId, mockPayload);
    assert.strictEqual(synced.policyId, 'pol_sox_compliance');
    
    const active = getActivePolicy(mockOrgId);
    assert.strictEqual(active.policyId, 'pol_sox_compliance');
    assert.strictEqual(active.rules.length, 1);
  });

  it('should halt request execution lines if a mandatory DLP token condition is missing', async () => {
    const ruleBlock = {
      policyId: 'pol_restricted',
      version: '1.2.0',
      rules: [{
        ruleId: 'rule_deny_unencrypted',
        effect: 'DENY',
        condition: { field: 'req.headers.x-dlp-token', operator: 'EXISTS', value: false },
        remediation: 'Missing mandatory enterprise DLP token.'
      }]
    };

    await reconcilePolicy(mockOrgId, ruleBlock);
    const guardMiddleware = enforceCompliancePolicy();

    const req = {
      resolvedOrgId: mockOrgId,
      headers: {}, // Emulate missing target header field
      user: { id: 'usr_compliance_agent', orgId: mockOrgId }
    };

    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { jsonBody = payload; return this; }
    };

    await guardMiddleware(req, res, () => {
      assert.fail('Should never invoke next() if an explicit DENY threshold breaks compliance');
    });

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody.error, 'compliance_policy_violation');
    assert.strictEqual(jsonBody.ruleId, 'rule_deny_unencrypted');
  });
});
