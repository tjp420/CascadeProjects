#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code — all findings are false positives
'use strict';

/**
 * Build an LLM-ready audit context bundle: SimpleBeacon scan export + PRD + gap-analysis prompt.
 *
 * Usage:
 *   npm run audit:context
 *   npm run audit:context -- --skip-scan
 *   npm run audit:context -- --init-prd
 *   npm run audit:context -- --project "J:\path\to\repo" --prd ./docs/my-prd.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PRD = path.join(ROOT, 'AUDIT-PRD.md');
const PRD_TEMPLATE = path.join(ROOT, 'docs', 'AUDIT-PRD-TEMPLATE.md');
const DEFAULT_CONFIG = path.join(ROOT, '.simplebeacon', 'config.json');
const DEFAULT_OUT_DIR = path.join(ROOT, '.simplebeacon');

const GAP_ANALYSIS_PROMPT = `Act as a Senior QA and Systems Architect.

You are given:
1) ORIGINAL REQUIREMENTS (PRD section below)
2) SIMPLEBEACON SCAN EVIDENCE (metrics, gate status, and top findings)

Perform a gap analysis. Compare what was requested vs what the scan evidence supports.

Output:
1. Missing Features — required in the PRD but not implemented (cite file/path evidence or "no matches found")
2. Half-Finished Logic — TODO/FIXME, stubs, placeholders, empty handlers (from findings + PRD)
3. Architectural Gaps — broken routes, missing APIs, schema mismatches, frontend/backend disconnects
4. Priority Checklist — numbered build order, highest impact first

Rules:
- Do not invent files, endpoints, or features not supported by the PRD or scan evidence.
- If filesAnalyzed is 0 or inventory is trivial, state the audit is invalid and say how to re-scan.
- Mark each item: [CONFIRMED], [LIKELY], or [UNKNOWN].`;

function parseArgs(argv) {
  const opts = {
    project: ROOT,
    prd: DEFAULT_PRD,
    outDir: DEFAULT_OUT_DIR,
    skipScan: false,
    initPrd: false,
    maxIssues: 30,
    offline: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skip-scan') opts.skipScan = true;
    else if (arg === '--init-prd') opts.initPrd = true;
    else if (arg === '--offline') opts.offline = true;
    else if (arg === '--online') opts.offline = false;
    else if (arg === '--project') opts.project = path.resolve(argv[++i] || ROOT);
    else if (arg === '--prd') opts.prd = path.resolve(argv[++i] || DEFAULT_PRD);
    else if (arg === '--out') opts.outDir = path.resolve(argv[++i] || DEFAULT_OUT_DIR);
    else if (arg === '--max-issues') opts.maxIssues = Math.max(1, Number(argv[++i]) || 30);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/audit-context.cjs [options]

Options:
  --project <path>   Project root to scan (default: repo root)
  --prd <path>       Requirements markdown (default: ./AUDIT-PRD.md)
  --init-prd         Copy docs/AUDIT-PRD-TEMPLATE.md → AUDIT-PRD.md if missing
  --skip-scan        Reuse .simplebeacon/report.json instead of scanning
  --out <dir>        Output directory (default: .simplebeacon)
  --max-issues <n>   Cap findings in bundle (default: 30)
  --online           Allow network during scan (default: offline)
  --help             Show this help
`);
      process.exit(0);
    }
  }
  return opts;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function ensurePrd(opts) {
  if (fs.existsSync(opts.prd)) {
    return { path: opts.prd, source: 'user', created: false };
  }
  if (opts.initPrd) {
    const template = readTextIfExists(PRD_TEMPLATE);
    if (!template) {
      throw new Error(`PRD template not found: ${PRD_TEMPLATE}`);
    }
    fs.mkdirSync(path.dirname(opts.prd), { recursive: true });
    fs.writeFileSync(opts.prd, template, 'utf8');
    console.log(
      `[audit:context] Created ${path.relative(ROOT, opts.prd)} from template — fill it in before the next run.`
    );
    return { path: opts.prd, source: 'template-seeded', created: true };
  }
  const template = readTextIfExists(PRD_TEMPLATE);
  if (template) {
    console.warn(
      '[audit:context] AUDIT-PRD.md not found — embedding docs/AUDIT-PRD-TEMPLATE.md (run with --init-prd to create AUDIT-PRD.md).'
    );
    return { path: PRD_TEMPLATE, source: 'template-inline', created: false };
  }
  throw new Error(`No PRD at ${opts.prd}. Run with --init-prd or create AUDIT-PRD.md.`);
}

function loadConfig(configPath) {
  const raw = readTextIfExists(configPath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid config JSON at ${configPath}: ${err.message}`);
  }
}

async function runSimplebeaconScan(projectRoot, opts) {
  const { runScan } = require('simplebeacon/scan');
  const configPath = fs.existsSync(DEFAULT_CONFIG) ? DEFAULT_CONFIG : null;
  const config = configPath ? loadConfig(configPath) : null;
  console.log(`[audit:context] Scanning ${projectRoot} …`);
  const report = await runScan(projectRoot, {
    gate: true,
    fullDirectoryScan: true,
    offline: opts.offline,
    config,
    configPath: configPath || undefined,
  });
  fs.mkdirSync(opts.outDir, { recursive: true });
  const reportPath = path.join(opts.outDir, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[audit:context] Wrote ${path.relative(ROOT, reportPath)}`);
  return report;
}

function loadExistingReport(outDir, projectRoot) {
  const candidates = [
    path.join(outDir, 'report.json'),
    path.join(projectRoot, '.simplebeacon', 'report.json'),
    path.join(ROOT, '.simplebeacon', 'report.json'),
  ];
  for (const filePath of candidates) {
    const raw = readTextIfExists(filePath);
    if (!raw) continue;
    try {
      console.log(`[audit:context] Using existing report: ${path.relative(ROOT, filePath)}`);
      return { report: JSON.parse(raw), reportPath: filePath };
    } catch {
      /* try next */
    }
  }
  return null;
}

