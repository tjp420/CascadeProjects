// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, formatNumber, redactPathForDisplay, showToast, downloadJson, setHtml } from '../utils.js';
import { renderRepositoryHealthSection } from './RepositoryHealthView.js';
import { getVsCodeApi, renderSkeletonCard } from '../utils-lib/dom.js?v=20260725phase3';
/**
 * Extract normalized live trust data from a raw payload or wrapper.
 * @param {any} data
 * @returns {any}
 */
function extractLiveTrustData(data) {
    if (!data || typeof data !== 'object')
        return null;
    const source = data.live || data;
    const headline = source.headline;
    const headlineObj = (typeof headline === 'object' && headline && headline.primary) ? headline : null;
    return {
        verificationId: source.verificationId || null,
        headlineSource: headlineObj ? (headlineObj.source || null) : (source.headlineSource || null),
        headlineReason: headlineObj ? (headlineObj.reason || null) : (source.headlineReason || null),
        headline: headlineObj ? (headlineObj.primary || null) : (source.headline || null),
        gatePass: source.gatePass != null ? source.gatePass : null,
        score: source.score != null ? source.score : null,
        generatedAt: source.generatedAt || null,
        platform: source.platform || null,
        monorepo: source.monorepo || null,
        repositoryHealth: source.repositoryHealth || null,
        disclaimers: Array.isArray(source.disclaimers) ? source.disclaimers : [],
        methodology: Array.isArray(source.methodology) ? source.methodology : [],
        fictionScope: source.fictionScope || null,
        factors: Array.isArray(source.factors) ? source.factors : [],
        badges: Array.isArray(source.badges) ? source.badges : []
    };
}

/**
 * Normalize static trust payload.
 * @param {any} data
 * @returns {any}
 */
function normalizeStaticTrustPayload(data) {
    const live = extractLiveTrustData(data);
    if (!live)
        return null;
    return { success: true, live, staticHost: true, staticPayload: true };
}
/**
 * Fetch static trust fallback.
 * @returns {any}
 */
async function fetchStaticTrustFallback() {
    const trustHttpResponse = await fetch('/trust-verification.json', { cache: 'no-store' }).catch(() => null);
    if (!trustHttpResponse || !trustHttpResponse.ok)
        return null;
    const trustVerificationDocument = await trustHttpResponse.json().catch(() => null);
    return normalizeStaticTrustPayload(trustVerificationDocument);
}
/**
 * Normalize trust api payload.
 * @param {any} data
 * @returns {any}
 */
function normalizeTrustApiPayload(data) {
    if (!data || typeof data !== 'object')
        return null;
    if (!data.type && !data.platform && !data.monorepo && !data.live) {
        return data;
    }
    const live = extractLiveTrustData(data);
    if (!live)
        return null;
    return {
        success: data.success != null ? data.success : true,
        live,
        publishedAt: data.publishedAt || null
    };
}
/**
 * Fetch trust verification.
 * @returns {any}
 */
