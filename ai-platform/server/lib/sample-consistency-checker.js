/**
 * Shim — sample consistency checker with legacy two-arg API.
 */
const path = require('path');
const { loadSimplebeaconConfig, getConsistencyAnchorSamples } = require('../../packages/simplebeacon-cli/src/index');
const core = require('../../packages/simplebeacon-cli/src/lib/sample-consistency-checker');

const ROOT = path.join(__dirname, '../..');

async function checkSampleConsistency(baseDir, sampleDir = path.join('web', 'data')) {
    const config = loadSimplebeaconConfig(baseDir);
    return core.checkSampleConsistency(baseDir, {
        sampleDir,
        baseline: config.baseline,
        anchorSamples: config.consistencyAnchorSamples
    });
}

function extractKpis(payload, fileName) {
    const baseline = loadSimplebeaconConfig(ROOT).baseline;
    return core.extractKpis(payload, fileName, baseline);
}

function deepIncludesFiction(value, depth, keyPath) {
    const baseline = loadSimplebeaconConfig(ROOT).baseline;
    return core.deepIncludesFiction(value, baseline, depth, keyPath);
}

module.exports = {
    checkSampleConsistency,
    extractKpis,
    deepIncludesFiction,
    get CONSISTENCY_ANCHOR_SAMPLES() {
        return getConsistencyAnchorSamples(ROOT);
    }
};
