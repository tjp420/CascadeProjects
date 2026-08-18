const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    buildFailureEntry,
    readFailureLog,
    appendFailure,
    appendFailures,
    resolveFailure,
    getFailureSummary
} = require('../src/lib/failure-log');

const {
    buildSignalKey,
    getSuggestedAction,
    readSignals,
    rebuildSignals,
    resolveSignal,
    getActiveSignals,
    ACTION_LIBRARY,
    SIGNAL_THRESHOLD
} = require('../src/lib/improvement-signals');

const {
    buildRunEntry,
    readRuns,
    logValidationRun,
    getRunSummary,
    getRecentRuns
} = require('../src/lib/validation-runs');

function createTempProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-test-'));
    return dir;
}

function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
}

// ── failure-log.js ──

test('buildFailureEntry creates a well-formed entry', () => {
    const entry = buildFailureEntry({
        category: 'compile',
        source: 'engine',
        message: 'Unexpected token',
        filePath: 'scripts/main.zs',
        errorType: 'syntax_error',
        severity: 'high',
        context: { line: 42 }
    });
    assert.strictEqual(entry.category, 'compile');
    assert.strictEqual(entry.source, 'engine');
    assert.strictEqual(entry.message, 'Unexpected token');
    assert.strictEqual(entry.filePath, 'scripts/main.zs');
    assert.strictEqual(entry.errorType, 'syntax_error');
    assert.strictEqual(entry.severity, 'high');
    assert.strictEqual(entry.resolved, false);
    assert.ok(entry.id);
    assert.ok(entry.timestamp);
});

test('buildFailureEntry applies defaults', () => {
    const entry = buildFailureEntry({});
    assert.strictEqual(entry.category, 'unknown');
    assert.strictEqual(entry.source, 'unknown');
    assert.strictEqual(entry.message, 'Unknown failure');
    assert.strictEqual(entry.severity, 'medium');
    assert.strictEqual(entry.projectName, 'default');
});

test('appendFailure writes to .simplebeacon/failure-log.json', () => {
    const dir = createTempProject();
    try {
        const result = appendFailure(dir, {
            category: 'compile',
            source: 'engine',
            message: 'Test error',
            errorType: 'syntax_error'
        });
        assert.strictEqual(result.appended, true);
        assert.strictEqual(result.log.length, 1);

        const log = readFailureLog(dir);
        assert.strictEqual(log.length, 1);
        assert.strictEqual(log[0].message, 'Test error');
    } finally {
        cleanup(dir);
    }
});

test('appendFailure deduplicates within 60s', () => {
    const dir = createTempProject();
    try {
        appendFailure(dir, { category: 'compile', source: 'engine', message: 'Dup error', errorType: 'syntax_error' });
        const result2 = appendFailure(dir, { category: 'compile', source: 'engine', message: 'Dup error', errorType: 'syntax_error' });
        assert.strictEqual(result2.appended, false);
        assert.strictEqual(result2.log.length, 1);
    } finally {
        cleanup(dir);
    }
});

test('appendFailures logs multiple entries at once', () => {
    const dir = createTempProject();
    try {
        const result = appendFailures(dir, [
            { category: 'compile', source: 'engine', message: 'Error 1', errorType: 'syntax_error' },
            { category: 'runtime', source: 'game', message: 'Error 2', errorType: 'missing_asset' },
            { category: 'scan', source: 'simplebeacon', message: 'Error 3', errorType: 'placeholder_value' }
        ]);
        assert.strictEqual(result.appended, 3);
        assert.strictEqual(result.skipped, 0);
        assert.strictEqual(result.log.length, 3);
    } finally {
        cleanup(dir);
    }
});

test('resolveFailure marks an entry as resolved', () => {
    const dir = createTempProject();
    try {
        const result = appendFailure(dir, { category: 'compile', source: 'engine', message: 'Fix me', errorType: 'syntax_error' });
        const resolveResult = resolveFailure(dir, result.entry.id, 'Fixed the syntax', 'Missing semicolon');
        assert.strictEqual(resolveResult.resolved, true);
        const log = readFailureLog(dir);
        const entry = log.find((e) => e.id === result.entry.id);
        assert.strictEqual(entry.resolved, true);
        assert.strictEqual(entry.fixSummary, 'Fixed the syntax');
        assert.strictEqual(entry.rootCause, 'Missing semicolon');
    } finally {
        cleanup(dir);
    }
});

