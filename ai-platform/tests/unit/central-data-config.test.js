const path = require('path');
const {
    loadCentralDataConfig,
    resolveMockDataScanPaths,
    DEFAULT_MOCK_SCAN_RELATIVE_PATHS
} = require('../../server/lib/central-data-config');

describe('central-data-config loader', () => {
    const baseDir = path.join(__dirname, '..', '..');

    test('loads central-data-config.json', () => {
        const truth = loadCentralDataConfig(baseDir);
        expect(truth).toBeTruthy();
        expect(truth.mockDataScan?.paths).toEqual(expect.arrayContaining(['web/data']));
    });

    test('resolveMockDataScanPaths includes configured roots', () => {
        const paths = resolveMockDataScanPaths(baseDir);
        expect(paths.some((p) => p.endsWith(`${path.sep}web${path.sep}data`))).toBe(true);
    });

    test('falls back to defaults when config missing', () => {
        const tmpBase = path.join(__dirname, '..', '..', 'nonexistent-config-root');
        const paths = resolveMockDataScanPaths(tmpBase);
        expect(paths.length).toBe(DEFAULT_MOCK_SCAN_RELATIVE_PATHS.length);
    });
});
