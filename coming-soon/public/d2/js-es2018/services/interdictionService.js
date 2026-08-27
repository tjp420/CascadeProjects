// simplebeacon-ignore: Dashboard code — interdiction management service
import { apiBase } from "./authService.js?v=20260722bridgefix1";

/**
 * Fetch the current interdiction block list and stats.
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Result with keys array, total, stats
 */
export async function fetchInterdictions(authHeaders = {}) {
  const base = apiBase() || "";
  const url = `${base}/api/audit/interdiction/status`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...authHeaders },
      credentials: "include",
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to fetch interdictions: ${err.message}`);
  }
}

/**
 * Manually block an API key.
 * @param {string} apiKey - The key to block
 * @param {string} [reason] - Reason for blocking
 * @param {number} [ttlMs] - Lockout duration in milliseconds
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with blocked, expiresAt
 */
export async function blockKey(apiKey, reason, ttlMs, authHeaders = {}) {
  const base = apiBase() || "";
  const url = `${base}/api/audit/interdiction/block`;
  const body = { apiKey };
  if (reason) body.reason = reason;
  if (ttlMs) body.ttlMs = ttlMs;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to block key: ${err.message}`);
  }
}

/**
 * Release an interdicted API key immediately.
 * @param {string} apiKey - The key to release
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with released, wasBlocked
 */
export async function releaseKey(apiKey, authHeaders = {}) {
  const base = apiBase() || "";
  const url = `${base}/api/audit/interdiction/release`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify({ apiKey }),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to release key: ${err.message}`);
  }
}
