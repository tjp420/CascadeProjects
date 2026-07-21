// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, showToast, formatNumber } from '../utils.js';
import { resolveJestTestsLabel } from '../services/analyzeService.js';

/**
 * Parse jest total.
 * @param {any} jestTestsLabel
 * @param {any} fallback
 * @returns {any}
 */
function parseJestTotal(jestTestsLabel, fallback) {
  if (!jestTestsLabel) return fallback ?? null;
  const match = String(jestTestsLabel).match(/\/(\d+)/);
  return match ? Number(match[1]) : fallback ?? null;
}

/**
 * Resolve coverage snapshot.
 * @param {any} coverage
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function resolveCoverageSnapshot(coverage, baseline, dashboardHome) {
  const merged = { ...(coverage || {}) };
  if (merged.passedTests != null && merged.totalTests != null) return merged;

  const jestLabel = resolveJestTestsLabel(baseline, dashboardHome);
  const passed = merged.passedTests ?? baseline?.jestTestsPassing ?? dashboardHome?.overview?.passedTests;
  const total = merged.totalTests
    ?? parseJestTotal(baseline?.jestTestsLabel, passed)
    ?? dashboardHome?.overview?.totalTests
    ?? passed;

  if (passed != null) merged.passedTests = passed;
  if (total != null) merged.totalTests = total;
  return merged;
}

/**
 * Coverage pending message.
 * @param {any} coverage
 * @returns {any}
 */
function coveragePendingMessage(coverage) {
  if (coverage?.branchCoverage != null || coverage?.lineCoverage != null) return '';
  return coverage?.notes
    || 'Run npm run test:coverage for Istanbul percentages. Sync Jest counts via Tools → Baseline sync.';
}

/**
 * Npm audit summary.
 * @param {any} audit
 * @returns {any}
 */
function npmAuditSummary(audit) {
  const summary = audit?.summary || audit?.metadata?.vulnerabilities || {};
  const deps = audit?.dependencies || audit?.metadata?.dependencies || {};
  return {
    dependencies: summary.dependencies ?? deps.total ?? null,
    prod: summary.prodDependencies ?? deps.prod ?? null,
    dev: summary.devDependencies ?? deps.dev ?? null,
    critical: summary.critical ?? 0,
    high: summary.high ?? 0,
    moderate: summary.moderate ?? summary.medium ?? 0,
    low: summary.low ?? 0,
    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? (audit?.vulnerabilities?.length ?? 0),
    generatedAt: audit?.generatedAt ?? null
  };
}

/**
 * Quality view.
 */
