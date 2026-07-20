// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { scanService } from './services/scanService.js?v=20260716cachefix1';
import { platformService } from './services/platformService.js?v=20260716cachefix1';
import { billingService } from './services/billingService.js?v=20260716cachefix1';
import { authService, apiBase } from './services/authService.js?v=20260721cspapi';
import { themeService } from './services/themeService.js';
import { Router, PUBLIC_VIEWS } from './router.js?v=20260716cachefix1';
import { TrustView } from './views/TrustView.js?v=20260716cachefix1';
import { RepositoryHealthView } from './views/RepositoryHealthView.js?v=20260716cachefix1';
import { DashboardView } from './views/DashboardView.js?v=20260716cachefix1';
import { ResultsView } from './views/ResultsView.js?v=20260716cachefix1';
import { SettingsView } from './views/SettingsView.js?v=20260716cachefix1';
import { ToolsView } from './views/ToolsView.js';
import { PlatformView } from './views/PlatformView.js?v=20260716cachefix1';
import { QualityView } from './views/QualityView.js?v=20260716cachefix1';
import { HelpView, FeaturesView } from './views/HelpView.js';
import { AuditView } from './views/AuditView.js?v=20260716cachefix1';
import { AnalyzeView } from './views/AnalyzeView.js?v=20260720pages4';
import { SecurityView } from './views/SecurityView.js?v=20260716cachefix1';
import { AboutView } from './views/AboutView.js';
import { AssessmentView } from './views/AssessmentView.js?v=20260716cachefix1';
import { SignInView } from './views/SignInView.js?v=20260720pages4';
import { ChatbotView } from './views/ChatbotView.js?v=20260718ollama1';
import { UploadView } from './views/UploadView.js';
import { RemediationRoadmapView } from './views/RemediationRoadmapView.js';
import { ProfileView } from './views/ProfileView.js?v=20260717chatbot1';
import { AdminPanelView } from './views/AdminPanelView.js?v=20260716cachefix1';
import { GettingStartedView } from './views/GettingStartedView.js?v=20260718onboard1';
import { GuidedTour } from './components/GuidedTour.js?v=20260718onboard1';
import { COMING_SOON_URL } from './config.js';
import { shouldShowOnboarding, renderOnboarding, bindOnboarding } from './components/Onboarding.js?v=20260718onboard1';
import { showUpgradeModal } from './components/UpgradeModal.js';
import { showLoginModal } from './components/LoginModal.js?v=20260716cachefix1';
import { isDemoMode, isSignedOffMode, isLocalDevHost, isHostedDashboard, demoReadOnlyMessage } from './demoMode.js';
import { showToast, resolveDashboardProjectPath } from './utils.js';
import { isEmbeddedDashboardFrame, isIdeDashboardSurface } from './utils-lib/dom.js?v=20260716cachefix1';
import { hasExtensionBridgeConfigured } from './services/localAgentService.js?v=20260716cachefix1';
import { fetchAnalyzeProviders, isClientScanReport, shouldClearHostedServerDefaultPath } from './services/analyzeService.js?v=20260716cachefix1';
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
const CLOUD_TEAMS_VIEWS = new Set([
    'dashboard', 'audit', 'results', 'analyze', 'security', 'tools', 'platform', 'quality', 'settings', 'assessments'
]);
/**
 * Views that trigger scans, mutate settings, or perform billing actions.
 * Read-only views (audit, roadmap, results, trust, security, platform, quality)
 * are intentionally excluded; they only need isAuthenticated()/isFreeTier().
 */
const WRITE_HEAVY_VIEWS = new Set([
    'dashboard', 'analyze', 'upload', 'settings', 'admin', 'chatbot'
]);
/** Protected views that can load in IDE mode via the extension bridge without cloud sign-in. */
const IDE_BRIDGE_ONLY_VIEWS = new Set(['chatbot']);
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
    var _a;
    return isLocalDevHost() || Boolean((_a = billingService.plan) === null || _a === void 0 ? void 0 : _a.internalDashboard);
}
/**
 * Handle subscription gate.
 * @returns {any}
 */