test('getFailureSummary groups by category, source, errorType', () => {
    const dir = createTempProject();
    try {
        appendFailures(dir, [
            { category: 'compile', source: 'engine', message: 'Err A', errorType: 'syntax_error', filePath: 'a.zs' },
            { category: 'compile', source: 'engine', message: 'Err B', errorType: 'syntax_error', filePath: 'b.zs' },
            { category: 'runtime', source: 'game', message: 'Err C', errorType: 'missing_asset', filePath: 'c.zs' }
        ]);
        const summary = getFailureSummary(dir);
        assert.strictEqual(summary.length, 2);
        const compileGroup = summary.find((g) => g.category === 'compile');
        assert.strictEqual(compileGroup.count, 2);
        assert.ok(compileGroup.files.includes('a.zs'));
        assert.ok(compileGroup.files.includes('b.zs'));
    } finally {
        cleanup(dir);
    }
});

test('getFailureSummary respects unresolvedOnly filter', () => {
    const dir = createTempProject();
    try {
        const r1 = appendFailure(dir, { category: 'compile', source: 'engine', message: 'Err A', errorType: 'syntax_error' });
        appendFailure(dir, { category: 'compile', source: 'engine', message: 'Err B', errorType: 'syntax_error' });
        resolveFailure(dir, r1.entry.id);
        const summary = getFailureSummary(dir, { unresolvedOnly: true });
        const compileGroup = summary.find((g) => g.category === 'compile');
        assert.strictEqual(compileGroup.count, 1);
    } finally {
        cleanup(dir);
    }
});

// ── improvement-signals.js ──

test('buildSignalKey creates correct key', () => {
    assert.strictEqual(buildSignalKey('compile', 'syntax_error'), 'compile|syntax_error');
    assert.strictEqual(buildSignalKey('runtime', 'missing_asset'), 'runtime|missing_asset');
});

test('getSuggestedAction returns action from library', () => {
    const action = getSuggestedAction('compile', 'syntax_error');
    assert.ok(action);
    assert.ok(action.action);
    assert.ok(action.priority);
});

test('getSuggestedAction falls back to category match', () => {
    const action = getSuggestedAction('compile', 'unknown_new_error');
    assert.ok(action);
    assert.ok(action.action.includes('compile'));
});

test('getSuggestedAction falls back to generic', () => {
    const action = getSuggestedAction('unknown_category', 'unknown_error');
    assert.ok(action);
    assert.strictEqual(action.priority, 'medium');
});

test('rebuildSignals creates signals for repeated patterns', () => {
    const dir = createTempProject();
    try {
        appendFailures(dir, [
            { category: 'compile', source: 'engine', message: 'Err A', errorType: 'syntax_error', filePath: 'a.zs' },
            { category: 'compile', source: 'engine', message: 'Err B', errorType: 'syntax_error', filePath: 'b.zs' },
            { category: 'runtime', source: 'game', message: 'Err C', errorType: 'missing_asset', filePath: 'c.zs' }
        ]);
        const result = rebuildSignals(dir);
        // syntax_error appears 2x (>= SIGNAL_THRESHOLD), missing_asset appears 1x (< threshold)
        const syntaxSignal = result.signals.find((s) => s.errorType === 'syntax_error');
        assert.ok(syntaxSignal, 'should create signal for repeated syntax_error');
        assert.strictEqual(syntaxSignal.occurrenceCount, 2);
        assert.strictEqual(syntaxSignal.priority, 'high');
        assert.ok(syntaxSignal.suggestedAction);

        const missingAssetSignal = result.signals.find((s) => s.errorType === 'missing_asset');
        assert.strictEqual(missingAssetSignal, undefined, 'should not create signal for single occurrence');
    } finally {
        cleanup(dir);
    }
});

test('resolveSignal marks a signal as resolved', () => {
    const dir = createTempProject();
    try {
        appendFailures(dir, [
            { category: 'compile', source: 'engine', message: 'Err A', errorType: 'syntax_error' },
            { category: 'compile', source: 'engine', message: 'Err B', errorType: 'syntax_error' }
        ]);
        const result = rebuildSignals(dir);
        const signalId = result.signals[0].id;
        const resolveResult = resolveSignal(dir, signalId, 'Fixed by adding lint rule');
        assert.strictEqual(resolveResult.resolved, true);
        const active = getActiveSignals(dir);
        assert.strictEqual(active.length, 0);
    } finally {
        cleanup(dir);
    }
});

// ── validation-runs.js ──

