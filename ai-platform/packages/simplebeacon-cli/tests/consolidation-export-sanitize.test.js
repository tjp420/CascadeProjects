const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeConsolidationExport } = require('../src/lib/consolidation-export-sanitize');

const GEE = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/google-earthenterprise';

test('sanitizeConsolidationExport fixes frozen GEE consolidation export', () => {
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-google-earthenterprise-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'file-merger-reduction-report',
            projectRoot: GEE,
            summary: {
                mergeCandidates: 14,
                reductionOpportunities: 18,
                repositoryFilesTotal: 17237,
                sampleDataFilesAnalyzed: 0,
                potentialSavingsLabel: '14.5MB'
            },
            scanScope: { reportHealth: 'stale-explorer-inventory' },
            reductionOpportunities: [{
                description: 'jquery exceeds 250KB — trim or archive for dashboard load'
            }],
            exportNotes: ['Explorer inventory counted 17,237 files (includes github-cache/).']
        };

    const out = sanitizeConsolidationExport(raw, { projectPath: GEE });

    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.benchmarkScan, true);
    assert.equal(out.scanScope.reportHealth, 'benchmark-clone-consolidation');
    assert.equal(out.summary.repositoryFilesTotal, 17237);
    assert.equal(out.summary.staleInventoryNote, undefined);
    assert.ok(!out.aiSummary.includes('dashboard load'));
    assert.ok(out.exportNotes.every((n) => !/Restart the dashboard.*2,200/.test(String(n))));
    assert.ok(out.reductionOpportunities[0].description.includes('OSS clone'));
});

test('sanitizeConsolidationExport fixes frozen Simplebeacon benchmark consolidation export', () => {
    const SIMPLEBEACON = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'file-merger-reduction-report',
            projectRoot: SIMPLEBEACON,
            summary: {
                mergeCandidates: 2,
                reductionOpportunities: 0,
                repositoryFilesTotal: 194,
                fuzzyNearDuplicatePairs: 2,
                potentialSavingsBytes: 0,
                potentialSavingsLabel: '0B'
            },
            mergeCandidates: [{
                id: 'fuzzy-near-dup-1',
                mergeType: 'fuzzy-near-duplicate',
                files: [
                    { path: 'src/lib/complete-scan-artifact-profile.browser.js' },
                    { path: 'src/lib/complete-scan-artifact-profile.js' }
                ],
                recommendation: 'Near-duplicate content — review before merge'
            }, {
                id: 'fuzzy-near-dup-2',
                mergeType: 'fuzzy-near-duplicate',
                files: [
                    { path: 'examples/mcp/cursor.mcp.json' },
                    { path: 'examples/mcp/cursor.npx-github.mcp.json' }
                ],
                recommendation: 'Near-duplicate content — review before merge'
            }],
            recommendations: [{
                files: ['src/lib/complete-scan-artifact-profile.browser.js', 'src/lib/complete-scan-artifact-profile.js']
            }, {
                files: ['examples/mcp/cursor.mcp.json', 'examples/mcp/cursor.npx-github.mcp.json']
            }],
            advancedAnalysis: {
                fuzzyNearDuplicates: {
                    pairsFound: 2,
                    pairs: [
                        { fileA: 'src/lib/complete-scan-artifact-profile.browser.js', fileB: 'src/lib/complete-scan-artifact-profile.js' },
                        { fileA: 'examples/mcp/cursor.mcp.json', fileB: 'examples/mcp/cursor.npx-github.mcp.json' }
                    ]
                }
            },
            implementationPhases: [{ phase: 'Phase 1 — Core scanner (done)' }],
            benchmarkScan: true,
            exportSanitized: true
        };

    const out = sanitizeConsolidationExport(raw, { projectPath: SIMPLEBEACON });

    assert.equal(out.exportNormalized, true);
    assert.equal(out.mergeCandidates.length, 0);
    assert.equal(out.recommendations.length, 0);
    assert.equal(out.summary.mergeCandidates, 0);
    assert.equal(out.summary.intentionalPairsExcluded, 2);
    assert.equal(out.advancedAnalysis.fuzzyNearDuplicates.pairsFound, 0);
    assert.equal(out.consolidationHealthStatus, 'benchmark-hygiene-clean');
    assert.equal(out.platformRoot, 'ai-platform');
    assert.equal(out.implementationPhases, undefined);
    assert.ok(out.aiSummary.includes('No merge') || out.aiSummary.includes('No merge/reduction'));
    assert.ok(out.exportNotes.some((n) => /browser mirrors|MCP example/i.test(String(n))));
});

