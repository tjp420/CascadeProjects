/**
 * Repository health metrics from file-merger-reduction scans.
 * Health score is derived from measured bloat — not a marketing constant.
 */

const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache.cjs');
const { isConsolidationExcludedPair } = require('./simplebeacon-proxy.cjs');


/**
 * Read json if exists.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonIfExists(filePath) {
    return readJsonFileCached(filePath);
}

/**
 * Redact path.
 * @param {any} value
 * @returns {any}
 */
function redactPath(value) {
    const normalized = String(value || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) {
        parts.shift();
    }
    if (parts.length <= 2) return parts.join('/') || 'project';
    return `…/${parts.slice(-2).join('/')}`;
}

/**
 * Score 0–100 from measured consolidation summary.
 * Calibrated on CascadeProjects monorepo (~72 at 1.7GB savings, 3 dup groups, 49 oversized).
 */
function computeRepositoryHealthScore(summary = {}) {
    let score = 100;
    const savingsRatio = (summary.potentialSavingsBytes || 0)
        / Math.max(summary.totalSizeBytes || 1, 1);

    score -= Math.min(20, Math.round(savingsRatio * 22));
    score -= Math.min(6, (summary.exactDuplicateGroups || 0) * 2);
    score -= Math.min(4, Math.floor((summary.oversizedFiles || 0) / 15));
    score -= Math.min(3, Math.floor((summary.reductionOpportunities || 0) / 20));

    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Filter stale mirror recommendations.
 * @param {Array} recommendations
 * @returns {any}
 */
function filterStaleMirrorRecommendations(recommendations = []) {
    return recommendations.filter((item) => {
        const files = item.files || [];
        if (files.length === 2 && isConsolidationExcludedPair(files[0], files[1])) {
            return false;
        }
        return true;
    });
}

/**
 * Build repository health snapshot.
 * @param {number} report
 * @param {any} label
 * @returns {any}
 */
function buildRepositoryHealthSnapshot(report, label) {
    if (!report || report.type !== 'file-merger-reduction-report') return null;

    const summary = report.summary || {};
    const score = computeRepositoryHealthScore(summary);
    const recommendations = filterStaleMirrorRecommendations(report.recommendations || [])
        .slice(0, 5).map((item) => ({
        priority: item.priority,
        action: item.action,
        savings: item.savings,
        effort: item.effort,
        risk: item.risk,
        description: item.description
    }));

    return {
        label,
        projectRoot: redactPath(report.projectRoot),
        platformRoot: report.platformRoot ? redactPath(report.platformRoot) : undefined,
        generatedAt: report.generatedAt || null,
        reportVersion: report.reportVersion ?? 1,
        repositoryHealthScore: score,
        optimizationPotential: summary.potentialSavingsLabel || null,
        optimizationPotentialBytes: summary.potentialSavingsBytes ?? null,
        duplicateGroups: summary.exactDuplicateGroups ?? 0,
        mergeCandidates: summary.mergeCandidates ?? 0,
        reductionOpportunities: summary.reductionOpportunities ?? 0,
        oversizedFiles: summary.oversizedFiles ?? 0,
        repositoryFilesTotal: summary.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null,
        repositoryFoldersTotal: summary.repositoryFoldersTotal ?? report.repositoryInventory?.totalFolders ?? null,
        repositoryFilesAudited: summary.repositoryFilesAudited ?? null,
        jsonFilesAnalyzed: summary.jsonFilesAnalyzed ?? null,
        sampleDataFilesAnalyzed: summary.sampleDataFilesAnalyzed ?? null,
        totalSizeLabel: summary.totalSizeLabel ?? null,
        scanScope: report.scanScope?.mode || null,
        recommendations,
        scopeNote: report.scanScope?.description
            || 'Filesystem duplicate detection and oversized-file analysis — not semantic code review.'
    };
}

/**
 * Resolve consolidation report paths.
 * @param {Object} options
 * @returns {any}
 */
function resolveConsolidationReportPaths(options = {}) {
    const platformRoot = path.resolve(options.platformRoot || options.projectRoot || process.cwd());
    const monorepoRoot = options.monorepoRoot
        ? path.resolve(options.monorepoRoot)
        : path.resolve(platformRoot, '..');

    return {
        platformRoot,
        monorepoRoot,
        platformReportPath: options.platformReportPath
            || path.join(platformRoot, '.simplebeacon', 'consolidation-report.json'),
        monorepoReportPath: options.monorepoReportPath
            || path.join(monorepoRoot, '.simplebeacon', 'consolidation-report.json')
    };
}

/**
 * Build repository health payload.
 * @param {Object} options
 * @returns {any}
 */
function buildRepositoryHealthPayload(options = {}) {
    const paths = resolveConsolidationReportPaths(options);
    const platformReport = readJsonIfExists(paths.platformReportPath);
    const monorepoReport = readJsonIfExists(paths.monorepoReportPath);

    const platform = buildRepositoryHealthSnapshot(platformReport, 'Platform (ai-platform)');
    const monorepo = monorepoReport
        && monorepoReport.projectRoot
        && path.resolve(monorepoReport.projectRoot).toLowerCase() !== path.resolve(paths.platformRoot).toLowerCase()
        ? buildRepositoryHealthSnapshot(monorepoReport, 'Monorepo root')
        : null;

    const primary = monorepo || platform;
    const headline = primary
        ? {
            repositoryHealthScore: primary.repositoryHealthScore,
            optimizationPotential: primary.optimizationPotential,
            optimizationPotentialBytes: primary.optimizationPotentialBytes,
            duplicateGroups: primary.duplicateGroups,
            oversizedFiles: primary.oversizedFiles,
            reductionOpportunities: primary.reductionOpportunities,
            mergeCandidates: primary.mergeCandidates,
            repositoryFilesTotal: primary.repositoryFilesTotal,
            repositoryFoldersTotal: primary.repositoryFoldersTotal,
            lastScan: primary.generatedAt
        }
        : null;

    return {
        type: 'simplebeacon-repository-health',
        generatedAt: new Date().toISOString(),
        platform,
        monorepo,
        headline,
        recommendations: primary?.recommendations || [],
        disclaimers: [
            'Health score reflects measured duplicate groups, oversized files, and estimated savings — not security gate results.',
            'Repository file totals use audit inventory (github-cache/, deliverables/, and benchmark clones excluded); JSON duplicate detection scans hashed JSON under the same scope.',
            'Potential savings are opportunities — review before deleting or merging any file.'
        ]
    };
}

/**
 * Save consolidation report.
 * @param {number} report
 * @param {any} projectRoot
 * @returns {any}
 */
function saveConsolidationReport(report, projectRoot) {
    const dir = path.join(path.resolve(projectRoot), '.simplebeacon');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'consolidation-report.json');
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return filePath;
}

module.exports = {
    computeRepositoryHealthScore,
    filterStaleMirrorRecommendations,
    buildRepositoryHealthSnapshot,
    buildRepositoryHealthPayload,
    saveConsolidationReport,
    resolveConsolidationReportPaths,
    readJsonIfExists
};
