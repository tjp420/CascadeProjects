// VS Code API
// simplebeacon-ignore memory-leak — HTTP response accumulation and report processing
import * as vscode from 'vscode';

// Node built-ins
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import * as crypto from 'crypto';

// Local modules
import { designTokens, themeColors } from './designSystem';
import { RawIssue } from './scanProvider';
import { ModernSidebarProvider } from './modernSidebarProvider';
import { extractCategories, extractAllFindings, extractFailingFiles, escapeHtml } from './dashboardDataExtractor';

/**
 * Enhanced dashboard webview panel (v2.0) with modern UI/UX for scan visualization.
 */
export class EnhancedDashboard30 {
  private static currentPanel: EnhancedDashboard30 | undefined;
  private static browserPanel: vscode.WebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private report: unknown;
  private highlight: string | null;
  private hasEnhancedAnalysis: boolean;
  private readonly version: string;

  public static createOrShow(extUri: vscode.Uri, report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    // Sync browser preview if it exists, but always open IDE panel too
    const welcomePanel = ModernSidebarProvider.getBrowserPanel();
    if (welcomePanel) {
      const fakePanel = {
        webview: { cspSource: '', onDidReceiveMessage: () => ({ dispose: () => {} }) },
        onDidDispose: () => ({ dispose: () => {} }),
        reveal: () => {}
      } as unknown as vscode.WebviewPanel;
      const inst = new EnhancedDashboard30(
        fakePanel,
        extUri,
        report,
        highlight ?? null,
        hasEnhancedAnalysis ?? false
      );
      inst.syncBrowserHtml(inst.getEnhancedHtml());
    }

    // Always show/create the IDE panel
    if (EnhancedDashboard30.currentPanel) {
      try {
        // Test if panel is still alive; if disposed, clear reference and recreate
        EnhancedDashboard30.currentPanel.panel.reveal(vscode.ViewColumn.One);
        EnhancedDashboard30.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
        return;
      } catch {
        // simplebeacon-ignore error-swallowing — panel reuse cleanup
        EnhancedDashboard30.currentPanel = undefined;
      }
    }
    const panel = vscode.window.createWebviewPanel('simplebeaconEnhanced30', 'SimpleBeacon Dashboard 3.0', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')],
    });
    EnhancedDashboard30.currentPanel = new EnhancedDashboard30(
      panel,
      extUri,
      report,
      highlight ?? null,
      hasEnhancedAnalysis ?? false
    );
  }

  public static updateIfOpen(report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    if (EnhancedDashboard30.currentPanel) {
      EnhancedDashboard30.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
    }
  }

  public static postMessage(message: unknown): void {
    if (EnhancedDashboard30.currentPanel) {
      EnhancedDashboard30.currentPanel.panel.webview.postMessage(message);
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
        EnhancedDashboard30.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'openFile') {
        if (!msg.file || typeof msg.file !== 'string') {
          return;
        }
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const rawPath = msg.file;
        const resolvedPath = path.isAbsolute(rawPath) ? rawPath : (workspace ? path.join(workspace, rawPath) : rawPath);
        const line = typeof msg.line === 'number' && msg.line > 0 ? msg.line : 1;
        const uri = vscode.Uri.file(resolvedPath);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
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
                        try { resolve(JSON.parse(data)); } catch { /* simplebeacon-ignore error-swallowing — JSON parse fallback */ resolve({ success: false, error: 'Invalid JSON' }); }
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
      } else if (msg.command === 'showRemediationGuide') {
        vscode.commands.executeCommand('simplebeacon.showRemediationGuide');
      } else if (msg.command === 'suggestFix') {
        this.handleSuggestFix(msg.patternId, msg.file, msg.line);
      } else if (msg.command === 'openInBrowser') {
        vscode.commands.executeCommand('simplebeacon.openInBrowser', '#/analyze');
      } else if (msg.command === 'openCodeMap') {
        vscode.commands.executeCommand('simplebeacon.openCodeMap');
      } else {
        // No-op: unknown command received from webview
      }
    });
    const html = this.getEnhancedHtml();
    this.panel.webview.html = html;
    this.syncBrowserHtml(html);
  }

  update(report: unknown, highlight: string | null = null, hasEnhancedAnalysis: boolean = false) {
    if (
      this.report === report &&
      this.highlight === highlight &&
      this.hasEnhancedAnalysis === hasEnhancedAnalysis
    ) {
      return;
    }
    this.report = report;
    this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    const html = this.getEnhancedHtml();
    this.panel.webview.html = html;
    this.syncBrowserHtml(html);
  }

  private syncBrowserHtml(html: string) {
    let browserHtml = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    browserHtml = browserHtml.replace(
      /const\s+vscode\s*=\s*acquireVsCodeApi\s*\(\)\s*;?/g,
      `const vscode={postMessage:(msg)=>{if(msg.command==='openInBrowser')return;/* Browser fallback: silently ignore */},getState:()=>({}),setState:()=>{}};`
    );
    ModernSidebarProvider._dashboardHtml = browserHtml;
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
          // simplebeacon-ignore error-swallowing — skip unreadable directories
        }
      }
      return { files, folders };
    } catch {
      // simplebeacon-ignore error-swallowing — directory walk fallback
      return { files: 0, folders: 0 };
    }
  }

  private getVersionFromExtUri(extUri: vscode.Uri): string {
    const packageJson = path.join(extUri.fsPath, '..', 'package.json');
    try {
      const pkg = require(packageJson);
      return pkg.version || '2.0.0';
    } catch {
      // simplebeacon-ignore error-swallowing — version read fallback
      return '3.0.0';
    }
  }

  private getEnhancedHtml(webview?: vscode.Webview): string {
    const targetWebview = webview || this.panel.webview;
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = targetWebview.cspSource;
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
    const projectPath = r.projectRoot || r.projectPath || r.scanTarget || '';

    const categories = extractCategories(r);
    const allFindings = extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((sum, c) => sum + c.count, 0);
    const findingsJson = JSON.stringify(
      allFindings.map((f) => ({ ...f, desc: escapeHtml(f.desc), file: escapeHtml(f.file) }))
    ).replace(/</g, '\\u003c');

    // Check API connectivity
    const apiConfig = vscode.workspace.getConfiguration('simplebeacon');
    const configuredUrl = apiConfig.get<string>('apiUrl', '').trim();
    const connectionStatus = configuredUrl ? 'connected' : 'disconnected';
    const connectionLabel = configuredUrl ? 'API Connected' : 'API Not Configured';

    const sevCounts = this.getSeverityCounts(allFindings);
    const failingFiles = extractFailingFiles(r);
    const failingFilesHtml = this.buildFailingFilesTable(failingFiles);

    // Get current theme
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? themeColors.dark : themeColors.light;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard 3.0</title>
<style>
/* Design System 3.0 - Glassmorphism */
:root{--bg:${theme.background};--fg:${theme.foreground};--panel:${theme.panel};--border:${theme.border};--input:${theme.input};--button:${theme.button};--focus:${theme.focus};--success:${theme.success};--warning:${theme.warning};--error:${theme.error};--glass-bg:rgba(255,255,255,0.03);--glass-border:rgba(255,255,255,0.06);--glass-hover:rgba(255,255,255,0.06);--radius-sm:6px;--radius-md:10px;--radius-lg:16px;--radius-xl:24px;--shadow:0 4px 24px rgba(0,0,0,0.15);--shadow-lg:0 8px 40px rgba(0,0,0,0.25);--spacing-xs:4px;--spacing-sm:8px;--spacing-md:16px;--spacing-lg:24px;--spacing-xl:32px;--font-xs:11px;--font-sm:12px;--font-base:13px;--font-md:14px;--font-lg:18px;--font-xl:24px;--font-2xl:32px;}

html,body{height:100%;margin:0;padding:0;background:var(--bg);background-color:var(--bg)}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--fg);font-size:var(--font-base);line-height:1.5;min-height:100vh}
.app{max-width:1000px;margin:0 auto;padding:var(--spacing-xl)}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-lg);margin-bottom:var(--spacing-xl);padding:var(--spacing-xl);background:linear-gradient(135deg,rgba(99,102,241,0.06) 0%,rgba(139,92,246,0.02) 50%,rgba(15,23,42,0.4) 100%);border:1px solid rgba(99,102,241,0.12);border-radius:var(--radius-xl);box-shadow:0 4px 32px rgba(0,0,0,0.12)}
.brand{display:flex;align-items:center;gap:var(--spacing-lg)}
.brand-icon{width:56px;height:56px;border-radius:var(--radius-lg);background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:var(--font-lg);box-shadow:0 8px 24px rgba(99,102,241,0.35);flex-shrink:0}
.brand-title{font-size:var(--font-2xl);font-weight:800;letter-spacing:-0.03em;background:linear-gradient(135deg,#e2e8f0,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.brand-sub{color:#94a3b8;font-size:var(--font-sm);margin-top:4px}
.brand-path{color:#64748b;font-size:var(--font-xs);margin-top:6px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'SF Mono',monospace}
.status{display:flex;flex-direction:column;align-items:flex-end;gap:var(--spacing-sm);flex-shrink:0}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(16,185,129,0.08);color:#10b981;font-size:var(--font-xs);font-weight:700;border:1px solid rgba(16,185,129,0.18);letter-spacing:0.3px;text-transform:uppercase}
.status-badge.fail{background:rgba(239,68,68,0.08);color:#ef4444;border-color:rgba(239,68,68,0.18)}
.score-ring{position:relative;width:88px;height:88px}
.score-ring svg{transform:rotate(-90deg)}
.score-ring-bg{fill:none;stroke:rgba(255,255,255,0.04);stroke-width:7}
.score-ring-fill{fill:none;stroke:${score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'};stroke-width:7;stroke-linecap:round;stroke-dasharray:${(score/100)*213.6} 213.6;transition:stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)}
.score-text{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:var(--font-xl);font-weight:800;color:${score >= 80 ? '#10b981' : score >= 50 ? '#fbbf24' : '#ef4444'}}

/* Actions */
.actions{display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-xl);flex-wrap:wrap;padding:var(--spacing-md);background:rgba(255,255,255,0.015);border:1px solid var(--glass-border);border-radius:var(--radius-xl)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:var(--radius-md);font-size:var(--font-sm);font-weight:600;border:none;cursor:pointer;transition:all .2s;letter-spacing:0.2px}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 4px 16px rgba(99,102,241,0.3),inset 0 1px 0 rgba(255,255,255,0.1)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(99,102,241,0.4),inset 0 1px 0 rgba(255,255,255,0.15)}
.btn-secondary{background:rgba(255,255,255,0.03);color:#e2e8f0;border:1px solid rgba(255,255,255,0.08)}
.btn-secondary:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);transform:translateY(-1px)}
.btn-sm{padding:6px 12px;font-size:var(--font-xs)}
.connection{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:var(--font-xs);border:1px solid var(--glass-border)}
.connection.connected{background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.15)}
.connection.disconnected{background:rgba(239,68,68,0.08);color:#ef4444;border-color:rgba(239,68,68,0.15)}

/* Stats Grid */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--spacing-md);margin-bottom:var(--spacing-xl)}
.stat-card{background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%);border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-lg);padding:var(--spacing-lg) var(--spacing-xl);display:flex;align-items:center;gap:var(--spacing-md);transition:all .25s;position:relative;overflow:hidden}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6366f1,#8b5cf6);opacity:0.6}
.stat-card:hover{background:linear-gradient(180deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.02) 100%);transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,0.2);border-color:rgba(255,255,255,0.08)}
.stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:var(--font-lg);flex-shrink:0}
.stat-icon.files{background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(37,99,235,0.08));color:#60a5fa;box-shadow:0 4px 12px rgba(59,130,246,0.15)}
.stat-icon.folders{background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(126,34,206,0.08));color:#c084fc;box-shadow:0 4px 12px rgba(168,85,247,0.15)}
.stat-icon.findings{background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.08));color:#fbbf24;box-shadow:0 4px 12px rgba(245,158,11,0.15)}
.stat-icon.categories{background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.08));color:#34d399;box-shadow:0 4px 12px rgba(16,185,129,0.15)}
.stat-info{flex:1;min-width:0}
.stat-value{font-size:var(--font-xl);font-weight:800;background:linear-gradient(135deg,#f1f5f9,#cbd5e1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stat-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;font-weight:600}

/* Severity pills */
.severities{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--spacing-md);margin-bottom:var(--spacing-xl)}
.sev-pill{background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-lg);padding:var(--spacing-md) var(--spacing-lg);display:flex;align-items:center;gap:var(--spacing-sm);transition:all .25s;position:relative;overflow:hidden}
.sev-pill:hover{background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.15)}
.sev-pill::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.sev-pill.critical::before{background:#ef4444}
.sev-pill.high::before{background:#f97316}
.sev-pill.medium::before{background:#f59e0b}
.sev-pill.low::before{background:#3b82f6}
.sev-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.sev-dot.critical{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.4)}
.sev-dot.high{background:#f97316;box-shadow:0 0 8px rgba(249,115,22,0.4)}
.sev-dot.medium{background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,0.4)}
.sev-dot.low{background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,0.4)}
.sev-count{font-size:var(--font-xl);font-weight:800}
.sev-label{font-size:var(--font-xs);color:#64748b;text-transform:uppercase;letter-spacing:0.8px}

/* Charts */
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--spacing-lg);margin-bottom:var(--spacing-xl)}
.chart-card{background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%);border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-lg);padding:var(--spacing-lg);transition:all .25s}
.chart-card:hover{border-color:rgba(255,255,255,0.08);box-shadow:0 8px 32px rgba(0,0,0,0.15)}
.chart-title{font-size:var(--font-md);font-weight:700;margin-bottom:var(--spacing-md);display:flex;align-items:center;gap:var(--spacing-sm);color:#e2e8f0}
.chart-title::before{content:'';width:3px;height:16px;border-radius:2px;background:linear-gradient(180deg,#6366f1,#8b5cf6)}
.bar-row{margin-bottom:var(--spacing-sm)}
.bar-label{display:flex;justify-content:space-between;margin-bottom:4px;font-size:var(--font-xs)}
.bar-track{background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width 1s ease-out}

/* Findings */
.section{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-lg)}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--spacing-md);flex-wrap:wrap;gap:var(--spacing-sm)}
.section-title{font-size:var(--font-md);font-weight:600;display:flex;align-items:center;gap:var(--spacing-sm)}
.section-title::before{content:'';width:3px;height:16px;border-radius:2px;background:linear-gradient(180deg,#6366f1,#8b5cf6)}
.search{width:100%;max-width:240px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:var(--radius-md);color:var(--fg);font-size:var(--font-sm);outline:none}
.search:focus{border-color:rgba(99,102,241,0.3)}
.filter-row{display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-md);flex-wrap:wrap}
.chip{padding:4px 10px;border-radius:999px;font-size:var(--font-xs);font-weight:600;cursor:pointer;border:1px solid var(--glass-border);background:transparent;color:var(--neutral-500);transition:all .15s}
.chip.active{background:rgba(99,102,241,0.15);color:#a5b4fc;border-color:rgba(99,102,241,0.25)}
.chip:hover{background:var(--glass-hover)}

/* Table */
.table{width:100%;border-collapse:separate;border-spacing:0}
.table th{text-align:left;padding:10px 12px;font-size:var(--font-xs);font-weight:600;color:var(--neutral-500);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--glass-border)}
.table td{padding:10px 12px;font-size:var(--font-sm);border-bottom:1px solid var(--glass-border)}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:rgba(255,255,255,0.02)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:var(--font-xs);font-weight:600}
.severity-dot-inline{width:6px;height:6px;border-radius:50%;display:inline-block}
.file-link{color:#a5b4fc;cursor:pointer;font-family:monospace;font-size:var(--font-xs)}
.file-link:hover{text-decoration:underline}
.empty{text-align:center;padding:var(--spacing-xl);color:var(--neutral-500)}
.empty-icon{font-size:2rem;margin-bottom:var(--spacing-sm)}

/* Responsive */
@media(max-width:768px){
  .app{padding:var(--spacing-md)}
  .header{flex-direction:column;text-align:center}
  .status{align-items:center;margin-top:var(--spacing-md)}
  .charts{grid-template-columns:1fr}
  .severities{flex-wrap:wrap}
}

/* Animations */
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:fadeIn .4s ease-out both}
.anim-d1{animation-delay:.1s}
.anim-d2{animation-delay:.2s}
.anim-d3{animation-delay:.3s}
.anim-d4{animation-delay:.4s}
</style>
</head>
<body>
<div class="app">
  <div class="header anim">
    <div class="brand">
      <div class="brand-icon">SB</div>
      <div>
        <div class="brand-title">SimpleBeacon</div>
        <div class="brand-sub">AI Slop Cop &mdash; v${this.version}</div>
        ${projectPath ? `<div class="brand-path" title="${escapeHtml(projectPath)}">${escapeHtml(projectPath)}</div>` : ''}
      </div>
    </div>
    <div class="status">
      <div class="connection ${connectionStatus}"><span style="font-size:8px">●</span> ${connectionLabel}</div>
      <div class="status-badge ${pass ? '' : 'fail'}">Gate ${pass}</div>
      <div class="score-ring">
        <svg width="88" height="88" viewBox="0 0 88 88"><circle class="score-ring-bg" cx="44" cy="44" r="34"/><circle class="score-ring-fill" cx="44" cy="44" r="34"/></svg>
        <div class="score-text">${score}</div>
      </div>
    </div>
  </div>

  <div class="actions anim anim-d1">
    <button class="btn btn-primary" data-command="scanWorkspace">🔍 Scan Workspace</button>
    <button class="btn btn-secondary" data-command="exportReport">📄 Export</button>
    <button class="btn btn-secondary" data-command="exportAIReport">🤖 Export for AI</button>
    <button class="btn btn-secondary" data-command="generateCertificate">✅ Certificate</button>
    <button class="btn btn-secondary" data-command="showRemediationGuide">🛠️ Fix Guide</button>
    <button class="btn btn-secondary" data-command="startRealtimeMonitoring">🟢 Real-time</button>
    <button class="btn btn-secondary" data-command="openInBrowser">🌐 Browser</button>
    <button class="btn btn-secondary" data-command="openCodeMap">🗺️ Code Map</button>
  </div>

  <div class="stats anim anim-d2">
    <div class="stat-card"><div class="stat-icon files">📁</div><div class="stat-info"><div class="stat-value">${files}</div><div class="stat-label">Files Scanned</div></div></div>
    <div class="stat-card"><div class="stat-icon folders">📂</div><div class="stat-info"><div class="stat-value">${folders}</div><div class="stat-label">Folders</div></div></div>
    <div class="stat-card"><div class="stat-icon findings">🔍</div><div class="stat-info"><div class="stat-value">${totalFindings}</div><div class="stat-label">Total Findings</div></div></div>
    <div class="stat-card"><div class="stat-icon categories">📊</div><div class="stat-info"><div class="stat-value">${categories.length}</div><div class="stat-label">Categories</div></div></div>
  </div>

  <div class="severities anim anim-d2">
    <div class="sev-pill critical"><div class="sev-dot critical"></div><div><div class="sev-count">${sevCounts.critical}</div><div class="sev-label">Critical</div></div></div>
    <div class="sev-pill high"><div class="sev-dot high"></div><div><div class="sev-count">${sevCounts.high}</div><div class="sev-label">High</div></div></div>
    <div class="sev-pill medium"><div class="sev-dot medium"></div><div><div class="sev-count">${sevCounts.medium}</div><div class="sev-label">Medium</div></div></div>
    <div class="sev-pill low"><div class="sev-dot low"></div><div><div class="sev-count">${sevCounts.low}</div><div class="sev-label">Low</div></div></div>
  </div>

  <div class="charts anim anim-d3">
    <div class="chart-card">
      <div class="chart-title">Category Breakdown</div>
      ${this.buildEnhancedCategoryChart(categories)}
    </div>
    <div class="chart-card">
      <div class="chart-title">Severity Distribution</div>
      ${this.buildEnhancedSeverityChart(allFindings)}
    </div>
  </div>

  ${this.hasEnhancedAnalysis ? `
  <div class="section anim anim-d4">
    <div class="section-header"><div class="section-title">Findings Details</div><input type="text" class="search" placeholder="Search findings..." id="searchInput"></div>
    <div class="filter-row">
      <span class="chip active" data-severity="all">All</span>
      <span class="chip" data-severity="critical">Critical</span>
      <span class="chip" data-severity="high">High</span>
      <span class="chip" data-severity="medium">Medium</span>
      <span class="chip" data-severity="low">Low</span>
    </div>
    <div id="findingsWrap">
      <table class="table"><thead><tr><th>Category</th><th>Severity</th><th>Finding</th><th>Location</th><th>Fix</th></tr></thead><tbody id="findingsBody"></tbody></table>
      <div id="emptyState" class="empty" style="display:none"><div class="empty-icon">📭</div><div>No findings match your filters</div></div>
    </div>
  </div>

  <div class="section anim anim-d4">
    <div class="section-header"><div class="section-title">Files with Most Issues</div></div>
    <table class="table"><thead><tr><th>File</th><th>Issues</th><th>Breakdown</th><th>Action</th></tr></thead><tbody>${failingFilesHtml}</tbody></table>
  </div>
  ` : `
  <div class="section anim anim-d4" style="text-align:center;padding:48px">
    <div style="font-size:3rem;margin-bottom:16px">🤖</div>
    <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Enhanced Analysis Required</div>
    <div style="color:var(--neutral-500);margin-bottom:24px">Run Enhanced Analysis to view detailed findings.</div>
    <button class="btn btn-primary" data-command="enhancedAnalysis">⚡ Run Enhanced Analysis</button>
  </div>
  `}
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
window.vscode=vscode;
const data=${findingsJson};
const searchInput=document.getElementById('searchInput');
const severityChips=document.querySelectorAll('.chip');
const findingsBody=document.getElementById('findingsBody');
const emptyState=document.getElementById('emptyState');
const hasFindingsUI = !!searchInput;