test('sanitizeConsolidationExport fixes frozen ai-platform product consolidation export', () => {
    const frozenPath = path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'consolidation-c-users-trevor-cascadeprojects-ai-platform-2026-05-31.json'
    );
    const raw = fs.existsSync(frozenPath)
        ? JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
        : {
            type: 'file-merger-reduction-report',
            projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            summary: {
                mergeCandidates: 1,
                reductionOpportunities: 0,
                repositoryFilesTotal: 950,
                repositoryFilesAudited: 754,
                exactDuplicateGroups: 0,
                potentialSavingsBytes: 0,
                fuzzyNearDuplicatePairs: 1
            },
            advancedAnalysis: {
                fuzzyNearDuplicates: {
                    pairsFound: 1,
                    pairs: [{ fileA: '.tmp-vault-cookies.txt', fileB: 'cookies.txt', similarity: 0.9 }]
                }
            },
            mergeCandidates: [{
                id: 'fuzzy-near-dup-1',
                mergeType: 'fuzzy-near-duplicate',
                files: [
                    { path: '.tmp-vault-cookies.txt', name: '.tmp-vault-cookies.txt', sizeBytes: 0 },
                    { path: 'cookies.txt', name: 'cookies.txt', sizeBytes: 0 }
                ],
                savingsBytes: 0,
                recommendation: 'Near-duplicate content — review before merge'
            }],
            recommendations: [{
                priority: 'medium',
                action: 'manual-merge-review',
                files: ['.tmp-vault-cookies.txt', 'cookies.txt'],
                description: 'Near-duplicate content — review before merge'
            }],
            scanScope: { repositoryFilesAudited: 754 },
            exportSanitized: true,
            exportNotes: []
        };

    const out = sanitizeConsolidationExport(raw, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });

    assert.equal(out.scanTargetProfile, 'product');
    assert.equal(out.exportNormalized, true);
    assert.equal(out.handoffEligible, false);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.summary.mergeCandidates, 0);
    assert.equal(out.summary.fuzzyNearDuplicatePairs, 0);
    assert.equal(out.advancedAnalysis.fuzzyNearDuplicates.pairsFound, 0);
    assert.equal(out.mergeCandidates.length, 0);
    assert.equal(out.recommendations.length, 0);
    assert.equal(out.consolidationHealthStatus, 'clean-no-merge-candidates');
    assert.ok(out.exportNotes.length > 0);
    assert.ok(out.exportNotes.some((n) => /vault\/session cookie|ephemeral/i.test(String(n))));
    assert.ok(out.aiSummary.includes('no actionable merge candidates'));
    assert.equal(out.summary.benchmarkCacheCandidatesExcluded, 0);
    assert.equal(out.summary.fuzzyPairsExcluded, 1);
    assert.ok(out.scanScope.limitations.some((line) => /near-duplicate pair\(s\) excluded \(MCP/i.test(String(line))));
    assert.ok(!out.scanScope.limitations.some((line) => /benchmark-clone candidate/i.test(String(line))));
    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.scanTargetRoot, 'ai-platform');
    assert.equal(out.repositoryInventory?.projectRoot ?? out.projectRoot, 'ai-platform');
    assert.doesNotMatch(out.projectRoot, /CascadeProjects/i);
    assert.ok(out.exportNotes.some((n) => /redacted to project label/i.test(String(n))));
});

