/**
 * Dashboard deferred init — sample URL param bootstrapping for self-contained pages
 */
(function () {
    const SAMPLE_ROUTES = [
        { param: 'roadmap', values: ['sample', 'gguf-sample'], section: 'ai-roadmap', loader: 'loadAIRoadmapSample' },
        { param: 'analysis', values: ['sample'], section: 'ai-analysis', loader: 'loadAIAnalysisSample' },
        { param: 'assets', values: ['sample'], section: 'assets-library', loader: 'loadAssetsLibrarySample' },
        { param: 'templates', values: ['sample'], section: 'code-templates', loader: 'loadCodeTemplatesSample' },
        { param: 'coverage', values: ['sample'], section: 'coverage-reports', loader: 'loadCoverageReportsSample' },
        { param: 'settings', values: ['sample'], section: 'settings', loader: 'loadSettingsSample' },
        { param: 'help', values: ['sample'], section: 'help', loader: 'loadHelpSample' },
        { param: 'implplan', values: ['sample'], section: 'implementation-plan', loader: 'loadImplementationPlanSample' },
        { param: 'preports', values: ['sample'], section: 'project-reports', loader: 'loadProjectReportsSample' },
        { param: 'billing', values: ['sample'], section: 'billing-system', loader: 'loadBillingSystemSample' },
        { param: 'backlog', values: ['sample'], section: 'feature-backlog', loader: 'loadFeatureBacklogSample' },
        { param: 'timeline', values: ['sample'], section: 'release-timeline', loader: 'loadReleaseTimelineSample' },
        { param: 'dashboard', values: ['sample'], section: 'dashboard', loader: 'loadDashboardHomeSample' },
        { param: 'debtanalytics', values: ['sample'], section: 'debt-analytics', loader: 'loadDebtAnalyticsSample' },
        { param: 'reduction', values: ['sample'], section: 'debt-reduction', loader: 'loadDebtReductionSample' },
        { param: 'debt', values: ['sample'], section: 'debt-calculator', loader: 'loadDebtCalculatorSample' },
        { param: 'merger', values: ['sample'], section: 'merger-tool', loader: 'loadMergerToolSample' },
        { param: 'api', values: ['sample'], section: 'api', loader: 'loadAPISample' },
        { param: 'performance', values: ['sample'], section: 'performance', loader: 'loadPerformanceSample' },
        { param: 'quality', values: ['sample'], section: 'quality', loader: 'initializeQualityPage' },
        { param: 'security', values: ['sample'], section: 'security', loader: 'initializeSecurityPage' },
        { param: 'support', values: ['sample'], section: 'support', loader: 'initializeSupportPage' },
        { param: 'devtools', values: ['sample'], section: 'dev-tools', loader: 'loadDevToolsSample' },
        { param: 'database', values: ['sample'], section: 'database', loader: 'loadDatabaseSample' },
        { param: 'aitools', values: ['sample'], section: 'ai-tools', loader: 'loadAIToolsSample' },
        { param: 'codegen', values: ['sample'], section: 'code-generation', loader: 'loadCodeGenerationSample' },
        { param: 'issues', values: ['sample'], section: 'issue-resolution', loader: 'loadIssueResolutionSample' },
        { param: 'gguf', values: ['sample'], section: 'gguf-analysis', loader: 'loadGgufAnalysisSample' },
        { param: 'mock', values: ['gguf-sample'], section: 'gguf-analysis', loader: 'loadGgufAnalysisSample' }
    ];

    function navLinkFor(section) {
        const navKey = window.SECTION_TO_NAV?.[section] || section;
        return document.querySelector(`.nav-link[data-nav-section="${navKey}"]`);
    }

    async function runSampleRoute(params, route) {
        const value = params.get(route.param);
        if (!value || !route.values.includes(value)) {
            return false;
        }

        const loader = window[route.loader];
        if (typeof loader !== 'function') {
            return false;
        }

        window.__deferredSampleInit = window.__deferredSampleInit || new Set();
        window.__deferredSampleInit.add(route.section);
        try {
            window.showSection?.(route.section, navLinkFor(route.section));
            await loader();
        } finally {
            window.__deferredSampleInit.delete(route.section);
        }
        return true;
    }

    async function runDeferredSampleInits() {
        const params = new URLSearchParams(window.location.search);

        for (const route of SAMPLE_ROUTES) {
            try {
                await runSampleRoute(params, route);
            } catch (error) {
                console.warn(`Deferred ${route.section} init failed:`, error);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        try {
            if (typeof window.bindMockActionCards === 'function') {
                window.bindMockActionCards();
            }
            await runDeferredSampleInits();
        } catch (error) {
            console.warn('Deferred dashboard init failed:', error);
        }
    });
})();
