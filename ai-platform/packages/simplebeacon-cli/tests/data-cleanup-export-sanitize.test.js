const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFileReductionReport } = require('../src/lib/normalize-file-reduction-report');
const { sanitizeDataCleanupReportExport } = require('../src/lib/data-cleanup-export-sanitize');

const GEE_ROOT = 'C:/repo/ai-platform/github-cache/google-earthenterprise';

test('normalizeFileReductionReport treats large OSS clone inventory as benchmark scan not stale', () => {
    const normalized = normalizeFileReductionReport({
        type: 'data-cleanup-report',
        projectRoot: GEE_ROOT,
        scanProfile: 'data-quality',
        inventory: { totalFiles: 17237, totalDirectories: 1163 },
        findings: {
            buildArtifacts: [],
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
        scanScope: { reportHealth: 'stale-full-tree-scan', resultsViewScope: 'platform-only' }
    });

    assert.equal(normalized.scanScope.reportHealth, 'benchmark-clone-scan');
    assert.equal(normalized.scanScope.resultsViewScope, 'benchmark-clone');
    assert.equal(normalized.scanScope.rescanRecommended, false);
    assert.equal(normalized.scanScope.inventoryMetricsStale, false);
    assert.match(normalized.scanScope.limitations[0], /github-cache/i);
    assert.ok(!normalized.inventory.note.includes('stale full-tree'));
});

const SB_BENCHMARK = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';

test('sanitizeDataCleanupReportExport fixes frozen GEE data-quality export shape', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: GEE_ROOT,
        scanProfile: 'data-quality',
        inventory: { totalFiles: 17237, note: 'stale full-tree' },
        scanScope: {
            resultsViewScope: 'platform-only',
            reportHealth: 'stale-full-tree-scan',
            rescanRecommended: true,
            limitations: ['File reduction walks exclude github-cache/']
        },
        executiveSummary: {
            profile: 'data-quality',
            workspace: { packageJsonFiles: 0 },
            notes: ['PII hits in docs — review production paths first.']
        },
        fileReductionPlan: {
            recommendations: ['Delete node_modules'],
            summaryTable: []
        },
        scannerStatistics: { scope: 'workspace' }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.exportNormalized, true);
    assert.equal(out.fileReductionPlan.omitted, true);
    assert.equal(out.scanScope.resultsViewScope, 'benchmark-clone');
    assert.match(out.executiveSummary.notes[0], /OSS benchmark clone/i);
    assert.equal(out.executiveSummary.priorityActions.length, 1);
    assert.match(out.executiveSummary.priorityActions[0].title, /package manifests/i);
});

test('sanitizeDataCleanupReportExport cleans stale simplebeacon benchmark data-quality export', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: SB_BENCHMARK,
        scanProfile: 'data-quality',
        compact: true,
        inventory: { totalFiles: 194, totalDirectories: 27 },
        summary: { totalFindings: 25, environmentFindings: 10, dataAccessFindings: 15 },
        scanners: {
            'environment-variables': { missingKeys: 10 },
            'data-access-patterns': { patternFindings: 15 }
        },
        findings: {
            environmentVariables: [{
                type: 'missing-env-key',
                severity: 'medium',
                path: '.env',
                metadata: { key: 'SIMPLEBEACON_APP_URL', references: ['src/mcp/tools.js'] }
            }],
            dataAccessPatterns: [{
                type: 'data-access-pattern',
                severity: 'medium',
                path: 'src/analyzers/data-cleanup/environment-variable-analyzer.js',
                metadata: { patternId: 'sync-read-in-iteration' }
            }]
        },
        allFindings: [
            {
                type: 'missing-env-key',
                severity: 'medium',
                path: '.env',
                metadata: { key: 'OPENAI_API_KEY', references: ['bin/simplebeacon.js'] }
            },
            {
                type: 'data-access-pattern',
                severity: 'medium',
                path: 'src/lib/snippet-scanner.js',
                metadata: { patternId: 'parse-sync-read' }
            }
        ],
        executiveSummary: {
            profile: 'data-quality',
            workspace: { packageJsonFiles: 1, missingEnvKeys: 10 },
            data: { syncIoPatterns: 15 },
            priorityActions: [
                { priority: 'high', title: 'Resolve missing environment keys', detail: '10 code references' },
                { priority: 'medium', title: 'Review sync I/O hot paths', detail: '15 synchronous filesystem access pattern(s)' }
            ],
            notes: ['PII hits in docs, reports, and sample data are common — review production paths first.']
        },
        scannerStatistics: {
            scope: 'workspace',
            scanners: {
                'environment-variables': {
                    stats: { missingKeys: 10 },
                    findings: { total: 10, missingKeys: 10 }
                },
                'data-access-patterns': {
                    stats: { patternFindings: 15 },
                    findings: { total: 15, patternIssues: 15 }
                }
            },
            findingsBreakdown: {
                environmentVariables: { total: 10, missingKeys: 10 },
                dataAccessPatterns: { total: 15, patternIssues: 15 }
            }
        }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.dataQualityStatus, 'clean');
    assert.equal(out.summary.totalFindings, 0);
    assert.equal(out.summary.environmentFindings, 0);
    assert.equal(out.summary.dataAccessFindings, 0);
    assert.equal(out.scanners['environment-variables'].missingKeys, 0);
    assert.equal(out.scanners['data-access-patterns'].patternFindings, 0);
    assert.equal(out.findings.environmentVariables.length, 0);
    assert.equal(out.findings.dataAccessPatterns.length, 0);
    assert.equal(out.executiveSummary.workspace.missingEnvKeys, 0);
    assert.equal(out.executiveSummary.data.syncIoPatterns, 0);
    assert.equal(out.executiveSummary.priorityActions.length, 0);
    assert.match(out.executiveSummary.remediationHint, /No actionable/i);
    assert.equal(out.scannerStatistics.scope, 'benchmark-clone');
});

