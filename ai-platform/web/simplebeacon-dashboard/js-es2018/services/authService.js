import { hasJsonContentType, readJsonResponseBody, withRecoverableFallback, logRecoverableDashboardError } from '../lib/recoverable-fetch.js';
import { isLocalDevHost, DEMO_EMAIL } from '../demoMode.js';
import { apiUrl } from '../utils.js';
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
        return ('Authentication API unavailable (server returned HTML instead of JSON). '
            + 'Start with npm run dashboard:v1-internal on port 3002.');
    }
    const base = (responseBody === null || responseBody === void 0 ? void 0 : responseBody.message) || (responseBody === null || responseBody === void 0 ? void 0 : responseBody.error) || fallback;
    if (httpResponse.status === 401) {
        return `${base} — use ${DEMO_EMAIL} for local demo login.`;
    }
    if (httpResponse.status === 404) {
        return ('Login route not found — Phase 2 auth did not start. '
            + 'Check server logs for JWT secret errors; run npm run dashboard:v1-internal.');
    }
    if (httpResponse.status === 429) {
        return (responseBody === null || responseBody === void 0 ? void 0 : responseBody.message) || 'Too many login attempts — wait a few minutes and retry.';
    }
    return base;
}
/**
 * Auth service.
 */
export class AuthService {
    constructor() {
        this.authRequired = false;
        this.user = null;
        this._onCrossTabSignout = this._onCrossTabSignout.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this._onCrossTabSignout);
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
        if (primary)
            return primary;
        for (const key of LEGACY_TOKEN_KEYS) {
            const val = localStorage.getItem(key);
            if (val)
                return val;
        }
        return '';
    }
    getUser() {
        if (this.user)
            return this.user;
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        }
        catch (parseError) {
            logRecoverableDashboardError('auth session user parse', parseError);
            return null;
        }
    }
    setSession(token, user) {
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
        try {
            window.dispatchEvent(new CustomEvent('auth-signed-in', { detail: { token, user } }));
            const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
            if (vscode) {
                vscode.postMessage({ command: 'setAuthState', signedIn: true, tier: this.getTier() });
            } else if (window.parent && window.parent !== window) {
                window.parent.postMessage({ command: 'setAuthState', signedIn: true, tier: this.getTier() }, '*');
            }
        }
        catch (e) { }
        try {
            const bc = new BroadcastChannel('simplebeacon-auth');
            bc.postMessage({ type: 'signed-in' });
            bc.close();
        }
        catch (e) { }
    }
    clearSession() {
        const token = this.getToken();
        if (token)
            this.unbindToken(token);
        localStorage.removeItem(TOKEN_KEY);
        clearCookie(TOKEN_KEY);
        for (const key of LEGACY_TOKEN_KEYS) {
            localStorage.removeItem(key);
            clearCookie(key);
        }
        localStorage.removeItem(USER_KEY);
        clearCookie(USER_KEY);
        this.user = null;
        try {
            window.dispatchEvent(new CustomEvent('auth-signed-out', { detail: { source: 'clearSession', token: token || '' } }));
        }
        catch (e) { }
        try {
            const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
            if (vscode) {
                vscode.postMessage({ command: 'setAuthState', signedIn: false });
            } else if (window.parent && window.parent !== window) {
                window.parent.postMessage({ command: 'setAuthState', signedIn: false }, '*');
            }
        }
        catch (e) { }
        try {
            const bc = new BroadcastChannel('simplebeacon-auth');
            bc.postMessage({ type: 'signed-out' });
            bc.close();
        }
        catch (e) { }
    }
    /**
     * Check if a non-JWT token looks like a valid SimpleBeacon license token.
     * Valid format: payloadBase64.signatureBase64 (exactly 2 parts, 1 dot).
     * Rejects arbitrary strings like "abc123" or malformed tokens.
     */
    _isValidLicenseFormat(token) {
        if (!token || typeof token !== 'string')
            return false;
        const parts = token.split('.');
        if (parts.length !== 2)
            return false;
        return parts[0].length > 0 && parts[1].length > 0;
    }
    isAuthenticated() {
        var _a;
        const token = this.getToken();
        if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
                // JWT: validate expiry
                const payload = this._decodeJwtPayload(token);
                if (!payload) {
                    return false;
                }
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    this.clearSession();
                    return false;
                }
                return true;
            }
            // Non-JWT: must match license token format (payload.signature)
            if (this._isValidLicenseFormat(token)) {
                return true;
            }
        }
        // Fallback: any stored token + valid user object counts as authenticated
        const user = this.getUser();
        if (user && (user.id || user.sub || user.email)) {
            return true;
        }
        // Also accept legacy tokens directly for upload.html → vault cross-port flow
        for (const key of LEGACY_TOKEN_KEYS) {
            const legacy = localStorage.getItem(key);
            if (legacy && this._isValidLicenseFormat(legacy))
                return true;
        }
        return Boolean((_a = this.user) === null || _a === void 0 ? void 0 : _a.vaultSession);
    }
    /**
     * Check if current user has admin/enterprise privileges.
     * @returns {boolean}
     */
    isAdmin() {
        const user = this.getUser();
        if (!user)
            return false;
        const tier = String(user.tier || user.role || user.plan || '').toLowerCase();
        return tier === 'admin' || tier === 'enterprise' || tier === 'compliance' || user.isAdmin === true;
    }
    getAuthHeaders() {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    async fetchPlatformStatus() {
        const res = await fetch(apiUrl('/api/platform/status'));
        if (!res.ok) {
            // If the status endpoint is unavailable, fail closed to signin-first.
            // On local dev the data server may not have this stub — bypass auth.
            if (isLocalDevHost()) {
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
            if (isLocalDevHost()) {
                this.authRequired = false;
                return { authRequired: false };
            }
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
        const loginHttpResponse = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loginResponseBody = await readJsonResponseBody(loginHttpResponse, {});
        if (!loginHttpResponse.ok) {
            throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody));
        }
        if (!(loginResponseBody === null || loginResponseBody === void 0 ? void 0 : loginResponseBody.token) || !(loginResponseBody === null || loginResponseBody === void 0 ? void 0 : loginResponseBody.user)) {
            throw new Error(loginErrorMessage(loginHttpResponse, loginResponseBody, 'Login response missing token'));
        }
        this.setSession(loginResponseBody.token, loginResponseBody.user);
        // Bind login token to the email account (enforces 1 account = 1 token)
        this.bindTokenToAccount(loginResponseBody.token, 'account');
        return loginResponseBody;
    }
    async register(email, password, name, username, confirmPassword) {
        const r = await fetch(apiUrl('/api/auth/register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, username, confirmPassword }) });
        const b = await readJsonResponseBody(r, {});
        if (!r.ok)
            throw new Error((b === null || b === void 0 ? void 0 : b.message) || (b === null || b === void 0 ? void 0 : b.error) || 'Registration failed');
        if (!(b === null || b === void 0 ? void 0 : b.token) || !(b === null || b === void 0 ? void 0 : b.user))
            throw new Error('Registration response missing token');
        this.setSession(b.token, b.user);
        // Bind registration token to the email account (enforces 1 account = 1 token)
        this.bindTokenToAccount(b.token, 'account');
        return b;
    }
    async logout() {
        await withRecoverableFallback('auth logout request', async () => {
            await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        }, null);
        this.clearSession();
    }
    _decodeJwtPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3)
                return null;
            function padB64(s) {
                const pad = s.length % 4;
                return pad ? s + '='.repeat(4 - pad) : s;
            }
            const headerB64 = padB64(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
            const header = JSON.parse(atob(headerB64));
            // Reject the dangerous "none" algorithm (CVE-2015-9235)
            if (header.alg === 'none') {
                console.warn('[AuthService] Rejected JWT with alg:none');
                return null;
            }
            const payloadB64 = padB64(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(atob(payloadB64));
        }
        catch (_a) {
            return null;
        }
    }
    getTokenTier() {
        const token = this.getToken();
        if (!token)
            return null;
        try {
            const payload = this._decodeJwtPayload(token);
            return (payload === null || payload === void 0 ? void 0 : payload.tier) || (payload === null || payload === void 0 ? void 0 : payload.plan) || (payload === null || payload === void 0 ? void 0 : payload.product) || null;
        }
        catch (_a) {
            return null;
        }
    }
    isFreeTier() {
        // Free tier gating is enforced everywhere so it can be tested locally.
        // Use ?devBypass=true to temporarily disable gating for local development.
        if (typeof window !== 'undefined' && window.location.search.includes('devBypass=true')) {
            return false;
        }
        const tier = this.getTokenTier();
        if (!tier)
            return false;
        const freeTiers = ['guest', 'community', 'developer', 'sandbox', 'instant', 'free', 'solo', 'locked', ''];
        return freeTiers.includes(String(tier).toLowerCase());
    }
    /**
     * Whether the current user is allowed to run a specific scan type.
     * Free tier may only run the gate/security scan.
     * @param {string} type
     * @returns {boolean}
     */
    canRunScan(type) {
        if (!this.isFreeTier())
            return true;
        const allowedForFree = ['gate', 'security', 'simplebeacon'];
        return allowedForFree.includes(String(type || '').toLowerCase());
    }
    /**
     * Whether the current user is allowed to export/download data.
     * Free tier is blocked from all exports.
     * @returns {boolean}
     */
    canExport() {
        return !this.isFreeTier();
    }
    getTier() {
        const user = this.getUser();
        const tokenTier = this.getTokenTier();
        return (user === null || user === void 0 ? void 0 : user.tier) || (user === null || user === void 0 ? void 0 : user.plan) || tokenTier || (user === null || user === void 0 ? void 0 : user.role) || 'guest';
    }
    getTierLabel() {
        const tier = String(this.getTier()).toLowerCase();
        if (['pro'].includes(tier))
            return 'Pro';
        if (['enterprise', 'compliance'].includes(tier))
            return 'Enterprise';
        return 'Solo';
    }
    isPaidTier() {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return true;
        }
        const user = this.getUser();
        const tier = String(this.getTier()).toLowerCase();
        const freeTiers = ['guest', 'community', 'developer', 'sandbox', 'instant', 'free', 'solo', 'locked', ''];
        if (freeTiers.includes(tier))
            return false;
        const paidTiers = ['pro', 'team', 'startup', 'growth', 'enterprise', 'compliance', 'license', 'admin'];
        return paidTiers.includes(tier) || (user === null || user === void 0 ? void 0 : user.isAdmin) === true;
    }
    getAllowedEngines() {
        if (this.isPaidTier())
            return null;
        return [
            'basic-logic',
            'simple-syntax',
            'dead-functions',
            'unused-variables',
            'syntax-errors',
            'basic-duplicate',
            'basic-format',
            'basic-dependency',
            'basic-security',
            'basic-quality',
            'eu-ai-act'
        ];
    }
    getScanQuotaInfo() {
        var _a, _b;
        const user = this.getUser();
        const tier = String(this.getTier()).toLowerCase();
        const quotaMap = {
            developer: Infinity,
            guest: Infinity,
            free: Infinity,
            community: Infinity,
            sandbox: Infinity,
            instant: Infinity,
            solo: Infinity,
            pro: 2500,
            team: 10000,
            startup: 2500,
            growth: 10000,
            enterprise: Infinity,
            compliance: Infinity
        };
        const websiteScanQuotaMap = {
            developer: 0,
            guest: 0,
            free: 0,
            community: 0,
            sandbox: 0,
            instant: 0,
            solo: 0,
            pro: 50,
            team: 200,
            startup: 50,
            growth: 200,
            enterprise: Infinity,
            compliance: Infinity
        };
        const quota = (_a = quotaMap[tier]) !== null && _a !== void 0 ? _a : Infinity;
        const used = (_b = user === null || user === void 0 ? void 0 : user.scansThisPeriod) !== null && _b !== void 0 ? _b : 0;
        return {
            tier,
            quota,
            used,
            remaining: quota === Infinity ? Infinity : Math.max(0, quota - used),
            unlimited: quota === Infinity,
            websiteScanQuota: websiteScanQuotaMap[tier] ?? 0,
            websiteScansUsed: (user === null || user === void 0 ? void 0 : user.websiteScansThisPeriod) || 0,
            websiteScansRemaining: (websiteScanQuotaMap[tier] ?? 0) === Infinity ? Infinity : Math.max(0, (websiteScanQuotaMap[tier] ?? 0) - ((user === null || user === void 0 ? void 0 : user.websiteScansThisPeriod) || 0))
        };
    }
    canRunRemoteClones() {
        return this.isAuthenticated() && this.isPaidTier();
    }
    canUseAdvancedEngines() {
        return this.isPaidTier();
    }
    canUseAiHygieneSuite() {
        return this.isPaidTier();
    }
    canInstallGitHook() {
        return this.isPaidTier();
    }
    canUseAssessmentsPortal() {
        return this.isAuthenticated() && this.isPaidTier();
    }
    canUseAssessmentSandbox() {
        return true;
    }
    canUseRegulatoryMapping() {
        return this.isPaidTier();
    }
    canExportPdfReports() {
        return this.isPaidTier();
    }
    canUseAuditTrail() {
        return this.isPaidTier();
    }
    canUseAiChatbot() {
        return this.isPaidTier();
    }
    canUseGzipSharing() {
        return this.isPaidTier();
    }
    canUseMultiTokenVault() {
        return this.isPaidTier();
    }
    canUseMonorepoIsolation() {
        return this.isPaidTier();
    }
    getFeatureGate(featureId) {
        const gates = {
            remoteClones: this.canRunRemoteClones(),
            advancedEngines: this.canUseAdvancedEngines(),
            aiHygieneSuite: this.canUseAiHygieneSuite(),
            gitHook: this.canInstallGitHook(),
            assessmentsPortal: this.canUseAssessmentsPortal(),
            assessmentSandbox: this.canUseAssessmentSandbox(),
            regulatoryMapping: this.canUseRegulatoryMapping(),
            pdfExport: this.canExportPdfReports(),
            auditTrail: this.canUseAuditTrail(),
            aiChatbot: this.canUseAiChatbot(),
            gzipSharing: this.canUseGzipSharing(),
            multiTokenVault: this.canUseMultiTokenVault(),
            monorepoIsolation: this.canUseMonorepoIsolation()
        };
        return {
            allowed: Boolean(gates[featureId]),
            featureId,
            tierRequired: this.isPaidTier() ? 'paid' : 'free',
            tierLabel: this.getTierLabel()
        };
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
        }
        catch (_a) {
            return [];
        }
    }
    _saveVault(vault) {
        localStorage.setItem('sb-token-vault', JSON.stringify(vault));
    }
    tryRotateVaultToken() {
        const vault = this._loadVault();
        if (!vault.length)
            return false;
        // Find a token that is not the current one and not expired
        const currentToken = this.getToken();
        const now = Date.now();
        for (let i = 0; i < vault.length; i++) {
            const entry = vault[i];
            if (entry.token === currentToken)
                continue;
            const payload = this._decodeJwtPayload(entry.token);
            if (!payload)
                continue;
            if (payload.exp && payload.exp * 1000 < now)
                continue; // skip expired
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
        }
        catch (_a) {
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
        if (!binding)
            return null;
        const currentUser = this.getUser();
        const currentEmail = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.email) || (currentUser === null || currentUser === void 0 ? void 0 : currentUser.sub) || '';
        // If bound to same account, no conflict
        if (binding.email === currentEmail)
            return null;
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
        const email = (user === null || user === void 0 ? void 0 : user.email) || (user === null || user === void 0 ? void 0 : user.sub) || 'anonymous';
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
        }
        else {
            this.bindTokenToAccount(token, 'account');
        }
    }
    async validateSession({ password, strict = false } = {}) {
        const token = this.getToken();
        if (!token) {
            // No active token — try vault rotation
            return this.tryRotateVaultToken();
        }
        const parts = token.split('.');
        // Reject obviously malformed tokens (not JWT and not valid license format)
        if (parts.length !== 2 && parts.length !== 3) {
            this.clearSession();
            return false;
        }
        if (parts.length === 2) {
            // Raw license key (payloadBase64.signatureBase64)
            if (!this._isValidLicenseFormat(token)) {
                this.clearSession();
                return false;
            }
            // Try server-side validation for license tokens
            try {
                const res = await fetch(apiUrl('/api/auth/login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licenseToken: token })
                });
                if (res.ok) {
                    const body = await readJsonResponseBody(res, null);
                    if (body === null || body === void 0 ? void 0 : body.success) {
                        this._setTokenSession({ sub: 'license-user', plan: 'licensed', tokenSession: true });
                        this.bindTokenToAccount(token, 'account');
                        return true;
                    }
                }
            }
            catch (e) {
                // Network error — fall through to offline check only in local dev
            }
            // In strict mode (explicit signin), never accept tokens without server validation
            if (strict) {
                this.clearSession();
                return false;
            }
            // Offline fallback: only accept properly formatted tokens in local dev
            if (!isLocalDevHost()) {
                this.clearSession();
                return false;
            }
            this._setTokenSession({ sub: 'license-user', plan: 'pro', tokenSession: true });
            this.bindTokenToAccount(token, 'account');
            return true;
        }
        // JWT (3 parts) — try server-side validation first
        const headers = this.getAuthHeaders();
        if (password) {
            headers['X-Token-Password'] = password;
        }
        const res = await fetch(apiUrl('/api/auth/me'), { headers });
        if (res.ok) {
            const body = await readJsonResponseBody(res, null);
            if (body === null || body === void 0 ? void 0 : body.user) {
                this.user = body.user;
                localStorage.setItem(USER_KEY, JSON.stringify(body.user));
            }
            // Bind JWT token to the authenticated account
            this.bindTokenToAccount(token, 'account');
            return true;
        }
        // Server rejected — try client-side decode for unsigned/development tokens
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
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'same-origin' });
        const body = await readJsonResponseBody(res, null);
        if (res.status === 403 && (body === null || body === void 0 ? void 0 : body.error) === 'vault_required')
            return false;
        if (!res.ok || !(body === null || body === void 0 ? void 0 : body.user))
            return false;
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
        if (this.getToken())
            return this.validateSession();
        if (isLocalDevHost())
            return this.probeVaultOperatorSession();
        return false;
    }
    // ─── Token Password Methods ───
    async checkTokenPassword(token) {
        try {
            const res = await fetch(apiUrl('/api/auth/check-token-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await readJsonResponseBody(res, {});
            return data.hasPassword === true;
        }
        catch (_a) {
            return false;
        }
    }
    async setTokenPassword(token, password) {
        try {
            const res = await fetch(apiUrl('/api/auth/set-token-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await readJsonResponseBody(res, {});
            return data.success === true;
        }
        catch (_a) {
            return false;
        }
    }
    async loginWithToken(token, password = '') {
        try {
            const res = await fetch(apiUrl('/api/auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await readJsonResponseBody(res, {});
            return data;
        }
        catch (err) {
            return { success: false, error: (err === null || err === void 0 ? void 0 : err.message) || 'Network error' };
        }
    }
    // ─── WebAuthn / Security Key Methods ───
    async getWebAuthnChallenge() {
        // Prefer server challenge for replay protection; fall back to local
        try {
            const res = await fetch(apiUrl('/api/webauthn/challenge'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success && data.challenge) {
                return data.challenge;
            }
        }
        catch {
            /* server unavailable — fall through to local */
        }
        const arr = new Uint8Array(32);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(arr);
        }
        else {
            for (let i = 0; i < 32; i++)
                arr[i] = Math.floor(Math.random() * 256);
        }
        return btoa(String.fromCharCode(...arr));
    }
    getWebAuthnCredentials() {
        try {
            const raw = localStorage.getItem('sb-webauthn-credentials');
            return raw ? JSON.parse(raw) : [];
        }
        catch (_a) {
            return [];
        }
    }
    _saveWebAuthnCredentials(credentials) {
        localStorage.setItem('sb-webauthn-credentials', JSON.stringify(credentials));
    }
    async registerWebAuthnCredential(credentialData, userId) {
        // Send to server first; fallback to localStorage
        let serverOk = false;
        try {
            const res = await fetch(apiUrl('/api/webauthn/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialData, userId })
            });
            const data = await res.json();
            serverOk = data && data.success;
        }
        catch {
            /* server unavailable — fall through to local */
        }
        // Always mirror to localStorage for client-side list
        const credentials = this.getWebAuthnCredentials();
        const existing = credentials.findIndex(c => c.id === credentialData.id);
        const entry = {
            id: credentialData.id,
            userId,
            registeredAt: new Date().toISOString(),
            type: credentialData.type || 'public-key'
        };
        if (existing >= 0) {
            credentials[existing] = entry;
        }
        else {
            credentials.push(entry);
        }
        this._saveWebAuthnCredentials(credentials);
        return serverOk || true;
    }
    removeWebAuthnCredential(credentialId) {
        const credentials = this.getWebAuthnCredentials().filter(c => c.id !== credentialId);
        this._saveWebAuthnCredentials(credentials);
        return true;
    }
}
/**
 * Auth service.
 */
export const authService = new AuthService();
