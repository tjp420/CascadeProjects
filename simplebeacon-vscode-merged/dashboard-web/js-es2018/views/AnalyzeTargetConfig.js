import { escapeHtml } from '../utils/string.js';
import { apiUrl } from '../utils/url.js';
import { showToast } from '../utils/dom.js';
import { pathInputListAttr, renderPathSuggestionsDatalistElement, collectPathSuggestions } from '../lib/analyzePathSuggestions.js';
import { authService } from '../services/authService.js';
/** One-time migration: convert old string-format sb_drop_paths to array format,
 *  and remove self-referential bogus entries (stored path equals folder name). */
(function migrateDropPaths() {
    try {
        const raw = localStorage.getItem('sb_drop_paths');
        if (!raw)
            return;
        const map = JSON.parse(raw);
        let changed = false;
        for (const key of Object.keys(map)) {
            if (typeof map[key] === 'string') {
                map[key] = [map[key]];
                changed = true;
            }
            const arr = Array.isArray(map[key]) ? map[key] : [];
            const cleaned = arr.filter((p) => p !== key && /^[a-zA-Z]:[\\/]|^\\|^\//.test(p));
            if (cleaned.length !== arr.length) {
                map[key] = cleaned;
                changed = true;
            }
            if (cleaned.length === 0) {
                delete map[key];
                changed = true;
            }
        }
        if (changed)
            localStorage.setItem('sb_drop_paths', JSON.stringify(map));
    }
    catch (_a) { /* ignore */ }
})();
/** localStorage key for the last dropped value on Analyze page input. */
const ANALYZE_DROP_KEY = 'sb_analyze_last_drop';
function setLastAnalyzeDroppedValue(v) { try { localStorage.setItem(ANALYZE_DROP_KEY, v); } catch (_a) { } }
function getLastAnalyzeDroppedValue() { try { return localStorage.getItem(ANALYZE_DROP_KEY) || ''; } catch (_a) { return ''; } }
function clearLastAnalyzeDroppedValue() { try { localStorage.removeItem(ANALYZE_DROP_KEY); } catch (_a) { } }
/** Store a resolved path keyed by folder name so future drops auto-complete. */
function rememberDroppedPath(folderName, fullPath) {
    try {
        const key = 'sb_drop_paths';
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        const existing = map[folderName];
        if (Array.isArray(existing)) {
            const filtered = existing.filter((p) => p !== fullPath);
            map[folderName] = [fullPath, ...filtered].slice(0, 5);
        }
        else if (existing && existing !== fullPath) {
            map[folderName] = [fullPath, existing];
        }
        else {
            map[folderName] = [fullPath];
        }
        localStorage.setItem(key, JSON.stringify(map));
    }
    catch (_a) { /* ignore */ }
}
/** Recall the most recent path for a folder name. */
function recallDroppedPath(folderName) {
    try {
        const map = JSON.parse(localStorage.getItem('sb_drop_paths') || '{}');
        const val = map[folderName];
        if (Array.isArray(val))
            return val[0] || '';
        return val || '';
    }
    catch (_a) {
        return '';
    }
}
/** Recall all remembered paths for a folder name. */
function recallAllDroppedPaths(folderName) {
    try {
        const map = JSON.parse(localStorage.getItem('sb_drop_paths') || '{}');
        const val = map[folderName];
        if (Array.isArray(val))
            return val;
        return val ? [val] : [];
    }
    catch (_a) {
        return [];
    }
}
/** Clear all remembered dropped paths. */
function clearAllDroppedPaths() {
    try {
        localStorage.removeItem('sb_drop_paths');
    }
    catch (_a) { /* ignore */ }
}
/** Count how many folder names are stored in path memory. */
function getSavedPathCount() {
    try {
        const map = JSON.parse(localStorage.getItem('sb_drop_paths') || '{}');
        return Object.keys(map).length;
    }
    catch (_a) {
        return 0;
    }
}
/** Show a dropdown picker below the input for disambiguating multiple remembered paths. */
function showPathPicker(scope, input, folderName, paths, onSelect) {
    const existing = scope.querySelector('.an-tgt-path-picker');
    if (existing)
        existing.remove();
    const picker = document.createElement('div');
    picker.className = 'an-tgt-path-picker';
    picker.innerHTML = `<div class="an-tgt-path-picker-hd">Multiple paths for "${escapeHtml(folderName)}"</div>` +
        paths.map((p, i) => `<button type="button" class="an-tgt-path-picker-item" data-index="${i}">${escapeHtml(p)}</button>`).join('');
    const row = scope.querySelector('.an-tgt-path');
    if (row && row.nextSibling) {
        row.parentNode.insertBefore(picker, row.nextSibling);
    }
    else if (row) {
        row.parentNode.appendChild(picker);
    }
    picker.querySelectorAll('.an-tgt-path-picker-item').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index || '0', 10);
            const selected = paths[idx];
            if (selected) {
                onSelect(selected);
                picker.remove();
                document.removeEventListener('click', dismiss);
                document.removeEventListener('keydown', keyDismiss);
            }
        });
    });
    const dismiss = (e) => {
        if (!picker.contains(e.target)) {
            picker.remove();
            document.removeEventListener('click', dismiss);
            document.removeEventListener('keydown', keyDismiss);
        }
    };
    const keyDismiss = (e) => {
        if (e.key === 'Escape') {
            picker.remove();
            document.removeEventListener('click', dismiss);
            document.removeEventListener('keydown', keyDismiss);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', dismiss);
        document.addEventListener('keydown', keyDismiss);
    }, 10);
}
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
        // Preserve user-modified or dropped value across re-renders
        const existingInput = document.getElementById('project-path-input');
        const userValue = existingInput && existingInput.dataset.userModified === 'true' ? existingInput.value : '';
        const droppedValue = getLastAnalyzeDroppedValue();
        const actualDisplayPath = droppedValue || userValue || displayPath;
        // Check if current value came from memory (for visual indicator)
        const folderNameFromValue = String(actualDisplayPath).replace(/\\/g, '/').split('/').pop() || '';
        const allRemembered = folderNameFromValue ? recallAllDroppedPaths(folderNameFromValue) : [];
        const fromMemory = allRemembered.includes(actualDisplayPath);
        const savedCount = getSavedPathCount();
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
        .an-tgt-path { display:flex; gap:8px; align-items:center; margin-top:18px; position:relative; }
        .an-tgt-path input { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 14px; color:var(--text-primary); font-size:0.85rem; transition:border-color .2s,box-shadow .2s; }
        .an-tgt-path input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .an-tgt-memory-badge { position:absolute; right:80px; top:50%; transform:translateY(-50%); font-size:0.75rem; background:rgba(99,102,241,0.12); color:var(--accent); padding:2px 8px; border-radius:10px; pointer-events:none; }
        .an-tgt-hint { text-align:center; font-size:0.72rem; color:var(--text-muted); margin-top:8px; }
        .an-tgt-path-picker { background:var(--surface); border:1px solid var(--border); border-radius:12px; margin-top:8px; overflow:hidden; }
        .an-tgt-path-picker-hd { padding:8px 12px; font-size:0.75rem; color:var(--text-muted); border-bottom:1px solid var(--border); }
        .an-tgt-path-picker-item { display:block; width:100%; text-align:left; padding:8px 12px; background:none; border:none; border-bottom:1px solid var(--border); color:var(--text-primary); font-size:0.8rem; cursor:pointer; }
        .an-tgt-path-picker-item:hover { background:rgba(99,102,241,0.08); }
        .an-tgt-path-picker-item:last-child { border-bottom:none; }
      </style>

      <div class="an-tgt-v3" id="analyze-target-card">
        <div class="an-tgt-v3-hd">
          <h3>🎯 Target</h3>
          <div>
            <button type="button" class="btn btn-ghost btn-sm" id="use-default-path-btn" ${useDefaultHidden}>Use default</button>
            <button type="button" class="btn btn-ghost btn-sm" id="browse-server-dirs-btn">Browse</button>
            <button type="button" class="btn btn-ghost btn-sm" id="clear-memory-btn" ${!savedCount ? 'disabled' : ''} title="Clear ${savedCount} saved path mapping${savedCount !== 1 ? 's' : ''}">Clear Memory</button>
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
            <input id="project-path-input" list="${pathList}" placeholder="${escapeHtml(pathPlaceholder)}" value="${escapeHtml(actualDisplayPath)}" data-user-modified="${Boolean(userValue || droppedValue) ? 'true' : ''}" data-from-memory="${fromMemory ? 'true' : ''}" aria-label="Project path">
            ${fromMemory ? `<span class="an-tgt-memory-badge" title="Auto-filled from previous scan">🧠</span>` : ''}
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
        var _a;
        const hasResult = Boolean(this.view.lastResult);
        const pathInput = (_a = this.view._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
        const projectPath = this.view.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
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
        const inVsCodeHost = typeof window !== 'undefined' && (/vscode|electron/i.test(navigator.userAgent) ||
            /vscode-webview/i.test(navigator.userAgent));
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
                if (e.dataTransfer)
                    e.dataTransfer.dropEffect = 'copy';
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
                var _a;
                e.preventDefault();
                e.stopPropagation();
                dragDepth = 0;
                dropZone.classList.remove('drag-active');
                try {
                    const dt = e.dataTransfer;
                    if (!dt) {
                        console.warn('[AnalyzeTargetConfig] drop: no dataTransfer');
                        return;
                    }
                    const pathInput = document.getElementById('project-path-input');
                    let actualPath = null;
                    let entryName = '';
                    let entryFullPath = '';
                    // 1. Try webkitGetAsEntry for directory detection
                    if (dt.items && dt.items.length > 0) {
                        const item = dt.items[0];
                        if (item.kind === 'file') {
                            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                            if (entry) {
                                entryName = entry.name || '';
                                entryFullPath = (entry.fullPath || entry.name || '').replace(/^\//, '');
                                if (entry.isDirectory) {
                                    const droppedFile = item.getAsFile ? item.getAsFile() : null;
                                    actualPath = (droppedFile && typeof droppedFile.path === 'string' && droppedFile.path.length > 0) ? droppedFile.path : null;
                                }
                            }
                        }
                    }
                    // 2. Fallback: derive directory path from dropped files (Electron/VS Code)
                    if (!actualPath && dt.files && dt.files.length > 0) {
                        const firstFile = dt.files[0];
                        if (typeof firstFile.path === 'string' && firstFile.path.length > 0) {
                            const relativePath = firstFile.webkitRelativePath || '';
                            if (relativePath) {
                                const parts = relativePath.split('/');
                                if (parts.length > 1) {
                                    entryName = parts[0];
                                    const fileName = firstFile.name || '';
                                    const lastSep = firstFile.path.lastIndexOf('\\');
                                    const fileDir = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                                    const dirIdx = fileDir.toLowerCase().lastIndexOf(parts[0].toLowerCase());
                                    if (dirIdx >= 0) {
                                        actualPath = fileDir.slice(0, dirIdx + parts[0].length);
                                    } else {
                                        actualPath = fileDir;
                                    }
                                } else {
                                    const lastSep = firstFile.path.lastIndexOf('\\');
                                    actualPath = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                                }
                            } else {
                                const lastSep = firstFile.path.lastIndexOf('\\');
                                actualPath = lastSep > 0 ? firstFile.path.slice(0, lastSep) : firstFile.path;
                            }
                        }
                    }
                    // 3. Fallback: use a file:// URI if the browser exposed one
                    if (!actualPath) {
                        const uri = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain');
                        if (uri) {
                            const fileMatch = uri.match(/^file:\/\/\/([A-Za-z]:\/.*)$/);
                            if (fileMatch) {
                                actualPath = decodeURIComponent(fileMatch[1]).replace(/\//g, '\\').replace(/[\\\/$]+$/, '');
                            }
                        }
                    }
                    // If we have an actual path, set it and run analysis
                    const defaultPath = this.view.app.state.defaultProjectPath || '';
                    const isVsCode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
                    if (actualPath) {
                        const isAbsolute = /^[a-zA-Z]:[\\/]|^\\|^\//.test(actualPath);
                        if (pathInput) {
                            pathInput.value = actualPath;
                            pathInput.dataset.userModified = 'true';
                            setLastAnalyzeDroppedValue(actualPath);
                        }
                        const folderName = entryName || String(actualPath).replace(/\\/g, '/').split('/').pop() || '';
                        if (folderName)
                            rememberDroppedPath(folderName, actualPath);
                        if (isAbsolute) {
                            this.view.runAnalysisFromPath();
                        }
                        else {
                            showToast(`Relative path "${actualPath}" needs full absolute path — please edit and click Run`, 'warning');
                        }
                        return;
                    }
                    // 4. If we have actual File objects but no real path, try path memory first.
                    if (dt.files && dt.files.length > 0) {
                        const folderName = entryName || 'dropped-directory';
                        const allPaths = recallAllDroppedPaths(folderName);
                        if (allPaths.length === 1) {
                            if (pathInput) {
                                pathInput.value = allPaths[0];
                                pathInput.dataset.userModified = 'true';
                                pathInput.dataset.fromMemory = 'true';
                                setLastAnalyzeDroppedValue(allPaths[0]);
                            }
                            showToast(`Folder "${folderName}" auto-filled from memory. Click Run to analyze.`, 'info');
                        }
                        else if (allPaths.length > 1) {
                            if (pathInput) {
                                pathInput.value = folderName;
                                pathInput.dataset.userModified = 'true';
                                setLastAnalyzeDroppedValue(folderName);
                                pathInput.focus();
                                pathInput.select();
                            }
                            showPathPicker(dropZone.closest('.an-tgt-v3') || dropZone, pathInput, folderName, allPaths, (selectedPath) => {
                                if (pathInput) {
                                    pathInput.value = selectedPath;
                                    pathInput.dataset.fromMemory = 'true';
                                    setLastAnalyzeDroppedValue(selectedPath);
                                }
                                showToast(`Selected "${selectedPath}" for "${folderName}". Click Run to analyze.`, 'info');
                            });
                            showToast(`Multiple paths found for "${folderName}" — pick one.`, 'warning');
                        }
                        else {
                            if (pathInput) {
                                pathInput.value = folderName;
                                pathInput.dataset.userModified = 'true';
                                setLastAnalyzeDroppedValue(folderName);
                                pathInput.focus();
                                pathInput.select();
                            }
                            showToast(`Scanning "${folderName}" locally (${dt.files.length} files) — browser path hidden for security. Type full path and click Run if you need a server scan.`, 'info');
                            this.view.handleDroppedDirectory(dt.files, folderName);
                        }
                        return;
                    }
                    // 5. No files and no path — populate input with a guessed path for manual Run
                    if (defaultPath && entryName) {
                        const resolvedPath = (defaultPath.replace(/\\/g, '/') + '/' + entryName).replace(/\//g, '\\');
                        this.view.app.state.lastProjectPath = resolvedPath;
                        rememberDroppedPath(entryName, resolvedPath);
                        if (pathInput) {
                            pathInput.value = resolvedPath;
                            pathInput.dataset.userModified = 'true';
                            setLastAnalyzeDroppedValue(resolvedPath);
                            pathInput.focus();
                        }
                        showToast(`Directory "${entryName}" mapped to ${resolvedPath} — verify path and click Run`, 'info');
                        return;
                    }
                    // 6. Try text/uri-list for file:// or http:// drops
                    const uri = dt.getData('text/uri-list') || dt.getData('URL') || dt.getData('text/plain');
                    if (uri) {
                        const fileMatch = uri.match(/^file:\/\/\/([A-Za-z]:\/.*)$/);
                        if (fileMatch) {
                            const path = decodeURIComponent(fileMatch[1]).replace(/\//g, '\\').replace(/[\\\/$]+$/, '');
                            if (pathInput) {
                                pathInput.value = path;
                                pathInput.dataset.userModified = 'true';
                                setLastAnalyzeDroppedValue(path);
                            }
                            this.view.runAnalysisFromPath();
                            return;
                        }
                        const urlMatch = uri.match(/^https?:\/\/.+/);
                        if (urlMatch) {
                            if (pathInput) {
                                pathInput.value = uri;
                                pathInput.dataset.userModified = 'true';
                                setLastAnalyzeDroppedValue(uri);
                            }
                            this.view.runAnalysisFromPath();
                            return;
                        }
                    }
                }
                catch (dropErr) {
                    console.error('[AnalyzeTargetConfig] drop handler error:', dropErr);
                    showToast('Drop failed: ' + (dropErr instanceof Error ? dropErr.message : String(dropErr)), 'error');
                }
            });
        }
        // Buttons
        (_a = root.querySelector('#analyze-select-file-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.zip,.js,.ts,.py,.env,.md,.txt';
            input.addEventListener('change', (e) => {
                var _a;
                const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                if (file)
                    this.view.handleDroppedFile(file);
            });
            input.click();
        });
        (_b = root.querySelector('#quick-file-scan-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => this.view.runQuickFileScan());
        (_c = root.querySelector('#browse-server-dirs-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => this.view.openDirBrowser());
        (_d = root.querySelector('#dir-browser-close-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this.view.closeDirBrowser());
        (_e = root.querySelector('#dir-browser-up-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => this.view.dirBrowserUp());
        (_f = root.querySelector('#dir-browser-select-btn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => this.view.dirBrowserSelect());
        (_g = root.querySelector('#use-default-path-btn')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', () => { clearLastAnalyzeDroppedValue(); this.view.useDefaultPath(); });
        (_h = root.querySelector('#analyze-path-run-btn')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', () => this.view.runAnalysisFromPath());
        const clearMemoryBtn = root.querySelector('#clear-memory-btn');
        if (clearMemoryBtn) {
            clearMemoryBtn.addEventListener('click', () => {
                const count = getSavedPathCount();
                if (count === 0)
                    return;
                if (!confirm(`Clear ${count} saved path mapping${count !== 1 ? 's' : ''}? This cannot be undone.`))
                    return;
                clearAllDroppedPaths();
                showToast(`Cleared ${count} saved path mapping${count !== 1 ? 's' : ''}.`, 'info');
                clearMemoryBtn.disabled = true;
            });
        }
        const pathInputEl = root.querySelector('#project-path-input');
        if (pathInputEl) {
            pathInputEl.addEventListener('input', () => {
                pathInputEl.dataset.userModified = 'true';
            });
            pathInputEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.view.runAnalysisFromPath();
                }
            });
        }
        // Quick actions
        (_j = root.querySelector('#quick-action-run-btn')) === null || _j === void 0 ? void 0 : _j.addEventListener('click', () => this.view.runAnalysisFromPath());
        (_k = root.querySelector('#quick-action-results-btn')) === null || _k === void 0 ? void 0 : _k.addEventListener('click', () => this.view.showResults());
        (_l = root.querySelector('#quick-action-export-btn')) === null || _l === void 0 ? void 0 : _l.addEventListener('click', () => this.view.exportLastResult());
        (_m = root.querySelector('#quick-action-remediation-btn')) === null || _m === void 0 ? void 0 : _m.addEventListener('click', () => this.view.openRemediation());
    }
}
export { clearLastAnalyzeDroppedValue, rememberDroppedPath };
