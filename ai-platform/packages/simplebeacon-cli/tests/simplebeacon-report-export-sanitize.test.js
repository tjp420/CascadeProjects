const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeSimplebeaconReportExport } = require('../src/lib/simplebeacon-report-export-sanitize');

test('sanitizeSimplebeaconReportExport fixes frozen Simplebeacon benchmark gate export', () => {
    const SIMPLEBEACON = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'simplebeacon-report',
            projectRoot: SIMPLEBEACON,
            gate: { pass: false, blockingCount: 39, warningCount: 0, failOn: ['high'], warnOn: ['medium', 'low'] },
            issueCount: 39,
            productionLeakFindings: 39,
            rawIssues: [{
                severity: 'high',
                type: 'Production Leak',
                filePath: 'src/lib/production-leak-intent.js',
                pattern: 'sample-json'
            }],
            detectedIssues: [],
            ruleScopedFilesAnalyzed: 102,
            repositoryFilesTotal: 194
        };

    const out = sanitizeSimplebeaconReportExport(raw, { projectPath: SIMPLEBEACON });

    assert.equal(out.exportNormalized, true);
    assert.equal(out.gate.pass, true);
    assert.equal(out.gate.blockingCount, 0);
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.productionLeakFindings, 0);
    assert.equal(out.platformRoot, 'ai-platform');
    assert.equal(out.gateHealthStatus, 'benchmark-clone-pass');
    assert.ok((out.scanScope?.benchmarkCloneNoiseExcluded ?? 0) > 0
        || (out.benchmarkCloneNoiseIssues?.length ?? 0) > 0);
    assert.ok(out.exportNotes.some((n) => /scanner-source|rule engine/i.test(String(n))));
});

test('sanitizeSimplebeaconReportExport normalizes frozen Simplebeacon benchmark gate Downloads (1)', () => {
    const fixturePath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        exportFilename: 'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.gateHealthStatus, 'benchmark-clone-pass');
    assert.equal(out.gate.pass, true);
    assert.equal(out.gate.blockingCount, 0);
    assert.deepEqual(out.scanPaths, []);
    assert.ok(out.scanPathsNote);
    assert.equal(out.llmSlopFilesScanned, 197);
    assert.equal(out.llmSlopScanRaw, undefined);
    assert.equal(out.hygieneSummary.llmSlopScanReconciledFrom, 219);
    assert.equal(out.hygieneSummary.mockSampleFiles, 0);
    assert.ok(out.scanScope.limitations.some((line) => /server\/, packages\//.test(String(line))));
    const scopeNotes = (out.exportNotes || []).filter((n) => /Gate export scoped to github-cache/i.test(String(n)));
    assert.equal(scopeNotes.length, 1);
    assert.ok(out.exportNotes.some((n) => /mock\/sample scan paths/i.test(String(n))));
});

test('sanitizeSimplebeaconReportExport fixes frozen ai-platform gate export', () => {
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'simplebeacon-report',
            projectRoot: 'C:\\Users\\Trevor\\CascadeProjects\\ai-platform',
            configPath: 'C:\\Users\\Trevor\\CascadeProjects\\ai-platform\\.simplebeacon\\config.json',
            scanPaths: [
                'C:\\Users\\Trevor\\CascadeProjects\\ai-platform\\data\\mock',
                'C:\\Users\\Trevor\\CascadeProjects\\ai-platform\\tests\\fixtures',
                'C:\\Users\\Trevor\\CascadeProjects\\ai-platform\\data'
            ],
            mockSampleFiles: 3,
            totalFiles: 3,
            ruleScopedFilesAnalyzed: 246,
            repositoryFilesTotal: 949,
            filesAnalyzed: 949,
            gate: { pass: true, blockingCount: 0, warningCount: 0 },
            issueCount: 0,
            qualityScore: 100,
            fictionSampleFilesScanned: 0,
            jestBaselineChecked: false,
            scanScope: { jestExecutedDuringScan: false, fictionSampleFilesScanned: 0 },
            sanitized: true,
            exportNotes: []
        };

    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });

    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportNormalized, true);
    assert.equal(out.exportSanitized, true);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.gateHealthStatus, 'clean-gate-pass');
    assert.equal(out.gateAttestation, 'platform-gate-pass');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.rawIssues, undefined);
    assert.deepEqual(out.scanPaths, ['data/mock', 'tests/fixtures', 'data']);
    assert.equal(out.configPath, '.simplebeacon/config.json');
    assert.ok(out.exportNotes.length > 0);
    assert.ok(out.exportNotes.some((n) => /Jest was not run/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /handoff/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /filesAnalyzed/i.test(n)));
    assert.ok(Array.isArray(out.disclaimers));
    assert.equal(out.scanScope.securityHandoffEligible, false);
    assert.equal(out.scanTargetRoot, 'ai-platform');
    assert.equal(out.jestBaselinePassed, null);
    assert.equal(out.hygieneSummary.jestBaselinePassed, null);
    assert.ok(!out.exportNotes.some((n) => /3 in typical cascade profile/i.test(String(n))));
});

