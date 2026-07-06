import { authService } from '../services/authService.js';
import { billingService } from '../services/billingService.js';
import { showToast } from '../utils.js';
/**
 * Decode email from token.
 * @param {string} token
 * @returns {any}
 */
function decodeEmailFromToken(token) {
    if (!token)
        return '';
    try {
        const payload = token.split('.')[1];
        if (!payload)
            return '';
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const data = JSON.parse(json);
        return data.email || '';
    }
    catch (_a) {
        return '';
    }
}
/**
 * Decode jwt payload.
 * @param {string} token
 * @returns {any}
 */
function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string')
        return null;
    const parts = token.split('.');
    if (parts.length !== 2 && parts.length !== 3)
        return null;
    const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
    try {
        const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        return JSON.parse(atob(base64 + padding));
    }
    catch (_a) {
        return null;
    }
}
/**
 * Is paid token.
 * @param {string} token
 * @returns {any}
 */
function isPaidToken(token) {
    const payload = decodeJwtPayload(token);
    if (!payload)
        return false;
    const tier = payload.tier || payload.product || '';
    const freeTiers = ['community', 'starter', 'instant', 'free', 'developer', 'sandbox'];
    return !freeTiers.includes(tier);
}
/**
 * Is sandbox token.
 * @param {string} token
 * @returns {any}
 */
function isSandboxToken(token) {
    const payload = decodeJwtPayload(token);
    if (!payload)
        return false;
    const tier = payload.tier || payload.product || '';
    return tier === 'sandbox' || tier === 'developer';
}
/**
 * Sign in view.
 */
