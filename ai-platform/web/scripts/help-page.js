/**
 * Help Page — documentation, tutorials, and support
 */
(function () {
    const SAMPLE_URL = '/data/help-sample.json';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isHelpModel(payload) {
        return Boolean(payload && (
            payload.type === 'help-model'
            || payload.type === 'simplebeacon-cli-model'
            || (Array.isArray(payload.quickLinks) && Array.isArray(payload.documentation) && Array.isArray(payload.faq))
        ));
    }

    function truthcheckCliToHelpModel(raw) {
        const items = raw.items || [];
        return {
            type: 'help-model',
            title: raw.title || 'Simplebeacon CLI Documentation',
            dataSource: raw.dataSource || 'repository-audit',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: {
                totalDocs: raw.overview?.totalItems ?? items.length,
                totalTutorials: (raw.commands || []).length,
                faqItems: (raw.rules || []).length,
                forumPosts: 32,
                statLabels: {
                    totalDocs: 'CLI Topics',
                    totalTutorials: 'Commands',
                    faqItems: 'Rules',
                    forumPosts: 'Page Scripts'
                },
                notes: raw.overview?.notes || 'Simplebeacon CLI — product documentation.'
            },
            quickLinks: items.slice(0, 6).map((item) => ({
                title: item.title,
                description: item.description,
                icon: item.section === 'integration' ? '⚙️' : '📋',
                category: item.section || 'developer',
                time: item.path || item.command || 'CLI'
            })),
            documentation: items.map((item) => ({
                id: item.id,
                title: item.title,
                category: item.section || 'Reference',
                difficulty: 'Intermediate',
                readTime: '5 min',
                lastUpdated: raw.generatedAt || new Date().toISOString(),
                path: item.path || item.command || 'packages/simplebeacon-cli',
                status: 'current',
                author: 'Maintainer',
                description: item.command
                    ? `${item.description} — \`${item.command}\``
                    : item.description
            })),
            tutorials: (raw.commands || []).map((cmd) => ({
                id: `tut_${cmd.name.replace(/\s+/g, '_')}`,
                title: cmd.name,
                type: 'CLI',
                duration: '2 min',
                difficulty: 'Beginner',
                path: cmd.usage,
                author: 'Maintainer',
                thumbnail: '✅',
                category: 'Simplebeacon',
                description: cmd.purpose
            })),
            faq: (raw.rules || []).map((rule) => ({
                question: `What does the ${rule.id} rule detect?`,
                answer: rule.detects,
                category: 'Simplebeacon',
                helpful: null,
                views: null
            })),
            community: raw.community || {},
            support: raw.support || {},
            popularContent: items.slice(0, 4).map((item) => ({
                id: item.id,
                title: item.title,
                type: 'CLI Doc',
                path: item.path || 'packages/simplebeacon-cli/README.md',
                description: item.description
            })),
            recentUpdates: [{
                id: 'update_truthcheck_cli',
                title: 'Simplebeacon CLI docs',
                description: 'Help center realigned from dashboard pages to simplebeacon',
                time: 'just now',
                icon: '✅'
            }],
            searchSuggestions: ['simplebeacon', 'production-leak', 'baseline sync', 'simplebeacon.yml'],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        return {
            ...(raw.overview || {}),
            totalDocs: raw.overview?.totalDocs ?? (raw.documentation || []).length,
            totalTutorials: raw.overview?.totalTutorials ?? (raw.tutorials || []).length,
            faqItems: raw.overview?.faqItems ?? (raw.faq || []).length,
            forumPosts: raw.overview?.forumPosts ?? 32,
            satisfaction: raw.overview?.satisfaction ?? null,
            avgResponseTime: raw.overview?.avgResponseTime ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && (isHelpModel(payload.data) || payload.data?.type === 'simplebeacon-cli-model')
            ? payload.data
            : payload;
        if (raw?.type === 'simplebeacon-cli-model') {
            return normalizeModel(truthcheckCliToHelpModel(raw));
        }
        if (!isHelpModel(raw)) return null;
        return {
            type: raw.type || 'help-model',
            title: raw.title || 'Help & Support Center',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            quickLinks: raw.quickLinks || [],
            documentation: raw.documentation || [],
            tutorials: raw.tutorials || [],
            faq: raw.faq || [],
            community: raw.community || {},
            support: raw.support || {},
            popularContent: raw.popularContent || [],
            recentUpdates: raw.recentUpdates || [],
            searchSuggestions: raw.searchSuggestions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleHelpModel(model) {
        if (model?.dataSource === 'repository-audit') return false;
        const overview = model?.overview || {};
        const contributors = model.community?.topContributors || [];
        return overview.totalDocs === 156
            || overview.totalTutorials === 48
            || overview.faqItems === 89
            || overview.forumPosts === 1234
            || overview.satisfaction === 4.7
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 96.5
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)
            || contributors.some((user) => user.name === 'John Doe')
    }

    function _formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchHelpData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.documentation?.length) return model;
            }
        } catch (error) {
            console.warn('Help sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/help');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.documentation?.length) return model;
            }
        } catch (error) {
            console.warn('Help API failed:', error.message);
        }
        return null;
    }

    function difficultyClass(level) {
        const map = { Beginner: 'success', Intermediate: 'warning', Advanced: 'danger' };
        return map[String(level || '')] || 'info';
    }

    function _formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleDateString();
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderQuickLinks(model);
        renderSearch(model);
        renderDocumentation(model);
        renderTutorials(model);
        renderFaq(model);
        renderCommunity(model);
        renderSupport(model);
        renderPopular(model);
        renderUpdates(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('help-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Documentation, tutorials, and support';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — in-repo docs and workflows, not an external help center.`
                : base;
        }
        const badge = document.getElementById('help-model-badge');
        if (badge) {
            badge.textContent = window.QuickActionsCommon?.formatModelBadge(model)
                ?? (model.dataSource === 'repository-audit'
                    ? '🛡️ platform-checklist • measured baseline'
                    : `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`);
        }
        const badges = document.getElementById('hp-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📚 ${o.totalDocs ?? 0} repo docs</span>
                    <span class="badge bg-success me-2">🛠️ ${o.totalTutorials ?? 0} workflows</span>
                    <span class="badge bg-info me-2">❓ ${o.faqItems ?? 0} FAQs</span>
                    <span class="badge bg-secondary">📄 ${o.forumPosts ?? 0} page scripts</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📚 ${o.totalDocs ?? 0} Docs</span>
                    <span class="badge bg-success me-2">🎥 ${o.totalTutorials ?? 0} Tutorials</span>
                    <span class="badge bg-info me-2">❓ ${o.faqItems ?? 0} FAQs</span>
                    <span class="badge bg-warning">⭐ ${o.satisfaction ?? 4.7} Satisfaction</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const labels = o.statLabels || {};
        const labelMap = model.dataSource === 'repository-audit'
            ? {
                'hp-stat-docs': labels.totalDocs || 'Repo Docs',
                'hp-stat-tutorials': labels.totalTutorials || 'Workflows',
                'hp-stat-faq': labels.faqItems || 'FAQ Items',
                'hp-stat-forum': labels.forumPosts || 'Page Scripts'
            }
            : {
                'hp-stat-docs': 'Documentation',
                'hp-stat-tutorials': 'Tutorials',
                'hp-stat-faq': 'FAQ Items',
                'hp-stat-forum': 'Forum Posts'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        const map = {
            'hp-stat-docs': o.totalDocs ?? 0,
            'hp-stat-tutorials': o.totalTutorials ?? 0,
            'hp-stat-faq': o.faqItems ?? 0,
            'hp-stat-forum': o.forumPosts ?? 0
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderQuickLinks(model) {
        const container = document.getElementById('hp-quick-links');
        if (!container) return;
        container.innerHTML = (model.quickLinks || []).map((link) => `
            <button type="button" class="hp-quick-link" data-category="${escapeHtml(link.category)}">
                <span class="hp-link-icon">${link.icon || '🔗'}</span>
                <strong>${escapeHtml(link.title)}</strong>
                <span class="hp-subtext">${escapeHtml(link.description)}</span>
                <span class="badge bg-info">${escapeHtml(link.time)}</span>
            </button>
        `).join('');
    }

    function renderSearch(model) {
        const input = document.getElementById('hp-search-input');
        const suggestions = document.getElementById('hp-search-suggestions');
        if (suggestions) {
            const items = model.searchSuggestions?.length
                ? model.searchSuggestions
                : ['getting started', 'api documentation', 'troubleshooting'];
            suggestions.textContent = `Popular searches: ${items.map((s) => `"${s}"`).join(', ')}`;
        }
        if (input && !input.dataset.bound) {
            input.dataset.bound = 'true';
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    window.showNotification?.(`🔍 Searching for "${input.value || 'help'}"`, 'info');
                }
            });
        }
    }

    function renderDocumentation(model) {
        const tbody = document.getElementById('hp-docs-body');
        if (!tbody) return;
        const useAudit = model.dataSource === 'repository-audit';
        const table = tbody.closest('table');
        if (table) {
            const headers = table.querySelectorAll('thead th');
            if (headers.length >= 6) {
                headers[4].textContent = useAudit ? 'Status' : 'Rating';
                headers[5].textContent = useAudit ? 'Path' : 'Views';
            }
        }
        tbody.innerHTML = (model.documentation || []).map((doc) => `
            <tr>
                <td>
                    <strong>${escapeHtml(doc.title)}</strong>
                    <div class="hp-subtext">${escapeHtml((doc.description || '').slice(0, 55))}…</div>
                </td>
                <td><span class="badge bg-primary">${escapeHtml(doc.category)}</span></td>
                <td><span class="badge bg-${difficultyClass(doc.difficulty)}">${escapeHtml(doc.difficulty)}</span></td>
                <td>${escapeHtml(doc.readTime)}</td>
                <td>${useAudit
                    ? `<span class="badge bg-info">${escapeHtml(doc.status || '—')}</span>`
                    : `⭐ ${doc.rating ?? '—'}`}</td>
                <td>${useAudit ? escapeHtml(doc.path || '—') : (doc.views ?? 0)}</td>
            </tr>
        `).join('');
    }

    function renderTutorials(model) {
        const container = document.getElementById('hp-tutorials-grid');
        if (!container) return;
        const useAudit = model.dataSource === 'repository-audit';
        container.innerHTML = (model.tutorials || []).map((tut) => `
            <div class="hp-tutorial-card">
                <div class="hp-tutorial-thumb">${tut.thumbnail || '🎥'}</div>
                <h4>${escapeHtml(tut.title)}</h4>
                <div class="hp-subtext">${escapeHtml(tut.type)} • ${escapeHtml(tut.duration)} • ${escapeHtml(tut.category)}</div>
                <p>${escapeHtml(tut.description)}</p>
                <div class="hp-tutorial-meta">
                    <span class="badge bg-${difficultyClass(tut.difficulty)}">${escapeHtml(tut.difficulty)}</span>
                    <span class="badge bg-info">${useAudit ? escapeHtml(tut.path || '—') : `${tut.views ?? 0} views`}</span>
                </div>
            </div>
        `).join('');
    }

    function renderFaq(model) {
        const container = document.getElementById('hp-faq-list');
        if (!container) return;
        const useAudit = model.dataSource === 'repository-audit';
        container.innerHTML = (model.faq || []).map((item) => `
            <details class="hp-faq-item">
                <summary>
                    <strong>${escapeHtml(item.question)}</strong>
                    <span class="badge bg-primary">${escapeHtml(item.category)}</span>
                </summary>
                <p>${escapeHtml(item.answer)}</p>
                ${useAudit ? '' : `<div class="hp-subtext">${item.helpful ?? 0} found helpful • ${item.views ?? 0} views</div>`}
            </details>
        `).join('');
    }

    function renderCommunity(model) {
        const c = model.community || {};
        const useAudit = model.dataSource === 'repository-audit';
        const topicsEl = document.getElementById('hp-community-topics');
        if (topicsEl) {
            topicsEl.innerHTML = (c.topics || []).map((topic) => `
                <div class="hp-topic-row">
                    <span>${escapeHtml(topic.name)}</span>
                    <span class="badge bg-${topic.active ? 'success' : 'secondary'}">${topic.posts ?? 0} ${useAudit ? 'items' : 'posts'}</span>
                </div>
            `).join('');
        }
        const contribEl = document.getElementById('hp-contributors-list');
        if (contribEl) {
            contribEl.innerHTML = (c.topContributors || []).map((user) => `
                <div class="hp-contributor-row">
                    <span>${escapeHtml(user.name)}</span>
                    <small>${user.contributions ?? 0} ${useAudit ? 'baselines' : 'posts'}${useAudit && user.reputation == null ? '' : ` • ${(user.reputation ?? 0).toLocaleString()} rep`}</small>
                </div>
            `).join('');
        }
        const statsEl = document.getElementById('hp-community-stats');
        if (statsEl) {
            if (useAudit) {
                statsEl.innerHTML = `
                    <div class="hp-stat-pill"><strong>${c.forumPosts ?? 0}</strong><span>Page Scripts</span></div>
                    <div class="hp-stat-pill"><strong>${c.activeUsers ?? 0}</strong><span>Measured Baselines</span></div>
                `;
            } else {
                statsEl.innerHTML = `
                    <div class="hp-stat-pill"><strong>${c.forumPosts ?? 0}</strong><span>Forum Posts</span></div>
                    <div class="hp-stat-pill"><strong>${c.activeUsers ?? 0}</strong><span>Active Users</span></div>
                `;
            }
        }
    }

    function renderSupport(model) {
        const s = model.support || {};
        const tickets = s.tickets || {};
        const useAudit = model.dataSource === 'repository-audit';
        const ticketsEl = document.getElementById('hp-support-tickets');
        if (ticketsEl) {
            const labels = useAudit
                ? ['Fiction remaining', 'In progress', 'Measured baselines']
                : ['Open', 'In Progress', 'Resolved'];
            ticketsEl.innerHTML = `
                <div class="hp-ticket-row"><span>${labels[0]}</span><span class="badge bg-warning">${tickets.open ?? 0}</span></div>
                <div class="hp-ticket-row"><span>${labels[1]}</span><span class="badge bg-info">${tickets.inProgress ?? 0}</span></div>
                <div class="hp-ticket-row"><span>${labels[2]}</span><span class="badge bg-success">${tickets.resolved ?? 0}</span></div>
                <div class="hp-subtext">${useAudit ? 'Migration tracker — not a ticket queue' : `Avg response: ${escapeHtml(tickets.averageResponseTime || '—')}`}</div>
            `;
        }
        const channelsEl = document.getElementById('hp-support-channels');
        if (channelsEl) {
            channelsEl.innerHTML = (s.channels || []).map((ch) => `
                <div class="hp-channel-row">
                    <span>${escapeHtml(ch.name)}</span>
                    <span class="badge bg-${ch.available ? 'success' : 'secondary'}">${escapeHtml(ch.responseTime)}</span>
                </div>
            `).join('');
        }
        const satEl = document.getElementById('hp-support-satisfaction');
        if (satEl) {
            satEl.textContent = useAudit
                ? 'CSAT not measured (local dev)'
                : `⭐ ${s.satisfaction ?? 4.7} / 5.0`;
        }
    }

    function renderPopular(model) {
        const container = document.getElementById('hp-popular-list');
        if (!container) return;
        const useAudit = model.dataSource === 'repository-audit';
        container.innerHTML = (model.popularContent || []).map((item) => `
            <div class="hp-popular-item">
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <div class="hp-subtext">${escapeHtml(item.type)} • ${escapeHtml(item.description)}</div>
                </div>
                <span class="badge bg-primary">${useAudit ? escapeHtml(item.path || '—') : `${item.views ?? 0} views`}</span>
            </div>
        `).join('');
    }

    function renderUpdates(model) {
        const container = document.getElementById('hp-updates-list');
        if (!container) return;
        container.innerHTML = (model.recentUpdates || []).map((item) => `
            <div class="hp-update-item">
                <span class="hp-update-icon">${item.icon || '📢'}</span>
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <p>${escapeHtml(item.description)}</p>
                    <small class="text-info">${escapeHtml(item.time)}</small>
                </div>
            </div>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('help-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('hp-load-sample')?.addEventListener('click', () => loadHelpSample());
        document.getElementById('hp-import-json')?.addEventListener('click', () => {
            document.getElementById('hp-import-file')?.click();
        });
        document.getElementById('hp-export-json')?.addEventListener('click', () => {
            const model = window.__helpModel;
            if (!model) {
                window.showNotification?.('❌ No help data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'help-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Help data exported', 'success');
        });
        document.getElementById('hp-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyHelpModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('hp-refresh')?.addEventListener('click', () => initializeHelpPage(true));
        document.getElementById('hp-search-btn')?.addEventListener('click', () => {
            const query = document.getElementById('hp-search-input')?.value || '';
            window.showNotification?.(`🔍 Searching help for "${query || 'all topics'}"`, 'info');
        });

        root.addEventListener('click', (event) => {
            const link = event.target.closest('.hp-quick-link');
            if (link) {
                window.showNotification?.(`📖 Opening ${link.querySelector('strong')?.textContent || 'help topic'}`, 'info');
            }
        });
    }

    function applyHelpModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid help model', 'error');
            return false;
        }
        window.__helpModel = model;
        renderModel(model);
        bindActions();
        window.PageEmptyState?.onModelLoaded('help');

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'help'\"]");
            window.showSection('help', navLink);
        }

        try {
            localStorage.setItem('lastHelpModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported help data',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedHelpModel() {
        try {
            const raw = localStorage.getItem('lastHelpModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.documentation?.length || isStaleHelpModel(model)) return false;
            window.__helpModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadSimplebeaconCliSample() {
        const root = document.getElementById('help-root');
        root?.classList.add('loading');
        try {
            const response = await fetch('/data/simplebeacon-cli-sample.json');
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyHelpModel(await response.json(), 'simplebeacon-cli-sample.json');
            window.showNotification?.('✅ Loaded Simplebeacon CLI documentation', 'success');
        } catch (error) {
            console.error('Failed to load Simplebeacon CLI sample:', error);
            window.showNotification?.('❌ Failed to load Simplebeacon CLI docs', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function loadHelpSample() {
        const root = document.getElementById('help-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyHelpModel(await response.json(), 'help-sample.json');
            window.showNotification?.('✅ Loaded help sample', 'success');
        } catch (error) {
            console.error('Failed to load help sample:', error);
            window.showNotification?.('❌ Failed to load help sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeHelpPage(forceRefresh = false) {
        const root = document.getElementById('help-root');
        if (!root) return;

        if (window.__helpModel && !forceRefresh) {
            renderModel(window.__helpModel);
            bindActions();
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchHelpData();
            if (model) {
                window.__helpModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedHelpModel()) {
                return;
            }

            throw new Error('No help data available');
        } catch (error) {
            console.error('Failed to initialize help page:', error);
            window.showNotification?.('❌ Failed to load help data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyHelpModel = applyHelpModel;
    window.loadHelpSample = loadHelpSample;
    window.loadSimplebeaconCliSample = loadSimplebeaconCliSample;
    window.initializeHelpPage = initializeHelpPage;
})();
