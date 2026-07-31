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
import {
  persistExtensionBridge,
  clearExtensionBridge,
} from '../utils-lib/url.js?v=20260716cachefix1';
import { EXTENSION_ID, LOCAL_AGENT_DOWNLOAD_URL, VSIX_DOWNLOAD_URL } from '../config.js';
import { shouldProbeOllamaModels } from './aiKeysService.js?v=20260720ollama3';
// simplebeacon:production-leak-intent: localhost-agent-origins - These hardcoded loopback origins are required by the local agent bridge; they are not deploy leaks.
const DEFAULT_AGENT_ORIGIN = 'http://127.0.0.1:55432'; // simplebeacon-ignore hardcoded-url
const AGENT_4000_ORIGIN = 'http://127.0.0.1:4000'; // simplebeacon-ignore hardcoded-url deploy-leak
const SB_API_BASE_KEY = 'sb_api_base';
const AGENT_TIMEOUT_MS = 3000;
const AGENT_DOWNLOAD_URLS = {
  windows: LOCAL_AGENT_DOWNLOAD_URL,
  linux: LOCAL_AGENT_DOWNLOAD_URL,
  macos: LOCAL_AGENT_DOWNLOAD_URL,
  unknown: LOCAL_AGENT_DOWNLOAD_URL,
};
let cachedAgentStatus = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30000;
const FAILED_PROBE_CACHE_MS = 120000;
function probeCacheFresh(cachedAt, status) {
  const ttl = status && status.available ? CACHE_TTL_MS : FAILED_PROBE_CACHE_MS;
  return cachedAt + ttl > Date.now();
}
let pendingProbe = null;
let cachedAgent4000Status = null;
let cachedAgent4000At = 0;
let pendingProbe4000 = null;
/** Dashboard + API on the same localhost machine (e.g. coming-soon dev on :59150). */
export function isIntegratedLocalDashboard() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') return false;
  return window.location.protocol === 'http:';
}
function isAgentJs4000Origin(origin) {
  if (!origin) return false;
  try {
    return new URL(String(origin)).port === '4000';
  } catch (_a) {
    return String(origin).includes(':4000');
  }
}
/** Drop stale agent.js:4000 bridge params when the integrated dashboard already serves /api. */
export function clearStaleIntegratedBridgeParams() {
  if (!isIntegratedLocalDashboard()) return false;
  const override = readSbApiBaseOverride();
  let cleared = false;
  if (override) {
    try {
      if (isAgentJs4000Origin(new URL(String(override).replace(/\/api\/?$/, '')).origin)) {
        clearExtensionBridge({ updateUrl: true });
        cleared = true;
      }
    } catch (_a) {
      /* ignore */
    }
  }
  if (
    typeof window !== 'undefined' &&
    window.__SB_BRIDGE_HOST__ &&
    isAgentJs4000Origin(window.__SB_BRIDGE_HOST__)
  ) {
    try {
      delete window.__SB_BRIDGE_HOST__;
    } catch (_b) {
      /* ignore */
    }
    cleared = true;
  }
  return cleared;
}
function hasAgentBridge() {
  return typeof window !== 'undefined' && !!window.simplebeaconAgentBridge;
}
function getAgentFetch() {
  if (hasAgentBridge() && typeof window.simplebeaconAgentBridge.fetch === 'function') {
    return window.simplebeaconAgentBridge.fetch.bind(window.simplebeaconAgentBridge);
  }
  return fetch;
}
/** True when the hosted dashboard can relay loopback fetches via the VS Code wrapper iframe. */
export function canUseParentBridgeFetch() {
  if (typeof window === 'undefined' || !hasExtensionBridgeConfigured()) return false;
  try {
    return !!(window.parent && window.parent !== window);
  } catch (_a) {
    return false;
  }
}
/**
 * Relay a fetch to localhost through the VS Code dashboard wrapper (avoids LNA prompts).
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
export function bridgeFetchViaParent(url, init = {}, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (!canUseParentBridgeFetch()) {
      reject(new Error('Parent bridge unavailable'));
      return;
    }
    const requestId = `pbf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new Error('Parent bridge fetch timeout'));
    }, timeoutMs);
    const onMsg = (event) => {
      const data = event === null || event === void 0 ? void 0 : event.data;
      if (!data || data.command !== 'bridgeFetchResponse' || data.requestId !== requestId) return;
      cleanup();
      if (data.error) {
        reject(new Error(String(data.error)));
        return;
      }
      resolve(
        new Response(data.body ?? '', {
          status: data.status || 200,
          headers: { 'Content-Type': data.contentType || 'application/json' },
        })
      );
    };
    window.addEventListener('message', onMsg);
    try {
      window.parent.postMessage(
        {
          command: 'bridgeFetch',
          requestId,
          url,
          init: {
            method: init.method || 'GET',
            headers: init.headers || undefined,
            body: init.body || undefined,
          },
        },
        '*'
      );
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
/** Prefer browser extension bridge, then VS Code wrapper relay, then direct fetch. */
export function getBridgeFetch() {
  if (hasAgentBridge()) return getAgentFetch();
  if (canUseParentBridgeFetch()) {
    return async (url, init) => {
      try {
        return await bridgeFetchViaParent(url, init);
      } catch (err) {
        const msg = String(err?.message || err);
        if (
          msg.includes('Parent bridge fetch timeout') ||
          msg.includes('Parent bridge unavailable')
        ) {
          return fetch(url, init);
        }
        throw err;
      }
    };
  }
  return fetch;
}
function readSbApiBaseOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get(SB_API_BASE_KEY) || params.get('sb_notify_base');
    if (fromQuery) return fromQuery;
  } catch (_a) {
    /* ignore */
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(SB_API_BASE_KEY) || sessionStorage.getItem('sb_notify_base');
    } catch (_b) {
      /* ignore */
    }
  }
  return null;
}
/** Extension IDE data-server origin (dynamic port), when sb_api_base is injected. */
export function getExtensionBridgeOrigin() {
  const override = readSbApiBaseOverride();
  if (!override) return null;
  try {
    const base = override.replace(/\/api\/?$/, '');
    const parsed = new URL(base);
    const host = parsed.hostname.toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost') return null;
    if (isIntegratedLocalDashboard() && isAgentJs4000Origin(parsed.origin)) return null;
    return parsed.origin;
  } catch (_a) {
    return null;
  }
}
function resolveBridgeOrigin() {
  const bridge = getExtensionBridgeOrigin();
  if (bridge) return bridge;
  if (isIntegratedLocalDashboard()) return null;
  return AGENT_4000_ORIGIN;
}
function isExtensionBridgeOrigin(origin) {
  const bridge = getExtensionBridgeOrigin();
  return !!bridge && bridge === origin;
}
/** True when the dashboard was loaded with sb_api_base (VS Code / Windsurf extension). */
export function hasExtensionBridgeConfigured() {
  return !!getExtensionBridgeOrigin();
}

