'use strict';

/**
 * @module simplebeacon
 * SimpleBeacon CLI public API facade.
 *
 * Re-exports every public function from 20+ core modules, organized as both
 * a flat list (backward compatible) and a namespaced `Simplebeacon` object
 * for IDE autocompletion and discoverability.
 *
 * Flat access (cherry-pick what you need):
 * ```js
 * const { runScan, evaluateGate, formatJsonReport } = require('simplebeacon-cli');
 * const report = await runScan('/path/to/project');
 * ```
 *
 * Namespaced access (frozen at runtime):
 * ```js
 * const { Simplebeacon } = require('simplebeacon-cli');
 * Object.isFrozen(Simplebeacon); // true
 * const report = await Simplebeacon.scan.runScan('/path/to/project');
 * ```
 *
 * @file packages/simplebeacon-cli/src/index.js
 */

const { detectProjectProfile, resolvePlatformRoot } = require('./project-detect');
const {
    loadSimplebeaconConfig,
    loadCentralDataConfig,
    resolveScanPaths,
    resolvePathFromBase,
    normalizeRelativePath,
    getInitTemplates,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
    DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
    DEFAULT_BASELINE,
    DEFAULT_CONFIG,
    PROFILE_RULES
} = require('./config');
const {
    runScan,
    scanMockDataDirectories,
    formatBytes,
    categoryForExt,
    validateSampleSchema,
    groupIssues,
    isBlockingIssue,
    countBySeverity
} = require('./scan');
const { evaluateGate } = require('./gate');
const { formatTextReport, formatActionPlanReport } = require('./reporters/text');
const { formatJsonReport } = require('./reporters/json');
const { formatGithubComment, formatGithubStepSummary, postGithubComment } = require('./reporters/github-comment');
const { buildAssessmentReport } = require('./assessment');
const {
    compileAuditReportMarkdown,
    formatReportDate,
    capitalize: _capitalize,
    pluralize: _pluralize,
    truncate: _truncate
} = require('./reporters/audit-report');
const { buildFictionPatternCatalog, countFictionIssues } = require('./rules/ai-fiction-detection');
const { startGateway, createGateway } = require('./proxy/gateway');
const { evaluateComplianceChecklist, loadComplianceChecklist } = require('./compliance-checklist');
const {
    redactSecretsInString,
    sanitizeScanReport,
    sanitizeAssessment,
    sanitizeReportForCloudUpload,
    sanitizePublicOutput,
    applyPublicGateToAnalyzeResponse
} = require('./lib/report-sanitizer');
const {
    sanitizeCompleteScanExport,
    sanitizeNpmAuditExport,
    sanitizeCleanupBriefExport,
    sanitizeDataCleanupReportExport,
    sanitizeCodebaseReportExport,
    sanitizeFictionDigestExport,
    sanitizeConsolidationExport,
    sanitizeComplianceChecklistArtifactExport,
    sanitizeRoadmapForBenchmark,
    sanitizeGateReportForComplianceExport,
    buildProductCompleteScanHygieneSummary,
    buildProductCompleteScanScanScope,
    hasHollowGateAttestation,
    assembleBenchmarkCompleteScanExportNotes
} = require('./lib/complete-scan-export-sanitize.js');
const { sanitizePublicSummaryArtifactExport } = require('./lib/public-summary-export-sanitize.js');
const { projectLabelFromPath, redactProjectPathForExport } = require('./lib/assessment-export-sanitize.js');
const { buildReAttestationNoteArtifact } = require('./lib/re-attestation-note-export-sanitize.js');
const { sanitizeRoadmapExport } = require('./lib/roadmap-export-sanitize.js');
const { sanitizeSimplebeaconReportExport } = require('./lib/simplebeacon-report-export-sanitize.js');
const { validateConfig } = require('./config-schema.js');
const { DEFAULT_MAX_STALE_MS, evaluateSprintFreshness, evaluateEuExportEligibility } = require('./eu-ai-act-export-guard.js');
const { isLegalReviewAttestation } = require('./eu-ai-act-legal-attestation.js');
const { syncJestBaseline, verifyJestBaseline } = require('./baseline-sync');
const { installSimplebeaconHook, buildHookScript } = require('./hook-install');
const {
    createNetworkGuard,
    snapshotFileState,
    assertFileUnchanged,
    printTrustBanner,
    printTrustCompletion
} = require('./lib/trust-guard');
const { withTransactionSync } = require('./lib/transaction-manager');
const { writeManagedFileSync } = require('./lib/safe-write');
const { sanitizePath, PathSanitizer } = require('./lib/path-sanitizer');
const {
    SimplebeaconError,
    ConfigError,
    ScanError,
    PathError
} = require('./lib/errors');
const {
    normalizePathKey,
    isPathWithinRoot,
    resolveCliProjectRoot
} = require('./lib/path-utils');
const { sanitizeFilePath } = require('./lib/input-sanitizer');
const { runFileReductionScan } = require('./lib/file-reduction-orchestrator');
const { generateFileReductionReport } = require('./reporters/file-reduction-report');
const { aggregateCleanupFindings } = require('./lib/result-aggregator');
const { initSimplebeacon, buildInitDryRunPlan } = require('./lib/init-simplebeacon.cjs');
const { countRepositoryInventory } = require('./lib/repository-inventory');
const { createMcpToolHandlers, TOOL_DEFINITIONS } = require('./mcp/tools');
const { createMcpStdioServer } = require('./mcp/stdio-server');
const { scanSnippetContent, scanFileOnDisk, readGateStatus } = require('./lib/snippet-scanner');
const { version } = require('../package.json');
const { buildAnonymizedExport, signAnonymizedExport, verifyAnonymizedExport, validateAnonymizedSchema, attachAnalyzerSuiteToReport } = require('./lib/anonymized-export');
const {
    buildAiSystemsIssueAnalysis,
    isEmpty: _isEmpty,
    ensureArray: _ensureArray,
    deepEqual: _deepEqual,
    sortBy: _sortBy,
    flatten: _flatten,
    range: _range,
    unique: _unique,
    partition: _partition,
    chunk: _chunk,
    times: _times,
    get: _get,
    set: _set,
    seq: _seq,
    identity: _identity,
    constant: _constant,
    random: _random,
    sleep: _sleep,
    delay: _delay,
    parseJsonSafe: _parseJsonSafe,
    tryFn: _tryFn,
    memoize: _memoize,
    hash: _hash,
    randomId: _randomId
} = require('./lib/ai-problem-analyzer-suite');
const { getCachedAnalysis, setCachedAnalysis, clearCache: clearAnalyzerCache } = require('./lib/ai-problem-analyzer-cache');
const { sanitizeAiProblemAnalyzerExport } = require('./lib/ai-problem-analyzer-export-sanitize');

