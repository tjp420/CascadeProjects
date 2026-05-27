/**
 * Flexible directory analysis — any path + AI provider + analysis mode.
 */

const logger = require('../lib/app-logger');

const fs = require('fs');
const path = require('path');
const { countRepositoryInventory } = require('../../packages/simplebeacon-cli/src/lib/repository-inventory');
const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
const { analyzeCodebase } = require('../lib/codebase-analyzer');
const { applyPublicGateToAnalyzeResponse } = require('../../packages/simplebeacon-cli/src/lib/report-sanitizer');
const { resolveScanProfile } = require('../lib/universal-language-config');
const { analyzeWithModel } = require('../services/model-inference-service');
const { ensureRegistry } = require('../services/local-model-service');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath,
    logResolvedAllowedRoots,
    formatAllowedRootsSummary
} = require('../lib/path-safety');
const { toClientError } = require('../lib/client-error');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store');
const {
    listAvailableProviders,
    providerConfigured,
    summarizeScanWithProvider
} = require('../services/cloud-inference-service');
const { analyzeStrategicInsights } = require('../lib/strategic-insights-engine');
const {
    understandCodeSnippet,
    understandFile,
    attachUnderstandingToCodebaseReport,
    appendExpertReview,
    loadExpertReviews,
    generateZscriptModReport
} = require('../lib/code-understanding');

function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

async function loadUserCredentials(req) {
    const email = req.user?.email;
    if (!email) return null;
    try {
        return await getUserAiCredentials(email);
    } catch {
        return null;
    }
}

function normalizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function resolveProjectPath(baseDir, rawPath) {
    const value = String(rawPath || '').trim();
    if (!value) return null;
    if (path.isAbsolute(value)) return path.normalize(value);
    return path.normalize(path.join(baseDir, value));
}

function isSameResolvedPath(a, b) {
    return path.resolve(a).replace(/\\/g, '/').toLowerCase()
        === path.resolve(b).replace(/\\/g, '/').toLowerCase();
}

function resolveMockScanPaths(baseDir, projectPath) {
    if (!projectPath || isSameResolvedPath(projectPath, baseDir)) {
        return [];
    }

    const { scanRoot, platformRoot } = resolvePlatformRoot(projectPath);
    const projectKey = path.resolve(projectPath).replace(/\\/g, '/').toLowerCase();
    const platformKey = path.resolve(platformRoot).replace(/\\/g, '/').toLowerCase();
    const baseKey = path.resolve(baseDir).replace(/\\/g, '/').toLowerCase();

    if (projectKey === platformKey || projectKey === baseKey) {
        return [];
    }
    // Monorepo parent or other ancestor — configured scan paths already cover platform mock data.
    if (platformKey.startsWith(`${projectKey}/`)) {
        return [];
    }
    if (projectKey === path.resolve(scanRoot).replace(/\\/g, '/').toLowerCase() && scanRoot !== platformRoot) {
        return [];
    }

    return [projectPath];
}

async function pathLooksLikeMockScan(targetPath) {
    try {
        const stat = await fs.promises.stat(targetPath);
        if (!stat.isDirectory()) return false;
        const entries = await fs.promises.readdir(targetPath);
        return entries.some((name) => name.endsWith('.json'));
    } catch {
        return false;
    }
}

async function resolveAnalysisType(requestedType, targetPath) {
    const type = String(requestedType || 'auto').toLowerCase();
    if (type === 'roadmap' || type === 'mock-scan' || type === 'codebase') return type;
    return (await pathLooksLikeMockScan(targetPath)) ? 'mock-scan' : 'roadmap';
}

function resolveModelId(registry, aiProvider) {
    const provider = String(aiProvider || 'active').toLowerCase();
    if (provider === 'demo') {
        return registry.models.find((m) => m.provider === 'demo')?.id || registry.activeModelId;
    }
    if (provider === 'active') {
        return registry.activeModelId;
    }
    if (provider === 'ollama') {
        return registry.models.find((m) => m.provider === 'ollama')?.id || registry.activeModelId;
    }
    return registry.activeModelId;
}

