/**
 * Scanner accuracy tracker — measures precision/recall against a golden test corpus.
 *
 * Fixture repos under simplebeacon-rule-tests/ are the golden corpus:
 *   positive-test/        — known-bad files that MUST trigger findings
 *   negative-test-1/      — annotated seed data that MUST NOT trigger findings
 *   negative-test-2/      — path-excluded fixtures that MUST NOT trigger findings
 *
 * Results are stored in .simplebeacon/scanner-accuracy.json for delta tracking.
 */

const fs = require('fs');
const path = require('path');
const { runScan } = require('../scan');
const { loadSimplebeaconConfig } = require('../config');

const DEFAULT_CORPUS_ROOT = path.join(__dirname, '../../../../../simplebeacon-rule-tests');

const FIXTURES = [
    {
        id: 'positive-test',
        path: 'positive-test',
        description: 'Hardcoded credentials — must trigger findings',
        expectedFindings: true,
        minFindings: 2,
        rules: ['credential-pattern']
    },
    {
        id: 'negative-test-1',
        path: 'negative-test-1',
        description: 'Annotated seed data — must NOT trigger findings',
        expectedFindings: false,
        rules: ['credential-pattern']
    },
    {
        id: 'negative-test-2',
        path: 'negative-test-2',
        description: 'Path-excluded fixtures — must NOT trigger findings',
        expectedFindings: false,
        rules: ['credential-pattern']
    },
    {
        id: 'eu-ai-act-positive-test',
        path: 'eu-ai-act-positive-test',
        description: 'EU AI Act high-risk indicators — must trigger findings',
        expectedFindings: true,
        minFindings: 2,
        rules: ['eu-ai-act']
    },
    {
        id: 'eu-ai-act-negative-test',
        path: 'eu-ai-act-negative-test',
        description: 'Benign utility code — must NOT trigger EU AI Act findings',
        expectedFindings: false,
        rules: ['eu-ai-act']
    },
    {
        id: 'fiction-positive-test',
        path: 'fiction-positive-test',
        description: 'Hardcoded rejected fiction KPIs — must trigger findings',
        expectedFindings: true,
        minFindings: 4,
        rules: ['fiction-kpi']
    },
    {
        id: 'fiction-negative-test',
        path: 'fiction-negative-test',
        description: 'Dynamic realistic metrics — must NOT trigger fiction findings',
        expectedFindings: false,
        rules: ['fiction-kpi']
    },
    {
        id: 'token-bleed-positive-test',
        path: 'token-bleed-positive-test',
        description: 'Unbounded API calls without max_tokens — must trigger findings',
        expectedFindings: true,
        minFindings: 2,
        rules: ['token-bleed']
    },
    {
        id: 'token-bleed-negative-test',
        path: 'token-bleed-negative-test',
        description: 'Bounded API calls with max_tokens — must NOT trigger findings',
        expectedFindings: false,
        rules: ['token-bleed']
    }
];

function resolveCorpusRoot(options = {}) {
    return options.corpusRoot || DEFAULT_CORPUS_ROOT;
}

function buildAccuracyEntry(report, fixture) {
    const rawIssues = report.rawIssues || [];
    const normalize = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const fixtureRulesNormalized = fixture.rules.map(normalize);
    const relevant = rawIssues.filter((issue) =>
        fixtureRulesNormalized.some((rule) =>
            normalize(issue.type).includes(rule)
            || normalize(issue.pattern).includes(rule)
        )
    );

    const truePositives = fixture.expectedFindings ? relevant.length : 0;
    const falsePositives = fixture.expectedFindings ? 0 : relevant.length;
    const falseNegatives = fixture.expectedFindings
        ? Math.max(0, fixture.minFindings - relevant.length)
        : 0;
    const trueNegatives = fixture.expectedFindings ? 0 : (relevant.length === 0 ? 1 : 0);

    return {
        fixtureId: fixture.id,
        description: fixture.description,
        expectedFindings: fixture.expectedFindings,
        actualFindings: relevant.length,
        minFindings: fixture.minFindings,
        truePositives,
        falsePositives,
        falseNegatives,
        trueNegatives,
        precision: computePrecision(truePositives, falsePositives),
        recall: computeRecall(truePositives, falseNegatives),
        f1: computeF1(truePositives, falsePositives, falseNegatives),
        issues: relevant.map((issue) => ({
            type: issue.type,
            pattern: issue.pattern,
            severity: issue.severity,
            filePath: issue.filePath
        }))
    };
}

function computePrecision(tp, fp) {
    const denom = tp + fp;
    return denom === 0 ? 1 : tp / denom;
}

function computeRecall(tp, fn) {
    const denom = tp + fn;
    return denom === 0 ? 1 : tp / denom;
}

function computeF1(tp, fp, fn) {
    const precision = computePrecision(tp, fp);
    const recall = computeRecall(tp, fn);
    const denom = precision + recall;
    return denom === 0 ? 0 : (2 * precision * recall) / denom;
}

