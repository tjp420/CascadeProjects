import { formatNumber, formatPercent, escapeHtml, renderEmptyState, showToast, apiUrl } from '../utils.js';
import {
  buildScanConclusion,
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  renderScanScopePanel
} from '../services/analyzeService.js';
import { renderScanStatus, updateScanStatusDom, bindScanStatus, runDashboardScanFromInput } from '../components/ScanStatus.js?v=20260613dropfix2';
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

/**
 * Render re attestation preview.
 * @param {any} meta
 * @returns {any}
 */
function renderReAttestationPreview(meta) {
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
        <div class="metric-chip"><strong>${formatNumber(gate.blockingCount ?? 0)}</strong> blocking</div>
        <div class="metric-chip"><strong>${gate.qualityScore ?? '—'}%</strong> quality</div>
        <div class="metric-chip"><strong>${formatNumber(gate.ruleScopedFilesAnalyzed ?? hygiene.ruleScopedFilesAnalyzed ?? 0)}</strong> checked</div>
        <div class="metric-chip"><strong>${formatNumber(gate.repositoryFilesTotal ?? hygiene.repositoryFilesTotal ?? 0)}</strong> repo files</div>
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
  const metrics = getScanFileMetrics(report);
  let result = '';
  if (metrics.repositoryFiles != null) {
    result += '<div class="metric-chip" title="Repository inventory (skips node_modules, .git, build artifacts)"><strong>' + formatNumber(metrics.repositoryFiles) + '</strong> repo files</div>';
  }
  result += '<div class="metric-chip"><strong>' + formatNumber(metrics.filesAnalyzed ?? 0) + '</strong> files analyzed</div>';
  result += '<div class="metric-chip"><strong>' + formatNumber(metrics.mockSampleFiles ?? 0) + '</strong> mock/sample</div>';
  result += '<div class="metric-chip"><strong>' + formatNumber(report?.fictionKpiHits ?? 0) + '</strong> fiction scanned</div>';
  result += '<div class="metric-chip"><strong>' + formatPercent(report?.schemaCompliance) + '</strong> schema compliance</div>';
  result += '<div class="metric-chip"><strong>' + (resolvePageSpecsLabel(report) ?? '—') + '</strong> page specs</div>';
  result += '<div class="metric-chip"><strong>' + formatPercent(report?.consistencyScore) + '</strong> consistency</div>';
  result += '<div class="metric-chip"><strong>' + (report?.credentialFindings ?? 0) + '</strong> credential hits</div>';
  result += '<div class="metric-chip"><strong>' + (report?.productionLeakFindings ?? 0) + '</strong> prod leaks</div>';
  return result;
}

/**
 * Dashboard view.
 */
