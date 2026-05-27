import { escapeHtml, showToast, formatPercent } from '../utils.js';
import { getScanFileMetrics, resolveDisplayScore } from '../services/analyzeService.js';

const SEVERITIES = ['all', 'high', 'medium', 'low'];

function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString();
}

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
    const report = this.app.state.report;
    const source = report?.rawIssues ?? report?.detectedIssues;
    if (!source?.length) return [];

    let issues = source.map((issue, index) => ({
      ...issue,
      id: issue.id || `${issue.severity}|${issue.type}|${issue.description}|${index}`,
      filePaths: issue.filePaths || issue.metadata?.duplicatePaths || (issue.filePath ? [issue.filePath] : []),
      filePath: issue.filePath || issue.filePaths?.[0] || issue.metadata?.duplicatePaths?.[0] || issue.affectedFiles?.[0]
    }));
    const query = this.app.state.routeParams?.q;

    if (query) {
      const q = query.toLowerCase();
      issues = issues.filter(
        (i) =>
          i.type?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.filePath?.toLowerCase().includes(q)
      );
    }

    if (this.filterSeverity !== 'all') {
      issues = issues.filter((i) => i.severity === this.filterSeverity);
    }

    if (this.filterCategory !== 'all') {
      const cats = this.app.scanService.getIssueCategories(report);
      const cat = cats.find((c) => c.id === this.filterCategory);
      if (cat?.filter) {
        issues = issues.filter(cat.filter);
      }
    }

    return issues;
  }

  renderScanSummary(report) {
    if (!report) return '';
    const metrics = getScanFileMetrics(report);
    const gateLabel = report.gate?.pass ? 'PASS' : report.gate ? 'REVIEW' : '—';
    const gateClass = report.gate?.pass ? 'pass' : 'warn';
    return `
      <div class="metrics-row mb-4">
        <div class="metric-chip gate-badge ${gateClass}">${gateLabel}</div>
        <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
        <div class="metric-chip"><strong>${formatCount(metrics.mockSampleFiles ?? report.totalFiles)}</strong> mock/sample</div>
        ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatCount(metrics.repositoryFiles)}</strong> repo files</div>` : ''}
        <div class="metric-chip"><strong>${formatCount(metrics.ruleScopedFilesAnalyzed ?? metrics.credentialScanned)}</strong> gate rules checked</div>
        <div class="metric-chip"><strong>${formatPercent(report.schemaCompliance)}</strong> schema</div>
        <div class="metric-chip"><strong>${report.issueCount ?? 0}</strong> issue groups</div>
      </div>
    `;
  }

  render() {
    const report = this.app.state.report;
    const issues = this.getFilteredIssues();
    const categories = this.app.scanService.getIssueCategories(report);
    const totalIssues = (report?.rawIssues ?? report?.detectedIssues ?? []).reduce(
      (sum, i) => sum + (i.count || 1),
      0
    );
    const activeCategory = categories.find((c) => c.id === this.filterCategory);
    const filtersActive = this.filterSeverity !== 'all'
      || this.filterCategory !== 'all'
      || Boolean(this.app.state.routeParams?.q);
    const fromAudit = this.app.state.routeParams?.from === 'audit';

    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <div class="section-heading mb-4">
        <h1 class="page-title" style="margin:0">Results</h1>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" id="export-full-btn" type="button">Export full report</button>
          <button class="btn btn-secondary btn-sm" id="export-filtered-json-btn" type="button">Export filtered JSON</button>
          <button class="btn btn-secondary btn-sm" id="export-csv-btn" type="button">Export CSV</button>
        </div>
      </div>
      ${fromAudit && report ? `
        <div class="card mb-4" style="padding:var(--space-4)">
          <p style="margin:0">
            Opened from Compliance Audit.
            ${totalIssues === 0 && report.gate?.pass
    ? 'The gate passed with <strong>0 blocking issues</strong> — that is a successful result. Browse sample files below or return to <a href="#/audit">Compliance Audit</a> for layer breakdown.'
    : `Showing ${totalIssues} issue group(s) from the latest scan.`}
          </p>
        </div>
      ` : ''}
      ${report ? this.renderScanSummary(report) : ''}
      ${this.app.state.routeParams?.q ? `<p class="text-muted mb-4">Search: “${escapeHtml(this.app.state.routeParams.q)}”</p>` : ''}
      <div class="results-toolbar" id="severity-filters">
        ${SEVERITIES.map((s) => `
          <button type="button" class="filter-chip ${this.filterSeverity === s ? 'active' : ''}" data-severity="${s}">
            ${s === 'all' ? 'All severities' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        `).join('')}
      </div>
      <div class="results-toolbar" id="category-filters">
        <button type="button" class="filter-chip ${this.filterCategory === 'all' ? 'active' : ''}" data-category="all">All types</button>
        ${categories.map((c) => `
          <button type="button" class="filter-chip ${this.filterCategory === c.id ? 'active' : ''}" data-category="${c.id}">
            ${c.icon} ${escapeHtml(c.title)} (${c.count})
          </button>
        `).join('')}
      </div>
      ${!report ? `
        <div class="empty-state card">
          <div class="empty-state-icon">📋</div>
          <p>No scan report loaded yet. Run a Simplebeacon or Complete scan from Analyze, or use Dashboard → Run scan.</p>
        </div>
      ` : issues.length === 0 ? `
        <div class="empty-state card">
          <div class="empty-state-icon">${totalIssues === 0 && report.gate?.pass && !filtersActive ? '✅' : '🔍'}</div>
          <p>${this.emptyStateMessage(report, totalIssues, filtersActive, activeCategory)}</p>
          ${filtersActive
    ? '<p class="text-muted" style="margin-top:var(--space-2)"><button type="button" class="btn btn-secondary btn-sm" id="clear-results-filters">Clear filters</button></p>'
    : ''}
        </div>
      ` : `
        <div class="card" style="padding: 0; overflow: hidden;">
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
        <div id="issue-detail"></div>
      `}

      ${this.renderSampleFiles()}
    `;

    this.bindFilters(el);
    this.bindExport(el, issues);

    el.querySelector('#clear-results-filters')?.addEventListener('click', () => {
      this.filterSeverity = 'all';
      this.filterCategory = 'all';
      this.app.state.routeParams = {};
      this.app.router.navigate('results');
    });

    const tbody = el.querySelector('#results-body');
    if (tbody) {
      issues.forEach((issue) => {
        const tr = document.createElement('tr');
        tr.dataset.issueId = issue.id;
        tr.innerHTML = `
          <td><span class="severity-pill ${issue.severity}">${issue.severity}</span></td>
          <td>${escapeHtml(issue.type)}</td>
          <td>${escapeHtml(issue.description)}</td>
          <td><code>${escapeHtml(this.app.scanService.basename(issue.filePath))}</code></td>
          <td>${issue.count ?? 1}</td>
        `;
        tr.addEventListener('click', () => this.showDetail(el, issue));
        tbody.appendChild(tr);
      });
    }

    return el;
  }

  emptyStateMessage(report, totalIssues, filtersActive, activeCategory) {
    if (filtersActive && activeCategory) {
      return `No ${activeCategory.title.toLowerCase()} issues match the current filters.`;
    }
    if (filtersActive) {
      return 'No issues match the current filters.';
    }
    if (totalIssues === 0 && report.gate?.pass) {
      return 'Simplebeacon gate passed — no blocking issues in the latest scan. This is expected when paths are clean. Scroll down for the sample file inventory, or open Compliance Audit for per-layer metrics.';
    }
    return 'No issues in the loaded report.';
  }

  bindExport(el, issues) {
    const svc = this.app.scanService;
    const meta = {
      severity: this.filterSeverity,
      category: this.filterCategory,
      query: this.app.state.routeParams?.q || null
    };

    el.querySelector('#export-full-btn')?.addEventListener('click', async () => {
      try {
        await svc.exportReport(this.app.state.report);
        showToast('Full report downloaded', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    el.querySelector('#export-filtered-json-btn')?.addEventListener('click', () => {
      if (!issues.length) {
        showToast('No issues match current filters', 'info');
        return;
      }
      svc.exportFilteredIssues(issues, meta);
      showToast(`Exported ${issues.length} issue(s) as JSON`, 'success');
    });

    el.querySelector('#export-csv-btn')?.addEventListener('click', () => {
      if (!issues.length) {
        showToast('No issues match current filters', 'info');
        return;
      }
      svc.exportIssuesCsv(issues);
      showToast(`Exported ${issues.length} issue(s) as CSV`, 'success');
    });
  }

  bindFilters(el) {
    el.querySelectorAll('#severity-filters .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filterSeverity = btn.dataset.severity;
        this.paint();
      });
    });
    el.querySelectorAll('#category-filters .filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filterCategory = btn.dataset.category;
        this.paint();
      });
    });
  }

  renderSampleFiles() {
    const report = this.app.state.report;
    const files = report?.sampleFiles || [];
    if (!files.length) return '';
    const total = report.mockSampleFiles ?? report.totalFiles ?? files.length;
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
    const slot = container.querySelector('#issue-detail');
    if (!slot) return;
    slot.innerHTML = `
      <div class="detail-panel">
        <h3>${escapeHtml(issue.type)}</h3>
        <p>${escapeHtml(issue.description)}</p>
        <p><strong>Recommended:</strong> ${escapeHtml(issue.recommendedAction || 'Review and fix manually')}</p>
        <p><strong>File:</strong> <code>${escapeHtml(issue.filePath)}</code></p>
        ${issue.affectedFiles?.length ? `<p><strong>Affected:</strong> ${issue.affectedFiles.map(escapeHtml).join(', ')}</p>` : ''}
        ${issue.metadata?.duplicatePaths?.length ? `
          <p><strong>Duplicate paths:</strong></p>
          <ul class="settings-path-list">
            ${issue.metadata.duplicatePaths.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  paint(container = this._container) {
    if (!container) return;
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
