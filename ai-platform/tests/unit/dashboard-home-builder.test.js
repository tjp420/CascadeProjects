const { buildDashboardHomeModel } = require('../../server/lib/dashboard-home-builder');
const { REPOSITORY_AUDIT_BASELINE } = require('../../server/lib/repository-audit-baseline');

describe('dashboard home builder', () => {
    test('merges live baseline Jest counts into overview and comparative rows', () => {
        const model = buildDashboardHomeModel({
            overview: {
                totalFiles: 42,
                totalTests: 657,
                passedTests: 657,
                testSuites: 31
            },
            comparativeAnalysis: [
                { metric: 'Jest Tests', previous: 657, current: 657, change: '—' },
                { metric: 'Mock / sample files', previous: 36, current: 42, change: '+6 files' }
            ],
            insights: [
                { title: 'Jest Suite Healthy', description: '657/657 tests pass across 31 suites.' }
            ]
        });

        const expectedPassing = REPOSITORY_AUDIT_BASELINE.jestTestsPassing;
        const expectedSuites = REPOSITORY_AUDIT_BASELINE.jestSuites;
        const expectedLabel = REPOSITORY_AUDIT_BASELINE.jestTestsLabel;

        expect(model.overview.totalTests).toBe(expectedPassing);
        expect(model.overview.passedTests).toBe(expectedPassing);
        expect(model.overview.testSuites).toBe(expectedSuites);
        expect(model.comparativeAnalysis[0].current).toBe(expectedPassing);
        expect(model.comparativeAnalysis[0].change).toBe(`+${expectedPassing - 657} tests`);
        expect(model.insights[0].description).toContain(expectedLabel);
    });
});
