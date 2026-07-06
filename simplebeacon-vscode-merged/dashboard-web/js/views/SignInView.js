import { authService } from '../services/authService.js';
import { billingService } from '../services/billingService.js';
import { showToast, apiUrl } from '../utils.js';
import { COMING_SOON_URL } from '../config.js';
import { verifyCheckoutSessionFromUrl } from '../lib/stripe-checkout-verifier.js';

/**
 * Decode email from token.
 * @param {string} token
 * @returns {any}
 */
function decodeEmailFromToken(token) {
  if (!token) return '';
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return data.email || data.sub || data.username || data.preferred_username || data.name || '';
  } catch {
    return '';
  }
}

/**
 * Decode jwt payload.
 * @param {string} token
 * @returns {any}
 */
function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
  try {
    const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    return JSON.parse(atob(base64 + padding));
  } catch {
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
  if (!payload) return false;
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
  if (!payload) return false;
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
    this._telemetryTimer = null;
  }

  _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  _redirectAfterAuth() {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo && returnTo.startsWith('/')) {
      window.location.href = returnTo;
      return;
    }
    if (this.app && typeof this.app.navigate === 'function') {
      this.app.navigate('dashboard');
    }
  }

  _looksLikeJwt(val) {
    if (!val || typeof val !== 'string') return false;
    const parts = val.split('.');
    return parts.length >= 2 && parts.length <= 3 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p) && p.length > 4);
  }

  /**
   * Checks URL parameter tracks for marketing-passed JWT values,
   * updates localStorage matrices, and sanitizes the address bar.
   */
  handleIncomingUrlToken() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const incomingToken = urlParams.get('token');

      if (incomingToken) {
        // 1. Ingest into local SPA workspace state
        localStorage.setItem('sb_license_token', incomingToken);

        // 2. Eradicate credentials instantly from history tracking to prevent leakage
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

        // 3. Fire message bridge across the active acquireVsCodeApi frame if open
        this.syncTokenToExtensionHost(incomingToken);

        if (typeof toastService !== 'undefined') {
          toastService.show('Session initialized via marketing credential handoff.', 'success');
        }

        // 4. Force SPA navigation manager to instantly slide past login screens
        if (this.app && typeof this.app.navigate === 'function') {
          this._redirectAfterAuth();
        }
        return true;
      }
    } catch (err) {
      console.error("SimpleBeacon SPA Token Ingestion Fault:", err);
    }
    return false;
  }

  /**
   * Pushes updated license strings across the frame boundary line
   */
  syncTokenToExtensionHost(token) {
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
    if (vscode && token) {
      vscode.postMessage({
        command: 'storeActiveLicenseToken',
        token: token
      });
    }
  }

  /**
   * Intercepts ?session_id= checkout returns, verifies metadata with the
   * backend, and reconciles the license token into local state.
   */
  async handleIncomingCheckoutSession() {
    try {
      const metadata = await verifyCheckoutSessionFromUrl();
      if (metadata?.licenseToken) {
        if (typeof toastService !== 'undefined') {
          toastService.show('Checkout complete — license token activated.', 'success');
        }
        if (this.app && typeof this.app.navigate === 'function') {
          this._redirectAfterAuth();
        }
        return true;
      }
      if (metadata?.subscription?.subscriptionActive) {
        if (typeof toastService !== 'undefined') {
          toastService.show('Subscription active — redirecting to dashboard.', 'success');
        }
        if (this.app && typeof this.app.navigate === 'function') {
          this._redirectAfterAuth();
        }
        return true;
      }
    } catch (err) {
      console.error('SimpleBeacon checkout session ingestion fault:', err);
    }
    return false;
  }

  async mount(container) {
    container.innerHTML = `<div class="signin-page"><div class="signin-card card"><p class="text-muted">Loading…</p></div></div>`;

    // Phase 1a: intercept Stripe checkout session returns
    if (await this.handleIncomingCheckoutSession()) { return; }

    // Phase 1b: intercept marketing-passed tokens
    if (this.handleIncomingUrlToken()) { return; }

    const authed = authService.isAuthenticated();
    const token = authService.getToken();
    const userEmail = authService.getUser()?.email || decodeEmailFromToken(token);
    const email = userEmail || (token ? 'License key' : '');
    const hasEmail = Boolean(userEmail);
    let entitlement = { allowed: false, plan: {}, status: {} };

    if (authed && hasEmail) {
      entitlement = await billingService.resolveEntitlement(email);
      this.app.state.billingPlan = entitlement.plan;
      this.app.state.billingStatus = entitlement.status;
    }

    const { allowed, plan } = entitlement;
    const internalDev = Boolean(plan?.internalDashboard);

    // If already signed in and allowed, redirect instead of showing "already signed in" card
    if (authed && allowed) {
      this._redirectAfterAuth();
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
      container.querySelector('#signin-email-form')?.addEventListener('submit', (e) => this.handleEmailSubmit(e));
      container.querySelector('#forgot-password-btn')?.addEventListener('click', () => this._showRecoveryModal());
      container.querySelector('#webauthn-signin-btn')?.addEventListener('click', () => this._handleWebAuthnSignIn());
    } else {
      container.querySelector('#signin-signout-btn')?.addEventListener('click', async () => {
        try {
          await authService.logout();
          showToast('Signed out', 'info');
          this._emailMode = 'login';
        } catch (err) {
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
      <p class="signin-note">Your token is valid but may have limited access. Upgrade to a paid tier for full dashboard access.</p>
      <div class="signin-actions">
        <a class="btn btn-primary" href="${COMING_SOON_URL}/pricing.html" target="_blank" rel="noopener">View Pricing</a>
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
          <label class="field-label" id="signin-username-label" for="signin-username-input" style="display:none;">Username</label>
          <input id="signin-username-input" class="input" type="text" autocomplete="username" placeholder="Choose a username…" style="display:none;" pattern="[a-zA-Z0-9_-]{3,}" title="At least 3 characters: letters, numbers, underscores, hyphens" />
          <label class="field-label" for="signin-password-input">Password</label>
          <input id="signin-password-input" class="input" type="password" autocomplete="current-password" required placeholder="Enter your password…" />
          <label class="field-label" id="signin-confirm-label" for="signin-confirm-input" style="display:none;">Confirm Password</label>
          <input id="signin-confirm-input" class="input" type="password" autocomplete="new-password" placeholder="Confirm your password…" style="display:none;" />
          <label class="field-label" id="signin-token-label" for="signin-token-input" style="display:none;">License Token <span style="font-weight:normal;color:var(--text-muted);">(optional)</span></label>
          <input id="signin-token-input" class="input" type="text" autocomplete="off" placeholder="Enter your license token…" style="display:none;" />
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
          <span>🔐</span> Sign in with Security Key
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
    const usernameLabel = container.querySelector('#signin-username-label');
    const usernameInput = container.querySelector('#signin-username-input');
    const confirmLabel = container.querySelector('#signin-confirm-label');
    const confirmInput = container.querySelector('#signin-confirm-input');
    const tokenLabel = container.querySelector('#signin-token-label');
    const tokenInput = container.querySelector('#signin-token-input');
    const forgotBtn = container.querySelector('#forgot-password-btn');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this._emailMode = mode;
        subtabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
        if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
        if (note) note.innerHTML = mode === 'login' ? 'New here? Switch to <strong>Create Account</strong> to register.' : 'Already have an account? Switch to <strong>Sign In</strong>.';
        // Show/hide register-only fields
        const isRegister = mode === 'register';
        if (usernameLabel) usernameLabel.style.display = isRegister ? 'block' : 'none';
        if (usernameInput) { usernameInput.style.display = isRegister ? 'block' : 'none'; usernameInput.required = isRegister; }
        if (confirmLabel) confirmLabel.style.display = isRegister ? 'block' : 'none';
        if (confirmInput) { confirmInput.style.display = isRegister ? 'block' : 'none'; confirmInput.required = isRegister; }
        if (tokenLabel) tokenLabel.style.display = isRegister ? 'block' : 'none';
        if (tokenInput) { tokenInput.style.display = isRegister ? 'block' : 'none'; tokenInput.required = false; }
        if (forgotBtn) forgotBtn.style.display = isRegister ? 'none' : 'block';
      });
    });
  }

  async handleEmailSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const emailOrUsername = form.querySelector('#signin-email-input').value.trim();
    const password = form.querySelector('#signin-password-input').value;
    const submitBtn = form.querySelector('#signin-email-submit');
    const errorEl = form.querySelector('#signin-email-error');

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_-]{3,}$/;
    const isEmail = emailRegex.test(emailOrUsername);
    const isUsername = usernameRegex.test(emailOrUsername);
    if (!emailOrUsername || (!isEmail && !isUsername)) {
      if (errorEl) { errorEl.textContent = 'Please enter a valid email address or username.'; errorEl.hidden = false; }
      return;
    }
    if (!password || password.length < 6) {
      if (errorEl) { errorEl.textContent = 'Password must be at least 6 characters.'; errorEl.hidden = false; }
      return;
    }

    // Registration-specific validation
    let username = '';
    let confirmPassword = '';
    let licenseToken = '';
    if (this._emailMode === 'register') {
      username = form.querySelector('#signin-username-input')?.value?.trim() || '';
      confirmPassword = form.querySelector('#signin-confirm-input')?.value || '';
      if (!emailRegex.test(emailOrUsername)) {
        if (errorEl) { errorEl.textContent = 'A valid email is required for registration.'; errorEl.hidden = false; }
        return;
      }
      if (!username || !usernameRegex.test(username)) {
        if (errorEl) { errorEl.textContent = 'Username must be at least 3 characters (letters, numbers, underscores, hyphens only).'; errorEl.hidden = false; }
        return;
      }
      if (password !== confirmPassword) {
        if (errorEl) { errorEl.textContent = 'Passwords do not match.'; errorEl.hidden = false; }
        return;
      }
      licenseToken = form.querySelector('#signin-token-input')?.value?.trim() || '';
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    try {
      if (this._emailMode === 'register') {
        const regResult = await authService.register(emailOrUsername, password, null, username, confirmPassword, licenseToken);
        showToast('Account created successfully', 'success');
        if (licenseToken) {
          this._showTokenTierModal(licenseToken, regResult);
          return;
        }
      } else {
        await authService.login(emailOrUsername, password);
        showToast('Signed in successfully', 'success');
      }
      this.app.updateAuthUi();
      this.syncTokenToExtensionHost(authService.getToken());
      this.app.bootstrapAfterAuth?.();
      this._redirectAfterAuth();
    } catch (err) {
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

  /**
   * Shows a post-registration modal allowing the user to activate/register
   * their license token for account tier benefits.
   */
  _showTokenTierModal(token, regResult) {
    const overlay = document.createElement('div');
    overlay.id = 'token-tier-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);padding:28px 32px;border-radius:14px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border);">
        <h3 style="margin:0 0 8px;font-size:1.15rem;color:var(--text-main);">🔑 Activate License Token</h3>
        <p style="margin:0 0 18px;font-size:0.85rem;color:var(--text-muted);line-height:1.5;">Your account was created successfully. Activate your license token to unlock tier benefits and premium features.</p>
        <div id="token-tier-status" style="display:none;margin-bottom:14px;padding:10px 12px;border-radius:8px;font-size:0.85rem;"></div>
        <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">License Token</label>
        <input id="token-tier-input" type="text" value="${escapeHtml(token)}" readonly style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:0.95rem;margin-bottom:14px;cursor:not-allowed;opacity:0.8;" />
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="token-tier-skip" style="padding:10px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-main);font-size:0.85rem;cursor:pointer;">Skip for Now</button>
          <button id="token-tier-activate" style="padding:10px 18px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:0.85rem;font-weight:600;cursor:pointer;">Activate Token</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const statusEl = overlay.querySelector('#token-tier-status');
    const skipBtn = overlay.querySelector('#token-tier-skip');
    const activateBtn = overlay.querySelector('#token-tier-activate');
    const closeModal = () => { overlay.remove(); this._redirectAfterAuth(); };

    skipBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    activateBtn.addEventListener('click', async () => {
      statusEl.style.display = 'none';
      activateBtn.disabled = true;
      activateBtn.textContent = 'Activating…';
      try {
        const result = await authService.activateTokenForTier(token);
        if (result?.success) {
          statusEl.textContent = result.message || `Token activated successfully! Tier: ${authService.getTierLabel()}.`;
          statusEl.style.cssText = 'display:block;margin-bottom:14px;padding:10px 12px;border-radius:8px;font-size:0.85rem;background:rgba(34,197,94,0.12);color:var(--success);border:1px solid var(--success);';
          activateBtn.textContent = 'Activated';
          this.app.updateAuthUi();
          this.syncTokenToExtensionHost(authService.getToken());
          setTimeout(closeModal, 1500);
        } else {
          throw new Error(result?.error || 'Token activation failed. The token may be invalid or already in use.');
        }
      } catch (err) {
        statusEl.textContent = err.message || 'Activation failed. Please try again or contact support.';
        statusEl.style.cssText = 'display:block;margin-bottom:14px;padding:10px 12px;border-radius:8px;font-size:0.85rem;background:rgba(239,68,68,0.12);color:var(--error);border:1px solid var(--error);';
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate Token';
      }
    });
  }

  _showRecoveryModal() {
    const overlay = document.createElement('div');
    overlay.id = 'recovery-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);padding:28px 32px;border-radius:14px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border);">
        <h3 style="margin:0 0 8px;font-size:1.15rem;color:var(--text-main);">🔑 Account Recovery</h3>
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
        const res = await fetch(apiUrl('/api/auth/recover'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
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
    if (!window.PublicKeyCredential || !navigator.credentials || typeof navigator.credentials.get !== 'function') {
      showToast('Security key login is not supported in this browser or context. Open the dashboard in Chrome or Edge outside of VS Code:.', 'error');
      return;
    }
    if (!window.isSecureContext) {
      showToast('Security key sign-in requires a secure browser context. Open http://127.0.0.1:' + window.location.port + '/dashboard/signin in an external browser.', 'error');
      return;
    }
    if (window.top !== window.self) {
      showToast('Security key sign-in cannot run inside an embedded iframe. Open the dashboard in an external browser.', 'error');
      return;
    }
    try {
      const challengeRes = await fetch(apiUrl('/api/webauthn/challenge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const challengeData = await challengeRes.json();
      if (!challengeData.success || !challengeData.challenge) {
        throw new Error(challengeData.error || 'Failed to get authentication challenge');
      }

      const publicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0)),
        allowCredentials: [],
        userVerification: 'preferred',
        timeout: 60000
      };

      const credential = await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions });
      if (!credential) {
        showToast('Security key authentication was cancelled.', 'info');
        return;
      }

      const authRes = await fetch(apiUrl('/api/webauthn/authenticate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
            response: {
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
              signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature))),
              userHandle: credential.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle))) : null
            },
            type: credential.type
          }
        })
      });
      const authData = await authRes.json();
      if (authData.success && authData.token) {
        authService.setSession(authData.token, authData.user);
        showToast('Signed in with security key', 'success');
        this.app.updateAuthUi();
        this.app.bootstrapAfterAuth?.();
        this._redirectAfterAuth();
      } else {
        throw new Error(authData.error || 'Security key authentication failed');
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('cancelled') || msg.includes('abort') || msg.includes('not allowed')) {
        showToast('Security key authentication was cancelled.', 'info');
      } else {
        showToast(msg, 'error');
      }
    }
  }

  destroy() {}
}

/**
 * Escape html.
 * @param {string} str
 * @returns {any}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

