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
  }
  panel.reveal(vscode.ViewColumn.Two);

  const dashboardUrl = `https://simplebeacon.ai${route}?_=${Date.now()}`;
  const csp = panel.webview.cspSource;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src https://simplebeacon.ai ${csp}; connect-src 'none'; img-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${panelTitle}</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0B0F19; }
iframe { border: 0; width: 100%; height: 100%; display: block; }
.fallback { color: #e2e8f0; font-family: sans-serif; padding: 20px; text-align: center; }
</style>
</head>
<body>
<iframe id="dashFrame" src="${dashboardUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" allow="fullscreen"></iframe>
<script nonce="${nonce}">
(function(){
  const frame = document.getElementById('dashFrame');
  if (!frame) return;
  function reloadOnVisibility() { if (!frame.src) { frame.src = frame.dataset.src || '${dashboardUrl}'; } }
  document.addEventListener('visibilitychange', reloadOnVisibility);
})();
</script>
</body>
</html>`;
  panel.webview.html = html;
}
