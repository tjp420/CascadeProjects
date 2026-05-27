const {
    computeRepositoryHealthScore,
    buildRepositoryHealthSnapshot
} = require('../../server/lib/repository-health-payload');

describe('repository-health-payload', () => {
    test('computeRepositoryHealthScore matches monorepo calibration (~72)', () => {
        const score = computeRepositoryHealthScore({
            totalSizeBytes: 2292351479,
            potentialSavingsBytes: 1782935994,
            exactDuplicateGroups: 3,
            oversizedFiles: 49,
            reductionOpportunities: 52
        });
        expect(score).toBeGreaterThanOrEqual(70);
        expect(score).toBeLessThanOrEqual(74);
    });

    test('buildRepositoryHealthSnapshot maps consolidation report', () => {
        const snap = buildRepositoryHealthSnapshot({
            type: 'file-merger-reduction-report',
            reportVersion: 2,
            projectRoot: '/repo',
            generatedAt: '2026-05-25T00:00:00.000Z',
            summary: {
                potentialSavingsBytes: 1000,
                potentialSavingsLabel: '1KB',
                totalSizeBytes: 5000,
                exactDuplicateGroups: 1,
                oversizedFiles: 2,
                reductionOpportunities: 4,
                repositoryFilesTotal: 100,
                repositoryFoldersTotal: 10
            },
            recommendations: [{ priority: 'high', action: 'merge', description: 'test' }]
        }, 'Test');

        expect(snap.repositoryHealthScore).toBeGreaterThan(0);
        expect(snap.optimizationPotential).toBe('1KB');
        expect(snap.duplicateGroups).toBe(1);
        expect(snap.recommendations).toHaveLength(1);
    });
});
