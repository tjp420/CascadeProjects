/**
 * Shared utility functions for the flexible analyze API and related analyzers.
 * Extracted from flexible-analyze-api.cjs to reduce hub-file coupling.
 */

const path = require('path');
const fs = require('fs');

/**
 * Sanitize http header value.
 * @param {any} value
 * @returns {string}
 */
function sanitizeHttpHeaderValue(value) {
    return String(value ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\t\x20-\x7e]/g, '')
        .slice(0, 4096);
}

/**
 * Check whether runtime debug logging is enabled via environment variables.
 * @returns {boolean}
 */
function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

/**
 * Wrap a promise so it rejects if it does not settle within `ms` milliseconds.
 * @param {Promise<T>} promise
 * @param {number} ms Timeout in milliseconds.
 * @param {string} label Human-readable label for the timeout error message.
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms, label) {
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 30000;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        Promise.resolve(promise).then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

/**
 * Safe basename — path.basename throws on null bytes.
 * @param {string} p
 * @param {string} [fallback='']
 * @returns {string}
 */
function safeBasename(p, fallback = '') {
    if (typeof p !== 'string') return fallback;
    try {
        return path.basename(p) || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Coerce an array-ish value into a clean array of non-empty trimmed strings.
 * @param {any} value
 * @returns {string[]}
 */
function normalizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

/**
 * Resolve a user-provided path against allowed base directories.
 * Rejects HTTP/HTTPS URLs. Falls back to monorepo root when the path is not found under baseDir.
 * @param {string} baseDir Primary allowed root.
 * @param {string} rawPath Raw path string from the request body.
 * @param {string} [monorepoRoot] Optional monorepo root for secondary lookup.
 * @returns {string|null} Resolved absolute path, or null if input is empty.
 */
function resolveProjectPath(baseDir, rawPath, monorepoRoot) {
    if (baseDir == null || typeof baseDir !== 'string') {
        throw new TypeError('baseDir must be a non-empty string');
    }
    const trimmedPath = String(rawPath || '').trim();
    if (!trimmedPath) return null;
    if (/^https?:\/\//i.test(trimmedPath) || /^file:\/\//i.test(trimmedPath)) {
        throw new Error(
            'projectPath must be a local folder path, not a URL. '
            + 'If you want to analyze a remote repository, use a git clone URL from GitHub, GitLab, Bitbucket, or Codeberg. '
            + `Received: ${trimmedPath.slice(0, 120)}`
        );
    }
    if (path.isAbsolute(trimmedPath)) {
        const normalized = path.normalize(trimmedPath);
        // Render deployment fallback: the dashboard may cache a stale path like
        // /opt/render/project/src/ai-platform/CascadeProjects. If the absolute path
        // does not exist and contains ai-platform, fall back to the server's actual
        // platform directory or monorepo root.
        if (!fs.existsSync(normalized)) {
            const normalizedKey = normalized.replace(/\\/g, '/').toLowerCase();
            if (normalizedKey.includes('/ai-platform')) {
                const serverPlatformKey = baseDir.replace(/\\/g, '/').toLowerCase();
                if (serverPlatformKey.includes('/ai-platform')) {
                    if (normalizedKey.endsWith('/ai-platform')) {
                        // The platform directory itself was requested; use the server's platform dir.
                        return baseDir;
                    }
                    const effectiveMonoRoot = monorepoRoot || path.join(baseDir, '..');
                    const repoName = path.basename(effectiveMonoRoot).toLowerCase();
                    if (repoName && normalizedKey.endsWith('/ai-platform/' + repoName)) {
                        // The monorepo root was requested via the stale path; use the server's monorepo root.
                        return effectiveMonoRoot;
                    }
                }
            }
        }
        return normalized;
    }
    const fromBase = path.normalize(path.join(baseDir, trimmedPath));
    if (fs.existsSync(fromBase)) return fromBase;
    if (monorepoRoot) {
        const fromMono = path.normalize(path.join(monorepoRoot, trimmedPath));
        if (fs.existsSync(fromMono)) return fromMono;
    }

    // Render deployment fallback: the dashboard may cache a stale path like
    // /opt/render/project/src/ai-platform/CascadeProjects. If the resolved path
    // does not exist and we are inside a Render-style monorepo checkout, fall back
    // to the monorepo root so the scan can still run against the actual project.
    if (!fs.existsSync(fromBase) && monorepoRoot && fromBase.startsWith(monorepoRoot)) {
        const platformDir = path.join(monorepoRoot, 'ai-platform');
        if (fs.existsSync(platformDir)) {
            return monorepoRoot;
        }
    }

    return fromBase;
}

/**
 * Compare two paths for equality after normalizing separators and case.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSameResolvedPath(a, b) {
    return path.resolve(a).replace(/\\/g, '/').toLowerCase()
        === path.resolve(b).replace(/\\/g, '/').toLowerCase();
}

/**
 * Derive severity counts from an array of findings so the flat response stays consistent.
 * @param {Array<Object>} findings
 * @returns {{critical:number, high:number, medium:number, low:number, info:number}}
 */
function deriveSeverityCounts(findings) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    if (!Array.isArray(findings)) return counts;
    for (const issue of findings) {
        const band = String(issue.severity || issue.severityBand || 'low').toLowerCase();
        const increment = typeof issue.count === 'number' && issue.count > 0 ? issue.count : 1;
        if (counts[band] !== undefined) counts[band] += increment;
    }
    return counts;
}

/**
 * Pick the active model ID from the registry based on the chosen AI provider.
 * @param {Object} registry Model registry object.
 * @param {string} aiProvider Provider identifier (e.g. 'active', 'ollama', 'demo').
 * @returns {string}
 */
function resolveModelId(registry, aiProvider) {
    if (!registry || typeof registry !== 'object') {
        throw new TypeError('registry must be a valid object');
    }
    const provider = String(aiProvider || 'active').toLowerCase();
    if (provider === 'demo') {
        return registry.models?.find((m) => m.provider === 'demo')?.id || registry.activeModelId;
    }
    if (provider === 'active') {
        return registry.activeModelId;
    }
    if (provider === 'ollama') {
        return registry.models?.find((m) => m.provider === 'ollama')?.id || registry.activeModelId;
    }
    return registry.activeModelId;
}

/**
 * Count issues whose type matches a RegExp pattern.
 * @param {Array<Object>} issues
 * @param {RegExp} pattern
 * @returns {number}
 */
function countIssuesByKind(issues, pattern) {
    if (!Array.isArray(issues)) return 0;
    if (!(pattern instanceof RegExp)) return 0;
    return issues
        .filter((item) => pattern.test(String(item.type || '')))
        .reduce((sum, item) => sum + (item.count || 1), 0);
}

/**
 * Build a breakdown of issue categories from a raw issue list.
 * @param {Array<Object>} issues
 * @returns {{productionLeaks:number, credentials:number, schema:number, fiction:number}}
 */
function issueBreakdownFromList(issues) {
    return {
        productionLeaks: countIssuesByKind(issues, /production leak/i),
        credentials: countIssuesByKind(issues, /credential/i),
        schema: countIssuesByKind(issues, /schema/i),
        fiction: countIssuesByKind(issues, /fiction|fictional|consistency|kpi/i)
    };
}

/**
 * Normalize a scan report into a consistent summary shape for AI provider consumption.
 * @param {Object} report
 * @param {string} [reportType='']
 * @returns {Object}
 */
function normalizeReportForSummary(report, reportType = '') {
    if (!report || typeof report !== 'object') return { reportKind: reportType || 'simplebeacon-report', detectedIssues: [] };
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

    const rawIssues = Array.isArray(report.rawIssues) ? report.rawIssues
        : Array.isArray(report.detectedIssues) ? report.detectedIssues
        : [];
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

/**
 * Safe String() conversion with fallback for unstringable values.
 * @param {any} value
 * @returns {string}
 */
function safeString(value) {
    try { return String(value); } catch { return '[unstringable error]'; }
}

/**
 * Extract message from Error or coerce to string.
 * @param {any} err
 * @returns {string}
 */
function safeErrorMessage(err) {
    if (err && typeof err.message === 'string') return err.message;
    return safeString(err);
}

/**
 * Recursively count files in a directory (for progress tracking).
 * @param {string} dirPath
 * @param {number} [max=100000]
 * @param {number} [maxDepth=32]
 * @returns {number}
 */
async function countFiles(dirPath, max = 100_000, maxDepth = 32) {
    if (typeof dirPath !== 'string') return 0;
    let count = 0;
    const queue = [{ dir: dirPath, depth: 0 }];
    const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache']);
    while (queue.length && count < max) {
        const { dir: cur, depth } = queue.pop();
        if (depth >= maxDepth) continue;
        try {
            const entries = await fs.promises.readdir(cur, { withFileTypes: true });
            for (const ent of entries) {
                if (ent.isDirectory()) {
                    if (!skip.has(ent.name)) queue.push({ dir: path.join(cur, ent.name), depth: depth + 1 });
                } else {
                    count++;
                }
            }
        } catch { /* ignore permission errors */ }
    }
    return Math.min(count, max);
}

/**
 * Sanitize an upload path segment: strip leading slashes, collapse traversal, and replace unsafe chars.
 * @param {string} rawPath
 * @returns {string}
 */
function sanitizeUploadPath(rawPath) {
    let sanitized = String(rawPath || '')
        .replace(/^[/\\]+/, '')
        .replace(/\.\.(?:[/\\]|$)/g, '')
        .replace(/[^a-zA-Z0-9_\-./\\]/g, '_');
    while (sanitized.includes('..')) {
        sanitized = sanitized.replace(/\.\./g, '');
    }
    const normalized = path.normalize(sanitized);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
        return '_unsafe_path_';
    }
    return normalized;
}

/**
 * Sanitize scan report JSON before sending to AI analyst APIs.
 * Strips local system paths, email addresses, and user-identifying metadata.
 * @param {any} report
 * @returns {any}
 */
function sanitizeReportForAi(report) {
    if (!report || typeof report !== 'object') return report;
    let clone;
    try {
        clone = JSON.parse(JSON.stringify(report));
    } catch {
        clone = report;
    }
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

// ── Response Builders ─────────────────────────────────────────

/**
 * Send a JSON response, stripping local paths for privacy.
 * @param {import('express').Response} res
 * @param {Object} payload
 * @param {number} [statusCode=200]
 * @param {Object} [opts]
 * @param {boolean} [opts.publicGateEnabled=false]
 * @param {Function} [opts.applyPublicGateToAnalyzeResponse]
 * @returns {import('express').Response}
 */
function sendAnalyzeJson(res, payload, statusCode = 200, opts = {}) {
    if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
        throw new TypeError('sendAnalyzeJson requires a valid Express response object');
    }
    const code = Number.isFinite(statusCode) && statusCode >= 100 && statusCode < 600 ? Math.floor(statusCode) : 200;
    let stripped;
    try {
        stripped = JSON.parse(JSON.stringify(payload));
    } catch {
        stripped = payload;
    }
    delete stripped.projectPath;
    if (stripped.data && typeof stripped.data === 'object') {
        delete stripped.data.projectPath;
        delete stripped.data.sourceProjectPath;
    }
    if (stripped.report && typeof stripped.report === 'object') {
        delete stripped.report.projectPath;
        delete stripped.report.sourceProjectPath;
    }
    const body = opts.publicGateEnabled && typeof opts.applyPublicGateToAnalyzeResponse === 'function'
        ? opts.applyPublicGateToAnalyzeResponse(stripped)
        : stripped;
    return res.status(code).json(body);
}

/**
 * Return a 402 Payment Required response for gated deliverables.
 * @param {import('express').Response} res
 * @param {string} [auditCheckoutUrl]
 * @returns {import('express').Response}
 */
function rejectPaidDeliverable(res, auditCheckoutUrl) {
    if (!res || typeof res.status !== 'function') {
        throw new TypeError('rejectPaidDeliverable requires a valid Express response object');
    }
    return res.status(402).json({
        success: false,
        publicGateLocked: true,
        error: 'Pre-Launch Audit PDF is a paid deliverable ($499). Unlock the full remediation log and executive PDF.',
        checkoutUrl: auditCheckoutUrl || 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report',
        auditPriceLabel: '$499'
    });
}

/**
 * Build a standardized success response object.
 * @param {Object} data
 * @param {Object} [meta]
 * @returns {Object}
 */
function buildSuccessResponse(data, meta) {
    const result = { success: true };
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.assign(result, data);
    }
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        Object.assign(result, meta);
    }
    return result;
}

