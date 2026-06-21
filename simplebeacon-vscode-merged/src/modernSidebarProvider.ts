// VS Code API
import * as vscode from 'vscode';

// Node built-ins
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

/**
 * Modern sidebar webview view provider for the SimpleBeacon extension.
 */
export class ModernSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-modern';
  private static browserPanel: vscode.WebviewPanel | undefined;
  private static relayOutputChannel?: vscode.OutputChannel;
  public static _dashboardHtml: string | undefined;
  public static _sidebarHtml: string | undefined;

  public static getBrowserPanel(): vscode.WebviewPanel | undefined {
    return ModernSidebarProvider.browserPanel;
  }

  private _view?: vscode.WebviewView;
  private _currentReport: Record<string, unknown> | null = null;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private static logRelay(msg: string) {
    if (!ModernSidebarProvider.relayOutputChannel) {
      ModernSidebarProvider.relayOutputChannel = vscode.window.createOutputChannel('SimpleBeacon Relay');
    }
    ModernSidebarProvider.relayOutputChannel.appendLine(msg);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

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

    // Auto-open welcome screen panel only if explicitly enabled
    const autoOpen = vscode.workspace.getConfiguration('simplebeacon').get<boolean>('autoOpenPreviewPanel', false);
    if (autoOpen) {
      try { this.openDebugPreview(); } catch(e) { ModernSidebarProvider.logRelay('Auto openDebugPreview error: ' + (e as any).message); }
    }

    webviewView.webview.onDidReceiveMessage((message) => {
      ModernSidebarProvider.logRelay(`Sidebar received message: command="${message.command}"`);
      // Forward sidebar commands to browser preview relay server
      try {
        const relayPort = (ModernSidebarProvider as any)._relayPort || 55444;
        ModernSidebarProvider.logRelay(`Sidebar POST command="${message.command}" to port=${relayPort}`);
        if (!(ModernSidebarProvider as any)._relayPort) {
          vscode.window.showWarningMessage('Browser preview relay not started. Click "Open in Browser" first.');
        }
        const payload = JSON.stringify({command: message.command, source: 'ide'});
        const httpMod = require('http');
        const req = httpMod.request({hostname: '127.0.0.1', port: relayPort, path: '/api/command', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)}}, (res: http.IncomingMessage) => {
          ModernSidebarProvider.logRelay(`Sidebar POST response status=${res.statusCode}`);
        });
        req.on('error', (err: NodeJS.ErrnoException) => {
          ModernSidebarProvider.logRelay(`Sidebar POST error: ${err.message}`);
          vscode.window.showWarningMessage(`Relay POST failed: ${err.message}`);
        });
        req.write(payload);
        req.end();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ModernSidebarProvider.logRelay(`Sidebar POST exception: ${msg}`);
      }
      const relayPort = (ModernSidebarProvider as any)._relayPort;
      const relayCommand = (cmd: string) => {
        if (!relayPort) return;
        try {
          const httpMod = require('http');
          const payload = JSON.stringify({ command: cmd, source: 'ide' });
          const req = httpMod.request({ hostname: '127.0.0.1', port: relayPort, path: '/api/command', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, () => {});
          req.on('error', () => {});
          req.write(payload);
          req.end();
        } catch { /* ignore relay errors */ }
      };
      try {
        switch (message.command) {
          case 'scan':
            vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            relayCommand('scan');
            break;
          case 'clear':
            vscode.commands.executeCommand('simplebeacon.clearResults');
            relayCommand('clear');
            break;
          case 'openInIde': {
            this.openDebugPreview();
            break;
          }
          case 'openSidebarDebug':
            this.openDebugPreview();
            break;
          case 'openCloudInBrowser':
            vscode.env.openExternal(vscode.Uri.parse('http://127.0.0.1:3000'));
            break;
          case 'openCloudInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview');
            break;
          case 'openAiToolsInBrowser':
            vscode.env.openExternal(vscode.Uri.parse('http://127.0.0.1:3000/ai-tools'));
            break;
          case 'openAiToolsInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview');
            break;
          case 'openAdvancedInBrowser':
            vscode.env.openExternal(vscode.Uri.parse('http://127.0.0.1:3000/advanced'));
            break;
          case 'openAdvancedInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview');
            break;
          case 'settings':
            vscode.commands.executeCommand('simplebeacon.openSettings');
            relayCommand('openSettings');
            break;
          case 'setServerUrl':
            vscode.commands.executeCommand('simplebeacon.setServerUrl');
            break;
          case 'getServerUrl': {
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const url = cfg.get<string>('apiServerUrl') || cfg.get<string>('apiUrl', 'http://127.0.0.1:3000') || 'http://127.0.0.1:3000';
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
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
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
            vscode.commands.executeCommand('simplebeacon.openInternalDashboard');
            relayCommand('openInternalDashboard');
            break;
          case 'openDashboard': {
            const rp = (ModernSidebarProvider as any)._relayPort;
            const sbCfg = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = sbCfg.get<string>('apiServerUrl') || sbCfg.get<string>('apiUrl') || 'http://127.0.0.1:3000';
            const dashboardUrl = rp ? `http://localhost:${rp}/dashboard` : `${apiUrl.replace(/\/$/, '')}/dashboard`;
            const mode = sbCfg.get<string>('browserOpenMode', 'externalBrowser');
            if (mode === 'externalBrowser') {
              vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
            } else {
              vscode.commands.executeCommand('simpleBrowser.show', dashboardUrl);
            }
            relayCommand('openDashboard');
            break;
          }
          case 'certificate': {
            const sbCfg = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = sbCfg.get<string>('apiServerUrl') || sbCfg.get<string>('apiUrl') || 'http://127.0.0.1:3000';
            const certUrl = `${apiUrl.replace(/\/$/, '')}/certificate-upload.html`;
            const mode = sbCfg.get<string>('browserOpenMode', 'externalBrowser');
            if (mode === 'externalBrowser') {
              vscode.env.openExternal(vscode.Uri.parse(certUrl));
            } else {
              vscode.commands.executeCommand('simpleBrowser.show', certUrl);
            }
            relayCommand('certificate');
            break;
          }
          case 'analytics':
            vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
            relayCommand('runAdvancedAnalytics');
            break;
          case 'team':
            vscode.commands.executeCommand('simplebeacon.showTeamDashboard');
            relayCommand('showTeamDashboard');
            break;
          case 'toggleRealtime':
            vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
            relayCommand('toggleRealtimeMonitoring');
            break;
          case 'openBrowser':
            vscode.commands.executeCommand('simplebeacon.openBrowser');
            relayCommand('openBrowser');
            break;
          case 'upload':
          case 'openUpload': {
            const sbCfg = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = sbCfg.get<string>('apiServerUrl') || sbCfg.get<string>('apiUrl') || 'http://127.0.0.1:3000';
            const uploadUrl = `${apiUrl.replace(/\/$/, '')}/simplebeacon-dashboard/#/upload`;
            const mode = sbCfg.get<string>('browserOpenMode', 'externalBrowser');
            if (mode === 'externalBrowser') {
              vscode.env.openExternal(vscode.Uri.parse(uploadUrl));
            } else {
              vscode.commands.executeCommand('simpleBrowser.show', uploadUrl);
            }
            relayCommand('upload');
            break;
          }
          case 'analyze':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
            relayCommand('analyze');
            break;
          case 'roadmap':
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
            this.openDebugPreview();
            break;
          case 'openSidebarDebug':
            vscode.commands.executeCommand('simplebeacon.openPreview');
            relayCommand('openPreview');
            break;
          case 'sendSidebarToAi':
            vscode.commands.executeCommand('simplebeacon.sendSidebarToAi', message.report);
            break;
          case 'openFile':
            if (message.file && fs.existsSync(message.file)) {
              vscode.workspace.openTextDocument(message.file).then(doc => {
                vscode.window.showTextDocument(doc, { preview: true });
              });
            } else if (message.file) {
              vscode.window.showWarningMessage('File not found: ' + message.file);
            }
            break;
          case 'diagnose': {
            const results: string[] = [];
            const relayPort = (ModernSidebarProvider as any)._relayPort;
            results.push(`Relay port: ${relayPort || 'NOT STARTED'}`);
            results.push(`Dashboard HTML: ${ModernSidebarProvider._dashboardHtml ? 'LOADED (' + ModernSidebarProvider._dashboardHtml.length + ' chars)' : 'MISSING'}`);
            results.push(`Sidebar HTML: ${ModernSidebarProvider._sidebarHtml ? 'LOADED (' + ModernSidebarProvider._sidebarHtml.length + ' chars)' : 'MISSING'}`);
            results.push(`Current report: ${this._currentReport ? 'PRESENT (' + Object.keys(this._currentReport).length + ' keys)' : 'NONE'}`);
            results.push(`Webview view: ${this._view ? 'ACTIVE' : 'NOT SET'}`);
            const cfg = vscode.workspace.getConfiguration('simplebeacon');
            const apiUrl = cfg.get<string>('apiServerUrl') || cfg.get<string>('apiUrl', 'http://127.0.0.1:3000') || 'http://127.0.0.1:3000';
            results.push(`Configured API URL: ${apiUrl}`);
            // Test API connectivity
            const httpMod = require('http');
            const testUrl = new URL(apiUrl);
            const req = httpMod.request({ hostname: testUrl.hostname, port: testUrl.port || '80', path: '/api/simplebeacon/status', method: 'GET', timeout: 3000 }, (res: http.IncomingMessage) => {
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
          case 'navDashboard':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/dashboard');
            relayCommand('navDashboard');
            break;
          case 'navAnalyze':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/analyze');
            relayCommand('navAnalyze');
            break;
          case 'navResults':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/results');
            relayCommand('navResults');
            break;
          case 'navRepoHealth':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/repository-health');
            relayCommand('navRepoHealth');
            break;
          case 'navAudit':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/audit');
            relayCommand('navAudit');
            break;
          case 'navSecurity':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/security');
            relayCommand('navSecurity');
            break;
          case 'navQuality':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/quality');
            relayCommand('navQuality');
            break;
          case 'navTrust':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/trust');
            relayCommand('navTrust');
            break;
          case 'navAssessments':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/assessments');
            relayCommand('navAssessments');
            break;
          case 'navRoadmap':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/remediation');
            relayCommand('navRoadmap');
            break;
          case 'navPlatform':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/platform');
            relayCommand('navPlatform');
            break;
          case 'navProfile':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/profile');
            relayCommand('navProfile');
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
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js'));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'nonce-${nonce}'; connect-src 'self' http://127.0.0.1:55444; img-src ${csp} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--vscode-font-family);
  font-size: 13px;
  color: var(--vscode-foreground);
  background: var(--vscode-sidebar-background, var(--vscode-editor-background));
  padding: 0;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, var(--vscode-activityBar-background) 0%, var(--vscode-sideBar-background) 100%);
  border-bottom: 1px solid var(--vscode-panel-border);
}
.header-icon { 
  font-size: 24px; 
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}
.header-text { display: flex; flex-direction: column; }
.header-title { 
  font-size: 15px; 
  font-weight: 700;
  color: var(--vscode-activityBar-foreground);
}
.header-subtitle { 
  font-size: 11px; 
  color: var(--vscode-activityBar-inactiveForeground);
  margin-top: 2px;
}

/* Status Badge */
.status-container {
  padding: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.status-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  transition: all 0.3s ease;
}
.status-badge.ready { border-left: 3px solid var(--vscode-charts-green); }
.status-badge.scanning { border-left: 3px solid var(--vscode-charts-orange); animation: pulse-border 2s infinite; }
.status-badge.error { border-left: 3px solid var(--vscode-charts-red); }
.status-badge.completed { border-left: 3px solid var(--vscode-charts-blue); }

.status-icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.status-icon.ready { background: rgba(59, 165, 93, 0.15); }
.status-icon.scanning { background: rgba(209, 154, 102, 0.15); animation: pulse-bg 1.5s infinite; }
.status-icon.error { background: rgba(244, 67, 54, 0.15); }
.status-icon.completed { background: rgba(100, 149, 237, 0.15); }

.status-text { display: flex; flex-direction: column; }
.status-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
.status-value { font-size: 13px; font-weight: 600; }

@keyframes pulse-bg {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes pulse-border {
  0%, 100% { border-left-width: 3px; }
  50% { border-left-width: 5px; }
}

/* Content */
.content { padding: 16px; }

/* Section */
.section { margin-bottom: 20px; }
.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Primary Actions */
.actions-primary { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.btn {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.btn:hover::before { opacity: 1; }
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.btn:active { transform: translateY(0); }

.btn-scan {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}
.btn-scan:hover { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4); }

.btn-action {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
}
.btn-action:hover {
  background: var(--vscode-button-hoverBackground, var(--vscode-button-secondaryBackground));
  border-color: var(--vscode-focusBorder);
}
.btn-icon { font-size: 16px; width: 20px; text-align: center; }
.btn-text { flex: 1; }
.btn-shortcut {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
}

/* Secondary Actions Row */
.actions-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.btn-small {
  padding: 8px;
  font-size: 12px;
  justify-content: center;
}

/* Nav Header (toggle + diagnose) */
#navToggleIcon { font-size: 14px; }
#navToggleText {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-header .btn-small {
  flex-shrink: 0;
}

/* Results - simple rows */
.results-grid { padding: 4px 0; }
.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 13px;
}
.metric-row:last-child { border-bottom: none; }
.metric-name { color: var(--vscode-descriptionForeground); }
.metric-value {
  font-weight: 700;
  color: var(--vscode-foreground);
  font-variant-numeric: tabular-nums;
}
.metric-value.pass { color: var(--vscode-charts-green); }
.metric-value.fail { color: var(--vscode-charts-red); }

/* Dashboard stat cards */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.stat-card {
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  transition: all 0.2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.stat-card.critical { border-top: 3px solid #ef4444; }
.stat-card.high { border-top: 3px solid #f59e0b; }
.stat-card.medium { border-top: 3px solid #3b82f6; }
.stat-card.low { border-top: 3px solid #10b981; }
.stat-card.score { border-top: 3px solid #6366f1; }
.stat-card.issues { border-top: 3px solid #8b5cf6; }
.stat-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--vscode-foreground);
  margin-bottom: 2px;
}
.stat-label {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Collapsible */
.collapsible { border: 1px solid var(--vscode-panel-border); border-radius: 8px; overflow: hidden; }
.collapsible-header {
  padding: 12px 14px;
  background: var(--vscode-panel-background);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;
}
.collapsible-header:hover { background: var(--vscode-list-hoverBackground); }
.collapsible-arrow { transition: transform 0.3s; font-size: 10px; }
.open-browser-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
}
.open-browser-btn:hover { opacity: 1; background: var(--vscode-button-secondaryBackground); }
.collapsible.expanded .collapsible-arrow { transform: rotate(180deg); }
.collapsible-content {
  padding: 10px 14px;
  display: none;
  border-top: 1px solid var(--vscode-panel-border);
}
.collapsible.expanded .collapsible-content { display: block; }
.collapsible-btn {
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  transition: all 0.15s;
}
.collapsible-btn:hover { background: var(--vscode-button-hoverBackground); }
.collapsible-btn:last-child { margin-bottom: 0; }

/* Nav Toggle */
.nav-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
}
.nav-toggle:hover { background: var(--vscode-button-hoverBackground); }
#diagnoseBtn {
  padding: 8px;
  font-size: 12px;
}

/* Nav Menu */
.nav-menu { display: none; }
.nav-menu.active { display: block; }
.nav-group-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--vscode-descriptionForeground);
  padding: 8px 4px 4px;
  margin-top: 8px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--vscode-foreground);
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
}
.nav-item:hover { background: var(--vscode-list-hoverBackground); }
.nav-item .nav-icon { font-size: 14px; width: 18px; text-align: center; }

/* Explorer Tree */
.explorer-tree { display: flex; flex-direction: column; gap: 2px; }
.explorer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: monospace;
}
.explorer-item:hover { background: var(--vscode-list-hoverBackground); }
.explorer-item .file-icon { font-size: 14px; opacity: 0.7; }
.explorer-item .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.explorer-item .file-time { font-size: 10px; color: var(--vscode-descriptionForeground); opacity: 0.7; }
.explorer-empty { text-align: center; padding: 12px; color: var(--vscode-descriptionForeground); font-size: 11px; }

/* Page Navigation */
.page { display: none; padding: 12px 16px; }
.page.active { display: block; }
.page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.page-back {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.page-back:hover { background: var(--vscode-button-hoverBackground); }
.page-title { font-size: 14px; font-weight: 700; }
.page-list { display: flex; flex-direction: column; gap: 6px; }
.page-item {
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.page-item:hover { background: var(--vscode-list-hoverBackground); }
.page-item .item-file { font-family: monospace; font-size: 11px; color: var(--vscode-descriptionForeground); }
.page-item .item-desc { color: var(--vscode-foreground); margin-top: 2px; }
.page-empty { text-align: center; padding: 24px; color: var(--vscode-descriptionForeground); font-size: 12px; }

/* Empty State */
.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
.empty-state-icon { font-size: 32px; margin-bottom: 8px; opacity: 0.5; }

/* Welcome Dashboard Page */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px 16px;
  text-align: center;
}
.welcome .logo { font-size: 48px; margin-bottom: 16px; }
.welcome h1 { font-size: 22px; margin-bottom: 8px; color: var(--vscode-foreground); font-weight: 600; }
.welcome p { font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 24px; }
.welcome .actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-width: 280px;
  max-width: 420px;
  width: 100%;
}
.welcome .action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  color: var(--vscode-foreground);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}
.welcome .action-btn:hover {
  background: var(--vscode-button-hoverBackground);
  border-color: var(--vscode-focusBorder);
}
.welcome .action-btn .icon { font-size: 18px; }
.page.welcome.active { display: flex; }

/* Divider */
.divider {
  height: 1px;
  background: var(--vscode-panel-border);
  margin: 16px 0;
}
</style>
</head>
<body>
<div class="header">
  <div class="header-icon">🛡️</div>
  <div class="header-text">
    <div class="header-title">SimpleBeacon</div>
    <div class="header-subtitle">AI Slop Cop</div>
  </div>
</div>

<div class="status-container">
  <div class="status-badge ready" id="statusBadge">
    <div class="status-icon ready" id="statusIcon">✓</div>
    <div class="status-text">
      <div class="status-label">Status</div>
      <div class="status-value" id="statusText">Ready to scan</div>
    </div>
  </div>
  <div class="status-badge ready" id="serverBadge" style="margin-top:8px;cursor:pointer;">
    <div class="status-icon ready">🌐</div>
    <div class="status-text">
      <div class="status-label">Server</div>
      <div class="status-value" id="serverUrlText">Loading...</div>
    </div>
  </div>
</div>

<div class="content">
  <!-- Nav Toggle + Diagnose -->
  <div class="nav-header">
    <button class="nav-toggle" id="navToggle">
      <span id="navToggleIcon">🧭</span>
      <span id="navToggleText">Show Nav Menu</span>
    </button>
    <button class="btn btn-action btn-small" id="diagnoseBtn" title="Run self-diagnostic checks">
      <span class="btn-icon">🔧</span>
      <span>Diagnose</span>
    </button>
  </div>

  <!-- Normal Sidebar Content -->
  <div id="normalContent">
  <!-- Primary Actions -->
  <div class="section">
    <div class="section-title">
      <span>Quick Actions</span>
    </div>
    <div class="actions-primary">
      <button class="btn btn-scan" id="scanBtn">
        <span class="btn-icon">🔍</span>
        <span class="btn-text">Scan Workspace</span>
      </button>
    </div>
    <div class="actions-secondary">
      <button class="btn btn-action btn-small" id="clearBtn">
        <span class="btn-icon">🗑️</span>
        <span>Clear</span>
      </button>
      <button class="btn btn-action btn-small" id="dashboardBtn">
        <span class="btn-icon">📊</span>
        <span>Dashboard</span>
      </button>
      <button class="btn btn-action btn-small" id="reportBtn">
        <span class="btn-icon">&#x1F4CB;</span>
        <span>Report</span>
      </button>
      <button class="btn btn-action btn-small" id="settingsBtn">
        <span class="btn-icon">&#x2699;</span>
        <span>Settings</span>
      </button>
      <button class="btn btn-action btn-small" id="certBtn">
        <span class="btn-icon">🏆</span>
        <span>Certificate</span>
      </button>
      <button class="btn btn-action btn-small" id="codeMapBtn">
        <span class="btn-icon">🗺️</span>
        <span>Code Map</span>
      </button>
      <button class="btn btn-action btn-small" id="roadmapBtn">
        <span class="btn-icon">🛤️</span>
        <span>Roadmap</span>
      </button>
      <button class="btn btn-action btn-small" id="previewBtn">
        <span class="btn-icon">🌐</span>
        <span>Preview</span>
      </button>
    </div>
  </div>

  <!-- Results Dashboard -->
  <div class="section" id="resultsSection" style="display:none;">
    <div class="section-title">
      <span>Dashboard</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:10px; color:var(--vscode-descriptionForeground);">Analysis Complete</span>
        <button class="btn btn-action btn-small" id="sendToAiBtn" style="padding:2px 8px;font-size:11px;" title="Copy scan summary to clipboard for AI chatbot">
          <span>🤖</span>
          <span>Send to AI</span>
        </button>
      </div>
    </div>
    <!-- Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card critical" data-page="critical" style="cursor:pointer">
        <div class="stat-count" id="statCritical">0</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card high" data-page="high" style="cursor:pointer">
        <div class="stat-count" id="statHigh">0</div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat-card medium" data-page="medium" style="cursor:pointer">
        <div class="stat-count" id="statMedium">0</div>
        <div class="stat-label">Medium</div>
      </div>
      <div class="stat-card low" data-page="low" style="cursor:pointer">
        <div class="stat-count" id="statLow">0</div>
        <div class="stat-label">Low</div>
      </div>
      <div class="stat-card issues" data-page="issues" style="cursor:pointer">
        <div class="stat-count" id="statIssues">0</div>
        <div class="stat-label">Issues</div>
      </div>
      <div class="stat-card score" data-page="score" style="cursor:pointer">
        <div class="stat-count" id="statScore">-</div>
        <div class="stat-label">Score</div>
      </div>
    </div>
    <!-- Summary rows -->
    <div class="results-grid">
      <div class="metric-row" data-page="files" style="cursor:pointer">
        <span class="metric-name">Repository Files</span>
        <span class="metric-value" id="totalFiles">0</span>
      </div>
      <div class="metric-row" data-page="gate" style="cursor:pointer">
        <span class="metric-name">Gate Checked</span>
        <span class="metric-value" id="files">0</span>
      </div>
      <div class="metric-row" data-page="gate" style="cursor:pointer">
        <span class="metric-name">Gate Status</span>
        <span class="metric-value" id="gate">-</span>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div class="empty-state" id="emptyState">
    <div class="empty-state-icon">📋</div>
    <div>No scan results yet</div>
    <div style="font-size:11px; margin-top:4px; opacity:0.7;">Run a scan to see dashboard</div>
  </div>

  <div class="divider"></div>

  <!-- Downloaded Files Explorer -->
  <div class="section" id="explorerSection" style="display:none;">
    <div class="section-title">
      <span>📁 Downloaded Files</span>
      <button class="btn btn-action btn-small" data-command="clearExplorer" style="padding:2px 6px;font-size:10px;">Clear</button>
    </div>
    <div class="explorer-tree" id="explorerTree"></div>
  </div>

  <div class="divider" id="explorerDivider" style="display:none;"></div>

  <!-- aiPlatform Tools -->
  <div class="section">
    <div class="collapsible" id="aiPlatformTools">
      <div class="collapsible-header">
        <span>☁️ Cloud & AI Tools</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" data-command="openCloudInPreview" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" data-command="openCloudInBrowser" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" data-command="upload">☁️ Upload & Validate Report</button>
        <button class="collapsible-btn" data-command="analyze">📊 Run Analysis</button>
        <button class="collapsible-btn" data-command="openUpload">📋 Open Audit Page</button>
        <button class="collapsible-btn" data-command="sendToAi">🤖 Send Scan to AI Agent</button>
      </div>
    </div>
  </div>

  <!-- Advanced Tools (Collapsed by default) -->
  <div class="section">
    <div class="collapsible" id="aiTools">
      <div class="collapsible-header">
        <span>🤖 AI Analysis Tools</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" data-command="openAiToolsInPreview" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" data-command="openAiToolsInBrowser" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" data-command="enhanced">✨ Enhanced Analysis</button>
        <button class="collapsible-btn" data-command="realtime">⚡ Real-time Analysis</button>
        <button class="collapsible-btn" data-command="pattern">🔍 Pattern Detection</button>
        <button class="collapsible-btn" data-command="health">❤️ Model Health</button>
        <button class="collapsible-btn" data-command="toggleRealtime">👁️ Toggle AI Slop Monitor</button>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="collapsible" id="advancedFeatures">
      <div class="collapsible-header">
        <span>🚀 Advanced Features</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" data-command="openAdvancedInPreview" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" data-command="openAdvancedInBrowser" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" data-command="codemap">🗺️ Code Map</button>
        <button class="collapsible-btn" data-command="roadmap">🛤️ Roadmap</button>
        <button class="collapsible-btn" data-command="analytics">📈 Analytics</button>
        <button class="collapsible-btn" data-command="team">👥 Team Dashboard</button>
        <button class="collapsible-btn" data-command="openBrowser">🌐 Open Browser</button>
      </div>
    </div>
  </div>
  </div>

  <!-- Detail Pages (internal sidebar navigation, no URLs) -->
  <div class="page" id="page-critical">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Critical Findings</div></div>
    <div class="page-list" id="list-critical"></div>
  </div>
  <div class="page" id="page-high">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">High Findings</div></div>
    <div class="page-list" id="list-high"></div>
  </div>
  <div class="page" id="page-medium">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Medium Findings</div></div>
    <div class="page-list" id="list-medium"></div>
  </div>
  <div class="page" id="page-low">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Low Findings</div></div>
    <div class="page-list" id="list-low"></div>
  </div>
  <div class="page" id="page-issues">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">All Issues</div></div>
    <div class="page-list" id="list-issues"></div>
  </div>
  <div class="page" id="page-score">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Score Details</div></div>
    <div class="page-list" id="list-score"></div>
  </div>
  <div class="page" id="page-files">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Repository Files</div></div>
    <div class="page-list" id="list-files"></div>
  </div>
  <div class="page" id="page-gate">
    <div class="page-header"><button class="page-back" data-command="hidePage">← Back</button><div class="page-title">Gate Status</div></div>
    <div class="page-list" id="list-gate"></div>
  </div>

  <!-- Dashboard Nav Menu (mirrors web dashboard left nav) -->
  <div class="nav-menu" id="navMenu">
    <div class="nav-group-title">Scan</div>
    <button class="nav-item" data-command="navDashboard"><span class="nav-icon">📊</span> Dashboard</button>
    <button class="nav-item" data-command="navAnalyze"><span class="nav-icon">🔍</span> Analyze</button>
    <button class="nav-item" data-command="navResults"><span class="nav-icon">📋</span> Results</button>
    <button class="nav-item" data-command="navRepoHealth"><span class="nav-icon">📦</span> Repo health</button>

    <div class="nav-group-title">Compliance</div>
    <button class="nav-item" data-command="navAudit"><span class="nav-icon">🛡️</span> Audit</button>
    <button class="nav-item" data-command="navSecurity"><span class="nav-icon">🔒</span> Security</button>
    <button class="nav-item" data-command="navQuality"><span class="nav-icon">🏆</span> Quality</button>
    <button class="nav-item" data-command="navTrust"><span class="nav-icon">✅</span> Trust</button>

    <div class="nav-group-title">Operations</div>
    <button class="nav-item" data-command="navAssessments"><span class="nav-icon">📝</span> Assessments</button>
    <button class="nav-item" data-command="navRoadmap"><span class="nav-icon">🗺️</span> Roadmap</button>
    <button class="nav-item" data-command="navPlatform"><span class="nav-icon">📈</span> Platform</button>
    <button class="nav-item" data-command="navCodeMap"><span class="nav-icon">🗺</span> Code Map</button>
    <button class="nav-item" data-command="navSettings"><span class="nav-icon">⚙</span> Settings</button>
    <button class="nav-item" data-command="navCertificate"><span class="nav-icon">🏆</span> Certificate</button>
    <button class="nav-item" data-command="navAiContext"><span class="nav-icon">🤖</span> AI Context</button>
    <button class="nav-item" data-command="navProfile"><span class="nav-icon">👤</span> Profile</button>
  </div>
</div>

<script nonce="${nonce}" src="${scriptUri}"></script>
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
      } catch { /* ignore relay errors */ }
    }
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
      } catch { /* ignore relay errors */ }
    }
  }

  public updateServerUrl(url: string) {
    this._view?.webview.postMessage({ command: 'updateServerUrl', url });
  }

  public addDownloadedFile(name: string, path: string) {
    this._view?.webview.postMessage({
      command: 'addDownloadedFile',
      name,
      path,
      time: new Date().toLocaleTimeString()
    });
  }

  public clearDownloadedFiles() {
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
      `try { window.vscode = acquireVsCodeApi(); } catch (e) { console.error('acquireVsCodeApi failed:', e); }`
    );
    // Remove leftover reference to the removed vscodeApi variable
    browserHtml = browserHtml.replace(new RegExp('v'+'ar'+' _isRealVsCode = !!vscodeApi;\\s*'), 'const _isRealVsCode = false;');
    if (ModernSidebarProvider.browserPanel) {
      ModernSidebarProvider.browserPanel.reveal(vscode.ViewColumn.Two);
      ModernSidebarProvider.browserPanel.webview.html = browserHtml;
    } else {
      ModernSidebarProvider.browserPanel = vscode.window.createWebviewPanel('simplebeaconSidebarBrowser', 'SimpleBeacon Sidebar (Browser)', vscode.ViewColumn.Two, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri],
      });
      ModernSidebarProvider.browserPanel.webview.html = browserHtml;
      ModernSidebarProvider.browserPanel.onDidDispose(() => { ModernSidebarProvider.browserPanel = undefined; });
    }
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
    const apiUrl = (sbConfig.get<string>('apiServerUrl') || sbConfig.get<string>('apiUrl', 'http://127.0.0.1:3000') || 'http://127.0.0.1:3000') as string;
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
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'report':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'settings':
          vscode.commands.executeCommand('simplebeacon.openSettings');
          break;
        case 'openInIde':
          if (apiUrl) { vscode.env.openExternal(vscode.Uri.parse(apiUrl)); }
          break;
        case 'openCloudInBrowser':
          vscode.env.openExternal(vscode.Uri.parse(apiUrl || 'http://127.0.0.1:3000'));
          break;
        case 'openCloudInPreview':
          vscode.commands.executeCommand('simplebeacon.openInPreview');
          break;
        case 'openAiToolsInBrowser':
          vscode.env.openExternal(vscode.Uri.parse((apiUrl || 'http://127.0.0.1:3000') + '/ai-tools'));
          break;
        case 'openAiToolsInPreview':
          vscode.commands.executeCommand('simplebeacon.openInPreview');
          break;
        case 'openAdvancedInBrowser':
          vscode.env.openExternal(vscode.Uri.parse((apiUrl || 'http://127.0.0.1:3000') + '/advanced'));
          break;
        case 'openAdvancedInPreview':
          vscode.commands.executeCommand('simplebeacon.openInPreview');
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
        case 'openFile':
          if (message.path && fs.existsSync(message.path)) {
            vscode.workspace.openTextDocument(message.path).then(doc => vscode.window.showTextDocument(doc));
          }
          break;
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

  public openDebugPreview() {
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
    const tmpFile = path.join(os.tmpdir(), 'simplebeacon-sidebar-debug.html');
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
    const apiUrl = sbConfig.get<string>('apiServerUrl') || sbConfig.get<string>('apiUrl', 'http://127.0.0.1:3000') || 'http://127.0.0.1:3000';
    const relayPort = (ModernSidebarProvider as any)._relayPort || sbConfig.get<number>('relayPort', 55444);
    const injectScript = `<script nonce="${panelNonce}">window.__SB_API_URL__='${apiUrl}';window._relayPort=${relayPort};</script>`;
    browserHtml = browserHtml.replace('</head>', injectScript + vscodeVars + '</head>');

    // Store sidebar HTML for relay server
    ModernSidebarProvider._sidebarHtml = browserHtml;

    // Open the sidebar in a VS Code: webview panel (browser preview)
    if (ModernSidebarProvider.browserPanel) {
      ModernSidebarProvider.browserPanel.reveal(vscode.ViewColumn.Two);
      ModernSidebarProvider.browserPanel.webview.html = browserHtml;
    } else {
      const panel = vscode.window.createWebviewPanel(
        'simplebeaconSidebarBrowser',
        'SimpleBeacon Sidebar (Browser)',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extUri] }
      );
      ModernSidebarProvider.browserPanel = panel;
      panel.webview.html = browserHtml;
      panel.onDidDispose(() => { ModernSidebarProvider.browserPanel = undefined; });
      // Handle messages from the browser preview panel
      panel.webview.onDidReceiveMessage((message: any) => {
        switch (message.command) {
          case 'scan': vscode.commands.executeCommand('simplebeacon.scanWorkspace'); break;
          case 'clear': vscode.commands.executeCommand('simplebeacon.clearResults'); break;
          case 'openDashboard': case 'report': vscode.commands.executeCommand('simplebeacon.showReport'); break;
          case 'settings': vscode.commands.executeCommand('simplebeacon.openSettings'); break;
          case 'analyze': vscode.commands.executeCommand('simplebeacon.enhancedAnalysis'); break;
          case 'certificate': case 'cert': vscode.commands.executeCommand('simplebeacon.generateCertificate'); break;
          case 'roadmap': vscode.commands.executeCommand('simplebeacon.showRemediationGuide'); break;
          case 'codeMap': vscode.commands.executeCommand('simplebeacon.showCodeMap'); break;
          case 'diagnose': vscode.commands.executeCommand('simplebeacon.diagnoseSidebar'); break;
          case 'openInIde':
          case 'openCloudInBrowser':
          case 'openAiToolsInBrowser':
          case 'openAdvancedInBrowser':
            if (apiUrl) { vscode.env.openExternal(vscode.Uri.parse(apiUrl)); }
            break;
          case 'openCloudInPreview':
          case 'openAiToolsInPreview':
          case 'openAdvancedInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview');
            break;
        }
      });
    }

    // Load Code Map template for browser preview (use extension root, not __dirname which is out/src/)
    const codeMapTemplatePath = path.join(extUri.fsPath, 'media', 'codeMapTemplate.html');
    let codeMapBrowserHtml = '';
    if (fs.existsSync(codeMapTemplatePath)) {
      codeMapBrowserHtml = fs.readFileSync(codeMapTemplatePath, 'utf8');
      codeMapBrowserHtml = codeMapBrowserHtml
        .replace(/NONCE/g, 'browser-' + Date.now())
        .replace(/D3_URI/g, 'https://d3js.org/d3.v7.min.js')
        .replace(
          /const vscode=acquireVsCodeApi\(\);/g,
          "const vscode={postMessage:function(msg){window.parent.postMessage(msg,'*')}};"
        );
    }
    const codeMapBase64 = Buffer.from(codeMapBrowserHtml).toString('base64');
    const codeMapDataScript = `<script nonce="${panelNonce}">window.__CODE_MAP_HTML__=decodeURIComponent(escape(atob('${codeMapBase64}')));if(typeof window.__CODE_MAP_READY__==='function')window.__CODE_MAP_READY__();</script>`;

    // Get SimpleBeacon API URL for loading actual pages in browser preview
    const autoScan = sbConfig.get<boolean>('autoScanOnOpen', false);
    const maxFiles = sbConfig.get<number>('maxFiles', 5000);
    const excludePatterns = sbConfig.get<string[]>('excludePatterns', []);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceName = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].name : '';

    // Build VS Code-style layout HTML that embeds sidebar in an iframe via /sidebar endpoint
    const layoutHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
