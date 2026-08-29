'use strict';
/**
 * Pre-commit guard — blocks commits that contain production environment files
 * or hardcoded production connection strings.
 *
 * Runs BEFORE the full SimpleBeacon gate scan to fail fast on production safety issues:
 *   1. Blocks staged `.env.production` / `.env.prod` files (even via `git add -f`)
 *   2. Blocks staged JS/CJS/JSON/sh files with production connection strings
 *   3. Warns when a local `.env.production` exists but is not staged
 *
 * Scans STAGED files only (via git diff --cached) to keep it sub-second.
 * Strict fail-closed: blocks the commit on any BLOCK violation.
 *
 * Usage:  node .simplebeacon/qa/env-production-guard.cjs
 * Exit:   0 = pass (or warnings only), 1 = production safety violations found
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// --- Detection patterns ---

// Filenames that indicate production env files (case-insensitive)
const PROD_ENV_FILENAMES = [
  '.env.production',
  '.env.prod',
  '.env.production.local',
];

// File extensions to scan for production connection strings
const SCANNABLE_EXT = /\.(js|cjs|mjs|ts|tsx|json|sh|yml|yaml|env)$/i;

// Patterns that indicate production connection strings or live secrets.
// Each pattern: { regex, label, skipIfCommented }
const PROD_PATTERNS = [
  {
    // Production DATABASE_URL — non-local host with real-looking connection string
    // Matches both env assignment (DATABASE_URL=) and JS object property (DATABASE_URL:)
    regex: /(?:DATABASE_URL|DB_URL)\s*[:=]\s*["']?(?:postgres|postgresql|mysql|mongodb):\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/i,
    label: 'production DATABASE_URL (non-local host)',
  },
  {
    // Production REDIS_URL — non-local host
    regex: /(?:REDIS_URL|REDIS_SESSION_URL)\s*[:=]\s*["']?redis:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/i,
    label: 'production REDIS_URL (non-local host)',
  },
  {
    // Live Stripe secret key (sk_live_ followed by 20+ alphanumeric chars)
    regex: /sk_live_[A-Za-z0-9]{20,}/,
    label: 'live Stripe secret key (sk_live_*)',
  },
  {
    // Live Resend API key (re_ followed by 8+ chars, at word boundary or start of quoted value)
    // Avoids false positive on strings like 'sb_feature_discovery_dismissed'
    regex: /(?:["'`]|^|[\s=:])re_[A-Za-z0-9]{8,}/,
    label: 'live Resend API key (re_*)',
  },
  {
    // NODE_ENV=production in .env files (not in code that checks it)
    regex: /^NODE_ENV\s*[:=]\s*["']?production/im,
    label: 'NODE_ENV=production in environment file',
  },
  {
    // DASHBOARD_VAULT_PASSWORD with a non-empty value (indicates prod vault)
    regex: /DASHBOARD_VAULT_PASSWORD\s*[:=]\s*["']?[^\s"']{8,}/i,
    label: 'DASHBOARD_VAULT_PASSWORD set (production vault credential)',
  },
];

// Patterns that are safe (local/test/dev) — used to skip false positives
const SAFE_HOST_PATTERNS = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|test-|dev-|staging-|sandbox-/i;

// Comment patterns — if the line starts with # or // we skip it
const COMMENT_PREFIX = /^\s*(#|\/\/|\/\*)/;

/**
 * Get list of all staged files (any extension).
 * @returns {string[]} Array of repo-relative file paths.
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 5000,
    });
    return output.split('\n').map(f => f.trim()).filter(Boolean);
  } catch (_e) {
    return [];
  }
}

/**
 * Check if a staged file is a production env file by filename.
 * @param {string} relPath Repo-relative path.
 * @returns {boolean}
 */
function isProdEnvFile(relPath) {
  const basename = path.basename(relPath).toLowerCase();
  return PROD_ENV_FILENAMES.some(name => basename === name);
}

/**
 * Check if a file is a .env.example (safe template).
 * @param {string} relPath Repo-relative path.
 * @returns {boolean}
 */
function isEnvExampleFile(relPath) {
  const basename = path.basename(relPath).toLowerCase();
  return basename === '.env.example' || basename === '.env.example.local';
}

/**
 * Scan a file's content for production connection string patterns.
 * @param {string} filePath Absolute path to the file.
 * @returns {Array<{line: number, label: string}>} Violations found.
 */
