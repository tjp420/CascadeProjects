/**
 * ReDoS (Regular Expression Denial of Service) scanner (SB-SEC-009).
 * Detects regex patterns with catastrophic backtracking potential:
 * nested quantifiers, unbounded groups, and polynomial-time patterns.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.php',
]);

const MAX_SCAN_BYTES = 512000;

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
  'analyzers',
  'rules',
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const REDOS_PATTERNS = [
  {
    id: 'SB-SEC-009',
    name: 'Nested Quantifiers — Catastrophic Backtracking',
    regex: /\([^)]*(?:\+|\*)\)(?:\+|\*|\{)/,
    severity: 'high',
    description:
      'Nested quantifiers like (a+)+ can cause exponential backtracking on malicious input',
    examples: ['(a+)+', '(a*)*', '([a-z]+)+'],
    skipPatterns: [/\[[^\]]+\]\+/, /&#x\[0-9a-fA-F\]\+;/i, /\d\+|\w\+|\s\+/],
  },
  {
    id: 'SB-SEC-009b',
    name: 'Alternation with Overlapping Quantifiers',
    regex: /\([^)]*\|[^)]*\)[+*?]{1,}/,
    severity: 'medium',
    description: 'Alternation groups with quantifiers can cause polynomial backtracking',
    examples: ['(a|a)+', '(ab|ba)*+'],
  },
  {
    id: 'SB-SEC-009c',
    name: 'Unbounded Repeated Group with Dot-Star',
    regex: /\(\.[+*?]\)[+*?]/,
    severity: 'high',
    description: 'Patterns like (.*)+ cause catastrophic backtracking on long inputs',
    examples: ['(.*)+', '(.+)*', '(.?)+'],
  },
  {
    id: 'SB-SEC-009d',
    name: 'Lookahead with Quantifier Inside',
    regex: /\(\?=.*[+*?].*\)/,
    severity: 'medium',
    description: 'Lookahead containing quantifiers can cause performance degradation',
    examples: ['(?=.*abc)', '(?=a+)'],
  },
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

function extractRegexLiterals(content) {
  const regexes = [];
  // JavaScript/TypeScript regex literals
  const jsMatches = content.matchAll(/\/(?:[^\n/\\]|\\.)+\/[gimsuvdy]*/g);
  for (const m of jsMatches) {
    const s = m[0];
    // Skip string concatenation patterns: '/td><td>'+escapeHtml(...)+'</'
    if (/^\/[^/]*['"`][\s+]|['"`][\s+]+\+$/.test(s)) continue;
    // Skip patterns that are clearly HTML tags (start with /<)
    if (/^\/<[a-zA-Z]/.test(s)) continue;
    regexes.push(s);
  }
  // RegExp constructor
  const regExpMatches = content.matchAll(/new\s+RegExp\s*\(\s*['"`]([^'"`]+)['"`]/g);
  for (const m of regExpMatches) regexes.push(m[1]);
  // Python re.compile
  const pyMatches = content.matchAll(/re\.compile\s*\(\s*['"""]([^'"""]+)['"""]/g);
  for (const m of pyMatches) regexes.push(m[1]);
  return regexes;
}

async function scanFile(filePath) {
  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    return null;
  }
  if (stats.size > MAX_SCAN_BYTES) return null;

  let content;
  try {
    content = await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+redos/i;

  // File-level suppression: skip entire file if simplebeacon-ignore redos appears anywhere
  if (content.split('\n').some((line) => SUPPRESS_PATTERN.test(line))) return null;

  const regexes = extractRegexLiterals(content);
  const findings = [];

  for (const regexStr of regexes) {
    const lineIndex = content.indexOf(regexStr);
    const line = lineIndex >= 0 ? content.substring(0, lineIndex).split('\n').length : 0;
    const lineText = content.split('\n')[line - 1] || '';
    if (SUPPRESS_PATTERN.test(lineText)) continue;

    for (const rule of REDOS_PATTERNS) {
      if (rule.regex.test(regexStr)) {
        rule.regex.lastIndex = 0;
        // Skip safe patterns
        if (rule.skipPatterns) {
          const shouldSkip = rule.skipPatterns.some((pat) => pat.test(regexStr));
          if (shouldSkip) continue;
        }
        // Skip simple character-class quantifiers: ([a-z]+), ([0-9]+)
        if (/\[[^\]]+\]\+\)/.test(regexStr) && !/\)\+\)/.test(regexStr)) continue;
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          line,
          match: regexStr.slice(0, 60),
          snippet: `Regex: ${regexStr.slice(0, 80)} — ${rule.description}`,
        });
      }
    }
  }

  return findings.length ? findings : null;
}

async function scanReDoS(rootDir, options = {}) {
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
          findings: fileFindings,
        });
      }
    }
  }

  return {
    rule: 'REDOS_RISK',
    severity: results.length ? 'high' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `ReDoS-risk regex patterns found in ${results.length} file(s). Review patterns with nested quantifiers — they can be exploited for denial of service.`
      : 'No ReDoS-risk regex patterns detected.',
  };
}

module.exports = { scanReDoS, REDOS_PATTERNS };
