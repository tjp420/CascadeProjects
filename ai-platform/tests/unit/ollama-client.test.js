const { ollamaGenerate, ollamaListModels, extractJsonObject } = require('../../server/services/ollama-client');

describe('ollama-client', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('retries generate once on transient http failure', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                text: async () => 'temporary unavailable'
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ response: 'ok-after-retry' })
            });
        global.fetch = fetchMock;

        const result = await ollamaGenerate('http://127.0.0.1:11434', 'llama3.2', 'hello', {
            timeoutMs: 1000,
            retryAttempts: 1
        });

        expect(result).toBe('ok-after-retry');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('throws clear timeout error on aborted generate', async () => {
        global.fetch = jest.fn().mockImplementation(async (_url, init) => {
            if (init?.signal?.aborted) {
                const err = new Error('aborted');
                err.name = 'AbortError';
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        });

        await expect(ollamaGenerate('http://127.0.0.1:11434', 'llama3.2', 'hello', {
            timeoutMs: 1,
            retryAttempts: 0
        })).rejects.toThrow(/timed out/i);
    });

    test('deduplicates model names from tags endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                models: [
                    { name: 'llama3.2:latest' },
                    { model: 'llama3.2:latest' },
                    { name: 'qwen2.5-coder:7b' }
                ]
            })
        });

        const models = await ollamaListModels('http://127.0.0.1:11434');
        expect(models).toEqual(['llama3.2:latest', 'qwen2.5-coder:7b']);
    });

    test('returns cached model list within TTL', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                models: [{ name: 'llama3.2:latest' }]
            })
        });
        global.fetch = fetchMock;

        const first = await ollamaListModels('http://127.0.0.1:11434', {
            includeMeta: true,
            cacheTtlMs: 10000,
            forceRefresh: true
        });
        const second = await ollamaListModels('http://127.0.0.1:11434', {
            includeMeta: true,
            cacheTtlMs: 10000
        });

        expect(first.models).toEqual(['llama3.2:latest']);
        expect(first.timing.source).toBe('network');
        expect(second.models).toEqual(['llama3.2:latest']);
        expect(second.timing.source).toBe('cache');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('extractJsonObject parses wrapped JSON text', () => {
        const wrapped = 'Some heading\n{"ok":true,"count":2}\nextra';
        expect(extractJsonObject(wrapped)).toEqual({ ok: true, count: 2 });
    });
});
