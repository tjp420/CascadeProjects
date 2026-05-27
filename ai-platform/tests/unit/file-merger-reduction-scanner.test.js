const path = require('path');
const {
    scanFileMergerReduction,
    buildConsolidationConclusion
} = require('../../server/lib/file-merger-reduction-scanner');

describe('file merger reduction scanner', () => {
    const baseDir = path.join(__dirname, '../..');

    test('returns measured scan report shape with full repository scope', async () => {
        const report = await scanFileMergerReduction(baseDir);
        expect(report.type).toBe('file-merger-reduction-report');
        expect(report.reportVersion).toBe(2);
        expect(report.dataSource).toBe('repository-audit');
        expect(report.summary.filesAnalyzed).toBeGreaterThan(1000);
        expect(report.summary.repositoryFilesTotal).toBe(report.summary.filesAnalyzed);
        expect(report.summary.sampleDataFilesAnalyzed).toBeGreaterThan(30);
        expect(report.summary.sampleDataFilesAnalyzed).toBeLessThan(45);
        expect(report.summary.jsonFilesAnalyzed).toBeGreaterThan(100);
        expect(report.scanScope?.mode).toBe('repository-consolidation');
        expect(report.repositoryInventory?.totalFiles).toBeGreaterThan(1000);
        expect(report.summary.exactDuplicateGroups).toBeGreaterThanOrEqual(0);
        expect(report.rejectedFiction.claims.length).toBeGreaterThan(0);
    });

    test('sample-data-only scope limits filesAnalyzed to sample paths', async () => {
        const report = await scanFileMergerReduction(baseDir, { scope: 'sample-data-only' });
        expect(report.scanScope?.mode).toBe('sample-data-consolidation');
        expect(report.summary.filesAnalyzed).toBeLessThan(45);
        expect(report.summary.filesAnalyzed).toBe(report.summary.sampleDataFilesAnalyzed);
    });

    test('does not flag generated simplebeacon scan artifacts as oversized', async () => {
        const report = await scanFileMergerReduction(baseDir);
        const oversizedArtifact = report.reductionOpportunities.find((o) =>
            o.files.some((f) => String(f.path).includes('.simplebeacon/file-reduction.json'))
        );
        expect(oversizedArtifact).toBeFalsy();
    });

    test('excludes data/roadmap/archive from sample consolidation paths', async () => {
        const report = await scanFileMergerReduction(baseDir);
        const scannedPaths = [
            ...report.mergeCandidates.flatMap((c) => c.files.map((f) => f.path)),
            ...report.reductionOpportunities.flatMap((o) => o.files.map((f) => f.path))
        ];
        expect(scannedPaths.some((p) => p.includes('roadmap/archive/'))).toBe(false);
        expect(report.summary.sampleDataFilesAnalyzed).toBeLessThan(45);
    });

    test('does not flag ai-roadmap web sample vs report as exact duplicate', async () => {
        const report = await scanFileMergerReduction(baseDir);
        const dup = report.mergeCandidates.find((c) =>
            c.mergeType === 'exact-duplicate'
            && c.files.some((f) => f.path.includes('ai-roadmap'))
        );
        expect(dup).toBeFalsy();
    });

    test('does not flag mock analysis sample as an exact duplicate', async () => {
        const report = await scanFileMergerReduction(baseDir);
        const mockDup = report.mergeCandidates.find((c) =>
            c.mergeType === 'exact-duplicate'
            && c.files.some((f) => f.path.includes('mock-analysis-sample'))
        );
        expect(mockDup).toBeFalsy();
    });

    test('does not flag ai roadmap sample aliases as structure merge candidates', async () => {
        const report = await scanFileMergerReduction(baseDir);
        const noisy = report.mergeCandidates.find((c) =>
            c.mergeType === 'structure-based'
            && c.files.some((f) => f.path.includes('ai-roadmap-sample'))
        );
        expect(noisy).toBeFalsy();
    });

    test('report includes advanced analysis block', async () => {
        const report = await scanFileMergerReduction(baseDir, { scope: 'sample-data-only' });
        expect(report.advancedAnalysis).toBeDefined();
        expect(report.advancedAnalysis.fuzzyNearDuplicates.threshold).toBeGreaterThanOrEqual(0.85);
        expect(report.implementationPhases.find((p) => p.phase.includes('Phase 2'))?.status).toBe('complete');
        expect(report.implementationPhases.find((p) => p.phase.includes('Phase 3'))?.status).toBe('complete');
    });

    test('repository scope from monorepo parent includes parent inventory and platform sample paths', async () => {
        const monorepoRoot = path.join(baseDir, '..');
        const report = await scanFileMergerReduction(monorepoRoot, { scope: 'repository' });
        expect(report.reportVersion).toBe(2);
        expect(report.summary.repositoryFilesTotal).toBeGreaterThan(30000);
        expect(report.summary.sampleDataFilesAnalyzed).toBeLessThan(45);
        expect(report.summary.jsonFilesAnalyzed).toBeGreaterThanOrEqual(200);
        expect(report.summary.filesAnalyzed).toBe(report.summary.repositoryFilesTotal);
        expect(report.scanPaths.some((p) => p.includes('web/data'))).toBe(true);
    }, 120000);

    test('monorepo scan excludes generated report duplicates and legacy oversized dev scripts', async () => {
        const monorepoRoot = path.join(baseDir, '..');
        const report = await scanFileMergerReduction(monorepoRoot, { scope: 'repository' });
        const reportDup = report.mergeCandidates.find((c) =>
            c.files.some((f) => String(f.path).includes('.simplebeacon/report.json'))
        );
        expect(reportDup).toBeFalsy();
        const oversizedMock = report.reductionOpportunities.find((o) =>
            o.files.some((f) => f.path.includes('mock-backend.js'))
        );
        const oversizedDashboardScripts = report.reductionOpportunities.find((o) =>
            o.files.some((f) => f.path.includes('dashboard-scripts.js'))
        );
        expect(oversizedMock).toBeFalsy();
        expect(oversizedDashboardScripts).toBeFalsy();
        const chunkPattern = report.advancedAnalysis?.patternConsolidation?.recommendations?.find((r) =>
            r.pattern.includes('export-system.js')
        );
        expect(chunkPattern).toBeFalsy();
    }, 120000);

    test('buildConsolidationConclusion distinguishes JSON scanned from duplicate groups', () => {
        const text = buildConsolidationConclusion({
            summary: {
                sampleDataFilesAnalyzed: 44,
                jsonFilesAnalyzed: 277,
                repositoryFilesTotal: 43365,
                exactDuplicateGroups: 0,
                mergeCandidates: 0,
                reductionOpportunities: 0,
                totalSizeLabel: '2.1GB'
            },
            repositoryInventory: { totalFiles: 43365 }
        });
        expect(text).toMatch(/277 JSON hashed for duplicates \(0 duplicate groups\)/);
        expect(text).not.toMatch(/277 duplicate/i);
    });
});
