// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, formatNumber, redactPathForDisplay, showToast, downloadJson, apiBaseUrl } from '../utils.js';
import { renderRepositoryHealthSection } from './RepositoryHealthView.js';

/**
 * Resolve a relative API URL against the local API base when in extension bridge mode.
 */
function resolveApiUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (/^https?:\/\//i.test(url)) return url;
  try {
    const base = apiBaseUrl();
    if (base && base !== '/') {
      return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }
  } catch (_a) { /* fall back to relative */ }
  return url;
}

/**
 * Normalize static trust payload.
 * @param {any} data
 * @returns {any}
 */
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
    methodology: Array.isArray(data.methodology) ? data.methodology : [],
    fictionScope: data.fictionScope || null
  };
  return { success: true, live, staticHost: true, staticPayload: true };
}

/**
 * Fetch static trust fallback.
 * @returns {any}
 */
async function fetchStaticTrustFallback() {
  const trustHttpResponse = await fetch(resolveApiUrl('/trust-verification.json'), { cache: 'no-store' }).catch(() => null);
  if (!trustHttpResponse || !trustHttpResponse.ok) return null;
  const trustVerificationDocument = await trustHttpResponse.json().catch(() => null);
  return normalizeStaticTrustPayload(trustVerificationDocument);
}

/**
 * Normalize trust api payload.
 * @param {any} data
 * @returns {any}
 */
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
      methodology: Array.isArray(data.methodology) ? data.methodology : [],
      fictionScope: data.fictionScope || null
    },
    publishedAt: data.publishedAt || null
  };
}

/**
 * Fetch trust verification.
 * @returns {any}
 */
