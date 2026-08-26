// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code — all findings are false positives
/**
 * Markdown audit report generator for `simplebeacon scan --format markdown`.
 * Surfaces scan results in a clean, engineering-manager-friendly document.
 */

const SEVERITY_EMOJI = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
};

const RULE_LABELS = {
  credentials: "Hardcoded Credentials",
  productionLeak: "Production Path Leaks",
  llmSlop: "LLM Slop / AI Placeholders",
  agencyHandoff: "Agency Handoff Patterns",
  fictionKpi: "Fictional KPI Metrics",
  euAiAct: "EU AI Act Indicators",
  tokenBleed: "Token Bleed",
  architectureDrift: "Architecture Drift",
  fileNaming: "File Naming Violations",
  security: "Security Patterns",
};

const SB_FICTION_RULES = [
  {
    id: "SB-FICTION-001",
    label: "LLM Placeholder / Conversational Debris",
    severity: "high",
  },
  { id: "SB-FICTION-002", label: "Markdown Code Fence Leak", severity: "high" },
  {
    id: "SB-FICTION-003",
    label: "Suspicious / Fake Dependencies",
    severity: "medium",
  },
  {
    id: "SB-FICTION-004",
    label: "Hardcoded UI Metrics / Lorem Ipsum",
    severity: "medium",
  },
  {
    id: "SB-FICTION-005",
    label: "Hallucinated API Method Calls",
    severity: "high",
  },
  {
    id: "SB-FICTION-006",
    label: "AI Conversational Debris in TODOs",
    severity: "medium",
  },
  {
    id: "SB-FICTION-007",
    label: "Hardcoded Mock Return Values",
    severity: "high",
  },
  {
    id: "SB-FICTION-008",
    label: "Boilerplate Restatement Comments",
    severity: "low",
  },
];

function gateStatusBadge(pass) {
  if (pass === true) return "✅ **PASS**";
  if (pass === false) return "❌ **BLOCKED**";
  return "⏸️ **REVIEW**";
}

function formatScore(score) {
  if (score == null || !Number.isFinite(Number(score))) return "—";
  const n = Number(score);
  if (n >= 90) return `**${n}**/100 🟢`;
  if (n >= 70) return `**${n}**/100 🟡`;
  return `**${n}**/100 🔴`;
}

function generateHeader(report) {
  const summary = report.summary || {};
  const gate = report.gate || {};
  const generatedAt = report.generatedAt || new Date().toISOString();
  const projectRoot = report.projectRoot || report.scanTargetRoot || "—";
  const tier = report.tier || "community";

  return [
    "# Code Quality & Security Scan Report",
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Project** | \`${projectRoot}\` |`,
    `| **Generated** | ${generatedAt} |`,
    `| **Plan** | ${tier} |`,
    `| **Quality Gate** | ${gateStatusBadge(gate.pass)} |`,
    `| **Quality Score** | ${formatScore(summary.qualityScore)} |`,
    `| **Files Scanned** | ${(summary.totalFiles || 0).toLocaleString()} |`,
    `| **Lines of Code** | ${(summary.totalLines || 0).toLocaleString()} |`,
    "",
  ].join("\n");
}

function generateSeverityBreakdown(report) {
  const gate = report.gate || {};
  const blocking = gate.blockingCount || 0;
  const warning = gate.warningCount || 0;
  const issues = gate.blockingIssues || [];
  const warningIssues = gate.warningIssues || [];

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of [...issues, ...warningIssues]) {
    const sev = String(issue.severity || "low").toLowerCase();
    if (counts[sev] != null) counts[sev] += issue.count || 1;
  }

  return [
    "## Issues Found",
    "",
    "| Severity | Count | What you should do |",
    "| --- | ---: | --- |",
    `| ${SEVERITY_EMOJI.critical} Critical | ${counts.critical} | Fix immediately — these can cause security breaches or data loss |`,
    `| ${SEVERITY_EMOJI.high} High | ${counts.high} | Fix before merging — these will block your quality gate |`,
    `| ${SEVERITY_EMOJI.medium} Medium | ${counts.medium} | Review and fix when possible — these may cause issues later |`,
    `| ${SEVERITY_EMOJI.low} Low | ${counts.low} | Minor cleanup — fix when convenient, no urgency |`,
    "",
    `**Blocking issues (must fix):** ${blocking}  `,
    `**Warning issues (should review):** ${warning}`,
    "",
  ].join("\n");
}

