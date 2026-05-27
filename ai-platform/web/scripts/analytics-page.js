/**
 * Analytics Page — self-contained platform analytics and insights dashboard
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ay';
    const SAMPLE_URL = `/data/analytics-sample.json?v=${SAMPLE_CACHE_BUST}`;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isAnalyticsModel(payload) {
        return Boolean(payload && (
            payload.type === 'analytics-model'
            || (payload.overview && Array.isArray(payload.usageByCategory))
        ));
    }

    function _formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isAnalyticsModel(payload.data) ? payload.data : payload;
        if (!isAnalyticsModel(raw)) return null;
        return {
            type: raw.type || 'analytics-model',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            dataSource: raw.dataSource || null,
            modelInfo: raw.modelInfo || {},
            overview: raw.overview || {},
            usageByCategory: raw.usageByCategory || [],
            trends: raw.trends || { labels: [], apiCalls: [], aiJobs: [], errors: [] },
            performance: raw.performance || {},
            topFeatures: raw.topFeatures || [],
            alerts: raw.alerts || [],
            businessIntelligence: raw.businessIntelligence || [],
            insights: raw.insights || [],
            activity: raw.activity || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleAnalyticsModel(model) {
        if (!model) return true;
        const o = model?.overview || {};
        const p = model?.performance || {};
        const isOracleFiction = o.apiCalls === 85420
            || o.aiProcessingJobs === 3842
            || o.activeUsers === 47
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.generatedBy === 'GGUF AI Platform'
            || p.throughput === '1559 req/s';
        if (isOracleFiction) return true;

        if (model?.dataSource !== 'repository-audit') {
            return false;
        }

        const hasStaleInsight = (model.insights || []).some((item) =>
            String(item.title || '').includes('Finish sample migration')
        );
        const hasStaleAlert = (model.alerts || []).some((item) =>
            String(item.message || '').includes('npm test runs with --no-coverage by default')
            || (item.resolved === false && /istanbul not collected/i.test(String(item.title || item.message || '')))
        );
        const hasPartialPayload = !(model.usageByCategory || []).length
            || !(model.topFeatures || []).length
            || !(model.alerts || []).length
            || !(model.businessIntelligence || []).length
            || !(model.activity || []).length;
        const hasStaleCounts = (model.activity || []).some((row) =>
            String(row.event || '').includes('35 files')
        ) || (model.topFeatures || []).some((feature) =>
            String(feature.avgTime || '').includes('35 files')
        );

        return o.jestTests === 500
            || o.testSuites === 17
            || o.testSuites === 18
            || p.throughput === '500/500 Jest'
            || p.throughput === '1559 req/s'
            || p.schemaPassRate === 94
            || p.scanQuality === 98
            || hasStaleInsight
            || hasStaleAlert
            || hasPartialPayload
            || hasStaleCounts;
    }

    async function fetchAnalyticsData() {
        const sources = [SAMPLE_URL, '/api/analytics'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : (raw.data || raw);
                const model = normalizeModel(payload);
                if (model && !isStaleAnalyticsModel(model)) return model;
            } catch (error) {
                console.warn('Analytics source failed:', url, error.message);
            }
        }
        return null;
    }

    function trendClass(value) {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    }

    function trendLabel(value) {
        if (value == null) return '';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value}%`;
    }

    function perfBarClass(pct) {
        if (pct >= 85) return 'danger';
        if (pct >= 65) return 'warning';
        return 'good';
    }

    function alertClass(severity) {
        if (severity === 'critical') return 'critical';
        if (severity === 'warning') return 'warning';
        return 'info';
    }

    function openSection(section) {
        if (!section) return;
        const navLink = document.querySelector(`.nav-link[onclick*="'${section}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(section, navLink);
        }
        window.showNotification?.(`📊 Opened ${section.replace(/-/g, ' ')}`, 'info');
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderUsage(model);
        renderTrends(model);
        renderPerformance(model);
        renderTopFeatures(model);
        renderAlerts(model);
        renderBI(model);
        renderInsights(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const isAudit = model.dataSource === 'repository-audit';
        const lead = document.getElementById('analytics-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Platform analytics and insights';
            lead.textContent = isAudit
                ? `${base} — engineering metrics only; no production APM fiction.`
                : base;
        }
        const badge = document.getElementById('analytics-model-badge');
        if (badge) {
            badge.textContent = isAudit
                ? `🛡️ ${model.modelInfo?.name || 'platform-checklist'} • ${model.modelInfo?.confidence || 95}% confidence`
                : `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 97}% confidence`;
        }
        const updateEl = document.getElementById('analytics-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const uptimeBadge = document.getElementById('analytics-badge-uptime');
        if (uptimeBadge) {
            uptimeBadge.textContent = isAudit
                ? `● ${model.overview?.inferenceMode || 'filesystem'}`
                : `● ${model.overview?.uptime ?? '—'}% Uptime`;
        }
        const throughputBadge = document.getElementById('analytics-badge-throughput');
        if (throughputBadge) {
            const throughput = model.performance?.throughput || model.overview?.throughput;
            throughputBadge.textContent = throughput ? `⚡ ${throughput}` : '⚡ —';
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};

        if (isAudit) {
            const labelMap = {
                'analytics-stat-api': labels.apiCalls || 'Jest Tests',
                'analytics-stat-queries': labels.dataQueries || 'Test Suites',
                'analytics-stat-ai': labels.aiProcessingJobs || 'Audit Pages',
                'analytics-stat-users': labels.activeUsers || 'Scanner Issues',
                'analytics-stat-uptime': labels.uptime || 'Inference Mode',
                'analytics-stat-response': labels.avgResponseTime || 'Jest Runtime'
            };
            Object.entries(labelMap).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const jestTotal = o.jestTestsTotal ?? o.jestTests ?? 0;
        const map = isAudit
            ? {
                'analytics-stat-api': `${o.jestTests ?? 0}/${jestTotal}`,
                'analytics-stat-queries': String(o.testSuites ?? '—'),
                'analytics-stat-ai': `${o.measuredBaselines ?? 0}/${o.sampleJsonFiles ?? 33}`,
                'analytics-stat-users': String(o.scannerIssues ?? '—'),
                'analytics-stat-uptime': o.inferenceMode || '—',
                'analytics-stat-response': o.jestRuntime || '—'
            }
            : {
                'analytics-stat-api': (o.apiCalls ?? 0).toLocaleString(),
                'analytics-stat-queries': (o.dataQueries ?? 0).toLocaleString(),
                'analytics-stat-ai': (o.aiProcessingJobs ?? 0).toLocaleString(),
                'analytics-stat-users': (o.activeUsers ?? 0).toLocaleString(),
                'analytics-stat-uptime': o.uptime != null ? `${o.uptime}%` : '—',
                'analytics-stat-response': o.avgResponseTime || '—'
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        if (!isAudit) {
            const trends = {
                'analytics-trend-api': o.apiCallsTrend,
                'analytics-trend-queries': o.dataQueriesTrend,
                'analytics-trend-ai': o.aiProcessingTrend,
                'analytics-trend-users': o.activeUsersTrend
            };
            Object.entries(trends).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = trendLabel(value);
                    el.className = `analytics-stat-trend analytics-trend ${trendClass(value)}`;
                }
            });
        } else {
            ['analytics-trend-api', 'analytics-trend-queries', 'analytics-trend-ai', 'analytics-trend-users'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = 'measured';
                    el.className = 'analytics-stat-trend analytics-trend neutral';
                }
            });
        }

        const errorEl = document.getElementById('analytics-stat-error');
        if (errorEl) {
            if (isAudit) {
                errorEl.textContent = `${o.sampleJsonFiles ?? 33} sample JSON files`;
                errorEl.hidden = false;
            } else {
                errorEl.textContent = o.errorRate != null ? `${o.errorRate}% error rate` : '';
                errorEl.hidden = o.errorRate == null;
            }
        }
    }

    function renderUsage(model) {
        const container = document.getElementById('analytics-usage-bars');
        if (!container) return;
        container.innerHTML = model.usageByCategory.map((item) => `
            <div class="analytics-usage-item">
                <div class="analytics-usage-label">
                    <span>${escapeHtml(item.category)}</span>
                    <span>${item.count != null ? item.count.toLocaleString() : '—'} (${item.percentage}%)
                        ${item.trend != null ? `<span class="analytics-trend ${trendClass(item.trend)}">${trendLabel(item.trend)}</span>` : ''}
                    </span>
                </div>
                <div class="analytics-usage-track"><span style="width:${item.percentage ?? 0}%"></span></div>
            </div>
        `).join('');
    }

    function renderTrends(model) {
        const container = document.getElementById('analytics-trends-chart');
        if (!container) return;
        const { labels, apiCalls, aiJobs, errors, seriesLabels } = model.trends;
        const maxApi = Math.max(...(apiCalls || [1]), 1);
        const maxAi = Math.max(...(aiJobs || [1]), 1);
        const maxErrors = Math.max(...(errors || [1]), 1);
        const showErrors = Array.isArray(errors) && errors.length > 0;
        const legendRoot = document.getElementById('analytics-trend-legend');
        const apiLegend = legendRoot?.querySelector('.api-legend');
        const aiLegend = legendRoot?.querySelector('.ai-legend');
        const errorLegend = legendRoot?.querySelector('.error-legend');
        if (apiLegend) apiLegend.textContent = seriesLabels?.apiCalls || 'API Calls';
        if (aiLegend) aiLegend.textContent = seriesLabels?.aiJobs || 'AI Jobs';
        if (errorLegend) {
            errorLegend.textContent = seriesLabels?.errors || 'Errors';
            errorLegend.hidden = !showErrors;
        }

        container.innerHTML = (labels || []).map((label, i) => {
            const apiH = ((apiCalls[i] || 0) / maxApi) * 100;
            const aiH = Math.min(100, ((aiJobs[i] || 0) / maxAi) * 100);
            const errorH = showErrors ? Math.min(100, ((errors[i] || 0) / maxErrors) * 100) : 0;
            return `
                <div class="analytics-trend-col">
                    <div class="analytics-trend-bars">
                        <div class="analytics-trend-bar api" style="height:${apiH}%" title="API: ${(apiCalls[i] || 0).toLocaleString()}"></div>
                        <div class="analytics-trend-bar ai" style="height:${aiH}%" title="AI: ${aiJobs[i] || 0}"></div>
                        ${showErrors ? `<div class="analytics-trend-bar error" style="height:${errorH}%" title="Errors: ${errors[i] || 0}"></div>` : ''}
                    </div>
                    <span class="analytics-trend-label">${escapeHtml(label)}</span>
                </div>
            `;
        }).join('');
    }

    function renderPerformance(model) {
        const container = document.getElementById('analytics-performance-bars');
        if (!container) return;
        const p = model.performance || {};
        const isAudit = model.dataSource === 'repository-audit';
        const memPct = p.memoryMax ? Math.round((p.memory / p.memoryMax) * 100) : p.memory;
        const items = isAudit
            ? [
                { label: 'Schema Pass Rate', value: p.schemaPassRate, unit: '%' },
                { label: 'Scan Quality', value: p.scanQuality, unit: '%' }
            ].filter((i) => i.value != null)
            : [
                { label: 'CPU Usage', value: p.cpu, unit: '%' },
                { label: 'Memory', value: memPct, unit: `% (${p.memory}MB)` },
                { label: 'Storage', value: p.storage, unit: '%' },
                { label: 'Network', value: p.network, unit: '%' },
                { label: 'Disk I/O', value: p.diskIO, unit: '%' },
                { label: 'Cache Hit Rate', value: p.cacheHitRate, unit: '%' }
            ].filter((i) => i.value != null);

        container.innerHTML = items.map((item) => `
            <div class="analytics-perf-item">
                <div class="analytics-perf-label">
                    <span>${escapeHtml(item.label)}</span>
                    <span>${item.value}${escapeHtml(item.unit)}</span>
                </div>
                <div class="analytics-perf-track"><span class="${perfBarClass(item.value)}" style="width:${Math.min(100, item.value)}%"></span></div>
            </div>
        `).join('');

        const throughputLabel = document.getElementById('analytics-throughput-label');
        if (throughputLabel) {
            throughputLabel.textContent = isAudit ? 'Measured baseline:' : 'Peak throughput:';
        }
        const throughput = document.getElementById('analytics-throughput');
        if (throughput) throughput.textContent = p.throughput || '—';
    }

    function renderTopFeatures(model) {
        const tbody = document.getElementById('analytics-features-body');
        if (!tbody) return;
        tbody.innerHTML = model.topFeatures.map((f) => `
            <tr>
                <td>${f.section ? `<button type="button" class="analytics-link-btn" data-section="${escapeHtml(f.section)}">${escapeHtml(f.name)}</button>` : escapeHtml(f.name)}</td>
                <td>${f.requests != null ? f.requests.toLocaleString() : '—'}</td>
                <td>${escapeHtml(f.avgTime)}</td>
                <td>${f.successRate != null ? `${f.successRate}%` : '—'}</td>
            </tr>
        `).join('');
    }

    function renderAlerts(model) {
        const container = document.getElementById('analytics-alerts-list');
        if (!container) return;
        container.innerHTML = model.alerts.map((alert) => `
            <div class="analytics-alert-card ${alertClass(alert.severity)} ${alert.resolved ? 'resolved' : ''}">
                <div class="analytics-alert-top">
                    <span class="analytics-alert-severity ${alertClass(alert.severity)}">${escapeHtml(alert.severity)}</span>
                    <span class="analytics-alert-time">${escapeHtml(alert.time)}</span>
                </div>
                <h4>${escapeHtml(alert.title)}</h4>
                <p>${escapeHtml(alert.message)}</p>
                ${alert.resolved ? '<span class="analytics-resolved-tag">Resolved</span>' : ''}
            </div>
        `).join('');
    }

    function renderBI(model) {
        const container = document.getElementById('analytics-bi-grid');
        if (!container) return;
        container.innerHTML = model.businessIntelligence.map((item) => `
            <div class="analytics-bi-card">
                <span class="analytics-bi-icon">${escapeHtml(item.icon || '📊')}</span>
                <div class="analytics-bi-value">${escapeHtml(item.value)}</div>
                <div class="analytics-bi-title">${escapeHtml(item.title)}</div>
                <p>${escapeHtml(item.description)}</p>
            </div>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('analytics-insights-grid');
        if (!container) return;
        container.innerHTML = model.insights.map((item) => `
            <div class="analytics-insight-card priority-${escapeHtml(item.priority || 'medium')}">
                <div class="analytics-insight-priority">${escapeHtml(item.priority || 'medium')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description)}</p>
                <div class="analytics-insight-meta">Impact: ${escapeHtml(item.impact || '—')}</div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const tbody = document.getElementById('analytics-activity-body');
        if (!tbody) return;
        tbody.innerHTML = model.activity.map((row) => `
            <tr>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.event)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td><span class="analytics-activity-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
            </tr>
        `).join('');
    }

    function bindActions() {
        if (window.__analyticsBound) return;
        window.__analyticsBound = true;

        document.getElementById('analytics-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastAnalyticsModel');
            } catch { /* ignore */ }
            window.__analyticsModel = null;
            await loadAnalyticsSample();
        });
        document.getElementById('analytics-load-sample')?.addEventListener('click', () => loadAnalyticsSample());
        document.getElementById('analytics-import-json')?.addEventListener('click', () => {
            document.getElementById('analytics-import-file')?.click();
        });
        document.getElementById('analytics-export-json')?.addEventListener('click', () => {
            const model = window.__analyticsModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Analytics data exported', 'success');
        });
        document.getElementById('analytics-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyAnalyticsModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Analytics data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid analytics JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });

        document.getElementById('analytics-root')?.addEventListener('click', (event) => {
            const link = event.target.closest('[data-section]');
            if (link?.dataset.section) openSection(link.dataset.section);
        });
    }

    function applyAnalyticsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized analytics payload');
        if (isStaleAnalyticsModel(model)) {
            throw new Error('Stale analytics fiction rejected — load repository-audit sample');
        }
        window.__analyticsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'analytics'\"]");
            window.showSection('analytics', navLink);
        }

        try {
            localStorage.setItem('lastAnalyticsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported analytics',
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            /* ignore */
        }
    }

    function restoreSavedAnalyticsModel() {
        try {
            const raw = localStorage.getItem('lastAnalyticsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.overview || isStaleAnalyticsModel(model)) {
                localStorage.removeItem('lastAnalyticsModel');
                return false;
            }
            window.__analyticsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch (error) {
            return false;
        }
    }

    async function loadAnalyticsSample() {
        const root = document.getElementById('analytics-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyAnalyticsModel(await response.json(), 'analytics-sample.json');
            window.showNotification?.('✅ Loaded analytics sample', 'success');
        } catch (error) {
            console.error('Failed to load analytics sample:', error);
            window.showNotification?.('❌ Failed to load analytics sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeAnalyticsPage(forceRefresh = false) {
        const root = document.getElementById('analytics-root');
        if (!root) return;

        if (window.__analyticsModel && !forceRefresh) {
            if (isStaleAnalyticsModel(window.__analyticsModel)) {
                window.__analyticsModel = null;
                try { localStorage.removeItem('lastAnalyticsModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__analyticsModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            try {
                localStorage.removeItem('lastAnalyticsModel');
            } catch (error) {
                /* ignore */
            }
            window.__analyticsModel = null;
        }

        if (!forceRefresh && restoreSavedAnalyticsModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchAnalyticsData();
            if (!model) {
                await loadAnalyticsSample();
                return;
            }
            window.__analyticsModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize analytics page:', error);
            window.showNotification?.('❌ Failed to load analytics data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeAnalyticsPage = initializeAnalyticsPage;
    window.loadAnalyticsSample = loadAnalyticsSample;
    window.applyAnalyticsModel = applyAnalyticsModel;
})();