/**
 * Build a standardized error response object.
 * @param {string|Error} error
 * @param {string} [context]
 * @returns {Object}
 */
function buildErrorResponse(error, context) {
    const message = error && typeof error.message === 'string' ? error.message : safeString(error);
    const result = { success: false, error: message };
    if (context) result.context = context;
    return result;
}

// ── Input / Request Helpers ───────────────────────────────────

/**
 * Safely extract a field from a request body with type coercion.
 * @param {Object} body
 * @param {string} key
 * @param {any} [fallback]
 * @returns {any}
 */
function pickBodyField(body, key, fallback) {
    if (!body || typeof body !== 'object') return fallback;
    return key in body ? body[key] : fallback;
}

/**
 * Coerce a value to boolean.
 * @param {any} value
 * @returns {boolean}
 */
function coerceBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
}

/**
 * Clamp a number between min and max, with an optional fallback.
 * @param {any} value
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback]
 * @returns {number}
 */
function limitValue(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return Number.isFinite(fallback) ? fallback : min;
    return Math.min(Math.max(num, min), max);
}

/**
 * Require a module if it exists on disk, otherwise return null.
 * @param {string} modulePath
 * @returns {any|null}
 */
function requireIfExists(modulePath) {
    try {
        if (fs.existsSync(require.resolve(modulePath))) {
            return require(modulePath);
        }
    } catch {
        // module not found
    }
    return null;
}

