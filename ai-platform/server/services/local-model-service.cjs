/**
 * Local AI model registry — paths, Ollama, and uploaded GGUF files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ollamaListModels } = require('./ollama-client.cjs');
const logger = require('../lib/app-logger.cjs');

const constants = require('../config/constants.cjs');
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || ('http://127.0.0.1:' + '11434');

/**
 * Get models root.
 * @param {string} baseDir
 * @returns {any}
 */
function getModelsRoot(baseDir) {
    return process.env.LOCAL_MODELS_DIR
        || path.join(baseDir, 'data-central', 'ai-tools', 'ai-models');
}

/**
 * Get registry path.
 * @param {string} baseDir
 * @returns {any}
 */
function getRegistryPath(baseDir) {
    return path.join(getModelsRoot(baseDir), 'registry.json');
}

/**
 * Get uploads dir.
 * @param {string} baseDir
 * @returns {any}
 */
function getUploadsDir(baseDir) {
    return path.join(getModelsRoot(baseDir), 'uploads');
}

/**
 * Default registry.
 * @returns {any}
 */
function defaultRegistry() {
    return {
        version: 1,
        activeModelId: 'platform-checklist-demo',
        ollamaBaseUrl: DEFAULT_OLLAMA_URL,
        models: [
            {
                id: 'platform-checklist-demo',
                name: 'platform-checklist',
                provider: 'demo',
                type: 'Internal',
                status: 'active',
                description: 'Filesystem mock-data scan — not GGUF inference. Upload phi-2 or set Ollama for live models.',
                path: null,
                ollamaModel: null,
                size: null,
                confidence: null,
                hash: null,
                isDefault: true,
                createdAt: new Date().toISOString(),
                lastTestedAt: null,
                testStatus: 'demo'
            }
        ]
    };
}

/**
 * Ensure registry.
 * @param {string} baseDir
 * @returns {any}
 */
async function ensureRegistry(baseDir) {
    const _root = getModelsRoot(baseDir);
    const registryPath = getRegistryPath(baseDir);
    await fs.promises.mkdir(getUploadsDir(baseDir), { recursive: true });

    if (!fs.existsSync(registryPath)) {
        const registry = defaultRegistry();
        await fs.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
        return registry;
    }

    const raw = await fs.promises.readFile(registryPath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Save registry.
 * @param {string} baseDir
 * @param {string} registry
 * @returns {any}
 */
async function saveRegistry(baseDir, registry) {
    const registryPath = getRegistryPath(baseDir);
    await fs.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Slugify.
 * @param {any} value
 * @returns {any}
 */
function slugify(value) {
    return String(value || 'model')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'model';
}

/**
 * Make model id.
 * @param {string} name
 * @returns {any}
 */
function makeModelId(name) {
    return `${slugify(name)}-${Date.now().toString(36)}`;
}

/**
 * Format bytes.
 * @param {Array} bytes
 * @returns {any}
 */
function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return null;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= constants.BYTES_PER_KB && unit < units.length - 1) {
        size /= constants.BYTES_PER_KB;
        unit += 1;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
}

/**
 * Hash file sha256.
 * @param {string} filePath
 * @returns {any}
 */
function hashFileSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(`sha256-${hash.digest('hex')}`));
    });
}

/**
 * Normalize path key.
 * @param {string} filePath
 * @returns {any}
 */
function normalizePathKey(filePath) {
    return path.normalize(String(filePath || '')).toLowerCase();
}

/**
 * Find upload file by hash.
 * @param {string} uploadsDir
 * @param {string} fileHash
 * @param {number} fileSize
 * @param {Object} options
 * @returns {any}
 */
async function findUploadFileByHash(uploadsDir, fileHash, fileSize, { excludePath } = {}) {
    const excludeKey = excludePath ? normalizePathKey(excludePath) : null;
    const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
    const sizeMatches = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.gguf')) continue;
        const fullPath = path.join(uploadsDir, entry.name);
        if (excludeKey && normalizePathKey(fullPath) === excludeKey) continue;
        const stat = await fs.promises.stat(fullPath);
        if (stat.size <= 0 || stat.size !== fileSize) continue;
        sizeMatches.push(fullPath);
    }

    for (const candidatePath of sizeMatches) {
        const candidateHash = await hashFileSha256(candidatePath);
        if (candidateHash === fileHash) return candidatePath;
    }

    return null;
}

/**
 * Get active model.
 * @param {string} registry
 * @returns {any}
 */
