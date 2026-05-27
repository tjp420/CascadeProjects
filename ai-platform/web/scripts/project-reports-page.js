/**
 * Project Reports Page — project documentation and reporting
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/project-reports-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let generationChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isProjectReportsModel(payload) {
        return Boolean(payload && (
            payload.type === 'project-reports-model' ||
            (payload.overview?.generatedThisMonth != null && Array.isArray(payload.projects)) ||
            (Array.isArray(payload.reports) && payload.reports.some((r) => r.title && r.project))
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const reports = raw.reports || [];
        const projects = raw.projects || [];

        return {
            ...(raw.overview || {}),
            totalReports: raw.overview?.totalReports ?? reports.length,
            generatedThisMonth: raw.overview?.generatedThisMonth ?? reports.length,
            activeProjects: raw.overview?.activeProjects ?? projects.filter((p) => p.status === 'active').length,
            totalViews: raw.overview?.totalViews ?? null,
            avgRating: raw.overview?.avgRating ?? null
        };
    }

    function buildAnalytics(raw) {
        const analytics = raw.analytics || {};
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !analytics.reportTypes?.length) {
            return analytics;
        }

        const total = analytics.reportTypes.reduce((sum, item) => sum + (item.count ?? 0), 0);
        const reportTypes = analytics.reportTypes.map((item) => ({
            ...item,
            percentage: total ? Math.round(((item.count ?? 0) / total) * 1000) / 10 : 0
        }));

        return { ...analytics, reportTypes };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isProjectReportsModel(payload.data) ? payload.data : payload;
        if (!isProjectReportsModel(raw)) return null;
        return {
            type: raw.type || 'project-reports-model',
            title: raw.title || 'Project Reports Dashboard',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            reports: raw.reports || [],
            projects: raw.projects || [],
            analytics: buildAnalytics(raw),
            templates: raw.templates || [],
            recentActivity: raw.recentActivity || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleProjectReportsModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const reports = model.reports || [];
        const projects = model.projects || [];
        const activity = model.recentActivity || [];
        const reportText = reports.map((item) => `${item.title} ${item.description}`).join(' ');
        const sampleProject = projects.find((item) => item.name === 'Sample Telemetry Cleanup');

        if (overview.totalReports === 156
            || overview.totalViews === 3456
            || overview.avgRating === 4.6
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 97.1
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (reportText.includes('46 debt items') || reportText.includes('98 measured tasks')) return true;
        if (reportText.includes('502h estimates') || reportText.includes('agi-chatbot-test active')) return true;
        if (sampleProject?.progress === 33) return true;
        if (activity.some((item) => String(item.description || '').includes('46-item'))) return true;

        return false;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchProjectReportsData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.reports?.length && !isStaleProjectReportsModel(model)) return model;
            }
        } catch (error) {
            console.warn('Project reports sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/project-reports');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.reports?.length) return model;
            }
        } catch (error) {
            console.warn('Project reports API failed:', error.message);
        }
        return null;
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        const diff = Date.now() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function statusBadge(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'published' || value === 'paid') return 'bg-success';
        if (value === 'draft') return 'bg-warning';
        if (value === 'review') return 'bg-info';
        return 'bg-secondary';
    }

    function typeBadge(type) {
        const map = {
            'Technical Report': 'bg-primary',
            'UX Report': 'bg-info',
            'Security Report': 'bg-danger',
            'Performance Report': 'bg-warning',
            'Business Report': 'bg-success',
            'Planning Report': 'bg-primary',
            'Baseline Report': 'bg-secondary',
            'Analytics Report': 'bg-info',
            'Quality Report': 'bg-success'
        };
        return map[type] || 'bg-secondary';
    }

    function projectStatusClass(status) {
        if (status === 'active') return 'success';
        if (status === 'completed') return 'info';
        return 'warning';
    }

    function progressBarClass(progress) {
        if (progress >= 75) return 'good';
        if (progress >= 50) return 'warning';
        return 'danger';
    }

    function templateBorderClass(color) {
        const map = { primary: 'info', success: 'success', danger: 'danger', warning: 'warning', info: 'info' };
        return map[color] || 'info';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderReportsTable(model);
        renderProjects(model);
        renderAnalytics(model);
        renderGenerationChart(model);
        renderGenerationSummary(model);
        renderTemplates(model);
        renderQuickActions(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('project-reports-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Project documentation and reports';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — measured JSON baselines, not enterprise PDF telemetry.`
                : base;
        }
        const badge = document.getElementById('project-reports-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 97}% confidence`;
            }
        }
        const updateEl = document.getElementById('project-reports-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('pr-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📄 ${o.totalReports ?? 0} JSON baselines</span>
                    <span class="badge bg-success me-2">📅 ${o.generatedThisMonth ?? 0} This month</span>
                    <span class="badge bg-info me-2">💾 ${escapeHtml(o.storageUsed || '—')}</span>
                    <span class="badge bg-secondary">👤 Maintainer-authored</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📄 ${o.totalReports ?? 0} Reports</span>
                    <span class="badge bg-success me-2">📅 ${o.generatedThisMonth ?? 0} This Month</span>
                    <span class="badge bg-info me-2">👁 ${(o.totalViews ?? 0).toLocaleString()} Views</span>
                    <span class="badge bg-warning">⭐ ${o.avgRating ?? 0} Avg Rating</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'pr-stat-total': o.totalReports ?? 0,
            'pr-stat-month': o.generatedThisMonth ?? 0,
            'pr-stat-views': model.dataSource === 'repository-audit'
                ? formatMetric(o.totalViews)
                : (o.totalViews ?? 0).toLocaleString(),
            'pr-stat-rating': model.dataSource === 'repository-audit'
                ? formatMetric(o.avgRating)
                : (o.avgRating ?? 0)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderReportsTable(model) {
        const tbody = document.getElementById('pr-reports-body');
        if (!tbody) return;
        tbody.innerHTML = (model.reports || []).map((report) => `
            <tr>
                <td>
                    <strong>${escapeHtml(report.title)}</strong>
                    <div class="pr-subtext">${escapeHtml((report.description || '').slice(0, 60))}…</div>
                </td>
                <td><span class="badge ${typeBadge(report.type)}">${escapeHtml(report.type)}</span></td>
                <td>${escapeHtml(report.project)}</td>
                <td>${escapeHtml(report.author)}</td>
                <td><span class="badge ${statusBadge(report.status)}">${escapeHtml(report.status)}</span></td>
                <td>${formatMetric(report.views)}</td>
                <td>${report.rating == null ? '—' : `⭐ ${report.rating}`}</td>
                <td><span class="pr-subtext">${escapeHtml(report.format)} • ${escapeHtml(report.size)}</span></td>
            </tr>
        `).join('');
    }

    function renderProjects(model) {
        const container = document.getElementById('pr-projects-grid');
        if (!container) return;
        container.innerHTML = (model.projects || []).map((project) => `
            <div class="pr-project-card">
                <div class="pr-project-top">
                    <h4>${escapeHtml(project.name)}</h4>
                    <span class="badge bg-${projectStatusClass(project.status)}">${escapeHtml(project.status)}</span>
                </div>
                <div class="pr-project-metrics">
                    <div><strong>${project.reports ?? 0}</strong><span>Reports</span></div>
                    <div><strong>${project.progress ?? 0}%</strong><span>Progress</span></div>
                </div>
                <div class="da-progress-track ${progressBarClass(project.progress)}">
                    <span style="width:${project.progress ?? 0}%"></span>
                </div>
                <div class="pr-subtext">Last activity: ${formatDate(project.lastActivity)}</div>
            </div>
        `).join('');
    }

    function renderAnalytics(model) {
        const typesEl = document.getElementById('pr-report-types');
        const topEl = document.getElementById('pr-top-projects');
        if (typesEl) {
            typesEl.innerHTML = (model.analytics?.reportTypes || []).map((item) => `
                <div class="pr-analytics-row">
                    <span>${escapeHtml(item.type)}</span>
                    <div class="pr-analytics-bar-wrap">
                        <div class="da-progress-track"><span style="width:${item.percentage ?? 0}%"></span></div>
                        <small>${item.count ?? 0}</small>
                    </div>
                </div>
            `).join('');
        }
        if (topEl) {
            topEl.innerHTML = (model.analytics?.topProjects || []).map((item) => `
                <div class="pr-analytics-row">
                    <span>${escapeHtml(item.project)}</span>
                    <small>${item.reports ?? 0} reports${item.views == null ? '' : ` • ${item.views} views`}</small>
                </div>
            `).join('');
        }
    }

    function renderGenerationChart(model) {
        const canvas = document.getElementById('prGenerationChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const monthly = model.analytics?.monthlyGeneration || [];
        if (generationChart) {
            generationChart.destroy();
            generationChart = null;
        }

        generationChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: monthly.map((m) => m.month),
                datasets: [{
                    label: 'Reports Generated',
                    data: monthly.map((m) => m.reports),
                    backgroundColor: 'rgba(99, 102, 241, 0.65)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8' },
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

    function renderGenerationSummary(model) {
        const s = model.analytics?.summary || {};
        const map = {
            'pr-gen-growth': s.monthlyGrowth || '—',
            'pr-gen-month': s.thisMonth ?? model.overview?.generatedThisMonth ?? 0,
            'pr-gen-six': s.lastSixMonths ?? 0,
            'pr-gen-day': formatMetric(s.avgPerDay)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderTemplates(model) {
        const container = document.getElementById('pr-templates-list');
        if (!container) return;
        container.innerHTML = (model.templates || []).slice(0, 4).map((template) => `
            <div class="pr-template-item ${templateBorderClass(template.color)}">
                <div>
                    <strong>${escapeHtml(template.name)}</strong>
                    <div class="pr-subtext">${escapeHtml(template.description)}</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary pr-use-template" data-id="${escapeHtml(template.id)}">Use</button>
            </div>
        `).join('');
    }

    function renderQuickActions(model) {
        const container = document.getElementById('pr-quick-actions');
        if (!container) return;
        const actions = model.quickActions?.length ? model.quickActions : [
            { label: 'Create Report', icon: '➕', action: 'create-report' },
            { label: 'From Template', icon: '📋', action: 'from-template' },
            { label: 'Batch Generate', icon: '📚', action: 'batch-generate' },
            { label: 'Schedule Report', icon: '⏰', action: 'schedule-report' }
        ];
        container.innerHTML = actions.map((action) => `
            <button type="button" class="pr-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${action.icon || '⚡'}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderActivity(model) {
        const container = document.getElementById('pr-activity-list');
        if (!container) return;
        container.innerHTML = (model.recentActivity || []).map((item) => `
            <div class="pr-activity-item">
                <div class="pr-activity-icon">${item.icon || '📄'}</div>
                <div class="pr-activity-body">
                    <div class="pr-activity-header">
                        <strong>${escapeHtml(item.action)}</strong>
                        <small>${escapeHtml(item.time)}</small>
                    </div>
                    <p>${escapeHtml(item.description)}</p>
                    ${item.details ? `<small class="text-info">${escapeHtml(item.details)}</small>` : ''}
                </div>
            </div>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('project-reports-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('pr-load-sample')?.addEventListener('click', () => loadProjectReportsSample());
        document.getElementById('pr-import-json')?.addEventListener('click', () => {
            document.getElementById('pr-import-file')?.click();
        });
        document.getElementById('pr-export-json')?.addEventListener('click', () => {
            const model = window.__projectReportsModel;
            if (!model) {
                window.showNotification?.('❌ No project reports data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-reports-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Project reports exported', 'success');
        });
        document.getElementById('pr-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyProjectReportsModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('pr-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastProjectReportsModel');
            } catch { /* ignore */ }
            window.__projectReportsModel = null;
            await loadProjectReportsSample();
        });

        root.addEventListener('click', (event) => {
            const quickBtn = event.target.closest('.pr-quick-action');
            if (quickBtn) {
                event.preventDefault();
                handleProjectReportsQuickAction(quickBtn);
                return;
            }
            if (event.target.closest('.pr-use-template')) {
                window.showNotification?.('📋 Template selected', 'info');
            }
        });
    }

    function handleProjectReportsQuickAction(quickBtn) {
        const qa = window.QuickActionsCommon;
        const section = quickBtn.dataset.section;
        if (section) {
            qa?.navigateToSection(section);
            return;
        }
        if (quickBtn.dataset.action === 'export') {
            qa?.clickExportButton('pr-export-json');
        }
    }

    function applyProjectReportsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid project-reports model', 'error');
            return false;
        }
        if (isStaleProjectReportsModel(model)) {
            window.showNotification?.('❌ Stale project reports fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__projectReportsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'project-reports'\"]");
            window.showSection('project-reports', navLink);
        }

        try {
            localStorage.setItem('lastProjectReportsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported project reports',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedProjectReportsModel() {
        try {
            const raw = localStorage.getItem('lastProjectReportsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.reports?.length || isStaleProjectReportsModel(model)) {
                localStorage.removeItem('lastProjectReportsModel');
                return false;
            }
            window.__projectReportsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadProjectReportsSample() {
        const root = document.getElementById('project-reports-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyProjectReportsModel(await response.json(), 'project-reports-sample.json');
            window.showNotification?.('✅ Loaded project reports sample', 'success');
        } catch (error) {
            console.error('Failed to load project reports sample:', error);
            window.showNotification?.('❌ Failed to load project reports sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeProjectReportsPage(forceRefresh = false) {
        const root = document.getElementById('project-reports-root');
        if (!root) return;

        if (window.__projectReportsModel && !forceRefresh) {
            if (isStaleProjectReportsModel(window.__projectReportsModel)) {
                try {
                    localStorage.removeItem('lastProjectReportsModel');
                } catch { /* ignore */ }
                window.__projectReportsModel = null;
            } else {
                renderModel(window.__projectReportsModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchProjectReportsData();
            if (model) {
                window.__projectReportsModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedProjectReportsModel()) {
                return;
            }
            throw new Error('No project reports data available');
        } catch (error) {
            console.error('Failed to initialize project reports page:', error);
            window.showNotification?.('❌ Failed to load project reports data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyProjectReportsModel = applyProjectReportsModel;
    window.loadProjectReportsSample = loadProjectReportsSample;
    window.initializeProjectReportsPage = initializeProjectReportsPage;
})();
