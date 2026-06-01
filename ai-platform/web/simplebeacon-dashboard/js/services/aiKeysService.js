import { authService } from './authService.js';

const BASE = '/api/simplebeacon/user/ai-keys';

function hasJsonContentType(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

async function readJsonSafe(res, fallback = {}) {
  if (!hasJsonContentType(res)) return fallback;
  const data = await res.json().catch(() => fallback);
  return data == null ? fallback : data;
}

export function normalizeAiKeysRecord(data = null) {
  if (!data || typeof data !== 'object') {
    return {
      email: '',
      providers: {},
      ollamaBaseUrl: '',
      ollamaModel: '',
      updatedAt: null
    };
  }
  return {
    email: data.email || '',
    providers: data.providers || {},
    ollamaBaseUrl: data.ollamaBaseUrl || '',
    ollamaModel: data.ollamaModel || '',
    updatedAt: data.updatedAt || null
  };
}

export async function fetchUserAiKeys() {
  const res = await fetch(BASE, { headers: authService.getAuthHeaders() });
  const data = await readJsonSafe(res, {});
  if (!res.ok || !data.success) {
    if (res.status === 404 && data.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(data.error || data.message || 'Failed to load AI keys');
  }
  return normalizeAiKeysRecord(data);
}

export async function saveUserAiKeys(payload) {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await readJsonSafe(res, {});
  if (!res.ok || !data.success) {
    if (res.status === 404 && data.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(data.error || data.message || 'Failed to save AI keys');
  }
  return normalizeAiKeysRecord(data);
}

export async function clearUserAiKeys() {
  const res = await fetch(BASE, {
    method: 'DELETE',
    headers: authService.getAuthHeaders()
  });
  const data = await readJsonSafe(res, {});
  if (!res.ok || !data.success) {
    if (res.status === 404 && data.error === 'API route not found') {
      throw new Error('AI keys API not loaded — restart the dashboard server (npm run dashboard:v1-internal).');
    }
    throw new Error(data.error || data.message || 'Failed to clear AI keys');
  }
  return normalizeAiKeysRecord(data);
}

export async function fetchOllamaModels(baseUrl = 'http://127.0.0.1:11434') {
  const res = await fetch('/api/models/test-ollama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ollamaBaseUrl: baseUrl })
  });
  const data = await readJsonSafe(res, {});
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || 'Failed to list Ollama models');
  }
  return {
    ok: Boolean(data.ok),
    models: Array.isArray(data.availableModels) ? data.availableModels : [],
    message: data.message || ''
  };
}