function getActiveModel(registry) {
    const active = registry.models.find((m) => m.id === registry.activeModelId);
    return active || registry.models.find((m) => m.isDefault) || registry.models[0] || null;
}

/**
 * List models.
 * @param {string} baseDir
 * @returns {any}
 */
async function listModels(baseDir) {
    const registry = await ensureRegistry(baseDir);
    return {
        activeModelId: registry.activeModelId,
        ollamaBaseUrl: registry.ollamaBaseUrl || DEFAULT_OLLAMA_URL,
        models: registry.models,
        activeModel: getActiveModel(registry)
    };
}

/**
 * Get active model info.
 * @param {string} baseDir
 * @returns {any}
 */
async function getActiveModelInfo(baseDir) {
    const registry = await ensureRegistry(baseDir);
    const active = getActiveModel(registry);
    if (!active) return null;
    return {
        id: active.id,
        name: active.name,
        provider: active.provider,
        type: active.type || 'GGUF',
        status: active.status || 'active',
        size: active.size || null,
        confidence: active.confidence ?? 98,
        hash: active.hash || null,
        path: active.path || null,
        ollamaModel: active.ollamaModel || null,
        ollamaBaseUrl: registry.ollamaBaseUrl || DEFAULT_OLLAMA_URL,
        testStatus: active.testStatus || 'unknown',
        isDemo: active.provider === 'demo'
    };
}

/**
 * Register model.
 * @param {string} baseDir
 * @param {any} input
 * @returns {any}
 */
async function registerModel(baseDir, input) {
    const registry = await ensureRegistry(baseDir);
    const provider = input.provider || 'path';
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Model name is required');

    const model = {
        id: makeModelId(name),
        name,
        provider,
        type: input.type || (provider === 'ollama' ? 'Ollama' : 'GGUF'),
        status: 'registered',
        description: input.description || '',
        path: input.path ? String(input.path).trim() : null,
        ollamaModel: input.ollamaModel ? String(input.ollamaModel).trim() : null,
        size: input.size || null,
        confidence: input.confidence ?? null,
        hash: input.hash || null,
        isDefault: false,
        createdAt: new Date().toISOString(),
        lastTestedAt: null,
        testStatus: 'unknown'
    };

    if (provider === 'path' && !model.path) {
        throw new Error('Local file path is required for path provider');
    }
    if (provider === 'ollama' && !model.ollamaModel) {
        throw new Error('Ollama model name is required for ollama provider');
    }
    if (provider === 'path') {
        try {
            await fs.promises.access(model.path, fs.constants.R_OK);
            const stat = await fs.promises.stat(model.path);
            model.size = model.size || formatBytes(stat.size);
            if (model.path.toLowerCase().endsWith('.gguf')) {
                model.hash = await hashFileSha256(model.path);
                const existing = registry.models.find((m) => m.hash === model.hash);
                if (existing) {
                    return { model: existing, deduplicated: true };
                }
            }
        } catch {
            throw new Error(`Cannot read model file at: ${model.path}`);
        }
    }

    if (input.ollamaBaseUrl) {
        registry.ollamaBaseUrl = String(input.ollamaBaseUrl).trim();
    }

    registry.models.push(model);
    await saveRegistry(baseDir, registry);
    return { model, deduplicated: false };
}

/**
 * Refresh model hash.
 * @param {string} baseDir
 * @param {string} modelId
 * @returns {any}
 */
async function refreshModelHash(baseDir, modelId) {
    const registry = await ensureRegistry(baseDir);
    const model = registry.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);
    if (!model.path) throw new Error('Model has no file path to hash');
    await fs.promises.access(model.path, fs.constants.R_OK);
    model.hash = await hashFileSha256(model.path);
    await saveRegistry(baseDir, registry);
    return { model, hash: model.hash };
}

/**
 * Get model hash.
 * @param {string} baseDir
 * @param {string} modelId
 * @param {Object} options
 * @returns {any}
 */
async function getModelHash(baseDir, modelId, { refresh = false } = {}) {
    const registry = await ensureRegistry(baseDir);
    const model = registry.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);
    if (refresh || (!model.hash && model.path)) {
        return refreshModelHash(baseDir, modelId);
    }
    return { model, hash: model.hash || null };
}

/**
 * Register uploaded model.
 * @param {string} baseDir
 * @param {string} file
 * @param {any} meta
 * @returns {any}
 */
