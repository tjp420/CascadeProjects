/**
 * Sync measured baselines into .simplebeacon/baseline.json
 */

const fs = require('fs');
const path = require('path');
const { loadSimplebeaconConfig } = require('./config');
const {
    checkJestBaseline,
    parseJestSummary,
    runCommand,
    readJestResultCache
} = require('./rules/jest-baseline');
const { withTransaction } = require('./lib/transaction-manager');
const { writeManagedFileSync } = require('./lib/safe-write');
const { validateJSON, validateNotEmpty } = require('./lib/file-validator');
const { sanitizePath } = require('./lib/path-sanitizer');

const JEST_CONFIG_CANDIDATES = [
    'jest.config.js',
    'jest.config.cjs',
    'jest.config.mjs',
    'jest.config.ts'
];

async function jestConfigExists(baseDir) {
    for (const name of JEST_CONFIG_CANDIDATES) {
        try {
            await fs.promises.access(path.join(baseDir, name));
            return true;
        } catch {
            // File doesn't exist, continue checking
        }
    }
    return false;
}

function isJestBaselineEnabled(config) {
    const ruleOptions = config.rules?.['jest-baseline'] || {};
    return ruleOptions.enabled === true || ruleOptions.runTests === true;
}

async function readLatestGateReport(baseDir) {
    const reportPath = path.join(baseDir, '.simplebeacon', 'report.json');
    try {
        const content = await fs.promises.readFile(reportPath, 'utf8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function applyReportMetricsToBaseline(baseline, report) {
    if (!report || typeof report !== 'object') return baseline;
    const next = { ...baseline };
    if (report.pageSampleSchemaChecked != null) {
        const passed = report.pageSampleSchemaPassed ?? report.schemaPassed ?? 0;
        const checked = report.pageSampleSchemaChecked ?? report.schemaChecked ?? 0;
        next.pageSamplesLabel = `${passed}/${checked}`;
        next.pageSampleSpecCount = checked;
    }
    if (report.qualityScore != null && next.qualityScore == null) {
        next.qualityScore = report.qualityScore;
    }
    if (report.gate?.pass != null) {
        next.lastGatePass = report.gate.pass;
    }
    return next;
}

async function writeBaselineFile(config, baseline, options = {}) {
    const baselineContent = `${JSON.stringify(baseline, null, 2)}\n`;
    if (options.dryRun) {
        return {
            dryRun: true,
            baselinePath: config.baselinePath,
            baseline,
            plannedActions: [{
                action: fs.existsSync(config.baselinePath) ? 'overwrite' : 'create',
                path: config.baselinePath
            }]
        };
    }
    await withTransaction(async (transaction) => {
        writeManagedFileSync(config.baselinePath, baselineContent, {
            force: true,
            transaction,
            validators: [validateJSON, validateNotEmpty]
        });
    });
    return {
        baselinePath: config.baselinePath,
        baseline
    };
}

async function syncJestBaseline(baseDir, options = {}) {
    const sanitizedBaseDir = sanitizePath(baseDir, baseDir);
    const config = loadSimplebeaconConfig(sanitizedBaseDir, options.config);
    const ruleOptions = config.rules?.['jest-baseline'] || {};
    const testCommand = options.testCommand
        || ruleOptions.testCommand
        || 'npm test -- --no-coverage --passWithNoTests';

    if (!(await jestConfigExists(sanitizedBaseDir))) {
        throw new Error('Jest is not configured in this project (missing jest.config.js)');
    }

    const result = await runCommand(sanitizedBaseDir, testCommand, options.timeoutMs || 300000);
    const summary = parseJestSummary(result.output);

    if (!summary) {
        throw new Error('Could not parse Jest summary — run npm test locally and check output format');
    }

    if (summary.testsFailed > 0 || (result.code !== 0 && summary.testsTotal > 0)) {
        throw new Error(
            `Jest reported failures (${summary.testsPassed}/${summary.testsTotal} passed) — fix tests before syncing baseline`
        );
    }

    const baseline = applyReportMetricsToBaseline({
        ...config.baseline,
        jestTestsPassing: summary.testsPassed,
        jestTestsLabel: `${summary.testsPassed}/${summary.testsTotal}`,
        jestSuites: summary.suitesPassed ?? config.baseline.jestSuites ?? null,
        syncedAt: new Date().toISOString()
    }, await readLatestGateReport(sanitizedBaseDir));

    const written = await writeBaselineFile(config, baseline, options);
    return {
        ...written,
        summary,
        jestSynced: true
    };
}

async function syncMeasuredBaseline(baseDir, options = {}) {
    const sanitizedBaseDir = sanitizePath(baseDir, baseDir);
    const config = loadSimplebeaconConfig(sanitizedBaseDir, options.config);
    const report = await readLatestGateReport(sanitizedBaseDir);
    let baseline = applyReportMetricsToBaseline({
        ...config.baseline,
        syncedAt: new Date().toISOString()
    }, report);

    let summary = null;
    let jestSynced = false;
    let jestNote = null;

    if (isJestBaselineEnabled(config)) {
        try {
            const jestResult = await syncJestBaseline(sanitizedBaseDir, options);
            return {
                ...jestResult,
                jestSynced: true,
                pageSamplesLabel: jestResult.baseline.pageSamplesLabel ?? baseline.pageSamplesLabel ?? null
            };
        } catch (error) {
            jestNote = error.message;
            const cached = readJestResultCache(sanitizedBaseDir);
            if (cached?.testsTotal != null) {
                baseline.jestTestsPassing = cached.testsPassed;
                baseline.jestTestsLabel = `${cached.testsPassed}/${cached.testsTotal}`;
                baseline.jestSuites = cached.suitesPassed ?? baseline.jestSuites ?? null;
            }
        }
    } else {
        const cached = readJestResultCache(sanitizedBaseDir);
        if (cached?.testsTotal != null) {
            baseline.jestTestsPassing = cached.testsPassed;
            baseline.jestTestsLabel = `${cached.testsPassed}/${cached.testsTotal}`;
            baseline.jestSuites = cached.suitesPassed ?? baseline.jestSuites ?? null;
        } else if (!baseline.jestTestsLabel) {
            baseline.jestTestsLabel = 'jest-baseline-disabled';
        }
    }

    const written = await writeBaselineFile(config, baseline, options);
    return {
        ...written,
        summary,
        jestSynced,
        jestNote,
        pageSamplesLabel: baseline.pageSamplesLabel ?? null
    };
}

async function verifyJestBaseline(baseDir, options = {}) {
    const sanitizedBaseDir = sanitizePath(baseDir, baseDir);
    const config = loadSimplebeaconConfig(sanitizedBaseDir, options.config);
    return checkJestBaseline(sanitizedBaseDir, {
        baseline: config.baseline,
        runTests: true,
        testCommand: options.testCommand || config.rules?.['jest-baseline']?.testCommand,
        timeoutMs: options.timeoutMs
    });
}

module.exports = {
    syncJestBaseline,
    syncMeasuredBaseline,
    verifyJestBaseline,
    applyReportMetricsToBaseline,
    isJestBaselineEnabled,
    jestConfigExists
};
