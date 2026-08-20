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
 * Build a safe API URL for a given path segment.
 * Ensures the base has no trailing `/api` and the returned URL contains exactly one `/api` prefix.
 */
export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("sb_token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return false;
  const token =
    localStorage.getItem("sb_token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("auth_token");
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000) return true;
    return false;
  } catch {
    return true;
  }
}

export function clearAuthAndRedirect(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb-token");
  localStorage.removeItem("auth_token");
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
