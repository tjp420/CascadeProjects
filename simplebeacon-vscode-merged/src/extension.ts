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
import { SimpleBeaconProvider, ScanIssue } from './aiPlatform/simplebeaconProvider';
import { ScanPanel } from './aiPlatform/scanPanel';
import { UploadPanel } from './aiPlatform/uploadPanel';
import { DiagnosticsManager } from './aiPlatform/diagnostics';
import { DashboardPanel } from './aiPlatform/dashboardPanel';

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
let lastScannedProjectPath: string | null = null;

// aiPlatform globals (exported for aiPlatform panels)
/** Global SimpleBeacon provider instance. */
export let provider: SimpleBeaconProvider;
/** Global diagnostics manager instance. */
export let diagnosticsManager: DiagnosticsManager;
/** Global dashboard panel instance. */
export let dashboardPanel: DashboardPanel;

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

function showServerOfflineMessage(apiUrl: string): void {
  const hasLocal = !!currentReport && ((currentReport as any).issueCount > 0 || (currentReport as any).detectedIssues?.length > 0 || (currentReport as any).rawIssues?.length > 0);
  if (hasLocal) {
    outputChannel.appendLine(`[SimpleBeacon] Server offline at ${apiUrl} — local scan data available`);
  } else {
    vscode.window.showInformationMessage('SimpleBeacon server is not reachable at ' + apiUrl + '. Start the server or update the URL in settings.');
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

/**
 * Activate the SimpleBeacon extension.
 * @param context - VS Code extension context.
 */
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
    const scanResult = enhancedAIProvider.getScanResult();
    // Don't overwrite a CLI report (has rawIssues) with workspace analyzer result
    const existingHasCliData = (currentReport as any)?.rawIssues || (currentReport as any)?.detectedIssues;
    if (!existingHasCliData) {
      currentReport = scanResult;
    }
    updateStatusBar(currentReport);
    if (currentReport) {
      roadmapProvider.updateFromReport(currentReport as ScanResult);
    }
  });
  realtimeMonitor = RealtimeMonitor.getInstance();

  // Wire live findings to dashboard
  realtimeMonitor.onLiveFindings((issues) => {
    const report = (currentReport || enhancedAIProvider.getRawScanResult() || enhancedAIProvider.getScanResult()) as any;
    if (!report) return;

    // Convert RealtimeIssues to rawIssues format
    const liveIssues = issues.map((it) => ({
      type: it.type,
      severity: it.severity === 'error' ? 'high' : it.severity === 'warning' ? 'medium' : 'low',
      description: it.message,
      filePath: it.file,
      file: it.file,
      line: it.line,
      message: it.message,
      patternId: it.type,
    }));

    // Merge into report
    report.rawIssues = report.rawIssues || [];
    // Remove old live issues for this file to avoid duplicates
    const fileSet = new Set(liveIssues.map((i: any) => i.filePath));
    report.rawIssues = report.rawIssues.filter((ri: any) => !fileSet.has(ri.filePath || ri.file));
    report.rawIssues.push(...liveIssues);

    // Recalculate severity counts
    const sc = report.severityCounts || {};
    sc.critical = report.rawIssues.filter((i: any) => i.severity === 'critical').length;
    sc.high = report.rawIssues.filter((i: any) => i.severity === 'high').length;
    sc.medium = report.rawIssues.filter((i: any) => i.severity === 'medium').length;
    sc.low = report.rawIssues.filter((i: any) => i.severity === 'low').length;
    report.severityCounts = sc;
    report.totalIssues = (sc.critical || 0) + (sc.high || 0) + (sc.medium || 0) + (sc.low || 0);

    // Update dashboard if open
    EnhancedDashboard.updateCurrentPanel(report);

    // Update all sidebar providers in real time
    scanProvider.updateReport(report);
    enhancedScanProvider.updateReport(report);
    visualSidebarProvider.updateReport(report);
    modernSidebarProvider.updateReport(report);
    summaryProvider.updateReport(report);
    settingsProvider.updateReport(report);
    updateStatusBar(report);
    modernSidebarProvider.updateStatus('completed', `${report.totalIssues || 0} issues found`);
  });

  // Wire AI session events to update dashboard webview
  realtimeMonitor.onAiSessionEnd((files) => {
    outputChannel.appendLine(`[AI Session] Dashboard updating with ${files.length} AI-edited files`);
    // Post AI session end message to dashboard webview
    EnhancedDashboard.postMessage({
      command: 'aiSessionEnd',
      fileCount: files.length,
      files: files.map((f) => f.split(/[\\/]/).pop() || f),
    });
    const report = (currentReport || enhancedAIProvider.getRawScanResult() || enhancedAIProvider.getScanResult()) as any;
    if (report) {
      EnhancedDashboard.updateCurrentPanel(report);
      // Update sidebar providers after AI session
      scanProvider.updateReport(report);
      enhancedScanProvider.updateReport(report);
      visualSidebarProvider.updateReport(report);
      modernSidebarProvider.updateReport(report);
      summaryProvider.updateReport(report);
      settingsProvider.updateReport(report);
      updateStatusBar(report);
    }
  });

  // Auto-start real-time AI slop monitoring if enabled
  const autoMonitor = vscode.workspace.getConfiguration('simplebeacon').get('autoMonitorAI');
  if (autoMonitor) {
    realtimeMonitor.start();
  }

  // Initialize Phase 2 components
  aiCodeAnalyzer = AICodeAnalyzer.getInstance();
  advancedAnalytics = AdvancedAnalytics.getInstance();
  teamDashboard = TeamDashboard.getInstance();

  // Initialize aiPlatform components
  provider = new SimpleBeaconProvider(context);
  diagnosticsManager = new DiagnosticsManager();
  dashboardPanel = new DashboardPanel(context.extensionUri);

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

  // Ping server so website knows extension is active
  const apiUrl = getConfiguredApiUrl();
  try {
    const http = apiUrl.startsWith('https') ? require('https') : require('http');
    const parsed = new URL(apiUrl + '/api/vscode-heartbeat');
    const req = http.request(
      { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res: any) => { /* silently consume response */ }
    );
    req.on('error', () => { /* ignore — server may not be running yet */ });
    req.write(JSON.stringify({ version: context.extension.packageJSON?.version || '3.0.1' }));
    req.end();
  } catch { /* ignore */ }

  // Re-ping every 20s while extension is active
  const heartbeatInterval = setInterval(() => {
    try {
      const http = apiUrl.startsWith('https') ? require('https') : require('http');
      const parsed = new URL(apiUrl + '/api/vscode-heartbeat');
      const req = http.request(
        { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } },
        () => {}
      );
      req.on('error', () => {});
      req.write(JSON.stringify({ version: context.extension.packageJSON?.version || '3.0.1' }));
      req.end();
    } catch { }
  }, 20000);
  context.subscriptions.push({ dispose: () => clearInterval(heartbeatInterval) });
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
      if (await checkServerReachable(apiUrl)) {
        await vscode.commands.executeCommand('simpleBrowser.show', reportUrl);
        return;
      }
      // Server offline — open local dashboard instead
      if (currentReport) {
        const hasFindings = (currentReport as any).issueCount > 0 || (currentReport as any).detectedIssues?.length > 0 || (currentReport as any).rawIssues?.length > 0;
        EnhancedDashboard.createOrShow(context.extensionUri, currentReport, undefined, hasFindings);
      } else {
        showServerOfflineMessage(apiUrl);
      }
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
      CodeMapProvider.getInstance().showCodeMap(report, context);
    }),
    vscode.commands.registerCommand('simplebeacon.showRemediationGuide', () => {
      let report: any = null;

      // PRIORITY 1: in-memory current report (most recent scan)
      report = enhancedAIProvider.getRawScanResult() || currentReport || enhancedAIProvider.getScanResult();
      if (report) {
        const count = report.rawIssues?.length || report.detectedIssues?.length || report.issueCount || 0;
        vscode.window.showInformationMessage(`🚀 Fix Guide: Loaded ${count} issues from current scan`);
      }

      // Fallback: direct file read from disk
      if (!report) {
        try {
          const reportPath = lastScannedProjectPath
            ? path.join(lastScannedProjectPath, '.simplebeacon', 'vscode-report.json')
            : path.join('c:\\Users\\Trevor\\CascadeProjects\\coming-soon', '.simplebeacon', 'vscode-report.json');
          if (fs.existsSync(reportPath)) {
            report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            const count = report.rawIssues?.length || report.detectedIssues?.length || 0;
            vscode.window.showInformationMessage(`🚀 Fix Guide: Loaded ${count} issues from ${path.basename(path.dirname(reportPath))}`);
          }
        } catch (e) {
          outputChannel.appendLine(`[FixGuide] Disk read failed: ${e}`);
        }
      }

      if (!report) {
        vscode.window.showInformationMessage('Run a scan first to view the fix guide');
        return;
      }

      RemediationProvider.showRemediationGuide(report);
    }),
    vscode.commands.registerCommand('simplebeacon.exportEmail', async () => {
      const report = enhancedAIProvider.getRawScanResult() || currentReport || enhancedAIProvider.getScanResult();
      if (!report) {
        vscode.window.showInformationMessage('Run a scan first to export an email report');
        return;
      }
      try {
        const html = renderEmailTemplate(report, context.extensionPath);
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('simplebeacon-report.html'),
          filters: { 'HTML': ['html'] }
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(html, 'utf8'));
          vscode.window.showInformationMessage('Email report saved');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to export email: ${err.message}`);
      }
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
      const teamUrl = apiUrl + '/simplebeacon-dashboard/';
      if (!(await checkServerReachable(apiUrl))) {
        showServerOfflineMessage(apiUrl);
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
    vscode.commands.registerCommand('simplebeacon.setMonitorDirectory', async (dir?: string) => {
      const input = dir || await vscode.window.showInputBox({
        prompt: 'Directory path to monitor (relative to workspace root). Leave empty for entire workspace.',
        placeHolder: 'e.g. src/components or server/routes',
        value: vscode.workspace.getConfiguration('simplebeacon').get('realtimeMonitorDirectory', ''),
      });
      if (input !== undefined) {
        await vscode.workspace.getConfiguration('simplebeacon').update('realtimeMonitorDirectory', input, true);
        const display = input.trim() || 'entire workspace';
        vscode.window.showInformationMessage(`Monitor directory set to: ${display}`);
        // Restart realtime monitor if active so new path takes effect
        if (realtimeMonitor['isMonitoring']) {
          realtimeMonitor.stop();
          realtimeMonitor.start();
          vscode.window.showInformationMessage('Real-time monitor restarted with new directory');
        }
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
        showServerOfflineMessage(apiUrl);
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', fullUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openInPreview', async (path?: string) => {
      const apiUrl = getConfiguredApiUrl();
      const fullUrl = apiUrl + (path || '/');
      if (!(await checkServerReachable(apiUrl))) {
        showServerOfflineMessage(apiUrl);
        return;
      }
      await openPreviewPanel(fullUrl, 'SimpleBeacon Preview');
    }),
    // aiPlatform commands
    vscode.commands.registerCommand('simplebeacon.scanFolder', (uri: vscode.Uri) => {
      const targetPath = uri ? uri.fsPath : undefined;
      if (!targetPath) {
        vscode.window.showWarningMessage('No folder selected.');
        return;
      }
      ScanPanel.createOrShow(context.extensionUri, targetPath);
    }),
    vscode.commands.registerCommand('simplebeacon.uploadReport', async () => {
      const apiUrl = getConfiguredApiUrl();
      const uploadUrl = apiUrl + '/audit.html';
      if (!(await checkServerReachable(apiUrl))) {
        showServerOfflineMessage(apiUrl);
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', uploadUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.refreshResults', async () => {
      provider.refresh();
      loadExistingReport(context);
      vscode.window.showInformationMessage('Results refreshed');
    }),
    vscode.commands.registerCommand('simplebeacon.openIssue', (issue: ScanIssue) => {
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
        showServerOfflineMessage(apiUrl);
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', analyzeUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.openUpload', async () => {
      const apiUrl = getConfiguredApiUrl();
      const uploadUrl = apiUrl + '/audit.html';
      if (!(await checkServerReachable(apiUrl))) {
        showServerOfflineMessage(apiUrl);
        return;
      }
      await vscode.commands.executeCommand('simpleBrowser.show', uploadUrl);
    }),
    vscode.commands.registerCommand('simplebeacon.syncTokenFromDashboard', async () => {
      const token = await authManager.promptForToken();
      if (token) {
        vscode.window.showInformationMessage('SimpleBeacon token synced. You can now run scans with your licensed tier.');
      }
    }),
    vscode.commands.registerCommand('simplebeacon.openPreview', async (url?: string, title?: string) => {
      const targetUrl = url || getConfiguredApiUrl();
      if (!(await checkServerReachable(targetUrl))) {
        showServerOfflineMessage(targetUrl);
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
        showServerOfflineMessage(apiUrl);
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
    vscode.commands.registerCommand('simplebeacon.refreshDashboard', (stats) => {
      dashboardPanel.updateStats(stats);
    }),
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
                  ScanPanel.createOrShow(context.extensionUri, projectPath);
                }
              })
              .catch(() => {});
          }
        }
      },
    })
  );
}

/**
 * Deactivate the extension and dispose of resources.
 */
export function deactivate() {
  outputChannel?.dispose();
  diagnosticsManager?.dispose();
}

async function runScan(context: vscode.ExtensionContext) {
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
  lastScannedProjectPath = projectPath;

  // Clear stale vscode-report.json so sidebar doesn't show old scan data
  try {
    const staleReport = path.join(projectPath, '.simplebeacon', 'vscode-report.json');
    if (fs.existsSync(staleReport)) {
      fs.unlinkSync(staleReport);
      outputChannel.appendLine('[SimpleBeacon] Cleared stale vscode-report.json');
    }
  } catch (e) {
    // ignore
  }
  const config = vscode.workspace.getConfiguration('simplebeacon');
  const maxFiles = config.get<number>('maxFiles', 10000);
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

  const args = ['scan', '--full', '--format', 'json', '--output', '.simplebeacon/report.json'];

  const configPath = path.join(projectPath, '.simplebeacon', 'config.json');
  if (fs.existsSync(configPath)) {
    args.push('--config', '.simplebeacon/config.json');
  }

  if (excludePatterns.length > 0) {
    args.push('--exclude', excludePatterns.join(','));
  }

  // Find the best CLI executable: prefer local dev build over broken npx global
  function resolveSimpleBeaconCli(): { cmd: string; cliArgs: string[] } {
    const candidates = [
      path.join('c:', 'Users', 'Trevor', 'CascadeProjects', 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon.js'),
      path.join('c:', 'Users', 'Trevor', 'CascadeProjects', 'coming-soon', 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon.js'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return { cmd: 'node', cliArgs: [candidate, ...args] };
      }
    }
    // Fall back to npx global (may be broken, but best effort)
    return { cmd: 'npx', cliArgs: ['simplebeacon', ...args] };
  }
  const { cmd, cliArgs } = resolveSimpleBeaconCli();
  outputChannel.appendLine(`[SimpleBeacon] CLI: ${cmd} ${cliArgs[0]}`);

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'SimpleBeacon Scan',
      cancellable: true,
    },
    (progress, token) => {
      return new Promise((resolve, reject) => {
        const child = spawn(cmd, cliArgs, {
          cwd: projectPath,
          shell: true,
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
          // Only treat as error if both stdout and stderr are empty
          const output = stdout.trim() || stderr.trim();
          if (code !== 0 && code !== null && !output) {
            const errDetail = 'No output from CLI. Ensure simplebeacon is installed: npm install -g simplebeacon-cli';
            outputChannel.appendLine(`[SimpleBeacon] Scan failed (exit ${code}): ${errDetail}`);
            vscode.window.showErrorMessage(`Scan failed (exit ${code}): ${errDetail}`);
            reject(new Error(`Exit code ${code}: ${errDetail}`));
            return;
          }

          try {
            // Read the full JSON report written by CLI --output flag
            let report;
            const reportPath = path.join(projectPath, '.simplebeacon', 'report.json');
            if (fs.existsSync(reportPath)) {
              try {
                const rawJson = fs.readFileSync(reportPath, 'utf8');
                report = JSON.parse(rawJson);
                outputChannel.appendLine(`[SimpleBeacon] Loaded full report from ${reportPath} (${(rawJson.length / 1024).toFixed(1)}KB)`);
              } catch (readErr) {
                outputChannel.appendLine(`[SimpleBeacon] Could not read report.json: ${readErr}`);
              }
            }

            // Fallback: try to extract JSON from stdout if report file missing
            if (!report && output.includes('{') && output.includes('}')) {
              const jsonMatch = output.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  report = JSON.parse(jsonMatch[0]);
                } catch {
                  // Fall through to text parsing
                }
              }
            }

            // Detect quota/blocking errors from the CLI report
            if (report && (report.error || report.scan_summary?.status === 'BLOCKED')) {
              const reason = report.error || report.scan_summary?.reason || 'scan blocked';
              vscode.window.showWarningMessage(
                `SimpleBeacon scan blocked: ${reason}. ` +
                (reason.includes('quota') ? 'Run the command palette command "Reset SimpleBeacon Scan Quota" or delete ~/.simplebeacon/scan-usage.json.' : '')
              );
              outputChannel.appendLine(`[SimpleBeacon] Scan blocked: ${reason}`);
              enhancedScanProvider.setScanning(false);
              visualSidebarProvider.setScanning(false);
              modernSidebarProvider.updateStatus('error', 'Scan blocked');
              reject(new Error(`Scan blocked: ${reason}`));
              return;
            }

            if (!report) {
              // Parse text output to create minimal report
              const gateMatch = output.match(/Gate:\s*(FAIL|PASS)/);
              const scoreMatch = output.match(/Quality score:\s*(\d+|\[HIDDEN[^\]]*\])/);
              const criticalMatch = output.match(/Critical:\s*(\d+)/);
              const highMatch = output.match(/High:\s*(\d+)/);
              const mediumMatch = output.match(/Medium:\s*(\d+)/);
              const lowMatch = output.match(/Low:\s*(\d+)/);
              const gateFilesMatch = output.match(/Gate rules checked:\s*(\d+)/);
              const repoFilesMatch = output.match(/Repository files:\s*([\d,]+)/);

              const rawIssues = [];
              const issueRegex = /^\s*\[(\w+)\]\s+(.+?):\s*(.+)$/gm;
              let match;
              while ((match = issueRegex.exec(output)) !== null) {
                const [, severity, type, description] = match;
                const fileMatch = description.match(/^(.+?):(\d+)\s*(?:[-\u2013\u2014]\s+)?(.+)$/);
                const filePath = fileMatch ? fileMatch[1] : '';
                const lineNum = fileMatch ? parseInt(fileMatch[2]) : 1;
                rawIssues.push({
                  severity,
                  type,
                  description,
                  file: filePath,
                  line: lineNum,
                });
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
                issueCount:
                  (criticalMatch ? parseInt(criticalMatch[1]) : 0) +
                  (highMatch ? parseInt(highMatch[1]) : 0) +
                  (mediumMatch ? parseInt(mediumMatch[1]) : 0) +
                  (lowMatch ? parseInt(lowMatch[1]) : 0),
                qualityScore: scoreMatch ? (scoreMatch[1].includes('HIDDEN') ? null : parseInt(scoreMatch[1])) : null,
                gate: {
                  pass: gateMatch ? gateMatch[1] === 'PASS' : false,
                  failOn: ['high'],
                  warnOn: ['medium', 'low'],
                  blockingCount: highMatch ? parseInt(highMatch[1]) : 0,
                  warningCount: (mediumMatch ? parseInt(mediumMatch[1]) : 0) + (lowMatch ? parseInt(lowMatch[1]) : 0),
                  blockingIssues: [],
                  warningIssues: [],
                },
                severityCounts: {
                  critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
                  high: highMatch ? parseInt(highMatch[1]) : 0,
                  medium: mediumMatch ? parseInt(mediumMatch[1]) : 0,
                  low: lowMatch ? parseInt(lowMatch[1]) : 0,
                },
                detectedIssues: rawIssues,
                rawIssues: rawIssues,
              };
            }

            const validationErrors = validateReport(report);
            if (validationErrors.length > 0) {
              outputChannel.appendLine(`[SimpleBeacon] Report validation warnings: ${validationErrors.join(', ')}`);
            }

            currentReport = report;
            hasEnhancedAnalysis = false;
            enhancedAIProvider.setScanResult(report);

            // Save CLI report to disk so it persists across reloads
            try {
              const sbDir = path.join(projectPath, '.simplebeacon');
              fs.mkdirSync(sbDir, { recursive: true });
              fs.writeFileSync(path.join(sbDir, 'vscode-report.json'), JSON.stringify(report, null, 2), 'utf8');
            } catch (saveErr) {
              outputChannel.appendLine(`[SimpleBeacon] Warning: could not save report: ${saveErr}`);
            }
            scanProvider.updateReport(report);
            enhancedScanProvider.updateReport(report);
            visualSidebarProvider.updateReport(report);
            summaryProvider.updateReport(report);
            settingsProvider.updateReport(report);
            modernSidebarProvider.updateReport(report);
            dashboardPanel?.updateReport(report);
            modernSidebarProvider.updateStatus('completed', 'Scan complete — awaiting analysis');
            CodeMapProvider.getInstance().updateData(report as ScanResult);
            vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
            updateStatusBar(report);
            // Open dashboard with findings visible immediately
            const hasFindings = (report.issueCount || 0) > 0 || (report.detectedIssues?.length || 0) > 0 || (report.rawIssues?.length || 0) > 0;
            EnhancedDashboard.createOrShow(context.extensionUri, report, undefined, hasFindings);

            const score = report.qualityScore ?? '[HIDDEN]';
            const gateStatus = report.gate?.pass ? 'PASS' : 'FAIL';
            const issueCount = report.issueCount || report.detectedIssues?.length || report.rawIssues?.length || 0;
            const message = `SimpleBeacon scan complete — Score: ${score}/100 — Gate: ${gateStatus}. ${issueCount} issue${issueCount === 1 ? '' : 's'} found.`;

            Promise.resolve(vscode.window.showInformationMessage(message, 'Open Dashboard')).then((selection) => {
              if (selection === 'Open Dashboard') {
                vscode.commands.executeCommand('simplebeacon.showReport');
              }
            }).catch(() => {});
            outputChannel.appendLine(`[SimpleBeacon] Scan complete. Score: ${score}/100 — Gate: ${gateStatus}`);
            resolve(report);
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
  if (provider) {
    provider.clear();
  }
  if (diagnosticsManager) {
    diagnosticsManager.clear();
  }
  if (dashboardPanel) {
    dashboardPanel.clearStats();
  }
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

  // CLI reports have rawIssues/detectedIssues; workspace analyzer reports only have findings
  const cliCandidates = ['vscode-report.json', 'cli-report.json', 'report-fresh.json'];
  const fallbackCandidates = ['simplebeacon-report.json', 'report.json', 'ai-agent-report.json'];

  function tryLoadReport(folder: vscode.WorkspaceFolder, filename: string, subfolder: string): boolean {
    const rp = path.join(folder.uri.fsPath, subfolder, filename);
    if (!fs.existsSync(rp)) return false;
    try {
      const stat = fs.statSync(rp);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > 3600000) {
        outputChannel?.appendLine(`[SimpleBeacon] Skipping stale report (${Math.round(ageMs / 60000)}m old): ${rp}`);
        return false;
      }
      const report = JSON.parse(fs.readFileSync(rp, 'utf8'));
      // Reject workspace analyzer reports (only findings, no rawIssues/detectedIssues)
      const hasCliData = (report.rawIssues?.length > 0) || (report.detectedIssues?.length > 0);
      const hasFindings = (report.findings?.length > 0);
      if (!hasCliData && hasFindings) {
        outputChannel?.appendLine(`[SimpleBeacon] Skipping workspace analyzer report: ${rp}`);
        return false;
      }
      currentReport = report;
      enhancedAIProvider.setScanResult(report);
      scanProvider.updateReport(report);
      enhancedScanProvider.updateReport(report);
      visualSidebarProvider.updateReport(report);
      summaryProvider.updateReport(report);
      settingsProvider.updateReport(report);
      modernSidebarProvider.updateReport(report);
      dashboardPanel?.updateReport(report);
      modernSidebarProvider.updateStatus('completed', 'Loaded previous scan');
      vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
      updateStatusBar(report);
      outputChannel?.appendLine(`[SimpleBeacon] Loaded existing report: ${rp}`);
      return true;
    } catch {
      return false;
    }
  }

  // Priority 1: CLI reports in .simplebeacon/
  for (const folder of workspaceFolders) {
    for (const filename of cliCandidates) {
      if (tryLoadReport(folder, filename, '.simplebeacon')) return;
    }
  }
  // Priority 2: CLI reports in workspace root
  for (const folder of workspaceFolders) {
    for (const filename of cliCandidates) {
      if (tryLoadReport(folder, filename, '')) return;
    }
  }
  // Priority 3: Fallback reports in .simplebeacon/
  for (const folder of workspaceFolders) {
    for (const filename of fallbackCandidates) {
      if (tryLoadReport(folder, filename, '.simplebeacon')) return;
    }
  }
  // Priority 4: Fallback reports in workspace root
  for (const folder of workspaceFolders) {
    for (const filename of fallbackCandidates) {
      if (tryLoadReport(folder, filename, '')) return;
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
        currentReport = report;
        enhancedAIProvider.setScanResult(report);
        scanProvider.updateReport(report);
        enhancedScanProvider.updateReport(report);
        visualSidebarProvider.updateReport(report);
        summaryProvider.updateReport(report);
        settingsProvider.updateReport(report);
        modernSidebarProvider.updateReport(report);
        dashboardPanel?.updateReport(report);
        modernSidebarProvider.updateStatus('completed', 'Loaded previous scan');
        vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
        updateStatusBar(report);
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
      if (msg.command === 'updateStats') {
        dashboardPanel?.updateStats(msg);
        return;
      }
      if (msg.command === 'scanComplete' && msg.stats) {
        dashboardPanel?.updateStats(msg.stats);
        return;
      }
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
        vscode.commands.executeCommand('simplebeacon.refreshDashboard', msg.stats);
      } else if (msg.command === 'updateReport' && msg.report) {
        vscode.commands.executeCommand('simplebeacon.refreshDashboard', {
          issues: msg.report.issueCount || 0,
          critical: msg.report.severityCounts?.critical || 0,
          high: msg.report.severityCounts?.high || 0,
          medium: msg.report.severityCounts?.medium || 0,
          low: msg.report.severityCounts?.low || 0,
          score: msg.report.qualityScore || 0,
        });
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

function renderEmailTemplate(report: any, extensionPath: string): string {
  const r = report || {};
  const sev = r.severityCounts || {};
  const total = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
  const score = r.qualityScore ?? r.score ?? 0;
  const gate = r.gateStatus || (r.gate?.status) || 'UNKNOWN';
  const gateClass = gate === 'PASS' ? 'pass' : gate === 'WARN' ? 'warn' : 'fail';
  const all = total || 1;
  const critPct = ((sev.critical || 0) / all) * 100;
  const highPct = ((sev.high || 0) / all) * 100;
  const medPct = ((sev.medium || 0) / all) * 100;
  const lowPct = ((sev.low || 0) / all) * 100;
  const files = r.filesAnalyzed || r.totalFiles || r.totalRepositoryFiles || 0;
  const date = new Date().toLocaleString();

  // Build findings HTML from rawIssues
  const raw = r.rawIssues || r.detectedIssues || [];
  const findingsHtml = raw.length > 0
    ? raw.map((it: any) => {
        const sevColor = it.severity === 'critical' || it.severity === 'high' ? '#ef4444'
          : it.severity === 'medium' ? '#f59e0b' : '#10b981';
        return `<div class="finding">
      <div class="finding-header">
        <span class="finding-type" style="color:${sevColor};">${escapeHtml(it.type || 'Finding')}</span>
        <span class="finding-sev sev-${escapeHtml(it.severity || 'low')}">${escapeHtml(it.severity || 'low')}</span>
      </div>
      <div class="finding-desc">${escapeHtml(it.description || it.message || 'Finding')}</div>
      <span class="finding-file">${escapeHtml(it.filePath || it.file || 'unknown')}:${it.line || 1}</span>
    </div>`;
      }).join('\n')
    : `<div class="clean-state">
      <div class="clean-icon">&#9989;</div>
      <div class="clean-title">All Clear!</div>
      <div class="clean-desc">No security issues detected. Your codebase passed all quality gates.</div>
    </div>`;

  const templatePath = path.join(extensionPath, 'media', 'email-preview-filled.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // Replace simple values
  html = html
    .replace(/<div class="score-ring [a-z]+">\d+<\/div>/, `<div class="score-ring ${gateClass}">${score}</div>`)
    .replace(/<div class="score-label">[A-Z]+<\/div>/, `<div class="score-label">${gate}</div>`)
    .replace(/<strong>My Project<\/strong> &mdash; .*?<\/p>/, `<strong>My Project</strong> &mdash; ${date}</p>`)
    .replace(/<div class="metric-value">[\d,]+<\/div>\s*<div class="metric-label">Files Scanned<\/div>/, `<div class="metric-value">${files.toLocaleString()}</div>\n        <div class="metric-label">Files Scanned</div>`)
    .replace(/<div class="metric-value">[\d,]+<\/div>\s*<div class="metric-label">Total Issues<\/div>/, `<div class="metric-value">${total.toLocaleString()}</div>\n        <div class="metric-label">Total Issues</div>`)
    .replace(/<div class="metric-value">[\d,]+<\/div>\s*<div class="metric-label">Critical<\/div>/, `<div class="metric-value">${sev.critical || 0}</div>\n        <div class="metric-label">Critical</div>`)
    .replace(/<div class="metric-value">[\d,]+<\/div>\s*<div class="metric-label">High<\/div>/, `<div class="metric-value">${sev.high || 0}</div>\n        <div class="metric-label">High</div>`)
    .replace(/style="width:[\d.]+%; background:#ef4444;"/, `style="width:${critPct}%; background:#ef4444;"`)
    .replace(/style="width:[\d.]+%; background:#f97316;"/, `style="width:${highPct}%; background:#f97316;"`)
    .replace(/style="width:[\d.]+%; background:#f59e0b;"/, `style="width:${medPct}%; background:#f59e0b;"`)
    .replace(/style="width:[\d.]+%; background:#10b981;"/, `style="width:${lowPct}%; background:#10b981;"`)
    .replace(/Critical \d+/, `Critical ${sev.critical || 0}`)
    .replace(/High \d+/, `High ${sev.high || 0}`)
    .replace(/Medium \d+/, `Medium ${sev.medium || 0}`)
    .replace(/Low \d+/, `Low ${sev.low || 0}`)
    .replace(/<div class="section">\s*<div class="section-title">Top Findings<\/div>[\s\S]*?<\/div>\s*<\/div>\s*<div class="section" style="text-align:center;">/, `<div class="section">\n    <div class="section-title">Top Findings</div>\n    ${findingsHtml}\n  </div>\n\n  <div class="section" style="text-align:center;">`);

  return html;
}
