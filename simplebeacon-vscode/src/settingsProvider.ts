import * as vscode from 'vscode';

export class SettingsProvider implements vscode.TreeDataProvider<SidebarNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SidebarNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private lastReport: unknown = null;
  private version: string;

  constructor(version?: string) {
    this.version = version || '1.0.0';
  }

  getTreeItem(element: SidebarNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SidebarNode): Thenable<SidebarNode[]> {
    if (!element) {
      return Promise.resolve(this.getRootSections());
    }

    if (element instanceof SectionNode && element.children) {
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  updateReport(report: unknown) {
    this.lastReport = report;
    this.refresh();
  }

  clear() {
    this.lastReport = null;
    this.refresh();
  }

  private getRootSections(): SidebarNode[] {
    const sections: SidebarNode[] = [];

    const config = vscode.workspace.getConfiguration('simplebeacon');
    const autoScan = config.get<boolean>('autoScanOnOpen', false);
    const maxFiles = config.get<number>('maxFiles', 5000);

    sections.push(new SectionNode(
      'Actions',
      'actions',
      [
        new ActionNode('Scan Workspace', 'simplebeacon.scanWorkspace', 'search', 'Run a full workspace scan'),
        new ActionNode('Open Dashboard', 'simplebeacon.showReport', 'dashboard', 'View scan dashboard'),
        new ActionNode('Clear Results', 'simplebeacon.clearResults', 'clear-all', 'Clear all scan results'),
        new ActionNode('Export Report', 'simplebeacon.exportReport', 'save-as', 'Export report as JSON'),
        new ActionNode('Generate Certificate', 'simplebeacon.generateCertificate', 'verified', 'Generate compliance certificate')
      ]
    ));

    if (this.lastReport) {
      const lr = this.lastReport as any;
      const score = lr.qualityScore ?? 0;
      const gatePass = lr.gate?.pass ?? false;
      const files = lr.totalFiles || lr.filesAnalyzed || 0;
      const findings = lr.gate?.blockingIssues?.length || 0;

      sections.push(new SectionNode(
        'Last Scan',
        'last-scan',
        [
          new ConfigNode(`Score: ${score}/100`, 'star-full', score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail'),
          new ConfigNode(`Gate: ${gatePass ? 'PASS' : 'FAIL'}`, gatePass ? 'pass' : 'error', gatePass ? 'pass' : 'fail'),
          new ConfigNode(`Files: ${files}`, 'file', 'info'),
          new ConfigNode(`Blocking: ${findings}`, 'warning', findings > 0 ? 'fail' : 'pass')
        ]
      ));
    }

    sections.push(new SectionNode(
      'Configuration',
      'config',
      [
        new ConfigNode(`Auto-scan: ${autoScan ? 'On' : 'Off'}`, autoScan ? 'check' : 'x', autoScan ? 'pass' : 'fail'),
        new ConfigNode(`Max files: ${maxFiles}`, 'file', 'info'),
        new ConfigNode(`Excludes: node_modules, .git, dist...`, 'exclude', 'info')
      ]
    ));

    sections.push(new SectionNode(
      'Status',
      'status',
      [
        new StatusNode(`Extension: v${this.version}`, 'versions', 'info'),
        new StatusNode('Engine: VS Code 1.84+', 'vscode', 'info')
      ]
    ));

    return sections;
  }
}

export type SidebarNode = SectionNode | ActionNode | ConfigNode | StatusNode;

export class SectionNode extends vscode.TreeItem {
  public readonly children?: SidebarNode[];

  constructor(label: string, contextValue: string, children: SidebarNode[]) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = contextValue;
    this.children = children;
    this.iconPath = new vscode.ThemeIcon('list-unordered');
  }
}

export class ActionNode extends vscode.TreeItem {
  constructor(label: string, commandId: string, icon: string, tooltip: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.contextValue = 'action';
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command: commandId,
      title: label,
      arguments: []
    };
  }
}

export class ConfigNode extends vscode.TreeItem {
  constructor(label: string, icon: string, status: 'pass' | 'fail' | 'warn' | 'info') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'config';

    const colorMap = {
      pass: 'testing.iconPassed',
      fail: 'testing.iconFailed',
      warn: 'testing.iconQueued',
      info: 'info'
    };

    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(colorMap[status]));
  }
}

export class StatusNode extends vscode.TreeItem {
  constructor(label: string, icon: string, status: 'pass' | 'fail' | 'warn' | 'info') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'status';

    const colorMap = {
      pass: 'testing.iconPassed',
      fail: 'testing.iconFailed',
      warn: 'testing.iconQueued',
      info: 'info'
    };

    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(colorMap[status]));
  }
}
