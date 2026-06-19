import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { spawn } from 'child_process';
import { ScanPhaseProvider, TaskNode } from './scanProvider';
import { EnhancedScanProvider } from './enhancedScanProvider';
import { VisualSidebarProvider } from './visualSidebarProvider';
import { ModernSidebarProvider } from './modernSidebarProvider';
import { SummaryProvider } from './summaryProvider';
import { RoadmapProvider } from './roadmapProvider';
import { ReportWebview } from './webviewPanel';
import { EnhancedDashboard } from './enhancedDashboard';
import { Web2Panel } from './web2Panel';
import { SettingsProvider } from './settingsProvider';
import { EnhancedAIProvider } from './enhancedAIProvider';
import { CodeMapProvider } from './codeMapProvider';
import { RealtimeMonitor } from './realtimeMonitor';
import { Dashboard20 } from './dashboard2_0';
import { AICodeAnalyzer } from './aiIntegration/aiCodeAnalyzer';
import { exportAIReport, AIReportOptions } from './aiIntegration/aiReportExporter';
import { AdvancedAnalytics } from './analytics/advancedAnalytics';
import { TeamDashboard } from './collaboration/teamDashboard';
import { ScanResult, exportScanResultToJson } from './analyzers/workspaceAnalyzer';
import { RemediationProvider } from './fixes/remediationProvider';
import { getExtensionVersion, checkCliAvailable, pickWorkspaceFolder } from './utils';
import { AuthManager } from './auth/authManager';
// aiPlatform modules not available in this extension version

interface DetectedIssue {
  severity?: string;
  type?: string;
  description?: string;
  message?: string;
}

interface CertificateData {
  type: string;
  version: string;
  generatedAt: string;
  projectPath: string;
  qualityScore: number | null | undefined;
  gatePass: boolean;
  summary: {
    filesAnalyzed: number;
    blockingIssues: number;
    secrets: number;
    vulnerabilities: number;
  };
}

interface CertificateSource {
  summary?: { severityCounts?: Record<string, number>; totalFindings?: number; filesAnalyzed?: number };
  findings?: unknown[];
  gate?: { pass?: boolean; blockingIssues?: unknown[] };
  qualityScore?: number | null;
  totalFiles?: number;
  filesAnalyzed?: number;
  credentialHygiene?: { secrets?: unknown[] };
  dependencyAudit?: { vulnerabilities?: unknown[] };
  categories?: Record<string, unknown[]>;
}

interface SidebarReport {
  severityCounts?: Record<string, number>;
  gate?: { pass?: boolean };
  qualityScore?: number | null;
  issueCount?: number;
  ruleScopedFilesAnalyzed?: number;
  filesAnalyzed?: number;
  totalFiles?: number;
  projectRoot?: string;
  projectPath?: string;
  detectedIssues?: DetectedIssue[];
}

// currentReport stores either CLI report (raw JSON) or ScanResult — both consumed loosely
function validateReport(report: unknown): string[] {
  const r = report as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof r !== 'object' || r === null) {
    errors.push('Report is not an object');
    return errors;
  }
  if (!r.totalFiles && !r.filesAnalyzed) {
    errors.push('Missing totalFiles/filesAnalyzed');
  }
  if (!r.severityCounts && !r.issueCount) {
    errors.push('Missing severityCounts/issueCount');
  }
  if (!r.gate && !r.rawIssues) {
    errors.push('Missing gate/rawIssues');
  }
  return errors;
}

let outputChannel: vscode.OutputChannel;
let scanProvider: ScanPhaseProvider;
let enhancedScanProvider: EnhancedScanProvider;
let visualSidebarProvider: VisualSidebarProvider;
let modernSidebarProvider: ModernSidebarProvider;
let summaryProvider: SummaryProvider;
let settingsProvider: SettingsProvider;
let enhancedAIProvider: EnhancedAIProvider;
let realtimeMonitor: RealtimeMonitor;
let aiCodeAnalyzer: AICodeAnalyzer;
let advancedAnalytics: AdvancedAnalytics;
let teamDashboard: TeamDashboard;
let currentReport: unknown = null;
let hasEnhancedAnalysis = false;
let statusBarItem: vscode.StatusBarItem;
let authManager: AuthManager;

// aiPlatform globals removed — not available in this extension version

function getConfiguredApiUrl(): string {
  const config = vscode.workspace.getConfiguration('simplebeacon');
  const raw = config.get<string>('apiServerUrl') || config.get<string>('apiUrl', 'http://127.0.0.1:3000');
  const url = (raw || 'http://127.0.0.1:3000').replace(/\/$/, '');
  try {
    new URL(url);
    return url;
  } catch {
    return 'http://127.0.0.1:3000';
  }
}

async function checkServerReachable(url: string, timeout = 3000): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? require('https') : require('http');
    return new Promise((resolve) => {
      const req = client.request(
        { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: '/', method: 'HEAD' },
        (res: http.IncomingMessage) => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        }
      );
      req.on('error', () => resolve(false));
      req.setTimeout(timeout, () => { req.destroy(); resolve(false); });
      req.end();
    });
  } catch {
    return false;
  }
}

