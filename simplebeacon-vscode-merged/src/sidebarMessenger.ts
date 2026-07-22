import * as vscode from 'vscode';
import * as path from 'path';
import * as http from 'http';
import { getDataServerPort, getTheme } from './dataServer';
import { getAuthManager } from './auth/authContext';

let _sidebarView: vscode.WebviewView | undefined;

/**
 * Register the sidebar webview view for messenger operations.
 */
export function registerSidebarView(view: vscode.WebviewView | undefined) {
  _sidebarView = view;
}

/**
 * Post a message to the sidebar webview.
 */
export function postSidebarMessage(message: any) {
  if (_sidebarView) {
    try { _sidebarView.webview.postMessage(message); } catch { /* ignore */ }
  }
}

function _escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripSimplebeaconEmbedParams(url: string): string {
  try {
    const parsed = new URL(url);
    ['sb_parent_urlbar', 'sb_notify_base', 'sb_api_base', 'sb_website_mode'].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

async function openUrlInIdeBrowser(url: string): Promise<void> {
  const clean = stripSimplebeaconEmbedParams(url);
  await vscode.commands.executeCommand('simpleBrowser.show', clean);
}

/** Normalize a dashboard route to /dashboard/<view> form used by dashboard-web. */
export function normalizeDashboardPath(route: string): string {
  let normalized = route.startsWith('/') ? route : `/${route}`;
  if (normalized === '/dashboard/dashboard' || normalized === '/dashboard/dashboard/') {
    normalized = '/dashboard';
  }
  if (normalized === '/dashboard' || normalized === '/dashboard/') {
    return '/dashboard';
  }
  if (!normalized.startsWith('/dashboard/')) {
    normalized = `/dashboard${normalized}`;
  }
  return normalized;
}

/** True when the URL can load inside the dashboard iframe (SimpleBeacon + local dev hosts). */
export function canEmbedInIframe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) return true;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.onrender.com')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Default marketing-site origin for roadmap/audit/pricing paths. */
export function getMarketingSiteOrigin(): string {
  return 'https://simplebeacon.ai';
}

const SITE_PATHS = ['/roadmap', '/audit', '/pricing', '/contact', '/team', '/security', '/terms', '/privacy', '/refund', '/faq'];

function isMarketingSitePath(pathname: string): boolean {
  return SITE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

/** Rewrite remote simplebeacon.ai URLs to the local data-server for IDE preview embedding. */
export function rewriteRemotePreviewUrl(url: string, localBase: string): string {
  try {
    const parsed = new URL(url);
    const isRemote = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.hostname));
    if (!isRemote) return url;
    const base = localBase.replace(/\/$/, '');
    const params = new URLSearchParams(parsed.search);
    params.delete('sb_notify_base');
    params.delete('sb_api_base');
    const search = params.toString() ? `?${params.toString()}` : '';
    const hash = parsed.hash || '';
    if (isMarketingSitePath(parsed.pathname)) {
      const htmlPath = parsed.pathname.endsWith('.html') ? parsed.pathname : `${parsed.pathname}.html`;
      return `${base}${htmlPath}${search}${hash}`;
    }
    let route = parsed.pathname;
    if (route === '/' || route === '' || route === '/dashboard' || route === '/dashboard/') {
      route = '/dashboard';
    } else if (!route.startsWith('/dashboard/')) {
      route = `/dashboard${route.startsWith('/') ? route : `/${route}`}`;
    }
    return `${base}${route}${search}${hash}`;
  } catch {
    return url;
  }
}

/**
 * IDE preview URL rewrite.
 * - Localhost mode: proxy everything through the data-server.
 * - Website mode: keep all URLs on simplebeacon.ai (sb_parent_urlbar=1 hides the
 *   duplicate address bar on the live site).
 */
export function rewriteIdePreviewUrl(url: string, localBase: string, websiteMode: boolean): string {
  if (!websiteMode) {
    return rewriteRemotePreviewUrl(url, localBase);
  }
  try {
    const parsed = new URL(url);
    const isRemote = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.hostname));
    if (!isRemote) return url;
    // Website mode: dashboard routes must be rewritten to localhost because the hosted
    // site's CSP (frame-ancestors 'none') blocks iframe embedding. Marketing pages stay
    // on simplebeacon.ai and are opened via simple browser when canEmbed returns false.
    if (parsed.pathname === '/dashboard' || parsed.pathname.startsWith('/dashboard/')) {
      return rewriteRemotePreviewUrl(url, localBase);
    }
    return url;
  } catch {
    return url;
  }
}

