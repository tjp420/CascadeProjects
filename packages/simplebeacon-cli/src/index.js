/**
 * simplebeacon — public API
 */

const fs = require('fs');
const path = require('path');
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
const { compileAuditReportMarkdown } = require('./reporters/audit-report');
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
const { validateJSON, validateNotEmpty } = require('./lib/file-validator');
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
const { countRepositoryInventory } = require('./lib/repository-inventory');

function resolveMockDataScanPaths(baseDir, extraPaths = []) {
    const { platformRoot } = resolvePlatformRoot(baseDir);
    const central = loadCentralDataConfig(platformRoot);
    const mockPaths = central?.mockDataScan?.paths || DEFAULT_MOCK_SCAN_RELATIVE_PATHS;
    return resolveScanPaths(platformRoot, { scanPaths: mockPaths }, extraPaths);
}

function getRepositoryAuditBaseline(baseDir) {
    return loadSimplebeaconConfig(baseDir).baseline;
}

function getConsistencyAnchorSamples(baseDir) {
    return loadSimplebeaconConfig(baseDir).consistencyAnchorSamples;
}

function buildInitDryRunPlan(root, templates, options = {}) {
    const simplebeaconDir = path.join(root, '.simplebeacon');
    const configPath = path.join(simplebeaconDir, 'config.json');
    const baselinePath = path.join(simplebeaconDir, 'baseline.json');
    const force = Boolean(options.force);

    const plannedActions = [
        { action: 'mkdir', path: simplebeaconDir }
    ];

    const configExists = fs.existsSync(configPath);
    const baselineExists = fs.existsSync(baselinePath);

    plannedActions.push({
        action: configExists ? (force ? 'overwrite' : 'skip') : 'create',
        path: configPath
    });
    plannedActions.push({
        action: baselineExists ? (force ? 'overwrite' : 'skip') : 'create',
        path: baselinePath
    });

    return {
        dryRun: true,
        configPath,
        baselinePath,
        simplebeaconDir,
        profile: templates.profile,
        detected: templates.detected,
        plannedActions,
        configCreated: !configExists || force,
        configSkipped: configExists && !force,
        baselineCreated: !baselineExists || force,
        baselineSkipped: baselineExists && !force
    };
}

function initSimplebeacon(baseDir, options = {}) {
    const root = path.resolve(sanitizePath(baseDir));
    const templates = getInitTemplates(root, options);
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);

    if (dryRun) {
        return buildInitDryRunPlan(root, templates, options);
    }

    return withTransactionSync((transaction) => {
        const simplebeaconDir = path.join(root, '.simplebeacon');
        fs.mkdirSync(simplebeaconDir, { recursive: true });

        const configPath = path.join(simplebeaconDir, 'config.json');
        const baselinePath = path.join(simplebeaconDir, 'baseline.json');
        const configContent = `${JSON.stringify(templates.config, null, 2)}\n`;
        const baselineContent = `${JSON.stringify(templates.baseline, null, 2)}\n`;

        const configWrite = writeManagedFileSync(configPath, configContent, {
            skipIfExists: !force,
            force,
            transaction,
            validators: [validateJSON, validateNotEmpty]
        });

        const baselineWrite = writeManagedFileSync(baselinePath, baselineContent, {
            skipIfExists: !force,
            force,
            transaction,
            validators: [validateJSON, validateNotEmpty]
        });

        return {
            configPath,
            baselinePath,
            simplebeaconDir,
            profile: templates.profile,
            detected: templates.detected,
            configCreated: !configWrite.skipped,
            configSkipped: Boolean(configWrite.skipped),
            baselineCreated: !baselineWrite.skipped,
            baselineSkipped: Boolean(baselineWrite.skipped),
            backups: [configWrite.backupPath, baselineWrite.backupPath].filter(Boolean)
        };
    });
}

module.exports = {
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
    getRepositoryAuditBaseline,
    getConsistencyAnchorSamples,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
    DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
    DEFAULT_BASELINE,
    DEFAULT_CONFIG,
    PROFILE_RULES,
    runScan,
    scanMockDataDirectories,
    formatBytes,
    categoryForExt,
    validateSampleSchema,
    groupIssues,
    isBlockingIssue,
    countBySeverity,
    evaluateGate,
    formatTextReport,
    formatActionPlanReport,
    formatJsonReport,
    formatGithubComment,
    formatGithubStepSummary,
    postGithubComment,
    buildAssessmentReport,
    compileAuditReportMarkdown,
    buildFictionPatternCatalog,
    countFictionIssues,
    startGateway,
    createGateway,
    evaluateComplianceChecklist,
    loadComplianceChecklist,
    redactSecretsInString,
    sanitizeScanReport,
    sanitizeAssessment,
    sanitizeReportForCloudUpload,
    sanitizePublicOutput,
    applyPublicGateToAnalyzeResponse,
    syncJestBaseline,
    verifyJestBaseline,
    installSimplebeaconHook,
    buildHookScript,
    detectProjectProfile,
    resolvePlatformRoot,
    createNetworkGuard,
    snapshotFileState,
    assertFileUnchanged,
    printTrustBanner,
    printTrustCompletion,
    writeManagedFileSync,
    withTransactionSync,
    SimplebeaconError,
    ConfigError,
    ScanError,
    PathError,
    normalizePathKey,
    isPathWithinRoot,
    resolveCliProjectRoot,
    sanitizeFilePath,
    sanitizePath,
    PathSanitizer,
    runFileReductionScan,
    generateFileReductionReport,
    aggregateCleanupFindings,
    createMcpToolHandlers: require('./mcp/tools').createMcpToolHandlers,
    TOOL_DEFINITIONS: require('./mcp/tools').TOOL_DEFINITIONS,
    createMcpStdioServer: require('./mcp/stdio-server').createMcpStdioServer,
    scanSnippetContent: require('./lib/snippet-scanner').scanSnippetContent,
    scanFileOnDisk: require('./lib/snippet-scanner').scanFileOnDisk,
    readGateStatus: require('./lib/snippet-scanner').readGateStatus,
    buildAnonymizedExport: require('./lib/anonymized-export').buildAnonymizedExport,
    signAnonymizedExport: require('./lib/anonymized-export').signAnonymizedExport,
    verifyAnonymizedExport: require('./lib/anonymized-export').verifyAnonymizedExport,
    validateAnonymizedSchema: require('./lib/anonymized-export').validateAnonymizedSchema,
    attachAnalyzerSuiteToReport: require('./lib/anonymized-export').attachAnalyzerSuiteToReport,
    buildAiSystemsIssueAnalysis: require('./lib/ai-problem-analyzer-suite').buildAiSystemsIssueAnalysis,
    getCachedAnalysis: require('./lib/ai-problem-analyzer-cache').getCachedAnalysis,
    setCachedAnalysis: require('./lib/ai-problem-analyzer-cache').setCachedAnalysis,
    clearAnalyzerCache: require('./lib/ai-problem-analyzer-cache').clearCache,
    sanitizeAiProblemAnalyzerExport: require('./lib/ai-problem-analyzer-export-sanitize').sanitizeAiProblemAnalyzerExport,
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
    validateConfig,
    DEFAULT_MAX_STALE_MS,
    evaluateSprintFreshness,
    evaluateEuExportEligibility,
    isLegalReviewAttestation,
    buildProductCompleteScanHygieneSummary,
    buildProductCompleteScanScanScope,
    hasHollowGateAttestation,
    assembleBenchmarkCompleteScanExportNotes
};
