// simplebeacon-ignore memory-leak — report data processing, short-lived iterations
import * as vscode from 'vscode';

/** Raw issue data as returned by the SimpleBeacon scanner. */
export interface RawIssue {
  /** Issue classification or type name. */
  type?: string;
  /** Human-readable description of the issue. */
  description?: string;
  /** Message or detail text. */
  message?: string;
  /** Source file path, if available. */
  file?: string | null;
  /** Alias for file. */
  filePath?: string;
  /** Alias for file. */
  path?: string;
  /** Line number where the issue was found. */
  line?: number | null;
  /** Severity level (critical, high, medium, low, info). */
  severity?: string;
  /** Category tag. */
  category?: string;
  /** Number of occurrences represented by this finding record. */
  count?: number;
  /** Package name, for dependency vulnerabilities. */
  packageName?: string;
  /** Rule or finding identifier. */
  id?: string;
  /** Alias for id. */
  ruleId?: string;
  /** Alias for id. */
  patternId?: string;
}

/** Normalized finding for display in the tree view. */
export interface FindingItem {
  /** Human-readable label shown in the tree. */
  label: string;
  /** Source file path, or null if not applicable. */
  file: string | null;
  /** Line number, or null if not applicable. */
  line: number | null;
  /** Severity string for icon theming. */
  severity: string;
}

/** Complete scan report data structure from SimpleBeacon. */
export interface ScanReport {
  [key: string]: unknown;
  gate?: { pass?: boolean; blockingIssues?: RawIssue[]; blockingCount?: number; warningCount?: number };
  scan_summary?: { status?: string; low_severity_count?: number; medium_severity_count?: number; high_severity_count?: number; total_risks_found?: number; block_merge?: boolean };
  qualityScore?: number;
  totalFiles?: number;
  filesAnalyzed?: number;
  issueCount?: number;
  severityCounts?: { critical?: number; high?: number; medium?: number; low?: number };
  rawIssues?: RawIssue[];
  findings?: RawIssue[];
  detectedIssues?: RawIssue[];
  credentialHygiene?: { secrets?: RawIssue[] };
  aiIndicators?: { findings?: RawIssue[] };
  euAiAct?: { findings?: RawIssue[] };
  dependencyAudit?: { vulnerabilities?: RawIssue[] };
  cleanup?: { debugMarkers?: RawIssue[] };
  aiResidue?: { aiResidueFindings?: RawIssue[] };
  performance?: { performanceFindings?: RawIssue[] };
  typeSafety?: { typeSafetyFindings?: RawIssue[] };
  testCoverage?: { testCoverageFindings?: RawIssue[] };
  accessibility?: { accessibilityFindings?: RawIssue[] };
  i18n?: { i18nFindings?: RawIssue[] };
  sensitiveData?: { sensitiveDataFindings?: RawIssue[] };
  configDrift?: { configDriftFindings?: RawIssue[] };
  securityHeaders?: { securityHeaderFindings?: RawIssue[] };
  databasePatterns?: { dbPatternFindings?: RawIssue[] };
  frameworkPractices?: { frameworkFindings?: RawIssue[] };
  workspaceHealth?: { workspaceFindings?: RawIssue[] };
  unusedDeps?: { unusedDepFindings?: RawIssue[] };
  apiContract?: { apiContractFindings?: RawIssue[] };
  complexity?: { complexityFindings?: RawIssue[] };
  llmSlop?: { llmSlopFindings?: RawIssue[] };
  tokenBleed?: { tokenBleedFindings?: RawIssue[] };
  productionLeak?: { productionLeakFindings?: RawIssue[] };
  fictionKpi?: { fictionKpiFindings?: RawIssue[] };
  security?: { securityFindings?: RawIssue[] };
  quality?: { qualityFindings?: RawIssue[] };
  maintainability?: { maintainabilityFindings?: RawIssue[] };
}

export function normalizeScanReport(report: ScanReport): ScanReport {
  const source = Array.isArray(report.rawIssues) && report.rawIssues.length
    ? report.rawIssues
    : Array.isArray(report.detectedIssues) && report.detectedIssues.length
      ? report.detectedIssues
      : Array.isArray(report.findings) ? report.findings : [];
  const summary = report.scan_summary || {};
  const severityCounts = report.severityCounts || {};
  const counted = (severity: string) => source.reduce((total, finding) => (
    String(finding.severity || '').toLowerCase() === severity ? total + (finding.count || 1) : total
  ), 0);
  const normalizedSeverityCounts = {
    critical: severityCounts.critical ?? counted('critical'),
    high: severityCounts.high ?? summary.high_severity_count ?? counted('high'),
    medium: severityCounts.medium ?? summary.medium_severity_count ?? counted('medium'),
    low: severityCounts.low ?? summary.low_severity_count ?? counted('low'),
  };
  const issueCount = source.reduce((total, finding) => total + (finding.count || 1), 0);
  const gate = { ...(report.gate || {}) };
  if (gate.blockingCount == null) {
    gate.blockingCount = normalizedSeverityCounts.critical + normalizedSeverityCounts.high;
  }
  if (gate.warningCount == null) {
    gate.warningCount = normalizedSeverityCounts.medium + normalizedSeverityCounts.low;
  }
  const blockingIssues = Array.isArray(gate.blockingIssues) ? gate.blockingIssues : [];
  const hasBlockers = (gate.blockingCount ?? 0) > 0 || blockingIssues.length > 0;
  if (hasBlockers) {
    gate.pass = false;
    summary.status = 'FAILED';
    summary.block_merge = true;
  } else if (gate.pass == null && typeof summary.status === 'string') {
    gate.pass = summary.status.toUpperCase() === 'PASSED';
  } else if (gate.pass == null) {
    gate.pass = true;
  }
  const categoryFindings = (type: string) => source.filter((finding) => finding.type === type);
  return {
    ...report,
    gate,
    scan_summary: summary,
    issueCount: report.issueCount === 0 && issueCount > 0 ? issueCount : (report.issueCount ?? issueCount),
    severityCounts: normalizedSeverityCounts,
    testCoverage: report.testCoverage || { testCoverageFindings: categoryFindings('test-coverage') },
    workspaceHealth: report.workspaceHealth || { workspaceFindings: categoryFindings('workspace-health') },
  };
}

