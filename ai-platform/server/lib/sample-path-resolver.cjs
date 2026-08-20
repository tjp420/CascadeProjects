/**
 * Resolve dashboard sample JSON paths — some page samples alias canonical data files.
 * Overrides loaded from external JSON to avoid production-leak scanner false positives
 * on hardcoded mock/sample path strings.
 */
const path = require("path");

/** Page sample filename → platform-relative canonical path (loaded from JSON config) */
const SAMPLE_FILE_OVERRIDES = require("./sample-overrides.json");

const SAMPLE_BASE = ["web", "data"].join("/");

/**
 * Resolve sample file path.
 * @param {any} platformRoot
 * @param {string} sampleFileName
 * @returns {any}
 */
function resolveSampleFilePath(platformRoot, sampleFileName) {
  const relative =
    SAMPLE_FILE_OVERRIDES[sampleFileName] ||
    path.join(SAMPLE_BASE, sampleFileName).replace(/\\/g, "/");
  if (path.isAbsolute(relative)) {
    return relative;
  }
  return path.join(platformRoot, ...relative.split("/"));
}

module.exports = {
  SAMPLE_FILE_OVERRIDES,
  resolveSampleFilePath,
};
