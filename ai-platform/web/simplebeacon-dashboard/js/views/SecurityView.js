import { escapeHtml, showToast, downloadJson, redactPathForDisplay, formatNumber } from '../utils.js';
import {
  extractSecurityFindings,
  buildSecuritySummary,
  buildSecurityExportPayload,
  fetchComplianceHeadline
} from '../services/securityService.js';

export class SecurityView {
  constructor(app) {
    this.app = app;
    this.scanning = false;
    this.loading = true;
    this.error = null;
    this.compliance = null;
    this._container = null;
  }

  getReport() {
    return this.app.state.report;
  }

  getFindings() {
    return extractSecurityFindings(this.getReport());
  }

  getSummary() {
    return buildSecuritySummary(this.getReport(), this.getFindings());
  }

  renderSeverityBand(label, count, className) {
    return `
      <div class="card insight-stat">
        <div class="insight-stat-value ${className}">${formatNumber(count)}</div>
        <div class="insight-stat-label">${escapeHtml(label)}</div>
      </div>
    `;
  }

  renderFindingsTable(findings) {
    if (!findings.length) {
      return `
        <div class="empty-state card">
          <p><strong>No security findings</strong> — credential and production-leak rules reported clean on the last scan.</p>
          <p class="text-muted mt-2">Run a scan to refresh. A clean result means no credential patterns or mock→production path leaks were detected in scope.</p>
        </div>
      `;
    }

    return `
      <table class="results-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>File</th>
            <th>Description</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${findings.map((finding) => `
            <tr>
              <td><span class="severity-pill ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
              <td>${escapeHtml(finding.type)}</td>
              <td><code>${escapeHtml(redactPathForDisplay(finding.file) || '—')}</code></td>
              <td>${escapeHtml(finding.description || '—')}</td>
              <td>${escapeHtml(finding.recommendation)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';

    if (this.loading && !this.getReport()) {
      el.innerHTML = `
        <h1 class="page-title">Security Scanner</h1>
        <div class="empty-state card">
          <div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>
          <p>Loading scan report…</p>
        </div>
      `;
      return el;
    }

    if (this.error && !this.getReport()) {
      el.innerHTML = `
        <h1 class="page-title">Security Scanner</h1>
        <div class="empty-state card">
          <p>${escapeHtml(this.error)}</p>
          <button class="btn btn-primary mt-4" id="security-retry" type="button">Retry</button>
        </div>
      `;
      el.querySelector('#security-retry')?.addEventListener('click', () => this.loadReport(this._container));
      return el;
    }

    const _report = this.getReport();
    const findings = this.getFindings();
    const summary = this.getSummary();
    const gateLabel = summary.gatePass ? 'PASS' : summary.gatePass === false ? 'REVIEW' : '—';
    const gateClass = summary.gatePass ? 'success' : 'danger';
    const lastScan = summary.generatedAt
      ? new Date(summary.generatedAt).toLocaleString()
      : 'Never';

    el.innerHTML = `
      <div class="section-heading mb-4">
        <h1 class="page-title" style="margin:0">Security Scanner</h1>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" id="security-run-scan" type="button" ${this.scanning ? 'disabled' : ''}>
            ${this.scanning ? 'Scanning…' : 'Run security scan'}
          </button>
          <button class="btn btn-secondary btn-sm" id="security-export-json" type="button" ${findings.length ? '' : 'disabled'}>
            Export JSON
          </button>
        </div>
      </div>

      <p class="text-muted mb-6">
        Live Simplebeacon credential and production-leak rules — no static dashboard samples.
        ${this.compliance?.securityScore != null ? `Compliance score: <strong>${escapeHtml(String(this.compliance.securityScore))}</strong>.` : ''}
      </p>

      ${this.scanning ? `
        <div class="card mb-6" style="padding:var(--space-4)">
          <span class="loading-spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span>
          Running Simplebeacon scan (credential + production-leak rules)…
        </div>
      ` : ''}

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value ${gateClass}">${gateLabel}</div>
          <div class="insight-stat-label">Gate</div>
        </div>
        ${this.renderSeverityBand('High / critical', summary.severityCounts.high + summary.severityCounts.critical, 'danger')}
        ${this.renderSeverityBand('Medium', summary.severityCounts.medium, 'warning')}
        ${this.renderSeverityBand('Low', summary.severityCounts.low, '')}
      </div>

      <div class="card mb-6" style="padding:var(--space-4)">
        <p class="text-muted mb-1">
          ${formatNumber(summary.credentialScanned)} files checked for credentials ·
          ${formatNumber(summary.productionLeakScanned)} for production leaks ·
          <strong>${formatNumber(summary.totalFindings)}</strong> finding(s)
        </p>
        <p class="text-muted">Last scan ${escapeHtml(lastScan)}</p>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Findings (${findings.length})</h2></div>
        ${this.renderFindingsTable(findings)}
      </div>
    `;

    el.querySelector('#security-run-scan')?.addEventListener('click', () => this.runScan(this._container));
    el.querySelector('#security-export-json')?.addEventListener('click', () => this.exportResults());

    return el;
  }

  exportResults() {
    const report = this.getReport();
    const findings = this.getFindings();
    if (!findings.length) {
      showToast('No security findings to export', 'info');
      return;
    }
    const payload = buildSecurityExportPayload(report, findings, this.compliance);
    downloadJson(payload, `security-scan-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('Security scan JSON downloaded', 'success');
  }

  paint(container = this._container) {
    if (!container) return;
    this._container = container;
    container.innerHTML = '';
    container.appendChild(this.render());
  }

  async runScan(container) {
    if (this.scanning) return;
    this.scanning = true;
    this.error = null;
    this.paint(container);

    try {
      await this.app.runScan();
      showToast('Security scan complete', 'success');
    } catch (err) {
      this.error = err.message;
      showToast(err.message, 'error');
    } finally {
      this.scanning = false;
      this.loading = false;
      this.paint(container);
    }
  }

  async loadReport(container) {
    this._container = container;
    this.loading = true;
    this.error = null;
    this.paint(container);

    try {
      if (!this.getReport()) {
        await this.app.scanService.fetchReport();
        this.app.state.report = this.app.scanService.report;
      }
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
      this.paint(container);
    }
  }

  async loadCompliance() {
    try {
      this.compliance = await fetchComplianceHeadline();
    } catch {
      this.compliance = null;
    }
    if (this._container && this.app.currentView === this) {
      this.paint(this._container);
    }
  }

  mount(container) {
    this._container = container;
    if (this.getReport()) {
      this.loading = false;
      this.paint(container);
      void this.loadCompliance();
      return;
    }
    void this.loadReport(container);
    void this.loadCompliance();
  }
}

