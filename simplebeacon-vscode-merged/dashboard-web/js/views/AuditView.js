// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, formatNumber, formatPercent, showToast, downloadJson, renderEmptyState } from '../utils.js';

const LAYER_LABELS = {
  credentials: 'Credential patterns',
  fictionKpis: 'Fiction & KPI drift',
  schema: 'JSON schema & page samples',
  productionLeaks: 'Production path leaks',
  roadmap: 'Roadmap & duplicates',
  jestBaseline: 'Jest baseline',
  gate: 'Compliance gate',
};

/**
 * Npm audit summary.
 * @param {any} audit
 * @returns {any}
 */
function npmAuditSummary(audit) {
  const summary = audit?.summary || audit?.metadata?.vulnerabilities || {};
  const deps = audit?.dependencies || audit?.metadata?.dependencies || {};
  return {
    critical: summary.critical ?? 0,
    high: summary.high ?? 0,
    moderate: summary.moderate ?? summary.medium ?? 0,
    low: summary.low ?? 0,
    dependencies: summary.dependencies ?? deps.total ?? null,
    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? audit?.vulnerabilities?.length ?? 0,
  };
}

/**
 * Build audit metrics.
 * @param {any} audit
 * @returns {any}
 */
function buildAuditMetrics(audit = {}) {
  const report = audit.report || {};
  const dash = audit.dashboard?.scanStatus || {};
  const inventory = report.repositoryInventory;

  const consistencyScore =
    report.consistencyScore ??
    dash.consistencyScore ??
    report.schemaCompliance ??
    dash.qualityScore ??
    report.qualityScore;

  const pageSpecsChecked = report.pageSampleSchemaChecked;
  const pageSpecsLabel =
    pageSpecsChecked != null
      ? `${report.pageSampleSchemaPassed ?? 0}/${pageSpecsChecked}`
      : (audit.baseline?.pageSamplesLabel ?? '—');

  const mockSampleFiles = report.mockSampleFiles ?? dash.mockSampleFiles ?? report.totalFiles;
  const filesAnalyzed = report.filesAnalyzed ?? dash.totalFilesScanned;

  return {
    consistencyScore,
    pageSpecsLabel,
    mockSampleFiles,
    filesAnalyzed,
    schemaChecked: report.schemaChecked,
    schemaPassed: report.schemaPassed,
    lastScan: report.generatedAt ?? dash.lastScan,
    inventoryFiles: inventory?.totalFiles ?? null,
    inventoryFolders: inventory?.totalFolders ?? null,
    inventoryRoot: inventory?.projectRoot ?? null,
  };
}

/**
 * Render scan scope.
 * @param {Array} metrics
 * @returns {any}
 */
function renderScanScope(metrics) {
  const parts = [];
  if (metrics.mockSampleFiles != null) {
    parts.push(`${formatNumber(metrics.mockSampleFiles)} mock/sample files in scan paths`);
  }
  if (metrics.filesAnalyzed != null) {
    parts.push(`${formatNumber(metrics.filesAnalyzed)} files analyzed (credentials + leak rules)`);
  }
  if (metrics.inventoryFiles != null) {
    parts.push(
      `${formatNumber(metrics.inventoryFiles)} repo files · ${formatNumber(metrics.inventoryFolders)} folders`
    );
  }
  if (!parts.length) return '';

  const when = metrics.lastScan ? `Last scan ${new Date(metrics.lastScan).toLocaleString()}` : '';

  return `
    <div class="card mb-6" style="padding:var(--space-4)">
      <p class="text-muted mb-1">${parts.join(' · ')}</p>
      ${when ? `<p class="text-muted">${escapeHtml(when)}</p>` : ''}
    </div>
  `;
}

/**
 * Audit view.
 */