test('sanitizeSimplebeaconReportExport strips rawIssues and notes gate failure', () => {
    const out = sanitizeSimplebeaconReportExport({
        type: 'simplebeacon-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        gate: { pass: false, blockingCount: 2, warningCount: 0 },
        issueCount: 2,
        qualityScore: 88,
        rawIssues: [{ severity: 'high', type: 'Fictional KPI', filePath: 'data/foo.json' }],
        detectedIssues: [{ severity: 'high', type: 'Fictional KPI', file: 'data/foo.json' }],
        repositoryInventory: { projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform', totalFiles: 992 },
        scanScope: { ruleScopedFilesAnalyzed: 257 }
    }, { projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.detectedIssues.length, 1);
    assert.equal(out.gateHealthStatus, 'needs-attention');
    assert.ok(out.exportNotes.some((n) => /Gate FAIL/i.test(n)));
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (9)', () => {
    const fixturePath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'simplebeacon-report-2026-05-31(9).json'
    );
    const jFixturePath = 'J:/Downloads/simplebeacon-report-2026-05-31(9).json';
    const resolved = fs.existsSync(fixturePath)
        ? fixturePath
        : (fs.existsSync(jFixturePath) ? jFixturePath : null);
    if (!resolved) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(9).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.sampleFiles, undefined);
    assert.ok(Array.isArray(out.disclaimers) && out.disclaimers.length >= 3);
    assert.equal(out.hygieneSummary.gateFailureNote, 'Gate FAIL — 5 blocking finding(s). Review detectedIssues before merge.');
    assert.equal(out.hygieneSummary.jestScanSummary, '142/145');
    assert.equal(out.hygieneSummary.jestBaselinePassed, false);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Jest reported 3 failure/i.test(String(n))));
    assert.ok(out.detectedIssues.length >= 2);
});

test('sanitizeSimplebeaconReportExport normalizes clone-scoped benchmark gate Downloads export (2)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        exportFilename: 'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.gateHealthStatus, 'benchmark-clone-pass');
    assert.equal(out.title, 'OSS Clone Gate Scan (github-cache benchmark)');
    assert.equal(out.llmSlopScanRaw, undefined);
    assert.equal(out.llmSlopFilesScanned, 197);
    assert.equal(out.scanScope.llmSlopScanRaw, undefined);
    assert.ok(out.scanScope.llmSlopReconciliationNote);
    assert.equal(out.hygieneSummary.llmSlopScanReconciledFrom, 219);
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 10);
    assert.equal(out.totalSizeLabel, null);
    assert.equal(out.inventorySizeOmitted, true);
    assert.deepEqual(out.scanPaths, []);
    assert.equal(out.platformRoot, 'ai-platform');
    assert.equal(out.scanTargetRoot, 'tjp420-simplebeacon');
    assert.equal(out.productPlatformRoot, 'ai-platform');
    const out2 = sanitizeSimplebeaconReportExport(out, {
        exportFilename: 'simplebeacon-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    });
    assert.equal(out2.exportVersion, out.exportVersion);
    assert.equal(out2.projectRoot, out.projectRoot);
    assert.equal(out2.platformRoot, out.platformRoot);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});

