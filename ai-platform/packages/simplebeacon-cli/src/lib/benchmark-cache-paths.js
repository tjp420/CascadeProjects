/**
 * Paths under github-cache/ are OSS benchmark clones — not Simplebeacon platform product code.
 */

function normalizeRel(filePath) {
    return String(filePath || '').replace(/\\/g, '/').toLowerCase();
}

function isExternalBenchmarkCachePath(filePath) {
    const rel = normalizeRel(filePath);
    return rel.includes('/github-cache/') || rel.startsWith('github-cache/')
        || rel.includes('/java-ai-vulnerable/') || rel.startsWith('java-ai-vulnerable/');
}

/** Scan target root is a benchmark clone (github-cache or java-ai-vulnerable), not product code. */
function isBenchmarkScanTargetRoot(projectPath) {
    return isExternalBenchmarkCachePath(projectPath);
}

function isExcludedCredentialScanPath(filePath, options = {}) {
    const rel = normalizeRel(filePath);
    if (options.universal) {
        if (isExternalBenchmarkCachePath(rel)) return true;
        if (rel.includes('/simplebeacon-rule-tests/') || rel.startsWith('simplebeacon-rule-tests/')) return true;
        if (rel.includes('/marketing-content-test/') || rel.startsWith('marketing-content-test/')) return true;
        return false;
    }
    if (isExternalBenchmarkCachePath(rel)) return true;
    if (rel.includes('credential-incident-triage.json')) return true;
    if (/^tests\//.test(rel) || /\/tests\//.test(rel) || /^test\//.test(rel)) return true;
    if (/\/fixtures\//.test(rel) || /\/__tests__\//.test(rel)) return true;
    if (/\/\.simplebeacon\//.test(rel) || rel.startsWith('.simplebeacon/')) return true;
    if (rel.includes('/complete-scan-latest.json') || rel.includes('/complete-scan-post-')) return true;
    if (/\/deliverables\//.test(rel) || rel.startsWith('deliverables/')) return true;
    if (/\/docs\//.test(rel) && rel.endsWith('.md')) return true;
    if (rel.includes('/simplebeacon-rule-tests/') || rel.startsWith('simplebeacon-rule-tests/')) return true;
    if (rel.includes('/marketing-content-test/') || rel.startsWith('marketing-content-test/')) return true;
    if (rel.includes('/simplebeacon-frameworkless/') || rel.startsWith('simplebeacon-frameworkless/')) return true;
    return false;
}

function isJestBaselineIssue(issue) {
    const type = String(issue?.type || '');
    const filePath = String(issue?.filePath || issue?.file || '');
    return /^jest$/i.test(filePath) || /jest baseline|jest suite mismatch/i.test(type);
}

function issueTouchesExcludedPath(issue, options = {}) {
    if (isJestBaselineIssue(issue)) return false;
    const paths = [
        issue?.filePath,
        issue?.file,
        ...(issue?.filePaths || []),
        ...(issue?.affectedFiles || [])
    ].filter(Boolean);
    return paths.some((p) => isExcludedCredentialScanPath(p, options));
}

function issueTouchesBenchmarkCache(issue) {
    const paths = [
        issue?.filePath,
        issue?.file,
        ...(issue?.filePaths || []),
        ...(issue?.affectedFiles || [])
    ].filter(Boolean);
    return paths.some(isExternalBenchmarkCachePath);
}

function partitionBenchmarkIssues(issues = [], options = {}) {
    const platformIssues = [];
    const benchmarkCacheIssues = [];
    const excludedScanNoiseIssues = [];
    for (const issue of issues) {
        if (issueTouchesBenchmarkCache(issue)) {
            benchmarkCacheIssues.push(issue);
        } else if (issueTouchesExcludedPath(issue, options)) {
            excludedScanNoiseIssues.push(issue);
        } else {
            platformIssues.push(issue);
        }
    }
    return { platformIssues, benchmarkCacheIssues, excludedScanNoiseIssues };
}

const MOCK_WALK_SKIP_DIRS = new Set([]);

module.exports = {
    isExternalBenchmarkCachePath,
    isBenchmarkScanTargetRoot,
    isExcludedCredentialScanPath,
    isJestBaselineIssue,
    issueTouchesBenchmarkCache,
    issueTouchesExcludedPath,
    partitionBenchmarkIssues,
    MOCK_WALK_SKIP_DIRS
};