/** Public website URL shown in the wrapper address bar while the iframe may load locally. */
export function buildDashboardDisplayUrl(canonicalUrl: string, iframeUrl: string, websiteMode: boolean): string {
  if (!websiteMode) return iframeUrl;
  try {
    const canonical = new URL(canonicalUrl);
    const host = canonical.hostname.toLowerCase();
    if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) {
      return canonicalUrl;
    }
    const iframe = new URL(iframeUrl);
    if (/^(localhost|127\.0\.0\.1)$/i.test(iframe.hostname) && iframe.pathname.startsWith('/dashboard')) {
      return `https://simplebeacon.ai${iframe.pathname}${iframe.search}${iframe.hash}`;
    }
  } catch { /* ignore */ }
  return canonicalUrl;
}

/**
 * Resolve address-bar input to a full URL.
 * Marketing paths (/roadmap, /pricing, …) stay on the site origin; dashboard paths use /dashboard/.
 */
export function resolveSiteUrlInput(raw: string, baseOrigin: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = baseOrigin.replace(/\/$/, '');
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/dashboard/') || trimmed === '/dashboard') return `${origin}${trimmed}`;
    if (SITE_PATHS.some((p) => trimmed === p || trimmed.startsWith(`${p}/`) || trimmed.startsWith(`${p}?`))) {
      return `${origin}${trimmed}`;
    }
    return `${origin}/dashboard${trimmed}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed.replace(/^\/+/, '')}`;
  return `${origin}/dashboard/${trimmed.replace(/^#?\/?/, '')}`;
}

/** True when the URL targets a dashboard route (needs extension API bridge in website mode). */
function isDashboardEmbedUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname || '';
    return path === '/dashboard' || path.startsWith('/dashboard/');
  } catch {
    return url.includes('/dashboard');
  }
}

function isRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.hostname));
  } catch {
    return false;
  }
}

/** Append iframe embed params so the dashboard hides its duplicate URL bar. */
export function appendDashboardEmbedParams(url: string, notifyBase?: string, websiteMode?: boolean): string {
  let result = url;
  const remote = isRemoteUrl(url);
  // Only bridge the local data server API for local/localhost dashboards.
  // Remote dashboards (e.g. simplebeacon.ai) must use their own backend API;
  // injecting a local HTTP sb_api_base would be blocked by CORS/mixed-content.
  const needsApiBridge = Boolean(notifyBase && isDashboardEmbedUrl(url) && !remote);
  if (notifyBase) {
    if (!result.includes('sb_notify_base=')) {
      const sep = result.includes('?') ? '&' : '?';
      result = `${result}${sep}sb_notify_base=${encodeURIComponent(notifyBase)}`;
    }
    const needsBridge = needsApiBridge || (websiteMode && isDashboardEmbedUrl(url) && !remote);
    if (needsBridge && !result.includes('sb_api_base=')) {
      const sep = result.includes('?') ? '&' : '?';
      result = `${result}${sep}sb_api_base=${encodeURIComponent(notifyBase)}`;
    }
  }
  if (!result.includes('sb_parent_urlbar=')) {
    const sep = result.includes('?') ? '&' : '?';
    result = `${result}${sep}sb_parent_urlbar=1`;
  }
  if (websiteMode && !result.includes('sb_website_mode=')) {
    const sep = result.includes('?') ? '&' : '?';
    result = `${result}${sep}sb_website_mode=1`;
  }
  return result;
}

/** Build a full dashboard URL from a host origin and route path. */
export function buildDashboardUrl(baseUrl: string, route: string, extraQuery?: string): string {
  const origin = baseUrl.replace(/\/$/, '');
  const path = normalizeDashboardPath(route);
  const parts: string[] = [];
  if (extraQuery) { parts.push(extraQuery.replace(/^\?/, '')); }
  const sep = path.includes('?') ? '&' : '?';
  const query = parts.length > 0 ? `${sep}${parts.join('&')}` : '';
  return `${origin}${path}${query}`;
}

