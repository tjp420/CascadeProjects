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

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
    return `${(bytes / k ** i).toFixed(i === 0 ? 0 : i >= 4 ? 2 : 1)} ${units[i]}`;
}

module.exports = { validateFormat, selectPayload, formatBytes };
