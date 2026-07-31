#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function severityRank(s) {
  if (!s) return 0;
  const key = String(s).toLowerCase();
  if (key.includes('critical')) return 5;
  if (key.includes('high')) return 4;
  if (key.includes('medium')) return 3;
  if (key.includes('low')) return 2;
  return 1;
}

function normalizeFinding(f) {
  return {
    severity: f.severity || f.level || (f.meta && f.meta.severity) || 'low',
    score: f.score || f.severityScore || (f.meta && f.meta.score) || 0,
    file:
      (f.location && (f.location.path || f.location.file)) ||
      f.file ||
      f.filename ||
      f.path ||
      'unknown',
    rule: f.ruleId || f.rule || f.pattern || f.check || (f.meta && f.meta.rule) || 'unknown',
    message: f.message || f.description || f.title || f.summary || '',
    snippet: f.snippet || f.context || f.code || '',
    suggestion: f.suggestion || f.fix || f.remediation || '',
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const reportPath = argv[0] || '.simplebeacon/poc-report.json';
  const topN = parseInt(argv[1] || '20', 10);

  if (!fs.existsSync(reportPath)) {
    console.error('Report file not found:', reportPath);
    process.exit(2);
  }

  let raw;
  try {
    raw = fs.readFileSync(reportPath, 'utf8');
  } catch (e) {
    console.error('Failed to read report:', e && e.message);
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON in report:', e && e.message);
    process.exit(2);
  }

  const candidates =
    data.complianceFindings ||
    data.compliance_issues ||
    data.compliance ||
    data.rawIssues ||
    data.detectedIssues ||
    data.findings ||
    data.issues ||
    [];

  const normalized = (Array.isArray(candidates) ? candidates : []).map(normalizeFinding);

  normalized.sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (rb !== ra) return rb - ra;
    return (b.score || 0) - (a.score || 0);
  });

  const top = normalized.slice(0, topN);

  console.log(JSON.stringify(top, null, 2));
}

main();
