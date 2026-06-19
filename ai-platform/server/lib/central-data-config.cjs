// SPDX-License-Identifier: MIT
const { DEFAULT_MOCK_SCAN_RELATIVE_PATHS, loadCentralDataConfig, resolveMockDataScanPaths } = require('./simplebeacon-proxy.cjs');

/**
 * Shim — config loader lives in packages/simplebeacon-cli
 */

module.exports = {
    loadCentralDataConfig,
    resolveMockDataScanPaths,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS
};