// ── Inline utility helpers (extracted to sub-modules) ─────────────────────
const {
    withTimeout,
    retry,
    debounce,
    once
} = require('./utils/async');
const {
    pick,
    omit,
    compact,
    groupBy: _groupBy,
    keyBy: _keyBy,
    zipObject
} = require('./utils/object');
const {
    kebabCase,
    camelCase,
    snakeCase,
    padStart,
    padEnd,
    escapeRegExp,
    formatDuration,
    formatNumber,
    isBlank
} = require('./utils/string');
const {
    noop,
    assertNever
} = require('./utils/functional');

/**
 * Resolve the set of mock-data directories to scan for a project.
 * @param {string} baseDir
 * @param {string[]} [extraPaths=[]]
 * @returns {string[]}
 */
function resolveMockDataScanPaths(baseDir, extraPaths = []) {
    const safeBase = baseDir && typeof baseDir === 'string' ? baseDir : process.cwd();
    const resolved = resolvePlatformRoot(safeBase);
    if (!resolved || typeof resolved !== 'object') {
        throw new PathError(`Could not resolve platform root object from: ${safeBase}`);
    }
    const { platformRoot } = resolved;
    if (!platformRoot) {
        throw new PathError(`Resolved platform root is empty for: ${safeBase}`);
    }
    let mockPaths;
    try {
        const central = loadCentralDataConfig(platformRoot);
        const rawMockPaths = central?.mockDataScan?.paths;
        mockPaths = Array.isArray(rawMockPaths) ? rawMockPaths : DEFAULT_MOCK_SCAN_RELATIVE_PATHS;
    } catch {
        mockPaths = DEFAULT_MOCK_SCAN_RELATIVE_PATHS;
    }
    const safeExtras = Array.isArray(extraPaths)
        ? extraPaths.filter(p => typeof p === 'string' && p.length > 0)
        : [];
    try {
        return resolveScanPaths(platformRoot, { scanPaths: mockPaths }, safeExtras);
    } catch (err) {
        throw new PathError(`Failed to resolve mock-data scan paths: ${err?.message || err}`);
    }
}

