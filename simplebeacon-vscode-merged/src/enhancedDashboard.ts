import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { RawIssue } from './scanProvider';

function getVersionFromExtUri(extUri: vscode.Uri): string {
  try {
    const pkgPath = path.join(extUri.fsPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return (pkg.version as string) || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Legacy enhanced dashboard webview panel for scan result visualization.
 */
export class EnhancedDashboard {
  private static currentPanel: EnhancedDashboard | undefined;
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private report: unknown;
  private highlight: string | null;
  private hasEnhancedAnalysis: boolean;
  private version: string;

  static updateCurrentPanel(report: unknown): void {
    EnhancedDashboard.currentPanel?.update(report);
  }

  static postMessage(message: any): void {
    EnhancedDashboard.currentPanel?.panel.webview.postMessage(message);
  }

  static createOrShow(extUri: vscode.Uri, report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (EnhancedDashboard.currentPanel) {
      EnhancedDashboard.currentPanel.panel.reveal(col);
      EnhancedDashboard.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'simplebeaconEnhanced',
      'SimpleBeacon Dashboard',
      col || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')] }
    );
    EnhancedDashboard.currentPanel = new EnhancedDashboard(
      panel,
      extUri,
      report,
      highlight ?? null,
      hasEnhancedAnalysis ?? false
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extUri: vscode.Uri,
    report: unknown,
    highlight: string | null,
    hasEnhancedAnalysis: boolean
  ) {
    this.panel = panel;
    this.extUri = extUri;
    this.report = report;
    this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    this.version = getVersionFromExtUri(extUri);
    this.panel.onDidDispose(
      () => {
        EnhancedDashboard.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'openFile') {
        if (
          !msg.file ||
          msg.file === 'missing-env-key' ||
          msg.file === 'Unknown' ||
          !/\.[a-zA-Z]{1,6}$/.test(msg.file)
        ) {
          vscode.window.showWarningMessage(`Cannot open file: invalid path "${msg.file}"`);
          return;
        }
        const uri = vscode.Uri.file(msg.file);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(msg.line - 1, 0, msg.line - 1, 0) });
      } else if (msg.command === 'scanWorkspace') {
        vscode.commands.executeCommand('simplebeacon.scanWorkspace');
      } else if (msg.command === 'enhancedAnalysis') {
        vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
      } else if (msg.command === 'exportReport') {
        vscode.commands.executeCommand('simplebeacon.exportReport');
      } else if (msg.command === 'generateCertificate') {
        vscode.commands.executeCommand('simplebeacon.generateCertificate');
      } else if (msg.command === 'exportAIReport') {
        vscode.commands.executeCommand('simplebeacon.exportAIReport');
      } else if (msg.command === 'sendToAI') {
        vscode.commands.executeCommand('simplebeacon.exportAIReport');
      } else if (msg.command === 'showRemediationGuide') {
        vscode.commands.executeCommand('simplebeacon.showRemediationGuide');
      } else if (msg.command === 'suggestFix') {
        this.handleSuggestFix(msg.patternId, msg.file, msg.line);
      }
    });
    this.update(report, highlight);
  }

  update(report: unknown, highlight: string | null = null, hasEnhancedAnalysis: boolean = false) {
    this.report = report;
    this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    this.panel.webview.html = this.buildEnhancedHtml();
  }

  private buildEnhancedHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const r = this.report as any;
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passColor = g.pass ? '#10B981' : '#EF4444';
    const scoreColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    const passBg = g.pass ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
    const passBorder = g.pass ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)';
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0;
    const totalRepositoryFiles = r.repositoryFilesTotal || 0;
    const files = totalRepositoryFiles > 0 ? `${filesAnalyzed}/${totalRepositoryFiles}` : `${filesAnalyzed}`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    const categories = this.extractCategories(r);
    const allFindings = this.extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((sum, c) => sum + c.count, 0);
    const findingsJson = JSON.stringify(allFindings.map((f) => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) })));
    // Derive severity counts from actual findings so they always match the displayed data
    const crit = allFindings.filter((f) => f.sev === 'critical').length;
    const high = allFindings.filter((f) => f.sev === 'high').length;
    const med = allFindings.filter((f) => f.sev === 'medium').length;
    const low = allFindings.filter((f) => f.sev === 'low').length;
    const gaugeDash = Math.round(2 * Math.PI * 45);
    const gaugeOffset = Math.round(gaugeDash - (score / 100) * gaugeDash);
    const maxCat = Math.max(...categories.map((c) => c.count), 1);
    const categoryItems = categories.map((c) => {
      const color = c.severity === 'fail' ? '#EF4444' : c.severity === 'warn' ? '#F59E0B' : '#3B82F6';
      const pct = Math.round((c.count / maxCat) * 100);
      return `<div class="cat-row"><span class="cat-color" style="background:${color}"></span><span class="cat-name">${c.label}</span><div class="cat-bar"><div class="cat-fill" style="width:${pct}%;background:${color}"></div></div><span class="cat-count">${c.count}</span></div>`;
    }).join('');
    const categoryOptions = categories.map((c) => `<option value="${c.label}">${c.label}</option>`).join('');
    const failingFiles = this.extractFailingFiles(this.report);
    const failingFilesHtml = failingFiles.map((file) => {
      const sevMap: Record<string, number> = {};
      file.issues.forEach((i) => { sevMap[i.severity] = (sevMap[i.severity] || 0) + 1; });
      const sevBadges = Object.entries(sevMap).map(([s, c]) => {
        const color = s === 'critical' || s === 'high' ? '#EF4444' : s === 'medium' ? '#F59E0B' : '#10B981';
        return `<span class="flist-pill" style="background:${color}15;color:${color}">${s} ${c}</span>`;
      }).join('');
      const fileName = file.file.split(/[\\/]/).pop() || file.file;
      return `<div class="flist-row"><div style="flex:1;min-width:0"><div class="flist-name">${fileName}</div><div class="flist-path">${file.file}</div></div><div class="flist-count">${sevBadges}</div><div class="flist-actions"><button class="btn" style="padding:4px 10px;font-size:.7rem" onclick="vscode.postMessage({command:'openFile',file:'${file.file.replace(/\\/g, '\\\\')}',line:1})">Open</button></div></div>`;
    }).join('');

    const templatePath = path.join(this.extUri.fsPath, 'media', 'dashboardTemplate.html');
    let html = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : this.fallbackDashboardHtml();
    return html
      // Exact-match replacements FIRST (before regex /g that could match substrings)
      .replace('CATEGORY_ITEMS', categoryItems)
      .replace('CATEGORY_OPTIONS', categoryOptions)
      .replace('FAILING_FILES', failingFilesHtml)
      .replace('FINDINGS_JSON', findingsJson)
      .replace('METRIC_GRAD', scoreColor)
      // Then regex global replacements
      .replace(/NONCE/g, nonce)
      .replace(/CSP_SRC/g, csp)
      .replace(/SCORE_COLOR/g, scoreColor)
      .replace(/GAUGE_DASH/g, String(gaugeDash))
      .replace(/GAUGE_OFFSET/g, String(gaugeOffset))
      .replace(/PASS_TEXT/g, pass)
      .replace(/PASS_COLOR/g, passColor)
      .replace(/PASS_BG/g, passBg)
      .replace(/PASS_BORDER/g, passBorder)
      .replace(/SCORE/g, String(score))
      .replace(/VERSION/g, this.version)
      .replace(/FILES/g, files)
      .replace(/FOLDERS/g, String(folders))
      .replace(/FINDINGS/g, String(totalFindings))
      .replace(/CATS/g, String(categories.length))
      .replace(/CRIT/g, String(crit))
      .replace(/HIGH/g, String(high))
      .replace(/MED/g, String(med))
      .replace(/LOW/g, String(low));
  }

  private fallbackDashboardHtml(): string {
    return `<!DOCTYPE html><html><body style="background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family);padding:20px;text-align:center;"><h2>SimpleBeacon Dashboard</h2><p>Template not found. Please reinstall the extension.</p></body></html>`;
  }

  private extractCategories(
    report: unknown
  ): { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] = [];

    // ScanResult format: report.categories is Record<string, Finding[]>
    if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
      const severityMap: Record<string, 'pass' | 'fail' | 'warn' | 'info'> = {
        security: 'fail',
        debug: 'info',
        aiResidue: 'warn',
        performance: 'warn',
        typeSafety: 'info',
        testCoverage: 'info',
        accessibility: 'info',
        quality: 'warn',
        other: 'info',
      };
      for (const [cat, items] of Object.entries(r.categories)) {
        if (Array.isArray(items) && items.length > 0) {
          cats.push({ label: cat, count: items.length, severity: severityMap[cat] || 'info' });
        }
      }
    }

    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };

    // Build categories from rawIssues by actual issue type
    if (r.rawIssues?.length) {
      const typeMap = new Map<string, { count: number; sev: string }>();
      for (const it of r.rawIssues as RawIssue[]) {
        const type = it.type || 'Finding';
        const sev = it.severity || 'medium';
        const existing = typeMap.get(type);
        if (existing) {
          existing.count++;
          if (sev === 'critical' || sev === 'high') existing.sev = sev;
        } else {
          typeMap.set(type, { count: 1, sev });
        }
      }
      for (const [label, { count, sev }] of typeMap) {
        const sevClass = sev === 'critical' || sev === 'high' ? 'fail' : sev === 'medium' ? 'warn' : 'info';
        cats.push({ label, count, severity: sevClass as 'pass' | 'fail' | 'warn' | 'info' });
      }
      if (cats.length > 0) return cats;
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

    // Fallback: text-parsed reports only have severityCounts
    if (cats.length === 0 && r.severityCounts) {
      const sc = r.severityCounts;
      if (sc.critical) push('Critical', 'fail', new Array(sc.critical));
      if (sc.high) push('High', 'fail', new Array(sc.high));
      if (sc.medium) push('Medium', 'warn', new Array(sc.medium));
      if (sc.low) push('Low', 'info', new Array(sc.low));
    }

    return cats;
  }

  private extractAllFindings(
    report: unknown
  ): { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] {
    const r = report as any;
    const all: { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] = [];

    // ScanResult format: report.categories is Record<string, Finding[]>
    if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
      for (const [cat, items] of Object.entries(r.categories)) {
        if (!Array.isArray(items)) continue;
        for (const it of items) {
          all.push({
            cat,
            sev: (it as RawIssue).severity || 'medium',
            desc: (it as RawIssue).message || (it as RawIssue).type || 'Finding',
            file: (it as RawIssue).file || '',
            line: (it as RawIssue).line ?? '',
            patternId: (it as RawIssue).patternId || '',
          });
        }
      }
    }

    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
          file: it.file || it.path || '',
          line: it.line || '',
          patternId: it.patternId || it.type || '',
        });
      });
    };

    // Always process rawIssues if available (CLI reports use this format)
    if (r.rawIssues?.length) {
      r.rawIssues.forEach((it: RawIssue) => {
        all.push({
          cat: it.type || 'Finding',
          sev: it.severity || 'medium',
          desc: it.description || it.type || 'Finding',
          file: it.file || it.filePath || '',
          line: it.line || '',
          patternId: it.patternId || it.type || '',
        });
      });
      if (all.length > 0) return all;
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

  private extractFailingFiles(
    report: unknown
  ): { file: string; issues: { severity: string; description: string; line: number }[] }[] {
    const r = report as any;
    const fileMap = new Map<string, { issues: { severity: string; description: string; line: number }[] }>();

    // ScanResult format: report.findings
    if (r.findings && Array.isArray(r.findings) && r.findings.length > 0) {
      for (const issue of r.findings) {
        const filePath = issue.file || 'Unknown';
        if (!filePath || filePath === 'Unknown') continue;
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.message || issue.type || 'Finding',
          line: issue.matches?.[0]?.line || 1,
        });
      }
    }

    // CLI report format: rawIssues
    if (r.rawIssues && r.rawIssues.length > 0) {
      r.rawIssues.forEach((issue: RawIssue) => {
        const filePath = issue.filePath || issue.file || issue.path || 'Unknown';
        if (!filePath || filePath === 'Unknown') return;
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

    // Convert to array and sort by issue count (show most problematic files first)
    return Array.from(fileMap.entries())
      .map(([file, data]) => ({ file, ...data }))
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 20); // Limit to top 20 files for performance
  }

  private buildFailingFilesTable(): string {
    const failingFiles = this.extractFailingFiles(this.report);
    if (!failingFiles.length) {
      return '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px;">No files with issues detected</td></tr>';
    }

    return failingFiles
      .map((file) => {
        const severityCounts = file.issues.reduce(
          (acc, issue) => {
            acc[issue.severity] = (acc[issue.severity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const severityBadges = Object.entries(severityCounts)
          .map(([severity, count]) => {
            const colors: Record<string, string> = {
              high: '#EF4444',
              medium: '#F59E0B',
              low: '#3B82F6',
              critical: '#EF4444',
            };
            const color = colors[severity] || '#3B82F6';
            return `<span style="background:${color}20;color:${color};padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:600;margin-right:4px;">${severity.toUpperCase()} (${count})</span>`;
          })
          .join('');

        const fileName = file.file.split(/[\\/]/).pop() || file.file;
        const maxIssues = Math.max(...failingFiles.map((f) => f.issues.length));
        const issuePercentage = Math.round((file.issues.length / maxIssues) * 100);

        return `
        <tr>
          <td>
            <div class="file-link" data-file="${file.file}" data-line="1">
              <span style="font-family:monospace;font-size:.85rem;">${fileName}</span>
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="background:#EF444420;color:#EF4444;padding:4px 8px;border-radius:6px;font-weight:600;font-size:.8rem;">
                ${file.issues.length}
              </div>
              <div style="width:60px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">
                <div style="width:${issuePercentage}%;height:100%;background:#EF4444;"></div>
              </div>
            </div>
          </td>
          <td>${severityBadges}</td>
          <td>
            <button class="btn btn-secondary" onclick="vscode.postMessage({command:'openFile',file:'${file.file.replace(/\\/g, '\\\\')}',line:1})" style="padding:4px 8px;font-size:.75rem;">
              Open File
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  private buildEnhancedCategoryChart(categories: { label: string; count: number; severity: string }[]): string {
    if (!categories.length)
      return '<div style="color:var(--muted);font-size:.9rem;text-align:center;padding:20px;">No findings</div>';
    const max = Math.max(...categories.map((c) => c.count));
    const colors: Record<string, string> = { fail: '#EF4444', warn: '#F59E0B', pass: '#10B981', info: '#3B82F6' };
    return categories
      .map((c, i) => {
        const pct = Math.round((c.count / max) * 100);
        const color = colors[c.severity] || '#3B82F6';
        return `
        <div class="bar-item">
          <div class="bar-label">${c.label}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:0%;background:${color};--color:${color};" data-count="${c.count}" data-target="${pct}"></div>
          </div>
          <div class="bar-value">${c.count}</div>
        </div>
      `;
      })
      .join('');
  }

  private buildEnhancedSeverityChart(findings: { cat: string; sev: string }[]): string {
    const counts = { high: 0, medium: 0, low: 0 };
    findings.forEach((f) => {
      if (f.sev === 'high') counts.high++;
      else if (f.sev === 'medium') counts.medium++;
      else counts.low++;
    });
    const total = findings.length || 1;
    const items = [
      { name: 'High', count: counts.high, color: '#EF4444' },
      { name: 'Medium', count: counts.medium, color: '#F59E0B' },
      { name: 'Low', count: counts.low, color: '#10B981' },
    ];
    return items
      .map(
        (it, i) => `
      <div class="ring-item">
        <div class="ring" style="--color:${it.color};--pct:${Math.round((it.count / total) * 100)}">
          <span style="color:${it.color}">${it.count}</span>
        </div>
        <div class="ring-label">${it.name}</div>
      </div>
    `
      )
      .join('');
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async handleSuggestFix(patternId: string, filePath: string, line: number) {
    try {
      // Look up the finding in the current report (supports enhanced, CLI, and raw formats)
      const report = this.report as any;
      let finding = null;
      if (report?.categories) {
        for (const cat of Object.values(report.categories) as any[][]) {
          finding = cat.find((f: RawIssue) => f.file === filePath && f.line === line && f.patternId === patternId);
          if (finding) break;
        }
      }
      if (!finding && Array.isArray(report?.findings)) {
        finding = report.findings.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding && Array.isArray(report?.rawIssues)) {
        finding = report.rawIssues.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding && Array.isArray(report?.detectedIssues)) {
        finding = report.detectedIssues.find((f: RawIssue) => f.file === filePath && f.line === line && (f.patternId === patternId || f.type === patternId));
      }
      if (!finding) {
        vscode.window.showInformationMessage('Finding not found in current report. Run a fresh scan.');
        return;
      }

      const { getFixForFinding } = await import('./fixes/fixRegistry');
      const fix = getFixForFinding(finding);
      if (!fix) {
        vscode.window.showInformationMessage(`No automated fix available for ${patternId}. Manual review required.`);
        return;
      }

      const buttons = ['Preview Diff', 'Cancel'];
      if (fix.autoFixable) buttons.unshift('Auto Fix');
      const action = await vscode.window.showInformationMessage(
        `Fix suggestion for ${patternId}: ${fix.description}`,
        ...buttons
      );

      if (action === 'Cancel' || !action) return;

      if (action === 'Preview Diff') {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const originalLine = doc.lineAt(line - 1).text;
        const patchedLine = originalLine.replace(fix.search, fix.replace);
        const panel = vscode.window.createWebviewPanel(
          'simplebeaconFixPreview',
          'SimpleBeacon Fix Preview',
          vscode.ViewColumn.Two,
          { enableScripts: false }
        );
        panel.webview.html = `<!DOCTYPE html>
          <html><head><style>
            body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
            .diff { display: flex; gap: 20px; }
            .col { flex: 1; }
            .title { font-weight: bold; margin-bottom: 8px; color: #fff; }
            .line { padding: 4px; border-radius: 4px; }
            .original { background: #3c1618; }
            .patched { background: #1e3c1e; }
            pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
          </style></head><body>
            <div class="diff">
              <div class="col">
                <div class="title">Original</div>
                <div class="line original"><pre>${this.escapeHtml(originalLine)}</pre></div>
              </div>
              <div class="col">
                <div class="title">Patched</div>
                <div class="line patched"><pre>${this.escapeHtml(patchedLine)}</pre></div>
              </div>
            </div>
          </body></html>
        `;
        return;
      }

      if (action === 'Auto Fix' && fix.autoFixable) {
        const editor = await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        const range = new vscode.Range(line - 1, 0, line - 1, editor.document.lineAt(line - 1).text.length);
        const originalLine = editor.document.lineAt(line - 1).text;
        const patchedLine = originalLine.replace(fix.search, fix.replace);
        await editor.edit((editBuilder) => {
          editBuilder.replace(range, patchedLine);
        });
        vscode.window.showInformationMessage(`Applied fix: ${fix.description}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Fix failed: ${err}`);
    }
  }
}
