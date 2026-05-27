/**
 * Unified file audit context — test/doc/example/production classification
 * and finding filter/severity adjustment.
 */

const TEST_PATH_HINTS = [
    '/test/', '/tests/', '/__tests__/', '.test.', '.spec.', '/fixtures/', '/fixture/',
    '/conftest.', '/pytest/', '/mocks/', '/mock/'
];
const EXAMPLE_PATH_HINTS = ['/examples/', '/example/', '/demo/', '/samples/', '/sample-data/'];
const DOC_PATH_HINTS = ['/docs/', '/documentation/', '/doc/'];
const PRODUCTION_DIR_HINTS = ['server/', 'src/', 'packages/', 'app/', 'lib/'];
const NON_PRODUCTION_PATH_HINTS = [
    '/test/', '/tests/', '/__tests__/', '.test.', '.spec.',
    '/fixtures/', '/fixture/', '/mock/', '/mocks/', '/docs/', '/examples/',
    '/storybook/', '/scripts/', '/dev/', '/demo/', '.original.'
];

function normalizeAuditPath(relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    if (idx >= 0) return rel.slice(idx + marker.length);
    return rel;
}

function resolveFileAuditContext(relativePath, hooks = {}) {
    const rel = normalizeAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    const isTestFile = TEST_PATH_HINTS.some((hint) => rel.includes(hint))
        || /^test_.*\.py$/i.test(basename)
        || basename === 'conftest.py'
        || /\.(test|spec)\.[jt]s$/i.test(basename);
    const isExampleFile = EXAMPLE_PATH_HINTS.some((hint) => rel.includes(hint))
        || /\bdemo\b/i.test(basename)
        || /\bsample\b/i.test(basename);
    const isDocumentation = DOC_PATH_HINTS.some((hint) => rel.includes(hint))
        || /\.(md|markdown|rst)$/i.test(basename);
    const isProduction = typeof hooks.isProductionPath === 'function'
        ? hooks.isProductionPath(relativePath)
        : PRODUCTION_DIR_HINTS.some((hint) => rel.startsWith(hint) || rel.includes(`/${hint}`));
    const isNonProduction = typeof hooks.isNonProductionPath === 'function'
        ? hooks.isNonProductionPath(relativePath)
        : NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint));
    const isMetaCatalogDoc = typeof hooks.isMetaCatalogDoc === 'function'
        ? hooks.isMetaCatalogDoc(relativePath)
        : false;

    return {
        relativePath: rel,
        basename,
        isTestFile,
        isExampleFile,
        isDocumentation,
        isProduction,
        isNonProduction,
        isMetaCatalogDoc
    };
}

function shouldIncludeFinding(finding, context) {
    if (context.isMetaCatalogDoc) return false;
    if (context.isTestFile && finding.category === 'debug-artifact') return false;
    if (context.isDocumentation && finding.category === 'debug-artifact') return false;
    if (context.isExampleFile && finding.category === 'meaningless-data') return false;
    if (String(finding.type || '').includes('production-leak') && !context.isProduction) return false;
    if (/^python-mock|^rust-test-only|^go-test-helper|^sql-seed-data/.test(String(finding.type || '')) && context.isTestFile) {
        return false;
    }
    return true;
}

function adjustFindingSeverity(finding, context) {
    if (context.isProduction) return finding;
    if (finding.category === 'debug-artifact' && finding.severity === 'medium') {
        return {
            ...finding,
            severity: 'low',
            metadata: { ...(finding.metadata || {}), contextAdjusted: 'non-production-path' }
        };
    }
    if (finding.category === 'tech-debt' && context.isTestFile && finding.severity === 'medium') {
        return {
            ...finding,
            severity: 'low',
            metadata: { ...(finding.metadata || {}), contextAdjusted: 'test-file' }
        };
    }
    return finding;
}

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
    applyContextToFindings
};
