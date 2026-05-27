const {
    DashboardMetricsService,
    formatDashboardKpi,
    parsers
} = require('../../web/services/DashboardMetricsService.js');

describe('DashboardMetricsService', () => {
    describe('response parsing', () => {
        test('parseOpenIssuesFromIssuesPayload prefers openIssueCount then total', () => {
            expect(parsers.parseOpenIssuesFromIssuesPayload({ openIssueCount: 0, total: 5 })).toBe(0);
            expect(parsers.parseOpenIssuesFromIssuesPayload({ total: 5 })).toBe(5);
            expect(parsers.parseOpenIssuesFromIssuesPayload({
                issues: [{ status: 'open' }, { status: 'resolved' }, { status: 'open' }]
            })).toBe(2);
        });

        test('parseOpenIssuesFromGgufIssues reads total or issues length', () => {
            expect(parsers.parseOpenIssuesFromGgufIssues({ total: 4 })).toBe(4);
            expect(parsers.parseOpenIssuesFromGgufIssues({ issues: [{}, {}] })).toBe(2);
        });

        test('parseOpenIssuesFromBacklog counts array or items', () => {
            expect(parsers.parseOpenIssuesFromBacklog([{ title: 'TODO x' }])).toBe(1);
            expect(parsers.parseOpenIssuesFromBacklog({ items: [{ title: 'FIXME y' }, { title: 'TODO z' }] })).toBe(2);
        });

        test('parseAIConfidenceFromAiAnalysis normalizes fractional confidence', () => {
            expect(parsers.parseAIConfidenceFromAiAnalysis({
                success: true,
                data: { modelInfo: { confidence: 0.955 } }
            })).toBe(95.5);
            expect(parsers.parseAIConfidenceFromAiAnalysis({
                data: { overview: { aiConfidence: null } }
            })).toBeNull();
        });

        test('parseAIConfidenceFromGgufAnalysis reads analysisOverview.aiConfidence', () => {
            expect(parsers.parseAIConfidenceFromGgufAnalysis({
                analysisOverview: { aiConfidence: 96 }
            })).toBe(96);
        });

        test('parseFeatureCountFromBacklogStats and roadmap/project-structure', () => {
            expect(parsers.parseFeatureCountFromBacklogStats({
                featureStatistics: { totalFeatures: 14 }
            })).toBe(14);
            expect(parsers.parseFeatureCountFromRoadmap({
                data: { projectOverview: { totalFeatures: 4 } }
            })).toBe(4);
            expect(parsers.parseFeatureCountFromProjectStructure({
                files: { 'a.js': {}, 'b.js': {} }
            })).toBe(2);
        });

        test('formatDashboardKpi shows loading, error, null, and value states', () => {
            expect(formatDashboardKpi({ loaded: false })).toBe('—');
            expect(formatDashboardKpi({ loaded: true, value: null, error: 'fail' })).toBe('Unavailable');
            expect(formatDashboardKpi({ loaded: true, value: null })).toBe('—');
            expect(formatDashboardKpi({ loaded: true, value: 95, error: null }, { suffix: '%' })).toBe('95%');
        });
    });

    describe('live fetch fallbacks', () => {
        test('getOpenIssuesCount falls back when primary endpoint fails', async () => {
            const calls = [];
            const service = new DashboardMetricsService({
                fetchFn: async (url) => {
                    calls.push(url);
                    if (url.startsWith('/api/issues')) {
                        throw new Error('500');
                    }
                    if (url.startsWith('/api/gguf/issues')) {
                        return { ok: true, json: async () => ({ total: 3 }) };
                    }
                    return { ok: true, json: async () => ({}) };
                }
            });

            const result = await service.getOpenIssuesCount();
            expect(result.value).toBe(3);
            expect(result.source).toBe('/api/gguf/issues');
            expect(calls[0]).toBe('/api/issues');
        });
    });
});

describe('fiction KPI grep guard (core + component dashboards)', () => {
    const fs = require('fs');
    const path = require('path');

    const files = [
        'web/components/ai-analysis/AIAnalysisDashboard.js',
        'web/components/analysis/AnalysisDashboard.js',
        'web/components/analysis/AnalysisOverview.js',
        'web/components/analytics/AnalyticsDashboard.js',
        'web/components/debt-analytics/DebtAnalyticsDashboard.js',
        'web/components/code-upload/CodeUploadDashboard.js',
        'web/components/support/SupportDashboard.js',
        'web/components/database/DatabaseDashboard.js',
        'web/components/api/APIDashboard.js',
        'web/components/assets-library/AssetsLibraryDashboard.js',
        'web/components/project-reports/ProjectReportsDashboard.js',
        'web/components/devtools/DevToolsDashboard.js',
        'web/components/codegen/CodeGenerationDashboard.js',
        'web/components/code-generation/CodeGenerationDashboard.js',
        'web/components/code-templates/CodeTemplatesDashboard.js',
        'web/components/ai-tools/AIToolsDashboard.js',
        'web/components/merger-tool/MergerToolDashboard.js',
        'web/components/debt-reduction/DebtReductionDashboard.js',
        'web/scripts/temp_dashboard.js',
        'web/scripts/unified-dashboard-core.js'
    ];

    const fictionPatterns = [
        /\bissuesFound:\s*156\b/,
        /\bissuesDetected:\s*156\b/,
        /\bpatternsIdentified:\s*156\b/,
        /\bsecurityScore:\s*98\.5\b/,
        /\bsuccessRate:\s*98\.5\b/,
        /\bfileCount:\s*156\b/,
        /\bbestPractices:\s*156\b/,
        /\bvalue:\s*156\b/,
        /\bvalue:\s*'98\.5%'/,
        /Confidence:<\/strong>\s*98\.5%/,
        /Issues Detected:<\/strong>\s*156/,
        /\|\|\s*87\s*[,;\)]/,
        /\btotalFeatures:\s*47\b/
    ];

    test.each(files)('%s has no hardcoded fiction KPI literals', (relPath) => {
        const absPath = path.join(__dirname, '../..', relPath);
        const source = fs.readFileSync(absPath, 'utf8');
        fictionPatterns.forEach((pattern) => {
            expect(source).not.toMatch(pattern);
        });
    });
});
