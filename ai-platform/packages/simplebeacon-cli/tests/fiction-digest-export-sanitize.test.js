const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeFictionDigestExport } = require('../src/lib/fiction-digest-export-sanitize');

const GEE = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/google-earthenterprise';

test('sanitizeFictionDigestExport fixes frozen GEE fiction digest', () => {
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'fiction-digest-c-users-trevor-cascadeprojects-ai-platform-github-cache-google-earthenterprise-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'simplebeacon-fiction-digest',
            generatedAt: '2026-05-31T06:52:22.484Z',
            conclusion: 'No fiction KPI hits. Gate passes.',
            digestTrust: 'trustworthy',
            fictionIssues: [],
            nonFictionIssues: [
                {
                    id: 'agency-handoff-gitignore-env',
                    severity: 'medium',
                    type: 'Handoff Integrity',
                    category: 'handoff-integrity',
                    filePath: '.gitignore',
                    pattern: 'SB-HANDOFF-003'
                },
                {
                    id: 'EUAI-AI-002-docs/_posts/2019-01-24-Michael Ternerz-FOSS4G_2018.md',
                    severity: 'medium',
                    type: 'EU AI Act — AI System Indicator',
                    filePath: 'docs/_posts/2019-01-24-Michael Ternerz-FOSS4G_2018.md',
                    pattern: 'EUAI-AI-002'
                }
            ],
            sourceReport: {
                type: 'simplebeacon-report',
                gate: { pass: true, blockingCount: 0, warningCount: 2 },
                repositoryFilesTotal: 17237,
                ruleScopedFilesAnalyzed: 0,
                scanScope: { reportHealth: 'stale-full-tree-scan', resultsViewScope: 'platform-only' }
            }
        };

    const out = sanitizeFictionDigestExport(raw, {
        projectPath: GEE
    });

    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.benchmarkScan, true);
    assert.equal(out.digestTrust, 'benchmark-clone');
    assert.equal(out.nonFictionIssues.length, 0);
    assert.ok(out.conclusion.includes('github-cache'));
    assert.ok(!out.conclusion.includes('Gate passes'));
    assert.equal(out.sourceReport?.scanScope?.reportHealth, 'benchmark-clone-scan');
    assert.equal(out.sourceReport?.scanScope?.resultsViewScope, 'benchmark-clone');
    assert.equal(out.sourceReport?.gate?.warningCount, 0);
});

test('sanitizeFictionDigestExport fixes frozen Simplebeacon benchmark fiction digest', () => {
    const SIMPLEBEACON = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'fiction-digest-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'simplebeacon-fiction-digest',
            generatedAt: '2026-05-31T08:06:33.191Z',
            conclusion: '39 clone-local pattern hit(s) remain',
            digestTrust: 'benchmark-clone',
            fictionIssues: [],
            nonFictionIssues: [{
                id: 'production-leak-sample-json-src/analyzers/data-cleanup/data-lineage-analyzer.js-534',
                severity: 'high',
                type: 'Production Leak',
                filePath: 'src/analyzers/data-cleanup/data-lineage-analyzer.js',
                pattern: 'sample-json',
                metadata: { intent: 'unclassified', match: "'**/*-sample.json'" }
            }],
            sourceReport: {
                type: 'simplebeacon-report',
                projectRoot: SIMPLEBEACON,
                gate: { pass: false, blockingCount: 24, warningCount: 0 },
                rawIssues: [{
                    severity: 'high',
                    type: 'Production Leak',
                    filePath: 'src/lib/production-leak-intent.js',
                    pattern: 'web-data-sample'
                }],
                ruleScopedFilesAnalyzed: 102,
                repositoryFilesTotal: 194,
                fictionJsonFilesScanned: 10
            }
        };

    const out = sanitizeFictionDigestExport(raw, { projectPath: SIMPLEBEACON });

    assert.equal(out.exportNormalized, true);
    assert.equal(out.nonFictionIssues.length, 0);
    assert.equal(out.sourceReport?.gate?.pass, true);
    assert.equal(out.sourceReport?.gate?.blockingCount, 0);
    assert.ok(out.sourceReport?.scanScope?.benchmarkScannerMetaExcluded > 0
        || out.fictionScopeSummary?.benchmarkScannerMetaExcluded > 0);
    assert.ok(out.conclusion.includes('No actionable fiction-digest findings')
        || !out.conclusion.includes('39 clone-local'));
    assert.equal(out.platformRoot, 'ai-platform');
    assert.ok(out.exportNotes.some((n) => /scanner source/i.test(n)));
});

