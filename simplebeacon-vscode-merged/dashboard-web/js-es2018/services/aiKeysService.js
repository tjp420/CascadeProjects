import { authService } from './authService.js';
import { apiUrl } from '../utils.js';
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
    var _a;
    const token = ((_a = authService.getToken) === null || _a === void 0 ? void 0 : _a.call(authService)) || '';
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
        throw new Error(savePayload.error || savePayload.message || 'Failed to save AI keys');
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
import { OLLAMA_DEFAULT_URL } from '../config.js';
/**
 * Fetch ollama models.
 * @param {string} ollamaBaseUrl
 * @returns {any}
 */
export async function fetchOllamaModels(ollamaBaseUrl = OLLAMA_DEFAULT_URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    try {
        const ollamaHttpResponse = await fetch(apiUrl('/api/models/test-ollama'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ollamaBaseUrl }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        const ollamaProbe = await readJsonResponseBody(ollamaHttpResponse, {});
        if (!ollamaHttpResponse.ok || ollamaProbe.success === false) {
            throw new Error(ollamaProbe.error || ollamaProbe.message || 'Failed to list Ollama models');
        }
        return {
            ok: Boolean(ollamaProbe.ok),
            models: Array.isArray(ollamaProbe.availableModels) ? ollamaProbe.availableModels : [],
            message: ollamaProbe.message || ''
        };
    }
    catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('Ollama connection timed out - is Ollama running?');
        }
        throw error;
    }
}
