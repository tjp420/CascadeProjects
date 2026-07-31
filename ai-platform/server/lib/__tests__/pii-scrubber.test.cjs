'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Isolate audit log and PII policy store in a unique temp dir per test run
const tmpDir = path.join(
  os.tmpdir(),
  `pii-scrub-test-${Date.now()}-${process.pid}-${crypto.randomUUID()}`
);
const piiPolicyPath = path.join(tmpDir, '.simplebeacon', 'pii-policies.json');

// We'll set PII_POLICY_PATH and require modules after switching CWD in beforeAll
let piiPolicyStore;
let auditLogger;
const originalCwd = process.cwd();

/**
 * Write a raw entry directly to the audit log store file, bypassing log().
 * This simulates a historical entry written before PII policies existed.
 */
function writeRawEntry(orgId, id, metadata, timestamp, previousHash) {
  const storePath = path.join(tmpDir, '.simplebeacon', 'audit-log.json');
  let store = { entries: {}, chainHeads: {} };
  if (fs.existsSync(storePath)) {
    store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  }

  const entry = {
    id,
    orgId,
    timestamp,
    actorId: 'historical-user',
    actorEmail: 'user@historical.com',
    action: 'UPDATE',
    entity: 'test_entity',
    entityId: `ent-${id}`,
    changes: [],
    metadata,
  };

  // Compute hash chain link using the same algorithm as audit-logger
  const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';
  const prev = previousHash || store.chainHeads[orgId] || GENESIS;
  entry.previousHash = prev;

  // We need to compute the hash the same way audit-logger does
  const { computeEntryHash } = require('../audit-logger.cjs');
  // computeEntryHash is not exported, so we need to use verifyChain to
  // detect the break, then healChain to fix it. But for testing scrub,
  // we can just write entries with correct hashes by using log() first
  // then overwriting metadata.

  // Actually, simpler approach: use log() to create entries (which computes
  // correct hashes), then overwrite the metadata directly in the store file
  // to "un-redact" it (simulating a pre-PII-policy entry).
  store.entries[`${orgId}::${id}`] = entry;
  store.chainHeads[orgId] = entry.hash || prev;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

describe('pii-scrubber (audit-logger PII scrub functions)', () => {
  beforeAll(() => {
    // Ensure dirs exist before we chdir
    fs.mkdirSync(path.join(tmpDir, '.simplebeacon'), { recursive: true });
    process.env.PII_POLICY_PATH = piiPolicyPath;
    // Force audit-logger to use a store file inside this unique tmpDir
    process.env.AUDIT_STORE_PATH = path.join(tmpDir, '.simplebeacon', 'audit-log.json');

    // Temporarily switch CWD while other modules initialize if needed
    process.chdir(tmpDir);

    // Require stores after environment is configured so they initialize against tmpDir
    piiPolicyStore = require('../pii-policy-store.cjs');
    auditLogger = require('../audit-logger.cjs');

    // Now proceed with policy creation
    // Create PII policies for test orgs
    piiPolicyStore.createPolicy({
      orgId: 'scrub-test-org',
      name: 'Email',
      description: 'Email addresses',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'gi',
      replacement: '[REDACTED-EMAIL]',
      severity: 'high',
      enabled: true,
    });

    piiPolicyStore.createPolicy({
      orgId: 'scrub-run-org',
      name: 'Email',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'gi',
      replacement: '[REDACTED-EMAIL]',
      severity: 'high',
      enabled: true,
    });
  });

  afterAll(() => {
    // Restore original CWD and clean up temporary test data
    try {
      process.chdir(originalCwd);
    } catch {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  /**
   * Helper: Create a historical entry by using log() then overwriting
   * the metadata in the store file to contain raw PII (simulating
   * entries written before PII policies were activated).
   */
  function createHistoricalEntry(orgId, metadata) {
    // Log with clean metadata first (to get proper hash chain)
    const entry = auditLogger.log({
      orgId,
      actorId: 'user1',
      actorEmail: 'user@example.com',
      action: 'UPDATE',
      entity: 'test_entity',
      entityId: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      metadata: 'placeholder',
    });

    // Now overwrite the metadata in the store file with raw PII
    const storePath = path.join(tmpDir, '.simplebeacon', 'audit-log.json');
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const key = `${orgId}::${entry.id}`;
    if (store.entries[key]) {
      store.entries[key].metadata = metadata;
      // Recompute hash for this entry and all subsequent entries
      // to maintain chain validity (simulating a pre-PII-policy write)
      const entries = Object.values(store.entries)
        .filter((e) => e.orgId === orgId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';
      let prevHash = GENESIS;
      for (const e of entries) {
        e.previousHash = prevHash;
        // We can't call computeEntryHash directly, but we can use the
        // verifyChain/healChain pattern. For test purposes, let's just
        // write the entries and accept the chain will be "broken" by the
        // metadata change — the scrubber will recompute it anyway.
        prevHash = e.hash; // Keep old hash, chain will be "broken"
      }
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    }

    return entry;
  }

  describe('previewPiiScrub', () => {
    test('returns dry-run preview without modifying entries', () => {
      // Create a historical entry with raw PII
      createHistoricalEntry('scrub-test-org', 'Contact admin@example.com for details');

      const preview = auditLogger.previewPiiScrub('scrub-test-org');
      expect(preview.scanned).toBeGreaterThan(0);
      expect(preview.wouldScrub).toBeGreaterThan(0);
      expect(preview.entries.length).toBeGreaterThan(0);
      expect(preview.entries[0].redactedPreview).toContain('[REDACTED-EMAIL]');
    });

    test('returns zero findings for org with no PII in metadata', () => {
      createHistoricalEntry('scrub-test-clean', 'No sensitive data here');

      const preview = auditLogger.previewPiiScrub('scrub-test-clean');
      expect(preview.scanned).toBeGreaterThan(0);
      expect(preview.wouldScrub).toBe(0);
    });

    test('handles org with no entries', () => {
      const preview = auditLogger.previewPiiScrub('nonexistent-org');
      expect(preview.scanned).toBe(0);
      expect(preview.wouldScrub).toBe(0);
    });
  });

  describe('runPiiScrub', () => {
    test('scrubs PII from metadata and recomputes hash chain', () => {
      // Create historical entries with raw PII
      const entry1 = createHistoricalEntry('scrub-run-org', 'Email me at admin@test.com please');
      const entry2 = createHistoricalEntry('scrub-run-org', 'No PII here');

      // Run scrub
      const result = auditLogger.runPiiScrub('scrub-run-org');
      expect(result.scanned).toBeGreaterThanOrEqual(2);
      expect(result.scrubbed).toBeGreaterThanOrEqual(1);
      expect(result.sealEntryId).toMatch(/^pii-scrub-/);

      // Verify chain is valid after scrub
      const verification = auditLogger.verifyChain('scrub-run-org');
      expect(verification.valid).toBe(true);

      // Verify metadata was actually scrubbed
      const queried = auditLogger.query({ orgId: 'scrub-run-org', limit: 100 });
      const scrubbedEntry = queried.entries.find((e) => e.id === entry1.id);
      expect(scrubbedEntry).toBeDefined();
      expect(scrubbedEntry.metadata).toContain('[REDACTED-EMAIL]');
      expect(scrubbedEntry.metadata).not.toContain('admin@test.com');
    });

    test('appends PII_SCRUBBED seal entry to the chain', () => {
      const queried = auditLogger.query({ orgId: 'scrub-run-org', limit: 100 });
      const sealEntry = queried.entries.find((e) => e.action === 'PII_SCRUBBED');
      expect(sealEntry).toBeDefined();
      expect(sealEntry.actorId).toBe('system:pii-scrubber');
      expect(sealEntry.entity).toBe('audit_log');
    });

    test('creates backup file for forensic trail', () => {
      const backupDir = path.join(tmpDir, '.simplebeacon', 'pii-scrub-backups');
      expect(fs.existsSync(backupDir)).toBe(true);
      const backups = fs.readdirSync(backupDir).filter((f) => f.includes('scrub-run-org'));
      expect(backups.length).toBeGreaterThan(0);
    });

    test('handles org with no entries gracefully', () => {
      const result = auditLogger.runPiiScrub('empty-scrub-org');
      expect(result.scrubbed).toBe(0);
      expect(result.scanned).toBe(0);
      expect(result.sealEntryId).toBeNull();
    });
  });

  describe('getScrubStatus', () => {
    test('returns status of last scrub operation', () => {
      // Re-run scrub to ensure status is for scrub-run-org
      createHistoricalEntry('scrub-run-org', 'Another email@test.com entry');
      auditLogger.runPiiScrub('scrub-run-org');

      const status = auditLogger.getScrubStatus();
      expect(status).toBeDefined();
      expect(status.orgId).toBe('scrub-run-org');
      expect(status.ranAt).toBeDefined();
      expect(status.sealEntryId).toMatch(/^pii-scrub-/);
    });
  });
});