function pickSummary(report) {
  const summary = report.summary || {};
  return {
    qualityScore: report.qualityScore ?? summary.qualityScore ?? null,
    gatePass: report.gate?.pass ?? summary.gatePass ?? null,
    blockingCount: report.gate?.blockingCount ?? null,
    filesAnalyzed:
      report.filesAnalyzed ?? report.ruleScopedFilesAnalyzed ?? summary.codeFilesAnalyzed ?? null,
    repositoryFilesTotal:
      report.repositoryFilesTotal ??
      summary.repositoryFiles ??
      report.repositoryInventory?.totalFiles ??
      null,
    issueCount: report.issueCount ?? summary.totalFindings ?? summary.simplebeaconIssues ?? null,
    severityCounts: report.severityCounts || summary.severityCounts || null,
    scanSource: report.scanSource || null,
    generatedAt: report.generatedAt || null,
  };
}

function normalizeIssues(report, maxIssues) {
  const raw = report.detectedIssues || report.rawIssues || report.findings || [];
  const flat = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const files = Array.isArray(item.filePath)
      ? item.filePath
      : item.filePath
        ? [item.filePath]
        : item.file
          ? [item.file]
          : [];
    const nested = item.findings || [];
    if (nested.length) {
      for (const f of nested.slice(0, 3)) {
        flat.push({
          severity: item.severity || f.severity || 'medium',
          type: item.type || f.type || item.rule || 'finding',
          file: f.file || files[0] || '',
          line: f.line || f.matches?.[0]?.line || null,
          message: f.message || item.impact || item.humanReadable || '',
          rule: item.rule || null,
        });
      }
    } else {
      flat.push({
        severity: item.severity || 'medium',
        type: item.type || item.rule || 'finding',
        file: files[0] || '',
        line: item.line || null,
        message: item.impact || item.description || item.humanReadable || '',
        rule: item.rule || null,
      });
    }
  }
  return flat.slice(0, maxIssues);
}

function pickSuggestedFixes(report, max) {
  const fixes = report.aiContext?.suggestedFixes;
  if (!Array.isArray(fixes)) return [];
  return fixes.slice(0, max).map((f) => ({
    file: f.file || '',
    line: f.line || null,
    type: f.type || '',
    autoFixable: Boolean(f.autoFixable),
    replacement: f.replacement ? String(f.replacement).slice(0, 500) : null,
  }));
}

