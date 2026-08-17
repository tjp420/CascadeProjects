#!/usr/bin/env node
'use strict';

/**
 * GZDoom mod integrity + ZScript report runner for local mod folders.
 * Usage:
 *   node scripts/gzdoom-mod-scan.cjs
 *   node scripts/gzdoom-mod-scan.cjs --log "E:/path/to/gzdoom.log"
 *   node scripts/gzdoom-mod-scan.cjs --path "E:/Ai/Games/Doom/TEst/results/R3DLighting"
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_MOD_PATH = 'E:/Ai/Games/Doom/TEst/results/R3DOptions';
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_JSON = path.join(ROOT, '.simplebeacon', 'gzdoom-mod-report.json');
const OUTPUT_SUMMARY = path.join(ROOT, '.simplebeacon', 'qa', 'gzdoom-mod-scan-summary.md');
const CLI = path.join(ROOT, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon.js');
const ZSCRIPT = path.join(ROOT, 'ai-platform', 'server', 'lib', 'code-understanding', 'zscript-mod-report.cjs');

function parseArgs(argv) {
  const opts = { modPath: DEFAULT_MOD_PATH, logPath: null, focus: 'lighting-intensity' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--path' && argv[i + 1]) {
      opts.modPath = argv[++i];
    } else if (arg === '--log' && argv[i + 1]) {
      opts.logPath = argv[++i];
    } else if (arg === '--focus' && argv[i + 1]) {
      opts.focus = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/gzdoom-mod-scan.cjs [--path MOD_DIR] [--log GZDoom.log] [--focus lighting-intensity]`);
      process.exit(0);
    }
  }
  return opts;
}

function findLatestLog(modPath) {
  const candidates = [];
  const names = ['gzdoom.log', 'console.log', 'startup.log'];
  for (const name of names) {
    const p = path.join(modPath, name);
    if (fs.existsSync(p)) candidates.push(p);
  }
  try {
    for (const entry of fs.readdirSync(modPath, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (/\.log$/i.test(entry.name)) {
        candidates.push(path.join(modPath, entry.name));
      }
    }
  } catch {
    /* unreadable mod path */
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

