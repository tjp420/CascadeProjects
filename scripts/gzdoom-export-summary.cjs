#!/usr/bin/env node
'use strict';

/**
 * Export agent-readable GZDoom gate summary outside .simplebeacon/
 * Usage:
 *   node scripts/gzdoom-export-summary.cjs --path "E:/Ai/Games/Doom/TEst/results/R3DLighting"
 *   npm run gzdoom:export-summary -- --path "E:/Ai/Games/Doom/TEst/results/R3DOptions"
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MOD = 'E:/Ai/Games/Doom/TEst/results/R3DOptions';
const STALE_SUFFIX_RE = /(?:_(?:DUPLICATE|OLD|backup)|\.(?:corrupt|clean|bak|old|tmp))(?:\.zs)?$/i;

function parseArgs(argv) {
  const opts = { modPath: DEFAULT_MOD, logPath: null, outDir: 'Docs', norun: true, dryRunNorun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--path' && argv[i + 1]) opts.modPath = argv[++i];
    else if (arg === '--log' && argv[i + 1]) opts.logPath = argv[++i];
    else if (arg === '--out' && argv[i + 1]) opts.outDir = argv[++i];
    else if (arg === '--no-norun') opts.norun = false;
    else if (arg === '--dry-run-norun') opts.dryRunNorun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/gzdoom-export-summary.cjs [--path MOD] [--log LOG] [--out Docs] [--no-norun] [--dry-run-norun]');
      process.exit(0);
    }
  }
  return opts;
}

function findLatestLog(modPath) {
  const candidates = [];
  for (const name of ['gzdoom.log', 'console.log', 'startup.log']) {
    const p = path.join(modPath, name);
    if (fs.existsSync(p)) candidates.push(p);
  }
  try {
    for (const entry of fs.readdirSync(modPath, { withFileTypes: true })) {
      if (entry.isFile() && /\.log$/i.test(entry.name)) {
        candidates.push(path.join(modPath, entry.name));
      }
    }
  } catch { /* ignore */ }
  if (!candidates.length) return null;
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

function collectStaleZscriptFiles(modPath, max = 80) {
  const hits = [];
  function walk(dir, depth) {
    if (depth > 8 || hits.length >= max) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/node_modules|\.git$/i.test(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!/\.(zs|zscript)$/i.test(entry.name) && !STALE_SUFFIX_RE.test(entry.name)) continue;
      if (STALE_SUFFIX_RE.test(entry.name)) {
        hits.push(path.relative(modPath, full).split(path.sep).join('/'));
      }
    }
  }
  walk(path.join(modPath, 'zscript'), 0);
  walk(modPath, 0);
  return [...new Set(hits)].slice(0, max);
}

function readModConfig(modPath) {
  const cfgPath = path.join(modPath, '.simplebeacon', 'config.json');
  if (!fs.existsSync(cfgPath)) return { profile: 'gamedev', configPath: null };
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return { profile: cfg.profile || 'unknown', configPath: cfgPath, raw: cfg };
  } catch {
    return { profile: 'invalid', configPath: cfgPath };
  }
}

function summarizeIssues(issues) {
  const byType = {};
  for (const issue of issues) {
    const t = issue.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }
  return byType;
}

