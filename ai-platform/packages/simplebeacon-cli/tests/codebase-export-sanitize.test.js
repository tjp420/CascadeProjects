const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resolveCompleteScanTargetPath } = require('../src/lib/complete-scan-target-path');
const {
    sanitizeCodebaseReportExport,
    resolveCodebaseExportContext
} = require('../src/lib/codebase-export-sanitize');

const GEE = 'C:/repo/ai-platform/github-cache/google-earthenterprise';
const BENCHMARK = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
const PLATFORM = 'C:/Users/Trevor/CascadeProjects/ai-platform';

test('resolveCompleteScanTargetPath keeps github-cache clone scope', () => {
    const priorSteps = [{
        id: 'simplebeacon',
        report: { platformRoot: PLATFORM, projectRoot: BENCHMARK }
    }];
    assert.equal(
        resolveCompleteScanTargetPath(BENCHMARK, priorSteps),
        BENCHMARK
    );
});

test('resolveCompleteScanTargetPath still redirects monorepo parent to platform root', () => {
    const parent = 'C:/Users/Trevor/CascadeProjects';
    const priorSteps = [{
        id: 'simplebeacon',
        report: { platformRoot: PLATFORM, projectRoot: parent }
    }];
    assert.equal(
        resolveCompleteScanTargetPath(parent, priorSteps).replace(/\\/g, '/'),
        PLATFORM
    );
});

test('resolveCompleteScanTargetPath keeps external benchmark clone when report has relative platformRoot', () => {
    const externalGee = 'C:/Users/Trevor/CascadeProjects_BACKUP_20260521/google-earthenterprise';
    const priorSteps = [{
        id: 'simplebeacon',
        report: {
            benchmarkScan: true,
            platformRoot: 'ai-platform',
            projectRoot: 'google-earthenterprise',
            scanTargetRoot: externalGee
        }
    }];
    assert.equal(
        resolveCompleteScanTargetPath(externalGee, priorSteps),
        externalGee
    );
});

test('resolveCompleteScanTargetPath does not redirect isolated clone to relative platform label', () => {
    const externalGee = 'C:/Users/Trevor/CascadeProjects_BACKUP_20260521/google-earthenterprise';
    const priorSteps = [{
        id: 'simplebeacon',
        report: {
            platformRoot: 'ai-platform',
            projectRoot: externalGee,
            scanTargetRoot: externalGee
        }
    }];
    assert.equal(
        resolveCompleteScanTargetPath(externalGee, priorSteps),
        externalGee
    );
});

test('sanitizeCodebaseReportExport fixes frozen GEE codebase export metadata', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: GEE,
        summary: {
            healthScore: 90,
            findingsTotal: 3581,
            tierCounts: { production: 2957, documentation: 1, general: 623 },
            eslintSource: 'none'
        },
        scanScope: {
            limitations: [
                'Complete scan: deep content analysis on all 5,967 discovered code-like files.',
                'ESLint ran on server, packages, web/scripts, web/components, web/simplebeacon-dashboard/js, src under the platform root when available.'
            ]
        },
        aiSummary: 'Health score 90% for Google Earth Enterprise.'
    };

    const out = sanitizeCodebaseReportExport(raw);

    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.summary.codebaseHealthAttestation, 'benchmark-hygiene');
    assert.equal(out.summary.tierCountsExport.mergeRiskHeuristic, 2957);
    assert.match(out.scanScope.limitations[0], /benchmark clone/i);
    assert.ok(!out.scanScope.limitations.some((l) => /ESLint ran on server, packages/i.test(l)));
    assert.ok(out.scanScope.limitations.some((l) => /ESLint did not run/i.test(l)));
    assert.match(out.aiSummary, /Benchmark clone/i);
});

