/**
 * Debt Calculator Page — technical debt calculation and analysis
 */
(function () {
    const SAMPLE_URL = '/data/debt-calculator-sample.json';
    let filterCategory = 'all';
    let expandedCategoryId = null;
    let timelineChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isDebtCalculatorModel(payload) {
        return Boolean(payload && (
            payload.type === 'debt-calculator-model' ||
            (Array.isArray(payload.categories) && payload.overview?.debtScore != null)
        ));
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isDebtCalculatorModel(payload.data) ? payload.data : payload;
        if (!isDebtCalculatorModel(raw)) return null;
        return {
            type: raw.type || 'debt-calculator-model',
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'GGUF AI Platform',
            modelInfo: raw.modelInfo || {},
            overview: raw.overview || {},
            categories: raw.categories || [],
            recommendations: raw.recommendations || [],
            timeline: raw.timeline || {},
            impactAnalysis: raw.impactAnalysis || [],
            priorityList: raw.priorityList || [],
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            dataSource: raw.dataSource,
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleDebtCalculatorModel(model) {
        if (model?.dataSource === 'repository-audit') {
            const o = model?.overview || {};
            const recs = model?.recommendations || [];
            const categories = model?.categories || [];
            if (String(o.jestTests || '').includes('500/500') || String(o.jestTests || '').includes('558')) return true;
            if (recs.some((item) =>
                String(item.title || '').includes('Resolve 5 mock scanner')
                || String(item.title || '').includes('Wire npm audit')
                || String(item.title || '').includes('Enable Istanbul in CI')
                || String(item.description || '').includes('not surfaced')
                || String(item.description || '').includes('npm test uses --no-coverage')
            )) {
                return true;
            }
            if (categories.some((cat) =>
                (cat.issues || []).some((issue) =>
                    String(issue.type || '').includes('npm audit not wired')
                    || String(issue.type || '').includes('Docker phase2 not in CI')
                    || String(issue.type || '').includes('All 33 samples')
                    || (String(issue.type || '').includes('Schema pass rate') && issue.count === 31)
                    || (String(issue.type || '').includes('Jest suite green') && issue.count === 558)
                )
            )) {
                return true;
            }
            if ((model.insights || []).some((item) => String(item.title || '').includes('500/500 Jest'))) {
                return true;
            }
            if (model.timeline?.currentDebt === 18 && o.fictionSamplesRemaining === 0) return true;
            return false;
        }

        const o = model?.overview || {};
        return o.totalDebt === 198
            || o.totalCost === 75300
            || o.totalHours === 502
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.generatedBy === 'GGUF AI Platform'
    }

    async function fetchDebtCalculatorData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.categories?.length && !isStaleDebtCalculatorModel(model)) return model;
            }
        } catch (error) {
            console.warn('Debt calculator sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/debt-calculator');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.categories?.length && !isStaleDebtCalculatorModel(model)) return model;
            }
        } catch (error) {
            console.warn('Debt calculator API failed:', error.message);
        }
        return null;
    }

    function severityClass(score) {
        if (score >= 80) return 'critical';
        if (score >= 60) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    function severityLabel(score) {
        if (score >= 80) return 'Critical';
        if (score >= 60) return 'High';
        if (score >= 40) return 'Medium';
        return 'Low';
    }

    function trendClass(trend) {
        if (trend === 'increasing') return 'negative';
        if (trend === 'decreasing') return 'positive';
        return 'neutral';
    }

    function impactBarClass(value) {
        if (value >= 60) return 'danger';
        if (value >= 35) return 'warning';
        return 'good';
    }

    function priorityClass(priority) {
        if (priority === 'critical' || priority === 'danger' || priority === 'high') return 'high';
        if (priority === 'medium' || priority === 'warning') return 'medium';
        return 'low';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderScores(model);
        renderTimeline(model);
        renderCategories(model);
        renderTwoCol(model);
        renderInsights(model);
        renderQuickActions(model);
    }

    function renderHeader(model) {
        const isAudit = model.dataSource === 'repository-audit';
        const lead = document.getElementById('debt-calculator-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Technical debt calculation and analysis';
            lead.textContent = isAudit
                ? `${base} — measured items only; no $75K / 502h fiction.`
                : base;
        }
        const badge = document.getElementById('debt-calculator-model-badge');
        if (badge) {
            badge.textContent = isAudit
                ? `🛡️ ${model.modelInfo?.name || 'platform-checklist'} • ${model.modelInfo?.confidence || 95}% confidence`
                : `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
        }
        const updateEl = document.getElementById('debt-calculator-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};

        if (isAudit) {
            const labelMap = {
                'debt-stat-total': labels.totalDebt || 'Debt Items',
                'debt-stat-critical': labels.criticalDebt || 'Scanner Issues',
                'debt-stat-hours': labels.totalHours || 'Est. Hours',
                'debt-stat-cost': labels.totalCost || 'Est. Cost'
            };
            Object.entries(labelMap).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const map = {
            'debt-stat-total': o.totalDebt ?? model.categories.reduce((s, c) => s + (c.totalDebt || 0), 0),
            'debt-stat-critical': o.criticalDebt ?? model.categories.reduce((s, c) => s + (c.criticalDebt || 0), 0),
            'debt-stat-hours': o.totalHours ?? '—',
            'debt-stat-cost': o.totalCost != null ? `$${o.totalCost.toLocaleString()}` : '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderScores(model) {
        const o = model.overview || {};
        const debtScore = document.getElementById('debt-score-value');
        const healthScore = document.getElementById('debt-health-value');
        const severity = document.getElementById('debt-severity-label');
        const maintainability = document.getElementById('debt-maintainability');
        const testCoverage = document.getElementById('debt-test-coverage');
        const documentation = document.getElementById('debt-documentation');

        if (debtScore) debtScore.textContent = o.debtScore ?? '—';
        if (healthScore) healthScore.textContent = o.healthScore != null ? `${o.healthScore}%` : '—';
        if (severity) {
            severity.textContent = severityLabel(o.debtScore ?? 0);
            severity.className = `debt-severity ${severityClass(o.debtScore ?? 0)}`;
        }
        if (maintainability) maintainability.textContent = o.maintainability != null ? `${o.maintainability}%` : '—';
        if (testCoverage) testCoverage.textContent = o.testCoverage != null ? `${o.testCoverage}%` : '—';
        if (documentation) documentation.textContent = o.documentation != null ? `${o.documentation}%` : '—';
    }

    function renderTimeline(model) {
        const t = model.timeline || {};
        const stats = {
            'debt-timeline-current': t.currentDebt ?? '—',
            'debt-timeline-projected': t.projectedDebt ?? '—',
            'debt-timeline-reduction': t.reductionPotential ?? '—',
            'debt-timeline-roi': t.roi != null ? `${t.roi}%` : '—'
        };
        Object.entries(stats).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        const canvas = document.getElementById('debtTimelineChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (timelineChart) {
            timelineChart.destroy();
            timelineChart = null;
        }

        timelineChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: t.labels || [],
                datasets: [
                    {
                        label: 'Current',
                        data: t.current || [],
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: 'Projected',
                        data: t.projected || [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        borderDash: [6, 4],
                        tension: 0.35,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.06)' } }
                }
            }
        });
    }

    function renderCategories(model) {
        const container = document.getElementById('debt-categories-grid');
        if (!container) return;

        const categories = filterCategory === 'all'
            ? model.categories
            : model.categories.filter(c => c.id === filterCategory);

        container.innerHTML = categories.map(cat => {
            const expanded = expandedCategoryId === cat.id;
            return `
                <div class="debt-category-card ${severityClass(cat.criticalDebt > 15 ? 80 : cat.criticalDebt > 8 ? 60 : 40)}" data-category-id="${escapeHtml(cat.id)}">
                    <div class="debt-category-top">
                        <span class="debt-category-icon">${escapeHtml(cat.icon || '📊')}</span>
                        <div>
                            <h4>${escapeHtml(cat.name)}</h4>
                            <span class="debt-category-trend ${trendClass(cat.trend)}">${escapeHtml(cat.trend || 'stable')}</span>
                        </div>
                        <div class="debt-category-counts">
                            <strong>${cat.totalDebt ?? 0}</strong>
                            <span>${cat.criticalDebt ?? 0} critical</span>
                        </div>
                    </div>
                    <div class="debt-category-meta">
                        <span>⏱ ${cat.estimatedHours ?? 0}h</span>
                        <span>💰 $${(cat.cost ?? 0).toLocaleString()}</span>
                    </div>
                    <div class="debt-category-actions">
                        <button type="button" class="btn btn-outline-light btn-sm debt-toggle-btn" data-category-id="${escapeHtml(cat.id)}">${expanded ? 'Hide' : 'View'} Issues</button>
                    </div>
                    ${expanded ? `
                        <div class="debt-issues-list">
                            ${(cat.issues || []).map(issue => `
                                <div class="debt-issue-item">
                                    <strong>${escapeHtml(issue.type)}</strong>
                                    <span>${issue.count ?? 0} items · ${issue.hours ?? 0}h</span>
                                    ${issue.file ? `<code>${escapeHtml(issue.file)}</code>` : ''}
                                    ${issue.status === 'resolved' ? '<span class="debt-resolved-badge">resolved</span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function renderTwoCol(model) {
        renderRecommendations(model);
        renderImpact(model);
        renderPriority(model);
    }

    function renderRecommendations(model) {
        const container = document.getElementById('debt-recommendations');
        if (!container) return;

        container.innerHTML = (model.recommendations || []).map(rec => `
            <div class="debt-rec-card priority-${priorityClass(rec.priority)}">
                <div class="debt-rec-header">
                    <span>${escapeHtml(rec.icon || '💡')}</span>
                    <h4>${escapeHtml(rec.title)}</h4>
                    <span class="debt-rec-priority">${escapeHtml(rec.priority || 'medium')}</span>
                </div>
                <p>${escapeHtml(rec.description || '')}</p>
                <div class="debt-rec-footer">
                    <span>${rec.hours ?? 0}h · $${(rec.cost ?? 0).toLocaleString()}</span>
                    <span>Impact: ${escapeHtml(rec.impact || '—')}</span>
                </div>
            </div>
        `).join('') || '<p class="debt-empty">No recommendations.</p>';
    }

    function renderImpact(model) {
        const container = document.getElementById('debt-impact-list');
        if (!container) return;

        container.innerHTML = (model.impactAnalysis || []).map(item => `
            <div class="debt-impact-card">
                <div class="debt-impact-header">
                    <strong>${escapeHtml(item.area)}</strong>
                    <span class="debt-impact-severity">${escapeHtml(item.severity || '—')}</span>
                </div>
                <div class="debt-impact-bars">
                    ${[
                        { label: 'Speed', value: item.speedImpact },
                        { label: 'Bugs', value: item.bugImpact },
                        { label: 'Morale', value: item.moraleImpact }
                    ].map(bar => `
                        <div class="debt-impact-bar-item">
                            <span>${bar.label}</span>
                            <div class="debt-impact-track"><span class="${impactBarClass(bar.value)}" style="width:${bar.value ?? 0}%"></span></div>
                            <span>${bar.value ?? 0}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('') || '<p class="debt-empty">No impact data.</p>';
    }

    function renderPriority(model) {
        const container = document.getElementById('debt-priority-list');
        if (!container) return;

        const max = Math.max(...(model.priorityList || []).map(p => p.count), 1);
        container.innerHTML = (model.priorityList || []).map(item => `
            <div class="debt-priority-item">
                <div class="debt-priority-label">
                    <span>${escapeHtml(item.category)}</span>
                    <span class="debt-priority-badge ${priorityClass(item.priority)}">${item.count}</span>
                </div>
                <div class="debt-priority-track"><span style="width:${Math.round((item.count / max) * 100)}%"></span></div>
            </div>
        `).join('') || '<p class="debt-empty">No priority data.</p>';
    }

    function renderInsights(model) {
        const container = document.getElementById('debt-insights-grid');
        if (!container) return;

        container.innerHTML = (model.insights || []).map(item => `
            <div class="debt-insight-card priority-${escapeHtml(item.priority || 'low')}">
                <div class="debt-insight-priority">${escapeHtml(item.priority || 'info')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description || '')}</p>
                <div class="debt-insight-impact">${escapeHtml(item.impact || '')}</div>
            </div>
        `).join('') || '<p class="debt-empty">No insights.</p>';
    }

    function renderQuickActions(model) {
        const container = document.getElementById('debt-quick-actions');
        if (!container) return;

        container.innerHTML = (model.quickActions || []).map(action => `
            <button type="button" class="debt-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${escapeHtml(action.icon || '⚡')}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function navigateTo(sectionName) {
        const navLink = document.querySelector(`.nav-link[onclick*="'${sectionName}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, navLink);
        }
    }

    function mergeScanIntoDebtModel(model, report) {
        const overview = report.analysisOverview || {};
        const quality = report.qualityMetrics || {};
        const issues = report.detectedIssues || [];
        const openIssues = overview.issuesDetected ?? issues.length;
        const highIssues = issues.filter((i) => i.severity === 'high').length;
        const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
        const schemaLabel = overview.pageSampleSpecsLabel
            || (overview.schemaFilesPassed != null && overview.schemaFilesChecked != null
                ? `${overview.schemaFilesPassed}/${overview.schemaFilesChecked}`
                : null);

        const merged = {
            ...model,
            generatedAt: new Date().toISOString(),
            generatedBy: report.generatedBy || 'mock-data-scanner (repository-audit)',
            dataSource: 'repository-audit',
            overview: {
                ...model.overview,
                debtScore: overview.dataQualityScore ?? model.overview?.debtScore,
                healthScore: overview.dataQualityScore ?? model.overview?.healthScore,
                scannerIssues: openIssues,
                testCoverage: quality.schemaCompliance != null
                    ? `${quality.schemaCompliance}%`
                    : model.overview?.testCoverage,
                notes: overview.notes || model.overview?.notes
            },
            categories: (model.categories || []).map((cat) => {
                if (cat.id !== 'mock_scanner') return cat;
                return {
                    ...cat,
                    totalDebt: openIssues,
                    criticalDebt: highIssues,
                    trend: openIssues === 0 ? 'decreasing' : 'stable',
                    issues: [
                        {
                            type: 'Open scanner issues',
                            count: openIssues,
                            hours: null,
                            file: report.inferenceMeta?.scanEngine || 'mock-data-scanner',
                            status: openIssues === 0 ? 'resolved' : undefined
                        },
                        {
                            type: 'Schema pass rate',
                            count: overview.schemaFilesPassed ?? 0,
                            hours: null,
                            file: schemaLabel || 'PAGE_SAMPLE_SPECS',
                            status: (overview.schemaFilesPassed === overview.schemaFilesChecked) ? 'resolved' : undefined
                        },
                        {
                            type: 'Files scanned',
                            count: overview.totalMockFiles ?? report.inferenceMeta?.scannedFiles ?? 0,
                            hours: null,
                            file: overview.totalMockDataSize || '—'
                        },
                        ...(mediumIssues > 0 ? [{
                            type: 'Medium severity findings',
                            count: mediumIssues,
                            hours: null,
                            file: 'simplebeacon scan'
                        }] : [])
                    ]
                };
            }),
            insights: [
                {
                    priority: openIssues > 0 ? 'medium' : 'low',
                    title: 'Live mock-data-scanner run',
                    description: `${overview.totalMockFiles ?? 0} files · ${overview.dataQualityScore ?? '—'}% quality · ${openIssues} open issue(s)`,
                    impact: schemaLabel || 'Measured scan'
                },
                ...(model.insights || []).filter((item) => !String(item.title || '').includes('Live mock-data-scanner'))
            ].slice(0, 5)
        };

        merged.overview.totalDebt = merged.categories.reduce((sum, cat) => sum + (cat.totalDebt || 0), 0);
        merged.overview.criticalDebt = merged.categories.reduce((sum, cat) => sum + (cat.criticalDebt || 0), 0);
        return merged;
    }

    async function runDebtCalculatorAnalysis() {
        const root = document.getElementById('debt-calculator-root');
        const btn = document.getElementById('debt-run-analysis');
        root?.classList.add('loading');
        if (btn) btn.disabled = true;
        window.showNotification?.('🔍 Running mock-data-scanner analysis…', 'info');

        try {
            let base = window.__debtCalculatorModel;
            if (!base || isStaleDebtCalculatorModel(base)) {
                base = await fetchDebtCalculatorData();
            }
            if (!base) {
                const sampleResponse = await fetch(SAMPLE_URL);
                if (!sampleResponse.ok) throw new Error(`Sample fetch failed (${sampleResponse.status})`);
                base = normalizeModel(await sampleResponse.json());
            }
            if (!base || isStaleDebtCalculatorModel(base)) {
                throw new Error('Stale debt-calculator fiction rejected — clear lastDebtCalculatorModel and retry');
            }

            const analyzeResponse = await fetch('/api/models/active/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (!analyzeResponse.ok) {
                throw new Error(`Analyze request failed (${analyzeResponse.status})`);
            }
            const payload = await analyzeResponse.json();
            if (!payload.report) {
                throw new Error('Analyze response did not include a report');
            }

            const merged = mergeScanIntoDebtModel(base, payload.report);
            applyDebtCalculatorModel(merged, `live scan (${payload.model?.name || 'active'})`);
            const scanOverview = payload.report.analysisOverview || {};
            window.showNotification?.(
                `✅ Analysis complete — ${scanOverview.dataQualityScore ?? '—'}% quality, ${scanOverview.issuesDetected ?? 0} issue(s)`,
                'success'
            );
        } catch (error) {
            console.error('Debt calculator analysis failed:', error);
            window.showNotification?.(`❌ Analysis failed: ${error.message}`, 'error');
        } finally {
            root?.classList.remove('loading');
            if (btn) btn.disabled = false;
        }
    }

    function bindActions() {
        const root = document.getElementById('debt-calculator-root');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        document.getElementById('debt-refresh')?.addEventListener('click', () => initializeDebtCalculatorPage(true));
        document.getElementById('debt-load-sample')?.addEventListener('click', loadDebtCalculatorSample);
        document.getElementById('debt-run-analysis')?.addEventListener('click', () => {
            void runDebtCalculatorAnalysis();
        });

        document.getElementById('debt-export-json')?.addEventListener('click', () => {
            if (!window.__debtCalculatorModel) return;
            const blob = new Blob([JSON.stringify(window.__debtCalculatorModel, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debt-calculator-model.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('debt-import-json')?.addEventListener('click', () => {
            document.getElementById('debt-import-file')?.click();
        });

        document.getElementById('debt-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyDebtCalculatorModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Debt calculator data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });

        root.addEventListener('click', (event) => {
            const toggleBtn = event.target.closest('.debt-toggle-btn');
            if (toggleBtn) {
                expandedCategoryId = expandedCategoryId === toggleBtn.dataset.categoryId ? null : toggleBtn.dataset.categoryId;
                if (window.__debtCalculatorModel) renderCategories(window.__debtCalculatorModel);
                return;
            }

            const quickAction = event.target.closest('.debt-quick-action');
            if (quickAction) {
                if (quickAction.dataset.section) {
                    navigateTo(quickAction.dataset.section);
                } else if (quickAction.dataset.action === 'export') {
                    document.getElementById('debt-export-json')?.click();
                } else if (quickAction.dataset.action === 'analyze') {
                    document.getElementById('debt-run-analysis')?.click();
                } else {
                    window.showNotification?.(`📋 ${quickAction.textContent?.trim()}`, 'info');
                }
            }
        });
    }

    function applyDebtCalculatorModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid debt-calculator model', 'error');
            return false;
        }
        if (isStaleDebtCalculatorModel(model)) {
            window.showNotification?.('❌ Stale debt-calculator fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__debtCalculatorModel = model;
        expandedCategoryId = null;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'debt-calculator'\"]");
            window.showSection('debt-calculator', navLink);
        }

        try {
            localStorage.setItem('lastDebtCalculatorModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported debt calculator',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedDebtCalculatorModel() {
        try {
            const raw = localStorage.getItem('lastDebtCalculatorModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.categories?.length || isStaleDebtCalculatorModel(model)) return false;
            window.__debtCalculatorModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadDebtCalculatorSample() {
        const root = document.getElementById('debt-calculator-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyDebtCalculatorModel(await response.json(), 'debt-calculator-sample.json');
            window.showNotification?.('✅ Loaded debt calculator sample', 'success');
        } catch (error) {
            console.error('Failed to load debt calculator sample:', error);
            window.showNotification?.('❌ Failed to load debt calculator sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeDebtCalculatorPage(forceRefresh = false) {
        const root = document.getElementById('debt-calculator-root');
        if (!root) return;

        if (window.__debtCalculatorModel && !forceRefresh) {
            if (isStaleDebtCalculatorModel(window.__debtCalculatorModel)) {
                window.__debtCalculatorModel = null;
            } else {
                renderModel(window.__debtCalculatorModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__debtCalculatorModel = null;
            try {
                localStorage.removeItem('lastDebtCalculatorModel');
            } catch (e) {
                /* ignore */
            }
        }

        if (!forceRefresh && restoreSavedDebtCalculatorModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchDebtCalculatorData();
            if (!model) throw new Error('No debt calculator data available');
            window.__debtCalculatorModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize debt calculator page:', error);
            window.showNotification?.('❌ Failed to load debt calculator data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeDebtCalculatorPage = initializeDebtCalculatorPage;
    window.loadDebtCalculatorSample = loadDebtCalculatorSample;
    window.applyDebtCalculatorModel = applyDebtCalculatorModel;
    window.runDebtCalculatorAnalysis = runDebtCalculatorAnalysis;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindActions);
    } else {
        bindActions();
    }
})();