/**
 * Sanitize a URL string: trim, validate, and reject private/internal addresses.
 * @param {string} rawUrl
 * @returns {URL}
 * @throws {Error} If invalid or private.
 */
function sanitizeUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) throw new Error('URL is required');
    const parsed = new URL(url);
    if (isPrivateHostname(parsed.hostname)) {
        throw new Error('Fetching from private/internal addresses is not allowed');
    }
    return parsed;
}

// ── Analysis Path Resolution ────────────────────────────────────

/**
 * Load AI credentials for the authenticated user, if any.
 * @param {import('express').Request} req
 * @param {Function} getUserAiCredentials
 * @returns {Promise<Object|null>}
 */
async function loadUserCredentials(req, getUserAiCredentials) {
    const email = req?.user?.email;
    if (!email) return null;
    try {
        return await getUserAiCredentials(email);
    } catch {
        return null;
    }
}

/**
 * Determine which extra paths should be scanned for mock/sample data.
 * @param {string} baseDir
 * @param {string} projectPath
 * @param {Object} helpers
 * @param {Function} helpers.isSameResolvedPath
 * @param {Function} helpers.resolvePlatformRoot
 * @returns {string[]}
 */
function resolveMockScanPaths(baseDir, projectPath, helpers = {}) {
    if (typeof baseDir !== 'string' || typeof projectPath !== 'string') return [];
    if (!projectPath || (typeof helpers.isSameResolvedPath === 'function' && helpers.isSameResolvedPath(projectPath, baseDir))) {
        return [];
    }
    const { scanRoot, platformRoot } = typeof helpers.resolvePlatformRoot === 'function'
        ? helpers.resolvePlatformRoot(projectPath)
        : { scanRoot: projectPath, platformRoot: projectPath };
    const projectKey = path.resolve(projectPath).replace(/\\/g, '/').toLowerCase();
    const platformKey = path.resolve(platformRoot).replace(/\\/g, '/').toLowerCase();
    const baseKey = path.resolve(baseDir).replace(/\\/g, '/').toLowerCase();
    if (projectKey === platformKey || projectKey === baseKey) {
        return [];
    }
    if (platformKey.startsWith(`${projectKey}/`)) {
        return [];
    }
    if (projectKey === path.resolve(scanRoot).replace(/\\/g, '/').toLowerCase() && scanRoot !== platformRoot) {
        return [];
    }
    return [projectPath];
}

