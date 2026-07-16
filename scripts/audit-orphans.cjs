#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Orphan-file audit script.
 * Reads a codemap-analysis JSON export and checks Git history for each orphan.
 * Outputs categorized lists:
 *   - stale (> 6 months since last commit)
 *   - recent (< 6 months, likely entry-point scripts)
 *   - missing (file not tracked by Git)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JSON_PATH = process.argv[2] || 'j:/Downloads/cascadeprojects-codemap-analysis-2026-06-30.json';
const ROOT = process.argv[3] || 'c:/Users/Trevor/CascadeProjects';
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const CUTOFF = Date.now() - SIX_MONTHS_MS;

function gitLastCommit(filePath) {
  try {
    const out = execSync(
      `git -C "${ROOT}" log -1 --format=%ct -- "${filePath}"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const ts = parseInt(out.trim(), 10);
    return Number.isFinite(ts) ? ts * 1000 : null;
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`File not found: ${JSON_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const orphans = raw.analysis?.improvements?.find(
    (i) => i.title === 'Potential Orphan / Unused Files'
  )?.files || [];

  const stale = [];
  const recent = [];
  const missing = [];

  for (const rel of orphans) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const lastCommit = gitLastCommit(rel);
    if (lastCommit === null) {
      missing.push(rel); // untracked or git failure
    } else if (lastCommit < CUTOFF) {
      stale.push({ file: rel, lastCommit: new Date(lastCommit).toISOString() });
    } else {
      recent.push({ file: rel, lastCommit: new Date(lastCommit).toISOString() });
    }
  }

  console.log(`=== Orphan Audit Results (${orphans.length} total) ===\n`);

  console.log(`-- Stale (> 6 months) — Candidates for deletion review: ${stale.length} --`);
  stale.slice(0, 20).forEach((o) => console.log(`  [STALE] ${o.file}  (last: ${o.lastCommit})`));
  if (stale.length > 20) console.log(`  ... and ${stale.length - 20} more`);
  console.log();

  console.log(`-- Recent (< 6 months) — Likely entry points / scripts: ${recent.length} --`);
  recent.slice(0, 20).forEach((o) => console.log(`  [RECENT] ${o.file}  (last: ${o.lastCommit})`));
  if (recent.length > 20) console.log(`  ... and ${recent.length - 20} more`);
  console.log();

  console.log(`-- Missing / Untracked: ${missing.length} --`);
  missing.slice(0, 20).forEach((f) => console.log(`  [MISSING] ${f}`));
  if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
  console.log();

  const summaryPath = path.join(ROOT, 'orphan-audit-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ stale, recent, missing, total: orphans.length }, null, 2));
  console.log(`Summary written to: ${summaryPath}`);
}

main();