function generateRuleHitSummary(report) {
  const stats = report.stats || {};
  const totals = stats.ruleHitTotals || {};
  const rows = Object.entries(RULE_LABELS)
    .map(([key, label]) => `| ${label} | ${totals[key] || 0} |`)
    .join("\n");

  return [
    "## What Was Checked",
    "",
    "| Check | Issues Found |",
    "| --- | ---: |",
    rows,
    "",
  ].join("\n");
}

function generateFictionRuleBreakdown(report) {
  const issues =
    report.rawIssues || report.detectedIssues || report.issues || [];
  const fictionHits = {};
  for (const issue of issues) {
    const pattern = issue.pattern || issue.metadata?.patternId;
    if (pattern && pattern.startsWith("SB-FICTION-")) {
      fictionHits[pattern] = (fictionHits[pattern] || 0) + (issue.count || 1);
    }
  }

  const hasAny = Object.keys(fictionHits).length > 0;
  const rows = SB_FICTION_RULES.map(({ id, label, severity }) => {
    const count = fictionHits[id] || 0;
    const marker = count > 0 ? `${SEVERITY_EMOJI[severity] || "🔵"}` : "✅";
    return `| ${marker} ${id} | ${label} | ${severity} | ${count} |`;
  }).join("\n");

  return [
    "## AI-Generated Code Issues",
    "",
    "These checks find code that looks like it was generated by AI tools (ChatGPT, Copilot, etc.) but contains placeholder values, fake function calls, or other errors that would break in production.",
    "",
    "| Rule | What it detects | Severity | Issues found |",
    "| --- | --- | --- | ---: |",
    rows,
    "",
    hasAny
      ? `> ⚠️ **${Object.values(fictionHits).reduce((a, b) => a + b, 0)} AI-generated code issues found.** These are likely placeholders or hallucinated code from AI tools — review and fix before merging.`
      : "> ✅ No AI-generated code issues found. Your codebase is clean of AI placeholders and fake API calls.",
    "",
  ].join("\n");
}

function generateTopFindings(report, maxRows = 20) {
  const gate = report.gate || {};
  const blocking = gate.blockingIssues || [];
  const warnings = gate.warningIssues || [];
  const all = [...blocking, ...warnings];

  if (all.length === 0) {
    return [
      "## Top Issues to Fix",
      "",
      "> ✅ No issues found — your code looks clean!",
      "",
    ].join("\n");
  }

  const sorted = all
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    })
    .slice(0, maxRows);

  const rows = sorted
    .map((issue) => {
      const sev = String(issue.severity || "low").toLowerCase();
      const emoji = SEVERITY_EMOJI[sev] || "🔵";
      const file = issue.filePath || issue.file || "—";
      const type = issue.type || issue.rule || "—";
      const fix = issue.fix || issue.recommendedAction || "—";
      return `| ${emoji} ${sev} | ${type} | \`${file}\` | ${fix} |`;
    })
    .join("\n");

  return [
    "## Top Issues to Fix",
    "",
    "| Severity | Issue type | File | How to fix |",
    "| --- | --- | --- | --- |",
    rows,
    all.length > maxRows
      ? `\n_…and ${all.length - maxRows} more issues. Use \`--format json\` for the full list._`
      : "",
    "",
  ].join("\n");
}

function generateBuildReadiness(report) {
  const readiness = report.buildReadiness;
  if (!readiness) return "";

  const checks = readiness.checklist || [];
  const rows = checks
    .map((check) => {
      const marker = check.found ? "✅" : check.critical ? "❌" : "⚠️";
      return `| ${marker} | ${check.name} | ${check.found ? "Present" : check.critical ? "Missing (critical)" : "Missing"} |`;
    })
    .join("\n");

  return [
    "## Build Readiness Checklist",
    "",
    `**Score:** ${readiness.readinessScore || 0}/100 — ${readiness.readinessStatus || "UNKNOWN"}`,
    "",
    "| Status | Check | Result |",
    "| --- | --- | --- |",
    rows,
    "",
    readiness.missingCritical?.length
      ? `> ❌ **Missing critical:** ${readiness.missingCritical.join(", ")}`
      : "> ✅ All critical build files present.",
    "",
  ].join("\n");
}

function generateRemediationPhases(report) {
  const phases = report.remediationPhases;
  if (!Array.isArray(phases) || phases.length === 0) return "";

  const rows = phases
    .map((phase) => {
      const statusEmoji =
        phase.status === "completed"
          ? "✅"
          : phase.status === "in-progress"
            ? "🔄"
            : "⏳";
      return `| ${statusEmoji} | ${phase.title} | ${phase.severity} | ${phase.progress || 0}% | ${phase.effort || "—"} |`;
    })
    .join("\n");

  return [
    "## Fix Roadmap",
    "",
    "| Status | Phase | Severity | Progress | Effort |",
    "| --- | --- | --- | ---: | --- |",
    rows,
    "",
  ].join("\n");
}

