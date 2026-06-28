import { scanService } from './services/scanService.js?v=20260525jsonguard1';
import { platformService } from './services/platformService.js?v=20260525jsonguard1';
import { billingService } from './services/billingService.js?v=20260525jsonfixbilling1';
import { authService } from './services/authService.js?v=20260626authfix1';
import { themeService } from './services/themeService.js';
import { Router, PUBLIC_VIEWS } from './router.js';
import { TrustView } from './views/TrustView.js?v=20260525statictrust2';
import { RepositoryHealthView } from './views/RepositoryHealthView.js?v=20260525mergepreview1';
import { DashboardView } from './views/DashboardView.js?v=20260613noloading';
import { ResultsView } from './views/ResultsView.js';
import { SettingsView } from './views/SettingsView.js?v=20260525aikeysguard1';
import { ToolsView } from './views/ToolsView.js';
import { PlatformView } from './views/PlatformView.js?v=20260601platformmetrics1';
import { QualityView } from './views/QualityView.js';
import { HelpView, FeaturesView } from './views/HelpView.js';
import { AuditView } from './views/AuditView.js?v=20260618renderfix1';
import { AnalyzeView } from './views/AnalyzeView.js?v=20260628dragfix1';
import { SecurityView } from './views/SecurityView.js?v=20260611fixexport1';
import { PricingView } from './views/PricingView.js';
import { AboutView } from './views/AboutView.js';
import { AssessmentView } from './views/AssessmentView.js';
import { SignInView } from './views/SignInView.js?v=20260609token3';
import { ChatbotView } from './views/ChatbotView.js';
import { UploadView } from './views/UploadView.js';
import { RemediationRoadmapView } from './views/RemediationRoadmapView.js';
import { ProfileView } from './views/ProfileView.js';
import { COMING_SOON_URL } from './config.js';
import { shouldShowOnboarding, renderOnboarding, bindOnboarding } from './components/Onboarding.js';
import { showUpgradeModal } from './components/UpgradeModal.js';
import { showLoginModal } from './components/LoginModal.js?v=20260609token4';
import { isDemoMode, isSignedOffMode, isLocalDevHost, demoReadOnlyMessage } from './demoMode.js';
import { showToast } from './utils.js';
import { fetchAnalyzeProviders } from './services/analyzeService.js';

/**
 * Vault unlock url.
 * @param {string} returnPath
 * @returns {any}
 */
function vaultUnlockUrl(returnPath = '/app') {
  const returnTo = encodeURIComponent(returnPath);
  if (isLocalDevHost()) {
    // Use server-injected vault password from environment variable
    // Server should inject window.SIMPLEBEACON_VAULT_PASSWORD from process.env.VAULT_PASSWORD
    const vaultPassword = window.SIMPLEBEACON_VAULT_PASSWORD || '';
    if (!vaultPassword) {
      console.warn('Vault password not configured. Set VAULT_PASSWORD environment variable on the server.');
      return `/private-dashboard-vault?returnTo=${returnTo}`;
    }
    return `/private-dashboard-vault?password=${encodeURIComponent(vaultPassword)}&returnTo=${returnTo}`;
  }
  return `/private-dashboard-vault?returnTo=${returnTo}`;
}

const CLOUD_TEAMS_VIEWS = new Set([
  'dashboard', 'audit', 'results', 'analyze', 'security', 'tools', 'platform', 'quality', 'settings', 'assessments'
]);

/**
 * Requires auth gate.
 * @returns {any}
 */
function requiresAuthGate() {
  return isSignedOffMode() || authService.authRequired;
}

/**
 * Is local self hosted.
 * @returns {any}
 */
function isLocalSelfHosted() {
  return isLocalDevHost() || Boolean(billingService.plan?.internalDashboard);
}

/**
 * Handle subscription gate.
 * @returns {any}
 */
function handleSubscriptionGate() {
  if (isLocalSelfHosted() || requiresAuthGate()) {
    if (!authService.isAuthenticated()) {
      this.navigate('signin');
    } else {
      showToast(
        'Local dev: restart with npm run dashboard:v1-internal (sets internal dashboard bypass).',
        'info'
      );
    }
    return;
  }
  showUpgradeModal({ onDismiss: (action) => {
    if (action === 'signin' || isLocalSelfHosted()) {
      this.navigate('signin');
    } else {
      this.navigate('pricing');
    }
  } });
}

/**
 * Simplebeacon dashboard.
 */
