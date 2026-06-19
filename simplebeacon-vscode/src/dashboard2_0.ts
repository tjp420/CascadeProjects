import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { themeColors } from './designSystem';
import { RawIssue } from './scanProvider';

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

export class Dashboard20 {
  private static currentPanel: Dashboard20 | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private report: Dashboard20Report | undefined;

  public static createOrShow(extUri: vscode.Uri, report?: Dashboard20Report) {
    const col = vscode.ViewColumn.One;
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
    this.panel.onDidDispose(() => { Dashboard20.currentPanel = undefined; }, null, []);
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.render();
  }

  public update(report: Dashboard20Report) {
    this.report = report;
    this.render();
  }

  private handleMessage(msg: { command: string; file?: string; line?: number }) {
    switch (msg.command) {
      case 'openFile':
        if (msg.file) {
          vscode.window.showTextDocument(vscode.Uri.file(msg.file), {
            selection: new vscode.Range((msg.line || 1) - 1, 0, (msg.line || 1) - 1, 0)
          });
        }
        break;
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
      case 'showCodeMap':
        vscode.commands.executeCommand('simplebeacon.showCodeMap');
        break;
      case 'openInBrowser':
        this.openInBrowser();
        break;
    }
  }

  private openInBrowser() {
    const html = this.buildHtml();
    const tmpFile = path.join(this.extUri.fsPath, 'simplebeacon-dashboard-20.html');
    fs.writeFileSync(tmpFile, html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ''));
    vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.file(tmpFile).toString());
  }

  private render() {
    this.panel.webview.html = this.buildHtml();
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
      Blocking: '#ef4444', Secrets: '#ef4444', 'AI Indicators': '#f59e0b', 'EU AI Act': '#f59e0b',
      Vulnerabilities: '#ef4444', 'Debug Markers': '#3b82f6', 'AI Residue': '#f59e0b',
      Performance: '#f59e0b', 'Type Safety': '#3b82f6', 'Test Coverage': '#10b981',
      Accessibility: '#3b82f6', i18n: '#3b82f6', 'Sensitive Data': '#ef4444', 'Config Drift': '#f59e0b',
      'Security Headers': '#ef4444', 'Database Patterns': '#ef4444', 'Framework Practices': '#f59e0b',
      'Workspace Health': '#3b82f6', 'Unused Deps': '#10b981', 'API Contract': '#3b82f6',
      Complexity: '#f59e0b', 'LLM Slop': '#3b82f6', 'Token Bleed': '#3b82f6', 'Production Leak': '#ef4444',
      'Fiction KPI': '#f59e0b', Security: '#ef4444', Quality: '#f59e0b', Maintainability: '#3b82f6',
    };

    const findingsJson = JSON.stringify(allFindings.map((f) => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) })));
    const catOptions = categories.map((c) => `<option value="${c.label}">${c.label}</option>`).join('');
    const catColorJson = JSON.stringify(catColorMap);
    const failingFiles = this.buildFailingFiles(r);

    const templatePath = path.join(this.extUri.fsPath, 'media', 'dashboard2_0.html');
    let html = fs.existsSync(templatePath)
      ? fs.readFileSync(templatePath, 'utf8')
      : this.fallbackTemplate();

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
      for (const [cat, items] of Object.entries(report.categories)) {
        if (Array.isArray(items) && items.length > 0) {
          cats.push({ label: cat, count: items.length, severity: 'info' });
        }
      }
      return cats;
    }
    const push = (label: string, sev: string, items?: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };
    push('Blocking', 'fail', report.gate?.blockingIssues as any);
    push('Secrets', 'fail', (report as any).credentialHygiene?.secrets);
    push('Vulnerabilities', 'fail', (report as any).dependencyAudit?.vulnerabilities);
    push('Debug Markers', 'low', (report as any).cleanup?.debugMarkers);
    push('AI Residue', 'medium', (report as any).aiResidue?.aiResidueFindings);
    push('Performance', 'medium', (report as any).performance?.performanceFindings);
    push('Type Safety', 'low', (report as any).typeSafety?.typeSafetyFindings);
    push('Test Coverage', 'low', (report as any).testCoverage?.testCoverageFindings);
    push('Sensitive Data', 'high', (report as any).sensitiveData?.sensitiveDataFindings);
    push('Config Drift', 'medium', (report as any).configDrift?.configDriftFindings);
    push('Security Headers', 'high', (report as any).securityHeaders?.securityHeaderFindings);
    push('Database Patterns', 'high', (report as any).databasePatterns?.dbPatternFindings);
    push('Framework Practices', 'medium', (report as any).frameworkPractices?.frameworkFindings);
    push('Workspace Health', 'low', (report as any).workspaceHealth?.workspaceFindings);
    push('Unused Deps', 'low', (report as any).unusedDeps?.unusedDepFindings);
    push('Complexity', 'medium', (report as any).complexity?.complexityFindings);
    push('LLM Slop', 'medium', (report as any).llmSlop?.llmSlopFindings);
    push('Production Leak', 'high', (report as any).productionLeak?.productionLeakFindings);
    push('Security', 'high', (report as any).security?.securityFindings);
    push('Quality', 'medium', (report as any).quality?.qualityFindings);

    if (cats.length === 0 && (report as any).detectedIssues?.length) {
      for (const di of (report as any).detectedIssues) {
        cats.push({ label: di.type || 'Finding', count: di.count || 0, severity: di.severity || 'medium' });
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
    if (issue.filePath) { return issue.filePath; }
    if (issue.file) { return issue.file; }
    const desc = issue.description || '';
    const m = desc.match(/^['\"]?([^:]+?\.(?:json|js|ts|html|css|cjs|mjs|md|txt|jsx|tsx|vue|py|go|rs|java|rb|php|cs|cpp|c|h|swift|kt|scala|xml|yaml|yml|toml|sh|ps1|bat|cmd|ini|cfg|conf|log))['\"]?(\s*[:;]|$)/i);
    return m ? m[1].trim() : '';
  }

  private extractAllFindings(report: Dashboard20Report): { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] {
    const all: { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] = [];
    if (report.categories && typeof report.categories === 'object' && !Array.isArray(report.categories)) {
      for (const [cat, items] of Object.entries(report.categories)) {
        if (!Array.isArray(items)) continue;
        for (const it of items) {
          all.push({ cat, sev: it.severity || 'medium', desc: it.message || it.type || 'Finding', file: it.file || '', line: it.line ?? '', patternId: it.patternId || '' });
        }
      }
      return all;
    }
    const push = (cat: string, sev: string, items?: RawIssue[]) => {
      items?.forEach((it) => all.push({ cat, sev: it.severity || sev, desc: it.description || it.message || it.type || 'Finding', file: this.resolveFilePath(it), line: it.line || '', patternId: it.patternId || '' }));
    };
    if ((report as any).detectedIssues?.length) {
      for (const di of (report as any).detectedIssues) {
        for (const f of di.findings || []) {
          const firstMatch = (f.matches || [])[0] || {};
          all.push({ cat: di.type || 'Finding', sev: firstMatch.dynamicSeverity || firstMatch.baseSeverity || di.severity || 'medium', desc: f.type || di.type || 'Finding', file: f.file || '', line: firstMatch.line || '', patternId: di.rule || '' });
        }
      }
      return all;
    }
    if (report.rawIssues?.length) {
      report.rawIssues.forEach((it) => all.push({ cat: it.type || 'Finding', sev: it.severity || 'medium', desc: it.description || it.type || 'Finding', file: this.resolveFilePath(it), line: it.line || '' }));
      return all;
    }
    push('Blocking', 'high', report.gate?.blockingIssues as any);
    push('Secrets', 'high', (report as any).credentialHygiene?.secrets);
    push('Vulnerabilities', 'high', (report as any).dependencyAudit?.vulnerabilities);
    push('Debug Markers', 'low', (report as any).cleanup?.debugMarkers);
    push('AI Residue', 'medium', (report as any).aiResidue?.aiResidueFindings);
    push('Performance', 'medium', (report as any).performance?.performanceFindings);
    push('Type Safety', 'low', (report as any).typeSafety?.typeSafetyFindings);
    push('Sensitive Data', 'high', (report as any).sensitiveData?.sensitiveDataFindings);
    push('Config Drift', 'medium', (report as any).configDrift?.configDriftFindings);
    push('Security Headers', 'high', (report as any).securityHeaders?.securityHeaderFindings);
    push('Database Patterns', 'high', (report as any).databasePatterns?.dbPatternFindings);
    push('Framework Practices', 'medium', (report as any).frameworkPractices?.frameworkFindings);
    push('Workspace Health', 'low', (report as any).workspaceHealth?.workspaceFindings);
    push('Unused Deps', 'low', (report as any).unusedDeps?.unusedDepFindings);
    push('Complexity', 'medium', (report as any).complexity?.complexityFindings);
    push('LLM Slop', 'medium', (report as any).llmSlop?.llmSlopFindings);
    push('Production Leak', 'high', (report as any).productionLeak?.productionLeakFindings);
    push('Security', 'high', (report as any).security?.securityFindings);
    push('Quality', 'medium', (report as any).quality?.qualityFindings);
    return all;
  }

  private buildFailingFiles(report: Dashboard20Report): string {
    const fileMap = new Map<string, { severity: string; desc: string; line: number }[]>();
    const issues = report.detectedIssues || report.rawIssues || report.findings || [];
    for (const issue of issues) {
      const fp = this.resolveFilePath(issue) || 'Unknown';
      if (!fileMap.has(fp)) fileMap.set(fp, []);
      fileMap.get(fp)!.push({ severity: issue.severity || 'medium', desc: issue.description || issue.type || 'Issue', line: issue.line || 1 });
    }
    const sorted = Array.from(fileMap.entries())
      .map(([file, iss]) => ({ file, issues: iss }))
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 20);
    if (!sorted.length) return '<tr><td colspan="4" style="text-align:center;padding:2rem">No issues found</td></tr>';
    return sorted.map((f) => {
      const counts = f.issues.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {} as Record<string, number>);
      const badges = Object.entries(counts).map(([sev, c]) => {
        const color = sev === 'high' || sev === 'critical' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
        return `<span style="background:${color}12;color:${color};padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px">${sev}: ${c}</span>`;
      }).join('');
      const safeFile = this.escapeHtml(f.file);
      const name = f.file.split(/[/\\]/).pop() || f.file;
      return `<tr><td><span class="file-link failing-file-link" data-file="${safeFile}">${this.escapeHtml(name)}</span></td><td>${f.issues.length}</td><td>${badges}</td><td><button class="btn" data-cmd="openFile" data-file="${safeFile}" style="padding:4px 8px;font-size:12px">Open</button></td></tr>`;
    }).join('');
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
  }

  private fallbackTemplate(): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="padding:40px;font-family:sans-serif">
      <h1>SimpleBeacon Dashboard 2.0</h1><p>Template file not found at media/dashboard2_0.html</p></body></html>`;
  }
}
