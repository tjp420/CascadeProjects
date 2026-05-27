import { escapeHtml, formatNumber, formatPercent, showToast } from '../utils.js';
import {
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  formatScanScopeSummary,
  formatScanInventoryNote
} from '../services/analyzeService.js';
import { scanService } from '../services/scanService.js';
import { renderConsolidationPanel } from '../components/ConsolidationReport.js';

function npmAuditSummary(audit) {
  const summary = audit?.summary || audit?.metadata?.vulnerabilities || {};
  const deps = audit?.dependencies || audit?.metadata?.dependencies || {};
  return {
    dependencies: summary.dependencies ?? deps.total ?? null,
    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? (audit?.vulnerabilities?.length ?? 0),
    critical: summary.critical ?? 0,
    high: summary.high ?? 0,
    moderate: summary.moderate ?? summary.medium ?? 0,
    low: summary.low ?? 0
  };
}

function renderScanSnapshot(report, baseline, dashboardHome) {
  if (!report) {
    return '<p class="text-muted card">No scan report loaded — run Simplebeacon Scan to populate metrics.</p>';
  }

  const metrics = getScanFileMetrics(report);
  const inventoryNote = formatScanInventoryNote(report);

  return `
    <div class="metrics-row mb-2">
      <div class="metric-chip gate-badge ${report.gate?.pass ? 'pass' : 'warn'}">${report.gate?.pass ? 'GATE PASS' : 'GATE FAIL'}</div>
      <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
      <div class="metric-chip"><strong>${formatNumber(metrics.mockSampleFiles ?? report.totalFiles)}</strong> mock/sample</div>
      ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
      <div class="metric-chip"><strong>${formatNumber(metrics.ruleScopedFilesAnalyzed ?? metrics.credentialScanned)}</strong> gate rules checked</div>
      <div class="metric-chip"><strong>${formatPercent(report.schemaCompliance)}</strong> schema</div>
      <div class="metric-chip"><strong>${resolvePageSpecsLabel(report, baseline) ?? '—'}</strong> page specs</div>
      <div class="metric-chip"><strong>${resolveJestTestsLabel(baseline, dashboardHome) ?? '—'}</strong> Jest</div>
    </div>
    <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">
      ${escapeHtml(formatScanScopeSummary(report))}${inventoryNote ? ` · ${escapeHtml(inventoryNote)}` : ''}
    </p>
  `;
}

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

  render() {
    const tools = this.app.state.devTools || [];
    const workflows = this.app.state.devWorkflows || [];
    const report = this.app.state.report;
    const baseline = this.app.state.baseline;
    const busy = Boolean(this.running || this.reductionLoading || this.app.state.scanning);

    const el = document.createElement('div');
    el.className = this._hasPainted ? '' : 'fade-in';
    el.innerHTML = `
      <h1 class="page-title">Tools</h1>
      <p class="text-muted mb-6">Run repository tools and CI workflows from scan-backed results.</p>

      <div class="section-block">
        <div class="section-heading"><h2>Runnable Actions</h2></div>
        <div class="tool-action-grid">
          <button class="tool-action-card" data-action="scan" ${busy ? 'disabled' : ''}>
            <span class="tool-action-icon">${this.running === 'scan' || this.app.state.scanning ? '⏳' : '✅'}</span>
            <span class="tool-action-title">Run Simplebeacon Scan</span>
            <span class="tool-action-desc">Regenerate .simplebeacon/report.json with gate</span>
          </button>
          <button class="tool-action-card" data-action="baseline" ${busy ? 'disabled' : ''}>
            <span class="tool-action-icon">${this.running === 'baseline' ? '⏳' : '🔄'}</span>
            <span class="tool-action-title">Sync Baseline</span>
            <span class="tool-action-desc">Update Jest counts in .simplebeacon/baseline.json</span>
          </button>
          <button class="tool-action-card" data-action="audit" ${busy ? 'disabled' : ''}>
            <span class="tool-action-icon">${this.running === 'audit' ? '⏳' : '🛡️'}</span>
            <span class="tool-action-title">Run npm audit</span>
            <span class="tool-action-desc">Live dependency vulnerability scan</span>
          </button>
          <button class="tool-action-card" data-action="export" ${busy ? 'disabled' : ''}>
            <span class="tool-action-icon">📥</span>
            <span class="tool-action-title">Export Scan Report</span>
            <span class="tool-action-desc">Download current report JSON</span>
          </button>
          <button class="tool-action-card" data-action="consolidation" ${busy ? 'disabled' : ''}>
            <span class="tool-action-icon">${this.reductionLoading ? '⏳' : '🔀'}</span>
            <span class="tool-action-title">Consolidation Scan</span>
            <span class="tool-action-desc">Find duplicate JSON and merge candidates in sample paths</span>
          </button>
        </div>
        <div id="tool-output" role="status" aria-live="polite" class="detail-panel ${this.lastOutput && this.lastOutput.visible !== false ? '' : 'hidden'} mt-4">${this.lastOutput?.html || ''}</div>
      </div>

      <div class="section-block" id="consolidation-section">
        <div class="section-heading">
          <h2>Data Consolidation</h2>
          <button class="btn btn-secondary btn-sm" type="button" id="run-consolidation-btn" ${this.reductionLoading || busy ? 'disabled' : ''}>
            ${this.reductionLoading ? 'Scanning…' : 'Run consolidation scan'}
          </button>
        </div>
        <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">
          Scans configured sample paths for exact duplicate JSON, similar schemas, and oversized files.
        </p>
        <div id="consolidation-results">${this.renderConsolidation()}</div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Scan Snapshot</h2></div>
        ${renderScanSnapshot(report, baseline, this.app.state.dashboardHome)}
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Repository Tools (${tools.length})</h2></div>
        <div class="tool-grid" id="tool-grid"></div>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>CI Workflows (${workflows.length})</h2></div>
        <div class="card" style="padding:0;overflow:hidden;">
          <table class="results-table">
            <thead><tr><th>Workflow</th><th>Status</th><th>Tools</th><th>Last run</th></tr></thead>
            <tbody id="workflow-body"></tbody>
          </table>
        </div>
      </div>
    `;

    this.bindActions(el);
    this.renderToolGrid(el, tools);
    this.renderWorkflows(el, workflows);
    el.querySelector('#run-consolidation-btn')?.addEventListener('click', () => this.runConsolidationScan());
    return el;
  }

  bindActions(el) {
    el.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.runAction(btn.dataset.action, el);
      });
    });
  }

  setOutput(el, html, visible = true) {
    this.lastOutput = { html, visible };
    const output = el?.querySelector('#tool-output');
    if (!output) return;
    output.classList.toggle('hidden', !visible);
    output.innerHTML = html;
  }

  refreshView() {
    if (this._mountRoot && this.app.currentView === this) {
      this._paint(this._mountRoot);
    }
  }

  async runAction(action, el) {
    if (this.running || this.reductionLoading || this.app.state.scanning) return;

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
        const label = data.baseline?.jestTestsLabel || this.app.state.baseline?.jestTestsLabel || 'OK';
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
          <p class="text-muted text-sm mt-2">View full details on <a href="#/quality">Quality & Security</a>.</p>
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
    } catch (err) {
      this.setOutput(el, `<p class="text-danger">${escapeHtml(err.message)}</p>`);
      showToast(err.message, 'error');
    } finally {
      this.running = null;
      this.refreshView();
    }
  }

  async runConsolidationScan() {
    if (this.reductionLoading) return;

    this.reductionLoading = true;
    this.refreshView();

    try {
      this.reductionScan = await this.app.platformService.fetchMergerReductionScan(
        this.app.state.lastProjectPath || undefined
      );
      this.app.state.mergerReductionScan = this.reductionScan;
      showToast('Consolidation scan complete', 'success');
    } catch (err) {
      this.reductionScan = { error: err.message };
      showToast(err.message, 'error');
    } finally {
      this.reductionLoading = false;
      this.refreshView();
    }
  }

  renderConsolidation() {
    return renderConsolidationPanel({
      scan: this.reductionScan,
      loading: this.reductionLoading,
      error: this.reductionScan?.error
    });
  }

  renderToolGrid(el, tools) {
    const grid = el.querySelector('#tool-grid');
    if (!tools.length) {
      grid.innerHTML = '<p class="text-muted"><span class="loading-spinner"></span> Loading repository tools…</p>';
      return;
    }
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
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Loading workflows…</td></tr>';
      return;
    }
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
    container.innerHTML = '';
    container.appendChild(this.render());
    this._hasPainted = true;
  }

  async _ensurePlatformData() {
    if (this._platformLoadAttempted) return;
    if (this._platformLoadPromise) return this._platformLoadPromise;
    if ((this.app.state.devTools || []).length || (this.app.state.devWorkflows || []).length) {
      this._platformLoadAttempted = true;
      return;
    }
    this._platformLoadPromise = (async () => {
      try {
        await this.app.loadPlatformData();
      } catch (_) {
        /* platform stubs may be unavailable in some dev setups */
      } finally {
        this._platformLoadAttempted = true;
        this._platformLoadPromise = null;
        if (this._mountRoot && this.app.currentView === this) {
          this._paint(this._mountRoot);
        }
      }
    })();
    try {
      await this._platformLoadPromise;
    } catch (_) {}
  }

  async _ensureScanData() {
    if (this._scanLoadAttempted || this.app.state.dataLoading || this.app.state.report) return;
    if (this._scanLoadPromise) return this._scanLoadPromise;
    this._scanLoadPromise = (async () => {
      try {
        await this.app.loadData();
      } catch (_) {
        /* auth or server errors surface via other views */
      } finally {
        this._scanLoadAttempted = true;
        this._scanLoadPromise = null;
        if (this._mountRoot && this.app.currentView === this) {
          this._paint(this._mountRoot);
        }
      }
    })();
    try {
      await this._scanLoadPromise;
    } catch (_) {}
  }

  mount(container) {
    this._mountRoot = container;
    this.reductionScan = this.app.state.mergerReductionScan || this.reductionScan;
    this._paint(container);
    this._ensureScanData();
    this._ensurePlatformData();
  }
}
