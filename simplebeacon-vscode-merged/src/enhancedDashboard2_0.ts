import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';
import { designTokens, themeColors } from './designSystem';
import { RawIssue } from './scanProvider';

/**
 * Enhanced dashboard webview panel (v2.0) with modern UI/UX for scan visualization.
 */
export class EnhancedDashboard20 {
  private static currentPanel: EnhancedDashboard20 | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private report: unknown;
  private highlight: string | null;
  private hasEnhancedAnalysis: boolean;
  private readonly version: string;

  public static createOrShow(extUri: vscode.Uri, report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    const column = vscode.ViewColumn.One;
    if (EnhancedDashboard20.currentPanel) {
      EnhancedDashboard20.currentPanel.panel.reveal(column);
      EnhancedDashboard20.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
      return;
    }
    const panel = vscode.window.createWebviewPanel('simplebeaconEnhanced20', 'SimpleBeacon Dashboard 2.0', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')],
    });
    EnhancedDashboard20.currentPanel = new EnhancedDashboard20(
      panel,
      extUri,
      report,
      highlight ?? null,
      hasEnhancedAnalysis ?? false
    );
  }

  public static updateIfOpen(report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    if (EnhancedDashboard20.currentPanel) {
      EnhancedDashboard20.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extUri: vscode.Uri,
    report: unknown,
    highlight: string | null,
    hasEnhancedAnalysis: boolean
  ) {
    this.panel = panel;
    this.extUri = extUri;
    this.report = report;
    this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    this.version = this.getVersionFromExtUri(extUri);
    this.panel.onDidDispose(
      () => {
        EnhancedDashboard20.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'openFile') {
        const uri = vscode.Uri.file(msg.file);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(msg.line - 1, 0, msg.line - 1, 0) });
      } else if (msg.command === 'scanWorkspace') {
        vscode.commands.executeCommand('simplebeacon.scanWorkspace');
      } else if (msg.command === 'exportReport') {
        vscode.commands.executeCommand('simplebeacon.exportReport');
      } else if (msg.command === 'generateCertificate') {
        vscode.commands.executeCommand('simplebeacon.generateCertificate');
      } else if (msg.command === 'exportAIReport' || msg.command === 'sendToAI') {
        const report = this.report;
        if (!report) {
          vscode.window.showWarningMessage('No scan report available. Run a scan first.');
          return;
        }
        const config = vscode.workspace.getConfiguration('simplebeacon');
        const apiUrl = config.get<string>('apiUrl', '').trim();
        if (!apiUrl) {
          vscode.window.showWarningMessage('SimpleBeacon API URL not configured. Run "Set API Server URL" command first.');
          return;
        }
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Sending scan data to AI...', cancellable: false },
          async () => {
            try {
              const parsed = new URL(apiUrl.replace(/\/$/, '') + '/api/ai-context');
              const body = JSON.stringify({ report, source: 'vscode-dashboard' });
              const client = parsed.protocol === 'https:' ? require('https') : require('http');
              const postRes: { success?: boolean; content?: string; error?: string } = await new Promise(
                (resolve, reject) => {
                  const req = client.request(
                    {
                      hostname: parsed.hostname,
                      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                      path: parsed.pathname,
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                    },
                    (res: http.IncomingMessage) => {
                      let data = '';
                      res.on('data', (chunk: Buffer) => { data += chunk; });
                      res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch { resolve({ success: false, error: 'Invalid JSON' }); }
                      });
                    }
                  );
                  req.on('error', reject);
                  req.write(body);
                  req.end();
                }
              );
              if (postRes.success && postRes.content) {
                await vscode.env.clipboard.writeText(postRes.content);
                vscode.window.showInformationMessage('Scan data delivered to AI chatbot — paste with Ctrl+V');
              } else {
                vscode.window.showWarningMessage('AI chatbot received data but returned no content.');
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage('Failed to deliver to AI chatbot: ' + msg);
            }
          }
        );
      } else if (msg.command === 'startRealtimeMonitoring') {
        vscode.commands.executeCommand('simplebeacon.startRealtimeMonitoring');
      } else if (msg.command === 'stopRealtimeMonitoring') {
        vscode.commands.executeCommand('simplebeacon.stopRealtimeMonitoring');
      } else if (msg.command === 'showRealtimeIssues') {
        vscode.commands.executeCommand('simplebeacon.showRealtimeIssues');
      } else if (msg.command === 'enhancedAnalysis') {
        vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
      } else if (msg.command === 'realtimeAnalysis') {
        vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');
      } else if (msg.command === 'patternDetection') {
        vscode.commands.executeCommand('simplebeacon.patternDetection');
      } else if (msg.command === 'modelHealth') {
        vscode.commands.executeCommand('simplebeacon.modelHealth');
      } else if (msg.command === 'showCodeMap') {
        vscode.commands.executeCommand('simplebeacon.showCodeMap');
      } else if (msg.command === 'suggestFix') {
        this.handleSuggestFix(msg.patternId, msg.file, msg.line);
      } else if (msg.command === 'openInBrowser') {
        const tmpFile = path.join(this.extUri.fsPath, 'simplebeacon-dashboard.html');
        fs.writeFileSync(tmpFile, this.getEnhancedHtml().replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''));
        vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.file(tmpFile).toString());
      }
    });
    this.panel.webview.html = this.getEnhancedHtml();
  }

  update(report: unknown, highlight: string | null = null, hasEnhancedAnalysis: boolean = false) {
    this.report = report;
    this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    this.panel.webview.html = this.getEnhancedHtml();
  }

  private getWorkspaceStats(): { files: number; folders: number } {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return { files: 0, folders: 0 };
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const skipDirs = /[\\/]node_modules[\\/]|[\\/]\.git[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]|[\\/]\.next[\\/]|[\\/]out[\\/]|[\\/]coverage[\\/]/;
      let files = 0;
      let folders = 0;
      const stack = [rootPath];
      const visited = new Set<string>();
      while (stack.length > 0) {
        const dir = stack.pop()!;
        if (visited.has(dir)) continue;
        visited.add(dir);
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
            if (skipDirs.test('/' + relPath + '/')) continue;
            if (entry.isDirectory()) {
              folders++;
              stack.push(fullPath);
            } else if (entry.isFile()) {
              files++;
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }
      return { files, folders };
    } catch {
      return { files: 0, folders: 0 };
    }
  }

  private getVersionFromExtUri(extUri: vscode.Uri): string {
    const packageJson = path.join(extUri.fsPath, '..', 'package.json');
    try {
      const pkg = require(packageJson);
      return pkg.version || '2.0.0';
    } catch {
      return '2.0.0';
    }
  }

  private getEnhancedHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const r = this.report as any;
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passColor = g.pass ? designTokens.colors.success[500] : designTokens.colors.error[500];
    const scoreColor =
      score >= 80
        ? designTokens.colors.success[500]
        : score >= 50
          ? designTokens.colors.warning[500]
          : designTokens.colors.error[500];

    // Get actual workspace stats when report data is incomplete
    const workspaceStats = this.getWorkspaceStats();
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || workspaceStats.files;
    const totalRepositoryFiles = r.repositoryFilesTotal || workspaceStats.files;
    const files = totalRepositoryFiles > 0 ? `${filesAnalyzed}/${totalRepositoryFiles}` : `${filesAnalyzed}`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || workspaceStats.folders;

    const categories = this.extractCategories(r);
    const allFindings = this.extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((sum, c) => sum + c.count, 0);
    const findingsJson = JSON.stringify(
      allFindings.map((f) => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) }))
    );

    // Check API connectivity
    const apiConfig = vscode.workspace.getConfiguration('simplebeacon');
    const configuredUrl = apiConfig.get<string>('apiUrl', '').trim();
    const connectionStatus = configuredUrl ? 'configured' : 'disconnected';
    const connectionLabel = configuredUrl ? 'API Connected' : 'API Not Configured';

    const failingFiles = this.extractFailingFiles(r);
    const failingFilesHtml = this.buildFailingFilesTable(failingFiles);

    // Get current theme
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? themeColors.dark : themeColors.light;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard 2.0</title>
<style>
/* Design System 2.0 */
:root{
  /* Colors */
  --primary-50: ${designTokens.colors.primary[50]};
  --primary-100: ${designTokens.colors.primary[100]};
  --primary-500: ${designTokens.colors.primary[500]};
  --primary-600: ${designTokens.colors.primary[600]};
  --primary-700: ${designTokens.colors.primary[700]};
  --primary-900: ${designTokens.colors.primary[900]};
  
  --secondary-50: ${designTokens.colors.secondary[50]};
  --secondary-100: ${designTokens.colors.secondary[100]};
  --secondary-500: ${designTokens.colors.secondary[500]};
  --secondary-600: ${designTokens.colors.secondary[600]};
  --secondary-700: ${designTokens.colors.secondary[700]};
  --secondary-900: ${designTokens.colors.secondary[900]};
  
  --neutral-50: ${designTokens.colors.neutral[50]};
  --neutral-100: ${designTokens.colors.neutral[100]};
  --neutral-200: ${designTokens.colors.neutral[200]};
  --neutral-300: ${designTokens.colors.neutral[300]};
  --neutral-400: ${designTokens.colors.neutral[400]};
  --neutral-500: ${designTokens.colors.neutral[500]};
  --neutral-600: ${designTokens.colors.neutral[600]};
  --neutral-700: ${designTokens.colors.neutral[700]};
  --neutral-800: ${designTokens.colors.neutral[800]};
  --neutral-900: ${designTokens.colors.neutral[900]};
  
  --success-50: ${designTokens.colors.success[50]};
  --success-100: ${designTokens.colors.success[100]};
  --success-500: ${designTokens.colors.success[500]};
  --success-600: ${designTokens.colors.success[600]};
  --success-700: ${designTokens.colors.success[700]};
  --success-900: ${designTokens.colors.success[900]};
  
  --warning-50: ${designTokens.colors.warning[50]};
  --warning-100: ${designTokens.colors.warning[100]};
  --warning-500: ${designTokens.colors.warning[500]};
  --warning-600: ${designTokens.colors.warning[600]};
  --warning-700: ${designTokens.colors.warning[700]};
  --warning-900: ${designTokens.colors.warning[900]};
  
  --error-50: ${designTokens.colors.error[50]};
  --error-100: ${designTokens.colors.error[100]};
  --error-500: ${designTokens.colors.error[500]};
  --error-600: ${designTokens.colors.error[600]};
  --error-700: ${designTokens.colors.error[700]};
  --error-900: ${designTokens.colors.error[900]};
  
  /* Theme Colors */
  --bg: ${theme.background};
  --fg: ${theme.foreground};
  --panel: ${theme.panel};
  --border: ${theme.border};
  --input: ${theme.input};
  --button: ${theme.button};
  --focus: ${theme.focus};
  --success: ${theme.success};
  --warning: ${theme.warning};
  --error: ${theme.error};
  
  /* Spacing */
  --spacing-xs: ${designTokens.spacing.xs};
  --spacing-sm: ${designTokens.spacing.sm};
  --spacing-md: ${designTokens.spacing.md};
  --spacing-lg: ${designTokens.spacing.lg};
  --spacing-xl: ${designTokens.spacing.xl};
  --spacing-2xl: ${designTokens.spacing['2xl']};
  --spacing-3xl: ${designTokens.spacing['3xl']};
  --spacing-4xl: ${designTokens.spacing['4xl']};
  --spacing-5xl: ${designTokens.spacing['5xl']};
  --spacing-6xl: ${designTokens.spacing['6xl']};
  
  /* Typography */
  --font-family: ${designTokens.typography.fontFamily};
  --font-size-xs: ${designTokens.typography.fontSize.xs};
  --font-size-sm: ${designTokens.typography.fontSize.sm};
  --font-size-base: ${designTokens.typography.fontSize.base};
  --font-size-lg: ${designTokens.typography.fontSize.lg};
  --font-size-xl: ${designTokens.typography.fontSize.xl};
  --font-size-2xl: ${designTokens.typography.fontSize['2xl']};
  --font-size-3xl: ${designTokens.typography.fontSize['3xl']};
  --font-size-4xl: ${designTokens.typography.fontSize['4xl']};
  
  --font-weight-normal: ${designTokens.typography.fontWeight.normal};
  --font-weight-medium: ${designTokens.typography.fontWeight.medium};
  --font-weight-semibold: ${designTokens.typography.fontWeight.semibold};
  --font-weight-bold: ${designTokens.typography.fontWeight.bold};
  
  --line-height-tight: ${designTokens.typography.lineHeight.tight};
  --line-height-normal: ${designTokens.typography.lineHeight.normal};
  --line-height-relaxed: ${designTokens.typography.lineHeight.relaxed};
  
  /* Shadows */
  --shadow-sm: ${designTokens.shadows.sm};
  --shadow-md: ${designTokens.shadows.md};
  --shadow-lg: ${designTokens.shadows.lg};
  --shadow-xl: ${designTokens.shadows.xl};
  --shadow-2xl: ${designTokens.shadows['2xl']};
  --shadow-inner: ${designTokens.shadows.inner};
  
  /* Border Radius */
  --radius-sm: ${designTokens.borderRadius.sm};
  --radius-md: ${designTokens.borderRadius.md};
  --radius-lg: ${designTokens.borderRadius.lg};
  --radius-xl: ${designTokens.borderRadius.xl};
  --radius-2xl: ${designTokens.borderRadius['2xl']};
  --radius-full: ${designTokens.borderRadius.full};
  
  /* Transitions */
  --transition-fast: ${designTokens.transitions.fast};
  --transition-normal: ${designTokens.transitions.normal};
  --transition-slow: ${designTokens.transitions.slow};
}

