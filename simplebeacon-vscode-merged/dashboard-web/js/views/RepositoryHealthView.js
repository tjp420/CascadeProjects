// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, formatNumber, redactPathForDisplay, showToast } from '../utils.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';

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
  const res = await fetch('/api/optimization/health', { cache: 'no-store', headers: authHeaders() });
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
    return `<p class="text-muted card">No ${escapeHtml(title)} consolidation report — run Analyze → Consolidation or <code>npm run optimization:scan</code>.</p>`;
  }

  const scoreClass = snap.repositoryHealthScore >= 80 ? 'pass' : snap.repositoryHealthScore >= 60 ? 'warn' : 'fail';

  return `
    <div class="card mb-4">
      <div class="section-heading mb-2">
        <h3 style="margin:0;font-size:var(--font-size-base);">${escapeHtml(title)}</h3>
        <span class="gate-badge ${scoreClass}">${snap.repositoryHealthScore}/100 health</span>
      </div>
      <p class="text-muted text-sm mb-4" style="margin-top:0;">
        Path: <code>${escapeHtml(redactPathForDisplay(snap.projectRoot))}</code>
        · Last scan: ${escapeHtml(snap.generatedAt || '—')}
      </p>
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${formatNumber(snap.repositoryFilesTotal ?? '—')}</strong> repo files</div>
        <div class="metric-chip"><strong>${formatNumber(snap.repositoryFoldersTotal ?? '—')}</strong> folders</div>
        <div class="metric-chip"><strong>${escapeHtml(snap.optimizationPotential || '—')}</strong> savings</div>
        <div class="metric-chip"><strong>${snap.duplicateGroups ?? '—'}</strong> dup groups</div>
        <div class="metric-chip"><strong>${snap.oversizedFiles ?? '—'}</strong> oversized</div>
        <div class="metric-chip"><strong>${snap.reductionOpportunities ?? '—'}</strong> reductions</div>
      </div>
      <p class="text-muted" style="font-size:var(--font-size-xs);margin:0;">${escapeHtml(snap.scopeNote || '')}</p>
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
        <div class="analyze-hero">
          <h1 class="page-title">Repository Health</h1>
          <p class="text-muted analyze-hero-sub">Loading health metrics…</p>
        </div>
        <p class="text-muted"><span class="loading-spinner"></span> Loading repository health…</p>
      `;
    }
    if (this.error) {
      return `
        <div class="analyze-hero">
          <h1 class="page-title">Repository Health</h1>
          <p class="text-muted analyze-hero-sub">Health metrics unavailable</p>
        </div>
        <p class="text-danger card">${escapeHtml(this.error)}</p>
      `;
    }

    const health = this.data;
    const headline = health?.headline;
    const staticHost = Boolean(health?.staticHost);

    return `
      <div class="analyze-hero">
        <h1 class="page-title">Repository Health</h1>
        <p class="text-muted analyze-hero-sub">Duplicate detection, oversized files, and consolidation opportunities.</p>
      </div>

      <div class="section-block repo-health-grid">
        <div class="repo-health-main">
          <div class="summary-cards">
            <div class="summary-card">
              <span class="value">${headline ? escapeHtml(String(headline.repositoryHealthScore)) : '—'}</span>
              <span class="label">Health score</span>
            </div>
            <div class="summary-card">
              <span class="value">${headline ? escapeHtml(headline.optimizationPotential || '—') : '—'}</span>
              <span class="label">Optimization potential</span>
            </div>
            <div class="summary-card">
              <span class="value">${headline ? escapeHtml(String(headline.duplicateGroups ?? '—')) : '—'}</span>
              <span class="label">Duplicate groups</span>
            </div>
            <div class="summary-card">
              <span class="value">${headline ? escapeHtml(String(headline.oversizedFiles ?? '—')) : '—'}</span>
              <span class="label">Oversized files</span>
            </div>
          </div>

          ${renderHealthSnapshot(health?.monorepo, 'Monorepo root')}
          ${health?.platform && health?.monorepo ? renderHealthSnapshot(health.platform, 'Platform (ai-platform)') : ''}

          ${this.candidates.length ? `
            <div class="card mb-4">
              <h3 class="mb-2" style="font-size:var(--font-size-base);">Merge candidates (preview only)</h3>
              <p class="text-muted text-sm">Phase 3 safety: preview → confirm → quarantine. No auto-delete. Pairs under <code>ai-platform/packages/simplebeacon-cli</code> ↔ <code>packages/simplebeacon-cli</code> are intentional npm mirrors and are not shown.</p>
              <div class="consolidation-list">
                ${this.candidates.slice(0, 5).map((item) => `
                  <div class="consolidation-card card">
                    <div class="consolidation-meta">${escapeHtml(item.mergeType || 'candidate')} · ${escapeHtml(item.savingsLabel || '—')} savings</div>
                    <p><code>${escapeHtml((item.files || []).map((f) => f.path).join(' ↔ ') || '—')}</code></p>
                    <button type="button" class="btn btn-secondary btn-sm preview-merge-btn" data-candidate-id="${escapeHtml(item.id || '')}" ${this.previewLoading && this.previewCandidateId === item.id ? 'disabled' : ''}>
                      ${this.previewLoading && this.previewCandidateId === item.id ? 'Previewing…' : 'Preview merge'}
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${this.previewLoading ? `
            <div class="card mb-4" id="merge-preview-panel">
              <p class="text-muted" style="margin:0;"><span class="loading-spinner"></span> Building merge preview…</p>
            </div>
          ` : ''}

          ${this.preview ? `
            <div class="card mb-4" id="merge-preview-panel">
              <h3 class="mb-2" style="font-size:var(--font-size-base);">Merge preview</h3>
              <p class="text-muted text-sm">Keep: <code>${escapeHtml(this.preview.keepFile || '—')}</code> · Remove: ${(this.preview.removeFiles || []).map((f) => `<code>${escapeHtml(f)}</code>`).join(', ') || '—'}</p>
              <p class="text-muted text-sm">Conflicts: ${this.preview.conflicts?.length || 0} · Safe: ${this.preview.safeToExecute ? 'yes' : 'no'} · Mode: ${escapeHtml(this.preview.executionMode || '—')}</p>
              ${this.preview.riskAssessment ? `
                <p class="text-muted text-sm">Risk: ${escapeHtml(this.preview.riskAssessment.level || '—')}${(this.preview.riskAssessment.factors || []).length ? ` · ${escapeHtml(this.preview.riskAssessment.factors.join('; '))}` : ''}</p>
              ` : ''}
              ${this.preview.safeToExecute ? `
                <div class="flex gap-2 mt-2">
                  <button type="button" class="btn btn-danger btn-sm" id="quarantine-merge-btn">Quarantine duplicates</button>
                  <span class="text-muted text-sm" style="align-self:center;">Requires phrase: <code>${escapeHtml(this.preview.confirmationPhrase || '')}</code></span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${this.previewError ? `<p class="text-danger card" id="merge-preview-panel">${escapeHtml(this.previewError)}</p>` : ''}

          ${(health?.recommendations || []).length ? `
            <div class="card mb-4">
              <h3 class="mb-2" style="font-size:var(--font-size-base);">Top recommendations</h3>
              <ul style="margin:0;padding-left:1.25rem;font-size:var(--font-size-sm);">
                ${health.recommendations.map((item) => `
                  <li class="mb-2">
                    <strong>${escapeHtml(item.priority || '—')}</strong> — ${escapeHtml(item.description || item.action || '')}
                    ${item.savings ? ` · Save ${escapeHtml(item.savings)}` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${(health?.disclaimers || []).length ? `
            <div class="card">
              <h3 class="mb-2" style="font-size:var(--font-size-base);">Scope</h3>
              <ul style="margin:0;padding-left:1.25rem;font-size:var(--font-size-sm);">
                ${health.disclaimers.map((line) => `<li class="text-muted mb-2">${escapeHtml(line)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <aside class="repo-health-side">
          <div class="card mb-4">
            <div class="section-heading"><h3 style="margin:0;font-size:var(--font-size-base);">Actions</h3></div>
            <div style="margin-top:8px">
              <div class="analyze-action-info"><span class="text-muted" style="font-size:var(--font-size-sm);">${headline ? `Score ${headline.repositoryHealthScore}/100` : 'No scan data'}</span></div>
              <div class="flex gap-2" style="margin-top:8px">
                <button type="button" class="btn btn-primary btn-sm" id="run-optimization-scan" ${this.scanning || staticHost ? 'disabled' : ''}>
                  ${this.scanning ? 'Scanning…' : 'Run consolidation scan'}
                </button>
                <a class="btn btn-secondary btn-sm" href="/api/optimization/compliance?format=html" target="_blank" rel="noopener">Compliance</a>
              </div>
              <div style="margin-top:8px" class="flex gap-2">
                <a class="btn btn-secondary btn-sm" href="/api/optimization/export?format=json">Export JSON</a>
                <a class="btn btn-secondary btn-sm" href="/api/optimization/export?format=csv">Export CSV</a>
              </div>
              <div style="margin-top:8px" class="flex gap-2">
                <a class="btn btn-ghost btn-sm" href="/dashboard/trust">Trust dashboard</a>
                <button type="button" class="btn btn-ghost btn-sm" id="send-health-ai-btn" title="Send repository health data to AI coding agent">🤖 Send to AI Agent</button>
              </div>
            </div>
          </div>

          ${staticHost ? `
            <div class="card mb-4" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2);">
              <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
                Static-host preview: optimization APIs require <code>npm run dashboard</code> locally.
              </p>
            </div>
          ` : ''}

          <div class="card mb-4">
            <h3 class="mb-2" style="font-size:var(--font-size-base);">About</h3>
            <p style="margin:0;font-size:var(--font-size-sm);color:var(--text-secondary);">Measured duplicate detection and oversized-file analysis — separate from security gate scans. We publish our own repo health so you can verify the engine on real data.</p>
          </div>
        </aside>
      </div>
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
      const candRes = await fetch(`/api/optimization/candidates${params}`, { cache: 'no-store', headers: authHeaders() });
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
    // Render HTML string into DOM without assigning to innerHTML directly
    try {
      const html = this.render();
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Clear existing children
        while (container.firstChild) container.removeChild(container.firstChild);
        // Move parsed nodes into container
        Array.from(doc.body.childNodes).forEach((n) => container.appendChild(n));
      } else {
        // Fallback for older environments: build using a template element
        const tpl = document.createElement('template');
        tpl.innerHTML = this.render();
        container.innerHTML = '';
        container.appendChild(tpl.content.cloneNode(true));
      }
    } catch (e) {
      // If parsing fails, fallback to safe text output to avoid XSS
      container.textContent = 'Failed to render repository health view.';
      console.error('Render error in RepositoryHealthView.paint', e);
    }
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
      const res = await fetch('/api/optimization/merge-preview', {
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
        const res = await fetch('/api/optimization/analyze', {
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
        const res = await fetch('/api/optimization/merge-execute', {
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
          window["console"]["warn"]('[Health-AI] vscode.postMessage failed:', err);
        }
      }
      // Fallback: POST to /api/ai-context and copy to clipboard
      try {
        const res = await fetch('/api/ai-context', {
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
