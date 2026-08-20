// simplebeacon-ignore: Dashboard component code — findings are false positives
import { escapeHtml, showToast, formatNumber } from '../utils.js';

/**
 * Compliance Policy Editor — interactive configuration canvas for toggling
 * compliance thresholds, configuring rule engines, and previewing policy
 * adjustments before saving to .simplebeacon/config.json.
 *
 * @module PolicyEditor
 */

const SEVERITIES = ['high', 'medium', 'low'];
const PROFILES = ['minimal', 'standard', 'cascade'];

// Rule display order (matches SettingsView RULE_ORDER)
const RULE_ORDER = [
    'credentials',
    'json-schema',
    'sample-consistency',
    'roadmap',
    'production-leak',
    'fiction-kpi-patterns',
    'llm-slop-patterns',
    'agency-handoff-patterns',
    'eu-ai-act-patterns',
    'jest-baseline',
    'token-bleed-patterns',
    'architecture-drift-patterns',
    'performance',
    'type-safety',
    'ai-residue',
    'config-drift',
    'security-headers',
    'quality',
    'dead-code',
    'memory-leak',
    'build-artifact',
    'hardcoded-url',
    'file-reduction'
];

/**
 * Format a rule name for display (kebab-case → Title Case).
 * @param {string} name
 * @returns {string}
 */
function formatRuleName(name) {
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Deep clone helper.
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch {
        return obj;
    }
}

/**
 * Check if two config objects are equal.
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
function configEqual(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

/**
 * Render a single rule toggle row.
 * @param {string} name
 * @param {Object} rule
 * @returns {string}
 */