test('sanitizeFictionDigestExport enriches product fiction digest like Downloads', () => {
    const raw = {
        type: 'simplebeacon-fiction-digest',
        generatedAt: '2026-05-31T07:57:59.748Z',
        conclusion: 'No fiction KPI hits in 15 JSON files scanned (0 *-sample.json among them). Gate passes.',
        fictionIssues: [],
        nonFictionIssues: [],
        digestTrust: 'trustworthy',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceProjectPath: 'C:\\Users\\Trevor\\CascadeProjects\\ai-platform',
        exportSanitized: false,
        sourceReport: {
            type: 'simplebeacon-report',
            projectRoot: 'C:\\Users\\Trevor\\CascadeProjects\\ai-platform',
            gate: { pass: true, blockingCount: 0, warningCount: 0 },
            repositoryFilesTotal: 949,
            ruleScopedFilesAnalyzed: 246,
            fictionJsonFilesScanned: 15,
            scanScope: {
                jestExecutedDuringScan: false,
                mockSampleFilesInScanPaths: 3,
                fictionSampleFilesScanned: 0,
                sourceFictionPatternHits: 0,
                ruleScopedFilesAnalyzed: 246,
                resultsViewScope: 'platform-only',
                reportHealth: 'platform-scoped'
            }
        }
    };

    const out = sanitizeFictionDigestExport(raw);

    assert.equal(out.exportSanitized, true);
    assert.equal(out.exportNormalized, true);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.digestTrust, 'trustworthy');
    assert.equal(out.gateAttestation, 'platform-fiction-clean');
    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.sourceProjectPath, 'ai-platform');
    assert.ok(!out.projectPath.includes('CascadeProjects'));
    assert.ok(out.exportNotes.some((n) => /Jest was not run/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /handoff/i.test(n)));
    assert.equal(out.sourceReport.scanTargetProfile, 'product');
});

test('sanitizeFictionDigestExport reconciles full-directory mockSampleFilesInScanPaths and reportHealth', () => {
    const raw = {
        type: 'simplebeacon-fiction-digest',
        generatedAt: '2026-06-01T03:01:39.789Z',
        conclusion: 'No fiction KPI hits in 184 JSON files scanned (6 *-sample.json among them).',
        fictionIssues: [],
        nonFictionIssues: [],
        digestTrust: 'trustworthy',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceReport: {
            type: 'simplebeacon-report',
            projectRoot: 'ai-platform',
            fullDirectoryScan: true,
            gate: { pass: true, blockingCount: 0 },
            repositoryFilesTotal: 1705,
            ruleScopedFilesAnalyzed: 1705,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            scanScope: {
                fullDirectoryScan: true,
                mockSampleFilesInScanPaths: 1705,
                fictionSampleFilesScanned: 6,
                fictionJsonFilesScanned: 184,
                reportHealth: 'stale-full-tree-scan',
                rescanRecommended: true,
                jestExecutedDuringScan: false
            }
        }
    };

    const out = sanitizeFictionDigestExport(raw, { projectPath: raw.projectPath });

    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.sourceReport.scanScope.reportHealth, 'platform-scoped-full-tree');
    assert.equal(out.sourceReport.scanScope.rescanRecommended, false);
    assert.equal(out.sourceReport.scanScope.mockSampleFilesInScanPaths, 6);
    assert.equal(out.gateAttestation, 'platform-fiction-clean');
    assert.equal(out.sourceReport.gateAttestation, undefined);
    assert.ok(out.exportNotes.some((n) => /Absolute scan paths are redacted/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /reconciled from 1,705 to 6/i.test(String(n))));
});

