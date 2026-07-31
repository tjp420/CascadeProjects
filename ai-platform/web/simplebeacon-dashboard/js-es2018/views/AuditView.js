// simplebeacon-ignore: debugArtifacts,euAiAct,hardcodedIp — dashboard view diagnostics are false positives
import {
  escapeHtml,
  formatNumber,
  formatPercent,
  showToast,
  downloadJson,
  renderEmptyState,
} from '../utils.js';
import {
  buildComplianceAuditExportBundle,
  complianceAuditExportFilename,
} from '../utils/compliance-audit-export.browser.js?v=20260716cachefix1';
import { npmAuditSummary } from '../utils-lib/audit-helpers.js?v=20260721audit1';
import {
  getVsCodeApi,
  renderSkeletonCard,
  renderSkeletonChips,
} from '../utils-lib/dom.js?v=20260725phase3';
import {
  isSimplebeaconReport,
  normalizeSimplebeaconReport,
  normalizeImportedReport,
  readFileAsJson,
} from '../services/analyzeService.js?v=20260726sevfix1';
import { authService } from '../services/authService.js?v=20260716cachefix1';
const LAYER_LABELS = {
  credentials: 'Credential patterns',
  fictionKpis: 'Fiction & KPI drift',
  schema: 'JSON schema & page samples',
  productionLeaks: 'Production path leaks',
  roadmap: 'Roadmap & duplicates',
  jestBaseline: 'Jest baseline',
  securityPatterns: 'Security patterns',
  llmSlop: 'LLM slop patterns',
  gate: 'Compliance gate',
};
/**
 * Build audit metrics.
 * @param {any} audit
 * @returns {any}
 */
