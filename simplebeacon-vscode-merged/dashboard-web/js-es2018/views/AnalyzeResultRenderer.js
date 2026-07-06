import { escapeHtml, formatNumber, formatPercent, showToast, downloadJson } from '../utils.js';
import { renderIssueList } from '../components/IssueCard.js';
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
        if (!result)
            return '';
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
    _renderRawIssueList(issues) {
        if (!issues || !issues.length)
            return '<p class="text-muted">No issues found.</p>';
        const rows = issues.slice(0, 50).map((issue) => {
            const sev = (issue.severity || 'low').toLowerCase();
            const file = escapeHtml(issue.file || issue.path || issue.sourceFile || '—');
            const line = issue.line || issue.lineNumber || '';
            const msg = escapeHtml(issue.message || issue.description || issue.title || '');
            const rule = escapeHtml(issue.ruleId || issue.rule || issue.category || '');
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:rgba(255,255,255,0.03);margin-bottom:4px;">
                <span style="flex-shrink:0;font-size:0.65rem;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:${sev === 'critical' ? 'rgba(239,68,68,0.15)' : sev === 'high' ? 'rgba(249,115,22,0.15)' : sev === 'medium' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)'};color:${sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f97316' : sev === 'medium' ? '#3b82f6' : '#22c55e'};">${sev}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);flex-shrink:0;min-width:120px;">${file}${line ? ':' + line : ''}</span>
                <span style="font-size:0.82rem;color:var(--text-main);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${msg}</span>
                ${rule ? `<span style="font-size:0.68rem;color:var(--text-muted);flex-shrink:0;">${rule}</span>` : ''}
            </div>`;
        }).join('');
        const more = issues.length > 50 ? `<p style="padding:8px 12px;color:var(--text-muted);font-size:0.78rem;">+ ${issues.length - 50} more issues</p>` : '';
        return `<div style="max-height:400px;overflow-y:auto;">${rows}${more}</div>`;
    }
    renderSimplebeaconResults(result) {
        var _a, _b;
        const report = result.report;
        if (!report)
            return this._renderEmptyResult('No Simplebeacon report data');
        const metrics = getScanFileMetrics(report);
        const issues = report.issues || report.rawIssues || report.detectedIssues || [];
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd">
          <h3>🛡️ Simplebeacon Gate Results</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="export-report" title="Export report as JSON">📥 Export JSON</button>
            <span class="db-v3-panel-badge ${((_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) ? 'success' : 'danger'}">${((_b = report.gate) === null || _b === void 0 ? void 0 : _b.pass) ? 'PASS' : 'FAIL'}</span>
          </div>
        </div>
        <div class="an-res-v3-metrics">
          <div class="an-res-metric"><strong>${formatNumber(metrics.repositoryFiles || 0)}</strong><span>Files</span></div>
          <div class="an-res-metric"><strong>${formatNumber(report.totalFiles || 0)}</strong><span>Scanned</span></div>
          <div class="an-res-metric"><strong>${formatPercent(report.schemaCompliance || 0)}</strong><span>Schema</span></div>
        </div>
        <div class="an-res-v3-body">
          ${this._renderRawIssueList(issues)}
        </div>
      </div>
    `;
    }
    renderConsolidationResults(result) {
        const scan = result.scan;
        if (!scan)
            return this._renderEmptyResult('No consolidation data');
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🔀 Consolidation Results</h3></div>
        <div class="an-res-v3-body">${renderConsolidationPanel({ scan, loading: false, error: null })}</div>
      </div>
    `;
    }
    renderCodebaseResults(result) {
        const scan = result.scan;
        if (!scan)
            return this._renderEmptyResult('No codebase data');
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>📊 Codebase Analysis</h3></div>
        <div class="an-res-v3-body">${renderCodebasePanel({ scan })}</div>
      </div>
    `;
    }
    renderRoadmapResults(result) {
        const scan = result.scan;
        if (!scan)
            return this._renderEmptyResult('No roadmap data');
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
        if (!scan)
            return this._renderEmptyResult('No data cleanup results');
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🧹 Data Cleanup</h3></div>
        <div class="an-res-v3-body">${renderDataCleanupPanel(scan)}</div>
      </div>
    `;
    }
    renderUnderstandingResults(result) {
        const scan = result.scan;
        if (!scan)
            return this._renderEmptyResult('No understanding data');
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🧠 Code Understanding</h3></div>
        <div class="an-res-v3-body">${renderUnderstandingPanel(scan)}</div>
      </div>
    `;
    }
    renderZscriptResults(result) {
        const scan = result.scan;
        if (!scan)
            return this._renderEmptyResult('No ZScript data');
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>⚡ ZScript Report</h3></div>
        <div class="an-res-v3-body">${renderZscriptReportPanel(scan)}</div>
      </div>
    `;
    }
    renderCompleteResults(result) {
        var _a;
        const { projectPath, steps = [], errors = [] } = result;
        const simplebeacon = (_a = steps.find((s) => s.id === 'simplebeacon')) === null || _a === void 0 ? void 0 : _a.report;
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
        var _a;
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>🤖 AI Systems Analysis</h3></div>
        <div class="an-res-v3-body">
          ${((_a = result.issues) === null || _a === void 0 ? void 0 : _a.length) ? renderIssueList(result.issues).outerHTML : '<p class="text-muted">No AI system issues detected.</p>'}
        </div>
      </div>
    `;
    }
    renderSnippetResults(result) {
        var _a;
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd"><h3>📝 Snippet Diagnostic</h3></div>
        <div class="an-res-v3-body">
          ${((_a = result.findings) === null || _a === void 0 ? void 0 : _a.length) ? renderIssueList(result.findings).outerHTML : '<p class="text-muted">No findings in snippet.</p>'}
        </div>
      </div>
    `;
    }
    renderGenericResults(result) {
        return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd">
          <h3>📋 Results</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="export-report" title="Export report as JSON">📥 Export JSON</button>
            <span class="db-v3-panel-badge">${escapeHtml(result.kind || 'unknown')}</span>
          </div>
        </div>
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
