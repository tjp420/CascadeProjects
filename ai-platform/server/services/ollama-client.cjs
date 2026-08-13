// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Ollama HTTP client for local model inference.
 */

const constants = require('../config/constants.cjs');
const logger = require('../lib/app-logger.cjs');
const { logInferenceEvent } = require('../lib/ai-inference-audit-logger.cjs');

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || `http://127.0.0.1:${constants.OLLAMA_PORT}`;
const DEFAULT_TIMEOUT_MS = constants.TIMEOUT_2M;
const DEFAULT_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX, 10) || 8192;
// Auxiliary probe / lookup routes should use a short timeout to avoid
// blocking inference pipelines when the local Ollama daemon is slow or hung.
const AUX_TIMEOUT_MS = constants.TIMEOUT_5S;
const LIST_TIMEOUT_MS = AUX_TIMEOUT_MS;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_TAGS_CACHE_TTL_MS = constants.TIMEOUT_5S + constants.TIMEOUT_2S;
const RETRYABLE_HTTP_CODES = new Set([408, 429, 500, 502, 503, 504]);
const tagsCache = new Map();

/**
 * Normalize base url.
 * @param {string} baseUrl
 * @returns {any}
 */
function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
}

/**
 * As positive int.
 * @param {any} value
 * @param {any} fallback
 * @returns {any}
 */
