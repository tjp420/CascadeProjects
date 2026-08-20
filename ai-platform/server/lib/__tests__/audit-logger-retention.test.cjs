"use strict";

/**
 * Tests for Audit Logger Retention Engine.
 *
 * Verifies that purgeOldEntries() and getRetentionStats() in audit-logger.cjs:
 *   1. Purge entries older than retention days
 *   2. Preserve at least maxEntries most recent entries
 *   3. Re-link hash chain after purge (verifyChain passes)
 *   4. Return correct stats (total, oldest, newest, purgeable)
 *   5. Handle empty store gracefully
 *   6. Use default policy when no custom policy is set
 *   7. Do not cross org boundaries
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const AUDIT_LOGGER_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "audit-logger.cjs",
);
const POLICY_STORE_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "audit-policy-store.cjs",
);

function reloadModules(tmpLogPath, tmpPolicyPath) {
  if (typeof jest !== "undefined" && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[AUDIT_LOGGER_PATH];
    delete require.cache[POLICY_STORE_PATH];
  }
  process.env.AUDIT_LOG_PATH = tmpLogPath;
  process.env.AUDIT_POLICY_PATH = tmpPolicyPath;
  // Require audit-logger first — it will require audit-policy-store internally.
  // Then require audit-policy-store — it will return the same cached instance.
  const auditLogger = require(AUDIT_LOGGER_PATH);
  const auditPolicyStore = require(POLICY_STORE_PATH);
  return { auditLogger, auditPolicyStore };
}

/**
 * Write a policy directly to the policy store JSON file.
 * This avoids module cache issues where audit-logger.cjs and the test
 * might get different instances of audit-policy-store.cjs.
 */
function writePolicyDirectly(policyPath, orgId, policy) {
  let store = {};
  try {
    if (fs.existsSync(policyPath)) {
      store = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    }
  } catch {}
  store[orgId] = policy;
  fs.writeFileSync(policyPath, JSON.stringify(store, null, 2));
}

/**
 * Write an entry directly to the audit log store with a custom timestamp.
 * The log() function always uses now(), so for retention tests we need
 * to inject entries with old timestamps directly.
 */
function writeEntryDirectly(auditLogger, storePath, params) {
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const id = `audit-${crypto.randomBytes(6).toString("hex")}`;
  const orgId = params.orgId || "default";
  const entry = {
    id,
    orgId,
    timestamp: params.timestamp,
    actorId: params.actorId || "unknown",
    actorEmail: params.actorEmail || "unknown",
    action: params.action || "TEST",
    entity: params.entity || "test",
    entityId: params.entityId || "",
    changes: null,
    metadata: params.metadata || null,
    prevHash: params.prevHash || "0".repeat(64),
  };
  // Compute hash
  const entryWithoutHash = { ...entry };
  delete entryWithoutHash.hash;
  entry.hash = auditLogger.computeEntryHash(entryWithoutHash, entry.prevHash);
  const key = orgId ? `${orgId}::${id}` : id;
  store.entries[key] = entry;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return entry;
}

