import * as vscode from 'vscode';
import { RawIssue } from './scanProvider';

/**
 * Visual sidebar tree data provider with rich UI elements for scan results.
 */
export class VisualSidebarProvider implements vscode.TreeDataProvider<VisualNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VisualNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: Record<string, unknown> | null = null;
  private isScanning: boolean = false;
  private scanProgress: { phase: string; progress: number; total: number; currentFile?: string } | null = null;

  updateReport(report: Record<string, unknown>) {
    this.report = report;
    this.isScanning = false;
    this.scanProgress = null;
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

  getTreeItem(element: VisualNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: VisualNode): Thenable<VisualNode[]> {
    if (!element) {
      return Promise.resolve(this.getRootNodes());
    }

    if (element instanceof CategoryNode) {
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  private getRootNodes(): VisualNode[] {
    const nodes: VisualNode[] = [];

    // Header Section
    nodes.push(this.createHeaderSection());

    // Scan Status
    if (this.isScanning && this.scanProgress) {
      nodes.push(...this.createScanningSection());
    } else if (this.report) {
      nodes.push(...this.createResultsOverview());
    }

    // Quick Actions
    nodes.push(this.createQuickActionsSection());

    // Detailed Results
    if (this.report && !this.isScanning) {
      nodes.push(...this.createDetailedResults());
    }

    return nodes;
  }

  private createHeaderSection(): HeaderNode {
    const report = this.report as any;
    const score = report?.qualityScore ?? 0;
    const gatePass = report?.gate?.pass ?? false;

    return new HeaderNode(
      'SimpleBeacon',
      score,
      gatePass,
      report?.generatedAt ? new Date(report.generatedAt) : new Date()
    );
  }

  private createScanningSection(): VisualNode[] {
    const nodes: VisualNode[] = [];

    nodes.push(
      new StatusNode('Scanning in Progress', 'loading', 'Analyzing your codebase for security and quality issues')
    );

    if (this.scanProgress) {
      nodes.push(
        new ProgressNode(
          this.scanProgress.phase,
          this.scanProgress.progress,
          this.scanProgress.total,
          this.scanProgress.currentFile
        )
      );
    }

    return nodes;
  }

  private createResultsOverview(): VisualNode[] {
    const nodes: VisualNode[] = [];
    const r = this.report as any;
    const score = r?.qualityScore ?? 0;
    const gatePass = r?.gate?.pass ?? false;

    // Show actual analyzed files, not the full repository inventory
    const files = r?.filesAnalyzed || r?.ruleScopedFilesAnalyzed || r?.totalFiles || 0;
    const categories = this.extractCategories(r);
    const totalFindings = categories.reduce((sum, c) => sum + c.count, 0);

    // Score Card
    nodes.push(
      new ScoreCardNode(
        gatePass ? 'Gate: PASS' : 'Gate: FAIL',
        score,
        gatePass ? 'pass' : 'fail',
        `Quality score: ${score}/100`
      )
    );

    // Metrics Grid
    nodes.push(
      new MetricsGridNode([
        { label: 'Files Scanned', value: files, icon: 'file', color: '#3B82F6' },
        { label: 'Total Findings', value: totalFindings, icon: 'warning', color: '#F59E0B' },
        { label: 'Categories', value: categories.length, icon: 'list-tree', color: '#10B981' },
        {
          label: 'Gate Status',
          value: gatePass ? 'PASS' : 'FAIL',
          icon: gatePass ? 'check' : 'error',
          color: gatePass ? '#10B981' : '#EF4444',
        },
      ])
    );

    return nodes;
  }

  private createQuickActionsSection(): ActionsGroupNode {
    const actions = [
      new QuickActionNode(
        'Scan Workspace',
        { command: 'simplebeacon.scanWorkspace', title: 'Scan Workspace' },
        'search',
        'Start a comprehensive security and quality scan',
        'Ctrl+Shift+S'
      ),
      new QuickActionNode(
        'View Dashboard',
        { command: 'simplebeacon.showReport', title: 'View Dashboard' },
        'open-view',
        'Open the detailed analysis dashboard',
        'Ctrl+Shift+D'
      ),
      new QuickActionNode(
        'Export Report',
        { command: 'simplebeacon.exportReport', title: 'Export Report' },
        'save',
        'Export scan results as JSON',
        'Ctrl+Shift+E'
      ),
      new QuickActionNode(
        'Generate Certificate',
        { command: 'simplebeacon.generateCertificate', title: 'Generate Certificate' },
        'verified',
        'Create a compliance certificate',
        'Ctrl+Shift+G'
      ),
      new QuickActionNode(
        'Clear Results',
        { command: 'simplebeacon.clearResults', title: 'Clear Results' },
        'trash',
        'Clear all scan results',
        'Ctrl+Shift+C'
      ),
      new QuickActionNode(
        'Open Settings',
        { command: 'simplebeacon.openSettings', title: 'Open Settings' },
        'gear',
        'Configure extension settings',
        'Ctrl+Shift+,'
      ),
      new QuickActionNode(
        'Enhanced AI Analysis',
        { command: 'simplebeacon.enhancedAnalysis', title: 'Enhanced AI Analysis' },
        'sparkle',
        'Run comprehensive AI-powered analysis',
        'Ctrl+Shift+A'
      ),
      new QuickActionNode(
        'Real-time Analysis',
        { command: 'simplebeacon.realtimeAnalysis', title: 'Real-time Analysis' },
        'pulse',
        'Enable live code analysis',
        'Ctrl+Shift+R'
      ),
      new QuickActionNode(
        'Pattern Detection',
        { command: 'simplebeacon.patternDetection', title: 'Pattern Detection' },
        'search',
        'Detect code patterns and architecture',
        'Ctrl+Shift+P'
      ),
      new QuickActionNode(
        'Show Code Map',
        { command: 'simplebeacon.showCodeMap', title: 'Show Code Map' },
        'map',
        'Visualize code structure and relationships',
        'Ctrl+Shift+M'
      ),
      new QuickActionNode(
        'Analyze with AI Agent',
        { command: 'simplebeacon.analyzeWithAI', title: 'Analyze with AI Agent' },
        'brain',
        'Send scan findings to local AI agent for remediation plan',
        'Ctrl+Shift+I'
      ),
    ];

    return new ActionsGroupNode('Quick Actions', actions);
  }

  private createDetailedResults(): VisualNode[] {
    const nodes: VisualNode[] = [];
    const r = this.report as any;

    // Findings by Category
    const categories = this.extractCategories(r);
    if (categories.length > 0) {
      nodes.push(new CategoryNode('Findings by Category', categories));
    }

    // Issues by Severity
    const allFindings = this.extractAllFindings(r);
    if (allFindings.length > 0) {
      const grouped = this.groupFindingsBySeverity(allFindings);
      nodes.push(new CategoryNode('Issues by Severity', grouped));
    }

    // Files with Issues (NEW)
    const fileIssues = this.extractDetailedFileIssues(r);
    if (fileIssues.length > 0) {
      nodes.push(new FileIssuesCategoryNode('Files with Issues', fileIssues));
    }

    // Scan Details
    nodes.push(new ScanDetailsNode(r));

    return nodes;
  }

  private extractCategories(report: unknown): { label: string; count: number; severity: string; icon: string }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: string; icon: string }[] = [];
    const push = (label: string, sev: string, items: unknown[], icon: string) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev, icon });
    };

    push('Blocking Issues', 'fail', r.gate?.blockingIssues, 'error');
    push('Secrets', 'fail', r.credentialHygiene?.secrets, 'shield');
    push('AI Indicators', 'warn', r.aiIndicators?.findings, 'robot');
    push('Vulnerabilities', 'fail', r.dependencyAudit?.vulnerabilities, 'bug');
    push('Debug Markers', 'info', r.cleanup?.debugMarkers, 'debug-console');
    push('AI Residue', 'warn', r.aiResidue?.aiResidueFindings, 'code');
    push('Performance', 'warn', r.performance?.performanceFindings, 'rocket');
    push('Type Safety', 'info', r.typeSafety?.typeSafetyFindings, 'file-code');
    push('Test Coverage', 'info', r.testCoverage?.testCoverageFindings, 'beaker');
    push('Unused Files', 'warn', r.fileReduction?.unusedFiles, 'trash');
    push('Complexity', 'warn', r.complexity?.complexityFindings, 'symbol-class');

    // Fallback: text-parsed reports only have severityCounts
    if (cats.length === 0 && r.severityCounts) {
      const sc = r.severityCounts;
      if (sc.critical) push('Critical', 'fail', new Array(sc.critical), 'error');
      if (sc.high) push('High', 'fail', new Array(sc.high), 'warning');
      if (sc.medium) push('Medium', 'warn', new Array(sc.medium), 'info');
      if (sc.low) push('Low', 'info', new Array(sc.low), 'info');
    }

    return cats;
  }

  private extractAllFindings(
    report: unknown
  ): { category: string; severity: string; description: string; file: string; line: number }[] {
    const r = report as any;
    const all: { category: string; severity: string; description: string; file: string; line: number }[] = [];

    // First, try to extract from parsed rawIssues (if available from JSON)
    if (r.rawIssues && r.rawIssues.length > 0) {
      (r.rawIssues as Record<string, unknown>[]).forEach((it) => {
        all.push({
          category: (it.type as string) || 'General',
          severity: (it.severity as string) || 'medium',
          description: (it.description as string) || (it.message as string) || (it.type as string) || 'Finding',
          file: (it.filePath as string) || (it.file as string) || (it.path as string) || '',
          line: (it.line as number) || 1,
        });
      });
    }

    // Also extract from structured data
    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          category: cat,
          severity: it.severity || sev,
          description: it.description || it.message || it.type || 'Finding',
          file: it.file || it.path || it.filePath || '',
          line: it.line || 1,
        });
      });
    };

    push('Blocking', 'high', r.gate?.blockingIssues);
    push('Secrets', 'high', r.credentialHygiene?.secrets);
    push('AI Indicators', 'medium', r.aiIndicators?.findings);
    push('Vulnerabilities', 'high', r.dependencyAudit?.vulnerabilities);
    push('Debug Markers', 'low', r.cleanup?.debugMarkers);
    push('AI Residue', 'medium', r.aiResidue?.aiResidueFindings);
    push('Performance', 'medium', r.performance?.performanceFindings);
    push('Type Safety', 'low', r.typeSafety?.typeSafetyFindings);
    push('Test Coverage', 'low', r.testCoverage?.testCoverageFindings);
    push('Unused Files', 'medium', r.fileReduction?.unusedFiles);
    push('Complexity', 'medium', r.complexity?.complexityFindings);

    return all;
  }

  // New method to extract detailed file information from text output
  private extractDetailedFileIssues(
    report: unknown
  ): { file: string; issues: { severity: string; description: string; line: number }[] }[] {
    const r = report as any;
    const fileMap = new Map<string, { issues: { severity: string; description: string; line: number }[] }>();

    // Extract from rawIssues if available
    if (r.rawIssues && r.rawIssues.length > 0) {
      r.rawIssues.forEach((issue: RawIssue) => {
        const filePath = issue.filePath || issue.file || issue.path || 'Unknown';
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.description || issue.message || issue.type || 'Finding',
          line: issue.line || 1,
        });
      });
    }

    // Convert map to array and sort by issue count
    return Array.from(fileMap.entries())
      .map(([file, data]) => ({ file, ...data }))
      .sort((a, b) => b.issues.length - a.issues.length);
  }

  private groupFindingsBySeverity(
    findings: any[]
  ): { label: string; count: number; severity: string; icon: string; children: FindingNode[] }[] {
    const grouped = findings.reduce((acc: Record<string, any[]>, finding) => {
      const severity = finding.severity || 'medium';
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(finding);
      return acc;
    }, {});

    return Object.entries(grouped).map(([severity, items]: [string, any[]]) => {
      const iconMap: Record<string, string> = { high: 'error', medium: 'warning', low: 'info', critical: 'error' };
      const findingNodes = items.map(
        (item) => new FindingNode(item.description, item.file, item.line, item.category, severity)
      );
      return {
        label: `${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues (${items.length})`,
        count: items.length,
        severity,
        icon: iconMap[severity] || 'info',
        children: findingNodes,
      };
    });
  }
}

