// simplebeacon-ignore: Dashboard code — all findings are false positives in scanner definitions
/**
 * CLI Metrics Widget
 *
 * Renders dashboard metrics widgets from CLI report data. Uses the
 * cli-report-adapter to normalize CLI JSON, then renders:
 * - Gate status badge (PASS/FAIL)
 * - Quality score gauge
 * - Severity count chips (critical/high/medium/low)
 * - Findings table grouped by severity
 * - Rule coverage heatmap
 * - Scan timing breakdown
 *
 * Also supports rendering TrendChart and TeamGatePassTrendChart from
 * an array of historical CLI reports.
 *
 * Usage:
 *   import { CliMetricsWidget } from './CliMetricsWidget.js';
 *   const widget = new CliMetricsWidget(containerEl);
 *   widget.render(cliJsonReport);
 *   widget.renderTrend(cliReportArray);
 */

import { adaptCliReport, adaptCliReportHistory } from '../utils/cli-report-adapter.js';
import { enrichFindingsWithAlerts, renderAlertCard, getAlertTemplate } from '../utils/alert-templates.js';
import { TrendChart } from './TrendChart.js';
import { TeamGatePassTrendChart } from './TeamGatePassTrendChart.js';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
};

export class CliMetricsWidget {
  /**
   * @param {HTMLElement} container - The DOM element to render into
   */
  constructor(container) {
    this.container = container;
    this._trendChart = null;
    this._gateTrendChart = null;
    this._currentReport = null;
  }

  /**
   * Render the full metrics dashboard from a CLI report.
   * @param {object} cliReport - Raw CLI JSON report
   */
  render(cliReport) {
    if (!this.container) return;
    const report = adaptCliReport(cliReport);
    this._currentReport = report;

    this.container.replaceChildren();
    this.container.appendChild(this._renderHeader(report));
    this.container.appendChild(this._renderGateAndScore(report));
    this.container.appendChild(this._renderSeverityChips(report));
    this.container.appendChild(this._renderHighRiskAlerts(report));
    this.container.appendChild(this._renderFindingsTable(report));
    this.container.appendChild(this._renderRuleCoverage(report));
    this.container.appendChild(this._renderScanTiming(report));
  }

  /**
   * Render trend charts from an array of historical CLI reports.
   * @param {object[]} cliReports - Array of CLI JSON reports (oldest first)
   */
  renderTrend(cliReports) {
    if (!this.container) return;
    const { trendHistory, gateTrend } = adaptCliReportHistory(cliReports);

    const trendSection = document.createElement('div');
    trendSection.className = 'cli-metrics-trend-section';

    // Issue count trend
    const trendCard = document.createElement('div');
    trendCard.className = 'card p-4 mb-3';
    const trendTitle = document.createElement('h4');
    trendTitle.className = 'h6 mb-3';
    trendTitle.textContent = 'Issue Count Trend';
    trendCard.appendChild(trendTitle);
    const trendCanvas = document.createElement('canvas');
    trendCanvas.style.cssText = 'width:100%;height:180px;';
    trendCanvas.className = 'cli-trend-canvas';
    trendCard.appendChild(trendCanvas);
    trendSection.appendChild(trendCard);

    // Gate pass rate trend
    const gateCard = document.createElement('div');
    gateCard.className = 'card p-4';
    const gateTitle = document.createElement('h4');
    gateTitle.className = 'h6 mb-3';
    gateTitle.textContent = 'Gate Pass Rate Trend';
    gateCard.appendChild(gateTitle);
    const gateCanvas = document.createElement('canvas');
    gateCanvas.style.cssText = 'width:100%;height:180px;';
    gateCanvas.className = 'cli-gate-trend-canvas';
    gateCard.appendChild(gateCanvas);
    trendSection.appendChild(gateCard);

    this.container.appendChild(trendSection);

    // Render charts after DOM is ready
    requestAnimationFrame(() => {
      if (trendCanvas.parentElement && trendHistory.length > 0) {
        this._trendChart = new TrendChart(trendCanvas);
        this._trendChart.render(trendHistory);
      }
      if (gateCanvas.parentElement && gateTrend.length > 0) {
        this._gateTrendChart = new TeamGatePassTrendChart(gateCanvas);
        this._gateTrendChart.render(gateTrend);
      }
    });
  }

  /**
   * Get the current adapted report.
   */
  getReport() {
    return this._currentReport;
  }

  // ═══════════════════════════════════════════════
  // Private render methods
  // ═══════════════════════════════════════════════

  _renderHeader(report) {
    const header = document.createElement('div');
    header.className = 'cli-metrics-header mb-4';

    const project = report.projectRoot || 'Unknown Project';
    const date = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—';
    const scanPaths = (report.scanPaths || []).join(', ') || '—';

    header.innerHTML = `
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                    <h3 class="h5 mb-1">CLI Scan Report</h3>
                    <p class="text-muted text-sm mb-0">
                        <strong>${_esc(project)}</strong> · ${_esc(date)}
                    </p>
                    <p class="text-muted text-xs mt-1">
                        Scan paths: ${_esc(scanPaths)}
                    </p>
                </div>
                <div class="d-flex gap-2 align-items-center">
                    <span class="badge bg-secondary">${_esc(report.reportVersion ? 'v' + report.reportVersion : 'v1')}</span>
                    <span class="badge bg-info">${_esc(report.tier || 'unknown')} tier</span>
                </div>
            </div>
        `;
    return header;
  }

