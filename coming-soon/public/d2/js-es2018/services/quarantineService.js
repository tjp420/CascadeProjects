// simplebeacon-ignore: Dashboard code — quarantine evidence inspector service
import { apiBase } from "./authService.js?v=20260722bridgefix1";

/**
 * Fetch quarantined audit entries from the backend.
 * @param {boolean} [allOrgs] - If true, fetch entries for all orgs (admin-only)
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Result with entries array, totalEntries, metadata
 */
export async function fetchQuarantineEntries(
  allOrgs = false,
  authHeaders = {},
) {
  const base = apiBase() || "";
  const url = `${base}/api/audit/quarantine${allOrgs ? "?allOrgs=true" : ""}`;
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
    throw new Error(`Failed to fetch quarantine entries: ${err.message}`);
  }
}

/**
 * Verify the cryptographic integrity of a single quarantined entry.
 * Recomputes the entry's hash and returns whether it matches the stored hash.
 * @param {string} entryId - The entry ID to verify
 * @param {string} [orgId] - Optional org ID (defaults to caller's org on backend)
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<object>} Verification result with hashMatches, expectedHash, actualHash, etc.
 */
export async function verifyQuarantineEntry(entryId, orgId, authHeaders = {}) {
  const base = apiBase() || "";
  const url = `${base}/api/audit/quarantine/verify-entry`;
  const body = { entryId };
  if (orgId) body.orgId = orgId;
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
    throw new Error(`Failed to verify quarantine entry: ${err.message}`);
  }
}
