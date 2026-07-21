// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, formatNumber, formatPercent, showToast, renderEmptyState } from '../utils.js';
import { getScanFileMetrics, resolveDisplayScore, resolveJestTestsLabel, resolvePageSpecsLabel, formatScanScopeSummary, formatScanInventoryNote } from '../services/analyzeService.js?v=20260716cachefix1';
import { scanService } from '../services/scanService.js?v=20260716cachefix1';
import { renderConsolidationPanel } from '../components/ConsolidationReport.js';
/**
 * Npm audit summary.
 * @param {any} audit
 * @returns {any}
 */
function npmAuditSummary(audit) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const summary = (audit === null || audit === void 0 ? void 0 : audit.summary) || ((_a = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _a === void 0 ? void 0 : _a.vulnerabilities) || {};
    const deps = (audit === null || audit === void 0 ? void 0 : audit.dependencies) || ((_b = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _b === void 0 ? void 0 : _b.dependencies) || {};
    return {
        dependencies: (_d = (_c = summary.dependencies) !== null && _c !== void 0 ? _c : deps.total) !== null && _d !== void 0 ? _d : null,
        vulnerabilityTotal: (_f = (_e = summary.vulnerabilityTotal) !== null && _e !== void 0 ? _e : summary.total) !== null && _f !== void 0 ? _f : ((_h = (_g = audit === null || audit === void 0 ? void 0 : audit.vulnerabilities) === null || _g === void 0 ? void 0 : _g.length) !== null && _h !== void 0 ? _h : 0),
        critical: (_j = summary.critical) !== null && _j !== void 0 ? _j : 0,
        high: (_k = summary.high) !== null && _k !== void 0 ? _k : 0,
        moderate: (_m = (_l = summary.moderate) !== null && _l !== void 0 ? _l : summary.medium) !== null && _m !== void 0 ? _m : 0,
        low: (_o = summary.low) !== null && _o !== void 0 ? _o : 0
    };
}
/**
 * Render scan snapshot.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function renderScanSnapshot(report, baseline, dashboardHome) {
    var _a, _b, _c, _d, _e, _f;
    if (!report) {
        return renderEmptyState({
            icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
            title: 'No scan report loaded',
            body: 'Run Simplebeacon Scan to populate metrics.'
        });
    }
    const metrics = getScanFileMetrics(report);
    const inventoryNote = formatScanInventoryNote(report);
    return `
    <div class="metrics-row mb-2">
      <div class="metric-chip gate-badge ${((_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) ? 'pass' : 'warn'}">${((_b = report.gate) === null || _b === void 0 ? void 0 : _b.pass) ? 'GATE PASS' : 'GATE FAIL'}</div>
      <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
      <div class="metric-chip"><strong>${formatNumber((_c = metrics.mockSampleFiles) !== null && _c !== void 0 ? _c : report.totalFiles)}</strong> test/fixture</div>
      ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
      <div class="metric-chip"><strong>${formatNumber((_d = metrics.ruleScopedFilesAnalyzed) !== null && _d !== void 0 ? _d : metrics.credentialScanned)}</strong> gate rules checked</div>
      <div class="metric-chip"><strong>${formatPercent(report.schemaCompliance)}</strong> schema</div>
      <div class="metric-chip"><strong>${(_e = resolvePageSpecsLabel(report, baseline)) !== null && _e !== void 0 ? _e : '—'}</strong> page specs</div>
      <div class="metric-chip"><strong>${(_f = resolveJestTestsLabel(baseline, dashboardHome)) !== null && _f !== void 0 ? _f : '—'}</strong> Jest</div>
    </div>
    <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">
      ${escapeHtml(formatScanScopeSummary(report))}${inventoryNote ? ` · ${escapeHtml(inventoryNote)}` : ''}
    </p>
  `;
}
/**
 * Tools view.
 */
export class ToolsView {
    constructor(app) {
        this.app = app;
        this.running = null;
        this.reductionScan = app.state.mergerReductionScan || null;
        this.reductionLoading = false;
        this._mountRoot = null;
        this.lastOutput = null;
        this._hasPainted = false;
        this._platformLoadAttempted = false;
        this._scanLoadAttempted = false;
        this._platformLoadPromise = null;
        this._scanLoadPromise = null;
    }
    renderToolsNav() {
        const sections = [
            { id: 'tools-section-actions', label: 'Actions' },
            { id: 'tools-section-consolidation', label: 'Consolidation' },
            { id: 'tools-section-snapshot', label: 'Snapshot' },
            { id: 'tools-section-repo', label: 'Repository' },
            { id: 'tools-section-workflows', label: 'Workflows' }
        ];
        return `
      <nav class="settings-nav" style="
        position:sticky;
        top:0;
        z-index:10;
        background:var(--surface-elevated);
        border:1px solid var(--border);
        border-radius:var(--radius-md);
        padding:var(--space-2) var(--space-3);
        margin-bottom:var(--space-4);
        display:flex;
        align-items:center;
        gap:var(--space-1);
        flex-wrap:wrap;">
        <span style="font-weight:600;font-size:0.875rem;margin-right:var(--space-2);color:var(--text-secondary);">Jump to:</span>
        ${sections.map((s) => `
          <a href="#${s.id}" class="settings-nav-link" data-scroll-to="${s.id}" style="
            padding:4px 10px;
            border-radius:999px;
            font-size:0.8rem;
            text-decoration:none;
            color:var(--text-secondary);
            background:var(--surface);
            border:1px solid var(--border);
            transition:all 150ms;
            white-space:nowrap;
            cursor:pointer;">
            ${escapeHtml(s.label)}
          </a>
        `).join('')}
      </nav>
    `;
    }
    render() {
        var _a, _b;
        const tools = this.app.state.devTools || [];
        const workflows = this.app.state.devWorkflows || [];
        const report = this.app.state.report;
        const baseline = this.app.state.baseline;
        const busy = Boolean(this.running || this.reductionLoading || this.app.state.scanning);
        const el = document.createElement('div');
        el.className = this._hasPainted ? '' : 'fade-in';
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
        el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Tools</h1>
        <p class="text-muted analyze-hero-sub">Run repository tools and CI workflows from scan-backed results.</p>
      </div>

      ${this.renderToolsNav()}

      <div class="section-block" id="tools-section-actions">
        <div class="section-heading">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:1.25rem;">▶️</span> Runnable Actions
          </h2>
          <span class="text-muted" style="font-size:var(--font-size-sm);">${busy ? 'Running…' : 'Ready'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-3);margin-bottom:var(--space-4);">
          ${[
            { action: 'scan', icon: this.running === 'scan' || this.app.state.scanning ? '⏳' : '✅', title: 'Run Scan', desc: 'Regenerate .simplebeacon/report.json with gate' },
            { action: 'baseline', icon: this.running === 'baseline' ? '⏳' : '🔄', title: 'Sync Baseline', desc: 'Update Jest counts in baseline.json' },
            { action: 'audit', icon: this.running === 'audit' ? '⏳' : '🛡️', title: 'npm audit', desc: 'Live dependency vulnerability scan' },
            { action: 'export', icon: '📥', title: 'Export Report', desc: 'Download current report JSON' },
            { action: 'consolidation', icon: this.reductionLoading ? '⏳' : '🔀', title: 'Consolidation', desc: 'Find duplicate JSON and merge candidates' }
        ].map((btn) => `
            <button class="card card-interactive" data-action="${btn.action}" ${busy ? 'disabled' : ''} style="
              display:flex;
              align-items:flex-start;
              gap:var(--space-3);
              padding:var(--space-4);
              text-align:left;
              cursor:pointer;
              background:var(--surface);
              border:1px solid var(--border);
              border-radius:var(--radius-lg);
              opacity:${busy ? '0.6' : '1'};
              transition:transform 150ms,box-shadow 150ms,border-color 150ms;">
              <span style="font-size:1.5rem;flex-shrink:0;margin-top:2px;">${btn.icon}</span>
              <div style="min-width:0;">
                <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:2px;">${escapeHtml(btn.title)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-secondary);line-height:1.4;">${escapeHtml(btn.desc)}</div>
              </div>
            </button>
          `).join('')}
        </div>
        <div id="tool-output" role="status" aria-live="polite" class="card ${this.lastOutput && this.lastOutput.visible !== false ? '' : 'hidden'}" style="padding:var(--space-4);">${((_a = this.lastOutput) === null || _a === void 0 ? void 0 : _a.html) || ''}</div>
      </div>

      <div class="section-block" id="tools-section-consolidation">
        <div class="section-heading">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:1.25rem;">🔀</span> Data Consolidation
          </h2>
          <button class="btn btn-secondary btn-sm" type="button" id="run-consolidation-btn" ${this.reductionLoading || busy ? 'disabled' : ''}>
            ${this.reductionLoading ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
        <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">
          Scans configured sample paths for exact duplicate JSON, similar schemas, and oversized files.
        </p>
        <div id="consolidation-results">${this.renderConsolidation()}</div>
      </div>

      <div class="section-block" id="tools-section-snapshot">
        <div class="section-heading">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:1.25rem;">📊</span> Scan Snapshot
          </h2>
        </div>
        <div class="card" style="padding:var(--space-4);">
          ${renderScanSnapshot(report, baseline, this.app.state.dashboardHome)}
        </div>
      </div>

      <div class="section-block" id="tools-section-repo">
        <div class="section-heading">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:1.25rem;">🛠️</span> Repository Tools
            <span class="text-muted" style="font-size:var(--font-size-sm);font-weight:400;">(${tools.length})</span>
          </h2>
        </div>
        <div class="tool-grid" id="tool-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-3);"></div>
      </div>

      <div class="section-block" id="tools-section-workflows">
        <div class="section-heading">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:1.25rem;">🔄</span> CI Workflows
            <span class="text-muted" style="font-size:var(--font-size-sm);font-weight:400;">(${workflows.length})</span>
          </h2>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
          <table class="results-table">
            <thead><tr><th>Workflow</th><th>Status</th><th>Tools</th><th>Last run</th></tr></thead>
            <tbody id="workflow-body"></tbody>
          </table>
        </div>
      </div>
    `;
        this.bindActions(el);
        this.bindNavEvents(el);
        this.renderToolGrid(el, tools);
        this.renderWorkflows(el, workflows);
        (_b = el.querySelector('#run-consolidation-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => this.runConsolidationScan());
        return el;
    }
    bindActions(el) {
        el.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled)
                    return;
                this.runAction(btn.dataset.action, el);
            });
        });
    }
    bindNavEvents(root) {
        root.querySelectorAll('[data-scroll-to]').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.scrollTo;
                const target = root.querySelector(`#${targetId}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
    setOutput(el, html, visible = true) {
        this.lastOutput = { html, visible };
        const output = el === null || el === void 0 ? void 0 : el.querySelector('#tool-output');
        if (!output)
            return;
        output.classList.toggle('hidden', !visible);
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
        output.innerHTML = html;
    }
    refreshView() {
        if (this._mountRoot && this.app.currentView === this) {
            this._paint(this._mountRoot);
        }
    }
    async runAction(action, el) {
        var _a, _b;
        if (this.running || this.reductionLoading || this.app.state.scanning)
            return;
        this.running = action;
        this.setOutput(el, '<span class="loading-spinner"></span> Running…');
        this.refreshView();
        try {
            if (action === 'scan') {
                await this.app.runScan();
                this.setOutput(el, '<p class="text-success">Scan complete — snapshot updated below.</p>');
                return;
            }
            if (action === 'baseline') {
                const data = await this.app.platformService.runBaselineSync();
                this.app.state.baseline = data.baseline;
                scanService.baseline = data.baseline;
                await this.app.loadData();
                await this.app.platformService.fetchAll();
                this.app.state.dashboardHome = this.app.platformService.dashboardHome;
                const label = ((_a = data.baseline) === null || _a === void 0 ? void 0 : _a.jestTestsLabel) || ((_b = this.app.state.baseline) === null || _b === void 0 ? void 0 : _b.jestTestsLabel) || 'OK';
                this.setOutput(el, `<p class="text-success">Baseline synced: ${escapeHtml(label)}</p>`);
                showToast(`Baseline synced: ${label}`, 'success');
                this.refreshView();
                return;
            }
            if (action === 'audit') {
                const audit = await this.app.platformService.refreshNpmAudit({ force: true });
                this.app.state.npmAudit = audit;
                const s = npmAuditSummary(audit);
                const msg = s.dependencies != null
                    ? `${formatNumber(s.dependencies)} dependencies · ${s.vulnerabilityTotal} vulnerabilities`
                    : 'npm audit complete';
                showToast(msg, s.vulnerabilityTotal ? 'info' : 'success');
                this.setOutput(el, `
          <p class="text-success">${escapeHtml(msg)}</p>
          <p class="text-muted text-sm mt-2">View full details on <a href="/dashboard/quality">Quality & Security</a>.</p>
        `);
                return;
            }
            if (action === 'export') {
                await this.app.scanService.exportReport();
                this.setOutput(el, '<p class="text-success">Report downloaded.</p>');
                showToast('Report downloaded', 'success');
                return;
            }
            if (action === 'consolidation') {
                await this.runConsolidationScan();
                this.setOutput(el, '<p class="text-success">Consolidation scan complete — see results below.</p>', false);
                return;
            }
        }
        catch (err) {
            this.setOutput(el, `<p class="text-danger">${escapeHtml(err.message)}</p>`);
            showToast(err.message, 'error');
        }
        finally {
            this.running = null;
            this.refreshView();
        }
    }
    async runConsolidationScan() {
        if (this.reductionLoading)
            return;
        this.reductionLoading = true;
        this.refreshView();
        try {
            this.reductionScan = await this.app.platformService.fetchMergerReductionScan(this.app.state.lastProjectPath || undefined);
            this.app.state.mergerReductionScan = this.reductionScan;
            showToast('Consolidation scan complete', 'success');
        }
        catch (err) {
            this.reductionScan = { error: err.message };
            showToast(err.message, 'error');
        }
        finally {
            this.reductionLoading = false;
            this.refreshView();
        }
    }
    renderConsolidation() {
        var _a;
        return renderConsolidationPanel({
            scan: this.reductionScan,
            loading: this.reductionLoading,
            error: (_a = this.reductionScan) === null || _a === void 0 ? void 0 : _a.error
        });
    }
    renderToolGrid(el, tools) {
        const grid = el.querySelector('#tool-grid');
        if (!tools.length) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
            grid.innerHTML = this._platformLoadAttempted
                ? '<p class="text-muted card">No repository tools configured — run a consolidation scan to discover available tools.</p>'
                : '<p class="text-muted"><span class="loading-spinner"></span> Loading repository tools…</p>';
            return;
        }
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
        grid.innerHTML = tools.map((t) => `
      <div class="tool-card">
        <div class="tool-card-header">
          <span>${t.icon || '🔧'}</span>
          <span class="tool-card-status ${t.status}">${escapeHtml(t.status || 'active')}</span>
        </div>
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.description)}</p>
        <div class="tool-card-meta">${escapeHtml(t.category)} · ${escapeHtml(t.avgTime || '—')}</div>
        ${t.section ? `<span class="tool-card-meta">Section: ${escapeHtml(t.section)}</span>` : ''}
      </div>
    `).join('');
    }
    renderWorkflows(el, workflows) {
        const tbody = el.querySelector('#workflow-body');
        if (!workflows.length) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
            tbody.innerHTML = this._platformLoadAttempted
                ? '<tr><td colspan="4" class="text-muted">No CI workflows configured — run a consolidation scan to discover workflow configurations.</td></tr>'
                : '<tr><td colspan="4" class="text-muted"><span class="loading-spinner"></span> Loading workflows…</td></tr>';
            return;
        }
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
        tbody.innerHTML = workflows.map((w) => `
      <tr>
        <td><strong>${escapeHtml(w.name)}</strong><br><span class="text-muted">${escapeHtml(w.description)}</span></td>
        <td><span class="severity-pill ${w.status === 'running' ? 'low' : w.status === 'deferred' ? 'medium' : 'high'}">${escapeHtml(w.status)}</span></td>
        <td>${(w.tools || []).join(', ')}</td>
        <td>${escapeHtml(w.lastRun || '—')}</td>
      </tr>
    `).join('');
    }
    _paint(container) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
        window.setSafeHTML(container, '');
        container.appendChild(this.render());
        this._hasPainted = true;
    }
    async _ensurePlatformData() {
        if (this._platformLoadAttempted)
            return;
        if (this._platformLoadPromise)
            return this._platformLoadPromise;
        if ((this.app.state.devTools || []).length || (this.app.state.devWorkflows || []).length) {
            this._platformLoadAttempted = true;
            return;
        }
        this._platformLoadPromise = (async () => {
            try {
                await this.app.loadPlatformData();
            }
            catch (_) {
                /* platform stubs may be unavailable in some dev setups */
            }
            finally {
                this._platformLoadAttempted = true;
                this._platformLoadPromise = null;
                if (this._mountRoot && this.app.currentView === this) {
                    this._paint(this._mountRoot);
                }
            }
        })();
        try {
            await this._platformLoadPromise;
        }
        catch (_) {
            /* platform load errors handled in _ensurePlatformData promise */
        }
    }
    async _ensureScanData() {
        if (this._scanLoadAttempted || this.app.state.dataLoading || this.app.state.report)
            return;
        if (this._scanLoadPromise)
            return this._scanLoadPromise;
        this._scanLoadPromise = (async () => {
            try {
                await this.app.loadData();
            }
            catch (_) {
                /* auth or server errors surface via other views */
            }
            finally {
                this._scanLoadAttempted = true;
                this._scanLoadPromise = null;
                if (this._mountRoot && this.app.currentView === this) {
                    this._paint(this._mountRoot);
                }
            }
        })();
        try {
            await this._scanLoadPromise;
        }
        catch (_) {
            /* scan load errors handled in _ensureScanData promise */
        }
    }
    mount(container) {
        this._mountRoot = container;
        this.reductionScan = this.app.state.mergerReductionScan || this.reductionScan;
        this._paint(container);
        this._ensureScanData();
        this._ensurePlatformData();
    }
}
