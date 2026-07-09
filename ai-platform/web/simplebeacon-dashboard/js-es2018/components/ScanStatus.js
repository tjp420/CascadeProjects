import { escapeHtml, formatPercent } from '../utils.js';
import { resolveDisplayScore, formatScanScopeSummary, formatScanInventoryNote } from '../services/analyzeService.js';
import { runLocalScan } from '../services/localScanService.js';
/**
 * Resolve initial scan root.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function resolveInitialScanRoot(report, { lastProjectPath } = {}) {
    return lastProjectPath || (report === null || report === void 0 ? void 0 : report.projectRoot) || (report === null || report === void 0 ? void 0 : report.platformRoot) || '';
}
/**
 * Resolve scan root from input.
 * @param {any} input
 * @param {Object} options
 * @returns {any}
 */
function resolveScanRootFromInput(input, { lastProjectPath } = {}) {
    const trimmed = String((input === null || input === void 0 ? void 0 : input.value) || '').trim();
    if (trimmed && !trimmed.startsWith('…'))
        return trimmed;
    if (lastProjectPath)
        return lastProjectPath;
    return '';
}
/** Shared path resolution for Dashboard scan controls (Scan button + Quick Actions). */
export function resolveDashboardScanPath(input, { lastProjectPath } = {}) {
    return resolveScanRootFromInput(input, { lastProjectPath });
}
/**
 * Run dashboard scan from input.
 * @param {any} input
 * @param {Object} options
 * @returns {any}
 */
export function runDashboardScanFromInput(input, options = {}) {
    const { onRescan, getLastProjectPath = () => '', setLastProjectPath = () => { }, getDefaultProjectPath = () => '' } = options;
    if (!onRescan)
        return;
    let path = resolveScanRootFromInput(input, {
        lastProjectPath: getLastProjectPath()
    });
    if (!path) {
        path = getDefaultProjectPath();
    }
    if (!path) {
        onRescan(undefined);
        return;
    }
    // Dropped/browsed folders without a full OS path come through as bare folder names.
    // The dashboard scan needs an absolute local path or a remote repo URL.
    const isAbsoluteLocal = /^[a-zA-Z]:[\\/]|^\\|^\//.test(path);
    const isRemoteUrl = /^https?:\/\//i.test(path);
    if (!isAbsoluteLocal && !isRemoteUrl) {
        const toast = document.getElementById('toast-container');
        if (toast) {
            const msg = document.createElement('div');
            msg.className = 'toast toast-warning';
            msg.textContent = `"${path}" is not a full path. Type the absolute path (e.g., J:/Mag Motor 3D Print Files) or use Browse, then click Scan.`;
            toast.appendChild(msg);
            setTimeout(() => msg.remove(), 6000);
        }
        return;
    }
    setLastProjectPath(path);
    onRescan(path);
}
/**
 * Format scan path display.
 * @param {string} path
 * @returns {any}
 */
function formatScanPathDisplay(path) {
    if (!path)
        return '';
    return String(path).replace(/\\/g, '\\');
}
/**
 * Format freshness warning from scan metadata.
 * @param {any} report
 * @returns {string|null}
 */
