/**
 * Scan workspace mock/sample data directories for fiction, schema drift, and leaks.
 * simplebeacon:production-leak-intent — -sample.json is an exclusion suffix for
 * scan path filtering, not a production leak.
 * @module scan
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    validateSampleSchema,
    hashFileContent,
    findDuplicateContentGroups
} = require('./lib/mock-data-schema-validator');
const { PAGE_SAMPLE_SPECS } = require('./lib/page-sample-specs');
const { resolveSampleFilePath } = require('./lib/sample-path-resolver');
const { validateRoadmapFiles } = require('./lib/roadmap-json-specs');
const { checkSampleConsistency } = require('./lib/sample-consistency-checker');
const { scanCredentialPatterns } = require('./lib/credential-pattern-scanner');
const { scanProductionLeaks, globMatch } = require('./rules/production-leak');
const { scanSourceFictionPatterns } = require('./rules/fiction-kpi-patterns');
const { scanLlmSlopPatterns } = require('./rules/llm-slop-patterns');
const { scanAgencyHandoffPatterns } = require('./rules/agency-handoff-patterns');
const { scanEuAiActPatterns } = require('./rules/eu-ai-act-patterns');
const { scanOwaspLlmPatterns } = require('./rules/owasp-llm-patterns');
const { scanTokenBleedPatterns } = require('./rules/token-bleed-patterns');
const { scanArchitectureDriftPatterns } = require('./rules/architecture-drift-patterns');
const { scanSecurityPatterns } = require('./rules/security-pattern-scanner');
const { checkJestBaseline } = require('./rules/jest-baseline');
const { runFileReductionScan } = require('./lib/file-reduction-orchestrator');
const { scanHardcodedUrls } = require('./rules/hardcoded-url-scanner');
const { scanWeakCrypto } = require('./rules/weak-crypto-scanner');
const { scanSecretInComments } = require('./rules/secret-in-comments-scanner');
const { scanSyncIo } = require('./rules/sync-io-scanner');
const { scanEnvInGit } = require('./rules/env-in-git-scanner');
const { scanReDoS } = require('./rules/redos-scanner');
const { scanPiiLogging } = require('./rules/pii-logging-scanner');
const { scanDeadCode } = require('./rules/dead-code-scanner');
const { scanMemoryLeaks } = require('./rules/memory-leak-scanner');
const { scanTypeSafety } = require('./rules/type-safety-scanner');
const { scanHallucinatedImports } = require('./rules/hallucinated-import-scanner');
const { scanDependencyGraph } = require('./rules/dependency-graph-scanner');
const { scanAstStructural } = require('./rules/ast-structural-scanner');
const { scanComprehensive } = require('./rules/comprehensive-scanner');
const { scanCveDependencies } = require('./rules/cve-dependency-scanner');
const { generateSbom } = require('./rules/sbom-generator');
const { scanGitHistorySecrets } = require('./rules/git-history-secret-scanner');
const { scanDeploymentReadiness } = require('./rules/deployment-readiness-scanner');
const { scanCustomHeuristicRules } = require('./rules/custom-heuristic-scanner');
const { loadSimplebeaconConfig, resolveScanPaths, isRuleEnabled, getRuleOptions, sanitizeConfigForTier } = require('./config');
const { detectTier } = require('./lib/tier-detector');
const { checkLocalScanQuota, incrementLocalScan, incrementPipelineScan, isPipelineScan } = require('./lib/scan-usage-tracker');
const { resolvePlatformRoot, isIsolatedScanRoot } = require('./project-detect');
const { countRepositoryInventory } = require('./lib/repository-inventory');
const { normalizePathKey, displayRelativePath } = require('./lib/path-utils');
const { sanitizePath } = require('./lib/path-sanitizer');
const {
    partitionBenchmarkIssues,
    MOCK_WALK_SKIP_DIRS
} = require('./lib/benchmark-cache-paths');
const { normalizePlatformScanReport, reconcileScanReport } = require('./lib/normalize-scan-report');
const { evaluateGate } = require('./gate');
const { isBlockingIssue, groupIssues, countBySeverity, computeQualityScoreFromIssues } = require('./lib/issue-utils');
const { clearJsonFileCache } = require('./lib/json-file-cache');
const { ALL_EXTENSION_SET } = require('./lib/file-types');
const { LRUCache } = require('./lib/lru-cache');
const { formatBytes } = require('./lib/format-utils');
const { globToRegex, cachedGlobToRegex } = require('./lib/glob-utils');
const { createScanProgressWriter, resolveScanProgressPath } = require('./lib/scan-progress');

// Scan-session file content cache — eliminates redundant I/O when multiple rules read the same file
const fileContentCache = new LRUCache({ maxBytes: 256 * 1024 * 1024 });

/**
 * Read a file synchronously with caching.
 * @param {string} filePath
 * @returns {string}
 */
function readFileCached(filePath) {
    if (typeof filePath !== 'string') throw new TypeError('readFileCached expects a string path');
    const cached = fileContentCache.get(filePath);
    if (cached !== undefined) return cached;
    const content = fs.readFileSync(filePath, 'utf8');
    fileContentCache.set(filePath, content);
    return content;
}

/**
 * Read a file asynchronously with caching.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readFileCachedAsync(filePath) {
    if (typeof filePath !== 'string') throw new TypeError('readFileCachedAsync expects a string path');
    const cached = fileContentCache.get(filePath);
    if (cached !== undefined) return cached;
    const content = await fs.promises.readFile(filePath, 'utf8');
    fileContentCache.set(filePath, content);
    return content;
}

/**
 * Clear the scan-session file content cache.
 * @returns {void}
 */
function clearFileContentCache() {
    fileContentCache.clear();
}

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flv', '.webm',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.sqlite', '.db', '.lock',
    '.gguf', '.safetensors', '.pt', '.pth', '.onnx', '.model', '.weights',
    '.rlib', '.rmeta', '.o', '.a', '.lib',
    '.msi', '.deb', '.rpm', '.dmg', '.pkg', '.cab',
    '.bad', '.dat', '.dbf',
    '.tiff', '.tif', '.heic', '.heif', '.jxl', '.raw', '.cr2',
    '.nef', '.orf', '.sr2', '.dng', '.eps', '.psd', '.xcf',
    '.ogg', '.oga', '.ogv', '.flac', '.aac', '.m4a', '.wma',
    '.mid', '.midi', '.opus', '.m4v', '.wmv', '.swf', '.3gp', '.aiff',
    '.odt', '.ods', '.odp', '.epub', '.mobi', '.azw', '.azw3',
    '.parquet', '.avro', '.proto', '.accdb', '.mdb'
]);

/**
 * Count lines in a text file.
 * @param {string} filePath
 * @param {string} ext
 * @returns {Promise<number>}
 */
async function countFileLines(filePath, ext) {
    if (typeof filePath !== 'string') return 0;
    if (BINARY_EXTENSIONS.has(ext)) return 0;
    try {
        const content = await readFileCachedAsync(filePath);
        return content.length > 0 ? content.split('\n').length : 0;
    } catch {
        return 0;
    }
}

const EXT_CATEGORIES = {
    '.json': 'JSON Files',
    '.csv': 'CSV Files',
    '.xml': 'XML Files',
    '.sql': 'Database Files',
    '.db': 'Database Files',
    '.sqlite': 'Database Files',
    '.yaml': 'Config Files',
    '.yml': 'Config Files',
    '.txt': 'Text Files',
    '.md': 'Documentation Files'
};

/**
 * Deduplicate scanned files by normalized path key.
 * @param {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>} files
 * @returns {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>}
 */
function dedupeScannedFiles(files) {
    if (!Array.isArray(files)) return [];
    const seen = new Set();
    const unique = [];
    for (const file of files) {
        const key = normalizePathKey(file.path);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(file);
    }
    return unique;
}

/**
 * Load .simplebeaconignore patterns from a directory.
 * @param {string} root
 * @returns {string[]}
 */
function loadSimplebeaconIgnorePatterns(root) {
    if (typeof root !== 'string') return [];
    const ignorePath = path.join(root, '.simplebeaconignore');
    const patterns = [];
    try {
        const content = fs.readFileSync(ignorePath, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                patterns.push(trimmed.replace(/\\/g, '/'));
            }
        }
    } catch {
        // No .simplebeaconignore — that's fine
    }
    return patterns;
}

/**
 * Check if a relative path matches any ignore pattern.
 * @param {string} rel Relative path to check.
 * @param {string[]} ignorePatterns List of glob or literal ignore patterns.
 * @returns {boolean}
 */
function isIgnoredPath(rel, ignorePatterns) {
    if (!Array.isArray(ignorePatterns)) return false;
    return ignorePatterns.some((pat) => {
        const normalized = pat.replace(/\/$/, '');
        if (rel === pat || rel === normalized) return true;
        if (rel.startsWith(`${normalized}/`)) return true;
        return cachedGlobToRegex(pat).test(rel);
    });
}

/**
 * Search upward for any of the given file names, up to a max depth.
 * @param {ReadonlyArray<string>} names
 * @param {string} startDir
 * @param {number} [maxDepth=3]
 * @returns {boolean}
 */
