#!/usr/bin/env node
/**
 * SimpleBeacon Report JSON → CSV Converter
 *
 * Reads the authoritative CLI gate scan report (.simplebeacon/report.json)
 * and exports clean CSV spreadsheets of all findings.
 *
 * Usage:
 *   node report_to_csv.js [path/to/report.json] [output-dir]
 *
 * Defaults:
 *   Input:  .simplebeacon/report.json
 *   Output: .simplebeacon/ (scan_findings.csv, scan_gate_issues.csv, scan_summary.csv)
 */

const fs = require("fs");
const path = require("path");

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsv(headers, row) {
  return headers.map((h) => csvEscape(row[h])).join(",");
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(rowToCsv(headers, row));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  return rows.length;
}

function flattenMetadata(issue) {
  const meta = issue.metadata || {};
  return {
    ruleId: meta.ruleId || meta.patternId || "",
    ruleName: meta.ruleName || "",
    category: meta.category || "",
    engine: meta.engine || "",
    match: (meta.match || "").slice(0, 200),
    snippet: (meta.snippet || "").slice(0, 200),
  };
}

function collectFindings(data) {
  const seenIds = new Set();
  const findings = [];

  // rawIssues has the richest data (id, metadata with ruleId/match/snippet)
  for (const issue of data.rawIssues || []) {
    const fid = issue.id || `${issue.type}-${issue.filePath}-${issue.line}`;
    if (seenIds.has(fid)) continue;
    seenIds.add(fid);

    const meta = flattenMetadata(issue);
    findings.push({
      id: fid,
      severity: issue.severity || "",
      severityBand: issue.severityBand || "",
      type: issue.type || "",
      ruleId: meta.ruleId,
      ruleName: meta.ruleName,
      category: meta.category,
      engine: meta.engine,
      file: issue.file || issue.filePath || "",
      filePath: issue.filePath || "",
      line: issue.line ?? "",
      description: issue.description || "",
      count: issue.count ?? 1,
      affectedFiles: (issue.affectedFiles || []).join("; "),
      match: meta.match,
      snippet: meta.snippet,
    });
  }

  // Also check detectedIssues for any not in rawIssues
  for (const issue of data.detectedIssues || []) {
    const fid = `${issue.type}-${issue.file}-${issue.line}`;
    if (seenIds.has(fid)) continue;
    seenIds.add(fid);

    findings.push({
      id: fid,
      severity: issue.severity || "",
      severityBand: issue.severityBand || "",
      type: issue.type || "",
      ruleId: issue.pattern || "",
      ruleName: "",
      category: "",
      engine: "",
      file: issue.file || "",
      filePath: (issue.filePaths || [""])[0] || "",
      line: issue.line ?? "",
      description: issue.description || "",
      count: issue.count ?? 1,
      affectedFiles: (issue.affectedFiles || []).join("; "),
      match: "",
      snippet: "",
    });
  }

  return findings;
}

function collectGateIssues(data) {
  const gate = data.gate || {};
  const seenIds = new Set();
  const issues = [];

  const blocking = gate.blockingIssues || [];
  const warning = gate.warningIssues || [];

  for (const issue of [...blocking, ...warning]) {
    const fid = issue.id || `${issue.type}-${issue.filePath}-${issue.line}`;
    if (seenIds.has(fid)) continue;
    seenIds.add(fid);

    const meta = flattenMetadata(issue);
    const gateStatus = blocking.includes(issue) ? "BLOCKING" : "WARNING";

    issues.push({
      gateStatus,
      id: fid,
      severity: issue.severity || "",
      type: issue.type || "",
      ruleId: meta.ruleId,
      ruleName: meta.ruleName,
      file: issue.file || issue.filePath || "",
      line: issue.line ?? "",
      description: issue.description || "",
      match: meta.match,
    });
  }

  return issues;
}

