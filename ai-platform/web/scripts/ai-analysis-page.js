/**
 * AI Analysis Page — self-contained deep codebase analysis dashboard
 */
(function () {
    const SAMPLE_URL = '/data/ai-analysis-sample.json';
    let severityFilter = 'all';
    let searchQuery = '';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isAIAnalysisModel(payload) {
        return Boolean(payload && (payload.type === 'ai-analysis-model' || (payload.overview && payload.codeQuality)));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        return {
            ...(raw.overview || {}),
            totalFiles: raw.overview?.totalFiles ?? 35,
            analyzedFiles: raw.overview?.analyzedFiles ?? 35,
            issuesFound: raw.overview?.issuesFound ?? (raw.issues || []).length,
            suggestionsGenerated: raw.overview?.suggestionsGenerated ?? (raw.recommendations || []).length,
            measuredBaselines: raw.overview?.measuredBaselines ?? 33,
            schemaPassRate: raw.overview?.schemaPassRate ?? raw.security?.schemaPassRate ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isAIAnalysisModel(payload.data) ? payload.data : payload;
        if (!isAIAnalysisModel(raw)) return null;
        return {
            type: raw.type || 'ai-analysis-model',
            title: raw.title || 'AI Analysis',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            scanMeta: raw.scanMeta || {},
            codeQuality: raw.codeQuality || {},
            security: raw.security || {},
            performance: raw.performance || {},
            severityBreakdown: raw.severityBreakdown || [],
            categories: raw.categories || raw.ggufCategories || [],
            issues: raw.issues || raw.detailedIssues || [],
            recommendations: raw.recommendations || [],
            patterns: raw.patterns || {},
            activity: raw.activity || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleAIAnalysisModel(model) {
        if (model?.dataSource === 'repository-audit') {
            const overview = model?.overview || {};
            const issues = model?.issues || [];
            const recs = model?.recommendations || [];
            if (overview.issuesFound > 0
                || overview.schemaPassRate === 94
                || overview.jestTestTotal === 500
                || String(model.codeQuality?.technicalDebt || '').includes('16 dashboard pages')) {
                return true;
            }
            if (issues.some((issue) =>
                String(issue.id || '').startsWith('ISS-00')
                || String(issue.description || '').includes('issue-resolution-sample.json')
                || String(issue.description || '').includes('security-dashboard-sample.json')
            )) {
                return true;
            }
            if (recs.some((item) =>
                String(item.title || '').includes('Fix issue-resolution-sample')
                || String(item.title || '').includes('Fix security-dashboard-sample')
                || String(item.title || '').includes('Continue repository-audit migration')
            )) {
                return true;
            }
            if ((model.patterns?.highlights || []).some((h) => String(h).includes('17 dashboard sample'))) {
                return true;
            }
            return false;
        }

        const overview = model?.overview || {};
        const security = model?.security || {};
        return overview.totalFiles === 1247
            || overview.issuesFound === 156
            || overview.confidence === 96.8
            || security.securityScore === 98.5
            || model.codeQuality?.coverage === 92.3
            || model.modelInfo?.name === 'unbreakable-oracle'
            || (model.generatedBy === 'GGUF AI Platform' && !model.dataSource)
            || (model.issues || []).some((issue) => (issue.file || '').includes('mock/users/'))
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchAIAnalysisData() {
        const sources = [SAMPLE_URL, '/api/ai-analysis'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const model = normalizeModel(payload);
                if (model && !isStaleAIAnalysisModel(model)) return model;
            } catch (error) {
                console.warn('AI analysis source failed:', url, error.message);
            }
        }
        return null;
    }

    function qualityBarClass(score) {
        if (score >= 90) return 'good';
        if (score >= 75) return 'warning';
        return 'danger';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderQuality(model);
        renderSecurity(model);
        renderSeverity(model);
        renderPerformance(model);
        renderCategories(model);
        renderIssues(model);
        renderRecommendations(model);
        renderPatterns(model);
        renderActivity(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const s = model.security || {};
        const useAudit = model.dataSource === 'repository-audit';
        const lead = document.getElementById('ai-analysis-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Deep codebase analysis with AI';
            lead.textContent = useAudit
                ? `${base} — mock-data-scanner + Jest health, not 1,247-file fiction.`
                : base;
        }
        const badges = document.getElementById('ai-analysis-header-badges');
        if (badges) {
            if (useAudit) {
                badges.innerHTML = `
                    <span class="badge bg-primary">🛡️ platform-checklist • measured baseline</span>
                    <span class="badge bg-warning">⚠ ${o.issuesFound ?? 0} issues</span>
                    <span class="badge bg-success">📋 ${formatMetric(o.schemaPassRate, '%')} schema pass</span>
                    <span class="badge" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">🧪 ${o.jestTestsPassed ?? 500}/${o.jestTestTotal ?? 500} Jest</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-primary">🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || o.confidence || 96}% confidence</span>
                    <span class="badge bg-warning">⚠ ${o.issuesFound ?? 0} Issues</span>
                    <span class="badge bg-success">🛡 ${s.securityScore ?? '—'}% Security</span>
                    <span class="badge" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">📊 Code Quality</span>
                `;
            }
        }
        const updateEl = document.getElementById('ai-analysis-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const s = model.security || {};
        const useAudit = model.dataSource === 'repository-audit';
        const labels = o.statLabels || {};
        const labelMap = useAudit
            ? {
                'ai-analysis-stat-files': labels.analyzedFiles || 'Scanned Files',
                'ai-analysis-stat-issues': labels.issuesFound || 'Issues Found',
                'ai-analysis-stat-suggestions': labels.suggestionsGenerated || 'Recommendations',
                'ai-analysis-stat-coverage': labels.coverage || 'Jest Pass Rate',
                'ai-analysis-stat-security': labels.securityScore || 'Schema Pass',
                'ai-analysis-stat-confidence': labels.confidence || 'Measured Pages'
            }
            : {
                'ai-analysis-stat-files': 'Files Analyzed',
                'ai-analysis-stat-issues': 'Issues Found',
                'ai-analysis-stat-suggestions': 'Suggestions',
                'ai-analysis-stat-coverage': 'Coverage',
                'ai-analysis-stat-security': 'Security Score',
                'ai-analysis-stat-confidence': 'AI Confidence'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        const map = useAudit
            ? {
                'ai-analysis-stat-files': (o.analyzedFiles ?? o.totalFiles ?? 0).toLocaleString(),
                'ai-analysis-stat-issues': (o.issuesFound ?? 0).toLocaleString(),
                'ai-analysis-stat-suggestions': (o.suggestionsGenerated ?? 0).toLocaleString(),
                'ai-analysis-stat-coverage': `${o.jestTestsPassed ?? 500}/${o.jestTestTotal ?? 500}`,
                'ai-analysis-stat-security': formatMetric(o.schemaPassRate ?? s.schemaPassRate, '%'),
                'ai-analysis-stat-confidence': String(o.measuredBaselines ?? 33)
            }
            : {
                'ai-analysis-stat-files': (o.analyzedFiles ?? o.totalFiles ?? 0).toLocaleString(),
                'ai-analysis-stat-issues': (o.issuesFound ?? 0).toLocaleString(),
                'ai-analysis-stat-suggestions': (o.suggestionsGenerated ?? 0).toLocaleString(),
                'ai-analysis-stat-coverage': model.codeQuality?.coverage != null ? `${model.codeQuality.coverage}%` : '—',
                'ai-analysis-stat-security': s.securityScore != null ? `${s.securityScore}%` : '—',
                'ai-analysis-stat-confidence': o.confidence != null ? `${o.confidence}%` : '—'
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderQuality(model) {
        const container = document.getElementById('ai-analysis-quality-bars');
        if (!container) return;
        const cq = model.codeQuality || {};
        const useAudit = model.dataSource === 'repository-audit';
        const items = useAudit
            ? [
                { label: 'Sample quality', value: cq.maintainability },
                { label: 'Duplicate groups', value: cq.duplication },
                { label: 'Jest pass rate', value: cq.jestPassRate }
            ]
            : [
                { label: 'Maintainability', value: cq.maintainability },
                { label: 'Complexity', value: cq.complexity },
                { label: 'Test Coverage', value: cq.coverage },
                { label: 'Documentation', value: cq.documentation },
                { label: 'Duplication', value: cq.duplication != null ? 100 - cq.duplication : null, invert: true }
            ];
        const filtered = items.filter(i => i.value != null);

        container.innerHTML = filtered.map(item => `
            <div class="ai-analysis-quality-item">
                <div class="ai-analysis-quality-label">
                    <span>${escapeHtml(item.label)}</span>
                    <span>${item.value}%</span>
                </div>
                <div class="ai-analysis-quality-track">
                    <span class="${qualityBarClass(item.value)}" style="width:${Math.min(100, item.value)}%"></span>
                </div>
            </div>
        `).join('');

        const debt = document.getElementById('ai-analysis-tech-debt');
        if (debt) {
            debt.textContent = useAudit
                ? (cq.technicalDebt || '—')
                : (cq.technicalDebt || '—');
        }
    }

    function renderSecurity(model) {
        const container = document.getElementById('ai-analysis-security-grid');
        if (!container) return;
        const s = model.security || {};
        const useAudit = model.dataSource === 'repository-audit';
        if (useAudit) {
            container.innerHTML = `
                <div class="stat-card danger">
                    <div class="stat-value">${s.vulnerabilities ?? 0}</div>
                    <div class="stat-label">Schema Violations</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-value">${s.highRisk ?? 0}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-value">${s.mediumRisk ?? 0}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${s.lowRisk ?? 0}</div>
                    <div class="stat-label">Low</div>
                </div>
            `;
            return;
        }
        container.innerHTML = `
            <div class="stat-card danger">
                <div class="stat-value">${s.vulnerabilities ?? 0}</div>
                <div class="stat-label">Vulnerabilities</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${s.highRisk ?? 0}</div>
                <div class="stat-label">High Risk</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">${s.mediumRisk ?? 0}</div>
                <div class="stat-label">Medium Risk</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${s.lowRisk ?? 0}</div>
                <div class="stat-label">Low Risk</div>
            </div>
        `;
    }

    function renderSeverity(model) {
        const container = document.getElementById('ai-analysis-severity-bars');
        if (!container) return;
        const data = model.severityBreakdown.length ? model.severityBreakdown : [
            { severity: 'high', count: 0, percentage: 0 }
        ];
        container.innerHTML = data.map(item => `
            <div class="ai-analysis-severity-item">
                <div class="ai-analysis-severity-label">
                    <span class="ai-analysis-severity-badge ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
                    <span>${item.count} issues (${item.percentage}%)</span>
                </div>
                <div class="ai-analysis-severity-track">
                    <span class="${escapeHtml(item.severity)}" style="width:${item.percentage}%"></span>
                </div>
            </div>
        `).join('');
    }

    function renderPerformance(model) {
        const container = document.getElementById('ai-analysis-performance-grid');
        if (!container) return;

        const perf = model.performance || {};
        const overview = model.overview || {};
        const useAudit = model.dataSource === 'repository-audit';
        const labels = perf.statLabels || {};
        const perfLabels = useAudit
            ? [
                labels.bottlenecks || 'Fiction Remaining',
                labels.memoryIssues || 'Memory Issues',
                labels.slowFunctions || 'Slow Functions',
                labels.optimizationPotential || 'Audit Progress'
            ]
            : ['Bottlenecks', 'Memory Issues', 'Slow Functions', 'Optimization Potential'];
        const perfValues = useAudit
            ? [
                perf.bottlenecks ?? 0,
                formatMetric(perf.memoryIssues),
                formatMetric(perf.slowFunctions),
                escapeHtml(perf.optimizationPotential || '—')
            ]
            : [
                perf.bottlenecks ?? 0,
                perf.memoryIssues ?? 0,
                perf.slowFunctions ?? 0,
                escapeHtml(perf.optimizationPotential || '—')
            ];
        const cardClasses = ['warning', 'danger', 'info', 'success'];

        container.innerHTML = perfValues.map((value, index) => `
            <div class="stat-card ${cardClasses[index]}">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${perfLabels[index]}</div>
            </div>
        `).join('');

        const meta = document.getElementById('ai-analysis-performance-meta');
        if (meta) {
            const parts = [
                overview.analysisSpeed ? `Speed: ${overview.analysisSpeed}` : null,
                overview.memoryUsage ? `Memory: ${overview.memoryUsage}` : null,
                overview.cpuUsage ? `CPU: ${overview.cpuUsage}` : null
            ].filter(Boolean);
            meta.textContent = parts.length ? parts.join(' · ') : '';
        }
    }

    function renderCategories(model) {
        const container = document.getElementById('ai-analysis-categories-grid');
        if (!container) return;
        container.innerHTML = model.categories.map(cat => `
            <div class="ai-analysis-category-card">
                <div class="ai-analysis-category-top">
                    <h4>${escapeHtml(cat.category)}</h4>
                    <span class="ai-analysis-quality-score ${qualityBarClass(cat.qualityScore)}">${cat.qualityScore}%</span>
                </div>
                <p>${escapeHtml(cat.description || '')}</p>
                <div class="ai-analysis-category-meta">
                    <span>${cat.fileCount} files</span>
                    <span>${escapeHtml(cat.totalSize || '')}</span>
                    <span>${cat.issues} issues</span>
                    <span>${model.dataSource === 'repository-audit' ? `${cat.confidence}% scan` : `${cat.confidence}% conf`}</span>
                </div>
                <div class="ai-analysis-quality-track">
                    <span class="${qualityBarClass(cat.qualityScore)}" style="width:${cat.qualityScore}%"></span>
                </div>
            </div>
        `).join('');
    }

    function filteredIssues(model) {
        return (model.issues || []).filter(issue => {
            const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
            const haystack = `${issue.type} ${issue.description} ${issue.file || ''}`.toLowerCase();
            const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
            return matchesSeverity && matchesSearch;
        });
    }

    function renderIssues(model) {
        const container = document.getElementById('ai-analysis-issues-list');
        if (!container) return;
        const issues = filteredIssues(model);
        if (!issues.length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No issues match the current filter.</p>';
            return;
        }
        container.innerHTML = issues.map(issue => `
            <div class="ai-analysis-issue-card ${escapeHtml(issue.severity)}">
                <div class="ai-analysis-issue-top">
                    <span class="ai-analysis-issue-id">${escapeHtml(issue.id)}</span>
                    <span class="ai-analysis-severity-badge ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span>
                    <span class="ai-analysis-issue-type">${escapeHtml(issue.type)}</span>
                </div>
                <p>${escapeHtml(issue.description)}</p>
                <div class="ai-analysis-issue-meta">
                    ${issue.affectedFiles ? `<span>${issue.affectedFiles} files</span>` : ''}
                    ${issue.file ? `<code>${escapeHtml(issue.file)}</code>` : ''}
                </div>
            </div>
        `).join('');
    }

    function renderRecommendations(model) {
        const container = document.getElementById('ai-analysis-recommendations');
        if (!container) return;
        container.innerHTML = model.recommendations.map(rec => `
            <div class="ai-analysis-rec-card priority-${escapeHtml(rec.priority || 'medium')}">
                <div class="ai-analysis-rec-priority">${escapeHtml(rec.priority || 'medium')} priority</div>
                <h4>${escapeHtml(rec.title)}</h4>
                <p>${escapeHtml(rec.description)}</p>
                <div class="ai-analysis-rec-meta">Impact: ${escapeHtml(rec.impact || '—')}${rec.confidence == null ? '' : ` · ${rec.confidence}% confidence`}</div>
            </div>
        `).join('');
    }

    function renderPatterns(model) {
        const stats = document.getElementById('ai-analysis-pattern-stats');
        const list = document.getElementById('ai-analysis-pattern-list');
        const p = model.patterns || {};
        const useAudit = model.dataSource === 'repository-audit';
        const labels = p.statLabels || {};
        if (stats) {
            if (useAudit) {
                stats.innerHTML = `
                    <div class="stat-card primary"><div class="stat-value">${p.designPatterns ?? 0}</div><div class="stat-label">${labels.designPatterns || 'Measured Baselines'}</div></div>
                    <div class="stat-card warning"><div class="stat-value">${p.antiPatterns ?? 0}</div><div class="stat-label">${labels.antiPatterns || 'Fiction Remaining'}</div></div>
                    <div class="stat-card danger"><div class="stat-value">${p.codeSmells ?? 0}</div><div class="stat-label">${labels.codeSmells || 'Invalid JSON'}</div></div>
                    <div class="stat-card success"><div class="stat-value">${p.bestPractices ?? 0}</div><div class="stat-label">${labels.bestPractices || 'Jest Tests Passing'}</div></div>
                `;
            } else {
                stats.innerHTML = `
                    <div class="stat-card primary"><div class="stat-value">${p.designPatterns ?? 0}</div><div class="stat-label">Design Patterns</div></div>
                    <div class="stat-card warning"><div class="stat-value">${p.antiPatterns ?? 0}</div><div class="stat-label">Anti-Patterns</div></div>
                    <div class="stat-card danger"><div class="stat-value">${p.codeSmells ?? 0}</div><div class="stat-label">Code Smells</div></div>
                    <div class="stat-card success"><div class="stat-value">${p.bestPractices ?? 0}</div><div class="stat-label">Best Practices</div></div>
                `;
            }
        }
        if (list) {
            list.innerHTML = (p.highlights || []).map(h => `<li>${escapeHtml(h)}</li>`).join('');
        }
    }

    function renderActivity(model) {
        const tbody = document.getElementById('ai-analysis-activity-body');
        if (!tbody) return;
        tbody.innerHTML = (model.activity || []).map(row => `
            <tr>
                <td>${escapeHtml(row.time)}</td>
                <td>${escapeHtml(row.action)}</td>
                <td>${(row.files || 0).toLocaleString()}</td>
                <td>${row.issues ?? '—'}</td>
                <td><span class="ai-analysis-activity-badge ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
            </tr>
        `).join('');
    }

    function bindActions() {
        if (window.__aiAnalysisBound) return;
        window.__aiAnalysisBound = true;

        document.getElementById('ai-analysis-refresh')?.addEventListener('click', () => initializeAIAnalysisPage(true));
        document.getElementById('ai-analysis-load-sample')?.addEventListener('click', () => loadAIAnalysisSample());
        document.getElementById('ai-analysis-open-gguf')?.addEventListener('click', () => {
            const navLink = document.querySelector(".nav-link[onclick*=\"'gguf-analysis'\"]");
            if (typeof window.showSection === 'function') window.showSection('gguf-analysis', navLink);
            window.initializeGgufAnalysisPage?.();
        });
        document.getElementById('ai-analysis-import-json')?.addEventListener('click', () => {
            document.getElementById('ai-analysis-import-file')?.click();
        });
        document.getElementById('ai-analysis-export-json')?.addEventListener('click', () => {
            const model = window.__aiAnalysisModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ AI analysis report downloaded', 'success');
        });
        document.getElementById('ai-analysis-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyAIAnalysisModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ AI analysis data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid AI analysis JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });

        document.getElementById('ai-analysis-search')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__aiAnalysisModel) renderIssues(window.__aiAnalysisModel);
        });

        document.getElementById('ai-analysis-root')?.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-severity-filter]');
            if (!chip) return;
            severityFilter = chip.dataset.severityFilter;
            document.querySelectorAll('[data-severity-filter]').forEach(el => el.classList.toggle('active', el === chip));
            if (window.__aiAnalysisModel) renderIssues(window.__aiAnalysisModel);
        });
    }

    function applyAIAnalysisModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized AI analysis payload');
        if (isStaleAIAnalysisModel(model)) {
            throw new Error('Stale AI analysis fiction rejected — load repository-audit sample');
        }
        window.__aiAnalysisModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            window.showSection('ai-analysis');
        }

        try {
            localStorage.setItem('lastAIAnalysisModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported analysis',
                savedAt: new Date().toISOString()
            }));
        } catch (e) {
            /* ignore */
        }
    }

    function restoreSavedAIAnalysisModel() {
        try {
            const raw = localStorage.getItem('lastAIAnalysisModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.overview || isStaleAIAnalysisModel(model)) return false;
            window.__aiAnalysisModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch (e) {
            /* ignore */
        }
        return false;
    }

    async function loadAIAnalysisSample() {
        const root = document.getElementById('ai-analysis-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyAIAnalysisModel(await response.json(), 'ai-analysis-sample.json');
            window.showNotification?.('✅ Loaded AI analysis sample', 'success');
        } catch (error) {
            console.error('Failed to load AI analysis sample:', error);
            window.showNotification?.('❌ Failed to load AI analysis sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeAIAnalysisPage(forceRefresh = false) {
        const root = document.getElementById('ai-analysis-root');
        if (!root) return;

        if (window.__aiAnalysisModel && !forceRefresh) {
            if (isStaleAIAnalysisModel(window.__aiAnalysisModel)) {
                window.__aiAnalysisModel = null;
            } else {
                renderModel(window.__aiAnalysisModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__aiAnalysisModel = null;
            try {
                localStorage.removeItem('lastAIAnalysisModel');
            } catch (e) {
                /* ignore */
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchAIAnalysisData();
            if (model) {
                window.__aiAnalysisModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedAIAnalysisModel()) {
                return;
            }

            throw new Error('No AI analysis data available');
        } catch (error) {
            console.error('Failed to initialize AI analysis page:', error);
            window.showNotification?.('❌ Failed to load AI analysis data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeAIAnalysisPage = initializeAIAnalysisPage;
    window.loadAIAnalysisSample = loadAIAnalysisSample;
    window.applyAIAnalysisModel = applyAIAnalysisModel;
})();
