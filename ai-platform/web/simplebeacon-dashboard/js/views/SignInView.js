import { authService } from '../services/authService.js';
import { billingService } from '../services/billingService.js';
import { showToast } from '../utils.js';
import { COMING_SOON_URL } from '../config.js';

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
    return data.email || '';
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
  }

  async mount(container) {
    container.innerHTML = `<div class="signin-page"><div class="signin-card card"><p class="text-muted">Loading…</p></div></div>`;

    const authed = authService.isAuthenticated();
    const email = authService.getUser()?.email || decodeEmailFromToken(authService.getToken()) || '';
    let entitlement = { allowed: false, plan: {}, status: {} };

    if (authed && email) {
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
          .token-bar { display: flex; gap: 10px; align-items: stretch; }
          .token-bar input {
            flex: 1;
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

          .auth-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            display: none; align-items: center; justify-content: center; z-index: 1000;
            backdrop-filter: blur(4px);
          }
          .auth-modal-overlay.active { display: flex; }
          .auth-modal {
            background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
            width: 100%; max-width: 420px; margin: 16px; overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          }
          .auth-modal-header { padding: 20px 24px 0; }
          .auth-modal-header h3 { margin: 0 0 4px; font-size: 1.1rem; }
          .auth-modal-header p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
          .auth-modal-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 24px; margin-top: 16px; }
          .auth-modal-tab {
            flex: 1; padding: 10px 8px; background: transparent; border: none;
            border-bottom: 2px solid transparent; color: var(--text-muted);
            font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 150ms;
          }
          .auth-modal-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
          .auth-modal-body { padding: 20px 24px 24px; }
          .auth-modal-panel { display: none; }
          .auth-modal-panel.active { display: block; }
          .auth-modal-field { margin-bottom: 16px; }
          .auth-modal-field label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
          .auth-modal-field input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-input); color: var(--text-main); font-size: 0.9rem; }
          .auth-modal-field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
          .auth-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
          .auth-modal-actions .btn { flex: 1; }
          .auth-modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; }
        </style>

        <div class="token-bar-wrap">
          <div class="token-bar">
            <input id="signin-token-input" type="text" autocomplete="off" placeholder="Paste your license token here…" />
            <button type="button" class="btn-sandbox" id="try-sandbox-btn">Try Free Sandbox</button>
          </div>
          <p class="token-bar-help">Enter your license token and press Enter to unlock the dashboard.</p>
          <p id="signin-token-error" class="token-error-bar" hidden role="alert"></p>
        </div>

        <!-- Auth Choice Modal -->
        <div class="auth-modal-overlay" id="auth-modal-overlay">
          <div class="auth-modal">
            <div class="auth-modal-header">
              <h3>🔐 Authenticate</h3>
              <p>Choose how you want to sign in to your dashboard.</p>
            </div>
            <div class="auth-modal-tabs">
              <button type="button" class="auth-modal-tab active" data-auth-tab="email">📧 Email + Password</button>
              <button type="button" class="auth-modal-tab" data-auth-tab="token">🔑 Token + Password</button>
            </div>
            <div class="auth-modal-body">
              <!-- Email Panel -->
              <div class="auth-modal-panel active" id="auth-panel-email">
                <form id="auth-email-form">
                  <div class="auth-modal-field">
                    <label for="auth-email-input">Email</label>
                    <input type="email" id="auth-email-input" autocomplete="email" required placeholder="you@example.com" />
                  </div>
                  <div class="auth-modal-field">
                    <label for="auth-email-password">Password</label>
                    <input type="password" id="auth-email-password" autocomplete="current-password" required placeholder="Enter your password…" />
                  </div>
                  <p id="auth-email-error" style="color:var(--error);font-size:0.8rem;margin:0 0 8px;" hidden></p>
                  <div class="auth-modal-actions">
                    <button type="button" class="btn btn-secondary" id="auth-modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Sign In</button>
                  </div>
                </form>
              </div>
              <!-- Token Panel -->
              <div class="auth-modal-panel" id="auth-panel-token">
                <form id="auth-token-form">
                  <div class="auth-modal-field">
                    <label for="auth-token-display">License Token</label>
                    <input type="text" id="auth-token-display" readonly aria-label="License Token" style="background:var(--bg);color:var(--text-muted);" />
                  </div>
                  <div class="auth-modal-field">
                    <label for="auth-token-password">Token Password</label>
                    <input type="password" id="auth-token-password" autocomplete="off" placeholder="Enter token password…" />
                  </div>
                  <p id="auth-token-error" style="color:var(--error);font-size:0.8rem;margin:0 0 8px;" hidden></p>
                  <div class="auth-modal-actions">
                    <button type="button" class="btn btn-secondary" id="auth-modal-cancel-2">Cancel</button>
                    <button type="submit" class="btn btn-primary">Unlock Dashboard</button>
                  </div>
                </form>
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
    const errorEl = container.querySelector('#signin-token-error');
    const overlay = container.querySelector('#auth-modal-overlay');
    const tokenDisplay = container.querySelector('#auth-token-display');

    const showError = (msg) => {
      if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
    };
    const clearError = () => {
      if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
    };
    const closeModal = () => {
      if (overlay) overlay.classList.remove('active');
      container.querySelector('#auth-email-error').hidden = true;
      container.querySelector('#auth-token-error').hidden = true;
    };
    const openModal = (token) => {
      if (tokenDisplay) tokenDisplay.value = token.slice(0, 20) + (token.length > 20 ? '…' : '');
      if (overlay) overlay.classList.add('active');
      // Reset forms
      container.querySelector('#auth-email-form')?.reset();
      container.querySelector('#auth-token-form')?.reset();
      if (tokenDisplay) tokenDisplay.value = token.slice(0, 24) + (token.length > 24 ? '…' : '');
    };

    // Token input: Enter key opens modal
    if (tokenInput) {
      const sandboxBtn = container.querySelector('#try-sandbox-btn');
      tokenInput.addEventListener('input', () => {
        if (sandboxBtn) {
          sandboxBtn.textContent = tokenInput.value.trim() ? 'Sign In' : 'Try Free Sandbox';
        }
      });
      tokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const token = tokenInput.value.trim();
          if (!token) { showError('Please enter a license token.'); return; }
          clearError();
          // Reject free/sandbox tokens
          if (!isPaidToken(token)) {
            showError('Free sandbox tokens are for local testing only. Use Try Free Sandbox or purchase a license.');
            return;
          }
          // Check if token already activated → switch to email tab in modal
          if (authService.isTokenActivated(token)) {
            this._openModalTab(container, 'email');
            const binding = authService.getTokenBinding(token);
            const emailInput = container.querySelector('#auth-email-input');
            if (emailInput && binding?.email) emailInput.value = binding.email;
            const emailError = container.querySelector('#auth-email-error');
            if (emailError) { emailError.textContent = 'This token is registered to an account. Please sign in with your email and password.'; emailError.hidden = false; }
          } else {
            this._openModalTab(container, 'token');
          }
          openModal(token);
        }
      });
    }

    // Modal tab switching
    container.querySelectorAll('.auth-modal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this._openModalTab(container, tab.dataset.authTab);
      });
    });

    // Cancel buttons
    container.querySelector('#auth-modal-cancel')?.addEventListener('click', closeModal);
    container.querySelector('#auth-modal-cancel-2')?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Email form in modal
    container.querySelector('#auth-email-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#auth-email-input').value.trim();
      const password = container.querySelector('#auth-email-password').value;
      const error = container.querySelector('#auth-email-error');
      error.hidden = true;
      try {
        await authService.login(email, password);
        showToast('Signed in successfully', 'success');
        this.app.updateAuthUi();
        this.app.bootstrapAfterAuth?.();
        this.app.navigate('dashboard');
      } catch (err) {
        error.textContent = err.message || 'Sign in failed';
        error.hidden = false;
        showToast(err.message || 'Sign in failed', 'error');
      }
    });

    // Token form in modal
    container.querySelector('#auth-token-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = tokenInput?.value?.trim() || '';
      const password = container.querySelector('#auth-token-password').value;
      const error = container.querySelector('#auth-token-error');
      error.hidden = true;
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
        error.textContent = err.message || 'Token validation failed';
        error.hidden = false;
        showToast(err.message || 'Token validation failed', 'error');
      }
    });
  }

  _openModalTab(container, tabName) {
    container.querySelectorAll('.auth-modal-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.authTab === tabName);
    });
    container.querySelectorAll('.auth-modal-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `auth-panel-${tabName}`);
    });
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
      const response = await fetch('/api/tokens/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' })
      });
      const data = await response.json();
      if (data.success && data.token) {
        authService.setSession(data.token, { token: data.token, tier: 'sandbox', source: 'sandbox' });
        this.app.updateAuthUi();
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