// Visual Node Classes
export type VisualNode =
  | HeaderNode
  | StatusNode
  | ProgressNode
  | ScoreCardNode
  | MetricsGridNode
  | ActionsGroupNode
  | QuickActionNode
  | CategoryNode
  | CategoryItemNode
  | FindingNode
  | ScanDetailsNode
  | FileIssuesCategoryNode
  | FileIssuesNode
  | IssueNode;

/**
 * Tree item header showing scan title, score, gate status, and timestamp.
 */
export class HeaderNode extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly score: number,
    public readonly gatePass: boolean,
    public readonly timestamp: Date
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'header';
    this.tooltip = `SimpleBeacon AI Slop Cop\nScore: ${score}/100\nGate: ${gatePass ? 'PASS' : 'FAIL'}\nLast scan: ${timestamp.toLocaleString()}`;
    this.iconPath = new vscode.ThemeIcon(
      'shield',
      new vscode.ThemeColor(this.gatePass ? 'testing.iconPassed' : 'testing.iconFailed')
    );
    this.description = `Score: ${score}/100`;
  }
}

/**
 * Tree item showing a status indicator with icon and color.
 */
export class StatusNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly status: 'pass' | 'fail' | 'warn' | 'info' | 'loading',
    public readonly description?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'status';
    this.tooltip = description || label;

    const iconMap = {
      pass: 'check-all',
      fail: 'error',
      warn: 'warning',
      info: 'info',
      loading: 'loading~spin',
    };

    const colorMap = {
      pass: 'testing.iconPassed',
      fail: 'testing.iconFailed',
      warn: 'testing.iconQueued',
      info: 'debugConsole.infoIcon',
      loading: 'editor.foreground',
    };

    this.iconPath = new vscode.ThemeIcon(iconMap[status], new vscode.ThemeColor(colorMap[status]));
  }
}

