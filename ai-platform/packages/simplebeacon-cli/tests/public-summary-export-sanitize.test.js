const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizePublicSummaryArtifactExport } = require('../src/lib/public-summary-export-sanitize');

test('sanitizePublicSummaryArtifactExport flattens nested summary.summary export bug', () => {
    const raw = {
        type: 'simplebeacon-public-summary',
        generatedAt: '2026-06-01T03:02:07.847Z',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            summary: {
                filesScanned: 1705,
                status: 'PASS',
                totalIssuesFound: 0,
                gatePass: true,
                qualityScore: 100,
                codeHealth: null
            },
            severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
            publicGateLocked: true,
            issues: []
        },
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        publicGateLocked: true
    };

    const out = sanitizePublicSummaryArtifactExport(raw, {
        projectPath: raw.projectPath,
        gateReport: { ruleScopedFilesAnalyzed: 1705, repositoryFilesTotal: 1705 }
    });

    assert.equal(out.projectPath, 'ai-platform');
    assert.equal(out.summary.filesScanned, 1705);
    assert.equal(out.summary.summary, undefined);
    assert.equal(out.exportNormalized, true);
    assert.equal(out.exportSanitized, true);
    assert.equal(out.securityHandoffEligible, false);
    assert.ok(out.exportNotes.some((n) => /Public-tier export/i.test(String(n))));
});

test('sanitizePublicSummaryArtifactExport notes inventory vs rule-scoped mismatch', () => {
    const out = sanitizePublicSummaryArtifactExport({
        type: 'simplebeacon-public-summary',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            filesScanned: 1705,
            status: 'PASS',
            gatePass: true,
            totalIssuesFound: 0
        },
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }
    }, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport: { ruleScopedFilesAnalyzed: 196, repositoryFilesTotal: 860 }
    });

    assert.ok(out.exportNotes.some((n) => /filesScanned \(1,705\).*196 scoped/i.test(String(n))));
});

test('sanitizePublicSummaryArtifactExport notes full-directory fiction sample scope', () => {
    const out = sanitizePublicSummaryArtifactExport({
        type: 'simplebeacon-public-summary',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            filesScanned: 1685,
            status: 'PASS',
            gatePass: true,
            totalIssuesFound: 0,
            qualityScore: 100
        },
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }
    }, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport: {
            repositoryFilesTotal: 1685,
            fullDirectoryScan: true,
            ruleScopedFilesAnalyzed: 1685,
            fictionSampleFilesScanned: 6,
            fictionJsonFilesScanned: 184,
            credentialScanned: 1639,
            jestBaselineChecked: false,
            scanScope: { reportHealth: 'platform-scoped-full-tree', profile: 'eu-ai-act' }
        },
        repositoryFilesTotal: 1685
    });

    assert.equal(out.exportSanitized, true);
    assert.equal(out.hygieneSummary?.filesScanned, 1685);
    assert.equal(out.hygieneSummary?.fictionJsonFilesScanned, 184);
    assert.equal(out.hygieneSummary?.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary?.fullDirectoryScan, true);
    assert.equal(out.hygieneSummary?.jestBaselineChecked, false);
    assert.equal(out.scanScope?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope?.fullDirectoryScan, true);
    assert.equal(out.scanScope?.resultsViewScope, 'public-tier-gate-summary');
    assert.ok(out.exportNotes.some((n) => /fiction KPI rules matched 6/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /46 binary\/metadata-only/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /eu-ai-act/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Jest was not run/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Full-tree scan/i.test(String(n))));
});

test('sanitizePublicSummaryArtifactExport enriches gate FAIL public summary with blocking context', () => {
    const out = sanitizePublicSummaryArtifactExport({
        type: 'simplebeacon-public-summary',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            filesScanned: 1685,
            status: 'FAIL',
            gatePass: false,
            totalIssuesFound: 1,
            qualityScore: 94
        },
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 }
    }, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gateReport: {
            repositoryFilesTotal: 1685,
            fullDirectoryScan: true,
            ruleScopedFilesAnalyzed: 1685,
            fictionSampleFilesScanned: 6,
            fictionJsonFilesScanned: 184,
            credentialScanned: 1639,
            jestBaselineChecked: false,
            issueCount: 1,
            gate: { pass: false, blockingCount: 1 },
            scanScope: { reportHealth: 'platform-scoped-full-tree', profile: 'eu-ai-act' }
        },
        repositoryFilesTotal: 1685
    });

    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.blockingCount, 1);
    assert.equal(out.hygieneSummary.gatePass, false);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
});

test('sanitizePublicSummaryArtifactExport idempotently re-sanitizes enriched public summary from embedded gate context', () => {
    const enriched = {
        type: 'simplebeacon-public-summary',
        projectPath: 'ai-platform',
        summary: {
            filesScanned: 1685,
            status: 'FAIL',
            gatePass: false,
            totalIssuesFound: 1,
            qualityScore: 94
        },
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            fullDirectoryScan: true,
            securityHandoffEligible: false
        },
        hygieneSummary: {
            filesScanned: 1685,
            gatePass: false,
            blockingCount: 1,
            gateRepositoryFilesTotal: 1685,
            contentFilesScanned: 1639,
            gateMetadataOnlyFiles: 46,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            gateRuleBundleProfile: 'eu-ai-act',
            fullDirectoryScan: true,
            jestBaselineChecked: false
        },
        exportSanitized: true
    };
    const out = sanitizePublicSummaryArtifactExport(enriched, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    const out2 = sanitizePublicSummaryArtifactExport(out, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});