export async function fetchTrustVerification() {
  const res = await fetch(resolveApiUrl('/api/trust/verification'), { cache: 'no-store' });
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

/**
 * Render re attestation.
 * @param {any} meta
 * @returns {any}
 */
function renderReAttestation(meta) {
  if (!meta) {
    return `<p class="text-muted card">No re-attestation metadata on disk.</p>`;
  }
  const gate = meta.currentGate || {};
  const hygiene = meta.hygieneSummary || {};
  const scope = meta.scanScope || {};
  const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
  const gateLabel = gate.pass ? 'GATE PASS' : gate.blockingCount > 0 ? 'GATE FAIL' : 'GATE REVIEW';

  return `
    <div class="card mb-4">
      <div class="section-heading mb-2">
        <h3 style="margin:0;font-size:var(--font-size-base);">Re-attestation metadata</h3>
        <span class="gate-badge ${gateClass}">${gateLabel}</span>
      </div>
      <p class="text-muted text-sm mb-4" style="margin-top:0;">
        Tier: <code>${escapeHtml(meta.tier || '—')}</code>
        · Purpose: <code>${escapeHtml(meta.purpose || '—')}</code>
        · Generated: ${escapeHtml(meta.generatedAt || '—')}
      </p>
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${gate.qualityScore ?? hygiene.qualityScore ?? '—'}%</strong> quality</div>
        <div class="metric-chip"><strong>${formatNumber(gate.blockingCount ?? hygiene.blockingCount ?? 0)}</strong> blocking</div>
        <div class="metric-chip"><strong>${formatNumber(gate.ruleScopedFilesAnalyzed ?? hygiene.ruleScopedFilesAnalyzed ?? 0)}</strong> gate checked</div>
        <div class="metric-chip"><strong>${formatNumber(gate.repositoryFilesTotal ?? hygiene.repositoryFilesTotal ?? 0)}</strong> repo files</div>
        <div class="metric-chip"><strong>${formatNumber(hygiene.credentialScanned ?? 0)}</strong> CRED scanned</div>
        <div class="metric-chip"><strong>${formatNumber(hygiene.gateMetadataOnlyFiles ?? 0)}</strong> metadata only</div>
        <div class="metric-chip"><strong>${formatNumber(hygiene.fictionJsonFilesScanned ?? 0)}</strong> fiction JSON</div>
        <div class="metric-chip"><strong>${formatNumber(hygiene.fictionSampleFilesScanned ?? 0)}</strong> fiction samples</div>
        <div class="metric-chip"><strong>${escapeHtml(scope.gateRuleBundleProfile || hygiene.gateRuleBundleProfile || '—')}</strong> rule bundle</div>
      </div>
      <p class="text-muted text-sm" style="margin:0 0 0.5rem;">
        <strong>Workflow status:</strong> ${escapeHtml(meta.workflowStatus || '—')}
        ${meta.scanTargetProfile ? `· <strong>Target profile:</strong> ${escapeHtml(meta.scanTargetProfile)}` : ''}
        ${meta.securityHandoffEligible !== undefined ? `· <strong>Security handoff eligible:</strong> ${meta.securityHandoffEligible}` : ''}
      </p>
      <p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">
        <strong>Scope note:</strong> ${escapeHtml(scope.workflowNote || meta.message || '')}
      </p>
      ${meta.attestationNote || hygiene.attestationNote ? `
        <p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">
          <strong>Attestation note:</strong> ${escapeHtml(meta.attestationNote || hygiene.attestationNote || '')}
        </p>
      ` : ''}
      ${Array.isArray(meta.exportNotes) && meta.exportNotes.length ? `
        <details style="margin-top:var(--space-3);">
          <summary style="cursor:pointer;font-size:var(--font-size-sm);font-weight:600;color:var(--text-secondary);">Export notes (${meta.exportNotes.length})</summary>
          <ul style="margin:var(--space-2) 0 0;padding-left:1.25rem;font-size:var(--font-size-xs);color:var(--text-muted);">
            ${meta.exportNotes.map((n) => `<li class="mb-1">${escapeHtml(n)}</li>`).join('')}
          </ul>
        </details>
      ` : ''}
    </div>
  `;
}

/**
 * Render snapshot.
 * @param {any} snap
 * @param {any} title
 * @returns {any}
 */
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
        <div class="metric-chip"><strong>${formatNumber(snap.fictionJsonFilesScanned ?? '—')}</strong> fiction JSON</div>
        <div class="metric-chip"><strong>${formatNumber(snap.fictionSampleFilesScanned ?? snap.mockSampleFiles ?? '—')}</strong> fiction samples</div>
      </div>
      <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">${escapeHtml(snap.scopeNote || '')}</p>
    </div>
  `;
}

/**
 * Trust view.
 */
export class TrustView {
  constructor(app) {
    this.app = app;
    this.loading = true;
    this.error = null;
    this.data = null;
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
    if (this.loading) {
      return `
        <div class="analyze-hero"><h1 class="page-title">Trust Verification</h1><p class="text-muted analyze-hero-sub">Loading trust data…</p></div>
        <p class="text-muted"><span class="loading-spinner"></span> Loading trust verification…</p>
      `;
    }
    if (this.error) {
      return `
        <div class="analyze-hero"><h1 class="page-title">Trust Verification</h1><p class="text-muted analyze-hero-sub">Trust data unavailable</p></div>
        <p class="text-danger card">${escapeHtml(this.error)}</p>
      `;
    }

    const live = this.data?.live;
    const staticHost = Boolean(this.data?.staticHost);
    const disclaimers = live?.disclaimers || [];
    const methodology = live?.methodology || [];
    const fictionScope = live?.fictionScope || null;

    return `
      <div class="analyze-hero">
        <h1 class="page-title">Trust Verification</h1>
        <p class="text-muted analyze-hero-sub">Scoped scan results — not marketing claims.</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-4);">
        <div class="analyze-action-info"></div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" id="trust-download-json" type="button">
            <i data-lucide="download" class="icon-16"></i> Download JSON
          </button>
          <a class="btn btn-ghost btn-sm" href="/api/trust/badge" target="_blank" rel="noopener">Badge preview</a>
          <a class="btn btn-ghost btn-sm" href="/api/trust/verify?format=html" target="_blank" rel="noopener">Verify page</a>
          <button class="btn btn-ghost btn-sm" id="trust-send-ai-btn" type="button" title="Send trust verification data to AI coding agent">🤖 Send to AI Agent</button>
        </div>
      </div>

      ${staticHost ? `
        <div class="card mb-4" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2);">
          <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
            Static-host preview: trust APIs require <code>npm run dashboard</code> locally.
          </p>
        </div>
      ` : ''}

      <div class="card mb-4">
        <p style="margin:0 0 0.75rem;font-size:var(--font-size-sm);color:var(--text-secondary);">
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
        ${renderReAttestation(this.app?.state?.reAttestation)}

        <div class="card mb-4">
          <div class="section-heading mb-2">
            <h3 style="margin:0;font-size:var(--font-size-base);">Repository optimization</h3>
            <a class="btn btn-secondary btn-sm" href="/dashboard/repository-health">Full health report →</a>
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

        ${fictionScope ? `
          <div class="card mb-4">
            <h3 class="mb-2" style="font-size:var(--font-size-base);">Fiction / KPI scope</h3>
            <div class="metrics-row mb-3">
              <div class="metric-chip"><strong>${escapeHtml(fictionScope.mode || 'repository-json')}</strong> mode</div>
              <div class="metric-chip"><strong>${formatNumber(fictionScope.fictionJsonFilesScanned ?? '—')}</strong> JSON scanned</div>
              <div class="metric-chip"><strong>${formatNumber(fictionScope.fictionSampleFilesScanned ?? '—')}</strong> mock JSON</div>
            </div>
            <p class="text-muted" style="margin:0;font-size:var(--font-size-xs);">
              Walk root: <code>${escapeHtml(redactPathForDisplay(fictionScope.walkRoot || 'ai-platform'))}</code>
              · Pattern matching only (config.ignore applied)
            </p>
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
            Refresh reports + publish: <code>npm run trust:refresh</code> (platform + monorepo scan with <code>--output</code>, then trust publish)
          </p>
        </div>
      </div>
    `;
  }

  downloadTrustData() {
    if (!this.data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      ...this.data
    };
    downloadJson(payload, `trust-verification-${new Date().toISOString().slice(0, 10)}.json`);
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
      container.querySelector('#trust-download-json')?.addEventListener('click', () => this.downloadTrustData());
      container.querySelector('#trust-send-ai-btn')?.addEventListener('click', async () => {
        const data = this.data;
        if (!data) { showToast('No trust data to send', 'error'); return; }
        const live = data.live || {};
        const payload = {
          projectPath: this.app.state.lastProjectPath || window.location.origin,
          reportType: 'trust-verification',
          reportSummary: {
            verificationId: live.verificationId,
            headlineSource: live.headlineSource,
            headlineReason: live.headlineReason,
            platform: live.platform,
            monorepo: live.monorepo,
            repositoryHealthScore: live.repositoryHealth?.headline?.repositoryHealthScore ?? 'N/A'
          },
          notes: 'Trust Verification — scoped scan results and repository health'
        };
        const vscode = this._getVscodeApi();
        if (vscode) {
          try { vscode.postMessage({ command: 'sendToAI', data: payload }); showToast('Trust verification sent to AI agent', 'success'); return; }
          catch (err) { console.warn('[Trust-AI] vscode.postMessage failed:', err); } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
        }
        try {
          const res = await fetch(resolveApiUrl('/api/ai-context'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const json = await res.json();
          if (json.success && json.content) { await navigator.clipboard.writeText(json.content); showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success'); }
          else { showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success'); }
        } catch (err) { showToast('Failed to send: ' + err.message, 'error'); }
      });
    }
  }

  destroy() {}
}
