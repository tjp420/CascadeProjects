/**
 * Feature Backlog Page — feature planning and backlog management
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/feature-backlog-sample.json?v=${SAMPLE_CACHE_BUST}`;

    const CATEGORY_ICONS = {
        'Server & Auth': '🛡️',
        'Stub APIs & Pages': '🔌',
        'Sample Telemetry Cleanup': '📋',
        'Production Profile': '🚀',
        'AI & Machine Learning': '🤖',
        'Analytics & Reporting': '📊',
        'Development Tools': '🔧',
        'Security & Performance': '🛡️',
        'User Experience': '🎨'
    };

    const UPCOMING_ICONS = ['📈', '🔄', '🌐', '📱', '🚀', '⚡'];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isFeatureBacklogReport(payload) {
        return Boolean(payload && (
            payload.type === 'feature-backlog-report' ||
            (payload.featureStatistics?.totalFeatures != null && Array.isArray(payload.featureCategories))
        ));
    }

    function buildFeatureStatistics(raw) {
        const categories = raw.featureCategories || [];
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !categories.length) {
            return raw.featureStatistics || {};
        }

        const total = categories.reduce((sum, cat) => sum + (cat.totalFeatures ?? 0), 0);
        const completed = categories.reduce((sum, cat) => sum + (cat.completedFeatures ?? 0), 0);
        const remaining = Math.max(0, total - completed);
        const inProgress = raw.featureStatistics?.inProgressFeatures ?? Math.ceil(remaining * 0.67);
        const pending = raw.featureStatistics?.pendingFeatures ?? Math.max(0, remaining - inProgress);
        const completionRate = total ? `${Math.round((completed / total) * 100)}%` : '0%';

        return {
            ...(raw.featureStatistics || {}),
            totalFeatures: total,
            completedFeatures: completed,
            inProgressFeatures: inProgress,
            pendingFeatures: pending,
            completionRate
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isFeatureBacklogReport(payload.data) ? payload.data : payload;
        if (!isFeatureBacklogReport(raw)) return null;
        return {
            type: raw.type || 'feature-backlog-report',
            title: raw.title || 'Feature Backlog Report',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            featureStatistics: buildFeatureStatistics(raw),
            featureCategories: raw.featureCategories || [],
            currentSprintBacklog: raw.currentSprintBacklog || [],
            upcomingFeatures: raw.upcomingFeatures || [],
            velocityAnalysis: raw.velocityAnalysis || {},
            recommendations: raw.recommendations || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleFeatureBacklogModel(model) {
        if (!model) return true;
        const stats = model?.featureStatistics || {};
        const categories = model.featureCategories || [];
        const sampleCategory = categories.find((cat) =>
            String(cat.category || '').includes('Sample Telemetry')
        );
        const backlogText = (model.currentSprintBacklog || [])
            .map((item) => `${item.feature} ${item.status}`)
            .join(' ');

        if (stats.totalFeatures === 47
            || stats.completedFeatures === 31
            || stats.completionRate === '66%') {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (stats.completionRate === '50%' || Number(stats.completedFeatures) === 6) return true;
        if (sampleCategory && Number(sampleCategory.completedFeatures) === 1
            && Number(sampleCategory.totalFeatures) === 3) return true;
        if (String(sampleCategory?.completionRate || '') === '33%') return true;
        if (backlogText.includes('Sample telemetry cleanup') && backlogText.includes('In Progress')) return true;

        return false;
    }

    async function fetchFeatureBacklogData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model && !isStaleFeatureBacklogModel(model)) return model;
            }
        } catch (error) {
            console.warn('Feature backlog sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/feature-backlog');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model) return model;
            }
        } catch (error) {
            console.warn('Feature backlog API failed:', error.message);
        }
        return null;
    }

    function parsePercent(value) {
        const num = parseFloat(String(value || '').replace('%', ''));
        return Number.isFinite(num) ? num : 0;
    }

    function statusBadge(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'completed' || value === 'done') return 'bg-success';
        if (value === 'in progress' || value === 'in-progress') return 'bg-warning';
        return 'bg-secondary';
    }

    function priorityBadge(priority) {
        const value = String(priority || '').toLowerCase();
        if (value === 'high') return 'bg-danger';
        if (value === 'medium') return 'bg-warning';
        return 'bg-info';
    }

    function categoryBadge(category) {
        const value = String(category || '').toLowerCase();
        if (value.includes('analytics')) return 'bg-info';
        if (value.includes('performance') || value.includes('security')) return 'bg-success';
        if (value.includes('dev')) return 'bg-primary';
        return 'bg-secondary';
    }

    function progressBarClass(rate) {
        return parsePercent(rate) >= 100 ? 'completed' : 'in-progress';
    }

    function renderModel(model) {
        renderHeader(model);
        renderStatistics(model);
        renderCategories(model);
        renderSprintBacklog(model);
        renderUpcoming(model);
        renderVelocity(model);
        renderRecommendations(model);
    }

    function renderHeader(model) {
        const stats = model.featureStatistics || {};
        const lead = document.getElementById('feature-backlog-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Feature planning and backlog management';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — engineering tracks, not 47 fictional product features.`
                : base;
        }
        const updateEl = document.getElementById('feature-backlog-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('fb-header-badges');
        if (badges) {
            badges.innerHTML = `
                <span class="badge bg-primary me-2">📊 ${stats.totalFeatures ?? 0} Total Features</span>
                <span class="badge bg-success me-2">✅ ${stats.completedFeatures ?? 0} Completed</span>
                <span class="badge bg-warning me-2">🔄 ${stats.inProgressFeatures ?? 0} In Progress</span>
                <span class="badge bg-info me-2">⏳ ${stats.pendingFeatures ?? 0} Pending</span>
            `;
        }
    }

    function renderStatistics(model) {
        const stats = model.featureStatistics || {};
        const map = {
            'fb-stat-completion': stats.completionRate ?? '0%',
            'fb-stat-points': stats.totalStoryPoints ?? '—',
            'fb-stat-velocity': stats.averageVelocity ?? '—',
            'fb-stat-sprints': stats.sprintsRemaining ?? '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCategories(model) {
        const container = document.getElementById('fb-categories');
        if (!container) return;
        container.innerHTML = (model.featureCategories || []).map((cat) => {
            const icon = CATEGORY_ICONS[cat.category] || '🏷️';
            const rate = parsePercent(cat.completionRate);
            return `
                <div class="category-item">
                    <div class="category-header">
                        <span class="category-name">${icon} ${escapeHtml(cat.category)}</span>
                        <span class="category-progress">${escapeHtml(cat.completionRate)} Complete</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${progressBarClass(cat.completionRate)}" style="width: ${rate}%"></div>
                    </div>
                    <div class="category-stats">${cat.completedFeatures ?? 0} of ${cat.totalFeatures ?? 0} features completed</div>
                </div>
            `;
        }).join('');
    }

    function renderSprintBacklog(model) {
        const tbody = document.getElementById('fb-sprint-body');
        if (!tbody) return;
        tbody.innerHTML = (model.currentSprintBacklog || []).map((item) => `
            <tr>
                <td><strong>${escapeHtml(item.feature)}</strong></td>
                <td><span class="badge ${categoryBadge(item.category)}">${escapeHtml(item.category)}</span></td>
                <td><span class="badge ${statusBadge(item.status)}">${escapeHtml(item.status)}</span></td>
                <td><span class="badge ${priorityBadge(item.priority)}">${escapeHtml(item.priority)}</span></td>
                <td>${escapeHtml(item.storyPoints)}</td>
                <td>${escapeHtml(item.assignee)}</td>
            </tr>
        `).join('');
    }

    function renderUpcoming(model) {
        const container = document.getElementById('fb-upcoming-grid');
        if (!container) return;
        container.innerHTML = (model.upcomingFeatures || []).map((item, index) => `
            <div class="col-md-6">
                <div class="milestone-card upcoming">
                    <div class="milestone-icon">${UPCOMING_ICONS[index % UPCOMING_ICONS.length]}</div>
                    <div class="milestone-content">
                        <h4>${escapeHtml(item.feature)}</h4>
                        <p>${escapeHtml(item.description)}</p>
                        <div class="milestone-date">Priority: ${escapeHtml(item.priority)} | Story Points: ${escapeHtml(item.storyPoints)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderVelocity(model) {
        const v = model.velocityAnalysis || {};
        const map = {
            'fb-velocity-current': v.currentVelocity ?? '—',
            'fb-velocity-target': v.targetVelocity ?? '—',
            'fb-velocity-trend': v.velocityTrend ?? '—',
            'fb-velocity-estimate': v.estimatedCompletion ?? '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderRecommendations(model) {
        const list = document.getElementById('fb-recommendations-list');
        if (!list) return;
        list.innerHTML = (model.recommendations || []).map((rec) => `
            <li>${escapeHtml(rec)}</li>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('feature-backlog-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('fb-load-sample')?.addEventListener('click', () => loadFeatureBacklogSample());
        document.getElementById('fb-import-json')?.addEventListener('click', () => {
            document.getElementById('fb-import-file')?.click();
        });
        document.getElementById('fb-export-json')?.addEventListener('click', () => {
            const model = window.__featureBacklogModel;
            if (!model) {
                window.showNotification?.('❌ No backlog data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'feature-backlog-report.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Feature backlog exported', 'success');
        });
        document.getElementById('fb-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                applyFeatureBacklogReport(JSON.parse(text), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('fb-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastFeatureBacklogReport');
            } catch { /* ignore */ }
            window.__featureBacklogModel = null;
            await loadFeatureBacklogSample();
        });
    }

    function applyFeatureBacklogReport(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid feature-backlog report', 'error');
            return false;
        }
        if (isStaleFeatureBacklogModel(model)) {
            window.showNotification?.('❌ Stale feature backlog fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__featureBacklogModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'feature-backlog'\"]");
            window.showSection('feature-backlog', navLink);
        }

        try {
            localStorage.setItem('lastFeatureBacklogReport', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported feature backlog',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedFeatureBacklogReport() {
        try {
            const raw = localStorage.getItem('lastFeatureBacklogReport');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model || isStaleFeatureBacklogModel(model)) {
                localStorage.removeItem('lastFeatureBacklogReport');
                return false;
            }
            window.__featureBacklogModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadFeatureBacklogSample() {
        const root = document.getElementById('feature-backlog-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyFeatureBacklogReport(await response.json(), 'feature-backlog-sample.json');
            window.showNotification?.('✅ Loaded feature backlog sample', 'success');
        } catch (error) {
            console.error('Failed to load feature backlog sample:', error);
            window.showNotification?.('❌ Failed to load feature backlog sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeFeatureBacklogPage(forceRefresh = false) {
        const root = document.getElementById('feature-backlog-root');
        if (!root) return;

        if (window.__featureBacklogModel && !forceRefresh) {
            if (isStaleFeatureBacklogModel(window.__featureBacklogModel)) {
                try {
                    localStorage.removeItem('lastFeatureBacklogReport');
                } catch { /* ignore */ }
                window.__featureBacklogModel = null;
            } else {
                renderModel(window.__featureBacklogModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchFeatureBacklogData();
            if (model) {
                window.__featureBacklogModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedFeatureBacklogReport()) {
                return;
            }
            throw new Error('No feature backlog data available');
        } catch (error) {
            console.error('Failed to initialize feature backlog page:', error);
            window.showNotification?.('❌ Failed to load feature backlog data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyFeatureBacklogReport = applyFeatureBacklogReport;
    window.loadFeatureBacklogSample = loadFeatureBacklogSample;
    window.initializeFeatureBacklogPage = initializeFeatureBacklogPage;
})();
