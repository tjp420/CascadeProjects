// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateMarkdownReport,
  generateHeader,
  generateSeverityBreakdown,
  generateRuleHitSummary,
  generateFictionRuleBreakdown,
  generateTopFindings,
  generateBuildReadiness,
  generateRemediationPhases,
  generateEuAiActSection,
  generateQualityScorecard,
  generateFileInventory,
  generateScanStats,
} = require("../src/reporters/scan-markdown-report");

const SAMPLE_REPORT = {
  projectRoot: "/projects/demo-app",
  generatedAt: "2026-08-07T12:00:00.000Z",
  tier: "developer",
  summary: {
    gatePass: true,
    qualityScore: 95,
    totalFiles: 1200,
    totalLines: 45000,
  },
  gate: {
    pass: true,
    blockingCount: 0,
    warningCount: 3,
    blockingIssues: [],
    warningIssues: [
      {
        severity: "medium",
        type: "LLM Slop",
        filePath: "src/placeholder.js",
        count: 2,
        fix: "Replace placeholder",
      },
      {
        severity: "low",
        type: "Empty File",
        filePath: "src/empty.js",
        count: 1,
        fix: "Remove or populate",
      },
    ],
  },
  stats: {
    filesAnalyzed: 1200,
    filesContentScanned: 1100,
    filesBinaryHashed: 50,
    emptyFiles: 5,
    unreadableFiles: 0,
    jsonValid: 200,
    jsonInvalid: 0,
    parallelTextRuleWorkers: 4,
    ruleHitTotals: {
      credentials: 0,
      productionLeak: 0,
      llmSlop: 2,
      agencyHandoff: 0,
      fictionKpi: 0,
      euAiAct: 0,
      tokenBleed: 0,
      architectureDrift: 1,
      fileNaming: 0,
      security: 0,
    },
  },
  rawIssues: [
    {
      pattern: "SB-FICTION-001",
      count: 1,
      severity: "high",
      type: "llm-placeholder",
      filePath: "src/config.js",
    },
    {
      pattern: "SB-FICTION-007",
      count: 1,
      severity: "high",
      type: "mock-return-value",
      filePath: "src/auth.js",
    },
  ],
  qualityScorecard: {
    accuracy: 100,
    completeness: 100,
    consistency: 90,
    timeliness: 100,
    validity: 95,
    integrity: 100,
  },
  buildReadiness: {
    readinessScore: 83,
    readinessStatus: "READY",
    checklist: [
      { name: "package.json", found: true, critical: true },
      { name: "README", found: true, critical: true },
      { name: "Tests", found: true, critical: true },
      { name: ".gitignore", found: true, critical: true },
      { name: ".env.example", found: false, critical: true },
      { name: "Docker", found: false, critical: false },
    ],
    missingCritical: [".env.example"],
    missingRecommended: ["Docker"],
  },
  remediationPhases: [
    {
      id: "integrity",
      title: "Phase 1: Data Integrity",
      severity: "medium",
      progress: 100,
      effort: "2-4 days",
      status: "completed",
    },
    {
      id: "consistency",
      title: "Phase 2: Consistency",
      severity: "low",
      progress: 75,
      effort: "3-5 days",
      status: "in-progress",
    },
    {
      id: "compliance",
      title: "Phase 3: Governance",
      severity: "medium",
      progress: 50,
      effort: "2-3 days",
      status: "in-progress",
    },
  ],
  euAiAct: {
    aiSystemIndicators: 0,
    highRiskIndicators: 0,
    transparencyGaps: 0,
    documentationArtifacts: 0,
  },
  fileInventory: {
    sourceCode: 800,
    markup: 50,
    config: 100,
    docs: 80,
    buildArtifacts: 20,
    testFixtures: 100,
    other: 50,
  },
};

test("generateMarkdownReport produces a complete markdown document", () => {
  const md = generateMarkdownReport(SAMPLE_REPORT);
  assert.ok(md.includes("# Code Quality & Security Scan Report"));
  assert.ok(md.includes("## Issues Found"));
  assert.ok(md.includes("## What Was Checked"));
  assert.ok(md.includes("## AI-Generated Code Issues"));
  assert.ok(md.includes("## Top Issues to Fix"));
  assert.ok(md.includes("## Quality Scorecard"));
  assert.ok(md.includes("## Build Readiness Checklist"));
  assert.ok(md.includes("## Fix Roadmap"));
  assert.ok(md.includes("## EU AI Act Compliance"));
  assert.ok(md.includes("## File Breakdown"));
  assert.ok(md.includes("## Scan Details"));
  assert.ok(md.includes("SimpleBeacon"));
});

