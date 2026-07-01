import { escapeHtml, formatNumber, redactPathForDisplay, showToast, apiUrl } from '../utils.js';
import { authService } from '../services/authService.js';

/**
 * Auth headers.
 * @param {any} extra
 * @returns {any}
 */
function authHeaders(extra = {}) {
  return { ...authService.getAuthHeaders(), ...extra };
}

/**
 * Is json response.
 * @param {Array} res
 * @returns {any}
 */
function isJsonResponse(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

/**
 * Normalize static repository health payload.
 * @param {any} payload
 * @returns {any}
 */
function normalizeStaticRepositoryHealthPayload(payload) {
  const health = payload?.repositoryHealth;
  if (!health || typeof health !== 'object') return null;
  return {
    ...health,
    staticHost: true,
    staticPayload: true,
    headline: health.headline || null,
    recommendations: Array.isArray(health.recommendations) ? health.recommendations : [],
    disclaimers: Array.isArray(health.disclaimers) ? health.disclaimers : [],
    monorepo: health.monorepo || null,
    platform: health.platform || null
  };
}

/**
 * Fetch static repository health fallback.
 * @returns {any}
 */
async function fetchStaticRepositoryHealthFallback() {
  const trustHttpResponse = await fetch('/trust-verification.json', { cache: 'no-store' }).catch(() => null);
  if (!trustHttpResponse || !trustHttpResponse.ok) return null;
  const trustVerificationDocument = await trustHttpResponse.json().catch(() => null);
  return normalizeStaticRepositoryHealthPayload(trustVerificationDocument);
}

/**
 * Read json or default.
 * @param {Array} res
 * @param {any} defaultValue
 * @returns {any}
 */
async function readJsonOrDefault(res, defaultValue = {}) {
  if (!isJsonResponse(res)) return defaultValue;
  const parsed = await res.json().catch(() => defaultValue);
  return parsed == null ? defaultValue : parsed;
}

/**
 * Fetch repository health.
 * @returns {any}
 */
export async function fetchRepositoryHealth() {
  const res = await fetch(apiUrl('/api/optimization/health'), { cache: 'no-store', headers: authHeaders() });
  if (!isJsonResponse(res)) {
    const fallback = await fetchStaticRepositoryHealthFallback();
    if (fallback) return fallback;
    return {
      staticHost: true,
      headline: null,
      recommendations: [],
      disclaimers: [
        'Repository optimization data is unavailable on static hosting. Run the dashboard server for live optimization APIs.'
      ]
    };
  }
  const data = await res.json().catch(() => null);
  if (!data) {
    const fallback = await fetchStaticRepositoryHealthFallback();
    if (fallback) return fallback;
    return {
      staticHost: true,
      headline: null,
      recommendations: [],
      disclaimers: [
        'Repository optimization API returned invalid data on this host. Live optimization requires the dashboard server.'
      ]
    };
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || 'Failed to load repository health');
  }
  return data;
}

/**
 * Render health snapshot.
 * @param {any} snap
 * @param {any} title
 * @returns {any}
 */
