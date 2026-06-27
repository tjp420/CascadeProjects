/**
 * TargetConfigPanel — Sub-component for AnalyzeView
 * Handles path input, provider selection, and scan configuration UI.
 */
export class TargetConfigPanel {
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
    const app = this.parent.app;
    const pathValue = app.state.analyzePath || '';
    return `
      <div class="analyze-target-redesign db-v3-panel db-v3-glass">
        <div class="panel-header-v3">
          <span class="codicon codicon-target header-accent-icon"></span>
          <div class="header-text-group">
            <h3>Target Configuration</h3>
            <span class="panel-subtitle">Drop assets, specify repository paths, or scan URLs</span>
          </div>
        </div>

        <!-- Upgraded Drag & Drop Canvas -->
        <div class="analyze-drop-zone db-v3-glass" id="sb-analyze-file-dropzone">
          <div class="drop-zone-icon-shell">
            <span class="codicon codicon-cloud-upload drop-icon-animated"></span>
          </div>
          <p>Drag &amp; drop reports, bundles, or files here or <span class="browse-link-highlight">browse directory</span></p>
        </div>

        <!-- Path Input Cluster -->
        <div class="settings-field-stack-v3">
          <label class="field-label-micro">Workspace Target Path</label>
          <div class="input-action-flex-row">
            <div class="input-relative-shell">
              <span class="codicon codicon-terminal input-inner-icon"></span>
              <input type="text" id="analyze-path-input"
                     class="v3-text-input-field"
                     placeholder="e.g. ./my-project or https://github.com/org/repo"
                     value="${pathValue}"
                     autocomplete="off">
            </div>
            <button type="button" class="db-v3-action-btn browse-directory-trigger" id="btn-validate-path">
              <span class="codicon codicon-check"></span> Validate
            </button>
            <button type="button" class="db-v3-action-btn btn-primary" id="btn-start-scan">
              <span class="codicon codicon-play"></span> Start
            </button>
          </div>
          <div id="path-suggestions-mount" class="suggestions-dropdown-canvas db-v3-glass"></div>
        </div>

        <!-- Recent Path Slugs Track -->
        <div class="recent-paths-chips-wrapper">
          <span class="section-micro-label">Recent Targets:</span>
          <div class="chips-flex-row" id="sb-recent-chips-container">
            <!-- Kept matching your existing chip generation array append scripts -->
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const pathInput = this.container.querySelector('#analyze-path-input');
    const providerSelect = this.container.querySelector('#ai-provider-select');
    const validateBtn = this.container.querySelector('#btn-validate-path');
    const startBtn = this.container.querySelector('#btn-start-scan');

    if (pathInput) {
      pathInput.addEventListener('input', (e) => {
        this.parent.app.setState({ analyzePath: e.target.value });
      });
      pathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.parent.handleGlobalAction('START_SCAN', { targetPath: pathInput.value });
        }
      });
    }

    if (providerSelect) {
      providerSelect.addEventListener('change', (e) => {
        this.parent.aiProvider = e.target.value;
        this.parent.savePrefs();
      });
    }

    if (validateBtn) {
      validateBtn.addEventListener('click', () => {
        this.parent.handleGlobalAction('VALIDATE_PATH', { targetPath: pathInput?.value || '' });
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.parent.handleGlobalAction('START_SCAN', { targetPath: pathInput?.value || '' });
      });
    }
  }

  setBusy(busy) {
    const startBtn = this.container?.querySelector('#btn-start-scan');
    if (startBtn) {
      startBtn.disabled = busy;
      startBtn.textContent = busy ? 'Scanning…' : 'Start Analysis';
    }
  }

  updatePath(value) {
    const input = this.container?.querySelector('#analyze-path-input');
    if (input) input.value = value;
  }
}
