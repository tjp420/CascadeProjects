const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    scanMockDataDirectories,
    validateSampleSchema
} = require('../../server/lib/mock-data-scanner');
const { PAGE_SAMPLE_SPECS } = require('../../server/lib/page-sample-specs');

describe('mock data scanner', () => {
    let baseDir;

    beforeEach(() => {
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-scan-'));
        const dataDir = path.join(baseDir, 'web', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'valid.json'), JSON.stringify({ ok: true }));
        fs.writeFileSync(path.join(dataDir, 'broken.json'), '{ invalid');
        fs.writeFileSync(path.join(dataDir, 'empty.json'), '');
    });

    afterEach(() => {
        fs.rmSync(baseDir, { recursive: true, force: true });
    });

    test('counts files and detects invalid JSON', async () => {
        const scan = await scanMockDataDirectories(baseDir);
        expect(scan.scanPaths.some((p) => p.includes('web'))).toBe(true);
        expect(scan.totalFiles).toBeGreaterThanOrEqual(3);
        expect(scan.invalidJson).toBeGreaterThanOrEqual(1);
        expect(scan.mockDataCategories.length).toBeGreaterThan(0);
    });

    test('detects schema violations for dashboard sample files', async () => {
        const dataDir = path.join(baseDir, 'web', 'data');
        fs.writeFileSync(
            path.join(dataDir, 'analytics-sample.json'),
            JSON.stringify({ type: 'wrong-type', overview: {} })
        );

        const scan = await scanMockDataDirectories(baseDir);
        const schemaIssue = scan.rawIssues.find((issue) => issue.type === 'Schema Violation');
        expect(schemaIssue).toBeTruthy();
        expect(scan.schemaChecked).toBeGreaterThanOrEqual(1);
    });

    test('detects duplicate JSON content with relative paths', async () => {
        const dataDir = path.join(baseDir, 'web', 'data');
        const payload = JSON.stringify({ duplicate: true, value: 1 });
        fs.writeFileSync(path.join(dataDir, 'dup-a.json'), payload);
        fs.writeFileSync(path.join(dataDir, 'dup-b.json'), payload);

        const scan = await scanMockDataDirectories(baseDir);
        const dupIssue = scan.rawIssues.find((issue) => issue.type === 'Duplicate Data');
        expect(dupIssue).toBeTruthy();
        expect(dupIssue.affectedFiles).toEqual(expect.arrayContaining(['web/data/dup-a.json', 'web/data/dup-b.json']));
        expect(new Set(dupIssue.affectedFiles).size).toBe(2);
    });

    test('does not false-positive duplicates when monorepo parent is an extra path', async () => {
        const aiPlatform = path.join(__dirname, '../..');
        const parent = path.join(aiPlatform, '..');
        const scan = await scanMockDataDirectories(aiPlatform, [parent]);
        const dupIssues = (scan.rawIssues || []).filter((issue) => issue.type === 'Duplicate Data');
        expect(dupIssues).toHaveLength(0);
    });
});

describe('mock data schema validator', () => {
    test('validates known sample spec', () => {
        const spec = PAGE_SAMPLE_SPECS['analytics-sample.json'];
        const result = validateSampleSchema('analytics-sample.json', {
            type: spec.type,
            overview: { apiCalls: 100 },
            usageByCategory: [{ name: 'api' }]
        });
        expect(result.valid).toBe(true);
    });

    test('allows empty arrays when spec permits', () => {
        const spec = PAGE_SAMPLE_SPECS['security-dashboard-sample.json'];
        const result = validateSampleSchema('security-dashboard-sample.json', {
            type: spec.type,
            overview: { activeThreats: 0 },
            threats: [],
            vulnerabilities: [{ id: 'SEC-001' }]
        });
        expect(result.valid).toBe(true);
    });
});
