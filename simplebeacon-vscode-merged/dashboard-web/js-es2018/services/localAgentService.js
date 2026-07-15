/**
 * Local agent bridge for the SimpleBeacon dashboard.
 *
 * Detects whether a SimpleBeacon local agent is running on the user's machine
 * (127.0.0.1:55432 by default) and routes local filesystem scans to it instead
 * of the remote server. This lets users type direct paths like
 * `G:\\Games\\Ubisoft` on the public Render dashboard when the agent is active.
 *
 * NOTE: Browsers served over HTTPS may block HTTP localhost fetches due to
 * mixed-content policies. Chromium-based browsers generally allow localhost as
 * a secure context, but Firefox/Safari may require the agent to be paired with
 * a browser extension or an Electron wrapper for full compatibility.
 */
import { openInIde } from '../utils-lib/ideDeepLink.js';
// simplebeacon:production-leak-intent: localhost-agent-origins - These hardcoded loopback origins are required by the local agent bridge; they are not deploy leaks.
const DEFAULT_AGENT_ORIGIN = 'http://127.0.0.1:55432'; // simplebeacon-ignore hardcoded-url
const AGENT_4000_ORIGIN = 'http://127.0.0.1:4000'; // simplebeacon-ignore hardcoded-url deploy-leak
const SB_API_BASE_KEY = 'sb_api_base';
const AGENT_TIMEOUT_MS = 3000;
const AGENT_DOWNLOAD_URLS = {
    windows: '/downloads/simplebeacon-scanner.exe',
    linux: '/downloads/simplebeacon-local-agent-portable.zip',
    macos: '/downloads/simplebeacon-local-agent-portable.zip',
    unknown: '/downloads/simplebeacon-local-agent-portable.zip'
};
let cachedAgentStatus = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30000;
let pendingProbe = null;
let cachedAgent4000Status = null;
let cachedAgent4000At = 0;
let pendingProbe4000 = null;
function hasAgentBridge() {
    return typeof window !== 'undefined' && !!window.simplebeaconAgentBridge;
}
function getAgentFetch() {
    return hasAgentBridge() ? window.simplebeaconAgentBridge.fetch.bind(window.simplebeaconAgentBridge) : fetch;
}
function readSbApiBaseOverride() {
    if (typeof window === 'undefined')
        return null;
    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get(SB_API_BASE_KEY) || params.get('sb_notify_base');
        if (fromQuery)
            return fromQuery;
    }
    catch (_a) { /* ignore */ }
    if (typeof sessionStorage !== 'undefined') {
        try {
            return sessionStorage.getItem(SB_API_BASE_KEY) || sessionStorage.getItem('sb_notify_base');
        }
        catch (_b) { /* ignore */ }
    }
    return null;
}
/** Extension IDE data-server origin (dynamic port), when sb_api_base is injected. */
function getExtensionBridgeOrigin() {
    const override = readSbApiBaseOverride();
    if (!override)
        return null;
    try {
        const base = override.replace(/\/api\/?$/, '');
        const parsed = new URL(base);
        const host = parsed.hostname.toLowerCase();
        if (host !== '127.0.0.1' && host !== 'localhost')
            return null;
        return parsed.origin;
    }
    catch (_a) {
        return null;
    }
}
function resolveBridgeOrigin() {
    return getExtensionBridgeOrigin() || AGENT_4000_ORIGIN;
}
function isExtensionBridgeOrigin(origin) {
    const bridge = getExtensionBridgeOrigin();
    return !!bridge && bridge === origin;
}
/** True when the dashboard was loaded with sb_api_base (VS Code / Windsurf extension). */
export function hasExtensionBridgeConfigured() {
    return !!getExtensionBridgeOrigin();
}

/**
 * Open the native OS folder picker via the extension data server (works in cross-origin iframes).
 * @returns {Promise<string|null>} Absolute path, or null if cancelled / unavailable.
 */