/** Shared Simple Browser-style address bar styles for dashboard webview panels. */
export function getDashboardUrlBarStyles(theme: 'dark' | 'light' = getTheme()): string {
  const isLight = theme === 'light';
  const barBg = isLight ? '#f3f3f3' : '#252526';
  const barBorder = isLight ? '#e0e0e0' : '#1e1e1e';
  const btnColor = isLight ? '#424242' : '#cccccc';
  const btnHoverBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const btnHoverColor = isLight ? '#1e1e1e' : '#ffffff';
  const inputBg = isLight ? '#ffffff' : '#3c3c3c';
  const inputBorder = isLight ? '#cecece' : '#3c3c3c';
  const inputFg = isLight ? '#333333' : '#cccccc';
  const inputFocusBg = isLight ? '#ffffff' : '#1e1e1e';
  const pageBg = isLight ? '#f3f3f3' : '#1e1e1e';
  return `
  html, body { background: ${pageBg}; color: ${inputFg}; }
  .sb-url-bar { display: flex; align-items: center; gap: 2px; padding: 0 8px; background: ${barBg}; border-bottom: 1px solid ${barBorder}; flex-shrink: 0; height: 36px; box-sizing: border-box; }
  .sb-url-bar button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 4px; background: transparent; color: ${btnColor}; cursor: pointer; flex-shrink: 0; }
  .sb-url-bar button:hover:not(:disabled) { background: ${btnHoverBg}; color: ${btnHoverColor}; }
  .sb-url-bar button:disabled { opacity: 0.35; cursor: default; }
  .sb-url-bar button svg { display: block; }
  .sb-url-bar input { flex: 1; min-width: 0; height: 26px; padding: 0 10px; border: 1px solid ${inputBorder}; border-radius: 4px; background: ${inputBg}; color: ${inputFg}; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .sb-url-bar input:focus { outline: 1px solid #007fd4; border-color: #007fd4; background: ${inputFocusBg}; color: ${inputFg}; }
  .sb-url-spacer { width: 4px; flex-shrink: 0; }`;
}

/** Shared Simple Browser-style address bar markup. */
export function getDashboardUrlBarHtml(ids: { back: string; fwd: string; reload: string; input: string; external: string }, initialUrl: string): string {
  const safeUrl = _escapeHtmlAttr(initialUrl);
  return `<div class="sb-url-bar">
  <button id="${ids.back}" title="Go back" disabled aria-label="Go back"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg></button>
  <button id="${ids.fwd}" title="Go forward" disabled aria-label="Go forward"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg></button>
  <button id="${ids.reload}" title="Reload" aria-label="Reload"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 3.5V8H9"/></svg></button>
  <span class="sb-url-spacer"></span>
  <input id="${ids.input}" type="text" value="${safeUrl}" spellcheck="false" aria-label="Address bar" />
  <button id="${ids.external}" title="Open in browser" aria-label="Open in browser"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5H3.5v9h9V9.5"/><path d="M9 3.5h3.5V7"/><path d="M7 9l6.5-6.5"/></svg></button>
</div>`;
}

/**
 * Build a minimal webview HTML wrapper that embeds a remote dashboard in an iframe
 * and forwards postMessage events from the iframe to the extension via vscode.postMessage.
 */