/**
 * Tree item displaying scan progress with percentage and current file.
 */
export class ProgressNode extends vscode.TreeItem {
  constructor(
    public readonly phase: string,
    public readonly progress: number,
    public readonly total: number,
    public readonly currentFile?: string
  ) {
    super(phase, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'progress';

    const percentage = Math.round((progress / total) * 100);
    this.description = `${percentage}%${currentFile ? ` • ${currentFile.split(/[\\/]/).pop()}` : ''}`;
    this.tooltip = `${phase}: ${progress} of ${total} files${currentFile ? ` (${currentFile})` : ''}`;

    if (progress < total) {
      this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('editor.foreground'));
    } else {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    }
  }
}

/**
 * Tree item showing a score card with pass/fail status.
 */
export class ScoreCardNode extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly score: number,
    public readonly status: 'pass' | 'fail',
    public readonly description?: string
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'score-card';
    this.tooltip = description || title;

    let icon: string;
    let color: string;

    if (status === 'pass') {
      icon = score >= 80 ? 'trophy' : 'check';
      color = score >= 80 ? 'testing.iconPassed' : 'testing.iconQueued';
    } else {
      icon = 'error';
      color = 'testing.iconFailed';
    }

    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
    this.description = `${score}/100`;
  }
}

/**
 * Tree item header for the metrics overview section.
 */