/** Fetch that uses extension or VS Code wrapper bridge when available (bypasses HTTPS→localhost LNA). */
export function getLocalBridgeFetch() {
  return getBridgeFetch();
}

const DEFAULT_OLLAMA_ORIGIN = 'http://127.0.0.1:11434'; // simplebeacon-ignore hardcoded-url
const EXTENSION_PROBE_PORTS = [54358, 54697, 58681];

export function getVsixDownloadUrl() {
  return VSIX_DOWNLOAD_URL || '/downloads/simplebeacon.vsix';
}

/** vscode:// or cursor:// deep link — extension opens simplebeacon.ai with bridge params in the system browser. */
export function buildExtensionConnectDeepLink(route = 'chatbot') {
  if (typeof window === 'undefined') return '';
  const scheme = /Cursor/i.test(navigator.userAgent || '') ? 'cursor' : 'vscode';
  const segment =
    String(route || 'chatbot')
      .replace(/^\//, '')
      .replace(/^dashboard\/?/, '') || 'chatbot';
  return `${scheme}://${EXTENSION_ID}/connect?route=${encodeURIComponent(segment)}`;
}

function canProbeLoopbackPorts() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
  return isLoopback && window.location.protocol === 'http:';
}

function normalizeExtensionApiBase(value) {
  const trimmed = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!trimmed) return null;
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/**
 * Probe common SimpleBeacon data-server ports for /api/ping.
 * Skips loopback probes on hosted HTTPS (mixed content / CORS) unless the browser
 * extension bridge is active — use sb_api_base from VS Code or Connect button instead.
 * @param {number[]} [ports]
 * @param {{ userInitiated?: boolean }} [options]
 * @returns {Promise<string|null>} API base e.g. http://127.0.0.1:54358/api
 */
export async function probeExtensionDataServer(ports = EXTENSION_PROBE_PORTS, _options = {}) {
  if (typeof window === 'undefined') return null;
  if (!canProbeLoopbackPorts()) return null;
  const doFetch = getLocalBridgeFetch();
  for (const port of ports) {
    const origin = `http://127.0.0.1:${port}`; // simplebeacon-ignore hardcoded-url
    if (isMixedContent(origin) && !hasAgentBridge()) continue;
    try {
      const res = await doFetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2200) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && (data.service === 'simplebeacon-bridge' || data.platform === 'Simplebeacon')) {
          return `${origin}/api`;
        }
      }
      const pingRes = await doFetch(`${origin}/api/ping`, { signal: AbortSignal.timeout(2200) });
      if (!pingRes.ok) continue;
      const data = await pingRes.json().catch(() => ({}));
      if (data && (data.online === true || data.status === 'ok')) return `${origin}/api`;
    } catch {
      /* extension not on this port */
    }
  }
  return null;
}