class SimplebeaconDashboard {
  constructor() {
    this.scanService = scanService;
    this.platformService = platformService;
    this.state = {
      report: null,
      baseline: null,
      config: null,
      history: [],
      scanning: false,
      routeParams: {},
      dashboardHome: null,
      devTools: null,
      devWorkflows: null,
      coverage: null,
      security: null,
      quality: null,
      help: null,
      audit: null,
      npmAudit: null,
      analyzeResult: null,
      lastProjectPath: '',
      defaultProjectPath: '',
      mergerReductionScan: null,
      reAttestation: null,
      dataLoading: false,
      billingPlan: null,
      billingStatus: null
    };

    this.views = {
      dashboard: new DashboardView(this),
      audit: new AuditView(this),
      assessments: new AssessmentView(this),
      analyze: new AnalyzeView(this),
      results: new ResultsView(this),
      security: new SecurityView(this),
      tools: new ToolsView(this),
      platform: new PlatformView(this),
      quality: new QualityView(this),
      help: new HelpView(this),
      features: new FeaturesView(this),
      settings: new SettingsView(this),
      pricing: new PricingView(this),
      about: new AboutView(this),
      trust: new TrustView(this),
      'repository-health': new RepositoryHealthView(this),
      signin: new SignInView(this),
      chatbot: new ChatbotView(this),
      upload: new UploadView(this),
      remediation: new RemediationRoadmapView(this),
      profile: new ProfileView(this)
    };

    this.currentView = null;
    this.router = new Router((view, params) => this.onRoute(view, params));
    this._refreshScheduled = false;
    this._bgScanPollTimer = null;
    this._bgScanPollStart = 0;
    this._lastKnownScanId = null;
    this._currentViewName = 'dashboard';
  }

  async init() {
    themeService.init();
    this.setupShell();
    this.setupKeyboard();
    this.setupMobileNav();
    this.cleanupDisabledElements();
    this.updateAuthUi();

    // simplebeacon-ignore memory-leak — single application-wide listener on the app singleton
    window.addEventListener('auth-signed-out', () => {
      this.updateAuthUi();
      this.updateNavVisibility(false);
      window.location.hash = '#/signin';
    });

    if (isDemoMode()) {
      document.title = 'SimpleBeacon Demo — Honey-pot Gate';
      this.showDemoBanner();
      this.bootstrapAfterAuth();
      return;
    }

    const vaultReady = await this.ensureVaultSession();
    if (!vaultReady) {
      this.router.init();
      this.updateAuthUi();
      return;
    }

    await authService.ensureAuthenticated();
    this.bootstrapAfterAuth();
  }

  showDemoBanner() {
    if (document.getElementById('demo-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.className = 'demo-banner';
    const span = document.createElement('span');
    // simplebeacon-ignore innerhtml-usage — static demo banner markup
    span.innerHTML = '<strong>Demo</strong> — read-only honey-pot fixture (gate FAIL). Not your workspace.';
    const a = document.createElement('a');
    a.className = 'demo-banner-link';
    a.href = 'https://simplebeacon.pages.dev/pricing';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'View pricing →';
    bar.appendChild(span);
    bar.appendChild(a);
    document.body.prepend(bar);
  }

  showReadOnlyBanner() {
    if (document.getElementById('readonly-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'readonly-banner';
    bar.className = 'demo-banner';
    bar.style.background = 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))';
    bar.style.borderBottom = '1px solid rgba(99,102,241,0.3)';
    const span = document.createElement('span');
    // simplebeacon-ignore innerhtml-usage — static demo banner markup
    span.innerHTML = '<strong>Demo Mode</strong> — You are viewing with a free token. Reports are read-only. Upgrade to unlock scans, exports, and full dashboard interaction.';
    const a = document.createElement('a');
    a.className = 'demo-banner-link';
    a.href = 'pricing.html';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'View pricing →';
    bar.appendChild(span);
    bar.appendChild(a);
    document.body.prepend(bar);
  }

  showVaultBanner() {
    if (document.getElementById('vault-banner')) return;
    const returnPath = `${window.location.pathname}${window.location.hash || '#/dashboard'}`;
    const bar = document.createElement('div');
    bar.id = 'vault-banner';
    bar.className = 'demo-banner';
    const span = document.createElement('span');
    // simplebeacon-ignore innerhtml-usage — static vault banner markup
    span.innerHTML = '<strong>Vault locked</strong> — unlock the internal dashboard before scan/API calls work.';
    const a = document.createElement('a');
    a.className = 'demo-banner-link';
    a.href = vaultUnlockUrl(returnPath);
    a.textContent = 'Unlock vault →';
    bar.appendChild(span);
    bar.appendChild(a);
    document.body.prepend(bar);
  }

  showTokenPrompt() {
    if (document.getElementById('token-prompt-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'token-prompt-modal';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '300';
    // simplebeacon-ignore innerhtml-usage — static modal template, no user input
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-labelledby="token-prompt-title" style="max-width:420px;">
        <div class="modal-header" style="text-align:center;">
          <h2 id="token-prompt-title" style="font-size:1.25rem;margin-bottom:var(--space-1);">🔐 Unlock Dashboard</h2>
          <p class="text-muted" style="font-size:var(--font-size-sm);">Sign in with your email or enter a license token.</p>
        </div>
        <div class="modal-body" style="margin-top:var(--space-4);">
          <div class="signin-tabs" style="margin-bottom:var(--space-4);">
            <button type="button" class="signin-tab active" data-tab="email" id="prompt-tab-email">Email &amp; Password</button>
            <button type="button" class="signin-tab" data-tab="token" id="prompt-tab-token">License Token</button>
          </div>

          <div class="signin-tab-panel active" id="prompt-panel-email">
            <form id="token-email-form">
              <label class="field-label" for="token-email-input">Email</label>
              <input id="token-email-input" class="input" type="email" autocomplete="email" required placeholder="email@example.com" style="margin-bottom:var(--space-2);" />
              <label class="field-label" for="token-password-input">Password</label>
              <input id="token-password-input" class="input" type="password" autocomplete="current-password" required placeholder="••••••••" style="margin-bottom:var(--space-3);" />
              <p id="token-email-error" class="text-danger" hidden role="alert" style="font-size:var(--font-size-sm);margin-bottom:var(--space-2);"></p>
              <button type="submit" class="btn btn-primary btn-block" id="token-email-submit">Sign in with email</button>
            </form>
          </div>

          <div class="signin-tab-panel" id="prompt-panel-token">
            <form id="token-prompt-form">
              <label class="field-label" for="token-prompt-input">License Token</label>
              <input id="token-prompt-input" class="input" type="text" autocomplete="off" required
                placeholder="sb-pro-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" style="margin-bottom:var(--space-2);" />
              <label class="field-label" for="token-prompt-password">Password (optional)</label>
              <input id="token-prompt-password" class="input" type="password" autocomplete="off" placeholder="Enter your token password…" style="margin-bottom:var(--space-3);" />
              <p id="token-prompt-error" class="text-danger" hidden role="alert" style="font-size:var(--font-size-sm);margin-top:var(--space-2);"></p>
              <button type="submit" class="btn btn-primary btn-block" id="token-prompt-submit">Unlock with token</button>
            </form>
            <details style="margin-top:var(--space-3);">
              <summary style="font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;text-align:center;">Need a token?</summary>
              <p class="text-muted" style="font-size:var(--font-size-xs);text-align:center;margin-top:var(--space-2);">
                <a href="${COMING_SOON_URL}" target="_blank">Get a free community token</a> or <a href="${COMING_SOON_URL}pricing.html" target="_blank">purchase a license</a>.
              </p>
            </details>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Tab switching
    const tabs = overlay.querySelectorAll('.signin-tab');
    const panels = {
      email: overlay.querySelector('#prompt-panel-email'),
      token: overlay.querySelector('#prompt-panel-token')
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === key));
        Object.entries(panels).forEach(([k, el]) => {
          if (el) el.classList.toggle('active', k === key);
        });
      });
    });

