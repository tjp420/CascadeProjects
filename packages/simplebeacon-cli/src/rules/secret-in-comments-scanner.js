/**
 * Secret-in-comments scanner (SB-SEC-007).
 * Detects hardcoded credentials, API keys, passwords, and tokens
 * embedded in code comments (which bypass variable-based scanners).
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.java', '.rb', '.php',
  '.sh', '.bash', '.ps1', '.yaml', '.yml', '.json', '.md', '.env.example', '.env.local'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const COMMENT_PATTERNS = [
  /(?:^|\s)\/\/.*$/gm,    // JS/TS/C-style single-line (skip // inside URLs like http://)
  /\/\*[\s\S]*?\*\//g,   // JS/TS/C-style multi-line
  /<!--[\s\S]*?-->/g,    // HTML
  /\{\s*\/\/.*$/gm        // JSX inline
];

const SECRET_PATTERNS = [
  {
    id: 'SB-SEC-007',
    name: 'Secret in Comment — Password',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"`]?([^\s'"`,;})\]]{4,})/i,
    severity: 'high',
    description: 'Password value exposed in a comment — remove or rotate immediately'
  },
  {
    id: 'SB-SEC-007b',
    name: 'Secret in Comment — API Key',
    regex: /(?:api[_-]?key|apikey|api_token)\s*[:=]\s*['"`]?([a-zA-Z0-9_\-]{16,})/i,
    severity: 'high',
    description: 'API key exposed in a comment — remove and regenerate'
  },
  {
    id: 'SB-SEC-007c',
    name: 'Secret in Comment — Token',
    regex: /(?:token|auth_token|access_token|bearer)\s*[:=]\s*['"`]?([a-zA-Z0-9_\-]{16,})/i,
    severity: 'high',
    description: 'Authentication token exposed in a comment — remove and rotate'
  },
  {
    id: 'SB-SEC-007d',
    name: 'Secret in Comment — Secret Key',
    regex: /(?:secret[_-]?key|secretkey|client_secret)\s*[:=]\s*['"`]?([a-zA-Z0-9_\-]{16,})/i,
    severity: 'high',
    description: 'Secret key exposed in a comment — remove and regenerate'
  },
  {
    id: 'SB-SEC-007e',
    name: 'Secret in Comment — AWS Key',
    regex: /(?:AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})/i,
    severity: 'critical',
    description: 'AWS access key ID exposed in a comment — revoke immediately'
  },
  {
    id: 'SB-SEC-007f',
    name: 'Secret in Comment — Connection String',
    regex: /(?:mongodb|postgres|mysql|redis|amqp)[:\/][\/][^\s'"`,;})\]]{8,}/i,
    severity: 'high',
    description: 'Database connection string exposed in a comment — rotate credentials'
  }
];

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  if (basename === '.env.v1-internal' || /\.env\.(backup|old|bak|save|~)$/.test(basename)) return false;
  if (SCANNABLE_EXTENSIONS.has(ext)) return true;
  if (basename.startsWith('.env')) return true;
  if (basename.endsWith('.example')) return true;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return false;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '').replace(/\\/g, '/');
  const firstDir = rel.split(/[/\\]/)[0];
  if (SKIP_DIRS.has(firstDir)) return true;
  if (/social-posts\.md$/i.test(rel)) return true;
  if (/scan-wasm-bridge\.test\.js$/i.test(rel)) return true;
  if (/quick-actions\.js$/i.test(rel)) return true;
  return false;
}

function extractComments(content, ext) {
  const comments = [];

  if (ext === '.py' || ext === '.yaml' || ext === '.yml' || ext === '.sh' || ext === '.ps1') {
    const matches = content.matchAll(/#.*$/gm);
    for (const m of matches) comments.push(m[0]);
  } else if (ext === '.md') {
    const matches = content.matchAll(/<!--[\s\S]*?-->/g);
    for (const m of matches) comments.push(m[0]);
  } else {
    // JS/TS/C-style comments only — skip #.*$ to avoid matching # inside strings/URLs
    for (const pattern of COMMENT_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const m of matches) comments.push(m[0]);
    }
  }

  return comments;
}

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+secret-in-comments/i;

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

  // File-level suppression: skip entire file if simplebeacon-ignore secret-in-comments appears anywhere
  if (SUPPRESS_PATTERN.test(content)) return null;

  const ext = path.extname(filePath).toLowerCase();
  const comments = extractComments(content, ext);
  const findings = [];

  for (const comment of comments) {
    for (const rule of SECRET_PATTERNS) {
      const match = comment.match(rule.regex);
      if (match) {
        const lineIndex = content.indexOf(comment);
        const line = lineIndex >= 0 ? content.substring(0, lineIndex).split('\n').length : 0;
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          line,
          match: match[0].slice(0, 60),
          snippet: comment.replace(/\s+/g, ' ').trim().slice(0, 120)
        });
      }
    }
  }

  return findings.length ? findings : null;
}

async function scanSecretInComments(rootDir, options = {}) {
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
    rule: 'SECRET_IN_COMMENTS',
    severity: results.length ? 'high' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Secrets exposed in comments found in ${results.length} file(s). Comments are often overlooked during secret scanning.`
      : 'No secrets detected in comments.'
  };
}

module.exports = { scanSecretInComments, SECRET_PATTERNS };