/** Discover a running VS Code extension data-server and persist bridge params in this tab. */
export async function discoverAndApplyExtensionBridge(options = {}) {
  const stored = readSbApiBaseOverride();
  const normalizedStored = stored ? normalizeExtensionApiBase(stored) : null;
  if (hasExtensionBridgeConfigured() && normalizedStored) {
    if (!canProbeLoopbackPorts()) {
      if (options.userInitiated) {
        const health = await probeExtensionBridgeHealth();
        if (health.ok) {
          return { ok: true, source: 'probe', apiBase: normalizedStored };
        }
      }
      if (hasExplicitBridgeParam()) {
        return { ok: true, source: 'existing', apiBase: normalizedStored, unverified: true };
      }
      clearExtensionBridge({ updateUrl: true });
      return { ok: false, source: 'stale' };
    }
    let ports = EXTENSION_PROBE_PORTS;
    try {
      const port = Number(new URL(String(stored).replace(/\/api\/?$/, '')).port);
      if (port) ports = [port];
    } catch (_a) {
      /* use defaults */
    }
    const alive = await probeExtensionDataServer(ports);
    if (!alive) {
      if (hasExplicitBridgeParam()) {
        return { ok: true, source: 'existing', apiBase: normalizedStored, unverified: true };
      }
      clearExtensionBridge({ updateUrl: true });
      return { ok: false, source: 'stale' };
    }
    return { ok: true, source: 'existing', apiBase: alive };
  }
  if (!canProbeLoopbackPorts()) {
    return {
      ok: false,
      source: isHostedHttpsDashboard() ? 'hosted-https' : 'none',
      needsDeepLink: isHostedHttpsDashboard(),
    };
  }
  const apiBase = await probeExtensionDataServer();
  if (!apiBase) {
    return { ok: false, source: 'none' };
  }
  const applied = persistExtensionBridge(apiBase, { websiteMode: true, updateUrl: true });
  return applied ? { ok: true, source: 'probe', apiBase } : { ok: false, source: 'denied' };
}

/** Validate stored bridge on page load. Only clear it if there was no explicit user/extension-provided param. */
export async function validateExtensionBridgeOnLoad() {
  if (typeof window === 'undefined') return { ok: false };
  const override = readSbApiBaseOverride();
  if (!override) return { ok: false, source: 'none' };
  const normalized = normalizeExtensionApiBase(override);
  if (!canProbeLoopbackPorts()) {
    if (hasExplicitBridgeParam()) {
      return { ok: true, apiBase: normalized, source: 'existing', unverified: true };
    }
    clearExtensionBridge({ updateUrl: true });
    return { ok: false, source: 'stale' };
  }
  let port = 54358;
  try {
    port = Number(new URL(override.replace(/\/api\/?$/, '')).port) || 54358;
  } catch (_a) {
    /* default port */
  }
  const apiBase = await probeExtensionDataServer([port]);
  if (apiBase) return { ok: true, apiBase };
  if (hasExplicitBridgeParam())
    return { ok: true, apiBase: normalized, source: 'existing', unverified: true };
  clearExtensionBridge({ updateUrl: true });
  return { ok: false, source: 'stale' };
}

export function hasExplicitBridgeParam() {
  if (typeof location === 'undefined') return false;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('sb_api_base') || params.get('sb_notify_base')) return true;
  } catch (_a) {
    /* ignore */
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base'))
        return true;
    }
  } catch (_b) {
    /* ignore */
  }
  return false;
}

/**
 * Resolve an Ollama API URL. When sb_api_base points at the extension data server,
 * route through its proxy so https://simplebeacon.ai can reach local Ollama.
 * @param {string} ollamaPath e.g. '/api/tags' or '/api/chat'
 * @param {string} [baseUrl] Ollama origin, default 127.0.0.1:11434
 * @returns {string}
 */
export function resolveOllamaProxyUrl(ollamaPath, baseUrl = DEFAULT_OLLAMA_ORIGIN) {
  const normalized = String(baseUrl || DEFAULT_OLLAMA_ORIGIN).replace(/\/+$/, '');
  const path = String(ollamaPath || '').startsWith('/')
    ? String(ollamaPath)
    : `/${ollamaPath || ''}`;
  const bridge = getExtensionBridgeOrigin();
  if (bridge) {
    const qs = `baseUrl=${encodeURIComponent(normalized)}`;
    if (path === '/api/tags') {
      return `${bridge}/api/simplebeacon/ollama/models?${qs}`;
    }
    if (path === '/api/chat') {
      return `${bridge}/api/simplebeacon/ollama/chat?${qs}`;
    }
    return `${bridge}/api/simplebeacon/ollama/proxy?${qs}&path=${encodeURIComponent(path)}`;
  }
  return `${normalized}${path}`;
}

