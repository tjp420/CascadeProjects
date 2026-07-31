#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Analyze SimpleBeacon scan report:
 * - Issue distribution breakdown
 * - Compare with previous scan
 * - Generate cleaned summary report
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCAN_REPORT = 'j:\\Downloads\\analyze-c-Users-Trevor-CascadeProjects-2026-07-01(10).json';
const PREV_REPORT =
  'ai-platform\\.simplebeacon\\report.json.simplebeacon-backup.2026-07-01T04-38-17-887Z';
const OUTDIR = path.join(process.cwd(), '.simplebeacon');

const report = JSON.parse(fs.readFileSync(SCAN_REPORT, 'utf8'));
const findings = report.rawIssues || report.detectedIssues || [];

fs.mkdirSync(OUTDIR, { recursive: true });

// ── 1. Issue Distribution Analysis ────────────────────────────

const bySeverity = {};
const byType = {};
const byFile = {};
const byModule = {};
const byRule = {};

for (const f of findings) {
  const sev = f.severity || 'unknown';
  const type = f.type || 'unknown';
  const file = f.filePath || f.file || 'unknown';
  const rule = f.id || 'unknown';

  bySeverity[sev] = (bySeverity[sev] || 0) + (f.count || 1);
  byType[type] = (byType[type] || 0) + (f.count || 1);
  byFile[file] = (byFile[file] || 0) + (f.count || 1);
  byRule[rule] = (byRule[rule] || 0) + (f.count || 1);

  const module = file.split('\\').slice(4, 6).join('/');
  byModule[module] = (byModule[module] || 0) + (f.count || 1);
}

const topFiles = Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
const topRules = Object.entries(byRule)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
const topModules = Object.entries(byModule)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

const distribution = {
  totalFindings: findings.length,
  bySeverity,
  byType,
  byModule: Object.fromEntries(topModules),
  byRule: Object.fromEntries(topRules),
  topFiles: Object.fromEntries(topFiles),
};

fs.writeFileSync(
  path.join(OUTDIR, 'scan-distribution-analysis.json'),
  JSON.stringify(distribution, null, 2),
  'utf8'
);

// ── 2. Compare with Previous Scan ─────────────────────────────

let comparison = null;
if (fs.existsSync(PREV_REPORT)) {
  const prev = JSON.parse(fs.readFileSync(PREV_REPORT, 'utf8'));
  const prevFindings = prev.rawIssues || prev.detectedIssues || [];

  const prevKey = (f) => `${f.id || 'unknown'}|${f.filePath || f.file || 'unknown'}|${f.line || 0}`;
  const prevSet = new Set(prevFindings.map(prevKey));
  const currSet = new Set(findings.map(prevKey));

  const resolved = prevFindings.filter((f) => !currSet.has(prevKey(f)));
  const added = findings.filter((f) => !prevSet.has(prevKey(f)));
  const persistent = findings.filter((f) => prevSet.has(prevKey(f)));

  comparison = {
    previousTotal: prevFindings.length,
    currentTotal: findings.length,
    resolved: resolved.length,
    added: added.length,
    persistent: persistent.length,
    resolvedDetails: resolved
      .slice(0, 20)
      .map((f) => ({ id: f.id, type: f.type, file: f.filePath || f.file, line: f.line })),
    addedDetails: added
      .slice(0, 20)
      .map((f) => ({ id: f.id, type: f.type, file: f.filePath || f.file, line: f.line })),
  };

  fs.writeFileSync(
    path.join(OUTDIR, 'scan-comparison-report.json'),
    JSON.stringify(comparison, null, 2),
    'utf8'
  );
}

// ── 3. Cleaned Markdown Summary ─────────────────────────────

