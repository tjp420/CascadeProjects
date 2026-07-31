// simplebeacon-ignore workspace-health
/**
 * Mock-data scanner facade.
 * Thin wrapper over packages/simplebeacon-cli/src/scan.
 * Exports only the APIs actually used by server consumers.
 */

let scanMockDataDirectories;
let formatBytes;

try {
  const scan = require('../../../packages/simplebeacon-cli/src/scan');
  scanMockDataDirectories = scan.scanMockDataDirectories;
  formatBytes = scan.formatBytes;
} catch (err) {
  const msg = `Failed to load simplebeacon scan module: ${err?.message || String(err)}`;
  scanMockDataDirectories = async () => {
    throw new Error(msg);
  };
  formatBytes = () => {
    throw new Error(msg);
  };
}

/**
 * Scan directories for mock data files and validate them.
 * @param {string} baseDir Root directory to scan.
 * @param {string[]} [extraPaths] Additional paths to include.
 * @param {Object} [options] Scan options.
 * @returns {Promise<Object>} Scan report with summary, issues, and scores.
 */
module.exports = {
  scanMockDataDirectories,
  formatBytes,
};
