import { getLocalBridgeFetch } from "@services/localAgentService.js";

/** Origin without a trailing `/api` so callers never hit `/api/api/health`. */
export function normalizeBridgeOrigin(apiBase: string): string {
  return String(apiBase || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/(\/api\/?)+$/i, "");
}

export function ideBridgeFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  return getLocalBridgeFetch()(input, init);
}

export async function checkLocalNetworkAccess(
  apiBase: string,
  timeoutMs = 2000,
): Promise<boolean> {
  if (!apiBase) return false;
  try {
    const origin = normalizeBridgeOrigin(apiBase);
    const url = `${origin}/api/health`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await ideBridgeFetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

export function isLoopbackHost(apiBase: string): boolean {
  const raw = String(apiBase || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw, "http://127.0.0.1");
    return /^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname);
  } catch {
    return false;
  }
}
