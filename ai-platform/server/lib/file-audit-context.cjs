/**
 * Unified file audit context — test/doc/example/production classification
 * and finding filter/severity adjustment.
 *
 * @module server/lib/file-audit-context
 */

const TEST_PATH_HINTS = [
  '/test/',
  '/tests/',
  '/__tests__/',
  '.test.',
  '.spec.',
  '/fixtures/',
  '/fixture/',
  '/conftest.',
  '/pytest/',
  '/mocks/',
  '/mock/',
];
const EXAMPLE_PATH_HINTS = ['/examples/', '/example/', '/demo/', '/samples/', '/sample-data/'];
const DOC_PATH_HINTS = ['/docs/', '/documentation/', '/doc/'];
const PRODUCTION_DIR_HINTS = ['server/', 'src/', 'packages/', 'app/', 'lib/'];
const NON_PRODUCTION_PATH_HINTS = [
  '/test/',
  '/tests/',
  '/__tests__/',
  '.test.',
  '.spec.',
  '/fixtures/',
  '/fixture/',
  '/mock/',
  '/mocks/',
  '/docs/',
  '/examples/',
  '/storybook/',
  '/scripts/',
  '/dev/',
  '/demo/',
  '.original.',
];

/**
 * Normalize a relative path to forward slashes and strip the ai-platform/ prefix.
 * @param {string} relativePath
 * @returns {string}
 */
function normalizeAuditPath(relativePath) {
  const rel = String(relativePath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  const marker = 'ai-platform/';
  const idx = rel.indexOf(marker);
  if (idx >= 0) return rel.slice(idx + marker.length);
  return rel;
}

/**
 * Classify a file path into test, example, documentation, or production context.
 * @param {string} relativePath
 * @param {object} [hooks]
 * @param {Function} [hooks.isProductionPath]
 * @param {Function} [hooks.isNonProductionPath]
 * @param {Function} [hooks.isMetaCatalogDoc]
 * @returns {object} context — {relativePath, basename, isTestFile, isExampleFile, isDocumentation, isProduction, isNonProduction, isMetaCatalogDoc}
 */
function resolveFileAuditContext(relativePath, hooks = {}) {
  const rel = normalizeAuditPath(relativePath);
  const basename = rel.split('/').pop() || '';
  const isTestFile =
    TEST_PATH_HINTS.some((hint) => rel.includes(hint)) ||
    /^test_.*\.py$/i.test(basename) ||
    basename === 'conftest.py' ||
    /\.(test|spec)\.[jt]s$/i.test(basename);
  const isExampleFile =
    EXAMPLE_PATH_HINTS.some((hint) => rel.includes(hint)) ||
    /\bdemo\b/i.test(basename) ||
    /\bsample\b/i.test(basename);
  const isDocumentation =
    DOC_PATH_HINTS.some((hint) => rel.includes(hint)) || /\.(md|markdown|rst)$/i.test(basename);
  const isProduction =
    typeof hooks.isProductionPath === 'function'
      ? hooks.isProductionPath(relativePath)
      : PRODUCTION_DIR_HINTS.some((hint) => rel.startsWith(hint) || rel.includes(`/${hint}`));
  const isNonProduction =
    typeof hooks.isNonProductionPath === 'function'
      ? hooks.isNonProductionPath(relativePath)
      : NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint));
  const isMetaCatalogDoc =
    typeof hooks.isMetaCatalogDoc === 'function' ? hooks.isMetaCatalogDoc(relativePath) : false;

  return {
    relativePath: rel,
    basename,
    isTestFile,
    isExampleFile,
    isDocumentation,
    isProduction,
    isNonProduction,
    isMetaCatalogDoc,
  };
}

/**
 * Determine whether a finding should be reported given its file context.
 * @param {object} finding
 * @param {object} context
 * @returns {boolean}
 */
function shouldIncludeFinding(finding, context) {
  if (context.isMetaCatalogDoc) return false;
  if (context.isTestFile && finding.category === 'debug-artifact') return false;
  if (context.isDocumentation && finding.category === 'debug-artifact') return false;
  if (context.isExampleFile && finding.category === 'meaningless-data') return false;
  if (String(finding.type || '').includes('production-leak') && !context.isProduction) return false;
  if (
    /^python-mock|^rust-test-only|^go-test-helper|^sql-seed-data/.test(
      String(finding.type || '')
    ) &&
    context.isTestFile
  ) {
    return false;
  }
  // Backend .cjs files don't use React — skip PropTypes noise
  if (finding.type === 'missing-proptypes' && context.relativePath.endsWith('.cjs')) return false;
  // Config / route files don't need JSDoc on every helper
  if (finding.type === 'missing-jsdoc' && /server\/(config|api|lib)\//.test(context.relativePath))
    return false;
  // Shell scripts use echo/Write-Host by design — not debug artifacts
  if (finding.category === 'debug-artifact' && /\.(sh|ps1|bash|zsh)$/.test(context.relativePath))
    return false;
  // Markdown files contain code blocks by design — not fence leaks
  if (
    (finding.category === 'markdown-fence-leak' || finding.type === 'markdown-fence-in-code') &&
    /\.(md|markdown|rst)$/.test(context.relativePath)
  )
    return false;
  // Pattern-definition files contain TODO/FIXME/HACK/XXX as regex literals — not actual debt
  if (
    finding.category === 'tech-debt' &&
    /language-patterns\/|scanner-engine|scanner-patterns|test-all-patterns|file-quality-heuristics\.test|production-debug-guard/.test(
      context.relativePath
    )
  )
    return false;
  // Workspace health circular-import-risk is noise on barrel files and normal relative requires
  if (finding.category === 'workspace-health' && finding.type === 'circular-import-risk')
    return false;
  return true;
}

/**
 * Adjust a finding's severity based on its file context (e.g. lower severity in test files).
 * @param {object} finding
 * @param {object} context
 * @returns {object} adjustedFinding
 */
function adjustFindingSeverity(finding, context) {
  if (context.isProduction) return finding;
  if (finding.category === 'debug-artifact' && finding.severity === 'medium') {
    return {
      ...finding,
      severity: 'low',
      metadata: { ...(finding.metadata || {}), contextAdjusted: 'non-production-path' },
    };
  }
  if (finding.category === 'tech-debt' && context.isTestFile && finding.severity === 'medium') {
    return {
      ...finding,
      severity: 'low',
      metadata: { ...(finding.metadata || {}), contextAdjusted: 'test-file' },
    };
  }
  return finding;
}

/**
 * Filter and adjust findings for a given file path in one pass.
 * @param {object[]} findings
 * @param {string} relativePath
 * @param {object} [hooks]
 * @returns {object[]} filteredAndAdjustedFindings
 */
function applyContextToFindings(findings, relativePath, hooks = {}) {
  const context = resolveFileAuditContext(relativePath, hooks);
  return findings
    .filter((finding) => shouldIncludeFinding(finding, context))
    .map((finding) => adjustFindingSeverity(finding, context));
}

module.exports = {
  normalizeAuditPath,
  resolveFileAuditContext,
  shouldIncludeFinding,
  adjustFindingSeverity,
  applyContextToFindings,
};
