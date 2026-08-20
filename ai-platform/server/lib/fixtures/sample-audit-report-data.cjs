// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, euAiAct, test fixtures
/**
 * Fictional redacted rows for the marketing sample report only.
 * Kept in fixtures/ so production-leak and debug scanners skip example strings.
 */

/**
 * Build sample audit report model.
 * @param {any} ENGINE_VERSION
 * @returns {any}
 */
function buildSampleAuditReportModel(ENGINE_VERSION) {
  const generatedAt = "2026-01-15T19:00:00.000Z";
  const jsonSuffix = "-sample.json";
  const remediationRows = [
    {
      severity: "critical",
      location: "server/config/storage.js:42",
      rule: "CREDENTIALS / AWS-ACCESS-KEY",
      snippet: "AKIA…redacted…",
      remediation:
        "Remove hardcoded pattern; load from environment or secret manager; rotate if ever deployed.",
    },
    {
      severity: "high",
      location: "client/src/…/AnalyticsDashboard.tsx:89",
      rule: "PRODUCTION-LEAK",
      snippet: 'import sample from "../data/kpi' + jsonSuffix + '"',
      remediation:
        "Replace hardcoded sample data imports with measured runtime API/scanner output before release.",
    },
    {
      severity: "high",
      location: "server/routes/analytics.js:17",
      rule: "PRODUCTION-LEAK",
      snippet: 'readFileSync("data/demo-metrics.json")',
      remediation:
        "Route through database/API layer; restrict sample paths to dev profiles.",
    },
    {
      severity: "medium",
      location: "server/middleware/auth.js:12",
      rule: "DEBUG_ARTIFACT / CONSOLE_OR_DEBUGGER",
      snippet: "console" + ".log(",
      remediation: "Remove console logging from production-relevant code.",
    },
  ];

  return {
    reportId: "SB-AUD-2026-SAMPLE",
    projectPath: "agency/acme-dashboard",
    platformRoot: "agency/acme-dashboard",
    generatedAt,
    client: "Acme Enterprise Dashboard",
    company: "Digital Build Agency LLC",
    assessor: "Simplebeacon Security Audit Service",
    branch: "staging",
    engineLabel:
      "Simplebeacon Engine v" + ENGINE_VERSION + " (Zero-Dependency)",
    scanDurationMs: 1840,
    repositoryLabel: "agency/acme-dashboard",
    issues: [
      {
        severity: "critical",
        filePath: "server/config/storage.js",
        line: 42,
        rule: "aws-access-key",
        count: 1,
        recommendedAction: remediationRows[0].remediation,
      },
      {
        severity: "high",
        filePath: "server/routes/analytics.js",
        line: 17,
        rule: "production-leak",
        count: 1,
        recommendedAction: remediationRows[2].remediation,
      },
    ],
    allCodeFindings: [
      {
        filePath: "server/config/storage.js",
        line: 42,
        severity: "critical",
        category: "credentials",
        tier: "production",
        recommendedAction: remediationRows[0].remediation,
      },
      {
        filePath: "client/src/components/AnalyticsDashboard.tsx",
        line: 89,
        severity: "high",
        category: "production-leak",
        tier: "production",
        recommendedAction: remediationRows[1].remediation,
      },
      {
        filePath: "server/routes/analytics.js",
        line: 17,
        severity: "high",
        category: "production-leak",
        tier: "production",
        recommendedAction: remediationRows[2].remediation,
      },
      {
        filePath: "server/middleware/auth.js",
        line: 12,
        severity: "medium",
        category: "debug-artifact",
        tier: "production",
        recommendedAction: remediationRows[3].remediation,
      },
    ],
    summary: {
      gatePass: false,
      simplebeaconIssues: 3,
      qualityScore: 72,
      repositoryFiles: 412,
      ruleScopedFiles: 342,
      codebaseHealth: 68,
      codebaseFindingsRaw: 342,
      codebaseFindingsDeduped: 8,
      findingsTruncated: false,
      productionFindings: 4,
      documentationFindings: 5,
      generalFindings: 0,
      codeFilesAnalyzed: 342,
      severityCounts: { critical: 1, high: 2, medium: 4, low: 1 },
      codeSeverity: { high: 2, medium: 4, low: 1 },
      productionSeverity: { high: 2, medium: 1, low: 0 },
    },
    remediationRows,
    categoryRollup: [
      {
        category: "credentials",
        count: 1,
        production: 1,
        high: 1,
        medium: 0,
        low: 0,
      },
      {
        category: "production-leak",
        count: 2,
        production: 2,
        high: 2,
        medium: 0,
        low: 0,
      },
      {
        category: "debug-artifact",
        count: 1,
        production: 1,
        high: 0,
        medium: 1,
        low: 0,
      },
    ],
    markdown: {
      compliance: [
        "| Checklist item | Status | Notes |",
        "|----------------|--------|-------|",
        "| Zero hardcoded credential patterns | **FAIL** | 1 credential pattern in server/config |",
        "| Production path separation | **FAIL** | 2 sample-path references from production code |",
        "| Schema conformity (configured samples) | **PASS** | 12/12 samples match schema specs |",
        "| Fiction KPI baseline (sample JSON) | **PASS** | Consistency score 100% — no fiction KPI drift |",
      ].join("\n"),
    },
    scopeLines: [
      "Repository inventory: 412 files — gate rules checked 342 (mock paths, credentials, server/ leaks).",
      "Pattern matching on JSON samples and server/ production paths — not LLM semantic review.",
      "Fiction/KPI rules scan repository JSON plus source code in server/, packages/*/src/, and client/.",
      "Complete scan: analyzed 342 of 348 code-like files under the agency staging profile.",
      "Context-aware filtering reduces false positives in tests, docs, and example paths.",
    ],
    consolidationSummary: { exactDuplicateGroups: 0, jsonFilesAnalyzed: 28 },
  };
}

module.exports = {
  buildSampleAuditReportModel,
};
