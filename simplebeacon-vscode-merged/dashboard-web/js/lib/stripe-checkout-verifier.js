import { apiUrl, showToast } from '../utils.js';
import { authService } from '../services/authService.js?v=20260713sync5';

/**
 * Stripe checkout metadata verifier.
 *
 * Extracts `session_id` from the URL, polls the backend session lookup
 * endpoint, and reconciles the resulting license token / subscription into
 * local state and the VS Code extension cache.
 */

const LICENSE_TOKEN_KEY = 'sb_license_token';
const BILLING_EMAIL_KEY = 'simplebeacon_billing_email';

/**
 * Post a license token to the VS Code extension host if available.
 * @param {string} token
 */
function syncTokenToExtensionHost(token) {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  if (vscode && token) {
    try {
      vscode.postMessage({ command: 'storeActiveLicenseToken', token });
    } catch {
      // Extension host unavailable — silent fail
    }
  }
}

/**
 * Fetch checkout metadata from the backend.
 * @param {string} sessionId
 * @returns {Promise<{email?: string, paymentStatus?: string, product?: string, licenseToken?: string, subscription?: any, certProfile?: any}>}
 */
export async function verifyCheckoutSession(sessionId) {
  if (!sessionId) {
    return { error: 'session_id is required' };
  }

  const res = await fetch(apiUrl(`/api/simplebeacon/billing/session?session_id=${encodeURIComponent(sessionId)}`));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || `Session lookup failed (${res.status})` };
  }

  return res.json();
}

/**
 * Apply verified checkout metadata to local state and sync to the extension.
 * @param {any} metadata
 * @returns {boolean}
 */
export function applyCheckoutMetadata(metadata) {
  if (!metadata || metadata.error) return false;

  const { email, licenseToken, subscription } = metadata;

  if (email) {
    localStorage.setItem(BILLING_EMAIL_KEY, email);
  }

  if (licenseToken) {
    localStorage.setItem(LICENSE_TOKEN_KEY, licenseToken);
    authService.setToken?.(licenseToken) || authService.bindTokenToAccount?.(licenseToken, 'checkout');
    syncTokenToExtensionHost(licenseToken);
  } else if (subscription?.apiToken) {
    localStorage.setItem('simplebeacon_billing_api_token', subscription.apiToken);
  }

  return true;
}

/**
 * Poll the backend until the checkout session shows a paid status or the
 * grace period expires. This covers the race where Stripe has processed the
 * payment but the webhook has not yet updated the local subscription store.
 *
 * @param {string} sessionId
 * @param {Object} options
 * @param {number} [options.maxAttempts=8]
 * @param {number} [options.baseDelayMs=750]
 * @returns {Promise<any>}
 */
export async function verifyCheckoutSessionWithGrace(sessionId, options = {}) {
  const { maxAttempts = 8, baseDelayMs = 750 } = options;
  let lastResult = { paymentStatus: 'unpaid' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await verifyCheckoutSession(sessionId);
    lastResult = result;

    if (result.error) {
      await sleep(baseDelayMs * attempt);
      continue;
    }

    if (result.paymentStatus === 'paid') {
      applyCheckoutMetadata(result);
      return result;
    }

    await sleep(baseDelayMs * attempt);
  }

  showToast(
    'Payment confirmed by Stripe. Your account will activate automatically in the background.',
    'info'
  );
  return lastResult;
}

/**
 * If the current URL contains a `session_id` parameter, verify it and return
 * the parsed metadata. Also strips the session_id from the URL to avoid
 * leaking it in browser history.
 *
 * @returns {Promise<any>}
 */
export async function verifyCheckoutSessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  if (!sessionId) return null;

  const metadata = await verifyCheckoutSessionWithGrace(sessionId);

  // Sanitize the URL so the session id is not retained in browser history
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

  return metadata;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