*{box-sizing:border-box}
body{font-family:var(--font-family);background:var(--bg);color:var(--fg);margin:0;padding:0;min-height:100vh;line-height:var(--line-height-normal);}

/* Container */
.container{max-width:1400px;margin:0 auto;padding:var(--spacing-5xl) var(--spacing-4xl);}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--spacing-6xl);flex-wrap:wrap;gap:var(--spacing-4xl);padding:var(--spacing-6xl);background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-2xl);box-shadow:var(--shadow-lg);transition:all var(--transition-normal);}
.header:hover{box-shadow:var(--shadow-xl);transform:translateY(-2px);}

.brand{display:flex;align-items:center;gap:var(--spacing-4xl);}
.brand-icon{width:64px;height:64px;border-radius:var(--radius-xl);background:linear-gradient(135deg,var(--primary-500),var(--primary-700));display:flex;align-items:center;justify-content:center;font-weight:var(--font-weight-bold);color:#fff;font-size:var(--font-size-2xl);box-shadow:var(--shadow-lg);animation:float 3s ease-in-out infinite;}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.brand-title{font-size:var(--font-size-4xl);font-weight:var(--font-weight-bold);letter-spacing:-0.02em;margin:0;}
.brand-sub{color:var(--neutral-500);font-size:var(--font-size-lg);margin:0;}

.status-section{text-align:right;}
.status-badge{display:inline-flex;align-items:center;gap:var(--spacing-sm);padding:var(--spacing-sm) var(--spacing-3xl);border-radius:var(--radius-full);background:rgba(16,185,129,0.12);color:var(--success);font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);border:1px solid rgba(16,185,129,0.3);box-shadow:var(--shadow-md);margin-bottom:var(--spacing-sm);transition:all var(--transition-normal);}
.status-badge.fail{background:rgba(239,68,68,0.12);color:var(--error);border-color:rgba(239,68,68,0.3);}
.score-display{font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:var(--fg);text-shadow:0 2px 4px rgba(0,0,0,0.1);}