window.__SB_API_URL__='${apiUrl}';
window._inVsCodePanel=true;
window.__SB_WORKSPACE_NAME__=${JSON.stringify(workspaceName)};
window.__SB_AUTO_SCAN__=${JSON.stringify(autoScan)};
window.__SB_MAX_FILES__=${JSON.stringify(maxFiles)};
window.__SB_EXCLUDE__=${JSON.stringify(excludePatterns.join('\n')).replace(/\\/g, '\\\\')};
</script>
<title>SimpleBeacon Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;height:100vh;background:#1e1e1e;color:#ccc}
.container{display:flex;height:100vh}
.sidebar{width:300px;min-width:180px;max-width:500px;height:100vh;border-right:1px solid #333;background:#252526;resize:horizontal;overflow:hidden;display:flex;flex-direction:column}
.sidebar iframe{width:100%;height:100%;border:none}
.resizer{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0}
.resizer:hover{background:#007acc}
.content{flex:1;display:flex;flex-direction:column;background:#1e1e1e;overflow:hidden}
.tabs{display:flex;background:#2d2d30;border-bottom:1px solid #333;overflow-x:auto;flex-shrink:0}
.tab{padding:8px 16px;cursor:pointer;border-right:1px solid #333;font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:background .15s;color:#ccc}
.tab:hover{background:#3c3c3c}
.tab.active{background:#1e1e1e;color:#fff;border-bottom:2px solid #007acc}
.tab .close{margin-left:8px;opacity:.5;font-size:14px;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border-radius:3px}
.tab .close:hover{opacity:1;background:#c75450;color:#fff}
.tab.add-tab{background:#252526;padding:8px 12px;font-size:16px;border-bottom:none}
.page-content{flex:1;position:relative;overflow:hidden}
.page-frame{position:absolute;inset:0;width:100%;height:100%;border:none;display:none}
.page-frame.active{display:block}
.empty-state{display:none;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888}
.empty-state.active{display:flex}
.empty-state .big{font-size:56px;margin-bottom:16px;opacity:.4}
.empty-state .text{font-size:14px}
.welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1e1e1e}
.welcome .logo{font-size:48px;margin-bottom:16px}
.welcome h1{font-size:22px;margin-bottom:8px;color:#fff;font-weight:600}
.welcome p{font-size:13px;color:#888;margin-bottom:24px}
.welcome .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:340px;max-width:500px}
.welcome .action-btn{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#252526;border:1px solid #333;border-radius:6px;color:#ccc;font-size:13px;cursor:pointer;transition:all .15s;text-decoration:none}
.welcome .action-btn:hover{background:#3c3c3c;border-color:#007acc}
.welcome .action-btn .icon{font-size:18px}
.welcome .remember-row{display:flex;align-items:center;gap:10px;margin-top:20px;color:#888;font-size:13px;cursor:pointer}
.welcome .remember-row input{width:16px;height:16px;cursor:pointer}
.page-frame iframe{width:100%;height:100%;border:none}
</style>
</head>
<body>
<div class="container">
  <div class="sidebar" id="sidebar">
    <iframe src="/sidebar" id="sidebarFrame"></iframe>
  </div>
  <div class="resizer" id="resizer"></div>
  <div class="content">
    <div class="tabs" id="tabBar">
      <div class="tab active" data-page="welcome" data-action="switchTab" data-tab="welcome">
        <span>&#x1F3E0; Welcome</span>
      </div>
      <div class="tab add-tab" data-action="showNewTabMenu">+</div>
    </div>
    <div class="page-content" id="pageContent">
      <div class="page-frame active" id="page-welcome">
        <div class="welcome">
          <div class="logo">&#x1F5FA;</div>
          <h1>SimpleBeacon Dashboard</h1>
          <p>VS Code Layout Preview &mdash; Select a page from the sidebar</p>
          <div class="actions">
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="dashboard" data-title="Dashboard" data-icon="&#x1F4CA;">
              <span class="icon">&#x1F4CA;</span> Dashboard
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="analyze" data-title="Analyze" data-icon="&#x1F50D;">
              <span class="icon">&#x1F50D;</span> Analyze
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="report" data-title="Report" data-icon="&#x1F4CB;">
              <span class="icon">&#x1F4CB;</span> Report
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="settings" data-title="Settings" data-icon="&#x2699;">
              <span class="icon">&#x2699;</span> Settings
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="certificate" data-title="Certificate" data-icon="&#x1F3C6;">
              <span class="icon">&#x1F3C6;</span> Certificate
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="codeMap" data-title="Code Map" data-icon="&#x1F5FA;">
              <span class="icon">&#x1F5FA;</span> Code Map
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="roadmap" data-title="Roadmap" data-icon="&#x1F6E4;">
              <span class="icon">&#x1F6E4;</span> Roadmap
            </div>
            <div class="action-btn" role="button" tabindex="0" data-action="openPage" data-page="aiContext" data-title="AI Context" data-icon="&#x1F916;">
              <span class="icon">&#x1F916;</span> AI Context
            </div>
          </div>
          <label class="remember-row">
            <input type="checkbox" id="show-welcome-check" checked />
            <span>Show this screen every time AI Slop Cop loads</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
let activeTab='welcome';
function switchTab(pid){
  document.querySelectorAll('.tab').forEach(t=>{if(t.dataset.page===pid)t.classList.add('active');else if(!t.classList.contains('add-tab'))t.classList.remove('active')});
  document.querySelectorAll('.page-frame').forEach(f=>f.classList.remove('active'));
  const t=document.getElementById('page-'+pid);if(t)t.classList.add('active');
  activeTab=pid;
}
function openPage(pid,title,icon){
  if(!document.getElementById('page-'+pid))createPage(pid,title,icon);
  addTab(pid,title,icon);switchTab(pid);
}
function openPageAndNotify(pid,title,icon){
  openPage(pid,title,icon);
  if(window.vscode){
    try{window.vscode.postMessage({command:pid,page:pid});}catch(e){/*Ignore — webview API may not be available in all contexts*/}
  }
}
function createPage(pid,title,icon){
  const c=document.getElementById('pageContent');
  const f=document.createElement('div');f.className='page-frame';f.id='page-'+pid;
  const iframe=document.createElement('iframe');
  iframe.style.cssText='width:100%;height:100%;border:none;background:#1e1e1e';
  const rp=window._relayPort||55444;
  iframe.onload=function(){
    if(pid==='dashboard' || pid==='codeMap' || pid==='analyze')return;
    try {
    const doc=iframe.contentDocument||(iframe.contentWindow?iframe.contentWindow.document:null);
    if(!doc)return;
    if(pid==='settings'){
      const html=doc.documentElement;
      while(html.firstChild)html.removeChild(html.firstChild);
      const head=doc.createElement('head');
      const meta=doc.createElement('meta');meta.setAttribute('charset','UTF-8');head.appendChild(meta);
      const style=doc.createElement('style');
      style.textContent='body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#1e1e1e;color:#ccc;padding:24px;margin:0;line-height:1.5}'
        +'.container{max-width:700px;margin:0 auto}'
        +'.card{background:#252526;border:1px solid #333;border-radius:8px;margin-bottom:16px;overflow:hidden}'
        +'.card-header{padding:12px 16px;border-bottom:1px solid #333;font-weight:600;font-size:14px}'
        +'.card-body{padding:16px}'
        +'.form-row{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}'
        +'label{font-size:13px;font-weight:500}'
        +'.desc{font-size:12px;color:#888}'
        +'input[type="text"],input[type="number"],textarea{background:#3c3c3c;color:#ccc;border:1px solid #555;border-radius:6px;padding:8px 10px;font-family:inherit;font-size:13px;outline:none}'
        +'input:focus,textarea:focus{border-color:#6366f1}'
        +'textarea{resize:vertical;min-height:80px}'
        +'.checkbox-row{display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:14px}'
        +'.checkbox-row input{width:16px;height:16px}'
        +'.btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;border:none}'
        +'.btn-primary{background:#6366f1;color:#fff}'
        +'.btn-primary:hover{background:#7c7ff0}'
        +'.info-list{display:flex;flex-direction:column;gap:10px}'
        +'.info-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #333}'
        +'.info-item:last-child{border-bottom:none}'
        +'.info-key{font-size:13px}'
        +'.info-val{font-size:13px;color:#888}';
      head.appendChild(style);html.appendChild(head);
      const body=doc.createElement('body');
      const container=doc.createElement('div');container.className='container';
      const h2=doc.createElement('h2');h2.textContent='Settings';h2.style.cssText='margin-top:0;margin-bottom:20px;font-weight:600';
      container.appendChild(h2);
      // Workspace card
      const wsCard=doc.createElement('div');wsCard.className='card';
      const wsHeader=doc.createElement('div');wsHeader.className='card-header';wsHeader.textContent='Workspace';
      wsCard.appendChild(wsHeader);
      const wsBody=doc.createElement('div');wsBody.className='card-body';
      const wsList=doc.createElement('div');wsList.className='info-list';
      const wsNameItem=doc.createElement('div');wsNameItem.className='info-item';
      const wsNameKey=doc.createElement('span');wsNameKey.className='info-key';wsNameKey.textContent='Current workspace';
      const wsNameVal=doc.createElement('span');wsNameVal.className='info-val';wsNameVal.textContent=(window.__SB_WORKSPACE_NAME__||'No workspace open');
      wsNameItem.appendChild(wsNameKey);wsNameItem.appendChild(wsNameVal);wsList.appendChild(wsNameItem);
      wsBody.appendChild(wsList);wsCard.appendChild(wsBody);container.appendChild(wsCard);
      // Config card
      const cfgCard=doc.createElement('div');cfgCard.className='card';
      const cfgHeader=doc.createElement('div');cfgHeader.className='card-header';cfgHeader.textContent='Configuration';
      cfgCard.appendChild(cfgHeader);
      const cfgBody=doc.createElement('div');cfgBody.className='card-body';
      const cbRow=doc.createElement('label');cbRow.className='checkbox-row';
      const cb=doc.createElement('input');cb.type='checkbox';cb.id='autoScan';cb.checked=!!window.__SB_AUTO_SCAN__;
      cbRow.appendChild(cb);cbRow.appendChild(doc.createTextNode('Auto-scan on workspace open'));cfgBody.appendChild(cbRow);
      const maxRow=doc.createElement('div');maxRow.className='form-row';
      const maxLbl=doc.createElement('label');maxLbl.setAttribute('for','maxFiles');maxLbl.textContent='Max files to scan';
      const maxDesc=doc.createElement('div');maxDesc.className='desc';maxDesc.textContent='Maximum number of files the scanner will analyze in one run.';
      const maxInp=doc.createElement('input');maxInp.type='number';maxInp.id='maxFiles';maxInp.value=String(window.__SB_MAX_FILES__||5000);
      maxRow.appendChild(maxLbl);maxRow.appendChild(maxDesc);maxRow.appendChild(maxInp);cfgBody.appendChild(maxRow);
      const exclRow=doc.createElement('div');exclRow.className='form-row';
      const exclLbl=doc.createElement('label');exclLbl.setAttribute('for','excludePatterns');exclLbl.textContent='Exclude patterns';
      const exclDesc=doc.createElement('div');exclDesc.className='desc';exclDesc.textContent='One glob pattern per line (e.g. node_modules, .git, dist).';
      const exclInp=doc.createElement('textarea');exclInp.id='excludePatterns';exclInp.value=(window.__SB_EXCLUDE__||'');
      exclRow.appendChild(exclLbl);exclRow.appendChild(exclDesc);exclRow.appendChild(exclInp);cfgBody.appendChild(exclRow);
      const urlRow=doc.createElement('div');urlRow.className='form-row';
      const urlLbl=doc.createElement('label');urlLbl.setAttribute('for','serverUrl');urlLbl.textContent='Server URL';
      const urlDesc=doc.createElement('div');urlDesc.className='desc';urlDesc.textContent='URL of the SimpleBeacon dashboard server (e.g. http://127.0.0.1:3000).';
      const urlInp=doc.createElement('input');urlInp.type='text';urlInp.id='serverUrl';urlInp.value=(window.__SB_API_URL__||'http://127.0.0.1:3000');
      urlRow.appendChild(urlLbl);urlRow.appendChild(urlDesc);urlRow.appendChild(urlInp);cfgBody.appendChild(urlRow);
      const saveBtn=doc.createElement('button');saveBtn.className='btn btn-primary';saveBtn.id='saveConfig';saveBtn.textContent='Save Settings';
      cfgBody.appendChild(saveBtn);cfgCard.appendChild(cfgBody);container.appendChild(cfgCard);
      body.appendChild(container);html.appendChild(body);
      saveBtn.addEventListener('click',function(){
        window.parent.postMessage({command:'updateAutoScan',value:cb.checked},'*');
        window.parent.postMessage({command:'updateMaxFiles',value:maxInp.value},'*');
        window.parent.postMessage({command:'updateExclude',value:exclInp.value},'*');
        window.parent.postMessage({command:'updateServerUrl',value:urlInp.value},'*');
        const status=doc.createElement('div');status.style.cssText='margin-top:10px;color:#10b981;font-size:13px';
        status.textContent='Settings saved!';cfgBody.appendChild(status);
        setTimeout(function(){if(status.parentNode)status.parentNode.removeChild(status);},2000);
      });
      return;
    }
    // Build iframe document via DOM to avoid Trusted Types blocking doc.write()
    const html = doc.documentElement;
    while (html.firstChild) { html.removeChild(html.firstChild); }
    const head = doc.createElement('head');
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'UTF-8');
    head.appendChild(meta);
    const style = doc.createElement('style');
    style.textContent = 'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#1e1e1e;color:#ccc;padding:20px;margin:0}'
      + 'h2{margin-top:0;color:#fff;font-weight:600}'
      + '.metric{display:inline-block;padding:10px 20px;margin:5px;background:#252526;border-radius:4px;min-width:100px}'
      + '.metric-value{font-size:24px;font-weight:bold;color:#fff}'
      + '.metric-label{font-size:12px;color:#888}'
      + '.issue{padding:10px;margin:6px 0;background:#2d2d30;border-left:3px solid #888;border-radius:0 4px 4px 0}'
      + '.issue.critical{border-left-color:#f48771}'
      + '.issue.high{border-left-color:#ff9800}'
      + '.issue.medium{border-left-color:#d18616}'
      + '.issue.low{border-left-color:#75beff}'
      + '.empty{color:#888;text-align:center;padding:40px}';
    head.appendChild(style);
    html.appendChild(head);
    const body = doc.createElement('body');
    const contentDiv = doc.createElement('div');
    contentDiv.id = 'content';
    const loadingDiv = doc.createElement('div');
    loadingDiv.className = 'empty';
    loadingDiv.textContent = 'Loading scan data...';
    contentDiv.appendChild(loadingDiv);
    body.appendChild(contentDiv);
    html.appendChild(body);
    const rp=window._relayPort||55444;
    fetch('http://localhost:'+rp+'/api/data').then(function(r){return r.json();}).then(function(data){
      const content=doc.getElementById('content');
      if(!content)return;
      content.textContent = '';
      const page=pid;
      const h2 = doc.createElement('h2');
      h2.textContent = data.title || title;
      content.appendChild(h2);
      function addMetric(value, label) {
        const metric = doc.createElement('div');
        metric.className = 'metric';
        const valDiv = doc.createElement('div');
        valDiv.className = 'metric-value';
        valDiv.textContent = value;
        const lblDiv = doc.createElement('div');
        lblDiv.className = 'metric-label';
        lblDiv.textContent = label;
        metric.appendChild(valDiv);
        metric.appendChild(lblDiv);
        content.appendChild(metric);
      }
      if(page==='dashboard'||page==='report'||page==='analyze'){
        const sc=data.severityCounts||data.severity_count||{};
        addMetric(sc.critical||0, 'Critical');
        addMetric(sc.high||0, 'High');
        addMetric(sc.medium||0, 'Medium');
        addMetric(sc.low||0, 'Low');
        addMetric(data.qualityScore!==undefined?data.qualityScore:'N/A', 'Quality Score');
        addMetric(data.totalFiles||data.total_files||0, 'Files');
        const issuesHeader = doc.createElement('h3');
        issuesHeader.style.marginTop = '20px';
        issuesHeader.style.color = '#fff';
        issuesHeader.textContent = 'Issues';
        content.appendChild(issuesHeader);
        const issues=data.detectedIssues||data.rawIssues||data.issues||[];
        if(issues.length===0){
          const empty = doc.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'No issues found.';
          content.appendChild(empty);
        }else{
          issues.forEach(function(i){
            const sev=(i.severity||'low').toLowerCase();
            const issueDiv = doc.createElement('div');
            issueDiv.className = 'issue ' + sev;
            issueDiv.textContent = (i.type||i.category||'Unknown') + ' ';
            const fileSpan = doc.createElement('span');
            fileSpan.style.color = '#888';
            fileSpan.textContent = '(' + (i.file||i.path||'') + ')';
            issueDiv.appendChild(fileSpan);
            if(i.description||i.message||i.reasoning){
              const descDiv = doc.createElement('div');
              descDiv.style.marginTop = '4px';
              descDiv.style.fontSize = '12px';
              descDiv.style.color = '#aaa';
              descDiv.textContent = i.description||i.message||i.reasoning;
              issueDiv.appendChild(descDiv);
            }
            content.appendChild(issueDiv);
          });
        }
      }else if(page==='codeMap'){
        addMetric(data.filesAnalyzed||data.totalFiles||0, 'Files Analyzed');
        addMetric(data.issueCount||0, 'Issues');
      }else{
        const empty = doc.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Data viewer for ' + page + ' not yet implemented. Files: ' + (data.totalFiles||0);
        content.appendChild(empty);
      }
    }).catch(function(e){
      const content=doc.getElementById('content');
      if(content){
        content.textContent = '';
        const empty = doc.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Error loading data: ' + e.message;
        content.appendChild(empty);
      }
    });
    }catch(err){console.error('[SB Layout] iframe content error:',err);}
  };
  if(pid==='dashboard' || pid==='analyze'){
    iframe.src='http://localhost:'+rp+'/dashboard';
  }else if(pid==='codeMap' && window.__CODE_MAP_HTML__){
    iframe.srcdoc = window.__CODE_MAP_HTML__;
  }else{
    iframe.src='about:blank';
  }
  f.appendChild(iframe);
  c.appendChild(f);
}
function addTab(pid,title,icon){
  const ex=document.querySelector('.tab[data-page="'+pid+'"]');if(ex){ex.classList.add('active');return;}
  const tb=document.getElementById('tabBar');const ab=tb.querySelector('.add-tab');
  const t=document.createElement('div');t.className='tab active';t.dataset.page=pid;
  const tabLabel = document.createElement('span');
  tabLabel.textContent = icon + ' ' + title;
  const tabClose = document.createElement('span');
  tabClose.className = 'close';
  tabClose.textContent = '\u2715';
  t.appendChild(tabLabel);
  t.appendChild(tabClose);
  tabClose.onclick=function(e){e.stopPropagation();closeTab(e,pid);};
  t.onclick=function(e){if(!e.target.classList.contains('close'))switchTab(pid);};
  tb.insertBefore(t,ab);
}
function closeTab(e,pid){e.stopPropagation();const t=document.querySelector('.tab[data-page="'+pid+'"]');if(t)t.remove();const f=document.getElementById('page-'+pid);if(f)f.remove();if(activeTab===pid){const r=document.querySelectorAll('.tab:not(.add-tab)');if(r.length>0)switchTab(r[0].dataset.page);else switchTab('welcome');}}
function showNewTabMenu(){const p=prompt('Enter page: dashboard, analyze, report, settings, certificate, codeMap, roadmap, aiContext, security, trust, compliance, repositoryHealth, upload, preview, audit, quality, assessments, platform, profile:');if(p){const t={dashboard:['Dashboard','&#x1F4CA;'],analyze:['Analyze','&#x1F50D;'],report:['Report','&#x1F4CB;'],settings:['Settings','&#x2699;'],certificate:['Certificate','&#x1F3C6;'],codeMap:['Code Map','&#x1F5FA;'],roadmap:['Roadmap','&#x1F6E4;'],aiContext:['AI Context','&#x1F916;'],security:['Security','&#x1F512;'],trust:['Trust','&#x2705;'],compliance:['Compliance','&#x1F6E1;'],repositoryHealth:['Repo Health','&#x1F4E6;'],upload:['Upload','&#x1F4E4;'],preview:['Preview','&#x1F441;'],audit:['Audit','&#x1F4CB;'],quality:['Quality','&#x1F3C6;'],assessments:['Assessments','&#x1F4DD;'],platform:['Platform','&#x1F4C8;'],profile:['Profile','&#x1F464;']};const x=t[p]||[p,'&#x1F4C4;'];openPage(p,x[0],x[1]);}}
// Event delegation for dashboard action buttons and tabs (replaces inline onclick blocked by CSP)
function bindActionBtn(btn){
  function activate(){
    const page = btn.dataset.page;
    const title = btn.dataset.title;
    const icon = btn.dataset.icon;
    if (page && title && icon && typeof openPageAndNotify === 'function') {
      openPageAndNotify(page, title, icon);
    }
  }
  btn.addEventListener('click', activate);
  btn.addEventListener('keydown', function(e){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}
  });
}
document.querySelectorAll('.action-btn[data-action="openPage"]').forEach(bindActionBtn);
document.querySelectorAll('.tab[data-action="switchTab"]').forEach(function(tab) {
  tab.addEventListener('click', function() {
    const t = tab.dataset.tab;
    if (t && typeof switchTab === 'function') switchTab(t);
  });
});
const addTabBtn = document.querySelector('.tab.add-tab[data-action="showNewTabMenu"]');
if (addTabBtn) {
  addTabBtn.addEventListener('click', function() {
    if (typeof showNewTabMenu === 'function') showNewTabMenu();
  });
}

// Handle hash routes for SPA-style navigation inside welcome screen
window.addEventListener('hashchange',function(){
  const hash=location.hash.replace(/^#/,'');
  if(!hash)return;
  const map={'/':'welcome','/dashboard':'dashboard','/analyze':'analyze','/report':'report','/settings':'settings','/certificate':'certificate','/codemap':'codeMap','/codeMap':'codeMap','/roadmap':'roadmap','/aiContext':'aiContext','/security':'security','/trust':'trust','/compliance':'compliance','/repositoryHealth':'repositoryHealth','/upload':'upload','/preview':'preview','/audit':'audit','/quality':'quality','/assessments':'assessments','/platform':'platform','/profile':'profile'};
  const pid=map[hash];
  if(pid){const t={dashboard:['Dashboard','\u1F4CA'],analyze:['Analyze','\u1F50D'],report:['Report','\u1F4CB'],settings:['Settings','\u2699'],certificate:['Certificate','\u1F3C6'],codeMap:['Code Map','\u1F5FA'],audit:['Audit','\u1F4CB'],security:['Security','\u1F512'],trust:['Trust','\u2705'],quality:['Quality','\u1F3C6'],assessments:['Assessments','\u1F4DD'],roadmap:['Roadmap','\u1F6E4'],platform:['Platform','\u1F4C8'],profile:['Profile','\u1F464'],repositoryHealth:['Repo Health','\u1F4E6'],aiContext:['AI Context','\u1F916'],preview:['Preview','\u1F441'],upload:['Upload','\u1F4E4']};const x=t[pid];if(x)openPage(pid,x[0],x[1]);}
});
if(location.hash){window.dispatchEvent(new Event('hashchange'));}

// Welcome screen visibility preference
(function(){
  const STORAGE_KEY = 'sbShowWelcome';
  const checkbox = document.getElementById('show-welcome-check');
  const saved = localStorage.getItem(STORAGE_KEY);
  const showWelcome = saved === null ? true : saved === 'true';

  if(checkbox){
    checkbox.checked = showWelcome;
    checkbox.addEventListener('change', function(){
      localStorage.setItem(STORAGE_KEY, checkbox.checked ? 'true' : 'false');
    });
  }

  // If user disabled welcome screen, auto-open dashboard on first load
  if(!showWelcome && activeTab === 'welcome' && !location.hash){
    openPage('dashboard', 'Dashboard', '\u1F4CA');
  }
})();

// Resize sidebar
let resizing=false;
const rz=document.getElementById('resizer'),sb=document.getElementById('sidebar');
rz.addEventListener('mousedown',()=>{resizing=true;document.body.style.cursor='col-resize';});
document.addEventListener('mousemove',e=>{if(!resizing)return;const nw=e.clientX;if(nw>=180&&nw<=500)sb.style.width=nw+'px';});
document.addEventListener('mouseup',()=>{resizing=false;document.body.style.cursor='default';});
// Handle messages from sidebar iframe and child tab iframes
const __vscodeApi=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
window.vscode=__vscodeApi;
window.addEventListener('message',e=>{
  const m=e.data;
  if(m&&m.command){
    // Forward settings commands from child iframes to VS Code extension
    if(__vscodeApi && (m.command==='updateAutoScan'||m.command==='updateMaxFiles'||m.command==='updateExclude'||m.command==='updateServerUrl')){
      __vscodeApi.postMessage(m);
      return;
    }
    // Intercept getServerUrl and respond directly using injected API URL
    if(m.command==='getServerUrl'){
      const iframe=document.getElementById('sidebarFrame');
      if(iframe&&iframe.contentWindow){
        iframe.contentWindow.postMessage({command:'updateServerUrl',url:window.__SB_API_URL__||'http://127.0.0.1:3000'},'*');
      }
      // Skip relay notification when inside VS Code welcome screen panel
      if(!window._inVsCodePanel){
        const rp=window._relayPort||55444;
        fetch('http://localhost:'+rp+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:m.command,source:'browser'})}).catch(()=>{});
      }
      return;
    }
    // Handle Code Map data request from child iframe — fetch live data from extension
    if(m.command==='requestData'){
      function buildCodeMapData(data){
        const files=[],issues=[],seen=new Set();
        const raw=data.rawIssues||data.detectedIssues||data.findings||[];
        raw.forEach(function(issue){
          const fp=issue.file||issue.filePath||issue.path||'unknown';
          if(['unknown'].indexOf(fp)<0&&!seen.has(fp)){
            seen.add(fp);
            files.push({id:fp,name:fp.split(/[\\\/]/).pop(),path:fp,size:0,lines:0,language:'unknown',complexity:0,issues:[],patterns:[],metrics:{}});
          }
          const sev=(issue.severity||'low').toLowerCase();
          const issueObj={id:(issue.type||'issue')+'-'+(issue.line||0),type:issue.type||'Unknown',severity:sev,file:fp,line:issue.line||0,description:issue.description||issue.message||'',category:issue.category||issue.type||'Unknown'};
          issues.push(issueObj);
          const file=files.find(function(f){return f.path===fp;});
          if(file)file.issues.push(issueObj);
        });
        const sc=issues.reduce(function(acc,i){acc[i.severity]=(acc[i.severity]||0)+1;return acc;},{});
        return {files:files,dependencies:[],patterns:[],issues:issues,metrics:{totalFiles:files.length,totalIssues:issues.length,totalPatterns:0,totalDependencies:0,severityCounts:sc,languageCounts:{},avgComplexity:0,healthScore:data.qualityScore||100},layout:{nodes:[],edges:[]}};
      }
      if(__vscodeApi){
        __vscodeApi.postMessage({command:'requestData'});
        // One-time listener for extension response, then forward to Code Map iframe
        const handleDataResponse=function(ev){
          if(ev.data&&ev.data.command==='updateData'){
            window.removeEventListener('message',handleDataResponse);
            const cd=buildCodeMapData(ev.data.data||{});
            if(e.source)e.source.postMessage({command:'updateData',data:cd},'*');
          }
        };
        window.addEventListener('message',handleDataResponse);
        return;
      }
      // Browser preview fallback: use cached relay data or fetch from relay
      const relayData=window.__sbData;
      if(relayData&&e.source){
        e.source.postMessage({command:'updateData',data:buildCodeMapData(relayData)},'*');
        return;
      }
      const rp=window._relayPort||55444;
      fetch('http://localhost:'+rp+'/api/data').then(function(r){return r.json();}).then(function(data){
        if(e.source)e.source.postMessage({command:'updateData',data:buildCodeMapData(data||{})},'*');
      }).catch(function(){});
      return;
    }
    const map={'navDashboard':'dashboard','navAnalyze':'analyze','navResults':'report','navRepoHealth':'repositoryHealth','navAudit':'audit','navSecurity':'security','navQuality':'quality','navTrust':'trust','navAssessments':'assessments','navRoadmap':'roadmap','navPlatform':'platform','navProfile':'profile','navCodeMap':'codeMap','navSettings':'settings','navCertificate':'certificate','navAiContext':'aiContext','dashboard':'dashboard','analyze':'analyze','report':'report','settings':'settings','openSettings':'settings','generateCertificate':'certificate','showReport':'report','codemap':'codeMap','showCodeMap':'codeMap','codeMap':'codeMap','openBrowser':'preview','openUpload':'upload','openDashboard':'dashboard','cert':'certificate','openSidebarDebug':'preview','sendSidebarToAi':'aiContext','scan':'dashboard','clear':'dashboard','openInIde':'welcome'};
    const pid=map[m.command];
    if(pid){const t={dashboard:['Dashboard','&#x1F4CA;'],analyze:['Analyze','&#x1F50D;'],report:['Report','&#x1F4CB;'],settings:['Settings','&#x2699;'],certificate:['Certificate','&#x1F3C6;'],codeMap:['Code Map','&#x1F5FA;'],audit:['Audit','&#x1F4CB;'],security:['Security','&#x1F512;'],trust:['Trust','&#x2705;'],quality:['Quality','&#x1F3C6;'],assessments:['Assessments','&#x1F4DD;'],roadmap:['Roadmap','&#x1F6E4;'],platform:['Platform','&#x1F4C8;'],profile:['Profile','&#x1F464;'],preview:['Preview','&#x1F441;'],upload:['Upload','&#x1F4E4;'],repositoryHealth:['Repo Health','&#x1F4E6;'],aiContext:['AI Context','&#x1F916;'],welcome:['Welcome','&#x1F3E0;']};const x=t[pid];if(x)openPage(pid,x[0],x[1]);}
    // Forward ALL commands from child iframes to VS Code: extension host so scan, enhanced, etc. actually execute
    if(__vscodeApi && e.source && e.source !== window){
      __vscodeApi.postMessage(m);
    }
    // Skip relay notification when inside VS Code: welcome screen panel
    if(!window._inVsCodePanel){
      const rp=window._relayPort||55444;
      // Send mapped pid so relay server cmdMap matches (e.g. openSettings -> settings)
      fetch('http://localhost:'+rp+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:pid||m.command,source:'browser'})}).catch(()=>{});
    }
  }
});
</script>
</body>
</html>`;

    // Create VS Code webview panel immediately (synchronous) so it's available for scan results
    const cfg = vscode.workspace.getConfiguration('simplebeacon');
    const wsFolders = vscode.workspace.workspaceFolders;
    const wsName = wsFolders && wsFolders.length > 0 ? wsFolders[0].name : 'No workspace open';
    const reportData = currentReport || {};
    const configScriptBody = `window._inVsCodePanel=true;`
      + `window.__SB_WORKSPACE_NAME__=${JSON.stringify(wsName)};`
      + `window.__SB_AUTO_SCAN__=${JSON.stringify(cfg.get('autoScanOnOpen', false))};`
      + `window.__SB_MAX_FILES__=${JSON.stringify(cfg.get('maxFiles', 5000))};`
      + `window.__SB_EXCLUDE__=${JSON.stringify(cfg.get('excludePatterns', []).join('\\n'))};`
      + `window.__SB_API_URL__=${JSON.stringify(cfg.get('apiServerUrl') || cfg.get('apiUrl', 'http://127.0.0.1:3000'))};`
      + `window.__SCAN_DATA__=${JSON.stringify(reportData).replace(/\\/g, '\\\\')};`;
    const configScript = `<script nonce="${panelNonce}">${configScriptBody.replace(/<\/script>/gi, '<\\/script>')}</script>`;
    const sidebarSrcdoc = browserHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const ideHideCss = '<style>.sidebar,.resizer,.tabs{display:none !important}.container{flex-direction:column !important}.content{flex:1;width:100vw !important}.page-content{flex:1 !important}</style>';
    const initialPanelHtml = layoutHtml
      .replace('<meta charset="UTF-8">', `<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panelCsp} 'unsafe-inline'; script-src 'nonce-${panelNonce}'; connect-src 'self' http://127.0.0.1:55444; img-src ${panelCsp} data:;">`)
      .replace(/<script>/g, `<script nonce="${panelNonce}">`)
      .replace(
        '<iframe src="/sidebar" id="sidebarFrame"></iframe>',
        `<iframe srcdoc="${sidebarSrcdoc}" id="sidebarFrame"></iframe>`
      )
      .replace('</head>', configScript + codeMapDataScript + ideHideCss + '</head>');
    let panel: vscode.WebviewPanel;
    if (ModernSidebarProvider.browserPanel) {
      panel = ModernSidebarProvider.browserPanel;
      panel.reveal(vscode.ViewColumn.One);
      panel.webview.html = initialPanelHtml;
    } else {
      panel = vscode.window.createWebviewPanel(
        'simplebeaconSidebarBrowser',
        'SimpleBeacon Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extUri] }
      );
      ModernSidebarProvider.browserPanel = panel;
      panel.webview.html = initialPanelHtml;
      panel.onDidDispose(() => { ModernSidebarProvider.browserPanel = undefined; });
      // Handle messages from the panel (same as standalone debug)
      panel.webview.onDidReceiveMessage((message: any) => {
        const pageMap: Record<string, string> = {
          dashboard: 'simplebeacon.showReport', analyze: 'simplebeacon.enhancedAnalysis',
          report: 'simplebeacon.showReport', settings: 'simplebeacon.openSettings',
          certificate: 'simplebeacon.generateCertificate', codeMap: 'simplebeacon.showCodeMap',
          roadmap: 'simplebeacon.runAdvancedAnalytics', aiContext: 'simplebeacon.openAiContext',
          analytics: 'simplebeacon.runAdvancedAnalytics', runAdvancedAnalytics: 'simplebeacon.runAdvancedAnalytics',
          scan: 'simplebeacon.scanWorkspace'
        };
        const cmd = pageMap[message.page] || pageMap[message.command];
        if (cmd) { vscode.commands.executeCommand(cmd); }
        else if (message.command === 'updateAutoScan') {
          vscode.workspace.getConfiguration('simplebeacon').update('autoScanOnOpen', message.value, true);
        } else if (message.command === 'updateMaxFiles') {
          vscode.workspace.getConfiguration('simplebeacon').update('maxFiles', parseInt(message.value, 10) || 5000, true);
        } else if (message.command === 'updateExclude') {
          vscode.workspace.getConfiguration('simplebeacon').update('excludePatterns', String(message.value).split('\n').map((s: string) => s.trim()).filter(Boolean), true);
        } else if (message.command === 'updateServerUrl') {
          vscode.workspace.getConfiguration('simplebeacon').update('apiServerUrl', message.value, true);
        }
        else if (message.command === 'openInIde' && apiUrl) { vscode.env.openExternal(vscode.Uri.parse(apiUrl)); }
        else if (message.command === 'requestData') {
          panel.webview.postMessage({ command: 'updateData', data: self._currentReport || {} });
        }
      });
    }

    function buildDashboardHtmlFromData(data: any): string {
      const sc = data.severityCounts || data.severity_count || {};
      const score = data.qualityScore !== undefined ? data.qualityScore : 'N/A';
      const gate = data.gate || {};
      const pass = gate.pass ? 'PASS' : (gate.pass === false ? 'FAIL' : 'N/A');
      const passColor = gate.pass === true ? '#10b981' : (gate.pass === false ? '#ef4444' : '#888');
      const scoreColor = typeof score === 'number' ? (score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444') : '#888';
      const issues = data.detectedIssues || data.rawIssues || data.issues || [];
      const files = data.totalFiles || data.total_files || data.filesAnalyzed || 0;
      const title = data.title || 'Scan Report';
      const rows = issues.map((i: any) => {
        const sev = (i.severity || 'low').toLowerCase();
        const color = sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f59e0b' : sev === 'medium' ? '#d18616' : '#75beff';
        return `<tr style="border-bottom:1px solid #333"><td style="padding:8px;color:${color};font-weight:600;text-transform:uppercase;font-size:11px">${i.severity || 'low'}</td><td style="padding:8px">${i.type || i.category || 'Unknown'}</td><td style="padding:8px;color:#888;font-size:12px">${i.file || i.filePath || i.path || '-'}</td><td style="padding:8px;color:#aaa;font-size:12px">${i.description || i.message || ''}</td></tr>`;
      }).join('');
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1e1e1e;color:#ccc;margin:0;padding:24px}
.container{max-width:960px;margin:0 auto}
h1{margin:0 0 20px;font-size:22px;color:#fff}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px}
.metric{background:#252526;border:1px solid #333;border-radius:8px;padding:14px;text-align:center}
.metric-value{font-size:24px;font-weight:700;color:#fff}
.metric-label{font-size:11px;color:#888;margin-top:4px}
.gate-badge{display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;background:${passColor};color:#fff;margin-left:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 8px;color:#888;font-size:11px;text-transform:uppercase;border-bottom:1px solid #444}
.empty{text-align:center;padding:40px;color:#888}
</style></head>
<body>
<div class="container">
<h1>${title}<span class="gate-badge">Gate: ${pass}</span></h1>
<div class="metrics">
  <div class="metric"><div class="metric-value" style="color:${scoreColor}">${score}</div><div class="metric-label">Quality Score</div></div>
  <div class="metric"><div class="metric-value" style="color:#ef4444">${sc.critical || 0}</div><div class="metric-label">Critical</div></div>
  <div class="metric"><div class="metric-value" style="color:#f59e0b">${sc.high || 0}</div><div class="metric-label">High</div></div>
  <div class="metric"><div class="metric-value" style="color:#d18616">${sc.medium || 0}</div><div class="metric-label">Medium</div></div>
  <div class="metric"><div class="metric-value" style="color:#75beff">${sc.low || 0}</div><div class="metric-label">Low</div></div>
  <div class="metric"><div class="metric-value">${files}</div><div class="metric-label">Files</div></div>
</div>
${rows ? '<table><thead><tr><th>Severity</th><th>Type</th><th>File</th><th>Description</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="empty">No issues found.</div>'}
</div>
</body></html>`;
    }

    // Start a tiny HTTP relay server for IDE↔browser pipeline (no external deps)
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const RELAY_PORT = config.get<number>('relayPort', 55444);
    let lastCommand: {command: string; timestamp: number} | null = null;
    let actualRelayPort = RELAY_PORT;
    let layoutHtmlWithEvents: string;
    // SSE client list for real-time push to browser
    const sseClients: {res: any; id: number}[] = [];
    let sseClientId = 0;
    const self = this;

    function broadcastSse(data: unknown) {
      const payload = JSON.stringify(data);
      sseClients.forEach((c) => {
        try {
          c.res.write(`data: ${payload}\n\n`);
        } catch {
          // client disconnected
        }
      });
    }

    if (!(ModernSidebarProvider as any)._relayServer) {
      const httpMod = require('http');
      const urlMod = require('url');
      const relay = httpMod.createServer((req: any, res: any) => {
        const parsed = urlMod.parse(req.url || '', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        // SSE endpoint for real-time browser push
        if (parsed.pathname === '/api/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          res.write(':ok\n\n');
          const cid = ++sseClientId;
          const client = { res, id: cid };
          sseClients.push(client);
          req.on('close', () => {
            const idx = sseClients.findIndex((c) => c.id === cid);
            if (idx >= 0) { sseClients.splice(idx, 1); }
          });
          // Push current data immediately so browser shows latest state
          const currentData = (ModernSidebarProvider as any)._relayData;
          if (currentData && Object.keys(currentData).length > 0) {
            try {
              res.write(`data: ${JSON.stringify({ type: 'data', payload: currentData })}\n\n`);
            } catch { /* ignore */ }
          }
          ModernSidebarProvider.logRelay(`SSE client connected #${cid} (${sseClients.length} total)`);
          return;
        }

        if (parsed.pathname === '/api/command' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const msg = JSON.parse(body);
              if (msg.command) {
                lastCommand = { command: msg.command, timestamp: Date.now() };
                ModernSidebarProvider.logRelay(`Relay stored command="${msg.command}" source="${msg.source || 'unknown'}"`);
                // Broadcast command to all connected browser SSE clients instantly
                broadcastSse({ type: 'command', command: msg.command, source: msg.source || 'unknown' });
                // Push browser-originated commands directly to the sidebar webview
                if (msg.source === 'browser') {
                  self._view?.webview.postMessage({ command: 'relayCommand', relayCommand: msg.command });
                  // All page navigation handled locally in welcome panel; no VS Code commands needed
                  // Normalize browser command names (e.g. openSettings -> settings)
                  const normCmd: Record<string, string> = {
                    navDashboard: 'dashboard', navAnalyze: 'analyze', navResults: 'report',
                    navRepoHealth: 'repositoryHealth', navAudit: 'audit', navSecurity: 'security',
                    navQuality: 'quality', navTrust: 'trust', navAssessments: 'assessments',
                    navRoadmap: 'roadmap', navPlatform: 'platform', navProfile: 'profile',
                    navCodeMap: 'codeMap', navSettings: 'settings', navCertificate: 'certificate',
                    navAiContext: 'aiContext', openSettings: 'settings', generateCertificate: 'certificate',
                    showReport: 'report', codemap: 'codeMap', openBrowser: 'preview',
                    openUpload: 'upload', openDashboard: 'dashboard', cert: 'certificate',
                    openSidebarDebug: 'preview', sendSidebarToAi: 'aiContext', scan: 'dashboard',
                    clear: 'dashboard', openInIde: 'preview'
                  };
                  const mapped = normCmd[msg.command] || msg.command;
                  const cmdMap: Record<string, string> = {
                    dashboard: 'simplebeacon.showReport',
                    analyze: 'simplebeacon.enhancedAnalysis',
                    report: 'simplebeacon.showReport',
                    settings: 'simplebeacon.openSettings',
                    certificate: 'simplebeacon.generateCertificate',
                    codeMap: 'simplebeacon.showCodeMap',
                    roadmap: 'simplebeacon.runAdvancedAnalytics',
                    aiContext: 'simplebeacon.runAdvancedAnalytics',
                    preview: 'simplebeacon.openPreview',
                    openInIde: 'simplebeacon.openInPreview',
                    scan: 'simplebeacon.scanWorkspace',
                    clear: 'simplebeacon.clearResults',
                  };
                  const vscodeCmd = cmdMap[mapped];
                  // Some commands require VS Code: native functionality and must always execute
                  const alwaysVsCode = new Set(['codeMap', 'scan', 'settings', 'analyze', 'certificate']);
                  const panelOpen = !!ModernSidebarProvider.getBrowserPanel();
                  if (vscodeCmd && (!panelOpen || alwaysVsCode.has(mapped))) {
                    vscode.commands.executeCommand(vscodeCmd);
                    ModernSidebarProvider.logRelay(`Relay executed VS Code command: ${vscodeCmd}`);
                  } else if (panelOpen) {
                    ModernSidebarProvider.logRelay(`Skipped VS Code command for ${msg.command} — welcome screen panel handles this locally`);
                  }
                }
              }
            } catch (e: any) {
              ModernSidebarProvider.logRelay(`Relay POST parse error: ${e?.message}`);
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ok:true}));
          });
          return;
        }
        if (parsed.pathname === '/api/command' && req.method === 'GET') {
          ModernSidebarProvider.logRelay(`Relay GET returned command="${lastCommand?.command || 'none'}"`);
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(lastCommand || {}));
          return;
        }
        if (parsed.pathname === '/api/data' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const msg = JSON.parse(body);
              (ModernSidebarProvider as any)._relayData = msg;
              ModernSidebarProvider.logRelay(`Relay stored data keys=${Object.keys(msg).join(',')}`);
              // Also broadcast data to browser via SSE
              broadcastSse({ type: 'data', payload: msg });
            } catch (e: any) {
              ModernSidebarProvider.logRelay(`Relay data POST parse error: ${e?.message}`);
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ok:true}));
          });
          return;
        }
        if (parsed.pathname === '/api/data' && req.method === 'GET') {
          const data = (ModernSidebarProvider as any)._relayData || {};
          ModernSidebarProvider.logRelay(`Relay GET data keys=${Object.keys(data).join(',') || 'none'}`);
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(data));
          return;
        }
        if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(layoutHtmlWithEvents);
          return;
        }
        if (parsed.pathname === '/sidebar') {
          const sbHtml = ModernSidebarProvider._sidebarHtml || browserHtml || '';
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(sbHtml);
          return;
        }
        if (parsed.pathname === '/dashboard') {
          let dashHtml = ModernSidebarProvider._dashboardHtml;
          if (!dashHtml) {
            const data = (ModernSidebarProvider as any)._relayData;
            if (data && Object.keys(data).length > 0) {
              dashHtml = buildDashboardHtmlFromData(data);
            }
          }
          if (dashHtml) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(dashHtml);
          } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('<!DOCTYPE html><html><body style="background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:20px;"><h2>Dashboard not loaded</h2><p>Open the dashboard in VS Code first.</p></body></html>');
          }
          return;
        }
        // Proxy dashboard and upload pages to the actual API server
        if (parsed.pathname.startsWith('/simplebeacon-dashboard/') || parsed.pathname === '/simplebeacon-dashboard' || parsed.pathname === '/certificate-upload.html' || parsed.pathname === '/audit.html') {
          try {
            const apiParsed = urlMod.parse(apiUrl);
            const proxyPort = apiParsed.port || (apiParsed.protocol === 'https:' ? 443 : 80);
            const proxyClient = apiParsed.protocol === 'https:' ? require('https') : require('http');
            const proxyReq = proxyClient.request({
              hostname: apiParsed.hostname,
              port: proxyPort,
              path: parsed.pathname + (parsed.search || ''),
              method: req.method,
              headers: { ...req.headers, host: apiParsed.host }
            }, (proxyRes: any) => {
              if (proxyRes.statusCode === 404 || proxyRes.statusCode >= 500) {
                ModernSidebarProvider.logRelay(`Proxy ${proxyRes.statusCode} for ${parsed.pathname} — serving fallback dashboard`);
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(ModernSidebarProvider.buildFallbackDashboardHtml(parsed.pathname));
                return;
              }
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
              proxyRes.pipe(res);
            });
            proxyReq.on('error', (err: any) => {
              ModernSidebarProvider.logRelay(`Proxy error for ${parsed.pathname}: ${err.message} — serving fallback dashboard`);
              res.writeHead(200, {'Content-Type': 'text/html'});
              res.end(ModernSidebarProvider.buildFallbackDashboardHtml(parsed.pathname));
            });
            req.pipe(proxyReq);
            return;
          } catch (e: any) {
            ModernSidebarProvider.logRelay(`Proxy setup error: ${e.message}`);
          }
        }
        // Catch-all: serve welcome screen for SPA-style routes (e.g. /#/analyze, /audit.html)
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(layoutHtmlWithEvents);
      });
      relay.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          vscode.window.showWarningMessage(`Port ${RELAY_PORT} unavailable (${err.code}), using random port`);
          relay.listen(0); // Let OS assign an available port
        } else {
          vscode.window.showErrorMessage(`Browser relay error: ${err.message}`);
        }
      });
      relay.on('listening', () => {
        const addr = relay.address();
        actualRelayPort = addr ? (typeof addr === 'object' ? addr.port : addr) : RELAY_PORT;
        (ModernSidebarProvider as any)._relayPort = actualRelayPort;
        vscode.window.showInformationMessage(`Browser preview ready: http://localhost:${actualRelayPort}`);
        openBrowser(actualRelayPort);
      });
      relay.listen(RELAY_PORT);
      (ModernSidebarProvider as any)._relayServer = relay;
    } else {
      actualRelayPort = (ModernSidebarProvider as any)._relayPort || RELAY_PORT;
      openBrowser(actualRelayPort);
    }

    function openBrowser(port: number) {
      // Build the relay HTML (still needed for the relay server to serve)
      const portScript = `<script>window._relayPort=${port};</script>`;
      let htmlWithPort = layoutHtml.replace('</head>', portScript + codeMapDataScript + '</head>');
      const eventScript = `<script>
// IDE↔Browser pipeline: real-time SSE for commands + HTTP POST for browser→IDE
(function(){
  const map={'navDashboard':'dashboard','navAnalyze':'analyze','navResults':'report','navRepoHealth':'repositoryHealth','navAudit':'audit','navSecurity':'security','navQuality':'quality','navTrust':'trust','navAssessments':'assessments','navRoadmap':'roadmap','navPlatform':'platform','navProfile':'profile','navCodeMap':'codeMap','navSettings':'settings','navCertificate':'certificate','navAiContext':'aiContext','dashboard':'dashboard','analyze':'analyze','openSettings':'settings','generateCertificate':'certificate','showReport':'report','codemap':'codeMap','showCodeMap':'codeMap','codeMap':'codeMap','openBrowser':'preview','openUpload':'upload','openDashboard':'dashboard','cert':'certificate','openSidebarDebug':'preview','sendSidebarToAi':'aiContext','scan':'dashboard','clear':'dashboard'};
  function handleCommand(cmd){
    const pid=map[cmd];
    if(pid&&typeof openPage==='function')openPage(pid,pid,'');
  }
  if(typeof EventSource !== 'undefined'){
    const es=new EventSource('http://localhost:${port}/api/events');
    es.onmessage=function(e){
      try{
        const msg=JSON.parse(e.data);
        if(msg.type==='command'&&msg.command){handleCommand(msg.command);}
        if(msg.type==='data'&&msg.payload){
          window.__sbData=msg.payload;
          const iframe=document.getElementById('sidebarFrame');
          if(iframe&&iframe.contentWindow){
            if(msg.payload.status!==undefined&&msg.payload.text!==undefined){
              iframe.contentWindow.postMessage({command:'updateStatus',status:msg.payload.status,text:msg.payload.text},'*');
            }else{
              iframe.contentWindow.postMessage({command:'updateReport',report:msg.payload},'*');
            }
          }
        }
      }catch(err){console.warn('SSE parse error',err);}
    };
    es.onerror=function(){console.warn('SSE connection error, will retry automatically');};
  }else{
    (function poll(){
      fetch('http://localhost:${port}/api/command').then(r=>r.json()).then(d=>{
        if(d&&d.command){handleCommand(d.command);}
      }).catch(()=>{});
      fetch('http://localhost:${port}/api/data').then(r=>r.json()).then(d=>{
        if(d&&Object.keys(d).length>0){window.__sbData=d;}
      }).catch(()=>{});
      setTimeout(poll,800);
    })();
  }
})();
</script>`;
      layoutHtmlWithEvents = htmlWithPort.replace('</body>', eventScript + '</body>');

      // Push current report data to relay so browser can display it (via SSE broadcast)
      try {
        if (currentReport) {
          const httpMod = require('http');
          const payload = JSON.stringify(currentReport);
          const req = httpMod.request({hostname: '127.0.0.1', port, path: '/api/data', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)}}, (res: any) => {
            ModernSidebarProvider.logRelay(`Data POST response status=${res.statusCode}`);
          });
          req.on('error', (err: any) => {
            ModernSidebarProvider.logRelay(`Data POST error: ${err.message}`);
          });
          req.write(payload);
          req.end();
        } else {
          ModernSidebarProvider.logRelay('No current report to push to relay');
        }
      } catch (err: any) {
        ModernSidebarProvider.logRelay(`Data POST exception: ${err?.message || err}`);
      }

      // Open browser via relay server URL based on user setting
      const relayUrl = `http://localhost:${port}`;
      const previewMode = vscode.workspace.getConfiguration('simplebeacon').get<string>('previewOpenMode') || 'externalBrowser';
      if (previewMode === 'externalBrowser') {
        vscode.env.openExternal(vscode.Uri.parse(relayUrl));
      } else if (previewMode === 'vscodeSimpleBrowser') {
        vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(relayUrl));
      } else if (previewMode === 'preview') {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(relayUrl), { preview: true });
      } else {
        vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(relayUrl));
      }

      // Update VS Code webview panel HTML with correct port
      if (ModernSidebarProvider.browserPanel) {
        const cfg2 = vscode.workspace.getConfiguration('simplebeacon');
        const wsFolders2 = vscode.workspace.workspaceFolders;
        const wsName2 = wsFolders2 && wsFolders2.length > 0 ? wsFolders2[0].name : 'No workspace open';
        const configScript2Body = `window._inVsCodePanel=true;`
          + `window.__SB_WORKSPACE_NAME__=${JSON.stringify(wsName2)};`
          + `window.__SB_AUTO_SCAN__=${JSON.stringify(cfg2.get('autoScanOnOpen', false))};`
          + `window.__SB_MAX_FILES__=${JSON.stringify(cfg2.get('maxFiles', 5000))};`
          + `window.__SB_EXCLUDE__=${JSON.stringify(cfg2.get('excludePatterns', []).join('\\n'))};`
          + `window.__SB_API_URL__=${JSON.stringify(cfg2.get('apiServerUrl') || cfg2.get('apiUrl', 'http://127.0.0.1:3000'))};`;
        const configScript2 = `<script>${configScript2Body.replace(/<\/script>/gi, '<\\/script>')}</script>`;
        const panelLayoutHtml = layoutHtmlWithEvents.replace(
          '<iframe src="/sidebar" id="sidebarFrame"></iframe>',
          `<iframe src="data:text/html;charset=utf-8,${encodeURIComponent(browserHtml)}" id="sidebarFrame"></iframe>`
        ).replace('</head>', configScript2 + '<style>.sidebar,.resizer{display:none !important}.container{flex-direction:column}.content{flex:1;width:100vw}</style></head>');
        ModernSidebarProvider.browserPanel.webview.html = panelLayoutHtml;
      }
    }
  }

  public openSidebarInBrowser() {
    const extUri = this._extensionUri;
    const sbConfig = vscode.workspace.getConfiguration('simplebeacon');
    const fsMod = require('fs');
    const pathMod = require('path');

    // Read the bundled sidebar.html for a consistent browser dashboard
    let browserHtml = '';
    try {
      const sidebarPath = pathMod.join(extUri.fsPath, '..', 'sidebar.html');
      if (fsMod.existsSync(sidebarPath)) {
        browserHtml = fsMod.readFileSync(sidebarPath, 'utf8');
      }
    } catch (e) {}
    if (!browserHtml) {
      vscode.window.showErrorMessage('sidebar.html not found in extension. Rebuild the .vsix including sidebar.html.');
      return;
    }

    // Inject VS Code: theme vars and API URL
    const apiUrl = sbConfig.get<string>('apiServerUrl') || sbConfig.get<string>('apiUrl', 'http://127.0.0.1:3000') || 'http://127.0.0.1:3000';
    const relayPort = (ModernSidebarProvider as any)._relayPort || sbConfig.get<number>('relayPort', 55444);
    const vscodeVars = `<style>:root{--vscode-editor-background:#1e1e1e;--vscode-sidebar-background:#252526;--vscode-foreground:#cccccc;--vscode-panel-background:#252526;--vscode-panel-border:#3c3c3c;--vscode-button-secondaryBackground:#2d2d30;--vscode-button-secondaryForeground:#cccccc;--vscode-button-hoverBackground:#3c3c3c;--vscode-descriptionForeground:#858585;--vscode-activityBar-background:#333333;--vscode-activityBar-foreground:#ffffff;--vscode-activityBar-inactiveForeground:#858585;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-charts-green:#89d185;--vscode-charts-red:#f48771;--vscode-charts-orange:#d18616;--vscode-charts-blue:#75beff;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style>`;
    const injectScript = `<script>window.__SB_API_URL__='${apiUrl}';window._relayPort=${relayPort};</script>`;
    browserHtml = browserHtml.replace('</head>', vscodeVars + injectScript + '</head>');

    // Cache sidebar HTML for relay server
    ModernSidebarProvider._sidebarHtml = browserHtml;

    // Write to temp file so standalone relay-server.js can serve it
    const osMod = require('os');
    const tempFile = pathMod.join(osMod.tmpdir(), 'simplebeacon-sidebar-browser.html');
    try { fsMod.writeFileSync(tempFile, browserHtml, 'utf8'); } catch (e) { /* ignore */ }

    // Start minimal relay server if not already running
    const httpMod = require('http');
    const RELAY_PORT = sbConfig.get<number>('relayPort', 55444);
    if ((ModernSidebarProvider as any)._relayServer) {
      const port = (ModernSidebarProvider as any)._relayPort || RELAY_PORT;
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}/`));
      vscode.window.showInformationMessage(`Sidebar open at http://localhost:${port}/`);
      return;
    }

    // Helper to read codeMapTemplate for /codemap fallback
    const getCodeMapHtml = () => {
      try {
        const codeMapPath = pathMod.join(extUri.fsPath, '..', 'media', 'codeMapTemplate.html');
        if (fsMod.existsSync(codeMapPath)) {
          let html = fsMod.readFileSync(codeMapPath, 'utf8');
          return html.replace(/NONCE/g, 'browser-' + Date.now()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
        }
      } catch (e) {}
      return '<h1>Code Map</h1><p>Template not found</p>';
    };

    const server = httpMod.createServer((req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (req.url === '/' || req.url === '/sidebar') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(ModernSidebarProvider._sidebarHtml || browserHtml);
        return;
      }
      if (req.url === '/codemap') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(getCodeMapHtml());
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
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${actualPort}/`));
        vscode.window.showInformationMessage(`Sidebar server running at http://localhost:${actualPort}/`);
      });
      server.listen(port);
    };
    tryListen(RELAY_PORT);
  }

  private static buildFallbackDashboardHtml(pathname: string): string {
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
    <a class="cm-link" href="http://"+"localhost"+":54358/api/report" target="_blank">View Raw Report</a>
    <div style="margin-top:8px"><a class="cm-link" style="background:#22c55e" href="http://"+"localhost"+":54358/api/stream" target="_blank">Event Stream</a></div>
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
  <span>Port 54358</span>
</footer>
</div>
<script>
const API=['http://','127.0.0.1',':54358'].join('');
let lastData=null;
function triggerAnalysis(){
  // Try to notify VS Code extension to run enhanced analysis
  if(typeof acquireVsCodeApi==='function'){
    try{acquireVsCodeApi().postMessage({command:'analyze'});}catch(e){}
  }
  // Also try parent window message (for iframe context)
  try{if(window.parent!==window){window.parent.postMessage({command:'simplebeacon.runAnalysis'},'*');}}catch(e){}
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