export class SignInView {
    constructor(app) {
        this.app = app;
        this._activeTab = 'email';
        this._emailMode = 'login';
    }
    async mount(container) {
        var _a, _b, _c, _d, _e;
        container.innerHTML = `<div class="signin-page"><div class="signin-card card"><p class="text-muted">Loading…</p></div></div>`;
        const authed = authService.isAuthenticated();
        const email = ((_a = authService.getUser()) === null || _a === void 0 ? void 0 : _a.email) || decodeEmailFromToken(authService.getToken()) || '';
        let entitlement = { allowed: false, plan: {}, status: {} };
        if (authed && email) {
            entitlement = await billingService.resolveEntitlement(email);
            this.app.state.billingPlan = entitlement.plan;
            this.app.state.billingStatus = entitlement.status;
        }
        const { allowed, plan } = entitlement;
        const internalDev = Boolean(plan === null || plan === void 0 ? void 0 : plan.internalDashboard);
        // If already signed in and allowed, redirect to dashboard instead of showing "already signed in" card
        if (authed && allowed) {
            this.app.navigate('dashboard');
            return;
        }
        container.innerHTML = `
      <div class="signin-page">
        <div class="signin-card card">
          <div class="signin-header">
            <span class="signin-icon" aria-hidden="true">&#128274;</span>
            <h1 class="signin-title">Sign In</h1>
            <p class="text-muted">Access your SimpleBeacon dashboard.</p>
          </div>
          ${authed ? this.renderAuthed({ email, allowed, internalDev }) : this.renderSignInForm()}
        </div>
      </div>
    `;
        if (!authed) {
            this.bindEmailModeToggle(container);
            (_b = container.querySelector('#signin-email-form')) === null || _b === void 0 ? void 0 : _b.addEventListener('submit', (e) => this.handleEmailSubmit(e));
            (_d = container.querySelector('#forgot-password-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this._showRecoveryModal());
            (_e = container.querySelector('#webauthn-signin-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => this._handleWebAuthnSignIn());
        }
        else {
            (_c = container.querySelector('#signin-signout-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', async () => {
                try {
                    await authService.logout();
                    showToast('Signed out', 'info');
                    this.app.updateAuthUi();
                    this.mount(container);
                }
                catch (err) {
                    showToast('Sign out failed', 'error');
                }
            });
        }
    }
    renderAuthed({ email, allowed, internalDev }) {
        if (allowed && internalDev) {
            return `
        <p class="signin-status">Signed in as <strong>${escapeHtml(email)}</strong> (internal preview).</p>
        <div class="signin-actions">
          <a class="btn btn-primary" href="/dashboard/dashboard">Open Dashboard</a>
          <button class="btn btn-ghost" id="signin-signout-btn">Sign Out</button>
        </div>
      `;
        }
        if (allowed) {
            return `
        <p class="signin-status">Signed in as <strong>${escapeHtml(email)}</strong>.</p>
        <div class="signin-actions">
          <a class="btn btn-primary" href="/dashboard/dashboard">Open Dashboard</a>
          <button class="btn btn-ghost" id="signin-signout-btn">Sign Out</button>
        </div>
      `;
        }
        return `
      <p class="signin-status">Signed in as <strong>${escapeHtml(email)}</strong>.</p>
      <p class="signin-note">Your token is valid but may have limited access.</p>
      <div class="signin-actions">
        <a class="btn btn-primary" href="/dashboard/dashboard">Open Dashboard</a>
        <button class="btn btn-ghost" id="signin-signout-btn">Sign Out</button>
      </div>
    `;
    }
    renderSignInForm() {
        return `
      <div class="signin-tab-panel active" id="panel-email">
        <div class="signin-subtabs">
          <button type="button" class="signin-subtab ${this._emailMode === 'login' ? 'active' : ''}" data-mode="login" id="subtab-login">Sign In</button>
          <button type="button" class="signin-subtab ${this._emailMode === 'register' ? 'active' : ''}" data-mode="register" id="subtab-register">Create Account</button>
        </div>
        <form id="signin-email-form" class="signin-form">
          <label class="field-label" for="signin-email-input">Email / Username</label>
          <input id="signin-email-input" class="input" type="text" autocomplete="email" required placeholder="email@example.com or username" />
          <label class="field-label" for="signin-password-input">Password</label>
          <input id="signin-password-input" class="input" type="password" autocomplete="current-password" required placeholder="Enter your password…" />
          <div style="display:flex;justify-content:flex-end;margin:-4px 0 8px;">
            <button type="button" id="forgot-password-btn" style="background:none;border:none;color:var(--accent);font-size:0.78rem;cursor:pointer;padding:0;">Forgot Password?</button>
          </div>
          <p id="signin-email-error" class="signin-error" hidden role="alert"></p>
          <button type="submit" class="btn btn-primary btn-block" id="signin-email-submit">${this._emailMode === 'register' ? 'Create Account' : 'Sign In'}</button>
        </form>
        <div class="signin-divider" style="text-align:center;margin:16px 0;font-size:0.8rem;color:var(--text-muted);position:relative;">
          <span style="background:var(--bg-card);padding:0 12px;position:relative;z-index:1;">or</span>
          <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--border);z-index:0;"></div>
        </div>
        <button type="button" class="btn btn-secondary btn-block" id="webauthn-signin-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <span>&#128274;</span> Sign in with Security Key
        </button>
        <p class="signin-note" id="email-mode-note">${this._emailMode === 'register' ? 'Already have an account? Switch to <strong>Sign In</strong>.' : 'New here? Switch to <strong>Create Account</strong> to register.'}</p>
      </div>

      <p class="signin-footer">
        <a href="/demo">View read-only demo</a>
        <span class="signin-footer-sep">·</span>
        <a href="/dashboard/about">About &amp; install</a>
        <span class="signin-footer-sep">·</span>
        <a href="https://github.com/tjp420/simplebeacon" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    `;
    }
    bindEmailModeToggle(container) {
        const subtabs = container.querySelectorAll('.signin-subtab');
        const submitBtn = container.querySelector('#signin-email-submit');
        const note = container.querySelector('#email-mode-note');
        const forgotBtn = container.querySelector('#forgot-password-btn');
        subtabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this._emailMode = mode;
                subtabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
                if (submitBtn)
                    submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
                if (note)
                    note.innerHTML = mode === 'login' ? 'New here? Switch to <strong>Create Account</strong> to register.' : 'Already have an account? Switch to <strong>Sign In</strong>.';
                if (forgotBtn)
                    forgotBtn.style.display = mode === 'login' ? 'block' : 'none';
            });
        });
    }
    async handleEmailSubmit(e) {
        var _a, _b;
        e.preventDefault();
        const form = e.target;
        const email = form.querySelector('#signin-email-input').value.trim();
        const password = form.querySelector('#signin-password-input').value;
        const submitBtn = form.querySelector('#signin-email-submit');
        const errorEl = form.querySelector('#signin-email-error');
        // Client-side validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (errorEl) {
                errorEl.textContent = 'Please enter a valid email address.';
                errorEl.hidden = false;
            }
            return;
        }
        if (!password || password.length < 6) {
            if (errorEl) {
                errorEl.textContent = 'Password must be at least 6 characters.';
                errorEl.hidden = false;
            }
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
        try {
            if (this._emailMode === 'register') {
                await authService.register(email, password);
                showToast('Account created successfully', 'success');
            }
            else {
                await authService.login(email, password);
                showToast('Signed in successfully', 'success');
            }
            this.app.updateAuthUi();
            (_b = (_a = this.app).bootstrapAfterAuth) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.app.navigate('dashboard');
        }
        catch (err) {
            const message = err.message || (this._emailMode === 'register' ? 'Registration failed' : 'Sign in failed');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.hidden = false;
            }
            showToast(message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = this._emailMode === 'register' ? 'Create Account' : 'Sign In';
        }
    }
    _showRecoveryModal() {
        const overlay = document.createElement('div');
        overlay.id = 'recovery-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
      <div style="background:var(--bg-card);padding:28px 32px;border-radius:14px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border);">
        <h3 style="margin:0 0 8px;font-size:1.15rem;color:var(--text-main);">&#128273; Account Recovery</h3>
        <p style="margin:0 0 18px;font-size:0.85rem;color:var(--text-muted);line-height:1.5;">Enter your email address and we'll send you instructions to reset your password.</p>
        <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">Email</label>
        <input id="recovery-email-input" type="email" placeholder="you@example.com" style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:0.95rem;margin-bottom:10px;" />
        <div id="recovery-error" style="color:var(--error);font-size:0.8rem;margin-bottom:12px;display:none;"></div>
        <div id="recovery-success" style="color:var(--success);font-size:0.8rem;margin-bottom:12px;display:none;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="recovery-cancel" style="padding:10px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-main);font-size:0.85rem;cursor:pointer;">Cancel</button>
          <button id="recovery-submit" style="padding:10px 18px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:0.85rem;font-weight:600;cursor:pointer;">Send Instructions</button>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);
        const emailInput = overlay.querySelector('#recovery-email-input');
        const errorEl = overlay.querySelector('#recovery-error');
        const successEl = overlay.querySelector('#recovery-success');
        const cancelBtn = overlay.querySelector('#recovery-cancel');
        const submitBtn = overlay.querySelector('#recovery-submit');
        const closeModal = () => overlay.remove();
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        submitBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            errorEl.style.display = 'none';
            successEl.style.display = 'none';
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errorEl.textContent = 'Please enter a valid email address.';
                errorEl.style.display = 'block';
                return;
            }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
            try {
                const res = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                const data = await res.json();
                if (data.success) {
                    successEl.textContent = 'Check your email for recovery instructions.';
                    successEl.style.display = 'block';
                    setTimeout(closeModal, 3000);
                } else {
                    errorEl.textContent = data.error || 'Failed to send recovery email.';
                    errorEl.style.display = 'block';
                }
            } catch (err) {
                errorEl.textContent = 'Network error. Please try again.';
                errorEl.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Instructions';
            }
        });
        emailInput.focus();
    }
    async _handleWebAuthnSignIn() {
        var _a, _b;
        if (!window.PublicKeyCredential) {
            showToast('Security key login is not supported in this browser.', 'error');
            return;
        }
        const credentials = authService.getWebAuthnCredentials();
        if (!credentials.length) {
            showToast('No registered security key. Register one in Profile > Security.', 'error');
            return;
        }
        try {
            const challengeBase64 = await authService.getWebAuthnChallenge();
            const challenge = base64UrlToBuffer(challengeBase64);
            const allowCredentials = credentials.map(c => ({
                id: base64UrlToBuffer(c.id),
                type: c.type || 'public-key'
            }));
            const publicKey = {
                challenge,
                allowCredentials,
                timeout: 60000,
                userVerification: 'preferred',
                rpId: window.location.hostname
            };
            showToast('Touch your security key to continue…', 'info');
            const assertion = await navigator.credentials.get({ publicKey });
            if (!assertion || !assertion.id) {
                showToast('Security key authentication failed.', 'error');
                return;
            }
            const matched = credentials.find(c => c.id === assertion.id);
            if (!matched) {
                showToast('Unrecognized security key.', 'error');
                return;
            }
            const user = authService.getUser();
            const email = (user === null || user === void 0 ? void 0 : user.email) || matched.userId || decodeEmailFromToken(authService.getToken()) || '';
            if (!authService.isAuthenticated() && !email) {
                showToast('Security key recognized, but no account session found. Sign in with email/token first.', 'error');
                return;
            }
            showToast('Security key authenticated successfully.', 'success');
            if (!authService.isAuthenticated()) {
                const existingUser = authService.getUser();
                const restoredUser = existingUser || { email: email || 'security-key-user', plan: 'community', tokenSession: true };
                authService.setSession(authService.getToken() || '', restoredUser);
            }
            this.app.updateAuthUi();
            (_b = (_a = this.app).bootstrapAfterAuth) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.app.navigate('dashboard');
        }
        catch (err) {
            const message = (err === null || err === void 0 ? void 0 : err.name) === 'NotAllowedError'
                ? 'Security key sign-in was cancelled or not allowed.'
                : ((err === null || err === void 0 ? void 0 : err.message) || 'Security key authentication failed.');
            showToast(message, 'error');
        }
    }
    destroy() { }
}
/**
 * Escape html.
 * @param {string} str
 * @returns {any}
 */
function escapeHtml(str) {
    if (!str)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function base64UrlToBuffer(base64url) {
    if (!base64url)
        return new Uint8Array(0);
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}