test('sanitizeSimplebeaconReportExport normalizes frozen benchmark gate export (10)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(10).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(10).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, true);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.projectRoot, 'tjp420-simplebeacon');
    assert.equal(out.scanTargetRoot, 'tjp420-simplebeacon');
    assert.equal(out.platformRoot, 'ai-platform');
    assert.equal(out.productPlatformRoot, 'ai-platform');
    assert.equal(out.repositoryInventory.projectRoot, 'tjp420-simplebeacon');
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.sampleFiles, undefined);
    assert.equal(out.llmSlopScanRaw, undefined);
    assert.equal(out.scanScope.llmSlopScanRaw, undefined);
    assert.equal(out.hygieneSummary.llmSlopScanReconciledFrom, 219);
    assert.equal(out.totalSizeLabel, null);
    assert.equal(out.inventorySizeOmitted, true);
    assert.ok(out.totalFilesNote);
    assert.ok(Array.isArray(out.disclaimers) && out.disclaimers.length >= 3);
    assert.equal(out.gateAttestation, 'benchmark-clone');
    assert.equal(out.gateHealthStatus, 'benchmark-clone-pass');
    assert.equal(out.title, 'OSS Clone Gate Scan (github-cache benchmark)');
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (11)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(11).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(11).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.title, 'SimpleBeacon Platform Gate Scan');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.gateHealthStatus, 'clean-gate-pass');
    assert.equal(out.gateAttestation, 'platform-gate-pass');
    assert.equal(out.gate.pass, true);
    assert.equal(out.gate.blockingCount, 0);
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.llmSlopScanRaw, undefined);
    assert.equal(out.hygieneSummary.jestScanSummary, '159/159');
    assert.equal(out.hygieneSummary.jestTests, '159/159');
    assert.equal(out.hygieneSummary.jestBaselinePassed, true);
    assert.equal(out.hygieneSummary.mockSampleFiles, 3);
    assert.equal(out.hygieneSummary.repositoryFilesTotal, 997);
    assert.ok(out.totalSizeNote);
    assert.deepEqual(out.scanPaths, ['data/mock', 'tests/fixtures', 'data']);

    const out2 = sanitizeSimplebeaconReportExport(out, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(11).json'
    });
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.equal(out2.title, out.title);
    assert.equal(out2.totalSizeNote, out.totalSizeNote);
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (12)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(12).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(12).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.title, 'SimpleBeacon Platform Gate Scan');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.gateHealthStatus, 'clean-gate-pass');
    assert.equal(out.gateAttestation, 'platform-gate-pass');
    assert.equal(out.gate.pass, true);
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.hygieneSummary.jestScanSummary, '167/167');
    assert.equal(out.hygieneSummary.jestBaselinePassed, true);
    assert.equal(out.euAiActSummary.simplebeaconArtifactCount, 17);
    assert.equal(out.euAiActSummary.operatorDocumentationCount, 12);
    assert.equal(out.euAiActSummary.scanMatchedNonDocsCount, 4);
    assert.ok(out.euAiActSummary.operatorDocumentationFound.every((p) => String(p).startsWith('docs/')));
    assert.ok(Array.isArray(out.euAiActSummary.operatorDocumentationFound));
    assert.ok(out.exportNotes.every((n) => !/\bSimplebeacon\b/.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /SimpleBeacon vendor/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /\.simplebeacon\/ are scan artifacts/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /outside docs\//i.test(String(n))));
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (13)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(13).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(13).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.title, 'SimpleBeacon Platform Gate Scan');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.gateHealthStatus, 'clean-gate-pass');
    assert.equal(out.gateAttestation, 'platform-gate-pass');
    assert.equal(out.gate.pass, true);
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.benchmarkCloneNoiseIssues, undefined);
    assert.equal(out.hygieneSummary.jestScanSummary, '201/201');
    assert.equal(out.hygieneSummary.jestBaselinePassed, true);
    assert.equal(out.euAiActSummary.operatorDocumentationCount, 12);
    assert.equal(out.euAiActSummary.scanMatchedNonDocsCount, 4);
    assert.deepEqual(out.euAiActSummary.scanMatchedNonDocsPaths, [
        '.env.example',
        'package.json',
        'pdf-export.html',
        'simplebeacon-server.js'
    ]);
    assert.ok(out.euAiActSummary.operatorDocumentationFound.every((p) => String(p).startsWith('docs/')));
    assert.equal(out.euAiActSummary.simplebeaconArtifactCount, 17);
    assert.ok(out.exportNotes.some((n) => /outside docs\//i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /\.simplebeacon\/ are scan artifacts/i.test(String(n))));

    const out2 = sanitizeSimplebeaconReportExport(out, {
        projectPath: out.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(13).json'
    });
    assert.deepEqual(out2.exportNotes, out.exportNotes);
    assert.equal(out2.euAiActSummary.operatorDocumentationCount, 12);
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (14)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(14).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(14).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.title, 'SimpleBeacon Platform Gate Scan');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.gateHealthStatus, 'clean-gate-pass');
    assert.equal(out.gateAttestation, 'platform-gate-pass');
    assert.equal(out.gate.pass, true);
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.benchmarkCloneNoiseIssues, undefined);
    assert.equal(out.hygieneSummary.jestScanSummary, '201/201');
    assert.equal(out.hygieneSummary.jestBaselinePassed, true);
    assert.equal(out.euAiActSummary.operatorDocumentationCount, 12);
    assert.equal(out.euAiActSummary.scanMatchedNonDocsCount, 4);
    assert.deepEqual(out.euAiActSummary.scanMatchedNonDocsPaths, [
        '.env.example',
        'package.json',
        'pdf-export.html',
        'simplebeacon-server.js'
    ]);
    assert.ok(out.euAiActSummary.operatorDocumentationFound.every((p) => String(p).startsWith('docs/')));
    assert.equal(out.euAiActSummary.simplebeaconArtifactCount, 17);
    assert.ok(out.exportNotes.some((n) => /outside docs\//i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /\.simplebeacon\/ are scan artifacts/i.test(String(n))));

    const out2 = sanitizeSimplebeaconReportExport(out, {
        projectPath: out.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(14).json'
    });
    assert.deepEqual(out2.exportNotes, out.exportNotes);
    assert.equal(out2.euAiActSummary.operatorDocumentationCount, 12);
    assert.equal(out2.euAiActSummary.scanMatchedNonDocsCount, 4);
});

