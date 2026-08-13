#!/usr/bin/env node
'use strict';

/**
 * SimpleBeacon Local Model Setup Script
 *
 * Helps developers pull the correct Modelfile and create the optimized
 * Ollama model for SimpleBeacon's local LLM orchestration.
 *
 * Usage:
 *   node scripts/setup-local-model.cjs                    # default (unbreakable-oracle)
 *   node scripts/setup-local-model.cjs --model mistral    # specific model
 *   node scripts/setup-local-model.cjs --list             # list available models
 *   node scripts/setup-local-model.cjs --verify           # verify current model
 *
 * Requirements:
 *   - Ollama must be installed (https://ollama.com/download)
 *   - Ollama daemon must be running (ollama serve)
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODELS_DIR = path.resolve(__dirname, '..', 'coming-soon', 'public', 'models');
const MANIFEST_PATH = path.join(MODELS_DIR, 'manifest.json');

// ── Helpers ───────────────────────────────────────────────────────────────

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to load model manifest:', e.message);
    process.exit(1);
  }
}

function checkOllamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkOllamaRunning(baseUrl) {
  try {
    const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `${baseUrl}/api/tags`], {
      stdio: 'pipe',
      timeout: 5000,
    });
    return result.stdout.toString().trim() === '200';
  } catch {
    return false;
  }
}

function listInstalledModels(baseUrl) {
  try {
    const result = spawnSync('curl', ['-s', `${baseUrl}/api/tags`], { stdio: 'pipe', timeout: 5000 });
    const body = JSON.parse(result.stdout.toString());
    return (body.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

function createModel(modelfilePath, modelName) {
  console.log(`\nCreating Ollama model '${modelName}' from ${path.basename(modelfilePath)}...`);
  const result = spawnSync('ollama', ['create', modelName, '-f', modelfilePath], {
    stdio: 'inherit',
    timeout: 300000, // 5 minutes for model creation
  });
  return result.status === 0;
}

// ── Commands ──────────────────────────────────────────────────────────────

function cmdList() {
  const manifest = loadManifest();
  console.log('\nAvailable SimpleBeacon local models:\n');
  for (const [id, config] of Object.entries(manifest.models)) {
    const isDefault = id === manifest.defaultModel;
    console.log(`  ${isDefault ? '* ' : '  '}${id.padEnd(28)} ctx=${String(config.contextWindow).padEnd(6)} ${config.description}`);
  }
  console.log(`\n  * = default model\n`);
}

function cmdVerify() {
  const manifest = loadManifest();
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const configuredModel = process.env.OLLAMA_MODEL || `${manifest.defaultModel}:latest`;

  console.log('\nSimpleBeacon Local Model Verification\n');
  console.log('=====================================\n');

  // Check Ollama installed
  if (!checkOllamaInstalled()) {
    console.log('  [FAIL] Ollama is not installed');
    console.log('         Install from: https://ollama.com/download\n');
    process.exit(1);
  }
  console.log('  [OK]   Ollama is installed');

  // Check Ollama running
  if (!checkOllamaRunning(baseUrl)) {
    console.log('  [FAIL] Ollama daemon is not running');
    console.log('         Start it with: ollama serve\n');
    process.exit(1);
  }
  console.log('  [OK]   Ollama daemon is running');

  // Check configured model
  const installed = listInstalledModels(baseUrl);
  const modelExists = installed.some(m => m === configuredModel || m === configuredModel.replace(':latest', ''));

  if (modelExists) {
    console.log(`  [OK]   Model '${configuredModel}' is installed`);
  } else {
    console.log(`  [WARN] Model '${configuredModel}' is NOT installed`);
    console.log(`         Installed models: ${installed.join(', ') || '(none)'}`);
    console.log(`         Run: node scripts/setup-local-model.cjs --model ${configuredModel.replace(':latest', '')}\n`);
  }

  // Check num_ctx
  const numCtx = process.env.OLLAMA_NUM_CTX;
  if (numCtx) {
    console.log(`  [OK]   OLLAMA_NUM_CTX=${numCtx} (env override active)`);
  } else {
    console.log('  [INFO] OLLAMA_NUM_CTX not set — using Modelfile default (8192)');
  }

  // Check OLLAMA_BASE_URL
  console.log(`  [INFO] OLLAMA_BASE_URL=${baseUrl}`);

  console.log('\nVerification complete.\n');
}

function cmdSetup(modelId) {
  const manifest = loadManifest();
  const model = manifest.models[modelId];
  if (!model) {
    console.error(`Unknown model: ${modelId}`);
    console.error('Run --list to see available models.');
    process.exit(1);
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

  console.log(`\nSimpleBeacon Local Model Setup: ${modelId}\n`);
  console.log(`  Base model: ${model.baseModel}`);
  console.log(`  Context window: ${model.contextWindow} tokens`);
  console.log(`  Description: ${model.description}\n`);

  // Check prerequisites
  if (!checkOllamaInstalled()) {
    console.error('Ollama is not installed. Install from: https://ollama.com/download');
    process.exit(1);
  }

  if (!checkOllamaRunning(baseUrl)) {
    console.error('Ollama daemon is not running. Start it with: ollama serve');
    process.exit(1);
  }

  // Pull base model if needed
  const installed = listInstalledModels(baseUrl);
  const baseModelInstalled = installed.some(m => m === model.baseModel || m === `${model.baseModel}:latest`);

  if (!baseModelInstalled && model.baseModel !== 'llama3.2') {
    console.log(`Pulling base model '${model.baseModel}'...`);
    const pullResult = spawnSync('ollama', ['pull', model.baseModel], { stdio: 'inherit', timeout: 600000 });
    if (pullResult.status !== 0) {
      console.error(`Failed to pull base model '${model.baseModel}'`);
      process.exit(1);
    }
  } else if (baseModelInstalled) {
    console.log(`Base model '${model.baseModel}' is already installed.`);
  }

  // Create the model from Modelfile
  const modelfilePath = path.join(MODELS_DIR, model.modelfile);
  if (!fs.existsSync(modelfilePath)) {
    console.error(`Modelfile not found: ${modelfilePath}`);
    process.exit(1);
  }

  if (!createModel(modelfilePath, model.ollamaModel)) {
    console.error(`Failed to create model '${model.ollamaModel}'`);
    process.exit(1);
  }

  console.log(`\nModel '${model.ollamaModel}' created successfully!\n`);
  console.log('Next steps:');
  console.log(`  1. Set environment variables:`);
  console.log(`     OLLAMA_MODEL=${model.ollamaModel}:latest`);
  console.log(`     OLLAMA_NUM_CTX=${model.contextWindow}`);
  console.log(`  2. Test the model:`);
  console.log(`     ollama run ${model.ollamaModel}`);
  console.log(`  3. Run a SimpleBeacon scan with local analysis:\n`);
  console.log(`     npx simplebeacon scan --ai-provider ollama\n`);
}

// ── CLI ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.includes('-l')) {
    cmdList();
    return;
  }

  if (args.includes('--verify') || args.includes('-v')) {
    cmdVerify();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
SimpleBeacon Local Model Setup

Usage:
  node scripts/setup-local-model.cjs                    Setup default model (unbreakable-oracle)
  node scripts/setup-local-model.cjs --model <id>       Setup specific model
  node scripts/setup-local-model.cjs --list             List available models
  node scripts/setup-local-model.cjs --verify           Verify current model configuration
  node scripts/setup-local-model.cjs --help             Show this help

Options:
  --model <id>    Model ID from manifest.json (e.g. unbreakable-oracle, simplebeacon-mistral)
  --list          List all available model configurations
  --verify        Check if Ollama is installed, running, and the configured model exists
  --help          Show this help message

Environment Variables:
  OLLAMA_BASE_URL   Ollama API URL (default: http://127.0.0.1:11434)
  OLLAMA_MODEL      Model ID to use (default: unbreakable-oracle:latest)
  OLLAMA_NUM_CTX    Context window size in tokens (default: 8192)
`);
    return;
  }

  // Default: setup with --model arg or default model
  const modelIdx = args.indexOf('--model');
  const modelId = modelIdx >= 0 ? args[modelIdx + 1] : 'unbreakable-oracle';
  cmdSetup(modelId);
}

main();