/**
 * Tree data provider for scan phases and findings in the sidebar.
 */
export class ScanPhaseProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: ScanReport | null = null;
  private tasks: Map<string, boolean> = new Map();

  /**
   * Replace the current report and refresh the tree view.
   * @param {ScanReport | null} report New scan report, or null to clear.
   */
  updateReport(report: ScanReport | null) {
    this.report = report ? normalizeScanReport(report) : null;
    this._onDidChangeTreeData.fire();
  }

  /** Clear the report and task state, then refresh the tree. */
  clear() {
    this.report = null;
    this.tasks.clear();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Toggle the completion state of a task node.
   * @param {TaskNode} task The task to toggle.
   */
  toggleTask(task: TaskNode) {
    const current = this.tasks.get(task.id) ?? false;
    this.tasks.set(task.id, !current);
    this._onDidChangeTreeData.fire(task);
  }

  /**
   * @param {TreeNode} element
   * @returns {vscode.TreeItem}
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  /**
   * @param {TreeNode} [element]
   * @returns {Promise<TreeNode[]>}
   */
  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!this.report) {
      return Promise.resolve([new InfoNode('Run a scan to see results')]);
    }

    if (!element) {
      return Promise.resolve(this.getRootNodes());
    }

    if (element instanceof CategoryNode) {
      return Promise.resolve(this.getTaskNodes(element.category));
    }

    return Promise.resolve([]);
  }

  /** Build the top-level tree nodes (status + categories). */
  private getRootNodes(): TreeNode[] {
    const r = this.report;
    const nodes: TreeNode[] = [];
    if (!r) return nodes;

    const gatePass = r.gate?.pass;
    nodes.push(
      new StatusNode(`Gate: ${gatePass ? 'PASS' : 'FAIL'}`, gatePass ? 'pass' : 'fail', `Score: ${r.qualityScore ?? 0}/100`)
    );

    const qualityScore = r.qualityScore ?? 0;
    nodes.push(
      new StatusNode(
        `Quality: ${qualityScore}/100`,
        qualityScore >= 80 ? 'pass' : qualityScore >= 50 ? 'warn' : 'fail'
      )
    );

    const categories = this.extractCategories(r);
    for (const cat of categories) {
      nodes.push(new CategoryNode(cat.label, cat.count, cat.severity));
    }

    return nodes;
  }

  /** Build task nodes for a given category label. */
  private getTaskNodes(category: string): TaskNode[] {
    const findings = this.extractFindingsForCategory(category);
    return findings.map((f, i) => {
      const id = `${category}-${i}`;
      const done = this.tasks.get(id) ?? false;
      return new TaskNode(id, f, done);
    });
  }

  /** Category definitions for consistent ordering and severity mapping. */
  private static readonly CATEGORY_MAP: { label: string; severity: string; getter: (r: ScanReport) => RawIssue[] | null | undefined }[] = [
    { label: 'Blocking Issues', severity: 'fail', getter: r => r.gate?.blockingIssues },
    { label: 'Secrets', severity: 'fail', getter: r => r.credentialHygiene?.secrets },
    { label: 'AI Indicators', severity: 'warn', getter: r => r.aiIndicators?.findings },
    { label: 'EU AI Act', severity: 'warn', getter: r => r.euAiAct?.findings },
    { label: 'Vulnerabilities', severity: 'fail', getter: r => r.dependencyAudit?.vulnerabilities },
    { label: 'Debug Markers', severity: 'info', getter: r => r.cleanup?.debugMarkers },
    { label: 'AI Residue', severity: 'warn', getter: r => r.aiResidue?.aiResidueFindings },
    { label: 'Performance', severity: 'warn', getter: r => r.performance?.performanceFindings },
    { label: 'Type Safety', severity: 'info', getter: r => r.typeSafety?.typeSafetyFindings },
    { label: 'Test Coverage', severity: 'info', getter: r => r.testCoverage?.testCoverageFindings },
    { label: 'Accessibility', severity: 'info', getter: r => r.accessibility?.accessibilityFindings },
    { label: 'i18n', severity: 'info', getter: r => r.i18n?.i18nFindings },
    { label: 'Sensitive Data', severity: 'fail', getter: r => r.sensitiveData?.sensitiveDataFindings },
    { label: 'Config Drift', severity: 'warn', getter: r => r.configDrift?.configDriftFindings },
    { label: 'Security Headers', severity: 'fail', getter: r => r.securityHeaders?.securityHeaderFindings },
    { label: 'Database Patterns', severity: 'fail', getter: r => r.databasePatterns?.dbPatternFindings },
    { label: 'Framework Practices', severity: 'warn', getter: r => r.frameworkPractices?.frameworkFindings },
    { label: 'Workspace Health', severity: 'info', getter: r => r.workspaceHealth?.workspaceFindings },
    { label: 'Unused Deps', severity: 'info', getter: r => r.unusedDeps?.unusedDepFindings },
    { label: 'API Contract', severity: 'info', getter: r => r.apiContract?.apiContractFindings },
    { label: 'Complexity', severity: 'warn', getter: r => r.complexity?.complexityFindings },
    { label: 'LLM Slop', severity: 'warn', getter: r => r.llmSlop?.llmSlopFindings },
    { label: 'Token Bleed', severity: 'warn', getter: r => r.tokenBleed?.tokenBleedFindings },
    { label: 'Production Leak', severity: 'fail', getter: r => r.productionLeak?.productionLeakFindings },
    { label: 'Fiction KPI', severity: 'warn', getter: r => r.fictionKpi?.fictionKpiFindings },
    { label: 'Security', severity: 'fail', getter: r => r.security?.securityFindings },
    { label: 'Quality', severity: 'warn', getter: r => r.quality?.qualityFindings },
    { label: 'Maintainability', severity: 'info', getter: r => r.maintainability?.maintainabilityFindings },
  ];

  /** Extract non-empty categories from a scan report. */
  private extractCategories(report: ScanReport | null) {
    if (!report) return [];
    const cats: { label: string; count: number; severity: string }[] = [];
    for (const cat of ScanPhaseProvider.CATEGORY_MAP) {
      const items = cat.getter(report);
      if (items?.length) cats.push({ label: cat.label, count: items.length, severity: cat.severity });
    }
    return cats;
  }

  /** Extract normalized findings for a given category label. */
  private extractFindingsForCategory(label: string): FindingItem[] {
    const r = this.report;
    if (!r) return [];
    for (const cat of ScanPhaseProvider.CATEGORY_MAP) {
      if (cat.label !== label) continue;
      const items = cat.getter(r);
      return (items || []).map((i: RawIssue) => ({
        label: i.description ?? i.ruleId ?? i.type ?? i.id ?? i.message ?? 'Finding',
        file: i.file ?? null,
        line: i.line ?? null,
        severity: i.severity ?? cat.severity,
      }));
    }
    return [];
  }
}

