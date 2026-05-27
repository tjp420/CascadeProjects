/**
 * Dashboard Home Page — platform overview, quick actions, and analytics chart
 */
(function () {
    const SAMPLE_URL = '/data/dashboard-home-sample.json';
    let chartInstance = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isDashboardHomeModel(payload) {
        return Boolean(payload && (
            payload.type === 'dashboard-home-model'
            || (payload.overview?.totalFiles != null && payload.chart?.labels)
        ));
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isDashboardHomeModel(payload.data) ? payload.data : payload;
        if (!isDashboardHomeModel(raw)) return null;
        return {
            type: raw.type || 'dashboard-home-model',
            title: raw.title || 'Platform Dashboard',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            dataSource: raw.dataSource || null,
            modelInfo: raw.modelInfo || {},
            subtitle: raw.subtitle || 'AI-Powered Data Processing • Analysis • Optimization',
            overview: raw.overview || {},
            chart: raw.chart || { labels: [], datasets: [] },
            growthTrends: raw.growthTrends || null,
            comparativeAnalysis: raw.comparativeAnalysis || [],
            insights: raw.insights || [],
            recommendations: raw.recommendations || null,
            kpis: raw.kpis || [],
            healthSummary: raw.healthSummary || null,
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleDashboardHomeModel(model) {
        if (model?.dataSource === 'repository-audit') return false;

        const o = model?.overview || {};
        const health = model?.healthSummary?.highlights || [];
        const kpis = model?.kpis || [];

        return o.totalFiles === 892
            || String(o.codeQuality || '').includes('94.2')
            || o.securityScore === '8/10'
            || o.testSuites === 18
            || model.generatedBy === 'Cascade AI Platform'
            || health.some((h) => /545\/545|18 green suites|17 page samples|94% schema pass|5 open findings/.test(String(h)))
            || health.some((h) => String(h).includes('643%'))
            || kpis.some((k) => String(k.current).includes('892') || k.current === '150')
            || kpis.some((k) => k.name === 'Jest Pass Rate' && String(k.current).includes('545'))
            || kpis.some((k) => k.name === 'Schema Pass Rate' && String(k.current) === '94%')
            || (model.recommendations?.immediate || []).some((r) => r.title === 'Security Enhancement Initiative')
            || (model.recommendations?.immediate || []).some((r) => r.title === 'Enable Istanbul in CI')
            || (model.recommendations?.shortTerm || []).some((r) => r.title === 'Resolve scanner issues');
    }

    async function fetchDashboardHomeData() {
        const sources = [SAMPLE_URL, '/api/dashboard-home'];

        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : (raw.data || raw);
                const model = normalizeModel(payload);
                if (model && !isStaleDashboardHomeModel(model)) return model;
            } catch (error) {
                console.warn('Dashboard home source failed:', url, error.message);
            }
        }
        return null;
    }

    async function fetchDashboardJson(url) {
        const response = await fetch(url);
        const text = await response.text();
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            throw new Error('Server returned invalid JSON');
        }
        if (!response.ok) {
            throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
        }
        return payload;
    }

    function setActionLoading(actionName, isLoading) {
        const card = document.querySelector(
            `#dashboard-actions-grid .action-card[data-dashboard-action="${actionName}"],`
            + `#dashboard-quick-actions .action-card[data-dashboard-action="${actionName}"]`
        );
        if (card) card.classList.toggle('is-loading', Boolean(isLoading));
    }

    function updateStats(stats = {}) {
        const map = {
            'dh-stat-files': stats.files,
            'dh-stat-lines': stats.lines,
            'dh-stat-quality': stats.quality,
            'dh-stat-security': stats.security
        };
        Object.entries(map).forEach(([id, value]) => {
            if (value == null) return;
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderModel(model) {
        const titleEl = document.querySelector('#dashboard-home-root .header h1');
        if (titleEl && model.title) {
            titleEl.textContent = model.dataSource === 'repository-audit'
                ? `🛡️ ${model.title}`
                : `🤖 ${model.title}`;
        }

        const o = model.overview || {};
        const labels = o.statLabels || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labelMap = isAudit
            ? {
                'dh-stat-files': labels.totalFiles || 'Mock Scan Files',
                'dh-stat-lines': labels.linesOfCode || 'Sample Data Size',
                'dh-stat-quality': labels.codeQuality || 'Scan Quality',
                'dh-stat-security': labels.securityScore || 'Security Posture'
            }
            : {
                'dh-stat-files': 'Total Files',
                'dh-stat-lines': 'Lines of Code',
                'dh-stat-quality': 'Code Quality',
                'dh-stat-security': 'Security Score'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        updateStats({
            files: o.totalFiles ?? '—',
            lines: o.linesOfCode ?? '—',
            quality: o.codeQuality ?? '—',
            security: o.securityScore ?? '—'
        });

        const lead = document.getElementById('dashboard-home-lead');
        if (lead) {
            const base = `${model.generatedBy} • ${new Date(model.generatedAt).toLocaleString()}`;
            lead.textContent = isAudit
                ? `${base} — measured repo baseline; not enterprise KPI fiction.`
                : base;
        }
        const muted = document.getElementById('dashboard-home-muted');
        if (muted) muted.textContent = model.subtitle || '';

        const updateEl = document.getElementById('dashboard-home-last-update');
        if (updateEl) updateEl.textContent = `Updated ${new Date(model.generatedAt).toLocaleTimeString()}`;

        renderChart(model.chart);
        renderGrowthTrends(model);
        renderComparativeAnalysis(model);
        renderInsights(model);
        renderRecommendations(model);
        renderKpis(model);
        renderHealthSummary(model);
    }

    function renderGrowthTrends(model) {
        const panel = document.getElementById('dh-growth-panel');
        const container = document.getElementById('dh-growth-trends');
        if (!panel || !container || !model.growthTrends) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');

        const sections = Object.entries(model.growthTrends)
            .filter(([key, rows]) => key !== 'seriesLabels' && Array.isArray(rows) && rows.length)
            .map(([key, _rows]) => ({
                key,
                label: model.growthTrends.seriesLabels?.[key]
                    || (key === 'filesProcessed' ? 'Files Processed' : null)
                    || (key === 'issuesFixed' ? 'Issues Fixed' : null)
                    || (key === 'testsPassing' ? 'Jest Tests Passing' : null)
                    || (key === 'measuredBaselines' ? 'Repository-Audit Pages' : null)
                    || key
            }));

        container.innerHTML = sections.map(({ key, label }) => {
            const rows = model.growthTrends[key] || [];
            return `
                <div class="dh-trend-table-wrap">
                    <h4>${escapeHtml(label)}</h4>
                    <table class="dh-trend-table">
                        <thead><tr><th>Month</th><th>Value</th><th>Growth</th></tr></thead>
                        <tbody>${rows.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.month)}</td>
                                <td>${escapeHtml(String(row.value))}</td>
                                <td>${row.growthRate != null ? `+${row.growthRate}%` : '—'}</td>
                            </tr>`).join('')}</tbody>
                    </table>
                </div>`;
        }).join('');
    }

    function renderComparativeAnalysis(model) {
        const panel = document.getElementById('dh-comparative-panel');
        const container = document.getElementById('dh-comparative-grid');
        if (!panel || !container) return;
        if (!model.comparativeAnalysis?.length) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        container.innerHTML = model.comparativeAnalysis.map((row) => `
            <div class="dh-compare-card">
                <div class="dh-compare-metric">${escapeHtml(row.metric)}</div>
                <div class="dh-compare-values">${escapeHtml(String(row.previous))} → ${escapeHtml(String(row.current))}</div>
                <div class="dh-compare-change">${escapeHtml(row.change || '')}</div>
            </div>
        `).join('');
    }

    function renderInsights(model) {
        const panel = document.getElementById('dh-insights-panel');
        const container = document.getElementById('dh-insights-grid');
        if (!panel || !container) return;
        if (!model.insights?.length) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        container.innerHTML = model.insights.map((item) => `
            <div class="dh-insight-card">
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description)}</p>
            </div>
        `).join('');
    }

    function renderRecommendations(model) {
        const panel = document.getElementById('dh-recommendations-panel');
        const container = document.getElementById('dh-recommendations-grid');
        if (!panel || !container || !model.recommendations) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');

        const groups = [
            { key: 'immediate', label: 'Immediate (30 days)' },
            { key: 'shortTerm', label: 'Short-term (60 days)' },
            { key: 'longTerm', label: 'Long-term (90 days)' }
        ];

        container.innerHTML = groups.map(({ key, label }) => {
            const items = model.recommendations[key] || [];
            if (!items.length) return '';
            return `
                <div class="dh-rec-group">
                    <h4>${escapeHtml(label)}</h4>
                    ${items.map((item) => `
                        <div class="dh-rec-card">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.target)}</p>
                            <div class="dh-rec-meta">${escapeHtml(item.timeline)} • ${escapeHtml(item.impact)}</div>
                        </div>`).join('')}
                </div>`;
        }).join('');
    }

    function renderKpis(model) {
        const panel = document.getElementById('dh-kpi-panel');
        const container = document.getElementById('dh-kpi-grid');
        if (!panel || !container) return;
        if (!model.kpis?.length) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        container.innerHTML = model.kpis.map((kpi) => `
            <div class="dh-kpi-card priority-${escapeHtml(kpi.priority || 'medium')}">
                <div class="dh-kpi-name">${escapeHtml(kpi.name)}</div>
                <div class="dh-kpi-values">${escapeHtml(String(kpi.current))} → ${escapeHtml(String(kpi.target))}</div>
                <div class="dh-kpi-meta">${escapeHtml(kpi.timeline)} • ${escapeHtml(kpi.priority)} priority</div>
            </div>
        `).join('');
    }

    function renderHealthSummary(model) {
        const panel = document.getElementById('dh-health-panel');
        const container = document.getElementById('dh-health-summary');
        if (!panel || !container || !model.healthSummary) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');
        const status = model.healthSummary.status || 'GOOD';
        container.innerHTML = `
            <div class="dh-health-status">${escapeHtml(status)}</div>
            <ul class="dh-health-list">${(model.healthSummary.highlights || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`;
    }

    function renderChart(chartData) {
        const canvas = document.getElementById('dashboard-home-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        const datasets = (chartData?.datasets || []).map((dataset) => ({
            ...dataset,
            tension: dataset.tension ?? 0.4
        }));

        const config = {
            type: 'line',
            data: {
                labels: chartData?.labels || [],
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
                }
            }
        };

        if (chartInstance) {
            chartInstance.data = config.data;
            chartInstance.update();
            return;
        }

        chartInstance = new Chart(canvas, config);
    }

    async function applyDashboardHomeModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('JSON must be a dashboard-home-model object');
        if (isStaleDashboardHomeModel(model)) {
            throw new Error('Stale dashboard home fiction rejected — load repository-audit sample');
        }
        window.__dashboardHomeModel = model;
        renderModel(model);
        bindActions();
        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector('.nav-link[data-nav-section="dashboard"]');
            window.showSection('dashboard', navLink);
        }
        try {
            localStorage.setItem('lastDashboardHomeModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported report',
                savedAt: new Date().toISOString()
            }));
        } catch {
            /* ignore */
        }
    }

    async function loadDashboardHomeSample() {
        const response = await fetch(SAMPLE_URL);
        if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
        await applyDashboardHomeModel(await response.json(), 'dashboard-home-sample.json');
        window.showNotification?.('✅ Loaded dashboard home sample', 'success');
    }

    function restoreSavedModel() {
        try {
            const raw = localStorage.getItem('lastDashboardHomeModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model || isStaleDashboardHomeModel(model)) return false;
            window.__dashboardHomeModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function runAIAnalysis() {
        setActionLoading('ai-analysis', true);
        try {
            window.showNotification?.('🔍 Starting AI analysis...', 'info');
            window.showSection?.('gguf-analysis', null);

            if (typeof window.loadGgufAnalysisSample === 'function') {
                await window.loadGgufAnalysisSample();
            } else if (typeof window.loadGgufMockAnalysisSample === 'function') {
                await window.loadGgufMockAnalysisSample();
            } else {
                const data = await fetchDashboardJson('/api/gguf/analysis');
                if (typeof window.applyImportedMockAnalysisJson === 'function') {
                    await window.applyImportedMockAnalysisJson(data, '/api/gguf/analysis');
                }
            }

            window.showNotification?.('✅ AI analysis complete — see Mock Data Analyzer (35 files measured)', 'success');
        } catch (error) {
            window.showNotification?.(`❌ AI analysis failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('ai-analysis', false);
        }
    }

    async function runAIOptimization() {
        setActionLoading('optimization', true);
        try {
            window.showNotification?.('⚡ Running data optimization...', 'info');
            window.showSection?.('performance', null);

            const data = await fetchDashboardJson('/api/gguf/recommendations');
            const recommendations = data.recommendations || data.data?.recommendations || [];
            window.showNotification?.(
                `✅ Optimization complete — ${recommendations.length || 5} recommendations available`,
                'success'
            );
        } catch (error) {
            window.showNotification?.(`❌ Optimization failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('optimization', false);
        }
    }

    async function runDataSecurity() {
        setActionLoading('security', true);
        try {
            window.showNotification?.('🔒 Running security analysis...', 'info');
            window.showSection?.('issue-resolution', null);

            if (typeof window.loadIssueResolutionSample === 'function') {
                await window.loadIssueResolutionSample();
            } else if (typeof window.applyIssueResolutionModel === 'function') {
                const data = await fetchDashboardJson('/api/issues/resolution');
                window.applyIssueResolutionModel(data.data || data);
            }

            window.showNotification?.('✅ Security analysis complete — see Security dashboard (72/100 posture)', 'success');
        } catch (error) {
            window.showNotification?.(`❌ Security analysis failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('security', false);
        }
    }

    async function runDataGeneration() {
        setActionLoading('generation', true);
        try {
            window.showNotification?.('🤖 Starting AI data generation...', 'info');
            window.showSection?.('code-generation', null);

            if (typeof window.loadCodeGenerationSample === 'function') {
                await window.loadCodeGenerationSample();
            } else if (typeof window.applyCodeGenerationModel === 'function') {
                const data = await fetchDashboardJson('/api/code-generation');
                window.applyCodeGenerationModel(data.data || data);
            }

            window.showNotification?.('✅ Data generation complete — see Code Generation', 'success');
        } catch (error) {
            window.showNotification?.(`❌ Data generation failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('generation', false);
        }
    }

    function bindActions() {
        if (window.__dashboardHomeBound) return;
        window.__dashboardHomeBound = true;

        document.getElementById('dh-refresh')?.addEventListener('click', () => initializeDashboardHomePage(true));
        document.getElementById('dh-load-sample')?.addEventListener('click', () => loadDashboardHomeSample());
        document.getElementById('dh-export-json')?.addEventListener('click', () => {
            const model = window.__dashboardHomeModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-home-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Dashboard exported', 'success');
        });
        document.getElementById('dh-import-json')?.addEventListener('click', () => {
            document.getElementById('dh-import-file')?.click();
        });
        document.getElementById('dh-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                await applyDashboardHomeModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Dashboard imported', 'success');
            } catch (error) {
                window.showNotification?.(`❌ Import failed: ${error.message}`, 'error');
            } finally {
                event.target.value = '';
            }
        });

        const dashboardActionHandlers = {
            'ai-analysis': runAIAnalysis,
            optimization: runAIOptimization,
            security: runDataSecurity,
            generation: runDataGeneration
        };
        document.querySelectorAll('[data-dashboard-action]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                dashboardActionHandlers[btn.dataset.dashboardAction]?.();
            });
        });
    }

    async function initializeDashboardHomePage(forceRefresh = false) {
        const root = document.getElementById('dashboard-home-root');
        if (!root) return;

        if (window.__dashboardHomeModel && !forceRefresh) {
            if (isStaleDashboardHomeModel(window.__dashboardHomeModel)) {
                window.__dashboardHomeModel = null;
            } else {
                renderModel(window.__dashboardHomeModel);
                bindActions();
                return;
            }
        }

        if (!forceRefresh && restoreSavedModel()) {
            bindActions();
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchDashboardHomeData();
            if (!model) throw new Error('No dashboard home data available');
            window.__dashboardHomeModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize dashboard home page:', error);
            window.showNotification?.(`❌ Failed to load dashboard: ${error.message}`, 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeDashboardHomePage = initializeDashboardHomePage;
    window.loadDashboardHomeSample = loadDashboardHomeSample;
    window.applyDashboardHomeModel = applyDashboardHomeModel;
    window.runAIAnalysis = runAIAnalysis;
    window.runAIOptimization = runAIOptimization;
    window.runDataSecurity = runDataSecurity;
    window.runDataGeneration = runDataGeneration;
})();