function _getWebsiteDashboardWebviewHtml(url: string, scriptUri: string, websiteMode = false, displayUrl?: string): string {
  const safeIframeUrl = _escapeHtmlAttr(url);
  const safeDisplayUrl = _escapeHtmlAttr(displayUrl || url);
  const theme = getTheme();
  const localBase = `http://127.0.0.1:${getDataServerPort()}`;
  const urlBar = getDashboardUrlBarHtml({
    back: 'sbBackBtn',
    fwd: 'sbFwdBtn',
    reload: 'sbReloadBtn',
    input: 'sbUrlInput',
    external: 'sbExternalBtn'
  }, safeDisplayUrl);
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
  ${getDashboardUrlBarStyles(theme)}
  .dash-wrap { flex: 1; min-height: 0; position: relative; }
  iframe { width: 100%; height: 100%; border: none; display: block; background: transparent; }
  #drag-overlay { display: none; position: fixed; top: 36px; left: 0; width: 100%; height: calc(100% - 36px); z-index: 100; background: rgba(37,99,235,0.08); border: 3px dashed #2563eb; box-sizing: border-box; pointer-events: auto; }
</style>
</head>
<body>
${urlBar}
<div class="dash-wrap">
  <div id="drag-overlay"></div>
  <iframe id="dash" src="${safeIframeUrl}" allow="clipboard-read; clipboard-write; autoplay"></iframe>
</div>
<script>window.__SB_LOCAL_DASHBOARD_BASE__=${JSON.stringify(localBase)};window.__SB_WRAPPER_THEME__=${JSON.stringify(theme)};window.__SB_WEBSITE_MODE__=${websiteMode ? '1' : '0'};window.__SB_DISPLAY_URL__=${JSON.stringify(displayUrl || url)};</script>
<script src="${scriptUri}"></script>
</body>
</html>`;
}

let _activeWebsiteDashboardPanel: vscode.WebviewPanel | undefined;

export function postWebsiteDashboardMessage(message: any): void {
  _activeWebsiteDashboardPanel?.webview.postMessage(message);
}

export function isWebsiteDashboardPanelOpen(): boolean {
  return !!_activeWebsiteDashboardPanel;
}

/** Navigate the active Team Dashboard webview panel without rebuilding it. */
export function navigateWebsiteDashboardPanel(url: string): boolean {
  if (!_activeWebsiteDashboardPanel) { return false; }
  try {
    _activeWebsiteDashboardPanel.reveal();
    const dataServerPort = getDataServerPort();
    const localBase = `http://127.0.0.1:${dataServerPort}`;
    const notifyBase = `${localBase}/api`;
    let websiteMode = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ModernSidebarProvider } = require('./modernSidebarProvider') as typeof import('./modernSidebarProvider');
      websiteMode = ModernSidebarProvider.getDashboardMode() === 'website';
    } catch { /* ignore */ }
    const canonical = url;
    const iframeUrl = appendDashboardEmbedParams(rewriteIdePreviewUrl(url, localBase, websiteMode), notifyBase, websiteMode);
    const displayUrl = buildDashboardDisplayUrl(
      appendDashboardEmbedParams(canonical, notifyBase, websiteMode),
      iframeUrl,
      websiteMode
    );
    _activeWebsiteDashboardPanel.webview.postMessage({ command: 'navigateToRoute', url: iframeUrl, displayUrl });
    return true;
  } catch {
    return false;
  }
}

function _pushThemeAndAuth(panel: vscode.WebviewPanel) {
  setTimeout(() => {
    if (_activeWebsiteDashboardPanel === panel) {
      panel.webview.postMessage({ command: 'setTheme', theme: getTheme() });
      const ws = vscode.workspace.workspaceFolders;
      if (ws && ws.length > 0) {
        panel.webview.postMessage({ command: 'setWorkspacePath', path: ws[0].uri.fsPath });
      }
      import('./modernSidebarProvider').then(({ ModernSidebarProvider }) => {
        ModernSidebarProvider.refreshAuthState();
      }).catch(() => {});
    }
  }, 800);
}

/**
 * Close any orphaned SimpleBeacon website dashboard tabs (e.g. from a previous
 * extension reload) so we don't accumulate webview panels and leak listeners.
 */
function _closeOrphanedDashboardPanels(): void {
  try {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputWebview && tab.input.viewType === 'simplebeaconWebsiteDashboard') {
          vscode.window.tabGroups.close(tab, false);
        }
      }
    }
  } catch { /* ignore */ }
}

/**
 * Open the remote website dashboard in a VS Code webview panel so it can bridge
 * auth events (setAuthState) back to the extension and sidebar.
 */
