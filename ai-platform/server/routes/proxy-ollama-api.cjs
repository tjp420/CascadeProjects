/**
 * Proxy Ollama models endpoint to avoid Local Network Access issues
 * Exposes: GET /api/proxy/ollama/models
 */
const rateLimit = require('express-rate-limit');
const logger = require('../../src/lib/app-logger.cjs');
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

function getFetch() {
    if (typeof globalThis.fetch === 'function') return globalThis.fetch;
    try {
        // eslint-disable-next-line global-require
        return require('node-fetch');
    } catch (e) {
        throw new Error('fetch is not available; please run on Node >= 18 or install node-fetch');
    }
}

function setupProxyOllamaAPI(app, options = {}) {
    const baseUrl = String(process.env.OLLAMA_BASE_URL || options.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
    const fetch = getFetch();

    const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.PROXY_OLLAMA_RATE_LIMIT || 30) });

    app.get('/api/proxy/ollama/models', limiter, async (req, res) => {
        try {
            const target = `${baseUrl}/api/tags`;
            const controller = new AbortController();
            const timeoutMs = Number(process.env.PROXY_OLLAMA_TIMEOUT_MS || 5000);
            const t = setTimeout(() => controller.abort(), timeoutMs);
            const resp = await fetch(target, { signal: controller.signal });
            clearTimeout(t);
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                return res.status(502).json({ success: false, error: 'upstream_error', status: resp.status, detail: text });
            }
            const json = await resp.json().catch(async () => {
                const txt = await resp.text().catch(() => '');
                throw new Error('invalid_json_from_ollama: ' + txt.slice(0, 200));
            });
            // Limit forwarded payload size
            const limited = Array.isArray(json) ? json.slice(0, 200) : json;
            return res.json({ success: true, data: limited });
        } catch (err) {
            const msg = err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || String(err);
            logger.warn('[ProxyOllama] Proxy request failed:', msg);
            return res.status(502).json({ success: false, error: 'proxy_failed', detail: msg });
        }
    });

    if (process.env.DEBUG_LOGS === 'true') logger.info('[ProxyOllama] /api/proxy/ollama/models mounted →', baseUrl + '/api/tags');
}

module.exports = { setupProxyOllamaAPI };
