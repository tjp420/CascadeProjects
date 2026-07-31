'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test isolation
const tmpDir = path.join(os.tmpdir(), `audit-policy-test-${Date.now()}`);
const policyPath = path.join(tmpDir, 'audit-policies.json');

// Set env before requiring the module
process.env.AUDIT_POLICY_PATH = policyPath;

const {
  getPolicy,
  setPolicy,
  resetPolicy,
  getAllPolicies,
  getArchivePath,
  DEFAULT_POLICY,
} = require('../audit-policy-store.cjs');

describe('audit-policy-store', () => {
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('DEFAULT_POLICY', () => {
    test('has expected default values', () => {
      expect(DEFAULT_POLICY.retentionDays).toBe(90);
      expect(DEFAULT_POLICY.maxEntries).toBe(5000);
      expect(DEFAULT_POLICY.archiveEnabled).toBe(true);
      expect(DEFAULT_POLICY.archiveAfterDays).toBe(60);
    });
  });

  describe('getPolicy', () => {
    test('returns defaults for unknown org', () => {
      const policy = getPolicy('test-org-new');
      expect(policy.retentionDays).toBe(90);
      expect(policy.maxEntries).toBe(5000);
      expect(policy.archiveEnabled).toBe(true);
    });
  });

  describe('setPolicy', () => {
    test('updates retentionDays', () => {
      const policy = setPolicy('test-org-1', { retentionDays: 180 });
      expect(policy.retentionDays).toBe(180);
    });

    test('clamps retentionDays to valid range', () => {
      const tooLow = setPolicy('test-org-clamp1', { retentionDays: 0 });
      expect(tooLow.retentionDays).toBe(1);

      const tooHigh = setPolicy('test-org-clamp2', { retentionDays: 9999 });
      expect(tooHigh.retentionDays).toBe(3650);
    });

    test('updates maxEntries with clamping', () => {
      const policy = setPolicy('test-org-2', { maxEntries: 10000 });
      expect(policy.maxEntries).toBe(10000);

      const clamped = setPolicy('test-org-2', { maxEntries: 10 });
      expect(clamped.maxEntries).toBe(100);
    });

    test('updates archiveEnabled boolean', () => {
      const policy = setPolicy('test-org-3', { archiveEnabled: false });
      expect(policy.archiveEnabled).toBe(false);
    });

    test('updates archiveAfterDays with clamping', () => {
      const policy = setPolicy('test-org-4', { archiveAfterDays: 30 });
      expect(policy.archiveAfterDays).toBe(30);
    });

    test('preserves existing fields on partial update', () => {
      setPolicy('test-org-5', { retentionDays: 200, maxEntries: 8000 });
      const updated = setPolicy('test-org-5', { archiveEnabled: false });
      expect(updated.retentionDays).toBe(200);
      expect(updated.maxEntries).toBe(8000);
      expect(updated.archiveEnabled).toBe(false);
    });
  });

  describe('resetPolicy', () => {
    test('resets to defaults', () => {
      setPolicy('test-org-reset', { retentionDays: 365, maxEntries: 99999 });
      const policy = resetPolicy('test-org-reset');
      expect(policy.retentionDays).toBe(90);
      expect(policy.maxEntries).toBe(5000);
    });
  });

  describe('getAllPolicies', () => {
    test('returns map of org policies', () => {
      setPolicy('test-org-all1', { retentionDays: 30 });
      const all = getAllPolicies();
      expect(all['test-org-all1']).toBeDefined();
      expect(all['test-org-all1'].retentionDays).toBe(30);
    });
  });

  describe('getArchivePath', () => {
    test('returns a path with orgId in filename', () => {
      const p = getArchivePath('my-org');
      expect(p).toContain('audit-archive-my-org.json');
    });
  });
});