async function parseOllamaProbeResponse(res) {
  if (!res.ok) {
    return { ok: false, corsBlocked: res.status === 403, status: res.status };
  }
  try {
    const data = await res.json();
    if (data && data.source === 'ollama-proxy') {
      if (data.error && !(Array.isArray(data.models) && data.models.length)) {
        return {
          ok: false,
          corsBlocked: false,
          status: res.status,
          error: data.error,
          bridgeReachable: true,
        };
      }
      return { ok: true, corsBlocked: false, status: res.status, bridgeReachable: true };
    }
    if (data && Array.isArray(data.models)) {
      return { ok: true, corsBlocked: false, status: res.status };
    }
  } catch (_a) {
    // Direct Ollama /api/tags may not be JSON in edge cases — treat HTTP 200 as success.
  }
  return { ok: true, corsBlocked: false, status: res.status };
}

function buildBridgeOllamaProbeUrls(baseUrl = DEFAULT_OLLAMA_ORIGIN) {
  const normalized = String(baseUrl || DEFAULT_OLLAMA_ORIGIN).replace(/\/+$/, '');
  const bridge = getExtensionBridgeOrigin();
  if (!bridge) {
    return [`${normalized}/api/tags`];
  }
  const qs = `baseUrl=${encodeURIComponent(normalized)}`;
  return [
    `${bridge}/api/simplebeacon/ollama/models?${qs}`,
    `${bridge}/api/tags?${qs}`,
    `${bridge}/api/simplebeacon/ollama/proxy?${qs}&path=${encodeURIComponent('/api/tags')}`,
  ];
}

/** Probe URLs for Ollama chat through the extension data server (new + legacy paths). */
export function buildBridgeOllamaChatUrls(baseUrl = DEFAULT_OLLAMA_ORIGIN) {
  const normalized = String(baseUrl || DEFAULT_OLLAMA_ORIGIN).replace(/\/+$/, '');
  const bridge = getExtensionBridgeOrigin();
  if (!bridge) {
    return [`${normalized}/api/chat`];
  }
  const qs = `baseUrl=${encodeURIComponent(normalized)}`;
  return [
    `${bridge}/api/simplebeacon/ollama/chat?${qs}`,
    `${bridge}/api/simplebeacon/ollama/proxy?${qs}&path=${encodeURIComponent('/api/chat')}`,
  ];
}

export { buildBridgeOllamaProbeUrls };

/** Lightweight health check for the VS Code extension data server on localhost. */
export async function probeExtensionBridgeHealth() {
  const bridge = getExtensionBridgeOrigin();
  if (!bridge) {
    return { ok: false, reason: 'no-bridge' };
  }
  const doFetch = getLocalBridgeFetch();
  try {
    const res = await doFetch(`${bridge}/api/ping`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      return { ok: false, reason: 'ping-failed', status: res.status };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: data?.online !== false, reason: 'ping-ok' };
  } catch (err) {
    return { ok: false, reason: 'unreachable', error: String(err?.message || err) };
  }
}

/**
 * Probe Ollama on the user's machine (127.0.0.1:11434).
 * Works from HTTP localhost dashboards and from HTTPS hosted dashboards when the
 * browser allows private-network requests or the extension bridge is active.
 * @param {string} [baseUrl]
 * @returns {Promise<boolean>}
 */
export async function probeLocalOllama(baseUrl = DEFAULT_OLLAMA_ORIGIN) {
  if (typeof window === 'undefined') return false;
  const origin = String(baseUrl || DEFAULT_OLLAMA_ORIGIN).replace(/\/$/, '');
  // Hosted dashboard: never auto-probe loopback — use Connect local Ollama (probeUserInitiatedOllama).
  if (isHostedHttpsDashboard()) return false;
  if (!shouldProbeOllamaModels(origin)) return false;
  const doFetch = getLocalBridgeFetch();
  const probeUrl = resolveOllamaProxyUrl('/api/tags', origin);
  // On an HTTPS-hosted dashboard, probing an HTTP loopback URL will be blocked by the
  // browser's mixed-content / Local Network Access policy unless a runtime agent bridge
  // is actually present to intercept the fetch.
  if (isHostedHttpsDashboard() && isMixedContent(probeUrl) && !hasAgentBridge()) {
    return false;
  }
  try {
    const res = await doFetch(probeUrl, { signal: AbortSignal.timeout(2500) });
    const parsed = await parseOllamaProbeResponse(res);
    return parsed.ok;
  } catch {
    return false;
  }
}