test('sanitizeSimplebeaconReportExport normalizes frozen ai-platform gate export (15)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-report-2026-05-31(15).json');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeSimplebeaconReportExport(raw, {
        projectPath: raw.projectRoot,
        exportFilename: 'simplebeacon-report-2026-05-31(15).json'
    });

    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.benchmarkScan, false);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.title, 'SimpleBeacon Platform Gate Scan');
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.rawIssues, undefined);
    assert.equal(out.gate.warningCount, 0);
    assert.equal(out.gate.blockingCount, 4);
    assert.equal(out.gateHealthStatus, 'needs-attention');
    assert.equal(out.euAiActSummary.operatorDocumentationCount, 12);
    assert.equal(out.euAiActSummary.scanMatchedNonDocsCount, 4);
    assert.deepEqual(out.euAiActSummary.scanMatchedNonDocsPaths, [
        '.env.example',
        'package.json',
        'pdf-export.html',
        'simplebeacon-server.js'
    ]);
    assert.ok(out.euAiActSummary.operatorDocumentationFound.every((p) => String(p).startsWith('docs/')));
    assert.equal(out.euAiActSummary.simplebeaconArtifactCount, 19);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /outside docs\//i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /\.simplebeacon\/ are scan artifacts/i.test(String(n))));
});