function updateStatusBar(report?: unknown) {
  if (!statusBarItem) return;
  if (!report) {
    statusBarItem.text = '$(shield) SimpleBeacon';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = 'No scan results — Click to scan workspace';
    return;
  }
  const r = report as Record<string, unknown>;
  const gate = r.gate as { pass?: boolean } | undefined;
  if (gate) {
    const pass = gate.pass;
    statusBarItem.text = `$(shield) SimpleBeacon: ${pass ? 'PASS' : 'FAIL'}`;
    statusBarItem.backgroundColor = pass
      ? new vscode.ThemeColor('statusBarItem.prominentBackground')
      : new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.tooltip = `Quality score: ${(r.qualityScore as number | null | undefined) ?? '?'}/100 — Click to open dashboard`;
  } else {
    statusBarItem.text = '$(shield) SimpleBeacon';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = 'No scan results — Click to scan workspace';
  }
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('SimpleBeacon');
  context.subscriptions.push(outputChannel);

  authManager = new AuthManager(context);

  scanProvider = new ScanPhaseProvider();
  enhancedScanProvider = new EnhancedScanProvider();
  visualSidebarProvider = new VisualSidebarProvider();
  modernSidebarProvider = new ModernSidebarProvider(context.extensionUri);
  summaryProvider = new SummaryProvider();
  const roadmapProvider = new RoadmapProvider();
  settingsProvider = new SettingsProvider(getExtensionVersion(context));
  enhancedAIProvider = new EnhancedAIProvider();
  enhancedAIProvider.setSidebarProvider(modernSidebarProvider);
  enhancedAIProvider.setOnScanComplete((result) => {
    currentReport = enhancedAIProvider.getScanResult();
    updateStatusBar(currentReport);
    if (currentReport) {
      roadmapProvider.updateFromReport(currentReport as ScanResult);
    }
  });
  realtimeMonitor = RealtimeMonitor.getInstance();

  // Auto-start real-time AI slop monitoring if enabled
  const autoMonitor = vscode.workspace.getConfiguration('simplebeacon').get('autoMonitorAI');
  if (autoMonitor) {
    realtimeMonitor.start();
  }

  // Initialize Phase 2 components
  aiCodeAnalyzer = AICodeAnalyzer.getInstance();
  advancedAnalytics = AdvancedAnalytics.getInstance();
  teamDashboard = TeamDashboard.getInstance();

  // aiPlatform components not initialized in this extension version

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('simplebeacon-summary', summaryProvider),
    vscode.window.registerTreeDataProvider('simplebeacon-roadmap', roadmapProvider)
  );

  // Register GUI sidebar webview provider
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('simplebeacon-modern', modernSidebarProvider));

  context.subscriptions.push(
    { dispose: () => enhancedAIProvider.dispose() },
    { dispose: () => realtimeMonitor.dispose() },
    { dispose: () => aiCodeAnalyzer.dispose() },
    { dispose: () => advancedAnalytics.dispose() },
    { dispose: () => teamDashboard.dispose() }
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'simplebeacon.showReport';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  const commands = [
    vscode.commands.registerCommand('simplebeacon.scanWorkspace', () => runScan(context)),
    vscode.commands.registerCommand('simplebeacon.clearResults', clearResults),
    vscode.commands.registerCommand('simplebeacon.openSettings', () => {
      Web2Panel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand('simplebeacon.showReport', async () => {
      const apiUrl = getConfiguredApiUrl();
      const reportUrl = apiUrl + '/scan-status.html';
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', reportUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.generateCertificate', () => {
      generateCertificate(enhancedAIProvider.getScanResult());
    }),
    vscode.commands.registerCommand('simplebeacon.exportReport', exportReport),
    vscode.commands.registerCommand('simplebeacon.exportReportJson', exportReportJson),
    vscode.commands.registerCommand('simplebeacon.exportAIReport', () => exportAIReportCommand(context)),
    vscode.commands.registerCommand('simplebeacon.enhancedAnalysis', async () => {
      await enhancedAIProvider.startEnhancedAnalysis();
      // Sync the enhanced analysis result to currentReport and unlock dashboard
      const result = enhancedAIProvider.getScanResult();
      if (result) {
        currentReport = enhancedAIProvider.convertScanResultToReport(result);
      }
      hasEnhancedAnalysis = true;
      if (currentReport) {
        EnhancedDashboard.createOrShow(context.extensionUri, currentReport, undefined, true);
        Dashboard20.updateIfOpen(currentReport as import('./dashboard2_0').Dashboard20Report);
      }
    }),
    vscode.commands.registerCommand('simplebeacon.realtimeAnalysis', () => {
      enhancedAIProvider.startRealtimeAnalysis();
    }),
    vscode.commands.registerCommand('simplebeacon.patternDetection', () => {
      enhancedAIProvider.detectPatterns();
    }),
    vscode.commands.registerCommand('simplebeacon.modelHealth', () => {
      enhancedAIProvider.checkModelHealth();
    }),
    vscode.commands.registerCommand('simplebeacon.showCodeMap', () => {
      const report = currentReport || enhancedAIProvider.getScanResult();
      if (!report) {
        vscode.window.showInformationMessage('Run a scan first to generate code map');
        return;
      }
      const r = report as any;
      if (!r.projectRoot && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        r.projectRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }
      CodeMapProvider.getInstance().showCodeMap(r, context);
    }),
    vscode.commands.registerCommand('simplebeacon.showRemediationGuide', () => {
      const report = currentReport || enhancedAIProvider.getScanResult();
      if (!report) {
        vscode.window.showInformationMessage('Run a scan first to view the fix guide');
        return;
      }
      RemediationProvider.showRemediationGuide(report);
    }),
    vscode.commands.registerCommand('simplebeacon.openEnhancedDashboard20', async () => {
      if (!currentReport) {
        vscode.window.showInformationMessage('Run a scan first to open Dashboard 2.0');
        return;
      }
      Dashboard20.createOrShow(context.extensionUri, currentReport as import('./dashboard2_0').Dashboard20Report);
    }),
    vscode.commands.registerCommand('simplebeacon.runAdvancedAnalytics', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }
      try {
        const analytics = await advancedAnalytics.analyzeCodebase(workspaceFolder);
        vscode.window.showInformationMessage(
          `Analytics complete: Quality ${analytics.metrics.codeQuality.toFixed(1)}/100`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Analytics failed: ${error}`);
      }
    }),
    vscode.commands.registerCommand('simplebeacon.showTeamDashboard', async () => {
      const apiUrl = getConfiguredApiUrl();
      const teamUrl = apiUrl + '/cloud-teams.html';
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', teamUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.setApiToken', async () => {
      await authManager.promptForToken();
    }),
    vscode.commands.registerCommand('simplebeacon.clearApiToken', async () => {
      await authManager.clearToken();
      vscode.window.showInformationMessage('SimpleBeacon API token cleared');
    }),
    vscode.commands.registerCommand('simplebeacon.setServerUrl', async () => {
      await authManager.promptForServerUrl();
    }),
    vscode.commands.registerCommand('simplebeacon.toggleRealtimeMonitoring', () => {
      if (realtimeMonitor['isMonitoring']) {
        realtimeMonitor.stop();
        vscode.window.showInformationMessage('Real-time AI slop monitoring stopped');
      } else {
        realtimeMonitor.start();
      }
    }),
    vscode.commands.registerCommand('simplebeacon.openBrowser', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Enter URL to open',
        placeHolder: 'https://simplebeacon.ai',
        value: 'https://simplebeacon.ai',
      });
      if (url) {
        await vscode.commands.executeCommand('simpleBrowser.show', url);
      }
    }),
    vscode.commands.registerCommand('simplebeacon.openInBrowser', async (path?: string) => {
      const apiUrl = getConfiguredApiUrl();
      const fullUrl = apiUrl + (path || '/');
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', fullUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openInPreview', async (path?: string) => {
      const apiUrl = getConfiguredApiUrl();
      const fullUrl = apiUrl + (path || '/');
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await openPreviewPanel(fullUrl, 'SimpleBeacon Preview');
    }),
    vscode.commands.registerCommand('simplebeacon.openWebsite', async () => {
      const apiUrl = getConfiguredApiUrl();
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', apiUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openWebsitePreview', async () => {
      const apiUrl = getConfiguredApiUrl();
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await openPreviewPanel(apiUrl, 'SimpleBeacon Website');
    }),
    // aiPlatform commands
    vscode.commands.registerCommand('simplebeacon.scanFolder', (uri: vscode.Uri) => {
      const targetPath = uri ? uri.fsPath : undefined;
      if (!targetPath) {
        vscode.window.showWarningMessage('No folder selected.');
        return;
      }
      vscode.window.showInformationMessage('Scan folder from sidebar not available in this version.');
    }),
    vscode.commands.registerCommand('simplebeacon.uploadReport', async () => {
      const apiUrl = getConfiguredApiUrl();
      const uploadUrl = apiUrl + '/upload.html';
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', uploadUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.refreshResults', async () => {
      loadExistingReport(context);
      vscode.window.showInformationMessage('Results refreshed');
    }),
    vscode.commands.registerCommand('simplebeacon.openIssue', (issue: { filePath?: string; line?: number; column?: number; message?: string }) => {
      if (issue && issue.filePath && issue.line) {
        const docUri = vscode.Uri.file(issue.filePath);
        Promise.resolve(vscode.workspace.openTextDocument(docUri))
          .then((doc) => Promise.resolve(vscode.window.showTextDocument(doc)))
          .then((editor) => {
            const position = new vscode.Position(issue.line! - 1, issue.column || 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
          })
          .catch((err: Error) => {
            vscode.window.showErrorMessage('Failed to open file: ' + (err instanceof Error ? err.message : String(err)));
          });
      }
    }),
    vscode.commands.registerCommand('simplebeacon.openAnalyze', async () => {
      const apiUrl = getConfiguredApiUrl();
      const analyzeUrl = apiUrl + '/scan.html';
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', analyzeUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openUpload', async () => {
      const apiUrl = getConfiguredApiUrl();
      const uploadUrl = apiUrl + '/upload.html';
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', uploadUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openPreview', async (url?: string, title?: string) => {
      const targetUrl = url || getConfiguredApiUrl();
      if (!(await checkServerReachable(targetUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + targetUrl + '. Start the server or update the URL in settings.');
        return;
      }
      await openPreviewPanel(targetUrl, title || 'SimpleBeacon Preview');
    }),
    vscode.commands.registerCommand('simplebeacon.openAiContext', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }
      const contextPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.simplebeacon', 'ai-context.md');
      try {
        await vscode.workspace.fs.stat(contextPath);
        await vscode.commands.executeCommand('vscode.open', contextPath);
      } catch {
        vscode.window.showInformationMessage('No AI context file yet. Send data from the upload page first.');
      }
    }),
    vscode.commands.registerCommand('simplebeacon.sendToAi', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }
      const apiUrl = getConfiguredApiUrl();
      const projectPath = workspaceFolders[0].uri.fsPath;
      if (!(await checkServerReachable(apiUrl))) {
        vscode.window.showWarningMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
        return;
      }
      try {
        const url = `${apiUrl}/api/ai-context?projectPath=${encodeURIComponent(projectPath)}`;
        const httpMod = require('http');
        const parsed = new URL(url);
        const result: { content?: string; path?: string } = await new Promise((resolve, reject) => {
          const req = httpMod.request(
            { hostname: parsed.hostname, port: parsed.port || 80, path: parsed.pathname + parsed.search, method: 'GET' },
            (res: NodeJS.ReadableStream) => {
              let body = '';
              res.on('data', (chunk: Buffer | string) => {
                body += chunk.toString();
              });
              res.on('end', () => {
                try {
                  resolve(JSON.parse(body));
                } catch {
                  resolve({});
                }
              });
            }
          );
          req.on('error', reject);
          req.end();
        });
        if (result.content) {
          await vscode.env.clipboard.writeText(result.content);
          vscode.window.showInformationMessage(
            'Scan data copied to clipboard — paste into your AI coding agent with Ctrl+V'
          );
        } else {
          vscode.window.showWarningMessage(
            'No AI context found. Run a scan and click "Send to AI" on the dashboard first.'
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          'Failed to fetch AI context: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    }),
    vscode.commands.registerCommand('simplebeacon.sendSidebarToAi', async (report?: unknown) => {
      const data = (report || currentReport) as SidebarReport | null;
      if (!data) {
        vscode.window.showWarningMessage('No scan data available. Run a scan first.');
        return;
      }
      const sev = data.severityCounts || {};
      const gate = data.gate || {};
      const summary = [
        '## SimpleBeacon Scan Summary',
        '',
        `**Quality Score:** ${data.qualityScore !== null && data.qualityScore !== undefined ? data.qualityScore + '/100' : 'N/A'}`,
        `**Gate Status:** ${gate.pass ? '✅ PASS' : '❌ FAIL'}`,
        `**Total Issues:** ${data.issueCount || 0}`,
        '',
        '**Severity Breakdown:**',
        `- Critical: ${sev.critical || 0}`,
        `- High: ${sev.high || 0}`,
        `- Medium: ${sev.medium || 0}`,
        `- Low: ${sev.low || 0}`,
        '',
        `**Files Analyzed:** ${data.ruleScopedFilesAnalyzed || data.filesAnalyzed || 0} / ${data.totalFiles || 0}`,
        `**Project:** ${data.projectRoot || data.projectPath || 'N/A'}`,
        '',
        data.detectedIssues && data.detectedIssues.length > 0
          ? '**Top Findings:**\n' +
            data.detectedIssues
              .slice(0, 10)
              .map((i: DetectedIssue) => `- [${i.severity}] ${i.type}: ${i.description || i.message || ''}`.slice(0, 200))
              .join('\n')
          : '',
        '',
        '_Paste this into your AI coding agent for remediation guidance._',
      ].join('\n');
      await vscode.env.clipboard.writeText(summary);
      vscode.window.showInformationMessage('Scan summary copied to clipboard — paste into your AI chatbot');
    }),
    // refreshDashboard command removed — not available in this extension version
  ];

  context.subscriptions.push(...commands);

  const autoScan = vscode.workspace.getConfiguration('simplebeacon').get('autoScanOnOpen');
  if (autoScan) {
    runScan(context);
  }

  loadExistingReport(context);

  // aiPlatform: watch for new AI context files and auto-open them
  const workspaceFoldersAP = vscode.workspace.workspaceFolders;
  if (workspaceFoldersAP && workspaceFoldersAP.length > 0) {
    const contextPattern = new vscode.RelativePattern(workspaceFoldersAP[0], '.simplebeacon/ai-context.md');
    const contextWatcher = vscode.workspace.createFileSystemWatcher(contextPattern);
    contextWatcher.onDidCreate(async (uri) => {
      await vscode.commands.executeCommand('vscode.open', uri);
      vscode.window.showInformationMessage(
        'SimpleBeacon: New AI context available. The AI agent can now see your scan data.'
      );
    });
    contextWatcher.onDidChange(async (uri) => {
      await vscode.commands.executeCommand('vscode.open', uri);
      vscode.window.showInformationMessage('SimpleBeacon: AI context updated with new scan data.');
    });
    context.subscriptions.push(contextWatcher);
  }

  // aiPlatform: Register URI handler for website → VS Code deep links
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        if (uri.path === '/fix' || uri.path === 'fix') {
          const params = new URLSearchParams(uri.query);
          const projectPath = params.get('projectPath') || '';
          if (projectPath) {
            Promise.resolve(vscode.window
              .showInformationMessage(`SimpleBeacon: Received scan from website. Open fix panel?`, 'Open', 'Dismiss'))
              .then((choice) => {
                if (choice === 'Open') {
                  vscode.window.showInformationMessage('Open fix panel not available in this version.');
                }
              })
              .catch(() => {});
          }
        }
      },
    })
  );
}

export function deactivate() {
  outputChannel?.dispose();
  // diagnosticsManager?.dispose(); // not available in this extension version
}

async function runScan(context: vscode.ExtensionContext) {
  const finalizeReport = (report: any, resolve: (value: any) => void, reject: (reason?: any) => void) => {
    try {
      const validationErrors = validateReport(report);
      if (validationErrors.length > 0) {
        outputChannel.appendLine(`[SimpleBeacon] Report validation warnings: ${validationErrors.join(', ')}`);
      }
      currentReport = report;
      hasEnhancedAnalysis = false;
      enhancedAIProvider.setScanResult(report);
      scanProvider.updateReport(report);
      enhancedScanProvider.updateReport(report);
      visualSidebarProvider.updateReport(report);
      summaryProvider.updateReport(report);
      settingsProvider.updateReport(report);
      modernSidebarProvider.updateReport(report);
      modernSidebarProvider.updateStatus('completed', 'Scan complete — awaiting analysis');
      vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
      updateStatusBar(report);
      EnhancedDashboard.createOrShow(context.extensionUri, report, undefined, false);
      const score = report.qualityScore ?? '[HIDDEN]';
      const gateStatus = report.gate?.pass ? 'PASS' : 'FAIL';
      const message = `SimpleBeacon scan complete — Score: ${score}/100 — Gate: ${gateStatus}. Run Enhanced Analysis to view findings.`;
      Promise.resolve(vscode.window.showInformationMessage(message, 'Run Enhanced Analysis')).then((selection) => {
        if (selection === 'Run Enhanced Analysis') {
          vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
        }
      }).catch(() => {});
      outputChannel.appendLine(`[SimpleBeacon] Scan complete. Score: ${score}/100 — Gate: ${gateStatus}`);
      resolve(report);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      outputChannel.appendLine(`[SimpleBeacon] Failed to process report: ${e.message}`);
      reject(err);
    }
  };

  const cliOk = await checkCliAvailable();
  if (!cliOk) {
    const install = await vscode.window.showWarningMessage(
      'SimpleBeacon CLI not found. Install it with: npm install -g simplebeacon-cli',
      'Copy Command',
      'Dismiss'
    );
    if (install === 'Copy Command') {
      await vscode.env.clipboard.writeText('npm install -g simplebeacon-cli');
      vscode.window.showInformationMessage('Install command copied to clipboard');
    }
    return;
  }

  const projectPath = await pickWorkspaceFolder();
  if (!projectPath) return;
  const config = vscode.workspace.getConfiguration('simplebeacon');
  const maxFiles = config.get<number>('maxFiles', 5000);
  const userExcludePatterns = config.get<string[]>('excludePatterns', []);
  // Combine default build artifact exclusions with user patterns
  const defaultExclusions = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'out',
    'coverage',
    'frontend-build',
    'vendor',
    '.vscode-test',
    '.simplebeacon',
  ];
  const excludePatterns = [...new Set([...defaultExclusions, ...userExcludePatterns])];

  outputChannel.show();
  outputChannel.appendLine(`[SimpleBeacon] Starting scan: ${projectPath}`);
  outputChannel.appendLine(`[SimpleBeacon] Exclusions: ${excludePatterns.join(', ')}`);

  // Update enhanced sidebar with scanning status
  enhancedScanProvider.setScanning(true, { phase: 'Initializing', progress: 0, total: 100 });
  visualSidebarProvider.setScanning(true, { phase: 'Initializing', progress: 0, total: 100 });
  modernSidebarProvider.updateStatus('scanning', 'Scanning...');

  const args = ['scan', '--full', '--gate', '--format', 'json', '--config', '.simplebeacon/config.json'];

  if (excludePatterns.length > 0) {
    args.push('--exclude', excludePatterns.join(','));
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'SimpleBeacon Scan',
      cancellable: true,
    },
    (progress, token) => {
      return new Promise((resolve, reject) => {
        // Windows needs npx.cmd; Unix uses npx
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'npx.cmd' : 'npx';
        const child = spawn(cmd, ['simplebeacon', ...args], {
          cwd: projectPath,
          shell: isWin,
          env: { ...process.env, FORCE_COLOR: '0' },
        });

        let stdout = '';
        let stderr = '';

        token.onCancellationRequested(() => {
          child.kill();
          outputChannel.appendLine('[SimpleBeacon] Scan cancelled');
          enhancedScanProvider.setScanning(false);
          visualSidebarProvider.setScanning(false);
          modernSidebarProvider.updateStatus('idle', 'Scan cancelled');
          reject(new Error('Cancelled'));
        });

        child.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          chunk.split('\n').forEach((line: string) => {
            if (line.trim()) {
              outputChannel.appendLine(line.trim());
              const match = line.match(/(\d+)%/);
              if (match) {
                const percentage = parseInt(match[1]);
                progress.report({ increment: percentage / 100 });

                // Update enhanced sidebar with progress
                enhancedScanProvider.setScanning(true, {
                  phase: 'Scanning',
                  progress: percentage,
                  total: 100,
                });
                visualSidebarProvider.setScanning(true, {
                  phase: 'Scanning',
                  progress: percentage,
                  total: 100,
                });
                modernSidebarProvider.updateStatus('scanning', 'Scanning... ' + percentage + '%');
              }
            }
          });
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
          outputChannel.appendLine(`[stderr] ${data.toString().trim()}`);
        });

        child.on('close', (code: number | null) => {
          // Gate failure (exit 1) is expected when blocking issues are found
          // Only treat as error if we can't parse the report
          if (code !== 0 && code !== null && stdout.trim() === '') {
            outputChannel.appendLine(`[SimpleBeacon] Scan process exited ${code}. stderr: ${stderr.slice(0, 200)}`);
            // Try to load existing report as fallback
            const fallbackPath = path.join(projectPath, '.simplebeacon', 'report.json');
            if (fs.existsSync(fallbackPath)) {
              outputChannel.appendLine(`[SimpleBeacon] Loading existing report from ${fallbackPath}`);
              try {
                const fallbackReport = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
                vscode.window.showWarningMessage('Scan process failed — loaded most recent report instead.');
                finalizeReport(fallbackReport, resolve, reject);
                return;
              } catch (e) {
                outputChannel.appendLine(`[SimpleBeacon] Failed to load fallback report: ${(e as Error).message}`);
              }
            }
            vscode.window.showErrorMessage(`Scan failed (exit ${code}). Check output channel.`);
            reject(new Error(`Exit code ${code}`));
            return;
          }

          try {
            let report;
            // Try whole stdout as JSON first (clean CLI output)
            const trimmed = stdout.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try { report = JSON.parse(trimmed); } catch { /* fall through */ }
            }
            // If that fails, look for the simplebeacon report object specifically
            if (!report && stdout.includes('"type":"simplebeacon-report"')) {
              const reportMatch = stdout.match(/\{"type":"simplebeacon-report"[\s\S]*?\}(?=\s*$|\s*\n)/);
              if (reportMatch) {
                try { report = JSON.parse(reportMatch[0]); } catch { /* fall through */ }
              }
            }
            if (!report) {
              const gateMatch = stdout.match(/Gate:\s*(FAIL|PASS)/);
              const scoreMatch = stdout.match(/Quality score:\s*(\d+|\[HIDDEN[^\]]*\])/);
              const criticalMatch = stdout.match(/Critical:\s*(\d+)/);
              const highMatch = stdout.match(/High:\s*(\d+)/);
              const mediumMatch = stdout.match(/Medium:\s*(\d+)/);
              const lowMatch = stdout.match(/Low:\s*(\d+)/);
              const gateFilesMatch = stdout.match(/Gate rules checked:\s*(\d+)/);
              const repoFilesMatch = stdout.match(/Repository files:\s*([\d,]+)/);
              const issuesSection = stdout.match(/Issues:\s*\n([\s\S]*?)(?=\n\n|\n\[|$)/);
              const rawIssues: any[] = [];
              if (issuesSection) {
                for (const line of issuesSection[1].trim().split('\n')) {
                  const match = line.match(/^\[(\w+)\]\s+(.+?):\s*(.+)$/);
                  if (match) {
                    const [, severity, type, description] = match;
                    const fileMatch = description.match(/^(.+?):(\d+)\s*[-\u2013\u2014]\s*(.+)$/);
                    rawIssues.push({ severity, type, description, file: fileMatch ? fileMatch[1] : '', line: fileMatch ? parseInt(fileMatch[2]) : 1 });
                  }
                }
              }
              report = {
                type: 'simplebeacon-report',
                reportVersion: 2,
                generatedAt: new Date().toISOString(),
                generatedBy: 'SimpleBeacon',
                projectRoot: projectPath,
                totalFiles: repoFilesMatch ? parseInt(repoFilesMatch[1].replace(/,/g, '')) : 0,
                filesAnalyzed: gateFilesMatch ? parseInt(gateFilesMatch[1]) : 0,
                ruleScopedFilesAnalyzed: gateFilesMatch ? parseInt(gateFilesMatch[1]) : 0,
                issueCount: (criticalMatch ? parseInt(criticalMatch[1]) : 0) + (highMatch ? parseInt(highMatch[1]) : 0) + (mediumMatch ? parseInt(mediumMatch[1]) : 0) + (lowMatch ? parseInt(lowMatch[1]) : 0),
                qualityScore: scoreMatch ? (scoreMatch[1].includes('HIDDEN') ? null : parseInt(scoreMatch[1])) : null,
                gate: { pass: gateMatch ? gateMatch[1] === 'PASS' : false, failOn: ['high'], warnOn: ['medium', 'low'], blockingCount: highMatch ? parseInt(highMatch[1]) : 0, warningCount: (mediumMatch ? parseInt(mediumMatch[1]) : 0) + (lowMatch ? parseInt(lowMatch[1]) : 0), blockingIssues: [], warningIssues: [] },
                severityCounts: { critical: criticalMatch ? parseInt(criticalMatch[1]) : 0, high: highMatch ? parseInt(highMatch[1]) : 0, medium: mediumMatch ? parseInt(mediumMatch[1]) : 0, low: lowMatch ? parseInt(lowMatch[1]) : 0 },
                detectedIssues: rawIssues,
                rawIssues: rawIssues,
              };
            }
            finalizeReport(report, resolve, reject);
          } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            outputChannel.appendLine(`[SimpleBeacon] Failed to parse report: ${e.message}`);
            outputChannel.appendLine(`[SimpleBeacon] Raw output: ${stdout.slice(0, 200)}...`);
            reject(err);
          }
        });

        child.on('error', (err: Error) => {
          vscode.window.showErrorMessage(`Failed to start scan: ${err.message}`);
          reject(err);
        });
      });
    }
  );
}

function clearResults() {
  currentReport = null;
  scanProvider.clear();
  enhancedScanProvider.clear();
  visualSidebarProvider.clear();
  summaryProvider.clear();
  settingsProvider.clear();
  modernSidebarProvider.updateReport(null);
  modernSidebarProvider.updateStatus('idle', 'Ready to scan');
  vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', false);
  updateStatusBar();
  // aiPlatform clear methods not available in this extension version
  vscode.window.showInformationMessage('SimpleBeacon results cleared');
}

function generateCertificate(report?: unknown) {
  const src = report || currentReport;
  if (!src) {
    vscode.window.showInformationMessage('Run a scan first to generate a certificate');
    return;
  }
  const source = src as CertificateSource;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const certDir = path.join(workspaceFolders[0].uri.fsPath, '.simplebeacon');
  const certPath = path.join(certDir, 'certificate.json');
  const certHtmlPath = path.join(certDir, 'certificate.html');

  // Support both CLI report shape and workspace analyzer ScanResult shape
  const isWorkspaceScan = !!source.summary && !!source.findings;
  const qualityScore = isWorkspaceScan ? computeWorkspaceScore(source) : source.qualityScore;
  const sev = source.summary?.severityCounts ?? {};
  const gatePass = isWorkspaceScan
    ? sev.critical === 0 && sev.high === 0
    : (source.gate?.pass ?? false);
  const certificate: CertificateData = {
    type: 'simplebeacon-certificate',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    projectPath: workspaceFolders[0].uri.fsPath,
    qualityScore,
    gatePass,
    summary: {
      filesAnalyzed: isWorkspaceScan ? (source.summary?.filesAnalyzed ?? 0) : (source.totalFiles ?? source.filesAnalyzed ?? 0),
      blockingIssues: isWorkspaceScan
        ? ((sev.critical ?? 0) + (sev.high ?? 0))
        : (source.gate?.blockingIssues ?? []).length,
      secrets: isWorkspaceScan
        ? (source.categories?.security ?? []).length
        : (source.credentialHygiene?.secrets ?? []).length,
      vulnerabilities: isWorkspaceScan
        ? (source.summary?.totalFindings ?? 0)
        : (source.dependencyAudit?.vulnerabilities ?? []).length,
    },
  };

  const html = buildCertificateHtml(certificate);

  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2));
  fs.writeFileSync(certHtmlPath, html);
  vscode.window.showInformationMessage(`Certificate saved to ${certPath}`);
  vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.file(certHtmlPath).toString());
}

function buildCertificateHtml(cert: CertificateData): string {
  const score = cert.qualityScore ?? 0;
  const scoreColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const passColor = cert.gatePass ? '#10B981' : '#EF4444';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Certificate</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;line-height:1.6}
.container{max-width:800px;margin:0 auto}
.header{text-align:center;margin-bottom:48px}
.badge{display:inline-flex;align-items:center;gap:12px;padding:16px 32px;border-radius:16px;background:linear-gradient(135deg,#1e293b,#334155);border:1px solid #475569;margin-bottom:24px}
.badge-icon{width:48px;height:48px;border-radius:50%;background:${passColor};display:flex;align-items:center;justify-content:center;font-size:24px}
.badge-text{text-align:left}
.badge-label{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8}
.badge-value{font-size:20px;font-weight:700;color:#fff}
.score{font-size:72px;font-weight:800;color:${scoreColor};text-shadow:0 4px 12px rgba(0,0,0,0.3)}
.score-label{color:#64748b;font-size:16px;margin-top:8px}
.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;margin-bottom:20px}
.card-title{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
.stat{text-align:center;padding:20px;background:#0f172a;border-radius:12px;border:1px solid #334155}
.stat-value{font-size:32px;font-weight:700;color:#fff}
.stat-label{font-size:13px;color:#64748b;margin-top:4px}
.footer{text-align:center;margin-top:40px;color:#475569;font-size:13px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="badge">
      <div class="badge-icon">${cert.gatePass ? '✓' : '✗'}</div>
      <div class="badge-text">
        <div class="badge-label">Quality Gate</div>
        <div class="badge-value">${cert.gatePass ? 'PASS' : 'FAIL'}</div>
      </div>
    </div>
    <div class="score">${score}</div>
    <div class="score-label">Quality Score / 100</div>
  </div>
  <div class="card">
    <div class="card-title">Scan Summary</div>
    <div class="grid">
      <div class="stat"><div class="stat-value">${cert.summary.filesAnalyzed}</div><div class="stat-label">Files Analyzed</div></div>
      <div class="stat"><div class="stat-value">${cert.summary.blockingIssues}</div><div class="stat-label">Blocking Issues</div></div>
      <div class="stat"><div class="stat-value">${cert.summary.secrets}</div><div class="stat-label">Secrets Found</div></div>
      <div class="stat"><div class="stat-value">${cert.summary.vulnerabilities}</div><div class="stat-label">Vulnerabilities</div></div>
    </div>
  </div>
  <div class="footer">
    Generated on ${new Date(cert.generatedAt).toLocaleString()}<br>
    SimpleBeacon Certificate v${cert.version}
  </div>
</div>
</body>
</html>`;
}

function computeWorkspaceScore(scanResult: unknown): number {
  const r = scanResult as ScanResult;
  const sev = r.summary?.severityCounts ?? {};
  let score = 100;
  score -= (sev.critical || 0) * 10;
  score -= (sev.high || 0) * 5;
  score -= (sev.medium || 0) * 2;
  score -= (sev.low || 0) * 1;
  return Math.max(0, Math.round(score));
}

async function exportReport() {
  if (!currentReport) {
    vscode.window.showInformationMessage('Run a scan first');
    return;
  }

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('simplebeacon-report.json'),
    filters: { JSON: ['json'] },
  });

  if (uri) {
    fs.writeFileSync(uri.fsPath, JSON.stringify(currentReport, null, 2));
    vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
  }
}

async function exportReportJson() {
  const report = enhancedAIProvider.getScanResult() || (currentReport as ScanResult | null);
  if (!report) {
    vscode.window.showInformationMessage('Run a scan first');
    return;
  }

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('simplebeacon-report.json'),
    filters: { JSON: ['json'] },
  });

  if (uri) {
    fs.writeFileSync(uri.fsPath, exportScanResultToJson(report, true));
    vscode.window.showInformationMessage(`Structured report exported to ${uri.fsPath}`);
  }
}

async function exportAIReportCommand(context: vscode.ExtensionContext) {
  if (!currentReport) {
    vscode.window.showInformationMessage('Run a scan first');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const projectRoot = workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;

  const format = await vscode.window.showQuickPick(
    [
      { label: 'Markdown (recommended for LLMs)', value: 'markdown' as const },
      { label: 'JSON (structured)', value: 'json' as const },
      { label: 'XML (legacy systems)', value: 'xml' as const },
    ],
    { placeHolder: 'Select export format for AI consumption' }
  );

  if (!format) return;

  const includeFixes = await vscode.window.showQuickPick(
    [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    { placeHolder: 'Include fix suggestions?' }
  );

  const opts: AIReportOptions = {
    format: format.value,
    includeFixes: includeFixes?.value ?? true,
    includeContext: true,
    maxFindings: 200,
  };

  const reportText = exportAIReport(currentReport, projectRoot, opts);

  const action = await vscode.window.showInformationMessage(
    `AI report generated (${reportText.length} chars)`,
    'Send to AI Model',
    'Copy to Clipboard',
    'Save to File',
    'Open in Editor'
  );

  if (action === 'Send to AI Model') {
    await sendToAIModel(reportText, context);
  } else if (action === 'Copy to Clipboard') {
    await vscode.env.clipboard.writeText(reportText);
    vscode.window.showInformationMessage('AI report copied to clipboard');
  } else if (action === 'Save to File') {
    const ext = opts.format === 'markdown' ? 'md' : opts.format;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`simplebeacon-ai-report.${ext}`),
      filters: {
        Markdown: ['md'],
        JSON: ['json'],
        XML: ['xml'],
      },
    });
    if (uri) {
      fs.writeFileSync(uri.fsPath, reportText, 'utf8');
      vscode.window.showInformationMessage(`AI report saved to ${uri.fsPath}`);
    }
  } else if (action === 'Open in Editor') {
    const doc = await vscode.workspace.openTextDocument({
      language: opts.format === 'markdown' ? 'markdown' : opts.format,
      content: reportText,
    });
    await vscode.window.showTextDocument(doc);
  }
}

function refreshTree() {
  loadExistingReport();
  vscode.window.showInformationMessage('Results refreshed');
}

function openFileAtLine(file: string, line: number) {
  const uri = vscode.Uri.file(file);
  vscode.window.showTextDocument(uri, {
    selection: new vscode.Range(line - 1, 0, line - 1, 0),
  });
}

async function analyzeWithAI(context: vscode.ExtensionContext) {
  if (!currentReport) {
    vscode.window.showInformationMessage('Run a scan first before sending to AI agent');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const projectRoot = workspaceFolders[0].uri.fsPath;
  const sbDir = path.join(projectRoot, '.simplebeacon');
  fs.mkdirSync(sbDir, { recursive: true });

  // Write raw JSON for backward compatibility with bridge scripts
  const reportPath = path.join(sbDir, 'ai-input-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(currentReport, null, 2), 'utf8');

  // Write AI-optimized markdown with fixes + context for LLM consumption
  const mdPath = path.join(sbDir, 'ai-input-report.md');
  const mdReport = exportAIReport(currentReport, projectRoot, {
    format: 'markdown',
    includeFixes: true,
    includeContext: true,
    maxFindings: 200,
  });
  fs.writeFileSync(mdPath, mdReport, 'utf8');

  const bridgeScript = path.join(projectRoot, 'ai-agent', 'report-analyzer.cjs');
  if (!fs.existsSync(bridgeScript)) {
    vscode.window.showErrorMessage(`AI agent bridge not found: ${bridgeScript}`);
    return;
  }

  outputChannel.show();
  outputChannel.appendLine('[SimpleBeacon] Sending scan report to local AI agent...');
  outputChannel.appendLine(`[SimpleBeacon] JSON report: ${reportPath}`);
  outputChannel.appendLine(`[SimpleBeacon] Markdown report (AI-optimized): ${mdPath}`);

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AI Agent Analysis',
      cancellable: true,
    },
    async (progress, token) => {
      return new Promise<void>((resolve, reject) => {
        // Pass both JSON (arg 1) and markdown (arg 2) paths to bridge script
        const child = spawn(process.execPath, [bridgeScript, reportPath, mdPath], {
          cwd: projectRoot,
          env: { ...process.env, FORCE_COLOR: '0' },
        });

        let stdout = '';
        let stderr = '';

        token.onCancellationRequested(() => {
          child.kill();
          outputChannel.appendLine('[SimpleBeacon] AI analysis cancelled');
          reject(new Error('Cancelled'));
        });

        child.stdout.on('data', (data) => {
          stdout += data.toString();
          outputChannel.appendLine(data.toString().trim());
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
          outputChannel.appendLine(`[stderr] ${data.toString().trim()}`);
        });

        child.on('close', (code) => {
          if (code !== 0) {
            vscode.window.showErrorMessage(`AI agent exited with code ${code}. Check output channel.`);
            reject(new Error(`Exit code ${code}`));
            return;
          }

          hasEnhancedAnalysis = true;
          if (currentReport) {
            EnhancedDashboard.createOrShow(context.extensionUri, currentReport, undefined, true);
          }

          const analysisPath = path.join(sbDir, 'ai-analysis', 'analysis.json');
          if (fs.existsSync(analysisPath)) {
            try {
              const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
              if (analysis.success) {
                vscode.window
                  .showInformationMessage(
                    `AI analysis complete — ${analysis.steps || 0} remediation steps proposed`,
                    'Open Dashboard'
                  )
                  .then((selection) => {
                    if (selection === 'Open Dashboard' && currentReport) {
                      EnhancedDashboard.createOrShow(context.extensionUri, currentReport, undefined, true);
                    }
                  }, () => {});
              } else {
                vscode.window.showWarningMessage('AI analysis returned an error. Check output channel.');
              }
            } catch {
              vscode.window.showInformationMessage('AI analysis complete. Dashboard now shows findings.');
            }
          } else {
            vscode.window.showInformationMessage('AI analysis complete. Dashboard now shows findings.');
          }
          resolve();
        });

        child.on('error', (err) => {
          vscode.window.showErrorMessage(`Failed to start AI agent: ${err.message}`);
          reject(err);
        });
      });
    }
  );
}

async function sendToAIModel(reportText: string, context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('simplebeacon');
  const ollamaUrl = config.get<string>('ollamaUrl') || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const modelName = config.get<string>('ollamaModel') || process.env.AGENT_MODEL || 'llama3.2:latest';

  const prompt = `You are a code hygiene expert. Analyze this SimpleBeacon scan report and propose specific, safe remediation steps.

SCAN REPORT
${reportText}

INSTRUCTIONS
1. For each issue, propose a concrete code change or deletion.
2. Only touch files that exist; never invent paths.
3. Prefer single-line fixes over rewrites.
4. If an issue is a false positive, mark it as such.
5. Return your analysis as structured markdown.`;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Sending report to AI model (${modelName})...`,
      cancellable: true,
    },
    async (_progress, token) => {
      try {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());

        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            prompt: prompt,
            stream: false,
            options: { temperature: 0.0 },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as { response?: string };
        const aiResponse = data.response || '';

        // Show AI response in a webview panel
        const panel = vscode.window.createWebviewPanel('simplebeaconAIResponse', 'AI Analysis', vscode.ViewColumn.One, {
          enableScripts: true,
        });

        panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
body{font-family:var(--vscode-font-family);margin:20px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);line-height:1.6}
h1{color:var(--vscode-textLink-foreground);border-bottom:1px solid var(--vscode-panel-border);padding-bottom:8px}
.model-info{color:var(--vscode-descriptionForeground);font-size:12px;margin-bottom:20px}
.response{background:var(--vscode-textBlockQuote-background);border-left:4px solid var(--vscode-textLink-foreground);padding:16px;border-radius:4px;white-space:pre-wrap}
</style></head>
<body>
<h1>AI Analysis</h1>
<div class="model-info">Model: ${modelName} | Ollama: ${ollamaUrl}</div>
<div class="response">${escapeHtml(aiResponse)}</div>
</body>
</html>`;

        vscode.window.showInformationMessage('AI analysis complete');
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') {
          vscode.window.showInformationMessage('AI analysis cancelled');
        } else {
          vscode.window.showErrorMessage(`AI model error: ${e.message}. Ensure Ollama is running at ${ollamaUrl}`);
        }
      }
    }
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadExistingReport(context?: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const candidates = ['vscode-report.json', 'report.json', 'ai-agent-report.json', 'report-fresh.json', 'cli-report.json', 'simplebeacon-report.json'];

  for (const folder of workspaceFolders) {
    // Check .simplebeacon/ subfolder first
    for (const filename of candidates) {
      const rp = path.join(folder.uri.fsPath, '.simplebeacon', filename);
      if (fs.existsSync(rp)) {
        try {
          const report = JSON.parse(fs.readFileSync(rp, 'utf8'));
          currentReport = report;
          enhancedAIProvider.setScanResult(report);
          scanProvider.updateReport(report);
          enhancedScanProvider.updateReport(report);
          visualSidebarProvider.updateReport(report);
          summaryProvider.updateReport(report);
          settingsProvider.updateReport(report);
          modernSidebarProvider.updateReport(report);
          modernSidebarProvider.updateStatus('completed', 'Loaded previous scan');
          vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
          updateStatusBar(report);
          outputChannel?.appendLine(`[SimpleBeacon] Loaded existing report: ${rp}`);
          return;
        } catch {
          // try next
        }
      }
    }
    // Also check workspace root directly
    for (const filename of candidates) {
      const rp = path.join(folder.uri.fsPath, filename);
      if (fs.existsSync(rp)) {
        try {
          const report = JSON.parse(fs.readFileSync(rp, 'utf8'));
          currentReport = report;
          enhancedAIProvider.setScanResult(report);
          scanProvider.updateReport(report);
          enhancedScanProvider.updateReport(report);
          visualSidebarProvider.updateReport(report);
          summaryProvider.updateReport(report);
          settingsProvider.updateReport(report);
          modernSidebarProvider.updateReport(report);
          modernSidebarProvider.updateStatus('completed', 'Loaded previous scan');
          vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
          updateStatusBar(report);
          outputChannel?.appendLine(`[SimpleBeacon] Loaded existing report: ${rp}`);
          return;
        } catch {
          // try next
        }
      }
    }
  }

  // Fallback: search for most recent report.json backup
  for (const folder of workspaceFolders) {
    const sbDir = path.join(folder.uri.fsPath, '.simplebeacon');
    try {
      const files = fs.readdirSync(sbDir);
      const backups = files
        .filter((f) => f.startsWith('report.json.simplebeacon-backup.'))
        .sort()
        .reverse();
      if (backups.length > 0) {
        const rp = path.join(sbDir, backups[0]);
        const report = JSON.parse(fs.readFileSync(rp, 'utf8'));
        updateProvidersFromReport(report);
        modernSidebarProvider.updateStatus('completed', 'Loaded previous scan');
        outputChannel?.appendLine(`[SimpleBeacon] Loaded backup report: ${rp}`);
        return;
      }
    } catch {
      // ignore
    }
  }

  // Add realtime monitor to context subscriptions
  if (context) {
    context.subscriptions.push(realtimeMonitor);
  }
}

