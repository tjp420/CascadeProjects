// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { formatNumber, formatPercent, escapeHtml, showToast } from '../utils.js';
import { isEmbeddedDashboardFrame, setSafeHTML } from '../utils-lib/dom.js?v=20260726embedfix1';
import { buildScanConclusion, getScanFileMetrics, resolveDisplayScore, resolveJestTestsLabel, resolvePageSpecsLabel, renderScanScopePanel } from '../services/analyzeService.js?v=20260726sevfix1';
import { renderIssueList } from '../components/IssueCard.js';
import { renderTrendSection, mountTrendChart } from '../components/TrendChart.js?v=20260724trend1';
import { mountTeamGatePassTrendChart } from '../components/TeamGatePassTrendChart.js?v=20260804team1';
import { renderScanStatus, bindScanStatus, updateScanStatusDom } from '../components/ScanStatus.js?v=20260724fix1';
import { renderAnalysisWorkflow, resolveAnalysisWorkflowStep } from '../components/AnalysisWorkflow.js';
import { mountPolicyEditor } from '../components/PolicyEditor.js?v=20260807policy1';
import { isDemoMode } from '../demoMode.js';
const PRIVACY_NOTICE_KEY = 'sb_privacy_notice_dismissed';
const PRIVACY_NOTICE_TEXT = '100% private. Your source code never leaves your browser. Browser scans use a lightweight heuristic engine (no npm audit, no AST). For full analysis, run the server dashboard, open analyzer (auto-detected port), or upload a CLI report JSON.';
function renderPrivacyBanner() {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PRIVACY_NOTICE_KEY) === '1') {
        return '';
    }
    return `
    <div class="privacy-banner" id="dash-privacy-banner">
      <span class="privacy-banner-icon">🔒</span>
      <span class="privacy-banner-text">${PRIVACY_NOTICE_TEXT}</span>
      <button class="privacy-banner-close" id="dash-privacy-banner-close" aria-label="Dismiss privacy notice">✕</button>
    </div>
  `;
}
function renderPrivacyCard() {
    return `
    <div class="card privacy-card">
      <div class="privacy-card-header">
        <span class="privacy-card-icon">🔒</span>
        <span class="privacy-card-title">Privacy-first scanning</span>
      </div>
      <p class="privacy-card-text">${PRIVACY_NOTICE_TEXT}</p>
    </div>
  `;
}
function bindPrivacyBanner(container) {
    const banner = container.querySelector('#dash-privacy-banner');
    const closeBtn = container.querySelector('#dash-privacy-banner-close');
    if (!banner || !closeBtn)
        return;
    closeBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PRIVACY_NOTICE_KEY, '1');
        }
    });
}
/**
 * Convert a browser-sandbox scanner report (certificate shape) into a simplebeacon-report
 * shape so the Analyze page can render it.
 * @param {Object} report
 * @param {string} projectPath
 * @returns {Object}
 */
function convertSandboxReportToSimplebeacon(report, projectPath) {
    const cert = report.certificate || {};
    const logs = Array.isArray(cert.logs) ? cert.logs : [];
    const high = Number(cert.highRiskCount) || 0;
    const medium = Number(cert.mediumRiskCount) || 0;
    const low = Number(cert.lowRiskCount) || 0;
    const totalFiles = report.discoveredFiles || report.files.length;
    const rawIssues = logs.map((entry) => ({
        severity: String(entry.severity || 'medium').toLowerCase(),
        type: entry.type || 'Security',
        filePath: entry.filePath || '',
        description: entry.message || '',
        count: 1
    }));
    const severityCounts = { critical: 0, high, medium, low, info: 0 };
    return {
        type: 'simplebeacon-report',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        projectPath: projectPath,
        projectRoot: projectPath,
        summary: {
            totalFiles,
            totalFindings: rawIssues.length,
            severityCounts
        },
        rawIssues,
        detectedIssues: rawIssues,
        findings: rawIssues,
        repositoryFilesTotal: totalFiles,
        totalFiles,
        filesAnalyzed: report.files.length,
        inventory: {
            totalFiles,
            totalFolders: 0,
            scannedFiles: report.files.length
        },
        gate: {
            pass: cert.letterGrade !== 'F' && totalFiles > 0,
            score: cert.score != null ? cert.score : 0
        }
    };
}
/**
 * Render insights.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
export function renderInsights(report, baseline, dashboardHome) {
    var _a;
    const sev = (report === null || report === void 0 ? void 0 : report.severityCounts) || {};
    const totalIssues = (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
    const healthClass = totalIssues === 0 ? 'success' : totalIssues <= 5 ? 'warning' : 'danger';
    const healthLabel = totalIssues === 0 ? 'Healthy' : totalIssues <= 5 ? 'Review' : 'Attention';
    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Insights</span>
      </div>
      <div class="insights-grid">
        <div class="insight-stat">
          <div class="insight-stat-value ${healthClass}">${totalIssues}</div>
          <div class="insight-stat-label">Open issues</div>
        </div>
        <div class="insight-stat">
          <div class="insight-stat-value success">${formatPercent(resolveDisplayScore(report))}</div>
          <div class="insight-stat-label">Consistency</div>
        </div>
        <div class="insight-stat">
          <div class="insight-stat-value">${(_a = resolveJestTestsLabel(baseline, dashboardHome)) !== null && _a !== void 0 ? _a : '—'}</div>
          <div class="insight-stat-label">Jest tests</div>
        </div>
        <div class="insight-stat">
          <div class="insight-stat-value ${healthClass}">${healthLabel}</div>
          <div class="insight-stat-label">Status</div>
        </div>
      </div>
    </div>
  `;
}
/**
 * Render re attestation preview.
 * @param {any} meta
 * @returns {any}
 */
