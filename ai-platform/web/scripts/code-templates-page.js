/**
 * Code Templates Page — reusable code templates and snippets
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/code-templates-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isCodeTemplatesModel(payload) {
        return Boolean(payload && (
            payload.type === 'code-templates-model' ||
            (payload.overview?.totalSnippets != null && Array.isArray(payload.templates) && payload.templates.some((t) => t.framework))
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const templates = raw.templates || [];
        const snippets = raw.snippets || [];

        return {
            ...(raw.overview || {}),
            totalTemplates: raw.overview?.totalTemplates ?? templates.length,
            totalSnippets: raw.overview?.totalSnippets ?? snippets.length,
            avgRating: raw.overview?.avgRating ?? null,
            totalDownloads: raw.overview?.totalDownloads ?? null
        };
    }

    function buildLanguages(raw) {
        const languages = raw.languages || [];
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !languages.length) {
            return languages;
        }

        const total = languages.reduce((sum, lang) => sum + (lang.count ?? 0), 0);
        return languages.map((lang) => ({
            ...lang,
            percentage: total ? Math.round(((lang.count ?? 0) / total) * 1000) / 10 : 0
        }));
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isCodeTemplatesModel(payload.data) ? payload.data : payload;
        if (!isCodeTemplatesModel(raw)) return null;
        return {
            type: raw.type || 'code-templates-model',
            title: raw.title || 'Code Templates Library',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            templates: raw.templates || [],
            categories: raw.categories || [],
            languages: buildLanguages(raw),
            snippets: raw.snippets || [],
            analytics: raw.analytics || {},
            recentActivity: raw.recentActivity || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleCodeTemplatesModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const popular = model.analytics?.popularTemplates || [];
        const activity = model.recentActivity || [];

        if (overview.totalTemplates === 234
            || overview.totalSnippets === 567
            || overview.avgRating === 4.7
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 97.5
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (Number(overview.usedThisMonth) === 11) return true;
        if (popular.some((item) =>
            String(item.usage || '').includes('11 baselines')
            || String(item.usage || '').includes('500 tests')
        )) return true;
        if (activity.some((item) => String(item.details || '').includes('500/500'))) return true;

        return false;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchCodeTemplatesData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.templates?.length && !isStaleCodeTemplatesModel(model)) return model;
            }
        } catch (error) {
            console.warn('Code templates sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/code-templates');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.templates?.length && !isStaleCodeTemplatesModel(model)) return model;
            }
        } catch (error) {
            console.warn('Code templates API failed:', error.message);
        }
        return null;
    }

    function _formatDate(value) {
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

    function complexityClass(complexity) {
        const value = String(complexity || '').toLowerCase();
        if (value === 'high') return 'bg-danger';
        if (value === 'medium') return 'bg-warning';
        return 'bg-success';
    }

    function categoryColorClass(color) {
        const map = { primary: 'info', success: 'success', danger: 'danger', warning: 'warning', info: 'info' };
        return map[String(color || '').toLowerCase()] || 'info';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderCategories(model);
        renderLanguages(model);
        renderTemplatesTable(model);
        renderSnippets(model);
        renderPopular(model);
        renderContributors(model);
        renderTrendsChart(model);
        renderTrendsSummary(model);
        renderQuickActions(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('code-templates-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Reusable code templates and snippets';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — dashboard code patterns from this repo, not a template marketplace.`
                : base;
        }
        const badge = document.getElementById('code-templates-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 97}% confidence`;
            }
        }
        const updateEl = document.getElementById('code-templates-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('ct-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📝 ${o.totalTemplates ?? 0} repo patterns</span>
                    <span class="badge bg-success me-2">📋 ${o.totalSnippets ?? 0} snippets</span>
                    <span class="badge bg-info me-2">📅 ${o.usedThisMonth ?? 0} baselines this month</span>
                    <span class="badge bg-secondary">👤 Maintainer only</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📝 ${o.totalTemplates ?? 0} Templates</span>
                    <span class="badge bg-success me-2">📋 ${o.totalSnippets ?? 0} Snippets</span>
                    <span class="badge bg-info me-2">📅 ${o.usedThisMonth ?? 0} Used This Month</span>
                    <span class="badge bg-warning">⭐ ${o.avgRating ?? 0} Avg Rating</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'ct-stat-templates': o.totalTemplates ?? 0,
            'ct-stat-snippets': o.totalSnippets ?? 0,
            'ct-stat-month': o.usedThisMonth ?? 0,
            'ct-stat-rating': model.dataSource === 'repository-audit'
                ? formatMetric(o.avgRating)
                : (o.avgRating ?? 0)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCategories(model) {
        const container = document.getElementById('ct-categories-grid');
        if (!container) return;
        container.innerHTML = (model.categories || []).map((cat) => `
            <div class="ct-category-card ${categoryColorClass(cat.color)}">
                <div class="ct-category-icon">${cat.icon || '📁'}</div>
                <h4>${escapeHtml(cat.name)}</h4>
                <div class="ct-category-count">${cat.count ?? 0} templates</div>
                <div class="ct-subtext">${cat.downloads == null ? 'downloads not tracked' : `${(cat.downloads ?? 0).toLocaleString()} downloads`}</div>
            </div>
        `).join('');
    }

    function renderLanguages(model) {
        const container = document.getElementById('ct-languages-list');
        if (!container) return;
        container.innerHTML = (model.languages || []).map((lang) => `
            <div class="ct-language-row">
                <span>${escapeHtml(lang.language)}</span>
                <div class="ct-language-bar-wrap">
                    <div class="da-progress-track"><span style="width:${lang.percentage ?? 0}%"></span></div>
                    <small>${lang.count ?? 0}</small>
                </div>
            </div>
        `).join('');
    }

    function renderTemplatesTable(model) {
        const tbody = document.getElementById('ct-templates-body');
        if (!tbody) return;
        tbody.innerHTML = (model.templates || []).map((tpl) => `
            <tr>
                <td>
                    <strong>${escapeHtml(tpl.name)}</strong>
                    <div class="ct-subtext">${escapeHtml((tpl.description || '').slice(0, 50))}…</div>
                </td>
                <td><span class="badge bg-primary">${escapeHtml(tpl.category)}</span></td>
                <td>${escapeHtml(tpl.language)}</td>
                <td>${escapeHtml(tpl.framework)}</td>
                <td><span class="badge ${complexityClass(tpl.complexity)}">${escapeHtml(tpl.complexity)}</span></td>
                <td>${tpl.codeLines ?? 0}</td>
                <td>${formatMetric(tpl.downloads)}</td>
                <td>${tpl.rating == null ? '—' : `⭐ ${tpl.rating}`}</td>
            </tr>
        `).join('');
    }

    function renderSnippets(model) {
        const container = document.getElementById('ct-snippets-grid');
        if (!container) return;
        container.innerHTML = (model.snippets || []).map((snippet) => `
            <div class="ct-snippet-card">
                <h4>${escapeHtml(snippet.name)}</h4>
                <div class="ct-subtext">${escapeHtml(snippet.language)} • ${snippet.lines ?? 0} lines</div>
                <p>${escapeHtml(snippet.description)}</p>
                <span class="badge bg-info">${snippet.used ?? 0} uses</span>
            </div>
        `).join('');
    }

    function renderPopular(model) {
        const container = document.getElementById('ct-popular-list');
        if (!container) return;
        container.innerHTML = (model.analytics?.popularTemplates || []).map((item) => `
            <div class="ct-popular-item">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <div class="ct-subtext">${item.rating == null ? escapeHtml(item.usage || '—') : `⭐ ${item.rating}`}</div>
                </div>
                <span class="badge bg-primary">${escapeHtml(item.usage || `${item.downloads ?? 0} ↓`)}</span>
            </div>
        `).join('');
    }

    function renderContributors(model) {
        const container = document.getElementById('ct-contributors-list');
        if (!container) return;
        container.innerHTML = (model.analytics?.contributorStats || []).map((item) => `
            <div class="ct-contributor-item">
                <span>${escapeHtml(item.name)}</span>
                <small>${item.templates ?? 0} templates${item.downloads == null ? '' : ` • ${(item.downloads ?? 0).toLocaleString()} downloads`}</small>
            </div>
        `).join('');
    }

    function renderTrendsChart(model) {
        const canvas = document.getElementById('ctTrendsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const trends = model.analytics?.usageTrends || [];
        const trackDownloads = trends.some((t) => t.downloads != null);
        if (trendsChart) {
            trendsChart.destroy();
            trendsChart = null;
        }

        const datasets = [
            {
                label: model.dataSource === 'repository-audit' ? 'Page scripts' : 'Templates',
                data: trends.map((t) => t.templates),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: false,
                tension: 0.35
            },
            {
                label: 'Snippets',
                data: trends.map((t) => t.snippets),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                fill: false,
                tension: 0.35
            }
        ];

        if (trackDownloads) {
            datasets.push({
                label: 'Downloads',
                data: trends.map((t) => t.downloads),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                fill: false,
                tension: 0.35
            });
        }

        trendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: trends.map((t) => t.month),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255, 0.06)' }
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
        const map = {
            'ct-trend-templates': s.templatesThisMonth ?? o.usedThisMonth ?? 0,
            'ct-trend-snippets': s.snippetsThisMonth ?? o.totalSnippets ?? 0,
            'ct-trend-downloads': formatMetric(s.downloadsThisMonth),
            'ct-trend-avg': formatMetric(s.avgMonthlyDownloads)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderQuickActions(model) {
        const container = document.getElementById('ct-quick-actions');
        if (!container) return;
        const actions = model.quickActions?.length ? model.quickActions : [
            { label: 'Create Template', icon: '➕', action: 'create-template' },
            { label: 'Add Snippet', icon: '📋', action: 'add-snippet' },
            { label: 'Import Templates', icon: '📤', action: 'import-templates' },
            { label: 'Browse Marketplace', icon: '🏪', action: 'browse-marketplace' }
        ];
        container.innerHTML = actions.map((action) => `
            <button type="button" class="ct-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${action.icon || '⚡'}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderActivity(model) {
        const container = document.getElementById('ct-activity-list');
        if (!container) return;
        container.innerHTML = (model.recentActivity || []).map((item) => `
            <div class="ct-activity-item">
                <div class="ct-activity-icon">${item.icon || '📝'}</div>
                <div class="ct-activity-body">
                    <div class="ct-activity-header">
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
        const root = document.getElementById('code-templates-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('ct-load-sample')?.addEventListener('click', () => loadCodeTemplatesSample());
        document.getElementById('ct-import-json')?.addEventListener('click', () => {
            document.getElementById('ct-import-file')?.click();
        });
        document.getElementById('ct-export-json')?.addEventListener('click', () => {
            const model = window.__codeTemplatesModel;
            if (!model) {
                window.showNotification?.('❌ No code templates data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'code-templates-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Code templates exported', 'success');
        });
        document.getElementById('ct-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyCodeTemplatesModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('ct-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastCodeTemplatesModel');
            } catch { /* ignore */ }
            window.__codeTemplatesModel = null;
            await loadCodeTemplatesSample();
        });

        root.addEventListener('click', (event) => {
            const quickBtn = event.target.closest('.ct-quick-action');
            if (!quickBtn) return;
            event.preventDefault();
            handleCodeTemplatesQuickAction(quickBtn);
        });
    }

    function handleCodeTemplatesQuickAction(quickBtn) {
        const qa = window.QuickActionsCommon;
        const section = quickBtn.dataset.section;
        if (section) {
            qa?.navigateToSection(section);
            return;
        }
        if (quickBtn.dataset.action === 'export') {
            qa?.clickExportButton('ct-export-json');
        }
    }

    function applyCodeTemplatesModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid code-templates model', 'error');
            return false;
        }
        if (isStaleCodeTemplatesModel(model)) {
            window.showNotification?.('❌ Stale code-templates fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__codeTemplatesModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'code-templates'\"]");
            window.showSection('code-templates', navLink);
        }

        try {
            localStorage.setItem('lastCodeTemplatesModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported code templates',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedCodeTemplatesModel() {
        try {
            const raw = localStorage.getItem('lastCodeTemplatesModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.templates?.length || isStaleCodeTemplatesModel(model)) {
                localStorage.removeItem('lastCodeTemplatesModel');
                return false;
            }
            window.__codeTemplatesModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadCodeTemplatesSample() {
        const root = document.getElementById('code-templates-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyCodeTemplatesModel(await response.json(), 'code-templates-sample.json');
            window.showNotification?.('✅ Loaded code templates sample', 'success');
        } catch (error) {
            console.error('Failed to load code templates sample:', error);
            window.showNotification?.('❌ Failed to load code templates sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeCodeTemplatesPage(forceRefresh = false) {
        const root = document.getElementById('code-templates-root');
        if (!root) return;

        if (window.__codeTemplatesModel && !forceRefresh) {
            if (isStaleCodeTemplatesModel(window.__codeTemplatesModel)) {
                window.__codeTemplatesModel = null;
                try { localStorage.removeItem('lastCodeTemplatesModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__codeTemplatesModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchCodeTemplatesData();
            if (model) {
                window.__codeTemplatesModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedCodeTemplatesModel()) {
                return;
            }
            await loadCodeTemplatesSample();
        } catch (error) {
            console.error('Failed to initialize code templates page:', error);
            try {
                await loadCodeTemplatesSample();
            } catch {
                window.showNotification?.('❌ Failed to load code templates data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyCodeTemplatesModel = applyCodeTemplatesModel;
    window.loadCodeTemplatesSample = loadCodeTemplatesSample;
    window.initializeCodeTemplatesPage = initializeCodeTemplatesPage;
})();