export async function pickFolderViaExtensionBridge() {
    const origin = getExtensionBridgeOrigin();
    if (!origin)
        return null;
    const doFetch = getAgentFetch();
    const response = await doFetch(`${origin}/api/analyze/pick-folder`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}',
    }, AGENT_TIMEOUT_MS);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success !== true)
        throw new Error(body.error || 'Extension folder picker failed');
    const picked = String(body.path || '').trim();
    return picked || null;
}
async function agentFetchWithTimeout(url, options = {}, timeoutMs = 300000) {
    const doFetch = getAgentFetch();
    const timeout = new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('Local agent request timed out')), timeoutMs);
    });
    const response = await Promise.race([doFetch(url, options), timeout]);
    return response;
}
export function isLocalPath(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return false;
    if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw))
        return false;
    const isWindowsClient = typeof navigator !== 'undefined' && /Win(dows|32|64)/i.test(navigator.userAgent || '');
    if (isWindowsClient) {
        return /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\/.test(raw);
    }
    return /^[A-Za-z]:[\\/]/.test(raw) || /^\/[^/]/.test(raw) || /^~[\\/]/.test(raw) || /^\\\\/.test(raw);
}
/**
 * Probe the local agent health endpoint.
 * @param {string} [origin]
 * @returns {Promise<{available:boolean, scannerAvailable:boolean, version?:string}>}
 */
export async function probeAgent(origin = DEFAULT_AGENT_ORIGIN) {
    const now = Date.now();
    if (cachedAgentStatus && cachedAt + CACHE_TTL_MS > now) {
        return cachedAgentStatus;
    }
    if (pendingProbe) {
        return pendingProbe;
    }
    pendingProbe = (async () => {
        if (!hasAgentBridge() && isMixedContent(origin)) {
            const status = { available: false, scannerAvailable: false, likelyBlocked: true };
            cachedAgentStatus = status;
            cachedAt = Date.now();
            return status;
        }
        try {
            const response = await agentFetchWithTimeout(`${origin}/health`, {
                method: 'GET',
                headers: { Accept: 'application/json' }
            }, AGENT_TIMEOUT_MS);
            const body = await response.json().catch(() => ({}));
            const status = {
                available: response.ok && body.success === true,
                scannerAvailable: Boolean(body.scannerAvailable),
                scannerLoadError: body.scannerLoadError || undefined,
                version: body.version || undefined
            };
            cachedAgentStatus = status;
            cachedAt = Date.now();
            return status;
        }
        catch (err) {
            const likelyBlocked = !hasAgentBridge() && isMixedContentBlocked(origin, err);
            cachedAgentStatus = { available: false, scannerAvailable: false, likelyBlocked };
            cachedAt = Date.now();
            return cachedAgentStatus;
        }
        finally {
            pendingProbe = null;
        }
    })();
    return pendingProbe;
}
/**
 * Detect whether the browser likely blocked the HTTP localhost fetch because
 * the page is served over HTTPS. Chromium treats localhost as a secure context,
 * but Firefox/Safari will throw a mixed-content error.
 */
function isMixedContentBlocked(origin, err) {
    if (isMixedContent(origin))
        return true;
    if (!origin || !origin.startsWith('http://'))
        return false;
    if (typeof window === 'undefined')
        return false;
    if (window.location.protocol !== 'https:')
        return false;
    const message = String((err === null || err === void 0 ? void 0 : err.message) || '').toLowerCase();
    return message.includes('mixed content') ||
        message.includes('insecure') ||
        message.includes('blocked') ||
        message.includes('failed to fetch') ||
        message.includes('ns_error');
}
function isMixedContent(origin) {
    if (!origin || !origin.startsWith('http://'))
        return false;
    if (typeof window === 'undefined')
        return false;
    return window.location.protocol === 'https:';
}
/**
 * Fetch repository inventory through the local agent.
 * @param {string} projectPath
 * @param {Object} [options]
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function fetchInventoryViaAgent(projectPath, options = {}, origin = DEFAULT_AGENT_ORIGIN) {
    const response = await agentFetchWithTimeout(`${origin}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectPath, fullDirectoryScan: options.fullDirectoryScan })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `Agent inventory failed (${response.status})`);
    }
    return data.inventory;
}
/**
 * Run a scan through the local agent.
 * @param {string} projectPath
 * @param {Object} [options]
 * @param {boolean} [options.fullDirectoryScan]
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function scanViaAgent(projectPath, options = {}, origin = DEFAULT_AGENT_ORIGIN) {
    let resolvedOrigin = origin;
    let scanOptions = options;
    if (typeof options === 'string') {
        resolvedOrigin = options;
        scanOptions = {};
    }
    const response = await agentFetchWithTimeout(`${resolvedOrigin}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            projectPath,
            fullDirectoryScan: scanOptions.fullDirectoryScan === true
        })
    }, 600000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `Agent scan failed (${response.status})`);
    }
    return data.report;
}
/**
 * Read live scan progress from the local agent (.simplebeacon/scan-progress.json).
 * @param {string} projectPath
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function fetchScanProgressViaAgent(projectPath, origin = DEFAULT_AGENT_ORIGIN) {
    const params = new URLSearchParams({ projectPath: String(projectPath || '') });
    const response = await agentFetchWithTimeout(`${origin}/progress?${params}`, {
        headers: { Accept: 'application/json' }
    }, 15000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        return { active: false };
    }
    return data.progress || { active: false };
}
/**
 * Read live scan progress from the VS Code extension data-server (sb_api_base).
 * @param {string} projectPath
 * @returns {Promise<Object>}
 */