    const tokenForm = overlay.querySelector('#token-prompt-form');
    const tokenSubmitBtn = overlay.querySelector('#token-prompt-submit');
    const tokenErrorEl = overlay.querySelector('#token-prompt-error');

    tokenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = overlay.querySelector('#token-prompt-input').value.trim();
      const password = overlay.querySelector('#token-prompt-password')?.value || '';
      tokenSubmitBtn.disabled = true;
      tokenSubmitBtn.textContent = 'Validating…';
      if (tokenErrorEl) { tokenErrorEl.hidden = true; tokenErrorEl.textContent = ''; }

      if (authService.isTokenActivated(token)) {
        const emailTab = overlay.querySelector('#prompt-tab-email');
        const tokenTab = overlay.querySelector('#prompt-tab-token');
        const emailPanel = overlay.querySelector('#prompt-panel-email');
        const tokenPanel = overlay.querySelector('#prompt-panel-token');
        if (emailTab) emailTab.classList.add('active');
        if (tokenTab) tokenTab.classList.remove('active');
        if (emailPanel) emailPanel.classList.add('active');
        if (tokenPanel) tokenPanel.classList.remove('active');

        const emailErrorEl = overlay.querySelector('#token-email-error');
        if (emailErrorEl) {
          const binding = authService.getTokenBinding(token);
          const emailHint = binding?.email ? ` (${binding.email})` : '';
          emailErrorEl.textContent = `This token is registered to an account${emailHint}. Please sign in with your email and password.`;
          emailErrorEl.hidden = false;
          if (binding?.email) {
            const emailInput = overlay.querySelector('#token-email-input');
            if (emailInput) emailInput.value = binding.email;
          }
        }
        tokenSubmitBtn.disabled = false;
        tokenSubmitBtn.textContent = 'Unlock with token';
        return;
      }

