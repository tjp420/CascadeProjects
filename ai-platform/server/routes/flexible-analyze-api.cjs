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
const execAsync = util.promisify(exec);
const multer = require('multer');
const tmp = require('tmp');
const rateLimit = require('express-rate-limit');
const unzipper = require('unzipper');
const { countRepositoryInventory } = require('../../packages/simplebeacon-cli/src/lib/repository-inventory');
const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
const { analyzeCodebase } = require('../lib/codebase-analyzer.cjs');
const { applyPublicGateToAnalyzeResponse } = require('../../packages/simplebeacon-cli/src/lib/report-sanitizer');
const { resolveScanProfile } = require('../lib/universal-language-config.cjs');
const { analyzeWithModel } = require('../services/model-inference-service.cjs');
const { ensureRegistry } = require('../services/local-model-service.cjs');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath,
    logResolvedAllowedRoots,
    formatAllowedRootsSummary
} = require('../lib/path-safety.cjs');
const { toClientError } = require('../lib/client-error.cjs');

function sanitizeHttpHeaderValue(value) {
    return String(value ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\t\x20-\x7e]/g, '')
        .slice(0, 4096);
}
const { logInferenceEvent } = require('../lib/ai-inference-audit-logger.cjs');
const { getUserAiCredentials } = require('../lib/user-ai-keys-store.cjs');
const {
    listAvailableProviders,
    providerConfigured,
    summarizeScanWithProvider
} = require('../services/cloud-inference-service.cjs');
const { analyzeStrategicInsights } = require('../lib/strategic-insights-engine.cjs');
const { evaluateComplianceChecklist } = require('../../packages/simplebeacon-cli/src/compliance-checklist');
const { runNpmAuditAsync } = require('../lib/npm-audit-runner.cjs');
const { scanFileMergerReduction } = require('../lib/file-merger-reduction-scanner.cjs');
const { generateCodeRoadmap } = require('../lib/code-roadmap-generator.cjs');
const { runDataCleanupScan } = require('../lib/data-cleanup-scan.cjs');
const { buildCompleteAuditModel } = require('../lib/complete-scan-audit-report.cjs');
const { sanitizeComplianceBundleExport } = require('../../packages/simplebeacon-cli/src/lib/compliance-export-sanitize');
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

// In-memory async scan jobs for /api/analyze/upload-directory polling
const scanJobs = new Map();
const SCAN_JOB_TTL_MS = 20 * 60 * 1000; // 20 minutes (covers CLI 15m + analyses timeout)
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of scanJobs) {
        if (now - job.createdAt > SCAN_JOB_TTL_MS) {
            if (job.status === 'scanning') {
                scanJobs.set(id, { ...job, status: 'error', error: 'Scan timed out after 20 minutes' });
            }
            try { fs.rmSync(job.tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
            scanJobs.delete(id);
        }
    }
}, 60 * 1000);
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
const { evaluateHumanOversightCompliance } = require('../lib/compliance-rules.cjs');