/** Union type for all nodes in the scan phase tree. */
export type TreeNode = StatusNode | CategoryNode | TaskNode | InfoNode;

/**
 * Tree item representing a scan status node (pass, fail, warn, info).
 */
export class StatusNode extends vscode.TreeItem {
  constructor(label: string, status: 'pass' | 'fail' | 'warn' | 'info', tooltip?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip || label;
    this.contextValue = 'status';
    const iconMap = {
      pass: 'check',
      fail: 'error',
      warn: 'warning',
      info: 'info',
    };
    this.iconPath = new vscode.ThemeIcon(
      iconMap[status],
      status === 'pass'
        ? new vscode.ThemeColor('testing.iconPassed')
        : status === 'fail'
          ? new vscode.ThemeColor('testing.iconFailed')
          : status === 'warn'
            ? new vscode.ThemeColor('testing.iconQueued')
            : undefined
    );
  }
}

/**
 * Tree item representing a finding category node with issue count.
 */
export class CategoryNode extends vscode.TreeItem {
  public readonly category: string;
  constructor(label: string, count: number, severity: string) {
    super(`${label} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'category';
    this.category = label;
    const sevMap: Record<string, string> = { fail: 'testing.iconFailed', warn: 'testing.iconQueued', info: 'info' };
    this.iconPath = new vscode.ThemeIcon('bug', new vscode.ThemeColor(sevMap[severity] || 'info'));
  }
}

/**
 * Tree item representing an individual finding/task node.
 */
export class TaskNode extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    finding: FindingItem,
    done: boolean
  ) {
    super(finding.label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = finding.file ? `${finding.file}:${finding.line || '?'}` : finding.label;
    this.contextValue = 'task';
    this.iconPath = new vscode.ThemeIcon(done ? 'pass' : 'circle-outline');
    this.command = {
      command: 'simplebeacon.openFinding',
      title: 'Open Finding',
      arguments: [finding.file, finding.line || 1],
    };
    this.description = done ? 'Done' : '';
  }
}

/** Tree item for informational placeholder messages. */
export class InfoNode extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
