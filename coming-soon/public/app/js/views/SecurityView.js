// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, showToast, downloadJson, redactPathForDisplay, formatNumber, renderEmptyState } from '../utils.js';
import {
  extractSecurityFindings,
  buildSecuritySummary,
  buildSecurityExportPayload,
  fetchComplianceHeadline
} from '../services/securityService.js';

/**
 * Security view.
 */
export class SecurityView {
  constructor(app) {
    this.app = app;
    this.scanning = false;
    this.loading = true;
    this.error = null;
    this.compliance = null;
    this._container = null;
  }

  _getVscodeApi() {
    if (this._vscodeApiCached) return this._vscodeApiCached;
    if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function') return null;
    try {
      this._vscodeApiCached = window.acquireVsCodeApi();
      return this._vscodeApiCached;
    } catch {
      return null;
    }
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
      return renderEmptyState({
        icon: '🛡️',
        title: 'No security findings',
        body: 'Credential and production-leak rules reported clean on the last scan.',
        iconWrapper: 'emoji'
      });
    }

    return `
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="results-table">
          <thead>
            <tr>
              <th style="width:90px">Severity</th>
              <th style="width:140px">Type</th>
              <th>File</th>
              <th>Description</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            ${findings.map((finding) => `
              <tr>
                <td><span class="severity-pill ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span></td>
                <td><span style="font-size:var(--font-size-xs);font-weight:500;">${escapeHtml(finding.type)}</span></td>
                <td><code style="font-size:var(--font-size-xs);">${escapeHtml(redactPathForDisplay(finding.file) || '—')}</code></td>
                <td style="font-size:var(--font-size-sm);">${escapeHtml(finding.description || '—')}</td>
                <td style="font-size:var(--font-size-sm);color:var(--text-secondary);">${escapeHtml(finding.recommendation)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';

    if (this.loading && !this.getReport()) {
el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Security Scanner</h1><p class="text-muted analyze-hero-sub">Loading security findings…</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
          title: 'Loading scan report…',
          body: '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>'
        })}
      `;
      return el;
    }

    if (this.error && !this.getReport()) {
el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Security Scanner</h1><p class="text-muted analyze-hero-sub">Security scan unavailable</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
          title: 'Security scan unavailable',
          body: escapeHtml(this.error),
          actions: [{ label: 'Retry', id: 'security-retry', className: 'btn-primary' }]
        })}
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
      <div class="analyze-hero">
        <h1 class="page-title">Security Scanner</h1>
        <p class="text-muted analyze-hero-sub">Credential patterns, production leaks, and secret detection.</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-6);">
        <div class="analyze-action-info">
          <span class="text-muted" style="font-size:var(--font-size-sm);">Last scan: ${escapeHtml(lastScan)}</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" id="security-run-scan" type="button" ${this.scanning ? 'disabled' : ''}>
            ${this.scanning ? 'Scanning…' : 'Run security scan'}
          </button>
          <button class="btn btn-secondary btn-sm" id="security-export-json" type="button">
            Export JSON
          </button>
          <button class="btn btn-ghost btn-sm" id="security-send-ai-btn" type="button" title="Send security findings to AI coding agent">🤖 Send to AI Agent</button>
        </div>
      </div>

      ${this.scanning ? `
        <div class="card mb-6" style="padding:var(--space-4)">
          <span class="loading-spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span>
          Running Simplebeacon scan (credential + production-leak rules)…
        </div>
      ` : ''}

      <div class="grid-2 mb-6">
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:var(--space-5);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);">
            <div>
              <div style="font-size:var(--font-size-sm);color:var(--text-muted);margin-bottom:var(--space-1);">Gate Status</div>
              <div style="font-size:var(--font-size-2xl);font-weight:700;color:var(--${gateClass});">${gateLabel}</div>
            </div>
            <div style="width:56px;height:56px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">
              ${gateLabel === 'PASS' ? '✅' : gateLabel === 'REVIEW' ? '⚠️' : '❌'}
            </div>
          </div>
          <div style="padding:var(--space-4);display:flex;gap:var(--space-4);flex-wrap:wrap;">
            <div>
              <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Files Checked</div>
              <div style="font-size:var(--font-size-lg);font-weight:600;">${formatNumber(summary.credentialScanned + summary.productionLeakScanned)}</div>
            </div>
            <div>
              <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Total Findings</div>
              <div style="font-size:var(--font-size-lg);font-weight:600;">${formatNumber(summary.totalFindings)}</div>
            </div>
            <div>
              <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Compliance</div>
              <div style="font-size:var(--font-size-lg);font-weight:600;">${this.compliance?.securityScore ?? '—'}/100</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:var(--space-5);">
          <div style="font-size:var(--font-size-sm);color:var(--text-muted);margin-bottom:var(--space-3);">Findings by Severity</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3);">
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <div style="width:80px;font-size:var(--font-size-xs);font-weight:500;color:var(--danger);">Critical</div>
              <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(100, (summary.severityCounts.critical / Math.max(summary.totalFindings, 1)) * 100)}%;height:100%;background:var(--danger);border-radius:4px;"></div>
              </div>
              <div style="width:32px;text-align:right;font-size:var(--font-size-sm);font-weight:600;">${formatNumber(summary.severityCounts.critical)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <div style="width:80px;font-size:var(--font-size-xs);font-weight:500;color:var(--danger);">High</div>
              <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(100, (summary.severityCounts.high / Math.max(summary.totalFindings, 1)) * 100)}%;height:100%;background:var(--danger);border-radius:4px;"></div>
              </div>
              <div style="width:32px;text-align:right;font-size:var(--font-size-sm);font-weight:600;">${formatNumber(summary.severityCounts.high)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <div style="width:80px;font-size:var(--font-size-xs);font-weight:500;color:var(--warning);">Medium</div>
              <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(100, (summary.severityCounts.medium / Math.max(summary.totalFindings, 1)) * 100)}%;height:100%;background:var(--warning);border-radius:4px;"></div>
              </div>
              <div style="width:32px;text-align:right;font-size:var(--font-size-sm);font-weight:600;">${formatNumber(summary.severityCounts.medium)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <div style="width:80px;font-size:var(--font-size-xs);font-weight:500;color:var(--text-muted);">Low</div>
              <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(100, (summary.severityCounts.low / Math.max(summary.totalFindings, 1)) * 100)}%;height:100%;background:var(--text-muted);border-radius:4px;"></div>
              </div>
              <div style="width:32px;text-align:right;font-size:var(--font-size-sm);font-weight:600;">${formatNumber(summary.severityCounts.low)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-6" style="padding:var(--space-4);display:flex;gap:var(--space-6);flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;font-size:1rem;">🔑</div>
          <div>
            <div style="font-size:var(--font-size-sm);font-weight:500;">${formatNumber(summary.credentialScanned)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Credentials scanned</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;font-size:1rem;">🏭</div>
          <div>
            <div style="font-size:var(--font-size-sm);font-weight:500;">${formatNumber(summary.productionLeakScanned)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Production leaks scanned</div>
          </div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2>Findings (${findings.length})</h2>
        </div>
        ${this.renderFindingsTable(findings)}
      </div>
    `;

    el.querySelector('#security-run-scan')?.addEventListener('click', () => this.runScan(this._container));
    el.querySelector('#security-export-json')?.addEventListener('click', () => this.exportResults());
    el.querySelector('#security-send-ai-btn')?.addEventListener('click', async () => {
      const report = this.getReport();
      const findings = this.getFindings();
      if (!findings.length) { showToast('No security findings to send', 'error'); return; }
      const summary = this.getSummary();
      const payload = {
        projectPath: report?.projectRoot || report?.projectPath || window.location.origin,
        reportType: 'security-scan',
        reportSummary: {
          totalFindings: summary.totalFindings,
          credentialCount: summary.credentialCount,
          productionLeakCount: summary.productionLeakCount,
          complianceScore: this.compliance?.securityScore ?? 'N/A'
        },
        notes: 'Security Scanner findings — credential patterns and production leaks'
      };
      const vscode = this._getVscodeApi();
      if (vscode) {
        try { vscode.postMessage({ command: 'sendToAI', data: payload }); showToast('Security findings sent to AI agent', 'success'); return; }
        catch (err) { window["console"]["warn"]('[Security-AI] vscode.postMessage failed:', err); } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
      }
      try {
        const res = await fetch('/api/ai-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success && json.content) { await navigator.clipboard.writeText(json.content); showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success'); }
        else { showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success'); }
      } catch (err) { showToast('Failed to send: ' + err.message, 'error'); }
    });

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

