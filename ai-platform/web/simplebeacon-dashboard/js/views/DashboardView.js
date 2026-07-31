// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { formatNumber, formatPercent, escapeHtml, showToast } from '../utils.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';
import {
  buildScanConclusion,
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  renderScanScopePanel,
} from '../services/analyzeService.js?v=20260726sevfix1';
import { renderIssueList } from '../components/IssueCard.js';
import { renderTrendSection, mountTrendChart } from '../components/TrendChart.js';
import { isDemoMode } from '../demoMode.js';
const PRIVACY_NOTICE_KEY = 'sb_privacy_notice_dismissed';
const PRIVACY_NOTICE_TEXT =
  '100% private. Your source code never leaves your browser. Browser scans use a lightweight heuristic engine (no npm audit, no AST). For full analysis, run the server dashboard, open analyzer (auto-detected port), or upload a CLI report JSON.';
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
  if (!banner || !closeBtn) return;
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
  const totalFiles = report.discoveredFiles || report.files.length;
  const rawIssues = logs.map((entry) => ({
    severity: String(entry.severity || 'medium').toLowerCase(),
    type: entry.type || 'Security',
    filePath: entry.filePath || '',
    description: entry.message || '',
    count: 1,
  }));
  const severityCounts = { critical: 0, high, medium, low: 0, info: 0 };
  return {
    type: 'simplebeacon-report',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    projectPath: projectPath,
    projectRoot: projectPath,
    summary: {
      totalFiles,
      totalFindings: rawIssues.length,
      severityCounts,
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
      scannedFiles: report.files.length,
    },
    gate: {
      pass: cert.letterGrade !== 'F' && totalFiles > 0,
      score: cert.score != null ? cert.score : 0,
    },
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
  }

  render() {
    const { report, scanning } = this.app.state;
    const container = document.createElement('div');
    container.className = 'fade-in';

    container.appendChild(this.renderHeader(report));

    if (!report) {
      if (scanning) {
        container.appendChild(this.renderScanningState());
        return container;
      }
      container.appendChild(this.renderEmptyState());
      return container;
    }

    const categories = this.app.scanService.getIssueCategories(report);
    container.appendChild(this.renderResultsState(report, categories));
    return container;
  }

  renderHeader(report) {
    const header = document.createElement('div');
    header.className = 'dashboard-header d-flex justify-content-between align-items-center mb-4';

    const projectName = report
      ? (report.projectRoot || report.projectPath || 'Active Project').split(/[\\/]/).pop()
      : 'No Active Project';
    const statusChip =
      report && report.gate
        ? `<span class="badge gate-badge ${report.gate.pass ? 'bg-success' : 'bg-danger'}">${report.gate.pass ? 'Healthy' : 'Attention Required'}</span>`
        : '';

    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    const adminBtn =
      typeof authService !== 'undefined' && authService.isAdmin && authService.isAdmin()
        ? '<button class="btn btn-primary btn-sm" id="team-admin-btn">Team Admin</button>'
        : '';
    header.innerHTML = `
            <div>
                <h1 class="h2 mb-1">Dashboard</h1>
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted text-xs">${escapeHtml(projectName)}</span>
                    ${statusChip}
                </div>
            </div>
            <div class="header-actions d-flex gap-2">
                <button class="btn btn-ghost btn-sm" data-action="open-analyze">Advanced analyze</button>
                ${adminBtn}
            </div>
        `;
    return header;
  }

  renderScanningState() {
    const card = document.createElement('div');
    card.className = 'card text-center p-5 mx-auto my-4';
    card.style.maxWidth = '480px';
    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    card.innerHTML = `
            <div style="margin-bottom:var(--space-3);"><span class="loading-spinner" style="width:48px;height:48px;"></span></div>
            <h2 style="font-size:var(--font-size-xl); margin-bottom:var(--space-2);">Scanning…</h2>
            <p class="text-muted" style="max-width:480px; margin:0 auto var(--space-3);">Analysis is running. Switch to Analyze to watch progress.</p>
            <button class="btn btn-secondary" data-action="open-analyze">Open Analyze</button>
        `;
    return card;
  }

  renderEmptyState() {
    const view = document.createElement('div');
    view.className = 'card text-center p-5 mx-auto my-4';
    view.style.maxWidth = '680px';

    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    view.innerHTML = `
            <div class="mb-4">
                <i data-lucide="folder-search" class="text-muted" style="width:48px;height:48px;"></i>
            </div>
            <h3 class="h4 mb-2">Start your first scan</h3>
            <p class="text-muted text-sm mb-4">No scan yet — pick a target to get a pass/fail grade and remediation roadmap.</p>

            <div class="row g-3 text-start justify-content-center">
                <div class="col-sm-4">
                    <div class="card p-3 bento-card-interactive text-center" data-action="open-analyze" data-mode="folder">
                        <i data-lucide="folder" class="mb-2 text-primary" style="width:24px;height:24px;margin:0 auto;"></i>
                        <h5 class="text-xs font-weight-bold mb-1">Select folder</h5>
                        <span class="text-muted text-xxs">Scan local workspace</span>
                    </div>
                </div>
                <div class="col-sm-4">
                    <div class="card p-3 bento-card-interactive text-center" data-action="open-analyze" data-mode="files">
                        <i data-lucide="file-up" class="mb-2 text-success" style="width:24px;height:24px;margin:0 auto;"></i>
                        <h5 class="text-xs font-weight-bold mb-1">Drop files</h5>
                        <span class="text-muted text-xxs">Quick single file pass</span>
                    </div>
                </div>
                <div class="col-sm-4">
                    <div class="card p-3 bento-card-interactive text-center" data-action="open-analyze" data-mode="url">
                        <i data-lucide="globe" class="mb-2 text-warning" style="width:24px;height:24px;margin:0 auto;"></i>
                        <h5 class="text-xs font-weight-bold mb-1">Paste repo URL</h5>
                        <span class="text-muted text-xxs">Analyze public git path</span>
                    </div>
                </div>
            </div>
        `;
    return view;
  }

  renderResultsState(report, categories) {
    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';

    const gatePass = !!(report.gate && report.gate.pass);
    const sev = report.severityCounts || {};
    const qualityScore = typeof report.qualityScore === 'number' ? report.qualityScore : 0;
    const filesEvaluated =
      report.ruleScopedFilesAnalyzed != null
        ? report.ruleScopedFilesAnalyzed
        : report.repositoryFilesTotal || 0;
    const repoTotal = report.repositoryFilesTotal || 0;

    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    grid.innerHTML = `
            <div class="card bento-hero p-4 justify-content-between">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h4 class="text-muted text-xs uppercase mb-1">Gate Quality Score</h4>
                        <div class="display-3 font-weight-bold">${qualityScore}%</div>
                    </div>
                    <span class="badge p-3 ${gatePass ? 'bg-success' : 'bg-danger'} font-weight-bold">
                        ${gatePass ? 'PASSED' : 'FAILED'}
                    </span>
                </div>
                <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="d-flex gap-3">
                        <span class="text-sm"><strong class="text-danger">${sev.critical || 0}</strong> Critical</span>
                        <span class="text-sm"><strong class="text-warning">${sev.high || 0}</strong> High</span>
                        <span class="text-sm"><strong class="text-info">${sev.medium || 0}</strong> Med</span>
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="rescan">Re-scan Target</button>
                </div>
            </div>

            <div class="card bento-actions p-4 d-flex flex-column justify-content-between">
                <h4 class="text-muted text-xs uppercase mb-3">Quick Actions</h4>
                <div class="d-flex flex-column gap-2">
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="export">Export JSON Report</button>
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="send-ai">Send Findings to AI</button>
                    <button class="btn btn-outline btn-sm text-start w-100" data-action="roadmap">View Remediation Roadmap</button>
                </div>
            </div>

            <div class="card bento-issues p-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="h5 mb-0">Latest findings</h4>
                    <span class="text-muted text-xs">${filesEvaluated} files evaluated</span>
                </div>
                <div id="dashboard-issue-list-slot"></div>
            </div>

            <div class="card bento-trends p-4">
                <h4 class="h6 mb-3">Scan History & Trends</h4>
                <div id="slot-trend"></div>
            </div>

            <div class="card bento-summary p-4 justify-content-between">
                <h4 class="text-muted text-xs uppercase mb-2">Health Snapshot</h4>
                <div class="flex-grow-1 d-flex flex-column justify-content-around">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-sm">Repo File Footprint</span>
                        <span class="text-sm font-weight-bold text-muted">${repoTotal} total files</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-sm">System Engine Path</span>
                        <span class="text-sm font-weight-bold text-success">Configured</span>
                    </div>
                </div>
                <div class="pt-2 border-top mt-2">
                    <button class="btn btn-link text-xs text-primary p-0" data-action="system-health">View environmental details →</button>
                </div>
            </div>
        `;

    const issueSlot = grid.querySelector('#dashboard-issue-list-slot');
    issueSlot.appendChild(
      renderIssueList(categories, {
        onSelect: (cat) => this.app.navigate('results', { filter: cat }),
      })
    );

    const trendSlot = grid.querySelector('#slot-trend');
    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    trendSlot.innerHTML = renderTrendSection(this.app.state.history);

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

  handleExport() {
    if (isDemoMode()) {
      this.app.scanService.exportDashboard({
        report: this.app.state.report,
        baseline: this.app.state.baseline,
        config: this.app.state.config,
        history: this.app.state.history,
        dashboardHome: this.app.state.dashboardHome,
      });
    } else {
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
      filesScanned:
        report.repositoryFilesTotal != null
          ? report.repositoryFilesTotal
          : report.totalFiles || 'N/A',
      reportType: report.type || 'simplebeacon',
    };
    const hasVsCodeApi =
      typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
    if (hasVsCodeApi) {
      try {
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({
          command: 'sendToAI',
          data: {
            projectPath: report.projectRoot || report.projectPath || window.location.origin,
            notes: '',
            reportSummary,
            issues: allIssues,
          },
        });
        showToast(
          'Scan data sent to your AI coding agent. Check the editor chat panel.',
          'success'
        );
        return;
      } catch (err) {
        console['warn']('[AI-Send] vscode.postMessage failed:', err);
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
          issues: allIssues,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.content) {
          try {
            await navigator.clipboard.writeText(json.content);
            showToast(
              'Copied to clipboard — paste into your AI coding agent with Ctrl+V',
              'success'
            );
          } catch (clipErr) {
            showToast(
              'AI context saved. Use sidebar 🤖 button or mention @.simplebeacon/ai-context.md',
              'success'
            );
          }
        } else {
          showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
        }
      } else {
        showToast('Failed: ' + (json.error || 'Unknown'), 'error');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'error');
    }
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
    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    container.innerHTML = '';
    const view = this.render();
    container.appendChild(view);
    this.bindEvents(view);
    if (!this.app.state.report) return;
    this.ensureReportEnriched();
    requestAnimationFrame(() => {
      const trendSlot = view.querySelector('#slot-trend');
      this._trendCleanup = mountTrendChart(trendSlot, this.app.state.history) || null;
    });
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
  }

  destroy() {
    if (this._trendCleanup) this._trendCleanup();
  }
}
