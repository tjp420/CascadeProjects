import { escapeHtml, showToast, downloadJson } from '../utils.js';
import { resolvePageSpecsLabel, resolveJestTestsLabel } from '../services/analyzeService.js';
// EU AI Act transparency disclosure: This view includes AI system integration indicators per Article 50.
import { scanService } from '../services/scanService.js';
import { platformService } from '../services/platformService.js';
import { fetchUserAiKeys, saveUserAiKeys, clearUserAiKeys, normalizeAiKeysRecord, fetchOllamaModels } from '../services/aiKeysService.js?v=20260525aikeysguard1';

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
        || 'http://127.0.0.1:11434';
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
    const url = String(baseUrl || 'http://127.0.0.1:11434').trim() || 'http://127.0.0.1:11434';
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
        <h1 class="page-title">Settings</h1>
        <div class="empty-state card"><div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div><p>Loading config…</p></div>
      `;
      return el;
    }

    if (this.error && !this.draft) {
      el.innerHTML = `
        <h1 class="page-title">Settings</h1>
        <div class="empty-state card"><p>${escapeHtml(this.error)}</p><button class="btn btn-primary mt-4" id="settings-reload">Retry</button></div>
      `;
      el.querySelector('#settings-reload')?.addEventListener('click', () => {
        const container = el.parentElement;
        if (container) this.loadAndMount(container);
      });
      return el;
    }

    el.innerHTML = `
      <div class="settings-header">
        <h1 class="page-title">Settings</h1>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="settings-reset" ${!dirty || this.busy ? 'disabled' : ''}>Reset</button>
          <button type="button" class="btn btn-secondary btn-sm" id="settings-export">Export</button>
          <button type="button" class="btn btn-primary btn-sm" id="settings-save" ${!dirty || this.busy ? 'disabled' : ''}>
            ${this.busy === 'save' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <p class="text-muted mb-4">Edits write to <code>.simplebeacon/config.json</code> on the server. Save before running a scan.</p>
      ${dirty ? '<p class="settings-dirty-hint">You have unsaved changes.</p>' : ''}

      <div class="card settings-grid mb-6">
        <h2 class="card-title">Scan Configuration</h2>
        <div class="settings-field">
          <label class="settings-label" for="settings-profile">Profile</label>
          <select class="settings-input" id="settings-profile">
            ${PROFILES.map((p) => `
              <option value="${p}" ${config.profile === p ? 'selected' : ''}>${p}</option>
            `).join('')}
          </select>
          <p class="text-muted" style="font-size:var(--font-size-xs);margin:var(--space-1) 0 0">Changing profile applies rule presets — scan paths stay unless you edit them below.</p>
        </div>
        <div class="settings-field">
          <span class="settings-label">Config path</span>
          <span class="settings-value">.simplebeacon/config.json</span>
        </div>
        <div class="settings-field settings-field-stack">
          <label class="settings-label" for="settings-scan-paths">Scan paths</label>
          <textarea class="settings-textarea" id="settings-scan-paths" rows="4" placeholder="One path per line">${escapeHtml(pathsToText(config.scanPaths))}</textarea>
        </div>
        <div class="settings-field settings-field-stack">
          <label class="settings-label" for="settings-production-paths">Production paths</label>
          <textarea class="settings-textarea" id="settings-production-paths" rows="3" placeholder="One path per line">${escapeHtml(pathsToText(config.productionPaths))}</textarea>
        </div>
        <div class="settings-field">
          <label class="settings-label" for="settings-sample-dir">Sample directory</label>
          <input class="settings-input" id="settings-sample-dir" type="text" value="${escapeHtml(config.sampleDir || '')}" />
        </div>
      </div>

      ${this.renderAiKeysSection()}

      <div class="card settings-grid mb-6">
        <h2 class="card-title">Rules</h2>
        ${RULE_ORDER.map((name) => renderRuleRow(name, config.rules?.[name])).join('')}
      </div>

      <div class="card settings-grid mb-6">
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

      <div class="card settings-grid mb-6">
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

      <div class="card settings-grid mb-6">
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

      <div class="card settings-grid">
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
            placeholder="http://127.0.0.1:11434"
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
      console.warn('AI keys unavailable:', err.message);
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
      const [config, presets] = await Promise.all([
        scanService.fetchConfig(),
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
    const rerender = () => {
      this.captureAiKeysFormDraft(this._root);
      if (container) this.mount(container);
    };

    root.querySelector('#settings-ai-ollama')?.addEventListener('input', (e) => {
      this.aiKeysFormDraft.ollamaBaseUrl = e.target.value;
      this.scheduleOllamaModelsReload(e.target.value);
    });
    this.bindOllamaModelEvents(root);

    const onFieldChange = () => {
      this.draft = this.buildConfigFromDom(this.draft, root);
      rerender();
    };

    root.querySelector('#settings-profile')?.addEventListener('change', async (e) => {
      const profile = e.target.value;
      await this.applyProfilePreset(profile, rerender);
    });
    root.querySelector('#settings-sample-dir')?.addEventListener('input', onFieldChange);
    root.querySelector('#settings-scan-paths')?.addEventListener('input', onFieldChange);
    root.querySelector('#settings-production-paths')?.addEventListener('input', onFieldChange);

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
    root.querySelector('#settings-baseline-sync')?.addEventListener('click', () => this.syncBaseline(rerender));
    root.querySelector('#settings-run-scan')?.addEventListener('click', () => this.runScan(rerender));
    root.querySelector('#settings-ai-save')?.addEventListener('click', () => this.saveAiKeys(root, rerender));
    root.querySelector('#settings-ai-clear')?.addEventListener('click', () => this.clearAllAiKeys(rerender));
    root.querySelector('#settings-ai-test-ollama')?.addEventListener('click', () => this.testOllamaConnection(root, rerender));

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
      config.profile = root.querySelector('#settings-profile')?.value || config.profile;
      config.sampleDir = root.querySelector('#settings-sample-dir')?.value?.trim() || config.sampleDir;
      const scanPaths = textToPaths(root.querySelector('#settings-scan-paths')?.value);
      const productionPaths = textToPaths(root.querySelector('#settings-production-paths')?.value);
      if (scanPaths.length) config.scanPaths = scanPaths;
      if (productionPaths.length) config.productionPaths = productionPaths;

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
      await scanService.runScan();
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

function checkbox(group, severity, list = []) {
  const checked = (list || []).includes(severity);
  return `
    <label class="settings-checkbox">
      <input type="checkbox" data-gate-group="${group}" value="${severity}" ${checked ? 'checked' : ''} />
      <span>${severity}</span>
    </label>
  `;
}

function readGateSelection(root, group) {
  return SEVERITIES.filter((sev) => {
    const input = root.querySelector(`[data-gate-group="${group}"][value="${sev}"]`);
    return input?.checked;
  });
}

function mergeRules(existing = {}, preset = {}) {
  const merged = { ...existing };
  for (const [name, rule] of Object.entries(preset)) {
    merged[name] = { ...(existing[name] || {}), ...rule };
  }
  return merged;
}

function formatRuleName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pathsToText(paths) {
  return (paths || []).join('\n');
}

function textToPaths(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config || {}));
}