async function runAccuracyScan(fixture, corpusRoot, options = {}) {
    const fixturePath = path.join(corpusRoot, fixture.path);
    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Fixture path does not exist: ${fixturePath}`);
    }

    const report = await runScan(fixturePath, {
        offline: true,
        format: 'json',
        config: options.config || loadSimplebeaconConfig(fixturePath),
        extraPaths: [],
        ...options.scanOptions
    });

    return buildAccuracyEntry(report, fixture);
}

async function runScannerAccuracyTracker(options = {}) {
    const corpusRoot = resolveCorpusRoot(options);
    const results = [];

    for (const fixture of FIXTURES) {
        const entry = await runAccuracyScan(fixture, corpusRoot, options);
        results.push(entry);
    }

    const totals = results.reduce(
        (acc, r) => ({
            truePositives: acc.truePositives + r.truePositives,
            falsePositives: acc.falsePositives + r.falsePositives,
            falseNegatives: acc.falseNegatives + r.falseNegatives,
            trueNegatives: acc.trueNegatives + r.trueNegatives
        }),
        { truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 0 }
    );

    const aggregate = {
        precision: computePrecision(totals.truePositives, totals.falsePositives),
        recall: computeRecall(totals.truePositives, totals.falseNegatives),
        f1: computeF1(totals.truePositives, totals.falsePositives, totals.falseNegatives),
        ...totals
    };

    return {
        generatedAt: new Date().toISOString(),
        aggregate,
        fixtures: results
    };
}

function loadAccuracyHistory(platformRoot) {
    const historyPath = path.join(platformRoot, '.simplebeacon', 'scanner-accuracy.json');
    try {
        const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveAccuracyHistory(platformRoot, record, options = {}) {
    const historyPath = path.join(platformRoot, '.simplebeacon', 'scanner-accuracy.json');
    const history = loadAccuracyHistory(platformRoot);
    history.push(record);
    if (history.length > 30) {
        history.shift();
    }
    if (!options.dryRun) {
        fs.mkdirSync(path.dirname(historyPath), { recursive: true });
        fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    }
    return history;
}

function computeAccuracyDelta(current, previous) {
    if (!previous) return null;
    const delta = (key) => (current[key] ?? 0) - (previous[key] ?? 0);
    const relDelta = (key) => {
        const prev = previous[key] ?? 0;
        if (prev === 0) return current[key] ?? 0;
        return ((current[key] ?? 0) - prev) / prev;
    };

    return {
        precisionDelta: delta('precision'),
        recallDelta: delta('recall'),
        f1Delta: delta('f1'),
        precisionRelDelta: relDelta('precision'),
        recallRelDelta: relDelta('recall'),
        f1RelDelta: relDelta('f1'),
        truePositivesDelta: delta('truePositives'),
        falsePositivesDelta: delta('falsePositives'),
        falseNegativesDelta: delta('falseNegatives'),
        regression: (current.falsePositives > previous.falsePositives)
            || (current.truePositives < previous.truePositives)
    };
}

function formatAccuracyReport(record, previous = null) {
    const lines = [
        'Scanner Accuracy Tracker',
        `Generated: ${record.generatedAt}`,
        '',
        `Aggregate Precision: ${(record.aggregate.precision * 100).toFixed(1)}%`,
        `Aggregate Recall:    ${(record.aggregate.recall * 100).toFixed(1)}%`,
        `Aggregate F1:        ${(record.aggregate.f1 * 100).toFixed(1)}%`,
        `TP: ${record.aggregate.truePositives}  FP: ${record.aggregate.falsePositives}  FN: ${record.aggregate.falseNegatives}  TN: ${record.aggregate.trueNegatives}`,
        ''
    ];

    if (previous) {
        const delta = computeAccuracyDelta(record.aggregate, previous);
        lines.push(
            'Delta vs previous run:',
            `  Precision: ${delta.precisionDelta >= 0 ? '+' : ''}${(delta.precisionDelta * 100).toFixed(1)}pp`,
            `  Recall:    ${delta.recallDelta >= 0 ? '+' : ''}${(delta.recallDelta * 100).toFixed(1)}pp`,
            `  F1:        ${delta.f1Delta >= 0 ? '+' : ''}${(delta.f1Delta * 100).toFixed(1)}pp`,
            delta.regression ? '  ⚠ REGRESSION DETECTED' : '  ✓ No regression',
            ''
        );
    }

    for (const fixture of record.fixtures) {
        const status = fixture.expectedFindings
            ? (fixture.actualFindings >= fixture.minFindings ? '✓ PASS' : '✗ FAIL')
            : (fixture.actualFindings === 0 ? '✓ PASS' : '✗ FAIL');
        lines.push(`${fixture.fixtureId}: ${status} — ${fixture.actualFindings} findings (${fixture.description})`);
    }

    return lines.join('\n');
}

async function runAndRecordAccuracyTracker(platformRoot, options = {}) {
    const record = await runScannerAccuracyTracker(options);
    const history = loadAccuracyHistory(platformRoot);
    const previous = history.length ? history[history.length - 1].aggregate : null;
    const updated = saveAccuracyHistory(platformRoot, record, options);
    const report = formatAccuracyReport(record, previous);
    return { record, history: updated, report, regression: previous ? computeAccuracyDelta(record.aggregate, previous).regression : false };
}

module.exports = {
    runScannerAccuracyTracker,
    runAndRecordAccuracyTracker,
    loadAccuracyHistory,
    saveAccuracyHistory,
    computeAccuracyDelta,
    formatAccuracyReport,
    buildAccuracyEntry,
    FIXTURES,
    resolveCorpusRoot
};