async function registerUploadedModel(baseDir, file, meta = {}) {
    const registry = await ensureRegistry(baseDir);
    const name = String(meta.name || path.parse(file.originalname || file.filename).name).trim();
    let storedPath = file.path;
    const stat = await fs.promises.stat(storedPath);
    const fileHash = await hashFileSha256(storedPath);
    const existing = registry.models.find((m) => m.hash === fileHash);
    if (existing) {
        try {
            await fs.promises.unlink(storedPath);
        } catch { /* ignore cleanup errors */ }
        return { model: existing, deduplicated: true };
    }

    const uploadsDir = getUploadsDir(baseDir);
    const duplicatePath = await findUploadFileByHash(uploadsDir, fileHash, stat.size, {
        excludePath: storedPath
    });
    if (duplicatePath) {
        try {
            await fs.promises.unlink(storedPath);
        } catch { /* ignore cleanup errors */ }
        storedPath = duplicatePath;
        const existingByPath = registry.models.find(
            (m) => m.path && normalizePathKey(m.path) === normalizePathKey(storedPath)
        );
        if (existingByPath) {
            return { model: existingByPath, deduplicated: true };
        }
    }

    const model = {
        id: makeModelId(name),
        name,
        provider: 'upload',
        type: 'GGUF',
        status: 'registered',
        description: meta.description || 'Uploaded GGUF model',
        path: storedPath,
        ollamaModel: null,
        size: formatBytes(stat.size),
        confidence: null,
        hash: fileHash,
        isDefault: false,
        createdAt: new Date().toISOString(),
        lastTestedAt: null,
        testStatus: 'uploaded'
    };

    registry.models.push(model);
    await saveRegistry(baseDir, registry);
    return { model, deduplicated: false };
}

/**
 * List orphaned uploads.
 * @param {string} baseDir
 * @returns {any}
 */
async function listOrphanedUploads(baseDir) {
    const registry = await ensureRegistry(baseDir);
    const registeredPaths = new Set(
        registry.models
            .filter((m) => m.path)
            .map((m) => path.normalize(m.path).toLowerCase())
    );
    const uploadsDir = getUploadsDir(baseDir);
    const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
    const orphans = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.toLowerCase().endsWith('.gguf')) continue;
        const fullPath = path.join(uploadsDir, entry.name);
        if (registeredPaths.has(path.normalize(fullPath).toLowerCase())) continue;
        const stat = await fs.promises.stat(fullPath);
        if (stat.size <= 0) continue;
        const displayName = entry.name.replace(/^\d+-/, '');
        orphans.push({
            filename: entry.name,
            path: fullPath,
            displayName,
            size: formatBytes(stat.size),
            bytes: stat.size,
            modifiedAt: stat.mtime.toISOString()
        });
    }

    orphans.sort((a, b) => b.bytes - a.bytes);
    return orphans;
}

/**
 * Register orphaned upload.
 * @param {string} baseDir
 * @param {string} filename
 * @returns {any}
 */
async function registerOrphanedUpload(baseDir, filename) {
    const uploadsDir = getUploadsDir(baseDir);
    const safeName = path.basename(String(filename || ''));
    if (!safeName.toLowerCase().endsWith('.gguf')) {
        throw new Error('Only .gguf files in the uploads folder can be recovered');
    }
    const storedPath = path.join(uploadsDir, safeName);
    const normalizedUploads = path.normalize(uploadsDir).toLowerCase();
    const normalizedStored = path.normalize(storedPath).toLowerCase();
    if (!normalizedStored.startsWith(normalizedUploads)) {
        throw new Error('Invalid upload filename');
    }
    await fs.promises.access(storedPath, fs.constants.R_OK);
    const displayName = safeName.replace(/^\d+-/, '');
    const result = await registerUploadedModel(baseDir, {
        path: storedPath,
        originalname: displayName,
        filename: safeName
    }, {
        name: path.parse(displayName).name,
        description: 'Recovered from uploads folder'
    });
    return result;
}

/**
 * Activate model.
 * @param {string} baseDir
 * @param {string} modelId
 * @returns {any}
 */
async function activateModel(baseDir, modelId) {
    const registry = await ensureRegistry(baseDir);
    const model = registry.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);

    registry.activeModelId = modelId;
    registry.models = registry.models.map((m) => ({
        ...m,
        status: m.id === modelId ? 'active' : (m.status === 'active' ? 'registered' : m.status)
    }));
    await saveRegistry(baseDir, registry);
    return getActiveModel(registry);
}

/**
 * Remove model.
 * @param {string} baseDir
 * @param {string} modelId
 * @returns {any}
 */
