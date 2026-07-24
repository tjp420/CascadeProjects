/**
 * Default API base for local development against the SimpleBeacon dashboard server.
 * Override with the `sb_api_base` query parameter, e.g.:
 *   http://localhost:5173/?sb_api_base=http://127.0.0.1:8081/api#/signin
 */
export const DEFAULT_API_BASE = 'http://127.0.0.1:8081/api';

export function getApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('sb_api_base') || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}
