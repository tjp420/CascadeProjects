// simplebeacon-ignore ai-indicators, governance-marker
import { DASHBOARD_BASE_URL, OLLAMA_DEFAULT_URL } from '../config.js';
import { apiBaseUrl } from '../utils-lib/url.js';

import { authService } from './authService.js?v=20260722bridgefix1';
import {
    hasExtensionBridgeConfigured,
    getLocalBridgeFetch,
    getExtensionBridgeOrigin,
    buildBridgeOllamaProbeUrls
} from './localAgentService.js?v=20260720ollama4';
/**
 * Is authenticated.
 * @returns {any}
 */
function isAuthenticated() {
    return authService.isAuthenticated();
}
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';
const BASE = '/api/simplebeacon/user/ai-keys';
// Cool-down after 401/403 to prevent request spam from multiple views
let _lastAuthFailure = 0;
const AUTH_FAILURE_COOLDOWN_MS = 30000;
let _aiKeysPromise = null;
/**
 * Has valid user jwt.
 * @returns {any}
 */
function hasValidUserJwt() {
    var _a;
    const token = ((_a = authService.getToken) === null || _a === void 0 ? void 0 : _a.call(authService)) || '';
    // User endpoints need a real JWT (3 dot-separated segments).
    // License keys and legacy tokens are not valid here.
    return token && token.split('.').length === 3;
}

/** Whether the current session can load/save encrypted AI keys on the server. */
export function userHasJwtForAiKeys() {
    return isAuthenticated() && hasValidUserJwt();
}
/**
 * Normalize ai keys record.
 * @param {any} keysRecord
 * @returns {any}
 */
export function normalizeAiKeysRecord(keysRecord = null) {
    if (!keysRecord || typeof keysRecord !== 'object') {
        return {
            email: '',
            providers: {},
            ollamaBaseUrl: '',
            ollamaModel: '',
            updatedAt: null
        };
    }
    return {
        email: keysRecord.email || '',
        providers: keysRecord.providers || {},
        ollamaBaseUrl: sanitizeOllamaBaseUrl(keysRecord.ollamaBaseUrl) || '',
        ollamaModel: keysRecord.ollamaModel || '',
        updatedAt: keysRecord.updatedAt || null
    };
}
/**
 * Fetch user ai keys.
 * @returns {any}
 */
export async function fetchUserAiKeys(options = {}) {
    if (!isAuthenticated() || !hasValidUserJwt()) {
        return normalizeAiKeysRecord(null);
    }
    if (Date.now() - _lastAuthFailure < AUTH_FAILURE_COOLDOWN_MS) {
        return normalizeAiKeysRecord(null);
    }
    if (!options.refresh && _aiKeysPromise) {
        return _aiKeysPromise;
    }
    _aiKeysPromise = fetch(BASE, { headers: authService.getAuthHeaders() })
        .then(async keysHttpResponse => {
            const keysPayload = await readJsonResponseBody(keysHttpResponse, {});
            if (!keysHttpResponse.ok || !keysPayload.success) {
                if (keysHttpResponse.status === 404 && keysPayload.error === 'API route not found') {
                    throw new Error(
                        'AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).'
                    );
                }
                const msg = keysPayload.error || keysPayload.message || '';
                if (
                    keysHttpResponse.status === 401 ||
                    keysHttpResponse.status === 403 ||
                    /Authentication required/i.test(msg)
                ) {
                    _lastAuthFailure = Date.now();
                    return normalizeAiKeysRecord(null);
                }
                throw new Error(msg || 'Failed to load AI keys');
            }
            return normalizeAiKeysRecord(keysPayload);
        })
        .catch(err => {
            _aiKeysPromise = null;
            throw err;
        });
    return _aiKeysPromise;
}
/**
 * Save user ai keys.
 * @param {any} payload
 * @returns {any}
 */
