/**
 * Debt Reduction Page — technical debt reduction strategies and remediation tracking
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524debt';
    const SAMPLE_URL = `/data/debt-reduction-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let filterStatus = 'all';
    let searchQuery = '';
    let progressChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isDebtReductionModel(payload) {
        return Boolean(payload && (
            payload.type === 'debt-reduction-model' ||
            (Array.isArray(payload.strategies) && payload.overview?.debtReduction != null)
        ));
    }

    function buildOverview(raw) {
        const strategies = raw.strategies || [];
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !strategies.length) {
            return raw.overview || {};
        }

        const totalTasks = strategies.reduce((sum, s) => sum + (s.totalTasks ?? 0), 0);
        const completedTasks = strategies.reduce((sum, s) => sum + (s.completedTasks ?? 0), 0);
        const overallProgress = totalTasks
            ? Math.round((completedTasks / totalTasks) * 100)
            : (raw.overview?.overallProgress ?? 0);
        const activeStrategies = strategies.filter((s) => {
            const status = String(s.status || '').toLowerCase();
            return status === 'active' || status === 'in-progress' || status === 'urgent';
        }).length;

        return {
            ...(raw.overview || {}),
            totalStrategies: strategies.length,
            activeStrategies,
            totalTasks,
            completedTasks,
            overallProgress,
            estimatedHours: raw.overview?.estimatedHours ?? null,
            actualHours: raw.overview?.actualHours ?? null,
            timeEfficiency: raw.overview?.timeEfficiency ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isDebtReductionModel(payload.data) ? payload.data : payload;
        if (!isDebtReductionModel(raw)) return null;
        return {
            type: raw.type || 'debt-reduction-model',
            title: raw.title || 'Debt Reduction',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            strategies: raw.strategies || [],
            activeTasks: raw.activeTasks || [],
            recommendations: raw.recommendations || [],
            progressHistory: raw.progressHistory || {},
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleDebtReductionModel(model) {
        if (model?.dataSource === 'repository-audit') {
            const overview = model?.overview || {};
            const recs = model?.recommendations || [];
            const tasks = model?.activeTasks || [];
            const strategies = model?.strategies || [];
            if (recs.some((item) => String(item.title || '').includes('Finish sample telemetry cleanup'))) {
                return true;
            }
            if (tasks.some((task) =>
                task.id === 'task_remaining_samples'
                || String(task.description || '').includes('still use template fiction')
            )) {
                return true;
            }
            if ((model.insights || []).some((item) =>
                String(item.impact || '').includes('23 samples remain')
                || String(item.title || '').includes('500 Jest')
            )) {
                return true;
            }
            if (strategies.some((s) => String(s.description || '').includes('500 Jest'))) {
                return true;
            }
            if (tasks.some((task) => String(task.name || '').includes('500-test suite'))) {
                return true;
            }
            const pageMigration = strategies.find((s) => s.id === 'page_migration');
            if (pageMigration?.completedTasks === 30 && pageMigration?.totalTasks === 32) {
                return true;
            }
            if (Number(overview.totalTasks) === 98 && strategies.reduce((sum, s) => sum + (s.totalTasks ?? 0), 0) === 99) {
                return true;
            }
            return false;
        }

        const overview = model?.overview || {};
        return overview.totalTasks === 216
            || overview.completedTasks === 89
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 96.2
            || model.generatedBy === 'GGUF AI Platform'
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchDebtReductionData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.strategies?.length && !isStaleDebtReductionModel(model)) return model;
            }
        } catch (error) {
            console.warn('Debt reduction sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/debt-reduction');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.strategies?.length && !isStaleDebtReductionModel(model)) return model;
            }
        } catch (error) {
            console.warn('Debt reduction API failed:', error.message);
        }
        return null;
    }

    function statusClass(status) {
        if (status === 'active') return 'active';
        if (status === 'in-progress') return 'in-progress';
        if (status === 'urgent') return 'urgent';
        if (status === 'planned') return 'planned';
        return 'idle';
    }

    function impactClass(impact) {
        const value = String(impact || '').toLowerCase();
        if (value === 'critical') return 'critical';
        if (value === 'high') return 'high';
        if (value === 'medium') return 'medium';
        return 'low';
    }

    function priorityClass(priority) {
        const value = String(priority || '').toLowerCase();
        if (value === 'critical' || value === 'high' || value === 'danger') return 'high';
        if (value === 'medium' || value === 'warning') return 'medium';
        return 'low';
    }

    function filteredStrategies(model) {
        return (model.strategies || []).filter((strategy) => {
            const matchesStatus = filterStatus === 'all' || statusClass(strategy.status) === filterStatus;
            const haystack = `${strategy.name} ${strategy.description} ${strategy.impact}`.toLowerCase();
            const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderProgressSummary(model);
        renderStrategies(model);
        renderTasks(model);
        renderRecommendations(model);
        renderProgressChart(model);
        renderInsights(model);
        renderQuickActions(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('debt-reduction-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Technical debt reduction strategies and tools';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — measured engineering baseline, not live AI telemetry.`
                : base;
        }
        const badge = document.getElementById('debt-reduction-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }
        const updateEl = document.getElementById('debt-reduction-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const o = model.overview || {};
        const tasksBadge = document.getElementById('debt-reduction-tasks-badge');
        if (tasksBadge) {
            tasksBadge.textContent = `📋 ${o.completedTasks ?? 0}/${o.totalTasks ?? 0} Tasks`;
        }
        const activeBadge = document.getElementById('debt-reduction-active-badge');
        if (activeBadge) {
            activeBadge.textContent = `● ${o.activeStrategies ?? 0} Active`;
        }
        const debtBadge = document.getElementById('debt-reduction-debt-badge');
        if (debtBadge) {
            debtBadge.textContent = `${o.debtReduction ?? 0}% Reduced`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'reduction-stat-strategies': `${o.activeStrategies ?? 0}/${o.totalStrategies ?? 0}`,
            'reduction-stat-progress': `${o.overallProgress ?? 0}%`,
            'reduction-stat-tasks': `${o.completedTasks ?? 0}/${o.totalTasks ?? 0}`,
            'reduction-stat-debt': `${o.debtReduction ?? 0}%`,
            'reduction-stat-hours': o.estimatedHours == null && o.actualHours == null
                ? '—'
                : `${o.actualHours ?? 0}/${o.estimatedHours ?? 0}h`,
            'reduction-stat-efficiency': formatMetric(o.timeEfficiency, '%')
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderProgressSummary(model) {
        const o = model.overview || {};
        const overall = document.getElementById('reduction-overall-bar');
        const efficiency = document.getElementById('reduction-efficiency-bar');
        const quality = document.getElementById('reduction-quality-bar');
        if (overall) overall.style.width = `${o.overallProgress ?? 0}%`;
        if (efficiency) {
            const efficiencyPct = o.timeEfficiency ?? 0;
            efficiency.style.width = `${efficiencyPct}%`;
        }
        if (quality) quality.style.width = `${o.qualityScore ?? 0}%`;

        const labels = {
            'reduction-overall-label': `${o.overallProgress ?? 0}%`,
            'reduction-efficiency-label': formatMetric(o.timeEfficiency, '%'),
            'reduction-quality-label': `${o.qualityScore ?? 0}%`
        };
        Object.entries(labels).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderStatusFilters(model) {
        const container = document.getElementById('reduction-status-filters');
        if (!container) return;

        const statuses = ['all', 'active', 'in-progress', 'urgent', 'planned'];
        const counts = { all: model.strategies.length };
        model.strategies.forEach((s) => {
            const key = statusClass(s.status);
            counts[key] = (counts[key] || 0) + 1;
        });

        container.innerHTML = statuses.map((status) => `
            <button type="button" class="reduction-filter-btn ${filterStatus === status ? 'active' : ''}" data-status="${status}">
                ${status === 'all' ? 'All' : status.replace(/-/g, ' ')}
                <span>${counts[status] || 0}</span>
            </button>
        `).join('');

        const countEl = document.getElementById('reduction-grid-count');
        if (countEl) {
            countEl.textContent = `${filteredStrategies(model).length} strategies`;
        }
    }

    function renderStrategies(model) {
        renderStatusFilters(model);
        const container = document.getElementById('reduction-strategies-grid');
        if (!container) return;

        const strategies = filteredStrategies(model);
        if (!strategies.length) {
            container.innerHTML = '<p class="reduction-empty">No strategies match your filters.</p>';
            return;
        }

        container.innerHTML = strategies.map((strategy) => `
            <div class="reduction-strategy-card ${statusClass(strategy.status)}">
                <div class="reduction-strategy-top">
                    <span class="reduction-strategy-icon">${escapeHtml(strategy.icon || '🔧')}</span>
                    <div>
                        <h4>${escapeHtml(strategy.name)}</h4>
                        <span class="reduction-strategy-status ${statusClass(strategy.status)}">${escapeHtml((strategy.status || 'idle').replace(/-/g, ' '))}</span>
                    </div>
                    <span class="reduction-impact ${impactClass(strategy.impact)}">${escapeHtml(strategy.impact || '—')}</span>
                </div>
                <p>${escapeHtml(strategy.description || '')}</p>
                <div class="reduction-strategy-meta">
                    <span><strong>${strategy.completedTasks ?? 0}</strong> / ${strategy.totalTasks ?? 0} tasks</span>
                    <span>${strategy.estimatedHours == null && strategy.actualHours == null
                        ? '—'
                        : `${strategy.actualHours ?? 0}h / ${strategy.estimatedHours ?? 0}h`}</span>
                </div>
                <div class="reduction-progress-wrap">
                    <div class="reduction-progress-track"><span style="width:${strategy.progress ?? 0}%"></span></div>
                    <span>${strategy.progress ?? 0}%</span>
                </div>
            </div>
        `).join('');
    }

    function renderTasks(model) {
        const tbody = document.getElementById('reduction-tasks-body');
        if (!tbody) return;

        const tasks = model.activeTasks || [];
        if (!tasks.length) {
            tbody.innerHTML = '<tr><td colspan="6">No active tasks.</td></tr>';
            return;
        }

        tbody.innerHTML = tasks.map((task) => `
            <tr>
                <td>
                    <strong>${escapeHtml(task.name)}</strong>
                    <div class="reduction-task-desc">${escapeHtml(task.description || '')}</div>
                </td>
                <td><span class="reduction-pill strategy">${escapeHtml(task.strategy || '—')}</span></td>
                <td><span class="reduction-pill priority-${priorityClass(task.priority)}">${escapeHtml(task.priority || '—')}</span></td>
                <td>
                    <div class="reduction-task-progress">
                        <div class="reduction-progress-track"><span style="width:${task.progress ?? 0}%"></span></div>
                        <span>${task.progress ?? 0}%</span>
                    </div>
                </td>
                <td>${escapeHtml(task.assignee || '—')}</td>
                <td>
                    <button type="button" class="btn btn-outline-light btn-sm reduction-task-view" data-task-id="${escapeHtml(task.id)}">View</button>
                </td>
            </tr>
        `).join('');
    }

    function renderRecommendations(model) {
        const container = document.getElementById('reduction-recommendations');
        if (!container) return;

        const items = model.recommendations || [];
        if (!items.length) {
            container.innerHTML = '<p class="reduction-empty">No recommendations.</p>';
            return;
        }

        container.innerHTML = items.map((rec) => `
            <div class="reduction-rec-card priority-${priorityClass(rec.priority)}">
                <div class="reduction-rec-header">
                    <span>${escapeHtml(rec.icon || '💡')}</span>
                    <h4>${escapeHtml(rec.title)}</h4>
                    <span class="reduction-rec-impact">${escapeHtml(rec.impact || '—')}</span>
                </div>
                <p>${escapeHtml(rec.description || '')}</p>
                <div class="reduction-rec-footer">
                    <span>${rec.hours == null ? '' : `${rec.hours}h · `}${escapeHtml(rec.debtReduction || '—')} reduction</span>
                    <button type="button" class="btn btn-outline-primary btn-sm reduction-implement-btn" data-rec-id="${escapeHtml(rec.id)}">Implement</button>
                </div>
            </div>
        `).join('');
    }

    function renderProgressChart(model) {
        const canvas = document.getElementById('reductionProgressChart');
        const history = model.progressHistory || {};
        if (!canvas || typeof Chart === 'undefined') return;

        if (progressChart) {
            progressChart.destroy();
            progressChart = null;
        }

        const stats = {
            'reduction-history-weekly': history.weeklyReduction ?? 0,
            'reduction-history-monthly': history.monthlyReduction ?? 0,
            'reduction-history-tasks': history.tasksCompleted?.slice(-1)[0] ?? 0,
            'reduction-history-total': `${history.totalReductionPct ?? 0}%`
        };
        Object.entries(stats).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        progressChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: history.labels || [],
                datasets: [
                    {
                        label: 'Debt Remaining',
                        data: history.debtRemaining || [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: 'Tasks Completed',
                        data: history.tasksCompleted || [],
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        tension: 0.35,
                        fill: false
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

    function renderInsights(model) {
        const container = document.getElementById('reduction-insights-grid');
        if (!container) return;

        const insights = model.insights || [];
        if (!insights.length) {
            container.innerHTML = '<p class="reduction-empty">No insights available.</p>';
            return;
        }

        container.innerHTML = insights.map((item) => `
            <div class="reduction-insight-card priority-${escapeHtml(item.priority || 'low')}">
                <div class="reduction-insight-priority">${escapeHtml(item.priority || 'info')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description || '')}</p>
                <div class="reduction-insight-impact">${escapeHtml(item.impact || '')}</div>
            </div>
        `).join('');
    }

    function renderQuickActions(model) {
        const container = document.getElementById('reduction-quick-actions');
        if (!container) return;

        const actions = model.quickActions || [];
        if (!actions.length) {
            container.innerHTML = '<p class="reduction-empty">No quick actions.</p>';
            return;
        }

        container.innerHTML = actions.map((action) => `
            <button type="button" class="reduction-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span class="reduction-quick-icon">${escapeHtml(action.icon || '⚡')}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function navigateTo(sectionName) {
        const navLink = document.querySelector(`.nav-link[onclick*="'${sectionName}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, navLink);
        }
    }

    function bindActions() {
        const root = document.getElementById('debt-reduction-root');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        document.getElementById('reduction-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastDebtReductionModel');
            } catch { /* ignore */ }
            window.__debtReductionModel = null;
            await loadDebtReductionSample();
        });
        document.getElementById('reduction-load-sample')?.addEventListener('click', loadDebtReductionSample);
        document.getElementById('reduction-start-automated')?.addEventListener('click', () => {
            window.showNotification?.('🤖 Automated reduction workflow started', 'info');
        });
        document.getElementById('reduction-create-plan')?.addEventListener('click', () => {
            window.showNotification?.('📋 Reduction plan draft created', 'success');
        });

        document.getElementById('reduction-export-json')?.addEventListener('click', () => {
            if (!window.__debtReductionModel) return;
            const blob = new Blob([JSON.stringify(window.__debtReductionModel, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debt-reduction-model.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('reduction-import-json')?.addEventListener('click', () => {
            document.getElementById('reduction-import-file')?.click();
        });

        document.getElementById('reduction-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyDebtReductionModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Debt reduction data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });

        document.getElementById('reduction-search')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__debtReductionModel) renderStrategies(window.__debtReductionModel);
        });

        root.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('.reduction-filter-btn');
            if (filterBtn) {
                filterStatus = filterBtn.dataset.status || 'all';
                if (window.__debtReductionModel) renderStrategies(window.__debtReductionModel);
                return;
            }

            const quickBtn = event.target.closest('.reduction-quick-action');
            if (quickBtn) {
                const section = quickBtn.dataset.section;
                if (section) {
                    navigateTo(section);
                    return;
                }
                const action = quickBtn.dataset.action;
                if (action === 'export') {
                    document.getElementById('reduction-export-json')?.click();
                } else if (action === 'start-automated') {
                    document.getElementById('reduction-start-automated')?.click();
                } else if (action === 'create-plan') {
                    document.getElementById('reduction-create-plan')?.click();
                }
                return;
            }

            const implementBtn = event.target.closest('.reduction-implement-btn');
            if (implementBtn) {
                window.showNotification?.(`✅ Recommendation ${implementBtn.dataset.recId} queued`, 'success');
                return;
            }

            const taskBtn = event.target.closest('.reduction-task-view');
            if (taskBtn) {
                window.showNotification?.(`📋 Task ${taskBtn.dataset.taskId} details`, 'info');
            }
        });
    }

    function applyDebtReductionModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid debt-reduction model', 'error');
            return false;
        }
        if (isStaleDebtReductionModel(model)) {
            window.showNotification?.('❌ Stale debt-reduction fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__debtReductionModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'debt-reduction'\"]");
            window.showSection('debt-reduction', navLink);
        }

        try {
            localStorage.setItem('lastDebtReductionModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported debt reduction',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedDebtReductionModel() {
        try {
            const raw = localStorage.getItem('lastDebtReductionModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.strategies?.length || isStaleDebtReductionModel(model)) {
                localStorage.removeItem('lastDebtReductionModel');
                return false;
            }
            window.__debtReductionModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadDebtReductionSample() {
        const root = document.getElementById('debt-reduction-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyDebtReductionModel(await response.json(), 'debt-reduction-sample.json');
            window.showNotification?.('✅ Loaded debt reduction sample', 'success');
        } catch (error) {
            console.error('Failed to load debt reduction sample:', error);
            window.showNotification?.('❌ Failed to load debt reduction sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeDebtReductionPage(forceRefresh = false) {
        const root = document.getElementById('debt-reduction-root');
        if (!root) return;

        if (window.__debtReductionModel && !forceRefresh) {
            if (isStaleDebtReductionModel(window.__debtReductionModel)) {
                window.__debtReductionModel = null;
            } else {
                renderModel(window.__debtReductionModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__debtReductionModel = null;
            try {
                localStorage.removeItem('lastDebtReductionModel');
            } catch (e) {
                /* ignore */
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchDebtReductionData();
            if (model) {
                window.__debtReductionModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedDebtReductionModel()) {
                return;
            }
            throw new Error('No debt reduction data available');
        } catch (error) {
            console.error('Failed to initialize debt reduction page:', error);
            window.showNotification?.('❌ Failed to load debt reduction data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyDebtReductionModel = applyDebtReductionModel;
    window.loadDebtReductionSample = loadDebtReductionSample;
    window.initializeDebtReductionPage = initializeDebtReductionPage;
})();
