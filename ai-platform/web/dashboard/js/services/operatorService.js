// simplebeacon-ignore documentation
import { authService } from "./authService.js?v=20260716cachefix1";
import { readJsonResponseBody } from "../lib/recoverable-fetch.js";
import { DEMO_EMAIL } from "../demoMode.js";

const API = "/api/operator";

/**
 * Operator error.
 * @param {any} httpResponse
 * @param {any} responsePayload
 * @returns {any}
 */
function operatorError(httpResponse, responsePayload) {
  if (
    httpResponse.status === 403 &&
    responsePayload?.error === "vault_required"
  ) {
    return "Vault session required — open /private-dashboard-vault?returnTo=%2Fapp%23%2Fdeliverables first.";
  }
  if (httpResponse.status === 401) {
    return `Sign in required — use ${DEMO_EMAIL} (local), then retry.`;
  }
  return (
    responsePayload.message ||
    responsePayload.error ||
    `HTTP ${httpResponse.status}`
  );
}

/**
 * Operator fetch.
 * @param {string} apiPath
 * @param {Object} options
 * @returns {any}
 */
async function operatorFetch(apiPath, options = {}) {
  const httpResponse = await fetch(`${API}${apiPath}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...authService.getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const responsePayload = await readJsonResponseBody(httpResponse, {});
  if (!httpResponse.ok) {
    throw new Error(operatorError(httpResponse, responsePayload));
  }
  return responsePayload;
}

/**
 * Fetch operator bootstrap.
 * @returns {any}
 */
export async function fetchOperatorBootstrap() {
  return operatorFetch("/bootstrap");
}

/**
 * Fetch operator products.
 * @returns {any}
 */
export async function fetchOperatorProducts() {
  return operatorFetch("/products");
}

/**
 * Create deliverable workspace.
 * @param {any} payload
 * @returns {any}
 */
export async function createDeliverableWorkspace(payload) {
  return operatorFetch("/deliverable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch eu ai act bootstrap.
 * @returns {any}
 */
export async function fetchEuAiActBootstrap() {
  return operatorFetch("/eu-ai-act/bootstrap");
}

/**
 * Run eu ai act sprint.
 * @param {any} payload
 * @returns {any}
 */
export async function runEuAiActSprint(payload) {
  return operatorFetch("/eu-ai-act/sprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
