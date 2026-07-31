// simplebeacon-ignore workspace-health
/**
 * Shim — baseline and consistency anchor samples loaded from
 * `.simplebeacon/config.json` at the workspace root.
 */
const path = require('path');
const {
  getConsistencyAnchorSamples,
  getRepositoryAuditBaseline,
} = require('../../../packages/simplebeacon-cli/src/index.js');

/** Workspace root — three levels up from ai-platform/server/lib/. */
const ROOT = path.join(__dirname, '../../..');

let _baselineCache;
let _anchorCache;

/** @returns {Object} Repository audit baseline, empty object on error. */
function getBaseline() {
  if (_baselineCache !== undefined) return _baselineCache;
  if (typeof getRepositoryAuditBaseline !== 'function') {
    _baselineCache = {};
    return _baselineCache;
  }
  try {
    _baselineCache = getRepositoryAuditBaseline(ROOT) || {};
  } catch {
    _baselineCache = {};
  }
  return _baselineCache;
}

/** @returns {Object} Consistency anchor samples, empty object on error. */
function getAnchors() {
  if (_anchorCache !== undefined) return _anchorCache;
  if (typeof getConsistencyAnchorSamples !== 'function') {
    _anchorCache = {};
    return _anchorCache;
  }
  try {
    _anchorCache = getConsistencyAnchorSamples(ROOT) || {};
  } catch {
    _anchorCache = {};
  }
  return _anchorCache;
}

module.exports = {
  get REPOSITORY_AUDIT_BASELINE() {
    return getBaseline();
  },
  get CONSISTENCY_ANCHOR_SAMPLES() {
    return getAnchors();
  },
};