test('sanitizeCodebaseReportExport cleans stale simplebeacon benchmark codebase export', () => {
    const SB = BENCHMARK;
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: SB,
        summary: {
            healthScore: 96,
            findingsTotal: 3,
            findingsReturned: 3,
            codeFilesAnalyzed: 188,
            eslintSource: 'none',
            severityCounts: { high: 0, medium: 2, low: 1 },
            tierCounts: { production: 2, documentation: 1, general: 0 },
            categoryCounts: { 'tech-debt': 2, 'meaningless-data': 1 }
        },
        findings: [
            {
                category: 'tech-debt',
                type: 'todo',
                severity: 'medium',
                filePath: 'src/lib/liability-metrics.js',
                line: 5,
                match: 'TODO ',
                description: 'TODO marker in src/lib/liability-metrics.js'
            },
            {
                category: 'tech-debt',
                type: 'todo',
                severity: 'medium',
                filePath: 'src/lib/liability-metrics.js',
                line: 21,
                match: 'TODO ',
                description: 'TODO marker in src/lib/liability-metrics.js'
            },
            {
                category: 'meaningless-data',
                type: 'placeholder-token',
                severity: 'low',
                filePath: 'README.md',
                line: 9,
                match: 'placeholder',
                description: 'Placeholder token in README.md'
            }
        ],
        categories: [
            { category: 'tech-debt', count: 2, topFiles: ['src/lib/liability-metrics.js'] },
            { category: 'meaningless-data', count: 1, topFiles: ['README.md'] }
        ],
        scanScope: {
            limitations: ['Complete scan profile'],
            resultsViewScope: 'benchmark-clone'
        },
        aiSummary: 'Health score 96% for Simplebeacon OSS clone.'
    };

    const out = sanitizeCodebaseReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.codebaseHealthStatus, 'clean');
    assert.equal(out.summary.findingsTotal, 0);
    assert.equal(out.summary.healthScore, 100);
    assert.equal(out.findings.length, 0);
    assert.equal(out.categories.length, 0);
    assert.equal(out.handoffEligible, false);
    assert.match(out.hygieneSummary.attestationNote, /benchmark clone/i);
    assert.ok(out.exportNotes.some((n) => /false positive/i.test(n)));
});

test('sanitizeCodebaseReportExport enriches product codebase export like Downloads', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: PLATFORM,
        summary: {
            healthScore: 100,
            findingsTotal: 1,
            findingsReturned: 1,
            codeFilesAnalyzed: 913,
            eslintSource: 'none',
            eslintSkipped: 'Missing eslint.config.js at platform root',
            severityCounts: { high: 0, medium: 0, low: 1 },
            tierCounts: { production: 0, documentation: 0, general: 1 }
        },
        findings: [{
            category: 'meaningless-data',
            type: 'placeholder-token',
            severity: 'low',
            filePath: 'pdf-export.html',
            line: 53,
            match: 'placeholder',
            description: 'Placeholder token in pdf-export.html'
        }],
        categories: [{ category: 'meaningless-data', count: 1, topFiles: ['pdf-export.html'] }],
        scanScope: {
            limitations: [
                'Complete scan: deep content analysis on all 913 discovered code-like files.',
                'ESLint ran on server, packages, web/scripts, web/components, web/simplebeacon-dashboard/js, src under the platform root when available.'
            ]
        },
        structureInsights: {
            samples: [{ filePath: '.github-sync/simplebeacon/README.md' }, { filePath: 'docs/foo.md' }]
        },
        aiSummaryProvider: 'ollama'
    };

    const out = sanitizeCodebaseReportExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.codebaseHealthStatus, 'clean');
    assert.equal(out.summary.findingsTotal, 0);
    assert.equal(out.summary.healthScore, 100);
    assert.equal(out.findings.length, 0);
    assert.ok(out.exportNotes.some((n) => /false positive/i.test(n)));
    assert.ok(out.exportNotes.some((n) => /ESLint/i.test(n)));
    assert.equal(out.structureInsights.summary.mirrorTreeSamples, 1);
    assert.equal(out.securityHandoffEligible, false);
});