async function buildRoadmapFromPath(projectPath, options = {}) {
    const GlobalContextManager = require('../../src/core/GlobalContextManager');
    const RoadmapDataAnalyzer = require('../../src/core/RoadmapDataAnalyzer');
    const { buildHistoryEntryFromRoadmap } = require('../lib/roadmap-history-metrics');

    const resolvedPath = path.resolve(projectPath);
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
        throw new Error('Path must be an existing directory');
    }

    const includePaths = normalizeStringList(options.includePaths);
    const excludePatterns = normalizeStringList(options.excludePatterns);

    const contextManager = new GlobalContextManager(resolvedPath);
    await contextManager.initialize({ watch: false });

    const analyzer = new RoadmapDataAnalyzer(contextManager, {
        projectRoot: resolvedPath,
        includePaths,
        excludePatterns
    });
    analyzer.analysisCache.clear();
    analyzer.lastAnalysisTime = null;

    const roadmap = await analyzer.analyzeProjectForRoadmap();
    if (options.title) roadmap.projectTitle = options.title;
    if (options.description) roadmap.projectDescription = options.description;
    roadmap.sourceProjectPath = resolvedPath;
    roadmap.dataSource = 'filesystem-scan';
    roadmap.scanOptions = { includePaths, excludePatterns };

    const historyEntry = buildHistoryEntryFromRoadmap(roadmap, {
        projectPath: resolvedPath,
        title: options.title || roadmap.projectTitle || path.basename(resolvedPath),
        scanOptions: { includePaths, excludePatterns }
    });

    const insightsMode = String(options.roadmapInsightsMode || 'off').toLowerCase();
    if (insightsMode !== 'off' && insightsMode !== 'none') {
        const userCredentials = options.userCredentials || null;
        const registry = options.registry || null;
        roadmap.strategicInsights = await analyzeStrategicInsights({
            roadmap,
            mode: insightsMode === 'llm' ? 'llm' : 'deterministic',
            aiProvider: options.aiProvider,
            projectPath: resolvedPath,
            registry,
            userCredentials
        });
        if (roadmap.strategicInsights?.mode === 'llm' && roadmap.strategicInsights.llmProvider) {
            roadmap.inferenceMode = `${roadmap.inferenceMode || 'filesystem'} + strategic-insights-llm`;
        } else if (roadmap.strategicInsights) {
            roadmap.inferenceMode = `${roadmap.inferenceMode || 'filesystem'} + strategic-insights-rules`;
        }
    }

    return { roadmap, projectPath: resolvedPath, historyEntry };
}

function resolveAnalyzeAllowedRoots(baseDir, options = {}) {
    const monorepoRoot = options.monorepoRoot
        || path.resolve(path.join(baseDir, '..'));
    return resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
}

