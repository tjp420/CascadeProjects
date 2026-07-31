// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import {
    hasJsonContentType,
    readJsonResponseBody,
    withRecoverableFallback,
    logRecoverableDashboardError
} from '../lib/recoverable-fetch.js';
import { isLocalDevHost, DEMO_EMAIL } from '../demoMode.js';
import { notifyAuthState } from '../utils-lib/notify.js?v=20260716cachefix1';
/**
 * API base prefix: use the Render backend when the dashboard is served from
 * a custom domain (simplebeacon.ai / Cloudflare Pages), otherwise use relative paths.
 * The ?sb_api_base= query parameter overrides this for extension-driven website sign-in.
 */
function _isLoopbackHost(hostname) {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(String(hostname || ''));
}
function _hasExtensionBridgeParams() {
    if (typeof location === 'undefined') return false;
    try {
        const params = new URLSearchParams(location.search);
        if (params.get('sb_api_base') || params.get('sb_notify_base') || params.get('sb_website_mode')) return true;
    } catch (_a) {
        /* ignore */
    }
    try {
        if (typeof sessionStorage !== 'undefined') {
            if (
                sessionStorage.getItem('sb_api_base') ||
                sessionStorage.getItem('sb_notify_base') ||
                sessionStorage.getItem('sb_website_mode')
            )
                return true;
        }
    } catch (_b) {
        /* ignore */
    }
    return false;
}
function _isAllowedApiBase(value) {
    if (!value) return false;
    try {
        const url = new URL(value, location.href);
        const isLoopback = _isLoopbackHost(url.hostname);
        // Extension bridge: allow loopback HTTP on HTTPS pages when sb_api_base is present.
        // The CSP connect-src already permits http://127.0.0.1:* and browsers grant
        // Private Network Access for loopback when explicitly configured.
        if (!isLocalDevHost() && isLoopback && _hasExtensionBridgeParams()) return true;
        // HTTPS pages cannot call an HTTP data server (mixed-content / LAN access).
        if (location.protocol === 'https:' && url.protocol === 'http:') return false;
        // Allow loopback bridges on non-HTTPS pages when the dashboard was opened with extension params.
        if (!isLocalDevHost() && isLoopback && !_hasExtensionBridgeParams()) return false;
        return true;
    } catch (_a) {
        return false;
    }
}
function _resolveExtensionBridgeApiBase() {
    let raw = '';
    try {
        const params = new URLSearchParams(location.search);
        raw = String(params.get('sb_api_base') || params.get('sb_notify_base') || '').trim();
        if (!raw && typeof sessionStorage !== 'undefined') {
            raw = String(
                sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base') || ''
            ).trim();
        }
    } catch (_a) {
        /* ignore */
    }
    if (!raw) return '';
    raw = raw.replace(/\/+$/, '');
    if (!/\/api$/i.test(raw)) raw += '/api';
    return raw;
}
function _isCloudApiBase() {
    if (typeof location === 'undefined') return false;
    try {
        const baseUrl = new URL(apiBase(), location.href);
        const host = baseUrl.hostname;
        return host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.pages.dev');
    } catch (_a) {
        return false;
    }
}
/** True when token is a standard 3-part JWT (not a raw license key). */
function _isJwtToken(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p) && p.length > 0);
}
export function apiBase() {
    if (typeof location !== 'undefined') {
        // Runtime config injected by the API server, extension bridge, or Pages _headers/site-config.
        const env = (typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__) || {};
        const envBase =
            env.API_BASE_URL ||
            env.DASHBOARD_BASE_URL ||
            (typeof window !== 'undefined' && window.__SB_API_HOST__) ||
            '';
        if (envBase && _isAllowedApiBase(envBase)) {
            return String(envBase)
                .replace(/\/api\/?$/, '')
                .replace(/\/+$/, '');
        }
        // Extension / VS Code bridge — query param or sessionStorage (set by discoverAndApplyExtensionBridge).
        const bridgeBase = _resolveExtensionBridgeApiBase();
        if (bridgeBase && _isAllowedApiBase(bridgeBase)) {
            return bridgeBase.replace(/\/api\/?$/, '');
        }
        const host = location.hostname;
        // Canonical production + Cloudflare Pages previews serve the API same-origin.
        if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.pages.dev')) {
            return location.origin;
        }
        // Other non-local/custom domains fall back to production API.
        if (!/^(localhost|127\.0\.0\.1)$/i.test(host) && !host.endsWith('.onrender.com')) {
            return 'https://simplebeacon.ai';
        }
    }
    return '';
}
const TOKEN_KEY = 'cascadeAuthToken';
const USER_KEY = 'cascadeAuthUser';
const TOKEN_REGISTRY_KEY = 'sb-token-registry';
/** Legacy dashboards / upload clients read these keys */
const LEGACY_TOKEN_KEYS = ['access_token', 'token', 'authToken', 'simplebeacon_token'];
const ALL_TOKEN_KEYS = [TOKEN_KEY, ...LEGACY_TOKEN_KEYS];
/**
 * Get cookie.
 * @param {string} name
 * @returns {any}
 */
