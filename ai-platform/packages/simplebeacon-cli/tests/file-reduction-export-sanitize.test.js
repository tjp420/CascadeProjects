const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFileReductionReport } = require('../src/lib/normalize-file-reduction-report');
const { sanitizeDataCleanupReportExport } = require('../src/lib/data-cleanup-export-sanitize');

const GEE = 'C:/repo/ai-platform/github-cache/google-earthenterprise';

test('normalizeFileReductionReport fixes inflated estimatedReductionPct on benchmark clone', () => {
    const normalized = normalizeFileReductionReport({
        type: 'data-cleanup-report',
        projectRoot: GEE,
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 17237 },
        scanners: {
            'build-artifacts': { artifactFiles: 8, reclaimableBytes: 697938 },
            'asset-consolidation': { duplicateGroups: 543, reclaimableBytes: 567355833 },
            'unused-files': { unusedCandidates: 443 }
        },
        findings: {
            buildArtifacts: [{ type: 'build-artifact', path: 'docs/.DS_Store', severity: 'low' }],
            assetConsolidation: [{ type: 'asset-duplicate', reclaimableBytes: 1000, action: 'consolidate-duplicates' }],
            unusedFiles: [{ type: 'unused-file', path: 'earth_enterprise/foo.py', severity: 'medium' }],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        summary: { estimatedReductionPct: 99400, totalFindings: 994 }
    });

    assert.equal(normalized.scanScope.reportHealth, 'benchmark-clone-scan');
    assert.ok(normalized.summary.estimatedReductionPct < 100);
    assert.equal(normalized.summary.duplicateAssetGroups, 543);
    assert.equal(normalized.summary.totalFindings, 994);
});

test('normalizeFileReductionReport drops compact stale unused counts after protected-path filter', () => {
    const normalized = normalizeFileReductionReport({
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon',
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 194 },
        scanners: {
            'unused-files': { unusedCandidates: 5 }
        },
        findings: {
            unusedFiles: [
                { type: 'unused-file', path: 'examples/mcp/cursor.mcp.json' },
                { type: 'unused-file', path: 'src/reporters/ai-enhanced-report.js' }
            ],
            buildArtifacts: [],
            assetConsolidation: [],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        summary: { unusedFileCandidates: 5, totalFindings: 5 }
    });

    assert.equal(normalized.findings.unusedFiles.length, 0);
    assert.equal(normalized.summary.unusedFileCandidates, 0);
    assert.equal(normalized.summary.totalFindings, 0);
});

test('sanitizeDataCleanupReportExport repairs frozen GEE file-reduction export', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: GEE,
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 17237, note: 'stale full-tree' },
        scanners: {
            'asset-consolidation': { duplicateGroups: 543, reclaimableBytes: 567355833 }
        },
        summary: { totalFindings: 994, duplicateAssetGroups: 543, estimatedReductionPct: 99400 },
        findings: {
            assetConsolidation: [{ type: 'asset-duplicate', reclaimableBytes: 1738320 }],
            buildArtifacts: [],
            unusedFiles: [],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        aggregation: { topFiles: [{ filePath: 'unknown', count: 1 }] },
        fileReductionPlan: {
            totals: { duplicateAssetBytes: 567355833, safeToDeleteBytes: 0 },
            duplicateAssets: {
                topGroups: [{
                    keeper: 'docs/geedocs/5.2.0/art/a.png',
                    duplicates: ['docs/geedocs/5.2.1/art/a.png'],
                    reclaimableBytes: 1738320
                }]
            },
            recommendations: ['Delete node_modules']
        },
        scanScope: {
            resultsViewScope: 'platform-only',
            reportHealth: 'stale-full-tree-scan',
            limitations: ['exclude github-cache/']
        }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.handoffEligible, false);
    assert.equal(out.scanScope.resultsViewScope, 'benchmark-clone');
    assert.ok(out.summary.estimatedReductionPct < 100);
    assert.equal(out.findings.assetConsolidation[0].keeper, 'docs/geedocs/5.2.0/art/a.png');
    assert.ok(!out.aggregation.topFiles.some((e) => e.filePath === 'unknown'));
    assert.match(out.fileReductionPlan.recommendations[0], /OSS clone/i);
    assert.ok(!out.fileReductionPlan.recommendations.some((r) => /node_modules/i.test(r)));
});