export class MetricsGridNode extends vscode.TreeItem {
  constructor(public readonly metrics: { label: string; value: number | string; icon: string; color: string }[]) {
    super('Metrics Overview', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'metrics-grid';
    this.iconPath = new vscode.ThemeIcon('dashboard', new vscode.ThemeColor('editor.foreground'));
    this.description = `${metrics.length} metrics`;
  }

  getChildren(): Thenable<MetricsItemNode[]> {
    return Promise.resolve(
      this.metrics.map((metric) => new MetricsItemNode(metric.label, metric.value, metric.icon, metric.color))
    );
  }
}

/**
 * Tree item representing a single metric value.
 */
export class MetricsItemNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly value: number | string,
    public readonly icon: string,
    public readonly color: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'metric-item';
    this.description = String(value);
    this.iconPath = new vscode.ThemeIcon(this.icon, new vscode.ThemeColor(this.color));
  }
}

/**
 * Tree item grouping quick action nodes.
 */
export class ActionsGroupNode extends vscode.TreeItem {
  public readonly children: QuickActionNode[];

  constructor(label: string, children: QuickActionNode[]) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'actions-group';
    this.children = children;
    this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('editor.foreground'));
    this.description = `${children.length} actions`;
  }

  getChildren(): Thenable<QuickActionNode[]> {
    return Promise.resolve(this.children);
  }
}

