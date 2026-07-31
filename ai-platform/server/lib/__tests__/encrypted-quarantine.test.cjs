'use strict';

/**
 * Tests for per-tenant encrypted quarantine storage in audit-logger.cjs.
 *
 * Verifies that quarantined audit entries are:
 *   1. Stored in per-tenant directory paths (not a shared global file)
 *   2. Encrypted at rest using encryptForDirectory() with sb-dir: prefix
 *   3. Readable only with the correct orgId (cross-tenant isolation)
 *   4. Backward compatible with legacy unencrypted quarantine files
 *
 * Functions under test:
 *   - getTenantQuarantinePath(orgId)
 *   - readTenantQuarantineStore(orgId)
 *   - writeTenantQuarantineStore(orgId, store)
 *   - healChain(orgId) — integration with encrypted quarantine
 *   - getQuarantine(orgId) — reading from encrypted store
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-enc-quarantine-'));
const _tempLogPath = path.join(_tempDir, 'audit-log.json');
const _tempQuarantinePath = path.join(_tempDir, 'audit-log-quarantine.json');
const _tempQuarantineDir = path.join(_tempDir, 'quarantine');
const _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');

process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.AUDIT_LOG_QUARANTINE_PATH = _tempQuarantinePath;
process.env.AUDIT_LOG_QUARANTINE_DIR = _tempQuarantineDir;
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_SCRUB_PII = 'false';
process.env.AUDIT_HEAL_ENABLED = 'false';
process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-key-for-encrypted-quarantine';

fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');

jest.resetModules();
const auditLogger = require('../audit-logger.cjs');
const cryptoUtils = require('../crypto-utils.cjs');

function resetStores() {
  fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
  try { if (fs.existsSync(_tempQuarantinePath)) fs.unlinkSync(_tempQuarantinePath); } catch {}
  try {
    if (fs.existsSync(_tempQuarantineDir)) {
      fs.rmSync(_tempQuarantineDir, { recursive: true, force: true });
    }
  } catch {}
}

function tamperEntry(entryId, field, newValue) {
  const store = JSON.parse(fs.readFileSync(_tempLogPath, 'utf8'));
  const key = Object.keys(store.entries).find((k) => store.entries[k].id === entryId);
  if (key) {
    store.entries[key][field] = newValue;
    fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));
  }
}

describe('Per-Tenant Encrypted Quarantine Storage', () => {
  beforeEach(() => {
    resetStores();
    jest.resetModules();
  });

  after(() => {
    try {
      if (fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── getTenantQuarantinePath ────────────────────────────────────────────────

  describe('getTenantQuarantinePath', () => {
    it('should return a path containing the orgId', () => {
      const p = auditLogger.getTenantQuarantinePath('org-123');
      assert.ok(p.includes('tenant-org-123'), 'Path should contain tenant-org-123');
      assert.ok(p.endsWith('audit-quarantine.json'), 'Path should end with audit-quarantine.json');
    });

    it('should use default for null orgId', () => {
      const p = auditLogger.getTenantQuarantinePath(null);
      assert.ok(p.includes('tenant-default'), 'Path should contain tenant-default');
    });

    it('should sanitize unsafe characters in orgId', () => {
      const p = auditLogger.getTenantQuarantinePath('org/../../etc');
      assert.ok(!p.includes('..'), 'Path should not contain directory traversal');
      assert.ok(p.includes('tenant-org_') && p.includes('_etc'), 'Unsafe chars should be replaced with underscores');
    });

    it('should produce different paths for different orgs', () => {
      const pA = auditLogger.getTenantQuarantinePath('org-a');
      const pB = auditLogger.getTenantQuarantinePath('org-b');
      assert.notStrictEqual(pA, pB, 'Different orgs must have different paths');
    });
  });

  // ── writeTenantQuarantineStore / readTenantQuarantineStore ─────────────────

  describe('writeTenantQuarantineStore / readTenantQuarantineStore', () => {
    it('should write and read encrypted quarantine data', () => {
      const store = {
        entries: [{ id: 'test-1', action: 'CREATE', orgId: 'org-a' }],
        metadata: { createdAt: new Date().toISOString(), totalQuarantined: 1 },
      };

      auditLogger.writeTenantQuarantineStore('org-a', store);

      const read = auditLogger.readTenantQuarantineStore('org-a');
      assert.strictEqual(read.entries.length, 1);
      assert.strictEqual(read.entries[0].id, 'test-1');
      assert.strictEqual(read.metadata.totalQuarantined, 1);
    });

    it('should write encrypted content (sb-dir: prefix) to disk', () => {
      const store = {
        entries: [{ id: 'secret-entry', action: 'DELETE', orgId: 'org-a' }],
        metadata: { createdAt: new Date().toISOString() },
      };

      auditLogger.writeTenantQuarantineStore('org-a', store);

      const tenantPath = auditLogger.getTenantQuarantinePath('org-a');
      const rawContent = fs.readFileSync(tenantPath, 'utf8');

      // L2 Content Isolation Check: file on disk must be encrypted
      assert.ok(cryptoUtils.isDirectoryEncrypted(rawContent), 'File content must be directory-encrypted (sb-dir: prefix)');
      assert.ok(!rawContent.includes('secret-entry'), 'Raw file must not contain plaintext entry IDs');
      assert.ok(!rawContent.includes('DELETE'), 'Raw file must not contain plaintext actions');
    });

    it('should return empty store for non-existent tenant', () => {
      const read = auditLogger.readTenantQuarantineStore('nonexistent-org');
      assert.strictEqual(read.entries.length, 0);
    });

    it('should fail to read with wrong orgId (cross-tenant isolation)', () => {
      const store = {
        entries: [{ id: 'tenant-a-secret', action: 'CREATE', orgId: 'org-a' }],
        metadata: { createdAt: new Date().toISOString() },
      };

      auditLogger.writeTenantQuarantineStore('org-a', store);

      // L2 Cross-Tenant Access Rejection: org-b should not be able to read org-a's data
      const crossRead = auditLogger.readTenantQuarantineStore('org-b');
      assert.strictEqual(crossRead.entries.length, 0, 'Cross-tenant read must return empty store');
    });

    it('should handle multiple writes (append pattern)', () => {
      const store1 = {
        entries: [{ id: 'entry-1', action: 'CREATE', orgId: 'org-a' }],
        metadata: { createdAt: new Date().toISOString() },
      };
      auditLogger.writeTenantQuarantineStore('org-a', store1);

      // Read back and append
      const existing = auditLogger.readTenantQuarantineStore('org-a');
      existing.entries.push({ id: 'entry-2', action: 'DELETE', orgId: 'org-a' });
      existing.metadata.totalQuarantined = existing.entries.length;
      auditLogger.writeTenantQuarantineStore('org-a', existing);

      const final = auditLogger.readTenantQuarantineStore('org-a');
      assert.strictEqual(final.entries.length, 2);
      assert.strictEqual(final.entries[0].id, 'entry-1');
      assert.strictEqual(final.entries[1].id, 'entry-2');
    });

    it('should isolate data between different orgs', () => {
      const storeA = {
        entries: [{ id: 'a-1', action: 'CREATE', orgId: 'org-a' }],
        metadata: { createdAt: new Date().toISOString() },
      };
      const storeB = {
        entries: [{ id: 'b-1', action: 'DELETE', orgId: 'org-b' }],
        metadata: { createdAt: new Date().toISOString() },
      };

      auditLogger.writeTenantQuarantineStore('org-a', storeA);
      auditLogger.writeTenantQuarantineStore('org-b', storeB);

      const readA = auditLogger.readTenantQuarantineStore('org-a');
      const readB = auditLogger.readTenantQuarantineStore('org-b');

      assert.strictEqual(readA.entries.length, 1);
      assert.strictEqual(readA.entries[0].id, 'a-1');
      assert.strictEqual(readB.entries.length, 1);
      assert.strictEqual(readB.entries[0].id, 'b-1');
    });
  });

  // ── healChain integration ──────────────────────────────────────────────────

  describe('healChain integration with encrypted quarantine', () => {
    it('should quarantine tampered entry to encrypted per-tenant file', () => {
      const e1 = auditLogger.log({
        orgId: 'org-enc-test',
        actorId: 'user1',
        actorEmail: 'user1@org-enc-test.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
      });

      tamperEntry(e1.id, 'action', 'HACKED');
      auditLogger.healChain('org-enc-test');

      // Verify quarantine file exists and is encrypted
      const tenantPath = auditLogger.getTenantQuarantinePath('org-enc-test');
      assert.ok(fs.existsSync(tenantPath), 'Per-tenant quarantine file should exist');

      const rawContent = fs.readFileSync(tenantPath, 'utf8');
      assert.ok(cryptoUtils.isDirectoryEncrypted(rawContent), 'Quarantine file must be encrypted');

      // Verify the entry is readable via getQuarantine
      const quarantine = auditLogger.getQuarantine('org-enc-test');
      assert.ok(quarantine.entries.length > 0, 'Should have quarantined entries');
      assert.strictEqual(quarantine.entries[0].id, e1.id);
      assert.strictEqual(quarantine.entries[0].quarantineReason, 'content_tampered');
    });

    it('should not leak quarantined data across tenants on disk', () => {
      const eA = auditLogger.log({
        orgId: 'org-iso-a',
        actorId: 'userA',
        actorEmail: 'userA@org-iso-a.com',
        action: 'CREATE',
        entity: 'secret-a',
        entityId: '1',
      });
      const eB = auditLogger.log({
        orgId: 'org-iso-b',
        actorId: 'userB',
        actorEmail: 'userB@org-iso-b.com',
        action: 'CREATE',
        entity: 'secret-b',
        entityId: '2',
      });

      tamperEntry(eA.id, 'action', 'HACKED');
      tamperEntry(eB.id, 'action', 'HACKED');

      auditLogger.healAllOrgs();

      // Each tenant's quarantine file should only contain their own entries
      const qA = auditLogger.getQuarantine('org-iso-a');
      const qB = auditLogger.getQuarantine('org-iso-b');

      assert.strictEqual(qA.entries.length, 1);
      assert.strictEqual(qA.entries[0].id, eA.id);
      assert.strictEqual(qB.entries.length, 1);
      assert.strictEqual(qB.entries[0].id, eB.id);

      // Verify the raw files don't contain plaintext
      const rawA = fs.readFileSync(auditLogger.getTenantQuarantinePath('org-iso-a'), 'utf8');
      const rawB = fs.readFileSync(auditLogger.getTenantQuarantinePath('org-iso-b'), 'utf8');
      assert.ok(!rawA.includes(eB.id), 'org-a quarantine must not contain org-b entry IDs');
      assert.ok(!rawB.includes(eA.id), 'org-b quarantine must not contain org-a entry IDs');
    });
  });

  // ── Backward Compatibility ─────────────────────────────────────────────────

  describe('backward compatibility', () => {
    it('should read from legacy global quarantine file when no per-tenant file exists', () => {
      // Write a legacy unencrypted quarantine file
      const legacyStore = {
        entries: [{ id: 'legacy-1', action: 'CREATE', orgId: 'org-legacy' }],
        metadata: { createdAt: new Date().toISOString() },
      };
      fs.writeFileSync(_tempQuarantinePath, JSON.stringify(legacyStore), 'utf8');

      // readTenantQuarantineStore should fall back to legacy file
      const read = auditLogger.readTenantQuarantineStore('org-legacy');
      assert.ok(read.entries.length > 0, 'Should read from legacy quarantine file');
      assert.strictEqual(read.entries[0].id, 'legacy-1');
    });

    it('should return empty store when no quarantine files exist', () => {
      // L1 Backward Compatibility: clean state should return empty
      const read = auditLogger.readTenantQuarantineStore('org-new');
      assert.strictEqual(read.entries.length, 0);
    });

    it('should handle getQuarantine without orgId (legacy global read)', () => {
      // Write a legacy unencrypted quarantine file
      const legacyStore = {
        entries: [
          { id: 'legacy-1', action: 'CREATE', orgId: 'org-a' },
          { id: 'legacy-2', action: 'DELETE', orgId: 'org-b' },
        ],
        metadata: { createdAt: new Date().toISOString() },
      };
      fs.writeFileSync(_tempQuarantinePath, JSON.stringify(legacyStore), 'utf8');

      // getQuarantine() without orgId should read from legacy global file
      const result = auditLogger.getQuarantine();
      assert.ok(result.entries.length >= 2, 'Legacy global quarantine should be readable');
    });
  });

  // ── File System Isolation ──────────────────────────────────────────────────

  describe('file system isolation', () => {
    it('should create per-tenant directories on write', () => {
      auditLogger.writeTenantQuarantineStore('org-fs-test', {
        entries: [],
        metadata: { createdAt: new Date().toISOString() },
      });

      const tenantPath = auditLogger.getTenantQuarantinePath('org-fs-test');
      assert.ok(fs.existsSync(tenantPath), 'Quarantine file should exist');
      assert.ok(fs.existsSync(path.dirname(tenantPath)), 'Tenant directory should exist');
    });

    it('should not create directories for other tenants', () => {
      auditLogger.writeTenantQuarantineStore('org-fs-a', {
        entries: [],
        metadata: {},
      });

      const pathB = auditLogger.getTenantQuarantinePath('org-fs-b');
      assert.ok(!fs.existsSync(pathB), 'org-b quarantine should not exist');
    });
  });
});
