// SPDX-License-Identifier: MIT

let resolveMockDataScanPaths;

try {
  ({ resolveMockDataScanPaths } = require('../../../packages/simplebeacon-cli/src/config'));
  if (typeof resolveMockDataScanPaths !== 'function') {
    throw new Error('resolveMockDataScanPaths is not exported by simplebeacon-cli/src/config');
  }
} catch (err) {
  const msg = `Failed to load simplebeacon config module: ${err?.message || String(err)}`;
  resolveMockDataScanPaths = () => { throw new Error(msg); };
}

/**
 * Resolve mock-data scan paths for a project root.
 * @param {string} projectRoot
 * @returns {string[]}
 */
module.exports = {
  resolveMockDataScanPaths
};
