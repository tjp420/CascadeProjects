/**
 * Failure logging — writes structured failure entries to .simplebeacon/failure-log.json.
 * Builds on the same pattern as scan-history.js (JSON file, append-only, capped size).
 *
 * Each failure entry captures: category, source, file, error type, severity, message, context.
 * Repeated failures are aggregated into improvement signals (see improvement-signals.js).
 */

const fs = require('fs');
const path = require('path');

const MAX_FAILURE_ENTRIES = 200;
const FAILURE_LOG_FILENAME = 'failure-log.json';

/**
 * Build a failure entry from structured input.
 * @param {object} input
 * @param {string} input.category - 'compile' | 'runtime' | 'scan' | 'smoke_test' | 'gate' | 'asset'
 * @param {string} input.source - 'engine' | 'simplebeacon' | 'game' | 'ci' | 'agent'
 * @param {string} input.message - human-readable error message
 * @param {string} [input.filePath] - file where the failure occurred
 * @param {string} [input.errorType] - 'syntax_error' | 'missing_asset' | 'placeholder_value' | 'undefined_symbol' | etc.
 * @param {string} [input.severity] - 'low' | 'medium' | 'high' | 'critical' (default: 'medium')
 * @param {object} [input.context] - additional structured context (line numbers, asset names, etc.)
 * @param {string} [input.projectName] - project identifier (default: 'default')
 * @returns {object} failure entry
 */
function buildFailureEntry(input = {}) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        projectName: input.projectName || 'default',
        category: input.category || 'unknown',
        source: input.source || 'unknown',
        filePath: input.filePath || null,
        errorType: input.errorType || null,
        message: input.message || 'Unknown failure',
        severity: input.severity || 'medium',
        context: input.context || {},
        resolved: false,
        fixSummary: null,
        rootCause: null
    };
}

/**
 * Read the failure log from disk.
 * @param {string} projectRoot - project root directory
 * @returns {Array} failure entries
 */
function readFailureLog(projectRoot) {
    const logPath = path.join(projectRoot, '.simplebeacon', FAILURE_LOG_FILENAME);
    try {
        const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Append a failure entry to the log.
 * @param {string} projectRoot - project root directory
 * @param {object} input - failure entry input (see buildFailureEntry)
 * @param {object} [options] - { dryRun: boolean }
 * @returns {{ log: Array, entry: object, appended: boolean }}
 */
function appendFailure(projectRoot, input, options = {}) {
    const entry = buildFailureEntry(input);
    let log = readFailureLog(projectRoot);

    // Skip exact duplicates (same file, errorType, message within 60s)
    const recent = log.filter((e) => {
        if (e.filePath !== entry.filePath || e.errorType !== entry.errorType || e.message !== entry.message) return false;
        const ageMs = Date.parse(entry.timestamp) - Date.parse(e.timestamp);
        return !Number.isNaN(ageMs) && ageMs < 60000;
    });
    if (recent.length > 0) {
        return { log, entry: recent[recent.length - 1], appended: false };
    }

    log.push(entry);
    if (log.length > MAX_FAILURE_ENTRIES) {
        log = log.slice(-MAX_FAILURE_ENTRIES);
    }

    if (!options.dryRun) {
        const logPath = path.join(projectRoot, '.simplebeacon', FAILURE_LOG_FILENAME);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
    }

    return { log, entry, appended: true };
}

/**
 * Append multiple failures at once (e.g. from a compile or scan result).
 * @param {string} projectRoot
 * @param {Array} inputs - array of failure entry inputs
 * @param {object} [options]
 * @returns {{ log: Array, appended: number, skipped: number }}
 */
function appendFailures(projectRoot, inputs, options = {}) {
    let appended = 0;
    let skipped = 0;
    let log = readFailureLog(projectRoot);

    for (const input of inputs) {
        const entry = buildFailureEntry(input);

        // Check for duplicates against the in-memory log (not disk, since dryRun may not have written)
        const recent = log.filter((e) => {
            if (e.filePath !== entry.filePath || e.errorType !== entry.errorType || e.message !== entry.message) return false;
            const ageMs = Date.parse(entry.timestamp) - Date.parse(e.timestamp);
            return !Number.isNaN(ageMs) && ageMs < 60000;
        });

        if (recent.length > 0) {
            skipped++;
            continue;
        }

        log.push(entry);
        appended++;
    }

    if (log.length > MAX_FAILURE_ENTRIES) {
        log = log.slice(-MAX_FAILURE_ENTRIES);
    }

    if (!options.dryRun && appended > 0) {
        const logPath = path.join(projectRoot, '.simplebeacon', FAILURE_LOG_FILENAME);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
    }

    return { log, appended, skipped };
}

/**
 * Mark a failure as resolved.
 * @param {string} projectRoot
 * @param {string} failureId - failure entry ID
 * @param {string} [fixSummary] - what was done to fix it
 * @param {string} [rootCause] - root cause description
 * @returns {{ log: Array, resolved: boolean }}
 */
function resolveFailure(projectRoot, failureId, fixSummary, rootCause) {
    const log = readFailureLog(projectRoot);
    let resolved = false;

    for (const entry of log) {
        if (entry.id === failureId) {
            entry.resolved = true;
            entry.fixSummary = fixSummary || entry.fixSummary;
            entry.rootCause = rootCause || entry.rootCause;
            resolved = true;
            break;
        }
    }

    if (resolved) {
        const logPath = path.join(projectRoot, '.simplebeacon', FAILURE_LOG_FILENAME);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
    }

    return { log, resolved };
}

/**
 * Get grouped failure summary by category, source, errorType.
 * @param {string} projectRoot
 * @param {object} [options] - { unresolvedOnly: boolean, since: ISO date string }
 * @returns {Array} grouped summary
 */
function getFailureSummary(projectRoot, options = {}) {
    let log = readFailureLog(projectRoot);

    if (options.unresolvedOnly) {
        log = log.filter((e) => !e.resolved);
    }

    if (options.since) {
        const sinceMs = Date.parse(options.since);
        if (!Number.isNaN(sinceMs)) {
            log = log.filter((e) => Date.parse(e.timestamp) >= sinceMs);
        }
    }

    const groups = {};
    for (const entry of log) {
        const key = `${entry.category}|${entry.source}|${entry.errorType || 'unknown'}`;
        if (!groups[key]) {
            groups[key] = {
                category: entry.category,
                source: entry.source,
                errorType: entry.errorType || 'unknown',
                count: 0,
                files: new Set(),
                severities: new Set(),
                lastSeen: entry.timestamp,
                sampleMessage: entry.message
            };
        }
        groups[key].count++;
        if (entry.filePath) groups[key].files.add(entry.filePath);
        groups[key].severities.add(entry.severity);
        if (entry.timestamp > groups[key].lastSeen) {
            groups[key].lastSeen = entry.timestamp;
            groups[key].sampleMessage = entry.message;
        }
    }

    return Object.values(groups)
        .map((g) => ({
            ...g,
            files: [...g.files],
            severities: [...g.severities]
        }))
        .sort((a, b) => b.count - a.count);
}

module.exports = {
    buildFailureEntry,
    readFailureLog,
    appendFailure,
    appendFailures,
    resolveFailure,
    getFailureSummary,
    MAX_FAILURE_ENTRIES
};
