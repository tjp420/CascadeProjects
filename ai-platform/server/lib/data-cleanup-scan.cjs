/**
 * Shared data-cleanup / file-reduction scan handler for dashboard APIs.
 */

const logger = require('./app-logger.cjs');
const constants = require('../config/constants.cjs');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath
} = require('./path-safety.cjs');
const { toClientError } = require('../../shared-utils/index.cjs');
const path = require('path');
const fs = require('fs');
const { compactDataCleanupReportForClient, enrichCleanupReport, runFileReductionScan } = require('./simplebeacon-proxy.cjs');
const { scanDirectoryBloat } = require('./directory-bloat-scanner.cjs');

/**
 * Validate cached scan result against current filesystem state.
 * Checks if files/directories referenced in findings still exist and match cached state.
 * @param {any} payload
 * @param {string} projectPath
 * @returns {boolean}
 */
async function isCachedResultFresh(payload, projectPath) {
    if (!payload || typeof payload !== 'object') return false;

    const findings = payload.allFindings || payload.findings || [];
    const envInconsistencies = findings.filter((f) => f.type === 'env-inconsistency');
    const dirBloat = payload.findings?.directoryBloat || [];

    // Validate env-inconsistency findings by re-reading the env files
    for (const finding of envInconsistencies) {
        const key = finding.metadata?.key;
        const values = finding.metadata?.values || [];
        if (!key || values.length < 2) continue;

        const currentValues = new Map();
        for (const entry of values) {
            const filePath = entry.file || entry.path;
            if (!filePath) continue;
            const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
            try {
                const content = await fs.promises.readFile(absPath, 'utf8');
                const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
                currentValues.set(filePath, match ? match[1].trim() : undefined);
            } catch {
                return false; // File no longer readable
            }
        }
        const uniqueCurrent = [...new Set(currentValues.values())].filter((v) => v !== undefined);
        if (uniqueCurrent.length <= 1) return false; // Inconsistency resolved
    }

    // Validate directory-bloat findings by checking dirs still exist and have size
    for (const finding of dirBloat) {
        const dirRel = finding.path;
        if (!dirRel) continue;
        const absDir = path.isAbsolute(dirRel) ? dirRel : path.join(projectPath, dirRel);
        try {
            const stat = await fs.promises.stat(absDir);
            if (!stat.isDirectory()) return false; // No longer a directory
            // If empty dirs were reported but now have contents, invalidate
            if (finding.kind === 'directory' && finding.category === 'Empty directory') {
                const entries = await fs.promises.readdir(absDir);
                if (entries.length > 0) return false;
            }
        } catch {
            return false; // Dir no longer exists
        }
    }

    return true;
}

const FILE_REDUCTION_SCANNER_IDS = ['build-artifacts', 'asset-consolidation', 'unused-files', 'directory-bloat'];
const DATA_QUALITY_SCANNER_IDS = [
    'config-management',
    'dependency-health',
    'environment-variables',
    'data-freshness',
    'data-access-patterns',
    'data-privacy',
    'data-lineage',
    'data-consistency'
];
const ALL_DATA_CLEANUP_SCANNER_IDS = [...FILE_REDUCTION_SCANNER_IDS, ...DATA_QUALITY_SCANNER_IDS];
const DEFAULT_SCAN_CACHE_TTL_MS = Number(process.env.DATA_CLEANUP_SCAN_CACHE_TTL_MS) || 5 * constants.ONE_MINUTE_MS;
const scanResultCache = new Map();

/**
 * Build scan cache key.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
function buildScanCacheKey(projectPath, options = {}) {
    return JSON.stringify({
        projectPath,
        profile: String(options.profile || options.mode || 'all').toLowerCase(),
        scanner: options.scanner ? String(options.scanner).trim() : '',
        compact: options.compact !== false
    });
}

/**
 * Clear data cleanup scan cache.
 * @returns {any}
 */
function clearDataCleanupScanCache() {
    scanResultCache.clear();
}

