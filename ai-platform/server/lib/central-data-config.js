/**
 * Shim — config loader lives in packages/simplebeacon-cli
 */
const {
    loadCentralDataConfig,
    resolveMockDataScanPaths,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS
} = require('../../packages/simplebeacon-cli/src/index');

module.exports = {
    loadCentralDataConfig,
    resolveMockDataScanPaths,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS
};
