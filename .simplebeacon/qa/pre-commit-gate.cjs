'use strict';
/**
 * Pre-commit gate scan wrapper -- runs the SimpleBeacon gate scan against
 * STAGED FILES ONLY instead of the entire repository.
 *
 * The default `simplebeacon scan --gate` walks the whole project root (100k+ files),
 * which takes 600+ seconds and times out. This wrapper:
 *   1. Gets the list of staged files via `git diff --cached`
 *   2. Extracts unique parent directories
 *   3. Writes a temporary config with scanPaths limited to those dirs
 *  4. Runs the gate scan with that config
 *  5. Cleans up the temp config
 *
 * Usage:  node .simplebeacon/qa/pre-commit-gate.cjs
 * Exit:   0 = gate pass, 1 = gate fail, 2 = error
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEMP_CONFIG = path.join(REPO_ROOT, '.simplebeacon', 'config-precommit.json');

// File extensions worth scanning (skip binary, docs, etc.)
const SCANNABLE_EXT = /\.(js|cjs|mjs|ts|tsx|jsx|json|yml|yaml|xml|sh|bat|ps1|py|go|rs|java|rb|php|cs|env|ini|cfg|conf|toml|md)$/i;

/**
 * Get staged files that are scannable.
 * @returns {string[]} Repo-relative file paths.
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

/**
 * Extract unique top-level directories from a list of file paths.
 * Limits to 2 levels deep to keep scan scope tight.
 * @param {string[]} files Repo-relative file paths.
 * @returns {string[]} Unique directory paths.
 */
function getScanDirs(files) {
  const dirs = new Set();
  for (const f of files) {
    const parts = f.split('/');
    if (parts.length <= 1) {
      dirs.add('.');
      continue;
    }
    // Use first 2 path segments to keep scope tight but cover siblings
    const dir = parts.slice(0, 2).join('/') + '/';
    dirs.add(dir);
  }
  return Array.from(dirs);
}

// --- Main ---
const staged = getStagedFiles();

if (staged.length === 0) {
  console.log('[pre-commit-gate] No staged scannable files. Skipping gate scan.');
  process.exit(0);
}

const scanDirs = getScanDirs(staged);
console.log(`[pre-commit-gate] ${staged.length} staged file(s) in ${scanDirs.length} dir(s):`);
console.log(`[pre-commit-gate]   ${scanDirs.join(', ')}`);

// Build a minimal pre-commit config
const precommitConfig = {
  scanPaths: scanDirs,
  productionPaths: scanDirs,
  fullDirectoryScan: false,
  fullDirectoryScanMaxFiles: 5000,
  gate: {
    failOn: ['high'],
    warnOn: ['medium', 'low'],
  },
};

// Write temp config
try {
  fs.writeFileSync(TEMP_CONFIG, JSON.stringify(precommitConfig, null, 2), 'utf8');
} catch (e) {
  console.error(`[pre-commit-gate] Failed to write temp config: ${e.message}`);
  process.exit(2);
}

// Run the gate scan with the temp config
const args = [
  'packages/simplebeacon-cli/bin/simplebeacon.js',
  'scan',
  '--config', '.simplebeacon/config-precommit.json',
  '--gate',
  '--fail-on', 'high',
  '--no-trust-banner',
];

console.log('[pre-commit-gate] Running gate scan on staged paths only...');
const result = spawnSync('node', args, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  timeout: 120000, // 2 min hard cap -- fail fast instead of 10 min
});

// Clean up temp config
try { fs.unlinkSync(TEMP_CONFIG); } catch (_e) { /* ignore */ }

const exitCode = result.status;
if (result.error) {
  console.error(`[pre-commit-gate] Scan process error: ${result.error.message}`);
  process.exit(2);
}
if (result.status === null) {
  console.error('[pre-commit-gate] Scan timed out after 120s. Commit blocked.');
  process.exit(1);
}

if (exitCode !== 0) {
  console.error(`[pre-commit-gate] Gate scan failed (exit ${exitCode}). Commit blocked.`);
  process.exit(exitCode);
}

console.log('[pre-commit-gate] Gate scan passed.');
process.exit(0);
