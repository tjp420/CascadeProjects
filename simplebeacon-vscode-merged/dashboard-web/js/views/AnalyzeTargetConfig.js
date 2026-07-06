import { escapeHtml, apiUrl, showToast } from '../utils.js';
import { pathInputListAttr, renderPathSuggestionsDatalistElement, collectPathSuggestions } from '../lib/analyzePathSuggestions.js';
import { authService } from '../services/authService.js';

/**
 * AnalyzeTargetConfig — Target selection, drag-and-drop, path input,
 * server directory browser, and VS Code: extension card.
 */
export class AnalyzeTargetConfig {
  constructor(view) {
    this.view = view;
  }

  /* ---- v3 Target Card ---- */

  render(defaultPath, displayPath) {
    const isWeb = this.view.websiteMode;
    const useDefaultHidden = defaultPath && !isWeb ? '' : 'hidden';
    const pathPlaceholder = isWeb
      ? 'https://example.com'
      : 'C:\\\\dev\\\\my-app · git@github.com:org/repo · https://codeberg.org/org/repo';
    const pathList = isWeb ? '' : pathInputListAttr();
    const datalist = isWeb ? '' : renderPathSuggestionsDatalistElement(collectPathSuggestions(this.view.app, this.view.testSources));

    return `
      <style>
        .an-tgt-v3 { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; }
        [data-theme='light'] .an-tgt-v3 { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .an-tgt-v3-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .an-tgt-v3-hd h3 { margin:0; font-size:1rem; font-weight:700; }
        .an-tgt-v3-bd { padding:22px; }
        .an-tgt-drop { border:2px dashed rgba(148,163,184,0.18); border-radius:20px; background:linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.3)); padding:40px 28px; text-align:center; transition:all .25s cubic-bezier(0.16,1,0.3,1); position:relative; overflow:hidden; }
        .an-tgt-drop::before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08), transparent 60%); opacity:0; transition:opacity .3s ease; pointer-events:none; }
        .an-tgt-drop.drag-active { border-color:var(--accent); background:linear-gradient(145deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04)); transform:scale(1.01); }
        .an-tgt-drop.drag-active::before { opacity:1; }
        .an-tgt-drop-icon { width:64px; height:64px; border-radius:18px; background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1)); color:var(--accent); display:inline-flex; align-items:center; justify-content:center; font-size:1.5rem; margin-bottom:18px; box-shadow:0 4px 16px rgba(99,102,241,0.15); transition:transform .3s ease,box-shadow .3s ease; }
        .an-tgt-drop.drag-active .an-tgt-drop-icon { transform:translateY(-4px); box-shadow:0 8px 24px rgba(99,102,241,0.25); }
        .an-tgt-drop h4 { margin:0 0 8px; font-size:1.05rem; font-weight:700; color:var(--text-primary); letter-spacing:-0.01em; }
        .an-tgt-drop p { margin:0 0 22px; font-size:0.85rem; color:var(--text-muted); line-height:1.5; }
        .an-tgt-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
        .an-tgt-actions .btn { min-width:120px; }
        .an-tgt-format-tags { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:18px; }
        .an-tgt-format-tag { font-size:0.7rem; font-weight:500; padding:4px 10px; border-radius:20px; background:rgba(148,163,184,0.08); color:var(--text-muted); border:1px solid rgba(148,163,184,0.1); }
        .an-tgt-path { display:flex; gap:8px; align-items:center; margin-top:18px; }
        .an-tgt-path input { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 14px; color:var(--text-primary); font-size:0.85rem; transition:border-color .2s,box-shadow .2s; }
        .an-tgt-path input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .an-tgt-hint { text-align:center; font-size:0.72rem; color:var(--text-muted); margin-top:8px; }
      </style>

      <div class="an-tgt-v3" id="analyze-target-card">
        <div class="an-tgt-v3-hd">
          <h3>🎯 Target</h3>
          <div>
            <button type="button" class="btn btn-ghost btn-sm" id="use-default-path-btn" ${useDefaultHidden}>Use default</button>
            <button type="button" class="btn btn-ghost btn-sm" id="browse-server-dirs-btn">Browse</button>
          </div>
        </div>
        <div class="an-tgt-v3-bd">
          <div class="an-tgt-drop" id="analyze-drop-zone">
            <div class="an-tgt-drop-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <h4>Drop files to analyze</h4>
            <p>Drag & drop a scan report, source file, or ZIP bundle here</p>
            <div class="an-tgt-actions">
              <button type="button" class="btn btn-primary btn-sm" id="analyze-select-file-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Select File
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="quick-file-scan-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
                Quick Scan
              </button>
            </div>
            <div class="an-tgt-format-tags">
              <span class="an-tgt-format-tag">.json</span>
              <span class="an-tgt-format-tag">.zip</span>
              <span class="an-tgt-format-tag">.js / .ts</span>
              <span class="an-tgt-format-tag">.py</span>
              <span class="an-tgt-format-tag">.md</span>
            </div>
          </div>
          <div class="an-tgt-path">
            <input id="project-path-input" list="${pathList}" placeholder="${escapeHtml(pathPlaceholder)}" value="${escapeHtml(displayPath)}" aria-label="Project path">
            ${datalist}
            <button type="button" class="btn btn-primary" id="analyze-path-run-btn">Run</button>
          </div>
          <div class="an-tgt-hint">Accepts local paths, Git URLs, or web URLs</div>
        </div>
      </div>
    `;
  }

