import { escapeHtml, formatNumber, redactPathForDisplay } from '../utils.js';
import { renderRepositoryHealthSection } from './RepositoryHealthView.js';

function normalizeStaticTrustPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const live = {
    verificationId: data.verificationId,
        headlineSource: data.headlineSource || null,
        headlineReason: data.headlineReason || null,
        headline: data.headline || null,
    platform: data.platform || null,
    monorepo: data.monorepo || null,
    repositoryHealth: data.repositoryHealth || null,
    disclaimers: Array.isArray(data.disclaimers) ? data.disclaimers : [],
    methodology: Array.isArray(data.methodology) ? data.methodology : []
  };
  return { success: true, live, staticHost: true, staticPayload: true };
}

async function fetchStaticTrustFallback() {
  const res = await fetch('/trust-verification.json', { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return normalizeStaticTrustPayload(data);
}

function normalizeTrustApiPayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.live && typeof data.live === 'object') {
    return data;
  }
  if (!data.type && !data.platform && !data.monorepo) {
    return data;
  }
  return {
    success: true,
    live: {
      verificationId: data.verificationId,
      headlineSource: data.headlineSource || null,
      headlineReason: data.headlineReason || null,
      headline: data.headline || null,
      platform: data.platform || null,
      monorepo: data.monorepo || null,
      repositoryHealth: data.repositoryHealth || null,
      disclaimers: Array.isArray(data.disclaimers) ? data.disclaimers : [],
      methodology: Array.isArray(data.methodology) ? data.methodology : []
    },
    publishedAt: data.publishedAt || null
  };
}

export async function fetchTrustVerification() {
  const res = await fetch('/api/trust/verification', { cache: 'no-store' });
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    const fallback = await fetchStaticTrustFallback();
    if (fallback) return fallback;
    return { staticHost: true, live: null };
  }
  const rawData = await res.json().catch(() => null);
  const data = normalizeTrustApiPayload(rawData);
  if (!data) {
    const fallback = await fetchStaticTrustFallback();
    if (fallback) return fallback;
    return { staticHost: true, live: null };
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load trust verification');
  }
  return data;
}

function renderSnapshot(snap, title) {
  if (!snap) {
    return `<p class="text-muted card">No ${escapeHtml(title)} report on disk — run Simplebeacon scan first.</p>`;
  }

  return `
    <div class="card mb-4">
      <div class="section-heading mb-2">
        <h3 style="margin:0;font-size:var(--font-size-base);">${escapeHtml(title)}</h3>
        <span class="gate-badge ${snap.gatePass ? 'pass' : 'warn'}">${snap.gatePass ? 'GATE PASS' : 'GATE REVIEW'}</span>
      </div>
      <p class="text-muted text-sm mb-4" style="margin-top:0;">
        Path: <code>${escapeHtml(redactPathForDisplay(snap.projectRoot))}</code>
        ${snap.platformRoot ? ` · Platform: <code>${escapeHtml(redactPathForDisplay(snap.platformRoot))}</code>` : ''}
        · Last scan: ${escapeHtml(snap.generatedAt || '—')}
      </p>
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${snap.qualityScore ?? '—'}%</strong> quality</div>
        <div class="metric-chip"><strong>${formatNumber(snap.issueCount ?? 0)}</strong> issues</div>
        <div class="metric-chip"><strong>${snap.schemaPassed ?? '—'}/${snap.schemaChecked ?? '—'}</strong> schema</div>
        <div class="metric-chip"><strong>${snap.consistencyScore ?? '—'}%</strong> consistency</div>
        <div class="metric-chip"><strong>${formatNumber(snap.repositoryFilesTotal ?? '—')}</strong> repo files</div>
        <div class="metric-chip"><strong>${formatNumber(snap.ruleScopedFilesAnalyzed ?? '—')}</strong> gate checked</div>
        <div class="metric-chip"><strong>${formatNumber(snap.mockSampleFiles ?? '—')}</strong> mock/sample</div>
      </div>
      <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">${escapeHtml(snap.scopeNote || '')}</p>
    </div>
  `;
}

export class TrustView {
  constructor(app) {
    this.app = app;
    this.loading = true;
    this.error = null;
    this.data = null;
  }