async function main() {
  const opts = parseArgs(process.argv);
  const modPath = path.resolve(opts.modPath);
  if (!fs.existsSync(modPath)) {
    console.error(`[gzdoom-export] Mod path not found: ${modPath}`);
    process.exit(1);
  }

  const { scanGzdoomIntegrity } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/rules/gzdoom-integrity-patterns'));
  const logPath = opts.logPath || findLatestLog(modPath);
  const modConfig = readModConfig(modPath);
  const lintOpts = {
    ignoreGlobs: modConfig.raw?.ignore || [],
    respectIncludes: true,
    severity: 'high',
    companionMod: modConfig.raw?.gzdoom?.companionMod
  };

  console.log(`[gzdoom-export] Scanning ${modPath} (profile: ${modConfig.profile})`);
  const scan = await scanGzdoomIntegrity(modPath, {
    logPath: logPath || undefined,
    ...lintOpts,
    norunGate: false,
    extendedLint: true,
    skipLints: ['zscript']
  });

  const allIssues = scan.issues || [];
  const deathFrameHigh = allIssues.filter((i) =>
    i.type === 'gzdoom-death-frame-reuse' && i.severity === 'high'
  );
  const deathFrameMedium = allIssues.filter((i) =>
    i.type === 'gzdoom-death-frame-reuse' && i.severity === 'medium'
  );
  const blocking = allIssues.filter((i) => i.severity === 'high' || i.severity === 'critical');
  const cvarIssues = allIssues.filter((i) => String(i.type || '').startsWith('gzdoom-cvar-'));
  const logIssues = allIssues.filter((i) => String(i.type || '').startsWith('gzdoom-runtime-'));
  const staleFiles = collectStaleZscriptFiles(modPath);

  let norunGate = null;
  if (opts.norun) {
    const { runGzdoomNorunGate } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/lib/gzdoom-norun-gate'));
    norunGate = runGzdoomNorunGate(modPath, {
      dryRun: opts.dryRunNorun,
      companionMod: modConfig.raw?.gzdoom?.companionMod
    });
    const norunOut = path.join(modPath, opts.outDir, 'gzdoom-norun-gate.json');
    fs.mkdirSync(path.dirname(norunOut), { recursive: true });
    fs.writeFileSync(norunOut, JSON.stringify(norunGate, null, 2), 'utf8');
    console.log(`[gzdoom-export] Norun gate: ${
      norunGate.setupError
        ? norunGate.setupError
        : norunGate.gatePass === null
          ? (opts.dryRunNorun ? 'SKIPPED (dry-run)' : 'SKIPPED')
          : norunGate.gatePass
            ? 'PASS'
            : 'FAIL'
    } → ${norunOut}`);
  }

  const summary = {
    type: 'gzdoom-gate-summary',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    modPath,
    profile: modConfig.profile,
    configPath: modConfig.configPath,
    scan: {
      filesScanned: scan.scanned,
      totalFindings: scan.findings,
      graphSummary: scan.graphSummary || null,
      logPath: logPath || null
    },
    gate: {
      pass: blocking.length === 0 && (norunGate ? (norunGate.gatePass === true || norunGate.gatePass === null) : true),
      blockingCount: blocking.length,
      deathFrameReuseHigh: deathFrameHigh.length,
      deathFrameReuseMedium: deathFrameMedium.length,
      cvarIssues: cvarIssues.length
    },
    gzdoomNorun: norunGate ? {
      gatePass: norunGate.gatePass,
      exitCode: norunGate.exitCode,
      setupError: norunGate.setupError,
      errorCount: norunGate.errorCount,
      errors: (norunGate.errors || []).slice(0, 20)
    } : null,
    cvarSummary: {
      undefined: cvarIssues.filter((i) => i.type === 'gzdoom-cvar-undefined').slice(0, 20),
      prefixViolations: cvarIssues.filter((i) => i.type === 'gzdoom-cvar-prefix').slice(0, 20),
      deadCount: cvarIssues.filter((i) => i.type === 'gzdoom-cvar-dead').length
    },
    findingsByType: summarizeIssues(allIssues),
    runtimeLogFindings: logIssues.slice(0, 50).map((i) => ({
      type: i.type,
      severity: i.severity,
      line: i.line || null,
      description: i.description,
      recommendedAction: i.recommendedAction || null,
      metadata: i.metadata || null
    })),
    highSeverity: blocking.slice(0, 40).map((i) => ({
      type: i.type,
      severity: i.severity,
      file: i.filePath,
      line: i.line || null,
      description: i.description,
      className: i.metadata?.className || null,
      otherState: i.metadata?.otherState || null,
      sprite: i.metadata?.sprite || null,
      frame: i.metadata?.frame || null
    })),
    staleZscriptFiles: staleFiles,
    agentNotes: [
      'Authoritative syntax gate: gzdoom.exe -norun (see gzdoomNorun + Docs/gzdoom-norun-gate.json)',
      'Death-frame reuse (high): Missile/Melee/Pain frames shared with Death — 3D model corpse pose bug',
      'CVAR xref: undefined menu/ZScript refs vs CVARINFO across mod + companionMod',
      'ZScript lint: default parameter values, missing #includes, disabled includes without TODO',
      'EVENTHANDLERS: registered names must match compiled EventHandler classes',
      'Handler map: companion MODELDEF/monster classes vs R3DLighting handlers/',
      'PK3 lint: stale *_DUPLICATE/_OLD/.corrupt files should not ship in build_temp',
      'Read this file from Docs/ — .simplebeacon/ remains gitignored'
    ]
  };

  const outDir = path.join(modPath, opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'gzdoom-gate-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  const mdPath = path.join(outDir, 'gzdoom-gate-summary.md');
  const md = [
    '# GZDoom gate summary',
    '',
    `Generated: ${summary.generatedAt}`,
    `Mod: \`${modPath}\``,
    `Profile: **${modConfig.profile}**`,
    '',
    '## Gate',
    '',
    `- Pass (high-severity): **${summary.gate.pass ? 'YES' : 'NO'}**`,
    `- Blocking/high findings: ${summary.gate.blockingCount}`,
    `- Death-frame reuse (combat): ${summary.gate.deathFrameReuseHigh}`,
    `- Death-frame reuse (ambient): ${summary.gate.deathFrameReuseMedium}`,
    '',
    '## Top high-severity findings',
    ''
  ];
  for (const f of summary.highSeverity.slice(0, 20)) {
    md.push(`- \`${f.file}:${f.line || '?'}\` — ${f.description}`);
  }
  if (summary.runtimeLogFindings?.length) {
    md.push('', '## Runtime log findings', '');
    for (const f of summary.runtimeLogFindings.slice(0, 15)) {
      md.push(`- **${f.type}** (log line ${f.line || '?'}) — ${f.description}`);
    }
  }
  if (staleFiles.length) {
    md.push('', '## Stale ZScript files (suffix patterns)', '');
    for (const f of staleFiles.slice(0, 15)) md.push(`- \`${f}\``);
  }
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log(`[gzdoom-export] Wrote ${outPath}`);
  console.log(`[gzdoom-export] Wrote ${mdPath}`);
  console.log(`[gzdoom-export] ${summary.gate.blockingCount} high findings, ${deathFrameHigh.length} combat death-frame hits`);
  process.exit(summary.gate.pass ? 0 : 1);
}

main().catch((err) => {
  console.error('[gzdoom-export] Fatal:', err);
  process.exit(1);
});
