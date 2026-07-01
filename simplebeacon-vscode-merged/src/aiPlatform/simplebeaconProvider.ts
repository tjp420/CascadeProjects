import * as vscode from 'vscode';
import { getSbConfig } from '../utils';

export interface ScanIssue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  filePath?: string;
  line?: number;
  column?: number;
  category?: string;
  effort?: string;
}

export interface ScanResult {
  projectPath: string;
  issues: ScanIssue[];
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  integrityScore: number;
  timestamp: string;
}

class IssueItem extends vscode.TreeItem {
  constructor(
    public readonly issue: ScanIssue,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(`${issue.severity.toUpperCase()}: ${issue.description.slice(0, 60)}`, collapsibleState);

    this.tooltip = `${issue.type} - ${issue.description}`;
    this.description = issue.filePath
      ? `${issue.filePath.split(/[\\/]/).pop()}${issue.line ? `:${issue.line}` : ''}`
      : '';

    const iconMap: Record<string, string> = {
      critical: 'error',
      high: 'warning',
      medium: 'warning',
      low: 'info',
      info: 'info',
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[issue.severity] || 'info');

    this.command = issue.filePath
      ? {
          command: 'simplebeacon.openIssue',
          title: 'Open Issue',
          arguments: [issue],
        }
      : undefined;

    this.contextValue = 'issue';
  }
}

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: string,
    public readonly issues: ScanIssue[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(`${category} (${issues.length})`, collapsibleState);
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'category';
  }
}

/**
 * Tree data provider for the SimpleBeacon issue explorer panel.
 */
export class SimpleBeaconProvider implements vscode.TreeDataProvider<IssueItem | CategoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | CategoryItem | undefined | null | void> =
    new vscode.EventEmitter<IssueItem | CategoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | CategoryItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private result: ScanResult | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.result = null;
    this._onDidChangeTreeData.fire();
  }

  setResult(result: ScanResult): void {
    this.result = result;
    vscode.commands.executeCommand('setContext', 'simplebeacon.hasResults', true);
    this._onDidChangeTreeData.fire();
  }

  getResult(): ScanResult | null {
    return this.result;
  }

  getTreeItem(element: IssueItem | CategoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IssueItem | CategoryItem): Thenable<(IssueItem | CategoryItem)[]> {
    if (!this.result) {
      return Promise.resolve([]);
    }

    if (element instanceof CategoryItem) {
      const config = getSbConfig();
      const minSeverity = config.get<string>('severityFilter', 'medium');
      const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
      const minIndex = severityOrder.indexOf(minSeverity);

      const filtered = element.issues.filter((i) => {
        const idx = severityOrder.indexOf(i.severity);
        return idx >= minIndex;
      });

      return Promise.resolve(filtered.map((issue) => new IssueItem(issue, vscode.TreeItemCollapsibleState.None)));
    }

    // Group by category
    const categories = new Map<string, ScanIssue[]>();
    for (const issue of this.result.issues) {
      const cat = issue.category || 'Uncategorized';
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(issue);
    }

    return Promise.resolve(
      Array.from(categories.entries()).map(
        ([cat, issues]) => new CategoryItem(cat, issues, vscode.TreeItemCollapsibleState.Collapsed)
      )
    );
  }
}
