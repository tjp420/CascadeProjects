const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    sanitizeCompleteScanExport,
    sanitizeComplianceBundleExport,
    sanitizeNpmAuditExport,
    hasHollowGateAttestation,
    isBenchmarkCacheProjectPath
} = require('../src/lib/complete-scan-export-sanitize');

test('isBenchmarkCacheProjectPath detects clone roots', () => {
    assert.equal(
        isBenchmarkCacheProjectPath('C:/repo/ai-platform/github-cache/google-earthenterprise'),
        true
    );
    assert.equal(isBenchmarkCacheProjectPath('C:/repo/ai-platform'), false);
});

test('sanitizeCompleteScanExport fixes frozen Simplebeacon benchmark complete scan export', () => {
    const SIMPLEBEACON = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : null;
    if (!raw) return;

    const out = sanitizeCompleteScanExport(raw, { projectPath: SIMPLEBEACON });

    assert.equal(out.exportNormalized, true);
    assert.equal(out.benchmarkScan, true);
    assert.equal(out.summary.simplebeaconGatePass, true);
    assert.equal(out.summary.simplebeaconIssues, 0);
    assert.equal(out.summary.complianceFailed, 0);
    assert.equal(out.results.simplebeacon?.rawIssues?.length, 0);
    assert.equal(out.results.mockScan?.nonFictionIssues?.length, 0);
    assert.equal(out.results.consolidation?.summary?.mergeCandidates, 0);
    assert.equal(out.summary.cleanupProjectedFiles, 194);
    assert.equal(out.platformRoot, 'C:/Users/Trevor/CascadeProjects/ai-platform');
    assert.equal(out.completeScanHealthStatus, 'benchmark-hygiene-pass');
});

test('sanitizeCompleteScanExport marks benchmark bundle not handoff eligible', () => {
    const bundle = sanitizeCompleteScanExport({
        type: 'simplebeacon-complete-scan',
        projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        summary: { simplebeaconGatePass: true },
        results: {
            simplebeacon: {
                gate: { pass: true },
                ruleScopedFilesAnalyzed: 0
            },
            roadmap: {
                type: 'dynamic-project-roadmap-analysis',
                sourceProjectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
                v1InternalDeploy: { deploy: 'npm run simplebeacon:deploy' },
                recommendations: {
                    immediate: ['Add docker-compose.phase2.yml smoke test to CI'],
                    shortTerm: [],
                    longTerm: []
                }
            },
            compliance: {
                summary: { passed: 6, failed: 0, readyForAutomation: true, headline: 'old' },
                rules: []
            }
        },
        completeScanAnalysis: {
            notes: ['File reduction and roadmap walks exclude github-cache/']
        }
    });

    assert.equal(bundle.summary.scanTargetProfile, 'benchmark-cache');
    assert.equal(bundle.summary.handoffEligible, false);
    assert.equal(bundle.summary.simplebeaconGateAttestation, 'limited-benchmark');
    assert.equal(bundle.results.roadmap.v1InternalDeploy, undefined);
    assert.equal(bundle.results.roadmap.benchmarkScan, true);
    assert.equal(bundle.results.compliance.summary.readyForAutomation, false);
    assert.match(bundle.completeScanAnalysis.notes[0], /OSS clone/i);
});

test('sanitizeComplianceBundleExport refreshes stale pass rows on benchmark clone', () => {
    const gateReport = {
        projectRoot: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        ruleScopedFilesAnalyzed: 0,
        credentialScanned: 0,
        productionLeakScanned: 0,
        gate: { pass: true, blockingCount: 0 }
    };
    const staleChecklist = {
        projectRoot: gateReport.projectRoot,
        rules: [
            { id: 'GATE-001', status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities' },
            { id: 'CRED-001', status: 'pass', evidence: 'Scanned 0 path(s) — no credential patterns' },
            { id: 'LEAK-001', status: 'pass', evidence: 'Scanned 0 production file(s) — no sample-path leaks' },
            { id: 'DATA-001', status: 'skip', evidence: 'No registered page samples' },
            { id: 'SUPPLY-001', status: 'pass', evidence: 'npm audit: 0 critical, 0 high (scan)' }
        ],
        summary: {
            passed: 5,
            failed: 0,
            skipped: 1,
            total: 8,
            score: 100,
            readyForAutomation: true,
            headline: '6/6 applicable rules pass — safe to enable automated AI deploy gates'
        }
    };
    const out = sanitizeComplianceBundleExport({
        projectPath: gateReport.projectRoot,
        gateReport,
        checklist: staleChecklist,
        npmAudit: { skipped: true, summary: { dependencies: null } }
    });
    const gate = out.checklist.rules.find((r) => r.id === 'GATE-001');
    const cred = out.checklist.rules.find((r) => r.id === 'CRED-001');
    assert.equal(gate.status, 'skip');
    assert.equal(cred.status, 'skip');
    assert.equal(out.checklist.summary.readyForAutomation, false);
    assert.equal(out.handoffEligible, false);
    assert.match(out.checklist.summary.headline, /Benchmark clone/i);
    assert.match(out.gateReport.scanScope.limitations[0], /benchmark clone/i);
});

test('sanitizeNpmAuditExport clears fake dependency counts when skipped on benchmark clone', () => {
    const out = sanitizeNpmAuditExport({
        projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        skipped: true,
        summary: { total: 0, dependencies: 776, critical: 0, high: 0 }
    });
    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.summary.dependencies, null);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.supplyChainStatus, 'skipped');
});

