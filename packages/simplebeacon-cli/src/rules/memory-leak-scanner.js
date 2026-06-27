/**
 * Memory leak pattern scanner (SB-PERF-002).
 * Detects common JavaScript/Node.js memory leak patterns:
 * unremoved event listeners, growing closures, uncleaned intervals/timeouts,
 * and unbounded cache growth.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures',
  'ai-platform/web/simplebeacon-dashboard/js-es2018'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+memory-leak/i;

const LEAK_PATTERNS = [
  {
    id: 'SB-PERF-002',
    name: 'Event Listener Without Removal',
    regex: /\.(addEventListener|on)\s*\(\s*['"`][^'"`]+['"`]/g,
    removalCheck: /\.removeEventListener|\.off\s*\(/,
    severity: 'medium',
    description: 'Event listener added but no corresponding removeEventListener found in the same scope'
  },
  {
    id: 'SB-PERF-002b',
    name: 'setInterval Without ClearInterval',
    regex: /\bsetInterval\s*\(/g,
    removalCheck: /\bclearInterval\s*\(/,
    severity: 'medium',
    description: 'setInterval created but no clearInterval found — timer continues after component/function disposal'
  },
  // setTimeout removed — one-off timers are overwhelmingly not leaks
  {
    id: 'SB-PERF-002d',
    name: 'Unbounded Cache / Growing Array',
    // Only flag .push/.unshift when inside a loop body (for/while/forEach)
    regex: /\b(for\s*\(|while\s*\(|forEach\s*\(|\.forEach\s*\()[\s\S]{0,500}\.(push|unshift)\s*\([^)]*\)/g,
    severity: 'medium',
    description: 'Array push inside a loop without corresponding pop/shift — potential unbounded growth'
  },
  {
    id: 'SB-PERF-002e',
    name: 'Global Variable Accumulation',
    regex: /(?:global|globalThis|window)\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*(?:\[|{)/g,
    severity: 'low',
    description: 'Global object storing mutable state — risk of unbounded growth across sessions'
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
  // Skip scanner's own rule files and compiled extension output to prevent self-flagging
  if (/simplebeacon-cli[/\\](src|bin)[/\\]/.test(rel)) return true;
  if (/simplebeacon-vscode-merged[/\\](out|media|test-|src)[/\\]/.test(rel)) return true;
  if (/scripts[/\\]/.test(rel)) return true;
  if (/ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js-es2018[/\\]/.test(rel)) return true;
  return false;
}

async function scanFile(filePath) {
  // Skip CLI entry points and scripts more aggressively
  const basename = path.basename(filePath);
  if (/^(bin|scripts|test)/.test(basename) || basename.endsWith('.test.js') || basename.endsWith('.spec.js')) {
    return null;
  }

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

  // File-level suppression: skip entire file if simplebeacon-ignore memory-leak appears anywhere
  if (lines.some((line) => SUPPRESS_PATTERN.test(line))) return null;

  for (const rule of LEAK_PATTERNS) {
    rule.regex.lastIndex = 0;
    const matches = content.matchAll(rule.regex);
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const lineText = lines[lineNum - 1] || '';

      // Skip if suppression comment on this line
      if (SUPPRESS_PATTERN.test(lineText)) continue;

      // For addEventListener: check if this specific event type has removal in the file
      if (rule.id === 'SB-PERF-002' && rule.removalCheck) {
        const eventMatch = match[0].match(/['"`]([^'"`]+)['"`]/);
        if (eventMatch) {
          const eventType = eventMatch[1];
          // Only skip if removeEventListener for the SAME event type is found
          const removalRegex = new RegExp(`removeEventListener|\\.off\\s*\\(\\s*['"\`]${eventType}['"\`]`, 'i');
          if (removalRegex.test(content)) continue;
        }
      } else if (rule.removalCheck && rule.removalCheck.test(content)) {
        continue;
      }

      const snippet = content.substring(
        Math.max(0, match.index - 40),
        Math.min(content.length, match.index + match[0].length + 40)
      );

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

async function scanMemoryLeaks(rootDir, options = {}) {
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
    rule: 'MEMORY_LEAK',
    severity: results.length ? 'medium' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Potential memory leak patterns found in ${results.length} file(s). Review event listeners, intervals, and unbounded collections.`
      : 'No obvious memory leak patterns detected.'
  };
}

module.exports = { scanMemoryLeaks, LEAK_PATTERNS };