test('sanitizeDataCleanupReportExport enriches product data-quality export like Downloads', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanProfile: 'data-quality',
        compact: true,
        inventory: { totalFiles: 950, totalDirectories: 234 },
        summary: { totalFindings: 8, estimatedReductionPct: 0.8 },
        scanners: {
            'environment-variables': { missingKeys: 6 },
            'data-access-patterns': { patternFindings: 1 }
        },
        scanScope: { resultsViewScope: 'platform-only', reportHealth: 'platform-scoped' },
        fileReductionPlan: { profile: 'data-quality', omitted: false },
        executiveSummary: { profile: 'data-quality', priorityActions: [{ title: 'Resolve missing environment keys' }] }
    };

    const out = sanitizeDataCleanupReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.dataQualityStatus, 'healthy-with-findings');
    assert.equal(out.fileReductionPlan.omitted, true);
    assert.ok(out.exportNotes.some((n) => /finding density/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /env key/i.test(n)));
    assert.equal(out.inventory.inventoryScope, 'platform-product');
    assert.match(out.executiveSummary.remediationHint, /priorityActions/i);
});

test('sanitizeDataCleanupReportExport enriches clean product data-quality export metadata', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanProfile: 'data-quality',
        compact: true,
        inventory: { totalFiles: 1060, totalDirectories: 235 },
        summary: { totalFindings: 0, estimatedReductionPct: 0 },
        enabledScanners: ['environment-variables', 'data-access-patterns', 'data-lineage', 'dependency-health'],
        scanners: {
            'environment-variables': { missingKeys: 0, envKeys: 171, referencedKeys: 219 },
            'data-access-patterns': { patternFindings: 0, sourceFilesScanned: 405 },
            'data-lineage': { dataFilesTracked: 6 },
            'dependency-health': { packageJsonFiles: 3 }
        },
        metadata: {
            dataLineage: [{
                path: 'web/data/dashboard-home-sample.json',
                consumers: [
                    'packages/simplebeacon-cli/src/project-detect.js',
                    '.github-sync/simplebeacon/src/project-detect.js'
                ]
            }]
        },
        scanScope: { resultsViewScope: 'platform-only', reportHealth: 'platform-scoped' },
        fileReductionPlan: { profile: 'data-quality', omitted: true },
        executiveSummary: { profile: 'data-quality', priorityActions: [] }
    };

    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' }
    };

    const out = sanitizeDataCleanupReportExport(raw, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.dataQualityStatus, 'clean');
    assert.equal(out.hygieneSummary?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary?.workspaceInventoryNotInGate, 625);
    assert.equal(out.hygieneSummary?.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary?.dataAccessSourceScanned, 405);
    assert.equal(out.hygieneSummary?.jestBaselineChecked, false);
    assert.equal(out.scanScope?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope?.dataQualityNote, 'Data-quality export — workspace scanner hygiene only, not vendor handoff clearance.');
    assert.equal(out.metadata.mirrorConsumersExcluded, 1);
    assert.ok(!out.metadata.dataLineage[0].consumers.some((c) => c.includes('.github-sync/')));
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /omitted from export/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Jest was not run|does not run Jest/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /No open data-quality findings/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /vendor shells/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /405 source file/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON paths/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
});

