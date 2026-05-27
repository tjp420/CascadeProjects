const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const setupLocalModelsAPI = require('../../server/routes/local-models-api');
const ollamaClient = require('../../server/services/ollama-client');

async function withModelsServer(fn) {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-models-api-'));
    const app = express();
    app.use(express.json());
    setupLocalModelsAPI(app, { baseDir });

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await fn(baseUrl, baseDir);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
}

describe('Local models API', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('lists models and active model', async () => {
        await withModelsServer(async (baseUrl) => {
            const list = await fetch(`${baseUrl}/api/models`).then((r) => r.json());
            expect(list.success).toBe(true);
            expect(Array.isArray(list.models)).toBe(true);

            const active = await fetch(`${baseUrl}/api/models/active`).then((r) => r.json());
            expect(active.success).toBe(true);
            expect(active.activeModel.name).toBeTruthy();
        });
    });

    test('registers a local path model', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const modelPath = path.join(baseDir, 'demo.gguf');
            fs.writeFileSync(modelPath, 'demo');

            const response = await fetch(`${baseUrl}/api/models/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'api-test-model',
                    provider: 'path',
                    path: modelPath
                })
            });
            expect(response.status).toBe(201);
            const payload = await response.json();
            expect(payload.model.name).toBe('api-test-model');
            expect(payload.model.hash).toMatch(/^sha256-[a-f0-9]{64}$/);
        });
    });

    test('returns and refreshes model SHA256 hash', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const modelPath = path.join(baseDir, 'hash-demo.gguf');
            fs.writeFileSync(modelPath, 'hash-me');

            const registerResponse = await fetch(`${baseUrl}/api/models/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'hash-test-model',
                    provider: 'path',
                    path: modelPath
                })
            });
            const registered = await registerResponse.json();
            const modelId = registered.model.id;

            const hashResponse = await fetch(`${baseUrl}/api/models/${encodeURIComponent(modelId)}/hash`);
            expect(hashResponse.ok).toBe(true);
            const hashPayload = await hashResponse.json();
            expect(hashPayload.hash).toMatch(/^sha256-[a-f0-9]{64}$/);

            const refreshResponse = await fetch(`${baseUrl}/api/models/${encodeURIComponent(modelId)}/hash`, {
                method: 'POST'
            });
            expect(refreshResponse.ok).toBe(true);
        });
    });

    test('deduplicates path registration with the same SHA256', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const modelPath = path.join(baseDir, 'same.gguf');
            fs.writeFileSync(modelPath, 'same-content');

            const first = await fetch(`${baseUrl}/api/models/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'first-path', provider: 'path', path: modelPath })
            });
            expect(first.status).toBe(201);

            const second = await fetch(`${baseUrl}/api/models/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'second-path', provider: 'path', path: modelPath })
            });
            expect(second.status).toBe(200);
            const payload = await second.json();
            expect(payload.deduplicated).toBe(true);
        });
    });

    test('uploads a gguf model file', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const boundary = '----CascadeTestBoundary';
            const fileContent = 'fake gguf payload';
            const body = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="name"',
                '',
                'uploaded-test-model',
                `--${boundary}`,
                'Content-Disposition: form-data; name="description"',
                '',
                'integration test upload',
                `--${boundary}`,
                'Content-Disposition: form-data; name="model"; filename="demo.gguf"',
                'Content-Type: application/octet-stream',
                '',
                fileContent,
                `--${boundary}--`,
                ''
            ].join('\r\n');

            const response = await fetch(`${baseUrl}/api/models/upload`, {
                method: 'POST',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body
            });
            expect(response.status).toBe(201);
            const payload = await response.json();
            expect(payload.success).toBe(true);
            expect(payload.model.name).toBe('uploaded-test-model');
            expect(payload.model.provider).toBe('upload');
            expect(payload.deduplicated).toBe(false);
            expect(fs.existsSync(payload.model.path)).toBe(true);

            const uploadsDir = path.join(baseDir, 'data-central', 'ai-tools', 'ai-models', 'uploads');
            expect(fs.existsSync(uploadsDir)).toBe(true);
        });
    });

    test('lists orphaned uploads and registers one without re-uploading', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const uploadsDir = path.join(baseDir, 'data-central', 'ai-tools', 'ai-models', 'uploads');
            fs.mkdirSync(uploadsDir, { recursive: true });
            const orphanPath = path.join(uploadsDir, '999999-orphan-demo.gguf');
            fs.writeFileSync(orphanPath, 'orphan gguf bytes');

            const listResponse = await fetch(`${baseUrl}/api/models/uploads/orphans`);
            expect(listResponse.ok).toBe(true);
            const listed = await listResponse.json();
            expect(listed.orphans.some((item) => item.filename === '999999-orphan-demo.gguf')).toBe(true);

            const registerResponse = await fetch(`${baseUrl}/api/models/uploads/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: '999999-orphan-demo.gguf' })
            });
            expect(registerResponse.status).toBe(201);
            const registered = await registerResponse.json();
            expect(registered.model.name).toBe('orphan-demo');
        });
    });

    test('deduplicates uploads with the same file hash', async () => {
        await withModelsServer(async (baseUrl) => {
            const boundary = '----CascadeDedupeBoundary';
            const fileContent = 'same gguf payload every time';
            const buildBody = () => [
                `--${boundary}`,
                'Content-Disposition: form-data; name="name"',
                '',
                'dedupe-model',
                `--${boundary}`,
                'Content-Disposition: form-data; name="model"; filename="dedupe.gguf"',
                'Content-Type: application/octet-stream',
                '',
                fileContent,
                `--${boundary}--`,
                ''
            ].join('\r\n');

            const first = await fetch(`${baseUrl}/api/models/upload`, {
                method: 'POST',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body: buildBody()
            });
            expect(first.status).toBe(201);

            const second = await fetch(`${baseUrl}/api/models/upload`, {
                method: 'POST',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body: buildBody()
            });
            expect(second.status).toBe(200);
            const payload = await second.json();
            expect(payload.deduplicated).toBe(true);
        });
    });

    test('runs active model analysis', async () => {
        await withModelsServer(async (baseUrl, baseDir) => {
            const dataDir = path.join(baseDir, 'web', 'data');
            fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, 'mock-analysis-sample.json'), JSON.stringify({
                type: 'mock-data-analysis-report',
                title: 'Template',
                modelInfo: { name: 'template' },
                analysisOverview: {},
                mockDataCategories: [],
                detectedIssues: [],
                qualityMetrics: { overallQuality: 80 },
                optimizationRecommendations: [],
                qualityImprovements: [],
                performanceMetrics: {},
                nextSteps: [],
                privacyAndSecurity: {}
            }));
            fs.writeFileSync(path.join(dataDir, 'demo.json'), JSON.stringify({ ok: true }));

            const response = await fetch(`${baseUrl}/api/models/active/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(response.ok).toBe(true);
            const payload = await response.json();
            expect(payload.success).toBe(true);
            expect(payload.report.type).toBe('mock-data-analysis-report');
        });
    });

    test('shapes /api/models/test-ollama error payload when listing fails', async () => {
        jest.spyOn(ollamaClient, 'ollamaListModels').mockRejectedValue(new Error('mocked tags failure'));

        await withModelsServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/models/test-ollama`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ollamaBaseUrl: 'http://127.0.0.1:11434' })
            });
            expect(response.ok).toBe(true);
            const payload = await response.json();
            expect(payload.success).toBe(true);
            expect(payload.ok).toBe(false);
            expect(payload.message).toMatch(/Ollama connection failed/i);
            expect(payload.timings).toEqual(expect.objectContaining({
                listMs: expect.any(Number)
            }));
        });
    });
});
