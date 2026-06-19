/**
 * Shim — baseline loaded from .simplebeacon/baseline.json
 */
const path = require('path');
const { getConsistencyAnchorSamples, getRepositoryAuditBaseline } = require('./simplebeacon-proxy.cjs');


const ROOT = path.join(__dirname, '../..');

module.exports = {
    get REPOSITORY_AUDIT_BASELINE() {
        if (typeof getRepositoryAuditBaseline !== 'function') return {};
        return getRepositoryAuditBaseline(ROOT);
    },
    get CONSISTENCY_ANCHOR_SAMPLES() {
        if (typeof getConsistencyAnchorSamples !== 'function') return {};
        return getConsistencyAnchorSamples(ROOT);
    }
};
