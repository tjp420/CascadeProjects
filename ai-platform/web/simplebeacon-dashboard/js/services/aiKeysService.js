// simplebeacon-ignore ai-indicators, governance-marker, documentation
import { OLLAMA_DEFAULT_URL } from '../config.js';

import { authService } from './authService.js?v=20260716cachefix1';

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

/**
 * Has valid user jwt.
 * @returns {any}
 */
function hasValidUserJwt() {
    const token = authService.getToken?.() || '';
    // User endpoints need a real JWT (3 dot-separated segments).
    // License keys and legacy tokens are not valid here.
    return token && token.split('.').length === 3;
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
    ollamaBaseUrl: keysRecord.ollamaBaseUrl || '',
    ollamaModel: keysRecord.ollamaModel || '',
    updatedAt: keysRecord.updatedAt || null
  };
}

/**
 * Fetch user ai keys.
 * @returns {any}
 */
export async function fetchUserAiKeys() {
  if (!isAuthenticated() || !hasValidUserJwt()) {
    return normalizeAiKeysRecord(null);
  }
  if (Date.now() - _lastAuthFailure < AUTH_FAILURE_COOLDOWN_MS) {
    return normalizeAiKeysRecord(null);
  }
  const keysHttpResponse = await fetch(BASE, { headers: authService.getAuthHeaders() });
  const keysPayload = await readJsonResponseBody(keysHttpResponse, {});
  if (!keysHttpResponse.ok || !keysPayload.success) {
    if (keysHttpResponse.status === 404 && keysPayload.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    const msg = keysPayload.error || keysPayload.message || '';
    if (keysHttpResponse.status === 401 || keysHttpResponse.status === 403 || /Authentication required/i.test(msg)) {
      _lastAuthFailure = Date.now();
      return normalizeAiKeysRecord(null);
    }
    throw new Error(msg || 'Failed to load AI keys');
  }
  return normalizeAiKeysRecord(keysPayload);
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
  return normalizeAiKeysRecord(savePayload);
}

/**
 * Clear user ai keys.
 * @returns {any}
 */
export async function clearUserAiKeys() {
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
export function isLocalOllamaUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function shouldProbeOllamaModels(ollamaBaseUrl = OLLAMA_DEFAULT_URL) {
  const baseUrl = String(ollamaBaseUrl || OLLAMA_DEFAULT_URL).trim().replace(/\/$/, '') || OLLAMA_DEFAULT_URL;
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return !(isHttpsPage && isLocalOllamaUrl(baseUrl));
}

export async function fetchOllamaModels(ollamaBaseUrl = OLLAMA_DEFAULT_URL) {
  const baseUrl = String(ollamaBaseUrl || OLLAMA_DEFAULT_URL).trim().replace(/\/$/, '') || OLLAMA_DEFAULT_URL;
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (!shouldProbeOllamaModels(baseUrl)) {
    return {
      ok: false,
      models: [],
      message: 'Local Ollama is not available on the hosted dashboard. Add OpenAI or Anthropic keys in Settings → AI providers, or run the dashboard locally.',
      source: 'blocked'
    };
  }

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
      const models = Array.isArray(data.models) ? data.models.map((m) => m.name || m.model) : [];
      return {
        ok: true,
        models,
        message: models.length ? `${models.length} model(s) available` : 'Ollama is running but has no models pulled',
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
      const response = await fetch(`/api/simplebeacon/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `Server proxy returned HTTP ${response.status}`);
      }
      const models = Array.isArray(data.models) ? data.models.map((m) => m.name || m.model) : [];
      return {
        ok: true,
        models,
        message: models.length ? `${models.length} model(s) available` : 'Ollama is running but has no models pulled',
        source: 'server'
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (isHttpsPage) {
    try {
      return await fetchProxy();
    } catch (proxyErr) {
      throw new Error(`Ollama proxy failed: ${proxyErr.message}`);
    }
  }

  // HTTP page: try direct browser fetch first, then fall back to the proxy.
  try {
    return await fetchDirect();
  } catch (browserErr) {
    const isCors = String(browserErr.message).toLowerCase().includes('cors') ||
                   String(browserErr.message).includes('Failed to fetch');
    try {
      return await fetchProxy();
    } catch (proxyErr) {
      if (proxyErr.name === 'AbortError') {
        throw new Error('Ollama connection timed out - is Ollama running?');
      }
      if (isCors) {
        throw new Error(
          `Ollama is reachable from the browser but CORS is blocked. ` +
          `Start Ollama with CORS enabled: OLLAMA_ORIGINS=* ollama serve. ` +
          `Server proxy also failed: ${proxyErr.message}`
        );
      }
      throw new Error(
        browserErr.message === proxyErr.message
          ? proxyErr.message
          : `${browserErr.message} (server proxy: ${proxyErr.message})`
      );
    }
  }
}
