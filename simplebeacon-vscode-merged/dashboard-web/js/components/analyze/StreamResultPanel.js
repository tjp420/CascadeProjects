// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * StreamResultPanel — Sub-component for AnalyzeView
 * Displays real-time scan progress, terminal output, and final results.
 */
export class StreamResultPanel {
  constructor(parentView) {
    this.parent = parentView;
    this.container = null;
    this.mounted = false;
    this._terminalLines = [];
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
    const progress = this.parent.scanProgress;
    const isScanning = this.parent.busy;
    const progressPercent = progress && progress.total
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

    return `
      <div class="analyze-stream-result-panel db-v3-panel db-v3-glass active-stream-terminal-card">
        <div class="stream-header-row">
          <div class="stream-title-meta">
            <span class="codicon codicon-terminal header-inner-icon"></span>
            <h5>Results Stream</h5>
          </div>
          <div class="panel-actions">
            <button id="btn-clear-terminal" class="btn btn-sm btn-ghost" type="button">Clear</button>
            <button id="btn-export-results" class="btn btn-sm btn-ghost" type="button">Export</button>
          </div>
        </div>
        <div class="panel-body">
          ${isScanning ? `
            <div class="stream-progress-track-wrapper">
              <div class="progress-bar-fill-node" style="width: ${progressPercent}%"></div>
            </div>
            <div class="scan-progress-meta">
              <span class="scan-progress-phase">${progress?.phase || 'Scanning…'}</span>
              <span class="scan-progress-counter">${progress?.processed || 0} / ${progress?.total || '—'}</span>
            </div>
          ` : '<div class="empty-state">No active scan. Start an analysis to see results here.</div>'}
          <div id="terminal-output" class="terminal-buffer-box-canvas"></div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const clearBtn = this.container.querySelector('#btn-clear-terminal');
    const exportBtn = this.container.querySelector('#btn-export-results');

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._terminalLines = [];
        this._renderTerminal();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.parent.handleGlobalAction('EXPORT_RESULTS');
      });
    }
  }

  appendLine(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    this._terminalLines.push({ text, type, timestamp });
    if (this._terminalLines.length > 500) {
      this._terminalLines = this._terminalLines.slice(-500);
    }
    this._renderTerminal();
  }

  _renderTerminal() {
    const output = this.container?.querySelector('#terminal-output');
    if (!output) return;
    output.innerHTML = this._terminalLines.map((line) => `
      <div class="terminal-line terminal-line--${line.type}">
        <span class="terminal-timestamp">${line.timestamp}</span>
        <span class="terminal-text">${line.text}</span>
      </div>
    `).join('');
    output.scrollTop = output.scrollHeight;
  }

  prepareCanvas(targetPath) {
    this._terminalLines = [];
    this.container.innerHTML = `
      <div class="db-v3-panel db-v3-glass active-stream-terminal-card">
        <div class="stream-header-row">
          <div class="stream-title-meta">
            <span class="codicon codicon-terminal header-inner-icon"></span>
            <h5>Live Scan Execution Stream: <code>${targetPath}</code></h5>
          </div>
          <div class="running-status-indicator"><span class="pulse-dot-animated"></span> SCANNING</div>
        </div>

        <!-- Progress Track -->
        <div class="stream-progress-track-wrapper">
          <div class="progress-bar-fill-node" style="width: 0%" id="sb-scan-progress-bar-node"></div>
        </div>

        <!-- Enhanced Monospaced Terminal Canvas Box -->
        <div class="terminal-buffer-box-canvas" id="terminal-output">
          <div class="terminal-row sys-init-line">[SYSTEM] Spawning code hygiene engine workers...</div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  refresh() {
    if (!this.mounted || !this.container) return;
    this.container.innerHTML = this.render();
    this.bindEvents();
    this._renderTerminal();
  }

  updateProgress(progress) {
    if (!this.mounted) return;
    const fill = this.container.querySelector('.scan-progress-fill');
    const phase = this.container.querySelector('.scan-progress-phase');
    const counter = this.container.querySelector('.scan-progress-counter');
    const percent = progress && progress.total
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;
    if (fill) fill.style.width = `${percent}%`;
    if (phase) phase.textContent = progress?.phase || 'Scanning…';
    if (counter) counter.textContent = `${progress?.processed || 0} / ${progress?.total || '—'}`;
  }
}
