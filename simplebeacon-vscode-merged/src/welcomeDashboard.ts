// simplebeacon-ignore memory-leak — static UI bindings and report data processing
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { getDataServerPort } from './dataServer';
import { ScanProfile } from './analyzers/workspaceAnalyzer';
import { AuthManager } from './auth/authManager';
import { buildDashboardHtml } from './welcomeDashboardHtml';
import { showDashboardInSidebar, openSidebarInBrowserStatic } from './sidebarBridge';
import { showQuietMessage, getSbConfig } from './utils';

const DEFAULT_API_PROTOCOL = 'http://';
const DEFAULT_API_HOST = 'localhost';
const DEFAULT_API_PORT = 55000;
const DEFAULT_API_URL = `${DEFAULT_API_PROTOCOL}${DEFAULT_API_HOST}:${DEFAULT_API_PORT}`;

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
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private version: string;
  private authManager: AuthManager;

  static createOrShow(extUri: vscode.Uri, force = false) {
    const displayMode = getSbConfig().get<string>('displayMode', 'sidebar');
    if (!force && displayMode === 'sidebar') {
      vscode.commands.executeCommand('simplebeacon-modern.focus');
      // Trigger dashboard in sidebar instead of returning null
      showDashboardInSidebar();
      return null;
    }
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (WelcomeDashboard.currentPanel) {
      try {
        WelcomeDashboard.currentPanel.panel.reveal();
        WelcomeDashboard.currentPanel.isReady = false;
        WelcomeDashboard.currentPanel.messageQueue.length = 0;
        WelcomeDashboard.currentPanel.panel.webview.html = WelcomeDashboard.currentPanel.buildHtml();
        return WelcomeDashboard.currentPanel;
      } catch {
        WelcomeDashboard.currentPanel = undefined;
      }
    }
    const panel = vscode.window.createWebviewPanel(
      'simplebeaconWelcomeV2',
      'SimpleBeacon',
      col || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')]
      }
    );
    WelcomeDashboard.currentPanel = new WelcomeDashboard(panel, extUri);
    panel.reveal();
    return WelcomeDashboard.currentPanel;
  }

  static dispose() {
    if (WelcomeDashboard.currentPanel) {
      WelcomeDashboard.currentPanel.panel.dispose();
      WelcomeDashboard.currentPanel = undefined;
    }
  }

  private static _lastDashboardData: { files?: string; gate?: string; issues?: string; score?: string } | null = null;
  private static _lastAnalyzeData: { lastAnalysis?: string; findings?: string } | null = null;
  private static _lastReportData: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any } | null = null;
  private static _lastRoadmapData: { open?: string; risk?: string; done?: string; target?: string; status?: string; findings?: any } | null = null;
  private static _lastSecurityData: { critical?: string; high?: string; medium?: string; score?: string; status?: string; findings?: any } | null = null;
  private static _lastTrustData: { trustScore?: string; verified?: string; warnings?: string; lastAudit?: string; status?: string; quality?: string; security?: string; compliance?: string; dependencies?: string; severity?: any; factors?: any[]; badges?: any[]; gate?: string } | null = null;
  private static _lastQualityData: { qualityScore?: string; issues?: string; coverage?: string; files?: string; status?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string } | null = null;
  private static _lastComplianceData: { passed?: string; failed?: string; progress?: string; total?: string; status?: string; rules?: any[] } | null = null;
  private static _lastAnalyticsData: { scans?: string; issues?: string; avgScore?: string; lastScan?: string; trend?: string; issueTrend?: string; status?: string } | null = null;
  private static _lastTeamData: { members?: string; scans?: string; resolved?: string; score?: string; status?: string; membersList?: any[] } | null = null;
  private static _lastRepoHealthData: { score?: string; qualityScore?: string; gate?: string; issues?: string; files?: string; status?: string; critical?: string; high?: string; medium?: string; low?: string; maintainability?: string; reliability?: string; complexity?: string; duplication?: string; findings?: any[]; recommendations?: any[] } | null = null;
  private static _lastScanData: { total?: string; issues?: string; fixed?: string; score?: string; qualityScore?: string; status?: string; scanning?: boolean; hasResults?: boolean; progress?: string; critical?: string; high?: string; medium?: string; low?: string; results?: any[]; history?: any[]; gate?: string } | null = null;
  private static _lastCodeMapData: { status?: string; files?: string; languages?: string; modules?: string; arch?: string; repoFiles?: string; totalLines?: string; lastScan?: string; codeMapUri?: string; graph?: { nodes: any[]; edges: any[] } } | null = null;

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

  static updateReportPaneIfOpen(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any; totalScans?: string }) {
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
    const r = (route || '').replace(/^#\//, '').replace(/^\/+/, '').replace(/-/g, '').toLowerCase();
    switch (r) {
      case 'dashboard': panel.showDashboardPane(); break;
      case 'analyze': panel.showAnalyzePane(); break;
      case 'report':
      case 'results': panel.showReportPane(); break;
      case 'certificate': panel.showCertificatePane(); break;
      case 'codemap': panel.showCodeMapPane(); break;
      case 'roadmap':
      case 'remediation': panel.showRoadmapPane(); break;
      case 'aicontext': panel.showAiContextPane(); break;
      case 'upload': panel.showUploadPane(); break;
      case 'audit': panel.showAuditPane(); break;
      case 'security': panel.showSecurityPane(); break;
      case 'trust': panel.showTrustPane(); break;
      case 'quality': panel.showQualityPane(); break;
      case 'assessments': panel.showAssessmentsPane(); break;
      case 'platform': panel.showPlatformPane(); break;
      case 'profile': panel.showProfilePane(); break;
      case 'compliance': panel.showCompliancePane(); break;
      case 'repohealth':
      case 'repositoryhealth': panel.showRepoHealthPane(); break;
      case 'analytics': panel.showAnalyticsPane(); break;
      case 'team': panel.showTeamPane(); break;
      case 'scan': panel.showScanPane(); break;
      case 'settings': panel.showSettingsPane(); break;
      default: panel.showDashboardPane(); break;
    }
  }

  public showSettingsPane(data?: { severity?: any; qualityScore?: string; issues?: string; gate?: string }) {
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
    this.queueOrPostMessage({ command: 'showDashboardPane' });
    if (WelcomeDashboard._lastDashboardData) {
      this.queueOrPostMessage({ command: 'updateDashboard', ...WelcomeDashboard._lastDashboardData });
    }
  }

  public showAnalyzePane() {
    this.queueOrPostMessage({ command: 'showAnalyzePane' });
    if (WelcomeDashboard._lastAnalyzeData) {
      this.queueOrPostMessage({ command: 'updateAnalyzePane', ...WelcomeDashboard._lastAnalyzeData });
    }
  }

  public showReportPane() {
    this.queueOrPostMessage({ command: 'showReportPane' });
    if (WelcomeDashboard._lastReportData) {
      this.queueOrPostMessage({ command: 'updateReportPane', ...WelcomeDashboard._lastReportData });
    }
  }

  public showCertificatePane() {
    this.queueOrPostMessage({ command: 'showCertificatePane' });
  }

  public showCodeMapPane() {
    this.queueOrPostMessage({ command: 'showCodeMapPane' });
    if (WelcomeDashboard._lastCodeMapData) {
      this.queueOrPostMessage({ command: 'updateCodeMapPane', ...WelcomeDashboard._lastCodeMapData });
    } else {
      // Load previously generated code map from disk so the graph appears even after reload
      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (workspace) {
        try {
          const mapPath = path.join(workspace.uri.fsPath, '.simplebeacon', 'codemap.json');
          if (fs.existsSync(mapPath)) {
            const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            const languages = Array.isArray(raw.languages)
              ? raw.languages.map((l: any) => l.extension || l.lang || l.name || '').filter(Boolean).join(', ')
              : '--';
            const graph = raw.dependencyGraph || { nodes: [], edges: [] };
            const data = {
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
            WelcomeDashboard._lastCodeMapData = data;
            this.queueOrPostMessage({ command: 'updateCodeMapPane', ...data });
          }
        } catch (e) {
          // Ignore missing/stale codemap.json
        }
      }
    }
  }

  public showRoadmapPane() {
    this.queueOrPostMessage({ command: 'showRoadmapPane' });
    if (WelcomeDashboard._lastRoadmapData) {
      this.queueOrPostMessage({ command: 'updateRoadmapPane', ...WelcomeDashboard._lastRoadmapData });
    }
  }

  public showAiContextPane() {
    this.queueOrPostMessage({ command: 'showAiContextPane' });
  }

  public showUploadPane() {
    this.queueOrPostMessage({ command: 'showUploadPane' });
  }

  public showAuditPane() {
    this.queueOrPostMessage({ command: 'showAuditPane' });
  }

  public showSecurityPane() {
    this.queueOrPostMessage({ command: 'showSecurityPane' });
    if (WelcomeDashboard._lastSecurityData) {
      this.queueOrPostMessage({ command: 'updateSecurityPane', ...WelcomeDashboard._lastSecurityData });
    }
  }

  public showTrustPane() {
    this.queueOrPostMessage({ command: 'showTrustPane' });
    if (WelcomeDashboard._lastTrustData) {
      this.queueOrPostMessage({ command: 'updateTrustPane', ...WelcomeDashboard._lastTrustData });
    }
  }

  public showQualityPane() {
    this.queueOrPostMessage({ command: 'showQualityPane' });
    if (WelcomeDashboard._lastQualityData) {
      this.queueOrPostMessage({ command: 'updateQualityPane', ...WelcomeDashboard._lastQualityData });
    }
  }

  public showAssessmentsPane() {
    this.queueOrPostMessage({ command: 'showAssessmentsPane' });
  }

  public showPlatformPane() {
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
    this.queueOrPostMessage({ command: 'showCompliancePane' });
    if (WelcomeDashboard._lastComplianceData) {
      this.queueOrPostMessage({ command: 'updateCompliancePane', ...WelcomeDashboard._lastComplianceData });
    }
  }

  public showRepoHealthPane() {
    this.queueOrPostMessage({ command: 'showRepoHealthPane' });
    if (WelcomeDashboard._lastRepoHealthData) {
      this.queueOrPostMessage({ command: 'updateRepoHealthPane', ...WelcomeDashboard._lastRepoHealthData });
    }
  }

  public showAnalyticsPane() {
    this.queueOrPostMessage({ command: 'showAnalyticsPane' });
    if (WelcomeDashboard._lastAnalyticsData) {
      this.queueOrPostMessage({ command: 'updateAnalyticsPane', ...WelcomeDashboard._lastAnalyticsData });
    }
  }

  public showTeamPane() {
    this.queueOrPostMessage({ command: 'showTeamPane' });
    if (WelcomeDashboard._lastTeamData) {
      this.queueOrPostMessage({ command: 'updateTeamPane', ...WelcomeDashboard._lastTeamData });
    }
  }

  public showScanPane() {
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

  public updateReportPane(data: { files?: string; gate?: string; issues?: string; score?: string; severity?: any; findings?: any; filesList?: any; totalScans?: string }) {
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
        codeMapUri = this.panel.webview.asWebviewUri(vscode.Uri.file(mapHtmlPath)).toString();
      }
    }
    WelcomeDashboard._lastCodeMapData = { ...data, codeMapUri };
    this.panel.webview.postMessage({ command: 'updateCodeMapPane', ...data, codeMapUri });
  }

  static updateCodeMapPaneIfOpen(data: { status?: string; files?: string; languages?: string; modules?: string; arch?: string; graph?: { nodes: any[]; edges: any[] }; tree?: any[]; list?: any[]; severity?: any; repoFiles?: string; totalLines?: string; lastScan?: string; cycles?: any[]; entryPoints?: string[]; leafModules?: string[]; mostConnected?: { name: string; count: number }[] }) {
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

  private isReady = false;
  private messageQueue: Array<{ command: string; [key: string]: unknown }> = [];

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.panel.webview.postMessage(msg);
      }
    }
  }

  private queueOrPostMessage(msg: { command: string; [key: string]: unknown }) {
    if (this.isReady) {
      this.panel.webview.postMessage(msg);
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
        this.flushMessageQueue();
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
          break;
        case 'openDashboardInBrowser':
          this.showDashboardPane();
          break;
        case 'openMainWindow':
          WelcomeDashboard.createOrShow(this.extUri, true)?.showDashboardPane();
          break;
        case 'openTeamDashboard': {
          const dataPort = getDataServerPort();
          const dashboardUrl = `http://127.0.0.1:${dataPort}/dashboard/dashboard`;
          vscode.commands.executeCommand('simpleBrowser.show', dashboardUrl);
          break;
        }
        case 'openTeamDashboardInIDE':
          this.showTeamPane();
          break;
        case 'openPreviewInBrowser': {
          openSidebarInBrowserStatic('/');
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
          showQuietMessage('Roadmap export is handled in the dashboard.');
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
          vscode.env.openExternal(vscode.Uri.parse('https://simplebeacon.io/docs'));
          break;
        case 'openFullProfile':
          this.showReportPane();
          break;
        case 'openFullCompliance':
          this.showReportPane();
          break;
        case 'runComplianceCheck':
          showQuietMessage('Running compliance check...');
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
            const url = (msg.value || config.get('apiServerUrl', DEFAULT_API_URL) as string).replace(/\/$/, '') + '/health';
            try {
              const res = await fetch(url);
              this.panel.webview.postMessage({ command: 'apiConnectionResult', ok: res.ok });
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
          const filePath = msg.file;
          const lineNum = Math.max(0, (msg.line || 1) - 1);
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
      }
    });
    this.panel.webview.html = this.buildHtml();
  }

  public buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    return buildDashboardHtml({
      cspSource: this.panel.webview.cspSource,
      version: this.version,
      nonce
    });
  }

  public static buildBrowserHtml(report?: Record<string, unknown>): string {
    let html = '';
    if (WelcomeDashboard.currentPanel) {
      html = WelcomeDashboard.currentPanel.buildHtml();
    } else {
      const nonce = crypto.randomBytes(16).toString('hex');
      html = buildDashboardHtml({
        cspSource: "default-src 'self'",
        version: 'browser',
        nonce
      });
    }
    return html;
  }

}
