/**
 * EngineGridPanel — Sub-component for AnalyzeView
 * Renders the selectable engine/analysis-type grid.
 */
export class EngineGridPanel {
    constructor(parentView) {
        this.parent = parentView;
        this.container = null;
        this.mounted = false;
    }
    mount(element) {
        this.container = element;
        this.container.innerHTML = this.render();
        this.bindEvents();
        this.mounted = true;
        return this;
    }
    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.mounted = false;
    }
    render() {
        var _a, _b;
        const engines = ((_b = (_a = this.parent._engineGrid) === null || _a === void 0 ? void 0 : _a.getEnginesForDisplay) === null || _b === void 0 ? void 0 : _b.call(_a)) || [];
        const selected = new Set(this.parent.selectedEngines || []);
        const rows = engines.map((engine) => {
            const isSelected = selected.has(engine.id);
            const sevClass = engine.severity
                ? `sev-${engine.severity.toLowerCase()}`
                : '';
            return `
        <label class="engine-checkbox-row-wrapper db-v3-glass ${sevClass}" data-engine-id="${engine.id}">
          <input
            type="checkbox"
            class="engine-toggle-node-v3 analyze-engine-input"
            data-engine="${engine.id}"
            ${isSelected ? 'checked' : ''}
            aria-label="Select ${engine.label}"
          />
          <div class="checkbox-custom-label-block">
            <span class="engine-title-text">${engine.label}</span>
            <span class="engine-meta-desc-text">${engine.description || engine.hint || ''}</span>
          </div>
          <span class="chip chip-sm">${engine.category || 'General'}</span>
        </label>
      `;
        }).join('');
        return `
      <div class="db-v3-panel db-v3-glass engine-matrix-card">
        <div class="panel-header-v3">
          <span class="codicon codicon-settings-gear header-accent-icon"></span>
          <div class="header-text-group">
            <h3>Scan Mode &amp; Analyzer Config</h3>
            <span class="panel-subtitle">Select matching engine suites to evaluate custom gates</span>
          </div>
        </div>

        <!-- High-Density Profile Toggles -->
        <div class="profile-mode-preset-row" id="sb-mode-preset-chips-cluster">
          <button type="button" class="config-chip is-active" data-preset="essential">Essential (10 Core)</button>
          <button type="button" class="config-chip" data-preset="security">Security Suite</button>
          <button type="button" class="config-chip" data-preset="full">Full Scan (56+)</button>
        </div>

        <div class="engine-categories-scroll-wrapper">
          <div class="engine-category-cluster-block">
            <h4 class="category-heading-label">Core Engineering Engines</h4>
            <div class="category-checkboxes-grid">
              ${rows}
            </div>
          </div>
        </div>

        <div class="panel-actions panel-actions-footer">
          <button id="btn-select-all-engines" class="btn btn-sm btn-ghost" type="button">
            Select All
          </button>
          <button id="btn-clear-engines" class="btn btn-sm btn-ghost" type="button">
            Clear
          </button>
        </div>
      </div>
    `;
    }
    bindEvents() {
        const selectAllBtn = this.container.querySelector('#btn-select-all-engines');
        const clearBtn = this.container.querySelector('#btn-clear-engines');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.parent.handleGlobalAction('SELECT_ALL_ENGINES');
                this.refresh();
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.parent.handleGlobalAction('CLEAR_ENGINES');
                this.refresh();
            });
        }
        this.container.querySelectorAll('.analyze-engine-input').forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => {
                const engineId = e.target.dataset.engine;
                this.parent.handleGlobalAction('TOGGLE_ENGINE', { engineId, checked: e.target.checked });
            });
        });
    }
    refresh() {
        if (!this.mounted || !this.container)
            return;
        this.container.innerHTML = this.render();
        this.bindEvents();
    }
    lockUI() {
        var _a;
        (_a = this.container) === null || _a === void 0 ? void 0 : _a.querySelectorAll('.analyze-engine-input').forEach((cb) => {
            cb.disabled = true;
        });
    }
    unlockUI() {
        var _a;
        (_a = this.container) === null || _a === void 0 ? void 0 : _a.querySelectorAll('.analyze-engine-input').forEach((cb) => {
            cb.disabled = false;
        });
    }
}
