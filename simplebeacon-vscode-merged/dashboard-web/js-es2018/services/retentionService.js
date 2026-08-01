// simplebeacon-ignore: Dashboard code — audit retention management service
import { apiBase } from './authService.js?v=20260722bridgefix1';

/**
 * Fetch the current retention policy for the caller's org.
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Result with orgId and policy
 */
export async function fetchRetentionConfig(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/retention/config`;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { ...authHeaders },
      credentials: 'include',
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to fetch retention config: ${err.message}`);
  }
}

/**
 * Update the retention policy for the caller's org.
 * @param {object} config - { retentionDays?, maxEntries?, archive? }
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with orgId and updated policy
 */
export async function updateRetentionConfig(config, authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/retention/config`;
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to update retention config: ${err.message}`);
  }
}

/**
 * Fetch retention statistics for the caller's org.
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with total, oldestTimestamp, newestTimestamp, purgeableCount, policy
 */
export async function fetchRetentionStats(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/retention/stats`;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { ...authHeaders },
      credentials: 'include',
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to fetch retention stats: ${err.message}`);
  }
}

/**
 * Trigger a manual purge of old audit entries.
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with purged, remaining, archived counts
 */
export async function triggerRetentionPurge(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/retention/purge`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders },
      credentials: 'include',
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to trigger purge: ${err.message}`);
  }
}
