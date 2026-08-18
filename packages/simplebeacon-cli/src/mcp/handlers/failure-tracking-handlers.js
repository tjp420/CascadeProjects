/**
 * MCP failure-tracking handlers — get_failure_log, get_improvement_signals,
 * log_validation_run, get_validation_history
 *
 * These tools give AI coding agents visibility into repeated failure patterns
 * and a way to log validation results so improvement is measurable.
 */

const { readFailureLog, getFailureSummary, appendFailure, resolveFailure } = require('../../lib/failure-log');
const { readSignals, rebuildSignals, resolveSignal, getActiveSignals } = require('../../lib/improvement-signals');
const { logValidationRun, getRunSummary, getRecentRuns } = require('../../lib/validation-runs');

function createFailureTrackingHandlers({ withGuard, resolveProjectRoot, formatToolResult }) {
    return {
        get_failure_log: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            const projectRoot = resolveProjectRoot(args.projectRoot);
            const unresolvedOnly = args.unresolvedOnly === true;
            const since = args.since || null;
            const summary = args.summary === true;

            if (summary) {
                const grouped = getFailureSummary(projectRoot, { unresolvedOnly, since });
                return formatToolResult({
                    summary: grouped,
                    totalPatterns: grouped.length,
                    unresolvedOnly,
                    since
                });
            }

            const log = readFailureLog(projectRoot);
            let filtered = log;
            if (unresolvedOnly) filtered = filtered.filter((e) => !e.resolved);
            if (since) {
                const sinceMs = Date.parse(since);
                if (!Number.isNaN(sinceMs)) {
                    filtered = filtered.filter((e) => Date.parse(e.timestamp) >= sinceMs);
                }
            }

            return formatToolResult({
                failures: filtered.slice(-50),
                total: filtered.length,
                unresolved: filtered.filter((e) => !e.resolved).length,
                unresolvedOnly,
                since
            });
        }),

        get_improvement_signals: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            const projectRoot = resolveProjectRoot(args.projectRoot);
            const activeOnly = args.activeOnly !== false; // default true

            // Rebuild signals from current failure log
            rebuildSignals(projectRoot);

            const signals = activeOnly ? getActiveSignals(projectRoot) : readSignals(projectRoot);

            return formatToolResult({
                signals,
                total: signals.length,
                activeOnly,
                criticalCount: signals.filter((s) => s.priority === 'critical' && !s.resolved).length,
                highCount: signals.filter((s) => s.priority === 'high' && !s.resolved).length
            });
        }),

        log_validation_run: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (!args.runType) throw new Error('Missing required argument: runType');
            if (typeof args.pass !== 'number') throw new Error('Missing required argument: pass (number)');
            if (typeof args.failures !== 'number') throw new Error('Missing required argument: failures (number)');

            const projectRoot = resolveProjectRoot(args.projectRoot);

            const result = logValidationRun(projectRoot, {
                runType: args.runType,
                pass: args.pass,
                failures: args.failures,
                notes: args.notes || null,
                failureInputs: args.failureInputs || [],
                projectName: args.projectName || 'default'
            });

            return formatToolResult({
                logged: true,
                runId: result.entry.id,
                runType: result.entry.runType,
                pass: result.entry.pass,
                failures: result.entry.failures,
                failureIdsLogged: result.failureIds.length,
                signalsUpdated: result.signalsUpdated
            });
        }),

        get_validation_history: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            const projectRoot = resolveProjectRoot(args.projectRoot);
            const limit = Math.min(args.limit || 20, 100);
            const runType = args.runType || null;
            const since = args.since || null;

            const summary = getRunSummary(projectRoot, { since, runType });
            const recent = getRecentRuns(projectRoot, limit);

            return formatToolResult({
                summary,
                recentRuns: recent,
                totalRuns: summary.totalRuns
            });
        })
    };
}

module.exports = { createFailureTrackingHandlers };
