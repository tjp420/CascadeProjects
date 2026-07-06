import { escapeHtml, showToast, formatNumber, apiUrl } from '../utils.js';
import { resolveJestTestsLabel } from '../services/analyzeService.js';
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
 * Npm audit summary.
 * @param {any} audit
 * @returns {any}
 */
function npmAuditSummary(audit) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const summary = (audit === null || audit === void 0 ? void 0 : audit.summary) || ((_a = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _a === void 0 ? void 0 : _a.vulnerabilities) || {};
    const deps = (audit === null || audit === void 0 ? void 0 : audit.dependencies) || ((_b = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _b === void 0 ? void 0 : _b.dependencies) || {};
    return {
        dependencies: (_d = (_c = summary.dependencies) !== null && _c !== void 0 ? _c : deps.total) !== null && _d !== void 0 ? _d : null,
        prod: (_f = (_e = summary.prodDependencies) !== null && _e !== void 0 ? _e : deps.prod) !== null && _f !== void 0 ? _f : null,
        dev: (_h = (_g = summary.devDependencies) !== null && _g !== void 0 ? _g : deps.dev) !== null && _h !== void 0 ? _h : null,
        critical: (_j = summary.critical) !== null && _j !== void 0 ? _j : 0,
        high: (_k = summary.high) !== null && _k !== void 0 ? _k : 0,
        moderate: (_m = (_l = summary.moderate) !== null && _l !== void 0 ? _l : summary.medium) !== null && _m !== void 0 ? _m : 0,
        low: (_o = summary.low) !== null && _o !== void 0 ? _o : 0,
        vulnerabilityTotal: (_q = (_p = summary.vulnerabilityTotal) !== null && _p !== void 0 ? _p : summary.total) !== null && _q !== void 0 ? _q : ((_s = (_r = audit === null || audit === void 0 ? void 0 : audit.vulnerabilities) === null || _r === void 0 ? void 0 : _r.length) !== null && _s !== void 0 ? _s : 0),
        generatedAt: (_t = audit === null || audit === void 0 ? void 0 : audit.generatedAt) !== null && _t !== void 0 ? _t : null
    };
}
/**
 * Compute branch coverage percentage from Istanbul b object.
 * @param {Object} b
 * @returns {number|null}
 */
function computeBranchPct(b) {
    if (!b)
        return null;
    let total = 0, hit = 0;
    for (const branches of Object.values(b)) {
        if (!Array.isArray(branches))
            continue;
        total += branches.length;
        hit += branches.filter((v) => v > 0).length;
    }
    return total > 0 ? Math.round((hit / total) * 100) : 0;
}
/**
 * Extract top N files with lowest statement coverage from Istanbul JSON.
 * @param {Object} coverage
 * @param {number} limit
 * @returns {Array}
 */
function extractTopUntestedFiles(coverage, limit = 5) {
    if (!coverage || typeof coverage !== 'object')
        return [];
    const files = [];
    for (const [file, data] of Object.entries(coverage)) {
        if (typeof data !== 'object' || !data.s)
            continue;
        const statements = Object.values(data.s);
        const total = statements.length;
        const hit = statements.filter((v) => v > 0).length;
        const statementPct = total > 0 ? Math.round((hit / total) * 100) : 0;
        if (statementPct < 100) {
            files.push({ file, statementPct, branchPct: computeBranchPct(data.b), total, hit });
        }
    }
    return files.sort((a, b) => a.statementPct - b.statementPct).slice(0, limit);
}
/**
 * Get or initialize quality history from localStorage.
 * @returns {Object}
 */
function getQualityHistory() {
    try {
        const raw = localStorage.getItem('simplebeacon_quality_history');
        if (raw)
            return JSON.parse(raw);
    }
    catch ( /* ignore */_a) { /* ignore */ }
    return { lineCoverage: [], securityScore: [], qualityScore: [], timestamps: [] };
}
/**
 * Save a new snapshot to quality history.
 * @param {Object} snapshot
 */
function saveQualityHistory(snapshot) {
    var _a, _b, _c;
    const hist = getQualityHistory();
    const now = new Date().toISOString();
    hist.lineCoverage.push((_a = snapshot.lineCoverage) !== null && _a !== void 0 ? _a : null);
    hist.securityScore.push((_b = snapshot.securityScore) !== null && _b !== void 0 ? _b : null);
    hist.qualityScore.push((_c = snapshot.qualityScore) !== null && _c !== void 0 ? _c : null);
    hist.timestamps.push(now);
    // Keep last 10
    if (hist.lineCoverage.length > 10) {
        hist.lineCoverage.shift();
        hist.securityScore.shift();
        hist.qualityScore.shift();
        hist.timestamps.shift();
    }
    try {
        localStorage.setItem('simplebeacon_quality_history', JSON.stringify(hist));
    }
    catch ( /* ignore */_d) { /* ignore */ }
}
/**
 * Render a simple SVG sparkline from numeric array.
 * @param {Array<number|null>} values
 * @param {string} color
 * @returns {string}
 */
function renderSparkline(values, color) {
    const valid = values.filter((v) => v != null);
    if (valid.length < 2)
        return '';
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const w = 100, h = 24;
    const points = valid.map((v, i) => {
        const x = (i / (valid.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" style="overflow:visible;" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg>`;
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
        if (this._vscodeApiCached)
            return this._vscodeApiCached;
        if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function')
            return null;
        try {
            this._vscodeApiCached = window.acquireVsCodeApi();
            return this._vscodeApiCached;
        }
        catch (_a) {
            return null;
        }
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
        const lineCov = (_f = (_e = coverage.overallCoverage) !== null && _e !== void 0 ? _e : coverage.lineCoverage) !== null && _f !== void 0 ? _f : null;
        const secScore = (_g = security.securityScore) !== null && _g !== void 0 ? _g : null;
        const qualScore = (_j = (_h = quality.overallScore) !== null && _h !== void 0 ? _h : quality.qualityScore) !== null && _j !== void 0 ? _j : null;
        // Persist current snapshot for sparkline history
        saveQualityHistory({ lineCoverage: lineCov, securityScore: secScore, qualityScore: qualScore });
        const hist = getQualityHistory();
        const untestedFiles = extractTopUntestedFiles(this.app.state.coverageRaw || this.app.state.coverage, 5);
        const covClass = lineCov != null && lineCov >= 80 ? 'success' : lineCov != null && lineCov >= 50 ? 'warning' : 'danger';
        const covColor = lineCov != null && lineCov >= 80 ? '#22c55e' : lineCov != null && lineCov >= 50 ? '#f59e0b' : '#ef4444';
        const secClass = secScore != null && secScore >= 80 ? 'success' : secScore != null && secScore >= 50 ? 'warning' : 'danger';
        const secColor = secScore != null && secScore >= 80 ? '#22c55e' : secScore != null && secScore >= 50 ? '#f59e0b' : '#ef4444';
        el.innerHTML = `
      <style>
        @keyframes qu-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .qu-v3 { animation:qu-fade-up .5s ease both; }
        .qu-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .qu-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .qu-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .qu-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:20px; }
        [data-theme='light'] .qu-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .qu-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .qu-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .qu-v3-card-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .qu-v3-card-bd { padding:18px 22px; }
        .qu-v3-kpi { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; padding:22px; position:relative; overflow:hidden; backdrop-filter:blur(12px); transition:transform .3s ease, box-shadow .3s ease; animation:qu-fade-up .5s ease both; }
        [data-theme='light'] .qu-v3-kpi { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); }
        .qu-v3-kpi:hover { transform:translateY(-6px); box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        .qu-v3-kpi::after { content:''; position:absolute; top:0; left:0; right:0; height:4px; border-radius:20px 20px 0 0; opacity:.9; }
        .qu-v3-kpi.kpi-cov::after { background:linear-gradient(90deg,${covColor},${covClass === 'success' ? '#4ade80' : covClass === 'warning' ? '#fbbf24' : '#f87171'}); }
        .qu-v3-kpi.kpi-sec::after { background:linear-gradient(90deg,${secColor},${secClass === 'success' ? '#4ade80' : secClass === 'warning' ? '#fbbf24' : '#f87171'}); }
        .qu-v3-kpi.kpi-qual::after { background:linear-gradient(90deg,#6366f1,#a78bfa); }
        .qu-v3-kpi-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:14px; }
        .qu-v3-kpi-label { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .qu-v3-kpi-value { font-size:1.8rem; font-weight:800; margin-bottom:6px; letter-spacing:-0.02em; }
        .qu-v3-kpi-meta { font-size:0.78rem; color:var(--text-muted); font-weight:500; }
        .qu-v3-kpi-spark { position:absolute; right:18px; bottom:18px; opacity:0.6; }
        .qu-v3-gap-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); margin-bottom:6px; transition:background .15s; }
        .qu-v3-gap-row:hover { background:rgba(148,163,184,0.08); }
        .qu-v3-gap-file { flex:1; min-width:0; font-size:0.78rem; color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .qu-v3-gap-pct { font-size:0.72rem; font-weight:700; padding:3px 10px; border-radius:999px; background:rgba(239,68,68,0.1); color:#f87171; }
        .qu-v3-gap-pct.warn { background:rgba(245,158,11,0.1); color:#fbbf24; }
        .qu-v3-gap-actions { display:flex; gap:6px; flex-shrink:0; }
        .qu-v3-gap-btn { background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.15); color:#a78bfa; border-radius:6px; padding:4px 10px; font-size:0.68rem; font-weight:700; cursor:pointer; transition:all .15s; }
        .qu-v3-gap-btn:hover { background:rgba(99,102,241,0.2); }
        .qu-v3-audit-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); margin-bottom:6px; }
        .qu-v3-audit-row:hover { background:rgba(148,163,184,0.08); }
        .qu-v3-audit-name { flex:1; min-width:0; font-size:0.82rem; color:var(--text-primary); font-weight:600; }
        .qu-v3-audit-title { flex:2; min-width:0; font-size:0.78rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .qu-v3-upgrade-btn { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); color:#4ade80; border-radius:6px; padding:4px 10px; font-size:0.68rem; font-weight:700; cursor:pointer; transition:all .15s; }
        .qu-v3-upgrade-btn:hover { background:rgba(34,197,94,0.2); }
        .qu-v3-upgrade-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .qu-v3-metric { display:flex; align-items:center; gap:12px; padding:12px 16px; background:rgba(148,163,184,0.05); border-radius:12px; border:1px solid rgba(148,163,184,0.06); }
        .qu-v3-metric-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; background:rgba(99,102,241,0.12); color:#818cf8; }
        .qu-v3-metric-val { font-size:1.2rem; font-weight:700; color:var(--text-primary); }
        .qu-v3-metric-label { font-size:0.72rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
        .qu-v3-table { width:100%; border-collapse:separate; border-spacing:0; }
        .qu-v3-table th { text-align:left; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid rgba(148,163,184,0.1); }
        .qu-v3-table td { padding:10px 14px; font-size:0.82rem; color:var(--text-secondary); border-bottom:1px solid rgba(148,163,184,0.06); }
        .qu-v3-table tr:last-child td { border-bottom:none; }
        .qu-v3-table code { background:rgba(148,163,184,0.08); padding:2px 6px; border-radius:4px; font-size:0.78rem; }
      </style>

      <div class="qu-v3-header">
        <div>
          <h1>Quality & Security</h1>
          <p>Measured coverage, security checklist, and live npm audit</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="quality-send-ai-btn" type="button" title="Send to AI">🤖 AI Agent</button>
        </div>
      </div>

      <div class="qu-v3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
        <div class="qu-v3-kpi kpi-cov">
          <div class="qu-v3-kpi-icon" style="background:${covColor}20; color:${covColor};">📊</div>
          <div class="qu-v3-kpi-label">Line Coverage</div>
          <div class="qu-v3-kpi-value" style="color:${covColor};">${lineCov !== null && lineCov !== void 0 ? lineCov : '—'}${lineCov != null ? '%' : ''}</div>
          <div class="qu-v3-kpi-meta">${coverage.branchCoverage != null ? `Branch ${coverage.branchCoverage}%` : 'Istanbul report'}</div>
          <div class="qu-v3-kpi-spark">${renderSparkline(hist.lineCoverage, covColor)}</div>
        </div>
        <div class="qu-v3-kpi kpi-sec">
          <div class="qu-v3-kpi-icon" style="background:${secColor}20; color:${secColor};">🔒</div>
          <div class="qu-v3-kpi-label">Security Score</div>
          <div class="qu-v3-kpi-value" style="color:${secColor};">${secScore !== null && secScore !== void 0 ? secScore : '—'}${secScore != null ? '/100' : ''}</div>
          <div class="qu-v3-kpi-meta">${dependencyVulnTotal} dependency vulns</div>
          <div class="qu-v3-kpi-spark">${renderSparkline(hist.securityScore, secColor)}</div>
        </div>
        <div class="qu-v3-kpi kpi-qual">
          <div class="qu-v3-kpi-icon" style="background:rgba(99,102,241,0.15); color:#a78bfa;">✨</div>
          <div class="qu-v3-kpi-label">Quality Score</div>
          <div class="qu-v3-kpi-value">${qualScore !== null && qualScore !== void 0 ? qualScore : '—'}</div>
          <div class="qu-v3-kpi-meta">Code quality index</div>
          <div class="qu-v3-kpi-spark">${renderSparkline(hist.qualityScore, '#a78bfa')}</div>
        </div>
      </div>

      <div class="qu-v3-card">
        <div class="qu-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">📦 npm Audit (Live)</h3>
          <button class="btn btn-primary btn-sm" id="run-audit-btn" ${this.auditLoading ? 'disabled' : ''}>${this.auditLoading ? '<span class="loading-spinner"></span> Running…' : 'Run Audit'}</button>
        </div>
        <div class="qu-v3-card-bd" id="audit-results">${this.renderAudit(npmAudit)}</div>
      </div>

      <div class="qu-v3" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="qu-v3-card" id="coverage-details" data-scroll-target="coverage">
          <div class="qu-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📐 Coverage Breakdown</h3>
          </div>
          <div class="qu-v3-card-bd">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px;">
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24;">🌿</div>
                <div><div class="qu-v3-metric-val">${(_k = coverage.branchCoverage) !== null && _k !== void 0 ? _k : '—'}${coverage.branchCoverage != null ? '%' : ''}</div><div class="qu-v3-metric-label">Branch</div></div>
              </div>
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(99,102,241,0.15);color:#a78bfa;">⚙️</div>
                <div><div class="qu-v3-metric-val">${(_l = coverage.functionCoverage) !== null && _l !== void 0 ? _l : '—'}${coverage.functionCoverage != null ? '%' : ''}</div><div class="qu-v3-metric-label">Function</div></div>
              </div>
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(6,182,212,0.15);color:#67e8f9;">📄</div>
                <div><div class="qu-v3-metric-val">${(_m = coverage.statementCoverage) !== null && _m !== void 0 ? _m : '—'}${coverage.statementCoverage != null ? '%' : ''}</div><div class="qu-v3-metric-label">Statement</div></div>
              </div>
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(34,197,94,0.15);color:#4ade80;">🧪</div>
                <div><div class="qu-v3-metric-val">${(_o = coverage.passedTests) !== null && _o !== void 0 ? _o : '—'}/${(_p = coverage.totalTests) !== null && _p !== void 0 ? _p : '—'}</div><div class="qu-v3-metric-label">Tests</div></div>
              </div>
            </div>
            ${coverageHint ? `<p class="text-muted" style="font-size:0.78rem;margin:0 0 14px;">${escapeHtml(coverageHint)}</p>` : ''}
            ${untestedFiles.length ? `
              <div style="margin-top:14px;">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Top Untested Files</div>
                ${untestedFiles.map((f) => `
                  <div class="qu-v3-gap-row">
                    <span class="qu-v3-gap-file" title="${escapeHtml(f.file)}">${escapeHtml(f.file)}</span>
                    <span class="qu-v3-gap-pct ${f.statementPct >= 50 ? 'warn' : ''}">${f.statementPct}% stmt</span>
                    ${f.branchPct != null ? `<span class="qu-v3-gap-pct ${f.branchPct >= 50 ? 'warn' : ''}">${f.branchPct}% branch</span>` : ''}
                    <div class="qu-v3-gap-actions">
                      <button type="button" class="qu-v3-gap-btn qu-v3-open-file" data-file="${escapeHtml(f.file)}" title="Open in VS Code:">📂 Open</button>
                      <button type="button" class="qu-v3-gap-btn qu-v3-draft-test" data-file="${escapeHtml(f.file)}" title="Draft tests with AI">🤖 Draft Tests</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        <div class="qu-v3-card">
          <div class="qu-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔐 Security Overview</h3>
          </div>
          <div class="qu-v3-card-bd">
            <div style="display:grid;grid-template-columns:1fr;gap:10px;">
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(239,68,68,0.15);color:#f87171;">📦</div>
                <div><div class="qu-v3-metric-val">${dependencyVulnTotal}</div><div class="qu-v3-metric-label">Dependency Vulns</div></div>
              </div>
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24;">🔧</div>
                <div><div class="qu-v3-metric-val">${engineeringFindings}</div><div class="qu-v3-metric-label">Engineering Findings</div></div>
              </div>
              <div class="qu-v3-metric" style="margin-bottom:0;">
                <div class="qu-v3-metric-icon" style="background:rgba(34,197,94,0.15);color:#4ade80;">📋</div>
                <div><div class="qu-v3-metric-val">${(_q = security.complianceRate) !== null && _q !== void 0 ? _q : '—'}${security.complianceRate != null ? '%' : ''}</div><div class="qu-v3-metric-label">Compliance</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
        (_r = el.querySelector('#run-audit-btn')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', () => this.runAudit());
        // Open file in VS Code:
        el.querySelectorAll('.qu-v3-open-file').forEach((btn) => {
            btn.addEventListener('click', () => {
                const filePath = btn.dataset.file;
                if (!filePath)
                    return;
                const vscode = this._getVscodeApi();
                if (vscode) {
                    vscode.postMessage({ command: 'openFile', filePath });
                    showToast(`Opening ${filePath.split('/').pop()} in editor`, 'success');
                }
                else {
                    showToast('VS Code: extension required to open files', 'info');
                }
            });
        });
        // Draft tests with AI
        el.querySelectorAll('.qu-v3-draft-test').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const filePath = btn.dataset.file;
                if (!filePath)
                    return;
                const payload = {
                    projectPath: this.app.state.lastProjectPath || window.location.origin,
                    reportType: 'draft-tests',
                    targetFile: filePath,
                    notes: `Draft Jest/Vitest tests for uncovered lines in ${filePath}`
                };
                const vscode = this._getVscodeApi();
                if (vscode) {
                    try {
                        vscode.postMessage({ command: 'sendToAI', data: payload });
                        showToast('Draft test request sent to AI agent', 'success');
                    }
                    catch (err) {
                        showToast('VS Code: API error', 'error');
                    }
                }
                else {
                    try {
                        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        showToast('Test draft payload copied — paste into AI agent', 'success');
                    }
                    catch (_a) {
                        showToast('Failed to copy payload', 'error');
                    }
                }
            });
        });
        // Upgrade vulnerable packages
        el.querySelectorAll('.qu-v3-upgrade-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pkg = btn.dataset.package;
                if (!pkg)
                    return;
                btn.disabled = true;
                btn.textContent = 'Upgrading…';
                const vscode = this._getVscodeApi();
                if (vscode) {
                    vscode.postMessage({ command: 'runTerminalCommand', commandLine: `npm install ${pkg}@latest` });
                    showToast(`Upgrading ${pkg}…`, 'success');
                }
                else {
                    showToast(`Run: npm install ${pkg}@latest`, 'info');
                    btn.disabled = false;
                    btn.textContent = '⬆ Upgrade';
                }
            });
        });
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
            const vscode = this._getVscodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({ command: 'sendToAI', data: payload });
                    showToast('Quality & Security data sent to AI agent', 'success');
                    return;
                }
                catch (err) {
                    console.warn('[Quality-AI] vscode.postMessage failed:', err);
                } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
            }
            try {
                const res = await fetch(apiUrl('/api/ai-context'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
            return `<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:12px;">📦</div><p class="text-muted" style="margin:0;font-size:0.85rem;">Click “Run Audit” to fetch live npm audit results from the project root.</p></div>`;
        }
        if (audit.error || audit.success === false) {
            return `
        <div style="padding:16px;border-radius:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);">
          <p style="margin:0;color:#fbbf24;font-weight:600;font-size:0.85rem;">⚠ npm audit failed</p>
          <p class="text-muted" style="margin-top:6px;font-size:0.78rem;">${escapeHtml(audit.error || audit.message || 'Unknown error')}</p>
          ${audit.stdout ? `<pre style="font-size:0.72rem;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;overflow:auto;max-height:120px;margin-top:8px;">${escapeHtml(String(audit.stdout).slice(-1500))}</pre>` : ''}
        </div>
      `;
        }
        const s = npmAuditSummary(audit);
        const rawVulns = audit.vulnerabilities || audit.advisories;
        const vulnerabilities = Array.isArray(rawVulns) ? rawVulns : (rawVulns ? Object.values(rawVulns) : []);
        const clean = s.vulnerabilityTotal === 0;
        return `
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;">
        <div class="qu-v3-metric" style="margin-bottom:0;">
          <div><div class="qu-v3-metric-val">${formatNumber(s.dependencies) || '—'}</div><div class="qu-v3-metric-label">Dependencies</div></div>
        </div>
        <div class="qu-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.critical > 0 ? '#ef4444' : 'transparent'};">
          <div><div class="qu-v3-metric-val" style="color:${s.critical > 0 ? '#f87171' : 'var(--text-primary)'};">${s.critical}</div><div class="qu-v3-metric-label">Critical</div></div>
        </div>
        <div class="qu-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.high > 0 ? '#f97316' : 'transparent'};">
          <div><div class="qu-v3-metric-val" style="color:${s.high > 0 ? '#f97316' : 'var(--text-primary)'};">${s.high}</div><div class="qu-v3-metric-label">High</div></div>
        </div>
        <div class="qu-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.moderate > 0 ? '#eab308' : 'transparent'};">
          <div><div class="qu-v3-metric-val" style="color:${s.moderate > 0 ? '#eab308' : 'var(--text-primary)'};">${s.moderate}</div><div class="qu-v3-metric-label">Moderate</div></div>
        </div>
        <div class="qu-v3-metric" style="margin-bottom:0;border-left:3px solid ${s.low > 0 ? '#3b82f6' : 'transparent'};">
          <div><div class="qu-v3-metric-val" style="color:${s.low > 0 ? '#3b82f6' : 'var(--text-primary)'};">${s.low}</div><div class="qu-v3-metric-label">Low</div></div>
        </div>
      </div>
      ${s.prod != null ? `
        <p class="text-muted" style="font-size:0.78rem;margin:0 0 14px;">${formatNumber(s.prod)} prod · ${formatNumber(s.dev)} dev dependencies scanned.</p>
      ` : ''}
      ${clean ? `
        <p style="text-align:center;margin:0;color:#22c55e;font-weight:600;font-size:0.85rem;">✅ Clean audit — ${formatNumber(s.dependencies)} dependencies, 0 known vulnerabilities.</p>
      ` : ''}
      ${vulnerabilities.length ? `
        <div style="margin-bottom:10px;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Vulnerable Packages</div>
          ${vulnerabilities.slice(0, 20).map((v) => `
            <div class="qu-v3-audit-row">
              <span class="severity-pill ${escapeHtml(v.severity || 'unknown')}">${escapeHtml(v.severity || 'unknown')}</span>
              <span class="qu-v3-audit-name">${escapeHtml(v.component || v.name || v.module_name || '—')}</span>
              <span class="qu-v3-audit-title">${escapeHtml(v.title || v.overview || v.url || '—')}</span>
              <button type="button" class="qu-v3-upgrade-btn" data-package="${escapeHtml(v.component || v.name || v.module_name || '')}" title="Upgrade to latest">⬆ Upgrade</button>
            </div>
          `).join('')}
        </div>
      ` : (!clean ? `<p class="text-muted" style="text-align:center;padding:16px;">No vulnerability details returned.</p>` : '')}
      ${s.generatedAt ? `<p class="text-muted" style="font-size:0.72rem;margin:0;">Generated ${escapeHtml(new Date(s.generatedAt).toLocaleString())}</p>` : ''}
    `;
    }
    async runAudit() {
        if (this.auditLoading) return;
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
            container.innerHTML = '<p class="text-muted card">Loading quality metrics…</p>';
            try {
                await this.app.loadPlatformData();
            }
            catch (err) {
                showToast(err.message || 'Failed to load quality metrics', 'error');
            }
        }
        if (this._container !== container)
            return;
        container.innerHTML = '';
        container.appendChild(this.render());
        if (!this.app.state.npmAudit && !this.auditLoading) {
            this.runAudit();
        }
    }
}