const findingsData = data;

function getCategoryColor(category){
  const map={
    'Blocking':'#ef4444','Secrets':'#ef4444','AI Indicators':'#f59e0b','EU AI Act':'#f59e0b',
    'Vulnerabilities':'#ef4444','Debug Markers':'#6366f1',
    'AI Residue':'#f59e0b','Performance':'#f59e0b','Type Safety':'#6366f1','Test Coverage':'#10b981',
    'Accessibility':'#8b5cf6','i18n':'#8b5cf6','Sensitive Data':'#ef4444','Config Drift':'#f59e0b',
    'Security Headers':'#ef4444','Database Patterns':'#ef4444','Framework Practices':'#f59e0b',
    'Workspace Health':'#6366f1','Unused Deps':'#10b981','API Contract':'#6366f1','Complexity':'#f59e0b',
    'LLM Slop':'#8b5cf6','Token Bleed':'#8b5cf6','Production Leak':'#ef4444','Fiction KPI':'#f59e0b',
    'Security':'#ef4444','Quality':'#f59e0b','Maintainability':'#6366f1'
  };
  return map[category]||'#6366f1';
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
    badge.className = 'badge';
    badge.style.background = catColor + '12';
    badge.style.color = catColor;
    badge.style.border = '1px solid ' + catColor + '25';
    badge.textContent = f.cat;
    td1.appendChild(badge); tr.appendChild(td1);
    const td2 = document.createElement('td');
    const dot = document.createElement('span');
    dot.className = 'severity-dot-inline';
    dot.style.background = f.sev==='high' ? '#ef4444' : f.sev==='medium' ? '#f59e0b' : '#3b82f6';
    td2.appendChild(dot);
    td2.appendChild(document.createTextNode(' ' + f.sev.toUpperCase()));
    tr.appendChild(td2);
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
  if (!searchInput) return;
  const query=searchInput.value.toLowerCase();
  const activeChip=document.querySelector('.chip.active');
  const severity=activeChip?.dataset.severity||'all';
  const filtered=data.filter(f=>{
    const matchesSearch=!query||f.desc.toLowerCase().includes(query)||f.cat.toLowerCase().includes(query)||f.file.toLowerCase().includes(query);
    const matchesSeverity=severity==='all'||f.sev===severity;
    return matchesSearch&&matchesSeverity;
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
  filterFindings();
}

// Add click handlers for action buttons
document.querySelectorAll('.btn').forEach(button => {
  button.addEventListener('click', (e) => {
    const command = button.getAttribute('data-command');
    if (!command) { return; }
    if (command === 'openFile') {
      const file = button.getAttribute('data-file');
      const line = parseInt(button.getAttribute('data-line') || '1', 10);
      if (file) { vscode.postMessage({ command: 'openFile', file, line }); }
    } else {
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

  private getSeverityCounts(findings: any[]): { critical: number; high: number; medium: number; low: number } {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) { const s = (f.sev || f.severity || 'low').toLowerCase(); if (s === 'critical') counts.critical++; else if (s === 'high') counts.high++; else if (s === 'medium') counts.medium++; else counts.low++; }
    return counts;
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
            <button class="btn btn-secondary" data-command="openFile" data-file="${file.file}" data-line="1" style="padding: 4px 8px; font-size: 12px;">
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
            ? '#ef4444'
            : cat.severity === 'warn'
              ? '#f59e0b'
              : '#6366f1';

        return `
        <div class="bar-row">
          <div class="bar-label"><span>${cat.label}</span><span>${cat.count || 0}</span></div>
          <div class="bar-track"><div class="bar-fill" style="background:${color};width:0%" data-target="${percentage}"></div></div>
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
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#f59e0b',
      low: '#3b82f6',
    };

    return Object.entries(severityCounts)
      .map(([severity, count]) => {
        const countNum = Number(count) || 0;
        const percentage = total > 0 ? (countNum / total) * 100 : 0;
        const color = colors[severity] || '#94a3b8';

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
                <div class="line original"><pre>${escapeHtml(originalLine)}</pre></div>
              </div>
              <div class="col">
                <div class="title">Patched</div>
                <div class="line patched"><pre>${escapeHtml(patchedLine)}</pre></div>
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
