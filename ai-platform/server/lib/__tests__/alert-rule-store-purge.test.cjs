"use strict";

/**
 * Tests for alert-rule-store.cjs — purgeExpiredPreviousSecrets()
 * Tests the automated grace period cron cleanup logic.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

// We need to test purgeExpiredPreviousSecrets which reads from STORE_PATH.
// STORE_PATH is process.cwd() + '.simplebeacon/alert-rules.json'.
// We'll write directly to the store file and re-require the module.

const STORE_PATH = path.join(
  process.cwd(),
  ".simplebeacon",
  "alert-rules.json",
);
const BACKUP_PATH = STORE_PATH + ".test-backup";

describe("alert-rule-store purgeExpiredPreviousSecrets", () => {
  let storeModule;

  beforeEach(() => {
    // Backup existing store if present
    try {
      if (fs.existsSync(STORE_PATH)) {
        fs.copyFileSync(STORE_PATH, BACKUP_PATH);
        fs.unlinkSync(STORE_PATH);
      }
    } catch {}

    // Ensure directory exists
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Reset Jest's module registry for clean state
    jest.resetModules();

    storeModule = require("../alert-rule-store.cjs");
  });

  afterEach(() => {
    // Restore original store
    try {
      if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
      if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, STORE_PATH);
        fs.unlinkSync(BACKUP_PATH);
      }
    } catch {}

    jest.resetModules();
  });

  function writeStore(rules) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ rules }, null, 2), "utf8");
  }

  it("should export purgeExpiredPreviousSecrets", () => {
    assert.strictEqual(
      typeof storeModule.purgeExpiredPreviousSecrets,
      "function",
    );
  });

  it("should purge secrets where grace window has expired", () => {
    const expiredTime = new Date(
      Date.now() - 48 * 60 * 60 * 1000,
    ).toISOString(); // 48h ago
    writeStore({
      "rule-1": {
        id: "rule-1",
        orgId: "org-a",
        name: "Test Rule 1",
        destination: {
          type: "webhook",
          url: "https://example.com/webhook",
          secret: "encrypted:newsecret",
          previousSecret: "encrypted:oldsecret",
          secretRotatedAt: expiredTime,
        },
      },
    });

    // Clear cache to re-read
    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(24 * 60 * 60 * 1000); // 24h grace

    assert.strictEqual(result.checked, 1);
    assert.strictEqual(result.purged, 1);
    assert.strictEqual(result.details[0].ruleId, "rule-1");
    assert.strictEqual(result.details[0].purged, true);
    assert.strictEqual(result.details[0].reason, "grace_window_expired");
  });

  it("should NOT purge secrets where grace window is still active", () => {
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    writeStore({
      "rule-2": {
        id: "rule-2",
        orgId: "org-b",
        name: "Test Rule 2",
        destination: {
          type: "webhook",
          url: "https://example.com/webhook",
          secret: "encrypted:newsecret",
          previousSecret: "encrypted:oldsecret",
          secretRotatedAt: recentTime,
        },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(24 * 60 * 60 * 1000); // 24h grace

    assert.strictEqual(result.checked, 1);
    assert.strictEqual(result.purged, 0);
    assert.strictEqual(result.details[0].ruleId, "rule-2");
    assert.strictEqual(result.details[0].purged, false);
    assert.strictEqual(result.details[0].reason, "grace_window_active");
  });

  it("should purge secrets with missing secretRotatedAt timestamp", () => {
    writeStore({
      "rule-3": {
        id: "rule-3",
        orgId: "org-c",
        name: "Test Rule 3",
        destination: {
          type: "webhook",
          url: "https://example.com/webhook",
          secret: "encrypted:newsecret",
          previousSecret: "encrypted:oldsecret",
          // No secretRotatedAt
        },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(24 * 60 * 60 * 1000);

    assert.strictEqual(result.checked, 1);
    assert.strictEqual(result.purged, 1);
    assert.strictEqual(
      result.details[0].reason,
      "missing_rotated_at_timestamp",
    );
  });

  it("should skip rules without previousSecret", () => {
    writeStore({
      "rule-4": {
        id: "rule-4",
        orgId: "org-d",
        name: "Test Rule 4",
        destination: {
          type: "webhook",
          url: "https://example.com/webhook",
          secret: "encrypted:mysecret",
          // No previousSecret
        },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(24 * 60 * 60 * 1000);

    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.purged, 0);
    assert.strictEqual(result.details.length, 0);
  });

  it("should handle mixed expired and active secrets", () => {
    const expiredTime = new Date(
      Date.now() - 48 * 60 * 60 * 1000,
    ).toISOString();
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    writeStore({
      "rule-expired": {
        id: "rule-expired",
        orgId: "org-a",
        name: "Expired Rule",
        destination: {
          type: "webhook",
          previousSecret: "encrypted:old",
          secretRotatedAt: expiredTime,
        },
      },
      "rule-active": {
        id: "rule-active",
        orgId: "org-b",
        name: "Active Rule",
        destination: {
          type: "webhook",
          previousSecret: "encrypted:old",
          secretRotatedAt: recentTime,
        },
      },
      "rule-no-prev": {
        id: "rule-no-prev",
        orgId: "org-c",
        name: "No Previous Rule",
        destination: {
          type: "webhook",
          secret: "encrypted:only",
        },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(24 * 60 * 60 * 1000);

    assert.strictEqual(result.checked, 2); // only rules with previousSecret
    assert.strictEqual(result.purged, 1); // only the expired one
  });

  it("should use DEFAULT_GRACE_WINDOW_MS when no graceWindowMs provided", () => {
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    writeStore({
      "rule-default": {
        id: "rule-default",
        orgId: "org-a",
        name: "Default Grace Rule",
        destination: {
          type: "webhook",
          previousSecret: "encrypted:old",
          secretRotatedAt: recentTime,
        },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const result = storeModule.purgeExpiredPreviousSecrets(); // no arg → default

    assert.strictEqual(result.checked, 1);
    assert.strictEqual(result.purged, 0); // 1h ago < 24h default grace
    assert.strictEqual(result.details[0].reason, "grace_window_active");
  });

  it("should export getAllRulesAllOrgs", () => {
    assert.strictEqual(typeof storeModule.getAllRulesAllOrgs, "function");
  });

  it("getAllRulesAllOrgs should return rules from all orgs", () => {
    writeStore({
      "rule-a": {
        id: "rule-a",
        orgId: "org-a",
        name: "Rule A",
        destination: { type: "webhook", url: "https://a.com", secret: "enc:a" },
      },
      "rule-b": {
        id: "rule-b",
        orgId: "org-b",
        name: "Rule B",
        destination: { type: "webhook", url: "https://b.com", secret: "enc:b" },
      },
    });

    delete require.cache[require.resolve("../alert-rule-store.cjs")];
    delete require.cache[require.resolve("../crypto-utils.cjs")];
    storeModule = require("../alert-rule-store.cjs");

    const allRules = storeModule.getAllRulesAllOrgs();
    assert.strictEqual(allRules.length, 2);
    const orgIds = allRules.map((r) => r.orgId).sort();
    assert.deepStrictEqual(orgIds, ["org-a", "org-b"]);
  });
});
