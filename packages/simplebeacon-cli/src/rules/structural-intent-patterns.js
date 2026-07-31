/**
 * Full-repo structural intent scan when intelligence.enabled.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');
const {
  isIntelligenceAvailable,
  scanIntelligenceLayerAsync,
  runLocalSlmReview,
  getIntelligenceOptions,
} = require('../lib/intelligence-bridge');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app'];
const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.pyw',
  '.go',
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
  'deliverables',
  'github-cache',
  '.github-sync',
]);
const SCANNER_IMPL_RE = /(?:^|\/)packages\/simplebeacon-(?:cli|intelligence)\//i;
const MAX_SCAN_BYTES = 512000;

const RECOMMENDED_ACTIONS = {
  'SB-INTENT-001':
    'Replace AI boilerplate with real logic, error routing, and domain-specific naming',
  'SB-INTENT-002': 'Load secrets from vault/env; never commit placeholder credentials',
  'SB-INTENT-003':
    'Review for unchecked AI generation; consider intelligence.slm for local verification',
  'SB-INTENT-004': 'Add proper error handling or remove dead try/catch blocks',
};

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
  return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

function isExcludedPath(relativePath, options = {}) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
  if (/(?:^|\/)marketing-content-test\//.test(normalized)) return true;
  if (options.universal) {
    return false;
  }

  if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
  if (/\/tests?\//.test(normalized)) return true;
  if (SCANNER_IMPL_RE.test(normalized)) return true;
  return false;
}

async function walkFiles(dir, files, options) {
  const { baseDir, ignoreGlobs } = options;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = normalizeRel(baseDir, abs);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (isIgnored(rel, ignoreGlobs)) continue;
      await walkFiles(abs, files, options);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
    if (isExcludedPath(rel) || isIgnored(rel, ignoreGlobs)) continue;
    let stat;
    try {
      stat = await fs.promises.stat(abs);
    } catch {
      continue;
    }
    if (stat.size > MAX_SCAN_BYTES) continue;
    files.push({ path: abs, relativePath: rel });
  }
}

function toScanIssues(findings, relativePath) {
  return (findings || []).map((finding, index) => {
    const pattern = finding.pattern || finding.id || 'SB-INTENT-000';
    return {
      id: `structural-intent-${pattern}-${relativePath}-${index}`,
      severity: finding.severity || 'medium',
      type: 'Structural Intent',
      pattern,
      description: finding.description || finding.summary || `Structural intent rule ${pattern}`,
      recommendedAction:
        RECOMMENDED_ACTIONS[pattern] || finding.recommendedAction || 'Review and remediate',
      filePath: relativePath,
      count: 1,
      metadata: { ruleId: pattern, engine: finding.engine || null },
    };
  });
}

async function scanStructuralIntentPatterns(baseDir, options = {}) {
  const intelligence =
    options.intelligence || getIntelligenceOptions({ intelligence: options.intelligenceConfig });
  if (!intelligence?.enabled) {
    return {
      scanned: 0,
      findings: 0,
      issues: [],
      available: isIntelligenceAvailable(),
      enabled: false,
    };
  }
  if (!isIntelligenceAvailable()) {
    return {
      scanned: 0,
      findings: 0,
      issues: [],
      available: false,
      enabled: true,
      note: 'Install @simplebeacon/intelligence for structural intent analysis',
    };
  }

  const sourcePaths =
    intelligence.sourcePaths ||
    options.sourcePaths ||
    options.productionPaths ||
    DEFAULT_SOURCE_PATHS;
  const ignoreGlobs = options.ignoreGlobs || [];
  const files = [];
  for (const rel of sourcePaths) {
    const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
    if (fs.existsSync(abs)) {
      await walkFiles(abs, files, { baseDir, ignoreGlobs });
    }
  }

  const issues = [];
  const slmReviews = [];
  let engine = 'structural';
  const slmEnabled =
    intelligence.slm?.enabled === true || process.env.SIMPLEBEACON_SLM_ENABLED === '1';

  for (const file of files) {
    let content;
    try {
      content = await fs.promises.readFile(file.path, 'utf8');
    } catch {
      continue;
    }
    const result = await scanIntelligenceLayerAsync(content, {
      filePath: file.relativePath,
      enabled: true,
      intelligence,
    });
    if (result.engine && result.engine !== 'structural') engine = result.engine;
    const fileIssues = toScanIssues(result.findings, file.relativePath);
    const needsSlm =
      slmEnabled && fileIssues.some((i) => i.severity === 'high' || i.severity === 'critical');
    if (needsSlm) {
      const slm = runLocalSlmReview(content, { filePath: file.relativePath, intelligence });
      if (slm.reviewed) {
        slmReviews.push({ file: file.relativePath, risk: slm.risk, reason: slm.reason });
        for (const issue of fileIssues) {
          if (issue.severity === 'high' || issue.severity === 'critical') {
            issue.metadata = { ...issue.metadata, slmRisk: slm.risk, slmReason: slm.reason };
          }
        }
      } else if (slm.note || slm.error) {
        slmReviews.push({
          file: file.relativePath,
          risk: 'skipped',
          reason: slm.note || slm.error,
        });
      }
    }
    issues.push(...fileIssues);
  }

  return {
    scanned: files.length,
    findings: issues.length,
    issues,
    available: true,
    enabled: true,
    engine,
    slmEnabled,
    slmReviewCount: slmReviews.length,
    slmReviews,
    localOnly: true,
  };
}

module.exports = {
  scanStructuralIntentPatterns,
  RECOMMENDED_ACTIONS,
};
