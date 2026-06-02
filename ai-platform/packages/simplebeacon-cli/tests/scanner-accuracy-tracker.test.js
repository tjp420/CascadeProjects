const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    runScannerAccuracyTracker,
    runAndRecordAccuracyTracker,
    loadAccuracyHistory,
    saveAccuracyHistory,
    computeAccuracyDelta,
    formatAccuracyReport,
    buildAccuracyEntry,
    FIXTURES,
    resolveCorpusRoot
} = require('../src/lib/scanner-accuracy-tracker');

test('resolveCorpusRoot returns default path', () => {
    const root = resolveCorpusRoot();
    assert.ok(root.includes('simplebeacon-rule-tests'));
});

test('buildAccuracyEntry computes TP/FP/FN/TN for positive fixture', () => {
    const report = {
        rawIssues: [
            { type: 'Credential Pattern', pattern: 'stripe-key', severity: 'critical', filePath: 'a.js' },
            { type: 'Credential Pattern', pattern: 'generic-api-key', severity: 'medium', filePath: 'a.js' }
        ]
    };
    const fixture = FIXTURES.find((f) => f.id === 'positive-test');
    const entry = buildAccuracyEntry(report, fixture);
    assert.equal(entry.expectedFindings, true);
    assert.equal(entry.truePositives, 2);
    assert.equal(entry.falsePositives, 0);
    assert.equal(entry.falseNegatives, 0);
    assert.equal(entry.precision, 1);
    assert.equal(entry.recall, 1);
});

test('buildAccuracyEntry computes TN for negative fixture with no findings', () => {
    const report = { rawIssues: [] };
    const fixture = FIXTURES.find((f) => f.id === 'negative-test-1');
    const entry = buildAccuracyEntry(report, fixture);
    assert.equal(entry.expectedFindings, false);
    assert.equal(entry.truePositives, 0);
    assert.equal(entry.falsePositives, 0);
    assert.equal(entry.falseNegatives, 0);
    assert.equal(entry.trueNegatives, 1);
    assert.equal(entry.precision, 1);
    assert.equal(entry.recall, 1);
});

test('buildAccuracyEntry computes FP for negative fixture with unexpected findings', () => {
    const report = {
        rawIssues: [
            { type: 'Credential Pattern', pattern: 'stripe-key', severity: 'critical', filePath: 'a.js' }
        ]
    };
    const fixture = FIXTURES.find((f) => f.id === 'negative-test-1');
    const entry = buildAccuracyEntry(report, fixture);
    assert.equal(entry.falsePositives, 1);
    assert.equal(entry.trueNegatives, 0);
    assert.equal(entry.precision, 0);
});

test('computeAccuracyDelta returns null when no previous', () => {
    const delta = computeAccuracyDelta({ precision: 1 }, null);
    assert.equal(delta, null);
});

test('computeAccuracyDelta detects precision improvement', () => {
    const current = { precision: 0.9, recall: 0.8, f1: 0.85, truePositives: 9, falsePositives: 1, falseNegatives: 2 };
    const previous = { precision: 0.8, recall: 0.8, f1: 0.8, truePositives: 8, falsePositives: 2, falseNegatives: 2 };
    const delta = computeAccuracyDelta(current, previous);
    assert.ok(Math.abs(delta.precisionDelta - 0.1) < 1e-6);
    assert.equal(delta.regression, false);
});

test('computeAccuracyDelta detects regression from new false positives', () => {
    const current = { precision: 0.8, recall: 0.8, f1: 0.8, truePositives: 8, falsePositives: 2, falseNegatives: 2 };
    const previous = { precision: 0.9, recall: 0.8, f1: 0.85, truePositives: 9, falsePositives: 1, falseNegatives: 2 };
    const delta = computeAccuracyDelta(current, previous);
    assert.ok(Math.abs(delta.precisionDelta - (-0.1)) < 1e-6);
    assert.equal(delta.regression, true);
});

