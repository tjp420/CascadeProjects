import { escapeHtml, formatNumber, redactPathForDisplay, showToast } from '../utils.js';
import { authService } from '../services/authService.js';

function authHeaders(extra = {}) {
  return { ...authService.getAuthHeaders(), ...extra };
}

function isJsonResponse(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

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

async function fetchStaticRepositoryHealthFallback() {
  const trustHttpResponse = await fetch('/trust-verification.json', { cache: 'no-store' }).catch(() => null);
  if (!trustHttpResponse || !trustHttpResponse.ok) return null;
  const trustVerificationDocument = await trustHttpResponse.json().catch(() => null);
  return normalizeStaticRepositoryHealthPayload(trustVerificationDocument);
}

async function readJsonOrDefault(res, defaultValue = {}) {
  if (!isJsonResponse(res)) return defaultValue;
  const parsed = await res.json().catch(() => defaultValue);
  return parsed == null ? defaultValue : parsed;
}

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
      return '<p class="text-muted"><span class="loading-spinner"></span> Loading repository health…</p>';
    }
    if (this.error) {
      return `<p class="text-danger card">${escapeHtml(this.error)}</p>`;
    }

    const health = this.data;
    const headline = health?.headline;
    const staticHost = Boolean(health?.staticHost);

    return `
      <div class="section-block">
        <div class="section-heading">
          <h2>Repository health</h2>
          <div class="roadmap-result-actions">
            <button type="button" class="btn btn-primary btn-sm" id="run-optimization-scan" ${this.scanning || staticHost ? 'disabled' : ''}>
              ${this.scanning ? 'Scanning…' : 'Run consolidation scan'}
            </button>
            <a class="btn btn-secondary btn-sm" href="/api/optimization/compliance?format=html" target="_blank" rel="noopener">Compliance report</a>
            <a class="btn btn-secondary btn-sm" href="#/trust">Trust dashboard</a>
          </div>
        </div>

        ${staticHost ? `
          <div class="card mb-4">
            <p class="text-muted" style="margin:0;font-size:var(--font-size-sm);">
              Static-host preview mode: optimization APIs are not available on this upload. Run <code>npm run dashboard</code> locally (or deploy backend APIs) to enable repository health scans.
            </p>
          </div>
        ` : ''}

        <div class="card mb-4">
          <p style="margin:0;font-size:var(--font-size-sm);">
            Measured duplicate detection and oversized-file analysis — separate from security gate scans.
            We publish our own repo health so you can verify the engine on real data.
          </p>
        </div>

        ${headline ? `
          <div class="card mb-4">
            <div class="section-heading mb-2">
              <h3 style="margin:0;font-size:var(--font-size-base);">Headline metrics</h3>
              <span class="gate-badge ${headline.repositoryHealthScore >= 80 ? 'pass' : headline.repositoryHealthScore >= 60 ? 'warn' : 'fail'}">
                ${headline.repositoryHealthScore}/100
              </span>
            </div>
            <div class="metrics-row">
              <div class="metric-chip"><strong>${escapeHtml(headline.optimizationPotential || '—')}</strong> savings potential</div>
              <div class="metric-chip"><strong>${headline.duplicateGroups ?? '—'}</strong> exact duplicate groups</div>
              <div class="metric-chip"><strong>${headline.oversizedFiles ?? '—'}</strong> oversized files</div>
              <div class="metric-chip"><strong>${headline.reductionOpportunities ?? '—'}</strong> reduction opportunities</div>
              <div class="metric-chip"><strong>${formatNumber(headline.repositoryFilesTotal ?? '—')}</strong> repo files</div>
              <div class="metric-chip"><strong>${formatNumber(headline.repositoryFoldersTotal ?? '—')}</strong> folders</div>
            </div>
          </div>
        ` : ''}

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
              <p class="text-muted text-sm">To execute, POST <code>/api/optimization/merge-execute</code> with <code>confirmed:true</code> and phrase <code>${escapeHtml(this.preview.confirmationPhrase || '')}</code></p>
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
    `;
  }

  async fetchCandidatesList() {
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
