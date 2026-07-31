'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test isolation
const tmpDir = path.join(os.tmpdir(), `audit-chain-heal-test-${Date.now()}`);
const policyPath = path.join(tmpDir, 'audit-policies.json');

process.env.AUDIT_POLICY_PATH = policyPath;

const auditLogger = require('../audit-logger.cjs');

describe('audit-logger chain healing', () => {
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('healChain — valid chain (no-op)', () => {
    test('returns healed=false when chain is already valid', () => {
      // Log a few entries to build a valid chain
      auditLogger.log({
        orgId: 'heal-test-valid',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
        actorId: 'tester',
        actorEmail: 't@t.com',
        changes: [],
      });

      const result = auditLogger.healChain('heal-test-valid');
      expect(result.healed).toBe(false);
      expect(result.quarantined).toBe(0);
      expect(result.sealEntryId).toBeNull();
    });
  });

  describe('healChain — broken chain (tampered entry)', () => {
    test('quarantines broken entries and re-seals the chain', () => {
      const orgId = 'heal-test-broken';

      // Build a valid chain with 3 entries
      for (let i = 0; i < 3; i++) {
        auditLogger.log({
          orgId,
          action: 'CREATE',
          entity: 'test',
          entityId: `entry-${i}`,
          actorId: 'tester',
          actorEmail: 't@t.com',
          changes: [],
        });
      }

      // Verify the chain is valid before tampering
      let verification = auditLogger.verifyChain(orgId);
      expect(verification.valid).toBe(true);

      // Tamper with the middle entry — modify its action field without
      // recomputing the hash, breaking the chain
      const storePath = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
      const raw = fs.readFileSync(storePath, 'utf8');
      const store = JSON.parse(raw);

      // Find entries for this org and tamper with the second one
      const orgEntries = Object.values(store.entries)
        .filter((e) => e.orgId === orgId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      expect(orgEntries.length).toBeGreaterThanOrEqual(3);

      // Tamper: change the action of the 2nd entry without updating its hash
      const tamperedKey = `${orgId}::${orgEntries[1].id}`;
      store.entries[tamperedKey].action = 'TAMPERED_ACTION';
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

      // Verify the chain is now broken
      verification = auditLogger.verifyChain(orgId);
      expect(verification.valid).toBe(false);

      // Heal the chain
      const healResult = auditLogger.healChain(orgId);
      expect(healResult.healed).toBe(true);
      expect(healResult.quarantined).toBeGreaterThan(0);
      expect(healResult.sealEntryId).toBeTruthy();
      expect(healResult.reason).toBeTruthy();

      // Verify the chain is now valid again
      verification = auditLogger.verifyChain(orgId);
      expect(verification.valid).toBe(true);

      // Verify a seal entry was inserted
      const rawAfter = fs.readFileSync(storePath, 'utf8');
      const storeAfter = JSON.parse(rawAfter);
      const remainingEntries = Object.values(storeAfter.entries).filter(
        (e) => e.orgId === orgId
      );
      const sealEntry = remainingEntries.find((e) => e.action === 'CHAIN_HEALED');
      expect(sealEntry).toBeDefined();
      expect(sealEntry.actorId).toBe('system:chain-healer');
      expect(sealEntry.metadata.healedAt).toBeTruthy();
    });

    test('quarantine file is created with original entry data', () => {
      const orgId = 'heal-test-quarantine';

      // Log entries
      auditLogger.log({
        orgId,
        action: 'CREATE',
        entity: 'test',
        entityId: 'q-1',
        actorId: 'tester',
        actorEmail: 't@t.com',
        changes: [],
      });
      auditLogger.log({
        orgId,
        action: 'CREATE',
        entity: 'test',
        entityId: 'q-2',
        actorId: 'tester',
        actorEmail: 't@t.com',
        changes: [],
      });

      // Tamper with the second entry
      const storePath = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
      const raw = fs.readFileSync(storePath, 'utf8');
      const store = JSON.parse(raw);
      const orgEntries = Object.values(store.entries)
        .filter((e) => e.orgId === orgId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const tamperedKey = `${orgId}::${orgEntries[1].id}`;
      store.entries[tamperedKey].entityId = 'TAMPERED';
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

      // Heal
      const healResult = auditLogger.healChain(orgId);
      expect(healResult.healed).toBe(true);
      expect(healResult.quarantineFile).toBeTruthy();

      // Check quarantine file exists and contains original data
      const quarantinePath = path.join(
        process.cwd(),
        '.simplebeacon',
        'quarantine',
        healResult.quarantineFile
      );
      expect(fs.existsSync(quarantinePath)).toBe(true);

      const quarantineData = JSON.parse(fs.readFileSync(quarantinePath, 'utf8'));
      expect(quarantineData.orgId).toBe(orgId);
      expect(quarantineData.quarantinedAt).toBeTruthy();
      expect(Array.isArray(quarantineData.entries)).toBe(true);
      expect(quarantineData.entries.length).toBeGreaterThan(0);
      // Original hash should be preserved
      expect(quarantineData.entries[0]._originalHash).toBeTruthy();
      expect(quarantineData.entries[0]._originalPreviousHash).toBeTruthy();
    });
  });

  describe('healChain — empty org', () => {
    test('returns healed=false for org with no entries (valid empty chain)', () => {
      const result = auditLogger.healChain('heal-test-empty-org');
      expect(result.healed).toBe(false);
      expect(result.quarantined).toBe(0);
      expect(result.sealEntryId).toBeNull();
    });
  });

  describe('healChain — chain head mismatch', () => {
    test('heals when chainHead does not match last entry hash', () => {
      const orgId = 'heal-test-head-mismatch';

      auditLogger.log({
        orgId,
        action: 'CREATE',
        entity: 'test',
        entityId: 'hm-1',
        actorId: 'tester',
        actorEmail: 't@t.com',
        changes: [],
      });

      // Corrupt the chainHead to simulate end-of-chain tampering
      const storePath = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
      const raw = fs.readFileSync(storePath, 'utf8');
      const store = JSON.parse(raw);
      store.chainHeads[orgId] = 'fake-hash-value';
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

      // Verify broken
      let verification = auditLogger.verifyChain(orgId);
      expect(verification.valid).toBe(false);

      // Heal
      const healResult = auditLogger.healChain(orgId);
      expect(healResult.healed).toBe(true);

      // Verify fixed
      verification = auditLogger.verifyChain(orgId);
      expect(verification.valid).toBe(true);
    });
  });
});
