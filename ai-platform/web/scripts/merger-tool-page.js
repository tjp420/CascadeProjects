/**
 * Merger Tool Page — file and project merging dashboard
 */
(function () {
    const SAMPLE_URL = '/data/merger-tool-sample.json';
    const SAMPLE_CACHE_BUST = '20260524ar';
    let filterStatus = 'all';
    let searchQuery = '';
    let expandedMergeId = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isMergerToolModel(payload) {
        return Boolean(payload && (
            payload.type === 'merger-tool-model' ||
            (Array.isArray(payload.merges) && payload.overview?.totalMerges != null)
        ));
    }

    function buildOverviewFromModel(raw) {
        const merges = raw.merges || [];
        const activeMerges = merges.filter((merge) => merge.status === 'in-progress').length;
        const completedMerges = merges.filter((merge) => merge.status === 'completed').length;
        const failedMerges = merges.filter((merge) => merge.status === 'failed').length;
        const totalConflicts = merges.reduce((sum, merge) => sum + (merge.conflicts || 0), 0);
        const finished = completedMerges + failedMerges;
        const derivedSuccessRate = finished
            ? Math.round((completedMerges / finished) * 100)
            : (completedMerges ? 100 : 0);

        return {
            totalMerges: merges.length,
            activeMerges,
            completedMerges,
            failedMerges,
            totalConflicts,
            avgMergeTime: raw.overview?.avgMergeTime ?? '—',
            successRate: raw.overview?.successRate ?? derivedSuccessRate
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isMergerToolModel(payload.data) ? payload.data : payload;
        if (!isMergerToolModel(raw)) return null;

        const merges = raw.merges || [];
        const overview = buildOverviewFromModel(raw);
        const loadedCount = merges.length;

        return {
            type: raw.type || 'merger-tool-model',
            title: raw.title || 'Merger Tool',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'GGUF AI Platform',
            modelInfo: raw.modelInfo || {},
            overview,
            catalogMeta: {
                loadedCount,
                declaredTotal: overview.totalMerges,
                isPartial: false
            },
            merges,
            statistics: raw.statistics || {},
            activity: raw.activity || [],
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null,
            reductionScan: raw.reductionScan || null
        };
    }

    function isStaleMergerToolModel(model) {
        if (model?.dataSource === 'repository-audit') return false;

        const overview = model?.overview || {};
        if (model?.modelInfo?.name === 'unbreakable-oracle') return true;
        if (overview.totalMerges === 25 || overview.totalConflicts === 11) return true;
        if (overview.successRate === 92 && overview.totalMerges >= 20) return true;
        if (overview.activeMerges === 2 && overview.totalMerges === 25) return true;
        if (model?.generatedBy === 'GGUF AI Platform' && !model?.dataSource) return true;
        if (model?.catalogMeta?.isPartial && model.catalogMeta.declaredTotal === 25) return true;
        if ((model?.merges || []).some((merge) =>
            /feature\/self-contained|release\/v2\.4/i.test(String(merge.source || ''))
            || /feature\/self-contained|release\/v2\.4/i.test(String(merge.target || ''))
        )) return true;
        return false;
    }

    async function fetchMergerToolData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model && !isStaleMergerToolModel(model)) return model;
            }
        } catch (error) {
            console.warn('Merger tool sample failed:', error.message);
        }

        try {
            const sampleResponse = await fetch(SAMPLE_URL);
            const samplePayload = sampleResponse.ok ? await sampleResponse.json() : null;
            const [mergesRes, overviewRes, activityRes, statsRes] = await Promise.all([
                fetch('/api/merger-tool/merges'),
                fetch('/api/merger-tool/overview'),
                fetch('/api/merger-tool/activity'),
                fetch('/api/merger-tool/statistics')
            ]);

            const readJson = async (response) => {
                const payload = await response.json();
                return payload?.data ?? payload;
            };

            const merges = mergesRes.ok ? await readJson(mergesRes) : [];
            if (!Array.isArray(merges)) return null;

            const model = normalizeModel({
                type: 'merger-tool-model',
                dataSource: samplePayload?.dataSource || 'repository-audit',
                generatedAt: samplePayload?.generatedAt || new Date().toISOString(),
                generatedBy: samplePayload?.generatedBy || 'RepositoryAudit',
                modelInfo: samplePayload?.modelInfo || {},
                overview: overviewRes.ok ? await readJson(overviewRes) : {},
                merges,
                statistics: statsRes.ok ? await readJson(statsRes) : {},
                activity: activityRes.ok ? await readJson(activityRes) : [],
                insights: samplePayload?.insights || [],
                quickActions: samplePayload?.quickActions || [],
                deprecatedNarrative: samplePayload?.deprecatedNarrative || null
            });

            if (model && !isStaleMergerToolModel(model)) return model;
        } catch (error) {
            console.warn('Merger tool API fetch failed:', error.message);
        }
        return null;
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '—';
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function statusClass(status) {
        if (status === 'in-progress') return 'in-progress';
        if (status === 'completed') return 'completed';
        if (status === 'pending') return 'pending';
        if (status === 'failed') return 'failed';
        return 'idle';
    }

    function priorityClass(priority) {
        if (priority === 'critical') return 'critical';
        if (priority === 'high') return 'high';
        if (priority === 'medium') return 'medium';
        return 'low';
    }

    function severityClass(severity) {
        if (severity === 'critical') return 'critical';
        if (severity === 'high') return 'high';
        if (severity === 'medium') return 'medium';
        return 'low';
    }

    function filteredMerges(model) {
        return (model.merges || []).filter(merge => {
            const matchStatus = filterStatus === 'all' || merge.status === filterStatus;
            const q = searchQuery.toLowerCase();
            const matchSearch = !q ||
                merge.name?.toLowerCase().includes(q) ||
                merge.source?.toLowerCase().includes(q) ||
                merge.target?.toLowerCase().includes(q) ||
                merge.type?.toLowerCase().includes(q);
            return matchStatus && matchSearch;
        });
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderStatusFilters(model);
        renderMerges(model);
        renderMergeTypes(model);
        renderQuickActions(model);
        renderReductionScan(model.reductionScan || window.__mergerReductionScan);
        renderInsights(model);
        renderActivity(model);
    }

    function renderReductionScan(scan) {
        const statsEl = document.getElementById('merger-reduction-stats');
        const candidatesEl = document.getElementById('merger-reduction-candidates');
        const metaEl = document.getElementById('merger-reduction-scan-meta');
        if (!statsEl || !candidatesEl) return;

        if (!scan?.summary) {
            statsEl.innerHTML = '<p class="merger-empty">Run Refresh to load filesystem reduction scan.</p>';
            candidatesEl.innerHTML = '';
            if (metaEl) metaEl.textContent = 'Not scanned yet';
            return;
        }

        const s = scan.summary;
        if (metaEl) {
            metaEl.textContent = `${s.filesAnalyzed} files • ${s.potentialSavingsLabel} potential savings`;
        }

        statsEl.innerHTML = `
            <div class="stat-card primary"><div class="stat-value">${s.filesAnalyzed}</div><div class="stat-label">Files Scanned</div></div>
            <div class="stat-card info"><div class="stat-value">${s.mergeCandidates}</div><div class="stat-label">Merge Candidates</div></div>
            <div class="stat-card warning"><div class="stat-value">${s.oversizedFiles}</div><div class="stat-label">Oversized</div></div>
            <div class="stat-card success"><div class="stat-value">${s.exactDuplicateGroups}</div><div class="stat-label">Exact Duplicates</div></div>
            <div class="stat-card"><div class="stat-value">${s.potentialSavingsLabel}</div><div class="stat-label">Potential Savings</div></div>
            <div class="stat-card"><div class="stat-value">${scan.inferenceMode || 'filesystem'}</div><div class="stat-label">Scan Mode</div></div>
        `;

        const candidates = (scan.mergeCandidates || []).slice(0, 6);
        const opportunities = (scan.reductionOpportunities || []).slice(0, 4);
        if (!candidates.length && !opportunities.length) {
            candidatesEl.innerHTML = '<p class="merger-empty">No merge or reduction candidates found.</p>';
            return;
        }

        candidatesEl.innerHTML = `
            ${candidates.length ? `<h4 style="margin:0 0 0.75rem;">Merge candidates</h4>` : ''}
            ${candidates.map((item) => `
                <div class="merger-insight-card priority-${escapeHtml(item.risk === 'low' ? 'high' : 'medium')}">
                    <div class="merger-insight-priority">${escapeHtml(item.mergeType || 'candidate')} • ${Math.round((item.similarity || 0) * 100)}% similar</div>
                    <h4>${escapeHtml(item.files?.map((f) => f.path).join(' ↔ ') || 'Files')}</h4>
                    <p>${escapeHtml(item.recommendation || '')}</p>
                    <div class="merger-insight-impact">Save ${escapeHtml(item.savingsLabel || '—')} • ${escapeHtml(item.effort || '—')} effort</div>
                </div>
            `).join('')}
            ${opportunities.length ? `<h4 style="margin:1rem 0 0.75rem;">Reduction opportunities</h4>` : ''}
            ${opportunities.map((item) => `
                <div class="merger-insight-card priority-${escapeHtml(item.risk === 'high' ? 'critical' : item.risk || 'medium')}">
                    <div class="merger-insight-priority">${escapeHtml(item.type || 'reduction')} • ${escapeHtml(item.method || '')}</div>
                    <h4>${escapeHtml(item.files?.map((f) => f.path).join(', ') || 'Files')}</h4>
                    <p>${escapeHtml(item.description || '')}</p>
                    <div class="merger-insight-impact">Save ${escapeHtml(item.savingsLabel || '—')}</div>
                </div>
            `).join('')}
        `;
    }

    async function fetchReductionScan() {
        try {
            const response = await fetch(`/api/merger-tool/reduction-scan?v=${SAMPLE_CACHE_BUST}`);
            if (!response.ok) return null;
            const payload = await response.json();
            return payload?.data || payload;
        } catch (error) {
            console.warn('Merger reduction scan failed:', error.message);
            return null;
        }
    }

    function renderHeader(model) {
        const lead = document.getElementById('merger-tool-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Advanced file and project merging tools';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — integration workstreams, not a live git merge queue.`
                : base;
        }
        const badge = document.getElementById('merger-tool-model-badge');
        if (badge) {
            const name = model.modelInfo?.name || 'Platform';
            const confidence = model.modelInfo?.confidence || 95;
            badge.textContent = model.dataSource === 'repository-audit'
                ? `🔀 ${name} • measured baseline`
                : `🧠 ${name} • ${confidence}% confidence`;
        }
        const updateEl = document.getElementById('merger-tool-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const o = model.overview || {};
        const activeBadge = document.getElementById('merger-badge-active');
        if (activeBadge && o.activeMerges != null) {
            activeBadge.textContent = `● ${o.activeMerges} Active`;
        }
        const conflictsBadge = document.getElementById('merger-badge-conflicts');
        if (conflictsBadge) {
            const conflicts = o.totalConflicts ?? 0;
            conflictsBadge.textContent = conflicts
                ? `⚠ ${conflicts} Conflicts`
                : '⚠ 0 Conflicts';
        }
        const successBadge = document.getElementById('merger-badge-success');
        if (successBadge && o.successRate != null) {
            successBadge.textContent = `${o.successRate}% Success`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'merger-stat-total': o.totalMerges ?? model.merges.length,
            'merger-stat-active': o.activeMerges ?? model.merges.filter(m => m.status === 'in-progress').length,
            'merger-stat-completed': o.completedMerges ?? model.merges.filter(m => m.status === 'completed').length,
            'merger-stat-conflicts': o.totalConflicts ?? model.merges.reduce((s, m) => s + (m.conflicts || 0), 0),
            'merger-stat-time': o.avgMergeTime || '—',
            'merger-stat-success': o.successRate != null ? `${o.successRate}%` : '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderStatusFilters(model) {
        const container = document.getElementById('merger-status-filters');
        if (!container) return;
        const statuses = ['all', ...new Set((model.merges || []).map(m => m.status).filter(Boolean))];
        container.innerHTML = statuses.map(st => `
            <button type="button" class="merger-filter-btn ${filterStatus === st ? 'active' : ''}" data-status="${escapeHtml(st)}">
                ${st === 'all' ? 'All Merges' : escapeHtml(st.replace(/-/g, ' '))}
            </button>
        `).join('');
    }

    function renderMerges(model) {
        const container = document.getElementById('merger-grid');
        const countEl = document.getElementById('merger-grid-count');
        if (!container) return;

        const merges = filteredMerges(model);
        if (countEl) {
            const baseCount = `${merges.length} merge${merges.length === 1 ? '' : 's'}`;
            countEl.textContent = model.catalogMeta?.isPartial
                ? `${baseCount} loaded (${model.catalogMeta.declaredTotal} total in overview)`
                : baseCount;
        }

        if (!merges.length) {
            container.innerHTML = '<p class="merger-empty">No merges match your search.</p>';
            return;
        }

        container.innerHTML = merges.map(merge => {
            const expanded = expandedMergeId === merge.id;
            const conflicts = merge.conflictsData || [];
            const pendingConflicts = conflicts.filter(c => c.status === 'pending').length;
            return `
                <div class="merger-card ${statusClass(merge.status)}" data-merge-id="${escapeHtml(merge.id)}">
                    <div class="merger-card-top">
                        <div>
                            <h4>${escapeHtml(merge.name)}</h4>
                            <span class="merger-type">${escapeHtml(merge.type || 'Merge')}</span>
                        </div>
                        <span class="merger-status ${statusClass(merge.status)}">${escapeHtml((merge.status || 'idle').replace(/-/g, ' '))}</span>
                    </div>
                    <div class="merger-branches">
                        <code>${escapeHtml(merge.source || '')}</code>
                        <span>→</span>
                        <code>${escapeHtml(merge.target || '')}</code>
                    </div>
                    <div class="merger-meta">
                        <div><strong>${merge.files ?? '—'}</strong><span>Files</span></div>
                        <div><strong>${merge.conflicts ?? 0}</strong><span>Conflicts</span></div>
                        <div><strong>${escapeHtml(merge.estimatedTime || '—')}</strong><span>Est. Time</span></div>
                        <div><strong class="merger-priority ${priorityClass(merge.priority)}">${escapeHtml(merge.priority || '—')}</strong><span>Priority</span></div>
                    </div>
                    <div class="merger-progress-wrap">
                        <div class="merger-progress-track"><span style="width:${merge.progress ?? 0}%"></span></div>
                        <span class="merger-progress-label">${merge.progress ?? 0}%</span>
                    </div>
                    <div class="merger-card-footer">
                        <span>👤 ${escapeHtml(merge.author || '—')}</span>
                        ${pendingConflicts ? `<span class="merger-conflict-badge">${pendingConflicts} pending</span>` : ''}
                    </div>
                    <div class="merger-card-actions">
                        <button type="button" class="btn btn-primary btn-sm merger-toggle-btn" data-merge-id="${escapeHtml(merge.id)}">${expanded ? 'Hide' : 'View'} Conflicts</button>
                        ${merge.status === 'in-progress' ? `<button type="button" class="btn btn-outline-light btn-sm merger-pause-btn" data-merge-id="${escapeHtml(merge.id)}">Pause</button>` : ''}
                        ${merge.status === 'pending' ? `<button type="button" class="btn btn-outline-success btn-sm merger-start-btn" data-merge-id="${escapeHtml(merge.id)}">Start</button>` : ''}
                    </div>
                    ${expanded && conflicts.length ? `
                        <div class="merger-conflicts-list">
                            ${conflicts.map(c => `
                                <div class="merger-conflict-item ${severityClass(c.severity)} ${c.status === 'resolved' ? 'resolved' : ''}">
                                    <div class="merger-conflict-header">
                                        <code>${escapeHtml(c.file)}</code>
                                        <span class="merger-conflict-severity ${severityClass(c.severity)}">${escapeHtml(c.severity || 'low')}</span>
                                    </div>
                                    <p>${escapeHtml(c.description || '')}</p>
                                    <div class="merger-conflict-footer">
                                        <span>Line ${c.line ?? '—'} · ${escapeHtml(c.type || '')}</span>
                                        <span>${escapeHtml(c.resolution || c.status || '')}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : expanded ? '<p class="merger-empty">No conflicts.</p>' : ''}
                </div>
            `;
        }).join('');
    }

    function renderMergeTypes(model) {
        const container = document.getElementById('merger-types-bars');
        if (!container) return;

        const types = model.statistics?.mergeTypes || {};
        const entries = Object.entries(types);
        if (!entries.length) {
            container.innerHTML = '<p class="merger-empty">No merge type statistics.</p>';
            return;
        }

        const max = Math.max(...entries.map(([, v]) => v), 1);
        container.innerHTML = entries.map(([name, count]) => `
            <div class="merger-type-item">
                <div class="merger-type-label">
                    <span>${escapeHtml(name)}</span>
                    <span>${count}</span>
                </div>
                <div class="merger-type-track"><span style="width:${Math.round((count / max) * 100)}%"></span></div>
            </div>
        `).join('');
    }

    function renderQuickActions(model) {
        const container = document.getElementById('merger-quick-actions');
        if (!container) return;

        const actions = model.quickActions || [];
        if (!actions.length) {
            container.innerHTML = '<p class="merger-empty">No quick actions.</p>';
            return;
        }

        container.innerHTML = actions.map(action => `
            <button type="button" class="merger-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span class="merger-quick-icon">${escapeHtml(action.icon || '⚡')}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('merger-insights-grid');
        if (!container) return;

        const insights = model.insights || [];
        if (!insights.length) {
            container.innerHTML = '<p class="merger-empty">No insights available.</p>';
            return;
        }

        container.innerHTML = insights.map(item => `
            <div class="merger-insight-card priority-${escapeHtml(item.priority || 'low')}">
                <div class="merger-insight-priority">${escapeHtml(item.priority || 'info')} priority</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description || '')}</p>
                <div class="merger-insight-impact">${escapeHtml(item.impact || '')}</div>
            </div>
        `).join('');
    }

    function renderActivity(model) {
        const tbody = document.getElementById('merger-activity-body');
        if (!tbody) return;

        const rows = model.activity || [];
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4">No recent activity.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${formatTimeAgo(row.timestamp)}</td>
                <td><span class="merger-activity-type">${escapeHtml((row.type || '').replace(/_/g, ' '))}</span></td>
                <td>${escapeHtml(row.description || '')}</td>
                <td>${escapeHtml(row.user || '—')}</td>
            </tr>
        `).join('');
    }

    function navigateTo(sectionName) {
        const navLink = document.querySelector(`.nav-link[onclick*="'${sectionName}'"]`);
        if (typeof window.showSection === 'function') {
            window.showSection(sectionName, navLink);
        }
    }

    function bindActions() {
        const root = document.getElementById('merger-tool-root');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        document.getElementById('merger-refresh')?.addEventListener('click', () => initializeMergerToolPage(true));
        document.getElementById('merger-load-sample')?.addEventListener('click', loadMergerToolSample);

        document.getElementById('merger-export-json')?.addEventListener('click', () => {
            if (!window.__mergerToolModel) return;
            const blob = new Blob([JSON.stringify(window.__mergerToolModel, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'merger-tool-model.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('merger-import-json')?.addEventListener('click', () => {
            document.getElementById('merger-import-file')?.click();
        });

        document.getElementById('merger-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyMergerToolModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Merger tool data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });

        document.getElementById('merger-search')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__mergerToolModel) renderMerges(window.__mergerToolModel);
        });

        root.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('.merger-filter-btn');
            if (filterBtn) {
                filterStatus = filterBtn.dataset.status || 'all';
                if (window.__mergerToolModel) {
                    renderStatusFilters(window.__mergerToolModel);
                    renderMerges(window.__mergerToolModel);
                }
                return;
            }

            const toggleBtn = event.target.closest('.merger-toggle-btn');
            if (toggleBtn) {
                expandedMergeId = expandedMergeId === toggleBtn.dataset.mergeId ? null : toggleBtn.dataset.mergeId;
                if (window.__mergerToolModel) renderMerges(window.__mergerToolModel);
                return;
            }

            const pauseBtn = event.target.closest('.merger-pause-btn');
            if (pauseBtn) {
                window.showNotification?.(`⏸ Paused merge ${pauseBtn.dataset.mergeId}`, 'info');
                return;
            }

            const startBtn = event.target.closest('.merger-start-btn');
            if (startBtn) {
                window.showNotification?.(`▶ Started merge ${startBtn.dataset.mergeId}`, 'success');
                return;
            }

            const quickAction = event.target.closest('.merger-quick-action');
            if (quickAction) {
                if (quickAction.dataset.section) {
                    navigateTo(quickAction.dataset.section);
                } else if (quickAction.dataset.action === 'export') {
                    document.getElementById('merger-export-json')?.click();
                } else if (quickAction.dataset.action === 'refresh') {
                    initializeMergerToolPage(true);
                } else {
                    window.showNotification?.(`🔀 ${quickAction.textContent?.trim()}`, 'info');
                }
            }
        });
    }

    function applyMergerToolModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model || isStaleMergerToolModel(model)) {
            window.showNotification?.('❌ Stale merger fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__mergerToolModel = model;
        expandedMergeId = null;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'merger-tool'\"]");
            window.showSection('merger-tool', navLink);
        }

        try {
            localStorage.setItem('lastMergerToolModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported merger tool',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedMergerToolModel() {
        try {
            const raw = localStorage.getItem('lastMergerToolModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model || isStaleMergerToolModel(model)) return false;
            window.__mergerToolModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadMergerToolSample() {
        const root = document.getElementById('merger-tool-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyMergerToolModel(await response.json(), 'merger-tool-sample.json');
            window.showNotification?.('✅ Loaded merger tool sample', 'success');
        } catch (error) {
            console.error('Failed to load merger tool sample:', error);
            window.showNotification?.('❌ Failed to load merger tool sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeMergerToolPage(forceRefresh = false) {
        const root = document.getElementById('merger-tool-root');
        if (!root) return;

        if (window.__mergerToolModel && !forceRefresh) {
            renderModel(window.__mergerToolModel);
            bindActions();
            return;
        }

        root.classList.add('loading');
        try {
            const [model, reductionScan] = await Promise.all([
                fetchMergerToolData(),
                fetchReductionScan()
            ]);
            if (reductionScan) {
                window.__mergerReductionScan = reductionScan;
            }
            if (model) {
                if (!model.reductionScan && reductionScan) {
                    model.reductionScan = reductionScan;
                }
                window.__mergerToolModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedMergerToolModel()) {
                return;
            }

            throw new Error('No merger tool data available');
        } catch (error) {
            console.error('Failed to initialize merger tool page:', error);
            window.showNotification?.('❌ Failed to load merger tool data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeMergerToolPage = initializeMergerToolPage;
    window.loadMergerToolSample = loadMergerToolSample;
    window.applyMergerToolModel = applyMergerToolModel;
})();