export async function fetchScanProgressViaExtensionBridge(projectPath) {
    const origin = getExtensionBridgeOrigin();
    if (!origin) {
        return { active: false, endpointUnavailable: true };
    }
    const params = new URLSearchParams({ projectPath: String(projectPath || '') });
    try {
        const response = await agentFetchWithTimeout(`${origin}/api/simplebeacon/scan/progress?${params}`, {
            headers: { Accept: 'application/json' }
        }, 15000);
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
            return { active: false, endpointUnavailable: true };
        }
        if (!response.ok) {
            return { active: false };
        }
        return data.progress || { active: false };
    }
    catch (_a) {
        return { active: false, endpointUnavailable: true };
    }
}
/**
 * Probe the lightweight localhost bridge used for typed local path scans.
 * Prefers the VS Code extension data server (sb_api_base) over standalone agent.js:4000.
 * @param {string} [origin]
 */
export async function probeAgent4000(origin = resolveBridgeOrigin()) {
    const now = Date.now();
    const extensionBridge = isExtensionBridgeOrigin(origin);
    if (cachedAgent4000Status && cachedAgent4000At + CACHE_TTL_MS > now && cachedAgent4000Status.origin === origin) {
        return cachedAgent4000Status;
    }
    if (pendingProbe4000) {
        return pendingProbe4000;
    }
    pendingProbe4000 = (async () => {
        // When served over HTTPS, plain HTTP localhost fetches are blocked by
        // mixed-content rules in Firefox/Safari. Skip the doomed network call.
        if (!hasAgentBridge() && isMixedContent(origin)) {
            const status = { available: false, likelyBlocked: true, extensionBridge, origin };
            cachedAgent4000Status = status;
            cachedAgent4000At = Date.now();
            return status;
        }
        try {
            const response = await agentFetchWithTimeout(`${origin}/api/ping`, {
                method: 'GET',
                headers: { Accept: 'application/json' }
            }, AGENT_TIMEOUT_MS);
            const body = await response.json().catch(() => ({}));
            const status = {
                available: response.ok && body.online === true,
                extensionBridge,
                origin
            };
            cachedAgent4000Status = status;
            cachedAgent4000At = Date.now();
            return status;
        }
        catch (_a) {
            const status = { available: false, extensionBridge, origin };
            cachedAgent4000Status = status;
            cachedAgent4000At = Date.now();
            return status;
        }
        finally {
            pendingProbe4000 = null;
        }
    })();
    return pendingProbe4000;
}
/**
 * Run a scan through the localhost bridge (extension data server or agent.js:4000).
 * @param {string} projectPath
 * @param {string} [origin]
 */
