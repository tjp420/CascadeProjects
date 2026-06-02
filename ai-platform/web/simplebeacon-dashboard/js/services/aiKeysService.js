import { authService } from './authService.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';

const BASE = '/api/simplebeacon/user/ai-keys';

export function normalizeAiKeysRecord(keysRecord = null) {
  if (!keysRecord || typeof keysRecord !== 'object') {
    return {
      email: '',
      providers: {},
      ollamaBaseUrl: '',
      ollamaModel: '',
      updatedAt: null
    };
  }
  return {
    email: keysRecord.email || '',
    providers: keysRecord.providers || {},
    ollamaBaseUrl: keysRecord.ollamaBaseUrl || '',
    ollamaModel: keysRecord.ollamaModel || '',
    updatedAt: keysRecord.updatedAt || null
  };
}

export async function fetchUserAiKeys() {
  const keysHttpResponse = await fetch(BASE, { headers: authService.getAuthHeaders() });
  const keysPayload = await readJsonResponseBody(keysHttpResponse, {});
  if (!keysHttpResponse.ok || !keysPayload.success) {
    if (keysHttpResponse.status === 404 && keysPayload.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(keysPayload.error || keysPayload.message || 'Failed to load AI keys');
  }
  return normalizeAiKeysRecord(keysPayload);
}

export async function saveUserAiKeys(payload) {
  const saveHttpResponse = await fetch(BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  const savePayload = await readJsonResponseBody(saveHttpResponse, {});
  if (!saveHttpResponse.ok || !savePayload.success) {
    if (saveHttpResponse.status === 404 && savePayload.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(savePayload.error || savePayload.message || 'Failed to save AI keys');
  }
  return normalizeAiKeysRecord(savePayload);
}

export async function clearUserAiKeys() {
  const clearHttpResponse = await fetch(BASE, {
    method: 'DELETE',
    headers: authService.getAuthHeaders()
  });
  const clearPayload = await readJsonResponseBody(clearHttpResponse, {});
  if (!clearHttpResponse.ok || !clearPayload.success) {
    if (clearHttpResponse.status === 404 && clearPayload.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(clearPayload.error || clearPayload.message || 'Failed to clear AI keys');
  }
  return normalizeAiKeysRecord(clearPayload);
}

export async function fetchOllamaModels(ollamaBaseUrl = 'http://127.0.0.1:11434') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const ollamaHttpResponse = await fetch('/api/models/test-ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ollamaBaseUrl }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const ollamaProbe = await readJsonResponseBody(ollamaHttpResponse, {});
    if (!ollamaHttpResponse.ok || ollamaProbe.success === false) {
      throw new Error(ollamaProbe.error || ollamaProbe.message || 'Failed to list Ollama models');
    }
    return {
      ok: Boolean(ollamaProbe.ok),
      models: Array.isArray(ollamaProbe.availableModels) ? ollamaProbe.availableModels : [],
      message: ollamaProbe.message || ''
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Ollama connection timed out - is Ollama running?');
    }
    throw error;
  }
}
