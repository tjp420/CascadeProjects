const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeDuplicateGroupForBrief,
    sanitizeCleanupBriefExport
} = require('../src/lib/cleanup-brief-export-sanitize');

const GEE_PATH = 'C:/repo/ai-platform/github-cache/google-earthenterprise';

test('normalizeDuplicateGroupForBrief recovers paths from compact finding', () => {
    const group = normalizeDuplicateGroupForBrief({
        paths: ['assets/a.png', 'assets/b.png', 'assets/c.png'],
        reclaimableBytes: 1200
    });
    assert.equal(group.keeper, 'assets/a.png');
    assert.deepEqual(group.duplicates, ['assets/b.png', 'assets/c.png']);
    assert.equal(group.duplicateCount, 2);
});

test('sanitizeCleanupBriefExport fixes benchmark clone brief', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: GEE_PATH,
        policy: {
            protectedPaths: ['web/data', 'data/mock', '.git'],
            allowNodeModules: true,
            allowSimplebeaconCache: false
        },
        inventory: { totalFiles: 17328, totalFolders: 1284 },
        estimatedReduction: { files: 0, bytes: 0 },
        tiers: { safeNow: { files: 0, bytes: 0, directories: [] }, investigate: { files: 443 } },
        scanAnalysis: {
            fileReduction: {
                duplicateAssetBytes: 567355833,
                summaryTable: [
                    { category: 'Duplicate assets', files: 5079, bytes: 567355833, action: 'Consolidate' }
                ]
            },
            notes: [
                'File reduction and roadmap walks exclude github-cache/, deliverables/, and .simplebeacon/ artifact trees.',
                'Config scanner note.'
            ],
            artifactProfile: 'empty'
        },
        duplicateAssets: [
            { duplicates: [], reclaimableBytes: 1738320 },
            { duplicates: [], reclaimableBytes: 1574080 }
        ],
        agentPrompt: 'Safe to delete now: 0 files',
        agentInstructions: ['Target inventory reduction: ~0 files (0 B).']
    };

    const brief = sanitizeCleanupBriefExport(raw);

    assert.equal(brief.scanTargetProfile, 'benchmark-cache');
    assert.equal(brief.handoffEligible, false);
    assert.equal(brief.benchmarkScan, true);
    assert.ok(brief.policy.protectedPaths.includes('.git'));
    assert.ok(!brief.policy.protectedPaths.includes('web/data'));
    assert.ok(brief.policy.productProtectedPathsAdvisory.includes('web/data'));
    assert.match(brief.agentPrompt, /benchmark clone/i);
    assert.match(brief.agentInstructions[0], /benchmark clone/i);
    assert.equal(brief.duplicateAssets.length, 0);
    assert.equal(brief.duplicateAssetsSummary.reclaimableBytes, 567355833);
    assert.equal(brief.duplicateAssetsSummary.duplicateFiles, 5079);
    assert.equal(brief.estimatedReduction.phase2DuplicateBytes, 567355833);
    assert.match(brief.scanAnalysis.notes[0], /OSS clone/i);
    assert.ok(!brief.scanAnalysis.notes.some((n) => /exclude.*github-cache/i.test(String(n))));
    assert.equal(brief.scanAnalysis.artifactProfile, 'oss-clone-hygiene');
    assert.equal(brief.inventory.inventoryScope, 'oss-clone');
    assert.equal(brief.exportNormalized, true);
    assert.equal(brief.cleanupStatus, 'benchmark-hygiene');
    assert.ok(brief.scanAnalysis.notes.filter((n) => /OSS clone under github-cache/i.test(String(n))).length === 1);
});

test('sanitizeCleanupBriefExport downgrades stale benchmark missing-env priority actions', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: GEE_PATH,
        policy: { protectedPaths: ['.git'], allowNodeModules: true },
        inventory: { totalFiles: 900 },
        estimatedReduction: { files: 0, bytes: 0 },
        tiers: { safeNow: { files: 0, bytes: 0 }, investigate: { files: 5 } },
        scanAnalysis: {
            dataQuality: { missingEnvKeys: 10 },
            priorityActions: [{
                priority: 'high',
                title: 'Resolve missing environment keys',
                detail: '10 code references lack a matching .env definition'
            }],
            notes: [
                'Scan target is an OSS clone under github-cache/ — not Simplebeacon product code.',
                'Directory totals exclude nested artifact paths.'
            ],
            artifactProfile: 'oss-clone-hygiene'
        },
        dataQualityActions: [{
            priority: 'high',
            title: 'Resolve missing environment keys',
            detail: '10 code references lack a matching .env definition'
        }],
        sourceScans: { dataQualityPresent: true, fileReductionPresent: true }
    };

    const brief = sanitizeCleanupBriefExport(raw);
    assert.equal(brief.scanAnalysis.priorityActions[0].priority, 'low');
    assert.match(brief.scanAnalysis.priorityActions[0].title, /Optional CLI/i);
    assert.equal(brief.dataQualityActions[0].priority, 'low');
    assert.ok(brief.scanAnalysis.dataQualityNote);
});