/**
 * Heuristic check: does a directory look like a mock-data folder?
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function pathLooksLikeMockScan(targetPath) {
    try {
        const stat = await fs.promises.stat(targetPath);
        if (!stat.isDirectory()) return false;
        const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
        const files = entries.filter((e) => e.isFile()).map((e) => e.name);
        const jsonCount = files.filter((n) => n.endsWith('.json')).length;
        const sourceCount = files.filter((n) => /\.(js|ts|jsx|tsx|py|cjs|mjs)$/.test(n)).length;
        if (jsonCount === 0) return false;
        if (sourceCount > 0) return false;
        if (files.length === 0) return false;
        const mockNamedCount = files.filter((n) => /mock|sample|demo|fixture/i.test(n)).length;
        return mockNamedCount > 0 || (jsonCount / files.length) > 0.7;
    } catch {
        return false;
    }
}

/**
 * Resolve the analysis type from the request, or auto-detect based on directory contents.
 * @param {string} requestedType
 * @param {string} targetPath
 * @param {Function} pathLooksLikeMockScan
 * @returns {Promise<string>}
 */
async function resolveAnalysisType(requestedType, targetPath, pathLooksLikeMockScan) {
    const type = String(requestedType || 'auto').toLowerCase();
    const knownTypes = [
        'roadmap', 'mock-scan', 'codebase', 'complete',
        'npm-audit', 'compliance', 'data-cleanup', 'data-quality',
        'cleanup-assistant', 'file-reduction', 'consolidation', 'eu-ai-act',
        'workspace-health'
    ];
    if (knownTypes.includes(type)) return type;
    return (typeof pathLooksLikeMockScan === 'function' && await pathLooksLikeMockScan(targetPath)) ? 'mock-scan' : 'roadmap';
}

