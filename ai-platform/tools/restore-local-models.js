#!/usr/bin/env node
/**
 * Restore local model registry from machine-local Ollama + GGUF paths.
 * Does not copy multi-GB files into data-central/uploads/.
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const {
    registerModel,
    activateModel,
    testModel,
    listModels,
    getActiveModelInfo
} = require('../server/services/local-model-service');

const DEFAULT_GGUF_PATH = process.env.RESTORE_GGUF_PATH
    || path.join(process.env.USERPROFILE || '', '.ollama', 'models', 'backup', 'other files', 'llama3.2-3b-q4_k_m.gguf');

const OLLAMA_MODEL = process.env.RESTORE_OLLAMA_MODEL || 'unbreakable-oracle:latest';

async function main() {
    let ollamaEntry = null;

    try {
        ollamaEntry = await registerModel(baseDir, {
            name: OLLAMA_MODEL.split(':')[0],
            provider: 'ollama',
            ollamaModel: OLLAMA_MODEL,
            description: 'Restored from local Ollama via tools/restore-local-models.js'
        });
        console.log(`Ollama: ${ollamaEntry.model.id}${ollamaEntry.deduplicated ? ' (already registered)' : ''}`);
    } catch (error) {
        console.warn(`Ollama registration skipped: ${error.message}`);
    }

    if (fs.existsSync(DEFAULT_GGUF_PATH)) {
        try {
            const pathEntry = await registerModel(baseDir, {
                name: path.basename(DEFAULT_GGUF_PATH, '.gguf'),
                provider: 'path',
                path: DEFAULT_GGUF_PATH,
                description: 'GGUF path model (external file, no upload copy)'
            });
            console.log(`Path GGUF: ${pathEntry.model.id} (${pathEntry.model.size})`);
        } catch (error) {
            console.warn(`Path registration skipped: ${error.message}`);
        }
    } else {
        console.log(`Path GGUF not found: ${DEFAULT_GGUF_PATH}`);
    }

    if (ollamaEntry?.model?.id) {
        await activateModel(baseDir, ollamaEntry.model.id);
        const test = await testModel(baseDir, ollamaEntry.model.id);
        console.log(`Active: ${test.model.name} — ${test.ok ? 'healthy' : 'unhealthy'} (${test.message})`);
    }

    const active = await getActiveModelInfo(baseDir);
    const { models } = await listModels(baseDir);
    console.log(`Registry: ${models.length} model(s), active=${active?.name || 'none'}`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