/** Single user-initiated probe (Connect local Ollama) — bypasses hosted auto-probe guard. */
export async function probeUserInitiatedOllama(baseUrl = DEFAULT_OLLAMA_ORIGIN) {
  if (typeof window === 'undefined') return { ok: false, corsBlocked: false, status: 0 };
  const origin = String(baseUrl || DEFAULT_OLLAMA_ORIGIN).replace(/\/$/, '');
  const siteOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://simplebeacon.ai';
  // Hosted HTTPS can reach Ollama directly when OLLAMA_ORIGINS allows the site origin.
  // Chrome will prompt for Local Network Access permission; Firefox/Safari may block silently.
  // Fall through to the normal probe loop — if the fetch fails, report the error.
  const doFetch = getLocalBridgeFetch();
  const viaBridge = hasExtensionBridgeConfigured();
  const bridgeHealth = viaBridge ? await probeExtensionBridgeHealth() : { ok: false };
  const probeUrls = buildBridgeOllamaProbeUrls(origin);
  let lastResult = { ok: false, corsBlocked: false, status: 0, error: '' };
  for (const probeUrl of probeUrls) {
    try {
      const res = await doFetch(probeUrl, { signal: AbortSignal.timeout(4000) });
      const parsed = await parseOllamaProbeResponse(res);
      lastResult = { ...parsed, status: parsed.status || res.status };
      if (parsed.ok) {
        return { ok: true, corsBlocked: false, status: parsed.status };
      }
      if (res.status !== 404) {
        break;
      }
    } catch (err) {
      const msg = String(err?.message || err).toLowerCase();
      const isLocalNetworkAccessBlocked =
        msg.includes('local network access') ||
        msg.includes('private network access') ||
        msg.includes('permission required');
      lastResult = {
        ok: false,
        corsBlocked: isLocalNetworkAccessBlocked,
        status: 0,
        error: String(err?.message || err),
      };
      if (!viaBridge) {
        break;
      }
    }
  }
  if (viaBridge) {
    if (bridgeHealth.ok && lastResult.status === 404) {
      return {
        ok: false,
        corsBlocked: false,
        status: 404,
        error:
          'Extension data server is running but Ollama proxy routes returned 404. Install the latest SimpleBeacon VSIX, reload VS Code, then run ollama serve locally.',
      };
    }
    if (bridgeHealth.ok && lastResult.bridgeReachable && lastResult.error) {
      return {
        ok: false,
        corsBlocked: false,
        status: lastResult.status || 502,
        error: `Extension bridge connected. ${lastResult.error}`,
      };
    }
    if (!bridgeHealth.ok) {
      return {
        ok: false,
        corsBlocked: lastResult.corsBlocked,
        status: lastResult.status,
        error: lastResult.corsBlocked
          ? `Browser blocked access to the VS Code extension data server. Grant Local Network Access for ${siteOrigin}, or open this page from the SimpleBeacon sidebar in VS Code.`
          : 'Extension data server unreachable. Reload the VS Code extension and try again.',
      };
    }
    return {
      ok: false,
      corsBlocked: false,
      status: lastResult.status,
      error:
        lastResult.error || 'Extension bridge could not reach Ollama. Run ollama serve locally.',
    };
  }
  try {
    const res = await doFetch(probeUrls[0], { signal: AbortSignal.timeout(4000) });
    const parsed = await parseOllamaProbeResponse(res);
    if (parsed.ok) {
      return { ok: true, corsBlocked: false, status: parsed.status };
    }
    return { ok: false, corsBlocked: res.status === 403, status: res.status, error: parsed.error };
  } catch (err) {
    const msg = String(err?.message || err).toLowerCase();
    const isLocalNetworkAccessBlocked =
      msg.includes('local network access') ||
      msg.includes('private network access') ||
      msg.includes('permission required');
    const corsBlocked =
      isLocalNetworkAccessBlocked ||
      msg.includes('cors') ||
      msg.includes('cross-origin') ||
      msg.includes('networkerror') ||
      msg.includes('failed to fetch');
    return { ok: false, corsBlocked, status: 0 };
  }
}

/**
 * Locate a dropped folder by name via the extension bridge.
 * Checks the workspace path first, then falls back to /api/find-folder.
 * @param {string} folderName
 * @returns {Promise<string|null>} Absolute path, or null if not found / unavailable.
 */
