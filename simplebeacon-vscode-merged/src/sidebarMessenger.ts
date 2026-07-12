import * as vscode from 'vscode';
import { getDataServerPort } from './dataServer';

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

/**
 * Open the team dashboard in VS Code:'s Simple Browser.
 * @param route Dashboard route (e.g. /dashboard).
 * @param baseUrl Optional host origin. Defaults to the local data server.
 */
export function openTeamDashboardPanel(_extUri: vscode.Uri, route = '/dashboard', _panelTitle = 'Team Dashboard', baseUrl?: string) {
  const dataServerPort = getDataServerPort();
  const isRemote = !!baseUrl && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(baseUrl);
  let normalizedRoute = route;
  if (isRemote) {
    normalizedRoute = normalizedRoute.replace(/^\/dashboard\/?$/, '/dashboard/dashboard');
    if (!normalizedRoute.startsWith('/dashboard/')) {
      normalizedRoute = '/dashboard' + (normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute);
    }
  }
  let dashboardUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${normalizedRoute.startsWith('/') ? normalizedRoute : '/' + normalizedRoute}`
    : `http://127.0.0.1:${dataServerPort}${normalizedRoute}`;
  // Append a cache-buster to force the browser to fetch the latest index.html/module graph.
  const cacheBuster = `_=${Date.now()}`;
  dashboardUrl += dashboardUrl.includes('?') ? `&${cacheBuster}` : `?${cacheBuster}`;
  Promise.resolve(vscode.commands.executeCommand('simpleBrowser.show', dashboardUrl)).catch(() => {});
}
