const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildHistoryEntry, appendScanHistory, repairHistoryEntry, resolveHistoryEntryForReport } = require('../src/lib/scan-history');

test('buildHistoryEntry uses gate warning and blocking counts', () => {
    const entry = buildHistoryEntry({
        generatedAt: '2026-05-30T12:00:00.000Z',
        qualityScore: 100,
        gate: { pass: true, blockingCount: 0, warningCount: 7 },
        severityCounts: { medium: 7 },
        issueCount: 7
    });
    assert.equal(entry.issueCount, 7);
    assert.equal(entry.warningCount, 7);
    assert.equal(entry.blockingCount, 0);
    assert.equal(entry.qualityScore, 100);
});

test('repairHistoryEntry fixes warn-only quality score drift', () => {
    const repaired = repairHistoryEntry({
        date: '2026-05-30T09:55:19.765Z',
        issueCount: 71,
        qualityScore: 15,
        gatePass: true,
        severityCounts: { critical: 0, high: 0, medium: 71, low: 0 }
    });
    assert.equal(repaired.qualityScore, 100);
    assert.equal(repaired.issueCount, 71);
});

test('resolveHistoryEntryForReport matches report timestamp', () => {
    const history = [
        { scanId: 'old', date: '2026-05-30T10:06:07.857Z', issueCount: 66 },
        { scanId: 'new', date: '2026-05-30T10:18:20.950Z', issueCount: 7 }
    ];
    const entry = resolveHistoryEntryForReport(history, { generatedAt: '2026-05-30T10:18:20.950Z' });
    assert.equal(entry.scanId, 'new');
});

test('appendScanHistory dedupes identical consecutive entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-history-'));
    const report = {
        generatedAt: '2026-05-30T12:00:00.000Z',
        qualityScore: 100,
        gate: { pass: true, blockingCount: 0, warningCount: 3 },
        severityCounts: { medium: 3 },
        filesAnalyzed: 100
    };
    const first = appendScanHistory(dir, report);
    const second = appendScanHistory(dir, report);
    assert.equal(first.appended, true);
    assert.equal(second.appended, false);
    assert.equal(second.history.length, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});
