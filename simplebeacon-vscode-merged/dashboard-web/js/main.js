import { apiUrl } from './utils.js';
import { scanService } from './services/scanService.js?v=20260525jsonguard1';
import { platformService } from './services/platformService.js?v=20260525jsonguard1';
import { billingService } from './services/billingService.js?v=20260525jsonfixbilling1';
import { authService } from './services/authService.js?v=20260626authfix1';
import { themeService } from './services/themeService.js';
import { Router, PUBLIC_VIEWS } from './router.js';
import { TrustView } from './views/TrustView.js?v=20260525statictrust2';
import { RepositoryHealthView } from './views/RepositoryHealthView.js?v=20260525mergepreview1';
import { DashboardView } from './views/DashboardView.js?v=20260626redesign3';
import { ResultsView } from './views/ResultsView.js';
import { SettingsView } from './views/SettingsView.js?v=20260525aikeysguard1';
import { ToolsView } from './views/ToolsView.js';
import { PlatformView } from './views/PlatformView.js?v=20260601platformmetrics1';
import { QualityView } from './views/QualityView.js';
import { HelpView, FeaturesView } from './views/HelpView.js';
import { AuditView } from './views/AuditView.js?v=20260618renderfix1';
import { AnalyzeView } from './views/AnalyzeViewClean.js?v=20260628rebuild1';
import { SecurityView } from './views/SecurityView.js?v=20260611fixexport1';
import { PricingView } from './views/PricingView.js';
import { AboutView } from './views/AboutView.js';
import { AssessmentView } from './views/AssessmentView.js';
import { SignInView } from './views/SignInView.js?v=20260609token3';
import { ChatbotView } from './views/ChatbotView.js';
import { UploadView } from './views/UploadView.js';
import { RemediationRoadmapView } from './views/RemediationRoadmapView.js';
import { ProfileView } from './views/ProfileView.js';
import { CodeMapView } from './views/CodeMapView.js';
import { BillingLandingController } from './controllers/billingLanding.js';
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
      return `/private-dashboard-vault?returnTo=${returnTo}`;
    }
    return `/private-dashboard-vault?password=${encodeURIComponent(vaultPassword)}&returnTo=${returnTo}`;
  }
  return `/private-dashboard-vault?returnTo=${returnTo}`;
}
function setHtml(el, html) {
  // simplebeacon-ignore innerhtml-xss — setHtml uses createContextualFragment for trusted view HTML; untrusted data is escaped before passing
  el.textContent = '';
  if (html) el.appendChild(document.createRange().createContextualFragment(html));
}

const CLOUD_TEAMS_VIEWS = new Set([
  'dashboard', 'audit', 'results', 'analyze', 'security', 'tools', 'platform', 'quality', 'settings', 'assessments'
]);

