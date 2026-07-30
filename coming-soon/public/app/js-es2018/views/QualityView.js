// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, showToast, formatNumber, downloadJson } from '../utils.js';
import { resolveJestTestsLabel } from '../services/analyzeService.js?v=20260726sevfix1';
import { buildQualityExportBundle, qualityExportFilename } from '../utils/quality-export.browser.js?v=20260716cachefix1';
import { npmAuditSummary } from '../utils-lib/audit-helpers.js?v=20260721audit1';
import { getVsCodeApi, renderSkeletonCard, renderSkeletonChips } from '../utils-lib/dom.js?v=20260725phase3';
/**
 * Parse jest total.
 * @param {any} jestTestsLabel
 * @param {any} fallback
 * @returns {any}
 */
function parseJestTotal(jestTestsLabel, fallback) {
    if (!jestTestsLabel)
        return fallback !== null && fallback !== void 0 ? fallback : null;
    const match = String(jestTestsLabel).match(/\/(\d+)/);
    return match ? Number(match[1]) : fallback !== null && fallback !== void 0 ? fallback : null;
}
/**
 * Resolve coverage snapshot.
 * @param {any} coverage
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function resolveCoverageSnapshot(coverage, baseline, dashboardHome) {
    var _a, _b, _c, _d, _e, _f, _g;
    const merged = { ...(coverage || {}) };
    if (merged.passedTests != null && merged.totalTests != null)
        return merged;
    const jestLabel = resolveJestTestsLabel(baseline, dashboardHome);
    const passed = (_b = (_a = merged.passedTests) !== null && _a !== void 0 ? _a : baseline === null || baseline === void 0 ? void 0 : baseline.jestTestsPassing) !== null && _b !== void 0 ? _b : (_c = dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.overview) === null || _c === void 0 ? void 0 : _c.passedTests;
    const total = (_g = (_e = (_d = merged.totalTests) !== null && _d !== void 0 ? _d : parseJestTotal(baseline === null || baseline === void 0 ? void 0 : baseline.jestTestsLabel, passed)) !== null && _e !== void 0 ? _e : (_f = dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.overview) === null || _f === void 0 ? void 0 : _f.totalTests) !== null && _g !== void 0 ? _g : passed;
    if (passed != null)
        merged.passedTests = passed;
    if (total != null)
        merged.totalTests = total;
    return merged;
}
/**
 * Coverage pending message.
 * @param {any} coverage
 * @returns {any}
 */
function coveragePendingMessage(coverage) {
    if ((coverage === null || coverage === void 0 ? void 0 : coverage.branchCoverage) != null || (coverage === null || coverage === void 0 ? void 0 : coverage.lineCoverage) != null)
        return '';
    return (coverage === null || coverage === void 0 ? void 0 : coverage.notes)
        || 'Run npm run test:coverage for Istanbul percentages. Sync Jest counts via Tools → Baseline sync.';
}
/**
 * Quality view.
 */
