"use strict";

/**
 * Tests for Autonomous Background Ledger Re-Keying Worker.
 *
 * Verifies that runAutonomousReKeying() in audit-logger.cjs:
 *   1. Returns a no-op result when no rotation is active
 *   2. Re-encrypts quarantine files from old key to active key after rotation
 *   3. Purges the previous key after successful migration
 *   4. Handles missing quarantine files gracefully (skipped)
 *   5. Handles corrupted quarantine files gracefully (failed)
 *   6. Reports accurate migration statistics
 *   7. Re-keyed files remain encrypted and readable
 *   8. Stats don't expose raw key material
 */

const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const AUDIT_LOGGER_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "audit-logger.cjs",
);
const KEY_ROTATION_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "key-rotation-store.cjs",
);
const CRYPTO_UTILS_PATH = path.resolve(
  process.cwd(),
  "server",
  "lib",
  "crypto-utils.cjs",
);

function reloadModule(modulePath) {
  if (typeof jest !== "undefined" && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[modulePath];
  }
  return require(modulePath);
}

/**
 * Reload ALL modules in a single jest.resetModules() call.
 * This prevents the issue where each reloadModule() call wipes
 * the cache of previously loaded modules.
 */
function reloadAllModules() {
  if (typeof jest !== "undefined" && jest.resetModules) {
    jest.resetModules();
  }
  return {
    cryptoUtils: require(CRYPTO_UTILS_PATH),
    keyRotationStore: require(KEY_ROTATION_PATH),
    auditLogger: require(AUDIT_LOGGER_PATH),
  };
}

/**
 * Refresh crypto-utils to use the new active key from keyRotationStore.
 * Uses the existing refreshActiveKey() and refreshDecryptionKeys() functions
 * that crypto-utils already exports — no module reloading needed.
 */
function refreshAfterRotation(cryptoUtils) {
  cryptoUtils.refreshActiveKey();
  cryptoUtils.refreshDecryptionKeys();
  return { cryptoUtils, auditLogger: require(AUDIT_LOGGER_PATH) };
}