export async function saveUserAiKeys(payload) {
    if (!isAuthenticated() || !hasValidUserJwt()) {
        throw new Error('Authentication required. Log in to save AI provider keys securely.');
    }
    _aiKeysPromise = null;
    const saveHttpResponse = await fetch(BASE, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders()
        },
        body: JSON.stringify(payload)
    });
    const savePayload = await readJsonResponseBody(saveHttpResponse, {});
    if (!saveHttpResponse.ok || !savePayload.success) {
        if (saveHttpResponse.status === 404 && savePayload.error === 'API route not found') {
            throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
        }
        const debugPart = savePayload.debug ? ` (${savePayload.debug})` : '';
        throw new Error((savePayload.error || savePayload.message || 'Failed to save AI keys') + debugPart);
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simplebeacon:ai-keys-updated'));
    }
    return normalizeAiKeysRecord(savePayload);
}
/**
 * Clear user ai keys.
 * @returns {any}
 */
export async function clearUserAiKeys() {
    _aiKeysPromise = null;
    const clearHttpResponse = await fetch(BASE, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
    });
    const clearPayload = await readJsonResponseBody(clearHttpResponse, {});
    if (!clearHttpResponse.ok || !clearPayload.success) {
        if (clearHttpResponse.status === 404 && clearPayload.error === 'API route not found') {
            throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
        }
        throw new Error(clearPayload.error || clearPayload.message || 'Failed to clear AI keys');
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simplebeacon:ai-keys-updated'));
    }
    return normalizeAiKeysRecord(clearPayload);
}
/**
 * List Ollama models. When the dashboard is served over HTTPS, the browser
 * cannot directly fetch http://127.0.0.1:11434 (mixed content / private network),
 * so we route the request through the server proxy. On HTTP pages we try the
 * direct browser fetch first and fall back to the proxy.
 * @param {string} ollamaBaseUrl
 * @returns {any}
 */
