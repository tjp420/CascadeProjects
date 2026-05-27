/**
 * Coverage Reports Page — code coverage analysis and reporting
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ai';
    const SAMPLE_URL = `/data/coverage-reports-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isCoverageReportsModel(payload) {
        return Boolean(payload && (
            payload.type === 'coverage-reports-model' ||
            (payload.overview?.overallCoverage != null && Array.isArray(payload.projects) && payload.projects.some((p) => p.coverage != null))
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const projects = raw.projects || [];
        const totalTests = raw.overview?.totalTests
            ?? projects.reduce((sum, proj) => sum + (proj.tests ?? 0), 0);
        const passedTests = raw.overview?.passedTests
            ?? projects.reduce((sum, proj) => sum + (proj.passed ?? 0), 0);
        const failedTests = raw.overview?.failedTests ?? Math.max(0, totalTests - passedTests);
        const testPassRate = totalTests
            ? Math.round((passedTests / totalTests) * 1000) / 10
            : raw.overview?.testPassRate ?? null;

        return {
            ...(raw.overview || {}),
            totalTests,
            passedTests,
            failedTests,
            testPassRate,
            overallCoverage: raw.overview?.overallCoverage ?? null,
            lineCoverage: raw.overview?.lineCoverage ?? null,
            branchCoverage: raw.overview?.branchCoverage ?? null,
            functionCoverage: raw.overview?.functionCoverage ?? null,
            statementCoverage: raw.overview?.statementCoverage ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isCoverageReportsModel(payload.data) ? payload.data : payload;
        if (!isCoverageReportsModel(raw)) return null;
        return {
            type: raw.type || 'coverage-reports-model',
            title: raw.title || 'Code Coverage Reports',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            projects: raw.projects || [],
            coverageTrends: raw.coverageTrends || raw.trends || [],
            uncoveredFiles: raw.uncoveredFiles || [],
            recommendations: raw.recommendations || [],
            recentRuns: raw.recentRuns || [],
            coverageGoals: raw.coverageGoals || [],
            analytics: raw.analytics || {},
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleCoverageReportsModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const goals = model.coverageGoals || [];
        const runs = model.recentRuns || [];
        const recs = model.recommendations || [];
        const projects = model.projects || [];

        if (overview.totalTests === 1234
            || overview.passedTests === 1156
            || overview.failedTests === 78
            || Math.abs((overview.overallCoverage ?? 0) - 73.4) < 0.01
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 96.8
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (overview.totalTests === 500 || overview.passedTests === 500) return true;
        if (overview.totalTests === 545 && overview.coverageCollection !== 'istanbul') return false;
        if (overview.testSuites === 17) return true;
        if (goals.some((goal) => goal.name === 'Tests Passing' && goal.target === 500)) return true;
        if (goals.some((goal) => goal.name === 'Test Suites Green' && goal.target === 17)) return true;
        if (runs.some((run) => String(run.description || '').includes('500/500'))) return true;
        if (recs.some((rec) => String(rec.title || '').includes('500-test'))) return true;
        if (projects.find((proj) => proj.id === 'proj_page_samples')?.tests === 226) return true;
        if (projects.find((proj) => proj.id === 'proj_e2e')?.tests === 150) return true;

        return false;
    }

    function _formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    function formatCoverage(value) {
        if (value == null || value === '') return '—';
        return `${value}%`;
    }

    async function fetchCoverageReportsData() {
        const sources = [
            SAMPLE_URL,
            '/api/coverage-reports'
        ];

        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : (raw.data || raw);
                const model = normalizeModel(payload);
                if (model?.projects?.length && !isStaleCoverageReportsModel(model)) {
                    return model;
                }
            } catch (error) {
                console.warn('Coverage reports source failed:', url, error.message);
            }
        }
        return null;
    }

    function coverageColorClass(value) {
        if (value >= 80) return 'success';
        if (value >= 70) return 'warning';
        return 'danger';
    }

    function statusBadgeClass(status) {
        const map = { healthy: 'success', warning: 'warning', critical: 'danger' };
        return map[String(status || '').toLowerCase()] || 'info';
    }

    function trendIcon(trend) {
        if (trend === 'improving') return '↑';
        if (trend === 'declining') return '↓';
        return '→';
    }

    function recTypeClass(type) {
        const map = { critical: 'danger', warning: 'warning', info: 'info' };
        return map[String(type || '').toLowerCase()] || 'info';
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleString();
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderMetrics(model);
        renderTestSummary(model);
        renderProjectsTable(model);
        renderTrendsChart(model);
        renderTrendsSummary(model);
        renderGoals(model);
        renderUncoveredFiles(model);
        renderRecommendations(model);
        renderRecentRuns(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('coverage-reports-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Code coverage analysis and reporting';
            lead.textContent = model.overview?.coverageCollection === 'istanbul'
                ? `${base} — Istanbul from coverage/dashboard/coverage-summary.json (CI artifact).`
                : model.dataSource === 'repository-audit'
                ? `${base} — Jest test health baseline; run npm run test:coverage for Istanbul.`
                : base;
        }
        const badge = document.getElementById('coverage-reports-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }
        const updateEl = document.getElementById('coverage-reports-last-update');
        if (updateEl) {
            updateEl.textContent = `Last run ${formatDate(o.lastRun)}`;
        }
        const badges = document.getElementById('cr-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-success me-2">✅ ${o.passedTests ?? 0}/${o.totalTests ?? 0} Passed</span>
                    <span class="badge bg-primary me-2">🧪 ${o.testSuites ?? model.projects?.length ?? 0} Suites</span>
                    <span class="badge bg-info me-2">📊 ${model.projects?.length ?? 0} Test areas</span>
                    <span class="badge bg-secondary">${o.failedTests ?? 0} Failed</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">🛡️ ${o.overallCoverage ?? 0}% Overall</span>
                    <span class="badge bg-success me-2">✅ ${o.passedTests ?? 0}/${o.totalTests ?? 0} Passed</span>
                    <span class="badge bg-warning me-2">📊 ${model.projects?.length ?? 0} Projects</span>
                    <span class="badge bg-info">${o.failedTests ?? 0} Failed</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labelMap = isAudit
            ? {
                'cr-stat-overall': 'Test Pass Rate',
                'cr-stat-line': 'Line (Istanbul)',
                'cr-stat-branch': 'Branch (Istanbul)',
                'cr-stat-tests': 'Tests Passed'
            }
            : {
                'cr-stat-overall': 'Overall Coverage',
                'cr-stat-line': 'Line Coverage',
                'cr-stat-branch': 'Branch Coverage',
                'cr-stat-tests': 'Tests Passed'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        const map = isAudit
            ? {
                'cr-stat-overall': `${o.testPassRate ?? 100}%`,
                'cr-stat-line': formatCoverage(o.lineCoverage),
                'cr-stat-branch': formatCoverage(o.branchCoverage),
                'cr-stat-tests': `${o.passedTests ?? 0}/${o.totalTests ?? 0}`
            }
            : {
                'cr-stat-overall': `${o.overallCoverage ?? 0}%`,
                'cr-stat-line': `${o.lineCoverage ?? 0}%`,
                'cr-stat-branch': `${o.branchCoverage ?? 0}%`,
                'cr-stat-tests': `${o.passedTests ?? 0}/${o.totalTests ?? 0}`
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderMetrics(model) {
        const o = model.overview || {};
        const metrics = [
            { label: 'Statement Coverage', value: o.statementCoverage, color: 'primary' },
            { label: 'Line Coverage', value: o.lineCoverage, color: 'success' },
            { label: 'Branch Coverage', value: o.branchCoverage, color: 'warning' },
            { label: 'Function Coverage', value: o.functionCoverage, color: 'info' }
        ];
        const container = document.getElementById('cr-metrics-bars');
        if (!container) return;
        container.innerHTML = metrics.map((m) => {
            const display = formatCoverage(m.value);
            const width = m.value == null ? 0 : m.value;
            return `
            <div class="cr-metric-row">
                <div class="cr-metric-label">
                    <span>${escapeHtml(m.label)}</span>
                    <span class="badge bg-${m.color}">${display}</span>
                </div>
                <div class="da-progress-track"><span style="width:${width}%"></span></div>
            </div>
        `;
        }).join('');
    }

    function renderTestSummary(model) {
        const o = model.overview || {};
        const total = o.totalTests || 1;
        const container = document.getElementById('cr-test-summary');
        if (!container) return;
        container.innerHTML = `
            <div class="cr-test-row">
                <span>Passed</span>
                <span class="badge bg-success">${o.passedTests ?? 0}</span>
            </div>
            <div class="da-progress-track good"><span style="width:${((o.passedTests ?? 0) / total) * 100}%"></span></div>
            <div class="cr-test-row">
                <span>Failed</span>
                <span class="badge bg-danger">${o.failedTests ?? 0}</span>
            </div>
            <div class="da-progress-track danger"><span style="width:${((o.failedTests ?? 0) / total) * 100}%"></span></div>
            <div class="cr-test-row">
                <span>Skipped</span>
                <span class="badge bg-warning">${o.skippedTests ?? 0}</span>
            </div>
            <div class="cr-subtext">Last run: ${formatDate(o.lastRun)}</div>
        `;
    }

    function renderProjectsTable(model) {
        const tbody = document.getElementById('cr-projects-body');
        if (!tbody) return;
        tbody.innerHTML = (model.projects || []).map((proj) => `
            <tr>
                <td>
                    <strong>${escapeHtml(proj.name)}</strong>
                    <div class="cr-subtext">Last run: ${formatDate(proj.lastRun)}</div>
                </td>
                <td>${proj.coverage == null
                    ? '<span class="badge bg-secondary">—</span>'
                    : `<span class="badge bg-${coverageColorClass(proj.coverage)}">${proj.coverage}%</span>`}</td>
                <td>${formatCoverage(proj.lineCoverage)}</td>
                <td>${formatCoverage(proj.branchCoverage)}</td>
                <td>${formatCoverage(proj.functionCoverage)}</td>
                <td>${proj.passed ?? 0}/${proj.tests ?? 0}</td>
                <td><span class="badge bg-${statusBadgeClass(proj.status)}">${escapeHtml(proj.status)}</span></td>
                <td>${trendIcon(proj.trend)}</td>
            </tr>
        `).join('');
    }

    function renderTrendsChart(model) {
        const canvas = document.getElementById('crTrendsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const trends = model.coverageTrends || [];
        const useTestCounts = model.dataSource === 'repository-audit'
            || trends.every((t) => t.line == null && t.branch == null);
        if (trendsChart) {
            trendsChart.destroy();
            trendsChart = null;
        }

        const datasets = useTestCounts
            ? [{
                label: 'Tests passing',
                data: trends.map((t) => t.overall),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                fill: true,
                tension: 0.35
            }]
            : [
                {
                    label: 'Overall',
                    data: trends.map((t) => t.overall),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: false,
                    tension: 0.35
                },
                {
                    label: 'Line',
                    data: trends.map((t) => t.line),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    fill: false,
                    tension: 0.35
                },
                {
                    label: 'Branch',
                    data: trends.map((t) => t.branch),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    fill: false,
                    tension: 0.35
                },
                {
                    label: 'Function',
                    data: trends.map((t) => t.function),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    fill: false,
                    tension: 0.35
                }
            ];

        trendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: trends.map((t) => t.week),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: {
                        beginAtZero: !useTestCounts,
                        min: useTestCounts ? undefined : 60,
                        max: useTestCounts ? undefined : 100,
                        ticks: {
                            color: '#94a3b8',
                            callback: useTestCounts ? undefined : (v) => `${v}%`
                        },
                        grid: { color: 'rgba(255,255,255,0.06)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    }
                }
            }
        });
    }

    function renderTrendsSummary(model) {
        const s = model.analytics?.summary || {};
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const map = isAudit
            ? {
                'cr-trend-current': `${o.totalTests ?? 0} tests`,
                'cr-trend-improvement': s.sixWeekImprovementLabel || `+${s.sixWeekImprovement ?? 0} tests`,
                'cr-trend-line': formatCoverage(s.lineCoverage ?? o.lineCoverage),
                'cr-trend-branch': formatCoverage(s.branchCoverage ?? o.branchCoverage)
            }
            : {
                'cr-trend-current': `${s.currentCoverage ?? o.overallCoverage ?? 0}%`,
                'cr-trend-improvement': `+${s.sixWeekImprovement ?? 5.2}%`,
                'cr-trend-line': `${s.lineCoverage ?? o.lineCoverage ?? 0}%`,
                'cr-trend-branch': `${s.branchCoverage ?? o.branchCoverage ?? 0}%`
            };
        const trendLabels = isAudit
            ? {
                'cr-trend-current': 'Tests Passing',
                'cr-trend-improvement': '6-Week Growth',
                'cr-trend-line': 'Line (Istanbul)',
                'cr-trend-branch': 'Branch (Istanbul)'
            }
            : {
                'cr-trend-current': 'Current Coverage',
                'cr-trend-improvement': '6-Week Improvement',
                'cr-trend-line': 'Line Coverage',
                'cr-trend-branch': 'Branch Coverage'
            };

        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
        Object.entries(trendLabels).forEach(([id, label]) => {
            const span = document.getElementById(id)?.nextElementSibling;
            if (span) span.textContent = label;
        });
    }

    function renderGoals(model) {
        const container = document.getElementById('cr-goals-list');
        if (!container) return;
        container.innerHTML = (model.coverageGoals || []).map((goal) => {
            const unit = goal.unit || 'percent';
            const currentDisplay = goal.current == null
                ? '—'
                : (unit === 'percent' ? `${goal.current}%` : String(goal.current));
            const targetDisplay = unit === 'percent' ? `${goal.target}%` : String(goal.target);
            const pct = goal.current == null || !goal.target
                ? 0
                : Math.min(100, (goal.current / goal.target) * 100);
            const statusClass = goal.status === 'met'
                ? 'success'
                : (goal.status === 'not-collected' || goal.status === 'pending' ? 'secondary' : 'warning');
            return `
                <div class="cr-goal-item">
                    <div class="cr-goal-header">
                        <span>${escapeHtml(goal.name)}</span>
                        <span class="badge bg-${statusClass}">${currentDisplay} / ${targetDisplay}</span>
                    </div>
                    <div class="da-progress-track"><span style="width:${pct}%"></span></div>
                </div>
            `;
        }).join('');
    }

    function renderUncoveredFiles(model) {
        const tbody = document.getElementById('cr-uncovered-body');
        if (!tbody) return;
        tbody.innerHTML = (model.uncoveredFiles || []).map((file) => `
            <tr>
                <td>
                    <strong>${escapeHtml(file.name)}</strong>
                    <div class="cr-subtext">${escapeHtml(file.path)}</div>
                    ${file.notes ? `<div class="cr-subtext">${escapeHtml(file.notes)}</div>` : ''}
                </td>
                <td>${file.coverage == null
                    ? '<span class="badge bg-secondary">—</span>'
                    : `<span class="badge bg-${coverageColorClass(file.coverage)}">${file.coverage}%</span>`}</td>
                <td>${file.uncoveredLines == null ? '—' : `${file.uncoveredLines}/${file.totalLines ?? '—'}`}</td>
                <td><span class="badge bg-${recTypeClass(file.risk === 'high' ? 'critical' : file.risk === 'medium' ? 'warning' : 'info')}">${escapeHtml(file.risk)}</span></td>
                <td>${formatDate(file.lastModified)}</td>
            </tr>
        `).join('');
    }

    function renderRecommendations(model) {
        const container = document.getElementById('cr-recommendations-list');
        if (!container) return;
        container.innerHTML = (model.recommendations || []).map((rec) => `
            <div class="cr-rec-card ${recTypeClass(rec.type)}">
                <div class="cr-rec-header">
                    <strong>${escapeHtml(rec.title)}</strong>
                    <span class="badge bg-${recTypeClass(rec.type)}">${escapeHtml(rec.impact)} impact</span>
                </div>
                <p>${escapeHtml(rec.description)}</p>
                <div class="cr-subtext">Effort: ${escapeHtml(rec.effort)} • ${rec.files ?? 0} files</div>
            </div>
        `).join('');
    }

    function renderRecentRuns(model) {
        const container = document.getElementById('cr-recent-runs');
        if (!container) return;
        container.innerHTML = (model.recentRuns || []).map((run) => `
            <div class="cr-run-item">
                <div class="cr-run-icon">${run.icon || '🧪'}</div>
                <div class="cr-run-body">
                    <div class="cr-run-header">
                        <strong>${escapeHtml(run.project)}</strong>
                        <small>${escapeHtml(run.time)}</small>
                    </div>
                    <p>${escapeHtml(run.description)}</p>
                    <span class="badge bg-${run.color || 'info'}">${run.coverage == null ? `${run.tests ?? 0} tests` : `${run.coverage}% • ${run.tests ?? 0} tests`}</span>
                </div>
            </div>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('coverage-reports-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('cr-load-sample')?.addEventListener('click', () => loadCoverageReportsSample());
        document.getElementById('cr-import-json')?.addEventListener('click', () => {
            document.getElementById('cr-import-file')?.click();
        });
        document.getElementById('cr-export-json')?.addEventListener('click', () => {
            const model = window.__coverageReportsModel;
            if (!model) {
                window.showNotification?.('❌ No coverage data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coverage-reports-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Coverage report exported', 'success');
        });
        document.getElementById('cr-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyCoverageReportsModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('cr-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastCoverageReportsModel');
            } catch { /* ignore */ }
            window.__coverageReportsModel = null;
            await loadCoverageReportsSample();
        });
    }

    function applyCoverageReportsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid coverage-reports model', 'error');
            return false;
        }
        if (isStaleCoverageReportsModel(model)) {
            window.showNotification?.('❌ Stale coverage fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__coverageReportsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'coverage-reports'\"]");
            window.showSection('coverage-reports', navLink);
        }

        try {
            localStorage.setItem('lastCoverageReportsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported coverage report',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedCoverageReportsModel() {
        try {
            const raw = localStorage.getItem('lastCoverageReportsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.projects?.length || isStaleCoverageReportsModel(model)) {
                localStorage.removeItem('lastCoverageReportsModel');
                return false;
            }
            window.__coverageReportsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadCoverageReportsSample() {
        const root = document.getElementById('coverage-reports-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyCoverageReportsModel(await response.json(), 'coverage-reports-sample.json');
            window.showNotification?.('✅ Loaded coverage reports sample', 'success');
        } catch (error) {
            console.error('Failed to load coverage reports sample:', error);
            window.showNotification?.('❌ Failed to load coverage reports sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeCoverageReportsPage(forceRefresh = false) {
        const root = document.getElementById('coverage-reports-root');
        if (!root) return;

        if (window.__coverageReportsModel && !forceRefresh) {
            if (isStaleCoverageReportsModel(window.__coverageReportsModel)) {
                window.__coverageReportsModel = null;
                try { localStorage.removeItem('lastCoverageReportsModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__coverageReportsModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchCoverageReportsData();
            if (model) {
                window.__coverageReportsModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedCoverageReportsModel()) {
                return;
            }
            await loadCoverageReportsSample();
        } catch (error) {
            console.error('Failed to initialize coverage reports page:', error);
            try {
                await loadCoverageReportsSample();
            } catch {
                window.showNotification?.('❌ Failed to load coverage reports data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyCoverageReportsModel = applyCoverageReportsModel;
    window.loadCoverageReportsSample = loadCoverageReportsSample;
    window.initializeCoverageReportsPage = initializeCoverageReportsPage;
})();