test('sanitizeFictionDigestExport explains ancillary pattern hits and eu-ai-act profile on product export', () => {
    const raw = {
        type: 'simplebeacon-fiction-digest',
        generatedAt: '2026-06-01T04:31:03.571Z',
        conclusion: 'No fiction KPI hits in 184 JSON files scanned (6 *-sample.json among them).',
        fictionIssues: [],
        nonFictionIssues: [],
        digestTrust: 'trustworthy',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceReport: {
            type: 'simplebeacon-report',
            projectRoot: 'ai-platform',
            fullDirectoryScan: true,
            gate: { pass: true, blockingCount: 0 },
            repositoryFilesTotal: 1685,
            ruleScopedFilesAnalyzed: 1685,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            scanScope: {
                profile: 'eu-ai-act',
                fullDirectoryScan: true,
                mockSampleFilesInScanPaths: 1685,
                fictionSampleFilesScanned: 6,
                jestExecutedDuringScan: false,
                llmSlopPatternHits: 3,
                euAiActPatternHits: 57,
                fullDirectoryStats: {
                    ruleHitTotals: {
                        credentials: 0,
                        productionLeak: 4,
                        llmSlop: 3,
                        agencyHandoff: 32,
                        fictionKpi: 0,
                        euAiAct: 57
                    }
                }
            }
        }
    };

    const out = sanitizeFictionDigestExport(raw, { projectPath: raw.projectPath });

    assert.equal(out.hygieneSummary.repositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary.fictionKpiPatternHits, 0);
    assert.deepEqual(out.fictionScopeSummary.ancillaryPatternHits.agencyHandoff, 32);
    assert.equal(out.sourceReport.exportSanitized, true);
    assert.ok(out.sourceReport.scanScope.fictionDigestProfileNote.includes('eu-ai-act'));
    assert.ok(out.exportNotes.some((n) => /ancillary pattern hit/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /ruleHitTotals/i.test(String(n))));
});

test('sanitizeFictionDigestExport enriches Desktop operator fiction digest with gate context', () => {
    const raw = {
        type: 'simplebeacon-fiction-digest',
        generatedAt: '2026-06-01T05:03:44.426Z',
        conclusion: 'No fiction KPI hits in 184 JSON files scanned (6 *-sample.json among them).',
        fictionIssues: [],
        nonFictionIssues: [],
        digestTrust: 'trustworthy',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceReport: {
            type: 'simplebeacon-report',
            projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            fullDirectoryScan: true,
            gate: { pass: true, blockingCount: 0 },
            repositoryFilesTotal: 1685,
            ruleScopedFilesAnalyzed: 1685,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            credentialScanned: 1639,
            scanScope: {
                profile: 'eu-ai-act',
                fullDirectoryScan: true,
                mockSampleFilesInScanPaths: 6,
                mockSampleFilesReconciledNote: 'mockSampleFilesInScanPaths reconciled from 1,685 to 6 — full-directory scan counts repo-wide paths, not *-sample.json only.',
                sourceCodeFilesScanned: 1639,
                jestExecutedDuringScan: false,
                reportHealth: 'platform-scoped-full-tree',
                fullDirectoryStats: {
                    contentScanned: 1639,
                    ruleHitTotals: {
                        credentials: 0,
                        productionLeak: 4,
                        llmSlop: 3,
                        agencyHandoff: 32,
                        fictionKpi: 0,
                        euAiAct: 57
                    }
                }
            }
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

    const out = sanitizeFictionDigestExport(raw, {
        projectPath: raw.projectPath,
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.hygieneSummary.metadataOnlyInventoryFiles, 46);
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.scanScope?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.scanScope?.fullDirectoryScan, true);
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON path\(s\) plus 1,639 source file/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /ancillary pattern hit/i.test(String(n))));
});

