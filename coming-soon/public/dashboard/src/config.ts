/**
 * Default API base for local development against the SimpleBeacon dashboard server.
 * Override with the `sb_api_base` query parameter, e.g.:
 *   http://localhost:5173/?sb_api_base=http://127.0.0.1:8081/api#/signin
 */
export const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:58000";

export function getApiBase(): string {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get("sb_api_base");
    if (explicit) {
      const trimmed = explicit.replace(/\/+$/, "");
      if (/\/api$/i.test(trimmed)) return trimmed.replace(/\/api$/i, "");
      return trimmed;
    }
    // Prefer an already-detected local API host (populated by background probe)
    // Window variable kept for compatibility with legacy bundles.
    // Example value: "http://127.0.0.1:58000"
    // Use `__SB_API_HOST__` (short) for legacy code and `__SIMPLEBEACON_DETECTED_API_BASE` as explicit name.
    // This allows hosted dashboards to detect a running local server and prefer it when no explicit sb_api_base is provided.
    // Detection is kicked off at module import and sets these globals asynchronously.
    // If present, prefer the detected host (do not append /api here).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win: any = window as any;
    const detected =
      win.__SB_API_HOST__ || win.__SIMPLEBEACON_DETECTED_API_BASE;
    if (detected && typeof detected === "string" && detected.length > 0)
      return String(detected).replace(/\/+$/, "");
    const host = window.location.hostname || "";
    if (/^127\.0\.0\.1$|^localhost$/i.test(host)) {
      // If the probe completed and found no local server, fall back to production API
      // to avoid CORS errors from trying to reach a non-existent local server.
      if (_probeDone && !detected) {
        return "https://simplebeacon.ai";
      }
      return DEFAULT_API_BASE;
    }
    // Canonical production + Cloudflare Pages (preview) proxy /api/* via the Worker — same-origin.
    if (
      host === "simplebeacon.ai" ||
      host.endsWith(".simplebeacon.pages.dev")
    ) {
      return window.location.origin;
    }
    // Other non-local domains fall back to production API (may require CORS on backend).
    if (!host.endsWith(".onrender.com")) {
      return "https://simplebeacon.ai";
    }
    // Onrender hosts serve the API same-origin.
    return "";
  } catch {
    return DEFAULT_API_BASE;
  }
}

/**
 * Auth token helpers — separates JWT auth tokens from license tokens.
 *
 * Storage keys (checked in priority order):
 *   sb_auth_token        — JWT auth token (dashboard primary, from login/register)
 *   sb_token             — Legacy fallback
 *   sb-token             — Legacy fallback (audit page writes here)
 *   auth_token           — Legacy fallback
 *   simplebeacon_token   — Marketing pages (audit, pricing, faq, etc.)
 *   cascadeAuthToken     — Legacy marketing pages
 *   access_token         — Legacy OAuth flow
 *   token                — Generic fallback
 *   authToken            — Legacy fallback
 *
 * User data keys:
 *   sb_user              — Dashboard primary
 *   sb-user              — Legacy fallback (audit page writes here)
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("sb_auth_token") ||
    localStorage.getItem("sb_token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("simplebeacon_token") ||
    localStorage.getItem("cascadeAuthToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken")
  );
}

export function getLicenseToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("sb_license") ||
    localStorage.getItem("sb-license")
  );
}

export function setLicenseToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("sb_license", token);
}

export function clearLicenseToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sb_license");
  localStorage.removeItem("sb-license");
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("sb_auth_token", token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  // Clear all token keys across dashboard + marketing pages
  const allKeys = [
    "sb_auth_token",
    "sb_token",
    "sb-token",
    "auth_token",
    "simplebeacon_token",
    "cascadeAuthToken",
    "access_token",
    "token",
    "authToken",
  ];
  for (const key of allKeys) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/**
 * Build auth headers for API calls. Uses the JWT auth token (not the license token).
 * Falls back to legacy sb_token for backward compatibility with existing sessions.
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return false;
  const token = getAuthToken();
  if (!token) return true;
  try {
    const parts = token.split(".");
    // 2-part license tokens (data.signature) — decode first part as payload
    // 3-part JWT tokens (header.data.signature) — decode second part as payload
    if (parts.length !== 2 && parts.length !== 3) return true;
    const payloadPart = parts.length === 2 ? parts[0] : parts[1];
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && Date.now() >= payload.exp * 1000) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Process URL query params for AI agent / automated reviewer access.
 *
 * Supported params (all optional):
 *   sb_api_base     — API base URL (e.g. https://simplebeacon.ai)
 *   sb_auth         — JWT auth token, stored to sb_auth_token
 *   sb_license_token — License token, stored to sb_license
 *   sb_agent        — Set to "1" to enable agent mode (skips local API probe, suppresses toast noise)
 *   sb_agent_token  — Single-use exchange token (new preferred method)
 *
 * Example (new — single-use token):
 *   https://simplebeacon.ai/dashboard/?sb_agent_token=abc123…#/admin
 *
 * Example (legacy — direct token embedding, being phased out):
 *   https://simplebeacon.ai/dashboard/?sb_api_base=https://simplebeacon.ai&sb_auth=eyJ...&sb_license_token=eyJ...&sb_agent=1#/admin
 *
 * Tokens are injected into localStorage on load so the dashboard treats the
 * agent as a signed-in Enterprise user with full feature access.
 */
