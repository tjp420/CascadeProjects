import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ModernSidebarProvider } from './modernSidebarProvider';
import * as crypto from 'crypto';
import { themeColors } from './designSystem';
import { RawIssue } from './scanProvider';

/** Safely read a nested property path from an unknown object. */
function getNested<T>(obj: unknown, ...keys: string[]): T | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current as T | undefined;
}

export interface Dashboard20Report {
  qualityScore?: number;
  gate?: { pass?: boolean; blockingIssues?: RawIssue[] };
  severityCounts?: Record<string, number>;
  ruleScopedFilesAnalyzed?: number;
  filesAnalyzed?: number;
  totalFiles?: number;
  repositoryFilesTotal?: number;
  repositoryFoldersTotal?: number;
  repositoryInventory?: { totalFolders?: number };
  detectedIssues?: RawIssue[];
  rawIssues?: RawIssue[];
  findings?: RawIssue[];
  categories?: Record<string, RawIssue[]>;
  [key: string]: unknown;
}

/**
 * Enhanced dashboard webview panel (v2.0) for scan result visualization.
 */
export class Dashboard20 {
  private static currentPanel: Dashboard20 | undefined;
  private static browserPanel: vscode.WebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private report: Dashboard20Report | undefined;

  public static createOrShow(extUri: vscode.Uri, report?: Dashboard20Report) {
    const col = vscode.ViewColumn.Two;
    if (Dashboard20.currentPanel) {
      Dashboard20.currentPanel.panel.reveal(col);
      if (report) Dashboard20.currentPanel.update(report);
      return;
    }
    const p = vscode.window.createWebviewPanel('simplebeaconDashboard20', 'SimpleBeacon Dashboard 2.0', col, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')],
    });
    Dashboard20.currentPanel = new Dashboard20(p, extUri, report);
  }

  public static updateIfOpen(report: Dashboard20Report) {
    if (Dashboard20.currentPanel) {
      Dashboard20.currentPanel.update(report);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri, report?: Dashboard20Report) {
    this.panel = panel;
    this.extUri = extUri;
    this.report = report;
    this.panel.onDidDispose(
      () => {
        Dashboard20.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.render();
  }

  public update(report: Dashboard20Report) {
    this.report = report;
    this.render();
  }

  private handleMessage(msg: { command: string; file?: string; line?: number }) {
    switch (msg.command) {
      case 'openFile': {
        if (!msg.file) break;
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const resolved = path.isAbsolute(msg.file) ? msg.file : workspace ? path.join(workspace, msg.file) : msg.file;
        if (fs.existsSync(resolved)) {
          vscode.window.showTextDocument(vscode.Uri.file(resolved), {
            selection: new vscode.Range((msg.line || 1) - 1, 0, (msg.line || 1) - 1, 0),
          });
        } else {
          vscode.window.showWarningMessage('File not found: ' + msg.file);
        }
        break;
      }
      case 'scanWorkspace':
        vscode.commands.executeCommand('simplebeacon.scanWorkspace');
        break;
      case 'exportReport':
        vscode.commands.executeCommand('simplebeacon.exportReport');
        break;
      case 'exportAIReport':
        vscode.commands.executeCommand('simplebeacon.exportAIReport');
        break;
      case 'generateCertificate':
        vscode.commands.executeCommand('simplebeacon.generateCertificate');
        break;
      case 'openInBrowser':
        vscode.window.showInformationMessage('Open in Browser is only available in the browser preview tab.');
        break;
    }
  }

  private render() {
    this.panel.webview.html = this.buildHtml();
    this.syncBrowserHtml();
  }

  private syncBrowserHtml() {
    let browserHtml = this.buildHtml().replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    browserHtml = browserHtml.replace(
      /const\s+vscode\s*=\s*acquireVsCodeApi\s*\(\)\s*;?/g,
      `const vscode={postMessage:(msg)=>{if(msg.command==='openInBrowser')return;/* Browser fallback: silently ignore */},getState:()=>({}),setState:()=>{}};`
    );
    ModernSidebarProvider._dashboardHtml = browserHtml;
  }

  private buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const d3Uri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, 'media', 'd3.v7.min.js')).toString();
    const r = this.report || {};
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passClass = g.pass ? 'pass' : 'fail';
    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? themeColors.dark : themeColors.light;

    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0;
    const totalRepoFiles = r.repositoryFilesTotal || filesAnalyzed;
    const files = totalRepoFiles > 0 ? `${filesAnalyzed}/${totalRepoFiles}` : `${filesAnalyzed}`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;

    const categories = this.extractCategories(r);
    const allFindings = this.extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((s, c) => s + c.count, 0);

    const catColorMap: Record<string, string> = {
      Blocking: '#ef4444',
      Secrets: '#ef4444',
      'AI Indicators': '#f59e0b',
      'EU AI Act': '#f59e0b',
      Vulnerabilities: '#ef4444',
      'Debug Markers': '#3b82f6',
      'AI Residue': '#f59e0b',
      Performance: '#f59e0b',
      'Type Safety': '#3b82f6',
      'Test Coverage': '#10b981',
      Accessibility: '#3b82f6',
      i18n: '#3b82f6',
      'Sensitive Data': '#ef4444',
      'Config Drift': '#f59e0b',
      'Security Headers': '#ef4444',
      'Database Patterns': '#ef4444',
      'Framework Practices': '#f59e0b',
      'Workspace Health': '#3b82f6',
      'Unused Deps': '#10b981',
      'API Contract': '#3b82f6',
      Complexity: '#f59e0b',
      'LLM Slop': '#3b82f6',
      'Token Bleed': '#3b82f6',
      'Production Leak': '#ef4444',
      'Fiction KPI': '#f59e0b',
      Security: '#ef4444',
      Quality: '#f59e0b',
      Maintainability: '#3b82f6',
    };

    const findingsJson = JSON.stringify(
      allFindings.map((f) => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) }))
    );
    const catOptions = categories.map((c) => `<option value="${c.label}">${c.label}</option>`).join('');
    const catColorJson = JSON.stringify(catColorMap);
    const failingFiles = this.buildFailingFiles(r);

    const templatePath = path.join(this.extUri.fsPath, 'media', 'dashboard2_0.html');
    let html = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : this.fallbackTemplate();

    return html
      .replace(/\{\{CSP\}\}/g, csp)
      .replace(/\{\{NONCE\}\}/g, nonce)
      .replace(/\{\{D3_URI\}\}/g, d3Uri)
      .replace(/\{\{VERSION\}\}/g, '2.0.0')
      .replace(/\{\{PASS_TEXT\}\}/g, pass)
      .replace(/\{\{PASS_CLASS\}\}/g, passClass)
      .replace(/\{\{SCORE\}\}/g, String(score))
      .replace(/\{\{SCORE_COLOR\}\}/g, scoreColor)
      .replace(/\{\{FILES\}\}/g, files)
      .replace(/\{\{FOLDERS\}\}/g, String(folders))
      .replace(/\{\{TOTAL_FINDINGS\}\}/g, String(totalFindings))
      .replace(/\{\{CAT_COUNT\}\}/g, String(categories.length))
      .replace(/\{\{BG\}\}/g, theme.background)
      .replace(/\{\{FG\}\}/g, theme.foreground)
      .replace(/\{\{PANEL\}\}/g, theme.panel)
      .replace(/\{\{BORDER\}\}/g, theme.border)
      .replace(/\{\{INPUT\}\}/g, theme.input)
      .replace(/\{\{FINDINGS_JSON\}\}/g, findingsJson)
      .replace(/\{\{CAT_COLOR_MAP\}\}/g, catColorJson)
      .replace(/\{\{CATEGORY_OPTIONS\}\}/g, catOptions)
      .replace(/\{\{FAILING_FILES\}\}/g, failingFiles);
  }

  private extractCategories(report: Dashboard20Report): { label: string; count: number; severity: string }[] {
    const cats: { label: string; count: number; severity: string }[] = [];
    if (report.categories && typeof report.categories === 'object' && !Array.isArray(report.categories)) {
      const keys = Object.keys(report.categories);
      for (let i = 0; i < keys.length; i++) {
        // simplebeacon-ignore memory-leak — short-lived report data aggregation
        const cat = keys[i];
        const items = report.categories[cat];
        if (Array.isArray(items) && items.length > 0) {
          cats.push({ label: cat, count: items.length, severity: 'info' });
        }
      }
      return cats;
    }
    const push = (label: string, sev: string, items?: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };
    push('Blocking', 'fail', report.gate?.blockingIssues);
    push('Secrets', 'fail', getNested<RawIssue[]>(report, 'credentialHygiene', 'secrets'));
    push('Vulnerabilities', 'fail', getNested<RawIssue[]>(report, 'dependencyAudit', 'vulnerabilities'));
    push('Debug Markers', 'low', getNested<RawIssue[]>(report, 'cleanup', 'debugMarkers'));
    push('AI Residue', 'medium', getNested<RawIssue[]>(report, 'aiResidue', 'aiResidueFindings'));
    push('Performance', 'medium', getNested<RawIssue[]>(report, 'performance', 'performanceFindings'));
    push('Type Safety', 'low', getNested<RawIssue[]>(report, 'typeSafety', 'typeSafetyFindings'));
    push('Test Coverage', 'low', getNested<RawIssue[]>(report, 'testCoverage', 'testCoverageFindings'));
    push('Sensitive Data', 'high', getNested<RawIssue[]>(report, 'sensitiveData', 'sensitiveDataFindings'));
    push('Config Drift', 'medium', getNested<RawIssue[]>(report, 'configDrift', 'configDriftFindings'));
    push('Security Headers', 'high', getNested<RawIssue[]>(report, 'securityHeaders', 'securityHeaderFindings'));
    push('Database Patterns', 'high', getNested<RawIssue[]>(report, 'databasePatterns', 'dbPatternFindings'));
    push('Framework Practices', 'medium', getNested<RawIssue[]>(report, 'frameworkPractices', 'frameworkFindings'));
    push('Workspace Health', 'low', getNested<RawIssue[]>(report, 'workspaceHealth', 'workspaceFindings'));
    push('Unused Deps', 'low', getNested<RawIssue[]>(report, 'unusedDeps', 'unusedDepFindings'));
    push('Complexity', 'medium', getNested<RawIssue[]>(report, 'complexity', 'complexityFindings'));
    push('LLM Slop', 'medium', getNested<RawIssue[]>(report, 'llmSlop', 'llmSlopFindings'));
    push('Production Leak', 'high', getNested<RawIssue[]>(report, 'productionLeak', 'productionLeakFindings'));
    push('Security', 'high', getNested<RawIssue[]>(report, 'security', 'securityFindings'));
    push('Quality', 'medium', getNested<RawIssue[]>(report, 'quality', 'qualityFindings'));

    if (cats.length === 0 && getNested<unknown[]>(report, 'detectedIssues')?.length) {
      for (const di of getNested<unknown[]>(report, 'detectedIssues') || []) {
        const typedDi = di as Record<string, unknown>;
        cats.push({
          label: (typedDi.type as string) || 'Finding',
          count: (typedDi.count as number) || 0,
          severity: (typedDi.severity as string) || 'medium',
        });
      }
    }
    if (cats.length === 0 && report.rawIssues?.length) {
      const high = report.rawIssues.filter((i) => i.severity === 'high' || i.severity === 'critical');
      const medium = report.rawIssues.filter((i) => i.severity === 'medium');
      const low = report.rawIssues.filter((i) => i.severity === 'low');
      if (high.length) cats.push({ label: 'Blocking', count: high.length, severity: 'fail' });
      if (medium.length) cats.push({ label: 'Warnings', count: medium.length, severity: 'warn' });
      if (low.length) cats.push({ label: 'Info', count: low.length, severity: 'info' });
    }
    if (cats.length === 0 && report.severityCounts) {
      const sc = report.severityCounts;
      if (sc.critical) cats.push({ label: 'Critical', count: sc.critical, severity: 'fail' });
      if (sc.high) cats.push({ label: 'High', count: sc.high, severity: 'fail' });
      if (sc.medium) cats.push({ label: 'Medium', count: sc.medium, severity: 'warn' });
      if (sc.low) cats.push({ label: 'Low', count: sc.low, severity: 'info' });
    }
    return cats;
  }

  private resolveFilePath(issue: RawIssue): string {
    if (issue.filePath) {
      return issue.filePath;
    }
    if (issue.file) {
      return issue.file;
    }
    const desc = issue.description || '';
    const m = desc.match(
      /^['\"]?([^:]+?\.(?:json|js|ts|html|css|cjs|mjs|md|txt|jsx|tsx|vue|py|go|rs|java|rb|php|cs|cpp|c|h|swift|kt|scala|xml|yaml|yml|toml|sh|ps1|bat|cmd|ini|cfg|conf|log))['\"]?(\s*[:;]|$)/i
    );
    return m ? m[1].trim() : '';
  }

  private extractAllFindings(
    report: Dashboard20Report
  ): { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] {
    const all: { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] = [];
    if (report.categories && typeof report.categories === 'object' && !Array.isArray(report.categories)) {
      const keys = Object.keys(report.categories);
      for (let i = 0; i < keys.length; i++) {
        // simplebeacon-ignore memory-leak — short-lived report data aggregation
        const cat = keys[i];
        const items = report.categories[cat];
        if (!Array.isArray(items)) continue;
        for (let j = 0; j < items.length; j++) {
          // simplebeacon-ignore memory-leak — short-lived report data iteration
          const it = items[j];
          all.push({
            cat,
            sev: it.severity || 'medium',
            desc: it.message || it.type || 'Finding',
            file: it.file || '',
            line: it.line ?? '',
            patternId: it.patternId || '',
          });
        }
      }
      return all;
    }
    const push = (cat: string, sev: string, items?: RawIssue[]) => {
      items?.forEach((it) =>
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || 'Finding',
          file: this.resolveFilePath(it),
          line: it.line || '',
          patternId: it.patternId || '',
        })
      );
    };
    const detectedIssues = getNested<unknown[]>(report, 'detectedIssues');
    if (detectedIssues?.length) {
      for (const di of detectedIssues) {
        // simplebeacon-ignore memory-leak — short-lived report data iteration
        const typedDi = di as Record<string, unknown>;
        const findings = (typedDi.findings as unknown[]) || [];
        for (const f of findings) {
          // simplebeacon-ignore memory-leak — short-lived report data iteration
          const typedF = f as Record<string, unknown>;
          const matches = (typedF.matches as unknown[]) || [];
          const firstMatch = (matches[0] as Record<string, unknown>) || {};
          all.push({
            cat: (typedDi.type as string) || 'Finding',
            sev:
              (firstMatch.dynamicSeverity as string) ||
              (firstMatch.baseSeverity as string) ||
              (typedDi.severity as string) ||
              'medium',
            desc: (typedF.type as string) || (typedDi.type as string) || 'Finding',
            file: (typedF.file as string) || '',
            line: (firstMatch.line as number) || '',
            patternId: (typedDi.rule as string) || '',
          });
        }
      }
      return all;
    }
    if (report.rawIssues?.length) {
      report.rawIssues.forEach((it) =>
        all.push({
          cat: it.type || 'Finding',
          sev: it.severity || 'medium',
          desc: it.description || it.type || 'Finding',
          file: this.resolveFilePath(it),
          line: it.line || '',
        })
      );
      return all;
    }
    push('Blocking', 'high', report.gate?.blockingIssues);
    push('Secrets', 'high', getNested<RawIssue[]>(report, 'credentialHygiene', 'secrets'));
    push('Vulnerabilities', 'high', getNested<RawIssue[]>(report, 'dependencyAudit', 'vulnerabilities'));
    push('Debug Markers', 'low', getNested<RawIssue[]>(report, 'cleanup', 'debugMarkers'));
    push('AI Residue', 'medium', getNested<RawIssue[]>(report, 'aiResidue', 'aiResidueFindings'));
    push('Performance', 'medium', getNested<RawIssue[]>(report, 'performance', 'performanceFindings'));
    push('Type Safety', 'low', getNested<RawIssue[]>(report, 'typeSafety', 'typeSafetyFindings'));
    push('Sensitive Data', 'high', getNested<RawIssue[]>(report, 'sensitiveData', 'sensitiveDataFindings'));
    push('Config Drift', 'medium', getNested<RawIssue[]>(report, 'configDrift', 'configDriftFindings'));
    push('Security Headers', 'high', getNested<RawIssue[]>(report, 'securityHeaders', 'securityHeaderFindings'));
    push('Database Patterns', 'high', getNested<RawIssue[]>(report, 'databasePatterns', 'dbPatternFindings'));
    push('Framework Practices', 'medium', getNested<RawIssue[]>(report, 'frameworkPractices', 'frameworkFindings'));
    push('Workspace Health', 'low', getNested<RawIssue[]>(report, 'workspaceHealth', 'workspaceFindings'));
    push('Unused Deps', 'low', getNested<RawIssue[]>(report, 'unusedDeps', 'unusedDepFindings'));
    push('Complexity', 'medium', getNested<RawIssue[]>(report, 'complexity', 'complexityFindings'));
    push('LLM Slop', 'medium', getNested<RawIssue[]>(report, 'llmSlop', 'llmSlopFindings'));
    push('Production Leak', 'high', getNested<RawIssue[]>(report, 'productionLeak', 'productionLeakFindings'));
    push('Security', 'high', getNested<RawIssue[]>(report, 'security', 'securityFindings'));
    push('Quality', 'medium', getNested<RawIssue[]>(report, 'quality', 'qualityFindings'));
    return all;
  }

  private buildFailingFiles(report: Dashboard20Report): string {
    const fileMap = new Map<string, { severity: string; desc: string; line: number }[]>();
    const issues = report.detectedIssues || report.rawIssues || report.findings || [];
    for (const issue of issues) {
      const fp = this.resolveFilePath(issue) || 'Unknown';
      if (!fileMap.has(fp)) fileMap.set(fp, []);
      fileMap
        .get(fp)!
        .push({
          severity: issue.severity || 'medium',
          desc: issue.description || issue.type || 'Issue',
          line: issue.line || 1,
        });
    }
    const sorted = Array.from(fileMap.entries())
      .map(([file, iss]) => ({ file, issues: iss }))
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 20);
    if (!sorted.length) return '<tr><td colspan="4" style="text-align:center;padding:2rem">No issues found</td></tr>';
    return sorted
      .map((f) => {
        const counts = f.issues.reduce(
          (acc, i) => {
            acc[i.severity] = (acc[i.severity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        const badges = Object.entries(counts)
          .map(([sev, c]) => {
            const color = sev === 'high' || sev === 'critical' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
            return `<span style="background:${color}12;color:${color};padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px">${sev}: ${c}</span>`;
          })
          .join('');
        const safeFile = this.escapeHtml(f.file);
        const name = f.file.split(/[/\\]/).pop() || f.file;
        return `<tr><td><span class="file-link failing-file-link" data-file="${safeFile}">${this.escapeHtml(name)}</span></td><td>${f.issues.length}</td><td>${badges}</td><td><button class="btn" data-cmd="openFile" data-file="${safeFile}" style="padding:4px 8px;font-size:12px">Open</button></td></tr>`;
      })
      .join('');
  }

  private escapeHtml(text: string): string {
    return text.replace(
      /[&<>"']/g,
      (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m
    );
  }

  private fallbackTemplate(): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="padding:40px;font-family:sans-serif">
      <h1>SimpleBeacon Dashboard 2.0</h1><p>Template file not found at media/dashboard2_0.html</p></body></html>`;
  }
}