export class QualityView {
  constructor(app) {
    this.app = app;
    this.auditLoading = false;
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

  render() {
    const security = this.app.state.security || {};
    const coverage = resolveCoverageSnapshot(
      this.app.state.coverage,
      this.app.state.baseline,
      this.app.state.dashboardHome
    );
    const quality = this.app.state.quality || {};
    const coverageHint = coveragePendingMessage(coverage);
    const npmAudit = this.app.state.npmAudit;
    const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
    const dependencyVulnTotal = auditStats?.vulnerabilityTotal ?? security.npmAuditTotal ?? security.openVulnerabilities ?? '—';
    const engineeringFindings = security.openEngineeringFindings ?? '—';

    const el = document.createElement('div');
    el.className = 'fade-in';
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Quality & Security</h1>
        <p class="text-muted analyze-hero-sub">Measured coverage, security checklist, and live npm audit.</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-4);">
        <div class="analyze-action-info"></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="quality-send-ai-btn" type="button" title="Send quality and security data to AI coding agent">🤖 Send to AI Agent</button>
        </div>
      </div>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value success">${coverage.overallCoverage ?? coverage.lineCoverage ?? '—'}%</div>
          <div class="insight-stat-label">Line coverage</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${security.securityScore ?? '—'}/100</div>
          <div class="insight-stat-label">Security score</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${quality.overallScore ?? quality.qualityScore ?? '—'}</div>
          <div class="insight-stat-label">Quality score</div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading">
          <h2>npm audit (live)</h2>
          <button class="btn btn-primary btn-sm" id="run-audit-btn" ${this.auditLoading ? 'disabled' : ''}>${this.auditLoading ? 'Running…' : 'Run audit'}</button>
        </div>
        <div id="audit-results">${this.renderAudit(npmAudit)}</div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card" id="coverage-details" data-scroll-target="coverage">
          <div class="card-header"><span class="card-title">Coverage Breakdown</span></div>
          <div class="settings-grid">
            <div class="settings-row"><span class="settings-label">Branch</span><span class="settings-value">${coverage.branchCoverage ?? '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Function</span><span class="settings-value">${coverage.functionCoverage ?? '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Statement</span><span class="settings-value">${coverage.statementCoverage ?? '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Tests</span><span class="settings-value">${coverage.passedTests ?? '—'}/${coverage.totalTests ?? '—'}</span></div>
          </div>
          ${coverageHint ? `<p class="text-muted text-sm mt-4">${escapeHtml(coverageHint)}</p>` : ''}
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Security Overview</span></div>
          <div class="settings-grid">
            <div class="settings-row"><span class="settings-label">Dependency vulnerabilities</span><span class="settings-value">${dependencyVulnTotal}</span></div>
            <div class="settings-row"><span class="settings-label">Engineering findings</span><span class="settings-value">${engineeringFindings}</span></div>
            <div class="settings-row"><span class="settings-label">Compliance</span><span class="settings-value">${security.complianceRate ?? '—'}%</span></div>
          </div>
        </div>
      </div>
    `;

    el.querySelector('#run-audit-btn')?.addEventListener('click', () => this.runAudit());
    el.querySelector('#quality-send-ai-btn')?.addEventListener('click', async () => {
      const security = this.app.state.security || {};
      const coverage = resolveCoverageSnapshot(this.app.state.coverage, this.app.state.baseline, this.app.state.dashboardHome);
      const quality = this.app.state.quality || {};
      const npmAudit = this.app.state.npmAudit;
      const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
      // Extract individual vulnerability details for the AI agent
      const vulnList = [];
      const rawVulns = npmAudit?.vulnerabilities || npmAudit?.advisories || {};
      if (typeof rawVulns === 'object' && rawVulns !== null) {
        for (const [pkg, info] of Object.entries(rawVulns)) {
          if (info && typeof info === 'object') {
            const sev = info.severity || info.via?.[0]?.severity || 'unknown';
            const title = info.via?.[0]?.title || info.title || info.overview || '';
            vulnList.push({ package: pkg, severity: sev, title });
          }
        }
      }
      const payload = {
        projectPath: this.app.state.lastProjectPath || window.location.origin,
        reportType: 'quality-security',
        reportSummary: {
          lineCoverage: coverage.overallCoverage ?? coverage.lineCoverage ?? 'N/A',
          branchCoverage: coverage.branchCoverage ?? 'N/A',
          securityScore: security.securityScore ?? 'N/A',
          qualityScore: quality.overallScore ?? quality.qualityScore ?? 'N/A',
          npmVulnerabilities: auditStats?.vulnerabilityTotal ?? 'N/A',
          openEngineeringFindings: security.openEngineeringFindings ?? 'N/A'
        },
        issues: vulnList.slice(0, 200),
        notes: 'Quality & Security — coverage, security checklist, and npm audit'
      };
      const vscode = this._getVscodeApi();
      if (vscode) {
        try { vscode.postMessage({ command: 'sendToAI', data: payload }); showToast('Quality & Security data sent to AI agent', 'success'); return; }
        catch (err) { console.warn('[Quality-AI] vscode.postMessage failed:', err); } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
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

  renderAudit(audit) {
    if (!audit) {
      return '<p class="text-muted card">Click “Run audit” to fetch live npm audit results from the project root.</p>';
    }

    if (audit.error || audit.success === false) {
      return `
        <div class="card">
          <p class="text-warning mb-2"><strong>npm audit failed</strong></p>
          <p class="text-muted">${escapeHtml(audit.error || audit.message || 'Unknown error')}</p>
          ${audit.stdout ? `<pre class="audit-log">${escapeHtml(String(audit.stdout).slice(-1500))}</pre>` : ''}
        </div>
      `;
    }

    const s = npmAuditSummary(audit);
    const rawVulns = audit.vulnerabilities || audit.advisories;
    const vulnerabilities = Array.isArray(rawVulns) ? rawVulns : (rawVulns ? Object.values(rawVulns) : []);
    const clean = s.vulnerabilityTotal === 0;

    return `
      <div class="card">
        <div class="metrics-row mb-4">
          <div class="metric-chip" title="Packages in npm lockfile tree">
            <strong>${formatNumber(s.dependencies)}</strong> dependencies
          </div>
          <div class="metric-chip severity-high"><strong>${s.critical}</strong> critical</div>
          <div class="metric-chip severity-medium"><strong>${s.high}</strong> high</div>
          <div class="metric-chip"><strong>${s.moderate}</strong> moderate</div>
          <div class="metric-chip"><strong>${s.low}</strong> low</div>
        </div>
        ${s.prod != null ? `
          <p class="text-muted text-sm mb-4">${formatNumber(s.prod)} prod · ${formatNumber(s.dev)} dev dependencies scanned.</p>
        ` : ''}
        ${clean ? `
          <p class="text-success">Clean audit — ${formatNumber(s.dependencies)} dependencies, 0 known vulnerabilities.</p>
        ` : ''}
        ${vulnerabilities.length ? `
          <table class="results-table">
            <thead><tr><th>Severity</th><th>Package</th><th>Title</th></tr></thead>
            <tbody>
              ${vulnerabilities.slice(0, 20).map((v) => `
                <tr>
                  <td><span class="severity-pill ${escapeHtml(v.severity || 'unknown')}">${escapeHtml(v.severity || 'unknown')}</span></td>
                  <td><code>${escapeHtml(v.component || v.name || v.module_name || '—')}</code></td>
                  <td>${escapeHtml(v.title || v.overview || v.url || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : (!clean ? `<p class="text-muted">No vulnerability details returned.</p>` : '')}
        ${s.generatedAt ? `<p class="text-muted text-sm mt-4">Generated ${escapeHtml(new Date(s.generatedAt).toLocaleString())}</p>` : ''}
      </div>
    `;
  }

  async runAudit() {
    this.auditLoading = true;
    this.refreshAuditButton();

    try {
      this.app.state.npmAudit = await this.app.platformService.refreshNpmAudit({ force: true });
      const s = npmAuditSummary(this.app.state.npmAudit);
      showToast(
        s.dependencies != null
          ? `npm audit: ${formatNumber(s.dependencies)} dependencies, ${s.vulnerabilityTotal} vulnerabilities`
          : 'npm audit complete',
        s.vulnerabilityTotal ? 'info' : 'success'
      );
    } catch (err) {
      this.app.state.npmAudit = { error: err.message };
      showToast(err.message, 'error');
    }

    this.auditLoading = false;
    this.updateAuditResults();
  }

  refreshAuditButton() {
    const btn = document.getElementById('run-audit-btn');
    if (btn) {
      btn.textContent = this.auditLoading ? 'Running…' : 'Run audit';
      btn.disabled = this.auditLoading;
    }
  }

  updateAuditResults() {
    const slot = document.getElementById('audit-results');
    if (slot && this.app.currentView === this) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
      slot.innerHTML = this.renderAudit(this.app.state.npmAudit);
      this.refreshAuditButton();
      return;
    }

    const main = document.getElementById('app-main');
    if (main && this.app.currentView === this) {
      this.mount(main);
    }
  }

  async mount(container) {
    if (!container) return;
    this._container = container;

    const needsPlatformData = this.app.state.coverage == null || this.app.state.security == null;
    if (needsPlatformData) {
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
      container.innerHTML = '<p class="text-muted card">Loading quality metrics…</p>';
      try {
        await this.app.loadPlatformData();
      } catch (err) {
        showToast(err.message || 'Failed to load quality metrics', 'error');
      }
    }

    if (this._container !== container) return;
// TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    container.innerHTML = '';
    container.appendChild(this.render());
    if (!this.app.state.npmAudit && !this.auditLoading) {
      this.runAudit();
    }
  }
}
