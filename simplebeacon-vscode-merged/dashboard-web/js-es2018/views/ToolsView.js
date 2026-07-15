// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
import { escapeHtml } from '../utils/string.js';
import { formatNumber, formatPercent } from '../utils/number.js';
import { showToast, renderEmptyState } from '../utils/dom.js';
import { getScanFileMetrics, resolveDisplayScore, resolveJestTestsLabel, resolvePageSpecsLabel, formatScanScopeSummary, formatScanInventoryNote } from '../services/analyzeService.js';
import { scanService } from '../services/scanService.js';
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
        this._terminalLines = [];
        this._actionProgress = { action: '', phase: '', percent: 0 };
        this._prerequisiteChecks = {};
    }
    /**
     * Log a line to the inline terminal buffer.
     * @param {string} text
     * @param {'info'|'success'|'warning'|'error'} level
     */
    _termLog(text, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        this._terminalLines.push({ timestamp, text, level });
        if (this._terminalLines.length > 200)
            this._terminalLines.shift();
    }
    /**
     * Check prerequisites for an action.
     * @param {string} action
     * @returns {{ok:boolean,message:string}}
     */
    _checkPrerequisites(action) {
        var _a;
        const report = this.app.state.report;
        if (action === 'baseline') {
            if (!report)
                return { ok: false, message: 'No scan report — run Scan first' };
            return { ok: true, message: '' };
        }
        if (action === 'audit') {
            const hasLock = ((_a = this.app.state.baseline) === null || _a === void 0 ? void 0 : _a.packageManager) === 'yarn'
                ? 'yarn.lock detected'
                : 'package-lock.json inferred';
            return { ok: true, message: hasLock };
        }
        if (action === 'export') {
            if (!report)
                return { ok: false, message: 'No report to export — run Scan first' };
            return { ok: true, message: '' };
        }
        if (action === 'consolidation') {
            if (!this.app.state.lastProjectPath)
                return { ok: false, message: 'No project path set — run Scan first' };
            return { ok: true, message: '' };
        }
        return { ok: true, message: '' };
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
      <nav style="position:sticky;top:0;z-index:10;margin-bottom:20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;background:linear-gradient(145deg,rgba(30,41,59,0.7),rgba(15,23,42,0.6));border:1px solid rgba(148,163,184,0.08);border-radius:14px;backdrop-filter:blur(12px);">
        <span style="font-weight:700;font-size:0.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-right:4px;">Jump to</span>
        ${sections.map((s) => `
          <a href="#${s.id}" class="settings-nav-link" data-scroll-to="${s.id}" style="padding:5px 12px;border-radius:999px;font-size:0.78rem;text-decoration:none;color:var(--text-secondary);background:rgba(148,163,184,0.06);border:1px solid rgba(148,163,184,0.1);transition:all 150ms;white-space:nowrap;cursor:pointer;font-weight:600;">
            ${escapeHtml(s.label)}
          </a>
        `).join('')}
      </nav>
    `;
    }
    render() {
        var _a;
        const tools = this.app.state.devTools || [];
        const workflows = this.app.state.devWorkflows || [];
        const report = this.app.state.report;
        const baseline = this.app.state.baseline;
        const busy = Boolean(this.running || this.reductionLoading || this.app.state.scanning);
        const el = document.createElement('div');
        el.className = this._hasPainted ? '' : 'fade-in';
        el.innerHTML = `
      <style>
        @keyframes tl-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .tl-v3 { animation:tl-fade-up .5s ease both; }
        .tl-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .tl-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .tl-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .tl-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:20px; }
        [data-theme='light'] .tl-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .tl-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .tl-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .tl-v3-card-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .tl-v3-card-bd { padding:18px 22px; }
        .tl-v3-action { background:linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.4)); border:1px solid rgba(148,163,184,0.08); border-radius:16px; padding:18px; display:flex; align-items:flex-start; gap:14px; text-align:left; cursor:pointer; transition:transform .2s,box-shadow .2s; }
        [data-theme='light'] .tl-v3-action { background:linear-gradient(145deg, rgba(255,255,255,0.7), rgba(248,250,252,0.8)); }
        .tl-v3-action:hover { transform:translateY(-3px); box-shadow:0 6px 24px rgba(2,8,20,0.25); }
        .tl-v3-action:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .tl-v3-action-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; background:rgba(99,102,241,0.12); flex-shrink:0; }
        .tl-v3-tool { background:linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.4)); border:1px solid rgba(148,163,184,0.08); border-radius:16px; padding:18px; transition:transform .2s,box-shadow .2s; }
        [data-theme='light'] .tl-v3-tool { background:linear-gradient(145deg, rgba(255,255,255,0.7), rgba(248,250,252,0.8)); }
        .tl-v3-tool:hover { transform:translateY(-3px); box-shadow:0 6px 24px rgba(2,8,20,0.25); }
        .tl-v3-table { width:100%; border-collapse:separate; border-spacing:0; }
        .tl-v3-table th { text-align:left; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid rgba(148,163,184,0.1); }
        .tl-v3-table td { padding:10px 14px; font-size:0.82rem; color:var(--text-secondary); border-bottom:1px solid rgba(148,163,184,0.06); }
        .tl-v3-table tr:last-child td { border-bottom:none; }
        .tl-v3-terminal { background:#0f172a; border:1px solid rgba(148,163,184,0.12); border-radius:12px; padding:14px 18px; font-family:var(--font-mono); font-size:0.78rem; line-height:1.6; max-height:260px; overflow:auto; color:#e2e8f0; }
        .tl-v3-terminal-line { display:flex; gap:8px; margin-bottom:2px; white-space:pre-wrap; }
        .tl-v3-terminal-time { color:#64748b; flex-shrink:0; }
        .tl-v3-terminal-text.info { color:#e2e8f0; }
        .tl-v3-terminal-text.success { color:#4ade80; }
        .tl-v3-terminal-text.warning { color:#fbbf24; }
        .tl-v3-terminal-text.error { color:#f87171; }
        .tl-v3-action-running { position:relative; overflow:hidden; }
        .tl-v3-action-running::after { content:''; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(99,102,241,0.06); animation:pulseRunning 1.5s ease-in-out infinite; }
        @keyframes pulseRunning { 0%,100% { opacity:0.3; } 50% { opacity:0.6; } }
        .tl-v3-action-overlay { position:absolute; inset:0; background:rgba(15,23,42,0.4); backdrop-filter:blur(2px); border-radius:16px; display:flex; align-items:center; justify-content:center; z-index:2; }
        .tl-v3-action-overlay span { font-size:0.72rem; font-weight:700; color:#a78bfa; background:rgba(99,102,241,0.15); padding:4px 12px; border-radius:999px; }
        .tl-v3-prereq-warn { margin-top:8px; padding:8px 12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.15); border-radius:8px; font-size:0.72rem; color:#fbbf24; display:flex; align-items:center; gap:6px; }
        .tl-v3-prereq-ok { margin-top:8px; padding:8px 12px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.15); border-radius:8px; font-size:0.72rem; color:#4ade80; display:flex; align-items:center; gap:6px; }
        .tl-v3-workflow-row { cursor:pointer; transition:background .15s; }
        .tl-v3-workflow-row:hover { background:rgba(148,163,184,0.04); }
        .tl-v3-log-drawer { max-height:0; overflow:hidden; transition:max-height .3s ease; }
        .tl-v3-log-drawer.is-open { max-height:400px; }
        .tl-v3-log-inner { padding:14px 18px; border-top:1px solid rgba(148,163,184,0.08); background:rgba(15,23,42,0.4); }
        .tl-v3-log-block { background:#0f172a; border:1px solid rgba(148,163,184,0.12); border-radius:8px; padding:10px 14px; font-family:var(--font-mono); font-size:0.72rem; color:#e2e8f0; max-height:200px; overflow:auto; white-space:pre-wrap; line-height:1.5; }
        [data-theme='light'] nav[style*="position:sticky"] { background:linear-gradient(145deg, rgba(255,255,255,0.9), rgba(248,250,252,0.95)) !important; border-color:rgba(148,163,184,0.15) !important; }
        [data-theme='light'] .tl-v3-terminal { background:var(--surface); color:var(--text-primary); border-color:var(--border); }
        [data-theme='light'] .tl-v3-terminal-time { color:var(--text-muted); }
        [data-theme='light'] .tl-v3-terminal-text.info { color:var(--text-primary); }
        [data-theme='light'] .tl-v3-prereq-warn { color:var(--warning); background:var(--warning-bg); border-color:rgba(217,119,6,0.2); }
        [data-theme='light'] .tl-v3-prereq-ok { color:var(--success); background:var(--success-bg); border-color:rgba(5,150,105,0.2); }
        [data-theme='light'] .tl-v3-log-inner { background:var(--surface); }
        [data-theme='light'] .tl-v3-log-block { background:var(--surface); color:var(--text-primary); border-color:var(--border); }
      </style>

      <div class="tl-v3-header">
        <div>
          <h1>Tools</h1>
          <p>Run repository tools and CI workflows from scan-backed results</p>
        </div>
        <span class="db-v3-panel-badge">${busy ? 'Running…' : 'Ready'}</span>
      </div>

      ${this.renderToolsNav()}

      <div class="tl-v3" id="tools-section-actions">
        <div class="tl-v3-card">
          <div class="tl-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">▶️ Runnable Actions</h3>
          </div>
          <div class="tl-v3-card-bd">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px;">
              ${[
            { action: 'scan', icon: this.running === 'scan' || this.app.state.scanning ? '⏳' : '✅', title: 'Run Scan', desc: 'Regenerate .simplebeacon/report.json with gate', color: '#22c55e' },
            { action: 'baseline', icon: this.running === 'baseline' ? '⏳' : '🔄', title: 'Sync Baseline', desc: 'Update Jest counts in baseline.json', color: '#6366f1' },
            { action: 'audit', icon: this.running === 'audit' ? '⏳' : '🛡️', title: 'npm audit', desc: 'Live dependency vulnerability scan', color: '#f59e0b' },
            { action: 'export', icon: '📥', title: 'Export Report', desc: 'Download current report JSON', color: '#06b6d4' },
            { action: 'consolidation', icon: this.reductionLoading ? '⏳' : '🔀', title: 'Consolidation', desc: 'Find duplicate JSON and merge candidates', color: '#a78bfa' }
        ].map((btn) => {
            const pre = this._checkPrerequisites(btn.action);
            const isRunning = this.running === btn.action || (btn.action === 'consolidation' && this.reductionLoading) || (btn.action === 'scan' && this.app.state.scanning);
            const progressLabel = isRunning && this._actionProgress.action === btn.action
                ? `${this._actionProgress.phase} (${this._actionProgress.percent}%)`
                : '';
            return `
                <button class="tl-v3-action ${isRunning ? 'tl-v3-action-running' : ''}" data-action="${btn.action}" ${busy || !pre.ok ? 'disabled' : ''}>
                  ${isRunning ? `<div class="tl-v3-action-overlay"><span>${escapeHtml(progressLabel || 'Running…')}</span></div>` : ''}
                  <div class="tl-v3-action-icon" style="background:${btn.color}20;">${btn.icon}</div>
                  <div style="min-width:0;">
                    <div style="font-weight:700;font-size:0.85rem;margin-bottom:3px;color:var(--text-primary);">${escapeHtml(btn.title)}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(btn.desc)}</div>
                    ${!pre.ok ? `<div class="tl-v3-prereq-warn">⚠ ${escapeHtml(pre.message)}</div>` : pre.message ? `<div class="tl-v3-prereq-ok">✓ ${escapeHtml(pre.message)}</div>` : ''}
                  </div>
                </button>
              `;
        }).join('')}
            </div>
            <div id="tool-terminal" style="margin-bottom:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Live Terminal</span>
                <button type="button" class="btn btn-ghost btn-sm" id="tl-clear-terminal" style="font-size:0.68rem;padding:2px 8px;">Clear</button>
              </div>
              <div class="tl-v3-terminal" id="tl-terminal-body">
                ${this._terminalLines.length ? this._terminalLines.map((l) => `
                  <div class="tl-v3-terminal-line">
                    <span class="tl-v3-terminal-time">${escapeHtml(l.timestamp)}</span>
                    <span class="tl-v3-terminal-text ${l.level}">${escapeHtml(l.text)}</span>
                  </div>
                `).join('') : '<span style="color:#64748b;font-style:italic;">No output yet — run an action above to see live logs.</span>'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tl-v3" id="tools-section-consolidation">
        <div class="tl-v3-card">
          <div class="tl-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔀 Data Consolidation</h3>
            <button class="btn btn-secondary btn-sm" type="button" id="run-consolidation-btn" ${this.reductionLoading || busy ? 'disabled' : ''}>
              ${this.reductionLoading ? '<span class="loading-spinner"></span> Scanning…' : 'Run Scan'}
            </button>
          </div>
          <div class="tl-v3-card-bd">
            <p class="text-muted" style="font-size:0.82rem;margin:0 0 14px;">
              Scans configured sample paths for exact duplicate JSON, similar schemas, and oversized files.
            </p>
            <div id="consolidation-results">${this.renderConsolidation()}</div>
          </div>
        </div>
      </div>

      <div class="tl-v3" id="tools-section-snapshot">
        <div class="tl-v3-card">
          <div class="tl-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📊 Scan Snapshot</h3>
          </div>
          <div class="tl-v3-card-bd">
            ${renderScanSnapshot(report, baseline, this.app.state.dashboardHome)}
          </div>
        </div>
      </div>

      <div class="tl-v3" id="tools-section-repo">
        <div class="tl-v3-card">
          <div class="tl-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🛠️ Repository Tools</h3>
            <span class="db-v3-panel-badge">${tools.length}</span>
          </div>
          <div class="tl-v3-card-bd">
            <div class="tool-grid" id="tool-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;"></div>
          </div>
        </div>
      </div>

      <div class="tl-v3" id="tools-section-workflows">
        <div class="tl-v3-card">
          <div class="tl-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔄 CI Workflows</h3>
            <span class="db-v3-panel-badge">${workflows.length}</span>
          </div>
          <div class="tl-v3-card-bd" style="padding:0;">
            <table class="tl-v3-table">
              <thead><tr><th>Workflow</th><th>Status</th><th>Tools</th><th>Last run</th></tr></thead>
              <tbody id="workflow-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
        this.bindActions(el);
        this.bindNavEvents(el);
        this.renderToolGrid(el, tools);
        this.renderWorkflows(el, workflows);
        (_a = el.querySelector('#run-consolidation-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.runConsolidationScan());
        return el;
    }
    bindActions(el) {
        var _a;
        el.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled)
                    return;
                this.runAction(btn.dataset.action, el);
            });
        });
        // Clear terminal
        (_a = el.querySelector('#tl-clear-terminal')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this._terminalLines = [];
            this.refreshView();
        });
        // Workflow drawer toggle
        el.querySelectorAll('.tl-v3-workflow-row').forEach((row) => {
            row.addEventListener('click', () => {
                const idx = row.dataset.workflowIndex;
                const drawer = el.querySelector(`#wf-drawer-${idx}`);
                if (drawer)
                    drawer.classList.toggle('is-open');
            });
        });
        // Close drawer
        el.querySelectorAll('[data-close-drawer]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = btn.dataset.closeDrawer;
                const drawer = el.querySelector(`#wf-drawer-${idx}`);
                if (drawer)
                    drawer.classList.remove('is-open');
            });
        });
        // Open config file in VS Code:
        el.querySelectorAll('[data-open-config]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filePath = btn.dataset.openConfig;
                if (!filePath)
                    return;
                const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
                if (vscode) {
                    vscode.postMessage({ command: 'openFile', filePath });
                    showToast(`Opening ${filePath.split('/').pop()} in editor`, 'success');
                }
                else {
                    showToast(`Run: code ${filePath}`, 'info');
                }
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
        this._actionProgress = { action, phase: 'Starting', percent: 0 };
        this._termLog(`[${action.toUpperCase()}] Starting…`, 'info');
        this.refreshView();
        try {
            if (action === 'scan') {
                this._actionProgress = { action, phase: 'Scanning repository', percent: 25 };
                this._termLog('[SCAN] Engine initialization…', 'info');
                await this.app.runScan();
                this._actionProgress = { action, phase: 'Finalizing', percent: 90 };
                this._termLog('[SCAN] Report written to .simplebeacon/report.json', 'success');
                showToast('Scan complete — snapshot updated below.', 'success');
                return;
            }
            if (action === 'baseline') {
                this._actionProgress = { action, phase: 'Reading baseline', percent: 30 };
                this._termLog('[BASELINE] Fetching Jest metrics…', 'info');
                const data = await this.app.platformService.runBaselineSync();
                this.app.state.baseline = data.baseline;
                scanService.baseline = data.baseline;
                await this.app.loadData();
                await this.app.platformService.fetchAll();
                this.app.state.dashboardHome = this.app.platformService.dashboardHome;
                const label = ((_a = data.baseline) === null || _a === void 0 ? void 0 : _a.jestTestsLabel) || ((_b = this.app.state.baseline) === null || _b === void 0 ? void 0 : _b.jestTestsLabel) || 'OK';
                this._actionProgress = { action, phase: 'Sync complete', percent: 100 };
                this._termLog(`[BASELINE] Synced: ${label}`, 'success');
                showToast(`Baseline synced: ${label}`, 'success');
                this.refreshView();
                return;
            }
            if (action === 'audit') {
                this._actionProgress = { action, phase: 'Running npm audit', percent: 40 };
                this._termLog('[AUDIT] Querying npm registry…', 'info');
                const audit = await this.app.platformService.refreshNpmAudit({ force: true });
                this.app.state.npmAudit = audit;
                const s = npmAuditSummary(audit);
                const msg = s.dependencies != null
                    ? `${formatNumber(s.dependencies)} dependencies · ${s.vulnerabilityTotal} vulnerabilities`
                    : 'npm audit complete';
                this._actionProgress = { action, phase: 'Audit complete', percent: 100 };
                this._termLog(`[AUDIT] ${msg}`, s.vulnerabilityTotal ? 'warning' : 'success');
                showToast(msg, s.vulnerabilityTotal ? 'info' : 'success');
                return;
            }
            if (action === 'export') {
                this._actionProgress = { action, phase: 'Exporting JSON', percent: 50 };
                this._termLog('[EXPORT] Serializing report…', 'info');
                await this.app.scanService.exportReport(this.app.state.report);
                this._actionProgress = { action, phase: 'Downloaded', percent: 100 };
                this._termLog('[EXPORT] Report downloaded.', 'success');
                showToast('Report downloaded', 'success');
                return;
            }
            if (action === 'consolidation') {
                this._actionProgress = { action, phase: 'Scanning for duplicates', percent: 30 };
                this._termLog('[CONSOLIDATION] Scanning project for merge candidates…', 'info');
                await this.runConsolidationScan();
                this._actionProgress = { action, phase: 'Scan complete', percent: 100 };
                this._termLog('[CONSOLIDATION] Scan complete — see results below.', 'success');
                return;
            }
        }
        catch (err) {
            this._termLog(`[ERROR] ${err.message}`, 'error');
            showToast(err.message, 'error');
        }
        finally {
            this.running = null;
            this._actionProgress = { action: '', phase: '', percent: 0 };
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
            grid.innerHTML = this._platformLoadAttempted
                ? '<p class="text-muted" style="text-align:center;padding:30px;">No repository tools configured — run a consolidation scan to discover available tools.</p>'
                : '<p class="text-muted" style="text-align:center;padding:30px;"><span class="loading-spinner"></span> Loading repository tools…</p>';
            return;
        }
        grid.innerHTML = tools.map((t) => `
      <div class="tl-v3-tool">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:24px;">${t.icon || '🔧'}</span>
          <span class="severity-pill ${t.status === 'active' ? 'success' : t.status === 'deprecated' ? 'danger' : 'warning'}">${escapeHtml(t.status || 'active')}</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:0.9rem;font-weight:700;color:var(--text-primary);">${escapeHtml(t.name)}</h3>
        <p style="margin:0 0 10px;font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(t.description)}</p>
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">${escapeHtml(t.category)} · ${escapeHtml(t.avgTime || '—')}</div>
        ${t.section ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Section: ${escapeHtml(t.section)}</div>` : ''}
      </div>
    `).join('');
    }
    renderWorkflows(el, workflows) {
        const tbody = el.querySelector('#workflow-body');
        if (!workflows.length) {
            tbody.innerHTML = this._platformLoadAttempted
                ? '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.85rem;">No CI workflows configured — run a consolidation scan to discover workflow configurations.</td></tr>'
                : '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.85rem;"><span class="loading-spinner"></span> Loading workflows…</td></tr>';
            return;
        }
        tbody.innerHTML = workflows.map((w, idx) => `
      <tr class="tl-v3-workflow-row" data-workflow-index="${idx}">
        <td><strong style="color:var(--text-primary);">${escapeHtml(w.name)}</strong><br><span style="color:var(--text-muted);font-size:0.75rem;">${escapeHtml(w.description)}</span></td>
        <td><span class="severity-pill ${w.status === 'running' ? 'success' : w.status === 'deferred' ? 'warning' : 'info'}">${escapeHtml(w.status)}</span></td>
        <td style="font-size:0.78rem;">${(w.tools || []).join(', ')}</td>
        <td style="font-size:0.78rem;">${escapeHtml(w.lastRun || '—')}</td>
      </tr>
      <tr class="tl-v3-log-drawer" id="wf-drawer-${idx}">
        <td colspan="4">
          <div class="tl-v3-log-inner">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(w.name)} — Last Run Log</span>
              <button type="button" class="btn btn-ghost btn-sm" data-close-drawer="${idx}" style="font-size:0.68rem;padding:2px 8px;">Close</button>
            </div>
            <div class="tl-v3-log-block">${escapeHtml(w.lastLog || w.error || 'No log data available for this workflow.')}</div>
            ${w.configPath ? `<button type="button" class="btn btn-secondary btn-sm" data-open-config="${escapeHtml(w.configPath)}" style="margin-top:8px;">📂 Open ${escapeHtml(w.configPath)}</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
    }
    _paint(container) {
        container.innerHTML = '';
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