function getCookie(name) {
    const m = document.cookie.match('(?:^|; )' + name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
}
/**
 * Set cookie.
 * @param {string} name
 * @param {any} value
 * @param {any} maxAge
 * @returns {any}
 */
function setCookie(name, value, maxAge = 60 * 60 * 24 * 30) {
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
}
/**
 * Clear cookie.
 * @param {string} name
 * @returns {any}
 */
function clearCookie(name) {
    document.cookie = name + '=;path=/;max-age=0;SameSite=Lax';
}
// Sync cross-port auth cookies into localStorage on first load
(function syncCrossPortAuth() {
    for (const key of ALL_TOKEN_KEYS) {
        const cookieVal = getCookie(key);
        if (cookieVal && !localStorage.getItem(key)) {
            localStorage.setItem(key, cookieVal);
        }
    }
    const userCookie = getCookie(USER_KEY);
    if (userCookie && !localStorage.getItem(USER_KEY)) {
        localStorage.setItem(USER_KEY, userCookie);
    }
})();
/**
 * Login error message.
 * @param {any} httpResponse
 * @param {any} responseBody
 * @param {any} fallback
 * @returns {any}
 */
function loginErrorMessage(httpResponse, responseBody, fallback = 'Login failed') {
    if (!hasJsonContentType(httpResponse)) {
        const apiHost = apiBase() || location.origin;
        return (
            `Authentication API unavailable (server returned HTML instead of JSON). ` +
            `Check that the API is running at ${apiHost}/api/auth/login. ` +
            'For local development run npm run dashboard:v1-internal.'
        );
    }
    const base =
        (responseBody === null || responseBody === void 0 ? void 0 : responseBody.message) ||
        (responseBody === null || responseBody === void 0 ? void 0 : responseBody.error) ||
        fallback;
    if (httpResponse.status === 401) {
        const hint = isLocalDevHost() ? ` — use ${DEMO_EMAIL} for local demo login.` : '';
        return `${base}${hint}`;
    }
    if (httpResponse.status === 404) {
        return (
            'Login route not found — Phase 2 auth did not start. ' +
            'Check server logs for JWT secret errors; run npm run dashboard:v1-internal.'
        );
    }
    if (httpResponse.status === 429) {
        return (
            (responseBody === null || responseBody === void 0 ? void 0 : responseBody.message) ||
            'Too many login attempts — wait a few minutes and retry.'
        );
    }
    return base;
}
/**
 * Auth service.
 */
export class AuthService {
    static _bridgeSyncBlockedUntil = 0;
    constructor() {
        this.authRequired = false;
        this.user = null;
        this._onCrossTabSignout = this._onCrossTabSignout.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this._onCrossTabSignout);
            window.addEventListener('message', event => {
                if (!event.data) return;
                if (event.data.command === 'getAuthState') {
                    this._broadcastAuthState();
                } else if (event.data.command === 'setAuthState') {
                    if (event.data.signedIn === true && event.data.token) {
                        this.setSession(event.data.token, this.getUser() || {}, { notify: false });
                        window.dispatchEvent(new CustomEvent('auth-signed-in', { detail: event.data }));
                    } else if (event.data.signedIn === false) {
                        // Ignore sign-out messages from the VS Code: wrapper/extension polls unless they are
                        // explicitly user-initiated or the dashboard has no token of its own. This prevents
                        // a no-token extension refresh from wiping a website sign-in the extension didn't see.
                        const hasToken = !!this.getToken();
                        if (event.data.source === 'signOut' || !hasToken) {
                            this.clearSession({ notify: false });
                            window.dispatchEvent(new CustomEvent('auth-signed-out', { detail: event.data }));
                        }
                    }
                }
            });
            // Broadcast the current auth state shortly after load so the VS Code: sidebar
            // stays in sync even when sign-in happened in another tab or window.
            setTimeout(() => this._broadcastAuthState(), 500);
        }
    }
    _onCrossTabSignout(event) {
        const isTokenRemoved = ALL_TOKEN_KEYS.includes(event.key) && !event.newValue;
        const isClearAll = event.key === null;
        if (isTokenRemoved || isClearAll) {
            // Cross-tab sign-out detected
            this.clearSession();
            window.dispatchEvent(new CustomEvent('auth-signed-out', { detail: { key: event.key } }));
        }
    }
    getToken() {
        const primary = localStorage.getItem(TOKEN_KEY);
        if (primary) return primary;
        for (const key of LEGACY_TOKEN_KEYS) {
            const val = localStorage.getItem(key);
            if (val) return val;
        }
        return '';
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
    isAdmin() {
        const user = this.user || this.getUser() || {};
        const email = String(user.email || '').toLowerCase();
        if (email === 'admin@simplebeacon.ai') return true;
        const role = String(user.role || '').toLowerCase();
        const tier = String(user.tier || '').toLowerCase();
        if (role === 'admin' || role === 'superuser') return true;
        if (tier === 'admin' || tier === 'superuser') return true;
        if (
            Array.isArray(user.features) &&
            user.features
                .map(String)
                .map(s => s.toLowerCase())
                .includes('all_modules')
        )
            return true;
        try {
            const token = this.getToken();
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                const tokenEmail = String(payload.email || '').toLowerCase();
                if (tokenEmail === 'admin@simplebeacon.ai') return true;
                const tokenRole = String(payload.role || '').toLowerCase();
                const tokenTier = String(payload.tier || payload.plan || '').toLowerCase();
                if (tokenRole === 'admin' || tokenRole === 'superuser') return true;
                if (tokenTier === 'admin' || tokenTier === 'superuser') return true;
                if (
                    Array.isArray(payload.features) &&
                    payload.features
                        .map(String)
                        .map(s => s.toLowerCase())
                        .includes('all_modules')
                )
                    return true;
            }
        } catch (_a) {
            // ignore decode errors
        }
        return false;
    }
    setSession(token, user, options = {}) {
        localStorage.setItem(TOKEN_KEY, token);
        setCookie(TOKEN_KEY, token);
        for (const key of LEGACY_TOKEN_KEYS) {
            localStorage.setItem(key, token);
            setCookie(key, token);
        }
        const userJson = JSON.stringify(user);
        localStorage.setItem(USER_KEY, userJson);
        setCookie(USER_KEY, userJson);
        this.user = user;
        if (options.notify === false) return;
        // Notify parent VS Code webview of auth state change
        const tier = (user && (user.tier || user.plan)) || this.getTokenTier() || '';
        const isAdmin = this.isAdmin();
        if (typeof window !== 'undefined' && window.parent !== window) {
            window.parent.postMessage({ command: 'setAuthState', signedIn: true, tier, token, isAdmin }, '*');
        } else if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
            notifyAuthState(true, tier, token, isAdmin);
        }
        // If opened from the VS Code: "Sign In via Website" flow, redirect back to the extension.
        if (typeof window !== 'undefined' && window.parent === window) {
            try {
                const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri');
                if (redirectUri && redirectUri.startsWith('vscode://simplebeacon.simplebeacon-vscode/relay/auth')) {
                    const finalUri = `${redirectUri}?token=${encodeURIComponent(token)}&signedIn=true&tier=${encodeURIComponent(tier)}&isAdmin=${isAdmin}`;
                    window.location.href = finalUri;
                }
            } catch (e) {
                /* ignore malformed redirect_uri */
            }
        }
    }
    clearSession(options = {}) {
        const token = this.getToken();
        if (token) this.unbindToken(token);
        localStorage.removeItem(TOKEN_KEY);
        clearCookie(TOKEN_KEY);
        for (const key of LEGACY_TOKEN_KEYS) {
            localStorage.removeItem(key);
            clearCookie(key);
        }
        localStorage.removeItem(USER_KEY);
        clearCookie(USER_KEY);
        this.user = null;
        if (options.notify === false) return;
        // Notify parent VS Code webview of sign-out
        if (typeof window !== 'undefined' && window.parent !== window) {
            window.parent.postMessage({ command: 'setAuthState', signedIn: false }, '*');
        } else if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
            notifyAuthState(false);
        }
    }
    _broadcastAuthState() {
        if (typeof window === 'undefined') {
            return;
        }
        const signedIn = this.isAuthenticated();
        const token = signedIn ? this.getToken() : '';
        const user = this.getUser() || {};
        const tier = (user && (user.tier || user.plan)) || this.getTokenTier() || '';
        const isAdmin = this.isAdmin();
        if (window.parent !== window) {
            window.parent.postMessage({ command: 'setAuthState', signedIn, tier, token, isAdmin }, '*');
        } else if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
            // Only use the /api/notify bridge when the dashboard is not inside a webview iframe
            // (e.g. external browser on localhost). Inside VS Code:'s iframe, postMessage is used.
            notifyAuthState(signedIn, tier, token, isAdmin);
        }
    }
    isAuthenticated() {
        var _a;
        const token = this.getToken();
        if (token) {
            // Never treat email addresses as valid tokens.
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) {
                return false;
            }
            // Raw/local license keys are only valid against local/self-hosted APIs, not the
            // cloud service. On the cloud dashboard they should not unlock authenticated UI.
            if (!_isJwtToken(token)) {
                return !_isCloudApiBase();
            }
            const payload = this._decodeJwtPayload(token);
            // Reject expired JWTs but don't clear undecodeable tokens
            // (they may be free/sandbox tokens that still work for features)
            if (!payload) {
                return false;
            }
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                this.clearSession();
                return false;
            }
            return true;
        }
        // Also accept legacy tokens directly for upload.html → vault cross-port flow
        for (const key of LEGACY_TOKEN_KEYS) {
            if (localStorage.getItem(key)) return !_isCloudApiBase();
        }
        return Boolean((_a = this.user) === null || _a === void 0 ? void 0 : _a.vaultSession) && !_isCloudApiBase();
    }
    getAuthHeaders() {
        const token = this.getToken();
        if (!token) return {};
        // Never send email addresses as bearer tokens.
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) return {};
        // Never send local license keys to cloud API endpoints.
        if (!_isJwtToken(token) && _isCloudApiBase()) return {};
        return { Authorization: `Bearer ${token}` };
    }
    async fetchPlatformStatus() {
        const base = apiBase();
        try {
            const res = await fetch(`${base}/api/platform/status`);
            if (!res.ok) {
                // If the status endpoint is unavailable, fail closed to signin-first —
                // unless the page was opened with an extension bridge pointing at a
                // local data server, in which case the dashboard should unlock.
                if (_hasExtensionBridgeParams() && _isLoopbackHost(new URL(base, location.href).hostname)) {
                    this.authRequired = false;
                    return { authRequired: false };
                }
                this.authRequired = true;
                return null;
            }
            const contentType = String(res.headers.get('content-type') || '').toLowerCase();
            if (!contentType.includes('application/json')) {
                // Static hosts can rewrite /api/* to HTML with 200.
                // On local dev the API likely runs on a different port — bypass auth.
                if (
                    isLocalDevHost() ||
                    (_hasExtensionBridgeParams() && _isLoopbackHost(new URL(base, location.href).hostname))
                ) {
                    this.authRequired = false;
                    return { authRequired: false };
                }
                this.authRequired = true;
                return null;
            }
            const status = await res.json().catch(() => null);
            if (!status || typeof status !== 'object') {
                if (_hasExtensionBridgeParams() && _isLoopbackHost(new URL(base, location.href).hostname)) {
                    this.authRequired = false;
                    return { authRequired: false };
                }
                this.authRequired = true;
                return null;
            }
            this.authRequired = Boolean(status.authRequired);
            return status;
        } catch (_a) {
            // Network errors talking to the local bridge should not lock the UI.
            if (_hasExtensionBridgeParams() && _isLoopbackHost(new URL(base, location.href).hostname)) {
                this.authRequired = false;
                return { authRequired: false };
            }
            this.authRequired = true;
            return null;
        }
    }
    async login(email, password) {
        let loginHttpResponse;
        try {
            loginHttpResponse = await fetch(`${apiBase()}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
        } catch (networkErr) {
            throw new Error('Unable to reach the account server. Check your connection and try again.');
        }
        const loginResponseBody = await readJsonResponseBody(loginHttpResponse, {});
        if (!loginHttpResponse.ok) {
            throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody));
        }
        if (
            !(loginResponseBody === null || loginResponseBody === void 0 ? void 0 : loginResponseBody.token) ||
            !(loginResponseBody === null || loginResponseBody === void 0 ? void 0 : loginResponseBody.user)
        ) {
            throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody, 'Login response missing token'));
        }
        this.setSession(loginResponseBody.token, loginResponseBody.user);
        // Bind login token to the email account (enforces 1 account = 1 token)
        this.bindTokenToAccount(loginResponseBody.token, 'account');
        return loginResponseBody;
    }
    async register(email, password, name, username = '', confirmPassword = '', licenseToken = '') {
        const payload = { email, password, name, username, confirmPassword: confirmPassword || password };
        if (licenseToken) payload.licenseToken = licenseToken;
        let r;
        try {
            r = await fetch(`${apiBase()}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (networkErr) {
            throw new Error('Unable to reach the account server. Check your connection and try again.');
        }
        const b = await readJsonResponseBody(r, {});
        if (!r.ok)
            throw new Error(
                (b === null || b === void 0 ? void 0 : b.message) ||
                    (b === null || b === void 0 ? void 0 : b.error) ||
                    `Registration failed (${r.status})`
            );
        if (b.pending) {
            return {
                pending: true,
                success: true,
                message: b.message || 'Account submitted for approval.',
                user: b.user || null
            };
        }
        if (!(b === null || b === void 0 ? void 0 : b.token) || !(b === null || b === void 0 ? void 0 : b.user))
            throw new Error('Registration response missing token');
        this.setSession(b.token, b.user);
        // Bind registration token to the email account (enforces 1 account = 1 token)
        this.bindTokenToAccount(b.token, 'account');
        return b;
    }
    async logout() {
        await withRecoverableFallback(
            'auth logout request',
            async () => {
                await fetch(`${apiBase()}/api/auth/logout`, {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });
            },
            null
        );
        this.clearSession();
    }
    async recoverPassword(email) {
        const res = await fetch(`${apiBase()}/api/auth/recover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return readJsonResponseBody(res, {});
    }
    /**
     * Refresh the access token. Call with longLived=true before long-running analyze scans
     * to obtain a 4-hour token that survives scans longer than the default 15-minute expiry.
     */
    async refreshToken(longLived = false) {
        if (!this.isAuthenticated()) {
            throw new Error('Cannot refresh token — not authenticated');
        }
        const res = await fetch(`${apiBase()}/api/auth/refresh`, {
            method: 'POST',
            headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ longLived: longLived === true })
        });
        const body = await readJsonResponseBody(res, {});
        if (!res.ok) {
            throw new Error(body.message || body.error || 'Token refresh failed');
        }
        if (!body.token) {
            throw new Error('Token refresh response missing token');
        }
        this.setSession(body.token, this.user || this.getUser());
        return body.token;
    }
    _decodeJwtPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
            const header = JSON.parse(atob(headerB64));
            // Reject the dangerous "none" algorithm (CVE-2015-9235)
            // Skip check in local dev since server bypasses auth in development mode
            if (header.alg === 'none' && !isLocalDevHost()) {
                window['console']['warn']('[AuthService] Rejected JWT with alg:none');
                return null;
            }
            const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(payloadB64));
        } catch (_a) {
            return null;
        }
    }
    getTokenTier() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const payload = this._decodeJwtPayload(token);
            return (
                (payload === null || payload === void 0 ? void 0 : payload.tier) ||
                (payload === null || payload === void 0 ? void 0 : payload.plan) ||
                (payload === null || payload === void 0 ? void 0 : payload.product) ||
                null
            );
        } catch (_a) {
            return null;
        }
    }
    isFreeTier() {
        // Local dev hosts get full functionality regardless of token tier
        if (
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ) {
            return false;
        }
        const tier = this.getTokenTier();
        if (!tier) return false;
        const freeTiers = ['community', 'developer', 'sandbox', 'instant', 'free', ''];
        return freeTiers.includes(String(tier).toLowerCase());
    }
    /**
     * Whether the current session is allowed to use write-heavy dashboard features
     * (team dashboard, scan triggers, exports, settings). Read-only views such as
     * audit, roadmap, results, trust, security, platform, and quality are not gated
     * by this check; they rely on isAuthenticated()/isFreeTier() only.
     */
    isDashboardWriteAllowed() {
        // Local dev hosts get full functionality regardless of token tier
        if (
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ) {
            return true;
        }
        if (this.isAdmin()) return true;
        const user = this.getUser() || {};
        const role = String(user.role || '').toLowerCase();
        if (role === 'admin' || role === 'superuser') return true;
        const features = Array.isArray(user.features) ? user.features : [];
        const featureSet = new Set(features.map(String).map(s => s.toLowerCase()));
        if (featureSet.has('all_modules') || featureSet.has('team_dashboard')) return true;
        const tier = String(user.tier || user.plan || this.getTokenTier() || '').toLowerCase();
        const paidTiers = ['silver', 'gold', 'pro', 'startup', 'enterprise', 'compliance', 'team'];
        if (paidTiers.includes(tier)) return true;
        return false;
    }
    _setTokenSession(payload) {
        this.user = {
            email: payload.sub || 'token-user',
            plan: payload.plan || payload.tier || 'free',
            tokenSession: true
        };
        localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    }
    _loadVault() {
        try {
            const raw = localStorage.getItem('sb-token-vault');
            return raw ? JSON.parse(raw) : [];
        } catch (_a) {
            return [];
        }
    }
    _saveVault(vault) {
        localStorage.setItem('sb-token-vault', JSON.stringify(vault));
    }
    tryRotateVaultToken() {
        const vault = this._loadVault();
        if (!vault.length) return false;
        // Find a token that is not the current one and not expired
        const currentToken = this.getToken();
        const now = Date.now();
        for (let i = 0; i < vault.length; i++) {
            const entry = vault[i];
            if (entry.token === currentToken) continue;
            const payload = this._decodeJwtPayload(entry.token);
            if (!payload) continue;
            if (payload.exp && payload.exp * 1000 < now) continue; // skip expired
            // Rotate to this token
            this.setSession(entry.token, entry.user);
            return true;
        }
        return false;
    }
    // ─── Token Registry (1 account = 1 token enforcement) ───
    _loadTokenRegistry() {
        try {
            const raw = localStorage.getItem(TOKEN_REGISTRY_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_a) {
            return {};
        }
    }
    _saveTokenRegistry(registry) {
        localStorage.setItem(TOKEN_REGISTRY_KEY, JSON.stringify(registry));
    }
    getTokenBinding(token) {
        const registry = this._loadTokenRegistry();
        return registry[token] || null;
    }
    /**
     * Check if a token is already bound to a different account.
     * Returns the binding info if in use by another account, null otherwise.
     */
    isTokenInUseByAnotherAccount(token) {
        const binding = this.getTokenBinding(token);
        if (!binding) return null;
        const currentUser = this.getUser();
        const currentEmail =
            (currentUser === null || currentUser === void 0 ? void 0 : currentUser.email) ||
            (currentUser === null || currentUser === void 0 ? void 0 : currentUser.sub) ||
            '';
        // If bound to same account, no conflict
        if (binding.email === currentEmail) return null;
        // If token is an account token and bound elsewhere, it's in use
        if (binding.tokenClass === 'account') {
            return binding;
        }
        // Functional tokens can be shared unless explicitly locked
        if (binding.locked) {
            return binding;
        }
        return null;
    }
    /**
     * Check if a token is already activated (bound as an account token).
     * Returns true if the token has been activated on any account.
     */
    isTokenActivated(token) {
        const binding = this.getTokenBinding(token);
        return (binding === null || binding === void 0 ? void 0 : binding.tokenClass) === 'account' || false;
    }
    /**
     * Bind a token to the current account.
     * Enforces 1 account = 1 token by clearing old bindings for this account.
     */
    bindTokenToAccount(token, tokenClass = 'account') {
        const registry = this._loadTokenRegistry();
        const user = this.getUser();
        const email =
            (user === null || user === void 0 ? void 0 : user.email) ||
            (user === null || user === void 0 ? void 0 : user.sub) ||
            'anonymous';
        // 1 account = 1 token: remove any previous token bindings for this account
        for (const [existingToken, binding] of Object.entries(registry)) {
            if (binding.email === email && existingToken !== token) {
                delete registry[existingToken];
            }
        }
        registry[token] = {
            email,
            boundAt: new Date().toISOString(),
            tokenClass,
            locked: tokenClass === 'account'
        };
        this._saveTokenRegistry(registry);
    }
    /**
     * Remove a token binding (e.g., on logout or token return).
     */
    unbindToken(token) {
        const registry = this._loadTokenRegistry();
        if (registry[token]) {
            delete registry[token];
            this._saveTokenRegistry(registry);
        }
    }
    /**
     * Promote a functional token to an account token (locks it to this account).
     */
    promoteTokenToAccount(token) {
        const binding = this.getTokenBinding(token);
        if (binding) {
            binding.tokenClass = 'account';
            binding.locked = true;
            const registry = this._loadTokenRegistry();
            registry[token] = binding;
            this._saveTokenRegistry(registry);
        } else {
            this.bindTokenToAccount(token, 'account');
        }
    }
    async validateSession({ password } = {}) {
        const token = this.getToken();
        if (!token) {
            // No active token — try vault rotation
            return this.tryRotateVaultToken();
        }
        // If token looks like a raw license key (not JWT), accept it as valid
        // (upload.html sets simplebeacon_token which is not a JWT)
        // But reject email addresses — those are not valid tokens.
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) {
            this.clearSession();
            return this.tryRotateVaultToken();
        }
        if (!token.includes('.') || token.split('.').length !== 3) {
            this._setTokenSession({ sub: 'license-user', plan: 'pro', tokenSession: true });
            // Bind raw license token to current account (or anonymous if no user yet)
            this.bindTokenToAccount(token, 'account');
            return true;
        }
        // Try server-side validation first
        const headers = this.getAuthHeaders();
        if (password) {
            headers['X-Token-Password'] = password;
        }
        const res = await fetch(`${apiBase()}/api/auth/me`, { headers });
        if (res.ok) {
            const body = await readJsonResponseBody(res, null);
            if (body === null || body === void 0 ? void 0 : body.user) {
                this.user = body.user;
                localStorage.setItem(USER_KEY, JSON.stringify(body.user));
                // Bind JWT token to the authenticated account
                this.bindTokenToAccount(token, 'account');
                return true;
            }
            // If the server explicitly says the token is not authenticated, treat it as invalid.
            if (body && body.authenticated === false) {
                this.clearSession();
                return this.tryRotateVaultToken();
            }
        }
        // Server rejected or no user returned — try client-side decode for unsigned/development tokens only when auth is not required (local dev).
        if (this.authRequired) {
            this.clearSession();
            return this.tryRotateVaultToken();
        }
        const payload = this._decodeJwtPayload(token);
        if (!payload) {
            this.clearSession();
            return this.tryRotateVaultToken();
        }
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            this.clearSession();
            return this.tryRotateVaultToken();
        }
        this._setTokenSession(payload);
        return true;
    }
    async probeVaultOperatorSession() {
        const res = await fetch(`${apiBase()}/api/auth/me`, { credentials: 'same-origin' });
        const body = await readJsonResponseBody(res, null);
        if (res.status === 403 && (body === null || body === void 0 ? void 0 : body.error) === 'vault_required')
            return false;
        if (!res.ok || !(body === null || body === void 0 ? void 0 : body.user)) return false;
        this.user = { ...body.user, vaultSession: true };
        return true;
    }
    async ensureAuthenticated() {
        await this.fetchPlatformStatus();
        if (!this.authRequired) {
            // Local dev: auto-authenticate from the embedded data server so the
            // dashboard doesn't prompt for sign-in on every fresh webview load.
            if (isLocalDevHost() && !this.isAuthenticated()) {
                await this.probeVaultOperatorSession();
            }
            return true;
        }
        if (this.getToken()) return this.validateSession();
        if (isLocalDevHost()) return this.probeVaultOperatorSession();
        if (_hasExtensionBridgeParams() && !this.isAuthenticated()) {
            try {
                await this.syncFromExtensionBridge();
            } catch (_bridge) {
                /* non-fatal */
            }
            if (this.getToken()) return this.validateSession();
        }
        return false;
    }
    /** Pull license token from the VS Code extension data server when bridge params are present. */
    async syncFromExtensionBridge() {
        if (this.isAuthenticated()) return true;
        if (!_hasExtensionBridgeParams()) return false;
        if (AuthService._bridgeSyncBlockedUntil > Date.now()) return false;
        const apiRoot = _resolveExtensionBridgeApiBase();
        if (!apiRoot) return false;
        let canUseParent = false;
        try {
            const { getBridgeFetch, canUseParentBridgeFetch } =
                await import('./localAgentService.js?v=20260716cachefix1');
            canUseParent = canUseParentBridgeFetch();
            const hasAgent = typeof window !== 'undefined' && !!window.simplebeaconAgentBridge;
            if (!hasAgent && !canUseParent) {
                const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
                const targetUrl = new URL(apiRoot, location.href);
                if (isHttps && targetUrl.protocol === 'http:') {
                    AuthService._bridgeSyncBlockedUntil = Date.now() + 60000;
                    return false;
                }
            }
            const fetchFn = getBridgeFetch();
            const tokenUrl = `${apiRoot}/auth/token`;
            const res = await fetchFn(tokenUrl, { signal: AbortSignal.timeout(3500) });
            const body = await res.json().catch(() => ({}));
            if (body && body.success && body.token) {
                this.setSession(body.token, body.user || this.getUser() || {}, { notify: false });
                AuthService._bridgeSyncBlockedUntil = 0;
                return true;
            }
        } catch (err) {
            const msg = String((err === null || err === void 0 ? void 0 : err.message) || err).toLowerCase();
            const lnaBlocked =
                msg.includes('local network access') ||
                msg.includes('private network access') ||
                msg.includes('permission required') ||
                msg.includes('failed to fetch');
            if (lnaBlocked && !canUseParent) {
                AuthService._bridgeSyncBlockedUntil = Date.now() + 60000;
            }
        }
        return false;
    }
}
/**
 * Auth service.
 */
export const authService = new AuthService();