function collectSummary(data, totalRaw, actionableCount) {
  const summary = data.scan_summary || {};
  const severity = data.severityCounts || {};
  const gate = data.gate || {};

  const noiseCount = totalRaw - actionableCount;
  const signalRatio =
    totalRaw > 0
      ? ((actionableCount / totalRaw) * 100).toFixed(2) + "%"
      : "100%";

  return [
    { metric: "Gate Status", value: gate.status || "" },
    { metric: "Gate Pass", value: String(gate.pass ?? "") },
    { metric: "Blocking Count", value: gate.blockingCount ?? 0 },
    { metric: "Warning Count", value: gate.warningCount ?? 0 },
    { metric: "Total Raw Warnings", value: totalRaw },
    { metric: "Actionable Warnings", value: actionableCount },
    { metric: "Suppressed Noise Warnings", value: noiseCount },
    { metric: "Signal-to-Noise Ratio", value: signalRatio },
    { metric: "Total Files", value: data.totalFiles ?? 0 },
    { metric: "Files Analyzed", value: data.filesAnalyzed ?? 0 },
    { metric: "Total Lines", value: data.totalLines ?? 0 },
    { metric: "Issue Count", value: data.issueCount ?? 0 },
    { metric: "Critical Severity", value: severity.critical ?? 0 },
    { metric: "High Severity", value: severity.high ?? 0 },
    { metric: "Medium Severity", value: severity.medium ?? 0 },
    { metric: "Low Severity", value: severity.low ?? 0 },
    { metric: "Credential Findings", value: data.credentialFindings ?? 0 },
    { metric: "Custom Heuristic Findings", value: data.customHeuristicFindings ?? 0 },
    { metric: "AST Structural Findings", value: data.astStructuralFindings ?? 0 },
    { metric: "Deployment Readiness Findings", value: data.deploymentReadinessFindings ?? 0 },
    { metric: "Scan Duration (ms)", value: data.totalScanTimeMs ?? 0 },
    { metric: "Generated At", value: data.generatedAt || "" },
    { metric: "Project Root", value: data.projectRoot || "" },
  ];
}

function main() {
  const jsonPath = process.argv[2] || path.join(process.cwd(), ".simplebeacon", "report.json");
  const outputDir = process.argv[3] || path.dirname(jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON report not found at ${jsonPath}`);
    console.error("Run this first:  npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  // Export 1: All findings (detailed, unfiltered — source of truth)
  const findings = collectFindings(data);
  const findingsPath = path.join(outputDir, "scan_findings.csv");
  const findingsHeaders = [
    "id", "severity", "severityBand", "type",
    "ruleId", "ruleName", "category", "engine",
    "file", "filePath", "line",
    "description", "count",
    "affectedFiles", "match", "snippet",
  ];
  const findingsCount = writeCsv(findingsPath, findingsHeaders, findings);
  console.log(`Findings CSV:  ${findingsPath}  (${findingsCount} findings)`);

  // Export 1b: Actionable findings (filters out structural noise rules)
  // SB-QUAL-003 (deadweight exported functions) produces ~3,980 false positives
  // because static analysis can't trace dynamic dispatch, event hooks, or RPC.
  // The raw CSV above preserves them; this file drops them for actionable triage.
  const NOISE_RULES = new Set(["SB-QUAL-003"]);
  const actionable = findings.filter((f) => !NOISE_RULES.has(f.ruleId));
  const actionablePath = path.join(outputDir, "scan_findings_actionable.csv");
  const actionableCount = writeCsv(actionablePath, findingsHeaders, actionable);
  console.log(`Actionable CSV: ${actionablePath}  (${actionableCount} findings, filtered ${findingsCount - actionableCount} noise)`);

  // Export 2: Gate issues (blocking + warning)
  const gateIssues = collectGateIssues(data);
  const gatePath = path.join(outputDir, "scan_gate_issues.csv");
  const gateHeaders = [
    "gateStatus", "id", "severity", "type",
    "ruleId", "ruleName", "file", "line",
    "description", "match",
  ];
  const gateCount = writeCsv(gatePath, gateHeaders, gateIssues);
  console.log(`Gate CSV:      ${gatePath}  (${gateCount} gate issues)`);

  // Export 2b: Actionable gate issues (same noise filter)
  const actionableGate = gateIssues.filter((g) => !NOISE_RULES.has(g.ruleId));
  const actionableGatePath = path.join(outputDir, "scan_gate_issues_actionable.csv");
  const actionableGateCount = writeCsv(actionableGatePath, gateHeaders, actionableGate);
  console.log(`Actionable Gate: ${actionableGatePath}  (${actionableGateCount} gate issues, filtered ${gateCount - actionableGateCount} noise)`);

  // Export 3: Summary metrics (includes signal-to-noise ratio)
  const summaryRows = collectSummary(data, gateCount, actionableGateCount);
  const summaryPath = path.join(outputDir, "scan_summary.csv");
  const summaryCount = writeCsv(summaryPath, ["metric", "value"], summaryRows);
  console.log(`Summary CSV:   ${summaryPath}  (${summaryCount} metrics)`);

  // Console summary
  const gate = data.gate || {};
  const severity = data.severityCounts || {};
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Gate: ${gate.status || "?"}  |  Blocking: ${gate.blockingCount ?? 0}  |  Warning: ${gate.warningCount ?? 0}`);
  console.log(`Severity:  critical=${severity.critical ?? 0}  high=${severity.high ?? 0}  medium=${severity.medium ?? 0}  low=${severity.low ?? 0}`);
  console.log(`Files: ${data.filesAnalyzed ?? 0} analyzed  |  Lines: ${(data.totalLines ?? 0).toLocaleString()}  |  Duration: ${((data.totalScanTimeMs ?? 0) / 1000).toFixed(1)}s`);
}

main();