function findFile(names, startDir, maxDepth = 3) {
    let dir = startDir;
    for (let depth = 0; depth < maxDepth; depth++) {
        for (const name of names) {
            if (fs.existsSync(path.join(dir, name))) return true;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return false;
}

/** License file names to look for. */
const LICENSE_NAMES = Object.freeze(['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'license.txt']);
/** Security file names to look for. */
const SECURITY_NAMES = Object.freeze(['SECURITY.md', 'SECURITY.txt', 'security.md', 'security.txt', 'SECURITY', 'security']);

/**
 * Check for LICENSE and SECURITY files in or near the project root.
 * @param {string} root Project root directory.
 * @returns {{licenseCount:number,securityCount:number,summary:null,remediation:null}}
 */
function resolveComplianceCounts(root) {
    if (typeof root !== 'string') return { licenseCount: 0, securityCount: 0, summary: null, remediation: null };
    return {
        licenseCount: findFile(LICENSE_NAMES, root) ? 1 : 0,
        securityCount: findFile(SECURITY_NAMES, root) ? 1 : 0,
        summary: null,
        remediation: null
    };
}

/**
 * Normalize and push scanner output into the issues array.
 * Handles both `{ issues: [...] }` and `{ results: [{ filePath, findings: [...] }] }` shapes.
 * @param {Array<Object>} issues Mutable issues accumulator.
 * @param {Object} scanResult Scanner output.
 * @param {string} [type] Issue type label (for findings shape).
 * @param {string} [defaultId] Default rule ID (for findings shape).
 * @param {string} [defaultDesc] Default description (for findings shape).
 * @param {string} [defaultSev='medium'] Default severity (for findings shape).
 * @param {string} [severityOverride] Optional severity to force on all direct issues.
 * @returns {void}
 */
// simplebeacon-ignore: mega-params — accepts multiple optional named parameters for backward-compatible caller convenience
function normalizeScannerOutput(issues, scanResult, type, defaultId, defaultDesc, defaultSev = 'medium', severityOverride) {
    if (!Array.isArray(issues) || !scanResult || typeof scanResult !== 'object') return;

    // Direct issues array
    if (scanResult.issues?.length) {
        if (severityOverride) {
            for (const issue of scanResult.issues) {
                issues.push({ ...issue, severity: severityOverride });
            }
        } else {
            issues.push(...scanResult.issues);
        }
        return;
    }

    // Results-with-findings shape
    if (!scanResult.results?.length) return;
    for (const r of scanResult.results) {
        for (const f of r.findings || []) {
            const sev = f.severity || defaultSev;
            issues.push({
                id: f.ruleId || defaultId,
                severity: { critical: 'medium', high: 'medium' }[sev] || sev,
                type,
                filePath: r.filePath,
                line: f.line,
                count: 1,
                description: f.snippet || f.description || defaultDesc,
                match: f.match
            });
        }
    }
}

/** Patterns for known false-positive suppression. */
const FP_PATH_PATTERNS = Object.freeze([
    { type: 'Duplicate Data', pathIncludes: ['simplebeacon-dashboard/js-es2018/', 'simplebeacon-dashboard/js/', 'simplebeacon-dashboard/data/', 'tsconfig.json', 'simplebeacon-vscode-merged/dashboard-web/data/', 'simplebeacon-vscode-merged/dashboard-web/js-es2018/utils-lib/', 'simplebeacon-dashboard/js/demo/', 'simplebeacon-vscode-merged/dashboard-web/js/demo/', 'coming-soon/public/dashboard/js/demo/', 'web/dashboard/js/utils-lib/', 'coming-soon/public/dashboard/trust-verification.json', 'simplebeacon-vscode-merged/dashboard-web/trust-verification.json'] },
    { type: 'Credential Pattern', pathIncludes: ['ai-agent-report-for-dashboard.json'] },
    { type: 'cleanup', pathIncludes: ['simplebeacon-dashboard/js-es2018/'] },
    { type: 'performance', pathIncludes: ['simplebeacon-dashboard/js-es2018/'] },
    { type: 'env-inconsistency', pathIncludes: ['.env.v1-internal'] },
    { type: 'unhandled-promise', pathIncludes: ['server/index.cjs'] },
    { type: 'unvalidated-redirect', pathIncludes: ['server/index.cjs'] },
    { type: 'missing-rate-limit', pathIncludes: ['server/index.cjs', 'server/bootstrap/phase2-integration.cjs', 'server/routes/ai-math-audit-route.cjs', 'server/routes/compliance-schema-api.cjs', 'server/routes/demo-simplebeacon-api.cjs', 'server/routes/eu-ai-act-audit-route.cjs', 'server/routes/flexible-analyze-api.cjs', 'server/routes/local-models-api.cjs', 'server/routes/mock-data-api.cjs', 'server/routes/realtime-analysis-api.cjs', 'server/routes/repository-scanner-api.cjs', 'server/lib/audit-booking-route.cjs', 'server/lib/data-cleanup-scan.cjs', 'server/lib/eu-ai-act-sprint-route.cjs', 'server/lib/operator-deliverable-route.cjs', 'server/lib/outreach-resend-webhook.cjs', 'server/lib/legacy-page-redirects.cjs', 'server/lib/outreach-route.cjs', 'server/lib/register-operator-routes.cjs', 'src/api/optimization-api.cjs', 'src/api/build-from-path-route.cjs', 'src/api/roadmap-analysis-history.cjs', 'src/api/simplebeacon-api.cjs', 'src/api/simplebeacon-billing-api.cjs', 'src/api/trust-api.cjs'] },
    { type: 'eval-danger', pathIncludes: ['server/lib/codebase-analyzer-patterns.cjs'] },
    { type: 'insecure-random', pathIncludes: ['server/lib/codebase-analyzer-patterns.cjs', 'server/routes/sso-routes.cjs', 'package-lock.json', '**/package-lock.json'] },
    { type: 'prototype-pollution', pathIncludes: ['server/lib/codebase-analyzer-helpers.cjs'] },
    { type: 'unvalidated-redirect', pathIncludes: ['server/routes/sso-routes.cjs', 'server/lib/legacy-page-redirects.cjs'] },
    { type: 'unhandled-promise', pathIncludes: ['server/api/assessment/index.cjs', 'server/lib/simplebeacon-subscription-store.cjs'] },
    { type: 'test-coverage', pathIncludes: ['', '/'] },
    { type: 'workspace-health', pathIncludes: ['', '/'] },
    { type: 'governance-marker', pathIncludes: ['', '/'] },
    { type: 'ai-indicators', pathIncludes: ['', '/'] },
    { type: 'i18n', pathIncludes: ['', '/'] },
    { type: 'documentation', pathIncludes: ['', '/'] },
    { type: 'governance', pathIncludes: ['', '/'] }
]);

/**
 * Known false positives to suppress from the issue list.
 * Only suppresses in specific file contexts, never blanket-suppresses entire rule types.
 * @param {{filePath?:string,file?:string,type?:string}} issue
 * @returns {boolean}
 */
function isKnownFalsePositive(issue) {
    if (!issue || typeof issue !== 'object') return false;
    const fp = ((issue.filePath || issue.file) || '').replace(/\\/g, '/');
    const type = issue.type || '';
    return FP_PATH_PATTERNS.some((rule) =>
        rule.type === type && rule.pathIncludes.some((sub) => fp.includes(sub))
    );
}

/**
 * Resolve files-scanned count from scanners reporting `.scanned` or `.results.length`.
 * @param {{scanned?:number,results?:Array<unknown>}} scan
 * @returns {number}
 */
function scannedCount(scan) {
    if (!scan || typeof scan !== 'object') return 0;
    return scan.scanned || (scan.results ? scan.results.length : 0) || 0;
}

/** Per-rule fallback defaults for scan results. */
const SCAN_RESULT_DEFAULTS = Object.freeze({
    roadmap: Object.freeze({ checked: 0, passed: 0, issues: [] }),
    consistency: Object.freeze({ checked: 0, passed: 0, score: null, issues: [] }),
    credentials: Object.freeze({ scanned: 0, findings: 0, issues: [] }),
    'production-leak': Object.freeze({ scanned: 0, findings: 0, issues: [] }),
    'fiction-kpi-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [], patterns: [] }),
    'llm-slop-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [], patterns: [] }),
    'agency-handoff-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [], patterns: [] }),
    'eu-ai-act-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [], summary: null, patterns: [] }),
    'jest-baseline': Object.freeze({ checked: false, passed: true, issues: [], summary: null }),
    'token-bleed-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [] }),
    'architecture-drift-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [] }),
    'security-patterns': Object.freeze({ scanned: 0, findings: 0, issues: [] }),
    'file-reduction': Object.freeze({ allFindings: [], findings: {}, summary: {} }),
    'dependency-graph': Object.freeze({ scanned: 0, findings: 0, issues: [], results: [] })
});

/** Generic fallback for scanners not in SCAN_RESULT_DEFAULTS. */
const SCAN_RESULT_SIMPLE_DEFAULTS = Object.freeze({ scanned: 0, findings: 0, issues: [], results: [] });

/**
 * Get a scan result from the resultMap with a key-appropriate fallback default.
 * @param {Map<string,Object>} resultMap
 * @param {string} key
 * @returns {Object}
 */
function _getScanResult(resultMap, key) {
    if (!(resultMap instanceof Map)) return {};
    if (typeof key !== 'string') return {};
    return resultMap.get(key) || SCAN_RESULT_DEFAULTS[key] || SCAN_RESULT_SIMPLE_DEFAULTS;
}

/**
 * Resolve findings count from scanners reporting `.findings` or `.count`.
 * @param {{findings?:number,count?:number}} scan
 * @returns {number}
 */
function findingsCount(scan) {
    if (!scan || typeof scan !== 'object') return 0;
    return scan.findings || scan.count || 0;
}

/**
 * Apply tier limits (max files, max findings, score visibility) to a scan report.
 * @param {Object} report
 * @param {Object} [options={}]
 * @param {string} [options.tier='developer']
 * @param {Object} [options.tierLimits={}]
 * @param {boolean} [options.sandboxMode=false]
 * @param {boolean} [options.active=false]
 * @param {string} [options.upgradeUrl]
 * @returns {Object} Mutated report.
 */
function applyTierLimits(report, options = {}) {
    if (!report || typeof report !== 'object') return {};
    const tier = options.tier || 'developer';
    const limits = options.tierLimits || {};
    const maxFiles = limits.maxFilesPerScan;
    const maxFindings = limits.maxFindingsShown;
    const showScore = limits.showQualityScore;
    const sandboxMode = options.sandboxMode === true;
    const upgradeUrl = options.upgradeUrl || 'https://simplebeacon.ai/pricing';

    if (typeof maxFiles === 'number' && maxFiles >= 0 && typeof report.totalFiles === 'number' && report.totalFiles > maxFiles) {
        report.filesAnalyzed = Math.min(report.filesAnalyzed || 0, maxFiles);
        report.ruleScopedFilesAnalyzed = Math.min(report.ruleScopedFilesAnalyzed || 0, maxFiles);
        report.totalFiles = maxFiles;
        report.sampleFiles = (report.sampleFiles || []).slice(0, maxFiles);
        report.tierLimitation = `Free tier limited to ${maxFiles} files. Upgrade to Pro for unlimited scans.`;
    }

    if (typeof maxFindings === 'number' && maxFindings >= 0 && Array.isArray(report.rawIssues)) {
        const truncated = report.rawIssues.length > maxFindings;
        report.rawIssues = report.rawIssues.slice(0, maxFindings);
        if (Array.isArray(report.detectedIssues)) {
            report.detectedIssues = report.detectedIssues.slice(0, maxFindings);
        }
        if (truncated) {
            report.tierFindingsLimitation = `Free tier shows ${maxFindings} findings. Upgrade to Pro to see all.`;
        }
    }

    if (showScore === false) {
        delete report.qualityScore;
        delete report.schemaCompliance;
        delete report.consistencyScore;
        report.qualityScoreHidden = true;
    }

    report.tier = tier;
    report.sandbox = {
        active: sandboxMode,
        upgradeUrl,
        message: sandboxMode ? 'Running in Sandbox Mode. Upgrade to unlock team tier features.' : undefined
    };
    if (report.scan_summary && typeof report.scan_summary === 'object') {
        report.scan_summary.sandbox = report.sandbox;
    }

    return report;
}

/**
 * Collect all findings from a report, flattening categories/findings if needed.
 * @param {Object} report
 * @returns {Array<Object>}
 */
function getReportFindings(report) {
    if (!report || typeof report !== 'object') return [];
    if (Array.isArray(report.rawIssues) && report.rawIssues.length > 0) return report.rawIssues;
    if (Array.isArray(report.findings) && report.findings.length > 0) return report.findings;
    if (Array.isArray(report.detectedIssues) && report.detectedIssues.length > 0) return report.detectedIssues;
    if (report.categories && typeof report.categories === 'object') {
        const all = [];
        for (const cat of Object.values(report.categories)) {
            if (cat && Array.isArray(cat.findings)) all.push(...cat.findings);
            else if (Array.isArray(cat)) all.push(...cat);
        }
        return all;
    }
    return [];
}

/**
 * Normalize a report finding into the internal issue shape.
 * @param {Object} finding
 * @returns {Object|null}
 */
function normalizeFinding(finding) {
    if (!finding || typeof finding !== 'object') return null;
    const severity = String(finding.severity || finding.severityBand || 'medium').toLowerCase();
    const type = finding.category || finding.type || 'finding';
    return {
        id: finding.id || null,
        type,
        severity,
        severityBand: severity,
        filePath: finding.file || finding.filePath || finding.path || null,
        file: finding.file || finding.filePath || finding.path || null,
        line: finding.line || null,
        description: finding.message || finding.description || finding.snippet || `${type} finding`,
        count: finding.count || 1,
        affectedFiles: finding.file ? [finding.file] : (finding.affectedFiles || []),
        filePaths: finding.file ? [finding.file] : (finding.filePaths || []),
        metadata: finding.metadata || {}
    };
}

/**
 * SimpleBeacon Global Gate Correction Loop
 * Ensures the gate reflects the full findings database, regardless of scope.
 * @param {Object} report
 * @param {Object} [gateConfig={}]
 * @returns {Object} Mutated report.
 */
function compileGateStatus(report, gateConfig = {}) {
    if (!report || typeof report !== 'object') return report;

    const allFindings = getReportFindings(report);
    const allIssues = allFindings.map(normalizeFinding).filter(Boolean);

    // Filter out informational issues so rawIssues, totalFindings, and severityCounts
    // all reflect the same set of actionable issues.
    const scoringIssues = allIssues.filter(isBlockingIssue);

    const failOn = Array.isArray(gateConfig.failOn) ? gateConfig.failOn : (gateConfig.failOn ? [gateConfig.failOn] : ['high']);
    const warnOn = Array.isArray(gateConfig.warnOn) ? gateConfig.warnOn : (gateConfig.warnOn ? [gateConfig.warnOn] : ['medium', 'low']);
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    const failWeights = failOn.map((s) => severityWeights[s.toLowerCase()] || 3).filter(Boolean);
    const targetWeight = failWeights.length ? Math.min(...failWeights) : 3;

    const blockingIssues = [];
    const warningIssues = [];
    for (const issue of scoringIssues) {
        const weight = severityWeights[issue.severity] || 1;
        if (weight >= targetWeight) {
            blockingIssues.push(issue);
        } else if (warnOn.includes(issue.severity)) {
            warningIssues.push(issue);
        }
    }

    const blockingCount = blockingIssues.reduce((sum, i) => sum + (i.count || 1), 0);
    const warningCount = warningIssues.reduce((sum, i) => sum + (i.count || 1), 0);
    const severityCounts = countBySeverity(scoringIssues);
    const qualityScore = computeQualityScoreFromIssues(scoringIssues, gateConfig);

    report.gate = {
        pass: blockingCount === 0,
        failOn,
        warnOn,
        blockingCount,
        warningCount,
        blockingIssues,
        warningIssues
    };

    report.scan_summary = report.scan_summary || {};
    report.scan_summary.status = blockingCount === 0 ? 'PASSED' : 'FAILED';
    report.scan_summary.block_merge = blockingCount > 0;
    report.scan_summary.total_risks_found = blockingCount;
    report.scan_summary.critical_severity_count = severityCounts.critical || 0;
    report.scan_summary.high_severity_count = severityCounts.high || 0;
    report.scan_summary.medium_severity_count = severityCounts.medium || 0;
    report.scan_summary.low_severity_count = severityCounts.low || 0;

    report.issueCount = blockingCount;
    report.severityCounts = severityCounts;
    if (report.summary && typeof report.summary === 'object') {
        report.summary.totalFindings = scoringIssues.length;
        report.summary.severityCounts = severityCounts;
    }

    report.qualityScore = qualityScore;
    report.rawIssues = scoringIssues;
    report.detectedIssues = groupIssues(scoringIssues).slice(0, 12);

    return reconcileScanReport(report);
}

/**
 * Resolve effective scan paths from config and extra paths.
 * @param {string} scanRoot The directory the user wants to scan.
 * @param {string} platformRoot Detected platform/monorepo root.
 * @param {Object} config Simplebeacon config object.
 * @param {string[]} [extraPaths=[]] Additional paths from CLI.
 * @returns {string[]} Absolute paths to scan.
 */
function resolveEffectiveScanPaths(scanRoot, platformRoot, config, extraPaths = []) {
    if (typeof scanRoot !== 'string' || typeof platformRoot !== 'string') return [];
    if (!config || typeof config !== 'object') return [scanRoot];
    if (config.fullDirectoryScan) {
        return [scanRoot];
    }

    const scanKey = normalizePathKey(scanRoot);
    const platformKey = normalizePathKey(platformRoot);

    if (scanKey === platformKey) {
        if (isIsolatedScanRoot(scanRoot)) {
            const hasConfiguredPaths = Array.isArray(config?.scanPaths) && config.scanPaths.length > 0;
            if (hasConfiguredPaths) {
                const paths = resolveScanPaths(scanRoot, config, extraPaths);
                if (paths.length) return paths;
            }
            return [scanRoot];
        }
        let paths = resolveScanPaths(platformRoot, config, extraPaths);
        paths = paths.filter((p) => normalizePathKey(p) !== platformKey);
        if (!paths.length) {
            paths = resolveScanPaths(platformRoot, config, []);
        }
        return paths;
    }
    if (scanKey.startsWith(`${platformKey}/`)) {
        return [scanRoot];
    }
    if (platformKey.startsWith(`${scanKey}/`)) {
        return resolveScanPaths(platformRoot, config, extraPaths);
    }
    // Scan root is outside platform root (e.g. sibling monorepo package) —
    // scope strictly to scanRoot so we don't leak platform files into the report.
    return [scanRoot, ...(extraPaths || [])];
}

/**
 * Compute the number of files analyzed across the most comprehensive scanners.
 * @param {number} mockCount
 * @param {Object} credentialScan
 * @param {Object} productionLeakScan
 * @param {Object} sourceFictionScan
 * @returns {number}
 */
function computeFilesAnalyzed(mockCount, credentialScan, productionLeakScan, sourceFictionScan) {
    return Math.max(
        mockCount || 0,
        credentialScan?.scanned || 0,
        productionLeakScan?.scanned || 0,
        sourceFictionScan?.scanned || 0
    );
}

/**
 * Recursively walk a directory and collect file entries.
 * @param {Object} opts
 * @param {string} opts.dir
 * @param {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>} [opts.results=[]]
 * @param {number} [opts.depth=0]
 * @param {string|null} [opts.rootDir=null]
 * @param {number} [opts.maxDepth=6]
 * @param {Set<string>} [opts.skipDirs]
 * @param {number} [opts.maxFiles=500000]
 * @param {boolean} [opts.quiet=false]
 * @param {Function} [opts.onProgress]
 * @returns {Promise<Array<{path:string,name:string,ext:string,size:number,relativePath:string}>>}
 */
const NODE_MODULES_RE = /(^|[\\/])node_modules([\\/]|$)/i;
const WALK_PROGRESS_EVERY = Number(process.env.SIMPLEBEACON_WALK_PROGRESS_EVERY) || 250;

function notifyWalkProgress(results, onProgress) {
    if (typeof onProgress !== 'function' || !results.length) return;
    if (results.length % WALK_PROGRESS_EVERY !== 0) return;
    try {
        onProgress({ processed: results.length });
    } catch {
        /* best-effort */
    }
}

async function walkAndCollectFiles(opts) {
    const { dir, results = [], depth = 0, rootDir = null, maxDepth = 6, skipDirs = MOCK_WALK_SKIP_DIRS, maxFiles = 500000, quiet = false, onProgress = null } = opts;
    if (typeof dir !== 'string') return results;
    if (depth > maxDepth) return results;
    if (results.length >= maxFiles) return results;
    const walkRoot = rootDir || dir;
    const reportProgress = !quiet && process.stderr.isTTY && results.length > 0 && results.length % 1000 === 0;
    if (reportProgress) {
        process.stderr.write(`\rScanning: ${results.length.toLocaleString()} files discovered... `);
    }
    let entries;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
            break;
        } catch {
            if (attempt === 2) return results;
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        }
    }
    if (!entries) return results;

    // Process files concurrently with a concurrency limit to avoid memory pressure
    const CONCURRENCY = 64;
    const batch = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (NODE_MODULES_RE.test(fullPath)) continue;
        if (entry.isDirectory()) {
            if (skipDirs && skipDirs.has(entry.name)) continue;
            batch.push(walkAndCollectFiles({ dir: fullPath, results, depth: depth + 1, rootDir: walkRoot, maxDepth, skipDirs, maxFiles, quiet }));
            if (batch.length >= CONCURRENCY) {
                await Promise.all(batch);
                batch.length = 0;
                notifyWalkProgress(results, onProgress);
                if (results.length >= maxFiles) return results;
            }
            continue;
        }
        if (entry.isSymbolicLink()) {
            batch.push((async () => {
                try {
                    const realPath = await fs.promises.realpath(fullPath);
                    const stat = await fs.promises.stat(fullPath);
                    if (NODE_MODULES_RE.test(realPath)) return;
                    if (stat.isDirectory()) {
                        if (skipDirs && skipDirs.has(entry.name)) return;
                        if (!realPath.startsWith(walkRoot)) return;
                        await walkAndCollectFiles({ dir: realPath, results, depth: depth + 1, rootDir: walkRoot, maxDepth, skipDirs, maxFiles, quiet });
                        return;
                    }
                    const relativePath = path.relative(walkRoot, realPath).replace(/\\/g, '/');
                    results.push({
                        path: realPath,
                        name: entry.name,
                        ext: path.extname(entry.name).toLowerCase(),
                        size: stat.size,
                        relativePath
                    });
                } catch {
                    /* skip broken symlinks */
                }
            })());
            if (batch.length >= CONCURRENCY) {
                await Promise.all(batch);
                batch.length = 0;
                notifyWalkProgress(results, onProgress);
            }
            continue;
        }
        if (!entry.isFile()) continue;
        batch.push((async () => {
            const relativePath = path.relative(walkRoot, fullPath).replace(/\\/g, '/');
            let size = 0;
            try {
                const stat = await fs.promises.stat(fullPath);
                size = stat.size;
            } catch {
                /* best-effort size */
            }
            results.push({
                path: fullPath,
                name: entry.name,
                ext: path.extname(entry.name).toLowerCase(),
                size,
                relativePath
            });
            notifyWalkProgress(results, onProgress);
        })());
        if (batch.length >= CONCURRENCY) {
            await Promise.all(batch);
            batch.length = 0;
            notifyWalkProgress(results, onProgress);
        }
    }
    if (batch.length > 0) {
        await Promise.all(batch);
        notifyWalkProgress(results, onProgress);
    }
    return results;
}

/**
 * Read and parse a JSON file.
 * @param {string} filePath
 * @returns {Promise<{valid:boolean,payload?:Object,raw?:string,issue?:string,skipped?:boolean}>}
 */
async function readJsonFile(filePath) {
    if (typeof filePath !== 'string') {
        return { valid: false, issue: 'filePath must be a string', raw: null };
    }
    try {
        const raw = await readFileCachedAsync(filePath);
        if (!raw.trim()) {
            return { valid: false, issue: 'empty file', raw };
        }
        const payload = JSON.parse(raw);
        return { valid: true, payload, raw };
    } catch (error) {
        const code = error?.code;
        const message = error?.message || String(error);
        if (code === 'ENOENT') {
            return { valid: false, issue: 'file not found', raw: null, skipped: true };
        }
        if (code === 'EACCES' || code === 'EPERM') {
            console.warn(`[simplebeacon] Permission denied reading ${filePath}: ${message}`);
            return { valid: false, issue: `permission denied (${code})`, raw: null, skipped: true };
        }
        return { valid: false, issue: message, raw: null };
    }
}

/**
 * Get a category label for a file extension.
 * @param {string} ext File extension including leading dot.
 * @returns {string}
 */
function categoryForExt(ext) {
    if (typeof ext !== 'string') return 'Other Files';
    return EXT_CATEGORIES[ext] || 'Other Files';
}

/**
 * Validate a page-sample JSON file against its schema spec.
 * Mutates issues, categories, and schemaStats in place.
 * @param {Object} params
 * @param {string} params.fileName
 * @param {string} params.filePath
 * @param {{valid:boolean,payload?:Object}} params.parsed
 * @param {Array<Object>} params.issues
 * @param {Map<string,Object>} params.categories
 * @param {Object} params.schemaStats
 */
function applyPageSampleValidation({
    fileName,
    filePath,
    parsed,
    issues,
    categories,
    schemaStats
}) {
    schemaStats.schemaChecked += 1;
    schemaStats.pageSampleSchemaChecked += 1;
    const category = categoryForExt(path.extname(fileName));
    const bucket = categories.get(category) || {
        category,
        fileCount: 0,
        totalSize: 0,
        issues: 0,
        files: []
    };

    const schema = validateSampleSchema(fileName, parsed.payload);
    if (schema.valid) {
        schemaStats.schemaPassed += 1;
        schemaStats.pageSampleSchemaPassed += 1;
        categories.set(category, bucket);
        return;
    }

    bucket.issues += 1;
    issues.push({
        id: `schema-${fileName}`,
        severity: 'high',
        type: 'Schema Violation',
        filePath,
        count: schema.violations.length,
        description: `${fileName}: ${schema.violations.map((v) => v.message).join('; ')}`,
        recommendedAction: 'Update mock data to conform to dashboard page schema requirements',
        affectedFiles: [fileName],
        metadata: {
            missingFields: schema.missingFields,
            specFile: fileName,
            violations: schema.violations
        }
    });
    categories.set(category, bucket);
}

/**
 * Run the security-pattern scanner over already-collected files in async batches.
 * @param {Array<{path:string,relativePath:string,ext:string}>} files
 * @param {Object} secOpts Rule options for security-patterns.
 * @param {Object} config Full simplebeacon config.
 * @returns {Promise<{scanned:number,findings:number,issues:Array<Object>}>}
 */
async function runSecurityPatternScan(files, secOpts, config) {
    const secPaths = secOpts.sourcePaths || config.sourceCodeScanPaths || config.productionPaths || ['.'];
    const secIgnore = secOpts.ignoreGlobs || config.ignore || [];
    const secIssues = [];
    let secScanned = 0;
    const scannableExts = ALL_EXTENSION_SET;
    const BATCH = 256;

    for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(async (file) => {
            const rel = file.relativePath || '';
            const basename = path.basename(rel);
            const isEnvFile = basename === '.env' || /^\.env\.[a-z]+$/i.test(basename);
            const ext = file.ext || '';
            if (!scannableExts.has(ext) && !isEnvFile) return null;
            if (secIgnore.some((g) => globMatch(rel, g))) return null;
            if (!secPaths.some((sp) => rel.startsWith(sp.replace(/^\.\//, '')))) {
                if (secPaths[0] !== '.') return null;
            }
            try {
                const content = readFileCached(file.path);
                const findings = scanSecurityPatterns(rel, content, ext);
                return { findings, scanned: 1 };
            } catch {
                return null;
            }
        }));
        for (const r of batchResults) {
            if (!r) continue;
            secScanned += r.scanned;
            if (r.findings.length > 0) secIssues.push(...r.findings);
        }
    }
    return { scanned: secScanned, findings: secIssues.length, issues: secIssues };
}

/**
 * Main scan entry point. Walks scan paths, runs all enabled rule scanners,
 * aggregates findings, computes quality scores, and returns a full report.
 * @param {string} baseDir Root directory to scan.
 * @param {string[]} [extraPaths=[]] Additional paths from CLI.
 * @param {Object} [options={}] Scan options (fullDirectoryScan, quiet, fictionScope, etc).
 * @returns {Promise<Object>} Scan report with summary, issues, scores, and gate evaluation.
 */
/**
 * Build the final scan report from all aggregated scan data.
 * @param {Object} opts
 * @returns {Object} Draft report with formatted gate summary.
 *
 * NOTE: This function destructures a large `opts` object and intentionally
 * accepts many named fields; mark as ignored for the mega-params rule.
 */
// simplebeacon-ignore: mega-params — large destructured options object is intentional for readability
function buildScanReport(opts) {
    const {
        config, scanRoot, platformRoot, scanPaths, repositoryInventory,
        uniqueFiles, totalLines, totalSize, ruleScopedFilesAnalyzed,
        repositoryFilesTotal, repositoryFoldersTotal, issueCount,
        invalidJson, emptyFiles, qualityScore, schemaCompliance,
        schemaStats, duplicateGroups, resolved, severityCounts,
        tierInfo, quotaCheck, isPipeline, scoringIssues,
        benchmarkCacheIssues, pageSpecCatalogSize, pageSpecsFromAlias,
        rulesEnabled, gateResult, scanErrors,
        ruleTimings
    } = opts;

    const highCount = severityCounts.high || 0;
    const mediumCount = severityCounts.medium || 0;
    const totalRisks = issueCount;
    const estimatedCost = totalRisks > 0 ? `$${(totalRisks * 5000).toLocaleString()}` : '$0';

    const scanSummary = {
        status: gateResult.pass ? 'PASSED' : 'FAILED',
        block_merge: !gateResult.pass,
        total_risks_found: totalRisks,
        high_severity_count: highCount,
        medium_severity_count: mediumCount,
        low_severity_count: severityCounts.low || 0,
        estimated_incident_cost_saved: estimatedCost,
        scan_id: `sb_scan_${crypto.randomBytes(6).toString('hex')}`,
        timestamp: new Date().toISOString(),
        tier: tierInfo.tier,
        scans_remaining: quotaCheck.scansRemaining,
        pipeline_scan: isPipeline
    };

    const {
        roadmapValidation, consistency, credentialScan, productionLeakScan,
        sourceFictionScan, llmSlopScan, euAiActScan,
        jestBaseline, securityPatternScan,
        hardcodedUrlScan, weakCryptoScan, secretInCommentsScan,
        syncIoScan, envInGitScan, redosScan, piiLoggingScan, deadCodeScan,
        memoryLeakScan, typeSafetyScan, hallucinatedImportScan, astStructuralScan,
        dependencyGraphScan,
        cveDependencyScan, sbomScan, gitHistorySecretScan, deploymentReadinessScan,
        customHeuristicScan
    } = resolved;

    const scanScope = {
        profile: config.profile || 'standard',
        scannerVersion: '1.0.0',
        rulesEnabled,
        gatePolicy: config.gate || { failOn: ['high'], warnOn: ['medium', 'low'] },
        diffOnly: Array.isArray(opts.diffFiles) && opts.diffFiles.length > 0,
        diffFileCount: Array.isArray(opts.diffFiles) ? opts.diffFiles.length : 0,
        mockSampleFilesInScanPaths: uniqueFiles.length,
        pageSpecCatalogSize,
        pageSpecsValidated: schemaStats.pageSampleSchemaChecked,
        pageSpecsFromScanPaths: schemaStats.pageSampleSchemaChecked - pageSpecsFromAlias,
        pageSpecsFromAliasPaths: pageSpecsFromAlias,
        productionDirsScanned: productionLeakScan.scanned,
        productionPaths: config.productionPaths || [],
        sourceCodeScanPaths: config.sourceCodeScanPaths || [],
        sourceCodeFilesScanned: sourceFictionScan.scanned,
        sourceFictionPatternHits: sourceFictionScan.findings,
        llmSlopFilesScanned: llmSlopScan.scanned,
        llmSlopPatternHits: llmSlopScan.findings,
        euAiActFilesScanned: euAiActScan.scanned,
        euAiActPatternHits: euAiActScan.findings,
        euAiActHighRiskIndicators: euAiActScan.summary?.highRiskIndicators ?? 0,
        jestExecutedDuringScan: jestBaseline.checked === true,
        consistencyAnchorCount: (config.consistencyAnchorSamples || []).length,
        fictionScope: consistency.scope || 'repository-json',
        fictionJsonFilesScanned: consistency.jsonFilesScanned ?? consistency.checked ?? 0,
        fictionSampleFilesScanned: consistency.samplesScanned ?? 0,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
        excludedPathsNote: benchmarkCacheIssues.length
            ? `${benchmarkCacheIssues.length} issue(s) from github-cache/ benchmark clones excluded from gate scores — scan clones with github-cache/.simplebeacon/config.json (profile: benchmark).`
            : null,
        limitations: [
            repositoryFilesTotal != null
                ? `Repository inventory: ${repositoryFilesTotal.toLocaleString()} files — gate rules checked ${ruleScopedFilesAnalyzed} (mock paths, credentials, server/ leaks).`
                : `Gate rules checked ${ruleScopedFilesAnalyzed} files — mock paths, credentials, and production directories only.`,
            'github-cache/ OSS benchmark clones are excluded from platform gate scoring (not your product code).',
            'Pattern matching on JSON samples and server/ production paths — not LLM semantic review.',
            consistency.scope === 'repository-json'
                ? `Fiction/KPI rules scan repository JSON (${consistency.jsonFilesScanned ?? '—'}) plus source code (${sourceFictionScan.scanned ?? 0} files in ${(config.sourceCodeScanPaths || []).join(', ') || 'configured paths'}).`
                : 'Fiction/KPI rules scan configured sample JSON paths only.',
            jestBaseline.checked
                ? 'Jest was executed during this scan.'
                : 'Jest was not executed during this scan — use npm test or simplebeacon:full for live test verification.',
            config.profile === 'cascade'
                ? 'Cascade profile scans server/ for production leaks — src/ stub API is excluded by design.'
                : null
        ].filter(Boolean),
        ...(config.fullDirectoryScan ? { fullDirectoryScan: true } : {}),
        ...(!config.fullDirectoryScan && repositoryFilesTotal != null && ruleScopedFilesAnalyzed > 0
            && (ruleScopedFilesAnalyzed / Math.max(1, repositoryFilesTotal) > 2
                || repositoryFilesTotal / Math.max(1, ruleScopedFilesAnalyzed) > 2)
            ? {
                inventoryScopeNote: `Gate walk analyzed ${ruleScopedFilesAnalyzed.toLocaleString()} files; repository inventory counted ${repositoryFilesTotal.toLocaleString()} paths under the scan target.`
            }
            : {})
    };

    const draftReport = {
        type: 'simplebeacon-report',
        reportVersion: 2,
        scan_summary: scanSummary,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Simplebeacon',
        projectRoot: scanRoot,
        platformRoot: platformRoot !== scanRoot ? platformRoot : undefined,
        configPath: config.configPath,
        scanPaths,
        repositoryInventory,
        mockSampleFiles: uniqueFiles.filter((f) => {
            const isStructuralUtility = /-(path-resolver|resolver|stub-api|schema-validator|schema|consistency-checker|overrides|config|checker|specs)\.(js|cjs|mjs|ts|json)$/i.test(f.name);
            return !isStructuralUtility && (
                /(?:web\/data|data\/mock|data-central|fixtures?|sample)/i.test(f.relativePath)
                || /-sample\.json$/i.test(f.name)
            );
        }).length,
        totalFiles: uniqueFiles.length,
        totalLines,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        filesAnalyzed: config.fullDirectoryScan ? uniqueFiles.length : ruleScopedFilesAnalyzed,
        totalSizeBytes: totalSize,
        totalSizeLabel: formatBytes(totalSize),
        issueCount,
        invalidJson,
        emptyFiles,
        qualityScore,
        schemaCompliance,
        schemaChecked: schemaStats.schemaChecked,
        schemaPassed: schemaStats.schemaPassed,
        pageSampleSchemaChecked: schemaStats.pageSampleSchemaChecked,
        pageSampleSchemaPassed: schemaStats.pageSampleSchemaPassed,
        duplicateGroups: duplicateGroups.length,
        roadmapSchemaChecked: roadmapValidation.checked,
        roadmapSchemaPassed: roadmapValidation.passed,
        consistencyChecked: consistency.checked,
        consistencyPassed: consistency.passed,
        consistencyScore: consistency.score,
        fictionJsonFilesScanned: consistency.jsonFilesScanned ?? consistency.checked ?? 0,
        fictionSampleFilesScanned: consistency.samplesScanned ?? 0,
        fictionScope: consistency.scope || 'repository-json',
        credentialScanned: credentialScan.scanned,
        credentialFindings: credentialScan.findings,
        productionLeakScanned: productionLeakScan.scanned,
        productionLeakFindings: productionLeakScan.findings,
        productionLeakSuppressedIntent: productionLeakScan.suppressedIntentCount || 0,
        sourceCodeFilesScanned: sourceFictionScan.scanned,
        sourceFictionPatternHits: sourceFictionScan.findings,
        llmSlopFilesScanned: llmSlopScan.scanned,
        llmSlopPatternHits: llmSlopScan.findings,
        euAiActScanned: euAiActScan.scanned,
        euAiActFindings: euAiActScan.findings,
        euAiActSummary: euAiActScan.summary,
        securityPatternFilesScanned: securityPatternScan.scanned,
        securityPatternFindings: securityPatternScan.findings,
        hardcodedUrlFilesScanned: scannedCount(hardcodedUrlScan),
        hardcodedUrlFindings: findingsCount(hardcodedUrlScan),
        weakCryptoFilesScanned: scannedCount(weakCryptoScan),
        weakCryptoFindings: findingsCount(weakCryptoScan),
        secretInCommentsFilesScanned: scannedCount(secretInCommentsScan),
        secretInCommentsFindings: findingsCount(secretInCommentsScan),
        syncIoFilesScanned: scannedCount(syncIoScan),
        syncIoFindings: findingsCount(syncIoScan),
        envInGitFilesScanned: scannedCount(envInGitScan),
        envInGitFindings: findingsCount(envInGitScan),
        redosFilesScanned: scannedCount(redosScan),
        redosFindings: findingsCount(redosScan),
        piiLoggingFilesScanned: scannedCount(piiLoggingScan),
        piiLoggingFindings: findingsCount(piiLoggingScan),
        deadCodeFilesScanned: scannedCount(deadCodeScan),
        deadCodeFindings: findingsCount(deadCodeScan),
        memoryLeakFilesScanned: scannedCount(memoryLeakScan),
        memoryLeakFindings: findingsCount(memoryLeakScan),
        typeSafetyFilesScanned: scannedCount(typeSafetyScan),
        typeSafetyFindings: findingsCount(typeSafetyScan),
        hallucinatedImportFilesScanned: scannedCount(hallucinatedImportScan),
        hallucinatedImportFindings: findingsCount(hallucinatedImportScan),
        astStructuralFilesScanned: scannedCount(astStructuralScan),
        astStructuralFindings: findingsCount(astStructuralScan),
        astAvailable: astStructuralScan.astAvailable || false,
        dependencyGraphFilesScanned: scannedCount(dependencyGraphScan),
        dependencyGraphFindings: findingsCount(dependencyGraphScan),
        cveDependencyScanned: scannedCount(cveDependencyScan),
        cveDependencyFindings: findingsCount(cveDependencyScan),
        cveDependencySummary: cveDependencyScan?.summary || null,
        sbomGenerated: sbomScan?.summary?.lockfileFound === true,
        sbomComponentCount: sbomScan?.summary?.componentCount || 0,
        sbomOutputPath: sbomScan?.summary?.outputPath || null,
        gitHistorySecretScanned: scannedCount(gitHistorySecretScan),
        gitHistorySecretFindings: findingsCount(gitHistorySecretScan),
        gitHistorySecretSummary: gitHistorySecretScan?.summary || null,
        deploymentReadinessScanned: scannedCount(deploymentReadinessScan),
        deploymentReadinessFindings: findingsCount(deploymentReadinessScan),
        customHeuristicScanned: scannedCount(customHeuristicScan),
        customHeuristicFindings: findingsCount(customHeuristicScan),
        jestBaselineChecked: jestBaseline.checked,
        jestBaselinePassed: jestBaseline.passed,
        jestSummary: jestBaseline.summary || null,
        severityCounts,
        mockDataCategories: [...opts.categories.values()].map((cat) => ({
            category: cat.category,
            fileCount: cat.fileCount,
            totalSize: formatBytes(cat.totalSize),
            qualityScore: Math.max(60, Math.min(100, Math.round(100 - (cat.issues / Math.max(cat.fileCount, 1)) * 40))),
            issues: cat.issues,
            confidence: null,
            description: `${cat.category} discovered during filesystem scan`
        })),
        compliance: resolveComplianceCounts(platformRoot),
        detectedIssues: groupIssues(scoringIssues).slice(0, 12),
        rawIssues: scoringIssues,
        benchmarkCacheIssues,
        sampleFiles: uniqueFiles.map((f) => f.name),
        scanScope,
        gate: gateResult,
        scanErrors: scanErrors || [],
        ruleTimings: (ruleTimings || []).slice(0, 10),
        slowestRule: (ruleTimings && ruleTimings[0]) || null,
        totalScanTimeMs: (ruleTimings || []).reduce((sum, t) => sum + (t.elapsedMs || 0), 0)
    };

    const gateSummary = draftReport.gate;
    draftReport.gate = {
        pass: gateSummary.pass,
        failOn: gateSummary.failOn,
        warnOn: gateSummary.warnOn,
        blockingCount: (gateSummary.blockingIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        warningCount: (gateSummary.warningIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        blockingIssues: gateSummary.blockingIssues || [],
        warningIssues: gateSummary.warningIssues || []
    };

    return reconcileScanReport(draftReport);
}

async function scanMockDataDirectories(baseDir, extraPaths = [], options = {}) {
    if (typeof baseDir !== 'string') {
        throw new TypeError('scanMockDataDirectories expects baseDir to be a string');
    }
    const scanStart = process.hrtime.bigint();
    clearJsonFileCache();
    clearFileContentCache();
    const scanRoot = sanitizePath(baseDir, baseDir);
    try {
        const analyzerCachePath = path.join(scanRoot, '.simplebeacon', 'analyzer-cache.json');
        await fs.promises.unlink(analyzerCachePath);
    } catch {
        /* best-effort cache clear — file may not exist */
    }
    const { platformRoot: detectedPlatformRoot } = resolvePlatformRoot(scanRoot);
    const platformRoot = detectedPlatformRoot;
    const root = scanRoot;
    const rawConfig = options.config || loadSimplebeaconConfig(root, options.configPath);
    // Deep-clone to avoid mutating the caller's config object on tier-sanitize / flag overrides
    const config = JSON.parse(JSON.stringify(rawConfig || {}));

    // Merge .simplebeaconignore patterns into config.ignore so all rules respect them
    const simplebeaconIgnorePatterns = loadSimplebeaconIgnorePatterns(root);
    if (simplebeaconIgnorePatterns.length > 0) {
        config.ignore = Array.from(new Set([...(config.ignore || []), ...simplebeaconIgnorePatterns]));
    }

    // --- Scan quota enforcement ---
    const tierInfo = options.tierLimits && options.tier
        ? { tier: options.tier, paid: Boolean(options.paidLicense), limits: options.tierLimits }
        : detectTier();
    const isPipeline = options.ci || isPipelineScan();

    // Community CI gate is allowed; paid tokens unlock higher limits via resolveCiLicense in the CLI entrypoint.

    const quotaCheck = isPipeline
        ? { allowed: true, scansRemaining: tierInfo.limits.maxScansPerPeriod } // Pipeline: validate via token on server
        : checkLocalScanQuota(tierInfo.limits);

    if (!quotaCheck.allowed) {
        return {
            type: 'simplebeacon-report',
            reportVersion: 2,
            generatedAt: new Date().toISOString(),
            error: `Scan quota exceeded (${quotaCheck.scansUsed}/${quotaCheck.quota} used this month). Upgrade at https://simplebeacon.ai/pricing`,
            tier: tierInfo.tier,
            scan_summary: { status: 'BLOCKED', block_merge: true, reason: 'scan_quota_exceeded', scans_used: quotaCheck.scansUsed, scans_remaining: 0 }
        };
    }

    if (isPipeline) {
        incrementPipelineScan(tierInfo.tier);
    } else {
        incrementLocalScan(tierInfo.tier);
    }

    // --- Tier-gated config sanitization ---
    const sanitized = sanitizeConfigForTier(config, tierInfo.tier);
    if (sanitized.scanners) config.scanners = sanitized.scanners;
    if (sanitized.allowlist !== undefined) config.allowlist = sanitized.allowlist;
    if (sanitized.rules) config.rules = sanitized.rules;
    // --- End quota & config enforcement ---

    if (options.fullDirectoryScan) {
        config.fullDirectoryScan = true;
    }
    if (options.withJest && config.rules?.['jest-baseline']) {
        config.rules['jest-baseline'] = { ...config.rules['jest-baseline'], enabled: true, runTests: true };
    }
    const sanitizedExtraPaths = (extraPaths || [])
        .map((entry) => {
            try {
                return sanitizePath(entry, scanRoot);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    const scanPaths = resolveEffectiveScanPaths(scanRoot, root, config, sanitizedExtraPaths);
    const schemaEnabled = isRuleEnabled(config, 'json-schema');
    const FULL_TREE_MINIMAL_SKIP_DIRS = ['.git', 'github-cache', '.simplebeacon', '.vscode-test', 'simplebeacon-vscode-merged', 'ai-tools', 'ai-agent', 'node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.cache'];
    const inventoryRoot = detectedPlatformRoot !== scanRoot ? scanRoot : detectedPlatformRoot;
    const inventoryPromise = countRepositoryInventory(inventoryRoot, {
        profile: config.fullDirectoryScan ? 'all' : (options.inventoryProfile || 'universal'),
        skipDirs: config.fullDirectoryScan
            ? (config.fullDirectoryScanSkipDirs ? [...config.fullDirectoryScanSkipDirs] : FULL_TREE_MINIMAL_SKIP_DIRS)
            : [...MOCK_WALK_SKIP_DIRS]
    });

    const progressWriter = options.noProgress
        ? { update() {}, clear() {} }
        : createScanProgressWriter(resolveScanProgressPath(scanRoot, options), {
            projectPath: scanRoot,
            fileKind: config.fullDirectoryScan ? 'full-tree' : 'scan-scoped'
        });

    const files = [];
    const scanMaxDepth = config.fullDirectoryScan ? 100 : (config.scanMaxDepth || 12);
    let skipDirs = MOCK_WALK_SKIP_DIRS;
    if (config.fullDirectoryScan) {
        skipDirs = config.fullDirectoryScanSkipDirs ? new Set(config.fullDirectoryScanSkipDirs) : new Set(FULL_TREE_MINIMAL_SKIP_DIRS);
    }
    const skipDirsList = [...skipDirs];
    let walkTotalHint = null;

    try {
        inventoryPromise.then((inv) => {
            if (inv && typeof inv.totalFiles === 'number') {
                walkTotalHint = inv.totalFiles;
                progressWriter.update({
                    repositoryAuditFiles: inv.totalFiles,
                    total: walkTotalHint
                });
            }
        }).catch(() => {});

        progressWriter.update({
            active: true,
            phase: 'walk',
            label: config.fullDirectoryScan ? 'Full-tree gate walk' : 'Gate walk',
            skipDirs: skipDirsList,
            processed: 0,
            total: walkTotalHint
        });

        const walkQuiet = options.quiet || process.env.SIMPLEBEACON_QUIET === '1';
        for (const scanPath of scanPaths) {
            if (fs.existsSync(scanPath)) { // simplebeacon-ignore sync-io — path validation before async walk
                await walkAndCollectFiles({
                    dir: scanPath,
                    results: files,
                    depth: 0,
                    rootDir: null,
                    maxDepth: scanMaxDepth,
                    skipDirs,
                    maxFiles: undefined,
                    quiet: walkQuiet,
                    onProgress: ({ processed }) => {
                        progressWriter.update({
                            phase: 'walk',
                            label: config.fullDirectoryScan ? 'Full-tree gate walk' : 'Gate walk',
                            processed,
                            total: walkTotalHint || processed,
                            skipDirs: skipDirsList
                        });
                    }
                });
            }
        }
        let uniqueFiles = dedupeScannedFiles(files);
        if (Array.isArray(options.exclude) && options.exclude.length > 0) {
            const excludePatterns = options.exclude.map((p) => p.replace(/\\/g, '/'));
            uniqueFiles = uniqueFiles.filter((f) => {
                const rel = f.relativePath || '';
                return !excludePatterns.some((pat) => rel.includes(pat));
            });
        }
        if (Array.isArray(options.diffFiles) && options.diffFiles.length > 0) {
            const diffSet = new Set(options.diffFiles.map((entry) => String(entry).replace(/\\/g, '/')));
            uniqueFiles = uniqueFiles.filter((f) => diffSet.has((f.relativePath || '').replace(/\\/g, '/')));
        }

        walkTotalHint = uniqueFiles.length;
        progressWriter.update({
            phase: 'walk',
            label: config.fullDirectoryScan ? 'Full-tree gate walk' : 'Gate walk',
            processed: uniqueFiles.length,
            total: uniqueFiles.length,
            skipDirs: skipDirsList
        });

    const categories = new Map();
    const issues = [];
    const hashEntries = [];
    let invalidJson = 0;
    let emptyFiles = 0;
    const pageSamplesValidated = new Set();
    const schemaStats = {
        schemaChecked: 0,
        schemaPassed: 0,
        pageSampleSchemaChecked: 0,
        pageSampleSchemaPassed: 0
    };

    // Pass 1: Synchronous category building and JSON file collection
    const jsonFilesToProcess = [];
    for (const file of uniqueFiles) {
        const category = categoryForExt(file.ext);
        const bucket = categories.get(category) || {
            category,
            fileCount: 0,
            totalSize: 0,
            issues: 0,
            files: []
        };
        bucket.fileCount += 1;
        bucket.totalSize += file.size;
        bucket.files.push(file.name);
        categories.set(category, bucket);

        const isNodeModulesFile = /(^|[\/])node_modules[\/]/.test(file.path);
        const isStdoutCapture = /-stdout\.json$/i.test(file.name) || /report-stdout\.json$/i.test(file.name);

        if (file.ext === '.json' && !isStdoutCapture) {
            jsonFilesToProcess.push({ file, isNodeModulesFile });
        }
    }

    // Pass 2: Batched async JSON reads to avoid serially blocking the event loop
    const JSON_BATCH_SIZE = 64;
    for (let i = 0; i < jsonFilesToProcess.length; i += JSON_BATCH_SIZE) {
        const batch = jsonFilesToProcess.slice(i, i + JSON_BATCH_SIZE);
        const results = await Promise.all(batch.map((item) => readJsonFile(item.file.path)));
        for (let j = 0; j < batch.length; j++) {
            const { file, isNodeModulesFile } = batch[j];
            const parsed = results[j];
            const category = categoryForExt(file.ext);
            const bucket = categories.get(category);
            if (!parsed.valid) {
                if (!isNodeModulesFile && bucket) {
                    bucket.issues += 1;
                    invalidJson += 1;
                    if (parsed.issue === 'empty file') emptyFiles += 1;
                    issues.push({
                        id: `invalid-json-${file.name}`,
                        severity: parsed.issue === 'empty file' ? 'low' : 'high',
                        type: parsed.issue === 'empty file' ? 'Empty File' : 'Invalid JSON',
                        filePath: file.path,
                        count: 1,
                        description: `${file.name}: ${parsed.issue}`,
                        recommendedAction: parsed.issue === 'empty file'
                            ? 'Remove or populate empty mock files'
                            : 'Fix JSON syntax errors in mock data',
                        affectedFiles: [file.name]
                    });
                }
            } else if (!isNodeModulesFile) {
                hashEntries.push({
                    name: file.name,
                    path: file.path,
                    contentHash: hashFileContent(parsed.raw)
                });

                // simplebeacon:production-leak-intent: schema-validator - Validate repository-audit page sample schemas
                if (schemaEnabled && file.name.endsWith('-sample.json') && PAGE_SAMPLE_SPECS[file.name]) {
                    pageSamplesValidated.add(file.name);
                    applyPageSampleValidation({
                        fileName: file.name,
                        filePath: file.path,
                        parsed,
                        issues,
                        categories,
                        schemaStats
                    });
                }
            }
        }
    }

    let pageSpecsFromAlias = 0;
    if (schemaEnabled) {
        const pageSpecsBeforeAlias = schemaStats.pageSampleSchemaChecked;
        for (const fileName of Object.keys(PAGE_SAMPLE_SPECS)) {
            if (pageSamplesValidated.has(fileName)) continue;
            const filePath = resolveSampleFilePath(root, fileName);
            try {
                await fs.promises.access(filePath);
            } catch {
                continue;
            }
            const parsed = await readJsonFile(filePath);
            if (!parsed.valid) {
                invalidJson += 1;
                if (parsed.issue === 'empty file') emptyFiles += 1;
                issues.push({
                    id: `invalid-json-${fileName}`,
                    severity: parsed.issue === 'empty file' ? 'low' : 'high',
                    type: parsed.issue === 'empty file' ? 'Empty File' : 'Invalid JSON',
                    filePath,
                    count: 1,
                    description: `${fileName}: ${parsed.issue}`,
                    recommendedAction: parsed.issue === 'empty file'
                        ? 'Remove or populate empty mock files'
                        : 'Fix JSON syntax errors in mock data',
                    affectedFiles: [fileName]
                });
                continue;
            }
            pageSamplesValidated.add(fileName);
            applyPageSampleValidation({
                fileName,
                filePath,
                parsed,
                issues,
                categories,
                schemaStats
            });
        }
        pageSpecsFromAlias = schemaStats.pageSampleSchemaChecked - pageSpecsBeforeAlias;
    }

    const nodeModulesRe = /(^|[\\/])node_modules[\\/]/;
    const newFolderRe = /(^|[\\/])New folder[\\/]/;
    const simplebeaconRe = /(^|[\\/])\.simplebeacon[\\/]/;
    const ignorePatterns = config.ignore || [];
    const duplicateGroups = findDuplicateContentGroups(hashEntries).filter((group) => {
        if (group.every((entry) => nodeModulesRe.test(entry.path))) return false;
        if (group.some((entry) => newFolderRe.test(entry.path) || simplebeaconRe.test(entry.path))) return false;
        if (group.every((entry) => isIgnoredPath(displayRelativePath(root, entry.path), ignorePatterns))) return false;
        return true;
    });
    for (const group of duplicateGroups) {
        const relativePaths = group.map((entry) => displayRelativePath(root, entry.path));
        issues.push({
            id: `duplicate-${group[0].contentHash.slice(0, 8)}`,
            severity: 'low',
            type: 'Duplicate Data',
            filePath: group[0].path,
            filePaths: group.map((entry) => entry.path),
            count: group.length,
            description: `${group.length} files share identical JSON content`,
            recommendedAction: 'Remove duplicate entries to optimize data size',
            affectedFiles: relativePaths,
            metadata: {
                duplicatePaths: group.map((entry) => entry.path),
                relativePaths,
                contentHash: group[0].contentHash
            }
        });
    }

    // Run independent rule scans in parallel
    const scanPromises = [];
    const scanKeys = [];
    const _simpleScanOpts = { maxDepth: 20, skipDirs: config.skipDirs || MOCK_WALK_SKIP_DIRS };

    /**
     * Build a scanner registry entry with common option fallbacks.
     * @param {string} key
     * @param {string} varName
     * @param {Function} scannerFn
     * @param {Function} [buildOpts] (opts) => scanner options object
     * @param {Object} [overrides]
     * @param {boolean} [overrides.alwaysRun]
     * @returns {Object} Registry entry
     */
    function scannerEntry(key, varName, scannerFn, buildOpts, overrides = {}) {
        return {
            key, varName,
            enabled: overrides.alwaysRun ? undefined : (cfg) => isRuleEnabled(cfg, key),
            alwaysRun: overrides.alwaysRun || false,
            run: buildOpts
                ? () => {
                    const opts = getRuleOptions(config, key);
                    return scannerFn(root, buildOpts(opts));
                }
                : () => scannerFn(root, _simpleScanOpts)
        };
    }

    /**
     * Declarative scanner registry. Each entry defines:
     *   key       – result map key
     *   varName   – variable name in the resolved object
     *   enabled   – (cfg) => boolean   (omit for always-run scanners)
     *   alwaysRun – bypasses onlyRules/skipRules filters
     *   run       – () => Promise<scanResult>
     */
    const SCANNER_REGISTRY = [
        {
            key: 'roadmap', varName: 'roadmapValidation',
            enabled: (cfg) => isRuleEnabled(cfg, 'roadmap'),
            run: () => validateRoadmapFiles(root, { baseline: config.baseline, ignoreGlobs: config.ignore })
        },
        {
            key: 'consistency', varName: 'consistency',
            enabled: (cfg) => isRuleEnabled(cfg, 'sample-consistency'),
            run: () => checkSampleConsistency(root, {
                sampleDir: config.sampleDir, baseline: config.baseline,
                anchorSamples: config.consistencyAnchorSamples,
                scanPathFiles: uniqueFiles.filter((f) => f.ext === '.json'),
                fictionScope: options.fictionScope || 'repository-json',
                ignoreGlobs: config.ignore
            })
        },
        {
            key: 'credentials', varName: 'credentialScan',
            enabled: (cfg) => isRuleEnabled(cfg, 'credentials'),
            run: () => {
                const credOpts = getRuleOptions(config, 'credentials');
                return scanCredentialPatterns(uniqueFiles, {
                    scanProduction: credOpts.scanProduction !== false,
                    baseDir: root,
                    productionPaths: credOpts.productionPaths || config.productionPaths,
                    ignoreGlobs: config.ignore
                });
            }
        },
        scannerEntry('production-leak', 'productionLeakScan', scanProductionLeaks, (opts) => ({
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            allowlistFiles: opts.allowlistFiles || [],
            scannerMetaFiles: [...(config.scannerMetaFiles || []), ...(opts.scannerMetaFiles || [])],
            severity: opts.severity || 'high',
            intentClassification: opts.intentClassification !== false,
            plainSampleJson: opts.plainSampleJson === true
        })),
        scannerEntry('fiction-kpi-patterns', 'sourceFictionScan', scanSourceFictionPatterns, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            pathExclusions: config.pathExclusions || [],
            baseline: config.baseline
        })),
        {
            key: 'llm-slop-patterns', varName: 'llmSlopScan',
            enabled: (cfg) => options.slopCop === true || isRuleEnabled(cfg, 'llm-slop-patterns'),
            run: () => {
                const opts = getRuleOptions(config, 'llm-slop-patterns');
                return scanLlmSlopPatterns(root, {
                    sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
                    productionPaths: opts.productionPaths || config.productionPaths,
                    ignoreGlobs: opts.ignoreGlobs || config.ignore,
                    registryCheck: opts.registryCheck === true || process.env.SIMPLEBEACON_REGISTRY_CHECK === 'true',
                    registryCheckLimit: opts.registryCheckLimit || 12,
                    minConfidence: options.minConfidence ?? config.minConfidence ?? 0.5
                });
            }
        },
        scannerEntry('agency-handoff-patterns', 'agencyHandoffScan', scanAgencyHandoffPatterns, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            severity: opts.severity || 'medium'
        })),
        scannerEntry('eu-ai-act-patterns', 'euAiActScan', scanEuAiActPatterns, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            severity: opts.severity || 'medium'
        })),
        scannerEntry('owasp-llm-patterns', 'owaspLlmScan', scanOwaspLlmPatterns, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            severity: opts.severity || 'high'
        })),
        {
            key: 'jest-baseline', varName: 'jestBaseline',
            enabled: (cfg) => isRuleEnabled(cfg, 'jest-baseline'),
            run: () => {
                const jestOpts = getRuleOptions(config, 'jest-baseline');
                return checkJestBaseline(root, {
                    baseline: config.baseline,
                    runTests: jestOpts.runTests === true,
                    testCommand: jestOpts.testCommand,
                    timeoutMs: jestOpts.timeoutMs
                });
            }
        },
        scannerEntry('token-bleed-patterns', 'tokenBleedScan', scanTokenBleedPatterns, (opts) => ({
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            severity: opts.severity || 'medium'
        })),
        scannerEntry('architecture-drift-patterns', 'architectureDriftScan', scanArchitectureDriftPatterns, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore,
            severity: opts.severity || 'medium'
        })),
        {
            key: 'file-reduction', varName: 'fileReduction',
            enabled: (cfg) => isRuleEnabled(cfg, 'file-reduction'),
            run: () => {
                const frOpts = getRuleOptions(config, 'file-reduction');
                return runFileReductionScan(root, { dryRun: frOpts.dryRun !== false, scanners: frOpts.scanners || {} });
            }
        },
        {
            key: 'security-patterns', varName: 'securityPatternScan',
            enabled: (cfg) => isRuleEnabled(cfg, 'security-patterns'),
            run: () => runSecurityPatternScan(uniqueFiles, getRuleOptions(config, 'security-patterns'), config)
        },
        scannerEntry('hardcoded-url', 'hardcodedUrlScan', scanHardcodedUrls),
        scannerEntry('weak-crypto', 'weakCryptoScan', scanWeakCrypto),
        scannerEntry('secret-in-comments', 'secretInCommentsScan', scanSecretInComments),
        scannerEntry('sync-io-async-path', 'syncIoScan', scanSyncIo),
        scannerEntry('env-in-git', 'envInGitScan', scanEnvInGit),
        scannerEntry('redos-risk', 'redosScan', scanReDoS),
        scannerEntry('pii-logging', 'piiLoggingScan', scanPiiLogging),
        scannerEntry('dead-code', 'deadCodeScan', scanDeadCode),
        scannerEntry('memory-leak', 'memoryLeakScan', scanMemoryLeaks),
        scannerEntry('type-safety', 'typeSafetyScan', scanTypeSafety, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore
        })),
        scannerEntry('hallucinated-import', 'hallucinatedImportScan', scanHallucinatedImports, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore
        })),
        scannerEntry('ast-structural', 'astStructuralScan', scanAstStructural, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore
        })),
        scannerEntry('dependency-graph', 'dependencyGraphScan', scanDependencyGraph, (opts) => ({
            sourcePaths: opts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: opts.productionPaths || config.productionPaths,
            ignoreGlobs: opts.ignoreGlobs || config.ignore
        })),
        {
            key: 'comprehensive', varName: 'comprehensiveScan',
            alwaysRun: true,
            run: () => scanComprehensive(uniqueFiles, { rootDir: root })
        },
        scannerEntry('cve-dependency', 'cveDependencyScan', scanCveDependencies, (opts) => ({
            includeDev: opts.includeDev !== false,
            lockfilePath: opts.lockfilePath || null
        })),
        scannerEntry('sbom-generator', 'sbomScan', generateSbom, (opts) => ({
            includeDev: opts.includeDev !== false,
            outputPath: opts.outputPath || null
        })),
        scannerEntry('git-history-secret', 'gitHistorySecretScan', scanGitHistorySecrets, (opts) => ({
            maxCommits: opts.maxCommits || 1000,
            timeoutMs: opts.timeoutMs || 30000,
            paths: opts.paths || config.productionPaths || []
        })),
        scannerEntry('deployment-readiness', 'deploymentReadinessScan', scanDeploymentReadiness, (opts) => ({
            // Project-level scanner — no file options needed, reads render.yaml + package.json
        })),
        scannerEntry('custom-heuristic', 'customHeuristicScan', scanCustomHeuristicRules, (opts) => ({
            ignoreGlobs: opts.ignoreGlobs || config.ignore
        }))
    ];

    // --- Selective rule execution ---
    const onlyRules = Array.isArray(options.onlyRules) && options.onlyRules.length > 0
        ? new Set(options.onlyRules) : null;
    const skipRules = Array.isArray(options.skipRules) && options.skipRules.length > 0
        ? new Set(options.skipRules) : null;

    for (const entry of SCANNER_REGISTRY) {
        if (!entry.alwaysRun) {
            if (entry.enabled && !entry.enabled(config)) continue;
            if (onlyRules && !onlyRules.has(entry.key)) continue;
            if (skipRules && skipRules.has(entry.key)) continue;
        }
        scanPromises.push(entry.run());
        scanKeys.push(entry.key);
    }

    const totalRules = scanPromises.length;
    const quiet = options.quiet || process.env.SIMPLEBEACON_QUIET === '1';

    let completedRules = 0;
    const scanErrors = [];
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    /**
     * Update progress when a rule scanner finishes.
     * @param {string} name Scanner rule name.
     * @returns {void}
     */
    function tickProgress(name) {
        completedRules++;
        if (!quiet && process.stderr.isTTY && totalRules > 0) {
            process.stderr.write(`\rScanning: ${completedRules}/${totalRules} rules complete (${name})... `);
        }
        progressWriter.update({
            phase: 'rules',
            label: `Rule scan: ${name}`,
            processed: completedRules,
            total: totalRules,
            skipDirs: skipDirsList
        });
        if (onProgress) {
            try { onProgress({ completed: completedRules, total: totalRules, currentRule: name }); } catch { /* intentional */ }
        }
    }

    const trackedPromises = scanPromises.map((p, i) => {
        const start = process.hrtime.bigint();
        return p.then((r) => {
            const elapsedMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
            tickProgress(scanKeys[i]);
            return { ...r, _timing: { rule: scanKeys[i], elapsedMs } };
        }).catch((err) => {
            const elapsedMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
            const errMsg = err?.message || String(err);
            console.error(`[simplebeacon] Rule scanner '${scanKeys[i]}' failed: ${errMsg}`);
            scanErrors.push({ rule: scanKeys[i], error: errMsg, stack: err?.stack || '' });
            return { scanned: 0, findings: 0, issues: [], error: errMsg, _timing: { rule: scanKeys[i], elapsedMs } };
        });
    });

    // --- Overall scan timeout ---
    const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
        ? options.timeoutMs : 600000; // 10 minutes default
    let timeout;
    let scanResults;
    try {
        scanResults = await Promise.race([
            Promise.all(trackedPromises),
            new Promise((_resolve, reject) => {
                timeout = setTimeout(() => reject(new Error(`Scan timed out after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
    } finally {
        clearTimeout(timeout);
    }

    if (!quiet && process.stderr.isTTY && totalRules > 0) {
        process.stderr.write(`\rScanning: ${totalRules}/${totalRules} rules complete.          \n`);
    }

    // Extract per-rule timing metrics
    const ruleTimings = scanResults
        .map((r, i) => r._timing || { rule: scanKeys[i], elapsedMs: 0 })
        .sort((a, b) => b.elapsedMs - a.elapsedMs);

    const resultMap = new Map();
    for (let i = 0; i < scanKeys.length; i++) {
        resultMap.set(scanKeys[i], scanResults[i]);
    }

    const resolved = {};
    for (const entry of SCANNER_REGISTRY) {
        resolved[entry.varName] = _getScanResult(resultMap, entry.key);
    }
    let {
        roadmapValidation, consistency, credentialScan, productionLeakScan,
        sourceFictionScan, llmSlopScan, agencyHandoffScan, euAiActScan,
        jestBaseline, tokenBleedScan, architectureDriftScan, securityPatternScan,
        fileReduction, hardcodedUrlScan, weakCryptoScan, secretInCommentsScan,
        syncIoScan, envInGitScan, redosScan, piiLoggingScan, deadCodeScan,
        memoryLeakScan, typeSafetyScan, hallucinatedImportScan, _astStructuralScan,
        dependencyGraphScan, comprehensiveScan,
        cveDependencyScan, sbomScan, gitHistorySecretScan, deploymentReadinessScan,
        customHeuristicScan
    } = resolved;

    if (roadmapValidation.issues?.length) {
        schemaStats.schemaChecked += roadmapValidation.checked;
        schemaStats.schemaPassed += roadmapValidation.passed;
        issues.push(...roadmapValidation.issues);
    }
    normalizeScannerOutput(issues, consistency);
    normalizeScannerOutput(issues, credentialScan);
    normalizeScannerOutput(issues, productionLeakScan);
    normalizeScannerOutput(issues, sourceFictionScan, null, null, null, null, (getRuleOptions(config, 'fiction-kpi-patterns') || {}).severity || 'medium');
    normalizeScannerOutput(issues, llmSlopScan, null, null, null, null, (getRuleOptions(config, 'llm-slop-patterns') || {}).severity || 'medium');
    normalizeScannerOutput(issues, agencyHandoffScan);
    normalizeScannerOutput(issues, euAiActScan);
    normalizeScannerOutput(issues, jestBaseline);
    normalizeScannerOutput(issues, tokenBleedScan);
    normalizeScannerOutput(issues, architectureDriftScan);
    normalizeScannerOutput(issues, securityPatternScan);
    normalizeScannerOutput(issues, hardcodedUrlScan, 'hardcoded-url', 'SB-SEC-005', 'Hardcoded IP/URL reference');
    normalizeScannerOutput(issues, weakCryptoScan, 'insecure-random', 'SB-SEC-006', 'Weak crypto or insecure random');
    normalizeScannerOutput(issues, secretInCommentsScan, 'sensitive-data', 'SB-SEC-007', 'Secret exposed in comment');
    normalizeScannerOutput(issues, syncIoScan, 'sync-io', 'SB-PERF-001', 'Synchronous I/O in async context');
    normalizeScannerOutput(issues, envInGitScan, 'config-drift', 'SB-SEC-008', 'Secret file tracked by git or not gitignored');
    normalizeScannerOutput(issues, redosScan, 'performance', 'SB-SEC-009', 'Regex with catastrophic backtracking potential');
    normalizeScannerOutput(issues, piiLoggingScan, 'sensitive-data', 'SB-SEC-010', 'Potential PII in log output');
    normalizeScannerOutput(issues, deadCodeScan, 'cleanup', 'SB-QUAL-001', 'Unused import or unreachable code', 'low');
    normalizeScannerOutput(issues, memoryLeakScan, 'performance', 'SB-PERF-002', 'Potential memory leak pattern');
    normalizeScannerOutput(issues, typeSafetyScan, 'type-safety', 'SB-QUAL-001', 'Type safety gap', 'low');
    normalizeScannerOutput(issues, hallucinatedImportScan, 'ai-residue', 'SB-FICTION-004', 'Import of package not in package.json');
    normalizeScannerOutput(issues, comprehensiveScan);
    normalizeScannerOutput(issues, dependencyGraphScan, 'dependency-graph', 'SB-DEPS-001', 'Dependency graph issue', 'medium');
    normalizeScannerOutput(issues, cveDependencyScan, 'cve-vulnerability', 'SB-CVE-001', 'Known CVE vulnerability in dependency');
    normalizeScannerOutput(issues, sbomScan, 'sbom-generated', 'SB-SBOM-001', 'SBOM generation result', 'info');
    normalizeScannerOutput(issues, gitHistorySecretScan, 'git-history-secret', 'SB-GITSEC-001', 'Secret found in git history');
    normalizeScannerOutput(issues, deploymentReadinessScan, 'deployment-readiness', 'SB-DEP-001', 'Deployment topology issue');
    normalizeScannerOutput(issues, customHeuristicScan, 'custom-heuristic', 'SB-CUSTOM', 'Custom rule finding');
    if (fileReduction.allFindings?.length) {
        for (const finding of fileReduction.allFindings) {
            issues.push({
                id: finding.id || `file-reduction-${finding.type}-${crypto.randomBytes(3).toString('hex')}`,
                severity: finding.severity || 'low',
                type: finding.type || 'File Reduction',
                filePath: finding.path || finding.filePath || null,
                count: finding.count || 1,
                description: finding.description || finding.message || `${finding.type} finding`,
                recommendedAction: finding.recommendedAction || finding.fixSuggestion || 'Review file-reduction report',
                affectedFiles: finding.affectedFiles || finding.paths || (finding.path ? [finding.path] : []),
                metadata: {
                    scanner: finding.scanner || 'file-reduction',
                    reclaimableBytes: finding.reclaimableBytes || 0,
                    ...(finding.metadata || {})
                }
            });
        }
    }

    const filteredIssues = issues.filter((issue) => !isKnownFalsePositive(issue));
    const { platformIssues, benchmarkCacheIssues } = partitionBenchmarkIssues(filteredIssues);
    const scoringIssues = platformIssues;

    const totalSize = uniqueFiles.reduce((sum, file) => sum + file.size, 0);
    // Batch line-counting to avoid overwhelming the event loop with too many concurrent promises
    const LINE_COUNT_BATCH = 256;
    let totalLines = 0;
    for (let i = 0; i < uniqueFiles.length; i += LINE_COUNT_BATCH) {
        const batch = uniqueFiles.slice(i, i + LINE_COUNT_BATCH);
        const counts = await Promise.all(batch.map((f) => countFileLines(f.path, f.ext)));
        for (const c of counts) totalLines += c;
    }
    const issueCount = scoringIssues
        .filter(isBlockingIssue)
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const qualityScore = uniqueFiles.length
        ? computeQualityScoreFromIssues(scoringIssues, config.gate)
        : 0;
    const schemaCompliance = schemaStats.schemaChecked
        ? Math.round((schemaStats.schemaPassed / schemaStats.schemaChecked) * 100)
        : null;

    const severityCounts = countBySeverity(scoringIssues);
    const repositoryInventory = await inventoryPromise;
    const ruleScopedFilesAnalyzed = computeFilesAnalyzed(
        uniqueFiles.length,
        credentialScan,
        productionLeakScan,
        sourceFictionScan
    );
    const repositoryFilesTotal = repositoryInventory?.totalFiles ?? null;
    const repositoryFoldersTotal = repositoryInventory?.totalFolders ?? null;
    const rulesEnabled = Object.keys(config.rules || {}).filter((name) => isRuleEnabled(config, name));
    const pageSpecCatalogSize = Object.keys(PAGE_SAMPLE_SPECS).length;
    const gateResult = evaluateGate({ rawIssues: scoringIssues }, config.gate || {});

    const draftReport = buildScanReport({
        config, scanRoot, platformRoot, scanPaths, repositoryInventory,
        uniqueFiles, totalLines, totalSize, ruleScopedFilesAnalyzed,
        repositoryFilesTotal, repositoryFoldersTotal, issueCount,
        invalidJson, emptyFiles, qualityScore, schemaCompliance,
        schemaStats, duplicateGroups, resolved, severityCounts,
        tierInfo, quotaCheck, isPipeline, scoringIssues,
        benchmarkCacheIssues, pageSpecCatalogSize, pageSpecsFromAlias,
        rulesEnabled, gateResult, scanErrors,
        ruleTimings, categories, diffFiles: options.diffFiles
    });

    const normalizedReport = normalizePlatformScanReport(draftReport, { gateConfig: config.gate });
    const totalElapsedMs = Math.round(Number(process.hrtime.bigint() - scanStart) / 1_000_000);
    normalizedReport.totalScanDurationMs = totalElapsedMs;
    compileGateStatus(normalizedReport, config.gate || {});
    return applyTierLimits(normalizedReport, options);
    } finally {
        progressWriter.clear();
    }
}

/**
 * Thin wrapper around scanMockDataDirectories for CLI entry point.
 * @param {string} baseDir
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
async function runScan(baseDir, options = {}) {
    if (typeof baseDir !== 'string') {
        throw new TypeError('runScan expects baseDir to be a string');
    }
    const safeOptions = options || {};

    // Activate offline guard when --offline is requested via API options or env.
    // This ensures the programmatic API (not just the CLI bin) enforces the
    // zero-custody boundary — no outbound network calls during scan execution.
    let offlineGuard = null;
    const wantsOffline = safeOptions.offline === true ||
        process.env.SIMPLEBEACON_OFFLINE === '1' ||
        process.env.SIMPLEBEACON_OFFLINE === 'true';
    if (wantsOffline) {
        const { createOfflineGuard } = require('./lib/offline-guard');
        offlineGuard = createOfflineGuard({ offline: true });
    }

    try {
        return await scanMockDataDirectories(baseDir, safeOptions.extraPaths || [], safeOptions);
    } finally {
        if (offlineGuard) {
            offlineGuard.assertNoViolations();
            offlineGuard.dispose();
        }
    }
}

module.exports = {
    runScan,
    scanMockDataDirectories,
    categoryForExt,
    validateSampleSchema,
    groupIssues,
    isBlockingIssue,
    countBySeverity,
    resolveEffectiveScanPaths,
    computeFilesAnalyzed,
    applyTierLimits,
    compileGateStatus,
    readFileCached,
    readFileCachedAsync,
    clearFileContentCache,
    loadSimplebeaconIgnorePatterns,
    isIgnoredPath,
    globToRegex,
    cachedGlobToRegex
};
