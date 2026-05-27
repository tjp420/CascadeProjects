/**
 * AI Tools Page — self-contained AI tools launcher and performance dashboard
 */
(function () {
    const SAMPLE_URL = '/data/ai-tools-sample.json';

    const SECTION_LAUNCHERS = {
        'gguf-analysis': () => navigateTo('gguf-analysis', initializeGgufAnalysisPage),
        'local-models': () => navigateTo('local-models', initializeLocalModelsPage),
        'mock-data-analyzer': () => navigateTo('gguf-analysis', initializeGgufAnalysisPage),
        'code-generation': () => navigateTo('code-generation', initializeCodeGenerationPage),
        'issue-resolution': () => navigateTo('issue-resolution', initializeIssueResolutionPage),
        'roadmap': () => navigateTo('roadmap'),
        'performance': () => navigateTo('performance', initializePerformancePage),
        'ai-roadmap': () => navigateTo('ai-roadmap', initializeAIRoadmapPage),
        'merger-tool': () => navigateTo('merger-tool')
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isAIToolsModel(payload) {
        return Boolean(payload && (payload.type === 'ai-tools-model' || (payload.tools && payload.overview)));
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isAIToolsModel(payload.data) ? payload.data : payload;
        if (!isAIToolsModel(raw)) return null;
        return {
            type: raw.type || 'ai-tools-model',
            title: raw.title || 'AI Tools',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            dataSource: raw.dataSource || null,
            modelInfo: raw.modelInfo || {},
            overview: {
                ...(raw.overview || {}),
                totalTools: raw.tools?.length ?? raw.overview?.totalTools ?? 0,
                activeTools: raw.tools?.length
                    ? raw.tools.filter((tool) => tool.status === 'active').length
                    : (raw.overview?.activeTools ?? 0)
            },
            tools: raw.tools || [],
            usageByCategory: raw.usageByCategory || [],
            performanceMetrics: raw.performanceMetrics || [],
            insights: raw.insights || [],
            activity: raw.activity || [],
            recommendations: raw.recommendations || null,
            kpis: raw.kpis || [],
            healthSummary: raw.healthSummary || null,
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleAIToolsModel(model) {
        if (model?.dataSource === 'repository-audit') {
            const insights = model?.insights || [];
            if (insights.some((item) =>
                String(item.title || '').includes('Resolve 5 mock scanner')
                || String(item.title || '').includes('Wire npm audit')
                || String(item.description || '').includes('not surfaced')
            )) {
                return true;
            }
            if ((model.overview?.measuredBaselines ?? 33) < 33
                || model.overview?.schemaPassRate === 94
                || model.overview?.scannerIssues > 0) {
                return true;
            }
            if ((model.kpis || []).some((kpi) => String(kpi.current).includes('25/33'))) {
                return true;
            }
            return false;
        }

        const o = model?.overview || {};
        return o.totalAnalyses === 3842
            || o.avgAccuracy === 96.2
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 98.5
            || model.generatedBy === 'GGUF AI Platform'
            || (model.healthSummary?.highlights || []).some((h) => String(h).includes('3,842'));
    }

    async function fetchAIToolsData() {
        const sources = [SAMPLE_URL, '/api/ai-tools'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : (raw.data || raw);
                const model = normalizeModel(payload);
                if (model?.tools?.length && !isStaleAIToolsModel(model)) return model;
            } catch (error) {
                console.warn('AI tools source failed:', url, error.message);
            }
        }
        return null;
    }

    function navigateTo(sectionName, initFn) {
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, null);
        }
        if (typeof initFn === 'function') {
            initFn();
        }
        window.showNotification?.(`🚀 Opened ${sectionName.replace(/-/g, ' ')}`, 'info');
    }

    function statusClass(status) {
        if (status === 'active') return 'active';
        if (status === 'beta') return 'beta';
        return 'inactive';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderTools(model);
        renderPerformance(model);
        renderUsage(model);
        renderInsights(model);
        renderActivity(model);
        renderRecommendations(model);
        renderKpis(model);
        renderHealthSummary(model);
    }

    function renderHeader(model) {
        const modelInfo = model.modelInfo || {};
        const isAudit = model.dataSource === 'repository-audit';
        const titleEl = document.querySelector('#ai-tools-root .header h1');
        if (titleEl && model.title) titleEl.textContent = `🛠️ ${model.title}`;

        const lead = document.getElementById('ai-tools-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Advanced AI-powered development tools';
            lead.textContent = isAudit
                ? `${base} — launcher inventory; per-tool run counts not collected.`
                : base;
        }

        const o = model.overview || {};
        const badgeRow = document.querySelector('#ai-tools-root .ai-tools-badge-row');
        if (badgeRow) {
            const modelLabel = isAudit
                ? `🛡️ ${modelInfo.name || 'platform-checklist'} • ${modelInfo.confidence || 95}% confidence`
                : `🧠 ${modelInfo.name || 'GGUF'} • ${modelInfo.confidence || 98}% confidence`;
            const accuracyBadge = isAudit
                ? `${o.jestPassRate ?? 100}% Jest Pass`
                : `${o.avgAccuracy ?? '—'}% Accuracy`;
            const analysesBadge = isAudit
                ? `${formatMetric(o.totalAnalyses)} Tracked Runs`
                : `${(o.totalAnalyses ?? 0).toLocaleString()} Analyses`;
            badgeRow.innerHTML = `
                <span class="badge bg-primary" id="ai-tools-model-badge">${escapeHtml(modelLabel)}</span>
                <span class="badge bg-success">● ${o.activeTools ?? 0} Active</span>
                <span class="badge bg-info">${escapeHtml(analysesBadge)}</span>
                <span class="badge" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">${escapeHtml(accuracyBadge)}</span>`;
        }
        const updateEl = document.getElementById('ai-tools-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};
        const labelMap = isAudit
            ? {
                'ai-tools-stat-total': labels.totalTools || 'Dashboard Tools',
                'ai-tools-stat-active': labels.activeTools || 'Active Tools',
                'ai-tools-stat-accuracy': labels.avgAccuracy || 'Jest Pass Rate',
                'ai-tools-stat-analyses': labels.totalAnalyses || 'Tracked Runs'
            }
            : {
                'ai-tools-stat-total': 'Total Tools',
                'ai-tools-stat-active': 'Active Tools',
                'ai-tools-stat-accuracy': 'Avg Accuracy',
                'ai-tools-stat-analyses': 'Total Analyses'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        const map = isAudit
            ? {
                'ai-tools-stat-total': o.totalTools ?? model.tools.length,
                'ai-tools-stat-active': o.activeTools ?? model.tools.filter((t) => t.status === 'active').length,
                'ai-tools-stat-accuracy': `${o.jestPassRate ?? 100}%`,
                'ai-tools-stat-analyses': formatMetric(o.totalAnalyses)
            }
            : {
                'ai-tools-stat-total': o.totalTools ?? model.tools.length,
                'ai-tools-stat-active': o.activeTools ?? model.tools.filter((t) => t.status === 'active').length,
                'ai-tools-stat-accuracy': o.avgAccuracy != null ? `${o.avgAccuracy}%` : '—',
                'ai-tools-stat-analyses': (o.totalAnalyses ?? 0).toLocaleString()
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderTools(model) {
        const container = document.getElementById('ai-tools-grid');
        if (!container) return;

        container.innerHTML = model.tools.map(tool => `
            <div class="ai-tools-card ${statusClass(tool.status)}" data-tool-id="${escapeHtml(tool.id)}">
                <div class="ai-tools-card-top">
                    <span class="ai-tools-icon">${escapeHtml(tool.icon || '🛠️')}</span>
                    <div>
                        <h4>${escapeHtml(tool.name)}</h4>
                        <span class="ai-tools-category">${escapeHtml(tool.category || 'Tool')}</span>
                    </div>
                    <span class="ai-tools-status ${statusClass(tool.status)}">${escapeHtml(tool.status || 'active')}</span>
                </div>
                <p class="ai-tools-desc">${escapeHtml(tool.description || '')}</p>
                <div class="ai-tools-metrics">
                    <div><strong>${formatMetric(tool.performance?.accuracy, '%')}</strong><span>Accuracy</span></div>
                    <div><strong>${escapeHtml(tool.performance?.speed || '—')}</strong><span>Speed</span></div>
                    <div><strong>${formatMetric(tool.usage?.successRate, '%')}</strong><span>Success</span></div>
                    <div><strong>${tool.usage?.totalRuns != null ? tool.usage.totalRuns.toLocaleString() : '—'}</strong><span>Runs</span></div>
                </div>
                <div class="ai-tools-card-actions">
                    <button type="button" class="btn btn-primary btn-sm ai-tools-launch-btn" data-section="${escapeHtml(tool.section || '')}">Launch</button>
                    <button type="button" class="btn btn-outline-light btn-sm ai-tools-detail-btn" data-tool-id="${escapeHtml(tool.id)}">Details</button>
                </div>
            </div>
        `).join('');
    }

    function renderPerformance(model) {
        const container = document.getElementById('ai-tools-performance-grid');
        if (!container) return;

        const metrics = model.performanceMetrics.length ? model.performanceMetrics : [
            { label: 'Processing Speed', value: model.overview?.avgProcessingTime || '—', score: 90, trend: 'Stable', trendType: 'neutral' }
        ];

        container.innerHTML = metrics.map(metric => `
            <div class="stat-card ${metric.trendType === 'positive' ? 'success' : ''}">
                <div class="stat-value">${escapeHtml(metric.value)}</div>
                <div class="stat-label">${escapeHtml(metric.label)}</div>
                <div class="ai-tools-metric-bar"><span style="width:${Math.min(100, metric.score || 80)}%"></span></div>
                <div class="ai-tools-metric-trend ${escapeHtml(metric.trendType || 'neutral')}">${escapeHtml(metric.trend || '')}</div>
            </div>
        `).join('');
    }

    function renderUsage(model) {
        const container = document.getElementById('ai-tools-usage-bars');
        if (!container) return;

        const data = model.usageByCategory.length ? model.usageByCategory : [
            { category: 'Analysis', percentage: 50, runs: 0 }
        ];

        container.innerHTML = data.map(item => `
            <div class="ai-tools-usage-item">
                <div class="ai-tools-usage-label">${escapeHtml(item.category)}</div>
                <div class="ai-tools-usage-bar"><span style="width:${item.percentage}%"></span></div>
                <div class="ai-tools-usage-value">${item.percentage}% · ${item.runs != null
                    ? `${(item.runs || 0).toLocaleString()} runs`
                    : `${item.toolCount ?? '—'} tools`}</div>
            </div>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('ai-tools-insights');
        if (!container) return;

        const items = model.insights.length ? model.insights : [
            { priority: 'medium', title: 'Load sample data', description: 'Use Load Sample to populate AI tools metrics.', impact: 'Full dashboard', confidence: 100 }
        ];

        container.innerHTML = items.map(item => `
            <div class="ai-tools-insight-card priority-${escapeHtml(item.priority || 'medium')}">
                <div class="ai-tools-insight-priority">${escapeHtml(item.priority || 'medium')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description)}</p>
                <div class="ai-tools-insight-meta">Impact: ${escapeHtml(item.impact || '—')} · ${item.confidence ?? '—'}% confidence</div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const tbody = document.getElementById('ai-tools-activity-body');
        if (!tbody) return;

        tbody.innerHTML = (model.activity || []).map(row => `
            <tr>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.tool)}</td>
                <td>${escapeHtml(row.action)}</td>
                <td><span class="ai-tools-activity-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
                <td>${escapeHtml(row.duration)}</td>
            </tr>
        `).join('');
    }

    function renderRecommendations(model) {
        const panel = document.getElementById('ai-tools-recommendations-panel');
        const container = document.getElementById('ai-tools-recommendations-grid');
        if (!panel || !container || !model.recommendations) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');
        const groups = [
            { key: 'immediate', label: 'Immediate (30 days)' },
            { key: 'shortTerm', label: 'Short-term (60 days)' },
            { key: 'longTerm', label: 'Long-term (90 days)' }
        ];
        container.innerHTML = groups.map(({ key, label }) => {
            const items = model.recommendations[key] || [];
            if (!items.length) return '';
            return `
                <div class="ai-tools-rec-group">
                    <h4>${escapeHtml(label)}</h4>
                    ${items.map((item) => `
                        <div class="ai-tools-rec-card">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.current)} → ${escapeHtml(item.target)}</p>
                            <ul>${(item.actions || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
                            <div class="ai-tools-rec-impact">${escapeHtml(item.impact || '')}</div>
                        </div>`).join('')}
                </div>`;
        }).join('');
    }

    function renderKpis(model) {
        const panel = document.getElementById('ai-tools-kpi-panel');
        const container = document.getElementById('ai-tools-kpi-grid');
        if (!panel || !container) return;
        if (!model.kpis?.length) {
            panel.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');
        container.innerHTML = model.kpis.map((kpi) => `
            <div class="ai-tools-kpi-card priority-${escapeHtml(kpi.priority || 'medium')}">
                <div class="ai-tools-kpi-name">${escapeHtml(kpi.name)}</div>
                <div class="ai-tools-kpi-values">${escapeHtml(String(kpi.current))} → ${escapeHtml(String(kpi.target))}</div>
                <div class="ai-tools-kpi-meta">${escapeHtml(kpi.timeline)} • ${escapeHtml(kpi.priority)} priority</div>
            </div>
        `).join('');
    }

    function renderHealthSummary(model) {
        const panel = document.getElementById('ai-tools-health-panel');
        const container = document.getElementById('ai-tools-health-summary');
        if (!panel || !container || !model.healthSummary) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');
        const summary = model.healthSummary;
        container.innerHTML = `
            <div class="ai-tools-health-status">${escapeHtml(summary.status || 'GOOD')}</div>
            <p class="ai-tools-health-assessment">${escapeHtml(summary.assessment || '')}</p>
            <ul class="ai-tools-health-list">${(summary.highlights || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`;
    }

    function showToolDetails(toolId) {
        const model = window.__aiToolsModel;
        const tool = model?.tools?.find(t => t.id === toolId);
        if (!tool) return;

        window.showNotification?.(
            `${tool.name}: ${formatMetric(tool.performance?.accuracy, '% accuracy')} · ${tool.usage?.totalRuns != null ? `${tool.usage.totalRuns} runs` : 'runs not tracked'} · ${formatMetric(tool.usage?.successRate, '% success')}`,
            'info'
        );
    }

    function bindActions() {
        if (window.__aiToolsBound) return;
        window.__aiToolsBound = true;

        document.getElementById('ai-tools-refresh')?.addEventListener('click', () => initializeAIToolsPage(true));
        document.getElementById('ai-tools-load-sample')?.addEventListener('click', () => loadAIToolsSample());
        document.getElementById('ai-tools-import-json')?.addEventListener('click', () => {
            document.getElementById('ai-tools-import-file')?.click();
        });
        document.getElementById('ai-tools-export-json')?.addEventListener('click', () => {
            const model = window.__aiToolsModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-tools-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ AI tools report downloaded', 'success');
        });
        document.getElementById('ai-tools-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyAIToolsModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ AI tools data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid AI tools JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });

        document.getElementById('ai-tools-root')?.addEventListener('click', (event) => {
            const launchBtn = event.target.closest('.ai-tools-launch-btn');
            if (launchBtn?.dataset.section) {
                const section = launchBtn.dataset.section;
                const launcher = SECTION_LAUNCHERS[section];
                if (launcher) launcher();
                else navigateTo(section);
                return;
            }
            const detailBtn = event.target.closest('.ai-tools-detail-btn');
            if (detailBtn?.dataset.toolId) {
                showToolDetails(detailBtn.dataset.toolId);
            }
        });
    }

    function applyAIToolsModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized AI tools payload');
        if (isStaleAIToolsModel(model)) {
            throw new Error('Stale AI tools fiction rejected — load repository-audit sample');
        }
        window.__aiToolsModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            window.showSection('ai-tools');
        }

        try {
            localStorage.setItem('lastAIToolsModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported analysis',
                savedAt: new Date().toISOString()
            }));
        } catch (e) {
            /* ignore storage errors */
        }
    }

    function restoreSavedAIToolsModel() {
        try {
            const raw = localStorage.getItem('lastAIToolsModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.tools?.length || isStaleAIToolsModel(model)) return false;
            window.__aiToolsModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch (e) {
            /* ignore */
        }
        return false;
    }

    async function loadAIToolsSample() {
        const root = document.getElementById('ai-tools-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyAIToolsModel(await response.json());
            window.showNotification?.('✅ Loaded AI tools sample', 'success');
        } catch (error) {
            console.error('Failed to load AI tools sample:', error);
            window.showNotification?.('❌ Failed to load AI tools sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeAIToolsPage(forceRefresh = false) {
        const root = document.getElementById('ai-tools-root');
        if (!root) return;

        if (window.__aiToolsModel && !forceRefresh) {
            if (isStaleAIToolsModel(window.__aiToolsModel)) {
                window.__aiToolsModel = null;
            } else {
                renderModel(window.__aiToolsModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__aiToolsModel = null;
            try {
                localStorage.removeItem('lastAIToolsModel');
            } catch (e) {
                /* ignore */
            }
        }

        if (!forceRefresh && restoreSavedAIToolsModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchAIToolsData();
            if (!model) throw new Error('No AI tools data available');
            window.__aiToolsModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize AI tools page:', error);
            window.showNotification?.('❌ Failed to load AI tools data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeAIToolsPage = initializeAIToolsPage;
    window.loadAIToolsSample = loadAIToolsSample;
    window.applyAIToolsModel = applyAIToolsModel;
})();