/**
 * Load a single key from simplebeacon config, falling back to a default.
 * @param {string} baseDir
 * @param {string} key
 * @param {Object|Array|string|number|boolean|null} fallback
 * @returns {Object|Array|string|number|boolean|null}
 */
function _loadConfigKey(baseDir, key, fallback) {
    if (typeof key !== 'string' || key.length === 0) {
        return fallback;
    }
    try {
        const safeBase = (baseDir && typeof baseDir === 'string') ? baseDir : '.';
        const config = loadSimplebeaconConfig(safeBase);
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return fallback;
        }
        if (Object.prototype.hasOwnProperty.call(config, key)) {
            return config[key];
        }
        return fallback;
    } catch {
        return fallback;
    }
}

/**
 * Load the repository audit baseline from simplebeacon config.
 * @param {string} baseDir
 * @returns {Object}
 */
function getRepositoryAuditBaseline(baseDir) {
    return _loadConfigKey(baseDir, 'baseline', DEFAULT_BASELINE);
}

/**
 * Load the consistency anchor samples from simplebeacon config.
 * @param {string} baseDir
 * @returns {Array<string>}
 */
function getConsistencyAnchorSamples(baseDir) {
    return _loadConfigKey(baseDir, 'consistencyAnchorSamples', DEFAULT_CONSISTENCY_ANCHOR_SAMPLES);
}

// ── Flat exports (backward compatible) ───────────────────────────────────