export async function findFolderViaBridge(folderName) {
  const origin = getExtensionBridgeOrigin();
  if (!origin) return null;
  const health = await probeExtensionBridgeHealth();
  if (!health.ok) return null;
  const doFetch = getLocalBridgeFetch();
  try {
    const statusRes = await doFetch(`${origin}/api/status`, {
      headers: { Accept: 'application/json' },
    });
    const status = await statusRes.json().catch(() => ({}));
    if (status.workspace) {
      const wsName = String(status.workspace).replace(/\\/g, '/').split('/').pop() || '';
      if (wsName.toLowerCase() === String(folderName).toLowerCase()) {
        return String(status.workspace);
      }
    }
  } catch {
    /* fall through to find-folder */
  }
  try {
    const response = await doFetch(
      `${origin}/api/find-folder`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName }),
      },
      25000
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const results = Array.isArray(body.results) ? body.results : [];
    if (results.length > 0) return String(results[0]);
    return null;
  } catch (_a) {
    return null;
  }
}

/**
 * Open the native OS folder picker via the extension data server (works in cross-origin iframes).
 * @returns {Promise<string|null>} Absolute path, or null if cancelled / unavailable.
 */
export async function pickFolderViaExtensionBridge() {
  const origin = getExtensionBridgeOrigin();
  if (!origin) return null;
  const health = await probeExtensionBridgeHealth();
  if (!health.ok) return null;
  const doFetch = getLocalBridgeFetch();
  try {
    const response = await doFetch(
      `${origin}/api/analyze/pick-folder`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}',
      },
      AGENT_TIMEOUT_MS
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success !== true) return null;
    const picked = String(body.path || '').trim();
    return picked || null;
  } catch (_a) {
    return null;
  }
}
async function agentFetchWithTimeout(url, options = {}, timeoutMs = 300000) {
  const doFetch = getBridgeFetch();
  const timeout = new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('Local agent request timed out')), timeoutMs);
  });
  const response = await Promise.race([doFetch(url, options), timeout]);
  return response;
}
export function isLocalPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw)) return false;
  const isWindowsClient =
    typeof navigator !== 'undefined' && /Win(dows|32|64)/i.test(navigator.userAgent || '');
  if (isWindowsClient) {
    return /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\/.test(raw);
  }
  return (
    /^[A-Za-z]:[\\/]/.test(raw) || /^\/[^/]/.test(raw) || /^~[\\/]/.test(raw) || /^\\\\/.test(raw)
  );
}
/**
 * Probe the local agent health endpoint.
 * @param {string} [origin]
 * @returns {Promise<{available:boolean, scannerAvailable:boolean, version?:string}>}
 */
export async function probeAgent(origin = DEFAULT_AGENT_ORIGIN) {
  if (!shouldProbeLocalAgent()) {
    return isIntegratedLocalDashboard() ? INTEGRATED_AGENT_SKIP : HOSTED_AGENT_OFFLINE;
  }
  const now = Date.now();
  if (cachedAgentStatus && probeCacheFresh(cachedAt, cachedAgentStatus)) {
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
      const response = await agentFetchWithTimeout(
        `${origin}/health`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        AGENT_TIMEOUT_MS
      );
      const body = await response.json().catch(() => ({}));
      const status = {
        available: response.ok && body.success === true,
        scannerAvailable: Boolean(body.scannerAvailable),
        scannerLoadError: body.scannerLoadError || undefined,
        version: body.version || undefined,
      };
      cachedAgentStatus = status;
      cachedAt = Date.now();
      return status;
    } catch (err) {
      const likelyBlocked = !hasAgentBridge() && isMixedContentBlocked(origin, err);
      cachedAgentStatus = { available: false, scannerAvailable: false, likelyBlocked };
      cachedAt = Date.now();
      return cachedAgentStatus;
    } finally {
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
  if (isMixedContent(origin)) return true;
  if (!origin || !origin.startsWith('http://')) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  const message = String(
    (err === null || err === void 0 ? void 0 : err.message) || ''
  ).toLowerCase();
  return (
    message.includes('mixed content') ||
    message.includes('insecure') ||
    message.includes('blocked') ||
    message.includes('failed to fetch') ||
    message.includes('ns_error')
  );
}
function isMixedContent(origin) {
  if (!origin || !origin.startsWith('http://')) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('sb_api_base') || params.get('sb_notify_base')) return false;
    if (
      typeof sessionStorage !== 'undefined' &&
      (sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base'))
    )
      return false;
  } catch (_a) {
    /* ignore */
  }
  return true;
}
/**
 * Fetch repository inventory through the local agent.
 * @param {string} projectPath
 * @param {Object} [options]
 * @param {string} [origin]
 * @returns {Promise<Object>}
 */