test('buildRunEntry creates a well-formed entry', () => {
    const entry = buildRunEntry({
        runType: 'compile',
        pass: 5,
        failures: 2,
        notes: 'Engine parser failed'
    });
    assert.strictEqual(entry.runType, 'compile');
    assert.strictEqual(entry.pass, 5);
    assert.strictEqual(entry.failures, 2);
    assert.strictEqual(entry.notes, 'Engine parser failed');
    assert.ok(entry.id);
    assert.ok(entry.timestamp);
});

test('logValidationRun writes to .simplebeacon/validation-runs.json', () => {
    const dir = createTempProject();
    try {
        const result = logValidationRun(dir, {
            runType: 'scan',
            pass: 10,
            failures: 3,
            notes: 'Background gate run'
        });
        assert.ok(result.entry.id);
        assert.strictEqual(result.entry.runType, 'scan');
        assert.strictEqual(result.entry.pass, 10);
        assert.strictEqual(result.entry.failures, 3);

        const runs = readRuns(dir);
        assert.strictEqual(runs.length, 1);
    } finally {
        cleanup(dir);
    }
});

test('logValidationRun logs failures alongside the run', () => {
    const dir = createTempProject();
    try {
        const result = logValidationRun(dir, {
            runType: 'compile',
            pass: 0,
            failures: 2,
            notes: 'Compile failed',
            failureInputs: [
                { category: 'compile', source: 'engine', message: 'Syntax error', errorType: 'syntax_error', filePath: 'main.zs' },
                { category: 'compile', source: 'engine', message: 'Undefined symbol', errorType: 'undefined_symbol', filePath: 'main.zs' }
            ]
        });
        assert.ok(result.failureIds.length > 0);
        assert.ok(result.signalsUpdated > 0);
    } finally {
        cleanup(dir);
    }
});

test('getRunSummary calculates pass rates by type', () => {
    const dir = createTempProject();
    try {
        logValidationRun(dir, { runType: 'scan', pass: 10, failures: 0 });
        logValidationRun(dir, { runType: 'scan', pass: 8, failures: 2 });
        logValidationRun(dir, { runType: 'compile', pass: 0, failures: 5 });

        const summary = getRunSummary(dir);
        assert.strictEqual(summary.totalRuns, 3);
        const scanSummary = summary.byType.find((s) => s.runType === 'scan');
        assert.ok(scanSummary);
        assert.strictEqual(scanSummary.totalRuns, 2);
        assert.strictEqual(scanSummary.passingRuns, 1);
        assert.strictEqual(scanSummary.passRate, 0.5);
    } finally {
        cleanup(dir);
    }
});

test('getRecentRuns returns most recent first', () => {
    const dir = createTempProject();
    try {
        logValidationRun(dir, { runType: 'scan', pass: 1, failures: 0 });
        logValidationRun(dir, { runType: 'compile', pass: 1, failures: 0 });
        logValidationRun(dir, { runType: 'smoke_test', pass: 1, failures: 0 });

        const recent = getRecentRuns(dir, 2);
        assert.strictEqual(recent.length, 2);
        // Most recent first
        assert.strictEqual(recent[0].runType, 'smoke_test');
        assert.strictEqual(recent[1].runType, 'compile');
    } finally {
        cleanup(dir);
    }
});

// ── Integration: failure log → signals → validation runs ──

test('full loop: log failures, rebuild signals, check active signals', () => {
    const dir = createTempProject();
    try {
        // Log a validation run with failures
        logValidationRun(dir, {
            runType: 'compile',
            pass: 0,
            failures: 3,
            failureInputs: [
                { category: 'compile', source: 'engine', message: 'Syntax error near class', errorType: 'syntax_error', filePath: 'main.zs', severity: 'high' },
                { category: 'compile', source: 'engine', message: 'Syntax error in function', errorType: 'syntax_error', filePath: 'util.zs', severity: 'high' },
                { category: 'runtime', source: 'game', message: 'Texture not found: BLOOD1', errorType: 'missing_asset', filePath: 'actors/monster.zs', severity: 'medium' }
            ]
        });

        // Signals should be rebuilt automatically
        const signals = getActiveSignals(dir);
        // syntax_error appears 2x → signal; missing_asset appears 1x → no signal
        const syntaxSignal = signals.find((s) => s.errorType === 'syntax_error');
        assert.ok(syntaxSignal);
        assert.strictEqual(syntaxSignal.occurrenceCount, 2);
        assert.strictEqual(syntaxSignal.priority, 'high');

        const missingAssetSignal = signals.find((s) => s.errorType === 'missing_asset');
        assert.strictEqual(missingAssetSignal, undefined);
    } finally {
        cleanup(dir);
    }
});
