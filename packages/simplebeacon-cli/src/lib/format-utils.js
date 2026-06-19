/**
 * Format validation and payload selection utilities.
 * Extracted to avoid circular dependencies between commands.js and commands/scan.js.
 */

function validateFormat(format) {
    const valid = ['text', 'json', 'action-plan'];
    if (!valid.includes(format)) {
        throw new Error(`Invalid --format "${format}" — use ${valid.join(', ')}`);
    }
}

function selectPayload(report, gateResult, jsonReport, format) {
    if (format === 'json') {
        return JSON.stringify(jsonReport, null, 2);
    }
    const { formatActionPlanReport } = require('../reporters/text');
    if (format === 'action-plan') {
        return formatActionPlanReport(report, gateResult);
    }
    const { formatTextReport } = require('../reporters/text');
    return formatTextReport(report, gateResult);
}

module.exports = { validateFormat, selectPayload };