export async function processAgentParams(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);

    // New: single-use agent token exchange
    const agentToken = params.get("sb_agent_token");
    if (agentToken) {
      try {
        const res = await fetch(apiUrl(`/agent-access/${agentToken}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.authToken) {
            setAuthToken(data.authToken);
            if (data.licenseToken) setLicenseToken(data.licenseToken);
            try { sessionStorage.setItem("sb_agent_mode", "1"); } catch { /* ignore */ }
            // Clean the URL — remove the token param
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, "", cleanUrl);
            return;
          }
        }
      } catch {
        // Exchange failed — fall through to legacy params
      }
    }

    // Legacy: direct token embedding
    const authToken = params.get("sb_auth");
    const licenseToken = params.get("sb_license_token");
    const agentMode = params.get("sb_agent");

    if (authToken) {
      setAuthToken(authToken);
    }
    if (licenseToken) {
      setLicenseToken(licenseToken);
    }
    if (agentMode === "1") {
      try { sessionStorage.setItem("sb_agent_mode", "1"); } catch { /* ignore */ }
    }
  } catch {
    /* ignore */
  }
}

export function isAgentMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("sb_agent_mode") === "1";
  } catch {
    return false;
  }
}

export function clearAuthAndRedirect(): void {
  if (typeof window === "undefined") return;
  clearAuthToken();
  localStorage.removeItem("sb_user");
  if (window.location.hash && window.location.hash.includes("signin")) return;
  window.location.hash = "#/signin";
}

export function apiUrl(path: string): string {
  const base = getApiBase() || "";
  const normalized = String(base)
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
  const segment = String(path || "").replace(/^\/+/, "");
  if (!segment) return normalized || "/";
  if (normalized) return `${normalized}/api/${segment}`;
  return `/api/${segment}`;
}

// Kick off an asynchronous probe to detect a local running API server on common developer ports.
// When found, populate window.__SB_API_HOST__ so runtime bundles can prefer the local server.
let _apiBaseDetectPromise: Promise<string | null> | null = null;
let _probeDone = false;

export function waitForApiBase(timeoutMs = 3000): Promise<string | null> {
  if (_apiBaseDetectPromise) return _apiBaseDetectPromise;
  return Promise.resolve(null);
}

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win: any = window as any;
  const _host = window.location.hostname || "";
  // Only probe for a local API server when running on localhost.
  // On hosted dashboards (simplebeacon.pages.dev), probing causes Private Network Access
  // permission prompts and CORS errors because the secure context cannot reach a local
  // server without explicit browser permission. Users who need a local server can use
  // the sb_api_base query parameter instead.
  const _isLocalhost = /^127\.0\.0\.1$|^localhost$/i.test(_host);
  if (
    _isLocalhost &&
    !win.__SB_API_HOST__ &&
    !new URLSearchParams(window.location.search).get("sb_api_base")
  ) {
    // Prefer the configured default port first, then common proxy/agent ports.
    const ports = [58000, 64772, 54358, 50559, 3001, 3000, 3002, 4000, 8080];
    _apiBaseDetectPromise = (async () => {
      async function probePort(port: number): Promise<boolean> {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
            method: "GET",
            mode: "cors",
            signal: controller.signal,
          });
          clearTimeout(id);
          if (
            !res ||
            !(
              res.ok ||
              res.status === 401 ||
              res.status === 403 ||
              res.status === 404
            )
          ) {
            return false;
          }
          // Verify the response actually came from a Simplebeacon server.
          // Other dev tools (e.g. Windsurf, Vite) may respond on 3001 with the
          // wrong CORS policy and cause subsequent API calls to fail.
          try {
            const data = await res.clone().json();
            if (data.platform !== "Simplebeacon" && data.status !== "healthy") {
              return false;
            }
          } catch {
            return false;
          }
          // Verify CORS allows the authorization header — otherwise authenticated
          // requests will fail with preflight errors.
          const allowHeaders =
            res.headers.get("Access-Control-Allow-Headers") || "";
          if (allowHeaders && allowHeaders !== "*") {
            const allowed = allowHeaders
              .toLowerCase()
              .split(",")
              .map((h) => h.trim());
            if (!allowed.includes("authorization")) {
              return false;
            }
          }
          return true;
        } catch {
          return false;
        }
      }
      const results = await Promise.allSettled(ports.map((p) => probePort(p)));
      _probeDone = true;
      for (let i = 0; i < ports.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value) {
          const base = `http://127.0.0.1:${ports[i]}`;
          win.__SB_API_HOST__ = base;
          win.__SIMPLEBEACON_DETECTED_API_BASE = base;
          return base;
        }
      }
      return null;
    })();
  } else {
    // No probing needed — mark as done so getApiBase doesn't wait
    _probeDone = true;
  }
}