module.exports = {
    // ── Metadata ──
    version,

    // ── Config ──
    loadSimplebeaconConfig,
    loadSamplebeaconConfig: loadSimplebeaconConfig,
    loadCentralDataConfig,
    resolveScanPaths,
    resolveMockDataScanPaths,
    countRepositoryInventory,
    resolvePathFromBase,
    normalizeRelativePath,
    getInitTemplates,
    initSimplebeacon,
    initSamplebeacon: initSimplebeacon,
    buildInitDryRunPlan,
    getRepositoryAuditBaseline,
    getConsistencyAnchorSamples,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
    DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
    DEFAULT_BASELINE,
    DEFAULT_CONFIG,
    PROFILE_RULES,
    validateConfig,

    // ── Scan & Analysis ──
    runScan,
    scanMockDataDirectories,
    formatBytes,
    categoryForExt,
    validateSampleSchema,
    groupIssues,
    isBlockingIssue,
    countBySeverity,

    // ── Gate ──
    evaluateGate,

    // ── Reporters ──
    formatTextReport,
    formatActionPlanReport,
    formatJsonReport,
    formatGithubComment,
    formatGithubStepSummary,
    postGithubComment,
    buildAssessmentReport,
    compileAuditReportMarkdown,
    generateFileReductionReport,
    aggregateCleanupFindings,
    formatReportDate,
    capitalize: _capitalize,
    pluralize: _pluralize,
    truncate: _truncate,

    // ── Fiction Detection ──
    buildFictionPatternCatalog,
    countFictionIssues,

    // ── Proxy / Gateway ──
    startGateway,
    createGateway,

    // ── Compliance ──
    evaluateComplianceChecklist,
    loadComplianceChecklist,
    DEFAULT_MAX_STALE_MS,
    evaluateSprintFreshness,
    evaluateEuExportEligibility,
    isLegalReviewAttestation,

    // ── Sanitizers ──
    redactSecretsInString,
    sanitizeScanReport,
    sanitizeAssessment,
    sanitizeReportForCloudUpload,
    sanitizePublicOutput,
    applyPublicGateToAnalyzeResponse,

    // ── Baseline & Hooks ──
    syncJestBaseline,
    verifyJestBaseline,
    installSimplebeaconHook,
    buildHookScript,

    // ── Project Detection ──
    detectProjectProfile,
    resolvePlatformRoot,

    // ── Trust & Safety ──
    createNetworkGuard,
    snapshotFileState,
    assertFileUnchanged,
    printTrustBanner,
    printTrustCompletion,
    writeManagedFileSync,
    withTransactionSync,

    // ── Errors ──
    SimplebeaconError,
    ConfigError,
    ScanError,
    PathError,

    // ── Path Utilities ──
    normalizePathKey,
    isPathWithinRoot,
    resolveCliProjectRoot,
    sanitizeFilePath,
    sanitizePath,
    PathSanitizer,

    // ── File Reduction ──
    runFileReductionScan,

    // ── MCP ──
    createMcpToolHandlers,
    TOOL_DEFINITIONS,
    createMcpStdioServer,
    scanSnippetContent,
    scanFileOnDisk,
    readGateStatus,

    // ── Export Sanitizers ──
    buildAnonymizedExport,
    signAnonymizedExport,
    verifyAnonymizedExport,
    validateAnonymizedSchema,
    attachAnalyzerSuiteToReport,
    buildAiSystemsIssueAnalysis,
    getCachedAnalysis,
    setCachedAnalysis,
    clearAnalyzerCache,
    sanitizeAiProblemAnalyzerExport,
    sanitizeCompleteScanExport,
    sanitizeNpmAuditExport,
    sanitizeCleanupBriefExport,
    sanitizeDataCleanupReportExport,
    sanitizeCodebaseReportExport,
    sanitizeFictionDigestExport,
    sanitizeConsolidationExport,
    sanitizeComplianceChecklistArtifactExport,
    sanitizeRoadmapForBenchmark,
    sanitizeGateReportForComplianceExport,
    sanitizePublicSummaryArtifactExport,
    projectLabelFromPath,
    redactProjectPathForExport,
    buildReAttestationNoteArtifact,
    sanitizeRoadmapExport,
    sanitizeSimplebeaconReportExport,
    buildProductCompleteScanHygieneSummary,
    buildProductCompleteScanScanScope,
    hasHollowGateAttestation,
    assembleBenchmarkCompleteScanExportNotes,

    // ── Re-exported ai-problem-analyzer-suite helpers ──
    isEmpty: _isEmpty,
    ensureArray: _ensureArray,
    deepEqual: _deepEqual,
    sortBy: _sortBy,
    flatten: _flatten,
    range: _range,
    unique: _unique,
    partition: _partition,
    chunk: _chunk,
    times: _times,
    get: _get,
    set: _set,
    seq: _seq,
    identity: _identity,
    constant: _constant,
    random: _random,
    sleep: _sleep,
    delay: _delay,
    parseJsonSafe: _parseJsonSafe,
    tryFn: _tryFn,
    memoize: _memoize,
    hash: _hash,
    randomId: _randomId,

    // ── Inline utility helpers ──
    withTimeout,
    retry,
    pick,
    omit,
    compact,
    groupBy: _groupBy,
    keyBy: _keyBy,
    zipObject,
    kebabCase,
    camelCase,
    snakeCase,
    padStart,
    padEnd,
    escapeRegExp,
    formatDuration,
    noop,
    assertNever,
    debounce,
    once,
    formatNumber,
    isBlank
};

// ── Namespaced API for discoverability ────────────────────────────────────

