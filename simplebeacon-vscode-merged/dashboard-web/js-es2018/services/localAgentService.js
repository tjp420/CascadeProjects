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
// simplebeacon:production-leak-intent: localhost-agent-origins - These hardcoded loopback origins are required by the local agent bridge; they are not deploy leaks.
const DEFAULT_AGENT_ORIGIN = 'http://127.0.0.1:55432'; // simplebeacon-ignore hardcoded-url
const AGENT_4000_ORIGIN = 'http://127.0.0.1:4000'; // simplebeacon-ignore hardcoded-url deploy-leak
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
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function scanViaAgent(projectPath, origin = DEFAULT_AGENT_ORIGIN) {
    const response = await agentFetchWithTimeout(`${origin}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectPath })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || `Agent scan failed (${response.status})`);
    }
    return data.report;
}
/**
 * Probe the lightweight localhost:4000 agent used by the provided agent.js bridge.
 * @param {string} [origin]
 */
export async function probeAgent4000(origin = AGENT_4000_ORIGIN) {
    const now = Date.now();
    if (cachedAgent4000Status && cachedAgent4000At + CACHE_TTL_MS > now) {
        return cachedAgent4000Status;
    }
    if (pendingProbe4000) {
        return pendingProbe4000;
    }
    pendingProbe4000 = (async () => {
        // When served over HTTPS, plain HTTP localhost fetches are blocked by
        // mixed-content rules in Firefox/Safari. Skip the doomed network call.
        if (!hasAgentBridge() && isMixedContent(origin)) {
            const status = { available: false, likelyBlocked: true };
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
            const status = { available: response.ok && body.online === true };
            cachedAgent4000Status = status;
            cachedAgent4000At = Date.now();
            return status;
        }
        catch (_a) {
            const status = { available: false };
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
 * Run a scan through the lightweight localhost:4000 agent.
 * @param {string} projectPath
 * @param {string} [origin]
 */
export async function scanViaAgent4000(projectPath, origin = AGENT_4000_ORIGIN) {
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
 * Render the A-F compliance certificate from the localhost:4000 agent into a container.
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
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `border:2px solid ${cert.badgeColor}; padding:12px; border-radius:var(--radius-lg); background:var(--surface); color:var(--text-primary); margin-bottom:12px; max-width:100%; box-sizing:border-box;`;
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:8px;';
    const titleBlock = document.createElement('div');
    titleBlock.style.cssText = 'min-width:0; flex:1 1 auto;';
    const title = document.createElement('h3');
    title.textContent = 'SIMPLEBEACON COMPLIANCE REPORT';
    title.style.cssText = 'margin:0 0 4px 0; font-size:1.1rem; overflow-wrap:anywhere;';
    const status = document.createElement('span');
    status.textContent = cert.complianceStatus || '';
    status.style.cssText = `font-weight:600; color:${cert.badgeColor};`;
    titleBlock.appendChild(title);
    titleBlock.appendChild(status);
    const badge = document.createElement('div');
    badge.textContent = cert.letterGrade;
    badge.style.cssText = `background:${cert.badgeColor}; color:#fff; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold; flex:0 0 auto;`;
    header.appendChild(titleBlock);
    header.appendChild(badge);
    wrapper.appendChild(header);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; font-size:13px;';
    function makePair(labelText, valueText, valueColor) {
        const p = document.createElement('p');
        p.style.cssText = 'margin:0 0 4px 0; overflow-wrap:anywhere;';
        const label = document.createElement('b');
        label.textContent = labelText;
        const value = document.createElement('span');
        value.textContent = ` ${valueText}`;
        if (valueColor)
            value.style.color = valueColor;
        p.appendChild(label);
        p.appendChild(value);
        return p;
    }
    const discovered = typeof report.discoveredFiles === 'number' ? report.discoveredFiles : (report.files || []).length;
    const skipped = typeof report.skippedFiles === 'number' ? report.skippedFiles : 0;
    const left = document.createElement('div');
    left.appendChild(makePair('Scanned Path:', report.verifiedAddress || report.path || '', null));
    left.appendChild(makePair('Files Scanned:', `${(report.files || []).length} / ${discovered} candidates`, null));
    const right = document.createElement('div');
    right.appendChild(makePair('Heuristic Score:', `${cert.score || 0}/100`, null));
    right.appendChild(makePair('Estimated Risk Liability:', cert.liabilityStr || '$0', '#dc3545'));
    if (skipped > 0) {
        right.appendChild(makePair('Skipped Files:', `${skipped} (large or unreadable)`, null));
    }
    grid.appendChild(left);
    grid.appendChild(right);
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
    const filesHeading = document.createElement('h4');
    filesHeading.textContent = 'Mapped System File Trees:';
    filesHeading.style.cssText = 'margin:12px 0 8px 0; font-size:14px;';
    container.appendChild(filesHeading);
    const filesBox = document.createElement('div');
    filesBox.style.cssText = 'max-height:260px; overflow:auto; background:var(--background); color:var(--text-secondary); padding:12px; font-family:monospace; font-size:12px; border-radius:var(--radius-md); border:1px solid var(--border); max-width:100%;';
    const files = report.files || [];
    if (!files.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No files returned.';
        filesBox.appendChild(empty);
    }
    else {
        files.forEach((f) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:4px; white-space:nowrap;';
            row.textContent = `[${f.status || 'Clean'}] - ${f.absolutePath || f.name} (${f.size || 0} bytes)`;
            filesBox.appendChild(row);
        });
    }
    container.appendChild(filesBox);
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
/**
 * Format a status message for the UI.
 */
export function formatAgentStatus(agentStatus) {
    if (!agentStatus)
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
