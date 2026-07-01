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
    this._activeTab = 'token';
    this._emailMode = 'login';
    this._telemetryTimer = null;
  }

  _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
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
          this.app.navigate('dashboard');
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
          this.app.navigate('dashboard');
        }
        return true;
      }
      if (metadata?.subscription?.subscriptionActive) {
        if (typeof toastService !== 'undefined') {
          toastService.show('Subscription active — redirecting to dashboard.', 'success');
        }
        if (this.app && typeof this.app.navigate === 'function') {
          this.app.navigate('dashboard');
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
      this.bindTabSwitching(container);
      this.bindEmailModeToggle(container);
      container.querySelector('#signin-email-form')?.addEventListener('submit', (e) => this.handleEmailSubmit(e));
      container.querySelector('#try-sandbox-btn')?.addEventListener('click', () => this.handleSandboxToken());
      this.bindTokenBarAndModal(container);
    } else {
      container.querySelector('#signin-signout-btn')?.addEventListener('click', async () => {
        try {
          await authService.logout();
          showToast('Signed out', 'info');
          this.app.updateAuthUi();
          this.mount(container);
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
      <p class="signin-note">Your token is valid but may have limited access.</p>
      <div class="signin-actions">
        <a class="btn btn-primary" href="/dashboard/dashboard">Open Dashboard</a>
        <button class="btn btn-ghost" id="signin-signout-btn">Sign Out</button>
      </div>
    `;
  }

  renderSignInForm() {
    return `
      <div class="signin-tabs">
        <button type="button" class="signin-tab ${this._activeTab === 'token' ? 'active' : ''}" data-tab="token" id="tab-token">License Token</button>
        <button type="button" class="signin-tab ${this._activeTab === 'email' ? 'active' : ''}" data-tab="email" id="tab-email">Email &amp; Password</button>
      </div>

      <div class="signin-tab-panel ${this._activeTab === 'token' ? 'active' : ''}" id="panel-token">
        <style>
          .token-bar-wrap { margin-bottom: var(--space-4); }
          .token-bar { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
          .token-bar input {
            flex: 1 1 200px;
            padding: 12px 18px;
            border: 2px solid var(--border);
            border-radius: 10px;
            background: var(--bg-input);
            color: var(--text-main);
            font-size: 1rem;
            transition: border-color 150ms, box-shadow 150ms;
            min-width: 0;
          }
          .token-bar input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
          .token-bar .btn-sandbox {
            flex: 1 1 120px;
            white-space: nowrap;
            padding: 0 18px;
            border-radius: 10px;
            border: 1.5px solid var(--accent);
            background: transparent;
            color: var(--accent);
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 150ms;
          }
          .token-bar .btn-sandbox:hover { background: var(--primary-subtle); }
          .token-bar-help { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }
          .token-error-bar { color: var(--error); font-size: 0.8rem; margin-top: 8px; }

        </style>

        <style>
          .token-input-wrap { position:relative; flex:1 1 200px; }
          .token-input-wrap input { width:100%; padding:12px 44px 12px 18px; border:2px solid var(--border); border-radius:10px; background:var(--bg-input); color:var(--text-main); font-size:1rem; transition:border-color 150ms, box-shadow 150ms; min-width:0; }
          .token-input-wrap input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
          .token-input-wrap input.token-glow { border-color:rgba(99,102,241,0.5); box-shadow:0 0 0 4px rgba(99,102,241,0.08); }
          .token-eye-btn { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); font-size:1.1rem; cursor:pointer; padding:4px; line-height:1; }
          .token-eye-btn:hover { color:var(--text-main); }
          .token-telemetry { font-size:0.72rem; color:var(--success); margin-top:6px; display:flex; align-items:center; gap:6px; min-height:1.2em; }
          .token-telemetry.hidden { opacity:0; }
          .inline-morph { overflow:hidden; max-height:0; transition:max-height .35s ease, opacity .25s ease; opacity:0; }
          .inline-morph.open { max-height:200px; opacity:1; margin-top:12px; }
          .inline-morph-inner { padding:14px 18px; border:1px solid var(--border); border-radius:10px; background:var(--bg-card); }
          .inline-morph-label { font-size:0.78rem; color:var(--text-muted); margin-bottom:8px; }
          .inline-morph-label strong { color:var(--accent); }
          .inline-morph-actions { display:flex; gap:8px; margin-top:10px; }
          .tier-action-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; align-items:center; }
          .tier-action-link { font-size:0.78rem; color:var(--accent); text-decoration:none; font-weight:600; }
          .tier-action-link:hover { text-decoration:underline; }
          .tier-action-btn { font-size:0.78rem; padding:6px 12px; border-radius:8px; border:1px solid var(--success); background:rgba(16,185,129,0.08); color:var(--success); font-weight:600; cursor:pointer; transition:all .15s; }
          .tier-action-btn:hover { background:rgba(16,185,129,0.15); }
        </style>

        <div class="token-bar-wrap">
          <div class="token-bar">
            <div class="token-input-wrap">
              <input id="signin-token-input" type="password" autocomplete="off" placeholder="Paste your license token here…" />
              <button type="button" class="token-eye-btn" id="token-eye-btn" title="Show token">&#128065;</button>
            </div>
            <button type="button" class="btn-sandbox" id="try-sandbox-btn">Try Free Sandbox</button>
          </div>
          <div class="token-telemetry hidden" id="tokenTelemetry"><span>&#10003;</span> Valid JWT Format Detected</div>
          <p class="token-bar-help">Enter your license token and press Enter to unlock the dashboard.</p>
          <p id="signin-token-error" class="token-error-bar" hidden role="alert"></p>
          <div id="tierActions" class="tier-action-row" style="display:none;"></div>

          <!-- Inline Form Morph Accordion -->
          <div class="inline-morph" id="inlineMorph">
            <div class="inline-morph-inner">
              <div class="inline-morph-label" id="inlineMorphLabel">Enter password to unlock dashboard</div>
              <input id="inline-morph-password" type="password" placeholder="Password…" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);font-size:0.9rem;" />
              <div class="inline-morph-actions">
                <button type="button" class="btn btn-primary" id="inline-morph-unlock">Unlock Dashboard</button>
                <button type="button" class="btn btn-ghost" id="inline-morph-cancel" style="font-size:0.8rem;">Cancel</button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div class="signin-tab-panel ${this._activeTab === 'email' ? 'active' : ''}" id="panel-email">
        <div class="signin-subtabs">
          <button type="button" class="signin-subtab ${this._emailMode === 'login' ? 'active' : ''}" data-mode="login" id="subtab-login">Sign In</button>
          <button type="button" class="signin-subtab ${this._emailMode === 'register' ? 'active' : ''}" data-mode="register" id="subtab-register">Create Account</button>
        </div>
        <form id="signin-email-form" class="signin-form">
          <label class="field-label" for="signin-email-input">Email</label>
          <input id="signin-email-input" class="input" type="email" autocomplete="email" required placeholder="email@example.com" />
          <label class="field-label" for="signin-password-input">Password</label>
          <input id="signin-password-input" class="input" type="password" autocomplete="current-password" required placeholder="Enter your password…" />
          <p id="signin-email-error" class="signin-error" hidden role="alert"></p>
          <button type="submit" class="btn btn-primary btn-block" id="signin-email-submit">${this._emailMode === 'register' ? 'Create Account' : 'Sign In'}</button>
        </form>
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

  bindTabSwitching(container) {
    const tabs = container.querySelectorAll('.signin-tab');
    const panels = container.querySelectorAll('.signin-tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this._activeTab = target;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
        panels.forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
      });
    });
  }

  bindEmailModeToggle(container) {
    const subtabs = container.querySelectorAll('.signin-subtab');
    const submitBtn = container.querySelector('#signin-email-submit');
    const note = container.querySelector('#email-mode-note');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this._emailMode = mode;
        subtabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
        if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
        if (note) note.innerHTML = mode === 'login' ? 'New here? Switch to <strong>Create Account</strong> to register.' : 'Already have an account? Switch to <strong>Sign In</strong>.';
      });
    });
  }

  bindTokenBarAndModal(container) {
    const tokenInput = container.querySelector('#signin-token-input');
    const eyeBtn = container.querySelector('#token-eye-btn');
    const errorEl = container.querySelector('#signin-token-error');
    const telemetryEl = container.querySelector('#tokenTelemetry');
    const tierActionsEl = container.querySelector('#tierActions');
    const inlineMorph = container.querySelector('#inlineMorph');
    const inlineLabel = container.querySelector('#inlineMorphLabel');
    const inlinePassword = container.querySelector('#inline-morph-password');
    const inlineUnlock = container.querySelector('#inline-morph-unlock');
    const inlineCancel = container.querySelector('#inline-morph-cancel');

    const showError = (msg) => {
      if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
    };
    const clearError = () => {
      if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
      if (tierActionsEl) tierActionsEl.style.display = 'none';
    };
    const openMorph = (labelHtml) => {
      if (inlineLabel) inlineLabel.innerHTML = labelHtml;
      if (inlineMorph) inlineMorph.classList.add('open');
      setTimeout(() => inlinePassword?.focus(), 100);
    };
    const closeMorph = () => {
      if (inlineMorph) inlineMorph.classList.remove('open');
      if (inlinePassword) inlinePassword.value = '';
    };

    // Eye toggle for token privacy
    if (eyeBtn && tokenInput) {
      eyeBtn.addEventListener('click', () => {
        const isHidden = tokenInput.type === 'password';
        tokenInput.type = isHidden ? 'text' : 'password';
        eyeBtn.textContent = isHidden ? '🙈' : '👁';
        eyeBtn.title = isHidden ? 'Hide token' : 'Show token';
      });
    }

    // Live telemetry: debounced JWT format detection
    if (tokenInput) {
      const checkTelemetry = this._debounce((val) => {
        if (!telemetryEl) return;
        if (this._looksLikeJwt(val)) {
          telemetryEl.classList.remove('hidden');
          tokenInput.classList.add('token-glow');
        } else {
          telemetryEl.classList.add('hidden');
          tokenInput.classList.remove('token-glow');
        }
      }, 300);
      tokenInput.addEventListener('input', () => {
        checkTelemetry(tokenInput.value.trim());
        // Also update CTA button text
        const sandboxBtn = container.querySelector('#try-sandbox-btn');
        if (sandboxBtn) {
          sandboxBtn.textContent = tokenInput.value.trim() ? 'Sign In' : 'Try Free Sandbox';
        }
      });
    }

    // Token input: Enter key triggers inline morph
    if (tokenInput) {
      tokenInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const token = tokenInput.value.trim();
        if (!token) { showError('Please enter a license token.'); return; }
        clearError();

        // Always prompt for password after token entry
        const profile = JSON.parse(localStorage.getItem('sb_profile') || '{}');
        const storedPassword = profile.tokenPassword || profile.emailPassword || '';
        if (!isPaidToken(token)) {
          showError('Free / sandbox tokens have limited dashboard access.');
          if (tierActionsEl) {
            tierActionsEl.style.display = 'flex';
            tierActionsEl.innerHTML = `
              <button type="button" class="tier-action-btn" id="tier-sandbox-btn">🚀 Deploy in Free Sandbox Mode</button>
              <a href="${COMING_SOON_URL}/pricing.html" target="_blank" rel="noopener" class="tier-action-link">⬆️ Upgrade License Scope</a>
            `;
            tierActionsEl.querySelector('#tier-sandbox-btn')?.addEventListener('click', () => this.handleSandboxToken());
          }
          return;
        }

        // Check if token already activated
        if (authService.isTokenActivated(token)) {
          const binding = authService.getTokenBinding(token);
          const email = binding?.email || decodeEmailFromToken(token) || 'an account';
          openMorph(`🔑 Token bound to <strong>${escapeHtml(email)}</strong>. Enter password to unlock.`);
        } else {
          openMorph('Enter password to unlock dashboard');
        }
      });
    }

    // Inline morph: unlock button
    if (inlineUnlock && tokenInput) {
      inlineUnlock.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        const password = inlinePassword?.value || '';
        if (!password) { showError('Please enter a password.'); return; }
        clearError();

        // Client-side password check against stored profile
        const savedProfile = JSON.parse(localStorage.getItem('sb_profile') || '{}');
        const expectedPassword = savedProfile.tokenPassword || savedProfile.emailPassword || '';
        if (expectedPassword && password !== expectedPassword) {
          showError('Incorrect password. Please try again.');
          showToast('Password mismatch — access denied.', 'error');
          return;
        }

        try {
          authService.setSession(token, { token, source: 'manual', password });
          const valid = await authService.validateSession(password ? { password } : undefined);
          if (!valid) throw new Error('Invalid or expired token.');
          this.app.updateAuthUi();
          showToast('Dashboard unlocked', 'success');
          this.app.bootstrapAfterAuth?.();
          this.app.navigate('dashboard');
        } catch (err) {
          authService.clearSession();
          showError(err.message || 'Token validation failed');
          showToast(err.message || 'Token validation failed', 'error');
        }
      });
    }

    // Inline morph: cancel button
    if (inlineCancel) {
      inlineCancel.addEventListener('click', closeMorph);
    }
  }

  async handleTokenSubmit(e) {
    // Legacy: no-op, replaced by bindTokenBarAndModal
  }

  async handleEmailSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('#signin-email-input').value.trim();
    const password = form.querySelector('#signin-password-input').value;
    const submitBtn = form.querySelector('#signin-email-submit');
    const errorEl = form.querySelector('#signin-email-error');
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
      } else {
        await authService.login(email, password);
        showToast('Signed in successfully', 'success');
      }
      this.app.updateAuthUi();
      this.app.bootstrapAfterAuth?.();
      this.app.navigate('dashboard');
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

  async handleSandboxToken() {
    const btn = document.getElementById('try-sandbox-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      const response = await fetch(apiUrl('/api/tokens/sandbox'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' })
      });
      const data = await response.json();
      if (data.success && data.token) {
        authService.setSession(data.token, { token: data.token, tier: 'sandbox', source: 'sandbox' });
        this.app.updateAuthUi();
        // Explicitly mark sandbox mode so features are limited even on localhost
        this.app.state.readOnly = true;
        this.app.state.sandboxMode = true;
        showToast('Sandbox token active — limited to 100 requests/day', 'info');
        this.app.bootstrapAfterAuth?.();
        this.app.navigate('dashboard');
      } else {
        throw new Error(data.error || 'Could not generate sandbox token');
      }
    } catch (err) {
      const msg = err?.message || String(err);
      showToast(msg, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
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