function formatFreshnessWarning(report) {
    if (!report)
        return null;
    const cacheHit = report.cacheHit === true;
    const cacheAgeMs = typeof report.cacheAgeMs === 'number' ? report.cacheAgeMs : null;
    const generatedAt = report.generatedAt ? new Date(report.generatedAt).getTime() : null;
    const now = Date.now();
    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
    let ageMs = null;
    if (cacheHit && cacheAgeMs != null) {
        ageMs = cacheAgeMs;
    }
    else if (generatedAt) {
        ageMs = now - generatedAt;
    }
    if (ageMs == null)
        return null;
    if (ageMs < STALE_THRESHOLD_MS)
        return null;
    const mins = Math.round(ageMs / 60 / 1000);
    const hours = Math.round(ageMs / 60 / 60 / 1000);
    const ageLabel = hours >= 1 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${mins} minute${mins > 1 ? 's' : ''}`;
    const reason = cacheHit ? 'cached' : 'old';
    return `Report is ${ageLabel} ${reason} — re-scan for current findings.`;
}
/**
 * Render scan path controls.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function renderScanPathControls(report, options = {}) {
    const { config, lastProjectPath, scanning, defaultProjectPath } = options;
    const scanPaths = (config === null || config === void 0 ? void 0 : config.scanPaths) || (report === null || report === void 0 ? void 0 : report.scanPaths) || [];
    const pathCount = scanPaths.length;
    const hasSaved = Boolean(lastProjectPath);
    const hasDefault = Boolean(defaultProjectPath);
    const resolvedPath = lastProjectPath || defaultProjectPath || '';
    return `
    <div class="scan-status-scope" id="scan-status-scope">
      <div class="analyze-drag-overlay" id="scan-drag-overlay">
        <div class="analyze-drag-overlay-icon">📂</div>
        <strong>Drop folder to scan</strong>
      </div>
      <div class="scan-status-path-row">
        <div class="scan-status-path-input-wrap">
          <i data-lucide="folder" class="icon-16 scan-status-path-icon"></i>
          <input
            type="text"
            id="scan-root-input"
            class="scan-status-path-input"
            placeholder="e.g. C:\\dev\\my-app"
            spellcheck="false"
            autocomplete="off"
            aria-label="Folder path on the dashboard server"
            value="${escapeHtml(resolvedPath)}"
            ${scanning ? 'disabled' : ''}
          >
        </div>
        <input type="file" id="scan-browse-input" webkitdirectory directory hidden aria-label="Select folder to scan">
        <button type="button" class="btn btn-ghost btn-sm" id="scan-browse-btn" ${scanning ? 'disabled' : ''} title="Browse for folder" aria-label="Browse for folder to scan" aria-controls="scan-browse-input">
          <i data-lucide="folder-open" class="icon-16"></i> Browse
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="scan-set-default-btn" ${!hasDefault || scanning ? 'disabled' : ''} title="Reset to default path">
          <i data-lucide="rotate-ccw" class="icon-16"></i> Reset
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="scan-clear-btn" ${!hasSaved || scanning ? 'disabled' : ''} title="Clear saved folder">
          <i data-lucide="x" class="icon-16"></i> Clear
        </button>
        <button type="button" class="btn btn-primary" id="rescan-btn" ${scanning ? 'disabled' : ''} title="Run gate scan on this folder">
          ${scanning ? '<span class="loading-spinner"></span> Scanning…' : '<i data-lucide="play" class="icon-16"></i> Scan'}
        </button>
      </div>
      <p class="scan-status-scope-hint text-muted">
        Deep analysis → <a href="/dashboard/analyze" class="scan-status-link">Analyze</a> ·
        Mock folders → <a href="/dashboard/settings" class="scan-status-link">Settings → Scan paths</a>${pathCount ? ` (${pathCount})` : ''}
      </p>
    </div>
  `;
}
/**
 * Render scan status.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function renderScanStatus(report, options = {}) {
    const { scanning = false, config } = options;
    const gate = (report === null || report === void 0 ? void 0 : report.gate) || {};
    const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
    const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
    const inventoryNote = formatScanInventoryNote(report);
    const scope = formatScanScopeSummary(report);
    const score = formatPercent(resolveDisplayScore(report));
    const freshness = formatFreshnessWarning(report);
    return `
    <div class="card dashboard-scan-card">
      <div class="dashboard-scan-header">
        <div class="dashboard-scan-meta">
          <div class="dashboard-scan-title">Last scan</div>
          <div class="dashboard-scan-time">${escapeHtml((report === null || report === void 0 ? void 0 : report.generatedAt) ? new Date(report.generatedAt).toLocaleString() : 'No scan yet')}</div>
          ${freshness ? `<div class="dashboard-scan-freshness">${escapeHtml(freshness)}</div>` : ''}
        </div>
        <span class="dashboard-scan-badge ${gateClass}">${gateLabel}</span>
      </div>
      <div class="dashboard-scan-body">
        <div class="dashboard-scan-metrics">
          <div class="dashboard-scan-metric">
            <span class="dashboard-scan-metric-value">${scope ? escapeHtml(scope) : '—'}</span>
          </div>
          <div class="dashboard-scan-metric">
            <span class="dashboard-scan-metric-label">Consistency</span>
            <span class="dashboard-scan-metric-value">${score}</span>
          </div>
        </div>
        ${inventoryNote ? `<div class="dashboard-scan-inventory">${escapeHtml(inventoryNote)}</div>` : ''}
      </div>
      ${renderScanPathControls(report, { ...options, config, scanning })}
    </div>
  `;
}
/** Surgically update an existing scan card without replacing innerHTML — prevents flicker. */
export function updateScanStatusDom(root, report) {
    if (!root)
        return false;
    const card = root.querySelector('.dashboard-scan-card');
    if (!card)
        return false;
    const gate = (report === null || report === void 0 ? void 0 : report.gate) || {};
    const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
    const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
    const inventoryNote = formatScanInventoryNote(report);
    const scope = formatScanScopeSummary(report);
    const score = formatPercent(resolveDisplayScore(report));
    const timeText = (report === null || report === void 0 ? void 0 : report.generatedAt) ? new Date(report.generatedAt).toLocaleString() : 'No scan yet';
    // Update badge
    const badge = card.querySelector('.dashboard-scan-badge');
    if (badge) {
        const nextClass = `dashboard-scan-badge ${gateClass}`;
        if (badge.className !== nextClass)
            badge.className = nextClass;
        if (badge.textContent !== gateLabel)
            badge.textContent = gateLabel;
    }
    // Update time
    const timeEl = card.querySelector('.dashboard-scan-time');
    if (timeEl && timeEl.textContent !== timeText)
        timeEl.textContent = timeText;
    // Update freshness warning
    const freshnessText = formatFreshnessWarning(report);
    const freshnessEl = card.querySelector('.dashboard-scan-freshness');
    if (freshnessText) {
        if (freshnessEl) {
            if (freshnessEl.textContent !== freshnessText)
                freshnessEl.textContent = freshnessText;
        }
        else {
            const meta = card.querySelector('.dashboard-scan-meta');
            if (meta) {
                const div = document.createElement('div');
                div.className = 'dashboard-scan-freshness';
                div.textContent = freshnessText;
                meta.appendChild(div);
            }
        }
    }
    else if (freshnessEl) {
        freshnessEl.remove();
    }
    // Update scope metric
    const scopeEl = card.querySelector('.dashboard-scan-metric:first-child .dashboard-scan-metric-value');
    if (scopeEl) {
        const scopeDisplay = scope ? escapeHtml(scope) : '—';
        if (scopeEl.textContent !== scopeDisplay)
            scopeEl.textContent = scopeDisplay;
    }
    // Update consistency score
    const scoreEl = card.querySelector('.dashboard-scan-metric:last-child .dashboard-scan-metric-value');
    if (scoreEl && scoreEl.textContent !== score)
        scoreEl.textContent = score;
    // Update inventory note
    const invEl = card.querySelector('.dashboard-scan-inventory');
    if (inventoryNote) {
        if (invEl) {
            if (invEl.textContent !== inventoryNote)
                invEl.textContent = inventoryNote;
        }
        else {
            const body = card.querySelector('.dashboard-scan-body');
            if (body) {
                const div = document.createElement('div');
                div.className = 'dashboard-scan-inventory';
                div.textContent = inventoryNote;
                body.appendChild(div);
            }
        }
    }
    else if (invEl) {
        invEl.remove();
    }
    return true;
}
/**
 * Bind scan status.
 * @param {any} container
 * @param {Object} options
 * @returns {any}
 */
export function bindScanStatus(container, options = {}) {
    var _a, _b;
    const { onRescan, onLocalScanResult, getLastProjectPath = () => '', setLastProjectPath = () => { }, getDefaultProjectPath = () => '' } = options;
    const input = container.querySelector('#scan-root-input');
    const clearBtn = container.querySelector('#scan-clear-btn');
    const setDefaultBtn = container.querySelector('#scan-set-default-btn');
    const scanBtn = container.querySelector('#rescan-btn');
    const browseBtn = container.querySelector('#scan-browse-btn');
    const browseInput = container.querySelector('#scan-browse-input');
    // Restore input value from state if empty (e.g. after full re-render)
    if (input && !input.value.trim()) {
        const fallbackPath = getLastProjectPath() || getDefaultProjectPath() || '';
        if (fallbackPath)
            input.value = fallbackPath;
    }
    /**
     * Run scan.
     * @returns {any}
     */
    const runScan = () => runDashboardScanFromInput(input, options);
    /**
     * Extract the absolute folder path from a drop event using every available source.
     * Browsers may expose the path via file.path, text/uri-list, text/plain, etc.
     * @param {DragEvent} event
     * @param {string} folderName
     * @returns {string}
     */
    function extractAbsoluteDroppedFolderPath(event, folderName) {
        var _a, _b;
        const dt = event.dataTransfer;
        if (!dt)
            return '';
        // 1. text/uri-list often contains file:///C:/Users/... from Windows File Explorer
        const uriList = dt.getData('text/uri-list') || '';
        const uriLines = uriList.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
        for (const line of uriLines) {
            try {
                const url = new URL(line);
                if (url.protocol === 'file:') {
                    const decoded = decodeURIComponent(url.pathname.replace(/^\//, '').replace(/\//g, '\\'));
                    const normalized = decoded.replace(/\\/g, '/');
                    if (folderName && normalized.endsWith(`/${folderName}`)) {
                        return normalized;
                    }
                    if (folderName && normalized.split('/').pop() === folderName) {
                        return normalized;
                    }
                }
            }
            catch { /* ignore malformed URI */ }
        }
        // 2. text/plain may contain a raw Windows or Unix path
        const plain = dt.getData('text/plain') || '';
        const plainTrimmed = plain.trim();
        if (plainTrimmed) {
            const normalizedPlain = plainTrimmed.replace(/\\/g, '/');
            if (/^[a-zA-Z]:|^\\|^\//.test(normalizedPlain)) {
                if (folderName && (normalizedPlain.endsWith(`/${folderName}`) || normalizedPlain.split('/').pop() === folderName)) {
                    return normalizedPlain;
                }
            }
        }
        // 3. Files custom format used by some Windows drag sources
        const filesData = dt.getData('Files') || '';
        const filesLines = filesData.split(/\r?\n/).filter(Boolean);
        for (const line of filesLines) {
            const normalized = line.replace(/\\/g, '/');
            if (/^[a-zA-Z]:|^\\|^\//.test(normalized)) {
                if (folderName && (normalized.endsWith(`/${folderName}`) || normalized.split('/').pop() === folderName)) {
                    return normalized;
                }
            }
        }
        // 4. First dropped File object may expose .path (Chrome/Edge on Windows)
        const files = (_b = (_a = dt) === null || _a === void 0 ? void 0 : _a.files) !== null && _b !== void 0 ? _b : null;
        if (files?.length) {
            const firstFile = files[0];
            const filePath = firstFile.path;
            const relPath = firstFile.webkitRelativePath || '';
            if (filePath && relPath) {
                const normalizedFull = filePath.replace(/\\/g, '/');
                const normalizedRel = relPath.replace(/\\/g, '/');
                if (normalizedFull.endsWith(normalizedRel)) {
                    const baseDir = normalizedFull.slice(0, -normalizedRel.length).replace(/\/$/, '');
                    const relFolderName = normalizedRel.split('/')[0] || folderName;
                    return baseDir ? `${baseDir}/${relFolderName}` : relFolderName;
                }
            }
        }
        return '';
    }
    /**
     * Recursively collect File objects from a legacy FileSystemDirectoryEntry.
     * Used as a fallback when getAsFileSystemHandle is unavailable.
     * @param {FileSystemDirectoryEntry} entry
     * @returns {Promise<File[]>}
     */
    function collectFilesFromDirectoryEntry(entry) {
        return new Promise((resolve, reject) => {
            const files = [];
            const reader = entry.createReader();
            function readBatch() {
                reader.readEntries((entries) => {
                    if (!entries.length) {
                        resolve(files);
                        return;
                    }
                    const promises = entries.map((child) => {
                        if (child.isFile) {
                            return new Promise((res) => child.file((file) => res(file)));
                        }
                        if (child.isDirectory) {
                            return collectFilesFromDirectoryEntry(child);
                        }
                        return Promise.resolve([]);
                    });
                    Promise.all(promises).then((results) => {
                        results.forEach((r) => {
                            if (Array.isArray(r))
                                files.push(...r);
                            else if (r)
                                files.push(r);
                        });
                        readBatch();
                    }).catch(reject);
                }, reject);
            }
            readBatch();
        });
    }
    // Derive a sensible home base for path fallbacks (e.g. C:/Users/Trevor)
    /**
     * Derive user home base.
     * @returns {any}
     */
    function deriveUserHomeBase() {
        const defaultPath = getDefaultProjectPath() || getLastProjectPath() || '';
        const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
        if (defaultPath) {
            // Strip trailing segments to get a reasonable base (e.g. .../ai-platform -> parent)
            const normalized = defaultPath.replace(/\\/g, '/');
            const isUnixAbsolute = normalized.startsWith('/');
            // On Windows, never use a Linux server path like /opt/render/... as the fallback base.
            if (isWindowsClient && isUnixAbsolute) {
                const driveMatch = String(getLastProjectPath() || '').match(/^([a-zA-Z]:)/);
                return driveMatch ? `${driveMatch[1]}/Users` : '';
            }
            const parts = normalized.split('/').filter(Boolean);
            // If last part looks like a server subfolder, remove it
            if (parts.length > 1 && /^(ai-platform|server|app|src|dist|build)$/i.test(parts[parts.length - 1])) {
                parts.pop();
            }
            if (parts.length > 0) {
                // On Windows: if parts start with C: and Users, keep up to the user folder
                if (parts[0].endsWith(':')) {
                    return parts.slice(0, 3).join('/'); // e.g. C:/Users/Trevor
                }
                const base = parts.join('/');
                // Preserve leading slash for Unix absolute paths so the fallback stays absolute.
                return isUnixAbsolute ? `/${base}` : base;
            }
        }
        // No reliable base is known; don't fabricate a path that will likely be wrong.
        return '';
    }
    scanBtn === null || scanBtn === void 0 ? void 0 : scanBtn.addEventListener('click', runScan);
    // Hidden file input for webkitdirectory fallback
    browseInput === null || browseInput === void 0 ? void 0 : browseInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
        // In Electron / Tauri the file objects expose the absolute filesystem path.
        const filePath = files[0].path;
        const relPath = files[0].webkitRelativePath || '';
        if (filePath && relPath) {
            const normalizedFull = filePath.replace(/\\/g, '/');
            const normalizedRel = relPath.replace(/\\/g, '/');
            if (normalizedFull.endsWith(normalizedRel)) {
                const baseDir = normalizedFull.slice(0, -normalizedRel.length).replace(/\/$/, '');
                const folderName = normalizedRel.split('/')[0] || '';
                const resolvedPath = baseDir ? `${baseDir}/${folderName}` : folderName;
                if (input) {
                    input.value = resolvedPath;
                    setLastProjectPath(resolvedPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
                const toast = document.getElementById('toast-container');
                if (toast) {
                    const msg = document.createElement('div');
                    msg.className = 'toast toast-info';
                    msg.textContent = `Folder "${folderName}" selected.`;
                    toast.appendChild(msg);
                    setTimeout(() => msg.remove(), 4000);
                }
                browseInput.value = '';
                return;
            }
        }
        // Standard browser fallback — no absolute path available.
        const firstPath = files[0].webkitRelativePath || files[0].name || '';
        const folderName = firstPath.split('/')[0] || firstPath;
        const homePath = deriveUserHomeBase();
        const resolvedPath = homePath ? `${homePath}/${folderName}` : folderName;
        if (input) {
            input.value = resolvedPath;
            setLastProjectPath(resolvedPath);
            if (clearBtn)
                clearBtn.disabled = false;
        }
        const toast = document.getElementById('toast-container');
        if (toast) {
            const msg = document.createElement('div');
            msg.className = 'toast toast-info';
            msg.textContent = homePath
                ? `Folder "${folderName}" selected. Path is estimated — please verify before scanning.`
                : `Folder "${folderName}" selected — browser cannot reveal its full path. Type or browse the full path before scanning.`;
            toast.appendChild(msg);
            setTimeout(() => msg.remove(), 4000);
        }
        browseInput.value = '';
    });
    // Detect environments (e.g. Electron) where file inputs expose real absolute paths.
    const isElectronLike = Boolean(typeof window !== 'undefined' &&
        (((_b = (_a = window.process) === null || _a === void 0 ? void 0 : _a.versions) === null || _b === void 0 ? void 0 : _b.electron) || /Electron/.test(navigator.userAgent)));
    // Browse button — use File System Access API when available, fall back to hidden file input
    browseBtn === null || browseBtn === void 0 ? void 0 : browseBtn.addEventListener('click', async () => {
        // In Electron-like environments skip showDirectoryPicker because it cannot
        // reveal absolute paths; the webkitdirectory fallback gives files with .path.
        if (window.showDirectoryPicker && !isElectronLike) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                const folderName = dirHandle.name || '';
                const homePath = deriveUserHomeBase();
                const fallbackPath = homePath ? `${homePath}/${folderName}` : folderName;
                if (input) {
                    input.value = fallbackPath;
                    setLastProjectPath(fallbackPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
                const toast = document.getElementById('toast-container');
                if (toast) {
                    const msg = document.createElement('div');
                    msg.className = 'toast toast-info';
                    msg.textContent = homePath
                        ? `Folder "${folderName}" selected. Path is estimated — please verify before scanning.`
                        : `Folder "${folderName}" selected — browser cannot reveal its full path. Type or browse the full path before scanning.`;
                    toast.appendChild(msg);
                    setTimeout(() => msg.remove(), 4000);
                }
                return;
            }
            catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('[ScanStatus] Directory picker failed:', err);
                }
                // Fall through to file input fallback
            }
        }
        // Fallback: use hidden webkitdirectory input to open native folder picker
        if (browseInput) {
            browseInput.click();
        }
    });
    clearBtn === null || clearBtn === void 0 ? void 0 : clearBtn.addEventListener('click', () => {
        if (!input)
            return;
        input.value = '';
        setLastProjectPath('');
        clearBtn.disabled = true;
        input.focus();
    });
    setDefaultBtn === null || setDefaultBtn === void 0 ? void 0 : setDefaultBtn.addEventListener('click', () => {
        if (!input)
            return;
        const defaultPath = getDefaultProjectPath();
        input.value = defaultPath;
        setLastProjectPath(defaultPath);
        if (clearBtn)
            clearBtn.disabled = !defaultPath;
        input.focus();
    });
    input === null || input === void 0 ? void 0 : input.addEventListener('input', () => {
        const value = input.value.trim();
        setLastProjectPath(value || '');
        if (clearBtn)
            clearBtn.disabled = !value;
    });
    input === null || input === void 0 ? void 0 : input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            runScan();
        }
    });
    // Drag & drop on scan-status-scope
    const scope = container.querySelector('#scan-status-scope');
    const dragOverlay = container.querySelector('#scan-drag-overlay');
    if (scope && dragOverlay && input) {
        let dragDepth = 0;
        scope.addEventListener('dragenter', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dragDepth++;
            dragOverlay.classList.add('is-active');
        });
        scope.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
        });
        scope.addEventListener('dragleave', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dragDepth--;
            if (dragDepth <= 0) {
                dragOverlay.classList.remove('is-active');
                dragDepth = 0;
            }
        });
        scope.addEventListener('drop', async (event) => {
            var _a, _b, _c, _d;
            event.preventDefault();
            event.stopPropagation();
            dragDepth = 0;
            dragOverlay.classList.remove('is-active');
            const items = (_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.items;
            const files = (_b = event.dataTransfer) === null || _b === void 0 ? void 0 : _b.files;
            // Try File System API first for directory detection
            if (items === null || items === void 0 ? void 0 : items.length) {
                const entry = (_d = (_c = items[0]).webkitGetAsEntry) === null || _d === void 0 ? void 0 : _d.call(_c);
                if (entry === null || entry === void 0 ? void 0 : entry.isDirectory) {
                    const name = entry.name || '';
                    // Try every available source for the absolute OS path.
                    let resolvedPath = extractAbsoluteDroppedFolderPath(event, name);
                    if (!resolvedPath) {
                        const homePath = deriveUserHomeBase();
                        resolvedPath = homePath ? `${homePath}/${name}` : name;
                    }
                    input.value = resolvedPath;
                    setLastProjectPath(resolvedPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                    // If no absolute path was recovered, scan the dropped folder locally.
                    if (!resolvedPath.match(/^[a-zA-Z]:|^\\\\|^\//) && onLocalScanResult) {
                        // Prefer the modern File System Access API handle.
                        if (items[0].getAsFileSystemHandle) {
                            try {
                                const handle = await items[0].getAsFileSystemHandle();
                                if (handle && handle.kind === 'directory') {
                                    const toast = document.getElementById('toast-container');
                                    if (toast) {
                                        const msg = document.createElement('div');
                                        msg.className = 'toast toast-info';
                                        msg.textContent = `Scanning "${name}" locally in your browser…`;
                                        toast.appendChild(msg);
                                        setTimeout(() => msg.remove(), 4000);
                                    }
                                    const report = await runLocalScan({ dirHandle: handle, projectPath: resolvedPath });
                                    onLocalScanResult(report);
                                    return;
                                }
                            }
                            catch (err) {
                                if (err.name !== 'AbortError') {
                                    console.warn('[ScanStatus] Local scan from dropped handle failed:', err);
                                }
                            }
                        }
                        // Fallback: read files through the legacy FileSystemDirectoryEntry API.
                        try {
                            const toast = document.getElementById('toast-container');
                            if (toast) {
                                const msg = document.createElement('div');
                                msg.className = 'toast toast-info';
                                msg.textContent = `Scanning "${name}" locally in your browser…`;
                                toast.appendChild(msg);
                                setTimeout(() => msg.remove(), 4000);
                            }
                            const collectedFiles = await collectFilesFromDirectoryEntry(entry);
                            if (collectedFiles.length) {
                                const report = await runLocalScan({ files: collectedFiles, projectPath: resolvedPath });
                                onLocalScanResult(report);
                                return;
                            }
                            else {
                                const toast = document.getElementById('toast-container');
                                if (toast) {
                                    const msg = document.createElement('div');
                                    msg.className = 'toast toast-warning';
                                    msg.textContent = `Could not read any files from "${name}". The folder may be empty or permission was denied.`;
                                    toast.appendChild(msg);
                                    setTimeout(() => msg.remove(), 5000);
                                }
                            }
                        }
                        catch (err) {
                            console.warn('[ScanStatus] Local scan from dropped entry failed:', err);
                        }
                    }
                    // Notify user to verify path
                    const toast = document.getElementById('toast-container');
                    if (toast) {
                        const msg = document.createElement('div');
                        msg.className = 'toast toast-info';
                        msg.textContent = /^[a-zA-Z]:|^\\|^\//.test(resolvedPath)
                            ? `Folder "${name}" dropped. Verify the path, then click Scan.`
                            : `Folder "${name}" dropped — browser cannot reveal its full path. Type or browse the full path before scanning.`;
                        toast.appendChild(msg);
                        setTimeout(() => msg.remove(), 4000);
                    }
                    return;
                }
                if ((entry === null || entry === void 0 ? void 0 : entry.isFile) && (files === null || files === void 0 ? void 0 : files.length)) {
                    const file = files[0];
                    const path = file.path || file.name;
                    if (path) {
                        input.value = path;
                        setLastProjectPath(path);
                        if (clearBtn)
                            clearBtn.disabled = false;
                    }
                    return;
                }
            }
            // Fallback for browsers without File System API
            if (files === null || files === void 0 ? void 0 : files.length) {
                const file = files[0];
                const path = file.path || file.name;
                if (path) {
                    input.value = path;
                    setLastProjectPath(path);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
            }
        });
    }
}