function runIntegrityScan(modPath, logPath) {
  const configPath = path.join(ROOT, '.simplebeacon', 'config-gzdoom.json');
  const args = [
    CLI,
    'scan',
    modPath,
    '--config',
    configPath,
    '--gate',
    '--offline',
    '--format',
    'json',
    '--output',
    OUTPUT_JSON
  ];
  if (logPath) {
    args.push('--log', logPath);
  }
  console.log('[gzdoom-mod-scan] Running:', 'node', args.slice(1).join(' '));
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { exitCode: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function runZscriptReport(modPath, focus) {
  const { generateZscriptModReport } = require(ZSCRIPT);
  return generateZscriptModReport(modPath, { focus });
}

function summarizeFindings(report) {
  if (!report || typeof report !== 'object') return [];
  const issues = report.issues || report.findings || report.results || [];
  if (Array.isArray(issues)) return issues;
  return [];
}

function writeSummary({ modPath, logPath, integrity, zscriptReport, flickerHints }) {
  fs.mkdirSync(path.dirname(OUTPUT_SUMMARY), { recursive: true });
  let reportJson = null;
  if (fs.existsSync(OUTPUT_JSON)) {
    try {
      reportJson = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    } catch {
      reportJson = null;
    }
  }
  const issues = summarizeFindings(reportJson);
  const top = issues.slice(0, 25);
  const lines = [
    '# GZDoom mod scan summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mod path: \`${modPath}\``,
    logPath ? `Log: \`${logPath}\`` : 'Log: _(none — paste startup log or pass --log)_',
    '',
    '## Integrity scan',
    '',
    integrity.exitCode === 0 ? 'Gate scan completed.' : `Gate scan exit code: ${integrity.exitCode}`,
    `Findings in report: ${issues.length}`,
    ''
  ];
  if (top.length) {
    lines.push('### Top findings', '');
    for (const issue of top) {
      const desc = issue.description || issue.message || issue.type || JSON.stringify(issue);
      const file = issue.filePath || issue.file || issue.path || '';
      lines.push(`- ${desc}${file ? ` (\`${file}\`)` : ''}`);
    }
    lines.push('');
  }
  if (zscriptReport) {
    lines.push('## ZScript report', '');
    lines.push(`- Files scanned: ${zscriptReport.structure?.filesScanned ?? '—'}`);
    lines.push(`- Focus: ${zscriptReport.focus || '—'}`);
    if (zscriptReport.problem_diagnosis?.summary) {
      lines.push(`- Diagnosis: ${zscriptReport.problem_diagnosis.summary}`);
    }
    lines.push('');
  }
  if (flickerHints && flickerHints.length) {
    lines.push('## First-person / blacklist hints', '');
    for (const hint of flickerHints.slice(0, 20)) {
      lines.push(`- \`${hint.file}:${hint.line}\` — ${hint.snippet}`);
    }
    lines.push('');
  }
  lines.push('## Next steps', '');
  lines.push('1. Paste startup log or run `print players[consoleplayer].ReadyWeapon.GetClassName()` in GZDoom.');
  lines.push('2. Try `r3d_fp_blacklist_current_weapon` if flicker persists.');
  lines.push('3. Re-run: `npm run gzdoom:scan -- --log path/to/gzdoom.log`');
  fs.writeFileSync(OUTPUT_SUMMARY, lines.join('\n'), 'utf8');
  console.log(`[gzdoom-mod-scan] Summary written to ${OUTPUT_SUMMARY}`);
}

function searchFlickerHints(modPath) {
  const hints = [];
  const terms = [/r3d_fp/i, /blacklist/i, /ReadyWeapon/i, /firstperson|first.person|FPWeapon/i];
  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/node_modules|\.git$/i.test(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!/\.(zs|zscript|decorate|c)$/i.test(entry.name) && !/^(zscript|decorate|modeldef)$/i.test(entry.name)) {
        continue;
      }
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const fileLines = content.split('\n');
      for (let i = 0; i < fileLines.length; i++) {
        if (!terms.some((re) => re.test(fileLines[i]))) continue;
        hints.push({
          file: full,
          line: i + 1,
          snippet: fileLines[i].trim().slice(0, 120)
        });
      }
    }
  }
  walk(modPath, 0);
  return hints;
}

async function main() {
  const opts = parseArgs(process.argv);
  const modPath = path.resolve(opts.modPath);
  if (!fs.existsSync(modPath)) {
    console.error(`[gzdoom-mod-scan] Mod path not found: ${modPath}`);
    process.exit(1);
  }
  const logPath = opts.logPath || findLatestLog(modPath);
  if (logPath) {
    console.log(`[gzdoom-mod-scan] Using log: ${logPath}`);
  }
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  const integrity = runIntegrityScan(modPath, logPath);
  let zscriptReport = null;
  try {
    zscriptReport = await runZscriptReport(modPath, opts.focus);
    const zscriptOut = path.join(ROOT, '.simplebeacon', 'gzdoom-zscript-report.json');
    fs.writeFileSync(zscriptOut, JSON.stringify(zscriptReport, null, 2), 'utf8');
    console.log(`[gzdoom-mod-scan] ZScript report written to ${zscriptOut}`);
  } catch (err) {
    console.warn('[gzdoom-mod-scan] ZScript report failed:', err.message || err);
  }
  const flickerHints = searchFlickerHints(modPath);
  writeSummary({ modPath, logPath, integrity, zscriptReport, flickerHints });
  try {
    const exportScript = path.join(ROOT, 'scripts', 'gzdoom-export-summary.cjs');
    const exportResult = spawnSync(process.execPath, [exportScript, '--path', modPath], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    if (exportResult.stdout) process.stdout.write(exportResult.stdout);
    if (exportResult.stderr) process.stderr.write(exportResult.stderr);
  } catch (err) {
    console.warn('[gzdoom-mod-scan] Export summary skipped:', err.message || err);
  }
  process.exit(integrity.exitCode === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[gzdoom-mod-scan] Fatal:', err);
  process.exit(1);
});