test("generateHeader includes project root, gate status, and quality score", () => {
  const header = generateHeader(SAMPLE_REPORT);
  assert.ok(header.includes("/projects/demo-app"));
  assert.ok(header.includes("PASS"));
  assert.ok(header.includes("95"));
  assert.ok(header.includes("1,200"));
  assert.ok(header.includes("developer"));
});

test("generateHeader shows BLOCKED when gate fails", () => {
  const report = {
    ...SAMPLE_REPORT,
    gate: {
      pass: false,
      blockingCount: 2,
      blockingIssues: [],
      warningIssues: [],
    },
  };
  const header = generateHeader(report);
  assert.ok(header.includes("BLOCKED"));
});

test("generateSeverityBreakdown counts issues by severity", () => {
  const breakdown = generateSeverityBreakdown(SAMPLE_REPORT);
  assert.ok(breakdown.includes("Medium"));
  assert.ok(breakdown.includes("2"));
  assert.ok(breakdown.includes("Warning issues (should review):** 3"));
});

test("generateRuleHitSummary lists all rule categories with hit counts", () => {
  const summary = generateRuleHitSummary(SAMPLE_REPORT);
  assert.ok(summary.includes("Hardcoded Credentials"));
  assert.ok(summary.includes("LLM Slop"));
  assert.ok(summary.includes("Architecture Drift"));
  assert.ok(summary.includes("| 2 |")); // llmSlop hits
});

test("generateFictionRuleBreakdown shows all 8 SB-FICTION rules", () => {
  const breakdown = generateFictionRuleBreakdown(SAMPLE_REPORT);
  assert.ok(breakdown.includes("SB-FICTION-001"));
  assert.ok(breakdown.includes("SB-FICTION-002"));
  assert.ok(breakdown.includes("SB-FICTION-003"));
  assert.ok(breakdown.includes("SB-FICTION-004"));
  assert.ok(breakdown.includes("SB-FICTION-005"));
  assert.ok(breakdown.includes("SB-FICTION-006"));
  assert.ok(breakdown.includes("SB-FICTION-007"));
  assert.ok(breakdown.includes("SB-FICTION-008"));
  assert.ok(breakdown.includes("Hallucinated API Method Calls"));
  assert.ok(breakdown.includes("Boilerplate Restatement Comments"));
});

test("generateFictionRuleBreakdown shows hit counts for flagged rules", () => {
  const breakdown = generateFictionRuleBreakdown(SAMPLE_REPORT);
  assert.ok(
    breakdown.includes("| 1 |"),
    "Should show count 1 for SB-FICTION-001",
  );
  // SB-FICTION-001 and 007 have hits
  assert.ok(breakdown.match(/SB-FICTION-001.*\| 1 \|/));
  assert.ok(breakdown.match(/SB-FICTION-007.*\| 1 \|/));
});

test("generateFictionRuleBreakdown shows clean message when no hits", () => {
  const cleanReport = { ...SAMPLE_REPORT, rawIssues: [] };
  const breakdown = generateFictionRuleBreakdown(cleanReport);
  assert.ok(breakdown.includes("No AI-generated code issues found"));
});

test("generateTopFindings shows warning issues sorted by severity", () => {
  const findings = generateTopFindings(SAMPLE_REPORT);
  assert.ok(findings.includes("LLM Slop"));
  assert.ok(findings.includes("src/placeholder.js"));
  assert.ok(findings.includes("Replace placeholder"));
});

test("generateTopFindings shows clean message when no issues", () => {
  const cleanReport = {
    ...SAMPLE_REPORT,
    gate: { pass: true, blockingIssues: [], warningIssues: [] },
  };
  const findings = generateTopFindings(cleanReport);
  assert.ok(findings.includes("No issues found — your code looks clean!"));
});

test("generateBuildReadiness shows checklist with missing items", () => {
  const readiness = generateBuildReadiness(SAMPLE_REPORT);
  assert.ok(readiness.includes("83/100"));
  assert.ok(readiness.includes("READY"));
  assert.ok(readiness.includes("package.json"));
  assert.ok(readiness.includes(".env.example"));
  assert.ok(readiness.includes("Missing critical"));
});

