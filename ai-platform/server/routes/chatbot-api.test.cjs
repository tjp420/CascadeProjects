const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');

const ROUTE_PATH = require.resolve('./chatbot-api.cjs');

function loadChatbotModule(stubs) {
  delete require.cache[ROUTE_PATH];
  const originalLoad = Module._load;
  Module._load = function patchedLoad(requestPath, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, requestPath)) {
      return stubs[requestPath];
    }
    return originalLoad.call(this, requestPath, parent, isMain);
  };
  try {
    return require('./chatbot-api.cjs');
  } finally {
    Module._load = originalLoad;
  }
}

function createTestApp(options = {}) {
  const calls = [];
  const credentials = options.credentials || {
    openai: 'sk-openai-test',
    anthropic: 'sk-anthropic-test',
    openaiModel: 'gpt-4.1-mini',
    anthropicModel: 'claude-3-5-sonnet-latest',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.2'
  };

  const stubs = {
    '../../src/lib/app-logger.cjs': {
      info() {},
      warn() {},
      error() {}
    },
    'express-rate-limit': () => (_req, _res, next) => next(),
    '../lib/user-ai-keys-store.cjs': {
      getUserAiCredentials: async () => credentials
    },
    '../middleware/auth.cjs': {
      resolveAuth: async () => ({ user: null })
    },
    '../config/constants.cjs': {
      TIMEOUT_8S: 8000,
      TIMEOUT_12S: 12000,
      TIMEOUT_1M: 60000
    },
    '../services/cloud-inference-service.cjs': {
      generateWithProvider: async (provider, messages, providerOptions) => {
        calls.push({ provider, messages, providerOptions });
        if (options.throwOnGenerate) {
          throw new Error(options.throwOnGenerate);
        }
        return {
          text: options.responseText || `response:${provider}`,
          provider,
          timing: { durationMs: 5 }
        };
      }
    },
    '../services/ollama-client.cjs': {
      DEFAULT_OLLAMA_URL: 'http://127.0.0.1:11434',
      ollamaListModels: async () => options.ollamaModels || ['llama3.2', 'qwen2.5-coder']
    },
    '../lib/auth/token-service.cjs': {
      verifyToken: async () => ({})
    },
    '../middleware/audit.cjs': {
      logSecurityEvent() {},
      logUserAction() {}
    },
    '../lib/recoverable-io.cjs': {
      readTextFileWithLimit: async () => '',
      redactTextSecrets: (text) => text
    }
  };

  const mod = loadChatbotModule(stubs);
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  mod.setupChatbotAPI(app);
  return { app, calls };
}

describe('chatbot-api contract', () => {
  let originalFetch;

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
      originalFetch = null;
    }
  });

  it('returns provider payload with discovered ollama models and model map', async () => {
    originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    const { app } = createTestApp({
      credentials: {
        openai: 'sk-openai-test',
        anthropic: 'sk-anthropic-test',
        openaiModel: 'gpt-4.1',
        anthropicModel: 'claude-3-7-sonnet-latest',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        ollamaModel: 'llama3.2'
      },
      ollamaModels: ['llama3.2', 'qwen2.5-coder']
    });

    const res = await request(app).get('/api/chatbot/providers');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.providers));
    assert.deepStrictEqual(res.body.modelsByProvider.ollama, ['llama3.2', 'qwen2.5-coder']);

    const openai = res.body.providers.find((p) => p.id === 'openai');
    const anthropic = res.body.providers.find((p) => p.id === 'anthropic');
    const ollama = res.body.providers.find((p) => p.id === 'ollama');

    assert.strictEqual(openai.model, 'gpt-4.1');
    assert.strictEqual(anthropic.model, 'claude-3-7-sonnet-latest');
    assert.strictEqual(ollama.model, 'llama3.2');
    assert.deepStrictEqual(ollama.models, ['llama3.2', 'qwen2.5-coder']);
  });

  it('propagates selected openai model to provider options', async () => {
    originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    const { app, calls } = createTestApp();
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'hello', provider: 'openai', model: 'gpt-4o-mini', conversationHistory: [] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].provider, 'openai');
    assert.strictEqual(calls[0].providerOptions.model, 'gpt-4o-mini');
    assert.strictEqual(calls[0].providerOptions.ollamaModel, null);
  });

  it('ignores unsafe model strings and falls back to persisted anthropic model', async () => {
    originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    const { app, calls } = createTestApp({
      credentials: {
        anthropic: 'sk-anthropic-test',
        anthropicModel: 'claude-3-5-haiku-latest'
      }
    });

    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'hello', provider: 'anthropic', model: 'bad model!!', conversationHistory: [] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].provider, 'anthropic');
    assert.strictEqual(calls[0].providerOptions.model, 'claude-3-5-haiku-latest');
  });

  it('returns demo fallback payload shape when ollama inference throws', async () => {
    originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true });

    const { app } = createTestApp({ throwOnGenerate: 'dial tcp timeout' });
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'hello', provider: 'ollama', model: 'llama3.2', conversationHistory: [] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.provider, 'demo');
    assert.strictEqual(typeof res.body.response, 'string');
    assert.match(res.body.response, /Ollama inference failed/);
    assert.ok(Object.prototype.hasOwnProperty.call(res.body, 'timing'));
  });
});