function sanitizeOllamaBaseUrl(url) {
    return String(url || '')
        .trim()
        .replace(/^["']+|["']+$/g, '')
        .replace(/\/$/, '');
}

export function isLocalOllamaUrl(url) {
    try {
        const clean = sanitizeOllamaBaseUrl(url);
        if (!clean) return false;
        const parsed = new URL(clean);
        return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

/** Whether automatic Ollama probes should proceed.
 *  On HTTPS dashboards, direct browser→Ollama works when OLLAMA_ORIGINS is set.
 */
export function shouldProbeOllamaModels(ollamaBaseUrl = OLLAMA_DEFAULT_URL) {
    return true;
}

function isValidOllamaBaseUrl(url) {
    const clean = sanitizeOllamaBaseUrl(url);
    if (!clean) return false;
    try {
        const parsed = new URL(clean);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        if (parsed.port) {
            const portNum = Number(parsed.port);
            if (!portNum || portNum < 1 || portNum > 65535) return false;
        }
        return !!parsed.hostname;
    } catch {
        return false;
    }
}

let _ollamaModelsPromise = null;
let _ollamaModelsPromiseUrl = null;

function getApiBaseUrl() {
    const fromUrl = apiBaseUrl();
    if (fromUrl && fromUrl !== '/') {
        return String(fromUrl)
            .replace(/\/api\/?$/, '')
            .replace(/\/+$/, '');
    }
    return (DASHBOARD_BASE_URL || (typeof window !== 'undefined' ? window.__SB_API_HOST__ : '') || '').replace(
        /\/+$/,
        ''
    );
}

function isCorsError(err) {
    const msg = String(err && err.message ? err.message : err).toLowerCase();
    return (
        msg.includes('cors') ||
        msg.includes('cross-origin') ||
        msg.includes('blocked') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network error')
    );
}

export async function fetchOllamaModels(ollamaBaseUrl = OLLAMA_DEFAULT_URL) {
    const baseUrl = sanitizeOllamaBaseUrl(ollamaBaseUrl) || OLLAMA_DEFAULT_URL;
    if (!baseUrl) {
        return { ok: true, models: [], message: 'No Ollama base URL configured', source: 'none' };
    }
    if (!isValidOllamaBaseUrl(baseUrl)) {
        throw new Error('Invalid Ollama base URL — use http(s)://host:port (e.g. http://127.0.0.1:11434)');
    }
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

    const viaBridge = hasExtensionBridgeConfigured();
    if (!shouldProbeOllamaModels(baseUrl) && !viaBridge) {
        return {
            ok: false,
            models: [],
            message:
                'Local Ollama is not available on the hosted dashboard. Add OpenAI or Anthropic keys in Settings → AI providers, or run the dashboard locally.',
            source: 'blocked'
        };
    }

    // Coalesce concurrent requests for the same Ollama URL to avoid the
    // repeated rapid-fire requests shown in the browser console.
    if (_ollamaModelsPromise && _ollamaModelsPromiseUrl === baseUrl) {
        return _ollamaModelsPromise;
    }
    _ollamaModelsPromiseUrl = baseUrl;

    async function fetchDirect() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(`${baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Ollama returned HTTP ${response.status}`);
            }
            const data = await response.json().catch(() => ({}));
            const models = Array.isArray(data.models) ? data.models.map(m => m.name || m.model) : [];
            return {
                ok: true,
                models,
                message: models.length
                    ? `${models.length} model(s) available`
                    : 'Ollama is running but has no models pulled',
                source: 'browser'
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    async function fetchProxy() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const apiBase = getApiBaseUrl();
            // Prefer the new server-side proxy when available.
            const proxyPathNew = `/api/proxy/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`;
            const proxyPathLegacy = `/api/simplebeacon/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`;
            const proxyUrlNew = apiBase ? `${apiBase}${proxyPathNew}` : proxyPathNew;
            const proxyUrlLegacy = apiBase ? `${apiBase}${proxyPathLegacy}` : proxyPathLegacy;
            // Try new proxy first, then legacy simplebeacon proxy path.
            let response = await fetch(proxyUrlNew, {
                method: 'GET',
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            }).catch(() => null);
            if (!response || !response.ok) {
                // Try legacy proxy path as a fallback
                response = await fetch(proxyUrlLegacy, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { Accept: 'application/json' }
                });
            }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || data.message || `Server proxy returned HTTP ${response.status}`);
            }
            // Support both legacy raw upstream response (array/object) and our proxy wrapper { success, data }
            const modelsArray = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                  ? data.data
                  : Array.isArray(data?.models)
                    ? data.models
                    : [];
            const models = Array.isArray(modelsArray)
                ? modelsArray.map(m => (typeof m === 'string' ? m : m.name || m.model))
                : [];
            return {
                ok: true,
                models,
                message: models.length
                    ? `${models.length} model(s) available`
                    : 'Ollama is running but has no models pulled',
                source: 'server'
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    async function fetchBridgeProxy() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const doFetch = getLocalBridgeFetch();
        const probeUrls = buildBridgeOllamaProbeUrls(baseUrl);
        let lastStatus = 0;
        let lastMessage = '';
        let sawNotFound = false;
        try {
            for (const proxyUrl of probeUrls) {
                try {
                    const response = await doFetch(proxyUrl, {
                        method: 'GET',
                        signal: controller.signal,
                        headers: { Accept: 'application/json' }
                    });
                    lastStatus = response.status;
                    const data = await response.json().catch(() => ({}));
                    if (response.status === 404) {
                        sawNotFound = true;
                        lastMessage = data.error || data.message || 'Not found';
                        continue;
                    }
                    if (!response.ok) {
                        lastMessage = data.error || data.message || `HTTP ${response.status}`;
                        continue;
                    }
                    const models = Array.isArray(data.models)
                        ? data.models.map(m => (typeof m === 'string' ? m : m.name || m.model))
                        : [];
                    return {
                        ok: true,
                        models,
                        message: models.length
                            ? `${models.length} model(s) available`
                            : 'Ollama is running but has no models pulled',
                        source: 'bridge'
                    };
                } catch (err) {
                    if (err?.name === 'AbortError') {
                        throw new Error('Ollama connection timed out - is Ollama running?');
                    }
                    lastMessage = String(err?.message || err);
                }
            }
            const bridge = getExtensionBridgeOrigin();
            if (bridge) {
                try {
                    const providersRes = await doFetch(`${bridge}/api/chatbot/providers`, {
                        method: 'GET',
                        signal: controller.signal,
                        headers: { Accept: 'application/json' }
                    });
                    if (providersRes.ok) {
                        const providersData = await providersRes.json().catch(() => ({}));
                        const ollama = Array.isArray(providersData.providers)
                            ? providersData.providers.find(p => p.id === 'ollama')
                            : null;
                        if (ollama?.available) {
                            return {
                                ok: true,
                                models: [],
                                message:
                                    'Ollama is connected. Install the latest SimpleBeacon VSIX and reload VS Code to list models here, or enter a model name manually.',
                                source: 'bridge-providers'
                            };
                        }
                    }
                } catch (_providersErr) {
                    /* ignore */
                }
            }
            if (lastStatus === 404 || sawNotFound || /not found/i.test(lastMessage)) {
                throw new Error(
                    'Extension data server has no Ollama proxy routes (404). Install the latest SimpleBeacon VSIX from Settings or reload VS Code/Cursor.'
                );
            }
            throw new Error(lastMessage || 'Extension bridge could not reach Ollama');
        } finally {
            clearTimeout(timeout);
        }
    }

    const promise = (async () => {
        const apiBase = getApiBaseUrl();
        const preferProxy = isHttpsPage || !!apiBase;

        // When the VS Code extension bridge is present, proxy through its local data server first.
        if (viaBridge) {
            try {
                return await fetchBridgeProxy();
            } catch (bridgeErr) {
                if (bridgeErr.name === 'AbortError') {
                    return {
                        ok: false,
                        models: [],
                        message: 'Ollama connection timed out - is Ollama running?',
                        source: 'timeout'
                    };
                }
                const userMessage = /not found/i.test(bridgeErr.message || '')
                    ? 'Extension data server has no Ollama proxy routes (404). Install the latest SimpleBeacon VSIX from Settings or reload VS Code/Cursor.'
                    : bridgeErr.message || 'Extension bridge proxy failed';
                return {
                    ok: false,
                    models: [],
                    message: userMessage,
                    source: 'bridge-error'
                };
            }
        }

        // For HTTPS-hosted dashboards, the server proxy cannot reach a user's local Ollama.
        // The only viable path is a direct browser fetch, which requires OLLAMA_ORIGINS to be set.
        const isLocalOllama = isLocalOllamaUrl(baseUrl);
        if (isHttpsPage && isLocalOllama) {
            try {
                return await fetchDirect();
            } catch (browserErr) {
                const origin = (typeof window !== 'undefined' && window.location.origin) || 'this origin';
                return {
                    ok: false,
                    models: [],
                    message: `Ollama is reachable but its CORS policy blocks ${origin}. Start Ollama from your shell with: OLLAMA_ORIGINS='${origin}' ollama serve`,
                    source: 'cors-blocked'
                };
            }
        }

        // Local http dashboards: try server proxy first, then direct browser fetch.
        try {
            return await fetchProxy();
        } catch (proxyErr) {
            if (proxyErr.name === 'AbortError') {
                return {
                    ok: false,
                    models: [],
                    message: 'Ollama connection timed out - is Ollama running?',
                    source: 'timeout'
                };
            }
            try {
                return await fetchDirect();
            } catch (browserErr) {
                const origin = (typeof window !== 'undefined' && window.location.origin) || 'this origin';
                if (isCorsError(browserErr)) {
                    return {
                        ok: false,
                        models: [],
                        message: `Ollama is reachable but its CORS policy blocks ${origin}. Start Ollama from your shell with: OLLAMA_ORIGINS='${origin}' ollama serve`,
                        source: 'cors-blocked'
                    };
                }
                return {
                    ok: false,
                    models: [],
                    message:
                        browserErr.message === proxyErr.message
                            ? proxyErr.message
                            : `${browserErr.message} (server proxy: ${proxyErr.message})`,
                    source: 'error'
                };
            }
        }
    })();

    _ollamaModelsPromise = promise;
    promise.finally(() => {
        if (_ollamaModelsPromise === promise) {
            _ollamaModelsPromise = null;
            _ollamaModelsPromiseUrl = null;
        }
    });
    return promise;
}
