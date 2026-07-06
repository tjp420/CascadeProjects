import { escapeHtml, formatNumber, formatPercent, showToast, downloadJson, renderEmptyState, apiUrl } from '../utils.js';
import { renderComplianceBadges, renderComplianceSummary } from '../lib/complianceMapper.js';

const LAYER_LABELS = {
  credentials: 'Credential patterns',
  fictionKpis: 'Fiction & KPI drift',
  schema: 'JSON schema & page samples',
  productionLeaks: 'Production path leaks',
  roadmap: 'Roadmap & duplicates',
  jestBaseline: 'Jest baseline',
  gate: 'Compliance gate'
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
    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? (audit?.vulnerabilities?.length ?? 0)
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

  const consistencyScore = report.consistencyScore
    ?? dash.consistencyScore
    ?? report.schemaCompliance
    ?? dash.qualityScore
    ?? report.qualityScore;

  const pageSpecsChecked = report.pageSampleSchemaChecked;
  const pageSpecsLabel = pageSpecsChecked != null
    ? `${report.pageSampleSchemaPassed ?? 0}/${pageSpecsChecked}`
    : audit.baseline?.pageSamplesLabel ?? '—';

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
    inventoryRoot: inventory?.projectRoot ?? null
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
    parts.push(`<strong>${formatNumber(metrics.mockSampleFiles)}</strong> mock/sample files`);
  }
  if (metrics.filesAnalyzed != null) {
    parts.push(`<strong>${formatNumber(metrics.filesAnalyzed)}</strong> files analyzed`);
  }
  if (metrics.inventoryFiles != null) {
    parts.push(`<strong>${formatNumber(metrics.inventoryFiles)}</strong> repo files · <strong>${formatNumber(metrics.inventoryFolders)}</strong> folders`);
  }
  if (!parts.length) return '';

  const when = metrics.lastScan
    ? `Last scan: ${new Date(metrics.lastScan).toLocaleString()}`
    : '';

  return `
    <div class="au-v3-scope" style="margin-bottom:20px;">
      <span style="font-size:1.1rem;">📂</span>
      <div>
        <span>${parts.join(' · ')}</span>
        ${when ? `<span style="color:var(--text-muted);margin-left:8px;font-size:0.72rem;">· ${escapeHtml(when)}</span>` : ''}
      </div>
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
    const statusClass = this.layerStatusClass(status);
    const statusIcon = status === 'pass' ? '✅' : status === 'warn' || status === 'warning' ? '⚠️' : '❌';

    const LAYER_ICONS = {
      credentials: '🔑', fictionKpis: '🎭', schema: '📐',
      productionLeaks: '🔓', roadmap: '🗺️', jestBaseline: '🧪'
    };

    let extraRows = '';
    if (key === 'schema') {
      if (layer.pageSamplesChecked != null) {
        extraRows += `<div class="au-v3-layer-item"><span>Page specs</span><strong>${layer.pageSamplesPassed ?? 0}/${layer.pageSamplesChecked}</strong></div>`;
      }
      if (metrics.schemaChecked != null) {
        extraRows += `<div class="au-v3-layer-item"><span>JSON schema</span><strong>${metrics.schemaPassed ?? 0}/${metrics.schemaChecked}</strong></div>`;
      }
    }

    const complianceBadges = renderComplianceSummary(key);

    return `
      <div class="au-v3-layer">
        <div class="au-v3-layer-hd">
          <div class="au-v3-layer-title">
            <span>${LAYER_ICONS[key] || '🔍'}</span>
            <span>${escapeHtml(LAYER_LABELS[key] || key)}</span>
          </div>
          <span class="severity-pill ${statusClass}">${statusIcon} ${escapeHtml(status)}</span>
        </div>
        <div class="au-v3-layer-grid">
          <div class="au-v3-layer-item"><span>Checked</span><strong>${escapeHtml(String(scanned))}</strong></div>
          <div class="au-v3-layer-item"><span>Findings</span><strong>${escapeHtml(String(findings))}</strong></div>
          ${layer.compliance != null ? `<div class="au-v3-layer-item"><span>Compliance</span><strong>${formatPercent(layer.compliance)}</strong></div>` : ''}
          ${layer.knownPatterns != null ? `<div class="au-v3-layer-item"><span>Patterns</span><strong>${layer.knownPatterns}</strong></div>` : ''}
          ${extraRows}
        </div>
        ${complianceBadges ? `<div class="au-v3-compliance-bar"><span class="au-v3-compliance-label">Regulatory</span>${complianceBadges}</div>` : ''}
      </div>
    `;
  }

  renderFictionCatalog(catalog = [], activeFindings = 0) {
    if (!catalog.length) {
      return '<p class="text-muted" style="text-align:center;padding:20px;">No fiction pattern catalog loaded.</p>';
    }
    const statusLine = activeFindings === 0
      ? '✅ Latest scan: 0 active fiction findings in KPI fields — gate passes.'
      : `⚠️ Latest scan: ${activeFindings} active fiction finding(s) — review Results for details.`;
    const statusColor = activeFindings === 0 ? '#22c55e' : '#f59e0b';
    return `
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:0 0 14px;line-height:1.5;">
        These ${catalog.length} baseline patterns are banned KPI values Simplebeacon detects and rejects.
        They are not scan failures by themselves.
      </p>
      <p style="font-size:0.78rem;color:${statusColor};font-weight:600;margin:0 0 14px;">${statusLine}</p>
      <table class="au-v3-table">
        <thead><tr><th>Pattern</th><th>Type</th><th>Severity</th></tr></thead>
        <tbody>
          ${catalog.slice(0, 12).map((entry) => `
            <tr>
              <td><code>${escapeHtml(entry.pattern)}</code></td>
              <td>${escapeHtml(entry.patternType || '—')}</td>
              <td><span class="severity-pill ${entry.severity}">${escapeHtml(entry.severity)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${catalog.length > 12 ? `<p class="text-muted" style="font-size:0.75rem;margin-top:10px;">${catalog.length - 12} more baseline patterns documented in <code>.simplebeacon/baseline.json</code>.</p>` : ''}
    `;
  }

  renderAssessmentSummary(assessment, highlight = false) {
    const exec = assessment?.executiveSummary;
    if (!exec) return '';

    const checklist = assessment.complianceChecklist || {};
    const rules = checklist.rules || [];
    const summary = checklist.summary || {};
    const generatedAt = assessment.generatedAt
      ? new Date(assessment.generatedAt).toLocaleString()
      : null;
    const gateResult = exec.gateResult || '—';
    const gateResultClass = gateResult === 'PASS' ? 'pass' : 'warn';
    const gateResultColor = gateResult === 'PASS' ? '#22c55e' : '#f59e0b';

    return `
      <div class="au-v3-card ${highlight ? 'au-v3-highlight' : ''}" id="audit-assessment-summary">
        <div class="au-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Assessment Summary</h3>
          ${generatedAt ? `<span class="text-muted" style="font-size:0.72rem;">${escapeHtml(generatedAt)}</span>` : ''}
        </div>
        <div class="au-v3-card-bd">
          <p style="margin:0 0 16px;font-size:0.9rem;color:var(--text-secondary);line-height:1.6;">${escapeHtml(exec.headline || '—')}</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
            <div class="au-v3-metric" style="margin-bottom:0;border-left:3px solid ${gateResultColor};">
              <div><div class="au-v3-metric-val" style="color:${gateResultColor};">${escapeHtml(gateResult)}</div><div class="au-v3-metric-label">Gate Result</div></div>
            </div>
            <div class="au-v3-metric" style="margin-bottom:0;">
              <div><div class="au-v3-metric-val">${exec.qualityScore ?? '—'}</div><div class="au-v3-metric-label">Quality Score</div></div>
            </div>
            <div class="au-v3-metric" style="margin-bottom:0;">
              <div><div class="au-v3-metric-val">${formatNumber(exec.filesScanned)}</div><div class="au-v3-metric-label">Files Scanned</div></div>
            </div>
            <div class="au-v3-metric" style="margin-bottom:0;">
              <div><div class="au-v3-metric-val" style="color:#f87171;">${exec.highIssues ?? 0}</div><div class="au-v3-metric-label">High Issues</div></div>
            </div>
            <div class="au-v3-metric" style="margin-bottom:0;">
              <div><div class="au-v3-metric-val" style="color:#fbbf24;">${exec.mediumIssues ?? 0}</div><div class="au-v3-metric-label">Medium Issues</div></div>
            </div>
            <div class="au-v3-metric" style="margin-bottom:0;">
              <div><div class="au-v3-metric-val">${exec.lowIssues ?? 0}</div><div class="au-v3-metric-label">Low Issues</div></div>
            </div>
          </div>
          ${rules.length ? `
            <p class="text-muted" style="font-size:0.78rem;margin:0 0 12px;">
              Corporate safety checklist — <strong style="color:#22c55e;">${summary.passed ?? 0} pass</strong> · <strong style="color:#f87171;">${summary.failed ?? 0} fail</strong> · ${summary.skipped ?? 0} skipped
            </p>
            <table class="au-v3-table" style="margin-bottom:16px;">
              <thead><tr><th>Rule</th><th>Title</th><th>Status</th></tr></thead>
              <tbody>
                ${rules.slice(0, 8).map((rule) => {
    const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
    const cls = rule.status === 'pass' ? 'success' : rule.status === 'fail' ? 'danger' : '';
    const color = rule.status === 'pass' ? '#22c55e' : rule.status === 'fail' ? '#ef4444' : 'var(--text-muted)';
    return `
                    <tr>
                      <td><span class="severity-pill ${cls}">${icon} ${escapeHtml(rule.id)}</span></td>
                      <td>${escapeHtml(rule.title)}</td>
                      <td><span style="color:${color};font-weight:600;">${escapeHtml(rule.status || '—')}</span></td>
                    </tr>
                  `;
  }).join('')}
              </tbody>
            </table>
            ${rules.length > 8 ? `<p class="text-muted" style="font-size:0.75rem;margin-bottom:16px;">${rules.length - 8} more rules in the full report.</p>` : ''}
          ` : ''}
          <div class="flex gap-2 flex-wrap">
            <button type="button" class="btn btn-secondary btn-sm" id="audit-download-assessment">Download JSON</button>
            <button type="button" class="btn btn-ghost btn-sm" id="audit-open-assessments">Open Portal</button>
          </div>
        </div>
      </div>
    `;
  }

  renderNpmAudit(audit) {
    if (!audit) {
      return `<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:12px;">📦</div><p class="text-muted" style="margin:0;font-size:0.85rem;">Run npm audit to load dependency vulnerability results.</p></div>`;
    }
    if (audit.error) {
      return `
        <div style="padding:16px;border-radius:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);">
          <p style="margin:0;color:#fbbf24;font-weight:600;font-size:0.85rem;">⚠ npm audit failed</p>
          <p class="text-muted" style="margin-top:6px;font-size:0.78rem;">${escapeHtml(audit.error)}</p>
        </div>
      `;
    }

    const s = npmAuditSummary(audit);
    const hasVulns = s.vulnerabilityTotal > 0;
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        <div class="au-v3-metric" style="margin-bottom:0;">
          <div><div class="au-v3-metric-val">${formatNumber(s.dependencies) || '—'}</div><div class="au-v3-metric-label">Dependencies</div></div>
        </div>
        <div class="au-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.critical > 0 ? '#ef4444' : 'transparent'};">
          <div><div class="au-v3-metric-val" style="color:${s.critical > 0 ? '#f87171' : 'var(--text-primary)'};">${s.critical}</div><div class="au-v3-metric-label">Critical</div></div>
        </div>
        <div class="au-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.high > 0 ? '#f97316' : 'transparent'};">
          <div><div class="au-v3-metric-val" style="color:${s.high > 0 ? '#f97316' : 'var(--text-primary)'};">${s.high}</div><div class="au-v3-metric-label">High</div></div>
        </div>
        <div class="au-v3-metric" style="margin-bottom:0;border-left:3px solid ${hasVulns ? '#eab308' : 'transparent'};">
          <div><div class="au-v3-metric-val" style="color:${hasVulns ? '#eab308' : 'var(--text-primary)'};">${s.vulnerabilityTotal}</div><div class="au-v3-metric-label">Total Vulns</div></div>
        </div>
      </div>
      ${!hasVulns && s.dependencies
        ? `<p style="text-align:center;margin:0;color:#22c55e;font-weight:600;font-size:0.85rem;">✅ Clean audit — ${formatNumber(s.dependencies)} dependencies, 0 known vulnerabilities.</p>`
        : ''}
      ${hasVulns ? `
        <div style="margin-top:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Vulnerability Details</span>
            <span class="au-v3-npm-meta">${renderComplianceBadges('dependency-vulns')}</span>
          </div>
          ${this.renderNpmVulnList(audit)}
        </div>
      ` : ''}
    `;
  }

  renderNpmVulnList(audit) {
    const rawVulns = audit?.vulnerabilities || audit?.advisories || {};
    const vulnList = [];
    if (typeof rawVulns === 'object' && rawVulns !== null) {
      for (const [pkg, info] of Object.entries(rawVulns)) {
        if (info && typeof info === 'object') {
          const sev = info.severity || info.via?.[0]?.severity || 'unknown';
          const title = info.via?.[0]?.title || info.title || info.overview || '';
          const fixAvailable = info.fixAvailable != null ? (info.fixAvailable ? '✅ Fix available' : '❌ No fix') : '';
          vulnList.push({ package: pkg, severity: sev, title, fixAvailable });
        }
      }
    }
    if (!vulnList.length) return '';
    return vulnList.map((v) => `
      <div class="au-v3-npm-vuln severity-${v.severity}">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <strong style="color:var(--text-primary);font-size:0.82rem;">${escapeHtml(v.package)}</strong>
            <span class="severity-pill ${v.severity}">${escapeHtml(v.severity)}</span>
            ${v.fixAvailable ? `<span style="font-size:0.72rem;color:var(--text-muted);">${escapeHtml(v.fixAvailable)}</span>` : ''}
          </div>
          <p style="margin:0;font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(v.title)}</p>
        </div>
      </div>
    `).join('');
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
          body: '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>'
        })}
      `;
      return el;
    }

    if (this.error && !this.audit) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Compliance Audit</h1><p class="text-muted analyze-hero-sub">Audit unavailable</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
          title: 'Audit unavailable',
          body: escapeHtml(this.error),
          actions: [{ label: 'Retry', id: 'audit-retry', className: 'btn-primary' }]
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
    const gatePass = Boolean(gate.pass);
    const gateColor = gatePass ? '#22c55e' : '#ef4444';
    const gateClass = gatePass ? 'success' : 'danger';

    el.innerHTML = `
      <style>
        @keyframes au-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .au-v3 { animation:au-fade-up .5s ease both; }
        .au-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .au-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .au-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .au-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:20px; }
        [data-theme='light'] .au-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .au-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .au-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .au-v3-card-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .au-v3-card-bd { padding:18px 22px; }
        .au-v3-kpi { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; padding:22px; position:relative; overflow:hidden; backdrop-filter:blur(12px); transition:transform .3s ease, box-shadow .3s ease; animation:au-fade-up .5s ease both; }
        [data-theme='light'] .au-v3-kpi { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); }
        .au-v3-kpi:hover { transform:translateY(-6px); box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        .au-v3-kpi::after { content:''; position:absolute; top:0; left:0; right:0; height:4px; border-radius:20px 20px 0 0; opacity:.9; }
        .au-v3-kpi.kpi-pass::after { background:linear-gradient(90deg,#22c55e,#4ade80); }
        .au-v3-kpi.kpi-fail::after { background:linear-gradient(90deg,#ef4444,#f87171); }
        .au-v3-kpi.kpi-info::after { background:linear-gradient(90deg,#6366f1,#a78bfa); }
        .au-v3-kpi.kpi-warn::after { background:linear-gradient(90deg,#f59e0b,#fbbf24); }
        .au-v3-kpi-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:14px; }
        .au-v3-kpi-label { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .au-v3-kpi-value { font-size:1.8rem; font-weight:800; margin-bottom:6px; letter-spacing:-0.02em; }
        .au-v3-kpi-meta { font-size:0.78rem; color:var(--text-muted); font-weight:500; }
        .au-v3-layer { background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); border-radius:14px; padding:16px; transition:background .2s; }
        .au-v3-layer:hover { background:rgba(148,163,184,0.08); }
        .au-v3-layer-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .au-v3-layer-title { font-size:0.88rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px; }
        .au-v3-layer-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        .au-v3-layer-item { display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-secondary); padding:6px 10px; background:rgba(148,163,184,0.04); border-radius:8px; }
        .au-v3-layer-item strong { color:var(--text-primary); font-weight:600; }
        .au-v3-scope { display:flex; align-items:center; gap:8px; padding:12px 16px; background:rgba(148,163,184,0.04); border-radius:12px; border:1px solid rgba(148,163,184,0.06); font-size:0.82rem; color:var(--text-secondary); }
        .au-v3-scope strong { color:var(--text-primary); font-weight:600; }
        .au-v3-table { width:100%; border-collapse:separate; border-spacing:0; }
        .au-v3-table th { text-align:left; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid rgba(148,163,184,0.1); }
        .au-v3-table td { padding:10px 14px; font-size:0.82rem; color:var(--text-secondary); border-bottom:1px solid rgba(148,163,184,0.06); }
        .au-v3-table tr:last-child td { border-bottom:none; }
        .au-v3-table code { background:rgba(148,163,184,0.08); padding:2px 6px; border-radius:4px; font-size:0.78rem; }
        .au-v3-npm-vuln { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); margin-bottom:6px; }
        .au-v3-npm-vuln.severity-critical { border-left:3px solid #ef4444; }
        .au-v3-npm-vuln.severity-high { border-left:3px solid #f97316; }
        .au-v3-npm-vuln.severity-moderate { border-left:3px solid #eab308; }
        .au-v3-compliance-bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px; padding-top:8px; border-top:1px solid rgba(148,163,184,0.08); }
        .au-v3-compliance-label { font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .cm-badge { display:inline-flex; align-items:center; gap:4px; font-size:0.68rem; font-weight:700; padding:2px 8px; border-radius:6px; white-space:nowrap; transition:transform .15s; }
        .cm-badge:hover { transform:translateY(-1px); }
        .au-v3-npm-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      </style>

      <div class="au-v3-header">
        <div>
          <h1>Compliance Audit</h1>
          <p>Credentials, fiction KPIs, schema, production leaks, roadmap, Jest baseline, and npm audit</p>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="btn btn-primary btn-sm" data-action="scan" ${this.running === 'scan' ? 'disabled' : ''}>
            ${this.running === 'scan' ? '<span class="loading-spinner"></span> Scanning…' : 'Run Perimeter Scan'}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="assess" ${this.running === 'assess' ? 'disabled' : ''}>
            ${this.running === 'assess' ? 'Assessing…' : 'Run Assessment'}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="npm" ${this.running === 'npm' ? 'disabled' : ''}>
            ${this.running === 'npm' ? 'Auditing…' : 'Run npm audit'}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="results">View Issues</button>
          <button type="button" class="btn btn-ghost btn-sm" id="audit-export-btn" title="Export">Export</button>
          <button type="button" class="btn btn-ghost btn-sm" id="audit-send-ai-btn" title="Send to AI">🤖 AI</button>
        </div>
      </div>

      ${this.refreshing ? '<div class="au-v3-scope" style="margin-bottom:16px;"><span class="loading-spinner" style="width:14px;height:14px;"></span>Refreshing audit data…</div>' : ''}

      <div class="au-v3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
        <div class="au-v3-kpi kpi-${gateClass}">
          <div class="au-v3-kpi-icon" style="background:${gatePass ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${gateColor};">${gatePass ? '✅' : '❌'}</div>
          <div class="au-v3-kpi-label">Gate Status</div>
          <div class="au-v3-kpi-value" style="color:${gateColor};">${gatePass ? 'PASS' : 'FAIL'}</div>
          <div class="au-v3-kpi-meta">${gate.blockingCount ?? 0} blocking issues</div>
        </div>
        <div class="au-v3-kpi kpi-info">
          <div class="au-v3-kpi-icon" style="background:rgba(99,102,241,0.15); color:#a78bfa;">📊</div>
          <div class="au-v3-kpi-label">Consistency</div>
          <div class="au-v3-kpi-value">${formatPercent(metrics.consistencyScore)}</div>
          <div class="au-v3-kpi-meta">Schema compliance rating</div>
        </div>
        <div class="au-v3-kpi kpi-warn">
          <div class="au-v3-kpi-icon" style="background:rgba(245,158,11,0.15); color:#fbbf24;">🧪</div>
          <div class="au-v3-kpi-label">Page Specs</div>
          <div class="au-v3-kpi-value">${escapeHtml(String(metrics.pageSpecsLabel))}</div>
          <div class="au-v3-kpi-meta">JSON schema checks</div>
        </div>
      </div>

      ${renderScanScope(metrics)}

      ${assessment?.executiveSummary ? this.renderAssessmentSummary(assessment, this.assessmentHighlight) : `
        <div class="au-v3-card" id="audit-assessment-summary">
          <div class="au-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Assessment Summary</h3>
          </div>
          <div class="au-v3-card-bd" style="text-align:center;padding:40px;">
            <div style="font-size:48px;margin-bottom:16px;">📋</div>
            <h3 style="margin:0 0 8px;font-size:1.1rem;color:var(--text-primary);">No assessment generated yet</h3>
            <p class="text-muted" style="margin:0 0 20px;font-size:0.85rem;max-width:400px;margin-left:auto;margin-right:auto;">Run assessment to generate the executive summary and compliance checklist from the latest scan.</p>
            <button type="button" class="btn btn-secondary btn-sm" data-action="assess">Run Assessment</button>
          </div>
        </div>
      `}

      <div class="au-v3-card">
        <div class="au-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">� Regulatory Framework Coverage</h3>
          <span class="db-v3-panel-badge">3 frameworks</span>
        </div>
        <div class="au-v3-card-bd">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            <div style="padding:14px;border-radius:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);">
              <div style="font-size:0.72rem;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">OWASP Top 10</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;">A01, A02, A03, A05, A06, A07, A08, A09, A11 mapped to credential leaks, XSS, vulnerable components, and logging failures.</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.12);">
              <div style="font-size:0.72rem;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">EU AI Act</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;">Art. 10 (Data Governance), Art. 15 (Robustness), Art. 52 (Transparency) mapped to AI residue, fiction KPIs, and placeholder leakage.</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.12);">
              <div style="font-size:0.72rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">NIST CSF</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;">PR.AC, PR.DS, PR.IP, PR.MA, PR.PT, ID.RA, RS.AN mapped to access control, data protection, and risk assessment.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="au-v3-card">
        <div class="au-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">�🔍 Audit Layers</h3>
          <span class="db-v3-panel-badge">${Object.keys(layers).filter(k => k !== 'gate').length} layers</span>
        </div>
        <div class="au-v3-card-bd">
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
            ${Object.entries(layers).filter(([k]) => k !== 'gate').map(([k, v]) => this.renderLayerCard(k, v, metrics)).join('')}
          </div>
        </div>
      </div>

      <div class="au-v3-card">
        <div class="au-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">🎭 Fiction Detection Catalog</h3>
          <span class="db-v3-panel-badge">${(audit.fictionCatalog || []).length} patterns</span>
        </div>
        <div class="au-v3-card-bd">
          ${this.renderFictionCatalog(audit.fictionCatalog, layers.fictionKpis?.findings ?? 0)}
        </div>
      </div>

      <div class="au-v3-card">
        <div class="au-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">📦 npm Audit</h3>
        </div>
        <div class="au-v3-card-bd">
          ${this.renderNpmAudit(audit.npmAudit)}
        </div>
      </div>
    `;

    el.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.handleAction(btn.dataset.action, el.parentElement);
      });
    });

    el.querySelector('#audit-export-btn')?.addEventListener('click', () => {
      const audit = this.app.state.audit;
      const report = this.app.state.report;
      const payload = {
        audit,
        report,
        exportedAt: new Date().toISOString()
      };
      downloadJson(payload, `simplebeacon-audit-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('Full audit data exported', 'success');
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
      if (!audit && !report) { showToast('No audit data — run a scan first', 'error'); return; }
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
        projectPath: report?.projectRoot || report?.projectPath || this.app.state.lastProjectPath || window.location.origin,
        reportType: 'compliance-audit',
        reportSummary: {
          gatePass: report?.gate?.pass ?? 'N/A',
          qualityScore: report?.qualityScore ?? 'N/A',
          consistencyScore: audit?.report?.consistencyScore ?? 'N/A',
          totalIssues: report?.issueCount ?? (report?.rawIssues?.length ?? 0),
          npmAuditVulnerabilities: npmAudit?.summary?.vulnerabilityTotal ?? 'N/A',
          layers: Object.keys(audit?.layers || {})
        },
        issues: vulnList.slice(0, 200),
        notes: 'Compliance Audit — perimeter scan, assessment, npm audit layers'
      };
      const vscode = this._getVscodeApi?.();
      if (vscode) {
        try { vscode.postMessage({ command: 'sendToAI', data: payload }); showToast('Audit data sent to AI agent', 'success'); return; }
        catch (err) { console.warn('[Audit-AI] vscode.postMessage failed:', err); } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
      }
      try {
        const res = await fetch(apiUrl('/api/ai-context'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success && json.content) { await navigator.clipboard.writeText(json.content); showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success'); }
        else { showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success'); }
      } catch (err) { showToast('Failed to send: ' + err.message, 'error'); }
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
        repositoryInventory: live.repositoryInventory ?? audit.report?.repositoryInventory
      },
      auditLayers: audit.auditLayers
    };
  }

  paint(container = this._container) {
    if (!container) return;
    this._container = container;
    container.innerHTML = '';
    try {
      container.appendChild(this.render());
    } catch (err) {
      console.error('[AuditView] Render error:', err);
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
        this.paint();
      } else {
        this.refreshing = true;
        this.error = null;
        this.paint();
      }

      try {
        const audit = await this.app.scanService.fetchAudit(includeNpm);
        this.audit = this.mergeLiveReport(audit);
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
  }
}
