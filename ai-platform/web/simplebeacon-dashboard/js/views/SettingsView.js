import { escapeHtml, showToast, downloadJson, renderEmptyState } from '../utils.js';
import { resolvePageSpecsLabel, resolveJestTestsLabel } from '../services/analyzeService.js';
// EU AI Act transparency disclosure: This view includes AI system integration indicators per Article 50.
import { scanService } from '../services/scanService.js';
import { platformService } from '../services/platformService.js';
import { fetchUserAiKeys, saveUserAiKeys, clearUserAiKeys, normalizeAiKeysRecord, fetchOllamaModels } from '../services/aiKeysService.js?v=20260525aikeysguard1';
import { authService } from '../services/authService.js';
import { OLLAMA_DEFAULT_URL } from '../config.js';

const AI_KEY_FIELDS = [
  { id: 'openai', label: 'OpenAI API key', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic API key', placeholder: 'sk-ant-...' }
];

const RULE_ORDER = [
  'credentials',
  'json-schema',
  'sample-consistency',
  'roadmap',
  'production-leak',
  'jest-baseline',
  'javascript-ast-patterns',
  'python-ast-patterns'
];

const SEVERITIES = ['high', 'medium', 'low'];
const PROFILES = ['minimal', 'standard', 'cascade'];

/**
 * Settings view.
 */
export class SettingsView {
  constructor(app) {
    this.app = app;
    this.draft = null;
    this.savedSnapshot = null;
    this.busy = false;
    this.loading = false;
    this.error = null;
    this.presets = null;
    this._root = null;
    this.aiKeys = null;
    this.aiKeysFormDraft = { ollamaBaseUrl: '', ollamaModel: '' };
    this.aiKeysBusy = false;
    this.ollamaModels = [];
    this.ollamaModelsLoading = false;
    this.ollamaModelsError = null;
    this._ollamaModelsTimer = null;
    this.tokenVault = this.loadTokenVault();
  }

  loadTokenVault() {
    try {
      const raw = localStorage.getItem('sb-token-vault');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveTokenVault() {
    localStorage.setItem('sb-token-vault', JSON.stringify(this.tokenVault));
  }

  addToVault(token, user) {
    // Dedupe by token prefix/suffix
    const exists = this.tokenVault.some((v) => v.token === token);
    if (!exists) {
      this.tokenVault.push({ token, user, addedAt: new Date().toISOString(), usedAt: null });
      this.saveTokenVault();
    }
  }

  markTokenUsed(token) {
    const entry = this.tokenVault.find((v) => v.token === token);
    if (entry && !entry.usedAt) {
      entry.usedAt = new Date().toISOString();
      this.saveTokenVault();
    }
  }

  canReturnToken(index) {
    const entry = this.tokenVault[index];
    if (!entry) return false;
    const activeToken = authService.getToken();
    if (entry.token === activeToken) return false;
    if (entry.usedAt || entry.activatedAt) return false;
    return true;
  }

  returnVaultToken(index, rerender) {
    const entry = this.tokenVault[index];
    if (!entry) return;
    if (!this.canReturnToken(index)) {
      showToast('This token has already been used and cannot be returned', 'error');
      return;
    }
    const tHint = entry.token.length > 24 ? `${entry.token.slice(0, 8)}…${entry.token.slice(-8)}` : entry.token;
    if (!globalThis.confirm(`Return unused token ${tHint}?\n\nThis will remove it from your vault. Tokens that have been activated or used cannot be returned.`)) return;
    this.removeFromVault(index);
    showToast('Token returned and removed from vault', 'success');
    rerender();
  }

  removeFromVault(index) {
    this.tokenVault.splice(index, 1);
    this.saveTokenVault();
  }

  activateVaultToken(index) {
    const entry = this.tokenVault[index];
    if (!entry) return;
    entry.activatedAt = new Date().toISOString();
    entry.usedAt = new Date().toISOString();
    this.saveTokenVault();
    authService.setSession(entry.token, entry.user);
    showToast('Switched to stored token', 'success');
  }

  _formatRelativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  clearVault() {
    this.tokenVault = [];
    localStorage.removeItem('sb-token-vault');
  }

  computeVaultMetrics() {
    const total = this.tokenVault.length;
    const activeToken = authService.getToken();
    const activeIndex = this.tokenVault.findIndex((v) => v.token === activeToken);
    return { total, activeIndex };
  }

  matchOllamaModelOption(selected, models = []) {
    const want = String(selected || '').trim();
    if (!want) return '';
    if (models.includes(want)) return want;
    const prefixed = models.find((name) => name.startsWith(`${want}:`));
    if (prefixed) return prefixed;
    const byBase = models.find((name) => name.split(':')[0] === want);
    if (byBase) return byBase;
    return want;
  }

  renderOllamaModelSelect(keys) {
    const selected = this.matchOllamaModelOption(keys.ollamaModel, this.ollamaModels);
    const models = [...this.ollamaModels];
    if (selected && !models.includes(selected)) {
      models.unshift(selected);
    }

    let options = '';
    if (this.ollamaModelsLoading) {
      options = '<option value="">Loading models…</option>';
    } else if (!models.length) {
      options = `<option value="">${this.ollamaModelsError ? 'Ollama unreachable' : 'No models found'}</option>`;
    } else {
      options = `<option value="">— Select a model —</option>${models.map((name) => `
        <option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>
      `).join('')}`;
    }

    return `
      <div class="settings-ollama-model-row">
        <select
          class="settings-input settings-select"
          id="settings-ai-ollama-model"
          ${this.ollamaModelsLoading ? 'disabled' : ''}>
          ${options}
        </select>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="settings-ai-refresh-models"
          ${this.ollamaModelsLoading || this.aiKeysBusy ? 'disabled' : ''}>
          ${this.ollamaModelsLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      ${this.ollamaModelsError ? `<p class="text-muted settings-secret-hint">${escapeHtml(this.ollamaModelsError)}</p>` : ''}
      ${keys.ollamaModel && !this.ollamaModelsLoading ? `<p class="text-muted settings-secret-hint">Saved model: <code>${escapeHtml(keys.ollamaModel)}</code></p>` : ''}
    `;
  }

  refreshOllamaModelSelect() {
    const wrap = this._root?.querySelector('#settings-ai-ollama-model-wrap');
    if (!wrap) return;
    wrap.innerHTML = this.renderOllamaModelSelect(this.displayAiKeys());
    this.bindOllamaModelEvents(this._root);
  }

  bindOllamaModelEvents(root = this._root) {
    if (!root) return;
    root.querySelector('#settings-ai-ollama-model')?.addEventListener('change', (e) => {
      this.aiKeysFormDraft.ollamaModel = e.target.value;
    });
    root.querySelector('#settings-ai-refresh-models')?.addEventListener('click', () => {
      const baseUrl = root.querySelector('#settings-ai-ollama')?.value?.trim()
        || this.displayAiKeys().ollamaBaseUrl
        || OLLAMA_DEFAULT_URL;
      void this.loadOllamaModels(baseUrl);
    });
  }

  scheduleOllamaModelsReload(baseUrl) {
    clearTimeout(this._ollamaModelsTimer);
    this._ollamaModelsTimer = setTimeout(() => {
      void this.loadOllamaModels(baseUrl);
    }, 500);
  }

  async loadOllamaModels(baseUrl, options = {}) {
    const url = String(baseUrl || OLLAMA_DEFAULT_URL).trim() || OLLAMA_DEFAULT_URL;
    this.ollamaModelsLoading = true;
    this.ollamaModelsError = null;
    this.refreshOllamaModelSelect();

    try {
      const result = await fetchOllamaModels(url);
      this.ollamaModels = result.models;
      if (!result.models.length) {
        this.ollamaModelsError = result.message || 'No models returned — run `ollama pull <model>`';
      } else if (!result.ok) {
        this.ollamaModelsError = result.message;
      }

      const current = this.displayAiKeys().ollamaModel;
      if (!current && result.models.length) {
        const picked = String(result.models[0]).split(':')[0];
        this.syncAiKeysFormDraft({ ollamaBaseUrl: url, ollamaModel: picked });
      }
    } catch (err) {
      this.ollamaModels = [];
      this.ollamaModelsError = err.message;
    } finally {
      this.ollamaModelsLoading = false;
      this.refreshOllamaModelSelect();
      if (options.toastOnSuccess && this.ollamaModels.length) {
        showToast(`${this.ollamaModels.length} Ollama model(s) loaded`, 'success');
      }
    }
  }

  syncAiKeysFormDraft(source = {}) {
    this.aiKeysFormDraft = {
      ollamaBaseUrl: source.ollamaBaseUrl ?? this.aiKeysFormDraft?.ollamaBaseUrl ?? '',
      ollamaModel: source.ollamaModel ?? this.aiKeysFormDraft?.ollamaModel ?? ''
    };
  }

  captureAiKeysFormDraft(root = this._root) {
    if (!root) return;
    this.syncAiKeysFormDraft({
      ollamaBaseUrl: root.querySelector('#settings-ai-ollama')?.value?.trim() ?? '',
      ollamaModel: root.querySelector('#settings-ai-ollama-model')?.value?.trim() ?? ''
    });
  }

  displayAiKeys() {
    const saved = this.aiKeys || {};
    const draft = this.aiKeysFormDraft || {};
    return {
      ...saved,
      ollamaBaseUrl: draft.ollamaBaseUrl || saved.ollamaBaseUrl || '',
      ollamaModel: draft.ollamaModel || saved.ollamaModel || ''
    };
  }

  render() {
    const { baseline, report } = this.app.state;
    const config = this.draft || this.app.state.config || {};
    const dirty = this.isDirty();

    const el = document.createElement('div');
    el.className = 'fade-in';

    if (this.loading && !this.draft) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Settings</h1><p class="text-muted analyze-hero-sub">Loading configuration…</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
          title: 'Loading configuration…',
          body: '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>'
        })}
      `;
      return el;
    }

    if (this.error && !this.draft) {
      el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Settings</h1><p class="text-muted analyze-hero-sub">Configuration unavailable</p></div>
        ${renderEmptyState({
          icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
          title: 'Configuration unavailable',
          body: escapeHtml(this.error),
          actions: [{ label: 'Retry', id: 'settings-reload', className: 'btn-primary' }]
        })}
      `;
      el.querySelector('#settings-reload')?.addEventListener('click', () => {
        const container = el.parentElement;
        if (container) this.loadAndMount(container);
      });
      return el;
    }

    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Settings</h1>
        <p class="text-muted analyze-hero-sub">Scan paths, rule profiles, and AI provider keys.</p>
      </div>
      ${this.renderSettingsNav(dirty)}

      <p class="text-muted mb-4">Edits write to <code>.simplebeacon/config.json</code> on the server. Save before running a scan.</p>
      ${dirty ? '<p class="settings-dirty-hint">You have unsaved changes.</p>' : ''}

      <div class="card settings-grid mb-6" id="settings-section-scan">
        <h2 class="card-title">Scan Configuration</h2>
        <div class="settings-field">
          <span class="settings-label">Config path</span>
          <span class="settings-value">.simplebeacon/config.json</span>
        </div>
        <div class="settings-field">
          <label class="settings-label" for="settings-profile-select">Profile</label>
          <select class="settings-input" id="settings-profile-select" style="max-width:200px;">
            ${PROFILES.map((p) => `<option value="${escapeHtml(p)}" ${config.profile === p ? 'selected' : ''}>${escapeHtml(p.charAt(0).toUpperCase() + p.slice(1))}</option>`).join('')}
          </select>
          <span class="text-muted" style="font-size:var(--font-size-xs);margin-left:var(--space-2);">Choose a preset rule profile</span>
        </div>
        <div class="settings-field settings-field-stack">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
            <label class="settings-label" for="settings-scan-paths">Scan paths</label>
            <span class="text-muted" style="font-size:var(--font-size-xs);">Auto-detected from project structure</span>
          </div>
          <textarea class="settings-textarea" id="settings-scan-paths" rows="4" placeholder="One path per line">${escapeHtml(pathsToText(config.scanPaths))}</textarea>
        </div>
        <div class="settings-field settings-field-stack">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
            <label class="settings-label" for="settings-production-paths">Production paths</label>
            <span class="text-muted" style="font-size:var(--font-size-xs);">Auto-detected from project structure</span>
          </div>
          <textarea class="settings-textarea" id="settings-production-paths" rows="3" placeholder="One path per line">${escapeHtml(pathsToText(config.productionPaths))}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:var(--space-2);gap:var(--space-2);">
            <button type="button" class="btn btn-ghost btn-sm" id="settings-discover-paths" ${this.busy ? 'disabled' : ''}>
              ${this.busy === 'discover-paths' ? 'Discovering…' : 'Auto-discover paths'}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="settings-sync-paths" ${this.busy ? 'disabled' : ''}>
              ${this.busy === 'sync-paths' ? 'Syncing…' : 'Sync from current project'}
            </button>
          </div>
        </div>
        <div class="settings-field">
          <label class="settings-label" for="settings-sample-dir">Sample directory</label>
          <input class="settings-input" id="settings-sample-dir" type="text" value="${escapeHtml(config.sampleDir || '')}" />
        </div>
        <div class="settings-field">
          <label class="settings-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="settings-full-directory-scan" ${config.fullDirectoryScan ? 'checked' : ''} />
            Full directory scan
          </label>
          <span class="text-muted" style="font-size:var(--font-size-xs);margin-left:var(--space-5);">
            When enabled, all text files are content-scanned by rule engines. When disabled, only files in Scan paths are scanned.
          </span>
        </div>
      </div>

      ${this.renderDownloadSettingsSection()}
      ${this.renderAiKeysSection()}
      ${this.renderTokenSection()}

      <div class="card settings-grid mb-6" id="settings-section-rules">
        <h2 class="card-title">Rules</h2>
        ${RULE_ORDER.map((name) => renderRuleRow(name, config.rules?.[name])).join('')}
      </div>

      <div class="card settings-grid mb-6" id="settings-section-gate">
        <h2 class="card-title">Gate Policy</h2>
        <div class="settings-field settings-field-stack">
          <span class="settings-label">Fail on</span>
          <div class="settings-checkbox-group">
            ${SEVERITIES.map((sev) => checkbox('fail', sev, config.gate?.failOn)).join('')}
          </div>
        </div>
        <div class="settings-field settings-field-stack">
          <span class="settings-label">Warn on</span>
          <div class="settings-checkbox-group">
            ${SEVERITIES.map((sev) => checkbox('warn', sev, config.gate?.warnOn)).join('')}
          </div>
        </div>
      </div>

      <div class="card settings-grid mb-6" id="settings-section-advanced">
        <h2 class="card-title">Advanced (read-only)</h2>
        <div class="settings-row">
          <span class="settings-label">Ignore patterns</span>
          <span class="settings-value">${(config.ignore || []).length} pattern(s)</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Consistency anchors</span>
          <span class="settings-value">${(config.consistencyAnchorSamples || []).length} sample file(s)</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Production-leak allowlist</span>
          <span class="settings-value">${(config.rules?.['production-leak']?.allowlistFiles || []).length} file(s)</span>
        </div>
        <p class="text-muted" style="font-size:var(--font-size-sm);margin:0">Edit these in <code>.simplebeacon/config.json</code> directly or via Export → edit → manual merge.</p>
      </div>

      <div class="card settings-grid mb-6" id="settings-section-baseline">
        <h2 class="card-title">Baseline</h2>
        <div class="settings-row">
          <span class="settings-label">Jest tests</span>
          <span class="settings-value" id="baseline-jest-label">${escapeHtml(resolveJestTestsLabel(baseline, this.app.state.dashboardHome) || '—')}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Page specs (live scan)</span>
          <span class="settings-value" id="baseline-pages-label">${escapeHtml(resolvePageSpecsLabel(report, baseline) || '—')}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Baseline page label</span>
          <span class="settings-value">${escapeHtml(baseline?.pageSamplesLabel || '—')}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Last synced</span>
          <span class="settings-value" id="baseline-synced-at">${baseline?.syncedAt ? new Date(baseline.syncedAt).toLocaleString() : '—'}</span>
        </div>
        <div class="settings-field-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="settings-baseline-sync" ${this.busy ? 'disabled' : ''}>
            ${this.busy === 'baseline' ? 'Syncing…' : 'Sync baseline (Jest)'}
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="settings-run-scan" ${this.busy ? 'disabled' : ''}>
            ${this.busy === 'scan' ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
      </div>

      <div class="card settings-grid" id="settings-section-shortcuts">
        <h2 class="card-title">Keyboard Shortcuts</h2>
        <div class="settings-row">
          <span class="settings-label">Focus search</span>
          <span><kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">K</kbd></span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Run scan</span>
          <span><kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">R</kbd></span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Export report</span>
          <span><kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">E</kbd></span>
        </div>
      </div>
    `;

    return el;
  }

  renderSettingsNav(dirty) {
    const sections = [
      { id: 'settings-section-scan', label: 'Scan' },
      { id: 'settings-download-card', label: 'Downloads' },
      { id: 'settings-ai-keys-card', label: 'AI Keys' },
      { id: 'settings-token-card', label: 'Token' },
      { id: 'settings-section-rules', label: 'Rules' },
      { id: 'settings-section-gate', label: 'Gate' },
      { id: 'settings-section-advanced', label: 'Advanced' },
      { id: 'settings-section-baseline', label: 'Baseline' },
      { id: 'settings-section-shortcuts', label: 'Shortcuts' }
    ];
    return `
      <nav class="settings-nav" style="
        position:sticky;
        top:0;
        z-index:10;
        background:var(--surface-elevated);
        border:1px solid var(--border);
        border-radius:var(--radius-md);
        padding:var(--space-2) var(--space-3);
        margin-bottom:var(--space-4);
        display:flex;
        align-items:center;
        gap:var(--space-1);
        flex-wrap:wrap;">
        <span style="font-weight:600;font-size:0.875rem;margin-right:var(--space-2);color:var(--text-secondary);">Jump to:</span>
        ${sections.map((s) => `
          <a href="#${s.id}" class="settings-nav-link" data-scroll-to="${s.id}" style="
            padding:4px 10px;
            border-radius:999px;
            font-size:0.8rem;
            text-decoration:none;
            color:var(--text-secondary);
            background:var(--surface);
            border:1px solid var(--border);
            transition:all 150ms;
            white-space:nowrap;
            cursor:pointer;">
            ${escapeHtml(s.label)}
          </a>
        `).join('')}
        <div style="margin-left:auto;display:flex;gap:var(--space-2);align-items:center;">
          <button type="button" class="btn btn-secondary btn-sm" id="settings-reset" ${!dirty || this.busy ? 'disabled' : ''}>Reset</button>
          <button type="button" class="btn btn-secondary btn-sm" id="settings-export">Export</button>
          <button type="button" class="btn btn-primary btn-sm" id="settings-save" ${!dirty || this.busy ? 'disabled' : ''}>
            ${this.busy === 'save' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </nav>
    `;
  }

  renderTokenSection() {
    const token = authService.getToken();
    const user = authService.getUser();

    let payload = null;
    if (token) {
      try {
        const [, payloadB64] = token.split('.');
        if (payloadB64) {
          payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        }
      } catch {
        payload = null;
      }
    }

    const hint = token && token.length > 24 ? `${token.slice(0, 8)}…${token.slice(-8)}` : (token || '—');
    const expiresAt = payload?.exp
      ? new Date(payload.exp * 1000).toLocaleString()
      : '—';
    const email = user?.email || payload?.sub || '—';
    const plan = user?.plan || payload?.plan || payload?.tier || '—';
    const { total, activeIndex } = this.computeVaultMetrics();

    const vaultRows = this.tokenVault.map((entry, idx) => {
      const isActive = idx === activeIndex;
      const tHint = entry.token.length > 24 ? `${entry.token.slice(0, 8)}…${entry.token.slice(-8)}` : entry.token;
      const u = entry.user?.email || entry.user?.sub || '—';
      const activeLabel = isActive
        ? `<span class="badge badge-success" style="margin-left:var(--space-2);">active</span>`
        : '';
      const timeLabel = entry.activatedAt
        ? `<span style="color:var(--text-muted);font-size:0.7rem;margin-left:var(--space-2);">• ${this._formatRelativeTime(entry.activatedAt)}</span>`
        : '';
      const canReturn = this.canReturnToken(idx);
      const returnBtn = canReturn
        ? `<button type="button" class="btn btn-ghost btn-sm" data-vault-return="${idx}" style="white-space:nowrap;color:var(--success);">Return</button>`
        : `<span class="text-muted" style="font-size:0.7rem;white-space:nowrap;padding:var(--space-1) var(--space-2);">Used • no return</span>`;
      return `
        <div class="settings-row" style="align-items:center;gap:var(--space-2);">
          <span class="settings-value" style="flex:1;min-width:0;">
            <code>${escapeHtml(tHint)}</code>
            <span style="color:var(--text-muted);font-size:0.75rem;margin-left:var(--space-2);">${escapeHtml(u)}</span>
            ${activeLabel}${timeLabel}
          </span>
          ${returnBtn}
          <button type="button" class="btn btn-secondary btn-sm" data-vault-activate="${idx}" ${isActive ? 'disabled' : ''} style="white-space:nowrap;">Use</button>
          <button type="button" class="btn btn-ghost btn-sm" data-vault-remove="${idx}" style="white-space:nowrap;color:var(--danger);">Remove</button>
        </div>
      `;
    }).join('');

    return `
      <div class="card settings-grid mb-6" id="settings-token-card">
        <h2 class="card-title">Token</h2>
        <div class="settings-row">
          <span class="settings-label">Current token</span>
          <span class="settings-value"><code>${escapeHtml(hint)}</code></span>
        </div>
        <div class="settings-row">
          <span class="settings-label">User</span>
          <span class="settings-value">${escapeHtml(email)}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Plan</span>
          <span class="settings-value">${escapeHtml(plan)}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Expires</span>
          <span class="settings-value">${escapeHtml(expiresAt)}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Token vault</span>
          <span class="settings-value">${total} stored</span>
        </div>
        <div class="settings-field settings-field-stack" style="margin-top:var(--space-3)">
          <label class="settings-label" for="settings-token-input">Paste new token</label>
          <input
            class="settings-input"
            id="settings-token-input"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="enter token">
        </div>
        <div class="settings-field-actions">
          <button type="button" class="btn btn-primary btn-sm" id="settings-token-update">Add / update token</button>
          <button type="button" class="btn btn-sm" id="settings-token-get">Get token</button>
          <button type="button" class="btn btn-secondary btn-sm" id="settings-token-clear">Clear active token</button>
          <button type="button" class="btn btn-info btn-sm" id="settings-token-register-email">Register with email</button>
          ${total > 0 ? `<button type="button" class="btn btn-ghost btn-sm" id="settings-token-clear-vault" style="color:var(--danger);">Clear vault (${total})</button>` : ''}
        </div>
        ${total > 0 ? `
          <div style="margin-top:var(--space-4);border-top:1px solid var(--border);padding-top:var(--space-3);">
            <p class="text-muted" style="font-size:0.75rem;margin:0 0 var(--space-2);">Stored tokens — click Use to switch active token</p>
            ${vaultRows}
          </div>
        ` : ''}
      </div>
    `;
  }

  updateToken(root, rerender) {
    const input = (root || this._root)?.querySelector('#settings-token-input');
    const newToken = input?.value?.trim() || '';
    if (!newToken) {
      showToast('Paste a token first', 'error');
      return;
    }
    const parts = newToken.split('.');
    if (parts.length !== 3) {
      showToast('Invalid token format — expected JWT with 3 parts', 'error');
      return;
    }
    let payload;
    try {
      payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      showToast('Invalid token — could not decode JWT payload', 'error');
      return;
    }
    const user = {
      email: payload.sub || 'token-user',
      plan: payload.plan || payload.tier || 'free',
      tokenSession: true
    };
    // Save current token to vault before replacing (if different)
    const currentToken = authService.getToken();
    if (currentToken && currentToken !== newToken) {
      const currentUser = authService.getUser() || { email: payload.sub || 'token-user', plan: payload.plan || payload.tier || 'free' };
      this.addToVault(currentToken, currentUser);
    }
    authService.setSession(newToken, user);
    this.addToVault(newToken, user);
    showToast('Token updated and saved to vault', 'success');
    if (input) input.value = '';
    rerender();
  }

  clearToken(rerender) {
    if (!globalThis.confirm('Remove saved active token?')) return;
    authService.clearSession();
    showToast('Active token cleared', 'info');
    rerender();
  }

  registerTokenWithEmail(rerender) {
    const token = authService.getToken();
    if (!token) {
      showToast('No active token to register. Add a token first.', 'error');
      return;
    }
    const email = window.prompt('Enter email address to associate with this token (for recovery):', '');
    if (!email || !email.trim()) {
      showToast('Registration cancelled', 'info');
      return;
    }
    const trimmed = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      showToast('Invalid email address format', 'error');
      return;
    }
    const user = authService.getUser() || {};
    user.email = trimmed;
    authService.setSession(token, user);
    this.updateVaultEmail(token, trimmed);
    showToast(`Token registered to ${trimmed}`, 'success');
    rerender();
  }

  updateVaultEmail(token, email) {
    const entry = this.tokenVault.find((e) => e.token === token);
    if (entry) {
      entry.user = entry.user || {};
      entry.user.email = email;
      this.saveVault();
    }
  }

  confirmAndClearVault(rerender) {
    if (!globalThis.confirm('Remove all stored tokens from vault?')) return;
    this.clearVault();
    showToast('Token vault cleared', 'info');
    rerender();
  }

  loadDownloadSettings() {
    try {
      const raw = localStorage.getItem('sb-download-settings');
      const parsed = raw ? JSON.parse(raw) : {};
      const today = new Date().toISOString().split('T')[0];
      return {
        autoGeneratePdf: parsed.autoGeneratePdf === true,
        promptForCredentials: parsed.promptForCredentials !== false,
        credentials: {
          projectName: parsed.credentials?.projectName || '',
          signatoryName: parsed.credentials?.signatoryName || '',
          signatoryTitle: parsed.credentials?.signatoryTitle || '',
          contactEmail: parsed.credentials?.contactEmail || ''
        },
        agency: {
          projectName: parsed.agency?.projectName || 'CascadeProjects',
          devAgency: parsed.agency?.devAgency || 'Agency',
          client: parsed.agency?.client || '',
          milestone: parsed.agency?.milestone || 'Release',
          date: parsed.agency?.date || today,
          scanId: parsed.agency?.scanId || '',
          score: parsed.agency?.score ?? 100,
          status: parsed.agency?.status || 'PASS'
        },
        executive: {
          projectName: parsed.executive?.projectName || 'CascadeProjects',
          assessor: parsed.executive?.assessor || 'SimpleBeacon Operator',
          date: parsed.executive?.date || today,
          reportId: parsed.executive?.reportId || '',
          summary: parsed.executive?.summary || '',
          verdict: parsed.executive?.verdict || 'READY'
        }
      };
    } catch {
      return { promptForCredentials: true, credentials: {}, agency: {}, executive: {} };
    }
  }

  saveDownloadSettings(settings) {
    localStorage.setItem('sb-download-settings', JSON.stringify(settings));
  }

  renderDownloadSettingsSection() {
    const settings = this.loadDownloadSettings();
    const creds = settings.credentials || {};
    const agency = settings.agency || {};
    const executive = settings.executive || {};
    return `
      <div class="card settings-grid mb-6" id="settings-download-card">
        <h2 class="card-title">Report Credentials</h2>
        <p class="text-muted" style="font-size:var(--font-size-sm);margin:0 0 var(--space-3)">
          Configure credentials injected into ZIP, PDF, and certificate reports.
        </p>
        <div class="settings-field">
          <label class="settings-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="settings-download-auto-pdf" ${settings.autoGeneratePdf ? 'checked' : ''} />
            Auto-generate audit PDF after every complete scan
          </label>
          <span class="text-muted" style="font-size:var(--font-size-xs);margin-left:var(--space-5);">
            When enabled, a well-written PDF report of all findings is automatically generated and opened after each complete scan finishes.
          </span>
        </div>
        <div class="settings-field">
          <label class="settings-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
            <input type="checkbox" id="settings-download-prompt-credentials" ${settings.promptForCredentials ? 'checked' : ''} />
            Prompt for credentials before each download
          </label>
          <span class="text-muted" style="font-size:var(--font-size-xs);margin-left:var(--space-5);">
            When enabled, a modal asks for project name, signatory, and email before building ZIP or PDF reports.
          </span>
        </div>

        <div class="settings-tabs" id="cred-tabs">
          <button type="button" class="settings-tab active" data-cred-tab="basic">Basic</button>
          <button type="button" class="settings-tab" data-cred-tab="agency">Agency Certificate</button>
          <button type="button" class="settings-tab" data-cred-tab="executive">Executive Audit</button>
        </div>

        <div class="cred-panel active" data-cred-panel="basic">
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-download-default-project">Project / Company Name</label>
            <input class="settings-input" id="settings-download-default-project" type="text" value="${escapeHtml(creds.projectName || '')}" placeholder="Acme Corp" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-download-default-signatory">Signatory Name</label>
            <input class="settings-input" id="settings-download-default-signatory" type="text" value="${escapeHtml(creds.signatoryName || '')}" placeholder="Jane Smith" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-download-default-title">Signatory Title</label>
            <input class="settings-input" id="settings-download-default-title" type="text" value="${escapeHtml(creds.signatoryTitle || '')}" placeholder="Chief Technology Officer" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-download-default-email">Contact Email</label>
            <input class="settings-input" id="settings-download-default-email" type="text" inputmode="email" value="${escapeHtml(creds.contactEmail || '')}" placeholder="Contact email address" />
          </div>
        </div>

        <div class="cred-panel" data-cred-panel="agency">
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-project">Project Name</label>
            <input class="settings-input" id="settings-agency-project" type="text" value="${escapeHtml(agency.projectName || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-dev">Development Agency</label>
            <input class="settings-input" id="settings-agency-dev" type="text" value="${escapeHtml(agency.devAgency || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-client">Target Client</label>
            <input class="settings-input" id="settings-agency-client" type="text" value="${escapeHtml(agency.client || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-milestone">Scan Milestone</label>
            <select class="settings-input" id="settings-agency-milestone">
              <option value="Alpha" ${agency.milestone === 'Alpha' ? 'selected' : ''}>Alpha</option>
              <option value="Beta" ${agency.milestone === 'Beta' ? 'selected' : ''}>Beta</option>
              <option value="Release" ${agency.milestone === 'Release' ? 'selected' : ''}>Release</option>
              <option value="Patch" ${agency.milestone === 'Patch' ? 'selected' : ''}>Patch</option>
            </select>
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-date">Date Generated</label>
            <input class="settings-input" id="settings-agency-date" type="date" value="${escapeHtml(agency.date || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-scan-id">Scan Integrity ID</label>
            <input class="settings-input" id="settings-agency-scan-id" type="text" value="${escapeHtml(agency.scanId || '')}" placeholder="sb_auth_..." />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-score">Quality Score</label>
            <input class="settings-input" id="settings-agency-score" type="number" min="0" max="100" value="${Number(agency.score ?? 100)}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-agency-status">Status</label>
            <select class="settings-input" id="settings-agency-status">
              <option value="PASS" ${agency.status === 'PASS' ? 'selected' : ''}>PASSED SECURE HYGIENE GATE</option>
              <option value="REVIEW" ${agency.status === 'REVIEW' ? 'selected' : ''}>REVIEW RECOMMENDED</option>
              <option value="FAIL" ${agency.status === 'FAIL' ? 'selected' : ''}>FAILED HYGIENE GATE</option>
            </select>
          </div>
        </div>

        <div class="cred-panel" data-cred-panel="executive">
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-project">Project Name</label>
            <input class="settings-input" id="settings-exec-project" type="text" value="${escapeHtml(executive.projectName || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-assessor">Assessor Name</label>
            <input class="settings-input" id="settings-exec-assessor" type="text" value="${escapeHtml(executive.assessor || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-date">Report Date</label>
            <input class="settings-input" id="settings-exec-date" type="date" value="${escapeHtml(executive.date || '')}" />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-report-id">Report ID</label>
            <input class="settings-input" id="settings-exec-report-id" type="text" value="${escapeHtml(executive.reportId || '')}" placeholder="SB-AUD-..." />
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-summary">Executive Summary</label>
            <textarea class="settings-textarea" id="settings-exec-summary" rows="3">${escapeHtml(executive.summary || '')}</textarea>
          </div>
          <div class="settings-field settings-field-stack">
            <label class="settings-label" for="settings-exec-verdict">Overall Verdict</label>
            <select class="settings-input" id="settings-exec-verdict">
              <option value="READY" ${executive.verdict === 'READY' ? 'selected' : ''}>READY FOR RELEASE</option>
              <option value="CONDITIONAL" ${executive.verdict === 'CONDITIONAL' ? 'selected' : ''}>CONDITIONAL — MINOR REVIEW</option>
              <option value="BLOCKED" ${executive.verdict === 'BLOCKED' ? 'selected' : ''}>BLOCKED — CRITICAL ISSUES</option>
            </select>
          </div>
        </div>

        <div class="settings-field-actions">
          <button type="button" class="btn btn-primary btn-sm" id="settings-download-save">Save download settings</button>
        </div>
      </div>
    `;
  }

  renderAiKeysSection() {
    const keys = this.displayAiKeys();
    const providers = keys.providers || {};

    return `
      <div class="card settings-grid mb-6" id="settings-ai-keys-card">
        <h2 class="card-title">AI providers (optional)</h2>
        <p class="text-muted" style="font-size:var(--font-size-sm);margin:0 0 var(--space-3)">
          Bring your own keys for optional narrative summaries on the Analyze page.
          Gate scans stay deterministic — AI never changes findings.
          Keys are encrypted on the server and tied to your account.
        </p>
        ${AI_KEY_FIELDS.map((field) => {
          const status = providers[field.id] || {};
          return `
            <div class="settings-field settings-field-stack">
              <label class="settings-label" for="settings-ai-${field.id}">${escapeHtml(field.label)}</label>
              <input
                class="settings-input"
                id="settings-ai-${field.id}"
                type="password"
                autocomplete="off"
                spellcheck="false"
                placeholder="${status.configured ? `Saved (${escapeHtml(status.hint || '••••')}) — paste to replace` : escapeHtml(field.placeholder)}"
                data-ai-key="${field.id}">
              ${status.configured ? `<p class="text-muted settings-secret-hint">Configured: ${escapeHtml(status.hint || '••••')}</p>` : ''}
            </div>
          `;
        }).join('')}
        <div class="settings-field settings-field-stack">
          <label class="settings-label" for="settings-ai-ollama">Ollama base URL</label>
          <input
            class="settings-input"
            id="settings-ai-ollama"
            type="url"
            spellcheck="false"
            placeholder="http://127.0.0.1:11434" <!-- simplebeacon-ignore hardcoded-url -->
            value="${escapeHtml(keys.ollamaBaseUrl || '')}">
        </div>
        <div class="settings-field settings-field-stack">
          <label class="settings-label" for="settings-ai-ollama-model">Ollama model</label>
          <div id="settings-ai-ollama-model-wrap">
            ${this.renderOllamaModelSelect(keys)}
          </div>
          <p class="text-muted settings-secret-hint">
            Pulled live from Ollama at the base URL above (<code>ollama list</code>).
            For code-analysis narratives, prefer code-tuned models (for example <code>qwen2.5-coder</code> or <code>deepseek-coder</code>) when available.
            Analyze remains deterministic; AI output is best-effort narrative only.
          </p>
        </div>
        <div class="settings-field-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="settings-ai-test-ollama" ${this.aiKeysBusy ? 'disabled' : ''}>
            ${this.aiKeysBusy === 'test-ollama' ? 'Testing…' : 'Test Ollama'}
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="settings-ai-save" ${this.aiKeysBusy ? 'disabled' : ''}>
            ${this.aiKeysBusy === 'save' ? 'Saving…' : 'Save AI keys'}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="settings-ai-clear" ${this.aiKeysBusy ? 'disabled' : ''}>
            Clear all keys
          </button>
        </div>
        ${keys.updatedAt ? `<p class="text-muted settings-secret-hint">Last updated ${new Date(keys.updatedAt).toLocaleString()}</p>` : ''}
      </div>
    `;
  }

  async loadAiKeys() {
    const generation = (this._aiKeysLoadGen || 0) + 1;
    this._aiKeysLoadGen = generation;
    try {
      const keys = await fetchUserAiKeys();
      if (generation !== this._aiKeysLoadGen) return keys;
      this.aiKeys = normalizeAiKeysRecord(keys);
      this.syncAiKeysFormDraft(this.aiKeys);
      return this.aiKeys;
    } catch (err) {
      if (generation !== this._aiKeysLoadGen) return null;
      this.aiKeys = normalizeAiKeysRecord(null);
      this.syncAiKeysFormDraft(this.aiKeys);
      const isAuthError = err.code === 'auth_required' || /Authentication required|Unauthorized/i.test(err.message);
      if (!isAuthError) {
        console.warn('AI keys unavailable:', err.message);
      }
      return null;
    }
  }

  updateAiKeysBusyUi() {
    const root = this._root;
    if (!root) return;
    root.querySelector('#settings-ai-save')?.toggleAttribute('disabled', Boolean(this.aiKeysBusy));
    root.querySelector('#settings-ai-clear')?.toggleAttribute('disabled', Boolean(this.aiKeysBusy));
    root.querySelector('#settings-ai-test-ollama')?.toggleAttribute('disabled', Boolean(this.aiKeysBusy));
    const saveBtn = root.querySelector('#settings-ai-save');
    if (saveBtn) {
      saveBtn.textContent = this.aiKeysBusy === 'save' ? 'Saving…' : 'Save AI keys';
    }
    const testBtn = root.querySelector('#settings-ai-test-ollama');
    if (testBtn) {
      testBtn.textContent = this.aiKeysBusy === 'test-ollama' ? 'Testing…' : 'Test Ollama';
    }
  }

  collectAiKeysPayload(root = this._root) {
    this.captureAiKeysFormDraft(root);
    const draft = this.aiKeysFormDraft || {};
    const payload = {
      ollamaBaseUrl: draft.ollamaBaseUrl || '',
      ollamaModel: draft.ollamaModel || ''
    };
    if (root) {
      for (const field of AI_KEY_FIELDS) {
        const input = root.querySelector(`#settings-ai-${field.id}`);
        const value = input?.value?.trim() || '';
        if (value) payload[field.id] = value;
      }
    }
    return payload;
  }

  async testOllamaConnection(root, rerender) {
    const payloadRoot = root || this._root;
    const baseUrl = payloadRoot?.querySelector('#settings-ai-ollama')?.value?.trim() || 'http://127.0.0.1:11434';
    const model = payloadRoot?.querySelector('#settings-ai-ollama-model')?.value?.trim() || '';
    this.aiKeysBusy = 'test-ollama';
    this.updateAiKeysBusyUi();
    try {
      await this.loadOllamaModels(baseUrl);
      if (!this.ollamaModels.length) {
        showToast(this.ollamaModelsError || 'Ollama connection failed', 'error');
        return;
      }
      const picked = model || this.displayAiKeys().ollamaModel || String(this.ollamaModels[0]).split(':')[0];
      this.syncAiKeysFormDraft({ ollamaBaseUrl: baseUrl, ollamaModel: picked });
      showToast(`Ollama connected — ${this.ollamaModels.length} model(s) available`, 'success');
      rerender();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.aiKeysBusy = false;
      this.updateAiKeysBusyUi();
    }
  }

  async saveAiKeys(root, rerender) {
    const payload = this.collectAiKeysPayload(root || this._root);
    this.aiKeysBusy = 'save';
    this.updateAiKeysBusyUi();
    try {
      const saved = normalizeAiKeysRecord(await saveUserAiKeys(payload));
      this.aiKeys = {
        ...saved,
        ollamaBaseUrl: saved.ollamaBaseUrl || payload.ollamaBaseUrl,
        ollamaModel: saved.ollamaModel || payload.ollamaModel
      };
      this.syncAiKeysFormDraft(this.aiKeys);
      const payloadRoot = root || this._root;
      for (const field of AI_KEY_FIELDS) {
        const input = payloadRoot?.querySelector(`#settings-ai-${field.id}`);
        if (input) input.value = '';
      }
      showToast('AI provider keys saved', 'success');
      rerender();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.aiKeysBusy = false;
    }
  }

  async clearAllAiKeys(rerender) {
    if (!globalThis.confirm('Remove all saved AI provider keys for your account?')) return;
    this.aiKeysBusy = 'clear';
    this.updateAiKeysBusyUi();
    try {
      this.aiKeys = await clearUserAiKeys();
      this.syncAiKeysFormDraft(this.aiKeys);
      showToast('AI provider keys cleared', 'info');
      rerender();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.aiKeysBusy = false;
    }
  }

  async loadAndMount(container) {
    this.loading = true;
    this.error = null;
    container.innerHTML = '';
    container.appendChild(this.render());

    try {
      const projectPath = this.app.state.lastProjectPath || null;
      const [config, presets] = await Promise.all([
        scanService.fetchConfig(projectPath),
        this.presets ? Promise.resolve(this.presets) : scanService.fetchConfigPresets(),
        this.loadAiKeys()
      ]);
      this.app.state.config = config;
      this.presets = presets;
      this.draft = cloneConfig(config);
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
    } catch (err) {
      this.error = err.message;
      this.draft = this.draft || cloneConfig(this.app.state.config || {});
    } finally {
      this.loading = false;
      this.mount(container);
    }
  }

  mount(container) {
    if (!this.draft && !this.loading && !this.error) {
      this.loadAndMount(container);
      return;
    }

    const incoming = this.app.state.config;
    if (incoming && (!this.draft || !this.isDirty())) {
      this.draft = cloneConfig(incoming);
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
    } else if (!this.draft) {
      this.draft = cloneConfig(incoming || {});
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
    }

    container.innerHTML = '';
    const root = this.render();
    container.appendChild(root);
    this._root = root;
    this.bindEvents(root);
    if (!this.aiKeys) {
      void this.loadAiKeys().then(() => {
        if (container.contains(root)) this.mount(container);
      });
    }
    if (!this.isDirty()) {
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, this._root));
    }
  }

  resetDraft() {
    this.draft = cloneConfig(this.app.state.config);
    this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
  }

  isDirty() {
    if (!this.draft || !this.savedSnapshot || !this._root) return false;
    return JSON.stringify(this.buildConfigFromDom(this.draft, this._root)) !== this.savedSnapshot;
  }

  bindEvents(root) {
    const container = root.parentElement;
/**
 * Rerender.
 * @returns {any}
 */
    const rerender = () => {
      this.captureAiKeysFormDraft(this._root);
      if (container) this.mount(container);
    };

    root.querySelector('#settings-ai-ollama')?.addEventListener('input', (e) => {
      this.aiKeysFormDraft.ollamaBaseUrl = e.target.value;
      this.scheduleOllamaModelsReload(e.target.value);
    });
    this.bindOllamaModelEvents(root);

    root.querySelectorAll('.settings-nav-link[data-scroll-to]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.dataset.scrollTo;
        const target = root.querySelector(`#${targetId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

/**
 * On field change.
 * @returns {any}
 */
    const onFieldChange = () => {
      this.draft = this.buildConfigFromDom(this.draft, root);
      rerender();
    };

    root.querySelector('#settings-profile-select')?.addEventListener('change', (e) => {
      this.applyProfilePreset(e.target.value, rerender);
    });
    root.querySelector('#settings-sample-dir')?.addEventListener('input', onFieldChange);
    root.querySelector('#settings-scan-paths')?.addEventListener('input', onFieldChange);
    root.querySelector('#settings-production-paths')?.addEventListener('input', onFieldChange);
    root.querySelector('#settings-full-directory-scan')?.addEventListener('change', onFieldChange);

    root.querySelectorAll('[data-rule-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.ruleToggle;
        const enabled = btn.dataset.enabled !== 'true';
        this.draft.rules = this.draft.rules || {};
        this.draft.rules[name] = { ...(this.draft.rules[name] || {}), enabled };
        rerender();
      });
    });

    root.querySelectorAll('[data-gate-group]').forEach((input) => {
      input.addEventListener('change', onFieldChange);
    });

    root.querySelector('#settings-reset')?.addEventListener('click', () => {
      this.resetDraft();
      rerender();
      showToast('Changes discarded', 'info');
    });

    root.querySelector('#settings-export')?.addEventListener('click', () => {
      const config = this.buildConfigFromDom(this.draft, root);
      downloadJson(config, 'simplebeacon-config.json');
      showToast('Config exported', 'success');
    });

    root.querySelector('#settings-save')?.addEventListener('click', () => this.save(rerender));
    root.querySelector('#settings-discover-paths')?.addEventListener('click', () => this.discoverPathsFromProject(rerender));
    root.querySelector('#settings-sync-paths')?.addEventListener('click', () => this.syncPathsFromProject(rerender));
    root.querySelector('#settings-baseline-sync')?.addEventListener('click', () => this.syncBaseline(rerender));
    root.querySelector('#settings-run-scan')?.addEventListener('click', () => this.runScan(rerender));
    root.querySelector('#settings-ai-save')?.addEventListener('click', () => this.saveAiKeys(root, rerender));
    root.querySelector('#settings-ai-clear')?.addEventListener('click', () => this.clearAllAiKeys(rerender));
    root.querySelector('#settings-ai-test-ollama')?.addEventListener('click', () => this.testOllamaConnection(root, rerender));

    root.querySelector('#settings-download-save')?.addEventListener('click', () => {
      const autoPdfCheckbox = root.querySelector('#settings-download-auto-pdf');
      const promptCheckbox = root.querySelector('#settings-download-prompt-credentials');
      const projectInput = root.querySelector('#settings-download-default-project');
      const signatoryInput = root.querySelector('#settings-download-default-signatory');
      const titleInput = root.querySelector('#settings-download-default-title');
      const emailInput = root.querySelector('#settings-download-default-email');
      this.saveDownloadSettings({
        autoGeneratePdf: autoPdfCheckbox ? autoPdfCheckbox.checked : false,
        promptForCredentials: promptCheckbox ? promptCheckbox.checked : true,
        credentials: {
          projectName: projectInput ? projectInput.value.trim() : '',
          signatoryName: signatoryInput ? signatoryInput.value.trim() : '',
          signatoryTitle: titleInput ? titleInput.value.trim() : '',
          contactEmail: emailInput ? emailInput.value.trim() : ''
        },
        agency: {
          projectName: root.querySelector('#settings-agency-project')?.value.trim() || '',
          devAgency: root.querySelector('#settings-agency-dev')?.value.trim() || '',
          client: root.querySelector('#settings-agency-client')?.value.trim() || '',
          milestone: root.querySelector('#settings-agency-milestone')?.value || 'Release',
          date: root.querySelector('#settings-agency-date')?.value || '',
          scanId: root.querySelector('#settings-agency-scan-id')?.value.trim() || '',
          score: Number(root.querySelector('#settings-agency-score')?.value || 100),
          status: root.querySelector('#settings-agency-status')?.value || 'PASS'
        },
        executive: {
          projectName: root.querySelector('#settings-exec-project')?.value.trim() || '',
          assessor: root.querySelector('#settings-exec-assessor')?.value.trim() || '',
          date: root.querySelector('#settings-exec-date')?.value || '',
          reportId: root.querySelector('#settings-exec-report-id')?.value.trim() || '',
          summary: root.querySelector('#settings-exec-summary')?.value || '',
          verdict: root.querySelector('#settings-exec-verdict')?.value || 'READY'
        }
      });
      showToast('Report credentials saved', 'success');
    });

    // Credential editor tab switching
    root.querySelectorAll('[data-cred-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.credTab;
        root.querySelectorAll('[data-cred-tab]').forEach((t) => t.classList.remove('active'));
        root.querySelectorAll('[data-cred-panel]').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        root.querySelector(`[data-cred-panel="${target}"]`)?.classList.add('active');
      });
    });
    root.querySelector('#settings-token-update')?.addEventListener('click', () => {
      const discountCode = 'SB-FRIEND-25';
      const salesUrl = `https://simplebeacon.ai/checkout/tokens?code=${encodeURIComponent(discountCode)}&ref=dashboard`;
      window.open(salesUrl, '_blank', 'noopener,noreferrer');
    });
    root.querySelector('#settings-token-get')?.addEventListener('click', () => {
      const discountCode = 'SB-FRIEND-25';
      const salesUrl = `https://simplebeacon.ai/checkout/tokens?code=${encodeURIComponent(discountCode)}&ref=dashboard`;
      window.open(salesUrl, '_blank', 'noopener,noreferrer');
    });
    root.querySelector('#settings-token-clear')?.addEventListener('click', () => this.clearToken(rerender));
    root.querySelector('#settings-token-register-email')?.addEventListener('click', () => this.registerTokenWithEmail(rerender));
    root.querySelector('#settings-token-clear-vault')?.addEventListener('click', () => this.confirmAndClearVault(rerender));

    root.querySelectorAll('[data-vault-activate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.vaultActivate, 10);
        this.activateVaultToken(idx);
        rerender();
      });
    });
    root.querySelectorAll('[data-vault-return]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.vaultReturn, 10);
        this.returnVaultToken(idx, rerender);
      });
    });
    root.querySelectorAll('[data-vault-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.vaultRemove, 10);
        this.removeFromVault(idx);
        showToast('Token removed from vault', 'info');
        rerender();
      });
    });

    if (root.querySelector('#settings-ai-keys-card')) {
      const baseUrl = this.displayAiKeys().ollamaBaseUrl || 'http://127.0.0.1:11434';
      if (!this.ollamaModels.length && !this.ollamaModelsLoading) {
        void this.loadOllamaModels(baseUrl);
      }
    }
  }

  async applyProfilePreset(profile, rerender) {
    try {
      if (!this.presets) {
        this.presets = await scanService.fetchConfigPresets();
      }
      const preset = this.presets[profile];
      if (!preset) {
        this.draft.profile = profile;
        rerender();
        return;
      }

      this.draft = {
        ...this.draft,
        profile,
        rules: mergeRules(this.draft.rules, preset.rules),
        gate: { ...(this.draft.gate || {}), ...(preset.gate || {}) },
        productionPaths: preset.productionPaths?.length
          ? [...preset.productionPaths]
          : this.draft.productionPaths
      };
      if (this.draft.rules?.['production-leak']) {
        this.draft.rules['production-leak'].productionPaths = [...(this.draft.productionPaths || [])];
      }
      showToast(`Applied ${profile} rule presets`, 'info');
      rerender();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  buildConfigFromDom(base, rootEl) {
    const root = rootEl || this._root;
    const config = cloneConfig(base);

    if (root) {
      config.sampleDir = root.querySelector('#settings-sample-dir')?.value?.trim() || config.sampleDir;
      const scanPaths = textToPaths(root.querySelector('#settings-scan-paths')?.value);
      const productionPaths = textToPaths(root.querySelector('#settings-production-paths')?.value);
      config.scanPaths = scanPaths;
      config.productionPaths = productionPaths;
      config.fullDirectoryScan = root.querySelector('#settings-full-directory-scan')?.checked ?? config.fullDirectoryScan;

      config.gate = config.gate || { failOn: [], warnOn: [] };
      config.gate.failOn = readGateSelection(root, 'fail');
      config.gate.warnOn = readGateSelection(root, 'warn');

      config.rules = config.rules || {};
      for (const name of RULE_ORDER) {
        const btn = root.querySelector(`[data-rule-toggle="${name}"]`);
        if (btn) {
          const enabled = btn.classList.contains('on');
          config.rules[name] = { ...(config.rules[name] || {}), enabled };
        }
      }
    }

    if (config.rules?.['production-leak']) {
      config.rules['production-leak'].productionPaths = [...(config.productionPaths || [])];
    }

    return config;
  }

  async save(rerender) {
    this.busy = 'save';
    rerender();
    try {
      const config = this.buildConfigFromDom(this.draft, this._root);
      const result = await scanService.saveConfig(config);
      this.app.state.config = result.config;
      this.draft = cloneConfig(result.config);
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
      showToast(
        result.warnings?.length ? `Saved (${result.warnings.length} warning(s))` : 'Settings saved',
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.busy = false;
      rerender();
    }
  }

  async syncPathsFromProject(rerender) {
    this.busy = 'sync-paths';
    rerender();
    try {
      const projectPath = this.app.state.lastProjectPath || null;
      const config = await scanService.fetchConfig(projectPath);
      this.app.state.config = config;
      this.draft = cloneConfig(config);
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
      showToast('Scan paths synced from current project', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.busy = false;
      rerender();
    }
  }

  inferScanPaths(dirs, root) {
    const rootNorm = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const candidates = new Set();
    const scanPatterns = ['src', 'server', 'web', 'lib', 'app', 'api', 'routes', 'services', 'packages', 'js', 'ts', 'client', 'frontend', 'core', 'ui', 'components', 'utils', 'helpers'];
    for (const dir of dirs) {
      const rel = String(dir).replace(/\\/g, '/').replace(rootNorm, '').replace(/^\/+/, '');
      const firstPart = rel.split('/')[0];
      if (scanPatterns.includes(firstPart)) candidates.add(firstPart);
    }
    return Array.from(candidates);
  }

  inferProductionPaths(dirs, root) {
    const rootNorm = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const candidates = new Set();
    const prodPatterns = ['dist', 'build', 'public', 'out', '.next', 'static', 'deploy', 'release', 'bundle', 'production', 'prod'];
    for (const dir of dirs) {
      const rel = String(dir).replace(/\\/g, '/').replace(rootNorm, '').replace(/^\/+/, '');
      const firstPart = rel.split('/')[0];
      if (prodPatterns.includes(firstPart)) candidates.add(firstPart);
    }
    return Array.from(candidates);
  }

  async discoverPathsFromProject(rerender) {
    this.busy = 'discover-paths';
    rerender();
    try {
      const projectPath = this.app.state.lastProjectPath;
      if (!projectPath) {
        showToast('Set a project path on the Analyze page first', 'error');
        return;
      }
      const inventory = await this.app.scanService.fetchRepositoryInventory(projectPath);
      if (!inventory?.directoryTree) {
        showToast('Could not read project structure', 'error');
        return;
      }
      const dirs = inventory.directoryTree.map((d) => String(d.path || d.name || ''));
      const scanPaths = this.inferScanPaths(dirs, projectPath);
      const productionPaths = this.inferProductionPaths(dirs, projectPath);
      this.draft = this.draft || cloneConfig(this.app.state.config || {});
      this.draft.scanPaths = scanPaths;
      this.draft.productionPaths = productionPaths;
      this.savedSnapshot = JSON.stringify(this.buildConfigFromDom(this.draft, null));
      showToast(`Discovered ${scanPaths.length} scan path(s), ${productionPaths.length} production path(s)`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.busy = false;
      rerender();
    }
  }

  async syncBaseline(rerender) {
    this.busy = 'baseline';
    rerender();
    try {
      const result = await platformService.runBaselineSync();
      this.app.state.baseline = result.baseline;
      scanService.baseline = result.baseline;
      await this.app.platformService.fetchAll();
      this.app.state.dashboardHome = this.app.platformService.dashboardHome;
      this.app.refreshCurrentView();
      showToast(`Baseline synced — ${result.baseline?.jestTestsLabel || 'Jest updated'}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.busy = false;
      rerender();
    }
  }

  async runScan(rerender) {
    if (this.isDirty()) {
      showToast('Save settings before running a scan', 'error');
      return;
    }
    this.busy = 'scan';
    rerender();
    try {
      showToast('Running Simplebeacon scan…', 'info');
      const config = this.app.state.config || {};
      await scanService.runScan(null, { fullDirectoryScan: config.fullDirectoryScan === true });
      const data = await scanService.fetchAll();
      Object.assign(this.app.state, data);
      showToast('Scan complete — dashboard metrics updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      this.busy = false;
      rerender();
    }
  }
}

/**
 * Render rule row.
 * @param {string} name
 * @param {any} rule
 * @returns {any}
 */
function renderRuleRow(name, rule = {}) {
  const enabled = rule.enabled !== false;
  return `
    <div class="settings-row">
      <span class="settings-label">${escapeHtml(formatRuleName(name))}</span>
      <button
        type="button"
        class="toggle ${enabled ? 'on' : ''}"
        data-rule-toggle="${escapeHtml(name)}"
        data-enabled="${enabled}"
        aria-pressed="${enabled}"
        aria-label="${enabled ? 'Disable' : 'Enable'} ${escapeHtml(formatRuleName(name))}"
      >
        <span class="toggle-knob"></span>
      </button>
    </div>
  `;
}

/**
 * Checkbox.
 * @param {any} group
 * @param {any} severity
 * @param {any} list
 * @returns {any}
 */
function checkbox(group, severity, list = []) {
  const checked = (list || []).includes(severity);
  return `
    <label class="settings-checkbox">
      <input type="checkbox" data-gate-group="${group}" value="${severity}" ${checked ? 'checked' : ''} aria-label="${severity} severity filter" />
      <span>${severity}</span>
    </label>
  `;
}

/**
 * Read gate selection.
 * @param {any} root
 * @param {any} group
 * @returns {any}
 */
function readGateSelection(root, group) {
  return SEVERITIES.filter((sev) => {
    const input = root.querySelector(`[data-gate-group="${group}"][value="${sev}"]`);
    return input?.checked;
  });
}

/**
 * Merge rules.
 * @param {any} existing
 * @param {any} preset
 * @returns {any}
 */
function mergeRules(existing = {}, preset = {}) {
  const merged = { ...existing };
  for (const [name, rule] of Object.entries(preset)) {
    merged[name] = { ...(existing[name] || {}), ...rule };
  }
  return merged;
}

/**
 * Format rule name.
 * @param {string} name
 * @returns {any}
 */
function formatRuleName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Paths to text.
 * @param {Array} paths
 * @returns {any}
 */
function pathsToText(paths) {
  return (paths || []).join('\n');
}

/**
 * Text to paths.
 * @param {string} text
 * @returns {any}
 */
function textToPaths(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Clone config.
 * @param {Object} config
 * @returns {any}
 */
function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config || {}));
}