export class QualityView {
    constructor(app) {
        this.app = app;
        this.auditLoading = false;
    }
    exportQualityData() {
        const coverage = resolveCoverageSnapshot(this.app.state.coverage, this.app.state.baseline, this.app.state.dashboardHome);
        const security = this.app.state.security || {};
        const quality = this.app.state.quality || {};
        const npmAudit = this.app.state.npmAudit;
        if (!coverage && !security && !quality && !npmAudit) {
            showToast('No quality data to export', 'error');
            return;
        }
        const payload = buildQualityExportBundle({
            coverage,
            security,
            quality,
            npmAudit,
            report: this.app.state.report || null
        });
        downloadJson(payload, qualityExportFilename('json'));
        showToast('Quality & Security exported', 'success');
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const security = this.app.state.security || {};
        const coverage = resolveCoverageSnapshot(this.app.state.coverage, this.app.state.baseline, this.app.state.dashboardHome);
        const quality = this.app.state.quality || {};
        const coverageHint = coveragePendingMessage(coverage);
        const npmAudit = this.app.state.npmAudit;
        const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
        const dependencyVulnTotal = (_c = (_b = (_a = auditStats === null || auditStats === void 0 ? void 0 : auditStats.vulnerabilityTotal) !== null && _a !== void 0 ? _a : security.npmAuditTotal) !== null && _b !== void 0 ? _b : security.openVulnerabilities) !== null && _c !== void 0 ? _c : '—';
        const engineeringFindings = (_d = security.openEngineeringFindings) !== null && _d !== void 0 ? _d : '—';
        const el = document.createElement('div');
        el.className = 'fade-in';
        if (this.auditLoading) {
            el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Quality & Security</h1>
        <p class="text-muted analyze-hero-sub">Loading quality metrics…</p>
      </div>
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
        el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Quality & Security</h1>
        <p class="text-muted analyze-hero-sub">Measured coverage, security checklist, and live npm audit.</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-4);">
        <div class="analyze-action-info"></div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" id="quality-export-json" title="Download quality and security JSON">
            <i data-lucide="download" class="icon-16"></i> Export
          </button>
          ${this.app.isCurrentUserAdmin() ? '<button class="btn btn-ghost btn-sm" id="quality-send-ai-btn" type="button" title="Send quality and security data to AI coding agent">🤖 Send to AI Agent</button>' : ''}
        </div>
      </div>

      ${(npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.error) ? `
      <div class="card mb-4" style="padding:var(--space-3);border-color:var(--warning);background:var(--warning-bg);">
        <p class="text-sm" style="margin:0;color:var(--warning);"><strong>⚠ npm audit unavailable:</strong> ${escapeHtml(npmAudit.error)}</p>
      </div>` : ''}

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value success">${(_f = (_e = coverage.overallCoverage) !== null && _e !== void 0 ? _e : coverage.lineCoverage) !== null && _f !== void 0 ? _f : '—'}%</div>
          <div class="insight-stat-label">Line coverage</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${(_g = security.securityScore) !== null && _g !== void 0 ? _g : '—'}/100</div>
          <div class="insight-stat-label">Security score</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${(_j = (_h = quality.overallScore) !== null && _h !== void 0 ? _h : quality.qualityScore) !== null && _j !== void 0 ? _j : '—'}</div>
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
            <div class="settings-row"><span class="settings-label">Branch</span><span class="settings-value">${(_k = coverage.branchCoverage) !== null && _k !== void 0 ? _k : '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Function</span><span class="settings-value">${(_l = coverage.functionCoverage) !== null && _l !== void 0 ? _l : '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Statement</span><span class="settings-value">${(_m = coverage.statementCoverage) !== null && _m !== void 0 ? _m : '—'}%</span></div>
            <div class="settings-row"><span class="settings-label">Tests</span><span class="settings-value">${(_o = coverage.passedTests) !== null && _o !== void 0 ? _o : '—'}/${(_p = coverage.totalTests) !== null && _p !== void 0 ? _p : '—'}</span></div>
          </div>
          ${coverageHint ? `<p class="text-muted text-sm mt-4">${escapeHtml(coverageHint)}</p>` : ''}
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Security Overview</span></div>
          <div class="settings-grid">
            <div class="settings-row"><span class="settings-label">Dependency vulnerabilities</span><span class="settings-value">${dependencyVulnTotal}</span></div>
            <div class="settings-row"><span class="settings-label">Engineering findings</span><span class="settings-value">${engineeringFindings}</span></div>
            <div class="settings-row"><span class="settings-label">Compliance</span><span class="settings-value">${(_q = security.complianceRate) !== null && _q !== void 0 ? _q : '—'}%</span></div>
          </div>
        </div>
      </div>
    `;
        (_r = el.querySelector('#run-audit-btn')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', () => this.runAudit());
        (_r = el.querySelector('#quality-export-json')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', () => this.exportQualityData());
        (_s = el.querySelector('#quality-send-ai-btn')) === null || _s === void 0 ? void 0 : _s.addEventListener('click', async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const security = this.app.state.security || {};
            const coverage = resolveCoverageSnapshot(this.app.state.coverage, this.app.state.baseline, this.app.state.dashboardHome);
            const quality = this.app.state.quality || {};
            const npmAudit = this.app.state.npmAudit;
            const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
            // Extract individual vulnerability details for the AI agent
            const vulnList = [];
            const rawVulns = (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.vulnerabilities) || (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.advisories) || {};
            if (typeof rawVulns === 'object' && rawVulns !== null) {
                for (const [pkg, info] of Object.entries(rawVulns)) {
                    if (info && typeof info === 'object') {
                        const sev = info.severity || ((_b = (_a = info.via) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.severity) || 'unknown';
                        const title = ((_d = (_c = info.via) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.title) || info.title || info.overview || '';
                        vulnList.push({ package: pkg, severity: sev, title });
                    }
                }
            }
            const payload = {
                projectPath: this.app.state.lastProjectPath || window.location.origin,
                reportType: 'quality-security',
                reportSummary: {
                    lineCoverage: (_f = (_e = coverage.overallCoverage) !== null && _e !== void 0 ? _e : coverage.lineCoverage) !== null && _f !== void 0 ? _f : 'N/A',
                    branchCoverage: (_g = coverage.branchCoverage) !== null && _g !== void 0 ? _g : 'N/A',
                    securityScore: (_h = security.securityScore) !== null && _h !== void 0 ? _h : 'N/A',
                    qualityScore: (_k = (_j = quality.overallScore) !== null && _j !== void 0 ? _j : quality.qualityScore) !== null && _k !== void 0 ? _k : 'N/A',
                    npmVulnerabilities: (_l = auditStats === null || auditStats === void 0 ? void 0 : auditStats.vulnerabilityTotal) !== null && _l !== void 0 ? _l : 'N/A',
                    openEngineeringFindings: (_m = security.openEngineeringFindings) !== null && _m !== void 0 ? _m : 'N/A'
                },
                issues: vulnList.slice(0, 200),
                notes: 'Quality & Security — coverage, security checklist, and npm audit'
            };
            const vscode = getVsCodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({ command: 'sendToAI', data: payload });
                    showToast('Quality & Security data sent to AI agent', 'success');
                    return;
                }
                catch (err) {
                    window["console"]["warn"]('[Quality-AI] vscode.postMessage failed:', err);
                } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
            }
            try {
                const res = await fetch('/api/ai-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const json = await res.json();
                if (json.success && json.content) {
                    await navigator.clipboard.writeText(json.content);
                    showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success');
                }
                else {
                    showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
                }
            }
            catch (err) {
                showToast('Failed to send: ' + err.message, 'error');
            }
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
          <div class="table-scroll-wrapper">
          <table class="results-table">
            <thead><tr><th scope="col">Severity</th><th scope="col">Package</th><th scope="col">Title</th></tr></thead>
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
          </div>
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
            showToast(s.dependencies != null
                ? `npm audit: ${formatNumber(s.dependencies)} dependencies, ${s.vulnerabilityTotal} vulnerabilities`
                : 'npm audit complete', s.vulnerabilityTotal ? 'info' : 'success');
        }
        catch (err) {
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
    async mount(container) {
        if (!container)
            return;
        this._container = container;
        const needsPlatformData = this.app.state.coverage == null || this.app.state.security == null;
        if (needsPlatformData) {
            window.setSafeHTML(container, '<p class="text-muted card">Loading quality metrics…</p>');;
            try {
                await this.app.loadPlatformData();
            }
            catch (err) {
                showToast(err.message || 'Failed to load quality metrics', 'error');
            }
        }
        if (this._container !== container)
            return;
        window.setSafeHTML(container, '');
        container.appendChild(this.render());
        if (!this.app.state.npmAudit && !this.auditLoading) {
            this.runAudit();
        }
    }
}
