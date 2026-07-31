'use strict';

/**
 * Tests for audit log PII scrubbing integration.
 *
 * Verifies that audit log entries are scrubbed of PII before being written
 * to disk. Tests scrubAuditEntry() directly and via the log() function's
 * integrated scrubbing path.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Audit Log PII Scrubbing', () => {
  let auditLogger;
  let piiStore;
  let _tempLogPath;
  let _tempPolicyPath;
  let _tempDir;

  beforeEach(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-audit-scrub-'));
    _tempLogPath = path.join(_tempDir, 'audit-log.json');
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');

    process.env.AUDIT_LOG_PATH = _tempLogPath;
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    process.env.AUDIT_LOG_SCRUB_PII = 'true';

    fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');

    jest.resetModules();
    auditLogger = require('../audit-logger.cjs');
    piiStore = require('../pii-policy-store.cjs');

    // Seed default PII patterns for the test org
    piiStore.seedDefaults('org-scrub');
  });

  afterEach(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── scrubAuditEntry ────────────────────────────────────────────────────────

  describe('scrubAuditEntry', () => {
    it('should scrub email from actorEmail', () => {
      const entry = {
        id: 'test-1',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'admin@org-scrub.com',
        actorEmail: 'admin@org-scrub.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        changes: [],
        metadata: null,
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.ok(entry.actorEmail.includes('[REDACTED-EMAIL]'));
      assert.ok(!entry.actorEmail.includes('admin@org-scrub.com'));
    });

    it('should scrub email from actorId', () => {
      const entry = {
        id: 'test-2',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'user@org-scrub.com',
        actorEmail: 'user@org-scrub.com',
        action: 'UPDATE',
        entity: 'test',
        entityId: '2',
        changes: [],
        metadata: null,
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.ok(entry.actorId.includes('[REDACTED-EMAIL]'));
      assert.ok(!entry.actorId.includes('user@org-scrub.com'));
    });

    it('should scrub PII from metadata object', () => {
      const entry = {
        id: 'test-3',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'test',
        entityId: '3',
        changes: [],
        metadata: {
          ip: '192.168.1.100',
          route: '/api/users',
          contact: 'alice@test.com',
        },
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.ok(entry.metadata.ip.includes('[REDACTED-IP]'));
      assert.ok(entry.metadata.contact.includes('[REDACTED-EMAIL]'));
      assert.ok(!entry.metadata.contact.includes('alice@test.com'));
      // Non-PII fields should be unchanged
      assert.strictEqual(entry.metadata.route, '/api/users');
    });

    it('should scrub PII from changes array (oldValue/newValue)', () => {
      const entry = {
        id: 'test-4',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'UPDATE',
        entity: 'user',
        entityId: '4',
        changes: [
          {
            field: 'email',
            oldValue: 'old@test.com',
            newValue: 'new@test.com',
          },
          {
            field: 'name',
            oldValue: 'Alice',
            newValue: 'Bob',
          },
        ],
        metadata: null,
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.ok(entry.changes[0].oldValue.includes('[REDACTED-EMAIL]'));
      assert.ok(entry.changes[0].newValue.includes('[REDACTED-EMAIL]'));
      assert.ok(!entry.changes[0].oldValue.includes('old@test.com'));
      assert.ok(!entry.changes[0].newValue.includes('new@test.com'));
      // Non-PII changes should be unchanged
      assert.strictEqual(entry.changes[1].oldValue, 'Alice');
      assert.strictEqual(entry.changes[1].newValue, 'Bob');
    });

    it('should scrub PII from nested metadata objects', () => {
      const entry = {
        id: 'test-5',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'test',
        entityId: '5',
        changes: [],
        metadata: {
          user: {
            email: 'deep@test.com',
            phone: '555-123-4567',
          },
          tags: ['admin@test.com', 'user@test.com'],
        },
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.ok(entry.metadata.user.email.includes('[REDACTED-EMAIL]'));
      assert.ok(entry.metadata.user.phone.includes('[REDACTED-PHONE]'));
      assert.ok(entry.metadata.tags[0].includes('[REDACTED-EMAIL]'));
      assert.ok(entry.metadata.tags[1].includes('[REDACTED-EMAIL]'));
    });

    it('should NOT scrub structural fields (id, orgId, timestamp, action, entity, entityId)', () => {
      const entry = {
        id: 'test-6',
        orgId: 'org-scrub',
        timestamp: '2026-01-01T00:00:00.000Z',
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'user@entity.com', // looks like email but is entity type
        entityId: 'ent-123-456-7890', // looks like SSN but is entity ID
        changes: [],
        metadata: null,
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.strictEqual(entry.id, 'test-6');
      assert.strictEqual(entry.orgId, 'org-scrub');
      assert.strictEqual(entry.timestamp, '2026-01-01T00:00:00.000Z');
      assert.strictEqual(entry.action, 'CREATE');
      assert.strictEqual(entry.entity, 'user@entity.com');
      assert.strictEqual(entry.entityId, 'ent-123-456-7890');
    });

    it('should handle null/undefined metadata and empty changes', () => {
      const entry = {
        id: 'test-7',
        orgId: 'org-scrub',
        timestamp: new Date().toISOString(),
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'test',
        entityId: '7',
        changes: [],
        metadata: null,
      };

      auditLogger.scrubAuditEntry(entry, 'org-scrub');
      assert.strictEqual(entry.metadata, null);
      assert.strictEqual(entry.changes.length, 0);
    });
  });

  // ── log() integration ──────────────────────────────────────────────────────

  describe('log() integration', () => {
    it('should scrub PII from entry before writing to disk', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'admin@org-scrub.com',
        actorEmail: 'admin@org-scrub.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { ip: '10.0.0.1', contact: 'alice@test.com' },
      });

      // The returned entry should be scrubbed
      assert.ok(entry.actorEmail.includes('[REDACTED-EMAIL]'));
      assert.ok(entry.metadata.ip.includes('[REDACTED-IP]'));
      assert.ok(entry.metadata.contact.includes('[REDACTED-EMAIL]'));

      // Verify the on-disk store is also scrubbed
      const store = JSON.parse(fs.readFileSync(_tempLogPath, 'utf8'));
      const key = `org-scrub::${entry.id}`;
      const stored = store.entries[key];
      assert.ok(stored.actorEmail.includes('[REDACTED-EMAIL]'));
      assert.ok(stored.metadata.contact.includes('[REDACTED-EMAIL]'));
      assert.ok(!stored.metadata.contact.includes('alice@test.com'));
    });

    it('should scrub PII from changes in log()', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'UPDATE',
        entity: 'user',
        entityId: '2',
        oldValue: { email: 'old@test.com', name: 'Alice' },
        newValue: { email: 'new@test.com', name: 'Bob' },
      });

      // Changes should be scrubbed
      const emailChange = entry.changes.find((c) => c.field === 'email');
      assert.ok(emailChange, 'Should have an email change');
      assert.ok(emailChange.oldValue.includes('[REDACTED-EMAIL]'));
      assert.ok(emailChange.newValue.includes('[REDACTED-EMAIL]'));

      // Non-PII changes should be unchanged
      const nameChange = entry.changes.find((c) => c.field === 'name');
      assert.ok(nameChange);
      assert.strictEqual(nameChange.oldValue, 'Alice');
      assert.strictEqual(nameChange.newValue, 'Bob');
    });

    it('should compute hash over scrubbed entry (chain remains verifiable)', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'admin@org-scrub.com',
        actorEmail: 'admin@org-scrub.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { contact: 'alice@test.com' },
      });

      // Verify the chain is valid after scrubbing
      const result = auditLogger.verifyChain('org-scrub');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.verifiedEntries, 1);
      assert.strictEqual(result.tamperedEntries.length, 0);
    });

    it('should maintain chain validity across multiple scrubbed entries', () => {
      for (let i = 0; i < 5; i++) {
        auditLogger.log({
          orgId: 'org-scrub',
          actorId: `user${i}@org-scrub.com`,
          actorEmail: `user${i}@org-scrub.com`,
          action: 'CREATE',
          entity: 'test',
          entityId: String(i),
          metadata: { ip: `10.0.0.${i}`, contact: `contact${i}@test.com` },
        });
      }

      const result = auditLogger.verifyChain('org-scrub');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.totalEntries, 5);
      assert.strictEqual(result.verifiedEntries, 5);
    });
  });

  // ── Disabled mode ──────────────────────────────────────────────────────────

  describe('disabled mode (AUDIT_LOG_SCRUB_PII=false)', () => {
    it('should NOT scrub PII when scrubbing is disabled', () => {
      process.env.AUDIT_LOG_SCRUB_PII = 'false';
      jest.resetModules();
      const disabledLogger = require('../audit-logger.cjs');

      const entry = disabledLogger.log({
        orgId: 'org-scrub',
        actorId: 'admin@org-scrub.com',
        actorEmail: 'admin@org-scrub.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { contact: 'alice@test.com' },
      });

      // PII should NOT be scrubbed
      assert.strictEqual(entry.actorEmail, 'admin@org-scrub.com');
      assert.strictEqual(entry.metadata.contact, 'alice@test.com');

      // Chain should still be valid
      const result = disabledLogger.verifyChain('org-scrub');
      assert.strictEqual(result.valid, true);
    });
  });

  // ── No PII policies ────────────────────────────────────────────────────────

  describe('no PII policies for org', () => {
    it('should pass through when org has no PII policies', () => {
      const entry = auditLogger.log({
        orgId: 'org-no-policies',
        actorId: 'admin@org-no-policies.com',
        actorEmail: 'admin@org-no-policies.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { contact: 'alice@test.com' },
      });

      // No policies for this org — PII should pass through
      assert.strictEqual(entry.actorEmail, 'admin@org-no-policies.com');
      assert.strictEqual(entry.metadata.contact, 'alice@test.com');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle entry with no metadata field', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'admin@org-scrub.com',
        actorEmail: 'admin@org-scrub.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        // No metadata field
      });

      assert.ok(entry.actorEmail.includes('[REDACTED-EMAIL]'));
      assert.strictEqual(entry.metadata, null);
    });

    it('should handle metadata with array values', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { emails: ['a@test.com', 'b@test.com'], count: 2 },
      });

      assert.ok(entry.metadata.emails[0].includes('[REDACTED-EMAIL]'));
      assert.ok(entry.metadata.emails[1].includes('[REDACTED-EMAIL]'));
      assert.strictEqual(entry.metadata.count, 2); // Non-string unchanged
    });

    it('should handle Bearer token in metadata', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        metadata: { auth: 'Bearer abc123xyz' },
      });

      assert.ok(entry.metadata.auth.includes('[REDACTED-TOKEN]'));
      assert.ok(!entry.metadata.auth.includes('abc123xyz'));
    });

    it('should handle SSN in changes', () => {
      const entry = auditLogger.log({
        orgId: 'org-scrub',
        actorId: 'unknown',
        actorEmail: 'unknown',
        action: 'UPDATE',
        entity: 'user',
        entityId: '1',
        oldValue: { ssn: '123-45-6789' },
        newValue: { ssn: '987-65-4321' },
      });

      const ssnChange = entry.changes.find((c) => c.field === 'ssn');
      assert.ok(ssnChange);
      assert.ok(ssnChange.oldValue.includes('[REDACTED-SSN]'));
      assert.ok(ssnChange.newValue.includes('[REDACTED-SSN]'));
    });
  });
});