test("generateRemediationPhases shows phase progress", () => {
  const phases = generateRemediationPhases(SAMPLE_REPORT);
  assert.ok(phases.includes("Phase 1: Data Integrity"));
  assert.ok(phases.includes("100%"));
  assert.ok(phases.includes("Phase 2: Consistency"));
  assert.ok(phases.includes("75%"));
  assert.ok(phases.includes("2-4 days"));
});

test("generateEuAiActSection shows clean status when no indicators", () => {
  const eu = generateEuAiActSection(SAMPLE_REPORT);
  assert.ok(eu.includes("No EU AI Act compliance issues detected"));
});

test("generateEuAiActSection shows indicators when present", () => {
  const report = {
    ...SAMPLE_REPORT,
    euAiAct: {
      aiSystemIndicators: 3,
      highRiskIndicators: 1,
      transparencyGaps: 2,
      documentationArtifacts: 1,
    },
  };
  const eu = generateEuAiActSection(report);
  assert.ok(eu.includes("3"));
  assert.ok(eu.includes("1"));
  assert.ok(eu.includes("2"));
});

test("generateQualityScorecard renders all 6 dimensions", () => {
  const scorecard = generateQualityScorecard(SAMPLE_REPORT);
  assert.ok(scorecard.includes("Accuracy"));
  assert.ok(scorecard.includes("Completeness"));
  assert.ok(scorecard.includes("Consistency"));
  assert.ok(scorecard.includes("Timeliness"));
  assert.ok(scorecard.includes("Validity"));
  assert.ok(scorecard.includes("Integrity"));
  assert.ok(scorecard.includes("100/100"));
  assert.ok(scorecard.includes("95/100"));
});

test("generateFileInventory shows category counts", () => {
  const inv = generateFileInventory(SAMPLE_REPORT);
  assert.ok(inv.includes("Source Code"));
  assert.ok(inv.includes("800"));
  assert.ok(inv.includes("Test Fixtures"));
  assert.ok(inv.includes("100"));
});

test("generateScanStats shows file analysis metrics", () => {
  const stats = generateScanStats(SAMPLE_REPORT);
  assert.ok(stats.includes("1,200"));
  assert.ok(stats.includes("1,100"));
  assert.ok(stats.includes("4"));
  assert.ok(stats.includes("200 / 0"));
});

test("generateMarkdownReport handles minimal report without crashing", () => {
  const minimal = {
    summary: { qualityScore: 50, totalFiles: 10, totalLines: 100 },
    gate: {
      pass: false,
      blockingCount: 1,
      blockingIssues: [
        {
          severity: "high",
          type: "Secret",
          filePath: "src/secret.js",
          count: 1,
          fix: "Rotate key",
        },
      ],
      warningIssues: [],
    },
  };
  const md = generateMarkdownReport(minimal);
  assert.ok(md.includes("# Code Quality & Security Scan Report"));
  assert.ok(md.includes("BLOCKED"));
  assert.ok(md.includes("Secret"));
  assert.ok(md.includes("Rotate key"));
});

test("generateMarkdownReport throws on null input", () => {
  assert.throws(
    () => generateMarkdownReport(null),
    /Report object is required/,
  );
});

test("validateFormat accepts markdown", () => {
  const { validateFormat } = require("../src/lib/format-utils");
  assert.doesNotThrow(() => validateFormat("markdown"));
  assert.doesNotThrow(() => validateFormat("text"));
  assert.doesNotThrow(() => validateFormat("json"));
  assert.throws(() => validateFormat("xml"));
});

test("selectPayload returns markdown for markdown format", () => {
  const { selectPayload } = require("../src/lib/format-utils");
  const fakeReport = {
    summary: { qualityScore: 90, totalFiles: 5, totalLines: 50 },
    gate: { pass: true, blockingIssues: [], warningIssues: [] },
  };
  const fakeGateResult = { pass: true, blockingIssues: [], warningIssues: [] };
  const fakeJsonReport = {
    ...fakeReport,
    gate: {
      pass: true,
      blockingCount: 0,
      warningCount: 0,
      blockingIssues: [],
      warningIssues: [],
    },
    summary: { qualityScore: 90, totalFiles: 5, totalLines: 50 },
  };
  const payload = selectPayload(
    fakeReport,
    fakeGateResult,
    fakeJsonReport,
    "markdown",
  );
  assert.ok(payload.includes("# Code Quality & Security Scan Report"));
  assert.ok(payload.includes("PASS"));
});
