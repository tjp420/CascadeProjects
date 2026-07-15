// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
'use strict';

/**
 * @module file-reduction
 * File reduction and data cleanup analyzers.
 *
 * Walks a project tree, runs configured scanners (build artifacts, unused files,
 * dead code, etc.), aggregates findings, and produces a structured report with
 * an executive summary and file-reduction plan.
 *
 * ```js
 * const { runFileReductionAnalysis } = require('./analyzers/file-reduction');
 * const report = await runFileReductionAnalysis('/path/to/project', { dryRun: true });
 * console.log(report.summary.totalFindings);
 * ```
 *
 * @file packages/simplebeacon-cli/src/analyzers/file-reduction/index.js
 */

const { walkProjectFiles } = require('./utils/project-walker');
const fileReductionRules = require('../../rules/file-reduction-rules');
const { aggregateCleanupFindings } = require('../../lib/result-aggregator');
const { buildExecutiveSummary } = require('../../lib/executive-summary');
const { buildScannerStatistics } = require('../../lib/scanner-statistics');
const { buildFileReductionPlan } = require('../../lib/file-reduction-plan');
const { loadSimplebeaconConfig } = require('../../config');
const { crossReferenceScannerResults } = require('../../lib/cross-analyzer-intelligence');

const DEFAULT_SCANNERS = fileReductionRules.scanners.map((entry) => ({
    id: entry.id,
    Scanner: entry.class,
    enabled: entry.enabled !== false,
    priority: entry.priority
}));

/** Convert kebab-case to camelCase (e.g. 'build-artifacts' -> 'buildArtifacts'). */
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Run the full file-reduction analysis pipeline.
 *
 * @param {string} projectRoot - Absolute path to the project directory.
 * @param {Object} [options] - Analysis options.
 * @param {boolean} [options.dryRun=true] - When true, only report findings without deleting.
 * @param {Object} [options.scanners] - Per-scanner overrides.
 * @returns {Promise<Object>} Structured report with findings, summary, and plan.
 */
async function runFileReductionAnalysis(projectRoot, options = {}) {
    const startedAt = Date.now();
    const inventory = await walkProjectFiles(projectRoot, options);
    const scannerConfig = options.scanners || {};
    let dataCleanupConfig = {};
    try {
        const loaded = loadSimplebeaconConfig(projectRoot);
        dataCleanupConfig = loaded.dataCleanup || {};
    } catch {
        dataCleanupConfig = {};
    }
    const hasExplicitScannerConfig = Object.keys(scannerConfig).length > 0;
    const enabledScanners = DEFAULT_SCANNERS
        .filter((entry) => {
            if (!hasExplicitScannerConfig) {
                return entry.enabled !== false;
            }
            return scannerConfig[entry.id]?.enabled === true;
        })
        .sort((a, b) => a.priority - b.priority);

    const results = {};
    for (const entry of enabledScanners) {
        const scannerOptions = {
            ...(dataCleanupConfig[entry.id] || {}),
            ...(scannerConfig[entry.id] || {})
        };
        const scanner = new entry.Scanner(scannerOptions);
        results[entry.id] = await scanner.scan(projectRoot, { ...options, inventory });
    }

    crossReferenceScannerResults(results);

    const rawFindings = Object.values(results).flatMap((result) => result.findings || []);
    const aggregated = aggregateCleanupFindings(rawFindings);
    const allFindings = aggregated.findings;

    const reclaimableBytes = allFindings.reduce((sum, finding) => {
        if (finding.reclaimableBytes) return sum + finding.reclaimableBytes;
        if (finding.type === 'build-artifact') return sum + (finding.sizeBytes || 0);
        return sum;
    }, 0);

    const totalProjectBytes = inventory.files.reduce((sum, f) => sum + (f.size || 0), 0);

    // Build findings and summary dynamically so new scanners need only one entry in rules.
    const findings = Object.fromEntries(
        DEFAULT_SCANNERS.map((s) => [kebabToCamel(s.id), results[s.id]?.findings || []])
    );
    const summaryCounts = Object.fromEntries(
        DEFAULT_SCANNERS.map((s) => [`${kebabToCamel(s.id)}Findings`, (results[s.id]?.findings || []).length])
    );

    const report = {
        type: 'data-cleanup-report',
        projectRoot,
        dryRun: options.dryRun !== false,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        inventory: {
            totalFiles: inventory.files.length,
            totalDirectories: inventory.directories.length
        },
        scanners: Object.fromEntries(
            Object.entries(results).map(([id, result]) => [id, result.summary || {}])
        ),
        findings,
        aggregation: {
            bySeverity: {
                critical: aggregated.bySeverity.critical.length,
                high: aggregated.bySeverity.high.length,
                medium: aggregated.bySeverity.medium.length,
                low: aggregated.bySeverity.low.length
            },
            byCategory: aggregated.byCategory,
            topFiles: aggregated.topFiles
        },
        allFindings,
        summary: {
            totalFindings: allFindings.length,
            ...summaryCounts,
            reclaimableBytes,
            estimatedReductionPct: totalProjectBytes
                ? Math.round((reclaimableBytes / totalProjectBytes) * 1000) / 10
                : 0
        },
        metadata: {
            entryPoints: results['unused-files']?.metadata?.entryPoints || [],
            dataLineage: results['data-lineage']?.metadata?.lineage || []
        }
    };
    report.fileReductionPlan = buildFileReductionPlan(report);
    report.executiveSummary = buildExecutiveSummary(report);
    report.scannerStatistics = buildScannerStatistics(report);
    return report;
}

module.exports = Object.freeze({
    runFileReductionAnalysis,
    DEFAULT_SCANNERS,
    fileReductionRules,
    BuildArtifactScanner: fileReductionRules.scanners.find((s) => s.id === 'build-artifacts')?.class,
    AssetConsolidationScanner: fileReductionRules.scanners.find((s) => s.id === 'asset-consolidation')?.class,
    UnusedFileDetector: fileReductionRules.scanners.find((s) => s.id === 'unused-files')?.class,
    walkProjectFiles
});