async function removeModel(baseDir, modelId) {
    const registry = await ensureRegistry(baseDir);
    const model = registry.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);
    if (model.isDefault) throw new Error('Cannot remove the default demo model');

    registry.models = registry.models.filter((m) => m.id !== modelId);
    if (registry.activeModelId === modelId) {
        const fallback = registry.models.find((m) => m.isDefault) || registry.models[0];
        registry.activeModelId = fallback?.id || null;
        if (fallback) fallback.status = 'active';
    }

    if (model.provider === 'upload' && model.path && fs.existsSync(model.path)) {
        try {
            await fs.promises.unlink(model.path);
        } catch {
            /* ignore unlink errors */
        }
    }

    await saveRegistry(baseDir, registry);
    return { removed: modelId, activeModel: getActiveModel(registry) };
}

/**
 * Update settings.
 * @param {string} baseDir
 * @param {Array} settings
 * @returns {any}
 */
async function updateSettings(baseDir, settings) {
    const registry = await ensureRegistry(baseDir);
    if (settings.ollamaBaseUrl) {
        registry.ollamaBaseUrl = String(settings.ollamaBaseUrl).trim();
    }
    await saveRegistry(baseDir, registry);
    return {
        ollamaBaseUrl: registry.ollamaBaseUrl,
        activeModel: getActiveModel(registry)
    };
}

/**
 * Test ollama connection.
 * @param {string} baseUrl
 * @param {string} modelName
 * @returns {any}
 */
async function testOllamaConnection(baseUrl, modelName) {
    const url = String(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
    const startedAt = Date.now();
    const timeoutMs = Number(process.env.OLLAMA_TEST_TIMEOUT_MS || 10000);
    try {
        const listed = await ollamaListModels(url, {
            timeoutMs,
            includeMeta: true,
            forceRefresh: true
        });
        const names = listed.models || [];
        const listMs = listed.timing?.durationMs ?? (Date.now() - startedAt);
        if (process.env.NODE_ENV !== 'production') {
            logger.info('[Ollama Test] Models found:', names);
        }
        if (modelName && !names.some((n) => n === modelName || n.startsWith(`${modelName}:`))) {
            return {
                ok: false,
                message: `Ollama is running but model "${modelName}" was not found`,
                availableModels: names.slice(0, 20),
                timings: { listMs, listSource: listed.timing?.source || 'network' }
            };
        }
        return {
            ok: true,
            message: modelName
                ? `Connected — model "${modelName}" is available`
                : `Connected — ${names.length} model(s) available`,
            availableModels: names.slice(0, 20),
            timings: { listMs, listSource: listed.timing?.source || 'network' }
        };
    } catch (error) {
        // simplebeacon:production-leak-intent: debug-artifact - Legitimate console.error for Ollama model testing in development mode
        console.error('[Ollama Test] Connection error:', error);
        return {
            ok: false,
            message: error.name === 'AbortError'
                ? 'Ollama connection timed out'
                : `Ollama connection failed: ${error.message}`,
            timings: { listMs: Date.now() - startedAt },
            timeoutMs
        };
    }
}

/**
 * Test model.
 * @param {string} baseDir
 * @param {string} modelId
 * @returns {any}
 */
async function testModel(baseDir, modelId) {
    const registry = await ensureRegistry(baseDir);
    const model = registry.models.find((m) => m.id === modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);

    let result;
    if (model.provider === 'demo') {
        result = { ok: true, message: 'Demo model — metadata only (no inference backend)' };
    } else if (model.provider === 'ollama') {
        result = await testOllamaConnection(registry.ollamaBaseUrl, model.ollamaModel);
    } else if (model.path) {
        try {
            await fs.promises.access(model.path, fs.constants.R_OK);
            const stat = await fs.promises.stat(model.path);
            result = {
                ok: true,
                message: `File readable (${formatBytes(stat.size)})`,
                path: model.path
            };
        } catch (error) {
            result = { ok: false, message: `File not readable: ${error.message}` };
        }
    } else {
        result = { ok: false, message: 'Model has no path or Ollama configuration' };
    }

    model.lastTestedAt = new Date().toISOString();
    model.testStatus = result.ok ? 'healthy' : 'unhealthy';
    await saveRegistry(baseDir, registry);
    return { model, ...result };
}

module.exports = {
    getModelsRoot,
    getRegistryPath,
    getUploadsDir,
    ensureRegistry,
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
    formatBytes
};
