import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getDataServerPort } from './dataServer';

let _sidebarView: vscode.WebviewView | undefined;
let _teamDashboardPanel: vscode.WebviewPanel | undefined;

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

function getCurrentDashboardUrl(): string | undefined {
  return _dashboardHistory.urls[_dashboardHistory.index];
}

function pushDashboardUrl(url: string): string {
  // Remove any forward history before pushing a new URL.
  _dashboardHistory.urls = _dashboardHistory.urls.slice(0, _dashboardHistory.index + 1);
  if (_dashboardHistory.urls[_dashboardHistory.index] === url) {
    return url;
  }
  _dashboardHistory.urls.push(url);
  _dashboardHistory.index = _dashboardHistory.urls.length - 1;
  return url;
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

function buildDashboardBrowserHtml(url: string, nonce: string, csp: string, dataServerPort: number, panelTitle: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:${dataServerPort} https://simplebeacon.ai https://*.simplebeacon.ai https://*.onrender.com ${csp}; connect-src 'none'; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${panelTitle}</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0B0F19; }
body { display: flex; flex-direction: column; }
.url-bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #111827; border-bottom: 1px solid #1f2937; flex-shrink: 0; }
.url-bar input { flex: 1; background: #0B0F19; border: 1px solid #374151; border-radius: 6px; color: #e2e8f0; padding: 6px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.url-bar input:focus { outline: none; border-color: #6366f1; }
.url-bar button { background: transparent; border: 1px solid #374151; border-radius: 6px; color: #9ca3af; cursor: pointer; padding: 4px 8px; font-size: 12px; }
.url-bar button:hover:not(:disabled) { color: #e2e8f0; border-color: #6366f1; }
.url-bar button:disabled { opacity: 0.4; cursor: not-allowed; }
iframe { border: 0; width: 100%; flex: 1; display: block; }
.fallback { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #e2e8f0; font-family: sans-serif; padding: 20px; text-align: center; display: none; }
.fallback a { color: #60a5fa; }
</style>
</head>
<body>
<div class="url-bar">
  <button id="backBtn" title="Go back">←</button>
  <button id="fwdBtn" title="Go forward">→</button>
  <button id="reloadBtn" title="Reload">↻</button>
  <input id="urlInput" type="text" value="${url}" spellcheck="false" />
</div>
<iframe id="dashFrame" src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="fullscreen"></iframe>
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
  const fallback = document.getElementById('dashFallback');
  const openLink = document.getElementById('openDashLink');
  const baseUrl = '${url}';
  function updateUrlBar(url, canGoBack, canGoForward) {
    if (urlInput) urlInput.value = url;
    if (backBtn) backBtn.disabled = !canGoBack;
    if (fwdBtn) fwdBtn.disabled = !canGoForward;
  }
  // Listen for extension messages that update the URL bar and iframe src.
  window.addEventListener('message', function(e) {
    if (e.data && e.data.command === 'updateUrl') {
      updateUrlBar(e.data.url, e.data.canGoBack, e.data.canGoForward);
      if (frame && frame.src !== e.data.url) frame.src = e.data.url;
    }
  });
  // Forward dashboard route-change messages from the iframe to the extension.
  window.addEventListener('message', function(e) {
    if (e.data && e.data.command === 'dashboardRouteChanged' && e.origin) {
      vscode.postMessage({ command: 'dashboardRouteChanged', url: e.data.url });
    }
  });
  if (urlInput) {
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (url && !/^https?:\/\//i.test(url) && !/^\//.test(url)) { url = 'http://' + url; }
        vscode.postMessage({ command: 'navigate', url });
      }
    });
  }
  if (backBtn) { backBtn.addEventListener('click', function() { vscode.postMessage({ command: 'back' }); }); }
  if (fwdBtn) { fwdBtn.addEventListener('click', function() { vscode.postMessage({ command: 'forward' }); }); }
  if (reloadBtn) { reloadBtn.addEventListener('click', function() { vscode.postMessage({ command: 'reload' }); }); }
  if (openLink) {
    openLink.addEventListener('click', function(e) {
      e.preventDefault();
      vscode.postMessage({ command: 'openTeamDashboardInSimpleBrowser', url: urlInput.value || baseUrl });
    });
  }
  // If the iframe hasn't loaded after 6 seconds, show the fallback.
  setTimeout(function() {
    if (fallback) fallback.style.display = 'block';
    if (frame) frame.style.display = 'none';
  }, 6000);
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
 */
export async function openTeamDashboardPanel(_extUri: vscode.Uri, route = '/dashboard', panelTitle = 'Team Dashboard') {
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
        if (url) postDashboardUrlUpdate(currentPanel, url);
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
    });
  }
  panel.reveal(vscode.ViewColumn.Active);

  const dataServerPort = getDataServerPort();
  const dashboardUrl = `http://127.0.0.1:${dataServerPort}${route}?_=${Date.now()}`;
  pushDashboardUrl(dashboardUrl);
  const csp = panel.webview.cspSource;
  const nonce = crypto.randomBytes(16).toString('hex');

  panel.webview.html = buildDashboardBrowserHtml(dashboardUrl, nonce, csp, dataServerPort, panelTitle);
}