function updateProvidersFromReport(report: unknown): void {
  if (!report) return;
  const r = report as Record<string, unknown>;
  currentReport = r;
  enhancedAIProvider.setScanResult(r);
  scanProvider.updateReport(r);
  enhancedScanProvider.updateReport(r);
  visualSidebarProvider.updateReport(r);
  summaryProvider.updateReport(r);
  settingsProvider.updateReport(r);
  modernSidebarProvider.updateReport(r);
  modernSidebarProvider.updateStatus('completed', 'Report synced from dashboard');
  vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
  updateStatusBar(r);
}

// aiPlatform helper: open a preview panel with URL rewriting for embedded dashboards
async function openPreviewPanel(url: string, title: string) {
  const panel = vscode.window.createWebviewPanel('simplebeaconPreview', title, vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  const baseUrl = url.replace(/#.*$/, '').replace(/\/[^\/]*$/, '/');
  const origin = url.replace(/^(https?:\/\/[^\/]+).*$/, '$1');
  try {
    const html = await fetchHtml(url);
    let rewritten = html
      .replace(/href="(?!https?:\/\/|\/\/|#|data:)([^"]*)"/g, 'href="' + baseUrl + '$1"')
      .replace(/src="(?!https?:\/\/|\/\/|#|data:)([^"]*)"/g, 'src="' + baseUrl + '$1"')
      .replace(/url\((?!https?:\/\/|\/\/|#|data:)([^\)]*)\)/g, 'url(' + baseUrl + '$1)')
      .replace(
        /<script>\s*\(\s*function\s*\(\)\s*\{\s*try\s*\{\s*var\s+key\s*=\s*['"]sb_dash_[^'"]+['"];[\s\S]*?\}\s*catch\s*\(e\)\s*\{[\s\S]*?\}\s*\}\s*\)\s*\(\s*\)\s*;?\s*<\/script>/gi,
        ''
      );
    const cspTag =
      '<meta http-equiv="Content-Security-Policy" content="default-src ' +
      origin +
      '; script-src ' +
      origin +
      " 'unsafe-inline'; style-src " +
      origin +
      " 'unsafe-inline'; img-src " +
      origin +
      ' data: blob:; connect-src ' +
      origin +
      '; font-src ' +
      origin +
      ';">';
    const apiHostScript = '<script>window.__SB_API_HOST__ = "' + origin + '";<\/script>';
    const parsedUrl = new URL(url);
    const hashRoute = parsedUrl.hash || '';
    const initialView = hashRoute.replace(/^#\//, '');
    const routeScript = initialView ? '<script>window.__SB_INITIAL_ROUTE__ = "' + initialView + '";<\/script>' : '';
    const headClose = rewritten.indexOf('</head>');
    if (headClose > 0) {
      rewritten = rewritten.slice(0, headClose) + cspTag + apiHostScript + routeScript + rewritten.slice(headClose);
    } else {
      rewritten = cspTag + apiHostScript + routeScript + rewritten;
    }
    panel.webview.html = rewritten;
    panel.webview.onDidReceiveMessage(async (msg) => {
      // dashboardPanel message handlers removed — not available in this extension version
      if (msg.command === 'sendToAI' && msg.data) {
        const config = vscode.workspace.getConfiguration('simplebeacon');
        const apiUrl = config.get<string>('apiUrl', 'http://127.0.0.1:3000');
        try {
          const postRes = await new Promise<{ success: boolean; content?: string; error?: string }>(
            (resolve, reject) => {
              const parsed = new URL(apiUrl + '/api/ai-context');
              const body = JSON.stringify(msg.data);
              const req = require('http').request(
                {
                  hostname: parsed.hostname,
                  port: parsed.port,
                  path: parsed.pathname,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                },
                (res: http.IncomingMessage) => {
                  let data = '';
                  res.on('data', (chunk: Buffer) => {
                    data += chunk;
                  });
                  res.on('end', () => {
                    try {
                      resolve(JSON.parse(data));
                    } catch {
                      resolve({ success: false, error: 'Invalid JSON' });
                    }
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
            vscode.window.showInformationMessage(
              'Scan data copied to clipboard — paste into your AI coding agent with Ctrl+V'
            );
          } else {
            vscode.window.showWarningMessage('AI context saved but no content returned');
          }
        } catch (err) {
          vscode.window.showErrorMessage('Failed to send to AI: ' + (err instanceof Error ? err.message : String(err)));
        }
      } else if (msg.command === 'scanComplete' && msg.stats) {
        updateProvidersFromReport(msg.stats);
        vscode.window.showInformationMessage('Scan complete — report synced from dashboard');
      } else if (msg.command === 'updateReport' && msg.report) {
        updateProvidersFromReport(msg.report);
        vscode.window.showInformationMessage('Scan report synced from dashboard');
      } else if (msg.command === 'toggleRealtimeMonitoring') {
        if (msg.enabled && !realtimeMonitor['isMonitoring']) {
          realtimeMonitor.start();
          vscode.window.showInformationMessage('AI Slop Cop real-time monitoring started from dashboard');
        } else if (!msg.enabled && realtimeMonitor['isMonitoring']) {
          realtimeMonitor.stop();
          vscode.window.showInformationMessage('AI Slop Cop real-time monitoring stopped');
        }
      }
    });
  } catch (err) {
    panel.webview.html = `<!DOCTYPE html><html><body style="background:#0f0f1a;color:#ef4444;font-family:sans-serif;text-align:center;padding-top:40vh;">Failed to load preview: ${err instanceof Error ? err.message : String(err)}</body></html>`;
  }
}

function fetchHtml(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? require('https') : require('http');
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
    };
    const req = client.request(options, (res: http.IncomingMessage) => {
      let body = '';
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchHtml(redirectUrl, maxRedirects - 1)
          .then((result) => { resolve(result); })
          .catch((err) => { reject(err); });
        return;
      }
      res.on('data', (chunk: Buffer) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      });
    });
    req.on('error', (err: Error) => reject(err));
    req.end();
  });
}
