/**
 * Merge repository-audit analytics sample with live Istanbul output when available.
 */

const { mergeIstanbulTelemetry } = require('./istanbul-telemetry-merge.cjs');

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