function buildAuditMetrics(audit = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  const report = audit.report || {};
  const dash = ((_a = audit.dashboard) === null || _a === void 0 ? void 0 : _a.scanStatus) || {};
  const inventory = report.repositoryInventory;
  const consistencyScore =
    (_e =
      (_d =
        (_c =
          (_b = report.consistencyScore) !== null && _b !== void 0 ? _b : dash.consistencyScore) !==
          null && _c !== void 0
          ? _c
          : report.schemaCompliance) !== null && _d !== void 0
        ? _d
        : dash.qualityScore) !== null && _e !== void 0
      ? _e
      : report.qualityScore;
  const pageSpecsChecked = report.pageSampleSchemaChecked;
  const pageSpecsLabel =
    pageSpecsChecked != null
      ? `${(_f = report.pageSampleSchemaPassed) !== null && _f !== void 0 ? _f : 0}/${pageSpecsChecked}`
      : (_h = (_g = audit.baseline) === null || _g === void 0 ? void 0 : _g.pageSamplesLabel) !==
            null && _h !== void 0
        ? _h
        : '—';
  const mockSampleFiles =
    (_k = (_j = report.mockSampleFiles) !== null && _j !== void 0 ? _j : dash.mockSampleFiles) !==
      null && _k !== void 0
      ? _k
      : report.totalFiles;
  const filesAnalyzed =
    (_l = report.filesAnalyzed) !== null && _l !== void 0 ? _l : dash.totalFilesScanned;
  return {
    consistencyScore,
    pageSpecsLabel,
    mockSampleFiles,
    filesAnalyzed,
    schemaChecked: report.schemaChecked,
    schemaPassed: report.schemaPassed,
    lastScan: (_m = report.generatedAt) !== null && _m !== void 0 ? _m : dash.lastScan,
    inventoryFiles:
      (_o = inventory === null || inventory === void 0 ? void 0 : inventory.totalFiles) !== null &&
      _o !== void 0
        ? _o
        : null,
    inventoryFolders:
      (_p = inventory === null || inventory === void 0 ? void 0 : inventory.totalFolders) !==
        null && _p !== void 0
        ? _p
        : null,
    inventoryRoot:
      (_q = inventory === null || inventory === void 0 ? void 0 : inventory.projectRoot) !== null &&
      _q !== void 0
        ? _q
        : null,
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
  invalidateCache() {
    this.audit = null;
    this.app.state.audit = null;
    this._fetchPromise = null;
    this.authRequired = false;
  }
  exportAuditData() {
    if (!this.audit) {
      showToast('No audit data to export — load the page first', 'error');
      return;
    }
    // Prevent free-tier sessions from downloading full audit exports
    try {
      if (
        typeof authService !== 'undefined' &&
        authService.isFreeTier &&
        authService.isFreeTier()
      ) {
        showToast(
          'Export disabled for free-tier accounts — upgrade to Pro to download full reports.',
          'error'
        );
        return;
      }
    } catch (_err) {
      // If authService check fails, fall back to allowing exports (fail-open)
      window.console.warn('[AuditView] authService.isFreeTier check failed', _err);
    }
    const payload = buildComplianceAuditExportBundle(this.audit);
    downloadJson(payload, complianceAuditExportFilename('json'));
    showToast('Compliance audit exported', 'success');
  }
  layerStatusClass(status) {
    if (status === 'pass') return 'success';
    if (status === 'warn' || status === 'warning') return 'warning';
    if (status === 'fail') return 'danger';
    return '';
  }
  renderLayerCard(key, layer, metrics) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!layer || key === 'gate') return '';
    const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
    const findings =
      (_b = (_a = layer.findings) !== null && _a !== void 0 ? _a : layer.blockingCount) !== null &&
      _b !== void 0
        ? _b
        : '—';
    const scanned =
      (_e =
        (_d = (_c = layer.scanned) !== null && _c !== void 0 ? _c : layer.checked) !== null &&
        _d !== void 0
          ? _d
          : layer.label) !== null && _e !== void 0
        ? _e
        : '—';
    let extraRows = '';
    if (key === 'schema') {
      if (layer.pageSamplesChecked != null) {
        extraRows += `<div class="settings-row"><span class="settings-label">Page specs</span><span class="settings-value">${(_f = layer.pageSamplesPassed) !== null && _f !== void 0 ? _f : 0}/${layer.pageSamplesChecked}</span></div>`;
      }
      if (metrics.schemaChecked != null) {
        extraRows += `<div class="settings-row"><span class="settings-label">JSON schema</span><span class="settings-value">${(_g = metrics.schemaPassed) !== null && _g !== void 0 ? _g : 0}/${metrics.schemaChecked}</span></div>`;
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
  renderScanScopeSection(scope) {
    if (!scope) return '';
    const profile = scope.profile || '—';
    const rules = (scope.rulesEnabled || []).join(', ') || '—';
    const prodPaths = (scope.productionPaths || []).join(', ') || '—';
    const limitations = (scope.limitations || []).map((l) => `<li>${escapeHtml(l)}</li>`).join('');
    const mockFiles =
      scope.mockSampleFilesInScanPaths != null
        ? formatNumber(scope.mockSampleFilesInScanPaths)
        : '—';
    const prodDirs =
      scope.productionDirsScanned != null ? formatNumber(scope.productionDirsScanned) : '—';
    const ruleScoped =
      scope.ruleScopedFilesAnalyzed != null ? formatNumber(scope.ruleScopedFilesAnalyzed) : '—';
    const jestExecuted = scope.jestExecutedDuringScan ? 'Yes' : 'No';
    return `
      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);"><h2>Scan scope</h2></div>
        <div class="card">
          <div class="settings-grid">
            <div class="settings-row"><span class="settings-label">Profile</span><span class="settings-value">${escapeHtml(profile)}</span></div>
            <div class="settings-row"><span class="settings-label">Rules enabled</span><span class="settings-value">${escapeHtml(rules)}</span></div>
            <div class="settings-row"><span class="settings-label">Rule-scoped files</span><span class="settings-value">${ruleScoped}</span></div>
            <div class="settings-row"><span class="settings-label">Mock/sample files</span><span class="settings-value">${mockFiles}</span></div>
            <div class="settings-row"><span class="settings-label">Production dirs scanned</span><span class="settings-value">${prodDirs}</span></div>
            <div class="settings-row"><span class="settings-label">Jest executed</span><span class="settings-value">${jestExecuted}</span></div>
            <div class="settings-row"><span class="settings-label">Production paths</span><span class="settings-value" style="font-size:var(--font-size-xs)">${escapeHtml(prodPaths)}</span></div>
          </div>
          ${limitations ? `<h3 style="margin-top:var(--space-4);margin-bottom:var(--space-2);font-size:var(--font-size-sm)">Limitations</h3><ul class="about-list">${limitations}</ul>` : ''}
        </div>
      </div>
    `;
  }
  renderGateWarnings(warnings) {
    if (!warnings || !warnings.length) return '';
    const rows = warnings
      .map(
        (w) => `
        <tr>
          <td><span class="severity-pill ${w.severity || 'low'}">${escapeHtml(w.severity || 'low')}</span></td>
          <td>${escapeHtml(w.type || w.id || '—')}</td>
          <td>${escapeHtml(w.description || '—')}</td>
          <td style="font-size:var(--font-size-xs);color:var(--text-muted)">${escapeHtml((w.filePath || w.file || '').split(/[\\/]/).pop() || '—')}</td>
        </tr>`
      )
      .join('');
    return `
      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);"><h2>Gate warnings (${warnings.length})</h2></div>
        <div class="card">
          <div class="table-scroll-wrapper">
          <table class="results-table">
            <thead><tr><th scope="col">Severity</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">File</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          </div>
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
      <div class="table-scroll-wrapper">
      <table class="results-table">
        <thead><tr><th scope="col">Pattern</th><th scope="col">Type</th><th scope="col">Severity</th></tr></thead>
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
      </div>
      ${catalog.length > 12 ? `<p class="text-muted mt-2">${catalog.length - 12} more baseline patterns documented in <code>.simplebeacon/baseline.json</code>.</p>` : ''}
    `;
  }
  renderAssessmentSummary(assessment, highlight = false) {
    var _a, _b, _c, _d, _e, _f, _g;
    const exec =
      assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary;
    if (!exec) return '';
    const checklist = assessment.complianceChecklist || {};
    const rules = checklist.rules || [];
    const summary = checklist.summary || {};
    const generatedAt = assessment.generatedAt
      ? new Date(assessment.generatedAt).toLocaleString()
      : null;
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
            <div class="metric-chip"><strong>${(_a = exec.qualityScore) !== null && _a !== void 0 ? _a : '—'}</strong> quality</div>
            <div class="metric-chip"><strong>${formatNumber(exec.filesScanned)}</strong> files</div>
            <div class="metric-chip severity-high"><strong>${(_b = exec.highIssues) !== null && _b !== void 0 ? _b : 0}</strong> high</div>
            <div class="metric-chip severity-medium"><strong>${(_c = exec.mediumIssues) !== null && _c !== void 0 ? _c : 0}</strong> medium</div>
            <div class="metric-chip"><strong>${(_d = exec.lowIssues) !== null && _d !== void 0 ? _d : 0}</strong> low</div>
          </div>
          ${
            rules.length
              ? `
            <p class="text-muted mb-2" style="font-size:var(--font-size-sm)">
              Corporate safety checklist — ${(_e = summary.passed) !== null && _e !== void 0 ? _e : 0} pass · ${(_f = summary.failed) !== null && _f !== void 0 ? _f : 0} fail · ${(_g = summary.skipped) !== null && _g !== void 0 ? _g : 0} skipped
            </p>
            <div class="table-scroll-wrapper">
            <table class="results-table mb-4">
              <thead><tr><th scope="col">Rule</th><th scope="col">Title</th><th scope="col">Status</th></tr></thead>
              <tbody>
                ${rules
                  .slice(0, 8)
                  .map((rule) => {
                    const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
                    const cls =
                      rule.status === 'pass' ? 'success' : rule.status === 'fail' ? 'danger' : '';
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
            </div>
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
    var _a, _b, _c, _d, _e, _f;
    const el = document.createElement('div');
    if (!this._animatedOnce) {
      el.className = 'fade-in';
      this._animatedOnce = true;
    }
    if (this.loading && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Loading audit layers…</p></div>
        ${renderSkeletonChips(4)}
        <div class="grid-3 mb-6">
          ${renderSkeletonCard(2)}
          ${renderSkeletonCard(2)}
          ${renderSkeletonCard(2)}
        </div>
        ${renderSkeletonCard(5)}
      `;
      return el;
    }
    if (this.authRequired && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Remote audit data requires authentication</p></div>
        <div class="card" style="padding:var(--space-6);text-align:center;">
          <h3 style="margin-bottom:8px">🔒 Authentication required</h3>
          <p class="text-muted" style="margin-bottom:16px">The hosted audit endpoint requires a valid session or license key to fetch remote metrics.<br>Or load a local scan report to view audit data without signing in.</p>
          <div class="flex" style="justify-content:center;gap:12px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary" id="audit-signin">Sign in</button>
          <button type="button" class="btn btn-secondary" id="audit-import-report">Import report.json</button>
          <button type="button" class="btn btn-secondary" id="audit-load-file">Load report file…</button>
          <button type="button" class="btn btn-ghost" id="audit-retry">Retry</button>
          </div>
          <input type="file" id="audit-file-input" accept=".json" hidden>
        </div>
        `;
      (_a = el.querySelector('#audit-signin')) === null || _a === void 0
        ? void 0
        : _a.addEventListener('click', () => {
            window.location.hash = '#signin';
          });
      (_a = el.querySelector('#audit-import-report')) === null || _a === void 0
        ? void 0
        : _a.addEventListener('click', () => {
            const tab = document.querySelector('[data-tab="import"]');
            if (tab) tab.click();
          });
      const fileInput = el.querySelector('#audit-file-input');
      (_a = el.querySelector('#audit-load-file')) === null || _a === void 0
        ? void 0
        : _a.addEventListener('click', () => {
            if (fileInput) fileInput.click();
          });
      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            const parsed = await readFileAsJson(file);
            const report =
              normalizeImportedReport(parsed) ||
              (isSimplebeaconReport(parsed) ? normalizeSimplebeaconReport(parsed) : null);
            if (!report) {
              showToast('File is not a recognized Simplebeacon report', 'error');
              return;
            }
            this.app.state.report = report;
            this.app.scanService.report = report;
            this.authRequired = false;
            this.audit = this.buildAuditFromReport(report);
            this.app.state.audit = this.audit;
            this.paint(el.parentElement);
            showToast(`Loaded report: ${file.name} — ${report.issueCount || 0} issues`, 'success');
          } catch (err) {
            showToast(`Failed to load report: ${err.message}`, 'error');
          }
        });
      }
      (_a = el.querySelector('#audit-retry')) === null || _a === void 0
        ? void 0
        : _a.addEventListener('click', () => this.reload(el.parentElement), { once: true });
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
      (_a = el.querySelector('#audit-retry')) === null || _a === void 0
        ? void 0
        : _a.addEventListener('click', () => this.reload(el.parentElement), { once: true });
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
          <button type="button" class="btn btn-secondary btn-sm" id="audit-export-json" ${!this.audit ? 'disabled' : ''} title="Download compliance audit JSON">
            <i data-lucide="download" class="icon-16"></i> Export
          </button>
          ${this.app.isCurrentUserAdmin() ? '<button type="button" class="btn btn-ghost btn-sm" id="audit-send-ai-btn" title="Send audit data to AI coding agent">🤖 Send to AI Agent</button>' : ''}
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
        (assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary)
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

      ${this.renderScanScopeSection(audit.scanScope)}

      ${audit.gateWarnings && audit.gateWarnings.length ? this.renderGateWarnings(audit.gateWarnings) : ''}

      <div class="section-block">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2>Fiction detection catalog (${(audit.fictionCatalog || []).length} baseline patterns)</h2>
        </div>
        <div class="card">${this.renderFictionCatalog(audit.fictionCatalog, (_c = (_b = layers.fictionKpis) === null || _b === void 0 ? void 0 : _b.findings) !== null && _c !== void 0 ? _c : 0)}</div>
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
    (_d = el.querySelector('#audit-export-json')) === null || _d === void 0
      ? void 0
      : _d.addEventListener('click', () => this.exportAuditData());
    (_d = el.querySelector('#audit-download-assessment')) === null || _d === void 0
      ? void 0
      : _d.addEventListener('click', () => {
          if (!assessment) {
            showToast('Run assessment first', 'info');
            return;
          }
          downloadJson(
            assessment,
            `simplebeacon-assessment-${new Date().toISOString().slice(0, 10)}.json`
          );
          showToast('Assessment JSON downloaded', 'success');
        });
    (_e = el.querySelector('#audit-open-assessments')) === null || _e === void 0
      ? void 0
      : _e.addEventListener('click', () => {
          this.app.navigate('assessments');
        });
    (_f = el.querySelector('#audit-send-ai-btn')) === null || _f === void 0
      ? void 0
      : _f.addEventListener('click', async () => {
          var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
          const audit = this.app.state.audit;
          const report = this.app.state.report;
          if (!audit && !report) {
            showToast('No audit data — run a scan first', 'error');
            return;
          }
          const npmAudit = audit === null || audit === void 0 ? void 0 : audit.npmAudit;
          const vulnList = [];
          const rawVulns =
            (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.vulnerabilities) ||
            (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.advisories) ||
            {};
          if (typeof rawVulns === 'object' && rawVulns !== null) {
            for (const [pkg, info] of Object.entries(rawVulns)) {
              if (info && typeof info === 'object') {
                const sev =
                  info.severity ||
                  ((_b = (_a = info.via) === null || _a === void 0 ? void 0 : _a[0]) === null ||
                  _b === void 0
                    ? void 0
                    : _b.severity) ||
                  'unknown';
                const title =
                  ((_d = (_c = info.via) === null || _c === void 0 ? void 0 : _c[0]) === null ||
                  _d === void 0
                    ? void 0
                    : _d.title) ||
                  info.title ||
                  info.overview ||
                  '';
                vulnList.push({ package: pkg, severity: sev, title });
              }
            }
          }
          const payload = {
            projectPath:
              (report === null || report === void 0 ? void 0 : report.projectRoot) ||
              (report === null || report === void 0 ? void 0 : report.projectPath) ||
              this.app.state.lastProjectPath ||
              window.location.origin,
            reportType: 'compliance-audit',
            reportSummary: {
              gatePass:
                (_f =
                  (_e = report === null || report === void 0 ? void 0 : report.gate) === null ||
                  _e === void 0
                    ? void 0
                    : _e.pass) !== null && _f !== void 0
                  ? _f
                  : 'N/A',
              qualityScore:
                (_g = report === null || report === void 0 ? void 0 : report.qualityScore) !==
                  null && _g !== void 0
                  ? _g
                  : 'N/A',
              consistencyScore:
                (_j =
                  (_h = audit === null || audit === void 0 ? void 0 : audit.report) === null ||
                  _h === void 0
                    ? void 0
                    : _h.consistencyScore) !== null && _j !== void 0
                  ? _j
                  : 'N/A',
              totalIssues:
                (_k = report === null || report === void 0 ? void 0 : report.issueCount) !== null &&
                _k !== void 0
                  ? _k
                  : (_m =
                        (_l = report === null || report === void 0 ? void 0 : report.rawIssues) ===
                          null || _l === void 0
                          ? void 0
                          : _l.length) !== null && _m !== void 0
                    ? _m
                    : 0,
              npmAuditVulnerabilities:
                (_p =
                  (_o = npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.summary) ===
                    null || _o === void 0
                    ? void 0
                    : _o.vulnerabilityTotal) !== null && _p !== void 0
                  ? _p
                  : 'N/A',
              layers: Object.keys(
                (audit === null || audit === void 0 ? void 0 : audit.layers) || {}
              ),
            },
            issues: vulnList.slice(0, 200),
            notes: 'Compliance Audit — perimeter scan, assessment, npm audit layers',
          };
          const vscode = getVsCodeApi();
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
              showToast(
                'Copied to clipboard — paste into your AI coding agent with Ctrl+V',
                'success'
              );
            } else {
              showToast(
                'AI context saved. Mention @.simplebeacon/ai-context.md in chat.',
                'success'
              );
            }
          } catch (err) {
            showToast('Failed to send: ' + err.message, 'error');
          }
        });
    return el;
  }
  mergeLiveReport(audit) {
    var _a, _b;
    const live = this.app.state.report;
    if (!audit || !live) return audit;
    return {
      ...audit,
      report: {
        ...audit.report,
        ...live,
        repositoryInventory:
          (_a = live.repositoryInventory) !== null && _a !== void 0
            ? _a
            : (_b = audit.report) === null || _b === void 0
              ? void 0
              : _b.repositoryInventory,
      },
      auditLayers: audit.auditLayers,
    };
  }
  paint(container = this._container) {
    if (!container) return;
    this._container = container;
    window.setSafeHTML(container, '');
    try {
      container.appendChild(this.render());
    } catch (err) {
      window['console']['error']('[AuditView] Render error:', err);
      container.innerHTML = `<div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Render error</p></div>
        <div class="card" style="padding:var(--space-6);">
          <p class="text-danger mb-2"><strong>Failed to render audit page</strong></p>
          <pre style="font-size:var(--font-size-sm);overflow:auto;">${escapeHtml((err === null || err === void 0 ? void 0 : err.message) || String(err))}</pre>
        </div>`;
    }
  }
  scrollToAssessmentSummary() {
    requestAnimationFrame(() => {
      var _a;
      (_a = document.getElementById('audit-assessment-summary')) === null || _a === void 0
        ? void 0
        : _a.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  async handleAction(action, container) {
    var _a, _b;
    if (action === 'results') {
      const report = this.app.state.report;
      const issueCount =
        (_a = report === null || report === void 0 ? void 0 : report.issueCount) !== null &&
        _a !== void 0
          ? _a
          : ((_b = report === null || report === void 0 ? void 0 : report.rawIssues) !== null &&
            _b !== void 0
              ? _b
              : []
            ).reduce((s, i) => s + (i.count || 1), 0);
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
          if (this.app.state.report) {
            this.authRequired = false;
            this.audit = this.buildAuditFromReport(this.app.state.report);
          } else {
            this.authRequired = true;
            this.audit = null;
          }
        } else {
          this.audit = this.mergeLiveReport(audit);
        }
        if (this.app.state.npmAudit && !this.audit.npmAudit) {
          this.audit.npmAudit = this.app.state.npmAudit;
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
  buildAuditFromReport(report) {
    const r = report || {};
    const rawIssues = r.rawIssues || r.detectedIssues || [];
    const gate = r.gate || { pass: true };
    const issueCount = r.issueCount || rawIssues.length;
    const layers = {};
    const credIssues = rawIssues.filter(
      (i) => i.type === 'credential' || i.patternId === 'credential'
    );
    layers.credentials = {
      status: credIssues.length ? 'fail' : 'pass',
      findings: credIssues.length,
      scanned: r.credentialScanned || 0,
    };
    const leakIssues = rawIssues.filter(
      (i) =>
        i.type === 'production-leak' ||
        i.patternId === 'production-leak' ||
        i.type === 'productionLeak'
    );
    layers.productionLeaks = {
      status: leakIssues.length ? 'fail' : 'pass',
      findings: leakIssues.length,
      scanned: r.productionLeakScanned || 0,
    };
    const fictionIssues = rawIssues.filter(
      (i) => i.type === 'fiction' || i.patternId === 'fiction' || i.type === 'fictionKpi'
    );
    layers.fictionKpis = {
      status: fictionIssues.length ? 'fail' : 'pass',
      findings: fictionIssues.length,
      scanned: r.sourceCodeFilesScanned || 0,
    };
    layers.schema = {
      status: 'pass',
      findings: 0,
      scanned: r.schemaChecked || 0,
      pageSamplesChecked: r.pageSampleSchemaChecked,
      pageSamplesPassed: r.pageSampleSchemaPassed,
    };
    layers.roadmap = { status: 'pass', findings: 0, scanned: r.roadmapSchemaChecked || 0 };
    layers.jestBaseline = {
      status: r.jestBaselinePassed ? 'pass' : 'warn',
      findings: 0,
      scanned: r.jestBaselineChecked ? 1 : 0,
    };
    const secIssues = rawIssues.filter(
      (i) => i.type === 'security' || i.patternId === 'security' || i.type === 'securityPattern'
    );
    layers.securityPatterns = {
      status: secIssues.length ? 'fail' : 'pass',
      findings: r.securityPatternFindings || secIssues.length || 0,
      scanned: r.securityPatternFilesScanned || 0,
    };
    const slopIssues = rawIssues.filter(
      (i) => i.type === 'llm-slop' || i.patternId === 'llm-slop' || i.type === 'llmSlop'
    );
    layers.llmSlop = {
      status: slopIssues.length ? 'fail' : 'pass',
      findings: r.llmSlopPatternHits || slopIssues.length || 0,
      scanned: r.llmSlopFilesScanned || 0,
    };
    layers.gate = {
      pass: gate.pass !== false,
      findings: issueCount,
      blockingCount: gate.blockingCount || 0,
      warningCount: gate.warningCount || 0,
    };
    return {
      report: r,
      auditLayers: layers,
      dashboard: {
        scanStatus: {
          totalFilesScanned: r.filesAnalyzed || r.totalFiles || 0,
          mockSampleFiles: r.mockSampleFiles || r.totalFiles || 0,
          qualityScore: r.qualityScore,
          consistencyScore: r.consistencyScore,
          lastScan: r.generatedAt,
        },
      },
      scanScope: r.scanScope || null,
      ruleTimings: r.ruleTimings || null,
      mockDataCategories: r.mockDataCategories || null,
      gateWarnings: gate.warningIssues || [],
      fictionCatalog: [],
      npmAudit: this.app.state.npmAudit || null,
    };
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
    try {
      const params = new URLSearchParams(window.location.search || '');
      const sbParent = params.get('sb_parent_urlbar') === '1';
      if (sbParent) {
        try {
          window.parent.postMessage(
            { command: 'dashboardRouteChanged', url: window.location.href },
            '*'
          );
        } catch (e) {}
        try {
          window.parent.postMessage({ command: 'scrollToTop' }, '*');
        } catch (e) {}
        try {
          window.scrollTo(0, 0);
        } catch (e) {}
      }
    } catch (_e) {}
  }
}
