#!/usr/bin/env node
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
  const baseUrl = process.env.OLLAMA_BASE_URL || ('http://127.0.0.1:' + '11434');
  const modelName = process.env.OLLAMA_MODEL || '';

  console.log('🔍 Checking Ollama readiness…');
  console.log(`   URL: ${baseUrl}`);
  console.log(`   Preferred model: ${modelName || '(none)'}`);
  console.log('');

  try {
    const result = await testOllamaConnection(baseUrl, modelName);
    if (result.ok) {
      console.log(`✅ ${result.message}`);
      if (result.availableModels?.length) {
        console.log('   Available models:');
        result.availableModels.forEach((m) => console.log(`      • ${m}`));
      }
      console.log('');
      console.log('🎉 Ollama is ready for optional Phase 2 inference.');
      process.exit(0);
    } else {
      console.log(`⚠️  ${result.message}`);
      if (result.availableModels?.length) {
        console.log('   Other available models:');
        result.availableModels.forEach((m) => console.log(`      • ${m}`));
      }
      console.log('');
      console.log('ℹ️  Ollama is reachable but the preferred model is not found.');
      console.log('   Run: ollama pull ' + modelName);
      process.exit(0); // soft fail — optional Phase 2
    }
  } catch (error) {
    console.log('⚠️  Ollama connection failed:', error.message);
    console.log('');
    console.log('ℹ️  Ollama is optional. To enable Phase 2 inference:');
    console.log('   1. Install Ollama: https://ollama.com');
    console.log('   2. Start the Ollama service');
    console.log(`   3. Run: ollama pull ${modelName || '<model>'}`);
    console.log(`   4. Set OLLAMA_BASE_URL in .env.v1-internal (default: ${baseUrl})`);
    process.exit(0); // soft fail — optional Phase 2
  }
}

if (require.main === module) {
  main();
}
