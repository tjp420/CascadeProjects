// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");

function requireLib(name) {
  return require(path.join(__dirname, "..", "src", "lib", name));
}

// Smoke tests for simplebeacon CLI package

describe("Package structure", () => {
  it("has required entry points", () => {
    const indexPath = path.join(__dirname, "..", "src", "index.js");
    assert.ok(fs.existsSync(indexPath), "src/index.js must exist");

    const binPath = path.join(__dirname, "..", "bin", "simplebeacon.js");
    assert.ok(fs.existsSync(binPath), "bin/simplebeacon.js must exist");
  });

  it("package.json has valid version", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
    );
    assert.ok(pkg.version, "version must be defined");
    assert.match(pkg.version, /^\d+\.\d+\.\d+/, "version must be semver");
    assert.ok(pkg.main, "main entry must be defined");
    assert.ok(
      pkg.bin && pkg.bin.simplebeacon,
      "simplebeacon bin must be defined",
    );
  });
});

describe("Core modules load without errors", () => {
  it("src/index.js exports key functions", () => {
    const index = require(path.join(__dirname, "..", "src", "index.js"));
    assert.ok(typeof index.runScan === "function", "runScan must be exported");
    assert.ok(
      typeof index.evaluateGate === "function",
      "evaluateGate must be exported",
    );
    assert.ok(
      typeof index.formatJsonReport === "function",
      "formatJsonReport must be exported",
    );
  });

  it("reporters/json.js exports formatJsonReport", () => {
    const jsonReporter = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );
    assert.ok(
      typeof jsonReporter.formatJsonReport === "function",
      "formatJsonReport must be exported",
    );
  });

  it("lib/normalize-scan-report.js exports normalizePlatformScanReport", () => {
    const normalizer = require(
      path.join(__dirname, "..", "src", "lib", "normalize-scan-report.js"),
    );
    assert.ok(
      typeof normalizer.normalizePlatformScanReport === "function",
      "normalizePlatformScanReport must be exported",
    );
  });
});

