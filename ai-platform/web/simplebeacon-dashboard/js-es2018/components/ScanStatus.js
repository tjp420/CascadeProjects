import { escapeHtml, formatPercent, formatNumber, showToast } from '../utils.js';
import { canUseDirectoryPicker, filePickerBlockedMessage, isFilePickerBlockedError } from '../utils-lib/dom.js?v=20260715iframefix3';
import { resolveDisplayScore, formatScanScopeSummary, formatScanInventoryNote, getScanFileMetrics } from '../services/analyzeService.js?v=20260715iframefix3';
import { runLocalScan } from '../services/localScanService.js?v=20260715iframefix3';
import { isLocalPath, probeAgent, scanViaAgent, probeAgent4000, scanViaAgent4000, renderAgentCertificate, hasExtensionBridgeConfigured, pickFolderViaExtensionBridge as requestExtensionFolderPick, shouldProbeLocalAgent } from '../services/localAgentService.js?v=20260715hosted1';
import { runSandboxedDirectoryScan, isDroppedFolder, scanDroppedItems, captureDroppedEntry } from '../services/browserSandboxScanService.js?v=20260715iframefix3';
function isRemoteDashboardHost() {
    return typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}
function isAbsoluteLocalPath(path) {
    const raw = String(path || '').trim();
    return /^[a-zA-Z]:[\\/]|^\\|^\//.test(raw) && !/^https?:\/\//i.test(raw);
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
export async function runDashboardScanFromInput(input, options = {}) {
    const { onRescan, onLocalScanResult, getLastProjectPath = () => '', setLastProjectPath = () => { }, getDefaultProjectPath = () => '' } = options;
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
    // Lightweight localhost bridge: extension data server (sb_api_base) or agent.js:4000.
    if (isLocalPath(path) && shouldProbeLocalAgent()) {
        try {
            const status = await probeAgent4000();
            if (status.available && !status.extensionBridge) {
                const result = await scanViaAgent4000(path);
                const cert = result && result.certificate;
                const fileCount = (result.files || []).length;
                const message = cert
                    ? `Localhost:4000 scan complete — Grade ${cert.letterGrade} | ${fileCount} files | Liability ${cert.liabilityStr}` // simplebeacon-ignore hardcoded-url deploy-leak — user-facing status label
                    : `Localhost:4000 scan complete — ${fileCount} files`; // simplebeacon-ignore hardcoded-url deploy-leak — user-facing status label
                showToast(message, 'success');
                const statusEl = document.getElementById('agent-4000-status');
                if (statusEl) {
                    statusEl.textContent = message;
                    statusEl.classList.remove('unavailable');
                    statusEl.classList.add('available');
                }
                const resultsEl = document.getElementById('agent-4000-results');
                renderAgentCertificate(result, resultsEl);
                if (onLocalScanResult) {
                    onLocalScanResult({ projectPath: result.verifiedAddress || result.path, summary: result.certificate, source: 'agent4000' });
                }
                setLastProjectPath(result.verifiedAddress || result.path || path);
                return;
            }
        }
        catch (_a) { /* fall through to main agent fallback */ }
        // Fall back to the full local agent on port 55432 if the 4000 bridge is not running.
        try {
            const status = await probeAgent();
            if (status.available && status.scannerAvailable) {
                const result = await scanViaAgent(path);
                const cert = result && result.certificate;
                const fileCount = (result.files || []).length;
                const message = cert
                    ? `Local agent scan complete — Grade ${cert.letterGrade} | ${fileCount} files`
                    : `Local agent scan complete — ${fileCount} files`;
                showToast(message, 'success');
                const resultsEl = document.getElementById('agent-4000-results');
                renderAgentCertificate(result, resultsEl);
                if (onLocalScanResult) {
                    onLocalScanResult({ projectPath: result.projectPath || result.verifiedAddress || result.path, summary: result.certificate, source: 'agent' });
                }
                setLastProjectPath(result.projectPath || result.verifiedAddress || result.path || path);
                return;
            }
        }
        catch (_b) { /* fall through to existing server flow */ }
    }
    // Dropped/browsed folders without a full OS path come through as bare folder names.
    // The dashboard scan needs an absolute local path or a remote repo URL.
    const isAbsoluteLocal = isAbsoluteLocalPath(path);
    const isRemoteUrl = /^https?:\/\//i.test(path);
    const isRemoteDeployment = isRemoteDashboardHost();
    if (isAbsoluteLocal && isRemoteDeployment) {
        showToast('This hosted dashboard cannot read typed PC paths. Opening folder picker to scan privately in your browser…', 'info', { duration: 8000 });
        if (typeof options.onBrowserSandboxScan === 'function') {
            await options.onBrowserSandboxScan();
        }
        else {
            const scopeCard = document.getElementById('scan-status-scope');
            if (scopeCard) {
                scopeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                scopeCard.classList.add('sandbox-scanner-highlight');
                setTimeout(() => scopeCard.classList.remove('sandbox-scanner-highlight'), 3000);
            }
        }
        return;
    }
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
async function runSandboxedScanForDashboard(onLocalScanResult, container) {
    const root = container || document;
    const dropzone = root.querySelector('#scan-dropzone');
    const progressDetail = root.querySelector('#scan-dropzone-progress-detail');
    const resultStats = root.querySelector('#scan-dropzone-result-stats');
    const errorMessage = root.querySelector('#scan-dropzone-error-message');
    const terminal = root.querySelector('#sandbox-scan-terminal') || document.getElementById('sandbox-scan-terminal');
    const resultsEl = root.querySelector('#agent-4000-results') || document.getElementById('agent-4000-results');
    if (dropzone) {
        dropzone.classList.remove('is-idle', 'is-drag', 'is-done', 'is-error');
        dropzone.classList.add('is-scanning');
    }
    if (terminal) {
        terminal.style.display = 'block';
        terminal.textContent = 'Opening folder picker…';
    }
    try {
        const report = await runSandboxedDirectoryScan({
            onLog: (entry) => {
                if (terminal) {
                    terminal.textContent += `\n[${entry.level.toUpperCase()}] ${entry.message}`;
                    terminal.scrollTop = terminal.scrollHeight;
                }
            },
            onProgress: ({ processed, total }) => {
                if (progressDetail)
                    progressDetail.textContent = `${processed} / ${total} files`;
                if (terminal) {
                    terminal.textContent += `\n...${processed}/${total} files analyzed`;
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }
        });
        const cert = report && report.certificate;
        const message = cert
            ? `Sandbox scan complete — Grade ${cert.letterGrade} | ${report.files.length} files | Liability ${cert.liabilityStr}`
            : `Sandbox scan complete — ${report.files.length} files`;
        showToast(message, 'success');
        renderAgentCertificate(report, resultsEl);
        if (resultStats && cert) {
            resultStats.textContent = `${cert.letterGrade || 'N/A'} grade · ${report.discoveredFiles || report.files.length || 0} files scanned · ${cert.highRiskCount || 0} high · ${cert.mediumRiskCount || 0} medium`;
        }
        if (dropzone) {
            dropzone.classList.remove('is-scanning');
            dropzone.classList.add('is-done');
        }
        if (onLocalScanResult) {
            onLocalScanResult({ projectPath: report.verifiedAddress || report.path, summary: report.certificate, source: 'sandbox' });
        }
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('sb-last-sandbox-report', JSON.stringify(report));
                sessionStorage.setItem('sb-last-sandbox-project-path', report.verifiedAddress || report.path || '');
            }
        }
        catch (_a) { }
        // Continue the single local-scan process on the Analyze page.
        if (!window.location.pathname.includes('/analyze')) {
            showToast('Scan complete — opening analysis…', 'success');
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.simplebeaconApp && typeof window.simplebeaconApp.navigate === 'function') {
                    window.simplebeaconApp.navigate('analyze');
                }
                else {
                    window.location.href = '/dashboard/analyze';
                }
            }, 1200);
        }
    }
    catch (err) {
        let msg = err.message || 'Sandbox scan failed';
        if (err && err.name === 'AbortError') {
            if (dropzone) {
                dropzone.classList.remove('is-scanning');
                dropzone.classList.add('is-idle');
            }
            return;
        }
        if (isFilePickerBlockedError(err)) {
            msg = filePickerBlockedMessage();
            showToast(msg, 'warning', { duration: 12000 });
            const browseInput = root.querySelector('#scan-browse-input') || root.querySelector('#browse-dir-input');
            if (browseInput) {
                browseInput.value = '';
                browseInput.click();
            }
        }
        else {
            showToast(msg, 'error');
        }
        if (errorMessage)
            errorMessage.textContent = msg;
        if (dropzone) {
            dropzone.classList.remove('is-scanning');
            dropzone.classList.add('is-error');
        }
        if (terminal) terminal.textContent = `❌ ${msg}`;
    }
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
      <div class="sb-dropzone is-idle" id="scan-dropzone" role="region" aria-label="Dashboard scan drop zone">
        <input type="file" id="scan-browse-input" webkitdirectory directory hidden aria-label="Select folder to scan">
        <div class="sb-dropzone-idle">
          <div class="sb-dropzone-pitch">
            <div class="sb-dropzone-icon"><i data-lucide="folder-up" class="icon-32"></i></div>
            <div class="sb-dropzone-title">Drop a folder or files to scan</div>
            <div class="sb-dropzone-sub">Drop a folder for a full scan, or files for a quick scan.</div>
            <div class="sb-dropzone-privacy"><span aria-hidden="true">🔒</span> Scans run privately in your browser.</div>
          </div>
          <div class="sb-dropzone-form">
            <div class="sb-dropzone-actions">
              <button type="button" id="trigger-native-picker" class="btn btn-primary"><i data-lucide="folder-open" class="icon-16"></i> Select Folder</button>
              <button type="button" id="trigger-file-picker" class="btn btn-ghost"><i data-lucide="upload" class="icon-16"></i> Select Files</button>
            </div>
            <div class="sb-dropzone-path">
              <p class="sb-dropzone-path-label">Or type a server path / public repo URL (local PC paths require Select Folder above)</p>
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
                <button type="button" class="btn btn-ghost btn-sm" id="scan-browse-btn" ${scanning ? 'disabled' : ''} title="Browse for folder" aria-label="Browse for folder to scan" aria-controls="scan-browse-input">
                  <i data-lucide="folder-open" class="icon-16"></i> Browse
                </button>
                <button type="button" class="btn btn-ghost btn-sm" id="scan-set-default-btn" ${!hasDefault || scanning ? 'disabled' : ''} title="Reset to default path">
                  <i data-lucide="rotate-ccw" class="icon-16"></i> Reset
                </button>
                <button type="button" class="btn btn-ghost btn-sm" id="scan-clear-btn" ${!hasSaved || scanning ? 'disabled' : ''} title="Clear saved folder">
                  <i data-lucide="x" class="icon-16"></i> Clear
                </button>
                <button type="button" class="btn btn-secondary" id="rescan-btn" ${scanning ? 'disabled' : ''} title="Run gate scan on this folder">
                  ${scanning ? '<span class="loading-spinner"></span> Scanning…' : '<i data-lucide="play" class="icon-16"></i> Scan'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="sb-dropzone-drag" aria-hidden="true">
          <div class="sb-dropzone-drag-icon">📂</div>
          <strong>Release to scan</strong>
          <span class="sb-dropzone-hint">Folder → full directory scan · Files → quick file scan</span>
        </div>
        <div class="sb-dropzone-progress" aria-live="polite">
          <div class="sb-dropzone-spinner"></div>
          <div class="sb-dropzone-progress-title">Scanning…</div>
          <div class="sb-dropzone-progress-detail" id="scan-dropzone-progress-detail">0 / 0 files</div>
          <pre id="sandbox-scan-terminal" class="sb-dropzone-terminal">Awaiting selection…</pre>
        </div>
        <div class="sb-dropzone-result" role="status" aria-live="polite">
          <div class="sb-dropzone-result-icon">✅</div>
          <div class="sb-dropzone-result-title">Scan complete</div>
          <div class="sb-dropzone-result-stats" id="scan-dropzone-result-stats"></div>
          <button type="button" class="btn btn-primary btn-sm" id="scan-dropzone-view-results">View Results</button>
        </div>
        <div class="sb-dropzone-error" role="alert" aria-live="assertive">
          <div class="sb-dropzone-error-icon">⚠️</div>
          <div class="sb-dropzone-error-title">Scan failed</div>
          <div class="sb-dropzone-error-message" id="scan-dropzone-error-message"></div>
          <button type="button" class="btn btn-secondary btn-sm" id="scan-dropzone-retry">Try again</button>
        </div>
      </div>

      <p class="scan-status-scope-hint text-muted">
        Deep analysis → <a href="/dashboard/analyze" class="scan-status-link">Analyze</a> ·
        Mock folders → <a href="/dashboard/settings" class="scan-status-link">Settings → Scan paths</a>${pathCount ? ` (${pathCount})` : ''}
      </p>
      <p id="agent-4000-status" class="agent-status"></p>
      <div id="agent-4000-results"></div>
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
    const { scanning = false, config, compact = false, redesign = false } = options;
    const gate = (report === null || report === void 0 ? void 0 : report.gate) || {};
    const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
    const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
    const inventoryNote = formatScanInventoryNote(report);
    const scope = formatScanScopeSummary(report);
    const score = formatPercent(resolveDisplayScore(report));
    const freshness = formatFreshnessWarning(report);
    if (redesign) {
        const metrics = getScanFileMetrics(report);
        const analyzed = metrics.filesAnalyzed != null ? formatNumber(metrics.filesAnalyzed) : null;
        const total = metrics.repositoryFiles != null ? formatNumber(metrics.repositoryFiles) : null;
        const mock = metrics.mockSampleFiles != null ? formatNumber(metrics.mockSampleFiles) : null;
        const fiction = (report && report.fictionKpiHits) != null ? formatNumber(report.fictionKpiHits) : null;
        const sizeBytes = (report && report.totalBytes) != null ? Number(report.totalBytes) : null;
        const sizeText = sizeBytes != null ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB` : null;
        const statsParts = [
            analyzed ? `<span><strong>${analyzed}</strong> files analyzed</span>` : '',
            total ? `<span>of <strong>${total}</strong> total</span>` : '',
            mock ? `<span><strong>${mock}</strong> mock/sample</span>` : '',
            fiction ? `<span><strong>${fiction}</strong> JSON fiction-scanned</span>` : '',
            sizeText ? `<span><strong>${sizeText}</strong></span>` : '',
            score ? `<span>Consistency <strong>${score}</strong></span>` : ''
        ].filter(Boolean);
        const statsLine = statsParts.join(' · ');
        return `
    <div class="dashboard-scan-redesign">
      <div class="dashboard-scan-redesign-header">
        <div>
          <div class="dashboard-scan-redesign-label">LAST SCAN</div>
          <div class="dashboard-scan-redesign-meta">
            <span class="dashboard-scan-redesign-time">${escapeHtml((report === null || report === void 0 ? void 0 : report.generatedAt) ? new Date(report.generatedAt).toLocaleString() : 'No scan yet')}</span>
            ${freshness ? `<span class="dashboard-scan-redesign-freshness">${escapeHtml(freshness)}</span>` : ''}
          </div>
        </div>
        <span class="dashboard-scan-badge ${gateClass}">${gateLabel}</span>
      </div>
      ${statsLine ? `<div class="dashboard-scan-redesign-stats">${statsLine}</div>` : ''}
      ${inventoryNote ? `<div class="dashboard-scan-redesign-inventory">${escapeHtml(inventoryNote)}</div>` : ''}
      <div class="dashboard-scan-redesign-card">
        ${renderScanPathControls(report, { ...options, config, scanning })}
      </div>
    </div>
  `;
    }
    return `
    <div class="card dashboard-scan-card${compact ? ' compact' : ''}">
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
      ${compact ? '' : renderScanPathControls(report, { ...options, config, scanning })}
    </div>
  `;
}
export function renderCompactScanStatus(report, options = {}) {
    return renderScanStatus(report, { ...options, compact: true });
}
/** Surgically update an existing scan card without replacing innerHTML — prevents flicker. */
export function updateScanStatusDom(root, report) {
    if (!root)
        return false;
    const redesign = root.querySelector('.dashboard-scan-redesign');
    if (redesign) {
        const gate = (report === null || report === void 0 ? void 0 : report.gate) || {};
        const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
        const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
        const inventoryNote = formatScanInventoryNote(report);
        const timeText = (report === null || report === void 0 ? void 0 : report.generatedAt) ? new Date(report.generatedAt).toLocaleString() : 'No scan yet';
        const badge = redesign.querySelector('.dashboard-scan-badge');
        if (badge) {
            const nextClass = `dashboard-scan-badge ${gateClass}`;
            if (badge.className !== nextClass)
                badge.className = nextClass;
            if (badge.textContent !== gateLabel)
                badge.textContent = gateLabel;
        }
        const timeEl = redesign.querySelector('.dashboard-scan-redesign-time');
        if (timeEl && timeEl.textContent !== timeText)
            timeEl.textContent = timeText;
        const freshnessText = formatFreshnessWarning(report);
        const freshnessEl = redesign.querySelector('.dashboard-scan-redesign-freshness');
        if (freshnessText) {
            if (freshnessEl) {
                if (freshnessEl.textContent !== freshnessText)
                    freshnessEl.textContent = freshnessText;
            }
            else {
                const meta = redesign.querySelector('.dashboard-scan-redesign-meta');
                if (meta) {
                    const div = document.createElement('span');
                    div.className = 'dashboard-scan-redesign-freshness';
                    div.textContent = freshnessText;
                    meta.appendChild(div);
                }
            }
        }
        else if (freshnessEl) {
            freshnessEl.remove();
        }
        const invEl = redesign.querySelector('.dashboard-scan-redesign-inventory');
        if (inventoryNote) {
            if (invEl) {
                if (invEl.textContent !== inventoryNote)
                    invEl.textContent = inventoryNote;
            }
            else {
                const stats = redesign.querySelector('.dashboard-scan-redesign-stats');
                if (stats) {
                    const div = document.createElement('div');
                    div.className = 'dashboard-scan-redesign-inventory';
                    div.textContent = inventoryNote;
                    stats.insertAdjacentElement('afterend', div);
                }
            }
        }
        else if (invEl) {
            invEl.remove();
        }
        return true;
    }
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
    const { onRescan, onLocalScanResult, onViewResults, getLastProjectPath = () => '', setLastProjectPath = () => { }, getDefaultProjectPath = () => '' } = options;
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
    const runScan = () => runDashboardScanFromInput(input, {
        ...options,
        onBrowserSandboxScan: () => runSandboxedScanForDashboard(onLocalScanResult, container)
    });
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
    /**
     * Prefer the user's typed path input as the base for a dropped/browsed folder name.
     * If the input already contains an absolute directory path, append the folder name to it.
     * Otherwise try recently-used or default paths for a sensible base, but never fabricate
     * a home-directory path when none of the known paths match the client OS.
     * @param {HTMLInputElement} [input]
     * @param {string} [folderName]
     * @returns {string}
     */
    function deriveFallbackBase(input, folderName) {
        const current = String(input?.value || '').trim();
        const normName = String(folderName || '').replace(/\\/g, '/').replace(/\/+$/, '');
        if (!normName)
            return '';
        const isAbs = (p) => /^[a-zA-Z]:\//.test(p) || /^\//.test(p);
        const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
        if (current && isAbs(current.replace(/\\/g, '/'))) {
            const norm = current.replace(/\\/g, '/').replace(/\/+$/, '');
            // On Windows, don't append a dropped folder to a Linux server path.
            if (isWindowsClient && /^\//.test(norm) && !/^[a-zA-Z]:/.test(norm))
                ; // fall through
            else if (norm.endsWith(`/${normName}`) || norm === normName)
                return norm;
            else
                return `${norm}/${normName}`;
        }
        for (const candidate of [getLastProjectPath(), getDefaultProjectPath()]) {
            const c = String(candidate || '').trim();
            if (!c)
                continue;
            const cNorm = c.replace(/\\/g, '/').replace(/\/+$/, '');
            if (!isAbs(cNorm))
                continue;
            // On Windows, don't use a Linux server path as a fallback base, even if the
            // folder name happens to match the end of that path.
            if (isWindowsClient && /^\//.test(cNorm) && !/^[a-zA-Z]:/.test(cNorm))
                continue;
            if (cNorm.endsWith(`/${normName}`) || cNorm === normName)
                return cNorm;
            return `${cNorm}/${normName}`;
        }
        return normName;
    }
    scanBtn === null || scanBtn === void 0 ? void 0 : scanBtn.addEventListener('click', runScan);
    // Hidden file input for webkitdirectory fallback
    browseInput === null || browseInput === void 0 ? void 0 : browseInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
        const fileArray = Array.from(files);
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
                if (isRemoteDashboardHost() && isAbsoluteLocalPath(resolvedPath)) {
                    showToast('Hosted dashboard cannot scan typed PC paths. Scanning the selected folder in your browser…', 'info');
                    void runSandboxedScanForDashboard(onLocalScanResult, container);
                }
                return;
            }
        }
        // Standard browser fallback — no absolute path available.
        const firstPath = files[0].webkitRelativePath || files[0].name || '';
        const folderName = firstPath.split('/')[0] || firstPath;
        const resolvedPath = deriveFallbackBase(input, folderName);
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
            msg.textContent = /^[a-zA-Z]:|^\\\\|^\//.test(resolvedPath)
                ? `Folder "${folderName}" selected. Path is estimated — please verify before scanning.`
                : `Folder "${folderName}" selected — browser cannot reveal its full path. Type or browse the full path before scanning.`;
            toast.appendChild(msg);
            setTimeout(() => msg.remove(), 4000);
        }
        browseInput.value = '';
        if (isRemoteDashboardHost()) {
            showToast(`Scanning "${folderName}" in your browser…`, 'info');
            const dropzone = container.querySelector('#scan-dropzone');
            if (dropzone) {
                dropzone.classList.remove('is-idle', 'is-drag', 'is-done', 'is-error');
                dropzone.classList.add('is-scanning');
            }
            try {
                const report = await runLocalScan({ files: fileArray, projectPath: folderName });
                showToast(`Browser scan complete — ${report.summary?.codeFilesAnalyzed || fileArray.length} files analyzed`, 'success');
                if (onLocalScanResult) {
                    onLocalScanResult({ projectPath: folderName, summary: report.summary, source: 'browser' });
                }
            }
            catch (err) {
                showToast(err.message || 'Browser scan failed', 'error');
                if (dropzone) {
                    dropzone.classList.remove('is-scanning');
                    dropzone.classList.add('is-error');
                }
            }
        }
    });
    // Detect environments (e.g. Electron) where file inputs expose real absolute paths.
    const isElectronLike = Boolean(typeof window !== 'undefined' &&
        (((_b = (_a = window.process) === null || _a === void 0 ? void 0 : _a.versions) === null || _b === void 0 ? void 0 : _b.electron) || /Electron/.test(navigator.userAgent)));
    // Browse button — use File System Access API when available, fall back to hidden file input
    browseBtn === null || browseBtn === void 0 ? void 0 : browseBtn.addEventListener('click', async () => {
        if (hasExtensionBridgeConfigured()) {
            try {
                const pickedPath = await requestExtensionFolderPick();
                if (pickedPath && input) {
                    input.value = pickedPath;
                    setLastProjectPath(pickedPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                    showToast(`Folder selected — path set to ${pickedPath}`, 'info');
                    return;
                }
                if (pickedPath === null)
                    return;
            }
            catch (err) {
                showToast((err === null || err === void 0 ? void 0 : err.message) || 'Extension folder picker failed', 'error');
                return;
            }
        }
        // In Electron-like environments skip showDirectoryPicker because it cannot
        // reveal absolute paths; the webkitdirectory fallback gives files with .path.
        if (canUseDirectoryPicker() && !isElectronLike) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                const folderName = dirHandle.name || '';
                const fallbackPath = deriveFallbackBase(input, folderName);
                if (input) {
                    input.value = fallbackPath;
                    setLastProjectPath(fallbackPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
                if (isRemoteDashboardHost()) {
                    showToast(`Scanning "${folderName}" in your browser…`, 'info');
                    const dropzone = container.querySelector('#scan-dropzone');
                    if (dropzone) {
                        dropzone.classList.remove('is-idle', 'is-drag', 'is-done', 'is-error');
                        dropzone.classList.add('is-scanning');
                    }
                    try {
                        const report = await runLocalScan({ dirHandle, projectPath: folderName });
                        showToast(`Browser scan complete — ${report.summary?.codeFilesAnalyzed || 0} files analyzed`, 'success');
                        if (onLocalScanResult) {
                            onLocalScanResult({ projectPath: folderName, summary: report.summary, source: 'browser' });
                        }
                    }
                    catch (scanErr) {
                        showToast(scanErr.message || 'Browser scan failed', 'error');
                    }
                    return;
                }
                const toast = document.getElementById('toast-container');
                if (toast) {
                    const msg = document.createElement('div');
                    msg.className = 'toast toast-info';
                    msg.textContent = /^[a-zA-Z]:|^\\\\|^\//.test(fallbackPath)
                        ? `Folder "${folderName}" selected. Path is estimated — please verify before scanning.`
                        : `Folder "${folderName}" selected — browser cannot reveal its full path. Type or browse the full path before scanning.`;
                    toast.appendChild(msg);
                    setTimeout(() => msg.remove(), 4000);
                }
                return;
            }
            catch (err) {
                if (err.name !== 'AbortError') {
                    if (isFilePickerBlockedError(err)) {
                        showToast(filePickerBlockedMessage(), 'warning', { duration: 10000 });
                    }
                    else {
                        console.warn('[ScanStatus] Directory picker failed:', err);
                    }
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
    const sandboxPickerBtn = container.querySelector('#trigger-native-picker');
    sandboxPickerBtn === null || sandboxPickerBtn === void 0 ? void 0 : sandboxPickerBtn.addEventListener('click', () => {
        if (!canUseDirectoryPicker()) {
            const browseInput = container.querySelector('#scan-browse-input')
                || container.querySelector('#browse-dir-input');
            if (browseInput) {
                showToast('Embedded dashboard — using legacy folder dialog.', 'info', { duration: 8000 });
                browseInput.value = '';
                browseInput.click();
                return;
            }
            showToast(filePickerBlockedMessage(), 'warning', { duration: 12000 });
            return;
        }
        void runSandboxedScanForDashboard(onLocalScanResult, container);
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
    // Drag & drop on redesigned dashboard dropzone
    const dropzone = container.querySelector('#scan-dropzone');
    const filePicker = container.querySelector('#trigger-file-picker');
    const dirInput = container.querySelector('#scan-browse-input');
    const terminal = container.querySelector('#sandbox-scan-terminal');
    const progressDetail = container.querySelector('#scan-dropzone-progress-detail');
    const resultStats = container.querySelector('#scan-dropzone-result-stats');
    const errorMessage = container.querySelector('#scan-dropzone-error-message');
    if (dropzone && input) {
        function setDropzoneState(state) {
            dropzone.classList.remove('is-idle', 'is-drag', 'is-scanning', 'is-done', 'is-error');
            dropzone.classList.add(`is-${state}`);
        }
        function resetDropzone() {
            setDropzoneState('idle');
        }
        let dragDepth = 0;
        dropzone.addEventListener('dragenter', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dragDepth++;
            setDropzoneState('drag');
        });
        dropzone.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
        });
        dropzone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dragDepth--;
            if (dragDepth <= 0) {
                dragDepth = 0;
                setDropzoneState('idle');
            }
        });
        dropzone.addEventListener('drop', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            dragDepth = 0;
            const items = event.dataTransfer && event.dataTransfer.items;
            const dtFiles = event.dataTransfer && event.dataTransfer.files;
            // Snapshot data transfer objects immediately; some browsers clear the live
            // DataTransferItemList once the event handler yields.
            const itemArray = items ? Array.from(items) : [];
            const fileArray = dtFiles ? Array.from(dtFiles) : [];
            const webkitEntry = captureDroppedEntry(itemArray);
            const folderHint = (webkitEntry && webkitEntry.name) || (fileArray[0] && fileArray[0].name) || 'selected';
            const snapshotPath = extractAbsoluteDroppedFolderPath(event, folderHint);
            if (itemArray.length === 0 && fileArray.length === 0 && !snapshotPath) {
                setDropzoneState('idle');
                return;
            }
            if (snapshotPath && !(isRemoteDashboardHost() && isAbsoluteLocalPath(snapshotPath) && itemArray.length > 0)) {
                if (isRemoteDashboardHost() && isAbsoluteLocalPath(snapshotPath)) {
                    if (input) {
                        input.value = snapshotPath;
                        input.dataset.userModified = 'true';
                        setLastProjectPath(snapshotPath);
                        if (clearBtn)
                            clearBtn.disabled = false;
                    }
                    void runSandboxedScanForDashboard(onLocalScanResult, container);
                    return;
                }
                setDropzoneState('scanning');
                if (terminal)
                    terminal.textContent = `Using dropped path: ${snapshotPath}`;
                if (input) {
                    input.value = snapshotPath;
                    input.dataset.userModified = 'true';
                    setLastProjectPath(snapshotPath);
                    if (clearBtn)
                        clearBtn.disabled = false;
                }
                runScan();
                return;
            }
            setDropzoneState('scanning');
            if (terminal)
                terminal.textContent = 'Reading dropped items…';
            try {
                const droppedFolder = (webkitEntry && webkitEntry.isDirectory) || await isDroppedFolder(itemArray);
                const firstFile = itemArray[0] && typeof itemArray[0].getAsFile === 'function' ? itemArray[0].getAsFile() : null;
                const folderName = (firstFile && firstFile.name) || (webkitEntry && webkitEntry.name) || 'selected';
                if (droppedFolder) {
                    const report = await scanDroppedItems(itemArray, {
                        webkitEntry,
                        onLog: (entry) => {
                            if (terminal)
                                terminal.textContent += `\n[${entry.level.toUpperCase()}] ${entry.message}`;
                        },
                        onProgress: ({ processed, total }) => {
                            if (progressDetail)
                                progressDetail.textContent = `${processed} / ${total} files`;
                        }
                    });
                    const cert = report.certificate || {};
                    if (resultStats)
                        resultStats.textContent = `${cert.letterGrade || 'N/A'} grade · ${report.discoveredFiles || 0} files scanned · ${cert.highRiskCount || 0} high · ${cert.mediumRiskCount || 0} medium`;
                    setDropzoneState('done');
                    if (onLocalScanResult)
                        onLocalScanResult(report);
                }
                else if (fileArray.length) {
                    const files = fileArray;
                    const resolvedPath = (files[0].path) || files[0].name || 'selected-files';
                    if (progressDetail)
                        progressDetail.textContent = `${files.length} file(s) queued`;
                    const report = await runLocalScan({ files, projectPath: resolvedPath });
                    const cert = report.certificate || {};
                    if (resultStats)
                        resultStats.textContent = `${cert.letterGrade || 'N/A'} grade · ${files.length} files scanned · ${cert.highRiskCount || 0} high · ${cert.mediumRiskCount || 0} medium`;
                    setDropzoneState('done');
                    if (onLocalScanResult)
                        onLocalScanResult(report);
                }
                else {
                    throw new Error('No scannable files or folders detected.');
                }
            }
            catch (err) {
                console.error('[ScanStatus] Sandbox scan failed:', err);
                const msg = (err && err.message) || '';
                // IDE/webview drag sources often expose the absolute path via text/uri-list
                // or file.path even though DataTransfer items are not readable for the sandbox.
                if (msg.includes('No items were dropped') || msg.includes('No scannable files or folders detected') || msg.includes('No scannable files were dropped')) {
                    const folderName = (fileArray[0] && fileArray[0].name) || (webkitEntry && webkitEntry.name) || 'selected';
                    const fallbackPath = snapshotPath || extractAbsoluteDroppedFolderPath(event, folderName);
                    if (fallbackPath) {
                        if (input) {
                            input.value = fallbackPath;
                            input.dataset.userModified = 'true';
                            setLastProjectPath(fallbackPath);
                            if (clearBtn)
                                clearBtn.disabled = false;
                        }
                        runScan();
                        return;
                    }
                    // No path exposed by the IDE/webview: open the native folder picker so the
                    // user can re-select the same folder without typing a path.
                    if (errorMessage)
                        errorMessage.textContent = `Drop source didn't expose a path. Select the folder to continue.`;
                    setDropzoneState('error');
                    if (dirInput) {
                        setTimeout(() => dirInput.click(), 100);
                    }
                    return;
                }
                if (errorMessage)
                    errorMessage.textContent = msg || 'Scan failed.';
                setDropzoneState('error');
            }
        });
        // Retry button
        const retryBtn = container.querySelector('#scan-dropzone-retry');
        retryBtn === null || retryBtn === void 0 ? void 0 : retryBtn.addEventListener('click', resetDropzone);
        // View Results button navigates to the full results view
        const viewResultsBtn = container.querySelector('#scan-dropzone-view-results');
        viewResultsBtn === null || viewResultsBtn === void 0 ? void 0 : viewResultsBtn.addEventListener('click', () => {
            if (onViewResults)
                onViewResults();
        });
        // File picker button (quick file scan)
        if (filePicker) {
            const quickInput = document.createElement('input');
            quickInput.type = 'file';
            quickInput.multiple = true;
            quickInput.style.display = 'none';
            document.body.appendChild(quickInput);
            quickInput.addEventListener('change', async () => {
                const files = Array.from(quickInput.files || []);
                if (!files.length)
                    return;
                setDropzoneState('scanning');
                if (progressDetail)
                    progressDetail.textContent = `${files.length} file(s) queued`;
                try {
                    const resolvedPath = files[0].path || files[0].name || 'selected-files';
                    const report = await runLocalScan({ files, projectPath: resolvedPath });
                    const cert = report.certificate || {};
                    if (resultStats)
                        resultStats.textContent = `${cert.letterGrade || 'N/A'} grade · ${files.length} files scanned · ${cert.highRiskCount || 0} high · ${cert.mediumRiskCount || 0} medium`;
                    setDropzoneState('done');
                    if (onLocalScanResult)
                        onLocalScanResult(report);
                }
                catch (err) {
                    if (errorMessage)
                        errorMessage.textContent = err.message || 'Scan failed.';
                    setDropzoneState('error');
                }
                quickInput.value = '';
            });
            filePicker.addEventListener('click', () => quickInput.click());
        }
    }
    // Poll the localhost scan bridge (extension data server or agent.js:4000).
    const status4000 = container.querySelector('#agent-4000-status');
    if (status4000) {
        const update4000 = async () => {
            if (isRemoteDashboardHost() && !hasExtensionBridgeConfigured()) {
                status4000.hidden = true;
                status4000.textContent = '';
                return;
            }
            status4000.hidden = false;
            try {
                const s = await probeAgent4000();
                if (s.available) {
                    status4000.textContent = s.extensionBridge
                        ? 'IDE scan bridge connected — typed local paths scan via extension'
                        : 'Localhost:4000 agent connected — typed local paths will be scanned locally'; // simplebeacon-ignore deploy-leak — user-facing status label
                    status4000.classList.remove('unavailable');
                    status4000.classList.add('available');
                }
                else {
                    status4000.textContent = hasExtensionBridgeConfigured()
                        ? 'IDE scan bridge offline — reload the SimpleBeacon window'
                        : 'Localhost:4000 agent offline (run node agent.js to enable local path scans)'; // simplebeacon-ignore deploy-leak — user-facing status label
                    status4000.classList.remove('available');
                    status4000.classList.add('unavailable');
                }
            }
            catch (_a) {
                status4000.textContent = hasExtensionBridgeConfigured()
                    ? 'IDE scan bridge offline — reload the SimpleBeacon window'
                    : 'Localhost:4000 agent offline (run node agent.js to enable local path scans)'; // simplebeacon-ignore deploy-leak — user-facing status label
                status4000.classList.remove('available');
                status4000.classList.add('unavailable');
            }
        };
        void update4000();
        window.setInterval(update4000, 5000);
    }
}
