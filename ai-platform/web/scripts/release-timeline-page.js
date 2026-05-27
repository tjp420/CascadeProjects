/**
 * Release Timeline Page — self-contained release schedule dashboard
 */
(function () {
    const SAMPLE_URL = '/data/release-timeline-sample.json';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isReleaseTimelineReport(payload) {
        return Boolean(payload && (
            payload.type === 'release-timeline-report'
            || (payload.releaseOverview && Array.isArray(payload.releaseSchedule))
        ));
    }

    function buildOverviewFromSchedule(raw) {
        const schedule = raw.releaseSchedule || [];
        const useDerived = raw.dataSource === 'repository-audit';

        if (!useDerived || !schedule.length) {
            return raw.releaseOverview || {};
        }

        const completed = schedule.filter((release) => release.status === 'completed').length;
        const inProgress = schedule.filter((release) => {
            const status = String(release.status || '').toLowerCase();
            return status === 'in-progress' || status === 'in progress' || status === 'current';
        }).length;
        const upcoming = schedule.filter((release) => {
            const status = String(release.status || '').toLowerCase();
            return status === 'upcoming' || status === 'planned';
        }).length;
        const current = schedule.find((release) => {
            const status = String(release.status || '').toLowerCase();
            return status === 'in-progress' || status === 'in progress' || status === 'current';
        });

        return {
            ...(raw.releaseOverview || {}),
            totalReleases: schedule.length,
            completedReleases: completed,
            inProgressReleases: inProgress,
            upcomingReleases: upcoming,
            currentRelease: raw.releaseOverview?.currentRelease ?? current?.version ?? '—'
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isReleaseTimelineReport(payload.data) ? payload.data : payload;
        if (!isReleaseTimelineReport(raw)) return null;
        return {
            type: raw.type || 'release-timeline-report',
            title: raw.title || 'Release Timeline Report',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'Cascade AI Platform',
            modelInfo: raw.modelInfo || {},
            releaseOverview: buildOverviewFromSchedule(raw),
            releaseSchedule: raw.releaseSchedule || [],
            currentSprintDetails: raw.currentSprintDetails || {},
            upcomingReleaseDetails: raw.upcomingReleaseDetails || {},
            riskAssessment: raw.riskAssessment || {},
            recommendations: raw.recommendations || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function parsePercent(value) {
        const num = parseFloat(String(value || '').replace('%', ''));
        return Number.isFinite(num) ? num : 0;
    }

    function timelineClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'completed') return 'completed';
        if (value === 'in-progress' || value === 'in progress' || value === 'current') return 'current';
        return 'upcoming';
    }

    function markerIcon(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'completed') return '✓';
        if (value === 'in-progress' || value === 'in progress' || value === 'current') return '↻';
        return '⚑';
    }

    async function fetchReleaseTimelineData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model && !isStaleReleaseTimelineModel(model)) return model;
            }
        } catch (error) {
            console.warn('Release timeline sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/release-timeline');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model && !isStaleReleaseTimelineModel(model)) return model;
            }
        } catch (error) {
            console.warn('Release timeline API failed:', error.message);
        }
        return null;
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderTimeline(model);
        renderDetails(model);
        renderRisks(model);
        renderRecommendations(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('release-timeline-page-lead');
        if (lead) {
            const base = `${model.generatedBy} • ${new Date(model.generatedAt).toLocaleString()}`;
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — engineering milestones, not shipped product releases.`
                : base;
        }
        const badges = document.getElementById('rt-header-badges');
        const o = model.releaseOverview || {};
        if (badges) {
            badges.innerHTML = `
                <span class="badge bg-primary me-2">🚀 ${o.totalReleases ?? 0} Releases</span>
                <span class="badge bg-success me-2">✅ ${o.completedReleases ?? 0} Completed</span>
                <span class="badge bg-warning me-2">🔄 ${o.inProgressReleases ?? 0} In Progress</span>
                <span class="badge bg-info me-2">⏳ ${o.upcomingReleases ?? 0} Upcoming</span>
            `;
        }
        const updateEl = document.getElementById('release-timeline-last-update');
        if (updateEl) updateEl.textContent = `Updated ${new Date(model.generatedAt).toLocaleTimeString()}`;
    }

    function renderOverview(model) {
        const o = model.releaseOverview || {};
        const map = {
            'rt-stat-current': o.currentRelease ?? '—',
            'rt-stat-next': o.nextReleaseDate ?? '—',
            'rt-stat-final': o.finalTargetDate ?? '—',
            'rt-stat-ontrack': o.onTrackPercentage ?? '—'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderTimeline(model) {
        const container = document.getElementById('rt-timeline');
        if (!container) return;
        container.innerHTML = (model.releaseSchedule || []).map((release) => {
            const cls = timelineClass(release.status);
            const achievements = (release.achievements || []).map((item) => {
                const prefix = cls === 'completed' ? '✅' : cls === 'current' ? '🔄' : '⏳';
                return `<span>${prefix} ${escapeHtml(item)}</span>`;
            }).join('');
            return `
                <div class="timeline-item ${cls}">
                    <div class="timeline-marker">${markerIcon(release.status)}</div>
                    <div class="timeline-content">
                        <div class="timeline-date">${escapeHtml(release.date)} • ${escapeHtml(release.completionRate || '')}</div>
                        <h4>${escapeHtml(release.version)} — ${escapeHtml(release.title)}</h4>
                        <p>${escapeHtml(release.description || '')}</p>
                        <div class="timeline-achievements">${achievements}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTaskList(title, detail, progressKey) {
        const progress = parsePercent(detail[progressKey] || detail.progress || detail.planningProgress);
        const completed = detail.completedTasks || [];
        const inProgress = detail.inProgressTasks || [];
        const pending = detail.pendingTasks || [];
        const items = [
            ...completed.map((t) => `<li>✅ ${escapeHtml(t)}</li>`),
            ...inProgress.map((t) => `<li>🔄 ${escapeHtml(t)}</li>`),
            ...pending.map((t) => `<li>⏳ ${escapeHtml(t)}</li>`)
        ].join('');
        return `
            <div class="rt-detail-card">
                <h5>${escapeHtml(title)} (${progress}%)</h5>
                <div class="progress-overview">
                    <div class="progress-header"><span>Progress</span><span>${progress}%</span></div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'pending'}" style="width:${Math.min(100, progress)}%"></div>
                    </div>
                </div>
                <ul class="rt-task-list">${items || '<li>No tasks listed</li>'}</ul>
            </div>
        `;
    }

    function renderDetails(model) {
        const container = document.getElementById('rt-details-grid');
        if (!container) return;
        const current = model.currentSprintDetails || {};
        const upcoming = model.upcomingReleaseDetails || {};
        container.innerHTML = `
            ${renderTaskList(`${current.version || 'Current'} Sprint`, current, 'progress')}
            ${renderTaskList(`${upcoming.version || 'Upcoming'} Planning`, upcoming, 'planningProgress')}
        `;
    }

    function renderRisks(model) {
        const container = document.getElementById('rt-risks');
        if (!container) return;
        const risks = model.riskAssessment || {};
        container.innerHTML = Object.entries(risks)
            .filter(([key]) => key !== 'notes')
            .map(([key, value]) => `
            <div class="rt-risk-item">
                <span>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</span>
                <strong>${escapeHtml(String(value))}</strong>
            </div>
        `).join('');
    }

    function renderRecommendations(model) {
        const container = document.getElementById('rt-recommendations');
        if (!container) return;
        container.innerHTML = (model.recommendations || []).map((item) => `
            <li>${escapeHtml(item)}</li>
        `).join('') || '<li>No recommendations</li>';
    }

    function bindActions() {
        if (window.__releaseTimelineBound) return;
        window.__releaseTimelineBound = true;

        document.getElementById('rt-refresh')?.addEventListener('click', () => initializeReleaseTimelinePage(true));
        document.getElementById('rt-load-sample')?.addEventListener('click', () => loadReleaseTimelineSample());
        document.getElementById('rt-export-json')?.addEventListener('click', () => {
            const model = window.__releaseTimelineModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `release-timeline-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Release timeline exported', 'success');
        });
        document.getElementById('rt-import-json')?.addEventListener('click', () => {
            document.getElementById('rt-import-file')?.click();
        });
        document.getElementById('rt-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                await applyReleaseTimelineModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Release timeline imported', 'success');
            } catch (error) {
                window.showNotification?.(`❌ Import failed: ${error.message}`, 'error');
            } finally {
                event.target.value = '';
            }
        });
    }

    async function applyReleaseTimelineModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('JSON must be a release-timeline-report object');
        if (isStaleReleaseTimelineModel(model)) {
            throw new Error('Stale release timeline fiction rejected — load repository-audit sample');
        }
        window.__releaseTimelineModel = model;
        renderModel(model);
        bindActions();
        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'release-timeline'\"]");
            window.showSection('release-timeline', navLink);
        }
        try {
            localStorage.setItem('lastReleaseTimelineModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported report',
                savedAt: new Date().toISOString()
            }));
        } catch {
            /* ignore */
        }
    }

    async function loadReleaseTimelineSample() {
        const response = await fetch(SAMPLE_URL);
        if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
        await applyReleaseTimelineModel(await response.json(), 'release-timeline-sample.json');
        window.showNotification?.('✅ Loaded release timeline sample', 'success');
    }

    function isStaleReleaseTimelineModel(model) {
        if (!model) return true;
        const overview = model?.releaseOverview || {};
        const cross = model?.crossReferences || {};
        const sprint = model?.currentSprintDetails || {};
        if (model?.generatedBy === 'Cascade AI Platform' && !model?.dataSource) return true;
        if (overview.currentRelease === 'v2.0' || overview.currentRelease === 'v3.0') return true;
        if (String(overview.nextReleaseDate || '').includes('August 30')) return true;
        if (String(overview.finalTargetDate || '').includes('November 15')) return true;
        if (overview.onTrackPercentage === '89%' || overview.onTrackPercentage === '72%') return true;
        if (cross.jestTests === 502 || cross.repositoryAuditSamples === '33/33') return true;
        if (sprint.progress === '75%' || (sprint.inProgressTasks || []).some((t) =>
            String(t).includes('docker-compose.phase2')
        )) return true;
        if ((model?.releaseSchedule || []).some((release) =>
            release.version === 'v2.0' || release.version === 'v3.0'
            || String(release.date || '').includes('2026-11-15')
            || (release.version === 'v0.8-beta' && release.status === 'in-progress' && release.completionRate === '75%')
        )) return true;
        if (model?.dataSource === 'repository-audit') return false;
        return false;
    }

    function restoreSavedModel() {
        try {
            const raw = localStorage.getItem('lastReleaseTimelineModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model || isStaleReleaseTimelineModel(model)) return false;
            window.__releaseTimelineModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function initializeReleaseTimelinePage(forceRefresh = false) {
        const root = document.getElementById('release-timeline-root');
        if (!root) return;

        if (window.__releaseTimelineModel && !forceRefresh) {
            renderModel(window.__releaseTimelineModel);
            bindActions();
            return;
        }

        if (forceRefresh) {
            window.__releaseTimelineModel = null;
        }

        root.classList.add('loading');
        try {
            const model = await fetchReleaseTimelineData();
            if (model) {
                window.__releaseTimelineModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedModel()) {
                return;
            }
            throw new Error('No release timeline data available');
        } catch (error) {
            console.error('Failed to initialize release timeline page:', error);
            window.showNotification?.(`❌ Failed to load release timeline: ${error.message}`, 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeReleaseTimelinePage = initializeReleaseTimelinePage;
    window.loadReleaseTimelineSample = loadReleaseTimelineSample;
    window.applyReleaseTimelineModel = applyReleaseTimelineModel;
    window.downloadReleaseTimelineReport = function downloadReleaseTimelineReport() {
        if (window.__releaseTimelineModel) {
            document.getElementById('rt-export-json')?.click();
            return;
        }
        loadReleaseTimelineSample()
            .then(() => document.getElementById('rt-export-json')?.click())
            .catch((error) => window.showNotification?.(`❌ ${error.message}`, 'error'));
    };
})();
