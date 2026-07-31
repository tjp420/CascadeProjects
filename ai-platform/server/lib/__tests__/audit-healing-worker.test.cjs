'use strict';

/**
 * Tests for audit log auto-healing worker.
 *
 * Tests healChain() for detecting broken/tampered entries, moving them to
 * quarantine, re-linking the remaining chain, the background timer, and
 * the E2E API endpoints (POST /heal-chain, GET /quarantine, GET /heal-stats).
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set env vars before requiring modules
const _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-audit-heal-'));
const _tempLogPath = path.join(_tempDir, 'audit-log.json');
const _tempQuarantinePath = path.join(_tempDir, 'audit-log-quarantine.json');
const _tempQuarantineDir = path.join(_tempDir, 'quarantine');
const _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');

process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.AUDIT_LOG_QUARANTINE_PATH = _tempQuarantinePath;
process.env.AUDIT_LOG_QUARANTINE_DIR = _tempQuarantineDir;
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_SCRUB_PII = 'false'; // Disable scrubbing for simpler test data
process.env.AUDIT_HEAL_ENABLED = 'false'; // Don't auto-start the timer

fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');

const auditLogger = require('../audit-logger.cjs');

// E2E test setup
const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth.cjs', () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({
      success: false,
      error: 'authentication_required',
      message: 'Authentication required',
    });
  },
}));

const ADMIN_USER = {
  id: 'admin@org-heal.com',
  email: 'admin@org-heal.com',
  role: 'admin',
  permissions: ['admin:all'],
};

const REGULAR_USER = {
  id: 'user@org-heal.com',
  email: 'user@org-heal.com',
  role: 'developer',
};

function createTestApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (user) req.user = user;
    next();
  });
  const auditRoutes = require('../../routes/audit-routes.cjs');
  app.use('/api/audit', auditRoutes);
  return app;
}

function resetStores() {
  fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
  try {
    if (fs.existsSync(_tempQuarantinePath)) fs.unlinkSync(_tempQuarantinePath);
  } catch {}
  // Clean up per-tenant encrypted quarantine directories
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

describe('Audit Log Auto-Healing Worker', () => {
  beforeEach(() => {
    resetStores();
    jest.resetModules();
  });

  after(() => {
    try {
      auditLogger.stopAutoHeal();
      if (fs.existsSync(_tempDir)) fs.rmSync(_tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ── healChain ──────────────────────────────────────────────────────────────

  describe('healChain', () => {
    it('should return healed=false when chain is valid', () => {
      auditLogger.log({
        orgId: 'org-heal',
        actorId: 'user1',
        actorEmail: 'user1@org-heal.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
      });

      const result = auditLogger.healChain('org-heal');
      assert.strictEqual(result.healed, false);
      assert.strictEqual(result.quarantined.length, 0);
      assert.strictEqual(result.relinked, 0);
      assert.strictEqual(result.remaining, 1);
    });

    it('should quarantine tampered entry and re-link remaining', () => {
      // Create 3 entries
      const e1 = auditLogger.log({ orgId: 'org-heal', actorId: 'u1', actorEmail: 'u1@org-heal.com', action: 'CREATE', entity: 'test', entityId: '1' });
      const e2 = auditLogger.log({ orgId: 'org-heal', actorId: 'u2', actorEmail: 'u2@org-heal.com', action: 'UPDATE', entity: 'test', entityId: '1' });
      const e3 = auditLogger.log({ orgId: 'org-heal', actorId: 'u3', actorEmail: 'u3@org-heal.com', action: 'DELETE', entity: 'test', entityId: '1' });

      // Tamper with e2
      tamperEntry(e2.id, 'action', 'HACKED');

      // Verify chain is broken
      const beforeHeal = auditLogger.verifyChain('org-heal');
      assert.strictEqual(beforeHeal.valid, false);
      assert.ok(beforeHeal.tamperedEntries.length > 0);

      // Heal
      const result = auditLogger.healChain('org-heal');
      assert.strictEqual(result.healed, true);
      assert.ok(result.quarantined.length > 0);
      assert.strictEqual(result.quarantined[0].id, e2.id);
      assert.strictEqual(result.quarantined[0].reason, 'content_tampered');

      // Verify chain is now valid
      const afterHeal = auditLogger.verifyChain('org-heal');
      assert.strictEqual(afterHeal.valid, true);
      assert.strictEqual(afterHeal.totalEntries, 2); // e1 and e3 remain
      assert.strictEqual(afterHeal.verifiedEntries, 2);
    });

    it('should quarantine entry with broken prevHash link', () => {
      const e1 = auditLogger.log({ orgId: 'org-heal', actorId: 'u1', actorEmail: 'u1@org-heal.com', action: 'CREATE', entity: 'test', entityId: '1' });
      const e2 = auditLogger.log({ orgId: 'org-heal', actorId: 'u2', actorEmail: 'u2@org-heal.com', action: 'UPDATE', entity: 'test', entityId: '1' });

      // Break the prevHash link on e2
      tamperEntry(e2.id, 'prevHash', 'f'.repeat(64));

      const result = auditLogger.healChain('org-heal');
      assert.strictEqual(result.healed, true);
      assert.ok(result.quarantined.length > 0);

      // Chain should be valid after healing
      const afterHeal = auditLogger.verifyChain('org-heal');
      assert.strictEqual(afterHeal.valid, true);
    });

    it('should handle healing when all entries are tampered', () => {
      const e1 = auditLogger.log({ orgId: 'org-heal', actorId: 'u1', actorEmail: 'u1@org-heal.com', action: 'CREATE', entity: 'test', entityId: '1' });

      tamperEntry(e1.id, 'action', 'HACKED');

      const result = auditLogger.healChain('org-heal');
      assert.strictEqual(result.healed, true);
      assert.strictEqual(result.quarantined.length, 1);
      assert.strictEqual(result.remaining, 0);

      // Chain should be valid (empty)
      const afterHeal = auditLogger.verifyChain('org-heal');
      assert.strictEqual(afterHeal.valid, true);
      assert.strictEqual(afterHeal.totalEntries, 0);
    });

    it('should handle healing for org with no entries', () => {
      const result = auditLogger.healChain('org-empty');
      assert.strictEqual(result.healed, false);
      assert.strictEqual(result.quarantined.length, 0);
      assert.strictEqual(result.remaining, 0);
    });

    it('should preserve quarantine evidence in quarantine file', () => {
      const e1 = auditLogger.log({ orgId: 'org-heal', actorId: 'u1', actorEmail: 'u1@org-heal.com', action: 'CREATE', entity: 'test', entityId: '1' });
      tamperEntry(e1.id, 'action', 'HACKED');

      auditLogger.healChain('org-heal');

      // Check quarantine file
      const quarantine = auditLogger.getQuarantine('org-heal');
      assert.ok(quarantine.entries.length > 0);
      assert.strictEqual(quarantine.entries[0].id, e1.id);
      assert.ok(quarantine.entries[0].quarantinedAt);
      assert.strictEqual(quarantine.entries[0].quarantineReason, 'content_tampered');
    });

    it('should not affect other orgs when healing one org', () => {
      const e1a = auditLogger.log({ orgId: 'org-a', actorId: 'u1', actorEmail: 'u1@org-a.com', action: 'CREATE', entity: 'test', entityId: '1' });
      const e1b = auditLogger.log({ orgId: 'org-b', actorId: 'u2', actorEmail: 'u2@org-b.com', action: 'CREATE', entity: 'test', entityId: '2' });

      // Tamper with org-a's entry only
      tamperEntry(e1a.id, 'action', 'HACKED');

      auditLogger.healChain('org-a');

      // org-b should be unaffected
      const resultB = auditLogger.verifyChain('org-b');
      assert.strictEqual(resultB.valid, true);
      assert.strictEqual(resultB.totalEntries, 1);
    });
  });

  // ── healAllOrgs ────────────────────────────────────────────────────────────

  describe('healAllOrgs', () => {
    it('should heal all orgs with entries', () => {
      const e1a = auditLogger.log({ orgId: 'org-a', actorId: 'u1', actorEmail: 'u1@org-a.com', action: 'CREATE', entity: 'test', entityId: '1' });
      const e1b = auditLogger.log({ orgId: 'org-b', actorId: 'u2', actorEmail: 'u2@org-b.com', action: 'CREATE', entity: 'test', entityId: '2' });

      // Tamper with both
      tamperEntry(e1a.id, 'action', 'HACKED');
      tamperEntry(e1b.id, 'action', 'HACKED');

      const results = auditLogger.healAllOrgs();
      assert.ok(results.length >= 2);
      assert.ok(results.every((r) => r.healed));

      // Both chains should be valid
      assert.strictEqual(auditLogger.verifyChain('org-a').valid, true);
      assert.strictEqual(auditLogger.verifyChain('org-b').valid, true);
    });

    it('should return empty array when no orgs have entries', () => {
      resetStores();
      const results = auditLogger.healAllOrgs();
      assert.strictEqual(results.length, 0);
    });
  });

  // ── Background Timer ───────────────────────────────────────────────────────

  describe('background timer', () => {
    it('should start and stop the auto-heal timer', () => {
      // Temporarily enable auto-heal (env has it disabled)
      const origEnabled = process.env.AUDIT_HEAL_ENABLED;
      process.env.AUDIT_HEAL_ENABLED = 'true';
      try {
        const started = auditLogger.startAutoHeal(1000);
        assert.strictEqual(started, true);

        const stats = auditLogger.getHealStats();
        assert.strictEqual(stats.timerActive, true);

        auditLogger.stopAutoHeal();
        const statsAfter = auditLogger.getHealStats();
        assert.strictEqual(statsAfter.timerActive, false);
      } finally {
        process.env.AUDIT_HEAL_ENABLED = origEnabled;
      }
    });

    it('should not start timer if already running', () => {
      const origEnabled = process.env.AUDIT_HEAL_ENABLED;
      process.env.AUDIT_HEAL_ENABLED = 'true';
      try {
        auditLogger.startAutoHeal(1000);
        const secondStart = auditLogger.startAutoHeal(1000);
        assert.strictEqual(secondStart, false);
        auditLogger.stopAutoHeal();
      } finally {
        process.env.AUDIT_HEAL_ENABLED = origEnabled;
      }
    });

    it('should not start timer when AUDIT_HEAL_ENABLED=false', () => {
      // AUDIT_HEAL_ENABLED is already set to 'false' in env
      const result = auditLogger.startAutoHeal();
      assert.strictEqual(result, false);
    });

    it('should track heal stats', () => {
      const stats = auditLogger.getHealStats();
      assert.ok(typeof stats.totalRuns === 'number');
      assert.ok(typeof stats.totalQuarantined === 'number');
      assert.ok(typeof stats.totalRelinked === 'number');
      assert.ok(typeof stats.isRunning === 'boolean');
      assert.ok(typeof stats.timerActive === 'boolean');
    });
  });

  // ── getQuarantine ──────────────────────────────────────────────────────────

  describe('getQuarantine', () => {
    it('should return all quarantine entries when no orgId filter', () => {
      const e1 = auditLogger.log({ orgId: 'org-a', actorId: 'u1', actorEmail: 'u1@org-a.com', action: 'CREATE', entity: 'test', entityId: '1' });
      const e2 = auditLogger.log({ orgId: 'org-b', actorId: 'u2', actorEmail: 'u2@org-b.com', action: 'CREATE', entity: 'test', entityId: '2' });

      tamperEntry(e1.id, 'action', 'HACKED');
      tamperEntry(e2.id, 'action', 'HACKED');

      auditLogger.healAllOrgs();

      // Per-tenant encrypted quarantine: check each org separately
      const quarantineA = auditLogger.getQuarantine('org-a');
      const quarantineB = auditLogger.getQuarantine('org-b');
      assert.ok(quarantineA.entries.length >= 1, 'org-a should have quarantined entries');
      assert.ok(quarantineB.entries.length >= 1, 'org-b should have quarantined entries');
    });

    it('should filter quarantine by orgId', () => {
      const e1 = auditLogger.log({ orgId: 'org-a', actorId: 'u1', actorEmail: 'u1@org-a.com', action: 'CREATE', entity: 'test', entityId: '1' });
      auditLogger.log({ orgId: 'org-b', actorId: 'u2', actorEmail: 'u2@org-b.com', action: 'CREATE', entity: 'test', entityId: '2' });

      tamperEntry(e1.id, 'action', 'HACKED');
      // Tamper org-b too
      const store = JSON.parse(fs.readFileSync(_tempLogPath, 'utf8'));
      const orgBKey = Object.keys(store.entries).find((k) => store.entries[k].orgId === 'org-b');
      store.entries[orgBKey].action = 'HACKED';
      fs.writeFileSync(_tempLogPath, JSON.stringify(store, null, 2));

      auditLogger.healAllOrgs();

      const quarantineA = auditLogger.getQuarantine('org-a');
      assert.ok(quarantineA.entries.length >= 1);
      assert.ok(quarantineA.entries.every((e) => e.orgId === 'org-a'));
    });
  });

  // ── E2E: POST /api/audit/heal-chain ────────────────────────────────────────

  describe('E2E: POST /api/audit/heal-chain', () => {
    let adminApp;
    let regularApp;
    let noAuthApp;

    before(() => {
      adminApp = createTestApp(ADMIN_USER);
      regularApp = createTestApp(REGULAR_USER);
      noAuthApp = createTestApp(null);
    });

    beforeEach(() => {
      resetStores();
    });

    it('should heal chain for admin user', async () => {
      // Create and tamper with an entry
      const entry = auditLogger.log({
        orgId: 'admin@org-heal.com',
        actorId: 'admin@org-heal.com',
        actorEmail: 'admin@org-heal.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
      });
      tamperEntry(entry.id, 'action', 'HACKED');

      const res = await request(adminApp).post('/api/audit/heal-chain');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.healed === 'boolean');
    });

    it('should return healed=false when chain is valid', async () => {
      auditLogger.log({
        orgId: 'admin@org-heal.com',
        actorId: 'admin@org-heal.com',
        actorEmail: 'admin@org-heal.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
      });

      const res = await request(adminApp).post('/api/audit/heal-chain');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.healed, false);
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).post('/api/audit/heal-chain');
      assert.strictEqual(res.status, 403);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(noAuthApp).post('/api/audit/heal-chain');
      assert.strictEqual(res.status, 401);
    });
  });

  // ── E2E: GET /api/audit/quarantine ─────────────────────────────────────────

  describe('E2E: GET /api/audit/quarantine', () => {
    let adminApp;
    let regularApp;
    let noAuthApp;

    before(() => {
      adminApp = createTestApp(ADMIN_USER);
      regularApp = createTestApp(REGULAR_USER);
      noAuthApp = createTestApp(null);
    });

    beforeEach(() => {
      resetStores();
    });

    it('should return quarantine entries for admin user', async () => {
      // Create and tamper, then heal
      const entry = auditLogger.log({
        orgId: 'admin@org-heal.com',
        actorId: 'admin@org-heal.com',
        actorEmail: 'admin@org-heal.com',
        action: 'CREATE',
        entity: 'test',
        entityId: '1',
      });
      tamperEntry(entry.id, 'action', 'HACKED');
      auditLogger.healChain('admin@org-heal.com');

      const res = await request(adminApp).get('/api/audit/quarantine');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.entries.length > 0);
      assert.ok(typeof res.body.totalEntries === 'number');
    });

    it('should return empty quarantine when no entries', async () => {
      const res = await request(adminApp).get('/api/audit/quarantine');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.entries.length, 0);
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).get('/api/audit/quarantine');
      assert.strictEqual(res.status, 403);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(noAuthApp).get('/api/audit/quarantine');
      assert.strictEqual(res.status, 401);
    });
  });

  // ── E2E: GET /api/audit/heal-stats ─────────────────────────────────────────

  describe('E2E: GET /api/audit/heal-stats', () => {
    let adminApp;
    let regularApp;

    before(() => {
      adminApp = createTestApp(ADMIN_USER);
      regularApp = createTestApp(REGULAR_USER);
    });

    it('should return heal stats for admin user', async () => {
      const res = await request(adminApp).get('/api/audit/heal-stats');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.totalRuns === 'number');
      assert.ok(typeof res.body.totalQuarantined === 'number');
      assert.ok(typeof res.body.timerActive === 'boolean');
    });

    it('should reject non-admin user with 403', async () => {
      const res = await request(regularApp).get('/api/audit/heal-stats');
      assert.strictEqual(res.status, 403);
    });
  });
});