/* Action Bar */
.action-bar{display:flex;gap:var(--spacing-lg);margin-bottom:var(--spacing-6xl);flex-wrap:wrap;justify-content:space-between;align-items:center;}
.action-group{display:flex;gap:var(--spacing-lg);flex-wrap:wrap;}
.connection-status{display:inline-flex;align-items:center;gap:var(--spacing-sm);padding:var(--spacing-xs) var(--spacing-lg);border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:var(--font-weight-medium);border:1px solid var(--border);background:var(--panel);}
.connection-status.connected{background:rgba(16,185,129,0.08);color:var(--success);border-color:rgba(16,185,129,0.25);}
.connection-status.disconnected{background:rgba(239,68,68,0.08);color:var(--error);border-color:rgba(239,68,68,0.25);}
.btn{display:inline-flex;align-items:center;gap:var(--spacing-sm);padding:var(--spacing-lg) var(--spacing-3xl);border-radius:var(--radius-lg);font-size:var(--font-size-base);font-weight:var(--font-weight-medium);text-decoration:none;border:none;cursor:pointer;transition:all var(--transition-normal);box-shadow:var(--shadow-sm);position:relative;overflow:hidden;}
.btn::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg,transparent,rgba(255,255,255,0.1),transparent);transform:translateX(-100%);transition:transform var(--transition-slow);}
.btn:hover::before{transform:translateX(100%);}
.btn-primary{background:linear-gradient(135deg,var(--primary-500),var(--primary-600));color:white;}
.btn-primary:hover{background:linear-gradient(135deg,var(--primary-600),var(--primary-700));box-shadow:var(--shadow-md);transform:translateY(-1px);}
.btn-secondary{background:var(--button);color:var(--fg);}
.btn-secondary:hover{background:var(--neutral-300);box-shadow:var(--shadow-md);transform:translateY(-1px);}
.btn span{font-size:var(--font-size-lg);}

/* Overview Grid */
.overview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:var(--spacing-4xl);margin-bottom:var(--spacing-6xl);}
.overview-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-xl);padding:var(--spacing-5xl);text-align:center;box-shadow:var(--shadow-md);transition:all var(--transition-normal);position:relative;overflow:hidden;}
.overview-card::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:linear-gradient(90deg,var(--primary-500),var(--secondary-500));}
.overview-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-4px);}
.overview-icon{font-size:var(--font-size-4xl);margin-bottom:var(--spacing-lg);color:var(--primary-500);}
.overview-value{font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);margin-bottom:var(--spacing-sm);color:var(--fg);}
.overview-label{font-size:var(--font-size-sm);color:var(--neutral-500);font-weight:var(--font-weight-medium);}