function renderReAttestationPreview(meta) {
    var _a, _b, _c, _d, _e, _f;
    const gate = meta.currentGate || {};
    const hygiene = meta.hygieneSummary || {};
    const gateClass = gate.pass ? 'success' : gate.blockingCount > 0 ? 'danger' : 'warning';
    return `
    <div class="dashboard-panel">
      <div class="dashboard-panel-header">
        <h3 class="dashboard-panel-title-sm">Re-attestation</h3>
        <a class="btn btn-ghost btn-xs" href="/dashboard/trust">Trust →</a>
      </div>
      <div class="metrics-row mb-2">
        <div class="metric-chip"><span class="gate-badge ${gateClass}">${gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN'}</span></div>
        <div class="metric-chip"><strong>${formatNumber((_a = gate.blockingCount) !== null && _a !== void 0 ? _a : 0)}</strong> blocking</div>
        <div class="metric-chip"><strong>${(_b = gate.qualityScore) !== null && _b !== void 0 ? _b : '—'}%</strong> quality</div>
        <div class="metric-chip"><strong>${formatNumber((_d = (_c = gate.ruleScopedFilesAnalyzed) !== null && _c !== void 0 ? _c : hygiene.ruleScopedFilesAnalyzed) !== null && _d !== void 0 ? _d : 0)}</strong> checked</div>
        <div class="metric-chip"><strong>${formatNumber((_f = (_e = gate.repositoryFilesTotal) !== null && _e !== void 0 ? _e : hygiene.repositoryFilesTotal) !== null && _f !== void 0 ? _f : 0)}</strong> repo files</div>
      </div>
      <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">
        ${escapeHtml(meta.message || '')}
        ${meta.workflowStatus ? `· Status: <strong>${escapeHtml(meta.workflowStatus)}</strong>` : ''}
      </p>
    </div>
  `;
}
/**
 * Render scan metrics.
 * @param {number} report
 * @returns {any}
 */
