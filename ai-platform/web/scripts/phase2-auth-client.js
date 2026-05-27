/**
 * Phase 2 client auth — JWT storage, fetch wrapper, sign-in UI
 */
(function () {
    const TOKEN_KEY = 'cascadeAuthToken';
    const USER_KEY = 'cascadeAuthUser';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        updateAuthUi();
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        updateAuthUi();
    }

    async function login(email, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.message || payload.error || 'Login failed');
        }
        setSession(payload.token, payload.user);
        return payload;
    }

    async function fetchMe() {
        const token = getToken();
        if (!token) return null;
        const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            clearSession();
            return null;
        }
        return response.json();
    }

    function installAuthFetchWrapper() {
        if (window.__phase2AuthFetchInstalled) return;
        window.__phase2AuthFetchInstalled = true;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async (url, options = {}) => {
            const token = getToken();
            const needsAuth = String(url).startsWith('/api/') && token;
            if (needsAuth) {
                const headers = new Headers(options.headers || {});
                if (!headers.has('Authorization')) {
                    headers.set('Authorization', `Bearer ${token}`);
                }
                options = { ...options, headers };
            }

            const response = await originalFetch(url, options);
            if (response.status === 401 && getToken()) {
                clearSession();
                updateAuthUi();
            }
            return response;
        };
    }

    function ensureAuthModal() {
        if (document.getElementById('phase2-auth-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'phase2-auth-modal';
        modal.className = 'phase2-auth-modal';
        modal.innerHTML = `
            <div class="phase2-auth-dialog" role="dialog" aria-labelledby="phase2-auth-title">
                <h3 id="phase2-auth-title">Sign in</h3>
                <p class="phase2-auth-lead">Use demo credentials: dev@simplebeacon.ai / demo123</p>
                <label>Email<input type="email" id="phase2-auth-email" value="dev@simplebeacon.ai" autocomplete="username"></label>
                <label>Password<input type="password" id="phase2-auth-password" value="demo123" autocomplete="current-password"></label>
                <div id="phase2-auth-error" class="phase2-auth-error" hidden></div>
                <div class="phase2-auth-actions">
                    <button type="button" class="btn btn-outline-light btn-sm" id="phase2-auth-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="phase2-auth-submit">Sign in</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.hidden = true;
        });
        document.getElementById('phase2-auth-cancel')?.addEventListener('click', () => {
            modal.hidden = true;
        });
        document.getElementById('phase2-auth-submit')?.addEventListener('click', async () => {
            const email = document.getElementById('phase2-auth-email')?.value?.trim();
            const password = document.getElementById('phase2-auth-password')?.value || '';
            const errorEl = document.getElementById('phase2-auth-error');
            try {
                await login(email, password);
                modal.hidden = true;
                if (errorEl) errorEl.hidden = true;
                window.showNotification?.('✅ Signed in successfully', 'success');
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message;
                    errorEl.hidden = false;
                }
            }
        });
    }

    function updateAuthUi() {
        const statusEl = document.getElementById('phase2-auth-status');
        const signInBtn = document.getElementById('phase2-auth-signin');
        const signOutBtn = document.getElementById('phase2-auth-signout');
        const user = getUser();

        if (statusEl) {
            statusEl.textContent = user ? `${user.name} (${user.trustLevel})` : 'Guest';
        }
        if (signInBtn) signInBtn.hidden = Boolean(user);
        if (signOutBtn) signOutBtn.hidden = !user;
    }

    function bindAuthToolbar() {
        document.getElementById('phase2-auth-signin')?.addEventListener('click', () => {
            ensureAuthModal();
            const modal = document.getElementById('phase2-auth-modal');
            if (modal) modal.hidden = false;
        });
        document.getElementById('phase2-auth-signout')?.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch {
                /* ignore */
            }
            clearSession();
            window.showNotification?.('Signed out', 'info');
        });
    }

    async function initializePhase2AuthClient() {
        installAuthFetchWrapper();
        ensureAuthModal();
        bindAuthToolbar();

        try {
            const status = await fetch('/api/platform/status').then((r) => r.json());
            window.__phase2PlatformStatus = status;
            if (status.authRequired && !getToken()) {
                updateAuthUi();
                return;
            }
        } catch {
            /* optional */
        }

        if (getToken()) {
            await fetchMe();
        }
        updateAuthUi();
    }

    window.Phase2Auth = {
        login,
        logout: clearSession,
        getToken,
        getUser,
        fetchMe,
        initializePhase2AuthClient
    };

    document.addEventListener('DOMContentLoaded', initializePhase2AuthClient);
})();