// ── AI Provider Resolution ────────────────────────────────────

/**
 * Build provider options for Ollama-based summary generation.
 * @param {Object} registry Model registry.
 * @param {Object|null} [userCredentials=null]
 * @param {string} [defaultOllamaUrl]
 * @returns {Object|null}
 */
function resolveOllamaSummaryProvider(registry, userCredentials = null, defaultOllamaUrl) {
    if (!registry || typeof registry !== 'object') return null;
    const ollamaModel = userCredentials?.ollamaModel
        || process.env.OLLAMA_MODEL
        || registry?.models?.find((m) => m.id === registry.activeModelId && m.provider === 'ollama')?.ollamaModel
        || registry?.models?.find((m) => m.provider === 'ollama' && m.ollamaModel)?.ollamaModel
        || null;
    const baseUrl = userCredentials?.ollamaBaseUrl
        || registry?.ollamaBaseUrl
        || process.env.OLLAMA_BASE_URL
        || defaultOllamaUrl;
    if (!baseUrl) return null;
    return ollamaModel
        ? { providerId: 'ollama', ollamaModel }
        : { providerId: 'ollama' };
}

/**
 * Resolve the summary provider configuration for the requested AI provider.
 * @param {string} aiProvider
 * @param {Object} registry Model registry.
 * @param {Object|null} [userCredentials=null]
 * @param {string} [defaultOllamaUrl]
 * @returns {Object|null}
 */
function resolveSummaryProvider(aiProvider, registry, userCredentials = null, defaultOllamaUrl) {
    if (!registry || typeof registry !== 'object') return null;
    if (aiProvider === 'demo') return null;
    if (aiProvider === 'active') {
        const model = registry.models?.find((m) => m.id === registry.activeModelId);
        if (model?.provider === 'ollama' && model.ollamaModel) {
            return { providerId: 'ollama', ollamaModel: model.ollamaModel };
        }
        return resolveOllamaSummaryProvider(registry, userCredentials, defaultOllamaUrl);
    }
    if (aiProvider === 'ollama') {
        return resolveOllamaSummaryProvider(registry, userCredentials, defaultOllamaUrl);
    }
    return { providerId: aiProvider };
}

// ── Website Fetcher ───────────────────────────────────────────

const https = require('https');
const http = require('http');
const { URL: NodeURL } = require('url');

/**
 * Download a website's index HTML and linked CSS/JS assets into a temp directory.
 * @param {string} rawUrl
 * @returns {Promise<string>} Path to the temp directory containing fetched assets.
 */