/* Charts Section */
.charts-section{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:var(--spacing-6xl);margin-bottom:var(--spacing-6xl);}
.chart-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-xl);padding:var(--spacing-5xl);box-shadow:var(--shadow-md);transition:all var(--transition-normal);}
.chart-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px);}
.chart-title{font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);margin-bottom:var(--spacing-4xl);color:var(--fg);}

/* Findings Section */
.findings-section{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-xl);padding:var(--spacing-6xl);margin-bottom:var(--spacing-6xl);box-shadow:var(--shadow-md);}
.findings-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--spacing-5xl);flex-wrap:wrap;gap:var(--spacing-4xl);}
.findings-title{font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);color:var(--fg);}
.findings-controls{display:flex;gap:var(--spacing-lg);flex-wrap:wrap;align-items:center;}
.search-input{padding:var(--spacing-lg) var(--spacing-3xl);border:1px solid var(--border);border-radius:var(--radius-lg);font-size:var(--font-size-base);background:var(--input);color:var(--fg);transition:all var(--transition-normal);min-width:200px;}
.search-input:focus{outline:none;border-color:var(--focus);box-shadow:0 0 0 3px rgba(59,130,246,0.1);}
.filter-select{padding:var(--spacing-lg) var(--spacing-3xl);border:1px solid var(--border);border-radius:var(--radius-lg);font-size:var(--font-size-base);background:var(--input);color:var(--fg);transition:all var(--transition-normal);}
.filter-chips{display:flex;gap:var(--spacing-sm);flex-wrap:wrap;}
.chip{padding:var(--spacing-sm) var(--spacing-lg);border-radius:var(--radius-full);font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);cursor:pointer;transition:all var(--transition-normal);border:1px solid var(--border);background:var(--button);color:var(--fg);}
.chip.active{background:var(--primary-500);color:white;border-color:var(--primary-500);}
.chip:hover{transform:translateY(-1px);box-shadow:var(--shadow-sm);}

/* Table */
.table-container{overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border);background:var(--input);}
.findings-table{width:100%;border-collapse:collapse;}
.findings-table th{background:var(--neutral-100);padding:var(--spacing-lg) var(--spacing-3xl);text-align:left;font-weight:var(--font-weight-semibold);color:var(--fg);border-bottom:1px solid var(--border);}
.findings-table td{padding:var(--spacing-lg) var(--spacing-3xl);border-bottom:1px solid var(--border);color:var(--fg);}
.findings-table tr:hover{background:var(--neutral-50);}
.category-badge{display:inline-flex;align-items:center;padding:var(--spacing-xs) var(--spacing-lg);border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:var(--font-weight-medium);}
.severity-indicator{display:inline-flex;align-items:center;gap:var(--spacing-xs);}
.severity-dot{width:8px;height:8px;border-radius:var(--radius-full);}
.severity-high{background:var(--error-500);color:var(--error-500);}
.severity-medium{background:var(--warning-500);color:var(--warning-500);}
.severity-low{background:var(--primary-500);color:var(--primary-500);}
.file-link{color:var(--primary-500);text-decoration:none;cursor:pointer;transition:color var(--transition-normal);}
.file-link:hover{color:var(--primary-600);text-decoration:underline;}

/* Empty State */
.empty-state{text-align:center;padding:var(--spacing-6xl);color:var(--neutral-500);}
.empty-icon{font-size:var(--font-size-4xl);margin-bottom:var(--spacing-lg);}
.empty-title{font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);margin-bottom:var(--spacing-sm);}
.empty-desc{font-size:var(--font-size-base);color:var(--neutral-400);}

/* Responsive */
@media(max-width:768px){
  .container{padding:var(--spacing-4xl) var(--spacing-3xl);}
  .header{flex-direction:column;text-align:center;}
  .status-section{text-align:center;margin-top:var(--spacing-4xl);}
  .charts-section{grid-template-columns:1fr;}
  .findings-controls{flex-direction:column;width:100%;}
  .search-input{width:100%;}
  .table-container{max-height:400px;}
}