function setupFlexibleAnalyzeAPI(app, options = {}) {
    const baseDir = options.baseDir || path.join(__dirname, '..', '..');
    const monorepoRoot = options.monorepoRoot || path.resolve(path.join(baseDir, '..'));
    const publicGateEnabled = options.publicGateEnabled === true
        || (options.publicGateEnabled !== false && process.env.SIMPLEBEACON_PUBLIC_GATE === 'true');
    const closedVaultMode = options.closedVaultMode === true
        || process.env.SIMPLEBEACON_CLOSED_VAULT === 'true';
    const auditCheckoutUrl = options.auditCheckoutUrl
        || process.env.SIMPLEBEACON_AUDIT_CHECKOUT_URL
        || 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';

    function sendAnalyzeJson(res, payload, statusCode = 200) {
        const body = publicGateEnabled ? applyPublicGateToAnalyzeResponse(payload) : payload;
        return res.status(statusCode).json(body);
    }

    function rejectPaidDeliverable(res) {
        return res.status(402).json({
            success: false,
            publicGateLocked: true,
            error: 'Pre-Launch Audit PDF is a paid deliverable ($499). Unlock the full remediation log and executive PDF.',
            checkoutUrl: auditCheckoutUrl,
            auditPriceLabel: '$499'
        });
    }

    app.get('/api/simplebeacon/entitlements', (req, res) => {
        res.json({
            success: true,
            publicGateLocked: publicGateEnabled || closedVaultMode,
            closedVaultMode,
            hasAuditDeliverableAccess: !publicGateEnabled && !closedVaultMode,
            auditCheckoutUrl,
            auditPriceLabel: '$499'
        });
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
        const { authenticate } = require('../middleware/auth');
        app.use('/api/analyze', authenticate);
    }

    function getAllowedRoots() {
        return resolveAnalyzeAllowedRoots(baseDir, { monorepoRoot });
    }

    logResolvedAllowedRoots(getAllowedRoots(), 'analyze-api startup');

    function resolveSafeProjectPath(rawPath) {
        const candidate = resolveProjectPath(baseDir, rawPath);
        if (!candidate) return null;
        return assertSafeProjectPath(candidate, getAllowedRoots());
    }

    app.get('/api/analyze/providers', async (req, res) => {
        try {
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req);
            const allowedRoots = getAllowedRoots();
            res.json({
                success: true,
                defaultProjectPath: baseDir,
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
                    { id: 'llm', label: 'AI-enhanced understanding', description: 'Adds LLM explanation when Ollama/OpenAI/Anthropic is configured' }
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

    app.post('/api/analyze/flexible', async (req, res) => {
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

            const aiProvider = String(body.aiProvider || 'active').toLowerCase();
            const analysisType = await resolveAnalysisType(body.analysisType, projectPath);
            const registry = await ensureRegistry(baseDir);

            if (analysisType === 'roadmap') {
                const userCredentials = await loadUserCredentials(req);
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
                    projectPath: result.projectPath,
                    roadmap: result.roadmap,
                    historyEntry: result.historyEntry
                });
            }

            if (analysisType === 'codebase') {
                const understandingMode = String(body.understandingMode || 'off').toLowerCase();
                const scanProfile = resolveScanProfile(body, 'dashboard');
                const scanContext = String(body.context || body.scanContext || body.scanMode || 'dashboard').toLowerCase();
                let report = await analyzeCodebase(projectPath, {
                    includeEslint: body.includeEslint === true || scanContext === 'complete',
                    scanProfile,
                    context: scanContext
                });
                if (understandingMode !== 'off') {
                    const registry = await ensureRegistry(baseDir);
                    const userCredentials = await loadUserCredentials(req);
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
                    projectPath,
                    report
                });
            }

            const modelId = resolveModelId(registry, aiProvider);
            const scanResult = await analyzeWithModel(baseDir, modelId, {
                scanPaths: resolveMockScanPaths(baseDir, projectPath),
                aiProvider,
                projectPath
            });

            let cloudSummary = null;
            const userCredentials = await loadUserCredentials(req);
            if (['openai', 'anthropic', 'ollama'].includes(aiProvider)
                && providerConfigured(aiProvider, registry, userCredentials)) {
                try {
                    const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials);
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
                    scanResult.report.inferenceMeta.cloudError = error.message;
                }
            }

            return sendAnalyzeJson(res, {
                success: true,
                analysisType: 'mock-scan',
                aiProvider,
                projectPath,
                cloudSummary,
                ...scanResult
            });
        } catch (error) {
            res.status(400).json({ success: false, error: toClientError(error, 'Analysis request failed') });
        }
    });

    app.get('/api/analyze/codebase', async (req, res) => {
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
            const scanProfile = resolveScanProfile(
                { scanProfile: req.query.scanProfile },
                'dashboard'
            );
            const scanContext = String(req.query.context || req.query.scanMode || 'dashboard').toLowerCase();
            const understandingMode = String(req.query.understandingMode || 'deterministic').toLowerCase();
            const startedAt = Date.now();
            logger.info(`[analyze] codebase start path=${projectPath} profile=${scanProfile} context=${scanContext}`);
            let report = await analyzeCodebase(projectPath, {
                includeEslint: req.query.eslint === '1' || req.query.includeEslint === 'true' || scanContext === 'complete',
                scanProfile,
                context: scanContext,
                maxDeepAnalyze: req.query.maxDeepAnalyze ? Number(req.query.maxDeepAnalyze) : undefined
            });
            logger.info(`[analyze] codebase done path=${projectPath} context=${scanContext} ms=${Date.now() - startedAt} analyzed=${report.summary?.codeFilesAnalyzed ?? '—'}/${report.summary?.codeFilesDiscovered ?? '—'}`);
            if (understandingMode !== 'off') {
                const registry = await ensureRegistry(baseDir);
                const userCredentials = await loadUserCredentials(req);
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
            return sendAnalyzeJson(res, { success: true, data: report, projectPath, scanProfile, scanContext, understandingMode });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Codebase analysis failed') });
        }
    });

    app.get('/api/analyze/inventory', async (req, res) => {
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
            const inventory = await countRepositoryInventory(projectPath, {
                profile: req.query.profile || 'explorer'
            });
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
            const userCredentials = await loadUserCredentials(req);

            let report;
            if (body.filePath && projectPath) {
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
            } else if (body.code) {
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

    app.post('/api/analyze/complete-audit-report', async (req, res) => {
        try {
            const body = req.body || {};
            const rawScan = body.completeScan || body.report;
            const { normalizeCompleteScanInput } = require('../lib/complete-scan-audit-report');
            const completeScan = normalizeCompleteScanInput(rawScan) || rawScan;
            if (!completeScan || typeof completeScan !== 'object') {
                return res.status(400).json({ success: false, error: 'completeScan payload is required' });
            }
            if (publicGateEnabled) {
                return rejectPaidDeliverable(res);
            }
            const aiProvider = String(body.aiProvider || 'demo').toLowerCase();
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials);
            const reportModulePath = require.resolve('../lib/complete-scan-audit-report');
            if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') {
                delete require.cache[reportModulePath];
            }
            const { buildCompleteAuditReport } = require('../lib/complete-scan-audit-report');

            const report = await buildCompleteAuditReport(completeScan, {
                client: body.client,
                company: body.company,
                assessor: body.assessor,
                aiProvider: providerOpts?.providerId || aiProvider,
                summarizeFn: providerOpts
                    ? async (providerId, payload, opts) => summarizeScanWithProvider(
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
                html: report.html
            });
        } catch (error) {
            logger.warn('[complete-audit-report] generation failed', { error: error.message });
            return res.status(400).json({ success: false, error: toClientError(error, 'Audit report generation failed') });
        }
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
                const { buildConsolidationConclusion } = require('../lib/file-merger-reduction-scanner');
                return res.json({
                    success: true,
                    aiProvider,
                    enhanced: true,
                    summary: buildConsolidationConclusion(report),
                    provider: 'Simplebeacon rules'
                });
            }

            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req);
            const payload = normalizeReportForSummary(report, body.reportType || report.type);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials);

            if (!providerOpts) {
                return res.json({
                    success: true,
                    enhanced: false,
                    aiProvider,
                    message: 'Filesystem scan only — select Ollama, OpenAI, or Anthropic for an AI narrative summary.'
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
                error: error.message,
                message: error.message
            });
        }
    });

    const { registerDataCleanupAnalyzeRoute } = require('../lib/data-cleanup-scan');
    registerDataCleanupAnalyzeRoute(app, {
        baseDir,
        monorepoRoot,
        sendJson: sendAnalyzeJson
    });

    if (shouldLogRuntimeInfo()) {
        logger.info('[Flexible Analyze API] Enabled at /api/analyze/flexible');
    }
}