      try {
        authService.setSession(token, { token, source: 'modal', password });
        const valid = await authService.validateSession(password ? { password } : undefined);
        if (!valid) throw new Error('Invalid or expired token. Check your license token and try again.');
        overlay.remove();
        showToast('Dashboard unlocked', 'success');
        this.updateNavVisibility(true);
        this.bootstrapAfterAuth();
      } catch (err) {
        authService.clearSession();
        const message = err.message || 'Token validation failed';
        if (tokenErrorEl) { tokenErrorEl.textContent = message; tokenErrorEl.hidden = false; }
        showToast(message, 'error');
        tokenSubmitBtn.disabled = false;
        tokenSubmitBtn.textContent = 'Unlock with token';
      }
    });

    const emailForm = overlay.querySelector('#token-email-form');
    const emailSubmitBtn = overlay.querySelector('#token-email-submit');
    const emailErrorEl = overlay.querySelector('#token-email-error');
    if (emailForm) {
      emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = overlay.querySelector('#token-email-input').value.trim();
        const password = overlay.querySelector('#token-password-input').value;
        emailSubmitBtn.disabled = true;
        emailSubmitBtn.textContent = 'Signing in…';
        if (emailErrorEl) { emailErrorEl.hidden = true; emailErrorEl.textContent = ''; }
        try {
          await authService.login(email, password);
          overlay.remove();
          showToast('Signed in successfully', 'success');
          this.updateAuthUi();
          this.bootstrapAfterAuth();
        } catch (err) {
          const message = err.message || 'Sign in failed';
          if (emailErrorEl) { emailErrorEl.textContent = message; emailErrorEl.hidden = false; }
          showToast(message, 'error');
          emailSubmitBtn.disabled = false;
          emailSubmitBtn.textContent = 'Sign in with email';
        }
      });
    }
  }

  showLockScreen(view) {
    const main = document.getElementById('app-main');
    if (!main) return;

    const titles = {
      dashboard: 'Dashboard',
      analyze: 'Analyze',
      results: 'Results',
      'repository-health': 'Repository Health',
      audit: 'Audit',
      security: 'Security',
      quality: 'Quality',
      trust: 'Trust',
      assessments: 'Assessments',
      remediation: 'Remediation',
      platform: 'Platform',
      tools: 'Tools',
      chatbot: 'Chatbot'
    };
    const title = titles[view] || view;

    // simplebeacon-ignore innerhtml-usage — static lock screen template, no user input
    main.innerHTML = `
      <div class="lock-screen" style="display:flex;align-items:center;justify-content:center;min-height:60vh;padding:var(--space-8);">
        <div class="lock-screen-content" style="text-align:center;max-width:420px;">
          <div style="font-size:3rem;margin-bottom:var(--space-4);">🔒</div>
          <h2 style="font-size:1.5rem;margin-bottom:var(--space-2);">${title} is locked</h2>
          <p class="text-muted" style="margin-bottom:var(--space-5);">Sign in to access this page.</p>

          <div class="lock-tabs" style="display:flex;gap:0;margin-bottom:var(--space-4);border-bottom:1px solid var(--border);">
            <button type="button" class="lock-tab active" data-tab="email" style="flex:1;padding:10px 12px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-muted);font-size:0.85rem;font-weight:500;cursor:pointer;">Email</button>
            <button type="button" class="lock-tab" data-tab="token" style="flex:1;padding:10px 12px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-muted);font-size:0.85rem;font-weight:500;cursor:pointer;">License Token</button>
          </div>

          <div id="lock-panel-email" class="lock-panel" style="text-align:left;">
            <form id="lock-email-form">
              <label class="field-label" for="lock-email">Email</label>
              <input id="lock-email" class="input" type="email" autocomplete="email" required placeholder="email@example.com" style="margin-bottom:var(--space-2);" />
              <label class="field-label" for="lock-password">Password</label>
              <input id="lock-password" class="input" type="password" autocomplete="current-password" required placeholder="••••••••" style="margin-bottom:var(--space-3);" />
              <p id="lock-email-error" class="text-danger" hidden role="alert" style="font-size:var(--font-size-sm);margin-bottom:var(--space-2);"></p>
              <button type="submit" class="btn btn-primary btn-block" id="lock-email-submit">Sign in with email</button>
            </form>
          </div>

          <div id="lock-panel-token" class="lock-panel" style="display:none;text-align:left;">
            <form id="lock-token-form">
              <label class="field-label" for="lock-token">License Token</label>
              <input id="lock-token" class="input" type="text" autocomplete="off" required placeholder="sb-pro-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" style="margin-bottom:var(--space-2);" />
              <label class="field-label" for="lock-token-password">Password</label>
              <input id="lock-token-password" class="input" type="password" autocomplete="off" placeholder="Assign or enter a password for this token…" style="margin-bottom:var(--space-3);" />
              <p id="lock-token-error" class="text-danger" hidden role="alert" style="font-size:var(--font-size-sm);margin-bottom:var(--space-2);"></p>
              <button type="submit" class="btn btn-primary btn-block" id="lock-token-submit">Unlock with token</button>
            </form>
            <details style="margin-top:var(--space-3);">
              <summary style="font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;text-align:center;">Need a token?</summary>
              <p class="text-muted" style="font-size:var(--font-size-xs);text-align:center;margin-top:var(--space-2);">
                <a href="${COMING_SOON_URL}" target="_blank">Get a free community token</a> or <a href="${COMING_SOON_URL}pricing.html" target="_blank">purchase a license</a>. No email required.
              </p>
            </details>
          </div>

          <p style="margin-top:var(--space-4);"><a href="/dashboard/dashboard" class="btn btn-secondary btn-block" onclick="document.getElementById('token-prompt-modal')?.remove();window.location.hash='#/dashboard';return false;">&#8592; Return to Dashboard</a></p>
        </div>
      </div>
    `;

    // Tab switching
    const tabs = main.querySelectorAll('.lock-tab');
    const panels = {
      email: main.querySelector('#lock-panel-email'),
      token: main.querySelector('#lock-panel-token')
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.tab;
        tabs.forEach((t) => {
          t.classList.toggle('active', t.dataset.tab === key);
          t.style.borderBottomColor = t.dataset.tab === key ? 'var(--primary)' : 'transparent';
          t.style.color = t.dataset.tab === key ? 'var(--text-primary)' : 'var(--text-muted)';
        });
        Object.entries(panels).forEach(([k, el]) => {
          if (el) el.style.display = k === key ? '' : 'none';
        });
      });
    });
    // Set initial active tab styling
    const activeTab = main.querySelector('.lock-tab.active');
    if (activeTab) {
      activeTab.style.borderBottomColor = 'var(--primary)';
      activeTab.style.color = 'var(--text-primary)';
    }

    // Token form
    const tokenForm = main.querySelector('#lock-token-form');
    if (tokenForm) {
      tokenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = main.querySelector('#lock-token').value.trim();
        const password = main.querySelector('#lock-token-password')?.value || '';
        const submitBtn = main.querySelector('#lock-token-submit');
        const errorEl = main.querySelector('#lock-token-error');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validating…';
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
        if (authService.isTokenActivated(token)) {
          const tabs = main.querySelectorAll('.lock-tab');
          const emailPanel = main.querySelector('#lock-panel-email');
          const tokenPanel = main.querySelector('#lock-panel-token');
          tabs.forEach((t) => {
            t.classList.toggle('active', t.dataset.tab === 'email');
            t.style.borderBottomColor = t.dataset.tab === 'email' ? 'var(--primary)' : 'transparent';
            t.style.color = t.dataset.tab === 'email' ? 'var(--text-primary)' : 'var(--text-muted)';
          });
          if (emailPanel) emailPanel.style.display = '';
          if (tokenPanel) tokenPanel.style.display = 'none';

          const emailErrorEl = main.querySelector('#lock-email-error');
          if (emailErrorEl) {
            const binding = authService.getTokenBinding(token);
            const emailHint = binding?.email ? ` (${binding.email})` : '';
            emailErrorEl.textContent = `This token is registered to an account${emailHint}. Please sign in with your email and password.`;
            emailErrorEl.hidden = false;
            if (binding?.email) {
              const emailInput = main.querySelector('#lock-email');
              if (emailInput) emailInput.value = binding.email;
            }
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Unlock with token';
          return;
        }

        try {
          authService.setSession(token, { token, source: 'lock-screen', password });
          const valid = await authService.validateSession(password ? { password } : undefined);
          if (!valid) throw new Error('Invalid or expired token.');
          showToast('Dashboard unlocked', 'success');
          this.updateAuthUi();
          this.bootstrapAfterAuth();
          this.router.navigate(view);
        } catch (err) {
          authService.clearSession();
          const message = err.message || 'Token validation failed';
          if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
          showToast(message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Unlock with token';
        }
      });
    }

    // Email form
    const emailForm = main.querySelector('#lock-email-form');
    if (emailForm) {
      emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = main.querySelector('#lock-email').value.trim();
        const password = main.querySelector('#lock-password').value;
        const submitBtn = main.querySelector('#lock-email-submit');
        const errorEl = main.querySelector('#lock-email-error');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
        try {
          await authService.login(email, password);
          showToast('Signed in successfully', 'success');
          this.updateAuthUi();
          this.bootstrapAfterAuth();
          this.router.navigate(view);
        } catch (err) {
          const message = err.message || 'Sign in failed';
          if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
          showToast(message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign in with email';
        }
      });
    }
  }

  updateNavVisibility(authed) {
    // Nav links are always visible; route gating in onRoute() shows lock screen
    // for protected views when not authenticated. This keeps the menu visible
    // after sign-out so users know what features exist.
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      const view = link.dataset.view;
      if (view === 'settings') return;
      link.style.display = '';
    });
    document.querySelectorAll('.nav-group-toggle').forEach((toggle) => {
      toggle.style.display = '';
      const itemsContainer = toggle.closest('.nav-group')?.querySelector('.nav-group-items');
      if (itemsContainer) itemsContainer.style.display = '';
    });
  }

  async ensureVaultSession() {
    if (isDemoMode() || !isLocalSelfHosted()) return true;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.error === 'vault_required') {
        this.showVaultBanner();
        return false;
      }
      document.getElementById('vault-banner')?.remove();
      return true;
    } catch {
      return true;
    }
  }

  bootstrapAfterAuth() {
    this.updateAuthUi();
    this.router.init();

    const readOnlyPreview = isDemoMode();

    this.updateNavVisibility(authService.isAuthenticated());
    this.loadDataInBackground().then(() => {
      this.startBackgroundScanWatcher();
    });
    if (!readOnlyPreview) {
      this.loadPlatformData();
      this.loadBillingContext();
    }
    if (!readOnlyPreview) {
      this.maybeShowOnboarding();
    }
  }

  updateAuthUi() {
    this.state.user = authService.getUser() || {};
    const authed = authService.isAuthenticated();
    const signinBtn = document.getElementById('signin-btn');
    const signoutBtn = document.getElementById('signout-btn');
    if (signinBtn) signinBtn.hidden = authed;
    if (signoutBtn) signoutBtn.hidden = !authed;
    const sidebarSigninBtn = document.getElementById('sidebar-signin-btn');
    if (sidebarSigninBtn) sidebarSigninBtn.hidden = authed;
    const pricingLink = document.getElementById('header-pricing-link');
    if (pricingLink) pricingLink.hidden = authed;

    const token = authService.getToken();
    const sandboxBanner = document.getElementById('sandbox-banner');
    if (sandboxBanner) {
/**
 * Is sandbox.
 * @param {any} (
 * @returns {any}
 */
      const isSandbox = (() => {
        if (!token) return false;
        try {
          const payload = token.split('.')[1];
          if (!payload) return false;
          const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
          const data = JSON.parse(json);
          const tier = data.tier || data.plan || '';
          return tier === 'sandbox' || tier === 'developer';
        } catch {
          return false;
        }
      })();
      sandboxBanner.hidden = !isSandbox;
    }
  }

  async loadBillingContext() {
    try {
      const email = authService.getUser()?.email || billingService.getEmail();
      if (email) billingService.setEmail(email);
      const entitlement = email
        ? await billingService.resolveEntitlement(email)
        : { plan: await billingService.fetchPlan(), status: { subscriptionActive: false }, allowed: false };
      this.state.billingPlan = entitlement.plan;
      this.state.billingStatus = entitlement.status;
      this.state.entitlements = entitlement.status;
      await this.handleCheckoutReturn();
    } catch (err) {
      console.warn('Billing context unavailable:', err.message);
    }
  }

  async handleCheckoutReturn() {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(query);
    if (params.get('success') === 'true' && params.get('session_id')) {
      try {
        await billingService.confirmSession(params.get('session_id'));
        this.state.billingStatus = billingService.status;
        showToast('Subscription active — welcome to SimpleBeacon Cloud Teams', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  }

  async loadDataInBackground() {
    const now = Date.now();
    if (this._lastLoadDataTime && now - this._lastLoadDataTime < 2000) {
      return;
    }
    this._lastLoadDataTime = now;
    if (this.state.scanning) {
      try {
        await this.loadData();
      } catch (err) {
        if (err.code === 'vault_required') {
          this.showVaultBanner();
          showToast('Unlock the internal vault, then sign in and retry.', 'info');
        } else if (err.code === 'subscription_required') {
          handleSubscriptionGate.call(this);
        } else if (err.code === 'auth_required') {
          showLoginModal({ onSuccess: () => this.loadDataInBackground() });
        } else {
          showToast(`Scan data unavailable: ${err.message}`, 'error');
        }
      }
      return;
    }
    this.state.dataLoading = true;
    this.refreshCurrentView();
    const safetyTimer = setTimeout(() => {
      if (this.state.dataLoading) {
        console.warn('[Dashboard] loadDataInBackground safety timeout — forcing dataLoading=false');
        this.state.dataLoading = false;
        this.refreshCurrentView();
      }
    }, 10000);
    try {
      await this.loadData();
      if (this._currentViewName === 'dashboard') {
        this.startBackgroundScanWatcher();
      }
    } catch (err) {
      if (err.code === 'vault_required') {
        this.showVaultBanner();
        showToast('Unlock the internal vault, then sign in and retry.', 'info');
      } else if (err.code === 'subscription_required') {
        handleSubscriptionGate.call(this);
      } else if (err.code === 'auth_required') {
        showLoginModal({ onSuccess: () => this.loadDataInBackground() });
      } else {
        showToast(`Scan data unavailable: ${err.message}`, 'error');
      }
    } finally {
      clearTimeout(safetyTimer);
      this.state.dataLoading = false;
      this.refreshCurrentView();
    }
  }

  setupShell() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      themeService.toggle();
    });

    document.getElementById('signin-btn')?.addEventListener('click', () => {
      this.router.navigate('signin');
    });

    document.getElementById('signout-btn')?.addEventListener('click', async () => {
      try {
        await authService.logout();
        showToast('Signed out', 'info');
        this.updateAuthUi();
        this.router.navigate('signin');
      } catch (err) {
        showToast('Sign out failed', 'error');
      }
    });

    document.getElementById('sidebar-signin-btn')?.addEventListener('click', () => {
      this.router.navigate('signin');
    });

    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          this.navigate(link.dataset.view);
          this.closeMobileNav();
        } catch (navErr) {
          console.error('Sidebar navigate error:', navErr);
        }
      });
    });

    const appNav = document.getElementById('app-nav');
    appNav?.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link[data-view]');
      if (!link) return;
      e.preventDefault();
      try {
        this.navigate(link.dataset.view);
        this.closeMobileNav();
      } catch (navErr) {
        console.error('Sidebar delegation navigate error:', navErr);
      }
    });

    const searchInput = document.getElementById('global-search');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        this.navigate('results', { q: searchInput.value.trim() });
      }
    });
  }

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if (mod && e.key === 'r') {
        e.preventDefault();
        this.runScan();
      }
      if (mod && e.key === 'e') {
        e.preventDefault();
        if (isDemoMode()) {
          this.scanService.exportDashboard({
            report: this.state.report,
            baseline: this.state.baseline,
            config: this.state.config,
            history: this.state.history,
            dashboardHome: this.state.dashboardHome
          });
        } else {
          this.scanService.exportReport();
        }
      }
      if (e.key === 'Escape') {
        if (document.getElementById('token-prompt-modal')) return;
        document.getElementById('onboarding-modal')?.remove();
        this.closeMobileNav();
      }
    });
  }

  setupMobileNav() {
    const toggle = document.getElementById('mobile-nav-toggle');
    const nav = document.getElementById('app-nav');
    const overlay = document.getElementById('mobile-nav-overlay');

    toggle?.addEventListener('click', () => {
      nav?.classList.toggle('open');
      overlay?.classList.toggle('open');
    });
    overlay?.addEventListener('click', () => this.closeMobileNav());
  }

  closeMobileNav() {
    document.getElementById('app-nav')?.classList.remove('open');
    document.getElementById('mobile-nav-overlay')?.classList.remove('open');
  }

  cleanupDisabledElements() {
    const selectors = [
      '.nav-link[data-view="outreach"]',
      'a.nav-link[href="/dashboard/outreach"]',
      '.analyze-issue-analyzer-card',
      '.analyze-engines-reference',
      '.analyze-deliverable-table-wrap',
      '.analyze-deliverable-picker'
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.remove();
      });
    });
  }

  async loadData() {
    // Defensive: clear lastProjectPath if it points to a known-invalid nested path
    const badPathPattern = /ai-platform\/CascadeProjects$|google-earthenterprise/i;
    if (badPathPattern.test(this.state.lastProjectPath)) {
      this.state.lastProjectPath = '';
    }
    let data = { report: null, baseline: null, config: null, history: null };
    try {
      data = await this.scanService.fetchAll(this.state.lastProjectPath || null);
    } catch {
      // Path-specific report failed — try default platform report
      try {
        data = await this.scanService.fetchAll();
      } catch {
        // Silent fallback — try local saved scan below
      }
    }

    // No saved scan fallback — stale /data/ files removed

    // Load re-attestation metadata if available
    let reAttestation = null;
    try {
      const res = await fetch('data/re-attestation-metadata.json', { cache: 'no-store' });
      if (res.ok) {
        reAttestation = await res.json();
      }
    } catch {
      // No re-attestation metadata available
    }

    Object.assign(this.state, {
      report: data.report ?? (this.state.scanning ? this.state.report : null),
      baseline: data.baseline ?? this.state.baseline,
      config: data.config ?? this.state.config,
      history: data.history ?? this.state.history,
      reAttestation
    });
    await this.ensureDefaultProjectPath();
  }

  async ensureDefaultProjectPath() {
    if (this.state.defaultProjectPath) return;
    try {
      const info = await fetchAnalyzeProviders();
      if (info.defaultProjectPath) {
        this.state.defaultProjectPath = info.defaultProjectPath;
      }
    } catch {
      /* optional — Analyze page loads this too */
    }
  }

  async loadPlatformData() {
    await this.platformService.fetchAll();
    Object.assign(this.state, {
      dashboardHome: this.platformService.dashboardHome,
      devTools: this.platformService.devTools,
      devWorkflows: this.platformService.devWorkflows,
      coverage: this.platformService.coverage,
      security: this.platformService.security,
      quality: this.platformService.quality,
      help: this.platformService.help
    });
    this.refreshCurrentView();
  }

  navigate(view, params = {}) {
    this.router.navigate(view, params);
  }

  onRoute(view, params) {
    this._currentViewName = view;
    this.state.routeParams = params;
    const main = document.getElementById('app-main');
    if (!main) return;

    // Prevent stale loading state from persisting across navigation
    if (this.currentView && this.state.dataLoading) {
      this.state.dataLoading = false;
    }

    const readOnlyPreview = isDemoMode();
    if (!readOnlyPreview && !PUBLIC_VIEWS.has(view) && !authService.isAuthenticated()) {
      this.showLockScreen(view);
      return;
    }

    // Free tier gets read-only dashboard access (view reports, no interaction)
    const isFreeTier = authService.isFreeTier();
    this.state.readOnly = isFreeTier;
    if (isFreeTier) {
      this.showReadOnlyBanner();
    } else {
      document.getElementById('readonly-banner')?.remove();
    }

    if (!readOnlyPreview && CLOUD_TEAMS_VIEWS.has(view) && authService.isAuthenticated()) {
      const plan = this.state.billingPlan || billingService.plan;
      const status = this.state.billingStatus || billingService.status;
      if (plan || status) {
        const allowed = billingService.hasCloudTeamsAccess(plan, status);
        if (!allowed && !isFreeTier) {
          if (isLocalSelfHosted() || requiresAuthGate()) {
            showToast('Sign in with a local account or use npm run dashboard:v1-internal', 'info');
            window.location.hash = '#/signin';
          } else {
            showToast('Use the free CLI — see About for install', 'info');
            window.location.hash = '#/about';
          }
          return;
        }
      }
    }

    if (this.currentView?.destroy) {
      try {
        this.currentView.destroy();
      } catch (destroyErr) {
        console.error('View destroy error:', destroyErr);
      }
    }

    const viewInstance = this.views[view];
    if (viewInstance) {
      this.currentView = viewInstance;
      viewInstance.mount(main);
    }

    if (view === 'dashboard') {
      this.startBackgroundScanWatcher();
    } else {
      this.stopBackgroundScanWatcher();
    }
  }

  async runScan(projectPath) {
    if (this.state.scanning) return;
    if (this.state.readOnly) {
      showToast('Scanning requires a paid license. View pricing to upgrade.', 'info');
      return;
    }
    if (isDemoMode()) {
      showToast(demoReadOnlyMessage(), 'info');
      return;
    }
    const resolvedPath = String(projectPath || this.state.lastProjectPath || this.state.defaultProjectPath || '').trim() || undefined;
    this.state.scanning = true;
    this.refreshCurrentView();
    showToast('Running SimpleBeacon scan…', 'info');

    try {
      await this.scanService.runScan(resolvedPath, { fullDirectoryScan: true });
      if (resolvedPath) {
        this.state.lastProjectPath = resolvedPath;
      }
      Object.assign(this.state, {
        report: this.scanService.report,
        baseline: this.scanService.baseline,
        config: this.scanService.config,
        history: this.scanService.history,
        scanning: false,
        audit: null
      });
      this.views.audit?.invalidateCache?.();
      showToast('Scan complete', 'success');

      // If inside VS Code webview, update sidebar with scan stats
      const report = this.scanService.report;
      if (report && typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
        try {
          const vscode = window.acquireVsCodeApi();
          const allIssues = report.rawIssues || report.detectedIssues || [];
          const sevCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
          for (const issue of allIssues) {
            const band = String(issue.severity || 'low').toLowerCase();
            if (sevCounts[band] !== undefined) sevCounts[band]++;
          }
          vscode.postMessage({
            command: 'updateStats',
            issues: allIssues.length,
            critical: sevCounts.critical,
            high: sevCounts.high,
            medium: sevCounts.medium,
            low: sevCounts.low,
            score: report.gate?.score ?? report.qualityScore ?? 0
          });
        } catch (err) {
          console.warn('[VSCodeBridge] Failed to post scan stats:', err);
        }
      }
    } catch (err) {
      this.state.scanning = false;
      showToast(err.message, 'error');
    }

    this.refreshCurrentView();
    this.startBackgroundScanWatcher();
  }

  refreshCurrentView() {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      const main = document.getElementById('app-main');
      if (!this.currentView || !main) return;
      // Surgical update on dashboard to avoid flicker.
      // If a report already exists and we had one before, refresh the scan slot in-place
      // instead of re-rendering the entire view (which would flash the
      // loading spinner when dataLoading is toggled in loadDataInBackground).
      // If the report just arrived (transition from no-report), do a full mount
      // so the dashboard switches from empty state to the full report view.
      const hadReport = this._hadReport;
      this._hadReport = Boolean(this.state.report);
      if (this._currentViewName === 'dashboard' && this.state.report && hadReport) {
        this.views.dashboard?.refreshScanStatus?.();
        return;
      }
      this.currentView.mount(main);
    });
  }

  stopBackgroundScanWatcher() {
    if (this._bgScanPollTimer) {
      clearInterval(this._bgScanPollTimer);
      this._bgScanPollTimer = null;
    }
    this._bgScanPollStart = 0;
    this._bgScanPollInProgress = false;
  }

  startBackgroundScanWatcher() {
    this.stopBackgroundScanWatcher();
    const currentScanId = this.state.report?.scanId || this.state.report?.generatedAt || null;
    this._lastKnownScanId = currentScanId;
    this._bgScanPollStart = Date.now();

    const poll = async () => {
      if (this._bgScanPollInProgress) return;
      this._bgScanPollInProgress = true;
      if (Date.now() - this._bgScanPollStart > 120000) {
        this.stopBackgroundScanWatcher();
        this._bgScanPollInProgress = false;
        return;
      }
      try {
        const report = await this.scanService.fetchReport(this.state.lastProjectPath || null);
        const newScanId = report?.scanId || report?.generatedAt || null;
        if (newScanId && newScanId !== this._lastKnownScanId) {
          this.stopBackgroundScanWatcher();
          await this.loadDataInBackground();
          showToast('New scan results available', 'success');
        }
      } catch {
        // Silently ignore transient fetch errors
      } finally {
        this._bgScanPollInProgress = false;
      }
    };

    this._bgScanPollTimer = setInterval(poll, 5000);
  }

  maybeShowOnboarding() {
    if (!shouldShowOnboarding()) return;
    const overlay = renderOnboarding();
    document.body.appendChild(overlay);
    bindOnboarding(overlay, {
      onStart: () => this.runScan(),
      onDismiss: () => {}
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new SimplebeaconDashboard();
    app.init().catch((err) => {
      console.error(err);
      showToast(err.message || 'Dashboard failed to start', 'error');
    });
  } catch (err) {
    console.error(err);
    const main = document.getElementById('app-main');
    if (main) {
      main.textContent = '';
      const card = document.createElement('div');
      card.className = 'empty-state card';
      const p = document.createElement('p');
      p.textContent = 'Failed to load dashboard: ' + (err.message || String(err));
      card.appendChild(p);
      main.appendChild(card);
    }
  }
});
