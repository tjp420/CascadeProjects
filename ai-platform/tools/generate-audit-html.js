#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildCompleteAuditReport } = require('../server/lib/complete-scan-audit-report');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const archivePath = path.join(projectRoot, '.simplebeacon', 'archive', 'complete-scan-latest.json');
  const nestedArchivePath = path.join(projectRoot, '.simplebeacon', 'archive', 'archive', 'complete-scan-latest.json');
  const latestPath = path.join(projectRoot, '.simplebeacon', 'complete-scan-latest.json');
  const candidates = [archivePath, nestedArchivePath, latestPath];

  const scanPath = candidates.find((p) => {
    if (!fs.existsSync(p)) return false;
    try {
      const payload = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (payload.type === 'simplebeacon-complete-scan-summary') return false;
      return Boolean(payload.results && Object.values(payload.results).some(Boolean));
    } catch {
      return false;
    }
  });
  if (!scanPath) {
    console.error('No complete scan JSON with results found (check .simplebeacon/archive/complete-scan-latest.json).');
    process.exit(1);
  }

  const completeScan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  const report = await buildCompleteAuditReport(completeScan, {
    client: 'CascadeProjects/ai-platform',
    company: 'CascadeProjects/ai-platform',
    assessor: 'Simplebeacon Security Audit Service',
    branch: 'main',
  });

  const outPath = path.join(projectRoot, '.simplebeacon', report.filename);
  fs.writeFileSync(outPath, report.html, 'utf8');

  const m = report.model;
  console.log(
    JSON.stringify(
      {
        scanPath,
        reportId: m.reportId,
        filename: report.filename,
        outputPath: outPath,
        readinessScore: m.readinessScore,
        gatePass: m.gatePass,
        severityCounts: m.severityCounts,
        runtimeFindings: m.runtimeFindingsTotal,
        codeHealth: m.codeHealthScore,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
