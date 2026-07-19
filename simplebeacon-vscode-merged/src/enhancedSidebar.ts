import * as vscode from 'vscode';
import { Finding } from './analyzers/workspaceAnalyzer';
import { RawIssue } from './scanProvider';

/**
 * Tree item node representing a scan progress indicator in the sidebar.
 */
export class ProgressNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly progress: number,
    public readonly total: number,
    public readonly color: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'progress';
    this.tooltip = `${progress} of ${total} items`;
    this.description = this.createProgressBar();
    this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor(color));
  }

  private createProgressBar(): string {
    const raw = this.total > 0 ? (this.progress / this.total) * 100 : 0;
    const percentage = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
    const filled = Math.max(0, Math.min(10, Math.round(percentage / 10)));
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
  }
}

/**
 * Tree item displaying a metric value with optional trend indicator.
 */
export class MetricNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly value: string | number,
    public readonly icon: string,
    public readonly color: string,
    public readonly trend?: 'up' | 'down' | 'stable'
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'metric';
    this.description = String(value);
    this.tooltip = `${label}: ${value}`;

    let iconSuffix = '';
    if (trend === 'up') iconSuffix = '~arrow-up';
    else if (trend === 'down') iconSuffix = '~arrow-down';

    this.iconPath = new vscode.ThemeIcon(icon + iconSuffix, new vscode.ThemeColor(color));
  }
}

/**
 * Tree item grouping a set of quick action nodes.
 */
export class ActionGroupNode extends vscode.TreeItem {
  public readonly children: vscode.TreeItem[];

  constructor(label: string, icon: string, color: string, children: vscode.TreeItem[]) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'action-group';
    this.children = children;
    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
    this.description = `${children.length} actions`;
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
    public readonly color: string,
    public readonly shortcut?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'quick-action';
    this.command = command;
    this.tooltip = shortcut ? `${label} (${shortcut})` : label;
    this.description = shortcut;
    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
  }
}

/**
 * Tree item displaying a status card with icon and optional action.
 */
export class StatusCardNode extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly status: 'pass' | 'fail' | 'warn' | 'info' | 'loading',
    public readonly details?: string,
    public readonly actionable: boolean = false
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'status-card';
    this.tooltip = details ? `${label}: ${details}` : label;
    this.description = details || '';

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

    if (actionable && status !== 'loading') {
      this.command = {
        command: 'simplebeacon.showReport',
        title: 'View Details',
        arguments: [],
      };
    }
  }
}

/**
 * Tree item grouping findings by severity level.
 */
export class FindingGroupNode extends vscode.TreeItem {
  public readonly severity: string;
  public readonly count: number;
  public readonly children: FindingNode[];

  constructor(severity: string, count: number, children: FindingNode[]) {
    const label = `${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues (${count})`;
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'finding-group';
    this.severity = severity;
    this.count = count;
    this.children = children;

    const iconMap: Record<string, string> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
      critical: 'error',
    };

    const colorMap: Record<string, string> = {
      high: 'testing.iconFailed',
      medium: 'testing.iconQueued',
      low: 'testing.iconPassed',
      critical: 'testing.iconFailed',
    };

    this.iconPath = new vscode.ThemeIcon(
      iconMap[severity] || 'info',
      new vscode.ThemeColor(colorMap[severity] || 'info')
    );
    this.description = `${count} ${severity} severity`;
  }
}

/**
 * Tree item representing a single security finding with file location.
 */
export class FindingNode extends vscode.TreeItem {
  public readonly file: string;
  public readonly line: number;
  public readonly category: string;
  public readonly severity: string;

  constructor(label: string, file: string, line: number, category: string, severity: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'finding';
    this.file = file;
    this.line = line;
    this.category = category;
    this.severity = severity;

    const fileName = file.split(/[\\/]/).pop();
    this.description = `${fileName}:${line}`;
    this.tooltip = `${category} • ${severity.toUpperCase()} • ${file}:${line}`;

    const iconMap: Record<string, string> = {
      high: 'error',
      medium: 'warning',
      low: 'info',
      critical: 'error',
    };

    this.iconPath = new vscode.ThemeIcon(iconMap[severity] || 'info');
    this.command = {
      command: 'simplebeacon.openFinding',
      title: 'Open Finding',
      arguments: [file, line],
    };
  }
}

/**
 * Tree item showing the current scan progress with file info.
 */
export class ScanProgressNode extends vscode.TreeItem {
  constructor(
    public readonly phase: string,
    public readonly progress: number,
    public readonly total: number,
    public readonly currentFile?: string
  ) {
    const label = phase;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'scan-progress';

    const raw = this.total > 0 ? (this.progress / this.total) * 100 : 0;
    const percentage = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
    this.description = `${percentage}%${currentFile ? ` • ${currentFile.split(/[\\/]/).pop()}` : ''}`;
    this.tooltip = `${phase}: ${this.progress} of ${this.total} files${currentFile ? ` (${currentFile})` : ''}`;

    const isLoading = this.total > 0 ? this.progress < this.total : this.progress === 0;
    if (isLoading) {
      this.iconPath = new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('editor.foreground'));
    } else {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    }
  }
}