test('formatAccuracyReport includes aggregate and fixture details', () => {
    const record = {
        generatedAt: new Date().toISOString(),
        aggregate: {
            precision: 1,
            recall: 0.667,
            f1: 0.8,
            truePositives: 2,
            falsePositives: 0,
            falseNegatives: 1,
            trueNegatives: 1
        },
        fixtures: [
            { fixtureId: 'positive-test', expectedFindings: true, actualFindings: 2, description: 'hardcoded creds', precision: 1, recall: 0.667, issues: [] }
        ]
    };
    const text = formatAccuracyReport(record);
    assert.ok(text.includes('Precision: 100.0%'));
    assert.ok(text.includes('positive-test'));
});

test('formatAccuracyReport includes delta when previous provided', () => {
    const current = {
        generatedAt: new Date().toISOString(),
        aggregate: { precision: 1, recall: 1, f1: 1, truePositives: 3, falsePositives: 0, falseNegatives: 0, trueNegatives: 1 },
        fixtures: []
    };
    const previous = { precision: 0.8, recall: 0.8, f1: 0.8, truePositives: 2, falsePositives: 1, falseNegatives: 1, trueNegatives: 1 };
    const text = formatAccuracyReport(current, previous);
    assert.ok(text.includes('Delta vs previous run'));
});

test('saveAccuracyHistory appends and limits to 30 entries', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tracker-'));
    const history = [];
    for (let i = 0; i < 28; i++) {
        history.push({ generatedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, aggregate: {} });
    }
    fs.mkdirSync(path.join(tmpDir, '.simplebeacon'), { recursive: true });
    const historyPath = path.join(tmpDir, '.simplebeacon', 'scanner-accuracy.json');
    fs.writeFileSync(historyPath, JSON.stringify(history));

    const current = { generatedAt: '2026-02-01T00:00:00Z', aggregate: { precision: 1 } };
    saveAccuracyHistory(tmpDir, current);

    const loaded = loadAccuracyHistory(tmpDir);
    assert.equal(loaded.length, 29);

    saveAccuracyHistory(tmpDir, { generatedAt: '2026-02-02T00:00:00Z', aggregate: { precision: 1 } });
    saveAccuracyHistory(tmpDir, { generatedAt: '2026-02-03T00:00:00Z', aggregate: { precision: 1 } });
    const loaded2 = loadAccuracyHistory(tmpDir);
    assert.equal(loaded2.length, 30);
    assert.equal(loaded2[loaded2.length - 1].generatedAt, '2026-02-03T00:00:00Z');

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('runScannerAccuracyTracker against real fixture corpus', async () => {
    const result = await runScannerAccuracyTracker();
    assert.ok(result.generatedAt);
    assert.ok(result.aggregate);
    assert.equal(result.fixtures.length, FIXTURES.length);

    for (const fixture of FIXTURES) {
        const entry = result.fixtures.find((f) => f.fixtureId === fixture.id);
        assert.ok(entry, `Missing fixture entry: ${fixture.id}`);

        if (fixture.expectedFindings) {
            assert.ok(
                entry.actualFindings >= fixture.minFindings,
                `${fixture.id} should have >= ${fixture.minFindings} findings, got ${entry.actualFindings}`
            );
            assert.ok(entry.actualFindings > 0, `${fixture.id} should have > 0 findings`);
        } else {
            assert.equal(
                entry.actualFindings,
                0,
                `${fixture.id} should have 0 findings, got ${entry.actualFindings}`
            );
        }
    }

    assert.ok(result.aggregate.precision >= 0);
    assert.ok(result.aggregate.recall >= 0);
});

test('runAndRecordAccuracyTracker writes history and returns report', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-tracker-'));
    fs.mkdirSync(path.join(tmpDir, '.simplebeacon'), { recursive: true });

    const { record, history, report, regression } = await runAndRecordAccuracyTracker(tmpDir);
    assert.ok(record.generatedAt);
    assert.equal(history.length, 1);
    assert.ok(report.includes('Scanner Accuracy Tracker'));
    assert.equal(regression, false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
