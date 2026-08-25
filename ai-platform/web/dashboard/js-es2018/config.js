// simplebeacon-ignore ai-indicators
/**
 * Runtime configuration — values are injected by the server via window.__SIMPLEBEACON_ENV__.
 * Falls back to development defaults when served as static files.
 */
const env = (typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__) || {};
/**
 * D a s h b o a r d  b a s e  u r l.
 */
export const DASHBOARD_BASE_URL = env.DASHBOARD_BASE_URL || (typeof window !== 'undefined' && window.__SB_API_HOST__) || '';
/**
 * O l l a m a  d e f a u l t  u r l.
 */
export const OLLAMA_DEFAULT_URL = env.OLLAMA_DEFAULT_URL || 'http://127.0.0.1:11434'; // simplebeacon-ignore hardcoded-url — default local Ollama URL for static dashboards
/**
 * C o m i n g  s o o n  u r l.
 */
export const COMING_SOON_URL = env.COMING_SOON_URL || '/';
/** Latest VS Code extension package for hosted-dashboard bridge setup. */
export const VSIX_DOWNLOAD_URL = env.VSIX_DOWNLOAD_URL
    || (typeof window !== 'undefined' && window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.vsixDownloadUrl)
    || 'https://simplebeacon.ai/downloads/simplebeacon.vsix';
export const EXTENSION_ID = env.EXTENSION_ID || 'simplebeacon.simplebeacon-vscode';
/** Portable local scan agent (~70 MiB) — hosted on GitHub releases, not Cloudflare Pages. */
export const LOCAL_AGENT_DOWNLOAD_URL = env.LOCAL_AGENT_DOWNLOAD_URL
    || (typeof window !== 'undefined' && window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.localAgentDownloadUrl)
    || 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon-local-agent-portable.zip';
// DEMO_PASSWORD removed — token-based auth only, no hardcoded credentials

/**
 * Build a safe API URL for a given path segment.
 * Ensures the base has no trailing `/api` and the returned URL contains exactly one `/api` prefix.
 */
export function apiUrl(path) {
    const envBase = env.API_BASE_URL || env.DASHBOARD_BASE_URL || '';
    const detected = (typeof window !== 'undefined' && (window.__SB_API_HOST__ || window.__SIMPLEBEACON_DETECTED_API_BASE)) || '';
    const base = String(envBase || detected).replace(/\/+$/, '').replace(/\/api$/i, '');
    const segment = String(path || '').replace(/^\/+/, '');
    if (!segment)
        return base || '/';
    if (base)
        return `${base}/api/${segment}`;
    return `/api/${segment}`;
}

// Background probe for local API - set window.__SB_API_HOST__ when found
if (typeof window !== 'undefined') {
    (function detectLocalApiBase() {
        try {
            var params = new URLSearchParams(window.location.search);
            if (params.get('sb_api_base')) return;
            if (window.__SB_API_HOST__ || window.__SIMPLEBEACON_DETECTED_API_BASE) return;
            var ports = [3000, 58000, 64772, 3001, 3002, 4000, 8080, 50559, 54358];
            var endpoints = ['/api/platform/status', '/api/prompts/get?userId=anonymous', '/api/health', '/api/theme'];
            function probe(url, timeout) {
                timeout = timeout || 1200;
                return new Promise(function (resolve) {
                    var controller = new AbortController();
                    var id = setTimeout(function () { controller.abort(); resolve(false); }, timeout);
                    fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal, credentials: 'include' }).then(function (res) {
                        clearTimeout(id);
                        resolve(!!(res && (res.ok || res.status === 401 || res.status === 403 || res.status === 404)));
                    }).catch(function () { clearTimeout(id); resolve(false); });
                });
            }
            (async function () {
                for (var i = 0; i < ports.length; i++) {
                    var port = ports[i];
                    for (var j = 0; j < endpoints.length; j++) {
                        var url = 'http://127.0.0.1:' + port + endpoints[j];
                        var ok = await probe(url, 1200);
                        if (ok) {
                            window.__SB_API_HOST__ = 'http://127.0.0.1:' + port;
                            window.__SIMPLEBEACON_DETECTED_API_BASE = window.__SB_API_HOST__;
                            return;
                        }
                    }
                }
            })();
        } catch (e) {
            console.error('config.js error:', e);
            // ignore
        }
    })();
}
