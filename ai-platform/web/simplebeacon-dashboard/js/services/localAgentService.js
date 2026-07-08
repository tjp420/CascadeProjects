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
const AGENT_DOWNLOAD_URLS = {
  windows: '/downloads/simplebeacon-local-agent-setup.exe',
  linux: '/downloads/simplebeacon-local-agent-portable.zip',
  macos: '/downloads/simplebeacon-local-agent-portable.zip',
  unknown: '/downloads/simplebeacon-local-agent-portable.zip'
};

let cachedAgentStatus = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export function isLocalPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw)) return false;
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
      scannerLoadError: body.scannerLoadError || undefined,
      version: body.version || undefined
    };
    cachedAgentStatus = status;
    cachedAt = Date.now();
    return status;
  } catch (err) {
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
  if (!origin || !origin.startsWith('http://')) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  const message = String(err?.message || '').toLowerCase();
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
  const timer = setTimeout(() => controller.abort(), 300_000);
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
  } catch (err) {
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
  const timer = setTimeout(() => controller.abort(), 300_000);
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
  } catch (err) {
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
  if (!agentStatus?.available || !agentStatus?.scannerAvailable) return false;
  return isLocalPath(projectPath);
}

/**
 * Format a status message for the UI.
 */
export function formatAgentStatus(agentStatus) {
  if (!agentStatus) return '';
  if (!agentStatus.available) {
    if (agentStatus.likelyBlocked) {
      return 'Local agent blocked by HTTPS mixed-content policy — use Chrome/Edge or install the browser extension';
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
  if (typeof window === 'undefined' || !window.navigator) return 'unknown';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
  if (ua.includes('linux')) return 'linux';
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
  if (agentStatus?.likelyBlocked) {
    return 'Firefox/Safari block HTTPS pages from reaching the Local Scan Agent. Use Chrome/Edge, type the full path and press Enter, or install the browser extension.';
  }
  if (!agentStatus?.available) {
    return 'Local Scan Agent is offline. Download and run it from the link below, then try again.';
  }
  if (!agentStatus?.scannerAvailable) {
    const error = agentStatus?.scannerLoadError ? ` (${agentStatus.scannerLoadError})` : '';
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