describe("Audit Logger Retention Engine", () => {
  let tmpDir;
  let tmpLogPath;
  let tmpPolicyPath;
  let auditLogger;
  let auditPolicyStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-retention-"));
    tmpLogPath = path.join(tmpDir, "audit-log.json");
    tmpPolicyPath = path.join(tmpDir, "audit-policy.json");
    // Initialize empty store
    fs.writeFileSync(tmpLogPath, JSON.stringify({ entries: {} }, null, 2));
    const mods = reloadModules(tmpLogPath, tmpPolicyPath);
    auditLogger = mods.auditLogger;
    auditPolicyStore = mods.auditPolicyStore;
    auditPolicyStore._resetCache();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    delete process.env.AUDIT_LOG_PATH;
    delete process.env.AUDIT_POLICY_PATH;
  });

  describe("getRetentionStats()", () => {
    it("should return zero stats for empty store", () => {
      const stats = auditLogger.getRetentionStats("test-org");
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.oldestTimestamp, null);
      assert.strictEqual(stats.newestTimestamp, null);
      assert.strictEqual(stats.purgeableCount, 0);
      assert.ok(stats.policy);
    });

    it("should return total, oldest, newest for entries", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: oldDate.toISOString(),
        action: "old_action",
      });
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: now.toISOString(),
        action: "recent_action",
      });
      const stats = auditLogger.getRetentionStats("test-org");
      assert.strictEqual(stats.total, 2);
      assert.ok(stats.oldestTimestamp);
      assert.ok(stats.newestTimestamp);
    });

    it("should return default policy when no custom policy set", () => {
      const stats = auditLogger.getRetentionStats("test-org");
      assert.strictEqual(stats.policy.retentionDays, 90);
      assert.strictEqual(stats.policy.maxEntries, 10000);
    });
  });

  describe("purgeOldEntries()", () => {
    it("should return 0 purged for empty store", () => {
      const result = auditLogger.purgeOldEntries("test-org");
      assert.strictEqual(result.purged, 0);
      assert.strictEqual(result.remaining, 0);
    });

    it("should purge entries older than retention days", () => {
      auditPolicyStore._resetCache();
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 1,
        maxEntries: 100,
      });
      auditPolicyStore._resetCache();

      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(); // now

      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: oldDate.toISOString(),
        action: "old_action",
      });
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: recentDate.toISOString(),
        action: "recent_action",
      });

      const result = auditLogger.purgeOldEntries("test-org");
      assert.strictEqual(result.purged, 1);
      assert.strictEqual(result.remaining, 1);
    });

    it("should preserve at least maxEntries most recent entries", () => {
      auditPolicyStore._resetCache();
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 1,
        maxEntries: 5,
      });
      auditPolicyStore._resetCache();

      // Add 10 old entries (all older than 1 day)
      for (let i = 0; i < 10; i++) {
        const oldDate = new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000 - i * 1000,
        );
        writeEntryDirectly(auditLogger, tmpLogPath, {
          orgId: "test-org",
          timestamp: oldDate.toISOString(),
          action: `old_action_${i}`,
        });
      }

      const result = auditLogger.purgeOldEntries("test-org");
      assert.strictEqual(result.purged, 5);
      assert.strictEqual(result.remaining, 5);
    });

    it("should re-link hash chain after purge (verifyChain passes)", () => {
      auditPolicyStore._resetCache();
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 1,
        maxEntries: 100,
      });
      auditPolicyStore._resetCache();

      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const recentDate = new Date();

      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: oldDate.toISOString(),
        action: "old_action",
      });
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: recentDate.toISOString(),
        action: "recent_action",
      });

      auditLogger.purgeOldEntries("test-org");
      const verification = auditLogger.verifyChain("test-org");
      assert.strictEqual(verification.valid, true);
      assert.strictEqual(verification.totalEntries, 1);
      assert.strictEqual(verification.verifiedEntries, 1);
    });

    it("should not cross org boundaries", () => {
      auditPolicyStore._resetCache();
      writePolicyDirectly(tmpPolicyPath, "org-a", {
        retentionDays: 1,
        maxEntries: 100,
      });
      writePolicyDirectly(tmpPolicyPath, "org-b", {
        retentionDays: 365,
        maxEntries: 100,
      });
      auditPolicyStore._resetCache();

      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "org-a",
        timestamp: oldDate.toISOString(),
        action: "action_a",
      });
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "org-b",
        timestamp: oldDate.toISOString(),
        action: "action_b",
      });

      const resultA = auditLogger.purgeOldEntries("org-a");
      assert.strictEqual(resultA.purged, 1);

      const resultB = auditLogger.purgeOldEntries("org-b");
      assert.strictEqual(resultB.purged, 0);
      assert.strictEqual(resultB.remaining, 1);
    });

    it("should use default policy (90 days) when no custom policy set", () => {
      const recentDate = new Date();
      const slightlyOldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "default-org",
        timestamp: slightlyOldDate.toISOString(),
        action: "action1",
      });
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "default-org",
        timestamp: recentDate.toISOString(),
        action: "action2",
      });

      const result = auditLogger.purgeOldEntries("default-org");
      assert.strictEqual(result.purged, 0);
      assert.strictEqual(result.remaining, 2);
    });

    it("should archive entries when archive policy is enabled", () => {
      auditPolicyStore._resetCache();
      writePolicyDirectly(tmpPolicyPath, "archive-org", {
        retentionDays: 1,
        maxEntries: 100,
        archive: true,
      });
      auditPolicyStore._resetCache();

      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "archive-org",
        timestamp: oldDate.toISOString(),
        action: "old_action",
      });

      const result = auditLogger.purgeOldEntries("archive-org");
      assert.strictEqual(result.purged, 1);
      assert.strictEqual(result.archived, 1);
    });
  });
});
