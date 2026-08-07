'use strict';
/**
 * Pre-commit asset hygiene lint -- fast sub-second checks for encoding and path regressions.
 *
 * Runs BEFORE the full SimpleBeacon gate scan to fail fast on cheap, deterministic issues:
 *   1. Mojibake detection -- catches double-encoded UTF-8 (em-dash corruption)
 *   2. Relative path integrity -- ensures service worker scripts use correct ./ or ../ paths
 *
 * Scans STAGED files only (via git diff --cached) to keep it sub-second.
 * Fail-closed by default: blocks the commit on any violation.
 *
 * Interactive fixer mode (--fix): when auto-resolvable issues are found, prompts
 * the developer (y/n) to auto-fix each file. Applies the fix, re-stages the file,
 * and continues. Non-interactive or declined fixes fall back to fail-closed.
 *
 * Usage:  node .simplebeacon/qa/lint-assets.cjs [--fix]
 * Exit:   0 = pass, 1 = violations found (and not fixed)
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIX_MODE = process.argv.includes('--fix');
const NON_INTERACTIVE = !process.stdin.isTTY || process.env.CI || process.env.LINT_ASSETS_NO_PROMPT;

// --- Mojibake detection (byte-level) ---
// Double-encoded em-dash: UTF-8 E2 80 94 misread as Windows-1252, then re-encoded as UTF-8
// produces the byte sequence C3 A2 C2 80 C2 94.
// Right single quote (U+2019) double-encoded: C3 A2 C2 80 C2 99.
const MOJIBAKE_PATTERNS = [
  {
    name: 'em-dash double-encode',
    bytes: Buffer.from([0xC3, 0xA2, 0xC2, 0x80, 0xC2, 0x94]),
    fix: Buffer.from([0xE2, 0x80, 0x94]), // correct UTF-8 em-dash
  },
  {
    name: 'right-quote double-encode',
    bytes: Buffer.from([0xC3, 0xA2, 0xC2, 0x80, 0xC2, 0x99]),
    fix: Buffer.from([0xE2, 0x80, 0x99]), // correct UTF-8 right single quote
  },
];

// --- Path integrity rules ---
// Maps filename to required import substrings that must be present.
const PATH_RULES = {
  'scan-worker.js': {
    description: 'service worker must use relative paths for WASM bridge and ignore lib',
    required: ['./scan-wasm-bridge.js', '../utils-lib/'],
    // Known-bad absolute paths that would break in production
    forbidden: ['../../js-es2018/workers/scan-wasm-bridge', '../../js-es2018/utils-lib/'],
    // Auto-fix replacements for forbidden paths
    fixes: {
      '../../js-es2018/workers/scan-wasm-bridge': './scan-wasm-bridge.js',
      '../../js-es2018/utils-lib/': '../utils-lib/',
    },
  },
};

// Directories that contain build-generated artifacts (not hand-edited source).
// Path integrity rules are skipped for files under these directories.
const BUILD_OUTPUT_DIRS = [
  'coming-soon/public/',
  'ai-platform/web/simplebeacon-dashboard/',
];

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

  // Skip path integrity checks for build-generated artifacts
  const normalizedRelPath = relPath.replace(/\\/g, '/');
  for (const dir of BUILD_OUTPUT_DIRS) {
    if (normalizedRelPath.startsWith(dir)) return violations;
  }

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

// --- Auto-fix functions ---

/**
 * Fix mojibake patterns in a file's raw bytes.
 * @param {string} filePath Absolute path to the file.
 * @returns {number} Number of byte sequences replaced.
 */
function fixMojibake(filePath) {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (_e) {
    return 0;
  }
  let replacements = 0;
  for (const { bytes, fix } of MOJIBAKE_PATTERNS) {
    if (!fix) continue;
    while (buf.indexOf(bytes) !== -1) {
      const idx = buf.indexOf(bytes);
      buf = Buffer.concat([buf.subarray(0, idx), fix, buf.subarray(idx + bytes.length)]);
      replacements++;
    }
  }
  if (replacements > 0) {
    fs.writeFileSync(filePath, buf);
  }
  return replacements;
}

/**
 * Fix forbidden path patterns in a file's content.
 * @param {string} filePath Absolute path to the file.
 * @param {string} relPath Repo-relative path (for rule matching).
 * @returns {number} Number of path replacements made.
 */