test('sanitizeDataCleanupReportExport cleans stale simplebeacon benchmark file-reduction export', () => {
    const SB = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: SB,
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 194, totalDirectories: 27 },
        scanners: {
            'build-artifacts': { safeToDeleteBytes: 0, reclaimableBytes: 0 },
            'asset-consolidation': { duplicateGroups: 0, reclaimableBytes: 0 },
            'unused-files': { unusedCandidates: 5, sourceFilesScanned: 161, entryPoints: 10 }
        },
        summary: { totalFindings: 5, unusedFileCandidates: 5, estimatedReductionPct: 2.6 },
        findings: {
            buildArtifacts: [],
            assetConsolidation: [],
            unusedFiles: [
                { type: 'unused-file', path: 'examples/mcp/cursor.mcp.json', severity: 'medium' },
                { type: 'unused-file', path: 'src/reporters/ai-enhanced-report.js', severity: 'medium' },
                { type: 'unused-file', path: 'src/analyzers/data-cleanup/utils/analyzer-cache.js', severity: 'medium' }
            ],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        allFindings: [
            { type: 'unused-file', path: 'examples/mcp/cursor.mcp.json', severity: 'medium' },
            { type: 'unused-file', path: 'src/reporters/ai-enhanced-report.js', severity: 'medium' }
        ],
        fileReductionPlan: {
            totals: { safeToDeleteBytes: 0, duplicateAssetBytes: 0, reclaimableBytes: 0 },
            unusedFiles: { candidates: 5, sourceFilesScanned: 161, entryPoints: 10 },
            summaryTable: [
                { category: 'Unused source files', files: 5, bytes: null, action: 'Investigate' }
            ],
            recommendations: ['Delete unused files']
        },
        executiveSummary: {
            profile: 'file-reduction',
            priorityActions: [],
            fileReduction: { unusedFileCandidates: 5, safeToDeleteBytes: 0, duplicateAssetBytes: 0 },
            notes: ['PII hits in docs, reports, and sample data are common — review production paths first.']
        },
        scannerStatistics: { scope: 'workspace' }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.fileReductionStatus, 'no-immediate-reclaim');
    assert.equal(out.summary.unusedFileCandidates, 0);
    assert.equal(out.summary.totalFindings, 0);
    assert.equal(out.findings.unusedFiles.length, 0);
    assert.equal(out.fileReductionPlan.unusedFiles.candidates, 0);
    assert.equal(out.executiveSummary.fileReduction.unusedFileCandidates, 0);
    assert.equal(out.executiveSummary.priorityActions.length, 0);
    assert.match(out.executiveSummary.remediationHint, /No reclaimable/i);
    assert.ok(out.fileReductionPlan.hygieneSummary);
    assert.equal(out.scannerStatistics.scope, 'benchmark-clone');
});

test('sanitizeDataCleanupReportExport enriches product file-reduction export like Downloads', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 950 },
        summary: {
            totalFindings: 22,
            unusedFileCandidates: 19,
            duplicateAssetGroups: 1,
            reclaimableBytes: 256,
            estimatedReductionPct: 2.3
        },
        scanners: {
            'build-artifacts': { artifactDirectories: 2, safeToDeleteBytes: 0 },
            'asset-consolidation': { duplicateGroups: 1, reclaimableBytes: 256 },
            'unused-files': { unusedCandidates: 19 }
        },
        findings: {
            buildArtifacts: [
                { type: 'build-artifact', path: 'node_modules', action: 'safe-to-delete', sizeBytes: 0, kind: 'directory' }
            ],
            assetConsolidation: [{
                keeper: 'favicon.svg',
                duplicates: ['web/favicon.svg'],
                reclaimableBytes: 256
            }],
            unusedFiles: [{ type: 'unused-file', path: 'server/lib/foo.js', severity: 'medium' }],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        fileReductionPlan: {
            totals: { safeToDeleteBytes: 0, duplicateAssetBytes: 256 },
            safeToDelete: { topDirectories: [{ path: 'node_modules', bytes: 0, files: 0 }] },
            duplicateAssets: {
                topGroups: [{ keeper: 'favicon.svg', duplicates: ['web/favicon.svg'], reclaimableBytes: 256 }]
            },
            recommendations: [
                'Delete top-level artifact directories first (`node_modules`, `coverage`, `__pycache__`) — highest confidence and largest savings.'
            ]
        },
        executiveSummary: {
            profile: 'file-reduction',
            priorityActions: [],
            fileReduction: {
                reclaimableBytes: 256,
                safeToDeleteBytes: 0,
                unusedFileCandidates: 19,
                duplicateAssetGroups: 1,
                duplicateAssetBytes: 256,
                buildArtifactFindings: 2
            }
        }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.fileReductionStatus, 'investigate-and-optional-consolidation');
    assert.equal(out.findings.assetConsolidation[0].keeper, 'web/favicon.svg');
    assert.equal(out.fileReductionPlan.duplicateAssets.topGroups[0].keeper, 'web/favicon.svg');
    assert.ok(out.executiveSummary.priorityActions.length > 0);
    assert.ok(out.exportNotes.some((n) => /finding density/i.test(n)));
    assert.ok(!out.fileReductionPlan.recommendations.some((r) => /Delete top-level artifact directories first/i.test(r)));
});

test('sanitizeDataCleanupReportExport redacts paths and fixes safe-delete remediationHint', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 1055 },
        summary: {
            totalFindings: 2,
            reclaimableBytes: 305107025,
            estimatedReductionPct: 0.2
        },
        scanners: {
            'build-artifacts': { safeToDeleteBytes: 305107025, reclaimableBytes: 305107025 }
        },
        findings: {
            buildArtifacts: [{ type: 'build-artifact', path: 'coverage', action: 'safe-to-delete', sizeBytes: 664192 }],
            assetConsolidation: [],
            unusedFiles: [],
            configManagement: [],
            dependencyHealth: [],
            environmentVariables: [],
            dataFreshness: [],
            dataAccessPatterns: [],
            dataPrivacy: [],
            dataLineage: [],
            dataConsistency: []
        },
        fileReductionPlan: {
            totals: { safeToDeleteBytes: 305107025, reclaimableBytes: 305107025 }
        },
        executiveSummary: {
            profile: 'file-reduction',
            priorityActions: [],
            fileReduction: {
                safeToDeleteBytes: 305107025,
                buildArtifactFindings: 2,
                unusedFileCandidates: 0,
                duplicateAssetBytes: 0
            }
        },
        scannerStatistics: {
            project: { projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform', totalFiles: 1055 }
        }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.scannerStatistics.project.projectRoot, 'ai-platform');
    assert.equal(out.fileReductionStatus, 'safe-delete-available');
    assert.match(out.executiveSummary.remediationHint, /Phase 1 safe-delete/i);
    assert.ok(out.exportNotes.some((n) => /Safe-delete tiers are regenerable/i.test(String(n))));
});