export async function fetchInventoryViaAgent(
  projectPath,
  options = {},
  origin = DEFAULT_AGENT_ORIGIN
) {
  const response = await agentFetchWithTimeout(`${origin}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ projectPath, fullDirectoryScan: options.fullDirectoryScan }),
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
  const response = await agentFetchWithTimeout(
    `${resolvedOrigin}/scan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        projectPath,
        fullDirectoryScan: scanOptions.fullDirectoryScan === true,
      }),
    },
    600000
  );
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
  const response = await agentFetchWithTimeout(
    `${origin}/progress?${params}`,
    {
      headers: { Accept: 'application/json' },
    },
    15000
  );
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
    const response = await agentFetchWithTimeout(
      `${origin}/api/simplebeacon/scan/progress?${params}`,
      {
        headers: { Accept: 'application/json' },
      },
      15000
    );
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
      return { active: false, endpointUnavailable: true };
    }
    if (!response.ok) {
      return { active: false };
    }
    return data.progress || { active: false };
  } catch (_a) {
    return { active: false, endpointUnavailable: true };
  }
}
/**
 * Probe the lightweight localhost bridge used for typed local path scans.
 * Prefers the VS Code extension data server (sb_api_base) over standalone agent.js:4000.
 * @param {string} [origin]
 */
export async function probeAgent4000(origin = resolveBridgeOrigin()) {
  if (!shouldProbeAgent4000()) {
    return {
      available: false,
      likelyBlocked: false,
      extensionBridge: false,
      origin: resolveBridgeOrigin() || AGENT_4000_ORIGIN,
      integratedSkipped: isIntegratedLocalDashboard(),
    };
  }
  if (!origin) {
    return {
      available: false,
      likelyBlocked: false,
      extensionBridge: false,
      origin: AGENT_4000_ORIGIN,
      integratedSkipped: true,
    };
  }
  const extensionBridge = isExtensionBridgeOrigin(origin);
  if (isHostedHttpsDashboard() && !extensionBridge && !hasAgentBridge()) {
    return {
      available: false,
      likelyBlocked: false,
      extensionBridge: false,
      origin,
      hostedSkipped: true,
    };
  }
  const now = Date.now();
  if (
    cachedAgent4000Status &&
    cachedAgent4000Status.origin === origin &&
    probeCacheFresh(cachedAgent4000At, cachedAgent4000Status)
  ) {
    return cachedAgent4000Status;
  }
  if (pendingProbe4000) {
    return pendingProbe4000;
  }
  pendingProbe4000 = (async () => {
    // When served over HTTPS, plain HTTP localhost fetches are blocked by
    // mixed-content rules in some browsers. If the user explicitly configured
    // an extension bridge (sb_api_base), still attempt the ping so we can
    // prefer the extension path when it is reachable; otherwise skip it.
    if (!extensionBridge && !hasAgentBridge() && isMixedContent(origin)) {
      const status = { available: false, likelyBlocked: true, extensionBridge, origin };
      cachedAgent4000Status = status;
      cachedAgent4000At = Date.now();
      return status;
    }
    try {
      const response = await agentFetchWithTimeout(
        `${origin}/api/ping`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        AGENT_TIMEOUT_MS
      );
      const body = await response.json().catch(() => ({}));
      const status = {
        available: response.ok && body.online === true,
        extensionBridge,
        origin,
      };
      cachedAgent4000Status = status;
      cachedAgent4000At = Date.now();
      return status;
    } catch (_a) {
      const status = { available: false, extensionBridge, origin };
      cachedAgent4000Status = status;
      cachedAgent4000At = Date.now();
      return status;
    } finally {
      pendingProbe4000 = null;
    }
  })();
  return pendingProbe4000;
}

const SCAN_POLL_INTERVAL_MS = 1500;
const SCAN_POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollForScanCompletion(origin, projectPath, doFetch) {
  const startTime = Date.now();
  let inactiveCount = 0;
  while (Date.now() - startTime < SCAN_POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, SCAN_POLL_INTERVAL_MS));
    try {
      const progressRes = await doFetch(
        `${origin}/api/simplebeacon/scan/progress?projectPath=${encodeURIComponent(projectPath)}`
      );
      const progressData = await progressRes.json().catch(() => ({}));
      const progress = progressData.progress || {};
      if (!progress.active) {
        inactiveCount++;
        if (inactiveCount >= 3) {
          const reportRes = await doFetch(`${origin}/api/report`);
          const reportData = await reportRes.json().catch(() => ({}));
          if (reportData && Object.keys(reportData).length > 0) {
            return reportData;
          }
          throw new Error('Scan completed but no report is available');
        }
        continue;
      }
      inactiveCount = 0;
    } catch (err) {
      throw new Error(`Scan polling failed: ${err.message || err}`);
    }
  }
  throw new Error('Scan timed out after 5 minutes');
}

/**
 * Run a scan through the localhost bridge (extension data server or agent.js:4000).
 * @param {string} projectPath
 * @param {string} [origin]
 */