function renderRuleRow(name, rule) {
    const enabled = rule && rule.enabled !== false;
    return `
        <div class="policy-rule-row">
            <span class="policy-rule-label">${escapeHtml(formatRuleName(name))}</span>
            <button
                type="button"
                class="toggle ${enabled ? 'on' : ''}"
                data-policy-rule="${escapeHtml(name)}"
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
 * Render a gate severity checkbox.
 * @param {string} group - 'fail' or 'warn'
 * @param {string} severity
 * @param {Array} list
 * @returns {string}
 */
function renderGateCheckbox(group, severity, list) {
    const checked = (list || []).includes(severity);
    return `
        <label class="settings-checkbox">
            <input type="checkbox" data-policy-gate="${group}" value="${severity}" ${checked ? 'checked' : ''} aria-label="${severity} severity ${group}" />
            <span>${severity}</span>
        </label>
    `;
}

/**
 * Read gate selection from the DOM.
 * @param {Element} root
 * @param {string} group
 * @returns {Array}
 */
function readGateSelection(root, group) {
    return SEVERITIES.filter(sev => {
        const input = root.querySelector(`[data-policy-gate="${group}"][value="${sev}"]`);
        return input ? input.checked : false;
    });
}

/**
 * Render the live preview panel showing the effective policy.
 * @param {Object} config
 * @returns {string}
 */
function renderPreview(config) {
    const gate = config.gate || { failOn: [], warnOn: [] };
    const rules = config.rules || {};
    const enabledRules = Object.entries(rules).filter(([, r]) => r && r.enabled !== false);
    const disabledRules = Object.entries(rules).filter(([, r]) => r && r.enabled === false);
    const failCount = (gate.failOn || []).length;
    const warnCount = (gate.warnOn || []).length;

    return `
        <div class="policy-preview">
            <h4 class="policy-preview-title">Effective Policy Preview</h4>
            <div class="policy-preview-grid">
                <div class="policy-preview-stat">
                    <div class="policy-preview-stat-value ${failCount > 0 ? 'danger' : 'muted'}">${failCount}</div>
                    <div class="policy-preview-stat-label">Fail-on severities</div>
                </div>
                <div class="policy-preview-stat">
                    <div class="policy-preview-stat-value ${warnCount > 0 ? 'warning' : 'muted'}">${warnCount}</div>
                    <div class="policy-preview-stat-label">Warn-on severities</div>
                </div>
                <div class="policy-preview-stat">
                    <div class="policy-preview-stat-value success">${enabledRules.length}</div>
                    <div class="policy-preview-stat-label">Enabled rules</div>
                </div>
                <div class="policy-preview-stat">
                    <div class="policy-preview-stat-value ${disabledRules.length > 0 ? 'warning' : 'muted'}">${disabledRules.length}</div>
                    <div class="policy-preview-stat-label">Disabled rules</div>
                </div>
            </div>
            <div class="policy-preview-detail">
                <div class="policy-preview-row">
                    <span class="policy-preview-key">Profile:</span>
                    <span class="policy-preview-val">${escapeHtml(config.profile || 'standard')}</span>
                </div>
                <div class="policy-preview-row">
                    <span class="policy-preview-key">Fail on:</span>
                    <span class="policy-preview-val ${(gate.failOn || []).length ? 'danger' : 'muted'}">${(gate.failOn || []).join(', ') || 'none'}</span>
                </div>
                <div class="policy-preview-row">
                    <span class="policy-preview-key">Warn on:</span>
                    <span class="policy-preview-val ${(gate.warnOn || []).length ? 'warning' : 'muted'}">${(gate.warnOn || []).join(', ') || 'none'}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the policy editor section HTML.
 * @param {Object} config - The current config object
 * @param {boolean} dirty - Whether there are unsaved changes
 * @returns {string}
 */
export function renderPolicyEditor(config, dirty) {
    const gate = (config && config.gate) || { failOn: ['high'], warnOn: ['medium', 'low'] };
    const rules = (config && config.rules) || {};
    const profile = (config && config.profile) || 'standard';

    return `
        <div class="card policy-editor-card mb-6" id="policy-editor-section">
            <div class="policy-editor-header">
                <h2 class="card-title">Compliance Policy Editor</h2>
                ${dirty ? '<span class="policy-dirty-badge">Unsaved changes</span>' : ''}
            </div>
            <p class="text-muted policy-editor-sub">Toggle compliance thresholds, configure rule engines, and preview your policy before saving.</p>

            <div class="policy-editor-body">
                <div class="policy-editor-left">
                    <div class="policy-section">
                        <div class="policy-section-header">
                            <span class="settings-label">Profile preset</span>
                            <select class="settings-input policy-profile-select" id="policy-profile-select" style="max-width:200px;">
                                ${PROFILES.map(p => `<option value="${escapeHtml(p)}" ${p === profile ? 'selected' : ''}>${escapeHtml(p.charAt(0).toUpperCase() + p.slice(1))}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="policy-section">
                        <h3 class="policy-section-title">Gate Policy</h3>
                        <div class="policy-gate-group">
                            <span class="settings-label">Fail on</span>
                            <div class="settings-checkbox-group">
                                ${SEVERITIES.map(sev => renderGateCheckbox('fail', sev, gate.failOn)).join('')}
                            </div>
                        </div>
                        <div class="policy-gate-group">
                            <span class="settings-label">Warn on</span>
                            <div class="settings-checkbox-group">
                                ${SEVERITIES.map(sev => renderGateCheckbox('warn', sev, gate.warnOn)).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="policy-section">
                        <h3 class="policy-section-title">Rule Engines</h3>
                        <div class="policy-rules-list">
                            ${RULE_ORDER.map(name => renderRuleRow(name, rules[name])).join('')}
                        </div>
                    </div>
                </div>

                <div class="policy-editor-right">
                    <div id="policy-preview-slot">
                        ${renderPreview(config)}
                    </div>
                </div>
            </div>

            <div class="policy-editor-actions">
                <button type="button" class="btn btn-secondary" id="policy-reset-btn" ${dirty ? '' : 'disabled'}>
                    Reset
                </button>
                <button type="button" class="btn btn-primary" id="policy-save-btn" ${dirty ? '' : 'disabled'}>
                    ${dirty ? 'Save Policy' : 'No Changes'}
                </button>
            </div>
        </div>
    `;
}

/**
 * Build a config object from the DOM state.
 * @param {Object} baseConfig - The base config to merge into
 * @param {Element} root - The root element containing the policy editor
 * @returns {Object}
 */
function buildConfigFromDom(baseConfig, root) {
    const config = deepClone(baseConfig);
    const profileSelect = root.querySelector('#policy-profile-select');
    if (profileSelect) {
        config.profile = profileSelect.value;
    }
    config.gate = config.gate || { failOn: [], warnOn: [] };
    config.gate.failOn = readGateSelection(root, 'fail');
    config.gate.warnOn = readGateSelection(root, 'warn');
    config.rules = config.rules || {};
    root.querySelectorAll('[data-policy-rule]').forEach(btn => {
        const name = btn.getAttribute('data-policy-rule');
        const enabled = btn.getAttribute('data-enabled') === 'true';
        if (!config.rules[name]) {
            config.rules[name] = {};
        }
        config.rules[name].enabled = enabled;
    });
    return config;
}

/**
 * Update the preview panel without full re-render.
 * @param {Element} root
 * @param {Object} config
 */
function updatePreview(root, config) {
    const slot = root.querySelector('#policy-preview-slot');
    if (!slot) return;
    slot.innerHTML = renderPreview(config);
}

/**
 * Update the dirty badge and button states.
 * @param {Element} root
 * @param {boolean} dirty
 */
function updateDirtyState(root, dirty) {
    const card = root.querySelector('.policy-editor-card');
    if (!card) return;
    const existingBadge = card.querySelector('.policy-dirty-badge');
    if (dirty && !existingBadge) {
        const header = card.querySelector('.policy-editor-header');
        if (header) {
            const badge = document.createElement('span');
            badge.className = 'policy-dirty-badge';
            badge.textContent = 'Unsaved changes';
            header.appendChild(badge);
        }
    } else if (!dirty && existingBadge) {
        existingBadge.remove();
    }
    const saveBtn = root.querySelector('#policy-save-btn');
    const resetBtn = root.querySelector('#policy-reset-btn');
    if (saveBtn) {
        saveBtn.disabled = !dirty;
        saveBtn.textContent = dirty ? 'Save Policy' : 'No Changes';
    }
    if (resetBtn) {
        resetBtn.disabled = !dirty;
    }
}

/**
 * Mount the PolicyEditor into a container element.
 * Reads config from app.state.config, renders the editor, and binds events.
 *
 * @param {Element} container - The DOM element to mount into
 * @param {Object} app - The dashboard app instance (must have scanService and state.config)
 * @returns {Function|null} Cleanup function to call on unmount, or null if not mounted
 */
export function mountPolicyEditor(container, app) {
    if (!container || !app) return null;

    const scanService = app.scanService;
    const initialConfig = (app.state && app.state.config) || {
        profile: 'standard',
        gate: { failOn: ['high'], warnOn: ['medium', 'low'] },
        rules: {}
    };

    // Deep clone so we don't mutate the original
    let draftConfig = deepClone(initialConfig);
    let savedSnapshot = deepClone(initialConfig);
    let busy = false;

    // Render initial HTML
    const isDirty = !configEqual(draftConfig, savedSnapshot);
    container.innerHTML = renderPolicyEditor(draftConfig, isDirty);

    const root = container.querySelector('.policy-editor-card');
    if (!root) return null;

    /**
     * Recompute dirty state and update UI.
     */
    function refreshDirtyState() {
        const dirty = !configEqual(draftConfig, savedSnapshot);
        updateDirtyState(root, dirty);
        updatePreview(root, draftConfig);
    }

    /**
     * Rebuild draft from DOM and refresh.
     */
    function syncFromDom() {
        draftConfig = buildConfigFromDom(savedSnapshot, root);
        refreshDirtyState();
    }

    // --- Event bindings ---

    // Profile select
    const profileSelect = root.querySelector('#policy-profile-select');
    if (profileSelect) {
        profileSelect.addEventListener('change', e => {
            const newProfile = e.target.value;
            draftConfig = buildConfigFromDom(savedSnapshot, root);
            draftConfig.profile = newProfile;

            // If presets are available, apply the preset rules
            if (scanService && typeof scanService.fetchConfigPresets === 'function') {
                scanService
                    .fetchConfigPresets()
                    .then(presets => {
                        const preset = presets[newProfile];
                        if (preset && preset.rules) {
                            draftConfig.rules = draftConfig.rules || {};
                            for (const [ruleName, ruleCfg] of Object.entries(preset.rules)) {
                                if (draftConfig.rules[ruleName]) {
                                    draftConfig.rules[ruleName].enabled = ruleCfg.enabled !== false;
                                } else {
                                    draftConfig.rules[ruleName] = { enabled: ruleCfg.enabled !== false };
                                }
                            }
                        }
                        // Re-render the rules list with updated toggle states
                        const rulesList = root.querySelector('.policy-rules-list');
                        if (rulesList) {
                            rulesList.innerHTML = RULE_ORDER.map(name =>
                                renderRuleRow(name, (draftConfig.rules || {})[name])
                            ).join('');
                            // Re-bind rule toggles
                            bindRuleToggles();
                        }
                        refreshDirtyState();
                    })
                    .catch(() => {
                        refreshDirtyState();
                    });
            } else {
                refreshDirtyState();
            }
        });
    }

    // Gate checkboxes
    root.querySelectorAll('[data-policy-gate]').forEach(input => {
        input.addEventListener('change', syncFromDom);
    });

    /**
     * Bind click handlers to rule toggle buttons.
     */
    function bindRuleToggles() {
        root.querySelectorAll('[data-policy-rule]').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.getAttribute('data-policy-rule');
                const currentEnabled = btn.getAttribute('data-enabled') === 'true';
                const newEnabled = !currentEnabled;
                btn.setAttribute('data-enabled', String(newEnabled));
                btn.classList.toggle('on', newEnabled);
                btn.setAttribute('aria-pressed', String(newEnabled));
                btn.setAttribute('aria-label', `${newEnabled ? 'Disable' : 'Enable'} ${formatRuleName(name)}`);
                syncFromDom();
            });
        });
    }
    bindRuleToggles();

    // Save button
    const saveBtn = root.querySelector('#policy-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (busy) return;
            const dirty = !configEqual(draftConfig, savedSnapshot);
            if (!dirty) return;
            busy = true;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                if (!scanService || typeof scanService.saveConfig !== 'function') {
                    throw new Error('Scan service not available');
                }
                const result = await scanService.saveConfig(draftConfig);
                savedSnapshot = deepClone(draftConfig);
                if (app.state) {
                    app.state.config = deepClone(draftConfig);
                }
                showToast('Compliance policy saved', 'success');
                refreshDirtyState();
            } catch (err) {
                showToast(err.message || 'Failed to save policy', 'error');
                refreshDirtyState();
            } finally {
                busy = false;
                saveBtn.textContent = 'Save Policy';
            }
        });
    }

    // Reset button
    const resetBtn = root.querySelector('#policy-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            draftConfig = deepClone(savedSnapshot);
            container.innerHTML = renderPolicyEditor(draftConfig, false);
            // Re-bind all events after re-render
            const newRoot = container.querySelector('.policy-editor-card');
            if (newRoot) {
                // Re-bind profile select
                const newProfileSelect = newRoot.querySelector('#policy-profile-select');
                if (newProfileSelect) {
                    newProfileSelect.addEventListener('change', e => {
                        const newProfile = e.target.value;
                        draftConfig = buildConfigFromDom(savedSnapshot, newRoot);
                        draftConfig.profile = newProfile;
                        refreshDirtyStateFor(newRoot);
                    });
                }
                // Re-bind gate checkboxes
                newRoot.querySelectorAll('[data-policy-gate]').forEach(input => {
                    input.addEventListener('change', () => {
                        draftConfig = buildConfigFromDom(savedSnapshot, newRoot);
                        refreshDirtyStateFor(newRoot);
                    });
                });
                // Re-bind rule toggles
                newRoot.querySelectorAll('[data-policy-rule]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const name = btn.getAttribute('data-policy-rule');
                        const currentEnabled = btn.getAttribute('data-enabled') === 'true';
                        const newEnabled = !currentEnabled;
                        btn.setAttribute('data-enabled', String(newEnabled));
                        btn.classList.toggle('on', newEnabled);
                        btn.setAttribute('aria-pressed', String(newEnabled));
                        btn.setAttribute('aria-label', `${newEnabled ? 'Disable' : 'Enable'} ${formatRuleName(name)}`);
                        draftConfig = buildConfigFromDom(savedSnapshot, newRoot);
                        refreshDirtyStateFor(newRoot);
                    });
                });
                // Re-bind save/reset buttons
                const newSaveBtn = newRoot.querySelector('#policy-save-btn');
                const newResetBtn = newRoot.querySelector('#policy-reset-btn');
                if (newSaveBtn) {
                    newSaveBtn.addEventListener('click', async () => {
                        if (busy) return;
                        const dirty = !configEqual(draftConfig, savedSnapshot);
                        if (!dirty) return;
                        busy = true;
                        newSaveBtn.disabled = true;
                        newSaveBtn.textContent = 'Saving…';
                        try {
                            if (!scanService || typeof scanService.saveConfig !== 'function') {
                                throw new Error('Scan service not available');
                            }
                            await scanService.saveConfig(draftConfig);
                            savedSnapshot = deepClone(draftConfig);
                            if (app.state) {
                                app.state.config = deepClone(draftConfig);
                            }
                            showToast('Compliance policy saved', 'success');
                            draftConfig = deepClone(savedSnapshot);
                            container.innerHTML = renderPolicyEditor(draftConfig, false);
                            rebindAll();
                        } catch (err) {
                            showToast(err.message || 'Failed to save policy', 'error');
                        } finally {
                            busy = false;
                        }
                    });
                }
                if (newResetBtn) {
                    newResetBtn.addEventListener('click', () => {
                        draftConfig = deepClone(savedSnapshot);
                        container.innerHTML = renderPolicyEditor(draftConfig, false);
                        rebindAll();
                    });
                }
            }
        });
    }

    /**
     * Refresh dirty state for a specific root element.
     * @param {Element} r
     */
    function refreshDirtyStateFor(r) {
        const dirty = !configEqual(draftConfig, savedSnapshot);
        updateDirtyState(r, dirty);
        updatePreview(r, draftConfig);
    }

    /**
     * Rebind all events after a full re-render.
     */
    function rebindAll() {
        const r = container.querySelector('.policy-editor-card');
        if (!r) return;
        const ps = r.querySelector('#policy-profile-select');
        if (ps) {
            ps.addEventListener('change', e => {
                draftConfig = buildConfigFromDom(savedSnapshot, r);
                draftConfig.profile = e.target.value;
                refreshDirtyStateFor(r);
            });
        }
        r.querySelectorAll('[data-policy-gate]').forEach(input => {
            input.addEventListener('change', () => {
                draftConfig = buildConfigFromDom(savedSnapshot, r);
                refreshDirtyStateFor(r);
            });
        });
        r.querySelectorAll('[data-policy-rule]').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.getAttribute('data-policy-rule');
                const currentEnabled = btn.getAttribute('data-enabled') === 'true';
                const newEnabled = !currentEnabled;
                btn.setAttribute('data-enabled', String(newEnabled));
                btn.classList.toggle('on', newEnabled);
                btn.setAttribute('aria-pressed', String(newEnabled));
                btn.setAttribute('aria-label', `${newEnabled ? 'Disable' : 'Enable'} ${formatRuleName(name)}`);
                draftConfig = buildConfigFromDom(savedSnapshot, r);
                refreshDirtyStateFor(r);
            });
        });
        const sb = r.querySelector('#policy-save-btn');
        const rb = r.querySelector('#policy-reset-btn');
        if (sb) {
            sb.addEventListener('click', async () => {
                if (busy) return;
                const dirty = !configEqual(draftConfig, savedSnapshot);
                if (!dirty) return;
                busy = true;
                sb.disabled = true;
                sb.textContent = 'Saving…';
                try {
                    if (!scanService || typeof scanService.saveConfig !== 'function') {
                        throw new Error('Scan service not available');
                    }
                    await scanService.saveConfig(draftConfig);
                    savedSnapshot = deepClone(draftConfig);
                    if (app.state) {
                        app.state.config = deepClone(draftConfig);
                    }
                    showToast('Compliance policy saved', 'success');
                    draftConfig = deepClone(savedSnapshot);
                    container.innerHTML = renderPolicyEditor(draftConfig, false);
                    rebindAll();
                } catch (err) {
                    showToast(err.message || 'Failed to save policy', 'error');
                } finally {
                    busy = false;
                }
            });
        }
        if (rb) {
            rb.addEventListener('click', () => {
                draftConfig = deepClone(savedSnapshot);
                container.innerHTML = renderPolicyEditor(draftConfig, false);
                rebindAll();
            });
        }
    }

    // Return cleanup function
    return function cleanup() {
        // Listeners are attached to the container's DOM which will be removed
        // by the parent view's destroy(), so no explicit removal needed
        draftConfig = null;
        savedSnapshot = null;
    };
}