test('sanitizeCleanupBriefExport does not contradict safeNow tier with exportNotes', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        policy: { protectedPaths: ['web/data', '.git'], allowNodeModules: true },
        inventory: { totalFiles: 1200, totalFolders: 200 },
        estimatedReduction: { files: 100, bytes: 1024 * 1024 },
        tiers: {
            safeNow: {
                files: 100,
                bytes: 1024 * 1024,
                directories: [{ path: 'node_modules', bytes: 1024 * 1024, files: 100 }]
            }
        },
        scanAnalysis: {
            artifactProfile: 'mixed',
            fileReduction: { safeToDeleteBytes: 1024 * 1024 }
        },
        sourceScans: { fileReductionPresent: true, dataQualityPresent: true }
    };
    const brief = sanitizeCleanupBriefExport(raw);
    assert.equal(brief.cleanupStatus, 'safe-delete-available');
    assert.ok(brief.exportNotes.some((n) => /Phase 1 safe-to-delete/i.test(String(n))));
    assert.ok(!brief.exportNotes.some((n) => /No regenerable build-artifact directories/i.test(String(n))));
    assert.equal(brief.scanAnalysis.artifactProfile, 'mixed-safe-delete-available');
});

test('sanitizeCleanupBriefExport replaces stale exportNotes on re-sanitize', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        policy: { protectedPaths: ['web/data', '.git'], allowNodeModules: true },
        inventory: { totalFiles: 30932, totalFolders: 4135, auditRepositoryFiles: 1705 },
        projectedInventory: { totalFiles: 25907, totalFolders: 4135 },
        estimatedReduction: { files: 5025, bytes: 305107025 },
        tiers: {
            safeNow: {
                files: 5025,
                bytes: 305107025,
                directories: [{ path: 'web/simplebeacon-findings/node_modules', bytes: 304442833, files: 5000 }]
            }
        },
        scanAnalysis: {
            artifactProfile: 'mixed-safe-delete-available',
            fileReduction: { safeToDeleteBytes: 305107025 }
        },
        exportNormalized: true,
        cleanupStatus: 'safe-delete-available',
        exportNotes: [
            'No regenerable build-artifact directories are currently classified safe-to-delete — follow data-quality actions and optional phase 2.'
        ],
        sourceScans: { fileReductionPresent: true, dataQualityPresent: true }
    };
    const brief = sanitizeCleanupBriefExport(raw, { repositoryFilesTotal: 1705 });
    assert.ok(brief.exportNotes.some((n) => /Phase 1 safe-to-delete/i.test(String(n))));
    assert.ok(!brief.exportNotes.some((n) => /No regenerable build-artifact directories/i.test(String(n))));
    assert.equal(brief.scanAnalysis.artifactProfileNote, 'Phase 1 lists regenerable artifact directories safe to delete under current policy.');
    assert.match(brief.projectedInventory.projectedNote, /After phase 1/i);
});

test('sanitizeCleanupBriefExport enriches product-root brief like Downloads export', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        policy: { protectedPaths: ['web/data', '.git'], allowNodeModules: true },
        inventory: { totalFiles: 36157, totalFolders: 4090 },
        estimatedReduction: { files: 0, bytes: 0, phase2DuplicateBytes: 256, phase2DuplicateFiles: 1 },
        tiers: {
            safeNow: { files: 0, bytes: 0, directories: [{ path: 'node_modules', bytes: 0, files: 0 }] },
            investigate: { files: 19 }
        },
        scanAnalysis: {
            artifactProfile: 'empty',
            fileReduction: {
                duplicateAssetBytes: 256,
                unusedFileCandidates: 19,
                skippedArtifactDirectories: [{ path: 'node_modules', bytes: 0, files: 0 }]
            }
        },
        duplicateAssets: [{ keeper: 'favicon.svg', duplicates: ['web/favicon.svg'], reclaimableBytes: 256 }],
        sourceScans: { fileReductionPresent: true, dataQualityPresent: true }
    };

    const brief = sanitizeCleanupBriefExport(raw);
    assert.equal(brief.scanTargetProfile, 'product');
    assert.equal(brief.exportNormalized, true);
    assert.equal(brief.cleanupStatus, 'review-and-optional-consolidation');
    assert.equal(brief.securityHandoffEligible, false);
    assert.equal(brief.duplicateAssets[0].keeper, 'web/favicon.svg');
    assert.equal(brief.scanAnalysis.artifactProfile, 'mixed-no-safe-delete');
    assert.match(brief.agentPrompt, /19/);
    assert.match(brief.agentPrompt, /phase 2/i);
    assert.ok(brief.exportNotes.length > 0);
});