function generateEuAiActSection(report) {
  const eu = report.euAiAct;
  if (!eu) return "";

  const indicators = eu.aiSystemIndicators || 0;
  const highRisk = eu.highRiskIndicators || 0;
  const transparency = eu.transparencyGaps || 0;
  const docs = eu.documentationArtifacts || 0;

  if (indicators === 0 && highRisk === 0 && transparency === 0) {
    return [
      "## EU AI Act Compliance",
      "",
      "> ✅ No EU AI Act compliance issues detected.",
      "",
    ].join("\n");
  }

  return [
    "## EU AI Act Compliance",
    "",
    `| What was checked | Count |`,
    `| --- | ---: |`,
    `| AI system indicators | ${indicators} |`,
    `| High-risk classifications | ${highRisk} |`,
    `| Transparency gaps | ${transparency} |`,
    `| Documentation artifacts | ${docs} |`,
    "",
    eu.deadlineNote ? `> ${eu.deadlineNote}` : "",
    "",
  ].join("\n");
}

function generateQualityScorecard(report) {
  const scorecard = report.qualityScorecard;
  if (!scorecard) return "";

  const dims = [
    ["Accuracy", scorecard.accuracy],
    ["Completeness", scorecard.completeness],
    ["Consistency", scorecard.consistency],
    ["Timeliness", scorecard.timeliness],
    ["Validity", scorecard.validity],
    ["Integrity", scorecard.integrity],
  ];

  const rows = dims
    .map(([label, value]) => {
      const n = Number(value) || 0;
      const bar =
        "█".repeat(Math.round(n / 10)) + "░".repeat(10 - Math.round(n / 10));
      return `| ${label} | ${n}/100 | ${bar} |`;
    })
    .join("\n");

  return [
    "## Quality Scorecard", "",
    "> Scores show how well your code meets quality standards across six dimensions. Higher is better.",
    "",
    "| Dimension | Score | Bar |",
    "| --- | ---: | --- |",
    rows,
    "",
  ].join("\n");
}

function generateFileInventory(report) {
  const inv = report.fileInventory;
  if (!inv) return "";

  return [
    "## File Breakdown",
    "",
    "| Category | Count |",
    "| --- | ---: |",
    `| Source Code | ${inv.sourceCode || 0} |`,
    `| Markup | ${inv.markup || 0} |`,
    `| Config | ${inv.config || 0} |`,
    `| Documentation | ${inv.docs || 0} |`,
    `| Build Artifacts | ${inv.buildArtifacts || 0} |`,
    `| Test Fixtures | ${inv.testFixtures || 0} |`,
    `| Other | ${inv.other || 0} |`,
    "",
  ].join("\n");
}

function generateScanStats(report) {
  const stats = report.stats || report.diagnosticReport || {};
  if (!stats.filesAnalyzed && !stats.scannedFiles) return "";

  const lines = [
    "## Scan Details",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Files analyzed | ${(stats.filesAnalyzed || stats.scannedFiles || 0).toLocaleString()} |`,
    `| Files content-scanned | ${(stats.filesContentScanned || 0).toLocaleString()} |`,
    `| Files binary-hashed | ${(stats.filesBinaryHashed || 0).toLocaleString()} |`,
    `| Empty files | ${(stats.emptyFiles || 0).toLocaleString()} |`,
    `| Unreadable files | ${(stats.unreadableFiles || 0).toLocaleString()} |`,
    `| JSON valid / invalid | ${stats.jsonValid || 0} / ${stats.jsonInvalid || 0} |`,
    `| Parallel workers | ${stats.parallelTextRuleWorkers || 0} |`,
  ];

  if (stats.truncated) {
    lines.push(`| ⚠️ Truncated | Yes (max ${stats.maxFiles || "—"} files) |`);
  }

  lines.push("");
  return lines.join("\n");
}

function generateMarkdownReport(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Report object is required for markdown generation");
  }

  const sections = [
    generateHeader(report),
    generateSeverityBreakdown(report),
    generateRuleHitSummary(report),
    generateFictionRuleBreakdown(report),
    generateTopFindings(report),
    generateQualityScorecard(report),
    generateBuildReadiness(report),
    generateRemediationPhases(report),
    generateEuAiActSection(report),
    generateFileInventory(report),
    generateScanStats(report),
    "---",
    "",
    "> Generated by [SimpleBeacon](https://simplebeacon.ai) — automated code quality, security scanning, and AI-generated code detection.",
    "",
  ].filter(Boolean);

  return sections.join("\n");
}

module.exports = {
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
};
