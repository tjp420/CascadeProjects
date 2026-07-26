/**
 * Default API base for local development against the SimpleBeacon dashboard server.
 * Override with the `sb_api_base` query parameter, e.g.:
 *   http://localhost:5173/?sb_api_base=http://127.0.0.1:8081/api#/signin
 */
export const DEFAULT_API_BASE = 'http://127.0.0.1:8081';

export function getApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('sb_api_base');
    if (explicit) return explicit.replace(/\/+$/, '').replace(/\/api$/, '');
    const host = window.location.hostname || '';
    if (/^127\.0\.0\.1$|^localhost$/i.test(host)) {
      return DEFAULT_API_BASE;
    }
    return '';
  } catch {
    return DEFAULT_API_BASE;
  }
}
