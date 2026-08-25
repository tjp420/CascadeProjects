// simplebeacon-ignore ai-indicators
/**
 * Runtime configuration — values are injected by the server via window.__SIMPLEBEACON_ENV__.
 * Falls back to development defaults when served as static files.
 */

const env =
  (typeof window !== "undefined" && window.__SIMPLEBEACON_ENV__) || {};

/**
 * D a s h b o a r d  b a s e  u r l.
 */
export const DASHBOARD_BASE_URL = env.DASHBOARD_BASE_URL || "";
/**
 * O l l a m a  d e f a u l t  u r l.
 */
export const OLLAMA_DEFAULT_URL = env.OLLAMA_DEFAULT_URL || "";
/**
 * C o m i n g  s o o n  u r l.
 */
export const COMING_SOON_URL =
  env.COMING_SOON_URL || "/coming-soon/upload.html";
// DEMO_PASSWORD removed — token-based auth only, no hardcoded credentials

/**
 * Build a safe API URL for a given path segment.
 * Ensures the base has no trailing `/api` and the returned URL contains exactly one `/api` prefix.
 */
export function apiUrl(path) {
  // Prefer explicit env, then any detected host set on window by the detection probe.
  const envBase = env.API_BASE_URL || env.DASHBOARD_BASE_URL || "";
  const detected =
    (typeof window !== "undefined" &&
      (window.__SB_API_HOST__ || window.__SIMPLEBEACON_DETECTED_API_BASE)) ||
    "";
  const base = (envBase || detected || "")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
  const segment = String(path || "").replace(/^\/+/, "");
  if (!segment) return base || "/";
  if (base) return `${base}/api/${segment}`;
  return `/api/${segment}`;
}

// Kick off background probe to detect local API servers when sb_api_base is not provided.
if (typeof window !== "undefined") {
  (function detectLocalApiBase() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get("sb_api_base")) return;
      if (window.__SB_API_HOST__ || window.__SIMPLEBEACON_DETECTED_API_BASE)
        return;
      // Keep the probe list small to avoid repeated Local Network Access prompts
      var ports = [58000, 3000, 3001, 8080];
      // Probe a single, lightweight endpoint per origin to minimize browser preflight prompts
      var endpoints = ["/api/health"];
      function probe(url, timeout) {
        timeout = timeout || 1200;
        return new Promise(function (resolve) {
          var controller = new AbortController();
          var id = setTimeout(function () {
            controller.abort();
            resolve(false);
          }, timeout);
          fetch(url, {
            method: "GET",
            mode: "cors",
            signal: controller.signal,
            credentials: "include",
          })
            .then(function (res) {
              clearTimeout(id);
              resolve(
                !!(
                  res &&
                  (res.ok ||
                    res.status === 401 ||
                    res.status === 403 ||
                    res.status === 404)
                ),
              );
            })
            .catch(function () {
              clearTimeout(id);
              resolve(false);
            });
        });
      }
      (async function () {
        for (var i = 0; i < ports.length; i++) {
          var port = ports[i];
          var url = "http://127.0.0.1:" + port + endpoints[0];
          var ok = await probe(url, 1200);
          if (ok) {
            window.__SB_API_HOST__ = "http://127.0.0.1:" + port;
            window.__SIMPLEBEACON_DETECTED_API_BASE = window.__SB_API_HOST__;
            return;
          }
          // Small pause between ports to avoid rapid multiple permission prompts
          await new Promise(function (r) {
            return setTimeout(r, 200);
          });
        }
      })();
    } catch (e) {
      console.error("config.js error:", e);
      // ignore
    }
  })();
}
