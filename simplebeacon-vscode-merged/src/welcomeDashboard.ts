// simplebeacon-ignore memory-leak — static UI bindings and report data processing
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { getDataServerPort, getServerState } from './dataServer';
import { ScanProfile } from './analyzers/workspaceAnalyzer';
import { AuthManager } from './auth/authManager';
import { buildDashboardHtml } from './welcomeDashboardHtml';
import { showDashboardInSidebar, isSidebarReady, openSidebarPreview, setSidebarAuthState } from './sidebarBridge';
import { postSidebarMessage, openTeamDashboardPanel } from './sidebarMessenger';
import { showQuietMessage, getSbConfig, normalizeApiServerUrl } from './utils/vscode';

const DEFAULT_API_URL = 'https://simplebeacon.ai/';

function getVersionFromExtUri(extUri: vscode.Uri): string {
  try {
    const pkgPath = path.join(extUri.fsPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return (pkg.version as string) || '1.0.0';
  } catch {
    // simplebeacon-ignore error-swallowing — package.json read fallback, non-critical
    return '1.0.0';
  }
}

/**
 * Welcome dashboard panel for SimpleBeacon.
 * Shown on extension activation when configured.
 */
export class WelcomeDashboard {
  private static currentPanel: WelcomeDashboard | undefined;
  private static _programmaticDispose = false;
  private static _lastPane = 'dashboard';
  private static _lastAutoReopenTime = 0;
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private version: string;
  private authManager: AuthManager;

  static createOrShow(extUri: vscode.Uri, force = false) {
    const displayMode = getSbConfig().get<string>('displayMode', 'sidebar');
    if (!force && displayMode === 'sidebar') {
      Promise.resolve(vscode.commands.executeCommand('simplebeacon-modern.focus')).catch(() => {});
      showDashboardInSidebar();
      if (isSidebarReady()) {
        return null;
      }
      // Sidebar not ready — fall back to panel mode
    }
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (WelcomeDashboard.currentPanel) {
      try {
        WelcomeDashboard.currentPanel.panel.reveal();
        // Do NOT rebuild HTML or clear queue on reveal — with retainContextWhenHidden
        // the webview stays alive and rebuilding causes unnecessary reloads that lose
        // queued messages (e.g. showLoginModal from the Sign In button).
        return WelcomeDashboard.currentPanel;
      } catch {
        WelcomeDashboard.currentPanel = undefined;
      }
    }
    const workspace = vscode.workspace.workspaceFolders?.[0];
    const localRoots: vscode.Uri[] = [vscode.Uri.joinPath(extUri, 'media')];
    if (workspace) { localRoots.push(vscode.Uri.joinPath(workspace.uri, '.simplebeacon')); }
    const panel = vscode.window.createWebviewPanel(
      'simplebeaconWelcomeV2',
      'SimpleBeacon AI Slop Cop',
      col || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: localRoots
      }
    );
    WelcomeDashboard.currentPanel = new WelcomeDashboard(panel, extUri);
    panel.reveal();
    return WelcomeDashboard.currentPanel;
  }

  static reveal() {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.panel.reveal();
      return true;
    }
    return false;
  }

  static dispose() {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard._programmaticDispose = true;
      WelcomeDashboard.currentPanel.panel.dispose();
      WelcomeDashboard._programmaticDispose = false;
      WelcomeDashboard.currentPanel = undefined;
    }
  }

  private static _lastDashboardData: { files?: string; gate?: string; issues?: string; score?: string } | null = null;
  private static _lastAnalyzeData: { lastAnalysis?: string; findings?: string } | null = null;
  private static _lastReportData: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any; lastAnalysis?: string } | null = null;
  private static _lastRoadmapData: { open?: string; risk?: string; done?: string; target?: string; status?: string; findings?: any } | null = null;
  private static _lastSecurityData: { critical?: string; high?: string; medium?: string; score?: string; status?: string; findings?: any } | null = null;
  private static _lastTrustData: { trustScore?: string; verified?: string; warnings?: string; lastAudit?: string; status?: string; quality?: string; security?: string; compliance?: string; dependencies?: string; severity?: any; factors?: any[]; badges?: any[]; gate?: string } | null = null;
  private static _lastQualityData: { qualityScore?: string; issues?: string; coverage?: string; files?: string; status?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string } | null = null;
  private static _lastComplianceData: { passed?: string; failed?: string; progress?: string; total?: string; status?: string; rules?: any[] } | null = null;
  private static _lastAnalyticsData: { scans?: string; issues?: string; avgScore?: string; lastScan?: string; trend?: string; issueTrend?: string; status?: string } | null = null;
  private static _lastTeamData: { members?: string; scans?: string; resolved?: string; score?: string; status?: string; membersList?: any[] } | null = null;
  private static _lastRepoHealthData: { score?: string; qualityScore?: string; gate?: string; issues?: string; files?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; findings?: any[]; recommendations?: any[] } | null = null;
  private static _lastScanData: { total?: string; issues?: string; fixed?: string; score?: string; qualityScore?: string; status?: string; scanning?: boolean; hasResults?: boolean; progress?: string; critical?: string; high?: string; medium?: string; low?: string; results?: any[]; history?: any[]; gate?: string } | null = null;
  private static _lastCodeMapData: { status?: string; files?: string; languages?: string; modules?: string; arch?: string; repoFiles?: string; totalLines?: string; lastScan?: string; codeMapUri?: string; graph?: { nodes: any[]; edges: any[] }; tree?: any[]; list?: any[]; severity?: any; cycles?: any[]; entryPoints?: string[]; leafModules?: string[]; mostConnected?: { name: string; count: number }[] } | null = null;

  static updateDashboardIfOpen(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any[] }) {
    WelcomeDashboard._lastDashboardData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateDashboard(data);
    }
  }

  static updateAnalyzePaneIfOpen(data: { lastAnalysis?: string; findings?: any; score?: string; gate?: string; issues?: string; files?: string; severity?: any; }) {
    WelcomeDashboard._lastAnalyzeData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateAnalyzePane(data);
    }
  }

  static updateReportPaneIfOpen(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any; totalScans?: string; lastAnalysis?: string }) {
    WelcomeDashboard._lastReportData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateReportPane(data);
    }
  }

  static getLastReportData() {
    return WelcomeDashboard._lastReportData;
  }

  static showPaneIfOpen(route: string) {
    const panel = WelcomeDashboard.currentPanel;
    if (!panel) return;
    let r = (route || '').replace(/^#\//, '').replace(/^\/+/, '').replace(/-/g, '').toLowerCase();
    r = r.split('/').filter(Boolean).pop() || 'dashboard';
    switch (r) {
      case 'dashboard': panel.showDashboardPane(); break;
      case 'analyze': panel.showAnalyzePane(); break;
      case 'results':
      case 'report': panel.showReportPane(); break;
      case 'security': panel.showSecurityPane(); break;
      case 'settings': panel.showSettingsPane(); break;
      case 'audit': panel.showAuditPane(); break;
      case 'trust': panel.showTrustPane(); break;
      case 'quality': panel.showQualityPane(); break;
      case 'assessments': panel.showAssessmentsPane(); break;
      case 'platform': panel.showPlatformPane(); break;
      case 'profile': panel.showProfilePane(); break;
      case 'compliance': panel.showCompliancePane(); break;
      case 'repositoryhealth': panel.showRepoHealthPane(); break;
      case 'analytics': panel.showAnalyticsPane(); break;
      case 'team': panel.showTeamPane(); break;
      case 'scan': panel.showScanPane(); break;
      case 'certificate': panel.showCertificatePane(); break;
      case 'codemap': panel.showCodeMapPane(); break;
      case 'roadmap':
      case 'remediation': panel.showRoadmapPane(); break;
      case 'aicontext': panel.showAiContextPane(); break;
      case 'upload': panel.showUploadPane(); break;
      case 'signin': panel.showSigninPane(); break;
      case 'tools': panel.showDashboardPane(); break;
      case 'help': panel.showDashboardPane(); break;
      case 'chatbot': panel.showDashboardPane(); break;
      case 'about': panel.showDashboardPane(); break;
      default: panel.showDashboardPane(); break;
    }
  }

  public showSettingsPane(data?: { severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'settings';
    this.queueOrPostMessage({ command: 'showSettingsPane' });
    this.updateSettingsPane(data);
  }

  public updateSettingsPane(data?: { severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    const config = getSbConfig();
    this.queueOrPostMessage({
      command: 'updateSettingsPane',
      autoScan: !!config.get('autoScanOnOpen', false),
      displayMode: config.get('displayMode', 'sidebar') || 'sidebar',
      browserMode: (config.get('browserOpenMode', 'panel') as string) === 'browser',
      notifyScan: !!config.get('notifyScanComplete', true),
      notifyGate: !!config.get('notifyGateFailure', true),
      apiUrl: config.get('apiServerUrl', DEFAULT_API_URL) || DEFAULT_API_URL,
      severity: data?.severity || {},
      qualityScore: data?.qualityScore || '--',
      issues: data?.issues || '--',
      gate: data?.gate || '--'
    });
  }

  static updateSettingsPaneIfOpen(data: { severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateSettingsPane(data);
    }
  }

  public showDashboardPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'dashboard';
    this.queueOrPostMessage({ command: 'showDashboardPane' });
    if (WelcomeDashboard._lastDashboardData) {
      this.queueOrPostMessage({ command: 'updateDashboard', ...WelcomeDashboard._lastDashboardData });
    }
  }

  public showSigninPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'signin';
    vscode.commands.executeCommand('simplebeacon.signIn');
  }

  public showAnalyzePane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'analyze';
    this.queueOrPostMessage({ command: 'showAnalyzePane' });
    if (WelcomeDashboard._lastAnalyzeData) {
      this.queueOrPostMessage({ command: 'updateAnalyzePane', ...WelcomeDashboard._lastAnalyzeData });
    }
  }

  public showReportPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'report';
    this.queueOrPostMessage({ command: 'showReportPane' });
    if (WelcomeDashboard._lastReportData) {
      this.queueOrPostMessage({ command: 'updateReportPane', ...WelcomeDashboard._lastReportData });
    }
  }

  public showCertificatePane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'certificate';
    this.queueOrPostMessage({ command: 'showCertificatePane' });
  }

  public showCodeMapPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'codemap';
    this.queueOrPostMessage({ command: 'showCodeMapPane' });
    this.sendCodeMapData();
  }

  private sendCodeMapData() {
    // Build a list of candidate roots where a codemap might live.
    const serverState = getServerState();
    const report = serverState.currentReport as any;
    const roots: string[] = [];
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (workspace) { roots.push(workspace.uri.fsPath); }
    if (report?.projectRoot) { roots.push(report.projectRoot); }
    if (report?.projectPath) { roots.push(report.projectPath); }

    let chosenRoot: string | undefined;
    let raw: any;
    for (const root of roots) {
      if (!root) continue;
      const mapPath = path.join(root, '.simplebeacon', 'codemap.json');
      if (fs.existsSync(mapPath)) {
        try {
          raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
          chosenRoot = root;
          break;
        } catch { /* try next root */ }
      }
    }

    if (!raw || !chosenRoot) {
      // Nothing on disk; fall back to any cached payload.
      if (WelcomeDashboard._lastCodeMapData) {
        this.queueOrPostMessage({ command: 'updateCodeMapPane', ...WelcomeDashboard._lastCodeMapData });
      }
      return;
    }

    try {
      const languages = Array.isArray(raw.languages)
        ? raw.languages.map((l: any) => l.extension || l.lang || l.name || '').filter(Boolean).join(', ')
        : '--';
      const graph = raw.dependencyGraph || { nodes: [], edges: [] };

      // Load the saved tree if available; fall back to an empty tree.
      let tree: any[] = [];
      const treePath = path.join(chosenRoot, '.simplebeacon', 'codemap-tree.json');
      if (fs.existsSync(treePath)) {
        try {
          const treeRaw = JSON.parse(fs.readFileSync(treePath, 'utf8'));
          tree = Array.isArray(treeRaw.tree) ? treeRaw.tree : [];
        } catch { /* ignore */ }
      }

      // Build a synthetic file list so the language bar chart can render.
      const list: any[] = [];
      if (Array.isArray(raw.languages)) {
        for (const lang of raw.languages) {
          const ext = String(lang.extension || lang.name || '');
          const count = Number(lang.count || 1);
          if (!ext || count <= 0) continue;
          for (let i = 0; i < count; i++) {
            list.push({ ext, name: ext + (i + 1), path: ext + (i + 1), lines: 0, size: 0, deps: 0 });
          }
        }
      }

      const data = {
        status: 'Generated',
        files: String(raw.totalFiles || 0),
        languages,
        modules: String(graph.nodes?.length || 0),
        arch: raw.architecture || '--',
        graph,
        tree,
        list,
        severity: { critical: 0, high: 0, medium: 0, low: 0 },
        repoFiles: String(raw.totalFiles || 0),
        totalLines: String(raw.totalLines || 0),
        lastScan: raw.generatedAt || new Date().toLocaleString(),
        cycles: raw.cycles || [],
        entryPoints: raw.entryPoints || [],
        leafModules: raw.leafModules || [],
        mostConnected: raw.mostConnected || []
      };

      let codeMapUri: string | undefined;
      const mapHtmlPath = path.join(chosenRoot, '.simplebeacon', 'codemap.html');
      if (fs.existsSync(mapHtmlPath)) {
        const sbUri = vscode.Uri.file(path.join(chosenRoot, '.simplebeacon'));
        const currentRoots = this.panel.webview.options.localResourceRoots || [];
        const alreadyAllowed = currentRoots.some(r => r.fsPath === sbUri.fsPath);
        if (!alreadyAllowed) {
          this.panel.webview.options = {
            ...this.panel.webview.options,
            localResourceRoots: [...currentRoots, sbUri]
          };
        }
        codeMapUri = this.panel.webview.asWebviewUri(vscode.Uri.file(mapHtmlPath)).toString();
      }

      const dataWithUri = { ...data, codeMapUri };
      WelcomeDashboard._lastCodeMapData = dataWithUri;
      this.queueOrPostMessage({ command: 'updateCodeMapPane', ...dataWithUri });
    } catch (e) {
      console.error('[SimpleBeacon] sendCodeMapData disk load error:', e);
      if (WelcomeDashboard._lastCodeMapData) {
        this.queueOrPostMessage({ command: 'updateCodeMapPane', ...WelcomeDashboard._lastCodeMapData });
      }
    }
  }

  public showRoadmapPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'roadmap';
    this.queueOrPostMessage({ command: 'showRoadmapPane' });
    if (WelcomeDashboard._lastRoadmapData) {
      this.queueOrPostMessage({ command: 'updateRoadmapPane', ...WelcomeDashboard._lastRoadmapData });
    }
  }

  public showAiContextPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'aicontext';
    this.queueOrPostMessage({ command: 'showAiContextPane' });
  }

  public showUploadPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'upload';
    this.queueOrPostMessage({ command: 'showUploadPane' });
  }

  public showAuditPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'audit';
    this.queueOrPostMessage({ command: 'showAuditPane' });
  }

  public showSecurityPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'security';
    this.queueOrPostMessage({ command: 'showSecurityPane' });
    if (WelcomeDashboard._lastSecurityData) {
      this.queueOrPostMessage({ command: 'updateSecurityPane', ...WelcomeDashboard._lastSecurityData });
    }
  }

  public showTrustPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'trust';
    this.queueOrPostMessage({ command: 'showTrustPane' });
    if (WelcomeDashboard._lastTrustData) {
      this.queueOrPostMessage({ command: 'updateTrustPane', ...WelcomeDashboard._lastTrustData });
    }
  }

  public showQualityPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'quality';
    this.queueOrPostMessage({ command: 'showQualityPane' });
    if (WelcomeDashboard._lastQualityData) {
      this.queueOrPostMessage({ command: 'updateQualityPane', ...WelcomeDashboard._lastQualityData });
    }
  }

  public showAssessmentsPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'assessments';
    this.queueOrPostMessage({ command: 'showAssessmentsPane' });
  }

  public showPlatformPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'platform';
    this.queueOrPostMessage({ command: 'showPlatformPane' });
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || 'No workspace';
    this.queueOrPostMessage({
      command: 'updatePlatformPane',
      version: this.version,
      engine: 'VS Code',
      uptime: 'Active',
      status: 'Connected',
      os: process.platform,
      node: process.version,
      ext: this.version,
      workspace: workspace,
      badge: 'Online'
    });
  }

  public showProfilePane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'profile';
    const config = getSbConfig();
    this.queueOrPostMessage({ command: 'showProfilePane' });
    this.queueOrPostMessage({
      command: 'updateProfilePane',
      name: config.get('profileName', '') || '',
      email: config.get('profileEmail', '') || '',
      role: config.get('profileRole', '') || '',
      org: config.get('profileOrg', '') || ''
    });
  }

  public showCompliancePane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'compliance';
    this.queueOrPostMessage({ command: 'showCompliancePane' });
    if (WelcomeDashboard._lastComplianceData) {
      this.queueOrPostMessage({ command: 'updateCompliancePane', ...WelcomeDashboard._lastComplianceData });
    }
  }

  public showRepoHealthPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'repohealth';
    this.queueOrPostMessage({ command: 'showRepoHealthPane' });
    if (WelcomeDashboard._lastRepoHealthData) {
      this.queueOrPostMessage({ command: 'updateRepoHealthPane', ...WelcomeDashboard._lastRepoHealthData });
    }
  }

  public showAnalyticsPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'analytics';
    this.queueOrPostMessage({ command: 'showAnalyticsPane' });
    if (WelcomeDashboard._lastAnalyticsData) {
      this.queueOrPostMessage({ command: 'updateAnalyticsPane', ...WelcomeDashboard._lastAnalyticsData });
    }
  }

  public showTeamPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'team';
    this.queueOrPostMessage({ command: 'showTeamPane' });
    if (WelcomeDashboard._lastTeamData) {
      this.queueOrPostMessage({ command: 'updateTeamPane', ...WelcomeDashboard._lastTeamData });
    }
  }

  public showScanPane() {
    this.panel.reveal();
    WelcomeDashboard._lastPane = 'scan';
    this.queueOrPostMessage({ command: 'showScanPane' });
    if (WelcomeDashboard._lastScanData) {
      this.queueOrPostMessage({ command: 'updateScanPane', ...WelcomeDashboard._lastScanData });
    }
  }

  public reveal(column?: vscode.ViewColumn) {
    this.panel.reveal(column);
  }

  public updateDashboard(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any[] }) {
    this.panel.webview.postMessage({ command: 'updateDashboard', ...data });
  }

  public updateAnalyzePane(data: { lastAnalysis?: string; findings?: any; score?: string; gate?: string; issues?: string; files?: string; severity?: any; }) {
    this.panel.webview.postMessage({ command: 'updateAnalyzePane', ...data });
  }

  public updateReportPane(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any; totalScans?: string; lastAnalysis?: string }) {
    this.panel.webview.postMessage({ command: 'updateReportPane', ...data });
  }

  public updateCertificatePane(data: { status?: string; score?: string; modules?: string; date?: string; expiry?: string; gate?: string; severity?: any; requirements?: any[]; previewText?: string }) {
    this.panel.webview.postMessage({ command: 'updateCertificatePane', ...data });
  }

  static updateCertificatePaneIfOpen(data: { status?: string; score?: string; modules?: string; date?: string; expiry?: string; gate?: string; severity?: any; requirements?: any[]; previewText?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateCertificatePane(data);
    }
  }

  public updateCodeMapPane(data: { status?: string; files?: string; languages?: string; modules?: string; arch?: string; graph?: { nodes: any[]; edges: any[] }; tree?: any[]; list?: any[]; severity?: any; repoFiles?: string; totalLines?: string; lastScan?: string; cycles?: any[]; entryPoints?: string[]; leafModules?: string[]; mostConnected?: { name: string; count: number }[] }) {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    let codeMapUri: string | undefined;
    if (workspace) {
      const mapHtmlPath = path.join(workspace.uri.fsPath, '.simplebeacon', 'codemap.html');
      if (fs.existsSync(mapHtmlPath)) {
        const sbUri = vscode.Uri.joinPath(workspace.uri, '.simplebeacon');
        const currentRoots = this.panel.webview.options.localResourceRoots || [];
        const alreadyAllowed = currentRoots.some(r => r.fsPath === sbUri.fsPath);
        if (!alreadyAllowed) {
          this.panel.webview.options = {
            ...this.panel.webview.options,
            localResourceRoots: [...currentRoots, sbUri]
          };
        }
        codeMapUri = this.panel.webview.asWebviewUri(vscode.Uri.file(mapHtmlPath)).toString();
      }
    }
    WelcomeDashboard._lastCodeMapData = { ...data, codeMapUri };
    this.panel.webview.postMessage({ command: 'updateCodeMapPane', ...data, codeMapUri });
  }

  static updateCodeMapPaneIfOpen(data: { status?: string; files?: string; languages?: string; modules?: string; arch?: string; graph?: { nodes: any[]; edges: any[] }; tree?: any[]; list?: any[]; severity?: any; repoFiles?: string; totalLines?: string; lastScan?: string; cycles?: any[]; entryPoints?: string[]; leafModules?: string[]; mostConnected?: { name: string; count: number }[] }) {
    // Always cache the data so showCodeMapPane can display it even if panel was closed during generation
    WelcomeDashboard._lastCodeMapData = { ...WelcomeDashboard._lastCodeMapData, ...data };
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateCodeMapPane(data);
    }
  }

  static getLastCodeMapData() {
    return WelcomeDashboard._lastCodeMapData;
  }

  public updateRoadmapPane(data: { open?: string; risk?: string; done?: string; target?: string; status?: string; severity?: any; findings?: Array<{ title?: string; severity?: string; type?: string; file?: string; line?: number }> }) {
    this.panel.webview.postMessage({ command: 'updateRoadmapPane', ...data });
  }

  static updateRoadmapPaneIfOpen(data: { open?: string; risk?: string; done?: string; target?: string; status?: string; severity?: any; findings?: Array<{ title?: string; severity?: string; type?: string; file?: string; line?: number }> }) {
    WelcomeDashboard._lastRoadmapData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateRoadmapPane(data);
    }
  }

  public updateAiContextPane(data: { files?: string; issues?: string; score?: string; severity?: any; status?: string; models?: string; aiFindings?: any[]; aiModels?: any[] }) {
    this.panel.webview.postMessage({ command: 'updateAiContextPane', ...data });
  }

  static updateAiContextPaneIfOpen(data: { files?: string; issues?: string; score?: string; severity?: any; status?: string; models?: string; aiFindings?: any[]; aiModels?: any[] }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateAiContextPane(data);
    }
  }

  public updateUploadPane(data: { status?: string; files?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateUploadPane', ...data });
  }

  static updateUploadPaneIfOpen(data: { status?: string; files?: string; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateUploadPane(data);
    }
  }

  public updateAuditPane(data: { vulnerabilities?: string; secrets?: string; passed?: string; score?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; catSecrets?: string; catVulns?: string; catSmells?: string; catCompliance?: string; findings?: any[]; recommendations?: any[]; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateAuditPane', ...data });
  }

  static updateAuditPaneIfOpen(data: { vulnerabilities?: string; secrets?: string; passed?: string; score?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; catSecrets?: string; catVulns?: string; catSmells?: string; catCompliance?: string; findings?: any[]; recommendations?: any[]; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateAuditPane(data);
    }
  }

  public updateSecurityPane(data: { critical?: string; high?: string; medium?: string; low?: string; score?: string; status?: string; findings?: any[]; gate?: string; repoFiles?: string; gateChecked?: string; lastScan?: string }) {
    this.panel.webview.postMessage({ command: 'updateSecurityPane', ...data });
  }

  static updateSecurityPaneIfOpen(data: { critical?: string; high?: string; medium?: string; low?: string; score?: string; status?: string; findings?: any[]; gate?: string; repoFiles?: string; gateChecked?: string; lastScan?: string }) {
    WelcomeDashboard._lastSecurityData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateSecurityPane(data);
    }
  }

  public updateTrustPane(data: { trustScore?: string; verified?: string; warnings?: string; lastAudit?: string; status?: string; quality?: string; security?: string; compliance?: string; dependencies?: string; severity?: any; factors?: any[]; badges?: any[]; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateTrustPane', ...data });
  }

  static updateTrustPaneIfOpen(data: { trustScore?: string; verified?: string; warnings?: string; lastAudit?: string; status?: string; quality?: string; security?: string; compliance?: string; dependencies?: string; severity?: any; factors?: any[]; badges?: any[]; gate?: string }) {
    WelcomeDashboard._lastTrustData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateTrustPane(data);
    }
  }

  static getLastTrustData() {
    return WelcomeDashboard._lastTrustData;
  }

  public updateQualityPane(data: { qualityScore?: string; issues?: string; coverage?: string; files?: string; status?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateQualityPane', ...data });
  }

  static updateQualityPaneIfOpen(data: { qualityScore?: string; issues?: string; coverage?: string; files?: string; status?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; gate?: string }) {
    WelcomeDashboard._lastQualityData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateQualityPane(data);
    }
  }

  public updateAssessmentsPane(data: { completed?: string; pending?: string; progress?: string; total?: string; status?: string; security?: string; quality?: string; compliance?: string; documentation?: string; severity?: any; checklist?: any[]; qualityScore?: string; issues?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateAssessmentsPane', ...data });
  }

  static updateAssessmentsPaneIfOpen(data: { completed?: string; pending?: string; progress?: string; total?: string; status?: string; security?: string; quality?: string; compliance?: string; documentation?: string; severity?: any; checklist?: any[]; qualityScore?: string; issues?: string; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateAssessmentsPane(data);
    }
  }

  public updatePlatformPane(data: { version?: string; engine?: string; uptime?: string; status?: string; os?: string; node?: string; ext?: string; workspace?: string; badge?: string; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updatePlatformPane', ...data });
  }

  static updatePlatformPaneIfOpen(data: { version?: string; engine?: string; uptime?: string; status?: string; os?: string; node?: string; ext?: string; workspace?: string; badge?: string; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updatePlatformPane(data);
    }
  }

  public updateProfilePane(data: { name?: string; email?: string; role?: string; org?: string; scans?: string; reports?: string; issues?: string; avgScore?: string; qualityScore?: string; autoScan?: boolean; notifications?: boolean; darkMode?: boolean; severity?: any; activity?: any[]; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateProfilePane', ...data });
  }

  static updateProfilePaneIfOpen(data: { name?: string; email?: string; role?: string; org?: string; scans?: string; reports?: string; issues?: string; avgScore?: string; qualityScore?: string; autoScan?: boolean; notifications?: boolean; darkMode?: boolean; severity?: any; activity?: any[]; gate?: string }) {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateProfilePane(data);
    }
  }

  public updateCompliancePane(data: { passed?: string; failed?: string; progress?: string; total?: string; status?: string; rules?: any[]; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateCompliancePane', ...data });
  }

  static updateCompliancePaneIfOpen(data: { passed?: string; failed?: string; progress?: string; total?: string; status?: string; rules?: any[]; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    WelcomeDashboard._lastComplianceData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateCompliancePane(data);
    }
  }

  public updateRepoHealthPane(data: { score?: string; qualityScore?: string; gate?: string; issues?: string; files?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; findings?: any[]; recommendations?: any[] }) {
    this.panel.webview.postMessage({ command: 'updateRepoHealthPane', ...data });
  }

  static updateRepoHealthPaneIfOpen(data: { score?: string; qualityScore?: string; gate?: string; issues?: string; files?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; findings?: any[]; recommendations?: any[] }) {
    WelcomeDashboard._lastRepoHealthData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateRepoHealthPane(data);
    }
  }

  public updateAnalyticsPane(data: { scans?: string; issues?: string; avgScore?: string; lastScan?: string; trend?: string; issueTrend?: string; status?: string; severity?: any; qualityScore?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateAnalyticsPane', ...data });
  }

  static updateAnalyticsPaneIfOpen(data: { scans?: string; issues?: string; avgScore?: string; lastScan?: string; trend?: string; issueTrend?: string; status?: string; severity?: any; qualityScore?: string; gate?: string }) {
    WelcomeDashboard._lastAnalyticsData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateAnalyticsPane(data);
    }
  }

  public updateTeamPane(data: { members?: string; scans?: string; resolved?: string; score?: string; status?: string; membersList?: any[]; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateTeamPane', ...data });
  }

  static updateTeamPaneIfOpen(data: { members?: string; scans?: string; resolved?: string; score?: string; status?: string; membersList?: any[]; severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
    WelcomeDashboard._lastTeamData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateTeamPane(data);
    }
  }

  public updateScanPane(data: { total?: string; issues?: string; fixed?: string; score?: string; qualityScore?: string; status?: string; scanning?: boolean; hasResults?: boolean; progress?: string; critical?: string; high?: string; medium?: string; low?: string; results?: any[]; history?: any[]; gate?: string }) {
    this.panel.webview.postMessage({ command: 'updateScanPane', ...data });
  }

  static updateScanPaneIfOpen(data: { total?: string; issues?: string; fixed?: string; score?: string; qualityScore?: string; status?: string; scanning?: boolean; hasResults?: boolean; progress?: string; critical?: string; high?: string; medium?: string; low?: string; results?: any[]; history?: any[]; gate?: string }) {
    WelcomeDashboard._lastScanData = data;
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.updateScanPane(data);
    }
  }

  /** Push many pane updates in one webview message to avoid extension-host stalls. */
  private static _pendingBatchPanes: Record<string, Record<string, unknown>> = {};
  private static _batchFlushTimer: ReturnType<typeof setTimeout> | undefined;
  private static _hasAutoOpenedDashboard = false;

  static hasLoadedScanGate(): boolean {
    const gate = String(WelcomeDashboard._lastDashboardData?.gate || '').trim().toUpperCase();
    return gate !== '' && gate !== 'PENDING' && gate !== '--';
  }

  static buildCachedPanesPayload(): Record<string, Record<string, unknown>> {
    const panes: Record<string, Record<string, unknown>> = {};
    if (WelcomeDashboard._lastDashboardData) { panes.dashboard = WelcomeDashboard._lastDashboardData; }
    if (WelcomeDashboard._lastAnalyzeData) { panes.analyze = WelcomeDashboard._lastAnalyzeData; }
    if (WelcomeDashboard._lastReportData) { panes.report = WelcomeDashboard._lastReportData; }
    if (WelcomeDashboard._lastRoadmapData) { panes.roadmap = WelcomeDashboard._lastRoadmapData; }
    if (WelcomeDashboard._lastSecurityData) { panes.security = WelcomeDashboard._lastSecurityData; }
    if (WelcomeDashboard._lastTrustData) { panes.trust = WelcomeDashboard._lastTrustData; }
    if (WelcomeDashboard._lastQualityData) { panes.quality = WelcomeDashboard._lastQualityData; }
    if (WelcomeDashboard._lastComplianceData) { panes.compliance = WelcomeDashboard._lastComplianceData; }
    if (WelcomeDashboard._lastAnalyticsData) { panes.analytics = WelcomeDashboard._lastAnalyticsData; }
    if (WelcomeDashboard._lastTeamData) { panes.team = WelcomeDashboard._lastTeamData; }
    if (WelcomeDashboard._lastRepoHealthData) { panes.repoHealth = WelcomeDashboard._lastRepoHealthData; }
    if (WelcomeDashboard._lastScanData) { panes.scan = WelcomeDashboard._lastScanData; }
    if (WelcomeDashboard._lastCodeMapData) { panes.codemap = WelcomeDashboard._lastCodeMapData as Record<string, unknown>; }
    return panes;
  }

  static maybeAutoOpenDashboard(panel?: WelcomeDashboard) {
    const active = panel || WelcomeDashboard.currentPanel;
    if (!active || WelcomeDashboard._hasAutoOpenedDashboard) { return; }
    const showWelcome = getSbConfig().get<boolean>('showWelcomeOnLoad', true);
    if (showWelcome || !WelcomeDashboard.hasLoadedScanGate()) { return; }
    WelcomeDashboard._hasAutoOpenedDashboard = true;
    active.showDashboardPane();
  }

  static batchUpdatePanesIfOpen(panes: Record<string, Record<string, unknown>>) {
    if (panes.dashboard) { WelcomeDashboard._lastDashboardData = panes.dashboard as typeof WelcomeDashboard._lastDashboardData; }
    if (panes.report) { WelcomeDashboard._lastReportData = panes.report as typeof WelcomeDashboard._lastReportData; }
    if (panes.roadmap) { WelcomeDashboard._lastRoadmapData = panes.roadmap as typeof WelcomeDashboard._lastRoadmapData; }
    if (panes.security) { WelcomeDashboard._lastSecurityData = panes.security as typeof WelcomeDashboard._lastSecurityData; }
    if (panes.trust) { WelcomeDashboard._lastTrustData = panes.trust as typeof WelcomeDashboard._lastTrustData; }
    if (panes.quality) { WelcomeDashboard._lastQualityData = panes.quality as typeof WelcomeDashboard._lastQualityData; }
    if (panes.compliance) { WelcomeDashboard._lastComplianceData = panes.compliance as typeof WelcomeDashboard._lastComplianceData; }
    if (panes.repoHealth) { WelcomeDashboard._lastRepoHealthData = panes.repoHealth as typeof WelcomeDashboard._lastRepoHealthData; }
    if (panes.team) { WelcomeDashboard._lastTeamData = panes.team as typeof WelcomeDashboard._lastTeamData; }
    if (panes.scan) { WelcomeDashboard._lastScanData = panes.scan as typeof WelcomeDashboard._lastScanData; }
    if (panes.analytics) { WelcomeDashboard._lastAnalyticsData = panes.analytics as typeof WelcomeDashboard._lastAnalyticsData; }
    if (panes.analyze) { WelcomeDashboard._lastAnalyzeData = panes.analyze as typeof WelcomeDashboard._lastAnalyzeData; }
    if (panes.codemap) { WelcomeDashboard._lastCodeMapData = panes.codemap as typeof WelcomeDashboard._lastCodeMapData; }
    const panel = WelcomeDashboard.currentPanel;
    if (!panel || Object.keys(panes).length === 0) { return; }
    WelcomeDashboard._pendingBatchPanes = { ...WelcomeDashboard._pendingBatchPanes, ...panes };
    if (WelcomeDashboard._batchFlushTimer) {
      clearTimeout(WelcomeDashboard._batchFlushTimer);
    }
    WelcomeDashboard._batchFlushTimer = setTimeout(() => {
      WelcomeDashboard._batchFlushTimer = undefined;
      const merged = WelcomeDashboard._pendingBatchPanes;
      WelcomeDashboard._pendingBatchPanes = {};
      const active = WelcomeDashboard.currentPanel;
      if (!active || Object.keys(merged).length === 0) { return; }
      active.queueOrPostMessage({ command: 'updateAllPanes', panes: merged });
      WelcomeDashboard.maybeAutoOpenDashboard(active);
    }, 400);
  }

  private isReady = false;
  private messageQueue: Array<{ command: string; [key: string]: unknown }> = [];

  private flushMessageQueue() {
    if (!this.panel?.webview) {
      this.messageQueue = [];
      return;
    }
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        try {
          void this.panel.webview.postMessage(msg);
        } catch {
          break;
        }
      }
    }
  }

  private queueOrPostMessage(msg: { command: string; [key: string]: unknown }) {
    if (!this.panel?.webview) { return; }
    if (this.messageQueue.length > 48) {
      this.messageQueue = this.messageQueue.slice(-24);
    }
    if (this.isReady) {
      try {
        void this.panel.webview.postMessage(msg);
      } catch { /* panel disposed */ }
    } else {
      this.messageQueue.push(msg);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri) {
    this.panel = panel;
    this.extUri = extUri;
    this.version = getVersionFromExtUri(extUri);
    this.authManager = new AuthManager({ secrets: { get: ()=>Promise.resolve(''), store: ()=>Promise.resolve(), delete: ()=>Promise.resolve() }, globalState: { get: ()=>undefined, update: ()=>Promise.resolve() } } as any);
    this.panel.onDidDispose(
      () => {
        WelcomeDashboard.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'ready') {
        this.isReady = true;
        const cached = WelcomeDashboard.buildCachedPanesPayload();
        // Proactively load code map from disk if not cached (e.g. after extension reload)
        if (!WelcomeDashboard._lastCodeMapData) {
          try {
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (ws) {
              const mapPath = path.join(ws.uri.fsPath, '.simplebeacon', 'codemap.json');
              if (fs.existsSync(mapPath)) {
                const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                const graph = raw.dependencyGraph || { nodes: [], edges: [] };
                const languages = Array.isArray(raw.languages)
                  ? raw.languages.map((l: any) => l.extension || l.lang || l.name || '').filter(Boolean).join(', ')
                  : '--';
                WelcomeDashboard._lastCodeMapData = {
                  status: 'Generated',
                  files: String(raw.totalFiles || 0),
                  languages,
                  modules: String(graph.nodes?.length || 0),
                  arch: raw.architecture || '--',
                  graph,
                  tree: [],
                  list: [],
                  severity: { critical: 0, high: 0, medium: 0, low: 0 },
                  repoFiles: String(raw.totalFiles || 0),
                  totalLines: String(raw.totalLines || 0),
                  lastScan: raw.generatedAt || new Date().toLocaleString(),
                  cycles: raw.cycles || [],
                  entryPoints: raw.entryPoints || [],
                  leafModules: raw.leafModules || [],
                  mostConnected: raw.mostConnected || []
                };
                cached.codemap = WelcomeDashboard._lastCodeMapData as Record<string, unknown>;
              }
            }
          } catch (e) {
            console.error('[SimpleBeacon] ready handler codemap load error:', e);
          }
        }
        if (Object.keys(cached).length > 0) {
          this.queueOrPostMessage({ command: 'updateAllPanes', panes: cached });
        }
        this.flushMessageQueue();
        WelcomeDashboard.maybeAutoOpenDashboard(this);
        return;
      }
      const config = getSbConfig();
      switch (msg.command) {
        case 'updateShowWelcome':
          await config.update('showWelcomeOnLoad', msg.value, true);
          break;
        case 'openSettings':
          this.showSettingsPane();
          break;
        case 'openDashboard':
          this.showDashboardPane();
          vscode.commands.executeCommand('simplebeacon-modern.focus');
          setTimeout(() => {
            postSidebarMessage({ command: 'switchSidebarTab', tab: 'dashboard' });
          }, 300);
          break;
        case 'openDashboardInBrowser':
          this.showDashboardPane();
          break;
        case 'openMainWindow': {
          const targetPanel = WelcomeDashboard.createOrShow(this.extUri, true);
          if (targetPanel) {
            if (msg.route || msg.path) {
              WelcomeDashboard.showPaneIfOpen(msg.route || msg.path || '/dashboard');
            } else {
              targetPanel.showDashboardPane();
            }
          }
          vscode.commands.executeCommand('simplebeacon-modern.focus');
          setTimeout(() => {
            postSidebarMessage({ command: 'switchSidebarTab', tab: 'dashboard' });
          }, 300);
          break;
        }
        case 'openTeamDashboard':
          this.showTeamPane();
          vscode.commands.executeCommand('simplebeacon-modern.focus');
          setTimeout(() => {
            postSidebarMessage({ command: 'switchSidebarTab', tab: 'team' });
          }, 300);
          break;
        case 'openTeamDashboardInIDE':
          this.showTeamPane();
          break;
        case 'openPreviewInBrowser': {
          openSidebarPreview();
          break;
        }
        case 'openExternal': {
          const extUrl = msg.url || '';
          if (extUrl) {
            try {
              const parsed = new URL(extUrl);
              const isSimpleBeaconDashboard = /simplebeacon\.ai/i.test(parsed.hostname) && parsed.pathname.startsWith('/dashboard/');
              if (isSimpleBeaconDashboard) {
                const baseUrl = `${parsed.protocol}//${parsed.host}`;
                const extraQuery = parsed.search ? parsed.search.slice(1) : '';
                openTeamDashboardPanel(this.extUri, parsed.pathname, 'SimpleBeacon Dashboard', baseUrl, extraQuery);
                break;
              }
            } catch { /* ignore invalid URL; fall through to simpleBrowser */ }
            const resolved = extUrl.startsWith('http')
              ? extUrl
              : `http://127.0.0.1:${getDataServerPort()}${extUrl.startsWith('/') ? extUrl : '/' + extUrl}`;
            vscode.commands.executeCommand('simpleBrowser.show', resolved);
          }
          break;
        }
        case 'openAnalyze':
          this.showAnalyzePane();
          break;
        case 'openReport':
          this.showReportPane();
          break;
        case 'openCertificate':
          this.showCertificatePane();
          break;
        case 'openCodeMap':
          this.showCodeMapPane();
          break;
        case 'getCodeMapData':
          this.sendCodeMapData();
          break;
        case 'openRoadmap':
          this.showRoadmapPane();
          break;
        case 'openAiContext':
          this.showAiContextPane();
          break;
        case 'openUpload':
          this.showUploadPane();
          break;
        case 'openAudit':
          this.showAuditPane();
          break;
        case 'openSecurity':
          this.showSecurityPane();
          break;
        case 'openTrust':
          this.showTrustPane();
          break;
        case 'openQuality':
          this.showQualityPane();
          break;
        case 'openAssessments':
          this.showAssessmentsPane();
          break;
        case 'openPlatform':
          this.showPlatformPane();
          break;
        case 'openProfile':
          this.showProfilePane();
          break;
        case 'saveProfile':
          await config.update('profileName', msg.name || '', true);
          await config.update('profileEmail', msg.email || '', true);
          await config.update('profileRole', msg.role || '', true);
          await config.update('profileOrg', msg.org || '', true);
          showQuietMessage('Profile saved');
          break;
        case 'updateProfileAutoScan':
          await config.update('autoScanOnOpen', !!msg.value, true);
          break;
        case 'updateProfileNotify':
          await config.update('notifyScanComplete', !!msg.value, true);
          break;
        case 'updateProfileDarkMode':
          await config.update('displayMode', msg.value ? 'dark' : 'light', true);
          break;
        case 'openCompliance':
          this.showCompliancePane();
          break;
        case 'openRepoHealth':
          this.showRepoHealthPane();
          break;
        case 'openAnalytics':
          this.showAnalyticsPane();
          break;
        case 'openTeam':
          this.showTeamPane();
          break;
        case 'inviteTeamMember':
          showQuietMessage('Invite sent to ' + (msg.email || '') + ' as ' + (msg.role || 'viewer'));
          break;
        case 'openScan':
          this.showScanPane();
          break;
        case 'dashboard':
          this.showDashboardPane();
          break;
        case 'report':
          this.showReportPane();
          break;
        case 'preview':
          WelcomeDashboard.createOrShow(this.extUri, true);
          break;
        case 'openClear':
          vscode.commands.executeCommand('simplebeacon.clearResults');
          break;
        case 'scan': {
          const scanPath = msg.path;
          vscode.commands.executeCommand('simplebeacon.scanWorkspace', {
            projectPath: scanPath,
            mode: msg.mode,
            fullDirectory: msg.fullDirectory,
          });
          break;
        }
        case 'analyze': {
          const analyzePath = msg.path || undefined;
          vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', {
            path: analyzePath,
            profile: (msg.analyzeType || msg.profile || 'complete') as ScanProfile,
            selectedModules: msg.analyzers,
            minSeverity: msg.minSeverity
          });
          break;
        }
        case 'browseAnalyzePath': {
          const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select Project Folder' });
          if (uris && uris.length > 0) {
            this.panel.webview.postMessage({ command: 'setAnalyzePath', path: uris[0].fsPath });
          }
          break;
        }
        case 'detectWorkspacePath': {
          const ws = vscode.workspace.workspaceFolders;
          if (ws && ws.length > 0) {
            this.panel.webview.postMessage({ command: 'setAnalyzePath', path: ws[0].uri.fsPath });
          }
          break;
        }
        case 'resolveDroppedTarget': {
          const folderName = msg.name || '';
          let resolvedPath = '';
          // Scan active drive mounts dynamically for the dropped folder name
          if (folderName) {
            const driveLetters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
            for (const letter of driveLetters) {
              const checkPath = `${letter}:\\${folderName}`;
              const cascadePath = `${letter}:\\Users\\Trevor\\CascadeProjects\\${folderName}`;
              if (fs.existsSync(checkPath)) {
                resolvedPath = fs.realpathSync(checkPath);
                break;
              } else if (fs.existsSync(cascadePath)) {
                resolvedPath = fs.realpathSync(cascadePath);
                break;
              }
            }
          }
          // Layer 3: fallback picker if auto-resolve misses
          if (!resolvedPath && folderName) {
            const pickerUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: `Select "${folderName}" location` });
            if (pickerUri && pickerUri[0]) {
              resolvedPath = pickerUri[0].fsPath;
            }
          }
          this.panel.webview.postMessage({ command: 'setAnalyzePath', path: resolvedPath });
          break;
        }
        case 'saveAnalysis':
          showQuietMessage('Save analysis configuration — feature coming soon');
          break;
        case 'exportAnalysis':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'switchAnalysisView':
          this.panel.webview.postMessage({ command: 'switchAnalysisView', view: msg.view });
          break;
        case 'drillDownAnalysis':
          showQuietMessage(`Drill-down: ${msg.dimension} — feature coming soon`);
          break;
        case 'sortAnalysisTable':
          this.panel.webview.postMessage({ command: 'sortAnalysisTable', key: msg.key });
          break;
        case 'toggleAnalysisCompare':
          showQuietMessage(`Compare ${msg.enabled ? 'enabled' : 'disabled'} — feature coming soon`);
          break;
        case 'refreshReport':
          showQuietMessage('Refreshing report data...');
          vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          break;
        case 'exportReport':
        case 'exportScanReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'exportReportPdf':
          vscode.commands.executeCommand('simplebeacon.exportReport', 'pdf');
          break;
        case 'exportReportExcel':
          vscode.commands.executeCommand('simplebeacon.exportReport', 'excel');
          break;
        case 'generateCertificate':
          vscode.commands.executeCommand('simplebeacon.generateCertificate');
          break;
        case 'generateCodeMap':
          vscode.commands.executeCommand('simplebeacon.generateCodeMap');
          break;
        case 'openCodeMapHtml':
          vscode.commands.executeCommand('simplebeacon.openCodeMapHtml');
          break;
        case 'exportCodeMap':
          vscode.commands.executeCommand('simplebeacon.exportCodeMap');
          break;
        case 'refreshCodeMap':
          showQuietMessage('Refreshing code map data...');
          vscode.commands.executeCommand('simplebeacon.generateCodeMap');
          break;
        case 'openFullRoadmap':
          WelcomeDashboard.createOrShow(this.extUri, true)?.showRoadmapPane();
          break;
        case 'exportRoadmap':
          vscode.commands.executeCommand('simplebeacon.exportRoadmap');
          break;
        case 'openFullAiContext':
          vscode.commands.executeCommand('simplebeacon.openAiContext');
          break;
        case 'exportAiContext':
          vscode.commands.executeCommand('simplebeacon.exportAiContext');
          break;
        case 'sendToAI':
          {
            const dataPort = getDataServerPort();
            const body = JSON.stringify(msg.data || {});
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port: dataPort,
                path: '/api/ai-context',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
              },
              (res: http.IncomingMessage) => {
                res.on('data', () => { /* drain response */ });
                res.on('end', () => { /* data server callback will focus AI Coding Agent panel */ });
              }
            );
            req.on('error', (err) => {
              vscode.window.showErrorMessage('Failed to send to AI Coding Agent: ' + err.message);
            });
            req.write(body);
            req.end();
          }
          break;
        case 'openFullUpload':
          vscode.commands.executeCommand('simplebeacon.openUploadPanel');
          break;
        case 'showInfo':
          showQuietMessage(msg.text || 'Info');
          break;
        case 'validateUpload':
          showQuietMessage(msg.fileCount ? `Validated ${msg.fileCount} uploaded file(s)` : 'Validating uploaded files...');
          break;
        case 'scanUploadFiles':
          {
            const files = msg.files || [];
            if (files.length === 0) {
              vscode.window.showWarningMessage('No files uploaded to scan');
              break;
            }
            const tmpDir = path.join(os.tmpdir(), 'simplebeacon-upload-' + Date.now());
            try {
              fs.mkdirSync(tmpDir, { recursive: true });
              for (const f of files) {
                const safeName = path.basename(f.name).replace(/[^a-zA-Z0-9._-]/g, '_');
                fs.writeFileSync(path.join(tmpDir, safeName), f.content || '', 'utf-8');
              }
              vscode.commands.executeCommand('simplebeacon.scanWorkspace', { projectPath: tmpDir, mode: 'full', fullDirectory: true });
            } catch (e) {
              vscode.window.showErrorMessage('Failed to prepare uploaded files for scan: ' + (e instanceof Error ? e.message : String(e)));
            }
          }
          break;
        case 'openFullAudit':
          vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
          break;
        case 'exportAuditReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullSecurity':
          WelcomeDashboard.createOrShow(this.extUri, true)?.showScanPane();
          vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          break;
        case 'exportSecurityReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullTrust':
          this.showReportPane();
          break;
        case 'verifyTrust':
          showQuietMessage('Running trust verification...');
          break;
        case 'exportTrustReport':
          vscode.commands.executeCommand('simplebeacon.exportTrustReport');
          break;
        case 'openFullQuality':
          this.showReportPane();
          break;
        case 'browseQualityPath':
          {
            const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select project folder' });
            if (uris && uris.length > 0) {
              this.panel.webview.postMessage({ command: 'setQualityPath', path: uris[0].fsPath });
            }
          }
          break;
        case 'detectQualityPath':
          {
            const ws = vscode.workspace.workspaceFolders;
            if (ws && ws.length > 0) {
              this.panel.webview.postMessage({ command: 'setQualityPath', path: ws[0].uri.fsPath });
            } else {
              vscode.window.showWarningMessage('No workspace folder open');
            }
          }
          break;
        case 'runQualityAnalysis':
          {
            const ws = vscode.workspace.workspaceFolders;
            const targetPath = msg.path || (ws && ws[0] ? ws[0].uri.fsPath : undefined);
            if (!targetPath) {
              vscode.window.showWarningMessage('No project path selected for quality analysis');
              break;
            }
            const profile = (msg.mode || 'quality') as 'quality' | 'complete' | 'gate' | 'security';
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', {
              path: targetPath,
              profile,
              selectedModules: undefined,
              minSeverity: 'low'
            });
          }
          break;
        case 'exportQualityReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullAssessments':
          this.showReportPane();
          break;
        case 'exportAssessmentsReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullPlatform':
          this.showReportPane();
          break;
        case 'refreshPlatform':
          showQuietMessage('Refreshing platform data...');
          break;
        case 'exportPlatformReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openPlatformDocs':
          vscode.commands.executeCommand('simpleBrowser.show', 'https://simplebeacon.ai/docs');
          break;
        case 'openFullProfile':
          this.showReportPane();
          break;
        case 'openFullCompliance':
          this.showReportPane();
          break;
        case 'runComplianceCheck':
          vscode.commands.executeCommand('simplebeacon.enhancedAnalysis', { profile: 'compliance' });
          break;
        case 'exportComplianceReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullRepoHealth':
          this.showReportPane();
          break;
        case 'openFullAnalytics':
          this.showReportPane();
          break;
        case 'refreshAnalytics':
          showQuietMessage('Refreshing analytics...');
          break;
        case 'exportAnalyticsReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullTeam':
          this.showReportPane();
          break;
        case 'inviteTeamMember':
          showQuietMessage('Team invitation feature coming soon');
          break;
        case 'exportTeamReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'openFullScan':
          this.showReportPane();
          break;
        case 'runScan':
          WelcomeDashboard.createOrShow(this.extUri, true)?.showScanPane();
          break;
        case 'exportScanReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'updateDisplayMode':
          await config.update('displayMode', msg.value, true);
          break;
        case 'updateAutoScan':
          await config.update('autoScanOnOpen', msg.value, true);
          break;
        case 'updateBrowserMode':
          await config.update('browserOpenMode', msg.value, true);
          break;
        case 'updateApiUrl':
          await config.update('apiServerUrl', msg.value, true);
          break;
        case 'updateNotifyScan':
          await config.update('notifyScanComplete', msg.value, true);
          break;
        case 'updateNotifyGate':
          await config.update('notifyGateFailure', msg.value, true);
          break;
        case 'testApiConnection':
          {
            const base = normalizeApiServerUrl(msg.value || config.get('apiServerUrl', DEFAULT_API_URL) as string);
            try {
              const resApi = await fetch(base + '/api/health');
              if (resApi.ok) {
                this.panel.webview.postMessage({ command: 'apiConnectionResult', ok: true });
                break;
              }
              const resLegacy = await fetch(base + '/health');
              this.panel.webview.postMessage({ command: 'apiConnectionResult', ok: resLegacy.ok });
            } catch (e) {
              this.panel.webview.postMessage({ command: 'apiConnectionResult', ok: false });
            }
          }
          break;
        case 'resetSettings':
          await config.update('autoScanOnOpen', false, true);
          await config.update('displayMode', 'sidebar', true);
          await config.update('browserOpenMode', 'panel', true);
          await config.update('apiServerUrl', DEFAULT_API_URL, true);
          await config.update('notifyScanComplete', true, true);
          await config.update('notifyGateFailure', true, true);
          await this.authManager.clearToken();
          await this.authManager.clearPassword();
          showQuietMessage('Settings reset to defaults');
          break;
        case 'updateApiToken':
          if (msg.value) { await this.authManager.setToken(String(msg.value)); } else { await this.authManager.clearToken(); }
          break;
        case 'scanWorkspace':
          vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          break;
        case 'showReport':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
        case 'openDashboard40':
          vscode.commands.executeCommand('simplebeacon.openDashboard40');
          break;
        case 'openFileAtLine': {
          let filePath = msg.file;
          const lineNum = Math.max(0, (msg.line || 1) - 1);
          if (!path.isAbsolute(filePath)) {
            const workspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (workspace) {
              filePath = path.join(workspace, filePath);
            }
          }
          if (!fs.existsSync(filePath)) {
            vscode.window.showWarningMessage('File not found: ' + filePath);
            break;
          }
          try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            const editor = await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.One });
            const position = new vscode.Position(lineNum, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
          } catch (e) {
            vscode.window.showErrorMessage('Failed to open file: ' + (e instanceof Error ? e.message : String(e)));
          }
          break;
        }
        case 'signIn':
          // Dashboard webview handles its own sign-in UI (sign-in modal overlay).
          // Do NOT call simplebeacon.signIn here — that shows the IDE input box prompt.
          break;
        case 'setAuthState':
          // Store token in AuthManager so refreshAuthState can verify and forward it
          if (msg.token && msg.signedIn) {
            try { await this.authManager.setToken(String(msg.token)); } catch {}
          }
          // Forward auth state from dashboard to sidebar
          setSidebarAuthState(msg.signedIn === true, msg.tier || '', msg.token ? String(msg.token) : undefined, undefined, msg.isAdmin === true);
          break;
        case 'storeActiveLicenseToken':
          if (msg.token) {
            this.authManager.setToken(String(msg.token));
            setSidebarAuthState(true);
          }
          break;
      }
    });
    this.panel.webview.html = this.buildHtml();
  }

  public buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const config = getSbConfig();
    return buildDashboardHtml({
      cspSource: this.panel.webview.cspSource,
      version: this.version,
      nonce,
      showWelcome: config.get('showWelcomeOnLoad', true)
    });
  }

  public static buildBrowserHtml(report?: Record<string, unknown>): string {
    let html = '';
    if (WelcomeDashboard.currentPanel) {
      html = WelcomeDashboard.currentPanel.buildHtml();
    } else {
      const nonce = crypto.randomBytes(16).toString('hex');
      html = buildDashboardHtml({
        cspSource: "'self'",
        version: 'browser',
        nonce,
        showWelcome: true
      });
    }
    return html;
  }

}