export async function scanViaAgent4000(projectPath, origin = resolveBridgeOrigin()) {
  if (isExtensionBridgeOrigin(origin)) {
    const doFetch = getLocalBridgeFetch();
    const response = await doFetch(`${origin}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ path: projectPath }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.warning || `Extension scan failed (${response.status})`);
    }
    if (data.scanning) {
      const report = await pollForScanCompletion(origin, projectPath, doFetch);
      return {
        success: true,
        extensionBridge: true,
        report,
        path: projectPath,
        scannedPath: data.scannedPath || projectPath,
        metrics: null,
      };
    }
    return {
      success: true,
      extensionBridge: true,
      report: data.report,
      path: projectPath,
      scannedPath: data.scannedPath || projectPath,
      metrics: data.metrics,
    };
  }
  const response = await agentFetchWithTimeout(`${origin}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ path: projectPath }),
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
  if (!container) return;
  container.replaceChildren();
  const cert = report && report.certificate;
  if (!cert) return;
  const files = report.files || [];
  const issueFiles = files.filter((f) => f.status && f.status !== 'Clean');
  const cleanCount = files.length - issueFiles.length;
  const discovered =
    typeof report.discoveredFiles === 'number' ? report.discoveredFiles : files.length;
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
    ...(skipped > 0 ? [{ label: 'Skipped', value: `${skipped} unreadable` }] : []),
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
    { label: 'Export report', route: 'export' },
  ];
  actionDefs.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      item.route === 'results' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
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
      { id: 'clean', label: `Clean (${cleanCount})` },
    ];
    const list = document.createElement('div');
    list.className = 'sb-compliance-files-list';
    const renderList = () => {
      list.replaceChildren();
      let rows = files;
      if (activeFilter === 'issues') rows = issueFiles;
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
        toolbar
          .querySelectorAll('.sb-compliance-filter')
          .forEach((el) => el.classList.remove('is-active'));
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
  if (
    !(agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.available) ||
    !(agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.scannerAvailable)
  )
    return false;
  return isLocalPath(projectPath);
}
/** True when the dashboard is served over HTTPS on a non-localhost host (Pages, production). */
export function isHostedHttpsDashboard() {
  if (typeof window === 'undefined') return false;
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return false;
  return window.location.protocol === 'https:';
}
/** Skip standalone agent.js:4000 when the integrated dashboard already serves /api on this origin. */
export function shouldProbeAgent4000() {
  if (hasAgentBridge()) return true;
  const bridge = getExtensionBridgeOrigin();
  if (bridge) return true;
  if (isHostedHttpsDashboard()) return false;
  if (isIntegratedLocalDashboard()) return false;
  return canProbeLoopbackPorts();
}
/** Skip doomed localhost agent probes on hosted HTTPS unless an extension bridge is configured. */
export function shouldProbeLocalAgent() {
  if (isHostedHttpsDashboard()) {
    return hasAgentBridge() || hasExtensionBridgeConfigured();
  }
  if (isIntegratedLocalDashboard() && !getExtensionBridgeOrigin() && !hasAgentBridge()) {
    return false;
  }
  return true;
}
const HOSTED_AGENT_OFFLINE = {
  available: false,
  scannerAvailable: false,
  hostedSkipped: true,
};
const INTEGRATED_AGENT_SKIP = {
  available: false,
  scannerAvailable: false,
  integratedSkipped: true,
};
/**
 * Format a status message for the UI.
 */
export function formatAgentStatus(agentStatus) {
  if (!agentStatus) return '';
  // Hosted dashboard: in-browser folder scan is primary — suppress agent nag when offline.
  if (isHostedHttpsDashboard() && (!agentStatus.available || agentStatus.hostedSkipped)) return '';
  if (!agentStatus.available) {
    if (agentStatus.likelyBlocked && !isHostedHttpsDashboard()) {
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
  var _a, _b, _c;
  if (
    isHostedHttpsDashboard() &&
    (!(agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.available) ||
      (agentStatus === null || agentStatus === void 0 ? void 0 : agentStatus.hostedSkipped))
  ) {
    return 'Use Select Folder above to scan your project privately in this browser. Typed PC paths cannot be read from the hosted dashboard.';
  }
  if ((_a = agentStatus) === null || _a === void 0 ? void 0 : _a.likelyBlocked) {
    return 'HTTPS blocks direct access to the Local Scan Agent. Install the Simplebeacon Browser Extension, open this page in Chrome/Edge, or run the local dashboard.';
  }
  if (!((_b = agentStatus) === null || _b === void 0 ? void 0 : _b.available)) {
    return 'Local Scan Agent is offline. Download and run it from the link below, then try again.';
  }
  if (!((_c = agentStatus) === null || _c === void 0 ? void 0 : _c.scannerAvailable)) {
    var _d;
    const error = ((_d = agentStatus) === null || _d === void 0 ? void 0 : _d.scannerLoadError)
      ? ` (${agentStatus.scannerLoadError})`
      : '';
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
    unknown: 'your platform',
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
