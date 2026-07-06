import { escapeHtml, showToast, formatPercent, formatNumber, renderEmptyState, apiUrl } from '../utils.js';
import { getScanFileMetrics, resolveDisplayScore } from '../services/analyzeService.js';
import { authService } from '../services/authService.js';
const SEVERITIES = ['all', 'high', 'medium', 'low'];
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
    }
    applyRouteParams(params = {}) {
        this.filterSeverity = params.q ? 'all' : 'all';
        this.filterCategory = params.filter || 'all';
    }
    getFilteredIssues() {
        var _a, _b;
        const report = this.app.state.report;
        const source = (_a = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _a !== void 0 ? _a : report === null || report === void 0 ? void 0 : report.detectedIssues;
        if (!(source === null || source === void 0 ? void 0 : source.length))
            return [];
        let issues = source.map((issue, index) => {
            var _a, _b, _c, _d, _e;
            return ({
                ...issue,
                id: issue.id || `${issue.severity}|${issue.type}|${issue.description}|${index}`,
                filePaths: issue.filePaths || ((_a = issue.metadata) === null || _a === void 0 ? void 0 : _a.duplicatePaths) || (issue.filePath ? [issue.filePath] : []),
                filePath: issue.filePath || ((_b = issue.filePaths) === null || _b === void 0 ? void 0 : _b[0]) || ((_d = (_c = issue.metadata) === null || _c === void 0 ? void 0 : _c.duplicatePaths) === null || _d === void 0 ? void 0 : _d[0]) || ((_e = issue.affectedFiles) === null || _e === void 0 ? void 0 : _e[0])
            });
        });
        const query = (_b = this.app.state.routeParams) === null || _b === void 0 ? void 0 : _b.q;
        if (query) {
            const q = query.toLowerCase();
            issues = issues.filter((i) => {
                var _a, _b, _c;
                return ((_a = i.type) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) ||
                    ((_b = i.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(q)) ||
                    ((_c = i.filePath) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(q));
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
        var _a, _b, _c, _d, _e;
        if (!report)
            return '';
        const metrics = getScanFileMetrics(report);
        const gateLabel = ((_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) ? 'PASS' : report.gate ? 'REVIEW' : '—';
        const gateClass = ((_b = report.gate) === null || _b === void 0 ? void 0 : _b.pass) ? 'success' : 'warning';
        const sev = (report === null || report === void 0 ? void 0 : report.severityCounts) || {};
        const critical = sev.critical || 0;
        const high = sev.high || 0;
        const medium = sev.medium || 0;
        const low = sev.low || 0;
        const info = sev.info || 0;
        const totalIssues = critical + high + medium + low + info;
        const maxBar = Math.max(1, totalIssues);
        const scanDate = report.scanDate || report.timestamp || report.createdAt;
        const dateText = scanDate ? new Date(scanDate).toLocaleString() : 'Unknown date';
        return `
      <div class="results-summary-v2">
        <div class="results-summary-meta">
          <div class="results-summary-gate ${gateClass}">
            <i data-lucide="shield-check" class="icon-20"></i>
            <span>${gateLabel}</span>
          </div>
          <div class="results-summary-info">
            <div class="results-summary-date"><i data-lucide="calendar" class="icon-14"></i> ${escapeHtml(dateText)}</div>
            <div class="results-summary-files"><i data-lucide="files" class="icon-14"></i> ${formatNumber((_e = (_d = (_c = metrics.repositoryFiles) !== null && _c !== void 0 ? _c : metrics.mockSampleFiles) !== null && _d !== void 0 ? _d : report.totalFiles) !== null && _e !== void 0 ? _e : 0)} files scanned</div>
          </div>
        </div>
        <div class="results-summary-stats">
          <div class="results-summary-stat critical"><span class="rsv-count">${critical}</span><span class="rsv-label">Critical</span></div>
          <div class="results-summary-stat high"><span class="rsv-count">${high}</span><span class="rsv-label">High</span></div>
          <div class="results-summary-stat medium"><span class="rsv-count">${medium}</span><span class="rsv-label">Medium</span></div>
          <div class="results-summary-stat low"><span class="rsv-count">${low}</span><span class="rsv-label">Low</span></div>
          <div class="results-summary-stat info"><span class="rsv-count">${info}</span><span class="rsv-label">Info</span></div>
        </div>
        <div class="results-summary-bar">
          ${critical ? `<div class="rsv-bar-segment critical" style="width:${(critical / maxBar * 100).toFixed(1)}%"></div>` : ''}
          ${high ? `<div class="rsv-bar-segment high" style="width:${(high / maxBar * 100).toFixed(1)}%"></div>` : ''}
          ${medium ? `<div class="rsv-bar-segment medium" style="width:${(medium / maxBar * 100).toFixed(1)}%"></div>` : ''}
          ${low ? `<div class="rsv-bar-segment low" style="width:${(low / maxBar * 100).toFixed(1)}%"></div>` : ''}
          ${info ? `<div class="rsv-bar-segment info" style="width:${(info / maxBar * 100).toFixed(1)}%"></div>` : ''}
        </div>
        <div class="results-summary-score">
          <span class="text-muted">Consistency</span>
          <strong>${formatPercent(resolveDisplayScore(report))}</strong>
        </div>
      </div>
    `;
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const report = this.app.state.report;
        const issues = this.getFilteredIssues();
        const categories = this.app.scanService.getIssueCategories(report);
        const totalIssues = ((_b = (_a = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _a !== void 0 ? _a : report === null || report === void 0 ? void 0 : report.detectedIssues) !== null && _b !== void 0 ? _b : []).reduce((sum, i) => sum + (i.count || 1), 0);
        const activeCategory = categories.find((c) => c.id === this.filterCategory);
        const filtersActive = this.filterSeverity !== 'all'
            || this.filterCategory !== 'all'
            || Boolean((_c = this.app.state.routeParams) === null || _c === void 0 ? void 0 : _c.q);
        const fromAudit = ((_d = this.app.state.routeParams) === null || _d === void 0 ? void 0 : _d.from) === 'audit';
        const el = document.createElement('div');
        el.className = 'fade-in results-modern';
        const vscode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
            ? window.acquireVsCodeApi()
            : null;
        el.innerHTML = `
      <style>
        .vscode-deep-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 6px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          cursor: pointer;
          transition: background var(--transition), border-color var(--transition), color var(--transition);
          text-decoration: none;
          max-width: 100%;
          overflow: hidden;
        }
        .vscode-deep-link-btn:hover { background: var(--surface-hover); border-color: var(--primary); color: var(--text-primary); }
        .vscode-deep-link-btn i { color: var(--primary); flex-shrink: 0; }
        .vscode-deep-link-btn .path-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .issue-result-file-row { display: flex; align-items: center; }
        .detail-code.vscode-deep-link-btn { display: inline-flex; margin-top: 4px; }
      </style>
      <div class="results-header-modern">
        <div class="results-header-content">
          <h1 class="page-title">All Issues</h1>
          <p class="results-subtitle">${report ? escapeHtml(report.projectRoot || report.projectPath || 'Scan results') : 'No report loaded'}</p>
        </div>
        <div class="results-header-actions">
          ${authService.isPaidTier() ? `<button class="btn btn-ghost btn-sm" id="export-full-btn" type="button"><i data-lucide="download" class="icon-16"></i> Export</button>` : ''}
          <button class="btn btn-primary btn-sm" id="send-ai-btn" type="button"><i data-lucide="bot" class="icon-16"></i> Send to AI</button>
        </div>
      </div>

      <div id="ai-send-panel" class="panel-modern panel-accent" style="display:none; margin-bottom: var(--space-4);">
        <div class="panel-header-modern"><h3>Send to AI Agent</h3></div>
        <p style="font-size:var(--font-size-sm);color:var(--text-muted);margin:0 0 8px;">Add notes for the AI agent (optional):</p>
        <textarea id="ai-notes-input" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text-primary);font-family:var(--font-mono);font-size:var(--font-size-sm);resize:vertical;" placeholder="e.g., 'Focus on critical credential leaks first, ignore test files...'"></textarea>
        <div class="flex gap-2 mt-2">
          <button class="btn btn-primary btn-sm" id="ai-send-confirm" type="button">Confirm Send</button>
          <button class="btn btn-ghost btn-sm" id="ai-send-cancel" type="button">Cancel</button>
        </div>
        <div id="ai-send-status" style="margin-top:8px;font-size:var(--font-size-sm);display:none;"></div>
      </div>

      ${fromAudit && report ? `
        <div class="panel-modern" style="margin-bottom: var(--space-4);">
          <p style="margin:0;font-size:var(--font-size-sm);color:var(--text-secondary);">
            Opened from Compliance Audit.
            ${totalIssues === 0 && ((_e = report.gate) === null || _e === void 0 ? void 0 : _e.pass)
            ? 'The gate passed with <strong>0 blocking issues</strong> — that is a successful result. Browse sample files below or return to <a href="/dashboard/audit">Compliance Audit</a> for layer breakdown.'
            : `Showing ${totalIssues} issue group(s) from the latest scan.`}
          </p>
        </div>
      ` : ''}

      ${report ? this.renderScanSummary(report) : ''}
      ${((_f = this.app.state.routeParams) === null || _f === void 0 ? void 0 : _f.q) ? `<p class="text-muted" style="margin-bottom:var(--space-4)">Search: "${escapeHtml(this.app.state.routeParams.q)}"</p>` : ''}

      <div class="results-search-modern">
        <input type="text" class="results-search-input" id="results-search-input" placeholder="Search issues by type, description, or file path…" value="${escapeHtml(((_g = this.app.state.routeParams) === null || _g === void 0 ? void 0 : _g.q) || '')}" />
        <button class="results-search-clear" id="results-search-clear" type="button">Clear</button>
      </div>

      <div class="results-filters-modern">
        <div class="results-filter-group" id="severity-filters">
          ${SEVERITIES.map((s) => `
            <button type="button" class="filter-chip-modern ${this.filterSeverity === s ? 'active' : ''}" data-severity="${s}">
              ${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          `).join('')}
        </div>
        <div class="results-filter-group" id="category-filters">
          <button type="button" class="filter-chip-modern ${this.filterCategory === 'all' ? 'active' : ''}" data-category="all">All types</button>
          ${categories.map((c) => `
            <button type="button" class="filter-chip-modern ${this.filterCategory === c.id ? 'active' : ''}" data-category="${c.id}">
              ${c.icon} ${escapeHtml(c.title)} (${c.count})
            </button>
          `).join('')}
        </div>
      </div>

      ${!report ? `
        ${renderEmptyState({
            icon: '📋',
            title: 'No scan report loaded yet',
            body: 'Run a Simplebeacon or Complete scan to see detected issues here.',
            iconWrapper: 'emoji',
            actions: [{ id: 'run-scan-empty', label: 'Run Scan', className: 'btn-primary btn-sm' }]
        })}
      ` : issues.length === 0 ? `
        ${renderEmptyState({
            icon: totalIssues === 0 && ((_h = report.gate) === null || _h === void 0 ? void 0 : _h.pass) && !filtersActive ? '✅' : '🔍',
            title: this.emptyStateMessage(report, totalIssues, filtersActive, activeCategory),
            body: this.emptyStateBody(report, totalIssues, filtersActive, activeCategory),
            iconWrapper: 'emoji',
            actions: filtersActive && totalIssues > 0
                ? [
                    { id: 'clear-results-filters', label: 'Show all issues', className: 'btn-primary btn-sm' },
                    ...(this.filterCategory !== 'all' ? [{ id: 'clear-category-filter', label: `Clear ${escapeHtml((activeCategory === null || activeCategory === void 0 ? void 0 : activeCategory.title) || 'filter')}`, className: 'btn-secondary btn-sm' }] : [])
                ]
                : filtersActive
                    ? [{ id: 'clear-results-filters', label: 'Clear filters', className: 'btn-secondary btn-sm' }]
                    : (totalIssues === 0 && ((_j = report.gate) === null || _j === void 0 ? void 0 : _j.pass) ? [] : [{ id: 'run-scan-empty', label: 'Run Scan', className: 'btn-primary btn-sm' }])
        })}
      ` : `
        <div class="issue-results-list" id="results-body"></div>
        <div id="issue-detail"></div>
      `}

      ${this.renderSampleFiles()}
    `;
        this.bindFilters(el);
        this.bindExport(el, issues);
        (_k = el.querySelector('#clear-results-filters')) === null || _k === void 0 ? void 0 : _k.addEventListener('click', () => {
            this.filterSeverity = 'all';
            this.filterCategory = 'all';
            this.app.state.routeParams = {};
            this.app.router.navigate('results');
        });
        (_l = el.querySelector('#clear-category-filter')) === null || _l === void 0 ? void 0 : _l.addEventListener('click', () => {
            this.filterCategory = 'all';
            const params = { ...(this.app.state.routeParams || {}) };
            delete params.filter;
            delete params.q;
            this.app.state.routeParams = params;
            this.app.router.navigate('results', params);
        });
        const list = el.querySelector('#results-body');
        if (list) {
            const categories = this.app.scanService.getIssueCategories(report);
            issues.forEach((issue) => {
                const card = document.createElement('div');
                const severityClass = issue.severity || 'low';
                card.className = `issue-result-card ${severityClass}`;
                card.dataset.issueId = issue.id;
                const filePath = issue.filePath || '';
                const fileName = this.app.scanService.basename(filePath) || '';
                const line = issue.line ? `:${issue.line}` : '';
                const relativePath = filePath ? filePath.replace(/^.*[\\/]/, '') !== filePath ? filePath : fileName : '';
                const category = categories.find((c) => { var _a; return (_a = c.filter) === null || _a === void 0 ? void 0 : _a.call(c, issue); }) || { icon: '📁', title: issue.type || 'Finding' };
                const displayPath = line ? `${escapeHtml(relativePath)}${escapeHtml(line)}` : escapeHtml(relativePath);
                card.innerHTML = `
          <div class="issue-result-header">
            <span class="issue-result-type" title="${escapeHtml(category.title)}">${category.icon} ${escapeHtml(category.title)}</span>
            <span class="issue-result-severity severity-pill ${severityClass}">${severityClass}</span>
          </div>
          <div class="issue-result-desc">${escapeHtml(issue.description)}</div>
          <div class="issue-result-file-row">
            <button type="button" class="vscode-deep-link-btn" data-file="${escapeHtml(filePath)}" data-line="${issue.line || 1}" title="Open in editor">
              <i data-lucide="external-link" class="icon-12"></i>
              <span class="path-text">${displayPath}</span>
            </button>
          </div>
        `;
                card.addEventListener('click', () => this.showDetail(el, issue));
                list.appendChild(card);
            });
        }
        this._bindDeepLinkEvents(el, vscode);
        return el;
    }
    _bindDeepLinkEvents(el, vscode) {
        if (!el)
            return;
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('.vscode-deep-link-btn');
            if (!btn)
                return;
            e.stopPropagation();
            const filePath = btn.getAttribute('data-file');
            const line = parseInt(btn.getAttribute('data-line'), 10) || 1;
            if (!filePath)
                return;
            if (vscode) {
                vscode.postMessage({ command: 'openFile', filePath, line });
            }
            else {
                // Fallback when running in a standalone browser preview
                console.warn(`[Results] Deep link not available outside VS Code extension: ${filePath}:${line}`);
            }
        });
    }
    emptyStateMessage(report, totalIssues, filtersActive, activeCategory) {
        var _a;
        if (filtersActive && totalIssues > 0) {
            return activeCategory
                ? `No ${activeCategory.title.toLowerCase()} issues match the current filters`
                : 'No issues match the current filters';
        }
        if (filtersActive) {
            return 'No issues match the current filters.';
        }
        if (totalIssues === 0 && ((_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass)) {
            return 'Simplebeacon gate passed — no blocking issues';
        }
        return 'No issues in the loaded report.';
    }
    emptyStateBody(report, totalIssues, filtersActive, activeCategory) {
        var _a;
        if (filtersActive && totalIssues > 0) {
            return activeCategory
                ? `The report contains ${totalIssues} issue${totalIssues === 1 ? '' : 's'} total, but none are in the ${activeCategory.title.toLowerCase()} category. Try showing all issues or pick a different filter.`
                : `The report contains ${totalIssues} issue${totalIssues === 1 ? '' : 's'} total, but none match your current search or severity filter. Try clearing the filters.`;
        }
        if (filtersActive) {
            return 'Try adjusting your severity or search filters to see more results.';
        }
        if (totalIssues === 0 && ((_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass)) {
            return 'Your latest scan completed successfully and the gate passed. The sample file inventory is shown below, and you can review layer metrics in Compliance Audit.';
        }
        return 'The loaded report does not contain any issues. Run a new scan to detect problems.';
    }
    bindExport(el, issues) {
        var _a, _b, _c, _d, _e, _f, _g;
        const svc = this.app.scanService;
        const meta = {
            severity: this.filterSeverity,
            category: this.filterCategory,
            query: ((_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.q) || null
        };
        (_b = el.querySelector('#export-full-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', async () => {
            try {
                await svc.exportReport(this.app.state.report);
                showToast('Full report downloaded', 'success');
            }
            catch (err) {
                showToast(err.message, 'error');
            }
        });
        (_c = el.querySelector('#export-filtered-json-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            if (!issues.length) {
                showToast('No issues match current filters', 'info');
                return;
            }
            svc.exportFilteredIssues(issues, meta);
            showToast(`Exported ${issues.length} issue(s) as JSON`, 'success');
        });
        (_d = el.querySelector('#export-csv-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            if (!issues.length) {
                showToast('No issues match current filters', 'info');
                return;
            }
            svc.exportIssuesCsv(issues);
            showToast(`Exported ${issues.length} issue(s) as CSV`, 'success');
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
                gatePass: (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : 'N/A',
                qualityScore: (_c = report.qualityScore) !== null && _c !== void 0 ? _c : 'N/A',
                totalIssues: allIssues.length,
                filesScanned: (_e = (_d = report.repositoryFilesTotal) !== null && _d !== void 0 ? _d : report.totalFiles) !== null && _e !== void 0 ? _e : 'N/A',
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
                            notes,
                            reportSummary,
                            issues: allIssues
                        }
                    });
                    showToast('Scan data copied to clipboard and IDE chat panel opened. Paste to start the conversation.', 'success');
                    return;
                }
                catch (err) {
                    console.warn('[AI-Send] vscode.postMessage failed:', err);
                }
            }
            try {
                const res = await fetch(apiUrl('/api/ai-context'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath: report.projectRoot || report.projectPath || window.location.origin,
                        notes,
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
                        }
                        catch (clipErr) {
                            showToast('AI context saved. Use sidebar 🤖 button or mention @.simplebeacon/ai-context.md', 'success');
                        }
                    }
                    else {
                        showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
                    }
                }
                else {
                    showToast('Failed: ' + (json.error || 'Unknown'), 'error');
                }
            }
            catch (err) {
                showToast('Network error: ' + err.message, 'error');
            }
        };
        (_e = el.querySelector('#send-ai-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            if (aiPanel) {
                aiPanel.style.display = aiPanel.style.display === 'none' ? 'block' : 'none';
            }
            if ((aiPanel === null || aiPanel === void 0 ? void 0 : aiPanel.style.display) === 'block' && aiNotesInput) {
                aiNotesInput.focus();
            }
        });
        (_f = el.querySelector('#ai-send-cancel')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => {
            if (aiPanel)
                aiPanel.style.display = 'none';
            if (aiNotesInput)
                aiNotesInput.value = '';
            if (aiSendStatus) {
                aiSendStatus.style.display = 'none';
                aiSendStatus.textContent = '';
            }
        });
        (_g = el.querySelector('#ai-send-confirm')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', async () => {
            const btn = el.querySelector('#ai-send-confirm');
            btn.disabled = true;
            btn.textContent = 'Sending…';
            await doSendToAi((aiNotesInput === null || aiNotesInput === void 0 ? void 0 : aiNotesInput.value) || '');
            btn.disabled = false;
            btn.textContent = 'Confirm Send';
        });
    }
    bindFilters(el) {
        el.querySelectorAll('#severity-filters .filter-chip-modern').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.filterSeverity = btn.dataset.severity;
                this.paint();
            });
        });
        el.querySelectorAll('#category-filters .filter-chip-modern').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.filterCategory = btn.dataset.category;
                this.paint();
            });
        });
        const searchInput = el.querySelector('#results-search-input');
        const searchClear = el.querySelector('#results-search-clear');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = searchInput.value.trim();
                    this.app.state.routeParams = { ...(this.app.state.routeParams || {}), q: q || undefined };
                    if (!q)
                        delete this.app.state.routeParams.q;
                    this.app.router.navigate('results', this.app.state.routeParams);
                }
            });
            searchInput.addEventListener('input', () => {
                if (searchInput.value.trim() === '') {
                    const params = this.app.state.routeParams || {};
                    delete params.q;
                    this.app.router.navigate('results', params);
                }
            });
        }
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                delete (this.app.state.routeParams || {}).q;
                this.app.router.navigate('results', this.app.state.routeParams);
            });
        }
        el.querySelectorAll('#run-scan-empty').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.app.router.navigate('analyze');
            });
        });
    }
    renderSampleFiles() {
        var _a, _b;
        const report = this.app.state.report;
        const files = (report === null || report === void 0 ? void 0 : report.sampleFiles) || [];
        if (!files.length)
            return '';
        const total = (_b = (_a = report.mockSampleFiles) !== null && _a !== void 0 ? _a : report.totalFiles) !== null && _b !== void 0 ? _b : files.length;
        const shown = files.slice(0, 24);
        const more = Math.max(0, files.length - shown.length);
        const extra = Math.max(0, (total || files.length) - files.length);
        return `
      <div class="panel-modern sample-files-panel">
        <div class="panel-header-modern"><h3>Sample Files (${total || files.length})</h3></div>
        <div class="sample-file-grid-modern">
          ${shown.map((f) => `<code class="sample-file-chip-modern">${escapeHtml(f)}</code>`).join('')}
          ${more > 0 ? `<span class="sample-files-meta">+${more} more in report</span>` : ''}
          ${extra > 0 ? `<span class="sample-files-meta">+${extra} not listed — re-run scan</span>` : ''}
        </div>
      </div>
    `;
    }
    showDetail(container, issue) {
        var _a, _b, _c;
        const slot = container.querySelector('#issue-detail');
        if (!slot)
            return;
        const detailLine = issue.line || 1;
        const detailDisplay = issue.line ? `${escapeHtml(issue.filePath)}:${issue.line}` : escapeHtml(issue.filePath);
        slot.innerHTML = `
      <div class="panel-modern detail-panel-modern">
        <div class="panel-header-modern"><h3>${escapeHtml(issue.type)}</h3></div>
        <p class="detail-desc">${escapeHtml(issue.description)}</p>
        <div class="detail-meta-row"><span class="detail-meta-label">Recommended</span><span class="detail-meta-value">${escapeHtml(issue.recommendedAction || 'Review and fix manually')}</span></div>
        <div class="detail-meta-row"><span class="detail-meta-label">File</span>
          <button type="button" class="vscode-deep-link-btn detail-code" data-file="${escapeHtml(issue.filePath)}" data-line="${detailLine}" title="Open in editor">
            <i data-lucide="external-link" class="icon-12"></i>
            <span class="path-text">${detailDisplay}</span>
          </button>
        </div>
        ${((_a = issue.affectedFiles) === null || _a === void 0 ? void 0 : _a.length) ? `<div class="detail-meta-row"><span class="detail-meta-label">Affected</span><span class="detail-meta-value">${issue.affectedFiles.map(escapeHtml).join(', ')}</span></div>` : ''}
        ${((_c = (_b = issue.metadata) === null || _b === void 0 ? void 0 : _b.duplicatePaths) === null || _c === void 0 ? void 0 : _c.length) ? `
          <div class="detail-meta-row"><span class="detail-meta-label">Duplicate paths</span></div>
          <ul class="detail-path-list">
            ${issue.metadata.duplicatePaths.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
        slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    paint(container = this._container) {
        if (!container)
            return;
        this._container = container;
        container.innerHTML = '';
        container.appendChild(this.render());
    }
    mount(container) {
        this._container = container;
        this.applyRouteParams(this.app.state.routeParams || {});
        this.paint(container);
    }
}
