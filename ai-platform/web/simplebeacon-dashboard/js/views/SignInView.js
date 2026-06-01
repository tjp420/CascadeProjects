import { authService } from '../services/authService.js';
import { billingService } from '../services/billingService.js';
import { showToast } from '../utils.js';

export class SignInView {
  constructor(app) {
    this.app = app;
  }

  async mount(container) {
    container.innerHTML = `<div class="signin-page"><div class="signin-card card"><p class="text-muted">Loading…</p></div></div>`;

    const authed = authService.isAuthenticated();
    const email = authService.getUser()?.email || '';
    let entitlement = { allowed: false, plan: {}, status: {} };

    if (authed && email) {
      entitlement = await billingService.resolveEntitlement(email);
      this.app.state.billingPlan = entitlement.plan;
      this.app.state.billingStatus = entitlement.status;
    }

    const { allowed, plan } = entitlement;
    const internalDev = Boolean(plan?.internalDashboard);

    container.innerHTML = `
      <div class="signin-page">
        <div class="signin-card card">
          <div class="signin-header">
            <span class="signin-icon" aria-hidden="true">🛡️</span>
            <h1 class="signin-title">Optional dashboard sign-in</h1>
            <p class="text-muted">The CLI is free and needs no account. Sign in only if this host requires auth for the local dashboard preview.</p>
          </div>
          ${authed ? this.renderAuthed({ email, allowed, internalDev }) : this.renderSignInForm()}
        </div>
      </div>
    `;

    if (!authed) {
      container.querySelector('#signin-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  renderAuthed({ email, allowed, internalDev }) {
    if (allowed && internalDev) {
      return `
        <p class="signin-status">Signed in as <strong>${email}</strong> (internal preview — not public Cloud Teams).</p>
        <div class="signin-actions">
          <a class="btn btn-primary" href="#/dashboard">Open dashboard (dev)</a>
          <a class="btn btn-ghost" href="/demo">Back to demo</a>
        </div>
      `;
    }
    if (allowed) {
      return `
        <p class="signin-status">Signed in as <strong>${email}</strong>.</p>
        <div class="signin-actions">
          <a class="btn btn-primary" href="#/dashboard">Open dashboard</a>
          <a class="btn btn-secondary" href="#/about">About the CLI</a>
        </div>
      `;
    }
    return `
      <p class="signin-status">Signed in as <strong>${email}</strong>.</p>
      <p class="signin-note">Use the free CLI locally — no hosted subscription required.</p>
      <div class="signin-actions">
        <a class="btn btn-primary" href="#/about">Install CLI</a>
        <a class="btn btn-ghost" href="#/dashboard">Try dashboard</a>
      </div>
    `;
  }

  renderSignInForm() {
    return `
      <form id="signin-form" class="signin-form">
        <label class="field-label" for="signin-email">Email</label>
        <input id="signin-email" class="input" type="email" autocomplete="username" required placeholder="dev@simplebeacon.ai" />
        <label class="field-label" for="signin-password">Password</label>
        <input id="signin-password" class="input" type="password" autocomplete="current-password" required placeholder="demo123" />
        <p id="signin-error" class="text-danger" hidden role="alert"></p>
        <button type="submit" class="btn btn-primary btn-block" id="signin-submit">Sign in</button>
      </form>
      <p class="signin-footer">
        <a href="/demo">← View read-only demo</a>
        ·
        <a href="#/about">About & install</a>
        ·
        <a href="https://github.com/tjp420/simplebeacon" target="_blank" rel="noopener noreferrer">GitHub</a>
      </p>
    `;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('#signin-email').value.trim();
    const password = form.querySelector('#signin-password').value;
    const submitBtn = form.querySelector('#signin-submit');
    const errorEl = form.querySelector('#signin-error');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    try {
      await authService.login(email, password);
      billingService.setEmail(email);
      const entitlement = await billingService.resolveEntitlement(email);
      this.app.state.billingPlan = entitlement.plan;
      this.app.state.billingStatus = entitlement.status;
      this.app.updateAuthUi();
      showToast(`Signed in as ${email}`, 'success');
      if (entitlement.allowed) {
        this.app.bootstrapAfterAuth();
        this.app.navigate('dashboard');
      } else if (authService.authRequired) {
        const hint = 'Local dev: restart with npm run dashboard:v1-internal (sets internalDashboard + auth).';
        showToast(`Signed in, but Cloud Teams is required here. ${hint}`, 'info');
        if (errorEl) {
          errorEl.textContent = `Login succeeded, but this host requires Cloud Teams. ${hint}`;
          errorEl.hidden = false;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      } else {
        showToast('Open the About page for CLI install — no subscription required', 'info');
        this.app.router.init();
        this.app.navigate('about');
      }
    } catch (err) {
      const message = err.message || 'Login failed';
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
      showToast(message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  }

  destroy() {}
}
