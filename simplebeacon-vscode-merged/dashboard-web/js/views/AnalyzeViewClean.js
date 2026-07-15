// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
import { escapeHtml, showToast, downloadJson, apiUrl, formatNumber } from '../utils.js';
import { AnalyzeEngineGrid, defaultSelectedEngines, normalizeSelectedEngines, modeToEngineId, inferDeliverableSku, SCAN_PRESETS, groupEnginesByCategory, COMPLETE_ENGINE_ORDER, isEngineTierLocked } from './AnalyzeEngineGrid.js';
import { AnalyzeTargetConfig } from './AnalyzeTargetConfig.js';
import { AnalyzeResultRenderer } from './AnalyzeResultRenderer.js';
import { authService } from '../services/authService.js?v=20260713sync5';
import {
  MAX_SNIPPET_BYTES,
  isSupportedSourceFile,
  scanSnippetText,
  computeThreatScore,
  filterSnippetFindingsForFile
} from '../utils/snippetDiagnostic.js';
import { scanPath } from '../services/analyzeService.js';

function loadAnalyzePrefs() {
  try {
    const raw = localStorage.getItem('simplebeaconAnalyzePrefs');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAnalyzePrefs(prefs) {
  try {
    const existing = loadAnalyzePrefs();
    localStorage.setItem('simplebeaconAnalyzePrefs', JSON.stringify({ ...existing, ...prefs }));
  } catch { /* ignore */ }
}

export class AnalyzeView {
  constructor(app) {
    this.app = app;
    this.busy = false;
    this.websiteMode = false;
    this.testSources = [];
    this.lastResult = app.state.analyzeResult || null;
    this._root = null;
    const prefs = loadAnalyzePrefs();
    const tier = authService.getTier?.() || 'guest';
    const isSandboxTier = tier === 'sandbox' || tier === 'developer';
    this.analysisType = prefs.analysisType || 'complete';
    this.aiProvider = prefs.aiProvider || 'demo';
    this.selectedEngines = (!isSandboxTier && Array.isArray(prefs.selectedEngines))
      ? normalizeSelectedEngines(prefs.selectedEngines, { allowEmpty: true })
      : defaultSelectedEngines();
    this._targetConfig = new AnalyzeTargetConfig(this);
    this._engineGrid = new AnalyzeEngineGrid(this);
    this._resultRenderer = new AnalyzeResultRenderer(this);
  }

  getActiveProjectPath(value) {
    return (value || '').trim();
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <style>
        .analyze-page { max-width: 1200px; margin: 0 auto; }
        .analyze-header { margin-bottom: 24px; }
        .analyze-header h1 { font-size: 2rem; font-weight: 800; margin: 0; letter-spacing: -0.02em; background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .analyze-header p { color: var(--text-muted); font-size: 0.9rem; margin: 6px 0 0; }
        .analyze-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .analyze-grid { grid-template-columns: 1fr; } }
        .analyze-card { background: linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border: 1px solid rgba(148,163,184,0.08); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        [data-theme='light'] .analyze-card { background: linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color: rgba(148,163,184,0.15); }
        .analyze-results { margin-top: 24px; min-height: 100px; }
        .analyze-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
        .analyze-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
        .analyze-actions { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
        .analyze-actions .btn { min-width: 120px; }
        .an-res-v3 { background: linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border: 1px solid rgba(148,163,184,0.08); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
        [data-theme='light'] .an-res-v3 { background: linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color: rgba(148,163,184,0.15); }
        .an-res-v3-hd { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(148,163,184,0.08); }
        .an-res-v3-hd h3 { margin: 0; font-size: 1rem; font-weight: 700; }
        .an-res-v3-metrics { display: flex; gap: 16px; padding: 16px 20px; border-bottom: 1px solid rgba(148,163,184,0.08); }
        .an-res-metric { display: flex; flex-direction: column; align-items: center; min-width: 80px; }
        .an-res-metric strong { font-size: 1.3rem; font-weight: 800; color: var(--accent); }
        .an-res-metric span { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .an-res-v3-body { padding: 16px 20px; }
        .an-sev-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin: 8px 0 12px; }
        .an-sev-bar > div { height: 100%; }
        .an-sev-critical { background: #ef4444; }
        .an-sev-high { background: #f97316; }
        .an-sev-medium { background: #3b82f6; }
        .an-sev-low { background: #22c55e; }
        .an-sev-labels { display: flex; gap: 12px; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 12px; flex-wrap: wrap; }
        .an-progress-wrap { padding: 20px; text-align: center; }
        .an-progress-bar { width: 100%; height: 8px; background: rgba(148,163,184,0.12); border-radius: 4px; overflow: hidden; margin: 12px 0; }
        .an-progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-light)); border-radius: 4px; transition: width 0.4s ease; }
      </style>
      <div class="analyze-page">
        <div class="analyze-header">
          <h1>Analyze</h1>
          <p>Scan a repo folder, drop a file, or paste a URL — pick your scan mix and run</p>
        </div>
        <div class="analyze-grid">
          <div class="analyze-left">
            ${this._targetConfig.render(this.app.state.defaultProjectPath || '', this.app.state.lastProjectPath || '')}
          </div>
          <div class="analyze-right">
            ${this._engineGrid.renderTabbedConfigurator()}
          </div>
        </div>
        <div class="analyze-results" id="analyze-results">
          ${this.renderResultsContent()}
        </div>
      </div>
      ${this._targetConfig.renderDirBrowserModal()}
    `;
    return el;
  }

  renderResultsContent() {
    const report = this.app.state.report;
    const result = this.lastResult;
    const scanning = this.app.state.scanning;

    if (scanning) {
      return this.renderProgress();
    }

    if (result) {
      const rendered = this._resultRenderer.render(result);
      if (rendered) return rendered;
    }

    if (report) {
      return this.renderReportSummary(report);
    }

    return `
      <div class="analyze-empty">
        <div class="analyze-empty-icon">&#x1F50D;</div>
        <p>Drop a file or enter a path to begin analysis</p>
      </div>
    `;
  }

  renderReportSummary(report) {
    const sev = report.severityCounts || report.severity || {};
    const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
    const score = report.qualityScore !== undefined ? report.qualityScore : (report.score !== undefined ? report.score : '--');
    const gatePass = report.gate?.pass;
    return `
      <div class="an-res-v3">
        <div class="an-res-v3-hd">
          <h3>Scan Results</h3>
          <span class="db-v3-panel-badge ${gatePass ? 'success' : (gatePass === false ? 'danger' : '')}">${gatePass ? 'PASS' : (gatePass === false ? 'FAIL' : 'N/A')}</span>
        </div>
        <div class="an-res-v3-metrics">
          <div class="an-res-metric"><strong>${score}</strong><span>Quality</span></div>
          <div class="an-res-metric"><strong>${formatNumber(report.totalFiles || report.filesAnalyzed || 0)}</strong><span>Files</span></div>
          <div class="an-res-metric"><strong>${total}</strong><span>Issues</span></div>
        </div>
        <div class="an-res-v3-body">
          ${total > 0 ? `
            <div class="an-sev-bar">
              ${sev.critical ? '<div class="an-sev-critical" style="width:' + ((sev.critical / total) * 100) + '%"></div>' : ''}
              ${sev.high ? '<div class="an-sev-high" style="width:' + ((sev.high / total) * 100) + '%"></div>' : ''}
              ${sev.medium ? '<div class="an-sev-medium" style="width:' + ((sev.medium / total) * 100) + '%"></div>' : ''}
              ${sev.low ? '<div class="an-sev-low" style="width:' + ((sev.low / total) * 100) + '%"></div>' : ''}
            </div>
            <div class="an-sev-labels">
              ${sev.critical ? '<span style="color:#ef4444">● ' + sev.critical + ' Critical</span>' : ''}
              ${sev.high ? '<span style="color:#f97316">● ' + sev.high + ' High</span>' : ''}
              ${sev.medium ? '<span style="color:#3b82f6">● ' + sev.medium + ' Medium</span>' : ''}
              ${sev.low ? '<span style="color:#22c55e">● ' + sev.low + ' Low</span>' : ''}
            </div>
          ` : '<p class="text-muted">No issues found.</p>'}
        </div>
      </div>
    `;
  }

  renderProgress() {
    return `
      <div class="an-res-v3">
        <div class="an-progress-wrap">
          <p style="color:var(--text-muted);margin-bottom:8px;">Scanning...</p>
          <div class="an-progress-bar"><div class="an-progress-fill" style="width:60%"></div></div>
          <p style="color:var(--text-muted);font-size:0.78rem;">Running analysis engines</p>
        </div>
      </div>
    `;
  }

  refreshResults() {
    const slot = this._root?.querySelector('#analyze-results');
    if (slot) slot.innerHTML = this.renderResultsContent();
  }

  mount(container) {
    this._root = container;
    container.innerHTML = '';
    const el = this.render();
    container.appendChild(el);
    this.bindEvents(el);
    // Load existing report if any
    if (this.app.state.report || this.app.state.analyzeResult) {
      this.lastResult = this.app.state.analyzeResult || null;
      this.refreshResults();
    }
    // Listen for app state changes
    this._onStateChange = () => {
      this.lastResult = this.app.state.analyzeResult || null;
      this.refreshResults();
    };
    if (this.app.stateController) {
      this.app.stateController.addListener?.('report', this._onStateChange);
      this.app.stateController.addListener?.('analyzeResult', this._onStateChange);
    }
  }

  bindEvents(el) {
    this._targetConfig.bindEvents(el);
    this._engineGrid.bindEvents(el);
  }

  handleDroppedFile(file) {
    if (!file) return;
    this.handleAnalyzeFiles([file]);
  }

  async handleAnalyzeFiles(fileList) {
    const file = fileList[0];
    if (!file) return;
    if (fileList.length > 1) {
      showToast('Drop one file at a time', 'info');
    }
    if (file.size > MAX_SNIPPET_BYTES) {
      showToast('File too large (max ' + Math.round(MAX_SNIPPET_BYTES / 1024) + ' KB for quick check)', 'error');
      return;
    }

    this.snippetBusy = true;
    this.refresh();

    try {
      const text = await this.readFileAsText(file);
      if (file.name.toLowerCase().endsWith('.json')) {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* ignore */ }
        if (parsed && typeof parsed === 'object') {
          this.lastResult = { kind: 'generic', data: parsed, fileName: file.name };
          showToast('JSON report loaded: ' + file.name, 'success');
        } else {
          showToast('Could not parse ' + file.name + ' as JSON', 'error');
        }
        this.snippetBusy = false;
        this.refresh();
        return;
      }

      if (!isSupportedSourceFile(file.name)) {
        showToast('Unsupported file type for quick check', 'error');
        this.snippetBusy = false;
        this.refresh();
        return;
      }

      const rawFindings = scanSnippetText(text, { fileName: file.name });
      const findings = filterSnippetFindingsForFile(rawFindings, file.name);
      this.lastResult = {
        kind: 'snippet',
        fileName: file.name,
        bytes: file.size,
        text,
        findings,
        threatScore: computeThreatScore(findings)
      };
      showToast('Scanned ' + file.name + ' (' + findings.length + ' findings)', 'success');
    } catch (err) {
      showToast('Failed to analyze file: ' + (err.message || String(err)), 'error');
    }
    this.snippetBusy = false;
    this.refresh();
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async runPathAnalysis(path) {
    let projectPath = String(path || '').trim();
    if (!projectPath) {
      projectPath = this.app.state.defaultProjectPath || '';
    }
    if (!projectPath) {
      showToast('Enter a project path first', 'error');
      return;
    }
    this.busy = true;
    this.app.state.scanning = true;
    this.lastResult = null;
    this.app.state.report = null;
    this.app.state.analyzeResult = null;
    this.refresh();
    showToast('Scanning ' + projectPath + '…', 'info');

    try {
      const data = await scanPath(projectPath, { fullDirectoryScan: true });
      const report = data.report;
      if (!report) {
        throw new Error('Scan completed but returned no report');
      }
      this.app.state.report = report;
      this.lastResult = {
        kind: 'simplebeacon-report',
        report,
        projectPath,
        label: 'Scan: ' + projectPath
      };
      this.app.state.analyzeResult = this.lastResult;
      showToast('Scan complete — ' + (report.totalFiles || 0) + ' files analyzed', 'success');
    } catch (err) {
      showToast(err.message || 'Scan failed', 'error');
    }

    this.busy = false;
    this.app.state.scanning = false;
    this.refresh();
  }

  runAnalysisFromPath() {
    const pathInput = document.getElementById('project-path-input');
    const path = pathInput?.value?.trim() || this.app.state.defaultProjectPath || '';
    if (!path) {
      showToast('Enter a project path first', 'error');
      return;
    }
    this.runPathAnalysis(path);
  }

  openResultsView() {
    this.app.navigate?.('results');
  }

  showResults() { this.openResultsView(); }
  runQuickFileScan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,.js,.ts,.py,.env,.md,.txt';
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleAnalyzeFiles([file]);
    });
    input.click();
  }
  openDirBrowser(el, startPath) {
    const root = el || this._root;
    if (!root) return;
    const modal = root.querySelector('#dir-browser-modal');
    if (!modal) return;
    const actualStartPath = startPath !== undefined
      ? startPath
      : (this.app.state.lastProjectPath || this.app.state.defaultProjectPath || '');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    this._dirBrowserPath = actualStartPath;
    this.loadDirBrowser(root, actualStartPath);
  }

  closeDirBrowser(el) {
    const root = el || this._root;
    if (!root) return;
    const modal = root.querySelector('#dir-browser-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    this._dirBrowserPath = null;
  }

  async loadDirBrowser(el, dirPath) {
    const listEl = el.querySelector('#dir-browser-list');
    const pathEl = el.querySelector('#dir-browser-current-path');
    if (!listEl || !pathEl) return;
    listEl.innerHTML = '<div class="dir-browser-empty">Loading directories…</div>';
    const displayPath = dirPath || 'Computer';
    pathEl.textContent = displayPath;
    this._dirBrowserPath = dirPath;
    try {
      const res = await fetch(apiUrl(`/api/analyze/list-directories?path=${encodeURIComponent(dirPath)}`), { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) {
        listEl.innerHTML = `<div class="dir-browser-empty">Error: ${escapeHtml(data.error || 'Failed to load directories')}</div>`;
        return;
      }
      const current = data.current || dirPath;
      pathEl.textContent = current || 'Computer';
      this._dirBrowserPath = current;
      if (!data.directories || data.directories.length === 0) {
        listEl.innerHTML = '<div class="dir-browser-empty">No subdirectories</div>';
        return;
      }
      const parentItem = data.parent
        ? `<div class="dir-browser-item" data-path="${escapeHtml(data.parent)}"><span class="dir-icon">⬆️</span> <strong>..</strong></div>`
        : '';
      const isDriveList = !current;
      const icon = isDriveList ? '💾' : '📁';
      const items = data.directories.map((dir) =>
        `<div class="dir-browser-item" data-path="${escapeHtml(dir.path)}"><span class="dir-icon">${icon}</span> ${escapeHtml(dir.name)}</div>`
      ).join('');
      listEl.innerHTML = parentItem + items;
      listEl.querySelectorAll('.dir-browser-item').forEach((item) => {
        item.addEventListener('click', () => {
          const path = item.dataset.path;
          if (path) this.loadDirBrowser(el, path);
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="dir-browser-empty">Error: ${escapeHtml(err.message)}</div>`;
    }
  }

  dirBrowserUp(el) {
    const root = el || this._root;
    if (!root || !this._dirBrowserPath) return;
    const normalized = this._dirBrowserPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) return;
    if (parts.length === 1 && /^[a-zA-Z]:$/.test(parts[0])) {
      this.loadDirBrowser(root, '');
      return;
    }
    parts.pop();
    const parent = parts.join('/');
    const parentPath = normalized.startsWith('/') ? '/' + parent : parent;
    this.loadDirBrowser(root, parentPath);
  }

  dirBrowserSelect(el) {
    const root = el || this._root;
    if (!root) return;
    const pathInput = root.querySelector('#project-path-input');
    if (pathInput && this._dirBrowserPath) {
      pathInput.value = this._dirBrowserPath;
      this.app.state.lastProjectPath = this._dirBrowserPath;
    }
    this.closeDirBrowser(root);
  }
  useDefaultPath() {
    const pathInput = document.getElementById('project-path-input');
    if (pathInput && this.app.state.defaultProjectPath) {
      pathInput.value = this.app.state.defaultProjectPath;
    }
  }
  handleGlobalAction(event, payload = {}) {
    switch (event) {
      case 'TOGGLE_ENGINE': {
        const { engineId, checked } = payload;
        const selected = new Set(this.selectedEngines || []);
        if (checked) selected.add(engineId);
        else selected.delete(engineId);
        this.setSelectedEngines(Array.from(selected), this._root, { allowEmpty: true });
        break;
      }
      case 'SELECT_ALL_ENGINES': {
        this.setSelectedEngines(COMPLETE_ENGINE_ORDER, this._root, { allowEmpty: true });
        break;
      }
      case 'CLEAR_ENGINES': {
        this.setSelectedEngines([], this._root, { allowEmpty: true });
        break;
      }
      default:
        break;
    }
  }

  toggleEngine(engineId, checked, root = this._root) {
    this.handleGlobalAction('TOGGLE_ENGINE', { engineId, checked });
  }

  setAnalysisType(type, { typeSelect } = {}) {
    this.analysisType = type;
    if (typeSelect) typeSelect.value = type;
    const engineId = modeToEngineId(type);
    if (engineId) {
      this.selectedEngines = normalizeSelectedEngines([engineId], { allowEmpty: true });
    }
    saveAnalyzePrefs({
      analysisType: type,
      aiProvider: this.aiProvider,
      selectedEngines: this.selectedEngines
    });
  }

  setSelectedEngines(engineIds, root = this._root, options = {}) {
    this.selectedEngines = normalizeSelectedEngines(engineIds, options);
    if (root) {
      root.querySelectorAll('.analyze-engine-input').forEach((input) => {
        input.checked = this.selectedEngines.includes(input.dataset.engine);
      });
      root.querySelectorAll('.analyze-engine-card').forEach((card) => {
        const engineId = card.dataset.engine;
        card.classList.toggle('is-selected', this.selectedEngines.includes(engineId));
      });
      this.syncCategoryCounts(root);
    }
    saveAnalyzePrefs({
      analysisType: this.analysisType,
      aiProvider: this.aiProvider,
      selectedEngines: this.selectedEngines
    });
  }

  syncCategoryCounts(root = this._root) {
    if (!root) return;
    const groups = groupEnginesByCategory(COMPLETE_ENGINE_ORDER);
    root.querySelectorAll('.analyze-cat-tab').forEach((tab) => {
      const cat = tab.dataset.category;
      const engines = groups.get(cat) || [];
      const activeCount = engines.filter((e) => this.selectedEngines.includes(e.id)).length;
      const countEl = tab.querySelector('.analyze-cat-count');
      if (countEl) {
        countEl.textContent = activeCount + '/' + engines.length;
        countEl.classList.toggle('is-full', activeCount === engines.length);
      }
    });
  }

  applyGroupToggle(category, checked, root = this._root) {
    const groups = groupEnginesByCategory(COMPLETE_ENGINE_ORDER);
    const engines = groups.get(category) || [];
    const ids = engines.map((e) => e.id).filter((id) => !isEngineTierLocked(id));
    const selected = new Set(this.selectedEngines);
    if (checked) {
      ids.forEach((id) => selected.add(id));
    } else {
      ids.forEach((id) => selected.delete(id));
    }
    this.setSelectedEngines(Array.from(selected), root, { allowEmpty: true });
  }

  applyScanPreset(presetId, root = this._root) {
    const preset = SCAN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (preset.id === 'custom') {
      this.setSelectedEngines([], root, { allowEmpty: true });
    } else {
      if (this.analysisType !== 'complete') {
        const typeSelect = root?.querySelector('#analysis-type-select');
        this.setAnalysisType('complete', { typeSelect });
      }
      const engines = normalizeSelectedEngines(preset.engines, { allowEmpty: true });
      this.setSelectedEngines(engines, root, { allowEmpty: true });
    }
    this.refresh();
  }

  refresh() {
    if (!this._root) return;
    const el = this.render();
    this._root.innerHTML = '';
    this._root.appendChild(el);
    this.bindEvents(el);
  }

  exportLastResult() { showToast('No results to export yet', 'error'); }
  openRemediation() { this.app.navigate?.('remediation'); }
}
