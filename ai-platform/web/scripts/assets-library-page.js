/**
 * Assets Library Page — digital assets and media library
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/assets-library-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isAssetsLibraryModel(payload) {
        return Boolean(payload && (
            payload.type === 'assets-library-model' ||
            (payload.overview?.totalAssets != null && Array.isArray(payload.categories) && payload.categories.some((c) => c.count != null))
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const categories = raw.categories || [];
        const totalFromCategories = categories.reduce((sum, cat) => sum + (cat.count ?? 0), 0);

        return {
            ...(raw.overview || {}),
            totalAssets: raw.overview?.totalAssets ?? totalFromCategories,
            categories: raw.overview?.categories ?? categories.length,
            storageLimit: raw.overview?.storageLimit ?? null,
            totalDownloads: raw.overview?.totalDownloads ?? null,
            storageAvailable: raw.overview?.storageAvailable ?? null,
            downloadRateThisMonth: raw.overview?.downloadRateThisMonth ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isAssetsLibraryModel(payload.data) ? payload.data : payload;
        if (!isAssetsLibraryModel(raw)) return null;
        return {
            type: raw.type || 'assets-library-model',
            title: raw.title || 'Assets Library Dashboard',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            assets: raw.assets || [],
            categories: raw.categories || [],
            analytics: raw.analytics || {},
            collections: raw.collections || [],
            recentActivity: raw.recentActivity || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleAssetsLibraryModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const popular = model.analytics?.popularAssets || [];
        const collections = model.collections || [];
        const activity = model.recentActivity || [];
        const assets = model.assets || [];

        if (overview.totalAssets === 1234
            || overview.totalDownloads === 5678
            || overview.storageUsed === '4.7GB'
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 96.8
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (Number(overview.uploadedThisMonth) === 11) return true;
        if (assets.some((item) => item.name === 'agi-chatbot-test' && item.status === 'active')) return true;
        if (popular.some((item) => String(item.usage || '').includes('11 measured baselines'))) return true;
        if (collections.some((item) => item.id === 'col_audit_samples' && Number(item.assets) === 11)) return true;
        if (activity.some((item) => String(item.description || '').includes('agi-chatbot-test set as active'))) return true;

        return false;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchAssetsLibraryData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.assets?.length && !isStaleAssetsLibraryModel(model)) return model;
            }
        } catch (error) {
            console.warn('Assets library sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/assets-library');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.assets?.length) return model;
            }
        } catch (error) {
            console.warn('Assets library API failed:', error.message);
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

    function typeBadge(type) {
        const map = {
            Images: 'bg-primary',
            Videos: 'bg-danger',
            'Design Files': 'bg-info',
            Audio: 'bg-success',
            Documents: 'bg-warning',
            Archives: 'bg-secondary',
            'GGUF Models': 'bg-primary',
            'Sample JSON': 'bg-info',
            'Mock Data': 'bg-warning'
        };
        return map[type] || 'bg-secondary';
    }

    function storageBarClass(percentage) {
        if (percentage >= 80) return 'danger';
        if (percentage >= 60) return 'warning';
        return 'good';
    }

    function categoryColorClass(color) {
        const map = { primary: 'info', success: 'success', danger: 'danger', warning: 'warning', info: 'info', secondary: 'secondary' };
        return map[String(color || '').toLowerCase()] || 'info';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderStorage(model);
        renderCategories(model);
        renderAssetsTable(model);
        renderPopular(model);
        renderQuickActions(model);
        renderTrendsChart(model);
        renderTrendsSummary(model);
        renderCollections(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('assets-library-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Digital assets and media library';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — repository file inventory, not a marketing DAM.`
                : base;
        }
        const badge = document.getElementById('assets-library-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }
        const updateEl = document.getElementById('assets-library-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('al-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📁 ${o.totalAssets ?? 0} tracked files</span>
                    <span class="badge bg-info me-2">💾 ${escapeHtml(o.storageUsed || '—')}</span>
                    <span class="badge bg-success me-2">📤 ${o.uploadedThisMonth ?? 0} baselines this month</span>
                    <span class="badge bg-secondary">📥 downloads not tracked</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary me-2">📁 ${(o.totalAssets ?? 0).toLocaleString()} Assets</span>
                    <span class="badge bg-info me-2">💾 ${escapeHtml(o.storageUsed || '0GB')} Used</span>
                    <span class="badge bg-success me-2">📤 ${o.uploadedThisMonth ?? 0} This Month</span>
                    <span class="badge bg-warning">📥 ${(o.totalDownloads ?? 0).toLocaleString()} Downloads</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'al-stat-total': model.dataSource === 'repository-audit'
                ? String(o.totalAssets ?? 0)
                : (o.totalAssets ?? 0).toLocaleString(),
            'al-stat-storage': o.storageUsed ?? '—',
            'al-stat-uploads': o.uploadedThisMonth ?? 0,
            'al-stat-downloads': model.dataSource === 'repository-audit'
                ? formatMetric(o.totalDownloads)
                : (o.totalDownloads ?? 0).toLocaleString()
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderStorage(model) {
        const usage = model.analytics?.storageUsage || {};
        const o = model.overview || {};
        const pct = usage.percentage ?? (model.dataSource === 'repository-audit' ? null : 47);
        const bar = document.getElementById('al-storage-bar');
        const label = document.getElementById('al-storage-label');
        const pctEl = document.getElementById('al-storage-pct');
        if (bar) {
            bar.className = `da-progress-track ${pct == null ? '' : storageBarClass(pct)}`;
            const span = bar.querySelector('span');
            if (span) span.style.width = pct == null ? '0%' : `${pct}%`;
        }
        if (label) {
            label.textContent = model.dataSource === 'repository-audit'
                ? `${o.storageUsed || '—'} tracked on local disk`
                : `${o.storageUsed || '4.7GB'} / ${o.storageLimit || '10GB'}`;
        }
        if (pctEl) {
            pctEl.textContent = pct == null ? 'GGUF-dominated storage' : `${pct}% used`;
        }

        const stats = {
            'al-stat-avg-size': o.avgFileSize ?? '—',
            'al-stat-categories': o.categories ?? 0,
            'al-stat-available': formatMetric(o.storageAvailable),
            'al-stat-rate': formatMetric(o.downloadRateThisMonth)
        };
        Object.entries(stats).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCategories(model) {
        const container = document.getElementById('al-categories-grid');
        if (!container) return;
        container.innerHTML = (model.categories || []).map((cat) => `
            <div class="al-category-card ${categoryColorClass(cat.color)}">
                <div class="al-category-icon">${cat.icon || '📁'}</div>
                <h4>${escapeHtml(cat.name)}</h4>
                <div class="al-category-count">${cat.count ?? 0} files</div>
                <div class="al-subtext">${escapeHtml(cat.size)}</div>
            </div>
        `).join('');
    }

    function renderAssetsTable(model) {
        const tbody = document.getElementById('al-assets-body');
        if (!tbody) return;
        tbody.innerHTML = (model.assets || []).map((asset) => `
            <tr>
                <td>
                    <div class="al-asset-cell">
                        <span class="al-asset-thumb">${asset.thumbnail || '📄'}</span>
                        <div>
                            <strong>${escapeHtml(asset.name)}</strong>
                            <div class="al-subtext">${escapeHtml((asset.description || '').slice(0, 45))}…</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${typeBadge(asset.type)}">${escapeHtml(asset.type)}</span></td>
                <td>${escapeHtml(asset.format)}</td>
                <td>${escapeHtml(asset.size)}</td>
                <td>${formatMetric(asset.downloads)}</td>
                <td>${formatDate(asset.uploaded)}</td>
            </tr>
        `).join('');
    }

    function renderPopular(model) {
        const container = document.getElementById('al-popular-list');
        if (!container) return;
        container.innerHTML = (model.analytics?.popularAssets || []).map((item) => `
            <div class="al-popular-item">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <div class="al-subtext">${escapeHtml(item.type)}</div>
                </div>
                <span class="badge bg-primary">${escapeHtml(item.usage || `${item.downloads ?? 0} ↓`)}</span>
            </div>
        `).join('');
    }

    function renderQuickActions(model) {
        const container = document.getElementById('al-quick-actions');
        if (!container) return;
        const actions = model.quickActions?.length ? model.quickActions : [
            { label: 'Upload Assets', icon: '📤', action: 'upload-assets' },
            { label: 'Create Collection', icon: '📁', action: 'create-collection' },
            { label: 'Organize Assets', icon: '🗂️', action: 'organize-assets' },
            { label: 'Optimize Storage', icon: '🗜️', action: 'optimize-storage' }
        ];
        container.innerHTML = actions.map((action) => `
            <button type="button" class="al-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${action.icon || '⚡'}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderTrendsChart(model) {
        const canvas = document.getElementById('alTrendsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const trends = model.analytics?.uploadTrends || [];
        const trackDownloads = trends.some((t) => t.downloads != null);
        if (trendsChart) {
            trendsChart.destroy();
            trendsChart = null;
        }

        const datasets = [{
            label: model.dataSource === 'repository-audit' ? 'Baselines added' : 'Uploads',
            data: trends.map((t) => t.uploads),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            fill: true,
            tension: 0.35
        }];

        if (trackDownloads) {
            datasets.push({
                label: 'Downloads',
                data: trends.map((t) => t.downloads),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                fill: true,
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
        const map = {
            'al-trend-uploads': s.uploadsThisMonth ?? o.uploadedThisMonth ?? 0,
            'al-trend-downloads': formatMetric(s.downloadsThisMonth ?? o.downloadRateThisMonth),
            'al-trend-avg-up': formatMetric(s.avgMonthlyUploads),
            'al-trend-avg-down': formatMetric(s.avgMonthlyDownloads)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderCollections(model) {
        const container = document.getElementById('al-collections-grid');
        if (!container) return;
        container.innerHTML = (model.collections || []).map((col) => `
            <div class="al-collection-card">
                <h4>${escapeHtml(col.name)}</h4>
                <p>${escapeHtml(col.description)}</p>
                <div class="al-collection-meta">
                    <span>${col.assets ?? 0} assets</span>
                    <span>${formatDate(col.created)}</span>
                </div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const container = document.getElementById('al-activity-list');
        if (!container) return;
        container.innerHTML = (model.recentActivity || []).map((item) => `
            <div class="al-activity-item">
                <div class="al-activity-icon">${item.icon || '📄'}</div>
                <div class="al-activity-body">
                    <div class="al-activity-header">
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
        const root = document.getElementById('assets-library-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('al-load-sample')?.addEventListener('click', () => loadAssetsLibrarySample());
        document.getElementById('al-import-json')?.addEventListener('click', () => {
            document.getElementById('al-import-file')?.click();
        });
        document.getElementById('al-export-json')?.addEventListener('click', () => {
            const model = window.__assetsLibraryModel;
            if (!model) {
                window.showNotification?.('❌ No assets data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'assets-library-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Assets library exported', 'success');
        });
        document.getElementById('al-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyAssetsLibraryModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('al-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastAssetsLibraryModel');
            } catch { /* ignore */ }
            window.__assetsLibraryModel = null;
            await loadAssetsLibrarySample();
        });

        root.addEventListener('click', (event) => {
            const quickBtn = event.target.closest('.al-quick-action');
            if (!quickBtn) return;
            event.preventDefault();
            handleAssetsQuickAction(quickBtn);
        });
    }

    function handleAssetsQuickAction(quickBtn) {
        const qa = window.QuickActionsCommon;
        const section = quickBtn.dataset.section;
        if (section) {
            qa?.navigateToSection(section);
            return;
        }
        if (quickBtn.dataset.action === 'export') {
            qa?.clickExportButton('al-export-json');
            return;
        }
        window.showNotification?.(`⚠ Unknown action: ${quickBtn.dataset.action || 'unknown'}`, 'warning');
    }

    function applyAssetsLibraryModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid assets-library model', 'error');
            return false;
        }
        if (isStaleAssetsLibraryModel(model)) {
            window.showNotification?.('❌ Stale assets library fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__assetsLibraryModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'assets-library'\"]");
            window.showSection('assets-library', navLink);
        }

        try {
            localStorage.setItem('lastAssetsLibraryModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported assets library',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedAssetsLibraryModel() {
        try {
            const raw = localStorage.getItem('lastAssetsLibraryModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.assets?.length || isStaleAssetsLibraryModel(model)) {
                localStorage.removeItem('lastAssetsLibraryModel');
                return false;
            }
            window.__assetsLibraryModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadAssetsLibrarySample() {
        const root = document.getElementById('assets-library-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyAssetsLibraryModel(await response.json(), 'assets-library-sample.json');
            window.showNotification?.('✅ Loaded assets library sample', 'success');
        } catch (error) {
            console.error('Failed to load assets library sample:', error);
            window.showNotification?.('❌ Failed to load assets library sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeAssetsLibraryPage(forceRefresh = false) {
        const root = document.getElementById('assets-library-root');
        if (!root) return;

        if (window.__assetsLibraryModel && !forceRefresh) {
            if (isStaleAssetsLibraryModel(window.__assetsLibraryModel)) {
                try {
                    localStorage.removeItem('lastAssetsLibraryModel');
                } catch { /* ignore */ }
                window.__assetsLibraryModel = null;
            } else {
                renderModel(window.__assetsLibraryModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchAssetsLibraryData();
            if (model) {
                window.__assetsLibraryModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedAssetsLibraryModel()) {
                return;
            }
            throw new Error('No assets library data available');
        } catch (error) {
            console.error('Failed to initialize assets library page:', error);
            window.showNotification?.('❌ Failed to load assets library data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyAssetsLibraryModel = applyAssetsLibraryModel;
    window.loadAssetsLibrarySample = loadAssetsLibrarySample;
    window.initializeAssetsLibraryPage = initializeAssetsLibraryPage;
})();
