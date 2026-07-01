import { escapeHtml, formatNumber, redactPathForDisplay, showToast, downloadJson } from '../utils.js';
import { renderConsolidationPanel } from '../components/ConsolidationReport.js';
import { renderDataCleanupPanel, buildDataCleanupConclusion } from '../components/DataCleanupReport.js?v=20260527exec5';
import { renderCodebasePanel, buildCodebaseConclusion } from '../components/CodebaseReport.js';
import { renderUnderstandingPanel, buildUnderstandingConclusion } from '../components/UnderstandingReport.js';
import { renderZscriptReportPanel, buildZscriptConclusion } from '../components/ZscriptReport.js';
import { renderCompleteScanAnalysisPanel } from '../utils/completeScanAnalysis.js?v=20260601completescan1';
import { getScanFileMetrics } from '../services/analyzeService.js?v=20260531pathfix1';
import { COMPLETE_ENGINE_ORDER } from './AnalyzeEngineGrid.js';

/**
 * AnalyzeResultRenderer — Strategy-pattern coordinator for rendering
 * specialized result UIs based on scan kind.
 */
export class AnalyzeResultRenderer {
  constructor(view) {
    this.view = view;
  }

  /* ---- Dispatch by scan kind ---- */

  render(result) {
    if (!result) return '';
    const kind = result.kind;

    switch (kind) {
      case 'simplebeacon':
      case 'simplebeacon-report':
        return this.renderSimplebeaconResults(result);
      case 'consolidation':
        return this.renderConsolidationResults(result);
      case 'codebase':
        return this.renderCodebaseResults(result);
      case 'roadmap':
        return this.renderRoadmapResults(result);
      case 'data-cleanup':
        return this.renderDataCleanupResults(result);
      case 'understanding':
        return this.renderUnderstandingResults(result);
      case 'zscript':
        return this.renderZscriptResults(result);
      case 'complete':
        return this.renderCompleteResults(result);
      case 'eu-ai-act':
        return this.renderEuAiActResults(result);
      case 'ai-systems':
        return this.renderAiSystemsResults(result);
      case 'snippet':
        return this.renderSnippetResults(result);
      default:
        return this.renderGenericResults(result);
    }
  }

  /* ---- Individual result renderers ---- */

  renderSimplebeaconResults(result) {
    const report = result.report;
    if (!report) return this._renderEmptyResult('No Simplebeacon report data');
    const metrics = getScanFileMetrics(report);
    const issues = report.rawIssues || report.detectedIssues || report.issues || [];
    const computeSeverityCounts = (list) => {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const issue of list) {
        const sev = String(issue.severity || '').toLowerCase();
        if (counts[sev] != null) counts[sev] += (issue.count || 1);
      }
      return counts;
    };
    const sev = report.severityCounts || report.severity || computeSeverityCounts(issues);
    const critical = sev.critical || 0;
    const high = sev.high || 0;
    const medium = sev.medium || 0;
    const low = sev.low || 0;
    const total = critical + high + medium + low;
    const score = report.qualityScore !== undefined ? report.qualityScore : (report.score !== undefined ? report.score : '—');
    const gatePass = report.gate?.pass ?? report.summary?.gatePass;
    const gateClass = gatePass ? 'success' : (gatePass === false ? 'danger' : '');
    const gateLabel = gatePass ? 'PASS' : (gatePass === false ? 'FAIL' : 'N/A');
    const projectPath = result.projectPath || report.projectRoot || report.projectPath || 'Project';
    const durationMs = report.scanDurationMs || report.durationMs || null;
    const durationText = durationMs ? (durationMs < 1000 ? durationMs + 'ms' : (Math.round(durationMs / 100) / 10) + 's') : '—';
    const filesRepo = metrics.repositoryFiles ?? report.repositoryFilesTotal ?? report.totalFiles ?? null;
    const filesScanned = metrics.filesAnalyzed ?? report.filesAnalyzed ?? report.totalFiles ?? 0;
    const scanSummary = report.scan_summary;
    const scanStatus = scanSummary?.status || '—';
    const costSaved = scanSummary?.estimated_incident_cost_saved;
    const categories = (this.view.app?.scanService?.getIssueCategories(report) || []).filter((c) => c.count > 0).slice(0, 6);
    const topIssues = issues.slice(0, 10);