test('hasHollowGateAttestation detects pass with zero rule scope', () => {
    assert.equal(hasHollowGateAttestation({ gate: { pass: true }, ruleScopedFilesAnalyzed: 0 }), true);
    assert.equal(hasHollowGateAttestation({ gate: { pass: true }, ruleScopedFilesAnalyzed: 3 }), false);
});

test('sanitizeCompleteScanExport sanitizes embedded cleanup brief on benchmark clone', () => {
    const bundle = sanitizeCompleteScanExport({
        type: 'simplebeacon-complete-scan',
        projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
        summary: {},
        results: {
            cleanupAssistant: {
                type: 'simplebeacon-cleanup-brief',
                projectPath: 'C:/repo/ai-platform/github-cache/google-earthenterprise',
                policy: { protectedPaths: ['web/data', '.git'] },
                duplicateAssets: [{ duplicates: [], reclaimableBytes: 1000 }],
                scanAnalysis: {
                    fileReduction: {
                        duplicateAssetBytes: 1000,
                        summaryTable: [{ category: 'Duplicate assets', files: 2, bytes: 1000 }]
                    },
                    notes: ['File reduction walks exclude github-cache/']
                }
            }
        }
    });
    assert.equal(bundle.results.cleanupAssistant.handoffEligible, false);
    assert.equal(bundle.results.cleanupAssistant.duplicateAssetsSummary.reclaimableBytes, 1000);
});

test('sanitizeCompleteScanExport normalizes Simplebeacon benchmark complete-scan Downloads export', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31.json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeCompleteScanExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.benchmarkScan, true);
    assert.equal(out.scanTargetRoot, 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon');
    assert.equal(out.platformRoot, 'C:/Users/Trevor/CascadeProjects/ai-platform');
    assert.equal(out.summary.simplebeaconGatePass, true);
    assert.equal(out.summary.simplebeaconIssues, 0);
    assert.equal(out.summary.complianceFailed, 0);
    assert.equal(out.summary.cleanupProjectedFiles, 194);
    assert.equal(out.summary.cleanupProjectedFilesRaw, 949);
    assert.equal(out.results.consolidation?.summary?.mergeCandidates ?? 0, 0);
    assert.deepEqual(out.results.mockScan?.nonFictionIssues ?? [], []);
    assert.equal(out.completeScanHealthStatus, 'benchmark-hygiene-pass');
});

test('sanitizeCompleteScanExport normalizes Simplebeacon benchmark complete-scan Downloads (2)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeCompleteScanExport(raw, {
        exportFilename: 'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.summary.simplebeaconGatePass, true);
    assert.equal(out.summary.simplebeaconGateAttestation, 'benchmark-clone');
    assert.equal(out.summary.platformScope.simplebeaconGateAttestation, 'benchmark-clone');
    assert.equal(out.results.simplebeacon?.gateAttestation, 'benchmark-clone');
    assert.equal(out.summary.simplebeaconIssues, 0);
    assert.equal(out.summary.complianceFailed, 0);
    assert.equal(out.summary.roadmapFiles, 176);
    assert.equal(out.summary.cleanupProjectedFiles, 197);
    assert.equal(out.summary.cleanupProjectedFilesRaw, 239);
    assert.equal(out.hygieneSummary.roadmapMisscoped, false);
    assert.equal(out.hygieneSummary.simplebeaconGateAttestation, 'benchmark-clone');
    assert.equal(out.hygieneSummary.cleanupProjectedFilesRaw, 239);
    assert.deepEqual(out.summary.platformScope.scanPaths, []);
    assert.match(out.exportNotes[0], /Complete scan export scoped to github-cache/i);
    const jestInExport = out.exportNotes.filter((n) => /jest was not/i.test(String(n)));
    assert.equal(jestInExport.length, 0);
    assert.ok((out.summary.complianceExportNotes || []).some((n) => /jest was not/i.test(String(n))));
    assert.equal(out.completeScanHealthStatus, 'benchmark-hygiene-pass');
    assert.equal(out.completeScanAnalysis?.projectPath, 'tjp420-simplebeacon');
    assert.ok(!String(out.projectPath || '').includes('CascadeProjects'));
});

