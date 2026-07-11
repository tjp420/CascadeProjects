/**
 * Flexible directory analysis — any path + AI provider + analysis mode.
 *
 * EU AI Act Article 50 Disclosure: This endpoint may use AI models to generate analysis summaries.
 * AI-generated narratives are flagged in the response payload for transparency.
 * Article 12: Inference events are logged via ai-inference-audit-logger.
 */

const logger = require('../../src/lib/app-logger.cjs');

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const util = require('util');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const constants = require('../config/constants.cjs');
const execAsync = util.promisify(exec);
const multer = require('multer');
const tmp = require('tmp');
const rateLimit = require('express-rate-limit');
const unzipper = require('unzipper');
const { optionalAuthenticate } = require('../middleware/auth.cjs');
// Dynamic reload wrapper: always load the latest codebase-analyzer.cjs to pick up patches without server restart
function getAnalyzeCodebase() {
    const modulePath = require.resolve('../lib/codebase-analyzer.cjs');
    // Clear cache for the analyzer and its direct submodules so patches take effect immediately
    const keysToDelete = Object.keys(require.cache).filter((key) => key.includes('server/lib/codebase-analyzer') || key.includes('server/lib/scan-content-patterns') || key.includes('server/lib/universal-language-config'));
    for (const key of keysToDelete) {
        delete require.cache[key];
    }
    delete require.cache[modulePath];
    const analyzer = require('../lib/codebase-analyzer.cjs');
    if (!analyzer || typeof analyzer.analyzeCodebase !== 'function') {
        throw new Error('codebase-analyzer module did not export a valid analyzeCodebase function');
    }
    return analyzer.analyzeCodebase;
}
const { resolveScanProfile } = require('../lib/universal-language-config.cjs');
const { analyzeWithModel } = require('../services/model-inference-service.cjs');
const { ensureRegistry } = require('../services/local-model-service.cjs');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath,
    isPathWithinRoots,
    isPathAncestorOfRoots,
    dedupeResolvedRoots,
    logResolvedAllowedRoots,
    formatAllowedRootsSummary
} = require('../lib/path-safety.cjs');
const { toClientError } = require('../lib/client-error.cjs');
const {
    sanitizeHttpHeaderValue,
    shouldLogRuntimeInfo,
    withTimeout,
    safeBasename,
    normalizeStringList,
    resolveProjectPath,
    isSameResolvedPath,
    deriveSeverityCounts,
    resolveModelId,
    normalizeReportForSummary,
    safeString,
    safeErrorMessage,
    countFiles,
    sanitizeUploadPath,
    sanitizeReportForAi,
    isPrivateHostname,
    cleanupWebsiteTemp,
    sendAnalyzeJson,
    rejectPaidDeliverable,
    buildSuccessResponse,
    buildErrorResponse,
    pickBodyField,
    coerceBoolean,
    limitValue,
    requireIfExists,
    sanitizeUrl,
    loadUserCredentials,
    resolveMockScanPaths,
    pathLooksLikeMockScan,
    resolveAnalysisType,
    resolveOllamaSummaryProvider,
    resolveSummaryProvider,
    fetchWebsiteToTemp
} = require('../lib/flexible-analyze-utils.cjs');
const { logInferenceEvent } = require('../lib/ai-inference-audit-logger.cjs');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store.cjs');
const {
    listAvailableProviders,
    providerConfigured,
    summarizeScanWithProvider
} = require('../services/cloud-inference-service.cjs');
const { analyzeStrategicInsights } = require('../lib/strategic-insights-engine.cjs');
const { runNpmAuditAsync } = require('../lib/npm-audit-runner.cjs');
const { scanFileMergerReduction } = require('../lib/file-merger-reduction-scanner.cjs');
const { scanRemovableFiles } = require('../lib/removable-files-scanner.cjs');
const {
    applyPublicGateToAnalyzeResponse,
    countRepositoryInventory,
    evaluateComplianceChecklist,
    resolvePlatformRoot,
    sanitizeComplianceBundleExport,
    verifyLicenseToken
} = require('../lib/simplebeacon-proxy.cjs');
const { generateCodeRoadmap } = require('../lib/code-roadmap-generator.cjs');
const { runDataCleanupScan } = require('../lib/data-cleanup-scan.cjs');
const { patchRemediationPhases } = require('../lib/scan-report-patch.cjs');
const { buildCompleteAuditModel } = require('../lib/complete-scan-audit-report.cjs');
const {
    understandCodeSnippet,
    understandFile,
    attachUnderstandingToCodebaseReport,
    appendExpertReview,
    loadExpertReviews,
    generateZscriptModReport
} = require('../lib/code-understanding/index.cjs');
const { listAnalyzeTestSources } = require('../lib/analyze-test-sources.cjs');
const { scanMockFiles } = require('../routes/repository-scanner-api.cjs');
const { getLimits } = require('../../../coming-soon/lib/plans.cjs');
// note: coming-soon is a sibling package, kept as-is since it is not part of simplebeacon-cli
const { buildRoadmapFromPath } = require('./lib/flexible-analyze-roadmap.cjs');

