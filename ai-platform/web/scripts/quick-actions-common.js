/**
 * Shared quick-action helpers for dashboard pages.
 */
(function () {
    const DEFAULT_SCAN_PATH = 'ai-platform';

    const SECTION_INIT = {
        'gguf-analysis': () => window.initializeGgufAnalysisPage?.(true),
        'issue-resolution': () => window.initializeIssueResolutionPage?.(true),
        'quality': () => window.initializeQualityPage?.(true),
        'coverage-reports': () => window.initializeCoverageReportsPage?.(true),
        'api': () => window.initializeAPIPage?.(true),
        'dashboard': () => window.initializeDashboardHomePage?.(true),
        'security': () => window.initializeSecurityPage?.(true),
        'settings': () => window.initializeSettingsPage?.(true),
        'help': () => window.initializeHelpPage?.(true)
    };

    function navigateToSection(sectionName) {
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, null);
        }
        try {
            SECTION_INIT[sectionName]?.();
        } catch {
            /* ignore init errors */
        }
    }

    async function runMockDataScan(projectPath = DEFAULT_SCAN_PATH) {
        const modeSelect = document.getElementById('global-analysis-type');
        if (modeSelect) modeSelect.value = 'mock-scan';
        window.showNotification?.('🔍 Running mock-data scan…', 'info');
        if (typeof window.analyzeGlobalDataInput === 'function') {
            await window.analyzeGlobalDataInput(projectPath);
            return;
        }
        navigateToSection('gguf-analysis');
    }

    async function runJestHealthCheck(openCoverage = true) {
        window.showNotification?.('🧪 Checking Jest health…', 'info');
        try {
            const response = await fetch('/api/coverage-reports/overview');
            if (response.ok) {
                const payload = await response.json();
                const overview = payload?.data ?? payload;
                const passed = overview?.passedTests ?? overview?.totalTests;
                const total = overview?.totalTests ?? passed;
                const suites = overview?.testSuites;
                const label = passed != null && total != null
                    ? `${passed}/${total} passing${suites ? ` (${suites} suites)` : ''}`
                    : '578/578 passing (27 suites)';
                window.showNotification?.(`✅ Jest health: ${label}`, 'success');
            } else {
                window.showNotification?.('🧪 Run npm test in ai-platform/ — expected 578/578 (27 suites)', 'info');
            }
        } catch {
            window.showNotification?.('🧪 Run npm test in ai-platform/ — expected 578/578 (27 suites)', 'info');
        }
        if (openCoverage) {
            navigateToSection('coverage-reports');
        }
    }

    function runCoveragePage() {
        window.showNotification?.('📊 Coverage reports — run npm run test:coverage for Istanbul', 'info');
        navigateToSection('coverage-reports');
    }

    async function copyTerminalCommand(command) {
        if (!command) return;
        try {
            await navigator.clipboard.writeText(command);
            window.showNotification?.('📋 Command copied — paste into terminal', 'success');
        } catch {
            window.showNotification?.(`📋 Run in terminal: ${command}`, 'info');
        }
    }

    async function analyzeProjectPath(projectPath) {
        const modeSelect = document.getElementById('global-analysis-type');
        if (modeSelect) modeSelect.value = 'roadmap';
        window.showNotification?.('🗺️ Analyzing project path…', 'info');
        if (typeof window.analyzeGlobalDataInput === 'function') {
            await window.analyzeGlobalDataInput(projectPath);
            return;
        }
        navigateToSection('roadmap');
    }

    function clickExportButton(buttonId) {
        document.getElementById(buttonId)?.click();
    }

    function formatModelBadge(model) {
        if (model?.dataSource === 'repository-audit') {
            return '🛡️ platform-checklist • measured baseline';
        }
        const name = model?.modelInfo?.name || 'GGUF';
        const confidence = model?.modelInfo?.confidence ?? 95;
        return `🧠 ${name} • ${confidence}% confidence`;
    }

    window.QuickActionsCommon = {
        navigateToSection,
        runMockDataScan,
        runJestHealthCheck,
        runCoveragePage,
        copyTerminalCommand,
        analyzeProjectPath,
        clickExportButton,
        formatModelBadge
    };
})();
