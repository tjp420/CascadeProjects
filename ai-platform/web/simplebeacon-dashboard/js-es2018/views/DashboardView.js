import { formatNumber, formatPercent, escapeHtml, renderEmptyState, showToast } from '../utils.js';
import { buildScanConclusion, getScanFileMetrics, resolveDisplayScore, resolveJestTestsLabel, resolvePageSpecsLabel, renderScanScopePanel } from '../services/analyzeService.js';
import { renderScanStatus, updateScanStatusDom, bindScanStatus, runDashboardScanFromInput } from '../components/ScanStatus.js?v=20260710dragfix4';
import { renderIssueList } from '../components/IssueCard.js';
import { renderQuickActions, bindQuickActions } from '../components/QuickActions.js';
import { renderTrendSection, mountTrendChart } from '../components/TrendChart.js';
import { fetchRepositoryHealth, renderRepositoryHealthSection } from './RepositoryHealthView.js';
import { renderPathHealthDashboard, cleanupPathHealthDashboard } from '../components/PathHealthDashboard.js';
import { isDemoMode } from '../demoMode.js';
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
    }
    render() {
        var _a, _b, _c, _d;
        const { report, baseline, history, scanning, dataLoading } = this.app.state;
        const categories = this.app.scanService.getIssueCategories(report);
        const el = document.createElement('div');
        el.className = 'fade-in';
        if (!report) {
            const emptyState = scanning
                ? renderEmptyState({
                    icon: '<path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-dasharray="2 2"/><polyline points="9 12 12 15 22 5"/>',
                    title: 'Scanning…',
                    body: 'Analysis is running. Switch to <a href="/dashboard/analyze">Analyze</a> to watch progress.',
                    actions: [
                        { label: 'Open Analyze', id: 'dash-goto-analyze', className: 'btn-secondary' }
                    ]
                })
                : renderEmptyState({
                    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
                    title: 'No scan report loaded',
                    body: 'Set your repo folder on <a href="/dashboard/analyze">Analyze → Project path</a>, then run a scan. Gate mock folders live in <a href="/dashboard/settings">Settings → Scan paths</a>.',
                    actions: [
                        { label: 'Run Scan', id: 'dash-run-scan', className: 'btn-primary' },
                        { label: 'Open Analyze', id: 'dash-goto-analyze', className: 'btn-secondary' }
                    ]
                });
            el.innerHTML = `<h1 class="page-title">Dashboard</h1>${emptyState}`;
            return el;
        }
        const conclusion = buildScanConclusion(report);
        const sev = (report === null || report === void 0 ? void 0 : report.severityCounts) || {};
        const totalIssues = (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
        const healthClass = totalIssues === 0 ? 'success' : totalIssues <= 5 ? 'warning' : 'danger';
        const healthLabel = totalIssues === 0 ? 'Healthy' : totalIssues <= 5 ? 'Review' : 'Attention';
        const gate = (report === null || report === void 0 ? void 0 : report.gate) || {};
        const gateClass = gate.pass ? 'success' : gate.blockingCount > 0 ? 'danger' : 'warning';
        const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
        el.innerHTML = `
      <div class="dashboard-header">
        <h1 class="page-title">Dashboard</h1>
        <div class="dashboard-header-actions">
          <button class="btn btn-ghost btn-sm" id="dash-open-settings">
            <i data-lucide="settings-2" class="icon-16"></i> Settings
          </button>
          <button class="btn btn-primary btn-sm" id="view-all-results">
            <i data-lucide="arrow-right" class="icon-16"></i> View all results
          </button>
        </div>
      </div>

      <div class="dashboard-stats-row">
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-icon-wrapper ${gateClass}">
            <i data-lucide="shield-check" class="icon-20"></i>
          </div>
          <div class="dashboard-stat-body">
            <div class="dashboard-stat-value ${gateClass}">${gateLabel}</div>
            <div class="dashboard-stat-label">Gate status</div>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-icon-wrapper ${healthClass}">
            <i data-lucide="alert-circle" class="icon-20"></i>
          </div>
          <div class="dashboard-stat-body">
            <div class="dashboard-stat-value ${healthClass}">${totalIssues}</div>
            <div class="dashboard-stat-label">${totalIssues === 1 ? 'Open issue' : 'Open issues'}</div>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-icon-wrapper success">
            <i data-lucide="check-circle-2" class="icon-20"></i>
          </div>
          <div class="dashboard-stat-body">
            <div class="dashboard-stat-value success">${formatPercent(resolveDisplayScore(report))}</div>
            <div class="dashboard-stat-label">Consistency</div>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-icon-wrapper">
            <i data-lucide="flask-conical" class="icon-20"></i>
          </div>
          <div class="dashboard-stat-body">
            <div class="dashboard-stat-value">${(_a = resolveJestTestsLabel(baseline, this.app.state.dashboardHome)) !== null && _a !== void 0 ? _a : '—'}</div>
            <div class="dashboard-stat-label">Tests</div>
          </div>
        </div>
      </div>

      <div class="dashboard-hero">
        <div id="slot-scan-status"></div>
        <div id="slot-quick-actions"></div>
      </div>

      <div class="dashboard-body">
        <div class="dashboard-body-primary">
          <div class="dashboard-panel">
            <div class="dashboard-panel-header">
              <h2 class="dashboard-panel-title">
                <i data-lucide="list" class="icon-18"></i>
                Scan Results
              </h2>
            </div>
            <div id="slot-issue-list"></div>
          </div>
          <div class="dashboard-panel" id="slot-trend"></div>
        </div>
        <div class="dashboard-body-side">
          <div class="dashboard-panel dashboard-panel-accent">
            <div class="dashboard-panel-header">
              <h3 class="dashboard-panel-title-sm">Scan summary</h3>
            </div>
            <p class="dashboard-panel-text">${conclusion}</p>
          </div>
          ${renderScanScopePanel(report)}
          <div class="dashboard-panel">
            <div class="dashboard-panel-header">
              <h3 class="dashboard-panel-title-sm">Scan Metrics</h3>
              <button class="btn btn-ghost btn-xs" id="dash-open-analyze">Analyze →</button>
            </div>
            ${renderScanMetrics(report)}
          </div>
          ${this.app.state.reAttestation ? renderReAttestationPreview(this.app.state.reAttestation) : ''}
        </div>
      </div>

      <div class="dashboard-bottom-grid">
        <div class="dashboard-panel" id="slot-repo-health">
          <div class="dashboard-panel-header">
            <h3 class="dashboard-panel-title-sm">Repository health</h3>
            <a class="btn btn-ghost btn-xs" href="/dashboard/repository-health">Details →</a>
          </div>
          <p class="text-muted"><span class="loading-spinner"></span> Loading optimization metrics…</p>
        </div>
        <div class="dashboard-panel" id="slot-path-health">
          <div class="dashboard-panel-header">
            <h3 class="dashboard-panel-title-sm">System Path Health</h3>
          </div>
          <p class="text-muted"><span class="loading-spinner"></span> Loading path health metrics…</p>
        </div>
      </div>
    `;
        const scanSlot = el.querySelector('#slot-scan-status');
        const scanHandlers = {
            getLastProjectPath: () => this.app.state.lastProjectPath,
            setLastProjectPath: (path) => { this.app.state.lastProjectPath = path; },
            getDefaultProjectPath: () => this.app.state.defaultProjectPath,
            onRescan: (path) => this.app.runScan(path),
            onLocalScanResult: (report) => {
                if (!report)
                    return;
                this.app.state.report = report;
                this.app.state.scanning = false;
                this.app.state.lastProjectPath = report.projectPath || report.projectRoot || this.app.state.lastProjectPath;
                if (this.app.scanService) {
                    this.app.scanService.report = report;
                }
                this.app.refreshCurrentView();
            }
        };
        // Use surgical DOM update if card already exists to prevent flicker
        const updated = updateScanStatusDom(scanSlot, report);
        if (!updated) {
            scanSlot.innerHTML = renderScanStatus(report, {
                scanning,
                config: this.app.state.config,
                lastProjectPath: this.app.state.lastProjectPath,
                defaultProjectPath: this.app.state.defaultProjectPath
            });
            bindScanStatus(scanSlot, scanHandlers);
        }
        const actionsSlot = el.querySelector('#slot-quick-actions');
        actionsSlot.innerHTML = renderQuickActions({ showSendAi: true });
        bindQuickActions(actionsSlot, {
            onRunScan: () => runDashboardScanFromInput(scanSlot.querySelector('#scan-root-input'), scanHandlers),
            onExport: () => {
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
            },
            onSendAi: async () => {
                var _a, _b, _c, _d, _e;
                const report = this.app.state.report;
                if (!report) {
                    showToast('No report loaded — run a scan first', 'error');
                    return;
                }
                const allIssues = report.rawIssues || report.detectedIssues || [];
                const reportSummary = {
                    gatePass: (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : 'N/A',
                    qualityScore: (_c = report.qualityScore) !== null && _c !== void 0 ? _c : 'N/A',
                    totalIssues: allIssues.length,
                    filesScanned: (_e = (_d = report.repositoryFilesTotal) !== null && _d !== void 0 ? _d : report.totalFiles) !== null && _e !== void 0 ? _e : 'N/A',
                    reportType: report.type || 'simplebeacon'
                };
                // If running inside a VS Code-family webview, message the extension directly
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
                        console.warn('[AI-Send] vscode.postMessage failed:', err);
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
            },
            onLegacy: () => { this.app.navigate('platform'); }
        });
        const issueSlot = el.querySelector('#slot-issue-list');
        issueSlot.appendChild(renderIssueList(categories, {
            onSelect: (cat) => this.app.navigate('results', { filter: cat })
        }));
        (_b = el.querySelector('#view-all-results')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            this.app.navigate('results');
        });
        (_c = el.querySelector('#dash-open-settings')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            this.app.navigate('settings');
        });
        (_d = el.querySelector('#dash-open-analyze')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            this.app.navigate('analyze');
        });
        const trendSlot = el.querySelector('#slot-trend');
        trendSlot.innerHTML = renderTrendSection(history);
        return el;
    }
    async ensureReportEnriched() {
        const report = this.app.state.report;
        if (!report)
            return;
        const enriched = await this.app.scanService.enrichReport(report);
        if (enriched !== report) {
            this.app.state.report = enriched;
            this.app.scanService.report = enriched;
            // Surgical DOM update avoids full re-render flicker
            const scanSlot = document.querySelector('#slot-scan-status');
            if (scanSlot) {
                updateScanStatusDom(scanSlot, enriched);
            }
            else {
                this.app.refreshCurrentView();
            }
        }
    }
    /**
     * Surgical scan-status refresh — avoids full mount flicker during active scans.
     * Returns true if the scan slot was updated in-place.
     */
    refreshScanStatus() {
        const scanSlot = document.querySelector('#slot-scan-status');
        if (!scanSlot)
            return false;
        const report = this.app.state.report;
        const scanning = this.app.state.scanning;
        const updated = updateScanStatusDom(scanSlot, report);
        if (updated) {
            // Update scanning state on rescan button
            const rescanBtn = scanSlot.querySelector('#rescan-btn');
            if (rescanBtn) {
                const expectedHtml = scanning
                    ? '<span class="loading-spinner"></span> Scanning…'
                    : '<i data-lucide="play" class="icon-16"></i> Scan';
                if (rescanBtn.innerHTML !== expectedHtml) {
                    rescanBtn.innerHTML = expectedHtml;
                }
                if (rescanBtn.disabled !== scanning) {
                    rescanBtn.disabled = scanning;
                }
            }
        }
        return updated;
    }
    mount(container) {
        var _a, _b;
        if (this._trendCleanup)
            this._trendCleanup();
        container.innerHTML = '';
        const view = this.render();
        container.appendChild(view);
        (_a = view.querySelector('#dash-run-scan')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.app.runScan());
        (_b = view.querySelector('#dash-goto-analyze')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => this.app.navigate('analyze'));
        if (!this.app.state.report)
            return;
        this.ensureReportEnriched();
        this.loadRepositoryHealth(view);
        this.loadPathHealth(view);
        requestAnimationFrame(() => {
            const trendSlot = view.querySelector('#slot-trend');
            this._trendCleanup = mountTrendChart(trendSlot, this.app.state.history) || null;
        });
        if (typeof window.lucide !== 'undefined')
            window.lucide.createIcons();
    }
    async loadRepositoryHealth(view) {
        const slot = view.querySelector('#slot-repo-health');
        if (!slot)
            return;
        try {
            const health = await fetchRepositoryHealth();
            slot.innerHTML = `
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="/dashboard/repository-health">Details →</a>
        </div>
        ${(health === null || health === void 0 ? void 0 : health.headline)
                ? renderRepositoryHealthSection(health, { compact: true })
                : '<p class="text-muted">No consolidation scan yet — run Analyze → Consolidation.</p>'}
      `;
        }
        catch (_a) {
            slot.innerHTML = `
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="/dashboard/repository-health">Details →</a>
        </div>
        <p class="text-muted">Repository health unavailable — run consolidation scan from Analyze.</p>
      `;
        }
    }
    loadPathHealth(view) {
        const slot = view.querySelector('#slot-path-health');
        if (!slot)
            return;
        try {
            slot.innerHTML = '';
            const pathHealthComponent = renderPathHealthDashboard();
            slot.appendChild(pathHealthComponent);
        }
        catch (error) {
            console.error('Error loading path health dashboard:', error);
            slot.innerHTML = '<p class="text-muted">Path health metrics unavailable.</p>';
        }
    }
    destroy() {
        if (this._trendCleanup)
            this._trendCleanup();
        cleanupPathHealthDashboard();
    }
}
