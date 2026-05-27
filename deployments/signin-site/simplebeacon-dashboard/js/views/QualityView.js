import { escapeHtml, showToast } from '../utils.js';

function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString();
}

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

export class QualityView {
  constructor(app) {
    this.app = app;
    this.auditLoading = false;
  }

  render() {
    const security = this.app.state.security || {};
    const coverage = this.app.state.coverage || {};
    const quality = this.app.state.quality || {};
    const npmAudit = this.app.state.npmAudit;
    const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
    const dependencyVulnTotal = auditStats?.vulnerabilityTotal ?? security.npmAuditTotal ?? security.openVulnerabilities ?? '—';
    const engineeringFindings = security.openEngineeringFindings ?? '—';

    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <h1 class="page-title">Quality & Security</h1>
      <p class="text-muted mb-6">Measured coverage, security checklist, and live npm audit.</p>

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
          <button class="btn btn-secondary btn-sm mt-4" data-scroll="coverage">Coverage details ↑</button>
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
    el.querySelector('[data-scroll="coverage"]')?.addEventListener('click', (event) => this.handleCoverageScroll(event));

    return el;
  }

  handleCoverageScroll(event) {
    event?.preventDefault?.();
    const target = document.getElementById('coverage-details')
      || document.querySelector('[data-section="coverage"]')
      || document.querySelector('[data-scroll-target="coverage"]');
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    showToast('Coverage details are not available yet.', 'info');
  }

  renderAudit(audit) {
    if (!audit) {
      return '<p class="text-muted card">Click “Run audit” to fetch live npm audit results from the project root.</p>';
    }

    if (audit.error) {
      return `
        <div class="card">
          <p class="text-warning mb-2"><strong>npm audit failed</strong></p>
          <p class="text-muted">${escapeHtml(audit.error)}</p>
          ${audit.stdout ? `<pre class="audit-log">${escapeHtml(String(audit.stdout).slice(-1500))}</pre>` : ''}
        </div>
      `;
    }

    const s = npmAuditSummary(audit);
    const vulnerabilities = audit.vulnerabilities || audit.advisories || [];
    const clean = s.vulnerabilityTotal === 0;

    return `
      <div class="card">
        <div class="metrics-row mb-4">
          <div class="metric-chip" title="Packages in npm lockfile tree">
            <strong>${formatCount(s.dependencies)}</strong> dependencies
          </div>
          <div class="metric-chip severity-high"><strong>${s.critical}</strong> critical</div>
          <div class="metric-chip severity-medium"><strong>${s.high}</strong> high</div>
          <div class="metric-chip"><strong>${s.moderate}</strong> moderate</div>
          <div class="metric-chip"><strong>${s.low}</strong> low</div>
        </div>
        ${s.prod != null ? `
          <p class="text-muted text-sm mb-4">${formatCount(s.prod)} prod · ${formatCount(s.dev)} dev dependencies scanned.</p>
        ` : ''}
        ${clean ? `
          <p class="text-success">Clean audit — ${formatCount(s.dependencies)} dependencies, 0 known vulnerabilities.</p>
        ` : ''}
        ${vulnerabilities.length ? `
          <table class="results-table">
            <thead><tr><th>Severity</th><th>Package</th><th>Title</th></tr></thead>
            <tbody>
              ${vulnerabilities.slice(0, 20).map((v) => `
                <tr>
                  <td><span class="severity-pill ${v.severity}">${escapeHtml(v.severity)}</span></td>
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
          ? `npm audit: ${formatCount(s.dependencies)} dependencies, ${s.vulnerabilityTotal} vulnerabilities`
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
      slot.innerHTML = this.renderAudit(this.app.state.npmAudit);
      this.refreshAuditButton();
      return;
    }

    const main = document.getElementById('app-main');
    if (main && this.app.currentView === this) {
      this.mount(main);
    }
  }

  mount(container) {
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(this.render());
    if (!this.app.state.npmAudit && !this.auditLoading) {
      this.runAudit();
    }
  }
}
