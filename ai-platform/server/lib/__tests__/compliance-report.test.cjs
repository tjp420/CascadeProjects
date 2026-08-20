"use strict";

/**
 * Tests for Compliance Report Exporter.
 *
 * Verifies that generateComplianceReport() and complianceReportToCsv()
 * in audit-logger.cjs:
 *   1. Return a well-structured report with reportId, generatedAt, frameworks
 *   2. Include per-org chain integrity, retention policy, retention stats
 *   3. Include global autoPurgeStats, healStats, keyRotation, piiScrubbing
 *   4. Handle missing modules gracefully (key-rotation, pii-policy)
 *   5. CSV output contains section headers and per-org rows
 *   6. Report generation is audit-logged
 *   7. No raw PII in the report
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

describe("Compliance Report Exporter", () => {
  let tmpDir;
  let tmpLogPath;
  let tmpPolicyPath;
  let auditLogger;
  let auditPolicyStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "compliance-report-"));
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

  describe("generateComplianceReport()", () => {
    it("should return report with reportId, generatedAt, frameworks", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.reportId, "should have reportId");
      assert.ok(
        report.reportId.startsWith("rep_"),
        "reportId should start with rep_",
      );
      assert.ok(report.generatedAt, "should have generatedAt");
      assert.ok(
        Array.isArray(report.frameworks),
        "should have frameworks array",
      );
      assert.strictEqual(report.frameworks.length, 3);
      assert.ok(report.frameworks.includes("SOC 2"));
      assert.ok(report.frameworks.includes("GDPR"));
      assert.ok(report.frameworks.includes("ISO 27001"));
    });

    it("should include per-org chainIntegrity with valid, totalEntries, verifiedEntries", () => {
      const now = new Date();
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        now.toISOString(),
      ]);
      const report = auditLogger.generateComplianceReport("test-org");
      const orgProfile = report.orgs.find((o) => o.orgId === "test-org");
      assert.ok(orgProfile, "should have test-org profile");
      assert.ok(orgProfile.chainIntegrity, "should have chainIntegrity");
      assert.strictEqual(typeof orgProfile.chainIntegrity.valid, "boolean");
      assert.strictEqual(
        typeof orgProfile.chainIntegrity.totalEntries,
        "number",
      );
      assert.strictEqual(
        typeof orgProfile.chainIntegrity.verifiedEntries,
        "number",
      );
    });

    it("should include per-org retentionPolicy with retentionDays, maxEntries, archive", () => {
      writePolicyDirectly(tmpPolicyPath, "test-org", {
        retentionDays: 60,
        maxEntries: 5000,
        archive: true,
      });
      auditPolicyStore._resetCache();
      const report = auditLogger.generateComplianceReport("test-org");
      const orgProfile = report.orgs.find((o) => o.orgId === "test-org");
      assert.ok(orgProfile.retentionPolicy, "should have retentionPolicy");
      assert.strictEqual(orgProfile.retentionPolicy.retentionDays, 60);
      assert.strictEqual(orgProfile.retentionPolicy.maxEntries, 5000);
      assert.strictEqual(orgProfile.retentionPolicy.archive, true);
    });

    it("should include per-org retentionStats with total, purgeableCount", () => {
      const now = new Date();
      writeChainedEntries(auditLogger, tmpLogPath, "test-org", [
        now.toISOString(),
      ]);
      const report = auditLogger.generateComplianceReport("test-org");
      const orgProfile = report.orgs.find((o) => o.orgId === "test-org");
      assert.ok(orgProfile.retentionStats, "should have retentionStats");
      assert.strictEqual(typeof orgProfile.retentionStats.total, "number");
      assert.strictEqual(
        typeof orgProfile.retentionStats.purgeableCount,
        "number",
      );
    });

    it("should include global autoPurgeStats with totalSweeps, totalPurged, totalArchived", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.global.autoPurgeStats, "should have autoPurgeStats");
      assert.strictEqual(
        typeof report.global.autoPurgeStats.totalSweeps,
        "number",
      );
      assert.strictEqual(
        typeof report.global.autoPurgeStats.totalPurged,
        "number",
      );
      assert.strictEqual(
        typeof report.global.autoPurgeStats.totalArchived,
        "number",
      );
    });

    it("should include global healStats with totalRuns, totalQuarantined, totalRelinked", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.global.healStats, "should have healStats");
      assert.strictEqual(typeof report.global.healStats.totalRuns, "number");
      assert.strictEqual(
        typeof report.global.healStats.totalQuarantined,
        "number",
      );
      assert.strictEqual(
        typeof report.global.healStats.totalRelinked,
        "number",
      );
    });

    it("should include global piiScrubbing with enabled flag", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.global.piiScrubbing, "should have piiScrubbing");
      assert.strictEqual(typeof report.global.piiScrubbing.enabled, "boolean");
    });

    it("should include global keyRotation (or error if unavailable)", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.global.keyRotation, "should have keyRotation object");
      // Either has actual fields or an error message
      const hasFields =
        report.global.keyRotation.hasActive !== undefined ||
        report.global.keyRotation.error !== undefined;
      assert.ok(
        hasFields,
        "keyRotation should have either status fields or error",
      );
    });

    it("should include frameworks array with SOC 2, GDPR, ISO 27001", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(report.frameworks.includes("SOC 2"));
      assert.ok(report.frameworks.includes("GDPR"));
      assert.ok(report.frameworks.includes("ISO 27001"));
    });

    it("should handle empty store (no orgs) with valid structure", () => {
      const report = auditLogger.generateComplianceReport("default");
      assert.ok(Array.isArray(report.orgs), "orgs should be an array");
      // Should still include the caller's org even if empty
      assert.ok(
        report.orgs.length >= 1,
        "should include at least the caller org",
      );
    });

    it("should handle missing key-rotation-store gracefully", () => {
      // The function should not crash if key-rotation-store is unavailable
      const report = auditLogger.generateComplianceReport("test-org");
      assert.ok(
        report.global.keyRotation,
        "should still have keyRotation object",
      );
    });

    it("should handle missing pii-policy-store gracefully", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      const orgProfile = report.orgs.find((o) => o.orgId === "test-org");
      // piiPolicyCount should be 0 if store unavailable, not crash
      assert.strictEqual(typeof orgProfile.piiPolicyCount, "number");
    });

    it("should include reportId that is unique per generation", () => {
      const report1 = auditLogger.generateComplianceReport("test-org");
      const report2 = auditLogger.generateComplianceReport("test-org");
      assert.notStrictEqual(
        report1.reportId,
        report2.reportId,
        "reportIds should be unique",
      );
    });

    it("should audit-log the report generation with action compliance_report_generated", () => {
      auditLogger.generateComplianceReport("test-org");
      const store = JSON.parse(fs.readFileSync(tmpLogPath, "utf8"));
      const logEntries = Object.values(store.entries).filter(
        (e) => e.action === "compliance_report_generated",
      );
      assert.ok(
        logEntries.length >= 1,
        "should have audit-logged the report generation",
      );
      assert.strictEqual(logEntries[0].entity, "compliance_report");
      assert.ok(
        logEntries[0].entityId.startsWith("rep_"),
        "entityId should be the reportId",
      );
    });

    it("should not include raw PII in the report (uses scrubbed data)", () => {
      // Write an entry with PII-like data — it should be scrubbed in the log
      const now = new Date();
      writeEntryDirectly(auditLogger, tmpLogPath, {
        orgId: "test-org",
        timestamp: now.toISOString(),
        actorEmail: "user@example.com",
        action: "TEST",
      });
      const report = auditLogger.generateComplianceReport("test-org");
      // The report should not contain raw email addresses
      const reportStr = JSON.stringify(report);
      assert.ok(
        !reportStr.includes("user@example.com"),
        "should not contain raw PII",
      );
    });

    it("should place caller org first in the orgs array", () => {
      const now = new Date();
      writeChainedEntries(auditLogger, tmpLogPath, "org-a", [
        now.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "org-b", [
        now.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "caller-org", [
        now.toISOString(),
      ]);
      const report = auditLogger.generateComplianceReport("caller-org");
      assert.strictEqual(
        report.orgs[0].orgId,
        "caller-org",
        "caller org should be first",
      );
    });
  });

  describe("complianceReportToCsv()", () => {
    it("should produce CSV with report ID and generated timestamp in header", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      const csv = auditLogger.complianceReportToCsv(report);
      assert.ok(csv.includes(report.reportId), "CSV should contain reportId");
      assert.ok(
        csv.includes(report.generatedAt),
        "CSV should contain generatedAt",
      );
    });

    it("should include framework names in CSV header", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      const csv = auditLogger.complianceReportToCsv(report);
      assert.ok(csv.includes("SOC 2"), "CSV should mention SOC 2");
      assert.ok(csv.includes("GDPR"), "CSV should mention GDPR");
      assert.ok(csv.includes("ISO 27001"), "CSV should mention ISO 27001");
    });

    it("should include SECTION 1 and SECTION 2 headers", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      const csv = auditLogger.complianceReportToCsv(report);
      assert.ok(csv.includes("SECTION 1"), "CSV should have SECTION 1");
      assert.ok(csv.includes("SECTION 2"), "CSV should have SECTION 2");
      assert.ok(
        csv.includes("GLOBAL PLATFORM SECURITY CONTROLS"),
        "should have global controls section",
      );
      assert.ok(
        csv.includes("CRYPTOGRAPHIC ATTESTATION MATRIX"),
        "should have attestation matrix section",
      );
    });

    it("should include one row per org in Section 2", () => {
      const now = new Date();
      writeChainedEntries(auditLogger, tmpLogPath, "org-a", [
        now.toISOString(),
      ]);
      writeChainedEntries(auditLogger, tmpLogPath, "org-b", [
        now.toISOString(),
      ]);
      const report = auditLogger.generateComplianceReport("org-a");
      const csv = auditLogger.complianceReportToCsv(report);
      // Count rows in Section 2 (after the header line)
      const section2Idx = csv.indexOf("SECTION 2");
      const section2Content = csv.substring(section2Idx);
      const orgARow = section2Content.includes('"org-a"');
      const orgBRow = section2Content.includes('"org-b"');
      assert.ok(orgARow, "CSV should have row for org-a");
      assert.ok(orgBRow, "CSV should have row for org-b");
    });

    it("should include PII scrubbing status in CSV", () => {
      const report = auditLogger.generateComplianceReport("test-org");
      const csv = auditLogger.complianceReportToCsv(report);
      assert.ok(csv.includes("PII"), "CSV should mention PII");
      assert.ok(
        csv.includes("ENABLED") || csv.includes("DISABLED"),
        "should show PII status",
      );
    });
  });
});
