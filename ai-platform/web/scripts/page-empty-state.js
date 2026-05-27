/**
 * Consistent empty states for self-contained dashboard pages.
 */
(function () {
    const SECTION_CONFIG = {
        security: { modelKey: '__securityModel', title: 'Security', shortcut: 'security', load: () => window.loadSecuritySample?.() },
        quality: { modelKey: '__qualityModel', title: 'Quality', shortcut: 'quality', load: () => window.loadQualitySample?.() },
        support: { modelKey: '__supportModel', title: 'Support', shortcut: 'support', load: () => window.loadSupportSample?.() },
        analytics: { modelKey: '__analyticsModel', title: 'Analytics', shortcut: 'analytics', load: () => window.loadAnalyticsSample?.() },
        performance: { modelKey: '__performanceModel', title: 'Performance', shortcut: 'performance', load: () => window.loadPerformanceSample?.() },
        reports: { modelKey: '__reportsModel', title: 'Reports', shortcut: 'reports', load: () => window.loadReportsSample?.() },
        settings: { modelKey: '__settingsModel', title: 'Settings', shortcut: 'settings', load: () => window.loadSettingsSample?.() },
        help: { modelKey: '__helpModel', title: 'Help', shortcut: 'help', load: () => window.loadHelpSample?.() },
        'dev-tools': { modelKey: '__devToolsModel', title: 'Dev Tools', shortcut: 'devtools', load: () => window.loadDevToolsSample?.() },
        'ai-tools': { modelKey: '__aiToolsModel', title: 'AI Tools', shortcut: 'aitools', load: () => window.loadAIToolsSample?.() },
        'ai-analysis': { modelKey: '__aiAnalysisModel', title: 'AI Analysis', shortcut: 'analysis', load: () => window.loadAIAnalysisSample?.() },
        'gguf-analysis': { modelKey: '__ggufAnalysisReport', title: 'Mock Data Analyzer', shortcut: 'mock', load: () => window.loadGgufAnalysisSample?.() },
        'debt-calculator': { modelKey: '__debtCalculatorModel', title: 'Debt Calculator', shortcut: 'debt', load: () => window.loadDebtCalculatorSample?.() },
        database: { modelKey: '__databaseModel', title: 'Database', shortcut: 'database', load: () => window.loadDatabaseSample?.() },
        api: { modelKey: '__apiModel', title: 'API', shortcut: 'api', load: () => window.loadAPISample?.() }
    };

    function findPageRoot(sectionName) {
        return document.getElementById(`${sectionName}-root`)
            || document.querySelector(`#${sectionName}-section [id$="-root"]`);
    }

    function hasModel(config) {
        if (!config?.modelKey) return false;
        const value = window[config.modelKey];
        if (value == null) return false;
        if (typeof value === 'object' && !Object.keys(value).length) return false;
        return true;
    }

    function clear(root) {
        if (!root) return;
        root.querySelector('.page-empty-state')?.remove();
        root.classList.remove('page-empty-active');
    }

    function show(root, sectionName) {
        const config = SECTION_CONFIG[sectionName];
        if (!root || !config) return;
        clear(root);

        const panel = document.createElement('div');
        panel.className = 'page-empty-state';
        panel.setAttribute('role', 'status');
        panel.innerHTML = `
            <div class="page-empty-state-icon" aria-hidden="true">📋</div>
            <h3>No ${config.title} data loaded</h3>
            <p>Load the repository-audit sample or use the global input bar (try <code>${config.shortcut}</code>).</p>
            <div class="page-empty-state-actions">
                <button type="button" class="btn btn-primary page-empty-load-sample">📂 Load sample</button>
                <button type="button" class="btn btn-outline-light page-empty-try-input">🔍 Try global input</button>
            </div>
        `;

        panel.querySelector('.page-empty-load-sample')?.addEventListener('click', () => {
            if (typeof config.load === 'function') {
                void config.load();
                return;
            }
            if (typeof window.analyzeGlobalDataInput === 'function') {
                void window.analyzeGlobalDataInput(config.shortcut);
            }
        });

        panel.querySelector('.page-empty-try-input')?.addEventListener('click', () => {
            const input = document.getElementById('global-data-address');
            if (input) {
                input.focus();
                input.value = config.shortcut;
                input.select();
            }
            document.getElementById('global-data-input')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            window.showNotification?.(`Enter "${config.shortcut}" and click Analyze, or paste a path/JSON`, 'info');
        });

        root.prepend(panel);
        root.classList.add('page-empty-active');
    }

    function syncSection(sectionName) {
        const config = SECTION_CONFIG[sectionName];
        const root = findPageRoot(sectionName);
        if (!config || !root) return;

        if (hasModel(config)) {
            clear(root);
            return;
        }

        if (root.classList.contains('loading')) return;
        show(root, sectionName);
    }

    window.PageEmptyState = {
        syncSection,
        clear,
        hasModel,
        findPageRoot,
        onModelLoaded(sectionName) {
            clear(findPageRoot(sectionName));
        }
    };
})();
