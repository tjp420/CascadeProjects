import { authService } from './authService.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';

const OUTREACH_API = '/api/simplebeacon/outreach';

function outreachError(httpResponse, responseBody) {
  if (httpResponse.status === 404 && responseBody?.error === 'API route not found') {
    return 'Outreach API not loaded — restart: npm run dashboard:kill-ports && npm run dashboard:v1-internal';
  }
  if (httpResponse.status === 401) {
    return 'Sign in required — use dev@simplebeacon.ai / demo123 (local), then retry.';
  }
  if (httpResponse.status === 403 && responseBody?.error === 'vault_required') {
    return 'Vault session required — open /private-dashboard-vault?returnTo=%2Fapp%23%2Foutreach first.';
  }
  if (!responseBody?.error && !responseBody?.message && httpResponse.status === 404) {
    return 'Outreach is localhost-only — open http://localhost:54355/app#/outreach';
  }
  return responseBody.message || responseBody.error || `HTTP ${httpResponse.status}`;
}

async function outreachFetch(path, options = {}) {
  const outreachHttpResponse = await fetch(`${OUTREACH_API}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...authService.getAuthHeaders(),
      ...(options.headers || {})
    }
  });
  const outreachPayload = await readJsonResponseBody(outreachHttpResponse, {});
  if (!outreachHttpResponse.ok) {
    throw new Error(outreachError(outreachHttpResponse, outreachPayload));
  }
  return outreachPayload;
}

export async function fetchOutreachConfig() {
  return outreachFetch('/config');
}

export async function fetchOutreachSent(limit = 25) {
  return outreachFetch(`/sent?limit=${limit}`);
}

export async function sendOutreachEmail(form) {
  return outreachFetch('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form)
  });
}

export async function fetchOutreachPreview(form) {
  return outreachFetch('/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form)
  });
}
