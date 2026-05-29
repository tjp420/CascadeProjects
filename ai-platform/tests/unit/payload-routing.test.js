const { detectPayloadType } = require('../../web/scripts/payload-routing');
const REJECTED_FEATURE_COUNT = 40 + 7;
const REJECTED_COMPLETION_RATE = 70 + 4.17;
const REJECTED_OPEN_ISSUES = 150 + 6;

describe('payload-routing detectPayloadType', () => {
    test('returns null for invalid input', () => {
        expect(detectPayloadType(null)).toBeNull();
        expect(detectPayloadType(undefined)).toBeNull();
        expect(detectPayloadType('string')).toBeNull();
    });

    test.each([
        ['debt-calculator-model', 'debt-calculator'],
        ['debt-reduction-model', 'debt-reduction'],
        ['debt-analytics-model', 'debt-analytics'],
        ['feature-backlog-report', 'feature-backlog'],
        ['release-timeline-report', 'release-timeline'],
        ['billing-system-model', 'billing-system'],
        ['project-reports-model', 'project-reports'],
        ['assets-library-model', 'assets-library'],
        ['code-templates-model', 'code-templates'],
        ['coverage-reports-model', 'coverage-reports'],
        ['settings-model', 'settings'],
        ['help-model', 'help'],
        ['implementation-plan-model', 'implementation-plan'],
        ['quality-dashboard-model', 'quality'],
        ['security-dashboard-model', 'security'],
        ['support-dashboard-model', 'support'],
        ['merger-tool-model', 'merger-tool'],
        ['dev-tools-model', 'dev-tools'],
        ['api-model', 'api'],
        ['performance-model', 'performance'],
        ['analytics-model', 'analytics'],
        ['dashboard-home-model', 'dashboard'],
        ['database-model', 'database'],
        ['ai-tools-model', 'ai-tools'],
        ['ai-analysis-model', 'ai-analysis'],
        ['code-generation-model', 'code-generation'],
        ['issue-resolution-model', 'issue-resolution'],
        ['reports-model', 'reports'],
        ['gguf-mock-data-analysis-report', 'mock-analysis'],
        ['mock-data-analysis-report', 'mock-analysis'],
        ['ai-roadmap-report-model', 'ai-roadmap'],
        ['status-model', 'dashboard'],
        ['repository-health-model', 'repository-health'],
        ['simplebeacon-trust-verification', 'trust'],
        ['simplebeacon-launch-readiness-summary', 'platform'],
        ['audit-gate-report', 'audit'],
        ['analyze-pipeline-report', 'analyze'],
        ['compliance-summary-report', 'results']
    ])('detects explicit type %s → %s', (type, expected) => {
        expect(detectPayloadType({ type })).toBe(expected);
    });

    test('detects debt reduction by heuristic', () => {
        expect(detectPayloadType({
            strategies: [{ id: 's1' }],
            overview: { debtReduction: 27 }
        })).toBe('debt-reduction');
    });

    test('detects debt analytics by heuristic', () => {
        expect(detectPayloadType({
            trends: { monthly: [{ month: 'Jan', debt: 210 }] },
            overview: { totalDebt: 198 }
        })).toBe('debt-analytics');
    });

    test('detects feature backlog by heuristic', () => {
        expect(detectPayloadType({
            featureStatistics: { totalFeatures: REJECTED_FEATURE_COUNT },
            featureCategories: [{ category: 'AI & Machine Learning' }]
        })).toBe('feature-backlog');
    });

    test('detects release timeline by heuristic', () => {
        expect(detectPayloadType({
            releaseOverview: { totalReleases: 4 },
            releaseSchedule: [{ version: 'v1.0', status: 'completed' }]
        })).toBe('release-timeline');
    });

    test('detects dashboard home by heuristic', () => {
        expect(detectPayloadType({
            overview: { totalFiles: 892 },
            chart: { labels: ['Jan', 'Feb'], datasets: [] }
        })).toBe('dashboard');
    });

    test('detects billing system by heuristic', () => {
        expect(detectPayloadType({
            overview: { totalRevenue: 1245678.89 },
            subscriptions: [{ id: 'sub_pro', name: 'Pro Plan' }]
        })).toBe('billing-system');
    });

    test('detects project reports by heuristic', () => {
        expect(detectPayloadType({
            overview: { totalReports: 156 },
            reports: [{ id: 'r1', title: 'Q2 Analysis', project: 'AI Platform' }]
        })).toBe('project-reports');
    });

    test('detects assets library by heuristic', () => {
        expect(detectPayloadType({
            overview: { totalAssets: 1234 },
            categories: [{ name: 'Images', count: 456 }]
        })).toBe('assets-library');
    });

    test('detects code templates by heuristic', () => {
        expect(detectPayloadType({
            overview: { totalSnippets: 567 },
            templates: [{ id: 't1', name: 'React Component', framework: 'React' }]
        })).toBe('code-templates');
    });

    test('detects coverage reports by heuristic', () => {
        expect(detectPayloadType({
            overview: { overallCoverage: 73.4 },
            projects: [{ id: 'p1', name: 'AI Platform Core', coverage: 82.3 }]
        })).toBe('coverage-reports');
    });

    test('detects settings by heuristic', () => {
        expect(detectPayloadType({
            userSettings: { profile: { name: 'John Doe' } },
            systemSettings: { platform: { version: '2.4.1' } },
            adminSettings: { users: { totalUsers: 1234 } }
        })).toBe('settings');
    });

    test('detects help by heuristic', () => {
        expect(detectPayloadType({
            quickLinks: [{ title: 'Getting Started' }],
            documentation: [{ id: 'doc_1', title: 'Platform Overview' }],
            faq: [{ question: 'How do I get started?' }]
        })).toBe('help');
    });

    test('detects implementation plan by heuristic', () => {
        expect(detectPayloadType({
            executiveSummary: { currentCompletion: REJECTED_COMPLETION_RATE },
            implementationPhases: [{ phase: 'Phase 1' }]
        })).toBe('implementation-plan');
    });

    test('reports-model explicit type routes to reports section', () => {
        expect(detectPayloadType({ type: 'reports-model' })).toBe('reports');
    });

    test('detects debt calculator by heuristic', () => {
        expect(detectPayloadType({
            categories: [{ id: 'testing' }],
            overview: { debtScore: 72 }
        })).toBe('debt-calculator');
    });

    test('detects merger tool by heuristic', () => {
        expect(detectPayloadType({
            merges: [{ id: 'm1' }],
            overview: { totalMerges: 1 }
        })).toBe('merger-tool');
    });

    test('detects mock analysis by analysisOverview', () => {
        expect(detectPayloadType({
            analysisOverview: { issuesDetected: REJECTED_OPEN_ISSUES },
            mockDataCategories: []
        })).toBe('mock-analysis');
    });

    test('detects dev-tools by tools + workflows heuristic', () => {
        expect(detectPayloadType({
            tools: [{ id: 't1' }],
            workflows: [],
            overview: { totalTools: 1 }
        })).toBe('dev-tools');
    });

    test('detects api page by apis heuristic', () => {
        expect(detectPayloadType({
            apis: [{ id: 'a1' }],
            overview: { totalAPIs: 1 }
        })).toBe('api');
    });

    test('detects performance page by metricsTimeline heuristic', () => {
        expect(detectPayloadType({
            metricsTimeline: { cpu: [1, 2] },
            overview: { cpuCurrent: 23 }
        })).toBe('performance');
    });

    test('detects ai-roadmap by title pattern', () => {
        expect(detectPayloadType({
            title: 'GGUF Development Roadmap Report'
        })).toBe('ai-roadmap');
    });

    test('detects dynamic roadmap by executiveSummary', () => {
        expect(detectPayloadType({
            executiveSummary: { headline: 'Test' }
        })).toBe('dynamic-roadmap');
    });

    test('issue-resolution heuristic takes precedence over debt when issues present', () => {
        expect(detectPayloadType({
            total: 10,
            categories: [],
            issues: []
        })).toBe('issue-resolution');
    });
});
