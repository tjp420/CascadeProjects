'use strict';

/**
 * Tests for Audit Policy Store — per-org retention policy configuration.
 *
 * Verifies that audit-policy-store.cjs:
 *   1. Returns default policy when no custom policy is set
 *   2. Sets and persists custom policies per org
 *   3. Validates retentionDays (must be >= 1)
 *   4. Validates maxEntries (must be >= 100)
 *   5. Validates archive (must be boolean)
 *   6. Returns all configured policies
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const POLICY_STORE_PATH = path.resolve(process.cwd(), 'server', 'lib', 'audit-policy-store.cjs');

function reloadModule(tmpPath) {
  if (typeof jest !== 'undefined' && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[POLICY_STORE_PATH];
  }
  // Set env var before require to point to temp file
  process.env.AUDIT_POLICY_PATH = tmpPath;
  return require(POLICY_STORE_PATH);
}

describe('Audit Policy Store', () => {
  let store;
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-policy-'));
    tmpFile = path.join(tmpDir, 'audit-policy-store.json');
    store = reloadModule(tmpFile);
    store._resetCache();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    delete process.env.AUDIT_POLICY_PATH;
  });

  describe('getPolicy()', () => {
    it('should return default policy when no custom policy is set', () => {
      const policy = store.getPolicy('test-org');
      assert.strictEqual(policy.retentionDays, 90);
      assert.strictEqual(policy.maxEntries, 10000);
      assert.strictEqual(policy.archive, false);
    });

    it('should return custom policy after setPolicy()', () => {
      store.setPolicy('test-org', { retentionDays: 30, maxEntries: 5000, archive: true });
      const policy = store.getPolicy('test-org');
      assert.strictEqual(policy.retentionDays, 30);
      assert.strictEqual(policy.maxEntries, 5000);
      assert.strictEqual(policy.archive, true);
    });

    it('should return independent policies for different orgs', () => {
      store.setPolicy('org-a', { retentionDays: 30 });
      store.setPolicy('org-b', { retentionDays: 60 });
      assert.strictEqual(store.getPolicy('org-a').retentionDays, 30);
      assert.strictEqual(store.getPolicy('org-b').retentionDays, 60);
    });
  });

  describe('setPolicy() validation', () => {
    it('should reject negative retentionDays', () => {
      const result = store.setPolicy('test-org', { retentionDays: -1 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('retentionDays'));
    });

    it('should reject zero retentionDays', () => {
      const result = store.setPolicy('test-org', { retentionDays: 0 });
      assert.strictEqual(result.success, false);
    });

    it('should reject maxEntries < 100', () => {
      const result = store.setPolicy('test-org', { maxEntries: 50 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('maxEntries'));
    });

    it('should reject non-boolean archive', () => {
      const result = store.setPolicy('test-org', { archive: 'yes' });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('archive'));
    });

    it('should reject missing orgId', () => {
      const result = store.setPolicy('', { retentionDays: 30 });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('orgId'));
    });

    it('should accept valid partial updates', () => {
      store.setPolicy('test-org', { retentionDays: 30 });
      store.setPolicy('test-org', { archive: true });
      const policy = store.getPolicy('test-org');
      assert.strictEqual(policy.retentionDays, 30);
      assert.strictEqual(policy.archive, true);
      assert.strictEqual(policy.maxEntries, 10000); // unchanged
    });
  });

  describe('getAllPolicies()', () => {
    it('should return empty object when no policies configured', () => {
      const all = store.getAllPolicies();
      assert.strictEqual(Object.keys(all).length, 0);
    });

    it('should return all configured policies', () => {
      store.setPolicy('org-a', { retentionDays: 30 });
      store.setPolicy('org-b', { retentionDays: 60 });
      const all = store.getAllPolicies();
      assert.strictEqual(Object.keys(all).length, 2);
      assert.strictEqual(all['org-a'].retentionDays, 30);
      assert.strictEqual(all['org-b'].retentionDays, 60);
    });
  });

  describe('persistence', () => {
    it('should persist policy to disk', () => {
      store.setPolicy('persist-org', { retentionDays: 45 });
      // Reload module to read from disk
      store._resetCache();
      const policy = store.getPolicy('persist-org');
      assert.strictEqual(policy.retentionDays, 45);
    });

    it('should survive cache reset', () => {
      store.setPolicy('cache-org', { retentionDays: 15, maxEntries: 2000 });
      store._resetCache();
      const policy = store.getPolicy('cache-org');
      assert.strictEqual(policy.retentionDays, 15);
      assert.strictEqual(policy.maxEntries, 2000);
    });
  });
});