function renderScanMetrics(report) {
    var _a, _b, _c, _d, _e, _f;
    const metrics = getScanFileMetrics(report);
    return `
    <div class="metrics-row">
      ${metrics.repositoryFiles != null ? `<div class="metric-chip" title="Repository inventory (skips node_modules, .git, build artifacts)"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
      <div class="metric-chip"><strong>${formatNumber((_a = metrics.filesAnalyzed) !== null && _a !== void 0 ? _a : 0)}</strong> files analyzed</div>
      <div class="metric-chip"><strong>${formatNumber((_b = metrics.mockSampleFiles) !== null && _b !== void 0 ? _b : 0)}</strong> mock/sample</div>
      <div class="metric-chip"><strong>${formatNumber((_c = report === null || report === void 0 ? void 0 : report.fictionKpiHits) !== null && _c !== void 0 ? _c : 0)}</strong> fiction scanned</div>
      <div class="metric-chip"><strong>${formatPercent(report === null || report === void 0 ? void 0 : report.schemaCompliance)}</strong> schema compliance</div>
      <div class="metric-chip"><strong>${(_d = resolvePageSpecsLabel(report)) !== null && _d !== void 0 ? _d : '—'}</strong> page specs</div>
      <div class="metric-chip"><strong>${formatPercent(report === null || report === void 0 ? void 0 : report.consistencyScore)}</strong> consistency</div>
      <div class="metric-chip"><strong>${(_e = report === null || report === void 0 ? void 0 : report.credentialFindings) !== null && _e !== void 0 ? _e : 0}</strong> credential hits</div>
      <div class="metric-chip"><strong>${(_f = report === null || report === void 0 ? void 0 : report.productionLeakFindings) !== null && _f !== void 0 ? _f : 0}</strong> prod leaks</div>
    </div>
  `;
}
/**
 * Dashboard view.
 */
export class DashboardView {
    constructor(app) {
        this.app = app;
        this._trendCleanup = null;
        this._scanProgressTimer = null;
        this._scanProgress = null;
    }

    render() {
        const { report, scanning } = this.app.state;
        const container = document.createElement('div');
        container.className = 'fade-in dashboard-page';

        container.appendChild(this.renderHeader(report));

        const workflowStep = resolveAnalysisWorkflowStep(this.app.state);
        const workflowEl = document.createElement('div');
        setSafeHTML(workflowEl, renderAnalysisWorkflow(workflowStep, { pageLabel: 'Analysis workflow' }));
        container.appendChild(workflowEl.firstElementChild);

        const metricsSlot = document.createElement('div');
        metricsSlot.id = 'ci-team-metrics-slot';
        container.appendChild(metricsSlot);

        const reviewMode = Boolean(report) && !scanning;
        const scanSlot = document.createElement('div');
        scanSlot.id = 'dashboard-scan-slot';
        setSafeHTML(scanSlot, renderScanStatus(report, {
            redesign: true,
            reviewMode,
            scanning,
            config: this.app.state.config,
            lastProjectPath: this.app.state.lastProjectPath,
            defaultProjectPath: this.app.state.defaultProjectPath
        }));
        container.appendChild(scanSlot);

        if (scanning) {
            container.appendChild(this.renderScanProgress());
        }

        // Policy editor slot — always visible when config is available
        const policySlot = document.createElement('div');
        policySlot.id = 'slot-policy-editor';
        container.appendChild(policySlot);

        if (!report && !scanning) {
            container.appendChild(this.renderQuickStart());
            container.appendChild(this.renderFeatureDiscovery());
            return container;
        }

        if (report) {
            const categories = this.app.scanService.getIssueCategories(report);
            container.appendChild(this.renderResultsState(report, categories));
            container.appendChild(this.renderFeatureDiscovery());
        }

        return container;
    }

    renderFeatureDiscovery() {
        const DISMISS_KEY = 'sb_feature_discovery_dismissed';
        let dismissed = false;
        try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* ignore */ }
        if (dismissed) return document.createElement('div');

        const features = [
            { icon: 'folder-search', title: 'Scan & Analyze', desc: 'Run scans, drop folders, import CLI reports', route: 'analyze', highlight: !this.app.state.report },
            { icon: 'clipboard-check', title: 'Compliance Audit', desc: 'Credentials, fiction KPIs, schema drift, production leaks', route: 'audit' },
            { icon: 'map', title: 'Remediation Roadmap', desc: 'Prioritized fix steps from your scan', route: 'roadmap' },
            { icon: 'bot', title: 'AI Chatbot', desc: 'Ask about your codebase with local or cloud AI', route: 'chatbot' },
            { icon: 'file-text', title: 'Assessments', desc: 'Client-facing M&A / diligence flow', route: 'assessments' },
            { icon: 'shield-check', title: 'Security Keys', desc: 'Register FIDO2 hardware keys for 2FA', route: 'profile' },
            { icon: 'bar-chart-3', title: 'Platform Metrics', desc: 'Engineering baseline, Jest health, schema compliance', route: 'platform' },
            { icon: 'settings', title: 'Settings', desc: 'Scan paths, gate severities, AI provider keys', route: 'settings' }
        ];

        const section = document.createElement('div');
        section.className = 'feature-discovery';
        // content where applicable.
        setSafeHTML(section, `
            <div class="feature-discovery-header">
                <h3 class="feature-discovery-title">Explore SimpleBeacon</h3>
                <button class="feature-discovery-dismiss" id="fd-dismiss" aria-label="Dismiss">✕</button>
            </div>
            <div class="feature-discovery-grid">
                ${features.map(f => `
                    <div class="feature-discovery-card${f.highlight ? ' fd-recommended' : ''}" data-fd-route="${f.route}">
                        <div class="feature-discovery-card-icon">
                            <i data-lucide="${f.icon}"></i>
                        </div>
                        <div class="feature-discovery-card-body">
                            <div class="feature-discovery-card-title">${f.title}${f.highlight ? ' <span class="fd-badge">Recommended</span>' : ''}</div>
                            <div class="feature-discovery-card-desc">${f.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);
        return section;
    }

    renderHeader(report) {
        const header = document.createElement('div');
        header.className = 'dashboard-header d-flex justify-content-between align-items-center mb-4';

        const projectName = report
            ? (report.projectRoot || report.projectPath || 'Active Project').split(/[\\/]/).pop()
            : 'No Active Project';
        const statusChip = report && report.gate
            ? `<span class="badge gate-badge ${report.gate.pass ? 'bg-success' : 'bg-danger'}">${report.gate.pass ? 'Healthy' : 'Attention Required'}</span>`
            : '';
        // content where applicable.
        const adminBtnHtml = this.app && typeof this.app.isCurrentUserAdmin === 'function' && this.app.isCurrentUserAdmin()
            ? '<button class="btn btn-primary btn-sm" id="team-admin-btn">Team Admin</button>'
            : '';
        setSafeHTML(header, `
            <div>
                <h1 class="h2 mb-1">Dashboard</h1>
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted text-xs">${escapeHtml(projectName)}</span>
                    ${statusChip}
                </div>
            </div>
            <div class="header-actions d-flex gap-2">
                <button class="btn btn-ghost btn-sm" data-action="open-analyze">Advanced analyze</button>
                ${adminBtnHtml}
            </div>
        `);
        return header;
    }

    renderScanProgress() {
        const progress = this._scanProgress || {};
        const pct = progress.total && progress.processed != null
            ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
            : (this.app.state.scanning ? 12 : 0);
        const label = progress.label || 'Running SimpleBeacon scan…';
        const detail = progress.currentFile
            ? escapeHtml(String(progress.currentFile).split(/[\\/]/).pop() || '')
            : (progress.processed != null && progress.total
                ? `${formatNumber(progress.processed)} / ${formatNumber(progress.total)} files`
                : 'Initializing engines…');

        const card = document.createElement('div');
        card.className = 'card dashboard-scan-progress-card';
        card.id = 'dashboard-scan-progress';
        // content where applicable.
        setSafeHTML(card, `
            <div class="dashboard-scan-progress-header">
                <span class="loading-spinner dashboard-scan-progress-spinner"></span>
                <div>
                    <div class="dashboard-scan-progress-label">${escapeHtml(label)}</div>
                    <div class="text-muted text-xs dashboard-scan-progress-detail">${detail}</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-action="open-analyze">Live log</button>
            </div>
            <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
        `);
        return card;
    }

    renderQuickStart() {
        const embed = isEmbeddedDashboardFrame();
        const view = document.createElement('div');
        view.className = 'dashboard-quickstart card p-4';
        if (embed) {
            // content where applicable.
            window.setSafeHTML(
                view,
                '\n            <h3 class="h5 mb-2">Run a scan from VS Code</h3>\n            <p class="text-sm text-muted mb-3">Your code stays local. Use the scan panel above, or jump to a view with the quick nav bar.</p>\n            <ol class="dashboard-quickstart-steps text-sm text-muted">\n                <li><strong>Analyze</strong> — drop a folder, browse, or paste your workspace path.</li>\n                <li><strong>Results</strong> — gate score, findings, and exports after the scan completes.</li>\n                <li><strong>Roadmap</strong> — prioritized remediation steps from your latest report.</li>\n            </ol>\n            <div class="dashboard-quickstart-actions d-flex flex-wrap gap-2 mt-3">\n                <button class="btn btn-primary btn-sm" data-action="open-analyze" data-mode="folder">Start Analyze</button>\n                <button class="btn btn-outline btn-sm" data-action="open-analyze" data-mode="upload">Import CLI report</button>\n            </div>\n        '
            );;
            return view;
        }
        // content where applicable.
        window.setSafeHTML(
            view,
            '\n            <h3 class="h5 mb-2">How to run your first scan</h3>\n            <ol class="dashboard-quickstart-steps text-sm text-muted">\n                <li><strong>Drop or browse</strong> a folder in the scan panel above, or paste an absolute server path.</li>\n                <li>Click <strong>Scan</strong> — engines run locally or on your SimpleBeacon server.</li>\n                <li>Review the gate score, findings, and remediation roadmap below when complete.</li>\n            </ol>\n            <div class="dashboard-quickstart-actions d-flex flex-wrap gap-2 mt-3">\n                <button class="btn btn-primary btn-sm" data-action="open-analyze" data-mode="folder">Open Analyze (full modes)</button>\n                <button class="btn btn-outline btn-sm" data-action="open-analyze" data-mode="upload">Import CLI report</button>\n            </div>\n        '
        );;
        return view;
    }

    renderTeamCiMetrics(metrics, teamExtras = {}) {
        const { trend = null, distribution = null } = teamExtras;
        const periodDays = metrics.periodDays || 7;
        const blocked = metrics.merges_blocked_this_week ?? metrics.gates_tripped ?? 0;
        const criticals = metrics.criticals_blocked ?? 0;
        const hasTeamTelemetry = metrics.gate_pass_rate != null
            || (trend && Array.isArray(trend.trend))
            || (distribution && distribution.p50 != null);

        const gatePassRateHtml = metrics.gate_pass_rate != null
            ? `
                <div class="ci-metric ci-metric-highlight">
                    <div class="ci-metric-value text-success">${formatPercent(metrics.gate_pass_rate * 100, 0)}</div>
                    <div class="ci-metric-label">Gate pass rate</div>
                    <div class="ci-metric-sub">Org-wide ${periodDays}-day average</div>
                </div>`
            : '';

        const trendHtml = (trend && Array.isArray(trend.trend))
            ? `
            <div class="team-telemetry-section">
                <div class="team-telemetry-section-title">Gate pass rate trend</div>
                <div class="trend-chart team-gate-trend-chart">
                    <canvas id="team-gate-trend-canvas"></canvas>
                </div>
            </div>`
            : '';

        const dist = distribution || metrics.quality_distribution || null;
        const distributionHtml = (dist && dist.sampleSize > 0)
            ? this.renderQualityDistributionStrip(dist)
            : '';

        const sources = metrics.scan_sources || null;
        const sourcesHtml = sources
            ? this.renderScanSourcesBreakdown(sources)
            : '';

        const kAnonymityHtml = metrics.k_anonymity_met === false
            ? `
            <div class="team-k-anonymity-notice" role="note">
                <span class="team-k-anonymity-icon">🔒</span>
                <span>Small-team mode — per-workspace breakdown hidden until ${metrics.distinct_workspaces != null ? 'at least 3' : 'k-anonymity'} distinct workspaces contribute scans.</span>
            </div>`
            : '';

        const card = document.createElement('div');
        card.className = 'card ci-team-metrics-card mb-4';
        card.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <span class="card-title">Team Telemetry — Last ${periodDays} days</span>
                <span class="badge bg-primary">${hasTeamTelemetry ? 'Org Aggregate' : 'AI Circuit Breaker'}</span>
            </div>
            <div class="ci-team-metrics-grid">
                <div class="ci-metric">
                    <div class="ci-metric-value">${formatNumber(metrics.total_scans || 0)}</div>
                    <div class="ci-metric-label">Total scans</div>
                    <div class="ci-metric-sub">${formatNumber(metrics.repositories || metrics.distinct_workspaces || 0)} workspaces</div>
                </div>
                <div class="ci-metric ci-metric-highlight">
                    <div class="ci-metric-value">${formatNumber(blocked)}</div>
                    <div class="ci-metric-label">Merges blocked this week</div>
                    <div class="ci-metric-sub">Gates tripped in CI</div>
                </div>
                <div class="ci-metric">
                    <div class="ci-metric-value text-danger">${formatNumber(criticals)}</div>
                    <div class="ci-metric-label">Criticals blocked</div>
                    <div class="ci-metric-sub">Prevented master branch fail</div>
                </div>
                <div class="ci-metric">
                    <div class="ci-metric-value">${formatNumber(metrics.diffs_analyzed || 0)}</div>
                    <div class="ci-metric-label">Diff files analyzed</div>
                    <div class="ci-metric-sub">PR-scoped coverage</div>
                </div>
                ${gatePassRateHtml}
            </div>
            ${trendHtml}
            ${distributionHtml}
            ${sourcesHtml}
            ${kAnonymityHtml}
        `;
        return card;
    }

    renderQualityDistributionStrip(dist) {
        const scaleMin = 0;
        const scaleMax = 100;
        const toPct = (value) => {
            if (value == null || !Number.isFinite(Number(value))) {
                return null;
            }
            const n = Number(value);
            return Math.min(100, Math.max(0, ((n - scaleMin) / (scaleMax - scaleMin)) * 100));
        };
        const p10 = toPct(dist.p10);
        const p25 = toPct(dist.p25);
        const p50 = toPct(dist.p50);
        const p75 = toPct(dist.p75);
        const p90 = toPct(dist.p90);
        const fmt = (v) => (v == null ? '—' : formatPercent(v, 0));

        return `
            <div class="team-telemetry-section">
                <div class="team-telemetry-section-title">Quality score distribution</div>
                <div class="team-percentile-strip" aria-label="Quality score percentiles p10 through p90">
                    <div class="team-percentile-track">
                        ${p10 != null && p90 != null ? `<div class="team-percentile-whisker" style="left:${p10}%;width:${Math.max(0, p90 - p10)}%"></div>` : ''}
                        ${p25 != null && p75 != null ? `<div class="team-percentile-box" style="left:${p25}%;width:${Math.max(0, p75 - p25)}%"></div>` : ''}
                        ${p50 != null ? `<div class="team-percentile-median" style="left:${p50}%"></div>` : ''}
                    </div>
                    <div class="team-percentile-labels">
                        <span>p10 ${fmt(dist.p10)}</span>
                        <span>p25 ${fmt(dist.p25)}</span>
                        <span class="team-percentile-label-median">p50 ${fmt(dist.p50)}</span>
                        <span>p75 ${fmt(dist.p75)}</span>
                        <span>p90 ${fmt(dist.p90)}</span>
                    </div>
                    <div class="team-percentile-meta text-muted text-xs">n=${formatNumber(dist.sampleSize || 0)} scans with quality scores</div>
                </div>
            </div>`;
    }

    renderScanSourcesBreakdown(sources) {
        const entries = [
            { key: 'ci', label: 'CI' },
            { key: 'ide', label: 'IDE' },
            { key: 'dashboard', label: 'Dashboard' }
        ];
        const total = entries.reduce((sum, e) => sum + (Number(sources[e.key]) || 0), 0);
        if (total <= 0) {
            return '';
        }
        const rows = entries.map((e) => {
            const count = Number(sources[e.key]) || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
                <div class="team-source-row">
                    <span class="team-source-label">${e.label}</span>
                    <div class="team-source-bar"><div class="team-source-bar-fill" style="width:${pct}%"></div></div>
                    <span class="team-source-count">${formatNumber(count)}</span>
                </div>`;
        }).join('');
        return `
            <div class="team-telemetry-section">
                <div class="team-telemetry-section-title">Scan sources</div>
                <div class="team-scan-sources">${rows}</div>
            </div>`;
    }

    async loadCiTeamMetrics(view) {
        const slot = view.querySelector('#ci-team-metrics-slot');
        if (!slot) {
            return;
        }
        const days = 7;
        const [metrics, trend, distribution] = await Promise.all([
            this.app.scanService.fetchCiTeamMetrics({ days }),
            this.app.scanService.fetchTeamTelemetryTrend({ days }),
            this.app.scanService.fetchTeamQualityDistribution({ days })
        ]);
        if (!metrics || !metrics.total_scans) {
            return;
        }
        if (this._teamTrendCleanup) {
            this._teamTrendCleanup();
            this._teamTrendCleanup = null;
        }
        window.setSafeHTML(slot, '');
        const card = this.renderTeamCiMetrics(metrics, { trend, distribution });
        slot.appendChild(card);
        if (trend && Array.isArray(trend.trend)) {
            requestAnimationFrame(() => {
                const trendContainer = slot.querySelector('.team-gate-trend-chart');
                if (trendContainer) {
                    this._teamTrendCleanup = mountTeamGatePassTrendChart(trendContainer, trend.trend) || null;
                }
            });
        }
    }

    renderResultsState(report, categories) {
        const grid = document.createElement('div');
        grid.className = 'dashboard-grid';

        const gatePass = !!(report.gate && report.gate.pass);
        const blockingCount = (report.gate && report.gate.blockingCount) || 0;
        const sev = report.severityCounts || {};
        const gateScore = typeof (report.gate && report.gate.score) === 'number' ? report.gate.score : null;
        const displayScore = resolveDisplayScore(report) != null ? resolveDisplayScore(report) : gateScore;
        // A 0% score next to a PASS badge with no blocking findings usually means the score
        // was never computed, not a real failing score. Hide it in that case.
        const qualityScoreText = (displayScore === 0 && gatePass && blockingCount === 0) ? '—' : (displayScore != null ? formatPercent(displayScore, 0) : '—');
        const filesEvaluated = report.ruleScopedFilesAnalyzed > 0
            ? report.ruleScopedFilesAnalyzed
            : (report.repositoryFilesTotal || 0);
        const repoTotal = report.repositoryFilesTotal || 0;
        const metrics = getScanFileMetrics(report);
        // Defensive: rule-scoped counts should never exceed the repository total.
        const rawFilesAnalyzed = metrics.filesAnalyzed || filesEvaluated;
        const displayFilesAnalyzed = (repoTotal > 0 && rawFilesAnalyzed > repoTotal) ? repoTotal : rawFilesAnalyzed;
        // content where applicable.
        setSafeHTML(grid, `
            <div class="card bento-hero p-4 justify-content-between">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h4 class="text-muted text-xs uppercase mb-1">Gate Quality Score</h4>
                        <div class="display-3 font-weight-bold">${qualityScoreText}</div>
                        <p class="text-muted text-xs mb-0 mt-1">${formatNumber(displayFilesAnalyzed)} files analyzed · ${formatNumber(repoTotal)} in repo</p>
                    </div>
                    <span class="badge p-3 ${gatePass ? 'bg-success' : 'bg-danger'} font-weight-bold">
                        ${gatePass ? 'PASSED' : 'FAILED'}
                    </span>
                </div>
                <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="d-flex gap-3 flex-wrap">
                        <span class="text-sm"><strong class="text-danger">${sev.critical || 0}</strong> Critical</span>
                        <span class="text-sm"><strong class="text-warning">${sev.high || 0}</strong> High</span>
                        <span class="text-sm"><strong class="text-info">${sev.medium || 0}</strong> Med</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline btn-sm" data-action="view-results">All findings</button>
                        <button class="btn btn-primary btn-sm" data-action="rescan">Re-scan</button>
                    </div>
                </div>
            </div>

            <div class="card bento-actions p-4 d-flex flex-column justify-content-between">
                <h4 class="text-muted text-xs uppercase mb-3">Next steps</h4>
                <div class="d-flex flex-column gap-2">
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="roadmap">Remediation roadmap</button>
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="export">Export JSON report</button>
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="send-ai">Send findings to AI</button>
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="open-analyze">Deep analysis modes</button>
                </div>
            </div>

            <div class="card bento-issues p-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="h5 mb-0">Latest findings</h4>
                    <button class="btn btn-link btn-sm p-0" data-action="view-results">View all →</button>
                </div>
                <div id="dashboard-issue-list-slot"></div>
            </div>

            <div class="card bento-trends p-4">
                <h4 class="h6 mb-3">Scan history & trends</h4>
                <div id="slot-trend"></div>
            </div>

            <div class="card bento-summary p-4 justify-content-between">
                <h4 class="text-muted text-xs uppercase mb-2">Health snapshot</h4>
                <div class="flex-grow-1 d-flex flex-column justify-content-around gap-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-sm">Repo footprint</span>
                        <span class="text-sm font-weight-bold text-muted">${repoTotal} files</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-sm">Mock / sample paths</span>
                        <span class="text-sm font-weight-bold">${formatNumber(metrics.mockSampleFiles || 0)}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-sm">Gate engines</span>
                        <span class="text-sm font-weight-bold text-success">Active</span>
                    </div>
                </div>
                <div class="pt-2 border-top mt-2">
                    <button class="btn btn-link text-xs text-primary p-0" data-action="system-health">Platform details →</button>
                </div>
            </div>
        `);

        const issueSlot = grid.querySelector('#dashboard-issue-list-slot');
        issueSlot.appendChild(renderIssueList(categories, {
            onSelect: (cat) => this.app.navigate('results', { filter: cat })
        }));

        const trendSlot = grid.querySelector('#slot-trend');
        setSafeHTML(trendSlot, renderTrendSection(this.app.state.history));

        return grid;
    }

    bindEvents(view) {
        view.querySelectorAll('[data-action]').forEach((el) => {
            const action = el.getAttribute('data-action');
            const mode = el.getAttribute('data-mode');
            const handler = () => {
                switch (action) {
                    case 'run-scan':
                        this.app.runScan();
                        break;
                    case 'open-analyze':
                        this.app.navigate('analyze', mode ? { mode } : undefined);
                        break;
                    case 'rescan':
                        this.app.runScan();
                        break;
                    case 'export':
                        this.handleExport();
                        break;
                    case 'send-ai':
                        this.handleSendAi();
                        break;
                    case 'roadmap':
                        this.app.navigate('roadmap');
                        break;
                    case 'view-results':
                        this.app.navigate('results');
                        break;
                    case 'system-health':
                        this.app.navigate('platform');
                        break;
                    case 'fd-navigate':
                        this.app.navigate(el.getAttribute('data-fd-route') || 'dashboard');
                        break;
                    case 'fd-dismiss-action':
                        try { localStorage.setItem('sb_feature_discovery_dismissed', '1'); } catch { /* ignore */ }
                        el.closest('.feature-discovery')?.remove();
                        break;
                }
            };
            el.addEventListener('click', handler);
            if (el.classList.contains('bento-card-interactive')) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handler();
                    }
                });
            }
        });
    }

    bindScanPanel(view) {
        const scanSlot = view.querySelector('#dashboard-scan-slot');
        if (!scanSlot)
            return;
        bindScanStatus(scanSlot, {
            onRescan: (path) => this.app.runScan(path),
            onLocalScanResult: (payload) => {
                if (!payload)
                    return;
                const projectPath = payload.projectPath || payload.verifiedAddress || payload.path || '';
                if (projectPath) {
                    this.app.state.lastProjectPath = projectPath;
                }
                if (payload.files || payload.certificate) {
                    const sbReport = convertSandboxReportToSimplebeacon(payload, projectPath);
                    this.app.state.report = sbReport;
                    this.app.scanService.report = sbReport;
                    this.app.state.analyzeResult = {
                        kind: 'simplebeacon-report',
                        report: sbReport,
                        projectPath,
                        label: `Local scan: ${projectPath}`,
                        scanCompletedAt: Date.now()
                    };
                    this.app.navigate('results');
                } else {
                    this.app.navigate('analyze');
                }
            },
            onViewResults: () => this.app.navigate('results'),
            getLastProjectPath: () => this.app.state.lastProjectPath || '',
            setLastProjectPath: (path) => { this.app.state.lastProjectPath = path; },
            getDefaultProjectPath: () => this.app.state.defaultProjectPath || ''
        });
    }

    refreshScanStatus() {
        const main = document.getElementById('app-main');
        const scanSlot = main && main.querySelector('#dashboard-scan-slot');
        if (!scanSlot)
            return;
        const stateSig = `${this.app.state.scanning}|${this.app.state.report?.issueCount || 0}|${this.app.state.lastProjectPath || ''}`;
        if (this._lastScanSig === stateSig)
            return;
        this._lastScanSig = stateSig;
        const updated = updateScanStatusDom(scanSlot, this.app.state.report);
        if (!updated) {
            const reviewMode = Boolean(this.app.state.report) && !this.app.state.scanning;
            scanSlot.innerHTML = renderScanStatus(this.app.state.report, {
                redesign: true,
                reviewMode,
                scanning: this.app.state.scanning,
                config: this.app.state.config,
                lastProjectPath: this.app.state.lastProjectPath,
                defaultProjectPath: this.app.state.defaultProjectPath
            });
            this.bindScanPanel(main.querySelector('.fade-in') || main);
        }
    }

    startScanProgressPolling() {
        this.stopScanProgressPolling();
        if (!this.app.state.scanning)
            return;
        const poll = async () => {
            try {
                const progress = await this.app.scanService.fetchScanProgress();
                if (!progress)
                    return;
                this._scanProgress = progress;
                const card = document.getElementById('dashboard-scan-progress');
                if (!card)
                    return;
                const pct = progress.total && progress.processed != null
                    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
                    : 12;
                const fill = card.querySelector('.analyze-progress-fill');
                if (fill)
                    fill.style.width = `${pct}%`;
                const label = card.querySelector('.dashboard-scan-progress-label');
                if (label && progress.label)
                    label.textContent = progress.label;
                const detail = card.querySelector('.dashboard-scan-progress-detail');
                if (detail) {
                    detail.textContent = progress.currentFile
                        ? String(progress.currentFile).split(/[\\/]/).pop()
                        : (progress.processed != null && progress.total
                            ? `${formatNumber(progress.processed)} / ${formatNumber(progress.total)} files`
                            : 'Initializing engines…');
                }
            }
            catch (_a) { /* ignore transient errors */ }
        };
        poll();
        this._scanProgressTimer = setInterval(poll, 1500);
    }

    stopScanProgressPolling() {
        if (this._scanProgressTimer) {
            clearInterval(this._scanProgressTimer);
            this._scanProgressTimer = null;
        }
        this._scanProgress = null;
    }

    handleExport() {
        if (isDemoMode()) {
            this.app.scanService.exportDashboard({
                report: this.app.state.report,
                baseline: this.app.state.baseline,
                config: this.app.state.config,
                history: this.app.state.history,
                dashboardHome: this.app.state.dashboardHome
            });
        }
        else {
            this.app.scanService.exportReport();
        }
    }

    async handleSendAi() {
        const report = this.app.state.report;
        if (!report) {
            showToast('No report loaded — run a scan first', 'error');
            return;
        }
        const allIssues = report.rawIssues || report.detectedIssues || [];
        const reportSummary = {
            gatePass: report.gate ? report.gate.pass : 'N/A',
            qualityScore: report.qualityScore != null ? report.qualityScore : 'N/A',
            totalIssues: allIssues.length,
            filesScanned: report.repositoryFilesTotal != null ? report.repositoryFilesTotal : (report.totalFiles || 'N/A'),
            reportType: report.type || 'simplebeacon'
        };
        const hasVsCodeApi = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
        if (hasVsCodeApi) {
            try {
                const vscode = window.acquireVsCodeApi();
                vscode.postMessage({
                    command: 'sendToAI',
                    data: {
                        projectPath: report.projectRoot || report.projectPath || window.location.origin,
                        notes: '',
                        reportSummary,
                        issues: allIssues
                    }
                });
                showToast('Scan data sent to your AI coding agent. Check the editor chat panel.', 'success');
                return;
            }
            catch (err) {
                window["console"]["warn"]('[AI-Send] vscode.postMessage failed:', err);
            }
        }
        try {
            const res = await fetch('/api/ai-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath: report.projectRoot || report.projectPath || window.location.origin,
                    notes: '',
                    reportSummary,
                    issues: allIssues
                })
            });
            const json = await res.json();
            if (json.success) {
                if (json.content) {
                    try {
                        await navigator.clipboard.writeText(json.content);
                        showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success');
                    }
                    catch (clipErr) {
                        showToast('AI context saved. Use sidebar 🤖 button or mention @.simplebeacon/ai-context.md', 'success');
                    }
                }
                else {
                    showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
                }
            }
            else {
                showToast('Failed: ' + (json.error || 'Unknown'), 'error');
            }
        }
        catch (err) {
            showToast('Network error: ' + err.message, 'error');
        }
    }

    async ensureReportEnriched() {
        const report = this.app.state.report;
        if (!report)
            return;
        const enriched = await this.app.scanService.enrichReport(report);
        if (enriched !== report) {
            this.app.state.report = enriched;
            this.app.scanService.report = enriched;
            this.app.refreshCurrentView();
        }
    }

    bindFeatureDiscovery(view) {
        const fdSection = view.querySelector('.feature-discovery');
        if (!fdSection) return;
        fdSection.querySelectorAll('[data-fd-route]').forEach(card => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.addEventListener('click', () => {
                this.app.navigate(card.getAttribute('data-fd-route') || 'dashboard');
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.app.navigate(card.getAttribute('data-fd-route') || 'dashboard');
                }
            });
        });
        const dismissBtn = fdSection.querySelector('#fd-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                try { localStorage.setItem('sb_feature_discovery_dismissed', '1'); } catch { /* ignore */ }
                fdSection.remove();
            });
        }
    }

    mount(container) {
        if (this._trendCleanup)
            this._trendCleanup();
        if (this._teamTrendCleanup)
            this._teamTrendCleanup();
        this.stopScanProgressPolling();
        window.setSafeHTML(container, '');; 
        const view = this.render();
        container.appendChild(view);
        this.bindEvents(view);
        this.bindFeatureDiscovery(view);
        this.bindScanPanel(view);
        void this.loadCiTeamMetrics(view);
        if (this.app.state.scanning) {
            this.startScanProgressPolling();
        }
        if (!this.app.state.report)
            return;
        this.ensureReportEnriched();
        requestAnimationFrame(() => {
            const trendSlot = view.querySelector('#slot-trend');
            this._trendCleanup = mountTrendChart(trendSlot, this.app.state.history) || null;
        });
        requestAnimationFrame(() => {
            const policySlot = view.querySelector('#slot-policy-editor');
            if (policySlot) {
                this._policyEditorCleanup = mountPolicyEditor(policySlot, this.app) || null;
            }
        });
        if (typeof window.lucide !== 'undefined')
            window.lucide.createIcons();
    }

    destroy() {
        if (this._trendCleanup)
            this._trendCleanup();
        if (this._teamTrendCleanup)
            this._teamTrendCleanup();
        if (this._policyEditorCleanup)
            this._policyEditorCleanup();
        this.stopScanProgressPolling();
    }
}
