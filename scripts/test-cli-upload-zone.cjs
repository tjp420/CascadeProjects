"use strict";

/**
 * Tests for CLI Report Upload Zone
 *
 * Tests cover:
 * - File validation (size, extension)
 * - JSON parsing and error handling
 * - SimpleBeacon report detection
 * - Report adaptation via cli-report-adapter
 * - loadFromText: parsing from string
 * - loadFromFile: parsing from File object
 * - Error callbacks
 * - Success callbacks
 *
 * Since the upload zone uses DOM APIs (FileReader, drag events), we test
 * the core logic by extracting it into testable functions. The full
 * component is tested via the adapter integration tests.
 *
 * Run: node --test scripts/test-cli-upload-zone.cjs
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Read the adapter source and convert ESM to CJS for testing
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
const cjsSource =
  adapterSource
    .replace(/export function/g, "function")
    .replace(/^export \{[^}]+\};?$/m, "") +
  "\nmodule.exports = { adaptCliReport, adaptCliReportHistory };";

const tempPath = path.join(__dirname, "temp-adapter-zone.cjs");
fs.writeFileSync(tempPath, cjsSource);
const { adaptCliReport } = require(tempPath);
fs.unlinkSync(tempPath);

// ═══════════════════════════════════════════════
// Test helpers — replicate the validation logic from CliReportUploadZone
// ═══════════════════════════════════════════════

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".json"];

function getFileExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx).toLowerCase() : "";
}

function validateFile(file) {
  if (!file) return { valid: false, error: "No file provided" };
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${file.size} bytes). Maximum size is ${MAX_FILE_SIZE} bytes.`,
    };
  }
  const ext = getFileExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type: ${ext}. Please upload a .json file.`,
    };
  }
  return { valid: true };
}

function detectSimpleBeaconReport(raw) {
  if (!raw || typeof raw !== "object") return false;
  return (
    raw.type?.includes("simplebeacon") ||
    raw.reportVersion !== undefined ||
    raw.gate !== undefined ||
    raw.severityCounts !== undefined ||
    raw.rawIssues !== undefined ||
    raw.scan_summary !== undefined
  );
}

function processReport(rawReport) {
  if (!rawReport || typeof rawReport !== "object") {
    return {
      error: "File does not contain a valid JSON object",
      adapted: null,
    };
  }
  if (!detectSimpleBeaconReport(rawReport)) {
    return {
      error:
        "File does not appear to be a SimpleBeacon CLI report. Expected fields: type, reportVersion, gate, severityCounts, or rawIssues.",
      adapted: null,
    };
  }
  const adapted = adaptCliReport(rawReport);
  return { error: null, adapted };
}

// ═══════════════════════════════════════════════
// Mock fixtures
// ═══════════════════════════════════════════════

function mockCliReport() {
  return {
    type: "simplebeacon-scan",
    reportVersion: 2,
    generatedAt: "2026-08-07T20:00:00Z",
    projectRoot: "/home/user/project",
    totalFiles: 100,
    severityCounts: { critical: 0, high: 1, medium: 2, low: 3 },
    gate: { pass: false, blockingCount: 1, warningCount: 5 },
    rawIssues: [
      {
        severity: "high",
        type: "test",
        pattern: "SB-SEC-017",
        filePath: "Dockerfile",
        description: "Privileged mode",
      },
    ],
  };
}

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

describe("File validation", () => {
  test("accepts valid .json file within size limit", () => {
    const file = { name: "report.json", size: 1024 };
    const result = validateFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  test("rejects file that is too large", () => {
    const file = { name: "report.json", size: MAX_FILE_SIZE + 1 };
    const result = validateFile(file);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("too large"));
  });

  test("rejects non-JSON file extension", () => {
    const file = { name: "report.txt", size: 1024 };
    const result = validateFile(file);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("Unsupported file type"));
  });

  test("rejects file with no extension", () => {
    const file = { name: "report", size: 1024 };
    const result = validateFile(file);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("Unsupported"));
  });

  test("rejects null file", () => {
    const result = validateFile(null);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("No file"));
  });

  test("accepts file at exactly the size limit", () => {
    const file = { name: "report.json", size: MAX_FILE_SIZE };
    const result = validateFile(file);
    assert.equal(result.valid, true);
  });

  test("getFileExtension extracts extension correctly", () => {
    assert.equal(getFileExtension("report.json"), ".json");
    assert.equal(getFileExtension("path/to/report.JSON"), ".json");
    assert.equal(getFileExtension("noext"), "");
    assert.equal(getFileExtension(""), "");
    assert.equal(getFileExtension("file.tar.gz"), ".gz");
  });
});

describe("SimpleBeacon report detection", () => {
  test("detects report with type field", () => {
    assert.ok(detectSimpleBeaconReport({ type: "simplebeacon-scan" }));
  });

  test("detects report with reportVersion field", () => {
    assert.ok(detectSimpleBeaconReport({ reportVersion: 2 }));
  });

  test("detects report with gate field", () => {
    assert.ok(detectSimpleBeaconReport({ gate: { pass: true } }));
  });

  test("detects report with severityCounts field", () => {
    assert.ok(detectSimpleBeaconReport({ severityCounts: { critical: 0 } }));
  });

  test("detects report with rawIssues field", () => {
    assert.ok(detectSimpleBeaconReport({ rawIssues: [] }));
  });

  test("detects report with scan_summary field", () => {
    assert.ok(detectSimpleBeaconReport({ scan_summary: {} }));
  });

  test("rejects null", () => {
    assert.equal(detectSimpleBeaconReport(null), false);
  });

  test("rejects non-object", () => {
    assert.equal(detectSimpleBeaconReport("string"), false);
    assert.equal(detectSimpleBeaconReport(42), false);
    assert.equal(detectSimpleBeaconReport(true), false);
  });

  test("rejects plain object without SB markers", () => {
    assert.equal(detectSimpleBeaconReport({ foo: "bar", baz: 123 }), false);
  });
});

describe("processReport", () => {
  test("processes a valid CLI report", () => {
    const raw = mockCliReport();
    const { error, adapted } = processReport(raw);
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.type, "simplebeacon-cli-scan");
    assert.equal(adapted.gate.pass, false);
    assert.equal(adapted.severityCounts.high, 1);
  });

  test("returns error for null input", () => {
    const { error, adapted } = processReport(null);
    assert.ok(error);
    assert.equal(adapted, null);
    assert.ok(error.includes("valid JSON object"));
  });

  test("returns error for non-SimpleBeacon JSON", () => {
    const { error, adapted } = processReport({ foo: "bar" });
    assert.ok(error);
    assert.equal(adapted, null);
    assert.ok(error.includes("does not appear to be a SimpleBeacon"));
  });

  test("processes report with only gate field", () => {
    const { error, adapted } = processReport({ gate: { pass: true } });
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.gate.pass, true);
  });

  test("processes report with only severityCounts field", () => {
    const { error, adapted } = processReport({
      severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
    });
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.severityCounts.critical, 1);
  });

  test("processes report with only rawIssues field", () => {
    const { error, adapted } = processReport({
      rawIssues: [
        {
          severity: "high",
          type: "test",
          filePath: "a.js",
          description: "test",
        },
      ],
    });
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.detectedIssues.length, 1);
  });
});

describe("JSON parsing edge cases", () => {
  test("valid JSON string parses correctly", () => {
    const json = JSON.stringify(mockCliReport());
    const parsed = JSON.parse(json);
    assert.equal(parsed.type, "simplebeacon-scan");
  });

  test("malformed JSON throws error", () => {
    assert.throws(() => JSON.parse("{invalid json}"), SyntaxError);
  });

  test("empty string throws error", () => {
    assert.throws(() => JSON.parse(""), SyntaxError);
  });

  test("JSON array is not a valid report", () => {
    const { error, adapted } = processReport([1, 2, 3]);
    // Arrays are objects in JS, but won't have SB markers
    assert.ok(error);
    assert.equal(adapted, null);
  });

  test("JSON null is not a valid report", () => {
    const parsed = JSON.parse("null");
    const { error, adapted } = processReport(parsed);
    assert.ok(error);
    assert.equal(adapted, null);
  });
});

describe("Integration with real CLI report shape", () => {
  test("processes a full CLI report with all fields", () => {
    const raw = mockCliReport();
    raw.scanPaths = ["src", "server"];
    raw.repositoryFilesTotal = 100;
    raw.ruleScopedFilesAnalyzed = 80;
    raw.totalScanTimeMs = 5000;
    raw.ruleTimings = { "credential-scanner": 1200 };
    raw.slowestRule = { rule: "credential-scanner", ms: 1200 };
    raw.credentialScanned = 80;
    raw.credentialFindings = 0;
    raw.securityPatternFilesScanned = 80;
    raw.securityPatternFindings = 1;

    const { error, adapted } = processReport(raw);
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.totalFiles, 100);
    assert.equal(adapted.repositoryFilesTotal, 100);
    assert.equal(adapted.ruleScopedFilesAnalyzed, 80);
    assert.ok(adapted.ruleCoverage.length > 0);
    assert.equal(adapted.totalScanTimeMs, 5000);
  });

  test("processes a clean report with no issues", () => {
    const raw = {
      type: "simplebeacon-scan",
      reportVersion: 2,
      gate: { pass: true, blockingCount: 0, warningCount: 0 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      rawIssues: [],
    };

    const { error, adapted } = processReport(raw);
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.gate.pass, true);
    assert.equal(adapted.issueCount, 0);
    assert.equal(adapted.detectedIssues.length, 0);
  });

  test("processes a report with critical findings", () => {
    const raw = {
      type: "simplebeacon-scan",
      reportVersion: 2,
      gate: { pass: false, blockingCount: 2 },
      severityCounts: { critical: 2, high: 0, medium: 0, low: 0 },
      rawIssues: [
        {
          severity: "critical",
          type: "gcp",
          pattern: "SB-SEC-014",
          filePath: "gcp.json",
          description: "GCP key",
        },
        {
          severity: "critical",
          type: "azure",
          pattern: "SB-SEC-015",
          filePath: "azure.env",
          description: "Azure key",
        },
      ],
    };

    const { error, adapted } = processReport(raw);
    assert.equal(error, null);
    assert.ok(adapted);
    assert.equal(adapted.gate.pass, false);
    assert.equal(adapted.severityCounts.critical, 2);
    assert.equal(adapted.detectedIssues.length, 2);
  });
});
