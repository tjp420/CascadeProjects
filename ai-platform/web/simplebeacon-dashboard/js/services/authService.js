import {
  hasJsonContentType,
  readJsonResponseBody,
  withRecoverableFallback,
  logRecoverableDashboardError
} from '../lib/recoverable-fetch.js';
import { isLocalDevHost } from '../demoMode.js';

const TOKEN_KEY = 'cascadeAuthToken';
const USER_KEY = 'cascadeAuthUser';
/** Legacy dashboards / upload clients read these keys */
const LEGACY_TOKEN_KEYS = ['access_token', 'token', 'authToken'];

function loginErrorMessage(httpResponse, responseBody, fallback = 'Login failed') {
  if (!hasJsonContentType(httpResponse)) {
    return (
      'Authentication API unavailable (server returned HTML instead of JSON). '
      + 'Start with npm run dashboard:v1-internal on port 54355.'
    );
  }
  const base = responseBody?.message || responseBody?.error || fallback;
  if (httpResponse.status === 401) {
    return `${base} — use dev@simplebeacon.ai / demo123 for local demo login.`;
  }
  if (httpResponse.status === 404) {
    return (
      'Login route not found — Phase 2 auth did not start. '
      + 'Check server logs for JWT secret errors; run npm run dashboard:v1-internal.'
    );
  }
  if (httpResponse.status === 429) {
    return responseBody?.message || 'Too many login attempts — wait a few minutes and retry.';
  }
  return base;
}

export class AuthService {
  constructor() {
    this.authRequired = false;
    this.user = null;
  }

  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  getUser() {
    if (this.user) return this.user;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (parseError) {
      logRecoverableDashboardError('auth session user parse', parseError);
      return null;
    }
  }

  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.setItem(key, token);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user = user;
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(USER_KEY);
    this.user = null;
  }

  isAuthenticated() {
    return Boolean(this.getToken()) || Boolean(this.user?.vaultSession);
  }

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async fetchPlatformStatus() {
    const res = await fetch('/api/platform/status');
    if (!res.ok) {
      // If the status endpoint is unavailable, fail closed to signin-first.
      this.authRequired = true;
      return null;
    }
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      // Static hosts can rewrite /api/* to HTML with 200; treat as auth-required.
      this.authRequired = true;
      return null;
    }
    const status = await res.json().catch(() => null);
    if (!status || typeof status !== 'object') {
      this.authRequired = true;
      return null;
    }
    this.authRequired = Boolean(status.authRequired);
    return status;
  }

  async login(email, password) {
    const loginHttpResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const loginResponseBody = await readJsonResponseBody(loginHttpResponse, {});
    if (!loginHttpResponse.ok) {
      throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody));
    }
    if (!loginResponseBody?.token || !loginResponseBody?.user) {
      throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody, 'Login response missing token'));
    }
    this.setSession(loginResponseBody.token, loginResponseBody.user);
    return loginResponseBody;
  }

  async logout() {
    await withRecoverableFallback('auth logout request', async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    }, null);
    this.clearSession();
  }

  async validateSession() {
    if (!this.getToken()) return false;
    const sessionHttpResponse = await fetch('/api/auth/me', { headers: this.getAuthHeaders() });
    if (!sessionHttpResponse.ok) {
      this.clearSession();
      return false;
    }
    const sessionResponseBody = await readJsonResponseBody(sessionHttpResponse, null);
    if (!sessionResponseBody || typeof sessionResponseBody !== 'object') {
      this.clearSession();
      return false;
    }
    if (sessionResponseBody.user) {
      this.user = sessionResponseBody.user;
      localStorage.setItem(USER_KEY, JSON.stringify(sessionResponseBody.user));
    }
    return true;
  }

  async probeVaultOperatorSession() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const body = await readJsonResponseBody(res, null);
    if (res.status === 403 && body?.error === 'vault_required') return false;
    if (!res.ok || !body?.user) return false;
    this.user = { ...body.user, vaultSession: true };
    return true;
  }

  async ensureAuthenticated() {
    await this.fetchPlatformStatus();
    if (!this.authRequired) return true;
    if (this.getToken()) return this.validateSession();
    if (isLocalDevHost()) return this.probeVaultOperatorSession();
    return false;
  }
}

export const authService = new AuthService();
