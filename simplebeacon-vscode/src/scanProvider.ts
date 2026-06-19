import * as vscode from 'vscode';

export interface RawIssue {
  type?: string;
  description?: string;
  message?: string;
  file?: string | null;
  filePath?: string;
  path?: string;
  line?: number | null;
  severity?: string;
  category?: string;
  packageName?: string;
  id?: string;
  ruleId?: string;
  patternId?: string;
}

export interface FindingItem {
  label: string;
  file: string | null;
  line: number | null;
  severity: string;
}

export class ScanPhaseProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: Record<string, unknown> | null = null;
  private tasks: Map<string, boolean> = new Map();

  updateReport(report: Record<string, unknown>) {
    this.report = report;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.report = null;
    this.tasks.clear();
    this._onDidChangeTreeData.fire();
  }

  toggleTask(task: TaskNode) {
    const current = this.tasks.get(task.id) ?? false;
    this.tasks.set(task.id, !current);
    this._onDidChangeTreeData.fire(task);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

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

  private getRootNodes(): TreeNode[] {
    const r = this.report as any;
    const nodes: TreeNode[] = [];
    if (!r) return nodes;

    const gatePass = r.gate?.pass;
    nodes.push(new StatusNode(
      `Gate: ${gatePass ? 'PASS' : 'FAIL'}`,
      gatePass ? 'pass' : 'fail',
      `Score: ${r.qualityScore}/100`
    ));

    nodes.push(new StatusNode(
      `Quality: ${r.qualityScore}/100`,
      r.qualityScore >= 80 ? 'pass' : r.qualityScore >= 50 ? 'warn' : 'fail'
    ));

    const categories = this.extractCategories(r);
    for (const cat of categories) {
      nodes.push(new CategoryNode(cat.label, cat.count, cat.severity));
    }

    return nodes;
  }

  private getTaskNodes(category: string): TaskNode[] {
    const findings = this.extractFindingsForCategory(category);
    return findings.map((f, i) => {
      const id = `${category}-${i}`;
      const done = this.tasks.get(id) ?? false;
      return new TaskNode(id, f, done);
    });
  }

  private extractCategories(report: unknown) {
    const r = report as any;
    const cats: { label: string; count: number; severity: string }[] = [];
    const push = (label: string, sev: string, items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };
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

  private extractFindingsForCategory(label: string): FindingItem[] {
    const r = this.report as any;
    if (!r) return [];
    switch (label) {
      case 'Blocking Issues':
        return (r.gate?.blockingIssues || []).map((i: RawIssue) => ({
          label: i.description || i.ruleId || 'Issue',
          file: i.file || null,
          line: i.line || null,
          severity: i.severity || 'high'
        }));
      case 'Secrets':
        return (r.credentialHygiene?.secrets || []).map((s: RawIssue) => ({
          label: s.type || 'Secret',
          file: s.file || null,
          line: s.line || null,
          severity: s.severity || 'high'
        }));
      case 'AI Indicators':
        return (r.aiIndicators?.findings || []).map((f: RawIssue) => ({
          label: f.type || 'AI Finding',
          file: f.file || null,
          line: f.line || null,
          severity: f.severity || 'medium'
        }));
      case 'EU AI Act':
        return (r.euAiAct?.findings || []).map((f: RawIssue) => ({
          label: f.description || 'EU AI Act Finding',
          file: f.file || null,
          line: f.line || null,
          severity: f.severity || 'medium'
        }));
      case 'Vulnerabilities':
        return (r.dependencyAudit?.vulnerabilities || []).map((v: RawIssue) => ({
          label: v.packageName || v.id || 'Vulnerability',
          file: null,
          line: null,
          severity: v.severity || 'high'
        }));
      case 'Debug Markers':
        return (r.cleanup?.debugMarkers || []).map((m: RawIssue) => ({
          label: m.message || 'Debug marker',
          file: m.file || null,
          line: m.line || null,
          severity: 'low'
        }));
      case 'AI Residue':
        return (r.aiResidue?.aiResidueFindings || []).map((f: RawIssue) => ({
          label: f.type || 'AI Residue',
          file: f.file || null,
          line: f.line || null,
          severity: f.severity || 'medium'
        }));
      case 'Performance':
        return (r.performance?.performanceFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Performance Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Type Safety':
        return (r.typeSafety?.typeSafetyFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Type Safety Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'Test Coverage':
        return (r.testCoverage?.testCoverageFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Test Coverage Gap',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'Accessibility':
        return (r.accessibility?.accessibilityFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Accessibility Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'i18n':
        return (r.i18n?.i18nFindings || []).map((f: RawIssue) => ({
          label: f.type || 'i18n Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'Sensitive Data':
        return (r.sensitiveData?.sensitiveDataFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Sensitive Data',
          file: f.file,
          line: f.line,
          severity: f.severity || 'high'
        }));
      case 'Config Drift':
        return (r.configDrift?.configDriftFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Config Drift',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Security Headers':
        return (r.securityHeaders?.securityHeaderFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Security Header',
          file: f.file,
          line: f.line,
          severity: f.severity || 'high'
        }));
      case 'Database Patterns':
        return (r.databasePatterns?.dbPatternFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Database Pattern',
          file: f.file,
          line: f.line,
          severity: f.severity || 'high'
        }));
      case 'Framework Practices':
        return (r.frameworkPractices?.frameworkFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Framework Practice',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Workspace Health':
        return (r.workspaceHealth?.workspaceFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Workspace Health',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'Unused Deps':
        return (r.unusedDeps?.unusedDepFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Unused Dependency',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'API Contract':
        return (r.apiContract?.apiContractFindings || []).map((f: RawIssue) => ({
          label: f.type || 'API Contract',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      case 'Complexity':
        return (r.complexity?.complexityFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Complexity',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'LLM Slop':
        return (r.llmSlop?.llmSlopFindings || []).map((f: RawIssue) => ({
          label: f.type || 'LLM Slop',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Token Bleed':
        return (r.tokenBleed?.tokenBleedFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Token Bleed',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Production Leak':
        return (r.productionLeak?.productionLeakFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Production Leak',
          file: f.file,
          line: f.line,
          severity: f.severity || 'high'
        }));
      case 'Fiction KPI':
        return (r.fictionKpi?.fictionKpiFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Fiction KPI',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Security':
        return (r.security?.securityFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Security Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'high'
        }));
      case 'Quality':
        return (r.quality?.qualityFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Quality Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'medium'
        }));
      case 'Maintainability':
        return (r.maintainability?.maintainabilityFindings || []).map((f: RawIssue) => ({
          label: f.type || 'Maintainability Issue',
          file: f.file,
          line: f.line,
          severity: f.severity || 'low'
        }));
      default:
        return [];
    }
  }
}

export type TreeNode = StatusNode | CategoryNode | TaskNode | InfoNode;

export class StatusNode extends vscode.TreeItem {
  constructor(label: string, status: 'pass' | 'fail' | 'warn' | 'info', tooltip?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip || label;
    this.contextValue = 'status';
    const iconMap = {
      pass: 'check',
      fail: 'error',
      warn: 'warning',
      info: 'info'
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[status],
      status === 'pass' ? new vscode.ThemeColor('testing.iconPassed') :
      status === 'fail' ? new vscode.ThemeColor('testing.iconFailed') :
      status === 'warn' ? new vscode.ThemeColor('testing.iconQueued') : undefined
    );
  }
}

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

export class TaskNode extends vscode.TreeItem {
  constructor(public readonly id: string, finding: FindingItem, done: boolean) {
    super(finding.label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = finding.file ? `${finding.file}:${finding.line || '?'}` : finding.label;
    this.contextValue = 'task';
    this.iconPath = new vscode.ThemeIcon(done ? 'pass' : 'circle-outline');
    this.command = {
      command: 'simplebeacon.openFinding',
      title: 'Open Finding',
      arguments: [finding.file, finding.line || 1]
    };
    this.description = done ? 'Done' : '';
  }
}

class InfoNode extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
