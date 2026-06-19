import * as vscode from 'vscode';
import { TreeNode, RawIssue } from './scanProvider';
import {
  ProgressNode,
  MetricNode,
  ActionGroupNode,
  QuickActionNode,
  StatusCardNode,
  FindingGroupNode,
  HealthScoreNode,
  RecentScanNode,
  ScanProgressNode,
  SidebarUIHelper,
} from './enhancedSidebar';

/**
 * Enhanced tree data provider for scan results with health scoring and progress tracking.
 */
export class EnhancedScanProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: Record<string, any> | null = null;
  private isScanning: boolean = false;
  private scanProgress: { phase: string; progress: number; total: number; currentFile?: string } | null = null;
  private recentScans: any[] = [];

  updateReport(report: Record<string, any>) {
    this.report = report;
    this.isScanning = false;
    this.scanProgress = null;
    this.addToRecentScans(report);
    this._onDidChangeTreeData.fire();
  }

  setScanning(
    isScanning: boolean,
    progress?: { phase: string; progress: number; total: number; currentFile?: string }
  ) {
    this.isScanning = isScanning;
    this.scanProgress = progress || null;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.report = null;
    this.isScanning = false;
    this.scanProgress = null;
    this._onDidChangeTreeData.fire();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      return Promise.resolve(this.getRootNodes());
    }

    // Handle enhanced node types
    if (element instanceof ActionGroupNode) {
      return Promise.resolve(element.children);
    }

    if (element instanceof FindingGroupNode) {
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  private getRootNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Scan Status Section
    if (this.isScanning && this.scanProgress) {
      nodes.push(
        SidebarUIHelper.createStatusCard('Scanning', 'loading', 'Analyzing your code...'),
        new ScanProgressNode(
          this.scanProgress.phase,
          this.scanProgress.progress,
          this.scanProgress.total,
          this.scanProgress.currentFile
        )
      );
    } else if (this.report) {
      const score = this.report.qualityScore ?? 0;
      const gatePass = this.report.gate?.pass ?? false;
      nodes.push(
        SidebarUIHelper.createHealthScore(score),
        SidebarUIHelper.createStatusCard(
          gatePass ? 'Gate Status: PASS' : 'Gate Status: FAIL',
          gatePass ? 'pass' : 'fail',
          `Quality score: ${score}/100`
        )
      );

      // Build Readiness
      const br = this.report.buildReadiness;
      if (br) {
        const brStatus = br.readinessStatus;
        const brColor = brStatus === 'READY' ? 'pass' : brStatus === 'NEEDS WORK' ? 'warn' : 'fail';
        nodes.push(
          SidebarUIHelper.createStatusCard(
            `Build Readiness: ${brStatus}`,
            brColor,
            `${br.readinessScore}% — ${br.passedChecks}/${br.totalChecks} checks passed`
          )
        );
      }

      // EU AI Act
      const eu = this.report.euAiAct;
      if (eu) {
        const euPass = eu.controls.every((c: { status: string }) => c.status === 'PASS');
        nodes.push(
          SidebarUIHelper.createStatusCard(
            `EU AI Act: ${euPass ? 'Compliant' : 'Review Required'}`,
            euPass ? 'pass' : 'warn',
            eu.summary
          )
        );
      }
    } else {
      nodes.push(SidebarUIHelper.createStatusCard('No Scan Data', 'info', 'Run a scan to see results'));
    }

    // Quick Actions
    nodes.push(this.createQuickActionsSection());

    // Scan Results
    if (this.report && !this.isScanning) {
      nodes.push(...this.createResultsSection());
    }

    // Recent Scans
    if (this.recentScans.length > 0) {
      nodes.push(...this.createRecentScansSection());
    }

    return nodes;
  }

  private createQuickActionsSection(): ActionGroupNode {
    const actions = [
      SidebarUIHelper.createQuickAction('Scan Workspace', 'simplebeacon.scanWorkspace', 'search', 'Ctrl+Shift+S'),
      SidebarUIHelper.createQuickAction('View Dashboard', 'simplebeacon.showReport', 'open-view', 'Ctrl+Shift+D'),
      SidebarUIHelper.createQuickAction('Clear Results', 'simplebeacon.clearResults', 'trash', 'Ctrl+Shift+C'),
      SidebarUIHelper.createQuickAction('Export Report', 'simplebeacon.exportReport', 'save', 'Ctrl+Shift+E'),
      SidebarUIHelper.createQuickAction(
        'Generate Certificate',
        'simplebeacon.generateCertificate',
        'verified',
        'Ctrl+Shift+G'
      ),
      SidebarUIHelper.createQuickAction('Open Settings', 'simplebeacon.openSettings', 'gear', 'Ctrl+Shift+,'),
    ];

    return SidebarUIHelper.createActionGroup('Quick Actions', actions);
  }

  private createResultsSection(): TreeNode[] {
    const nodes: TreeNode[] = [];
    const r = this.report;
    if (!r) return nodes;

    // Overview Metrics
    const files = r.totalFiles || r.filesAnalyzed || 0;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    const categories = this.extractCategories(r);
    const totalFindings = categories.reduce((sum, c) => sum + c.count, 0);

    nodes.push(
      SidebarUIHelper.createMetricSection('Files Scanned', files, 'file'),
      SidebarUIHelper.createMetricSection('Folders', folders, 'folder'),
      SidebarUIHelper.createMetricSection('Total Findings', totalFindings, 'warning'),
      SidebarUIHelper.createMetricSection('Categories', categories.length, 'list-tree')
    );

    // Findings by Category
    if (totalFindings > 0) {
      nodes.push(...this.createCategoryBreakdown(categories));
    }

    // Issues by Severity
    const allFindings = this.extractAllFindings(r);
    if (allFindings.length > 0) {
      nodes.push(...SidebarUIHelper.createFindingGroups(allFindings));
    }

    return nodes;
  }

  private createCategoryBreakdown(categories: any[]): TreeNode[] {
    return categories.map((cat) =>
      SidebarUIHelper.createMetricSection(
        cat.label,
        cat.count,
        'bug',
        cat.severity === 'fail' ? 'down' : cat.severity === 'pass' ? 'up' : 'stable'
      )
    );
  }

  private createRecentScansSection(): TreeNode[] {
    // Show last 3 scans
    return this.recentScans
      .slice(-3)
      .map((scan) =>
        SidebarUIHelper.createRecentScan(
          new Date(scan.generatedAt),
          scan.qualityScore || 0,
          scan.gate?.pass || false,
          this.extractAllFindings(scan).length
        )
      );
  }

  private extractCategories(
    report: unknown
  ): { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] = [];
    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };

    if (!r.gate?.blockingIssues?.length && !r.credentialHygiene?.secrets?.length && r.rawIssues?.length) {
      const high = r.rawIssues.filter((i: RawIssue) => i.severity === 'high' || i.severity === 'critical');
      const medium = r.rawIssues.filter((i: RawIssue) => i.severity === 'medium');
      const low = r.rawIssues.filter((i: RawIssue) => i.severity === 'low');
      if (high.length) push('Blocking Issues', 'fail', high);
      if (medium.length) push('Warnings', 'warn', medium);
      if (low.length) push('Info', 'info', low);
      return cats;
    }

    push('Blocking Issues', 'fail', r.gate?.blockingIssues);
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

    return cats;
  }

  private extractAllFindings(
    report: unknown
  ): { cat: string; sev: string; desc: string; file: string; line: number | '' }[] {
    const r = report as any;
    const all: { cat: string; sev: string; desc: string; file: string; line: number | '' }[] = [];
    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
          file: it.file || it.path || '',
          line: it.line || '',
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

  private addToRecentScans(report: unknown) {
    const r = report as any;
    if (!r) return;

    this.recentScans = this.recentScans.filter((scan) => scan.generatedAt !== r.generatedAt);

    this.recentScans.push(report);

    // Keep only last 10 scans
    if (this.recentScans.length > 10) {
      this.recentScans = this.recentScans.slice(-10);
    }
  }
}