function isAuthEntryView(view) {
    return view === 'signin' || view === 'register';
}
function handleSubscriptionGate() {
    if (isAuthEntryView(this._currentViewName)) {
        return;
    }
    if (isLocalSelfHosted() || requiresAuthGate()) {
        if (!authService.isAuthenticated()) {
            this.navigate('signin');
        }
        else {
            showToast('Local dev: restart with npm run dashboard:v1-internal (sets internal dashboard bypass).', 'info');
        }
        return;
    }
    showUpgradeModal({ onDismiss: (action) => {
            if (isAuthEntryView(this._currentViewName)) {
                return;
            }
            if (action === 'signin' || isLocalSelfHosted()) {
                this.navigate('signin');
            }
            else {
                window.location.href = '/pricing';
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
            pricing: { mount: () => { window.location.href = '/pricing'; } },
            about: new AboutView(this),
            trust: new TrustView(this),
            'repository-health': new RepositoryHealthView(this),
            signin: new SignInView(this),
            register: new SignInView(this),
            chatbot: new ChatbotView(this),
            upload: new UploadView(this),
            remediation: new RemediationRoadmapView(this),
            roadmap: new RemediationRoadmapView(this),
            profile: new ProfileView(this),
            admin: new AdminPanelView(this),
            'getting-started': new GettingStartedView(this)
        };
        this.currentView = null;
        this.guidedTour = new GuidedTour(this);
        this.router = new Router((view, params) => this.onRoute(view, params));
        this._refreshScheduled = false;
        this._bgScanPollTimer = null;
        this._bgScanPollStart = 0;
        this._lastKnownScanId = null;
        this._currentViewName = 'dashboard';
        this._embedQuickNavBar = null;
    }
    isEmbedWebsiteMode() {
        if (isIdeDashboardSurface()) {
            return false;
        }
        if (typeof window !== 'undefined' && window.self !== window.top) {
            return false;
        }
        if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-embed-full-nav')) {
            return true;
        }
        try {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('sb_website_mode') === '1')
                return true;
            return sessionStorage.getItem('sb_website_mode') === '1';
        }
        catch (_a) {
            return false;
        }
    }
    parseInitialView() {
        try {
            const pathname = window.location.pathname || '/dashboard';
            const base = pathname.startsWith('/dashboard') ? '/dashboard' : '';
            let relative = pathname;
            if (base && relative.startsWith(base + '/')) {
                relative = relative.slice(base.length + 1);
            }
            else if (relative === base) {
                relative = '';
            }
            const view = relative.split('/').filter(Boolean)[0] || 'dashboard';
            const known = ['dashboard', 'audit', 'assessments', 'analyze', 'results', 'remediation', 'roadmap',
                'security', 'tools', 'platform', 'quality', 'help', 'features', 'trust', 'repository-health',
                'settings', 'pricing', 'about', 'signin', 'register', 'chatbot', 'upload', 'eu-ai-act', 'profile', 'admin'];
            return known.includes(view) ? view : 'dashboard';
        }
        catch (_a) {
            return 'dashboard';
        }
    }
    _createEmbedQuickNavBar() {
        let bar = document.getElementById('embed-quick-nav');
        if (bar) {
            this._embedQuickNavBar = bar;
            return bar;
        }
        bar = document.createElement('nav');
        bar.id = 'embed-quick-nav';
        bar.className = 'embed-quick-nav';
        bar.setAttribute('aria-label', 'Quick navigation');
        const main = document.getElementById('app-main');
        if (main && main.parentNode) {
            main.parentNode.insertBefore(bar, main);
        }
        const items = [
            ['dashboard', 'Home'],
            ['analyze', 'Analyze'],
            ['results', 'Results'],
            ['audit', 'Audit'],
            ['remediation', 'Roadmap']
        ];
        bar.innerHTML = items.map(([view, label]) => `<button type="button" class="embed-quick-nav-btn" data-view="${view}">${label}</button>`).join('');
        bar.querySelectorAll('[data-view]').forEach((btn) => {
            btn.addEventListener('click', () => {
                try {
                    this.navigate(btn.dataset.view);
                }
                catch (err) {
                    console.error('Embed quick nav error:', err);
                }
            });
        });
        this._embedQuickNavBar = bar;
        return bar;
    }
    setupEmbedQuickNav() {
        if (!isEmbeddedDashboardFrame())
            return;
        document.documentElement.setAttribute('data-embed-mode', '1');
        const initialView = this.parseInitialView();
        this._currentViewName = initialView;
        this.updateAuthPageShell(initialView);
        // IDE surface: extension sidebar owns navigation — content pane only.
        if (isIdeDashboardSurface()) {
            document.documentElement.setAttribute('data-ide-embed', '1');
            document.documentElement.removeAttribute('data-embed-full-nav');
            return;
        }
        if (typeof window !== 'undefined' && window.self !== window.top) {
            document.documentElement.setAttribute('data-ide-embed', '1');
            document.documentElement.removeAttribute('data-embed-full-nav');
            return;
        }
        if (document.documentElement.hasAttribute('data-embed-full-nav')
            || this.isEmbedWebsiteMode()) {
            document.documentElement.setAttribute('data-embed-full-nav', '1');
            return;
        }
        if (initialView === 'signin' || initialView === 'register')
            return;
        this._createEmbedQuickNavBar();
        this.updateEmbedQuickNav(initialView);
    }
    updateAuthPageShell(view) {
        const authPage = view === 'signin' || view === 'register';
        if (authPage) {
            document.documentElement.setAttribute('data-auth-page', '1');
        }
        else {
            document.documentElement.removeAttribute('data-auth-page');
            const main = document.getElementById('app-main');
            if (main) {
                main.style.removeProperty('display');
                main.style.removeProperty('align-items');
                main.style.removeProperty('justify-content');
            }
        }
    }
    resetMainScroll(main) {
        const el = main || document.getElementById('app-main');
        if (!el)
            return;
        el.scrollTop = 0;
        if (typeof window.scrollTo === 'function') {
            window.scrollTo(0, 0);
        }
        if (typeof document !== 'undefined') {
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }
    }
    cleanupOrphanViewRoots(main) {
        const keep = main || document.getElementById('app-main');
        document.querySelectorAll('body > .fade-in, .app-shell > .fade-in, .app-body > .fade-in').forEach((el) => {
            if (keep && (keep === el || keep.contains(el)))
                return;
            el.remove();
        });
    }
    updateEmbedQuickNav(view) {
        if (!isEmbeddedDashboardFrame() || this.isEmbedWebsiteMode())
            return;
        const authPage = view === 'signin' || view === 'register';
        if (authPage) {
            const bar = this._embedQuickNavBar || document.getElementById('embed-quick-nav');
            if (bar) {
                bar.remove();
                this._embedQuickNavBar = null;
            }
            return;
        }
        if (!this._embedQuickNavBar)
            this._createEmbedQuickNavBar();
        this._embedQuickNavBar.hidden = false;
        this._embedQuickNavBar.querySelectorAll('[data-view]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }
    async init() {
        // Remove any stale full-page drag overlay that may have leaked from a previous session.
        document.querySelectorAll('.sb-global-drag-overlay').forEach(el => el.remove());
        try {
            const { clearStaleIntegratedBridgeParams, validateExtensionBridgeOnLoad } = await import('./services/localAgentService.js?v=20260716cachefix1');
            clearStaleIntegratedBridgeParams();
            if (isHostedDashboard()) {
                await validateExtensionBridgeOnLoad();
            }
        }
        catch (_bridgeInit) { /* non-fatal */ }
        themeService.init();
        this.setupShell();
        this.setupEmbedQuickNav();
        this.showBridgeNotice();
        this.setupKeyboard();
        this.setupMobileNav();
        this.cleanupDisabledElements();
        this.updateAuthUi();
        // simplebeacon-ignore memory-leak — single application-wide listener on the app singleton
        window.addEventListener('auth-signed-in', () => {
            this.updateAuthUi();
            this.updateNavVisibility(true);
        });
        window.addEventListener('auth-signed-out', () => {
            this.updateAuthUi();
            this.updateNavVisibility(false);
            if (this.router) {
                this.router.navigate('signin');
            }
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
        const authed = await authService.ensureAuthenticated();
        if (!authed && authService.authRequired) {
            if (isIdeDashboardSurface()) {
                await this.waitForIdeAuthSync(3000);
                if (authService.isAuthenticated()) {
                    this.bootstrapAfterAuth();
                    return;
                }
            }
            // On the hosted dashboard, data APIs are publicly readable (report, baseline,
            // config, history all return 200 without auth). Bootstrap anyway so the user
            // sees dashboard data — auth is only required for server-side scans.
            if (isHostedDashboard()) {
                this.bootstrapAfterAuth();
                return;
            }
            this.router.init();
            const authEntry = this.parseInitialView();
            if (!isAuthEntryView(authEntry)) {
                this.router.navigate('signin');
            }
            this.updateAuthUi();
            return;
        }
        this.bootstrapAfterAuth();
    }
    showBridgeNotice() {
        if (isIdeDashboardSurface())
            return;
        if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-embed-full-nav'))
            return;
        if (typeof window !== 'undefined' && window.self !== window.top)
            return;
        if (document.documentElement.hasAttribute('data-ide-embed'))
            return;
        if (document.getElementById('bridge-notice-banner'))
            return;
        if (!this._isExtensionBridgeContext())
            return;
        try {
            if (sessionStorage.getItem('sb_bridge_notice_dismissed') === '1')
                return;
        }
        catch (_a) { /* ignore */ }
        const bar = document.createElement('div');
        bar.id = 'bridge-notice-banner';
        bar.className = 'bridge-notice-banner';
        const span = document.createElement('span');
        span.textContent = 'Local extension connection: your browser may ask to let SimpleBeacon access apps on this device. This is only to connect to your VS Code: extension. No source code or credentials are sent.';
        const close = document.createElement('button');
        close.className = 'bridge-notice-close';
        close.setAttribute('aria-label', 'Dismiss');
        close.textContent = '✕';
        close.addEventListener('click', () => {
            bar.remove();
            try {
                sessionStorage.setItem('sb_bridge_notice_dismissed', '1');
            }
            catch (_b) { /* ignore */ }
        });
        bar.appendChild(span);
        bar.appendChild(close);
        document.body.prepend(bar);
    }
    _isExtensionBridgeContext() {
        try {
            const params = new URLSearchParams(window.location.search);
            const keys = ['sb_notify_base', 'sb_api_base', 'sb_parent_urlbar', 'sb_website_mode'];
            for (const key of keys) {
                if (params.get(key) || sessionStorage.getItem(key))
                    return true;
            }
        }
        catch (_a) { /* ignore */ }
        return false;
    }
    showDemoBanner() {
        if (document.getElementById('demo-banner'))
            return;
        const bar = document.createElement('div');
        bar.id = 'demo-banner';
        bar.className = 'demo-banner';
        const span = document.createElement('span');
        // simplebeacon-ignore innerhtml-usage — static demo banner markup
        span.innerHTML = '<strong>Demo</strong> — read-only honey-pot fixture (gate FAIL). Not your workspace.';
        const a = document.createElement('a');
        a.className = 'demo-banner-link';
        a.dataset.pricingCta = '1';
        a.href = '/pricing';
        a.textContent = 'View pricing →';
        bar.appendChild(span);
        bar.appendChild(a);
        document.body.prepend(bar);
        this.bindPricingCta(a);
    }
    showReadOnlyBanner() {
        if (document.getElementById('readonly-banner'))
            return;
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
        a.dataset.pricingCta = '1';
        a.href = '/pricing';
        a.textContent = 'View pricing →';
        bar.appendChild(span);
        bar.appendChild(a);
        document.body.prepend(bar);
        this.bindPricingCta(a);
    }
    showVaultBanner() {
        if (document.getElementById('vault-banner'))
            return;
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
        if (document.getElementById('token-prompt-modal'))
            return;
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
                    if (el)
                        el.classList.toggle('active', k === key);
                });
            });
        });
        const tokenForm = overlay.querySelector('#token-prompt-form');
        const tokenSubmitBtn = overlay.querySelector('#token-prompt-submit');
        const tokenErrorEl = overlay.querySelector('#token-prompt-error');
        tokenForm.addEventListener('submit', async (e) => {
            var _a;
            e.preventDefault();
            const token = overlay.querySelector('#token-prompt-input').value.trim();
            const password = ((_a = overlay.querySelector('#token-prompt-password')) === null || _a === void 0 ? void 0 : _a.value) || '';
            tokenSubmitBtn.disabled = true;
            tokenSubmitBtn.textContent = 'Validating…';
            if (tokenErrorEl) {
                tokenErrorEl.hidden = true;
                tokenErrorEl.textContent = '';
            }
            if (authService.isTokenActivated(token)) {
                const emailTab = overlay.querySelector('#prompt-tab-email');
                const tokenTab = overlay.querySelector('#prompt-tab-token');
                const emailPanel = overlay.querySelector('#prompt-panel-email');
                const tokenPanel = overlay.querySelector('#prompt-panel-token');
                if (emailTab)
                    emailTab.classList.add('active');
                if (tokenTab)
                    tokenTab.classList.remove('active');
                if (emailPanel)
                    emailPanel.classList.add('active');
                if (tokenPanel)
                    tokenPanel.classList.remove('active');
                const emailErrorEl = overlay.querySelector('#token-email-error');
                if (emailErrorEl) {
                    const binding = authService.getTokenBinding(token);
                    const emailHint = (binding === null || binding === void 0 ? void 0 : binding.email) ? ` (${binding.email})` : '';
                    emailErrorEl.textContent = `This token is registered to an account${emailHint}. Please sign in with your email and password.`;
                    emailErrorEl.hidden = false;
                    if (binding === null || binding === void 0 ? void 0 : binding.email) {
                        const emailInput = overlay.querySelector('#token-email-input');
                        if (emailInput)
                            emailInput.value = binding.email;
                    }
                }
                tokenSubmitBtn.disabled = false;
                tokenSubmitBtn.textContent = 'Unlock with token';
                return;
            }
            try {
                authService.setSession(token, { token, source: 'modal', password });
                const valid = await authService.validateSession(password ? { password } : undefined);
                if (!valid)
                    throw new Error('Invalid or expired token. Check your license token and try again.');
                overlay.remove();
                showToast('Dashboard unlocked', 'success');
                this.updateNavVisibility(true);
                this.bootstrapAfterAuth();
            }
            catch (err) {
                authService.clearSession();
                const message = err.message || 'Token validation failed';
                if (tokenErrorEl) {
                    tokenErrorEl.textContent = message;
                    tokenErrorEl.hidden = false;
                }
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
                if (emailErrorEl) {
                    emailErrorEl.hidden = true;
                    emailErrorEl.textContent = '';
                }
                try {
                    await authService.login(email, password);
                    overlay.remove();
                    showToast('Signed in successfully', 'success');
                    this.updateAuthUi();
                    this.bootstrapAfterAuth();
                }
                catch (err) {
                    const message = err.message || 'Sign in failed';
                    if (emailErrorEl) {
                        emailErrorEl.textContent = message;
                        emailErrorEl.hidden = false;
                    }
                    showToast(message, 'error');
                    emailSubmitBtn.disabled = false;
                    emailSubmitBtn.textContent = 'Sign in with email';
                }
            });
        }
    }
    showLockScreen(view, options = {}) {
        if (isIdeDashboardSurface() && !options.force) {
            this.showIdeAuthPending(view);
            return;
        }
        const main = document.getElementById('app-main');
        if (!main)
            return;
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
      <div class="lock-screen" style="display:flex;align-items:center;justify-content:center;padding:var(--space-8);">
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
            <p style="margin-top:var(--space-3);text-align:center;font-size:var(--font-size-sm);">
              New here?
              <button type="button" class="btn btn-ghost btn-sm" id="lock-goto-register" style="padding:0 4px;">Create an account</button>
            </p>
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

          <p style="margin-top:var(--space-4);"><a href="/dashboard/#/dashboard" class="btn btn-secondary btn-block" onclick="document.getElementById('token-prompt-modal')?.remove();window.location.hash='#/dashboard';return false;">&#8592; Return to Dashboard</a></p>
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
                    if (el)
                        el.style.display = k === key ? '' : 'none';
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
                var _a;
                e.preventDefault();
                const token = main.querySelector('#lock-token').value.trim();
                const password = ((_a = main.querySelector('#lock-token-password')) === null || _a === void 0 ? void 0 : _a.value) || '';
                const submitBtn = main.querySelector('#lock-token-submit');
                const errorEl = main.querySelector('#lock-token-error');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Validating…';
                if (errorEl) {
                    errorEl.hidden = true;
                    errorEl.textContent = '';
                }
                if (authService.isTokenActivated(token)) {
                    const tabs = main.querySelectorAll('.lock-tab');
                    const emailPanel = main.querySelector('#lock-panel-email');
                    const tokenPanel = main.querySelector('#lock-panel-token');
                    tabs.forEach((t) => {
                        t.classList.toggle('active', t.dataset.tab === 'email');
                        t.style.borderBottomColor = t.dataset.tab === 'email' ? 'var(--primary)' : 'transparent';
                        t.style.color = t.dataset.tab === 'email' ? 'var(--text-primary)' : 'var(--text-muted)';
                    });
                    if (emailPanel)
                        emailPanel.style.display = '';
                    if (tokenPanel)
                        tokenPanel.style.display = 'none';
                    const emailErrorEl = main.querySelector('#lock-email-error');
                    if (emailErrorEl) {
                        const binding = authService.getTokenBinding(token);
                        const emailHint = (binding === null || binding === void 0 ? void 0 : binding.email) ? ` (${binding.email})` : '';
                        emailErrorEl.textContent = `This token is registered to an account${emailHint}. Please sign in with your email and password.`;
                        emailErrorEl.hidden = false;
                        if (binding === null || binding === void 0 ? void 0 : binding.email) {
                            const emailInput = main.querySelector('#lock-email');
                            if (emailInput)
                                emailInput.value = binding.email;
                        }
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Unlock with token';
                    return;
                }
                try {
                    authService.setSession(token, { token, source: 'lock-screen', password });
                    const valid = await authService.validateSession(password ? { password } : undefined);
                    if (!valid)
                        throw new Error('Invalid or expired token.');
                    showToast('Dashboard unlocked', 'success');
                    this.updateAuthUi();
                    this.bootstrapAfterAuth();
                    this.router.navigate(view);
                }
                catch (err) {
                    authService.clearSession();
                    const message = err.message || 'Token validation failed';
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.hidden = false;
                    }
                    showToast(message, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Unlock with token';
                }
            });
        }
        // Email form
        const emailForm = main.querySelector('#lock-email-form');
        const gotoRegisterBtn = main.querySelector('#lock-goto-register');
        if (gotoRegisterBtn) {
            gotoRegisterBtn.addEventListener('click', () => {
                this.router.navigate('register');
            });
        }
        if (emailForm) {
            emailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = main.querySelector('#lock-email').value.trim();
                const password = main.querySelector('#lock-password').value;
                const submitBtn = main.querySelector('#lock-email-submit');
                const errorEl = main.querySelector('#lock-email-error');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in…';
                if (errorEl) {
                    errorEl.hidden = true;
                    errorEl.textContent = '';
                }
                try {
                    await authService.login(email, password);
                    showToast('Signed in successfully', 'success');
                    this.updateAuthUi();
                    this.bootstrapAfterAuth();
                    this.router.navigate(view);
                }
                catch (err) {
                    const message = err.message || 'Sign in failed';
                    if (errorEl) {
                        errorEl.textContent = message;
                        errorEl.hidden = false;
                    }
                    showToast(message, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign in with email';
                }
            });
        }
    }
    showIdeAuthPending(view) {
        const main = document.getElementById('app-main');
        if (!main)
            return;
        main.innerHTML = `
      <div class="ide-auth-pending" style="display:flex;align-items:center;justify-content:center;padding:var(--space-8);">
        <div style="text-align:center;max-width:420px;">
          <p class="text-muted" style="margin-bottom:var(--space-3);">Connecting to VS Code extension…</p>
          <p style="font-size:0.9rem;color:var(--text-secondary);">Sign in from the SimpleBeacon sidebar, or use the button below.</p>
          <button type="button" class="btn btn-primary" id="ide-auth-signin-btn" style="margin-top:var(--space-4);">Sign in on simplebeacon.ai</button>
          <button type="button" class="btn btn-secondary" id="ide-auth-register-btn" style="margin-top:var(--space-2);">Create an account</button>
        </div>
      </div>`;
        const btn = main.querySelector('#ide-auth-signin-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.showLockScreen(view, { force: true });
            });
        }
        const regBtn = main.querySelector('#ide-auth-register-btn');
        if (regBtn) {
            regBtn.addEventListener('click', () => {
                this.router.navigate('register');
            });
        }
        void this.waitForIdeAuthSync(5000).then((ok) => {
            if (ok && this._currentViewName === view) {
                void this.onRoute(view, this.state.routeParams || {});
            }
        });
    }
    async waitForIdeAuthSync(timeoutMs = 2500) {
        if (!isIdeDashboardSurface())
            return authService.isAuthenticated();
        if (authService.isAuthenticated())
            return true;
        try {
            if (typeof authService.syncFromExtensionBridge === 'function') {
                const synced = await authService.syncFromExtensionBridge();
                if (synced)
                    return true;
            }
        }
        catch (_sync) { /* non-fatal */ }
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                resolve(!!value);
            };
            const timer = setTimeout(() => finish(authService.isAuthenticated()), timeoutMs);
            const pollTimer = setInterval(() => {
                if (authService.isAuthenticated())
                    finish(true);
            }, 250);
            const onMsg = (event) => {
                if (!(event === null || event === void 0 ? void 0 : event.data))
                    return;
                if (event.data.command === 'setAuthState' && event.data.signedIn === true && event.data.token) {
                    finish(true);
                }
            };
            const onSignedIn = () => finish(true);
            const cleanup = () => {
                clearTimeout(timer);
                clearInterval(pollTimer);
                window.removeEventListener('message', onMsg);
                window.removeEventListener('auth-signed-in', onSignedIn);
            };
            window.addEventListener('message', onMsg);
            window.addEventListener('auth-signed-in', onSignedIn);
            const ping = () => {
                try {
                    window.parent.postMessage({ command: 'getAuthState' }, '*');
                }
                catch (_a) { /* ignore */ }
            };
            ping();
            let pings = 0;
            const pingTimer = setInterval(() => {
                if (++pings > 6) {
                    clearInterval(pingTimer);
                    return;
                }
                ping();
            }, 400);
            setTimeout(() => clearInterval(pingTimer), timeoutMs);
        });
    }
    updateNavVisibility(authed) {
        // Nav links are always visible; route gating in onRoute() shows lock screen
        // for protected views when not authenticated. This keeps the menu visible
        // after sign-out so users know what features exist.
        document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
            const view = link.dataset.view;
            if (view === 'settings')
                return;
            if (view === 'admin') {
                const showAdmin = authed && this.isCurrentUserAdmin();
                link.hidden = !showAdmin;
                link.style.display = showAdmin ? '' : 'none';
                return;
            }
            link.style.display = '';
        });
        document.querySelectorAll('.nav-group-toggle').forEach((toggle) => {
            var _a;
            toggle.style.display = '';
            const itemsContainer = (_a = toggle.closest('.nav-group')) === null || _a === void 0 ? void 0 : _a.querySelector('.nav-group-items');
            if (itemsContainer)
                itemsContainer.style.display = '';
        });
    }
    async ensureVaultSession() {
        var _a;
        if (isDemoMode() || !isLocalSelfHosted())
            return true;
        try {
            const res = await fetch(`${apiBase()}/api/auth/me`, { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            if (res.status === 403 && data.error === 'vault_required') {
                this.showVaultBanner();
                return false;
            }
            (_a = document.getElementById('vault-banner')) === null || _a === void 0 ? void 0 : _a.remove();
            return true;
        }
        catch (_b) {
            return true;
        }
    }
    isCurrentUserAdmin() {
        return authService.isAdmin();
    }
    bootstrapAfterAuth() {
        this.updateAuthUi();
        this.router.init();
        const readOnlyPreview = isDemoMode();
        this.updateNavVisibility(authService.isAuthenticated());
        this.loadDataInBackground().then(() => {
            this.startBackgroundScanWatcher();
        });
        if (!readOnlyPreview && authService.isAuthenticated()) {
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
        const profileBtn = document.getElementById('profile-btn');
        if (signinBtn)
            signinBtn.hidden = authed;
        if (signoutBtn)
            signoutBtn.hidden = !authed;
        if (profileBtn)
            profileBtn.hidden = !authed;
        const sidebarSigninBtn = document.getElementById('sidebar-signin-btn');
        if (sidebarSigninBtn)
            sidebarSigninBtn.hidden = authed;
        const adminLink = document.getElementById('nav-admin-link');
        const showAdmin = authed && this.isCurrentUserAdmin();
        if (adminLink) {
            adminLink.hidden = !showAdmin;
            adminLink.style.display = showAdmin ? '' : 'none';
        }
        const assessmentsLink = document.getElementById('nav-assessments-link');
        if (assessmentsLink) {
            const showAssessments = authed && this.isCurrentUserAdmin();
            assessmentsLink.hidden = !showAssessments;
            assessmentsLink.style.display = showAssessments ? '' : 'none';
        }
        const profileAdminItem = document.getElementById('profile-dropdown-admin');
        if (profileAdminItem)
            profileAdminItem.hidden = !showAdmin;
        this.updateNavVisibility(authed);
        const pricingLink = document.getElementById('header-pricing-link');
        if (pricingLink)
            pricingLink.hidden = authed;
        const token = authService.getToken();
        const sandboxBanner = document.getElementById('sandbox-banner');
        if (sandboxBanner) {
            if (isEmbeddedDashboardFrame()) {
                sandboxBanner.hidden = true;
            }
            else {
            /**
             * Is sandbox.
             * @param {any} (
             * @returns {any}
             */
            const isSandbox = (() => {
                if (!token)
                    return false;
                try {
                    const payload = token.split('.')[1];
                    if (!payload)
                        return false;
                    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
                    const data = JSON.parse(json);
                    const tier = data.tier || data.plan || '';
                    return tier === 'sandbox' || tier === 'developer';
                }
                catch (_a) {
                    return false;
                }
            })();
                sandboxBanner.hidden = !isSandbox;
            }
        }
    }
    async loadBillingContext() {
        var _a;
        try {
            const email = ((_a = authService.getUser()) === null || _a === void 0 ? void 0 : _a.email) || billingService.getEmail();
            if (email)
                billingService.setEmail(email);
            const entitlement = email
                ? await billingService.resolveEntitlement(email)
                : { plan: await billingService.fetchPlan(), status: { subscriptionActive: false }, allowed: false };
            this.state.billingPlan = entitlement.plan;
            this.state.billingStatus = entitlement.status;
            this.state.entitlements = entitlement.status;
            await this.handleCheckoutReturn();
        }
        catch (err) {
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
            }
            catch (err) {
                showToast(err.message, 'error');
            }
        }
    }
    async loadDataInBackground() {
        if (isAuthEntryView(this._currentViewName)) {
            return;
        }
        const now = Date.now();
        if (this._lastLoadDataTime && now - this._lastLoadDataTime < 2000) {
            return;
        }
        this._lastLoadDataTime = now;
        if (this.state.scanning) {
            try {
                await this.loadData();
            }
            catch (err) {
                if (err.code === 'vault_required') {
                    this.showVaultBanner();
                    showToast('Unlock the internal vault, then sign in and retry.', 'info');
                }
                else if (err.code === 'subscription_required') {
                    handleSubscriptionGate.call(this);
                }
                else if (err.code === 'auth_required') {
                    showLoginModal({ onSuccess: () => this.loadDataInBackground() });
                }
                else {
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
        }
        catch (err) {
            if (err.code === 'vault_required') {
                this.showVaultBanner();
                showToast('Unlock the internal vault, then sign in and retry.', 'info');
            }
            else if (err.code === 'subscription_required') {
                handleSubscriptionGate.call(this);
            }
            else if (err.code === 'auth_required') {
                showLoginModal({ onSuccess: () => this.loadDataInBackground() });
            }
            else {
                showToast(`Scan data unavailable: ${err.message}`, 'error');
            }
        }
        finally {
            clearTimeout(safetyTimer);
            this.state.dataLoading = false;
            this.refreshCurrentView();
        }
    }
    setupShell() {
        var _a, _b, _c, _d;
        this.setupAuthNavCapture();
        this.setupPricingCtas();
        (_a = document.getElementById('theme-toggle')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            themeService.toggle();
        });
        (_b = document.getElementById('signin-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            this.router.navigate('signin');
        });
        (_c = document.getElementById('signout-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', async () => {
            try {
                await authService.logout();
                showToast('Signed out', 'info');
                this.updateAuthUi();
                this.router.navigate('signin');
            }
            catch (err) {
                showToast('Sign out failed', 'error');
            }
        });
        (_d = document.getElementById('sidebar-signin-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            this.router.navigate('signin');
        });
        document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    this.navigate(link.dataset.view);
                    this.closeMobileNav();
                }
                catch (navErr) {
                    console.error('Sidebar navigate error:', navErr);
                }
            });
        });
        const appNav = document.getElementById('app-nav');
        appNav === null || appNav === void 0 ? void 0 : appNav.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link[data-view]');
            if (!link)
                return;
            e.preventDefault();
            try {
                this.navigate(link.dataset.view);
                this.closeMobileNav();
            }
            catch (navErr) {
                console.error('Sidebar delegation navigate error:', navErr);
            }
        });
        const searchInput = document.getElementById('global-search');
        searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) {
                this.navigate('results', { q: searchInput.value.trim() });
            }
        });
        this.setupProfileDropdown();
    }
    /** Capture-phase guard so Create Account never falls through to pricing CTAs. */
    setupAuthNavCapture() {
        const registerSelector = '[data-auth-action="register"], #subtab-register, #goto-register-btn, #note-goto-register, #pricing-goto-register, #lock-goto-register, #ide-auth-register-btn';
        const signinSelector = '[data-auth-action="signin"], #subtab-login, #note-goto-signin';
        document.addEventListener('click', (event) => {
            const registerTarget = event.target.closest(registerSelector);
            if (registerTarget) {
                event.preventDefault();
                event.stopPropagation();
                this.router.navigate('register');
                return;
            }
            const signinTarget = event.target.closest(signinSelector);
            if (signinTarget) {
                event.preventDefault();
                event.stopPropagation();
                this.router.navigate('signin');
            }
        }, true);
    }
    /** Redirect pricing CTAs to the marketing pricing page. */
    bindPricingCta(anchor) {
        if (!anchor || anchor.dataset.pricingBound === '1')
            return;
        anchor.dataset.pricingBound = '1';
        anchor.href = '/pricing';
        anchor.removeAttribute('target');
        anchor.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = '/pricing';
        });
    }
    setupPricingCtas() {
        this.bindPricingCta(document.querySelector('#sandbox-banner a'));
        document.addEventListener('click', (event) => {
            if (isAuthEntryView(this._currentViewName)) {
                return;
            }
            if (event.target.closest('.signin-page, .signin-card, .lock-screen, [data-auth-action]')) {
                return;
            }
            const link = event.target.closest('[data-pricing-cta]');
            if (!link || link.dataset.pricingBound === '1')
                return;
            event.preventDefault();
            window.location.href = '/pricing';
        });
    }
    setupProfileDropdown() {
        const profileBtn = document.getElementById('profile-btn');
        const menu = document.getElementById('profile-dropdown-menu');
        const viewBtn = document.getElementById('profile-dropdown-view');
        const adminBtn = document.getElementById('profile-dropdown-admin');
        const signoutBtn = document.getElementById('profile-dropdown-signout');
        if (!profileBtn || !menu)
            return;
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willShow = menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !willShow);
            profileBtn.setAttribute('aria-expanded', String(willShow));
        });
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (!menu.contains(target) && target !== profileBtn && !profileBtn.contains(target)) {
                menu.classList.add('hidden');
                profileBtn.setAttribute('aria-expanded', 'false');
            }
        });
        viewBtn === null || viewBtn === void 0 ? void 0 : viewBtn.addEventListener('click', () => {
            menu.classList.add('hidden');
            profileBtn.setAttribute('aria-expanded', 'false');
            this.navigate('profile');
        });
        adminBtn === null || adminBtn === void 0 ? void 0 : adminBtn.addEventListener('click', () => {
            menu.classList.add('hidden');
            profileBtn.setAttribute('aria-expanded', 'false');
            this.navigate('admin');
        });
        signoutBtn === null || signoutBtn === void 0 ? void 0 : signoutBtn.addEventListener('click', async () => {
            menu.classList.add('hidden');
            profileBtn.setAttribute('aria-expanded', 'false');
            try {
                await authService.logout();
                showToast('Signed out', 'info');
                this.updateAuthUi();
                this.router.navigate('signin');
            }
            catch (err) {
                showToast('Sign out failed', 'error');
            }
        });
    }
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            var _a, _b;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'k') {
                e.preventDefault();
                (_a = document.getElementById('global-search')) === null || _a === void 0 ? void 0 : _a.focus();
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
                }
                else {
                    this.scanService.exportReport();
                }
            }
            if (e.key === 'Escape') {
                if (document.getElementById('token-prompt-modal'))
                    return;
                (_b = document.getElementById('onboarding-modal')) === null || _b === void 0 ? void 0 : _b.remove();
                this.closeMobileNav();
            }
        });
    }
    setupMobileNav() {
        const toggle = document.getElementById('mobile-nav-toggle');
        const nav = document.getElementById('app-nav');
        const overlay = document.getElementById('mobile-nav-overlay');
        toggle === null || toggle === void 0 ? void 0 : toggle.addEventListener('click', () => {
            nav === null || nav === void 0 ? void 0 : nav.classList.toggle('open');
            overlay === null || overlay === void 0 ? void 0 : overlay.classList.toggle('open');
        });
        overlay === null || overlay === void 0 ? void 0 : overlay.addEventListener('click', () => this.closeMobileNav());
    }
    closeMobileNav() {
        var _a, _b;
        (_a = document.getElementById('app-nav')) === null || _a === void 0 ? void 0 : _a.classList.remove('open');
        (_b = document.getElementById('mobile-nav-overlay')) === null || _b === void 0 ? void 0 : _b.classList.remove('open');
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
        var _a, _b, _c, _d;
        // Defensive: clear lastProjectPath if it points to a known-invalid nested path
        // or to the fabricated Windows fallback C:/Users/CascadeProjects (missing the user directory).
        // Also, when the dashboard is served remotely, a Windows local path like C:/Users/... can never be
        // scanned by the remote server and will trigger Firefox Privacy mode warnings. Clear it and
        // fall back to the loaded report's projectRoot or the server default.
        const normalizedLast = String(this.state.lastProjectPath || '').replace(/\\/g, '/');
        const badPathPattern = /ai-platform\/CascadeProjects$|google-earthenterprise|^[a-zA-Z]:\/Users\/CascadeProjects$/i;
        const isRemote = typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        const isLocalWindowsPath = /^[a-zA-Z]:\//i.test(normalizedLast);
        if (badPathPattern.test(normalizedLast) || (isRemote && isLocalWindowsPath)) {
            this.state.lastProjectPath = '';
            this.state.pathInputDraft = '';
        }
        let data = { report: null, baseline: null, config: null, history: null };
        try {
            data = await this.scanService.fetchAll(this.state.lastProjectPath || null);
        }
        catch (_e) {
            // Path-specific report failed — try default platform report
            try {
                data = await this.scanService.fetchAll();
            }
            catch (_f) {
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
        }
        catch (_g) {
            // No re-attestation metadata available
        }
        Object.assign(this.state, {
            report: (() => {
                const serverReport = data.report;
                const localReport = this.state.report;
                const analyzeReport = this.state.analyzeResult && this.state.analyzeResult.report;
                const clientReport = isClientScanReport(localReport) ? localReport
                    : (isClientScanReport(analyzeReport) ? analyzeReport : null);
                if (clientReport && (clientReport.rawIssues || clientReport.detectedIssues || []).length) {
                    return clientReport;
                }
                if (this.state.scanning && localReport) {
                    return localReport;
                }
                return serverReport != null ? serverReport : localReport;
            })(),
            baseline: (_b = data.baseline) !== null && _b !== void 0 ? _b : this.state.baseline,
            config: (_c = data.config) !== null && _c !== void 0 ? _c : this.state.config,
            history: (_d = data.history) !== null && _d !== void 0 ? _d : this.state.history,
            reAttestation
        });
        if (!this.state.lastProjectPath && !this.state.defaultProjectPath) {
            const reportRoot = data.report && data.report.projectRoot;
            if (reportRoot && (!isRemote || hasExtensionBridgeConfigured()) && !shouldClearHostedServerDefaultPath(reportRoot)) {
                this.state.defaultProjectPath = reportRoot;
            }
        }
        await this.ensureDefaultProjectPath();
    }
    async ensureDefaultProjectPath() {
        if (this.state.defaultProjectPath)
            return;
        try {
            const info = await fetchAnalyzeProviders();
            if (info.defaultProjectPath && !shouldClearHostedServerDefaultPath(info.defaultProjectPath)) {
                this.state.defaultProjectPath = info.defaultProjectPath;
            }
        }
        catch (_a) {
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
    async onRoute(view, params) {
        var _a, _b;
        this._currentViewName = view;
        this.state.routeParams = params;
        this.updateAuthPageShell(view);
        this.updateEmbedQuickNav(view);
        const main = document.getElementById('app-main');
        if (!main)
            return;
        // Preserve scroll position across routes leaves a black void above short pages
        // (e.g. Settings after Chatbot). Reset the scroll container on every navigation.
        this.resetMainScroll(main);
        this.cleanupOrphanViewRoots(main);
        // Prevent stale loading state from persisting across navigation
        if (this.currentView && this.state.dataLoading) {
            this.state.dataLoading = false;
        }
        const readOnlyPreview = isDemoMode();
        if (!readOnlyPreview) {
            // Ensure auth state is resolved before gating routes. In local dev the
            // dashboard auto-probes the vault operator session; waiting here prevents
            // direct links to protected routes from flashing the sign-in screen.
            if (!authService.isAuthenticated()) {
                await authService.ensureAuthenticated();
            }
            if (this._currentViewName !== view)
                return;
            this.updateAuthUi();
        }
        if (!readOnlyPreview && !PUBLIC_VIEWS.has(view) && !authService.isAuthenticated()) {
            if (isIdeDashboardSurface()) {
                await this.waitForIdeAuthSync(3000);
            }
            if (!authService.isAuthenticated()) {
                const bridgeBypass = isIdeDashboardSurface()
                    && hasExtensionBridgeConfigured()
                    && IDE_BRIDGE_ONLY_VIEWS.has(view);
                if (!bridgeBypass) {
                    this.showLockScreen(view);
                    return;
                }
            }
        }
        // Free tier gets read-only dashboard access (view reports, no interaction)
        const isFreeTier = authService.isFreeTier();
        this.state.readOnly = isFreeTier;
        if (isFreeTier) {
            this.showReadOnlyBanner();
        }
        else {
            (_a = document.getElementById('readonly-banner')) === null || _a === void 0 ? void 0 : _a.remove();
        }
        if (!readOnlyPreview && view === 'admin' && !this.isCurrentUserAdmin()) {
            showToast('Admin access required', 'info');
            this.navigate('dashboard');
            return;
        }
        // Gate write-heavy views by token claims rather than by issuing separate tokens.
        // Audit, roadmap, results, trust, security, platform, and quality remain read-only accessible.
        if (!readOnlyPreview && WRITE_HEAVY_VIEWS.has(view) && !authService.isDashboardWriteAllowed()) {
            showToast('This dashboard feature requires a paid or team license.', 'info');
            window.location.href = '/pricing';
            return;
        }
        if (!readOnlyPreview && CLOUD_TEAMS_VIEWS.has(view) && authService.isAuthenticated()) {
            const plan = this.state.billingPlan || billingService.plan;
            const status = this.state.billingStatus || billingService.status;
            if (plan || status) {
                const allowed = billingService.hasCloudTeamsAccess(plan, status);
                if (!allowed && !isFreeTier) {
                    if (isLocalSelfHosted() || requiresAuthGate()) {
                        showToast('Sign in with a local account or use npm run dashboard:v1-internal', 'info');
                        this.navigate('signin');
                    }
                    else {
                        showToast('Use the free CLI — see About for install', 'info');
                        this.navigate('about');
                    }
                    return;
                }
            }
        }
        if ((_b = this.currentView) === null || _b === void 0 ? void 0 : _b.destroy) {
            try {
                this.currentView.destroy();
            }
            catch (destroyErr) {
                console.error('View destroy error:', destroyErr);
            }
        }
        document.querySelectorAll('body > .fade-in, .app-shell > .fade-in').forEach((el) => {
            if (el.querySelector('#settings-section-scan, .settings-nav, .page-header, .page-title'))
                el.remove();
        });
        this.cleanupOrphanViewRoots(main);
        const viewInstance = this.views[view];
        if (viewInstance) {
            this.currentView = viewInstance;
            viewInstance.mount(main);
            requestAnimationFrame(() => this.resetMainScroll(main));
        }
        if (view === 'dashboard') {
            this.startBackgroundScanWatcher();
        }
        else {
            this.stopBackgroundScanWatcher();
        }
    }
    async runScan(projectPath) {
        var _a, _b, _c, _d, _e;
        if (this.state.scanning)
            return;
        if (this.state.readOnly) {
            showToast('Scanning requires a paid license. View pricing to upgrade.', 'info');
            return;
        }
        if (isDemoMode()) {
            showToast(demoReadOnlyMessage(), 'info');
            return;
        }
        const resolvedPath = resolveDashboardProjectPath(
            String(projectPath || this.state.lastProjectPath || this.state.defaultProjectPath || '').trim(),
            this.state.defaultProjectPath
        ) || undefined;
        if (!resolvedPath) {
            showToast('No project path selected. Open a folder or set a project path before scanning.', 'error');
            return;
        }
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
            (_b = (_a = this.views.audit) === null || _a === void 0 ? void 0 : _a.invalidateCache) === null || _b === void 0 ? void 0 : _b.call(_a);
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
                        if (sevCounts[band] !== undefined)
                            sevCounts[band]++;
                    }
                    vscode.postMessage({
                        command: 'updateStats',
                        issues: allIssues.length,
                        critical: sevCounts.critical,
                        high: sevCounts.high,
                        medium: sevCounts.medium,
                        low: sevCounts.low,
                        score: (_e = (_d = (_c = report.gate) === null || _c === void 0 ? void 0 : _c.score) !== null && _d !== void 0 ? _d : report.qualityScore) !== null && _e !== void 0 ? _e : 0
                    });
                }
                catch (err) {
                    console.warn('[VSCodeBridge] Failed to post scan stats:', err);
                }
            }
        }
        catch (err) {
            this.state.scanning = false;
            showToast(err.message, 'error');
        }
        this.refreshCurrentView();
        this.startBackgroundScanWatcher();
    }
    refreshCurrentView() {
        if (this._refreshScheduled)
            return;
        this._refreshScheduled = true;
        requestAnimationFrame(() => {
            var _a, _b;
            this._refreshScheduled = false;
            const main = document.getElementById('app-main');
            if (!this.currentView || !main)
                return;
            // Surgical update on dashboard to avoid flicker.
            // If a report already exists and we had one before, refresh the scan slot in-place
            // instead of re-rendering the entire view (which would flash the
            // loading spinner when dataLoading is toggled in loadDataInBackground).
            // If the report just arrived (transition from no-report), do a full mount
            // so the dashboard switches from empty state to the full report view.
            const hadReport = this._hadReport;
            this._hadReport = Boolean(this.state.report);
            if (this._currentViewName === 'dashboard' && this.state.report && hadReport) {
                (_b = (_a = this.views.dashboard) === null || _a === void 0 ? void 0 : _a.refreshScanStatus) === null || _b === void 0 ? void 0 : _b.call(_a);
                return;
            }
            this.currentView.mount(main);
            requestAnimationFrame(() => this.resetMainScroll(main));
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
        var _a, _b;
        this.stopBackgroundScanWatcher();
        // Only poll when a scan is active or just finished; otherwise there's nothing new to detect.
        if (!this.state.scanning && !(this.state.report && (this.state.report.scanId || this.state.report.generatedAt))) {
            return;
        }
        const currentScanId = ((_a = this.state.report) === null || _a === void 0 ? void 0 : _a.scanId) || ((_b = this.state.report) === null || _b === void 0 ? void 0 : _b.generatedAt) || null;
        this._lastKnownScanId = currentScanId;
        this._bgScanPollStart = Date.now();
        const poll = async () => {
            if (this._bgScanPollInProgress || (typeof document !== 'undefined' && document.hidden))
                return;
            this._bgScanPollInProgress = true;
            if (Date.now() - this._bgScanPollStart > 60000) {
                this.stopBackgroundScanWatcher();
                this._bgScanPollInProgress = false;
                return;
            }
            try {
                const report = await this.scanService.fetchReport(this.state.lastProjectPath || null);
                const newScanId = (report === null || report === void 0 ? void 0 : report.scanId) || (report === null || report === void 0 ? void 0 : report.generatedAt) || null;
                if (newScanId && newScanId !== this._lastKnownScanId) {
                    this.stopBackgroundScanWatcher();
                    await this.loadDataInBackground();
                    showToast('New scan results available', 'success');
                }
            }
            catch (_a) {
                // Silently ignore transient fetch errors
            }
            finally {
                this._bgScanPollInProgress = false;
            }
        };
        this._bgScanPollTimer = setInterval(poll, 30000);
    }
    maybeShowOnboarding() {
        if (!shouldShowOnboarding())
            return;
        const overlay = renderOnboarding();
        document.body.appendChild(overlay);
        bindOnboarding(overlay, {
            onStart: () => this.runScan(),
            onTour: () => this.guidedTour.start(0),
            onDismiss: () => { }
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.__SB_DASHBOARD_APP__ = true;
        const app = new SimplebeaconDashboard();
        window.simplebeaconApp = app;
        app.init().catch((err) => {
            console.error(err);
            showToast(err.message || 'Dashboard failed to start', 'error');
        });
    }
    catch (err) {
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
