// simplebeacon-ignore: Scanner pattern definitions, and dashboard code, security — all findings are false positives, debugArtifacts, test fixtures
/**
 * Unit tests for audit-report sub-modules.
 * Run with: node --test __tests__.cjs
 */

const assert = require("assert");
const { describe, it } = require("node:test");

// ── Finding Utils ─────────────────────────────────────────────────
const {
  normalizeFindingPath,
  isDocumentationPath,
  isProductionCodePath,
  isAuditProductionRuntimePath,
  dedupeFindings,
  sortBySeverity,
  scoreFinding,
  enrichFindings,
  countByTier,
  countBySeverity,
  countProductionSeverity,
  buildCategoryRollup,
  normalizeSimplebeaconForCompliance,
  isPlaceholderExecutiveText,
  resolveTierCounts,
  redactPathForDisplay,
  formatCodebaseRule,
  classifyGateIssueBusinessTier,
  classifyCodebaseBusinessTier,
} = require("./finding-utils.cjs");

describe("finding-utils.cjs", () => {
  it("normalizeFindingPath strips ai-platform prefix", () => {
    assert.strictEqual(
      normalizeFindingPath("c:/Users/foo/ai-platform/server/lib/db.cjs"),
      "server/lib/db.cjs",
    );
    assert.strictEqual(
      normalizeFindingPath("server/lib/db.cjs"),
      "server/lib/db.cjs",
    );
  });

  it("isDocumentationPath detects docs and markdown", () => {
    assert.strictEqual(isDocumentationPath("docs/readme.md"), true);
    assert.strictEqual(isDocumentationPath("server/lib/db.cjs"), false);
    assert.strictEqual(isDocumentationPath("tests/unit.test.js"), true);
  });

  it("isProductionCodePath recognizes server/src paths", () => {
    assert.strictEqual(isProductionCodePath("server/lib/db.cjs"), true);
    assert.strictEqual(isProductionCodePath("tests/unit.test.js"), false);
    assert.strictEqual(isDocumentationPath("docs/readme.md"), true);
  });

  it("isAuditProductionRuntimePath excludes scripts and reporters", () => {
    assert.strictEqual(isAuditProductionRuntimePath("server/lib/db.cjs"), true);
    assert.strictEqual(
      isAuditProductionRuntimePath("server/scripts/deploy.sh"),
      false,
    );
    assert.strictEqual(
      isAuditProductionRuntimePath("packages/simplebeacon-cli/src/scan.js"),
      true,
    );
    assert.strictEqual(
      isAuditProductionRuntimePath("packages/simplebeacon-cli/bin/cli.js"),
      false,
    );
  });

  it("dedupeFindings removes duplicates by key", () => {
    const findings = [
      { filePath: "a.js", line: 1, category: "debug", description: "x" },
      { filePath: "a.js", line: 1, category: "debug", description: "x" },
      { filePath: "b.js", line: 2, category: "debug", description: "y" },
    ];
    const result = dedupeFindings(findings);
    assert.strictEqual(result.length, 2);
  });

  it("sortBySeverity orders critical > high > medium > low", () => {
    const findings = [
      { severity: "low" },
      { severity: "critical" },
      { severity: "high" },
    ];
    const sorted = sortBySeverity(findings);
    assert.deepStrictEqual(
      sorted.map((f) => f.severity),
      ["critical", "high", "low"],
    );
  });

  it("scoreFinding boosts production and high severity", () => {
    const highProd = {
      severity: "high",
      filePath: "server/lib/db.cjs",
      category: "broken",
    };
    assert.ok(
      scoreFinding(highProd) >
        scoreFinding({ severity: "low", filePath: "docs/readme.md" }),
    );
  });

  it("enrichFindings adds tier and priority", () => {
    const findings = [
      { severity: "high", filePath: "server/lib/db.cjs", category: "broken" },
    ];
    const enriched = enrichFindings(findings);
    assert.strictEqual(enriched[0].tier, "production");
    assert.ok(enriched[0].productionPriority > 0);
  });

  it("countByTier aggregates correctly", () => {
    const findings = [
      { tier: "production" },
      { tier: "production" },
      { tier: "documentation" },
    ];
    const counts = countByTier(findings);
    assert.strictEqual(counts.production, 2);
    assert.strictEqual(counts.documentation, 1);
  });

  it("countBySeverity aggregates correctly", () => {
    const findings = [
      { severity: "high" },
      { severity: "high" },
      { severity: "low" },
    ];
    const counts = countBySeverity(findings);
    assert.strictEqual(counts.high, 2);
    assert.strictEqual(counts.low, 1);
  });

  it("countProductionSeverity filters production only", () => {
    const findings = [
      { tier: "production", severity: "high" },
      { tier: "general", severity: "high" },
    ];
    const counts = countProductionSeverity(findings);
    assert.strictEqual(counts.high, 1);
  });

  it("buildCategoryRollup groups by category", () => {
    const findings = [
      { category: "debug", tier: "production", severity: "high" },
      { category: "debug", tier: "production", severity: "medium" },
      { category: "tech-debt", tier: "general", severity: "low" },
    ];
    const rollup = buildCategoryRollup(findings);
    assert.strictEqual(rollup.length, 2);
    const debugBucket = rollup.find((r) => r.category === "debug");
    assert.strictEqual(debugBucket.count, 2);
    assert.strictEqual(debugBucket.production, 2);
    assert.strictEqual(debugBucket.high, 1);
  });

  it("normalizeSimplebeaconForCompliance fills defaults", () => {
    const input = { schemaChecked: 5, schemaPassed: 3 };
    const result = normalizeSimplebeaconForCompliance(input);
    assert.strictEqual(result.credentialScanned, 0);
    assert.strictEqual(result.schemaChecked, 5);
    assert.strictEqual(result.schemaPassed, 3);
  });

  it("isPlaceholderExecutiveText detects placeholders", () => {
    assert.strictEqual(isPlaceholderExecutiveText("Priority 1"), true);
    assert.strictEqual(isPlaceholderExecutiveText("Item 42"), true);
    assert.strictEqual(
      isPlaceholderExecutiveText("Real executive summary here"),
      false,
    );
  });

  it("resolveTierCounts prefers enriched findings", () => {
    const findings = [{ tier: "production" }, { tier: "documentation" }];
    const counts = resolveTierCounts(null, findings);
    assert.strictEqual(counts.production, 1);
    assert.strictEqual(counts.documentation, 1);
  });

  it("redactPathForDisplay shortens long paths", () => {
    assert.strictEqual(
      redactPathForDisplay("C:/Users/Trevor/Projects/myapp/src/index.js"),
      "src/index.js",
    );
    assert.strictEqual(
      redactPathForDisplay("myapp/src/index.js"),
      "src/index.js",
    );
    assert.strictEqual(redactPathForDisplay(""), "Project");
  });

  it("formatCodebaseRule maps categories", () => {
    assert.strictEqual(
      formatCodebaseRule({ category: "debug-artifact" }),
      "DEBUG_ARTIFACT / CONSOLE_OR_DEBUGGER",
    );
    assert.strictEqual(formatCodebaseRule({ category: "unknown" }), "UNKNOWN");
  });

  it("classifyGateIssueBusinessTier recognizes credentials as critical", () => {
    assert.strictEqual(
      classifyGateIssueBusinessTier({
        type: "AWS credential leak",
        severity: "high",
      }),
      "critical",
    );
    assert.strictEqual(
      classifyGateIssueBusinessTier({
        type: "fiction KPI",
        severity: "medium",
      }),
      "medium",
    );
  });

  it("classifyCodebaseBusinessTier maps categories", () => {
    assert.strictEqual(
      classifyCodebaseBusinessTier({ category: "broken", severity: "high" }),
      "high",
    );
    assert.strictEqual(
      classifyCodebaseBusinessTier({ category: "meaningless-data" }),
      "medium",
    );
  });
});