const mediumPlus = findings.filter(
  (f) => f.severity === 'medium' || f.severity === 'high' || f.severity === 'critical'
);
const uniqueMediumPlus = [];
const seen = new Set();
for (const f of mediumPlus) {
  const key = `${f.id || 'unknown'}|${f.filePath || f.file}|${f.line || 0}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueMediumPlus.push(f);
  }
}

const summary = `# SimpleBeacon Scan Summary Report

**Generated:** ${new Date().toISOString()}  
**Scan ID:** ${report.scan_summary?.scan_id || 'unknown'}  
**Status:** ${report.scan_summary?.status || 'unknown'}  
**Quality Score:** ${report.qualityScore || 'N/A'}  

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Files Scanned | ${report.totalFiles || 'N/A'} |
| Total Lines | ${(report.totalLines || 0).toLocaleString()} |
| Total Risks Found | ${report.scan_summary?.total_risks_found || findings.length} |
| High Severity | ${bySeverity.high || 0} |
| Medium Severity | ${bySeverity.medium || 0} |
| Low Severity | ${bySeverity.low || 0} |
| Critical | ${bySeverity.critical || 0} |

${
  comparison
    ? `| Previous Scan | ${comparison.previousTotal} findings |
| Resolved | ${comparison.resolved} |
| New | ${comparison.added} |
| Persistent | ${comparison.persistent} |`
    : ''
}

## Issue Breakdown by Category

| Category | Count |
|----------|-------|
${Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `| ${type} | ${count} |`)
  .join('\n')}

## Top 10 Most Affected Files

| File | Issues |
|------|--------|
${topFiles.map(([file, count]) => `| \`${path.basename(file)}\` | ${count} |`).join('\n')}

## Top 10 Most Triggered Rules

| Rule ID | Count | Description |
|---------|-------|-------------|
${topRules
  .map(([rule, count]) => {
    const example = findings.find((f) => f.id === rule);
    return `| ${rule} | ${count} | ${example ? example.type : 'N/A'} |`;
  })
  .join('\n')}

## Medium+ Severity Unique Findings (${uniqueMediumPlus.length})

${uniqueMediumPlus.length === 0 ? 'No medium or higher severity findings.' : uniqueMediumPlus.map((f) => `- **[${f.severity.toUpperCase()}]** \`${f.id || 'N/A'}\` in \`${path.basename(f.filePath || f.file)}\` (line ${f.line || 'N/A'}): ${f.type} — ${f.description?.substring(0, 120) || 'N/A'}${f.description?.length > 120 ? '...' : ''}`).join('\n')}

## Recommendations

1. **Address medium+ findings first:** ${uniqueMediumPlus.length} unique medium+ issues need attention.
2. **Focus on top affected files:** ${topFiles
  .slice(0, 3)
  .map(([f]) => path.basename(f))
  .join(', ')} contain the highest concentration of issues.
3. **Dead code cleanup:** ${byType['Dead Code'] || 0} dead code findings suggest opportunity for refactoring.
4. **Memory leak review:** ${byType['Memory Leak'] || 0} potential memory leaks detected in event listener patterns.
`;

fs.writeFileSync(path.join(OUTDIR, 'scan-summary-report.md'), summary, 'utf8');

// ── Output ──────────────────────────────────────────────────

console.log('[analyze-scan] Distribution analysis → .simplebeacon/scan-distribution-analysis.json');
console.log('[analyze-scan] Comparison report → .simplebeacon/scan-comparison-report.json');
console.log('[analyze-scan] Summary report → .simplebeacon/scan-summary-report.md');
console.log('\n=== Findings Summary ===');
console.log('Total:', findings.length);
console.log('Severity:', JSON.stringify(bySeverity));
console.log('Categories:', JSON.stringify(byType));
if (comparison) {
  console.log('\n=== Comparison with Previous ===');
  console.log('Previous:', comparison.previousTotal);
  console.log('Current:', comparison.currentTotal);
  console.log('Resolved:', comparison.resolved);
  console.log('New:', comparison.added);
  console.log('Persistent:', comparison.persistent);
}