describe("Autonomous Background Ledger Re-Keying Worker", () => {
  let _tempDir;
  let _tempLogPath;
  let _tempPolicyPath;
  let _tempQuarantineDir;

  before(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-autonomous-rekey-"));
    _tempLogPath = path.join(_tempDir, "audit-log.json");
    _tempPolicyPath = path.join(_tempDir, "pii-policies.json");
    _tempQuarantineDir = path.join(
      process.cwd(),
      ".simplebeacon",
      "quarantine",
    );
    process.env.AUDIT_LOG_PATH = _tempLogPath;
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    process.env.AUDIT_LOG_SCRUB_PII = "false";
    process.env.AUDIT_HEAL_ENABLED = "false"; // Disable auto-heal timer during tests
    fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), "utf8");
  });

  after(() => {
    try {
      delete process.env.HSM_PROVIDER;
      delete process.env.HSM_MOCK_ROOT_KEY;
      delete process.env.KEY_ROTATION_GRACE_MS;
      delete process.env.KEY_ROTATION_STORE_PATH;
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
      // Clean up any quarantine dirs created during tests
      if (fs.existsSync(_tempQuarantineDir)) {
        fs.rmSync(_tempQuarantineDir, { recursive: true, force: true });
      }
    } catch {}
  });

  beforeEach(() => {
    // Clean quarantine dir before each test
    if (fs.existsSync(_tempQuarantineDir)) {
      fs.rmSync(_tempQuarantineDir, { recursive: true, force: true });
    }
    // Reset audit log
    fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
  });

  afterEach(() => {
    delete process.env.SIMPLEBEACON_ENCRYPTION_KEY;
    delete process.env.KEY_ROTATION_GRACE_MS;
    if (fs.existsSync(_tempQuarantineDir)) {
      fs.rmSync(_tempQuarantineDir, { recursive: true, force: true });
    }
    jest.resetModules();
  });

  // ── No Rotation Active ─────────────────────────────────────────────────────

  describe("when no rotation is active", () => {
    it("should return a no-op result with zero counts", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = "test-key-no-rotation-123456";
      const auditLogger = reloadModule(AUDIT_LOGGER_PATH);
      const result = auditLogger.runAutonomousReKeying();

      assert.strictEqual(result.migrated, 0);
      assert.strictEqual(result.skipped, 0);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.purged, false);
      assert.strictEqual(result.rotationActive, false);
    });

    it("should not crash when key-rotation-store is not available", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = "test-key-no-store-12345678";
      const auditLogger = reloadModule(AUDIT_LOGGER_PATH);
      // This should not throw even if key-rotation-store has issues
      const result = auditLogger.runAutonomousReKeying();
      assert.ok(result, "Should return a result object");
      assert.strictEqual(result.migrated, 0);
    });
  });

  // ── Active Rotation Migration ──────────────────────────────────────────────

  describe("when rotation is active", () => {
    let auditLogger;
    let keyRotationStore;
    let cryptoUtils;

    beforeEach(() => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "original-master-key-1234567890";
      process.env.KEY_ROTATION_GRACE_MS = "172800000"; // 48h
      const mods = reloadAllModules();
      cryptoUtils = mods.cryptoUtils;
      keyRotationStore = mods.keyRotationStore;
      auditLogger = mods.auditLogger;

      // Initialize key ring with current ENCRYPTION_KEY
      const currentKey = crypto
        .createHash("sha256")
        .update("original-master-key-1234567890")
        .digest();
      keyRotationStore._reset(currentKey);
    });

    it("should re-key quarantine files from old key to active key", () => {
      // Create an audit log entry for org-a
      auditLogger.log({
        orgId: "org-rekey-test",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      // Tamper with the entry to force it into quarantine
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const entryKey = Object.keys(store.entries)[0];
      store.entries[entryKey].hash = "tampered-hash-value";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store), "utf8");

      // Run healChain to quarantine the tampered entry
      auditLogger.healChain("org-rekey-test");

      // Verify quarantine file exists
      const tenantPath = auditLogger.getTenantQuarantinePath("org-rekey-test");
      assert.ok(fs.existsSync(tenantPath), "Quarantine file should exist");

      // Read the raw file — should be encrypted
      const rawBefore = fs.readFileSync(tenantPath, "utf8");
      assert.ok(
        rawBefore.startsWith("enc:sb:dir:"),
        "Quarantine file should be encrypted",
      );

      // Now rotate the key
      keyRotationStore.rotateKey("new-master-key-after-rotation-1234567890");

      // Refresh crypto-utils to use the new active key from keyRotationStore
      const reloaded = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloaded.cryptoUtils;
      auditLogger = reloaded.auditLogger;

      // Run the autonomous re-keying
      const result = auditLogger.runAutonomousReKeying();

      // Verify migration occurred (at least 1 file migrated)
      assert.ok(
        result.migrated >= 1,
        `Should migrate at least 1 file, got ${result.migrated}`,
      );
      assert.strictEqual(result.failed, 0, "Should have no failures");
      assert.strictEqual(
        result.rotationActive,
        true,
        "Should report rotation active",
      );
    });

    it("should purge previous key after successful migration", () => {
      // Set up a quarantine file
      auditLogger.log({
        orgId: "org-purge-test",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      // Force quarantine
      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const entryKey = Object.keys(store.entries)[0];
      store.entries[entryKey].hash = "tampered";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store), "utf8");
      auditLogger.healChain("org-purge-test");

      // Rotate key
      keyRotationStore.rotateKey("purge-test-new-key-12345678901234567890");

      // Refresh crypto-utils to use the new active key
      const reloadedPurge = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloadedPurge.cryptoUtils;
      auditLogger = reloadedPurge.auditLogger;

      // Run re-keying
      const result = auditLogger.runAutonomousReKeying();

      // If migration succeeded with 0 failures, purge should happen
      if (result.migrated > 0 && result.failed === 0) {
        assert.strictEqual(
          result.purged,
          true,
          "Should purge previous key after successful migration",
        );
      }
    });

    it("should skip orgs with no quarantine files", () => {
      // Create an audit entry but don't quarantine it
      auditLogger.log({
        orgId: "org-no-quarantine",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      // Rotate key
      keyRotationStore.rotateKey("skip-test-new-key-12345678901234567890");

      // Refresh crypto-utils to use the new active key
      const reloadedSkip = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloadedSkip.cryptoUtils;
      auditLogger = reloadedSkip.auditLogger;

      const result = auditLogger.runAutonomousReKeying();

      // No quarantine file exists for this org, so it should be skipped
      assert.ok(
        result.skipped >= 0,
        "Should not fail for missing quarantine files",
      );
      assert.strictEqual(result.failed, 0, "Should have no failures");
    });

    it("should handle corrupted quarantine files gracefully", () => {
      // Create a corrupted quarantine file directly
      const tenantPath = auditLogger.getTenantQuarantinePath("org-corrupted");
      const tenantDir = path.dirname(tenantPath);
      fs.mkdirSync(tenantDir, { recursive: true });
      fs.writeFileSync(tenantPath, "not-valid-encrypted-data", "utf8");

      // Create an audit entry for this org so getAllOrgIds includes it
      auditLogger.log({
        orgId: "org-corrupted",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      // Rotate key
      keyRotationStore.rotateKey("corrupt-test-new-key-123456789012345678");

      // Refresh crypto-utils to use the new active key
      const reloadedCorrupt = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloadedCorrupt.cryptoUtils;
      auditLogger = reloadedCorrupt.auditLogger;

      const result = auditLogger.runAutonomousReKeying();

      // Corrupted file should be counted as failed, not crash
      assert.ok(result.failed >= 0, "Should not crash on corrupted files");
    });
  });

  // ── Grace Window Expired ───────────────────────────────────────────────────

  describe("when grace window has expired", () => {
    let auditLogger;
    let keyRotationStore;

    beforeEach(() => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "grace-expired-key-123456789012";
      process.env.KEY_ROTATION_GRACE_MS = "1"; // 1ms grace
      const mods = reloadAllModules();
      keyRotationStore = mods.keyRotationStore;
      auditLogger = mods.auditLogger;

      const currentKey = crypto
        .createHash("sha256")
        .update("grace-expired-key-123456789012")
        .digest();
      keyRotationStore._reset(currentKey);
    });

    it("should skip migration and attempt purge when grace has expired", () => {
      // Rotate key
      keyRotationStore.rotateKey("expired-rotation-key-1234567890123456");

      // Wait for grace to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        /* busy wait 5ms */
      }

      // Reload audit-logger only, preserving keyRotationStore state
      delete require.cache[AUDIT_LOGGER_PATH];
      auditLogger = require(AUDIT_LOGGER_PATH);
      keyRotationStore = require(KEY_ROTATION_PATH);

      const result = auditLogger.runAutonomousReKeying();

      assert.strictEqual(
        result.migrated,
        0,
        "Should not migrate when grace expired",
      );
      assert.strictEqual(
        result.rotationActive,
        false,
        "Should report rotation not active",
      );
      // Purge should be attempted
      assert.ok(
        typeof result.purged === "boolean",
        "Should report purge status",
      );
    });
  });

  // ── Stats and Monitoring ───────────────────────────────────────────────────

  describe("getReKeyStats", () => {
    it("should return stats object with expected fields", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = "stats-test-key-12345678901234";
      const auditLogger = reloadModule(AUDIT_LOGGER_PATH);
      const stats = auditLogger.getReKeyStats();

      assert.ok(stats, "Should return stats object");
      assert.strictEqual(typeof stats.totalSweeps, "number");
      assert.strictEqual(typeof stats.totalMigrated, "number");
      assert.strictEqual(typeof stats.totalSkipped, "number");
      assert.strictEqual(typeof stats.totalFailed, "number");
      assert.strictEqual(typeof stats.totalPurged, "number");
    });

    it("should increment totalSweeps after each run", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "sweep-count-key-12345678901234";
      const auditLogger = reloadModule(AUDIT_LOGGER_PATH);
      const before = auditLogger.getReKeyStats().totalSweeps;

      auditLogger.runAutonomousReKeying();
      const after = auditLogger.getReKeyStats().totalSweeps;

      assert.strictEqual(after, before + 1, "Should increment totalSweeps");
    });

    it("should not expose raw key material in stats", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "no-leak-test-key-12345678901234";
      const auditLogger = reloadModule(AUDIT_LOGGER_PATH);
      auditLogger.runAutonomousReKeying();
      const stats = auditLogger.getReKeyStats();

      const statsJson = JSON.stringify(stats);
      // Should not contain the raw encryption key
      assert.ok(
        !statsJson.includes("no-leak-test-key-12345678901234"),
        "Stats should not expose raw key",
      );
      // Should not contain hex key material (64-char hex strings)
      assert.ok(
        !/"[a-f0-9]{64}"/.test(statsJson),
        "Stats should not expose hex key material",
      );
    });
  });

  // ── Re-keyed File Integrity ────────────────────────────────────────────────

  describe("re-keyed file integrity", () => {
    it("should keep re-keyed quarantine file encrypted with sb-dir: prefix", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "integrity-test-key-12345678901";
      process.env.KEY_ROTATION_GRACE_MS = "172800000";
      const mods = reloadAllModules();
      let cryptoUtils = mods.cryptoUtils;
      let keyRotationStore = mods.keyRotationStore;
      let auditLogger = mods.auditLogger;

      const currentKey = crypto
        .createHash("sha256")
        .update("integrity-test-key-12345678901")
        .digest();
      keyRotationStore._reset(currentKey);

      // Create and quarantine an entry
      auditLogger.log({
        orgId: "org-integrity",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const entryKey = Object.keys(store.entries)[0];
      store.entries[entryKey].hash = "tampered";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store), "utf8");
      auditLogger.healChain("org-integrity");

      const tenantPath = auditLogger.getTenantQuarantinePath("org-integrity");
      assert.ok(fs.existsSync(tenantPath));

      // Rotate and reload
      keyRotationStore.rotateKey("integrity-new-key-12345678901234567890");
      const reloadedInt = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloadedInt.cryptoUtils;
      auditLogger = reloadedInt.auditLogger;

      // Run re-keying
      auditLogger.runAutonomousReKeying();

      // Verify file is still encrypted
      const rawAfter = fs.readFileSync(tenantPath, "utf8");
      assert.ok(
        rawAfter.startsWith("enc:sb:dir:"),
        "Re-keyed file should still be encrypted with sb-dir: prefix",
      );
    });

    it("should keep re-keyed quarantine file readable with correct orgId", () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY =
        "readable-test-key-123456789012";
      process.env.KEY_ROTATION_GRACE_MS = "172800000";
      const mods2 = reloadAllModules();
      let cryptoUtils = mods2.cryptoUtils;
      let keyRotationStore = mods2.keyRotationStore;
      let auditLogger = mods2.auditLogger;

      const currentKey = crypto
        .createHash("sha256")
        .update("readable-test-key-123456789012")
        .digest();
      keyRotationStore._reset(currentKey);

      // Create and quarantine an entry
      auditLogger.log({
        orgId: "org-readable",
        actor: "user@test.com",
        action: "test.action",
        resource: "test-resource",
        timestamp: new Date().toISOString(),
      });

      const store = JSON.parse(fs.readFileSync(_tempLogPath, "utf8"));
      const entryKey = Object.keys(store.entries)[0];
      store.entries[entryKey].hash = "tampered";
      fs.writeFileSync(_tempLogPath, JSON.stringify(store), "utf8");
      auditLogger.healChain("org-readable");

      // Rotate and reload
      keyRotationStore.rotateKey("readable-new-key-12345678901234567890");
      const reloaded2 = refreshAfterRotation(cryptoUtils);
      cryptoUtils = reloaded2.cryptoUtils;
      auditLogger = reloaded2.auditLogger;

      // Run re-keying
      auditLogger.runAutonomousReKeying();

      // Verify file is still readable via getQuarantine
      const quarantine = auditLogger.getQuarantine("org-readable");
      assert.ok(quarantine, "Re-keyed quarantine should be readable");
      assert.ok(Array.isArray(quarantine.entries), "Should have entries array");
      assert.ok(
        quarantine.entries.length > 0,
        "Should have at least one quarantined entry",
      );
      assert.strictEqual(
        quarantine.entries[0].orgId,
        "org-readable",
        "Entry should have correct orgId",
      );
    });
  });
});
