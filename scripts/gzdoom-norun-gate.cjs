#!/usr/bin/env node
'use strict';

/** CLI wrapper for gzdoom-norun-gate — writes Docs/gzdoom-norun-gate.json */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MOD = 'E:/Ai/Games/Doom/TEst/results/R3DLighting';

function parseArgs(argv) {
  const opts = { modPath: DEFAULT_MOD, dryRun: false, timeoutMs: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--path' && argv[i + 1]) opts.modPath = argv[++i];
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--timeout' && argv[i + 1]) opts.timeoutMs = Number(argv[++i]) || null;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/gzdoom-norun-gate.cjs [--path MOD] [--dry-run]');
      process.exit(0);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  const modPath = path.resolve(opts.modPath);
  if (!fs.existsSync(modPath)) {
    console.error(`[gzdoom-norun] Mod not found: ${modPath}`);
    process.exit(2);
  }

  const { runGzdoomNorunGate } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/lib/gzdoom-norun-gate'));
  const report = runGzdoomNorunGate(modPath, { dryRun: opts.dryRun, timeoutMs: opts.timeoutMs || undefined });

  const outDir = path.join(modPath, 'Docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'gzdoom-norun-gate.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (report.setupError) {
    console.log(`[gzdoom-norun] ${report.setupError}`);
    console.log(`[gzdoom-norun] Report: ${outPath}`);
    process.exit(2);
  }

  console.log(`[gzdoom-norun] Gate: ${report.gatePass ? 'PASS' : 'FAIL'} (exit ${report.exitCode}, errors ${report.errorCount})`);
  console.log(`[gzdoom-norun] Report: ${outPath}`);
  process.exit(report.gatePass ? 0 : 1);
}

main();