async function fetchWebsiteToTemp(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) throw new Error('URL is required');
    const parsed = new NodeURL(url);
    if (isPrivateHostname(parsed.hostname)) {
        throw new Error('Fetching from private/internal addresses is not allowed');
    }
    const os = require('os');
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sb-web-'));
    const domain = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_');
    const fetchDir = path.join(tempDir, domain);
    await fs.promises.mkdir(fetchDir, { recursive: true });
    const indexPath = path.join(fetchDir, 'index.html');

    await new Promise((resolve, reject) => {
        const MAX_REDIRECTS = 5;
        const fetchIndex = (currentUrl, redirects = 0) => {
            if (redirects > MAX_REDIRECTS) {
                return reject(new Error('Too many redirects'));
            }
            const parsedUrl = new NodeURL(currentUrl);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            const request = client.get(currentUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    const location = response.headers.location;
                    let redirectUrl;
                    try {
                        redirectUrl = location.startsWith('http') ? location : new NodeURL(location, currentUrl).href;
                        const redirectParsed = new NodeURL(redirectUrl);
                        if (redirectParsed.protocol !== 'http:' && redirectParsed.protocol !== 'https:') {
                            return reject(new Error(`Blocked redirect to non-HTTP protocol: ${redirectParsed.protocol}`));
                        }
                        if (isPrivateHostname(redirectParsed.hostname)) {
                            return reject(new Error('Blocked redirect to private/internal address'));
                        }
                    } catch {
                        return reject(new Error(`Invalid redirect location: ${location.slice(0, 120)}`));
                    }
                    return fetchIndex(redirectUrl, redirects + 1);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                const stream = fs.createWriteStream(indexPath);
                response.on('error', (err) => { stream.destroy(); reject(err); });
                response.pipe(stream);
                stream.on('finish', () => resolve(fetchDir));
                stream.on('error', (err) => { response.destroy(); reject(err); });
            });
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        };
        fetchIndex(url);
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
                assetUrl = new NodeURL(asset, url).href;
            } catch {
                continue;
            }
            let assetFile;
            try {
                assetFile = path.basename(asset.replace(/[?#].*$/, ''));
            } catch {
                continue;
            }
            if (!assetFile) continue;
            const outPath = path.join(fetchDir, assetFile);
            try {
                const client2 = new NodeURL(assetUrl).protocol === 'https:' ? https : http;
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

// ── Security ──────────────────────────────────────────────────

/**
 * Block private/internal hostnames to prevent SSRF.
 * @param {string} hostname
 * @returns {boolean}
 */
function isPrivateHostname(hostname) {
    if (typeof hostname !== 'string') return true;
    const h = hostname.toLowerCase();
    if (h === 'localhost') return true;
    if (h.endsWith('.localhost')) return true;
    if (h === '0.0.0.0') return true;
    if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^fc00:/i.test(h) || /^fe80:/i.test(h)) return true;
    return false;
}

/**
 * Best-effort removal of a temp directory.
 * @param {string} tempDir
 * @returns {Promise<void>}
 */
async function cleanupWebsiteTemp(tempDir) {
    if (typeof tempDir !== 'string' || !tempDir) return;
    try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
        // ignore cleanup failures
    }
}

module.exports = {
    sanitizeHttpHeaderValue,
    shouldLogRuntimeInfo,
    withTimeout,
    safeBasename,
    normalizeStringList,
    resolveProjectPath,
    isSameResolvedPath,
    deriveSeverityCounts,
    resolveModelId,
    countIssuesByKind,
    issueBreakdownFromList,
    normalizeReportForSummary,
    safeString,
    safeErrorMessage,
    countFiles,
    sanitizeUploadPath,
    sanitizeReportForAi,
    isPrivateHostname,
    cleanupWebsiteTemp,
    // Response builders
    sendAnalyzeJson,
    rejectPaidDeliverable,
    buildSuccessResponse,
    buildErrorResponse,
    // Input helpers
    pickBodyField,
    coerceBoolean,
    limitValue,
    requireIfExists,
    sanitizeUrl,
    // Analysis path resolution
    loadUserCredentials,
    resolveMockScanPaths,
    pathLooksLikeMockScan,
    resolveAnalysisType,
    // AI provider resolution
    resolveOllamaSummaryProvider,
    resolveSummaryProvider,
    // Website fetcher
    fetchWebsiteToTemp
};