test('sanitizeFictionDigestExport reports correct blockingCount when gate fails with ancillary hits', () => {
    const raw = {
        type: 'simplebeacon-fiction-digest',
        conclusion: 'No fiction KPI hits in 184 JSON files scanned (6 *-sample.json among them).',
        fictionIssues: [],
        nonFictionIssues: [{
            severity: 'high',
            type: 'Production Leak',
            count: 1,
            file: 'server/lib/eu-ai-act-export.js'
        }],
        digestTrust: 'trustworthy',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        sourceReport: {
            type: 'simplebeacon-report',
            projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            fullDirectoryScan: true,
            gate: { pass: false, blockingCount: 1 },
            repositoryFilesTotal: 1685,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            detectedIssues: [{
                severity: 'high',
                severityBand: 'high',
                type: 'Production Leak',
                count: 1,
                file: 'server/lib/eu-ai-act-export.js'
            }],
            scanScope: {
                profile: 'eu-ai-act',
                fullDirectoryScan: true,
                sourceCodeFilesScanned: 1639,
                jestExecutedDuringScan: false,
                fullDirectoryStats: {
                    contentScanned: 1639,
                    ruleHitTotals: {
                        credentials: 0,
                        productionLeak: 5,
                        llmSlop: 3,
                        agencyHandoff: 32,
                        fictionKpi: 0,
                        euAiAct: 57
                    }
                }
            }
        }
    };

    const out = sanitizeFictionDigestExport(raw, { projectPath: raw.projectPath });

    assert.equal(out.hygieneSummary.gatePass, false);
    assert.equal(out.hygieneSummary.blockingCount, 1);
    assert.equal(out.gateAttestation, 'fiction-review-required');
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking finding/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /gate blockingCount 1 on configured severities/i.test(String(n))));
    assert.ok(!out.exportNotes.some((n) => /gate blockingCount 0 on configured severities/i.test(String(n))));
});

test('sanitizeFictionDigestExport idempotently re-sanitizes enriched operator export from embedded gate context', () => {
    const enriched = {
        type: 'simplebeacon-fiction-digest',
        projectPath: 'ai-platform',
        digestTrust: 'trustworthy',
        fictionIssues: [],
        nonFictionIssues: [],
        hygieneSummary: {
            gateRepositoryFilesTotal: 1685,
            contentFilesScanned: 1639,
            gateRuleBundleProfile: 'eu-ai-act',
            jestBaselineChecked: false
        },
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false
        },
        sourceReport: {
            type: 'simplebeacon-report',
            scanScope: { profile: 'eu-ai-act' }
        },
        exportSanitized: true,
        exportNormalized: true
    };
    const out = sanitizeFictionDigestExport(enriched, { projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });
    const out2 = sanitizeFictionDigestExport(out, { projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});

test('sanitizeFictionDigestExport normalizes clone-scoped benchmark fiction digest Downloads export (4)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'fiction-digest-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(4).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeFictionDigestExport(raw, {
        exportFilename: 'fiction-digest-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(4).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.misscopedPlatformCodeWalk, undefined);
    assert.equal(out.gateAttestation, 'benchmark-clone');
    assert.equal(out.fictionScopeSummary.repositoryFilesTotal, 197);
    assert.equal(out.fictionScopeSummary.llmSlopFilesScanned, 197);
    assert.equal(out.fictionScopeSummary.llmSlopScanReconciledFrom, 219);
    assert.equal(out.sourceReport?.scanScope?.llmSlopScanRaw, undefined);
    assert.ok(out.sourceReport?.scanScope?.llmSlopReconciliationNote);
    assert.equal(out.exportNotes.filter((note) => /agency-handoff/i.test(note)).length, 1);
    assert.ok(out.exportNotes.some((note) => /LLM slop file count reconciled/i.test(note)));
    const out2 = sanitizeFictionDigestExport(out, {
        exportFilename: 'fiction-digest-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(4).json'
    });
    assert.equal(out2.exportNotes.length, out.exportNotes.length);
});

test('dedupeFictionDigestExportNotes collapses near-duplicate benchmark export notes', () => {
    const { dedupeFictionDigestExportNotes } = require('../src/lib/fiction-digest-export-sanitize');
    const notes = [
        'Agency-handoff and EU AI Act blog matches removed from fiction digest for github-cache/ benchmark target.',
        'Gate pass on clone does not imply Simplebeacon product handoff readiness.',
        'Gate pass on clone does not imply Simplebeacon product handoff readiness.'
    ];
    const out = dedupeFictionDigestExportNotes(notes);
    assert.equal(out.length, 2);
});