/**
 * Tree item displaying a code health score with visual indicators.
 */
export class HealthScoreNode extends vscode.TreeItem {
  constructor(
    public readonly score: number,
    public readonly maxScore: number = 100
  ) {
    const label = `Health Score`;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'health-score';

    const rawPct = this.maxScore > 0 ? (score / this.maxScore) * 100 : 0;
    const percentage = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, Math.round(rawPct))) : 0;
    this.description = `${score}/${maxScore} (${percentage}%)`;
    this.tooltip = `Code health score: ${score}/${maxScore}`;

    let color: string;
    let icon: string;

    if (score >= 80) {
      color = 'testing.iconPassed';
      icon = 'trophy';
    } else if (score >= 60) {
      color = 'testing.iconQueued';
      icon = 'warning';
    } else {
      color = 'testing.iconFailed';
      icon = 'error';
    }

    this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));

    // Create visual score representation
    const stars = Math.round((score / maxScore) * 5);
    this.resourceUri = vscode.Uri.parse(`simplebeacon:score/${stars}`);
  }
}

/**
 * Tree item representing a recent scan result entry.
 */
export class RecentScanNode extends vscode.TreeItem {
  constructor(
    public readonly timestamp: Date,
    public readonly score: number,
    public readonly gateStatus: boolean,
    public readonly findingsCount: number
  ) {
    const timeStr = timestamp.toLocaleTimeString();
    const dateStr = timestamp.toLocaleDateString();
    const label = `${dateStr} ${timeStr}`;

    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'recent-scan';

    const status = gateStatus ? 'PASS' : 'FAIL';
    const statusIcon = gateStatus ? 'check' : 'error';
    const statusColor = gateStatus ? 'testing.iconPassed' : 'testing.iconFailed';

    this.description = `Score: ${score} • Gate: ${status} • ${findingsCount} findings`;
    this.tooltip = `Scan from ${timestamp.toLocaleString()}\nScore: ${score}/100\nGate: ${status}\nFindings: ${findingsCount}`;

    this.iconPath = new vscode.ThemeIcon(statusIcon, new vscode.ThemeColor(statusColor));

    this.command = {
      command: 'simplebeacon.showReport',
      title: 'View Scan Report',
      arguments: [],
    };
  }
}

/**
 * Utility helper for creating enhanced sidebar tree nodes.
 */
export class SidebarUIHelper {
  static createProgressSection(current: number, total: number, label: string): ProgressNode {
    const color = current === total ? 'testing.iconPassed' : 'editor.foreground';
    return new ProgressNode(label, current, total, color);
  }

  static createMetricSection(
    label: string,
    value: number | string,
    icon: string,
    trend?: 'up' | 'down' | 'stable'
  ): MetricNode {
    let color = 'editor.foreground';
    if (typeof value === 'number') {
      if (value >= 80) color = 'testing.iconPassed';
      else if (value >= 60) color = 'testing.iconQueued';
      else color = 'testing.iconFailed';
    }
    return new MetricNode(label, value, icon, color, trend);
  }

  static createActionGroup(label: string, actions: QuickActionNode[]): ActionGroupNode {
    return new ActionGroupNode(label, 'gear', 'editor.foreground', actions);
  }

  static createQuickAction(label: string, command: string, icon: string, shortcut?: string): QuickActionNode {
    return new QuickActionNode(label, { command, title: label }, icon, 'editor.foreground', shortcut);
  }

  static createStatusCard(
    label: string,
    status: 'pass' | 'fail' | 'warn' | 'info' | 'loading',
    details?: string
  ): StatusCardNode {
    return new StatusCardNode(label, status, details, status !== 'loading');
  }

  static createFindingGroups(findings: unknown[]): FindingGroupNode[] {
    const fnd = findings as RawIssue[];
    const grouped = fnd.reduce((acc: Record<string, RawIssue[]>, finding: RawIssue) => {
      const severity = finding.severity || 'medium';
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(finding);
      return acc;
    }, {});

    return Object.entries(grouped).map(([severity, items]: [string, RawIssue[]]) => {
      const findingNodes = items.map(
        (item: RawIssue) =>
          new FindingNode(
            item.description || item.type || 'Finding',
            item.file || item.path || '',
            item.line || 1,
            item.category || 'General',
            severity
          )
      );
      return new FindingGroupNode(severity, items.length, findingNodes);
    });
  }

  static createHealthScore(score: number, maxScore?: number): HealthScoreNode {
    return new HealthScoreNode(score, maxScore);
  }

  static createRecentScan(timestamp: Date, score: number, gateStatus: boolean, findingsCount: number): RecentScanNode {
    return new RecentScanNode(timestamp, score, gateStatus, findingsCount);
  }
}
