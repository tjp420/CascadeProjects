/**
 * ScanAttestationManager — manages short-lived, device-bound attestation
 * tokens that the local scan worker must present before running.
 *
 * Security model:
 *   1. The user's JWT auth token is sent to /api/scan/attest
 *   2. The server validates the JWT and returns a 5-minute attestation JWT
 *   3. The attestation is bound to a device fingerprint (cannot be shared)
 *   4. The scan worker verifies the attestation before running
 *   5. The attestation is refreshed automatically before expiry
 *
 * What this prevents:
 *   - Casual copying of the scan worker (won't run without attestation)
 *   - Token sharing (device-bound, 5-min TTL)
 *   - Result forgery (server-trusted results require valid attestation)
 *
 * What this CANNOT prevent:
 *   - A determined attacker modifying the worker to skip the check
 *   - This is an inherent limitation of all client-side software
 */

const ATTEST_ENDPOINT = "/api/scan/attest";
const REFRESH_BUFFER_MS = 60 * 1000; // Refresh 1 minute before expiry
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

let cachedAttestation = null;
let cachedExpiresAt = 0;
let cachedScanId = null;
let refreshTimer = null;
let deviceFingerprint = null;

/**
 * Generate a stable device fingerprint from browser characteristics.
 * This is NOT a perfect identifier — it's a best-effort binding that
 * prevents casual token sharing across machines.
 */
async function getDeviceFingerprint() {
  if (deviceFingerprint) return deviceFingerprint;

  const components = [
    navigator.userAgent || "",
    navigator.language || "",
    String(screen.width || 0) + "x" + String(screen.height || 0),
    String(screen.colorDepth || 0),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || 0),
    String(navigator.deviceMemory || 0),
    String(navigator.maxTouchPoints || 0),
  ];

  // Add WebGPU adapter info if available (stronger binding)
  try {
    const adapter = await navigator.gpu?.requestAdapter?.();
    if (adapter) {
      const info = await adapter.requestAdapterInfo?.();
      if (info) {
        components.push(info.vendor || "");
        components.push(info.architecture || "");
        components.push(info.device || "");
      }
    }
  } catch (_) {
    // WebGPU not available — skip
  }

  const fingerprint = components.join("|");
  // Hash it for a stable, compact representation
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  deviceFingerprint = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return deviceFingerprint;
}

/**
 * Get the user's auth token from localStorage (same keys as config.ts).
 */
function getAuthToken() {
  return (
    localStorage.getItem("sb_auth_token") ||
    localStorage.getItem("sb_token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("simplebeacon_token") ||
    localStorage.getItem("cascadeAuthToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken")
  );
}

/**
 * Fetch a fresh attestation token from the server.
 * @returns {Promise<{attestation: string, expiresAt: number, scanId: string, tier: string} | null>}
 */
async function fetchAttestation() {
  const token = getAuthToken();
  if (!token) {
    console.warn("[scanAttest] No auth token found — cannot attest.");
    return null;
  }

  const fingerprint = await getDeviceFingerprint();

  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(ATTEST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          deviceFingerprint: fingerprint,
        }),
      });

      if (resp.status === 429) {
        console.warn("[scanAttest] Rate limited — backing off.");
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }

      if (resp.status === 401) {
        console.warn("[scanAttest] Auth token invalid or expired.");
        return null;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        lastError = data.error || `Server returned ${resp.status}`;
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        continue;
      }

      const data = await resp.json();
      cachedAttestation = data.attestation;
      cachedExpiresAt = data.expiresAt;
      cachedScanId = data.scanId;

      // Schedule automatic refresh before expiry
      scheduleRefresh(data.expiresAt);

      console.warn(
        `[scanAttest] Attestation acquired (scanId=${data.scanId}, tier=${data.tier}, expires in ${Math.round((data.expiresAt - Date.now()) / 1000)}s)`,
      );
      return data;
    } catch (err) {
      lastError = err?.message || String(err);
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  console.error("[scanAttest] Failed to acquire attestation:", lastError);
  return null;
}

/**
 * Schedule an automatic refresh before the attestation expires.
 */
function scheduleRefresh(expiresAt) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const refreshIn = Math.max(
    1000,
    expiresAt - Date.now() - REFRESH_BUFFER_MS,
  );
  refreshTimer = setTimeout(async () => {
    console.warn("[scanAttest] Auto-refreshing attestation...");
    await fetchAttestation();
  }, refreshIn);
}

/**
 * Get a valid attestation token, refreshing if necessary.
 * Returns null if the user is not authenticated or the server is unreachable.
 *
 * @returns {Promise<{attestation: string, scanId: string, expiresAt: number} | null>}
 */
export async function getAttestation() {
  // Return cached attestation if still valid (with buffer)
  if (cachedAttestation && Date.now() < cachedExpiresAt - REFRESH_BUFFER_MS) {
    return {
      attestation: cachedAttestation,
      scanId: cachedScanId,
      expiresAt: cachedExpiresAt,
    };
  }

  // Need a fresh attestation
  const result = await fetchAttestation();
  if (!result) return null;
  return {
    attestation: result.attestation,
    scanId: result.scanId,
    expiresAt: result.expiresAt,
  };
}

/**
 * Check if an attestation is currently available (without triggering a fetch).
 * @returns {boolean}
 */
export function hasAttestation() {
  return (
    cachedAttestation !== null &&
    Date.now() < cachedExpiresAt - REFRESH_BUFFER_MS
  );
}

/**
 * Clear cached attestation (e.g., on sign-out).
 */
export function clearAttestation() {
  cachedAttestation = null;
  cachedExpiresAt = 0;
  cachedScanId = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Verify an attestation JWT's structure and expiry (client-side check).
 * This is a lightweight check — the server-side signature verification
 * is the authoritative validation. This just prevents using obviously
 * expired or malformed tokens.
 *
 * @param {string} attestation
 * @returns {boolean}
 */
export function isAttestationValid(attestation) {
  if (!attestation || typeof attestation !== "string") return false;
  try {
    const parts = attestation.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    if (Date.now() >= payload.exp * 1000) return false;
    if (payload.iss !== "simplebeacon-edge") return false;
    if (payload.aud !== "simplebeacon-scan-worker") return false;
    return true;
  } catch (_) {
    return false;
  }
}

// Listen for logout events to clear cached attestation
if (typeof window !== "undefined") {
  window.addEventListener("sb:logout", clearAttestation);
  window.addEventListener("storage", (e) => {
    if (e.key && (e.key.includes("auth") || e.key.includes("token"))) {
      // Token changed — clear attestation so it re-fetches on next use
      if (!e.newValue) clearAttestation();
    }
  });
}