function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        Promise.resolve(promise).then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
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
    const trimmedPath = String(rawPath || '').trim();
    if (!trimmedPath) return null;
    if (/^https?:\/\//i.test(trimmedPath)) {
        throw new Error(
            'projectPath must be a local folder path, not a web URL. '
            + 'If you want to analyze a remote repository, use a git clone URL from GitHub, GitLab, Bitbucket, or Codeberg. '
            + `Received: ${trimmedPath.slice(0, 120)}`
        );
    }
    if (path.isAbsolute(trimmedPath)) return path.normalize(trimmedPath);
    return path.normalize(path.join(baseDir, trimmedPath));
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
    const knownTypes = [
        'roadmap', 'mock-scan', 'codebase', 'complete',
        'npm-audit', 'compliance', 'data-cleanup', 'data-quality',
        'cleanup-assistant', 'file-reduction', 'consolidation', 'eu-ai-act'
    ];
    if (knownTypes.includes(type)) return type;
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
    const GlobalContextManager = require('../../src/core/GlobalContextManager.cjs');
    const RoadmapDataAnalyzer = require('../../src/core/RoadmapDataAnalyzer.cjs');
    const { buildHistoryEntryFromRoadmap } = require('../lib/roadmap-history-metrics.cjs');

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
        const stripped = { ...payload };
        delete stripped.projectPath;
        if (stripped.data && typeof stripped.data === 'object') {
            delete stripped.data.projectPath;
            delete stripped.data.sourceProjectPath;
        }
        if (stripped.report && typeof stripped.report === 'object') {
            delete stripped.report.projectPath;
            delete stripped.report.sourceProjectPath;
        }
        const body = publicGateEnabled ? applyPublicGateToAnalyzeResponse(stripped) : stripped;
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
        const { authenticate, optionalAuthenticate } = require('../middleware/auth.cjs');
        app.use('/api/analyze/upload-directory', optionalAuthenticate);
        app.use('/api/analyze/progress', optionalAuthenticate);
        app.use('/api/analyze', (req, res, next) => {
            if (req.path === '/upload-directory' || req.path === '/progress') return next();
            return authenticate(req, res, next);
        });
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
                    { id: 'llm', label: 'AI-enhanced understanding', description: 'Adds AI narrative when a provider is configured' }
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
                defaultProjectPath: baseDir,
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

    async function fetchWebsiteToTemp(rawUrl) {
        const url = String(rawUrl || '').trim();
        if (!url) throw new Error('URL is required');
        const https = require('https');
        const http = require('http');
        const { URL } = require('url');
        const parsed = new URL(url);

        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sb-web-'));
        const domain = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_');
        const fetchDir = path.join(tempDir, domain);
        await fs.promises.mkdir(fetchDir, { recursive: true });

        const indexPath = path.join(fetchDir, 'index.html');
        await new Promise((resolve, reject) => {
            const client = parsed.protocol === 'https:' ? https : http;
            const request = client.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    const redirectUrl = response.headers.location.startsWith('http')
                        ? response.headers.location
                        : new URL(response.headers.location, url).href;
                    return fetchWebsiteToTemp(redirectUrl).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                const stream = fs.createWriteStream(indexPath);
                response.pipe(stream);
                stream.on('finish', () => resolve(fetchDir));
                stream.on('error', reject);
            });
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });

        // Extract and fetch linked CSS/JS assets
        try {
            const html = await fs.promises.readFile(indexPath, 'utf8');
            const assetMatches = html.matchAll(/(href|src)="([^"]+\.(css|js))"/gi);
            const seen = new Set();
            for (const match of assetMatches) {
                const asset = match[2];
                if (seen.has(asset)) continue;
                seen.add(asset);
                if (asset.startsWith('data:') || asset.startsWith('//')) continue;
                let assetUrl;
                try {
                    assetUrl = new URL(asset, url).href;
                } catch {
                    continue;
                }
                const assetFile = path.basename(asset.replace(/[?#].*$/, ''));
                if (!assetFile) continue;
                const outPath = path.join(fetchDir, assetFile);
                try {
                    const client2 = new URL(assetUrl).protocol === 'https:' ? https : http;
                    await new Promise((res2) => {
                        const req2 = client2.get(assetUrl, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp2) => {
                            if (resp2.statusCode !== 200) return res2();
                            const s2 = fs.createWriteStream(outPath);
                            resp2.pipe(s2);
                            s2.on('finish', res2);
                            s2.on('error', () => res2());
                        });
                        req2.on('error', () => res2());
                        req2.on('timeout', () => { req2.destroy(); res2(); });
                    });
                } catch {
                    // ignore asset fetch failures
                }
            }
        } catch {
            // ignore parse failures
        }

        return fetchDir;
    }

    async function cleanupWebsiteTemp(tempDir) {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // ignore cleanup failures
        }
    }

    app.post('/api/analyze/flexible', async (req, res) => {
        let tempFetchDir = null;
        try {
            const body = req.body || {};
            const rawPath = String(body.projectPath || body.path || '').trim();
            let projectPath;
            let isWebsite = false;

            // Detect website URL
            if (/^https?:\/\//i.test(rawPath)) {
                isWebsite = true;
                try {
                    tempFetchDir = await fetchWebsiteToTemp(rawPath);
                    projectPath = tempFetchDir;
                } catch (error) {
                    return res.status(400).json({ success: false, error: toClientError(error, 'Failed to fetch website') });
                }
            } else {
                try {
                    projectPath = resolveSafeProjectPath(rawPath);
                } catch (error) {
                    return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
                }
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }

            const aiProvider = String(body.aiProvider || 'active').toLowerCase();
            const analysisType = isWebsite ? 'mock-scan' : await resolveAnalysisType(body.analysisType, projectPath);
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
                    scanResult.report.inferenceMeta.cloudError = error.message;
                }
            }

            return sendAnalyzeJson(res, {
                success: true,
                analysisType: 'mock-scan',
                aiProvider,
                cloudSummary,
                ...scanResult
            });
        } catch (error) {
            res.status(400).json({ success: false, error: toClientError(error, 'Analysis request failed') });
        } finally {
            if (tempFetchDir) {
                await cleanupWebsiteTemp(tempFetchDir);
            }
        }
    });

    // ── Directory Upload Analysis ──

    const uploadMulter = multer({
        dest: path.join(os.tmpdir(), 'sb-uploads'),
        limits: { files: 100000, fileSize: 5 * 1024 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }
    });

    function sanitizeUploadPath(rawPath) {
        return String(rawPath || '')
            .replace(/^[/\\]+/, '')
            .replace(/\.\.[/\\]/g, '')
            .replace(/[^a-zA-Z0-9_\-./\\]/g, '_');
    }

    /**
     * Sanitize scan report JSON before sending to AI analyst APIs.
     * Strips local system paths, email addresses, and user-identifying metadata
     * to enforce zero-retention privacy (Pillar 3 of privacy architecture).
     */
    function sanitizeReportForAi(report) {
        if (!report || typeof report !== 'object') return report;
        const clone = JSON.parse(JSON.stringify(report));
        const pathRegex = /[A-Z]:\\Users\\[^\\]+|\\home\\[^/]+|C:\\\\Users\\\\[^\\\\]+/gi;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        function scrub(obj) {
            if (typeof obj === 'string') {
                return obj
                    .replace(pathRegex, '<local-path-redacted>')
                    .replace(emailRegex, '<email-redacted>');
            }
            if (Array.isArray(obj)) {
                return obj.map(scrub);
            }
            if (obj && typeof obj === 'object') {
                const out = {};
                for (const key of Object.keys(obj)) {
                    if (['projectRoot', 'scanTargetRoot', 'configPath'].includes(key)) {
                        out[key] = '<path-redacted>';
                    } else {
                        out[key] = scrub(obj[key]);
                    }
                }
                return out;
            }
            return obj;
        }
        return scrub(clone);
    }

    async function validateLicenseToken(token) {
        const { readStore } = require('../../server/lib/simplebeacon-subscription-store.cjs');
        const { verifyLicenseToken } = require('../../packages/simplebeacon-cli/src/lib/license-token.js');
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
            try { filePaths = JSON.parse(req.body?.filePaths || '[]'); } catch (e) { filePaths = []; }
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
                        logger.warn(`[Upload Directory] ZIP cleanup skipped: ${cleanupErr.message}`);
                    }
                } catch (zipErr) {
                    logger.warn(`[Upload Directory] ZIP extraction failed: ${zipErr.message}. Proceeding with raw upload.`);
                }
            }

            // Write a temp config so the CLI scans everything in the uploaded directory,
            // instead of inheriting ai-platform's default scanPaths (web/data, tests/fixtures, data)
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
                        '**/cp*.json', '**/euc*.json', '**/gbk*.json',
                        '**/shiftjis.json', '**/big5*.json', '**/encoding*.json',
                        '**/codes.json', '**/dbcs*.js', '**/dbcs*.json'
                    ],
                    fullDirectoryScanSkipDirs: [
                        '.git', 'node_modules', 'coverage', 'dist', 'build',
                        '.simplebeacon', 'tmp', '.github', '.github-sync',
                        'backups', 'deployments', 'logs', 'ai-agent', 'ai-tools',
                        'simplebeacon-rule-tests', 'simplebeacon-frameworkless',
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
                const scanTimeoutMs = 18 * 60 * 1000; // 18 min hard cap for entire scan + analyses
                const scanTimer = setTimeout(() => {
                    const job = scanJobs.get(scanId);
                    if (job && job.status === 'scanning') {
                        logger.error(`[Upload Directory] Scan ${scanId} timed out after ${scanTimeoutMs}ms`);
                        scanJobs.set(scanId, { ...job, status: 'error', error: `Scan timed out after ${scanTimeoutMs / 1000}s` });
                    }
                }, scanTimeoutMs);
                let report = null;
                let cliFailed = false;
                try {
                    const cliPath = path.join(baseDir, 'packages/simplebeacon-cli/bin/simplebeacon.js');
                    const cmd = `node "${cliPath}" scan --path "${projectDir}" --config "${tempConfigPath}" --format json --gate --offline --fullDirectoryScan`;
                    logger.info(`[Upload Directory] Running CLI scan for ${scanId}...`);
                    const { stdout } = await execAsync(cmd, {
                        cwd: baseDir,
                        maxBuffer: 1024 * 1024 * 1024,
                        timeout: 900000
                    });
                    logger.info(`[Upload Directory] CLI scan completed for ${scanId} in ${(Date.now() - scanStart) / 1000}s`);
                    try {
                        report = JSON.parse(stdout);
                    } catch (parseErr) {
                        logger.error('[Upload Directory] Failed to parse scan output:', parseErr.message);
                        scanJobs.set(scanId, { ...scanJobs.get(scanId), status: 'error', error: 'Scan completed but output parsing failed' });
                        return;
                    }
                } catch (err) {
                    cliFailed = true;
                    logger.warn(`[Upload Directory] CLI scan exited non-zero for ${scanId}:`, err.message);
                    if (err.stdout) {
                        try {
                            report = JSON.parse(err.stdout);
                            logger.info(`[Upload Directory] Parsed gate-fail report for ${scanId}, issues=${report.issueCount || report.gate?.blockingCount || 'n/a'}`);
                        } catch (parseErr) {
                            logger.error('[Upload Directory] Failed to parse gate-fail output:', parseErr.message);
                        }
                    }
                    if (!report) {
                        scanJobs.set(scanId, { ...scanJobs.get(scanId), status: 'error', error: err.message || 'Analysis failed' });
                        return;
                    }
                }

                // Run additional analyses based on selected analysis type (regardless of gate pass/fail)
                const results = { simplebeacon: report };
                const runComplete = analysisType === 'complete';
                // Tier-aware limits: $19 instant tier does not get executive-tier analyzers
                const instantTierLimited = licenseTier === 'instant';
                const tierAllowed = (analyzer) => !instantTierLimited || ['simplebeacon', 'mock-scan', 'codebase'].includes(analyzer);
                const ANALYZER_TIMEOUT = 600000; // 10 min per analyzer (codebase can be slow)
                const ANALYZER_TIMEOUT_FAST = 60000; // 1 min for lightweight analyzers
                const runAnalyzer = async (label, fn, timeoutMs = ANALYZER_TIMEOUT) => {
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
                    results.codebase = await runAnalyzer('codebase', () => analyzeCodebase(projectDir, { context: 'dashboard', scanProfile: 'default' }));
                }
                if ((analysisType === 'npm-audit' || runComplete) && tierAllowed('npm-audit')) {
                    results.npmAudit = await runAnalyzer('npm-audit', () => runNpmAuditAsync(projectDir, { force: false }));
                }
                if ((analysisType === 'compliance' || runComplete) && tierAllowed('compliance')) {
                    results.compliance = await runAnalyzer('compliance', () => Promise.resolve(evaluateComplianceChecklist(report)));
                }
                if (analysisType === 'data-cleanup' && tierAllowed('data-cleanup')) {
                    results.dataCleanup = await runAnalyzer('data-cleanup', () => runDataCleanupScan(projectDir, { profile: 'all' }));
                }
                if ((analysisType === 'file-reduction' || runComplete) && tierAllowed('file-reduction')) {
                    results.fileReduction = await runAnalyzer('file-reduction', () => scanFileMergerReduction(projectDir, { includeRepositoryInventory: true }));
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

                // Override temp directory path with original project name from upload
                const originalDirName = (filePaths[0] && String(filePaths[0]).includes('/'))
                    ? String(filePaths[0]).split('/')[0]
                    : (filePaths[0] && String(filePaths[0]).includes('\\'))
                        ? String(filePaths[0]).split('\\')[0]
                        : (req.body?.projectName || 'project');
                if (reportJson && typeof reportJson === 'object') {
                    if (reportJson.projectRoot) reportJson.projectRoot = originalDirName;
                    if (reportJson.projectPath) reportJson.projectPath = originalDirName;
                    if (reportJson.scanTargetRoot) reportJson.scanTargetRoot = originalDirName;
                }

                clearTimeout(scanTimer);
                logger.info(`[Upload Directory] Scan ${scanId} completed successfully in ${(Date.now() - scanStart) / 1000}s`);
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
                        logger.warn('[Upload Directory] AI Analyst autopilot error:', aiErr.message);
                    }
                })();

                // --- EU AI Act Article 14 Human Oversight Evaluator (fire-and-forget) ---
                (async () => {
                    try {
                        const euCompliance = await evaluateHumanOversightCompliance(report, { projectPath: projectDir });
                        const jobMeta = scanJobs.get(scanId) || {};
                        scanJobs.set(scanId, { ...jobMeta, euCompliance });
                    } catch (euErr) {
                        logger.warn('[Upload Directory] EU Article 14 evaluator error:', euErr.message);
                    }
                })();
            })();

            res.json({ success: true, scanId });
        } catch (err) {
            logger.error('[Upload Directory] Error:', err.message);
            res.status(500).json({ success: false, error: err.message || 'Analysis failed' });
            // Clean up on immediate error — Privacy Guard: zero data retention
            try {
                if (projectDir && fs.existsSync(projectDir)) {
                    fs.rmSync(projectDir, { recursive: true, force: true });
                    logger.info('[Privacy Guard] Purged repository assets from server memory:', projectDir);
                }
                for (const file of multerFiles) {
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
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
            return sendAnalyzeJson(res, { success: true, data: report, scanProfile, scanContext, understandingMode });
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
        try {
            const body = req.body || {};
            const {
                normalizeCompleteScanInput,
                completeScanHasExportableResults
            } = require('../lib/complete-scan-audit-report.cjs');
            const rawScan = body.completeScan || body.report;
            const completeScan = normalizeCompleteScanInput(rawScan) || rawScan;
            if (!completeScan || typeof completeScan !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'completeScan payload is required — run Complete scan first, then export ZIP.'
                });
            }
            if (!completeScanHasExportableResults(completeScan)) {
                return res.status(400).json({
                    success: false,
                    error: 'Export bundle requires at least one completed scan step with results.'
                });
            }

            const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true'
                || body.internalDashboard === true;

            const { buildAnalyzeExportZipStream } = require('../lib/analyze-export-bundle.cjs');
            let zipResult;
            try {
                zipResult = await buildAnalyzeExportZipStream(completeScan, {
                    deliverableSku: body.deliverableSku,
                    internalDashboard,
                    publicGateLocked: publicGateEnabled && !internalDashboard,
                    hasAuditDeliverableAccess: !publicGateEnabled && !closedVaultMode,
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
                    baseDir
                });
            } catch (error) {
                if (error.code === 'export_paywall') {
                    return res.status(402).json({
                        success: false,
                        error: error.message,
                        checkoutUrl: auditCheckoutUrl
                    });
                }
                if (error.code === 'export_empty' || error.code === 'tier_scan_mismatch') {
                    return res.status(422).json({
                        success: false,
                        error: error.message,
                        warnings: error.warnings || []
                    });
                }
                throw error;
            }
            res.set('Cache-Control', 'no-store');
            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', `attachment; filename="${zipResult.filename}"`);
            res.set('X-Simplebeacon-Export-Tier', zipResult.tierId || '');
            if (zipResult.warnings?.length) {
                res.set('X-Simplebeacon-Export-Warnings', sanitizeHttpHeaderValue(zipResult.warnings.join('|')));
            }
            zipResult.stream.pipe(res);
        } catch (error) {
            logger.warn('[export-bundle] generation failed', { error: error.message });
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
                    publicGateLocked: publicGateEnabled,
                    hasAuditDeliverableAccess: !publicGateEnabled && !closedVaultMode,
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
            logger.warn('[certificate-export] failed', { error: error.message });
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
            if (publicGateEnabled) {
                return rejectPaidDeliverable(res);
            }
            const aiProvider = String(body.aiProvider || 'demo').toLowerCase();
            const registry = await ensureRegistry(baseDir);
            const userCredentials = await loadUserCredentials(req);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials);
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
            logger.warn('[complete-audit-report] generation failed', { error: error.message });
            return res.status(400).json({ success: false, error: toClientError(error, 'Audit report generation failed') });
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
            const userCredentials = await loadUserCredentials(req);
            const payload = normalizeReportForSummary(report, body.reportType || report.type);
            const providerOpts = resolveSummaryProvider(aiProvider, registry, userCredentials);

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
                error: error.message,
                message: error.message
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
                    return res.status(400).json({ success: false, error: err.message });
                }
            }

            const resolvedRoot = projectPath || report.projectRoot || baseDir;
            let npmAudit = body.npmAudit || null;
            if (!npmAudit) {
                try {
                    npmAudit = await runNpmAuditAsync(resolvedRoot, { force: body.forceNpmAudit === true });
                } catch {
                    npmAudit = null;
                }
            }

            const complianceChecklist = evaluateComplianceChecklist(report, {
                projectRoot: resolvedRoot,
                npmAudit,
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
                npmAuditSource: npmAudit?.dataSource || npmAudit?.source || null
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: toClientError(error, 'Compliance checklist failed')
            });
        }
    });

    app.get('/api/analyze/npm-audit', async (req, res) => {
        try {
            let projectPath = baseDir;
            if (req.query.projectPath || req.query.path) {
                try {
                    projectPath = resolveSafeProjectPath(req.query.projectPath || req.query.path);
                } catch (err) {
                    return res.status(400).json({ success: false, error: err.message });
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
            });
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
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { success: false, error: 'Too many upload requests. Please try again in 15 minutes.' },
        standardHeaders: true,
        legacyHeaders: false
    });
    const uploadDirMulter = multer({
        storage: multer.memoryStorage(),
        limits: { files: 100000, fileSize: 5 * 1024 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 },
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
            try { filePaths2 = JSON.parse(req.body?.filePaths || '[]'); } catch (e) { filePaths2 = []; }
            for (let i = 0; i < req.files.length; i++) {
                const relPath = filePaths2[i] || req.files[i].originalname || req.files[i].fieldname;
                const outPath = path.join(tmpDir, relPath);
                fs.mkdirSync(path.dirname(outPath), { recursive: true });
                fs.writeFileSync(outPath, req.files[i].buffer);
            }

            // If a single ZIP file was uploaded, stream-extract it to get all files past browser webkitdirectory limits
            if (req.files.length === 1 && req.files[0].originalname.toLowerCase().endsWith('.zip')) {
                const zipRel = filePaths2[0] || req.files[0].originalname || req.files[0].fieldname;
                const zipPath = path.join(tmpDir, zipRel);
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
                        logger.warn(`[Upload Directory] ZIP cleanup skipped: ${cleanupErr.message}`);
                    }
                } catch (zipErr) {
                    logger.warn(`[Upload Directory] ZIP extraction failed: ${zipErr.message}. Proceeding with raw upload.`);
                }
            }

            logger.info(`[Upload Directory] Received ${req.files.length} files, wrote to ${tmpDir}`);

            // Run Simplebeacon scan on the temp directory (always run as baseline)
            const cliBin = path.join(baseDir, 'packages/simplebeacon-cli/bin/simplebeacon.js');
            const reportOut = path.join(tmpDir, '.simplebeacon', 'report.json'); // simplebeacon:production-leak-intent: scan-output - Defines temp scan report output path
            fs.mkdirSync(path.dirname(reportOut), { recursive: true });

            // simplebeacon:production-leak-intent: config-comment - Explains temp scan config override behavior
            // Write a temp config so scanPaths points to the root, not default web/data
            const tempConfigPath = path.join(tmpDir, '.simplebeacon', 'config.json');
            fs.writeFileSync(tempConfigPath, JSON.stringify({
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
                    '**/cp*.json', '**/euc*.json', '**/gbk*.json',
                    '**/shiftjis.json', '**/big5*.json', '**/encoding*.json',
                    '**/codes.json', '**/dbcs*.js', '**/dbcs*.json'
                ],
                fullDirectoryScanSkipDirs: ['.git', 'node_modules', 'coverage', 'dist', 'build', '.simplebeacon', 'tmp']
            }, null, 2));

            const scanCmd = `node "${cliBin}" scan --path "${tmpDir}" --config "${tempConfigPath}" --format json --output "${reportOut}" --offline --full`;
            let stdout = '';
            let stderr = '';
            try {
                const result = await execAsync(scanCmd, { cwd: baseDir, timeout: 300000, env: { ...process.env, FORCE_COLOR: '0' } });
                stdout = result.stdout || '';
                stderr = result.stderr || '';
            } catch (err) {
                stdout = err.stdout || '';
                stderr = err.stderr || '';
                if (!fs.existsSync(reportOut)) {
                    throw err;
                }
            }

            const report = JSON.parse(fs.readFileSync(reportOut, 'utf8'));
            logger.info(`[Upload Directory] Scan found: totalFiles=${report.totalFiles || report.repositoryFilesTotal || 'n/a'}, scanned=${report.ruleScopedFilesAnalyzed || 'n/a'}, issues=${report.issueCount || report.gate?.blockingCount || 'n/a'}`);
            const results = { simplebeacon: report };

            // Run additional analyses based on selected analysis type
            const runComplete = analysisType === 'complete';
            const ANALYZER_TIMEOUT = 600000; // 10 min per analyzer
            const runAnalyzer = async (label, fn, timeoutMs = ANALYZER_TIMEOUT) => {
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
                results.codebase = await runAnalyzer('codebase', () => analyzeCodebase(tmpDir, { context: 'dashboard', scanProfile: 'default' }));
            }
            if (analysisType === 'npm-audit' || runComplete) {
                results.npmAudit = await runAnalyzer('npm-audit', () => runNpmAuditAsync(tmpDir, { force: false }));
            }
            if (analysisType === 'compliance' || runComplete) {
                results.compliance = await runAnalyzer('compliance', () => Promise.resolve(evaluateComplianceChecklist(report)));
            }
            if (analysisType === 'data-cleanup') {
                results.dataCleanup = await runAnalyzer('data-cleanup', () => runDataCleanupScan(tmpDir, { profile: 'all' }));
            }
            if (analysisType === 'file-reduction' || runComplete) {
                results.fileReduction = await runAnalyzer('file-reduction', () => scanFileMergerReduction(tmpDir, { includeRepositoryInventory: true }));
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

            // Override temp directory path with original project name from upload
            const originalDirName2 = (filePaths2[0] && String(filePaths2[0]).includes('/'))
                ? String(filePaths2[0]).split('/')[0]
                : (filePaths2[0] && String(filePaths2[0]).includes('\\'))
                    ? String(filePaths2[0]).split('\\')[0]
                    : (req.body?.projectName || 'project');
            if (reportJson && typeof reportJson === 'object') {
                if (reportJson.projectRoot) reportJson.projectRoot = originalDirName2;
                if (reportJson.projectPath) reportJson.projectPath = originalDirName2;
                if (reportJson.scanTargetRoot) reportJson.scanTargetRoot = originalDirName2;
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
            logger.error('[Upload Directory] Scan failed:', error.message);
            res.status(500).json({ success: false, error: toClientError(error, 'scan failed') });
        } finally {
            // Clean up temp directory after a short delay
            setTimeout(() => {
                try {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                } catch (e) {
                    logger.warn('[Upload Directory] Cleanup failed:', e.message);
                }
            }, 5000);
        }
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