function countIssuesByKind(issues, pattern) {
    return (issues || [])
        .filter((item) => pattern.test(String(item.type || '')))
        .reduce((sum, item) => sum + (item.count || 1), 0);
}

function issueBreakdownFromList(issues) {
    return {
        productionLeaks: countIssuesByKind(issues, /production leak/i),
        credentials: countIssuesByKind(issues, /credential/i),
        schema: countIssuesByKind(issues, /schema/i),
        fiction: countIssuesByKind(issues, /fiction|fictional|consistency|kpi/i)
    };
}

function normalizeReportForSummary(report, reportType = '') {
    const type = reportType || report.type || '';

    if (type === 'codebase-analyzer-report') {
        const summary = report.summary || {};
        return {
            reportKind: type,
            repositoryInventory: report.repositoryInventory || null,
            scanScope: report.scanScope || null,
            codebaseSummary: summary,
            analysisOverview: {
                repositoryFilesTotal: summary.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles,
                codeFilesAnalyzed: summary.codeFilesAnalyzed,
                dataQualityScore: summary.healthScore,
                issuesDetected: summary.findingsTotal,
                eslintErrors: summary.eslintErrors,
                eslintWarnings: summary.eslintWarnings
            },
            detectedIssues: (report.findings || []).slice(0, 12).map((item) => ({
                type: item.category || item.type,
                severity: item.severity,
                description: item.description
            }))
        };
    }

    if (type === 'file-merger-reduction-report') {
        return {
            reportKind: type,
            scanPaths: report.scanPaths || [],
            repositoryInventory: report.repositoryInventory || null,
            scanScope: report.scanScope || null,
            mergerSummary: {
                filesAnalyzed: report.summary?.filesAnalyzed,
                sampleDataFilesAnalyzed: report.summary?.sampleDataFilesAnalyzed ?? report.summary?.filesAnalyzed,
                jsonFilesAnalyzed: report.summary?.jsonFilesAnalyzed,
                repositoryFilesTotal: report.summary?.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles,
                repositoryFoldersTotal: report.summary?.repositoryFoldersTotal ?? report.repositoryInventory?.totalFolders,
                totalSizeLabel: report.summary?.totalSizeLabel,
                mergeCandidates: report.summary?.mergeCandidates,
                exactDuplicateGroups: report.summary?.exactDuplicateGroups,
                potentialSavingsLabel: report.summary?.potentialSavingsLabel,
                oversizedFiles: report.summary?.oversizedFiles
            },
            analysisOverview: {
                totalMockFiles: report.summary?.filesAnalyzed,
                dataQualityScore: null,
                issuesDetected: (report.summary?.mergeCandidates || 0)
                    + (report.summary?.reductionOpportunities || 0)
            },
            detectedIssues: [
                ...(report.mergeCandidates || []),
                ...(report.reductionOpportunities || [])
            ].slice(0, 8).map((item) => ({
                type: item.mergeType || item.type || 'consolidation',
                description: item.description || item.id
            }))
        };
    }

    if (type === 'data-cleanup-report') {
        const summary = report.summary || {};
        const inv = report.inventory || {};
        const exec = report.executiveSummary || {};
        return {
            reportKind: type,
            scanProfile: report.scanProfile || '',
            repositoryInventory: inv,
            dataCleanupSummary: {
                totalFindings: summary.totalFindings,
                reclaimableBytes: summary.reclaimableBytes,
                configFindings: summary.configFindings,
                dependencyFindings: summary.dependencyFindings,
                environmentFindings: summary.environmentFindings,
                dataPrivacyFindings: summary.dataPrivacyFindings,
                dataLineageFindings: summary.dataLineageFindings,
                dataAccessFindings: summary.dataAccessFindings,
                buildArtifactFindings: summary.buildArtifactFindings,
                unusedFileCandidates: summary.unusedFileCandidates
            },
            executiveSummary: {
                priorityActions: exec.priorityActions || [],
                workspace: exec.workspace || null,
                security: exec.security || null,
                data: exec.data || null
            },
            aggregation: report.aggregation || null,
            analysisOverview: {
                repositoryFilesTotal: inv.totalFiles,
                repositoryFoldersTotal: inv.totalDirectories,
                issuesDetected: summary.totalFindings
            },
            detectedIssues: (report.allFindings || []).slice(0, 12).map((item) => ({
                type: item.type,
                severity: item.severity,
                description: item.reason || item.path
            }))
        };
    }

    const rawIssues = report.rawIssues || report.detectedIssues || [];
    return {
        reportKind: type || report.type || 'simplebeacon-report',
        gatePass: report.gate?.pass,
        issueBreakdown: issueBreakdownFromList(rawIssues),
        analysisOverview: {
            totalMockFiles: report.mockSampleFiles ?? report.totalFiles ?? report.summary?.filesAnalyzed,
            repositoryFilesTotal: report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles,
            ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed
                ?? (report.filesAnalyzed !== report.repositoryFilesTotal ? report.filesAnalyzed : null)
                ?? Math.max(report.mockSampleFiles ?? 0, report.credentialScanned ?? 0),
            fictionJsonFilesScanned: report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned,
            fictionSampleFilesScanned: report.fictionSampleFilesScanned ?? report.scanScope?.fictionSampleFilesScanned,
            dataQualityScore: report.qualityScore,
            issuesDetected: report.issueCount ?? rawIssues.length,
            schemaFilesPassed: report.schemaPassed,
            schemaFilesChecked: report.schemaChecked
        },
        detectedIssues: rawIssues.slice(0, 12)
    };
}