/**
 * Resolve data cleanup scanner config.
 * @param {string} profile
 * @param {any} singleScanner
 * @returns {any}
 */
function resolveDataCleanupScannerConfig(profile, singleScanner) {
    if (singleScanner) {
        const id = String(singleScanner).trim();
        if (!ALL_DATA_CLEANUP_SCANNER_IDS.includes(id)) {
            throw new Error(`Unknown scanner "${id}". Valid: ${ALL_DATA_CLEANUP_SCANNER_IDS.join(', ')}`);
        }
        return Object.fromEntries(
            ALL_DATA_CLEANUP_SCANNER_IDS.map((scannerId) => [scannerId, { enabled: scannerId === id }])
        );
    }

    const normalized = String(profile || 'all').toLowerCase();
    const enabledIds = normalized === 'file-reduction'
        ? FILE_REDUCTION_SCANNER_IDS
        : normalized === 'data-quality'
            ? DATA_QUALITY_SCANNER_IDS
            : ALL_DATA_CLEANUP_SCANNER_IDS;

    const enabledSet = new Set(enabledIds);
    return Object.fromEntries(
        ALL_DATA_CLEANUP_SCANNER_IDS.map((scannerId) => [scannerId, { enabled: enabledSet.has(scannerId) }])
    );
}

/**
 * Resolve safe project path.
 * @param {string} rawPath
 * @param {Object} options
 * @returns {any}
 */
function resolveSafeProjectPath(rawPath, options = {}) {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) return null;
    // Dashboard default sentinel: a bare "/" means "use the default platform root".
    if (trimmed === '/' || trimmed === path.sep) {
        return path.resolve(options.baseDir || process.cwd());
    }
    const allowedRoots = options.allowedRoots || resolveDefaultAllowedRoots(options.baseDir, {
        monorepoRoot: options.monorepoRoot
    });
    const candidate = path.isAbsolute(trimmed)
        ? path.normalize(trimmed)
        : path.join(options.baseDir || process.cwd(), trimmed);
    return assertSafeProjectPath(candidate, allowedRoots);
}