const DASHBOARD_ROUTED_VIEWS = new Set([
  'dashboard', 'analyze', 'results', 'repository-health',
  'audit', 'security', 'quality', 'trust',
  'assessments', 'remediation', 'platform', 'profile',
  'tools', 'settings', 'help', 'chatbot', 'about', 'code-map'
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
  if (isLocalSelfHosted()) return;
  if (requiresAuthGate()) {
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
    if (action === 'signin') {
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
      profile: new ProfileView(this),
      'code-map': new CodeMapView(this),
      'billing-success': new BillingLandingController(this),
      'billing-cancel': new BillingLandingController(this)
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
    window.addEventListener('message', (event) => {
      if (!event.data) { return; }
      if (event.data.command === 'setTheme') {
        themeService.set(event.data.theme);
      } else if (event.data.command === 'setIdePreview') {
        document.documentElement.setAttribute('data-ide-preview', 'true');
      } else if (event.data.command === 'navigate') {
        if (event.data.url && window.__SB_DASHBOARD_APP__) {
          try {
            const url = new URL(event.data.url);
            let route = url.pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '');
            if (!route && url.hash) {
              route = url.hash.replace(/^#\//, '');
            }
            if (route) {
              window.__SB_DASHBOARD_APP__.navigate(route);
              return;
            }
          } catch (e) {}
        }
        if (event.data.url) { window.location.href = event.data.url; }
      } else if (event.data.command === 'setAnalyzePath') {
        var path = event.data.path || '';
        if (!path) return;
        var pathInput = document.querySelector('#project-path-input');
        if (pathInput) {
          pathInput.value = path;
          pathInput.dispatchEvent(new Event('input', { bubbles: true }));
          var app = window.__SB_DASHBOARD_APP__;
          if (app && app.state) {
            app.state.lastProjectPath = path;
            app.state.pathInputDraft = '';
          }
        }
        var legacyInput = document.getElementById('analyzePathInput');
        if (legacyInput) {
          legacyInput.value = path;
        }
      } else if (event.data.command === 'showLoginModal') {
        if (typeof showLoginModal === 'function') {
          showLoginModal();
        }
      }
    });
    try {
      const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
      if (vscode) {
        vscode.postMessage({command: 'dashReady'});
        vscode.postMessage({command: 'setAuthState', signedIn: authService.isAuthenticated(), tier: authService.getTier()});
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({command: 'dashReady'}, '*');
        window.parent.postMessage({command: 'setAuthState', signedIn: authService.isAuthenticated()}, '*');
      }
    } catch (e) {}
    this.setupShell();
    this.setupKeyboard();
    this.setupMobileNav();
    this.cleanupDisabledElements();
    this.updateAuthUi();

    window.addEventListener('auth-signed-in', () => {
      this.updateAuthUi();
      this.updateNavVisibility(true);
    });

    window.addEventListener('auth-signed-out', () => {
      this.updateAuthUi();
      this.updateNavVisibility(false);
      this.router.navigate('signin');
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
    const strong = document.createElement('strong'); strong.textContent = 'Demo';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' — read-only honey-pot fixture (gate FAIL). Not your workspace.'));
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
    const strong = document.createElement('strong'); strong.textContent = 'Demo Mode';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' — You are viewing with a free token. Reports are read-only. Upgrade to unlock scans, exports, and full dashboard interaction.'));
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
    const returnPath = `${window.location.pathname}${window.location.search}`;
    const bar = document.createElement('div');
    bar.id = 'vault-banner';
    bar.className = 'demo-banner';
    const span = document.createElement('span');
    const strong = document.createElement('strong'); strong.textContent = 'Vault locked';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' — unlock the internal dashboard before scan/API calls work.'));
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
    setHtml(overlay, `
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
    `);
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
    this.router.navigate('signin');
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
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'same-origin' });
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
    const profileBtn = document.getElementById('profile-btn');
    if (signinBtn) signinBtn.hidden = authed;
    if (profileBtn) profileBtn.hidden = !authed;
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
    this.updateProfileDropdownHeader();
  }

  updateProfileDropdownHeader() {
    const header = document.getElementById('profile-dropdown-header');
    if (!header) return;
    const user = authService.getUser() || {};
    const email = user.email || 'Signed in user';
    const tier = user.tier || user.plan || 'Community';
    header.textContent = '';
    const emailEl = document.createElement('strong');
    emailEl.textContent = email;
    const tierEl = document.createElement('span');
    tierEl.textContent = tier;
    header.appendChild(emailEl);
    header.appendChild(tierEl);
  }

  setupProfileDropdown() {
    const profileBtn = document.getElementById('profile-btn');
    const menu = document.getElementById('profile-dropdown-menu');
    const viewItem = document.getElementById('profile-dropdown-view');
    const signoutItem = document.getElementById('profile-dropdown-signout');
    if (!profileBtn || !menu) return;

    const closeMenu = () => {
      menu.classList.add('hidden');
      profileBtn.setAttribute('aria-expanded', 'false');
    };

    const toggleMenu = () => {
      const isOpen = !menu.classList.contains('hidden');
      if (isOpen) {
        closeMenu();
      } else {
        this.updateProfileDropdownHeader();
        menu.classList.remove('hidden');
        profileBtn.setAttribute('aria-expanded', 'true');
      }
    };

    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    viewItem?.addEventListener('click', () => {
      closeMenu();
      this.router.navigate('profile');
    });

    signoutItem?.addEventListener('click', async () => {
      closeMenu();
      try {
        await authService.logout();
        showToast('Signed out', 'info');
      } catch (err) {
        showToast('Sign out failed', 'error');
      }
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== profileBtn && !profileBtn.contains(e.target)) {
        closeMenu();
      }
    });
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
      /* billing context unavailable */
    }
  }

  async handleCheckoutReturn() {
    const search = window.location.search;
    const params = new URLSearchParams(search);
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
        /* safety timeout reached */
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
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({command: 'toggleTheme'}, '*');
        }
      } catch (e) {}
    });

    document.getElementById('signin-btn')?.addEventListener('click', () => {
      if (typeof showLoginModal === 'function') {
        showLoginModal();
      }
    });

    this.setupProfileDropdown();

    document.getElementById('sidebar-signin-btn')?.addEventListener('click', () => {
      if (typeof showLoginModal === 'function') {
        showLoginModal();
      }
    });

    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          this.navigate(link.dataset.view);
          this.closeMobileNav();
        } catch (navErr) {
          /* ignore sidebar navigation errors */
        }
      });
    });

    document.querySelectorAll('.nav-footer-link[data-view]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          this.navigate(link.dataset.view);
          this.closeMobileNav();
        } catch (navErr) {
          /* ignore footer navigation errors */
        }
      });
    });

    document.getElementById('sidebar-export-btn')?.addEventListener('click', () => {
      const report = this.state.report;
      if (!report) {
        showToast('No report to export', 'warning');
        return;
      }
      this.scanService.exportReport(report);
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
        /* ignore sidebar delegation errors */
      }
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/dashboard/"]');
      if (!link) { return; }
      try {
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) { return; }
        e.preventDefault();
        const route = url.pathname.replace(/^\/dashboard\/?/, '').replace(/\/$/, '') || 'dashboard';
        this.navigate(route);
      } catch (navErr) { /* ignore */ }
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
    // Local dev bypass: full functionality on localhost regardless of token tier
    const isFreeTier = authService.isFreeTier();
    const isSandbox = this.state.sandboxMode === true;
    const isLocal = isLocalDevHost();
    this.state.readOnly = !isLocal && (isFreeTier || isSandbox);
    if (!isLocal && (isFreeTier || isSandbox)) {
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
          if (isLocalSelfHosted()) {
            // localhost bypass — do not redirect
          } else if (requiresAuthGate()) {
            showToast('Sign in with a local account or use npm run dashboard:v1-internal', 'info');
            this.router.navigate('signin');
          } else {
            showToast('Use the free CLI — see About for install', 'info');
            this.router.navigate('about');
          }
          return;
        }
      }
    }

    if (this.currentView?.destroy) {
      try {
        this.currentView.destroy();
      } catch (destroyErr) {
        /* ignore view destroy errors */
      }
    }

    const viewInstance = this.views[view];
    if (viewInstance) {
      this.currentView = viewInstance;
      main.innerHTML = '';
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
          /* ignore VS Code: bridge errors */
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
        const updated = this.views.dashboard?.refreshScanStatus?.();
        if (updated) return;
        // Surgical update failed — fall back to full mount
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
    window.__SB_DASHBOARD_APP__ = app;
    app.init().catch((err) => {
      /* ignore errors */
      showToast(err.message || 'Dashboard failed to start', 'error');
    });
  } catch (err) {
    /* ignore startup errors */
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
