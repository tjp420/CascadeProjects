const path = require('path');
const {
    loadJestCoverageSummary,
    roundPct
} = require('../../server/lib/jest-coverage-reader');
const {
    buildCoverageReportsModel,
    applyProjectCoverage
} = require('../../server/lib/coverage-reports-builder');
const { mergeIstanbulTelemetry } = require('../../server/lib/istanbul-telemetry-merge');

describe('jest coverage reader', () => {
    test('loads istanbul json-summary totals', () => {
        const fixtureDir = path.join(__dirname, '../fixtures');
        const result = loadJestCoverageSummary(fixtureDir, {
            relativePath: 'jest-coverage-summary.json'
        });

        expect(result.available).toBe(true);
        expect(result.totals.lines).toBe(79.4);
        expect(result.totals.branches).toBe(55);
        expect(result.files.length).toBe(2);
    });

    test('roundPct handles null', () => {
        expect(roundPct(null)).toBeNull();
        expect(roundPct(79.44)).toBe(79.4);
    });
});

describe('coverage reports builder', () => {
    const baseDir = path.join(__dirname, '../fixtures');
    const sample = {
        type: 'coverage-reports-model',
        dataSource: 'repository-audit',
        overview: { totalTests: 549, passedTests: 549, coverageCollection: 'disabled' },
        projects: [
            { id: 'proj_routing', name: 'Payload Routing', tests: 55, passed: 55 },
            { id: 'proj_stub_api', name: 'Stub API', tests: 23, passed: 23 }
        ],
        coverageTrends: [{ week: 'May W4', overall: 549, line: null, branch: null, function: null }],
        recentRuns: [{ project: 'Full Jest suite', description: 'pending', coverage: null, tests: 549 }]
    };

    test('merges istanbul metrics into coverage reports model', () => {
        const model = buildCoverageReportsModel(baseDir, sample, {
            relativePath: 'jest-coverage-summary.json'
        });

        expect(model.overview.lineCoverage).toBe(79.4);
        expect(model.overview.coverageCollection).toBe('istanbul');
        expect(model.generatedBy).toBe('jest-coverage-reader');
        expect(model.projects.find((p) => p.id === 'proj_routing').lineCoverage).toBe(94.4);
        expect(model.recentRuns[0].coverage).toBe(79.4);
    });

    test('returns sample unchanged when summary missing', () => {
        const model = buildCoverageReportsModel(baseDir, sample, {
            relativePath: 'missing-coverage-summary.json'
        });
        expect(model.overview.coverageCollection).toBe('disabled');
        expect(model.overview.lineCoverage).toBeUndefined();
    });

    test('applyProjectCoverage averages mapped files', () => {
        const projects = applyProjectCoverage(sample.projects, [
            { relativePath: 'web/scripts/payload-routing.js', lines: 90, branches: 80, functions: 100, statements: 88 },
            { relativePath: 'src/api/dashboard-stub-api.js', lines: 70, branches: 40, functions: 60, statements: 65 }
        ]);
        expect(projects[0].lineCoverage).toBe(90);
        expect(projects[1].lineCoverage).toBe(70);
    });
});

describe('istanbul telemetry merge', () => {
    const baseDir = path.join(__dirname, '../..');

    test('resolves open istanbul alerts when summary exists', () => {
        const merged = mergeIstanbulTelemetry({
            alerts: [{
                severity: 'warning',
                title: 'Istanbul not collected',
                message: 'run npm run test:coverage',
                resolved: false
            }],
            performance: {}
        }, baseDir);

        expect(merged.alerts.some((alert) => alert.resolved === false && /istanbul not collected/i.test(String(alert.title)))).toBe(false);
        expect(merged.performance.coverageCollection).toBe('istanbul');
        expect(merged.performance.lineCoverage).toBeGreaterThan(0);
    });
});