  render() {
    if (this.loading) {
      return '<p class="text-muted"><span class="loading-spinner"></span> Loading trust verification…</p>';
    }
    if (this.error) {
      return `<p class="text-danger card">${escapeHtml(this.error)}</p>`;
    }

    const live = this.data?.live;
    const staticHost = Boolean(this.data?.staticHost);
    const disclaimers = live?.disclaimers || [];
    const methodology = live?.methodology || [];

    return `
      <div class="section-block">
        <div class="section-heading">
          <h2>Trust verification</h2>
          <div class="roadmap-result-actions">
            <a class="btn btn-secondary btn-sm" href="/api/trust/badge" target="_blank" rel="noopener">Badge preview</a>
            <a class="btn btn-secondary btn-sm" href="/api/trust/verify?format=html" target="_blank" rel="noopener">Verify page</a>
            <a class="btn btn-secondary btn-sm" href="/api/optimization/compliance" target="_blank" rel="noopener">Compliance API</a>
          </div>
        </div>

        ${staticHost ? `
          <div class="card mb-4">
            <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
              Static-host preview mode: trust verification APIs are not available on this upload. Run <code>npm run dashboard</code> locally (or deploy backend APIs) for live Trust data.
            </p>
          </div>
        ` : ''}

        <div class="card mb-4">
          <p style="margin:0 0 0.75rem;font-size:var(--font-size-sm);">
            We publish <strong>scoped</strong> Simplebeacon scan results — not marketing claims.
            A 99% quality score on the platform gate means configured sample paths passed rules;
            it does <em>not</em> mean zero issues across a 40k+ file monorepo.
          </p>
          <p class="text-muted" style="margin:0 0 0.35rem;font-size:var(--font-size-xs);">
            Verification ID: <code>${escapeHtml(live?.verificationId || '—')}</code>
            · Method: deterministic gate + pattern matching
          </p>
          <p class="text-muted" style="margin:0;font-size:var(--font-size-xs);">
            Headline source: <code>${escapeHtml(live?.headlineSource || 'n/a')}</code>
            ${live?.headlineReason ? ` · ${escapeHtml(live.headlineReason)}` : ''}
          </p>
        </div>

        ${renderSnapshot(live?.platform, 'Platform gate scan')}
        ${live?.monorepo ? renderSnapshot(live.monorepo, 'Monorepo root scan') : ''}

        <div class="card mb-4">
          <div class="section-heading mb-2">
            <h3 style="margin:0;font-size:var(--font-size-base);">Repository optimization</h3>
            <a class="btn btn-secondary btn-sm" href="#/repository-health">Full health report →</a>
          </div>
          ${live?.repositoryHealth?.headline
            ? renderRepositoryHealthSection(live.repositoryHealth, { compact: true })
            : '<p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">Run consolidation scan to publish repo health metrics.</p>'}
        </div>

        ${disclaimers.length ? `
          <div class="card mb-4">
            <h3 class="mb-2" style="font-size:var(--font-size-base);">Scope disclaimers</h3>
            <ul style="margin:0;padding-left:1.25rem;font-size:var(--font-size-sm);">
              ${disclaimers.map((line) => `<li class="text-muted mb-2">${escapeHtml(line)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${methodology.length ? `
          <div class="card mb-4">
            <h3 class="mb-2" style="font-size:var(--font-size-base);">Methodology</h3>
            <ul style="margin:0;padding-left:1.25rem;font-size:var(--font-size-sm);">
              ${methodology.map((line) => `<li class="text-muted mb-2">${escapeHtml(line)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="card">
          <h3 class="mb-2" style="font-size:var(--font-size-base);">Embed badge</h3>
          <pre class="audit-log" style="margin:0;font-size:var(--font-size-xs);">&lt;img src="${escapeHtml(window.location.origin)}/api/trust/badge.svg?raw=1" alt="Simplebeacon gate verification badge" width="320" height="72"&gt;</pre>
          <p class="text-muted mt-2 mb-0" style="font-size:var(--font-size-xs);">
            Daily publish: <code>npm run trust:publish</code> after <code>simplebeacon scan</code>
          </p>
        </div>
      </div>
    `;
  }

  async mount(container) {
    this.loading = true;
    this.error = null;
    container.innerHTML = this.render();
    try {
      this.data = await fetchTrustVerification();
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
      container.innerHTML = this.render();
    }
  }

  destroy() {}
}
