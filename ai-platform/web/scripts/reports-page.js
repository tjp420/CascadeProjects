/**
 * Reports Page — self-contained generated reports catalog and activity dashboard
 */
(function () {
    const SAMPLE_URL = '/data/reports-sample.json';
    let categoryFilter = 'all';
    let statusFilter = 'all';
    let searchQuery = '';

    const SECTION_INIT = {
        'gguf-analysis': () => window.initializeGgufAnalysisPage?.(),
        'ai-analysis': () => window.initializeAIAnalysisPage?.(),
        'ai-roadmap': () => window.initializeAIRoadmapPage?.(),
        'roadmap': () => window.initializeRoadmapSection?.(),
        'issue-resolution': () => window.initializeIssueResolutionPage?.(),
        'code-generation': () => window.initializeCodeGenerationPage?.(),
        'database': () => window.initializeDatabasePage?.(),
        'ai-tools': () => window.initializeAIToolsPage?.(),
        'analytics': () => window.initializeAnalyticsPage?.(),
        'performance': () => window.showSection?.('performance'),
        'security': () => window.initializeSecurityPage?.(),
        'implementation-plan': () => window.initializeImplementationPlanPage?.(),
        'release-timeline': () => window.initializeReleaseTimelinePage?.(),
        'dashboard-home': () => window.initializeDashboardHomePage?.(),
        'quality': () => window.initializeQualityPage?.()
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isReportsModel(payload) {
        return Boolean(payload && (payload.type === 'reports-model' || (payload.reports && payload.overview)));
    }

    function countReportsByStatus(reports, status) {
        return (reports || []).filter((report) => report.status === status).length;
    }

    function averageReportConfidence(reports) {
        const values = (reports || []).map((report) => Number(report.confidence)).filter((value) => Number.isFinite(value) && value > 0);
        if (!values.length) return null;
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }

    function buildOverviewFromReports(reports, overview = {}) {
        return {
            totalReports: reports.length,
            readyReports: countReportsByStatus(reports, 'ready'),
            processingReports: countReportsByStatus(reports, 'processing'),
            failedReports: countReportsByStatus(reports, 'failed'),
            scheduledReports: reports.filter((report) => report.schedule && report.schedule !== 'on-demand').length,
            totalSize: overview.totalSize || '—',
            avgGenerationTime: overview.avgGenerationTime || '—',
            lastGenerated: overview.lastGenerated || null
        };
    }

    function isStaleReportsModel(model) {
        if (model?.dataSource === 'repository-audit') {
            const overview = model?.overview || {};
            const reports = model?.reports || [];
            if (overview.totalReports === 12 || overview.totalReports === 1) return true;
            if (reports.length === 1 && String(reports[0]?.description || '').trim() === 'test') return true;
            if ((model.insights || []).some((item) =>
                String(item.title || '').includes('Keep overview aligned')
                && String(item.description || '').includes('12 total / 1 loaded')
            )) {
                return true;
            }
            if (reports.some((report) =>
                String(report.description || '').includes('156-issue')
                && !String(report.description || '').includes('resolved')
            )) {
                return true;
            }
            if (model.catalogMeta?.isPartial === true && reports.length >= 8) return true;
            if (model.catalogMeta?.loadedCount === 1 && overview.totalReports === 8) return true;
            return false;
        }

        const overview = model?.overview || {};
        if (model?.generatedBy === 'GGUF AI Platform' && !model?.dataSource) return true;
        if (overview.totalReports === 12 || overview.totalReports === 1) {
            const reports = model?.reports || [];
            if (reports.length === 1 && String(reports[0]?.description || '').trim() === 'test') return true;
            if (overview.totalReports === 12) return true;
        }
        if (model?.modelInfo?.name === 'unbreakable-oracle' || model?.modelInfo?.name === 'agi-chatbot-test') return true;
        if ((model?.reports || []).some((report) =>
            String(report.description || '').trim() === 'test'
            && !report.reportType
        )) return true;
        return false;
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isReportsModel(payload.data) ? payload.data : payload;
        if (!isReportsModel(raw)) return null;

        const reports = raw.reports || [];
        const overview = buildOverviewFromReports(reports, raw.overview || {});

        return {
            type: raw.type || 'reports-model',
            title: raw.title || 'Reports Catalog',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || null,
            modelInfo: raw.modelInfo || {},
            overview,
            catalogMeta: {
                loadedCount: raw.catalogMeta?.loadedCount ?? reports.length,
                declaredTotal: raw.catalogMeta?.declaredTotal ?? overview.totalReports,
                isPartial: raw.catalogMeta?.isPartial === true
                    || (raw.overview?.totalReports != null && raw.overview.totalReports !== reports.length)
            },
            categories: raw.categories?.length
                ? raw.categories
                : [...new Set(reports.map((report) => report.category).filter(Boolean))].map((name) => ({
                    name,
                    count: reports.filter((report) => report.category === name).length,
                    icon: '📄'
                })),
            reports,
            templates: raw.templates || [],
            insights: raw.insights || [],
            activity: raw.activity || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    async function fetchReportsData() {
        const sources = [SAMPLE_URL, '/api/reports'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const model = normalizeModel(payload);
                if (model && !isStaleReportsModel(model)) return model;
            } catch (error) {
                console.warn('Reports source failed:', url, error.message);
            }
        }
        return null;
    }

    function statusClass(status) {
        if (status === 'ready') return 'ready';
        if (status === 'processing') return 'processing';
        if (status === 'failed') return 'failed';
        return 'neutral';
    }

    function formatDate(value) {
        if (!value) return '—';
        try {
            return new Date(value).toLocaleString();
        } catch {
            return String(value);
        }
    }

    function filteredReports(model) {
        return (model.reports || []).filter((report) => {
            const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;
            const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
            const haystack = `${report.name} ${report.description} ${report.category} ${report.reportType}`.toLowerCase();
            const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
            return matchesCategory && matchesStatus && matchesSearch;
        });
    }

    function openReportSection(section) {
        if (!section) {
            window.showNotification?.('This report has no linked dashboard section', 'info');
            return;
        }
        const navLink = document.querySelector(`.nav-link[onclick*="'${section}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(section, navLink);
        }
        SECTION_INIT[section]?.();
        window.showNotification?.(`📄 Opened ${section.replace(/-/g, ' ')}`, 'info');
    }

    function downloadReportJson(report, model) {
        const blob = new Blob([JSON.stringify({ report, exportedFrom: model.type, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.id}-${report.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showNotification?.(`✅ Downloaded ${report.name}`, 'success');
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderCategories(model);
        renderReports(model);
        renderTemplates(model);
        renderInsights(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('reports-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Generated reports and documentation';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — measured catalog, not fictional PDF exports.`
                : base;
        }
        const badge = document.getElementById('reports-model-badge');
        if (badge) {
            const name = model.modelInfo?.name || 'Platform';
            if (model.dataSource === 'repository-audit') {
                badge.textContent = `📄 ${name} • measured baseline`;
            } else {
                const confidence = model.modelInfo?.confidence ?? averageReportConfidence(model.reports) ?? 97;
                badge.textContent = `🧠 ${name} • ${confidence}% confidence`;
            }
        }
        const readyBadge = document.getElementById('reports-badge-ready');
        if (readyBadge) {
            readyBadge.textContent = `● ${model.overview?.readyReports ?? 0} Ready`;
        }
        const processingBadge = document.getElementById('reports-badge-processing');
        if (processingBadge) {
            const count = model.overview?.processingReports ?? 0;
            processingBadge.textContent = `⏳ ${count} Processing`;
            processingBadge.hidden = count === 0;
        }
        const leadExtra = document.getElementById('reports-source-note');
        if (leadExtra) {
            if (model.dataSource === 'repository-audit') {
                leadExtra.textContent = 'Measured catalog — overview stats match loaded reports.';
            } else if (model.catalogMeta?.isPartial) {
                leadExtra.textContent = 'Partial import — stats reflect loaded reports only.';
            } else {
                leadExtra.textContent = '';
            }
        }
        const updateEl = document.getElementById('reports-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'reports-stat-total': (o.totalReports ?? model.reports.length).toLocaleString(),
            'reports-stat-ready': (o.readyReports ?? 0).toLocaleString(),
            'reports-stat-processing': (o.processingReports ?? 0).toLocaleString(),
            'reports-stat-scheduled': (o.scheduledReports ?? 0).toLocaleString(),
            'reports-stat-size': o.totalSize || '—',
            'reports-stat-gen-time': o.avgGenerationTime || '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCategories(model) {
        const container = document.getElementById('reports-categories-row');
        if (!container) return;
        const categories = model.categories.length
            ? model.categories
            : [...new Set(model.reports.map((r) => r.category))].map((name) => ({ name, count: model.reports.filter((r) => r.category === name).length, icon: '📄' }));

        container.innerHTML = `
            <button type="button" class="reports-category-chip ${categoryFilter === 'all' ? 'active' : ''}" data-category-filter="all">All categories</button>
            ${categories.map((cat) => `
            <button type="button" class="reports-category-chip ${categoryFilter === cat.name ? 'active' : ''}" data-category-filter="${escapeHtml(cat.name)}">
                ${escapeHtml(cat.icon || '📄')} ${escapeHtml(cat.name)} <span>${cat.count}</span>
            </button>
        `).join('')}`;
    }

    function renderReports(model) {
        const container = document.getElementById('reports-catalog-grid');
        const countEl = document.getElementById('reports-catalog-count');
        if (!container) return;

        const reports = filteredReports(model);
        if (countEl) {
            const baseCount = `${reports.length} report${reports.length === 1 ? '' : 's'}`;
            countEl.textContent = model.catalogMeta?.isPartial
                ? `${baseCount} loaded (${model.catalogMeta.declaredTotal} total in overview)`
                : baseCount;
        }

        if (!reports.length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No reports match the current filters.</p>';
            return;
        }

        container.innerHTML = reports.map((report) => `
            <div class="reports-card ${statusClass(report.status)}">
                <div class="reports-card-top">
                    <div>
                        <h4>${escapeHtml(report.name)}</h4>
                        <span class="reports-card-category">${escapeHtml(report.category)}</span>
                    </div>
                    <span class="reports-status-badge ${statusClass(report.status)}">${escapeHtml(report.status)}</span>
                </div>
                <p>${escapeHtml(report.description || '')}</p>
                <div class="reports-card-meta">
                    <span>${escapeHtml(report.format)}</span>
                    <span>${escapeHtml(report.size || '')}</span>
                    <span>${report.pages ? `${report.pages} pages` : ''}</span>
                    <span>${report.confidence ? `${report.confidence}% conf` : ''}</span>
                </div>
                <div class="reports-card-schedule">
                    <span>📅 ${escapeHtml(report.schedule || 'on-demand')}</span>
                    <span>🕐 ${formatDate(report.lastGenerated)}</span>
                </div>
                ${report.error ? `<div class="reports-card-error">${escapeHtml(report.error)}</div>` : ''}
                <div class="reports-card-actions">
                    ${report.section ? `<button type="button" class="btn btn-sm btn-primary reports-open-btn" data-section="${escapeHtml(report.section)}">Open</button>` : ''}
                    <button type="button" class="btn btn-sm btn-outline-light reports-download-btn" data-report-id="${escapeHtml(report.id)}">Download</button>
                </div>
            </div>
        `).join('');
    }

    function renderTemplates(model) {
        const container = document.getElementById('reports-templates-grid');
        if (!container) return;
        if (!(model.templates || []).length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No report templates included in this payload.</p>';
            return;
        }
        container.innerHTML = (model.templates || []).map((tpl) => `
            <div class="reports-template-card">
                <h4>${escapeHtml(tpl.name)}</h4>
                <span class="reports-template-category">${escapeHtml(tpl.category)}</span>
                <p>${escapeHtml(tpl.description || '')}</p>
                <div class="reports-template-formats">${(tpl.formats || []).map((f) => `<span>${escapeHtml(f)}</span>`).join('')}</div>
            </div>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('reports-insights-grid');
        if (!container) return;
        if (!(model.insights || []).length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No AI insights included in this payload.</p>';
            return;
        }
        container.innerHTML = (model.insights || []).map((item) => `
            <div class="reports-insight-card priority-${escapeHtml(item.priority || 'medium')}">
                <div class="reports-insight-priority">${escapeHtml(item.priority || 'medium')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description)}</p>
                <div class="reports-insight-meta">Impact: ${escapeHtml(item.impact || '—')}</div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const tbody = document.getElementById('reports-activity-body');
        if (!tbody) return;
        if (!(model.activity || []).length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No generation activity included in this payload.</td></tr>';
            return;
        }
        tbody.innerHTML = (model.activity || []).map((row) => `
            <tr>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.report)}</td>
                <td>${escapeHtml(row.action)}</td>
                <td>${escapeHtml(row.format)}</td>
                <td><span class="reports-activity-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
                <td>${escapeHtml(row.duration || '—')}</td>
            </tr>
        `).join('');
    }

    function bindActions() {
        if (window.__reportsBound) return;
        window.__reportsBound = true;

        document.getElementById('reports-refresh')?.addEventListener('click', () => initializeReportsPage(true));
        document.getElementById('reports-load-sample')?.addEventListener('click', () => loadReportsSample());
        document.getElementById('reports-import-json')?.addEventListener('click', () => {
            document.getElementById('reports-import-file')?.click();
        });
        document.getElementById('reports-export-json')?.addEventListener('click', () => {
            const model = window.__reportsModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reports-catalog-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Reports catalog exported', 'success');
        });
        document.getElementById('reports-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyReportsModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Reports data imported', 'success');
            } catch (error) {
                window.showNotification?.(`❌ Import failed: ${error.message}`, 'error');
            } finally {
                event.target.value = '';
            }
        });

        document.getElementById('reports-search')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__reportsModel) {
                renderReports(window.__reportsModel);
            }
        });

        document.getElementById('reports-root')?.addEventListener('click', (event) => {
            const categoryChip = event.target.closest('[data-category-filter]');
            if (categoryChip) {
                categoryFilter = categoryChip.dataset.categoryFilter;
                document.querySelectorAll('[data-category-filter]').forEach((chip) => {
                    chip.classList.toggle('active', chip.dataset.categoryFilter === categoryFilter);
                });
                if (window.__reportsModel) {
                    renderCategories(window.__reportsModel);
                    renderReports(window.__reportsModel);
                }
                return;
            }

            const statusChip = event.target.closest('[data-status-filter]');
            if (statusChip) {
                statusFilter = statusChip.dataset.statusFilter;
                document.querySelectorAll('[data-status-filter]').forEach((chip) => {
                    chip.classList.toggle('active', chip.dataset.statusFilter === statusFilter);
                });
                if (window.__reportsModel) renderReports(window.__reportsModel);
                return;
            }

            const openBtn = event.target.closest('.reports-open-btn');
            if (openBtn?.dataset.section) {
                openReportSection(openBtn.dataset.section);
                return;
            }

            const downloadBtn = event.target.closest('.reports-download-btn');
            if (downloadBtn?.dataset.reportId && window.__reportsModel) {
                const report = window.__reportsModel.reports.find((r) => r.id === downloadBtn.dataset.reportId);
                if (report) downloadReportJson(report, window.__reportsModel);
            }
        });
    }

    function applyReportsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized reports payload');
        if (isStaleReportsModel(model)) {
            throw new Error('Stale reports fiction rejected — load repository-audit sample');
        }
        window.__reportsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'reports'\"]");
            window.showSection('reports', navLink);
        }

        try {
            localStorage.setItem('lastReportsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported reports',
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            /* ignore */
        }
    }

    function restoreSavedReportsModel() {
        try {
            const raw = localStorage.getItem('lastReportsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.reports?.length || isStaleReportsModel(model)) return false;
            window.__reportsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch (error) {
            return false;
        }
    }

    async function loadReportsSample() {
        const root = document.getElementById('reports-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyReportsModel(await response.json(), 'reports-sample.json');
            window.showNotification?.('✅ Loaded reports sample', 'success');
        } catch (error) {
            console.error('Failed to load reports sample:', error);
            window.showNotification?.('❌ Failed to load reports sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeReportsPage(forceRefresh = false) {
        const root = document.getElementById('reports-root');
        if (!root) return;

        if (window.__reportsModel && !forceRefresh) {
            if (isStaleReportsModel(window.__reportsModel)) {
                window.__reportsModel = null;
            } else {
                renderModel(window.__reportsModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__reportsModel = null;
            try {
                localStorage.removeItem('lastReportsModel');
            } catch (e) {
                /* ignore */
            }
        }

        if (!forceRefresh && restoreSavedReportsModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchReportsData();
            if (!model) throw new Error('No reports data available');
            window.__reportsModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize reports page:', error);
            window.showNotification?.('❌ Failed to load reports data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeReportsPage = initializeReportsPage;
    window.loadReportsSample = loadReportsSample;
    window.applyReportsModel = applyReportsModel;
})();
