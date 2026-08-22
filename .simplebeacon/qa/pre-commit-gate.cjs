'use strict';
/**
 * Pre-commit gate scan wrapper -- runs the SimpleBeacon gate scan against
 * STAGED FILES ONLY instead of the entire repository.
 *
 * The default `simplebeacon scan --gate` walks the whole project root (100k+ files),
 * which takes 600+ seconds and times out. This wrapper:
 *   1. Gets the list of staged files via `git diff --cached`
 *   2. Copies them to a temp directory preserving directory structure
 *   3. Runs the gate scan against the temp directory
 *   4. Cleans up the temp directory
 *
 * This guarantees the scan only sees staged files, regardless of repo size.
 *
 * Usage:  node .simplebeacon/qa/pre-commit-gate.cjs
 * Exit:   0 = gate pass, 1 = gate fail, 2 = error
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// File extensions worth scanning (skip binary, docs, etc.)
const SCANNABLE_EXT = /\.(js|cjs|mjs|ts|tsx|jsx|json|yml|yaml|xml|sh|bat|ps1|py|go|rs|java|rb|php|cs|env|ini|cfg|conf|toml|md)$/i;

/**
 * Get staged files that are scannable.
 * @returns {string[]} Repo-relative file paths (forward slashes).
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 5000,
    });
    return output
      .split('\n')
      .map(f => f.trim().replace(/\\/g, '/'))
      .filter(f => f && SCANNABLE_EXT.test(f));
  } catch (_e) {
    return [];
  }
}

// --- Main ---
const staged = getStagedFiles();

if (staged.length === 0) {
  console.log('[pre-commit-gate] No staged scannable files. Skipping gate scan.');
  process.exit(0);
}

console.log(`[pre-commit-gate] ${staged.length} staged file(s) to scan:`);
console.log(`[pre-commit-gate]   ${staged.join(', ')}`);

// Create a temp directory and copy staged files into it preserving structure
const tempRoot = path.join(os.tmpdir(), `sb-precommit-${process.pid}`);
const tempConfig = path.join(tempRoot, '.simplebeacon', 'config.json');

try {
  fs.mkdirSync(path.join(tempRoot, '.simplebeacon'), { recursive: true });

  for (const relFile of staged) {
    const src = path.join(REPO_ROOT, relFile);
    const dst = path.join(tempRoot, relFile);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }

  // Write a minimal config for the temp scan root, preserving allowlist entries
  // from the real config so that false positives in build artifacts are suppressed
  const realConfigPath = path.join(REPO_ROOT, '.simplebeacon', 'config.json');
  let realAllowlist = [];
  let realIgnore = [];
  try {
    const realConfig = JSON.parse(fs.readFileSync(realConfigPath, 'utf8'));
    realAllowlist = realConfig.allowlist || [];
    realIgnore = realConfig.ignore || [];
  } catch (_e) { /* ignore — fall back to empty allowlist */ }
  const precommitConfig = {
    scanPaths: ['.'],
    productionPaths: ['.'],
    fullDirectoryScan: true,
    fullDirectoryScanMaxFiles: 10000,
    gate: {
      failOn: ['high'],
      warnOn: ['medium', 'low'],
    },
    allowlist: realAllowlist,
    ignore: realIgnore,
  };
  fs.writeFileSync(tempConfig, JSON.stringify(precommitConfig, null, 2), 'utf8');
} catch (e) {
  console.error(`[pre-commit-gate] Failed to set up temp scan dir: ${e.message}`);
  // Clean up partial temp dir
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(2);
}

// Run the gate scan against the temp directory
const args = [
  'packages/simplebeacon-cli/bin/simplebeacon.js',
  'scan',
  '--path', tempRoot,
  '--config', path.join(tempRoot, '.simplebeacon', 'config.json'),
  '--gate',
  '--fail-on', 'high',
  '--no-trust-banner',
];

console.log('[pre-commit-gate] Running gate scan on staged files only...');
const result = spawnSync('node', args, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  timeout: 60000, // 1 min hard cap -- temp dir is tiny so this is plenty
});

// Clean up temp directory
try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (_e) { /* ignore */ }

const exitCode = result.status;
if (result.error) {
  if (result.error.code === 'ETIMEDOUT') {
    console.error('[pre-commit-gate] Scan timed out after 60s. Commit blocked.');
  } else {
    console.error(`[pre-commit-gate] Scan process error: ${result.error.message}`);
  }
  process.exit(2);
}
if (result.status === null) {
  console.error('[pre-commit-gate] Scan terminated abnormally. Commit blocked.');
  process.exit(1);
}

if (exitCode !== 0) {
  console.error(`[pre-commit-gate] Gate scan failed (exit ${exitCode}). Commit blocked.`);
  process.exit(exitCode);
}

console.log('[pre-commit-gate] Gate scan passed.');
process.exit(0);