/**
 * Tree item representing a single clickable quick action.
 */
export class QuickActionNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly command: vscode.Command,
    public readonly icon: string,
    public readonly description?: string,
    public readonly shortcut?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'quick-action';
    this.tooltip = description ? `${description}${shortcut ? ` (${shortcut})` : ''}` : label;
    this.description = shortcut;
    this.iconPath = new vscode.ThemeIcon(this.icon, new vscode.ThemeColor('editor.foreground'));
  }
}

/**
 * Tree item representing a single issue with severity and file location.
 */
export class IssueNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly severity: string,
    public readonly file: string,
    public readonly line: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'issue';

    const fileName = file.split(/[\\/]/).pop();
    this.description = `${fileName}:${line}`;
    this.tooltip = `${severity.toUpperCase()} • ${file}:${line}`;

    const iconMap: Record<string, string> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
      critical: 'error',
    };

    this.iconPath = new vscode.ThemeIcon(iconMap[this.severity] || 'info');
    this.command = {
      command: 'simplebeacon.openFinding',
      title: 'Open Finding',
      arguments: [file, line],
    };
  }
}

/**
 * Tree item category grouping file-level issues.
 */
export class FileIssuesCategoryNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly fileIssues: { file: string; issues: { severity: string; description: string; line: number }[] }[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'file-issues-category';
    this.description = `${fileIssues.length} file${fileIssues.length !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('folder-opened');
  }

  getChildren(): Promise<FileIssuesNode[]> {
    return Promise.resolve(this.fileIssues.map((file) => new FileIssuesNode(file.file, file.issues)));
  }
}

/**
 * Tree item grouping finding categories.
 */
export class CategoryNode extends vscode.TreeItem {
  public readonly children: CategoryItemNode[];

  constructor(label: string, children: { label: string; count: number; severity: string; icon: string }[]) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'category';
    this.children = children.map((cat) => new CategoryItemNode(cat.label, cat.count, cat.severity, cat.icon));
    this.description = `${children.length} categories`;
  }

  getChildren(): Promise<CategoryItemNode[]> {
    return Promise.resolve(this.children);
  }
}

/**
 * Tree item representing a single finding category with count.
 */
export class CategoryItemNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly count: number,
    public readonly severity: string,
    public readonly icon: string
  ) {
    super(`${label} (${count})`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'category-item';
    this.tooltip = `${label}: ${count} findings`;

    const colorMap: Record<string, string> = {
      fail: 'testing.iconFailed',
      warn: 'testing.iconQueued',
      info: 'debugConsole.infoIcon',
    };

    this.iconPath = new vscode.ThemeIcon(this.icon, new vscode.ThemeColor(colorMap[this.severity] || 'info'));
    this.description = `${count} findings`;
  }
}

/**
 * Tree item representing a single finding with file and line details.
 */
export class FindingNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly file: string,
    public readonly line: number,
    public readonly category: string,
    public readonly severity: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'finding';

    const fileName = file.split(/[\\/]/).pop();
    this.description = `${fileName}:${line}`;
    this.tooltip = `${category} • ${severity.toUpperCase()} • ${file}:${line}`;

    const iconMap: Record<string, string> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
      critical: 'error',
    };

    this.iconPath = new vscode.ThemeIcon(iconMap[this.severity] || 'info');
    this.command = {
      command: 'simplebeacon.openFinding',
      title: 'Open Finding',
      arguments: [file, line],
    };
  }
}

/**
 * Tree item grouping issues within a single file.
 */
export class FileIssuesNode extends vscode.TreeItem {
  constructor(
    public readonly fileName: string,
    public readonly issues: { severity: string; description: string; line: number }[]
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'file-issues';
    this.description = `${issues.length} issue${issues.length !== 1 ? 's' : ''}`;

    // Set icon based on highest severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const highestSeverity = issues.reduce((worst, issue) => {
      const currentOrder = severityOrder[issue.severity as keyof typeof severityOrder] ?? 4;
      const worstOrder = severityOrder[worst.severity as keyof typeof severityOrder] ?? 4;
      return currentOrder < worstOrder ? issue : worst;
    }, issues[0]);

    const iconMap: Record<string, string> = {
      critical: 'error',
      high: 'warning',
      medium: 'info',
      low: 'pass',
    };

    this.iconPath = new vscode.ThemeIcon(iconMap[highestSeverity.severity] || 'info');
  }

  getChildren(): Promise<IssueNode[]> {
    return Promise.resolve(
      this.issues.map(
        (issue) =>
          new IssueNode(
            `${issue.severity.toUpperCase()}: ${issue.description}`,
            issue.severity,
            this.fileName,
            issue.line
          )
      )
    );
  }
}

/**
 * Tree item displaying detailed scan metadata and statistics.
 */
export class ScanDetailsNode extends vscode.TreeItem {
  constructor(public readonly report: unknown) {
    super('Scan Details', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'scan-details';
    this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('editor.foreground'));

    // Use the most accurate file count - ruleScopedFilesAnalyzed is the actual number of files analyzed by rules
    const r = this.report as any;
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0;
    const totalRepositoryFiles = r.repositoryFilesTotal || 0;
    const timestamp = r.generatedAt ? new Date(r.generatedAt).toLocaleString() : 'Unknown';

    // Show both analyzed files and total repository files for context
    const fileDisplay = totalRepositoryFiles > 0 ? `${filesAnalyzed}/${totalRepositoryFiles}` : `${filesAnalyzed}`;

    this.description = `Analyzed ${fileDisplay} files at ${timestamp}`;
  }

  getChildren(): Promise<DetailNode[]> {
    const details: DetailNode[] = [];
    const r = this.report as any;

    details.push(new DetailNode('Root Path', r.projectRoot || 'Unknown', 'folder'));
    details.push(
      new DetailNode(
        'Files Analyzed',
        String(r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0),
        'file'
      )
    );
    details.push(new DetailNode('Total Repository Files', String(r.repositoryFilesTotal || 'Unknown'), 'database'));
    details.push(new DetailNode('Repository Folders', String(r.repositoryFoldersTotal || 0), 'folder-open'));
    details.push(new DetailNode('Mock/Sample Files', String(r.mockSampleFiles || 0), 'file-code'));
    details.push(new DetailNode('Production Files', String(r.productionLeakScanned || 0), 'shield'));
    details.push(new DetailNode('Credential Files', String(r.credentialScanned || 0), 'key'));

    // Add scan scope information
    if (r.scanScope) {
      details.push(new DetailNode('Scan Profile', r.scanScope.profile || 'Unknown', 'settings'));
      details.push(new DetailNode('Rules Enabled', String(r.scanScope.rulesEnabled?.length || 0), 'check'));
    }

    return Promise.resolve(details);
  }
}

/**
 * Tree item showing a key-value detail for scan metadata.
 */
export class DetailNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly value: string,
    public readonly icon: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'detail';
    this.description = value;
    this.iconPath = new vscode.ThemeIcon(this.icon, new vscode.ThemeColor('editor.foreground'));
  }
}
