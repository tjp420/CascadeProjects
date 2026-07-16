#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
'use strict';
/**
 * Export CLI scan findings as structured JSON.
 * Run this before/after fix sessions to create a machine-readable report.
 *
 * Usage: node scripts/export-findings.js [output.json]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = process.argv[2] || path.join(PROJECT_ROOT, '.simplebeacon', 'findings-export.json');

function runScan() {
  return new Promise((resolve, reject) => {
    const args = [
      'simplebeacon',
      'scan',
      '--full',
      '--gate',
      '--config', '.simplebeacon/config.json'
    ];

    const child = spawn('npx', args, {
      cwd: PROJECT_ROOT,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', () => resolve({ stdout, stderr }));
    child.on('error', reject);
  });
}

function parseFindings(stdout) {
  // Extract metrics
  const filesMatch = stdout.match(/Repository files:\s*([\d,]+)/);
  const gateMatch = stdout.match(/Gate rules checked:\s*([\d,]+)/);
  const scoreMatch = stdout.match(/Quality score:\s*(\d+)/);
  const criticalMatch = stdout.match(/Critical:\s*(\d+)/);
  const highMatch = stdout.match(/High:\s*(\d+)/);
  const mediumMatch = stdout.match(/Medium:\s*(\d+)/);
  const lowMatch = stdout.match(/Low:\s*(\d+)/);

  // Extract individual findings from Issues: section
  const findings = [];
  // Join wrapped lines before parsing
  const normalized = stdout.replace(/\n\s+/g, ' ');
  const issuesSection = normalized.match(/Issues:\s*([\s\S]*?)(?=\n\n|$)/);
  if (issuesSection) {
    // Match: [severity] Category: path:line — description
    const issueRegex = /\[(\w+)\]\s+(.+?):\s+(.+?\.[a-z]+:\d+)\s+[—\-]\s+(.+?)(?=\[\w+\]|$)/g; // simplebeacon-ignore redos — parses internal scan output, not untrusted user input
    let m;
    while ((m = issueRegex.exec(issuesSection[1])) !== null) {
      const [, severity, category, location, description] = m;
      const lastColon = location.lastIndexOf(':');
      const file = location.substring(0, lastColon);
      const lineNum = location.substring(lastColon + 1);
      findings.push({
        severity: severity.toLowerCase(),
        category: category.trim(),
        file: file.trim(),
        line: parseInt(lineNum) || 0,
        description: description.trim()
      });
    }
  }

  // Group by category
  const byCategory = {};
  for (const f of findings) {
    const cat = f.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(f);
  }

  // Group by severity within security category
  const securityBySeverity = { critical: [], high: [], medium: [], low: [] };
  for (const f of findings) {
    if (f.category.toLowerCase() === 'security') {
      if (securityBySeverity[f.severity]) {
        securityBySeverity[f.severity].push(f);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalFiles: filesMatch ? parseInt(filesMatch[1].replace(/,/g, '')) : 0,
      gateFiles: gateMatch ? parseInt(gateMatch[1].replace(/,/g, '')) : 0,
      qualityScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
      severityCounts: {
        critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
        high: highMatch ? parseInt(highMatch[1]) : 0,
        medium: mediumMatch ? parseInt(mediumMatch[1]) : 0,
        low: lowMatch ? parseInt(lowMatch[1]) : 0
      }
    },
    findings: findings,
    byCategory: byCategory,
    securityFindings: securityBySeverity,
    topIssues: findings
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .slice(0, 10)
  };
}

async function main() {
  console.log('[export-findings] Running scan...');
  const { stdout } = await runScan();
  const report = parseFindings(stdout);

  await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`[export-findings] Saved ${report.findings.length} findings to ${OUTPUT_FILE}`);
  console.log(`  Files: ${report.metrics.totalFiles}`);
  console.log(`  Issues: ${report.findings.length} (Critical=${report.metrics.severityCounts.critical}, High=${report.metrics.severityCounts.high}, Medium=${report.metrics.severityCounts.medium}, Low=${report.metrics.severityCounts.low})`);
  console.log(`  Categories: ${Object.keys(report.byCategory).join(', ')}`);

  // Print top 5 high-severity findings for immediate visibility
  if (report.topIssues.length > 0) {
    console.log('\nTop 5 High/Critical Issues:');
    report.topIssues.slice(0, 5).forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.description.substring(0, 80)}`);
    });
  }
}

main().catch(err => {
  console.error(`[export-findings] Error: ${err.message}`);
  process.exit(1);
});