function resolveOllamaSummaryProvider(registry, userCredentials = null) {
    const ollamaModel = userCredentials?.ollamaModel
        || process.env.OLLAMA_MODEL
        || registry?.models?.find((m) => m.id === registry.activeModelId && m.provider === 'ollama')?.ollamaModel
        || registry?.models?.find((m) => m.provider === 'ollama' && m.ollamaModel)?.ollamaModel
        || null;
    const baseUrl = userCredentials?.ollamaBaseUrl
        || registry?.ollamaBaseUrl
        || process.env.OLLAMA_BASE_URL
        || 'http://127.0.0.1:11434';
    if (!baseUrl) return null;
    return ollamaModel
        ? { providerId: 'ollama', ollamaModel }
        : { providerId: 'ollama' };
}

function resolveSummaryProvider(aiProvider, registry, userCredentials = null) {
    if (aiProvider === 'demo') return null;

    if (aiProvider === 'active') {
        const model = registry.models?.find((m) => m.id === registry.activeModelId);
        if (model?.provider === 'ollama' && model.ollamaModel) {
            return { providerId: 'ollama', ollamaModel: model.ollamaModel };
        }
        // Active registry model is often demo/GGUF — fall back to Settings/env Ollama for narrative.
        return resolveOllamaSummaryProvider(registry, userCredentials);
    }

    if (aiProvider === 'ollama') {
        return resolveOllamaSummaryProvider(registry, userCredentials);
    }

    return { providerId: aiProvider };
}

module.exports = {
    setupFlexibleAnalyzeAPI,
    resolveProjectPath,
    resolveAnalysisType,
    resolveMockScanPaths,
    buildRoadmapFromPath,
    normalizeReportForSummary,
    resolveSummaryProvider,
    analyzeCodebase
};