test('sanitizeConsolidationExport notes audit inventory vs gate full-tree count', () => {
    const raw = {
        type: 'file-merger-reduction-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryInventory: { totalFiles: 1061, profile: 'audit' },
        summary: {
            mergeCandidates: 0,
            reductionOpportunities: 0,
            repositoryFilesTotal: 1061,
            repositoryFilesAudited: 865,
            exactDuplicateGroups: 0,
            potentialSavingsBytes: 0,
            mcpExamplePairsExcluded: 2
        },
        scanScope: { repositoryFilesAudited: 865, repositoryInventoryProfile: 'audit' },
        mergeCandidates: [],
        exportSanitized: true,
        exportNotes: [],
        aiSummaryProvider: 'Simplebeacon rules'
    };
    const out = sanitizeConsolidationExport(raw, {
        projectPath: raw.projectRoot,
        repositoryFilesTotal: 1685
    });
    assert.equal(out.exportSanitized, true);
    assert.equal(out.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.ok(out.exportNotes.some((n) => /1,061.*audit.*1,685/i.test(String(n))));
    assert.match(out.aiSummaryProvider || '', /SimpleBeacon rules/);
});

test('sanitizeConsolidationExport enriches operator full-tree consolidation like Desktop export', () => {
    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        productionLeakScanned: 1639,
        jestBaselineChecked: false,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1639 } }
    };
    const raw = {
        type: 'file-merger-reduction-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryInventory: { totalFiles: 1061, profile: 'audit' },
        scanPaths: ['web/data', 'data/roadmap'],
        summary: {
            mergeCandidates: 0,
            reductionOpportunities: 0,
            repositoryFilesTotal: 1061,
            repositoryFilesAudited: 865,
            jsonFilesAnalyzed: 36,
            sampleDataFilesAnalyzed: 7,
            exactDuplicateGroups: 0,
            potentialSavingsBytes: 0,
            mcpExamplePairsExcluded: 2,
            intentionalPairsExcluded: 2,
            fuzzyPairsExcluded: 2
        },
        scanScope: {
            repositoryFilesAudited: 865,
            jsonFilesAnalyzed: 36,
            sampleDataFilesAnalyzed: 7,
            repositoryInventoryProfile: 'audit'
        },
        mergeCandidates: [],
        rejectedFiction: { warning: 'Enterprise design claims not implemented in v0.8-beta' },
        exportSanitized: true,
        aiSummaryProvider: 'SimpleBeacon rules'
    };

    const out = sanitizeConsolidationExport(raw, {
        projectPath: raw.projectRoot,
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.consolidationHealthStatus, 'clean-no-merge-candidates');
    assert.equal(out.hygieneSummary.repositoryFilesTotal, 1061);
    assert.equal(out.hygieneSummary.repositoryFilesAudited, 865);
    assert.equal(out.hygieneSummary.auditInventoryNotMergeWalked, 196);
    assert.equal(out.hygieneSummary.gateMetadataOnlyFiles, 46);
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.equal(out.hygieneSummary.fictionSampleFilesScanned, 6);
    assert.equal(out.hygieneSummary.jsonFilesAnalyzed, 36);
    assert.equal(out.hygieneSummary.jestBaselineChecked, false);
    assert.equal(out.scanScope.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.scanScope.mergeWalkFiles, 865);
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /36 JSON file\(s\) hashed/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate content-scanned 1,639/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /2 pair\(s\) excluded as monorepo path aliases/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /DATA-002 evaluated 184/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /Gate rule bundle profile: eu-ai-act/i.test(String(n))));
    assert.ok(!out.exportNotes.some((n) => /Consolidation hygiene on ai-platform/i.test(String(n))));
});

