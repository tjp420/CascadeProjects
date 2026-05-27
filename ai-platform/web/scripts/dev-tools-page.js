/**
 * Dev Tools Page — development utilities launcher and workflow dashboard
 */
(function () {
    const SAMPLE_URL = '/data/dev-tools-sample.json';
    let filterCategory = 'all';
    let searchQuery = '';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isDevToolsModel(payload) {
        return Boolean(payload && (
            payload.type === 'dev-tools-model' ||
            (Array.isArray(payload.tools) && payload.overview?.totalTools != null)
        ));
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isDevToolsModel(payload.data) ? payload.data : payload;
        if (!isDevToolsModel(raw)) return null;

        const tools = raw.tools || [];
        const workflows = raw.workflows || [];
        const activeTools = tools.filter((tool) => tool.status === 'active').length;
        const runningWorkflows = workflows.filter((workflow) => workflow.status === 'running').length;
        const totalUsage = tools.reduce((sum, tool) => sum + (tool.usage || 0), 0);

        return {
            type: raw.type || 'dev-tools-model',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            dataSource: raw.dataSource || null,
            modelInfo: raw.modelInfo || {},
            overview: {
                ...(raw.overview || {}),
                totalTools: raw.overview?.totalTools ?? tools.length,
                activeTools: raw.overview?.activeTools ?? activeTools,
                totalUsage: raw.overview?.totalUsage ?? totalUsage,
                runningWorkflows: raw.overview?.runningWorkflows ?? runningWorkflows,
                categories: raw.overview?.categories ?? (raw.categories?.length || new Set(tools.map((t) => t.category)).size)
            },
            tools,
            workflows,
            categories: raw.categories || [],
            activity: raw.activity || [],
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleDevToolsModel(model) {
        if (model?.dataSource === 'repository-audit') return false;
        const o = model?.overview || {};
        return o.totalUsage === 1847
            || o.successRate === 96.2
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.generatedBy === 'GGUF AI Platform'
    }

    async function fetchDevToolsData() {
        const sources = [
            SAMPLE_URL,
            '/api/dev-tools/tools',
            '/api/dev-tools/stats'
        ];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : raw;
                const model = normalizeModel(payload);
                if (model?.tools?.length && !isStaleDevToolsModel(model)) return model;
            } catch (error) {
                console.warn('Dev tools source failed:', url, error.message);
            }
        }

        try {
            const [toolsRes, workflowsRes, statsRes] = await Promise.all([
                fetch('/api/dev-tools/tools'),
                fetch('/api/dev-tools/workflows'),
                fetch('/api/dev-tools/stats')
            ]);
            const tools = toolsRes.ok ? await toolsRes.json() : [];
            const workflows = workflowsRes.ok ? await workflowsRes.json() : [];
            const stats = statsRes.ok ? await statsRes.json() : {};
            if (Array.isArray(tools) && tools.length) {
                return normalizeModel({
                    type: 'dev-tools-model',
                    generatedAt: stats.timestamp || new Date().toISOString(),
                    overview: {
                        totalTools: stats.totalTools ?? tools.length,
                        activeTools: stats.activeTools ?? tools.filter(t => t.status === 'active').length,
                        totalUsage: stats.totalUsage ?? 0,
                        runningWorkflows: stats.runningWorkflows ?? 0,
                        avgResponseTime: stats.avgResponseTime != null ? `${stats.avgResponseTime}s` : '—',
                        successRate: stats.successRate ?? 0
                    },
                    tools,
                    workflows
                });
            }
        } catch (error) {
            console.warn('Dev tools API merge failed:', error.message);
        }
        return null;
    }

    function navigateTo(sectionName) {
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, null);
        }
        window.showNotification?.(`🔧 Opened ${sectionName.replace(/-/g, ' ')}`, 'info');
    }

    function statusClass(status) {
        if (status === 'active') return 'active';
        if (status === 'running') return 'running';
        if (status === 'completed') return 'completed';
        if (status === 'scheduled') return 'scheduled';
        return 'inactive';
    }

    function filteredTools(model) {
        return (model.tools || []).filter(tool => {
            const matchCategory = filterCategory === 'all' || tool.category === filterCategory;
            const q = searchQuery.toLowerCase();
            const matchSearch = !q ||
                tool.name?.toLowerCase().includes(q) ||
                tool.description?.toLowerCase().includes(q) ||
                tool.category?.toLowerCase().includes(q);
            return matchCategory && matchSearch;
        });
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderCategoryFilters(model);
        renderTools(model);
        renderWorkflows(model);
        renderCategories(model);
        renderQuickActions(model);
        renderInsights(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const isAudit = model.dataSource === 'repository-audit';
        const lead = document.getElementById('dev-tools-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Development tools and utilities';
            lead.textContent = isAudit
                ? `${base} — real scripts/CI only; usage counters not collected.`
                : base;
        }
        const badge = document.getElementById('dev-tools-model-badge');
        if (badge) {
            badge.textContent = isAudit
                ? `🛡️ ${model.modelInfo?.name || 'platform-checklist'} • ${model.modelInfo?.confidence || 95}% confidence`
                : `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 97}% confidence`;
        }
        const updateEl = document.getElementById('dev-tools-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const o = model.overview || {};
        const activeBadge = document.getElementById('dev-tools-badge-active');
        if (activeBadge && o.activeTools != null) {
            activeBadge.textContent = `● ${o.activeTools} Active`;
        }
        const workflowsBadge = document.getElementById('dev-tools-badge-workflows');
        if (workflowsBadge && o.runningWorkflows != null) {
            workflowsBadge.textContent = `🔄 ${o.runningWorkflows} Workflows Running`;
        }
        const successBadge = document.getElementById('dev-tools-badge-success');
        if (successBadge) {
            if (isAudit) {
                successBadge.textContent = `⚡ ${o.jestPassRate ?? 100}% Jest Pass`;
            } else if (o.successRate != null) {
                successBadge.textContent = `⚡ ${o.successRate}% Success`;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};

        if (isAudit) {
            Object.entries({
                'dev-tools-stat-total': labels.totalTools || 'Repo Tools',
                'dev-tools-stat-active': labels.activeTools || 'Active',
                'dev-tools-stat-usage': labels.totalUsage || 'Tracked Runs',
                'dev-tools-stat-workflows': labels.runningWorkflows || 'CI Workflows',
                'dev-tools-stat-response': labels.avgResponseTime || 'Jest Runtime',
                'dev-tools-stat-success': labels.successRate || 'Jest Pass Rate'
            }).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const map = isAudit
            ? {
                'dev-tools-stat-total': o.totalTools ?? model.tools.length,
                'dev-tools-stat-active': o.activeTools ?? model.tools.filter((t) => t.status === 'active').length,
                'dev-tools-stat-usage': o.totalUsage == null ? '—' : o.totalUsage.toLocaleString(),
                'dev-tools-stat-workflows': o.runningWorkflows ?? 0,
                'dev-tools-stat-response': o.avgResponseTime || '—',
                'dev-tools-stat-success': `${o.jestPassRate ?? 100}%`
            }
            : {
                'dev-tools-stat-total': o.totalTools ?? model.tools.length,
                'dev-tools-stat-active': o.activeTools ?? model.tools.filter((t) => t.status === 'active').length,
                'dev-tools-stat-usage': (o.totalUsage ?? 0).toLocaleString(),
                'dev-tools-stat-workflows': o.runningWorkflows ?? 0,
                'dev-tools-stat-response': o.avgResponseTime || '—',
                'dev-tools-stat-success': o.successRate != null ? `${o.successRate}%` : '—'
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCategoryFilters(model) {
        const container = document.getElementById('dev-tools-category-filters');
        if (!container) return;
        const cats = ['all', ...new Set((model.tools || []).map(t => t.category).filter(Boolean))];
        container.innerHTML = cats.map(cat => `
            <button type="button" class="dev-tools-filter-btn ${filterCategory === cat ? 'active' : ''}" data-category="${escapeHtml(cat)}">
                ${cat === 'all' ? 'All Tools' : escapeHtml(cat)}
            </button>
        `).join('');
    }

    function renderTools(model) {
        const container = document.getElementById('dev-tools-grid');
        const countEl = document.getElementById('dev-tools-grid-count');
        if (!container) return;

        const tools = filteredTools(model);
        if (countEl) countEl.textContent = `${tools.length} tool${tools.length === 1 ? '' : 's'}`;

        if (!tools.length) {
            container.innerHTML = '<p class="dev-tools-empty">No tools match your search.</p>';
            return;
        }

        container.innerHTML = tools.map(tool => `
            <div class="dev-tools-card ${statusClass(tool.status)}" data-tool-id="${escapeHtml(tool.id)}">
                <div class="dev-tools-card-top">
                    <span class="dev-tools-icon">${escapeHtml(tool.icon || '🔧')}</span>
                    <div>
                        <h4>${escapeHtml(tool.name)}</h4>
                        <span class="dev-tools-category">${escapeHtml(tool.category || 'Utility')}</span>
                    </div>
                    <span class="dev-tools-status ${statusClass(tool.status)}">${escapeHtml(tool.status || 'active')}</span>
                </div>
                <p class="dev-tools-desc">${escapeHtml(tool.description || '')}</p>
                <div class="dev-tools-metrics">
                    <div><strong>${tool.usage != null ? tool.usage.toLocaleString() : '—'}</strong><span>Uses</span></div>
                    <div><strong>${tool.successRate != null ? `${tool.successRate}%` : '—'}</strong><span>Success</span></div>
                    <div><strong>${escapeHtml(tool.avgTime || '—')}</strong><span>Avg Time</span></div>
                </div>
                <div class="dev-tools-card-actions">
                    <button type="button" class="btn btn-primary btn-sm dev-tools-launch-btn" data-section="${escapeHtml(tool.section || '')}">Launch</button>
                    <button type="button" class="btn btn-outline-light btn-sm dev-tools-run-btn" data-tool-id="${escapeHtml(tool.id)}">Run</button>
                </div>
            </div>
        `).join('');
    }

    function renderWorkflows(model) {
        const container = document.getElementById('dev-tools-workflows');
        if (!container) return;

        const workflows = model.workflows || [];
        if (!workflows.length) {
            container.innerHTML = '<p class="dev-tools-empty">No workflows configured.</p>';
            return;
        }

        container.innerHTML = workflows.map(wf => `
            <div class="dev-tools-workflow-card ${statusClass(wf.status)}">
                <div class="dev-tools-workflow-header">
                    <div>
                        <h4>${escapeHtml(wf.name)}</h4>
                        <p>${escapeHtml(wf.description || '')}</p>
                    </div>
                    <span class="dev-tools-workflow-status ${statusClass(wf.status)}">${escapeHtml(wf.status || 'idle')}</span>
                </div>
                <div class="dev-tools-workflow-tools">
                    ${(wf.tools || []).map(id => `<span class="dev-tools-workflow-chip">${escapeHtml(id)}</span>`).join('')}
                </div>
                <div class="dev-tools-workflow-footer">
                    <span>⏱ ${escapeHtml(wf.duration || '—')}</span>
                    <span>Last: ${escapeHtml(wf.lastRun || '—')}</span>
                    <div class="dev-tools-workflow-progress">
                        <div class="dev-tools-workflow-track"><span style="width:${wf.progress ?? 0}%"></span></div>
                        <span>${wf.progress ?? 0}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderCategories(model) {
        const container = document.getElementById('dev-tools-category-bars');
        if (!container) return;

        const data = model.categories?.length
            ? model.categories
            : buildCategoriesFromTools(model.tools);

        const maxUsage = Math.max(...data.map(c => c.usage || 0), 1);
        container.innerHTML = data.map(item => `
            <div class="dev-tools-category-item">
                <div class="dev-tools-category-label">
                    <span>${escapeHtml(item.name)}</span>
                    <span>${item.count ?? 0} tools · ${(item.usage || 0).toLocaleString()} uses</span>
                </div>
                <div class="dev-tools-category-track">
                    <span style="width:${Math.round(((item.usage || 0) / maxUsage) * 100)}%"></span>
                </div>
            </div>
        `).join('');
    }

    function buildCategoriesFromTools(tools) {
        const map = {};
        (tools || []).forEach(tool => {
            const cat = tool.category || 'Other';
            if (!map[cat]) map[cat] = { name: cat, count: 0, usage: 0 };
            map[cat].count += 1;
            map[cat].usage += tool.usage || 0;
        });
        return Object.values(map);
    }

    function renderQuickActions(model) {
        const container = document.getElementById('dev-tools-quick-actions');
        if (!container) return;

        const actions = model.quickActions || [];
        if (!actions.length) {
            container.innerHTML = '<p class="dev-tools-empty">No quick actions defined.</p>';
            return;
        }

        container.innerHTML = actions.map(action => `
            <button type="button" class="dev-tools-quick-action" data-section="${escapeHtml(action.section || '')}" data-command="${escapeHtml(action.command || '')}" data-path="${escapeHtml(action.path || '')}">
                <span class="dev-tools-quick-icon">${escapeHtml(action.icon || '⚡')}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('dev-tools-insights-grid');
        if (!container) return;

        const insights = model.insights || [];
        if (!insights.length) {
            container.innerHTML = '<p class="dev-tools-empty">No insights available.</p>';
            return;
        }

        container.innerHTML = insights.map(item => `
            <div class="dev-tools-insight-card priority-${escapeHtml(item.priority || 'low')}">
                <div class="dev-tools-insight-priority">${escapeHtml(item.priority || 'info')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description || '')}</p>
                <div class="dev-tools-insight-impact">${escapeHtml(item.impact || '')}</div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const tbody = document.getElementById('dev-tools-activity-body');
        if (!tbody) return;

        const rows = model.activity || [];
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4">No recent activity.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${escapeHtml(row.time || '—')}</td>
                <td>${escapeHtml(row.event || '')}</td>
                <td><code>${escapeHtml(row.tool || '')}</code></td>
                <td><span class="dev-tools-activity-badge ${escapeHtml(row.status || 'success')}">${escapeHtml(row.status || 'success')}</span></td>
            </tr>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('dev-tools-root');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        document.getElementById('dev-tools-refresh')?.addEventListener('click', () => {
            initializeDevToolsPage(true);
        });

        document.getElementById('dev-tools-load-sample')?.addEventListener('click', loadDevToolsSample);

        document.getElementById('dev-tools-export-json')?.addEventListener('click', () => {
            if (!window.__devToolsModel) return;
            const blob = new Blob([JSON.stringify(window.__devToolsModel, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dev-tools-model.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('dev-tools-import-json')?.addEventListener('click', () => {
            document.getElementById('dev-tools-import-file')?.click();
        });

        document.getElementById('dev-tools-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                applyDevToolsModel(JSON.parse(text), file.name);
                window.showNotification?.('✅ Dev tools data imported', 'success');
            } catch (error) {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });

        document.getElementById('dev-tools-search')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__devToolsModel) renderTools(window.__devToolsModel);
        });

        root.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('.dev-tools-filter-btn');
            if (filterBtn) {
                filterCategory = filterBtn.dataset.category || 'all';
                if (window.__devToolsModel) {
                    renderCategoryFilters(window.__devToolsModel);
                    renderTools(window.__devToolsModel);
                }
                return;
            }

            const launchBtn = event.target.closest('.dev-tools-launch-btn');
            if (launchBtn?.dataset.section) {
                navigateTo(launchBtn.dataset.section);
                return;
            }

            const runBtn = event.target.closest('.dev-tools-run-btn');
            if (runBtn) {
                window.showNotification?.(`▶ Running ${runBtn.dataset.toolId}…`, 'info');
                return;
            }

            const quickAction = event.target.closest('.dev-tools-quick-action');
            if (quickAction) {
                event.preventDefault();
                void handleDevToolsQuickAction(quickAction);
            }
        });

        window.bindSimplebeaconActions?.();
    }

    async function handleDevToolsQuickAction(quickAction) {
        const qa = window.QuickActionsCommon;
        if (quickAction.dataset.section) {
            qa?.navigateToSection(quickAction.dataset.section);
            return;
        }
        if (quickAction.dataset.command) {
            await qa?.copyTerminalCommand(quickAction.dataset.command);
            return;
        }
        if (quickAction.dataset.path) {
            await qa?.analyzeProjectPath(quickAction.dataset.path);
        }
    }

    function applyDevToolsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid dev-tools model', 'error');
            return false;
        }
        if (isStaleDevToolsModel(model)) {
            window.showNotification?.('❌ Stale dev-tools fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__devToolsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'dev-tools'\"]");
            window.showSection('dev-tools', navLink);
        }

        try {
            localStorage.setItem('lastDevToolsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported dev tools',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedDevToolsModel() {
        try {
            const raw = localStorage.getItem('lastDevToolsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.tools?.length || isStaleDevToolsModel(model)) return false;
            window.__devToolsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadDevToolsSample() {
        const root = document.getElementById('dev-tools-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyDevToolsModel(await response.json(), 'dev-tools-sample.json');
            window.showNotification?.('✅ Loaded dev tools sample', 'success');
        } catch (error) {
            console.error('Failed to load dev tools sample:', error);
            window.showNotification?.('❌ Failed to load dev tools sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeDevToolsPage(forceRefresh = false) {
        const root = document.getElementById('dev-tools-root');
        if (!root) return;

        if (window.__devToolsModel && !forceRefresh) {
            if (isStaleDevToolsModel(window.__devToolsModel)) {
                window.__devToolsModel = null;
            } else {
                renderModel(window.__devToolsModel);
                bindActions();
                return;
            }
        }

        if (!forceRefresh && restoreSavedDevToolsModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchDevToolsData();
            if (!model) throw new Error('No dev tools data available');
            window.__devToolsModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize dev tools page:', error);
            window.showNotification?.('❌ Failed to load dev tools data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    function renderAnalyzerRoadmapReport(report) {
        const root = document.getElementById('dev-tools-root');
        if (!root || !report?.analyzerRoadmap) return;

        let panel = document.getElementById('dev-tools-analyzer-roadmap');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'dev-tools-analyzer-roadmap';
            panel.className = 'dev-tools-analyzer-roadmap';
            root.prepend(panel);
        }

        const caps = (report.currentCapabilities || [])
            .map((item) => `<li><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.status)} (${escapeHtml(item.measuredMetrics?.openIssues ?? item.measuredMetrics?.schemaCompliance ?? '—')})</li>`)
            .join('');
        const high = (report.priorityMatrix?.high || [])
            .map((id) => `<code>${escapeHtml(id)}</code>`)
            .join(', ');

        panel.innerHTML = `
            <div class="card mb-3" style="border-color: rgba(99,102,241,0.4);">
                <div class="card-body">
                    <h5 class="card-title">🔬 Data Maintenance Analyzers</h5>
                    <p class="text-muted mb-2">${escapeHtml(report.overview?.scanEngine || 'mock-data-scanner')} • ${report.overview?.filesScanned ?? '—'} files • ${report.overview?.openIssues ?? 0} open issues • schema ${report.overview?.schemaFilesPassed ?? '—'}/${report.overview?.schemaFilesChecked ?? '—'}</p>
                    <p><strong>Active today:</strong></p>
                    <ul class="mb-2">${caps}</ul>
                    <p class="mb-0"><strong>High priority backlog:</strong> ${high || '—'}</p>
                </div>
            </div>
        `;
    }

    function isStaleDataMaintenanceAnalyzersReport(report) {
        if (!report || report.type !== 'data-maintenance-analyzers-report') return true;
        if (report.dataSource !== 'repository-audit') return false;
        const overview = report.overview || {};
        return overview.openIssues === 156
            || String(overview.inferenceMode || '').includes('1559')
            || report.deprecatedNarrative?.previousMockFiles === 1247;
    }

    function applyDataMaintenanceAnalyzersReport(payload, sourceLabel) {
        if (!payload || payload.type !== 'data-maintenance-analyzers-report') {
            window.showNotification?.('❌ Not a data maintenance analyzers report', 'error');
            return false;
        }
        if (isStaleDataMaintenanceAnalyzersReport(payload)) {
            window.showNotification?.('❌ Stale analyzer fiction rejected — load data-maintenance-analyzers-sample.json', 'error');
            return false;
        }
        window.__dataMaintenanceAnalyzersReport = payload;
        renderAnalyzerRoadmapReport(payload);
        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'dev-tools'\"]");
            window.showSection('dev-tools', navLink);
        }
        if (!window.__devToolsModel) {
            initializeDevToolsPage(true).catch(() => {});
        }
        window.showNotification?.(`✅ Analyzer roadmap loaded from ${sourceLabel || 'import'}`, 'success');
        return true;
    }

    async function loadDataMaintenanceAnalyzersSample() {
        try {
            const response = await fetch('/data/data-maintenance-analyzers-sample.json');
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            return applyDataMaintenanceAnalyzersReport(await response.json(), 'data-maintenance-analyzers-sample.json');
        } catch (error) {
            console.error('Failed to load analyzer roadmap sample:', error);
            window.showNotification?.('❌ Failed to load analyzer roadmap sample', 'error');
            return false;
        }
    }

    window.initializeDevToolsPage = initializeDevToolsPage;
    window.loadDevToolsSample = loadDevToolsSample;
    window.applyDevToolsModel = applyDevToolsModel;
    window.applyDataMaintenanceAnalyzersReport = applyDataMaintenanceAnalyzersReport;
    window.loadDataMaintenanceAnalyzersSample = loadDataMaintenanceAnalyzersSample;
})();