/* Animations */
@keyframes fadeInUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
.animate-in{animation:fadeInUp 0.5s ease both;}
.overview-card:nth-child(1){animation-delay:0.1s;}
.overview-card:nth-child(2){animation-delay:0.2s;}
.overview-card:nth-child(3){animation-delay:0.3s;}
.overview-card:nth-child(4){animation-delay:0.4s;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <div class="brand-icon">SB</div>
      <div>
        <div class="brand-title">SimpleBeacon</div>
        <div class="brand-sub">AI-Powered Development Companion &mdash; v${this.version}</div>
      </div>
    </div>
    <div class="status-section">
      <div class="connection-status ${connectionStatus}">
        <span style="font-size:var(--font-size-xs);">●</span> ${connectionLabel}
      </div>
      <div class="status-badge ${pass ? '' : 'fail'}">
        <span style="font-size:var(--font-size-xs);">●</span> Gate ${pass}
      </div>
      <div class="score-display">${score}/100</div>
    </div>
  </div>

  <div class="action-bar">
    <div class="action-group">
      <button class="btn btn-primary" data-command="scanWorkspace">
        <span>🔍</span> Scan Workspace
      </button>
      <button class="btn btn-secondary" data-command="exportReport">
        <span>📄</span> Export Report
      </button>
      <button class="btn btn-secondary" data-command="exportAIReport">
        <span>🤖</span> Export for AI
      </button>
      <button class="btn btn-secondary" data-command="generateCertificate">
        <span>✅</span> Generate Certificate
      </button>
    </div>
    <div class="action-group">
      <button class="btn btn-secondary" data-command="startRealtimeMonitoring">
        <span>🟢</span> Start Real-time
      </button>
      <button class="btn btn-secondary" data-command="showCodeMap">
        <span>🗺️</span> Code Map
      </button>
      <button class="btn btn-secondary" data-command="openInBrowser">
        <span>🌐</span> Open in Browser
      </button>
    </div>
  </div>

  <div class="overview-grid">
    <div class="overview-card animate-in">
      <div class="overview-icon">📁</div>
      <div class="overview-value">${files}</div>
      <div class="overview-label">Files Scanned</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">📂</div>
      <div class="overview-value">${folders}</div>
      <div class="overview-label">Folders</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">🔍</div>
      <div class="overview-value">${totalFindings}</div>
      <div class="overview-label">Total Findings</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">📊</div>
      <div class="overview-value">${categories.length}</div>
      <div class="overview-label">Categories</div>
    </div>
  </div>

  <div class="charts-section">
    <div class="chart-card">
      <div class="chart-title">Category Breakdown</div>
      <div class="bar-chart">
        ${this.buildEnhancedCategoryChart(categories)}
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Severity Distribution</div>
      <div class="ring-chart">
        ${this.buildEnhancedSeverityChart(allFindings)}
      </div>
    </div>
  </div>

  ${
    this.hasEnhancedAnalysis
      ? `
  <div class="findings-section">
    <div class="findings-header">
      <div class="findings-title">Findings Details</div>
      <div class="findings-controls">
        <label for="searchInput" style="position:absolute;left:-9999px;">Search findings</label>
        <input type="text" class="search-input" placeholder="Search findings..." id="searchInput" aria-label="Search findings">
        <label for="categoryFilter" style="position:absolute;left:-9999px;">Filter by category</label>
        <select class="filter-select" id="categoryFilter" aria-label="Filter by category">
          <option value="all">All Categories</option>
          ${categories.map((c) => `<option value="${c.label}">${c.label}</option>`).join('')}
        </select>
        <div class="filter-chips">
          <span class="chip active" data-severity="all">All</span>
          <span class="chip" data-severity="high">High</span>
          <span class="chip" data-severity="medium">Medium</span>
          <span class="chip" data-severity="low">Low</span>
        </div>
      </div>
    </div>
    <div class="table-container">
      <table class="findings-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Severity</th>
            <th>Finding</th>
            <th>Location</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody id="findingsBody"></tbody>
      </table>
      <div id="emptyState" class="empty-state" style="display:none;">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No findings match your filters</div>
        <div class="empty-desc">Try adjusting the search or severity filters</div>
      </div>
    </div>
  </div>

  <div class="findings-section">
    <div class="findings-header">
      <div class="findings-title">Files with Most Issues</div>
      <div class="findings-controls">
        <div class="filter-chips">
          <span class="chip active">Top 20 Files</span>
        </div>
      </div>
    </div>
    <div class="table-container">
      <table class="findings-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Issues</th>
            <th>Severity Breakdown</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="failingFilesBody">
          ${failingFilesHtml}
        </tbody>
      </table>
    </div>
  </div>
  `
      : `
  <div class="findings-section" style="text-align:center;padding:48px 24px;">
    <div style="font-size:3rem;margin-bottom:16px;">🤖</div>
    <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">Enhanced Analysis Required</div>
    <div style="color:var(--muted);margin-bottom:24px;">Scan data has been collected. Run Enhanced Analysis to view findings and remediation suggestions.</div>
    <button class="btn btn-primary" data-command="enhancedAnalysis" style="padding:14px 28px;font-size:1rem;">
      <span>⚡</span> Run Enhanced Analysis
    </button>
  </div>
  `
  }
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
window.vscode=vscode;
const data=${findingsJson};
const searchInput=document.getElementById('searchInput');
const categoryFilter=document.getElementById('categoryFilter');
const severityChips=document.querySelectorAll('.chip');
const findingsBody=document.getElementById('findingsBody');
const emptyState=document.getElementById('emptyState');
const hasFindingsUI = !!searchInput;

const findingsData = data;

function getCategoryColor(category){
  const map={
    'Blocking':var(--error-500),'Secrets':var(--error-500),'AI Indicators':var(--warning-500),'EU AI Act':var(--warning-500),
    'Vulnerabilities':var(--error-500),'Debug Markers':var(--primary-500),
    'AI Residue':var(--warning-500),'Performance':var(--warning-500),'Type Safety':var(--primary-500),'Test Coverage':var(--success-500),
    'Accessibility':var(--primary-600),'i18n':var(--primary-600),'Sensitive Data':var(--error-500),'Config Drift':var(--warning-500),
    'Security Headers':var(--error-500),'Database Patterns':var(--error-500),'Framework Practices':var(--warning-500),
    'Workspace Health':var(--primary-500),'Unused Deps':var(--success-500),'API Contract':var(--primary-500),'Complexity':var(--warning-500),
    'LLM Slop':var(--primary-600),'Token Bleed':var(--primary-600),'Production Leak':var(--error-500),'Fiction KPI':var(--warning-500),
    'Security':var(--error-500),'Quality':var(--warning-500),'Maintainability':var(--primary-500)
  };
  return map[category]||'var(--primary-500)';
}

function sanitizeHtml(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function renderFindings(findings){
  if (!findingsBody || !emptyState) return;

  if(!findings || !findings.length){
    findingsBody.style.display='none';
    emptyState.style.display='block';
    return;
  }
  findingsBody.style.display='';
  emptyState.style.display='none';

  findingsBody.textContent = '';
  for (const f of findings) {
    const catColor = getCategoryColor(f.cat);
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.background = catColor + '12';
    badge.style.color = catColor;
    badge.style.border = '1px solid ' + catColor + '25';
    badge.textContent = f.cat;
    td1.appendChild(badge); tr.appendChild(td1);
    const td2 = document.createElement('td');
    const sevDiv = document.createElement('div');
    sevDiv.className = 'severity-indicator severity-' + f.sev;
    const dot = document.createElement('span'); dot.className = 'severity-dot';
    const sevSpan = document.createElement('span');
    sevSpan.textContent = f.sev.toUpperCase();
    sevDiv.appendChild(dot); sevDiv.appendChild(sevSpan);
    td2.appendChild(sevDiv); tr.appendChild(td2);
    const td3 = document.createElement('td');
    td3.textContent = f.desc;
    tr.appendChild(td3);
    const td4 = document.createElement('td');
    const link = document.createElement('span');
    link.className = 'file-link';
    link.dataset.file = f.file || '';
    link.dataset.line = String(f.line || 1);
    link.textContent = f.file ? (f.file.split(/[\\/]/).pop() + (f.line ? ':' + f.line : '')) : '—';
    link.addEventListener('click', () => {
      if (f.file) vscode.postMessage({ command: 'openFile', file: f.file, line: f.line || 1 });
    });
    td4.appendChild(link); tr.appendChild(td4);
    const td5 = document.createElement('td');
    if (f.patternId && ['debugArtifacts','innerHtmlXss','unhandledPromise','dbAntiPattern','typeSafetyAny','insecureRandom'].includes(f.patternId)) {
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-secondary';
      fixBtn.style.padding = '2px 6px';
      fixBtn.style.fontSize = '.7rem';
      fixBtn.textContent = 'Suggest Fix';
      fixBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'suggestFix', patternId: f.patternId, file: f.file, line: f.line });
      });
      td5.appendChild(fixBtn);
    } else {
      td5.textContent = '—';
    }
    tr.appendChild(td5);
    findingsBody.appendChild(tr);
  }
}

