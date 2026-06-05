/**
 * Shim — baseline loaded from .simplebeacon/baseline.json
 */
const path = require('path');
const {
    getRepositoryAuditBaseline,
    getConsistencyAnchorSamples
} = require('../../packages/simplebeacon-cli/src/index');

const ROOT = path.join(__dirname, '../..');

module.exports = {
    get REPOSITORY_AUDIT_BASELINE() {
        return getRepositoryAuditBaseline(ROOT);
    },
    get CONSISTENCY_ANCHOR_SAMPLES() {
        return getConsistencyAnchorSamples(ROOT);
    }
};
