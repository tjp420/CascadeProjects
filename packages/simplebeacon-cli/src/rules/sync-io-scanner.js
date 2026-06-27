/**
 * Sync I/O in async path scanner (SB-PERF-001).
 * Detects synchronous file system and child process calls
 * inside async contexts or request handlers.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rb'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures',
  'bin', 'scripts', 'cli'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const RULES = [
  {
    id: 'SB-PERF-001',
    name: 'Sync File I/O in Async Path',
    regex: /\b(fs\.)?readFileSync|writeFileSync|appendFileSync|copyFileSync|mkdirSync|readdirSync|statSync|accessSync|existsSync|unlinkSync|rmdirSync\b/g, // simplebeacon-ignore redos — scanner rule definition
    severity: 'medium',
    description: 'Synchronous file system call in what appears to be an async context — blocks the event loop',
    contextPatterns: [
      /\b(?:async\s+function|async\s*\(|\.then\s*\(|new\s+Promise|exports\.|module\.exports\s*=|app\.(get|post|put|delete|patch|use)|router\.|handler|controller)/i
    ]
  },
  {
    id: 'SB-PERF-001b',
    name: 'Sync Child Process in Async Path',
    regex: new RegExp('\\b(?:child_process\\.)?execSync|spawnSync|execFileSync\\b', 'g'), // simplebeacon-ignore redos — scanner rule definition
    severity: 'medium',
    description: 'Synchronous child process spawn in async context — blocks the event loop and hangs on long commands',
    contextPatterns: [
      /\b(?:async\s+function|async\s*\(|\.then\s*\(|new\s+Promise|exports\.|module\.exports\s*=|app\.|router\.)/i
    ]
  },
  {
    id: 'SB-PERF-001c',
    name: 'Sync I/O in Request Handler',
    regex: new RegExp('\\b(fs\\.)?readFileSync|writeFileSync|readdirSync|statSync|existsSync|execSync|spawnSync\\b', 'g'), // simplebeacon-ignore sync-io — scanner rule definition
    severity: 'high',
    description: 'Synchronous I/O inside an HTTP request handler — blocks all concurrent requests',
    handlerPatterns: [
      /\b(req,\s*res|request,\s*response|req\s*[,)]|res\.(send|json|status|render|redirect))/i,
      /\bapp\.(get|post|put|delete|patch)\s*\(/i,
      /\brouter\.(get|post|put|delete|patch)\s*\(/i
    ]
  }
];

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const firstDir = rel.split(/[/\\]/)[0];
  if (SKIP_DIRS.has(firstDir)) return true;
  if (/simplebeacon-cli[/\\]src[/\\](rules|lib)/.test(rel)) return true;
  return false;
}

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+sync-io/i;

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

  // File-level suppression: skip entire file if simplebeacon-ignore sync-io appears anywhere
  if (lines.some((line) => SUPPRESS_PATTERN.test(line))) return null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SUPPRESS_PATTERN.test(line)) continue;
    for (const rule of RULES) {
      if (!rule.regex.test(line)) continue;
      rule.regex.lastIndex = 0;

      // Check context: look at previous 5 lines for async context indicators
      const contextStart = Math.max(0, i - 5);
      const contextBlock = lines.slice(contextStart, i + 1).join('\n');

      let hasContext = false;
      if (rule.contextPatterns) {
        hasContext = rule.contextPatterns.some((pat) => pat.test(contextBlock));
      }
      if (rule.handlerPatterns) {
        hasContext = rule.handlerPatterns.some((pat) => pat.test(contextBlock));
      }

      if (!hasContext) continue;

      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line: i + 1,
        match: line.trim().slice(0, 80),
        snippet: line.replace(/\s+/g, ' ').trim().slice(0, 120)
      });
    }
  }

  return findings.length ? findings : null;
}

async function scanSyncIo(rootDir, options = {}) {
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
    rule: 'SYNC_IO_ASYNC_PATH',
    severity: results.length ? 'medium' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Synchronous I/O calls in async paths found in ${results.length} file(s). Use async equivalents (e.g., fs.promises.readFile) to avoid blocking the event loop.`
      : 'No synchronous I/O in async paths detected.'
  };
}

module.exports = { scanSyncIo, RULES };