export function openWebsiteDashboardPanel(url: string, title = 'SimpleBeacon Dashboard') {
  if (_activeWebsiteDashboardPanel) {
    try {
      if (navigateWebsiteDashboardPanel(url)) {
        return;
      }
    } catch {
      _activeWebsiteDashboardPanel = undefined;
    }
  }

  _closeOrphanedDashboardPanels();

  const panel = vscode.window.createWebviewPanel(
    'simplebeaconWebsiteDashboard',
    title,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, enableDragAndDrop: true } as vscode.WebviewPanelOptions
  );
  _activeWebsiteDashboardPanel = panel;
  panel.onDidDispose(() => { if (_activeWebsiteDashboardPanel === panel) _activeWebsiteDashboardPanel = undefined; });

  // Register the message handler before setting the HTML so no iframe messages
  // (e.g. an early setAuthState from the dashboard) are dropped between load and handler attachment.
  panel.webview.onDidReceiveMessage(async (message: any) => {
    if (!message || !message.command) return;
    if (message.command === 'getAuthState') {
      void (async () => {
        try {
          const port = getDataServerPort();
          const res = await fetch(`http://127.0.0.1:${port}/api/auth/token`);
          const data = await res.json() as { success?: boolean; token?: string; tier?: string; user?: { tier?: string } };
          if (data?.success && data?.token) {
            panel.webview.postMessage({
              command: 'setAuthState',
              signedIn: true,
              token: data.token,
              tier: data.tier || data.user?.tier || '',
              isAdmin: false,
              source: 'extensionBridge'
            });
          }
        } catch { /* data server offline */ }
        import('./modernSidebarProvider').then(({ ModernSidebarProvider }) => {
          ModernSidebarProvider.refreshAuthState('websitePanel');
        }).catch(() => {});
      })();
      return;
    }
    if (message.command === 'setAuthState') {
      const signedIn = !!message.signedIn;
      const token = typeof message.token === 'string' ? message.token : '';
      const tier = message.tier || '';
      const isAdmin = !!message.isAdmin;
      try {
        const authManager = getAuthManager();
        if (signedIn && token) {
          await authManager.setToken(token);
          if (typeof message.userEmail === 'string') { await authManager.setUserEmail(message.userEmail); }
          if (typeof message.userName === 'string') { await authManager.setUserName(message.userName); }
          vscode.window.showInformationMessage('Signed in from SimpleBeacon website.');
        } else if (!signedIn) {
          await authManager.clearToken();
          vscode.window.showInformationMessage('Signed out from SimpleBeacon website.');
        }
      } catch { /* auth manager may not be initialized */ }
      postSidebarMessage({ command: 'setAuthState', signedIn, token, tier, isAdmin, source: 'websitePanel' });
      // Also update extension-side caches and trigger a refresh so the AuthManager mirrors the website token.
      import('./modernSidebarProvider').then(({ ModernSidebarProvider }) => {
        ModernSidebarProvider.setSidebarAuthState(signedIn, tier, token, 'websitePanel', isAdmin);
        setTimeout(() => ModernSidebarProvider.refreshAuthState('websitePanel'), 50);
      }).catch(() => {});
    }
    if (message.command === 'scanWorkspace' && message.path) {
      Promise.resolve(vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: message.path })).catch(() => {});
    }
    if (message.command === 'downloadComplete') {
      const filename = typeof message.filename === 'string' ? message.filename : '';
      const filePath = typeof message.filePath === 'string' ? message.filePath : '';
      if (filename) {
        const { ModernSidebarProvider } = await import('./modernSidebarProvider');
        ModernSidebarProvider.addDownloadedFile(filename, filePath);
      }
    }
    if (message.command === 'updateReport' && message.report) {
      postSidebarMessage({ command: 'updateReport', report: message.report });
      const { ModernSidebarProvider } = await import('./modernSidebarProvider');
      ModernSidebarProvider.updateSidebarReport(message.report);
    }
    if (message.command === 'scanComplete' && message.stats) {
      postSidebarMessage({ command: 'scanComplete', stats: message.stats });
    }
    if (message.command === 'sendToAI' && message.data) {
      postSidebarMessage({ command: 'sendToAI', data: message.data });
    }
    if (message.command === 'openInSimpleBrowser' && typeof message.url === 'string' && message.url) {
      Promise.resolve(openUrlInIdeBrowser(message.url)).catch(() => {});
    }
    if (message.command === 'openExternalUrl' && typeof message.url === 'string' && message.url) {
      const clean = stripSimplebeaconEmbedParams(message.url);
      Promise.resolve(vscode.env.openExternal(vscode.Uri.parse(clean))).catch(() => {});
    }
    if (message.command === 'bridgeFetch' && typeof message.url === 'string' && message.requestId) {
      const bfUrl = message.url;
      const bfReqId = message.requestId;
      try {
        const parsed = new URL(bfUrl);
        if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
          panel.webview.postMessage({ command: 'bridgeFetchResponse', requestId: bfReqId, error: 'Only localhost URLs allowed' });
          return;
        }
        const reqOpts: http.RequestOptions = {
          hostname: parsed.hostname,
          port: parsed.port || '80',
          path: parsed.pathname + parsed.search,
          method: message.init?.method || 'GET',
          headers: message.init?.headers || {},
          timeout: 20000,
        };
        const req = http.request(reqOpts, (res: http.IncomingMessage) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const contentType = res.headers['content-type'] || 'application/json';
            panel.webview.postMessage({
              command: 'bridgeFetchResponse',
              requestId: bfReqId,
              status: res.statusCode || 200,
              contentType,
              body,
            });
          });
        });
        req.on('error', (err: NodeJS.ErrnoException) => {
          panel.webview.postMessage({ command: 'bridgeFetchResponse', requestId: bfReqId, error: err.message });
        });
        req.on('timeout', () => {
          req.destroy();
          panel.webview.postMessage({ command: 'bridgeFetchResponse', requestId: bfReqId, error: 'Request timeout' });
        });
        if (message.init?.body) {
          req.write(message.init.body);
        }
        req.end();
      } catch (err: unknown) {
        panel.webview.postMessage({ command: 'bridgeFetchResponse', requestId: bfReqId, error: (err as Error).message });
      }
    }
  });

  const dataServerPort = getDataServerPort();
  const localBase = `http://127.0.0.1:${dataServerPort}`;
  const notifyBase = `${localBase}/api`;

  let websiteMode = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ModernSidebarProvider } = require('./modernSidebarProvider') as typeof import('./modernSidebarProvider');
    websiteMode = ModernSidebarProvider.getDashboardMode() === 'website';
  } catch { /* extension still starting */ }

  // Localhost mode: dashboard iframe via data-server. Website mode: same iframe + simplebeacon.ai in the address bar.
  const canonical = url;
  url = rewriteIdePreviewUrl(url, localBase, websiteMode);
  url = appendDashboardEmbedParams(url, notifyBase, websiteMode);
  const displayUrl = buildDashboardDisplayUrl(
    appendDashboardEmbedParams(canonical, notifyBase, websiteMode),
    url,
    websiteMode
  );
  const mediaPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'dashboard-wrapper.js'));
  const scriptUri = panel.webview.asWebviewUri(mediaPath).toString();
  panel.webview.html = _getWebsiteDashboardWebviewHtml(url, scriptUri, websiteMode, displayUrl);
  _pushThemeAndAuth(panel);
}

