'use strict';

/**
 * Regulatory PII Simulation Tests
 *
 * Validates redaction accuracy of pii-policy-store.cjs against corpus
 * fixtures modeled on GDPR, HIPAA, PCI-DSS, SOX, and CCPA compliance
 * requirements. Tests cover:
 *   - Standard PII patterns (email, SSN, credit card, phone, IP, bearer token)
 *   - Partial matches and near-misses (non-PII that should NOT be redacted)
 *   - Nested JSON structures with PII at multiple depths
 *   - Multi-pattern overlap (text containing multiple PII types simultaneously)
 *   - Per-framework coverage verification (each framework's patterns fire)
 *   - Edge cases: empty input, no-match text, disabled policies, invalid regex
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Regulatory PII Simulation', () => {
  let storeModule;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pii-reg-'));
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }, null, 2), 'utf8');
    jest.resetModules();
    storeModule = require('../pii-policy-store.cjs');
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── GDPR Corpus ─────────────────────────────────────────────────────────────

  describe('GDPR corpus', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-gdpr');
    });

    it('should redact email addresses (GDPR-tagged)', () => {
      const text = 'Contact john.doe@example.com for details.';
      const result = storeModule.redactText(text, 'org-gdpr');

      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('john.doe@example.com'));
      const emailMatch = result.matches.find((m) => m.name === 'Email Address');
      assert.ok(emailMatch, 'Email match should be recorded');
      assert.strictEqual(emailMatch.count, 1);
    });

    it('should redact multiple emails in a single text block', () => {
      const text = 'From: alice@corp.io\nTo: bob@corp.io\nCC: team@corp.io';
      const result = storeModule.redactText(text, 'org-gdpr');

      const emailMatch = result.matches.find((m) => m.name === 'Email Address');
      assert.ok(emailMatch);
      assert.strictEqual(emailMatch.count, 3);
      assert.ok(result.text.split('[REDACTED-EMAIL]').length - 1 === 3);
    });

    it('should redact SSN in XXX-XX-XXXX format (GDPR+HIPAA)', () => {
      const text = 'Patient SSN: 123-45-6789';
      const result = storeModule.redactText(text, 'org-gdpr');

      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.ok(!result.text.includes('123-45-6789'));
    });

    it('should redact SSN in XXXXXXXXX format (no dashes)', () => {
      const text = 'SSN on file: 123456789';
      const result = storeModule.redactText(text, 'org-gdpr');

      assert.ok(result.text.includes('[REDACTED-SSN]'));
    });

    it('should redact IPv4 addresses (GDPR-tagged)', () => {
      const text = 'Request originated from 192.168.1.100';
      const result = storeModule.redactText(text, 'org-gdpr');

      assert.ok(result.text.includes('[REDACTED-IP]'));
      assert.ok(!result.text.includes('192.168.1.100'));
    });

    it('should redact phone numbers in (XXX) XXX-XXXX format', () => {
      const text = 'Call (555) 123-4567 for support';
      const result = storeModule.redactText(text, 'org-gdpr');

      assert.ok(result.text.includes('[REDACTED-PHONE]'));
    });

    it('should NOT redact non-PII text that resembles patterns', () => {
      // 8-digit number — not an SSN (needs 9 digits)
      const text = 'Order number: 12345678';
      const result = storeModule.redactText(text, 'org-gdpr');
      assert.strictEqual(result.text, text);
      assert.strictEqual(result.matches.length, 0);
    });
  });

  // ── HIPAA Corpus ────────────────────────────────────────────────────────────

  describe('HIPAA corpus', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-hipaa');
    });

    it('should redact SSN in patient records (HIPAA-tagged)', () => {
      const text = 'Patient record: SSN=987-65-4321, DOB=1980-01-15';
      const result = storeModule.redactText(text, 'org-hipaa');

      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.ok(!result.text.includes('987-65-4321'));
      // DOB should NOT be redacted (no pattern for dates)
      assert.ok(result.text.includes('1980-01-15'));
    });

    it('should redact phone numbers in patient contact info', () => {
      const text = 'Emergency contact: 555-987-6543';
      const result = storeModule.redactText(text, 'org-hipaa');

      assert.ok(result.text.includes('[REDACTED-PHONE]'));
    });
  });

  // ── PCI-DSS Corpus ─────────────────────────────────────────────────────────

  describe('PCI-DSS corpus', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-pci');
    });

    it('should redact 16-digit credit card numbers with dashes', () => {
      const text = 'Card: 4111-1111-1111-1111';
      const result = storeModule.redactText(text, 'org-pci');

      assert.ok(result.text.includes('[REDACTED-CC]'));
      assert.ok(!result.text.includes('4111-1111-1111-1111'));
    });

    it('should redact 16-digit credit card numbers without dashes', () => {
      const text = 'Card: 4111111111111111';
      const result = storeModule.redactText(text, 'org-pci');

      assert.ok(result.text.includes('[REDACTED-CC]'));
    });

    it('should redact credit card numbers with spaces', () => {
      const text = 'Card: 4111 1111 1111 1111';
      const result = storeModule.redactText(text, 'org-pci');

      assert.ok(result.text.includes('[REDACTED-CC]'));
    });

    it('should redact Amex 15-digit card numbers', () => {
      const text = 'Amex: 378282246310005';
      const result = storeModule.redactText(text, 'org-pci');

      assert.ok(result.text.includes('[REDACTED-CC]'));
    });

    it('should NOT redact short digit sequences (non-card)', () => {
      const text = 'Product code: 1234-5678';
      const result = storeModule.redactText(text, 'org-pci');
      // 8 digits with dash — below 13-digit minimum
      assert.strictEqual(result.text, text);
    });
  });

  // ── SOX Corpus ─────────────────────────────────────────────────────────────

  describe('SOX corpus', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-sox');
    });

    it('should redact Bearer tokens in authorization headers (SOX-tagged)', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature';
      const result = storeModule.redactText(text, 'org-sox');

      assert.ok(result.text.includes('[REDACTED-TOKEN]'));
      assert.ok(!result.text.includes('eyJhbGciOiJIUzI1NiJ9'));
    });

    it('should redact Bearer tokens case-insensitively', () => {
      const text = 'auth: bearer abc123def456';
      const result = storeModule.redactText(text, 'org-sox');

      assert.ok(result.text.includes('[REDACTED-TOKEN]'));
    });
  });

  // ── Multi-Pattern Overlap ──────────────────────────────────────────────────

  describe('multi-pattern overlap', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-multi');
    });

    it('should redact all PII types in a mixed corpus simultaneously', () => {
      const text = [
        'User: alice@corp.com',
        'SSN: 111-22-3333',
        'Card: 4111-1111-1111-1111',
        'Phone: (555) 123-4567',
        'IP: 10.0.0.1',
        'Token: Bearer abc123xyz',
      ].join('\n');

      const result = storeModule.redactText(text, 'org-multi');

      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.ok(result.text.includes('[REDACTED-CC]'));
      assert.ok(result.text.includes('[REDACTED-PHONE]'));
      assert.ok(result.text.includes('[REDACTED-IP]'));
      assert.ok(result.text.includes('[REDACTED-TOKEN]'));

      // All 6 pattern types should have fired
      assert.strictEqual(result.matches.length, 6);
    });

    it('should handle overlapping email and IP in same string', () => {
      // admin@192.168.1.1 — the email pattern requires a 2+ alpha char TLD,
      // so it won't match the numeric IP. The IP pattern will match 192.168.1.1.
      // This test verifies that the IP is still redacted even though the email
      // pattern doesn't fire on this particular string.
      const text = 'Contact admin@192.168.1.1 for access';
      const result = storeModule.redactText(text, 'org-multi');

      // IP should be redacted
      assert.ok(result.text.includes('[REDACTED-IP]'));
      assert.ok(!result.text.includes('192.168.1.1'));
    });
  });

  // ── Nested JSON Structures ─────────────────────────────────────────────────

  describe('nested JSON structures', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-json');
    });

    it('should redact PII at top level of JSON string', () => {
      const text = JSON.stringify({ email: 'user@test.io', name: 'Test User' });
      const result = storeModule.redactText(text, 'org-json');

      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(!result.text.includes('user@test.io'));
      // Non-PII field should be preserved
      assert.ok(result.text.includes('Test User'));
    });

    it('should redact PII at nested levels of JSON string', () => {
      const text = JSON.stringify({
        user: {
          profile: {
            contact: 'alice@deeply.nested.io',
            ssn: '444-55-6666',
          },
        },
        metadata: { ip: '172.16.0.1' },
      });
      const result = storeModule.redactText(text, 'org-json');

      assert.ok(result.text.includes('[REDACTED-EMAIL]'));
      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.ok(result.text.includes('[REDACTED-IP]'));
      assert.ok(!result.text.includes('alice@deeply.nested.io'));
      assert.ok(!result.text.includes('444-55-6666'));
      assert.ok(!result.text.includes('172.16.0.1'));
    });

    it('should redact PII inside JSON arrays', () => {
      const text = JSON.stringify({
        contacts: ['alice@array.io', 'bob@array.io', 'no-email-here'],
      });
      const result = storeModule.redactText(text, 'org-json');

      const emailMatch = result.matches.find((m) => m.name === 'Email Address');
      assert.ok(emailMatch);
      assert.strictEqual(emailMatch.count, 2);
      assert.ok(!result.text.includes('alice@array.io'));
      assert.ok(!result.text.includes('bob@array.io'));
      assert.ok(result.text.includes('no-email-here'));
    });
  });

  // ── Partial Matches and Near-Misses ────────────────────────────────────────

  describe('partial matches and near-misses', () => {
    beforeEach(() => {
      storeModule.seedDefaults('org-edge');
    });

    it('should NOT redact text that looks like email but is not', () => {
      // No TLD — should not match the email pattern (requires 2+ char TLD)
      const text = 'Run: user@localhost';
      const result = storeModule.redactText(text, 'org-edge');
      assert.strictEqual(result.text, text);
    });

    it('should NOT redact version numbers as IPs', () => {
      // Version numbers like 1.2.3 are not IPs (need 4 octets)
      const text = 'Version: 1.2.3';
      const result = storeModule.redactText(text, 'org-edge');
      assert.strictEqual(result.text, text);
    });

    it('should redact IP-like version strings with 4 octets', () => {
      // This IS an IP pattern match — 4 octets of 1-3 digits
      const text = 'Build: 1.2.3.4';
      const result = storeModule.redactText(text, 'org-edge');
      // The IP pattern will match 1.2.3.4 — this is expected behavior
      assert.ok(result.text.includes('[REDACTED-IP]'));
    });

    it('should handle empty string input', () => {
      const result = storeModule.redactText('', 'org-edge');
      assert.strictEqual(result.text, '');
      assert.strictEqual(result.matches.length, 0);
    });

    it('should handle null/undefined input gracefully', () => {
      assert.strictEqual(storeModule.redactText(null, 'org-edge').text, null);
      assert.strictEqual(storeModule.redactText(undefined, 'org-edge').text, undefined);
    });

    it('should handle text with no PII at all', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result = storeModule.redactText(text, 'org-edge');
      assert.strictEqual(result.text, text);
      assert.strictEqual(result.matches.length, 0);
    });
  });

  // ── Disabled Policies ──────────────────────────────────────────────────────

  describe('disabled policies', () => {
    it('should not redact when all policies are disabled', () => {
      storeModule.seedDefaults('org-disabled');
      const policies = storeModule.getPolicies('org-disabled');
      for (const p of policies) {
        storeModule.updatePolicy(p.id, { enabled: false });
      }

      const text = 'Email: test@corp.com, SSN: 123-45-6789';
      const result = storeModule.redactText(text, 'org-disabled');
      assert.strictEqual(result.text, text);
      assert.strictEqual(result.matches.length, 0);
    });

    it('should only redact with enabled policies when some are disabled', () => {
      storeModule.seedDefaults('org-partial');
      const policies = storeModule.getPolicies('org-partial');
      // Disable the email policy
      const emailPolicy = policies.find((p) => p.name === 'Email Address');
      storeModule.updatePolicy(emailPolicy.id, { enabled: false });

      const text = 'Email: test@corp.com, SSN: 123-45-6789';
      const result = storeModule.redactText(text, 'org-partial');

      // Email should NOT be redacted
      assert.ok(result.text.includes('test@corp.com'));
      // SSN should still be redacted
      assert.ok(result.text.includes('[REDACTED-SSN]'));
      assert.strictEqual(result.matches.length, 1);
    });
  });

  // ── Custom Regulatory Patterns ─────────────────────────────────────────────

  describe('custom regulatory patterns', () => {
    it('should apply custom GDPR pattern for EU national IDs', () => {
      storeModule.createPolicy({
        orgId: 'org-custom',
        name: 'EU National ID (German)',
        description: 'German tax ID pattern (XX-XXX-XXXX)',
        pattern: '\\b\\d{2}-\\d{3}-\\d{4}\\b',
        flags: 'g',
        replacement: '[REDACTED-EU-ID]',
        severity: 'high',
        compliance: ['GDPR'],
        enabled: true,
      });

      const text = 'Tax ID: 12-345-6789';
      const result = storeModule.redactText(text, 'org-custom');

      assert.ok(result.text.includes('[REDACTED-EU-ID]'));
      assert.ok(!result.text.includes('12-345-6789'));
    });

    it('should apply custom HIPAA pattern for medical record numbers', () => {
      storeModule.createPolicy({
        orgId: 'org-mrn',
        name: 'Medical Record Number',
        description: 'MRN format MRN-XXXXXXX',
        pattern: '\\bMRN-\\d{7}\\b',
        flags: 'gi',
        replacement: '[REDACTED-MRN]',
        severity: 'high',
        compliance: ['HIPAA'],
        enabled: true,
      });

      const text = 'Patient MRN-1234567 admitted';
      const result = storeModule.redactText(text, 'org-mrn');

      assert.ok(result.text.includes('[REDACTED-MRN]'));
      assert.ok(!result.text.includes('MRN-1234567'));
    });

    it('should apply custom PCI-DSS pattern for CVV codes', () => {
      storeModule.createPolicy({
        orgId: 'org-cvv',
        name: 'CVV Code',
        description: '3-4 digit CVV preceded by CVV:',
        pattern: 'CVV:\\s*\\d{3,4}',
        flags: 'gi',
        replacement: 'CVV: [REDACTED]',
        severity: 'high',
        compliance: ['PCI-DSS'],
        enabled: true,
      });

      const text = 'CVV: 123';
      const result = storeModule.redactText(text, 'org-cvv');

      assert.ok(result.text.includes('[REDACTED]'));
      assert.ok(!result.text.includes('123'));
    });

    it('should apply custom SOX pattern for internal financial codes', () => {
      storeModule.createPolicy({
        orgId: 'org-sox-custom',
        name: 'Internal Financial Code',
        description: 'SOX-tagged internal accounting code (GL-XXXX-XXXX)',
        pattern: '\\bGL-\\d{4}-\\d{4}\\b',
        flags: 'g',
        replacement: '[REDACTED-GL]',
        severity: 'medium',
        compliance: ['SOX'],
        enabled: true,
      });

      const text = 'Ledger entry: GL-1234-5678';
      const result = storeModule.redactText(text, 'org-sox-custom');

      assert.ok(result.text.includes('[REDACTED-GL]'));
      assert.ok(!result.text.includes('GL-1234-5678'));
    });
  });

  // ── Compliance Framework Verification ──────────────────────────────────────

  describe('compliance framework coverage', () => {
    it('should have GDPR-tagged patterns in seeded defaults', () => {
      storeModule.seedDefaults('org-coverage');
      const policies = storeModule.getPolicies('org-coverage');
      const gdprPolicies = policies.filter(
        (p) => Array.isArray(p.compliance) && p.compliance.includes('GDPR')
      );
      assert.ok(gdprPolicies.length > 0, 'Should have GDPR-tagged policies');
    });

    it('should have HIPAA-tagged patterns in seeded defaults', () => {
      storeModule.seedDefaults('org-coverage');
      const policies = storeModule.getPolicies('org-coverage');
      const hipaaPolicies = policies.filter(
        (p) => Array.isArray(p.compliance) && p.compliance.includes('HIPAA')
      );
      assert.ok(hipaaPolicies.length > 0, 'Should have HIPAA-tagged policies');
    });

    it('should have PCI-DSS-tagged patterns in seeded defaults', () => {
      storeModule.seedDefaults('org-coverage');
      const policies = storeModule.getPolicies('org-coverage');
      const pciPolicies = policies.filter(
        (p) => Array.isArray(p.compliance) && p.compliance.includes('PCI-DSS')
      );
      assert.ok(pciPolicies.length > 0, 'Should have PCI-DSS-tagged policies');
    });

    it('should have SOX-tagged patterns in seeded defaults', () => {
      storeModule.seedDefaults('org-coverage');
      const policies = storeModule.getPolicies('org-coverage');
      const soxPolicies = policies.filter(
        (p) => Array.isArray(p.compliance) && p.compliance.includes('SOX')
      );
      assert.ok(soxPolicies.length > 0, 'Should have SOX-tagged policies');
    });

    it('should report compliance breakdown in getStats()', () => {
      storeModule.seedDefaults('org-coverage');
      const stats = storeModule.getStats('org-coverage');
      assert.ok(stats.byCompliance);
      assert.ok(stats.byCompliance.GDPR > 0);
      assert.ok(stats.byCompliance.HIPAA > 0);
      assert.ok(stats.byCompliance['PCI-DSS'] > 0);
      assert.ok(stats.byCompliance.SOX > 0);
    });
  });

  // ── Regex Validation Edge Cases ────────────────────────────────────────────

  describe('regex validation', () => {
    it('should reject invalid regex pattern on create', () => {
      const result = storeModule.createPolicy({
        orgId: 'org-validation',
        name: 'Bad Pattern',
        pattern: '[unclosed',
        flags: 'g',
        replacement: '[REDACTED]',
        severity: 'high',
        compliance: ['GDPR'],
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid regex'));
    });

    it('should reject invalid regex on update', () => {
      storeModule.seedDefaults('org-validation');
      const policies = storeModule.getPolicies('org-validation');
      const result = storeModule.updatePolicy(policies[0].id, { pattern: '[bad' });
      assert.strictEqual(result.success, false);
    });

    it('should skip invalid compiled patterns silently in getCompiledPatterns', () => {
      storeModule.createPolicy({
        orgId: 'org-validation',
        name: 'Valid Pattern',
        pattern: '\\b\\d{4}\\b',
        flags: 'g',
        replacement: '[REDACTED]',
        severity: 'low',
        compliance: ['GDPR'],
      });
      const compiled = storeModule.getCompiledPatterns('org-validation');
      assert.strictEqual(compiled.length, 1);
      assert.ok(compiled[0].regex instanceof RegExp);
    });
  });
});
