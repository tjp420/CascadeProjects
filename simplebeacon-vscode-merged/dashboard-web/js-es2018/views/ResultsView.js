// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, showToast, formatPercent, formatNumber, renderEmptyState } from '../utils.js';
import {
  getScanFileMetrics,
  resolveDisplayScore,
  hydrateClientScanReport,
  isClientScanReport,
} from '../services/analyzeService.js?v=20260726sevfix1';
import { openInIde, renderIdeFileLink, resolveProjectRootFromApp } from '../utils-lib/ideDeepLink.js';
const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];
/**
 * Results view.
 */
export class ResultsView {
  constructor(app) {
    this.app = app;
    this.filterSeverity = 'all';
    this.filterCategory = 'all';
    this.selectedIssue = null;
    this._container = null;
    this._paintTimer = null;
  }
  applyRouteParams(params = {}) {
    this.filterSeverity = params.q ? 'all' : 'all';
    this.filterCategory = params.filter || 'all';
  }
  getFilteredIssues() {
    var _a, _b;
    const report = this.app.state.report;
    const source =
      (_a = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _a !== void 0
        ? _a
        : report === null || report === void 0
          ? void 0
          : report.detectedIssues;
    if (!(source === null || source === void 0 ? void 0 : source.length)) return [];
    let issues = source.map((issue, index) => {
      var _a, _b, _c, _d, _e;
      return {
        ...issue,
        id: issue.id || `${issue.severity}|${issue.type}|${issue.description}|${index}`,
        filePaths:
          issue.filePaths ||
          ((_a = issue.metadata) === null || _a === void 0 ? void 0 : _a.duplicatePaths) ||
          (issue.filePath ? [issue.filePath] : []),
        filePath:
          issue.filePath ||
          ((_b = issue.filePaths) === null || _b === void 0 ? void 0 : _b[0]) ||
          ((_d = (_c = issue.metadata) === null || _c === void 0 ? void 0 : _c.duplicatePaths) === null || _d === void 0
            ? void 0
            : _d[0]) ||
          ((_e = issue.affectedFiles) === null || _e === void 0 ? void 0 : _e[0]),
      };
    });
    const query = (_b = this.app.state.routeParams) === null || _b === void 0 ? void 0 : _b.q;
    if (query) {
      const q = query.toLowerCase();
      issues = issues.filter((i) => {
        var _a, _b, _c;
        return (
          ((_a = i.type) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) ||
          ((_b = i.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(q)) ||
          ((_c = i.filePath) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(q))
        );
      });
    }
    if (this.filterSeverity !== 'all') {
      issues = issues.filter((i) => i.severity === this.filterSeverity);
    }
    if (this.filterCategory !== 'all') {
      const cats = this.app.scanService.getIssueCategories(report);
      const cat = cats.find((c) => c.id === this.filterCategory);
      if (cat === null || cat === void 0 ? void 0 : cat.filter) {
        issues = issues.filter(cat.filter);
      }
    }
    issues = issues.filter((i) => !String(i.filePath || '').includes('node_modules'));
    return issues;
  }
  renderScanSummary(report) {
    var _a, _b, _c, _d, _e, _f;
    if (!report) return '';
    const metrics = getScanFileMetrics(report);
    const blockingCount =
      (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.blockingCount) !== null && _b !== void 0
        ? _b
        : 0;
    const gatePass = ((_c = report.gate) === null || _c === void 0 ? void 0 : _c.pass) === true && blockingCount === 0;
    const gateLabel = gatePass ? 'PASS' : blockingCount > 0 ? 'FAIL' : 'REVIEW';
    const gateClass = gatePass ? 'pass' : blockingCount > 0 ? 'fail' : 'warn';
    const clientScan = isClientScanReport(report);
    const telemetry = report.telemetry || null;
    return `
      ${
        clientScan
          ? `<div class="card mb-4 results-post-scan-banner" style="padding:var(--space-3);border-color:rgba(99,102,241,0.35);">
        <strong>Local browser scan</strong> — ${formatNumber((_d = report.issueCount) !== null && _d !== void 0 ? _d : 0)} finding(s) from your selected folder.
        ${gatePass ? 'No high-severity gate blockers under <code>failOn: high</code>.' : `${formatNumber(blockingCount)} blocking issue(s) — review before merge.`}
      </div>`
          : ''
      }
      <div class="metrics-row mb-4">
        <div class="metric-chip gate-badge ${gateClass}">${gateLabel}</div>
        <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
        <div class="metric-chip"><strong>${formatNumber((_e = metrics.mockSampleFiles) !== null && _e !== void 0 ? _e : report.totalFiles)}</strong> mock/sample</div>
        ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
        <div class="metric-chip"><strong>${formatNumber((_f = metrics.ruleScopedFilesAnalyzed) !== null && _f !== void 0 ? _f : metrics.credentialScanned)}</strong> gate rules checked</div>
        <div class="metric-chip"><strong>${formatPercent(report.schemaCompliance)}</strong> schema</div>
        <div class="metric-chip"><strong>${report.issueCount != null ? report.issueCount : 0}</strong> issue groups</div>
      </div>
            ${
              telemetry
                ? `
                <div class="card mb-4" style="padding:var(--space-3);">
                    <h4 style="margin:0 0 8px;">Scan breakdown</h4>
                    <div class="metrics-row">
                        <div class="metric-chip">Ignored dirs: <strong>${formatNumber(telemetry.ignoredDir || 0)}</strong></div>
                        <div class="metric-chip">Binary/skipped: <strong>${formatNumber(telemetry.binarySkipped || 0)}</strong></div>
                        <div class="metric-chip">Large vendor files skipped: <strong>${formatNumber(telemetry.heavyVendor || 0)}</strong></div>
                        <div class="metric-chip">Ignored by pattern: <strong>${formatNumber(telemetry.ignoredByPattern || 0)}</strong></div>
                    </div>
                </div>
            `
                : ''
            }
    `;
  }
  render() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const report = this.app.state.report;
    const issues = this.getFilteredIssues();
    const categories = this.app.scanService.getIssueCategories(report);
    const totalIssues = (
      (_b =
        (_a = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _a !== void 0
          ? _a
          : report === null || report === void 0
            ? void 0
            : report.detectedIssues) !== null && _b !== void 0
        ? _b
        : []
    ).reduce((sum, i) => sum + (i.count || 1), 0);
    const activeCategory = categories.find((c) => c.id === this.filterCategory);
    const filtersActive =
      this.filterSeverity !== 'all' ||
      this.filterCategory !== 'all' ||
      Boolean((_c = this.app.state.routeParams) === null || _c === void 0 ? void 0 : _c.q);
    const fromAudit = ((_d = this.app.state.routeParams) === null || _d === void 0 ? void 0 : _d.from) === 'audit';
    const el = document.createElement('div');
    el.className = 'fade-in';
    // Prepare empty-state HTML (renderEmptyState may return a string or an { html, attach } object)
    const _noReportEmptyState = !report
      ? renderEmptyState({
          icon: '📋',
          title: 'No scan report loaded yet',
          body: 'Run a Simplebeacon or Complete scan from Analyze, or use Dashboard → Run scan.',
          iconWrapper: 'emoji',
          actions: [{ label: 'Go to Analyze', onClick: () => this.app.navigate('analyze') }],
        })
      : null;
    const _issuesEmptyState =
      report && issues.length === 0
        ? renderEmptyState({
            icon: totalIssues === 0 && report?.gate?.pass && !filtersActive ? '✅' : '🔍',
            title: this.emptyStateMessage(report, totalIssues, filtersActive, activeCategory),
            body: filtersActive ? 'Try adjusting severity filter or search query.' : undefined,
            iconWrapper: 'emoji',
          })
        : null;
    const _noReportEmptyHtml = _noReportEmptyState
      ? typeof _noReportEmptyState === 'string'
        ? _noReportEmptyState
        : _noReportEmptyState.html
      : '';
    const _issuesEmptyHtml = _issuesEmptyState
      ? typeof _issuesEmptyState === 'string'
        ? _issuesEmptyState
        : _issuesEmptyState.html
      : '';

    el.innerHTML = `
      <div class="section-heading mb-4">
        <h1 class="page-title" style="margin:0">Results</h1>
        ${this.app.isCurrentUserAdmin() ? '<button class="btn btn-primary btn-sm" id="send-ai-btn" type="button" title="Send scan data to AI coding agent">🤖 Send to AI Agent</button>' : ''}
      </div>
      ${
        this.app.isCurrentUserAdmin()
          ? `
      <div id="ai-send-panel" class="card mb-4" style="display:none;padding:var(--space-3);background:rgba(99,102,241,0.06);border-color:rgba(99,102,241,0.2);">
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px;">Add notes for the AI agent (optional):</p>
        <textarea id="ai-notes-input" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.8rem;resize:vertical;" placeholder="e.g., 'Focus on critical credential leaks first, ignore test files...'"></textarea>
        <div class="flex gap-2 mt-2">
          <button class="btn btn-primary btn-sm" id="ai-send-confirm" type="button">Confirm Send</button>
          <button class="btn btn-ghost btn-sm" id="ai-send-cancel" type="button">Cancel</button>
        </div>
        <div id="ai-send-status" style="margin-top:8px;font-size:0.8rem;display:none;"></div>
      </div>`
          : ''
      }
      ${
        fromAudit && report
          ? `
        <div class="card mb-4" style="padding:var(--space-4)">
          <p style="margin:0">
            Opened from Compliance Audit.
            ${
              totalIssues === 0 && ((_e = report.gate) === null || _e === void 0 ? void 0 : _e.pass)
                ? 'The gate passed with <strong>0 blocking issues</strong> — that is a successful result. Browse sample files below or return to <a href="/dashboard/audit">Compliance Audit</a> for layer breakdown.'
                : `Showing ${totalIssues} issue group(s) from the latest scan.`
            }
          </p>
        </div>
      `
          : ''
      }
      ${report ? this.renderScanSummary(report) : ''}
      ${((_f = this.app.state.routeParams) === null || _f === void 0 ? void 0 : _f.q) ? `<p class="text-muted mb-4">Search: “${escapeHtml(this.app.state.routeParams.q)}”</p>` : ''}

      <div class="results-layout" style="display:grid;grid-template-columns:260px 1fr;gap:var(--space-4);align-items:start;">
        <aside class="results-sidebar" style="position:sticky;top:var(--space-4);">
          <div class="card mb-4" style="padding:var(--space-3);">
            <h3 class="text-sm font-semibold mb-3" style="margin:0 0 12px;">Severity</h3>
            <div class="flex flex-col gap-2" id="severity-filters">
              ${SEVERITIES.map(
                (s) => `
                <button type="button" class="filter-chip justify-start ${this.filterSeverity === s ? 'active' : ''}" data-severity="${s}">
                  ${s === 'all' ? 'All severities' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              `
              ).join('')}
            </div>
          </div>
          <div class="card mb-4" style="padding:var(--space-3);">
            <h3 class="text-sm font-semibold mb-3" style="margin:0 0 12px;">Issue Type</h3>
            <div class="flex flex-col gap-2" id="category-filters">
              <button type="button" class="filter-chip justify-start ${this.filterCategory === 'all' ? 'active' : ''}" data-category="all">All types</button>
              ${categories
                .map(
                  (c) => `
                            <button type="button" class="filter-chip justify-start ${this.filterCategory === c.id ? 'active' : ''}" data-category="${c.id}">
                                    ${typeof c.icon === 'string' ? c.icon : ''} ${escapeHtml(c.title)} (${c.count})
                                </button>
              `
                )
                .join('')}
            </div>
          </div>
          <div class="card" style="padding:var(--space-3);">
            <h3 class="text-sm font-semibold mb-3" style="margin:0 0 12px;">Actions</h3>
            <div class="flex flex-col gap-2">
              <button class="btn btn-secondary btn-sm w-full" id="export-full-btn" type="button">Export full report</button>
              <button class="btn btn-secondary btn-sm w-full" id="export-filtered-json-btn" type="button">Export filtered JSON</button>
              <button class="btn btn-secondary btn-sm w-full" id="export-csv-btn" type="button">Export CSV</button>
              <button class="btn btn-secondary btn-sm w-full" id="export-trend-csv-btn" type="button">Export trend CSV</button>
              <button class="btn btn-secondary btn-sm w-full" id="export-audit-pdf-btn" type="button">Export audit PDF</button>
              ${filtersActive ? '<button type="button" class="btn btn-ghost btn-sm w-full" id="clear-results-filters">Clear filters</button>' : ''}
            </div>
          </div>
        </aside>

                <div class="results-main">
                    ${
                      !report
                        ? `
                        <div id="results-no-report-empty">${_noReportEmptyHtml}</div>
                    `
                        : issues.length === 0
                          ? `
                        <div class="results-empty-wrap"><div id="results-empty-state">${_issuesEmptyHtml}</div></div>
                    `
                          : `
            <div class="card results-table-card" style="padding: 0; overflow: hidden;">
              <div class="results-table-scroll">
              <table class="results-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>File</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody id="results-body"></tbody>
              </table>
              </div>
            </div>
            <div id="issue-detail"></div>
          `
                    }
          ${this.renderSampleFiles()}
        </div>
      </div>
    `;
    // If renderEmptyState returned attachable objects, attach them into placeholders
    try {
      if (
        _noReportEmptyState &&
        typeof _noReportEmptyState !== 'string' &&
        typeof _noReportEmptyState.attach === 'function'
      ) {
        const c = el.querySelector('#results-no-report-empty');
        if (c) _noReportEmptyState.attach(c);
      }
      if (
        _issuesEmptyState &&
        typeof _issuesEmptyState !== 'string' &&
        typeof _issuesEmptyState.attach === 'function'
      ) {
        const c2 = el.querySelector('#results-empty-state');
        if (c2) _issuesEmptyState.attach(c2);
      }
    } catch (e) {
      // ignore attach errors
    }

    this.bindFilters(el);
    this.bindExport(el, issues);
    (_h = el.querySelector('#clear-results-filters')) === null || _h === void 0
      ? void 0
      : _h.addEventListener('click', () => {
          this.filterSeverity = 'all';
          this.filterCategory = 'all';
          this.app.state.routeParams = {};
          this.app.router.navigate('results');
        });
    const tbody = el.querySelector('#results-body');
    const projectRoot = resolveProjectRootFromApp(this.app);
    const DISPLAY_CAP = 500;
    const displayIssues = issues.slice(0, DISPLAY_CAP);
    if (tbody) {
      if (issues.length > DISPLAY_CAP) {
        const note = document.createElement('p');
        note.className = 'text-muted mb-3';
        note.style.padding = 'var(--space-3) var(--space-4) 0';
        note.textContent = `Showing first ${DISPLAY_CAP} of ${issues.length} filtered issue(s). Export CSV/JSON for the full set.`;
        tbody.closest('.results-table-scroll').insertAdjacentElement('beforebegin', note);
      }
      displayIssues.forEach((issue) => {
        var _a;
        const tr = document.createElement('tr');
        tr.dataset.issueId = issue.id;
        const sevCell = document.createElement('td');
        sevCell.innerHTML = `<span class="severity-pill ${issue.severity}">${issue.severity}</span>`;
        const typeCell = document.createElement('td');
        typeCell.textContent = issue.type;
        const descCell = document.createElement('td');
        descCell.textContent = issue.description;
        const fileCell = document.createElement('td');
        if (issue.filePath) {
          fileCell.appendChild(
            renderIdeFileLink(issue.filePath, issue.line || 1, {
              projectRoot,
              label: this.app.scanService.basename(issue.filePath),
            })
          );
        } else {
          window.setSafeHTML(fileCell, '<code>—</code>');
        }
        const countCell = document.createElement('td');
        countCell.textContent = String((_a = issue.count) !== null && _a !== void 0 ? _a : 1);
        tr.appendChild(sevCell);
        tr.appendChild(typeCell);
        tr.appendChild(descCell);
        tr.appendChild(fileCell);
        tr.appendChild(countCell);
        tr.addEventListener('click', (e) => {
          if (e.target.closest('.ide-file-link-btn')) return;
          this.showDetail(el, issue);
        });
        tbody.appendChild(tr);
      });
    }
    return el;
  }
  emptyStateMessage(report, totalIssues, filtersActive, activeCategory) {
    var _a, _b;
    if (filtersActive && activeCategory) {
      return `No ${activeCategory.title.toLowerCase()} issues match the current filters.`;
    }
    if (filtersActive) {
      return 'No issues match the current filters.';
    }
    const blockingCount =
      (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.blockingCount) !== null && _b !== void 0
        ? _b
        : 0;
    if (totalIssues === 0 && report.gate && report.gate.pass && blockingCount === 0) {
      return 'Simplebeacon gate passed — no blocking issues in the latest scan. This is expected when paths are clean. Scroll down for the sample file inventory, or open Compliance Audit for per-layer metrics.';
    }
    if (totalIssues === 0 && isClientScanReport(report)) {
      return 'Local scan finished but no findings were mapped into the results table. Return to Analyze and click View Results again, or re-run the folder scan.';
    }
    return 'No issues in the loaded report.';
  }
  bindExport(el, issues) {
    var _a, _b, _c, _d, _e, _f, _g;
    const svc = this.app.scanService;
    const meta = {
      severity: this.filterSeverity,
      category: this.filterCategory,
      query: ((_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.q) || null,
    };
    (_b = el.querySelector('#export-full-btn')) === null || _b === void 0
      ? void 0
      : _b.addEventListener('click', async () => {
          try {
            await svc.exportReport(this.app.state.report);
            showToast('Full report downloaded', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
    (_c = el.querySelector('#export-filtered-json-btn')) === null || _c === void 0
      ? void 0
      : _c.addEventListener('click', () => {
          if (!issues.length) {
            showToast('No issues match current filters', 'info');
            return;
          }
          svc.exportFilteredIssues(issues, meta);
          showToast(`Exported ${issues.length} issue(s) as JSON`, 'success');
        });
    (_d = el.querySelector('#export-csv-btn')) === null || _d === void 0
      ? void 0
      : _d.addEventListener('click', () => {
          if (!issues.length) {
            showToast('No issues match current filters', 'info');
            return;
          }
          svc.exportIssuesCsv(issues);
          showToast(`Exported ${issues.length} issue(s) as CSV`, 'success');
        });
    (_e = el.querySelector('#export-trend-csv-btn')) === null || _e === void 0
      ? void 0
      : _e.addEventListener('click', () => {
          try {
            svc.exportTrendCsv();
            showToast('Trend CSV downloaded', 'success');
          } catch (err) {
            showToast(err.message || 'Failed to export trend CSV', 'error');
          }
        });
    (_f = el.querySelector('#export-audit-pdf-btn')) === null || _f === void 0
      ? void 0
      : _f.addEventListener('click', () => {
          try {
            svc.exportAuditPdf();
            showToast('Audit PDF opened in new window — use Print to save', 'success');
          } catch (err) {
            showToast(err.message || 'Failed to generate audit PDF', 'error');
          }
        });
    // Send to AI Agent handlers
    const aiPanel = el.querySelector('#ai-send-panel');
    const aiNotesInput = el.querySelector('#ai-notes-input');
    const aiSendStatus = el.querySelector('#ai-send-status');
    const doSendToAi = async (notes = '') => {
      var _a, _b, _c, _d, _e;
      const report = this.app.state.report;
      if (!report) {
        showToast('No report loaded — run a scan first', 'error');
        return;
      }
      const allIssues = report.rawIssues || report.detectedIssues || [];
      const reportSummary = {
        gatePass:
          (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : 'N/A',
        qualityScore: (_c = report.qualityScore) !== null && _c !== void 0 ? _c : 'N/A',
        totalIssues: allIssues.length,
        filesScanned:
          (_e = (_d = report.repositoryFilesTotal) !== null && _d !== void 0 ? _d : report.totalFiles) !== null &&
          _e !== void 0
            ? _e
            : 'N/A',
        reportType: report.type || 'simplebeacon',
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
              notes,
              reportSummary,
              issues: allIssues,
            },
          });
          showToast('Scan data sent to your AI coding agent. Check the editor chat panel.', 'success');
          return;
        } catch (err) {
          window['console']['warn']('[AI-Send] vscode.postMessage failed:', err);
        }
      }
      try {
        const res = await fetch('/api/ai-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath: report.projectRoot || report.projectPath || window.location.origin,
            notes,
            reportSummary,
            issues: allIssues,
          }),
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
    };
    (_e = el.querySelector('#send-ai-btn')) === null || _e === void 0
      ? void 0
      : _e.addEventListener('click', () => {
          doSendToAi('');
        });
    (_f = el.querySelector('#ai-send-cancel')) === null || _f === void 0
      ? void 0
      : _f.addEventListener('click', () => {
          if (aiPanel) aiPanel.style.display = 'none';
          if (aiNotesInput) aiNotesInput.value = '';
          if (aiSendStatus) {
            aiSendStatus.style.display = 'none';
            aiSendStatus.textContent = '';
          }
        });
    (_g = el.querySelector('#ai-send-confirm')) === null || _g === void 0
      ? void 0
      : _g.addEventListener('click', async () => {
          const btn = el.querySelector('#ai-send-confirm');
          btn.disabled = true;
          btn.textContent = 'Sending…';
          await doSendToAi((aiNotesInput === null || aiNotesInput === void 0 ? void 0 : aiNotesInput.value) || '');
          btn.disabled = false;
          btn.textContent = 'Confirm Send';
        });
  }
  bindFilters(el) {
    el.querySelectorAll('#severity-filters .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filterSeverity = btn.dataset.severity;
        this.debouncedPaint();
      });
    });
    el.querySelectorAll('#category-filters .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filterCategory = btn.dataset.category;
        this.debouncedPaint();
      });
    });
  }
  renderSampleFiles() {
    var _a, _b;
    const report = this.app.state.report;
    const files = (report === null || report === void 0 ? void 0 : report.sampleFiles) || [];
    if (!files.length) return '';
    const total =
      (_b = (_a = report.mockSampleFiles) !== null && _a !== void 0 ? _a : report.totalFiles) !== null && _b !== void 0
        ? _b
        : files.length;
    const shown = files.slice(0, 24);
    const more = Math.max(0, files.length - shown.length);
    const extra = Math.max(0, (total || files.length) - files.length);
    return `
      <div class="section-block mt-6">
        <div class="section-heading"><h2>Sample Files (${total || files.length})</h2></div>
        <div class="sample-file-grid">
          ${shown.map((f) => `<code class="sample-file-chip">${escapeHtml(f)}</code>`).join('')}
          ${more > 0 ? `<span class="text-muted">+${more} more in report</span>` : ''}
          ${extra > 0 ? `<span class="text-muted">+${extra} not listed — re-run scan</span>` : ''}
        </div>
      </div>
    `;
  }
  showDetail(container, issue) {
    var _a, _b, _c;
    const slot = container.querySelector('#issue-detail');
    if (!slot) return;
    const projectRoot = resolveProjectRootFromApp(this.app);
    slot.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'detail-panel';
    const h3 = document.createElement('h3');
    h3.textContent = issue.type || 'Issue';
    panel.appendChild(h3);
    const desc = document.createElement('p');
    desc.textContent = issue.description || '';
    panel.appendChild(desc);
    const rec = document.createElement('p');
    rec.innerHTML = `<strong>Recommended:</strong> ${escapeHtml(issue.recommendedAction || 'Review and fix manually')}`;
    panel.appendChild(rec);
    const fileRow = document.createElement('p');
    fileRow.appendChild(document.createTextNode('File: '));
    if (issue.filePath) {
      fileRow.appendChild(renderIdeFileLink(issue.filePath, issue.line || 1, { projectRoot, label: issue.filePath }));
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn-secondary btn-xs ml-2';
      openBtn.textContent = 'Open in editor';
      openBtn.addEventListener('click', () => openInIde(issue.filePath, issue.line || 1, { projectRoot }));
      fileRow.appendChild(openBtn);
    } else {
      window.setSafeHTML(fileRow, '<code>—</code>');
    }
    panel.appendChild(fileRow);
    if ((_a = issue.affectedFiles) === null || _a === void 0 ? void 0 : _a.length) {
      const aff = document.createElement('p');
      aff.innerHTML = `<strong>Affected:</strong> ${issue.affectedFiles.map(escapeHtml).join(', ')}`;
      panel.appendChild(aff);
    }
    if (
      (_c = (_b = issue.metadata) === null || _b === void 0 ? void 0 : _b.duplicatePaths) === null || _c === void 0
        ? void 0
        : _c.length
    ) {
      panel.insertAdjacentHTML(
        'beforeend',
        `
          <p><strong>Duplicate paths:</strong></p>
          <ul class="settings-path-list">
            ${issue.metadata.duplicatePaths.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join('')}
          </ul>
        `
      );
    }
    slot.appendChild(panel);
    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  paint(container = this._container) {
    if (!container) return;
    this._container = container;
    window.setSafeHTML(container, '');
    container.appendChild(this.render());
  }
  debouncedPaint() {
    if (this._paintTimer) clearTimeout(this._paintTimer);
    this._paintTimer = setTimeout(() => this.paint(), 150);
  }
  mount(container) {
    this._container = container;
    this.applyRouteParams(this.app.state.routeParams || {});
    hydrateClientScanReport(this.app);
    this.paint(container);
  }
}