function filterFindings(){
  if (!searchInput || !categoryFilter) return;

  const query=searchInput.value.toLowerCase();
  const category=categoryFilter.value;
  const activeChip=document.querySelector('.chip.active');
  const severity=activeChip?.dataset.severity||'all';

  const filtered=data.filter(f=>{
    const matchesSearch=query===''||f.desc.toLowerCase().includes(query)||f.cat.toLowerCase().includes(query)||f.file.toLowerCase().includes(query);
    const matchesCategory=category==='all'||f.cat===category;
    const matchesSeverity=severity==='all'||f.sev===severity;
    return matchesSearch&&matchesCategory&&matchesSeverity;
  });

  renderFindings(filtered);
}

if (hasFindingsUI) {
  severityChips.forEach(chip=>{
    chip.addEventListener('click',()=>{
      severityChips.forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      filterFindings();
    });
  });

  searchInput.addEventListener('input',filterFindings);
  categoryFilter.addEventListener('change',filterFindings);

  // Initial render
  filterFindings();
}

// Add click handlers for action buttons
document.querySelectorAll('.btn').forEach(button => {
  button.addEventListener('click', (e) => {
    const command = button.getAttribute('data-command');
    if (command) {
      vscode.postMessage({ command: command });
    }
  });
});

// Animate charts on load
setTimeout(()=>{
  document.querySelectorAll('.bar-fill').forEach(bar=>{
    const target=bar.getAttribute('data-target');
    if(target)bar.style.width=target+'%';
  });
},200);
</script>
</body>
</html>`;
  }

  private extractCategories(
    report: unknown
  ): { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] = [];

    // ScanResult format: report.categories is Record<string, Finding[]>
    if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
      const severityMap: Record<string, 'pass' | 'fail' | 'warn' | 'info'> = {
        security: 'fail',
        debug: 'info',
        aiResidue: 'warn',
        performance: 'warn',
        typeSafety: 'info',
        testCoverage: 'info',
        accessibility: 'info',
        quality: 'warn',
        other: 'info',
      };
      for (const [cat, items] of Object.entries(r.categories)) {
        if (Array.isArray(items) && items.length > 0) {
          cats.push({ label: cat, count: items.length, severity: severityMap[cat] || 'info' });
        }
      }
      return cats;
    }

    // CLI report format
    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };
    push('Blocking', 'fail', r.gate?.blockingIssues);
    push('Secrets', 'fail', r.credentialHygiene?.secrets);
    push('AI Indicators', 'warn', r.aiIndicators?.findings);
    push('EU AI Act', 'warn', r.euAiAct?.findings);
    push('Vulnerabilities', 'fail', r.dependencyAudit?.vulnerabilities);
    push('Debug Markers', 'info', r.cleanup?.debugMarkers);
    push('AI Residue', 'warn', r.aiResidue?.aiResidueFindings);
    push('Performance', 'warn', r.performance?.performanceFindings);
    push('Type Safety', 'info', r.typeSafety?.typeSafetyFindings);
    push('Test Coverage', 'info', r.testCoverage?.testCoverageFindings);
    push('Accessibility', 'info', r.accessibility?.accessibilityFindings);
    push('i18n', 'info', r.i18n?.i18nFindings);
    push('Sensitive Data', 'fail', r.sensitiveData?.sensitiveDataFindings);
    push('Config Drift', 'warn', r.configDrift?.configDriftFindings);
    push('Security Headers', 'fail', r.securityHeaders?.securityHeaderFindings);
    push('Database Patterns', 'fail', r.databasePatterns?.dbPatternFindings);
    push('Framework Practices', 'warn', r.frameworkPractices?.frameworkFindings);
    push('Workspace Health', 'info', r.workspaceHealth?.workspaceFindings);
    push('Unused Deps', 'info', r.unusedDeps?.unusedDepFindings);
    push('API Contract', 'info', r.apiContract?.apiContractFindings);
    push('Complexity', 'warn', r.complexity?.complexityFindings);
    push('LLM Slop', 'warn', r.llmSlop?.llmSlopFindings);
    push('Token Bleed', 'warn', r.tokenBleed?.tokenBleedFindings);
    push('Production Leak', 'fail', r.productionLeak?.productionLeakFindings);
    push('Fiction KPI', 'warn', r.fictionKpi?.fictionKpiFindings);
    push('Security', 'fail', r.security?.securityFindings);
    push('Quality', 'warn', r.quality?.qualityFindings);
    push('Maintainability', 'info', r.maintainability?.maintainabilityFindings);

    // Fallback: flat rawIssues (common in CLI JSON reports)
    if (cats.length === 0 && r.rawIssues?.length) {
      const high = r.rawIssues.filter((i: RawIssue) => i.severity === 'high' || i.severity === 'critical');
      const medium = r.rawIssues.filter((i: RawIssue) => i.severity === 'medium');
      const low = r.rawIssues.filter((i: RawIssue) => i.severity === 'low');
      if (high.length) cats.push({ label: 'Blocking Issues', count: high.length, severity: 'fail' });
      if (medium.length) cats.push({ label: 'Warnings', count: medium.length, severity: 'warn' });
      if (low.length) cats.push({ label: 'Info', count: low.length, severity: 'info' });
    }

    // Fallback: severityCounts when no structured data at all
    if (cats.length === 0 && r.severityCounts) {
      const sc = r.severityCounts;
      if (sc.critical) cats.push({ label: 'Critical', count: sc.critical, severity: 'fail' });
      if (sc.high) cats.push({ label: 'High', count: sc.high, severity: 'fail' });
      if (sc.medium) cats.push({ label: 'Medium', count: sc.medium, severity: 'warn' });
      if (sc.low) cats.push({ label: 'Low', count: sc.low, severity: 'info' });
    }

    return cats;
  }

  private extractAllFindings(
    report: unknown
  ): { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] {
    const r = report as any;
    const all: { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] = [];

    // ScanResult format: report.categories is Record<string, Finding[]>
    if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
      for (const [cat, items] of Object.entries(r.categories)) {
        if (!Array.isArray(items)) continue;
        for (const it of items) {
          all.push({
            cat,
            sev: (it as RawIssue).severity || 'medium',
            desc: (it as RawIssue).message || (it as RawIssue).type || 'Finding',
            file: (it as RawIssue).file || '',
            line: (it as RawIssue).line ?? '',
            patternId: (it as RawIssue).patternId || '',
          });
        }
      }
      return all;
    }

    // CLI report format
    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
          file: it.file || it.path || '',
          line: it.line || '',
          patternId: it.patternId || '',
        });
      });
    };

    if (!r.gate?.blockingIssues?.length && !r.credentialHygiene?.secrets?.length && r.rawIssues?.length) {
      r.rawIssues.forEach((it: RawIssue) => {
        all.push({
          cat: it.type || 'Finding',
          sev: it.severity || 'medium',
          desc: it.description || it.type || 'Finding',
          file: it.file || it.filePath || '',
          line: it.line || '',
        });
      });
      return all;
    }

    push('Blocking', 'high', r.gate?.blockingIssues);
    push('Secrets', 'high', r.credentialHygiene?.secrets);
    push('AI Indicators', 'medium', r.aiIndicators?.findings);
    push('EU AI Act', 'medium', r.euAiAct?.findings);
    push('Vulnerabilities', 'high', r.dependencyAudit?.vulnerabilities);
    push('Debug Markers', 'low', r.cleanup?.debugMarkers);
    push('AI Residue', 'medium', r.aiResidue?.aiResidueFindings);
    push('Performance', 'medium', r.performance?.performanceFindings);
    push('Type Safety', 'low', r.typeSafety?.typeSafetyFindings);
    push('Test Coverage', 'low', r.testCoverage?.testCoverageFindings);
    push('Accessibility', 'low', r.accessibility?.accessibilityFindings);
    push('i18n', 'low', r.i18n?.i18nFindings);
    push('Sensitive Data', 'high', r.sensitiveData?.sensitiveDataFindings);
    push('Config Drift', 'medium', r.configDrift?.configDriftFindings);
    push('Security Headers', 'high', r.securityHeaders?.securityHeaderFindings);
    push('Database Patterns', 'high', r.databasePatterns?.dbPatternFindings);
    push('Framework Practices', 'medium', r.frameworkPractices?.frameworkFindings);
    push('Workspace Health', 'low', r.workspaceHealth?.workspaceFindings);
    push('Unused Deps', 'low', r.unusedDeps?.unusedDepFindings);
    push('API Contract', 'low', r.apiContract?.apiContractFindings);
    push('Complexity', 'medium', r.complexity?.complexityFindings);
    push('LLM Slop', 'medium', r.llmSlop?.llmSlopFindings);
    push('Token Bleed', 'medium', r.tokenBleed?.tokenBleedFindings);
    push('Production Leak', 'high', r.productionLeak?.productionLeakFindings);
    push('Fiction KPI', 'medium', r.fictionKpi?.fictionKpiFindings);
    push('Security', 'high', r.security?.securityFindings);
    push('Quality', 'medium', r.quality?.qualityFindings);
    push('Maintainability', 'low', r.maintainability?.maintainabilityFindings);

    return all;
  }

  private extractFailingFiles(
    report: unknown
  ): { file: string; issues: { severity: string; description: string; line: number }[] }[] {
    const r = report as any;
    const fileMap = new Map<string, { issues: { severity: string; description: string; line: number }[] }>();

    // ScanResult format: report.findings
    if (r.findings && Array.isArray(r.findings)) {
      for (const issue of r.findings) {
        const filePath = issue.file || 'Unknown';
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.message || issue.type || 'Issue',
          line: issue.matches?.[0]?.line || 1,
        });
      }
      return Array.from(fileMap.entries())
        .map(([file, data]) => ({ file, issues: data.issues }))
        .sort((a, b) => b.issues.length - a.issues.length)
        .slice(0, 20);
    }

    // CLI report format: rawIssues
    if (r.rawIssues && r.rawIssues.length > 0) {
      r.rawIssues.forEach((issue: RawIssue) => {
        const filePath = issue.filePath || issue.file || issue.path || 'Unknown';
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.description || issue.type || 'Issue',
          line: issue.line || 1,
        });
      });
    }

    // Convert to array and sort by issue count
    return Array.from(fileMap.entries())
      .map(([file, data]) => ({ file, issues: data.issues }))
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 20);
  }

  private buildFailingFilesTable(
    failingFiles: { file: string; issues: { severity: string; description: string; line: number }[] }[]
  ): string {
    if (!failingFiles.length) {
      return '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No files with issues found</td></tr>';
    }

    return failingFiles
      .map((file) => {
        const severityCounts = file.issues.reduce(
          (acc, issue) => {
            acc[issue.severity] = (acc[issue.severity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const severityBadges = Object.entries(severityCounts)
          .map(([severity, count]) => {
            const color =
              severity === 'high'
                ? 'var(--error-500)'
                : severity === 'medium'
                  ? 'var(--warning-500)'
                  : 'var(--primary-500)';
            return `<span style="background: ${color}12; color: ${color}; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">${severity}: ${count}</span>`;
          })
          .join('');

        const fileName = file.file.split(/[/\\]/).pop() || file.file;

        return `
        <tr>
          <td>
            <span class="file-link" data-file="${file.file}" style="cursor: pointer; color: var(--primary-500);">
              ${fileName}
            </span>
          </td>
          <td>${file.issues.length}</td>
          <td>${severityBadges}</td>
          <td>
            <button class="btn btn-secondary" onclick="vscode.postMessage({command:'openFile', file:'${file.file}', line:1})" style="padding: 4px 8px; font-size: 12px;">
              Open
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  private buildEnhancedCategoryChart(categories: { label: string; count: number; severity: string }[]): string {
    const maxCount = Math.max(...categories.map((c) => c.count || 0));

    return categories
      .map((cat) => {
        const percentage = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
        const color =
          cat.severity === 'fail'
            ? 'var(--error-500)'
            : cat.severity === 'warn'
              ? 'var(--warning-500)'
              : 'var(--primary-500)';

        return `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 500;">${cat.label}</span>
            <span style="font-size: 12px; color: var(--neutral-500);">${cat.count || 0}</span>
          </div>
          <div style="background: var(--neutral-200); border-radius: 4px; height: 8px; overflow: hidden;">
            <div class="bar-fill" style="background: ${color}; height: 100%; width: 0%; transition: width 1s ease-out;" data-target="${percentage}"></div>
          </div>
        </div>
      `;
      })
      .join('');
  }

  private buildEnhancedSeverityChart(findings: any[]): string {
    const severityCounts = findings.reduce(
      (acc, finding) => {
        acc[finding.sev] = (acc[finding.sev] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const total = findings.length;
    const colors = {
      high: 'var(--error-500)',
      medium: 'var(--warning-500)',
      low: 'var(--primary-500)',
    };

    return Object.entries(severityCounts)
      .map(([severity, count]) => {
        const countNum = Number(count) || 0;
        const percentage = total > 0 ? (countNum / total) * 100 : 0;
        const color = colors[severity as keyof typeof colors] || 'var(--neutral-500)';

        return `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; margin-right: 8px;"></div>
          <span style="font-size: 12px; font-weight: 500; margin-right: 8px;">${severity.toUpperCase()}</span>
          <span style="font-size: 12px; color: var(--neutral-500);">${countNum} (${percentage.toFixed(1)}%)</span>
        </div>
      `;
      })
      .join('');
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (match) => {
      const escapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return escapeMap[match] || match;
    });
  }

  private async handleSuggestFix(patternId: string, filePath: string, line: number) {
    try {
      const report = this.report as any;
      let finding = null;
      if (report?.categories) {
        for (const cat of Object.values(report.categories) as any[][]) {
          finding = cat.find((f: RawIssue) => f.file === filePath && f.line === line && f.patternId === patternId);
          if (finding) break;
        }
      }
      if (!finding && Array.isArray(report?.findings)) {
        finding = report.findings.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding && Array.isArray(report?.rawIssues)) {
        finding = report.rawIssues.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding && Array.isArray(report?.detectedIssues)) {
        finding = report.detectedIssues.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding) {
        vscode.window.showInformationMessage('Finding not found in current report. Run a fresh scan.');
        return;
      }

      const { getFixForFinding } = await import('./fixes/fixRegistry');
      const fix = getFixForFinding(finding);
      if (!fix) {
        vscode.window.showInformationMessage(`No automated fix available for ${patternId}. Manual review required.`);
        return;
      }

      const buttons = ['Preview Diff', 'Cancel'];
      if (fix.autoFixable) buttons.unshift('Auto Fix');
      const action = await vscode.window.showInformationMessage(
        `Fix suggestion for ${patternId}: ${fix.description}`,
        ...buttons
      );

      if (action === 'Cancel' || !action) return;

      if (action === 'Preview Diff') {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const originalLine = doc.lineAt(line - 1).text;
        const patchedLine = originalLine.replace(fix.search, fix.replace);
        const panel = vscode.window.createWebviewPanel(
          'simplebeaconFixPreview',
          'SimpleBeacon Fix Preview',
          vscode.ViewColumn.Two,
          { enableScripts: false }
        );
        panel.webview.html = `<!DOCTYPE html>
          <html><head><style>
            body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
            .diff { display: flex; gap: 20px; }
            .col { flex: 1; }
            .title { font-weight: bold; margin-bottom: 8px; color: #fff; }
            .line { padding: 4px; border-radius: 4px; }
            .original { background: #3c1618; }
            .patched { background: #1e3c1e; }
            pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
          </style></head><body>
            <div class="diff">
              <div class="col">
                <div class="title">Original</div>
                <div class="line original"><pre>${this.escapeHtml(originalLine)}</pre></div>
              </div>
              <div class="col">
                <div class="title">Patched</div>
                <div class="line patched"><pre>${this.escapeHtml(patchedLine)}</pre></div>
              </div>
            </div>
          </body></html>
        `;
        return;
      }

      if (action === 'Auto Fix' && fix.autoFixable) {
        const editor = await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        const range = new vscode.Range(line - 1, 0, line - 1, editor.document.lineAt(line - 1).text.length);
        const originalLine = editor.document.lineAt(line - 1).text;
        const patchedLine = originalLine.replace(fix.search, fix.replace);
        await editor.edit((editBuilder) => {
          editBuilder.replace(range, patchedLine);
        });
        vscode.window.showInformationMessage(`Applied fix: ${fix.description}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Fix failed: ${err}`);
    }
  }
}
