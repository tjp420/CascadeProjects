const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    ensureRegistry,
    registerModel,
    registerUploadedModel,
    activateModel,
    getActiveModelInfo,
    removeModel,
    formatBytes,
    getUploadsDir
} = require('../../server/services/local-model-service');

describe('local model service', () => {
    let baseDir;
    let tempModelPath;

    beforeEach(async () => {
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-models-'));
        tempModelPath = path.join(baseDir, 'sample.gguf');
        fs.writeFileSync(tempModelPath, 'gguf-demo-bytes');
    });

    afterEach(() => {
        fs.rmSync(baseDir, { recursive: true, force: true });
    });

    test('formatBytes renders human-readable sizes', () => {
        expect(formatBytes(1024)).toBe('1.0KB');
        expect(formatBytes(0)).toBeNull();
    });

    test('ensureRegistry creates default demo model', async () => {
        const registry = await ensureRegistry(baseDir);
        expect(registry.models.length).toBeGreaterThan(0);
        expect(registry.activeModelId).toBeTruthy();
    });

    test('register, activate, and read active path model', async () => {
        const { model } = await registerModel(baseDir, {
            name: 'my-local-model',
            provider: 'path',
            path: tempModelPath
        });
        expect(model.name).toBe('my-local-model');
        expect(model.provider).toBe('path');

        await activateModel(baseDir, model.id);
        const active = await getActiveModelInfo(baseDir);
        expect(active.name).toBe('my-local-model');
        expect(active.path).toBe(tempModelPath);
    });

    test('removeModel deletes non-default models', async () => {
        const { model } = await registerModel(baseDir, {
            name: 'temp-model',
            provider: 'path',
            path: tempModelPath
        });
        const result = await removeModel(baseDir, model.id);
        expect(result.removed).toBe(model.id);
    });

    test('registerUploadedModel deduplicates against orphan upload on disk', async () => {
        const uploadsDir = getUploadsDir(baseDir);
        fs.mkdirSync(uploadsDir, { recursive: true });
        const orphanPath = path.join(uploadsDir, '111111-orphan.gguf');
        fs.writeFileSync(orphanPath, 'duplicate gguf bytes');

        const duplicatePath = path.join(uploadsDir, '222222-orphan.gguf');
        fs.writeFileSync(duplicatePath, 'duplicate gguf bytes');

        const result = await registerUploadedModel(baseDir, {
            path: duplicatePath,
            originalname: 'orphan.gguf',
            filename: path.basename(duplicatePath)
        }, { name: 'orphan-model' });

        expect(result.deduplicated).toBe(false);
        expect(result.model.path).toBe(orphanPath);
        expect(fs.existsSync(duplicatePath)).toBe(false);
        expect(fs.existsSync(orphanPath)).toBe(true);
    });
});
