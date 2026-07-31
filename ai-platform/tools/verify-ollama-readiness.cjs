#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Ollama Readiness Verification Script
 *
 * Tests the Ollama connection and lists available models.
 * Skips gracefully if Ollama is offline.
 */

const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.v1-internal') });

const { testOllamaConnection } = require('../server/services/local-model-service.cjs');

async function main() {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:' + '11434';
  const modelName = process.env.OLLAMA_MODEL || '';

  process.stdout.write(['🔍 Checking Ollama readiness…'].join(' ') + '\n');
  process.stdout.write([`   URL: ${baseUrl}`].join(' ') + '\n');
  process.stdout.write([`   Preferred model: ${modelName || '(none)'}`].join(' ') + '\n');
  process.stdout.write([''].join(' ') + '\n');

  try {
    const result = await testOllamaConnection(baseUrl, modelName);
    if (result.ok) {
      process.stdout.write([`✅ ${result.message}`].join(' ') + '\n');
      if (result.availableModels?.length) {
        process.stdout.write(['   Available models:'].join(' ') + '\n');
        result.availableModels.forEach((m) => void 0);
      }
      process.stdout.write([''].join(' ') + '\n');
      process.stdout.write(['🎉 Ollama is ready for optional Phase 2 inference.'].join(' ') + '\n');
      process.exit(0);
    } else {
      process.stdout.write([`⚠️  ${result.message}`].join(' ') + '\n');
      if (result.availableModels?.length) {
        process.stdout.write(['   Other available models:'].join(' ') + '\n');
        result.availableModels.forEach((m) => void 0);
      }
      process.stdout.write([''].join(' ') + '\n');
      process.stdout.write(
        ['ℹ️  Ollama is reachable but the preferred model is not found.'].join(' ') + '\n'
      );
      process.stdout.write(['   Run: ollama pull ' + modelName].join(' ') + '\n');
      process.exit(0); // soft fail — optional Phase 2
    }
  } catch (error) {
    process.stdout.write(['⚠️  Ollama connection failed:', error.message].join(' ') + '\n');
    process.stdout.write([''].join(' ') + '\n');
    process.stdout.write(['ℹ️  Ollama is optional. To enable Phase 2 inference:'].join(' ') + '\n');
    process.stdout.write(['   1. Install Ollama: https://ollama.com'].join(' ') + '\n');
    process.stdout.write(['   2. Start the Ollama service'].join(' ') + '\n');
    process.stdout.write([`   3. Run: ollama pull ${modelName || '<model>'}`].join(' ') + '\n');
    process.stdout.write(
      [`   4. Set OLLAMA_BASE_URL in .env.v1-internal (default: ${baseUrl})`].join(' ') + '\n'
    );
    process.exit(0); // soft fail — optional Phase 2
  }
}

if (require.main === module) {
  main();
}
