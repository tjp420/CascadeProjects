'use strict';

/**
 * Tests for pii-policy-store.cjs ΓÇö syncPoliciesToOrgs()
 * Tests multi-tenant policy synchronization with merge/replace modes and filters.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('pii-policy-store syncPoliciesToOrgs', () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;
  let _testNum = 0;

  beforeEach(() => {
    // Create a unique temp dir per test to avoid cache issues
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pii-test-'));
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
    process.env.PII_POLICY_PATH = _tempPolicyPath;

    // Write empty store
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }, null, 2), 'utf8');

    // Reset Jest's module registry so the store re-reads PII_POLICY_PATH
    jest.resetModules();

    storeModule = require('../pii-policy-store.cjs');
    _testNum++;
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  function seedSourcePolicies(orgId, count) {
    for (let i = 0; i < count; i++) {
      storeModule.createPolicy({
        orgId,
        name: 'Policy ' + i,
        description: 'Test policy ' + i,
        pattern: '\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b',
        flags: 'g',
        replacement: '[REDACTED]',
        severity: i % 2 === 0 ? 'high' : 'medium',
        enabled: true,
        compliance: i % 2 === 0 ? ['GDPR', 'PCI-DSS'] : ['HIPAA'],
        isDefault: i === 0,
      });
    }
  }

  it('should export syncPoliciesToOrgs', () => {
    assert.strictEqual(typeof storeModule.syncPoliciesToOrgs, 'function');
  });

  it('should throw if sourceOrgId is missing', () => {
    assert.throws(
      () => storeModule.syncPoliciesToOrgs(null, ['org-b']),
      /sourceOrgId is required/
    );
  });

  it('should throw if targetOrgIds is empty', () => {
    assert.throws(
      () => storeModule.syncPoliciesToOrgs('org-a', []),
      /targetOrgIds must be a non-empty array/
    );
  });

  it('should throw if targetOrgIds is not an array', () => {
    assert.throws(
      () => storeModule.syncPoliciesToOrgs('org-a', 'org-b'),
      /targetOrgIds must be a non-empty array/
    );
  });

  it('should clone policies from source to target in merge mode', () => {
    seedSourcePolicies('org-a', 3);
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b']);

    assert.strictEqual(result.sourceOrg, 'org-a');
    assert.strictEqual(result.totalCloned, 3);
    assert.strictEqual(result.totalSkipped, 0);
    assert.strictEqual(result.targets.length, 1);
    assert.strictEqual(result.targets[0].orgId, 'org-b');
    assert.strictEqual(result.targets[0].success, true);
    assert.strictEqual(result.targets[0].cloned, 3);

    // Verify policies were actually written
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.strictEqual(targetPolicies.length, 3);
    assert.strictEqual(targetPolicies[0].orgId, 'org-b');
    assert.strictEqual(targetPolicies[0].name, 'Policy 0');
  });

  it('should skip duplicate policies in merge mode', () => {
    seedSourcePolicies('org-a', 2);
    // First sync
    storeModule.syncPoliciesToOrgs('org-a', ['org-b']);
    // Second sync ΓÇö should skip all
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b']);

    assert.strictEqual(result.totalCloned, 0);
    assert.strictEqual(result.totalSkipped, 2);
    assert.strictEqual(result.targets[0].skipped, 2);
  });

  it('should replace all target policies in replace mode', () => {
    seedSourcePolicies('org-a', 2);
    // First sync to populate target
    storeModule.syncPoliciesToOrgs('org-a', ['org-b']);

    // Add an extra policy to target that shouldn't survive replace
    storeModule.createPolicy({
      orgId: 'org-b',
      name: 'Extra Policy',
      pattern: '\\bEXTRA\\b',
      flags: 'g',
      replacement: '[X]',
      severity: 'low',
      compliance: [],
    });

    // Replace mode
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b'], { mode: 'replace' });

    assert.strictEqual(result.totalCloned, 2);
    assert.strictEqual(result.totalRemoved, 3); // 2 from first sync + 1 extra
    assert.strictEqual(result.targets[0].removed, 3);

    // Verify only source policies remain
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.strictEqual(targetPolicies.length, 2);
    assert.ok(targetPolicies.every((p) => p.name.startsWith('Policy ')));
  });

  it('should reject target org same as source', () => {
    seedSourcePolicies('org-a', 2);
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-a']);

    assert.strictEqual(result.targets[0].success, false);
    assert.strictEqual(result.targets[0].error, 'target_org_same_as_source');
    assert.strictEqual(result.totalCloned, 0);
  });

  it('should filter by compliance framework', () => {
    seedSourcePolicies('org-a', 4); // 2 with GDPR, 2 with HIPAA
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b'], {
      compliance: ['GDPR'],
    });

    assert.strictEqual(result.totalCloned, 2);
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.strictEqual(targetPolicies.length, 2);
    assert.ok(targetPolicies.every((p) => p.compliance.includes('GDPR')));
  });

  it('should filter by severity', () => {
    seedSourcePolicies('org-a', 4); // 2 high, 2 medium
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b'], {
      severity: ['high'],
    });

    assert.strictEqual(result.totalCloned, 2);
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.strictEqual(targetPolicies.length, 2);
    assert.ok(targetPolicies.every((p) => p.severity === 'high'));
  });

  it('should filter by isDefault', () => {
    seedSourcePolicies('org-a', 3); // only policy 0 is default
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b'], {
      isDefault: true,
    });

    assert.strictEqual(result.totalCloned, 1);
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.strictEqual(targetPolicies.length, 1);
    assert.strictEqual(targetPolicies[0].isDefault, true);
  });

  it('should sync to multiple target orgs', () => {
    seedSourcePolicies('org-a', 2);
    const result = storeModule.syncPoliciesToOrgs('org-a', ['org-b', 'org-c', 'org-d']);

    assert.strictEqual(result.targets.length, 3);
    assert.strictEqual(result.totalCloned, 6); // 2 policies ├ù 3 orgs
    assert.ok(result.targets.every((t) => t.success && t.cloned === 2));
  });

  it('should generate new IDs for cloned policies', () => {
    seedSourcePolicies('org-a', 1);
    storeModule.syncPoliciesToOrgs('org-a', ['org-b']);

    const sourcePolicies = storeModule.getPolicies('org-a');
    const targetPolicies = storeModule.getPolicies('org-b');
    assert.notStrictEqual(sourcePolicies[0].id, targetPolicies[0].id);
    assert.ok(targetPolicies[0].id.startsWith('pii-'));
  });

  it('should export getAllOrgIds', () => {
    assert.strictEqual(typeof storeModule.getAllOrgIds, 'function');
  });

  it('getAllOrgIds should return unique org IDs from store', () => {
    seedSourcePolicies('org-a', 1);
    storeModule.syncPoliciesToOrgs('org-a', ['org-b', 'org-c']);

    const orgIds = storeModule.getAllOrgIds();
    assert.ok(orgIds.includes('org-a'));
    assert.ok(orgIds.includes('org-b'));
    assert.ok(orgIds.includes('org-c'));
  });
});
