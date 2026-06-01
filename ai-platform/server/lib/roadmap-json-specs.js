/**
 * Shim — roadmap JSON specs with baseline from .simplebeacon/
 */
const path = require('path');
const { loadSimplebeaconConfig } = require('../../packages/simplebeacon-cli/src/index');
const core = require('../../packages/simplebeacon-cli/src/lib/roadmap-json-specs');

async function validateRoadmapFiles(baseDir) {
    const config = loadSimplebeaconConfig(baseDir);
    return core.validateRoadmapFiles(baseDir, { baseline: config.baseline });
}

function validateRoadmapJson(fileName, payload) {
    const config = loadSimplebeaconConfig(path.join(__dirname, '../..'));
    return core.validateRoadmapJson(fileName, payload, config.baseline);
}

module.exports = {
    ROADMAP_JSON_SPECS: core.ROADMAP_JSON_SPECS,
    ROADMAP_DIR: core.ROADMAP_DIR,
    validateRoadmapJson,
    validateRoadmapFiles
};
