const path = require('path');
const { scanMockDataDirectories } = require('../../packages/simplebeacon-cli/src/scan');
const { PAGE_SAMPLE_SPECS } = require('../../packages/simplebeacon-cli/src/lib/page-sample-specs');

const PLATFORM_ROOT = path.join(__dirname, '../..');

describe('simplebeacon scan scope (ai-platform)', () => {
    test('validates full page spec catalog including aliased roadmap samples', async () => {
        const scan = await scanMockDataDirectories(PLATFORM_ROOT);
        const catalogSize = Object.keys(PAGE_SAMPLE_SPECS).length;

        expect(scan.pageSampleSchemaChecked).toBeGreaterThanOrEqual(catalogSize - 1);
        expect(scan.pageSampleSchemaChecked).toBeLessThanOrEqual(catalogSize);
        expect(scan.pageSampleSchemaPassed).toBe(scan.pageSampleSchemaChecked);
        expect(scan.scanScope.pageSpecCatalogSize).toBe(catalogSize);
        expect(scan.scanScope.pageSpecsFromAliasPaths).toBeGreaterThanOrEqual(2);
        expect(scan.scanScope.pageSpecsFromScanPaths + scan.scanScope.pageSpecsFromAliasPaths)
            .toBe(scan.pageSampleSchemaChecked);
        expect(scan.scanScope.jestExecutedDuringScan).toBe(false);
        expect(scan.scanScope.rulesEnabled).toContain('production-leak');
        expect(scan.reportVersion).toBe(2);
        expect(scan.repositoryFilesTotal).toBeGreaterThan(1000);
        expect(scan.ruleScopedFilesAnalyzed).toBeGreaterThan(40);
        expect(scan.filesAnalyzed).toBe(scan.repositoryFilesTotal);
        expect(scan.fictionJsonFilesScanned).toBeGreaterThan(scan.mockSampleFiles);
        expect(scan.fictionScope).toBe('repository-json');
    }, 120000);
});
