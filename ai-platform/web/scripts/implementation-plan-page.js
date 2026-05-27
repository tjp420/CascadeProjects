/**
 * Implementation Plan Page — project execution plan and KPI tracking
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/implementation-plan-sample.json?v=${SAMPLE_CACHE_BUST}`;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isImplementationPlanModel(payload) {
        return Boolean(payload && (
            payload.type === 'implementation-plan-model' ||
            (payload.executiveSummary?.currentCompletion != null && Array.isArray(payload.implementationPhases))
        ));
    }

    function buildExecutiveSummary(raw) {
        const es = raw.executiveSummary || {};
        const phases = raw.implementationPhases || [];
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !phases.length) {
            return es;
        }

        const avgProgress = Math.round(
            phases.reduce((sum, phase) => sum + (phase.progress || 0), 0) / phases.length
        );

        return {
            ...es,
            currentCompletion: avgProgress,
            teamSize: es.teamSize ?? 1,
            totalBudget: es.totalBudget ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isImplementationPlanModel(payload.data) ? payload.data : payload;
        if (!isImplementationPlanModel(raw)) return null;
        return {
            type: raw.type || 'implementation-plan-model',
            title: raw.title || 'Implementation Plan',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || raw.timestamp || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            version: raw.version || '2.0.0',
            modelInfo: raw.modelInfo || {},
            executiveSummary: buildExecutiveSummary(raw),
            implementationPhases: raw.implementationPhases || [],
            successMetrics: raw.successMetrics || {},
            resourceAllocation: raw.resourceAllocation || {},
            riskManagement: raw.riskManagement || [],
            milestones: raw.milestones || [],
            immediateActions: raw.immediateActions || [],
            dashboardIntegration: raw.dashboardIntegration || {},
            repositorySnapshot: raw.repositorySnapshot || null,
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    async function fetchImplementationPlanData() {
        const sources = [SAMPLE_URL, '/api/implementation-plan'];
        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const raw = await response.json();
                const payload = url === SAMPLE_URL ? raw : (raw.data || raw);
                const model = normalizeModel(payload);
                if (model && !isStaleImplementationPlanModel(model)) return model;
            } catch (error) {
                console.warn('Implementation plan source failed:', url, error.message);
            }
        }
        return null;
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleDateString();
    }

    function formatCurrency(value) {
        if (value == null || value === '') return '—';
        const num = Number(value);
        if (!Number.isFinite(num)) return escapeHtml(value);
        return `$${num.toLocaleString()}`;
    }

    function isStaleImplementationPlanModel(model) {
        if (!model) return true;
        const summary = model.executiveSummary || {};
        const completion = Number(summary.currentCompletion);
        const kpis = model.successMetrics?.technicalKPIs || [];
        const honestSamples = kpis.find((k) => k.metric === 'Honest Sample Pages');
        const jestKpi = kpis.find((k) => k.metric === 'Jest Test Pass Rate');
        const phase2 = (model.implementationPhases || []).find((p) =>
            String(p.phase || '').includes('Phase 2')
        );
        const phase2Text = [
            ...(phase2?.objectives || []),
            ...(phase2?.completedItems || [])
        ].join(' ');
        const snapshot = model.repositorySnapshot || {};

        if (summary.teamSize === 11
            || summary.totalBudget === 204000
            || Math.abs(completion - 74.17) < 0.01
            || model.modelInfo?.name === 'unbreakable-oracle'
            || (model.generatedBy === 'RoadmapAnalyzer' && model.version === '1.0.0')) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (snapshot.jestTests === 500 || snapshot.jestTests === 502) return true;
        if (String(jestKpi?.source || '').includes('500/500') || String(jestKpi?.source || '').includes('502/502')) return true;
        if (phase2Text.includes('500 Jest') || phase2Text.includes('500/500') || phase2Text.includes('502/502')) return true;
        if (honestSamples && Number(honestSamples.current) < 34 && Number(honestSamples.target) >= 33) return true;
        if (summary.currentCompletion === 62 && summary.teamSize !== 1) return true;
        if ((model.resourceAllocation?.teamStructure || []).some((r) =>
            Number(r.count) > 1 && /developer|engineer|specialist|manager/i.test(String(r.role))
        )) return true;
        if (phase2?.progress === 65 && (phase2.remainingItems || []).some((item) =>
            String(item).includes('Remaining stub page sample rewrites')
        )) return true;

        const milestones = model.milestones || [];
        if (milestones.some((item) =>
            String(item.successCriteria || '').includes('500 tests')
            || String(item.successCriteria || '').includes('502 tests')
        )) return true;
        const honestMilestone = milestones.find((item) =>
            String(item.milestone || '').includes('Honest Samples')
        );
        if (honestMilestone?.status !== 'complete' && !String(honestMilestone?.successCriteria || '').match(/3[34]\/3[34]/)) {
            return true;
        }

        const actions = model.immediateActions || [];
        if (actions.some((item) =>
            String(item.action || '').includes('Finish sample telemetry cleanup')
            && String(item.status || '').toLowerCase() !== 'complete'
        )) return true;

        const sampleRisk = (model.riskManagement || []).find((item) =>
            String(item.risk || '').includes('Sample data mistaken for live metrics')
        );
        if (sampleRisk?.status === 'in-progress') return true;

        return false;
    }

    function priorityClass(priority) {
        const value = String(priority || '').toLowerCase();
        if (value === 'critical') return 'critical';
        if (value === 'high') return 'high';
        if (value === 'medium') return 'medium';
        return 'low';
    }

    function statusClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'completed' || value === 'mitigated' || value === 'met') return 'completed';
        if (value === 'in-progress' || value === 'current' || value === 'on-track' || value === 'monitored') return 'in-progress';
        if (value === 'critical' || value === 'pending') return 'critical';
        return 'planned';
    }

    function kpiProgress(current, target) {
        const c = Number(current);
        const t = Number(target);
        if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0;
        return Math.min(100, Math.round((c / t) * 100));
    }

    function renderModel(model) {
        renderHeader(model);
        renderSummary(model);
        renderPhases(model);
        renderKPIs(model);
        renderResources(model);
        renderRisks(model);
        renderMilestones(model);
        renderActions(model);
        renderRelatedSections(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('implementation-plan-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • v${model.version} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Project execution plan and milestone tracking';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — solo-maintainer sprint plan, not an enterprise staffing forecast.`
                : base;
        }
        const badge = document.getElementById('implementation-plan-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                const info = model.modelInfo || {};
                badge.textContent = info.name
                    ? `🧠 ${info.name} • ${info.confidence ?? 95}% confidence`
                    : '🧠 RepositoryAudit';
            }
        }
        const updateEl = document.getElementById('implementation-plan-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('ip-header-badges');
        const summary = model.executiveSummary || {};
        if (badges) {
            badges.innerHTML = `
                <span class="badge bg-primary me-2">📊 ${summary.currentCompletion ?? 0}% Complete</span>
                <span class="badge bg-success me-2">🎯 Target ${summary.targetCompletion ?? 0}%</span>
                <span class="badge bg-info me-2">👥 ${summary.teamSize ?? 0} Team</span>
                <span class="badge bg-warning me-2">📅 ${escapeHtml(summary.timelineTarget || 'TBD')}</span>
            `;
        }
    }

    function renderSummary(model) {
        const s = model.executiveSummary || {};
        const isAudit = model.dataSource === 'repository-audit';
        const labelMap = isAudit
            ? {
                'ip-stat-completion': 'Current Completion',
                'ip-stat-target': 'Target Completion',
                'ip-stat-confidence': 'AI Confidence',
                'ip-stat-budget': 'Budget',
                'ip-stat-team': 'Maintainer',
                'ip-stat-duration': 'Duration'
            }
            : null;

        if (labelMap) {
            Object.entries(labelMap).forEach(([id, label]) => {
                const card = document.getElementById(id)?.closest('.stat-card');
                const labelEl = card?.querySelector('.stat-label');
                if (labelEl) labelEl.textContent = label;
            });
        }

        const map = {
            'ip-stat-completion': `${s.currentCompletion ?? 0}%`,
            'ip-stat-target': `${s.targetCompletion ?? 0}%`,
            'ip-stat-confidence': `${s.aiConfidence ?? 0}%`,
            'ip-stat-budget': formatCurrency(s.totalBudget),
            'ip-stat-team': s.teamSize ?? 0,
            'ip-stat-duration': s.duration || '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        const healthEl = document.getElementById('ip-stat-health');
        if (healthEl) healthEl.textContent = s.projectHealth || '—';

        const progressBar = document.getElementById('ip-overall-progress-bar');
        const progressLabel = document.getElementById('ip-overall-progress-label');
        const pct = kpiProgress(s.currentCompletion, s.targetCompletion);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressLabel) progressLabel.textContent = `${s.currentCompletion ?? 0}% of ${s.targetCompletion ?? 0}% target`;
    }

    function renderPhases(model) {
        const container = document.getElementById('ip-phases-grid');
        if (!container) return;
        const phases = model.implementationPhases || [];
        if (!phases.length) {
            container.innerHTML = '<p class="ip-empty">No implementation phases defined.</p>';
            return;
        }
        container.innerHTML = phases.map((phase) => `
            <div class="ip-phase-card ${statusClass(phase.status)}">
                <div class="ip-phase-top">
                    <h4>${escapeHtml(phase.phase)}</h4>
                    <span class="ip-priority-badge ${priorityClass(phase.priority)}">${escapeHtml(phase.priority || 'medium')}</span>
                </div>
                <div class="ip-phase-meta">${escapeHtml(phase.duration || '')} • ${formatDate(phase.startDate)} → ${formatDate(phase.endDate)}</div>
                <div class="ip-phase-progress"><span style="width:${phase.progress ?? 0}%"></span></div>
                <div class="ip-phase-progress-label">${phase.progress ?? 0}% complete</div>
                ${phase.objectives?.length ? `
                    <div class="ip-phase-section">
                        <strong>Objectives</strong>
                        <ul>${phase.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                    </div>` : ''}
                ${phase.deliverables?.length ? `
                    <div class="ip-phase-section">
                        <strong>Deliverables</strong>
                        <ul>${phase.deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                    </div>` : ''}
                ${phase.teamAllocation ? `
                    <div class="ip-phase-section">
                        <strong>Team</strong>
                        <div class="ip-team-tags">${Object.entries(phase.teamAllocation).map(([role, load]) =>
                            `<span class="ip-team-tag">${escapeHtml(role)}: ${escapeHtml(load)}</span>`
                        ).join('')}</div>
                    </div>` : ''}
            </div>
        `).join('');
    }

    function renderKPIs(model) {
        const techBody = document.getElementById('ip-tech-kpis-body');
        const bizBody = document.getElementById('ip-biz-kpis-body');
        const techKPIs = model.successMetrics?.technicalKPIs || [];
        const bizKPIs = model.successMetrics?.businessKPIs || [];

        if (techBody) {
            techBody.innerHTML = techKPIs.length ? techKPIs.map((kpi) => {
                const pct = kpiProgress(kpi.current, kpi.target);
                return `
                    <tr>
                        <td><strong>${escapeHtml(kpi.metric)}</strong></td>
                        <td>${escapeHtml(kpi.current)}${kpi.unit ? escapeHtml(kpi.unit) : ''}</td>
                        <td>${escapeHtml(kpi.target)}${kpi.unit ? escapeHtml(kpi.unit) : ''}</td>
                        <td>${formatDate(kpi.deadline)}</td>
                        <td><span class="ip-status-badge ${statusClass(kpi.status)}">${escapeHtml(kpi.status)}</span></td>
                        <td><div class="ip-kpi-bar"><span style="width:${pct}%"></span></div></td>
                    </tr>
                `;
            }).join('') : '<tr><td colspan="6" class="ip-empty">No technical KPIs.</td></tr>';
        }

        if (bizBody) {
            bizBody.innerHTML = bizKPIs.length ? bizKPIs.map((kpi) => `
                <tr>
                    <td><strong>${escapeHtml(kpi.metric)}</strong></td>
                    <td>${escapeHtml(kpi.current ?? '—')}${kpi.unit ? escapeHtml(kpi.unit) : ''}</td>
                    <td>${escapeHtml(kpi.target ?? '—')}${kpi.unit ? escapeHtml(kpi.unit) : ''}</td>
                    <td>${kpi.confidence != null ? `${kpi.confidence}%` : '—'}</td>
                    <td><span class="ip-status-badge ${statusClass(kpi.status)}">${escapeHtml(kpi.status)}</span></td>
                </tr>
            `).join('') : '<tr><td colspan="5" class="ip-empty">No business KPIs.</td></tr>';
        }
    }

    function renderResources(model) {
        const teamEl = document.getElementById('ip-team-grid');
        const budgetEl = document.getElementById('ip-budget-list');
        const team = model.resourceAllocation?.teamStructure || [];
        const budget = model.resourceAllocation?.budgetBreakdown || [];
        const focus = model.resourceAllocation?.engineeringFocus || [];

        if (teamEl) {
            teamEl.innerHTML = team.length ? team.map((member) => `
                <div class="ip-team-card">
                    <div class="ip-team-count">${member.count ?? 0}</div>
                    <div>
                        <h5>${escapeHtml(member.role)}</h5>
                        <p>${escapeHtml(member.focus)}</p>
                        <span class="ip-team-duration">${escapeHtml(member.duration)}</span>
                    </div>
                </div>
            `).join('') : '<p class="ip-empty">No team structure defined.</p>';
        }

        if (budgetEl) {
            if (budget.length) {
                budgetEl.innerHTML = budget.map((item) => `
                    <div class="ip-budget-row">
                        <div>
                            <strong>${escapeHtml(item.category)}</strong>
                            <div class="ip-budget-notes">${escapeHtml(item.notes || '')}</div>
                        </div>
                        <div class="ip-budget-amount">${formatCurrency(item.amount)}</div>
                        <div class="ip-budget-duration">${escapeHtml(item.duration || '')}</div>
                    </div>
                `).join('');
            } else if (focus.length) {
                budgetEl.innerHTML = focus.map((item) => `
                    <div class="ip-budget-row">
                        <div>
                            <strong>${escapeHtml(item.area)}</strong>
                            <div class="ip-budget-notes">${escapeHtml(item.status || '')}</div>
                        </div>
                        <div class="ip-budget-amount">${escapeHtml(item.effort || '—')}</div>
                        <div class="ip-budget-duration">engineering focus</div>
                    </div>
                `).join('');
            } else {
                budgetEl.innerHTML = '<p class="ip-empty">No budget breakdown — solo project, not scoped.</p>';
            }
        }
    }

    function renderRisks(model) {
        const container = document.getElementById('ip-risks-grid');
        if (!container) return;
        const risks = model.riskManagement || [];
        container.innerHTML = risks.length ? risks.map((risk) => `
            <div class="ip-risk-card">
                <div class="ip-risk-top">
                    <h5>${escapeHtml(risk.risk)}</h5>
                    <span class="ip-status-badge ${statusClass(risk.status)}">${escapeHtml(risk.status)}</span>
                </div>
                <div class="ip-risk-meta">Impact: ${escapeHtml(risk.impact)} • Probability: ${escapeHtml(risk.probability)}</div>
                <p>${escapeHtml(risk.mitigation)}</p>
            </div>
        `).join('') : '<p class="ip-empty">No risks identified.</p>';
    }

    function renderMilestones(model) {
        const container = document.getElementById('ip-milestones-list');
        if (!container) return;
        const milestones = model.milestones || [];
        container.innerHTML = milestones.length ? milestones.map((item, index) => `
            <div class="ip-milestone-step ${statusClass(item.status)}">
                <div class="ip-milestone-num">${index + 1}</div>
                <div class="ip-milestone-body">
                    <h4>${escapeHtml(item.milestone)}</h4>
                    <div class="ip-milestone-date">${formatDate(item.date)}</div>
                    <p>${escapeHtml(item.deliverable)}</p>
                    <div class="ip-milestone-criteria">${escapeHtml(item.successCriteria)}</div>
                </div>
            </div>
        `).join('') : '<p class="ip-empty">No milestones defined.</p>';
    }

    function renderActions(model) {
        const container = document.getElementById('ip-actions-list');
        if (!container) return;
        const actions = model.immediateActions || [];
        container.innerHTML = actions.length ? actions.map((action) => `
            <div class="ip-action-card ${priorityClass(action.priority)}">
                <div class="ip-action-top">
                    <h5>${escapeHtml(action.action)}</h5>
                    <span class="ip-priority-badge ${priorityClass(action.priority)}">${escapeHtml(action.priority)}</span>
                </div>
                <p>${escapeHtml(action.details)}</p>
                <div class="ip-action-meta">${escapeHtml(action.owner)} • ${escapeHtml(action.timeline)} • ${escapeHtml(action.status)}</div>
            </div>
        `).join('') : '<p class="ip-empty">No immediate actions.</p>';
    }

    function renderRelatedSections(model) {
        const container = document.getElementById('ip-related-sections');
        if (!container) return;
        const sections = model.dashboardIntegration?.relatedSections || [];
        container.innerHTML = sections.length ? sections.map((item) => `
            <button type="button" class="ip-related-btn" data-shortcut="${escapeHtml(item.shortcut)}">
                <span class="ip-related-title">${escapeHtml(item.section)}</span>
                <span class="ip-related-shortcut">${escapeHtml(item.shortcut)}</span>
                <span class="ip-related-desc">${escapeHtml(item.relevance)}</span>
            </button>
        `).join('') : '<p class="ip-empty">No related dashboard sections.</p>';
    }

    function bindActions() {
        const root = document.getElementById('implementation-plan-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('ip-load-sample')?.addEventListener('click', () => loadImplementationPlanSample());
        document.getElementById('ip-import-json')?.addEventListener('click', () => {
            document.getElementById('ip-import-file')?.click();
        });
        document.getElementById('ip-export-json')?.addEventListener('click', () => {
            const model = window.__implementationPlanModel;
            if (!model) {
                window.showNotification?.('❌ No implementation plan to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'implementation-plan-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Implementation plan exported', 'success');
        });
        document.getElementById('ip-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                applyImplementationPlanModel(JSON.parse(text), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('ip-refresh')?.addEventListener('click', () => initializeImplementationPlanPage(true));

        root.addEventListener('click', (event) => {
            const btn = event.target.closest('.ip-related-btn');
            if (!btn) return;
            const shortcut = btn.dataset.shortcut;
            const address = document.getElementById('global-data-address');
            if (address && shortcut) {
                address.value = shortcut;
                document.getElementById('global-data-analyze')?.click();
            }
        });
    }

    function applyImplementationPlanModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid implementation-plan model', 'error');
            return false;
        }
        if (isStaleImplementationPlanModel(model)) {
            window.showNotification?.('❌ Stale implementation plan fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__implementationPlanModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'implementation-plan'\"]");
            window.showSection('implementation-plan', navLink);
        }

        try {
            localStorage.setItem('lastImplementationPlanModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported implementation plan',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedImplementationPlanModel() {
        try {
            const raw = localStorage.getItem('lastImplementationPlanModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.implementationPhases?.length || isStaleImplementationPlanModel(model)) {
                localStorage.removeItem('lastImplementationPlanModel');
                return false;
            }
            window.__implementationPlanModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadImplementationPlanSample() {
        const root = document.getElementById('implementation-plan-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyImplementationPlanModel(await response.json(), 'implementation-plan-sample.json');
            window.showNotification?.('✅ Loaded implementation plan sample', 'success');
        } catch (error) {
            console.error('Failed to load implementation plan sample:', error);
            window.showNotification?.('❌ Failed to load implementation plan sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeImplementationPlanPage(forceRefresh = false) {
        const root = document.getElementById('implementation-plan-root');
        if (!root) return;

        if (window.__implementationPlanModel && !forceRefresh) {
            if (isStaleImplementationPlanModel(window.__implementationPlanModel)) {
                try {
                    localStorage.removeItem('lastImplementationPlanModel');
                } catch { /* ignore */ }
                window.__implementationPlanModel = null;
            } else {
                renderModel(window.__implementationPlanModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchImplementationPlanData();
            if (model) {
                window.__implementationPlanModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedImplementationPlanModel()) {
                return;
            }
            await loadImplementationPlanSample();
        } catch (error) {
            console.error('Failed to initialize implementation plan page:', error);
            try {
                await loadImplementationPlanSample();
            } catch {
                window.showNotification?.('❌ Failed to load implementation plan data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyImplementationPlanModel = applyImplementationPlanModel;
    window.loadImplementationPlanSample = loadImplementationPlanSample;
    window.initializeImplementationPlanPage = initializeImplementationPlanPage;
})();
