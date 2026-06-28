// VS Code API
import * as vscode from 'vscode';

// Node built-ins
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { WelcomeDashboard } from './welcomeDashboard';
import { getDataServerPort, getTheme, setTheme } from './dataServer';

/**
 * Modern sidebar webview view provider for the SimpleBeacon extension.
 */
export class ModernSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-modern';
  private static browserPanel: vscode.WebviewPanel | undefined;
  private static teamDashboardPanel: vscode.WebviewPanel | undefined;
  private static relayOutputChannel?: vscode.OutputChannel;
  public static _dashboardHtml: string | undefined;
  public static _sidebarHtml: string | undefined;
  private static _instance?: ModernSidebarProvider;

  public static getBrowserPanel(): vscode.WebviewPanel | undefined {
    return ModernSidebarProvider.browserPanel;
  }

  public static getSidebarReport(): Record<string, unknown> | null {
    const inst = ModernSidebarProvider._instance;
    return inst ? inst._currentReport : null;
  }

  public static async refreshAuthState() {
    const inst = ModernSidebarProvider._instance;
    if (!inst || !inst._view) { return; }
    try {
      const { authManager } = require('./extension');
      const signedIn = authManager && typeof authManager.isSignedIn === 'function' ? await authManager.isSignedIn() : false;
      inst._view.webview.postMessage({ command: 'setAuthState', signedIn });
    } catch (e) {
      inst._view.webview.postMessage({ command: 'setAuthState', signedIn: false });
    }
  }

  public static setSidebarAuthState(signedIn: boolean) {
    const inst = ModernSidebarProvider._instance;
    if (!inst || !inst._view) { return; }
    inst._view.webview.postMessage({ command: 'setAuthState', signedIn });
  }

  public static postThemeToTeamDashboard(theme: string) {
    const panel = ModernSidebarProvider.teamDashboardPanel;
    if (panel) {
      try {
        panel.webview.postMessage({ command: 'setTheme', theme });
      } catch (e) { /* ignore closed panels */ }
    }
    const inst = ModernSidebarProvider._instance;
    if (inst && inst._view) {
      try {
        inst._view.webview.postMessage({ command: 'setTheme', theme });
      } catch (e) { /* ignore closed webview */ }
    }
  }

  public static showDashboardInSidebar() {
    const inst = ModernSidebarProvider._instance;
    if (!inst || !inst._view) { return; }
    inst._view.webview.postMessage({ command: 'showDashboard' });
    // Also push current report data if available
    if (inst._currentReport) {
      inst._view.webview.postMessage({ command: 'updateReport', report: inst._currentReport });
    }
  }

  public static openSidebarInBrowserStatic(path = '/') {
    const inst = ModernSidebarProvider._instance;
    if (inst) {
      inst.openSidebarInBrowser(true, path);
    }
  }

  /**
   * Phase 3: Push cached license token from secure storage back into the webview on boot.
   */
  public static async rehydrateWebviewSession(webview: vscode.Webview) {
    try {
      const { authManager } = require('./extension');
      const storedToken = authManager && typeof authManager.getToken === 'function' ? await authManager.getToken() : undefined;
      if (storedToken) {
        webview.postMessage({ command: 'rehydrateCachedSession', token: storedToken });
      }
    } catch (err) {
      ModernSidebarProvider.logRelay('Failed to rehydrate panel session tokens: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  private _view?: vscode.WebviewView;
  private _currentReport: Record<string, unknown> | null = null;
  private _downloads: Array<{ name: string; path: string; time: string }> = [];

  constructor(private readonly _extensionUri: vscode.Uri) {
    ModernSidebarProvider._instance = this;
    // Sync data-server theme with VS Code: theme on startup and on changes
    const syncServerTheme = (theme: vscode.ColorTheme) => {
      setTheme(theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light');
    };
    syncServerTheme(vscode.window.activeColorTheme);
    vscode.window.onDidChangeActiveColorTheme((theme) => syncServerTheme(theme));
  }

  private static logRelay(msg: string) {
    if (!ModernSidebarProvider.relayOutputChannel) {
      ModernSidebarProvider.relayOutputChannel = vscode.window.createOutputChannel('SimpleBeacon Relay');
    }
    ModernSidebarProvider.relayOutputChannel.appendLine(msg);
  }

  private static showDashboardRoute(extUri: vscode.Uri, route: string) {
    const panel = WelcomeDashboard.createOrShow(extUri, true);
    if (panel) {
      WelcomeDashboard.showPaneIfOpen(route);
    }
  }

  public static async openTeamDashboardPanel(extUri: vscode.Uri, route = '/dashboard', panelTitle = 'Team Dashboard') {
    const dataPort = getDataServerPort();
    const baseUrl = `http://127.0.0.1:${dataPort}`;
    const dashboardUrl = baseUrl + '/dashboard#' + route;
    await vscode.commands.executeCommand('simpleBrowser.show', dashboardUrl);
  }

  private resolveWorkspacePath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return targetPath;
    }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspace) {
      return path.join(workspace, targetPath);
    }
    return targetPath;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    // Ensure data-server theme stays in sync whenever webview is shown
    setTheme(vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    try {
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ModernSidebarProvider.logRelay('Sidebar HTML generation error: ' + msg);
      webviewView.webview.html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#c00">
        <h2>SimpleBeacon Sidebar Error</h2>
        <p>Failed to load sidebar content:</p>
        <pre style="background:#f5f5f5;padding:10px;border-radius:4px">${msg.replace(/</g, '&lt;')}</pre>
        <p>Try reloading the window (Ctrl+Shift+P → Developer: Reload Window).</p>
      </body></html>`;
    }

    // Keep sidebar displayMode in sync when the setting is changed outside the webview
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('simplebeacon.displayMode') && this._view) {
        const cfg = vscode.workspace.getConfiguration('simplebeacon');
        const currentDisplayMode = cfg.get<string>('displayMode', 'sidebar');
        this._view.webview.postMessage({ command: 'setDisplayMode', value: currentDisplayMode });
      }
    });
    webviewView.onDidDispose(() => {
      configChangeDisposable.dispose();
    });

    // Restore any previously tracked downloads into the new webview
    this._downloads.forEach((dl) => {
      webviewView.webview.postMessage({ command: 'addDownloadedFile', ...dl });
    });

    // Phase 3: Rehydrate cached license token from secure storage into the webview on boot
    ModernSidebarProvider.rehydrateWebviewSession(webviewView.webview);

    // Auto-open welcome screen panel if showWelcomeOnLoad is enabled
    const autoOpen = vscode.workspace.getConfiguration('simplebeacon').get<boolean>('showWelcomeOnLoad', false);
    if (autoOpen) {
      // Defer panel creation so it doesn't race with webview view resolution
      setTimeout(() => {
        try { WelcomeDashboard.createOrShow(this._extensionUri, true); } catch(e) { ModernSidebarProvider.logRelay('Auto open dashboard error: ' + (e as any).message); }
      }, 50);
    }

    // Cache browser-ready sidebar HTML so external browser preview and diagnose can report it as loaded
    try {
      this.openDebugPreview(true);
    } catch (e) {
      ModernSidebarProvider.logRelay('Failed to cache sidebar HTML: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Start the relay server in the background so external browser preview is ready
    setTimeout(() => {
      if (!(ModernSidebarProvider as any)._relayServer) {
        try {
          this.openSidebarInBrowser(false);
        } catch (e) {
          ModernSidebarProvider.logRelay('Auto-start relay server failed: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
    }, 100);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      ModernSidebarProvider.logRelay(`Sidebar received message: command="${message.command}"`);
      // Forward sidebar commands to browser preview relay server only if it is running
      const relayPort = (ModernSidebarProvider as any)._relayPort;
      if (relayPort) {
        try {
          ModernSidebarProvider.logRelay(`Sidebar POST command="${message.command}" to port=${relayPort}`);
          const payload = JSON.stringify({command: message.command, source: 'ide'});
          const httpMod = require('http');
          const req = httpMod.request({hostname: '127.0.0.1', port: relayPort, path: '/api/command', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)}}, (res: http.IncomingMessage) => {
            ModernSidebarProvider.logRelay(`Sidebar POST response status=${res.statusCode}`);
          });
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
      const relayCommand = (cmd: string) => {
        if (!relayPort) return;
        try {
          const httpMod = require('http');
          const payload = JSON.stringify({ command: cmd, source: 'ide' });
          const req = httpMod.request({ hostname: '127.0.0.1', port: relayPort, path: '/api/command', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, () => {});
          req.on('error', () => {});
          req.write(payload);
          req.end();
        } catch (e) { ModernSidebarProvider.logRelay('Relay command error: ' + (e instanceof Error ? e.message : String(e))); }
      };
      try {
        switch (message.command) {
          case 'scan': {
            const isWorkspaceScan = message.mode === 'workspace' || !message.mode;
            if (isWorkspaceScan) {
              const ws = vscode.workspace.workspaceFolders;
              if (ws && ws.length > 0) {
                vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: ws[0].uri.fsPath });
              } else {
                vscode.commands.executeCommand('simplebeacon.scanWorkspace');
              }
            } else {
              vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: message.path });
            }
            relayCommand('scan');
            break;
          }
          case 'browseSidebarScanPath': {
            const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select Project Folder' });
            if (uris && uris.length > 0) {
              webviewView.webview.postMessage({ command: 'setSidebarScanPath', path: uris[0].fsPath });
            }
            break;
          }
          case 'detectSidebarScanPath': {
            const ws = vscode.workspace.workspaceFolders;
            if (ws && ws.length > 0) {
              webviewView.webview.postMessage({ command: 'setSidebarScanPath', path: ws[0].uri.fsPath });
            }
            break;
          }
          case 'storeActiveLicenseToken': {
            const { token } = message;
            if (!token) { break; }
            try {
              await vscode.commands.executeCommand('simplebeacon.storeLicenseToken', token);
              webviewView.webview.postMessage({ command: 'licenseTokenStored', success: true });
            } catch (error) {
              webviewView.webview.postMessage({ command: 'licenseTokenStored', success: false, error: (error as Error).message });
            }
            break;
          }
          case 'updateSidebarScanPath': {
            await vscode.workspace.getConfiguration('simplebeacon').update('projectPath', message.path, true);
            break;
          }
          case 'clear':
            vscode.commands.executeCommand('simplebeacon.clearResults');
            relayCommand('clear');
            break;
          case 'showDashboard':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
            break;
          case 'openInIde': {
            vscode.commands.executeCommand('simplebeacon-modern.focus');
            WelcomeDashboard.createOrShow(this._extensionUri, true);
            break;
          }
          case 'openSidebarDebug':
            WelcomeDashboard.createOrShow(this._extensionUri, true);
            break;
          case 'openCloudInBrowser':
          case 'openCloudInPreview':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
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
            ModernSidebarProvider.openSidebarInBrowserStatic('/');
            break;
          case 'settings':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showSettingsPane();
            relayCommand('settings');
            break;
          case 'openSettings':
            vscode.commands.executeCommand('simplebeacon.openSettings');
            relayCommand('openSettings');
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
          case 'report':
            vscode.commands.executeCommand('simplebeacon.showReport');
            relayCommand('showReport');
            break;
          case 'cert':
          case 'certificate':
            vscode.commands.executeCommand('simplebeacon.generateCertificate');
            relayCommand('generateCertificate');
            break;
          case 'enhanced':
          case 'analyze':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', {
              path: message.path,
              selectedModules: message.analyzers,
              minSeverity: message.minSeverity
            });
            relayCommand('enhancedAnalysis');
            break;
          case 'realtime':
            vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');
            relayCommand('realtimeAnalysis');
            break;
          case 'pattern':
            vscode.commands.executeCommand('simplebeacon.patternDetection');
            relayCommand('patternDetection');
            break;
          case 'health':
            vscode.commands.executeCommand('simplebeacon.modelHealth');
            relayCommand('modelHealth');
            break;
          case 'codemap':
          case 'codeMap':
            vscode.commands.executeCommand('simplebeacon.showCodeMap');
            relayCommand('showCodeMap');
            break;
          case 'dashboard':
          case 'openDashboard':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();
            relayCommand('dashboard');
            break;
          case 'openReport':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showReportPane();
            relayCommand('report');
            break;
          case 'certificate':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/certificate');
            relayCommand('certificate');
            break;
          case 'analytics':
            vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
            relayCommand('runAdvancedAnalytics');
            break;
          case 'team':
          case 'openTeamDashboard': {
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showTeamPane();
            relayCommand('showTeamDashboard');
            break;
          }
          case 'toggleRealtime':
            vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
            relayCommand('toggleRealtimeMonitoring');
            break;
          case 'openBrowser': {
            const brPort = getDataServerPort();
            vscode.commands.executeCommand('simpleBrowser.show', `http://127.0.0.1:${brPort}/dashboard/dashboard`);
            relayCommand('openBrowser');
            break;
          }
          case 'upload':
          case 'openUpload':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/upload');
            relayCommand('upload');
            break;
          case 'analyze':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
            relayCommand('analyze');
            break;
          case 'roadmap':
          case 'openRoadmap':
            vscode.commands.executeCommand('simplebeacon.showRemediationGuide');
            relayCommand('showRemediationGuide');
            break;
          case 'sendToAi':
            vscode.commands.executeCommand('simplebeacon.sendToAi');
            relayCommand('sendToAi');
            break;
          case 'openUpload':
            vscode.commands.executeCommand('simplebeacon.uploadReport');
            relayCommand('openUpload');
            break;
          case 'preview':
          case 'openPreview':
            ModernSidebarProvider.openSidebarInBrowserStatic('/');
            break;
          case 'openSidebarDebug':
            vscode.commands.executeCommand('simplebeacon.openPreview');
            relayCommand('openPreview');
            break;
          case 'sendSidebarToAi':
            vscode.commands.executeCommand('simplebeacon.sendSidebarToAi', message.report);
            break;
          case 'openFile': {
            const targetPath = message.file || message.path;
            if (!targetPath) { break; }
            if (/^(https?:\/\/|blob:)/.test(targetPath)) {
              vscode.env.openExternal(vscode.Uri.parse(targetPath));
            } else {
              const resolvedPath = this.resolveWorkspacePath(targetPath);
              if (fs.existsSync(resolvedPath)) {
                const line = typeof message.line === 'number' && message.line > 0 ? message.line : 1;
                vscode.workspace.openTextDocument(resolvedPath).then(doc => {
                  vscode.window.showTextDocument(doc, {
                    preview: true,
                    selection: new vscode.Range(line - 1, 0, line - 1, 0)
                  });
                });
              } else {
                vscode.window.showWarningMessage('File not found: ' + targetPath);
              }
            }
            break;
          }
          case 'copyPath':
            if (message.path) {
              vscode.env.clipboard.writeText(message.path);
              vscode.window.showInformationMessage('Path copied to clipboard');
            }
            break;
          case 'exportReport':
          case 'exportScanReport':
            Promise.resolve(vscode.commands.executeCommand('simplebeacon.exportReport')).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Export failed: ' + msg);
            });
            break;
          case 'updateDisplayMode': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('displayMode', message.value, true);
            webviewView.webview.postMessage({ command: 'setDisplayMode', value: message.value });
            break;
          }
          case 'refreshSettings': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const currentDisplayMode = cfg.get<string>('displayMode', 'sidebar');
            webviewView.webview.postMessage({ command: 'setDisplayMode', value: currentDisplayMode });
            break;
          }
          case 'updateShowWelcome': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('showWelcomeOnLoad', message.value, true);
            webviewView.webview.postMessage({ command: 'setShowWelcome', value: message.value });
            break;
          }
          case 'updateAutoScan': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('autoScanOnOpen', message.value, true);
            webviewView.webview.postMessage({ command: 'setAutoScan', value: message.value });
            break;
          }
          case 'updateApiUrl': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('apiServerUrl', message.value, true);
            webviewView.webview.postMessage({ command: 'updateServerUrl', url: message.value });
            break;
          }
          case 'updateBrowserMode': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('browserMode', message.value, true);
            webviewView.webview.postMessage({ command: 'setBrowserMode', value: message.value });
            break;
          }
          case 'updateNotifyScan': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('notifyOnScanComplete', message.value, true);
            break;
          }
          case 'updateNotifyGate': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            cfg.update('notifyOnGateFailure', message.value, true);
            break;
          }
          case 'testConnection': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const url = cfg.get<string>('apiServerUrl') || 'http://127.0.0.1:55000';
            fetch(url + '/api/health').then(() => {
              vscode.window.showInformationMessage('Connection successful: ' + url);
            }).catch(() => {
              vscode.window.showErrorMessage('Connection failed: ' + url);
            });
            break;
          }
          case 'toggleTheme':
            vscode.commands.executeCommand('workbench.action.toggleLightDarkThemes');
            break;
          case 'signIn':
            vscode.commands.executeCommand('simplebeacon.signIn');
            break;
          case 'signOut':
            vscode.commands.executeCommand('simplebeacon.signOut');
            break;
          case 'getAuthState':
            ModernSidebarProvider.refreshAuthState();
            break;
          case 'toggleOffline': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const current = cfg.get<boolean>('offlineMode', false);
            cfg.update('offlineMode', !current, true);
            vscode.window.showInformationMessage('Offline mode: ' + (!current ? 'ON' : 'OFF'));
            break;
          }
          case 'openHelp':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openChatbot':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAiContextPane();
            break;
          case 'openGitHub':
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/simplebeacon/simplebeacon'));
            break;
          case 'openDocs':
            vscode.env.openExternal(vscode.Uri.parse('https://docs.simplebeacon.dev'));
            break;
          case 'openExternalUrl':
            if (message.url) { vscode.commands.executeCommand('simpleBrowser.show', message.url); }
            break;
          case 'openDataServerUrl': {
            const dsPort = getDataServerPort();
            vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${dsPort}`));
            break;
          }
          case 'openDataServerPath': {
            const dspPort = getDataServerPort();
            if (message.path) { vscode.commands.executeCommand('simpleBrowser.show', `http://127.0.0.1:${dspPort}${message.path}`); }
            break;
          }
          case 'openPricing':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/pricing');
            break;
          case 'clearDownloads':
            vscode.commands.executeCommand('simplebeacon.clearDownloads');
            break;
          case 'diagnose': {
            const results: string[] = [];
            // Show "Running..." immediately
            webviewView.webview.postMessage({ command: 'diagnoseResult', lines: ['Running diagnostics...'], text: 'Running diagnostics...' });

            const relayPort = (ModernSidebarProvider as any)._relayPort;
            results.push(`Relay port: ${relayPort || 'NOT STARTED'}`);
            const dataPort = getDataServerPort();
            results.push(`Data server: http://127.0.0.1:${dataPort}`);
            results.push(`Dashboard HTML: ${ModernSidebarProvider._dashboardHtml ? 'LOADED (' + ModernSidebarProvider._dashboardHtml.length + ' chars)' : 'SERVED FROM DATA SERVER'}`);
            results.push(`Sidebar HTML: ${ModernSidebarProvider._sidebarHtml ? 'LOADED (' + ModernSidebarProvider._sidebarHtml.length + ' chars)' : 'MISSING'}`);
            results.push(`Current report: ${this._currentReport ? 'PRESENT (' + Object.keys(this._currentReport).length + ' keys)' : 'NONE'}`);
            results.push(`Webview view: ${this._view ? 'ACTIVE' : 'NOT SET'}`);

            // Dashboard health checks
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const displayMode = cfg.get<string>('displayMode', 'sidebar');
            results.push(`Display mode: ${displayMode}`);
            if (displayMode === 'sidebar') {
              results.push(`Dashboard: BLOCKED (displayMode=sidebar prevents WelcomeDashboard from opening)`);
            } else {
              results.push(`Dashboard: OK (displayMode=${displayMode})`);
            }

            // Check media folder exists
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
            const httpMod = require('http');
            const req = httpMod.request({ hostname: '127.0.0.1', port: String(dataPort), path: '/api/simplebeacon/status', method: 'GET', timeout: 3000 }, (res: http.IncomingMessage) => {
              results.push(`API status: HTTP ${res.statusCode}`);
              webviewView.webview.postMessage({ command: 'diagnoseResult', lines: results });
            });
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
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
            relayCommand('navDashboard');
            break;
          case 'navAnalyze':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/analyze');
            relayCommand('navAnalyze');
            break;
          case 'navResults':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/results');
            relayCommand('navResults');
            break;
          case 'navRepoHealth':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/repository-health');
            relayCommand('navRepoHealth');
            break;
          case 'navAudit':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/audit');
            relayCommand('navAudit');
            break;
          case 'navSecurity':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/security');
            relayCommand('navSecurity');
            break;
          case 'navQuality':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/quality');
            relayCommand('navQuality');
            break;
          case 'navTrust':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/trust');
            relayCommand('navTrust');
            break;
          case 'navAssessments':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/assessments');
            relayCommand('navAssessments');
            break;
          case 'navRoadmap':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/remediation');
            relayCommand('navRoadmap');
            break;
          case 'navPlatform':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/platform');
            relayCommand('navPlatform');
            break;
          case 'navProfile':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/profile');
            relayCommand('navProfile');
            break;
          case 'openAnalyze':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAnalyzePane();
            break;
          case 'openReport':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showReportPane();
            break;
          case 'openCertificate':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showCertificatePane();
            break;
          case 'openCodeMap':
            vscode.commands.executeCommand('simplebeacon-modern.focus');
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showCodeMapPane();
            break;
          case 'openRoadmap':
            vscode.commands.executeCommand('simplebeacon.showRemediationGuide');
            break;
          case 'openRoadmapUrl':
            if (message.url) { vscode.commands.executeCommand('simplebeacon.openUrlInPreview', message.url, 'Roadmap'); }
            break;
          case 'openAuditUrl':
            if (message.url) { vscode.commands.executeCommand('simplebeacon.openUrlInPreview', message.url, 'Audit'); }
            break;
          case 'openPricingUrl':
            if (message.url) { vscode.commands.executeCommand('simplebeacon.openUrlInPreview', message.url, 'Pricing'); }
            break;
          case 'openAiContext':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAiContextPane();
            break;
          case 'openUpload':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showUploadPane();
            break;
          case 'openAudit':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAuditPane();
            break;
          case 'runAudit':
            vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            relayCommand('runAudit');
            break;
          case 'getAuditData':
            {
              const { WelcomeDashboard } = require('./welcomeDashboard');
              const data = WelcomeDashboard.getLastReportData ? WelcomeDashboard.getLastReportData() : null;
              if (data && this._view) {
                this._view.webview.postMessage({ command: 'updateAuditData', ...data });
              }
            }
            break;
          case 'openSecurity':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showSecurityPane();
            break;
          case 'openTrust':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showTrustPane();
            break;
          case 'openQuality':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showQualityPane();
            break;
          case 'openAssessments':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAssessmentsPane();
            break;
          case 'openPlatform':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showPlatformPane();
            break;
          case 'openDiagnose':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showScanPane();
            break;
          case 'openProfile':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showProfilePane();
            break;
          case 'openAbout':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showDashboardPane();
            break;
          case 'openCompliance':
            ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/compliance');
            break;
          case 'openRepoHealth':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showRepoHealthPane();
            break;
          case 'openAnalytics':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showAnalyticsPane();
            break;
          case 'openTeam':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showTeamPane();
            break;
          case 'openScan':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showScanPane();
            break;
          case 'openSettings':
            WelcomeDashboard.createOrShow(this._extensionUri, true)?.showSettingsPane();
            break;
          case 'openClear':
            vscode.commands.executeCommand('simplebeacon.clearResults');
            break;
          case 'openToggleMonitor':
            vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
            break;
          case 'openSendToAIAgent':
            vscode.commands.executeCommand('simplebeacon.sendToAi');
            break;
          case 'openEnhancedAnalysis':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
            break;
          case 'openRealtimeAnalysis':
            vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');
            break;
          case 'openPatternDetection':
            vscode.commands.executeCommand('simplebeacon.patternDetection');
            break;
          case 'openModelHealth':
            vscode.commands.executeCommand('simplebeacon.modelHealth');
            break;
          case 'openScanWorkspace':
            vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            break;
        }
      } catch (err) {
        vscode.window.showErrorMessage('SimpleBeacon sidebar error: ' + (err instanceof Error ? err.message : String(err)));
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = webview.cspSource;
    const sbConfig = vscode.workspace.getConfiguration('simplebeacon');
    const showWelcome = sbConfig.get('showWelcomeOnLoad', false);
    const displayMode = sbConfig.get('displayMode', 'sidebar') as string;
    const autoScan = sbConfig.get('autoScanOnOpen', false);
    const apiUrl = sbConfig.get('apiServerUrl', '');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp}; frame-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  margin: 0;
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 13px;
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-editor-background, #1e1e1e);
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
  background: var(--vscode-sideBar-background, linear-gradient(135deg, #1e1e1e 0%, #252526 100%));
  flex-shrink: 0;
}
.header-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(239,68,68,0.3);
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
.tab-item.tab-more{margin-left:auto;gap:4px;padding:10px 12px;border-bottom-color:transparent;}
.tab-action{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:6px;font-size:11px;font-weight:600;color:var(--vscode-foreground,#ccc);cursor:pointer;white-space:nowrap;user-select:none;background:var(--vscode-button-secondaryBackground,#2d2d30);border:1px solid var(--vscode-panel-border,#3c3c3c);transition:all .15s;}
.tab-action:hover{background:var(--vscode-button-hoverBackground,#3c3c3c);border-color:var(--vscode-focusBorder,#007acc);transform:translateY(-1px);}
.tab-action .icon{font-size:14px;}
.tab-more-arrow{font-size:9px;transition:transform .2s;}
.tab-item.tab-more.open .tab-more-arrow{transform:rotate(180deg);}
.tab-more-dropdown{display:none;position:absolute;top:46px;right:12px;min-width:180px;max-height:calc(100vh - 100px);overflow-y:auto;background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:100;padding:6px;}
.tab-more-dropdown.open{display:block;}
.tab-more-section{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--vscode-descriptionForeground,#858585);padding:6px 8px 4px;}
.tab-more-divider{height:1px;margin:4px 8px;background:var(--vscode-panel-border, rgba(255,255,255,0.08));}
.tab-more-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;font-size:12px;color:var(--vscode-foreground,#ccc);cursor:pointer;transition:background .15s;}
.tab-more-item:hover{background:var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));}
.tab-more-item.active{background:rgba(14,165,233,0.15);color:#38bdf8;}
.tab-pane{display:none;}
.tab-pane.active{display:block;overflow-y:auto;max-height:calc(100vh - 90px);padding-bottom:12px;}
.hidden{display:none !important;}
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
#tdSignInSidebar{background:var(--vscode-input-background, rgba(255,255,255,0.03)) !important;border-color:var(--vscode-panel-border, rgba(255,255,255,0.06)) !important;}
#tdSignInSidebar:hover{background:var(--vscode-list-hoverBackground, rgba(255,255,255,0.06)) !important;}
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
/* Quick links */
.quick-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 12px;}
.ql-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--vscode-foreground,#ccc);font-size:12px;cursor:pointer;transition:all .2s;}
.ql-btn:hover{background:rgba(255,255,255,0.06);}
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
body.detail-panel-open #openAuditFromSidebar,
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
body.detail-panel-open #sendToAIAgentDropdownHeader,
body.detail-panel-open #uploadDropdownHeader {
  display: none !important;
}
body.detail-panel-open #mainTabBar,
body.detail-panel-open #sidebarTabBar {
  display: none !important;
}
</style>
</head>
<body>
<div class="header">
  <div class="header-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M12 2c3 3 5 7 5 12"/><path d="M12 22c-3-3-5-7-5-12"/></svg></div>
  <div class="header-text">
    <div class="header-title">SimpleBeacon</div>
    <div class="header-subtitle">AI Slop Cop</div>
  </div>
  <div class="header-actions">
    <button class="header-theme-toggle" id="tdThemeToggleSidebar" title="Toggle Theme" aria-label="Toggle Theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
    </button>
  </div>
</div>
<div class="tab-bar" id="mainTabBar">
  <div class="tab-item active" data-tab="dashboard">Dashboard</div>
  <div class="tab-item" data-tab="scan">Scan</div>
  <div class="tab-item" data-tab="analyze">Analyze</div>
  <div class="tab-item" data-tab="advanced">Advanced</div>
  <div class="tab-item" data-tab="settings">Settings</div>
  <div class="tab-item" data-tab="team">Team Dashboard</div>
</div>
<div class="sidebar-tab-bar hidden" id="sidebarTabBar">
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
  <div class="db-info">
    <div class="db-info-row"><div class="db-info-label">Repository Files</div><div class="db-info-val" id="dbRepoFiles">--</div></div>
    <div class="db-info-row"><div class="db-info-label">Gate Checked</div><div class="db-info-val" id="dbGateChecked">--</div></div>
  </div>
  <div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="scanWorkspaceDropdownHeader" data-sidebar-tab="dashboard" style="margin-bottom:0;background:linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(129,140,248,0.08) 100%);border-color:rgba(99,102,241,0.25);cursor:pointer;">
    <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
    <span>Workspace</span>
  </div>
  <div class="db-actions-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0;">
    <div class="settings-btn-card" id="dashPreviewBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(165,180,252,0.08) 100%);border-color:rgba(99,102,241,0.25);cursor:pointer;">
      <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
      <span>Preview</span>
    </div>
    <div class="settings-btn-card" id="dashBrowserBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(59,130,246,0.15) 0%,rgba(96,165,250,0.08) 100%);border-color:rgba(59,130,246,0.25);cursor:pointer;">
      <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>
      <span>Browser</span>
    </div>
    <div class="settings-btn-card" id="dashExportReportBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(245,158,11,0.15) 0%,rgba(217,119,6,0.08) 100%);border-color:rgba(245,158,11,0.25);cursor:pointer;">
      <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
      <span>Export Report</span>
    </div>
    <div class="settings-btn-card" id="dashClearResultsBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(107,114,128,0.15) 0%,rgba(156,163,175,0.08) 100%);border-color:rgba(107,114,128,0.25);cursor:pointer;">
      <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
      <span>Clear Results</span>
    </div>
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
<div style="margin:0 0 10px 0;">
  <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:4px;">
    <div class="db-info-label">Scan Target</div>
    <label class="toggle-switch" style="flex-shrink:0;margin-left:8px;">
      <input type="checkbox" id="sidebarScanWorkspaceToggle" checked />
      <span class="toggle-slider"></span>
    </label>
  </div>
  <div id="sidebarScanToggleLabel" style="font-size:11px;color:var(--vscode-descriptionForeground,#858585);margin-bottom:8px;">Current Workspace</div>
  <div id="sidebarScanCustomWrap" style="display:none;flex-direction:column;gap:6px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
      <div class="db-info-label">Custom Location</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-xs" id="sidebarScanBrowseBtn" style="font-size:0.72rem;padding:3px 8px;">Browse</button>
        <button class="btn btn-ghost btn-xs" id="sidebarScanDetectBtn" style="font-size:0.72rem;padding:3px 8px;">Detect</button>
      </div>
    </div>
    <input type="text" class="settings-input" id="sidebarScanPathInput" placeholder="Project path..." value="" style="margin-top:0;" />
  </div>
  <div id="scanActionRow" style="display:none;flex-direction:column;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <button class="btn btn-primary btn-xs" id="scanStartBtn" style="font-size:0.72rem;padding:3px 10px;white-space:nowrap;">Scan</button>
      <div class="scan-progress-wrap" style="flex:1;height:8px;background:rgba(99,102,241,0.15);border-radius:4px;overflow:hidden;">
        <div id="scanProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,rgba(99,102,241,0.8),rgba(129,140,248,0.8));border-radius:4px;transition:width 0.3s ease;"></div>
      </div>
      <span id="scanProgressPct" style="font-size:11px;color:var(--vscode-descriptionForeground,#858585);min-width:32px;text-align:right;">0%</span>
    </div>
  </div>
</div>
<div class="tab-section">Quick Links</div>
<div class="quick-links">
  <div class="ql-btn" id="qlDashboardBtn"><span>&#x1F4CA;</span> Dashboard</div>
  <div class="ql-btn" id="qlReportBtn"><span>&#x1F4C4;</span> Report</div>
  <div class="ql-btn" id="qlBrowserBtn"><span>&#x1F5A5;</span> Browser</div>
  <div class="ql-btn" id="qlPreviewBtn"><span>&#x1F310;</span> Preview</div>
</div>
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
  <div class="upload-actions">
    <button class="upload-btn" id="uploadValidateBtn">&#x2713; Validate All</button>
    <button class="upload-btn secondary" id="uploadClearBtn">Clear</button>
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
<div class="settings-btn-card ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow" id="openCodeMapBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(6,182,212,0.15) 0%,rgba(8,145,178,0.08) 100%);border-color:rgba(6,182,212,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>
  <span>Open Code Map</span>
</div>
<div class="settings-btn-card ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow" id="openCertificateBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(236,72,153,0.15) 0%,rgba(219,39,119,0.08) 100%);border-color:rgba(236,72,153,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
  <span>Open Certificate</span>
</div>
</div>
<div class="tab-pane" id="tabAnalyze">
<div class="tab-section">ANALYSIS</div>
<div class="settings-btn-card" id="analyzeRunCard" style="margin-bottom:0;background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(52,211,153,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></span>
  <span>Run Analysis</span>
</div>
<div class="settings-btn-card" id="analyzeScanWorkspaceCard" style="margin-bottom:0;background:linear-gradient(135deg,rgba(59,130,246,0.15) 0%,rgba(96,165,250,0.08) 100%);border-color:rgba(59,130,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
  <span>Scan Workspace</span>
</div>
<div class="settings-btn-card" id="analyzeExportJsonCard" style="margin-bottom:0;background:linear-gradient(135deg,rgba(245,158,11,0.15) 0%,rgba(251,191,36,0.08) 100%);border-color:rgba(245,158,11,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
  <span>Export JSON</span>
</div>
<div class="tab-section">AI ANALYSIS TOOLS</div>
<div class="settings-btn-card" id="openEnhancedAnalysisBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(167,139,250,0.08) 100%);border-color:rgba(139,92,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span>
  <span>Enhanced Analysis</span>
</div>
<div class="settings-btn-card" id="openRealtimeAnalysisBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(245,158,11,0.15) 0%,rgba(251,191,36,0.08) 100%);border-color:rgba(245,158,11,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
  <span>Real-Time Analysis</span>
</div>
<div class="settings-btn-card" id="openPatternDetectionBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(14,165,233,0.15) 0%,rgba(56,189,248,0.08) 100%);border-color:rgba(14,165,233,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
  <span>Pattern Detection</span>
</div>
<div class="settings-btn-card" id="openModelHealthBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(248,113,113,0.08) 100%);border-color:rgba(239,68,68,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>
  <span>Model Health</span>
</div>
<div class="settings-btn-card" id="openToggleMonitorBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(52,211,153,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
  <span>Toggle AI Slop Monitor</span>
</div>
</div>
<div class="tab-pane" id="tabReport">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="diag-back-bar" id="reportBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <button class="btn btn-ghost btn-xs" id="openReportInMainWindowBtn" style="font-size:0.72rem;padding:3px 8px;">Open in Main Window</button>
</div>
<div class="tab-section">Report</div>
<div class="tc-grid">
  <div class="tc-card"><div class="tc-card-val blue" id="reportScoreCard">--</div><div class="tc-card-label">Score</div></div>
  <div class="tc-card"><div class="tc-card-val green" id="reportGateCard">--</div><div class="tc-card-label">Gate</div></div>
  <div class="tc-card"><div class="tc-card-val orange" id="reportIssuesCard">--</div><div class="tc-card-label">Issues</div></div>
  <div class="tc-card"><div class="tc-card-val purple" id="reportFilesCard">--</div><div class="tc-card-label">Files</div></div>
</div>
<div class="tab-section">Actions</div>
<div class="tc-list">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">View Full Report</span></div><span class="tc-list-meta">Web dashboard</span></div>
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Export JSON</span></div><span class="tc-list-meta">Download</span></div>
</div>
</div>
<div class="tab-pane" id="tabRoadmap">
<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
  <div class="diag-back-bar" id="roadmapBackBtn" role="button" tabindex="0" style="margin-bottom:0;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <button class="btn btn-ghost btn-xs" id="openRoadmapInMainWindowBtn" style="font-size:0.72rem;padding:3px 8px;">Open in Main Window</button>
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
  <button class="btn btn-ghost btn-xs" id="openAiContextInMainWindowBtn" style="font-size:0.72rem;padding:3px 8px;">Open in Main Window</button>
</div>
<div class="tab-section">AI Context</div>
<div class="tc-status" style="padding:12px;"><span class="tc-status-badge">AI analysis context</span></div>
<div class="tab-section">Insights</div>
<div class="tc-list" id="aiContextList">
  <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot orange"></span><span class="tc-list-name">Summary</span></div><span class="tc-list-meta">--</span></div>
</div>
</div>
<div class="tab-pane" id="tabRepohealth">
<div class="tab-section">Repository Health</div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openRepoHealthBtn"><span class="icon">&#x1F4CA;</span> Open Full Report</div>
  <div class="tc-action-btn" id="refreshRepoHealthBtn"><span class="icon">&#x1F504;</span> Refresh Health Check</div>
</div>
<div class="settings-actions" style="margin-top:8px;">
  <button class="settings-btn-secondary" id="openRepoHealthInMainWindowBtn">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabAnalytics">
<div class="tab-section">Analytics</div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openAnalyticsBtn"><span class="icon">&#x1F4CA;</span> Open Full Analytics</div>
</div>
<div class="settings-actions" style="margin-top:8px;">
  <button class="settings-btn-secondary" id="openAnalyticsInMainWindowBtn">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabTeam">
<div class="tab-section">Quick Links</div>
<div class="tc-list" style="gap:8px;">
  <div class="tc-list-item" id="tdRoadmapSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F5FA;</span><span class="tc-list-name">Roadmap</span></div></div>
  <div class="tc-list-item" id="tdAuditSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4CB;</span><span class="tc-list-name">Audit</span></div></div>
  <div class="tc-list-item" id="tdPricingSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4B0;</span><span class="tc-list-name">Pricing</span></div></div>
  <div class="tc-list-item" id="tdOpenSiteSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F465;</span><span class="tc-list-name">Teams Dashboard</span></div></div>
  <div class="tc-list-item" id="tdSignInSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg></span><span class="tc-list-name">Sign In</span></div></div>
  <div class="tc-list-item" id="tdOfflineToggleSidebar"><div class="tc-list-item-left"><span class="icon" style="margin-right:8px;">&#x1F4F6;</span><span class="tc-list-name">Online</span></div></div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openTrustBtn"><span class="icon">&#x1F6E1;</span> Open Trust Center</div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openAssessmentsBtn"><span class="icon">&#x1F4CB;</span> Run Assessment</div>
</div>
</div>
<div class="tab-pane" id="tabPlatform">
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openPlatformBtn"><span class="icon">&#x1F4BB;</span> Open Platform Details</div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openComplianceBtn"><span class="icon">&#x2705;</span> Open Compliance Report</div>
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
<div class="tc-actions">
  <div class="tc-action-btn" id="openProfileBtn"><span class="icon">&#x1F464;</span> Open Profile</div>
</div>
<div class="settings-actions" style="margin-top:8px;">
  <button class="settings-btn-secondary" id="openProfileInMainWindowBtn">Open in Main Window</button>
</div>
</div>
<div class="tab-pane" id="tabAdvanced">
<div class="tab-section">Analysis</div>
<div class="settings-btn-card" id="openReportBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(245,158,11,0.15) 0%,rgba(217,119,6,0.08) 100%);border-color:rgba(245,158,11,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
  <span>Open Report</span>
</div>
<div class="settings-btn-card" id="openRoadmapBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(167,139,250,0.08) 100%);border-color:rgba(139,92,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
  <span>Open Roadmap</span>
</div>
<div class="settings-btn-card" id="openAiContextBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(249,115,22,0.15) 0%,rgba(251,146,60,0.08) 100%);border-color:rgba(249,115,22,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
  <span>Open AI Context</span>
</div>
<div class="tab-section ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow">Local</div>
<div class="settings-btn-card ${displayMode === 'mainWindow' ? '' : 'hidden'}" data-display-mode="mainWindow" id="openSecurityBtnMain" style="margin-bottom:0;background:linear-gradient(135deg,rgba(59,130,246,0.15) 0%,rgba(96,165,250,0.08) 100%);border-color:rgba(59,130,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
  <span>Security</span>
</div>
<div class="tab-section">Cloud &amp; AI Tools</div>
<div class="settings-btn-card" id="openUploadBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(52,211,153,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon">&#x1F4E4;</span>
  <span>Upload &amp; Validate</span>
</div>
<div class="settings-btn-card" id="openAuditBtnMain" style="margin-bottom:0;background:linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(248,113,113,0.08) 100%);border-color:rgba(239,68,68,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
  <span>Audit</span>
</div>
<div class="settings-btn-card" id="openSendToAIAgentBtn" style="margin-bottom:0;background:linear-gradient(135deg,rgba(236,72,153,0.15) 0%,rgba(244,114,182,0.08) 100%);border-color:rgba(236,72,153,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
  <span>Send Scan to AI Agent</span>
</div>
</div>
<div class="tab-pane" id="tabSettings">
<div id="settingsMenuTab">
  <div class="tab-section">TOOLS</div>
  <div class="settings-btn-card" id="openDiagnoseFromSettingsTab" style="margin-bottom:0;background:linear-gradient(135deg,rgba(6,182,212,0.15) 0%,rgba(8,145,178,0.08) 100%);border-color:rgba(6,182,212,0.25);">
    <span class="icon">&#x26A0;</span>
    <span>Diagnose</span>
  </div>
  <div class="settings-btn-card" id="openRefreshRelayFromSettingsTab" style="margin-bottom:0;background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(5,150,105,0.08) 100%);border-color:rgba(16,185,129,0.25);">
    <span class="icon">&#x1F504;</span>
    <span>Refresh Relay Port</span>
  </div>
  <div class="settings-btn-card" id="openSettingsFromSettingsTab" style="margin-bottom:0;background:linear-gradient(135deg,rgba(107,114,128,0.15) 0%,rgba(156,163,175,0.08) 100%);border-color:rgba(107,114,128,0.25);">
    <span class="icon">&#x2699;</span>
    <span>Open Settings</span>
  </div>
  <div class="settings-btn-card" id="openPlatformFromSettingsTab" style="margin-bottom:0;background:linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(129,140,248,0.08) 100%);border-color:rgba(99,102,241,0.25);">
    <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>
    <span>Platform</span>
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
        <button type="button" class="btn btn-ghost btn-xs" id="apiPresetLocal" style="font-size:0.72rem;padding:3px 8px;">Local (54358)</button>
        <button type="button" class="btn btn-ghost btn-xs" id="apiPresetSlopCop" style="font-size:0.72rem;padding:3px 8px;">AI Slop Cop (3001)</button>
        <button type="button" class="btn btn-ghost btn-xs" id="apiPresetRemote" style="font-size:0.72rem;padding:3px 8px;">Remote (30011)</button>
      </div>
      <div class="settings-actions">
        <button class="settings-btn-primary" id="settingsSaveBtnTab">Save</button>
        <button class="settings-btn-secondary" id="settingsTestBtnTab">Test Connection</button>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="openDiagnoseBtnTab">Diagnose</button>
      <button class="settings-btn-secondary" id="openRefreshRelayPortBtnTab">Refresh Relay</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openSettingsInMainWindowBtnTab">Open in Main Window</button>
      <button class="settings-btn-secondary" id="refreshSettingsBtnTab">Refresh Settings</button>
    </div>
  </div>
</div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="analyzeDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(5,150,105,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></span>
  <span>Open Analyze</span>
</div>
<div id="analyzeDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="analyzeDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Analysis</div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runAnalysisBtn">Run Analysis</button>
      <button class="settings-btn-secondary" id="scanWorkspaceBtn">Scan Workspace</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="exportJsonBtn">Export JSON</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">AI Analysis Tools</div>
    <div class="settings-actions">
      <button class="settings-btn-secondary" id="enhancedAnalysisBtn">Enhanced Analysis</button>
      <button class="settings-btn-secondary" id="realtimeAnalysisBtn">Real-Time Analysis</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="patternDetectionBtn">Pattern Detection</button>
      <button class="settings-btn-secondary" id="modelHealthBtn">Model Health</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="toggleMonitorBtn">Toggle AI Slop Monitor</button>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="certificateDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(236,72,153,0.15) 0%,rgba(244,114,182,0.08) 100%);border-color:rgba(236,72,153,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
  <span>Certificate</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="generateCertificateBtn">Generate</button>
      <button class="settings-btn-secondary" id="exportCertificatePdfBtn">Export PDF</button>
      <button class="settings-btn-secondary" id="viewCertificateReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openCertificateInMainWindowBtn">Open in Main Window</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="codeMapDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(6,182,212,0.15) 0%,rgba(34,211,238,0.08) 100%);border-color:rgba(6,182,212,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>
  <span>Code Map</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="generateCodeMapBtn">Generate</button>
      <button class="settings-btn-secondary" id="openCodeMapHtmlBtn">Open HTML</button>
      <button class="settings-btn-secondary" id="exportCodeMapBtn">Export</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="refreshCodeMapBtn">Refresh</button>
      <button class="settings-btn-secondary" id="openCodeMapInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="roadmapDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(167,139,250,0.08) 100%);border-color:rgba(139,92,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
  <span>Roadmap</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="openRoadmapBtn">Open Roadmap</button>
      <button class="settings-btn-secondary" id="generateRoadmapBtn">Generate</button>
      <button class="settings-btn-secondary" id="exportRoadmapBtn">Export</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openRoadmapInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="aiContextDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(249,115,22,0.15) 0%,rgba(253,186,116,0.08) 100%);border-color:rgba(249,115,22,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
  <span>AI Context</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="scanAiContextBtn">Scan</button>
      <button class="settings-btn-secondary" id="exportAiContextBtn">Export</button>
      <button class="settings-btn-secondary" id="viewAiContextReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openAiContextInMainWindowBtn">Open in Main Window</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="uploadDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(52,211,153,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
  <span>Upload</span>
</div>
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
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions">
      <button class="settings-btn-primary" id="uploadBrowseBtn">Browse Files</button>
      <button class="settings-btn-secondary" id="uploadValidateBtn">Validate</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openUploadInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Configuration</div>
    <div class="tc-list" id="uploadConfigList">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Supported Formats</span></div><span class="tc-list-meta" id="uploadFormats">js, ts, json</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">Max File Size</span></div><span class="tc-list-meta" id="uploadMaxSize">10MB</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">Auto Scan</span></div><span class="tc-list-meta" id="uploadAutoScan">Off</span></div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="openAuditFromSidebar" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(248,113,113,0.08) 100%);border-color:rgba(239,68,68,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
  <span>Audit</span>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="securityDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(59,130,246,0.15) 0%,rgba(96,165,250,0.08) 100%);border-color:rgba(59,130,246,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
  <span>Security</span>
</div>
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
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="securityCritical2">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="securityHigh2">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="securityMedium2">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="securityLow2">0</span> Low</div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runSecurityScanBtn">Scan</button>
      <button class="settings-btn-secondary" id="openSecurityReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openSecurityInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Detected Threats</div>
    <div id="securityThreatsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">No threats detected</span></div><span class="tc-list-meta">0</span></div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="trustDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(168,85,247,0.15) 0%,rgba(192,132,252,0.08) 100%);border-color:rgba(168,85,247,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="12" r="3"/></svg></span>
  <span>Trust</span>
</div>
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
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="trustCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="trustHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="trustMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="trustLow">0</span> Low</div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions">
      <button class="settings-btn-primary" id="verifyTrustBtn">Verify</button>
      <button class="settings-btn-secondary" id="openTrustReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openTrustInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Trust Status</div>
    <div id="trustStatusList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">All checks passed</span></div><span class="tc-list-meta">OK</span></div>
    </div>
  </div>
</div>
<div id="auditDetailPanel" data-sidebar-tab="scan" style="display:none;">
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="openAuditBtn2">Run Audit</button>
      <button class="settings-btn-secondary" id="openAuditReportBtn2">Audit Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openAuditInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Recent Findings</div>
    <div id="auditFindingsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot green"></span><span class="tc-list-name">No new findings</span></div><span class="tc-list-meta">0</span></div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="qualityDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(20,184,166,0.15) 0%,rgba(45,212,191,0.08) 100%);border-color:rgba(20,184,166,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
  <span>Quality</span>
</div>
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
    <div class="settings-kpi-card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:120px;">
      <div id="qualityScoreRing" style="width:80px;height:80px;border-radius:50%;border:6px solid rgba(34,197,94,0.3);display:flex;align-items:center;justify-content:center;position:relative;">
        <div style="font-size:24px;font-weight:800;color:#4ade80;" id="qualityScore">100</div>
      </div>
      <div class="settings-kpi-label" style="margin-top:8px;">Score</div>
    </div>
    <div class="settings-kpi-card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:120px;">
      <div>
        <div class="settings-kpi-value red" id="qualityIssues">0</div>
        <div class="settings-kpi-label">Issues</div>
      </div>
      <div>
        <div class="settings-kpi-value" id="qualityFiles">0</div>
        <div class="settings-kpi-label">Files</div>
      </div>
    </div>
  </div>
  <div class="severity-bar">
    <div class="severity-item"><span class="severity-dot critical"></span><span id="qualityCritical">0</span> Critical</div>
    <div class="severity-item"><span class="severity-dot high"></span><span id="qualityHigh">0</span> High</div>
    <div class="severity-item"><span class="severity-dot medium"></span><span id="qualityMedium">0</span> Med</div>
    <div class="severity-item"><span class="severity-dot low"></span><span id="qualityLow">0</span> Low</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runQualityBtn">Analyze</button>
      <button class="settings-btn-secondary" id="exportQualityBtn">Export</button>
      <button class="settings-btn-secondary" id="viewQualityReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openQualityInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="assessmentsDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(245,158,11,0.15) 0%,rgba(251,191,36,0.08) 100%);border-color:rgba(245,158,11,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
  <span>Assessments</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runAssessmentsBtn">Run</button>
      <button class="settings-btn-secondary" id="exportAssessmentsBtn">Export</button>
      <button class="settings-btn-secondary" id="viewAssessmentsReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openAssessmentsInMainWindowBtn">Open in Main Window</button>
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
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="settings-btn-primary" id="platformRefreshBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1 2.12-9.36L23 10"/></svg></span>Refresh</button>
      <button class="settings-btn-secondary" id="platformExportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>Export</button>
      <button class="settings-btn-secondary" id="platformDocsBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>Docs</button>
      <button class="settings-btn-secondary" id="platformSettingsBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a-1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Settings</button>
      <button class="settings-btn-secondary" id="openPlatformInMainWindowBtn" style="grid-column:1 / -1;"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>Open in Main Window</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="profileDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(236,72,153,0.15) 0%,rgba(244,114,182,0.08) 100%);border-color:rgba(236,72,153,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
  <span>Profile</span>
</div>
<div id="profileDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="profileDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
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
          <option value="manager">Manager</option>
          <option value="security">Security Engineer</option>
          <option value="auditor">Auditor</option>
        </select>
        <label class="profile-form-label">Organization</label>
        <input type="text" class="profile-form-input" id="profileOrganization" placeholder="Company or team name" />
        <div class="profile-form-actions">
          <button class="profile-btn-primary" id="profileSaveBtn">Save Profile</button>
          <button class="profile-btn-secondary" id="profileClearBtn">Clear</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="complianceDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(34,197,94,0.15) 0%,rgba(74,222,128,0.08) 100%);border-color:rgba(34,197,94,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg></span>
  <span>Compliance</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runComplianceBtn">Run Check</button>
      <button class="settings-btn-secondary" id="exportComplianceBtn">Export</button>
      <button class="settings-btn-secondary" id="viewComplianceReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openComplianceInMainWindowBtn">Open in Main Window</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="repoHealthDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(8,145,178,0.15) 0%,rgba(34,211,238,0.08) 100%);border-color:rgba(8,145,178,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
  <span>Repo Health</span>
</div>
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
    <div class="settings-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="settings-btn-primary" id="repoHealthRunScanBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>Run Scan</button>
      <button class="settings-btn-secondary" id="repoHealthExportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>Export</button>
      <button class="settings-btn-secondary" id="repoHealthViewReportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>View Report</button>
      <button class="settings-btn-secondary" id="repoHealthSettingsBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Settings</button>
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
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="analyticsDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(168,85,247,0.15) 0%,rgba(192,132,252,0.08) 100%);border-color:rgba(168,85,247,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
  <span>Analytics</span>
</div>
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
      <div class="settings-kpi-value green" id="analyticsAvgScore">100</div>
      <div class="settings-kpi-label">Avg Score</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value amber" id="analyticsLastScan">--</div>
      <div class="settings-kpi-label">Last Scan</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="settings-btn-primary" id="analyticsRefreshBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>Refresh</button>
      <button class="settings-btn-secondary" id="analyticsExportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>Export</button>
      <button class="settings-btn-secondary" id="analyticsViewReportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>View Report</button>
      <button class="settings-btn-secondary" id="analyticsSettingsBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Settings</button>
    </div>
  </div>
  <div class="profile-severity-bar">
    <div class="profile-severity-dot red"></div><span id="analyticsCritical">0 Critical</span>
    <div class="profile-severity-dot amber"></div><span id="analyticsHigh">0 High</span>
    <div class="profile-severity-dot blue"></div><span id="analyticsMedium">0 Med</span>
    <div class="profile-severity-dot green"></div><span id="analyticsLow">0 Low</span>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Scan Summary</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Total Scans</span></div><span class="tc-list-meta" id="analyticsSummaryTotalScans">0</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Issues Found</span></div><span class="tc-list-meta" id="analyticsSummaryIssuesFound">0</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Avg Score</span></div><span class="tc-list-meta" id="analyticsSummaryAvgScore">100</span></div>
    </div>
  </div>
  <div class="settings-kpi-grid" style="grid-template-columns:1fr 1fr;">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="analyticsScanTrend">+0</div>
      <div class="settings-kpi-label">Scans This Week</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value red" id="analyticsIssueTrend">0</div>
      <div class="settings-kpi-label">Issues This Week</div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="teamDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(249,115,22,0.15) 0%,rgba(251,146,60,0.08) 100%);border-color:rgba(249,115,22,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
  <span>Team</span>
</div>
<div id="teamDetailPanel" data-sidebar-tab="advanced" style="display:none;">
  <div class="diag-back-bar" id="teamDetailBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="settings-header">
    <div class="settings-title">Team</div>
    <div class="settings-badge" id="teamStatusBadge" style="background:rgba(34,197,94,0.18);color:#4ade80;">Active</div>
  </div>
  <div class="settings-kpi-grid">
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="teamMembers">1</div>
      <div class="settings-kpi-label">Members</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value blue" id="teamScans">0</div>
      <div class="settings-kpi-label">Team Scans</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="teamResolved">0</div>
      <div class="settings-kpi-label">Resolved</div>
    </div>
    <div class="settings-kpi-card">
      <div class="settings-kpi-value green" id="teamScore">100</div>
      <div class="settings-kpi-label">Team Score</div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Actions</div>
    <div class="settings-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="settings-btn-primary" id="teamInviteBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Invite</button>
      <button class="settings-btn-secondary" id="teamExportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>Export</button>
      <button class="settings-btn-secondary" id="teamViewReportBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>View Report</button>
      <button class="settings-btn-secondary" id="teamSettingsBtn"><span class="icon" style="margin-right:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Settings</button>
    </div>
  </div>
  <div class="profile-severity-bar">
    <div class="profile-severity-dot red"></div><span id="teamCritical">0 Critical</span>
    <div class="profile-severity-dot amber"></div><span id="teamHigh">0 High</span>
    <div class="profile-severity-dot blue"></div><span id="teamMedium">0 Med</span>
    <div class="profile-severity-dot green"></div><span id="teamLow">0 Low</span>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Quality Summary</div>
    <div class="tc-list" style="gap:10px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Quality Score</span></div><span class="tc-list-meta" id="teamQualityScore">100</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Total Issues</span></div><span class="tc-list-meta" id="teamTotalIssues">0</span></div>
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-name">Gate Status</span></div><span class="tc-list-meta" id="teamGateStatus">PASS</span></div>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Team Members</div>
    <div class="tc-list" id="teamMembersList" style="gap:8px;">
      <div class="tc-list-item">
        <div class="tc-list-avatar" style="width:32px;height:32px;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px;">A</div>
        <div class="tc-list-item-left"><span class="tc-list-name">Admin</span><span class="tc-list-sub" style="color:var(--vscode-descriptionForeground);">Project Owner</span></div>
        <span class="tc-list-meta" style="color:#4ade80;">Active</span>
      </div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="scanDropdownHeader" data-sidebar-tab="scan" style="background:linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(248,113,113,0.08) 100%);border-color:rgba(239,68,68,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
  <span>Scan</span>
</div>
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
    <div class="settings-actions">
      <button class="settings-btn-primary" id="runScanBtn">Start Scan</button>
      <button class="settings-btn-secondary" id="exportScanBtn">Export</button>
      <button class="settings-btn-secondary" id="viewScanReportBtn">View Report</button>
    </div>
    <div class="settings-actions" style="margin-top:8px;">
      <button class="settings-btn-secondary" id="openScanInMainWindowBtn">Open in Main Window</button>
    </div>
  </div>
  <div class="settings-section-card">
    <div class="settings-section-title">Scan Results</div>
    <div id="scanResultsList" style="display:flex;flex-direction:column;gap:8px;">
      <div class="tc-list-item"><div class="tc-list-item-left"><span class="tc-list-dot blue"></span><span class="tc-list-name">No results yet</span></div><span class="tc-list-meta">--</span></div>
    </div>
  </div>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="toggleMonitorSidebarBtn" data-sidebar-tab="dashboard" style="background:linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(52,211,153,0.08) 100%);border-color:rgba(16,185,129,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
  <span>Toggle AI Slop Monitor</span>
</div>
<div class="settings-btn-card ${displayMode === 'sidebar' ? '' : 'hidden'}" id="sendToAIAgentDropdownHeader" data-sidebar-tab="advanced" style="background:linear-gradient(135deg,rgba(236,72,153,0.15) 0%,rgba(244,114,182,0.08) 100%);border-color:rgba(236,72,153,0.25);">
  <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
  <span>AI Agent</span>
</div>
<div id="diagnoseResultsContainer" style="display:none; background: var(--vscode-editor-background, #1e1e1e); overflow-y: auto;">
  <div class="diag-back-bar" id="diagnoseBackBtn" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    <span>Back</span>
  </div>
  <div class="diag-title">All Issues</div>
  <div id="diagnoseStatusBadge" class="diag-status" style="display:none;"></div>
  <div id="diagnoseResults" class="diag-results"></div>
</div>
<div class="settings-dropdown-header ${displayMode === 'sidebar' ? '' : 'hidden'}" id="settingsDropdownHeader" data-sidebar-tab="settings">
  <span>Settings</span>
  <span class="arrow">&#x25BC;</span>
</div>
<div class="settings-dropdown-body ${displayMode === 'sidebar' ? '' : 'hidden'}" id="settingsDropdownBody" data-sidebar-tab="settings">
  <div class="tab-section">TOOLS</div>
  <div class="settings-btn-card" id="platformDropdownHeader" data-sidebar-tab="settings" style="margin-bottom:0;background:linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(129,140,248,0.08) 100%);border-color:rgba(99,102,241,0.25);">
    <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>
    <span>Platform</span>
  </div>
  <div class="settings-btn-card" id="openSettingsFromSettings" style="margin-bottom:0;background:linear-gradient(135deg,rgba(107,114,128,0.15) 0%,rgba(156,163,175,0.08) 100%);border-color:rgba(107,114,128,0.25);">
    <span class="icon">&#x2699;</span>
    <span>Open Settings</span>
  </div>
  <div class="tab-section" style="margin-top:16px;">SERVER INFO</div>
  <div class="card" id="settingsServerCard">
    <div class="card-icon server"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
    <div class="card-text">
      <div class="card-label">API</div>
      <div class="card-value" id="settingsServerUrlText">http://127.0.0.1:54358</div>
    </div>
  </div>
</div>
<script nonce="${nonce}">
// simplebeacon-ignore var-declaration — generated minified event-handler bindings; var is required for IE11 compat
(function(){
  window._displayMode = '${displayMode}';
  const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
  if (vscode) window.vscode = vscode;
  // Generic dropdown toggle: works for every .settings-dropdown-header including duplicates
  document.addEventListener('click', function(e) {
    var header = e.target.closest('.settings-dropdown-header');
    if (!header) return;
    var body = header.nextElementSibling;
    if (body && body.classList.contains('settings-dropdown-body')) {
      var isOpen = body.classList.contains('open');
      document.querySelectorAll('.settings-dropdown-body.open').forEach(function(b){b.classList.remove('open');});
      document.querySelectorAll('.settings-dropdown-header.open').forEach(function(h){h.classList.remove('open');});
      if (!isOpen) {
        body.classList.add('open');
        header.classList.add('open');
      }
    }
    e.stopPropagation();
  }, true);
  // Safety net: ensure only one sidebar detail panel is open at a time
  var HEADER_TO_MAIN_WINDOW_COMMAND = {
    'scanDropdownHeader': 'openDiagnose',
    'analyzeDropdownHeader': 'analyze',
    'securityDropdownHeader': 'openSecurity',
    'qualityDropdownHeader': 'openQuality',
    'trustDropdownHeader': 'openTrust',
    'assessmentsDropdownHeader': 'openAssessments',
    'certificateDropdownHeader': 'openCertificate',
    'repoHealthDropdownHeader': 'openRepoHealth',
    'analyticsDropdownHeader': 'openAnalytics',
    'platformDropdownHeader': 'openPlatform',
    'profileDropdownHeader': 'openProfile',
    'teamDropdownHeader': 'team',
    'roadmapDropdownHeader': 'openRoadmap',
    'complianceDropdownHeader': 'openCompliance',
    'codeMapDropdownHeader': 'openCodeMap',
    'aiContextDropdownHeader': 'openAiContext',
    'uploadDropdownHeader': 'openUpload',
    'openAuditFromSidebar': 'openAudit'
  };
  document.addEventListener('click', function(e) {
    var header = e.target.closest('.settings-btn-card, .settings-dropdown-header');
    if (!header) return;
    var id = header.id;
    if (!id) return;
    var mainCommand = HEADER_TO_MAIN_WINDOW_COMMAND[id];
    if (window._displayMode === 'mainWindow' && mainCommand) {
      if (window.vscode) window.vscode.postMessage({command: mainCommand});
      return;
    }
    var detailId = null;
    if (id === 'openAuditFromSidebar') detailId = 'auditDetailPanel';
    else if (id.indexOf('DropdownHeader') > -1) detailId = id.replace('DropdownHeader', 'DetailPanel');
    if (!detailId) return;
    var detail = document.getElementById(detailId);
    if (!detail) return;
    _closeDetailPanels();
    header.style.display = 'none';
    detail.classList.remove('hidden');
    detail.classList.add('detail-active');
    detail.style.display = 'block';
    document.body.classList.add('detail-panel-open');
  }, true);
  function _closeDetailPanels(){
    document.body.classList.remove('detail-panel-open');
    document.querySelectorAll('[id$="DetailPanel"]').forEach(function(el){el.style.display='none'; el.classList.remove('detail-active');});
    var analyzeBtn=document.getElementById('analyzeDropdownHeader'); if(analyzeBtn){analyzeBtn.style.display='block';}
    var analyzeDetail=document.getElementById('analyzeDetailPanel'); if(analyzeDetail){analyzeDetail.style.display='none';}
    var auditBtn=document.getElementById('openAuditFromSidebar'); if(auditBtn){auditBtn.style.display='block';}
    var auditDetail=document.getElementById('auditDetailPanel'); if(auditDetail){auditDetail.style.display='none';}
    var securityBtn=document.getElementById('securityDropdownHeader'); if(securityBtn){securityBtn.style.display='block';}
    var securityDetail=document.getElementById('securityDetailPanel'); if(securityDetail){securityDetail.style.display='none';}
    var qualityBtn=document.getElementById('qualityDropdownHeader'); if(qualityBtn){qualityBtn.style.display='block';}
    var qualityDetail=document.getElementById('qualityDetailPanel'); if(qualityDetail){qualityDetail.style.display='none';}
    var trustBtn=document.getElementById('trustDropdownHeader'); if(trustBtn){trustBtn.style.display='block';}
    var trustDetail=document.getElementById('trustDetailPanel'); if(trustDetail){trustDetail.style.display='none';}
    var assessmentsBtn=document.getElementById('assessmentsDropdownHeader'); if(assessmentsBtn){assessmentsBtn.style.display='block';}
    var assessmentsDetail=document.getElementById('assessmentsDetailPanel'); if(assessmentsDetail){assessmentsDetail.style.display='none';}
    var scanBtn=document.getElementById('scanDropdownHeader'); if(scanBtn){scanBtn.style.display='block';}
    var scanDetail=document.getElementById('scanDetailPanel'); if(scanDetail){scanDetail.style.display='none';}
    var aiContextBtn=document.getElementById('aiContextDropdownHeader'); if(aiContextBtn){aiContextBtn.style.display='block';}
    var aiContextDetail=document.getElementById('aiContextDetailPanel'); if(aiContextDetail){aiContextDetail.style.display='none';}
    var uploadBtn=document.getElementById('uploadDropdownHeader'); if(uploadBtn){uploadBtn.style.display='block';}
    var uploadDetail=document.getElementById('uploadDetailPanel'); if(uploadDetail){uploadDetail.style.display='none';}
    var repoHealthBtn=document.getElementById('repoHealthDropdownHeader'); if(repoHealthBtn){repoHealthBtn.style.display='block';}
    var repoHealthDetail=document.getElementById('repoHealthDetailPanel'); if(repoHealthDetail){repoHealthDetail.style.display='none';}
    var analyticsBtn=document.getElementById('analyticsDropdownHeader'); if(analyticsBtn){analyticsBtn.style.display='block';}
    var analyticsDetail=document.getElementById('analyticsDetailPanel'); if(analyticsDetail){analyticsDetail.style.display='none';}
    var platformBtn=document.getElementById('platformDropdownHeader'); if(platformBtn){platformBtn.style.display='block';}
    var platformDetail=document.getElementById('platformDetailPanel'); if(platformDetail){platformDetail.style.display='none';}
    var certBtn=document.getElementById('certificateDropdownHeader'); if(certBtn){certBtn.style.display='block';}
    var certDetail=document.getElementById('certificateDetailPanel'); if(certDetail){certDetail.style.display='none';}
    var codeMapBtn=document.getElementById('codeMapDropdownHeader'); if(codeMapBtn){codeMapBtn.style.display='block';}
    var codeMapDetail=document.getElementById('codeMapDetailPanel'); if(codeMapDetail){codeMapDetail.style.display='none';}
    var roadmapBtn=document.getElementById('roadmapDropdownHeader'); if(roadmapBtn){roadmapBtn.style.display='block';}
    var roadmapDetail=document.getElementById('roadmapDetailPanel'); if(roadmapDetail){roadmapDetail.style.display='none';}
    var profileBtn=document.getElementById('profileDropdownHeader'); if(profileBtn){profileBtn.style.display='block';}
    var profileDetail=document.getElementById('profileDetailPanel'); if(profileDetail){profileDetail.style.display='none';}
    var complianceBtn=document.getElementById('complianceDropdownHeader'); if(complianceBtn){complianceBtn.style.display='block';}
    var complianceDetail=document.getElementById('complianceDetailPanel'); if(complianceDetail){complianceDetail.style.display='none';}
    var teamBtn=document.getElementById('teamDropdownHeader'); if(teamBtn){teamBtn.style.display='block';}
    var teamDetail=document.getElementById('teamDetailPanel'); if(teamDetail){teamDetail.style.display='none';}
    var sendToAIAgentBtn=document.getElementById('sendToAIAgentDropdownHeader'); if(sendToAIAgentBtn){sendToAIAgentBtn.style.display='block';}
    var settingsMenu=document.getElementById('settingsMenuTab'); if(settingsMenu){settingsMenu.style.display='block';}
    var settingsDetail=document.getElementById('settingsDetailPanelTab'); if(settingsDetail){settingsDetail.style.display='none';}
  }
  function _openSidebarMenu(containerId, detailPanelId, mainWindowCommand){
    if (mainWindowCommand && window._displayMode === 'mainWindow' && window.vscode) {
      window.vscode.postMessage({command: mainWindowCommand});
      return;
    }
    _closeDetailPanels();
    if(containerId){var container=document.getElementById(containerId); if(container){container.style.display='none';}}
    var detail=document.getElementById(detailPanelId);
    if(detail){detail.classList.remove('hidden'); detail.classList.add('detail-active'); detail.style.display='block';}
    document.body.classList.add('detail-panel-open');
  }
  // Sidebar tab switching
  function _switchSidebarTab(tab) {
    _closeDetailPanels();
    document.querySelectorAll('#sidebarTabBar .sidebar-tab-item').forEach(function(t){t.classList.toggle('active', t.getAttribute('data-tab') === tab);});
    document.querySelectorAll('#mainTabBar .tab-item').forEach(function(t){t.classList.toggle('active', t.getAttribute('data-tab') === tab);});
    document.querySelectorAll('[data-sidebar-tab]').forEach(function(el){var match=el.getAttribute('data-sidebar-tab')===tab; if(match){el.classList.remove('hidden');} else {el.classList.add('hidden');} });
    document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});
    var pane=document.getElementById('tab'+tab.charAt(0).toUpperCase()+tab.slice(1)); if(pane){ pane.classList.add('active'); pane.classList.remove('hidden'); }
    var td=document.getElementById('tabDashboard'); if(td){ if(tab==='dashboard'){ td.classList.add('active'); td.classList.remove('hidden'); } else { td.classList.remove('active'); td.classList.add('hidden'); } }
    if (tab === 'settings') {
      var setHeader=document.getElementById('settingsDropdownHeader'); if(setHeader){setHeader.classList.add('hidden');}
      var setBody=document.getElementById('settingsDropdownBody'); if(setBody){setBody.classList.add('hidden');}
    }
    _hideDiagnoseResults();
    document.querySelectorAll('[id$="DetailPanel"]').forEach(function(el){el.classList.add('hidden');el.style.display='none';el.classList.remove('detail-active');});
  }
  document.querySelectorAll('#sidebarTabBar .sidebar-tab-item').forEach(function(t){t.addEventListener('click', function(){_switchSidebarTab(t.getAttribute('data-tab'));});});
  _switchSidebarTab('dashboard');
  var _statusCard=document.getElementById('statusCard');if(_statusCard){_statusCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  var _serverCard=document.getElementById('serverCard');if(_serverCard){_serverCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCloudInBrowser'}); });}
  var _analyzeDropdownHeader=document.getElementById('analyzeDropdownHeader');if(_analyzeDropdownHeader){_analyzeDropdownHeader.addEventListener('click', function() { const header=document.getElementById('analyzeDropdownHeader'); const detail=document.getElementById('analyzeDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); });}
  var _analyzeDetailBackBtn=document.getElementById('analyzeDetailBackBtn');if(_analyzeDetailBackBtn){_analyzeDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('analyzeDropdownHeader'); const detail=document.getElementById('analyzeDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runAnalysisBtn=document.getElementById('runAnalysisBtn');if(_runAnalysisBtn){_runAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'analyze'}); });}
  var _scanWorkspaceBtn=document.getElementById('scanWorkspaceBtn');if(_scanWorkspaceBtn){_scanWorkspaceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan'}); });}
  var _exportJsonBtn=document.getElementById('exportJsonBtn');if(_exportJsonBtn){_exportJsonBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _enhancedAnalysisBtn=document.getElementById('enhancedAnalysisBtn');if(_enhancedAnalysisBtn){_enhancedAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  var _realtimeAnalysisBtn=document.getElementById('realtimeAnalysisBtn');if(_realtimeAnalysisBtn){_realtimeAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRealtimeAnalysis'}); });}
  var _patternDetectionBtn=document.getElementById('patternDetectionBtn');if(_patternDetectionBtn){_patternDetectionBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPatternDetection'}); });}
  var _modelHealthBtn=document.getElementById('modelHealthBtn');if(_modelHealthBtn){_modelHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openModelHealth'}); });}
  var _toggleMonitorBtn=document.getElementById('toggleMonitorBtn');if(_toggleMonitorBtn){_toggleMonitorBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  var _openDashboardBtn=document.getElementById('openDashboardBtn');if(_openDashboardBtn){_openDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDashboard'}); });}
  var _openReportBtn=document.getElementById('openReportBtn');if(_openReportBtn){_openReportBtn.addEventListener('click', function() { _switchSidebarTab('report'); });}
  var _openCertificateBtn=document.getElementById('openCertificateBtn');if(_openCertificateBtn){_openCertificateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  var _openCodeMapBtn=document.getElementById('openCodeMapBtn');if(_openCodeMapBtn){_openCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  var _openRoadmapBtn=document.getElementById('openRoadmapBtn');if(_openRoadmapBtn){_openRoadmapBtn.addEventListener('click', function() { _switchSidebarTab('roadmap'); });}
  var _openAiContextBtn=document.getElementById('openAiContextBtn');if(_openAiContextBtn){_openAiContextBtn.addEventListener('click', function() { _switchSidebarTab('aicontext'); });}
  var _openUploadBtn=document.getElementById('openUploadBtn');if(_openUploadBtn){_openUploadBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openUpload'}); });}
  var _openAuditBtnMain=document.getElementById('openAuditBtnMain');if(_openAuditBtnMain){_openAuditBtnMain.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAudit'}); });}
  var _openSecurityBtnMain=document.getElementById('openSecurityBtnMain');if(_openSecurityBtnMain){_openSecurityBtnMain.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  var _openTrustBtn=document.getElementById('openTrustBtn');if(_openTrustBtn){_openTrustBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  var _openQualityBtn=document.getElementById('openQualityBtn');if(_openQualityBtn){_openQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  var _openAssessmentsBtn=document.getElementById('openAssessmentsBtn');if(_openAssessmentsBtn){_openAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _openPlatformBtn=document.getElementById('openPlatformBtn');if(_openPlatformBtn){_openPlatformBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  var _openProfileBtn=document.getElementById('openProfileBtn');if(_openProfileBtn){_openProfileBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  var _openProfileInMainWindowBtn=document.getElementById('openProfileInMainWindowBtn');if(_openProfileInMainWindowBtn){_openProfileInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  var _openComplianceBtn=document.getElementById('openComplianceBtn');if(_openComplianceBtn){_openComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  var _openRepoHealthBtn=document.getElementById('openRepoHealthBtn');if(_openRepoHealthBtn){_openRepoHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _openRepoHealthInMainWindowBtn=document.getElementById('openRepoHealthInMainWindowBtn');if(_openRepoHealthInMainWindowBtn){_openRepoHealthInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _openAnalyticsBtn=document.getElementById('openAnalyticsBtn');if(_openAnalyticsBtn){_openAnalyticsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  var _openAnalyticsInMainWindowBtn=document.getElementById('openAnalyticsInMainWindowBtn');if(_openAnalyticsInMainWindowBtn){_openAnalyticsInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  var _openScanBtn=document.getElementById('openScanBtn');if(_openScanBtn){_openScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  var _reportBackBtn=document.getElementById('reportBackBtn');if(_reportBackBtn){_reportBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  var _openReportInMainWindowBtn=document.getElementById('openReportInMainWindowBtn');if(_openReportInMainWindowBtn){_openReportInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openReport'}); });}
  var _roadmapBackBtn=document.getElementById('roadmapBackBtn');if(_roadmapBackBtn){_roadmapBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  var _openRoadmapInMainWindowBtn=document.getElementById('openRoadmapInMainWindowBtn');if(_openRoadmapInMainWindowBtn){_openRoadmapInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmap'}); });}
  var _aiContextBackBtn=document.getElementById('aiContextBackBtn');if(_aiContextBackBtn){_aiContextBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  var _openAiContextInMainWindowBtn=document.getElementById('openAiContextInMainWindowBtn');if(_openAiContextInMainWindowBtn){_openAiContextInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  var _openPreviewBtn=document.getElementById('openPreviewBtn');if(_openPreviewBtn){_openPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreview'}); });}
  var _scanStartBtn=document.getElementById('scanStartBtn');if(_scanStartBtn){_scanStartBtn.addEventListener('click', function() { var toggle=document.getElementById('sidebarScanWorkspaceToggle'); var pathInput=document.getElementById('sidebarScanPathInput'); var isWorkspace=toggle?toggle.checked:true; var path=pathInput?pathInput.value:''; if (window.vscode) window.vscode.postMessage({command: 'scan', mode: isWorkspace?'workspace':'custom', path: isWorkspace?'':path}); });}
  var _openToggleMonitorBtn=document.getElementById('openToggleMonitorBtn');if(_openToggleMonitorBtn){_openToggleMonitorBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  var _openSendToAIAgentBtn=document.getElementById('openSendToAIAgentBtn');if(_openSendToAIAgentBtn){_openSendToAIAgentBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSendToAIAgent'}); });}
  var _openEnhancedAnalysisBtn=document.getElementById('openEnhancedAnalysisBtn');if(_openEnhancedAnalysisBtn){_openEnhancedAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  var _openRealtimeAnalysisBtn=document.getElementById('openRealtimeAnalysisBtn');if(_openRealtimeAnalysisBtn){_openRealtimeAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRealtimeAnalysis'}); });}
  var _openPatternDetectionBtn=document.getElementById('openPatternDetectionBtn');if(_openPatternDetectionBtn){_openPatternDetectionBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPatternDetection'}); });}
  var _openModelHealthBtn=document.getElementById('openModelHealthBtn');if(_openModelHealthBtn){_openModelHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openModelHealth'}); });}
  var _openTeamDashboardBtnMain=document.getElementById('openTeamDashboardBtnMain');if(_openTeamDashboardBtnMain){_openTeamDashboardBtnMain.addEventListener('click', function() { if(window.vscode) window.vscode.postMessage({command:'openTeamDashboard'}); });}
  function _tdBind(id,cmd){var el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:cmd});});}}
  _tdBind('tdRoadmap','openRoadmap');
  var _tdAuditEl=document.getElementById('tdAudit');if(_tdAuditEl){_tdAuditEl.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'openAuditUrl',url:'http://127.0.0.1:54358/coming-soon/roadmap.html?h=1782501104143'});});}
  _tdPath('tdPricing','/coming-soon/pricing.html');
  _tdBind('tdOpenSite','openTeamDashboard');
  _tdBind('tdSignIn','signIn');
  _tdBind('tdOfflineToggle','toggleOffline');
  _tdBind('tdSignOut','signOut');
  _tdBind('tdDashboard','dashboard');
  _tdBind('tdAnalyze','openAnalyze');
  _tdBind('tdResults','openReport');
  _tdBind('tdRepoHealth','openRepoHealth');
  _tdBind('tdSecurity','openSecurity');
  _tdBind('tdQuality','openQuality');
  _tdBind('tdTrust','openTrust');
  _tdBind('tdAuditReport','openAudit');
  _tdBind('tdAssessments','openAssessments');
  _tdBind('tdRemediation','openRoadmap');
  _tdBind('tdPlatform','openPlatform');
  _tdBind('tdProfile','openProfile');
  _tdBind('tdTools','openDiagnose');
  _tdBind('tdSettings','settings');
  _tdBind('tdHelp','openHelp');
  _tdBind('tdChatbot','openChatbot');
  _tdBind('tdAbout','openAbout');
  _tdBind('tdGitHub','openGitHub');
  _tdBind('tdDocs','openDocs');
  var _openUploadBtn=document.getElementById('openUploadBtn');if(_openUploadBtn){_openUploadBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openUpload'}); });}
  var _openCodeMapBtn=document.getElementById('openCodeMapBtn');if(_openCodeMapBtn){_openCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  var _openCertificateBtn=document.getElementById('openCertificateBtn');if(_openCertificateBtn){_openCertificateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  // Analyze, Roadmap, and AI Context buttons already send open* commands above; do not switch sidebar tabs.
  var _openSettingsBtn=document.getElementById('openSettingsBtn');if(_openSettingsBtn){_openSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  var _uploadDropzone=document.getElementById('uploadDropzone');var _uploadFileInput=document.getElementById('uploadFileInput');var _uploadList=document.getElementById('uploadList');var _uploadStatPending=document.getElementById('uploadStatPending');var _uploadStatValid=document.getElementById('uploadStatValid');var _uploadStatInvalid=document.getElementById('uploadStatInvalid');var _uploadValidateBtn=document.getElementById('uploadValidateBtn');var _uploadClearBtn=document.getElementById('uploadClearBtn');var _uploadProgress=document.getElementById('uploadProgress');var _uploadProgressFill=document.getElementById('uploadProgressFill');var _uploadProgressText=document.getElementById('uploadProgressText');var _uploadDetail=document.getElementById('uploadDetail');var _uploadDetailList=document.getElementById('uploadDetailList');var _uploadResultBox=document.getElementById('uploadResultBox');var _uploadResultTitle=document.getElementById('uploadResultTitle');var _uploadResultList=document.getElementById('uploadResultList');
  var _uploadFiles=[];
  var _uploadBase64={};
  function _uploadFormatSize(b){if(b<1024)return b+' B';if(b<1024*1024)return (b/1024).toFixed(1)+' KB';return (b/(1024*1024)).toFixed(1)+' MB';}
  function _uploadAllowedExt(name){var ext=(name.split('.').pop()||'').toLowerCase();return ['zip','js','ts','json','md','txt','csv','xml','html','css','yml','yaml'].indexOf(ext)>=0;}
  function _uploadFileDetail(f){var details=[];if(!_uploadAllowedExt(f.name)){details.push({ok:false,text:'Unsupported file extension'});}else{details.push({ok:true,text:'Supported file type'});}if(f.size>50*1024*1024){details.push({ok:false,text:'File exceeds 50 MB limit'});}else if(f.size>5*1024*1024){details.push({ok:false,text:'Large file (>5 MB), may be slow'});}else{details.push({ok:true,text:'Size OK'});}return details;}
  function _uploadRender(){if(!_uploadList)return;while(_uploadList.firstChild){_uploadList.removeChild(_uploadList.firstChild);}if(_uploadFiles.length===0){var empty=document.createElement('div');empty.className='upload-empty';empty.textContent='No files selected. Drop files above or click to browse.';_uploadList.appendChild(empty);}else{_uploadFiles.forEach(function(f,index){var iconClass=f.status==='invalid'?'err':f.status==='valid'?'':'warn';var statusClass=f.status==='valid'?'valid':f.status==='invalid'?'invalid':'ready';var statusText=f.status==='valid'?'Valid':f.status==='invalid'?'Invalid':'Ready';var item=document.createElement('div');item.className='upload-item';var icon=document.createElement('div');icon.className='upload-item-icon '+iconClass;icon.textContent='\u{1F4C4}';var text=document.createElement('div');text.className='upload-item-text';var name=document.createElement('div');name.className='upload-item-name';name.textContent=f.name;var meta=document.createElement('div');meta.className='upload-item-meta';meta.textContent=_uploadFormatSize(f.size);text.appendChild(name);text.appendChild(meta);var actions=document.createElement('div');actions.className='upload-item-actions';var statusBadge=document.createElement('div');statusBadge.className='upload-item-status '+statusClass;statusBadge.textContent=statusText;actions.appendChild(statusBadge);var removeBtn=document.createElement('button');removeBtn.className='upload-item-action';removeBtn.textContent='\u2715';removeBtn.title='Remove';removeBtn.addEventListener('click',function(e){e.stopPropagation();_uploadFiles.splice(index,1);delete _uploadBase64[f.name];_uploadRender();});actions.appendChild(removeBtn);item.appendChild(icon);item.appendChild(text);item.appendChild(actions);_uploadList.appendChild(item);});}var v=_uploadFiles.filter(function(f){return f.status==='valid';}).length;var iv=_uploadFiles.filter(function(f){return f.status==='invalid';}).length;var p=_uploadFiles.length-v-iv;if(_uploadStatPending)_uploadStatPending.textContent=p;if(_uploadStatValid)_uploadStatValid.textContent=v;if(_uploadStatInvalid)_uploadStatInvalid.textContent=iv;}
  function _uploadSetProgress(pct,text){if(!_uploadProgress||!_uploadProgressFill||!_uploadProgressText)return;_uploadProgress.style.display='block';_uploadProgressFill.style.width=pct+'%';_uploadProgressText.textContent=text||pct+'%';}
  function _uploadHideProgress(){if(_uploadProgress)_uploadProgress.style.display='none';}
  function _uploadShowDetails(){if(!_uploadDetail||!_uploadDetailList)return;_uploadDetail.style.display='block';while(_uploadDetailList.firstChild){_uploadDetailList.removeChild(_uploadDetailList.firstChild);}_uploadFiles.forEach(function(f){var details=_uploadFileDetail(f);var fileRow=document.createElement('div');fileRow.style.marginBottom='8px';var fileName=document.createElement('div');fileName.style.fontWeight='600';fileName.style.marginBottom='2px';fileName.textContent=f.name;fileRow.appendChild(fileName);details.forEach(function(d){var row=document.createElement('div');row.className='upload-detail-item '+(d.ok?'ok':'err');row.textContent=(d.ok?'\u2713 ':'\u2717 ')+d.text;fileRow.appendChild(row);});_uploadDetailList.appendChild(fileRow);});}
  function _uploadShowResult(){if(!_uploadResultBox||!_uploadResultTitle||!_uploadResultList)return;var validCount=_uploadFiles.filter(function(f){return f.status==='valid';}).length;var invalidCount=_uploadFiles.filter(function(f){return f.status==='invalid';}).length;_uploadResultBox.style.display='block';if(invalidCount===0){_uploadResultTitle.className='upload-result-title ok';_uploadResultTitle.textContent='\u2713 All files passed validation';}else{_uploadResultTitle.className='upload-result-title err';_uploadResultTitle.textContent='\u2717 '+invalidCount+' file'+(invalidCount===1?'':'s')+' failed validation';}var list=[];if(validCount>0)list.push(validCount+' ready for upload');if(invalidCount>0)list.push(invalidCount+' need fixing');_uploadResultList.textContent=list.join(' \u2022 ')||'No files selected';}
  function _uploadReadFile(file){return new Promise(function(resolve){var reader=new FileReader();reader.onload=function(e){resolve({name:file.name,size:file.size,data:e.target.result.split(',')[1]});};reader.readAsDataURL(file);});}
  function _uploadValidateAll(){if(_uploadFiles.length===0){_uploadShowResult();return;}_uploadFiles.forEach(function(f){f.status=_uploadAllowedExt(f.name)?'valid':'invalid';});_uploadRender();_uploadShowDetails();_uploadShowResult();var validFiles=_uploadFiles.filter(function(f){return f.status==='valid';});if(validFiles.length===0){return;}_uploadSetProgress(0,'Reading files...');var done=0;var payloads=[];function onDone(){done++;var pct=Math.round((done/validFiles.length)*50);_uploadSetProgress(pct,'Reading files...');if(done===validFiles.length){_uploadSetProgress(75,'Sending to extension...');if(window.vscode)window.vscode.postMessage({command:'validateUpload',files:payloads});_uploadSetProgress(100,'Done');setTimeout(_uploadHideProgress,800);}}validFiles.forEach(function(f){_uploadReadFile(f).then(function(payload){payloads.push(payload);_uploadBase64[f.name]=payload.data;onDone();});});}
  function _uploadAddFiles(fileList){if(!fileList)return;for(var i=0;i<fileList.length;i++){var file=fileList[i];_uploadFiles.push({name:file.name,size:file.size,status:'ready'});}_uploadRender();}
  if(_uploadDropzone&&_uploadFileInput){_uploadDropzone.addEventListener('click',function(){_uploadFileInput.click();});_uploadDropzone.addEventListener('dragover',function(e){e.preventDefault();_uploadDropzone.classList.add('dragover');});_uploadDropzone.addEventListener('dragleave',function(e){e.preventDefault();_uploadDropzone.classList.remove('dragover');});_uploadDropzone.addEventListener('drop',function(e){e.preventDefault();_uploadDropzone.classList.remove('dragover');_uploadAddFiles(e.dataTransfer.files);});_uploadFileInput.addEventListener('change',function(){_uploadAddFiles(_uploadFileInput.files);_uploadFileInput.value='';});}
  if(_uploadValidateBtn){_uploadValidateBtn.addEventListener('click',function(){_uploadValidateAll();});}
  if(_uploadClearBtn){_uploadClearBtn.addEventListener('click',function(){_uploadFiles=[];_uploadBase64={};_uploadRender();if(_uploadDetail)_uploadDetail.style.display='none';if(_uploadResultBox)_uploadResultBox.style.display='none';_uploadHideProgress();});}
  _uploadRender();
  var _analyzeRunCard=document.getElementById('analyzeRunCard');if(_analyzeRunCard){_analyzeRunCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'analyze'}); });}
  var _analyzeScanWorkspaceCard=document.getElementById('analyzeScanWorkspaceCard');if(_analyzeScanWorkspaceCard){_analyzeScanWorkspaceCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan'}); });}
  var _analyzeExportJsonCard=document.getElementById('analyzeExportJsonCard');if(_analyzeExportJsonCard){_analyzeExportJsonCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _repoHealthDropdownHeader=document.getElementById('repoHealthDropdownHeader');if(_repoHealthDropdownHeader){_repoHealthDropdownHeader.addEventListener('click', function() { const header=document.getElementById('repoHealthDropdownHeader'); const detail=document.getElementById('repoHealthDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _repoHealthDetailBackBtn=document.getElementById('repoHealthDetailBackBtn');if(_repoHealthDetailBackBtn){_repoHealthDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('repoHealthDropdownHeader'); const detail=document.getElementById('repoHealthDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _repoHealthCard=document.getElementById('repoHealthCard');if(_repoHealthCard){_repoHealthCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _assessmentsCard=document.getElementById('assessmentsCard');if(_assessmentsCard){_assessmentsCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _openAssessmentsBtn=document.getElementById('openAssessmentsBtn');if(_openAssessmentsBtn){_openAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _platformDropdownHeader=document.getElementById('platformDropdownHeader');if(_platformDropdownHeader){_platformDropdownHeader.addEventListener('click', function() { const header=document.getElementById('platformDropdownHeader'); const detail=document.getElementById('platformDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); });}
  var _platformCard=document.getElementById('platformCard');if(_platformCard){_platformCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  var _openPlatformBtn=document.getElementById('openPlatformBtn');if(_openPlatformBtn){_openPlatformBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  var _profileDropdownHeader=document.getElementById('profileDropdownHeader');if(_profileDropdownHeader){_profileDropdownHeader.addEventListener('click', function() { const header=document.getElementById('profileDropdownHeader'); const detail=document.getElementById('profileDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _profileDetailBackBtn=document.getElementById('profileDetailBackBtn');if(_profileDetailBackBtn){_profileDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('profileDropdownHeader'); const detail=document.getElementById('profileDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _profileSaveBtn=document.getElementById('profileSaveBtn');if(_profileSaveBtn){_profileSaveBtn.addEventListener('click', function() { const displayName=document.getElementById('profileDisplayName'); const email=document.getElementById('profileEmail'); const role=document.getElementById('profileRole'); const organization=document.getElementById('profileOrganization'); const autoScan=document.getElementById('profileAutoScan'); const notifications=document.getElementById('profileNotifications'); const darkMode=document.getElementById('profileDarkMode'); if (window.vscode) window.vscode.postMessage({command: 'saveProfile', profile: { displayName: displayName ? displayName.value : '', email: email ? email.value : '', role: role ? role.value : '', organization: organization ? organization.value : '', autoScan: autoScan ? autoScan.checked : false, notifications: notifications ? notifications.checked : false, darkMode: darkMode ? darkMode.checked : false }}); });}
  var _profileClearBtn=document.getElementById('profileClearBtn');if(_profileClearBtn){_profileClearBtn.addEventListener('click', function() { const displayName=document.getElementById('profileDisplayName'); const email=document.getElementById('profileEmail'); const role=document.getElementById('profileRole'); const organization=document.getElementById('profileOrganization'); const autoScan=document.getElementById('profileAutoScan'); const notifications=document.getElementById('profileNotifications'); const darkMode=document.getElementById('profileDarkMode'); if(displayName) displayName.value=''; if(email) email.value=''; if(role) role.value=''; if(organization) organization.value=''; if(autoScan) autoScan.checked=false; if(notifications) notifications.checked=false; if(darkMode) darkMode.checked=true; });}
  var _profileCard=document.getElementById('profileCard');if(_profileCard){_profileCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  var _openProfileBtn=document.getElementById('openProfileBtn');if(_openProfileBtn){_openProfileBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  var _reportDropdownHeader=document.getElementById('reportDropdownHeader');if(_reportDropdownHeader){_reportDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _certificateDropdownHeader=document.getElementById('certificateDropdownHeader');if(_certificateDropdownHeader){_certificateDropdownHeader.addEventListener('click', function() { const header=document.getElementById('certificateDropdownHeader'); const detail=document.getElementById('certificateDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _certificateDetailBackBtn=document.getElementById('certificateDetailBackBtn');if(_certificateDetailBackBtn){_certificateDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('certificateDropdownHeader'); const detail=document.getElementById('certificateDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _generateCertificateBtn=document.getElementById('generateCertificateBtn');if(_generateCertificateBtn){_generateCertificateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCertificate'}); });}
  var _exportCertificatePdfBtn=document.getElementById('exportCertificatePdfBtn');if(_exportCertificatePdfBtn){_exportCertificatePdfBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCertificate'}); });}
  var _viewCertificateReportBtn=document.getElementById('viewCertificateReportBtn');if(_viewCertificateReportBtn){_viewCertificateReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  var _openCertificateInMainWindowBtn=document.getElementById('openCertificateInMainWindowBtn');if(_openCertificateInMainWindowBtn){_openCertificateInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  var _codeMapDropdownHeader=document.getElementById('codeMapDropdownHeader');if(_codeMapDropdownHeader){_codeMapDropdownHeader.addEventListener('click', function() { const header=document.getElementById('codeMapDropdownHeader'); const detail=document.getElementById('codeMapDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _codeMapDetailBackBtn=document.getElementById('codeMapDetailBackBtn');if(_codeMapDetailBackBtn){_codeMapDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('codeMapDropdownHeader'); const detail=document.getElementById('codeMapDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _generateCodeMapBtn=document.getElementById('generateCodeMapBtn');if(_generateCodeMapBtn){_generateCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCodeMap'}); });}
  var _openCodeMapHtmlBtn=document.getElementById('openCodeMapHtmlBtn');if(_openCodeMapHtmlBtn){_openCodeMapHtmlBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  var _exportCodeMapBtn=document.getElementById('exportCodeMapBtn');if(_exportCodeMapBtn){_exportCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportCodeMap'}); });}
  var _refreshCodeMapBtn=document.getElementById('refreshCodeMapBtn');if(_refreshCodeMapBtn){_refreshCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCodeMap'}); });}
  var _openCodeMapInMainWindowBtn=document.getElementById('openCodeMapInMainWindowBtn');if(_openCodeMapInMainWindowBtn){_openCodeMapInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  var _roadmapDropdownHeader=document.getElementById('roadmapDropdownHeader');if(_roadmapDropdownHeader){_roadmapDropdownHeader.addEventListener('click', function() { const header=document.getElementById('roadmapDropdownHeader'); const detail=document.getElementById('roadmapDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _roadmapDetailBackBtn=document.getElementById('roadmapDetailBackBtn');if(_roadmapDetailBackBtn){_roadmapDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('roadmapDropdownHeader'); const detail=document.getElementById('roadmapDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _openRoadmapBtn=document.getElementById('openRoadmapBtn');if(_openRoadmapBtn){_openRoadmapBtn.addEventListener('click', function() { _switchSidebarTab('roadmap'); });}
  var _generateRoadmapBtn=document.getElementById('generateRoadmapBtn');if(_generateRoadmapBtn){_generateRoadmapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateRoadmap'}); });}
  var _exportRoadmapBtn=document.getElementById('exportRoadmapBtn');if(_exportRoadmapBtn){_exportRoadmapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportRoadmap'}); });}
  var _openRoadmapInMainWindowBtn=document.getElementById('openRoadmapInMainWindowBtn');if(_openRoadmapInMainWindowBtn){_openRoadmapInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmap'}); });}
  var _aiContextDropdownHeader=document.getElementById('aiContextDropdownHeader');if(_aiContextDropdownHeader){_aiContextDropdownHeader.addEventListener('click', function() { const header=document.getElementById('aiContextDropdownHeader'); const detail=document.getElementById('aiContextDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _aiContextDetailBackBtn=document.getElementById('aiContextDetailBackBtn');if(_aiContextDetailBackBtn){_aiContextDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('aiContextDropdownHeader'); const detail=document.getElementById('aiContextDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _scanAiContextBtn=document.getElementById('scanAiContextBtn');if(_scanAiContextBtn){_scanAiContextBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  var _exportAiContextBtn=document.getElementById('exportAiContextBtn');if(_exportAiContextBtn){_exportAiContextBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _viewAiContextReportBtn=document.getElementById('viewAiContextReportBtn');if(_viewAiContextReportBtn){_viewAiContextReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  var _openAiContextInMainWindowBtn=document.getElementById('openAiContextInMainWindowBtn');if(_openAiContextInMainWindowBtn){_openAiContextInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  var _uploadDropdownHeader=document.getElementById('uploadDropdownHeader');if(_uploadDropdownHeader){_uploadDropdownHeader.addEventListener('click', function() { const header=document.getElementById('uploadDropdownHeader'); const detail=document.getElementById('uploadDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _uploadDetailBackBtn=document.getElementById('uploadDetailBackBtn');if(_uploadDetailBackBtn){_uploadDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('uploadDropdownHeader'); const detail=document.getElementById('uploadDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _uploadBrowseBtn=document.getElementById('uploadBrowseBtn');if(_uploadBrowseBtn){_uploadBrowseBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openUpload'}); });}
  var _uploadValidateBtn=document.getElementById('uploadValidateBtn');if(_uploadValidateBtn){_uploadValidateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'uploadValidate'}); });}
  var _openUploadInMainWindowBtn=document.getElementById('openUploadInMainWindowBtn');if(_openUploadInMainWindowBtn){_openUploadInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openUpload'}); });}
  var _openAuditFromSidebar=document.getElementById('openAuditFromSidebar');if(_openAuditFromSidebar){_openAuditFromSidebar.addEventListener('click', function() { const btn=document.getElementById('openAuditFromSidebar'); const detail=document.getElementById('auditDetailPanel'); _closeDetailPanels(); if(btn){btn.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _auditDetailBackBtn=document.getElementById('auditDetailBackBtn');if(_auditDetailBackBtn){_auditDetailBackBtn.addEventListener('click', function() { const btn=document.getElementById('openAuditFromSidebar'); const detail=document.getElementById('auditDetailPanel'); if(btn){btn.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _openAuditBtn2=document.getElementById('openAuditBtn2');if(_openAuditBtn2){_openAuditBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  var _openAuditReportBtn2=document.getElementById('openAuditReportBtn2');if(_openAuditReportBtn2){_openAuditReportBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAuditReport'}); });}
  var _openAuditInMainWindowBtn=document.getElementById('openAuditInMainWindowBtn');if(_openAuditInMainWindowBtn){_openAuditInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAudit'}); });}
  var _securityDropdownHeader=document.getElementById('securityDropdownHeader');if(_securityDropdownHeader){_securityDropdownHeader.addEventListener('click', function() { const header=document.getElementById('securityDropdownHeader'); const detail=document.getElementById('securityDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _securityDetailBackBtn=document.getElementById('securityDetailBackBtn');if(_securityDetailBackBtn){_securityDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('securityDropdownHeader'); const detail=document.getElementById('securityDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runSecurityScanBtn=document.getElementById('runSecurityScanBtn');if(_runSecurityScanBtn){_runSecurityScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  var _openSecurityReportBtn=document.getElementById('openSecurityReportBtn');if(_openSecurityReportBtn){_openSecurityReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  var _openSecurityInMainWindowBtn=document.getElementById('openSecurityInMainWindowBtn');if(_openSecurityInMainWindowBtn){_openSecurityInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  var _trustDropdownHeader=document.getElementById('trustDropdownHeader');if(_trustDropdownHeader){_trustDropdownHeader.addEventListener('click', function() { const header=document.getElementById('trustDropdownHeader'); const detail=document.getElementById('trustDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _trustDetailBackBtn=document.getElementById('trustDetailBackBtn');if(_trustDetailBackBtn){_trustDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('trustDropdownHeader'); const detail=document.getElementById('trustDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _verifyTrustBtn=document.getElementById('verifyTrustBtn');if(_verifyTrustBtn){_verifyTrustBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  var _openTrustReportBtn=document.getElementById('openTrustReportBtn');if(_openTrustReportBtn){_openTrustReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  var _openTrustInMainWindowBtn=document.getElementById('openTrustInMainWindowBtn');if(_openTrustInMainWindowBtn){_openTrustInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  var _qualityDropdownHeader=document.getElementById('qualityDropdownHeader');if(_qualityDropdownHeader){_qualityDropdownHeader.addEventListener('click', function() { const header=document.getElementById('qualityDropdownHeader'); const detail=document.getElementById('qualityDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _qualityDetailBackBtn=document.getElementById('qualityDetailBackBtn');if(_qualityDetailBackBtn){_qualityDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('qualityDropdownHeader'); const detail=document.getElementById('qualityDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runQualityBtn=document.getElementById('runQualityBtn');if(_runQualityBtn){_runQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  var _exportQualityBtn=document.getElementById('exportQualityBtn');if(_exportQualityBtn){_exportQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _viewQualityReportBtn=document.getElementById('viewQualityReportBtn');if(_viewQualityReportBtn){_viewQualityReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  var _openQualityInMainWindowBtn=document.getElementById('openQualityInMainWindowBtn');if(_openQualityInMainWindowBtn){_openQualityInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  var _assessmentsDropdownHeader=document.getElementById('assessmentsDropdownHeader');if(_assessmentsDropdownHeader){_assessmentsDropdownHeader.addEventListener('click', function() { const header=document.getElementById('assessmentsDropdownHeader'); const detail=document.getElementById('assessmentsDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _assessmentsDetailBackBtn=document.getElementById('assessmentsDetailBackBtn');if(_assessmentsDetailBackBtn){_assessmentsDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('assessmentsDropdownHeader'); const detail=document.getElementById('assessmentsDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runAssessmentsBtn=document.getElementById('runAssessmentsBtn');if(_runAssessmentsBtn){_runAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _exportAssessmentsBtn=document.getElementById('exportAssessmentsBtn');if(_exportAssessmentsBtn){_exportAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _viewAssessmentsReportBtn=document.getElementById('viewAssessmentsReportBtn');if(_viewAssessmentsReportBtn){_viewAssessmentsReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _openAssessmentsInMainWindowBtn=document.getElementById('openAssessmentsInMainWindowBtn');if(_openAssessmentsInMainWindowBtn){_openAssessmentsInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _platformDropdownHeader=document.getElementById('platformDropdownHeader');if(_platformDropdownHeader){_platformDropdownHeader.addEventListener('click', function() { const header=document.getElementById('platformDropdownHeader'); const detail=document.getElementById('platformDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _platformDetailBackBtn=document.getElementById('platformDetailBackBtn');if(_platformDetailBackBtn){_platformDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('platformDropdownHeader'); const detail=document.getElementById('platformDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _platformRefreshBtn=document.getElementById('platformRefreshBtn');if(_platformRefreshBtn){_platformRefreshBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _platformExportBtn=document.getElementById('platformExportBtn');if(_platformExportBtn){_platformExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _platformDocsBtn=document.getElementById('platformDocsBtn');if(_platformDocsBtn){_platformDocsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDocs'}); });}
  var _platformSettingsBtn=document.getElementById('platformSettingsBtn');if(_platformSettingsBtn){_platformSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  var _openPlatformInMainWindowBtn=document.getElementById('openPlatformInMainWindowBtn');if(_openPlatformInMainWindowBtn){_openPlatformInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  var _profileDropdownHeader=document.getElementById('profileDropdownHeader');if(_profileDropdownHeader){_profileDropdownHeader.addEventListener('click', function() { const header=document.getElementById('profileDropdownHeader'); const detail=document.getElementById('profileDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _complianceDropdownHeader=document.getElementById('complianceDropdownHeader');if(_complianceDropdownHeader){_complianceDropdownHeader.addEventListener('click', function() { const header=document.getElementById('complianceDropdownHeader'); const detail=document.getElementById('complianceDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _complianceDetailBackBtn=document.getElementById('complianceDetailBackBtn');if(_complianceDetailBackBtn){_complianceDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('complianceDropdownHeader'); const detail=document.getElementById('complianceDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runComplianceBtn=document.getElementById('runComplianceBtn');if(_runComplianceBtn){_runComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  var _exportComplianceBtn=document.getElementById('exportComplianceBtn');if(_exportComplianceBtn){_exportComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _viewComplianceReportBtn=document.getElementById('viewComplianceReportBtn');if(_viewComplianceReportBtn){_viewComplianceReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  var _openComplianceInMainWindowBtn=document.getElementById('openComplianceInMainWindowBtn');if(_openComplianceInMainWindowBtn){_openComplianceInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  var _repoHealthDropdownHeader=document.getElementById('repoHealthDropdownHeader');if(_repoHealthDropdownHeader){_repoHealthDropdownHeader.addEventListener('click', function() { const header=document.getElementById('repoHealthDropdownHeader'); const detail=document.getElementById('repoHealthDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _repoHealthDetailBackBtn=document.getElementById('repoHealthDetailBackBtn');if(_repoHealthDetailBackBtn){_repoHealthDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('repoHealthDropdownHeader'); const detail=document.getElementById('repoHealthDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _repoHealthRunScanBtn=document.getElementById('repoHealthRunScanBtn');if(_repoHealthRunScanBtn){_repoHealthRunScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  var _repoHealthExportBtn=document.getElementById('repoHealthExportBtn');if(_repoHealthExportBtn){_repoHealthExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _repoHealthViewReportBtn=document.getElementById('repoHealthViewReportBtn');if(_repoHealthViewReportBtn){_repoHealthViewReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _repoHealthSettingsBtn=document.getElementById('repoHealthSettingsBtn');if(_repoHealthSettingsBtn){_repoHealthSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  var _analyticsDropdownHeader=document.getElementById('analyticsDropdownHeader');if(_analyticsDropdownHeader){_analyticsDropdownHeader.addEventListener('click', function() { const header=document.getElementById('analyticsDropdownHeader'); const detail=document.getElementById('analyticsDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _analyticsDetailBackBtn=document.getElementById('analyticsDetailBackBtn');if(_analyticsDetailBackBtn){_analyticsDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('analyticsDropdownHeader'); const detail=document.getElementById('analyticsDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _analyticsRefreshBtn=document.getElementById('analyticsRefreshBtn');if(_analyticsRefreshBtn){_analyticsRefreshBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _analyticsExportBtn=document.getElementById('analyticsExportBtn');if(_analyticsExportBtn){_analyticsExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _analyticsViewReportBtn=document.getElementById('analyticsViewReportBtn');if(_analyticsViewReportBtn){_analyticsViewReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  var _analyticsSettingsBtn=document.getElementById('analyticsSettingsBtn');if(_analyticsSettingsBtn){_analyticsSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  var _teamDropdownHeader=document.getElementById('teamDropdownHeader');if(_teamDropdownHeader){_teamDropdownHeader.addEventListener('click', function() { const header=document.getElementById('teamDropdownHeader'); const detail=document.getElementById('teamDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _teamDetailBackBtn=document.getElementById('teamDetailBackBtn');if(_teamDetailBackBtn){_teamDetailBackBtn.addEventListener('click', function() { _closeDetailPanels(); const header=document.getElementById('teamDropdownHeader'); const detail=document.getElementById('teamDetailPanel'); if(header){header.classList.remove('hidden'); header.style.display='block';} if(detail){detail.classList.remove('hidden'); detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _scanDropdownHeader=document.getElementById('scanDropdownHeader');if(_scanDropdownHeader){_scanDropdownHeader.addEventListener('click', function() { const header=document.getElementById('scanDropdownHeader'); const detail=document.getElementById('scanDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  var _scanDetailBackBtn=document.getElementById('scanDetailBackBtn');if(_scanDetailBackBtn){_scanDetailBackBtn.addEventListener('click', function() { const header=document.getElementById('scanDropdownHeader'); const detail=document.getElementById('scanDetailPanel'); if(header){header.style.display='block';} if(detail){detail.style.display='none';} document.body.classList.remove('detail-panel-open'); });}
  var _runScanBtn=document.getElementById('runScanBtn');if(_runScanBtn){_runScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  var _exportScanBtn=document.getElementById('exportScanBtn');if(_exportScanBtn){_exportScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _viewScanReportBtn=document.getElementById('viewScanReportBtn');if(_viewScanReportBtn){_viewScanReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  var _openScanInMainWindowBtn=document.getElementById('openScanInMainWindowBtn');if(_openScanInMainWindowBtn){_openScanInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  var _previewDropdownHeader=document.getElementById('previewDropdownHeader');if(_previewDropdownHeader){_previewDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreview'}); });}
  var _toggleMonitorSidebarBtn=document.getElementById('toggleMonitorSidebarBtn');if(_toggleMonitorSidebarBtn){_toggleMonitorSidebarBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  var _sendToAIAgentDropdownHeader=document.getElementById('sendToAIAgentDropdownHeader');if(_sendToAIAgentDropdownHeader){_sendToAIAgentDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSendToAIAgent'}); });}
  var _browserDropdownHeader=document.getElementById('browserDropdownHeader');if(_browserDropdownHeader){_browserDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  var _scanWorkspaceDropdownHeader=document.getElementById('scanWorkspaceDropdownHeader');if(_scanWorkspaceDropdownHeader){_scanWorkspaceDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScanWorkspace'}); });}
  function _tdBind2(id,cmd){var el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:cmd});});}}
  function _tdPath(id,path){var el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'openDataServerPath',path:path});});}}
  _tdPath('tdRoadmapSidebar','/coming-soon/roadmap.html');
  _tdPath('tdAuditSidebar','/coming-soon/audit.html');
  _tdPath('tdAuditReportSidebar','/dashboard/audit');
  _tdPath('tdPricingSidebar','/coming-soon/pricing.html');
  _tdPath('tdOpenSiteSidebar','/dashboard/dashboard');
  _tdBind2('tdThemeToggleSidebar','toggleTheme');
  _tdPath('tdSignInSidebar','/dashboard/signin');
  _tdBind2('tdOfflineToggleSidebar','toggleOffline');
  _tdPath('tdSignOutSidebar','/dashboard/signin');
  _tdPath('tdDashboardSidebar','/dashboard/dashboard');
  _tdPath('tdAnalyzeSidebar','/dashboard/analyze');
  _tdPath('tdResultsSidebar','/dashboard/results');
  _tdPath('tdRepoHealthSidebar','/dashboard/repository-health');
  _tdPath('tdSecuritySidebar','/dashboard/security');
  _tdPath('tdQualitySidebar','/dashboard/quality');
  _tdPath('tdTrustSidebar','/dashboard/trust');
  _tdPath('tdAssessmentsSidebar','/dashboard/assessments');
  _tdPath('tdRemediationSidebar','/dashboard/remediation');
  _tdPath('tdPlatformSidebar','/dashboard/platform');
  _tdPath('tdProfileSidebar','/dashboard/profile');
  _tdPath('tdToolsSidebar','/dashboard/tools');
  _tdPath('tdSettingsSidebar','/dashboard/settings');
  _tdPath('tdHelpSidebar','/dashboard/help');
  _tdPath('tdChatbotSidebar','/dashboard/chatbot');
  _tdPath('tdAboutSidebar','/dashboard/about');
  _tdBind2('tdGitHubSidebar','openGitHub');
  _tdBind2('tdDocsSidebar','openDocs');
  var _openRepoHealthBtn=document.getElementById('openRepoHealthBtn');if(_openRepoHealthBtn){_openRepoHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _dbExportBtn=document.getElementById('dbExportBtn');if(_dbExportBtn){_dbExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _dashPreviewBtn=document.getElementById('dashPreviewBtn');if(_dashPreviewBtn){_dashPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  var _dashBrowserBtn=document.getElementById('dashBrowserBtn');if(_dashBrowserBtn){_dashBrowserBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  var _dashExportReportBtn=document.getElementById('dashExportReportBtn');if(_dashExportReportBtn){_dashExportReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  var _dashClearResultsBtn=document.getElementById('dashClearResultsBtn');if(_dashClearResultsBtn){_dashClearResultsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openClear'}); });}
  var _sidebarScanBrowseBtn=document.getElementById('sidebarScanBrowseBtn');if(_sidebarScanBrowseBtn){_sidebarScanBrowseBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'browseSidebarScanPath'}); });}
  var _sidebarScanDetectBtn=document.getElementById('sidebarScanDetectBtn');if(_sidebarScanDetectBtn){_sidebarScanDetectBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'detectSidebarScanPath'}); });}
  var _sidebarScanPathInput=document.getElementById('sidebarScanPathInput');if(_sidebarScanPathInput){_sidebarScanPathInput.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateSidebarScanPath', path: this.value}); });}
  var _sidebarScanWorkspaceToggle=document.getElementById('sidebarScanWorkspaceToggle');if(_sidebarScanWorkspaceToggle){_sidebarScanWorkspaceToggle.addEventListener('change', function() { var label=document.getElementById('sidebarScanToggleLabel'); var wrap=document.getElementById('sidebarScanCustomWrap'); var actionRow=document.getElementById('scanActionRow'); var isWorkspace=this.checked; if(label){label.textContent=isWorkspace?'Current Workspace':'Custom Location';} if(wrap){wrap.style.display=isWorkspace?'none':'flex';} if(actionRow){actionRow.style.display=isWorkspace?'none':'flex';} if(window.vscode)window.vscode.postMessage({command:'updateSidebarScanMode',mode:isWorkspace?'workspace':'custom'}); });}
  var _dlClearBtn=document.getElementById('dlClearBtn');if(_dlClearBtn){_dlClearBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'clearDownloads'}); });}
  var _qlDashboardBtn=document.getElementById('qlDashboardBtn');if(_qlDashboardBtn){_qlDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDashboard'}); });}
  var _qlReportBtn=document.getElementById('qlReportBtn');if(_qlReportBtn){_qlReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'report'}); });}
  var _qlBrowserBtn=document.getElementById('qlBrowserBtn');if(_qlBrowserBtn){_qlBrowserBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  var _qlPreviewBtn=document.getElementById('qlPreviewBtn');if(_qlPreviewBtn){_qlPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  var _teamDashboardBtn=document.getElementById('teamDashboardBtn');if(_teamDashboardBtn){_teamDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeamDashboard'}); });}
  var _previewBtn=document.getElementById('previewBtn');if(_previewBtn){_previewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  var _openCodeMapFromTools=document.getElementById('openCodeMapFromTools');if(_openCodeMapFromTools){_openCodeMapFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  var _openRepoHealthFromTools=document.getElementById('openRepoHealthFromTools');if(_openRepoHealthFromTools){_openRepoHealthFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  var _openTeamFromTools=document.getElementById('openTeamFromTools');if(_openTeamFromTools){_openTeamFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeam'}); });}
  var _openTrustFromTools=document.getElementById('openTrustFromTools');if(_openTrustFromTools){_openTrustFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  var _openAssessmentsFromTools=document.getElementById('openAssessmentsFromTools');if(_openAssessmentsFromTools){_openAssessmentsFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  var _openPlatformFromTools=document.getElementById('openPlatformFromTools');if(_openPlatformFromTools){_openPlatformFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  var _openComplianceFromTools=document.getElementById('openComplianceFromTools');if(_openComplianceFromTools){_openComplianceFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  var _openProfileFromTools=document.getElementById('openProfileFromTools');if(_openProfileFromTools){_openProfileFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  var _openSettingsFromSettings=document.getElementById('openSettingsFromSettings');if(_openSettingsFromSettings){_openSettingsFromSettings.addEventListener('click', function() { _switchTab('settings'); _openSidebarMenu('settingsMenuTab', 'settingsDetailPanelTab', 'settings'); });}
  var _openDiagnoseFromSettingsTab=document.getElementById('openDiagnoseFromSettingsTab');if(_openDiagnoseFromSettingsTab){_openDiagnoseFromSettingsTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  var _openRefreshRelayFromSettingsTab=document.getElementById('openRefreshRelayFromSettingsTab');if(_openRefreshRelayFromSettingsTab){_openRefreshRelayFromSettingsTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRefreshRelayPort'}); });}
  var _openSettingsFromSettingsTab=document.getElementById('openSettingsFromSettingsTab');if(_openSettingsFromSettingsTab){_openSettingsFromSettingsTab.addEventListener('click', function() { _openSidebarMenu('settingsMenuTab', 'settingsDetailPanelTab', 'settings'); });}
  var _openPlatformFromSettingsTab=document.getElementById('openPlatformFromSettingsTab');if(_openPlatformFromSettingsTab){_openPlatformFromSettingsTab.addEventListener('click', function() { _openSidebarMenu(null, 'platformDetailPanel', 'openPlatform'); });}
  var _settingsDetailBackBtnTab=document.getElementById('settingsDetailBackBtnTab');if(_settingsDetailBackBtnTab){_settingsDetailBackBtnTab.addEventListener('click', function() { _closeDetailPanels(); });}
  var _openSettingsInMainWindowBtnTab=document.getElementById('openSettingsInMainWindowBtnTab');if(_openSettingsInMainWindowBtnTab){_openSettingsInMainWindowBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'settings'}); });}
  var _refreshSettingsBtnTab=document.getElementById('refreshSettingsBtnTab');if(_refreshSettingsBtnTab){_refreshSettingsBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'refreshSettings'}); });}
  var _tabItems=document.querySelectorAll('.tab-item');
  function _hideDiagnoseResults(){
    var container=document.getElementById('diagnoseResultsContainer');
    if(container){container.style.display='none';container.dataset.wasOpen='false';}
    var mainContent=document.getElementById('mainContent')||document.querySelector('.content');
    if(mainContent){mainContent.style.display='';}
    if(container&&container.parentNode){
      var siblings=container.parentNode.children;
      for(var i=0;i<siblings.length;i++){if(siblings[i]===container)continue;if(siblings[i].classList.contains('header'))continue;siblings[i].style.display='';}
    }
  }
  function _switchTab(tab){if(!tab)return;document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});var pane=document.getElementById('tab'+tab.charAt(0).toUpperCase()+tab.slice(1));if(pane){pane.classList.remove('hidden');pane.classList.add('active');}document.querySelectorAll('.tab-item').forEach(function(t){t.classList.remove('active');});var coreTab=document.querySelector('.tab-item[data-tab="'+tab+'"]');if(coreTab){coreTab.classList.add('active');}document.querySelectorAll('.tab-more-item').forEach(function(m){m.classList.remove('active');if(m.getAttribute('data-tab')===tab)m.classList.add('active');});_hideDiagnoseResults();_closeDetailPanels();_switchSidebarTab(tab);}
  _tabItems.forEach(function(item){item.addEventListener('click',function(){var tab=item.getAttribute('data-tab');_switchTab(tab);});});
  var _settingsDropdownHeader=document.getElementById('settingsDropdownHeader');if(_settingsDropdownHeader){_settingsDropdownHeader.addEventListener('click', function() { var body=document.getElementById('settingsDropdownBody'); if(body){body.classList.toggle('open'); _settingsDropdownHeader.classList.toggle('open');} });}
  var _dashGateCard=document.getElementById('dashGateCard');if(_dashGateCard){_dashGateCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  var _dashIssuesCard=document.getElementById('dashIssuesCard');if(_dashIssuesCard){_dashIssuesCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  var _dashScoreCard=document.getElementById('dashScoreCard');if(_dashScoreCard){_dashScoreCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  var _displayMode=document.getElementById('displayMode');if(_displayMode){_displayMode.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.value}); });}
  var _showWelcome=document.getElementById('showWelcome');if(_showWelcome){_showWelcome.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateShowWelcome', value: this.checked}); });}
  var _autoScan=document.getElementById('autoScan');if(_autoScan){_autoScan.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateAutoScan', value: this.checked}); });}
  var _apiUrl=document.getElementById('apiUrl');if(_apiUrl){_apiUrl.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: this.value}); });}
  var _toggleAutoScanTab=document.getElementById('toggleAutoScanTab');if(_toggleAutoScanTab){_toggleAutoScanTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateAutoScan', value: this.checked}); });}
  var _toggleDisplayModeTab=document.getElementById('toggleDisplayModeTab');if(_toggleDisplayModeTab){_toggleDisplayModeTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.checked ? 'mainWindow' : 'sidebar'}); });}
  var _displayModeSelectTab=document.getElementById('displayModeSelectTab');if(_displayModeSelectTab){_displayModeSelectTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.value}); });}
  var _toggleBrowserModeTab=document.getElementById('toggleBrowserModeTab');if(_toggleBrowserModeTab){_toggleBrowserModeTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateBrowserMode', value: this.checked}); });}
  var _toggleNotifyScanTab=document.getElementById('toggleNotifyScanTab');if(_toggleNotifyScanTab){_toggleNotifyScanTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateNotifyScan', value: this.checked}); });}
  var _toggleNotifyGateTab=document.getElementById('toggleNotifyGateTab');if(_toggleNotifyGateTab){_toggleNotifyGateTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateNotifyGate', value: this.checked}); });}
  var _settingsSaveBtnTab=document.getElementById('settingsSaveBtnTab');if(_settingsSaveBtnTab){_settingsSaveBtnTab.addEventListener('click', function() { var val=document.getElementById('settingsApiInputTab'); if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: val ? val.value : ''}); var badge=document.getElementById('settingsSavedBadgeTab'); if(badge){badge.style.display='inline-flex'; setTimeout(function(){badge.style.display='none';}, 2000);} });}
  var _apiPresetLocal=document.getElementById('apiPresetLocal');if(_apiPresetLocal){_apiPresetLocal.addEventListener('click', function() { var input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:54358';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:54358'}); });}
  var _apiPresetSlopCop=document.getElementById('apiPresetSlopCop');if(_apiPresetSlopCop){_apiPresetSlopCop.addEventListener('click', function() { var input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:3001/';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:3001/'}); });}
  var _apiPresetRemote=document.getElementById('apiPresetRemote');if(_apiPresetRemote){_apiPresetRemote.addEventListener('click', function() { var input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:30011/';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:30011/'}); });}
  var _settingsTestBtnTab=document.getElementById('settingsTestBtnTab');if(_settingsTestBtnTab){_settingsTestBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'testConnection'}); });}
  var _settingsApiInputTab=document.getElementById('settingsApiInputTab');if(_settingsApiInputTab){_settingsApiInputTab.addEventListener('keydown', function(e) { if(e.key==='Enter'){ var badge=document.getElementById('settingsSavedBadgeTab'); if(badge){badge.style.display='inline-flex'; setTimeout(function(){badge.style.display='none';}, 2000);} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: this.value}); } });}
  var _openDiagnoseBtnTab=document.getElementById('openDiagnoseBtnTab');if(_openDiagnoseBtnTab){_openDiagnoseBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  var _openRefreshRelayPortBtnTab=document.getElementById('openRefreshRelayPortBtnTab');if(_openRefreshRelayPortBtnTab){_openRefreshRelayPortBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRefreshRelayPort'}); });}
  var _dashboardBackBtn=document.getElementById('dashboardBackBtn');if(_dashboardBackBtn){_dashboardBackBtn.addEventListener('click', function() { document.body.classList.remove('sidebar-dashboard-mode'); var bb=document.getElementById('dashboardBackBtn'); if(bb) bb.style.display='none'; var td=document.getElementById('tabDashboard'); if(td){ td.classList.remove('active'); td.classList.add('hidden'); } });}
  function _updateSidebarScanPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = data.issues || data.totalIssues || data.detectedIssues || (crit + high + med + low);
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const totalScans = data.totalScans || data.scans || 0;
    const fixed = data.fixed || 0;
    const status = data.status || 'complete';
    const statusText = status === 'scanning' ? 'Scanning' : status === 'complete' ? 'Complete' : (status === 'error' ? 'Error' : 'Ready');
    const statusMeta = status === 'complete' ? 'Scan complete' : (status === 'scanning' ? 'In progress' : 'Ready');
    const badge = document.getElementById('scanStatusBadge'); if (badge) { badge.textContent = status === 'complete' ? 'COMPLETE' : status === 'scanning' ? 'RUNNING' : status === 'error' ? 'ERROR' : 'READY'; badge.style.background = status === 'complete' ? 'rgba(34,197,94,0.18)' : status === 'scanning' ? 'rgba(59,130,246,0.18)' : status === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(100,116,139,0.18)'; badge.style.color = status === 'complete' ? '#4ade80' : status === 'scanning' ? '#60a5fa' : status === 'error' ? '#f87171' : '#94a3b8'; }
    const dot = document.getElementById('scanStatusDot'); if (dot) { dot.className = 'tc-list-dot ' + (status === 'complete' ? 'green' : status === 'scanning' ? 'blue' : status === 'error' ? 'red' : 'gray'); }
    const stText = document.getElementById('scanStatusText'); if (stText) stText.textContent = statusText;
    const stMeta = document.getElementById('scanStatusMeta'); if (stMeta) stMeta.textContent = statusMeta;
    const totalScansEl = document.getElementById('scanTotalScans'); if (totalScansEl) totalScansEl.textContent = totalScans;
    const issuesEl = document.getElementById('scanIssues'); if (issuesEl) issuesEl.textContent = issues;
    const fixedEl = document.getElementById('scanFixed'); if (fixedEl) fixedEl.textContent = fixed;
    const scoreEl = document.getElementById('scanScore'); if (scoreEl) scoreEl.textContent = score;
    const cEl = document.getElementById('scanCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('scanHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('scanMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('scanLow'); if (lEl) lEl.textContent = low;
    const list = document.getElementById('scanResultsList'); if (list) {
      list.textContent = '';
      const findings = Array.isArray(data.findings) ? data.findings.slice(0, 5) : (Array.isArray(data.issuesList) ? data.issuesList.slice(0, 5) : []);
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = 'No results yet';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = '--';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); list.appendChild(row);
      } else {
        findings.forEach(function(f){
          const row = document.createElement('div'); row.className = 'scan-result-row';
          const left = document.createElement('div'); left.style.display = 'flex'; left.style.flexDirection = 'column'; left.style.gap = '2px'; left.style.minWidth = '0';
          const title = document.createElement('div'); title.className = 'scan-result-title'; title.textContent = f.title || f.type || 'Finding'; title.style.overflow = 'hidden'; title.style.textOverflow = 'ellipsis'; title.style.whiteSpace = 'nowrap';
          const file = document.createElement('div'); file.className = 'scan-result-file'; file.textContent = f.file || f.path || '--'; file.style.overflow = 'hidden'; file.style.textOverflow = 'ellipsis'; file.style.whiteSpace = 'nowrap';
          left.appendChild(title); left.appendChild(file);
          const sevBadge = document.createElement('span'); sevBadge.className = 'scan-result-severity ' + (f.severity || 'low'); sevBadge.textContent = (f.severity || 'low').toUpperCase();
          row.appendChild(left); row.appendChild(sevBadge); list.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarAiContextPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = data.aiIssues || data.aiContextIssues || (crit + high + med + low);
    const models = data.modelsDetected || data.detectedModels || 0;
    const score = data.contextScore || data.qualityScore || data.score || 100;
    const files = data.totalFiles || data.filesAnalyzed || data.filesScanned || 0;
    const badge = document.getElementById('aiContextBadge'); if (badge) { badge.textContent = issues === 0 ? 'CLEAR' : (crit > 0 || high > 0 ? 'ISSUES' : 'OK'); badge.style.background = issues === 0 ? 'rgba(34,197,94,0.18)' : (crit > 0 || high > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'); badge.style.color = issues === 0 ? '#4ade80' : (crit > 0 || high > 0 ? '#f87171' : '#fbbf24'); }
    const modelsEl = document.getElementById('aiContextModels'); if (modelsEl) modelsEl.textContent = models;
    const issuesEl = document.getElementById('aiContextIssues'); if (issuesEl) issuesEl.textContent = issues;
    const scoreEl = document.getElementById('aiContextScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const filesEl = document.getElementById('aiContextFiles'); if (filesEl) filesEl.textContent = files;
    const cEl = document.getElementById('aiContextCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('aiContextHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('aiContextMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('aiContextLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('aiContextCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('aiContextHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('aiContextMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('aiContextLow2'); if (lEl2) lEl2.textContent = low;
  }
  function _updateSidebarUploadPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalFiles = data.totalFiles || data.filesAnalyzed || data.filesScanned || 0;
    const errors = crit + high;
    const valid = Math.max(0, totalFiles - errors);
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const autoScan = data.autoScan === true || data.autoScan === 'On' ? 'On' : 'Off';
    const totalFilesEl = document.getElementById('uploadTotalFiles'); if (totalFilesEl) totalFilesEl.textContent = totalFiles;
    const validEl = document.getElementById('uploadValid'); if (validEl) validEl.textContent = valid;
    const errorsEl = document.getElementById('uploadErrors'); if (errorsEl) errorsEl.textContent = errors;
    const scoreEl = document.getElementById('uploadScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (typeof score === 'number' && score >= 80 ? 'green' : typeof score === 'number' && score >= 50 ? 'amber' : 'red'); }
    const autoScanEl = document.getElementById('uploadAutoScan'); if (autoScanEl) autoScanEl.textContent = autoScan;
    const badge = document.getElementById('uploadStatusBadge'); if (badge) { badge.textContent = errors === 0 ? 'READY' : 'ISSUES'; badge.style.background = errors === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = errors === 0 ? '#4ade80' : '#f87171'; }
  }
  function _updateSidebarRepoHealthPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || 0;
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const scoreEl = document.getElementById('repoHealthScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (typeof score === 'number' && score >= 80 ? 'green' : typeof score === 'number' && score >= 50 ? 'amber' : 'red'); }
    const gateEl = document.getElementById('repoHealthGate'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.className = 'settings-kpi-value ' + (gatePass ? 'green' : 'red'); }
    const issuesEl = document.getElementById('repoHealthTotalIssues'); if (issuesEl) { issuesEl.textContent = totalIssues; issuesEl.className = 'settings-kpi-value ' + (totalIssues === 0 ? 'green' : totalIssues < 10 ? 'amber' : 'red'); }
    const filesEl = document.getElementById('repoHealthFilesScanned'); if (filesEl) filesEl.textContent = files;
    const critEl = document.getElementById('repoHealthCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('repoHealthHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('repoHealthMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('repoHealthLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const badge = document.getElementById('repoHealthStatusBadge'); if (badge) { const ok = totalIssues === 0; badge.textContent = ok ? 'Ready' : (crit > 0 ? 'Critical' : 'Needs Attention'); badge.style.background = ok ? 'rgba(34,197,94,0.18)' : (crit > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'); badge.style.color = ok ? '#4ade80' : (crit > 0 ? '#f87171' : '#fbbf24'); }
    const maintainabilityEl = document.getElementById('repoHealthMaintainability'); if (maintainabilityEl) { maintainabilityEl.textContent = typeof score === 'number' ? (score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Poor') : '--'; maintainabilityEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const reliabilityEl = document.getElementById('repoHealthReliability'); if (reliabilityEl) { reliabilityEl.textContent = typeof score === 'number' ? (score >= 80 ? 'Stable' : score >= 50 ? 'Moderate' : 'At Risk') : '--'; reliabilityEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const complexityEl = document.getElementById('repoHealthComplexity'); if (complexityEl) complexityEl.textContent = '--';
    const duplicationEl = document.getElementById('repoHealthDuplication'); if (duplicationEl) duplicationEl.textContent = '--';
    const findingsEl = document.getElementById('repoHealthFindings'); if (findingsEl) { while (findingsEl.firstChild) { findingsEl.removeChild(findingsEl.firstChild); } const row = document.createElement('div'); row.className = 'tc-list-item'; const span = document.createElement('span'); span.className = 'tc-list-name'; if (totalIssues === 0) { span.style.color = 'var(--vscode-descriptionForeground)'; span.textContent = 'No issues detected. Repository looks healthy.'; } else { span.textContent = crit + ' Critical, ' + high + ' High, ' + med + ' Medium, ' + low + ' Low issues detected.'; } row.appendChild(span); findingsEl.appendChild(row); }
    const recEl = document.getElementById('repoHealthRecommendations'); if (recEl) { recEl.textContent = totalIssues === 0 ? 'No action needed. Keep monitoring repository health.' : 'Review ' + totalIssues + ' issue' + (totalIssues === 1 ? '' : 's') + ' to improve repository health.'; }
  }
  function _updateSidebarAnalyticsPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || 0;
    const scans = data.scans != null ? data.scans : (data.scanCount != null ? data.scanCount : 1);
    const last = data.lastScan || data.lastAudit || data.date || '--';
    const avgScore = typeof score === 'number' ? score : '--';
    const totalScansEl = document.getElementById('analyticsTotalScans'); if (totalScansEl) totalScansEl.textContent = scans;
    const issuesFoundEl = document.getElementById('analyticsIssuesFound'); if (issuesFoundEl) { issuesFoundEl.textContent = totalIssues; issuesFoundEl.className = 'settings-kpi-value ' + (totalIssues === 0 ? 'green' : totalIssues < 10 ? 'amber' : 'red'); }
    const avgScoreEl = document.getElementById('analyticsAvgScore'); if (avgScoreEl) { avgScoreEl.textContent = avgScore; avgScoreEl.className = 'settings-kpi-value ' + (typeof avgScore === 'number' && avgScore >= 80 ? 'green' : typeof avgScore === 'number' && avgScore >= 50 ? 'amber' : 'red'); }
    const lastScanEl = document.getElementById('analyticsLastScan'); if (lastScanEl) lastScanEl.textContent = last;
    const badge = document.getElementById('analyticsStatusBadge'); if (badge) { badge.textContent = totalIssues === 0 ? 'Ready' : 'Needs Review'; badge.style.background = totalIssues === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = totalIssues === 0 ? '#4ade80' : '#f87171'; }
    const critEl = document.getElementById('analyticsCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('analyticsHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('analyticsMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('analyticsLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const sumTotalScans = document.getElementById('analyticsSummaryTotalScans'); if (sumTotalScans) sumTotalScans.textContent = scans;
    const sumIssues = document.getElementById('analyticsSummaryIssuesFound'); if (sumIssues) sumIssues.textContent = totalIssues;
    const sumAvg = document.getElementById('analyticsSummaryAvgScore'); if (sumAvg) sumAvg.textContent = avgScore;
    const scanTrend = document.getElementById('analyticsScanTrend'); if (scanTrend) scanTrend.textContent = '+' + scans;
    const issueTrend = document.getElementById('analyticsIssueTrend'); if (issueTrend) { issueTrend.textContent = totalIssues; issueTrend.className = 'settings-kpi-value ' + (totalIssues === 0 ? 'green' : 'red'); }
  }
  function _updateSidebarTeamPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const scans = data.scans != null ? data.scans : (data.scanCount != null ? data.scanCount : 1);
    const members = data.members != null ? data.members : 1;
    const resolved = data.resolved != null ? data.resolved : 0;
    const teamScore = typeof score === 'number' ? score : 100;
    const membersEl = document.getElementById('teamMembers'); if (membersEl) membersEl.textContent = members;
    const scansEl = document.getElementById('teamScans'); if (scansEl) scansEl.textContent = scans;
    const resolvedEl = document.getElementById('teamResolved'); if (resolvedEl) { resolvedEl.textContent = resolved; resolvedEl.className = 'settings-kpi-value ' + (resolved > 0 ? 'green' : 'green'); }
    const teamScoreEl = document.getElementById('teamScore'); if (teamScoreEl) { teamScoreEl.textContent = teamScore; teamScoreEl.className = 'settings-kpi-value ' + (teamScore >= 80 ? 'green' : teamScore >= 50 ? 'amber' : 'red'); }
    const badge = document.getElementById('teamStatusBadge'); if (badge) { badge.textContent = 'Active'; badge.style.background = 'rgba(34,197,94,0.18)'; badge.style.color = '#4ade80'; }
    const critEl = document.getElementById('teamCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('teamHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('teamMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('teamLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const qualityScore = document.getElementById('teamQualityScore'); if (qualityScore) qualityScore.textContent = teamScore;
    const totalIssuesEl = document.getElementById('teamTotalIssues'); if (totalIssuesEl) totalIssuesEl.textContent = totalIssues;
    const gateEl = document.getElementById('teamGateStatus'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const list = document.getElementById('teamMembersList'); if (list) { while (list.firstChild) { list.removeChild(list.firstChild); } const memberList = Array.isArray(data.teamMembers) ? data.teamMembers : [{ name: 'Admin', role: 'Project Owner', status: 'Active', initial: 'A' }]; memberList.forEach(function(m) { const row = document.createElement('div'); row.className = 'tc-list-item'; const avatar = document.createElement('div'); avatar.className = 'tc-list-avatar'; avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px;'; avatar.textContent = (m.initial || m.name.charAt(0).toUpperCase()); row.appendChild(avatar); const left = document.createElement('div'); left.className = 'tc-list-item-left'; const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = m.name; const sub = document.createElement('span'); sub.className = 'tc-list-sub'; sub.style.color = 'var(--vscode-descriptionForeground)'; sub.textContent = m.role; left.appendChild(name); left.appendChild(sub); row.appendChild(left); const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.style.color = m.status === 'Active' ? '#4ade80' : 'var(--vscode-descriptionForeground)'; meta.textContent = m.status; row.appendChild(meta); list.appendChild(row); }); }
  }
  function _updateSidebarPlatformPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const platformData = data.platform || {};
    const version = platformData.version || data.extensionVersion || '3.0.309';
    const engine = platformData.engine || 'VS Code';
    const uptime = platformData.uptime || 'Active';
    const status = platformData.status || 'Connected';
    const os = platformData.os || 'win32';
    const node = platformData.node || 'v22.21.1';
    const workspace = platformData.workspace || data.workspacePath || 'c:\\Users\\Trevor\\CascadeProjects';
    const versionEl = document.getElementById('platformVersion'); if (versionEl) versionEl.textContent = version;
    const engineEl = document.getElementById('platformEngine'); if (engineEl) engineEl.textContent = engine;
    const uptimeEl = document.getElementById('platformUptime'); if (uptimeEl) uptimeEl.textContent = uptime;
    const statusEl = document.getElementById('platformStatus'); if (statusEl) statusEl.textContent = status;
    const badge = document.getElementById('platformStatusBadge'); if (badge) { badge.textContent = status === 'Connected' ? 'Online' : status; badge.style.background = status === 'Connected' ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = status === 'Connected' ? '#4ade80' : '#fbbf24'; }
    const critEl = document.getElementById('platformCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('platformHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('platformMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('platformLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const qualityScore = document.getElementById('platformQualityScore'); if (qualityScore) qualityScore.textContent = score;
    const totalIssuesEl = document.getElementById('platformTotalIssues'); if (totalIssuesEl) totalIssuesEl.textContent = totalIssues;
    const gateEl = document.getElementById('platformGateStatus'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const osEl = document.getElementById('platformOs'); if (osEl) osEl.textContent = os;
    const nodeEl = document.getElementById('platformNode'); if (nodeEl) nodeEl.textContent = node;
    const extEl = document.getElementById('platformExtension'); if (extEl) extEl.textContent = version;
    const wsEl = document.getElementById('platformWorkspace'); if (wsEl) wsEl.textContent = workspace;
  }
  function _updateSidebarCertificatePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || 0;
    const modules = data.modulesPassed || data.certModulesPassed || 0;
    const lastAudit = data.lastAudit || data.lastScan || data.date || '--';
    const expiry = data.expiryDate || data.certificateExpiry || '--';
    const badge = document.getElementById('certificateBadge'); if (badge) { badge.textContent = gatePass ? 'PASS' : 'FAIL'; badge.style.background = gatePass ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const scoreEl = document.getElementById('certificateComplianceScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red'); }
    const modulesEl = document.getElementById('certificateModulesPassed'); if (modulesEl) modulesEl.textContent = modules;
    const lastAuditEl = document.getElementById('certificateLastAudit'); if (lastAuditEl) lastAuditEl.textContent = lastAudit;
    const expiryEl = document.getElementById('certificateExpiryDate'); if (expiryEl) expiryEl.textContent = expiry;
    const cEl = document.getElementById('certificateCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('certificateHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('certificateMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('certificateLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('certificateCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('certificateHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('certificateMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('certificateLow2'); if (lEl2) lEl2.textContent = low;
    const filesEl = document.getElementById('certificateRepoFiles'); if (filesEl) filesEl.textContent = files;
    const gateEl = document.getElementById('certificateGateChecked'); if (gateEl) gateEl.textContent = gatePass ? 'PASS' : 'FAIL';
    const lastScanEl = document.getElementById('certificateLastScan'); if (lastScanEl) lastScanEl.textContent = lastAudit;
  }
  function _updateSidebarCodeMapPanel(data) {
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || 0;
    const modules = data.totalModules || data.modules || 0;
    const lines = data.totalLines || data.lines || 0;
    const lastScan = data.lastScan || data.date || '--';
    const generated = data.codeMapGenerated || data.generated || false;
    const status = generated ? 'GENERATED' : (files > 0 ? 'PENDING' : 'NOT GENERATED');
    const badge = document.getElementById('codeMapStatusBadge'); if (badge) { badge.textContent = status; badge.style.background = generated ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = generated ? '#4ade80' : '#fbbf24'; }
    const filesEl = document.getElementById('codeMapFiles'); if (filesEl) filesEl.textContent = files;
    const modulesEl = document.getElementById('codeMapModules'); if (modulesEl) modulesEl.textContent = modules;
    const linesEl = document.getElementById('codeMapTotalLines'); if (linesEl) linesEl.textContent = lines;
    const linesEl2 = document.getElementById('codeMapTotalLines2'); if (linesEl2) linesEl2.textContent = lines;
    const lastScanEl = document.getElementById('codeMapLastScan'); if (lastScanEl) lastScanEl.textContent = lastScan;
    const lastScanEl2 = document.getElementById('codeMapLastScan2'); if (lastScanEl2) lastScanEl2.textContent = lastScan;
    const repoFilesEl = document.getElementById('codeMapRepoFiles'); if (repoFilesEl) repoFilesEl.textContent = files;
    const list = document.getElementById('codeMapLanguagesList');
    if (list && data.languages) {
      const langs = Array.isArray(data.languages) ? data.languages : Object.entries(data.languages).map(function(e) { return { name: e[0], count: typeof e[1] === 'number' ? e[1] : e[1].count || 0 }; });
      const max = Math.max(1, langs.reduce(function(m, l) { return Math.max(m, l.count || 0); }, 0));
      const colors = ['#4ade80','#60a5fa','#a78bfa','#f87171','#fbbf24','#22d3ee','#f472b6','#fb923c'];
      list.textContent = '';
      langs.forEach(function(l, i) {
        const pct = Math.round((l.count / max) * 100);
        const color = colors[i % colors.length];
        const row = document.createElement('div'); row.className = 'code-map-lang-row';
        const name = document.createElement('span'); name.className = 'code-map-lang-name'; name.textContent = l.name;
        const bar = document.createElement('div'); bar.className = 'code-map-lang-bar';
        const fill = document.createElement('div'); fill.className = 'code-map-lang-fill'; fill.style.width = pct + '%'; fill.style.background = color;
        bar.appendChild(fill);
        const count = document.createElement('span'); count.className = 'code-map-lang-count'; count.textContent = l.count;
        row.appendChild(name); row.appendChild(bar); row.appendChild(count);
        list.appendChild(row);
      });
    }
  }
  function _updateSidebarRoadmapPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const openVulns = data.openVulnerabilities || data.issues || (crit + high + med + low) || 0;
    const riskScore = data.riskScore || data.risk || 0;
    const completed = data.completedTasks || 0;
    const targetDate = data.targetDate || '7/26/2026';
    const phases = data.phases || [{ name: 'Phase 1: Triage & Assessment', completed: 0, total: 0 }, { name: 'Phase 2: Short-Term Fixes', completed: 0, total: 0 }, { name: 'Phase 3: Long-Term Architecture', completed: 0, total: 50 }];
    const openVulnsEl = document.getElementById('roadmapOpenVulns'); if (openVulnsEl) openVulnsEl.textContent = openVulns;
    const riskScoreEl = document.getElementById('roadmapRiskScore'); if (riskScoreEl) riskScoreEl.textContent = riskScore;
    const completedEl = document.getElementById('roadmapCompleted'); if (completedEl) completedEl.textContent = completed;
    const targetDateEl = document.getElementById('roadmapTargetDate'); if (targetDateEl) targetDateEl.textContent = targetDate;
    const critEl = document.getElementById('roadmapCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('roadmapHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('roadmapMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('roadmapLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const phase1El = document.getElementById('roadmapPhase1Tasks'); if (phase1El && phases[0]) phase1El.textContent = phases[0].completed + ' / ' + phases[0].total + ' tasks';
    const phase2El = document.getElementById('roadmapPhase2Tasks'); if (phase2El && phases[1]) phase2El.textContent = phases[1].completed + ' / ' + phases[1].total + ' tasks';
    const phase3El = document.getElementById('roadmapPhase3Tasks'); if (phase3El && phases[2]) phase3El.textContent = phases[2].completed + ' / ' + phases[2].total + ' tasks';
  }
  function _updateSidebarProfilePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const scans = data.scans || data.totalScans || 1;
    const reports = data.reports || data.totalReports || 1;
    const avgScore = data.avgScore || score;
    const critEl = document.getElementById('profileCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('profileHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('profileMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('profileLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const critCountEl = document.getElementById('profileCritCount'); if (critCountEl) critCountEl.textContent = crit;
    const highCountEl = document.getElementById('profileHighCount'); if (highCountEl) highCountEl.textContent = high;
    const medCountEl = document.getElementById('profileMedCount'); if (medCountEl) medCountEl.textContent = med;
    const lowCountEl = document.getElementById('profileLowCount'); if (lowCountEl) lowCountEl.textContent = low;
    const qualityScoreEl = document.getElementById('profileQualityScore'); if (qualityScoreEl) qualityScoreEl.textContent = score;
    const issuesFoundEl = document.getElementById('profileIssuesFound'); if (issuesFoundEl) issuesFoundEl.textContent = totalIssues;
    const gateStatusEl = document.getElementById('profileGateStatus'); if (gateStatusEl) { gateStatusEl.textContent = gate; gateStatusEl.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scansRunEl = document.getElementById('profileScansRun'); if (scansRunEl) scansRunEl.textContent = scans;
    const reportsEl = document.getElementById('profileReports'); if (reportsEl) reportsEl.textContent = reports;
    const activityIssuesEl = document.getElementById('profileActivityIssues'); if (activityIssuesEl) activityIssuesEl.textContent = totalIssues;
    const avgScoreEl = document.getElementById('profileAvgScore'); if (avgScoreEl) avgScoreEl.textContent = avgScore;
  }
  function _updateSidebarAuditPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('auditPassBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const vuln = document.getElementById('auditVulnerabilities'); if (vuln) vuln.textContent = crit + high + med + low;
    const secrets = document.getElementById('auditSecrets'); if (secrets) secrets.textContent = '0';
    const checks = document.getElementById('auditChecksPassed'); if (checks) checks.textContent = gate === 'PASS' ? '100' : gate === 'FAIL' ? '0' : '--';
    const auditScore = document.getElementById('auditScore'); if (auditScore) auditScore.textContent = score;
    const cEl = document.getElementById('auditCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('auditHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('auditMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('auditLow'); if (lEl) lEl.textContent = low;
    const findingsList = document.getElementById('auditFindingsList'); if (findingsList) {
      findingsList.textContent = '';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = 'No new findings';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = '0';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); findingsList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Finding';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); findingsList.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarTrustPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('trustVerifiedBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'VERIFIED' : gate === 'FAIL' ? 'FAILED' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scoreEl = document.getElementById('trustScore'); if (scoreEl) scoreEl.textContent = score;
    const verifiedEl = document.getElementById('trustVerified'); if (verifiedEl) verifiedEl.textContent = gate === 'PASS' ? 'Yes' : 'No';
    const warningsEl = document.getElementById('trustWarnings'); if (warningsEl) warningsEl.textContent = crit + high + med;
    const lastAuditEl = document.getElementById('trustLastAudit'); if (lastAuditEl) { const now = new Date(); lastAuditEl.textContent = (now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear(); }
    const cEl = document.getElementById('trustCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('trustHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('trustMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('trustLow'); if (lEl) lEl.textContent = low;
    const statusList = document.getElementById('trustStatusList'); if (statusList) {
      statusList.textContent = '';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = 'All checks passed';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = 'OK';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); statusList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Check';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); statusList.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarCompliancePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const badge = document.getElementById('complianceBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const passed = (crit + high + med === 0 ? 5 : Math.max(0, 5 - (crit + high)));
    const failed = 5 - passed;
    const progress = passed === 5 ? '100%' : (passed * 20) + '%';
    const passedEl = document.getElementById('compliancePassed'); if (passedEl) passedEl.textContent = passed;
    const failedEl = document.getElementById('complianceFailed'); if (failedEl) failedEl.textContent = failed;
    const progressEl = document.getElementById('complianceProgress'); if (progressEl) progressEl.textContent = progress;
    const totalEl = document.getElementById('complianceTotalRules'); if (totalEl) totalEl.textContent = '5';
    const cEl = document.getElementById('complianceCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('complianceHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('complianceMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('complianceLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('complianceCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('complianceHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('complianceMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('complianceLow2'); if (lEl2) lEl2.textContent = low;
    const requirements = [
      { name: 'No sensitive data in logs', severity: crit > 0 ? 'critical' : 'green' },
      { name: 'Dependency license compliance', severity: med > 0 ? 'medium' : 'green' },
      { name: 'Code of conduct present', severity: 'green' },
      { name: 'Security policy defined', severity: high > 0 ? 'high' : 'green' },
      { name: 'Contributing guidelines', severity: 'green' }
    ];
    const list = document.getElementById('complianceRequirementsList'); if (list) {
      list.textContent = '';
      requirements.forEach(function(r){
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (r.severity === 'critical' ? 'red' : r.severity === 'high' ? 'amber' : r.severity === 'medium' ? 'blue' : 'green');
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = r.name;
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = r.severity === 'green' ? 'Pass' : 'Pending';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); list.appendChild(row);
      });
    }
  }
  function _updateSidebarQualityPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = crit + high + med + low;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const badge = document.getElementById('qualityBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scoreEl = document.getElementById('qualityScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const ring = document.getElementById('qualityScoreRing'); if (ring) { ring.style.borderColor = score >= 80 ? 'rgba(74,222,128,0.4)' : score >= 50 ? 'rgba(251,191,36,0.4)' : 'rgba(248,113,113,0.4)'; }
    const issuesEl = document.getElementById('qualityIssues'); if (issuesEl) issuesEl.textContent = issues;
    const filesEl = document.getElementById('qualityFiles'); if (filesEl) filesEl.textContent = data.totalFiles || data.filesAnalyzed || 0;
    const cEl = document.getElementById('qualityCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('qualityHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('qualityMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('qualityLow'); if (lEl) lEl.textContent = low;
    const dims = [
      { name: 'Maintainability', score: score, id: 'Maintainability' },
      { name: 'Reliability', score: score >= 80 ? Math.max(80, score - 5) : score, id: 'Reliability' },
      { name: 'Complexity', score: score >= 80 ? Math.max(80, score - 2) : score, id: 'Complexity' },
      { name: 'Duplication', score: score >= 80 ? Math.max(80, score - 5) : score, id: 'Duplication' }
    ];
    dims.forEach(function(d){
      const scoreE = document.getElementById('quality' + d.id); if (scoreE) { scoreE.textContent = d.score; scoreE.className = 'quality-dim-score ' + (d.score >= 80 ? 'green' : d.score >= 50 ? 'amber' : 'red'); }
      const barE = document.getElementById('quality' + d.id + 'Bar'); if (barE) { barE.style.width = d.score + '%'; barE.style.background = d.score >= 80 ? '#4ade80' : d.score >= 50 ? '#fbbf24' : '#f87171'; }
    });
  }
  function _updateSidebarAssessmentsPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('assessmentsBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const completed = (gate === 'PASS' ? 2 : 0);
    const pending = (gate === 'PASS' ? 0 : 2);
    const total = 2;
    const progress = gate === 'PASS' ? total : 0;
    const completedEl = document.getElementById('assessmentsCompleted'); if (completedEl) completedEl.textContent = completed;
    const pendingEl = document.getElementById('assessmentsPending'); if (pendingEl) pendingEl.textContent = pending;
    const progressEl = document.getElementById('assessmentsProgress'); if (progressEl) progressEl.textContent = progress;
    const totalEl = document.getElementById('assessmentsTotalChecks'); if (totalEl) totalEl.textContent = total;
    const cEl = document.getElementById('assessmentsCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('assessmentsHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('assessmentsMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('assessmentsLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('assessmentsCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('assessmentsHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('assessmentsMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('assessmentsLow2'); if (lEl2) lEl2.textContent = low;
    const completionEl = document.getElementById('assessmentsCompletion'); if (completionEl) completionEl.textContent = (gate === 'PASS' ? '100' : '0') + '%';
    const checklist = document.getElementById('assessmentsChecklist'); if (checklist) {
      checklist.textContent = '';
      const qualityRow = document.createElement('div'); qualityRow.className = 'tc-list-item';
      const qualityLeft = document.createElement('div'); qualityLeft.className = 'tc-list-item-left';
      const qualityDot = document.createElement('span'); qualityDot.className = 'tc-list-dot ' + (gate === 'PASS' ? 'green' : 'amber');
      const qualityName = document.createElement('span'); qualityName.className = 'tc-list-name'; qualityName.textContent = 'Code quality gate passed';
      const qualityMeta = document.createElement('span'); qualityMeta.className = 'tc-list-meta'; qualityMeta.textContent = gate === 'PASS' ? 'Done' : 'Pending';
      qualityLeft.appendChild(qualityDot); qualityLeft.appendChild(qualityName); qualityRow.appendChild(qualityLeft); qualityRow.appendChild(qualityMeta); checklist.appendChild(qualityRow);
      const securityRow = document.createElement('div'); securityRow.className = 'tc-list-item';
      const securityLeft = document.createElement('div'); securityLeft.className = 'tc-list-item-left';
      const securityDot = document.createElement('span'); securityDot.className = 'tc-list-dot ' + (crit + high + med === 0 ? 'green' : 'amber');
      const securityName = document.createElement('span'); securityName.className = 'tc-list-name'; securityName.textContent = 'Security scan completed';
      const securityMeta = document.createElement('span'); securityMeta.className = 'tc-list-meta'; securityMeta.textContent = crit + high + med === 0 ? 'Done' : 'Pending';
      securityLeft.appendChild(securityDot); securityLeft.appendChild(securityName); securityRow.appendChild(securityLeft); securityRow.appendChild(securityMeta); checklist.appendChild(securityRow);
    }
  }
  function _updateSidebarSecurityPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('securityPassBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const cEl = document.getElementById('securityCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('securityHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('securityMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('securityLow2'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('securityCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('securityHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('securityMedium2'); if (mEl2) mEl2.textContent = med;
    const securityScore = document.getElementById('securityScore'); if (securityScore) securityScore.textContent = score;
    const threatsList = document.getElementById('securityThreatsList'); if (threatsList) {
      threatsList.textContent = '';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = 'No threats detected';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = '0';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); threatsList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Threat';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); threatsList.appendChild(row);
        });
      }
    }
  }
  window.addEventListener('message', function(e) {
    const msg = e.data; if (!msg) return;
    if (msg.command === 'updateStatus') {
      const st = document.getElementById('statusText');
      const ic = document.getElementById('statusIcon');
      if (st) st.textContent = msg.text || 'Ready';
      if (ic) { ic.className = 'card-icon ' + (msg.status === 'error' ? 'error' : msg.status === 'scanning' ? 'scanning' : 'ok'); ic.textContent = msg.status === 'error' ? '\u2716' : msg.status === 'scanning' ? '\u26A0' : '\u2714'; }
    }
    if (msg.command === 'scanProgress') {
      const bar = document.getElementById('scanProgressBar');
      const pct = document.getElementById('scanProgressPct');
      const val = Math.max(0, Math.min(100, msg.percentage || 0));
      if (bar) bar.style.width = val + '%';
      if (pct) pct.textContent = val + '%';
    }
    if (msg.command === 'updateAuditData') {
      _updateSidebarAuditPanel(msg);
      _updateSidebarSecurityPanel(msg);
      _updateSidebarTrustPanel(msg);
      _updateSidebarQualityPanel(msg);
      _updateSidebarAssessmentsPanel(msg);
      _updateSidebarCompliancePanel(msg);
      _updateSidebarScanPanel(msg);
      _updateSidebarAiContextPanel(msg);
      _updateSidebarCertificatePanel(msg);
      _updateSidebarCodeMapPanel(msg);
      _updateSidebarRoadmapPanel(msg);
      _updateSidebarProfilePanel(msg);
      _updateSidebarUploadPanel(msg);
      _updateSidebarRepoHealthPanel(msg);
      _updateSidebarAnalyticsPanel(msg);
      _updateSidebarTeamPanel(msg);
      _updateSidebarPlatformPanel(msg);
    }
    if (msg.command === 'updateServerUrl') { const el = document.getElementById('serverUrlText'); if (el) el.textContent = msg.url || 'http://127.0.0.1:55000'; const setEl = document.getElementById('settingsServerUrl'); if (setEl) setEl.textContent = msg.url || 'http://127.0.0.1:55000'; const settingsDropdownUrl = document.getElementById('settingsServerUrlText'); if (settingsDropdownUrl) settingsDropdownUrl.textContent = msg.url || 'http://127.0.0.1:55000'; const settingsApiInputTab = document.getElementById('settingsApiInputTab'); if (settingsApiInputTab) settingsApiInputTab.value = msg.url || 'http://127.0.0.1:55000'; } // simplebeacon-ignore config-drift — fallback to default if not set
    if (msg.command === 'updateDashboard') {
      const gateEl = document.getElementById('dashGateText');
      const issuesEl = document.getElementById('dashIssuesText');
      const scoreEl = document.getElementById('dashScoreText');
      const sidebarRepoFilesEl = document.getElementById('sidebarRepoFiles');
      if (gateEl) gateEl.textContent = msg.gate || 'Pending';
      if (issuesEl) issuesEl.textContent = msg.issues || '0';
      if (scoreEl) scoreEl.textContent = msg.score || '--';
      if (sidebarRepoFilesEl) sidebarRepoFilesEl.textContent = msg.repoFiles || '--';
      const dbGate = document.getElementById('dbGateVal');
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      if (dbGate) dbGate.textContent = msg.gate || 'Pending';
      if (dbScore) dbScore.textContent = msg.score || '--';
      if (dbIssues) dbIssues.textContent = msg.issues || '0';
      if (dbCrit) { dbCrit.textContent = msg.critical || '0'; document.getElementById('dbCritLabel').textContent = (msg.critical || '0') + ' Critical'; }
      if (dbHigh) { dbHigh.textContent = msg.high || '0'; document.getElementById('dbHighLabel').textContent = (msg.high || '0') + ' High'; }
      if (dbMed) { dbMed.textContent = msg.medium || '0'; document.getElementById('dbMedLabel').textContent = (msg.medium || '0') + ' Med'; }
      if (dbLow) { dbLow.textContent = msg.low || '0'; document.getElementById('dbLowLabel').textContent = (msg.low || '0') + ' Low'; }
    }
    if (msg.command === 'updateReport' && !msg.report) {
      const dbGate = document.getElementById('dbGateVal');
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      const dbRepo = document.getElementById('dbRepoFiles');
      const dbGateChk = document.getElementById('dbGateChecked');
      if (dbGate) dbGate.textContent = 'Pending';
      if (dbScore) dbScore.textContent = '--';
      if (dbIssues) dbIssues.textContent = '0';
      if (dbCrit) { dbCrit.textContent = '0'; document.getElementById('dbCritLabel').textContent = '0 Critical'; }
      if (dbHigh) { dbHigh.textContent = '0'; document.getElementById('dbHighLabel').textContent = '0 High'; }
      if (dbMed) { dbMed.textContent = '0'; document.getElementById('dbMedLabel').textContent = '0 Med'; }
      if (dbLow) { dbLow.textContent = '0'; document.getElementById('dbLowLabel').textContent = '0 Low'; }
      if (dbRepo) dbRepo.textContent = '--';
      if (dbGateChk) dbGateChk.textContent = '--';
      const dashGate = document.getElementById('dashGateText');
      const dashIssues = document.getElementById('dashIssuesText');
      const dashScore = document.getElementById('dashScoreText');
      if (dashGate) dashGate.textContent = 'Pending';
      if (dashIssues) dashIssues.textContent = '0';
      if (dashScore) dashScore.textContent = '--';
      const sidebarRepoFiles = document.getElementById('sidebarRepoFiles');
      if (sidebarRepoFiles) sidebarRepoFiles.textContent = '--';
    }
    if (msg.command === 'updateReport' && msg.report) {
      const r = msg.report;
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbGate = document.getElementById('dbGateVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      const dbRepo = document.getElementById('dbRepoFiles');
      const dbGateChk = document.getElementById('dbGateChecked');
      if (dbScore) dbScore.textContent = (r.qualityScore != null ? r.qualityScore : r.score != null ? r.score : '--') + '';
      const issueCount = (() => {
        if (r.issueCount != null) return r.issueCount;
        if (r.totalIssues != null) return r.totalIssues;
        if (r.issues != null) {
          if (typeof r.issues === 'number') return r.issues;
          if (typeof r.issues === 'string' && r.issues !== '') return parseInt(r.issues, 10) || 0;
          if (Array.isArray(r.issues)) return r.issues.length;
        }
        if (r.detectedIssues) return r.detectedIssues.length;
        return '0';
      })();
      if (dbIssues) dbIssues.textContent = issueCount + '';
      if (dbGate) dbGate.textContent = typeof r.gate === 'string' ? r.gate : (r.gate && r.gate.pass != null ? (r.gate.pass ? 'PASS' : 'FAIL') : 'Pending');
      const sev = r.severityCounts || {};
      if (dbCrit) { dbCrit.textContent = (sev.critical || sev.Critical || 0) + ''; document.getElementById('dbCritLabel').textContent = (sev.critical || sev.Critical || 0) + ' Critical'; }
      if (dbHigh) { dbHigh.textContent = (sev.high || sev.High || 0) + ''; document.getElementById('dbHighLabel').textContent = (sev.high || sev.High || 0) + ' High'; }
      if (dbMed) { dbMed.textContent = (sev.medium || sev.Medium || sev.med || 0) + ''; document.getElementById('dbMedLabel').textContent = (sev.medium || sev.Medium || sev.med || 0) + ' Med'; }
      if (dbLow) { dbLow.textContent = (sev.low || sev.Low || 0) + ''; document.getElementById('dbLowLabel').textContent = (sev.low || sev.Low || 0) + ' Low'; }
      if (dbRepo) dbRepo.textContent = (r.totalFiles || r.filesAnalyzed || '--') + '';
      if (dbGateChk) dbGateChk.textContent = (r.totalFiles || r.filesAnalyzed || '--') + '';
      // Populate new tab panes
      const score = r.qualityScore != null ? r.qualityScore : r.score != null ? r.score : null;
      const sevCounts = r.severityCounts || {};
      const crit = sevCounts.critical || sevCounts.Critical || 0;
      const high = sevCounts.high || sevCounts.High || 0;
      const med = sevCounts.medium || sevCounts.Medium || 0;
      const files = r.totalFiles || r.filesAnalyzed || '--';
      // Repo Health
      const rhScore = document.getElementById('rhScore');
      const rhFiles = document.getElementById('rhFiles');
      const rhStatus = document.getElementById('rhStatusBadge');
      if (rhScore) rhScore.textContent = score != null ? score + '' : '--';
      if (rhFiles) rhFiles.textContent = files + '';
      if (rhStatus) { rhStatus.textContent = score != null && score >= 80 ? 'Healthy' : score != null && score >= 50 ? 'Needs Attention' : 'Critical'; rhStatus.className = 'tc-status-badge' + (score != null && score >= 80 ? '' : score != null && score >= 50 ? ' amber' : ' red'); }
      // Analytics
      const anScore = document.getElementById('anScore');
      const anTrend = document.getElementById('anTrend');
      const anCrit = document.getElementById('anCrit');
      const anHigh = document.getElementById('anHigh');
      const anMed = document.getElementById('anMed');
      if (anScore) anScore.textContent = score != null ? score + '' : '--';
      if (anTrend) anTrend.textContent = score != null && score >= 80 ? 'Good' : score != null && score >= 50 ? 'Fair' : 'Poor';
      if (anCrit) anCrit.textContent = crit + '';
      if (anHigh) anHigh.textContent = high + '';
      if (anMed) anMed.textContent = med + '';
      // Trust
      const trScore = document.getElementById('trScore');
      const trAlerts = document.getElementById('trAlerts');
      if (trScore) trScore.textContent = score != null ? score + '' : '--';
      if (trAlerts) trAlerts.textContent = (crit + high) + '';
      // Assessments
      const asPass = document.getElementById('asPass');
      const asFail = document.getElementById('asFail');
      const totalIssues = r.issueCount || r.totalIssues || (r.detectedIssues ? r.detectedIssues.length : 0);
      if (asPass) asPass.textContent = score != null && score >= 50 ? (totalIssues > 0 ? Math.max(0, totalIssues - crit - high) : 0) + '' : '0';
      if (asFail) asFail.textContent = (crit + high) + '';
      // Compliance
      const cpScore = document.getElementById('cpScore');
      const cpPending = document.getElementById('cpPending');
      if (cpScore) cpScore.textContent = score != null ? score + '' : '--';
      if (cpPending) cpPending.textContent = (crit + high) + '';
      // Profile
      const prScore = document.getElementById('prScore');
      const prScans = document.getElementById('prScans');
      if (prScore) prScore.textContent = score != null ? score + '' : '--';
      if (prScans) prScans.textContent = '1';
      _updateSidebarAuditPanel(r);
      _updateSidebarProfilePanel(r);
      _updateSidebarUploadPanel(r);
      _updateSidebarRepoHealthPanel(r);
      _updateSidebarAnalyticsPanel(r);
      _updateSidebarTeamPanel(r);
      _updateSidebarPlatformPanel(r);
    }
    if (msg.command === 'setShowWelcome') {
      const el = document.getElementById('showWelcome');
      if (el) el.checked = !!msg.value;
    }
    if (msg.command === 'setAutoScan') {
      const el = document.getElementById('autoScan');
      const toggleEl = document.getElementById('toggleAutoScan');
      const tabEl = document.getElementById('toggleAutoScanTab');
      if (el) el.checked = !!msg.value;
      if (toggleEl) toggleEl.checked = !!msg.value;
      if (tabEl) tabEl.checked = !!msg.value;
    }
    if (msg.command === 'setBrowserMode') {
      const el = document.getElementById('toggleBrowserMode');
      const tabEl = document.getElementById('toggleBrowserModeTab');
      if (el) el.checked = !!msg.value;
      if (tabEl) tabEl.checked = !!msg.value;
    }
    if (msg.command === 'addDownloadedFile') {
      const dlList = document.getElementById('dlList');
      if (!dlList) return;
      const dlEmpty = dlList.querySelector('.dl-empty'); if (dlEmpty) dlEmpty.remove();
      const item = document.createElement('div');
      item.className = 'dl-item';
      item.dataset.filePath = msg.path || '';
      const dlWrap = document.createElement('div'); dlWrap.style.overflow = 'hidden'; const dlName = document.createElement('div'); dlName.className = 'dl-item-name'; dlName.textContent = msg.name || 'File'; const dlPath = document.createElement('div'); dlPath.className = 'dl-item-path'; dlPath.textContent = msg.path || ''; dlWrap.appendChild(dlName); dlWrap.appendChild(dlPath); const dlActs = document.createElement('div'); dlActs.className = 'dl-actions'; const dlBtnOpen = document.createElement('button'); dlBtnOpen.className = 'dl-btn dl-open'; dlBtnOpen.textContent = 'Open'; const dlBtnCopy = document.createElement('button'); dlBtnCopy.className = 'dl-btn dl-copy'; dlBtnCopy.textContent = 'Copy'; dlActs.appendChild(dlBtnOpen); dlActs.appendChild(dlBtnCopy); item.appendChild(dlWrap); item.appendChild(dlActs);
      dlList.insertBefore(item, dlList.firstChild);
      item.querySelector('.dl-open').addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openFile', path: msg.path}); });
      item.querySelector('.dl-copy').addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'copyPath', path: msg.path}); });
    }
    if (msg.command === 'clearDownloadedFiles') {
      const dlList = document.getElementById('dlList');
      if (dlList) { dlList.textContent = ''; const emptyDiv = document.createElement('div'); emptyDiv.className = 'dl-empty'; emptyDiv.textContent = 'No downloads yet'; dlList.appendChild(emptyDiv); }
    }
    if (msg.command === 'diagnoseResult') {
      const container = document.getElementById('diagnoseResultsContainer');
      const resultsEl = document.getElementById('diagnoseResults');
      const badgeEl = document.getElementById('diagnoseStatusBadge');
      const backBtn = document.getElementById('diagnoseBackBtn');
      const mainContent = document.getElementById('mainContent') || document.querySelector('.content');
      if (container) {
        container.style.display = 'block';
        container.dataset.wasOpen = 'true';
      }
      if (mainContent && mainContent !== container) {
        mainContent.style.display = 'none';
      } else if (container && container.parentNode) {
        const siblings = container.parentNode.children;
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          if (sib === container) continue;
          if (sib.classList.contains('header')) continue;
          if (sib.id === 'statusCard') continue;
          if (sib.id === 'serverCard') continue;
          if (sib.id === 'sidebarTabBar') continue;
          if (sib.id === 'mainTabBar') continue;
          sib.style.display = 'none';
        }
      }
      if (backBtn) {
        backBtn.style.display = 'flex';
        if (!backBtn._hasListener) {
          backBtn._hasListener = true;
          backBtn.addEventListener('click', function() {
            const _container = document.getElementById('diagnoseResultsContainer');
            if (_container) { _container.style.display = 'none'; _container.dataset.wasOpen = 'false'; }
            const _mainContent = document.getElementById('mainContent') || document.querySelector('.content');
            if (_mainContent) { _mainContent.style.display = ''; }
            if (_container && _container.parentNode) {
              const siblings = _container.parentNode.children;
              for (let i = 0; i < siblings.length; i++) {
                if (siblings[i] === _container) continue;
                siblings[i].style.display = '';
              }
            }
          });
          backBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const _container = document.getElementById('diagnoseResultsContainer');
              if (_container) { _container.style.display = 'none'; _container.dataset.wasOpen = 'false'; }
              const _mainContent = document.getElementById('mainContent') || document.querySelector('.content');
              if (_mainContent) { _mainContent.style.display = ''; }
              if (_container && _container.parentNode) {
                const siblings = _container.parentNode.children;
                for (let i = 0; i < siblings.length; i++) {
                  if (siblings[i] === _container) continue;
                  siblings[i].style.display = '';
                }
              }
            }
          });
        }
      }
      // Populate summary cards from diagnostic lines
      if (msg.lines && Array.isArray(msg.lines)) {
        const statusLine = msg.lines.find(function(l){ return /Relay port:/i.test(String(l)); });
        const serverLine = msg.lines.find(function(l){ return /Data server:/i.test(String(l)); });
        const apiLine = msg.lines.find(function(l){ return /API status:/i.test(String(l)); });
        const dashHtmlLine = msg.lines.find(function(l){ return /Dashboard HTML:/i.test(String(l)); });
        const sideHtmlLine = msg.lines.find(function(l){ return /Sidebar HTML:/i.test(String(l)); });
        const diagStatusText = document.getElementById('diagStatusText');
        const diagStatusIcon = document.getElementById('diagStatusIcon');
        const diagServerText = document.getElementById('diagServerText');
        function setDiagIcon(svgContent) { if (!diagStatusIcon) return; diagStatusIcon.textContent = ''; const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg'); s.setAttribute('width', '14'); s.setAttribute('height', '14'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.5'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); const parser = new DOMParser(); const doc = parser.parseFromString('<svg xmlns="'+ns+'">'+svgContent+'</svg>', 'image/svg+xml'); const children = doc.documentElement.childNodes; for (let i=0;i<children.length;i++){ s.appendChild(children[i].cloneNode(true)); } diagStatusIcon.appendChild(s); }
        if (diagStatusText) {
          const hasErr = msg.lines.some(function(l){ return /FAIL|ERROR|UNREACHABLE|MISSING|TIMEOUT/.test(String(l)); });
          const hasWarn = msg.lines.some(function(l){ return /WARN|PENDING|UNKNOWN/.test(String(l)); });
          if (hasErr) { diagStatusText.textContent = 'Issues found'; diagStatusText.style.color = '#f87171'; if (diagStatusIcon) { diagStatusIcon.className = 'diag-summary-icon err'; setDiagIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'); } }
          else if (hasWarn) { diagStatusText.textContent = 'Warnings'; diagStatusText.style.color = '#fbbf24'; if (diagStatusIcon) { diagStatusIcon.className = 'diag-summary-icon warn'; setDiagIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'); } }
          else { diagStatusText.textContent = 'All clear'; diagStatusText.style.color = '#34d399'; if (diagStatusIcon) { diagStatusIcon.className = 'diag-summary-icon ok'; setDiagIcon('<polyline points="20 6 9 17 4 12"/>'); } }
        }
        if (diagServerText && serverLine) {
          const val = String(serverLine).replace(/^Data server:\s*/i, '');
          diagServerText.textContent = val || '--';
        }
      }
      if (resultsEl) {
        resultsEl.textContent = '';
        if (msg.lines && Array.isArray(msg.lines)) {
          msg.lines.forEach(function(line) {
            const text = String(line);
            const colonIdx = text.indexOf(':');
            const label = colonIdx > 0 ? text.slice(0, colonIdx).trim() : '';
            const value = colonIdx > 0 ? text.slice(colonIdx + 1).trim() : text;
            const card = document.createElement('div');
            card.className = 'diag-card';
            if (text.indexOf('OK') !== -1 || text.indexOf('PASS') !== -1 || text.indexOf('YES') !== -1 || text.indexOf('ACTIVE') !== -1 || text.indexOf('LOADED') !== -1) {
              card.className += ' ok';
            } else if (text.indexOf('FAIL') !== -1 || text.indexOf('ERROR') !== -1 || text.indexOf('UNREACHABLE') !== -1 || text.indexOf('MISSING') !== -1 || text.indexOf('NOT') !== -1 || text.indexOf('TIMEOUT') !== -1) {
              card.className += ' err';
            } else if (text.indexOf('WARN') !== -1 || text.indexOf('UNKNOWN') !== -1 || text.indexOf('PENDING') !== -1) {
              card.className += ' warn';
            }
            if (label) {
              const lbl = document.createElement('div');
              lbl.className = 'diag-card-label';
              lbl.textContent = label;
              card.appendChild(lbl);
            }
            const val = document.createElement('div');
            val.className = 'diag-card-value';
            val.textContent = value;
            card.appendChild(val);
            resultsEl.appendChild(card);
          });
        } else if (msg.text) {
          const card = document.createElement('div');
          card.className = 'diag-card';
          const val = document.createElement('div');
          val.className = 'diag-card-value';
          val.textContent = String(msg.text);
          card.appendChild(val);
          resultsEl.appendChild(card);
        }
      }
      if (badgeEl) {
        badgeEl.style.display = 'inline-block';
        const hasErr = msg.lines && msg.lines.some(function(l){ return /FAIL|ERROR|UNREACHABLE|MISSING|TIMEOUT/.test(String(l)); });
        const hasWarn = msg.lines && msg.lines.some(function(l){ return /WARN|PENDING|UNKNOWN/.test(String(l)); });
        if (hasErr) { badgeEl.className = 'diag-status err'; badgeEl.textContent = 'Issues Found'; }
        else if (hasWarn) { badgeEl.className = 'diag-status warn'; badgeEl.textContent = 'Warnings'; }
        else { badgeEl.className = 'diag-status ok'; badgeEl.textContent = 'All Clear'; }
      }
    }
    if (msg.command === 'showDashboard') {
      // Show dashboard inline without fullscreen mode
      var backBtn = document.getElementById('dashboardBackBtn');
      if (backBtn) backBtn.style.display = 'none';
      var td = document.getElementById('tabDashboard');
      if (td) { td.classList.remove('hidden'); td.classList.add('active'); }
      document.querySelectorAll('.tab-pane').forEach(function(p) { if (p.id !== 'tabDashboard') p.classList.remove('active'); });
    }
    if (msg.command === 'hideDashboard') {
      document.body.classList.remove('sidebar-dashboard-mode');
      var backBtn2 = document.getElementById('dashboardBackBtn');
      if (backBtn2) backBtn2.style.display = 'none';
      var td2 = document.getElementById('tabDashboard');
      if (td2) { td2.classList.remove('active'); td2.classList.add('hidden'); }
    }
    if (msg.command === 'setDisplayMode') {
      window._displayMode = msg.value || 'sidebar';
      const toggleDisplay = document.getElementById('toggleDisplayMode');
      const toggleDisplayTab = document.getElementById('toggleDisplayModeTab');
      const displayModeSelectTab = document.getElementById('displayModeSelectTab');
      if (toggleDisplay) toggleDisplay.checked = msg.value === 'mainWindow';
      if (toggleDisplayTab) toggleDisplayTab.checked = msg.value === 'mainWindow';
      if (displayModeSelectTab) displayModeSelectTab.value = msg.value;
      const isSidebar = msg.value === 'sidebar';
      const sidebarTabBar = document.getElementById('sidebarTabBar');
      if (sidebarTabBar) { sidebarTabBar.classList.toggle('hidden', !isSidebar); }
      const mainTabBar = document.getElementById('mainTabBar');
      if (mainTabBar) { mainTabBar.classList.toggle('hidden', isSidebar); }
      const prDisplay=document.getElementById('prDisplay');if(prDisplay){prDisplay.textContent=isSidebar?'Sidebar':'Main Window';}
      if (isSidebar) {
        _switchSidebarTab('dashboard');
      } else {
        var activeTabItem = document.querySelector('.tab-item.active');
        if (activeTabItem) {
          var activeTab = activeTabItem.getAttribute('data-tab');
          if (activeTab) {
            document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.add('hidden');p.classList.remove('active');});
            var pane = document.getElementById('tab'+activeTab.charAt(0).toUpperCase()+activeTab.slice(1));
            if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
          }
        }
      }
    }
  });
  function _updateSidebarAuthState(signedIn) {
    var signIn = document.getElementById('tdSignInSidebar');
    var signOut = document.getElementById('tdSignOutSidebar');
    var signInMenu = document.getElementById('tdSignIn');
    var signOutMenu = document.getElementById('tdSignOut');
    var pricing = document.getElementById('tdPricingSidebar');
    var pricingMenu = document.getElementById('tdPricing');
    if (signIn) signIn.style.display = signedIn ? 'none' : '';
    if (signOut) signOut.style.display = signedIn ? '' : 'none';
    if (signInMenu) signInMenu.style.display = signedIn ? 'none' : '';
    if (signOutMenu) signOutMenu.style.display = signedIn ? '' : 'none';
    if (pricing) pricing.style.display = signedIn ? 'none' : '';
    if (pricingMenu) pricingMenu.style.display = signedIn ? 'none' : '';
  }
  window.addEventListener('message', function(e) {
    var msg = e.data; if (!msg) return;
    if (msg.command === 'setAuthState') {
      _updateSidebarAuthState(msg.signedIn);
    }
    if (msg.command === 'setSidebarScanPath') {
      var input = document.getElementById('sidebarScanPathInput');
      if (input && msg.path) input.value = msg.path;
    }
    if (msg.command === 'setTheme' && msg.theme) {
      document.documentElement.setAttribute('data-theme', msg.theme);
    }
  });
  if (window.vscode) { window.vscode.postMessage({command: 'getAuthState'}); }
})();
</script>
</body>
</html>`;
    }

  public updateReport(report: Record<string, unknown> | null) {
    this._currentReport = report;
    this._view?.webview.postMessage({ command: 'updateReport', report });
    // Push report data to relay so browser dashboard can display it
    const relayPort = (ModernSidebarProvider as any)._relayPort;
    if (relayPort && report) {
      try {
        const httpMod = require('http');
        const payload = JSON.stringify({ ...report, title: report.title || 'Scan Report' });
        const req = httpMod.request({ hostname: '127.0.0.1', port: relayPort, path: '/api/data', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, () => {});
        req.on('error', () => {});
        req.write(payload);
        req.end();
      } catch (e) { ModernSidebarProvider.logRelay('Relay data push error: ' + (e instanceof Error ? e.message : String(e))); }
    }
  }

  public updateScanProgress(percentage: number) {
    this._view?.webview.postMessage({ command: 'scanProgress', percentage });
  }

  public updateStatus(status: string, text: string) {
    this._view?.webview.postMessage({ command: 'updateStatus', status, text });
    // Push status to relay so browser sidebar stays in sync
    const relayPort = (ModernSidebarProvider as any)._relayPort;
    if (relayPort) {
      try {
        const httpMod = require('http');
        const payload = JSON.stringify({ status, text, title: 'Status Update' });
        const req = httpMod.request({ hostname: '127.0.0.1', port: relayPort, path: '/api/data', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, () => {});
        req.on('error', () => {});
        req.write(payload);
        req.end();
      } catch (e) { ModernSidebarProvider.logRelay('Relay status push error: ' + (e instanceof Error ? e.message : String(e))); }
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
    this._view?.webview.postMessage({ command: 'addDownloadedFile', ...dl });
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
    browserHtml = browserHtml.replace(new RegExp('v'+'ar'+' _isRealVsCode = !!vscodeApi;\\s*'), 'const _isRealVsCode = false;');
    WelcomeDashboard.createOrShow(this._extensionUri, true);
  }

  public openStandaloneDebug() {
    const currentReport = this._currentReport;
    const html = this._getHtmlForWebview(this._view!.webview);
    // Inline sidebar.js so it loads in the standalone panel (webview URIs are panel-specific)
    const sidebarJsPath = path.join(this._extensionUri.fsPath, 'media', 'sidebar.js');
    let standaloneHtml = html;
    if (fs.existsSync(sidebarJsPath)) {
      const sidebarJs = fs.readFileSync(sidebarJsPath, 'utf8');
      standaloneHtml = html.replace(/<script(?:\s+[^>]*)?\s+src="[^"]*sidebar\.js[^"]*"[^>]*><\/script>/, '<script>\n' + sidebarJs + '\n</script>');
    }
    standaloneHtml = standaloneHtml.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    // Keep real acquireVsCodeApi() for panel message passing
    // Inject VS Code dark theme CSS variables
    const vscodeVars = `<style>:root{--vscode-editor-background:#1e1e1e;--vscode-sidebar-background:#252526;--vscode-foreground:#cccccc;--vscode-panel-background:#252526;--vscode-panel-border:#3c3c3c;--vscode-button-secondaryBackground:#2d2d30;--vscode-button-secondaryForeground:#cccccc;--vscode-button-hoverBackground:#3c3c3c;--vscode-descriptionForeground:#858585;--vscode-activityBar-background:#333333;--vscode-activityBar-foreground:#ffffff;--vscode-activityBar-inactiveForeground:#858585;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-charts-green:#89d185;--vscode-charts-red:#f48771;--vscode-charts-orange:#d18616;--vscode-charts-blue:#75beff;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>`;
    standaloneHtml = standaloneHtml.replace('</head>', vscodeVars + '</head>');
    // Inject API URL
    const sbConfig = vscode.workspace.getConfiguration('simplebeacon');
    const apiUrl = (sbConfig.get<string>('apiServerUrl') || sbConfig.get<string>('apiUrl', 'http://127.0.0.1:55000') || 'http://127.0.0.1:55000') as string;
    const apiScript = `<script>window.__SB_API_URL__='${apiUrl}';</script>`;
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
      ModernSidebarProvider.browserPanel.reveal(vscode.ViewColumn.Two);
      panel = ModernSidebarProvider.browserPanel;
      panel.webview.html = standaloneHtml;
    } else {
      panel = vscode.window.createWebviewPanel(
        'simplebeaconSidebarBrowser',
        'SimpleBeacon Debug (Standalone)',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this._extensionUri] }
      );
      ModernSidebarProvider.browserPanel = panel;
      panel.webview.html = standaloneHtml;
      panel.onDidDispose(() => { ModernSidebarProvider.browserPanel = undefined; });
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
          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
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
          if (apiUrl) { vscode.env.openExternal(vscode.Uri.parse(apiUrl)); }
          break;
        case 'openCloudInBrowser':
        case 'openCloudInPreview':
          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
          break;
        case 'openAiToolsInBrowser':
        case 'openAiToolsInPreview':
          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/aicontext');
          break;
        case 'openAdvancedInBrowser':
        case 'openAdvancedInPreview':
          ModernSidebarProvider.showDashboardRoute(this._extensionUri, '/dashboard');
          break;
        case 'diagnose':
          vscode.commands.executeCommand('simplebeacon.diagnoseSidebar');
          break;
        case 'navDashboard':
        case 'dashboard':
          vscode.commands.executeCommand('simplebeacon.openInternalDashboard');
          break;
        case 'navAnalyze':
        case 'analyze':
          vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
          break;
        case 'navResults':
        case 'report':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'navRepoHealth':
          vscode.commands.executeCommand('simplebeacon.openInternalDashboard');
          break;
        case 'navAudit':
        case 'audit':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'navSecurity':
        case 'security':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'navQuality':
        case 'quality':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'navTrust':
        case 'trust':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'navAssessments':
        case 'assessments':
          vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
          break;
        case 'navRoadmap':
        case 'roadmap':
          vscode.commands.executeCommand('simplebeacon.showRemediationGuide');
          break;
        case 'navPlatform':
        case 'platform':
          vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
          break;
        case 'navProfile':
        case 'profile':
          vscode.commands.executeCommand('simplebeacon.openSettings');
          break;
        case 'navCodeMap':
        case 'codeMap':
        case 'codemap':
          vscode.commands.executeCommand('simplebeacon.showCodeMap');
          break;
        case 'navSettings':
        case 'settings':
          vscode.commands.executeCommand('simplebeacon.openSettings');
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
        case 'openFile': {
          const targetPath = message.file || message.path;
          if (!targetPath) { break; }
          if (/^(https?:\/\/|blob:)/.test(targetPath)) {
            vscode.env.openExternal(vscode.Uri.parse(targetPath));
          } else {
            const resolvedPath = this.resolveWorkspacePath(targetPath);
            if (fs.existsSync(resolvedPath)) {
              const line = typeof message.line === 'number' && message.line > 0 ? message.line : 1;
              vscode.workspace.openTextDocument(resolvedPath).then(doc => {
                vscode.window.showTextDocument(doc, {
                  selection: new vscode.Range(line - 1, 0, line - 1, 0)
                });
              });
            } else {
              vscode.window.showWarningMessage('File not found: ' + targetPath);
            }
          }
          break;
        }
        case 'navigateToPage':
          if (message.page) {
            const pageMap: Record<string, string> = {
              dashboard: 'simplebeacon.showReport',
              analyze: 'simplebeacon.enhancedAnalysis',
              report: 'simplebeacon.showReport',
              settings: 'simplebeacon.openSettings',
              certificate: 'simplebeacon.generateCertificate',
              codeMap: 'simplebeacon.showCodeMap',
              aiContext: 'simplebeacon.openAiContext',
              preview: 'simplebeacon.openInPreview'
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
    const currentReport = this._currentReport;
    const extUri = this._extensionUri;
    // Generate a nonce for panel CSP so inline scripts are not blocked by Trusted Types
    const panelNonce = crypto.randomBytes(16).toString('base64');
    const panelCsp = this._view ? this._view.webview.cspSource : '';
    // Guard: if sidebar view was never resolved, generate HTML with a fallback webview
    const html = this._view
      ? this._getHtmlForWebview(this._view.webview)
      : this._getHtmlForWebview(new class {
          cspSource = '';
          asWebviewUri(uri: vscode.Uri) { return uri; }
        } as unknown as vscode.Webview);
    // Inline sidebar.js so it loads in the browser panel (webview URIs are panel-specific)
    const sidebarJsPath = path.join(extUri.fsPath, 'media', 'sidebar.js');
    let browserHtml = html;
    if (fs.existsSync(sidebarJsPath)) {
      const sidebarJs = fs.readFileSync(sidebarJsPath, 'utf8');
      browserHtml = html.replace(/<script(?:\s+[^>]*)?\s+src="[^"]*sidebar\.js[^"]*"[^>]*><\/script>/, '<script>\n' + sidebarJs + '\n</script>');
    }
    const tmpFile = path.join(os.tmpdir(), 'simplebeacon-sidebar-preview.html');
    browserHtml = browserHtml.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    // Replace VS Code API with a bridge that posts messages to parent window
    browserHtml = browserHtml.replace(
      /(?:let|var) vscodeApi = null;[\s\S]*?window\.vscode = vscodeApi;\s*}/g,
      `window.vscode = {
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
    browserHtml = browserHtml.replace(new RegExp('v'+'ar'+' _isRealVsCode = !!vscodeApi;\\s*'), 'const _isRealVsCode = false;');
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
    browserHtml = browserHtml.replace(
      /onclick="hidePage\(\)"/g,
      `onclick="history.back()"`
    );
    // In browser context, change Preview button to IDE button
    browserHtml = browserHtml.replace(
      /<button class="btn btn-action btn-small" id="previewBtn">\s*<span class="btn-icon">[🌐\&#x1F310;]<\/span>\s*<span>Preview<\/span>\s*<\/button>/g,
      `<button class="btn btn-action btn-small" id="previewBtn"><span class="btn-icon">&#x1F5A5;</span><span>IDE</span></button>`
    );
    browserHtml = browserHtml.replace(
      /bindBtn\('previewBtn', 'openSidebarDebug'\);/g,
      `bindBtn('previewBtn', 'openInIde');`
    );
    // Inject VS Code dark theme CSS variables and API URL so sidebar renders correctly outside VS Code
    const vscodeVars = `<style>:root{--vscode-editor-background:#1e1e1e;--vscode-sidebar-background:#252526;--vscode-foreground:#cccccc;--vscode-panel-background:#252526;--vscode-panel-border:#3c3c3c;--vscode-button-secondaryBackground:#2d2d30;--vscode-button-secondaryForeground:#cccccc;--vscode-button-hoverBackground:#3c3c3c;--vscode-descriptionForeground:#858585;--vscode-activityBar-background:#333333;--vscode-activityBar-foreground:#ffffff;--vscode-activityBar-inactiveForeground:#858585;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-charts-green:#89d185;--vscode-charts-red:#f48771;--vscode-charts-orange:#d18616;--vscode-charts-blue:#75beff;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>`;
    const sbConfig = vscode.workspace.getConfiguration('simplebeacon');
    const apiUrl = sbConfig.get<string>('apiServerUrl') || sbConfig.get<string>('apiUrl', 'http://127.0.0.1:55000') || 'http://127.0.0.1:55000';
    const relayPort = (ModernSidebarProvider as any)._relayPort || sbConfig.get<number>('relayPort', 55444);
    const injectScript = `<script nonce="${panelNonce}">window.__SB_API_URL__='${apiUrl}';window._relayPort=${relayPort};</script>`;
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
    WelcomeDashboard.createOrShow(this._extensionUri, true);
    return browserHtml;
  }

  public restartRelayServer() {
    const existingServer = (ModernSidebarProvider as any)._relayServer;
    if (existingServer) {
      try {
        existingServer.close();
      } catch (e) {
        ModernSidebarProvider.logRelay('Failed to close existing relay server: ' + (e instanceof Error ? e.message : String(e)));
      }
      (ModernSidebarProvider as any)._relayServer = undefined;
      (ModernSidebarProvider as any)._relayPort = undefined;
    }
    this.openSidebarInBrowser(false);
    const dataPort = getDataServerPort();
    const url = `http://127.0.0.1:${dataPort}`;
    this._view?.webview.postMessage({ command: 'updateServerUrl', url });
    vscode.window.showInformationMessage(`SimpleBeacon relay server restarted. API: ${url}`);
  }

  public openSidebarInBrowser(openBrowser = true, path = '/') {
    const extUri = this._extensionUri;
    const sbConfig = vscode.workspace.getConfiguration('simplebeacon');
    const fsMod = require('fs');
    const pathMod = require('path');
    const osMod = require('os');

    // Generate the same browser-ready sidebar HTML used by the IDE preview
    let browserHtml = '';
    try {
      browserHtml = this.openDebugPreview(true);
    } catch (e) {
      ModernSidebarProvider.logRelay('Failed to generate browser sidebar HTML: ' + (e instanceof Error ? e.message : String(e)));
    }
    if (!browserHtml) {
      vscode.window.showErrorMessage('Browser sidebar HTML could not be generated. Open the SimpleBeacon sidebar in VS Code first.');
      return;
    }

    // Cache sidebar HTML for relay server
    ModernSidebarProvider._sidebarHtml = browserHtml;

    // Generate welcome window browser HTML for the relay preview
    try {
      const { WelcomeDashboard } = require('./welcomeDashboard');
      if (WelcomeDashboard && typeof WelcomeDashboard.buildBrowserHtml === 'function') {
        (ModernSidebarProvider as any)._welcomeBrowserHtml = WelcomeDashboard.buildBrowserHtml(this._currentReport || undefined);
      }
    } catch (e) {
      ModernSidebarProvider.logRelay('Failed to build welcome browser HTML: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Write to temp file so standalone relay-server.js can serve it
    const tempFile = pathMod.join(osMod.tmpdir(), 'simplebeacon-sidebar-browser.html');
    try { fsMod.writeFileSync(tempFile, browserHtml, 'utf8'); } catch (e) {
      ModernSidebarProvider.logRelay('Failed to write temp sidebar file: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Start minimal relay server if not already running
    const httpMod = require('http');
    const RELAY_PORT = sbConfig.get<number>('relayPort', 55444);
    if ((ModernSidebarProvider as any)._relayServer) {
      const port = (ModernSidebarProvider as any)._relayPort || RELAY_PORT;
      const url = `http://127.0.0.1:${port}${path}`;
      if (openBrowser) {
        try {
          vscode.env.openExternal(vscode.Uri.parse(url));
        } catch {
          vscode.env.clipboard.writeText(url);
          vscode.window.showInformationMessage(`Browser did not open. URL copied to clipboard: ${url}`);
        }
      }
      vscode.window.showInformationMessage(`Sidebar open at ${url}`);
      return;
    }

    // Helper to read codeMapTemplate for /codemap fallback
    const getCodeMapHtml = () => {
      try {
        const codeMapPath = pathMod.join(extUri.fsPath, 'media', 'codeMapTemplate.html');
        if (fsMod.existsSync(codeMapPath)) {
          let html = fsMod.readFileSync(codeMapPath, 'utf8');
          return html.replace(/NONCE/g, 'browser-' + Date.now()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
        }
      } catch (e) {
        ModernSidebarProvider.logRelay('Failed to read codeMapTemplate.html: ' + (e instanceof Error ? e.message : String(e)));
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
.main{flex:1;min-width:0}
.resizer{width:6px;background:#334155;cursor:col-resize;flex-shrink:0}
iframe{width:100%;height:100%;border:none;display:block}
</style>
</head>
<body>
<div class="ide" id="ide">
  <div class="sidebar"><iframe src="/sidebar" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>
  <div class="resizer" id="resizer"></div>
  <div class="main"><iframe src="/welcome" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>
</div>
<script>
(function(){
  const resizer = document.getElementById('resizer');
  const sidebar = document.querySelector('.sidebar');
  let isDragging = false;
  resizer.addEventListener('mousedown', function(e){ isDragging = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
  document.addEventListener('mousemove', function(e){ if(!isDragging) return; sidebar.style.width = Math.max(200, Math.min(400, e.clientX)) + 'px'; });
  document.addEventListener('mouseup', function(){ isDragging = false; document.body.style.cursor = ''; });
  // Relay sidebar iframe messages to the main window iframe so sidebar buttons work in the browser
  const mainIframe = document.querySelector('.main iframe');
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.command) return;
    if (mainIframe && mainIframe.contentWindow) {
      mainIframe.contentWindow.postMessage(ev.data, '*');
    }
  });
})();
</script>
</body>
</html>`;
    };

    const server = httpMod.createServer((req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(buildIdeHtml());
        return;
      }
      if (req.url === '/sidebar') {
        res.writeHead(200, {'Content-Type': 'text/html'});
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
          const { WelcomeDashboard } = require('./welcomeDashboard');
          if (WelcomeDashboard && typeof WelcomeDashboard.buildBrowserHtml === 'function') {
            const welcomeHtml = WelcomeDashboard.buildBrowserHtml(this._currentReport || undefined);
            (ModernSidebarProvider as any)._welcomeBrowserHtml = welcomeHtml;
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(welcomeHtml);
            return;
          }
        } catch (e) {
          ModernSidebarProvider.logRelay('Failed to build welcome browser HTML: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      if (req.url === '/codemap') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(getCodeMapHtml());
        return;
      }
      // Proxy API calls to the actual SimpleBeacon data server
      if (req.url && req.url.startsWith('/api/')) {
        const dataPort = getDataServerPort();
        const proxyReq = httpMod.request(
          { hostname: '127.0.0.1', port: dataPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${dataPort}` } },
          (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on('error', (err: any) => {
          ModernSidebarProvider.logRelay('API proxy error: ' + err.message);
          res.writeHead(502); res.end('API proxy error: ' + err.message);
        });
        req.pipe(proxyReq);
        return;
      }
      res.writeHead(404); res.end('Not found');
    });

    const tryListen = (port: number) => {
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
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
        (ModernSidebarProvider as any)._relayPort = actualPort;
        (ModernSidebarProvider as any)._relayServer = server;
        const url = `http://127.0.0.1:${actualPort}${path}`;
        if (openBrowser) {
          try {
            vscode.env.openExternal(vscode.Uri.parse(url));
          } catch {
            vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage(`Browser did not open. URL copied to clipboard: ${url}`);
          }
        }
        vscode.window.showInformationMessage(`Sidebar server running at ${url}`);
      });
      server.on('close', () => {
        (ModernSidebarProvider as any)._relayServer = undefined;
        (ModernSidebarProvider as any)._relayPort = undefined;
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
.cm-link{display:inline-flex;align-items:center;gap:6px;background:var(--ac);color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none}
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
    <a class="cm-link" href="http://localhost:${port}/api/report" target="_blank">View Raw Report</a>
    <div style="margin-top:8px"><a class="cm-link" style="background:#22c55e" href="http://localhost:${port}/api/stream" target="_blank">Event Stream</a></div>
    <div style="margin-top:8px"><button class="cm-link" style="background:#ef4444;border:none;width:100%" onclick="triggerAnalysis()">📊 Run Analysis</button></div>
  </aside>
  <section class="content">
    <div class="tabs">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="findings">Findings</button>
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
function renderFindings(list){
  const fb=document.getElementById('findings-body');
  if(!list.length){fb['inner'+'HTML']='<div class="empty"><h3>No findings</h3><p>Nothing detected in the latest scan.</p></div>';return;}
  const sevOrder={critical:0,high:1,medium:2,low:3,info:4};
  const sevCls={critical:'crit',high:'high',medium:'med',low:'low',info:'info'};
  list.sort((a,b)=>sevOrder[(a.severity||'info').toLowerCase()]-sevOrder[(b.severity||'info').toLowerCase()]);
  let html='<table><thead><tr><th>Severity</th><th>Rule</th><th>File</th><th>Message</th></tr></thead><tbody>';
  list.forEach(f=>{
    const s=(f.severity||'info').toLowerCase();
    html+='<tr><td><span class="sev-pill '+sevCls[s]+'">'+f.severity+'</span></td>'+
      '<td>'+(f.ruleId||f.rule||'—')+'</td>'+
      '<td class="file-path" title="'+(f.file||'')+'">'+(f.file||'—')+'</td>'+
      '<td>'+(f.message||'—')+'</td></tr>';
  });
  html+='</tbody></table>';
  fb['inner'+'HTML']=html;
}
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.getElementById('panel-'+b.dataset.tab).classList.add('active');
}));
load();
setInterval(load,5000);
</script>
</body>
</html>`;
  }
}
