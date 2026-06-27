import { escapeHtml, formatNumber, redactPathForDisplay, showToast, apiUrl } from '../utils.js';
import { renderRepositoryHealthSection } from './RepositoryHealthView.js';

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
  const trustHttpResponse = await fetch('/trust-verification.json', { cache: 'no-store' }).catch(() => null);
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
  const res = await fetch(apiUrl('/api/trust/verification'), { cache: 'no-store' });
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
      <div class="trust-redesign">
      <style>
        .trust-redesign .trust-hero { text-align: center; margin: var(--space-6) 0 var(--space-5); }
        .trust-redesign .trust-hero h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .trust-redesign .trust-hero p { color: var(--text-muted); font-size: 0.95rem; max-width: 560px; margin: 0 auto; }
        .trust-redesign .trust-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); padding: var(--space-3); background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .trust-redesign .trust-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: var(--radius-lg); margin-bottom: var(--space-4); font-size: 0.85rem; color: var(--text-muted); }
        .trust-redesign .trust-intro { background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04)); border: 1px solid rgba(99,102,241,0.15); border-radius: var(--radius-xl); padding: var(--space-5); margin-bottom: var(--space-4); }
        .trust-redesign .trust-intro p { margin: 0 0 var(--space-3); font-size: var(--font-size-sm); color: var(--text-secondary); }
        .trust-redesign .trust-meta { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: var(--font-size-xs); color: var(--text-muted); }
        .trust-redesign .trust-meta div { display: flex; align-items: center; gap: 6px; }
        .trust-redesign .trust-meta code { font-size: var(--font-size-xs); }

        /* Badge configurator */
        .badge-configurator-card .panel-header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .badge-configurator-card .panel-title-group { display: flex; align-items: center; gap: 10px; }
        .badge-configurator-card .panel-title-group h3 { margin: 0; font-size: var(--font-size-base); }
        .badge-configurator-card .panel-subtitle { font-size: 0.8rem; color: var(--text-muted); }
        .configurator-workspace-grid { display: flex; gap: 20px; margin: 16px 0; flex-wrap: wrap; }
        .config-controls-pane { flex: 4; min-width: 240px; display: flex; flex-direction: column; gap: 14px; }
        .config-preview-pane { flex: 3; min-width: 220px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 16px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); }
        .control-group { display: flex; flex-direction: column; gap: 6px; }
        .control-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; }
        .control-label.preview-title { margin-bottom: 12px; align-self: flex-start; }
        .toggle-chip-group { display: flex; gap: 8px; flex-wrap: wrap; }
        .config-chip { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
        .config-chip:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .config-chip.is-active { background: rgba(59,130,246,0.15); border-color: #3b82f6; color: #60a5fa; font-weight: 500; box-shadow: 0 0 12px rgba(59,130,246,0.2); }
        .snippet-output-workspace { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px; }
        .snippet-tab-header { display: flex; gap: 4px; margin-bottom: 8px; }
        .snippet-tab-btn { background: none; border: none; color: var(--text-muted); padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-bottom: 2px solid transparent; }
        .snippet-tab-btn:hover { color: var(--text-primary); }
        .snippet-tab-btn.is-active { color: var(--text-primary); border-bottom-color: #3b82f6; font-weight: 500; }
        .snippet-box-container { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
        .snippet-box-container pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
        .snippet-box-container code { font-family: var(--font-mono); font-size: 0.8rem; color: #93c5fd; }
        .copy-snippet-action-btn { position: absolute; top: 8px; right: 8px; background: var(--surface-elevated); border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; }
        .copy-snippet-action-btn:hover { background: var(--surface); color: var(--text-primary); }
        .copy-snippet-action-btn.success { background: rgba(16,185,129,0.15); border-color: #10b981; color: #34d399; }
      </style>

      <div class="trust-hero">
        <h1>Trust Verification</h1>
        <p>Scoped scan results — not marketing claims.</p>
      </div>

      <div class="trust-actions">
        <div></div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" id="trust-download-json" type="button">
            <i data-lucide="download" class="icon-16"></i> Download JSON
          </button>
          <a class="btn btn-ghost btn-sm" href="/api/trust/badge" target="_blank" rel="noopener">Badge preview</a>
          <a class="btn btn-ghost btn-sm" href="/api/trust/verify?format=html" target="_blank" rel="noopener">Verify page</a>
          <button class="btn btn-ghost btn-sm" id="trust-send-ai-btn" type="button" title="Send trust verification data to AI coding agent">🤖 Send to AI</button>
        </div>
      </div>

      ${staticHost ? `
        <div class="trust-banner">
          <i data-lucide="alert-triangle" class="icon-16" style="color:var(--warning);flex-shrink:0;"></i>
          <span>Static-host preview: trust APIs require <code>npm run dashboard</code> locally.</span>
        </div>
      ` : ''}

      <div class="trust-intro">
        <p>
          We publish <strong>scoped</strong> Simplebeacon scan results — not marketing claims.
          A 99% quality score on the platform gate means configured sample paths passed rules;
          it does <em>not</em> mean zero issues across a 40k+ file monorepo.
        </p>
        <div class="trust-meta">
          <div><i data-lucide="fingerprint" class="icon-14"></i> ID: <code>${escapeHtml(live?.verificationId || '—')}</code></div>
          <div><i data-lucide="scan" class="icon-14"></i> Method: deterministic gate + pattern matching</div>
          <div><i data-lucide="tag" class="icon-14"></i> Source: <code>${escapeHtml(live?.headlineSource || 'n/a')}</code></div>
          ${live?.headlineReason ? `<div><i data-lucide="info" class="icon-14"></i> ${escapeHtml(live.headlineReason)}</div>` : ''}
        </div>
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

        ${this.renderBadgeConfigurator(live?.verificationId, this.resolveCurrentScore(live))}

        <div class="card" style="margin-top:var(--space-4);">
          <h3 class="mb-2" style="font-size:var(--font-size-base);">Publish workflow</h3>
          <p class="text-muted mb-0" style="font-size:var(--font-size-xs);">
            Refresh reports + publish: <code>npm run trust:refresh</code> (platform + monorepo scan with <code>--output</code>, then trust publish)
          </p>
        </div>
      </div>
      </div>
    `;
  }

  resolveCurrentScore(live) {
    const platform = live?.platform;
    const repo = live?.repositoryHealth;
    return platform?.qualityScore ?? repo?.headline?.repositoryHealthScore ?? 100;
  }

  renderBadgeConfigurator(verificationId, currentScore) {
    return `
      <div class="card badge-configurator-card">
        <div class="panel-header">
          <div class="panel-title-group">
            <i data-lucide="shield-check" class="icon-18"></i>
            <h3 style="margin:0;font-size:var(--font-size-base);">Interactive Trust Badge Configurator</h3>
          </div>
          <span class="panel-subtitle">Customize and embed your deterministic quality proof</span>
        </div>

        <div class="configurator-workspace-grid">
          <div class="config-controls-pane">
            <div class="control-group">
              <label class="control-label">Badge Style</label>
              <div class="toggle-chip-group" data-config-key="style">
                <button type="button" class="config-chip is-active" data-value="glass">Glassmorphic</button>
                <button type="button" class="config-chip" data-value="solid">Solid Slate</button>
              </div>
            </div>
            <div class="control-group">
              <label class="control-label">Visual Theme</label>
              <div class="toggle-chip-group" data-config-key="theme">
                <button type="button" class="config-chip is-active" data-value="dark">Dark Mode</button>
                <button type="button" class="config-chip" data-value="light">Light Mode</button>
              </div>
            </div>
            <div class="control-group">
              <label class="control-label">Metrics Display</label>
              <div class="toggle-chip-group" data-config-key="metrics">
                <button type="button" class="config-chip is-active" data-value="score">Include Score</button>
                <button type="button" class="config-chip" data-value="compact">Pass/Fail Only</button>
              </div>
            </div>
          </div>

          <div class="config-preview-pane">
            <label class="control-label preview-title">Live Dynamic Preview</label>
            <div class="badge-preview-canvas" id="trust-badge-live-preview"></div>
          </div>
        </div>

        <div class="snippet-output-workspace">
          <div class="snippet-tab-header">
            <button type="button" class="snippet-tab-btn is-active" data-target="markdown">Markdown</button>
            <button type="button" class="snippet-tab-btn" data-target="html">HTML Embed</button>
          </div>
          <div class="snippet-box-container">
            <pre><code id="badge-snippet-code-block"></code></pre>
            <button type="button" class="copy-snippet-action-btn" id="copy-badge-snippet-btn" title="Copy code snippet to clipboard">
              <i data-lucide="copy" class="icon-12"></i> Copy
            </button>
          </div>
        </div>
      </div>
    `;
  }

  initBadgeConfigurator(verificationId, currentScore) {
    this.badgeConfig = {
      style: 'glass',
      theme: 'dark',
      metrics: 'score',
      id: verificationId || 'sb-local-gate',
      score: currentScore || 100
    };
    this.bindConfiguratorEvents();
    this.updateConfiguratorWorkspace();
  }

  bindConfiguratorEvents() {
    const card = document.querySelector('.badge-configurator-card');
    if (!card) return;

    card.addEventListener('click', (e) => {
      const chip = e.target.closest('.config-chip');
      if (chip) {
        const group = chip.closest('.toggle-chip-group');
        const key = group.getAttribute('data-config-key');
        group.querySelectorAll('.config-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        this.badgeConfig[key] = chip.getAttribute('data-value');
        this.updateConfiguratorWorkspace();
        return;
      }

      const tabBtn = e.target.closest('.snippet-tab-btn');
      if (tabBtn) {
        card.querySelectorAll('.snippet-tab-btn').forEach((btn) => btn.classList.remove('is-active'));
        tabBtn.classList.add('is-active');
        this.updateConfiguratorWorkspace();
      }
    });

    const copyBtn = card.querySelector('#copy-badge-snippet-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const codeText = card.querySelector('#badge-snippet-code-block')?.innerText || '';
        navigator.clipboard.writeText(codeText).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = `<i data-lucide="check" class="icon-12"></i> Copied!`;
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('success');
          }, 1800);
        }).catch((err) => console.error('[Trust] Clipboard copy failed:', err));
      });
    }
  }

  updateConfiguratorWorkspace() {
    const { style, theme, metrics, id, score } = this.badgeConfig;
    const baseUrl = `${window.location.origin}/api/trust/badge.svg?raw=1`;
    const queryParams = `&style=${style}&theme=${theme}&metrics=${metrics}&score=${score}&id=${encodeURIComponent(id)}`;
    const fullBadgeUrl = baseUrl + queryParams;
    const trackingLink = `${window.location.origin}/api/trust/verify`;

    const previewContainer = document.getElementById('trust-badge-live-preview');
    if (previewContainer) {
      const fillBg = theme === 'dark' ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.8)';
      const textMain = theme === 'dark' ? '#fff' : '#0f172a';
      const borderGlow = style === 'glass' ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.1)';
      const scoreString = metrics === 'score' ? ` | Score: ${score}%` : '';
      const shortId = String(id).substring(0, 8);
      previewContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="310" height="42" viewBox="0 0 310 42" style="cursor:pointer;">
          <rect width="308" height="40" x="1" y="1" rx="6" fill="${fillBg}" stroke="${borderGlow}" stroke-width="1"/>
          <circle cx="22" cy="21" r="7" fill="#10b981"/>
          <text x="38" y="25" fill="${textMain}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">SimpleBeacon Verified${scoreString}</text>
          <text x="235" y="24" fill="rgba(156,163,175,0.9)" font-family="monospace" font-size="10">[${shortId}]</text>
        </svg>
      `;
    }

    const activeTab = card.querySelector('.snippet-tab-btn.is-active');
    const tabType = activeTab ? activeTab.getAttribute('data-target') : 'markdown';
    const codeBlock = document.getElementById('badge-snippet-code-block');
    if (codeBlock) {
      if (tabType === 'markdown') {
        codeBlock.textContent = `[![SimpleBeacon Code Hygiene Proof](${fullBadgeUrl})](${trackingLink})`;
      } else {
        codeBlock.textContent = `<a href="${trackingLink}" target="_blank" rel="noopener noreferrer">\n  <img src="${fullBadgeUrl}" alt="SimpleBeacon Code Hygiene Proof" />\n</a>`;
      }
    }
  }

  downloadTrustData() {
    if (!this.data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      ...this.data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trust-verification-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      const live = this.data?.live || {};
      this.initBadgeConfigurator(live.verificationId, this.resolveCurrentScore(live));
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
          const res = await fetch(apiUrl('/api/ai-context'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const json = await res.json();
          if (json.success && json.content) { await navigator.clipboard.writeText(json.content); showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success'); }
          else { showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success'); }
        } catch (err) { showToast('Failed to send: ' + err.message, 'error'); }
      });
    }
  }

  destroy() {}
}