export class DashboardView {
  constructor(app) {
    this.app = app;
    this._trendCleanup = null;
    this.activeSeverityFilter = null;
    this._allCategories = [];

    // Phase 3: Listen for extension host rehydrating cached session token into the webview
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message) return;
      switch (message.command) {
        case 'rehydrateCachedSession': {
          if (message.token) {
            const currentLocalToken = localStorage.getItem('sb_license_token');
            // Only rewrite if state is stale or missing to minimize re-render bouncing
            if (currentLocalToken !== message.token) {
              localStorage.setItem('sb_license_token', message.token);
              // Dynamically elevate tiers from Sandbox to Pro/Enterprise and reload views
              if (window.app && typeof window.app.refreshState === 'function') {
                window.app.refreshState();
              }
            }
          }
          break;
        }
      }
    });
  }

  render() {
    const { report, baseline, history, scanning, dataLoading } = this.app.state;
    const categories = this.app.scanService.getIssueCategories(report);
    this._allCategories = categories;

    const el = document.createElement('div');
    el.className = 'fade-in dashboard-modern';

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
            icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
            title: 'Welcome to SimpleBeacon',
            body: 'Your AI-powered code quality & compliance dashboard. Set your project path and run your first scan to see insights, gate status, and actionable fixes.',
            actions: [
              { label: 'Run First Scan', id: 'dash-run-scan', className: 'btn-primary' },
              { label: 'Configure Project', id: 'dash-goto-analyze', className: 'btn-secondary' }
            ]
          });
      el.innerHTML = `<div class="db-empty-v4"><h1>Dashboard</h1>${emptyState}</div>`;
      return el;
    }

    const conclusion = buildScanConclusion(report);
    const sev = report?.severityCounts || {};
    const totalIssues = (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
    const healthClass = totalIssues === 0 ? 'success' : totalIssues <= 5 ? 'warning' : 'danger';
    const healthLabel = totalIssues === 0 ? 'Healthy' : totalIssues <= 5 ? 'Review' : 'Attention';
    const gate = report?.gate || {};
    const gateClass = gate.pass ? 'success' : gate.blockingCount > 0 ? 'danger' : 'warning';
    const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
    const qualityScore = resolveDisplayScore(report);

    const sevTotal = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
    el.innerHTML = `
      <style>
        @keyframes db-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes db-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow:0 0 0 10px rgba(99,102,241,0); } }
        @keyframes db-slide-in { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        .db-v3 { --db-card-bg:rgba(30,41,59,0.55); --db-card-border:rgba(148,163,184,0.08); --db-glow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .db-v3 { --db-card-bg:rgba(255,255,255,0.7); --db-card-border:rgba(148,163,184,0.15); --db-glow:0 8px 32px rgba(0,0,0,0.08); }
        .db-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:28px; animation:db-fade-up .5s ease both; }
        .db-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .db-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .db-v3-project-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:999px; background:var(--surface); border:1px solid var(--border); font-size:0.78rem; color:var(--text-secondary); margin-top:8px; }
        .db-v3-live { width:8px; height:8px; border-radius:50%; background:#22c55e; animation:db-pulse 2s infinite; }
        .db-v3-kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
        @media (max-width:900px) { .db-v3-kpi-row { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:480px) { .db-v3-kpi-row { grid-template-columns:1fr; } }
        .db-v3-kpi { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid var(--db-card-border); border-radius:20px; padding:22px; position:relative; overflow:hidden; backdrop-filter:blur(12px); transition:transform .3s ease, box-shadow .3s ease; animation:db-fade-up .5s ease both; cursor:pointer; }
        [data-theme='light'] .db-v3-kpi { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); }
        .db-v3-kpi:nth-child(1) { animation-delay:.05s; } .db-v3-kpi:nth-child(2) { animation-delay:.1s; } .db-v3-kpi:nth-child(3) { animation-delay:.15s; } .db-v3-kpi:nth-child(4) { animation-delay:.2s; }
        .db-v3-kpi:hover { transform:translateY(-6px); box-shadow:var(--db-glow); }
        .db-v3-kpi::after { content:''; position:absolute; top:0; left:0; right:0; height:4px; border-radius:20px 20px 0 0; opacity:.9; }
        .db-v3-kpi.kpi-gate::after { background:linear-gradient(90deg,#22c55e,#4ade80); }
        .db-v3-kpi.kpi-gate.fail::after { background:linear-gradient(90deg,#ef4444,#f87171); }
        .db-v3-kpi.kpi-gate.warn::after { background:linear-gradient(90deg,#f59e0b,#fbbf24); }
        .db-v3-kpi.kpi-health::after { background:linear-gradient(90deg,#f59e0b,#fbbf24); }
        .db-v3-kpi.kpi-health.success::after { background:linear-gradient(90deg,#22c55e,#4ade80); }
        .db-v3-kpi.kpi-health.danger::after { background:linear-gradient(90deg,#ef4444,#f87171); }
        .db-v3-kpi.kpi-quality::after { background:linear-gradient(90deg,#6366f1,#a78bfa); }
        .db-v3-kpi.kpi-tests::after { background:linear-gradient(90deg,#06b6d4,#67e8f9); }
        .db-v3-kpi-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .db-v3-kpi-label { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .db-v3-kpi-icon { width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(99,102,241,0.12); color:#818cf8; font-size:20px; }
        .db-v3-kpi-icon.success { background:rgba(34,197,94,0.15); color:#4ade80; }
        .db-v3-kpi-icon.danger { background:rgba(239,68,68,0.15); color:#f87171; }
        .db-v3-kpi-icon.warning { background:rgba(245,158,11,0.15); color:#fbbf24; }
        .db-v3-kpi-icon.info { background:rgba(99,102,241,0.15); color:#a78bfa; }
        .db-v3-kpi-value { font-size:2rem; font-weight:800; margin-bottom:8px; letter-spacing:-0.02em; }
        .db-v3-kpi-value.success { color:#4ade80; } .db-v3-kpi-value.danger { color:#f87171; } .db-v3-kpi-value.warning { color:#fbbf24; }
        .db-v3-kpi-meta { font-size:0.78rem; color:var(--text-muted); font-weight:500; }
        .db-v3-sev-bar { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid var(--db-card-border); border-radius:20px; padding:24px 28px; margin-bottom:24px; backdrop-filter:blur(12px); animation:db-fade-up .5s ease .25s both; }
        [data-theme='light'] .db-v3-sev-bar { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); }
        .db-v3-sev-title { display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px; }
        .db-v3-sev-count { font-size:0.9rem; font-weight:600; color:var(--text-secondary); text-transform:none; letter-spacing:0; }
        .db-v3-sev-track { display:flex; height:16px; border-radius:8px; overflow:hidden; background:rgba(148,163,184,0.08); position:relative; }
        .db-v3-sev-fill { transition:width .8s cubic-bezier(.4,0,.2,1); position:relative; }
        .db-v3-sev-fill.critical { background:linear-gradient(90deg,#dc2626,#ef4444); }
        .db-v3-sev-fill.high { background:linear-gradient(90deg,#ea580c,#f97316); }
        .db-v3-sev-fill.medium { background:linear-gradient(90deg,#ca8a04,#eab308); }
        .db-v3-sev-fill.low { background:linear-gradient(90deg,#2563eb,#3b82f6); }
        .db-v3-sev-fill.clean { background:linear-gradient(90deg,#16a34a,#22c55e); width:100% !important; }
        .db-v3-sev-fill::after { content:attr(data-pct); position:absolute; right:4px; top:50%; transform:translateY(-50%); font-size:9px; font-weight:700; color:rgba(255,255,255,0.95); text-shadow:0 1px 2px rgba(0,0,0,.5); opacity:0; transition:opacity .3s; }
        .db-v3-sev-track:hover .db-v3-sev-fill::after { opacity:1; }
        .db-v3-sev-legend { display:flex; gap:20px; margin-top:14px; flex-wrap:wrap; }
        .db-v3-sev-item { display:flex; align-items:center; gap:6px; font-size:0.84rem; font-weight:500; color:var(--text-secondary); }
        .db-v3-sev-dot { width:10px; height:10px; border-radius:50%; box-shadow:0 0 6px currentColor; }
        .db-v3-hero { display:grid; grid-template-columns:1fr auto; gap:16px; margin-bottom:24px; animation:db-fade-up .5s ease .35s both; }
        @media (max-width:768px) { .db-v3-hero { grid-template-columns:1fr; } }
        .db-v3-grid { display:grid; grid-template-columns:1fr 320px; gap:16px; margin-bottom:16px; animation:db-fade-up .5s ease .45s both; }
        @media (max-width:900px) { .db-v3-grid { grid-template-columns:1fr; } }
        .db-v3-main { display:flex; flex-direction:column; gap:16px; }
        .db-v3-side { display:flex; flex-direction:column; gap:16px; }
        .db-v3-panel { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid var(--db-card-border); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; }
        [data-theme='light'] .db-v3-panel { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); }
        .db-v3-panel:hover { box-shadow:var(--db-glow); }
        .db-v3-panel-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid var(--db-card-border); }
        .db-v3-panel-hd h2, .db-v3-panel-hd h3 { font-size:1rem; font-weight:700; margin:0; display:flex; align-items:center; gap:8px; }
        .db-v3-panel-hd h2 i, .db-v3-panel-hd h3 i { color:var(--accent); }
        .db-v3-panel-bd { padding:18px 22px; }
        .db-v3-panel-badge { font-size:0.72rem; font-weight:700; padding:4px 12px; border-radius:999px; background:rgba(99,102,241,0.15); color:#a78bfa; }
        .db-v3-summary-text { font-size:0.88rem; line-height:1.7; color:var(--text-secondary); margin:0; }
        .db-v3-metrics { display:flex; flex-wrap:wrap; gap:8px; }
        .db-v3-metrics .metric-chip { background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.08); border-radius:10px; padding:8px 12px; font-size:0.82rem; color:var(--text-secondary); }
        .db-v3-metrics .metric-chip strong { color:var(--text-primary); font-weight:600; }
        .db-v3-bottom { display:grid; grid-template-columns:1fr 1fr; gap:16px; animation:db-fade-up .5s ease .55s both; }
        @media (max-width:768px) { .db-v3-bottom { grid-template-columns:1fr; } }
        .db-v3-bottom .db-v3-panel-bd { min-height:120px; }
        .db-empty-v4 { animation:db-fade-up .6s ease both; }
        /* Void-space fix: ensure panels never collapse to zero when content is empty */
        .db-v3-main { min-height:200px; }
        .db-v3-panel-bd { min-height:120px; }
        #slot-issue-list:empty::before {
          content: 'No issues found for the current filter.';
          display:block;
          padding:40px 0;
          text-align:center;
          color:var(--text-muted);
          font-size:0.85rem;
        }
        #slot-trend:empty::before {
          content: 'Trend chart unavailable.';
          display:block;
          padding:40px 0;
          text-align:center;
          color:var(--text-muted);
          font-size:0.85rem;
        }
        .db-empty-v4 h1 { font-size:1.8rem; font-weight:700; margin-bottom:24px; color:var(--text-primary); }

        /* Severity bar interactivity */
        .db-v3-sev-track { cursor: pointer; }
        .db-v3-sev-fill[data-severity] { cursor: pointer; transition: transform .2s ease, opacity .2s ease, box-shadow .2s ease; }
        .db-v3-sev-fill[data-severity]:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.25); }
        .db-v3-sev-fill[data-severity].is-active { transform: scaleY(1.15); z-index: 2; outline: 2px solid rgba(255,255,255,0.5); outline-offset: 2px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
        .db-v3-sev-fill[data-severity].is-inactive { opacity: .35; }
        .db-v3-sev-legend .db-v3-sev-item { cursor: pointer; transition: opacity .2s ease; }
        .db-v3-sev-legend .db-v3-sev-item:hover { opacity: .7; }

        /* Filter pill */
        #dashboard-filter-status { min-height: 0; }
        .clear-filter-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: 0.85rem; margin-bottom: 12px; background: var(--surface-elevated); border: 1px solid var(--border); color: var(--text-secondary); animation: db-fade-up .2s ease both; }
        .clear-filter-pill strong { color: var(--text-primary); }
        .pill-close-btn { background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; padding: 0; line-height: 1; opacity: .7; }
        .pill-close-btn:hover { opacity: 1; }
        .issue-list.is-filtered .issue-card { transition: opacity .2s ease; }
      </style>

      <div class="db-v3-header">
        <div>
          <h1>Dashboard</h1>
          <p>${escapeHtml(report.projectRoot || report.projectPath || 'Project overview')}</p>
          <div class="db-v3-project-badge">
            <span class="db-v3-live"></span>
            <span>Live scan &middot; ${formatNumber(report.totalFiles || 0)} files analyzed</span>
          </div>
        </div>
        <div class="dashboard-header-actions">
          <button class="btn btn-ghost btn-sm" id="dash-open-settings">
            <i data-lucide="settings-2" class="icon-16"></i> Settings
          </button>
          <button class="btn btn-primary btn-sm" id="view-all-results">
            <i data-lucide="arrow-right" class="icon-16"></i> View all results
          </button>
        </div>
      </div>

      <div class="db-v3-kpi-row">
        <div class="db-v3-kpi kpi-gate ${gateClass}">
          <div class="db-v3-kpi-head">
            <span class="db-v3-kpi-label">Gate Status</span>
            <div class="db-v3-kpi-icon ${gateClass}"><i data-lucide="shield-check" class="icon-16"></i></div>
          </div>
          <div class="db-v3-kpi-value ${gateClass}">${gateLabel}</div>
          <div class="db-v3-kpi-meta">${gate.blockingCount ?? 0} blocking issues</div>
        </div>
        <div class="db-v3-kpi kpi-health ${healthClass}">
          <div class="db-v3-kpi-head">
            <span class="db-v3-kpi-label">Health</span>
            <div class="db-v3-kpi-icon ${healthClass}"><i data-lucide="heart-pulse" class="icon-16"></i></div>
          </div>
          <div class="db-v3-kpi-value ${healthClass}">${healthLabel}</div>
          <div class="db-v3-kpi-meta">${totalIssues} open issues</div>
        </div>
        <div class="db-v3-kpi kpi-quality">
          <div class="db-v3-kpi-head">
            <span class="db-v3-kpi-label">Quality Score</span>
            <div class="db-v3-kpi-icon info"><i data-lucide="gauge" class="icon-16"></i></div>
          </div>
          <div class="db-v3-kpi-value">${formatPercent(qualityScore)}</div>
          <div class="db-v3-kpi-meta">Consistency rating</div>
        </div>
        <div class="db-v3-kpi kpi-tests">
          <div class="db-v3-kpi-head">
            <span class="db-v3-kpi-label">Tests</span>
            <div class="db-v3-kpi-icon"><i data-lucide="flask-conical" class="icon-16"></i></div>
          </div>
          <div class="db-v3-kpi-value">${resolveJestTestsLabel(baseline, this.app.state.dashboardHome) ?? '—'}</div>
          <div class="db-v3-kpi-meta">Jest coverage</div>
        </div>
      </div>

      <div class="db-v3-sev-bar">
        <div class="db-v3-sev-title">
          <span>Severity Breakdown</span>
          <span class="db-v3-sev-count">${sevTotal} total issues</span>
        </div>
        <div class="db-v3-sev-track">
          ${sevTotal > 0 ? `
            <div class="db-v3-sev-fill critical" data-severity="critical" style="width:${((sev.critical || 0) / sevTotal * 100).toFixed(1)}%" data-pct="${((sev.critical || 0) / sevTotal * 100).toFixed(0)}%"></div>
            <div class="db-v3-sev-fill high" data-severity="high" style="width:${((sev.high || 0) / sevTotal * 100).toFixed(1)}%" data-pct="${((sev.high || 0) / sevTotal * 100).toFixed(0)}%"></div>
            <div class="db-v3-sev-fill medium" data-severity="medium" style="width:${((sev.medium || 0) / sevTotal * 100).toFixed(1)}%" data-pct="${((sev.medium || 0) / sevTotal * 100).toFixed(0)}%"></div>
            <div class="db-v3-sev-fill low" data-severity="low" style="width:${((sev.low || 0) / sevTotal * 100).toFixed(1)}%" data-pct="${((sev.low || 0) / sevTotal * 100).toFixed(0)}%"></div>
          ` : '<div class="db-v3-sev-fill clean"></div>'}
        </div>
        <div class="db-v3-sev-legend">
          <div class="db-v3-sev-item"><div class="db-v3-sev-dot" style="background:#ef4444; color:#ef4444;"></div> Critical ${sev.critical || 0}</div>
          <div class="db-v3-sev-item"><div class="db-v3-sev-dot" style="background:#f97316; color:#f97316;"></div> High ${sev.high || 0}</div>
          <div class="db-v3-sev-item"><div class="db-v3-sev-dot" style="background:#eab308; color:#eab308;"></div> Medium ${sev.medium || 0}</div>
          <div class="db-v3-sev-item"><div class="db-v3-sev-dot" style="background:#3b82f6; color:#3b82f6;"></div> Low ${sev.low || 0}</div>
        </div>
      </div>

      <div class="dashboard-hero-modern">
        <div id="slot-scan-status" class="scan-status-modern"></div>
        <div id="slot-quick-actions" class="quick-actions-modern"></div>
      </div>

      <div class="db-v3-grid">
        <div class="db-v3-main">
          <div id="dashboard-filter-status"></div>
          <div class="db-v3-panel">
            <div class="db-v3-panel-hd">
              <h2><i data-lucide="list" class="icon-18"></i> Scan Results</h2>
              <span class="db-v3-panel-badge" id="dashboard-issue-count">${totalIssues} issues</span>
            </div>
            <div class="db-v3-panel-bd" id="slot-issue-list"></div>
          </div>
          <div class="db-v3-panel panel-trend" id="slot-trend"></div>
        </div>
        <div class="db-v3-side">
          <div class="db-v3-panel">
            <div class="db-v3-panel-hd">
              <h3><i data-lucide="file-text" class="icon-18"></i> Scan Summary</h3>
            </div>
            <div class="db-v3-panel-bd">
              <p class="db-v3-summary-text">${conclusion}</p>
            </div>
          </div>
          ${renderScanScopePanel(report)}
          <div class="db-v3-panel">
            <div class="db-v3-panel-hd">
              <h3><i data-lucide="bar-chart-3" class="icon-18"></i> Scan Metrics</h3>
              <button class="btn btn-ghost btn-xs" id="dash-open-analyze">Analyze →</button>
            </div>
            <div class="db-v3-panel-bd db-v3-metrics">
              ${renderScanMetrics(report)}
            </div>
          </div>
          ${this.app.state.reAttestation ? renderReAttestationPreview(this.app.state.reAttestation) : ''}
        </div>
      </div>

      <div class="db-v3-bottom">
        <div class="db-v3-panel" id="slot-repo-health">
          <div class="db-v3-panel-hd">
            <h3><i data-lucide="git-branch" class="icon-18"></i> Repository Health</h3>
            <a class="btn btn-ghost btn-xs" href="/dashboard/repository-health">Details →</a>
          </div>
          <div class="db-v3-panel-bd">
            <p class="text-muted"><span class="loading-spinner"></span> Loading optimization metrics…</p>
          </div>
        </div>
        <div class="db-v3-panel" id="slot-path-health">
          <div class="db-v3-panel-hd">
            <h3><i data-lucide="activity" class="icon-18"></i> System Path Health</h3>
          </div>
          <div class="db-v3-panel-bd">
            <p class="text-muted"><span class="loading-spinner"></span> Loading path health metrics…</p>
          </div>
        </div>
      </div>
    `;

    const scanSlot = el.querySelector('#slot-scan-status');
    const scanHandlers = {
      getLastProjectPath: () => this.app.state.lastProjectPath,
      setLastProjectPath: (path) => { this.app.state.lastProjectPath = path; },
      getDefaultProjectPath: () => this.app.state.defaultProjectPath,
      onRescan: (path) => this.app.runScan(path)
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
      onRunScan: () => runDashboardScanFromInput(
        scanSlot.querySelector('#scan-root-input'),
        scanHandlers
      ),
      onExport: () => {
        if (isDemoMode()) {
          this.app.scanService.exportDashboard({
            report: this.app.state.report,
            baseline: this.app.state.baseline,
            config: this.app.state.config,
            history: this.app.state.history,
            dashboardHome: this.app.state.dashboardHome
          });
        } else {
          this.app.scanService.exportReport(this.app.state.report);
        }
      },
      onSendAi: async () => {
        const report = this.app.state.report;
        if (!report) { showToast('No report loaded — run a scan first', 'error'); return; }
        const allIssues = report.rawIssues || report.detectedIssues || [];
        const reportSummary = {
          gatePass: report.gate?.pass ?? 'N/A',
          qualityScore: report.qualityScore ?? 'N/A',
          totalIssues: allIssues.length,
          filesScanned: report.repositoryFilesTotal ?? report.totalFiles ?? 'N/A',
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
          } catch (err) {
            console.warn('[AI-Send] vscode.postMessage failed:', err);
          }
        }

        try {
          const res = await fetch(apiUrl('/api/ai-context'), {
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
              } catch (clipErr) {
                showToast('AI context saved. Use sidebar 🤖 button or mention @.simplebeacon/ai-context.md', 'success');
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
      },
      onLegacy: () => { this.app.navigate('platform'); }
    });

    this._issueSlot = el.querySelector('#slot-issue-list');
    this._issueCountBadge = el.querySelector('#dashboard-issue-count');
    this._filterStatusSlot = el.querySelector('#dashboard-filter-status');
    this._renderIssueListSlot(categories);
    this._bindSeverityBarEvents(el);

    el.querySelector('#view-all-results')?.addEventListener('click', () => {
      this.app.navigate('results');
    });
    el.querySelector('#dash-open-settings')?.addEventListener('click', () => {
      this.app.navigate('settings');
    });
    el.querySelector('#dash-open-analyze')?.addEventListener('click', () => {
      this.app.navigate('analyze');
    });

    const trendSlot = el.querySelector('#slot-trend');
    trendSlot.innerHTML = renderTrendSection(history);

    return el;
  }

  _bindSeverityBarEvents(el) {
    const severityBar = el.querySelector('.db-v3-sev-bar');
    if (!severityBar) return;

    severityBar.addEventListener('click', (e) => {
      const segment = e.target.closest('[data-severity]');
      if (!segment) return;
      const selectedSeverity = segment.getAttribute('data-severity');
      if (this.activeSeverityFilter === selectedSeverity) {
        this.clearSeverityFilter();
      } else {
        this.applySeverityFilter(selectedSeverity);
      }
    });

    this._filterStatusSlot?.addEventListener('click', (e) => {
      if (e.target.closest('.clear-filter-pill') || e.target.closest('.pill-close-btn')) {
        this.clearSeverityFilter();
      }
    });
  }

  applySeverityFilter(severity) {
    this.activeSeverityFilter = severity;
    this._updateSeverityBarVisuals();
    this._renderFilterPill();
    this._renderIssueListSlot(this._allCategories);
  }

  clearSeverityFilter() {
    this.activeSeverityFilter = null;
    this._updateSeverityBarVisuals();
    if (this._filterStatusSlot) this._filterStatusSlot.innerHTML = '';
    this._renderIssueListSlot(this._allCategories);
  }

  _updateSeverityBarVisuals() {
    const segments = document.querySelectorAll('.db-v3-sev-bar [data-severity]');
    segments.forEach((seg) => {
      const sev = seg.getAttribute('data-severity');
      seg.classList.toggle('is-active', sev === this.activeSeverityFilter);
      seg.classList.toggle('is-inactive', this.activeSeverityFilter && sev !== this.activeSeverityFilter);
    });
  }

  _renderFilterPill() {
    if (!this._filterStatusSlot) return;
    const label = this.activeSeverityFilter
      ? this.activeSeverityFilter.charAt(0).toUpperCase() + this.activeSeverityFilter.slice(1)
      : '';
    this._filterStatusSlot.innerHTML = `
      <div class="clear-filter-pill">
        <span>Showing only: <strong>${escapeHtml(label)}</strong></span>
        <button type="button" class="pill-close-btn" aria-label="Clear filter">&times;</button>
      </div>
    `;
  }

  _renderIssueListSlot(categories) {
    const filtered = this.activeSeverityFilter
      ? categories.filter((cat) => String(cat.severity).toLowerCase() === this.activeSeverityFilter)
      : categories;

    if (this._issueSlot) {
      this._issueSlot.innerHTML = '';
      if (!filtered || filtered.length === 0) {
        this._issueSlot.innerHTML = `
          <div class="empty-state" style="padding:32px 16px; color:var(--text-muted); font-size:0.9rem; text-align:center;">
            <p>No issues match the current filter.</p>
            <button type="button" class="btn btn-ghost btn-sm" id="dash-clear-filter-btn">Clear filter</button>
          </div>
        `;
        this._issueSlot.querySelector('#dash-clear-filter-btn')?.addEventListener('click', () => this.clearSeverityFilter());
      } else {
        this._issueSlot.appendChild(renderIssueList(filtered, {
          onSelect: (cat) => this.app.navigate('results', { filter: cat })
        }));
      }
      this._issueSlot.classList.toggle('is-filtered', !!this.activeSeverityFilter);
    }

    if (this._issueCountBadge) {
      const count = filtered.reduce((sum, cat) => sum + (cat.count || 0), 0);
      this._issueCountBadge.textContent = `${count} issue${count === 1 ? '' : 's'}`;
    }
  }

  async ensureReportEnriched() {
    const report = this.app.state.report;
    if (!report) return;
    const enriched = await this.app.scanService.enrichReport(report);
    if (enriched !== report) {
      this.app.state.report = enriched;
      this.app.scanService.report = enriched;
      // Surgical DOM update avoids full re-render flicker
      const scanSlot = document.querySelector('#slot-scan-status');
      if (scanSlot) {
        updateScanStatusDom(scanSlot, enriched);
      } else {
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
    if (!scanSlot) return false;
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
    if (this._trendCleanup) this._trendCleanup();
    container.innerHTML = '';
    const view = this.render();
    container.appendChild(view);

    view.querySelector('#dash-run-scan')?.addEventListener('click', () => this.app.runScan());
    view.querySelector('#dash-goto-analyze')?.addEventListener('click', () => this.app.navigate('analyze'));

    if (!this.app.state.report) return;

    this.ensureReportEnriched();
    this.loadRepositoryHealth(view);
    this.loadPathHealth(view);

    requestAnimationFrame(() => {
      const trendSlot = view.querySelector('#slot-trend');
      this._trendCleanup = mountTrendChart(trendSlot, this.app.state.history) || null;
    });

    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
  }

  async loadRepositoryHealth(view) {
    const slot = view.querySelector('#slot-repo-health');
    if (!slot) return;
    try {
      const health = await fetchRepositoryHealth();
      slot.innerHTML = `
        <div class="section-heading">
          <h2>Repository health</h2>
          <a class="btn btn-ghost btn-sm" href="/dashboard/repository-health">Details →</a>
        </div>
        ${health?.headline
          ? renderRepositoryHealthSection(health, { compact: true })
          : '<p class="text-muted">No consolidation scan yet — run Analyze → Consolidation.</p>'}
      `;
    } catch {
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
    if (!slot) return;
    try {
      slot.innerHTML = '';
      const pathHealthComponent = renderPathHealthDashboard();
      slot.appendChild(pathHealthComponent);
    } catch (error) {
      console.error('Error loading path health dashboard:', error);
      slot.innerHTML = '<p class="text-muted">Path health metrics unavailable.</p>';
    }
  }

  destroy() {
    if (this._trendCleanup) this._trendCleanup();
    cleanupPathHealthDashboard();
  }
}
