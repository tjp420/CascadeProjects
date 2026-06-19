// SPDX-License-Identifier: MIT
/**
 * Merge repository-audit analytics sample with live Istanbul output when available.
 *
 * @license MIT
 */

const { mergeIstanbulTelemetry } = require('./istanbul-telemetry-merge.cjs');

/**
 * Build an analytics model by merging a sample with Istanbul telemetry.
 * @param {string} baseDir - Base directory for Istanbul lookup.
 * @param {Object} [sample={}] - Sample analytics data.
 * @param {Object} [options={}] - Options passed to the telemetry merge.
 * @returns {Object} Merged analytics model.
 */
function buildAnalyticsModel(baseDir, sample = {}, options = {}) {
    return mergeIstanbulTelemetry(
        {
            ...sample,
            type: sample.type || 'analytics-model',
            dataSource: sample.dataSource || 'repository-audit'
        },
        baseDir,
        options
    );
}

module.exports = {
    buildAnalyticsModel
};
