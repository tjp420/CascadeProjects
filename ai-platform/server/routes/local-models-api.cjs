/**
 * Local AI Models API — registry, upload, activate, test.
 */

const logger = require('../../src/lib/app-logger.cjs');

const path = require('path');
const multer = require('multer');
const {
    listModels,
    getActiveModelInfo,
    registerModel,
    registerUploadedModel,
    listOrphanedUploads,
    registerOrphanedUpload,
    refreshModelHash,
    getModelHash,
    activateModel,
    removeModel,
    updateSettings,
    testModel,
    testOllamaConnection,
    getUploadsDir,
    ensureRegistry
} = require('../services/local-model-service.cjs');
const { analyzeWithModel } = require('../services/model-inference-service.cjs');

function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

function setupLocalModelsAPI(app, options = {}) {
    const baseDir = options.baseDir || path.join(__dirname, '..', '..');

    const storage = multer.diskStorage({
        destination: async (_req, _file, cb) => {
            try {
                const dir = getUploadsDir(baseDir);
                await ensureRegistry(baseDir);
                cb(null, dir);
            } catch (error) {
                cb(error);
            }
        },
        filename: (_req, file, cb) => {
            const safe = String(file.originalname || 'model.gguf').replace(/[^\w.-]+/g, '_');
            cb(null, `${Date.now()}-${safe}`);
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: Number(process.env.MAX_GGUF_UPLOAD_BYTES || 8 * 1024 * 1024 * 1024) },
        fileFilter: (_req, file, cb) => {
            const name = String(file.originalname || '').toLowerCase();
            if (name.endsWith('.gguf') || file.mimetype === 'application/octet-stream') {
                cb(null, true);
            } else {
                cb(new Error('Only .gguf model files are allowed'));
            }
        }
    });

    app.get('/api/models', async (_req, res) => {
        try {
            const payload = await listModels(baseDir);
            res.json({ success: true, ...payload });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/models/active', async (_req, res) => {
        try {
            const activeModel = await getActiveModelInfo(baseDir);
            res.json({ success: true, activeModel });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/active/analyze', async (req, res) => {
        try {
            const result = await analyzeWithModel(baseDir, 'active', req.body || {});
            res.json(result);
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/:id/analyze', async (req, res) => {
        try {
            const result = await analyzeWithModel(baseDir, req.params.id, req.body || {});
            res.json(result);
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/register', async (req, res) => {
        try {
            const result = await registerModel(baseDir, req.body || {});
            const status = result.deduplicated ? 200 : 201;
            res.status(status).json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/upload', (req, res) => {
        upload.single('model')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No model file uploaded' });
            }
            try {
                const result = await registerUploadedModel(baseDir, req.file, req.body || {});
                const status = result.deduplicated ? 200 : 201;
                res.status(status).json({ success: true, ...result });
            } catch (error) {
                try {
                    await require('fs').promises.unlink(req.file.path);
                } catch { /* ignore cleanup errors */ }
                res.status(500).json({ success: false, error: error.message });
            }
        });
    });

    app.get('/api/models/uploads/orphans', async (_req, res) => {
        try {
            const orphans = await listOrphanedUploads(baseDir);
            res.json({ success: true, orphans });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/uploads/register', async (req, res) => {
        try {
            const result = await registerOrphanedUpload(baseDir, req.body?.filename);
            const status = result.deduplicated ? 200 : 201;
            res.status(status).json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/:id/activate', async (req, res) => {
        try {
            const activeModel = await activateModel(baseDir, req.params.id);
            res.json({ success: true, activeModel });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/:id/test', async (req, res) => {
        try {
            const result = await testModel(baseDir, req.params.id);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.get('/api/models/:id/hash', async (req, res) => {
        try {
            const result = await getModelHash(baseDir, req.params.id, {
                refresh: req.query.refresh === '1' || req.query.refresh === 'true'
            });
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/:id/hash', async (req, res) => {
        try {
            const result = await refreshModelHash(baseDir, req.params.id);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.delete('/api/models/:id', async (req, res) => {
        try {
            const result = await removeModel(baseDir, req.params.id);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.patch('/api/models/settings', async (req, res) => {
        try {
            const result = await updateSettings(baseDir, req.body || {});
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/models/test-ollama', async (req, res) => {
        try {
            const registry = await ensureRegistry(baseDir);
            const baseUrl = req.body?.ollamaBaseUrl || registry.ollamaBaseUrl;
            const result = await testOllamaConnection(baseUrl, req.body?.ollamaModel || null);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({
                success: false,
                ok: false,
                error: 'Failed to test Ollama connection',
                details: error.message
            });
        }
    });

    if (shouldLogRuntimeInfo()) {
        logger.info('[Local Models API] Enabled at /api/models');
    }
}

module.exports = setupLocalModelsAPI;
