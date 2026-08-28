// VS Code API
import * as vscode from 'vscode';

// Node built-ins
import * as crypto from 'crypto'; // simplebeacon-ignore import-blocks — standard VS Code extension imports grouped by source
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import {
  getDataServerPort,
  getBrowserSessionToken,
  setBrowserSessionToken,
  clearBrowserSessionToken,
  recordBrowserSignOut,
  isTokenSignedOut,
  getTheme,
  setTheme,
} from './dataServer';
import {
  registerSidebarView,
  postSidebarMessage as _postSidebarMessage,
  openTeamDashboardPanel as _openTeamDashboardPanel,
  openWebsiteDashboardPanel,
  postWebsiteDashboardMessage,
  navigateWebsiteDashboardPanel,
  isWebsiteDashboardPanelOpen,
  buildDashboardUrl,
  appendDashboardEmbedParams,
  getDashboardUrlBarStyles,
  getDashboardUrlBarHtml,
} from './sidebarMessenger';
import { getAuthManager } from './auth/authContext';
import type { AuthManager } from './auth/authManager';
import { showQuietMessage, getSbConfig, normalizeApiServerUrl } from './utils/vscode';
import { escapeHtml } from './utils/string';
import { resolveTier } from './tierConstants';
import { validateLicenseLocally } from './licenseManager';
import { PUBLIC_KEY_PEM } from './realtimeMonitor';
import { AccountTracker } from './accountTracker';

type WelcomeDashboardType = (typeof import('./welcomeDashboard'))['WelcomeDashboard'];
let _WelcomeDashboard: WelcomeDashboardType | null = null;
function getWelcomeDashboard(): WelcomeDashboardType {
  if (!_WelcomeDashboard) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _WelcomeDashboard = require('./welcomeDashboard').WelcomeDashboard as WelcomeDashboardType;
  }
  return _WelcomeDashboard;
}

/** Resolve IDE color theme for sidebar/dashboard sync. */
function getIdeThemeKind(): 'dark' | 'light' {
  const kind = vscode.window.activeColorTheme?.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast ? 'dark' : 'light';
}

/** CSS variable overrides so the sidebar matches the dashboard app (/app/) look. */
function buildSidebarThemeStyles(theme: 'dark' | 'light'): string {
  // Palette mirrors coming-soon/public/app/css/variables.css so the IDE sidebar
  // matches the hosted dashboard app's design system.
  const dark = {
    '--vscode-editor-background': '#0b1120',
    '--vscode-sideBar-background': '#0b1120',
    '--vscode-sideBar-foreground': '#f1f5f9',
    '--vscode-foreground': '#f1f5f9',
    '--vscode-descriptionForeground': '#94a3b8',
    '--vscode-panel-border': '#1e293b',
    '--vscode-input-background': '#111827',
    '--vscode-list-hoverBackground': '#1e293b',
    '--vscode-button-secondaryBackground': '#1e293b',
    '--vscode-button-background': '#818cf8',
    '--vscode-button-hoverBackground': '#a5b4fc',
    '--vscode-button-foreground': '#0b1120',
    '--vscode-focusBorder': '#818cf8',
    '--sb-surface': '#111827',
    '--sb-surface-elevated': '#1e293b',
    '--sb-surface-hover': '#1e293b',
    '--sb-border': '#1e293b',
    '--sb-border-subtle': '#172033',
    '--sb-text-primary': '#f1f5f9',
    '--sb-text-secondary': '#94a3b8',
    '--sb-text-muted': '#94a3b8',
    '--sb-primary': '#818cf8',
    '--sb-primary-hover': '#a5b4fc',
    '--sb-primary-subtle': 'rgba(129,140,248,0.12)',
    '--sb-accent': '#22d3ee',
    '--sb-success': '#10b981',
    '--sb-warning': '#f59e0b',
    '--sb-danger': '#ef4444',
    '--sb-info': '#3b82f6',
    '--sb-text-inverse': '#0b1120',
  };
  const light = {
    '--vscode-editor-background': '#f8fafc',
    '--vscode-sideBar-background': '#f8fafc',
    '--vscode-sideBar-foreground': '#0f172a',
    '--vscode-foreground': '#0f172a',
    '--vscode-descriptionForeground': '#475569',
    '--vscode-panel-border': '#e2e8f0',
    '--vscode-input-background': '#ffffff',
    '--vscode-list-hoverBackground': '#f1f5f9',
    '--vscode-button-secondaryBackground': '#f1f5f9',
    '--vscode-button-background': '#6366f1',
    '--vscode-button-hoverBackground': '#4f46e5',
    '--vscode-button-foreground': '#ffffff',
    '--vscode-focusBorder': '#6366f1',
    '--sb-surface': '#ffffff',
    '--sb-surface-elevated': '#ffffff',
    '--sb-surface-hover': '#f1f5f9',
    '--sb-border': '#e2e8f0',
    '--sb-border-subtle': '#f1f5f9',
    '--sb-text-primary': '#0f172a',
    '--sb-text-secondary': '#475569',
    '--sb-text-muted': '#475569',
    '--sb-primary': '#6366f1',
    '--sb-primary-hover': '#4f46e5',
    '--sb-primary-subtle': '#eef2ff',
    '--sb-accent': '#06b6d4',
    '--sb-success': '#10b981',
    '--sb-warning': '#f59e0b',
    '--sb-danger': '#ef4444',
    '--sb-info': '#3b82f6',
    '--sb-text-inverse': '#ffffff',
  };
  const palette = theme === 'dark' ? dark : light;
  const vars = Object.entries(palette)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `
html[data-theme="${theme}"] { color-scheme: ${theme}; ${vars}; }
html[data-theme="${theme}"], html[data-theme="${theme}"] body {
  background: var(--vscode-sideBar-background);
  color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
html[data-theme="${theme}"] .tc-list-item,
html[data-theme="${theme}"] .card,
html[data-theme="${theme}"] .db-score-card,
html[data-theme="${theme}"] .analyze-card,
html[data-theme="${theme}"] .report-card {
  background: var(--sb-surface);
  border-color: var(--sb-border);
}
html[data-theme="${theme}"] .tc-list-item:hover,
html[data-theme="${theme}"] .card:hover {
  background: var(--sb-surface-hover);
}
html[data-theme="light"] .tc-list-item,
html[data-theme="light"] .card,
html[data-theme="light"] .db-score-card,
html[data-theme="light"] .analyze-card,
html[data-theme="light"] .report-card {
  background: var(--sb-surface);
  border-color: var(--sb-border);
}
html[data-theme="light"] .tc-list-item:hover,
html[data-theme="light"] .card:hover {
  background: var(--sb-surface-hover);
}
`;
}

/** Typed shape for messages received from the sidebar webview. */
interface SidebarMessage {
  command: string;
  mode?: string;
  path?: string;
  route?: string;
  value?: string | boolean;
  url?: string;
  token?: string;
  event?: string;
  data?: Record<string, unknown>;
  analyzers?: string[];
  minSeverity?: string;
  file?: string;
  line?: number;
  col?: number;
  name?: string;
  message?: string;
  stack?: string;
  report?: Record<string, unknown>;
  requestId?: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

/**
 * Modern sidebar webview view provider for the SimpleBeacon extension.
 */
export class ModernSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-modern';
  private static browserPanel: vscode.WebviewPanel | undefined;
  private static signinPanel: vscode.WebviewPanel | undefined;
  private static tokenRegistrationPanel: vscode.WebviewPanel | undefined;
  private static relayOutputChannel?: vscode.OutputChannel;
  private static _relayPort?: number;
  private static _relayServer?: http.Server;
  private static _relayPollInterval?: NodeJS.Timeout;
  public static _dashboardHtml: string | undefined;
  public static _sidebarHtml: string | undefined;
  public static _welcomeBrowserHtml: string | undefined;
  private static _instance?: ModernSidebarProvider;
  private static _extensionUri?: vscode.Uri;
  private static _cachedSignedIn = false;
  private static _cachedTier = '';
  private static _cachedToken = '';
  private static _cachedIsAdmin = false;
  private static _lastCodeMapData: Record<string, unknown> | null = null;
  private static _authRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  private static _authRefreshPendingSource?: string;
  private static _lastAuthRefreshAt = 0;
  private static _dashboardMode: 'website' | 'localhost' | null = 'localhost';
  public static getDashboardMode(): 'website' | 'localhost' {
    return ModernSidebarProvider._dashboardMode || 'localhost';
  }
  public static getCachedTier(): string {
    return ModernSidebarProvider._cachedTier;
  }
  public static getCachedIsAdmin(): boolean {
    return ModernSidebarProvider._cachedIsAdmin;
  }
  private static _tracker?: AccountTracker;

  public static setAccountTracker(tracker: AccountTracker) {
    ModernSidebarProvider._tracker = tracker;
  }

  public static getBrowserPanel(): vscode.WebviewPanel | undefined {
    return ModernSidebarProvider.browserPanel;
  }

  /** Check if remoteMode is enabled (run entirely in browser). */
  private static isRemoteMode(): boolean {
    return getSbConfig().get<boolean>('remoteMode', false);
  }

  /** Return the active dashboard host: explicit website/localhost override, then local fallback. */
  private static resolveDashboardHost(): string | null {
    return `http://127.0.0.1:${getDataServerPort()}`;
  }

  /** Open a dashboard route in the Simple Browser using the active dashboard host. */
  private static openInBrowserIfRemote(route: string): boolean {
    const host = ModernSidebarProvider.resolveDashboardHost();
    if (!host && !ModernSidebarProvider.isRemoteMode()) return false;
    const isRemote = host
      ? !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(host)
      : ModernSidebarProvider.isRemoteMode();
    if (!isRemote) return false;
    ModernSidebarProvider._openRemoteRouteInBrowserAsync(route, host).catch(() => {});
    return true;
  }

  /** Async helper that builds a remote dashboard URL and optionally injects the current token. */
  private static async _openRemoteRouteInBrowserAsync(route: string, host: string | null): Promise<void> {
    const base = (host || 'https://simplebeacon.pages.dev').replace(/\/$/, '');
    const isRemote = !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(base);
    let normalizedRoute = route.startsWith('/') ? route : '/' + route;
    if (isRemote) {
      normalizedRoute = normalizedRoute.replace(/^\/dashboard\/dashboard\/?$/, '/dashboard');
      normalizedRoute = normalizedRoute.replace(/^\/dashboard\/?$/, '/dashboard');
      if (!normalizedRoute.startsWith('/dashboard/')) {
        normalizedRoute = '/dashboard' + normalizedRoute;
      }
    }
    // Only inject the local API base for localhost dashboards. Website mode uses the remote API.
    // Do NOT inject the auth token into remote URLs; it leaks in the address bar and the
    // website should receive it through the postMessage /api/notify bridge instead.
    const localBaseUrl = `http://127.0.0.1:${getDataServerPort()}`;
    const apiBaseQuery = !isRemote ? `sb_api_base=${encodeURIComponent(localBaseUrl + '/api')}` : '';
    const notifyBaseQuery = isRemote ? `sb_notify_base=${encodeURIComponent(localBaseUrl + '/api')}` : '';
    const query = [apiBaseQuery, notifyBaseQuery].filter(Boolean).join('&');
    let url = `${base}${normalizedRoute}${query ? (normalizedRoute.includes('?') ? '&' : '?') + query : ''}`;
    if (isRemote) {
      url = appendDashboardEmbedParams(url, `${localBaseUrl}/api`, true);
    }
    if (isWebsiteDashboardPanelOpen() && navigateWebsiteDashboardPanel(url)) {
      return;
    }
    if (isRemote) {
      openWebsiteDashboardPanel(url, 'Team Dashboard');
      return;
    }
    _openTeamDashboardPanel(
      ModernSidebarProvider._extensionUri!,
      normalizedRoute,
      'Team Dashboard',
      base,
      apiBaseQuery
    );
  }

  /** Safely read the current auth token from AuthManager. */
  private static async _getCurrentToken(): Promise<string | undefined> {
    try {
      const authManager = getAuthManager();
      if (authManager && typeof authManager.getToken === 'function') {
        return await authManager.getToken();
      }
    } catch {
      /* auth manager may not be initialized */
    }
    return undefined;
  }

  /** Open a dashboard route in the native Welcome Dashboard main window (not the hosted website). */
  public static openDashboardRouteInBrowser(route: string): void {
    const extUri = ModernSidebarProvider._extensionUri;
    if (extUri) {
      ModernSidebarProvider.openWelcomeDashboardRoute(extUri, route);
      return;
    }
    ModernSidebarProvider._openDashboardRouteInBrowserAsync(route).catch(() => {});
  }

  /** Open a dashboard route in the embedded main-window panel (local dashboard-web / simplebeacon.ai iframe). */
  public static openEmbeddedDashboardRoute(route: string): void {
    ModernSidebarProvider._openDashboardRouteInBrowserAsync(route).catch(() => {});
  }

  private static teamNavRoute(command: string): string | undefined {
    const routes: Record<string, string> = {
      navDashboard: '/dashboard',
      navAnalyze: '/dashboard/analyze',
      navResults: '/dashboard/results',
      navRepoHealth: '/dashboard/repository-health',
      navAudit: '/dashboard/audit',
      navSecurity: '/dashboard/security',
      navQuality: '/dashboard/quality',
      navTrust: '/dashboard/trust',
      navAssessments: '/dashboard/assessments',
      navRoadmap: '/dashboard/remediation',
      navPlatform: '/dashboard/platform',
      navProfile: '/dashboard/profile',
      navTools: '/dashboard/tools',
      navSettings: '/dashboard/settings',
      navHelp: '/dashboard/help',
      navChatbot: '/dashboard/chatbot',
      navAbout: '/dashboard/about',
    };
    return routes[command];
  }

  /** Async helper that opens a dashboard route in the configured host. */
  private static async _openDashboardRouteInBrowserAsync(route: string): Promise<void> {
    const extUri = ModernSidebarProvider._extensionUri;
    const localBaseUrl = `http://127.0.0.1:${getDataServerPort()}`;
    const configuredHost = ModernSidebarProvider.resolveDashboardHost();
    // Default to local IDE dashboard; remote is used only when website mode is explicitly selected.
    const baseUrl = configuredHost || localBaseUrl;
    const isRemote =
      Boolean(configuredHost) && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(configuredHost || '');
    // Auth relay only goes through the local data server in localhost mode. Website mode uses the remote API.
    // Do NOT inject the auth token into remote URLs; it leaks in the address bar.
    const apiBaseQuery = !isRemote ? `sb_api_base=${encodeURIComponent(localBaseUrl + '/api')}&force=1` : '';
    const notifyBaseQuery = isRemote ? `sb_notify_base=${encodeURIComponent(localBaseUrl + '/api')}` : '';
    let normalizedRoute = route.startsWith('/') ? route : '/' + route;
    normalizedRoute = normalizedRoute.replace(/^\/dashboard\/dashboard\/?$/, '/dashboard');
    if (!normalizedRoute.startsWith('/dashboard/') && normalizedRoute !== '/dashboard') {
      normalizedRoute = '/dashboard' + normalizedRoute;
    }
    const remoteQuery = [apiBaseQuery, notifyBaseQuery].filter(Boolean).join('&');
    let navigateUrl = isRemote
      ? `${baseUrl.replace(/\/$/, '')}${normalizedRoute}${remoteQuery ? '?' + remoteQuery : ''}`
      : buildDashboardUrl(baseUrl, normalizedRoute, apiBaseQuery);

    if (isRemote) {
      navigateUrl = appendDashboardEmbedParams(navigateUrl, `${localBaseUrl}/api`, true);
    }

    if (isWebsiteDashboardPanelOpen() && navigateWebsiteDashboardPanel(navigateUrl)) {
      return;
    }

    if (isRemote) {
      openWebsiteDashboardPanel(navigateUrl, 'Team Dashboard');
      return;
    }
    _openTeamDashboardPanel(
      extUri || ModernSidebarProvider._extensionUri!,
      normalizedRoute,
      'Team Dashboard',
      baseUrl,
      apiBaseQuery
    );
  }

  public static getSidebarReport(): Record<string, unknown> | null {
    const inst = ModernSidebarProvider._instance;
    return inst ? inst._currentReport : null;
  }

  public static postSidebarMessage(message: any) {
    _postSidebarMessage(message);
  }

  public static refreshAuthState(source?: string) {
    const force = source === 'signIn' || source === 'signOut' || source === 'websitePanel';
    if (!force && Date.now() - ModernSidebarProvider._lastAuthRefreshAt < 2000) {
      return;
    }
    ModernSidebarProvider._authRefreshPendingSource = source ?? ModernSidebarProvider._authRefreshPendingSource;
    if (ModernSidebarProvider._authRefreshTimer) {
      return;
    }
    ModernSidebarProvider._authRefreshTimer = setTimeout(
      () => {
        ModernSidebarProvider._authRefreshTimer = undefined;
        const pendingSource = ModernSidebarProvider._authRefreshPendingSource;
        ModernSidebarProvider._authRefreshPendingSource = undefined;
        ModernSidebarProvider._refreshAuthStateNow(pendingSource).catch(() => {});
      },
      force ? 0 : 150
    );
  }

  private static async _refreshAuthStateNow(source?: string) {
    const inst = ModernSidebarProvider._instance;
    if (!inst || !inst._view) {
      return;
    }
    ModernSidebarProvider._lastAuthRefreshAt = Date.now();
    // Prefer cached auth state from webview (set via setSidebarAuthState) over the stub AuthManager
    let signedIn = ModernSidebarProvider._cachedSignedIn;
    let token = ModernSidebarProvider._cachedSignedIn ? ModernSidebarProvider._cachedToken : '';
    let tier = ModernSidebarProvider._cachedTier;
    let isAdmin = ModernSidebarProvider._cachedIsAdmin;
    try {
      let authManager: AuthManager | null = null;
      try {
        authManager = getAuthManager();
      } catch {
        authManager = null;
      }
      // Only override cached state if authManager actually has a valid token
      if (!signedIn && authManager && typeof authManager.isSignedIn === 'function') {
        signedIn = await authManager.isSignedIn();
      }
      if (signedIn && authManager && typeof authManager.getToken === 'function') {
        const mgrToken = await authManager.getToken();
        if (mgrToken) {
          token = mgrToken;
        }
      }
      // If the extension has no token, check if the browser dashboard signed in recently
      if (!signedIn && !token) {
        const browserToken = getBrowserSessionToken();
        const signedOut = !!(browserToken && browserToken.length > 10 && isTokenSignedOut(browserToken));
        ModernSidebarProvider.logRelay(
          'refreshAuthState browserToken=' +
            (browserToken ? 'present(' + browserToken.length + ')' : 'none') +
            ' signedOut=' +
            signedOut +
            ' signedIn=' +
            signedIn
        );
        if (browserToken && !signedOut && authManager && typeof authManager.setToken === 'function') {
          await authManager.setToken(browserToken);
          signedIn = true;
          token = browserToken;
          ModernSidebarProvider.logRelay('Synced browser session token into extension auth state');
        }
      }
      // Derive tier from a stored license token when no explicit tier was provided
      if (token && (!tier || tier === 'developer')) {
        const parts = token.split('.');
        if (parts.length === 2) {
          const meta = validateLicenseLocally(token, PUBLIC_KEY_PEM);
          if (meta && meta.tier) {
            tier = resolveTier(meta.tier);
          }
        }
      }
      ModernSidebarProvider.logRelay(
        'refreshAuthState setAuthState signedIn=' +
          signedIn +
          ' tier=' +
          tier +
          ' isAdmin=' +
          isAdmin +
          ' source=' +
          (source || '')
      );
      ModernSidebarProvider.setSidebarAuthState(signedIn, tier, token, source, isAdmin);
    } catch (e) {
      ModernSidebarProvider.logRelay('refreshAuthState error: ' + (e instanceof Error ? e.message : String(e)));
      ModernSidebarProvider.setSidebarAuthState(
        ModernSidebarProvider._cachedSignedIn,
        ModernSidebarProvider._cachedTier,
        '',
        source,
        ModernSidebarProvider._cachedIsAdmin
      );
    }
  }

  private static _isWebsiteSource(source?: string): boolean {
    return (
      typeof source === 'string' && (source === 'websitePanel' || source === 'website' || source.startsWith('website'))
    );
  }

  public static setSidebarAuthState(
    signedIn: boolean,
    tier?: string,
    token?: string,
    source?: string,
    isAdmin?: boolean
  ) {
    const newTier = tier !== undefined ? resolveTier(tier) : ModernSidebarProvider._cachedTier;
    // Preserve the existing token when a caller confirms sign-in without passing the token again.
    const newToken = token || (signedIn ? ModernSidebarProvider._cachedToken : '');
    const newIsAdmin = !!isAdmin;
    // Avoid re-posting the same state to the webviews on every auth poll.
    if (
      source !== 'signOut' &&
      signedIn === ModernSidebarProvider._cachedSignedIn &&
      newTier === ModernSidebarProvider._cachedTier &&
      newToken === ModernSidebarProvider._cachedToken &&
      newIsAdmin === ModernSidebarProvider._cachedIsAdmin
    ) {
      return;
    }
    ModernSidebarProvider._cachedSignedIn = signedIn;
    if (tier !== undefined) {
      ModernSidebarProvider._cachedTier = newTier;
    }
    ModernSidebarProvider._cachedToken = newToken;
    if (typeof isAdmin === 'boolean') {
      ModernSidebarProvider._cachedIsAdmin = newIsAdmin;
    }
    if (signedIn && token) {
      setBrowserSessionToken(token);
    }
    if (!signedIn) {
      clearBrowserSessionToken();
    }
    const inst = ModernSidebarProvider._instance;
    const msg: any = {
      command: 'setAuthState',
      signedIn,
      tier: ModernSidebarProvider._cachedTier,
      isAdmin: ModernSidebarProvider._cachedIsAdmin,
    };
    if (token) {
      msg.token = token;
    }
    if (source) {
      msg.source = source;
    }
    if (inst?._view) {
      inst._view.webview.postMessage(msg);
    }
    // Only echo sign-outs to the website dashboard when they are explicit. Otherwise the
    // extension's periodic no-token refresh could wipe a website sign-in that it doesn't know about.
    if (!ModernSidebarProvider._isWebsiteSource(source) && (signedIn || source === 'signOut')) {
      postWebsiteDashboardMessage({ ...msg, source: source || 'ide' });
    }
  }

  private static _safePost(target: { webview: vscode.Webview } | undefined, message: unknown) {
    if (!target) {
      return;
    }
    try {
      target.webview.postMessage(message);
    } catch {
      /* target disposed */
    }
  }

  public static postThemeToTeamDashboard(theme: string) {
    ModernSidebarProvider._safePost(ModernSidebarProvider._instance?._view, { command: 'setTheme', theme });
    postWebsiteDashboardMessage({ command: 'setTheme', theme });
  }

  public static isViewReady(): boolean {
    const inst = ModernSidebarProvider._instance;
    return !!inst && !!inst._view;
  }

  public static showDashboardInSidebar() {
    const inst = ModernSidebarProvider._instance;
    if (!inst || !inst._view) {
      return;
    }
    inst._view.webview.postMessage({ command: 'showDashboard' });
    // Also push current report data if available
    if (inst._currentReport) {
      inst._view.webview.postMessage({ command: 'updateReport', report: inst._currentReport });
    }
  }

  public static updateSidebarReport(report: Record<string, unknown> | null) {
    const inst = ModernSidebarProvider._instance;
    if (inst) {
      inst.updateReport(report);
    }
  }

  public static openSigninPanel() {
    ModernSidebarProvider._openSigninPanelAsync().catch(() => {});
  }

  public static signInViaWebsite() {
    ModernSidebarProvider._signInViaWebsiteAsync().catch(() => {});
  }

  /** Open sign-in in the IDE dashboard webview panel (same surface as Quick Links / Team Dashboard). */
  private static _openSigninInPreview(route: '/signin' | '/register' = '/signin'): void {
    const websiteMode = ModernSidebarProvider.getDashboardMode() === 'website';
    const localBase = `http://127.0.0.1:${getDataServerPort()}`;
    const dashboardBase = websiteMode ? 'https://simplebeacon.pages.dev' : localBase;
    const notifyBase = `${localBase}/api`;
    const callbackUri = `${vscode.env.uriScheme}://simplebeacon.simplebeacon-vscode/relay/auth`;
    const extraParts = [
      `redirect_uri=${encodeURIComponent(callbackUri)}`,
      `sb_notify_base=${encodeURIComponent(notifyBase)}`,
      `sb_api_base=${encodeURIComponent(notifyBase)}`,
      'force=1',
      `_${Date.now()}`,
    ];
    let authUrl = buildDashboardUrl(dashboardBase, route, extraParts.join('&'));
    authUrl = appendDashboardEmbedParams(authUrl, notifyBase, websiteMode);
    const panelTitle = route === '/register' ? 'Create Account' : 'Sign In';
    if (isWebsiteDashboardPanelOpen() && navigateWebsiteDashboardPanel(authUrl)) {
      return;
    }
    openWebsiteDashboardPanel(authUrl, panelTitle);
  }

  /** Open account registration in the IDE dashboard webview panel. */
  public static openRegisterPanel() {
    ModernSidebarProvider._openSigninInPreview('/register');
  }

  /** Async helper that opens the sign-in page in the IDE preview panel. */
  private static async _openSigninPanelAsync(): Promise<void> {
    ModernSidebarProvider._openSigninInPreview();
  }

  /** Async helper that opens sign-in in the IDE preview panel with VS Code: relay callback. */
  private static async _signInViaWebsiteAsync(): Promise<void> {
    ModernSidebarProvider._openSigninInPreview();
  }