    const sevBar = total > 0 ? `
      <div class="an-res-sev-bar">
        ${critical ? '<div class="an-res-sev-critical" style="width:' + ((critical / total) * 100) + '%"></div>' : ''}
        ${high ? '<div class="an-res-sev-high" style="width:' + ((high / total) * 100) + '%"></div>' : ''}
        ${medium ? '<div class="an-res-sev-medium" style="width:' + ((medium / total) * 100) + '%"></div>' : ''}
        ${low ? '<div class="an-res-sev-low" style="width:' + ((low / total) * 100) + '%"></div>' : ''}
      </div>
      <div class="an-res-sev-labels">
        ${critical ? '<span style="color:#ef4444">● ' + critical + ' Critical</span>' : ''}
        ${high ? '<span style="color:#f97316">● ' + high + ' High</span>' : ''}
        ${medium ? '<span style="color:#3b82f6">● ' + medium + ' Medium</span>' : ''}
        ${low ? '<span style="color:#22c55e">● ' + low + ' Low</span>' : ''}
      </div>
    ` : '<p class="text-muted" style="margin:8px 0 10px;">No issues found.</p>';

    const categoryList = categories.length ? `
      <div style="margin:14px 0 6px;">
        <h4 style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Top categories</h4>
        <div class="an-res-cats">
          ${categories.map((c) => `
            <div class="an-res-cat">
              <span class="an-res-cat-icon">${c.icon || '🔎'}</span>
              <div class="an-res-cat-info">
                <div class="an-res-cat-title">${escapeHtml(c.title)}</div>
                <div class="an-res-cat-count">${formatNumber(c.count)} ${c.count === 1 ? 'issue' : 'issues'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const issueList = topIssues.length ? `
      <div style="margin:14px 0 6px;">
        <h4 style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Top findings</h4>
        ${topIssues.map((issue) => {
          const severity = issue.severity || 'low';
          const title = issue.description || issue.message || issue.title || 'Issue';
          const filePath = issue.filePath || issue.filePaths?.[0] || issue.metadata?.duplicatePaths?.[0] || issue.affectedFiles?.[0] || '';
          const fileName = this.view.app?.scanService?.basename(filePath) || '';
          const category = categories.find((c) => c.filter && c.filter(issue)) || { title: issue.type || 'Issue', icon: '🔎' };
          const recommendation = issue.recommendation || issue.recommendedAction || '';
          return `
            <div class="an-res-finding">
              <div class="an-res-finding-sev ${severity}"></div>
              <div class="an-res-finding-body">
                <div class="an-res-finding-title">${escapeHtml(category.icon || '🔎')} ${escapeHtml(category.title)} — ${escapeHtml(title)}</div>
                <div class="an-res-finding-meta">${fileName ? escapeHtml(fileName) : ''}</div>
                ${recommendation ? `<div class="an-res-finding-rec" style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${escapeHtml(recommendation)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="an-res-v3">
        <style>
          .an-res-summary { padding: 18px 22px; }
          .an-res-summary-hd { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
          .an-res-summary-hd h3 { margin:0; font-size:1.1rem; font-weight:700; }
          .an-res-summary-path { color:var(--text-muted); font-size:0.78rem; margin-top:4px; }
          .an-res-summary-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; margin-bottom:14px; }
          .an-res-summary-card { background:rgba(148,163,184,0.05); border:1px solid rgba(148,163,184,0.08); border-radius:12px; padding:12px; text-align:center; }
          .an-res-summary-card strong { display:block; font-size:1.3rem; font-weight:800; color:var(--text-primary); margin-bottom:2px; }
          .an-res-summary-card span { font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; }
          .an-res-sev-bar { height:8px; border-radius:4px; overflow:hidden; display:flex; }
          .an-res-sev-bar > div { height:100%; }
          .an-res-sev-critical { background:#ef4444; }
          .an-res-sev-high { background:#f97316; }
          .an-res-sev-medium { background:#3b82f6; }
          .an-res-sev-low { background:#22c55e; }
          .an-res-sev-labels { display:flex; gap:12px; font-size:0.72rem; color:var(--text-muted); margin-bottom:10px; flex-wrap:wrap; }
          .an-res-cats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
          @media (max-width:700px) { .an-res-cats { grid-template-columns:repeat(2,1fr); } }
          .an-res-cat { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background:rgba(148,163,184,0.05); border:1px solid rgba(148,163,184,0.08); }
          .an-res-cat-icon { font-size:1.2rem; }
          .an-res-cat-title { font-size:0.8rem; font-weight:600; color:var(--text-primary); }
          .an-res-cat-count { font-size:0.68rem; color:var(--text-muted); }
          .an-res-finding { display:flex; align-items:flex-start; gap:10px; padding:10px; border-radius:10px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.08); margin-bottom:8px; }
          .an-res-finding-sev { width:4px; min-height:24px; border-radius:2px; flex-shrink:0; }
          .an-res-finding-sev.critical { background:#ef4444; }
          .an-res-finding-sev.high { background:#f97316; }
          .an-res-finding-sev.medium { background:#3b82f6; }
          .an-res-finding-sev.low { background:#22c55e; }
          .an-res-finding-body { flex:1; min-width:0; }
          .an-res-finding-title { font-size:0.82rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .an-res-finding-meta { font-size:0.68rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .an-res-view-all { margin-top:12px; text-align:right; }
        </style>
        <div class="an-res-summary">
          <div class="an-res-summary-hd">
            <div>
              <h3>🛡️ Simplebeacon Scan Results</h3>
              <div class="an-res-summary-path">${escapeHtml(redactPathForDisplay(projectPath))}</div>
            </div>
            <span class="db-v3-panel-badge ${gateClass}">${gateLabel}</span>
          </div>
          <div class="an-res-summary-grid">
            <div class="an-res-summary-card"><strong>${escapeHtml(scanStatus)}</strong><span>Status</span></div>
            <div class="an-res-summary-card"><strong>${formatNumber(filesRepo)}</strong><span>Repo files</span></div>
            <div class="an-res-summary-card"><strong>${formatNumber(filesScanned)}</strong><span>Scanned</span></div>
            <div class="an-res-summary-card"><strong>${formatNumber(total)}</strong><span>Issues</span></div>
            <div class="an-res-summary-card"><strong>${score}</strong><span>Quality</span></div>
            ${costSaved ? `<div class="an-res-summary-card"><strong>${escapeHtml(costSaved)}</strong><span>Cost saved</span></div>` : ''}
          </div>
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">
              <span>Severity breakdown</span>
              <span>${durationText !== '—' ? 'Scan took ' + durationText : ''}</span>
            </div>
            ${sevBar}
          </div>
          ${categoryList}
          ${issueList}
          <div class="an-res-view-all">
            <button type="button" class="btn btn-secondary btn-sm" id="analyze-view-results-btn">View all in Results →</button>
          </div>
        </div>
      </div>
    `;
  }

  renderConsolidationResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No consolidation data');
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🔀 Consolidation Results</h3></div>
        <div class="an-res-v3-body">${renderConsolidationPanel({ scan, loading: false, error: null })}</div>
      </div>
    `;
  }

  renderCodebaseResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No codebase data');
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>📊 Codebase Analysis</h3></div>
        <div class="an-res-v3-body">${renderCodebasePanel(scan)}</div>
      </div>
    `;
  }

  renderRoadmapResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No roadmap data');
    const phases = scan.phases || [];
    const issues = scan.issues || [];
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🗺️ Roadmap</h3><span class="db-v3-panel-badge">${phases.length} phases · ${issues.length} issues</span></div>
        <div class="an-res-v3-body">
          ${phases.map((p) => `
            <div class="an-res-phase">
              <h4>${escapeHtml(p.title || 'Phase')}</h4>
              <p class="text-muted">${escapeHtml(p.description || '')}</p>
              <div class="an-res-tasks">${(p.tasks || []).map((t) => `<span class="an-res-task">${escapeHtml(t)}</span>`).join('')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderDataCleanupResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No data cleanup results');
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🧹 Data Cleanup</h3></div>
        <div class="an-res-v3-body">${renderDataCleanupPanel(scan)}</div>
      </div>
    `;
  }

  renderUnderstandingResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No understanding data');
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🧠 Code Understanding</h3></div>
        <div class="an-res-v3-body">${renderUnderstandingPanel(scan)}</div>
      </div>
    `;
  }

  renderZscriptResults(result) {
    const scan = result.scan;
    if (!scan) return this._renderEmptyResult('No ZScript data');
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>⚡ ZScript Report</h3></div>
        <div class="an-res-v3-body">${renderZscriptReportPanel(scan)}</div>
      </div>
    `;
  }