test('sanitizeCodebaseReportExport redacts absolute paths and aiSummary for product export', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: PLATFORM,
        scanTargetRoot: PLATFORM,
        requestedScanRoot: PLATFORM,
        repositoryInventory: { projectRoot: PLATFORM, totalFiles: 1061, profile: 'audit' },
        summary: {
            healthScore: 100,
            findingsTotal: 1,
            findingsReturned: 1,
            codeFilesAnalyzed: 833,
            eslintSource: 'command',
            eslintErrors: 0,
            eslintWarnings: 1,
            severityCounts: { high: 0, medium: 1, low: 0 }
        },
        findings: [{
            category: 'eslint',
            severity: 'medium',
            filePath: 'packages/simplebeacon-cli/src/lib/example.js',
            description: 'unused var'
        }],
        scanScope: { limitations: ['Complete scan profile'] },
        aiSummary: '• The codebase, residing within the CascadeProjects/ai-platform project folder, comprises 1061 files.',
        aiSummaryProvider: 'ollama'
    };

    const out = sanitizeCodebaseReportExport(raw);

    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.scanTargetRoot, 'ai-platform');
    assert.equal(out.requestedScanRoot, 'ai-platform');
    assert.equal(out.repositoryInventory.projectRoot, 'ai-platform');
    assert.match(out.aiSummary, /ai-platform/);
    assert.doesNotMatch(out.aiSummary, /CascadeProjects/i);
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /redacted to project label/i.test(String(n))));
});

test('sanitizeCodebaseReportExport notes audit inventory vs gate full-tree count', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: PLATFORM,
        repositoryInventory: { projectRoot: PLATFORM, totalFiles: 1061, profile: 'audit' },
        summary: {
            healthScore: 99,
            findingsTotal: 2,
            codeFilesAnalyzed: 833,
            repositoryFilesTotal: 1061,
            eslintSource: 'command',
            eslintErrors: 0,
            eslintWarnings: 2,
            severityCounts: { high: 0, medium: 2, low: 0 }
        },
        scanScope: { limitations: ['Complete scan profile'] },
        aiSummaryProvider: 'ollama'
    };

    const out = sanitizeCodebaseReportExport(raw, {
        requestedProjectPath: PLATFORM,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.exportSanitized, true);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.ok(out.exportNotes.some((n) => /1,061.*audit.*1,685/i.test(String(n))));
});

test('sanitizeCodebaseReportExport enriches operator full-tree codebase like Desktop export', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: PLATFORM,
        repositoryInventory: { projectRoot: PLATFORM, totalFiles: 1061, profile: 'audit' },
        summary: {
            healthScore: 99,
            findingsTotal: 2,
            codeFilesAnalyzed: 833,
            repositoryFilesTotal: 1061,
            eslintSource: 'command',
            eslintErrors: 0,
            eslintWarnings: 2,
            severityCounts: { high: 0, medium: 2, low: 0 },
            categoryCounts: { eslint: 2 },
            tierCounts: { production: 2, documentation: 0, general: 0 }
        },
        structureInsights: {
            summary: { sampledFiles: 50, byLanguage: { yaml: 1, markdown: 49 }, tier: 'baseline' },
            samples: [{ filePath: 'docs/foo.md', language: 'markdown', tier: 'baseline' }]
        },
        scanScope: { limitations: ['Complete scan profile'], scanContext: 'complete' },
        aiSummaryProvider: 'ollama'
    };

    const gate = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1639 } }
    };
    const out = sanitizeCodebaseReportExport(raw, {
        repositoryFilesTotal: 1685,
        gateReport: gate
    });

    assert.equal(out.hygieneSummary.nonCodeInventoryFiles, 228);
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.hygieneSummary.mediumSeverityFindings, 2);
    assert.equal(out.hygieneSummary.credentialScanned, 1639);
    assert.equal(out.hygieneSummary.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope.securityHandoffEligible, false);
    assert.match(out.structureInsights.summary.structureSampleNote, /doc-heavy/i);
    assert.ok(out.exportNotes.some((n) => /833 code-like file/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /CRED\/LEAK rules scanned/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /DATA-002 evaluated/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Jest was not run during the paired gate/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /ESLint style-tier warnings only/i.test(String(n))));
});

