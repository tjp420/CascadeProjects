import * as vscode from 'vscode';

/**
 * Tree data provider for scan summary nodes in the sidebar.
 */
export class SummaryProvider implements vscode.TreeDataProvider<SummaryNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SummaryNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private report: Record<string, any> | null = null;

  updateReport(report: Record<string, any>) {
    this.report = report;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.report = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SummaryNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SummaryNode): Thenable<SummaryNode[]> {
    if (!this.report) {
      return Promise.resolve([]);
    }

    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    return Promise.resolve([]);
  }

  private getRootItems(): SummaryNode[] {
    const r = this.report;
    const items: SummaryNode[] = [];
    if (!r) return items;

    items.push(
      new SummaryNode(
        `Score: ${r.qualityScore}/100`,
        r.qualityScore >= 80 ? 'pass' : r.qualityScore >= 50 ? 'warn' : 'fail'
      )
    );

    if (r.consistencyScore != null) {
      items.push(
        new SummaryNode(
          `Consistency: ${r.consistencyScore}/100`,
          r.consistencyScore >= 80 ? 'pass' : r.consistencyScore >= 50 ? 'warn' : 'fail'
        )
      );
    }

    const files = r.totalFiles || r.filesAnalyzed || 0;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    items.push(new SummaryNode(`Files: ${files}${folders ? ` (${folders} folders)` : ''}`, 'info'));

    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', itemsArr: unknown[]) => {
      if (itemsArr?.length > 0) items.push(new SummaryNode(`${label}: ${itemsArr.length}`, sev));
    };

    push('Blocking', 'fail', r.gate?.blockingIssues);
    push('Secrets', 'fail', r.credentialHygiene?.secrets);
    push('Vulns', 'fail', r.dependencyAudit?.vulnerabilities);
    push('AI Indicators', 'warn', r.aiIndicators?.findings);
    push('EU AI Act', 'warn', r.euAiAct?.findings);
    push('Fiction KPI', 'warn', r.fictionKpi?.fictionKpiFindings);
    push('LLM Slop', 'warn', r.llmSlop?.llmSlopFindings);
    push('Token Bleed', 'warn', r.tokenBleed?.tokenBleedFindings);
    push('Production Leak', 'fail', r.productionLeak?.productionLeakFindings);
    push('Security', 'fail', r.security?.securityFindings);
    push('Quality', 'warn', r.quality?.qualityFindings);

    return items;
  }
}

/**
 * Tree item representing a scan summary entry with status icon.
 */
export class SummaryNode extends vscode.TreeItem {
  constructor(label: string, status: 'pass' | 'fail' | 'warn' | 'info') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'summary-item';
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
