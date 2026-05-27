/**
 * Debt Analytics Page — technical debt analytics and reporting
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/debt-analytics-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isDebtAnalyticsModel(payload) {
        return Boolean(payload && (
            payload.type === 'debt-analytics-model' ||
            (payload.trends?.monthly && payload.overview?.totalDebt != null)
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const categories = raw.trends?.categories || [];
        const severity = raw.trends?.severity || [];
        const totalFromCategories = categories.reduce((sum, cat) => sum + (cat.current ?? 0), 0);
        const totalFromSeverity = severity.reduce((sum, item) => sum + (item.count ?? 0), 0);
        const totalDebt = totalFromCategories || totalFromSeverity || raw.overview?.totalDebt || 0;
        const criticalIssues = severity.find((item) => item.severity === 'Critical')?.count
            ?? raw.overview?.criticalIssues
            ?? 0;

        return {
            ...(raw.overview || {}),
            totalDebt,
            criticalIssues,
            avgResolutionTime: raw.overview?.avgResolutionTime ?? null,
            teamVelocity: raw.overview?.teamVelocity ?? null,
            predictiveAccuracy: raw.overview?.predictiveAccuracy ?? null
        };
    }

    function buildTrends(raw) {
        const trends = raw.trends || {};
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !trends.severity?.length) {
            return trends;
        }

        const total = trends.severity.reduce((sum, item) => sum + (item.count ?? 0), 0);
        const severity = trends.severity.map((item) => ({
            ...item,
            percentage: total ? Math.round(((item.count ?? 0) / total) * 1000) / 10 : 0
        }));

        return { ...trends, severity };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isDebtAnalyticsModel(payload.data) ? payload.data : payload;
        if (!isDebtAnalyticsModel(raw)) return null;
        return {
            type: raw.type || 'debt-analytics-model',
            title: raw.title || 'Debt Analytics',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            trends: buildTrends(raw),
            predictions: raw.predictions || {},
            kpis: raw.kpis || {},
            reports: raw.reports || [],
            insights: raw.insights || [],
            alerts: raw.alerts || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleDebtAnalyticsModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const kpis = model.kpis || {};
        const insights = model.insights || [];
        const alerts = model.alerts || [];
        const predictions = model.predictions || {};

        if (overview.totalDebt === 198
            || overview.criticalIssues === 58
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 95.8
            || model.generatedBy === 'GGUF AI Platform') {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (Number(overview.totalDebt) === 46 || Number(overview.criticalIssues) === 14) return true;
        if (Number(kpis.sampleBaselineCoverage) === 0.30 || Number(kpis.sampleBaselineCoverage) === 0.3) return true;
        if (insights.some((item) =>
            String(item.title || '').includes('500 Jest')
            || String(item.description || '').includes('23 samples remain')
        )) return true;
        if (alerts.some((item) =>
            String(item.title || '').includes('23 samples still use template fiction')
            || String(item.title || '').includes('500-test suite')
        )) return true;
        const nextMonthFactors = predictions.nextMonth?.factors || [];
        if (nextMonthFactors.some((f) =>
            String(f).includes('Finish 6 remaining sample pages')
            || String(f).includes('500-test CI')
        )) return true;

        return false;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchDebtAnalyticsData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.trends?.monthly?.length && !isStaleDebtAnalyticsModel(model)) return model;
            }
        } catch (error) {
            console.warn('Debt analytics sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/debt-analytics');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.trends?.monthly?.length) return model;
            }
        } catch (error) {
            console.warn('Debt analytics API failed:', error.message);
        }
        return null;
    }

    function trendClass(trend) {
        if (trend === 'increasing') return 'negative';
        if (trend === 'decreasing') return 'positive';
        return 'neutral';
    }

    function severityClass(severity) {
        const value = String(severity || '').toLowerCase();
        if (value === 'critical' || value === 'danger') return 'critical';
        if (value === 'high' || value === 'warning') return 'high';
        if (value === 'medium' || value === 'info') return 'medium';
        if (value === 'success') return 'success';
        return 'low';
    }

    function kpiBarClass(value) {
        if (value >= 0.8) return 'good';
        if (value >= 0.6) return 'warning';
        return 'danger';
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '—';
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderTrendsChart(model);
        renderSeverity(model);
        renderCategories(model);
        renderPredictions(model);
        renderKpis(model);
        renderReports(model);
        renderInsights(model);
        renderAlerts(model);
        renderQuickActions(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('debt-analytics-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Technical debt analytics and reporting';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — measured engineering baseline, not live AI telemetry.`
                : base;
        }
        const badge = document.getElementById('debt-analytics-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }
        const updateEl = document.getElementById('debt-analytics-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'da-stat-total': String(o.totalDebt ?? 0),
            'da-stat-critical': String(o.criticalIssues ?? 0),
            'da-stat-resolution': `${o.resolutionRate ?? 0}%`,
            'da-stat-trend': o.monthlyTrend ?? '—',
            'da-stat-time': formatMetric(o.avgResolutionTime),
            'da-stat-velocity': formatMetric(o.teamVelocity),
            'da-stat-accuracy': formatMetric(o.predictiveAccuracy, '%')
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        const criticalBadge = document.getElementById('da-badge-critical');
        if (criticalBadge) {
            criticalBadge.textContent = `⚠ ${o.criticalIssues ?? 0} Critical`;
        }
        const trendBadge = document.getElementById('da-badge-trend');
        if (trendBadge) {
            trendBadge.textContent = `📉 ${o.monthlyTrend ?? '—'} Trend`;
        }
        const predictiveBadge = document.getElementById('da-badge-predictive');
        if (predictiveBadge) {
            predictiveBadge.textContent = model.dataSource === 'repository-audit'
                ? 'Checklist targets'
                : `${o.predictiveAccuracy ?? 0}% Predictive`;
        }
    }

    function renderTrendsChart(model) {
        const canvas = document.getElementById('daTrendsChart');
        const monthly = model.trends?.monthly || [];
        if (!canvas || typeof Chart === 'undefined') return;

        if (trendsChart) {
            trendsChart.destroy();
            trendsChart = null;
        }

        trendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: monthly.map((m) => m.month),
                datasets: [
                    {
                        label: 'Total Debt',
                        data: monthly.map((m) => m.debt),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: 'Resolved',
                        data: monthly.map((m) => m.resolved),
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        tension: 0.35
                    },
                    {
                        label: 'Added',
                        data: monthly.map((m) => m.added),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } }
                }
            }
        });
    }

    function renderSeverity(model) {
        const container = document.getElementById('da-severity-list');
        if (!container) return;

        const items = model.trends?.severity || [];
        if (!items.length) {
            container.innerHTML = '<p class="da-empty">No severity data.</p>';
            return;
        }

        container.innerHTML = items.map((item) => `
            <div class="da-severity-item ${severityClass(item.severity)}">
                <div class="da-severity-header">
                    <span>${escapeHtml(item.severity)}</span>
                    <strong>${item.count ?? 0}</strong>
                </div>
                <div class="da-progress-track"><span style="width:${item.percentage ?? 0}%"></span></div>
                <div class="da-severity-footer">
                    <span>${item.percentage ?? 0}% of total</span>
                    <span class="da-trend ${trendClass(item.trend)}">${escapeHtml(item.trend || 'stable')}</span>
                </div>
            </div>
        `).join('');
    }

    function renderCategories(model) {
        const container = document.getElementById('da-categories-grid');
        if (!container) return;

        const items = model.trends?.categories || [];
        container.innerHTML = items.map((cat) => `
            <div class="da-category-card">
                <div class="da-category-top">
                    <h4>${escapeHtml(cat.category)}</h4>
                    <span class="da-trend ${trendClass(cat.trend)}">${escapeHtml(cat.change || '')}</span>
                </div>
                <div class="da-category-value">${cat.current ?? 0}</div>
                <div class="da-category-label">current debt items</div>
                <span class="da-category-trend-label ${trendClass(cat.trend)}">${escapeHtml(cat.trend || 'stable')}</span>
            </div>
        `).join('') || '<p class="da-empty">No categories.</p>';
    }

    function renderPredictions(model) {
        const container = document.getElementById('da-predictions-grid');
        if (!container) return;

        const preds = model.predictions || {};
        const entries = [
            { key: 'nextMonth', label: 'Next Month' },
            { key: 'nextQuarter', label: 'Next Quarter' },
            { key: 'nextYear', label: 'Next Year' }
        ];
        const targetLabel = model.dataSource === 'repository-audit' ? 'target items' : 'debt items';
        const confidenceLabel = model.dataSource === 'repository-audit' ? 'checklist confidence' : 'confidence';

        container.innerHTML = entries.map(({ key, label }) => {
            const p = preds[key] || {};
            return `
                <div class="da-prediction-card">
                    <h4>${label}</h4>
                    <div class="da-prediction-debt">${p.debt ?? '—'} <span>${targetLabel}</span></div>
                    <div class="da-prediction-confidence">${p.confidence ?? 0}% ${confidenceLabel}</div>
                    <ul class="da-prediction-factors">
                        ${(p.factors || []).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }).join('');
    }

    function renderKpis(model) {
        const container = document.getElementById('da-kpis-grid');
        if (!container) return;

        const kpis = model.kpis || {};
        container.innerHTML = Object.entries(kpis).map(([key, value]) => {
            const pct = Math.round((value <= 1 ? value : value / 10) * 100);
            const display = value <= 1 ? `${Math.round(value * 100)}%` : String(value);
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
            return `
                <div class="da-kpi-item">
                    <div class="da-kpi-header">
                        <span>${escapeHtml(label)}</span>
                        <strong>${display}</strong>
                    </div>
                    <div class="da-progress-track ${kpiBarClass(value <= 1 ? value : value / 10)}"><span style="width:${Math.min(pct, 100)}%"></span></div>
                </div>
            `;
        }).join('');
    }

    function renderReports(model) {
        const tbody = document.getElementById('da-reports-body');
        if (!tbody) return;

        const reports = model.reports || [];
        if (!reports.length) {
            tbody.innerHTML = '<tr><td colspan="5">No reports.</td></tr>';
            return;
        }

        tbody.innerHTML = reports.map((report) => `
            <tr>
                <td><strong>${escapeHtml(report.name)}</strong></td>
                <td>${escapeHtml(report.type || '—')}</td>
                <td>${formatTimeAgo(report.generatedAt)}</td>
                <td>${escapeHtml(report.format || '—')} · ${escapeHtml(report.size || '')}</td>
                <td>${report.insights ?? 0} insights</td>
            </tr>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('da-insights-grid');
        if (!container) return;

        container.innerHTML = (model.insights || []).map((item) => `
            <div class="da-insight-card priority-${severityClass(item.priority)}">
                <div class="da-insight-top">
                    <span>${escapeHtml(item.icon || '💡')}</span>
                    <h4>${escapeHtml(item.title)}</h4>
                </div>
                <p>${escapeHtml(item.description || '')}</p>
                <div class="da-insight-footer">
                    <span>${item.confidence ?? 0}% confidence</span>
                    <span>${escapeHtml(item.impact || '—')}</span>
                </div>
            </div>
        `).join('') || '<p class="da-empty">No insights.</p>';
    }

    function renderAlerts(model) {
        const container = document.getElementById('da-alerts-list');
        if (!container) return;

        container.innerHTML = (model.alerts || []).map((alert) => `
            <div class="da-alert-item ${severityClass(alert.severity)}">
                <span class="da-alert-icon">${escapeHtml(alert.icon || '⚠️')}</span>
                <div class="da-alert-body">
                    <div class="da-alert-header">
                        <strong>${escapeHtml(alert.title)}</strong>
                        <span>${escapeHtml(alert.time || '')}</span>
                    </div>
                    <p>${escapeHtml(alert.description || '')}</p>
                    <div class="da-alert-actions">
                        <button type="button" class="btn btn-outline-primary btn-sm da-alert-investigate" data-alert-id="${escapeHtml(alert.id)}">Investigate</button>
                        <button type="button" class="btn btn-outline-light btn-sm da-alert-dismiss" data-alert-id="${escapeHtml(alert.id)}">Dismiss</button>
                    </div>
                </div>
            </div>
        `).join('') || '<p class="da-empty">No alerts.</p>';
    }

    function renderQuickActions(model) {
        const container = document.getElementById('da-quick-actions');
        if (!container) return;

        container.innerHTML = (model.quickActions || []).map((action) => `
            <button type="button" class="da-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${escapeHtml(action.icon || '⚡')}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('') || '<p class="da-empty">No quick actions.</p>';
    }

    function navigateTo(sectionName) {
        const navLink = document.querySelector(`.nav-link[onclick*="'${sectionName}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, navLink);
        }
    }

    function bindActions() {
        const root = document.getElementById('debt-analytics-root');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        document.getElementById('da-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastDebtAnalyticsModel');
            } catch { /* ignore */ }
            window.__debtAnalyticsModel = null;
            await loadDebtAnalyticsSample();
        });
        document.getElementById('da-load-sample')?.addEventListener('click', loadDebtAnalyticsSample);
        document.getElementById('da-generate-report')?.addEventListener('click', () => {
            window.showNotification?.('📊 Generating debt analytics report…', 'info');
        });

        document.getElementById('da-export-json')?.addEventListener('click', () => {
            if (!window.__debtAnalyticsModel) return;
            const blob = new Blob([JSON.stringify(window.__debtAnalyticsModel, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debt-analytics-model.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('da-import-json')?.addEventListener('click', () => {
            document.getElementById('da-import-file')?.click();
        });

        document.getElementById('da-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyDebtAnalyticsModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Debt analytics data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });

        root.addEventListener('click', (event) => {
            const quickBtn = event.target.closest('.da-quick-action');
            if (quickBtn) {
                const section = quickBtn.dataset.section;
                if (section) {
                    navigateTo(section);
                    return;
                }
                if (quickBtn.dataset.action === 'export') {
                    document.getElementById('da-export-json')?.click();
                } else if (quickBtn.dataset.action === 'generate-report') {
                    document.getElementById('da-generate-report')?.click();
                }
                return;
            }

            if (event.target.closest('.da-alert-investigate')) {
                window.showNotification?.('🔍 Alert investigation started', 'info');
            }
            if (event.target.closest('.da-alert-dismiss')) {
                event.target.closest('.da-alert-item')?.remove();
            }
        });
    }

    function applyDebtAnalyticsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid debt-analytics model', 'error');
            return false;
        }
        if (isStaleDebtAnalyticsModel(model)) {
            window.showNotification?.('❌ Stale debt-analytics fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__debtAnalyticsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'debt-analytics'\"]");
            window.showSection('debt-analytics', navLink);
        }

        try {
            localStorage.setItem('lastDebtAnalyticsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported debt analytics',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedDebtAnalyticsModel() {
        try {
            const raw = localStorage.getItem('lastDebtAnalyticsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.trends?.monthly?.length || isStaleDebtAnalyticsModel(model)) {
                localStorage.removeItem('lastDebtAnalyticsModel');
                return false;
            }
            window.__debtAnalyticsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadDebtAnalyticsSample() {
        const root = document.getElementById('debt-analytics-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyDebtAnalyticsModel(await response.json(), 'debt-analytics-sample.json');
            window.showNotification?.('✅ Loaded debt analytics sample', 'success');
        } catch (error) {
            console.error('Failed to load debt analytics sample:', error);
            window.showNotification?.('❌ Failed to load debt analytics sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeDebtAnalyticsPage(forceRefresh = false) {
        const root = document.getElementById('debt-analytics-root');
        if (!root) return;

        if (window.__debtAnalyticsModel && !forceRefresh) {
            if (isStaleDebtAnalyticsModel(window.__debtAnalyticsModel)) {
                try {
                    localStorage.removeItem('lastDebtAnalyticsModel');
                } catch { /* ignore */ }
                window.__debtAnalyticsModel = null;
            } else {
                renderModel(window.__debtAnalyticsModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchDebtAnalyticsData();
            if (model) {
                window.__debtAnalyticsModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedDebtAnalyticsModel()) {
                return;
            }
            throw new Error('No debt analytics data available');
        } catch (error) {
            console.error('Failed to initialize debt analytics page:', error);
            window.showNotification?.('❌ Failed to load debt analytics data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyDebtAnalyticsModel = applyDebtAnalyticsModel;
    window.loadDebtAnalyticsSample = loadDebtAnalyticsSample;
    window.initializeDebtAnalyticsPage = initializeDebtAnalyticsPage;
})();