// ── Executive ─────────────────────────────────────────────────────
const {
  calculateAuditConfidence,
  buildLaunchReadiness,
  mergeExecutiveSummary,
  buildCompleteAuditPrompt,
  parseAiExecutive,
} = require("./executive.cjs");

describe("executive.cjs", () => {
  it("calculateAuditConfidence penalizes missing gate scan", () => {
    const score = calculateAuditConfidence(
      { ruleScopedFiles: 0, gatePass: null },
      {},
    );
    assert.ok(score < 100);
  });

  it("calculateAuditConfidence rewards high file counts", () => {
    const score = calculateAuditConfidence(
      { codeFilesAnalyzed: 9999, gatePass: true },
      {},
    );
    assert.ok(score > 80);
  });

  it("buildLaunchReadiness labels blocked when gate fails", () => {
    const readiness = buildLaunchReadiness({
      summary: {
        gatePass: false,
        severityCounts: { high: 2, medium: 0, low: 0 },
        productionSeverity: {},
      },
    });
    assert.strictEqual(readiness.tone, "blocked");
  });

  it("buildLaunchReadiness labels ready when gate passes", () => {
    const readiness = buildLaunchReadiness({
      summary: {
        gatePass: true,
        severityCounts: { high: 0, medium: 0, low: 0 },
        productionSeverity: {},
        productionFindings: 0,
        documentationFindings: 0,
      },
    });
    assert.strictEqual(readiness.tone, "ready");
  });

  it("mergeExecutiveSummary prefers non-placeholder AI text", () => {
    const deterministic = {
      intro: "detailed intro",
      businessImpact: "impact",
      headline: "headline",
    };
    const ai = {
      intro: "This is a very long and meaningful executive summary paragraph.",
      businessImpact: "Real business impact here.",
      headline: "Priority headline for immediate action required",
    };
    const merged = mergeExecutiveSummary(deterministic, ai);
    assert.strictEqual(merged.intro, ai.intro);
    assert.strictEqual(merged.headline, ai.headline);
  });

  it("buildCompleteAuditPrompt contains project facts", () => {
    const prompt = buildCompleteAuditPrompt({
      projectPath: "myproject",
      readiness: { score: 75 },
      summary: {
        gatePass: true,
        simplebeaconIssues: 0,
        severityCounts: { high: 0, medium: 0, low: 0 },
        productionFindings: 0,
        codeSeverity: { high: 0, medium: 0, low: 0 },
        documentationFindings: 0,
        codebaseFindingsDeduped: 0,
        codebaseFindingsRaw: 0,
        codebaseHealth: 85,
        codeFilesAnalyzed: 100,
        codeFilesDiscovered: 120,
        repositoryFiles: 500,
        duplicateGroups: 0,
      },
    });
    assert.ok(prompt.includes("myproject"));
    assert.ok(prompt.includes("75"));
  });

  it("parseAiExecutive extracts JSON from markdown", () => {
    const result = parseAiExecutive(
      '```json\n{"summary":"hello","headline":"fix me","priorities":["a","b"]}\n```',
    );
    assert.ok(result);
    assert.strictEqual(result.headline, "fix me");
    assert.deepStrictEqual(result.priorities, ["a", "b"]);
  });

  it("parseAiExecutive returns null for invalid input", () => {
    assert.strictEqual(parseAiExecutive("not json"), null);
  });
});