test('sanitizeCleanupBriefExport redacts absolute paths and fills baseline exportNotes', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        policy: { protectedPaths: ['web/data', '.git'], allowNodeModules: true },
        inventory: {
            totalFiles: 19204,
            totalFolders: 2843,
            inventoryScope: 'platform-product',
            inventoryNote: 'Cleanup inventory (19,204 files) includes un-walked regenerable shells; gate audit profile counted 1,685 files.',
            auditRepositoryFiles: 1685
        },
        estimatedReduction: { files: 0, bytes: 0 },
        tiers: { safeNow: { files: 0, bytes: 0, directories: [] }, investigate: { files: 0 } },
        scanAnalysis: {
            projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            artifactProfile: 'no-reclaimable-artifacts',
            fileReduction: { safeToDeleteBytes: 0 }
        },
        agentPrompt: 'Proceed in agent mode using the attached cleanup brief for: C:/Users/Trevor/CascadeProjects/ai-platform',
        exportNotes: [],
        sourceScans: { fileReductionPresent: true, dataQualityPresent: true }
    };

    const brief = sanitizeCleanupBriefExport(raw, { repositoryFilesTotal: 1685 });

    assert.equal(brief.projectPath, 'ai-platform');
    assert.equal(brief.scanAnalysis.projectPath, 'ai-platform');
    assert.match(brief.agentPrompt, /ai-platform/);
    assert.doesNotMatch(brief.agentPrompt, /CascadeProjects/i);
    assert.equal(brief.handoffEligible, false);
    assert.equal(brief.exportSanitized, true);
    assert.ok(brief.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /19,204 files/i.test(String(n))));
});

test('sanitizeCleanupBriefExport enriches operator full-tree brief like Desktop export', () => {
    const raw = {
        type: 'simplebeacon-cleanup-brief',
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        policy: { protectedPaths: ['web/data', '.git'], allowNodeModules: true, allowSimplebeaconCache: true },
        inventory: {
            totalFiles: 19204,
            totalFolders: 2843,
            inventoryScope: 'platform-product',
            auditRepositoryFiles: 1685,
            inventoryNote: 'Cleanup inventory (19,204 files) includes un-walked regenerable shells; gate audit profile counted 1,685 files.'
        },
        projectedInventory: { totalFiles: 19204, totalFolders: 2843 },
        estimatedReduction: { files: 0, bytes: 0 },
        tiers: {
            safeNow: { files: 0, bytes: 0, directories: [] },
            investigate: { files: 0, note: 'Static analysis only — verify dynamic imports.' }
        },
        scanAnalysis: {
            projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            artifactProfile: 'no-reclaimable-artifacts',
            fileReduction: {
                safeToDeleteBytes: 0,
                duplicateAssetBytes: 0,
                unusedFileCandidates: 0,
                summaryTable: []
            },
            dataQuality: {
                workspacePackages: 3,
                unusedDependencies: 0,
                envInconsistencies: 0,
                missingEnvKeys: 0
            },
            notes: ['File reduction and roadmap walks exclude github-cache/, deliverables/, and .simplebeacon/ artifact trees.']
        },
        sourceScans: { fileReductionPresent: true, dataQualityPresent: true, fileReductionPlanPresent: true }
    };

    const gate = {
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act', fullDirectoryStats: { contentScanned: 1639 } }
    };
    const fileReductionReport = { inventory: { totalFiles: 1060 } };
    const brief = sanitizeCleanupBriefExport(raw, {
        repositoryFilesTotal: 1685,
        gateReport: gate,
        fileReductionReport
    });

    assert.equal(brief.hygieneSummary.explorerInventoryFiles, 19204);
    assert.equal(brief.hygieneSummary.gateRepositoryFilesTotal, 1685);
    assert.equal(brief.hygieneSummary.fileReductionWorkspaceFiles, 1060);
    assert.equal(brief.hygieneSummary.jestBaselineChecked, false);
    assert.equal(brief.hygieneSummary.dataQualityOpenFindings, 0);
    assert.equal(brief.hygieneSummary.credentialScanned, 1639);
    assert.equal(brief.hygieneSummary.gateMetadataOnlyFiles, 46);
    assert.equal(brief.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.equal(brief.hygieneSummary.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(brief.scanScope.securityHandoffEligible, false);
    assert.equal(brief.scanScope.explorerInventoryProfile, 'monorepo-root-with-shells');
    assert.equal(brief.scanScope.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(brief.scanAnalysis.fileReduction.workspaceFilesScanned, 1060);
    assert.ok(brief.exportNotes.some((n) => /File-reduction workspace walk counted 1,060 files/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /CRED\/LEAK rules scanned/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /DATA-002 evaluated/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /Jest was not run during the paired gate scan/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /No phase-1 safe deletes under current policy/i.test(String(n))));
    assert.ok(brief.exportNotes.some((n) => /zero open workspace findings/i.test(String(n))));
});
