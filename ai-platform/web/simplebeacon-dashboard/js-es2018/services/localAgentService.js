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
const DEFAULT_AGENT_ORIGIN = 'http://127.0.0.1:55432';
const AGENT_TIMEOUT_MS = 3000;
const AGENT_DOWNLOAD_URL = '/downloads/simplebeacon-local-agent-setup.exe';
let cachedAgentStatus = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;
export function isLocalPath(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return false;
    if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw))
        return false;
    return /^[A-Za-z]:[\\/]/.test(raw) || /^\/[^/]/.test(raw) || /^~[\\/]/.test(raw);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    try {
        const response = await fetch(`${origin}/health`, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        clearTimeout(timer);
        const body = await response.json().catch(() => ({}));
        const status = {
            available: response.ok && body.success === true,
            scannerAvailable: Boolean(body.scannerAvailable),
            version: body.version || undefined
        };
        cachedAgentStatus = status;
        cachedAt = Date.now();
        return status;
    }
    catch (err) {
        clearTimeout(timer);
        const likelyBlocked = isMixedContentBlocked(origin, err);
        cachedAgentStatus = { available: false, scannerAvailable: false, likelyBlocked };
        cachedAt = Date.now();
        return cachedAgentStatus;
    }
}
/**
 * Detect whether the browser likely blocked the HTTP localhost fetch because
 * the page is served over HTTPS. Chromium treats localhost as a secure context,
 * but Firefox/Safari will throw a mixed-content error.
 */
function isMixedContentBlocked(origin, err) {
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
        message.includes('failed to fetch');
}
/**
 * Fetch repository inventory through the local agent.
 * @param {string} projectPath
 * @param {Object} [options]
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function fetchInventoryViaAgent(projectPath, options = {}, origin = DEFAULT_AGENT_ORIGIN) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const response = await fetch(`${origin}/inventory`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectPath, fullDirectoryScan: options.fullDirectoryScan })
        });
        clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || `Agent inventory failed (${response.status})`);
        }
        return data.inventory;
    }
    catch (err) {
        clearTimeout(timer);
        throw err;
    }
}
/**
 * Run a scan through the local agent.
 * @param {string} projectPath
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function scanViaAgent(projectPath, origin = DEFAULT_AGENT_ORIGIN) {
    const controller = new AbortController();
    // Scans can take a while; use a generous timeout.
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const response = await fetch(`${origin}/scan`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ projectPath })
        });
        clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || `Agent scan failed (${response.status})`);
        }
        return data.report;
    }
    catch (err) {
        clearTimeout(timer);
        throw err;
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
/**
 * Format a status message for the UI.
 */
export function formatAgentStatus(agentStatus) {
    if (!agentStatus)
        return '';
    if (!agentStatus.available) {
        if (agentStatus.likelyBlocked) {
            return 'Local agent blocked by HTTPS mixed-content policy — use Chrome/Edge or install the browser extension';
        }
        return 'Local agent offline — download the Local Scan Agent portable zip and run start-agent.bat';
    }
    if (!agentStatus.scannerAvailable)
        return 'Local agent connected, but scanner is not available';
    return `Local agent connected${agentStatus.version ? ` (v${agentStatus.version})` : ''}`;
}
/**
 * Return a download URL for the packaged local agent.
 */
export function getAgentDownloadUrl() {
    return AGENT_DOWNLOAD_URL;
}