// In-memory async scan jobs for /api/analyze/upload-directory polling
const scanJobs = new Map();
const SCAN_JOB_TTL_MS = 20 * constants.ONE_MINUTE_MS; // 20 minutes (covers CLI 15m + analyses timeout)
const _scanJobCleanupInterval = setInterval(() => { // simplebeacon-ignore memory-leak — server-side job cleanup timer, process lifetime
    const now = Date.now();
    for (const [id, job] of scanJobs) {
        if (now - job.createdAt > SCAN_JOB_TTL_MS) {
            if (job.status === 'scanning') {
                scanJobs.set(id, { ...job, status: 'error', error: 'Scan timed out after 20 minutes' });
                try { fs.rmSync(job.tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
                // Keep the entry for one more TTL cycle so polling clients can see the error state
                continue;
            }
            try { fs.rmSync(job.tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
            scanJobs.delete(id);
        }
    }
}, constants.ONE_MINUTE_MS);
// Allow tests and graceful shutdown to stop the background timer
if (_scanJobCleanupInterval && _scanJobCleanupInterval.unref) _scanJobCleanupInterval.unref();
const {
    loadAgencyBranding,
    saveAgencyBranding
} = require('../lib/agency-branding-store.cjs');
const { sendEmail } = require('../lib/email-service.cjs');
const {
    buildCertificateModel,
    renderCertificateHtml
} = require('../lib/code-hygiene-certificate.cjs');
const { buildAnalyzeExportZipStream } = require('../lib/analyze-export-bundle.cjs');
const { generateAutomatedVerdict, emailAutomatedVerdict } = require('../lib/ai-analyst.cjs');
const { DEFAULT_OLLAMA_URL } = require('../services/ollama-client.cjs');
const { evaluateHumanOversightCompliance } = require('../lib/compliance-rules.cjs');
const { progressiveAnalysis, ANALYSIS_PROFILES, StreamingAnalyzer } = require('../lib/enhanced-ai-orchestrator.cjs');
const { getModelManager } = require('../services/enhanced-model-manager.cjs');
const { detectMLPatterns } = require('../lib/code-understanding/ml-pattern-detector.cjs');


/**
 * Resolve the list of filesystem roots that analysis requests are allowed to access.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {string[]}
 */
function resolveAnalyzeAllowedRoots(baseDir, options = {}) {
    if (typeof baseDir !== 'string') return [];
    const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const monorepoRoot = opts.monorepoRoot
        || path.resolve(path.join(baseDir, '..'));
    return resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
}

/**
 * Setup flexible analyze API.
 * @param {import('express').Application} app
 * @param {Object} options
 * @returns {void}
 */
function setupFlexibleAnalyzeAPI(app, options = {}) {
    if (!app || typeof app.use !== 'function') {
        throw new TypeError('setupFlexibleAnalyzeAPI requires a valid Express app instance');
    }
    const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const baseDir = opts.baseDir || path.join(__dirname, '..', '..');
    const monorepoRoot = opts.monorepoRoot || path.resolve(path.join(baseDir, '..'));
    if (!fs.existsSync(baseDir)) {
        logger.warn('[Analyze] baseDir does not exist:', { baseDir, monorepoRoot });
    }
    const publicGateEnabled = opts.publicGateEnabled === true
        || (opts.publicGateEnabled !== false && process.env.SIMPLEBEACON_PUBLIC_GATE === 'true');
    const closedVaultMode = opts.closedVaultMode === true
        || process.env.SIMPLEBEACON_CLOSED_VAULT === 'true';
    const auditCheckoutUrl = opts.auditCheckoutUrl
        || process.env.SIMPLEBEACON_AUDIT_CHECKOUT_URL
        || 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';

    const sendAnalyzeJsonOpts = { publicGateEnabled, applyPublicGateToAnalyzeResponse };

    function hasAdminDeliverableAccess(req) {
        const user = req.user;
        if (!user) return false;
        const role = String(user.role || '').toLowerCase();
        const tier = String(user.tier || '').toLowerCase();
        if (role === 'superuser' || role === 'admin') return true;
        if (tier === 'superuser' || tier === 'admin') return true;
        if (Array.isArray(user.features) && user.features.map(String).map(s => s.toLowerCase()).includes('all_modules')) return true;
        if (Array.isArray(user.permissions) && user.permissions.includes('admin:all')) return true;
        if (user.trustLevel === 'platinum' || user.trustLevel === 'operator') return true;
        return false;
    }

    app.get('/api/simplebeacon/entitlements', optionalAuthenticate, (req, res) => {
        const locked = publicGateEnabled || closedVaultMode;
        const adminAccess = hasAdminDeliverableAccess(req);
        const debugClientErrors = process.env.DEBUG_CLIENT_ERRORS === '1' || req.query.debug === '1';
        const response = {
            success: true,
            publicGateLocked: locked,
            closedVaultMode,
            hasAuditDeliverableAccess: (!publicGateEnabled && !closedVaultMode) || adminAccess,
            auditCheckoutUrl,
            auditPriceLabel: '$499'
        };
        if (debugClientErrors && req.user) {
            response._debug = {
                role: req.user.role,
                tier: req.user.tier,
                features: req.user.features,
                trustLevel: req.user.trustLevel,
                adminAccess
            };
        }
        res.json(response);
    });

    if (closedVaultMode) {
        app.use('/api/analyze', (req, res) => {
            res.status(403).json({
                success: false,
                closedVaultMode: true,
                error: 'Public scanning is disabled. Book a private pre-launch audit at simplebeacon.ai.',
                checkoutUrl: auditCheckoutUrl,
                auditPriceLabel: '$499'
            });
        });
        logger.info('[Flexible Analyze API] Closed vault — /api/analyze disabled on public deploy');
        return;
    }

    if (process.env.REQUIRE_AUTH === 'true') {
        const { authenticate, optionalAuthenticate } = require('../middleware/auth.cjs');
        app.use('/api/analyze/upload-directory', optionalAuthenticate);
        app.use('/api/analyze/progress', optionalAuthenticate);
        app.use('/api/analyze', (req, res, next) => {
            if (req.path === '/upload-directory' || req.path === '/progress') return next();
            return authenticate(req, res, next);
        });
    }

/**
 * Get allowed roots.
 * @returns {any}
 */
    function getAllowedRoots() {
        return resolveAnalyzeAllowedRoots(baseDir, { monorepoRoot });
    }

    logResolvedAllowedRoots(getAllowedRoots(), 'analyze-api startup');

/**
 * Resolve safe project path.
 * @param {string} rawPath
 * @returns {any}
 */
    function resolveSafeProjectPath(rawPath) {
        if (typeof rawPath !== 'string') return null;
        const candidate = resolveProjectPath(baseDir, rawPath, monorepoRoot);
        if (!candidate) return null;
        return assertSafeProjectPath(candidate, getAllowedRoots());
    }

    app.get('/api/analyze/providers', async (req, res) => {
        try {
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
            const allowedRoots = getAllowedRoots();
            res.json({
                success: true,
                defaultProjectPath: monorepoRoot,
                allowedAnalysisRoots: allowedRoots,
                allowedAnalysisRootsSummary: formatAllowedRootsSummary(allowedRoots),
                providers: listAvailableProviders(registry, userCredentials),
                analysisTypes: [
                    { id: 'auto', label: 'Auto-detect', description: 'Mock scan if JSON found, else roadmap' },
                    { id: 'mock-scan', label: 'Mock data scan', description: 'Run mock-data-scanner on the directory' },
                    { id: 'roadmap', label: 'Project roadmap', description: 'Filesystem sprint scan — optional strategic insights layer' },
                    { id: 'codebase', label: 'Codebase analysis', description: 'Technical debt, broken files, debug artifacts, placeholders' },
                    { id: 'file-reduction', label: 'File reduction', description: 'Build artifacts, duplicate assets, unused files (dry-run)' },
                    { id: 'data-quality', label: 'Data quality', description: 'Config sprawl, env keys, stale data, privacy, lineage, shape drift' }
                ],
                roadmapInsightsModes: [
                    { id: 'off', label: 'Filesystem only', description: 'Pure code-roadmap-generator — no strategic insights block' },
                    { id: 'deterministic', label: 'Deterministic insights', description: 'Rule-based executive summary and risk scoring — no LLM' },
                    { id: 'llm', label: 'LLM strategic layer', description: 'LLM interprets aggregated metrics only — data stays deterministic' }
                ],
                understandingModes: [
                    { id: 'off', label: 'Static only', description: 'Pattern-based static analysis without semantic/context layers' },
                    { id: 'deterministic', label: 'Semantic + context', description: 'Business logic heuristics, intent, git/doc context — no LLM' },
                    { id: 'llm', label: 'AI-enhanced understanding', description: 'Adds AI narrative when a provider is configured' },
                    { id: 'enhanced', label: 'Enhanced ML patterns', description: 'Machine learning-inspired pattern detection with intelligent fallback' }
                ],
                analysisProfiles: [
                    { id: 'quick', label: 'Quick analysis', description: 'Fast, lightweight analysis for quick feedback' },
                    { id: 'balanced', label: 'Balanced analysis', description: 'Comprehensive analysis for general use' },
                    { id: 'comprehensive', label: 'Comprehensive analysis', description: 'Deep analysis with expert reviews' },
                    { id: 'realtime', label: 'Real-time streaming', description: 'Incremental analysis for live updates' }
                ],
                zscriptReport: {
                    endpoint: '/api/analyze/zscript-report',
                    focuses: ['lighting-intensity'],
                    description: 'Structure, CVAR map, function flow, and intensity diagnostics for GZDoom mods'
                },
                scanProfiles: [
                    { id: 'default', label: 'Web + ZScript', description: 'Default CLI profile — web stack plus .zs files' },
                    { id: 'game-dev', label: 'Game dev', description: 'Web + game modding extensions (ZScript, ACS, DECORATE, GLSL, Lua)' },
                    { id: 'universal', label: 'Universal', description: 'All registered language families — used by dashboard scans' }
                ],
                defaultScanProfile: resolveScanProfile({}, 'dashboard')
            });
        } catch (error) {
            res.status(500).json({ success: false, error: toClientError(error, 'Failed to load providers') });
        }
    });

    app.get('/api/analyze/test-sources', async (_req, res) => {
        try {
            const allowedRoots = getAllowedRoots();
            const sources = listAnalyzeTestSources(baseDir, allowedRoots);
            res.json({
                success: true,
                defaultProjectPath: monorepoRoot,
                allowedAnalysisRoots: allowedRoots,
                sources
            });
        } catch (error) {
            res.status(500).json({ success: false, error: toClientError(error, 'Failed to load test sources') });
        }
    });

    app.get('/api/simplebeacon/agency/branding', (req, res) => {
        try {
            const orgId = String(req.query.org_id || req.query.orgId || 'default').trim() || 'default';
            const branding = loadAgencyBranding(baseDir, orgId);
            res.json({ success: true, orgId, branding });
        } catch (error) {
            res.status(500).json({ success: false, error: toClientError(error, 'Failed to load agency branding') });
        }
    });

    app.put('/api/simplebeacon/agency/branding', (req, res) => {
        try {
            const body = req.body || {};
            const orgId = String(body.org_id || body.orgId || req.query.org_id || 'default').trim() || 'default';
            const branding = saveAgencyBranding(baseDir, orgId, body.branding || body);
            res.json({ success: true, orgId, branding });
        } catch (error) {
            res.status(500).json({ success: false, error: toClientError(error, 'Failed to save agency branding') });
        }
    });

    /**
     * Resolve a project path from request body — supports local directories and website URLs.
     * @param {string} rawPath
     * @returns {Promise<{projectPath:string, tempFetchDir:string|null, isWebsite:boolean}>}
     */
    async function resolveAnalyzeProjectPath(rawPath) {
        const trimmed = String(rawPath || '').trim();
        if (!trimmed) {
            throw new Error('projectPath is required');
        }
        if (/^https?:\/\//i.test(trimmed)) {
            const tempFetchDir = await fetchWebsiteToTemp(trimmed);
            return { projectPath: tempFetchDir, tempFetchDir, isWebsite: true };
        }
        const projectPath = resolveSafeProjectPath(trimmed);
        if (!projectPath) {
            throw new Error('projectPath is required');
        }
        return { projectPath, tempFetchDir: null, isWebsite: false };
    }

    app.post('/api/analyze/flexible', async (req, res) => {
        let tempFetchDir = null;
        try {
            const body = req.body || {};
            const rawPath = String(body.projectPath || body.path || '').trim();
            let projectPath;
            let isWebsite = false;

            try {
                const resolved = await resolveAnalyzeProjectPath(rawPath);
                projectPath = resolved.projectPath;
                tempFetchDir = resolved.tempFetchDir;
                isWebsite = resolved.isWebsite;
            } catch (error) {
                const debug = process.env.DEBUG_CLIENT_ERRORS === '1' || process.env.DEBUG_CLIENT_ERRORS === 'true';
                const errorPayload = { success: false, error: toClientError(error, 'Invalid projectPath') };
                logger.warn('[Analyze/Flexible] Path validation failed:', {
                    rawPath,
                    baseDir,
                    monorepoRoot,
                    allowedRoots: getAllowedRoots(),
                    rawError: error instanceof Error ? error.message : String(error)
                });
                if (debug) {
                    errorPayload._debug = {
                        rawPath,
                        baseDir,
                        monorepoRoot,
                        allowedRoots: getAllowedRoots(),
                        rawError: error instanceof Error ? error.message : String(error)
                    };
                }
                return res.status(400).json(errorPayload);
            }

            const aiProvider = String(body.aiProvider || 'active').toLowerCase();
            const analysisType = isWebsite ? 'mock-scan' : await resolveAnalysisType(body.analysisType, projectPath, pathLooksLikeMockScan);
            const registry = await ensureRegistry(baseDir);

            if (analysisType === 'roadmap') {
                const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
                const result = await buildRoadmapFromPath(projectPath, {
                    ...body,
                    userCredentials,
                    registry
                });
                return res.json({
                    success: true,
                    analysisType: 'roadmap',
                    aiProvider,
                    roadmapInsightsMode: String(body.roadmapInsightsMode || 'off').toLowerCase(),
                    roadmap: result.roadmap,
                    historyEntry: result.historyEntry
                });
            }

            if (analysisType === 'codebase') {
                const understandingMode = String(body.understandingMode || 'off').toLowerCase();
                const scanProfile = resolveScanProfile(body, 'dashboard');
                const scanContext = String(body.context || body.scanContext || body.scanMode || 'dashboard').toLowerCase();
                const explicitMaxDeep = Number(body.maxDeepAnalyze);
                const maxDeepAnalyze = Number.isFinite(explicitMaxDeep) && explicitMaxDeep > 0
                    ? Math.min(explicitMaxDeep, 10000)
                    : 5000;
                const analyzeOpts = {
                    includeEslint: body.includeEslint === true || scanContext === 'complete',
                    scanProfile,
                    context: scanContext
                };
                if (maxDeepAnalyze != null) {
                    analyzeOpts.maxDeepAnalyze = maxDeepAnalyze;
                }
                let report = await withTimeout(
                    getAnalyzeCodebase()(projectPath, analyzeOpts),
                    120_000,
                    'flexible codebase analysis'
                );
                if (understandingMode !== 'off') {
                    const registry = await ensureRegistry(baseDir);
                    const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
                    report = await attachUnderstandingToCodebaseReport(report, projectPath, {
                        platformRoot: baseDir,
                        understandingMode,
                        mode: understandingMode,
                        aiProvider: aiProvider,
                        registry,
                        userCredentials
                    });
                }
                return sendAnalyzeJson(res, {
                    success: true,
                    analysisType: 'codebase',
                    aiProvider,
                    understandingMode,
                    scanProfile,
                    report
                }, 200, sendAnalyzeJsonOpts);
            }

            if (analysisType === 'workspace-health') {
                const report = await withTimeout(
                    getAnalyzeCodebase()(projectPath, { includeEslint: false, context: 'dashboard', scanProfile: 'universal' }),
                    120_000,
                    'flexible workspace-health analysis'
                );
                const workspaceFindings = (report.findings || []).filter((f) => f.category === 'workspace-health');
                return sendAnalyzeJson(res, {
                    success: true,
                    analysisType: 'workspace-health',
                    aiProvider,
                    report: {
                        ...report,
                        findings: workspaceFindings,
                        summary: {
                            ...(report.summary || {}),
                            totalFindings: workspaceFindings.length,
                            severityCounts: workspaceFindings.reduce((acc, f) => {
                                acc[f.severity || 'info'] = (acc[f.severity || 'info'] || 0) + 1;
                                return acc;
                            }, {})
                        }
                    }
                }, 200, sendAnalyzeJsonOpts);
            }

            if (analysisType === 'removable-files') {
                const report = await scanRemovableFiles(projectPath);
                return sendAnalyzeJson(res, {
                    success: true,
                    analysisType: 'removable-files',
                    aiProvider,
                    report,
                    removableFiles: report
                }, 200, sendAnalyzeJsonOpts);
            }

            if (analysisType === 'complete') {
                logger.info(`[Flexible Analyze] Running complete analysis for ${projectPath}`);
                const results = {};
                const enginesRun = [];

                // Resolve tier limits for the requesting user
                const userTier = req.user?.tier || req.body?.tier || 'starter';
                const tierLimits = getLimits(userTier);

                // Run simplebeacon scan first — its programmatic fallback already calls analyzeCodebase
                try {
                    const { runSimplebeaconScan } = require('../../src/api/simplebeacon-api.cjs');
                    const scanRes = await runSimplebeaconScan(projectPath, {
                        includeBrowserAnalyzers: true,
                        tier: userTier
                    });
                    results.simplebeacon = scanRes.report || null;
                    if (scanRes.report) enginesRun.push('simplebeacon');
                } catch (scanErr) {
                    logger.warn('[Complete] simplebeacon scan failed:', safeErrorMessage(scanErr));
                }

                // Derive codebase report from simplebeacon scan to avoid double file walk
                // The simplebeacon programmatic fallback already runs analyzeCodebase
                const simplebeaconFindings = results.simplebeacon?.findings || results.simplebeacon?.rawIssues || null;
                if (simplebeaconFindings) {
                    results.codebase = {
                        type: 'codebase-analyzer-report',
                        reportVersion: 1,
                        title: 'Codebase Analysis Report',
                        generatedAt: results.simplebeacon.generatedAt,
                        projectRoot: projectPath,
                        summary: {
                            codeFilesAnalyzed: results.simplebeacon.filesAnalyzed ?? results.simplebeacon.ruleScopedFilesAnalyzed ?? results.simplebeacon.repositoryFilesTotal ?? null,
                            findingsTotal: simplebeaconFindings.length ?? 0,
                            findingsReturned: simplebeaconFindings.length ?? 0,
                            healthScore: results.simplebeacon.gate?.score ?? 100,
                            severityCounts: results.simplebeacon.summary?.severityCounts ?? { high: 0, medium: 0, low: 0 }
                        },
                        categories: results.simplebeacon.categories || [],
                        findings: simplebeaconFindings
                    };
                    enginesRun.push('codebase');
                } else {
                    // Fallback: run codebase analysis directly if simplebeacon didn't provide findings
                    try {
                        results.codebase = await withTimeout(
                            getAnalyzeCodebase()(projectPath, { includeEslint: false, context: 'complete', scanProfile: 'default', includeBrowserAnalyzers: true }),
                            90_000,
                            'complete fallback codebase analysis'
                        );
                        enginesRun.push('codebase');
                    } catch (cbErr) {
                        logger.warn('[Complete] codebase analysis failed:', safeErrorMessage(cbErr));
                    }
                }

                // Run file merger reduction, removable files, and npm audit in parallel
                const [fileReductionResult, removableFilesResult, npmAuditResult] = await Promise.allSettled([
                    scanFileMergerReduction(projectPath, { includeRepositoryInventory: true }),
                    scanRemovableFiles(projectPath),
                    runNpmAuditAsync(projectPath, { force: false })
                ]);

                if (fileReductionResult.status === 'fulfilled') {
                    results.fileReduction = fileReductionResult.value;
                    enginesRun.push('file-reduction');
                } else {
                    logger.warn('[Complete] file reduction failed:', safeErrorMessage(fileReductionResult.reason));
                }

                if (removableFilesResult.status === 'fulfilled') {
                    results.removableFiles = removableFilesResult.value;
                    enginesRun.push('removable-files');
                } else {
                    logger.warn('[Complete] removable files scan failed:', safeErrorMessage(removableFilesResult.reason));
                }

                if (npmAuditResult.status === 'fulfilled') {
                    results.npmAudit = npmAuditResult.value;
                    enginesRun.push('npm-audit');
                } else {
                    logger.warn('[Complete] npm audit failed:', safeErrorMessage(npmAuditResult.reason));
                }

                // Run data-cleanup scan so compliance can reference cleanup findings
                try {
                    results.dataCleanup = await runDataCleanupScan(projectPath, { profile: 'all' });
                    enginesRun.push('data-cleanup');
                } catch (cleanupErr) {
                    logger.warn('[Complete] data-cleanup failed:', safeErrorMessage(cleanupErr));
                }

                // Run compliance checklist after cleanup
                try {
                    const dataCleanupForCompliance = results.dataCleanup || results.fileReduction || null;
                    results.compliance = evaluateComplianceChecklist(results.simplebeacon || {}, {
                        projectRoot: projectPath,
                        npmAudit: results.npmAudit,
                        dataCleanup: dataCleanupForCompliance
                    });
                    enginesRun.push('compliance');
                } catch (complianceErr) {
                    logger.warn('[Complete] compliance failed:', safeErrorMessage(complianceErr));
                }

                // Build summary
                const simplebeaconReport = results.simplebeacon;
                const codebaseReport = results.codebase;
                const fileReductionReport = results.fileReduction;
                const dataCleanupReport = results.dataCleanup;
                const summary = {
                    stepCount: enginesRun.length,
                    stepsCompleted: enginesRun.length,
                    enginesRun,
                    scanDurationMs: null,
                    simplebeaconGatePass: simplebeaconReport?.gate?.pass ?? null,
                    simplebeaconIssues: simplebeaconReport?.gate?.blockingCount ?? simplebeaconReport?.issueCount ?? null,
                    codebaseHealthScore: tierLimits.showQualityScore ? codebaseReport?.summary?.healthScore ?? null : null,
                    codebaseFindings: codebaseReport?.summary?.findingsTotal ?? null,
                    fileReductionFindings: fileReductionReport?.summary?.totalFindings ?? null,
                    dataCleanupFindings: dataCleanupReport?.summary?.totalFindings ?? null,
                    compliancePassed: results.compliance?.summary?.passed ?? null,
                    complianceFailed: results.compliance?.summary?.failed ?? null,
                    npmVulnerabilities: results.npmAudit?.vulnerabilities?.total ?? null,
                    handoffEligible: simplebeaconReport?.gate?.pass === true && (codebaseReport?.summary?.healthScore || 100) >= 80,
                    tier: userTier,
                    tierLimits: { showQualityScore: tierLimits.showQualityScore }
                };

                return sendAnalyzeJson(res, {
                    success: true,
                    analysisType: 'complete',
                    aiProvider,
                    enginesRun,
                    results,
                    summary,
                    completeScan: {
                        type: 'simplebeacon-complete-scan',
                        version: '1.3.0',
                        generatedAt: new Date().toISOString(),
                        projectPath,
                        enginesRun,
                        summary,
                        results
                    }
                }, 200, sendAnalyzeJsonOpts);
            }

            const modelId = resolveModelId(registry, aiProvider);
            const scanResult = await analyzeWithModel(baseDir, modelId, {
                scanPaths: resolveMockScanPaths(baseDir, projectPath, { isSameResolvedPath, resolvePlatformRoot }),
                aiProvider,
                projectPath
            });

            let cloudSummary = null;
            const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
            if (['openai', 'anthropic', 'ollama'].includes(aiProvider)
                && providerConfigured(aiProvider, registry, userCredentials)) {
                try {
                    const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials, DEFAULT_OLLAMA_URL);
                    const enhanced = await summarizeScanWithProvider(
                        providerOpts?.providerId || aiProvider,
                        scanResult.report,
                        {
                            projectPath,
                            userCredentials,
                            registry,
                            ollamaBaseUrl: registry.ollamaBaseUrl,
                            ollamaModel: providerOpts?.ollamaModel
                        }
                    );
                    if (enhanced.enhanced && enhanced.summary) {
                        cloudSummary = enhanced.summary;
                        scanResult.report.ggufAIInsights = scanResult.report.ggufAIInsights || {};
                        scanResult.report.ggufAIInsights.cloudSummary = enhanced.summary;
                        scanResult.report.ggufAIInsights.cloudProvider = aiProvider;
                        logInferenceEvent({
                            provider: aiProvider,
                            operation: 'analyzeSummarize',
                            projectLabel: projectPath,
                            outcome: 'ok'
                        });
                    }
                    if (enhanced.timingBuckets) {
                        scanResult.report.inferenceMeta = scanResult.report.inferenceMeta || {};
                        scanResult.report.inferenceMeta.timingBuckets = {
                            ...(scanResult.report.inferenceMeta.timingBuckets || {}),
                            ...enhanced.timingBuckets
                        };
                    }
                } catch (error) {
                    scanResult.report.inferenceMeta = scanResult.report.inferenceMeta || {};
                    scanResult.report.inferenceMeta.cloudError = safeErrorMessage(error);
                }
            }

            return sendAnalyzeJson(res, {
                success: true,
                analysisType: 'mock-scan',
                aiProvider,
                cloudSummary,
                ...scanResult
            }, 200, sendAnalyzeJsonOpts);
        } catch (error) {
            res.status(400).json({ success: false, error: toClientError(error, 'Analysis request failed') });
        } finally {
            if (tempFetchDir) {
                await cleanupWebsiteTemp(tempFetchDir);
            }
        }
    });

    /**
     * Website scan endpoint — fetch remote URL and run AI Slop / PII / security patterns.
     * Tier-gated: Pro+ for website scans.
     */
    app.post('/api/analyze/website', async (req, res) => {
        try {
            const body = req.body || {};
            const url = String(body.url || '').trim();
            if (!url) {
                return res.status(400).json({ success: false, error: 'url is required' });
            }
            if (!/^https?:\/\//i.test(url)) {
                return res.status(400).json({ success: false, error: 'url must be a valid HTTP(S) URL' });
            }

            // Tier check
            const userTier = req.user?.tier || body.tier || 'developer';
            const { isPaidTier, getTierCapability } = require('../../../packages/simplebeacon-cli/src/lib/tier-constants');
            if (!isPaidTier(userTier) && !getTierCapability(userTier, 'websiteScans')) {
                return res.status(403).json({ success: false, error: 'Website scanning requires a Pro or higher tier.' });
            }

            const { scanWebsite } = require('../lib/website-scanner.cjs');
            const result = await scanWebsite(url, {
                scanTypes: body.scanTypes || ['ai-slop', 'pii'],
                minConfidence: Number(body.minConfidence) || 0.5,
                timeout: Number(body.timeout) || 15000
            });

            return sendAnalyzeJson(res, {
                success: true,
                analysisType: 'website',
                url: result.url,
                findings: result.findings,
                severityCounts: result.severityCounts,
                scanTimeMs: result.scanTimeMs,
                contentSize: result.contentSize
            }, 200, sendAnalyzeJsonOpts);
        } catch (error) {
            res.status(400).json({ success: false, error: toClientError(error, 'Website scan failed') });
        }
    });

    /**
     * Async scan endpoint — creates a scan job and returns scanId immediately.
     * The client polls /api/analyze/progress?scanId={id} for live updates.
     */
    app.post('/api/analyze/scan', async (req, res) => {
        try {
            const body = req.body || {};
            const rawPath = String(body.projectPath || body.path || '').trim();
            let projectPath;
            let isWebsite = false;
            let tempFetchDir = null;

            try {
                const resolved = await resolveAnalyzeProjectPath(rawPath);
                projectPath = resolved.projectPath;
                tempFetchDir = resolved.tempFetchDir;
                isWebsite = resolved.isWebsite;
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }

            const scanId = crypto.randomUUID();
            const fileCount = isWebsite ? 100 : await countFiles(projectPath);
            scanJobs.set(scanId, {
                status: 'scanning',
                current: 0,
                total: fileCount,
                percent: 0,
                filename: 'Initializing scan…',
                createdAt: Date.now()
            });

            // Fire-and-forget background scan
            (async () => {
                const startedAt = Date.now();
                const engines = [];
                const results = {};
                let step = 0;
                const totalSteps = 6;

                const updateProgress = (engineName, detail = '') => {
                    step++;
                    const job = scanJobs.get(scanId);
                    scanJobs.set(scanId, {
                        ...(job || {}),
                        current: Math.round((step / totalSteps) * fileCount),
                        percent: Math.round((step / totalSteps) * 100),
                        filename: detail || `Running ${engineName}…`,
                        engine: engineName
                    });
                };

                try {
                    // 1. SimpleBeacon scan
                    updateProgress('simplebeacon', 'Walking files & running rule engines…');
                    try {
                        const { runSimplebeaconScan } = require('../../src/api/simplebeacon-api.cjs');
                        const scanRes = await runSimplebeaconScan(projectPath, {
                            includeBrowserAnalyzers: true,
                            fullDirectoryScan: body.fullDirectoryScan === true,
                            tier: req.user?.tier || body.tier || 'starter'
                        });
                        results.simplebeacon = scanRes.report || null;
                        if (scanRes.report) engines.push('simplebeacon');
                    } catch (err) {
                        logger.warn('[Async Scan] simplebeacon failed:', safeErrorMessage(err));
                    }

                    // 2. Codebase analysis (if simplebeacon didn't already do it)
                    updateProgress('codebase', 'Analyzing code structure & complexity…');
                    if (!results.simplebeacon?.findings && !results.simplebeacon?.rawIssues) {
                        try {
                            results.codebase = await withTimeout(
                                getAnalyzeCodebase()(projectPath, { includeEslint: false, context: 'complete', scanProfile: 'default', includeBrowserAnalyzers: true }),
                                90_000,
                                'async codebase analysis'
                            );
                            engines.push('codebase');
                        } catch (err) {
                            logger.warn('[Async Scan] codebase failed:', safeErrorMessage(err));
                        }
                    } else {
                        const findings = results.simplebeacon.findings || results.simplebeacon.rawIssues || [];
                        results.codebase = {
                            type: 'codebase-analyzer-report',
                            reportVersion: 1,
                            title: 'Codebase Analysis Report',
                            generatedAt: results.simplebeacon.generatedAt,
                            projectRoot: projectPath,
                            summary: {
                                codeFilesAnalyzed: results.simplebeacon.filesAnalyzed ?? results.simplebeacon.ruleScopedFilesAnalyzed ?? results.simplebeacon.repositoryFilesTotal ?? null,
                                findingsTotal: findings.length ?? 0,
                                findingsReturned: findings.length ?? 0,
                                healthScore: results.simplebeacon.gate?.score ?? 100,
                                severityCounts: results.simplebeacon.summary?.severityCounts ?? { high: 0, medium: 0, low: 0 }
                            },
                            categories: results.simplebeacon.categories || [],
                            findings
                        };
                        engines.push('codebase');
                    }

                    // 3. File reduction scan
                    updateProgress('file-reduction', 'Detecting mergeable & duplicate files…');
                    try {
                        results.fileReduction = await scanFileMergerReduction(projectPath, { includeRepositoryInventory: true });
                        engines.push('file-reduction');
                    } catch (err) {
                        logger.warn('[Async Scan] file-reduction failed:', safeErrorMessage(err));
                    }

                    // 4. Removable files scan
                    updateProgress('removable-files', 'Finding unused & removable assets…');
                    try {
                        results.removableFiles = await scanRemovableFiles(projectPath);
                        engines.push('removable-files');
                    } catch (err) {
                        logger.warn('[Async Scan] removable-files failed:', safeErrorMessage(err));
                    }

                    // 5. NPM audit
                    updateProgress('npm-audit', 'Auditing dependencies for vulnerabilities…');
                    try {
                        results.npmAudit = await runNpmAuditAsync(projectPath, { force: false });
                        engines.push('npm-audit');
                    } catch (err) {
                        logger.warn('[Async Scan] npm-audit failed:', safeErrorMessage(err));
                    }

                    // 6. Compliance
                    updateProgress('compliance', 'Generating compliance checklist…');
                    try {
                        results.dataCleanup = await runDataCleanupScan(projectPath, { profile: 'all' });
                        engines.push('data-cleanup');
                    } catch (err) {
                        logger.warn('[Async Scan] data-cleanup failed:', safeErrorMessage(err));
                    }
                    try {
                        results.compliance = evaluateComplianceChecklist(results.simplebeacon || {}, {
                            projectRoot: projectPath,
                            npmAudit: results.npmAudit,
                            dataCleanup: results.dataCleanup || results.fileReduction || null
                        });
                        engines.push('compliance');
                    } catch (err) {
                        logger.warn('[Async Scan] compliance failed:', safeErrorMessage(err));
                    }

                    // Build final report matching the flexible endpoint's complete-scan format
                    const summary = {
                        stepCount: engines.length,
                        stepsCompleted: engines.length,
                        enginesRun: engines,
                        scanDurationMs: Date.now() - startedAt,
                        simplebeaconGatePass: results.simplebeacon?.gate?.pass ?? null,
                        simplebeaconIssues: results.simplebeacon?.gate?.blockingCount ?? results.simplebeacon?.issueCount ?? null,
                        codebaseHealthScore: results.codebase?.summary?.healthScore ?? null,
                        codebaseFindings: results.codebase?.summary?.findingsTotal ?? null,
                        fileReductionFindings: results.fileReduction?.summary?.totalFindings ?? null,
                        dataCleanupFindings: results.dataCleanup?.summary?.totalFindings ?? null,
                        compliancePassed: results.compliance?.summary?.passed ?? null,
                        complianceFailed: results.compliance?.summary?.failed ?? null,
                        npmVulnerabilities: results.npmAudit?.vulnerabilities?.total ?? null,
                        handoffEligible: results.simplebeacon?.gate?.pass === true && (results.codebase?.summary?.healthScore || 100) >= 80,
                        tier: req.user?.tier || body.tier || 'starter'
                    };

                    const reportJson = {
                        success: true,
                        analysisType: 'complete',
                        aiProvider: String(body.aiProvider || 'active').toLowerCase(),
                        enginesRun: engines,
                        results,
                        summary,
                        completeScan: {
                            type: 'simplebeacon-complete-scan',
                            version: '1.3.0',
                            generatedAt: new Date().toISOString(),
                            projectPath,
                            enginesRun: engines,
                            summary,
                            results
                        },
                        // Flatten for backward-compat with extension
                        detectedIssues: results.simplebeacon?.findings || results.simplebeacon?.rawIssues || results.codebase?.findings || [],
                        issues: results.simplebeacon?.findings || results.simplebeacon?.rawIssues || results.codebase?.findings || [],
                        severityCounts: deriveSeverityCounts(results.simplebeacon?.findings || results.simplebeacon?.rawIssues || results.codebase?.findings || []),
                        integrityScore: results.simplebeacon?.gate?.score ?? results.codebase?.summary?.healthScore ?? 100,
                        qualityScore: results.simplebeacon?.gate?.score ?? results.codebase?.summary?.healthScore ?? 100,
                        generatedAt: new Date().toISOString()
                    };

                    scanJobs.set(scanId, {
                        ...scanJobs.get(scanId),
                        status: 'complete',
                        percent: 100,
                        current: fileCount,
                        filename: 'Scan complete',
                        reportJson
                    });
                    logger.info(`[Async Scan] ${scanId} completed in ${Date.now() - startedAt}ms, engines=[${engines.join(',')}]`);
                } catch (err) {
                    logger.error('[Async Scan] fatal error:', safeErrorMessage(err));
                    scanJobs.set(scanId, {
                        ...scanJobs.get(scanId),
                        status: 'error',
                        error: safeErrorMessage(err) || 'Scan failed'
                    });
                } finally {
                    if (tempFetchDir) {
                        await cleanupWebsiteTemp(tempFetchDir);
                    }
                }
            })().catch((err) => logger.error('[Async Scan] unhandled background error:', safeErrorMessage(err)));

            return res.json({ success: true, scanId, status: 'scanning' });
        } catch (error) {
            res.status(500).json({ success: false, error: toClientError(error, 'Scan request failed') });
        }
    });

    // ── Directory Upload Analysis ──

    const uploadMulter = multer({
        dest: path.join(os.tmpdir(), 'sb-uploads'),
        limits: { files: 100000, fileSize: 5 * constants.BYTES_PER_KB * constants.BYTES_PER_KB * constants.BYTES_PER_KB, fieldSize: 50 * constants.BYTES_PER_KB * constants.BYTES_PER_KB }
    });

    /**
     * Verify a license token against the subscription store or cryptographic fallback.
     * @param {string} token
     * @returns {Promise<Object|null>} Subscription record if valid, otherwise null.
     */
    async function validateLicenseToken(token) {
        if (typeof token !== 'string' || !token) return null;
        const { readStore } = require('../../server/lib/simplebeacon-subscription-store.cjs');
        const store = await readStore();
        const record = Object.values(store.subscriptions || {}).find(
            (s) => s.licenseToken === token
        );
        const VALID_TIERS = ['community', 'clearance499', 'agency999', 'agency1499', 'euai2499', 'warranty199', 'operator', 'moneyPrinter19', 'executive', 'agency', 'euai', 'universal', 'instant'];
        if (record) {
            if (!VALID_TIERS.includes(record.licenseTier)) return null;
            return record;
        }
        // Fallback: cryptographically verify tokens not in store
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure';
        const payload = verifyLicenseToken(token, secret);
        if (!payload) return null;
        const tier = payload.tier || 'executive';
        if (!VALID_TIERS.includes(tier)) return null;
        return {
            licenseToken: token,
            licenseTier: tier,
            email: payload.email || '',
            features: payload.features || [],
            projectName: payload.projectName || 'default-project',
            clientName: payload.clientName || ''
        };
    }

    app.post('/api/analyze/upload-directory', uploadMulter.array('files', 100000), async (req, res) => {
        let projectDir = null;
        let multerFiles = [];
        try {
            const authHeader = String(req.headers.authorization || '');
            const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
            const licenseToken = bearerToken || String(req.body?.licenseToken || '').trim();
            const analysisType = String(req.body?.analysisType || 'simplebeacon').toLowerCase();
            logger.info(`[Upload Directory] Received analysisType="${analysisType}" from req.body keys=[${Object.keys(req.body || {}).join(',')}]`);

            if (!licenseToken) {
                return res.status(400).json({ success: false, error: 'licenseToken is required' });
            }

            const record = await validateLicenseToken(licenseToken);
            if (!record) {
                return res.status(401).json({ success: false, error: 'Invalid license token' });
            }
            const licenseTier = record.licenseTier || 'executive';

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded' });
            }
            multerFiles = req.files;

            // Build project tree in a secure temp directory with auto-cleanup
            const tmpDirObj = tmp.dirSync({ prefix: 'sb-analyze-', unsafeCleanup: true });
            projectDir = tmpDirObj.name;

            // Reconstruct directory structure using filePaths from frontend
            let filePaths = [];
            try {
                const parsed = JSON.parse(req.body?.filePaths || '[]');
                if (Array.isArray(parsed)) filePaths = parsed;
            } catch (e) { filePaths = []; }
            for (let i = 0; i < req.files.length; i++) {
                const relPath = filePaths[i] || req.files[i].originalname || req.files[i].fieldname;
                const safePath = sanitizeUploadPath(relPath);
                const destPath = path.join(projectDir, safePath);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(req.files[i].path, destPath);
            }

            // If a single ZIP file was uploaded, stream-extract it to bypass browser webkitdirectory limits
            if (req.files.length === 1 && req.files[0].originalname.toLowerCase().endsWith('.zip')) {
                const zipPath = req.files[0].path;
                logger.info(`[Upload Directory] Detected ZIP archive. Streaming extract to ${projectDir}...`);
                try {
                    await new Promise((resolve, reject) => {
                        fs.createReadStream(zipPath)
                            .pipe(unzipper.Extract({ path: projectDir }))
                            .on('close', resolve)
                            .on('error', reject);
                    });
                    logger.info(`[Upload Directory] ZIP streamed to ${projectDir}`);
                    // Remove the raw ZIP so the scan only sees extracted source files
                    try {
                        const safeRel = sanitizeUploadPath(filePaths[0] || req.files[0].originalname);
                        const copiedZip = path.join(projectDir, safeRel);
                        if (fs.existsSync(copiedZip)) fs.unlinkSync(copiedZip);
                    } catch (cleanupErr) {
                        logger.warn(`[Upload Directory] ZIP cleanup skipped: ${safeErrorMessage(cleanupErr)}`);
                    }
                } catch (zipErr) {
                    logger.warn(`[Upload Directory] ZIP extraction failed: ${safeErrorMessage(zipErr)}. Proceeding with raw upload.`);
                }
            }

            // Write a temp config so the CLI scans everything in the uploaded directory,
            // instead of inheriting ai-platform's default scanPaths (sample dirs, test fixtures, data)
            const tempConfigDir = path.join(projectDir, '.simplebeacon');
            fs.mkdirSync(tempConfigDir, { recursive: true });
            const tempConfigPath = path.join(tempConfigDir, 'config.json');
            fs.writeFileSync(
                tempConfigPath,
                JSON.stringify({
                    scanPaths: ['.'],
                    productionPaths: ['.'],
                    fullDirectoryScan: true,
                    ignore: [
                        '*.log', '*.backup.*', '*.tmp',
                        'node_modules/**', '.git/**', 'coverage/**',
                        'dist/**', 'build/**', '.github/**',
                        '**/*.test.js', '**/*.spec.js',
                        '**/*.test.ts', '**/*.spec.ts',
                        '**/*.map', '**/*.min.js', '**/*.min.css',
                        '**/*.d.ts', '**/*.lock', '**/*.lockb',
                        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
                        '.DS_Store', 'Thumbs.db',
                        '*.woff', '*.woff2', '*.ttf', '*.eot',
                        '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico',
                        '*.mp4', '*.webm', '*.mp3', '*.wav',
                        '*.pdf', '*.doc', '*.docx', '*.zip', '*.tar', '*.gz',
                        '**/.vscode-test/**', '**/simplebeacon-vscode-merged/**', '**/*.vsix',
                        '**/cp*.json', '**/euc*.json', '**/gbk*.json',
                        '**/shiftjis.json', '**/big5*.json', '**/encoding*.json',
                        '**/codes.json', '**/dbcs*.js', '**/dbcs*.json'
                    ],
                    fullDirectoryScanSkipDirs: [
                        '.git', 'node_modules', 'coverage', 'dist', 'build',
                        '.simplebeacon', 'tmp', '.github', '.github-sync',
                        'backups', 'deployments', 'logs', 'ai-agent', 'ai-tools',
                        'simplebeacon-rule-tests', 'simplebeacon-frameworkless',
                        'simplebeacon-vscode-merged', '.vscode-test',
                        'packages/simplebeacon-cli'
                    ]
                }, null, 2)
            );

            const scanId = crypto.randomUUID();
            scanJobs.set(scanId, {
                status: 'scanning',
                current: 0,
                total: req.files.length,
                percent: 0,
                filename: '',
                reportJson: null,
                error: null,
                tmpDir: projectDir,
                createdAt: Date.now()
            });

            // Fire-and-forget background scan
            (async () => {
                const scanStart = Date.now();
                logger.info(`[Upload Directory] Starting scan ${scanId} for ${analysisType}, ${req.files.length} files`);
                const scanTimeoutMs = 18 * constants.ONE_MINUTE_MS; // 18 min hard cap for entire scan + analyses
                let scanTimer = null;
                const clearScanTimer = () => { if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; } };
                scanTimer = setTimeout(() => {
                    const job = scanJobs.get(scanId);
                    if (job && job.status === 'scanning') {
                        logger.error(`[Upload Directory] Scan ${scanId} timed out after ${scanTimeoutMs}ms`);
                        scanJobs.set(scanId, { ...job, status: 'error', error: `Scan timed out after ${scanTimeoutMs / constants.MS_PER_SECOND}s` });
                        try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
                    }
                }, scanTimeoutMs);
                let report = null;
                let cliFailed = false;
                const cliPath = path.join(monorepoRoot, 'packages/simplebeacon-cli/bin/simplebeacon.js');
                if (!fs.existsSync(cliPath)) {
                    logger.warn(`[Upload Directory] CLI binary not found at ${cliPath} — falling back to programmatic analysis for ${scanId}`);
                    cliFailed = true;
                    try {
                        const analysis = await withTimeout(
                            getAnalyzeCodebase()(projectDir, { includeEslint: false }),
                            60_000,
                            'upload directory codebase analysis'
                        );
                        report = {
                            type: 'simplebeacon-report',
                            version: '1.0.0',
                            generatedAt: new Date().toISOString(),
                            projectPath: projectDir,
                            summary: analysis.summary || {},
                            categories: analysis.categories || [],
                            findings: analysis.findings || [],
                            gate: { pass: (analysis.summary?.healthScore || 100) >= 80, score: analysis.summary?.healthScore || 100 }
                        };
                        logger.info(`[Upload Directory] Programmatic scan completed for ${scanId}, health=${report.gate.score}`);
                    } catch (progErr) {
                        clearScanTimer();
                        logger.error('[Upload Directory] Programmatic fallback failed:', safeErrorMessage(progErr));
                        scanJobs.set(scanId, { ...scanJobs.get(scanId), status: 'error', error: safeErrorMessage(progErr) || 'Analysis failed' });
                        return;
                    }
                } else {
                    try {
                        const cmd = `node "${cliPath}" scan --path "${projectDir}" --config "${tempConfigPath}" --format json --gate --offline --fullDirectoryScan`;
                        logger.info(`[Upload Directory] Running CLI scan for ${scanId}...`);
                        const { stdout } = await execAsync(cmd, {
                            cwd: baseDir,
                            maxBuffer: constants.BYTES_PER_KB * constants.BYTES_PER_KB * constants.BYTES_PER_KB,
                            timeout: constants.TIMEOUT_15M
                        });
                        logger.info(`[Upload Directory] CLI scan completed for ${scanId} in ${(Date.now() - scanStart) / constants.MS_PER_SECOND}s`);
                        try {
                            report = JSON.parse(stdout);
                        } catch (parseErr) {
                            logger.error('[Upload Directory] Failed to parse scan output:', safeErrorMessage(parseErr));
                            scanJobs.set(scanId, { ...scanJobs.get(scanId), status: 'error', error: 'Scan completed but output parsing failed' });
                            return;
                        }
                    } catch (err) {
                        cliFailed = true;
                        logger.warn(`[Upload Directory] CLI scan exited non-zero for ${scanId}:`, safeErrorMessage(err));
                        if (err.stdout) {
                            try {
                                report = JSON.parse(err.stdout);
                                logger.info(`[Upload Directory] Parsed gate-fail report for ${scanId}, issues=${report.issueCount || report.gate?.blockingCount || 'n/a'}`);
                            } catch (parseErr) {
                                logger.error('[Upload Directory] Failed to parse gate-fail output:', safeErrorMessage(parseErr));
                            }
                        }
                        if (!report) {
                            clearScanTimer();
                            scanJobs.set(scanId, { ...scanJobs.get(scanId), status: 'error', error: safeErrorMessage(err) || 'Analysis failed' });
                            return;
                        }
                    }
                }

                // Run additional analyses based on selected analysis type (regardless of gate pass/fail)
                const results = { simplebeacon: report };
                const runComplete = analysisType === 'complete';
                // Tier-aware limits: $19 instant tier does not get executive-tier analyzers
                const instantTierLimited = licenseTier === 'instant';
/**
 * Tier allowed.
 * @param {any} analyzer
 * @returns {any}
 */
                const tierAllowed = (analyzer) => typeof analyzer === 'string' && (!instantTierLimited || ['simplebeacon', 'mock-scan', 'codebase'].includes(analyzer));
                const ANALYZER_TIMEOUT = constants.TIMEOUT_10M; // 10 min per analyzer (codebase can be slow)
                const ANALYZER_TIMEOUT_FAST = constants.TIMEOUT_1M; // 1 min for lightweight analyzers
                /**
                 * Run an analyzer with a timeout, logging start/finish.
                 * @param {string} label Analyzer name for logging.
                 * @param {Function} fn Analyzer function to execute.
                 * @param {number} [timeoutMs] Timeout in milliseconds.
                 * @returns {Promise<any>}
                 */
                const runAnalyzer = async (label, fn, timeoutMs = ANALYZER_TIMEOUT) => {
                    if (typeof fn !== 'function') {
                        throw new TypeError(`Analyzer ${label} requires a function, received ${typeof fn}`);
                    }
                    const t0 = Date.now();
                    logger.info(`[Upload Directory] Starting analyzer: ${label} (timeout ${timeoutMs}ms)`);
                    try {
                        const result = await withTimeout(fn(), timeoutMs, label);
                        logger.info(`[Upload Directory] Finished analyzer: ${label} in ${Date.now() - t0}ms`);
                        return result;
                    } catch (e) {
                        logger.warn(`[Upload Directory] Analyzer ${label} failed after ${Date.now() - t0}ms:`, e.message);
                        return { error: e.message };
                    }
                };

                if ((analysisType === 'codebase' || runComplete) && tierAllowed('codebase')) {
                    results.codebase = await runAnalyzer('codebase', () => getAnalyzeCodebase()(projectDir, { context: 'dashboard', scanProfile: 'default' }));
                }
                if ((analysisType === 'npm-audit' || runComplete) && tierAllowed('npm-audit')) {
                    results.npmAudit = await runAnalyzer('npm-audit', () => runNpmAuditAsync(projectDir, { force: false }));
                }
                if ((analysisType === 'data-cleanup' || runComplete) && tierAllowed('data-cleanup')) {
                    results.dataCleanup = await runAnalyzer('data-cleanup', () => runDataCleanupScan(projectDir, { profile: 'all' }));
                }
                if ((analysisType === 'file-reduction' || runComplete) && tierAllowed('file-reduction')) {
                    results.fileReduction = await runAnalyzer('file-reduction', () => scanFileMergerReduction(projectDir, { includeRepositoryInventory: true }));
                }
                if ((analysisType === 'removable-files' || runComplete) && tierAllowed('removable-files')) {
                    results.removableFiles = await runAnalyzer('removable-files', () => scanRemovableFiles(projectDir));
                }
                if ((analysisType === 'roadmap' || runComplete) && tierAllowed('roadmap')) {
                    results.roadmap = await runAnalyzer('roadmap', () => generateCodeRoadmap(projectDir, {}, { scanReport: report, includeFiles: true }));
                }
                if ((analysisType === 'data-quality' || runComplete) && tierAllowed('data-quality')) {
                    const profile = analysisType === 'data-quality' ? 'data-quality' : 'all';
                    results.dataQuality = await runAnalyzer('data-quality', () => runDataCleanupScan(projectDir, { profile }));
                }
                if ((analysisType === 'cleanup-assistant' || runComplete) && tierAllowed('cleanup-assistant')) {
                    results.cleanupAssistant = await runAnalyzer('cleanup-assistant', async () => {
                        const fileReduction = await runDataCleanupScan(projectDir, { profile: 'file-reduction' });
                        const dataQuality = await runDataCleanupScan(projectDir, { profile: 'data-quality' });
                        const inventory = fileReduction?.inventory || dataQuality?.inventory || null;
                        const plan = fileReduction?.fileReductionPlan || fileReduction?.plan || null;
                        const safeDirs = plan?.safeToDelete?.topDirectories || [];
                        const reviewDirs = plan?.reviewBeforeDelete?.logs || [];
                        const brief = {
                            projectPath: projectDir,
                            inventory: {
                                totalFiles: inventory?.totalFiles ?? null,
                                totalFolders: inventory?.totalDirectories ?? null
                            },
                            tiers: {
                                safeNow: { files: 0, bytes: 0, directories: safeDirs },
                                reviewFirst: { files: reviewDirs.length, bytes: 0, items: reviewDirs },
                                protected: { files: 0, bytes: 0, directories: [] },
                                investigate: { files: plan?.unusedFiles?.candidates ?? 0, note: plan?.unusedFiles?.note || null }
                            },
                            analysis: {
                                fileReductionSummary: fileReduction?.summary || null,
                                dataQualitySummary: dataQuality?.summary || null
                            }
                        };
                        return { brief, fileReduction, dataQuality, repositoryInventory: inventory };
                    });
                }
                // Compliance runs after cleanup so it can reference cleanup findings
                if ((analysisType === 'compliance' || runComplete) && tierAllowed('compliance')) {
                    const dataCleanupForCompliance = results.dataCleanup || results.cleanupAssistant?.fileReduction || results.fileReduction || null;
                    results.compliance = await runAnalyzer('compliance', () => Promise.resolve(evaluateComplianceChecklist(report, {
                        projectRoot: projectDir,
                        npmAudit: results.npmAudit,
                        dataCleanup: dataCleanupForCompliance
                    })));
                }
                if ((analysisType === 'consolidation' || runComplete) && tierAllowed('consolidation')) {
                    results.consolidation = await runAnalyzer('consolidation', () => buildCompleteAuditModel({ results }));
                }
                if ((analysisType === 'mock-scan' || runComplete) && tierAllowed('mock-scan')) {
                    results.mockScan = await runAnalyzer('mock-scan', async () => {
                        const { mockFiles, issues } = await scanMockFiles(projectDir);
                        return { type: 'mock-data-analysis', filesFound: mockFiles.length, issuesDetected: issues.length, dataQualityScore: mockFiles.length > 0 ? `${((mockFiles.length - issues.length) / mockFiles.length * 100).toFixed(1)}%` : '0%', files: mockFiles.map(({ content, ...rest }) => rest), issues };
                    });
                }
                if ((analysisType === 'eu-ai-act' || runComplete) && tierAllowed('eu-ai-act')) {
                    results.euAiAct = await runAnalyzer('eu-ai-act', async () => {
                        try {
                            const reportModulePath = require.resolve('../lib/eu-ai-act-audit-report.cjs');
                            if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') delete require.cache[reportModulePath];
                            const { buildEuAiActAuditReport } = require('../lib/eu-ai-act-audit-report.cjs');
                            return await buildEuAiActAuditReport({
                                projectPath: projectDir,
                                artifacts: {
                                    platformRoot: projectDir,
                                    report: report,
                                    compliance: null,
                                    assessment: null
                                }
                            });
                        } catch (e) {
                            if (e.code === 'eu_ai_act_artifacts_missing') {
                                return {
                                    type: 'eu-ai-act-audit',
                                    status: 'no-artifacts',
                                    message: e.message,
                                    html: null,
                                    filename: null,
                                    reportId: null,
                                    exportTier: 'eu-ai-act',
                                    exportTierLabel: 'EU AI Act readiness (reference)',
                                    platformRoot: null
                                };
                            }
                            throw e;
                        }
                    });
                }

                let reportJson = report;
                const typeMap = {
                    'codebase': results.codebase, 'npm-audit': results.npmAudit, 'compliance': results.compliance,
                    'data-cleanup': results.dataCleanup, 'data-quality': results.dataQuality, 'cleanup-assistant': results.cleanupAssistant,
                    'file-reduction': results.fileReduction, 'roadmap': results.roadmap,
                    'removable-files': results.removableFiles,
                    'consolidation': results.consolidation, 'mock-scan': results.mockScan, 'eu-ai-act': results.euAiAct
                };
                if (analysisType !== 'simplebeacon' && analysisType !== 'complete' && typeMap[analysisType]) {
                    const specific = typeMap[analysisType];
                    if (specific && !specific.error) {
                        // Merge analysis result into simplebeacon report so frontend gate/quality fields remain available
                        const analysisKeyMap = {
                            'codebase': '_codebaseAnalysis',
                            'npm-audit': '_npmAuditAnalysis',
                            'compliance': '_complianceAnalysis',
                            'data-cleanup': '_dataCleanupAnalysis',
                            'data-quality': '_dataQualityAnalysis',
                            'cleanup-assistant': '_cleanupAssistantAnalysis',
                            'file-reduction': '_fileReductionAnalysis',
                            'removable-files': '_removableFilesAnalysis',
                            'roadmap': '_roadmapAnalysis',
                            'consolidation': '_consolidationAnalysis',
                            'mock-scan': '_mockScanAnalysis',
                            'eu-ai-act': '_euAiActAnalysis'
                        };
                        const analysisKey = analysisKeyMap[analysisType] || `_${analysisType.replace(/-/g, '')}Analysis`;
                        reportJson = { ...report, [analysisKey]: specific };
                    } else if (specific?.error) {
                        reportJson = { ...report, _analysisError: specific.error };
                    }
                }
                if (analysisType === 'complete') {
                    reportJson = { ...report, _completeResults: results };
                }

                // Override temp directory path with original project name from upload for display,
                // but keep absolute projectDir so downstream fs-based checks (buildReadiness, etc.) work
                const originalDirName = (filePaths[0] && String(filePaths[0]).includes('/'))
                    ? String(filePaths[0]).split('/')[0]
                    : (filePaths[0] && String(filePaths[0]).includes('\\'))
                        ? String(filePaths[0]).split('\\')[0]
                        : (req.body?.projectName || 'project');
                if (reportJson && typeof reportJson === 'object') {
                    if (reportJson.projectRoot) reportJson.projectRoot = projectDir;
                    if (reportJson.projectPath) reportJson.projectPath = projectDir;
                    if (reportJson.scanTargetRoot) reportJson.scanTargetRoot = projectDir;
                    reportJson.projectName = originalDirName;
                }

                clearScanTimer();
                logger.info(`[Upload Directory] Scan ${scanId} completed successfully in ${(Date.now() - scanStart) / constants.MS_PER_SECOND}s`);
                scanJobs.set(scanId, {
                    ...scanJobs.get(scanId),
                    status: 'complete',
                    percent: 100,
                    current: req.files.length,
                    reportJson: reportJson
                });

                // --- AI Analyst Autopilot (fire-and-forget) ---
                (async () => {
                    try {
                        const aiVerdict = await generateAutomatedVerdict(sanitizeReportForAi(report), { projectPath: '<redacted>' });
                        const jobMeta = scanJobs.get(scanId) || {};
                        scanJobs.set(scanId, { ...jobMeta, aiVerdict });

                        // If clientEmail was provided (e.g., via token or checkout), auto-email
                        const recipient = req.projectContext?.clientEmail || req.projectContext?.email || req.body?.clientEmail;
                        if (recipient) {
                            await emailAutomatedVerdict({
                                to: recipient,
                                subject: `Your Automated Compliance Report — ${req.projectContext?.projectName || 'Project'}`,
                                reportData: {
                                    project: req.projectContext?.projectName || 'Project',
                                    ...aiVerdict
                                }
                            });
                        }
                    } catch (aiErr) {
                        logger.warn('[Upload Directory] AI Analyst autopilot error:', safeErrorMessage(aiErr));
                    }
                })().catch((err) => logger.warn('[Upload Directory] AI Analyst unhandled error:', safeErrorMessage(err)));

                // --- EU AI Act Article 14 Human Oversight Evaluator (fire-and-forget) ---
                (async () => {
                    try {
                        const euCompliance = await evaluateHumanOversightCompliance(report, { projectPath: projectDir });
                        const jobMeta = scanJobs.get(scanId) || {};
                        scanJobs.set(scanId, { ...jobMeta, euCompliance });
                    } catch (euErr) {
                        logger.warn('[Upload Directory] EU Article 14 evaluator error:', safeErrorMessage(euErr));
                    }
                })().catch((err) => logger.warn('[Upload Directory] EU evaluator unhandled error:', safeErrorMessage(err)));
            })();

            res.json({ success: true, scanId });
        } catch (err) {
            logger.error('[Upload Directory] Error:', safeErrorMessage(err));
            res.status(500).json({ success: false, error: safeErrorMessage(err) || 'Analysis failed' });
            // Clean up on immediate error — Privacy Guard: zero data retention
            try {
                if (projectDir) {
                    await fs.promises.rm(projectDir, { recursive: true, force: true });
                    logger.info('[Privacy Guard] Purged repository assets from server memory');
                }
                for (const file of multerFiles) {
                    if (file.path) {
                        try { await fs.promises.unlink(file.path); } catch { /* ignore cleanup errors */ }
                    }
                }
            } catch (cleanupErr) {
                logger.warn('[Upload Directory] Cleanup error:', cleanupErr.message);
            }
        }
    });

    app.get('/api/analyze/progress', (req, res) => {
        // Prevent any caching / 304 behavior — progress must always return fresh data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.set('etag', false);
        const scanId = String(req.query.scanId || '');
        const job = scanJobs.get(scanId);
        if (!job) {
            return res.status(404).json({ success: false, error: 'Scan not found' });
        }
        // If complete, include reportJson; client will consume it
        res.json({
            success: true,
            status: job.status,
            current: job.current,
            total: job.total,
            percent: job.percent,
            filename: job.filename || '',
            reportJson: job.status === 'complete' ? job.reportJson : undefined,
            error: job.status === 'error' ? job.error : undefined
        });
    });

    app.get('/api/analyze/codebase', async (req, res) => {
        try {
            let projectPath;
            const rawPath = req.query.projectPath || req.query.path;
            try {
                projectPath = resolveSafeProjectPath(rawPath);
            } catch (error) {
                logger.warn('[Analyze/Codebase] Path validation failed:', {
                    rawPath,
                    baseDir,
                    monorepoRoot,
                    allowedRoots: getAllowedRoots(),
                    rawError: error instanceof Error ? error.message : String(error)
                });
                const debug = process.env.DEBUG_CLIENT_ERRORS === '1' || process.env.DEBUG_CLIENT_ERRORS === 'true';
                const errorPayload = { success: false, error: toClientError(error, 'Invalid projectPath') };
                if (debug) {
                    errorPayload._debug = {
                        rawPath,
                        baseDir,
                        monorepoRoot,
                        allowedRoots: getAllowedRoots(),
                        rawError: error instanceof Error ? error.message : String(error)
                    };
                }
                return res.status(400).json(errorPayload);
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }
            const scanProfile = resolveScanProfile(
                { scanProfile: req.query.scanProfile },
                'dashboard'
            );
            const scanContext = String(req.query.context || req.query.scanMode || 'dashboard').toLowerCase();
            const understandingMode = String(req.query.understandingMode || 'deterministic').toLowerCase();
            const startedAt = Date.now();
            logger.info(`[analyze] codebase start path=${projectPath} profile=${scanProfile} context=${scanContext}`);
            const explicitMaxDeep = Number(req.query.maxDeepAnalyze);
            const maxDeepAnalyze = Number.isFinite(explicitMaxDeep) && explicitMaxDeep > 0
                ? Math.min(explicitMaxDeep, 10000)
                : 5000;
            const analyzeOptions = {
                includeEslint: req.query.includeEslint === 'true',
                scanProfile,
                context: scanContext,
                includeBrowserAnalyzers: req.query.includeBrowserAnalyzers === '1' || req.query.includeBrowserAnalyzers === 'true',
                includeAllFiles: req.query.includeAllFiles === '1' || req.query.includeAllFiles === 'true'
            };
            if (maxDeepAnalyze != null) {
                analyzeOptions.maxDeepAnalyze = maxDeepAnalyze;
            }
            let report = await withTimeout(
                getAnalyzeCodebase()(projectPath, analyzeOptions),
                80_000,
                'codebase analysis'
            );
            logger.info(`[analyze] codebase done path=${projectPath} context=${scanContext} ms=${Date.now() - startedAt} analyzed=${report.summary?.codeFilesAnalyzed ?? '—'}/${report.summary?.codeFilesDiscovered ?? '—'}`);
            if (understandingMode !== 'off') {
                const registry = await ensureRegistry(baseDir);
                const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
                report = await attachUnderstandingToCodebaseReport(report, projectPath, {
                    platformRoot: baseDir,
                    understandingMode,
                    mode: understandingMode,
                    aiProvider: String(req.query.aiProvider || 'active').toLowerCase(),
                    registry,
                    userCredentials
                });
            }
            res.set('Cache-Control', 'no-store');
            return sendAnalyzeJson(res, { success: true, data: report, scanProfile, scanContext, understandingMode }, 200, sendAnalyzeJsonOpts);
        } catch (error) {
            logger.warn('[Analyze/Codebase] Analysis failed:', { error: error instanceof Error ? error.message : String(error), projectPath });
            const debug = process.env.DEBUG_CLIENT_ERRORS === '1' || process.env.DEBUG_CLIENT_ERRORS === 'true';
            const errorPayload = { success: false, error: toClientError(error, 'Codebase analysis failed') };
            if (debug) {
                errorPayload._debug = {
                    projectPath,
                    rawError: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : null
                };
            }
            return res.status(500).json(errorPayload);
        }
    });

    app.get('/api/analyze/inventory', async (req, res) => {
        try {
            let rawPath = req.query.projectPath || req.query.path || '';
            // Fallback to the server's default project path when no meaningful path is provided.
            // This prevents 400 errors from the dashboard's initial "no folder selected" state.
            if (!rawPath || rawPath === '/' || rawPath === '\\') {
                rawPath = baseDir;
            }
            let projectPath;
            try {
                projectPath = resolveSafeProjectPath(rawPath);
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }
            const profile = req.query.profile || 'all';
            const inventoryOptions = { profile };
            if (profile !== 'all' && req.query.fullDirectoryScan !== 'true' && req.query.fullDirectoryScan !== '1') {
                inventoryOptions.skipDirs = ['node_modules', '.git'];
            }
            const inventory = await countRepositoryInventory(projectPath, inventoryOptions);
            return res.json({ success: true, inventory });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Inventory scan failed') });
        }
    });

    app.post('/api/analyze/understand', async (req, res) => {
        try {
            const body = req.body || {};
            let projectPath = null;
            if (body.projectPath) {
                projectPath = resolveSafeProjectPath(body.projectPath);
            }

            const understandingMode = String(body.understandingMode || 'deterministic').toLowerCase();
            const aiProvider = String(body.aiProvider || 'demo').toLowerCase();
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req, getUserAiCredentials);

            let report;
            // Dropped-file / paste flows send inline code — prefer that over disk lookup even
            // when filePath + projectPath are also present (filename may live outside project root).
            if (body.code) {
                report = await understandCodeSnippet(String(body.code), {
                    filePath: body.filePath || 'snippet.txt',
                    projectPath: projectPath || undefined,
                    platformRoot: baseDir
                }, {
                    mode: understandingMode,
                    aiProvider,
                    registry,
                    userCredentials
                });
            } else if (body.filePath && projectPath) {
                const abs = path.isAbsolute(body.filePath)
                    ? body.filePath
                    : path.join(projectPath, body.filePath);
                report = await understandFile(abs, {
                    projectPath,
                    platformRoot: baseDir,
                    relativePath: path.relative(projectPath, abs).replace(/\\/g, '/'),
                    mode: understandingMode,
                    understandingMode,
                    aiProvider,
                    registry,
                    userCredentials
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Provide code (string) or filePath + projectPath'
                });
            }

            return res.json({ success: true, understandingMode, aiProvider, report });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Code understanding failed') });
        }
    });

    app.post('/api/analyze/zscript-report', async (req, res) => {
        try {
            const body = req.body || {};
            let projectPath;
            try {
                projectPath = resolveSafeProjectPath(body.projectPath || body.path);
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }

            const report = await generateZscriptModReport(projectPath, {
                focus: body.focus || 'lighting-intensity',
                maxFiles: body.maxFiles || 600
            });

            res.set('Cache-Control', 'no-store');
            return res.json({ success: true, projectPath, report });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'ZScript report failed') });
        }
    });

    app.get('/api/analyze/zscript-report', async (req, res) => {
        try {
            let projectPath;
            try {
                projectPath = resolveSafeProjectPath(req.query.projectPath || req.query.path);
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }

            const report = await generateZscriptModReport(projectPath, {
                focus: req.query.focus || 'lighting-intensity'
            });

            res.set('Cache-Control', 'no-store');
            return res.json({ success: true, projectPath, report });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'ZScript report failed') });
        }
    });

    app.post('/api/analyze/expert-review', async (req, res) => {
        try {
            const body = req.body || {};
            let projectPath;
            try {
                projectPath = resolveSafeProjectPath(body.projectPath);
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }

            const entry = await appendExpertReview(baseDir, {
                projectPath,
                filePath: String(body.filePath || '').replace(/\\/g, '/'),
                domain: body.domain || null,
                validation: body.validation || 'reviewed',
                note: String(body.note || '').slice(0, 4000),
                reviewer: req.user?.email || body.reviewer || 'anonymous',
                aiPurpose: body.aiPurpose || null,
                businessLogicValid: body.businessLogicValid ?? null
            });

            return res.json({ success: true, review: entry });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Expert review save failed') });
        }
    });

    app.get('/api/analyze/expert-review', async (req, res) => {
        try {
            let projectPath = null;
            if (req.query.projectPath) {
                projectPath = resolveSafeProjectPath(req.query.projectPath);
            }
            const reviews = await loadExpertReviews(baseDir, {
                projectPath: projectPath || undefined,
                filePath: req.query.filePath ? String(req.query.filePath).replace(/\\/g, '/') : undefined,
                domain: req.query.domain || undefined
            });
            return res.json({ success: true, reviews, count: reviews.length });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Expert review load failed') });
        }
    });

    app.post('/api/analyze/export-bundle', async (req, res) => {
        logger.debug('[export-bundle] route entered');
        try {
            const body = req.body || {};
            const {
                normalizeCompleteScanInput,
                completeScanHasExportableResults
            } = require('../lib/complete-scan-audit-report.cjs');
            const rawScan = body.completeScan || body.report;
            const completeScan = normalizeCompleteScanInput(rawScan) || rawScan;
            if (!completeScan || typeof completeScan !== 'object') {
                logger.debug('[export-bundle] missing completeScan');
                return res.status(400).json({
                    success: false,
                    error: 'completeScan payload is required — run Complete scan first, then export ZIP.'
                });
            }
            if (!completeScanHasExportableResults(completeScan)) {
                logger.debug('[export-bundle] no exportable results');
                return res.status(400).json({
                    success: false,
                    error: 'Export bundle requires at least one completed scan step with results.'
                });
            }

            const hasAdmin = hasAdminDeliverableAccess(req);
            const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true'
                || body.internalDashboard === true;

            logger.debug('[export-bundle] calling buildAnalyzeExportZipStream');
            const { buildAnalyzeExportZipStream } = require('../lib/analyze-export-bundle.cjs');
            let zipResult;
            try {
                zipResult = await buildAnalyzeExportZipStream(completeScan, {
                    deliverableSku: body.deliverableSku,
                    internalDashboard,
                    publicGateLocked: publicGateEnabled && !internalDashboard && !hasAdmin,
                    hasAuditDeliverableAccess: (!publicGateEnabled && !closedVaultMode) || hasAdmin,
                    cloudTeamsActive: body.cloudTeamsActive === true,
                    client: body.client,
                    company: body.company,
                    assessor: body.assessor,
                    milestone: body.milestone,
                    projectName: body.projectName,
                    agencyName: body.agencyName,
                    aiProvider: body.aiProvider || 'demo',
                    selectedEngines: normalizeStringList(body.selectedEngines),
                    enginesRun: normalizeStringList(body.enginesRun),
                    credentials: body.credentials,
                    baseDir,
                    outputStream: res,
                    setHeaders: () => {
                        res.set('Cache-Control', 'no-store');
                        res.set('Content-Type', 'application/zip');
                        res.set('Content-Disposition', 'attachment; filename="simplebeacon-export.zip"');
                    }
                });
                logger.debug(`[export-bundle] ZIP streamed, filename=${zipResult.filename}`);
            } catch (error) {
                logger.debug(`[export-bundle] error during ZIP generation: ${safeErrorMessage(error)}`);
                if (error.code === 'export_paywall') {
                    return res.status(402).json({
                        success: false,
                        error: safeErrorMessage(error),
                        checkoutUrl: auditCheckoutUrl
                    });
                }
                if (error.code === 'export_empty' || error.code === 'tier_scan_mismatch') {
                    return res.status(422).json({
                        success: false,
                        error: safeErrorMessage(error),
                        warnings: error.warnings || []
                    });
                }
                throw error;
            }
            // Headers already sent; archive was piped to res by buildAnalyzeExportZipStream
            logger.debug('[export-bundle] response streamed');
        } catch (error) {
            logger.warn('[export-bundle] generation failed', { error: safeErrorMessage(error) });
            return res.status(400).json({ success: false, error: toClientError(error, 'Export bundle generation failed') });
        }
    });

    /**
     * POST /api/simplebeacon/export/certificate
     * Generate a co-branded agency certificate from the certificate-export-panel fields.
     * Formats: html (standalone), zip (bundled with reports), email (sent to billing email).
     */
    app.post('/api/simplebeacon/export/certificate', async (req, res) => {
        try {
            const body = req.body || {};
            const report = body.report || body.completeScan || null;
            const format = String(body.format || 'html').toLowerCase();

            // Load stored certificate profile defaults from subscription
            let storedProfile = null;
            if (req.user?.email) {
                try {
                    const { getSubscriptionByEmail } = require('../lib/simplebeacon-subscription-store.cjs');
                    const sub = await getSubscriptionByEmail(req.user.email);
                    if (sub) {
                        storedProfile = {
                            milestone: sub.certMilestone,
                            clientName: sub.certClientName,
                            projectName: sub.certProjectName,
                            orgId: sub.certOrgId
                        };
                    }
                } catch {
                    storedProfile = null;
                }
            }

            const milestone = String(body.milestone || storedProfile?.milestone || 'release').toLowerCase();
            const clientName = String(body.client_name || body.clientName || storedProfile?.clientName || '').trim() || 'Client';
            const projectName = String(body.project_name || body.projectName || storedProfile?.projectName || '').trim() || 'Project';
            const projectId = String(body.project_id || body.projectId || '').trim();
            const orgId = String(body.org_id || body.orgId || storedProfile?.orgId || 'default').trim();
            const emailTo = String(body.email || body.emailTo || '').trim();

            if (!report || typeof report !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'report is required — run a Simplebeacon gate scan first.'
                });
            }

            // Load agency branding if org_id is provided
            let branding = null;
            try {
                branding = await loadAgencyBranding(orgId);
            } catch {
                branding = null;
            }

            // Build certificate model using the panel fields
            const certificateModel = buildCertificateModel({
                report,
                milestone,
                project_name: projectName,
                client_name: clientName,
                agency_name: branding?.branding?.agency_name || branding?.agency_name || 'SimpleBeacon',
                branding: branding?.branding || branding || null
            });
            const certificateHtml = renderCertificateHtml(certificateModel);

            if (format === 'html') {
                res.set('Cache-Control', 'no-store');
                res.set('Content-Type', 'text/html; charset=utf-8');
                return res.send(certificateHtml);
            }

            if (format === 'zip') {
                const { normalizeCompleteScanInput } = require('../lib/complete-scan-audit-report.cjs');
                const completeScan = normalizeCompleteScanInput(body.completeScan) || body.completeScan || report;
                const zipResult = await buildAnalyzeExportZipStream(completeScan, {
                    deliverableSku: body.deliverableSku || 'clearance499',
                    internalDashboard: process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true',
                    publicGateLocked: publicGateEnabled && !hasAdminDeliverableAccess(req),
                    hasAuditDeliverableAccess: !publicGateEnabled && !closedVaultMode || hasAdminDeliverableAccess(req),
                    milestone,
                    client: clientName,
                    projectName,
                    agencyName: branding?.branding?.agency_name || 'SimpleBeacon',
                    aiProvider: body.aiProvider || 'demo'
                });
                res.set('Cache-Control', 'no-store');
                res.set('Content-Type', 'application/zip');
                res.set('Content-Disposition', `attachment; filename="${zipResult.filename}"`);
                res.set('X-Simplebeacon-Export-Tier', zipResult.tierId || '');
                zipResult.stream.pipe(res);
                return;
            }

            if (format === 'email') {
                const recipient = emailTo || req.user?.email;
                if (!recipient) {
                    return res.status(400).json({
                        success: false,
                        error: 'email is required for format=email. Provide body.email or sign in.'
                    });
                }
                const emailResult = await sendEmail({
                    to: recipient,
                    subject: `SimpleBeacon Code Hygiene Certificate — ${projectName}`,
                    text: `Your ${milestone} milestone certificate is attached as HTML.\n\nOpen it in any browser and print to PDF (Ctrl+P / Cmd+P → Save as PDF).\n\nCertificate ID: ${certificateModel.certificateId}\nClient: ${clientName}\nProject: ${projectName}`,
                    html: certificateHtml
                });
                return res.json({
                    success: true,
                    certificateId: certificateModel.certificateId,
                    format: 'email',
                    emailSent: emailResult.sent,
                    emailQueued: emailResult.queued,
                    message: emailResult.sent
                        ? 'Certificate emailed successfully.'
                        : 'Certificate queued for email delivery (SMTP not configured).'
                });
            }

            return res.status(400).json({
                success: false,
                error: `Unsupported format: ${format}. Use html, zip, or email.`
            });
        } catch (error) {
            logger.warn('[certificate-export] failed', { error: safeErrorMessage(error) });
            return res.status(400).json({ success: false, error: toClientError(error, 'Certificate export failed') });
        }
    });

    app.post('/api/analyze/complete-audit-report', async (req, res) => {
        try {
            const body = req.body || {};
            const rawScan = body.completeScan || body.report;
            const { normalizeCompleteScanInput } = require('../lib/complete-scan-audit-report.cjs');
            const completeScan = normalizeCompleteScanInput(rawScan) || rawScan;
            if (!completeScan || typeof completeScan !== 'object') {
                return res.status(400).json({ success: false, error: 'completeScan payload is required' });
            }
            if (publicGateEnabled && !hasAdminDeliverableAccess(req)) {
                return rejectPaidDeliverable(res, auditCheckoutUrl);
            }
            const aiProvider = String(body.aiProvider || 'demo').toLowerCase();
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials, DEFAULT_OLLAMA_URL);
            const reportModulePath = require.resolve('../lib/complete-scan-audit-report.cjs');
            if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') {
                delete require.cache[reportModulePath];
            }
            const { buildCompleteAuditReport } = require('../lib/complete-scan-audit-report.cjs');
            const { assessAuditExportTier, resolveAuditClientName } = require('../lib/audit-export-tier.cjs');

            const tierPreview = assessAuditExportTier(completeScan);
            if (tierPreview.exportBlocked) {
                return res.status(422).json({
                    success: false,
                    error: tierPreview.blockReason,
                    tier: tierPreview.tier,
                    missingForHandoff: tierPreview.missingForHandoff
                });
            }

            const projectPath = completeScan.projectPath || completeScan.projectRoot || '';
            const clientName = resolveAuditClientName(
                { client: body.client, company: body.company, projectName: body.projectName },
                projectPath
            );

            const report = await buildCompleteAuditReport(completeScan, {
                client: clientName,
                company: clientName,
                projectName: body.projectName,
                assessor: body.assessor,
                credentials: body.credentials,
                aiProvider: providerOpts?.providerId || aiProvider,
                summarizeFn: providerOpts
                    ? async (providerId, payload, _opts) => summarizeScanWithProvider(
                        providerId,
                        { reportKind: 'complete-audit-report', prompt: payload.prompt },
                        {
                            projectPath: payload.projectPath || completeScan.projectPath,
                            userCredentials,
                            registry,
                            reportType: 'complete-audit-report',
                            customPrompt: payload.prompt,
                            ollamaBaseUrl: registry.ollamaBaseUrl,
                            ollamaModel: providerOpts.ollamaModel,
                            model: providerOpts.model
                        }
                    )
                    : null
            });

            res.set('Cache-Control', 'no-store');
            return res.json({
                success: true,
                aiProvider: report.aiProvider,
                aiEnhanced: report.aiEnhanced,
                filename: report.filename,
                html: report.html,
                tier: report.tier,
                exportTierLabel: report.exportTierLabel,
                missingForHandoff: report.missingForHandoff
            });
        } catch (error) {
            logger.warn('[complete-audit-report] generation failed', { error: safeErrorMessage(error) });
            return res.status(400).json({ success: false, error: toClientError(error, 'Audit report generation failed') });
        }
    });

    app.get('/api/analyze/list-directories', async (req, res) => {
        try {
            const rawPath = String(req.query.path || '');
            const allowedRoots = resolveDefaultAllowedRoots(baseDir, { monorepoRoot });

            // Empty path or root => list all local drives (Windows) or the allowed analysis roots
            // (Unix-like). The server is not allowed to list /, so we present the roots the user can
            // actually analyze instead of returning a 403.
            if (!rawPath || rawPath === '/') {
                if (process.platform === 'win32') {
                    const drives = [];
                    for (let i = 65; i <= 90; i++) {
                        const letter = String.fromCharCode(i);
                        const drive = `${letter}:/`;
                        try {
                            if (fs.existsSync(drive)) {
                                drives.push({ name: `${letter}:\\`, path: drive });
                            }
                        }
                        catch (e) { /* skip inaccessible drives */ }
                    }
                    if (drives.length > 0) {
                        return res.json({ success: true, current: '', parent: null, directories: drives });
                    }
                }
                const roots = dedupeResolvedRoots(allowedRoots)
                    .filter((root) => fs.existsSync(root))
                    .map((root) => ({
                        name: path.basename(root) || root,
                        path: root.replace(/\\/g, '/')
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                return res.json({ success: true, current: '', parent: null, directories: roots });
            }

            const candidate = resolveProjectPath(baseDir, rawPath, monorepoRoot);
            let targetPath;
            try {
                targetPath = assertSafeProjectPath(candidate, allowedRoots, 'path');
            } catch (e) {
                // Directory browsers may walk above allowed roots; allow listing ancestors
                // so the user can still navigate down into an allowed project directory.
                if (!isPathAncestorOfRoots(candidate, allowedRoots)) {
                    return res.status(403).json({ success: false, error: e.message });
                }
                targetPath = path.resolve(candidate);
            }
            const stat = await fs.promises.stat(targetPath);
            if (!stat.isDirectory()) {
                return res.status(400).json({ success: false, error: 'path is not a directory' });
            }
            const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
            const dirs = entries
                .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
                .map((entry) => ({
                    name: entry.name,
                    path: path.join(targetPath, entry.name).replace(/\\/g, '/')
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const parent = path.dirname(targetPath).replace(/\\/g, '/');
            const isRoot = targetPath === parent || (!isPathWithinRoots(parent, allowedRoots) && !isPathAncestorOfRoots(parent, allowedRoots));
            res.json({
                success: true,
                current: targetPath.replace(/\\/g, '/'),
                parent: isRoot ? null : parent,
                directories: dirs
            });
        } catch (error) {
            logger.warn('[list-directories] failed', { error: safeErrorMessage(error) });
            return res.status(400).json({ success: false, error: toClientError(error, 'Directory listing failed') });
        }
    });

    const { registerEuAiActAuditRoute } = require('./eu-ai-act-audit-route.cjs');
    registerEuAiActAuditRoute(app, {
        baseDir,
        monorepoRoot,
        publicGateEnabled,
        auditCheckoutUrl
    });

    app.post('/api/analyze/summary', async (req, res) => {
        try {
            const body = req.body || {};
            const aiProvider = String(body.aiProvider || 'demo').toLowerCase();
            const projectPath = body.projectPath || '';
            const report = body.report;
            if (!report || typeof report !== 'object') {
                return res.status(400).json({ success: false, error: 'report is required' });
            }

            const reportType = body.reportType || report.type || '';
            if (reportType === 'file-merger-reduction-report') {
                const { buildConsolidationConclusion } = require('../lib/file-merger-reduction-scanner.cjs');
                return res.json({
                    success: true,
                    aiProvider,
                    enhanced: true,
                    summary: buildConsolidationConclusion(report),
                    provider: 'Simplebeacon rules'
                });
            }

            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req, getUserAiCredentials);
            const payload = normalizeReportForSummary(report, body.reportType || report.type);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials, DEFAULT_OLLAMA_URL);

            if (!providerOpts) {
                return res.json({
                    success: true,
                    enhanced: false,
                    aiProvider,
                    message: 'Filesystem scan only — select a configured provider for an AI narrative summary.'
                });
            }

            const summaryFocus = String(body.summaryFocus || 'all').toLowerCase();
            const enhanced = await summarizeScanWithProvider(
                providerOpts.providerId,
                payload,
                {
                    projectPath,
                    userCredentials,
                    registry,
                    reportType: body.reportType || report.type || payload.reportKind,
                    summaryFocus,
                    ollamaBaseUrl: registry.ollamaBaseUrl,
                    ollamaModel: providerOpts.ollamaModel,
                    model: providerOpts.model
                }
            );

            return res.json({
                success: true,
                aiProvider,
                enhanced: enhanced.enhanced,
                summary: enhanced.summary || null,
                provider: enhanced.provider,
                modelFallback: enhanced.modelFallback || null,
                timingBuckets: enhanced.timingBuckets || null
            });
        } catch (error) {
            return res.json({
                success: true,
                aiProvider: String(req.body?.aiProvider || 'demo').toLowerCase(),
                enhanced: false,
                error: safeErrorMessage(error),
                message: safeErrorMessage(error)
            });
        }
    });

    app.post('/api/analyze/compliance-checklist', async (req, res) => {
        try {
            const body = req.body || {};
            const report = body.report;
            if (!report || typeof report !== 'object') {
                return res.status(400).json({ success: false, error: 'report is required' });
            }

            let projectPath = null;
            if (body.projectPath) {
                try {
                    projectPath = resolveSafeProjectPath(body.projectPath);
                } catch (err) {
                    return res.status(400).json({ success: false, error: safeErrorMessage(err) });
                }
            }

            const resolvedRoot = projectPath || report.projectRoot || baseDir;

            const withTimeout = (promise, ms) => Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Scan timed out')), ms))
            ]);

            let npmAudit = body.npmAudit || null;
            if (!npmAudit) {
                try {
                    npmAudit = await withTimeout(
                        runNpmAuditAsync(resolvedRoot, { force: body.forceNpmAudit === true }),
                        20000
                    );
                } catch {
                    npmAudit = null;
                }
            }

            // Run data-cleanup scan so compliance can reference cleanup findings
            let dataCleanup = body.dataCleanup || null;
            if (!dataCleanup) {
                try {
                    dataCleanup = await withTimeout(
                        runDataCleanupScan(resolvedRoot, { profile: 'all' }),
                        20000
                    );
                } catch {
                    dataCleanup = null;
                }
            }

            const complianceChecklist = evaluateComplianceChecklist(report, {
                projectRoot: resolvedRoot,
                npmAudit,
                dataCleanup,
                checklistProfile: body.checklistProfile || body.checklist || undefined,
                productionProfile: body.productionProfile
            });

            let complianceExport = null;
            try {
                complianceExport = sanitizeComplianceBundleExport({
                    checklist: complianceChecklist,
                    gateReport: report,
                    npmAudit,
                    projectPath: resolvedRoot
                });
            } catch {
                complianceExport = null;
            }

            res.set('Cache-Control', 'no-store');
            return sendAnalyzeJson(res, {
                success: true,
                complianceChecklist,
                complianceExport,
                dataCleanup,
                npmAuditSource: npmAudit?.dataSource || npmAudit?.source || null
            }, 200, sendAnalyzeJsonOpts);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: toClientError(error, 'Compliance checklist failed')
            });
        }
    });

    app.post('/api/analyze/github-clone', async (req, res) => {
        const body = req.body || {};
        const repoUrl = String(body.repoUrl || '').trim();
        if (!repoUrl) {
            return res.status(400).json({ success: false, error: 'repoUrl is required' });
        }
        const refresh = body.refresh === true;
        const cacheKey = crypto.createHash('sha256').update(repoUrl).digest('hex').slice(0, 16);
        const cacheDir = path.join(os.tmpdir(), 'sb-github-cache');
        const projectPath = path.join(cacheDir, cacheKey);
        try {
            const cacheExists = await fs.promises.access(projectPath).then(() => true).catch(() => false);
            if (!refresh && cacheExists) {
                return res.json({ success: true, projectPath, cached: true });
            }
            await fs.promises.mkdir(cacheDir, { recursive: true });
            if (cacheExists) {
                await fs.promises.rm(projectPath, { recursive: true, force: true });
            }
            const safeRepoUrl = repoUrl.replace(/["';`$|&<>(){}[\]\n\r]/g, '');
            const { stdout, stderr } = await execAsync(
                `git clone --depth 1 "${safeRepoUrl}" "${projectPath}"`,
                { timeout: 120000, maxBuffer: 1024 * 1024 }
            );
            if (stderr && !stderr.includes('Cloning into')) {
                logger.warn('[GitHub Clone] stderr:', stderr);
            }
            return res.json({ success: true, projectPath, cached: false });
        } catch (err) {
            logger.error('[GitHub Clone] failed:', safeErrorMessage(err));
            return res.status(500).json({ success: false, error: safeErrorMessage(err) || 'Git clone failed' });
        }
    });

    app.get('/api/analyze/npm-audit', async (req, res) => {
        try {
            let projectPath = baseDir;
            if (req.query.projectPath || req.query.path) {
                try {
                    projectPath = resolveSafeProjectPath(req.query.projectPath || req.query.path);
                } catch (err) {
                    return res.status(400).json({ success: false, error: safeErrorMessage(err) });
                }
            }

            const force = req.query.force === '1' || req.query.force === 'true';
            const npmAudit = await runNpmAuditAsync(projectPath, { force });
            res.set('Cache-Control', 'no-store');
            return sendAnalyzeJson(res, {
                success: true,
                ...npmAudit,
                projectPath,
                auditRoot: projectPath
            }, 200, sendAnalyzeJsonOpts);
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: toClientError(error, 'npm audit failed')
            });
        }
    });

    const { registerDataCleanupAnalyzeRoute, runDataCleanupScan } = require('../lib/data-cleanup-scan.cjs');
    registerDataCleanupAnalyzeRoute(app, {
        baseDir,
        monorepoRoot,
        sendJson: sendAnalyzeJson
    });

    /**
     * POST /api/analyze/upload-directory
     * Accepts a directory of source files via multipart upload, runs a Simplebeacon scan,
     * and returns the report JSON. Files are saved to a temp directory then cleaned up.
     */
    // Graceful multer error handler for this route
    app.use('/api/analyze/upload-directory', (err, req, res, next) => {
        if (err && err instanceof multer.MulterError) {
            logger.warn(`[Upload Directory] Multer error: ${err.code} - ${err.message}`);
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(413).json({ success: false, error: 'Too many files. Maximum 100,000 files allowed per upload.' });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, error: 'One or more files exceed the 5 GB size limit.' });
            }
            return res.status(413).json({ success: false, error: `Upload rejected: ${err.message} (${err.code})` });
        }
        next(err);
    });
    const uploadDirLimiter = rateLimit({
        windowMs: constants.RATE_LIMIT_WINDOW_MS,
        max: 5,
        message: { success: false, error: 'Too many upload requests. Please try again in 15 minutes.' },
        standardHeaders: true,
        legacyHeaders: false
    });
    const uploadDirMulter = multer({
        storage: multer.memoryStorage(),
        limits: { files: 100000, fileSize: 5 * constants.BYTES_PER_KB * constants.BYTES_PER_KB * constants.BYTES_PER_KB, fieldSize: 50 * constants.BYTES_PER_KB * constants.BYTES_PER_KB },
        fileFilter: (req, file, cb) => {
            // Accept all file types for directory uploads
            cb(null, true);
        }
    });
    app.post('/api/analyze/upload-directory', uploadDirLimiter, uploadDirMulter.array('files', 100000), async (req, res) => {
        const tmpDir = path.join(os.tmpdir(), 'sb-upload-' + Date.now());
        const analysisType = String(req.body?.analysisType || 'simplebeacon').toLowerCase();
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded' });
            }

            // Write uploaded files to temp directory preserving paths
            fs.mkdirSync(tmpDir, { recursive: true });
            let filePaths2 = [];
            try {
                const parsed = JSON.parse(req.body?.filePaths || '[]');
                if (Array.isArray(parsed)) filePaths2 = parsed;
            } catch (e) { filePaths2 = []; }
            for (let i = 0; i < req.files.length; i++) {
                const relPath = filePaths2[i] || req.files[i].originalname || req.files[i].fieldname;
                const safeRel = sanitizeUploadPath(relPath);
                const outPath = path.join(tmpDir, safeRel);
                fs.mkdirSync(path.dirname(outPath), { recursive: true });
                fs.writeFileSync(outPath, req.files[i].buffer);
            }

            // If a single ZIP file was uploaded, stream-extract it to get all files past browser webkitdirectory limits
            if (req.files.length === 1 && req.files[0].originalname.toLowerCase().endsWith('.zip')) {
                const zipRel = filePaths2[0] || req.files[0].originalname || req.files[0].fieldname;
                const zipPath = path.join(tmpDir, sanitizeUploadPath(zipRel));
                logger.info(`[Upload Directory] Detected ZIP archive. Streaming extract to ${tmpDir}...`);
                try {
                    await new Promise((resolve, reject) => {
                        fs.createReadStream(zipPath)
                            .pipe(unzipper.Extract({ path: tmpDir }))
                            .on('close', resolve)
                            .on('error', reject);
                    });
                    logger.info(`[Upload Directory] ZIP streamed to ${tmpDir}`);
                    // Remove the raw ZIP so the scan only sees extracted source files
                    try {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                    } catch (cleanupErr) {
                        logger.warn(`[Upload Directory] ZIP cleanup skipped: ${safeErrorMessage(cleanupErr)}`);
                    }
                } catch (zipErr) {
                    logger.warn(`[Upload Directory] ZIP extraction failed: ${safeErrorMessage(zipErr)}. Proceeding with raw upload.`);
                }
            }

            logger.info(`[Upload Directory] Received ${req.files.length} files, wrote to ${tmpDir}`);

            // Run Simplebeacon scan on the temp directory (always run as baseline)
            const cliBin = path.join(monorepoRoot, 'packages/simplebeacon-cli/bin/simplebeacon.js');
            const reportOut = path.join(tmpDir, '.simplebeacon', 'report.json');
            fs.mkdirSync(path.dirname(reportOut), { recursive: true }); // simplebeacon-ignore sync-io — temp directory creation before scan execution

            let report = null;
            if (!fs.existsSync(cliBin)) {
                logger.warn(`[Upload Directory] CLI binary not found at ${cliBin} — falling back to programmatic analysis`);
                try {
                    const analysis = await withTimeout(
                        getAnalyzeCodebase()(tmpDir, { includeEslint: false, maxDeepAnalyze: 3000, context: 'dashboard', scanProfile: 'universal' }),
                        60_000,
                        'upload directory codebase analysis'
                    );
                    report = {
                        type: 'simplebeacon-report',
                        version: '1.0.0',
                        generatedAt: new Date().toISOString(),
                        projectPath: tmpDir,
                        summary: analysis.summary || {},
                        categories: analysis.categories || [],
                        findings: analysis.findings || [],
                        gate: { pass: (analysis.summary?.healthScore || 100) >= 80, score: analysis.summary?.healthScore || 100 }
                    };
                    await fs.promises.writeFile(reportOut, JSON.stringify(report, null, 2));
                    logger.info(`[Upload Directory] Programmatic scan completed, health=${report.gate.score}`);
                } catch (progErr) {
                    logger.error('[Upload Directory] Programmatic fallback failed:', progErr.message);
                    throw progErr;
                }
            } else {
                // simplebeacon:production-leak-intent: config-comment - Merge project config so server scans use the same ignore/skip rules as local scans
                const tempConfigPath = path.join(tmpDir, '.simplebeacon', 'config.json');
                let baseConfig = {};
                const configCandidates = [
                    path.join(projectPath, '.simplebeacon', 'config.json'),
                    path.join(baseDir, '.simplebeacon', 'config.json')
                ];
                for (const candidate of configCandidates) {
                    try {
                        await fs.promises.access(candidate);
                        baseConfig = JSON.parse(await fs.promises.readFile(candidate, 'utf8'));
                        break;
                    } catch (readErr) {
                        logger.warn('[Flexible Analyze] Could not read config candidate:', candidate, readErr.message);
                    }
                }
                const defaultIgnore = [
                    '*.log', '*.backup.*', '*.tmp',
                    'node_modules/**', '.git/**', 'coverage/**',
                    'dist/**', 'build/**', '.github/**',
                    '**/*.test.js', '**/*.spec.js',
                    '**/*.test.ts', '**/*.spec.ts',
                    '**/*.map', '**/*.min.js', '**/*.min.css',
                    '**/*.d.ts', '**/*.lock', '**/*.lockb',
                    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
                    '.DS_Store', 'Thumbs.db',
                    '*.woff', '*.woff2', '*.ttf', '*.eot',
                    '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico',
                    '*.mp4', '*.webm', '*.mp3', '*.wav',
                    '*.pdf', '*.doc', '*.docx', '*.zip', '*.tar', '*.gz',
                    '**/cp*.json', '**/euc*.json', '**/gbk*.json',
                    '**/shiftjis.json', '**/big5*.json', '**/encoding*.json',
                    '**/codes.json', '**/dbcs*.js', '**/dbcs*.json'
                ];
                const defaultSkipDirs = ['.git', 'node_modules', 'coverage', 'dist', 'build', '.simplebeacon', 'tmp'];
                const scanConfig = {
                    ...baseConfig,
                    scanPaths: ['.'],
                    productionPaths: ['.'],
                    fullDirectoryScan: true,
                    allowedAnalysisRoots: [projectPath],
                    fullDirectoryScanSkipDirs: [...new Set([...defaultSkipDirs, ...(baseConfig.fullDirectoryScanSkipDirs || [])])],
                    ignore: [...new Set([...defaultIgnore, ...(baseConfig.ignore || [])])]
                };
                fs.writeFileSync(tempConfigPath, JSON.stringify(scanConfig, null, 2));

                const scanCmd = `node "${cliBin}" scan --path "${tmpDir}" --config "${tempConfigPath}" --format json --output "${reportOut}" --offline --full`;
                let stdout = '';
                let stderr = '';
                try {
                    const result = await execAsync(scanCmd, { cwd: baseDir, timeout: Number(process.env.SIMPLEBEACON_SCAN_TIMEOUT_MS) || constants.TIMEOUT_10M, env: { ...process.env, FORCE_COLOR: '0' } });
                    stdout = result.stdout || '';
                    stderr = result.stderr || '';
                } catch (err) {
                    stdout = err.stdout || '';
                    stderr = err.stderr || '';
                    try { await fs.promises.access(reportOut); } catch { throw err; }
                }

                report = JSON.parse(await fs.promises.readFile(reportOut, 'utf8'));
                report = patchRemediationPhases(report);
                logger.info(`[Upload Directory] Scan found: totalFiles=${report.totalFiles || report.repositoryFilesTotal || 'n/a'}, scanned=${report.ruleScopedFilesAnalyzed || 'n/a'}, issues=${report.issueCount || report.gate?.blockingCount || 'n/a'}`);
            }
            const results = { simplebeacon: report };

            // Run additional analyses based on selected analysis type
            const runComplete = analysisType === 'complete';
            const ANALYZER_TIMEOUT = constants.TIMEOUT_10M; // 10 min per analyzer
            /**
             * Run an analyzer with a timeout, logging start/finish.
             * @param {string} label Analyzer name for logging.
             * @param {Function} fn Analyzer function to execute.
             * @param {number} [timeoutMs] Timeout in milliseconds.
             * @returns {Promise<any>}
             */
            const runAnalyzer = async (label, fn, timeoutMs = ANALYZER_TIMEOUT) => {
                if (typeof fn !== 'function') {
                    throw new TypeError(`Analyzer ${label} requires a function, received ${typeof fn}`);
                }
                const t0 = Date.now();
                logger.info(`[Upload Directory] Starting analyzer: ${label} (timeout ${timeoutMs}ms)`);
                try {
                    const result = await withTimeout(fn(), timeoutMs, label);
                    logger.info(`[Upload Directory] Finished analyzer: ${label} in ${Date.now() - t0}ms`);
                    return result;
                } catch (e) {
                    logger.warn(`[Upload Directory] Analyzer ${label} failed after ${Date.now() - t0}ms:`, e.message);
                    return { error: e.message };
                }
            };

            if (analysisType === 'codebase' || runComplete) {
                results.codebase = await runAnalyzer('codebase', () => getAnalyzeCodebase()(tmpDir, { context: 'dashboard', scanProfile: 'universal' }));
            }
            if (analysisType === 'npm-audit' || runComplete) {
                results.npmAudit = await runAnalyzer('npm-audit', () => runNpmAuditAsync(tmpDir, { force: false }));
            }
            if (analysisType === 'data-cleanup' || runComplete) {
                results.dataCleanup = await runAnalyzer('data-cleanup', () => runDataCleanupScan(tmpDir, { profile: 'all' }));
            }
            if (analysisType === 'compliance' || runComplete) {
                const dataCleanupForCompliance = results.dataCleanup || results.cleanupAssistant?.fileReduction || results.fileReduction || null;
                results.compliance = await runAnalyzer('compliance', () => Promise.resolve(evaluateComplianceChecklist(report, {
                    projectRoot: tmpDir,
                    npmAudit: results.npmAudit,
                    dataCleanup: dataCleanupForCompliance
                })));
            }
            if (analysisType === 'file-reduction' || runComplete) {
                results.fileReduction = await runAnalyzer('file-reduction', () => scanFileMergerReduction(tmpDir, { includeRepositoryInventory: true }));
            }
            if (analysisType === 'removable-files' || runComplete) {
                results.removableFiles = await runAnalyzer('removable-files', () => scanRemovableFiles(tmpDir));
            }
            if (analysisType === 'roadmap' || runComplete) {
                results.roadmap = await runAnalyzer('roadmap', () => generateCodeRoadmap(tmpDir, {}, { scanReport: report, includeFiles: true }));
            }
            if (analysisType === 'data-quality' || runComplete) {
                const profile = analysisType === 'data-quality' ? 'data-quality' : 'all';
                results.dataQuality = await runAnalyzer('data-quality', () => runDataCleanupScan(tmpDir, { profile }));
            }
            if (analysisType === 'cleanup-assistant' || runComplete) {
                results.cleanupAssistant = await runAnalyzer('cleanup-assistant', async () => {
                    const fileReduction = await runDataCleanupScan(tmpDir, { profile: 'file-reduction' });
                    const dataQuality = await runDataCleanupScan(tmpDir, { profile: 'data-quality' });
                    const inventory = fileReduction?.inventory || dataQuality?.inventory || null;
                    const plan = fileReduction?.fileReductionPlan || fileReduction?.plan || null;
                    const safeDirs = plan?.safeToDelete?.topDirectories || [];
                    const reviewDirs = plan?.reviewBeforeDelete?.logs || [];
                    const brief = {
                        projectPath: tmpDir,
                        inventory: {
                            totalFiles: inventory?.totalFiles ?? null,
                            totalFolders: inventory?.totalDirectories ?? null
                        },
                        tiers: {
                            safeNow: { files: 0, bytes: 0, directories: safeDirs },
                            reviewFirst: { files: reviewDirs.length, bytes: 0, items: reviewDirs },
                            protected: { files: 0, bytes: 0, directories: [] },
                            investigate: { files: plan?.unusedFiles?.candidates ?? 0, note: plan?.unusedFiles?.note || null }
                        },
                        analysis: {
                            fileReductionSummary: fileReduction?.summary || null,
                            dataQualitySummary: dataQuality?.summary || null
                        }
                    };
                    return { brief, fileReduction, dataQuality, repositoryInventory: inventory };
                });
            }
            if (analysisType === 'consolidation' || runComplete) {
                results.consolidation = await runAnalyzer('consolidation', () => buildCompleteAuditModel({ results }));
            }
            if (analysisType === 'mock-scan' || runComplete) {
                results.mockScan = await runAnalyzer('mock-scan', async () => {
                    const { mockFiles, issues } = await scanMockFiles(tmpDir);
                    return {
                        type: 'mock-data-analysis',
                        filesFound: mockFiles.length,
                        issuesDetected: issues.length,
                        dataQualityScore: mockFiles.length > 0 ? `${((mockFiles.length - issues.length) / mockFiles.length * 100).toFixed(1)}%` : '0%',
                        files: mockFiles.map(({ content, ...rest }) => rest),
                        issues
                    };
                });
            }
            if (analysisType === 'eu-ai-act' || runComplete) {
                results.euAiAct = await runAnalyzer('eu-ai-act', async () => {
                    try {
                        const reportModulePath = require.resolve('../lib/eu-ai-act-audit-report.cjs');
                        if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') delete require.cache[reportModulePath];
                        const { buildEuAiActAuditReport } = require('../lib/eu-ai-act-audit-report.cjs');

                        return await buildEuAiActAuditReport({
                            projectPath: tmpDir,
                            artifacts: {
                                platformRoot: tmpDir,
                                report: report,
                                compliance: null,
                                assessment: null
                            }
                        });
                    } catch (e) {
                        if (e.code === 'eu_ai_act_artifacts_missing') {
                            return {
                                type: 'eu-ai-act-audit',
                                status: 'no-artifacts',
                                message: e.message,
                                html: null,
                                filename: null,
                                reportId: null,
                                exportTier: 'eu-ai-act',
                                exportTierLabel: 'EU AI Act readiness (reference)',
                                platformRoot: null
                            };
                        }
                        throw e;
                    }
                });
            }

            // Select the primary report based on analysis type
            let reportJson = report;
            const typeMap = {
                'codebase': results.codebase,
                'npm-audit': results.npmAudit,
                'compliance': results.compliance,
                'data-cleanup': results.dataCleanup,
                'data-quality': results.dataQuality,
                'cleanup-assistant': results.cleanupAssistant,
                'file-reduction': results.fileReduction,
                'roadmap': results.roadmap,
                'consolidation': results.consolidation,
                'mock-scan': results.mockScan,
                'eu-ai-act': results.euAiAct
            };
            if (analysisType !== 'simplebeacon' && analysisType !== 'complete' && typeMap[analysisType]) {
                const specific = typeMap[analysisType];
                if (specific && !specific.error) {
                    if (analysisType === 'codebase') {
                        reportJson = {
                            ...report,
                            _codebaseAnalysis: specific,
                            qualityScore: specific.summary?.healthScore ?? report.qualityScore,
                            totalFiles: specific.summary?.codeFilesAnalyzed ?? report.totalFiles,
                            issueCount: specific.summary?.findingsTotal ?? report.issueCount
                        };
                    } else if (analysisType === 'data-quality' || analysisType === 'data-cleanup') {
                        reportJson = {
                            ...report,
                            _dataQualityAnalysis: specific,
                            qualityScore: specific.summary?.score ?? report.qualityScore,
                            totalFiles: specific.inventory?.totalFiles ?? report.totalFiles,
                            issueCount: specific.summary?.totalFindings ?? report.issueCount
                        };
                    } else if (analysisType === 'file-reduction') {
                        reportJson = {
                            ...report,
                            _fileReductionAnalysis: specific,
                            qualityScore: specific.summary?.score ?? report.qualityScore,
                            totalFiles: specific.inventory?.totalFiles ?? report.totalFiles,
                            issueCount: specific.summary?.totalFindings ?? report.issueCount
                        };
                    } else if (analysisType === 'cleanup-assistant') {
                        reportJson = {
                            ...report,
                            _cleanupAssistantAnalysis: specific,
                            qualityScore: report.qualityScore,
                            totalFiles: specific.brief?.inventory?.totalFiles ?? report.totalFiles,
                            issueCount: specific.brief?.tiers?.safeNow?.directories?.length ?? report.issueCount
                        };
                    } else if (analysisType === 'mock-scan') {
                        reportJson = {
                            ...report,
                            _mockScanAnalysis: specific,
                            qualityScore: specific.dataQualityScore ? parseFloat(specific.dataQualityScore) : report.qualityScore,
                            totalFiles: specific.filesFound ?? report.totalFiles,
                            issueCount: specific.issuesDetected ?? report.issueCount
                        };
                    } else if (analysisType === 'roadmap') {
                        reportJson = {
                            ...report,
                            _roadmapAnalysis: specific,
                            qualityScore: specific.executiveSummary?.completionRate ?? report.qualityScore,
                            totalFiles: specific.totalFiles ?? report.totalFiles,
                            issueCount: report.issueCount
                        };
                    } else if (analysisType === 'consolidation') {
                        reportJson = {
                            ...report,
                            _consolidationAnalysis: specific,
                            qualityScore: report.qualityScore,
                            totalFiles: report.totalFiles,
                            issueCount: report.issueCount
                        };
                    } else if (analysisType === 'npm-audit') {
                        reportJson = {
                            ...report,
                            _npmAuditAnalysis: specific,
                            qualityScore: report.qualityScore,
                            totalFiles: report.totalFiles,
                            issueCount: specific.vulnerabilities?.length ?? report.issueCount
                        };
                    } else if (analysisType === 'compliance') {
                        reportJson = {
                            ...report,
                            _complianceAnalysis: specific,
                            qualityScore: specific.summary?.score ?? report.qualityScore,
                            totalFiles: report.totalFiles,
                            issueCount: specific.summary?.failed ?? report.issueCount
                        };
                    } else if (analysisType === 'eu-ai-act') {
                        reportJson = {
                            ...report,
                            _euAiActAnalysis: specific,
                            qualityScore: specific.summary?.readinessScore ?? report.qualityScore,
                            totalFiles: report.totalFiles,
                            issueCount: specific.summary?.failed ?? report.issueCount
                        };
                    } else {
                        reportJson = specific;
                    }
                } else if (specific?.error) {
                    reportJson = { ...report, _analysisError: specific.error };
                }
            }
            if (analysisType === 'complete') {
                reportJson = {
                    ...report,
                    _completeResults: results
                };
            }

            // Override temp directory path with original project name from upload for display,
            // but keep absolute projectDir so downstream fs-based checks (buildReadiness, etc.) work
            const originalDirName2 = (filePaths2[0] && String(filePaths2[0]).includes('/'))
                ? String(filePaths2[0]).split('/')[0]
                : (filePaths2[0] && String(filePaths2[0]).includes('\\'))
                    ? String(filePaths2[0]).split('\\')[0]
                    : (req.body?.projectName || 'project');
            if (reportJson && typeof reportJson === 'object') {
                if (reportJson.projectRoot) reportJson.projectRoot = tmpDir;
                if (reportJson.projectPath) reportJson.projectPath = tmpDir;
                if (reportJson.scanTargetRoot) reportJson.scanTargetRoot = tmpDir;
                // Add display-friendly name separately
                reportJson.projectName = originalDirName2;
            }

            res.json({
                success: true,
                reportJson: reportJson,
                analysisType: analysisType,
                results: results,
                filesReceived: req.files.length,
                scanTarget: originalDirName2,
                privacy: {
                    mode: 'air-gapped',
                    networkActivity: false,
                    dataRemainsLocal: true,
                    description: 'Scan ran entirely on this machine. No files or data were transmitted to external services.'
                }
            });
        } catch (error) {
            logger.error('[Upload Directory] Scan failed:', safeErrorMessage(error));
            res.status(500).json({ success: false, error: toClientError(error, 'scan failed') });
        } finally {
            // Clean up temp directory after a short delay
            setTimeout(() => {
                try {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                } catch (e) {
                    logger.warn('[Upload Directory] Cleanup failed:', safeErrorMessage(e));
                }
            }, constants.TIMEOUT_5S);
        }
    });

    if (shouldLogRuntimeInfo()) {
        logger.info('[Flexible Analyze API] Enabled at /api/analyze/flexible');
    }
}


module.exports = {
    setupFlexibleAnalyzeAPI,
    buildRoadmapFromPath
};
