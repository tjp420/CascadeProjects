import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { buildDashboardHtml } from './welcomeDashboardHtml';

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
 * Open the team dashboard panel in a webview.
 */
export async function openTeamDashboardPanel(extUri: vscode.Uri, route = '/dashboard', panelTitle = 'Team Dashboard') {
  const nonce = crypto.randomBytes(16).toString('hex');
  let panel = _teamDashboardPanel;
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'simplebeaconTeamDashboard',
      panelTitle,
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    registerTeamDashboardPanel(panel);
    panel.onDidDispose(() => {
      registerTeamDashboardPanel(undefined);
    });
  }
  panel.reveal(vscode.ViewColumn.Two);
  const dashboardHtml = buildDashboardHtml({
    cspSource: panel.webview.cspSource,
    version: 'team',
    nonce,
    showWelcome: false
  });
  const autoTeamScript = `
<script nonce="${nonce}">
(function(){
  function activateTeam(){
    document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('active');});
    var tp=document.getElementById('teamPane');
    if(tp){tp.classList.add('active');}
    var tb=document.querySelector('.tab-bar');
    if(tb){tb.style.display='none';}
    var wa=document.querySelector('.welcome');
    if(wa){wa.style.display='none';}
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',activateTeam);
  }else{
    activateTeam();
  }
})();
</script>`;
  panel.webview.html = dashboardHtml.replace('</body>', autoTeamScript + '\n</body>');
}
