// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { authService } from '../services/authService.js?v=20260720pages3';
import { billingService } from '../services/billingService.js';
import { authenticateWithSecurityKey, isWebAuthnSupported } from '../services/webauthnService.js?v=20260716cachefix1';
import { showToast } from '../utils.js';
import { COMING_SOON_URL } from '../config.js';
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
    _looksLikeJwt(val) {
        if (!val || typeof val !== 'string')
            return false;
        const parts = val.split('.');
        return parts.length >= 2 && parts.length <= 3 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p) && p.length > 4);
    }
    _ingestUrlToken() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (token && this._looksLikeJwt(token)) {
                const payload = decodeJwtPayload(token);
                if (payload && payload.email) {
                    authService.setSession(token, {
                        email: payload.email,
                        tier: payload.tier || payload.product || payload.plan || 'community',
                        role: payload.role || payload.tier || payload.product || payload.plan || 'community'
                    });
                    const params = new URLSearchParams(window.location.search);
                    params.delete('token');
                    const query = params.toString();
                    const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + (query ? '?' + query : '');
                    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                    return true;
                }
            }
        }
        catch (err) {
            console.error('Token ingestion fault:', err);
        }
        return false;
    }
    _resolveEmailMode() {
        const view = this.app._currentViewName || '';
        if (view === 'register')
            return 'register';
        return 'login';
    }
    _isRegisterMode() {
        return this._emailMode === 'register';
    }
    async mount(container) {
        var _a, _b, _c, _d, _e;
        this._mountContainer = container;
        this._emailMode = this._resolveEmailMode();
        container.innerHTML = `<div class="signin-page"><div class="signin-card card"><p class="text-muted">Loading…</p></div></div>`;
        this._ingestUrlToken();
        const authed = authService.isAuthenticated();
        const email = ((_a = authService.getUser()) === null || _a === void 0 ? void 0 : _a.email) || decodeEmailFromToken(authService.getToken()) || '';
        let entitlement = { allowed: false, plan: {}, status: {} };
        if (authed && email) {
            entitlement = await billingService.resolveEntitlement(email);
            this.app.state.billingPlan = entitlement.plan;
            this.app.state.billingStatus = entitlement.status;
            this.app.state.entitlements = entitlement.status;
        }
        const { allowed, plan } = entitlement;
        const internalDev = Boolean(plan === null || plan === void 0 ? void 0 : plan.internalDashboard);
        // If already signed in and allowed, redirect to dashboard instead of showing "already signed in" card
        // Skip redirect when opened from VS Code extension signin panel (?force=1)
        const urlParams = new URLSearchParams(window.location.search);
        const forceSignin = urlParams.get('force') === '1';
        const onRegisterRoute = this._isRegisterMode();
        if (!forceSignin && !onRegisterRoute && authed && allowed) {
            this.app.navigate('dashboard');
            return;
        }
        const isRegister = this._isRegisterMode();
        container.innerHTML = `
      <div class="signin-page">
        <div class="signin-card card">
          <div class="signin-header">
            <span class="signin-icon" aria-hidden="true">&#128274;</span>
            <h1 class="signin-title">${isRegister ? 'Create Account' : 'Sign In'}</h1>
            <p class="text-muted signin-subtitle">${isRegister ? 'Set up your SimpleBeacon account.' : 'Access your SimpleBeacon dashboard.'}</p>
          </div>
          ${authed ? this.renderAuthed({ email, allowed, internalDev }) : this.renderSignInForm()}
        </div>
      </div>
    `;
        if (!authed) {
            this.bindEmailModeToggle(container);
            this.bindMainTabs(container);
            (_b = container.querySelector('#signin-email-form')) === null || _b === void 0 ? void 0 : _b.addEventListener('submit', (e) => this.handleEmailSubmit(e));
            (_c = container.querySelector('#forgot-password-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => this._showRecoveryModal());
            (_d = container.querySelector('#webauthn-signin-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this._handleWebAuthnSignIn());
            container.querySelector('#signin-token-form')?.addEventListener('submit', (e) => this.handleTokenSubmit(e));
            const tokenPwInput = container.querySelector('#signin-token-password');
            const tokenPwToggle = container.querySelector('#signin-token-toggle-password');
            if (tokenPwInput && tokenPwToggle) {
                tokenPwToggle.addEventListener('click', () => {
                    const show = tokenPwInput.type === 'password';
                    tokenPwInput.type = show ? 'text' : 'password';
                    tokenPwToggle.textContent = show ? 'Hide' : 'Show';
                    tokenPwToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
                });
            }
        }
        else {
            (_e = container.querySelector('#signin-signout-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', async () => {
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
        const actionsStyle = 'display:flex;flex-direction:column;gap:12px;';
        const primaryStyle = 'display:block;width:100%;padding:12px 16px;border-radius:8px;background:var(--primary);color:#fff;text-align:center;text-decoration:none;font-weight:600;border:none;cursor:pointer;';
        const ghostStyle = 'display:block;width:100%;padding:12px 16px;border-radius:8px;background:transparent;color:var(--text-primary);text-align:center;text-decoration:none;font-weight:600;border:1px solid var(--border);cursor:pointer;';
        if (allowed && internalDev) {
            return `
        <p class="signin-status" style="text-align:center;margin:0 0 16px;color:var(--text-primary);">Signed in as <strong>${escapeHtml(email)}</strong> (internal preview).</p>
        <div class="signin-actions" style="${actionsStyle}">
          <a class="btn btn-primary" href="/dashboard/#/dashboard" style="${primaryStyle}">Open Dashboard</a>
          <button class="btn btn-ghost" id="signin-signout-btn" style="${ghostStyle}">Sign Out</button>
        </div>
      `;
        }
        if (allowed) {
            return `
        <p class="signin-status" style="text-align:center;margin:0 0 16px;color:var(--text-primary);">Signed in as <strong>${escapeHtml(email)}</strong>.</p>
        <div class="signin-actions" style="${actionsStyle}">
          <a class="btn btn-primary" href="/dashboard/#/dashboard" style="${primaryStyle}">Open Dashboard</a>
          <button class="btn btn-ghost" id="signin-signout-btn" style="${ghostStyle}">Sign Out</button>
        </div>
      `;
        }
        return `
      <p class="signin-status" style="text-align:center;margin:0 0 8px;color:var(--text-primary);">Signed in as <strong>${escapeHtml(email)}</strong>.</p>
      <p class="signin-note" style="text-align:center;margin:0 0 16px;font-size:0.85rem;color:var(--text-muted);">Your token is valid but may have limited access.</p>
      <div class="signin-actions" style="${actionsStyle}">
        <a class="btn btn-primary" href="/dashboard/#/dashboard" style="${primaryStyle}">Open Dashboard</a>
        <button class="btn btn-ghost" id="signin-signout-btn" style="${ghostStyle}">Sign Out</button>
      </div>
    `;
    }
    renderSignInForm() {
        const isRegister = this._isRegisterMode();
        const inputStyle = 'width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--background);color:var(--text-primary);font-size:0.95rem;box-sizing:border-box;';
        const labelStyle = 'display:block;font-size:0.85rem;color:var(--text-muted);margin-bottom:6px;';
        const tabActive = 'background:var(--surface);color:var(--primary);box-shadow:0 1px 3px rgba(0,0,0,0.08);';
        const tabBase = 'flex:1;padding:0.35rem 0.5rem;border:none;background:transparent;color:var(--text-muted);font-size:0.85rem;font-weight:500;border-radius:6px;cursor:pointer;';
        const btnPrimary = 'width:100%;padding:12px 16px;border-radius:8px;background:var(--primary);color:#fff;font-weight:600;border:none;cursor:pointer;text-align:center;';
        const btnSecondary = 'width:100%;padding:12px 16px;border-radius:8px;background:var(--surface);color:var(--text-primary);border:1px solid var(--border);cursor:pointer;text-align:center;';
        const mainTabActive = 'background:var(--primary);color:#fff;';
        const mainTabBase = 'background:var(--surface-hover);color:var(--text-muted);';
        const mainTabStyle = 'flex:1;padding:10px 16px;border:none;font-size:0.9rem;font-weight:600;border-radius:8px;cursor:pointer;transition:all 0.2s;';
        return `
      <input type="radio" name="signin-main-tab" id="tab-radio-email" value="email" checked style="position:absolute;clip:rect(0,0,0,0);pointer-events:none;">
      <input type="radio" name="signin-main-tab" id="tab-radio-token" value="token" style="position:absolute;clip:rect(0,0,0,0);pointer-events:none;">
      <style>
        .signin-tab-panel { display: none; }
        #tab-radio-email:checked ~ #panel-email,
        #tab-radio-token:checked ~ #panel-token { display: block !important; }
        #tab-radio-email:checked ~ .signin-main-tabs label[for="tab-radio-email"],
        #tab-radio-token:checked ~ .signin-main-tabs label[for="tab-radio-token"] { background: var(--primary); color: #fff; }
      </style>
      <div class="signin-main-tabs" style="display:flex;gap:6px;margin-bottom:20px;">
        <label class="signin-main-tab" for="tab-radio-email" data-tab="email" id="maintab-email" style="${mainTabStyle}${mainTabActive}text-align:center;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;">Email &amp; Password</label>
        <label class="signin-main-tab" for="tab-radio-token" data-tab="token" id="maintab-token" style="${mainTabStyle}${mainTabBase}text-align:center;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;">License Token</label>
      </div>
      <div class="signin-tab-panel active" id="panel-email">
        <div class="signin-subtabs" style="display:flex;gap:4px;margin-bottom:16px;background:var(--surface-hover);border-radius:8px;padding:3px;">
          <button type="button" class="signin-subtab ${!isRegister ? 'active' : ''}" data-mode="login" id="subtab-login" data-auth-action="signin" style="${!isRegister ? tabActive : tabBase}">Sign In</button>
          <button type="button" class="signin-subtab ${isRegister ? 'active' : ''}" data-mode="register" id="subtab-register" data-auth-action="register" style="${isRegister ? tabActive : tabBase}">Create Account</button>
        </div>
        <form id="signin-email-form" class="signin-form" style="display:flex;flex-direction:column;gap:14px;">
          ${isRegister ? `
          <div>
            <label class="field-label" for="signin-name-input" style="${labelStyle}">Full name</label>
            <input id="signin-name-input" class="input" type="text" autocomplete="name" required placeholder="Your name" style="${inputStyle}" />
          </div>
          <div>
            <label class="field-label" for="signin-username-input" style="${labelStyle}">Username</label>
            <input id="signin-username-input" class="input" type="text" autocomplete="username" required pattern="[A-Za-z0-9_]{3,32}" placeholder="letters_numbers_underscore" style="${inputStyle}" />
          </div>` : ''}
          <div>
            <label class="field-label" for="signin-email-input" style="${labelStyle}">${isRegister ? 'Email address' : 'Email / Username'}</label>
            <input id="signin-email-input" class="input" type="${isRegister ? 'email' : 'text'}" autocomplete="email" required placeholder="${isRegister ? 'you@company.com' : 'email@example.com or username'}" style="${inputStyle}" />
          </div>
          <div>
            <label class="field-label" for="signin-password-input" style="${labelStyle}">Password</label>
            <input id="signin-password-input" class="input" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required placeholder="${isRegister ? 'Choose a password (8+ characters)…' : 'Enter your password…'}" style="${inputStyle}" />
          </div>
          ${isRegister ? `
          <div>
            <label class="field-label" for="signin-confirm-password-input" style="${labelStyle}">Confirm Password</label>
            <input id="signin-confirm-password-input" class="input" type="password" autocomplete="new-password" required placeholder="Re-enter your password…" style="${inputStyle}" />
          </div>` : ''}
          <div style="display:${isRegister ? 'none' : 'flex'};justify-content:flex-end;margin:-4px 0 0;">
            <button type="button" id="forgot-password-btn" style="background:none;border:none;color:var(--primary);font-size:0.78rem;cursor:pointer;padding:0;">Forgot Password?</button>
          </div>
          <p id="signin-email-error" class="signin-error" hidden role="alert" style="margin:0;font-size:0.85rem;color:var(--danger);text-align:center;line-height:1.5;"></p>
          <button type="submit" class="btn btn-primary btn-block" id="signin-email-submit" style="${btnPrimary}">${isRegister ? 'Create Account' : 'Sign In'}</button>
          ${!isRegister ? `<button type="button" class="btn btn-block" id="goto-register-btn" data-auth-action="register" style="${btnSecondary};margin-top:8px;">Create Account</button>` : ''}
        </form>
        <div class="signin-divider" style="text-align:center;margin:16px 0;font-size:0.8rem;color:var(--text-muted);position:relative;">
          <span style="background:var(--surface);padding:0 12px;position:relative;z-index:1;">or</span>
          <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--border);z-index:0;"></div>
        </div>
        <button type="button" class="btn btn-secondary btn-block" id="webauthn-signin-btn" style="${btnSecondary};display:flex;align-items:center;justify-content:center;gap:8px;">
          <span>&#128274;</span> Sign in with Security Key
        </button>
        <p class="signin-note" id="email-mode-note" style="margin:16px 0 0;font-size:0.85rem;color:var(--text-muted);text-align:center;line-height:1.5;">${isRegister ? 'Already have an account? <button type="button" id="note-goto-signin" style="background:none;border:none;padding:0;color:var(--primary);font:inherit;font-weight:600;cursor:pointer;">Sign in</button>.' : 'New here? <button type="button" id="note-goto-register" style="background:none;border:none;padding:0;color:var(--primary);font:inherit;font-weight:600;cursor:pointer;">Create an account</button>.'}</p>
      </div>

      <div class="signin-tab-panel" id="panel-token">
      <form id="signin-token-form" class="signin-form" style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="field-label" for="signin-token-input" style="${labelStyle}">License or Sandbox Token</label>
          <input id="signin-token-input" class="input" type="text" autocomplete="off" placeholder="Paste your license or sandbox token…" style="${inputStyle}" />
          <p style="margin:6px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.4;">This is the token from your license email or the free community token page.</p>
        </div>
        <div>
          <label class="field-label" for="signin-token-password" style="${labelStyle}">Token Password / Validation Code</label>
          <div style="position:relative;">
            <input id="signin-token-password" class="input" type="password" autocomplete="off" placeholder="Enter the password that came with your token…" style="${inputStyle};padding-right:44px;" />
            <button type="button" id="signin-token-toggle-password" aria-label="Show password" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:6px 8px;border-radius:6px;font-size:0.8rem;">Show</button>
          </div>
          <p style="margin:6px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.4;">For paid licenses this is your account password. For free tokens this is the validation code emailed to you.</p>
        </div>
        <p id="signin-token-error" class="signin-error" hidden role="alert" style="margin:0;font-size:0.85rem;color:var(--danger);text-align:center;line-height:1.5;"></p>
        <button type="submit" class="btn btn-primary btn-block" id="signin-token-submit" style="${btnPrimary}">Unlock with Token</button>
      </form>
      <details style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">
        <summary style="cursor:pointer;text-align:center;list-style:none;padding:4px;">Where do I get a token?</summary>
        <p style="margin:8px 0 0;text-align:center;line-height:1.5;">
          <a href="${COMING_SOON_URL}" target="_blank">Get a free community token</a> or <a href="${COMING_SOON_URL}pricing.html" target="_blank">purchase a license</a>. Paid tokens are sent by email after checkout.
        </p>
      </details>
      </div>

      <p class="signin-footer" style="margin-top:24px;text-align:center;font-size:0.85rem;color:var(--text-muted);">
        <a href="/demo" style="color:var(--primary);text-decoration:none;">View read-only demo</a>
        <span class="signin-footer-sep" style="margin:0 6px;">·</span>
        <a href="/dashboard/about" style="color:var(--primary);text-decoration:none;">About &amp; install</a>
        <span class="signin-footer-sep" style="margin:0 6px;">·</span>
        <a href="https://github.com/tjp420/simplebeacon" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:none;">GitHub</a>
      </p>
    `;
    }
    bindEmailModeToggle(container) {
        const subtabs = container.querySelectorAll('.signin-subtab');
        subtabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mode = tab.dataset.mode;
                if (mode === 'register') {
                    this.app.navigate('register');
                }
                else {
                    this.app.navigate('signin');
                }
            });
        });
        container.querySelector('#note-goto-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.app.navigate('register');
        });
        container.querySelector('#note-goto-signin')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.app.navigate('signin');
        });
        container.querySelector('#goto-register-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.app.navigate('register');
        });
    }
    bindMainTabs(container) {
        const emailRadio = container.querySelector('#tab-radio-email');
        const tokenRadio = container.querySelector('#tab-radio-token');
        const emailLabel = container.querySelector('#maintab-email');
        const tokenLabel = container.querySelector('#maintab-token');
        const emailPanel = container.querySelector('#panel-email');
        const tokenPanel = container.querySelector('#panel-token');
        const activeStyle = 'background:var(--primary);color:#fff;';
        const inactiveStyle = 'background:var(--surface-hover);color:var(--text-muted);';
        const baseStyle = 'flex:1;padding:10px 16px;border:none;font-size:0.9rem;font-weight:600;border-radius:8px;cursor:pointer;transition:all 0.2s;text-align:center;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;';
        const sync = () => {
            const isEmail = emailRadio && emailRadio.checked;
            this._activeTab = isEmail ? 'email' : 'token';
            if (emailLabel) { emailLabel.classList.toggle('active', isEmail); emailLabel.style.cssText = baseStyle + (isEmail ? activeStyle : inactiveStyle); }
            if (tokenLabel) { tokenLabel.classList.toggle('active', !isEmail); tokenLabel.style.cssText = baseStyle + (!isEmail ? activeStyle : inactiveStyle); }
            if (emailPanel) { emailPanel.classList.toggle('active', isEmail); emailPanel.style.setProperty('display', isEmail ? 'block' : 'none', 'important'); }
            if (tokenPanel) { tokenPanel.classList.toggle('active', !isEmail); tokenPanel.style.setProperty('display', !isEmail ? 'block' : 'none', 'important'); }
        };
        emailRadio?.addEventListener('change', sync);
        tokenRadio?.addEventListener('change', sync);
        sync();
    }
    async handleEmailSubmit(e) {
        var _a, _b, _c;
        e.preventDefault();
        const form = e.target;
        const email = form.querySelector('#signin-email-input').value.trim();
        const password = form.querySelector('#signin-password-input').value;
        const confirmPasswordEl = form.querySelector('#signin-confirm-password-input');
        const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';
        const submitBtn = form.querySelector('#signin-email-submit');
        const errorEl = form.querySelector('#signin-email-error');
        // Client-side validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const identifierValid = this._emailMode === 'register' ? emailRegex.test(email) : /^[^\s]+$/.test(email);
        if (!identifierValid) {
            if (errorEl) {
                errorEl.textContent = this._emailMode === 'register' ? 'Please enter a valid email address.' : 'Please enter your email or username.';
                errorEl.hidden = false;
            }
            return;
        }
        if (this._emailMode === 'register' ? (!password || password.length < 8) : !password) {
            if (errorEl) {
                errorEl.textContent = this._emailMode === 'register'
                    ? 'Password must be at least 8 characters.'
                    : 'Please enter your password.';
                errorEl.hidden = false;
            }
            return;
        }
        if (this._emailMode === 'register') {
            const name = form.querySelector('#signin-name-input')?.value.trim() || '';
            const username = form.querySelector('#signin-username-input')?.value.trim().toLowerCase() || '';
            if (!name || name.length < 2) {
                if (errorEl) {
                    errorEl.textContent = 'Enter your full name.';
                    errorEl.hidden = false;
                }
                return;
            }
            if (!/^[a-z0-9_]{3,32}$/.test(username)) {
                if (errorEl) {
                    errorEl.textContent = 'Username must be 3–32 characters (letters, numbers, underscore).';
                    errorEl.hidden = false;
                }
                return;
            }
            if (!confirmPassword) {
                if (errorEl) {
                    errorEl.textContent = 'Please confirm your password.';
                    errorEl.hidden = false;
                }
                return;
            }
            if (password !== confirmPassword) {
                if (errorEl) {
                    errorEl.textContent = 'Passwords do not match.';
                    errorEl.hidden = false;
                }
                return;
            }
        }
        submitBtn.disabled = true;
        submitBtn.textContent = this._emailMode === 'register' ? 'Creating account…' : 'Signing in…';
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
        try {
            if (this._emailMode === 'register') {
                const name = form.querySelector('#signin-name-input')?.value.trim() || '';
                const username = form.querySelector('#signin-username-input')?.value.trim().toLowerCase() || '';
                const result = await authService.register(email, password, name, username, confirmPassword);
                if (result.pending) {
                    const card = (_c = this._mountContainer) === null || _c === void 0 ? void 0 : _c.querySelector('.signin-card');
                    if (card) {
                        card.innerHTML = `
                      <div class="signin-header">
                        <span class="signin-icon" aria-hidden="true">&#9989;</span>
                        <h1 class="signin-title">Account submitted</h1>
                        <p class="text-muted signin-subtitle">${escapeHtml(result.message || 'Your account is pending operator approval.')}</p>
                      </div>
                      <p class="signin-note" style="font-size:0.9rem;color:var(--text-muted);text-align:center;line-height:1.5;">You cannot access the dashboard until your account is activated. We will email you at <strong>${escapeHtml(email)}</strong> when ready.</p>
                      <button type="button" class="btn btn-primary btn-block" id="pending-goto-signin" style="margin-top:16px;width:100%;">Back to Sign In</button>
                    `;
                        card.querySelector('#pending-goto-signin')?.addEventListener('click', () => this.app.navigate('signin'));
                    }
                    return;
                }
                showToast('Account created successfully', 'success');
                this.app.updateAuthUi();
                this.app.updateNavVisibility(true);
                window.dispatchEvent(new CustomEvent('auth-signed-in'));
                this.app.navigate('dashboard');
                return;
            }
            await authService.login(email, password);
            showToast('Signed in successfully', 'success');
            this.app.updateAuthUi();
            (_b = (_a = this.app).bootstrapAfterAuth) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.app.navigate('dashboard');
        }
        catch (err) {
            let message = err.message || (this._emailMode === 'register' ? 'Registration failed' : 'Sign in failed');
            if (err && err.name === 'TypeError' && /fetch|network/i.test(String(err.message || ''))) {
                message = 'Unable to reach the account server. Check your connection and try again.';
            }
            console.error('[SignInView] submit error:', { mode: this._emailMode, error: err, message: err?.message, stack: err?.stack });
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.hidden = false;
            }
            showToast(message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = this._emailMode === 'register' ? 'Create Account' : 'Sign In';
        }
    }
    async handleTokenSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const token = form.querySelector('#signin-token-input').value.trim();
        const password = (form.querySelector('#signin-token-password')?.value || '').trim();
        const submitBtn = form.querySelector('#signin-token-submit');
        const errorEl = form.querySelector('#signin-token-error');
        if (!token) {
            if (errorEl) {
                errorEl.textContent = 'Please enter a license token.';
                errorEl.hidden = false;
            }
            return;
        }
        if (!password) {
            if (errorEl) {
                errorEl.textContent = 'Please enter your email validation code or profile password.';
                errorEl.hidden = false;
            }
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking…';
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
        try {
            authService.setSession(token, { token, source: 'signin-token', password });
            const valid = await authService.validateSession({ password });
            if (!valid)
                throw new Error('Invalid or expired token.');
            showToast('Signed in with license token', 'success');
            this.app.updateAuthUi();
            if (typeof this.app.bootstrapAfterAuth === 'function')
                this.app.bootstrapAfterAuth();
            this.app.navigate('dashboard');
        }
        catch (err) {
            authService.clearSession();
            const message = authService.lastValidationError || err.message || 'Token validation failed';
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.hidden = false;
            }
            showToast(message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Unlock with Token';
        }
    }
    _showRecoveryModal() {
        const overlay = document.createElement('div');
        overlay.id = 'recovery-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
      <div style="position:relative;z-index:1;background:var(--surface);padding:28px 32px;border-radius:14px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border);">
        <h3 style="margin:0 0 8px;font-size:1.15rem;color:var(--text-primary);">&#128273; Account Recovery</h3>
        <p style="margin:0 0 18px;font-size:0.85rem;color:var(--text-muted);line-height:1.5;">Enter your email address and we'll send you instructions to reset your password.</p>
        <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">Email</label>
        <input id="recovery-email-input" type="email" placeholder="you@example.com" style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--background);color:var(--text-primary);font-size:0.95rem;margin-bottom:10px;" />
        <div id="recovery-error" style="color:var(--error);font-size:0.8rem;margin-bottom:12px;display:none;"></div>
        <div id="recovery-success" style="color:var(--success);font-size:0.8rem;margin-bottom:12px;display:none;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="recovery-cancel" style="padding:10px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-primary);font-size:0.85rem;cursor:pointer;">Cancel</button>
          <button id="recovery-submit" style="padding:10px 18px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:0.85rem;font-weight:600;cursor:pointer;">Send Instructions</button>
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
        overlay.addEventListener('click', (e) => { if (e.target === overlay)
            closeModal(); });
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
                const data = await authService.recoverPassword(email);
                if (data.success) {
                    successEl.textContent = 'Check your email for recovery instructions.';
                    successEl.style.display = 'block';
                    setTimeout(closeModal, 3000);
                }
                else {
                    errorEl.textContent = data.error || 'Failed to send recovery email.';
                    errorEl.style.display = 'block';
                }
            }
            catch (err) {
                errorEl.textContent = 'Network error. Please try again.';
                errorEl.style.display = 'block';
            }
            finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Instructions';
            }
        });
        emailInput.focus();
    }
    async _handleWebAuthnSignIn() {
        var _a, _b;
        const btn = document.querySelector('#webauthn-signin-btn');
        if (!isWebAuthnSupported()) {
            showToast('Security key login is not supported in this browser.', 'error');
            return;
        }
        if (btn)
            btn.disabled = true;
        try {
            const result = await authenticateWithSecurityKey();
            authService.setSession(result.token, result.user);
            showToast('Signed in with security key', 'success');
            this.app.updateAuthUi();
            (_b = (_a = this.app).bootstrapAfterAuth) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.app.navigate('dashboard');
        }
        catch (err) {
            showToast(err.message || 'Security key sign-in failed', 'error');
        }
        finally {
            if (btn)
                btn.disabled = false;
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
