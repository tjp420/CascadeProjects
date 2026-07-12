import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getDataServerPort } from './dataServer';

let _sidebarView: vscode.WebviewView | undefined;
let _teamDashboardPanel: vscode.WebviewPanel | undefined;
let _onDashboardAuthState: ((signedIn: boolean, tier: string, token: string, isAdmin: boolean) => void) | undefined;
let _onDashboardLicenseToken: ((token: string) => void) | undefined;

/**
 * Register the sidebar webview view for messenger operations.
 */
export function registerSidebarView(view: vscode.WebviewView | undefined) {
  _sidebarView = view;
}

/**
 * Register the team dashboard panel for messenger operations.
 */
export function registerTeamDashboardPanel(panel: vscode.WebviewPanel | undefined) {
  _teamDashboardPanel = panel;
}

/**
 * Register a callback that receives auth-state updates from the team dashboard iframe.
 */
export function setDashboardAuthStateCallback(cb: typeof _onDashboardAuthState) {
  _onDashboardAuthState = cb;
}

/**
 * Register a callback that receives license-token updates from the team dashboard iframe.
 */
export function setDashboardLicenseTokenCallback(cb: typeof _onDashboardLicenseToken) {
  _onDashboardLicenseToken = cb;
}

/**
 * Post a message to the sidebar webview.
 */
export function postSidebarMessage(message: any) {
  if (_sidebarView) {
    try { _sidebarView.webview.postMessage(message); } catch { /* ignore */ }
  }
}

/**
 * In-memory navigation history for the IDE dashboard browser.
 */
interface DashboardHistory {
  urls: string[];
  index: number;
}

const _dashboardHistory: DashboardHistory = { urls: [], index: -1 };

function normalizeDashboardUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('_')) {
      u.searchParams.delete('_');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function getCurrentDashboardUrl(): string | undefined {
  return _dashboardHistory.urls[_dashboardHistory.index];
}

function pushDashboardUrl(url: string): string {
  const normalized = normalizeDashboardUrl(url);
  // Remove any forward history before pushing a new URL.
  _dashboardHistory.urls = _dashboardHistory.urls.slice(0, _dashboardHistory.index + 1);
  if (_dashboardHistory.urls[_dashboardHistory.index] === normalized) {
    return normalized;
  }
  _dashboardHistory.urls.push(normalized);
  _dashboardHistory.index = _dashboardHistory.urls.length - 1;
  return normalized;
}

function goBackDashboardUrl(): string | undefined {
  if (_dashboardHistory.index > 0) {
    _dashboardHistory.index--;
  }
  return getCurrentDashboardUrl();
}

function goForwardDashboardUrl(): string | undefined {
  if (_dashboardHistory.index < _dashboardHistory.urls.length - 1) {
    _dashboardHistory.index++;
  }
  return getCurrentDashboardUrl();
}

function canGoBackDashboard(): boolean {
  return _dashboardHistory.index > 0;
}

function canGoForwardDashboard(): boolean {
  return _dashboardHistory.index < _dashboardHistory.urls.length - 1;
}

function postDashboardUrlUpdate(panel: vscode.WebviewPanel, url: string) {
  try {
    panel.webview.postMessage({
      command: 'updateUrl',
      url,
      canGoBack: canGoBackDashboard(),
      canGoForward: canGoForwardDashboard()
    });
  } catch { /* ignore */ }
}

function postDashboardFrameNavigate(panel: vscode.WebviewPanel, url: string) {
  try {
    panel.webview.postMessage({
      command: 'navigateFrame',
      url
    });
  } catch { /* ignore */ }
}

function buildDashboardBrowserHtml(url: string, nonce: string, csp: string, dataServerPort: number, panelTitle: string): string {
  const dashboardOrigin = url.replace(/^([a-z]+:\/\/[^\/]+).*/i, '$1');
  const sandboxAttr = 'sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'sha256-8dabdfec5b3d124c7500bd1750e104e913837fa83875ffee199fb41ec5baaf10' 'sha256-8a458cc9bcca606bebe113079c20681329a0ca2dd3e343cae8ee57a850b1ae49' http://127.0.0.1:${dataServerPort}; style-src 'unsafe-inline' http://127.0.0.1:${dataServerPort}; frame-src http://127.0.0.1:${dataServerPort} ${dashboardOrigin} https://simplebeacon.ai https://*.simplebeacon.ai https://*.onrender.com ${csp}; connect-src http://127.0.0.1:${dataServerPort} ${dashboardOrigin} https://simplebeacon.ai https://*.simplebeacon.ai https://*.onrender.com; img-src http://127.0.0.1:${dataServerPort} ${dashboardOrigin} https://simplebeacon.ai https://*.simplebeacon.ai https://*.onrender.com data:; font-src http://127.0.0.1:${dataServerPort} https://fonts.gstatic.com;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${panelTitle}</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0B0F19; }
body { display: flex; flex-direction: column; }
.url-bar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #0d1117; border-bottom: 1px solid #21262d; flex-shrink: 0; }
.url-bar input { flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: #c9d1d9; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; text-align: center; }
.url-bar input:focus { outline: none; border-color: #58a6ff; text-align: left; }
.url-bar button { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: transparent; border: none; border-radius: 4px; color: #9ca3af; cursor: pointer; padding: 0; }
.url-bar button:hover:not(:disabled) { background: #21262d; color: #e2e8f0; }
.url-bar button:disabled { opacity: 0.35; cursor: not-allowed; }
.url-bar .nav-actions { display: flex; align-items: center; gap: 2px; }
.url-bar .url-actions { display: flex; align-items: center; gap: 2px; margin-left: 4px; }
iframe { border: 0; width: 100%; flex: 1; display: block; }
.fallback { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #e2e8f0; font-family: sans-serif; padding: 20px; text-align: center; display: none; }
.fallback a { color: #60a5fa; }
</style>
</head>
<body>
<div class="url-bar">
  <div class="nav-actions">
    <button id="backBtn" title="Go back" aria-label="Go back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button id="fwdBtn" title="Go forward" aria-label="Go forward"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    <button id="reloadBtn" title="Reload" aria-label="Reload"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg></button>
  </div>
  <input id="urlInput" type="text" value="${url}" spellcheck="false" />
  <div class="url-actions">
    <button id="openExternalBtn" title="Open in Simple Browser" aria-label="Open in Simple Browser"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></button>
  </div>
</div>
<iframe id="dashFrame" src="${url}" ${sandboxAttr} allow="fullscreen"></iframe>
<div id="dashFallback" class="fallback">
  <p>Dashboard did not load in the sidebar iframe.</p>
  <p><a href="#" id="openDashLink">Open Dashboard in Simple Browser</a></p>
</div>
<script nonce="${nonce}">
(function(){
  const vscode = acquireVsCodeApi();
  const frame = document.getElementById('dashFrame');
  const urlInput = document.getElementById('urlInput');
  const backBtn = document.getElementById('backBtn');
  const fwdBtn = document.getElementById('fwdBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const openExternalBtn = document.getElementById('openExternalBtn');
  const fallback = document.getElementById('dashFallback');
  const openLink = document.getElementById('openDashLink');
  const baseUrl = '${url}';
  const dashboardOrigin = '${dashboardOrigin}';
  function isDashboardUrl(url) {
    try { const u = new URL(url, dashboardOrigin); return u.origin === dashboardOrigin; } catch (e) { return false; }
  }
  function updateUrlBar(url, canGoBack, canGoForward) {
    if (urlInput) urlInput.value = url;
    if (backBtn) backBtn.disabled = !canGoBack;
    if (fwdBtn) fwdBtn.disabled = !canGoForward;
  }
  // Listen for extension messages. updateUrl updates the URL bar/buttons;
  // navigateFrame actually changes the iframe src.
  window.addEventListener('message', function(e) {
    if (e.data && e.data.command === 'updateUrl') {
      updateUrlBar(e.data.url, e.data.canGoBack, e.data.canGoForward);
    }
    if (e.data && e.data.command === 'navigateFrame' && frame) {
      frame.src = e.data.url;
    }
  });
  // Forward dashboard route-change and auth-state messages from the iframe to the extension.
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.command) return;
    if (e.data.command === 'dashboardRouteChanged' && e.origin) {
      vscode.postMessage({ command: 'dashboardRouteChanged', url: e.data.url });
    }
    if (e.data.command === 'setAuthState') {
      vscode.postMessage({
        command: 'setAuthState',
        signedIn: e.data.signedIn,
        tier: e.data.tier,
        token: e.data.token,
        isAdmin: e.data.isAdmin
      });
    }
    if (e.data.command === 'storeActiveLicenseToken') {
      vscode.postMessage({
        command: 'storeActiveLicenseToken',
        token: e.data.token
      });
    }
  });
  function navigateToUrl(url) {
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^\//.test(url)) url = 'http://' + url;
    if (!/^https?:\/\//i.test(url)) url = dashboardOrigin + url;
    if (isDashboardUrl(url)) {
      if (urlInput) urlInput.value = url;
      if (frame) frame.src = url;
      vscode.postMessage({ command: 'navigate', url });
    } else {
      vscode.postMessage({ command: 'openTeamDashboardInSimpleBrowser', url });
    }
  }
  if (urlInput) {
    urlInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') navigateToUrl(urlInput.value.trim()); });
    urlInput.addEventListener('change', function() { navigateToUrl(urlInput.value.trim()); });
  }
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      try { if (frame && frame.contentWindow) frame.contentWindow.history.back(); } catch (err) {}
      vscode.postMessage({ command: 'back' });
    });
  }
  if (fwdBtn) {
    fwdBtn.addEventListener('click', function() {
      try { if (frame && frame.contentWindow) frame.contentWindow.history.forward(); } catch (err) {}
      vscode.postMessage({ command: 'forward' });
    });
  }
  if (reloadBtn) {
    reloadBtn.addEventListener('click', function() {
      try { if (frame && frame.contentWindow) frame.contentWindow.location.reload(); } catch (err) {}
      vscode.postMessage({ command: 'reload' });
    });
  }
  if (frame) {
    frame.addEventListener('load', function() {
      try {
        if (frame.contentWindow && frame.contentWindow.location) {
          const current = frame.contentWindow.location.href;
          if (current && urlInput && urlInput.value !== current) urlInput.value = current;
        }
      } catch (err) {}
    });
  }
  if (openExternalBtn) {
    openExternalBtn.addEventListener('click', function() { vscode.postMessage({ command: 'openTeamDashboardInSimpleBrowser', url: urlInput.value || baseUrl }); });
  }
  if (openLink) {
    openLink.addEventListener('click', function(e) {
      e.preventDefault();
      vscode.postMessage({ command: 'openTeamDashboardInSimpleBrowser', url: baseUrl });
    });
  }
  // If the iframe hasn't loaded after 6 seconds, show the fallback.
  let iframeLoaded = false;
  function showFallback() {
    if (iframeLoaded) return;
    if (fallback) fallback.style.display = 'block';
    if (frame) frame.style.display = 'none';
  }
  if (frame) {
    frame.addEventListener('load', function() { iframeLoaded = true; });
    frame.addEventListener('error', function() { showFallback(); });
  }
  setTimeout(showFallback, 6000);
  document.addEventListener('visibilitychange', function() {
    if (frame && !frame.src) { frame.src = frame.dataset.src || baseUrl; }
  });
})();
</script>
</body>
</html>`;
}

/**
 * Open the team dashboard panel in a webview, loading the real dashboard website.
 * @param baseUrl Optional host origin (e.g. https://simplebeacon.ai). Defaults to the local data server.
 */
export async function openTeamDashboardPanel(_extUri: vscode.Uri, route = '/dashboard', panelTitle = 'Team Dashboard', baseUrl?: string) {
  let panel = _teamDashboardPanel;
  if (!panel) {
    const nonce = crypto.randomBytes(16).toString('hex');
    panel = vscode.window.createWebviewPanel(
      'simplebeaconTeamDashboard',
      panelTitle,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    const currentPanel = panel;
    registerTeamDashboardPanel(currentPanel);
    currentPanel.onDidDispose(() => {
      registerTeamDashboardPanel(undefined);
      _dashboardHistory.urls = [];
      _dashboardHistory.index = -1;
    });
    currentPanel.webview.onDidReceiveMessage(async (msg: any) => {
      if (!msg || !msg.command) return;
      if (msg.command === 'back' || msg.command === 'forward' || msg.command === 'navigate' || msg.command === 'reload') {
        let url: string | undefined;
        if (msg.command === 'back') url = goBackDashboardUrl();
        else if (msg.command === 'forward') url = goForwardDashboardUrl();
        else if (msg.command === 'navigate' && msg.url) url = pushDashboardUrl(msg.url);
        else if (msg.command === 'reload') url = getCurrentDashboardUrl();
        if (url) {
          postDashboardUrlUpdate(currentPanel, url);
          postDashboardFrameNavigate(currentPanel, url);
        }
        return;
      }
      if (msg.command === 'dashboardRouteChanged' && msg.url) {
        const url = pushDashboardUrl(msg.url);
        postDashboardUrlUpdate(currentPanel, url);
        return;
      }
      if (msg.command === 'openTeamDashboardInSimpleBrowser' && msg.url) {
        await vscode.commands.executeCommand('simpleBrowser.show', msg.url);
      }
      if (msg.command === 'setAuthState') {
        if (_onDashboardAuthState) {
          _onDashboardAuthState(!!msg.signedIn, msg.tier || '', msg.token || '', !!msg.isAdmin);
        }
      }
      if (msg.command === 'storeActiveLicenseToken' && msg.token) {
        if (_onDashboardLicenseToken) {
          _onDashboardLicenseToken(String(msg.token));
        }
      }
    });
  }
  panel.reveal(vscode.ViewColumn.Active);

  const dataServerPort = getDataServerPort();
  const isRemote = !!baseUrl && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(baseUrl);
  let normalizedRoute = route;
  if (isRemote) {
    normalizedRoute = normalizedRoute.replace(/^\/dashboard\/?$/, '/dashboard/dashboard');
    if (!normalizedRoute.startsWith('/dashboard/')) {
      normalizedRoute = '/dashboard' + (normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute);
    }
  }
  const dashboardUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute}`
    : `http://127.0.0.1:${dataServerPort}${normalizedRoute}`;
  pushDashboardUrl(normalizeDashboardUrl(dashboardUrl));
  const csp = panel.webview.cspSource;
  const nonce = crypto.randomBytes(16).toString('hex');

  panel.webview.html = buildDashboardBrowserHtml(dashboardUrl, nonce, csp, dataServerPort, panelTitle);
}