/**
 * Run data cleanup scan.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
async function runDataCleanupScan(projectPath, options = {}) {
    const profile = String(options.profile || options.mode || 'all').toLowerCase();
    const singleScanner = options.scanner ? String(options.scanner).trim() : '';
    const scanners = resolveDataCleanupScannerConfig(profile, singleScanner || undefined);
    const startedAt = Date.now();
    const compact = options.compact !== false;
    const bypassCache = options.bypassCache === true;
    const cacheKey = buildScanCacheKey(projectPath, { profile, scanner: singleScanner, compact });
    const cacheTtlMs = Number(options.cacheTtlMs) || DEFAULT_SCAN_CACHE_TTL_MS;

    if (!bypassCache) {
        const cached = scanResultCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            const fresh = await isCachedResultFresh(cached.payload, projectPath);
            if (fresh) {
                logger.info(`[analyze] data-cleanup cache hit path=${projectPath} profile=${profile}${singleScanner ? ` scanner=${singleScanner}` : ''}`);
                return {
                    ...cached.payload,
                    cacheHit: true,
                    cacheAgeMs: Date.now() - cached.storedAt
                };
            }
            logger.info(`[analyze] data-cleanup cache stale path=${projectPath} profile=${profile}${singleScanner ? ` scanner=${singleScanner}` : ''} — re-scanning`);
            scanResultCache.delete(cacheKey);
        }
    }

    logger.info(`[analyze] data-cleanup start path=${projectPath} profile=${profile}${singleScanner ? ` scanner=${singleScanner}` : ''}`);

    const report = await runFileReductionScan(projectPath, {
        dryRun: true,
        scanners
    });
    report.scanProfile = profile;
    report.enabledScanners = Object.entries(scanners)
        .filter(([, config]) => config.enabled !== false)
        .map(([id]) => id);

    // Augment with directory-bloat scan when file-reduction profile is active
    if (profile === 'file-reduction' || profile === 'all' || singleScanner === 'directory-bloat') {
        try {
            const bloat = await scanDirectoryBloat(projectPath);
            if (bloat?.findings?.directoryBloat?.length) {
                report.findings = report.findings || {};
                report.findings.directoryBloat = bloat.findings.directoryBloat;
                if (report.summary) {
                    report.summary.directoryBloatFindings = bloat.summary.directoryBloatFindings;
                    report.summary.directoryBloatReclaimableBytes = bloat.summary.directoryBloatReclaimableBytes;
                    report.summary.totalFindings = (report.summary.totalFindings || 0) + bloat.summary.directoryBloatFindings;
                    report.summary.reclaimableBytes = (report.summary.reclaimableBytes || 0) + bloat.summary.directoryBloatReclaimableBytes;
                }
                if (report.executiveSummary?.fileReduction) {
                    report.executiveSummary.fileReduction.estimatedImmediateSavingsBytes = (report.executiveSummary.fileReduction.estimatedImmediateSavingsBytes || 0) + bloat.summary.directoryBloatReclaimableBytes;
                }
            }
        } catch (bloatErr) {
            logger.warn('[analyze] directory-bloat scan failed', { error: bloatErr.message });
        }
    }

    const enriched = enrichCleanupReport(report, { profile });
    const payload = compact ? compactDataCleanupReportForClient(enriched) : enriched;
    payload.durationMs = Date.now() - startedAt;
    logger.info(`[analyze] data-cleanup done path=${projectPath} profile=${profile} ms=${payload.durationMs} findings=${payload.summary?.totalFindings ?? '—'} compact=${compact}`);

    scanResultCache.set(cacheKey, {
        storedAt: Date.now(),
        expiresAt: Date.now() + cacheTtlMs,
        payload
    });

    return payload;
}

/**
 * Register data cleanup analyze route.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerDataCleanupAnalyzeRoute(app, options = {}) {
    const baseDir = options.baseDir || process.cwd();
    const monorepoRoot = options.monorepoRoot || path.resolve(path.join(baseDir, '..'));
    const allowedRoots = resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
    const sendJson = typeof options.sendJson === 'function'
        ? options.sendJson
        : (res, payload) => res.json(payload);

/**
 * Handle data cleanup.
 * @param {any} req
 * @param {Array} res
 * @returns {any}
 */
    async function handleDataCleanup(req, res) {
        try {
            let projectPath;
            try {
                projectPath = resolveSafeProjectPath(req.query.projectPath || req.query.path, {
                    baseDir,
                    monorepoRoot,
                    allowedRoots
                });
            } catch (error) {
                return res.status(400).json({ success: false, error: toClientError(error, 'Invalid projectPath') });
            }
            if (!projectPath) {
                return res.status(400).json({ success: false, error: 'projectPath is required' });
            }

            const profile = String(req.query.profile || req.query.mode || 'all').toLowerCase();
            const singleScanner = req.query.scanner ? String(req.query.scanner).trim() : '';
            const full = ['1', 'true', 'yes'].includes(String(req.query.full || req.query.compact === '0' ? '1' : '').toLowerCase());
            const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
            const report = await runDataCleanupScan(projectPath, {
                profile,
                scanner: singleScanner || undefined,
                compact: !full,
                bypassCache: refresh
            });

            res.set('Cache-Control', 'no-store');
            return sendJson(res, {
                success: true,
                analysisType: profile === 'file-reduction' ? 'file-reduction' : profile === 'data-quality' ? 'data-quality' : 'data-cleanup',
                data: report,
                projectPath,
                scanProfile: profile
            });
        } catch (error) {
            return res.status(400).json({ success: false, error: toClientError(error, 'Data cleanup analysis failed') });
        }
    }

    app.get('/api/analyze/data-cleanup', handleDataCleanup);
}

module.exports = {
    ALL_DATA_CLEANUP_SCANNER_IDS,
    resolveDataCleanupScannerConfig,
    runDataCleanupScan,
    registerDataCleanupAnalyzeRoute,
    clearDataCleanupScanCache,
    buildScanCacheKey
};
