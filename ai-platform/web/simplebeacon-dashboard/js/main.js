import { scanService } from './services/scanService.js?v=20260525jsonguard1';
import { platformService } from './services/platformService.js?v=20260525jsonguard1';
import { billingService } from './services/billingService.js?v=20260525jsonfixbilling1';
import { authService } from './services/authService.js?v=20260525jsonguard2';
import { themeService } from './services/themeService.js';
import { Router, PUBLIC_VIEWS } from './router.js';
import { TrustView } from './views/TrustView.js?v=20260525statictrust2';
import { RepositoryHealthView } from './views/RepositoryHealthView.js?v=20260525mergepreview1';
import { DashboardView } from './views/DashboardView.js';
import { ResultsView } from './views/ResultsView.js';
import { SettingsView } from './views/SettingsView.js?v=20260525aikeysguard1';
import { ToolsView } from './views/ToolsView.js';
import { PlatformView } from './views/PlatformView.js?v=20260601platformmetrics1';
import { QualityView } from './views/QualityView.js';
import { HelpView, FeaturesView } from './views/HelpView.js';
import { AuditView } from './views/AuditView.js';
import { AnalyzeView } from './views/AnalyzeView.js?v=20260527copyprompt1';
import { SecurityView } from './views/SecurityView.js?v=20260525security1';
import { PricingView } from './views/PricingView.js';
import { AboutView } from './views/AboutView.js';
import { AssessmentView } from './views/AssessmentView.js';
import { OutreachView } from './views/OutreachView.js?v=20260601outreachv2';
import { SignInView } from './views/SignInView.js';
import { ChatbotView } from './views/ChatbotView.js';
import { shouldShowOnboarding, renderOnboarding, bindOnboarding } from './components/Onboarding.js';
import { showUpgradeModal } from './components/UpgradeModal.js';
import { showLoginModal } from './components/LoginModal.js';
import { isDemoMode, isSignedOffMode, isLocalDevHost, demoReadOnlyMessage } from './demoMode.js';
import { showToast } from './utils.js';
import { fetchAnalyzeProviders } from './services/analyzeService.js';

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

function requiresAuthGate() {
  return isSignedOffMode() || authService.authRequired;
}

function isLocalSelfHosted() {
  return isLocalDevHost() || Boolean(billingService.plan?.internalDashboard);
}

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
      dataLoading: true,
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
      outreach: new OutreachView(this),
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
      chatbot: new ChatbotView(this)
    };

    this.currentView = null;
    this.router = new Router((view, params) => this.onRoute(view, params));
    this._refreshScheduled = false;
  }

  async init() {
    themeService.init();
    this.setupShell();
    this.setupKeyboard();
    this.setupMobileNav();

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

    const authed = await authService.ensureAuthenticated();
    const initialView = this.router.parseHash().view;
    if (!authed && requiresAuthGate() && !PUBLIC_VIEWS.has(initialView)) {
      window.location.hash = '#/signin';
      this.router.init();
      this.updateAuthUi();
      return;
    }

    this.bootstrapAfterAuth();
  }

  showDemoBanner() {
    if (document.getElementById('demo-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.className = 'demo-banner';
    bar.innerHTML = `
      <span><strong>Demo</strong> — read-only honey-pot fixture (gate FAIL). Not your workspace.</span>
      <a class="demo-banner-link" href="https://simplebeacon.pages.dev/pricing" target="_blank" rel="noopener noreferrer">View pricing →</a>
    `;
    document.body.prepend(bar);
  }

  showVaultBanner() {
    if (document.getElementById('vault-banner')) return;
    const returnPath = `${window.location.pathname}${window.location.hash || '#/dashboard'}`;
    const bar = document.createElement('div');
    bar.id = 'vault-banner';
    bar.className = 'demo-banner';
    bar.innerHTML = `
      <span><strong>Vault locked</strong> — unlock the internal dashboard before scan/API calls work.</span>
      <a class="demo-banner-link" href="${vaultUnlockUrl(returnPath)}">Unlock vault →</a>
    `;
    document.body.prepend(bar);
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
    const needsSignIn = requiresAuthGate() && !authService.isAuthenticated();
    const onSignInRoute = window.location.hash.startsWith('#/signin');
    if (!readOnlyPreview && needsSignIn) {
      if (!onSignInRoute) window.location.hash = '#/signin';
      return;
    }

    this.loadDataInBackground();
    if (!readOnlyPreview) {
      this.loadPlatformData();
      this.loadBillingContext();
    }
    if (!readOnlyPreview) {
      this.maybeShowOnboarding();
    }
  }

  updateAuthUi() {
    const btn = document.getElementById('auth-action');
    if (!btn) return;
    if (!requiresAuthGate()) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const user = authService.getUser();
    btn.textContent = user?.email ? `Sign out (${user.email.split('@')[0]})` : 'Sign in';
    btn.onclick = async () => {
      if (authService.isAuthenticated()) {
        await authService.logout();
        this.navigate('signin');
      } else {
        this.navigate('signin');
      }
    };
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
    this.state.dataLoading = true;
    this.refreshCurrentView();
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
    } finally {
      this.state.dataLoading = false;
      this.refreshCurrentView();
    }
  }

  setupShell() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      themeService.toggle();
    });

    document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(link.dataset.view);
        this.closeMobileNav();
      });
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
        this.scanService.exportReport();
      }
      if (e.key === 'Escape') {
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

  async loadData() {
    const data = await this.scanService.fetchAll();
    Object.assign(this.state, {
      report: data.report,
      baseline: data.baseline,
      config: data.config,
      history: data.history
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
    this.state.routeParams = params;
    const main = document.getElementById('app-main');
    if (!main) return;

    const readOnlyPreview = isDemoMode();
    if (!readOnlyPreview && !PUBLIC_VIEWS.has(view) && requiresAuthGate() && !authService.isAuthenticated()) {
      window.location.hash = '#/signin';
      return;
    }

    if (!readOnlyPreview && CLOUD_TEAMS_VIEWS.has(view) && authService.isAuthenticated()) {
      const plan = this.state.billingPlan || billingService.plan;
      const status = this.state.billingStatus || billingService.status;
      if (plan || status) {
        const allowed = billingService.hasCloudTeamsAccess(plan, status);
        if (!allowed) {
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
      this.currentView.destroy();
    }

    const viewInstance = this.views[view];
    if (viewInstance) {
      this.currentView = viewInstance;
      viewInstance.mount(main);
    }
  }

  async runScan(projectPath) {
    if (this.state.scanning) return;
    if (isDemoMode()) {
      showToast(demoReadOnlyMessage(), 'info');
      return;
    }
    const resolvedPath = String(projectPath || this.state.lastProjectPath || '').trim() || undefined;
    this.state.scanning = true;
    this.refreshCurrentView();
    showToast('Running SimpleBeacon scan…', 'info');

    try {
      await this.scanService.runScan(resolvedPath);
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
    } catch (err) {
      this.state.scanning = false;
      showToast(err.message, 'error');
    }

    this.refreshCurrentView();
  }

  refreshCurrentView() {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
      const main = document.getElementById('app-main');
      if (this.currentView && main) {
        this.currentView.mount(main);
      }
    });
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
      main.innerHTML = `<div class="empty-state card"><p>Failed to load dashboard: ${err.message}</p></div>`;
    }
  }
});