  public static openTokenRegistrationPanel(_extUri: vscode.Uri, token: string) {
    const nonce = crypto.randomBytes(16).toString('base64');
    if (!ModernSidebarProvider.tokenRegistrationPanel) {
      ModernSidebarProvider.tokenRegistrationPanel = vscode.window.createWebviewPanel(
        'simplebeaconTokenRegistration',
        'Token Registration',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      ModernSidebarProvider.tokenRegistrationPanel.onDidDispose(() => {
        ModernSidebarProvider.tokenRegistrationPanel = undefined;
      });
      ModernSidebarProvider.tokenRegistrationPanel.webview.onDidReceiveMessage(async (msg: any) => {
        if (!msg || !msg.command) return;
        const authManager = getAuthManager();
        switch (msg.command) {
          case 'registerTokenDetails': {
            const { email, username, password } = msg;
            if (email) {
              try {
                await authManager.setUserEmail(email);
              } catch {}
            }
            if (username) {
              try {
                await authManager.setUserName(username);
              } catch {}
            }
            if (password) {
              try {
                await authManager.setPassword(password);
              } catch {}
            }
            // Register token with server
            try {
              const port = getDataServerPort();
              await fetch(`http://127.0.0.1:${port}/api/auth/register-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email: email || '' }),
              });
            } catch {
              // Data server not running; credentials stored locally only
            }
            vscode.window.showInformationMessage('Token registration complete');
            ModernSidebarProvider.refreshAuthState();
            break;
          }
          case 'saveTokenToUsb': {
            const saveUri = await vscode.window.showSaveDialog({
              saveLabel: 'Save Token',
              filters: { 'Token Files': ['txt', 'token'] },
              defaultUri: vscode.Uri.file('simplebeacon-token.txt'),
            });
            if (saveUri && saveUri.fsPath) {
              try {
                fs.writeFileSync(saveUri.fsPath, token, 'utf8');
                vscode.window.showInformationMessage(`Token saved to ${saveUri.fsPath}`);
              } catch (e) {
                vscode.window.showErrorMessage(`Failed to save token: ${(e as Error).message}`);
              }
            }
            break;
          }
        }
      });
    }
    ModernSidebarProvider.tokenRegistrationPanel.reveal(vscode.ViewColumn.One);
    ModernSidebarProvider.tokenRegistrationPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Token Registration</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1120;color:#f1f5f9;display:flex;align-items:center;justify-content:center}
.container{width:100%;max-width:420px;padding:24px}
.card{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.3)}
h2{font-size:1.25rem;color:#f1f5f9;margin-bottom:6px}
p.sub{color:#94a3b8;font-size:0.85rem;margin-bottom:20px}
.field{margin-bottom:16px}
label{display:block;font-size:0.8rem;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px}
input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #1e293b;background:#0b1120;color:#f1f5f9;font-size:0.9rem;outline:none}
input:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(129,140,248,0.12)}
input[readonly]{opacity:0.6;cursor:not-allowed}
.actions{display:flex;gap:10px;margin-top:24px}
button{flex:1;padding:10px;border-radius:8px;border:none;font-size:0.9rem;font-weight:600;cursor:pointer;transition:opacity 0.2s}
button.primary{background:#818cf8;color:#0b1120}
button.primary:hover{background:#a5b4fc}
button.secondary{background:#1e293b;color:#f1f5f9;border:1px solid #1e293b}
button.secondary:hover{background:#334155}
button:hover{opacity:0.9}
.status{margin-top:16px;font-size:0.85rem;color:#10b981;min-height:1.2em}
.status.error{color:#ef4444}
</style>
</head>
<body>
<div class="container">
<div class="card">
<h2>Token Registration</h2>
<p class="sub">Complete your token setup with account details</p>
<div class="field">
<label>Token</label>
<input type="text" id="tokenField" value="${token.substring(0, 20)}..." readonly>
</div>
<div class="field">
<label>Email Address</label>
<input type="email" id="emailField" placeholder="you@example.com">
</div>
<div class="field">
<label>Username</label>
<input type="text" id="usernameField" placeholder="your_username">
</div>
<div class="field">
<label>Password</label>
<input type="password" id="passwordField" placeholder="Secure password">
</div>
<div class="actions">
<button class="secondary" id="saveUsbBtn">Save to USB</button>
<button class="primary" id="registerBtn">Register</button>
</div>
<div class="status" id="status"></div>
</div>
</div>
<script nonce="${nonce}">
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
const token = ${JSON.stringify(token)};
const $ = id => document.getElementById(id);
const statusEl = $('status');
function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}
$('registerBtn').addEventListener('click', () => {
  const email = $('emailField').value.trim();
  const username = $('usernameField').value.trim();
  const password = $('passwordField').value;
  if (!email || !email.includes('@')) { setStatus('Enter a valid email', true); return; }
  if (!password || password.length < 6) { setStatus('Password must be at least 6 characters', true); return; }
  if (vscode) { vscode.postMessage({ command: 'registerTokenDetails', email, username, password }); }
  setStatus('Registration saved');
});
$('saveUsbBtn').addEventListener('click', () => {
  if (vscode) { vscode.postMessage({ command: 'saveTokenToUsb' }); }
  setStatus('Choose a save location...');
});
</script>
</body>
</html>`;
  }

  public static openTokenReplacementPanel(extUri: vscode.Uri, currentToken: string, currentTier: string) {
    if (ModernSidebarProvider.openInBrowserIfRemote('/dashboard/signin')) return;
    const nonce = crypto.randomBytes(16).toString('base64');
    if (!ModernSidebarProvider.tokenRegistrationPanel) {
      ModernSidebarProvider.tokenRegistrationPanel = vscode.window.createWebviewPanel(
        'simplebeaconTokenReplacement',
        'Replace Token',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      ModernSidebarProvider.tokenRegistrationPanel.onDidDispose(() => {
        ModernSidebarProvider.tokenRegistrationPanel = undefined;
      });
      ModernSidebarProvider.tokenRegistrationPanel.webview.onDidReceiveMessage(async (msg: any) => {
        if (!msg || !msg.command) return;
        const authManager = getAuthManager();
        switch (msg.command) {
          case 'replaceToken': {
            const newToken = msg.token ? String(msg.token).trim() : '';
            if (!newToken) {
              vscode.window.showErrorMessage('No token provided.');
              return;
            }
            const parts = newToken.split('.');
            if (parts.length !== 2 && parts.length !== 3) {
              vscode.window.showErrorMessage('Token must be a JWT (3 dots) or license key (1 dot).');
              return;
            }
            // Prevent replacing with the same token
            if (newToken === currentToken) {
              vscode.window.showErrorMessage('New token is identical to the current one.');
              return;
            }
            // Check server registration
            try {
              const port = getDataServerPort();
              const res = await fetch(`http://127.0.0.1:${port}/api/auth/token-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: newToken }),
              });
              if (res.ok) {
                const data = (await res.json()) as { registered?: boolean };
                if (data.registered) {
                  vscode.window.showErrorMessage('This token is already registered. Use a different token.');
                  return;
                }
              }
            } catch {
              // Data server not running; proceed with local-only validation
            }
            // Store new token and clear old cached state
            try {
              await authManager.setToken(newToken);
              ModernSidebarProvider._cachedSignedIn = true;
              ModernSidebarProvider._cachedTier = '';
              vscode.window.showInformationMessage('Token replaced successfully');
              ModernSidebarProvider.refreshAuthState();
              if (ModernSidebarProvider.tokenRegistrationPanel) {
                ModernSidebarProvider.tokenRegistrationPanel.dispose();
              }
            } catch (e) {
              vscode.window.showErrorMessage(`Failed to save token: ${(e as Error).message}`);
            }
            break;
          }
        }
      });
    }
    ModernSidebarProvider.tokenRegistrationPanel.reveal(vscode.ViewColumn.One);
    ModernSidebarProvider.tokenRegistrationPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Replace Token</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1120;color:#f1f5f9;display:flex;align-items:center;justify-content:center}
.container{width:100%;max-width:420px;padding:24px}
.card{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.3)}
h2{font-size:1.25rem;color:#f1f5f9;margin-bottom:6px}
p.sub{color:#94a3b8;font-size:0.85rem;margin-bottom:20px}
.field{margin-bottom:16px}
label{display:block;font-size:0.8rem;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px}
input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #1e293b;background:#0b1120;color:#f1f5f9;font-size:0.9rem;outline:none}
input:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(129,140,248,0.12)}
input[readonly]{opacity:0.6;cursor:not-allowed}
.actions{display:flex;gap:10px;margin-top:24px}
button{flex:1;padding:10px;border-radius:8px;border:none;font-size:0.9rem;font-weight:600;cursor:pointer;transition:opacity 0.2s}
button.primary{background:#818cf8;color:#0b1120}
button.primary:hover{background:#a5b4fc}
button.secondary{background:#1e293b;color:#f1f5f9;border:1px solid #1e293b}
button.secondary:hover{background:#334155}
button:hover{opacity:0.9}
.status{margin-top:16px;font-size:0.85rem;color:#10b981;min-height:1.2em}
.status.error{color:#ef4444}
</style>
</head>
<body>
<div class="container">
<div class="card">
<h2>Replace Token</h2>
<p class="sub">Upgrade or downgrade by replacing your current token</p>
<div class="field">
<label>Current Tier</label>
<input type="text" value="${currentTier || 'Unknown'}" readonly>
</div>
<div class="field">
<label>Current Token</label>
<input type="text" value="${currentToken.substring(0, 12)}..." readonly>
</div>
<div class="field">
<label>New Token</label>
<input type="text" id="newTokenField" placeholder="Paste new JWT or license key">
</div>
<div class="actions">
<button class="secondary" id="cancelBtn">Cancel</button>
<button class="primary" id="replaceBtn">Replace</button>
</div>
<div class="status" id="status"></div>
</div>
</div>
<script nonce="${nonce}">
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
const $ = id => document.getElementById(id);
const statusEl = $('status');
function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}
$('replaceBtn').addEventListener('click', () => {
  const token = $('newTokenField').value.trim();
  if (!token) { setStatus('Enter a new token', true); return; }
  const parts = token.split('.');
  if (parts.length !== 2 && parts.length !== 3) { setStatus('Token must be a JWT or license key', true); return; }
  if (vscode) { vscode.postMessage({ command: 'replaceToken', token }); }
  setStatus('Replacing...');
});
$('cancelBtn').addEventListener('click', () => {
  if (vscode) { vscode.postMessage({ command: 'closePanel' }); }
});
</script>
</body>
</html>`;
  }

  public static openSidebarInBrowserStatic(path = '/') {
    if (ModernSidebarProvider.openInBrowserIfRemote(path)) return;
    const port = getDataServerPort();
    const safePath = path && path !== '/' ? (path.startsWith('/') ? path : '/' + path) : '/dashboard';
    const url = `http://127.0.0.1:${port}${safePath}`;
    const browserMode = getSbConfig().get<string>('browserOpenMode', 'externalBrowser');
    if (browserMode === 'preview') {
      ModernSidebarProvider.openDashboardRouteInBrowser(safePath);
      return;
    }
    if (browserMode === 'simpleBrowser' || browserMode === 'vscodeSimpleBrowser') {
      vscode.commands.executeCommand('simpleBrowser.show', url);
      return;
    }
    vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /** Open the sidebar preview using the configured previewOpenMode. */
  public static openSidebarPreview() {
    const previewMode = getSbConfig().get<string>('previewOpenMode', 'externalBrowser');
    if (previewMode === 'preview') {
      ModernSidebarProvider.openDashboardRouteInBrowser('/dashboard');
      return;
    }
    const port = getDataServerPort();
    const host = ModernSidebarProvider.resolveDashboardHost() || `http://127.0.0.1:${port}`;
    const url = buildDashboardUrl(host, '/dashboard');
    if (previewMode === 'vscodeSimpleBrowser' || previewMode === 'simpleBrowser') {
      vscode.commands.executeCommand('simpleBrowser.show', url);
      return;
    }
    vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /**
   * Phase 3: Push cached license token from secure storage back into the webview on boot.
   */
  public static async rehydrateWebviewSession(webview: vscode.Webview) {
    try {
      const authManager = getAuthManager();
      const storedToken =
        authManager && typeof authManager.getToken === 'function' ? await authManager.getToken() : undefined;
      if (storedToken) {
        ModernSidebarProvider._safePost({ webview }, { command: 'rehydrateCachedSession', token: storedToken });
      }
      // Signed-out state is reconciled once via refreshAuthState; avoid spamming setAuthState on boot.
    } catch (err) {
      ModernSidebarProvider.logRelay(
        'Failed to rehydrate panel session tokens: ' + (err instanceof Error ? err.message : String(err))
      );
    }
  }

  private _view?: vscode.WebviewView;
  private _currentReport: Record<string, unknown> | null = null;
  private _downloads: Array<{ name: string; path: string; time: string }> = [];

  constructor(private readonly _extensionUri: vscode.Uri) {
    ModernSidebarProvider._instance = this;
    ModernSidebarProvider._extensionUri = _extensionUri;
    // Sync data-server theme with VS Code: theme on startup and on changes
    const syncServerTheme = (theme: vscode.ColorTheme) => {
      const kind =
        theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast
          ? 'dark'
          : 'light';
      setTheme(kind);
      ModernSidebarProvider.postThemeToTeamDashboard(kind);
    };
    syncServerTheme(vscode.window.activeColorTheme);
    vscode.window.onDidChangeActiveColorTheme((theme) => syncServerTheme(theme));
  }

  private static logRelay(msg: string) {
    try {
      if (!ModernSidebarProvider.relayOutputChannel) {
        ModernSidebarProvider.relayOutputChannel = vscode.window.createOutputChannel('SimpleBeacon Relay');
      }
      ModernSidebarProvider.relayOutputChannel.appendLine(msg);
    } catch (e) {}
  }

  private static relayCommand(cmd: string) {
    const relayPort = ModernSidebarProvider._relayPort;
    if (!relayPort) {
      return;
    }
    try {
      const payload = JSON.stringify({ command: cmd, source: 'ide' });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: relayPort,
          path: '/api/command',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        () => {}
      );
      req.on('error', () => {});
      req.write(payload);
      req.end();
    } catch (e) {
      ModernSidebarProvider.logRelay('Relay command error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  public static openWelcomeDashboardRoute(extUri: vscode.Uri, route: string) {
    getWelcomeDashboard().createOrShow(extUri, true);
    getWelcomeDashboard().showPaneIfOpen(route || '/dashboard');
  }

  public static showDashboardRoute(extUri: vscode.Uri, route: string) {
    ModernSidebarProvider.openWelcomeDashboardRoute(extUri, route);
  }

  public static async openTeamDashboardPanel(
    _extUri: vscode.Uri,
    route = '/dashboard',
    _panelTitle = 'Team Dashboard'
  ) {
    ModernSidebarProvider.openEmbeddedDashboardRoute(route);
  }

  private resolveWorkspacePath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return targetPath;
    }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (workspace) {
      return path.join(workspace, targetPath);
    }
    return targetPath;
  }

  private resolveDownloadedFilePath(targetPath: string, fileName?: string): string | null {
    if (targetPath && !targetPath.startsWith('browser://')) {
      const resolved = this.resolveWorkspacePath(targetPath);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }
    const name = fileName || (targetPath ? path.basename(String(targetPath).replace(/^browser:\/\/[^?]+/, '')) : '');
    if (!name || !this._extensionUri) {
      return null;
    }
    const downloadsDir = path.join(this._extensionUri.fsPath, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      return null;
    }
    const safeSuffix = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const matches = fs
      .readdirSync(downloadsDir)
      .filter((f) => f === name || f.endsWith(`-${name}`) || f.endsWith(`-${safeSuffix}`) || f.includes(safeSuffix));
    if (matches.length === 0) {
      return null;
    }
    matches.sort((a, b) => {
      const ma = fs.statSync(path.join(downloadsDir, a)).mtimeMs;
      const mb = fs.statSync(path.join(downloadsDir, b)).mtimeMs;
      return mb - ma;
    });
    return path.join(downloadsDir, matches[0]);
  }

  private openDownloadedFile(targetPath: string, fileName?: string, line = 1): void {
    const resolved = this.resolveDownloadedFilePath(targetPath, fileName);
    if (!resolved) {
      vscode.window.showWarningMessage(
        fileName
          ? `Download not found: ${fileName}. It may still be in your OS Downloads folder.`
          : `File not found: ${targetPath || '(empty path)'}`
      );
      return;
    }
    Promise.resolve(vscode.workspace.openTextDocument(resolved))
      .then((doc) => {
        vscode.window.showTextDocument(doc, {
          preview: true,
          selection: new vscode.Range(line - 1, 0, line - 1, 0),
        });
      })
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage('Unable to open file: ' + errMsg);
      });
  }

  /**
   * Detects and corrects suspicious nested duplicate paths such as
   * C:/Users/.../CascadeProjects/CascadeProjects and returns the workspace root.
   */
  private normalizeScanPath(candidatePath: string): string {
    if (!candidatePath) return candidatePath;
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (!workspace) return candidatePath;
    const normalizedCandidate = path.normalize(candidatePath).toLowerCase();
    const normalizedWorkspace = path.normalize(workspace).toLowerCase();
    if (normalizedCandidate === normalizedWorkspace) return candidatePath;
    const candidateBase = path.basename(normalizedCandidate);
    const workspaceBase = path.basename(normalizedWorkspace);
    if (candidateBase === workspaceBase && normalizedCandidate.startsWith(normalizedWorkspace + path.sep)) {
      return workspace;
    }
    return candidatePath;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Guard: extension URI must be available for the sidebar to function
    if (!this._extensionUri) {
      webviewView.webview.html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#c00">
        <h2>SimpleBeacon Sidebar Error</h2>
        <p>Extension URI not available. Please reload the window (Ctrl+Shift+P → Developer: Reload Window).</p>
      </body></html>`;
      return;
    }
    this._view = webviewView;
    registerSidebarView(webviewView);
    // Ensure data-server theme stays in sync whenever webview is shown
    setTheme(vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    try {
      const html = this._getHtmlForWebview(webviewView.webview);
      webviewView.webview.html = html;
      ModernSidebarProvider.logRelay(`Sidebar HTML set: ${html.length} chars`);
      setTheme(getIdeThemeKind());
      ModernSidebarProvider.postThemeToTeamDashboard(getIdeThemeKind());
      // Health-check: if the webview does not post back within 3s, log a warning
      setTimeout(() => {
        webviewView.webview.postMessage({ command: 'pingSidebarHealth' });
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ModernSidebarProvider.logRelay('Sidebar HTML generation error: ' + msg);
      webviewView.webview.html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#c00">
        <h2>SimpleBeacon Sidebar Error</h2>
        <p>Failed to load sidebar content:</p>
        <pre style="background:#f5f5f5;padding:10px;border-radius:4px">${escapeHtml(msg)}</pre>
        <p>Try reloading the window (Ctrl+Shift+P → Developer: Reload Window).</p>
      </body></html>`;
    }

    // Keep sidebar displayMode and scanMode in sync when settings change outside the webview
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('simplebeacon.displayMode') && this._view) {
        const cfg = getSbConfig();
        const currentDisplayMode = cfg.get<string>('displayMode', 'sidebar');
        this._view.webview.postMessage({ command: 'setDisplayMode', value: currentDisplayMode });
      }
      if (e.affectsConfiguration('simplebeacon.scanMode') && this._view) {
        const cfg = getSbConfig();
        const currentScanMode = cfg.get<string>('scanMode', 'workspace');
        this._view.webview.postMessage({ command: 'setScanMode', mode: currentScanMode });
      }
    });
    webviewView.onDidDispose(() => {
      configChangeDisposable.dispose();
    });

    // Restore any previously tracked downloads into the new webview
    this._downloads.forEach((dl) => {
      webviewView.webview.postMessage({
        command: 'addDownloadedFile',
        name: dl.name,
        path: ModernSidebarProvider._displayDownloadPath(dl.path),
        fullPath: dl.path,
        time: dl.time,
      });
    });

    // Phase 3: Rehydrate cached license token from secure storage into the webview on boot
    ModernSidebarProvider.rehydrateWebviewSession(webviewView.webview);
    // Defer refreshAuthState so the webview JS has time to attach its message listener
    setTimeout(() => {
      ModernSidebarProvider.refreshAuthState();
    }, 300);

    // Restore cached code map stats after webview reload (audit data must not overwrite these)
    setTimeout(() => {
      ModernSidebarProvider.pushCodeMapToSidebar(webviewView.webview);
    }, 400);

    // Auto-open main window panel on activation (welcome vs dashboard tab depends on showWelcomeOnLoad)
    setTimeout(() => {
      try {
        getWelcomeDashboard().createOrShow(this._extensionUri, true);
      } catch (e) {
        ModernSidebarProvider.logRelay('Auto open dashboard error: ' + (e instanceof Error ? e.message : String(e)));
      }
    }, 50);

    // Cache browser-ready sidebar HTML so external browser preview and diagnose can report it as loaded
    try {
      this.openDebugPreview(true);
    } catch (e) {
      ModernSidebarProvider.logRelay('Failed to cache sidebar HTML: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Start the relay server in the background so external browser preview is ready
    setTimeout(() => {
      if (!ModernSidebarProvider._relayServer) {
        try {
          this.openSidebarInBrowser(false);
        } catch (e) {
          ModernSidebarProvider.logRelay(
            'Auto-start relay server failed: ' + (e instanceof Error ? e.message : String(e))
          );
        }
      }
    }, 100);

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      if (message.command !== 'getAuthState' && message.command !== 'pongSidebarHealth') {
        ModernSidebarProvider.logRelay(`Sidebar received message: command="${message.command}"`);
      }
      // Forward sidebar commands to browser preview relay server only if it is running
      const relayPort = ModernSidebarProvider._relayPort;
      if (relayPort) {
        try {
          ModernSidebarProvider.logRelay(`Sidebar POST command="${message.command}" to port=${relayPort}`);
          const payload = JSON.stringify({ command: message.command, source: 'ide' });
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: relayPort,
              path: '/api/command',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            },
            (res: http.IncomingMessage) => {
              ModernSidebarProvider.logRelay(`Sidebar POST response status=${res.statusCode}`);
            }
          );
          req.on('error', (err: NodeJS.ErrnoException) => {
            ModernSidebarProvider.logRelay(`Sidebar POST error: ${err.message}`);
          });
          req.write(payload);
          req.end();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          ModernSidebarProvider.logRelay(`Sidebar POST exception: ${msg}`);
        }
      }
      try {
        if (!this._extensionUri) {
          vscode.window.showErrorMessage(
            'SimpleBeacon sidebar not ready — extension URI unavailable. Please reload the window.'
          );
          return;
        }
        switch (message.command) {
          case 'pongSidebarHealth': {
            const payload = message as any;
            ModernSidebarProvider.logRelay(`Sidebar health pong: scriptLoaded=${payload.scriptLoaded}`);
            break;
          }
          case 'scan':
          case 'scanWorkspace': {
            const isWorkspaceScan =
              message.command === 'scanWorkspace' || message.mode === 'workspace' || !message.mode;
            if (isWorkspaceScan) {
              const ws = vscode.workspace.workspaceFolders;
              if (ws && ws.length > 0) {
                // Prefer the active editor's workspace folder over workspaceFolders[0]
                const activeEditor = vscode.window.activeTextEditor;
                const activeWs = activeEditor
                  ? vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
                  : undefined;
                const targetPath = activeWs?.uri?.fsPath ?? ws[0]?.uri?.fsPath;
                if (targetPath) {
                  vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: targetPath });
                } else {
                  vscode.commands.executeCommand('simplebeacon.scanWorkspace');
                }
              } else {
                vscode.commands.executeCommand('simplebeacon.scanWorkspace');
              }
            } else if (message.path) {
              const correctedPath = this.normalizeScanPath(message.path);
              vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: correctedPath });
            }
            ModernSidebarProvider.relayCommand(message.command);
            break;
          }
          case 'browseSidebarScanPath': {
            const uris = await vscode.window.showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              openLabel: 'Select Project Folder',
            });
            if (uris && uris.length > 0) {
              const correctedPath = this.normalizeScanPath(uris[0].fsPath);
              webviewView.webview.postMessage({ command: 'setSidebarScanPath', path: correctedPath });
            }
            break;
          }
          case 'detectSidebarScanPath': {
            const ws = vscode.workspace.workspaceFolders;
            if (ws && ws.length > 0) {
              const detectedPath = ws[0]?.uri?.fsPath;
              if (detectedPath) {
                webviewView.webview.postMessage({ command: 'setSidebarScanPath', path: detectedPath });
              }
            }
            break;
          }
          case 'storeActiveLicenseToken': {
            const { token } = message;
            if (!token) {
              break;
            }
            try {
              await vscode.commands.executeCommand('simplebeacon.storeLicenseToken', token);
              ModernSidebarProvider.setSidebarAuthState(true);
              webviewView.webview.postMessage({ command: 'licenseTokenStored', success: true });
            } catch (error) {
              webviewView.webview.postMessage({
                command: 'licenseTokenStored',
                success: false,
                error: (error as Error).message,
              });
            }
            break;
          }
          case 'updateSidebarScanPath': {
            if (message.path) {
              const correctedPath = this.normalizeScanPath(message.path);
              await getSbConfig().update('projectPath', correctedPath, true);
            }
            break;
          }
          case 'updateSidebarScanMode': {
            await getSbConfig().update('scanMode', message.mode, true);
            break;
          }
          case 'clear':
            vscode.commands.executeCommand('simplebeacon.clearResults');
            ModernSidebarProvider.relayCommand('clear');
            break;
          case 'showDashboard':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openInIde': {
            vscode.commands.executeCommand('simplebeacon-modern.focus');
            getWelcomeDashboard().createOrShow(this._extensionUri, true);
            break;
          }
          case 'openSidebarDebug':
            getWelcomeDashboard().createOrShow(this._extensionUri, true);
            break;
          case 'openCloudInBrowser':
          case 'openCloudInPreview':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openAiToolsInBrowser':
          case 'openAiToolsInPreview':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/aicontext');
            break;
          case 'openAdvancedInBrowser':
          case 'openAdvancedInPreview':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
            break;
          case 'openPreviewInBrowser':
            ModernSidebarProvider.openSidebarPreview();
            break;
          case 'settings':
          case 'openSettings':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showSettingsPane();
            ModernSidebarProvider.relayCommand('openSettings');
            break;
          case 'setServerUrl':
            vscode.commands.executeCommand('simplebeacon.setServerUrl');
            break;
          case 'getServerUrl': {
            const dataPort = getDataServerPort();
            const url = `http://127.0.0.1:${dataPort}`;
            webviewView.webview.postMessage({ command: 'updateServerUrl', url });
            break;
          }
          case 'setDashboardMode': {
            const mode = message.mode === 'website' || message.mode === 'localhost' ? message.mode : null;
            if (!mode) {
              break;
            }
            ModernSidebarProvider._dashboardMode = mode;
            _postSidebarMessage({ command: 'dashboardModeChanged', mode });
            postWebsiteDashboardMessage({ command: 'dashboardModeChanged', mode });
            ModernSidebarProvider.openEmbeddedDashboardRoute('/dashboard');
            break;
          }
          case 'getDashboardMode': {
            _postSidebarMessage({ command: 'dashboardModeChanged', mode: ModernSidebarProvider._dashboardMode });
            break;
          }
          case 'report':
            vscode.commands.executeCommand('simplebeacon.showReport');
            ModernSidebarProvider.relayCommand('showReport');
            break;
          case 'cert':
          case 'certificate':
            vscode.commands.executeCommand('simplebeacon.generateCertificate');
            ModernSidebarProvider.relayCommand('generateCertificate');
            break;
          case 'enhanced':
          case 'analyze':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', {
              path: message.path,
              selectedModules: message.analyzers,
              minSeverity: message.minSeverity,
            });
            ModernSidebarProvider.relayCommand('enhancedAnalysis');
            break;
          case 'realtime':
            vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');
            ModernSidebarProvider.relayCommand('realtimeAnalysis');
            break;
          case 'pattern':
            vscode.commands.executeCommand('simplebeacon.patternDetection');
            ModernSidebarProvider.relayCommand('patternDetection');
            break;
          case 'health':
            vscode.commands.executeCommand('simplebeacon.modelHealth');
            ModernSidebarProvider.relayCommand('modelHealth');
            break;
          case 'codemap':
          case 'codeMap':
            vscode.commands.executeCommand('simplebeacon.showCodeMap');
            ModernSidebarProvider.relayCommand('showCodeMap');
            break;
          case 'dashboard':
          case 'openDashboard':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
            ModernSidebarProvider.relayCommand('dashboard');
            break;
          case 'openReport':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showReportPane();
            ModernSidebarProvider.relayCommand('report');
            break;
          case 'analytics':
            vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
            ModernSidebarProvider.relayCommand('runAdvancedAnalytics');
            break;
          case 'team':
          case 'openTeamDashboard': {
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showTeamPane();
            ModernSidebarProvider.relayCommand('showTeamDashboard');
            this._view?.webview.postMessage({ command: 'switchSidebarTab', tab: 'team' });
            break;
          }
          case 'toggleRealtime':
            vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
            ModernSidebarProvider.relayCommand('toggleRealtimeMonitoring');
            break;
          case 'openBrowser': {
            // Open the live dashboard preview in the extension's webview preview panel
            ModernSidebarProvider.openSidebarInBrowserStatic('/');
            ModernSidebarProvider.relayCommand('openBrowser');
            break;
          }
          case 'upload':
          case 'openUpload':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showUploadPane();
            ModernSidebarProvider.relayCommand('upload');
            break;
          case 'roadmap':
          case 'openRoadmap':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showRoadmapPane();
            ModernSidebarProvider.relayCommand('showRemediationGuide');
            break;
          case 'generateRoadmap':
            vscode.commands.executeCommand('simplebeacon.generateRoadmap');
            ModernSidebarProvider.relayCommand('generateRoadmap');
            break;
          case 'exportRoadmap':
            vscode.commands.executeCommand('simplebeacon.exportRoadmap');
            ModernSidebarProvider.relayCommand('exportRoadmap');
            break;
          case 'openRoadmapHtml':
            vscode.commands.executeCommand('simplebeacon.openRoadmapHtml');
            ModernSidebarProvider.relayCommand('openRoadmapHtml');
            break;
          case 'sendToAi':
            vscode.commands.executeCommand('simplebeacon.sendToAi');
            ModernSidebarProvider.relayCommand('sendToAi');
            break;
          case 'sendToAI':
            {
              const dataPort = getDataServerPort();
              const body = JSON.stringify(message.data || {});
              const req = http.request(
                {
                  hostname: '127.0.0.1',
                  port: dataPort,
                  path: '/api/ai-context',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                },
                (res: http.IncomingMessage) => {
                  res.on('data', () => {
                    /* drain response */
                  });
                  res.on('end', () => {
                    /* data server callback will focus AI Coding Agent panel */
                  });
                }
              );
              req.on('error', (err) => {
                vscode.window.showErrorMessage('Failed to send to AI Coding Agent: ' + err.message);
              });
              req.write(body);
              req.end();
              ModernSidebarProvider.relayCommand('sendToAI');
            }
            break;
          case 'preview':
          case 'openPreview':
            ModernSidebarProvider.openSidebarPreview();
            break;
          case 'sendSidebarToAi':
            vscode.commands.executeCommand('simplebeacon.sendSidebarToAi', message.report);
            break;
          case 'openFile': {
            const targetPath = (message.file || message.path || '') as string;
            const fileName = typeof message.name === 'string' ? message.name : undefined;
            if (!targetPath && !fileName) {
              break;
            }
            if (/^(https?:\/\/|blob:)/.test(targetPath)) {
              vscode.env.openExternal(vscode.Uri.parse(targetPath));
            } else {
              const line = typeof message.line === 'number' && message.line > 0 ? message.line : 1;
              this.openDownloadedFile(targetPath, fileName, line);
            }
            break;
          }
          case 'copyPath': {
            let copyVal = typeof message.path === 'string' ? message.path : '';
            const copyName = typeof message.name === 'string' ? message.name : undefined;
            if (!copyVal || copyVal.startsWith('browser://')) {
              const resolved = this.resolveDownloadedFilePath(copyVal, copyName);
              copyVal = resolved || copyName || copyVal;
            }
            if (copyVal) {
              vscode.env.clipboard.writeText(copyVal);
              showQuietMessage('Path copied to clipboard');
            }
            break;
          }
          case 'openFolder': {
            const folderTarget = message.file || message.path;
            if (!folderTarget) {
              break;
            }
            const resolvedFolder = this.resolveWorkspacePath(folderTarget);
            const dirPath =
              fs.existsSync(resolvedFolder) && fs.statSync(resolvedFolder).isFile()
                ? path.dirname(resolvedFolder)
                : resolvedFolder;
            if (fs.existsSync(dirPath)) {
              vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(dirPath));
            } else {
              vscode.window.showWarningMessage('Folder not found: ' + folderTarget);
            }
            break;
          }
          case 'showInfo':
            if (message.message) {
              vscode.window.showInformationMessage(message.message);
            }
            break;
          case 'loadReportFile': {
            const reportPath = (message.path || '') as string;
            const reportName = typeof message.name === 'string' ? message.name : undefined;
            if (!reportPath && !reportName) {
              break;
            }
            const resolvedPath = this.resolveDownloadedFilePath(reportPath, reportName);
            if (!resolvedPath) {
              vscode.window.showWarningMessage('Report file not found: ' + (reportName || reportPath));
              break;
            }
            try {
              const raw = fs.readFileSync(resolvedPath, 'utf8');
              const report = JSON.parse(raw);
              if (!report || typeof report !== 'object') {
                vscode.window.showWarningMessage('Selected file is not a valid report JSON.');
                break;
              }
              // Update the sidebar itself and push the report into the dashboard preview panel if it is open
              this.updateReport(report);
              try {
                const browserPanel = ModernSidebarProvider.getBrowserPanel();
                if (browserPanel && browserPanel.webview) {
                  browserPanel.webview.postMessage({ command: 'updateReport', report });
                }
              } catch (_) {
                /* preview panel may not be available */
              }
              showQuietMessage(`Loaded report: ${path.basename(resolvedPath)}`);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Failed to load report: ' + errMsg);
            }
            break;
          }
          case 'exportReport':
          case 'exportScanReport':
            Promise.resolve(vscode.commands.executeCommand('simplebeacon.exportReport')).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Export failed: ' + msg);
            });
            break;
          case 'exportDiagnosticLog':
            Promise.resolve(vscode.commands.executeCommand('simplebeacon.exportDiagnosticLog')).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Diagnostic log export failed: ' + msg);
            });
            break;
          case 'openOutputChannel':
            try {
              const ch = vscode.window.createOutputChannel('SimpleBeacon');
              ch.show(true);
            } catch (e) {
              ModernSidebarProvider.logRelay('openOutputChannel failed: ' + (e instanceof Error ? e.message : String(e)));
            }
            break;
          case 'diagnoseSidebar':
            Promise.resolve(vscode.commands.executeCommand('simplebeacon.diagnoseSidebar')).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Diagnose failed: ' + msg);
            });
            break;
          case 'updateDisplayMode':
          case 'updateShowWelcome':
          case 'updateAutoScan':
          case 'updateApiUrl':
          case 'updateBrowserMode': {
            const settingMap: Record<string, { key: string; msgCmd: string; msgField: string }> = {
              updateDisplayMode: { key: 'displayMode', msgCmd: 'setDisplayMode', msgField: 'value' },
              updateShowWelcome: { key: 'showWelcomeOnLoad', msgCmd: 'setShowWelcome', msgField: 'value' },
              updateAutoScan: { key: 'autoScanOnOpen', msgCmd: 'setAutoScan', msgField: 'value' },
              updateApiUrl: { key: 'apiServerUrl', msgCmd: 'updateServerUrl', msgField: 'url' },
              updateBrowserMode: { key: 'browserMode', msgCmd: 'setBrowserMode', msgField: 'value' },
            };
            const meta = settingMap[message.command];
            if (meta) {
              const cfg = getSbConfig();
              cfg.update(meta.key, message.value, true);
              webviewView.webview.postMessage({ command: meta.msgCmd, [meta.msgField]: message.value });
            }
            break;
          }
          case 'refreshSettings': {
            const cfg = getSbConfig();
            const currentDisplayMode = cfg.get<string>('displayMode', 'sidebar');
            const currentScanMode = cfg.get<string>('scanMode', 'workspace');
            const currentProjectPath = this.normalizeScanPath(cfg.get<string>('projectPath', ''));
            webviewView.webview.postMessage({ command: 'setDisplayMode', value: currentDisplayMode });
            webviewView.webview.postMessage({ command: 'setScanMode', mode: currentScanMode });
            webviewView.webview.postMessage({ command: 'setSidebarScanPath', path: currentProjectPath });
            break;
          }
          case 'updateNotifyScan':
          case 'updateNotifyGate': {
            const keyMap: Record<string, string> = {
              updateNotifyScan: 'notifyOnScanComplete',
              updateNotifyGate: 'notifyOnGateFailure',
            };
            const key = keyMap[message.command];
            if (key) {
              getSbConfig().update(key, message.value, true);
            }
            break;
          }
          case 'testConnection': {
            const cfg = getSbConfig();
            const url = normalizeApiServerUrl(cfg.get<string>('apiServerUrl') || 'http://127.0.0.1:55000');
            fetch(url + '/api/health')
              .then(() => {
                showQuietMessage('Connection successful: ' + url);
              })
              .catch(() => {
                vscode.window.showErrorMessage('Connection failed: ' + url);
              });
            break;
          }
          case 'toggleTheme': {
            vscode.commands.executeCommand('workbench.action.toggleLightDarkThemes');
            setTimeout(() => {
              const kind = getIdeThemeKind();
              setTheme(kind);
              ModernSidebarProvider.postThemeToTeamDashboard(kind);
            }, 150);
            break;
          }
          case 'signIn':
          case 'openSigninScreen':
          case 'openSigninPanel':
            ModernSidebarProvider.openSigninPanel();
            break;
          case 'signInViaWebsite':
            ModernSidebarProvider.signInViaWebsite();
            break;
          case 'signOut': {
            ModernSidebarProvider.logRelay('sidebar signOut received, handling directly');
            try {
              let authManager: AuthManager | null = null;
              try {
                authManager = getAuthManager();
              } catch {
                authManager = null;
              }
              const existing =
                authManager && typeof authManager.getToken === 'function' ? await authManager.getToken() : undefined;
              if (authManager && typeof authManager.clearToken === 'function') {
                await authManager.clearToken();
              }
              if (authManager && typeof authManager.clearPassword === 'function') {
                await authManager.clearPassword();
              }
              const browserToken = getBrowserSessionToken();
              clearBrowserSessionToken();
              recordBrowserSignOut(existing);
              recordBrowserSignOut(browserToken);
              // Directly notify the data server so the dashboard detects the sign-out even if the webview fetch is blocked
              try {
                const signoutPort = getDataServerPort();
                await fetch(`http://127.0.0.1:${signoutPort}/api/auth/signout`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
              } catch (e) {}
              if (existing) {
                try {
                  const tracker = ModernSidebarProvider._tracker;
                  if (tracker) {
                    await tracker.recordLogout(existing, 'webview', 'sidebarSignOut');
                  }
                } catch {}
              }
              ModernSidebarProvider._cachedSignedIn = false;
              ModernSidebarProvider._cachedToken = '';
              ModernSidebarProvider.setSidebarAuthState(false, '', '', 'signOut');
              showQuietMessage('Signed out');
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              ModernSidebarProvider.logRelay('sidebar signOut failed: ' + msg);
              vscode.window.showErrorMessage('Sign out failed: ' + msg);
            }
            break;
          }
          case 'openTokenReplacementPanel': {
            const authManager = getAuthManager();
            const token = (await authManager.getToken()) || '';
            const tier = ModernSidebarProvider._cachedTier || '';
            ModernSidebarProvider.openTokenReplacementPanel(this._extensionUri, token, tier);
            break;
          }
          case 'accountEvent': {
            const tracker = ModernSidebarProvider._tracker;
            const token = message.token || '';
            const event = message.event || 'login';
            if (tracker && token) {
              if (event === 'login' || event === 'tokenStored') {
                try {
                  tracker.recordLogin(token, 'webview', 'webviewLogin');
                } catch {}
              } else if (event === 'logout' || event === 'tokenCleared') {
                try {
                  tracker.recordLogout(token, 'webview', 'webviewLogout');
                } catch {}
              }
            }
            break;
          }
          case 'getAuthState':
            ModernSidebarProvider.refreshAuthState();
            break;
          case 'setAuthState': {
            const msg = message as any;
            const signedIn = !!msg.signedIn;
            const token = typeof msg.token === 'string' ? msg.token : '';
            const tier = msg.tier || '';
            const isAdmin = !!msg.isAdmin;
            // Persist sign-in tokens from the sidebar iframe so refreshAuthState can use them as truth.
            // Do not blindly clear on sign-out; let refreshAuthState reconcile against AuthManager/browser token
            // so a stale local-dashboard sign-out cannot wipe a website sign-in.
            try {
              const authManager = getAuthManager();
              if (signedIn && token) {
                await authManager.setToken(token);
                if (typeof msg.userEmail === 'string') {
                  await authManager.setUserEmail(msg.userEmail);
                }
                if (typeof msg.userName === 'string') {
                  await authManager.setUserName(msg.userName);
                }
              }
            } catch {
              /* auth manager may not be initialized */
            }
            ModernSidebarProvider.setSidebarAuthState(signedIn, tier, token, undefined, isAdmin);
            setTimeout(() => ModernSidebarProvider.refreshAuthState(), 50);
            break;
          }
          case 'sidebarError':
            console.error(
              '[Sidebar Webview Error]',
              message.message,
              `(${message.file}:${message.line}:${message.col})`,
              message.stack || ''
            );
            ModernSidebarProvider.logRelay('[Sidebar] ' + String(message.message || ''));
            break;
          case 'toggleOffline': {
            const cfg = getSbConfig();
            const current = cfg.get<boolean>('offlineMode', false);
            cfg.update('offlineMode', !current, true);
            showQuietMessage('Offline mode: ' + (!current ? 'ON' : 'OFF'));
            break;
          }
          case 'openHelp':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openChatbot':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openGitHub':
            vscode.commands.executeCommand('simpleBrowser.show', 'https://github.com/simplebeacon/simplebeacon-vscode');
            break;
          case 'openDocs':
            vscode.commands.executeCommand('simpleBrowser.show', 'https://docs.simplebeacon.dev');
            break;
          case 'openExternalUrl':
            if (message.url) {
              try {
                const parsed = new URL(message.url);
                ['sb_parent_urlbar', 'sb_notify_base', 'sb_api_base', 'sb_website_mode'].forEach((k) =>
                  parsed.searchParams.delete(k)
                );
                vscode.env.openExternal(vscode.Uri.parse(parsed.toString()));
              } catch {
                vscode.env.openExternal(vscode.Uri.parse(message.url));
              }
            }
            break;
          case 'openInSimpleBrowser':
            if (message.url) {
              try {
                const parsed = new URL(message.url);
                // Keep sb_notify_base so audit/roadmap pages can bridge back to the extension.
                ['sb_parent_urlbar', 'sb_api_base', 'sb_website_mode'].forEach((k) => parsed.searchParams.delete(k));
                if (!parsed.searchParams.has('sb_notify_base')) {
                  const port = getDataServerPort();
                  parsed.searchParams.set('sb_notify_base', `http://127.0.0.1:${port}/api`);
                }
                vscode.commands.executeCommand('simpleBrowser.show', parsed.toString());
              } catch {
                vscode.commands.executeCommand('simpleBrowser.show', message.url);
              }
            }
            break;
          case 'openDataServerUrl': {
            const dsPort = getDataServerPort();
            const dataUrl = `http://127.0.0.1:${dsPort}`;
            vscode.env.openExternal(vscode.Uri.parse(dataUrl));
            break;
          }
          case 'openDataServerPath': {
            if (message.path) {
              if (message.path.startsWith('/coming-soon/')) {
                // Use the extension's webview preview so the page can postMessage back to VS Code:
                vscode.commands.executeCommand('simplebeacon.openInPreview', `https://simplebeacon.ai${message.path}`);
              } else {
                const routePath = message.path.replace(/^\/dashboard\/?/, '').replace(/\/$/, '') || 'dashboard';
                ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/' + routePath);
              }
            }
            break;
          }
          case 'openBrowserPath': {
            if (message.path) {
              const host = ModernSidebarProvider.resolveDashboardHost();
              const base = host || `http://127.0.0.1:${getDataServerPort()}`;
              const isRemote = !!host && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(host);
              const localBaseUrl = `http://127.0.0.1:${getDataServerPort()}`;
              const apiBaseQuery = !isRemote ? `sb_api_base=${encodeURIComponent(localBaseUrl + '/api')}&force=1` : '';
              let url = isRemote ? `${base}${message.path}` : buildDashboardUrl(base, message.path, apiBaseQuery);
              if (isRemote) {
                url = appendDashboardEmbedParams(url, `${localBaseUrl}/api`, true);
              }
              if (isWebsiteDashboardPanelOpen() && navigateWebsiteDashboardPanel(url)) {
                break;
              }
              if (isRemote) {
                openWebsiteDashboardPanel(url, 'SimpleBeacon Dashboard');
              } else {
                _openTeamDashboardPanel(this._extensionUri!, message.path, 'Team Dashboard', base, apiBaseQuery);
              }
            }
            break;
          }
          case 'openPricing':
            ModernSidebarProvider.openDashboardRouteInBrowser('/pricing');
            break;
          case 'clearDownloads':
            vscode.commands.executeCommand('simplebeacon.clearDownloads');
            break;
          case 'diagnose': {
            const results: string[] = [];
            // Show "Running..." immediately
            webviewView.webview.postMessage({
              command: 'diagnoseResult',
              lines: ['Running diagnostics...'],
              text: 'Running diagnostics...',
            });

            const relayPort = ModernSidebarProvider._relayPort;
            results.push(`Relay port: ${relayPort || 'NOT STARTED'}`);
            const dataPort = getDataServerPort();
            results.push(`Data server: http://127.0.0.1:${dataPort}`);
            results.push(
              `Dashboard HTML: ${ModernSidebarProvider._dashboardHtml ? 'LOADED (' + ModernSidebarProvider._dashboardHtml.length + ' chars)' : 'SERVED FROM DATA SERVER'}`
            );
            results.push(
              `Sidebar HTML: ${ModernSidebarProvider._sidebarHtml ? 'LOADED (' + ModernSidebarProvider._sidebarHtml.length + ' chars)' : 'MISSING'}`
            );
            results.push(
              `Current report: ${this._currentReport ? 'PRESENT (' + Object.keys(this._currentReport).length + ' keys)' : 'NONE'}`
            );
            results.push(`Webview view: ${this._view ? 'ACTIVE' : 'NOT SET'}`);

            // Dashboard health checks
            const cfg = getSbConfig();
            const displayMode = cfg.get<string>('displayMode', 'sidebar');
            results.push(`Display mode: ${displayMode}`);
            if (displayMode === 'sidebar') {
              results.push(`Dashboard: BLOCKED (displayMode=sidebar prevents WelcomeDashboard from opening)`);
            } else {
              results.push(`Dashboard: OK (displayMode=${displayMode})`);
            }

            // Check media folder exists
            if (!this._extensionUri) {
              webviewView.webview.postMessage({ command: 'doctorResult', results: ['Extension URI not available'] });
              break;
            }
            const mediaPath = path.join(this._extensionUri.fsPath, 'media');
            try {
              const mediaExists = fs.existsSync(mediaPath);
              results.push(`Media folder: ${mediaExists ? 'EXISTS' : 'MISSING'} (${mediaPath})`);
            } catch (e) {
              results.push(`Media folder: ERROR (${e instanceof Error ? e.message : String(e)})`);
            }

            const actualApiUrl = `http://127.0.0.1:${dataPort}`;
            results.push(`API URL: ${actualApiUrl}`);

            // Test API connectivity to actual data server
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port: String(dataPort),
                path: '/api/simplebeacon/status',
                method: 'GET',
                timeout: 3000,
              },
              (res: http.IncomingMessage) => {
                results.push(`API status: HTTP ${res.statusCode}`);
                webviewView.webview.postMessage({ command: 'diagnoseResult', lines: results });
              }
            );
            req.on('error', (err: NodeJS.ErrnoException) => {
              results.push(`API status: UNREACHABLE (${err.message})`);
              webviewView.webview.postMessage({ command: 'diagnoseResult', lines: results });
            });
            req.on('timeout', () => {
              results.push('API status: TIMEOUT');
              webviewView.webview.postMessage({ command: 'diagnoseResult', lines: results });
              req.destroy();
            });
            req.end();
            ModernSidebarProvider.logRelay('Sidebar self-diagnose: ' + results.join('; '));
            break;
          }
          case 'openRefreshRelayPort': {
            try {
              this.restartRelayServer();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              vscode.window.showErrorMessage('Failed to refresh relay port: ' + msg);
            }
            break;
          }
          case 'navDashboard':
          case 'navAnalyze':
          case 'navResults':
          case 'navRepoHealth':
          case 'navAudit':
          case 'navSecurity':
          case 'navQuality':
          case 'navTrust':
          case 'navAssessments':
          case 'navRoadmap':
          case 'navPlatform':
          case 'navProfile':
          case 'navTools':
          case 'navSettings':
          case 'navHelp':
          case 'navChatbot':
          case 'navAbout': {
            const route = ModernSidebarProvider.teamNavRoute(message.command);
            if (route) {
              ModernSidebarProvider.openEmbeddedDashboardRoute(route);
            }
            ModernSidebarProvider.relayCommand(message.command);
            break;
          }
          case 'openAnalyze':
          case 'openCertificate':
          case 'openAiContext':
          case 'openContext':
          case 'openAudit':
          case 'openAuditReport':
          case 'openSecurity':
          case 'openTrust':
          case 'openQuality':
          case 'openAssessments':
          case 'openPlatform':
          case 'openDiagnose':
          case 'openProfile':
          case 'openAbout':
          case 'openAdmin':
          case 'openRepoHealth':
          case 'openAnalytics':
          case 'openTeam':
          case 'openScan':
          case 'openTools': {
            const paneMap: Record<string, string> = {
              openAnalyze: 'showAnalyzePane',
              openCertificate: 'showCertificatePane',
              openAiContext: 'showAiContextPane',
              openContext: 'showAiContextPane',
              openAudit: 'showAuditPane',
              openAuditReport: 'showReportPane',
              openSecurity: 'showSecurityPane',
              openTrust: 'showTrustPane',
              openQuality: 'showQualityPane',
              openAssessments: 'showAssessmentsPane',
              openPlatform: 'showPlatformPane',
              openDiagnose: 'showScanPane',
              openProfile: 'showProfilePane',
              openAbout: 'showDashboardPane',
              openAdmin: 'showSettingsPane',
              openRepoHealth: 'showRepoHealthPane',
              openAnalytics: 'showAnalyticsPane',
              openTeam: 'showTeamPane',
              openScan: 'showScanPane',
              openTools: 'showSettingsPane',
            };
            const routeMap: Record<string, string> = {
              openAnalyze: '/analyze',
              openCertificate: '/certificate',
              openAiContext: '/aicontext',
              openContext: '/aicontext',
              openAudit: '/audit',
              openAuditReport: '/results',
              openSecurity: '/security',
              openTrust: '/trust',
              openQuality: '/quality',
              openAssessments: '/assessments',
              openPlatform: '/platform',
              openDiagnose: '/scan',
              openProfile: '/profile',
              openAbout: '/about',
              openAdmin: '/settings',
              openRepoHealth: '/repository-health',
              openAnalytics: '/analytics',
              openTeam: '/team',
              openScan: '/scan',
              openTools: '/tools',
            };
            const panel = getWelcomeDashboard().createOrShow(this._extensionUri, true);
            if (panel) {
              const method = paneMap[message.command];
              if (method && typeof (panel as any)[method] === 'function') {
                (panel as any)[method]();
              } else {
                getWelcomeDashboard().showPaneIfOpen(routeMap[message.command] || '/dashboard');
              }
            }
            ModernSidebarProvider.relayCommand(message.command);
            break;
          }
          case 'openReportHtml':
          case 'generateCertificate':
          case 'exportCertificatePdf':
          case 'openCertificateHtml':
          case 'generateCodeMap':
          case 'openCodeMapHtml':
          case 'exportCodeMap': {
            const cmdMap: Record<string, string> = {
              openReportHtml: 'simplebeacon.openReportHtml',
              generateCertificate: 'simplebeacon.generateCertificate',
              exportCertificatePdf: 'simplebeacon.exportCertificatePdf',
              openCertificateHtml: 'simplebeacon.openCertificateHtml',
              generateCodeMap: 'simplebeacon.generateCodeMap',
              openCodeMapHtml: 'simplebeacon.openCodeMapHtml',
              exportCodeMap: 'simplebeacon.exportCodeMap',
            };
            const cmd = cmdMap[message.command];
            if (cmd) {
              vscode.commands.executeCommand(cmd);
            }
            break;
          }
          case 'openCodeMap':
            vscode.commands.executeCommand('simplebeacon-modern.focus');
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showCodeMapPane();
            vscode.commands.executeCommand('simplebeacon-codemap-tree.focus');
            break;
          case 'refreshCodeMap':
            showQuietMessage('Refreshing code map data…');
            vscode.commands.executeCommand('simplebeacon.generateCodeMap');
            break;
          case 'openRoadmapUrl':
          case 'openAuditUrl':
          case 'openPricingUrl':
          case 'openTeamDashboardUrl': {
            if (message.url) {
              const labelMap: Record<string, string> = {
                openRoadmapUrl: 'Roadmap',
                openAuditUrl: 'Audit',
                openPricingUrl: 'Pricing',
                openTeamDashboardUrl: 'Team Dashboard',
              };
              let url = message.url;
              // Canonicalize legacy /coming-soon/*.html URLs to live marketing routes.
              const PUBLIC_URL = process.env.PUBLIC_APP_URL || 'https://simplebeacon.ai';
              const RENDER_URL = process.env.LEGACY_RENDER_URL || 'https://cascadeprojects-yzzd.onrender.com';
              const legacyMap: Record<string, string> = {
                [`${RENDER_URL}/coming-soon/roadmap.html`]: `${PUBLIC_URL}/roadmap`,
                [`${RENDER_URL}/coming-soon/audit.html`]: `${PUBLIC_URL}/audit`,
                [`${RENDER_URL}/coming-soon/pricing.html`]: `${PUBLIC_URL}/pricing`,
                [`${PUBLIC_URL}/coming-soon/roadmap.html`]: `${PUBLIC_URL}/roadmap`,
                [`${PUBLIC_URL}/coming-soon/audit.html`]: `${PUBLIC_URL}/audit`,
                [`${PUBLIC_URL}/coming-soon/pricing.html`]: `${PUBLIC_URL}/pricing`,
                [`${PUBLIC_URL}/dashboard/roadmap`]: `${PUBLIC_URL}/roadmap`,
                [`${PUBLIC_URL}/dashboard/audit`]: `${PUBLIC_URL}/audit`,
                [`${PUBLIC_URL}/dashboard/pricing`]: `${PUBLIC_URL}/pricing`,
              };
              if (legacyMap[url]) {
                url = legacyMap[url];
              }
              try {
                const parsedDash = new URL(url);
                const dashPath = parsedDash.pathname || '';
                if (dashPath === '/dashboard' || dashPath.startsWith('/dashboard/')) {
                  let route = dashPath.replace(/^\/dashboard\/?/, '');
                  if (!route || route === '/') {
                    route = '/dashboard';
                  } else {
                    route = '/dashboard' + (route.startsWith('/') ? route : '/' + route);
                  }
                  ModernSidebarProvider.openEmbeddedDashboardRoute(route);
                  break;
                }
              } catch {
                /* not a dashboard URL — fall through to preview */
              }
              const host = ModernSidebarProvider.resolveDashboardHost();
              const websiteMode = ModernSidebarProvider.getDashboardMode() === 'website';
              const isLocalHost = !host || /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(host || '');
              if (isLocalHost && !websiteMode && url.startsWith('https://simplebeacon.ai/')) {
                const localBase = `http://127.0.0.1:${getDataServerPort()}`;
                const localMap: Record<string, string> = {
                  'https://simplebeacon.ai/roadmap': `${localBase}/coming-soon/roadmap.html`,
                  'https://simplebeacon.ai/audit': `${localBase}/coming-soon/audit.html`,
                  'https://simplebeacon.ai/pricing': `${localBase}/coming-soon/pricing.html`,
                  'https://simplebeacon.ai/dashboard': `${localBase}/dashboard`,
                  'https://simplebeacon.ai/dashboard/': `${localBase}/dashboard`,
                };
                const normalized = url.replace(/\/$/, '');
                url = localMap[url] || localMap[normalized] || localMap[normalized + '/'] || url;
              }
              vscode.commands.executeCommand('simplebeacon.openUrlInPreview', url, labelMap[message.command] || '');
            }
            break;
          }
          case 'runAudit':
          case 'runSecurity':
          case 'runTrust':
          case 'runQuality':
            vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            ModernSidebarProvider.relayCommand(message.command);
            break;
          case 'getAuditData':
            {
              const data = getWelcomeDashboard().getLastReportData ? getWelcomeDashboard().getLastReportData() : null;
              if (data && this._view) {
                this._view.webview.postMessage({ command: 'updateAuditData', ...data });
              }
            }
            break;
          case 'getCodeMap':
            ModernSidebarProvider.pushCodeMapToSidebar(this._view?.webview);
            break;
          case 'getRoadmapData':
            ModernSidebarProvider.pushRoadmapToSidebar(this._view?.webview);
            break;
          case 'openSecurityAuditPage':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showSecurityPane();
            break;
          case 'openTrustPage':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showTrustPane();
            break;
          case 'openCompliance':
            getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showCompliancePane();
            break;
          case 'bridgeFetch': {
            const bfMsg = message as SidebarMessage & {
              url?: string;
              requestId?: string;
              init?: { method?: string; headers?: Record<string, string>; body?: string };
            };
            const bfUrl = bfMsg.url || '';
            const bfReqId = bfMsg.requestId || '';
            if (!bfUrl || !bfReqId) break;
            try {
              const parsed = new URL(bfUrl);
              if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
                webviewView.webview.postMessage({
                  command: 'bridgeFetchResponse',
                  requestId: bfReqId,
                  error: 'Only localhost URLs allowed',
                });
                break;
              }
              const reqOpts: http.RequestOptions = {
                hostname: parsed.hostname,
                port: parsed.port || '80',
                path: parsed.pathname + parsed.search,
                method: bfMsg.init?.method || 'GET',
                headers: bfMsg.init?.headers || {},
                timeout: 20000,
              };
              const req = http.request(reqOpts, (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                  const body = Buffer.concat(chunks).toString('utf8');
                  const contentType = res.headers['content-type'] || 'application/json';
                  webviewView.webview.postMessage({
                    command: 'bridgeFetchResponse',
                    requestId: bfReqId,
                    status: res.statusCode || 200,
                    contentType,
                    body,
                  });
                });
              });
              req.on('error', (err: NodeJS.ErrnoException) => {
                webviewView.webview.postMessage({
                  command: 'bridgeFetchResponse',
                  requestId: bfReqId,
                  error: err.message,
                });
              });
              req.on('timeout', () => {
                req.destroy();
                webviewView.webview.postMessage({
                  command: 'bridgeFetchResponse',
                  requestId: bfReqId,
                  error: 'Request timeout',
                });
              });
              if (bfMsg.init?.body) {
                req.write(bfMsg.init.body);
              }
              req.end();
            } catch (err: unknown) {
              webviewView.webview.postMessage({
                command: 'bridgeFetchResponse',
                requestId: bfReqId,
                error: (err as Error).message,
              });
            }
            break;
          }
          case 'openClear':
          case 'openToggleMonitor':
          case 'openSendToAIAgent':
          case 'openEnhancedAnalysis':
          case 'openRealtimeAnalysis':
          case 'openPatternDetection':
          case 'openModelHealth':
          case 'openScanWorkspace': {
            const cmdMap: Record<string, string> = {
              openClear: 'simplebeacon.clearResults',
              openToggleMonitor: 'simplebeacon.toggleRealtimeMonitoring',
              openSendToAIAgent: 'simplebeacon.sendToAi',
              openEnhancedAnalysis: 'simplebeacon.enhancedAnalysis',
              openRealtimeAnalysis: 'simplebeacon.realtimeAnalysis',
              openPatternDetection: 'simplebeacon.patternDetection',
              openModelHealth: 'simplebeacon.modelHealth',
              openScanWorkspace: 'simplebeacon.scanWorkspace',
            };
            const cmd = cmdMap[message.command];
            if (cmd) {
              vscode.commands.executeCommand(cmd);
            }
            break;
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          'SimpleBeacon sidebar error: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    if (!this._extensionUri) {
      throw new Error('Extension URI not available');
    }
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = webview.cspSource;
    // Inline sidebar-main.js to avoid external script loading failures in the webview
    const sidebarMainJsPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar-main.js').fsPath;
    let sidebarMainJsContent = '';
    try {
      sidebarMainJsContent = fs.readFileSync(sidebarMainJsPath, 'utf8');
    } catch (e) {
      ModernSidebarProvider.logRelay('Failed to read sidebar-main.js: ' + (e instanceof Error ? e.message : String(e)));
    }
    const sbConfig = getSbConfig();
    const showWelcome = sbConfig.get('showWelcomeOnLoad', false);
    const displayMode = sbConfig.get('displayMode', 'sidebar') as string;
    const autoScan = sbConfig.get('autoScanOnOpen', false);
    const apiUrl = String(sbConfig.get('apiServerUrl', '') || '');
    const savedScanMode = sbConfig.get<string>('scanMode', 'workspace');
    const savedProjectPath = sbConfig.get<string>('projectPath', '');
    const isWorkspaceMode = savedScanMode === 'workspace';
    const dataServerUrl = `http://127.0.0.1:${getDataServerPort()}`;
    const ideTheme = getIdeThemeKind();
    const apiUrlScript = apiUrl
      ? `<script nonce="${nonce}">window.__SB_API_URL__=${JSON.stringify(apiUrl)};</script>`
      : '';
    const dataServerUrlScript = `<script nonce="${nonce}">window.__SB_DATA_SERVER_URL__=${JSON.stringify(dataServerUrl)};</script>`;
    return `<!DOCTYPE html>
<html lang="en" data-theme="${ideTheme}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp}; frame-src ${csp}; connect-src ${csp} http://127.0.0.1:*;">
${dataServerUrlScript}${apiUrlScript}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  margin: 0;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 13px;
  color: var(--vscode-sideBar-foreground, var(--vscode-foreground, #ccc));
  background: var(--vscode-sideBar-background, var(--vscode-editor-background, #252526));
  padding: 0;
  overflow-y: auto;
  height: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(128,128,128,0.3) transparent;
  position: relative;
}
body::-webkit-scrollbar { width: 8px; }
body::-webkit-scrollbar-track { background: transparent; }
body::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.4); border-radius: 4px; }
body::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.6); }
.tab-pane.active::-webkit-scrollbar { width: 6px; }
.tab-pane.active::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
  background: var(--vscode-sideBar-background, linear-gradient(135deg, #0b1120 0%, #111827 100%));
  flex-shrink: 0;
}
.header-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--sb-primary, #818cf8) 0%, var(--sb-primary-hover, #a5b4fc) 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(129,140,248,0.3);
  color: var(--sb-text-inverse, #0b1120);
}
.header-text { display: flex; flex-direction: column; }
.header-title { font-size: 15px; font-weight: 700; color: var(--vscode-foreground, #fff); letter-spacing: 0.2px; }
.header-subtitle { font-size: 11px; color: var(--vscode-descriptionForeground, #858585); margin-top: 2px; }
.header-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.header-theme-toggle {
  background: transparent;
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--vscode-foreground, #ccc);
  padding: 0;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.header-theme-toggle:hover {
  background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.08));
  border-color: var(--vscode-panel-border, rgba(255,255,255,0.2));
}
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 8px 12px;
  border-radius: 10px;
  background: var(--vscode-input-background, rgba(255,255,255,0.03));
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.card:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06)); border-color: var(--vscode-focusBorder, rgba(255,255,255,0.12)); transform: translateY(-1px); }
.card-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.card-icon.ok { background: rgba(59,165,93,0.12); color: #89d185; }
.card-icon.server { background: rgba(14,165,233,0.12); color: #38bdf8; }
.card-text { display: flex; flex-direction: column; }
.card-label { font-size: 10px; color: var(--vscode-descriptionForeground, #858585); text-transform: uppercase; letter-spacing: 0.5px; }
.card-value { font-size: 12px; color: var(--vscode-foreground, #ccc); font-weight: 500; margin-top: 2px; }
.settings-section { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground, #858585); margin: 14px 12px 8px; }
.settings-btn-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 8px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0,122,204,0.15) 0%, rgba(0,122,204,0.08) 100%);
  border: 1px solid rgba(0,122,204,0.25);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--vscode-foreground, #ccc);
}
.settings-btn-card:hover { background: linear-gradient(135deg, rgba(0,122,204,0.25) 0%, rgba(0,122,204,0.15) 100%); border-color: rgba(0,122,204,0.4); transform: translateY(-1px); }
.settings-btn-card .icon { font-size: 18px; }
/* Tab bar slider */
.tab-bar{display:flex;align-items:center;gap:0;padding:0 12px;border-bottom:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));background:var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.02));overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(128,128,128,0.3) transparent;}
.tab-bar::-webkit-scrollbar{height:6px;}
.tab-bar::-webkit-scrollbar-track{background:transparent;}
.tab-bar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:3px;}
.tab-bar::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.35);}
.tab-item{position:relative;display:flex;align-items:center;gap:6px;padding:10px 14px;font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground,#858585);cursor:pointer;white-space:nowrap;user-select:none;transition:color .2s,border-color .2s;border:none;background:transparent;border-bottom:2px solid transparent;}
.tab-item:hover{color:var(--vscode-foreground,#ccc);border-bottom-color:var(--vscode-panel-border, rgba(255,255,255,0.08));}
.tab-item.active{color:var(--vscode-foreground,#fff);border-bottom-color:var(--vscode-button-background,#0e639c);}
.tab-action{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:6px;font-size:11px;font-weight:600;color:var(--vscode-foreground,#ccc);cursor:pointer;white-space:nowrap;user-select:none;background:var(--vscode-button-secondaryBackground,#2d2d30);border:1px solid var(--vscode-panel-border,#3c3c3c);transition:all .15s;}
.tab-action:hover{background:var(--vscode-button-hoverBackground,#3c3c3c);border-color:var(--vscode-focusBorder,#007acc);transform:translateY(-1px);}
.tab-action .icon{font-size:14px;}
.tab-pane{display:none;}
.tab-pane.active{display:block;overflow-y:auto;max-height:calc(100vh - 90px);padding-bottom:12px;}
.hidden{display:none !important;}
.sidebar-kpi-view-report { padding: 0 12px 8px; }
.sidebar-view-report-btn { width: 100%; justify-content: center; font-size: 12px; }
/* Sidebar tab bar (compact, icon + label) */
.sidebar-tab-bar{display:flex;align-items:center;gap:0;padding:0 8px;border-bottom:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));background:var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.02));overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(128,128,128,0.3) transparent;}
.sidebar-tab-bar::-webkit-scrollbar{height:5px;}
.sidebar-tab-bar::-webkit-scrollbar-track{background:transparent;}
.sidebar-tab-bar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:3px;}
.sidebar-tab-item{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 10px;font-size:10px;font-weight:600;color:var(--vscode-descriptionForeground,#858585);cursor:pointer;white-space:nowrap;user-select:none;transition:color .2s,border-color .2s;background:transparent;border:none;border-bottom:2px solid transparent;flex:1;min-width:48px;}
.sidebar-tab-item:hover{color:var(--vscode-foreground,#ccc);border-bottom-color:var(--vscode-panel-border, rgba(255,255,255,0.08));}
.sidebar-tab-item.active{color:var(--vscode-foreground,#fff);border-bottom-color:var(--vscode-button-background,#0e639c);}
.sidebar-tab-icon{font-size:14px;line-height:1;}
[data-sidebar-tab]{transition:opacity 0.15s ease;}
[data-sidebar-tab].hidden{display:none !important;}
.sidebar-tab-pane{display:none;}
.sidebar-tab-pane.active{display:block;}
.sidebar-tab-section{display:none;}
.sidebar-tab-section.active{display:block;}
/* Dashboard */
.db-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 0;}
.db-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground,#858585);}
.db-actions{display:flex;align-items:center;gap:8px;}
.db-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;background:rgba(59,130,246,0.15);color:#60a5fa;font-size:10px;font-weight:700;}
.db-btn{padding:4px 10px;border-radius:6px;background:var(--vscode-button-secondaryBackground, rgba(255,255,255,0.05));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));color:var(--vscode-foreground,#ccc);font-size:11px;cursor:pointer;}
.db-summary-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;}
.db-summary-cards .card{display:flex;align-items:center;gap:10px;padding:12px;}
.db-summary-cards .card-icon{flex-shrink:0;}
.db-scores{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;}
.db-score-card{background:var(--vscode-input-background, rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));border-radius:12px;padding:18px;text-align:center;position:relative;overflow:hidden;}
.db-score-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#60a5fa,#818cf8);border-radius:12px 0 0 12px;}
.db-score-card.issues::before{background:linear-gradient(180deg,#a78bfa,#c084fc);}
.db-score-val{font-size:32px;font-weight:800;color:var(--vscode-foreground,#fff);line-height:1;}
.db-score-label{font-size:10px;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:1px;margin-top:6px;}
.db-sev-row{display:flex;align-items:center;justify-content:space-between;padding:0 14px 8px;}
.db-sev-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;}
.db-sev-dot.crit{background:#ef4444;}
.db-sev-dot.high{background:#f59e0b;}
.db-sev-dot.med{background:#3b82f6;}
.db-sev-dot.low{background:#22c55e;}
.db-sev-label{font-size:10px;color:var(--vscode-descriptionForeground,#858585);}
.db-sev-val{font-size:10px;font-weight:600;}
.db-sev-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px 12px;}
.db-sev-card{background:var(--vscode-input-background, rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));border-radius:10px;padding:14px 6px;text-align:center;border-top:3px solid #ef4444;}
.db-sev-card.high{border-top-color:#f59e0b;}
.db-sev-card.med{border-top-color:#3b82f6;}
.db-sev-card.low{border-top-color:#22c55e;}
.db-sev-count{font-size:22px;font-weight:800;}
.db-sev-count.crit{color:#ef4444;}
.db-sev-count.high{color:#f59e0b;}
.db-sev-count.med{color:#3b82f6;}
.db-sev-count.low{color:#22c55e;}
.db-sev-name{font-size:9px;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;}
.db-info{padding:0 14px 12px;}
.db-info-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));font-size:12px;}
.db-info-row:last-child{border-bottom:none;}
.db-info-label{color:var(--vscode-foreground,#ccc);}
.db-info-val{font-weight:700;color:var(--vscode-foreground,#fff);}
/* Downloads */
.dl-section{padding:0 14px 12px;}
.dl-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.dl-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground,#858585);}
.dl-clear{font-size:10px;color:#60a5fa;cursor:pointer;}
.dl-clear:hover{color:#93c5fd;}
.dl-list{display:flex;flex-direction:column;gap:6px;}
.dl-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background, rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));font-size:12px;}
.dl-item-name{color:var(--vscode-foreground,#ccc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}
.dl-item-path{color:#888;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}
.dl-actions{display:flex;gap:6px;}
.dl-btn{padding:3px 8px;border-radius:4px;background:var(--vscode-button-secondaryBackground, rgba(255,255,255,0.05));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));color:var(--vscode-foreground,#ccc);font-size:10px;cursor:pointer;}
.dl-btn:hover{background:var(--vscode-button-hoverBackground, rgba(255,255,255,0.08));}
.dl-empty{text-align:center;padding:12px;color:#555;font-size:12px;}
/* Tab content cards */
.tc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 12px 12px;}
.tc-card{background:var(--vscode-input-background, rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));border-radius:10px;padding:14px;text-align:center;transition:all .2s;cursor:pointer;}
.tc-card:hover{background:var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));transform:translateY(-1px);}
.tc-card-val{font-size:20px;font-weight:800;color:var(--vscode-foreground,#fff);line-height:1;}
.tc-card-val.green{color:#22c55e;}
.tc-card-val.red{color:#ef4444;}
.tc-card-val.amber{color:#f59e0b;}
.tc-card-val.blue{color:#60a5fa;}
.tc-card-val.purple{color:#a78bfa;}
.tc-card-label{font-size:9px;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;}
.tc-list{padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;}
.tc-list-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background, rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));font-size:12px;cursor:pointer;transition:all .15s;}
.tc-list-item:hover{background:var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));}
#tdSignInSidebar{background:rgba(99,102,241,0.08) !important;border-color:rgba(99,102,241,0.25) !important;}
#tdSignInSidebar:hover{background:rgba(99,102,241,0.14) !important;}
.tc-list-item-left{display:flex;align-items:center;gap:8px;}
.tc-list-dot{width:6px;height:6px;border-radius:50%;}
.tc-list-dot.green{background:#22c55e;}
.tc-list-dot.amber{background:#f59e0b;}
.tc-list-dot.red{background:#ef4444;}
.tc-list-dot.blue{background:#60a5fa;}
.tc-list-dot.purple{background:#a78bfa;}
.tc-list-name{color:var(--vscode-foreground,#ccc);font-size:11px;}
.tc-list-meta{color:#888;font-size:10px;}
.tc-actions{display:flex;flex-direction:column;gap:6px;padding:0 12px 12px;}
.tc-action-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--vscode-foreground,#ccc);font-size:11px;cursor:pointer;transition:all .15s;}
.tc-action-btn:hover{background:rgba(255,255,255,0.06);}
.tc-action-btn .icon{font-size:13px;}
.tc-status{display:flex;align-items:center;gap:6px;padding:0 12px 12px;}
.tc-status-badge{padding:4px 10px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(34,197,94,0.12);color:#22c55e;}
.tc-status-badge.amber{background:rgba(245,158,11,0.12);color:#f59e0b;}
.tc-status-badge.red{background:rgba(239,68,68,0.12);color:#ef4444;}
.tc-progress{width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-top:4px;overflow:hidden;}
.tc-progress-bar{height:100%;background:linear-gradient(90deg,#60a5fa,#818cf8);border-radius:2px;transition:width .3s;}
.tc-progress-bar.green{background:linear-gradient(90deg,#22c55e,#4ade80);}
.tc-progress-bar.amber{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
.tc-progress-bar.red{background:linear-gradient(90deg,#ef4444,#f87171);}
/* Tab section headers */
.tab-section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground,#858585);margin:14px 12px 8px;}
.tab-section:first-child{margin-top:8px;}
/* Website-sync grouped nav sections — mirrors /app/ sidebar nav-link styling */
.sb-nav-section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--sb-text-muted,#94a3b8);margin:14px 12px 6px;padding:0 4px;}
.sb-nav-section:first-child{margin-top:8px;}
.sb-nav-items{display:flex;flex-direction:column;gap:1px;padding:0 4px;}
.sb-nav-item{position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;margin:0;border-radius:8px;background:transparent;border:none;color:var(--sb-text-secondary,#94a3b8);font-size:12px;font-weight:500;cursor:pointer;transition:background .18s,color .18s;box-sizing:border-box;text-align:left;font-family:inherit;}
.sb-nav-item:hover{background:var(--sb-surface-hover,#1e293b);color:var(--sb-text-primary,#f1f5f9);}
.sb-nav-item:active{transform:scale(0.99);}
.sb-nav-item.sb-nav-item--accent{color:var(--sb-primary,#818cf8);}
.sb-nav-item.sb-nav-item--accent:hover{background:var(--sb-primary-subtle,rgba(129,140,248,0.12));color:var(--sb-primary,#818cf8);}
.sb-nav-item svg{flex-shrink:0;color:currentColor;opacity:0.85;}
.sb-nav-item .sb-nav-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sb-nav-item .sb-nav-external{opacity:0.5;font-size:10px;margin-left:auto;}
.sb-nav-divider{height:1px;background:var(--sb-border,#1e293b);margin:10px 12px;border:none;}
/* Quick links */
.quick-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 12px;}
.ql-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--vscode-foreground,#ccc);font-size:12px;cursor:pointer;transition:all .2s;}
.ql-btn:hover{background:rgba(255,255,255,0.06);}
/* Analysis tab redesign */
.analyze-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 0;}
.analyze-title{font-size:16px;font-weight:700;color:var(--vscode-foreground,#fff);}
.analyze-subtitle{font-size:11px;color:var(--vscode-descriptionForeground,#858585);margin-top:2px;}
.analyze-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 12px 12px;}
.analyze-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px;border-radius:10px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
.analyze-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#818cf8);border-radius:10px 10px 0 0;}
.analyze-card.accent-green::before{background:linear-gradient(90deg,#22c55e,#4ade80);}
.analyze-card.accent-amber::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
.analyze-card.accent-purple::before{background:linear-gradient(90deg,#a855f7,#c084fc);}
.analyze-card.accent-blue::before{background:linear-gradient(90deg,#3b82f6,#60a5fa);}
.analyze-card.accent-red::before{background:linear-gradient(90deg,#ef4444,#f87171);}
.analyze-card:hover{background:var(--vscode-list-hoverBackground,rgba(255,255,255,0.06));transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.15);}
.analyze-card:active{transform:translateY(0);}
.analyze-card-icon{width:32px;height:32px;border-radius:8px;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;color:#818cf8;}
.analyze-card.accent-green .analyze-card-icon{background:rgba(34,197,94,0.12);color:#4ade80;}
.analyze-card.accent-amber .analyze-card-icon{background:rgba(245,158,11,0.12);color:#fbbf24;}
.analyze-card.accent-purple .analyze-card-icon{background:rgba(168,85,247,0.12);color:#c084fc;}
.analyze-card.accent-blue .analyze-card-icon{background:rgba(59,130,246,0.12);color:#60a5fa;}
.analyze-card.accent-red .analyze-card-icon{background:rgba(239,68,68,0.12);color:#f87171;}
.analyze-card-label{font-size:12px;font-weight:600;color:var(--vscode-foreground,#fff);}
.analyze-card-desc{font-size:10px;color:var(--vscode-descriptionForeground,#858585);line-height:1.4;}
.analyze-section-title{display:flex;align-items:center;gap:6px;padding:8px 12px 6px;font-size:10px;font-weight:700;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:0.8px;}
.analyze-section-title svg{color:var(--vscode-descriptionForeground,#858585);}
.analyze-list{padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;}
.analyze-list-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));cursor:pointer;transition:all .2s;}
.analyze-list-item:hover{background:var(--vscode-list-hoverBackground,rgba(255,255,255,0.06));}
.analyze-list-item:active{transform:translateY(1px);}
.analyze-list-item-icon{width:28px;height:28px;border-radius:6px;background:rgba(99,102,241,0.1);display:flex;align-items:center;justify-content:center;color:#818cf8;flex-shrink:0;}
.analyze-list-item-text{flex:1;}
.analyze-list-item-label{font-size:12px;font-weight:500;color:var(--vscode-foreground,#ccc);}
.analyze-list-item-desc{font-size:10px;color:var(--vscode-descriptionForeground,#858585);}
/* Report tab redesign */
.report-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 0;}
.report-title{font-size:16px;font-weight:700;color:var(--vscode-foreground,#fff);}
.report-subtitle{font-size:11px;color:var(--vscode-descriptionForeground,#858585);margin-top:2px;}
.report-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;background:rgba(34,197,94,0.18);color:#4ade80;}
.report-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 12px 12px;}
.report-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px;border-radius:10px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));cursor:default;transition:all .2s;position:relative;overflow:hidden;text-align:center;}
.report-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:10px 10px 0 0;}
.report-card.accent-green::before{background:linear-gradient(90deg,#22c55e,#4ade80);}
.report-card.accent-amber::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
.report-card.accent-red::before{background:linear-gradient(90deg,#ef4444,#f87171);}
.report-card.accent-purple::before{background:linear-gradient(90deg,#a855f7,#c084fc);}
.report-card-icon{width:28px;height:28px;border-radius:6px;background:rgba(59,130,246,0.12);display:flex;align-items:center;justify-content:center;color:#60a5fa;}
.report-card.accent-green .report-card-icon{background:rgba(34,197,94,0.12);color:#4ade80;}
.report-card.accent-amber .report-card-icon{background:rgba(245,158,11,0.12);color:#fbbf24;}
.report-card.accent-red .report-card-icon{background:rgba(239,68,68,0.12);color:#f87171;}
.report-card.accent-purple .report-card-icon{background:rgba(168,85,247,0.12);color:#c084fc;}
.report-card-value{font-size:22px;font-weight:800;line-height:1;}
.report-card-value.blue{color:#60a5fa;}
.report-card-value.green{color:#4ade80;}
.report-card-value.amber{color:#fbbf24;}
.report-card-value.red{color:#f87171;}
.report-card-value.purple{color:#c084fc;}
.report-card-label{font-size:9px;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:0.5px;}
.report-sev-row{display:flex;align-items:center;gap:8px;padding:0 12px 8px;}
.report-sev-label{width:50px;font-size:10px;color:var(--vscode-descriptionForeground,#858585);text-align:right;text-transform:uppercase;}
.report-sev-bar-wrap{flex:1;height:8px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border-radius:4px;overflow:hidden;}
.report-sev-bar{height:100%;border-radius:4px;transition:width .4s ease;}
.report-sev-bar.critical{background:linear-gradient(90deg,#ef4444,#f87171);}
.report-sev-bar.high{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
.report-sev-bar.medium{background:linear-gradient(90deg,#3b82f6,#60a5fa);}
.report-sev-bar.low{background:linear-gradient(90deg,#22c55e,#4ade80);}
.report-sev-val{width:24px;font-size:10px;font-weight:600;text-align:right;}
.report-sev-val.critical{color:#f87171;}
.report-sev-val.high{color:#fbbf24;}
.report-sev-val.medium{color:#60a5fa;}
.report-sev-val.low{color:#4ade80;}
.report-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 12px;}
.report-action-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px;border-radius:8px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));color:var(--vscode-foreground,#ccc);font-size:11px;cursor:pointer;transition:all .2s;}
.report-action-btn:hover{background:var(--vscode-list-hoverBackground,rgba(255,255,255,0.06));transform:translateY(-1px);}
.report-action-btn:active{transform:translateY(0);}
.report-action-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;}
.report-info{padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;}
.report-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));}
.report-info-label{font-size:10px;color:var(--vscode-descriptionForeground,#858585);}
.report-info-value{font-size:11px;color:var(--vscode-foreground,#ccc);font-weight:500;}
/* Menu list items (Analyze tab, etc) */
.menu-list-item{display:flex;align-items:center;gap:6px;width:100%;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--vscode-foreground,#ccc);font-size:12px;cursor:pointer;transition:all .2s;}
.menu-list-item:hover{background:rgba(255,255,255,0.06);}
.menu-list-item:active{transform:translateY(1px);}
.menu-list-item svg{flex-shrink:0;color:var(--vscode-foreground,#ccc);}
/* Team detail panel buttons */
#teamDetailPanel button:hover{filter:brightness(1.15);transform:translateY(-1px);}
#teamDetailPanel button:active{transform:translateY(0);}
/* Trust detail panel buttons */
#trustDetailPanel button:hover{filter:brightness(1.15);transform:translateY(-1px);}
#trustDetailPanel button:active{transform:translateY(0);}
/* Profile severity bar (Team, Profile, Repo Health, Analytics, Platform panels) */
.profile-severity-bar{display:flex;flex-wrap:wrap;gap:10px 16px;padding:10px 12px;margin:0 12px 12px;border-radius:8px;background:var(--vscode-input-background,rgba(255,255,255,0.03));border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));font-size:11px;color:var(--vscode-foreground,#ccc);}
.profile-severity-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.profile-severity-dot.red{background:#ef4444;}
.profile-severity-dot.amber{background:#f59e0b;}
.profile-severity-dot.blue{background:#60a5fa;}
.profile-severity-dot.green{background:#34d399;}
/* Scan form */
.scan-form{padding:0 12px 12px;}
.scan-label{font-size:11px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:4px;display:block;}
.scan-input{width:100%;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background,#3c3c3c);border:1px solid rgba(255,255,255,0.1);color:var(--vscode-foreground,#ccc);font-size:12px;font-family:inherit;margin-bottom:10px;box-sizing:border-box;}
.scan-select{width:100%;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background,#3c3c3c);border:1px solid rgba(255,255,255,0.1);color:var(--vscode-foreground,#ccc);font-size:12px;font-family:inherit;margin-bottom:10px;}
.scan-check{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--vscode-foreground,#ccc);}
.scan-check input{width:14px;height:14px;accent-color:#007acc;}
.scan-actions{display:flex;gap:8px;padding:0 12px 12px;}
.scan-btn-primary{flex:1;padding:10px;border-radius:8px;background:linear-gradient(135deg,rgba(139,92,246,0.9),rgba(99,102,241,0.9));border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}
.scan-btn-secondary{flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:var(--vscode-foreground,#ccc);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}
/* Server info */
.server-info{padding:0 14px 12px;font-size:12px;color:var(--vscode-descriptionForeground,#858585);}
/* Upload & Validate page */
.upload-header{padding:12px 14px 0;}
.upload-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground,#858585);}
.upload-dropzone{margin:12px;padding:24px 16px;border:2px dashed rgba(255,255,255,0.15);border-radius:14px;background:rgba(255,255,255,0.02);text-align:center;transition:all .2s;cursor:pointer;}
.upload-dropzone:hover,.upload-dropzone.dragover{border-color:rgba(16,185,129,0.6);background:rgba(16,185,129,0.06);}
.upload-dropzone-icon{font-size:28px;margin-bottom:8px;}
.upload-dropzone-title{font-size:13px;font-weight:600;color:var(--vscode-foreground,#ccc);margin-bottom:4px;}
.upload-dropzone-subtitle{font-size:11px;color:var(--vscode-descriptionForeground,#858585);}
.upload-file-input{display:none;}
.upload-types{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px;}
.upload-type{display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);font-size:10px;color:var(--vscode-descriptionForeground,#858585);}
.upload-actions{display:flex;gap:8px;padding:0 12px 12px;}
.upload-btn{flex:1;padding:10px;border-radius:8px;background:linear-gradient(135deg,rgba(16,185,129,0.9),rgba(5,150,105,0.9));border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}
.upload-btn:hover{filter:brightness(1.1);}
.upload-btn.secondary{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:var(--vscode-foreground,#ccc);}
.upload-list{display:flex;flex-direction:column;gap:6px;padding:0 12px 12px;}
.upload-list-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground,#858585);margin:0 12px 8px;}
.upload-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:12px;}
.upload-item-icon{width:28px;height:28px;border-radius:6px;background:rgba(16,185,129,0.12);color:#34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.upload-item-icon.warn{background:rgba(245,158,11,0.12);color:#fbbf24;}
.upload-item-icon.err{background:rgba(239,68,68,0.12);color:#f87171;}
.upload-item-text{flex:1;min-width:0;}
.upload-item-name{color:var(--vscode-foreground,#ccc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.upload-item-meta{color:#888;font-size:10px;}
.upload-item-status{padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;}
.upload-item-status.ready{background:rgba(59,130,246,0.15);color:#60a5fa;}
.upload-item-status.valid{background:rgba(16,185,129,0.15);color:#34d399;}
.upload-item-status.invalid{background:rgba(239,68,68,0.15);color:#f87171;}
.upload-empty{text-align:center;padding:16px;color:#555;font-size:12px;}
.upload-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 12px 12px;}
.upload-stat{padding:12px 6px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);text-align:center;}
.upload-stat-value{font-size:18px;font-weight:700;color:#fff;}
.upload-stat-label{font-size:9px;color:var(--vscode-descriptionForeground,#858585);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;}
.upload-stat.valid .upload-stat-value{color:#34d399;}
.upload-stat.invalid .upload-stat-value{color:#f87171;}
.upload-stat.pending .upload-stat-value{color:#60a5fa;}
.upload-progress{margin:0 12px 12px;}
.upload-progress-bar{height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;}
.upload-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#34d399,#0ea5e9);border-radius:3px;transition:width .2s;}
.upload-progress-text{font-size:10px;color:var(--vscode-descriptionForeground,#858585);margin-top:4px;text-align:center;}
.upload-detail{margin:0 12px 12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:12px;}
.upload-detail-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:6px;}
.upload-detail-item{display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:11px;color:var(--vscode-foreground,#ccc);}
.upload-detail-item.ok{color:#34d399;}
.upload-detail-item.err{color:#f87171;}
.upload-item-actions{display:flex;gap:4px;}
.upload-item-action{width:22px;height:22px;border-radius:4px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:#888;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;}
.upload-item-action:hover{background:rgba(255,255,255,0.08);color:#fff;}
.upload-result-box{margin:0 12px 12px;padding:12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);}
.upload-result-title{font-size:11px;font-weight:700;color:var(--vscode-foreground,#ccc);margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.upload-result-title.ok{color:#34d399;}
.upload-result-title.err{color:#f87171;}
.upload-result-list{font-size:11px;color:#888;line-height:1.5;}
.mw-section-header { display:flex; align-items:center; gap:8px; padding:10px 14px; margin:8px 12px 0; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; cursor:pointer; transition:all 0.2s; color:var(--vscode-descriptionForeground,#858585); user-select:none; }
.mw-section-header:hover { background:rgba(255,255,255,0.06); }
.mw-section-header .arrow { font-size:10px; transition:transform 0.2s; display:inline-block; }
.mw-section-header.open .arrow { transform:rotate(90deg); }
.mw-section-body { overflow:hidden; transition:max-height 0.3s ease; }
.mw-section-body.closed { max-height:0; }
.mw-section-body.open { max-height:600px; }
.settings-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  margin: 8px 12px 0;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--vscode-foreground, #ccc);
}
.settings-dropdown-header:hover { background: rgba(255,255,255,0.06); }
.settings-dropdown-header .arrow { font-size: 10px; transition: transform 0.2s; }
.settings-dropdown-header.open .arrow { transform: rotate(180deg); }
.settings-dropdown-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  margin: 0 12px;
  border-left: 1px solid rgba(255,255,255,0.06);
  border-right: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  border-radius: 0 0 8px 8px;
}
.settings-dropdown-body.open { max-height: 600px; }
.dropdown-menu-item { display:flex; align-items:center; gap:8px; padding:7px 12px; font-size:12px; color:var(--vscode-foreground,#ccc); cursor:pointer; transition:background .15s; border-radius:4px; margin:2px 6px; }
.dropdown-menu-item:hover { background:rgba(255,255,255,0.06); }
.dropdown-menu-item .menu-icon { width:16px; height:16px; display:flex; align-items:center; justify-content:center; flex-shrink:0; opacity:.7; }
.dropdown-section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--vscode-descriptionForeground,#858585); padding:8px 12px 4px; margin-top:4px; }
.dropdown-divider { height:1px; background:rgba(255,255,255,0.06); margin:4px 10px; }
.hidden { display: none !important; }
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 12px;
}
.settings-row:last-child { border-bottom: none; }
.settings-row label { color: var(--vscode-foreground, #ccc); font-size: 12px; }
.settings-row select, .settings-row input[type="text"] {
  padding: 3px 6px;
  background: var(--vscode-panel-background, #252526);
  color: var(--vscode-foreground, #ccc);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
}
.settings-row input[type="checkbox"] {
  width: 14px; height: 14px;
  accent-color: #007acc;
}
/* Sidebar dashboard view mode */
.sidebar-dashboard-mode .header,
.sidebar-dashboard-mode .card,
.sidebar-dashboard-mode .server-info,
.sidebar-dashboard-mode .settings-btn-card,
.sidebar-dashboard-mode .settings-dropdown-header,
.sidebar-dashboard-mode .settings-dropdown-body,
.sidebar-dashboard-mode .tab-bar,
.sidebar-dashboard-mode .tab-section,
.sidebar-dashboard-mode .mw-section-header,
.sidebar-dashboard-mode .mw-section-body,
.sidebar-dashboard-mode .dl-section { display: none !important; }
.sidebar-dashboard-mode #tabDashboard { display: block !important; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; background: var(--vscode-editor-background, #1e1e1e); overflow-y: auto; padding: 12px; }
.sidebar-dashboard-back { position: sticky; top: 0; z-index: 101; display: flex; align-items: center; gap: 6px; padding: 8px 12px; margin: -12px -12px 8px; background: var(--vscode-editor-background, #1e1e1e); border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06)); font-size: 12px; font-weight: 600; color: var(--vscode-foreground, #ccc); cursor: pointer; }
.sidebar-tab-bar:not(.hidden) ~ #tabDashboard.active { display: block !important; position: relative; top: auto; left: auto; right: auto; bottom: auto; z-index: auto; padding: 0; }
.sidebar-tab-bar:not(.hidden) ~ #tabDashboard.active .sidebar-dashboard-back { display: none !important; }
.sidebar-tab-bar:not(.hidden) ~ #tabAdvanced.active { display: none !important; }
.sidebar-dashboard-back:hover { color: var(--vscode-button-background, #0e639c); }
/* Diagnose results */
.diag-results { padding: 8px 4px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.diag-card { background: var(--vscode-input-background, #2d2d30); border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; transition: border-color 150ms ease, background 150ms ease; }
.diag-card:hover { border-color: var(--vscode-focusBorder, rgba(255,255,255,0.15)); background: var(--vscode-input-background, #333336); }
.diag-card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vscode-descriptionForeground, #999); margin-bottom: 2px; }
.diag-card-value { font-size: 13px; font-weight: 500; color: var(--vscode-foreground, #e0e0e0); word-break: break-word; line-height: 1.4; }
.diag-card.ok { border-left: 4px solid #34d399; }
.diag-card.warn { border-left: 4px solid #fbbf24; }
.diag-card.err { border-left: 4px solid #f87171; }
.diag-status { padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; margin-bottom: 10px; display: inline-block; letter-spacing: 0.02em; }
.diag-status.ok { background: rgba(16,185,129,0.15); color: #34d399; }
.diag-status.warn { background: rgba(245,158,11,0.15); color: #fbbf24; }
.diag-status.err { background: rgba(239,68,68,0.12); color: #f87171; }
.diag-back-bar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 6px; cursor: pointer; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--vscode-foreground, #ccc); background: transparent; transition: background 150ms ease; }
.diag-back-bar:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06)); }
.diag-back-bar svg { width: 14px; height: 14px; }
.diag-title { font-size: 15px; font-weight: 700; color: var(--vscode-foreground, #ccc); margin-bottom: 8px; }
/* Diagnostic panel header (matches sidebar Image 2) */
.diag-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px 6px; }
.diag-header-icon { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg,#ef4444,#b91c1c); display: flex; align-items: center; justify-content: center; color: #fff; }
.diag-header-icon svg { width: 16px; height: 16px; }
.diag-header-text { display: flex; flex-direction: column; }
.diag-header-title { font-size: 13px; font-weight: 700; color: var(--vscode-foreground, #e0e0e0); }
.diag-header-subtitle { font-size: 11px; color: var(--vscode-descriptionForeground, #999); }
.diag-summary-row { display: flex; gap: 8px; padding: 0 12px 8px; }
.diag-summary-card { flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: var(--vscode-input-background, #2d2d30); border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06)); }
.diag-summary-icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.diag-summary-icon.ok { background: rgba(16,185,129,0.12); color: #34d399; }
.diag-summary-icon.server { background: rgba(6,182,212,0.12); color: #22d3ee; }
.diag-summary-icon.err { background: rgba(239,68,68,0.12); color: #f87171; }
.diag-summary-text { display: flex; flex-direction: column; min-width: 0; }
.diag-summary-label { font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground, #999); text-transform: uppercase; letter-spacing: 0.04em; }
.diag-summary-value { font-size: 12px; font-weight: 500; color: var(--vscode-foreground, #e0e0e0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Settings page styles */
.settings-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
.settings-title { font-size: 16px; font-weight: 700; color: var(--vscode-foreground, #ccc); }
.settings-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; background: rgba(34,197,94,0.15); color: #22c55e; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.settings-badge.amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
.settings-badge.red { background: rgba(239,68,68,0.15); color: #ef4444; }
.severity-bar { display: flex; align-items: center; gap: 10px; padding: 0 14px 12px; }
.severity-item { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; color: var(--vscode-descriptionForeground, #858585); }
.severity-dot { width: 8px; height: 8px; border-radius: 50%; }
.severity-dot.critical { background: #ef4444; }
.severity-dot.high { background: #f59e0b; }
.severity-dot.medium { background: #3b82f6; }
.severity-dot.low { background: #22c55e; }
.settings-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 14px 12px; }
.settings-kpi-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; text-align: center; }
.settings-kpi-value { font-size: 18px; font-weight: 700; color: var(--vscode-foreground, #ccc); }
.settings-kpi-value.green { color: #22c55e; }
.settings-kpi-value.red { color: #ef4444; }
.settings-kpi-value.amber { color: #f59e0b; }
.settings-kpi-label { font-size: 9px; color: var(--vscode-descriptionForeground, #858585); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
.settings-section-card { background: var(--vscode-input-background, rgba(255,255,255,0.03)); border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06)); border-radius: 10px; margin: 0 14px 10px; padding: 12px; }
.settings-section-title { font-size: 12px; font-weight: 700; color: var(--vscode-foreground, #ccc); margin-bottom: 10px; }
.settings-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.04)); }
.settings-row:last-child { border-bottom: none; }
.settings-row-left { display: flex; flex-direction: column; gap: 2px; }
.settings-row-label { font-size: 12px; font-weight: 500; color: var(--vscode-foreground, #ccc); }
.settings-row-desc { font-size: 10px; color: var(--vscode-descriptionForeground, #858585); }
.toggle-switch { position: relative; width: 36px; height: 20px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.1); border-radius: 20px; transition: 0.2s; }
.toggle-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.toggle-switch input:checked + .toggle-slider { background: #3b82f6; }
.toggle-switch input:checked + .toggle-slider:before { transform: translateX(16px); }
.settings-input { width: 100%; padding: 8px 10px; border-radius: 6px; background: var(--vscode-input-background, #2d2d30); border: 1px solid rgba(255,255,255,0.08); color: var(--vscode-foreground, #ccc); font-size: 12px; margin-top: 6px; box-sizing: border-box; }
.settings-input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
.settings-select { padding: 6px 24px 6px 10px; border-radius: 6px; background: var(--vscode-dropdown-background, #2d2d30); border: 1px solid rgba(255,255,255,0.08); color: var(--vscode-foreground, #ccc); font-size: 12px; cursor: pointer; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23ccc\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"/></svg>'); background-repeat: no-repeat; background-position: right 8px center; }
.settings-select:focus { outline: none; border-color: rgba(59,130,246,0.5); }
.settings-actions { display: flex; gap: 8px; margin-top: 10px; }
.settings-btn-primary { flex: 1; padding: 8px 12px; border-radius: 6px; background: linear-gradient(135deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9)); border: none; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; }
.settings-btn-primary:hover { opacity: 0.9; }
.settings-btn-secondary { flex: 1; padding: 8px 12px; border-radius: 6px; background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.05)); border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); color: var(--vscode-foreground, #ccc); font-size: 12px; font-weight: 500; cursor: pointer; text-align: center; }
.settings-btn-secondary:hover { background: var(--vscode-button-hoverBackground, rgba(255,255,255,0.08)); }
/* Compact sidebar settings panel */
#tabSettings .settings-header { padding: 8px 10px 6px; }
#tabSettings .settings-title { font-size: 14px; }
#tabSettings .settings-badge { padding: 2px 8px; font-size: 9px; }
#tabSettings .severity-bar { flex-wrap: wrap; gap: 6px 10px; padding: 0 10px 8px; }
#tabSettings .severity-item { font-size: 10px; }
#tabSettings .settings-kpi-grid { gap: 6px; padding: 0 10px 8px; }
#tabSettings .settings-kpi-card { padding: 8px 4px; border-radius: 8px; }
#tabSettings .settings-kpi-value { font-size: 14px; }
#tabSettings .settings-kpi-label { font-size: 8px; }
#tabSettings .settings-section-card { margin: 0 10px 8px; padding: 8px; border-radius: 8px; }
#tabSettings .settings-section-title { font-size: 11px; margin-bottom: 6px; }
#tabSettings .settings-row { padding: 6px 0; }
#tabSettings .settings-row-label { font-size: 11px; }
#tabSettings .settings-row-desc { font-size: 9px; }
#tabSettings .toggle-switch { width: 32px; height: 18px; }
#tabSettings .toggle-slider:before { height: 12px; width: 12px; left: 3px; bottom: 3px; }
#tabSettings .toggle-switch input:checked + .toggle-slider:before { transform: translateX(14px); }
#tabSettings .settings-input { padding: 6px 8px; font-size: 11px; }
#tabSettings .settings-actions { gap: 6px; margin-top: 8px; }
#tabSettings .settings-btn-primary, #tabSettings .settings-btn-secondary { padding: 6px 8px; font-size: 11px; }
#tabSettings .diag-back-bar { margin-bottom: 4px; }
#auditDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#auditDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#auditDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#auditDetailPanel .settings-kpi-card { background:var(--vscode-input-background, rgba(255,255,255,0.04)); border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); border-radius:8px; padding:10px; text-align:center; }
#auditDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#auditDetailPanel .settings-kpi-value.red { color:#f87171; }
#auditDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#auditDetailPanel .settings-kpi-value.green { color:#4ade80; }
#auditDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#auditDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#auditDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#auditDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#auditDetailPanel .severity-dot.critical { background:#ef4444; }
#auditDetailPanel .severity-dot.high { background:#f97316; }
#auditDetailPanel .severity-dot.medium { background:#3b82f6; }
#auditDetailPanel .severity-dot.low { background:#22c55e; }
#securityDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#securityDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#securityDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#securityDetailPanel .settings-kpi-card { background:var(--vscode-input-background, rgba(255,255,255,0.04)); border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.08)); border-radius:8px; padding:10px; text-align:center; }
#securityDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#securityDetailPanel .settings-kpi-value.red { color:#f87171; }
#securityDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#securityDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#securityDetailPanel .settings-kpi-value.green { color:#4ade80; }
#securityDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#securityDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#securityDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#securityDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#securityDetailPanel .severity-dot.critical { background:#ef4444; }
#securityDetailPanel .severity-dot.high { background:#f97316; }
#securityDetailPanel .severity-dot.medium { background:#3b82f6; }
#securityDetailPanel .severity-dot.low { background:#22c55e; }
#trustDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#trustDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#trustDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#trustDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#trustDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#trustDetailPanel .settings-kpi-value.red { color:#f87171; }
#trustDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#trustDetailPanel .settings-kpi-value.green { color:#4ade80; }
#trustDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#trustDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#trustDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#trustDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#trustDetailPanel .severity-dot.critical { background:#ef4444; }
#trustDetailPanel .severity-dot.high { background:#f97316; }
#trustDetailPanel .severity-dot.medium { background:#3b82f6; }
#trustDetailPanel .severity-dot.low { background:#22c55e; }
#assessmentsDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#assessmentsDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#assessmentsDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#assessmentsDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#assessmentsDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#assessmentsDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#assessmentsDetailPanel .settings-kpi-value.red { color:#f87171; }
#assessmentsDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#assessmentsDetailPanel .settings-kpi-value.green { color:#4ade80; }
#assessmentsDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#assessmentsDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#assessmentsDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#assessmentsDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#assessmentsDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#assessmentsDetailPanel .severity-dot.critical { background:#ef4444; }
#assessmentsDetailPanel .severity-dot.high { background:#f97316; }
#assessmentsDetailPanel .severity-dot.medium { background:#3b82f6; }
#assessmentsDetailPanel .severity-dot.low { background:#22c55e; }
#assessmentsDetailPanel .tc-progress-row { display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:600; }
#complianceDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#complianceDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#complianceDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#complianceDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#complianceDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#complianceDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#complianceDetailPanel .settings-kpi-value.red { color:#f87171; }
#complianceDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#complianceDetailPanel .settings-kpi-value.green { color:#4ade80; }
#complianceDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#complianceDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#complianceDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#complianceDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#complianceDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#complianceDetailPanel .severity-dot.critical { background:#ef4444; }
#complianceDetailPanel .severity-dot.high { background:#f97316; }
#complianceDetailPanel .severity-dot.medium { background:#3b82f6; }
#complianceDetailPanel .severity-dot.low { background:#22c55e; }
#qualityDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#qualityDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#qualityDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#qualityDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#qualityDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#qualityDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#qualityDetailPanel .settings-kpi-value.red { color:#f87171; }
#qualityDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#qualityDetailPanel .settings-kpi-value.green { color:#4ade80; }
#qualityDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#qualityDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#qualityDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#qualityDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#qualityDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#qualityDetailPanel .severity-dot.critical { background:#ef4444; }
#qualityDetailPanel .severity-dot.high { background:#f97316; }
#qualityDetailPanel .severity-dot.medium { background:#3b82f6; }
#qualityDetailPanel .severity-dot.low { background:#22c55e; }
#qualityDetailPanel .quality-dim-row { display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:600; }
#qualityDetailPanel .quality-dim-score { font-size:13px; font-weight:700; }
#qualityDetailPanel .quality-dim-score.green { color:#4ade80; }
#qualityDetailPanel .quality-dim-score.amber { color:#fbbf24; }
#qualityDetailPanel .quality-dim-score.red { color:#f87171; }
#qualityDetailPanel .quality-dim-bar { height:4px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden; margin-top:4px; }
#qualityDetailPanel .quality-dim-fill { height:100%; border-radius:2px; transition:width 0.3s ease; }
#scanDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#scanDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#scanDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#scanDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#scanDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#scanDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#scanDetailPanel .settings-kpi-value.red { color:#f87171; }
#scanDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#scanDetailPanel .settings-kpi-value.green { color:#4ade80; }
#scanDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#scanDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#scanDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#scanDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#scanDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#scanDetailPanel .severity-dot.critical { background:#ef4444; }
#scanDetailPanel .severity-dot.high { background:#f97316; }
#scanDetailPanel .severity-dot.medium { background:#3b82f6; }
#scanDetailPanel .severity-dot.low { background:#22c55e; }
#scanDetailPanel .scan-result-row { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); }
#scanDetailPanel .scan-result-title { font-size:11px; font-weight:600; }
#scanDetailPanel .scan-result-file { font-size:9px; color:var(--vscode-descriptionForeground,#999); }
#scanDetailPanel .scan-result-severity { font-size:9px; font-weight:700; padding:2px 6px; border-radius:10px; }
#scanDetailPanel .scan-result-severity.critical { background:rgba(239,68,68,0.2); color:#f87171; }
#scanDetailPanel .scan-result-severity.high { background:rgba(249,115,22,0.2); color:#fbbf24; }
#scanDetailPanel .scan-result-severity.medium { background:rgba(59,130,246,0.2); color:#60a5fa; }
#scanDetailPanel .scan-result-severity.low { background:rgba(34,197,94,0.2); color:#4ade80; }
#aiContextDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#aiContextDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#aiContextDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#aiContextDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#aiContextDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#aiContextDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#aiContextDetailPanel .settings-kpi-value.red { color:#f87171; }
#aiContextDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#aiContextDetailPanel .settings-kpi-value.green { color:#4ade80; }
#aiContextDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#aiContextDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#aiContextDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#aiContextDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#aiContextDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#aiContextDetailPanel .severity-dot.critical { background:#ef4444; }
#aiContextDetailPanel .severity-dot.high { background:#f97316; }
#aiContextDetailPanel .severity-dot.medium { background:#3b82f6; }
#aiContextDetailPanel .severity-dot.low { background:#22c55e; }
#aiContextDetailPanel .ai-context-model-row { display:flex; align-items:center; gap:10px; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); }
#aiContextDetailPanel .ai-context-model-avatar { width:28px; height:28px; border-radius:50%; background:rgba(59,130,246,0.2); color:#60a5fa; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
#aiContextDetailPanel .ai-context-model-info { flex:1; min-width:0; }
#aiContextDetailPanel .ai-context-model-name { font-size:11px; font-weight:600; }
#aiContextDetailPanel .ai-context-model-desc { font-size:9px; color:var(--vscode-descriptionForeground,#999); }
#certificateDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#certificateDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#certificateDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#certificateDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#certificateDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#certificateDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#certificateDetailPanel .settings-kpi-value.red { color:#f87171; }
#certificateDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#certificateDetailPanel .settings-kpi-value.green { color:#4ade80; }
#certificateDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#certificateDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#certificateDetailPanel .severity-bar { display:flex; justify-content:space-between; gap:4px; margin:12px 0; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; font-size:10px; }
#certificateDetailPanel .severity-item { display:flex; align-items:center; gap:4px; }
#certificateDetailPanel .severity-dot { width:7px; height:7px; border-radius:50%; }
#certificateDetailPanel .severity-dot.critical { background:#ef4444; }
#certificateDetailPanel .severity-dot.high { background:#f97316; }
#certificateDetailPanel .severity-dot.medium { background:#3b82f6; }
#certificateDetailPanel .severity-dot.low { background:#22c55e; }
#certificateDetailPanel .cert-status-row { display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); font-size:11px; }
#certificateDetailPanel .cert-status-label { color:var(--vscode-descriptionForeground,#999); }
#certificateDetailPanel .cert-status-value { font-weight:600; }
#certificateDetailPanel .cert-req-row { display:flex; align-items:center; gap:8px; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); font-size:11px; }
#certificateDetailPanel .cert-req-icon { width:14px; height:14px; flex-shrink:0; }
#certificateDetailPanel .cert-req-icon.green { color:#4ade80; }
#certificateDetailPanel .cert-req-icon.red { color:#f87171; }
#certificateDetailPanel .cert-req-name { flex:1; }
#codeMapDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#codeMapDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#codeMapDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#codeMapDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#codeMapDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#codeMapDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#codeMapDetailPanel .settings-kpi-value.green { color:#4ade80; }
#codeMapDetailPanel .settings-kpi-value.blue { color:#60a5fa; }
#codeMapDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#codeMapDetailPanel .code-map-lang-row { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:11px; border-bottom:1px solid rgba(255,255,255,0.05); }
#codeMapDetailPanel .code-map-lang-row:last-child { border-bottom:none; }
#codeMapDetailPanel .code-map-lang-name { width:40px; flex-shrink:0; }
#codeMapDetailPanel .code-map-lang-bar { flex:1; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden; }
#codeMapDetailPanel .code-map-lang-fill { height:100%; border-radius:3px; }
#codeMapDetailPanel .code-map-lang-count { width:30px; text-align:right; }
#codeMapDetailPanel .code-map-detail-row { display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); font-size:11px; }
#codeMapDetailPanel .code-map-detail-label { color:var(--vscode-descriptionForeground,#999); }
#codeMapDetailPanel .code-map-detail-value { font-weight:600; }
#roadmapDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#roadmapDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#roadmapDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#roadmapDetailPanel .settings-kpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:12px 0; }
#roadmapDetailPanel .settings-kpi-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#roadmapDetailPanel .settings-kpi-value { font-size:20px; font-weight:800; line-height:1; }
#roadmapDetailPanel .settings-kpi-value.red { color:#f87171; }
#roadmapDetailPanel .settings-kpi-value.amber { color:#fbbf24; }
#roadmapDetailPanel .settings-kpi-value.green { color:#4ade80; }
#roadmapDetailPanel .settings-kpi-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#roadmapDetailPanel .severity-bar { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:10px 0; }
#roadmapDetailPanel .roadmap-phase-row { display:flex; align-items:center; gap:8px; padding:8px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); font-size:11px; }
#roadmapDetailPanel .roadmap-phase-dot { width:8px; height:8px; border-radius:50%; background:#a78bfa; flex-shrink:0; }
#roadmapDetailPanel .roadmap-phase-name { flex:1; }
#roadmapDetailPanel .roadmap-phase-tasks { color:var(--vscode-descriptionForeground,#999); }
#profileDetailPanel .settings-header { display:flex; align-items:center; justify-content:space-between; }
#profileDetailPanel .settings-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; }
#profileDetailPanel .settings-section-subtitle { font-size:11px; color:var(--vscode-descriptionForeground,#999); margin-bottom:10px; }
#profileDetailPanel .severity-bar { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:10px 0; }
#profileDetailPanel .db-sev-grid { margin:10px 0; }
#profileDetailPanel .profile-summary-grid { display:flex; flex-direction:column; gap:8px; margin:12px 0; padding:10px; border:1px solid rgba(255,255,255,0.08); border-radius:8px; background:rgba(255,255,255,0.04); }
#profileDetailPanel .profile-summary-row { display:flex; justify-content:space-between; align-items:center; font-size:12px; }
#profileDetailPanel .profile-summary-key { color:var(--vscode-descriptionForeground,#999); }
#profileDetailPanel .profile-summary-val { font-weight:700; color:var(--vscode-foreground,#fff); }
#profileDetailPanel .profile-grid { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
#profileDetailPanel .profile-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; }
#profileDetailPanel .profile-card-title { font-size:13px; font-weight:700; margin-bottom:10px; color:var(--vscode-foreground,#fff); }
#profileDetailPanel .profile-form { display:flex; flex-direction:column; gap:8px; }
#profileDetailPanel .profile-form-label { font-size:11px; color:var(--vscode-descriptionForeground,#999); }
#profileDetailPanel .profile-form-input, #profileDetailPanel .profile-form-select { background:var(--vscode-input-background,#3c3c3c); border:1px solid var(--vscode-input-border,#525252); color:var(--vscode-input-foreground,#ccc); padding:8px 10px; border-radius:6px; font-size:12px; font-family:inherit; }
#profileDetailPanel .profile-form-actions { display:flex; gap:8px; margin-top:8px; }
#profileDetailPanel .profile-btn-primary { flex:1; padding:8px 12px; border-radius:6px; border:none; background:#0ea5e9; color:#fff; font-weight:600; font-size:12px; cursor:pointer; }
#profileDetailPanel .profile-btn-primary:hover { filter:brightness(1.1); }
#profileDetailPanel .profile-btn-secondary { padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:transparent; color:var(--vscode-foreground,#ccc); font-size:12px; cursor:pointer; }
#profileDetailPanel .profile-btn-secondary:hover { background:rgba(255,255,255,0.06); }
#profileDetailPanel .profile-stats-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
#profileDetailPanel .profile-stat-item { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; text-align:center; }
#profileDetailPanel .profile-stat-value { font-size:18px; font-weight:800; color:var(--vscode-foreground,#fff); }
#profileDetailPanel .profile-stat-label { font-size:9px; color:var(--vscode-descriptionForeground,#999); margin-top:4px; }
#profileDetailPanel .profile-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); }
#profileDetailPanel .profile-toggle-row:last-child { border-bottom:none; }
#profileDetailPanel .profile-toggle-label { font-size:12px; color:var(--vscode-foreground,#ccc); }
#profileDetailPanel .profile-toggle { position:relative; display:inline-block; width:34px; height:18px; }
#profileDetailPanel .profile-toggle input { opacity:0; width:0; height:0; }
#profileDetailPanel .profile-toggle-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.15); border-radius:18px; transition:.2s; }
#profileDetailPanel .profile-toggle-slider:before { position:absolute; content:''; height:14px; width:14px; left:2px; bottom:2px; background:#fff; border-radius:50%; transition:.2s; }
#profileDetailPanel .profile-toggle input:checked + .profile-toggle-slider { background:#0ea5e9; }
#profileDetailPanel .profile-toggle input:checked + .profile-toggle-slider:before { transform:translateX(16px); }
#profileDetailPanel .profile-activity-item { display:flex; align-items:center; gap:8px; font-size:11px; padding:8px 0; }
#profileDetailPanel .profile-activity-dot { width:6px; height:6px; border-radius:50%; background:#60a5fa; flex-shrink:0; }
#profileDetailPanel .profile-activity-text { flex:1; color:var(--vscode-foreground,#ccc); }
#profileDetailPanel .profile-activity-time { color:var(--vscode-descriptionForeground,#999); font-size:10px; }
.settings-kpi-value.blue { color:#60a5fa; }
body.detail-panel-open .settings-dropdown-header,
body.detail-panel-open .settings-dropdown-body,
body.detail-panel-open #auditDropdownHeader,
body.detail-panel-open #openDiagnoseFromSettingsTab,
body.detail-panel-open #openRefreshRelayFromSettingsTab,
body.detail-panel-open #openSettingsFromSettingsTab,
body.detail-panel-open #analyzeDropdownHeader,
body.detail-panel-open #securityDropdownHeader,
body.detail-panel-open #trustDropdownHeader,
body.detail-panel-open #assessmentsDropdownHeader,
body.detail-panel-open #complianceDropdownHeader,
body.detail-panel-open #qualityDropdownHeader,
body.detail-panel-open #scanDropdownHeader,
body.detail-panel-open #aiContextDropdownHeader,
body.detail-panel-open #certificateDropdownHeader,
body.detail-panel-open #codeMapDropdownHeader,
body.detail-panel-open #roadmapDropdownHeader,
body.detail-panel-open #profileDropdownHeader,
body.detail-panel-open #repoHealthDropdownHeader,
body.detail-panel-open #analyticsDropdownHeader,
body.detail-panel-open #teamDropdownHeader,
body.detail-panel-open #platformDropdownHeader,
body.detail-panel-open #uploadDropdownHeader,
body.detail-panel-open #statusCard,
body.detail-panel-open #serverCard,
body.detail-panel-open #settingsServerCard,
body.detail-panel-open #settingsMenuTab,
body.detail-panel-open #scanTargetLabel,
body.detail-panel-open #sidebarScanToggleLabel,
body.detail-panel-open #quickLinksHeader,
body.detail-panel-open .quick-links {
  display: none !important;
}
body.detail-panel-open #mainTabBar,
body.detail-panel-open #sidebarTabBar {
  display: none !important;
}
body.detail-panel-open .tab-pane,
body.detail-panel-open #tabAdvanced {
  display: none !important;
}
/* Ensure dashboard is visible by default before JS runs */
#tabDashboard { display: block; }
${buildSidebarThemeStyles(ideTheme)}
</style>
</head>
<body>
<div class="header">
  <div class="header-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M12 2c3 3 5 7 5 12"/><path d="M12 22c-3-3-5-7-5-12"/></svg></div>
  <div class="header-text">
    <div class="header-title">SimpleBeacon</div>
    <div class="header-subtitle">Shipped by AI. Verified by SimpleBeacon.</div>
  </div>
  <div class="header-actions">
    <button type="button" id="headerSignInBtn" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.12);color:#818cf8;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;" data-command="signIn">&#x1F512; Sign In</button>
    <button type="button" id="headerSignOutBtn" style="display:none;align-items:center;gap:6px;padding:5px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.12);color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;" data-command="signOut">&#x1F512; Sign Out</button>
    <button type="button" class="header-theme-toggle" id="tdThemeToggleSidebar" title="Toggle Theme" aria-label="Toggle Theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
    </button>
  </div>
</div>
<div class="tab-bar ${displayMode === 'sidebar' ? 'hidden' : ''}" id="mainTabBar">
  <div class="tab-item active" data-tab="dashboard">Dashboard</div>
  <div class="tab-item" data-tab="scan">Scan</div>
  <div class="tab-item" data-tab="analyze">Analyze</div>
  <div class="tab-item" data-tab="advanced">Advanced</div>
  <div class="tab-item" data-tab="settings">Settings</div>
  <div class="tab-item" data-tab="team">Team Dashboard</div>
</div>
<div class="sidebar-tab-bar ${displayMode === 'sidebar' ? '' : 'hidden'}" id="sidebarTabBar">
  <div class="sidebar-tab-item active" data-tab="dashboard"><span class="sidebar-tab-icon">&#x1F3E0;</span>Dashboard</div>
  <div class="sidebar-tab-item" data-tab="scan"><span class="sidebar-tab-icon">&#x1F50D;</span>Scan</div>
  <div class="sidebar-tab-item" data-tab="analyze"><span class="sidebar-tab-icon">&#x1F4C8;</span>Analyze</div>
  <div class="sidebar-tab-item" data-tab="advanced"><span class="sidebar-tab-icon">&#x2699;</span>Advanced</div>
  <div class="sidebar-tab-item" data-tab="settings"><span class="sidebar-tab-icon">&#x1F527;</span>Settings</div>
  <div class="sidebar-tab-item" data-tab="team"><span class="sidebar-tab-icon">&#x1F465;</span>Team</div>
</div>
<div class="tab-pane active" id="tabDashboard" data-sidebar-tab="dashboard">
  <div class="sidebar-dashboard-back" id="dashboardBackBtn" style="display:none;"><span>&#x25C0;</span> Back to Sidebar</div>
  <div class="db-header">
    <div class="db-title">Dashboard</div>
    <div class="db-actions">
      <div class="db-badge" id="dbGateBadge">GATE: <span id="dbGateVal">Pending</span></div>
      <div class="db-btn" id="dbExportBtn">Export</div>
    </div>
  </div>
  <div class="db-summary-cards">
    <div class="card" id="dashGateCard">
      <div class="card-icon ok" id="dashGateIcon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="card-text">
        <div class="card-label">Gate</div>
        <div class="card-value" id="dashGateText">PASS</div>
      </div>
    </div>
    <div class="card" id="dashIssuesCard">
      <div class="card-icon server"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div class="card-text">
        <div class="card-label">Issues</div>
        <div class="card-value" id="dashIssuesText">0</div>
      </div>
    </div>
    <div class="card" id="dashScoreCard">
      <div class="card-icon" style="background:rgba(139,92,246,0.12);color:#a78bfa;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
      <div class="card-text">
        <div class="card-label">Score</div>
        <div class="card-value" id="dashScoreText">100</div>
      </div>
    </div>
  </div>
  <div class="db-scores">
    <div class="db-score-card">
      <div class="db-score-val" id="dbScoreVal">100</div>
      <div class="db-score-label">Quality Score</div>
    </div>
    <div class="db-score-card issues">
      <div class="db-score-val" id="dbIssuesVal">19</div>
      <div class="db-score-label">Total Issues</div>
    </div>
  </div>
  <div class="db-sev-row">
    <div class="db-sev-label"><span class="db-sev-dot crit"></span><span id="dbCritLabel">0 Critical</span></div>
    <div class="db-sev-label"><span class="db-sev-dot high"></span><span id="dbHighLabel">0 High</span></div>
    <div class="db-sev-label"><span class="db-sev-dot med"></span><span id="dbMedLabel">0 Med</span></div>
    <div class="db-sev-label"><span class="db-sev-dot low"></span><span id="dbLowLabel">0 Low</span></div>
  </div>
  <div class="db-sev-grid">
    <div class="db-sev-card">
      <div class="db-sev-count crit" id="dbCritCount">0</div>
      <div class="db-sev-name">Critical</div>
    </div>
    <div class="db-sev-card high">
      <div class="db-sev-count high" id="dbHighCount">0</div>
      <div class="db-sev-name">High</div>
    </div>
    <div class="db-sev-card med">
      <div class="db-sev-count med" id="dbMedCount">14</div>
      <div class="db-sev-name">Medium</div>
    </div>
    <div class="db-sev-card low">
      <div class="db-sev-count low" id="dbLowCount">5</div>
      <div class="db-sev-name">Low</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="dashboardViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="db-info">
    <div class="db-info-row"><div class="db-info-label">Repository Files</div><div class="db-info-val" id="dbRepoFiles">--</div></div>
    <div class="db-info-row"><div class="db-info-label">Gate Checked</div><div class="db-info-val" id="dbGateChecked">--</div></div>
  </div>
  <div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
    <button type="button" id="scanWorkspaceDropdownHeader" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Workspace
    </button>
    <button type="button" id="dashPreviewBtn" class="menu-list-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Preview
    </button>
    <button type="button" id="dashBrowserBtn" class="menu-list-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      Browser
    </button>
    <button type="button" id="dashExportReportBtn" class="menu-list-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export Report
    </button>
    <button type="button" id="dashClearResultsBtn" class="menu-list-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Clear Results
    </button>
  </div>
  <div class="dl-section">
    <div class="dl-header">
      <div class="dl-title">Downloads</div>
      <div class="dl-clear" id="dlClearBtn">Clear</div>
    </div>
    <div class="dl-list" id="dlList">
      <div class="dl-empty">No downloads yet</div>
    </div>
  </div>
</div>
<div class="card" id="repoFilesCard" data-sidebar-tab="dashboard">
  <div class="card-icon" style="background:rgba(34,197,94,0.12);color:#4ade80;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
  <div class="card-text">
    <div class="card-label">Repository Files</div>
    <div class="card-value" id="sidebarRepoFiles">--</div>
  </div>
</div>
<div class="tab-pane" id="tabScan">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Scan</div>
</div>
<div style="margin:0 0 10px 0;">
  <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:4px;">
    <div class="db-info-label" id="scanTargetLabel">Scan Target</div>
    <label class="toggle-switch" style="flex-shrink:0;margin-left:8px;">
      <input type="checkbox" id="sidebarScanWorkspaceToggle" ${isWorkspaceMode ? 'checked' : ''} />
      <span class="toggle-slider"></span>
    </label>
  </div>
  <div id="sidebarScanToggleLabel" style="font-size:11px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:8px;">${isWorkspaceMode ? 'Current Workspace' : 'Custom Location'}</div>
  <div id="sidebarScanCustomWrap" style="display:${isWorkspaceMode ? 'none' : 'flex'};flex-direction:column;gap:6px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
      <div class="db-info-label">Custom Location</div>
      <div style="display:flex;gap:6px;">
        <button type="button" id="sidebarScanBrowseBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Browse</button>
        <button type="button" id="sidebarScanDetectBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Detect</button>
      </div>
    </div>
    <input type="text" class="settings-input" id="sidebarScanPathInput" placeholder="Project path..." value="${escapeHtml(savedProjectPath)}" style="margin-top:0;" />
  </div>
  <div id="scanActionRow" style="display:${isWorkspaceMode ? 'none' : 'flex'};flex-direction:column;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <button type="button" id="scanStartBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Scan</button>
      <div class="scan-progress-wrap" style="flex:1;height:8px;background:rgba(99,102,241,0.15);border-radius:4px;overflow:hidden;">
        <div id="scanProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,rgba(99,102,241,0.8),rgba(129,140,248,0.8));border-radius:4px;transition:width 0.3s ease;"></div>
      </div>
      <span id="scanProgressPct" style="font-size:11px;color:var(--vscode-descriptionForeground,#858585);min-width:32px;text-align:right;">0%</span>
    </div>
  </div>
</div>
</div>
<div class="tab-section" id="quickLinksHeader" data-sidebar-tab="scan">Quick Links</div>
<div class="quick-links" data-sidebar-tab="scan">
  <button type="button" id="qlDashboardBtn" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>Dashboard</button>
  <button type="button" id="qlReportBtn" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>Report</button>
  <button type="button" id="qlBrowserBtn" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>Browser</button>
  <button type="button" id="qlPreviewBtn" class="ql-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>Preview</button>
</div>
<div class="tab-pane" id="tabUpload">
  <div class="upload-header">
    <div class="upload-title">Upload & Validate</div>
  </div>
  <div class="upload-stats">
    <div class="upload-stat pending">
      <div class="upload-stat-value" id="uploadStatPending">0</div>
      <div class="upload-stat-label">Pending</div>
    </div>
    <div class="upload-stat valid">
      <div class="upload-stat-value" id="uploadStatValid">0</div>
      <div class="upload-stat-label">Valid</div>
    </div>
    <div class="upload-stat invalid">
      <div class="upload-stat-value" id="uploadStatInvalid">0</div>
      <div class="upload-stat-label">Invalid</div>
    </div>
  </div>
  <div class="upload-dropzone" id="uploadDropzone">
    <div class="upload-dropzone-icon">&#x1F4E4;</div>
    <div class="upload-dropzone-title">Drop files here or click to browse</div>
    <div class="upload-dropzone-subtitle">Upload source files, ZIPs, or certificates to validate</div>
    <input type="file" class="upload-file-input" id="uploadFileInput" multiple />
  </div>
  <div class="upload-types">
    <div class="upload-type">&#x1F4C4; .zip</div>
    <div class="upload-type">&#x1F4C4; .js / .ts</div>
    <div class="upload-type">&#x1F4C4; .json report</div>
    <div class="upload-type">&#x1F4C4; .md / .txt</div>
  </div>
  <div class="upload-actions" style="display:flex;gap:8px;">
    <button type="button" id="uploadValidateBtn" class="menu-list-item" style="flex:1;justify-content:center;">Validate All</button>
    <button type="button" id="uploadClearBtn" class="menu-list-item" style="flex:1;justify-content:center;">Clear</button>
  </div>
  <div class="upload-progress" id="uploadProgress" style="display:none;">
    <div class="upload-progress-bar"><div class="upload-progress-fill" id="uploadProgressFill"></div></div>
    <div class="upload-progress-text" id="uploadProgressText">0%</div>
  </div>
  <div class="upload-detail" id="uploadDetail" style="display:none;">
    <div class="upload-detail-title">Validation Details</div>
    <div id="uploadDetailList"></div>
  </div>
  <div class="upload-result-box" id="uploadResultBox" style="display:none;">
    <div class="upload-result-title" id="uploadResultTitle"></div>
    <div class="upload-result-list" id="uploadResultList"></div>
  </div>
  <div class="upload-list-title">Selected Files</div>
  <div class="upload-list" id="uploadList">
    <div class="upload-empty">No files selected. Drop files above or click to browse.</div>
  </div>
</div>
<div class="tab-pane" id="tabCodemap">
<div class="tab-section">Code Map</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openCodeMapTabInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
  <button type="button" id="openCodeMapBtn" class="menu-list-item ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow">Open Code Map</button>
  <button type="button" id="openCertificateBtn" class="menu-list-item ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow">Open Certificate</button>
</div>
</div>
<div class="tab-pane" id="tabAnalyze">
<div class="analyze-header">
  <div>
    <div class="analyze-title">Analysis</div>
    <div class="analyze-subtitle">Scan, analyze & export results</div>
  </div>
</div>
<div class="analyze-grid">
  <button type="button" id="analyzeRunCard" class="analyze-card accent-green">
    <div class="analyze-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg></div>
    <div class="analyze-card-label">Run Analysis</div>
    <div class="analyze-card-desc">Start a full workspace scan</div>
  </button>
  <button type="button" id="analyzeScanWorkspaceCard" class="analyze-card accent-blue">
    <div class="analyze-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
    <div class="analyze-card-label">Enhanced Scan</div>
    <div class="analyze-card-desc">In-JS analyzer with profile picker</div>
  </button>
  <button type="button" id="analyzeExportJsonCard" class="analyze-card accent-amber">
    <div class="analyze-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
    <div class="analyze-card-label">Export JSON</div>
    <div class="analyze-card-desc">Download report as JSON</div>
  </button>
</div>
<div class="analyze-section-title">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  AI Analysis Tools
</div>
<div class="analyze-list">
  <button type="button" id="openEnhancedAnalysisBtn" class="analyze-list-item">
    <div class="analyze-list-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
    <div class="analyze-list-item-text">
      <div class="analyze-list-item-label">Enhanced Analysis</div>
      <div class="analyze-list-item-desc">Deep-dive AI-powered insights</div>
    </div>
  </button>
  <button type="button" id="openRealtimeAnalysisBtn" class="analyze-list-item">
    <div class="analyze-list-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
    <div class="analyze-list-item-text">
      <div class="analyze-list-item-label">Real-Time Analysis</div>
      <div class="analyze-list-item-desc">Live monitoring as you code</div>
    </div>
  </button>
  <button type="button" id="openPatternDetectionBtn" class="analyze-list-item">
    <div class="analyze-list-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
    <div class="analyze-list-item-text">
      <div class="analyze-list-item-label">Pattern Detection</div>
      <div class="analyze-list-item-desc">Find anti-patterns & smells</div>
    </div>
  </button>
  <button type="button" id="openModelHealthBtn" class="analyze-list-item">
    <div class="analyze-list-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
    <div class="analyze-list-item-text">
      <div class="analyze-list-item-label">Model Health</div>
      <div class="analyze-list-item-desc">Check AI model performance</div>
    </div>
  </button>
  <button type="button" id="openToggleMonitorBtn" class="analyze-list-item">
    <div class="analyze-list-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
    <div class="analyze-list-item-text">
      <div class="analyze-list-item-label">Toggle AI Quality Monitor</div>
      <div class="analyze-list-item-desc">Enable/disable quality guard</div>
    </div>
  </button>
</div>
</div>
<div class="tab-pane" id="tabReport" data-sidebar-tab="report">
<div style="padding:6px 0;">
  <div class="diag-back-bar" id="reportTopBackBtn" role="button" tabindex="0" style="margin:0;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
</div>
<div class="report-grid">
  <div class="report-card accent-green">
    <div class="report-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
    <div class="report-card-value green" id="reportScoreCard">--</div>
    <div class="report-card-label">Quality Score</div>
  </div>
  <div class="report-card accent-blue">
    <div class="report-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
    <div class="report-card-value blue" id="reportGateCard">--</div>
    <div class="report-card-label">Gate Status</div>
  </div>
  <div class="report-card accent-red">
    <div class="report-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
    <div class="report-card-value red" id="reportIssuesCard">--</div>
    <div class="report-card-label">Total Issues</div>
  </div>
  <div class="report-card accent-purple">
    <div class="report-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
    <div class="report-card-value purple" id="reportFilesCard">--</div>
    <div class="report-card-label">Files Scanned</div>
  </div>
</div>
<div class="tab-section">Severity Breakdown</div>
<div style="padding-bottom:8px;">
  <div class="report-sev-row">
    <div class="report-sev-label">Critical</div>
    <div class="report-sev-bar-wrap"><div id="reportCritBar" class="report-sev-bar critical" style="width:0%"></div></div>
    <div class="report-sev-val critical" id="reportCritVal">0</div>
  </div>
  <div class="report-sev-row">
    <div class="report-sev-label">High</div>
    <div class="report-sev-bar-wrap"><div id="reportHighBar" class="report-sev-bar high" style="width:0%"></div></div>
    <div class="report-sev-val high" id="reportHighVal">0</div>
  </div>
  <div class="report-sev-row">
    <div class="report-sev-label">Medium</div>
    <div class="report-sev-bar-wrap"><div id="reportMedBar" class="report-sev-bar medium" style="width:0%"></div></div>
    <div class="report-sev-val medium" id="reportMedVal">0</div>
  </div>
  <div class="report-sev-row">
    <div class="report-sev-label">Low</div>
    <div class="report-sev-bar-wrap"><div id="reportLowBar" class="report-sev-bar low" style="width:0%"></div></div>
    <div class="report-sev-val low" id="reportLowVal">0</div>
  </div>
</div>
<div class="tab-section">Actions</div>
<div class="report-actions">
  <button type="button" id="reportViewFullBtn" class="report-action-btn">
    <div class="report-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
    <span>View Full</span>
  </button>
  <button type="button" id="reportExportJsonBtn" class="report-action-btn">
    <div class="report-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
    <span>Export JSON</span>
  </button>
  <button type="button" id="openReportInMainWindowBtn" class="report-action-btn">
    <div class="report-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></svg></div>
    <span>Open Main</span>
  </button>
  <button type="button" id="reportNewScanBtn" class="report-action-btn">
    <div class="report-action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg></div>
    <span>New Scan</span>
  </button>
</div>
<div class="tab-section">Scan Info</div>
<div class="report-info">
  <div class="report-info-row">
    <span class="report-info-label">Last Scan</span>
    <span class="report-info-value" id="reportLastScan">--</span>
  </div>
  <div class="report-info-row">
    <span class="report-info-label">Duration</span>
    <span class="report-info-value" id="reportDuration">--</span>
  </div>
  <div class="report-info-row">
    <span class="report-info-label">Repository Files</span>
    <span class="report-info-value" id="reportRepoFiles">--</span>
  </div>
  <div class="report-info-row">
    <span class="report-info-label">Gate Checked</span>
    <span class="report-info-value" id="reportGateChecked">--</span>
  </div>
</div>
</div>
<div class="tab-pane" id="tabRoadmap">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="diag-back-bar" id="roadmapBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <button type="button" id="openRoadmapInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
</div>
<div class="tab-section">Roadmap</div>
<div class="tc-status" style="padding:12px;"><span class="tc-status-badge">Roadmap view</span></div>
<div class="tab-section">Phases</div>
<div class="tc-list" id="roadmapPhasesList">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Phase 1</span></div><span class="tc-list-meta">Discovery</span></div>
</div>
</div>
<div class="tab-pane" id="tabAicontext">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="diag-back-bar" id="aiContextBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <button type="button" id="openAiContextInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
</div>
<div class="tab-section">AI Context</div>
<div class="tc-status" style="padding:12px;"><span class="tc-status-badge">AI analysis context</span></div>
<div class="tab-section">Insights</div>
<div class="tc-list" id="aiContextList">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot orange"></span><span class="tc-list-name">Summary</span></div><span class="tc-list-meta">--</span></div>
</div>
</div>
<div class="tab-pane" id="tabRepohealth">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Repository Health</div>
  <button type="button" id="openRepoHealthInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val green" id="rhScore">--</div><div class="tc-card-label">Health Score</div></div>
  <div class="tc-card"><div class="tc-card-val blue" id="rhFiles">--</div><div class="tc-card-label">Files</div></div>
</div>
<div class="tc-status" style="padding:0 12px 8px;"><span class="tc-status-badge" id="rhStatusBadge">Waiting for scan</span></div>
<div class="tab-section">Checks</div>
<div class="tc-list" id="rhChecks">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Dependencies</span></div><span class="tc-list-meta" id="rhDeps">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Type Coverage</span></div><span class="tc-list-meta" id="rhTypes">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">Test Coverage</span></div><span class="tc-list-meta" id="rhTests">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Outdated Deps</span></div><span class="tc-list-meta" id="rhOutdated">--</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openRepoHealthBtn" class="menu-list-item">Open Full Report</button>
  <button type="button" id="refreshRepoHealthBtn" class="menu-list-item">Refresh Health Check</button>
</div>
</div>
<div class="tab-pane" id="tabAnalytics">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Analytics</div>
  <button type="button" id="openAnalyticsInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val purple" id="anScore">--</div><div class="tc-card-label">Quality Score</div></div>
  <div class="tc-card"><div class="tc-card-val blue" id="anTrend">--</div><div class="tc-card-label">Trend</div></div>
</div>
<div class="tab-section">Top Issues</div>
<div class="tc-list" id="anIssues">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot red"></span><span class="tc-list-name">Critical</span></div><span class="tc-list-meta" id="anCrit">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">High</span></div><span class="tc-list-meta" id="anHigh">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Medium</span></div><span class="tc-list-meta" id="anMed">--</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openAnalyticsBtn" class="menu-list-item">Open Full Analytics</button>
</div>
</div>
<div class="tab-pane" id="tabTeam" data-sidebar-tab="team">
<div class="tab-section">Quick Links</div>
<div class="tc-list" style="gap:8px;">
  <div class="tc-list-item" id="tdRoadmapSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F5FA;</span><span class="tc-list-name">Roadmap</span></div></div>
  <div class="tc-list-item" id="tdAuditSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4CB;</span><span class="tc-list-name">Audit</span></div></div>
  <div class="tc-list-item" id="tdOfflineToggleSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F3E0;</span><span class="tc-list-name">Local host</span></div></div>
  <div class="tc-list-item" id="tdSignInSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F512;</span><span class="tc-list-name">Sign In</span></div></div>
  <div class="tc-list-item" id="tdPricingSidebar" style="display:none;"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4B0;</span><span class="tc-list-name">Pricing</span></div></div>
  <div class="tc-list-item" id="tdSignOutSidebar" style="display:none;"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></span><span class="tc-list-name">Sign Out</span></div></div>
</div>
<div class="tab-section" style="margin-top:16px;">Navigation</div>
<div class="tc-list" style="gap:8px;">
  <div class="tc-list-item" id="tdDashboardSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4C8;</span><span class="tc-list-name">Dashboard</span></div></div>
  <div class="tc-list-item" id="tdAnalyzeSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F50D;</span><span class="tc-list-name">Analyze</span></div></div>
  <div class="tc-list-item" id="tdResultsSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4CA;</span><span class="tc-list-name">Results</span></div></div>
  <div class="tc-list-item" id="tdRepoHealthSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x2764;</span><span class="tc-list-name">Repo health</span></div></div>
  <div class="tc-list-item" id="tdSecuritySidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F6E1;</span><span class="tc-list-name">Security</span></div></div>
  <div class="tc-list-item" id="tdQualitySidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x2B50;</span><span class="tc-list-name">Quality</span></div></div>
  <div class="tc-list-item" id="tdTrustSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F510;</span><span class="tc-list-name">Trust</span></div></div>
  <div class="tc-list-item" id="tdAuditReportSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4CB;</span><span class="tc-list-name">Audit Report</span></div></div>
  <div class="tc-list-item" id="tdAssessmentsSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4DD;</span><span class="tc-list-name">Assessments</span></div></div>
  <div class="tc-list-item" id="tdRemediationSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F6E4;</span><span class="tc-list-name">Remediation</span></div></div>
  <div class="tc-list-item" id="tdPlatformSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F680;</span><span class="tc-list-name">Platform</span></div></div>
  <div class="tc-list-item" id="tdProfileSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F464;</span><span class="tc-list-name">Profile</span></div></div>
  <div class="tc-list-item" id="tdToolsSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F6E0;</span><span class="tc-list-name">Tools</span></div></div>
  <div class="tc-list-item" id="tdSettingsSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x2699;</span><span class="tc-list-name">Settings</span></div></div>
  <div class="tc-list-item" id="tdHelpSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x2753;</span><span class="tc-list-name">Help</span></div></div>
  <div class="tc-list-item" id="tdChatbotSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F916;</span><span class="tc-list-name">Chatbot</span></div></div>
  <div class="tc-list-item" id="tdAboutSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x2139;</span><span class="tc-list-name">About</span></div></div>
</div>
<div class="tab-section" style="margin-top:16px;">Links</div>
<div class="tc-list" style="gap:8px;">
  <div class="tc-list-item" id="tdGitHubSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F431;</span><span class="tc-list-name">GitHub</span></div></div>
  <div class="tc-list-item" id="tdDocsSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4D6;</span><span class="tc-list-name">Docs</span></div></div>
</div>
</div>
<div class="tab-pane" id="tabTrust">
<div class="tab-section">Trust Center</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val green" id="trScore">--</div><div class="tc-card-label">Trust Score</div></div>
  <div class="tc-card"><div class="tc-card-val amber" id="trAlerts">--</div><div class="tc-card-label">Alerts</div></div>
</div>
<div class="tab-section">Policies</div>
<div class="tc-list" id="trPolicies">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Code Signing</span></div><span class="tc-list-meta" id="trSign">Enabled</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Audit Trail</span></div><span class="tc-list-meta" id="trAudit">Active</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">AI Review</span></div><span class="tc-list-meta" id="trAi">Pending</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openTrustBtn" class="menu-list-item">Open Trust Center</button>
  <button type="button" id="openTrustTabInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabAssessments">
<div class="tab-section">Assessments</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val green" id="asPass">--</div><div class="tc-card-label">Passed</div></div>
  <div class="tc-card"><div class="tc-card-val red" id="asFail">--</div><div class="tc-card-label">Failed</div></div>
</div>
<div class="tab-section">Recent Checks</div>
<div class="tc-list" id="asChecks">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Security Headers</span></div><span class="tc-list-meta" id="asSec">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Secrets Scan</span></div><span class="tc-list-meta" id="asSecrets">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">License Check</span></div><span class="tc-list-meta" id="asLic">--</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openAssessmentsBtn" class="menu-list-item">Run Assessment</button>
  <button type="button" id="openAssessmentsTabInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabPlatform" data-sidebar-tab="platform">
<div class="tab-section">Platform</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val blue" id="plVer">--</div><div class="tc-card-label">Extension</div></div>
  <div class="tc-card"><div class="tc-card-val purple" id="plNode">--</div><div class="tc-card-label">Node</div></div>
</div>
<div class="tab-section">Services</div>
<div class="tc-list" id="plServices">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Data Server</span></div><span class="tc-list-meta" id="plData">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Relay</span></div><span class="tc-list-meta" id="plRelay">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">API</span></div><span class="tc-list-meta" id="plApi">127.0.0.1:54358</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openPlatformBtn" class="menu-list-item">Open Platform Details</button>
  <button type="button" id="openPlatformTabInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabCompliance">
<div class="tab-section">Compliance</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val green" id="cpScore">--</div><div class="tc-card-label">Score</div></div>
  <div class="tc-card"><div class="tc-card-val amber" id="cpPending">--</div><div class="tc-card-label">Pending</div></div>
</div>
<div class="tab-section">Frameworks</div>
<div class="tc-list" id="cpFrameworks">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">SOC 2</span></div><span class="tc-list-meta" id="cpSoc2">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">ISO 27001</span></div><span class="tc-list-meta" id="cpIso">--</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">GDPR</span></div><span class="tc-list-meta" id="cpGdpr">--</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openComplianceBtn" class="menu-list-item">Open Compliance Report</button>
  <button type="button" id="openComplianceTabInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabProfile">
<div class="tab-section">Profile</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val blue" id="prScans">--</div><div class="tc-card-label">Scans</div></div>
  <div class="tc-card"><div class="tc-card-val purple" id="prScore">--</div><div class="tc-card-label">Avg Score</div></div>
</div>
<div class="tab-section">Settings</div>
<div class="tc-list" id="prSettings">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Display Mode</span></div><span class="tc-list-meta" id="prDisplay">Main Window</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Auto Scan</span></div><span class="tc-list-meta" id="prAuto">Off</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Server URL</span></div><span class="tc-list-meta" id="prUrl">127.0.0.1:54358</span></div>
</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openProfileBtn" class="menu-list-item">Open Profile</button>
  <button type="button" id="openProfileInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabAdvanced">
<div class="tab-section">Advanced Menu</div>
<div class="tab-section">Analysis</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openReportBtn" class="menu-list-item">Open Report</button>
  <button type="button" id="openRoadmapBtn" class="menu-list-item">Open Roadmap</button>
  <button type="button" id="openAiContextBtn" class="menu-list-item">Open AI Context</button>
  <button type="button" id="openSecurityBtnMain" class="menu-list-item ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow">Security</button>
</div>
<div class="tab-section">Cloud &amp; AI Tools</div>
<div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
  <button type="button" id="openUploadBtn" class="menu-list-item">Upload &amp; Validate</button>
  <button type="button" id="openPlatformBtnMain" class="menu-list-item">Platform</button>
  <button type="button" id="openAuditBtnMain" class="menu-list-item">Audit</button>
</div>
</div>
<div class="tab-pane" id="tabAudit" data-sidebar-tab="audit">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Audit</div>
  <div style="display:flex;align-items:center;gap:8px;">
    <div class="db-badge" id="auditBadge" style="background:rgba(245,158,11,0.18);color:#fbbf24;">PENDING</div>
    <button type="button" id="openAuditTabInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
  </div>
</div>
<div class="settings-section-subtitle" style="margin:0 0 12px;">Security audit results and vulnerability assessment.</div>
<div class="settings-kpi-grid">
  <div class="settings-kpi-card">
    <div class="settings-kpi-value red" id="tabAuditVulnerabilities">0</div>
    <div class="settings-kpi-label">Vulnerabilities</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value amber" id="tabAuditSecrets">0</div>
    <div class="settings-kpi-label">Secrets Found</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value green" id="tabAuditChecks">0</div>
    <div class="settings-kpi-label">Checks Passed</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value" id="tabAuditScore">--</div>
    <div class="settings-kpi-label">Audit Score</div>
  </div>
</div>
<div class="settings-section-card">
  <div class="settings-section-title">Actions</div>
  <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
    <button type="button" id="tabAuditRunBtn" class="menu-list-item">Run Audit</button>
    <button type="button" id="tabAuditExportBtn" class="menu-list-item">Export</button>
    <button type="button" id="tabAuditViewBtn" class="menu-list-item">View Report</button>
    <button type="button" id="tabAuditSettingsBtn" class="menu-list-item">Settings</button>
  </div>
</div>
<div class="severity-bar">
  <div class="severity-item"><span class="severity-dot critical"></span><span id="tabAuditCritical">0</span> Critical</div>
  <div class="severity-item"><span class="severity-dot high"></span><span id="tabAuditHigh">0</span> High</div>
  <div class="severity-item"><span class="severity-dot medium"></span><span id="tabAuditMedium">0</span> Med</div>
  <div class="severity-item"><span class="severity-dot low"></span><span id="tabAuditLow">0</span> Low</div>
</div>
<div class="settings-section-card">
  <div class="settings-section-title">Recent Findings</div>
  <div id="tabAuditFindings" style="display:flex;flex-direction:column;gap:8px;">
    <div class="tc-list-item"><span class="tc-list-name" style="color:var(--vscode-descriptionForeground);">No audit data available</span></div>
  </div>
</div>
<div class="settings-section-card" style="background:transparent;border:none;padding:0;">
  <div class="settings-section-title">Finding Categories</div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
    <div class="settings-kpi-card" style="text-align:center;"><div class="settings-kpi-value" style="font-size:20px;">&#x1F4AC;</div><div class="settings-kpi-label">Secrets</div></div>
    <div class="settings-kpi-card" style="text-align:center;"><div class="settings-kpi-value" style="font-size:20px;">&#x1F512;</div><div class="settings-kpi-label">Vulnerabilities</div></div>
    <div class="settings-kpi-card" style="text-align:center;"><div class="settings-kpi-value" style="font-size:20px;">&#x1F527;</div><div class="settings-kpi-label">Code Smells</div></div>
    <div class="settings-kpi-card" style="text-align:center;"><div class="settings-kpi-value" style="font-size:20px;">&#x1F6E1;</div><div class="settings-kpi-label">Compliance</div></div>
  </div>
</div>
</div>
<div class="tab-pane" id="tabUpload" data-sidebar-tab="upload">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Upload</div>
  <div style="display:flex;align-items:center;gap:8px;">
    <div class="db-badge" id="uploadBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">READY</div>
    <button type="button" id="openUploadTabInMainWindowBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Open in Main Window</button>
  </div>
</div>
<div class="settings-section-subtitle" style="margin:0 0 12px;">Upload and validate files for scanning.</div>
<div class="settings-kpi-grid">
  <div class="settings-kpi-card">
    <div class="settings-kpi-value" id="tabUploadTotal">0</div>
    <div class="settings-kpi-label">Total Files</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value green" id="tabUploadValid">0</div>
    <div class="settings-kpi-label">Valid</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value red" id="tabUploadErrors">0</div>
    <div class="settings-kpi-label">Errors</div>
  </div>
  <div class="settings-kpi-card">
    <div class="settings-kpi-value" id="tabUploadScore">--</div>
    <div class="settings-kpi-label">Quality Score</div>
  </div>
</div>
<div class="settings-section-card">
  <div class="settings-section-title">Actions</div>
  <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
    <button type="button" id="tabUploadBrowseBtn" class="menu-list-item">Browse</button>
    <button type="button" id="tabUploadValidateBtn" class="menu-list-item">Validate</button>
    <button type="button" id="tabUploadScanBtn" class="menu-list-item">Scan</button>
    <button type="button" id="tabUploadClearBtn" class="menu-list-item">Clear</button>
  </div>
</div>
<div class="upload-dropzone" id="tabUploadDropzone">
  <div class="upload-dropzone-icon">&#x1F4E4;</div>
  <div class="upload-dropzone-title">Drop files here or click to browse</div>
  <div class="upload-dropzone-subtitle">Supports .js, .ts, .json, and more</div>
</div>
<input type="file" class="upload-file-input" id="tabUploadFileInput" multiple>
<div id="tabUploadFileList" style="display:flex;flex-direction:column;gap:6px;margin-top:12px;"></div>
</div>
<div class="tab-pane" id="tabSettings">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="db-title">Settings</div>
</div>
<div id="settingsMenuTab">
  <div class="tab-section">TOOLS</div>
  <div class="menu-list" style="padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;">
    <button type="button" id="openDiagnoseFromSettingsTab" class="menu-list-item">Diagnose</button>
    <button type="button" id="openRefreshRelayFromSettingsTab" class="menu-list-item">Refresh Relay Port</button>
    <button type="button" id="openSettingsFromSettingsTab" class="menu-list-item">Open Settings</button>
    <button type="button" id="openPlatformFromSettingsTab" class="menu-list-item">Platform</button>
  </div>
  <div class="tab-section" style="margin-top:16px;">SERVER INFO</div>
  <div class="card" id="statusCard">
    <div class="card-icon ok" id="statusIcon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    <div class="card-text">
      <div class="card-label">Status</div>
      <div class="card-value" id="statusText">Analysis complete</div>
    </div>
  </div>
  <div class="card" id="serverCard">
    <div class="card-icon server"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
    <div class="card-text">
      <div class="card-label">Server</div>
      <div class="card-value" id="serverUrlText">http://127.0.0.1:54358</div> <!-- simplebeacon-ignore config-drift — placeholder replaced by updateServerUrl -->
    </div>
  </div>
</div>
</div>
<div id="settingsDetailPanelTab" style="display:none;">
  <div class="diag-back-bar" id="settingsDetailBackBtnTab" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Settings</div>
    <div class="settings-badge" id="settingsSavedBadgeTab">Saved</div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="settingsCriticalCountTab">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="settingsHighCountTab">1</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="settingsMediumCountTab">12</span> Medium</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="settingsLowCountTab">48</span> Low</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="settingsQualityScoreTab">47</div>
      <div class="settings-kpi-label">Quality Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="settingsGateStatusTab">FAIL</div>
      <div class="settings-kpi-label">Gate Status</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="settingsTotalIssuesTab">61</div>
      <div class="settings-kpi-label">Total Issues</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="settingsRepoFilesTab">1,003</div>
      <div class="settings-kpi-label">Repository Files</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="settingsViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">General</div>
    <div class="settings-row">
      <div class="settings-row-left">
        <div class="settings-row-label">Auto Scan on Open</div>
        <div class="settings-row-desc">Run a scan on first workspace open</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggleAutoScanTab" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-row">
      <div class="settings-row-left">
        <div class="settings-row-label">Display</div>
        <div class="settings-row-desc">Open dashboard in main window or sidebar</div>
      </div>
      <select class="settings-select" id="displayModeSelectTab">
        <option value="sidebar">Sidebar</option>
        <option value="mainWindow">Main Window</option>
      </select>
    </div>
    <div class="settings-row">
      <div class="settings-row-left">
        <div class="settings-row-label">Browser Mode</div>
        <div class="settings-row-desc">Open results in browser instead of panel</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggleBrowserModeTab">
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Server</div>
    <div class="settings-row" style="flex-direction:column;align-items:stretch;">
      <div class="settings-row-label">API Server URL</div>
      <div class="settings-row-desc" style="margin-bottom:6px;">Endpoint for scan and report data</div>
      <input type="text" class="settings-input" id="settingsApiInputTab" value="http://127.0.0.1:54358">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px;">
        <button type="button" id="apiPresetLocal" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Local (54358)</button>
        <button type="button" id="apiPresetSlopCop" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">AI Quality Monitor (3004)</button>
        <button type="button" id="apiPresetRemote" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Remote (30011)</button>
      </div>
      <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
        <button type="button" id="settingsSaveBtnTab" class="menu-list-item">Save</button>
        <button type="button" id="settingsTestBtnTab" class="menu-list-item">Test Connection</button>
      </div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Notifications</div>
    <div class="settings-row">
      <div class="settings-row-left">
        <div class="settings-row-label">Scan Complete</div>
        <div class="settings-row-desc">Notify when scan is ready</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggleNotifyScanTab" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-row">
      <div class="settings-row-left">
        <div class="settings-row-label">Gate Failure</div>
        <div class="settings-row-desc">Notify when a gate check fails</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="toggleNotifyGateTab" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="openDiagnoseBtnTab" class="menu-list-item">Diagnose</button>
      <button type="button" id="openRefreshRelayPortBtnTab" class="menu-list-item">Refresh Relay</button>
      <button type="button" id="openSettingsInMainWindowBtnTab" class="menu-list-item">Open in Main Window</button>
      <button type="button" id="refreshSettingsBtnTab" class="menu-list-item">Refresh Settings</button>
    </div>
  </div>
</div>
<button type="button" id="analyzeDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Analyze</button>
<div id="analyzeDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
    <div class="diag-back-bar" id="analyzeDetailBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      <span>Back</span>
    </div>
  </div>
  <div class="settings-header">
    <div class="settings-title">Analyze</div>
    <div class="settings-badge" id="analyzeBadge" style="background:rgba(99,102,241,0.18);color:#818cf8;">READY</div>
  </div>
  <div class="settings-section-subtitle">Scan a repo folder, pick your analyzer mix, and run a full code quality &amp; security analysis.</div>

  <div class="settings-section-card">
    <div class="settings-section-title">Target</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
      <input type="text" class="settings-input" id="sidebarAnalyzePathInput" placeholder="Project path..." value="${escapeHtml(savedProjectPath)}" style="flex:1;margin:0;" />
      <button type="button" id="sidebarAnalyzeBrowseBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Browse</button>
      <button type="button" id="sidebarAnalyzeDetectBtn" class="menu-list-item" style="padding:6px 10px;font-size:11px;width:auto;flex:0;">Detect</button>
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-size:10px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:4px;">Analysis Type</div>
      <select class="settings-select" id="sidebarAnalyzeType">
        <option value="complete">Complete Scan — full analyzer suite</option>
        <option value="quick">Quick Scan — core checks only</option>
        <option value="security">Security Focus — vulnerabilities only</option>
        <option value="quality">Quality Focus — code quality only</option>
      </select>
    </div>
    <div>
      <div style="font-size:10px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:4px;">Minimum Severity</div>
      <select class="settings-select" id="sidebarAnalyzeSeverity">
        <option value="low">Low &amp; above</option>
        <option value="medium" selected>Medium &amp; above</option>
        <option value="high">High &amp; above</option>
        <option value="critical">Critical only</option>
      </select>
    </div>
  </div>

  <div class="settings-section-card">
    <div class="settings-section-title">Quick Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runAnalysisBtn" class="menu-list-item" style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.15));border-color:rgba(139,92,246,0.3);"><span style="margin-right:6px;">&#x25B6;</span> Run Analysis</button>
      <button type="button" id="scanWorkspaceBtn" class="menu-list-item">Enhanced Scan</button>
      <button type="button" id="exportJsonBtn" class="menu-list-item">Export JSON</button>
      <button type="button" id="openAnalyzeInMainWindowBtn" class="menu-list-item" style="text-align:left;display:flex;align-items:center;gap:8px;"><span style="opacity:0.6;">&#x2197;</span> Open in Main Window</button>
    </div>
  </div>

  <div class="settings-section-card">
    <div class="settings-section-title">Analysis Results</div>
    <div class="settings-kpi-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
      <div class="settings-kpi-card">
        <div class="settings-kpi-value green" id="sidebarAnalyzeScore">--</div>
        <div class="settings-kpi-label">Quality Score</div>
      </div>
      <div class="settings-kpi-card">
        <div class="settings-kpi-value" id="sidebarAnalyzeGate">--</div>
        <div class="settings-kpi-label">Gate Status</div>
      </div>
      <div class="settings-kpi-card">
        <div class="settings-kpi-value red" id="sidebarAnalyzeIssues">--</div>
        <div class="settings-kpi-label">Issues Found</div>
      </div>
      <div class="settings-kpi-card">
        <div class="settings-kpi-value blue" id="sidebarAnalyzeFiles">--</div>
        <div class="settings-kpi-label">Files Scanned</div>
      </div>
    </div>
    <div class="sidebar-kpi-view-report">
      <button type="button" id="analyzeViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
    </div>
  </div>

  <div class="settings-section-card">
    <div class="settings-section-title">AI Analysis Tools</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="enhancedAnalysisBtn" class="menu-list-item">Enhanced Analysis</button>
      <button type="button" id="realtimeAnalysisBtn" class="menu-list-item">Real-Time Analysis</button>
      <button type="button" id="patternDetectionBtn" class="menu-list-item">Pattern Detection</button>
      <button type="button" id="modelHealthBtn" class="menu-list-item">Model Health</button>
      <button type="button" id="toggleMonitorBtn" class="menu-list-item">Toggle AI Slop Monitor</button>
    </div>
  </div>
</div>
<button type="button" id="certificateDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Certificate</button>
<div id="certificateDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="certificateDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Certificate</div>
    <div class="settings-badge" id="certificateBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">PASS</div>
  </div>
  <div class="settings-section-subtitle">Quality certification status and compliance overview.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="certificateComplianceScore">100</div>
      <div class="settings-kpi-label">Compliance Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="certificateModulesPassed">0</div>
      <div class="settings-kpi-label">Modules Passed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="certificateLastAudit">--</div>
      <div class="settings-kpi-label">Last Audit</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="certificateExpiryDate">--</div>
      <div class="settings-kpi-label">Expiry Date</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="certificateCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="certificateHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="certificateMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="certificateLow">0</span> Low</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="certificateCritical2">0</div>
      <div class="settings-kpi-label">Critical</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="certificateHigh2">0</div>
      <div class="settings-kpi-label">High</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="certificateMedium2">0</div>
      <div class="settings-kpi-label">Medium</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="certificateLow2">0</div>
      <div class="settings-kpi-label">Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Status</div>
    <div id="certificateStatusList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="cert-status-row"><span class="cert-status-label">Repository Files</span><span class="cert-status-value" id="certificateRepoFiles">0</span></div>
      <div class="cert-status-row"><span class="cert-status-label">Gate Checked</span><span class="cert-status-value" id="certificateGateChecked">PASS</span></div>
      <div class="cert-status-row"><span class="cert-status-label">Last Scan</span><span class="cert-status-value" id="certificateLastScan">--</span></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="generateCertificateBtn" class="menu-list-item">Generate</button>
      <button type="button" id="exportCertificatePdfBtn" class="menu-list-item">Export PDF</button>
      <button type="button" id="viewCertificateReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openCertificateInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Compliance Requirements</div>
    <div id="certificateRequirementsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="cert-req-row"><svg class="cert-req-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cert-req-name">Security gate scan passed</span><span class="tc-list-meta">Pass</span></div>
      <div class="cert-req-row"><svg class="cert-req-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cert-req-name">No critical vulnerabilities found</span><span class="tc-list-meta">Pass</span></div>
      <div class="cert-req-row"><svg class="cert-req-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cert-req-name">Code quality score above threshold</span><span class="tc-list-meta">Pass</span></div>
      <div class="cert-req-row"><svg class="cert-req-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cert-req-name">AI & LLM compliance verified</span><span class="tc-list-meta">Pass</span></div>
      <div class="cert-req-row"><svg class="cert-req-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cert-req-name">Repository files scanned</span><span class="tc-list-meta">Pass</span></div>
    </div>
  </div>
</div>
<button type="button" id="codeMapDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Code Map</button>
<div id="codeMapDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="codeMapDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Code Map</div>
    <div class="settings-badge" id="codeMapStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">GENERATED</div>
  </div>
  <div class="settings-section-subtitle">Architecture, modules, and dependency visualization.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="codeMapFiles">0</div>
      <div class="settings-kpi-label">Files</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="codeMapModules">0</div>
      <div class="settings-kpi-label">Modules</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="codeMapTotalLines">0</div>
      <div class="settings-kpi-label">Total Lines</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="codeMapLastScan">--</div>
      <div class="settings-kpi-label">Last Scan</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="codeMapViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="code-map-detail-section">
    <div class="settings-section-card">
      <div class="settings-section-title">Languages</div>
      <div id="codeMapLanguagesList" style="display:flex;flex-direction:column;gap:6px;">
        <div class="code-map-lang-row"><span class="code-map-lang-name">.md</span><div class="code-map-lang-bar"><div class="code-map-lang-fill" style="width:21%;background:#4ade80;"></div></div><span class="code-map-lang-count">21</span></div>
      </div>
    </div>
    <div class="settings-section-card">
      <div class="settings-section-title">Scan Details</div>
      <div id="codeMapScanDetailsList" style="display:flex;flex-direction:column;gap:8px;">
        <div class="code-map-detail-row"><span class="code-map-detail-label">Repository Files</span><span class="code-map-detail-value" id="codeMapRepoFiles">0</span></div>
        <div class="code-map-detail-row"><span class="code-map-detail-label">Total Lines</span><span class="code-map-detail-value" id="codeMapTotalLines2">0</span></div>
        <div class="code-map-detail-row"><span class="code-map-detail-label">Last Scan</span><span class="code-map-detail-value" id="codeMapLastScan2">--</span></div>
      </div>
    </div>
    <div class="settings-section-card">
      <div class="settings-section-title">Actions</div>
      <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
        <button type="button" id="generateCodeMapBtn" class="menu-list-item">Generate</button>
        <button type="button" id="openCodeMapHtmlBtn" class="menu-list-item">Open in Browser</button>
        <button type="button" id="exportCodeMapBtn" class="menu-list-item">Export</button>
        <button type="button" id="refreshCodeMapBtn" class="menu-list-item">Refresh</button>
        <button type="button" id="openCodeMapInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
      </div>
    </div>
  </div>
</div>
<button type="button" id="roadmapDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Roadmap</button>
<div id="roadmapDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="roadmapDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Roadmap</div>
    <div class="settings-badge" id="roadmapStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">ACTIVE</div>
  </div>
  <div class="settings-section-subtitle">Remediation planning and task tracking.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="roadmapOpenVulns">0</div>
      <div class="settings-kpi-label">Open Vulnerabilities</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="roadmapRiskScore">0</div>
      <div class="settings-kpi-label">Risk Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="roadmapCompleted">0</div>
      <div class="settings-kpi-label">Completed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="roadmapTargetDate">--</div>
      <div class="settings-kpi-label">Target Date</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="roadmapViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="severity-bar" id="roadmapSeverityBar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="roadmapCritical">0 Critical</span></div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="roadmapHigh">0 High</span></div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="roadmapMedium">0 Med</span></div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="roadmapLow">0 Low</span></div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Phases</div>
    <div id="roadmapPhasesList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="roadmap-phase-row"><span class="roadmap-phase-dot"></span><span class="roadmap-phase-name">Phase 1: Triage & Assessment</span><span class="roadmap-phase-tasks" id="roadmapPhase1Tasks">0 / 0 tasks</span></div>
      <div class="roadmap-phase-row"><span class="roadmap-phase-dot"></span><span class="roadmap-phase-name">Phase 2: Short-Term Fixes</span><span class="roadmap-phase-tasks" id="roadmapPhase2Tasks">0 / 0 tasks</span></div>
      <div class="roadmap-phase-row"><span class="roadmap-phase-dot"></span><span class="roadmap-phase-name">Phase 3: Long-Term Architecture</span><span class="roadmap-phase-tasks" id="roadmapPhase3Tasks">0 / 50 tasks</span></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="openRoadmapBtn2" class="menu-list-item">Open Roadmap</button>
      <button type="button" id="generateRoadmapBtn" class="menu-list-item">Generate</button>
      <button type="button" id="exportRoadmapBtn" class="menu-list-item">Export</button>
      <button type="button" id="openRoadmapInMainWindowBtn2" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
</div>
<button type="button" id="aiContextDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">AI Context</button>
<div id="aiContextDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="aiContextDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">AI Context</div>
    <div class="settings-badge" id="aiContextBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">CLEAR</div>
  </div>
  <div class="settings-section-subtitle">AI interaction context, model usage, and slop detection.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="aiContextModels">0</div>
      <div class="settings-kpi-label">Models Detected</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="aiContextIssues">0</div>
      <div class="settings-kpi-label">AI Issues</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="aiContextScore">100</div>
      <div class="settings-kpi-label">Context Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="aiContextFiles">0</div>
      <div class="settings-kpi-label">Files Scanned</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="aiContextCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="aiContextHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="aiContextMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="aiContextLow">0</span> Low</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="aiContextCritical2">0</div>
      <div class="settings-kpi-label">Critical</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="aiContextHigh2">0</div>
      <div class="settings-kpi-label">High</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="aiContextMedium2">0</div>
      <div class="settings-kpi-label">Medium</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="aiContextLow2">0</div>
      <div class="settings-kpi-label">Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="scanAiContextBtn" class="menu-list-item">Scan</button>
      <button type="button" id="exportAiContextBtn" class="menu-list-item">Export</button>
      <button type="button" id="viewAiContextReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openAiContextInMainWindowBtn2" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Detected Models</div>
    <div id="aiContextModelsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="ai-context-model-row"><div class="ai-context-model-avatar">AI</div><div class="ai-context-model-info"><div class="ai-context-model-name">Generic AI Assistant</div><div class="ai-context-model-desc">Common patterns detected</div></div><span class="tc-list-meta">Monitoring</span></div>
      <div class="ai-context-model-row"><div class="ai-context-model-avatar">AI</div><div class="ai-context-model-info"><div class="ai-context-model-name">Code Generator</div><div class="ai-context-model-desc">Slop / boilerplate patterns</div></div><span class="tc-list-meta">Monitoring</span></div>
      <div class="ai-context-model-row"><div class="ai-context-model-avatar">AI</div><div class="ai-context-model-info"><div class="ai-context-model-name">Documentation Bot</div><div class="ai-context-model-desc">Inline comment patterns</div></div><span class="tc-list-meta">Monitoring</span></div>
    </div>
  </div>
</div>
<button type="button" id="uploadDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Upload</button>
<div id="uploadDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="uploadDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Upload</div>
    <div class="settings-badge" id="uploadStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">READY</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="uploadTotalFiles">0</div>
      <div class="settings-kpi-label">Total Files</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="uploadValid">0</div>
      <div class="settings-kpi-label">Valid</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="uploadErrors">0</div>
      <div class="settings-kpi-label">Errors</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="uploadScore">--</div>
      <div class="settings-kpi-label">Quality Score</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="uploadViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="sidebarUploadBrowseBtn" class="menu-list-item">Browse Files</button>
      <button type="button" id="sidebarUploadValidateBtn" class="menu-list-item">Validate</button>
      <button type="button" id="sidebarUploadClearBtn" class="menu-list-item">Clear</button>
      <button type="button" id="sidebarUploadScanBtn" class="menu-list-item">Scan</button>
    </div>
    <input type="file" class="upload-file-input" id="sidebarUploadFileInput" multiple style="display:none;">
    <div class="upload-dropzone" id="sidebarUploadDropzone" style="margin-top:12px;">
      <div class="upload-dropzone-icon">&#x1F4E4;</div>
      <div class="upload-dropzone-title">Drop files here or click to browse</div>
      <div class="upload-dropzone-subtitle">Supports .js, .ts, .json, .zip, .md, .txt, .csv, .xml, .html, .css, .yml, .yaml</div>
    </div>
    <div id="sidebarUploadList" style="display:flex;flex-direction:column;gap:6px;margin-top:12px;"></div>
    <div class="upload-result-box" id="sidebarUploadResultBox" style="display:none;margin-top:12px;">
      <div class="upload-result-title" id="sidebarUploadResultTitle"></div>
      <div class="upload-result-list" id="sidebarUploadResultList"></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Configuration</div>
    <div class="tc-list" id="uploadConfigList">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Supported Formats</span></div><span class="tc-list-meta" id="uploadFormats">js, ts, json</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Max File Size</span></div><span class="tc-list-meta" id="uploadMaxSize">50MB</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Auto Scan</span></div><span class="tc-list-meta" id="uploadAutoScan">Off</span></div>
    </div>
  </div>
</div>
<button type="button" id="auditDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Report</button>
<button type="button" id="securityDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Security</button>
<div id="securityDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="securityDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Security</div>
    <div class="settings-badge" id="securityPassBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">PASS</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="securityCritical">0</div>
      <div class="settings-kpi-label">Critical</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="securityHigh">0</div>
      <div class="settings-kpi-label">High</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="securityMedium">0</div>
      <div class="settings-kpi-label">Medium</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="securityScore">100</div>
      <div class="settings-kpi-label">Security Score</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Severity Breakdown</div>
    <div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px;">
      <span id="securitySeverityTotal" style="font-size:20px;font-weight:700;">0</span>
      <span style="font-size:12px;color:var(--vscode-descriptionForeground);">total issues</span>
    </div>
    <div class="security-severity-stack" style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,0.06);">
      <div id="securityStackCritical" style="width:0%;background:#ef4444;transition:width 0.3s ease;"></div>
      <div id="securityStackHigh" style="width:0%;background:#f97316;transition:width 0.3s ease;"></div>
      <div id="securityStackMedium" style="width:0%;background:#3b82f6;transition:width 0.3s ease;"></div>
      <div id="securityStackLow" style="width:0%;background:#22c55e;transition:width 0.3s ease;"></div>
    </div>
    <div class="severity-bar" style="margin-top:10px;">
      <div class="severity-item"><span class="severity-dot critical"></span><span id="securityCritical2">0</span> Critical</div>
      <div class="severity-item"><span class="severity-dot high"></span><span id="securityHigh2">0</span> High</div>
      <div class="severity-item"><span class="severity-dot medium"></span><span id="securityMedium2">0</span> Med</div>
      <div class="severity-item"><span class="severity-dot low"></span><span id="securityLow2">0</span> Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runSecurityScanBtn" class="menu-list-item">Scan</button>
      <button type="button" id="openSecurityReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openSecurityInMainWindowBtn" class="menu-list-item" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;"><span style="opacity:0.6;">&#x2197;</span> Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Detected Threats</div>
    <div id="securityThreatsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">No threats detected</span></div><span class="tc-list-meta">0</span></div>
    </div>
  </div>
</div>
<button type="button" id="trustDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Trust</button>
<div id="trustDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="trustDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Trust</div>
    <div class="settings-badge" id="trustVerifiedBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">VERIFIED</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="trustScore">100</div>
      <div class="settings-kpi-label">Trust Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="trustVerified">Yes</div>
      <div class="settings-kpi-label">Verified Checks</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="trustWarnings">0</div>
      <div class="settings-kpi-label">Warnings</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="trustLastAudit">--</div>
      <div class="settings-kpi-label">Last Audit</div>
    </div>
  </div>
  <div class="profile-severity-bar">
    <div style="display:flex;align-items:center;gap:6px;"><div class="profile-severity-dot red"></div><span id="trustCritical">0 Critical</span></div>
    <div style="display:flex;align-items:center;gap:6px;"><div class="profile-severity-dot amber"></div><span id="trustHigh">0 High</span></div>
    <div style="display:flex;align-items:center;gap:6px;"><div class="profile-severity-dot blue"></div><span id="trustMedium">0 Med</span></div>
    <div style="display:flex;align-items:center;gap:6px;"><div class="profile-severity-dot green"></div><span id="trustLow">0 Low</span></div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button type="button" id="verifyTrustBtn" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;background:var(--vscode-button-background,#0e639c);color:var(--vscode-button-foreground,#fff);border:none;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Verify
      </button>
      <button type="button" id="openTrustReportBtn" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;background:var(--vscode-input-background,rgba(255,255,255,0.03));color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-panel-border,rgba(255,255,255,0.06));font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        View Report
      </button>
    </div>
    <div style="margin-top:8px;">
      <button type="button" id="openTrustInMainWindowBtn" class="menu-list-item" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;"><span style="opacity:0.6;">&#x2197;</span> Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Trust Status</div>
    <div id="trustStatusList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">All checks passed</span></div><span class="tc-list-meta">OK</span></div>
    </div>
  </div>
</div>
<div id="auditDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="auditDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Audit</div>
    <div class="settings-badge" id="auditPassBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">PASS</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="auditVulnerabilities">0</div>
      <div class="settings-kpi-label">Vulnerabilities</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="auditSecrets">0</div>
      <div class="settings-kpi-label">Secrets Found</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="auditChecksPassed">100</div>
      <div class="settings-kpi-label">Checks Passed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="auditScore">100</div>
      <div class="settings-kpi-label">Audit Score</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="auditCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="auditHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="auditMedium">2</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="auditLow">284</span> Low</div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="openAuditBtn2" class="menu-list-item">Run Audit</button>
      <button type="button" id="openAuditReportBtn2" class="menu-list-item">Audit Report</button>
      <button type="button" id="openAuditInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Recent Findings</div>
    <div id="auditFindingsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">No new findings</span></div><span class="tc-list-meta">0</span></div>
    </div>
  </div>
</div>
<button type="button" id="qualityDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Quality</button>
<div id="qualityDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="qualityDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Quality</div>
    <div class="settings-badge" id="qualityBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">PASS</div>
  </div>
  <div class="settings-section-subtitle">Code health, complexity, and maintainability.</div>
  <div class="settings-kpi-grid" style="grid-template-columns:repeat(2,1fr);align-items:stretch;">
    <div class="settings-kpi-card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:140px;">
      <div id="qualityScoreRing" style="width:90px;height:90px;position:relative;display:flex;align-items:center;justify-content:center;">
        <svg width="90" height="90" viewBox="0 0 100 100" style="position:absolute;transform:rotate(-90deg);">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
          <circle id="qualityScoreProgress" cx="50" cy="50" r="42" fill="none" stroke="#4ade80" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="0"/>
        </svg>
        <div style="font-size:22px;font-weight:800;color:#4ade80;position:relative;z-index:1;" id="qualityScore">100</div>
      </div>
      <div class="settings-kpi-label" style="margin-top:8px;">Quality Score</div>
    </div>
    <div class="settings-kpi-card" style="display:flex;flex-direction:column;justify-content:center;gap:10px;min-height:140px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div class="settings-kpi-label">Issues</div>
        <div class="settings-kpi-value red" id="qualityIssues">0</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
        <div class="settings-kpi-label">Files</div>
        <div class="settings-kpi-value blue" id="qualityFiles">0</div>
      </div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Severity Breakdown</div>
    <div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px;">
      <span id="qualitySeverityTotal" style="font-size:20px;font-weight:700;">0</span>
      <span style="font-size:12px;color:var(--vscode-descriptionForeground);">total issues</span>
    </div>
    <div class="quality-severity-stack" style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,0.06);">
      <div id="qualityStackCritical" style="width:0%;background:#ef4444;transition:width 0.3s ease;"></div>
      <div id="qualityStackHigh" style="width:0%;background:#f97316;transition:width 0.3s ease;"></div>
      <div id="qualityStackMedium" style="width:0%;background:#3b82f6;transition:width 0.3s ease;"></div>
      <div id="qualityStackLow" style="width:0%;background:#22c55e;transition:width 0.3s ease;"></div>
    </div>
    <div class="severity-bar" style="margin-top:10px;">
      <div class="severity-item"><span class="severity-dot critical"></span><span id="qualityCritical">0</span> Critical</div>
      <div class="severity-item"><span class="severity-dot high"></span><span id="qualityHigh">0</span> High</div>
      <div class="severity-item"><span class="severity-dot medium"></span><span id="qualityMedium">0</span> Med</div>
      <div class="severity-item"><span class="severity-dot low"></span><span id="qualityLow">0</span> Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Quality Dimensions</div>
    <div id="qualityDimensionsList" style="display:flex;flex-direction:column;gap:10px;">
      <div class="quality-dim-row"><div class="quality-dim-name">Maintainability</div><div class="quality-dim-score green" id="qualityMaintainability">100</div></div>
      <div class="quality-dim-bar"><div class="quality-dim-fill" id="qualityMaintainabilityBar" style="width:100%;background:#4ade80;"></div></div>
      <div class="quality-dim-row"><div class="quality-dim-name">Reliability</div><div class="quality-dim-score green" id="qualityReliability">100</div></div>
      <div class="quality-dim-bar"><div class="quality-dim-fill" id="qualityReliabilityBar" style="width:100%;background:#4ade80;"></div></div>
      <div class="quality-dim-row"><div class="quality-dim-name">Complexity</div><div class="quality-dim-score green" id="qualityComplexity">100</div></div>
      <div class="quality-dim-bar"><div class="quality-dim-fill" id="qualityComplexityBar" style="width:100%;background:#4ade80;"></div></div>
      <div class="quality-dim-row"><div class="quality-dim-name">Duplication</div><div class="quality-dim-score green" id="qualityDuplication">95</div></div>
      <div class="quality-dim-bar"><div class="quality-dim-fill" id="qualityDuplicationBar" style="width:95%;background:#4ade80;"></div></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runQualityBtn" class="menu-list-item">Analyze</button>
      <button type="button" id="exportQualityBtn" class="menu-list-item">Export</button>
      <button type="button" id="viewQualityReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openQualityInMainWindowBtn" class="menu-list-item" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;"><span style="opacity:0.6;">&#x2197;</span> Open in Main Window</button>
    </div>
  </div>
</div>
<button type="button" id="assessmentsDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Assessments</button>
<div id="assessmentsDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="assessmentsDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Assessments</div>
    <div class="settings-badge" id="assessmentsBadge" style="background:rgba(245,158,11,0.18);color:#fbbf24;">PENDING</div>
  </div>
  <div class="settings-section-subtitle">Assessment checklist and compliance evaluation.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="assessmentsCompleted">--</div>
      <div class="settings-kpi-label">Completed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="assessmentsPending">--</div>
      <div class="settings-kpi-label">Pending</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="assessmentsProgress">--</div>
      <div class="settings-kpi-label">Progress</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="assessmentsTotalChecks">--</div>
      <div class="settings-kpi-label">Total Checks</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="assessmentsCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="assessmentsHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="assessmentsMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="assessmentsLow">0</span> Low</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="assessmentsCritical2">0</div>
      <div class="settings-kpi-label">Critical</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="assessmentsHigh2">0</div>
      <div class="settings-kpi-label">High</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="assessmentsMedium2">0</div>
      <div class="settings-kpi-label">Medium</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="assessmentsLow2">0</div>
      <div class="settings-kpi-label">Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runAssessmentsBtn" class="menu-list-item">Run</button>
      <button type="button" id="exportAssessmentsBtn" class="menu-list-item">Export</button>
      <button type="button" id="viewAssessmentsReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openAssessmentsInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Overall Completion</div>
    <div class="tc-progress-row"><span id="assessmentsCompletion">0%</span></div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Assessment Checklist</div>
    <div id="assessmentsChecklist" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Code quality gate passed</span></div><span class="tc-list-meta">Pending</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Security scan completed</span></div><span class="tc-list-meta">Pending</span></div>
    </div>
  </div>
</div>
<div id="platformDetailPanel" data-sidebar-tab="settings" style="display:none;">
  <div class="diag-back-bar" id="platformDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Platform</div>
    <div class="settings-badge" id="platformStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">Online</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="platformVersion">3.0.309</div>
      <div class="settings-kpi-label">Version</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="platformEngine">VS Code</div>
      <div class="settings-kpi-label">Engine</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="platformUptime">Active</div>
      <div class="settings-kpi-label">Uptime</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="platformStatus">Connected</div>
      <div class="settings-kpi-label">Status</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="platformViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="platformRefreshBtn" class="menu-list-item">Refresh</button>
      <button type="button" id="platformExportBtn" class="menu-list-item">Export</button>
      <button type="button" id="platformDocsBtn" class="menu-list-item">Docs</button>
      <button type="button" id="platformSettingsBtn" class="menu-list-item">Settings</button>
      <button type="button" id="openPlatformInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="profile-severity-bar">
    <div class="profile-severity-dot red"></div><span id="platformCritical">0 Critical</span>
    <div class="profile-severity-dot amber"></div><span id="platformHigh">0 High</span>
    <div class="profile-severity-dot blue"></div><span id="platformMedium">0 Med</span>
    <div class="profile-severity-dot green"></div><span id="platformLow">0 Low</span>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Quality Summary</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Quality Score</span></div><span class="tc-list-meta" id="platformQualityScore">100</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Total Issues</span></div><span class="tc-list-meta" id="platformTotalIssues">0</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Gate Status</span></div><span class="tc-list-meta" id="platformGateStatus">PASS</span></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">System Information</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span><span class="tc-list-name">OS</span></div><span class="tc-list-meta" id="platformOs">win32</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span><span class="tc-list-name">Node Version</span></div><span class="tc-list-meta" id="platformNode">v22.21.1</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span><span class="tc-list-name">Extension Version</span></div><span class="tc-list-meta" id="platformExtension">3.0.309</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span><span class="tc-list-name">Workspace</span></div><span class="tc-list-meta" id="platformWorkspace">c:\Users\Trevor\CascadeProjects</span></div>
    </div>
  </div>
</div>
<button type="button" id="profileDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Profile</button>
<div id="profileDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
    <div class="diag-back-bar" id="profileDetailBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      <span>Back</span>
    </div>
  </div>
  <div class="settings-header">
    <div class="settings-title">Profile</div>
    <div class="settings-badge" id="profileStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">ACTIVE</div>
  </div>
  <div class="settings-section-subtitle">Enter your extension profile and preferences.</div>
  <div class="severity-bar" id="profileSeverityBar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="profileCritical">0 Critical</span></div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="profileHigh">0 High</span></div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="profileMedium">0 Med</span></div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="profileLow">0 Low</span></div>
  </div>
  <div class="db-sev-grid" id="profileSevGrid">
    <div class="db-sev-card">
      <div class="db-sev-count crit" id="profileCritCount">0</div>
      <div class="db-sev-name">Critical</div>
    </div>
    <div class="db-sev-card high">
      <div class="db-sev-count high" id="profileHighCount">0</div>
      <div class="db-sev-name">High</div>
    </div>
    <div class="db-sev-card med">
      <div class="db-sev-count med" id="profileMedCount">0</div>
      <div class="db-sev-name">Medium</div>
    </div>
    <div class="db-sev-card low">
      <div class="db-sev-count low" id="profileLowCount">0</div>
      <div class="db-sev-name">Low</div>
    </div>
  </div>
  <div class="sidebar-kpi-view-report">
    <button type="button" id="profileViewReportBtn" class="menu-list-item sidebar-view-report-btn">View Report</button>
  </div>
  <div class="profile-summary-grid">
    <div class="profile-summary-row"><span class="profile-summary-key">Quality Score</span><span class="profile-summary-val" id="profileQualityScore">100</span></div>
    <div class="profile-summary-row"><span class="profile-summary-key">Issues Found</span><span class="profile-summary-val" id="profileIssuesFound">0</span></div>
    <div class="profile-summary-row"><span class="profile-summary-key">Gate Status</span><span class="profile-summary-val" id="profileGateStatus">PASS</span></div>
  </div>
  <div class="profile-grid">
    <div class="profile-card">
      <div class="profile-card-title">Profile Information</div>
      <div class="profile-form">
        <label class="profile-form-label">Display Name</label>
        <input type="text" class="profile-form-input" id="profileDisplayName" placeholder="Your name" />
        <label class="profile-form-label">Email</label>
        <input type="text" class="profile-form-input" id="profileEmail" placeholder="you@example.com" />
        <label class="profile-form-label">Role</label>
        <select class="profile-form-select" id="profileRole">
          <option value="">Select a role</option>
          <option value="developer">Developer</option>
          <option value="teamLead">Team Lead</option>
          <option value="security">Security Engineer</option>
          <option value="auditor">Auditor</option>
        </select>
        <label class="profile-form-label">Organization</label>
        <input type="text" class="profile-form-input" id="profileOrganization" placeholder="Company or team name" />
        <div class="profile-form-actions" style="display:flex;flex-direction:column;gap:6px;">
          <button type="button" id="profileSaveBtn" class="menu-list-item">Save Profile</button>
          <button type="button" id="profileClearBtn" class="menu-list-item">Clear</button>
          <button type="button" id="openProfileDetailInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
        </div>
      </div>
    </div>
    <div class="profile-right-col">
      <div class="profile-card">
        <div class="profile-card-title">Activity Stats</div>
        <div class="profile-stats-grid">
          <div class="profile-stat-item"><div class="profile-stat-value" id="profileScansRun">1</div><div class="profile-stat-label">Scans Run</div></div>
          <div class="profile-stat-item"><div class="profile-stat-value" id="profileReports">1</div><div class="profile-stat-label">Reports</div></div>
          <div class="profile-stat-item"><div class="profile-stat-value" id="profileActivityIssues">0</div><div class="profile-stat-label">Issues Found</div></div>
          <div class="profile-stat-item"><div class="profile-stat-value" id="profileAvgScore">100</div><div class="profile-stat-label">Avg Score</div></div>
        </div>
      </div>
      <div class="profile-card">
        <div class="profile-card-title">Preferences</div>
        <div class="profile-toggle-row"><span class="profile-toggle-label">Auto-scan on open</span><label class="profile-toggle"><input type="checkbox" id="profileAutoScan" /><span class="profile-toggle-slider"></span></label></div>
        <div class="profile-toggle-row"><span class="profile-toggle-label">Notifications</span><label class="profile-toggle"><input type="checkbox" id="profileNotifications" /><span class="profile-toggle-slider"></span></label></div>
        <div class="profile-toggle-row"><span class="profile-toggle-label">Dark mode</span><label class="profile-toggle"><input type="checkbox" id="profileDarkMode" checked /><span class="profile-toggle-slider"></span></label></div>
      </div>
      <div class="profile-card">
        <div class="profile-card-title">Recent Activity</div>
        <div id="profileRecentActivity">
          <div class="profile-activity-item">
            <span class="profile-activity-dot"></span>
            <span class="profile-activity-text">Scan completed — 0 issues found</span>
            <span class="profile-activity-time">12:21:07 PM</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<button type="button" id="complianceDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Compliance</button>
<div id="complianceDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="complianceDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Compliance</div>
    <div class="settings-badge" id="complianceBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">PASS</div>
  </div>
  <div class="settings-section-subtitle">Compliance checklist and regulatory requirements.</div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="compliancePassed">5</div>
      <div class="settings-kpi-label">Passed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="complianceFailed">0</div>
      <div class="settings-kpi-label">Failed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="complianceProgress">100%</div>
      <div class="settings-kpi-label">Progress</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value" id="complianceTotalRules">5</div>
      <div class="settings-kpi-label">Total Rules</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="complianceCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="complianceHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="complianceMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="complianceLow">0</span> Low</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="complianceCritical2">0</div>
      <div class="settings-kpi-label">Critical</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="complianceHigh2">0</div>
      <div class="settings-kpi-label">High</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="complianceMedium2">0</div>
      <div class="settings-kpi-label">Medium</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="complianceLow2">0</div>
      <div class="settings-kpi-label">Low</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runComplianceBtn" class="menu-list-item">Run Check</button>
      <button type="button" id="exportComplianceBtn" class="menu-list-item">Export</button>
      <button type="button" id="viewComplianceReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openComplianceInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Compliance Requirements</div>
    <div id="complianceRequirementsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">No sensitive data in logs</span></div><span class="tc-list-meta">Pass</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot amber"></span><span class="tc-list-name">Dependency license compliance</span></div><span class="tc-list-meta">Pass</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Code of conduct present</span></div><span class="tc-list-meta">Pass</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Security policy defined</span></div><span class="tc-list-meta">Pass</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Contributing guidelines</span></div><span class="tc-list-meta">Pass</span></div>
    </div>
  </div>
</div>
<button type="button" id="repoHealthDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Repo Health</button>
<div id="repoHealthDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="repoHealthDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Repo Health</div>
    <div class="settings-badge" id="repoHealthStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">Ready</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="repoHealthScore">--</div>
      <div class="settings-kpi-label">Quality Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="repoHealthGate">--</div>
      <div class="settings-kpi-label">Gate Status</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="repoHealthTotalIssues">0</div>
      <div class="settings-kpi-label">Total Issues</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="repoHealthFilesScanned">--</div>
      <div class="settings-kpi-label">Files Scanned</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="repoHealthRunScanBtn" class="menu-list-item">Run Scan</button>
      <button type="button" id="repoHealthExportBtn" class="menu-list-item">Export</button>
      <button type="button" id="repoHealthViewReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="repoHealthSettingsBtn" class="menu-list-item">Settings</button>
    </div>
  </div>
  <div class="profile-severity-bar">
    <div class="profile-severity-dot red"></div><span id="repoHealthCritical">0 Critical</span>
    <div class="profile-severity-dot amber"></div><span id="repoHealthHigh">0 High</span>
    <div class="profile-severity-dot blue"></div><span id="repoHealthMedium">0 Med</span>
    <div class="profile-severity-dot green"></div><span id="repoHealthLow">0 Low</span>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Health Metrics</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Maintainability</span></div><span class="tc-list-meta" id="repoHealthMaintainability">--</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Reliability</span></div><span class="tc-list-meta" id="repoHealthReliability">--</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Complexity</span></div><span class="tc-list-meta" id="repoHealthComplexity">--</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Duplication</span></div><span class="tc-list-meta" id="repoHealthDuplication">--</span></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Recent Findings</div>
    <div id="repoHealthFindings" class="tc-list" style="gap:8px;">
      <div class="tc-list-item"><span class="tc-list-name" style="color:var(--vscode-descriptionForeground);">No scan data yet. Click Run Scan to scan the workspace.</span></div>
    </div>
  </div>
  <div class="settings-section-card" style="background:rgba(245,158,11,0.08);border-color:rgba(245,158,11,0.2);">
    <div class="settings-section-title" style="color:#fbbf24;">Recommendations</div>
    <div class="tc-list" style="gap:8px;">
      <div class="tc-list-item"><span class="tc-list-name" id="repoHealthRecommendations">Run a scan to receive personalized repository health recommendations.</span></div>
    </div>
  </div>
</div>
<button type="button" id="analyticsDropdownHeader" data-sidebar-tab="advanced" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Analytics</button>
<div id="analyticsDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="analyticsDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Analytics</div>
    <div class="settings-badge" id="analyticsStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">Ready</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="analyticsTotalScans">0</div>
      <div class="settings-kpi-label">Total Scans</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="analyticsIssuesFound">0</div>
      <div class="settings-kpi-label">Issues Found</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="analyticsAvgScore">--</div>
      <div class="settings-kpi-label">Avg Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="analyticsFilesScanned">0</div>
      <div class="settings-kpi-label">Files Scanned</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="analyticsRefreshBtn" class="menu-list-item">Refresh</button>
      <button type="button" id="analyticsExportBtn" class="menu-list-item">Export</button>
      <button type="button" id="analyticsViewReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="analyticsSettingsBtn" class="menu-list-item">Settings</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Severity Breakdown</div>
    <div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px;">
      <span id="analyticsSeverityTotal" style="font-size:20px;font-weight:700;">0</span>
      <span style="font-size:12px;color:var(--vscode-descriptionForeground);">total issues</span>
    </div>
    <div class="analytics-severity-stack" style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,0.06);">
      <div id="analyticsStackCritical" style="width:0%;background:#ef4444;transition:width 0.3s ease;"></div>
      <div id="analyticsStackHigh" style="width:0%;background:#f97316;transition:width 0.3s ease;"></div>
      <div id="analyticsStackMedium" style="width:0%;background:#3b82f6;transition:width 0.3s ease;"></div>
      <div id="analyticsStackLow" style="width:0%;background:#22c55e;transition:width 0.3s ease;"></div>
    </div>
    <div class="profile-severity-bar" style="margin-top:10px;">
      <div class="profile-severity-dot red"></div><span id="analyticsCritical">0 Critical</span>
      <div class="profile-severity-dot amber"></div><span id="analyticsHigh">0 High</span>
      <div class="profile-severity-dot blue"></div><span id="analyticsMedium">0 Med</span>
      <div class="profile-severity-dot green"></div><span id="analyticsLow">0 Low</span>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Latest Scan</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Last Scan</span></div><span class="tc-list-meta" id="analyticsLastScan">--</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Files Scanned</span></div><span class="tc-list-meta" id="analyticsSummaryFilesScanned">0</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Avg Score</span></div><span class="tc-list-meta" id="analyticsSummaryAvgScore">--</span></div>
    </div>
  </div>
</div>
<div id="teamDetailPanel" data-sidebar-tab="team" style="display:none;">
</div>
<button type="button" id="scanDropdownHeader" data-sidebar-tab="scan" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Scan</button>
<div id="scanDetailPanel" data-sidebar-tab="scan" style="display:none;">
  <div class="diag-back-bar" id="scanDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Scan</div>
    <div class="settings-badge" id="scanStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">READY</div>
  </div>
  <div class="settings-section-subtitle">Scan configuration and execution status.</div>
  <div class="tc-list-item" style="margin:8px 0;padding:10px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.04);">
    <div class="tc-list-item-left"><span class="tc-list-dot green" id="scanStatusDot"></span><span class="tc-list-name" id="scanStatusText">Ready</span></div>
    <span class="tc-list-meta" id="scanStatusMeta">--</span>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="scanTotalScans">0</div>
      <div class="settings-kpi-label">Total Scans</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="scanIssues">0</div>
      <div class="settings-kpi-label">Issues</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="scanFixed">0</div>
      <div class="settings-kpi-label">Fixed</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="scanScore">--</div>
      <div class="settings-kpi-label">Scan Score</div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="scanCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="scanHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="scanMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="scanLow">0</span> Low</div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="menu-list" style="display:flex;flex-direction:column;gap:6px;">
      <button type="button" id="runScanBtn" class="menu-list-item">Start Scan</button>
      <button type="button" id="exportScanBtn" class="menu-list-item">Export</button>
      <button type="button" id="viewScanReportBtn" class="menu-list-item">View Report</button>
      <button type="button" id="openScanInMainWindowBtn" class="menu-list-item">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Scan Results</div>
    <div id="scanResultsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">No results yet</span></div><span class="tc-list-meta">--</span></div>
    </div>
  </div>
</div>
<button type="button" id="toggleMonitorSidebarBtn" data-sidebar-tab="dashboard" class="menu-list-item ${displayMode === 'sidebar' ? '' : 'hidden'}">Toggle AI Quality Monitor</button>
<div id="diagnoseResultsContainer" style="display:none; background: var(--vscode-editor-background, #1e1e1e); overflow-y: auto;">
  <div class="diag-back-bar" id="diagnoseBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="diag-title">All Issues</div>
  <div id="diagnoseStatusBadge" class="diag-status" style="display:none;"></div>
  <div id="diagnoseResults" class="diag-results"></div>
</div>
<div id="diagnoseDetailPanel" data-sidebar-tab="settings" style="display:none;">
  <div class="diag-back-bar" id="diagnoseDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Diagnose</div>
    <div class="settings-badge" id="diagnoseDetailBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">All Clear</div>
  </div>
  <div class="settings-section-subtitle">Runtime diagnostics and health checks.</div>
  <div class="settings-kpi-grid" style="grid-template-columns:repeat(2,1fr);">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="diagnoseDetailRelay">--</div>
      <div class="settings-kpi-label">Relay Port</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="diagnoseDetailServer">--</div>
      <div class="settings-kpi-label">Data Server</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="diagnoseDetailApi">--</div>
      <div class="settings-kpi-label">API Status</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="diagnoseDetailSidebar">--</div>
      <div class="settings-kpi-label">Sidebar HTML</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Results</div>
    <div id="diagnoseDetailResults" class="diag-results" style="padding:0;"></div>
  </div>
</div>
<div class="settings-dropdown-header ${displayMode === 'sidebar' ? '' : 'hidden'}" id="settingsDropdownHeader" data-sidebar-tab="settings">
  <span>Settings</span>
  <span class="arrow">&#x25BC;</span>
</div>
<div class="settings-dropdown-body ${displayMode === 'sidebar' ? '' : 'hidden'}" id="settingsDropdownBody" data-sidebar-tab="settings">
  <div class="tab-section">TOOLS</div>
  <button type="button" id="platformDropdownHeader" data-sidebar-tab="settings" class="menu-list-item">Platform</button>
  <button type="button" id="openSettingsFromSettings" class="menu-list-item">Open Settings</button>
  <div class="tab-section" style="margin-top:16px;">SERVER INFO</div>
  <div class="card" id="settingsServerCard">
    <div class="card-icon server"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
    <div class="card-text">
      <div class="card-label">API</div>
      <div class="card-value" id="settingsServerUrlText">http://127.0.0.1:54358</div>
    </div>
  </div>
  <div class="tab-section" style="margin-top:16px;">TOKEN</div>
  <div class="card" id="tokenManagementCard" style="cursor:pointer;">
    <div class="card-icon server" style="background:rgba(59,130,246,0.12);color:#60a5fa;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
    <div class="card-text">
      <div class="card-label">Token Management</div>
      <div class="card-value" id="tokenManagementTier">No token — Sign In</div>
    </div>
  </div>
</div>
<div id="sbWebsiteNav" class="sb-website-nav">
  <hr class="sb-nav-divider" />
  <div class="sb-nav-section">App</div>
  <div class="sb-nav-items">
    <button type="button" class="sb-nav-item sb-nav-item--accent" data-command="openDashboard" title="Open the dashboard app in the IDE">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
      <span class="sb-nav-label">Dashboard</span>
    </button>
    <button type="button" class="sb-nav-item sb-nav-item--accent" data-command="openAudit" title="Open the audit report in the IDE">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <span class="sb-nav-label">Audit</span>
    </button>
  </div>
  <div class="sb-nav-section">Website</div>
  <div class="sb-nav-items">
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/roadmap" title="Open Roadmap in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L9 3"/></svg>
      <span class="sb-nav-label">Roadmap</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/pricing" title="Open Pricing in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      <span class="sb-nav-label">Pricing</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/community" title="Open Install / Community in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2-8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-7l-2-2z"/></svg>
      <span class="sb-nav-label">Install</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/blog/case-study-ai-slop-1-25m" title="Open Blog in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
      <span class="sb-nav-label">Blog</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/faq" title="Open FAQ in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="sb-nav-label">FAQ</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="openExternalUrl" data-url="https://simplebeacon.ai/contact" title="Open Contact in your browser">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      <span class="sb-nav-label">Contact</span>
      <span class="sb-nav-external">&#x2197;</span>
    </button>
  </div>
  <div class="sb-nav-section">Account</div>
  <div class="sb-nav-items">
    <button type="button" class="sb-nav-item sb-nav-item--accent" data-command="signIn" id="sbNavSignInBtn" title="Sign in to SimpleBeacon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
      <span class="sb-nav-label">Sign In</span>
    </button>
    <button type="button" class="sb-nav-item" data-command="signOut" id="sbNavSignOutBtn" style="display:none;" title="Sign out of SimpleBeacon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span class="sb-nav-label">Sign Out</span>
    </button>
  </div>
</div>
<script nonce="${nonce}">
  window._displayMode = '${displayMode}';
</script>
<script nonce="${nonce}">
${sidebarMainJsContent}
</script>
<div id="sbAuthDebugLog" style="position:fixed;bottom:4px;left:4px;right:4px;padding:4px 6px;font-size:10px;color:#94a3b8;background:rgba(15,23,42,0.9);border-radius:4px;z-index:9999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Auth state: waiting...</div>
<script nonce="${nonce}">
(function(){
  // Force dashboard visible immediately so the sidebar never appears blank
  try {
    const dash = document.getElementById('tabDashboard');
    if (dash) { dash.style.display = 'block'; dash.classList.add('active'); }
  } catch(e) {}
  // After 5s, if the dashboard still looks empty, log a diagnostic message to the extension
  setTimeout(function(){
    const dash = document.getElementById('tabDashboard');
    const visible = dash && (dash.offsetHeight > 50 || dash.children.length > 0);
    const jsLoaded = !!window._sidebarMainLoaded;
    if (!visible || !jsLoaded) {
      const vscode = window.vscode || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null);
      if (vscode) {
        try { vscode.postMessage({ command: 'sidebarError', message: 'Sidebar render check failed: jsLoaded=' + jsLoaded + ' visible=' + visible }); } catch(_) {}
      }
    }
  }, 5000);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.command === 'pingSidebarHealth') {
      const vscode = window.vscode || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null);
      if (vscode) {
        vscode.postMessage({ command: 'pongSidebarHealth', scriptLoaded: !!window._sidebarMainLoaded });
      }
    }
  });
})();
</script>
</body>
</html>`;
  }

  public updateReport(report: Record<string, unknown> | null) {
    this._currentReport = report;
    try {
      this._view?.webview.postMessage({ command: 'updateReport', report });
    } catch {
      /* webview disposed */
    }
    // Push report data to relay so browser dashboard can display it
    const relayPort = ModernSidebarProvider._relayPort;
    if (relayPort && report) {
      try {
        const payload = JSON.stringify({ ...report, title: report.title || 'Scan Report' });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: relayPort,
            path: '/api/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          },
          () => {}
        );
        req.on('error', () => {});
        req.write(payload);
        req.end();
      } catch (e) {
        ModernSidebarProvider.logRelay('Relay data push error: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
  }

  public updateAnalyticsPane(data: Record<string, unknown>) {
    try {
      this._view?.webview.postMessage({ command: 'updateAnalytics', ...data });
    } catch {
      /* webview disposed */
    }
  }

  public updateScanProgress(percentage: number) {
    this._view?.webview.postMessage({ command: 'scanProgress', percentage });
  }

  public updateStatus(status: string, text: string) {
    this._view?.webview.postMessage({ command: 'updateStatus', status, text });
    // Push status to relay so browser sidebar stays in sync
    const relayPort = ModernSidebarProvider._relayPort;
    if (relayPort) {
      try {
        const payload = JSON.stringify({ status, text, title: 'Status Update' });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: relayPort,
            path: '/api/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          },
          () => {}
        );
        req.on('error', () => {});
        req.write(payload);
        req.end();
      } catch (e) {
        ModernSidebarProvider.logRelay('Relay status push error: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
  }

  private static resolveCodeMapPaidTier(): boolean {
    const tier = (ModernSidebarProvider.getCachedTier() || '').toLowerCase();
    const freeTiers = ['guest', 'community', 'developer', 'sandbox', 'instant', 'free', 'solo', ''];
    return ModernSidebarProvider.getCachedIsAdmin() || !freeTiers.includes(tier);
  }

  private static mapWelcomeCodeMapToSidebar(data: Record<string, unknown>): Record<string, unknown> {
    const files = parseInt(String(data.files ?? data.repoFiles ?? '0'), 10) || 0;
    const modules = parseInt(String(data.modules ?? '0'), 10) || 0;
    const lines = parseInt(String(data.totalLines ?? '0'), 10) || 0;
    const langsRaw = data.languages;
    let languages: Array<{ name: string; count: number }> = [];
    if (Array.isArray(langsRaw)) {
      languages = langsRaw
        .map((entry: any) => ({
          name: String(entry?.name || entry?.extension || entry?.ext || ''),
          count: Number(entry?.count || 0),
        }))
        .filter((entry) => entry.name);
    } else if (typeof langsRaw === 'string' && langsRaw.trim()) {
      languages = langsRaw
        .split(',')
        .map((name) => ({ name: name.trim(), count: 0 }))
        .filter((entry) => entry.name);
    }
    return {
      totalFiles: files,
      filesScanned: files,
      totalModules: modules,
      modules,
      totalLines: lines,
      lines,
      lastScan: data.lastScan || '--',
      codeMapGenerated: true,
      generated: true,
      languages,
      isPaidTier: ModernSidebarProvider.resolveCodeMapPaidTier(),
    };
  }

  private static loadCodeMapPayloadFromDisk(): Record<string, unknown> | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return null;
    }
    const mapPath = path.join(folders[0].uri.fsPath, '.simplebeacon', 'codemap.json');
    if (!fs.existsSync(mapPath)) {
      return null;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as {
        totalFiles?: number;
        totalLines?: number;
        generatedAt?: string;
        languages?: Array<{ extension?: string; name?: string; count?: number }>;
        dependencyGraph?: { nodes?: unknown[] };
      };
      const languages = Array.isArray(raw.languages)
        ? raw.languages
            .map((entry) => ({
              name: String(entry.extension || entry.name || ''),
              count: Number(entry.count || 0),
            }))
            .filter((entry) => entry.name)
        : [];
      const moduleCount = Array.isArray(raw.dependencyGraph?.nodes) ? raw.dependencyGraph!.nodes!.length : 0;
      const generatedAt = raw.generatedAt ? new Date(raw.generatedAt).toLocaleString() : new Date().toLocaleString();
      return {
        totalFiles: raw.totalFiles || 0,
        filesScanned: raw.totalFiles || 0,
        totalModules: moduleCount,
        modules: moduleCount,
        totalLines: raw.totalLines || 0,
        lines: raw.totalLines || 0,
        lastScan: generatedAt,
        codeMapGenerated: true,
        generated: true,
        languages,
        isPaidTier: ModernSidebarProvider.resolveCodeMapPaidTier(),
      };
    } catch {
      return null;
    }
  }

  private static resolveCodeMapPayload(): Record<string, unknown> | null {
    if (ModernSidebarProvider._lastCodeMapData) {
      const cached = ModernSidebarProvider._lastCodeMapData;
      const cachedFiles = Number(cached.totalFiles || cached.filesScanned || 0);
      // If cache has real data (files > 0), use it; otherwise fall through to disk
      if (cachedFiles > 0) {
        return cached;
      }
    }
    const welcomeData = getWelcomeDashboard().getLastCodeMapData?.();
    if (welcomeData) {
      const mapped = ModernSidebarProvider.mapWelcomeCodeMapToSidebar(welcomeData as Record<string, unknown>);
      const mappedFiles = Number(mapped.totalFiles || 0);
      if (mappedFiles > 0) {
        return mapped;
      }
    }
    return ModernSidebarProvider.loadCodeMapPayloadFromDisk();
  }

  public static pushCodeMapToSidebar(webview?: vscode.Webview) {
    const payload = ModernSidebarProvider.resolveCodeMapPayload();
    if (!payload) {
      return;
    }
    ModernSidebarProvider._lastCodeMapData = payload;
    webview?.postMessage({ command: 'updateCodeMap', ...payload });
  }

  public updateCodeMap(data: Record<string, unknown>) {
    ModernSidebarProvider._lastCodeMapData = {
      ...data,
      isPaidTier: data.isPaidTier ?? ModernSidebarProvider.resolveCodeMapPaidTier(),
    };
    this._view?.webview.postMessage({ command: 'updateCodeMap', ...ModernSidebarProvider._lastCodeMapData });
  }

  private static _lastRoadmapData: Record<string, unknown> | null = null;

  public updateRoadmap(data: Record<string, unknown>) {
    ModernSidebarProvider._lastRoadmapData = data;
    this._view?.webview.postMessage({ command: 'updateRoadmap', ...data });
  }

  public static pushRoadmapToSidebar(webview?: vscode.Webview) {
    if (ModernSidebarProvider._lastRoadmapData) {
      webview?.postMessage({ command: 'updateRoadmap', ...ModernSidebarProvider._lastRoadmapData });
    }
  }

  public updateServerUrl(url: string) {
    this._view?.webview.postMessage({ command: 'updateServerUrl', url });
  }

  public addDownloadedFile(name: string, path: string) {
    const dl = { name, path, time: new Date().toLocaleTimeString() };
    // Avoid duplicate entries for the same path
    this._downloads = this._downloads.filter((d) => d.path !== path);
    this._downloads.unshift(dl);
    this._view?.webview.postMessage({
      command: 'addDownloadedFile',
      name: dl.name,
      path: ModernSidebarProvider._displayDownloadPath(dl.path),
      fullPath: dl.path,
      time: dl.time,
    });
  }

  public static addDownloadedFile(name: string, path: string): void {
    ModernSidebarProvider._instance?.addDownloadedFile(name, path);
  }

  private static _displayDownloadPath(path: string): string {
    // Browser downloads use a pseudo-path for unique deduplication; don't show it in the sidebar.
    return path && path.startsWith('browser://') ? '' : path;
  }

  public clearDownloadedFiles() {
    this._downloads = [];
    this._view?.webview.postMessage({ command: 'clearDownloadedFiles' });
  }

  public navigateToPage(page: string) {
    this._view?.webview.postMessage({ command: 'navigateToPage', page });
  }

  public openSidebarDebugFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage('Sidebar debug file not found: ' + filePath);
      return;
    }
    let browserHtml = fs.readFileSync(filePath, 'utf8');
    // Strip CSP so inline scripts work in webview
    browserHtml = browserHtml.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    // Ensure vscode API is available
    browserHtml = browserHtml.replace(
      /(?:let|var) vscodeApi = null;[\s\S]*?window\.vscode = vscodeApi;\s*}/g,
      `try { window.vscode = acquireVsCodeApi(); } catch (e) { /* silent — expected in non-webview contexts */ }`
    );
    // Remove leftover reference to the removed vscodeApi variable
    browserHtml = browserHtml.replace(
      new RegExp('v' + 'ar' + ' _isRealVsCode = !!vscodeApi;\\s*'),
      'const _isRealVsCode = false;'
    );
    getWelcomeDashboard().createOrShow(this._extensionUri, true);
  }

  public openStandaloneDebug() {
    if (ModernSidebarProvider.openInBrowserIfRemote('/')) return;
    if (!this._extensionUri) {
      vscode.window.showErrorMessage('Extension URI not available');
      return;
    }
    const currentReport = this._currentReport;
    const html = this._getHtmlForWebview(this._view!.webview);
    // Inline sidebar-main.js so it loads in the standalone panel (webview URIs are panel-specific)
    const sidebarJsPath = path.join(this._extensionUri.fsPath, 'media', 'sidebar-main.js');
    let standaloneHtml = html;
    if (fs.existsSync(sidebarJsPath)) {
      const sidebarJs = fs.readFileSync(sidebarJsPath, 'utf8');
      standaloneHtml = html.replace(
        /<script(?:\s+[^>]*)?\s+src="[^"]*sidebar-main\.js[^"]*"[^>]*><\/script>/,
        '<script>\n' + sidebarJs + '\n</script>'
      );
    }
    standaloneHtml = standaloneHtml.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    // Keep real acquireVsCodeApi() for panel message passing
    // Inject VS Code dark theme CSS variables
    const vscodeVars = `<style>:root{--vscode-editor-background:#1e1e1e;--vscode-sidebar-background:#252526;--vscode-foreground:#cccccc;--vscode-panel-background:#252526;--vscode-panel-border:#3c3c3c;--vscode-button-secondaryBackground:#2d2d30;--vscode-button-secondaryForeground:#cccccc;--vscode-button-hoverBackground:#3c3c3c;--vscode-descriptionForeground:#858585;--vscode-activityBar-background:#333333;--vscode-activityBar-foreground:#ffffff;--vscode-activityBar-inactiveForeground:#858585;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-charts-green:#89d185;--vscode-charts-red:#f48771;--vscode-charts-orange:#d18616;--vscode-charts-blue:#75beff;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>`;
    standaloneHtml = standaloneHtml.replace('</head>', vscodeVars + '</head>');
    // Inject API URL
    const sbConfig = getSbConfig();
    const apiUrl = String(
      sbConfig.get<string>('apiServerUrl') ||
        sbConfig.get<string>('apiUrl', 'http://127.0.0.1:55000') ||
        'http://127.0.0.1:55000'
    );
    const apiScript = `<script>window.__SB_API_URL__=${JSON.stringify(apiUrl)};</script>`;
    standaloneHtml = standaloneHtml.replace('</head>', apiScript + '</head>');
    // Inject initial report data if available
    if (currentReport) {
      const dataScript = `<script>window.__SB_INITIAL_DATA__=${JSON.stringify(currentReport)};window.__SB_INITIAL_STATUS__='completed';if(typeof showResults==='function'&&window.__SB_INITIAL_DATA__){showResults(window.__SB_INITIAL_DATA__);setStatus('completed','Analysis complete');}</script>`;
      standaloneHtml = standaloneHtml.replace('</body>', dataScript + '</body>');
    }
    // Auto-open dashboard welcome page in standalone panel
    const autoOpenScript = `<script>(function(){setTimeout(function(){if(typeof showPage==='function'){showPage('dashboard');}},100);})();</script>`;
    standaloneHtml = standaloneHtml.replace('</body>', autoOpenScript + '</body>');
    // Open directly in a webview panel (no iframe, no relay)
    let panel: vscode.WebviewPanel;
    if (ModernSidebarProvider.browserPanel) {
      ModernSidebarProvider.browserPanel.reveal(vscode.ViewColumn.Active);
      panel = ModernSidebarProvider.browserPanel;
      panel.webview.html = standaloneHtml;
    } else {
      panel = vscode.window.createWebviewPanel(
        'simplebeaconSidebarBrowser',
        'SimpleBeacon Debug (Standalone)',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this._extensionUri] }
      );
      ModernSidebarProvider.browserPanel = panel;
      panel.webview.html = standaloneHtml;
      panel.onDidDispose(() => {
        ModernSidebarProvider.browserPanel = undefined;
      });
    }
    // Handle messages from the standalone panel the same way as the sidebar view
    panel.webview.onDidReceiveMessage((message: any) => {
      switch (message.command) {
        case 'scan':
          vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          break;
        case 'clear':
          vscode.commands.executeCommand('simplebeacon.clearResults');
          break;
        case 'openDashboard':
          getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
          break;
        case 'report':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'exportReport':
        case 'exportScanReport':
          Promise.resolve(vscode.commands.executeCommand('simplebeacon.exportReport')).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage('Export failed: ' + msg);
          });
          break;
        case 'settings':
          vscode.commands.executeCommand('simplebeacon.openSettings');
          break;
        case 'openInIde':
          if (apiUrl) {
            vscode.commands.executeCommand('simpleBrowser.show', apiUrl);
          }
          break;
        case 'openCloudInBrowser':
        case 'openCloudInPreview':
          getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
          break;
        case 'openAiToolsInBrowser':
        case 'openAiToolsInPreview':
          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/aicontext');
          break;
        case 'openAdvancedInBrowser':
        case 'openAdvancedInPreview':
          getWelcomeDashboard().createOrShow(this._extensionUri, true)?.showDashboardPane();
          break;
        case 'diagnose':
          vscode.commands.executeCommand('simplebeacon.diagnoseSidebar');
          break;
        case 'navDashboard':
        case 'dashboard':
        case 'navAnalyze':
        case 'analyze':
        case 'navResults':
        case 'navRepoHealth':
        case 'navAudit':
        case 'audit':
        case 'navSecurity':
        case 'security':
        case 'navQuality':
        case 'quality':
        case 'navTrust':
        case 'trust':
        case 'navAssessments':
        case 'assessments':
        case 'navRoadmap':
        case 'roadmap':
        case 'navPlatform':
        case 'platform':
        case 'navProfile':
        case 'profile':
        case 'navTools':
        case 'navSettings':
        case 'navHelp':
        case 'navChatbot':
        case 'navAbout': {
          const route = ModernSidebarProvider.teamNavRoute(
            message.command.startsWith('nav')
              ? message.command
              : 'nav' + message.command.charAt(0).toUpperCase() + message.command.slice(1)
          );
          if (route) {
            ModernSidebarProvider.openEmbeddedDashboardRoute(route);
          } else if (message.command === 'dashboard') {
            ModernSidebarProvider.openEmbeddedDashboardRoute('/dashboard');
          }
          break;
        }
        case 'navCodeMap':
        case 'codeMap':
        case 'codemap':
          vscode.commands.executeCommand('simplebeacon.showCodeMap');
          break;
        case 'navCertificate':
        case 'certificate':
        case 'cert':
          vscode.commands.executeCommand('simplebeacon.generateCertificate');
          break;
        case 'navAiContext':
        case 'aiContext':
          vscode.commands.executeCommand('simplebeacon.openAiContext');
          break;
        case 'preview':
          vscode.commands.executeCommand('simplebeacon.openPreview');
          break;
        case 'sendToAi':
          vscode.commands.executeCommand('simplebeacon.sendToAi');
          break;
        case 'sendToAI':
          {
            const dataPort = getDataServerPort();
            const body = JSON.stringify(message.data || {});
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port: dataPort,
                path: '/api/ai-context',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
              },
              (res: http.IncomingMessage) => {
                res.on('data', () => {
                  /* drain response */
                });
                res.on('end', () => {
                  /* data server callback will focus AI Coding Agent panel */
                });
              }
            );
            req.on('error', (err) => {
              vscode.window.showErrorMessage('Failed to send to AI Coding Agent: ' + err.message);
            });
            req.write(body);
            req.end();
          }
          break;
        case 'openFile': {
          const targetPath = (message.file || message.path || '') as string;
          const fileName = typeof message.name === 'string' ? message.name : undefined;
          if (!targetPath && !fileName) {
            break;
          }
          if (/^(https?:\/\/|blob:)/.test(targetPath)) {
            vscode.env.openExternal(vscode.Uri.parse(targetPath));
          } else {
            const line = typeof message.line === 'number' && message.line > 0 ? message.line : 1;
            this.openDownloadedFile(targetPath, fileName, line);
          }
          break;
        }
        case 'navigateToPage':
          if (message.page) {
            if (message.page === 'analyze') {
              ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/analyze');
              break;
            }
            const pageMap: Record<string, string> = {
              dashboard: 'simplebeacon.showReport',
              report: 'simplebeacon.showReport',
              settings: 'simplebeacon.openSettings',
              certificate: 'simplebeacon.generateCertificate',
              codeMap: 'simplebeacon.showCodeMap',
              aiContext: 'simplebeacon.openAiContext',
              preview: 'simplebeacon.openInPreview',
            };
            const cmd = pageMap[message.page];
            if (cmd) vscode.commands.executeCommand(cmd);
          }
          break;
        case 'getServerUrl': {
          panel.webview.postMessage({ command: 'updateServerUrl', url: apiUrl });
          break;
        }
      }
    });
  }

  public openDebugPreview(skipPanelOpen?: boolean): string {
    if (!this._extensionUri) {
      throw new Error('Extension URI not available');
    }
    const currentReport = this._currentReport;
    const extUri = this._extensionUri;
    // Generate a nonce for panel CSP so inline scripts are not blocked by Trusted Types
    const panelNonce = crypto.randomBytes(16).toString('base64');
    const panelCsp = this._view ? this._view.webview.cspSource : '';
    // Guard: if sidebar view was never resolved, generate HTML with a fallback webview
    const html = this._view
      ? this._getHtmlForWebview(this._view.webview)
      : this._getHtmlForWebview(
          new (class {
            cspSource = '';
            asWebviewUri(uri: vscode.Uri) {
              return uri;
            }
          })() as unknown as vscode.Webview
        );
    // Inline sidebar-main.js so it loads in the browser panel (webview URIs are panel-specific)
    const sidebarJsPath = path.join(extUri.fsPath, 'media', 'sidebar-main.js');
    let browserHtml = html;
    if (fs.existsSync(sidebarJsPath)) {
      const sidebarJs = fs.readFileSync(sidebarJsPath, 'utf8');
      browserHtml = html.replace(
        /<script(?:\s+[^>]*)?\s+src="[^"]*sidebar-main\.js[^"]*"[^>]*><\/script>/,
        '<script>\n' + sidebarJs + '\n</script>'
      );
    }
    const tmpFile = path.join(os.tmpdir(), 'simplebeacon-sidebar-preview.html');
    browserHtml = browserHtml.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    // Replace VS Code API with a bridge that posts messages to parent window
    browserHtml = browserHtml.replace(
      /(?:let|var) vscodeApi = null;[\s\S]*?window\.vscode = vscodeApi;\s*}/g,
      `window.__SB_BROWSER_MODE__ = true;
      document.body.classList.add('browser-mode');
      window.vscode = {
        postMessage: function(msg) {
          if (!msg || !msg.command) return;
          if (window.parent !== window) {
            parent.postMessage(msg, '*');
            return;
          }
          const feat = msg.command || 'This feature';
          alert(feat + ' is only available inside VS Code.');
        },
        getState: function() { return {}; },
        setState: function() {}
      };`
    );
    // Remove leftover reference to the removed vscodeApi variable
    browserHtml = browserHtml.replace(
      new RegExp('v' + 'ar' + ' _isRealVsCode = !!vscodeApi;\\s*'),
      'const _isRealVsCode = false;'
    );
    // Also replace inline onclick acquireVsCodeApi calls
    browserHtml = browserHtml.replace(
      /onclick="try\{acquireVsCodeApi\(\)\.postMessage/g,
      `onclick="try{window.vscode.postMessage`
    );
    // Replace showPage() calls in stat cards with parent.postMessage for browser layout
    browserHtml = browserHtml.replace(
      /onclick="showPage\('([^']+)'\)"/g,
      `onclick="parent.postMessage({command:'$1'},'*')"`
    );
    // Replace hidePage() back button with browser history back
    browserHtml = browserHtml.replace(/onclick="hidePage\(\)"/g, `onclick="history.back()"`);
    // In browser context, change Preview button to IDE button
    browserHtml = browserHtml.replace(
      /<button type="button" class="btn btn-action btn-small" id="previewBtn">\s*<span class="btn-icon">[🌐\&#x1F310;]<\/span>\s*<span>Preview<\/span>\s*<\/button>/g,
      `<button type="button" class="btn btn-action btn-small" id="previewBtn"><span class="btn-icon">&#x1F5A5;</span><span>IDE</span></button>`
    );
    browserHtml = browserHtml.replace(
      /bindBtn\('previewBtn', 'openSidebarDebug'\);/g,
      `bindBtn('previewBtn', 'openInIde');`
    );
    // Ensure browser-mode sidebar has a working vscode mock that posts to parent window
    const vscodeMockScript = `<script nonce="${panelNonce}">
if (!window.vscode || typeof window.vscode.postMessage !== 'function') {
  window.__SB_BROWSER_MODE__ = true;
  document.body.classList.add('browser-mode');
  window.vscode = {
    postMessage: function(msg) {
      if (!msg || !msg.command) return;
      if (window.parent !== window) {
        parent.postMessage(msg, '*');
        return;
      }
      const feat = msg.command || 'This feature';
      alert(feat + ' is only available inside VS Code:.');
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}
</script>`;
    browserHtml = browserHtml.replace('</body>', vscodeMockScript + '</body>');

    // Inject VS Code dark theme CSS variables and API URL so sidebar renders correctly outside VS Code
    const vscodeVars = `<style>:root{--vscode-editor-background:#1e1e1e;--vscode-sidebar-background:#252526;--vscode-foreground:#cccccc;--vscode-panel-background:#252526;--vscode-panel-border:#3c3c3c;--vscode-button-secondaryBackground:#2d2d30;--vscode-button-secondaryForeground:#cccccc;--vscode-button-hoverBackground:#3c3c3c;--vscode-descriptionForeground:#858585;--vscode-activityBar-background:#333333;--vscode-activityBar-foreground:#ffffff;--vscode-activityBar-inactiveForeground:#858585;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-charts-green:#89d185;--vscode-charts-red:#f48771;--vscode-charts-orange:#d18616;--vscode-charts-blue:#75beff;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>`;
    const sbConfig = getSbConfig();
    const apiUrl = String(
      sbConfig.get<string>('apiServerUrl') ||
        sbConfig.get<string>('apiUrl', 'http://127.0.0.1:55000') ||
        'http://127.0.0.1:55000'
    );
    const relayPort = ModernSidebarProvider._relayPort || sbConfig.get<number>('relayPort', 55444);
    const dashboardUrl = `http://127.0.0.1:${getDataServerPort()}`;
    const injectScript = `<script nonce="${panelNonce}">window.__SB_DASHBOARD_URL__=${JSON.stringify(String(dashboardUrl))};window.__SB_API_URL__=${JSON.stringify(apiUrl)};window._relayPort=${relayPort};</script>`;
    browserHtml = browserHtml.replace('</head>', injectScript + vscodeVars + '</head>');

    // Seed the browser sidebar with the same report data the IDE sidebar is showing
    if (this._currentReport) {
      const dataScript = `<script nonce="${panelNonce}">window.__SB_INITIAL_DATA__=${JSON.stringify(this._currentReport)};window.__SB_INITIAL_STATUS__='completed';if(typeof showResults==='function'&&window.__SB_INITIAL_DATA__){showResults(window.__SB_INITIAL_DATA__);setStatus('completed','Analysis complete');}</script>`;
      browserHtml = browserHtml.replace('</body>', dataScript + '</body>');
    }

    // Store sidebar HTML for relay server
    ModernSidebarProvider._sidebarHtml = browserHtml;

    if (skipPanelOpen) {
      return browserHtml;
    }

    // Open the main SimpleBeacon dashboard panel instead of a browser preview tab
    getWelcomeDashboard().createOrShow(this._extensionUri, true);
    return browserHtml;
  }

  public restartRelayServer() {
    const existingServer = ModernSidebarProvider._relayServer;
    if (existingServer) {
      try {
        existingServer.close();
      } catch (e) {
        ModernSidebarProvider.logRelay(
          'Failed to close existing relay server: ' + (e instanceof Error ? e.message : String(e))
        );
      }
      ModernSidebarProvider._relayServer = undefined;
      ModernSidebarProvider._relayPort = undefined;
    }
    if (ModernSidebarProvider._relayPollInterval) {
      clearInterval(ModernSidebarProvider._relayPollInterval);
      ModernSidebarProvider._relayPollInterval = undefined;
    }
    this.openSidebarInBrowser(false);
    const dataPort = getDataServerPort();
    const url = `http://127.0.0.1:${dataPort}`;
    this._view?.webview.postMessage({ command: 'updateServerUrl', url });
    showQuietMessage(`SimpleBeacon relay server restarted. API: ${url}`);
  }

  public openSidebarInBrowser(openBrowser = true, urlPath = '/') {
    if (!this._extensionUri) {
      vscode.window.showErrorMessage('Extension URI not available. Please reload the window.');
      return;
    }
    const extUri = this._extensionUri;
    const localDashboardBase = `http://127.0.0.1:${getDataServerPort()}`;
    const websiteMode = ModernSidebarProvider.getDashboardMode() === 'website';
    const dashboardBaseUrl = websiteMode ? 'https://simplebeacon.pages.dev' : localDashboardBase;
    const initialDashboardSrc = websiteMode ? `${dashboardBaseUrl}/dashboard` : `${localDashboardBase}/dashboard`;

    // Generate the same browser-ready sidebar HTML used by the IDE preview
    let browserHtml = '';
    try {
      browserHtml = this.openDebugPreview(true);
    } catch (e) {
      ModernSidebarProvider.logRelay(
        'Failed to generate browser sidebar HTML: ' + (e instanceof Error ? e.message : String(e))
      );
    }
    if (!browserHtml) {
      vscode.window.showErrorMessage(
        'Browser sidebar HTML could not be generated. Open the SimpleBeacon sidebar in VS Code first.'
      );
      return;
    }

    // Cache sidebar HTML for relay server
    ModernSidebarProvider._sidebarHtml = browserHtml;

    // Generate welcome window browser HTML for the relay preview
    try {
      if (typeof getWelcomeDashboard().buildBrowserHtml === 'function') {
        ModernSidebarProvider._welcomeBrowserHtml = getWelcomeDashboard().buildBrowserHtml(
          this._currentReport || undefined
        );
      }
    } catch (e) {
      ModernSidebarProvider.logRelay(
        'Failed to build welcome browser HTML: ' + (e instanceof Error ? e.message : String(e))
      );
    }

    // Write to temp file so standalone relay-server.js can serve it
    const tempFile = path.join(os.tmpdir(), 'simplebeacon-sidebar-browser.html');
    try {
      fs.writeFileSync(tempFile, browserHtml, 'utf8');
    } catch (e) {
      ModernSidebarProvider.logRelay(
        'Failed to write temp sidebar file: ' + (e instanceof Error ? e.message : String(e))
      );
    }

    // Start minimal relay server if not already running
    const sbConfig = getSbConfig();
    const RELAY_PORT = sbConfig.get<number>('relayPort', 3004);
    if (ModernSidebarProvider._relayServer) {
      const port = ModernSidebarProvider._relayPort || RELAY_PORT;
      const url = `http://127.0.0.1:${port}${urlPath}`;
      if (openBrowser) {
        try {
          vscode.env.openExternal(vscode.Uri.parse(url));
        } catch {
          vscode.env.clipboard.writeText(url);
          showQuietMessage(`Browser did not open. URL copied to clipboard: ${url}`);
        }
      }
      showQuietMessage(`Sidebar open at ${url}`);
      return;
    }

    // Helper to read codeMapTemplate for /codemap fallback
    const getCodeMapHtml = () => {
      try {
        const codeMapPath = path.join(extUri.fsPath, 'media', 'codeMapTemplate.html');
        if (fs.existsSync(codeMapPath)) {
          let html = fs.readFileSync(codeMapPath, 'utf8');
          return html
            .replace(/NONCE/g, 'browser-' + Date.now())
            .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
        }
      } catch (e) {
        ModernSidebarProvider.logRelay(
          'Failed to read codeMapTemplate.html: ' + (e instanceof Error ? e.message : String(e))
        );
      }
      return '<h1>Code Map</h1><p>Template not found</p>';
    };

    const buildIdeHtml = () => {
      return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon IDE</title>
<style>
html,body{height:100%;margin:0;padding:0;background:#0f1117;overflow:hidden}
.ide{display:flex;height:100vh;width:100vw}
.sidebar{width:280px;min-width:200px;max-width:400px;border-right:1px solid #334155;flex-shrink:0}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.resizer{width:6px;background:#334155;cursor:col-resize;flex-shrink:0}
${getDashboardUrlBarStyles()}
.browser-content{flex:1;min-height:0;position:relative}
iframe{width:100%;height:100%;border:none;display:block}
#browserTabBar{display:none;position:fixed;top:0;left:0;right:0;height:36px;background:#1e1e1e;border-bottom:1px solid rgba(255,255,255,0.06);z-index:200;align-items:center;gap:0;overflow-x:auto;scrollbar-width:thin;}
#browserTabBar::-webkit-scrollbar{height:5px;}
#browserTabBar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:3px;}
.browser-tab{position:relative;display:flex;align-items:center;gap:6px;padding:0 12px;height:36px;font-size:12px;font-weight:600;color:#858585;cursor:pointer;white-space:nowrap;user-select:none;background:transparent;border:none;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;}
.browser-tab:hover{color:#ccc;}
.browser-tab.active{color:#fff;border-bottom-color:#0e639c;background:rgba(255,255,255,0.03);}
.browser-tab-close{width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#858585;background:transparent;border:none;cursor:pointer;}
.browser-tab-close:hover{color:#ef4444;background:rgba(239,68,68,0.1);}
.browser-iframe-wrap{display:none;position:fixed;top:36px;left:0;right:0;bottom:0;border:none;width:100%;height:calc(100% - 36px);background:#1e1e1e;}
.browser-iframe-wrap.active{display:block;}
.browser-iframe{width:100%;height:100%;border:none;}
body.tabs-open #ide{display:none !important;}
body.tabs-open #browserTabBar{display:flex !important;}
.browser-sidebar{width:260px;min-width:200px;max-width:400px;height:100vh;border-right:1px solid #334155;background:#141414;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;padding:8px 0;box-sizing:border-box}
.browser-sidebar .sidebar-section{margin-bottom:4px}
.browser-sidebar .sidebar-heading{padding:6px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#737373;font-weight:600}
.browser-sidebar .sidebar-link{display:flex;align-items:center;gap:10px;padding:8px 16px;color:#a3a3a3;font-size:13px;cursor:pointer;transition:background .15s;text-decoration:none;border-radius:0}
.browser-sidebar .sidebar-link:hover{background:#262626;color:#fafafa}
.browser-sidebar .sidebar-link.active{background:rgba(14,99,156,.15);color:#0e639c;border-right:2px solid #0e639c}
.browser-sidebar .sidebar-link .icon{font-size:16px;width:20px;text-align:center}
</style>
</head>
<body>
<div id="browserTabBar"></div>
<div id="browserIframeContainer"></div>
<div class="ide" id="ide">
  <div class="browser-sidebar" id="browserSidebar">
    <div class="sidebar-section">
      <div class="sidebar-heading">Scan</div>
      <div class="sidebar-link" data-view="dashboard"><span class="icon">&#x1F4C8;</span> Dashboard</div>
      <div class="sidebar-link" data-view="analyze"><span class="icon">&#x1F50D;</span> Analyze</div>
      <div class="sidebar-link" data-view="results"><span class="icon">&#x1F4CA;</span> Results</div>
      <div class="sidebar-link" data-view="repository-health"><span class="icon">&#x2764;</span> Repo health</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">Compliance</div>
      <div class="sidebar-link" data-view="audit"><span class="icon">&#x1F4CB;</span> Audit Report</div>
      <div class="sidebar-link" data-view="security"><span class="icon">&#x1F6E1;</span> Security</div>
      <div class="sidebar-link" data-view="quality"><span class="icon">&#x2B50;</span> Quality</div>
      <div class="sidebar-link" data-view="trust"><span class="icon">&#x1F510;</span> Trust</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">Operations</div>
      <div class="sidebar-link" data-view="assessments"><span class="icon">&#x1F4DD;</span> Assessments</div>
      <div class="sidebar-link" data-view="remediation"><span class="icon">&#x1F6E4;</span> Remediation</div>
      <div class="sidebar-link" data-view="platform"><span class="icon">&#x1F680;</span> Platform</div>
      <div class="sidebar-link" data-view="profile"><span class="icon">&#x1F464;</span> Profile</div>
      <div class="sidebar-link" data-view="admin" id="sidebarAdminLink" style="display:none;"><span class="icon">&#x1F465;</span> Admin</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">System</div>
      <div class="sidebar-link" data-view="tools"><span class="icon">&#x1F6E0;</span> Tools</div>
      <div class="sidebar-link" data-view="settings"><span class="icon">&#x2699;</span> Settings</div>
      <div class="sidebar-link" data-view="help"><span class="icon">&#x2753;</span> Help</div>
      <div class="sidebar-link" data-view="chatbot"><span class="icon">&#x1F916;</span> Chatbot</div>
      <div class="sidebar-link" data-view="about"><span class="icon">&#x2139;</span> About</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">Account</div>
      <div class="sidebar-link" data-command="signIn" id="sidebarSignInLink"><span class="icon">&#x1F512;</span> Sign In</div>
      <div class="sidebar-link" data-command="signOut" id="sidebarSignOutLink" style="display:none;"><span class="icon">&#x1F512;</span> Sign Out</div>
    </div>
  </div>
  <div class="resizer" id="resizer"></div>
  <div class="main">
    ${getDashboardUrlBarHtml({ back: 'backBtn', fwd: 'fwdBtn', reload: 'reloadBtn', input: 'urlInput', external: 'externalBtn' }, initialDashboardSrc)}
    <div class="browser-content"><iframe id="mainIframe" src="${initialDashboardSrc}"></iframe></div>
  </div>
</div>
<script>
(function(){
  const resizer = document.getElementById('resizer');
  const sidebar = document.querySelector('.browser-sidebar');
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  const mainIframe = document.getElementById('mainIframe');
  function stopDrag(){
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (mainIframe) mainIframe.style.pointerEvents = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('blur', stopDrag);
  }
  function onMove(e){
    if(!isDragging) return;
    const dx = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(400, startWidth + dx));
    sidebar.style.width = newWidth + 'px';
  }
  resizer.addEventListener('mousedown', function(e){
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    if (mainIframe) mainIframe.style.pointerEvents = 'none';
    e.preventDefault();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', stopDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('blur', stopDrag);
  });
  const DASHBOARD_URL = ${JSON.stringify(dashboardBaseUrl)};
  const MARKETING_URL = 'https://simplebeacon.ai';
  const IS_REMOTE_DASHBOARD = ${websiteMode ? 'true' : 'false'};
  const WEBSITE_MODE = ${websiteMode ? 'true' : 'false'};
  const SITE_PATHS = ['/roadmap', '/audit', '/pricing', '/contact', '/team', '/security', '/terms', '/privacy', '/refund', '/faq'];
  function isSitePath(path) {
    if (!path || path.charAt(0) !== '/') return false;
    return SITE_PATHS.some(function(p) { return path === p || path.indexOf(p + '/') === 0 || path.indexOf(p + '?') === 0; });
  }
  function resolveUrlInput(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\\/\\//i.test(trimmed)) return trimmed;
    if (trimmed.charAt(0) === '/') {
      if (trimmed.indexOf('/dashboard/') === 0 || trimmed === '/dashboard') return DASHBOARD_URL + trimmed;
      if (isSitePath(trimmed)) return MARKETING_URL + trimmed;
      return DASHBOARD_URL + '/dashboard' + trimmed;
    }
    if (/^[a-z0-9.-]+\\.[a-z]{2,}/i.test(trimmed)) return 'https://' + trimmed.replace(/^\\/+/, '');
    return DASHBOARD_URL + '/dashboard/' + trimmed.replace(/^#?\\/?/, '');
  }
  function canEmbed(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) return true;
      if (host === 'simplebeacon.pages.dev' || host.endsWith('.simplebeacon.pages.dev')) return true;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      if (host.endsWith('.onrender.com')) return true;
      return false;
    } catch (e) { return false; }
  }
  function ensureEmbedParams(url) {
    if (!url) return url;
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has('sb_parent_urlbar')) {
        parsed.searchParams.set('sb_parent_urlbar', '1');
      }
      const host = parsed.hostname.toLowerCase();
      const isRemote = host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai') || host.endsWith('.onrender.com') || host.endsWith('.netlify.app') || host.endsWith('.pages.dev');
      if (isRemote && !parsed.searchParams.has('sb_notify_base')) {
        const notifyBase = (typeof window !== 'undefined' && window.__SB_DATA_SERVER_URL__ ? window.__SB_DATA_SERVER_URL__ : DASHBOARD_URL).replace(/\/$/, '') + '/api';
        parsed.searchParams.set('sb_notify_base', notifyBase);
      }
      return parsed.toString();
    } catch (e) {
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'sb_parent_urlbar=1';
    }
  }
  function preferLocalDashboardUrl(url) {
    if (!url) return url;
    if (WEBSITE_MODE) return url;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if ((host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) && parsed.pathname.indexOf('/dashboard') === 0) {
        if (DASHBOARD_URL && (DASHBOARD_URL.indexOf('127.0.0.1') >= 0 || DASHBOARD_URL.indexOf('localhost') >= 0)) {
          return DASHBOARD_URL.replace(/\/$/, '') + parsed.pathname + parsed.search + parsed.hash;
        }
      }
    } catch (e) { /* ignore */ }
    return url;
  }
  function notifyParentUrlBar() {
    if (mainIframe && mainIframe.contentWindow) {
      mainIframe.contentWindow.postMessage({ command: 'setParentUrlBar', active: true }, '*');
    }
  }
  function dashboardRoute(view) {
    const routes = { remediation: 'remediation' };
    const target = routes[view] || view;
    if (IS_REMOTE_DASHBOARD) { return '/dashboard/' + target; }
    return '/#/' + target;
  }
  function viewFromUrl(url) {
    if (!url) return 'dashboard';
    if (IS_REMOTE_DASHBOARD) {
      const m = url.match(/\/dashboard\/([^/?#]+)/);
      return m ? m[1] : 'dashboard';
    }
    const m = url.match(/#\/([^?]+)/);
    return m ? m[1].replace(/^\//, '') : 'dashboard';
  }

  const browserHistory = { urls: [], index: -1, pendingUrl: null };
  const urlInput = document.getElementById('urlInput');
  const backBtn = document.getElementById('backBtn');
  const fwdBtn = document.getElementById('fwdBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const externalBtn = document.getElementById('externalBtn');
  function _postSidebarCmd(cmd) {
    if (typeof acquireVsCodeApi === 'function') {
      try { acquireVsCodeApi().postMessage({ command: cmd }); } catch (e) {}
    }
  }

  function updateToolbar() {
    if (urlInput) urlInput.value = browserHistory.urls[browserHistory.index] || '';
    if (backBtn) backBtn.disabled = browserHistory.index <= 0;
    if (fwdBtn) fwdBtn.disabled = browserHistory.index < 0 || browserHistory.index >= browserHistory.urls.length - 1;
  }
  function pushHistory(url) {
    if (!url) return;
    browserHistory.urls = browserHistory.urls.slice(0, browserHistory.index + 1);
    if (browserHistory.urls[browserHistory.index] === url) return;
    browserHistory.urls.push(url);
    browserHistory.index = browserHistory.urls.length - 1;
    updateToolbar();
  }
  function goBack() {
    if (browserHistory.index > 0) {
      browserHistory.index--;
      navigateToUrl(browserHistory.urls[browserHistory.index], false);
    }
  }
  function goForward() {
    if (browserHistory.index < browserHistory.urls.length - 1) {
      browserHistory.index++;
      navigateToUrl(browserHistory.urls[browserHistory.index], false);
    }
  }
  function refresh() {
    if (mainIframe && browserHistory.index >= 0) {
      browserHistory.pendingUrl = browserHistory.urls[browserHistory.index];
      mainIframe.src = browserHistory.urls[browserHistory.index];
    }
  }
  function navigateToUrl(url, push) {
    if (!url || !mainIframe) return;
    let resolved = preferLocalDashboardUrl(resolveUrlInput(url) || url);
    if (!canEmbed(resolved)) {
      if (typeof acquireVsCodeApi === 'function') {
        try { acquireVsCodeApi().postMessage({ command: 'openInSimpleBrowser', url: resolved }); } catch (e) {}
      }
      if (urlInput) urlInput.value = resolved;
      if (push) pushHistory(resolved);
      else updateToolbar();
      return;
    }
    resolved = ensureEmbedParams(resolved);
    browserHistory.pendingUrl = resolved;
    mainIframe.src = resolved;
    if (urlInput) urlInput.value = resolved;
    if (push) pushHistory(resolved);
    else updateToolbar();
    activateLink(viewFromUrl(resolved));
  }
  function navigateToView(view, push) {
    navigateToUrl(DASHBOARD_URL + dashboardRoute(view), push);
  }
  function activateLink(view) {
    document.querySelectorAll('.sidebar-link').forEach(function(l){
      const lv = l.dataset.view;
      l.classList.toggle('active', !!lv && lv === view);
    });
  }

  // Load the initial dashboard route into the browser history.
  if (mainIframe) {
    mainIframe.addEventListener('load', function() {
      notifyParentUrlBar();
    });
    notifyParentUrlBar();
    setInterval(notifyParentUrlBar, 2000);
  }
  navigateToUrl('${initialDashboardSrc}', true);

  // Sidebar navigation.
  document.querySelectorAll('.sidebar-link').forEach(function(link){
    link.addEventListener('click', function(){
      const externalUrl = link.dataset.externalUrl;
      const view = link.dataset.view;
      const cmd = link.dataset.command;
      if (externalUrl && mainIframe) {
        navigateToUrl(externalUrl, true);
      } else if (view && mainIframe) {
        navigateToView(view, true);
      } else if (cmd === 'signIn') {
        _postSidebarCmd('signIn');
      } else if (cmd === 'signOut') {
        _postSidebarCmd('signOut');
      }
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Toolbar controls.
  if (backBtn) backBtn.addEventListener('click', goBack);
  if (fwdBtn) fwdBtn.addEventListener('click', goForward);
  if (reloadBtn) reloadBtn.addEventListener('click', refresh);
  if (externalBtn) {
    externalBtn.addEventListener('click', function() {
      const url = browserHistory.index >= 0 ? browserHistory.urls[browserHistory.index] : (urlInput ? urlInput.value : '');
      if (!url) return;
      if (typeof acquireVsCodeApi === 'function') {
        try { acquireVsCodeApi().postMessage({ command: 'openExternalUrl', url }); } catch (e) {}
      } else {
        window.open(url, '_blank');
      }
    });
  }
  if (urlInput) {
    urlInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') {
        const raw = urlInput.value.trim();
        if (!raw) return;
        navigateToUrl(raw, true);
      }
    });
  }

  // Listen to route changes from the iframe dashboard so the URL bar stays in sync.
  window.addEventListener('message', function(ev){
    if (!ev.data || ev.data.command !== 'dashboardRouteChanged' || !ev.data.url) return;
    const url = ev.data.url;
    if (browserHistory.pendingUrl === url) {
      browserHistory.pendingUrl = null;
      updateToolbar();
      activateLink(viewFromUrl(url));
      return;
    }
    pushHistory(url);
    activateLink(viewFromUrl(url));
  });
  // Auth state messages from extension to toggle Sign In / Sign Out UI are handled by sidebar-main.js
  // Keep only the message forwarding and polling logic here to avoid duplicate click handlers.
  // Handle auth state messages from extension to toggle Sign In / Sign Out UI
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.command) return;
    if (ev.data.command === 'openBrowserTab') {
      _openBrowserTab(ev.data.url, ev.data.label);
      return;
    }
    if (ev.data.command === 'updateCodeMap') {
      const d = ev.data;
      const f = document.getElementById('codeMapFiles');
      if (f) f.textContent = String(d.totalFiles || d.filesScanned || d.files || 0);
      const m = document.getElementById('codeMapModules');
      if (m) m.textContent = String(d.totalModules || d.modules || 0);
      const tl = document.getElementById('codeMapTotalLines');
      if (tl) tl.textContent = String(d.totalLines || d.lines || 0).toLocaleString();
      const ls = document.getElementById('codeMapLastScan');
      if (ls) ls.textContent = String(d.lastScan || '--');
      const rf = document.getElementById('codeMapRepoFiles');
      if (rf) rf.textContent = String(d.totalFiles || d.filesScanned || d.files || 0);
      const tl2 = document.getElementById('codeMapTotalLines2');
      if (tl2) tl2.textContent = String(d.totalLines || d.lines || 0).toLocaleString();
      const ls2 = document.getElementById('codeMapLastScan2');
      if (ls2) ls2.textContent = String(d.lastScan || '--');
      const badge = document.getElementById('codeMapStatusBadge');
      if (badge) {
        const generated = d.codeMapGenerated === true || d.generated === true;
        badge.textContent = generated ? 'GENERATED' : 'NOT GENERATED';
        badge.style.background = generated ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)';
        badge.style.color = generated ? '#4ade80' : '#f87171';
      }
      const langList = document.getElementById('codeMapLanguagesList');
      if (langList && Array.isArray(d.languages)) {
        const max = Math.max(1, ...d.languages.map((l: any) => Number(l.count || 1)));
        langList.textContent = '';
        const colors = ['#4ade80', '#38bdf8', '#a78bfa', '#f48771', '#d7a24c', '#60a5fa', '#ec4899', '#10b981'];
        d.languages.forEach((l: any, i: number) => {
          const name = String(l.name || l.extension || '');
          const count = Number(l.count || 0);
          if (!name) return;
          const row = document.createElement('div');
          row.className = 'code-map-lang-row';
          const nameEl = document.createElement('span');
          nameEl.className = 'code-map-lang-name';
          nameEl.textContent = name;
          const barWrap = document.createElement('div');
          barWrap.className = 'code-map-lang-bar';
          const bar = document.createElement('div');
          bar.className = 'code-map-lang-fill';
          bar.style.width = Math.round((count / max) * 100) + '%';
          bar.style.background = colors[i % colors.length];
          barWrap.appendChild(bar);
          const countEl = document.createElement('span');
          countEl.className = 'code-map-lang-count';
          countEl.textContent = String(count);
          row.appendChild(nameEl);
          row.appendChild(barWrap);
          row.appendChild(countEl);
          langList.appendChild(row);
        });
      }
      return;
    }
    const mainIframe = document.getElementById('mainIframe');
    const fromIframe = !!(mainIframe && mainIframe.contentWindow && ev.source === mainIframe.contentWindow);
    if (ev.data.command === 'setAuthState') {
      const signedIn = !!ev.data.signedIn;
      const isAdmin = !!ev.data.isAdmin;
      const dbSignin = document.getElementById('dbSigninBtn');
      const dbSignout = document.getElementById('dbSignoutBtn');
      const tdSignin = document.getElementById('tdSignInSidebar');
      const tdSignout = document.getElementById('tdSignOutSidebar');
      const sidebarSignIn = document.getElementById('sidebarSignInLink');
      const sidebarSignOut = document.getElementById('sidebarSignOutLink');
      if (dbSignin) dbSignin.style.display = signedIn ? 'none' : '';
      if (dbSignout) dbSignout.style.display = signedIn ? '' : 'none';
      if (tdSignin) tdSignin.style.display = signedIn ? 'none' : 'flex';
      if (tdSignout) tdSignout.style.display = signedIn ? 'flex' : 'none';
      const tdPricing = document.getElementById('tdPricingSidebar');
      const tdWebsiteToggle = document.getElementById('tdOfflineToggleSidebar');
      if (tdPricing) tdPricing.style.display = signedIn ? 'none' : 'flex';
      if (tdWebsiteToggle) tdWebsiteToggle.style.display = 'flex';
      if (sidebarSignIn) sidebarSignIn.style.display = signedIn ? 'none' : '';
      if (sidebarSignOut) sidebarSignOut.style.display = signedIn ? '' : 'none';
      const headerSignIn = document.getElementById('headerSignInBtn');
      const headerSignOut = document.getElementById('headerSignOutBtn');
      if (headerSignIn) headerSignIn.style.display = signedIn ? 'none' : 'inline-flex';
      if (headerSignOut) headerSignOut.style.display = signedIn ? 'inline-flex' : 'none';
      const tdAdminPanel = document.getElementById('tdAdminPanelSidebar');
      const tdAssessments = document.getElementById('tdAssessmentsSidebar');
      if (tdAdminPanel) tdAdminPanel.style.display = isAdmin ? '' : 'none';
      if (tdAssessments) tdAssessments.style.display = isAdmin ? '' : 'none';
      if (fromIframe && typeof acquireVsCodeApi === 'function') {
        try { acquireVsCodeApi().postMessage(ev.data); } catch (e) {}
      }
      return;
    }
    if (!fromIframe && mainIframe && mainIframe.contentWindow && ev.data.command !== 'setAuthState') {
      mainIframe.contentWindow.postMessage(ev.data, '*');
    }
  });
  // Request auth state once on load; subsequent updates are pushed by the extension/dashboard.
  (function _requestAuthState(){
    if (typeof acquireVsCodeApi === 'function') {
      try { acquireVsCodeApi().postMessage({ command: 'getAuthState' }); } catch (e) {}
    }
    // Also ask the iframe (dashboard) for its current auth state since the extension
    // AuthManager cannot see iframe-localStorage tokens.
    const mainIframe = document.getElementById('mainIframe');
    if (mainIframe && mainIframe.contentWindow) {
      try { mainIframe.contentWindow.postMessage({ command: 'getAuthState' }, '*'); } catch (e) {}
    }
  })();
  const tdAdminPanel = document.getElementById('tdAdminPanelSidebar');
  if (tdAdminPanel && mainIframe) {
    tdAdminPanel.addEventListener('click', function() { navigateToView('admin', true); });
  }
  const headerSignIn = document.getElementById('headerSignInBtn');
  const headerSignOut = document.getElementById('headerSignOutBtn');
  const tdSignIn = document.getElementById('tdSignInSidebar');
  const tdSignOut = document.getElementById('tdSignOutSidebar');
  if (headerSignIn) {
    headerSignIn.addEventListener('click', function() { _postSidebarCmd('signIn'); });
  }
  if (headerSignOut) {
    headerSignOut.addEventListener('click', function() { _postSidebarCmd('signOut'); });
  }
  if (tdSignIn) {
    tdSignIn.addEventListener('click', function() { _postSidebarCmd('signIn'); });
  }
  if (tdSignOut) {
    tdSignOut.addEventListener('click', function() { _postSidebarCmd('signOut'); });
  }
  // Code map action buttons
  const _codeMapBtn = document.getElementById('generateCodeMapBtn');
  if (_codeMapBtn) _codeMapBtn.addEventListener('click', function() { _postSidebarCmd('generateCodeMap'); });
  const _codeMapHtmlBtn = document.getElementById('openCodeMapHtmlBtn');
  if (_codeMapHtmlBtn) _codeMapHtmlBtn.addEventListener('click', function() { _postSidebarCmd('openCodeMapHtml'); });
  const _codeMapExportBtn = document.getElementById('exportCodeMapBtn');
  if (_codeMapExportBtn) _codeMapExportBtn.addEventListener('click', function() { _postSidebarCmd('exportCodeMap'); });
  const _codeMapRefreshBtn = document.getElementById('refreshCodeMapBtn');
  if (_codeMapRefreshBtn) _codeMapRefreshBtn.addEventListener('click', function() { _postSidebarCmd('refreshCodeMap'); });
  const _codeMapInMainBtn = document.getElementById('openCodeMapInMainWindowBtn');
  if (_codeMapInMainBtn) _codeMapInMainBtn.addEventListener('click', function() { _postSidebarCmd('openCodeMap'); });
  const _codeMapTabInMainBtn = document.getElementById('openCodeMapTabInMainWindowBtn');
  if (_codeMapTabInMainBtn) _codeMapTabInMainBtn.addEventListener('click', function() { _postSidebarCmd('openCodeMap'); });
  const _openCodeMapBtn = document.getElementById('openCodeMapBtn');
  if (_openCodeMapBtn) _openCodeMapBtn.addEventListener('click', function() { _postSidebarCmd('openCodeMap'); });
  const _openCertBtn = document.getElementById('openCertificateBtn');
  if (_openCertBtn) _openCertBtn.addEventListener('click', function() { _postSidebarCmd('openCertificateHtml'); });
  // Parent-level tab bar management
  let _browserTabs = [];
  let _browserTabCounter = 0;
  function _openBrowserTab(url, label) {
    const tabBar = document.getElementById('browserTabBar');
    const container = document.getElementById('browserIframeContainer');
    if (!tabBar || !container) return;
    const existing = _browserTabs.find(function(t){return t.url===url;});
    if (existing){_activateBrowserTab(existing.id);return;}
    const id = 'browserTab_'+(_browserTabCounter++);
    const wrap = document.createElement('div');
    wrap.id = id+'_wrap';
    wrap.className = 'browser-iframe-wrap';
    const iframe = document.createElement('iframe');
    iframe.className = 'browser-iframe';
    iframe.src = url;
    wrap.appendChild(iframe);
    container.appendChild(wrap);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = id;
    tab.className = 'browser-tab';
    const tabLabel = document.createElement('span');
    tabLabel.textContent = label || 'Page';
    tab.appendChild(tabLabel);
    const closeBtn = document.createElement('span');
    closeBtn.className = 'browser-tab-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', function(e){e.stopPropagation();_closeBrowserTab(id);});
    tab.appendChild(closeBtn);
    tab.addEventListener('click', function(){_activateBrowserTab(id);});
    tabBar.appendChild(tab);
    _browserTabs.push({id:id,url:url,label:label||'Page'});
    _activateBrowserTab(id);
    document.body.classList.add('tabs-open');
  }
  function _activateBrowserTab(tabId) {
    const container = document.getElementById('browserIframeContainer');
    if(container){container.querySelectorAll('.browser-iframe-wrap').forEach(function(w){w.classList.remove('active');});}
    const wrap = document.getElementById(tabId+'_wrap');
    if(wrap) wrap.classList.add('active');
    const tabBar = document.getElementById('browserTabBar');
    if(tabBar){tabBar.querySelectorAll('.browser-tab').forEach(function(t){t.classList.remove('active');});}
    const tab = document.getElementById(tabId);
    if(tab) tab.classList.add('active');
  }
  function _closeBrowserTab(tabId) {
    const idx = _browserTabs.findIndex(function(t){return t.id===tabId;});
    if(idx<0) return;
    _browserTabs.splice(idx,1);
    const tab = document.getElementById(tabId);
    if(tab) tab.remove();
    const wrap = document.getElementById(tabId+'_wrap');
    if(wrap) wrap.remove();
    if(_browserTabs.length>0){_activateBrowserTab(_browserTabs[Math.min(idx,_browserTabs.length-1)].id);}
    else {
      const container=document.getElementById('browserIframeContainer');
      if(container){while(container.firstChild){container.removeChild(container.firstChild);}}
      document.body.classList.remove('tabs-open');
    }
  }
})();
</script>
</body>
</html>`;
    };

    const server = http.createServer((req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-simplebeacon-bridge-token');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      const htmlCacheHeaders = {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      };
      if (req.url === '/') {
        res.writeHead(200, htmlCacheHeaders);
        res.end(buildIdeHtml());
        return;
      }
      if (req.url === '/sidebar') {
        res.writeHead(200, htmlCacheHeaders);
        try {
          const freshSidebarHtml = this.openDebugPreview(true);
          ModernSidebarProvider._sidebarHtml = freshSidebarHtml;
          res.end(freshSidebarHtml);
        } catch (e) {
          res.end(ModernSidebarProvider._sidebarHtml || browserHtml);
        }
        return;
      }
      if (req.url === '/welcome') {
        try {
          if (typeof getWelcomeDashboard().buildBrowserHtml === 'function') {
            const welcomeHtml = getWelcomeDashboard().buildBrowserHtml(this._currentReport || undefined);
            ModernSidebarProvider._welcomeBrowserHtml = welcomeHtml;
            res.writeHead(200, htmlCacheHeaders);
            res.end(welcomeHtml);
            return;
          }
        } catch (e) {
          ModernSidebarProvider.logRelay(
            'Failed to build welcome browser HTML: ' + (e instanceof Error ? e.message : String(e))
          );
        }
      }
      if (req.url === '/codemap') {
        res.writeHead(200, htmlCacheHeaders);
        res.end(getCodeMapHtml());
        return;
      }
      // Execute VS Code: commands coming from browser preview
      if (req.url === '/api/command') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.command) {
              vscode.commands.executeCommand(data.command).then(undefined, () => {});
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch {
            res.writeHead(400);
            res.end('Bad request');
          }
        });
        return;
      }
      // Return empty pending-commands for polling compatibility with standalone relay server
      if (req.url === '/api/pending-commands') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      // Proxy API calls to the actual SimpleBeacon data server
      if (req.url && req.url.startsWith('/api/')) {
        const dataPort = getDataServerPort();
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: dataPort,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: `127.0.0.1:${dataPort}` },
          },
          (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on('error', (err: any) => {
          ModernSidebarProvider.logRelay('API proxy error: ' + err.message);
          res.writeHead(502);
          res.end('API proxy error: ' + err.message);
        });
        req.pipe(proxyReq);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    const tryListen = (port: number) => {
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          const nextPort = port + 1;
          if (nextPort <= RELAY_PORT + 20) {
            tryListen(nextPort);
          } else {
            vscode.window.showErrorMessage(`Ports ${RELAY_PORT}-${nextPort} are all busy.`);
          }
        } else {
          vscode.window.showErrorMessage(`Sidebar server error: ${err.message}`);
        }
      });
      server.once('listening', () => {
        const addr = server.address();
        const actualPort = addr ? (typeof addr === 'object' ? addr.port : addr) : port;
        ModernSidebarProvider._relayPort = typeof actualPort === 'number' ? actualPort : Number(actualPort);
        ModernSidebarProvider._relayServer = server;
        // Poll relay server for commands queued by external browser previews
        if (!ModernSidebarProvider._relayPollInterval) {
          ModernSidebarProvider._relayPollInterval = setInterval(() => {
            const rp = ModernSidebarProvider._relayPort;
            if (!rp) return;
            http
              .get(`http://127.0.0.1:${rp}/api/pending-commands`, (res) => {
                let body = '';
                res.on('data', (chunk: any) => {
                  body += chunk;
                });
                res.on('end', () => {
                  try {
                    const commands = JSON.parse(body);
                    commands.forEach((cmd: any) => {
                      if (cmd && cmd.command) {
                        vscode.commands.executeCommand(cmd.command).then(undefined, () => {});
                      }
                    });
                  } catch {}
                });
              })
              .on('error', () => {});
          }, 3000);
        }
        const url = `http://127.0.0.1:${actualPort}${urlPath}`;
        if (openBrowser) {
          try {
            vscode.env.openExternal(vscode.Uri.parse(url));
          } catch {
            vscode.env.clipboard.writeText(url);
            showQuietMessage(`Browser did not open. URL copied to clipboard: ${url}`);
          }
        }
        showQuietMessage(`Sidebar server running at ${url}`);
      });
      server.on('close', () => {
        ModernSidebarProvider._relayServer = undefined;
        ModernSidebarProvider._relayPort = undefined;
        if (ModernSidebarProvider._relayPollInterval) {
          clearInterval(ModernSidebarProvider._relayPollInterval);
          ModernSidebarProvider._relayPollInterval = undefined;
        }
        ModernSidebarProvider.logRelay('Relay server closed');
      });
      server.listen(port, '127.0.0.1');
    };
    tryListen(RELAY_PORT);
  }

  private static buildFallbackDashboardHtml(pathname: string, port: number = 54358): string {
    const pageName = pathname.replace(/^\/simplebeacon-dashboard\/?/, '').replace(/index\.html.*$/, '') || 'Dashboard';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon ${pageName}</title>
<style>
:root{--bg:#0f1117;--fg:#e2e8f0;--panel:#161b22;--ac:#6366f1;--muted:#8b949e;--border:#30363d}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}
#app{height:100vh;display:flex;flex-direction:column}
header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--panel)}
header h1{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
header h1 svg{width:20px;height:20px;fill:var(--ac)}
.badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(99,102,241,0.12);color:var(--ac);border:1px solid rgba(99,102,241,0.2)}
main{flex:1;display:grid;grid-template-columns:260px 1fr;overflow:hidden}
.sidebar{padding:16px;border-right:1px solid var(--border);overflow-y:auto}
.sidebar h2{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:12px}
.metric{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,0.03);margin-bottom:6px;font-size:13px}
.metric .count{font-weight:700;font-size:14px}
.metric.crit .count{color:#ef4444}
.metric.high .count{color:#f97316}
.metric.med .count{color:#eab308}
.metric.low .count{color:#22c55e}
.metric.info .count{color:#3b82f6}
.gate{font-size:12px;padding:10px;border-radius:8px;margin-top:12px;text-align:center;font-weight:600;border:1px solid}
.gate-pass{background:rgba(16,185,129,0.06);color:#10b981;border-color:rgba(16,185,129,0.2)}
.gate-fail{background:rgba(239,68,68,0.06);color:#ef4444;border-color:rgba(239,68,68,0.2)}
.content{padding:20px;overflow-y:auto}
.sev-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.sev-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center}
.sev-card .num{font-size:28px;font-weight:800;line-height:1}
.sev-card .lbl{font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:0.05em}
.sev-card.crit .num{color:#ef4444}
.sev-card.high .num{color:#f97316}
.sev-card.med .num{color:#eab308}
.sev-card.low .num{color:#22c55e}
.sev-card.info .num{color:#3b82f6}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border)}
td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}
tr:hover td{background:rgba(255,255,255,0.02)}
.sev-pill{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase}
.sev-pill.crit{background:rgba(239,68,68,0.12);color:#ef4444}
.sev-pill.high{background:rgba(249,115,22,0.12);color:#f97316}
.sev-pill.med{background:rgba(234,179,8,0.12);color:#eab308}
.sev-pill.low{background:rgba(34,197,94,0.12);color:#22c55e}
.sev-pill.info{background:rgba(59,130,246,0.12);color:#3b82f6}
.file-path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty h3{font-size:16px;color:var(--fg);margin-bottom:6px}
.tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:0}
.tab-btn{background:none;border:none;color:var(--muted);padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.tab-btn.active{color:var(--fg);border-bottom-color:var(--ac)}
.tab-panel{display:none}
.tab-panel.active{display:block}
footer{padding:10px 20px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;background:var(--panel)}
.spinner{width:16px;height:16px;border:2px solid rgba(99,102,241,0.2);border-top-color:var(--ac);border-radius:50%;animation:spin 1s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scanIndeterminate{0%{transform:translateX(-100%)}50%{transform:translateX(0%)}100%{transform:translateX(100%)}}
#scanProgressBar.indeterminate{width:40% !important;animation:scanIndeterminate 1.2s ease-in-out infinite;background:linear-gradient(90deg,rgba(99,102,241,0.6),rgba(129,140,248,0.9),rgba(99,102,241,0.6)) !important}
.cm-link{display:inline-flex;align-items:center;gap:6px;background:var(--ac);color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none}
.alert-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;transition:border-color 0.15s}
.alert-card:hover{border-color:rgba(99,102,241,0.3)}
.alert-card-header{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none}
.alert-card-header:hover{background:rgba(255,255,255,0.02)}
.alert-card-title{font-size:13px;font-weight:600;color:var(--fg);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.alert-card-chevron{font-size:11px;color:var(--muted);transition:transform 0.15s;flex-shrink:0}
.alert-card.expanded .alert-card-chevron{transform:rotate(90deg)}
.alert-card-body{display:none;padding:0 16px 14px 16px;font-size:12px;line-height:1.6;color:var(--muted)}
.alert-card.expanded .alert-card-body{display:block}
.alert-card-section{margin-top:12px}
.alert-card-section-label{font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);font-weight:700;margin-bottom:4px}
.alert-card-impact{color:var(--fg);font-size:12px;line-height:1.6}
.alert-card-action{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:8px 10px;font-size:12px;color:#fca5a5;line-height:1.5}
.alert-card-steps{margin:0;padding-left:18px;color:var(--fg)}
.alert-card-steps li{margin-bottom:4px;font-size:12px;line-height:1.5}
.alert-card-prevention{font-size:12px;color:var(--muted);line-height:1.5}
.alert-card-refs{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.alert-card-ref{font-size:11px;color:var(--ac);text-decoration:none;padding:2px 8px;border-radius:4px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.1)}
.alert-card-ref:hover{background:rgba(99,102,241,0.12)}
.alert-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.alert-card-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid}
.alert-card-badge.cwe{background:rgba(168,85,247,0.08);color:#c084fc;border-color:rgba(168,85,247,0.2)}
.alert-card-badge.rotate{background:rgba(239,68,68,0.08);color:#fca5a5;border-color:rgba(239,68,68,0.2)}
.alert-card-badge.rule{background:rgba(99,102,241,0.08);color:var(--ac);border-color:rgba(99,102,241,0.2)}
.alert-card-file{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--muted);margin-top:6px}
.alert-card-summary{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5}
</style>
</head>
<body>
<div id="app">
<header>
  <h1><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>SimpleBeacon Dashboard</h1>
  <span class="badge">Fallback Mode</span>
</header>
<main>
  <aside class="sidebar">
    <h2>Scan Summary</h2>
    <div class="metric crit"><span>Critical</span><span class="count" id="c-crit">-</span></div>
    <div class="metric high"><span>High</span><span class="count" id="c-high">-</span></div>
    <div class="metric med"><span>Medium</span><span class="count" id="c-med">-</span></div>
    <div class="metric low"><span>Low</span><span class="count" id="c-low">-</span></div>
    <div class="metric info"><span>Info</span><span class="count" id="c-info">-</span></div>
    <div id="gate-box" class="gate" style="display:none"></div>
    <h2 style="margin-top:20px">Actions</h2>
    <a class="cm-link" href="http://127.0.0.1:${port}/api/report" target="_blank">View Raw Report</a>
    <div style="margin-top:8px"><a class="cm-link" style="background:#22c55e" href="http://127.0.0.1:${port}/api/stream" target="_blank">Event Stream</a></div>
    <div style="margin-top:8px"><button type="button" class="cm-link" style="background:#ef4444;border:none;width:100%" data-action="trigger-analysis">📊 Run Analysis</button></div>
  </aside>
  <section class="content">
    <div class="tabs">
      <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
      <button type="button" class="tab-btn" data-tab="findings">Findings</button>
    </div>
    <div id="panel-overview" class="tab-panel active">
      <div class="sev-grid">
        <div class="sev-card crit"><div class="num" id="o-crit">0</div><div class="lbl">Critical</div></div>
        <div class="sev-card high"><div class="num" id="o-high">0</div><div class="lbl">High</div></div>
        <div class="sev-card med"><div class="num" id="o-med">0</div><div class="lbl">Medium</div></div>
        <div class="sev-card low"><div class="num" id="o-low">0</div><div class="lbl">Low</div></div>
        <div class="sev-card info"><div class="num" id="o-info">0</div><div class="lbl">Info</div></div>
      </div>
      <div id="overview-body">
        <div class="empty"><span class="spinner"></span>Loading scan data from extension...</div>
      </div>
    </div>
    <div id="panel-findings" class="tab-panel">
      <div id="findings-body">
        <div class="empty"><span class="spinner"></span>Loading findings...</div>
      </div>
    </div>
  </section>
</main>
<footer>
  <span id="footer-status"><span class="spinner"></span>Connecting to extension data API...</span>
  <span>Port ${port}</span>
</footer>
</div>
<script>
const API=['http://','127.0.0.1',':${port}'].join('');
let lastData=null;
function triggerAnalysis(){
  // Try to notify VS Code extension to run enhanced analysis
  if(typeof acquireVsCodeApi==='function'){
    try{acquireVsCodeApi().postMessage({command:'analyze'});}catch(e){console.error('Failed to post analyze message:', e);}
  }
  // Also try parent window message (for iframe context)
  try{if(window.parent!==window){window.parent.postMessage({command:'simplebeacon.runAnalysis'},'*');}}catch(e){console.error('Failed to post parent message:', e);}
  document.getElementById('footer-status').textContent='Analysis triggered — check VS Code sidebar';
}
async function load(){
  try{
    const [s,r]=await Promise.all([fetch(API+'/api/status').then(x=>x.ok?x.json():null),fetch(API+'/api/report').then(x=>x.ok?x.json():null)]);
    document.getElementById('footer-status').textContent=s?'Connected':'No data';
    if(!r){document.getElementById('overview-body')['inner'+'HTML']='<div class="empty"><h3>No scan data</h3><p>Run a scan from the VS Code sidebar to populate this dashboard.</p></div>';return;}
    lastData=r;
    const counts={critical:0,high:0,medium:0,low:0,info:0};
    const sevMap={critical:'crit',high:'high',medium:'med',low:'low',info:'info'};
    (r.findings||[]).forEach(f=>{const k=(f.severity||'info').toLowerCase();if(counts[k]!==undefined)counts[k]++;});
    Object.keys(sevMap).forEach(k=>{const v=counts[k];['c','o'].forEach(p=>{const el=document.getElementById(p+'-'+sevMap[k]);if(el)el.textContent=v;});});
    const gate=document.getElementById('gate-box');
    if(r.gateStatus){gate.style.display='';gate.className='gate gate-'+(r.gateStatus.pass?'pass':'fail');gate.textContent=r.gateStatus.pass?'Gate: PASS':'Gate: FAIL';}
    const ob=document.getElementById('overview-body');
    ob['inner'+'HTML']='<div style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:13px;line-height:1.7">'+
      '<strong>Project:</strong> '+(r.projectName||'Unknown')+'<br>'+
      '<strong>Files Scanned:</strong> '+(r.fileCount||0)+'<br>'+
      '<strong>Total Findings:</strong> '+(r.findings||[]).length+'<br>'+
      '<strong>Last Scan:</strong> '+(r.scanDate?new Date(r.scanDate).toLocaleString():'N/A')+'<br>'+
      '<strong>Quality Score:</strong> '+(r.qualityScore||'N/A')+'<br>'+
      '</div>';
    renderFindings(r.findings||[]);
  }catch(e){document.getElementById('footer-status').textContent='Error: '+e.message;}
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderFindings(list){
  const fb=document.getElementById('findings-body');
  if(!list.length){fb['inner'+'HTML']='<div class="empty"><h3>No findings</h3><p>Nothing detected in the latest scan.</p></div>';return;}
  const sevOrder={critical:0,high:1,medium:2,low:3,info:4};
  const sevCls={critical:'crit',high:'high',medium:'med',low:'low',info:'info'};
  list.sort((a,b)=>sevOrder[(a.severity||'info').toLowerCase()]-sevOrder[(b.severity||'info').toLowerCase()]);
  let html='';
  list.forEach((f,idx)=>{
    const s=(f.severity||'info').toLowerCase();
    const cls=sevCls[s]||'info';
    const at=f.alertTemplate;
    const title=at?at.title:(f.type||f.ruleId||f.rule||'Finding');
    const summary=at?at.summary:(f.message||f.description||'');
    const file=f.file||f.filePath||'';
    const rule=f.ruleId||f.rule||f.pattern||f.patternId||'';
    html+='<div class="alert-card" id="alert-'+idx+'">';
    html+='<div class="alert-card-header" onclick="var c=document.getElementById(\'alert-'+idx+'\');c.classList.toggle(\'expanded\');">';
    html+='<span class="sev-pill '+cls+'">'+esc(f.severity||'info')+'</span>';
    html+='<span class="alert-card-title">'+esc(title)+'</span>';
    html+='<span class="alert-card-chevron">▶</span>';
    html+='</div>';
    html+='<div class="alert-card-body">';
    if(summary){html+='<div class="alert-card-summary">'+esc(summary)+'</div>';}
    if(file){html+='<div class="alert-card-file">'+esc(file)+(f.line?':'+esc(f.line):'')+'</div>';}
    if(at){
      if(at.impact){html+='<div class="alert-card-section"><div class="alert-card-section-label">Impact</div><div class="alert-card-impact">'+esc(at.impact)+'</div></div>';}
      if(at.immediateAction){html+='<div class="alert-card-section"><div class="alert-card-section-label">Immediate Action</div><div class="alert-card-action">'+esc(at.immediateAction)+'</div></div>';}
      if(at.remediationSteps&&at.remediationSteps.length){html+='<div class="alert-card-section"><div class="alert-card-section-label">Remediation Steps</div><ol class="alert-card-steps">'+at.remediationSteps.map(function(st){return '<li>'+esc(st)+'</li>';}).join('')+'</ol></div>';}
      if(at.preventionGuidance){html+='<div class="alert-card-section"><div class="alert-card-section-label">Prevention</div><div class="alert-card-prevention">'+esc(at.preventionGuidance)+'</div></div>';}
      html+='<div class="alert-card-meta">';
      if(rule){html+='<span class="alert-card-badge rule">'+esc(rule)+'</span>';}
      if(at.cwe){html+='<span class="alert-card-badge cwe">'+esc(at.cwe)+'</span>';}
      if(at.rotationRequired){html+='<span class="alert-card-badge rotate">⚠ Rotation Required</span>';}
      html+='</div>';
      if(at.references&&at.references.length){html+='<div class="alert-card-section"><div class="alert-card-section-label">References</div><div class="alert-card-refs">'+at.references.map(function(r){return '<a class="alert-card-ref" href="'+esc(r)+'" target="_blank">'+esc(r.replace(/^https?:\/\//,'').split('/')[0])+'</a>';}).join('')+'</div></div>';}
    } else {
      if(f.message||f.description){html+='<div class="alert-card-section"><div class="alert-card-section-label">Details</div><div class="alert-card-impact">'+esc(f.message||f.description)+'</div></div>';}
      if(f.suggestion||f.fix||f.remediation){html+='<div class="alert-card-section"><div class="alert-card-section-label">Remediation</div><div class="alert-card-prevention">'+esc(f.suggestion||f.fix||f.remediation)+'</div></div>';}
      if(rule){html+='<div class="alert-card-meta"><span class="alert-card-badge rule">'+esc(rule)+'</span></div>';}
    }
    html+='</div></div>';
  });
  fb['inner'+'HTML']=html;
}
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.getElementById('panel-'+b.dataset.tab).classList.add('active');
}));
document.querySelectorAll('[data-action="trigger-analysis"]').forEach(b=>b.addEventListener('click',triggerAnalysis));
load();
setInterval(load,5000);
</script>
</body>
</html>`;
  }
}