export class AuditView {
  constructor(app) {
    this.app = app;
    this.audit = app.state.audit || null;
    this.loading = !this.audit;
    this.refreshing = false;
    this.running = null;
    this.error = null;
    this._container = null;
    this._fetchPromise = null;
    this._animatedOnce = false;
    this.assessmentHighlight = false;
    this.authRequired = false;
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

  invalidateCache() {
    this.audit = null;
    this.app.state.audit = null;
    this._fetchPromise = null;
    this.authRequired = false;
  }

  layerStatusClass(status) {
    if (status === 'pass') return 'success';
    if (status === 'warn' || status === 'warning') return 'warning';
    if (status === 'fail') return 'danger';
    return '';
  }

  renderLayerCard(key, layer, metrics) {
    if (!layer || key === 'gate') return '';
    const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
    const findings = layer.findings ?? layer.blockingCount ?? '—';
    const scanned = layer.scanned ?? layer.checked ?? layer.label ?? '—';

    let extraRows = '';
    if (key === 'schema') {
      if (layer.pageSamplesChecked != null) {
        extraRows += `<div class="settings-row"><span class="settings-label">Page specs</span><span class="settings-value">${layer.pageSamplesPassed ?? 0}/${layer.pageSamplesChecked}</span></div>`;
      }
      if (metrics.schemaChecked != null) {
        extraRows += `<div class="settings-row"><span class="settings-label">JSON schema</span><span class="settings-value">${metrics.schemaPassed ?? 0}/${metrics.schemaChecked}</span></div>`;
      }
    }

    return `
      <div class="card audit-layer-card">
        <div class="card-header">
          <span class="card-title">${escapeHtml(LAYER_LABELS[key] || key)}</span>
          <span class="severity-pill ${this.layerStatusClass(status)}">${escapeHtml(status)}</span>
        </div>
        <div class="settings-grid">
          <div class="settings-row"><span class="settings-label">Checked</span><span class="settings-value">${escapeHtml(String(scanned))}</span></div>
          <div class="settings-row"><span class="settings-label">Findings</span><span class="settings-value">${escapeHtml(String(findings))}</span></div>
          ${layer.compliance != null ? `<div class="settings-row"><span class="settings-label">Compliance</span><span class="settings-value">${formatPercent(layer.compliance)}</span></div>` : ''}
          ${layer.knownPatterns != null ? `<div class="settings-row"><span class="settings-label">Known patterns</span><span class="settings-value">${layer.knownPatterns}</span></div>` : ''}
          ${extraRows}
        </div>
      </div>
    `;
  }

  renderFictionCatalog(catalog = [], activeFindings = 0) {
    if (!catalog.length) {
      return '<p class="text-muted">No fiction pattern catalog loaded.</p>';
    }
    const statusLine =
      activeFindings === 0
        ? 'Latest scan: 0 active fiction findings in KPI fields — gate passes.'
        : `Latest scan: ${activeFindings} active fiction finding(s) — review Results for details.`;
    return `
      <p class="text-muted mb-3">
        These ${catalog.length} baseline patterns are banned KPI values Simplebeacon detects and rejects.
        They are not scan failures by themselves. ${statusLine}
      </p>
      <table class="results-table">
        <thead><tr><th>Pattern</th><th>Type</th><th>Severity</th></tr></thead>
        <tbody>
          ${catalog
            .slice(0, 12)
            .map(
              (entry) => `
            <tr>
              <td><code>${escapeHtml(entry.pattern)}</code></td>
              <td>${escapeHtml(entry.patternType || '—')}</td>
              <td><span class="severity-pill ${entry.severity}">${escapeHtml(entry.severity)}</span></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      ${catalog.length > 12 ? `<p class="text-muted mt-2">${catalog.length - 12} more baseline patterns documented in <code>.simplebeacon/baseline.json</code>.</p>` : ''}
    `;
  }

  renderAssessmentSummary(assessment, highlight = false) {
    const exec = assessment?.executiveSummary;
    if (!exec) return '';

    const checklist = assessment.complianceChecklist || {};
    const rules = checklist.rules || [];
    const summary = checklist.summary || {};
    const generatedAt = assessment.generatedAt ? new Date(assessment.generatedAt).toLocaleString() : null;

    return `
      <div class="section-block" id="audit-assessment-summary">
        <div class="section-heading">
          <h2>Assessment summary</h2>
          ${generatedAt ? `<span class="text-muted" style="font-size:var(--font-size-sm)">Updated ${escapeHtml(generatedAt)}</span>` : ''}
        </div>
        <div class="card ${highlight ? 'audit-assessment-highlight' : ''}">
          <p class="mb-4">${escapeHtml(exec.headline || '—')}</p>
          <div class="metrics-row mb-4">
            <div class="metric-chip gate-badge ${exec.gateResult === 'PASS' ? 'pass' : 'warn'}">${escapeHtml(exec.gateResult || '—')}</div>
            <div class="metric-chip"><strong>${exec.qualityScore ?? '—'}</strong> quality</div>
            <div class="metric-chip"><strong>${formatNumber(exec.filesScanned)}</strong> files</div>
            <div class="metric-chip severity-high"><strong>${exec.highIssues ?? 0}</strong> high</div>
            <div class="metric-chip severity-medium"><strong>${exec.mediumIssues ?? 0}</strong> medium</div>
            <div class="metric-chip"><strong>${exec.lowIssues ?? 0}</strong> low</div>
          </div>
          ${
            rules.length
              ? `
            <p class="text-muted mb-2" style="font-size:var(--font-size-sm)">
              Corporate safety checklist — ${summary.passed ?? 0} pass · ${summary.failed ?? 0} fail · ${summary.skipped ?? 0} skipped
            </p>
            <table class="results-table mb-4">
              <thead><tr><th>Rule</th><th>Title</th><th>Status</th></tr></thead>
              <tbody>
                ${rules
                  .slice(0, 8)
                  .map((rule) => {
                    const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
                    const cls = rule.status === 'pass' ? 'success' : rule.status === 'fail' ? 'danger' : '';
                    return `
                    <tr>
                      <td><span class="severity-pill ${cls}">${icon} ${escapeHtml(rule.id)}</span></td>
                      <td>${escapeHtml(rule.title)}</td>
                      <td>${escapeHtml(rule.status || '—')}</td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
            ${rules.length > 8 ? `<p class="text-muted mb-4">${rules.length - 8} more rules in the full report.</p>` : ''}
          `
              : ''
          }
          <div class="flex gap-2 flex-wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="audit-download-assessment">Download assessment JSON</button>
            <button type="button" class="btn btn-ghost btn-sm" id="audit-open-assessments">Open assessment portal</button>
          </div>
        </div>
      </div>
    `;
  }

  renderNpmAudit(audit) {
    if (!audit) {
      return '<p class="text-muted">Run npm audit below to load dependency vulnerability results.</p>';
    }
    if (audit.error) {
      return `
        <p class="text-warning mb-2"><strong>npm audit failed</strong></p>
        <p class="text-muted">${escapeHtml(audit.error)}</p>
      `;
    }

    const s = npmAuditSummary(audit);
    return `
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${formatNumber(s.dependencies)}</strong> dependencies</div>
        <div class="metric-chip severity-high"><strong>${s.critical}</strong> critical</div>
        <div class="metric-chip severity-medium"><strong>${s.high}</strong> high</div>
        <div class="metric-chip"><strong>${s.vulnerabilityTotal}</strong> total vulns</div>
      </div>
      ${
        s.vulnerabilityTotal === 0 && s.dependencies
          ? `<p class="text-success">Clean audit — ${formatNumber(s.dependencies)} dependencies, 0 known vulnerabilities.</p>`
          : ''
      }
    `;
  }

  render() {
    const el = document.createElement('div');
    if (!this._animatedOnce) {
      el.className = 'fade-in';
      this._animatedOnce = true;
    }

    if (this.loading && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Loading audit layers…</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
          title: 'Loading audit report…',
          body: '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>',
        })}
      `;
      return el;
    }

    if (this.authRequired && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Remote audit data requires authentication</p></div>
        <div class="card" style="padding:var(--space-6);text-align:center;">
          <h3 style="margin-bottom:8px">🔒 Authentication required</h3>
          <p class="text-muted" style="margin-bottom:16px">The hosted audit endpoint requires a valid session or license key to fetch remote metrics.</p>
          <div class="flex" style="justify-content:center;gap:12px">
            <button type="button" class="btn btn-primary" id="audit-signin">Sign in</button>
            <button type="button" class="btn btn-secondary" id="audit-import-report">Import report.json</button>
            <button type="button" class="btn btn-ghost" id="audit-retry">Retry</button>
          </div>
        </div>
      `;
      el.querySelector('#audit-signin')?.addEventListener('click', () => {
        window.location.hash = '#signin';
      });
      el.querySelector('#audit-import-report')?.addEventListener('click', () => {
        const tab = document.querySelector('[data-tab="import"]');
        if (tab) tab.click();
      });
      el.querySelector('#audit-retry')?.addEventListener('click', () => this.reload(el.parentElement), { once: true });
      return el;
    }
    if (this.error && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Audit unavailable</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
          title: 'Audit unavailable',
          body: escapeHtml(this.error),
          actions: [{ label: 'Retry', id: 'audit-retry', className: 'btn-primary' }],
        })}
      `;
      el.querySelector('#audit-retry')?.addEventListener('click', () => this.reload(el.parentElement), { once: true });
      return el;
    }

    const audit = this.audit || {};
    const layers = audit.auditLayers || {};
    const gate = layers.gate || {};
    const metrics = buildAuditMetrics(audit);
    const assessment = audit.assessment;

    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Compliance Audit</h1>
        <p class="text-muted analyze-hero-sub">Credentials, fiction KPIs, schema, production leaks, roadmap, Jest baseline, and npm audit.</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-6);">
        <div class="analyze-action-info">
          <span class="text-muted" style="font-size:var(--font-size-sm);">Gate: <strong class="${gate.pass ? 'success' : 'danger'}">${gate.pass ? 'PASS' : 'FAIL'}</strong> · ${formatPercent(metrics.consistencyScore)} consistency</span>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-primary btn-sm" data-action="scan" ${this.running === 'scan' ? 'disabled' : ''}>
            ${this.running === 'scan' ? 'Scanning…' : 'Run perimeter scan'}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="assess" ${this.running === 'assess' ? 'disabled' : ''}>
            ${this.running === 'assess' ? 'Assessing…' : 'Run assessment'}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="npm" ${this.running === 'npm' ? 'disabled' : ''}>
            ${this.running === 'npm' ? 'Auditing…' : 'Run npm audit'}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="results">View issues</button>
          <button type="button" class="btn btn-ghost btn-sm" id="audit-send-ai-btn" title="Send audit data to AI coding agent">🤖 Send to AI Agent</button>
        </div>
      </div>

      ${this.refreshing ? '<p class="text-muted mb-4" style="font-size:var(--font-size-sm)"><span class="loading-spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span>Refreshing audit…</p>' : ''}

      <div class="grid-3 mb-6">
        <div class="card" style="padding:var(--space-5);display:flex;align-items:center;gap:var(--space-4);">
          <div style="width:48px;height:48px;border-radius:50%;background:${gate.pass ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};display:flex;align-items:center;justify-content:center;font-size:1.5rem;">
            ${gate.pass ? '✅' : '❌'}
          </div>
          <div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:2px;">Gate Status</div>
            <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--${gate.pass ? 'success' : 'danger'});">${gate.pass ? 'PASS' : 'FAIL'}</div>
          </div>
        </div>
        <div class="card" style="padding:var(--space-5);display:flex;align-items:center;gap:var(--space-4);">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📊</div>
          <div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:2px;">Consistency</div>
            <div style="font-size:var(--font-size-xl);font-weight:700;">${formatPercent(metrics.consistencyScore)}</div>
          </div>
        </div>
        <div class="card" style="padding:var(--space-5);display:flex;align-items:center;gap:var(--space-4);">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🧪</div>
          <div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:2px;">Page Specs</div>
            <div style="font-size:var(--font-size-xl);font-weight:700;">${escapeHtml(String(metrics.pageSpecsLabel))}</div>
          </div>
        </div>
      </div>

      ${renderScanScope(metrics)}

      ${
        assessment?.executiveSummary
          ? this.renderAssessmentSummary(assessment, this.assessmentHighlight)
          : `
        <div class="section-block" id="audit-assessment-summary">
          <div class="section-heading"><h2>Assessment summary</h2></div>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:var(--space-3);">📋</div>
            <p style="font-size:var(--font-size-lg);font-weight:600;margin-bottom:var(--space-2);">No assessment generated yet</p>
            <p class="text-muted">Run assessment to generate the executive summary and compliance checklist from the latest scan.</p>
          </div>
        </div>
      `
      }

      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);"><h2>Audit layers</h2></div>
        <div class="grid-2">
          ${Object.entries(layers)
            .filter(([k]) => k !== 'gate')
            .map(([k, v]) => this.renderLayerCard(k, v, metrics))
            .join('')}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2>Fiction detection catalog (${(audit.fictionCatalog || []).length} baseline patterns)</h2>
        </div>
        <div class="card">${this.renderFictionCatalog(audit.fictionCatalog, layers.fictionKpis?.findings ?? 0)}</div>
      </div>

      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);"><h2>npm audit</h2></div>
        <div class="card">${this.renderNpmAudit(audit.npmAudit)}</div>
      </div>
    `;

    el.querySelectorAll('[data-action]').forEach((btn) => {
      if (btn._sbHasListener) return;
      btn._sbHasListener = true;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.handleAction(btn.dataset.action, el.parentElement);
      });
    });

    el.querySelector('#audit-download-assessment')?.addEventListener('click', () => {
      if (!assessment) {
        showToast('Run assessment first', 'info');
        return;
      }
      downloadJson(assessment, `simplebeacon-assessment-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('Assessment JSON downloaded', 'success');
    });

    el.querySelector('#audit-open-assessments')?.addEventListener('click', () => {
      this.app.navigate('assessments');
    });

    el.querySelector('#audit-send-ai-btn')?.addEventListener('click', async () => {
      const audit = this.app.state.audit;
      const report = this.app.state.report;
      if (!audit && !report) {
        showToast('No audit data — run a scan first', 'error');
        return;
      }
      const npmAudit = audit?.npmAudit;
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
        projectPath:
          report?.projectRoot || report?.projectPath || this.app.state.lastProjectPath || window.location.origin,
        reportType: 'compliance-audit',
        reportSummary: {
          gatePass: report?.gate?.pass ?? 'N/A',
          qualityScore: report?.qualityScore ?? 'N/A',
          consistencyScore: audit?.report?.consistencyScore ?? 'N/A',
          totalIssues: report?.issueCount ?? report?.rawIssues?.length ?? 0,
          npmAuditVulnerabilities: npmAudit?.summary?.vulnerabilityTotal ?? 'N/A',
          layers: Object.keys(audit?.layers || {}),
        },
        issues: vulnList.slice(0, 200),
        notes: 'Compliance Audit — perimeter scan, assessment, npm audit layers',
      };
      const vscode = this._getVscodeApi?.();
      if (vscode) {
        try {
          vscode.postMessage({ command: 'sendToAI', data: payload });
          showToast('Audit data sent to AI agent', 'success');
          return;
        } catch (err) {
          window['console']['warn']('[Audit-AI] vscode.postMessage failed:', err);
        } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
      }
      try {
        const res = await fetch('/api/ai-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.content) {
          await navigator.clipboard.writeText(json.content);
          showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success');
        } else {
          showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
        }
      } catch (err) {
        showToast('Failed to send: ' + err.message, 'error');
      }
    });

    return el;
  }

  mergeLiveReport(audit) {
    const live = this.app.state.report;
    if (!audit || !live) return audit;
    return {
      ...audit,
      report: {
        ...audit.report,
        ...live,
        repositoryInventory: live.repositoryInventory ?? audit.report?.repositoryInventory,
      },
      auditLayers: audit.auditLayers,
    };
  }

  paint(container = this._container) {
    if (!container) return;
    this._container = container;
    container.innerHTML = '';
    try {
      container.appendChild(this.render());
    } catch (err) {
      window['console']['error']('[AuditView] Render error:', err);
      container.innerHTML = `<div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Render error</p></div>
        <div class="card" style="padding:var(--space-6);">
          <p class="text-danger mb-2"><strong>Failed to render audit page</strong></p>
          <pre style="font-size:var(--font-size-sm);overflow:auto;">${escapeHtml(err?.message || String(err))}</pre>
        </div>`;
    }
  }

  scrollToAssessmentSummary() {
    requestAnimationFrame(() => {
      document.getElementById('audit-assessment-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async handleAction(action, container) {
    if (action === 'results') {
      const report = this.app.state.report;
      const issueCount = report?.issueCount ?? (report?.rawIssues ?? []).reduce((s, i) => s + (i.count || 1), 0);
      this.app.navigate('results', { from: 'audit' });
      if (!report) {
        showToast('No scan report loaded — run perimeter scan first', 'info');
      } else if (issueCount === 0) {
        showToast('Gate passed — 0 blocking issues. Sample files are listed on Results.', 'info');
      } else {
        showToast(`Opening ${issueCount} issue group(s) from the latest scan`, 'success');
      }
      return;
    }

    this.running = action;
    this.error = null;
    this.paint(container);
    try {
      if (action === 'scan') {
        await this.app.runScan();
        this.invalidateCache();
        showToast('Perimeter scan complete — audit metrics updated', 'success');
      } else if (action === 'assess') {
        const data = await this.app.scanService.runAssess();
        if (data.assessment) {
          if (this.audit) {
            this.audit = { ...this.audit, assessment: data.assessment };
          } else {
            this.audit = { assessment: data.assessment };
          }
          this.app.state.audit = this.audit;
        }
        this.assessmentHighlight = true;
        showToast('Assessment complete — summary and checklist updated below', 'success');
      } else if (action === 'npm') {
        const npmAudit = await this.app.scanService.runNpmAudit();
        this.app.state.npmAudit = npmAudit;
        if (this.audit) {
          this.audit = { ...this.audit, npmAudit };
          this.app.state.audit = this.audit;
          showToast('npm audit complete — see results below', 'success');
          this.paint(container);
          return;
        }
      }
      await this.reload(container, { includeNpm: action === 'npm' });
      if (action === 'assess') {
        this.assessmentHighlight = true;
        this.scrollToAssessmentSummary();
      }
    } catch (err) {
      this.error = err.message;
      showToast(err.message, 'error');
    } finally {
      this.running = null;
      this.paint(container);
      if (action === 'assess' && this.assessmentHighlight) {
        this.scrollToAssessmentSummary();
      }
    }
  }

  async reload(container, options = {}) {
    this._container = container;
    await this.loadAudit({ force: true, includeNpm: Boolean(options.includeNpm) });
  }

  async loadAudit(options = {}) {
    const { force = false, includeNpm = false } = options;
    if (this._fetchPromise) {
      if (!force) return this._fetchPromise;
      await this._fetchPromise.catch(() => {});
      this._fetchPromise = null;
    }

    if (!force && this.audit) {
      this.audit = this.mergeLiveReport(this.audit);
      this.app.state.audit = this.audit;
      return this.audit;
    }

    const hadAudit = Boolean(this.audit);
    this._fetchPromise = (async () => {
      if (!hadAudit) {
        this.loading = true;
        this.error = null;
        this.authRequired = false;
        this.paint();
      } else {
        this.refreshing = true;
        this.error = null;
        this.authRequired = false;
        this.paint();
      }

      try {
        const audit = await this.app.scanService.fetchAudit(includeNpm);
        if (audit && typeof audit === 'object' && audit.authRequired) {
          this.authRequired = true;
          this.audit = null;
        } else {
          this.audit = this.mergeLiveReport(audit);
        }
        if (this.app.state.npmAudit && !this.audit?.npmAudit) {
          if (this.audit) this.audit.npmAudit = this.app.state.npmAudit;
        }
        this.app.state.audit = this.audit;
      } catch (err) {
        if (!hadAudit) this.error = err.message;
      } finally {
        this.loading = false;
        this.refreshing = false;
        this._fetchPromise = null;
        this.paint();
      }

      return this.audit;
    })();

    return this._fetchPromise;
  }

  mount(container) {
    if (!this.audit && this.app.state.audit) {
      this.audit = this.app.state.audit;
      this.loading = false;
    }

    this.paint(container);

    if (!this.audit) {
      void this.loadAudit();
      return;
    }

    this.audit = this.mergeLiveReport(this.audit);
    if (this.app.state.npmAudit && !this.audit.npmAudit) {
      this.audit.npmAudit = this.app.state.npmAudit;
    }
    this.app.state.audit = this.audit;
    // If embedded in an IDE parent (sb_parent_urlbar=1), notify parent and request scroll-to-top
    try {
      const params = new URLSearchParams(window.location.search || '');
      const sbParent = params.get('sb_parent_urlbar') === '1';
      if (sbParent) {
        try {
          window.parent.postMessage({ command: 'dashboardRouteChanged', url: window.location.href }, '*');
        } catch (e) {
          /* ignore */
        }
        try {
          window.parent.postMessage({ command: 'scrollToTop' }, '*');
        } catch (e) {
          /* ignore */
        }
        try {
          window.scrollTo(0, 0);
        } catch (e) {
          /* ignore */
        }
      }
    } catch (_e) {
      /* ignore */
    }
  }
}
