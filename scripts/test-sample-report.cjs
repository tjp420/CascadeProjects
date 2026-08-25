"use strict";

/**
 * Tests for Sample CLI Report Generator
 *
 * Tests cover:
 * - Report structure: all required top-level fields present
 * - Severity distribution: 3 critical, 4 high, 3 medium, 2 low
 * - Alert template coverage: all 12 alert template rules represented
 * - Gate logic: blocking/warning counts match severity counts
 * - Adaptability: sample report passes through adaptCliReport cleanly
 * - Determinism: generateSampleReport() produces same output every time
 * - Dashboard compatibility: adapted report has all fields widgets need
 *
 * Run: node --test scripts/test-sample-report.cjs
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Read the sample-report.js ESM source and convert to CJS for testing
const sampleSource = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "ai-platform",
    "web",
    "simplebeacon-dashboard",
    "js-es2018",
    "utils",
    "sample-report.js",
  ),
  "utf8",
);
const cjsSample =
  sampleSource.replace(/export function/g, "function") +
  "\nmodule.exports = { generateSampleReport };";

const tempSamplePath = path.join(__dirname, "temp-sample-report.cjs");
fs.writeFileSync(tempSamplePath, cjsSample);
const { generateSampleReport } = require(tempSamplePath);
fs.unlinkSync(tempSamplePath);

// Read the adapter source and convert to CJS for testing
const adapterSource = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "ai-platform",
    "web",
    "simplebeacon-dashboard",
    "js-es2018",
    "utils",
    "cli-report-adapter.js",
  ),
  "utf8",
);
const cjsAdapter =
  adapterSource
    .replace(/export function/g, "function")
    .replace(/^export \{[^}]+\};?$/m, "") +
  "\nmodule.exports = { adaptCliReport, adaptCliReportHistory };";

const tempAdapterPath = path.join(__dirname, "temp-adapter-sample.cjs");
fs.writeFileSync(tempAdapterPath, cjsAdapter);
const { adaptCliReport } = require(tempAdapterPath);
fs.unlinkSync(tempAdapterPath);

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

describe("generateSampleReport structure", () => {
  test("returns a valid JSON object", () => {
    const report = generateSampleReport();
    assert.ok(report);
    assert.equal(typeof report, "object");
  });

  test("has correct type field", () => {
    const report = generateSampleReport();
    assert.equal(report.type, "simplebeacon-scan");
  });

  test("has reportVersion", () => {
    const report = generateSampleReport();
    assert.equal(report.reportVersion, 2);
  });

  test("has generatedAt as ISO string", () => {
    const report = generateSampleReport();
    assert.ok(report.generatedAt);
    assert.doesNotThrow(() => new Date(report.generatedAt).toISOString());
  });

  test("has projectRoot", () => {
    const report = generateSampleReport();
    assert.ok(report.projectRoot);
    assert.equal(typeof report.projectRoot, "string");
  });

  test("has scanPaths array", () => {
    const report = generateSampleReport();
    assert.ok(Array.isArray(report.scanPaths));
    assert.ok(report.scanPaths.length > 0);
  });

  test("has gate object with pass=false", () => {
    const report = generateSampleReport();
    assert.ok(report.gate);
    assert.equal(report.gate.pass, false);
  });

  test("has severityCounts object", () => {
    const report = generateSampleReport();
    assert.ok(report.severityCounts);
    assert.equal(typeof report.severityCounts, "object");
  });

  test("has rawIssues array", () => {
    const report = generateSampleReport();
    assert.ok(Array.isArray(report.rawIssues));
    assert.ok(report.rawIssues.length > 0);
  });

  test("has totalFiles as number", () => {
    const report = generateSampleReport();
    assert.equal(typeof report.totalFiles, "number");
    assert.ok(report.totalFiles > 0);
  });

  test("has ruleTimings array", () => {
    const report = generateSampleReport();
    assert.ok(Array.isArray(report.ruleTimings));
    assert.ok(report.ruleTimings.length > 0);
  });

  test("has summary with qualityScore", () => {
    const report = generateSampleReport();
    assert.ok(report.summary);
    assert.equal(typeof report.summary.qualityScore, "number");
  });
});

describe("generateSampleReport severity distribution", () => {
  test("has exactly 3 critical findings", () => {
    const report = generateSampleReport();
    assert.equal(report.severityCounts.critical, 3);
  });

  test("has exactly 4 high findings", () => {
    const report = generateSampleReport();
    assert.equal(report.severityCounts.high, 4);
  });

  test("has exactly 3 medium findings", () => {
    const report = generateSampleReport();
    assert.equal(report.severityCounts.medium, 3);
  });

  test("has exactly 2 low findings", () => {
    const report = generateSampleReport();
    assert.equal(report.severityCounts.low, 2);
  });

  test("total issues = 12", () => {
    const report = generateSampleReport();
    const total =
      report.severityCounts.critical +
      report.severityCounts.high +
      report.severityCounts.medium +
      report.severityCounts.low;
    assert.equal(total, 12);
    assert.equal(report.rawIssues.length, 12);
  });

  test("severityCounts match rawIssues counts", () => {
    const report = generateSampleReport();
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of report.rawIssues) {
      counts[issue.severity]++;
    }
    assert.deepEqual(report.severityCounts, counts);
  });
});

describe("generateSampleReport alert template coverage", () => {
  test("includes SB-SEC-014 (GCP Service Account Key)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-014"));
  });

  test("includes SB-SEC-015 (Azure Storage Key)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-015"));
  });

  test("includes SB-SEC-009 (.env Committed)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-009"));
  });

  test("includes SB-SEC-016 (OAuth Token)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-016"));
  });

  test("includes SB-SEC-017 (Docker Privileged)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-017"));
  });

  test("includes SB-SEC-021 (Suspicious Package)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-021"));
  });

  test("includes SB-SEC-022 (Malicious postinstall)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-022"));
  });

  test("includes SB-SEC-018 (Docker Root User)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-018"));
  });

  test("includes SB-SEC-023 (Unpinned Dependency)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-023"));
  });

  test("includes SB-SEC-020 (Docker Health Check)", () => {
    const report = generateSampleReport();
    assert.ok(report.rawIssues.some((i) => i.pattern === "SB-SEC-020"));
  });
});

describe("generateSampleReport gate logic", () => {
  test("gate.pass is false (has blocking issues)", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.pass, false);
  });

  test("gate.blockingCount = 7 (3 critical + 4 high)", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.blockingCount, 7);
  });

  test("gate.warningCount = 5 (3 medium + 2 low)", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.warningCount, 5);
  });

  test("gate.status is BLOCKED", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.status, "BLOCKED");
  });

  test("gate.blockingIssues has 7 entries", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.blockingIssues.length, 7);
  });

  test("gate.warningIssues has 5 entries", () => {
    const report = generateSampleReport();
    assert.equal(report.gate.warningIssues.length, 5);
  });

  test("gate has remediation array", () => {
    const report = generateSampleReport();
    assert.ok(Array.isArray(report.gate.remediation));
    assert.ok(report.gate.remediation.length > 0);
  });
});

describe("generateSampleReport issue quality", () => {
  test("each issue has required fields", () => {
    const report = generateSampleReport();
    for (const issue of report.rawIssues) {
      assert.ok(issue.id, "issue.id");
      assert.ok(issue.severity, "issue.severity");
      assert.ok(issue.type, "issue.type");
      assert.ok(issue.pattern, "issue.pattern");
      assert.ok(issue.filePath, "issue.filePath");
      assert.ok(issue.description, "issue.description");
      assert.equal(typeof issue.confidence, "number");
    }
  });

  test("severities are lowercase", () => {
    const report = generateSampleReport();
    for (const issue of report.rawIssues) {
      assert.match(issue.severity, /^(critical|high|medium|low)$/);
    }
  });

  test("confidence values are between 0 and 1", () => {
    const report = generateSampleReport();
    for (const issue of report.rawIssues) {
      assert.ok(
        issue.confidence >= 0 && issue.confidence <= 1,
        `confidence ${issue.confidence} out of range for ${issue.id}`,
      );
    }
  });
});

describe("generateSampleReport determinism", () => {
  test("produces same severity counts on every call", () => {
    const r1 = generateSampleReport();
    const r2 = generateSampleReport();
    assert.deepEqual(r1.severityCounts, r2.severityCounts);
  });

  test("produces same number of issues on every call", () => {
    const r1 = generateSampleReport();
    const r2 = generateSampleReport();
    assert.equal(r1.rawIssues.length, r2.rawIssues.length);
  });

  test("produces same gate status on every call", () => {
    const r1 = generateSampleReport();
    const r2 = generateSampleReport();
    assert.equal(r1.gate.pass, r2.gate.pass);
    assert.equal(r1.gate.blockingCount, r2.gate.blockingCount);
  });

  test("produces same issue patterns on every call", () => {
    const r1 = generateSampleReport();
    const r2 = generateSampleReport();
    const patterns1 = r1.rawIssues.map((i) => i.pattern).sort();
    const patterns2 = r2.rawIssues.map((i) => i.pattern).sort();
    assert.deepEqual(patterns1, patterns2);
  });
});

describe("generateSampleReport adaptation", () => {
  test("passes through adaptCliReport without errors", () => {
    const report = generateSampleReport();
    assert.doesNotThrow(() => adaptCliReport(report));
  });

  test("adapted report has correct type", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.equal(adapted.type, "simplebeacon-cli-scan");
  });

  test("adapted report preserves severity counts", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.equal(adapted.severityCounts.critical, 3);
    assert.equal(adapted.severityCounts.high, 4);
    assert.equal(adapted.severityCounts.medium, 3);
    assert.equal(adapted.severityCounts.low, 2);
  });

  test("adapted report has 12 detected issues", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.equal(adapted.detectedIssues.length, 12);
  });

  test("adapted report has gate.pass = false", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.equal(adapted.gate.pass, false);
  });

  test("adapted report has rule coverage", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.ok(adapted.ruleCoverage.length > 0);
  });

  test("adapted report has scan timing", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.ok(adapted.totalScanTimeMs > 0);
    assert.ok(adapted.slowestRule);
  });

  test("adapted report is JSON-serializable", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.doesNotThrow(() => JSON.stringify(adapted));
  });
});

describe("generateSampleReport dashboard widget compatibility", () => {
  test("has all fields required by DashboardView", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    // Fields used by renderResultsState
    assert.ok(adapted.gate);
    assert.equal(typeof adapted.gate.pass, "boolean");
    assert.equal(typeof adapted.gate.blockingCount, "number");
    assert.ok(adapted.severityCounts);
    assert.equal(typeof adapted.qualityScore, "number");
    assert.equal(typeof adapted.ruleScopedFilesAnalyzed, "number");
    assert.equal(typeof adapted.repositoryFilesTotal, "number");
  });

  test("has fields required by CliMetricsWidget", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.ok(adapted.projectRoot);
    assert.ok(adapted.generatedAt);
    assert.ok(Array.isArray(adapted.scanPaths));
    assert.ok(Array.isArray(adapted.detectedIssues));
    assert.ok(adapted.ruleCoverage);
    assert.ok(adapted.gate);
    assert.ok(adapted.severityCounts);
  });

  test("has fields required by TrendChart", () => {
    const report = generateSampleReport();
    const adapted = adaptCliReport(report);
    assert.equal(typeof adapted.issueCount, "number");
    assert.equal(typeof adapted.qualityScore, "number");
    assert.ok(adapted.generatedAt);
  });

  test("sample report is detected by upload zone validation", () => {
    const report = generateSampleReport();
    // Same detection logic as CliReportUploadZone
    const isSbReport =
      report.type?.includes("simplebeacon") ||
      report.reportVersion !== undefined ||
      report.gate !== undefined ||
      report.severityCounts !== undefined ||
      report.rawIssues !== undefined ||
      report.scan_summary !== undefined;
    assert.ok(isSbReport);
  });
});