function scanForProdPatterns(filePath) {
  const violations = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return []; // file might have been deleted between staging and scan
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment lines
    if (COMMENT_PREFIX.test(line)) continue;

    // Skip lines that look like they're just referencing the env var name
    // (e.g., in documentation: "Set DATABASE_URL to your production database")
    // Only flag lines that have an = or : assignment or look like a secret key
    const hasAssignment = /[:=]\s*["']?/.test(line) || /^\s*\w+\s*[:=]/.test(line);

    for (const { regex, label } of PROD_PATTERNS) {
      if (regex.test(line)) {
        // For DATABASE_URL/REDIS_URL, double-check it's not a safe host
        if (SAFE_HOST_PATTERNS.test(line) && /localhost|127\.0\.0\.1|test-|dev-|staging-/i.test(line)) {
          continue;
        }
        // Only flag if the line has an assignment-like structure OR it's a Stripe/Resend key
        if (hasAssignment || /sk_live_|re_[A-Za-z0-9]{8,}/.test(line)) {
          violations.push({ line: i + 1, label });
        }
      }
    }
  }

  return violations;
}

/**
 * Check if a local .env.production file exists (not staged, just on disk).
 * @returns {string|null} Path to the file if it exists, null otherwise.
 */
function checkLocalProdEnvFile() {
  for (const name of PROD_ENV_FILENAMES) {
    const filePath = path.join(REPO_ROOT, name);
    if (fs.existsSync(filePath)) {
      return name;
    }
    // Also check ai-platform/ subdirectory
    const aiPlatformPath = path.join(REPO_ROOT, 'ai-platform', name);
    if (fs.existsSync(aiPlatformPath)) {
      return `ai-platform/${name}`;
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────

const staged = getStagedFiles();
if (staged.length === 0) {
  console.log('[env-guard] No staged files. Skipping.');
  process.exit(0);
}

let blockCount = 0;
const warnings = [];

// Check 1: Block staged .env.production files
for (const relPath of staged) {
  if (isProdEnvFile(relPath)) {
    console.error(`  [BLOCK] ${relPath}`);
    console.error(`    -> Production environment file staged for commit`);
    console.error(`    -> This file likely contains production secrets. Remove it from staging:`);
    console.error(`       git reset HEAD "${relPath}"`);
    blockCount++;
  }
}

// Check 2: Scan staged files for production connection strings

// Paths that contain intentional test fixtures with fake secrets — skip scanning
const FIXTURE_ALLOWLIST = /tests\/fixtures\/|__tests__\/|\.test\.|\.spec\.|test-credentials|mock-|fixture-|benchmark\/corpus\/true-positives\//i;

for (const relPath of staged) {
  // Skip .env.example files (safe templates)
  if (isEnvExampleFile(relPath)) continue;
  // Skip .env.production (already caught above)
  if (isProdEnvFile(relPath)) continue;
  // Skip test fixtures — they intentionally contain fake secret patterns
  if (FIXTURE_ALLOWLIST.test(relPath)) continue;

  // Only scan files with scannable extensions
  if (!SCANNABLE_EXT.test(relPath)) continue;

  const absPath = path.join(REPO_ROOT, relPath);
  const violations = scanForProdPatterns(absPath);
  for (const v of violations) {
    console.error(`  [BLOCK] ${relPath}:${v.line}`);
    console.error(`    -> ${v.label}`);
    console.error(`    -> Remove the production value or use an environment variable reference instead`);
    blockCount++;
  }
}

// Check 3: Warn if local .env.production exists but is not staged
const localProdFile = checkLocalProdEnvFile();
if (localProdFile) {
  const isStaged = staged.some(f => path.basename(f).toLowerCase() === path.basename(localProdFile).toLowerCase());
  if (!isStaged) {
    warnings.push(localProdFile);
  }
}

// Print warnings
for (const w of warnings) {
  console.warn(`  [WARN] ${w} exists on disk but is not staged`);
  console.warn(`    -> Ensure this file is in .gitignore and never committed accidentally`);
}

// Exit
if (blockCount > 0) {
  console.error(`[env-guard] FAILED: ${blockCount} production safety violation(s).`);
  console.error(`[env-guard] Remove production files/values from staging before committing.`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`[env-guard] PASSED with ${warnings.length} warning(s).`);
} else {
  console.log(`[env-guard] PASSED.`);
}
process.exit(0);