test('sanitizeSimplebeaconReportExport reconciles full-directory mockSampleFiles to fiction samples', () => {
    const raw = {
        type: 'simplebeacon-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        fullDirectoryScan: true,
        mockSampleFiles: 1685,
        totalFiles: 1685,
        filesAnalyzed: 1685,
        repositoryFilesTotal: 1685,
        ruleScopedFilesAnalyzed: 1685,
        totalSizeLabel: '22.9MB',
        fictionSampleFilesScanned: 6,
        gate: { pass: true, blockingCount: 0, warningCount: 0 },
        jestBaselineChecked: false,
        scanScope: {
            fullDirectoryScan: true,
            mockSampleFilesInScanPaths: 1685,
            fictionSampleFilesScanned: 6,
            jestExecutedDuringScan: false
        }
    };

    const out = sanitizeSimplebeaconReportExport(raw, { projectPath: raw.projectRoot });

    assert.equal(out.mockSampleFiles, 6);
    assert.equal(out.hygieneSummary.mockSampleFiles, 6);
    assert.equal(out.scanScope.mockSampleFilesInScanPaths, 6);
    assert.equal(out.scanScope.reportHealth, 'platform-scoped-full-tree');
    assert.ok(out.exportNotes.some((n) => /reconciled from 1,685 to 6/i.test(String(n))));
    assert.ok(!out.exportNotes.some((n) => /mock-path JSON count is mockSampleFiles \(1,685\)/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Full-tree scan/i.test(String(n))));
    assert.match(out.totalSizeNote, /full-tree repository inventory/i);
});

test('sanitizeSimplebeaconReportExport enriches operator full-tree gate like Desktop export', () => {
    const raw = {
        type: 'simplebeacon-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        fullDirectoryScan: true,
        mockSampleFiles: 6,
        totalFiles: 1685,
        repositoryFilesTotal: 1685,
        ruleScopedFilesAnalyzed: 1685,
        credentialScanned: 1639,
        productionLeakScanned: 1639,
        productionLeakFindings: 0,
        productionLeakSuppressedIntent: 0,
        llmSlopPatternHits: 3,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        gate: { pass: true, blockingCount: 0, warningCount: 0 },
        euAiActSummary: {
            documentationFound: ['docs/eu-ai-act-compliance.md', 'package.json'],
            scanMatchedNonDocsPaths: ['package.json'],
            scanMatchedNonDocsCount: 1
        },
        scanScope: {
            profile: 'eu-ai-act',
            fullDirectoryScan: true,
            mockSampleFilesInScanPaths: 6,
            mockSampleFilesReconciledNote: 'mockSampleFilesInScanPaths reconciled from 1,685 to 6 — full-directory scan counts repo-wide paths, not *-sample.json only.',
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            productionDirsScanned: 1639,
            llmSlopPatternHits: 3,
            jestExecutedDuringScan: false,
            fullDirectoryStats: {
                contentScanned: 1639,
                ruleHitTotals: { productionLeak: 4, llmSlop: 3 }
            }
        }
    };

    const out = sanitizeSimplebeaconReportExport(raw, { projectPath: raw.projectRoot });

    assert.equal(out.hygieneSummary.credentialScanned, 1639);
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.equal(out.hygieneSummary.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.equal(out.hygieneSummary.llmSlopPatternHits, 3);
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.scanScope.gateRuleBundleProfile, 'eu-ai-act');
    assert.ok(out.exportNotes.some((n) => /1,639 production-path/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /46 binary\/metadata-only/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /184 repository JSON/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /LLM-slop pattern match/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /production-leak pattern hit/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /eu-ai-act-sprint\.json/i.test(String(n))));
});
