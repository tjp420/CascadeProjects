/**
 * Shared data-cleanup / file-reduction scan handler for dashboard APIs.
 */

const logger = require('./app-logger.cjs');
const { runFileReductionScan } = require('../../packages/simplebeacon-cli/src/lib/file-reduction-orchestrator');
const { enrichCleanupReport, compactDataCleanupReportForClient } = require('../../packages/simplebeacon-cli/src/lib/enrich-cleanup-report');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath
} = require('./path-safety.cjs');
const { toClientError } = require('./client-error.cjs');

const FILE_REDUCTION_SCANNER_IDS = ['build-artifacts', 'asset-consolidation', 'unused-files'];
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
const DEFAULT_SCAN_CACHE_TTL_MS = Number(process.env.DATA_CLEANUP_SCAN_CACHE_TTL_MS) || 5 * 60 * 1000;
const scanResultCache = new Map();

function buildScanCacheKey(projectPath, options = {}) {
    return JSON.stringify({
        projectPath,
        profile: String(options.profile || options.mode || 'all').toLowerCase(),
        scanner: options.scanner ? String(options.scanner).trim() : '',
        compact: options.compact !== false
    });
}

function clearDataCleanupScanCache() {
    scanResultCache.clear();
}

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

function resolveSafeProjectPath(rawPath, options = {}) {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) return null;
    const allowedRoots = options.allowedRoots || resolveDefaultAllowedRoots(options.baseDir, {
        monorepoRoot: options.monorepoRoot
    });
    const path = require('path');
    const candidate = path.isAbsolute(trimmed)
        ? path.normalize(trimmed)
        : path.join(options.baseDir || process.cwd(), trimmed);
    return assertSafeProjectPath(candidate, allowedRoots);
}

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
            logger.info(`[analyze] data-cleanup cache hit path=${projectPath} profile=${profile}${singleScanner ? ` scanner=${singleScanner}` : ''}`);
            return {
                ...cached.payload,
                cacheHit: true,
                cacheAgeMs: Date.now() - cached.storedAt
            };
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

function registerDataCleanupAnalyzeRoute(app, options = {}) {
    const baseDir = options.baseDir || process.cwd();
    const monorepoRoot = options.monorepoRoot || baseDir;
    const allowedRoots = resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
    const sendJson = typeof options.sendJson === 'function'
        ? options.sendJson
        : (res, payload) => res.json(payload);

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
