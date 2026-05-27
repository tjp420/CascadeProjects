/**
 * JSON payload type detection for global data input routing.
 * Shared between dashboard (browser) and Jest unit tests.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.PayloadRouting = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
    function detectPayloadType(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload.type === 'ai-analysis-model') return 'ai-analysis';
        if (payload.type === 'ai-roadmap-report-model') return 'ai-roadmap';
        if (payload.type === 'ai-tools-model') return 'ai-tools';
        if (payload.type === 'analytics-model') return 'analytics';
        if (payload.type === 'dashboard-home-model') return 'dashboard';
        if (payload.type === 'api-model') return 'api';
        if (payload.type === 'code-generation-model') return 'code-generation';
        if (payload.type === 'database-model') return 'database';
        if (payload.type === 'debt-calculator-model') return 'debt-calculator';
        if (payload.type === 'debt-reduction-model') return 'debt-reduction';
        if (payload.type === 'debt-analytics-model') return 'debt-analytics';
        if (payload.type === 'feature-backlog-report') return 'feature-backlog';
        if (payload.type === 'release-timeline-report') return 'release-timeline';
        if (payload.type === 'billing-system-model') return 'billing-system';
        if (payload.type === 'project-reports-model') return 'project-reports';
        if (payload.type === 'assets-library-model') return 'assets-library';
        if (payload.type === 'code-templates-model') return 'code-templates';
        if (payload.type === 'coverage-reports-model') return 'coverage-reports';
        if (payload.type === 'settings-model') return 'settings';
        if (payload.type === 'help-model') return 'help';
        if (payload.type === 'simplebeacon-cli-model') return 'help';
        if (payload.type === 'implementation-plan-model') return 'implementation-plan';
        if (payload.type === 'quality-dashboard-model') return 'quality';
        if (payload.type === 'security-dashboard-model') return 'security';
        if (payload.type === 'support-dashboard-model') return 'support';
        if (payload.type === 'dev-tools-model') return 'dev-tools';
        if (payload.type === 'dynamic-project-roadmap-analysis') return 'dynamic-roadmap';
        if (payload.type === 'gguf-development-roadmap-report') return 'gguf-roadmap';
        if (payload.type === 'roadmap-comparison-report') return 'roadmap-comparison';
        if (payload.type === 'engineering-baseline-report') return 'project-reports';
        if (payload.type === 'fictional-patterns-report') return 'quality';
        if (payload.type === 'ai-quality-metrics-report') return 'quality';
        if (payload.type === 'baseline-comparison-report') return 'quality';
        if (payload.type === 'ai-adoption-trends-report') return 'quality';
        if (payload.type === 'data-maintenance-analyzers-report') return 'dev-tools';
        if (payload.type === 'local-models-model') return 'local-models';
        if (payload.type === 'gguf-mock-data-analysis-report') return 'mock-analysis';
        if (payload.type === 'issue-resolution-model') return 'issue-resolution';
        if (payload.type === 'merger-tool-model') return 'merger-tool';
        if (payload.type === 'performance-model') return 'performance';
        if (payload.type === 'reports-model') return 'reports';
        if (/development roadmap report/i.test(payload.title || '')) return 'ai-roadmap';
        if (typeof payload.total === 'number' && Array.isArray(payload.categories) && Array.isArray(payload.issues)) {
            return 'issue-resolution';
        }
        if (payload.stats && payload.templates) return 'code-generation';
        if (payload.overview?.totalSnippets != null && Array.isArray(payload.templates) && payload.templates.some((t) => t.framework)) {
            return 'code-templates';
        }
        if (Array.isArray(payload.tools) && payload.workflows && payload.overview?.totalTools != null) return 'dev-tools';
        if (payload.tools && payload.overview) return 'ai-tools';
        if (payload.databases && payload.overview) return 'database';
        if (payload.overview && payload.codeQuality) return 'ai-analysis';
        if (Array.isArray(payload.reports) && payload.reports.some((r) => r.title && r.project)) {
            return 'project-reports';
        }
        if (payload.reports && payload.overview) return 'reports';
        if (payload.usageByCategory && payload.overview?.apiCalls != null) return 'analytics';
        if (payload.overview?.totalFiles != null && payload.chart?.labels) return 'dashboard';
        if (payload.metricsTimeline?.cpu && payload.overview?.cpuCurrent != null) return 'performance';
        if (Array.isArray(payload.apis) && payload.overview?.totalAPIs != null) return 'api';
        if (Array.isArray(payload.merges) && payload.overview?.totalMerges != null) return 'merger-tool';
        if (Array.isArray(payload.strategies) && payload.overview?.debtReduction != null) return 'debt-reduction';
        if (payload.trends?.monthly && payload.overview?.totalDebt != null) return 'debt-analytics';
        if (payload.featureStatistics?.totalFeatures != null && Array.isArray(payload.featureCategories)) {
            return 'feature-backlog';
        }
        if (payload.releaseOverview?.totalReleases != null && Array.isArray(payload.releaseSchedule)) {
            return 'release-timeline';
        }
        if (payload.overview?.totalRevenue != null && Array.isArray(payload.subscriptions)) {
            return 'billing-system';
        }
        if (payload.overview?.totalAssets != null && Array.isArray(payload.categories) && payload.categories.some((c) => c.count != null)) {
            return 'assets-library';
        }
        if (payload.overview?.overallCoverage != null && Array.isArray(payload.projects) && payload.projects.some((p) => p.coverage != null)) {
            return 'coverage-reports';
        }
        if (payload.userSettings && payload.systemSettings && payload.adminSettings) {
            return 'settings';
        }
        if (payload.executiveSummary?.currentCompletion != null && Array.isArray(payload.implementationPhases)) {
            return 'implementation-plan';
        }
        if (Array.isArray(payload.quickLinks) && Array.isArray(payload.documentation) && Array.isArray(payload.faq)) {
            return 'help';
        }
        if (Array.isArray(payload.categories) && payload.overview?.debtScore != null) return 'debt-calculator';
        if (payload.analysisOverview?.issuesDetected != null && !payload.developmentPhases) {
            return 'mock-analysis';
        }
        if (payload.projectOverview && payload.developmentPhases) {
            return 'ai-roadmap';
        }
        if (payload.categories && payload.issues && payload.resolvedPct != null) {
            return 'issue-resolution';
        }
        if (payload.executiveSummary || payload.roadmap?.executiveSummary) return 'dynamic-roadmap';
        if (payload.roadmap) return 'dynamic-roadmap';
        return null;
    }

    return { detectPayloadType };
}));