const Simplebeacon = {
    version,
    config: {
        loadSimplebeaconConfig,
        loadCentralDataConfig,
        resolveScanPaths,
        resolveMockDataScanPaths,
        countRepositoryInventory,
        resolvePathFromBase,
        normalizeRelativePath,
        getInitTemplates,
        initSimplebeacon,
        buildInitDryRunPlan,
        getRepositoryAuditBaseline,
        getConsistencyAnchorSamples,
        DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
        DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
        DEFAULT_BASELINE,
        DEFAULT_CONFIG,
        PROFILE_RULES,
        validateConfig
    },
    scan: {
        runScan,
        scanMockDataDirectories,
        formatBytes,
        categoryForExt,
        validateSampleSchema,
        groupIssues,
        isBlockingIssue,
        countBySeverity
    },
    gate: {
        evaluateGate
    },
    report: {
        formatTextReport,
        formatActionPlanReport,
        formatJsonReport,
        formatGithubComment,
        formatGithubStepSummary,
        postGithubComment,
        buildAssessmentReport,
        compileAuditReportMarkdown,
        generateFileReductionReport,
        aggregateCleanupFindings,
        formatReportDate
    },
    fiction: {
        buildFictionPatternCatalog,
        countFictionIssues
    },
    proxy: {
        startGateway,
        createGateway
    },
    compliance: {
        evaluateComplianceChecklist,
        loadComplianceChecklist,
        DEFAULT_MAX_STALE_MS,
        evaluateSprintFreshness,
        evaluateEuExportEligibility,
        isLegalReviewAttestation
    },
    sanitize: {
        redactSecretsInString,
        sanitizeScanReport,
        sanitizeAssessment,
        sanitizeReportForCloudUpload,
        sanitizePublicOutput,
        applyPublicGateToAnalyzeResponse,
        buildAnonymizedExport,
        signAnonymizedExport,
        verifyAnonymizedExport,
        validateAnonymizedSchema,
        attachAnalyzerSuiteToReport,
        buildAiSystemsIssueAnalysis,
        sanitizeAiProblemAnalyzerExport,
        sanitizeCompleteScanExport,
        sanitizeNpmAuditExport,
        sanitizeCleanupBriefExport,
        sanitizeDataCleanupReportExport,
        sanitizeCodebaseReportExport,
        sanitizeFictionDigestExport,
        sanitizeConsolidationExport,
        sanitizeComplianceChecklistArtifactExport,
        sanitizeRoadmapForBenchmark,
        sanitizeGateReportForComplianceExport,
        sanitizePublicSummaryArtifactExport,
        projectLabelFromPath,
        redactProjectPathForExport,
        buildReAttestationNoteArtifact,
        sanitizeRoadmapExport,
        sanitizeSimplebeaconReportExport,
        buildProductCompleteScanHygieneSummary,
        buildProductCompleteScanScanScope,
        hasHollowGateAttestation,
        assembleBenchmarkCompleteScanExportNotes
    },
    baseline: {
        syncJestBaseline,
        verifyJestBaseline
    },
    hooks: {
        installSimplebeaconHook,
        buildHookScript
    },
    project: {
        detectProjectProfile,
        resolvePlatformRoot
    },
    trust: {
        createNetworkGuard,
        snapshotFileState,
        assertFileUnchanged,
        printTrustBanner,
        printTrustCompletion,
        writeManagedFileSync,
        withTransactionSync
    },
    errors: {
        SimplebeaconError,
        ConfigError,
        ScanError,
        PathError
    },
    path: {
        normalizePathKey,
        isPathWithinRoot,
        resolveCliProjectRoot,
        sanitizeFilePath,
        sanitizePath,
        PathSanitizer
    },
    mcp: {
        createMcpToolHandlers,
        TOOL_DEFINITIONS,
        createMcpStdioServer,
        scanSnippetContent,
        scanFileOnDisk,
        readGateStatus
    },
    utils: {
        withTimeout,
        retry,
        pick,
        omit,
        compact,
        groupBy: _groupBy,
        keyBy: _keyBy,
        zipObject,
        kebabCase,
        camelCase,
        snakeCase,
        padStart,
        padEnd,
        escapeRegExp,
        formatDuration,
        noop,
        assertNever,
        debounce,
        once,
        formatNumber,
        isBlank,
        isEmpty: _isEmpty,
        ensureArray: _ensureArray,
        deepEqual: _deepEqual,
        sortBy: _sortBy,
        flatten: _flatten,
        range: _range,
        unique: _unique,
        partition: _partition,
        chunk: _chunk,
        times: _times,
        get: _get,
        set: _set,
        seq: _seq,
        identity: _identity,
        constant: _constant,
        random: _random,
        sleep: _sleep,
        delay: _delay,
        parseJsonSafe: _parseJsonSafe,
        tryFn: _tryFn,
        memoize: _memoize,
        hash: _hash,
        randomId: _randomId,
        capitalize: _capitalize,
        pluralize: _pluralize,
        truncate: _truncate
    }
};

module.exports.Simplebeacon = Object.freeze(Simplebeacon);
Object.freeze(module.exports);
