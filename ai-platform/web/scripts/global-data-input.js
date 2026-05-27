/**
 * Global Data Input — shared address bar, file browser, and drag-and-drop
 * for analyzing data across all dashboard sections.
 */
(function () {
    const history = { stack: [], index: -1 };
    let analyzing = false;
    let dropProcessing = false;
    let lastDropContext = null;

    const SKIP_PATH_SEGMENTS = [
        '/node_modules/',
        '\\node_modules\\',
        '/.git/',
        '\\.git\\',
        '/dist/',
        '/build/',
        '/.vscode/',
        '/coverage/'
    ];

    const REPORT_JSON_HINTS = [
        /mock-data-analysis-report/i,
        /issue-resolution/i,
        /code-generation/i,
        /ai-roadmap-report/i,
        /ai-roadmap-sample/i,
        /ai-tools-sample/i,
        /database-sample/i,
        /ai-analysis-sample/i,
        /reports-sample/i,
        /reports-model/i,
        /analytics-sample/i,
        /performance-sample/i,
        /gguf-development-roadmap/i,
        /development-roadmap-report/i,
        /gguf-roadmap/i,
        /development-roadmap/i,
        /dynamic-project-roadmap/i,
        /roadmap-comparison/i,
        /engineering-baseline/i,
        /data-maintenance-analyzers/i,
        /-sample\.json$/i,
        /\/reports\//i,
        /\/data\//i,
        /\/web\/data\//i
    ];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatUserError(message) {
        const text = String(message || 'Something went wrong');
        if (/Unrecognized input/i.test(text)) {
            return 'Try a sample shortcut (roadmap, issues, security), a folder path, URL, or paste JSON.';
        }
        if (/Sample fetch failed|fetch failed/i.test(text)) {
            return 'Could not load sample data — is the dashboard server running on this port?';
        }
        if (/Path analysis failed|mock.scan/i.test(text)) {
            return 'Directory scan failed — check the path exists and the server can read it.';
        }
        if (/not valid JSON|Invalid JSON/i.test(text)) {
            return 'That file is not valid JSON — try a *-sample.json from web/data or paste a report object.';
        }
        if (/No cached report from last drop/i.test(text)) {
            return 'Drop the folder again or enter the full disk path to your project.';
        }
        return text.length > 160 ? `${text.slice(0, 157)}…` : text;
    }

    function getAddressInput() {
        return document.getElementById('global-data-address');
    }

    function setStatus(message, type = 'info') {
        const el = document.getElementById('global-data-status');
        if (el) {
            el.className = `global-data-status ${type}`;
            el.textContent = message /* Replaced innerHTML with textContent for safety */
        }
    }

    function pushHistory(value) {
        if (!value) return;
        if (history.stack[history.index] === value) return;
        history.stack = history.stack.slice(0, history.index + 1);
        history.stack.push(value);
        history.index = history.stack.length - 1;
    }

    function navigateHistory(delta) {
        const next = history.index + delta;
        if (next < 0 || next >= history.stack.length) return;
        history.index = next;
        const input = getAddressInput();
        if (input) input.value = history.stack[next];
    }

    function isLikelyUrl(value) {
        return /^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value);
    }

    function isLikelyPath(value) {
        if (/^([a-zA-Z]:[\\/]|\\\\|\/|~\/|\.\/|\.\.\/)/.test(value)) return true;
        if (/[/\\]/.test(value)) return true;
        return false;
    }

    function isBareProjectName(value) {
        return /^[\w .-]+$/.test(value) && !isLikelyUrl(value) && !value.includes('=');
    }

    function normalizeAddressInput(value) {
        const trimmed = value.trim();
        if (/^localhost(:\d+)?(\/|$)/i.test(trimmed) || /^127\.0\.0\.1(:\d+)?(\/|$)/.test(trimmed)) {
            return `http://${trimmed.replace(/^\/+/, '')}`;
        }
        return trimmed;
    }

    async function tryAnalyzeSampleShortcut(value) {
        const normalized = value.replace(/^\?/, '').trim().toLowerCase();
        const aliases = {
            'issues': 'issues=sample',
            'issue-resolution': 'issues=sample',
            'codegen': 'codegen=sample',
            'code-generation': 'codegen=sample',
            'roadmap': 'roadmap=sample',
            'ai-roadmap': 'roadmap=sample',
            'gguf-roadmap': 'roadmap=sample',
            'development-roadmap': 'roadmap=sample',
            'mock': 'mock=gguf-sample',
            'mock-analysis': 'mock=gguf-sample',
            'ai-tools': 'aitools=sample',
            'aitools': 'aitools=sample',
            'database': 'database=sample',
            'db': 'database=sample',
            'analysis': 'analysis=sample',
            'ai-analysis': 'analysis=sample',
            'api': 'api=sample',
            'reports': 'reports=sample',
            'analytics': 'analytics=sample',
            'performance': 'performance=sample',
            'debt': 'debt=sample',
            'reduction': 'reduction=sample',
            'debt-reduction': 'reduction=sample',
            'debt-analytics': 'debtanalytics=sample',
            'debtanalytics': 'debtanalytics=sample',
            'feature-backlog': 'backlog=sample',
            'backlog': 'backlog=sample',
            'release-timeline': 'timeline=sample',
            'timeline': 'timeline=sample',
            'billing-system': 'billing=sample',
            'billing': 'billing=sample',
            'project-reports': 'preports=sample',
            'preports': 'preports=sample',
            'assets-library': 'assets=sample',
            'assets': 'assets=sample',
            'code-templates': 'templates=sample',
            'templates': 'templates=sample',
            'coverage-reports': 'coverage=sample',
            'coverage': 'coverage=sample',
            'settings': 'settings=sample',
            'help': 'help=sample',
            'implementation-plan': 'implplan=sample',
            'implplan': 'implplan=sample',
            'dashboard': 'dashboard=sample',
            'home': 'dashboard=sample',
            'quality': 'quality=sample',
            'security': 'security=sample',
            'support': 'support=sample',
            'dev-tools': 'devtools=sample',
            'devtools': 'devtools=sample',
            'merger-tool': 'merger=sample',
            'merger': 'merger=sample'
        };
        const query = aliases[normalized] || (normalized.includes('=') ? normalized : '');
        if (!query) return false;

        const params = new URLSearchParams(query);
        if (params.get('issues') === 'sample' && typeof window.loadIssueResolutionSample === 'function') {
            navigateToSection('issue-resolution');
            await window.loadIssueResolutionSample();
            setStatus('✅ Loaded issue resolution sample data', 'success');
            return true;
        }
        if (params.get('codegen') === 'sample' && typeof window.loadCodeGenerationSample === 'function') {
            navigateToSection('code-generation');
            await window.loadCodeGenerationSample();
            setStatus('✅ Loaded code generation sample data', 'success');
            return true;
        }
        if (params.get('roadmap') === 'sample' && typeof window.loadAIRoadmapSample === 'function') {
            navigateToSection('ai-roadmap');
            await window.loadAIRoadmapSample();
            setStatus('✅ Loaded AI roadmap sample data', 'success');
            return true;
        }
        if (params.get('mock') === 'gguf-sample' && typeof window.loadGgufAnalysisSample === 'function') {
            navigateToSection('gguf-analysis');
            await window.loadGgufAnalysisSample();
            setStatus('✅ Loaded GGUF mock analysis sample data', 'success');
            return true;
        }
        if (params.get('aitools') === 'sample' && typeof window.loadAIToolsSample === 'function') {
            navigateToSection('ai-tools');
            await window.loadAIToolsSample();
            setStatus('✅ Loaded AI tools sample data', 'success');
            return true;
        }
        if (params.get('database') === 'sample' && typeof window.loadDatabaseSample === 'function') {
            navigateToSection('database');
            await window.loadDatabaseSample();
            setStatus('✅ Loaded database sample data', 'success');
            return true;
        }
        if (params.get('analysis') === 'sample' && typeof window.loadAIAnalysisSample === 'function') {
            navigateToSection('ai-analysis');
            await window.loadAIAnalysisSample();
            setStatus('✅ Loaded AI analysis sample data', 'success');
            return true;
        }
        if (params.get('api') === 'sample' && typeof window.loadAPISample === 'function') {
            navigateToSection('api');
            await window.loadAPISample();
            setStatus('✅ Loaded API sample data', 'success');
            return true;
        }
        if (params.get('reports') === 'sample' && typeof window.loadReportsSample === 'function') {
            navigateToSection('reports');
            await window.loadReportsSample();
            setStatus('✅ Loaded reports sample data', 'success');
            return true;
        }
        if (params.get('analytics') === 'sample' && typeof window.loadAnalyticsSample === 'function') {
            navigateToSection('analytics');
            await window.loadAnalyticsSample();
            setStatus('✅ Loaded analytics sample data', 'success');
            return true;
        }
        if (params.get('performance') === 'sample' && typeof window.loadPerformanceSample === 'function') {
            navigateToSection('performance');
            await window.loadPerformanceSample();
            setStatus('✅ Loaded performance sample data', 'success');
            return true;
        }
        if (params.get('reduction') === 'sample' && typeof window.loadDebtReductionSample === 'function') {
            navigateToSection('debt-reduction');
            await window.loadDebtReductionSample();
            setStatus('✅ Loaded debt reduction sample data', 'success');
            return true;
        }
        if (params.get('debtanalytics') === 'sample' && typeof window.loadDebtAnalyticsSample === 'function') {
            navigateToSection('debt-analytics');
            await window.loadDebtAnalyticsSample();
            setStatus('✅ Loaded debt analytics sample data', 'success');
            return true;
        }
        if (params.get('backlog') === 'sample' && typeof window.loadFeatureBacklogSample === 'function') {
            navigateToSection('feature-backlog');
            await window.loadFeatureBacklogSample();
            setStatus('✅ Loaded feature backlog sample data', 'success');
            return true;
        }
        if (params.get('timeline') === 'sample' && typeof window.loadReleaseTimelineSample === 'function') {
            navigateToSection('release-timeline');
            await window.loadReleaseTimelineSample();
            setStatus('✅ Loaded release timeline sample data', 'success');
            return true;
        }
        if (params.get('billing') === 'sample' && typeof window.loadBillingSystemSample === 'function') {
            navigateToSection('billing-system');
            await window.loadBillingSystemSample();
            setStatus('✅ Loaded billing system sample data', 'success');
            return true;
        }
        if (params.get('preports') === 'sample' && typeof window.loadProjectReportsSample === 'function') {
            navigateToSection('project-reports');
            await window.loadProjectReportsSample();
            setStatus('✅ Loaded project reports sample data', 'success');
            return true;
        }
        if (params.get('assets') === 'sample' && typeof window.loadAssetsLibrarySample === 'function') {
            navigateToSection('assets-library');
            await window.loadAssetsLibrarySample();
            setStatus('✅ Loaded assets library sample data', 'success');
            return true;
        }
        if (params.get('templates') === 'sample' && typeof window.loadCodeTemplatesSample === 'function') {
            navigateToSection('code-templates');
            await window.loadCodeTemplatesSample();
            setStatus('✅ Loaded code templates sample data', 'success');
            return true;
        }
        if (params.get('coverage') === 'sample' && typeof window.loadCoverageReportsSample === 'function') {
            navigateToSection('coverage-reports');
            await window.loadCoverageReportsSample();
            setStatus('✅ Loaded coverage reports sample data', 'success');
            return true;
        }
        if (params.get('settings') === 'sample' && typeof window.loadSettingsSample === 'function') {
            navigateToSection('settings');
            await window.loadSettingsSample();
            setStatus('✅ Loaded settings sample data', 'success');
            return true;
        }
        if (params.get('help') === 'sample' && typeof window.loadHelpSample === 'function') {
            navigateToSection('help');
            await window.loadHelpSample();
            setStatus('✅ Loaded help sample data', 'success');
            return true;
        }
        if (params.get('implplan') === 'sample' && typeof window.loadImplementationPlanSample === 'function') {
            navigateToSection('implementation-plan');
            await window.loadImplementationPlanSample();
            setStatus('✅ Loaded implementation plan sample data', 'success');
            return true;
        }
        if (params.get('dashboard') === 'sample' && typeof window.loadDashboardHomeSample === 'function') {
            navigateToSection('dashboard');
            await window.loadDashboardHomeSample();
            setStatus('✅ Loaded dashboard home sample data', 'success');
            return true;
        }
        if (params.get('debt') === 'sample' && typeof window.loadDebtCalculatorSample === 'function') {
            navigateToSection('debt-calculator');
            await window.loadDebtCalculatorSample();
            setStatus('✅ Loaded debt calculator sample data', 'success');
            return true;
        }
        if (params.get('quality') === 'sample' && typeof window.loadQualityDashboardSample === 'function') {
            navigateToSection('quality');
            await window.loadQualityDashboardSample();
            setStatus('✅ Loaded quality dashboard sample data', 'success');
            return true;
        }
        if (params.get('security') === 'sample' && typeof window.loadSecurityDashboardSample === 'function') {
            navigateToSection('security');
            await window.loadSecurityDashboardSample();
            setStatus('✅ Loaded security dashboard sample data', 'success');
            return true;
        }
        if (params.get('support') === 'sample' && typeof window.loadSupportDashboardSample === 'function') {
            navigateToSection('support');
            await window.loadSupportDashboardSample();
            setStatus('✅ Loaded support dashboard sample data', 'success');
            return true;
        }
        if (params.get('devtools') === 'sample' && typeof window.loadDevToolsSample === 'function') {
            navigateToSection('dev-tools');
            await window.loadDevToolsSample();
            setStatus('✅ Loaded dev tools sample data', 'success');
            return true;
        }
        if (params.get('merger') === 'sample' && typeof window.loadMergerToolSample === 'function') {
            navigateToSection('merger-tool');
            await window.loadMergerToolSample();
            setStatus('✅ Loaded merger tool sample data', 'success');
            return true;
        }
        return false;
    }

    function isApiEndpoint(value) {
        return value.startsWith('/api/') || value.startsWith('/data/');
    }

    function normalizeUrl(value) {
        if (/^https?:\/\//i.test(value)) return value;
        return `https://${value.replace(/^\/+/, '')}`;
    }

    function shouldSkipFilePath(relativePath) {
        const normalized = String(relativePath || '').replace(/\\/g, '/');
        return SKIP_PATH_SEGMENTS.some((segment) => normalized.includes(segment.replace(/\\/g, '/')));
    }

    function isLikelyReportJson(relativePath) {
        const normalized = String(relativePath || '').replace(/\\/g, '/');
        if (normalized.endsWith('tsconfig.json') || normalized.endsWith('package-lock.json')) return false;
        if (normalized.endsWith('launch.json') || normalized.endsWith('.vscode/settings.json')) return false;
        return REPORT_JSON_HINTS.some((pattern) => pattern.test(normalized));
    }

    function scoreReportCandidate(relativePath, payloadType) {
        const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
        let score = payloadType ? 10 : 0;
        if (normalized.includes('/reports/')) score += 8;
        if (normalized.includes('/data/')) score += 6;
        if (normalized.includes('sample')) score += 4;
        if (normalized.includes('mock-data-analysis-report')) score += 5;
        if (normalized.includes('issue-resolution')) score += 5;
        if (normalized.includes('code-generation')) score += 5;
        if (normalized.includes('ai-roadmap')) score += 5;
        if (normalized.includes('gguf-development-roadmap')) score += 6;
        if (normalized.includes('development-roadmap')) score += 5;
        return score;
    }

    const detectPayloadType = (typeof PayloadRouting !== 'undefined' && PayloadRouting.detectPayloadType)
        ? PayloadRouting.detectPayloadType
        : function fallbackDetectPayloadType(payload) {
            if (!payload || typeof payload !== 'object') return null;
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
            if (payload.type === 'implementation-plan-model') return 'implementation-plan';
            if (payload.type === 'dashboard-home-model') return 'dashboard';
            if (payload.type === 'merger-tool-model') return 'merger-tool';
            if (payload.analysisOverview?.issuesDetected != null) return 'mock-analysis';
            return null;
        };

    function navigateToSection(sectionName) {
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, null);
        }
    }

    async function parseApiJsonResponse(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error('Response is not valid JSON');
        }
    }

    async function analyzeFromPath(projectPath) {
        const analyzeOptions = typeof window.getGlobalAnalyzeOptions === 'function'
            ? window.getGlobalAnalyzeOptions()
            : { aiProvider: 'active', analysisType: 'auto' };

        setStatus('⏳ Analyzing project path…', 'loading');
        window.showNotification?.('🤖 Analyzing project path…', 'info');

        const pathInput = document.getElementById('roadmap-project-path');
        if (pathInput) pathInput.value = projectPath;

        const scanOptions = typeof window.readRoadmapScanOptions === 'function'
            ? window.readRoadmapScanOptions()
            : { includePaths: [], excludePatterns: [] };

        const response = await fetch('/api/analyze/flexible', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectPath,
                aiProvider: analyzeOptions.aiProvider,
                analysisType: analyzeOptions.analysisType,
                includePaths: scanOptions.includePaths,
                excludePatterns: scanOptions.excludePatterns
            })
        });
        const data = await parseApiJsonResponse(response);
        if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || 'Path analysis failed');
        }

        if (data.analysisType === 'mock-scan') {
            if (typeof window.applyGgufAnalysisReport === 'function' && data.report) {
                await window.applyGgufAnalysisReport(data.report, projectPath);
            } else if (typeof window.applyImportedMockAnalysisJson === 'function' && data.report) {
                await window.applyImportedMockAnalysisJson(data.report, projectPath);
            }
            navigateToSection('gguf-analysis');
            const providerLabel = data.aiProvider || analyzeOptions.aiProvider;
            setStatus(
                `✅ Mock scan complete for <code>${escapeHtml(data.projectPath || projectPath)}</code> (${escapeHtml(providerLabel)})`,
                'success'
            );
            window.showNotification?.('✅ Directory scanned — see Mock Data Analyzer', 'success');
            return;
        }

        if (typeof window.applyGeneratedRoadmapToDashboard === 'function') {
            window.applyGeneratedRoadmapToDashboard(data.roadmap, data.projectPath);
        }
        navigateToSection('roadmap');
        setStatus(`✅ Roadmap generated from <code>${escapeHtml(data.projectPath)}</code>`, 'success');
        window.showNotification?.('✅ Project path analyzed — roadmap updated', 'success');
    }

    async function analyzeFromUrl(url) {
        setStatus(`⏳ Fetching <code>${escapeHtml(url)}</code>…`, 'loading');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const payload = JSON.parse(text);
            await routePayload(payload, url);
            return;
        }

        setStatus(`✅ Fetched ${(text.length / 1024).toFixed(1)}KB from URL`, 'success');
        window.showNotification?.('✅ URL fetched — use JSON endpoints for auto-routing', 'info');
        window.dispatchEvent(new CustomEvent('global-data-input', {
            detail: { type: 'url-content', url, content: text }
        }));
    }

    async function analyzeFromApi(endpoint) {
        setStatus(`⏳ Loading <code>${escapeHtml(endpoint)}</code>…`, 'loading');
        const response = await fetch(endpoint);
        const payload = await parseApiJsonResponse(response);
        if (!response.ok) throw new Error(payload.error || `API error (${response.status})`);
        await routePayload(payload.data || payload, endpoint);
    }

    async function routePayload(payload, sourceLabel) {
        const type = detectPayloadType(payload);
        const label = sourceLabel || 'input';

        switch (type) {
            case 'ai-analysis':
                if (typeof window.applyAIAnalysisModel === 'function') {
                    window.applyAIAnalysisModel(payload, label);
                } else {
                    navigateToSection('ai-analysis');
                }
                setStatus(`✅ AI analysis loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'ai-roadmap':
                if (typeof window.applyAIRoadmapModel === 'function') {
                    window.applyAIRoadmapModel(payload, label);
                } else {
                    navigateToSection('ai-roadmap');
                }
                setStatus(
                    `✅ AI roadmap report loaded from <code>${escapeHtml(label)}</code>`
                    + (payload.developmentPhases?.length ? ' — Development Roadmap synced' : ''),
                    'success'
                );
                break;
            case 'ai-tools':
                if (typeof window.applyAIToolsModel === 'function') {
                    window.applyAIToolsModel(payload, label);
                } else {
                    navigateToSection('ai-tools');
                }
                setStatus(`✅ AI tools loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'analytics':
                if (typeof window.applyAnalyticsModel === 'function') {
                    window.applyAnalyticsModel(payload, label);
                } else {
                    navigateToSection('analytics');
                }
                setStatus(`✅ Analytics loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'api':
                if (typeof window.applyAPIModel === 'function') {
                    window.applyAPIModel(payload, label);
                } else {
                    navigateToSection('api');
                }
                setStatus(`✅ API data loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'code-generation':
                if (typeof window.applyCodeGenerationModel === 'function') {
                    window.applyCodeGenerationModel(payload, label);
                } else {
                    navigateToSection('code-generation');
                }
                setStatus(`✅ Code generation data loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'database':
                navigateToSection('database');
                window.applyDatabaseModel?.(payload, label);
                setStatus(`✅ Database data loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'debt-calculator':
                if (typeof window.applyDebtCalculatorModel === 'function') {
                    window.applyDebtCalculatorModel(payload, label);
                } else {
                    navigateToSection('debt-calculator');
                }
                setStatus(`✅ Debt calculator loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'debt-reduction':
                if (typeof window.applyDebtReductionModel === 'function') {
                    window.applyDebtReductionModel(payload, label);
                } else {
                    navigateToSection('debt-reduction');
                }
                setStatus(`✅ Debt reduction loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'debt-analytics':
                if (typeof window.applyDebtAnalyticsModel === 'function') {
                    window.applyDebtAnalyticsModel(payload, label);
                } else {
                    navigateToSection('debt-analytics');
                }
                setStatus(`✅ Debt analytics loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'feature-backlog':
                if (typeof window.applyFeatureBacklogReport === 'function') {
                    window.applyFeatureBacklogReport(payload, label);
                } else {
                    navigateToSection('feature-backlog');
                }
                setStatus(`✅ Feature backlog loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'release-timeline':
                if (typeof window.applyReleaseTimelineModel === 'function') {
                    await window.applyReleaseTimelineModel(payload, label);
                } else {
                    navigateToSection('release-timeline');
                }
                setStatus(`✅ Release timeline loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'billing-system':
                if (typeof window.applyBillingSystemModel === 'function') {
                    window.applyBillingSystemModel(payload, label);
                } else {
                    navigateToSection('billing-system');
                }
                setStatus(`✅ Billing system loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'project-reports':
                if (typeof window.applyProjectReportsModel === 'function') {
                    window.applyProjectReportsModel(payload, label);
                } else {
                    navigateToSection('project-reports');
                }
                setStatus(`✅ Project reports loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'assets-library':
                if (typeof window.applyAssetsLibraryModel === 'function') {
                    window.applyAssetsLibraryModel(payload, label);
                } else {
                    navigateToSection('assets-library');
                }
                setStatus(`✅ Assets library loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'code-templates':
                if (typeof window.applyCodeTemplatesModel === 'function') {
                    window.applyCodeTemplatesModel(payload, label);
                } else {
                    navigateToSection('code-templates');
                }
                setStatus(`✅ Code templates loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'coverage-reports':
                if (typeof window.applyCoverageReportsModel === 'function') {
                    window.applyCoverageReportsModel(payload, label);
                } else {
                    navigateToSection('coverage-reports');
                }
                setStatus(`✅ Coverage reports loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'settings':
                if (typeof window.applySettingsModel === 'function') {
                    window.applySettingsModel(payload, label);
                } else {
                    navigateToSection('settings');
                }
                setStatus(`✅ Settings loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'help':
                if (typeof window.applyHelpModel === 'function') {
                    window.applyHelpModel(payload, label);
                } else {
                    navigateToSection('help');
                }
                setStatus(`✅ Help loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'implementation-plan':
                if (typeof window.applyImplementationPlanModel === 'function') {
                    window.applyImplementationPlanModel(payload, label);
                } else {
                    navigateToSection('implementation-plan');
                }
                setStatus(`✅ Implementation plan loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'dashboard':
                if (typeof window.applyDashboardHomeModel === 'function') {
                    await window.applyDashboardHomeModel(payload, label);
                    navigateToSection('dashboard');
                } else {
                    navigateToSection('dashboard');
                }
                setStatus(`✅ Dashboard loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'dev-tools':
                if (payload.type === 'data-maintenance-analyzers-report'
                    && typeof window.applyDataMaintenanceAnalyzersReport === 'function') {
                    window.applyDataMaintenanceAnalyzersReport(payload, label);
                } else if (typeof window.applyDevToolsModel === 'function') {
                    window.applyDevToolsModel(payload, label);
                } else {
                    navigateToSection('dev-tools');
                }
                setStatus(`✅ Dev tools loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'roadmap-comparison':
                if (typeof window.applyImportedComparisonReport === 'function') {
                    window.applyImportedComparisonReport(payload, label);
                } else {
                    navigateToSection('roadmap');
                }
                setStatus(`✅ Roadmap comparison loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'dynamic-roadmap':
                navigateToSection('roadmap');
                window.applyImportedRoadmapJson?.(payload, label);
                setStatus(`✅ Dynamic roadmap loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'gguf-roadmap':
                if (typeof window.applyImportedRoadmapJson === 'function') {
                    await window.applyImportedRoadmapJson(payload, label);
                } else if (typeof window.applyAIRoadmapModel === 'function') {
                    window.applyAIRoadmapModel(payload, label);
                } else {
                    navigateToSection('roadmap');
                }
                if (payload.analysisOverview) {
                    setStatus(`✅ GGUF roadmap loaded from <code>${escapeHtml(label)}</code> — mock analyzer stats synced`, 'success');
                } else {
                    setStatus(`✅ GGUF development roadmap loaded from <code>${escapeHtml(label)}</code>`, 'success');
                }
                break;
            case 'issue-resolution':
                if (typeof window.applyIssueResolutionModel === 'function') {
                    window.applyIssueResolutionModel(payload, label);
                } else {
                    navigateToSection('issue-resolution');
                }
                setStatus(`✅ Issue resolution data loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'merger-tool':
                if (typeof window.applyMergerToolModel === 'function') {
                    window.applyMergerToolModel(payload, label);
                } else {
                    navigateToSection('merger-tool');
                }
                setStatus(`✅ Merger tool data loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'mock-analysis':
                if (typeof window.applyGgufAnalysisReport === 'function') {
                    await window.applyGgufAnalysisReport(payload, label);
                } else {
                    navigateToSection('gguf-analysis');
                }
                setStatus(`✅ GGUF mock data analysis loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'performance':
                if (typeof window.applyPerformanceModel === 'function') {
                    window.applyPerformanceModel(payload, label);
                } else {
                    navigateToSection('performance');
                }
                setStatus(`✅ Performance loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'quality':
                if (typeof window.applyQualityDashboardModel === 'function') {
                    await window.applyQualityDashboardModel(payload, label);
                } else {
                    navigateToSection('quality');
                }
                setStatus(`✅ Quality dashboard loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'security':
                if (typeof window.applySecurityDashboardModel === 'function') {
                    await window.applySecurityDashboardModel(payload, label);
                } else {
                    navigateToSection('security');
                }
                setStatus(`✅ Security dashboard loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'support':
                if (typeof window.applySupportDashboardModel === 'function') {
                    await window.applySupportDashboardModel(payload, label);
                } else {
                    navigateToSection('support');
                }
                setStatus(`✅ Support dashboard loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            case 'reports':
                if (typeof window.applyReportsModel === 'function') {
                    window.applyReportsModel(payload, label);
                } else {
                    navigateToSection('reports');
                }
                setStatus(`✅ Reports catalog loaded from <code>${escapeHtml(label)}</code>`, 'success');
                break;
            default:
                window.dispatchEvent(new CustomEvent('global-data-input', {
                    detail: { type: 'unknown-json', source: label, payload }
                }));
                setStatus(`⚠️ JSON loaded but type not recognized — dispatched global event`, 'warning');
                window.showNotification?.('JSON loaded — no auto-route matched', 'warning');
        }
    }

    async function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                reader.readAsText(file);
            } catch (error) {
                if (isInvalidStateError(error)) {
                    reject(new Error('File is no longer available — drop the folder again or use Browse Folder'));
                } else {
                    reject(error);
                }
            }
        });
    }

    function fileFromEntry(entry) {
        return new Promise((resolve, reject) => {
            try {
                entry.file(resolve, reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    function isInvalidStateError(error) {
        return error?.name === 'InvalidStateError'
            || /state cached in an interface object/i.test(error?.message || '');
    }

    function readDirectoryEntries(directoryReader) {
        return new Promise((resolve, reject) => {
            const entries = [];
            function readBatch() {
                try {
                    directoryReader.readEntries((batch) => {
                        if (!batch.length) {
                            resolve(entries);
                            return;
                        }
                        entries.push(...batch);
                        readBatch();
                    }, reject);
                } catch (error) {
                    reject(error);
                }
            }
            readBatch();
        });
    }

    async function readDirectoryEntrySequential(directoryEntry, basePath = '') {
        const dirPath = basePath ? `${basePath}/${directoryEntry.name}` : directoryEntry.name;
        const reader = directoryEntry.createReader();
        const entries = await readDirectoryEntries(reader);
        const files = [];

        for (const entry of entries) {
            try {
                if (entry.isFile) {
                    const file = await fileFromEntry(entry);
                    if (!file.webkitRelativePath) {
                        try {
                            Object.defineProperty(file, 'webkitRelativePath', {
                                value: `${dirPath}/${file.name}`,
                                configurable: true
                            });
                        } catch (_) { /* ignore */ }
                    }
                    files.push(file);
                } else if (entry.isDirectory) {
                    files.push(...await readDirectoryEntrySequential(entry, dirPath));
                }
            } catch (error) {
                if (!isInvalidStateError(error)) {
                    console.warn('Skipping folder entry:', entry?.name, error.message);
                }
            }
        }

        return files;
    }

    function captureDropPayload(dataTransfer) {
        const payload = { entries: [], files: [], urlText: '' };
        if (!dataTransfer) return payload;

        try {
            payload.urlText = dataTransfer.getData('text') || dataTransfer.getData('text/plain') || '';
        } catch (_) { /* drop state may already be consumed */ }

        try {
            const list = dataTransfer.files;
            if (list?.length) {
                for (let i = 0; i < list.length; i += 1) {
                    payload.files.push(list[i]);
                }
            }
        } catch (_) { /* ignore */ }

        try {
            const items = dataTransfer.items;
            if (items?.length && typeof items[0]?.webkitGetAsEntry === 'function') {
                for (let i = 0; i < items.length; i += 1) {
                    const item = items[i];
                    if (item.kind !== 'file') continue;
                    const entry = item.webkitGetAsEntry();
                    if (entry) payload.entries.push(entry);
                }
            }
        } catch (_) { /* ignore */ }

        const expandedFolder = payload.files.length > 1
            && payload.files.some((file) => file.webkitRelativePath);
        const emptyFolderPlaceholder = payload.files.length === 1
            && !payload.files[0].type
            && payload.files[0].size === 0
            && payload.entries.length > 0;

        if (expandedFolder) {
            payload.entries = [];
        } else if (emptyFolderPlaceholder) {
            payload.files = [];
        }

        return payload;
    }

    async function collectFilesFromDropPayload(dropPayload) {
        if (dropPayload.files.length) {
            return dropPayload.files;
        }

        const files = [];
        for (const entry of dropPayload.entries) {
            try {
                if (entry.isFile) {
                    files.push(await fileFromEntry(entry));
                } else if (entry.isDirectory) {
                    files.push(...await readDirectoryEntrySequential(entry));
                }
            } catch (error) {
                if (isInvalidStateError(error)) {
                    throw new Error('Folder drop expired — release the mouse over the drop zone and try again, or use Browse Folder');
                }
                console.warn('Skipping dropped entry:', entry?.name, error.message);
            }
        }
        return files;
    }

    function folderLabelFromFiles(files) {
        const relative = files.find((file) => file.webkitRelativePath)?.webkitRelativePath;
        if (relative) return relative.split('/')[0];
        if (files.length === 1 && !files[0].type && files[0].size === 0) return files[0].name;
        return null;
    }

    async function analyzeFiles(files, sourceLabel) {
        if (!files?.length) return;

        const filteredFiles = files.filter((file) => {
            const relativePath = file.webkitRelativePath || file.name;
            return !shouldSkipFilePath(relativePath);
        });

        const folderLabel = sourceLabel || folderLabelFromFiles(filteredFiles.length ? filteredFiles : files);
        const workingFiles = filteredFiles.length ? filteredFiles : files;
        const skippedCount = files.length - workingFiles.length;
        const statusLabel = folderLabel
            ? `${escapeHtml(folderLabel)} (${workingFiles.length} files${skippedCount ? `, ${skippedCount} skipped` : ''})`
            : `${workingFiles.length} file(s)`;
        setStatus(`⏳ Analyzing ${statusLabel}…`, 'loading');

        const jsonFiles = workingFiles.filter((file) => {
            const name = file.name.toLowerCase();
            if (!name.endsWith('.json') && !file.type.includes('json')) return false;
            const relativePath = file.webkitRelativePath || file.name;
            return isLikelyReportJson(relativePath);
        });

        const isFolderBatch = workingFiles.length > 1 || Boolean(folderLabel);
        const candidates = [];

        for (const file of jsonFiles) {
            const label = file.webkitRelativePath || file.name;
            try {
                const text = await readFileAsText(file);
                const payload = JSON.parse(text);
                const payloadType = detectPayloadType(payload);
                if (!payloadType) continue;
                candidates.push({
                    file,
                    label,
                    payload,
                    payloadType,
                    score: scoreReportCandidate(label, payloadType)
                });
            } catch {
                // Ignore non-report or invalid JSON during folder scans
            }
        }

        let routedCount = 0;
        let savedReports = [];
        if (isFolderBatch && candidates.length) {
            candidates.sort((a, b) => b.score - a.score);
            const bestByType = new Map();
            for (const candidate of candidates) {
                if (!bestByType.has(candidate.payloadType)) {
                    bestByType.set(candidate.payloadType, candidate);
                }
            }
            const toRoute = [...bestByType.values()].sort((a, b) => b.score - a.score);
            const primary = toRoute[0];
            await routePayload(primary.payload, primary.label);
            routedCount = 1;
            pushHistory(primary.label);
            savedReports = toRoute.map((candidate) => ({
                label: candidate.label,
                payload: candidate.payload,
                payloadType: candidate.payloadType,
                score: candidate.score
            }));

            if (toRoute.length > 1) {
                setStatus(
                    `✅ Loaded best report <code>${escapeHtml(primary.label)}</code> (+${toRoute.length - 1} other report type(s) found)`,
                    'success'
                );
            }
        } else {
            for (const file of jsonFiles) {
                const label = file.webkitRelativePath || file.name;
                try {
                    const text = await readFileAsText(file);
                    const payload = JSON.parse(text);
                    const payloadType = detectPayloadType(payload);
                    if (!payloadType) continue;
                    await routePayload(payload, label);
                    routedCount += 1;
                    pushHistory(label);
                    savedReports.push({
                        label,
                        payload,
                        payloadType,
                        score: scoreReportCandidate(label, payloadType)
                    });
                } catch (error) {
                    console.warn('Skipping JSON file:', label, error.message);
                }
            }
        }

        const nonJsonCount = workingFiles.length - jsonFiles.length;
        if (nonJsonCount > 0 || jsonFiles.length > 0) {
            window.dispatchEvent(new CustomEvent('global-data-input', {
                detail: {
                    type: 'folder-files',
                    folder: folderLabel,
                    files: workingFiles,
                    nonJsonCount,
                    jsonCount: jsonFiles.length,
                    reportCandidates: candidates.length
                }
            }));
        }

        if (folderLabel) {
            getAddressInput().value = folderLabel;
            pushHistory(folderLabel);
            lastDropContext = {
                label: folderLabel,
                fileCount: workingFiles.length,
                routedReports: savedReports,
                at: Date.now()
            };
        } else if (workingFiles.length) {
            lastDropContext = {
                label: workingFiles[0].webkitRelativePath || workingFiles[0].name,
                fileCount: workingFiles.length,
                routedReports: savedReports,
                at: Date.now()
            };
        }

        if (!routedCount) {
            if (workingFiles.length > 1 || folderLabel) {
                setStatus(
                    `✅ Scanned ${workingFiles.length} files from <code>${escapeHtml(folderLabel || 'folder')}</code> — no recognized dashboard reports`,
                    'success'
                );
            } else {
                setStatus(`✅ Processed ${workingFiles.length} file(s)`, 'success');
            }
        } else if (!isFolderBatch || candidates.length <= 1) {
            setStatus(
                `✅ Routed ${routedCount} JSON report(s) from ${workingFiles.length} files in <code>${escapeHtml(folderLabel || 'folder')}</code>`,
                'success'
            );
        }

        window.showNotification?.(
            routedCount
                ? `✅ Analyzed folder: ${routedCount} report(s) from ${workingFiles.length} files`
                : `📂 Received ${workingFiles.length} file(s) from folder`,
            routedCount ? 'success' : 'info'
        );
    }

    async function analyzePastedJson(text, sourceLabel = 'pasted JSON') {
        const trimmed = String(text || '').trim();
        if (!trimmed.startsWith('{')) {
            throw new Error('Clipboard content is not a JSON object');
        }
        const payload = JSON.parse(trimmed);
        await routePayload(payload, sourceLabel);
    }

    async function pasteJsonFromClipboard() {
        if (analyzing) return;
        analyzing = true;
        setStatus('⏳ Reading JSON from clipboard…', 'loading');
        try {
            const text = await navigator.clipboard.readText();
            getAddressInput().value = 'Pasted JSON report';
            pushHistory('Pasted JSON report');
            await analyzePastedJson(text, 'clipboard JSON');
            window.showNotification?.('✅ JSON report loaded from clipboard', 'success');
        } catch (error) {
            console.error('Paste JSON failed:', error);
            setStatus(`❌ ${escapeHtml(error.message)}`, 'error');
            window.showNotification?.(`❌ ${error.message}`, 'error');
        } finally {
            analyzing = false;
        }
    }

    function extractUrlFromDrop(text) {
        if (!text) return null;
        const match = text.match(/https?:\/\/[^\s"'<>]+/i);
        if (match) return match[0];
        if (isLikelyUrl(text.trim())) return normalizeUrl(text.trim());
        return null;
    }

    async function analyzeAddressValue(rawValue) {
        const value = normalizeAddressInput(rawValue);
        if (!value) {
            window.showNotification?.('Enter a path, URL, or drop files to analyze', 'warning');
            return;
        }
        if (analyzing) return;

        analyzing = true;
        pushHistory(value);
        getAddressInput().value = value;

        try {
            if (await tryAnalyzeSampleShortcut(value)) {
                window.showNotification?.('✅ Sample data loaded', 'success');
                return;
            }

            if (lastDropContext && value === lastDropContext.label) {
                if (lastDropContext.routedReports?.length) {
                    const primary = [...lastDropContext.routedReports]
                        .sort((a, b) => b.score - a.score)[0];
                    setStatus(`⏳ Re-loading report from <code>${escapeHtml(primary.label)}</code>…`, 'loading');
                    await routePayload(primary.payload, primary.label);
                    setStatus(
                        `✅ Re-loaded report from dropped folder (${lastDropContext.fileCount || 0} files scanned)`,
                        'success'
                    );
                    return;
                }
                throw new Error(
                    'No cached report from last drop — drop the folder again, use Browse Folder, or enter the full disk path (e.g. C:\\Users\\Trevor\\CascadeProjects\\ai-platform)'
                );
            }

            if (isApiEndpoint(value)) {
                await analyzeFromApi(value);
            } else if (isLikelyUrl(value)) {
                await analyzeFromUrl(normalizeUrl(value));
            } else if (value.endsWith('.json')) {
                const jsonPath = value.startsWith('/')
                    ? value
                    : `/data/${value.split(/[/\\]/).pop()}`;
                await analyzeFromApi(jsonPath);
            } else if (value.trim().startsWith('{')) {
                const payload = JSON.parse(value);
                await routePayload(payload, 'pasted JSON');
            } else if (isLikelyPath(value) || isBareProjectName(value)) {
                await analyzeFromPath(value);
            } else {
                throw new Error(
                    'Unrecognized input — use a full path (C:\\Projects\\my-app), relative path (ai-platform/data), URL, /api/ endpoint, sample shortcut (issues=sample), or drop a folder'
                );
            }
        } catch (error) {
            console.error('Global data input analysis failed:', error);
            const friendly = formatUserError(error.message);
            setStatus(`❌ ${friendly}`, 'error');
            window.showNotification?.(`❌ ${friendly}`, 'error');
        } finally {
            analyzing = false;
        }
    }

    function preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function setDragActive(active) {
        document.getElementById('global-data-input')?.classList.toggle('drag-active', active);
    }

    async function handleDrop(event) {
        preventDefaults(event);
        event.stopPropagation();
        setDragActive(false);
        if (dropProcessing) return;

        const dt = event.dataTransfer;
        if (!dt) return;

        const dropPayload = captureDropPayload(dt);
        dropProcessing = true;

        try {
            const url = extractUrlFromDrop(dropPayload.urlText);
            const jsonText = dropPayload.urlText?.trim().startsWith('{') ? dropPayload.urlText : null;
            if (jsonText) {
                getAddressInput().value = 'Dropped JSON report';
                await analyzePastedJson(jsonText, 'dropped JSON');
                return;
            }

            if (url) {
                getAddressInput().value = url;
                await analyzeAddressValue(url);
                return;
            }

            const files = await collectFilesFromDropPayload(dropPayload);
            if (files.length) {
                await analyzeFiles(files);
                return;
            }

            window.showNotification?.('Drop a file, folder, or URL to analyze', 'warning');
        } catch (error) {
            console.error('Global data input drop failed:', error);
            const message = isInvalidStateError(error)
                ? 'Folder drop failed — try Browse Folder, or enter the full project path'
                : error.message;
            setStatus(`❌ ${escapeHtml(message)}`, 'error');
            window.showNotification?.(`❌ ${message}`, 'error');
        } finally {
            dropProcessing = false;
        }
    }

    function bindGlobalDataInput() {
        const root = document.getElementById('global-data-input');
        const address = getAddressInput();
        const fileInput = document.getElementById('global-data-file-input');
        const folderInput = document.getElementById('global-data-folder-input');
        const dropzone = document.getElementById('global-data-dropzone');

        if (!root || !address) return;

        document.getElementById('global-data-paste-json')?.addEventListener('click', () => pasteJsonFromClipboard());

        document.getElementById('global-data-analyze')?.addEventListener('click', () => {
            analyzeAddressValue(address.value);
        });

        address.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') analyzeAddressValue(address.value);
        });

        document.getElementById('global-data-back')?.addEventListener('click', () => navigateHistory(-1));
        document.getElementById('global-data-forward')?.addEventListener('click', () => navigateHistory(1));
        document.getElementById('global-data-refresh')?.addEventListener('click', () => analyzeAddressValue(address.value));

        document.getElementById('global-data-browse-files')?.addEventListener('click', () => fileInput?.click());
        document.getElementById('global-data-browse-folder')?.addEventListener('click', () => folderInput?.click());

        fileInput?.addEventListener('change', async (event) => {
            await analyzeFiles([...event.target.files || []]);
            event.target.value = '';
        });

        folderInput?.addEventListener('change', async (event) => {
            const files = [...event.target.files || []];
            const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'selected folder';
            await analyzeFiles(files, folderName);
            event.target.value = '';
        });

        ['dragenter', 'dragover'].forEach((name) => {
            root?.addEventListener(name, (event) => {
                preventDefaults(event);
                setDragActive(true);
            });
            dropzone?.addEventListener(name, (event) => {
                preventDefaults(event);
                setDragActive(true);
            });
        });

        root?.addEventListener('dragleave', (event) => {
            preventDefaults(event);
            if (!root.contains(event.relatedTarget)) setDragActive(false);
        });

        dropzone?.addEventListener('dragleave', (event) => {
            preventDefaults(event);
            setDragActive(false);
        });

        root?.addEventListener('drop', handleDrop, true);

        address?.addEventListener('dragover', (event) => {
            preventDefaults(event);
            setDragActive(true);
        });
        address?.addEventListener('dragleave', (event) => {
            preventDefaults(event);
            setDragActive(false);
        });

        async function handleJsonPaste(event) {
            const text = event.clipboardData?.getData('text/plain') || '';
            if (!text.trim().startsWith('{')) return;
            event.preventDefault();
            if (analyzing) return;
            analyzing = true;
            getAddressInput().value = 'Pasted JSON report';
            setStatus('⏳ Analyzing pasted JSON…', 'loading');
            try {
                await analyzePastedJson(text, 'pasted JSON');
            } catch (error) {
                setStatus(`❌ ${escapeHtml(error.message)}`, 'error');
                window.showNotification?.(`❌ ${error.message}`, 'error');
            } finally {
                analyzing = false;
            }
        }

        address.addEventListener('paste', handleJsonPaste);
        dropzone?.addEventListener('paste', handleJsonPaste);

        address.addEventListener('paste', () => {
            setTimeout(() => {
                const value = address.value.trim();
                if (value && value !== 'Pasted JSON report' && (isLikelyUrl(value) || isApiEndpoint(value))) {
                    analyzeAddressValue(value);
                }
            }, 50);
        });

        document.getElementById('global-input-examples')?.addEventListener('click', (event) => {
            const chip = event.target.closest('.global-input-example-chip');
            if (!chip?.dataset.example) return;
            event.preventDefault();
            const input = getAddressInput();
            if (input) {
                input.value = chip.dataset.example;
                input.focus();
            }
            void analyzeAddressValue(chip.dataset.example);
        });

        setStatus('Ready — try roadmap, issues, or security; or enter a path / paste JSON', 'idle');
    }

    document.addEventListener('DOMContentLoaded', bindGlobalDataInput);
    window.analyzeGlobalDataInput = analyzeAddressValue;
    window.routeGlobalDataPayload = routePayload;
    window.pasteGlobalDataJson = pasteJsonFromClipboard;
})();