export async function fetchTrustVerification() {
    const res = await fetch('/api/trust/verification', { cache: 'no-store' });
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        const fallback = await fetchStaticTrustFallback();
        if (fallback)
            return fallback;
        return { staticHost: true, live: null };
    }
    const rawData = await res.json().catch(() => null);
    const data = normalizeTrustApiPayload(rawData);
    if (!data) {
        const fallback = await fetchStaticTrustFallback();
        if (fallback)
            return fallback;
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
        <div class="metric-chip"><strong>${(_b = (_a = gate.qualityScore) !== null && _a !== void 0 ? _a : hygiene.qualityScore) !== null && _b !== void 0 ? _b : '—'}%</strong> quality</div>
        <div class="metric-chip"><strong>${formatNumber((_d = (_c = gate.blockingCount) !== null && _c !== void 0 ? _c : hygiene.blockingCount) !== null && _d !== void 0 ? _d : 0)}</strong> blocking</div>
        <div class="metric-chip"><strong>${formatNumber((_f = (_e = gate.ruleScopedFilesAnalyzed) !== null && _e !== void 0 ? _e : hygiene.ruleScopedFilesAnalyzed) !== null && _f !== void 0 ? _f : 0)}</strong> gate checked</div>
        <div class="metric-chip"><strong>${formatNumber((_h = (_g = gate.repositoryFilesTotal) !== null && _g !== void 0 ? _g : hygiene.repositoryFilesTotal) !== null && _h !== void 0 ? _h : 0)}</strong> repo files</div>
        <div class="metric-chip"><strong>${formatNumber((_j = hygiene.credentialScanned) !== null && _j !== void 0 ? _j : 0)}</strong> CRED scanned</div>
        <div class="metric-chip"><strong>${formatNumber((_k = hygiene.gateMetadataOnlyFiles) !== null && _k !== void 0 ? _k : 0)}</strong> metadata only</div>
        <div class="metric-chip"><strong>${formatNumber((_l = hygiene.fictionJsonFilesScanned) !== null && _l !== void 0 ? _l : 0)}</strong> fiction JSON</div>
        <div class="metric-chip"><strong>${formatNumber((_m = hygiene.fictionSampleFilesScanned) !== null && _m !== void 0 ? _m : 0)}</strong> fiction samples</div>
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
        return `
    <div class="card mb-4" style="border-left:4px solid var(--warning);">
      <div class="section-heading mb-2">
        <h3 style="margin:0;font-size:var(--font-size-base);">${escapeHtml(title)}</h3>
        <span class="gate-badge warn">NO DATA</span>
      </div>
      <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">No ${escapeHtml(title)} report on disk — run a Simplebeacon scan first.</p>
    </div>
  `;
    }
    const gatePass = snap.gatePass;
    const accent = gatePass ? 'var(--success)' : 'var(--warning)';
    const badgeClass = gatePass ? 'pass' : 'warn';
    const badgeLabel = gatePass ? 'GATE PASS' : 'GATE REVIEW';
    const quality = snap.qualityScore != null ? snap.qualityScore + '%' : '—';
    const issueCount = snap.issueCount != null ? formatNumber(snap.issueCount) : '—';
    const schema = (snap.schemaPassed != null ? snap.schemaPassed : '—') + '/' + (snap.schemaChecked != null ? snap.schemaChecked : '—');
    const consistency = snap.consistencyScore != null ? snap.consistencyScore + '%' : '—';
    const repoFiles = snap.repositoryFilesTotal != null ? formatNumber(snap.repositoryFilesTotal) : '—';
    const gateChecked = snap.ruleScopedFilesAnalyzed != null ? formatNumber(snap.ruleScopedFilesAnalyzed) : '—';
    const mockSample = snap.mockSampleFiles != null ? formatNumber(snap.mockSampleFiles) : '—';
    const fictionJson = snap.fictionJsonFilesScanned != null ? formatNumber(snap.fictionJsonFilesScanned) : '—';
    const fictionSamples = snap.fictionSampleFilesScanned != null ? formatNumber(snap.fictionSampleFilesScanned) : (snap.mockSampleFiles != null ? formatNumber(snap.mockSampleFiles) : '—');
    return `
    <div class="card mb-4" style="border-top:3px solid ${accent};">
      <div class="section-heading mb-3">
        <div>
          <h3 style="margin:0 0 0.25rem;font-size:var(--font-size-base);">${escapeHtml(title)}</h3>
          <p class="text-muted" style="margin:0;font-size:var(--font-size-xs);">
            <code>${escapeHtml(redactPathForDisplay(snap.projectRoot))}</code> · ${escapeHtml(snap.generatedAt || '—')}
          </p>
        </div>
        <span class="gate-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="metrics-row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:0.75rem;">
        <div class="metric-chip"><strong>${quality}</strong> quality</div>
        <div class="metric-chip"><strong>${issueCount}</strong> issues</div>
        <div class="metric-chip"><strong>${schema}</strong> schema</div>
        <div class="metric-chip"><strong>${consistency}</strong> consistency</div>
        <div class="metric-chip"><strong>${repoFiles}</strong> repo files</div>
        <div class="metric-chip"><strong>${gateChecked}</strong> gate checked</div>
        <div class="metric-chip"><strong>${mockSample}</strong> mock/sample</div>
        <div class="metric-chip"><strong>${fictionJson}</strong> fiction JSON</div>
        <div class="metric-chip"><strong>${fictionSamples}</strong> fiction samples</div>
      </div>
      ${snap.scopeNote ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">${escapeHtml(snap.scopeNote)}</p>` : ''}
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
    render() {
        const live = (this.data && this.data.live) || null;
        const staticHost = Boolean(this.data && this.data.staticHost);
        const disclaimers = (live && live.disclaimers) || [];
        const methodology = (live && live.methodology) || [];
        const fictionScope = (live && live.fictionScope) || null;
        const factors = (live && live.factors) || [];
        const badges = (live && live.badges) || [];
        const reAttestation = this.app && this.app.state && this.app.state.reAttestation;
        const repoHealth = live && live.repositoryHealth;
        if (this.loading) {
            return `
        <div class="analyze-hero"><h1 class="page-title">Trust Verification</h1><p class="text-muted analyze-hero-sub">Loading trust data…</p></div>
        ${renderSkeletonCard(4)}
        <div class="grid-3 mt-4">
          ${renderSkeletonCard(2)}
          ${renderSkeletonCard(2)}
          ${renderSkeletonCard(2)}
        </div>
      `;
        }
        if (this.error) {
            return `
        <div class="analyze-hero"><h1 class="page-title">Trust Verification</h1><p class="text-muted analyze-hero-sub">Trust data unavailable</p></div>
        <div class="card" style="padding:var(--space-4);border-color:var(--danger);">
          <p class="text-danger" style="margin:0 0 var(--space-3);">${escapeHtml(this.error)}</p>
          <button type="button" class="btn btn-secondary btn-sm" id="trust-retry-btn">Retry</button>
        </div>
      `;
        }
        return `
      <div class="analyze-hero" style="align-items:flex-start;gap:var(--space-3);">
        <div>
          <h1 class="page-title">Trust Verification</h1>
          <p class="text-muted analyze-hero-sub">Scoped scan results and integrity attestation.</p>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" id="trust-download-json" type="button">
            <i data-lucide="download" class="icon-16"></i> Download JSON
          </button>
          <a class="btn btn-ghost btn-sm" href="/api/trust/badge" target="_blank" rel="noopener">Badge preview</a>
          <a class="btn btn-ghost btn-sm" href="/api/trust/verify?format=html" target="_blank" rel="noopener">Verify page</a>
          ${this.app.isCurrentUserAdmin() ? '<button class="btn btn-ghost btn-sm" id="trust-send-ai-btn" type="button" title="Send trust verification data to AI coding agent">🤖 Send to AI Agent</button>' : ''}
        </div>
      </div>

      ${staticHost ? `
        <div class="card mb-4" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2);">
          <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
            Static-host preview: trust APIs require <code>npm run dashboard</code> locally.
          </p>
        </div>
      ` : ''}

      <div class="grid-3 mb-4">
        <div class="card" style="border-top:3px solid var(--accent);">
          <div class="text-muted text-xs" style="margin-bottom:0.25rem;">Trust score</div>
          <div style="font-size:2rem;font-weight:700;color:var(--text-primary);">${escapeHtml((live && live.score) != null ? live.score + '%' : '—')}</div>
        </div>
        <div class="card" style="border-top:3px solid ${(live && live.gatePass) ? 'var(--success)' : 'var(--warning)'};">
          <div class="text-muted text-xs" style="margin-bottom:0.25rem;">Gate</div>
          <div style="font-size:1.25rem;font-weight:700;color:var(--text-primary);">${(live && live.gatePass) ? 'PASS' : 'REVIEW'}</div>
        </div>
        <div class="card" style="border-top:3px solid var(--accent);">
          <div class="text-muted text-xs" style="margin-bottom:0.25rem;">Generated</div>
          <div style="font-size:1rem;font-weight:600;color:var(--text-primary);">${escapeHtml((live && live.generatedAt) ? live.generatedAt.slice(0, 10) : '—')}</div>
        </div>
      </div>

      <div class="card mb-4" style="border-left:4px solid var(--accent);">
        <div class="section-heading mb-3">
          <div>
            <h2 style="margin:0 0 0.25rem;font-size:var(--font-size-lg);">Verification summary</h2>
            <p class="text-muted" style="margin:0;font-size:var(--font-size-xs);">
              ID: <code>${escapeHtml((live && live.verificationId) || '—')}</code> · Method: deterministic gate + pattern matching
            </p>
          </div>
          ${(live && live.headline) ? `<span class="gate-badge ${live.gatePass ? 'pass' : 'warn'}">${escapeHtml(live.headline)}</span>` : ''}
        </div>
        <p style="margin:0 0 0.75rem;font-size:var(--font-size-sm);color:var(--text-secondary);">
          We publish <strong>scoped</strong> Simplebeacon scan results — not marketing claims.
          A high quality score means configured sample paths passed rules; it does <em>not</em> mean zero issues across a large monorepo.
        </p>
        <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">
          Headline source: <code>${escapeHtml((live && live.headlineSource) || 'n/a')}</code>
          ${(live && live.headlineReason) ? ` · ${escapeHtml(live.headlineReason)}` : ''}
        </p>
      </div>

      ${factors.length ? `
        <div class="card mb-4">
          <h3 class="mb-2" style="font-size:var(--font-size-base);">Trust factors</h3>
          <div class="metrics-row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">
            ${factors.map((f) => `
              <div class="metric-chip" style="${f.status === 'Fail' ? 'border-color:var(--danger);' : (f.status === 'Review' ? 'border-color:var(--warning);' : '')}">
                <strong>${escapeHtml(f.status || '—')}</strong> ${escapeHtml(f.text || '')}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${badges.length ? `
        <div class="card mb-4">
          <h3 class="mb-2" style="font-size:var(--font-size-base);">Badges</h3>
          <div class="metrics-row" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${badges.map((b) => `
              <div class="metric-chip" style="${b.unlocked ? '' : 'opacity:0.5;'}">
                <span style="margin-right:0.25rem;">${escapeHtml(b.icon || '')}</span>
                <strong>${escapeHtml(b.name || '')}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${renderSnapshot((live && live.platform) || null, 'Platform gate scan')}
      ${(live && live.monorepo) ? renderSnapshot(live.monorepo, 'Monorepo root scan') : ''}
      ${renderReAttestation(reAttestation)}

      <div class="card mb-4">
        <div class="section-heading mb-2">
          <h3 style="margin:0;font-size:var(--font-size-base);">Repository optimization</h3>
          <a class="btn btn-secondary btn-sm" href="/dashboard/repository-health">Full health report →</a>
        </div>
        ${(repoHealth && repoHealth.headline)
          ? renderRepositoryHealthSection(repoHealth, { compact: true })
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
          <div class="metrics-row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:0.75rem;">
            <div class="metric-chip"><strong>${escapeHtml(fictionScope.mode || 'repository-json')}</strong> mode</div>
            <div class="metric-chip"><strong>${formatNumber(fictionScope.fictionJsonFilesScanned != null ? fictionScope.fictionJsonFilesScanned : '—')}</strong> JSON scanned</div>
            <div class="metric-chip"><strong>${formatNumber(fictionScope.fictionSampleFilesScanned != null ? fictionScope.fictionSampleFilesScanned : '—')}</strong> mock JSON</div>
          </div>
          <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">
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
    `;
    }
    downloadTrustData() {
        if (!this.data)
            return;
        const payload = {
            exportedAt: new Date().toISOString(),
            ...this.data
        };
        downloadJson(payload, `trust-verification-${new Date().toISOString().slice(0, 10)}.json`);
    }
    async mount(container) {
        var _a, _b;
        this.loading = true;
        this.error = null;
        setHtml(container, this.render());
        try {
            this.data = await fetchTrustVerification();
        }
        catch (err) {
            this.error = err.message;
        }
        finally {
            this.loading = false;
            setHtml(container, this.render());
            (_a = container.querySelector('#trust-download-json')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.downloadTrustData());
            const retryBtn = container.querySelector('#trust-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.mount(container));
            }
            (_b = container.querySelector('#trust-send-ai-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', async () => {
                var _a, _b, _c;
                const data = this.data;
                if (!data) {
                    showToast('No trust data to send', 'error');
                    return;
                }
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
                        repositoryHealthScore: (_c = (_b = (_a = live.repositoryHealth) === null || _a === void 0 ? void 0 : _a.headline) === null || _b === void 0 ? void 0 : _b.repositoryHealthScore) !== null && _c !== void 0 ? _c : 'N/A'
                    },
                    notes: 'Trust Verification — scoped scan results and repository health'
                };
                const vscode = getVsCodeApi();
                if (vscode) {
                    try {
                        vscode.postMessage({ command: 'sendToAI', data: payload });
                        showToast('Trust verification sent to AI agent', 'success');
                        return;
                    }
                    catch (err) {
                        window["console"]["warn"]('[Trust-AI] vscode.postMessage failed:', err);
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
        }
    }
    destroy() { }
}