  renderCompleteResults(result) {
    const { projectPath, steps = [], errors = [] } = result;
    const simplebeacon = steps.find((s) => s.id === 'simplebeacon')?.report;
    const canonicalCount = simplebeacon ? getScanFileMetrics(simplebeacon).repositoryFiles : null;

    // Engine status chips
    const stepChips = steps.map((s) => `
      <div class="an-res-step-chip done">
        <span class="an-res-step-dot" style="background:#22c55e;"></span>
        <span>${escapeHtml(s.label || s.id)}</span>
      </div>
    `).join('');

    const errorChips = errors.map((e) => `
      <div class="an-res-step-chip error">
        <span class="an-res-step-dot" style="background:#ef4444;"></span>
        <span>${escapeHtml(e.label || e.id)} — ${escapeHtml(e.error || 'Failed')}</span>
      </div>
    `).join('');

    return `
      <style>
        .an-res-v3 { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); margin-bottom:20px; }
        [data-theme='light'] .an-res-v3 { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .an-res-v3-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .an-res-v3-hd h3 { margin:0; font-size:1rem; font-weight:700; }
        .an-res-v3-metrics { display:flex; gap:14px; padding:14px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .an-res-metric { display:flex; flex-direction:column; gap:2px; }
        .an-res-metric strong { font-size:1.1rem; font-weight:800; color:var(--text-primary); }
        .an-res-metric span { font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
        .an-res-v3-body { padding:18px 22px; }
        .an-res-step-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:8px; background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.08); font-size:0.78rem; margin:4px; }
        .an-res-step-dot { width:6px; height:6px; border-radius:50%; }
        .an-res-phase { padding:14px; border-radius:12px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.08); margin-bottom:10px; }
        .an-res-phase h4 { margin:0 0 4px; font-size:0.9rem; font-weight:700; }
        .an-res-tasks { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        .an-res-task { padding:4px 10px; border-radius:6px; background:rgba(148,163,184,0.08); font-size:0.72rem; color:var(--text-secondary); }
      </style>

      <div class="an-res-v3">
        <div class="an-res-v3-hd">
          <h3>🔬 Complete Scan Results</h3>
          <span class="db-v3-panel-badge">${steps.length}/${COMPLETE_ENGINE_ORDER.length} engines</span>
        </div>
        <div class="an-res-v3-metrics">
          ${canonicalCount != null ? `<div class="an-res-metric"><strong>${formatNumber(canonicalCount)}</strong><span>Files</span></div>` : ''}
          <div class="an-res-metric"><strong>${steps.length}</strong><span>Completed</span></div>
          <div class="an-res-metric"><strong>${errors.length}</strong><span>Errors</span></div>
        </div>
        <div class="an-res-v3-body">
          <div style="display:flex;flex-wrap:wrap;margin-bottom:14px;">${stepChips}${errorChips}</div>
          ${renderCompleteScanAnalysisPanel(result)}
        </div>
      </div>
    `;
  }

  renderEuAiActResults(result) {
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🇪🇺 EU AI Act Audit</h3></div>
        <div class="an-res-v3-body">
          <p class="text-muted">EU AI Act sprint results are rendered in the dedicated compliance panel.</p>
        </div>
      </div>
    `;
  }

  renderAiSystemsResults(result) {
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🤖 AI Systems Analysis</h3></div>
        <div class="an-res-v3-body">
          ${result.issues?.length ? renderIssueList(result.issues) : '<p class="text-muted">No AI system issues detected.</p>'}
        </div>
      </div>
    `;
  }

  renderSnippetResults(result) {
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>📝 Snippet Diagnostic</h3></div>
        <div class="an-res-v3-body">
          ${result.findings?.length ? renderIssueList(result.findings) : '<p class="text-muted">No findings in snippet.</p>'}
        </div>
      </div>
    `;
  }

  renderGenericResults(result) {
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>📋 Results</h3><span class="db-v3-panel-badge">${escapeHtml(result.kind || 'unknown')}</span></div>
        <div class="an-res-v3-body">
          <pre style="background:rgba(0,0,0,0.2);padding:14px;border-radius:10px;overflow-x:auto;font-size:0.78rem;"><code>${escapeHtml(JSON.stringify(result, null, 2))}</code></pre>
        </div>
      </div>
    `;
  }

  /* ---- Private helpers ---- */

  _renderEmptyResult(message) {
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-body" style="text-align:center;padding:40px;">
          <p class="text-muted">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }
}