// ── HTML Sections ─────────────────────────────────────────────────
const {
  buildExecutiveDashboardBanner,
  buildExecutiveKpiStrip,
  buildCoverPresentation,
} = require("./html-sections.cjs");

describe("html-sections.cjs", () => {
  it("buildExecutiveDashboardBanner returns HTML string", () => {
    const model = {
      summary: {
        gatePass: true,
        codeFilesAnalyzed: 100,
        codebaseHealth: 85,
        productionFindings: 0,
        documentationFindings: 0,
      },
      exportTier: { tier: "handoff" },
    };
    const html = buildExecutiveDashboardBanner(model);
    assert.ok(typeof html === "string");
    assert.ok(html.includes("PASS"));
  });

  it("buildExecutiveKpiStrip returns 5 KPIs for handoff tier", () => {
    const model = {
      summary: {
        simplebeaconIssues: 0,
        productionFindings: 0,
        documentationFindings: 0,
        codebaseHealth: 85,
        codeFilesAnalyzed: 100,
      },
      exportTier: { tier: "handoff" },
    };
    const html = buildExecutiveKpiStrip(model);
    assert.ok(typeof html === "string");
    assert.ok(html.includes("kpi"));
  });

  it("buildCoverPresentation returns cover metadata", () => {
    const model = {
      summary: { gatePass: true },
      exportTier: {
        tier: "handoff",
        showReadinessScore: true,
        showSignOffBlock: true,
      },
      readiness: { score: 90 },
      client: "Acme Corp",
      company: "Acme Corp",
      reportId: "R-123",
      generatedAt: new Date().toISOString(),
      engineLabel: "v1.0",
      branch: "main",
      repositoryLabel: "acme",
      assessor: "Simplebeacon",
    };
    const cover = buildCoverPresentation(model);
    assert.ok(cover.kicker);
    assert.ok(cover.badges.includes("GATE"));
    assert.ok(cover.pageTitle.includes("Acme Corp"));
  });
});

// ── Sample Report ─────────────────────────────────────────────────
const {
  buildSampleAuditReportModel,
  wrapSampleReportForWebsite,
} = require("./sample-report.cjs");

describe("sample-report.cjs", () => {
  it("buildSampleAuditReportModel returns a model", () => {
    const model = buildSampleAuditReportModel();
    assert.ok(model.summary);
    assert.ok(model.readiness);
    assert.ok(model.remediationRows);
  });

  it("wrapSampleReportForWebsite returns HTML", () => {
    const html = wrapSampleReportForWebsite();
    assert.ok(typeof html === "string");
    assert.ok(html.includes("DOCTYPE"));
  });
});