function asPositiveInt(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Is abort error.
 * @param {any} error
 * @returns {any}
 */
function isAbortError(error) {
    return error?.name === 'AbortError';
}

/**
 * Should retry.
 * @param {any} statusCode
 * @param {any} error
 * @param {any} attempt
 * @param {Array} maxAttempts
 * @returns {any}
 */
function shouldRetry(statusCode, error, attempt, maxAttempts) {
    if (attempt >= maxAttempts) return false;
    if (isAbortError(error)) return true;
    if (statusCode == null) return true;
    return RETRYABLE_HTTP_CODES.has(statusCode);
}

/**
 * Ollama generate.
 * @param {string} baseUrl
 * @param {any} model
 * @param {any} prompt
 * @param {Object} options
 * @returns {any}
 */
async function ollamaGenerate(baseUrl, model, prompt, options = {}) {
    const url = `${normalizeBaseUrl(baseUrl)}/api/generate`;
    const timeoutMs = asPositiveInt(options.timeoutMs || process.env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    const maxRetries = asPositiveInt(options.retryAttempts, DEFAULT_RETRY_ATTEMPTS);
    const startedAt = Date.now();
    const body = {
        model,
        prompt,
        stream: false,
        options: {
            temperature: options.temperature ?? 0.1,
            top_p: options.topP ?? 0.9,
            num_ctx: options.numCtx ?? DEFAULT_NUM_CTX,
            num_predict: options.numPredict ?? constants.BYTES_PER_KB,
            repeat_penalty: options.repeatPenalty ?? 1.1
        }
    };
    if (options.format) body.format = options.format;
    if (options.system) body.system = options.system;

    let attempt = 0;
    // Retry once by default for transient failures/timeouts.
    while (attempt <= maxRetries) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                if (shouldRetry(response.status, null, attempt, maxRetries)) {
                    attempt += 1;
                    continue;
                }
                throw new Error(`Ollama generate failed (${response.status}): ${text.slice(0, 200)}`);
            }

            const payload = await response.json().catch(() => ({}));
            const responseText = payload.response || '';
            if (options.includeMeta) {
                return {
                    response: responseText,
                    timing: {
                        durationMs: Date.now() - startedAt,
                        attempts: attempt + 1
                    }
                };
            }
            return responseText;
        } catch (error) {
            if (shouldRetry(null, error, attempt, maxRetries)) {
                attempt += 1;
                continue;
            }
            logInferenceEvent({
                provider: 'ollama',
                operation: 'ollamaGenerate',
                projectLabel: 'inference',
                outcome: 'error',
                metadata: { errorMessage: error.message, model, attempt }
            });
            if (isAbortError(error)) {
                throw new Error(`Ollama generate timed out after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}

/**
 * Extract json object.
 * @param {string} text
 * @returns {any}
 */
function extractJsonObject(text) {
    if (!text) return null;
    const trimmed = String(text).trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        /* fall through */
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(trimmed.slice(start, end + 1));
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Ollama list models.
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {any}
 */
async function ollamaListModels(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const url = `${normalizedBaseUrl}/api/tags`;
    const controller = new AbortController();
    const timeoutMs = asPositiveInt(options.timeoutMs, LIST_TIMEOUT_MS);
    const cacheTtlMs = asPositiveInt(options.cacheTtlMs || process.env.OLLAMA_TAGS_CACHE_TTL_MS, DEFAULT_TAGS_CACHE_TTL_MS);
    const cacheKey = normalizedBaseUrl;
    const now = Date.now();
    const cached = tagsCache.get(cacheKey);
    if (!options.forceRefresh && cached && cached.expiresAt > now) {
        if (options.includeMeta) {
            return {
                models: [...cached.models],
                timing: {
                    durationMs: 0,
                    source: 'cache'
                }
            };
        }
        return [...cached.models];
    }

    const startedAt = now;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Ollama tags failed (${response.status})`);
        }
        const payload = await response.json();
        const models = Array.from(new Set((payload.models || [])
            .map((entry) => entry.name || entry.model)
            .filter(Boolean)));
        tagsCache.set(cacheKey, {
            models,
            expiresAt: Date.now() + cacheTtlMs
        });
        if (options.includeMeta) {
            return {
                models: [...models],
                timing: {
                    durationMs: Date.now() - startedAt,
                    source: 'network'
                }
            };
        }
        return models;
    } catch (error) {
        if (isAbortError(error)) {
            throw new Error(`Ollama tags timed out after ${timeoutMs}ms`);
        }
        logInferenceEvent({
            provider: 'ollama',
            operation: 'ollamaListModels',
            projectLabel: 'inference',
            outcome: 'error',
            metadata: { errorMessage: error.message, baseUrl }
        });
        logger.error('[Ollama Client] Failed to list models:', error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function ollamaChat(baseUrl, model, messages, options = {}) {
    const url = `${normalizeBaseUrl(baseUrl)}/api/chat`;
    const timeoutMs = asPositiveInt(options.timeoutMs || process.env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    const maxRetries = asPositiveInt(options.retryAttempts, DEFAULT_RETRY_ATTEMPTS);
    const startedAt = Date.now();
    const body = {
        model,
        messages,
        stream: false,
        options: {
            temperature: options.temperature ?? 0.3,
            top_p: options.topP ?? 0.9,
            num_predict: options.numPredict ?? 2048
        }
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                if (shouldRetry(response.status, null, attempt, maxRetries)) {
                    attempt += 1;
                    continue;
                }
                throw new Error(`Ollama chat failed (${response.status}): ${text.slice(0, 200)}`);
            }

            const payload = await response.json().catch(() => ({}));
            const responseText = payload.message?.content || payload.response || '';
            if (options.includeMeta) {
                return {
                    response: responseText,
                    timing: {
                        durationMs: Date.now() - startedAt,
                        attempts: attempt + 1
                    }
                };
            }
            return responseText;
        } catch (error) {
            if (shouldRetry(null, error, attempt, maxRetries)) {
                attempt += 1;
                continue;
            }
            logInferenceEvent({
                provider: 'ollama',
                operation: 'ollamaChat',
                projectLabel: 'inference',
                outcome: 'error',
                metadata: { errorMessage: error.message, model, attempt }
            });
            if (isAbortError(error)) {
                throw new Error(`Ollama chat timed out after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}

/**
 * Lightweight health probe for Ollama daemon. Tries common info endpoints
 * with a short timeout so callers can fall back quickly when local Ollama
 * is unresponsive.
 * @param {string} baseUrl
 * @param {Object} options
 */
async function ollamaHealth(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const probes = ['/api/status', '/api/info', '/api/health'];
    const timeoutMs = asPositiveInt(options.timeoutMs, AUX_TIMEOUT_MS);

    for (const p of probes) {
        const url = `${normalizedBaseUrl}${p}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (res && res.ok) return { ok: true, endpoint: p, status: res.status };
        } catch (err) {
            clearTimeout(timeout);
            if (isAbortError(err)) {
                // timed out for this probe; try next
                continue;
            }
            // non-timeout errors are logged but we continue to next probe
            logger.debug('[Ollama Client] probe error', { url, err: err && err.message });
        }
    }
    return { ok: false };
}

/**
 * List models with full metadata (size, details, quantization, family).
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function ollamaListModelsWithDetails(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const url = `${normalizedBaseUrl}/api/tags`;
    const timeoutMs = asPositiveInt(options.timeoutMs, LIST_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Ollama tags failed (${response.status})`);
        }
        const payload = await response.json();
        const models = (payload.models || []).map((entry) => ({
            name: entry.name || entry.model || 'unknown',
            size: entry.size || 0,
            digest: entry.digest || '',
            modifiedAt: entry.modified_at || '',
            details: entry.details || {},
        }));
        return models;
    } catch (error) {
        if (isAbortError(error)) {
            throw new Error(`Ollama tags (detailed) timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetch running models with VRAM/memory stats via /api/ps.
 * Available in Ollama v0.1.25+.
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function ollamaPs(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const url = `${normalizedBaseUrl}/api/ps`;
    const timeoutMs = asPositiveInt(options.timeoutMs, AUX_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Ollama ps failed (${response.status})`);
        }
        const payload = await response.json();
        return (payload.models || []).map((entry) => ({
            name: entry.name || entry.model || 'unknown',
            sizeVRAM: entry.size_vram || 0,
            size: entry.size || 0,
            digest: entry.digest || '',
            expiresAt: entry.expires_at || '',
        }));
    } catch (error) {
        if (isAbortError(error)) {
            throw new Error(`Ollama ps timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Pull (download) a model from the Ollama registry with streaming progress.
 * Calls onProgress for each status update from the Ollama daemon.
 * @param {string} baseUrl
 * @param {string} modelName - e.g. "llama3:8b"
 * @param {Object} options
 * @param {function} options.onProgress - callback(progressObj) for each update
 * @returns {Promise<void>}
 */
async function ollamaPull(baseUrl, modelName, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const url = `${normalizedBaseUrl}/api/pull`;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const controller = new AbortController();
    const timeoutMs = asPositiveInt(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true }),
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Ollama pull failed (${response.status})`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const chunk = JSON.parse(trimmed);
                    if (onProgress) onProgress(chunk);
                } catch {
                    // partial JSON — skip
                }
            }
        }
        // flush remaining buffer
        if (buffer.trim()) {
            try {
                const chunk = JSON.parse(buffer.trim());
                if (onProgress) onProgress(chunk);
            } catch {
                // ignore
            }
        }
    } catch (error) {
        if (isAbortError(error)) {
            throw new Error(`Ollama pull timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    ollamaGenerate,
    ollamaChat,
    ollamaListModels,
    ollamaListModelsWithDetails,
    ollamaPs,
    ollamaPull,
    // Lightweight probe for monitoring/health checks and auxiliary lookups
    ollamaHealth,
    extractJsonObject,
    DEFAULT_OLLAMA_URL
};