  /* ---- Quick Actions Card ---- */

  renderQuickActions() {
    const hasResult = Boolean(this.view.lastResult);
    const pathInput = this.view._root?.querySelector('#project-path-input');
    const projectPath = this.view.getActiveProjectPath(pathInput?.value);
    const canRun = Boolean(projectPath) && !this.view.busy;
    return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px;padding:14px 18px;background:linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.4));border:1px solid rgba(148,163,184,0.08);border-radius:16px;">
        <button type="button" class="btn btn-primary btn-sm" id="quick-action-run-btn" ${canRun ? '' : 'disabled'} title="Run analysis on the current path">▶️ Run Scan</button>
        <button type="button" class="btn btn-secondary btn-sm" id="quick-action-results-btn" ${hasResult ? '' : 'disabled'} title="Open results view">📊 Results</button>
        ${authService.isPaidTier() ? `<button type="button" class="btn btn-secondary btn-sm" id="quick-action-export-btn" ${hasResult ? '' : 'disabled'} title="Export scan report">📥 Export</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="quick-action-remediation-btn" ${hasResult ? '' : 'disabled'} title="Open remediation roadmap">🗺️ Remediate</button>
      </div>
    `;
  }

  /* ---- VS Code: Extension Card ---- */

  renderVscodeCard() {
    const hasVsCodeApi = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
    const inVsCodeHost = typeof window !== 'undefined' && (
      /vscode|electron/i.test(navigator.userAgent) ||
      /vscode-webview/i.test(navigator.userAgent)
    );
    const inVsCode = hasVsCodeApi || inVsCodeHost;
    const badge = inVsCode
      ? `<span class="db-v3-panel-badge" style="background:rgba(34,197,94,0.15);color:#4ade80;">● Active</span>`
      : `<a href="https://marketplace.visualstudio.com/items?itemName=SimpleBeacon.simplebeacon-vscode" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="flex-shrink:0;">Install</a>`;
    const subtitle = inVsCode
      ? 'Extension is running. Real-time monitoring, AI analysis, and remediation guide are active.'
      : 'Real-time file monitoring, enhanced AI analysis, code map, and remediation guide — directly in your editor.';
    const syncBtn = hasVsCodeApi
      ? `<button type="button" class="btn btn-ghost btn-sm" id="vscode-sync-report-btn" style="flex-shrink:0;margin-left:8px;font-size:0.75rem;" title="Push current scan report to the sidebar">🔄 Sync</button>`
      : '';

    return `
      <div style="margin-top:14px;padding:18px 22px;background:linear-gradient(135deg,rgba(99,102,241,0.08) 0%,rgba(139,92,246,0.04) 100%);border:1px solid rgba(99,102,241,0.12);border-radius:16px;">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="flex-shrink:0;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.25rem;">VS</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <h4 style="margin:0;font-size:0.95rem;font-weight:700;">VS Code: Extension</h4>
              <div style="display:flex;align-items:center;">${badge}${syncBtn}</div>
            </div>
            <p style="margin:6px 0 0;font-size:0.78rem;color:var(--text-muted);line-height:1.4;">${escapeHtml(subtitle)}</p>
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Directory Browser Modal ---- */

  renderDirBrowserModal() {
    return `
      <div class="modal-overlay hidden" id="dir-browser-modal" aria-hidden="true">
        <div class="modal-card dir-browser-modal">
          <div class="modal-header">
            <h2>📁 Browse server directories</h2>
          </div>
          <div class="modal-body">
            <div class="dir-browser-path" id="dir-browser-current-path"></div>
            <div class="dir-browser-list" id="dir-browser-list">
              <div class="dir-browser-empty">Loading directories…</div>
            </div>
            <div class="dir-browser-actions">
              <button type="button" class="btn btn-ghost btn-sm" id="dir-browser-up-btn">⬆ Up</button>
              <button type="button" class="btn btn-primary btn-sm" id="dir-browser-select-btn">Select folder</button>
              <button type="button" class="btn btn-secondary btn-sm" id="dir-browser-close-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Bind events ---- */

  bindEvents(root) {
    // Drag-and-drop
    const dropZone = root.querySelector('#analyze-drop-zone');
    if (dropZone) {
      let dragDepth = 0;
      dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth++;
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drag-active');
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth--;
        if (dragDepth <= 0) {
          dropZone.classList.remove('drag-active');
          dragDepth = 0;
        }
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth = 0;
        dropZone.classList.remove('drag-active');
        const dt = e.dataTransfer;
        if (!dt) return;
        // 1. Check for directory first (before files, since browsers populate files recursively for dir drops)
        if (dt.items && dt.items.length > 0) {
          const item = dt.items[0];
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry && entry.isDirectory) {
              const pathInput = document.getElementById('project-path-input');
              const droppedFile = item.getAsFile ? item.getAsFile() : null;
              let actualPath = droppedFile && (droppedFile.path || droppedFile.webkitRelativePath) ? (droppedFile.path || droppedFile.webkitRelativePath) : null;
              // Fallback: derive the directory root from the first dropped file's absolute path
              if (!actualPath && dt.files && dt.files[0] && dt.files[0].path) {
                const firstFilePath = dt.files[0].path;
                const entryFullPath = (entry.fullPath || entry.name || '').replace(/^\//, '').replace(/\//g, '\\');
                if (entryFullPath) {
                  const idx = firstFilePath.toLowerCase().indexOf(entryFullPath.toLowerCase());
                  if (idx > 0) {
                    actualPath = firstFilePath.slice(0, idx + entryFullPath.length);
                  }
                }
              }
              // Fallback: use a file:// URI if the browser exposed one for the directory
              if (!actualPath) {
                const uri = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain');
                if (uri) {
                  const fileMatch = uri.match(/^file:\/\/\/([A-Za-z]:\/.*)$/);
                  if (fileMatch) {
                    actualPath = decodeURIComponent(fileMatch[1]).replace(/\//g, '\\').replace(/[\\\/]+$/, '');
                  }
                }
              }
              const relativePath = (entry.fullPath || entry.name || '').replace(/^\//, '');
              const defaultPath = this.view.app.state.defaultProjectPath || '';
              const isVsCode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
              if (actualPath) {
                if (pathInput) { pathInput.value = actualPath; }
                this.view.runAnalysisFromPath();
                return;
              }
              if (isVsCode && defaultPath) {
                const resolvedPath = (defaultPath.replace(/\\/g, '/') + '/' + relativePath).replace(/\//g, '\\');
                if (pathInput) { pathInput.value = resolvedPath; }
                this.view.runAnalysisFromPath();
                return;
              }
              // External browsers cannot reveal the absolute path of a dropped folder.
              // Ask the server to resolve the folder name to a real absolute path.
              const fallbackPath = relativePath || entry.name || '';
              try {
                const folderName = entry.name || fallbackPath;
                const res = await fetch(apiUrl('/api/analyze/resolve-folder-name') + '?folderName=' + encodeURIComponent(folderName) + '&hintPath=' + encodeURIComponent(defaultPath));
                const data = await res.json();
                if (data.success && data.path) {
                  if (pathInput) { pathInput.value = data.path; }
                  showToast(`Resolved to ${data.path}`, 'info');
                  this.view.runAnalysisFromPath();
                  return;
                }
              } catch (err) {
                console.warn('[AnalyzeTargetConfig] Failed to resolve folder name:', err);
              }
              if (pathInput) { pathInput.value = fallbackPath; }
              showToast(`Directory "${fallbackPath}" dropped. Verify the path and click Analyze.`, 'info');
              return;
            }
          }
        }
        // 2. Try files
        const file = dt.files?.[0];
        if (file) { this.view.handleDroppedFile(file); return; }
        // 3. Try text/uri-list for file:// or http:// drops
        const uri = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain');
        if (uri) {
          const fileMatch = uri.match(/^file:\/\/\/([A-Za-z]:\/.*)$/);
          if (fileMatch) {
            const path = decodeURIComponent(fileMatch[1]).replace(/\//g, '\\').replace(/[\\\/]+$/, '');
            const pathInput = document.getElementById('project-path-input');
            if (pathInput) { pathInput.value = path; }
            this.view.runAnalysisFromPath();
            return;
          }
          const urlMatch = uri.match(/^https?:\/\/.+/);
          if (urlMatch) {
            const pathInput = document.getElementById('project-path-input');
            if (pathInput) { pathInput.value = uri; }
            this.view.runAnalysisFromPath();
            return;
          }
        }
      });
    }

    // Buttons
    root.querySelector('#analyze-select-file-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.zip,.js,.ts,.py,.env,.md,.txt';
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) this.view.handleDroppedFile(file);
      });
      input.click();
    });

    root.querySelector('#quick-file-scan-btn')?.addEventListener('click', () => this.view.runQuickFileScan());
    root.querySelector('#browse-server-dirs-btn')?.addEventListener('click', () => this.view.openDirBrowser());
    root.querySelector('#dir-browser-close-btn')?.addEventListener('click', () => this.view.closeDirBrowser());
    root.querySelector('#dir-browser-up-btn')?.addEventListener('click', () => this.view.dirBrowserUp());
    root.querySelector('#dir-browser-select-btn')?.addEventListener('click', () => this.view.dirBrowserSelect());
    root.querySelector('#use-default-path-btn')?.addEventListener('click', () => this.view.useDefaultPath());
    root.querySelector('#analyze-path-run-btn')?.addEventListener('click', () => this.view.runAnalysisFromPath());

    // Quick actions
    root.querySelector('#quick-action-run-btn')?.addEventListener('click', () => this.view.runAnalysisFromPath());
    root.querySelector('#quick-action-results-btn')?.addEventListener('click', () => this.view.showResults());
    root.querySelector('#quick-action-export-btn')?.addEventListener('click', () => this.view.exportLastResult());
    root.querySelector('#quick-action-remediation-btn')?.addEventListener('click', () => this.view.openRemediation());
  }
}
