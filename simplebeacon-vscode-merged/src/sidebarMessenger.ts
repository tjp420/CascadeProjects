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
 * Open the team dashboard panel in a webview, loading the real dashboard website.
 */
export async function openTeamDashboardPanel(_extUri: vscode.Uri, route = '/dashboard', panelTitle = 'Team Dashboard') {
  const nonce = crypto.randomBytes(16).toString('hex');
  let panel = _teamDashboardPanel;
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'simplebeaconTeamDashboard',
      panelTitle,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    registerTeamDashboardPanel(panel);
    panel.onDidDispose(() => {
      registerTeamDashboardPanel(undefined);
    });
    panel.webview.onDidReceiveMessage(async (msg: any) => {
      if (!msg || !msg.command) return;
      if (msg.command === 'openTeamDashboardInSimpleBrowser' && msg.url) {
        await vscode.commands.executeCommand('simpleBrowser.show', msg.url);
      }
    });
  }
  panel.reveal(vscode.ViewColumn.Two);

  const dataServerPort = getDataServerPort();
  const dashboardUrl = `http://127.0.0.1:${dataServerPort}${route}?_=${Date.now()}`;
  const csp = panel.webview.cspSource;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:${dataServerPort} https://simplebeacon.ai https://*.simplebeacon.ai https://*.onrender.com ${csp}; connect-src 'none'; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${panelTitle}</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0B0F19; }
iframe { border: 0; width: 100%; height: 100%; display: block; }
.fallback { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #e2e8f0; font-family: sans-serif; padding: 20px; text-align: center; display: none; }
.fallback a { color: #60a5fa; }
</style>
</head>
<body>
<iframe id="dashFrame" src="${dashboardUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="fullscreen"></iframe>
<div id="dashFallback" class="fallback">
  <p>Dashboard did not load in the sidebar iframe.</p>
  <p><a href="#" id="openDashLink">Open Team Dashboard in Simple Browser</a></p>
</div>
<script nonce="${nonce}">
(function(){
  const vscode = acquireVsCodeApi();
  const frame = document.getElementById('dashFrame');
  const fallback = document.getElementById('dashFallback');
  const openLink = document.getElementById('openDashLink');
  if (openLink) {
    openLink.addEventListener('click', function(e) {
      e.preventDefault();
      vscode.postMessage({ command: 'openTeamDashboardInSimpleBrowser', url: '${dashboardUrl}' });
    });
  }
  // If the iframe hasn't loaded after 6 seconds, show the fallback.
  setTimeout(function() {
    if (fallback) fallback.style.display = 'block';
    if (frame) frame.style.display = 'none';
  }, 6000);
  document.addEventListener('visibilitychange', function() {
    if (frame && !frame.src) { frame.src = frame.dataset.src || '${dashboardUrl}'; }
  });
})();
</script>
</body>
</html>`;
  panel.webview.html = html;
}
