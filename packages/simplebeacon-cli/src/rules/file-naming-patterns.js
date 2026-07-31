/**
 * File naming analyzer — detects AI-generated or low-quality file names
 * that degrade code readability and program quality.
 *
 * Pattern categories:
 *   1. Copy/duplicate debris      — "file (2).js", "backup_final_v3.js"
 *   2. Generic placeholder names — "Untitled 1.js", "script.js", "new_file.js"
 *   3. LLM naming slop           — "optimized_final_actual.js", "helper_utility.js"
 *   4. Excessive version chains  — "app_v1_v2_final.js"
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.html',
  '.vue',
  '.svelte',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.css',
  '.scss',
]);

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
  'templates',
  'deployments',
  'public',
  'temp',
  'downloads',
  'findings',
  'simplebeacon-rule-tests',
  'simplebeacon-toxic-fixtures',
]);

const RULE_CATALOG = [
  {
    id: 'SB-FNAME-001',
    category: 'copy-debris',
    severity: 'medium',
    description:
      'File name contains copy/duplicate debris (e.g., "(2)", " - Copy", "backup_final_v3")',
  },
  {
    id: 'SB-FNAME-002',
    category: 'placeholder-name',
    severity: 'medium',
    description: 'Generic placeholder file name (e.g., "Untitled", "script", "new_file", "temp")',
  },
  {
    id: 'SB-FNAME-003',
    category: 'llm-naming-slop',
    severity: 'medium',
    description:
      'Suspicious AI-generated file name with redundant or vague terms (e.g., "optimized_final_actual", "helper_utility")',
  },
  {
    id: 'SB-FNAME-004',
    category: 'version-chain',
    severity: 'low',
    description: 'Excessive version suffix chain (e.g., "v1_v2_final", "final_final_v2")',
  },
];

// Regexes for each category
const COPY_DEBRIS_RE =
  /\s*\(\d+\)|\s+-\s*Copy\b|\s*-\s*copy\b|backup_\w*\d+|_bak\d*|_old\d*|_orig\d*/i;
const PLACEHOLDER_NAME_RE =
  /^(?:Untitled|untitled|script|Script|new_file|newFile|temp|tmp|foo|bar|baz|qux|something|thing|stuff|my_|old_|misc_|random_)/i;
const LLM_NAMING_SLOP_RE =
  /(?:optimized|final|actual|real|updated|correct|fixed|working|proper|corrected|helper|utility|utils|common|shared|base|core|generic|standard|default|misc|utils2?|helpers?|tools?)(?:_|\b)(?:optimized|final|actual|real|updated|correct|fixed|working|proper|corrected|helper|utility|utils|common|shared|base|core|generic|standard|default|misc)/i;
const VERSION_CHAIN_RE =
  /(?:v\d+|_v\d+|final|FINAL|real|REAL|actual|ACTUAL)(?:_|\b)(?:v\d+|final|FINAL|real|REAL|actual|ACTUAL)/i;

const ALLOWLIST = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'jsconfig.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  '.gitignore',
  '.env.example',
  '.eslintrc.json',
  '.prettierrc',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'rollup.config.js',
]);

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
  return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

function isExcludedPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
  if (/\/tests?\//.test(normalized)) return true;
  if (/\/fixtures?\//.test(normalized)) return true;
  if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
  if (/(?:^|\/)reports\//.test(normalized)) return true;
  if (/(?:^|\/)deliverables\//.test(normalized)) return true;
  if (/(?:^|\/)templates?\//.test(normalized)) return true;
  return false;
}

function suggestBetterName(basename) {
  // Strip debris suffixes
  let cleaned = basename
    .replace(/\s*\(\d+\)/g, '')
    .replace(/\s+-\s*Copy\b/gi, '')
    .replace(/\s*-\s*copy\b/gi, '')
    .replace(/_bak\d*/gi, '')
    .replace(/_old\d*/gi, '')
    .replace(/_orig\d*/gi, '')
    .replace(/backup_\w*\d+/gi, '');

  // Replace placeholder prefixes with semantic defaults
  const ext = path.extname(cleaned);
  const nameNoExt = path.basename(cleaned, ext);

  if (/^(?:Untitled|untitled)/.test(nameNoExt)) {
    return `module${ext}`;
  }
  if (/^(?:temp|tmp)/i.test(nameNoExt)) {
    return `temporary${ext}`;
  }
  if (/^(?:script)/i.test(nameNoExt)) {
    return `index${ext}`;
  }
  if (/^(?:new_file|newFile)/.test(nameNoExt)) {
    return `index${ext}`;
  }

  // Remove redundant chains
  cleaned = cleaned
    .replace(/_final/gi, '')
    .replace(/_actual/gi, '')
    .replace(/_real/gi, '')
    .replace(/_corrected?/gi, '')
    .replace(/_fixed/gi, '')
    .replace(/_working/gi, '')
    .replace(/_updated/gi, '')
    .replace(/_optimized/gi, '')
    .replace(/_v\d+/gi, '');

  // Deduplicate underscores
  cleaned = cleaned.replace(/_+/g, '_').replace(/^_/, '');

  if (cleaned === ext) {
    return `index${ext}`;
  }
  return cleaned;
}

function analyzeFileName(relativePath, severityDefault = 'medium') {
  const basename = path.basename(relativePath);
  const ext = path.extname(basename);
  const nameNoExt = path.basename(basename, ext);

  if (ALLOWLIST.has(basename)) return [];
  if (!SCANNABLE_EXTENSIONS.has(ext)) return [];

  const issues = [];

  // SB-FNAME-001: copy debris
  if (COPY_DEBRIS_RE.test(basename)) {
    issues.push({
      id: 'SB-FNAME-001',
      type: 'File Naming',
      severity: severityDefault,
      category: 'copy-debris',
      description: `File name contains copy/duplicate debris: "${basename}"`,
      file: relativePath,
      line: 1,
      suggestion: suggestBetterName(basename),
    });
  }

  // SB-FNAME-002: placeholder names
  if (PLACEHOLDER_NAME_RE.test(nameNoExt)) {
    issues.push({
      id: 'SB-FNAME-002',
      type: 'File Naming',
      severity: severityDefault,
      category: 'placeholder-name',
      description: `Generic placeholder file name: "${basename}"`,
      file: relativePath,
      line: 1,
      suggestion: suggestBetterName(basename),
    });
  }

  // SB-FNAME-003: LLM naming slop
  if (LLM_NAMING_SLOP_RE.test(nameNoExt) && !PLACEHOLDER_NAME_RE.test(nameNoExt)) {
    issues.push({
      id: 'SB-FNAME-003',
      type: 'File Naming',
      severity: severityDefault,
      category: 'llm-naming-slop',
      description: `Suspicious AI-generated file name: "${basename}"`,
      file: relativePath,
      line: 1,
      suggestion: suggestBetterName(basename),
    });
  }

  // SB-FNAME-004: version chain
  if (VERSION_CHAIN_RE.test(nameNoExt)) {
    const sev = severityDefault === 'low' ? 'low' : 'low';
    issues.push({
      id: 'SB-FNAME-004',
      type: 'File Naming',
      severity: sev,
      category: 'version-chain',
      description: `Excessive version suffix chain in file name: "${basename}"`,
      file: relativePath,
      line: 1,
      suggestion: suggestBetterName(basename),
    });
  }

  return issues;
}

async function scanFileNamingPatterns(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || [
    'src',
    'server',
    'lib',
    'packages',
    'app',
    'web',
    'api',
    'config',
  ];
  const ignoreGlobs = options.ignoreGlobs || [];
  const severityDefault = options.severity || 'medium';

  async function walk(dir, results = [], depth = 0) {
    if (depth > 8) return results;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(fullPath, results, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.size > 512000) continue;
        results.push({ path: fullPath, size: stat.size });
      } catch {
        /* skip */
      }
    }
    return results;
  }

  const files = [];
  for (const sp of sourcePaths) {
    const abs = path.resolve(baseDir, sp);
    const stat = await fs.promises.stat(abs).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;

    const walked = await walk(abs);
    for (const item of walked) {
      const relativePath = normalizeRel(baseDir, item.path);
      if (isExcludedPath(relativePath)) continue;
      if (isIgnored(relativePath, ignoreGlobs)) continue;

      files.push({ path: item.path, relativePath, size: item.size });
    }
  }

  // Also scan root-level files if not already covered
  const rootFiles = fs.readdirSync(baseDir);
  for (const f of rootFiles) {
    const abs = path.join(baseDir, f);
    if (!fs.statSync(abs).isFile()) continue;
    const ext = path.extname(f);
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
    const relativePath = normalizeRel(baseDir, abs);
    if (isExcludedPath(relativePath)) continue;
    if (isIgnored(relativePath, ignoreGlobs)) continue;
    files.push({ path: abs, relativePath, size: fs.statSync(abs).size });
  }

  const uniqueFiles = [];
  const seen = new Set();
  for (const f of files) {
    if (seen.has(f.relativePath)) continue;
    seen.add(f.relativePath);
    uniqueFiles.push(f);
  }

  const issues = [];
  for (const file of uniqueFiles) {
    issues.push(...analyzeFileName(file.relativePath, severityDefault));
  }

  return {
    scanned: uniqueFiles.length,
    findings: issues.length,
    issues,
    patterns: RULE_CATALOG.map((r) => r.id),
  };
}

module.exports = {
  RULE_CATALOG,
  scanFileNamingPatterns,
  analyzeFileName,
  suggestBetterName,
};
