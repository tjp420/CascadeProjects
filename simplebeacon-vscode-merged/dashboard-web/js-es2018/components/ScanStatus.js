import { escapeHtml, formatPercent, showToast, apiUrl } from '../utils.js';
import { resolveDisplayScore, formatScanScopeSummary, formatScanInventoryNote } from '../services/analyzeService.js';
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
/** Store a resolved path keyed by folder name so future drops auto-complete.
 *  Stores as array to handle naming collisions (same folder name, different paths). */
function rememberDroppedPath(folderName, fullPath) {
    try {
        const key = 'sb_drop_paths';
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        const existing = map[folderName];
        if (Array.isArray(existing)) {
            const filtered = existing.filter((p) => p !== fullPath);
            map[folderName] = [fullPath, ...filtered].slice(0, 5); // keep last 5
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
/** Recall all remembered paths for a folder name (for collision handling). */
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
/** localStorage key for the last dropped value on Dashboard scan input. */
const DASHBOARD_DROP_KEY = 'sb_dashboard_last_drop';
function setLastDroppedValue(v) { try { localStorage.setItem(DASHBOARD_DROP_KEY, v); } catch (_a) { } }
function getLastDroppedValue() { try { return localStorage.getItem(DASHBOARD_DROP_KEY) || ''; } catch (_a) { return ''; } }
export function clearLastDroppedValue() { try { localStorage.removeItem(DASHBOARD_DROP_KEY); } catch (_a) { } }
/** Show a dropdown picker below the input for disambiguating multiple remembered paths. */
function showPathPicker(scope, input, folderName, paths, onSelect) {
    // Remove any existing picker
    const existing = scope.querySelector('.scan-status-path-picker');
    if (existing)
        existing.remove();
    const picker = document.createElement('div');
    picker.className = 'scan-status-path-picker';
    picker.innerHTML = `<div class="scan-status-path-picker-hd">Multiple paths for "${escapeHtml(folderName)}"</div>` +
        paths.map((p, i) => `<button type="button" class="scan-status-path-picker-item" data-index="${i}">${escapeHtml(p)}</button>`).join('');
    // Position below the input row
    const row = scope.querySelector('.scan-status-path-row');
    if (row && row.nextSibling) {
        row.parentNode.insertBefore(picker, row.nextSibling);
    }
    else if (row) {
        row.parentNode.appendChild(picker);
    }
    // mousedown fires before blur, avoiding race with input blur handlers
    picker.querySelectorAll('.scan-status-path-picker-item').forEach((btn) => {
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
    // Auto-remove on outside click or Escape
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
    if (!path)
        return;
    // Reject bare folder names or relative paths that lack a drive letter / leading slash.
    // The browser drag-and-drop may leave just the folder name in the input.
    const isAbsolute = /^[a-zA-Z]:[\\/]|^\\|^\//.test(path);
    if (!isAbsolute) {
        // Try path memory — user may have scanned this folder before
        const allPaths = recallAllDroppedPaths(path);
        if (allPaths.length === 1) {
            path = allPaths[0];
            if (input) {
                input.value = path;
                input.dataset.fromMemory = 'true';
            }
            showToast(`Auto-completed "${path.replace(/\\/g, '/').split('/').pop()}" from memory.`, 'info');
        }
        else if (allPaths.length > 1) {
            // Naming collision on Enter — show picker scoped to the input's parent
            const scope = input === null || input === void 0 ? void 0 : input.closest('.scan-status-scope');
            showToast(`Multiple paths found for "${path}" — pick one.`, 'warning');
            if (scope && input) {
                showPathPicker(scope, input, path, allPaths, (selectedPath) => {
                    if (input) {
                        input.value = selectedPath;
                        input.dataset.fromMemory = 'true';
                    }
                    // Re-run scan with the selected path
                    runDashboardScanFromInput(input, options);
                });
            }
            return;
        }
        else {
            showToast(`Path "${path}" is not absolute — please type the full path (e.g. C:\\dev\\${path}) and click Scan.`, 'warning');
            if (input) {
                input.focus();
                input.select();
            }
            return;
        }
    }
    setLastProjectPath(path);
    // Remember this path keyed by folder name for future drag-and-drop auto-fill (only if absolute)
    const isAbsolutePath = /^[a-zA-Z]:[\\/]|^\\|^\//.test(path);
    if (isAbsolutePath) {
        const folderName = String(path).replace(/\\/g, '/').split('/').pop() || '';
        if (folderName)
            rememberDroppedPath(folderName, path);
    }
    // Clear user-modified flag and last dropped value so re-renders pick up the new lastProjectPath
    if (input)
        input.dataset.userModified = '';
    clearLastDroppedValue();
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
    // Preserve user-modified or dropped value across re-renders
    const existingInput = document.getElementById('scan-root-input');
    const userValue = existingInput && existingInput.dataset.userModified === 'true' ? existingInput.value : '';
    // If a drop just happened, prefer the pending value (survives DOM recreation)
    const droppedValue = getLastDroppedValue();
    const displayValue = droppedValue || userValue || resolvedPath;
    // Check if current value came from memory (for visual indicator)
    const folderNameFromValue = String(displayValue).replace(/\\/g, '/').split('/').pop() || '';
    const allRemembered = folderNameFromValue ? recallAllDroppedPaths(folderNameFromValue) : [];
    const fromMemory = allRemembered.includes(displayValue);
    const savedCount = getSavedPathCount();
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
            value="${escapeHtml(displayValue)}"
            data-user-modified="${Boolean(userValue || droppedValue) ? 'true' : ''}"
            data-from-memory="${fromMemory ? 'true' : ''}"
            ${scanning ? 'disabled' : ''}
          >
          ${fromMemory ? `<span class="scan-status-memory-badge" title="Auto-filled from previous scan">🧠</span>` : ''}
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
        <button type="button" class="btn btn-ghost btn-sm" id="scan-clear-memory-btn" ${!savedCount || scanning ? 'disabled' : ''} title="Clear ${savedCount} saved path mapping${savedCount !== 1 ? 's' : ''}">
          <i data-lucide="trash-2" class="icon-16"></i> Clear Memory
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
    // Clear any lingering path pickers from previous drop interactions
    const oldPicker = root.querySelector('.scan-status-path-picker');
    if (oldPicker)
        oldPicker.remove();
    // Update path input to reflect the actual scanned path (not stale dropped value)
    const input = root.querySelector('#scan-root-input');
    if (input && report && report.projectRoot) {
        const actualPath = report.projectRoot;
        if (input.value !== actualPath) {
            input.value = actualPath;
            input.dataset.userModified = '';
        }
    }
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
    const { onRescan, getLastProjectPath = () => '', setLastProjectPath = () => { }, getDefaultProjectPath = () => '' } = options;
    const input = container.querySelector('#scan-root-input');
    const clearBtn = container.querySelector('#scan-clear-btn');
    const clearMemoryBtn = container.querySelector('#scan-clear-memory-btn');
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
    // Derive a sensible home base for path fallbacks (e.g. C:/Users/Trevor)
    /**
     * Derive user home base.
     * @returns {any}
     */
    function deriveUserHomeBase() {
        const defaultPath = getDefaultProjectPath() || getLastProjectPath() || '';
        if (defaultPath) {
            const normalized = defaultPath.replace(/\\/g, '/').replace(/\/$/, '');
            // Strip known project-subfolder suffixes so the base is the repo/workspace root
            const stripped = normalized.replace(/\/(ai-platform|server|app|src|dist|build|node_modules)$/i, '');
            if (stripped)
                return stripped;
        }
        // Fallback: preserve the drive letter from defaultPath/lastProjectPath if available
        const driveMatch = String(defaultPath).match(/^([a-zA-Z]:)/);
        return driveMatch ? `${driveMatch[1]}/` : 'C:/';
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
                rememberDroppedPath(folderName, resolvedPath);
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
        const resolvedPath = `${homePath}/${folderName}`;
        if (input) {
            input.value = resolvedPath;
            setLastProjectPath(resolvedPath);
            if (clearBtn)
                clearBtn.disabled = false;
        }
        rememberDroppedPath(folderName, resolvedPath);
        const toast = document.getElementById('toast-container');
        if (toast) {
            const msg = document.createElement('div');
            msg.className = 'toast toast-info';
            msg.textContent = `Folder "${folderName}" selected. Path is estimated — please verify before scanning.`;
            toast.appendChild(msg);
            setTimeout(() => msg.remove(), 4000);
        }
        browseInput.value = '';
    });
    // Detect environments (e.g. Electron) where file inputs expose real absolute paths.
    const isElectronLike = Boolean(typeof window !== 'undefined' &&
        (((_b = (_a = window.process) === null || _a === void 0 ? void 0 : _a.versions) === null || _b === void 0 ? void 0 : _b.electron) || /Electron/.test(navigator.userAgent)));
    // Browse button — ask the extension server to open the native OS folder picker
    browseBtn === null || browseBtn === void 0 ? void 0 : browseBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(apiUrl('/api/analyze/pick-folder'), { method: 'POST' });
            const data = await res.json();
            if (data.success && data.path) {
                if (input) {
                    input.value = data.path;
                    setLastProjectPath(data.path);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
                showToast(`Folder selected: ${data.path}`, 'info');
                return;
            }
            if (data.error) {
                showToast(data.error, 'warning');
            }
        }
        catch (err) {
            console.warn('[ScanStatus] Native folder picker failed:', err);
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
        input.dataset.userModified = '';
        clearLastDroppedValue();
        setLastProjectPath('');
        clearBtn.disabled = true;
        input.focus();
    });
    clearMemoryBtn === null || clearMemoryBtn === void 0 ? void 0 : clearMemoryBtn.addEventListener('click', () => {
        const count = getSavedPathCount();
        if (count === 0)
            return;
        if (!confirm(`Clear ${count} saved path mapping${count !== 1 ? 's' : ''}? This cannot be undone.`))
            return;
        clearAllDroppedPaths();
        showToast(`Cleared ${count} saved path mapping${count !== 1 ? 's' : ''}.`, 'info');
        if (clearMemoryBtn)
            clearMemoryBtn.disabled = true;
    });
    setDefaultBtn === null || setDefaultBtn === void 0 ? void 0 : setDefaultBtn.addEventListener('click', () => {
        if (!input)
            return;
        const defaultPath = getDefaultProjectPath();
        input.value = defaultPath;
        input.dataset.userModified = '';
        clearLastDroppedValue();
        setLastProjectPath(defaultPath);
        if (clearBtn)
            clearBtn.disabled = !defaultPath;
        input.focus();
    });
    input === null || input === void 0 ? void 0 : input.addEventListener('input', () => {
        const value = input.value.trim();
        input.dataset.userModified = 'true';
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
            const dt = event.dataTransfer;
            const items = (_a = dt) === null || _a === void 0 ? void 0 : _a.items;
            const files = (_b = dt) === null || _b === void 0 ? void 0 : _b.files;
            let entryName = '';
            let actualPath = '';

            // 0. Try modern File System Access API (Chrome/Edge) — gives reliable directory handle and name
            if (items && items.length > 0 && typeof items[0].getAsFileSystemHandle === 'function') {
                try {
                    const handle = await items[0].getAsFileSystemHandle();
                    if (handle && handle.kind === 'directory') {
                        entryName = handle.name || '';
                    }
                } catch {}
            }

            // 1. Try webkitGetAsEntry + getAsFile().path (Electron / VS Code: webview with enableDragAndDrop)
            if (items === null || items === void 0 ? void 0 : items.length) {
                const entry = (_d = (_c = items[0]).webkitGetAsEntry) === null || _d === void 0 ? void 0 : _d.call(_c);
                if (entry === null || entry === void 0 ? void 0 : entry.isDirectory) {
                    if (!entryName) entryName = entry.name || '';
                    // Try to derive real path from files inside the directory (Electron/VS Code webviews expose .path)
                    if (files === null || files === void 0 ? void 0 : files.length) {
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            if (file.path) {
                                const normalized = file.path.replace(/\\/g, '/');
                                const lastSlash = normalized.lastIndexOf('/');
                                if (lastSlash > 0) {
                                    const parent = normalized.substring(0, lastSlash);
                                    const parentName = parent.split('/').pop() || '';
                                    if (parentName === entryName) {
                                        actualPath = parent;
                                        break;
                                    }
                                    // Also accept if the file is inside a subdirectory of the dropped folder
                                    const pathParts = parent.split('/');
                                    const nameIdx = pathParts.lastIndexOf(entryName);
                                    if (nameIdx >= 0) {
                                        actualPath = pathParts.slice(0, nameIdx + 1).join('/');
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (actualPath) {
                        input.value = actualPath;
                        input.dataset.userModified = 'true';
                        setLastDroppedValue(actualPath);
                        setLastProjectPath(actualPath);
                        rememberDroppedPath(entryName, actualPath);
                        if (clearBtn)
                            clearBtn.disabled = false;
                        runScan();
                        return;
                    }
                    // Browser can't reveal absolute path — try memory, then server search.
                    const allPaths = recallAllDroppedPaths(entryName);
                    if (allPaths.length === 1) {
                        const remembered = allPaths[0];
                        input.value = remembered;
                        input.dataset.userModified = 'true';
                        input.dataset.fromMemory = 'true';
                        setLastDroppedValue(remembered);
                        setLastProjectPath(remembered);
                        if (clearBtn)
                            clearBtn.disabled = false;
                        showToast(`Folder "${entryName}" auto-filled from memory. Press Enter to scan or edit if needed.`, 'info');
                        return;
                    }
                    else if (allPaths.length > 1) {
                        // Naming collision — show disambiguation picker
                        input.value = entryName;
                        input.dataset.userModified = 'true';
                        setLastDroppedValue(entryName);
                        if (clearBtn)
                            clearBtn.disabled = false;
                        showPathPicker(scope, input, entryName, allPaths, (selectedPath) => {
                            input.value = selectedPath;
                            input.dataset.fromMemory = 'true';
                            setLastDroppedValue(selectedPath);
                            setLastProjectPath(selectedPath);
                            showToast(`Selected "${selectedPath}" for "${entryName}". Press Enter to scan.`, 'info');
                        });
                        showToast(`Multiple paths found for "${entryName}" — pick one from the dropdown.`, 'warning');
                        return;
                    }
                    // No memory — search all drives via server (with 5s timeout)
                    showToast(`Searching drives for "${entryName}"...`, 'info');
                    let found = false;
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        const res = await fetch('/api/find-folder', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folderName: entryName, maxDepth: 4 }),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        const data = await res.json();
                        if (data.success && data.results.length > 0) {
                            found = true;
                            if (data.results.length === 1) {
                                const foundPath = data.results[0];
                                input.value = foundPath;
                                input.dataset.userModified = 'true';
                                setLastDroppedValue(foundPath);
                                setLastProjectPath(foundPath);
                                rememberDroppedPath(entryName, foundPath);
                                if (clearBtn)
                                    clearBtn.disabled = false;
                                showToast(`Auto-located "${entryName}" at ${foundPath}. Press Enter to scan.`, 'success');
                            } else {
                                input.value = entryName;
                                input.dataset.userModified = 'true';
                                setLastDroppedValue(entryName);
                                if (clearBtn)
                                    clearBtn.disabled = false;
                                showPathPicker(scope, input, entryName, data.results, (selectedPath) => {
                                    input.value = selectedPath;
                                    input.dataset.fromMemory = 'true';
                                    setLastDroppedValue(selectedPath);
                                    setLastProjectPath(selectedPath);
                                    rememberDroppedPath(entryName, selectedPath);
                                    showToast(`Selected "${selectedPath}" for "${entryName}". Press Enter to scan.`, 'info');
                                });
                                showToast(`Multiple "${entryName}" folders found — pick one from the dropdown.`, 'warning');
                            }
                            return;
                        }
                    } catch (err) {
                        if (err && err.name === 'AbortError') {
                            showToast(`Search timed out. Browsers can't reveal folder paths — please browse manually.`, 'warning');
                        } else {
                            console.error('find-folder fetch failed:', err);
                        }
                    }
                    if (!found) {
                        // Don't put just the folder name in the input — prompt user to browse
                        input.value = '';
                        input.dataset.userModified = '';
                        input.focus();
                        if (clearBtn)
                            clearBtn.disabled = true;
                        showToast(`Browsers can't reveal folder paths. Click Browse to select "${entryName}".`, 'warning');
                        // Trigger native folder picker after short delay
                        setTimeout(() => {
                            if (browseInput) browseInput.click();
                        }, 600);
                        return;
                    }
                }
                if ((entry === null || entry === void 0 ? void 0 : entry.isFile) && (files === null || files === void 0 ? void 0 : files.length)) {
                    const file = files[0];
                    const path = file.path || file.name;
                    if (path) {
                        input.value = path;
                        setLastDroppedValue(path);
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
                    setLastDroppedValue(path);
                    setLastProjectPath(path);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
            }
        });
    }
}
