/**
 * Type-safety scanner — detects `any` type annotations, @ts-ignore, and @ts-nocheck.
 * Ported from VS Code extension workspaceAnalyzer.ts for CLI parity.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  'archive',
  '.simplebeacon',
  'tests',
  'test',
  '__tests__',
  'fixtures',
  'docs',
  'coming-soon',
  'reports',
  'simplebeacon-rule-tests',
  'simplebeacon-toxic-fixtures',
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const RULES = [
  {
    id: 'SB-QUAL-001',
    name: 'Explicit any type annotation',
    regex: /:\s*any\b(?!\s*\[)/g,
    severity: 'low',
    description:
      'Using `any` bypasses TypeScript type checking — replace with a specific type or `unknown`',
    skipPatterns: [
      /:\s*any\b\s*\[/,
      /\/\/\s*simplebeacon-ignore\s+type-safety/i,
      /jest\.mock\s*\(/,
      /as\s+any\s*\)/,
    ],
  },
  {
    id: 'SB-QUAL-002',
    name: 'TypeScript error suppression',
    regex: /\/\/\s*@ts-ignore|\/\/\s*@ts-nocheck/g,
    severity: 'low',
    description:
      '@ts-ignore suppresses type errors without explanation — use @ts-expect-error with a reason comment',
    skipPatterns: [/\/\/\s*simplebeacon-ignore\s+type-safety/i, /\/\/\s*@ts-expect-error/i],
  },
];

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const firstDir = rel.split(/[/\\]/)[0];
  return SKIP_DIRS.has(firstDir);
}

async function scanFile(filePath, rootDir) {
  if (isExcludedPath(filePath, rootDir)) return null;
  if (!isScannable(filePath)) return null;

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

  const findings = [];

  for (const rule of RULES) {
    const matches = content.matchAll(rule.regex);
    for (const match of matches) {
      const snippet = content.substring(
        Math.max(0, match.index - 40),
        Math.min(content.length, match.index + match[0].length + 40)
      );

      if (rule.skipPatterns) {
        const shouldSkip = rule.skipPatterns.some((pat) => pat.test(snippet));
        if (shouldSkip) continue;
      }

      const line = content.substring(0, match.index).split('\n').length;
      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line,
        match: match[0],
        snippet: snippet.replace(/\s+/g, ' ').trim().slice(0, 120),
      });
    }
  }

  return findings.length ? findings : null;
}

async function scanTypeSafety(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || ['src', 'lib', 'server', 'web'];
  const productionPaths = options.productionPaths || sourcePaths;
  const pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];

  const files = [];
  for (const rel of pathsToWalk) {
    const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
    if (fs.existsSync(abs)) {
      await walkFiles(abs, files, { baseDir });
    }
  }

  const issues = [];
  for (const file of files) {
    const fileFindings = await scanFile(file.path, baseDir);
    if (!fileFindings) continue;

    const relativePath = path.relative(baseDir, file.path).split(path.sep).join('/');
    for (const f of fileFindings) {
      issues.push({
        id: `${f.ruleId}-${relativePath}-${f.line}`,
        severity: f.severity,
        type: f.ruleName,
        filePath: relativePath,
        file: relativePath,
        line: f.line,
        pattern: f.ruleId,
        count: 1,
        description: `${relativePath}:${f.line} ${f.ruleName}: ${f.match}`,
        recommendedAction:
          f.ruleId === 'SB-QUAL-001'
            ? 'Replace `any` with a specific type, `unknown`, or a branded type. If a generic constraint is needed, use `extends`.'
            : 'Remove @ts-ignore and fix the underlying type error, or replace with @ts-expect-error and add a reason comment.',
        affectedFiles: [relativePath],
        metadata: {
          ruleId: f.ruleId,
          match: f.match,
          snippet: f.snippet,
        },
      });
    }
  }

  return {
    scanned: files.length,
    findings: issues.length,
    issues,
    results: issues,
  };
}

async function walkFiles(dir, files, options = {}) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path
        .relative(options.baseDir || dir, full)
        .split(path.sep)
        .join('/');
      const firstDir = rel.split('/')[0];
      if (SKIP_DIRS.has(firstDir)) continue;
      if (entry.name.startsWith('.')) continue;
      await walkFiles(full, files, options);
    } else if (entry.isFile()) {
      files.push({
        path: full,
        relativePath: path
          .relative(options.baseDir || dir, full)
          .split(path.sep)
          .join('/'),
        ext: path.extname(full).toLowerCase(),
        size: (await fs.promises.stat(full)).size,
      });
    }
  }
}

module.exports = { scanTypeSafety, scanFile, RULES };