function fixPathIntegrity(filePath, relPath) {
  const basename = path.basename(relPath);
  const rule = PATH_RULES[basename];
  if (!rule || !rule.fixes) return 0;

  // Skip build output dirs
  const normalizedRelPath = relPath.replace(/\\/g, '/');
  for (const dir of BUILD_OUTPUT_DIRS) {
    if (normalizedRelPath.startsWith(dir)) return 0;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return 0;
  }

  let replacements = 0;
  for (const [bad, good] of Object.entries(rule.fixes)) {
    while (content.includes(bad)) {
      content = content.replace(bad, good);
      replacements++;
    }
  }

  if (replacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return replacements;
}

/**
 * Re-stage a file after auto-fix so the commit picks up the corrected content.
 * @param {string} relPath Repo-relative path.
 */
function restageFile(relPath) {
  try {
    execSync(`git add "${relPath}"`, { cwd: REPO_ROOT, timeout: 5000, stdio: 'pipe' });
  } catch (_e) {
    // best-effort; the developer can re-stage manually
  }
}

/**
 * Prompt the user with a yes/no question on stdin.
 * @param {string} question The question to display.
 * @returns {Promise<boolean>} true if answered yes, false otherwise.
 */
function promptYesNo(question) {
  return new Promise((resolve) => {
    if (NON_INTERACTIVE) {
      resolve(false);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question + ' (y/N) ', (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// --- Main ---
async function main() {
  const staged = getStagedFiles();

  if (staged.length === 0) {
    console.log('[lint-assets] No staged JS/TS files to check. Skipping.');
    process.exit(0);
  }

  const modeLabel = FIX_MODE ? ' (fix mode enabled)' : '';
  console.log(`[lint-assets] Checking ${staged.length} staged file(s) for encoding and path regressions...${modeLabel}`);

  let totalViolations = 0;
  let totalFixed = 0;

  for (const relPath of staged) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) continue;

    const mojibakeIssues = checkMojibake(absPath);
    const pathIssues = checkPathIntegrity(absPath, relPath);
    const allIssues = [...mojibakeIssues, ...pathIssues];

    if (allIssues.length > 0) {
      // In fix mode, attempt auto-fix for resolvable issues
      if (FIX_MODE) {
        const canAutoFix = mojibakeIssues.length > 0 || pathIssues.length > 0;
        if (canAutoFix) {
          console.error(`\n  [FIX?] ${relPath}`);
          for (const issue of allIssues) {
            console.error(`    -> ${issue}`);
          }

          const answer = await promptYesNo(`  Auto-fix ${relPath}?`);
          if (answer) {
            const mojiFixed = fixMojibake(absPath);
            const pathFixed = fixPathIntegrity(absPath, relPath);
            const fixed = mojiFixed + pathFixed;

            if (fixed > 0) {
              restageFile(relPath);
              totalFixed += fixed;
              console.log(`  [FIXED] ${relPath}: ${fixed} issue(s) resolved and re-staged.`);
              continue; // skip fail-closed for this file
            } else {
              console.error(`  [SKIP] ${relPath}: auto-fix produced no changes.`);
            }
          } else {
            console.error(`  [SKIP] ${relPath}: fix declined by user.`);
          }
        }
      }

      // Not fixed — count as violation
      totalViolations += allIssues.length;
      console.error(`\n  [FAIL] ${relPath}`);
      for (const issue of allIssues) {
        console.error(`    -> ${issue}`);
      }
    }
  }

  if (totalFixed > 0) {
    console.log(`[lint-assets] Auto-fixed ${totalFixed} issue(s) across staged files.`);
  }

  if (totalViolations > 0) {
    console.error(`\n[lint-assets] FAILED: ${totalViolations} violation(s) found. Commit blocked.`);
    if (FIX_MODE) {
      console.error('[lint-assets] Some issues could not be auto-fixed. Resolve manually, then re-stage and retry.');
    } else {
      console.error('[lint-assets] Fix the encoding or path issues above, then re-stage and retry.');
      console.error('[lint-assets] Tip: run with --fix for interactive auto-repair of mojibake and path patterns.');
    }
    process.exit(1);
  }

  console.log(`[lint-assets] PASSED: All ${staged.length} staged file(s) clean.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[lint-assets] Unexpected error:', err.message);
  process.exit(1);
});
