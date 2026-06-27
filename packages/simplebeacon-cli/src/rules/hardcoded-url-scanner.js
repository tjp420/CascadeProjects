/**
 * Hardcoded IP / URL scanner (SB-SEC-005).
 * Detects hardcoded IP addresses, localhost references, staging/dev URLs,
 * and internal service endpoints in production source.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.java', '.rb', '.php'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'docs',
  'coming-soon', 'reports', 'security-reports', 'templates', 'data-central',
  'deployments', 'public', 'functions', 'cloudflare-deploy', 'temp', 'tests-legacy',
  '.github-sync', '.cursor', '.vscode', 'downloads', 'findings',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+hardcoded-url/i;

const RULES = [
  {
    id: 'SB-SEC-005',
    name: 'Hardcoded IP Address',
    regex: /\b(?:25[0-5]|2[0-4]\d|1\d{1,2}|\d{1,2})\.(?:25[0-5]|2[0-4]\d|1\d{1,2}|\d{1,2})\.(?:25[0-5]|2[0-4]\d|1\d{1,2}|\d{1,2})\.(?:25[0-5]|2[0-4]\d|1\d{1,2}|\d{1,2})\b/g,
    severity: 'medium',
    description: 'Hardcoded IPv4 address — may reference dev/staging/internal infrastructure',
    skipPatterns: [
      /\b0\.0\.0\.0\b/,
      /\b127\.0\.0\.1\b/,
      /\b255\.255\.255\.255\b/
    ]
  },
  {
    id: 'SB-SEC-005b',
    name: 'Hardcoded Localhost / Dev URL',
    regex: /(?:https?:\/\/|wss?:\/\/|\s|=)(localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{2,5})?(?:\/[^\s"'`,;})\]]*)?/gi,
    severity: 'low',
    description: 'Localhost or loopback URL — ensure this is gated by environment and not used in production builds',
    skipPatterns: [
      /\/\/\s*localhost/i,
      /127\.0\.0\.1:\d+\/(health|ready|ping|status|metrics)/i,
      /localhost:\d+\/(health|ready|ping|status|metrics)/i,
      /test|spec|fixture|mock/i
    ]
  },
  {
    id: 'SB-SEC-005c',
    name: 'Hardcoded Staging / Internal URL',
    regex: /(?:https?:\/\/|wss?:\/\/|\s|=)(?:staging|dev|test|uat|qa|internal|private|intranet|api-staging|api-dev|dev-api|staging-api)\.[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/[^\s"'`,;})\]]*)?/gi,
    severity: 'medium',
    description: 'Staging, dev, or internal domain — risk of production code hitting non-prod endpoints',
    skipPatterns: [
      /\/\/\s*(?:staging|dev|test)/i,
      /process\.env\./i,
      /config\./i
    ]
  }
];

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  if (basename === '.env' || basename.startsWith('.env.')) return false;
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const firstDir = rel.split(/[/\\]/)[0];
  return SKIP_DIRS.has(firstDir);
}

async function scanFile(filePath) {
  let stats;
  try { stats = await fs.promises.stat(filePath); } catch { return null; }
  if (stats.size > MAX_SCAN_BYTES) return null;

  let content;
  try {
    content = await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const findings = [];
  const lines = content.split('\n');

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    const matches = content.matchAll(rule.regex);
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const lineText = lines[lineNum - 1] || '';

      // Skip if suppression comment on this line
      if (SUPPRESS_PATTERN.test(lineText)) continue;

      const snippet = content.substring(
        Math.max(0, match.index - 40),
        Math.min(content.length, match.index + match[0].length + 40)
      );

      if (rule.skipPatterns) {
        const shouldSkip = rule.skipPatterns.some((pat) => pat.test(snippet));
        if (shouldSkip) continue;
      }

      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line: lineNum,
        match: match[0],
        snippet: snippet.replace(/\s+/g, ' ').trim().slice(0, 120)
      });
    }
  }

  return findings.length ? findings : null;
}

async function scanHardcodedUrls(rootDir, options = {}) {
  const results = [];
  const skipDirs = new Set([...SKIP_DIRS, ...(options.skipDirs || [])]);
  const maxDepth = options.maxDepth ?? 30;

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
      if (!isScannable(fullPath)) continue;
      if (isExcludedPath(fullPath, rootDir)) continue;

      const fileFindings = await scanFile(fullPath);
      if (fileFindings) {
        results.push({
          filePath: fullPath,
          findings: fileFindings
        });
      }
    }
  }

  return {
    rule: 'HARD_CODED_URL',
    severity: results.length ? 'medium' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Hardcoded IP/URL references found in ${results.length} file(s). Review for dev/staging/internal endpoint leakage.`
      : 'No hardcoded IP/URL references detected.'
  };
}

module.exports = { scanHardcodedUrls, RULES };