test('sanitizeCodebaseReportExport repairs mis-scoped benchmark complete-scan codebase export', () => {
    const raw = {
        type: 'codebase-analyzer-report',
        projectRoot: PLATFORM,
        summary: {
            healthScore: 100,
            findingsTotal: 0,
            codeFilesAnalyzed: 939,
            eslintSource: 'command'
        },
        scanScope: {
            limitations: [
                'Complete scan: deep content analysis on all 939 discovered code-like files.',
                'ESLint ran on server, packages, web/scripts, web/components, web/simplebeacon-dashboard/js, src under the scan root.'
            ],
            resultsViewScope: 'platform-only',
            reportHealth: 'platform-scoped'
        },
        structureInsights: {
            samples: [{ filePath: '.github-sync/README.md' }]
        },
        exportNormalized: true,
        scanTargetProfile: 'product'
    };

    const out = sanitizeCodebaseReportExport(raw, {
        requestedProjectPath: BENCHMARK,
        scanTargetRoot: BENCHMARK
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.misscopedPlatformCodeWalk, true);
    assert.equal(out.scanTargetRoot, BENCHMARK);
    assert.equal(out.codebaseHealthStatus, 'benchmark-misscoped-review');
    assert.equal(out.scanScope.reportHealth, 'benchmark-clone-scan');
    assert.ok(out.exportNotes.some((note) => /Mis-scoped complete-scan export/i.test(note)));
    assert.match(out.hygieneSummary.attestationNote, /walked the Simplebeacon platform tree/i);
});

test('sanitizeCodebaseReportExport normalizes frozen Simplebeacon benchmark codebase Downloads export', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'codebase-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeCodebaseReportExport(raw, {
        requestedProjectPath: BENCHMARK,
        scanTargetRoot: BENCHMARK
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.scanTargetRoot, BENCHMARK);
    assert.equal(out.misscopedPlatformCodeWalk, true);
    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.codebaseHealthStatus, 'benchmark-misscoped-review');
    assert.equal(out.hygieneSummary.misscopedPlatformCodeWalk, true);
});

test('sanitizeCodebaseReportExport normalizes clone-scoped benchmark codebase Downloads export (3)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'codebase-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(3).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const exportFilename = path.basename(fixturePath);
    const out = sanitizeCodebaseReportExport(raw, {
        requestedProjectPath: BENCHMARK,
        exportFilename
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.misscopedPlatformCodeWalk, undefined);
    assert.equal(out.inventoryScope, 'oss-clone');
    assert.equal(out.codebaseHealthStatus, 'clean');
    assert.equal(out.title, 'OSS Clone Codebase Hygiene (github-cache benchmark)');
    assert.match(out.projectRoot, /^ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.doesNotMatch(out.projectRoot, /CascadeProjects/i);
    assert.equal(out.summary.codeFilesAnalyzed, 191);
    assert.equal(out.summary.repositoryFilesTotal, 197);
    assert.equal(out.hygieneSummary.repositoryFilesTotal, 197);
    assert.equal(
        out.scanScope.limitations.filter((line) => /eslint (not run|did not run)/i.test(String(line))).length,
        1
    );
    assert.equal(
        out.scanScope.limitations.filter((line) => /^OSS benchmark clone under github-cache/i.test(String(line))).length,
        1
    );
});

test('dedupeLimitationNotes collapses near-duplicate ESLint limitation lines', () => {
    const { dedupeLimitationNotes } = require('../src/lib/codebase-export-sanitize');
    const lines = [
        'OSS benchmark clone under github-cache/ — codebase hygiene comparison only, not Simplebeacon platform production certification.',
        'ESLint not run — OSS clone root has no Simplebeacon ESLint targets (server/, packages/, web/).',
        'ESLint did not run — Simplebeacon ESLint targets (server/, packages/, web/) are not present in this OSS clone root.'
    ];
    const out = dedupeLimitationNotes(lines);
    assert.equal(out.filter((line) => /eslint/i.test(String(line))).length, 1);
});

test('resolveCodebaseExportContext detects benchmark from scan target only', () => {
    const ctx = resolveCodebaseExportContext(
        { projectRoot: PLATFORM },
        { scanTargetRoot: BENCHMARK }
    );
    assert.equal(ctx.benchmarkScan, true);
    assert.equal(ctx.misscopedPlatformWalk, true);
    assert.equal(ctx.scanTargetRoot, BENCHMARK);
});
