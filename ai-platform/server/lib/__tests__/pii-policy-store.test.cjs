'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `pii-policy-test-${Date.now()}`);
const policyPath = path.join(tmpDir, 'pii-policies.json');

process.env.PII_POLICY_PATH = policyPath;

const piiPolicyStore = require('../pii-policy-store.cjs');

describe('pii-policy-store', () => {
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('COMPLIANCE_FRAMEWORKS', () => {
    test('exports supported compliance frameworks', () => {
      expect(Array.isArray(piiPolicyStore.COMPLIANCE_FRAMEWORKS)).toBe(true);
      expect(piiPolicyStore.COMPLIANCE_FRAMEWORKS).toContain('GDPR');
      expect(piiPolicyStore.COMPLIANCE_FRAMEWORKS).toContain('HIPAA');
      expect(piiPolicyStore.COMPLIANCE_FRAMEWORKS).toContain('PCI-DSS');
    });
  });

  describe('createPolicy', () => {
    test('creates a policy with compliance tags', () => {
      const result = piiPolicyStore.createPolicy({
        orgId: 'test-org',
        name: 'Email Pattern',
        description: 'Masks email addresses',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flags: 'gi',
        replacement: '[REDACTED-EMAIL]',
        severity: 'high',
        compliance: ['GDPR', 'CCPA'],
      });
      expect(result.success).toBe(true);
      expect(result.policy.compliance).toEqual(['GDPR', 'CCPA']);
      expect(result.policy.isDefault).toBe(false);
    });

    test('filters out invalid compliance frameworks', () => {
      const result = piiPolicyStore.createPolicy({
        orgId: 'test-org',
        name: 'Test Pattern',
        pattern: '\\d{3}',
        replacement: '[REDACTED]',
        compliance: ['GDPR', 'INVALID_FRAMEWORK'],
      });
      expect(result.success).toBe(true);
      expect(result.policy.compliance).toEqual(['GDPR']);
    });

    test('rejects invalid regex pattern', () => {
      const result = piiPolicyStore.createPolicy({
        orgId: 'test-org',
        name: 'Bad Pattern',
        pattern: '[invalid',
        replacement: '[REDACTED]',
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid regex/);
    });
  });

  describe('updatePolicy', () => {
    test('updates compliance tags with validation', () => {
      const created = piiPolicyStore.createPolicy({
        orgId: 'test-org-update',
        name: 'Test',
        pattern: '\\d{3}',
        replacement: '[REDACTED]',
      });
      const updated = piiPolicyStore.updatePolicy(created.policy.id, {
        compliance: ['HIPAA', 'SOX'],
      });
      expect(updated.success).toBe(true);
      expect(updated.policy.compliance).toEqual(['HIPAA', 'SOX']);
    });

    test('rejects non-array compliance on update', () => {
      const created = piiPolicyStore.createPolicy({
        orgId: 'test-org-update2',
        name: 'Test',
        pattern: '\\d{3}',
        replacement: '[REDACTED]',
      });
      const updated = piiPolicyStore.updatePolicy(created.policy.id, {
        compliance: 'GDPR',
      });
      expect(updated.success).toBe(false);
    });
  });

  describe('redactText', () => {
    test('redacts email addresses using created policy', () => {
      piiPolicyStore.createPolicy({
        orgId: 'redact-test-org',
        name: 'Email',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flags: 'gi',
        replacement: '[REDACTED-EMAIL]',
        severity: 'high',
        enabled: true,
      });
      const { text, matches } = piiPolicyStore.redactText(
        'Contact us at admin@example.com or support@test.org',
        'redact-test-org'
      );
      expect(text).toBe('Contact us at [REDACTED-EMAIL] or [REDACTED-EMAIL]');
      expect(matches.length).toBe(1);
      expect(matches[0].count).toBe(2);
    });

    test('returns original text when no patterns match', () => {
      piiPolicyStore.createPolicy({
        orgId: 'redact-test-noop',
        name: 'SSN',
        pattern: '\\b\\d{3}-?\\d{2}-?\\d{4}\\b',
        flags: 'g',
        replacement: '[REDACTED-SSN]',
        enabled: true,
      });
      const { text, matches } = piiPolicyStore.redactText(
        'No sensitive data here',
        'redact-test-noop'
      );
      expect(text).toBe('No sensitive data here');
      expect(matches.length).toBe(0);
    });

    test('handles null text gracefully', () => {
      const { text, matches } = piiPolicyStore.redactText(null, 'any-org');
      expect(text).toBe(null);
      expect(matches).toEqual([]);
    });

    test('handles org with no policies', () => {
      const { text, matches } = piiPolicyStore.redactText(
        'test@example.com',
        'org-with-no-policies'
      );
      expect(text).toBe('test@example.com');
      expect(matches).toEqual([]);
    });
  });

  describe('seedDefaults', () => {
    test('seeds default patterns for org with no existing policies', () => {
      const seeded = piiPolicyStore.seedDefaults('seed-test-org');
      expect(seeded).toBeGreaterThan(0);
      const policies = piiPolicyStore.getPolicies('seed-test-org');
      expect(policies.length).toBeGreaterThan(0);
      const emailPolicy = policies.find((p) => p.name === 'Email Address');
      expect(emailPolicy).toBeDefined();
      expect(emailPolicy.isDefault).toBe(true);
      expect(emailPolicy.compliance).toContain('GDPR');
      const ssnPolicy = policies.find((p) => p.name === 'US Social Security Number');
      expect(ssnPolicy).toBeDefined();
      expect(ssnPolicy.compliance).toContain('HIPAA');
    });

    test('does not seed when policies already exist', () => {
      piiPolicyStore.createPolicy({
        orgId: 'seed-skip-org',
        name: 'Custom',
        pattern: '\\d+',
        replacement: '[REDACTED]',
      });
      const seeded = piiPolicyStore.seedDefaults('seed-skip-org');
      expect(seeded).toBe(0);
    });
  });

  describe('getStats', () => {
    test('returns stats with compliance breakdown', () => {
      piiPolicyStore.seedDefaults('stats-test-org');
      const stats = piiPolicyStore.getStats('stats-test-org');
      expect(stats.totalPolicies).toBeGreaterThan(0);
      expect(stats.enabledPolicies).toBeGreaterThan(0);
      expect(stats.defaultCount).toBeGreaterThan(0);
      expect(stats.byCompliance).toBeDefined();
      expect(stats.byCompliance.GDPR).toBeGreaterThan(0);
    });
  });

  describe('validateRegex', () => {
    test('validates a correct regex', () => {
      const result = piiPolicyStore.validateRegex('\\d{3}-\\d{4}', 'g');
      expect(result.valid).toBe(true);
    });

    test('rejects an invalid regex', () => {
      const result = piiPolicyStore.validateRegex('[invalid', 'g');
      expect(result.valid).toBe(false);
    });
  });
});
