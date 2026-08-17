const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
    assertFileReductionScanFresh,
    buildFileReductionAiNotes,
    formatFileReductionAiNotesMarkdown,
    writeFileReductionArtifacts,
    readCleanupAiNotes
} = require('../src/lib/file-reduction-ai-notes');

const sampleScan = {
    type: 'data-cleanup-report',
    generatedAt: '2026-08-17T00:00:00.000Z',
    projectRoot: 'C:\\Projects\\demo',
    scanProfile: 'file-reduction',
    inventory: { totalFiles: 1200, totalDirectories: 90 },
    summary: {
        totalFindings: 12,
        reclaimableBytes: 9000,
        unusedFileCandidates: 4,
        estimatedReductionPct: 1.2
    },
    scanners: {
        'build-artifacts': { safeToDeleteBytes: 8000, reviewBeforeDeleteBytes: 500 },
        'asset-consolidation': { duplicateGroups: 2, reclaimableBytes: 1000 },
        'unused-files': { unusedCandidates: 4 }
    },
    fileReductionPlan: {
        totals: { safeToDeleteBytes: 8000, reviewBeforeDeleteBytes: 500, duplicateAssetBytes: 1000 },
        safeToDelete: {
            topDirectories: [
                { path: 'coverage', bytes: 8000, files: 42, category: 'coverage' }
            ]
        },
        duplicateAssets: {
            topGroups: [{ keeper: 'assets/logo.png', duplicateCount: 2, reclaimableBytes: 1000 }]
        },
        unusedFiles: { candidates: 4 }
    },
    scanScope: { reportHealth: 'platform-scoped', rescanRecommended: false }
};

test('assertFileReductionScanFresh rejects stale rescanRecommended scans', () => {
    assert.throws(
        () => assertFileReductionScanFresh({
            ...sampleScan,
            scanScope: { rescanRecommended: true, reportHealth: 'stale-full-tree-scan' }
        }),
        /stale/i
    );
});

test('assertFileReductionScanFresh accepts healthy scan with plan totals', () => {
    assert.doesNotThrow(() => assertFileReductionScanFresh(sampleScan));
});

test('buildFileReductionAiNotes captures reclaim summary and safe dirs', () => {
    const notes = buildFileReductionAiNotes(sampleScan, { projectRoot: sampleScan.projectRoot, includeBrief: false });
    assert.equal(notes.reclaim.safeToDeleteBytes, 8000);
    assert.equal(notes.safeDirectories.length, 1);
    assert.equal(notes.safeDirectories[0].path, 'coverage');
    assert.match(formatFileReductionAiNotesMarkdown(notes), /Safe to delete/);
});

test('writeFileReductionArtifacts persists markdown and json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-fr-notes-'));
    const out = writeFileReductionArtifacts(tmp, sampleScan, { includeBrief: false });
    assert.ok(out);
    assert.ok(fs.existsSync(out.markdownPath));
    assert.ok(fs.existsSync(out.notesPath));
    const notes = readCleanupAiNotes(tmp);
    assert.equal(notes.safeDirectories[0].path, 'coverage');
});
