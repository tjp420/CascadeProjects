import * as http from 'http';

/**
 * Auth route fallback — now defers to the real auth handlers in dataServer.ts.
 * Native endpoints (login, register, me, token, logout) are handled upstream.
 * This fallback only returns false so unmatched requests continue to static handlers.
 * @returns false (always pass through)
 */
export function handleAuthRoutes(
  _req: http.IncomingMessage,
  _res: http.ServerResponse,
  _parsed: URL
): boolean {
  return false;
}
