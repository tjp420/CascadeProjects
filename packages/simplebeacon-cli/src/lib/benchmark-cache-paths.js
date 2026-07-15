/**
 * Path filtering utilities for distinguishing Simplebeacon platform code
 * from OSS benchmark clones (github-cache/, java-ai-vulnerable/) and test noise.
 *
 * @module benchmark-cache-paths
 */

'use strict';

/**
 * Normalize a file path for consistent matching.
 * @param {string} filePath
 * @returns {string} Forward-slashed, lower-cased path.
 */
function normalizeRel(filePath) {
    return String(filePath || '').replace(/\\/g, '/').toLowerCase();
}

// -- Benchmark cache markers --
const BENCHMARK_PATH_FRAGMENTS = [
    '/github-cache/',
    'github-cache/',
    '/java-ai-vulnerable/',
    'java-ai-vulnerable/'
];

/**
 * Check if a path lives inside a benchmark clone directory.
 * @param {string} filePath
 * @returns {boolean}
 */
function isExternalBenchmarkCachePath(filePath) {
    const rel = normalizeRel(filePath);
    return BENCHMARK_PATH_FRAGMENTS.some((frag) => rel.includes(frag));
}

/**
 * Alias for {@link isExternalBenchmarkCachePath}.
 * @param {string} filePath
 * @returns {boolean}
 */
const isBenchmarkScanTargetRoot = isExternalBenchmarkCachePath;

// -- Exclusion patterns for credential scanning --
const EXCLUDED_CREDENTIAL_PATTERNS = [
    // Benchmark caches (handled first)
    { type: 'benchmark', fn: isExternalBenchmarkCachePath },
    // Specific files
    { type: 'literal', test: 'credential-incident-triage.json' },
    { type: 'literal', test: 'LICENSES.chromium.html' },
    // Vendor / build artifacts
    { type: 'regex', pattern: /\.vscode-test\// },
    { type: 'regex', pattern: /\/node_modules\// },
    { type: 'regex', pattern: /^node_modules\// },
    { type: 'regex', pattern: /(?:^|\/)(dist|build|out)\// },
    // Test directories
    { type: 'regex', pattern: /^tests\// },
    { type: 'regex', pattern: /\/tests\// },
    { type: 'regex', pattern: /^test\// },
    { type: 'regex', pattern: /\/fixtures\// },
    { type: 'regex', pattern: /\/__tests__\// },
    // Simplebeacon internals
    { type: 'regex', pattern: /\/\.simplebeacon\// },
    { type: 'regex', pattern: /^\.simplebeacon\// },
    // Complete-scan artifacts
    { type: 'regex', pattern: /\/complete-scan-latest\.json/ },
    { type: 'regex', pattern: /\/complete-scan-post-/ },
    // Deliverables / docs
    { type: 'regex', pattern: /\/deliverables\// },
    { type: 'regex', pattern: /^deliverables\// },
    { type: 'regex', pattern: /\/docs\/.*\.md$/ },
    // Rule test suites
    { type: 'regex', pattern: /\/simplebeacon-rule-tests\// },
    { type: 'regex', pattern: /^simplebeacon-rule-tests\// },
];

/**
 * Check if a path should be excluded from credential scanning.
 * @param {string} filePath
 * @returns {boolean}
 */
function isExcludedCredentialScanPath(filePath) {
    const rel = normalizeRel(filePath);
    for (const rule of EXCLUDED_CREDENTIAL_PATTERNS) {
        if (rule.type === 'benchmark' && rule.fn(rel)) return true;
        if (rule.type === 'literal' && rel.includes(rule.test)) return true;
        if (rule.type === 'regex' && rule.pattern.test(rel)) return true;
    }
    return false;
}

/**
 * Check if an issue is a Jest baseline / suite mismatch.
 * @param {Object} issue
 * @returns {boolean}
 */
function isJestBaselineIssue(issue) {
    const type = String(issue?.type || '');
    const filePath = String(issue?.filePath || issue?.file || '');
    return /^jest$/i.test(filePath) || /jest baseline|jest suite mismatch/i.test(type);
}

/**
 * Collect all path strings from an issue object.
 * @param {Object} issue
 * @returns {string[]}
 */
function collectIssuePaths(issue) {
    if (!issue) return [];
    const paths = [];
    if (issue.filePath) paths.push(issue.filePath);
    if (issue.file) paths.push(issue.file);
    if (Array.isArray(issue.filePaths)) {
        for (const p of issue.filePaths) if (p) paths.push(p);
    }
    if (Array.isArray(issue.affectedFiles)) {
        for (const p of issue.affectedFiles) if (p) paths.push(p);
    }
    return paths;
}

/**
 * Check if an issue touches any excluded path.
 * @param {Object} issue
 * @returns {boolean}
 */
function issueTouchesExcludedPath(issue) {
    if (isJestBaselineIssue(issue)) return false;
    const paths = collectIssuePaths(issue);
    return paths.some(isExcludedCredentialScanPath);
}

/**
 * Check if an issue touches a benchmark cache directory.
 * @param {Object} issue
 * @returns {boolean}
 */
function issueTouchesBenchmarkCache(issue) {
    const paths = collectIssuePaths(issue);
    return paths.some(isExternalBenchmarkCachePath);
}

/**
 * Partition issues into platform, benchmark-cache, and excluded-noise buckets.
 * @param {Object[]} [issues=[]]
 * @returns {{platformIssues: Object[], benchmarkCacheIssues: Object[], excludedScanNoiseIssues: Object[]}}
 */
function partitionBenchmarkIssues(issues = []) {
    const platformIssues = [];
    const benchmarkCacheIssues = [];
    const excludedScanNoiseIssues = [];
    for (const issue of issues) {
        if (issueTouchesBenchmarkCache(issue)) {
            benchmarkCacheIssues.push(issue);
        } else if (issueTouchesExcludedPath(issue)) {
            excludedScanNoiseIssues.push(issue);
        } else {
            platformIssues.push(issue);
        }
    }
    return { platformIssues, benchmarkCacheIssues, excludedScanNoiseIssues };
}

const MOCK_WALK_SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'coverage',
    'dist',
    'build',
    '.next',
    '.cache',
    '.simplebeacon',
    'security-reports',
    '.vscode-test'
]);

const FULL_SCAN_SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'coverage',
    'dist',
    'build',
    '.next',
    '.cache',
    '.simplebeacon',
    'security-reports'
]);

module.exports = {
    normalizeRel,
    isExternalBenchmarkCachePath,
    isBenchmarkScanTargetRoot,
    isExcludedCredentialScanPath,
    isJestBaselineIssue,
    issueTouchesBenchmarkCache,
    issueTouchesExcludedPath,
    partitionBenchmarkIssues,
    MOCK_WALK_SKIP_DIRS,
    FULL_SCAN_SKIP_DIRS
};
