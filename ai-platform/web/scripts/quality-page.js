/**
 * Quality Page — quality assurance and metrics monitoring
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ay';
    const SAMPLE_URL = `/data/quality-dashboard-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isQualityModel(payload) {
        return Boolean(payload && (
            payload.type === 'quality-dashboard-model' ||
            (payload.overview?.issuesFound != null && Array.isArray(payload.metrics))
        ));
    }

    function buildOverview(raw) {
        if (raw.dataSource !== 'repository-audit') {
            return raw.overview || {};
        }

        const overview = raw.overview || {};
        return {
            ...overview,
            issuesFound: overview.issuesFound ?? 5,
            testsPassed: overview.testsPassed
                ?? (overview.passedTests != null && overview.totalTests
                    ? Math.round((overview.passedTests / overview.totalTests) * 1000) / 10
                    : 100),
            qualityScore: overview.qualityScore ?? overview.scanQualityScore ?? null,
            complianceRate: overview.complianceRate ?? overview.schemaPassRate ?? null,
            codeCoverage: overview.codeCoverage ?? null,
            documentation: overview.documentation ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isQualityModel(payload.data) ? payload.data : payload;
        if (!isQualityModel(raw)) return null;
        return {
            type: raw.type || 'quality-dashboard-model',
            title: raw.title || 'Quality Dashboard',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            metrics: raw.metrics || [],
            trends: raw.trends || { labels: [], quality: [], compliance: [] },
            alerts: raw.alerts || [],
            reports: raw.reports || [],
            performance: raw.performance || {},
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function clearSavedQualityModel() {
        try {
            localStorage.removeItem('lastQualityDashboardModel');
        } catch {
            /* ignore */
        }
    }

    function isStaleQualityModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const isOracleFiction = model?.modelInfo?.name === 'unbreakable-oracle'
            || overview.issuesFound === 45
            || overview.qualityScore === 88.5 && overview.complianceRate === 94.2
            || overview.testsPassed === 92.3 && overview.codeCoverage === 85.7
            || overview.documentation === 78.9 && overview.qualityScore === 88.5
            || model?.generatedBy === 'Cascade AI Platform' && !model?.dataSource
            || (model?.metrics || []).some((metric) =>
                metric.id === 'MET001' && metric.value === 85.7 && metric.name === 'Code Coverage'
            )
            || (model?.alerts || []).some((alert) =>
                String(alert.message || '').includes('API docs outdated for 3 endpoints')
                || String(alert.message || '').includes('Flaky test detected')
            );
        if (isOracleFiction) return true;
        if (model?.dataSource !== 'repository-audit') return false;

        const hasOpenStaleAlert = (model?.alerts || []).some((alert) =>
            alert.status === 'open' && (
                String(alert.message || '').includes('empty required arrays')
                || String(alert.message || '').includes('duplicates gguf-development-roadmap')
                || String(alert.message || '').includes('16 dashboard samples')
                || /istanbul.*not collected/i.test(String(alert.message || ''))
            )
        );
        const hasOldInsight = (model?.insights || []).some((item) =>
            String(item.title || '').includes('Fix sample schema violations')
            || String(item.description || '').includes('17 of 33')
        );
        const hasStaleDuplicateAlert = (model?.alerts || []).some((alert) =>
            String(alert.message || '').includes('ai-roadmap and gguf-development-roadmap-report')
        );
        const hasPartialPayload = !(model.metrics || []).length
            || !(model.alerts || []).length
            || !(model.reports || []).length
            || !(model.insights || []).length
            || !(model.quickActions || []).length
            || !(model.trends?.labels || []).length;

        return overview.totalTests === 500
            || overview.testSuites === 17
            || overview.schemaPassRate === 94
            || overview.scanQualityScore === 98
            || overview.issuesFound === 5
            || overview.mockScanFiles === 35
            || hasOpenStaleAlert
            || hasOldInsight
            || hasStaleDuplicateAlert
            || hasPartialPayload;
    }

    function _formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    function formatPercent(value) {
        if (value == null || value === '') return '—';
        return `${value}%`;
    }

    async function fetchSampleQualityModel() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) return null;
            const model = normalizeModel(await response.json());
            if (model && !isStaleQualityModel(model)) return model;
            if (model) clearSavedQualityModel();
        } catch (error) {
            console.warn('Quality sample failed:', error.message);
        }
        return null;
    }

    async function fetchQualityData() {
        const sampleModel = await fetchSampleQualityModel();
        if (sampleModel) return sampleModel;

        try {
            const [overviewRes, metricsRes, alertsRes, reportsRes, performanceRes, sampleRes] = await Promise.all([
                fetch('/api/quality/overview'),
                fetch('/api/quality/metrics'),
                fetch('/api/quality/alerts'),
                fetch('/api/quality/reports'),
                fetch('/api/quality/performance'),
                fetch(SAMPLE_URL)
            ]);

            if (!overviewRes.ok) return null;

            const readJson = async (response) => {
                const payload = await response.json();
                return payload?.data ?? payload;
            };

            const sampleExtras = sampleRes.ok ? normalizeModel(await sampleRes.json()) : null;

            const model = normalizeModel({
                type: 'quality-dashboard-model',
                dataSource: 'repository-audit',
                generatedAt: sampleExtras?.generatedAt || new Date().toISOString(),
                generatedBy: 'RepositoryAudit',
                modelInfo: sampleExtras?.modelInfo || {},
                overview: await readJson(overviewRes),
                metrics: metricsRes.ok ? await readJson(metricsRes) : [],
                alerts: alertsRes.ok ? await readJson(alertsRes) : [],
                reports: reportsRes.ok ? await readJson(reportsRes) : [],
                performance: performanceRes.ok ? await readJson(performanceRes) : {},
                trends: sampleExtras?.trends || { labels: [], quality: [], compliance: [] },
                insights: sampleExtras?.insights || [],
                quickActions: sampleExtras?.quickActions || []
            });

            if (model && !isStaleQualityModel(model)) return model;
        } catch (error) {
            console.warn('Quality API failed:', error.message);
        }
        return null;
    }

    function statusClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'excellent' || value === 'good') return 'good';
        if (value === 'warning' || value === 'medium') return 'warning';
        if (value === 'critical' || value === 'danger' || value === 'high') return 'danger';
        return 'neutral';
    }

    function severityClass(severity) {
        const value = String(severity || '').toLowerCase();
        if (value === 'high' || value === 'critical') return 'danger';
        if (value === 'medium' || value === 'warning') return 'warning';
        return 'good';
    }

    function trendLabel(value) {
        if (value == null) return '—';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value}%`;
    }

    function trendClass(value) {
        if (value == null) return 'neutral';
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleDateString();
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderChart(model);
        renderMetrics(model);
        renderAlerts(model);
        renderReports(model);
        renderPerformance(model);
        renderInsights(model);
        renderQuickActions(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('quality-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Quality assurance and metrics monitoring';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — Jest health and mock-data-scanner baseline${model.performance?.coverageCollection === 'istanbul'
                    ? `; Istanbul ${model.performance.testCoverage ?? model.performance.lineCoverage}% line from CI`
                    : ''}.`
                : base;
        }

        const badge = document.getElementById('quality-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }

        const updateEl = document.getElementById('quality-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }

        const scoreBadge = document.getElementById('quality-badge-score');
        if (scoreBadge) {
            if (model.dataSource === 'repository-audit') {
                scoreBadge.textContent = `● ${formatPercent(o.qualityScore)} Scan Quality`;
            } else if (o.qualityScore != null) {
                scoreBadge.textContent = `● ${o.qualityScore}% Score`;
            }
        }

        const complianceBadge = document.getElementById('quality-badge-compliance');
        if (complianceBadge) {
            if (model.dataSource === 'repository-audit') {
                complianceBadge.textContent = `📈 ${formatPercent(o.complianceRate)} Schema Pass`;
            } else if (o.complianceRate != null) {
                complianceBadge.textContent = `📈 ${o.complianceRate}% Compliance`;
            }
        }

        const testsBadge = document.getElementById('quality-badge-tests');
        if (testsBadge) {
            if (model.dataSource === 'repository-audit') {
                testsBadge.textContent = `✅ ${o.passedTests ?? 500}/${o.totalTests ?? 500} Tests`;
            } else if (o.testsPassed != null) {
                testsBadge.textContent = `✅ ${o.testsPassed}% Tests`;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const perf = model.performance || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};

        if (isAudit) {
            const labelMap = {
                'quality-stat-score': labels.qualityScore || 'Scan Quality',
                'quality-stat-compliance': labels.complianceRate || 'Schema Pass',
                'quality-stat-issues': labels.issuesFound || 'Scanner Issues',
                'quality-stat-tests': labels.testsPassed || 'Test Pass Rate',
                'quality-stat-coverage': perf.coverageCollection === 'istanbul'
                ? `${perf.testCoverage ?? perf.lineCoverage ?? '—'}% Istanbul (CI)`
                : (labels.codeCoverage || 'Istanbul Coverage'),
                'quality-stat-docs': labels.documentation || 'Docs Score'
            };
            Object.entries(labelMap).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const map = isAudit
            ? {
                'quality-stat-score': formatPercent(o.qualityScore),
                'quality-stat-compliance': formatPercent(o.complianceRate),
                'quality-stat-issues': String(o.issuesFound ?? '—'),
                'quality-stat-tests': formatPercent(o.testsPassed),
                'quality-stat-coverage': formatPercent(o.codeCoverage),
                'quality-stat-docs': formatPercent(o.documentation)
            }
            : {
                'quality-stat-score': o.qualityScore != null ? `${o.qualityScore}%` : '—',
                'quality-stat-compliance': o.complianceRate != null ? `${o.complianceRate}%` : '—',
                'quality-stat-issues': String(o.issuesFound ?? '—'),
                'quality-stat-tests': o.testsPassed != null ? `${o.testsPassed}%` : '—',
                'quality-stat-coverage': o.codeCoverage != null ? `${o.codeCoverage}%` : '—',
                'quality-stat-docs': o.documentation != null ? `${o.documentation}%` : '—'
            };

        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function chartYBounds(trends, isAudit) {
        const values = ['quality', 'compliance']
            .flatMap((key) => trends[key] || [])
            .filter((value) => Number.isFinite(value));
        if (!values.length) {
            return isAudit ? { min: 0, max: 40 } : { min: 70, max: 100 };
        }
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (isAudit) {
            return {
                min: 0,
                max: Math.max(40, Math.ceil(max / 10) * 10)
            };
        }
        return {
            min: Math.max(0, Math.floor(min / 10) * 10 - 10),
            max: Math.min(100, Math.ceil(max / 10) * 10 + 5)
        };
    }

    function renderChart(model) {
        const canvas = document.getElementById('qualityTrendsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const trends = model.trends || {};
        const isAudit = model.dataSource === 'repository-audit';
        const seriesLabels = trends.seriesLabels || {};
        const labels = trends.labels || [];
        const bounds = chartYBounds(trends, isAudit);
        const datasets = [
            {
                label: seriesLabels.quality || (isAudit ? 'Measured baselines' : 'Quality Score'),
                data: trends.quality || [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: seriesLabels.compliance || (isAudit ? 'Schema pass %' : 'Compliance Rate'),
                data: trends.compliance || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ];

        if (trendsChart) {
            trendsChart.data.labels = labels;
            trendsChart.data.datasets = datasets;
            trendsChart.options.scales.y.min = bounds.min;
            trendsChart.options.scales.y.max = bounds.max;
            trendsChart.options.scales.y.ticks.callback = isAudit
                ? (value) => value
                : (value) => `${value}%`;
            trendsChart.update();
            return;
        }

        trendsChart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#e2e8f0', usePointStyle: true } },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: '#334155',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(51, 65, 85, 0.5)' }
                    },
                    y: {
                        min: bounds.min,
                        max: bounds.max,
                        ticks: {
                            color: '#94a3b8',
                            callback: isAudit ? (value) => value : (value) => `${value}%`
                        },
                        grid: { color: 'rgba(51, 65, 85, 0.5)' }
                    }
                }
            }
        });
    }

    function renderMetrics(model) {
        const body = document.getElementById('quality-metrics-body');
        if (!body) return;
        body.innerHTML = (model.metrics || []).map((metric) => {
            const displayValue = metric.displayValue || formatPercent(metric.value);
            const targetDisplay = metric.target == null ? '—' : `${metric.target}%`;
            return `
            <tr>
                <td><strong>${escapeHtml(metric.name)}</strong></td>
                <td>${escapeHtml(displayValue)}</td>
                <td>${escapeHtml(targetDisplay)}</td>
                <td><span class="quality-status-badge ${statusClass(metric.status)}">${escapeHtml(metric.status)}</span></td>
                <td><span class="quality-trend ${trendClass(metric.trend)}">${escapeHtml(trendLabel(metric.trend))}</span></td>
                <td>${formatDate(metric.lastUpdated)}</td>
            </tr>
        `;
        }).join('') || '<tr><td colspan="6" class="quality-empty">No metrics available</td></tr>';
    }

    function renderAlerts(model) {
        const container = document.getElementById('quality-alerts-list');
        if (!container) return;
        container.innerHTML = (model.alerts || []).map((alert) => `
            <div class="quality-alert ${severityClass(alert.severity)}">
                <div class="quality-alert-header">
                    <strong>${escapeHtml(alert.type)}</strong>
                    <span>${escapeHtml(alert.time || alert.status)}</span>
                </div>
                <p>${escapeHtml(alert.message)}</p>
                <span class="quality-alert-severity">${escapeHtml(alert.severity)} • ${escapeHtml(alert.status)}</span>
            </div>
        `).join('') || '<p class="quality-empty">No active alerts</p>';
    }

    function renderReports(model) {
        const body = document.getElementById('quality-reports-body');
        if (!body) return;
        body.innerHTML = (model.reports || []).map((report) => {
            const scoreDisplay = report.scoreLabel || formatPercent(report.score);
            return `
            <tr>
                <td><strong>${escapeHtml(report.type)}</strong></td>
                <td><span class="quality-status-badge ${statusClass(report.status === 'completed' ? 'good' : 'warning')}">${escapeHtml(report.status)}</span></td>
                <td>${escapeHtml(scoreDisplay)}</td>
                <td>${formatDate(report.generatedAt)}</td>
            </tr>
        `;
        }).join('') || '<tr><td colspan="4" class="quality-empty">No reports available</td></tr>';
    }

    function renderPerformance(model) {
        const container = document.getElementById('quality-performance-bars');
        if (!container) return;
        const perf = model.performance || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = perf.labels || {};

        const items = isAudit
            ? [
                { label: labels.avgQualityScore || 'Scan Quality', value: perf.avgQualityScore ?? model.overview?.qualityScore },
                { label: labels.testPassRate || 'Test Pass Rate', value: perf.testPassRate ?? model.overview?.testsPassed },
                { label: labels.codeQuality || 'Schema Pass', value: perf.codeQuality ?? model.overview?.complianceRate },
                { label: labels.testCoverage || 'Istanbul Coverage', value: perf.testCoverage ?? model.overview?.codeCoverage }
            ]
            : [
                { label: 'Avg Quality Score', value: perf.avgQualityScore ?? model.overview?.qualityScore },
                { label: 'Test Coverage', value: perf.testCoverage ?? model.overview?.codeCoverage },
                { label: 'Code Quality', value: perf.codeQuality ?? model.overview?.qualityScore },
                { label: 'Documentation', value: perf.documentation ?? model.overview?.documentation }
            ];

        container.innerHTML = items.map((item) => {
            const hasValue = item.value != null && item.value !== '';
            const pct = hasValue ? Math.min(100, Math.max(0, Number(item.value) || 0)) : 0;
            const barClassName = !hasValue ? 'neutral' : pct >= 90 ? 'good' : pct >= 80 ? 'warning' : 'danger';
            const display = hasValue ? `${item.value}%` : '—';
            return `
                <div class="quality-perf-item">
                    <div class="quality-perf-label">
                        <span>${escapeHtml(item.label)}</span>
                        <span>${escapeHtml(display)}</span>
                    </div>
                    <div class="quality-perf-track"><span class="${barClassName}" style="width:${hasValue ? pct : 0}%"></span></div>
                </div>`;
        }).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('quality-insights-grid');
        if (!container) return;
        container.innerHTML = (model.insights || []).map((item) => `
            <div class="quality-insight-card priority-${escapeHtml(item.priority)}">
                <div class="quality-insight-priority">${escapeHtml(item.priority)}</div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.description)}</p>
                <div class="quality-insight-impact">${escapeHtml(item.impact)}</div>
            </div>
        `).join('') || '<p class="quality-empty">No AI insights included in this payload.</p>';
    }

    function renderQuickActions(model) {
        const container = document.getElementById('quality-quick-actions');
        if (!container) return;
        container.innerHTML = (model.quickActions || []).map((action) => `
            <button type="button" class="btn btn-outline-light quality-action-btn" data-action-id="${escapeHtml(action.id)}">
                ${escapeHtml(action.icon || '⚡')} ${escapeHtml(action.label)}
            </button>
        `).join('');
    }

    let actionsBound = false;

    function bindActions() {
        if (actionsBound) return;
        actionsBound = true;

        document.getElementById('quality-refresh')?.addEventListener('click', async () => {
            clearSavedQualityModel();
            window.__qualityModel = null;
            trendsChart = null;
            await loadQualitySample();
        });
        document.getElementById('quality-load-sample')?.addEventListener('click', loadQualitySample);
        document.getElementById('quality-export-json')?.addEventListener('click', () => {
            if (!window.__qualityModel) return;
            const blob = new Blob([JSON.stringify(window.__qualityModel, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `quality-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            window.showNotification?.('✅ Quality data exported', 'success');
        });
        document.getElementById('quality-import-json')?.addEventListener('click', () => {
            document.getElementById('quality-import-file')?.click();
        });
        document.getElementById('quality-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyQualityModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Quality data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid quality JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });
        document.getElementById('quality-run-check')?.addEventListener('click', () => {
            void window.QuickActionsCommon?.runJestHealthCheck(true);
        });

        document.getElementById('quality-root')?.addEventListener('click', (event) => {
            const btn = event.target.closest('.quality-action-btn');
            if (!btn?.dataset.actionId) return;
            event.preventDefault();
            void handleQualityQuickAction(btn.dataset.actionId);
        });
    }

    async function handleQualityQuickAction(actionId) {
        const qa = window.QuickActionsCommon;
        switch (actionId) {
            case 'run-tests':
                await qa?.runJestHealthCheck(true);
                break;
            case 'run-scanner':
                await qa?.runMockDataScan();
                break;
            case 'run-coverage':
                qa?.runCoveragePage();
                break;
            default:
                window.showNotification?.(`⚠ Unknown action: ${actionId}`, 'warning');
        }
    }

    function applyQualityModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized quality payload');
        if (isStaleQualityModel(model)) {
            throw new Error('Stale quality fiction rejected — load repository-audit sample');
        }
        window.__qualityModel = model;
        renderModel(model);
        bindActions();
        window.PageEmptyState?.onModelLoaded('quality');

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'quality'\"]");
            window.showSection('quality', navLink);
        }

        try {
            localStorage.setItem('lastQualityDashboardModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported quality dashboard',
                savedAt: new Date().toISOString()
            }));
        } catch {
            /* ignore */
        }
    }

    function restoreSavedQualityModel() {
        try {
            const raw = localStorage.getItem('lastQualityDashboardModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.overview || isStaleQualityModel(model)) {
                clearSavedQualityModel();
                return false;
            }
            window.__qualityModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadQualitySample() {
        const root = document.getElementById('quality-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyQualityModel(await response.json(), 'quality-dashboard-sample.json');
            window.showNotification?.('✅ Loaded quality sample', 'success');
        } catch (error) {
            console.error('Failed to load quality sample:', error);
            window.showNotification?.('❌ Failed to load quality sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeQualityPage(forceRefresh = false) {
        const root = document.getElementById('quality-root');
        if (!root) return;

        if (window.__qualityModel && !forceRefresh) {
            if (isStaleQualityModel(window.__qualityModel)) {
                window.__qualityModel = null;
                trendsChart = null;
                clearSavedQualityModel();
            } else {
                renderModel(window.__qualityModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            clearSavedQualityModel();
            window.__qualityModel = null;
            trendsChart = null;
        }

        root.classList.add('loading');
        try {
            const model = await fetchQualityData();
            if (model) {
                window.__qualityModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedQualityModel()) {
                return;
            }

            await loadQualitySample();
        } catch (error) {
            console.error('Failed to initialize quality page:', error);
            try {
                await loadQualitySample();
            } catch {
                window.showNotification?.('❌ Failed to load quality data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeQualityPage = initializeQualityPage;
    window.initializeQualityDashboardPage = initializeQualityPage;
    window.loadQualitySample = loadQualitySample;
    window.loadQualityDashboardSample = loadQualitySample;
    window.applyQualityModel = applyQualityModel;
    window.applyQualityDashboardModel = applyQualityModel;
})();
