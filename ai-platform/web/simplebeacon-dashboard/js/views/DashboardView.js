import { formatNumber, formatPercent } from '../utils.js';
import {
  buildScanConclusion,
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  renderScanScopePanel
} from '../services/analyzeService.js';
import { renderScanStatus, bindScanStatus, runDashboardScanFromInput } from '../components/ScanStatus.js';
import { renderIssueList } from '../components/IssueCard.js';
import { renderQuickActions, bindQuickActions } from '../components/QuickActions.js';
import { renderTrendSection, mountTrendChart } from '../components/TrendChart.js';
import { fetchRepositoryHealth, renderRepositoryHealthSection } from './RepositoryHealthView.js';

export function renderInsights(report, baseline, dashboardHome) {
  const sev = report?.severityCounts || {};
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
          <div class="insight-stat-value">${resolveJestTestsLabel(baseline, dashboardHome) ?? '—'}</div>
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

function renderScanMetrics(report) {
  const metrics = getScanFileMetrics(report);
  return `
    <div class="metrics-row">
      ${metrics.repositoryFiles != null ? `<div class="metric-chip" title="Explorer-style inventory of project root"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
      <div class="metric-chip"><strong>${formatNumber(metrics.ruleScopedFilesAnalyzed ?? metrics.credentialScanned ?? metrics.mockSampleFiles)}</strong> gate rules checked</div>
      <div class="metric-chip"><strong>${formatNumber(metrics.mockSampleFiles ?? report?.totalFiles)}</strong> mock/sample</div>
      <div class="metric-chip"><strong>${formatPercent(report?.schemaCompliance)}</strong> schema compliance</div>
      <div class="metric-chip"><strong>${resolvePageSpecsLabel(report) ?? '—'}</strong> page specs</div>
      <div class="metric-chip"><strong>${formatPercent(report?.consistencyScore)}</strong> consistency</div>
      <div class="metric-chip"><strong>${report?.credentialFindings ?? 0}</strong> credential hits</div>
      <div class="metric-chip"><strong>${report?.productionLeakFindings ?? 0}</strong> prod leaks</div>
    </div>
  `;
}

export class DashboardView {
  constructor(app) {
    this.app = app;
    this._trendCleanup = null;
  }

  render() {
    const { report, baseline, history, scanning, dataLoading } = this.app.state;
    const categories = this.app.scanService.getIssueCategories(report);

    const el = document.createElement('div');
    el.className = 'fade-in';

    if (dataLoading && !report) {
      el.innerHTML = `
        <h1 class="page-title">Dashboard</h1>
        <div class="empty-state card">
          <div class="loading-spinner" style="width: 32px; height: 32px; margin: 0 auto var(--space-4);"></div>
          <p>Loading scan data…</p>
          <p class="text-muted mt-2">If this takes more than a few seconds, restart with <code>npm run dashboard</code></p>
        </div>
      `;
      return el;
    }

    if (!report) {
      el.innerHTML = `
        <h1 class="page-title">Dashboard</h1>
        <div class="empty-state card">
          <div class="empty-state-icon">⚠️</div>
          <p>No scan report loaded.</p>
          <p class="text-muted mb-4">Set your repo folder on <a href="#/analyze">Analyze → Project path</a>, then run a scan. Gate mock folders live in <a href="#/settings">Settings → Scan paths</a>.</p>
          <div class="flex gap-2" style="justify-content: center;">
            <button class="btn btn-primary" id="dash-run-scan">Run Scan</button>
            <button class="btn btn-secondary" id="dash-goto-analyze">Open Analyze</button>
          </div>
        </div>
      `;
      return el;
    }

    const conclusion = buildScanConclusion(report);

    el.innerHTML = `
      <h1 class="page-title">Dashboard</h1>
      <div class="grid-3">
        <div id="slot-scan-status"></div>
        <div id="slot-quick-actions"></div>
        <div id="slot-insights">${renderInsights(report, baseline, this.app.state.dashboardHome)}</div>
      </div>
      <div class="card mb-4" style="padding: var(--space-4);">
        <p class="text-muted mb-1" style="margin-top: 0; font-size: var(--font-size-xs);">Scan summary</p>
        <p style="margin: 0;">${conclusion}</p>
      </div>
      ${renderScanScopePanel(report)}
      <div class="section-block" id="slot-repo-health">
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="#/repository-health">Details →</a>
        </div>
        <p class="text-muted"><span class="loading-spinner"></span> Loading optimization metrics…</p>
      </div>
      <div class="section-block">
        <div class="section-heading">
          <h2>Scan Metrics</h2>
          <button class="btn btn-ghost btn-sm" id="dash-open-analyze">Deep analyze →</button>
        </div>
        ${renderScanMetrics(report)}
      </div>
      <div class="section-block">
        <div class="section-heading">
          <h2>Scan Results</h2>
          <button class="btn btn-secondary" id="view-all-results">View all →</button>
        </div>
        <div id="slot-issue-list"></div>
      </div>
      <div class="section-block" id="slot-trend"></div>
    `;

    const scanSlot = el.querySelector('#slot-scan-status');
    scanSlot.innerHTML = renderScanStatus(report, {
      scanning,
      config: this.app.state.config,
      lastProjectPath: this.app.state.lastProjectPath,
      defaultProjectPath: this.app.state.defaultProjectPath
    });
    const scanHandlers = {
      defaultProjectPath: this.app.state.defaultProjectPath,
      getLastProjectPath: () => this.app.state.lastProjectPath,
      setLastProjectPath: (path) => { this.app.state.lastProjectPath = path; },
      onRescan: (path) => this.app.runScan(path)
    };
    bindScanStatus(scanSlot, scanHandlers);

    const actionsSlot = el.querySelector('#slot-quick-actions');
    actionsSlot.innerHTML = renderQuickActions({});
    bindQuickActions(actionsSlot, {
      onRunScan: () => runDashboardScanFromInput(
        scanSlot.querySelector('#scan-root-input'),
        scanHandlers
      ),
      onExport: () => this.app.scanService.exportReport(),
      onLegacy: () => { this.app.navigate('platform'); }
    });

    const issueSlot = el.querySelector('#slot-issue-list');
    issueSlot.appendChild(renderIssueList(categories, {
      onSelect: (cat) => this.app.navigate('results', { filter: cat })
    }));

    el.querySelector('#view-all-results')?.addEventListener('click', () => {
      this.app.navigate('results');
    });
    el.querySelector('#dash-open-analyze')?.addEventListener('click', () => {
      this.app.navigate('analyze');
    });

    const trendSlot = el.querySelector('#slot-trend');
    trendSlot.innerHTML = renderTrendSection(history);

    return el;
  }

  async ensureReportEnriched() {
    const report = this.app.state.report;
    if (!report) return;
    const enriched = await this.app.scanService.enrichReport(report);
    if (enriched !== report) {
      this.app.state.report = enriched;
      this.app.scanService.report = enriched;
      this.app.refreshCurrentView();
    }
  }

  mount(container) {
    if (this._trendCleanup) this._trendCleanup();
    container.innerHTML = '';
    const view = this.render();
    container.appendChild(view);

    view.querySelector('#dash-run-scan')?.addEventListener('click', () => this.app.runScan());
    view.querySelector('#dash-goto-analyze')?.addEventListener('click', () => this.app.navigate('analyze'));

    if (!this.app.state.report) return;

    this.ensureReportEnriched();
    this.loadRepositoryHealth(view);

    requestAnimationFrame(() => {
      const trendSlot = view.querySelector('#slot-trend');
      this._trendCleanup = mountTrendChart(trendSlot, this.app.state.history) || null;
    });
  }

  async loadRepositoryHealth(view) {
    const slot = view.querySelector('#slot-repo-health');
    if (!slot) return;
    try {
      const health = await fetchRepositoryHealth();
      slot.innerHTML = `
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="#/repository-health">Details →</a>
        </div>
        ${health?.headline
          ? renderRepositoryHealthSection(health, { compact: true })
          : '<p class="text-muted">No consolidation scan yet — run Analyze → Consolidation.</p>'}
      `;
    } catch {
      slot.innerHTML = `
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="#/repository-health">Details →</a>
        </div>
        <p class="text-muted">Repository health unavailable — run consolidation scan from Analyze.</p>
      `;
    }
  }

  destroy() {
    if (this._trendCleanup) this._trendCleanup();
  }
}