describe("JSON report enrichment", () => {
  it("formatJsonReport includes gate blockingIssues and warningIssues", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [],
      issues: [],
      summary: { totalFindings: 0 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    const mockGate = {
      pass: true,
      failOn: ["high", "critical"],
      warnOn: ["medium"],
      blockingIssues: [],
      warningIssues: [],
    };

    const result = formatJsonReport(mockReport, mockGate);
    assert.ok(result.gate, "report must have gate object");
    assert.ok(
      Array.isArray(result.gate.blockingIssues),
      "gate.blockingIssues must be an array",
    );
    assert.ok(
      Array.isArray(result.gate.warningIssues),
      "gate.warningIssues must be an array",
    );
  });

  it("formatJsonReport includes all certificate-compatible modules", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [],
      issues: [],
      summary: { totalFindings: 0 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    const result = formatJsonReport(mockReport, {
      pass: true,
      blockingIssues: [],
      warningIssues: [],
    });
    assert.ok(result.consolidation, "report must have consolidation module");
    assert.ok(result.codebase, "report must have codebase module");
    assert.ok(result.dataQuality, "report must have dataQuality module");
    assert.ok(result.cleanup, "report must have cleanup module");
    assert.ok(result.compliance, "report must have compliance module");
    assert.ok(result.fileReduction, "report must have fileReduction module");
    assert.ok(result.npmAudit, "report must have npmAudit module");
    assert.ok(result.roadmap, "report must have roadmap module");
    assert.ok(result.mockData, "report must have mockData module");
    assert.ok(result.euAiAct, "report must have euAiAct module");
  });

  it("formatJsonReport derives gate BLOCKED when blockingIssues exist even if pass=true", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [
        {
          severity: "medium",
          type: "Credential Pattern",
          count: 1,
          filePath: "config.js",
          impact: "Exposed key",
          fix: "Move to env vars",
        },
      ],
      issues: [],
      summary: { totalFindings: 1 },
      severityCounts: { critical: 0, high: 0, medium: 1, low: 0 },
    };

    const mockGate = {
      pass: true, // inconsistent upstream data
      failOn: ["high", "critical"],
      warnOn: ["medium"],
      blockingIssues: [
        {
          severity: "medium",
          type: "Credential Pattern",
          count: 1,
          filePath: "config.js",
          impact: "Exposed key",
          fix: "Move to env vars",
        },
      ],
      warningIssues: [],
    };

    const result = formatJsonReport(mockReport, mockGate);
    assert.strictEqual(
      result.gate.pass,
      false,
      "gate.pass must be derived false when blockingIssues exist",
    );
    assert.strictEqual(
      result.gate.status,
      "BLOCKED",
      "gate.status must be BLOCKED",
    );
    assert.ok(
      result.gate.summary.includes("blocked"),
      "gate.summary must reflect blocked state",
    );
  });

  it("formatJsonReport detects debug artifacts from detectedIssues", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [
        {
          severity: "low",
          type: "Debug Artifact",
          count: 7,
          filePath: ["app.js", "server.js"],
        },
      ],
      issues: [],
      summary: { totalFindings: 1 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 1 },
    };

    const result = formatJsonReport(mockReport, {
      pass: true,
      blockingIssues: [],
      warningIssues: [],
    });
    assert.strictEqual(
      result.cleanup.debugArtifactCount,
      7,
      "cleanup.debugArtifactCount must come from detectedIssues",
    );
    assert.ok(
      result.cleanup.summary.includes("7"),
      "cleanup summary must mention the count",
    );
  });

  it("formatJsonReport detects governance markers from detectedIssues", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [
        {
          severity: "low",
          type: "License/Governance Marker",
          count: 7,
          filePath: ["index.html", "LICENSE"],
        },
      ],
      issues: [],
      summary: { totalFindings: 1 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 1 },
      compliance: { licenseCount: 0, securityCount: 0 }, // stale zero counts
    };

    const result = formatJsonReport(mockReport, {
      pass: true,
      blockingIssues: [],
      warningIssues: [],
    });
    assert.strictEqual(
      result.compliance.licenseCount,
      7,
      "compliance.licenseCount must fallback to detectedIssues",
    );
    assert.ok(
      result.compliance.summary.includes("7"),
      "compliance summary must mention the count",
    );
  });

  it("formatJsonReport rejects stale upstream summary that claims PASS while blocked", () => {
    const { formatJsonReport } = require(
      path.join(__dirname, "..", "src", "reporters", "json.js"),
    );

    const mockReport = {
      projectRoot: "/test",
      totalFiles: 10,
      filesAnalyzed: 10,
      generatedAt: new Date().toISOString(),
      detectedIssues: [],
      issues: [],
      summary: { totalFindings: 0 },
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    const mockGate = {
      pass: false,
      summary: "Gate passed with 1 low-severity pattern. Monitor in CI.", // stale/inconsistent
      failOn: ["high", "critical"],
      warnOn: ["medium"],
      blockingIssues: [
        {
          severity: "medium",
          type: "Credential Pattern",
          count: 1,
          filePath: "config.js",
        },
      ],
      warningIssues: [],
    };

    const result = formatJsonReport(mockReport, mockGate);
    assert.ok(
      !result.gate.summary.includes("passed"),
      "stale PASS summary must be replaced",
    );
    assert.ok(
      result.gate.summary.includes("blocked"),
      "correct BLOCKED summary must be present",
    );
  });
});

describe("Report sanitizer", () => {
  it("preserves gate blockingIssues and warningIssues arrays", () => {
    const { sanitizeScanReport } = requireLib("report-sanitizer.js");

    const report = {
      gate: {
        pass: false,
        blockingCount: 2,
        blockingIssues: [
          {
            severity: "high",
            type: "Credential",
            count: 1,
            filePath: "config.js",
            impact: "Exposed API key",
          },
        ],
        warningIssues: [
          { severity: "medium", type: "Debug", count: 3, filePath: "app.js" },
        ],
      },
    };

    const result = sanitizeScanReport(report);
    assert.ok(
      Array.isArray(result.gate.blockingIssues),
      "blockingIssues must survive sanitization",
    );
    assert.strictEqual(
      result.gate.blockingIssues.length,
      1,
      "blockingIssues length must be preserved",
    );
    assert.ok(
      Array.isArray(result.gate.warningIssues),
      "warningIssues must survive sanitization",
    );
    assert.strictEqual(
      result.gate.warningIssues.length,
      1,
      "warningIssues length must be preserved",
    );
    assert.strictEqual(
      result.gate.blockingIssues[0].type,
      "Credential",
      "issue type must be preserved",
    );
  });

  it("redacts secrets in strings but preserves structure", () => {
    const { sanitizeScanReport } = requireLib("report-sanitizer.js");

    const report = {
      gate: {
        blockingIssues: [
          { filePath: "env.js", snippet: 'API_KEY = "YOUR_API_KEY_HERE"' },
        ],
      },
    };

    const result = sanitizeScanReport(report);
    const snippet = result.gate.blockingIssues[0].snippet;
    assert.ok(
      !snippet.includes("sk-1234567890abcdef"),
      "secret must be redacted",
    );
    assert.ok(
      snippet.includes("REDACTED") || snippet.includes("████████████████"),
      "redaction marker must be present",
    );
  });
});
