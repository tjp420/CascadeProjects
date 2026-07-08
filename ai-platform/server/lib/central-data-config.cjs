// SPDX-License-Identifier: MIT

let resolveMockDataScanPaths;

try {
  const Simplebeacon = require('../../../packages/simplebeacon-cli/src/index');
  resolveMockDataScanPaths = Simplebeacon?.config?.resolveMockDataScanPaths;
  if (typeof resolveMockDataScanPaths !== 'function') {
    throw new Error('Simplebeacon.config.resolveMockDataScanPaths is not a function');
  }
} catch (err) {
  const msg = `Failed to load simplebeacon scanner module: ${err?.message || String(err)}`;
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