function buildMarkdown(bundle) {
  const lines = [];
  lines.push('# SimpleBeacon Audit Context');
  lines.push('');
  lines.push(`Generated: ${bundle.generatedAt}`);
  lines.push(`Project: ${bundle.projectPath}`);
  lines.push('');
  lines.push('## PRD (requirements)');
  lines.push('');
  lines.push(`Source: \`${bundle.prd.path}\` (${bundle.prd.source})`);
  lines.push('');
  lines.push(bundle.prd.content.trim());
  lines.push('');
  lines.push('## Scan summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  for (const [key, value] of Object.entries(bundle.scan.summary)) {
    lines.push(
      `| ${key} | ${value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : value} |`
    );
  }
  lines.push('');
  if (bundle.scan.validityWarning) {
    lines.push(`> **Warning:** ${bundle.scan.validityWarning}`);
    lines.push('');
  }
  lines.push('## Top findings');
  lines.push('');
  if (!bundle.scan.topIssues.length) {
    lines.push('_No issues in report._');
  } else {
    bundle.scan.topIssues.forEach((issue, idx) => {
      const loc = issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ''}` : '—';
      lines.push(
        `${idx + 1}. **[${issue.severity}]** ${issue.type} — \`${loc}\` — ${issue.message || '—'}`
      );
    });
  }
  lines.push('');
  if (bundle.scan.suggestedFixes.length) {
    lines.push('## Suggested fixes (from scan)');
    lines.push('');
    bundle.scan.suggestedFixes.forEach((fix, idx) => {
      lines.push(
        `${idx + 1}. \`${fix.file}${fix.line ? `:${fix.line}` : ''}\` — ${fix.type}${fix.autoFixable ? ' (auto-fixable)' : ''}`
      );
    });
    lines.push('');
  }
  lines.push('## Gap analysis prompt');
  lines.push('');
  lines.push('```text');
  lines.push(bundle.gapAnalysisPrompt);
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`Full JSON bundle: \`${path.relative(ROOT, bundle.outputPaths.json)}\``);
  return `${lines.join('\n')}\n`;
}

function assessValidity(summary) {
  const analyzed = Number(summary.filesAnalyzed) || 0;
  const total = Number(summary.repositoryFilesTotal) || 0;
  if (analyzed === 0 && total <= 1) {
    return 'Scan analyzed 0 code files — gap analysis will be unreliable. Use CLI/agent scan on the full project root, not browser-local partial scans.';
  }
  if (total > 0 && analyzed > 0 && analyzed / total < 0.01) {
    return `Only ${analyzed} of ${total} repository files were analyzed — consider --full scan or narrowing PRD scope.`;
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prdInfo = ensurePrd(opts);
  const prdContent = readTextIfExists(prdInfo.path);
  if (!prdContent) {
    throw new Error(`Could not read PRD: ${prdInfo.path}`);
  }

  let report;
  let reportPath;
  if (opts.skipScan) {
    const existing = loadExistingReport(opts.outDir, opts.project);
    if (!existing) {
      throw new Error('No existing report found. Run without --skip-scan first.');
    }
    report = existing.report;
    reportPath = existing.reportPath;
  } else {
    report = await runSimplebeaconScan(opts.project, opts);
    reportPath = path.join(opts.outDir, 'report.json');
  }

  const summary = pickSummary(report);
  const validityWarning = assessValidity(summary);
  const topIssues = normalizeIssues(report, opts.maxIssues);
  const suggestedFixes = pickSuggestedFixes(report, 15);

  fs.mkdirSync(opts.outDir, { recursive: true });
  const jsonPath = path.join(opts.outDir, 'audit-context.json');
  const mdPath = path.join(opts.outDir, 'audit-context.md');

  const bundle = {
    type: 'simplebeacon-audit-context',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    projectPath: opts.project,
    prd: {
      path: path.relative(ROOT, prdInfo.path),
      source: prdInfo.source,
      content: prdContent,
    },
    scan: {
      reportPath: path.relative(ROOT, reportPath),
      summary,
      validityWarning,
      topIssues,
      suggestedFixes,
      gate: report.gate || null,
      scanProfile: report.scanProfile || report.scanProfileLabel || null,
    },
    gapAnalysisPrompt: GAP_ANALYSIS_PROMPT,
    outputPaths: {
      json: jsonPath,
      markdown: mdPath,
    },
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    mdPath,
    buildMarkdown({ ...bundle, outputPaths: { json: jsonPath, markdown: mdPath } }),
    'utf8'
  );

  console.log('[audit:context] Done.');
  console.log(`  Markdown (paste into Cursor): ${path.relative(ROOT, mdPath)}`);
  console.log(`  JSON bundle: ${path.relative(ROOT, jsonPath)}`);
  console.log(
    `  Gate: ${summary.gatePass === true ? 'PASS' : summary.gatePass === false ? 'FAIL' : '—'} | Files analyzed: ${summary.filesAnalyzed ?? '—'}`
  );
  if (validityWarning) {
    console.warn(`  Warning: ${validityWarning}`);
  }
  if (prdInfo.created) {
    console.warn('  Fill in AUDIT-PRD.md, then re-run npm run audit:context');
  }
}

main().catch((err) => {
  console.error(`[audit:context] ${err.message}`);
  process.exit(1);
});