test('sanitizeCompleteScanExport normalizes Simplebeacon benchmark complete-scan Downloads (1)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeCompleteScanExport(raw, {
        exportFilename: 'complete-scan-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.summary.simplebeaconGatePass, true);
    assert.equal(out.summary.simplebeaconGateAttestation, 'benchmark-clone');
    assert.equal(out.summary.simplebeaconIssues, 0);
    assert.equal(out.summary.complianceFailed, 0);
    assert.equal(out.summary.roadmapFiles, 197);
    assert.equal(out.summary.roadmapFilesRaw, 706);
    assert.equal(out.summary.cleanupProjectedFiles, 197);
    assert.deepEqual(out.summary.platformScope.scanPaths, []);
    assert.deepEqual(out.results.simplebeacon?.scanPaths, []);
    assert.equal(out.results.simplebeacon?.llmSlopFilesScanned, 197);
    assert.equal(out.results.roadmap?.codeAnalysis?.structure?.totalFiles, 197);
    assert.equal(out.results.roadmap?.misscopedPlatformCodeWalk, true);
    assert.equal(out.hygieneSummary.roadmapMisscoped, true);
    const ossNotes = (out.completeScanAnalysis?.notes || []).filter((n) => /OSS clone under github-cache/i.test(String(n)));
    assert.equal(ossNotes.length, 1);
});

test('sanitizeCompleteScanExport reconciles complianceFailed from nested checklist bundle', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'complete-scan-c-users-trevor-cascadeprojects-ai-platform-2026-05-31(9).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeCompleteScanExport(raw, {
        exportFilename: 'complete-scan-c-users-trevor-cascadeprojects-ai-platform-2026-05-31(9).json'
    });

    assert.equal(out.summary.complianceFailed, 2);
    assert.equal(out.summary.compliancePassed, 5);
    assert.equal(out.complianceStatus, 'failed');
});

test('sanitizeCompleteScanExport redacts product bundle paths and sanitizes embedded sprint', () => {
    const raw = {
        type: 'simplebeacon-complete-scan',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {},
        results: {
            simplebeacon: {
                type: 'simplebeacon-report',
                projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
                fullDirectoryScan: true,
                mockSampleFiles: 1685,
                totalFiles: 1685,
                repositoryFilesTotal: 1685,
                ruleScopedFilesAnalyzed: 1685,
                fictionSampleFilesScanned: 6,
                gate: { pass: true, blockingCount: 0 },
                jestBaselineChecked: false,
                scanScope: {
                    fullDirectoryScan: true,
                    mockSampleFilesInScanPaths: 1685,
                    fictionSampleFilesScanned: 6,
                    jestExecutedDuringScan: false
                }
            },
            sprint: {
                ok: true,
                projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
                platformRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
                report: { type: 'simplebeacon-report', projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform', gate: { pass: true, blockingCount: 0 }, exportNotes: [] },
                complianceChecklist: { projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform', summary: { passed: 9, failed: 0, total: 9 }, rules: [] },
                assessment: { projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform' },
                artifacts: { report: 'C:/Users/Trevor/CascadeProjects/ai-platform/.simplebeacon/eu-ai-act-report.json' }
            }
        }
    };

    const out = sanitizeCompleteScanExport(raw, { projectPath: raw.projectPath });

    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.results.simplebeacon.mockSampleFiles, 6);
    assert.equal(out.results.sprint.projectPath, 'ai-platform');
    assert.equal(out.results.sprint.artifacts.report, '.simplebeacon/eu-ai-act-report.json');
    assert.ok(!JSON.stringify(out).includes('CascadeProjects'));
});

test('sanitizeCompleteScanExport enriches product bundle with gate context and nested engine gateReport', () => {
    const gateReport = {
        type: 'simplebeacon-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        issueCount: 1,
        gate: { pass: false, blockingCount: 1 },
        detectedIssues: [{ severity: 'high', type: 'production-leak', file: 'server/lib/eu-ai-act-export.js' }],
        scanScope: { profile: 'eu-ai-act', jestExecutedDuringScan: false, ruleScopedFilesAnalyzed: 1639 }
    };
    const raw = {
        type: 'simplebeacon-complete-scan',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        enginesRun: ['simplebeacon', 'npm-audit', 'roadmap'],
        summary: {
            simplebeaconGatePass: false,
            simplebeaconIssues: 1,
            complianceFailed: 2,
            compliancePassed: 6,
            euAiActIncluded: true,
            stepsCompleted: 11
        },
        results: {
            simplebeacon: gateReport,
            npmAudit: {
                type: 'simplebeacon-npm-audit',
                projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
                summary: { critical: 0, high: 0, dependencies: 776 }
            },
            roadmap: {
                type: 'dynamic-project-roadmap-analysis',
                sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
                codeAnalysis: { structure: { totalFiles: 790 } },
                coverageEvidenceSource: 'omitted-stale-prior'
            }
        }
    };

    const out = sanitizeCompleteScanExport(raw, { projectPath: raw.projectPath });
    const out2 = sanitizeCompleteScanExport(out, { projectPath: 'ai-platform' });

    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.blockingCount, 1);
    assert.equal(out.hygieneSummary?.gatePass, false);
    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.results.npmAudit?.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.results.roadmap?.hygieneSummary?.contentFilesScanned, 1639);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});
