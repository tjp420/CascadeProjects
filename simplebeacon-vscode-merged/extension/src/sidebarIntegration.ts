import * as vscode from 'vscode';

// Helper to create/update the SimpleBeacon sidebar webview and wire a secure loopback API base
export function createSidebarWebview(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewView('simplebeacon-modern', { retainContextWhenHidden: true } as any, undefined);
  // Note: the actual view HTML is provided elsewhere; this helper exposes messaging and loopback base

  function getLoopbackApiBase() {
    const cfg = vscode.workspace.getConfiguration('simplebeacon');
    return cfg.get<string>('localApiBase') || 'http://127.0.0.1:53099/api';
  }

  // Send initial config to webview
  panel.onDidChangeViewState(() => {
    const apiBase = getLoopbackApiBase();
    try {
      panel.webview.postMessage({ type: 'init', apiBase });
    } catch (e) { void e; }
  });

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg?.type === 'openUrl' && msg.url) {
      await vscode.env.openExternal(vscode.Uri.parse(msg.url));
    }
    if (msg?.type === 'setApiBase' && msg.apiBase) {
      const cfg = vscode.workspace.getConfiguration('simplebeacon');
      await cfg.update('localApiBase', msg.apiBase, vscode.ConfigurationTarget.Global);
      panel.webview.postMessage({ type: 'apiBaseUpdated', apiBase: msg.apiBase });
    }
  });

  return { panel };
}
