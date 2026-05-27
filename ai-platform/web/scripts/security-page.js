/**
 * Security Page — threat detection, vulnerabilities, and compliance
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ba';
    const SAMPLE_URL = `/data/security-dashboard-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let trendsChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isSecurityModel(payload) {
        return Boolean(payload && (
            payload.type === 'security-dashboard-model' ||
            (payload.overview?.activeThreats != null && Array.isArray(payload.threats))
        ));
    }

    function buildOverviewFromModel(raw) {
        const threats = raw.threats || [];
        const vulnerabilities = raw.vulnerabilities || [];
        const incidents = raw.incidents || [];
        const compliance = raw.compliance || {};
        const openVulns = vulnerabilities.filter((item) => item.status !== 'resolved');
        const criticalVulns = openVulns.filter((item) => item.severity === 'critical').length;

        return {
            activeThreats: threats.length,
            criticalVulnerabilities: criticalVulns,
            securityScore: raw.overview?.securityScore ?? compliance.overall ?? 0,
            complianceRate: raw.overview?.complianceRate ?? compliance.overall ?? 0,
            totalIncidents: incidents.length,
            resolvedIncidents: incidents.filter((item) => item.status === 'resolved').length,
            npmAuditTotal: raw.npmAudit?.summary?.total ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isSecurityModel(payload.data) ? payload.data : payload;
        if (!isSecurityModel(raw)) return null;

        const compliance = raw.compliance || {};
        const overview = buildOverviewFromModel(raw);

        return {
            type: raw.type || 'security-dashboard-model',
            title: raw.title || 'Security Dashboard',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'Cascade AI Platform',
            modelInfo: raw.modelInfo || {},
            overview,
            trends: raw.trends || { labels: [], threats: [], score: [] },
            threats: raw.threats || [],
            vulnerabilities: raw.vulnerabilities || [],
            incidents: raw.incidents || [],
            compliance: {
                soc2: compliance.soc2 ?? 0,
                gdpr: compliance.gdpr ?? 0,
                hipaa: compliance.hipaa ?? 0,
                iso27001: compliance.iso27001 ?? 0,
                overall: compliance.overall ?? overview.complianceRate,
                auditsScheduled: compliance.auditsScheduled ?? 0,
                frameworks: compliance.frameworks || []
            },
            insights: raw.insights || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null,
            npmAudit: raw.npmAudit || null
        };
    }

    function mergeNpmAudit(model, auditPayload) {
        if (!model || !auditPayload || auditPayload.error) return model;

        const checklist = (model.vulnerabilities || []).filter((item) => item.source !== 'npm-audit');
        const updatedChecklist = checklist.map((item) => (
            item.id === 'SEC-004'
                ? {
                    ...item,
                    status: 'resolved',
                    title: 'Dependency audit wired to Security page (npm audit)'
                }
                : item
        ));
        const npmVulns = auditPayload.vulnerabilities || [];
        const merged = [...updatedChecklist, ...npmVulns];
        const insights = (model.insights || []).filter((item) =>
            !String(item.title || '').match(/Run npm audit separately/i)
        );
        const summary = auditPayload.summary || auditPayload.metadata || {};
        if (summary.total != null) {
            insights.push({
                priority: summary.critical ? 'high' : summary.high ? 'medium' : 'low',
                title: `npm audit: ${summary.total} dependency ${summary.total === 1 ? 'issue' : 'issues'}`,
                description: `Live npm audit — critical ${summary.critical || 0}, high ${summary.high || 0}, moderate ${summary.moderate || 0}, low ${summary.low || 0}.`,
                impact: 'Measured dependency posture'
            });
        }

        const mergedModel = {
            ...model,
            vulnerabilities: merged,
            insights,
            npmAudit: {
                generatedAt: auditPayload.generatedAt || new Date().toISOString(),
                summary,
                error: auditPayload.error || null
            }
        };
        mergedModel.overview = buildOverviewFromModel(mergedModel);
        return mergedModel;
    }

    async function fetchNpmAudit() {
        try {
            const response = await fetch('/api/security/npm-audit');
            if (!response.ok) return null;
            const payload = await response.json();
            return payload?.data ?? payload;
        } catch (error) {
            console.warn('npm audit fetch failed:', error.message);
            return null;
        }
    }

    function clearSavedSecurityModel() {
        try {
            localStorage.removeItem('lastSecurityDashboardModel');
        } catch {
            /* ignore */
        }
    }

    function isStaleSecurityModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const isOracleFiction = model?.modelInfo?.name === 'unbreakable-oracle'
            || overview.activeThreats === 12 || overview.activeThreats >= 10
            || overview.criticalVulnerabilities === 8
            || overview.securityScore === 85.7 || overview.complianceRate === 92.3
            || model?.generatedBy === 'Cascade AI Platform' && !model?.dataSource
            || (model?.threats || []).some((threat) =>
                String(threat.type || '').match(/DDoS|Malware|WAF/i)
                || String(threat.source || '').includes('CDN')
            )
            || (model?.vulnerabilities || []).some((item) =>
                String(item.cve || '').includes('CVE-2024-XXXX')
            )
            || (model?.compliance?.soc2 ?? 0) >= 90 && (model?.compliance?.gdpr ?? 0) >= 95;
        if (isOracleFiction) return true;
        if (model?.dataSource !== 'repository-audit') return false;

        const sec003 = (model?.vulnerabilities || []).find((item) => item.id === 'SEC-003');
        const hasPartialPayload = !(model.vulnerabilities || []).length
            || !(model.incidents || []).length
            || !(model.compliance?.frameworks || []).length
            || !(model.insights || []).length
            || !(model.quickActions || []).length
            || !(model.trends?.labels || []).length;

        return sec003?.status === 'in-progress'
            || String(sec003?.title || '').includes('previously shown as live telemetry')
            || hasPartialPayload;
    }

    async function fetchSampleSecurityModel() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) return null;
            let model = normalizeModel(await response.json());
            if (model && !isStaleSecurityModel(model)) {
                const audit = await fetchNpmAudit();
                if (audit) model = mergeNpmAudit(model, audit);
                return model;
            }
            if (model) clearSavedSecurityModel();
        } catch (error) {
            console.warn('Security sample failed:', error.message);
        }
        return null;
    }

    async function fetchSecurityData() {
        const sampleModel = await fetchSampleSecurityModel();
        if (sampleModel) return sampleModel;

        try {
            const sampleResponse = await fetch(SAMPLE_URL);
            const samplePayload = sampleResponse.ok ? await sampleResponse.json() : null;
            const [overviewRes, threatsRes, vulnsRes, incidentsRes, complianceRes, auditRes] = await Promise.all([
                fetch('/api/security/overview'),
                fetch('/api/security/threats'),
                fetch('/api/security/vulnerabilities'),
                fetch('/api/security/incidents'),
                fetch('/api/security/compliance'),
                fetch('/api/security/npm-audit')
            ]);

            if (!overviewRes.ok) return null;

            const readJson = async (response) => {
                const payload = await response.json();
                return payload?.data ?? payload;
            };

            let model = normalizeModel({
                type: 'security-dashboard-model',
                dataSource: samplePayload?.dataSource || 'repository-audit',
                generatedAt: samplePayload?.generatedAt || new Date().toISOString(),
                generatedBy: samplePayload?.generatedBy || 'RepositoryAudit',
                modelInfo: samplePayload?.modelInfo || {},
                overview: await readJson(overviewRes),
                threats: threatsRes.ok ? await readJson(threatsRes) : (samplePayload?.threats || []),
                vulnerabilities: vulnsRes.ok ? await readJson(vulnsRes) : (samplePayload?.vulnerabilities || []),
                incidents: incidentsRes.ok ? await readJson(incidentsRes) : (samplePayload?.incidents || []),
                compliance: complianceRes.ok ? await readJson(complianceRes) : (samplePayload?.compliance || {}),
                trends: samplePayload?.trends || { labels: [], threats: [], score: [] },
                insights: samplePayload?.insights || [],
                quickActions: samplePayload?.quickActions || [],
                deprecatedNarrative: samplePayload?.deprecatedNarrative || null
            });
            if (model && !isStaleSecurityModel(model)) {
                if (auditRes.ok) {
                    model = mergeNpmAudit(model, await readJson(auditRes));
                }
                return model;
            }
        } catch (error) {
            console.warn('Security API failed:', error.message);
        }

        return null;
    }

    function severityClass(severity) {
        const value = String(severity || '').toLowerCase();
        if (value === 'critical') return 'danger';
        if (value === 'high') return 'danger';
        if (value === 'medium' || value === 'warning') return 'warning';
        return 'good';
    }

    function statusClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'resolved' || value === 'blocked' || value === 'mitigated') return 'good';
        if (value === 'active' || value === 'open' || value === 'investigating') return 'warning';
        if (value === 'critical') return 'danger';
        return 'neutral';
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return date.toLocaleDateString();
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderChart(model);
        renderThreats(model);
        renderVulnerabilities(model);
        renderIncidents(model);
        renderCompliance(model);
        renderInsights(model);
        renderQuickActions(model);
    }

    function renderHeader(model) {
        const lead = document.getElementById('security-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Threat detection, vulnerabilities, and compliance';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — platform checklist, not a live SOC feed.`
                : base;
        }
        const badge = document.getElementById('security-model-badge');
        if (badge) {
            const name = model.modelInfo?.name || 'Platform';
            const confidence = model.modelInfo?.confidence || 95;
            badge.textContent = model.dataSource === 'repository-audit'
                ? `🛡️ ${name} • measured baseline`
                : `🧠 ${name} • ${confidence}% confidence`;
        }
        const updateEl = document.getElementById('security-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const o = model.overview || {};
        const threatsBadge = document.getElementById('security-badge-threats');
        if (threatsBadge && o.activeThreats != null) {
            threatsBadge.textContent = `● ${o.activeThreats} Threats`;
        }
        const vulnsBadge = document.getElementById('security-badge-vulns');
        if (vulnsBadge) {
            const critical = o.criticalVulnerabilities ?? 0;
            vulnsBadge.textContent = critical
                ? `⚠ ${critical} Critical`
                : '⚠ 0 Critical CVEs';
        }
        const scoreBadge = document.getElementById('security-badge-score');
        if (scoreBadge && o.securityScore != null) {
            scoreBadge.textContent = `🛡️ ${o.securityScore}% Score`;
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'security-stat-score': o.securityScore != null ? `${o.securityScore}%` : '—',
            'security-stat-compliance': o.complianceRate != null ? `${o.complianceRate}%` : '—',
            'security-stat-threats': String(o.activeThreats ?? '—'),
            'security-stat-vulns': String(o.criticalVulnerabilities ?? '—'),
            'security-stat-incidents': `${o.resolvedIncidents ?? 0}/${o.totalIncidents ?? 0}`,
            'security-stat-audits': String(model.compliance?.auditsScheduled ?? '—')
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderChart(model) {
        const canvas = document.getElementById('securityTrendsChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const trends = model.trends || {};
        const labels = trends.labels || [];
        const scores = trends.score || [];
        const minScore = scores.length ? Math.min(...scores) : 70;
        const yMin = Math.max(0, Math.floor(minScore / 10) * 10 - 5);
        const datasets = [
            {
                label: 'Security Score',
                data: trends.score || [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y'
            },
            {
                label: 'Active Threats',
                data: trends.threats || [],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y1'
            }
        ];

        if (trendsChart) {
            trendsChart.data.labels = labels;
            trendsChart.data.datasets = datasets;
            trendsChart.options.scales.y.min = yMin;
            trendsChart.update();
            return;
        }

        trendsChart = new Chart(canvas, {
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
                        position: 'left',
                        min: yMin,
                        max: 100,
                        ticks: { color: '#94a3b8', callback: (v) => `${v}%` },
                        grid: { color: 'rgba(51, 65, 85, 0.5)' }
                    },
                    y1: {
                        position: 'right',
                        min: 0,
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#fca5a5' }
                    }
                }
            }
        });
    }

    function renderThreats(model) {
        const body = document.getElementById('security-threats-body');
        if (!body) return;
        body.innerHTML = (model.threats || []).map((threat) => `
            <tr>
                <td><strong>${escapeHtml(threat.type)}</strong></td>
                <td><span class="security-severity-badge ${severityClass(threat.severity)}">${escapeHtml(threat.severity)}</span></td>
                <td><span class="security-status-badge ${statusClass(threat.status)}">${escapeHtml(threat.status)}</span></td>
                <td>${escapeHtml(threat.source)}</td>
                <td>${formatDate(threat.detectedAt)}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="security-empty">No active threats</td></tr>';
    }

    function renderVulnerabilities(model) {
        const body = document.getElementById('security-vulns-body');
        if (!body) return;
        body.innerHTML = (model.vulnerabilities || []).map((vuln) => `
            <tr>
                <td><strong>${escapeHtml(vuln.title)}</strong></td>
                <td><span class="security-severity-badge ${severityClass(vuln.severity)}">${escapeHtml(vuln.severity)}</span></td>
                <td><span class="security-status-badge ${statusClass(vuln.status)}">${escapeHtml(vuln.status)}</span></td>
                <td><code>${escapeHtml(vuln.component)}</code></td>
                <td>${escapeHtml(vuln.cve || '—')}</td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="security-empty">No vulnerabilities</td></tr>';
    }

    function renderIncidents(model) {
        const container = document.getElementById('security-incidents-list');
        if (!container) return;
        container.innerHTML = (model.incidents || []).map((incident) => `
            <div class="security-incident ${severityClass(incident.severity)}">
                <div class="security-incident-header">
                    <strong>${escapeHtml(incident.title)}</strong>
                    <span>${formatDate(incident.reportedAt)}</span>
                </div>
                <span class="security-incident-meta">${escapeHtml(incident.severity)} • ${escapeHtml(incident.status)}</span>
            </div>
        `).join('') || '<p class="security-empty">No incidents recorded</p>';
    }

    function renderCompliance(model) {
        const container = document.getElementById('security-compliance-bars');
        if (!container) return;
        const c = model.compliance || {};
        const items = (c.frameworks && c.frameworks.length)
            ? c.frameworks
            : [
                { label: 'SOC 2', value: c.soc2 },
                { label: 'GDPR', value: c.gdpr },
                { label: 'HIPAA', value: c.hipaa },
                { label: 'ISO 27001', value: c.iso27001 }
            ];
        container.innerHTML = items.map((item) => {
            const pct = Math.min(100, Math.max(0, Number(item.value) || 0));
            const barClass = pct >= 95 ? 'good' : pct >= 85 ? 'warning' : 'danger';
            return `
                <div class="security-comp-item">
                    <div class="security-comp-label">
                        <span>${escapeHtml(item.label)}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="security-comp-track"><span class="${barClass}" style="width:${pct}%"></span></div>
                </div>`;
        }).join('');
    }

    function renderInsights(model) {
        const container = document.getElementById('security-insights-grid');
        if (!container) return;
        container.innerHTML = (model.insights || []).map((item) => `
            <div class="security-insight-card priority-${escapeHtml(item.priority)}">
                <div class="security-insight-priority">${escapeHtml(item.priority)}</div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.description)}</p>
                <div class="security-insight-impact">${escapeHtml(item.impact)}</div>
            </div>
        `).join('') || '<p class="security-empty">No AI insights included in this payload.</p>';
    }

    function renderQuickActions(model) {
        const container = document.getElementById('security-quick-actions');
        if (!container) return;
        container.innerHTML = (model.quickActions || []).map((action) => `
            <button type="button" class="btn btn-outline-light security-action-btn" data-action-id="${escapeHtml(action.id)}">
                ${escapeHtml(action.icon || '⚡')} ${escapeHtml(action.label)}
            </button>
        `).join('');
    }

    let actionsBound = false;
    let quickActionInFlight = false;

    async function refreshSecurityChecklist() {
        clearSavedSecurityModel();
        window.__securityModel = null;
        trendsChart = null;
        await loadSecuritySample();
    }

    async function runSecurityNpmAudit() {
        window.showNotification?.('🔍 Running npm audit…', 'info');
        await initializeSecurityPage(true);
        const total = window.__securityModel?.npmAudit?.summary?.total;
        if (total != null) {
            window.showNotification?.(`✅ npm audit complete — ${total} dependency ${total === 1 ? 'issue' : 'issues'}`, 'success');
        } else {
            window.showNotification?.('✅ Security data refreshed', 'success');
        }
    }

    function exportSecurityJson() {
        if (!window.__securityModel) {
            window.showNotification?.('❌ No security data to export — refresh first', 'error');
            return;
        }
        const blob = new Blob([JSON.stringify(window.__securityModel, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `security-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        window.showNotification?.('✅ Security data exported', 'success');
    }

    function openPhase2AuthReview() {
        document.getElementById('phase2-auth-signin')?.click();
        document.querySelectorAll('#security-insights-grid .security-insight-card').forEach((card) => {
            if (/REQUIRE_AUTH|Phase 2 JWT/i.test(card.textContent)) {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        window.showNotification?.('🔐 Phase 2 auth — optional locally; set REQUIRE_AUTH=true for production', 'info');
    }

    async function handleSecurityQuickAction(actionId) {
        if (quickActionInFlight) return;
        quickActionInFlight = true;
        try {
            switch (actionId) {
                case 'refresh-security':
                    await refreshSecurityChecklist();
                    break;
                case 'run-npm-audit':
                    await runSecurityNpmAudit();
                    break;
                case 'export-report':
                    exportSecurityJson();
                    break;
                case 'open-auth-docs':
                    openPhase2AuthReview();
                    break;
                default:
                    window.showNotification?.(`⚠ Unknown action: ${actionId}`, 'warning');
            }
        } catch (error) {
            console.error('Security quick action failed:', error);
            window.showNotification?.('❌ Action failed', 'error');
        } finally {
            quickActionInFlight = false;
        }
    }

    function bindActions() {
        if (actionsBound) return;
        actionsBound = true;

        document.getElementById('security-refresh')?.addEventListener('click', refreshSecurityChecklist);
        document.getElementById('security-load-sample')?.addEventListener('click', loadSecuritySample);
        document.getElementById('security-run-scan')?.addEventListener('click', runSecurityNpmAudit);
        document.getElementById('security-export-json')?.addEventListener('click', exportSecurityJson);
        document.getElementById('security-import-json')?.addEventListener('click', () => {
            document.getElementById('security-import-file')?.click();
        });
        document.getElementById('security-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applySecurityModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ Security data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid security JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });
        document.getElementById('security-root')?.addEventListener('click', (event) => {
            const btn = event.target.closest('.security-action-btn');
            if (!btn?.dataset.actionId) return;
            event.preventDefault();
            void handleSecurityQuickAction(btn.dataset.actionId);
        });
    }

    function applySecurityModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized security payload');
        if (isStaleSecurityModel(model)) {
            throw new Error('Stale security fiction rejected — load repository-audit sample');
        }
        window.__securityModel = model;
        renderModel(model);
        bindActions();
        window.PageEmptyState?.onModelLoaded('security');

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'security'\"]");
            window.showSection('security', navLink);
        }

        try {
            localStorage.setItem('lastSecurityDashboardModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported security dashboard',
                savedAt: new Date().toISOString()
            }));
        } catch {
            /* ignore */
        }
    }

    function restoreSavedSecurityModel() {
        try {
            const raw = localStorage.getItem('lastSecurityDashboardModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.overview || isStaleSecurityModel(model)) {
                clearSavedSecurityModel();
                return false;
            }
            window.__securityModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadSecuritySample() {
        const root = document.getElementById('security-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            let model = normalizeModel(await response.json());
            const audit = await fetchNpmAudit();
            if (audit) model = mergeNpmAudit(model, audit);
            applySecurityModel(model, 'security-dashboard-sample.json');
            window.showNotification?.('✅ Loaded security sample', 'success');
        } catch (error) {
            console.error('Failed to load security sample:', error);
            window.showNotification?.('❌ Failed to load security sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeSecurityPage(forceRefresh = false) {
        const root = document.getElementById('security-root');
        if (!root) return;

        if (window.__securityModel && !forceRefresh) {
            if (isStaleSecurityModel(window.__securityModel)) {
                window.__securityModel = null;
                trendsChart = null;
                clearSavedSecurityModel();
            } else {
                renderModel(window.__securityModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            clearSavedSecurityModel();
            window.__securityModel = null;
            trendsChart = null;
        }

        root.classList.add('loading');
        try {
            const model = await fetchSecurityData();
            if (model) {
                window.__securityModel = model;
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedSecurityModel()) {
                return;
            }

            await loadSecuritySample();
        } catch (error) {
            console.error('Failed to initialize security page:', error);
            try {
                await loadSecuritySample();
            } catch {
                window.showNotification?.('❌ Failed to load security data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeSecurityPage = initializeSecurityPage;
    window.initializeSecurityDashboardPage = initializeSecurityPage;
    window.loadSecuritySample = loadSecuritySample;
    window.loadSecurityDashboardSample = loadSecuritySample;
    window.applySecurityModel = applySecurityModel;
    window.applySecurityDashboardModel = applySecurityModel;
    window.runSecurityNpmAudit = runSecurityNpmAudit;
})();
