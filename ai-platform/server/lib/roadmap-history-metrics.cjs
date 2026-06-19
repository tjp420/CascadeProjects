/**
 * Normalize roadmap scan metrics for analysis history entries.
 */

/**
 * Normalize progress percent.
 * @param {any} value
 * @returns {any}
 */
function normalizeProgressPercent(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    const pct = num <= 1 ? num * 100 : num;
    return Math.round(Math.max(0, Math.min(100, pct)));
}

/**
 * Extract roadmap history metrics.
 * @param {any} roadmap
 * @returns {any}
 */
function extractRoadmapHistoryMetrics(roadmap) {
    const progressRaw = roadmap?.executiveSummary?.completionRate
        ?? roadmap?.progressMetrics?.overall
        ?? roadmap?.developmentProgress?.overall
        ?? roadmap?.projectOverview?.completionRate;

    const filesScanned = roadmap?.codeAnalysis?.structure?.totalFiles
        ?? roadmap?.projectStructure?.totalFiles
        ?? null;

    return {
        progressPercent: normalizeProgressPercent(progressRaw),
        filesScanned: filesScanned != null ? Number(filesScanned) : null,
        projectHealth: roadmap?.executiveSummary?.projectHealth
            ?? roadmap?.projectOverview?.projectHealth
            ?? null
    };
}

/**
 * Build history entry from roadmap.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function buildHistoryEntryFromRoadmap(roadmap, options = {}) {
    const {
        projectPath,
        title,
        scanOptions = {},
        id,
        timestamp
    } = options;

    const metrics = extractRoadmapHistoryMetrics(roadmap);
    const pathParts = String(projectPath || '').replace(/\\/g, '/').split('/').filter(Boolean);

    return {
        id: id || `scan-${Date.now()}`,
        projectPath,
        title: title || roadmap?.projectTitle || pathParts[pathParts.length - 1] || 'Project',
        timestamp: timestamp || new Date().toISOString(),
        filesScanned: metrics.filesScanned,
        progressPercent: metrics.progressPercent,
        projectHealth: metrics.projectHealth,
        includePaths: Array.isArray(scanOptions.includePaths) ? scanOptions.includePaths : [],
        excludePatterns: Array.isArray(scanOptions.excludePatterns) ? scanOptions.excludePatterns : []
    };
}

/**
 * Is mis scoped filesystem scan.
 * @param {any} roadmap
 * @returns {any}
 */
function isMisScopedFilesystemScan(roadmap) {
    if (!roadmap) return false;

    const signals = roadmap.codeAnalysis?.signals || {};
    const samples = roadmap.codeAnalysis?.samples || {};
    const es = roadmap.executiveSummary || {};
    const completion = Number(es.completionRate);
    const progressOverall = Number(roadmap.progressMetrics?.overall);

    const missedPlatformSignals = signals.serverEntry === true
        && (signals.stubApi === false || signals.pageSampleDir === false || signals.phase2Auth === false);

    if (missedPlatformSignals) return true;

    if (samples.onDisk === 0 && samples.withSpecs === 0 && signals.pageSampleDir === false) {
        return true;
    }

    if (completion === 58 && progressOverall > 70 && progressOverall < 80) {
        return true;
    }

    return false;
}

module.exports = {
    normalizeProgressPercent,
    extractRoadmapHistoryMetrics,
    buildHistoryEntryFromRoadmap,
    isMisScopedFilesystemScan
};
