/**
 * Performance Page — system monitoring and optimization dashboard
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524perf';
    const SAMPLE_URL = `/data/performance-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let metricsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isPerformanceModel(payload) {
        return Boolean(payload && (
            payload.type === 'performance-model' ||
            (payload.metricsTimeline?.cpu && payload.overview?.cpuCurrent != null)
        ));
    }

    function buildOverview(raw) {
        if (raw.dataSource !== 'repository-audit') {
            return raw.overview || {};
        }

        const overview = raw.overview || {};
        return {
            ...overview,
            cpuCurrent: overview.cpuCurrent ?? overview.testSuites ?? null,
            throughput: overview.throughput
                ?? (overview.passedTests != null && overview.totalTests != null
                    ? `${overview.passedTests}/${overview.totalTests}`
                    : null),
            cacheHitRate: overview.cacheHitRate ?? null,
            avgResponseTime: overview.avgResponseTime ?? null,
            uptime: overview.uptime ?? null,
            errorRate: overview.errorRate ?? null,
            cpuPeak: overview.cpuPeak ?? null,
            cpuTrend: overview.cpuTrend ?? null,
            memoryTrend: overview.memoryTrend ?? null,
            throughputTrend: overview.throughputTrend ?? null,
            responseTrend: overview.responseTrend ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isPerformanceModel(payload.data) ? payload.data : payload;
        if (!isPerformanceModel(raw)) return null;
        return {
            type: raw.type || 'performance-model',
            title: raw.title || 'Performance',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            metricsTimeline: raw.metricsTimeline || { labels: [], cpu: [], memory: [], diskIO: [], network: [] },
            systemResources: raw.systemResources || [],
            bottlenecks: raw.bottlenecks || [],
            optimizations: raw.optimizations || [],
            slowEndpoints: raw.slowEndpoints || [],
            alerts: raw.alerts || [],
            insights: raw.insights || [],
            activity: raw.activity || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStalePerformanceModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const throughput = String(overview.throughput || '');
        const isOracleFiction = model?.modelInfo?.name === 'unbreakable-oracle'
            || overview.uptime === 99.97 || overview.uptime === '99.97'
            || throughput.includes('1,559') || throughput.includes('1559')
            || overview.memoryUsed === 288 && overview.memoryMax === 512
            || overview.cpuCurrent === 23 && throughput.includes('req/s')
            || model?.generatedBy === 'GGUF AI Platform' && !model?.dataSource
            || (model?.slowEndpoints || []).some((row) =>
                String(row.endpoint || '').includes('/api/gguf/analysis')
                || (row.requests ?? 0) > 10000
            )
            || (model?.alerts || []).some((alert) =>
                String(alert.message || '').includes('5433')
                || String(alert.message || '').includes('1,559 req/s')
            );
        if (isOracleFiction) return true;
        if (model?.dataSource !== 'repository-audit') return false;

        const hasOldBottleneck = (model?.bottlenecks || []).some((item) =>
            String(item.impact || '').includes('16 sample pages')
            || String(item.title || '').includes('Sample schema violations')
            || String(item.title || '').includes('Duplicate roadmap JSON')
            || /istanbul not collected/i.test(String(item.title || ''))
        );
        const hasOldAlert = (model?.alerts || []).some((alert) =>
            !alert.resolved && (
                String(alert.message || '').includes('empty required arrays')
                || String(alert.title || '').includes('Fiction pages remaining')
                || /istanbul not collected/i.test(String(alert.title || alert.message || ''))
            )
        );
        const hasOldInsight = (model?.insights || []).some((item) =>
            String(item.title || '').includes('Finish repository-audit migration')
            || String(item.description || '').includes('17 of 33')
            || String(item.description || '').includes('94% schema pass')
        );
        const hasPartialPayload = !(model.systemResources || []).length
            || !(model.bottlenecks || []).length
            || !(model.optimizations || []).length
            || !(model.slowEndpoints || []).length
            || !(model.alerts || []).length
            || !(model.insights || []).length
            || !(model.activity || []).length
            || !(model.metricsTimeline?.labels || []).length;
        const hasStaleCounts = overview.mockScanFiles === 35
            || overview.memoryUsed === 212.7
            || (model.slowEndpoints || []).some((row) =>
                String(row.endpoint || '').includes('35 files')
            );

        return overview.totalTests === 500
            || overview.testSuites === 17
            || overview.throughput === '500/500'
            || overview.cacheHitRate === 94
            || (overview.measuredBaselines === 17 && overview.sampleJsonFiles === 33)
            || hasOldBottleneck
            || hasOldAlert
            || hasOldInsight
            || hasPartialPayload
            || hasStaleCounts;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchPerformanceData() {
        const sources = [SAMPLE_URL, '/api/analytics/performance'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const model = normalizeModel(payload);
                if (model && !isStalePerformanceModel(model)) return model;
            } catch (error) {
                console.warn('Performance source failed:', url, error.message);
            }
        }
        return null;
    }

    function trendClass(value) {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    }

    function trendLabel(value, invert) {
        if (value == null) return '';
        const sign = value > 0 ? '+' : '';
        const label = `${sign}${value}%`;
        if (!invert) return label;
        return value < 0 ? `↓ ${Math.abs(value)}%` : value > 0 ? `↑ ${value}%` : label;
    }

    function barClass(level) {
        if (level === 'danger' || level === 'critical') return 'danger';
        if (level === 'warning' || level === 'medium') return 'warning';
        return 'good';
    }

    function pct(value, max) {
        if (!max) return 0;
        return Math.min(100, Math.round((value / max) * 100));
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderChart(model);
        renderResources(model);
        renderBottlenecks(model);
        renderOptimizations(model);
        renderSlowEndpoints(model);
        renderAlerts(model);
        renderInsights(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('performance-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'System performance monitoring and optimization';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — local dev and Jest health baseline; not production APM.`
                : base;
        }

        const badge = document.getElementById('performance-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 97}% confidence`;
            }
        }

        const updateEl = document.getElementById('performance-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }

        const uptimeBadge = document.getElementById('performance-badge-uptime');
        if (uptimeBadge) {
            if (model.dataSource === 'repository-audit') {
                uptimeBadge.textContent = `✅ ${o.passedTests ?? 500}/${o.totalTests ?? 500} Tests`;
            } else if (o.uptime != null) {
                uptimeBadge.textContent = `● ${o.uptime}% Uptime`;
            }
        }

        const throughputBadge = document.getElementById('performance-badge-throughput');
        if (throughputBadge) {
            if (model.dataSource === 'repository-audit') {
                throughputBadge.textContent = `📋 ${o.measuredBaselines ?? 33}/${o.sampleJsonFiles ?? 33} baselines`;
            } else if (o.throughput) {
                throughputBadge.textContent = `⚡ ${o.throughput}`;
            }
        }

        const realtimeBadge = document.getElementById('performance-badge-realtime');
        if (realtimeBadge) {
            realtimeBadge.textContent = model.dataSource === 'repository-audit'
                ? '📋 Measured baseline'
                : '📈 Real-time';
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};

        const labelMap = isAudit
            ? {
                'performance-stat-cpu': labels.cpuCurrent || 'Jest Suites',
                'performance-stat-memory': labels.memoryUsed || 'Sample Data',
                'performance-stat-throughput': labels.throughput || 'Tests Passing',
                'performance-stat-response': labels.avgResponseTime || 'Jest Runtime',
                'performance-stat-cache': labels.cacheHitRate || 'Schema Pass',
                'performance-stat-uptime': labels.uptime || 'Production Uptime'
            }
            : null;

        if (labelMap) {
            Object.entries(labelMap).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const map = isAudit
            ? {
                'performance-stat-cpu': formatMetric(o.cpuCurrent),
                'performance-stat-memory': o.memoryUsed != null
                    ? `${o.memoryUsed} ${o.memoryUnit || 'KB'}`
                    : '—',
                'performance-stat-throughput': o.throughput || '—',
                'performance-stat-response': formatMetric(o.jestRuntime || o.avgResponseTime),
                'performance-stat-cache': o.cacheHitRate != null ? `${o.cacheHitRate}%` : '—',
                'performance-stat-uptime': String(o.scannerIssuesOpen ?? 0)
            }
            : {
                'performance-stat-cpu': `${o.cpuCurrent ?? '—'}%`,
                'performance-stat-memory': o.memoryUsed != null ? `${o.memoryUsed} MB` : '—',
                'performance-stat-throughput': o.throughput || '—',
                'performance-stat-response': o.avgResponseTime || '—',
                'performance-stat-cache': o.cacheHitRate != null ? `${o.cacheHitRate}%` : '—',
                'performance-stat-uptime': o.uptime != null ? `${o.uptime}%` : '—'
            };

        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        const trends = {
            'performance-trend-cpu': { value: o.cpuTrend, invert: true },
            'performance-trend-memory': { value: o.memoryTrend, invert: false },
            'performance-trend-throughput': { value: o.throughputTrend, invert: false },
            'performance-trend-response': { value: o.responseTrend, invert: true }
        };
        Object.entries(trends).forEach(([id, { value, invert }]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (value == null) {
                el.textContent = '';
                el.hidden = true;
                return;
            }
            el.hidden = false;
            el.textContent = trendLabel(value, invert);
            el.className = `performance-stat-trend performance-trend ${trendClass(invert ? -(value || 0) : value)}`;
        });

        const peakEl = document.getElementById('performance-stat-cpu-peak');
        if (peakEl) {
            peakEl.textContent = o.cpuPeak != null ? `Peak ${o.cpuPeak}%` : '';
            peakEl.hidden = o.cpuPeak == null;
        }
        const errorEl = document.getElementById('performance-stat-error');
        if (errorEl) {
            errorEl.textContent = o.errorRate != null ? `${o.errorRate}% error rate` : '';
            errorEl.hidden = o.errorRate == null;
        }
    }

    function chartYMax(timeline) {
        const values = ['cpu', 'memory', 'diskIO', 'network']
            .flatMap((key) => timeline[key] || [])
            .filter((value) => Number.isFinite(value));
        if (!values.length) return 60;
        return Math.max(60, Math.ceil(Math.max(...values) / 10) * 10);
    }

    function buildChartDatasets(timeline, model) {
        const seriesLabels = timeline.seriesLabels || {};
        const isAudit = model?.dataSource === 'repository-audit';
        const datasets = [
            {
                label: seriesLabels.cpu || (isAudit ? 'Measured baselines' : 'CPU Usage %'),
                data: timeline.cpu || [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: seriesLabels.memory || (isAudit ? 'Sample JSON files' : 'Memory Usage %'),
                data: timeline.memory || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ];

        if ((timeline.diskIO || []).length) {
            datasets.push({
                label: seriesLabels.diskIO || 'Disk I/O %',
                data: timeline.diskIO,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        }
        if ((timeline.network || []).length) {
            datasets.push({
                label: seriesLabels.network || 'Network %',
                data: timeline.network,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        }

        return datasets;
    }

    function renderChart(model) {
        const canvas = document.getElementById('performanceMetricsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const timeline = model.metricsTimeline || {};
        const labels = timeline.labels || [];
        const datasets = buildChartDatasets(timeline, model);
        const yMax = chartYMax(timeline);

        if (metricsChart) {
            metricsChart.data.labels = labels;
            metricsChart.data.datasets = datasets;
            metricsChart.options.scales.y.max = yMax;
            metricsChart.update();
            return;
        }

        metricsChart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#e2e8f0', usePointStyle: true } },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: '#334155',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(51, 65, 85, 0.5)' }
                    },
                    y: {
                        min: 0,
                        max: yMax,
                        ticks: { color: '#94a3b8', stepSize: 10 },
                        grid: { color: 'rgba(51, 65, 85, 0.5)' }
                    }
                }
            }
        });
    }

    function renderResources(model) {
        const container = document.getElementById('performance-resources-bars');
        if (!container) return;
        const resources = model.systemResources || [];
        container.innerHTML = resources.map((item) => {
            const width = pct(item.value, item.max);
            const cls = barClass(item.level);
            const unit = item.unit || '%';
            const display = unit === 'MB' || unit === ' KB' || unit.startsWith(' ')
                ? `${item.value}${unit}${item.max ? ` / ${item.max}${unit.trim()}` : ''}`
                : `${item.value}${unit}${item.max ? ` / ${item.max}${unit}` : ''}`;
            return `
                <div class="performance-resource-item">
                    <div class="performance-resource-label">
                        <span>${escapeHtml(item.name)}</span>
                        <span>${escapeHtml(display)}</span>
                    </div>
                    <div class="performance-resource-track">
                        <span class="${cls}" style="width:${width}%"></span>
                    </div>
                </div>`;
        }).join('');
    }

    function renderBottlenecks(model) {
        const container = document.getElementById('performance-bottlenecks');
        if (!container) return;
        container.innerHTML = (model.bottlenecks || []).map((item) => `
            <div class="performance-bottleneck-card ${barClass(item.severity === 'high' ? 'critical' : item.severity)}">
                <div class="performance-bottleneck-title">${escapeHtml(item.title)}</div>
                <div class="performance-bottleneck-impact">${escapeHtml(item.impact)}</div>
                <div class="performance-bottleneck-rec">💡 ${escapeHtml(item.recommendation)}</div>
            </div>
        `).join('') || '<p class="performance-empty">No bottlenecks detected</p>';
    }

    function renderOptimizations(model) {
        const container = document.getElementById('performance-optimizations');
        if (!container) return;
        container.innerHTML = (model.optimizations || []).map((item) => `
            <div class="performance-opt-card">
                <div class="performance-opt-header">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="performance-opt-status ${item.status === 'applied' ? 'applied' : 'planned'}">${escapeHtml(item.status)}</span>
                </div>
                <div class="performance-opt-gain">${escapeHtml(item.gain)}</div>
            </div>
        `).join('') || '<p class="performance-empty">No optimizations logged</p>';
    }

    function renderSlowEndpoints(model) {
        const body = document.getElementById('performance-endpoints-body');
        if (!body) return;
        body.innerHTML = (model.slowEndpoints || []).map((row) => `
            <tr>
                <td><code>${escapeHtml(row.endpoint)}</code></td>
                <td>${escapeHtml(formatMetric(row.avgTime))}</td>
                <td>${escapeHtml(formatMetric(row.p95))}</td>
                <td>${row.requests == null ? '—' : Number(row.requests).toLocaleString()}</td>
                <td><span class="performance-endpoint-badge ${barClass(row.status === 'warning' ? 'warning' : 'good')}">${escapeHtml(row.status)}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="performance-empty">No endpoint metrics included</td></tr>';
    }

    function renderAlerts(model) {
        const container = document.getElementById('performance-alerts-list');
        if (!container) return;
        container.innerHTML = (model.alerts || []).map((alert) => `
            <div class="performance-alert ${barClass(alert.severity)} ${alert.resolved ? 'resolved' : ''}">
                <div class="performance-alert-header">
                    <strong>${escapeHtml(alert.title)}</strong>
                    <span>${escapeHtml(alert.time)}</span>
                </div>
                <p>${escapeHtml(alert.message)}</p>
                ${alert.resolved ? '<span class="performance-alert-resolved">Resolved</span>' : ''}
            </div>
        `).join('') || '<p class="performance-empty">No active alerts</p>';
    }

    function renderInsights(model) {
        const container = document.getElementById('performance-insights-grid');
        if (!container) return;
        container.innerHTML = (model.insights || []).map((item) => `
            <div class="performance-insight-card priority-${escapeHtml(item.priority)}">
                <div class="performance-insight-priority">${escapeHtml(item.priority)}</div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.description)}</p>
                <div class="performance-insight-impact">${escapeHtml(item.impact)}</div>
            </div>
        `).join('') || '<p class="performance-empty">No AI insights included in this payload.</p>';
    }

    function renderActivity(model) {
        const body = document.getElementById('performance-activity-body');
        if (!body) return;
        body.innerHTML = (model.activity || []).map((row) => `
            <tr>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.event)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td><span class="performance-activity-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="performance-empty">No activity included in this payload.</td></tr>';
    }

    let actionsBound = false;

    function bindActions() {
        if (actionsBound) return;
        actionsBound = true;

        document.getElementById('performance-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastPerformanceModel');
            } catch { /* ignore */ }
            window.__performanceModel = null;
            metricsChart = null;
            await loadPerformanceSample();
        });
        document.getElementById('performance-load-sample')?.addEventListener('click', loadPerformanceSample);
        document.getElementById('performance-export-json')?.addEventListener('click', () => {
            if (!window.__performanceModel) return;
            const blob = new Blob([JSON.stringify(window.__performanceModel, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `performance-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            window.showNotification?.('✅ Performance data exported', 'success');
        });
        document.getElementById('performance-import-json')?.addEventListener('click', () => {
            document.getElementById('performance-import-file')?.click();
        });
        document.getElementById('performance-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyPerformanceModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Performance data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid performance JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });
    }

    function applyPerformanceModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized performance payload');
        if (isStalePerformanceModel(model)) {
            throw new Error('Stale performance fiction rejected — load repository-audit sample');
        }
        window.__performanceModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'performance'\"]");
            window.showSection('performance', navLink);
        }

        try {
            localStorage.setItem('lastPerformanceModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported performance',
                savedAt: new Date().toISOString()
            }));
        } catch {
            /* ignore */
        }
    }

    function restoreSavedPerformanceModel() {
        try {
            const raw = localStorage.getItem('lastPerformanceModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.overview || isStalePerformanceModel(model)) {
                localStorage.removeItem('lastPerformanceModel');
                return false;
            }
            window.__performanceModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadPerformanceSample() {
        const root = document.getElementById('performance-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyPerformanceModel(await response.json(), 'performance-sample.json');
            window.showNotification?.('✅ Loaded performance sample', 'success');
        } catch (error) {
            console.error('Failed to load performance sample:', error);
            window.showNotification?.('❌ Failed to load performance sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializePerformancePage(forceRefresh = false) {
        const root = document.getElementById('performance-root');
        if (!root) return;

        if (window.__performanceModel && !forceRefresh) {
            if (isStalePerformanceModel(window.__performanceModel)) {
                window.__performanceModel = null;
                metricsChart = null;
                try { localStorage.removeItem('lastPerformanceModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__performanceModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            try {
                localStorage.removeItem('lastPerformanceModel');
            } catch {
                /* ignore */
            }
            window.__performanceModel = null;
        }

        root.classList.add('loading');
        try {
            const model = await fetchPerformanceData();
            if (model) {
                window.__performanceModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedPerformanceModel()) {
                return;
            }

            await loadPerformanceSample();
        } catch (error) {
            console.error('Failed to initialize performance page:', error);
            try {
                await loadPerformanceSample();
                return;
            } catch {
                window.showNotification?.('❌ Failed to load performance data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializePerformancePage = initializePerformancePage;
    window.loadPerformanceSample = loadPerformanceSample;
    window.applyPerformanceModel = applyPerformanceModel;
})();