/**
 * Open the team dashboard in VS Code:'s Simple Browser (localhost) or a webview panel (website/remote).
 * @param route Dashboard route (e.g. /dashboard).
 * @param baseUrl Optional host origin. Defaults to the local data server.
 */
export function openTeamDashboardPanel(_extUri: vscode.Uri, route = '/dashboard', _panelTitle = 'Team Dashboard', baseUrl?: string, extraQuery?: string) {
  const dataServerPort = getDataServerPort();
  const isRemote = !!baseUrl && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(baseUrl);
  let normalizedRoute = route;
  if (isRemote) {
    normalizedRoute = normalizedRoute.replace(/^\/dashboard\/dashboard\/?$/, '/dashboard');
    if (!normalizedRoute.startsWith('/dashboard/') && normalizedRoute !== '/dashboard') {
      normalizedRoute = '/dashboard' + (normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute);
    }
  }
  let dashboardUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute}`
    : `http://127.0.0.1:${dataServerPort}${normalizedRoute}`;
  const parts: string[] = [];
  if (extraQuery) { parts.push(extraQuery); }
  // Append a cache-buster to force the browser to fetch the latest index.html/module graph.
  parts.push(`_=${Date.now()}`);
  const sep = dashboardUrl.includes('?') ? '&' : '?';
  dashboardUrl += sep + parts.join('&');
  openWebsiteDashboardPanel(dashboardUrl, _panelTitle || 'Team Dashboard');
}
