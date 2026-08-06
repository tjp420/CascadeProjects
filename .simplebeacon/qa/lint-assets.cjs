'use strict';
/**
 * Pre-commit asset hygiene lint -- fast sub-second checks for encoding and path regressions.
 *
 * Runs BEFORE the full SimpleBeacon gate scan to fail fast on cheap, deterministic issues:
 *   1. Mojibake detection -- catches double-encoded UTF-8 (em-dash corruption)
 *   2. Relative path integrity -- ensures service worker scripts use correct ./ or ../ paths
 *
 * Scans STAGED files only (via git diff --cached) to keep it sub-second.
 * Strict fail-closed: blocks the commit on any violation. No auto-repair.
 *
 * Usage:  node .simplebeacon/qa/lint-assets.cjs
 * Exit:   0 = pass, 1 = violations found
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// --- Mojibake detection (byte-level) ---
// Double-encoded em-dash: UTF-8 E2 80 94 misread as Windows-1252, then re-encoded as UTF-8
// produces the byte sequence C3 A2 C2 80 C2 94.
// Right single quote (U+2019) double-encoded: C3 A2 C2 80 C2 99.
const MOJIBAKE_PATTERNS = [
  { name: 'em-dash double-encode', bytes: Buffer.from([0xC3, 0xA2, 0xC2, 0x80, 0xC2, 0x94]) },
  { name: 'right-quote double-encode', bytes: Buffer.from([0xC3, 0xA2, 0xC2, 0x80, 0xC2, 0x99]) },
];

// --- Path integrity rules ---
// Maps filename to required import substrings that must be present.
const PATH_RULES = {
  'scan-worker.js': {
    description: 'service worker must use relative paths for WASM bridge and ignore lib',
    required: ['./scan-wasm-bridge.js', '../utils-lib/'],
    // Known-bad absolute paths that would break in production
    forbidden: ['../../js-es2018/workers/scan-wasm-bridge', '../../js-es2018/utils-lib/'],
  },
};

/**
 * Get list of staged .js/.cjs/.ts/.tsx files.
 * @returns {string[]} Array of repo-relative file paths.
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
      .map(f => f.trim())
      .filter(f => f && /\.(js|cjs|ts|tsx|mjs)$/.test(f));
  } catch (_e) {
    // Not a git repo or git unavailable -- skip gracefully
    return [];
  }
}

/**
 * Check a file's raw bytes for mojibake patterns.
 * @param {string} filePath Absolute path to the file.
 * @returns {string[]} Array of violation descriptions (empty if clean).
 */
function checkMojibake(filePath) {
  const violations = [];
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (_e) {
    return []; // file might have been deleted between staging and lint
  }
  for (const { name, bytes } of MOJIBAKE_PATTERNS) {
    if (buf.indexOf(bytes) !== -1) {
      violations.push(`mojibake pattern "${name}" found in raw bytes`);
    }
  }
  return violations;
}

/**
 * Check a file's content for path integrity rules.
 * @param {string} filePath Absolute path to the file.
 * @param {string} relPath Repo-relative path (for rule matching).
 * @returns {string[]} Array of violation descriptions (empty if clean).
 */
function checkPathIntegrity(filePath, relPath) {
  const violations = [];
  const basename = path.basename(relPath);

  const rule = PATH_RULES[basename];
  if (!rule) return violations;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return [];
  }

  for (const required of rule.required || []) {
    if (!content.includes(required)) {
      violations.push(`missing required import path: "${required}"`);
    }
  }

  for (const forbidden of rule.forbidden || []) {
    if (content.includes(forbidden)) {
      violations.push(`forbidden path pattern found: "${forbidden}" (use relative ./ or ../ instead)`);
    }
  }

  return violations;
}

// --- Main ---
const staged = getStagedFiles();

if (staged.length === 0) {
  console.log('[lint-assets] No staged JS/TS files to check. Skipping.');
  process.exit(0);
}

console.log(`[lint-assets] Checking ${staged.length} staged file(s) for encoding and path regressions...`);

let totalViolations = 0;

for (const relPath of staged) {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) continue;

  const mojibakeIssues = checkMojibake(absPath);
  const pathIssues = checkPathIntegrity(absPath, relPath);
  const allIssues = [...mojibakeIssues, ...pathIssues];

  if (allIssues.length > 0) {
    totalViolations += allIssues.length;
    console.error(`\n  [FAIL] ${relPath}`);
    for (const issue of allIssues) {
      console.error(`    -> ${issue}`);
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n[lint-assets] FAILED: ${totalViolations} violation(s) found. Commit blocked.`);
  console.error('[lint-assets] Fix the encoding or path issues above, then re-stage and retry.');
  process.exit(1);
}

console.log(`[lint-assets] PASSED: All ${staged.length} staged file(s) clean.`);
process.exit(0);