test('sanitizeDataCleanupReportExport idempotently re-sanitizes enriched data-quality export from embedded gate context', () => {
    const enriched = {
        type: 'data-cleanup-report',
        projectRoot: 'ai-platform',
        scanProfile: 'data-quality',
        compact: true,
        inventory: { totalFiles: 1060, auditRepositoryFiles: 1685 },
        summary: { totalFindings: 0, estimatedReductionPct: 0 },
        enabledScanners: ['environment-variables', 'data-lineage'],
        scanners: {
            'environment-variables': { envKeys: 171, referencedKeys: 219 },
            'data-lineage': { dataFilesTracked: 6 }
        },
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false
        },
        hygieneSummary: {
            gateRepositoryFilesTotal: 1685,
            gateMetadataOnlyFiles: 46,
            contentFilesScanned: 1639,
            gateRuleBundleProfile: 'eu-ai-act',
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            jestBaselineChecked: false
        },
        exportSanitized: true,
        exportNormalized: true,
        dataQualityStatus: 'clean'
    };
    const out = sanitizeDataCleanupReportExport(enriched, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    const out2 = sanitizeDataCleanupReportExport(out, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});

test('sanitizeDataCleanupReportExport enriches clean product file-reduction export metadata', () => {
    const raw = {
        type: 'data-cleanup-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 1060, totalDirectories: 235 },
        summary: { totalFindings: 0, estimatedReductionPct: 0, unusedFileCandidates: 0 },
        enabledScanners: ['build-artifacts', 'asset-consolidation', 'unused-files'],
        scanners: {
            'build-artifacts': { safeToDeleteBytes: 0 },
            'asset-consolidation': { duplicateGroups: 0, assetFilesScanned: 8 },
            'unused-files': { unusedCandidates: 0, sourceFilesScanned: 527, entryPoints: 73 }
        },
        metadata: { entryPoints: ['bin/simplebeacon-audit.js'] },
        fileReductionPlan: {
            profile: 'file-reduction',
            totals: { safeToDeleteBytes: 0, duplicateAssetBytes: 0, reviewBeforeDeleteBytes: 0 },
            unusedFiles: { candidates: 0 }
        },
        scanScope: { resultsViewScope: 'platform-only', reportHealth: 'platform-scoped' },
        executiveSummary: {
            profile: 'file-reduction',
            fileReduction: { reclaimableBytes: 0 },
            notes: [
                'Config, dependency, and environment scanner counts exclude node_modules.',
                'PII hits in docs, reports, and sample data are common — review production paths first.'
            ]
        }
    };

    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' }
    };

    const out = sanitizeDataCleanupReportExport(raw, {
        projectPath: raw.projectRoot,
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.fileReductionStatus, 'no-immediate-reclaim');
    assert.equal(out.dataQualityStatus, undefined);
    assert.equal(out.hygieneSummary?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary?.workspaceFilesScanned, 1060);
    assert.equal(out.hygieneSummary?.workspaceInventoryNotInGate, 625);
    assert.equal(out.hygieneSummary?.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary?.assetFilesScanned, 8);
    assert.equal(out.hygieneSummary?.jestBaselineChecked, false);
    assert.equal(out.scanScope?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary?.unusedFilesSourceScanned, 527);
    assert.equal(out.fileReductionPlan?.profile, 'file-reduction');
    assert.equal(out.inventory.auditRepositoryFiles, 1685);
    assert.ok(out.inventory.inventoryNote.includes('1,060'));
    assert.ok(out.inventory.inventoryNote.includes('1,685'));
    assert.equal(out.scanScope.fileReductionNote, 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.');
    assert.ok(out.exportNotes.some((n) => /does not run Jest/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Unused-file graph scanned 527/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /scannerStatistics data-quality shells/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /No immediate reclaimable bytes/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /8 static asset file/i.test(String(n))));
    assert.ok(!out.executiveSummary.notes.some((n) => /PII hits/i.test(String(n))));
    assert.ok(out.executiveSummary.notes.some((n) => /reclaim tiers are guidance only/i.test(String(n))));
});

test('sanitizeDataCleanupReportExport idempotently re-sanitizes enriched file-reduction export from embedded gate context', () => {
    const enriched = {
        type: 'data-cleanup-report',
        projectRoot: 'ai-platform',
        scanProfile: 'file-reduction',
        compact: true,
        inventory: { totalFiles: 1060, auditRepositoryFiles: 1685 },
        summary: { totalFindings: 0, estimatedReductionPct: 0, unusedFileCandidates: 0 },
        enabledScanners: ['build-artifacts', 'asset-consolidation', 'unused-files'],
        scanners: {
            'build-artifacts': { safeToDeleteBytes: 0 },
            'asset-consolidation': { duplicateGroups: 0, assetFilesScanned: 8 },
            'unused-files': { unusedCandidates: 0, sourceFilesScanned: 527, entryPoints: 73 }
        },
        fileReductionPlan: {
            profile: 'file-reduction',
            totals: { safeToDeleteBytes: 0, duplicateAssetBytes: 0, reviewBeforeDeleteBytes: 0 }
        },
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false,
            fileReductionNote: 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
        },
        hygieneSummary: {
            gateRepositoryFilesTotal: 1685,
            gateMetadataOnlyFiles: 46,
            contentFilesScanned: 1639,
            gateRuleBundleProfile: 'eu-ai-act',
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            jestBaselineChecked: false,
            fileReductionStatus: 'no-immediate-reclaim'
        },
        exportSanitized: true,
        exportNormalized: true,
        fileReductionStatus: 'no-immediate-reclaim'
    };
    const out = sanitizeDataCleanupReportExport(enriched, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    const out2 = sanitizeDataCleanupReportExport(out, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});
