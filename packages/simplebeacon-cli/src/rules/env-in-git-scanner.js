// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * .env in Git scanner (SB-SEC-008).
 * Detects .env files, secrets files, and credential configs
 * that are tracked by git (have an entry in .gitignore is missing).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.development$/,
  /^\.env\.production$/,
  /^\.env\.staging$/,
  /^\.env\.test$/,
  /^\.env\.example$/,
  /^\.env\.sample$/,
  /^\.env\.backup$/,
  /^\.env\.[0-9]{4}/,
  /\.key$/,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /credentials\.json$/,
  /secrets\.json$/,
  /secret\.(yaml|yml)$/,
  /aws_credentials$/,
  /service[_-]?account.*\.json$/,
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  'archive',
  '.simplebeacon',
  'fixtures',
  'docs',
  'coming-soon',
  'reports',
  'simplebeacon-rule-tests',
  'simplebeacon-toxic-fixtures',
  'New folder',
]);

function isEnvFile(basename) {
  return ENV_FILE_PATTERNS.some((pat) => pat.test(basename));
}

function isTrackedByGit(filePath) {
  try {
    execSync(`git check-ignore -q "${filePath}"`, {
      cwd: path.dirname(filePath),
      stdio: 'pipe',
      timeout: 5000,
    });
    return false; // File is ignored
  } catch {
    return true; // File is tracked or not in a git repo
  }
}

function parseGitignore(dirPath) {
  const gitignorePath = path.join(dirPath, '.gitignore');
  let entries = new Set();
  try {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      entries.add(trimmed.replace(/^\//, ''));
    }
  } catch {
    // No .gitignore
  }
  return entries;
}

function isGitignored(gitignoreEntries, relPath) {
  for (const entry of gitignoreEntries) {
    const pattern = entry.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${pattern}$|^${pattern}/|/${pattern}$|/${pattern}/`, 'i');
    if (regex.test(relPath)) return true;
    // Handle wildcard patterns like .env*
    if (entry.includes('*')) {
      const wildcardPattern = entry.replace(/\*/g, '.*');
      const wildcardRegex = new RegExp(`^${wildcardPattern}$`, 'i');
      if (wildcardRegex.test(path.basename(relPath))) return true;
    }
  }
  return false;
}

async function scanEnvInGit(rootDir, options = {}) {
  const findings = [];
  const skipDirs = new Set([...SKIP_DIRS, ...(options.skipDirs || [])]);
  const maxDepth = options.maxDepth ?? 30;

  const gitignoreEntries = parseGitignore(rootDir);

  const stack = [{ dir: path.resolve(rootDir), depth: 0 }];
  const visited = new Set();

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > maxDepth) continue;
    if (visited.has(dir)) continue;
    visited.add(dir);

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        stack.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isEnvFile(entry.name)) continue;

      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const isIgnored = isGitignored(gitignoreEntries, relPath);

      if (!isIgnored) {
        let tracked = false;
        try {
          tracked = isTrackedByGit(fullPath);
        } catch {
          // Not a git repo or git not available
        }

        findings.push({
          ruleId: 'SB-SEC-008',
          ruleName: tracked ? 'Secret File Tracked by Git' : 'Secret File Not Gitignored',
          severity: tracked ? 'critical' : 'high',
          line: 0,
          match: entry.name,
          snippet: `${relPath} is ${tracked ? 'tracked by git' : 'not gitignored'} — add to .gitignore and rotate any exposed secrets`,
          tracked,
          gitignored: isIgnored,
        });
      }
    }
  }

  return {
    rule: 'ENV_IN_GIT',
    severity: findings.length ? 'critical' : 'none',
    count: findings.length,
    fileCount: findings.length,
    results: findings.map((f) => ({
      filePath: path.join(rootDir, f.snippet.split(' ')[0]),
      findings: [f],
    })),
    humanReadable: findings.length
      ? `${findings.length} secret file(s) ${findings.some((f) => f.tracked) ? 'tracked by git' : 'not properly gitignored'}. Add to .gitignore immediately and rotate exposed credentials.`
      : 'No secret files detected outside .gitignore.',
  };
}

module.exports = { scanEnvInGit, isEnvFile, parseGitignore };