export async function scanViaAgent4000(projectPath, origin = resolveBridgeOrigin()) {
    if (isExtensionBridgeOrigin(origin)) {
        const response = await agentFetchWithTimeout(`${origin}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ path: projectPath })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.warning || `Extension scan failed (${response.status})`);
        }
        return {
            success: true,
            extensionBridge: true,
            report: data.report,
            path: projectPath,
            scannedPath: data.scannedPath || projectPath,
            metrics: data.metrics
        };
    }
    const response = await agentFetchWithTimeout(`${origin}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ path: projectPath })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `Agent scan failed (${response.status})`);
    }
    return data;
}
/**
 * Render the A-F compliance certificate from the local agent into a container.
 * Uses DOM APIs instead of innerHTML to avoid XSS vectors from local path/file names.
 * @param {Object} report
 * @param {HTMLElement} [container]
 */
export function renderAgentCertificate(report, container) {
    if (!container)
        return;
    container.replaceChildren();
    const cert = report && report.certificate;
    if (!cert)
        return;
    const files = report.files || [];
    const issueFiles = files.filter((f) => f.status && f.status !== 'Clean');
    const cleanCount = files.length - issueFiles.length;
    const discovered = typeof report.discoveredFiles === 'number' ? report.discoveredFiles : files.length;
    const skipped = typeof report.skippedFiles === 'number' ? report.skippedFiles : 0;
    const scannedPath = report.verifiedAddress || report.path || '';

    const wrapper = document.createElement('div');
    wrapper.className = 'sb-compliance-report';
    wrapper.style.setProperty('--sb-grade-color', cert.badgeColor || '#6366f1');

    const hero = document.createElement('div');
    hero.className = 'sb-compliance-hero';
    const heroMain = document.createElement('div');
    heroMain.className = 'sb-compliance-hero-main';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'sb-compliance-eyebrow';
    eyebrow.textContent = 'Scan complete';
    const title = document.createElement('h3');
    title.className = 'sb-compliance-title';
    title.textContent = 'Compliance summary';
    const status = document.createElement('p');
    status.className = 'sb-compliance-status';
    status.textContent = cert.complianceStatus || 'Review required';
    heroMain.appendChild(eyebrow);
    heroMain.appendChild(title);
    heroMain.appendChild(status);
    const grade = document.createElement('div');
    grade.className = 'sb-compliance-grade';
    grade.setAttribute('aria-label', `Grade ${cert.letterGrade || '?'}`);
    grade.textContent = cert.letterGrade || '?';
    hero.appendChild(heroMain);
    hero.appendChild(grade);
    wrapper.appendChild(hero);

    const metrics = document.createElement('div');
    metrics.className = 'sb-compliance-metrics';
    const metricDefs = [
        { label: 'Files scanned', value: `${files.length} / ${discovered}` },
        { label: 'Heuristic score', value: `${cert.score || 0}/100` },
        { label: 'Issues flagged', value: String(issueFiles.length) },
        { label: 'Risk liability', value: cert.liabilityStr || '$0', danger: true },
        ...(skipped > 0 ? [{ label: 'Skipped', value: `${skipped} unreadable` }] : [])
    ];
    metricDefs.forEach((item) => {
        const chip = document.createElement('div');
        chip.className = 'sb-compliance-metric';
        const label = document.createElement('span');
        label.className = 'sb-compliance-metric-label';
        label.textContent = item.label;
        const value = document.createElement('strong');
        value.className = item.danger ? 'sb-compliance-metric-danger' : '';
        value.textContent = item.value;
        chip.appendChild(label);
        chip.appendChild(value);
        metrics.appendChild(chip);
    });
    wrapper.appendChild(metrics);

    if (scannedPath) {
        const pathRow = document.createElement('div');
        pathRow.className = 'sb-compliance-path';
        pathRow.textContent = scannedPath;
        wrapper.appendChild(pathRow);
    }

    const actions = document.createElement('div');
    actions.className = 'sb-compliance-actions';
    const actionDefs = [
        { label: 'View all findings', route: 'results' },
        { label: 'Remediation roadmap', route: 'roadmap' },
        { label: 'Export report', route: 'export' }
    ];
    actionDefs.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = item.route === 'results' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
        btn.textContent = item.label;
        btn.addEventListener('click', () => {
            const app = typeof window !== 'undefined' ? window.simplebeaconApp : null;
            if (item.route === 'export') {
                if (app && app.scanService && typeof app.scanService.exportReport === 'function') {
                    app.scanService.exportReport();
                }
                return;
            }
            if (app && typeof app.navigate === 'function') {
                app.navigate(item.route);
            }
        });
        actions.appendChild(btn);
    });
    wrapper.appendChild(actions);

    if (files.length) {
        const details = document.createElement('details');
        details.className = 'sb-compliance-files';
        details.open = issueFiles.length > 0 && issueFiles.length <= 12;
        const summary = document.createElement('summary');
        summary.textContent = `File inventory (${issueFiles.length} flagged · ${cleanCount} clean)`;
        details.appendChild(summary);
        const toolbar = document.createElement('div');
        toolbar.className = 'sb-compliance-files-toolbar';
        let activeFilter = 'issues';
        const filters = [
            { id: 'issues', label: `Issues (${issueFiles.length})` },
            { id: 'all', label: `All (${files.length})` },
            { id: 'clean', label: `Clean (${cleanCount})` }
        ];
        const list = document.createElement('div');
        list.className = 'sb-compliance-files-list';
        const renderList = () => {
            list.replaceChildren();
            let rows = files;
            if (activeFilter === 'issues')
                rows = issueFiles;
            else if (activeFilter === 'clean')
                rows = files.filter((f) => !f.status || f.status === 'Clean');
            const limit = activeFilter === 'all' ? 80 : 120;
            rows.slice(0, limit).forEach((f) => {
                const row = document.createElement('div');
                const isClean = !f.status || f.status === 'Clean';
                row.className = `sb-compliance-file-row${isClean ? ' is-clean' : ' is-issue'}`;
                const badge = document.createElement('span');
                badge.className = 'sb-compliance-file-badge';
                badge.textContent = isClean ? 'Clean' : String(f.status);
                const path = document.createElement('span');
                path.className = 'sb-compliance-file-path';
                path.textContent = f.absolutePath || f.name || '';
                if (f.absolutePath || f.name) {
                    path.style.cursor = 'pointer';
                    path.title = 'Open in editor';
                    path.addEventListener('click', () => {
                        openInIde(f.absolutePath || f.name, f.line || 1, { projectRoot: scannedPath });
                    });
                }
                const openBtn = document.createElement('button');
                openBtn.type = 'button';
                openBtn.className = 'btn btn-ghost btn-xs';
                openBtn.textContent = 'Open';
                openBtn.addEventListener('click', () => {
                    openInIde(f.absolutePath || f.name, f.line || 1, { projectRoot: scannedPath });
                });
                const size = document.createElement('span');
                size.className = 'sb-compliance-file-size';
                size.textContent = `${f.size || 0} B`;
                row.appendChild(badge);
                row.appendChild(path);
                row.appendChild(openBtn);
                row.appendChild(size);
                list.appendChild(row);
            });
            if (rows.length > limit) {
                const more = document.createElement('div');
                more.className = 'sb-compliance-files-more text-muted';
                more.textContent = `+ ${rows.length - limit} more files — run a full export for the complete inventory.`;
                list.appendChild(more);
            }
        };
        filters.forEach((filter) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-ghost btn-xs sb-compliance-filter${filter.id === activeFilter ? ' is-active' : ''}`;
            btn.textContent = filter.label;
            btn.addEventListener('click', () => {
                activeFilter = filter.id;
                toolbar.querySelectorAll('.sb-compliance-filter').forEach((el) => el.classList.remove('is-active'));
                btn.classList.add('is-active');
                renderList();
            });
            toolbar.appendChild(btn);
        });
        details.appendChild(toolbar);
        details.appendChild(list);
        renderList();
        wrapper.appendChild(details);
    }

    container.appendChild(wrapper);

    const dropzone = container.closest('#analyze-path-dropzone');
    if (dropzone) {
        dropzone.classList.add('has-compliance-report');
    }
}
/**
 * Decide whether a given path should be routed to the local agent rather than
 * the remote server.
 * @param {string} projectPath
 * @param {Object} [agentStatus]
 * @returns {boolean}
 */
export function shouldUseAgent(projectPath, agentStatus) {
    if (!(agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.available) || !(agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.scannerAvailable))
        return false;
    return isLocalPath(projectPath);
}
/** True when the dashboard is served over HTTPS on a non-localhost host (Pages, production). */
function isHostedHttpsDashboard() {
    if (typeof window === 'undefined')
        return false;
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname))
        return false;
    return window.location.protocol === 'https:';
}
/**
 * Format a status message for the UI.
 */
export function formatAgentStatus(agentStatus) {
    if (!agentStatus)
        return '';
    // Hosted dashboard: in-browser folder scan is primary — suppress agent nag when offline.
    if (isHostedHttpsDashboard() && !agentStatus.available)
        return '';
    if (!agentStatus.available) {
        if (agentStatus.likelyBlocked) {
            return 'Local agent blocked by HTTPS mixed-content policy — use Chrome/Edge or download the Local Scan Agent below';
        }
        return 'Local agent offline — download the Local Scan Agent portable zip and run start-agent.bat';
    }
    if (!agentStatus.scannerAvailable) {
        const error = agentStatus.scannerLoadError ? `: ${agentStatus.scannerLoadError}` : '';
        return `Local agent connected, but scanner is not available${error}`;
    }
    return `Local agent connected${agentStatus.version ? ` (v${agentStatus.version})` : ''}`;
}
/**
 * Detect the user's platform from the user agent string.
 * @returns {'windows'|'linux'|'macos'|'unknown'}
 */
export function detectPlatform() {
    if (typeof window === 'undefined' || !window.navigator)
        return 'unknown';
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win'))
        return 'windows';
    if (ua.includes('mac') || ua.includes('darwin'))
        return 'macos';
    if (ua.includes('linux'))
        return 'linux';
    return 'unknown';
}
/**
 * Return a download URL for the packaged local agent.
 * @param {'windows'|'linux'|'macos'|'unknown'} [platform]
 */
export function getAgentDownloadUrl(platform) {
    const p = platform || detectPlatform();
    return AGENT_DOWNLOAD_URLS[p] || AGENT_DOWNLOAD_URLS.unknown;
}
/**
 * Return user-facing guidance for why the agent cannot be used and what to do next.
 * @param {Object} agentStatus
 * @returns {string}
 */
export function getAgentFallbackMessage(agentStatus) {
    var _a, _b, _c;
    if ((_a = agentStatus) === null || _a === void 0 ? void 0 : _a.likelyBlocked) {
        return 'HTTPS blocks direct access to the Local Scan Agent. Install the Simplebeacon Browser Extension, open this page in Chrome/Edge, or run the local dashboard.';
    }
    if (!((_b = agentStatus) === null || _b === void 0 ? void 0 : _b.available)) {
        return 'Local Scan Agent is offline. Download and run it from the link below, then try again.';
    }
    if (!((_c = agentStatus) === null || _c === void 0 ? void 0 : _c.scannerAvailable)) {
        var _d;
        const error = ((_d = agentStatus) === null || _d === void 0 ? void 0 : _d.scannerLoadError) ? ` (${agentStatus.scannerLoadError})` : '';
        return `Local Scan Agent is running but the scanner is not loaded.${error} Restart the agent or reinstall the portable package.`;
    }
    return 'Local Scan Agent is not ready.';
}
/**
 * Return human-readable platform name.
 * @param {'windows'|'linux'|'macos'|'unknown'} platform
 */
export function getPlatformLabel(platform) {
    const labels = {
        windows: 'Windows',
        linux: 'Linux',
        macos: 'macOS',
        unknown: 'your platform'
    };
    return labels[platform] || labels.unknown;
}
/**
 * Return platform-specific install instructions.
 * @param {'windows'|'linux'|'macos'|'unknown'} platform
 */
export function getInstallInstructions(platform) {
    const p = platform || detectPlatform();
    if (p === 'windows') {
        return 'Run the downloaded .exe and follow the prompts. The installer will start the agent automatically.';
    }
    if (p === 'linux' || p === 'macos' || p === 'unknown') {
        return 'Extract the downloaded zip, open a terminal in the extracted folder, and run: ./install.sh';
    }
    return '';
}
