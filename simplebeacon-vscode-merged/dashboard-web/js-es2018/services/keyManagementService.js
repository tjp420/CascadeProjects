// simplebeacon-ignore: Dashboard code — key management service
import { apiBase } from './authService.js?v=20260722bridgefix1';

/**
 * Fetch the current key rotation status from the backend.
 * Returns truncated fingerprints only — never raw key material.
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Rotation status with activeFingerprint, previousFingerprint, graceExpired, etc.
 */
export async function fetchKeyStatus(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/key/status`;
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
    throw new Error(`Failed to fetch key status: ${err.message}`);
  }
}

/**
 * Trigger a master key rotation on the backend.
 * The new key is sent over HTTPS and never stored in browser memory beyond this call.
 * @param {string} newKeyRaw - High-entropy master key (min 32 characters)
 * @param {number} [graceMs] - Optional grace window override in ms
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with success flag and message
 */
export async function triggerKeyRotation(newKeyRaw, graceMs, authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/key/rotate`;
  const body = { newKeyRaw };
  if (graceMs && Number.isFinite(graceMs)) {
    body.graceMs = graceMs;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to trigger key rotation: ${err.message}`);
  }
}

/**
 * Force an out-of-band re-keying sweep on the backend.
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Result with migrated, skipped, failed, purged counts
 */
export async function forceReKeySweep(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/key/rekey-now`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders },
      credentials: 'include',
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to trigger re-key sweep: ${err.message}`);
  }
}

/**
 * Fetch background re-keying migration statistics.
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Stats with totalSweeps, totalMigrated, totalFailed, etc.
 */
export async function fetchReKeyStats(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/key/rekey-stats`;
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
    throw new Error(`Failed to fetch re-key stats: ${err.message}`);
  }
}

/**
 * Generate a high-entropy random key string using the Web Crypto API.
 * @returns {string} 64-character hex string (256 bits of entropy)
 */
export function generateRandomKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate the remaining grace window time as a human-readable string.
 * @param {number|null} rotatedAt - Timestamp of rotation (Date.now() format)
 * @param {number} graceMs - Grace window in ms
 * @returns {string} Human-readable countdown like "47h 23m remaining" or "Expired"
 */
export function formatGraceCountdown(rotatedAt, graceMs) {
  if (!rotatedAt) return '—';
  const elapsed = Date.now() - rotatedAt;
  const remaining = graceMs - elapsed;
  if (remaining <= 0) return 'Expired';
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}
