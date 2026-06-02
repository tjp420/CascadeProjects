import { authService } from './authService.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';

const API = '/api/operator';

function operatorError(httpResponse, responsePayload) {
  if (httpResponse.status === 403 && responsePayload?.error === 'vault_required') {
    return 'Vault session required — open /private-dashboard-vault?returnTo=%2Fapp%23%2Fdeliverables first.';
  }
  if (httpResponse.status === 401) {
    return 'Sign in required — use dev@simplebeacon.ai / demo123 (local), then retry.';
  }
  return responsePayload.message || responsePayload.error || `HTTP ${httpResponse.status}`;
}

async function operatorFetch(apiPath, options = {}) {
  const httpResponse = await fetch(`${API}${apiPath}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...authService.getAuthHeaders(),
      ...(options.headers || {})
    }
  });
  const responsePayload = await readJsonResponseBody(httpResponse, {});
  if (!httpResponse.ok) {
    throw new Error(operatorError(httpResponse, responsePayload));
  }
  return responsePayload;
}

export async function fetchOperatorBootstrap() {
  return operatorFetch('/bootstrap');
}

export async function fetchOperatorProducts() {
  return operatorFetch('/products');
}

export async function createDeliverableWorkspace(payload) {
  return operatorFetch('/deliverable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchEuAiActBootstrap() {
  return operatorFetch('/eu-ai-act/bootstrap');
}

export async function runEuAiActSprint(payload) {
  return operatorFetch('/eu-ai-act/sprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
