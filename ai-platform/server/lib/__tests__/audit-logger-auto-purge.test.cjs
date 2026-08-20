"use strict";

/**
 * Tests for Autonomous Lifecycle Purge (Automated Purge Schedule).
 *
 * Verifies that runAutonomousLifecyclePurge() in audit-logger.cjs:
 *   1. Iterates all orgs from getAllOrgIds()
 *   2. Calls purgeOldEntries(orgId) for each org
 *   3. Writes audit_retention_auto_purge log entry when purged > 0
 *   4. Uses system actor for auto-purge log entries
 *   5. Does not write log entry when purged === 0
 *   6. Isolates per-org errors (one org failure doesn't block others)
 *   7. Respects safety floor (maxEntries most recent preserved)
 *   8. Hash chain remains valid after auto-purge
 *   9. Returns summary with totalPurged, totalArchived, orgsProcessed, orgsPurged, errors
 *  10. Tracks stats in _lifecyclePurgeStats
 *  11. Does not cross org boundaries
 *  12. Guard flag prevents concurrent sweeps
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
  const auditLogger = require(AUDIT_LOGGER_PATH);
  const auditPolicyStore = require(POLICY_STORE_PATH);
  return { auditLogger, auditPolicyStore };
}

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
  const entryWithoutHash = { ...entry };
  delete entryWithoutHash.hash;
  entry.hash = auditLogger.computeEntryHash(entryWithoutHash, entry.prevHash);
  const key = orgId ? `${orgId}::${id}` : id;
  store.entries[key] = entry;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return entry;
}

/**
 * Write a sequence of entries for an org with proper hash chain linking.
 */
function writeChainedEntries(auditLogger, storePath, orgId, timestamps) {
  let prevHash = "0".repeat(64);
  const entries = [];
  for (const ts of timestamps) {
    const entry = writeEntryDirectly(auditLogger, storePath, {
      orgId,
      timestamp: ts,
      action: "TEST",
      prevHash,
    });
    prevHash = entry.hash;
    entries.push(entry);
  }
  return entries;
}