  _renderGateAndScore(report) {
    const card = document.createElement('div');
    card.className = 'card p-4 mb-3 cli-metrics-gate-card';

    const gate = report.gate || {};
    const gatePass = gate.pass === true;
    const score = report.qualityScore;
    const scoreText = score === 0 && gatePass && gate.blockingCount === 0 ? '—' : score != null ? score + '%' : '—';
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const gradeColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';

    const filesAnalyzed = report.ruleScopedFilesAnalyzed || 0;
    const repoTotal = report.repositoryFilesTotal || 0;

    card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h4 class="text-muted text-xs uppercase mb-1">Gate Quality Score</h4>
                    <div class="display-3 font-weight-bold" style="color:${gradeColor}">${_esc(scoreText)}</div>
                    <p class="text-muted text-xs mb-0 mt-1">
                        ${filesAnalyzed.toLocaleString()} files analyzed · ${repoTotal.toLocaleString()} in repo
                    </p>
                    ${score != null && scoreText !== '—' ? `<p class="mt-1 mb-0"><span class="badge" style="background:${gradeColor};color:#fff">Grade ${grade}</span></p>` : ''}
                </div>
                <span class="badge p-3 ${gatePass ? 'bg-success' : 'bg-danger'} font-weight-bold">
                    ${gatePass ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            ${
              gate.blockingCount > 0
                ? `
                <div class="mt-3 alert alert-danger py-2 px-3 mb-0">
                    <strong>${gate.blockingCount}</strong> blocking issue${gate.blockingCount === 1 ? '' : 's'} ·
                    <strong>${gate.warningCount || 0}</strong> warning${(gate.warningCount || 0) === 1 ? '' : 's'}
                </div>
            `
                : gate.warningCount > 0
                  ? `
                <div class="mt-3 alert alert-warning py-2 px-3 mb-0">
                    <strong>${gate.warningCount}</strong> warning${gate.warningCount === 1 ? '' : 's'} · No blocking issues
                </div>
            `
                  : `
                <div class="mt-3 alert alert-success py-2 px-3 mb-0">
                    No issues detected — gate is clean.
                </div>
            `
            }
        `;
    return card;
  }

  _renderSeverityChips(report) {
    const sev = report.severityCounts || {};
    const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);

    const card = document.createElement('div');
    card.className = 'card p-4 mb-3 cli-metrics-severity-card';

    const chips = SEVERITY_ORDER.map((s) => {
      const count = sev[s] || 0;
      const color = SEVERITY_COLORS[s];
      const isEmpty = count === 0;
      return `
                <div class="d-flex align-items-center gap-2 ${isEmpty ? 'opacity-50' : ''}">
                    <span class="badge" style="background:${color};min-width:32px;text-align:center">${count}</span>
                    <span class="text-sm">${SEVERITY_LABELS[s]}</span>
                </div>
            `;
    }).join('');

    card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="h6 mb-0">Severity Distribution</h4>
                <span class="text-muted text-sm">${total} total issue${total === 1 ? '' : 's'}</span>
            </div>
            <div class="d-flex gap-4 flex-wrap">
                ${chips}
            </div>
        `;
    return card;
  }

  _renderHighRiskAlerts(report) {
    const issues = report.detectedIssues || [];
    // Enrich issues with alert templates (in case they aren't already)
    const enriched = enrichFindingsWithAlerts(issues);
    // Only render alerts for findings that have alert templates
    const alertFindings = enriched.filter((f) => f.alertTemplate);
    if (alertFindings.length === 0) return document.createElement('div');

    const card = document.createElement('div');
    card.className = 'cli-metrics-alerts-card mb-3';

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-3';
    header.innerHTML = `
            <h4 class="h6 mb-0">High-Risk Finding Alerts</h4>
            <span class="text-muted text-sm">${alertFindings.length} alert${alertFindings.length === 1 ? '' : 's'}</span>
        `;
    card.appendChild(header);

    const alertContainer = document.createElement('div');
    alertContainer.className = 'cli-alert-cards-container';
    for (const finding of alertFindings) {
      const alertHtml = renderAlertCard(finding);
      if (alertHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = alertHtml;
        alertContainer.appendChild(wrapper.firstElementChild);
      }
    }
    card.appendChild(alertContainer);

    return card;
  }

  _renderFindingsTable(report) {
    const issues = report.detectedIssues || [];
    if (issues.length === 0) return document.createElement('div');

    const card = document.createElement('div');
    card.className = 'card p-4 mb-3 cli-metrics-findings-card';

    // Group by severity
    const bySeverity = { critical: [], high: [], medium: [], low: [] };
    for (const issue of issues) {
      const sev = (issue.severity || 'low').toLowerCase();
      if (bySeverity[sev]) bySeverity[sev].push(issue);
      else bySeverity.low.push(issue);
    }

    const sections = SEVERITY_ORDER.map((s) => {
      const items = bySeverity[s];
      if (items.length === 0) return '';
      const maxShow = s === 'critical' || s === 'high' ? 30 : 15;
      const visible = items.slice(0, maxShow);
      const remaining = items.length - visible.length;
      const color = SEVERITY_COLORS[s];

      const rows = visible
        .map((issue) => {
          const file = issue.filePath || issue.file || '—';
          const type = issue.type || issue.pattern || 'Issue';
          const desc = issue.description || '';
          const line = issue.line ? `:${issue.line}` : '';
          return `
                    <tr>
                        <td class="text-sm" style="font-family:monospace;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(file)}">${_esc(file)}${_esc(line)}</td>
                        <td class="text-sm"><code>${_esc(type)}</code></td>
                        <td class="text-sm" style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(desc)}">${_esc(desc)}</td>
                    </tr>
                `;
        })
        .join('');

      const moreRow =
        remaining > 0
          ? `<tr><td colspan="3" class="text-muted text-sm text-center">+ ${remaining} more ${SEVERITY_LABELS[s].toLowerCase()} findings</td></tr>`
          : '';

      return `
                <div class="mb-3">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="badge" style="background:${color}">${items.length}</span>
                        <strong>${SEVERITY_LABELS[s]}</strong>
                    </div>
                    <table class="table table-sm table-hover mb-0">
                        <thead>
                            <tr>
                                <th class="text-xs uppercase text-muted">File</th>
                                <th class="text-xs uppercase text-muted">Rule</th>
                                <th class="text-xs uppercase text-muted">Description</th>
                            </tr>
                        </thead>
                        <tbody>${rows}${moreRow}</tbody>
                    </table>
                </div>
            `;
    })
      .filter(Boolean)
      .join('');

    card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="h6 mb-0">Findings Detail</h4>
                <span class="text-muted text-sm">${issues.length} finding${issues.length === 1 ? '' : 's'}</span>
            </div>
            ${sections}
        `;
    return card;
  }

  _renderRuleCoverage(report) {
    const coverage = report.ruleCoverage || [];
    if (coverage.length === 0) return document.createElement('div');

    const card = document.createElement('div');
    card.className = 'card p-4 mb-3 cli-metrics-coverage-card';

    const rows = coverage
      .map((r) => {
        const hasFindings = r.findings > 0;
        const statusIcon = hasFindings ? '▲' : '✓';
        const statusColor = hasFindings ? '#F59E0B' : '#10B981';
        const pct = r.filesScanned > 0 ? '100%' : '0%';
        return `
                <div class="d-flex justify-content-between align-items-center py-1">
                    <span class="text-sm">${_esc(r.rule)}</span>
                    <span class="text-sm">
                        <span style="color:${statusColor}">${statusIcon}</span>
                        ${r.filesScanned.toLocaleString()} files ·
                        <strong style="color:${hasFindings ? '#F59E0B' : 'inherit'}">${r.findings}</strong> findings
                    </span>
                </div>
            `;
      })
      .join('');

    card.innerHTML = `
            <h4 class="h6 mb-3">Rule Coverage</h4>
            <div>${rows}</div>
        `;
    return card;
  }

  _renderScanTiming(report) {
    const totalMs = report.totalScanTimeMs || report.totalScanDurationMs || 0;
    if (totalMs === 0) return document.createElement('div');

    const card = document.createElement('div');
    card.className = 'card p-4 mb-3 cli-metrics-timing-card';

    const seconds = (totalMs / 1000).toFixed(2);
    const slowest = report.slowestRule;
    const timings = report.ruleTimings || {};

    const timingRows = Object.entries(timings)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 5)
      .map(([rule, ms]) => {
        const pct = totalMs > 0 ? ((ms / totalMs) * 100).toFixed(1) : '0';
        return `
                    <div class="d-flex justify-content-between align-items-center py-1">
                        <span class="text-sm">${_esc(rule)}</span>
                        <span class="text-sm">${(ms / 1000).toFixed(2)}s <span class="text-muted">(${pct}%)</span></span>
                    </div>
                `;
      })
      .join('');

    card.innerHTML = `
            <h4 class="h6 mb-3">Scan Performance</h4>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-sm font-weight-bold">Total scan time</span>
                <span class="text-sm font-weight-bold">${seconds}s</span>
            </div>
            ${slowest ? `<p class="text-muted text-xs mb-2">Slowest rule: ${_esc(slowest.rule || slowest.name || 'unknown')} (${((slowest.ms || slowest.duration || 0) / 1000).toFixed(2)}s)</p>` : ''}
            ${timingRows ? `<div class="mt-2">${timingRows}</div>` : ''}
        `;
    return card;
  }
}

/**
 * Escape HTML to prevent XSS in rendered strings.
 */
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