test('sanitizeConsolidationExport idempotently re-sanitizes enriched operator export from embedded gate context', () => {
    const gateReport = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        jestBaselineChecked: false,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1639 } }
    };
    const enriched = {
        type: 'file-merger-reduction-report',
        projectRoot: 'ai-platform',
        summary: {
            mergeCandidates: 0,
            repositoryFilesTotal: 1061,
            repositoryFilesAudited: 865,
            jsonFilesAnalyzed: 36,
            sampleDataFilesAnalyzed: 7,
            exactDuplicateGroups: 0,
            potentialSavingsBytes: 0,
            intentionalPairsExcluded: 2
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
        exportNormalized: true
    };
    const out = sanitizeConsolidationExport(enriched, { projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });
    const out2 = sanitizeConsolidationExport(out, { projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform' });
    assert.equal(out.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});

test('sanitizeConsolidationExport redacts benchmark clone paths', () => {
    const clone = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const raw = {
        type: 'file-merger-reduction-report',
        projectRoot: clone,
        scanTargetRoot: clone,
        summary: {
            mergeCandidates: 0,
            reductionOpportunities: 0,
            repositoryFilesTotal: 197,
            repositoryFilesAudited: 197,
            exactDuplicateGroups: 0,
            potentialSavingsBytes: 0
        },
        scanScope: { repositoryFilesAudited: 197 },
        mergeCandidates: [],
        reductionOpportunities: []
    };
    const out = sanitizeConsolidationExport(raw, { projectPath: clone });
    assert.match(out.projectRoot, /^ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.match(out.scanTargetRoot, /^ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.doesNotMatch(out.projectRoot, /CascadeProjects/i);
});

test('sanitizeConsolidationExport rewrites legacy mislabeled benchmark exclusion counts', () => {
    const raw = {
        type: 'file-merger-reduction-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        summary: {
            mergeCandidates: 0,
            reductionOpportunities: 0,
            exactDuplicateGroups: 0,
            benchmarkCacheCandidatesExcluded: 2,
            intentionalPairsExcluded: 2,
            potentialSavingsBytes: 0
        },
        scanScope: {
            limitations: [
                '2 benchmark-clone candidate(s) excluded from platform consolidation scores.'
            ]
        },
        advancedAnalysis: { fuzzyNearDuplicates: { pairsFound: 0, pairs: [] } },
        mergeCandidates: [],
        exportSanitized: true
    };
    const out = sanitizeConsolidationExport(raw, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.summary.benchmarkCacheCandidatesExcluded, 0);
    assert.equal(out.summary.fuzzyPairsExcluded, 2);
    assert.ok(out.scanScope.limitations.some((line) => /near-duplicate pair\(s\) excluded/i.test(String(line))));
    assert.ok(!out.scanScope.limitations.some((line) => /benchmark-clone candidate/i.test(String(line))));
});

test('sanitizeConsolidationExport strips monorepo ai-platform/ mirror duplicate groups', () => {
    const raw = {
        type: 'file-merger-reduction-report',
        projectRoot: 'C:/Users/Trevor/CascadeProjects',
        summary: {
            mergeCandidates: 2,
            reductionOpportunities: 2,
            exactDuplicateGroups: 2,
            potentialSavingsBytes: 6000,
            potentialSavingsLabel: '5.9KB',
            repositoryFilesTotal: 1196
        },
        mergeCandidates: [{
            id: 'exact-dup-1',
            mergeType: 'exact-duplicate',
            files: [
                { path: 'ai-platform/packages/simplebeacon-cli/package.json' },
                { path: 'packages/simplebeacon-cli/package.json' }
            ],
            savingsLabel: '3.0KB'
        }, {
            id: 'fuzzy-near-dup-1',
            mergeType: 'fuzzy-near-duplicate',
            files: [
                { path: 'ai-platform/.cursor/mcp.json' },
                { path: 'packages/simplebeacon-cli/examples/mcp/cursor.monorepo.mcp.json' }
            ],
            savingsLabel: '0B'
        }],
        reductionOpportunities: [{
            type: 'duplicate-removal',
            files: [
                { path: 'ai-platform/packages/simplebeacon-cli/package.json' },
                { path: 'packages/simplebeacon-cli/package.json' }
            ],
            savingsBytes: 3000
        }],
        recommendations: [{
            priority: 'high',
            action: 'deduplicate',
            files: ['ai-platform/packages/simplebeacon-cli/package.json', 'packages/simplebeacon-cli/package.json'],
            description: 'Keep one canonical file'
        }],
        advancedAnalysis: {
            fuzzyNearDuplicates: {
                pairsFound: 1,
                pairs: [{
                    fileA: 'ai-platform/packages/simplebeacon-cli/src/lib/foo.browser.js',
                    fileB: 'ai-platform/packages/simplebeacon-cli/src/lib/foo.js',
                    similarity: 0.96
                }]
            }
        }
    };

    const out = sanitizeConsolidationExport(raw, {
        projectPath: 'C:/Users/Trevor/CascadeProjects'
    });

    assert.equal(out.mergeCandidates.length, 0);
    assert.equal(out.reductionOpportunities.length, 0);
    assert.equal(out.summary.exactDuplicateGroups, 0);
    assert.equal(out.recommendations.length, 0);
    assert.equal(out.advancedAnalysis.fuzzyNearDuplicates.pairsFound, 0);
});

test('sanitizeConsolidationExport normalizes frozen Simplebeacon benchmark consolidation Downloads (1)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeConsolidationExport(raw, {
        exportFilename: 'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(1).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.consolidationHealthStatus, 'benchmark-hygiene-clean');
    assert.equal(out.summary.intentionalPairsExcluded, 2);
    assert.equal(out.hygieneSummary.intentionalPairsExcluded, 2);
    assert.deepEqual(out.scanPaths, []);
    assert.ok(out.scanPathsNote);
    assert.equal(out.advancedAnalysis.semanticHints.note, 'Semantic hints disabled on OSS benchmark clone — not used for handoff.');
    const scopeNotes = (out.exportNotes || []).filter((n) => /Consolidation export scoped to github-cache/i.test(String(n)));
    assert.equal(scopeNotes.length, 1);
});

test('sanitizeConsolidationExport normalizes clone-scoped benchmark consolidation Downloads export (2)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeConsolidationExport(raw, {
        exportFilename: 'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.consolidationHealthStatus, 'benchmark-hygiene-clean');
    assert.match(out.repositoryInventory.projectRoot, /^ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.equal(out.hygieneSummary.repositoryFilesTotal, 197);
    assert.equal(out.hygieneSummary.jsonFilesAnalyzed, 10);
    assert.equal(out.hygieneSummary.intentionalPairsExcluded, 2);
    assert.ok(out.exportNotes.some((note) => /intentional CJS\/browser mirrors/i.test(note)));
    assert.equal(out.platformRoot, 'ai-platform');
    assert.deepEqual(out.scanPaths, []);
    const out2 = sanitizeConsolidationExport(out, {
        exportFilename: 'consolidation-c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(2).json'
    });
    assert.equal(out2.exportNotes.length, out.exportNotes.length);
});