function renderHealthSnapshot(snap, title) {
  if (!snap) {
    return `<div class="rh-v3-card" style="border-left:4px solid var(--text-muted);"><div class="rh-v3-card-bd"><p class="text-muted" style="margin:0;font-size:0.85rem;">No ${escapeHtml(title)} consolidation report — run Analyze → Consolidation or <code>npm run optimization:scan</code>.</p></div></div>`;
  }

  const score = snap.repositoryHealthScore ?? 0;
  const scoreClass = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return `
    <div class="rh-v3-card">
      <div class="rh-v3-card-hd">
        <h3 style="margin:0;font-size:1rem;font-weight:700;">${escapeHtml(title)}</h3>
        <span class="gate-badge ${scoreClass}">${score}/100</span>
      </div>
      <div class="rh-v3-card-bd">
        <p class="text-muted" style="font-size:0.78rem;margin:0 0 14px;">
          <code style="background:rgba(148,163,184,0.08);padding:2px 6px;border-radius:4px;">${escapeHtml(redactPathForDisplay(snap.projectRoot))}</code>
          · Last scan: ${escapeHtml(snap.generatedAt || '—')}
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon info">📄</div>
            <div><div class="rh-v3-metric-val">${formatNumber(snap.repositoryFilesTotal ?? 0)}</div><div class="rh-v3-metric-label">Repo Files</div></div>
          </div>
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon info">📂</div>
            <div><div class="rh-v3-metric-val">${formatNumber(snap.repositoryFoldersTotal ?? 0)}</div><div class="rh-v3-metric-label">Folders</div></div>
          </div>
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon ${scoreClass}">💾</div>
            <div><div class="rh-v3-metric-val">${escapeHtml(snap.optimizationPotential || '—')}</div><div class="rh-v3-metric-label">Savings</div></div>
          </div>
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon ${snap.duplicateGroups ? 'warning' : 'success'}">📦</div>
            <div><div class="rh-v3-metric-val">${snap.duplicateGroups ?? 0}</div><div class="rh-v3-metric-label">Dup Groups</div></div>
          </div>
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon ${snap.oversizedFiles ? 'warning' : 'success'}">📁</div>
            <div><div class="rh-v3-metric-val">${snap.oversizedFiles ?? 0}</div><div class="rh-v3-metric-label">Oversized</div></div>
          </div>
          <div class="rh-v3-metric" style="margin-bottom:0;">
            <div class="rh-v3-metric-icon info">🔧</div>
            <div><div class="rh-v3-metric-val">${snap.reductionOpportunities ?? 0}</div><div class="rh-v3-metric-label">Reductions</div></div>
          </div>
        </div>
        ${snap.scopeNote ? `<p class="text-muted" style="font-size:0.75rem;margin:0;">${escapeHtml(snap.scopeNote)}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render repository health section.
 * @param {any} health
 * @param {Object} options
 * @returns {any}
 */
export function renderRepositoryHealthSection(health, { compact = false } = {}) {
  if (!health?.headline) {
    return compact
      ? '<p class="text-muted">No repository health scan yet.</p>'
      : '<p class="text-muted card">Run a consolidation scan to compute repository health.</p>';
  }

  const h = health.headline;
  const scoreClass = h.repositoryHealthScore >= 80 ? 'pass' : h.repositoryHealthScore >= 60 ? 'warn' : 'fail';

  if (compact) {
    return `
      <div class="metrics-row">
        <div class="metric-chip"><strong>${h.repositoryHealthScore}/100</strong> repo health</div>
        <div class="metric-chip"><strong>${escapeHtml(h.optimizationPotential || '—')}</strong> savings</div>
        <div class="metric-chip"><strong>${h.duplicateGroups ?? '—'}</strong> dup groups</div>
        <div class="metric-chip"><strong>${h.oversizedFiles ?? '—'}</strong> oversized</div>
      </div>
    `;
  }

  return `
    <div class="card mb-4">
      <div class="section-heading mb-2">
        <h3 style="margin:0;font-size:var(--font-size-base);">Repository health</h3>
        <span class="gate-badge ${scoreClass}">${h.repositoryHealthScore}/100</span>
      </div>
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${escapeHtml(h.optimizationPotential || '—')}</strong> optimization potential</div>
        <div class="metric-chip"><strong>${h.duplicateGroups ?? '—'}</strong> duplicate groups</div>
        <div class="metric-chip"><strong>${h.oversizedFiles ?? '—'}</strong> oversized files</div>
        <div class="metric-chip"><strong>${h.reductionOpportunities ?? '—'}</strong> reduction ops</div>
        <div class="metric-chip"><strong>${formatNumber(h.repositoryFilesTotal ?? '—')}</strong> repo files</div>
      </div>
      ${renderHealthSnapshot(health.monorepo || health.platform, health.monorepo ? 'Monorepo' : 'Platform')}
    </div>
  `;
}

/**
 * Repository health view.
 */
export class RepositoryHealthView {
  constructor(app) {
    this.app = app;
    this.loading = true;
    this.error = null;
    this.data = null;
    this.candidates = [];
    this.candidatesProjectPath = '';
    this.preview = null;
    this.previewError = null;
    this.previewLoading = false;
    this.previewCandidateId = null;
    this.scanning = false;
    this._root = null;
    this._eventsBound = false;
    this._mountSeq = 0;
  }

  render() {
    if (this.loading) {
      return `
        <div class="db-v3-header">
          <div>
            <h1>Repository Health</h1>
            <p>Loading consolidation metrics…</p>
          </div>
        </div>
        <div class="db-v3-panel" style="padding:40px;text-align:center;">
          <span class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></span>
          <p class="text-muted" style="margin-top:16px;font-size:0.9rem;">Analyzing duplicate files and oversized assets…</p>
        </div>
      `;
    }
    if (this.error) {
      return `
        <div class="db-v3-header">
          <div><h1>Repository Health</h1><p>Consolidation metrics unavailable</p></div>
        </div>
        <div class="db-v3-panel" style="border-left:4px solid #ef4444;">
          <div class="db-v3-panel-bd">
            <p style="margin:0;color:#f87171;font-weight:600;">⚠ Error loading repository health</p>
            <p class="text-muted" style="margin-top:8px;font-size:0.85rem;">${escapeHtml(this.error)}</p>
          </div>
        </div>
      `;
    }

    const health = this.data;
    const headline = health?.headline;
    const staticHost = Boolean(health?.staticHost);
    const score = headline?.repositoryHealthScore ?? 0;
    const scoreClass = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
    const scoreLabel = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs Attention' : 'Critical';

    return `
      <style>
        @keyframes rh-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .rh-v3 { animation:rh-fade-up .5s ease both; }
        .rh-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .rh-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .rh-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .rh-v3-score-ring { width:120px; height:120px; position:relative; display:flex; align-items:center; justify-content:center; }
        .rh-v3-score-ring svg { position:absolute; top:0; left:0; transform:rotate(-90deg); }
        .rh-v3-score-ring .track { fill:none; stroke:rgba(148,163,184,0.1); stroke-width:8; }
        .rh-v3-score-ring .fill { fill:none; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 1s ease; }
        .rh-v3-score-val { font-size:1.8rem; font-weight:800; color:var(--text-primary); }
        .rh-v3-score-label { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-top:2px; }
        .rh-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:20px; }
        [data-theme='light'] .rh-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .rh-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .rh-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .rh-v3-card-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .rh-v3-card-bd { padding:18px 22px; }
        .rh-v3-metric { display:flex; align-items:center; gap:12px; padding:12px 16px; background:rgba(148,163,184,0.05); border-radius:12px; border:1px solid rgba(148,163,184,0.06); }
        .rh-v3-metric-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; background:rgba(99,102,241,0.12); color:#818cf8; }
        .rh-v3-metric-icon.success { background:rgba(34,197,94,0.15); color:#4ade80; }
        .rh-v3-metric-icon.warning { background:rgba(245,158,11,0.15); color:#fbbf24; }
        .rh-v3-metric-icon.danger { background:rgba(239,68,68,0.15); color:#f87171; }
        .rh-v3-metric-val { font-size:1.2rem; font-weight:700; color:var(--text-primary); }
        .rh-v3-metric-label { font-size:0.72rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
        .rh-v3-candidate { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-radius:14px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); margin-bottom:10px; transition:background .2s; }
        .rh-v3-candidate:hover { background:rgba(148,163,184,0.08); }
        .rh-v3-candidate-files { font-family:monospace; font-size:0.78rem; color:var(--text-secondary); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rh-v3-bar { height:10px; border-radius:5px; background:rgba(148,163,184,0.08); overflow:hidden; }
        .rh-v3-bar-fill { height:100%; border-radius:5px; transition:width .8s ease; }
        .rh-v3-rec { display:flex; gap:12px; padding:12px 16px; border-radius:12px; background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.06); margin-bottom:8px; }
        .rh-v3-rec-priority { font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; padding:3px 10px; border-radius:999px; background:rgba(99,102,241,0.15); color:#a78bfa; white-space:nowrap; align-self:flex-start; }
        .rh-v3-rec-priority.high { background:rgba(245,158,11,0.15); color:#fbbf24; }
        .rh-v3-rec-priority.critical { background:rgba(239,68,68,0.15); color:#f87171; }
        .rh-v3-rec-text { font-size:0.85rem; color:var(--text-secondary); line-height:1.5; }

        /* Diff view */
        .rh-v3-diff { margin-top:16px; }
        .rh-v3-diff-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
        .rh-v3-diff-banner { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:8px; font-size:0.8rem; font-weight:600; }
        .rh-v3-diff-banner.safe { background:rgba(16,185,129,0.12); color:#4ade80; border:1px solid rgba(16,185,129,0.25); }
        .rh-v3-diff-banner.unsafe { background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); }
        .rh-v3-diff-banner.checking { background:rgba(99,102,241,0.12); color:#a78bfa; border:1px solid rgba(99,102,241,0.25); }
        .rh-v3-diff-banner.error { background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); }
        .rh-v3-diff-split { display:flex; gap:12px; height:420px; border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; background:var(--surface); }
        .rh-v3-diff-pane { flex:1; display:flex; flex-direction:column; min-width:0; }
        .rh-v3-diff-pane + .rh-v3-diff-pane { border-left:1px solid var(--border); }
        .rh-v3-diff-pane-hd { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--border); background:var(--surface-elevated); }
        .rh-v3-diff-label { font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase; }
        .rh-v3-diff-label.keep { background:rgba(16,185,129,0.15); color:#4ade80; }
        .rh-v3-diff-label.remove { background:rgba(239,68,68,0.15); color:#f87171; }
        .rh-v3-diff-path { font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rh-v3-diff-viewport { flex:1; display:flex; overflow:auto; font-family:var(--font-mono); font-size:0.78rem; }
        .rh-v3-diff-ln { padding:8px 10px; background:var(--surface-elevated); border-right:1px solid var(--border); text-align:right; color:var(--text-muted); user-select:none; flex-shrink:0; }
        .rh-v3-diff-ln div { line-height:1.55; }
        .rh-v3-diff-lines { flex:1; padding:8px 0; }
        .rh-v3-diff-lines .code-row { padding:0 12px; line-height:1.55; white-space:pre; }
        .rh-v3-diff-lines .code-row.identical { background:transparent; }
        .rh-v3-diff-lines .code-row.modified { background:rgba(245,158,11,0.1); border-left:3px solid #f59e0b; }
        .rh-v3-diff-lines .code-row.added { background:rgba(34,197,94,0.1); border-left:3px solid #22c55e; }
        .rh-v3-diff-lines .code-row.removed { background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; }
        .rh-v3-diff-lines .code-row.empty { background:transparent; color:var(--text-muted); }
      </style>

      <div class="rh-v3-header">
        <div>
          <h1>Repository Health</h1>
          <p>Duplicate detection, oversized files, and consolidation opportunities</p>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="btn btn-primary btn-sm" id="run-optimization-scan" ${this.scanning || staticHost ? 'disabled' : ''}>
            ${this.scanning ? '<span class="loading-spinner"></span> Scanning…' : 'Run Consolidation Scan'}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="send-health-ai-btn" title="Send to AI coding agent">🤖 AI Agent</button>
        </div>
      </div>

      ${staticHost ? `
        <div class="rh-v3-card" style="border-left:4px solid #f59e0b;">
          <div class="rh-v3-card-bd">
            <p style="margin:0;color:#fbbf24;font-weight:600;font-size:0.85rem;">⚡ Static Host Preview</p>
            <p class="text-muted" style="margin-top:6px;font-size:0.8rem;">Optimization APIs require running the dashboard server locally for live analysis.</p>
          </div>
        </div>
      ` : ''}

      ${headline ? `
        <div class="rh-v3" style="display:grid;grid-template-columns:auto 1fr;gap:20px;margin-bottom:20px;align-items:start;">
          <div class="rh-v3-card" style="margin-bottom:0;text-align:center;padding:20px;">
            <div class="rh-v3-score-ring" style="margin:0 auto;">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle class="track" cx="60" cy="60" r="52"/>
                <circle class="fill ${scoreClass}" cx="60" cy="60" r="52" stroke="${scoreColor}"
                  stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - score / 100)}"/>
              </svg>
              <div style="position:absolute;text-align:center;">
                <div class="rh-v3-score-val">${score}</div>
                <div class="rh-v3-score-label">${scoreLabel}</div>
              </div>
            </div>
            <p class="text-muted" style="margin-top:12px;font-size:0.78rem;">out of 100</p>
          </div>

          <div>
            <div class="rh-v3-card" style="margin-bottom:16px;">
              <div class="rh-v3-card-bd">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon ${headline.duplicateGroups ? 'warning' : 'success'}">📦</div>
                    <div><div class="rh-v3-metric-val">${headline.duplicateGroups ?? 0}</div><div class="rh-v3-metric-label">Duplicate Groups</div></div>
                  </div>
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon ${headline.oversizedFiles ? 'warning' : 'success'}">📁</div>
                    <div><div class="rh-v3-metric-val">${headline.oversizedFiles ?? 0}</div><div class="rh-v3-metric-label">Oversized Files</div></div>
                  </div>
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon info">🔧</div>
                    <div><div class="rh-v3-metric-val">${headline.reductionOpportunities ?? 0}</div><div class="rh-v3-metric-label">Reduction Ops</div></div>
                  </div>
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon info">📄</div>
                    <div><div class="rh-v3-metric-val">${formatNumber(headline.repositoryFilesTotal ?? 0)}</div><div class="rh-v3-metric-label">Repo Files</div></div>
                  </div>
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon info">📂</div>
                    <div><div class="rh-v3-metric-val">${formatNumber(headline.repositoryFoldersTotal ?? 0)}</div><div class="rh-v3-metric-label">Folders</div></div>
                  </div>
                  <div class="rh-v3-metric">
                    <div class="rh-v3-metric-icon ${scoreClass}">💾</div>
                    <div><div class="rh-v3-metric-val">${escapeHtml(headline.optimizationPotential || '—')}</div><div class="rh-v3-metric-label">Savings</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <div class="rh-v3-card" style="padding:40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">📊</div>
          <h3 style="margin:0 0 8px;font-size:1.1rem;color:var(--text-primary);">No scan data yet</h3>
          <p class="text-muted" style="margin:0 0 20px;font-size:0.85rem;max-width:400px;margin-left:auto;margin-right:auto;">Run a consolidation scan to detect duplicate files, oversized assets, and optimization opportunities.</p>
          <button type="button" class="btn btn-primary" id="run-optimization-scan" ${staticHost ? 'disabled' : ''}>Run Consolidation Scan</button>
        </div>
      `}

      ${renderHealthSnapshot(health?.monorepo, 'Monorepo root')}
      ${health?.platform && health?.monorepo ? renderHealthSnapshot(health.platform, 'Platform (ai-platform)') : ''}

      ${this.candidates.length ? `
        <div class="rh-v3-card">
          <div class="rh-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔀 Merge Candidates</h3>
            <span class="db-v3-panel-badge">${this.candidates.length} found</span>
          </div>
          <div class="rh-v3-card-bd">
            <p class="text-muted" style="font-size:0.78rem;margin-bottom:16px;">Phase 3 safety: preview → confirm → quarantine. No auto-delete. Intentional npm mirrors are excluded.</p>
            ${this.candidates.slice(0, 5).map((item) => `
              <div class="rh-v3-candidate">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                  <span style="font-size:1.2rem;">📄</span>
                  <div style="min-width:0;">
                    <div class="rh-v3-candidate-files">${escapeHtml((item.files || []).map((f) => f.path).join(' ↔ ') || '—')}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(item.mergeType || 'candidate')} · ${escapeHtml(item.savingsLabel || '—')} savings</div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm preview-merge-btn" data-candidate-id="${escapeHtml(item.id || '')}" ${this.previewLoading && this.previewCandidateId === item.id ? 'disabled' : ''}>
                  ${this.previewLoading && this.previewCandidateId === item.id ? 'Previewing…' : 'Preview'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${this.previewLoading ? `
        <div class="rh-v3-card" id="merge-preview-panel">
          <div class="rh-v3-card-bd" style="text-align:center;padding:30px;">
            <span class="loading-spinner" style="width:24px;height:24px;"></span>
            <p class="text-muted" style="margin-top:10px;font-size:0.85rem;">Building merge preview…</p>
          </div>
        </div>
      ` : ''}

      ${this.preview ? `
        <div class="rh-v3-card" id="merge-preview-panel">
          <div class="rh-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">🔍 Merge Preview</h3>
            <span class="gate-badge ${this.preview.safeToExecute ? 'pass' : 'warn'}">${this.preview.safeToExecute ? 'Safe' : 'Review Needed'}</span>
          </div>
          <div class="rh-v3-card-bd">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
              <div class="rh-v3-metric" style="margin-bottom:0;">
                <div class="rh-v3-metric-icon success">✓</div>
                <div><div class="rh-v3-metric-label">Keep File</div><div style="font-family:monospace;font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">${escapeHtml(this.preview.keepFile || '—')}</div></div>
              </div>
              <div class="rh-v3-metric" style="margin-bottom:0;">
                <div class="rh-v3-metric-icon danger">✕</div>
                <div><div class="rh-v3-metric-label">Remove</div><div style="font-family:monospace;font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">${(this.preview.removeFiles || []).map((f) => escapeHtml(f)).join(', ') || '—'}</div></div>
              </div>
            </div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
              <span class="text-muted" style="font-size:0.8rem;">Conflicts: <strong style="color:var(--text-primary);">${this.preview.conflicts?.length || 0}</strong></span>
              <span class="text-muted" style="font-size:0.8rem;">Mode: <strong style="color:var(--text-primary);">${escapeHtml(this.preview.executionMode || '—')}</strong></span>
              ${this.preview.riskAssessment ? `<span class="text-muted" style="font-size:0.8rem;">Risk: <strong style="color:${this.preview.riskAssessment.level === 'low' ? '#22c55e' : this.preview.riskAssessment.level === 'medium' ? '#f59e0b' : '#ef4444'};">${escapeHtml(this.preview.riskAssessment.level || '—')}</strong></span>` : ''}
            </div>
            ${this.preview.safeToExecute ? `
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button type="button" class="btn btn-danger btn-sm" id="quarantine-merge-btn">Quarantine Duplicates</button>
                <span class="text-muted" style="font-size:0.75rem;">Confirm: <code style="background:rgba(148,163,184,0.1);padding:2px 6px;border-radius:4px;">${escapeHtml(this.preview.confirmationPhrase || '')}</code></span>
              </div>
            ` : ''}
            <div id="merge-diff-root" class="rh-v3-diff"></div>
          </div>
        </div>
      ` : ''}

      ${this.previewError ? `
        <div class="rh-v3-card" id="merge-preview-panel" style="border-left:4px solid #ef4444;">
          <div class="rh-v3-card-bd">
            <p style="margin:0;color:#f87171;font-weight:600;font-size:0.85rem;">Preview Failed</p>
            <p class="text-muted" style="margin-top:6px;font-size:0.8rem;">${escapeHtml(this.previewError)}</p>
          </div>
        </div>
      ` : ''}

      ${(health?.recommendations || []).length ? `
        <div class="rh-v3-card">
          <div class="rh-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">💡 Recommendations</h3>
          </div>
          <div class="rh-v3-card-bd">
            ${health.recommendations.map((item) => `
              <div class="rh-v3-rec">
                <span class="rh-v3-rec-priority ${(item.priority || '').toLowerCase()}">${escapeHtml(item.priority || '—')}</span>
                <div class="rh-v3-rec-text">${escapeHtml(item.description || item.action || '')}${item.savings ? ` <strong style="color:var(--accent);">· Save ${escapeHtml(item.savings)}</strong>` : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${(health?.disclaimers || []).length ? `
        <div class="rh-v3-card">
          <div class="rh-v3-card-hd">
            <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Scope & Disclaimers</h3>
          </div>
          <div class="rh-v3-card-bd">
            <ul style="margin:0;padding-left:1.25rem;font-size:0.82rem;color:var(--text-muted);">
              ${health.disclaimers.map((line) => `<li style="margin-bottom:6px;">${escapeHtml(line)}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}
    `;
  }

  async fetchCandidatesList() {
/**
 * Fetch list.
 * @param {string} projectPath
 * @returns {any}
 */
    const fetchList = async (projectPath) => {
      const params = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
      const candRes = await fetch(apiUrl(`/api/optimization/candidates${params}`), { cache: 'no-store', headers: authHeaders() });
      const candData = await readJsonOrDefault(candRes, {});
      return candData.success ? (candData.candidates || []) : [];
    };

    const projectPath = this.app.state.lastProjectPath || '';
    let candidates = await fetchList(projectPath);
    let candidatesProjectPath = projectPath;

    if (!candidates.length && projectPath) {
      const monorepoCandidates = await fetchList('');
      if (monorepoCandidates.length) {
        candidates = monorepoCandidates;
        candidatesProjectPath = '';
      }
    }

    this.candidatesProjectPath = candidatesProjectPath;
    return candidates;
  }

  resolvePreviewProjectPath() {
    if (this.candidatesProjectPath !== undefined && this.candidatesProjectPath !== null) {
      return this.candidatesProjectPath;
    }
    return this.app.state.lastProjectPath || '';
  }

  async loadHealth() {
    this.loading = true;
    this.error = null;
    try {
      this.data = await fetchRepositoryHealth();
      if (this.data?.staticHost) {
        this.candidates = [];
        this.candidatesProjectPath = '';
        this.preview = null;
        this.previewError = null;
        return;
      }
      this.candidates = await this.fetchCandidatesList();
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  paint(container) {
    container.innerHTML = this.render();
    this.bindEvents(container);
  }

  scrollPreviewIntoView(container) {
    requestAnimationFrame(() => {
      container.querySelector('#merge-preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async mount(container) {
    this._root = container;
    const mountSeq = ++this._mountSeq;
    this.loading = true;
    this.paint(container);

    await this.loadHealth();
    if (mountSeq !== this._mountSeq) return;

    this.paint(container);
  }

  async handlePreviewMerge(candidateId) {
    if (!candidateId || this.previewLoading) return;

    this.previewLoading = true;
    this.previewCandidateId = candidateId;
    this.previewError = null;
    this.preview = null;
    if (this._root) this.paint(this._root);

    try {
      const res = await fetch(apiUrl('/api/optimization/merge-preview'), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          projectPath: this.resolvePreviewProjectPath(),
          candidateId
        })
      });
      const data = await readJsonOrDefault(res, {});
      if (!res.ok || !data.success) throw new Error(data.error || 'Preview failed');
      this.preview = data.preview;
      showToast('Merge preview ready', 'success');
    } catch (err) {
      this.previewError = err.message;
      showToast(err.message, 'error');
    } finally {
      this.previewLoading = false;
      this.previewCandidateId = null;
      if (this._root) {
        this.paint(this._root);
        this.scrollPreviewIntoView(this._root);
        if (this.preview) {
          this._loadMergeDiff(this.preview.keepFile, this.preview.removeFiles?.[0]);
        }
      }
    }
  }

  async _loadMergeDiff(keepFile, removeFile) {
    if (!keepFile || !removeFile) return;
    const root = this._root?.querySelector('#merge-diff-root');
    if (!root) return;
    root.innerHTML = this._renderDiffSkeleton(keepFile, removeFile);
    try {
      const [contentA, contentB] = await Promise.all([
        this._fetchFileContent(keepFile),
        this._fetchFileContent(removeFile)
      ]);
      this._renderDiffPanes(contentA, contentB);
      this._bindDiffScrollSync();
      this._evaluateDiffSafety(contentA === contentB);
    } catch (err) {
      console.warn('[RepositoryHealth] Diff load failed:', err);
      root.innerHTML = `<div class="rh-v3-diff-banner error">Failed to load file contents: ${escapeHtml(err.message)}</div>`;
    }
  }

  async _fetchFileContent(filePath) {
    const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  _renderDiffSkeleton(fileA, fileB) {
    return `
      <div class="rh-v3-diff-header">
        <strong style="font-size:0.85rem;color:var(--text-primary);">Comparing Duplicate Candidates</strong>
        <div id="diff-safety-banner" class="rh-v3-diff-banner checking"><span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span> Analyzing file parity…</div>
      </div>
      <div class="rh-v3-diff-split">
        <div class="rh-v3-diff-pane">
          <div class="rh-v3-diff-pane-hd">
            <span class="rh-v3-diff-label keep">KEEP</span>
            <span class="rh-v3-diff-path" title="${escapeHtml(fileA)}">${escapeHtml(fileA)}</span>
          </div>
          <div class="rh-v3-diff-viewport" id="code-view-left">
            <div class="rh-v3-diff-ln" id="ln-left"></div>
            <div class="rh-v3-diff-lines" id="lines-left"></div>
          </div>
        </div>
        <div class="rh-v3-diff-pane">
          <div class="rh-v3-diff-pane-hd">
            <span class="rh-v3-diff-label remove">REMOVE</span>
            <span class="rh-v3-diff-path" title="${escapeHtml(fileB)}">${escapeHtml(fileB)}</span>
          </div>
          <div class="rh-v3-diff-viewport" id="code-view-right">
            <div class="rh-v3-diff-ln" id="ln-right"></div>
            <div class="rh-v3-diff-lines" id="lines-right"></div>
          </div>
        </div>
      </div>
    `;
  }

  _renderDiffPanes(contentA, contentB) {
    const linesA = contentA.split(/\r?\n/);
    const linesB = contentB.split(/\r?\n/);
    const maxLines = Math.max(linesA.length, linesB.length);
    let lnLeft = '', codeLeft = '', lnRight = '', codeRight = '';
    for (let i = 0; i < maxLines; i++) {
      const a = linesA[i];
      const b = linesB[i];
      const num = i + 1;
      const identical = a === b;
      const hasA = i < linesA.length;
      const hasB = i < linesB.length;
      let status = 'identical';
      if (!identical) {
        if (hasA && hasB) status = 'modified';
        else if (hasA) status = 'removed';
        else status = 'added';
      }
      if (hasA) {
        lnLeft += `<div class="ln-num">${num}</div>`;
        codeLeft += `<div class="code-row ${status}">${escapeHtml(a || ' ')}</div>`;
      }
      if (hasB) {
        lnRight += `<div class="ln-num">${num}</div>`;
        codeRight += `<div class="code-row ${status}">${escapeHtml(b || ' ')}</div>`;
      }
    }
    const root = this._root?.querySelector('#merge-diff-root');
    if (!root) return;
    const lnLeftEl = root.querySelector('#ln-left');
    const linesLeftEl = root.querySelector('#lines-left');
    const lnRightEl = root.querySelector('#ln-right');
    const linesRightEl = root.querySelector('#lines-right');
    if (lnLeftEl) lnLeftEl.innerHTML = lnLeft;
    if (linesLeftEl) linesLeftEl.innerHTML = codeLeft;
    if (lnRightEl) lnRightEl.innerHTML = lnRight;
    if (linesRightEl) linesRightEl.innerHTML = codeRight;
  }

  _bindDiffScrollSync() {
    const root = this._root?.querySelector('#merge-diff-root');
    if (!root) return;
    const left = root.querySelector('#code-view-left');
    const right = root.querySelector('#code-view-right');
    if (!left || !right) return;
    let scrolling = false;
    const sync = (source, target) => {
      if (!scrolling) {
        scrolling = true;
        target.scrollTop = source.scrollTop;
        target.scrollLeft = source.scrollLeft;
        setTimeout(() => { scrolling = false; }, 40);
      }
    };
    left.addEventListener('scroll', () => sync(left, right));
    right.addEventListener('scroll', () => sync(right, left));
  }

  _evaluateDiffSafety(isIdentical) {
    const banner = this._root?.querySelector('#diff-safety-banner');
    const quarantineBtn = this._root?.querySelector('#quarantine-merge-btn');
    if (!banner) return;
    if (isIdentical) {
      banner.className = 'rh-v3-diff-banner safe';
      banner.innerHTML = '✓ 100% identical. Safe to quarantine.';
    } else {
      banner.className = 'rh-v3-diff-banner unsafe';
      banner.innerHTML = '⚠ Content differs. Manual review required.';
      if (quarantineBtn) {
        quarantineBtn.setAttribute('disabled', 'true');
        quarantineBtn.title = 'Quarantine disabled: candidate files are not identical.';
      }
    }
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

  bindEvents(container) {
    this._root = container;

    container.querySelector('#run-optimization-scan')?.addEventListener('click', async () => {
      if (this.scanning) return;
      this.scanning = true;
      this.paint(container);
      try {
        const res = await fetch(apiUrl('/api/optimization/analyze'), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ projectPath: this.app.state.lastProjectPath || '' })
        });
        const data = await readJsonOrDefault(res, {});
        if (!res.ok || !data.success) throw new Error(data.error || 'Scan failed');
        this.data = data.health;
        this.candidates = await this.fetchCandidatesList();
        this.preview = null;
        this.previewError = null;
      } catch (err) {
        this.error = err.message;
        showToast(err.message, 'error');
      } finally {
        this.scanning = false;
        this.paint(container);
      }
    });

    container.querySelector('#quarantine-merge-btn')?.addEventListener('click', async () => {
      if (!this.preview) return;
      const btn = container.querySelector('#quarantine-merge-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Quarantining…'; }
      try {
        const res = await fetch(apiUrl('/api/optimization/merge-execute'), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            projectPath: this.resolvePreviewProjectPath(),
            previewId: this.preview.previewId || undefined,
            confirmed: true,
            confirmationPhrase: this.preview.confirmationPhrase
          })
        });
        const data = await readJsonOrDefault(res, {});
        if (!res.ok || !data.success) throw new Error(data.error || 'Quarantine failed');
        showToast(data.message || 'Duplicates quarantined successfully', 'success');
        this.preview = null;
        this.previewError = null;
        await this.loadHealth();
        this.paint(container);
      } catch (err) {
        showToast(err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Quarantine duplicates'; }
      }
    });

    container.querySelector('#send-health-ai-btn')?.addEventListener('click', async () => {
      const health = this.data;
      if (!health || !health.headline) { showToast('No repository health data — run a scan first', 'error'); return; }
      const headline = health.headline;
      const payload = {
        projectPath: health.projectRoot || health.projectPath || this.app.state.lastProjectPath || window.location.origin,
        reportType: 'repository-health',
        reportSummary: {
          repositoryHealthScore: headline.repositoryHealthScore,
          optimizationPotential: headline.optimizationPotential,
          duplicateGroups: headline.duplicateGroups,
          oversizedFiles: headline.oversizedFiles,
          reductionOpportunities: headline.reductionOpportunities,
          repositoryFilesTotal: headline.repositoryFilesTotal,
          repositoryFoldersTotal: headline.repositoryFoldersTotal
        },
        notes: ''
      };
      const vscode = this._getVscodeApi();
      if (vscode) {
        try {
          vscode.postMessage({ command: 'sendToAI', data: payload });
          showToast('Repository health sent to your AI coding agent', 'success');
          return;
        } catch (err) {
          console.warn('[Health-AI] vscode.postMessage failed:', err);
        }
      }
      // Fallback: POST to /api/ai-context and copy to clipboard
      try {
        const res = await fetch(apiUrl('/api/ai-context'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
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

    if (this._eventsBound) return;
    this._eventsBound = true;

    container.addEventListener('click', (event) => {
      const btn = event.target.closest('.preview-merge-btn');
      if (!btn || !container.contains(btn) || btn.disabled) return;
      event.preventDefault();
      const candidateId = btn.dataset.candidateId;
      if (!candidateId) {
        showToast('Merge candidate id missing — re-run consolidation scan', 'error');
        return;
      }
      this.handlePreviewMerge(candidateId);
    });
  }

  destroy() {}
}
