/**
 * Validation runs tracker — logs pass/fail results for scan, compile, and smoke-test runs.
 * Writes to .simplebeacon/validation-runs.json.
 *
 * Each run entry captures: run type, pass/fail counts, notes, and optional failure IDs.
 * This is the "top-level" tracker — individual failures go to failure-log.js.
 */

const fs = require('fs');
const path = require('path');
const { appendFailures } = require('./failure-log');
const { rebuildSignals } = require('./improvement-signals');

const MAX_RUN_ENTRIES = 100;
const RUNS_FILENAME = 'validation-runs.json';

/**
 * Build a validation run entry.
 * @param {object} input
 * @param {string} input.runType - 'scan' | 'compile' | 'smoke_test' | 'gate' | 'full'
 * @param {number} input.pass - number of passing checks
 * @param {number} input.failures - number of failing checks
 * @param {string} [input.notes] - human-readable notes
 * @param {string} [input.projectName] - project identifier
 * @param {Array} [input.failureInputs] - failure entry inputs to log alongside this run
 * @param {number} [input.durationMs] - run duration in milliseconds
 * @returns {object} run entry
 */
function buildRunEntry(input = {}) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        projectName: input.projectName || 'default',
        runType: input.runType || 'unknown',
        pass: input.pass || 0,
        failures: input.failures || 0,
        notes: input.notes || null,
        durationMs: input.durationMs || null,
        failureIds: []
    };
}

/**
 * Read validation runs from disk.
 * @param {string} projectRoot
 * @returns {Array}
 */
function readRuns(projectRoot) {
    const runsPath = path.join(projectRoot, '.simplebeacon', RUNS_FILENAME);
    try {
        const data = JSON.parse(fs.readFileSync(runsPath, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Log a validation run. If failureInputs are provided, they are appended to the failure log
 * and their IDs are linked to this run. Signals are rebuilt after failures are logged.
 * @param {string} projectRoot
 * @param {object} input - run entry input (see buildRunEntry)
 * @param {object} [options] - { dryRun: boolean }
 * @returns {{ runs: Array, entry: object, failureIds: Array, signalsUpdated: number }}
 */
function logValidationRun(projectRoot, input, options = {}) {
    const entry = buildRunEntry(input);
    let failureIds = [];

    // Log individual failures if provided
    if (input.failureInputs && input.failureInputs.length > 0) {
        const failResult = appendFailures(projectRoot, input.failureInputs, options);
        failureIds = failResult.log
            .filter((e) => input.failureInputs.some((fi) =>
                e.filePath === (fi.filePath || null) &&
                e.errorType === (fi.errorType || null) &&
                e.message === (fi.message || 'Unknown failure')
            ))
            .map((e) => e.id);
        entry.failureIds = failureIds;

        // Rebuild signals after new failures
        if (!options.dryRun) {
            rebuildSignals(projectRoot);
        }
    }

    // Append run entry
    let runs = readRuns(projectRoot);
    runs.push(entry);
    if (runs.length > MAX_RUN_ENTRIES) {
        runs = runs.slice(-MAX_RUN_ENTRIES);
    }

    if (!options.dryRun) {
        const runsPath = path.join(projectRoot, '.simplebeacon', RUNS_FILENAME);
        fs.mkdirSync(path.dirname(runsPath), { recursive: true });
        fs.writeFileSync(runsPath, `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
    }

    return { runs, entry, failureIds, signalsUpdated: failureIds.length };
}

/**
 * Get run summary (pass rate by run type).
 * @param {string} projectRoot
 * @param {object} [options] - { since: ISO date string, runType: string }
 * @returns {object} summary with per-type pass rates
 */
function getRunSummary(projectRoot, options = {}) {
    let runs = readRuns(projectRoot);

    if (options.since) {
        const sinceMs = Date.parse(options.since);
        if (!Number.isNaN(sinceMs)) {
            runs = runs.filter((r) => Date.parse(r.timestamp) >= sinceMs);
        }
    }

    if (options.runType) {
        runs = runs.filter((r) => r.runType === options.runType);
    }

    const byType = {};
    for (const run of runs) {
        if (!byType[run.runType]) {
            byType[run.runType] = {
                runType: run.runType,
                totalRuns: 0,
                passingRuns: 0,
                failingRuns: 0,
                totalChecks: 0,
                totalFailures: 0,
                passRate: 0
            };
        }
        const t = byType[run.runType];
        t.totalRuns++;
        t.totalChecks += run.pass + run.failures;
        t.totalFailures += run.failures;
        if (run.failures === 0) {
            t.passingRuns++;
        } else {
            t.failingRuns++;
        }
    }

    for (const t of Object.values(byType)) {
        t.passRate = t.totalRuns > 0 ? (t.passingRuns / t.totalRuns) : 0;
    }

    return {
        totalRuns: runs.length,
        byType: Object.values(byType).sort((a, b) => b.totalRuns - a.totalRuns)
    };
}

/**
 * Get recent runs (most recent first).
 * @param {string} projectRoot
 * @param {number} [limit=20]
 * @returns {Array}
 */
function getRecentRuns(projectRoot, limit = 20) {
    const runs = readRuns(projectRoot);
    return runs.slice(-limit).reverse();
}

module.exports = {
    buildRunEntry,
    readRuns,
    logValidationRun,
    getRunSummary,
    getRecentRuns,
    MAX_RUN_ENTRIES
};