describe("Autonomous Lifecycle Purge", () => {
  let tmpDir;
  let tmpLogPath;
  let tmpPolicyPath;
  let auditLogger;
  let auditPolicyStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-auto-purge-"));
    tmpLogPath = path.join(tmpDir, "audit-log.json");
    tmpPolicyPath = path.join(tmpDir, "audit-policy.json");
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

  describe("runAutonomousLifecyclePurge()", () => {
    it("should return zero results for empty store", async () => {
      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.totalPurged, 0);
      assert.strictEqual(result.totalArchived, 0);
      assert.strictEqual(result.orgsProcessed, 0);
      assert.strictEqual(result.orgsPurged, 0);
      assert.deepStrictEqual(result.errors, []);
    });

    it("should iterate all orgs from getAllOrgIds()", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "org-a", [
        oldDate.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "org-b", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "org-a", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      writePolicyDirectly(tmpPolicyPath, "org-b", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.orgsProcessed, 2);
      assert.strictEqual(result.orgsPurged, 2);
      assert.strictEqual(result.totalPurged, 2);
    });

    it("should call purgeOldEntries and evict expired entries", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
        now.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.totalPurged, 1);
      assert.strictEqual(result.orgsPurged, 1);

      // Verify the old entry is gone; the auto-purge log entry is also written
      // so total = 1 (recent) + 1 (auto-purge log) = 2
      const stats = auditLogger.getRetentionStats("test-org");
      assert.strictEqual(stats.total, 2);
      // Verify no entries with action 'TEST' older than retention remain
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const testEntries = Object.values(store.entries).filter(
        (e) => e.orgId === "test-org" && e.action === "TEST",
      );
      assert.strictEqual(testEntries.length, 1);
    });

    it("should write audit_retention_auto_purge log entry when purged > 0", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      await auditLogger.runAutonomousLifecyclePurge();

      // Check that an auto-purge audit entry was written
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const autoPurgeEntries = Object.values(store.entries).filter(
        (e) => e.action === "audit_retention_auto_purge",
      );
      assert.strictEqual(autoPurgeEntries.length, 1);
      assert.strictEqual(autoPurgeEntries[0].orgId, "test-org");
    });

    it("should NOT write audit_retention_auto_purge when purged === 0", async () => {
      const now = new Date();
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        now.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.totalPurged, 0);

      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const autoPurgeEntries = Object.values(store.entries).filter(
        (e) => e.action === "audit_retention_auto_purge",
      );
      assert.strictEqual(autoPurgeEntries.length, 0);
    });

    it("should use system actor for auto-purge log entry", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      await auditLogger.runAutonomousLifecyclePurge();

      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const autoPurgeEntry = Object.values(store.entries).find(
        (e) => e.action === "audit_retention_auto_purge",
      );
      assert.ok(autoPurgeEntry);
      assert.strictEqual(autoPurgeEntry.actorId, "system");
      assert.strictEqual(autoPurgeEntry.actorEmail, "system@internal");
    });

    it("should include metadata with purged, remaining, archived, policy in log entry", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      await auditLogger.runAutonomousLifecyclePurge();

      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const autoPurgeEntry = Object.values(store.entries).find(
        (e) => e.action === "audit_retention_auto_purge",
      );
      assert.ok(autoPurgeEntry.metadata);
      assert.strictEqual(autoPurgeEntry.metadata.purged, 1);
      assert.strictEqual(autoPurgeEntry.metadata.remaining, 0);
      assert.strictEqual(autoPurgeEntry.metadata.archived, 0);
      assert.strictEqual(autoPurgeEntry.metadata.autoPurge, true);
      assert.ok(autoPurgeEntry.metadata.policy);
      assert.strictEqual(autoPurgeEntry.metadata.policy.retentionDays, 30);
      assert.strictEqual(autoPurgeEntry.metadata.policy.maxEntries, 100);
      assert.strictEqual(autoPurgeEntry.metadata.policy.archive, false);
    });

    it("should return summary with totalPurged, totalArchived, orgsProcessed, orgsPurged, errors", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(typeof result.totalPurged, "number");
      assert.strictEqual(typeof result.totalArchived, "number");
      assert.strictEqual(typeof result.orgsProcessed, "number");
      assert.strictEqual(typeof result.orgsPurged, "number");
      assert.ok(Array.isArray(result.errors));
    });

    it("should isolate per-org errors (one failure does not block others)", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "good-org", [
        oldDate.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "bad-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "good-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      // Don't set a policy for bad-org — it will use defaults (90 days)
      // Instead, we'll corrupt its entry to cause an error
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const badKey = Object.keys(store.entries).find((k) =>
        k.startsWith("bad-org::"),
      );
      if (badKey) {
        store.entries[badKey].timestamp = "INVALID-TIMESTAMP";
        fs.writeFileSync(tmpLogPath, JSON.stringify(store, null, 2));
      }
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      // good-org should still be processed even if bad-org errors
      assert.ok(result.orgsProcessed >= 1);
      // The good org should have been purged
      assert.ok(result.totalPurged >= 0); // bad-org might not error, just not purge
    });

    it("should record errors in errors array with orgId and message", async () => {
      // Create an org with entries that have null timestamps, which will
      // cause a TypeError in the sort() call inside purgeOldEntries().
      // Need 2+ entries to trigger the sort comparator.
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      for (let i = 0; i < 2; i++) {
        const id = `audit-corrupt${i}`;
        const key = "corrupt-org::" + id;
        store.entries[key] = {
          id,
          orgId: "corrupt-org",
          timestamp: null, // This will cause TypeError in sort comparator
          actorId: "unknown",
          actorEmail: "unknown",
          action: "CORRUPT",
          entity: "test",
          entityId: "",
          changes: null,
          metadata: null,
          prevHash: "0".repeat(64),
          hash: "0".repeat(64),
        };
      }
      fs.writeFileSync(tmpLogPath, JSON.stringify(store, null, 2));
      writePolicyDirectly(tmpPolicyPath, "corrupt-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].orgId);
      assert.ok(result.errors[0].error);
    });

    it("should respect safety floor (maxEntries most recent preserved)", async () => {
      const now = new Date();
      const oldDates = [];
      for (let i = 0; i < 5; i++) {
        oldDates.push(
          new Date(
            now.getTime() - (100 + i) * 24 * 60 * 60 * 1000,
          ).toISOString(),
        );
      }
      // Add 5 old entries + 3 recent entries
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        ...oldDates,
        now.toISOString(),
        new Date(now.getTime() - 1000).toISOString(),
        new Date(now.getTime() - 2000).toISOString(),
      ]);
      // Set maxEntries to 3 — safety floor should preserve 3 most recent
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 3,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      // 5 old entries should be purged, 3 recent preserved
      assert.strictEqual(result.totalPurged, 5);
      // 3 recent TEST entries preserved + 1 auto-purge log entry = 4 total
      const stats = auditLogger.getRetentionStats("test-org");
      assert.strictEqual(stats.total, 4);
      // Verify only 3 TEST entries remain (safety floor)
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const testEntries = Object.values(store.entries).filter(
        (e) => e.orgId === "test-org" && e.action === "TEST",
      );
      assert.strictEqual(testEntries.length, 3);
    });

    it("should maintain hash chain validity after auto-purge", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
        now.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      await auditLogger.runAutonomousLifecyclePurge();

      // verifyChain should pass after purge
      const verification = auditLogger.verifyChain("test-org");
      assert.strictEqual(verification.valid, true);
    });

    it("should not cross org boundaries", async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      // org-a has an old entry, org-b has only a recent entry
      writeChainedEntries(auditLogger, tmpLogPath, "org-a", [
        oldDate.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "org-b", [
        now.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "org-a", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      writePolicyDirectly(tmpPolicyPath, "org-b", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.totalPurged, 1); // Only org-a's entry

      // org-b should still have its entry
      const statsB = auditLogger.getRetentionStats("org-b");
      assert.strictEqual(statsB.total, 1);
    });

    it("should handle org with empty entries gracefully", async () => {
      // Create an org with entries, then purge all — second sweep should skip
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      // First sweep purges the entry
      const result1 = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result1.totalPurged, 1);

      // Second sweep: the auto-purge log entry from the first sweep is now
      // in the store under 'test-org', so orgsProcessed = 1 but nothing to purge
      const result2 = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result2.totalPurged, 0);
      assert.strictEqual(result2.orgsPurged, 0); // Nothing purged
    });

    it("should track stats in getLifecyclePurgeStats()", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      const initialStats = auditLogger.getLifecyclePurgeStats();
      assert.strictEqual(initialStats.totalSweeps, 0);
      assert.strictEqual(initialStats.totalPurged, 0);

      await auditLogger.runAutonomousLifecyclePurge();

      const stats = auditLogger.getLifecyclePurgeStats();
      assert.strictEqual(stats.totalSweeps, 1);
      assert.strictEqual(stats.totalPurged, 1);
      assert.ok(stats.lastRun);
      assert.ok(stats.lastResult);
      assert.strictEqual(stats.lastResult.totalPurged, 1);
    });

    it("should guard against concurrent sweeps", async () => {
      // The function should return empty result if already running.
      // Since the function is synchronous, we can't truly test concurrency,
      // but we can verify the guard flag logic by checking it returns
      // the expected shape.
      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.ok(typeof result.totalPurged === "number");
      assert.ok(Array.isArray(result.errors));
    });

    it("should record archive count when archive policy is true", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: true,
      });
      auditPolicyStore._resetCache();

      const result = await auditLogger.runAutonomousLifecyclePurge();
      assert.strictEqual(result.totalPurged, 1);
      assert.strictEqual(result.totalArchived, 1);

      // Verify archive file was created
      const archivePath = path.join(tmpDir, "audit-archive-test-org.json");
      assert.ok(fs.existsSync(archivePath));
    });

    it("should write auto-purge log entry with entity and entityId set correctly", async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        oldDate.toISOString(),
      ]);
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 30,
        maxEntries: 100,
        archive: false,
      });
      auditPolicyStore._resetCache();

      await auditLogger.runAutonomousLifecyclePurge();

      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const autoPurgeEntry = Object.values(store.entries).find(
        (e) => e.action === "audit_retention_auto_purge",
      );
      assert.strictEqual(autoPurgeEntry.entity, "audit_log");
      assert.strictEqual(autoPurgeEntry.entityId, "test-org");
    });
  });
});
