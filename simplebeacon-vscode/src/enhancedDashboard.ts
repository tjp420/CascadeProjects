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

export class EnhancedDashboard {
  private static currentPanel: EnhancedDashboard | undefined;
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private report: unknown;
  private highlight: string | null;
  private hasEnhancedAnalysis: boolean;
  private version: string;

  static createOrShow(extUri: vscode.Uri, report: unknown, highlight?: string, hasEnhancedAnalysis?: boolean) {
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (EnhancedDashboard.currentPanel) {
      EnhancedDashboard.currentPanel.panel.reveal(col);
      EnhancedDashboard.currentPanel.update(report, highlight ?? null, hasEnhancedAnalysis ?? false);
      return;
    }
    const panel = vscode.window.createWebviewPanel('simplebeaconEnhanced', 'SimpleBeacon Dashboard',
      col || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')] }
    );
    EnhancedDashboard.currentPanel = new EnhancedDashboard(panel, extUri, report, highlight ?? null, hasEnhancedAnalysis ?? false);
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri, report: unknown, highlight: string | null, hasEnhancedAnalysis: boolean) {
    this.panel = panel; this.extUri = extUri; this.report = report; this.highlight = highlight;
    this.hasEnhancedAnalysis = hasEnhancedAnalysis;
    this.version = getVersionFromExtUri(extUri);
    this.panel.onDidDispose(() => { EnhancedDashboard.currentPanel = undefined; }, null, []);
    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'openFile') {
        if (!msg.file || msg.file === 'missing-env-key' || msg.file === 'Unknown' || !/\.[a-zA-Z]{1,6}$/.test(msg.file)) {
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
    this.report = report; this.highlight = highlight; this.hasEnhancedAnalysis = hasEnhancedAnalysis;
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
    // Use the most accurate file count - ruleScopedFilesAnalyzed is the actual number of files analyzed by rules
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || 0;
    const totalRepositoryFiles = r.repositoryFilesTotal || 0;
    const files = totalRepositoryFiles > 0 ? `${filesAnalyzed}/${totalRepositoryFiles}` : `${filesAnalyzed}`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    const consistencyScore = r.consistencyScore ?? null;

    const categories = this.extractCategories(r);
    const allFindings = this.extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((sum, c) => sum + c.count, 0);
    const findingsJson = JSON.stringify(allFindings.map(f => ({ ...f, desc: this.escapeHtml(f.desc), file: this.escapeHtml(f.file) })));

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard</title>
<style>
:root{
  --pass:#10B981;--fail:#EF4444;--warn:#F59E0B;--info:#3B82F6;
  --bg:var(--vscode-editor-background);--fg:var(--vscode-foreground);
  --panel:var(--vscode-panel-background);--border:var(--vscode-panel-border);
  --muted:var(--vscode-descriptionForeground);--link:var(--vscode-textLink-foreground);
  --font:var(--vscode-font-family);
  --input-bg:var(--vscode-input-background);--input-fg:var(--vscode-input-foreground);
  --button-bg:var(--vscode-button-background);--button-fg:var(--vscode-button-foreground);
  --focus:var(--vscode-focusBorder);
}
*{box-sizing:border-box}
body{font-family:var(--font);background:var(--bg);color:var(--fg);margin:0;padding:0;min-height:100vh;}
.container{max-width:1400px;margin:0 auto;padding:24px 20px;}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px;padding:24px;background:var(--panel);border:1px solid var(--border);border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);}
.brand{display:flex;align-items:center;gap:16px;}
.brand-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:18px;box-shadow:0 6px 20px rgba(99,102,241,.4);animation:float 3s ease-in-out infinite;}
.brand-title{font-size:1.5rem;font-weight:800;letter-spacing:-0.02em;}
.brand-sub{color:var(--muted);font-size:.9rem;}
.status-section{text-align:right;}
.status-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 20px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--pass);font-size:.9rem;font-weight:700;border:1px solid rgba(16,185,129,.3);box-shadow:0 3px 8px rgba(16,185,129,.15);margin-bottom:8px;}
.status-badge.fail{background:rgba(239,68,68,.12);color:var(--fail);border-color:rgba(239,68,68,.3);box-shadow:0 3px 8px rgba(239,68,68,.15);}
.score-display{font-size:2rem;font-weight:900;color:${scoreColor};text-shadow:0 2px 8px ${scoreColor}33;}

/* Action Bar */
.action-bar{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;}
.btn{cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:10px;font-size:.9rem;font-weight:600;font-family:inherit;border:none;transition:all .2s ease;}
.btn-primary{background:var(--button-bg);color:var(--button-fg);box-shadow:0 2px 8px rgba(0,0,0,.1);}
.btn-primary:hover{background:var(--button-hover);transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.15);}
.btn-secondary{background:var(--panel);color:var(--fg);border:1px solid var(--border);}
.btn-secondary:hover{border-color:var(--focus);transform:translateY(-1px);}
.btn-danger{background:rgba(239,68,68,.15);color:var(--fail);border:1px solid rgba(239,68,68,.3);}
.btn-danger:hover{background:rgba(239,68,68,.25);transform:translateY(-1px);}

/* Overview Cards */
.overview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:32px;}
.overview-card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;transition:all .3s ease;position:relative;overflow:hidden;}
.overview-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${passColor},transparent);opacity:.8;}
.overview-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.12);border-color:var(--focus);}
.overview-icon{font-size:2.5rem;margin-bottom:12px;}
.overview-value{font-size:2.5rem;font-weight:900;margin-bottom:4px;}
.overview-label{font-size:.9rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600;}

/* Charts Section */
.charts-section{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;}
.chart-card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.04);}
.chart-title{font-size:1.1rem;font-weight:700;color:var(--fg);margin-bottom:20px;text-transform:uppercase;letter-spacing:.04em;}

/* Enhanced Charts */
.bar-chart{display:flex;flex-direction:column;gap:12px;}
.bar-item{display:flex;align-items:center;gap:12px;}
.bar-label{min-width:140px;font-size:.85rem;color:var(--muted);text-align:right;}
.bar-track{flex:1;height:24px;background:rgba(128,128,128,.08);border-radius:12px;overflow:hidden;position:relative;}
.bar-fill{height:100%;border-radius:12px;transition:width 1.2s cubic-bezier(.4,0,.2,1);position:relative;background:linear-gradient(90deg,var(--color),var(--color)dd);}
.bar-fill::after{content:attr(data-count);position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:.75rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.bar-value{font-size:.85rem;font-weight:600;color:var(--fg);min-width:32px;text-align:right;}

.ring-chart{display:flex;align-items:center;justify-content:space-around;padding:20px 0;}
.ring-item{text-align:center;}
.ring{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:900;position:relative;margin:0 auto 12px;background:conic-gradient(var(--color) calc(var(--pct)*1%),rgba(128,128,128,.08) 0);box-shadow:0 4px 12px rgba(0,0,0,.1);}
.ring::before{content:'';position:absolute;inset:8px;border-radius:50%;background:var(--panel);}
.ring span{position:relative;z-index:1;color:var(--color);}
.ring-label{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600;}

/* Findings Table */
.findings-section{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);}
.findings-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.findings-title{font-size:1.1rem;font-weight:700;}
.findings-controls{display:flex;gap:12px;align-items:center;}
.search-input{background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);border-radius:8px;padding:8px 12px;font-family:inherit;font-size:.85rem;outline:none;transition:border-color .15s;width:250px;}
.search-input:focus{border-color:var(--focus);}
.filter-select{background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);border-radius:8px;padding:8px 12px;font-family:inherit;font-size:.85rem;outline:none;cursor:pointer;}
.filter-chips{display:flex;gap:8px;}
.chip{cursor:pointer;padding:6px 12px;border-radius:20px;background:var(--panel);border:1px solid var(--border);font-size:.75rem;color:var(--muted);transition:all .15s;font-weight:600;}
.chip:hover{border-color:var(--focus);color:var(--fg);}
.chip.active{background:var(--info);color:#fff;border-color:var(--info);}

.table-container{max-height:400px;overflow-y:auto;}
.findings-table{width:100%;border-collapse:collapse;}
.findings-table th{padding:12px 16px;text-align:left;font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid var(--border);font-weight:700;background:rgba(128,128,128,.04);}
.findings-table td{padding:12px 16px;border-bottom:1px solid var(--border);font-size:.85rem;}
.findings-table tr:hover{background:var(--vscode-list-hoverBackground);}
.category-badge{display:inline-block;padding:4px 10px;border-radius:8px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
.severity-indicator{display:inline-flex;align-items:center;gap:6px;}
.severity-dot{width:8px;height:8px;border-radius:50%;}
.severity-high .severity-dot{background:var(--fail);box-shadow:0 0 6px rgba(239,68,68,.3);}
.severity-medium .severity-dot{background:var(--warn);box-shadow:0 0 6px rgba(245,158,11,.3);}
.severity-low .severity-dot{background:var(--pass);box-shadow:0 0 6px rgba(16,185,129,.3);}
.file-link{color:var(--link);cursor:pointer;text-decoration:underline;text-decoration-color:transparent;transition:all .15s;}
.file-link:hover{text-decoration-color:var(--link);color:var(--vscode-textLink-activeForeground);}

/* Empty State */
.empty-state{text-align:center;padding:60px 24px;color:var(--muted);}
.empty-icon{font-size:3rem;margin-bottom:16px;opacity:.5;}
.empty-title{font-size:1.2rem;font-weight:600;margin-bottom:8px;color:var(--fg);}
.empty-desc{font-size:.9rem;}

/* Animations */
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.7;}}

.animate-in{animation:fadeInUp .5s ease both;}
.overview-card{animation:fadeInUp .5s ease both;}
.overview-card:nth-child(1){animation-delay:.1s;}
.overview-card:nth-child(2){animation-delay:.2s;}
.overview-card:nth-child(3){animation-delay:.3s;}
.overview-card:nth-child(4){animation-delay:.4s;}

@media(max-width:768px){
  .header{flex-direction:column;text-align:center;}
  .status-section{text-align:center;margin-top:16px;}
  .charts-section{grid-template-columns:1fr;}
  .findings-controls{flex-direction:column;width:100%;}
  .search-input{width:100%;}
  .table-container{max-height:300px;}
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <div class="brand-icon">SB</div>
      <div>
        <div class="brand-title">SimpleBeacon</div>
        <div class="brand-sub">AI Slop Cop &mdash; v${this.version}</div>
      </div>
    </div>
    <div class="status-section">
      <div class="status-badge ${pass ? '' : 'fail'}">
        <span style="font-size:.8rem;">&#9679;</span> Gate ${pass}
      </div>
      <div class="score-display">${score}/100</div>
    </div>
  </div>

  <div class="action-bar">
    <button class="btn btn-primary" data-command="scanWorkspace">
      <span>&#128256;</span> Scan Workspace
    </button>
    <button class="btn btn-secondary" data-command="exportReport">
      <span>&#128196;</span> Export Report
    </button>
    <button class="btn btn-secondary" data-command="exportAIReport">
      <span>&#129302;</span> Export for AI
    </button>
    <button class="btn btn-secondary" data-command="showRemediationGuide">
      <span>&#128214;</span> Fix Guide
    </button>
    <button class="btn btn-secondary" data-command="generateCertificate">
      <span>&#9989;</span> Generate Certificate
    </button>
  </div>

  <div class="overview-grid">
    <div class="overview-card animate-in">
      <div class="overview-icon">&#128196;</div>
      <div class="overview-value">${files}</div>
      <div class="overview-label">Files Scanned</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">&#128218;</div>
      <div class="overview-value">${folders}</div>
      <div class="overview-label">Folders</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">&#128197;</div>
      <div class="overview-value">${totalFindings}</div>
      <div class="overview-label">Total Findings</div>
    </div>
    <div class="overview-card animate-in">
      <div class="overview-icon">&#128200;</div>
      <div class="overview-value">${categories.length}</div>
      <div class="overview-label">Categories</div>
    </div>
  </div>

  <div class="charts-section">
    <div class="chart-card">
      <div class="chart-title">Category Breakdown</div>
      <div class="bar-chart">
        ${this.buildEnhancedCategoryChart(categories)}
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Severity Distribution</div>
      <div class="ring-chart">
        ${this.buildEnhancedSeverityChart(allFindings)}
      </div>
    </div>
  </div>

  ${allFindings.length > 0 ? `
  <div class="findings-section">
    <div class="findings-header">
      <div class="findings-title">Findings Details</div>
      <div class="findings-controls">
        <input type="text" class="search-input" placeholder="Search findings..." id="searchInput">
        <select class="filter-select" id="categoryFilter">
          <option value="all">All Categories</option>
          ${categories.map(c => `<option value="${c.label}">${c.label}</option>`).join('')}
        </select>
        <div class="filter-chips">
          <span class="chip active" data-severity="all">All</span>
          <span class="chip" data-severity="high">High</span>
          <span class="chip" data-severity="medium">Medium</span>
          <span class="chip" data-severity="low">Low</span>
        </div>
      </div>
    </div>
    <div class="table-container">
      <table class="findings-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Severity</th>
            <th>Finding</th>
            <th>Location</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody id="findingsBody"></tbody>
      </table>
      <div id="emptyState" class="empty-state" style="display:none;">
        <div class="empty-icon">&#128218;</div>
        <div class="empty-title">No findings match your filters</div>
        <div class="empty-desc">Try adjusting the search or severity filters</div>
      </div>
    </div>
  </div>
  ` : `
  <div class="findings-section" style="text-align:center;padding:48px 24px;">
    <div style="font-size:3rem;margin-bottom:16px;">&#129302;</div>
    <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">No Findings</div>
    <div style="color:var(--muted);margin-bottom:24px;">Scan completed with no issues detected. Your codebase looks clean!</div>
  </div>
  `}

  ${this.hasEnhancedAnalysis && allFindings.length > 0 ? `
  <!-- Failing Files Section -->
  <div class="findings-section">
    <div class="findings-header">
      <div class="findings-title">Files with Most Issues</div>
      <div class="findings-controls">
        <div class="filter-chips">
          <span class="chip active">Top 20 Files</span>
        </div>
      </div>
    </div>
    <div class="table-container">
      <table class="findings-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Issues</th>
            <th>Severity Breakdown</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="failingFilesBody">
          ${this.buildFailingFilesTable()}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
window.vscode=vscode;
const data=${findingsJson};
const searchInput=document.getElementById('searchInput');
const categoryFilter=document.getElementById('categoryFilter');
const severityChips=document.querySelectorAll('.chip');
const findingsBody=document.getElementById('findingsBody');
const emptyState=document.getElementById('emptyState');
const hasFindingsUI = !!searchInput;

const findingsData = data;

function getCategoryColor(category){
  const map={
    'Blocking':'#EF4444','Secrets':'#EF4444','AI Indicators':'#F59E0B','EU AI Act':'#F59E0B',
    'Vulnerabilities':'#EF4444','Debug Markers':'#3B82F6',
    'AI Residue':'#F59E0B','Performance':'#F59E0B','Type Safety':'#3B82F6','Test Coverage':'#10B981',
    'Accessibility':'#8B5CF6','i18n':'#EC4899','Sensitive Data':'#EF4444','Config Drift':'#F59E0B',
    'Security Headers':'#EF4444','Database Patterns':'#EF4444','Framework Practices':'#F59E0B',
    'Workspace Health':'#3B82F6','Unused Deps':'#10B981','API Contract':'#3B82F6','Complexity':'#F59E0B',
    'LLM Slop':'#8B5CF6','Token Bleed':'#EC4899','Production Leak':'#EF4444','Fiction KPI':'#F59E0B',
    'Security':'#EF4444','Quality':'#F59E0B','Maintainability':'#3B82F6'
  };
  return map[category]||'#3B82F6';
}

function sanitizeHtml(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderFindings(findings){
  if (!findingsBody || !emptyState) return;
  if(!findings || !findings.length){
    findingsBody.style.display='none';
    emptyState.style.display='block';
    return;
  }
  findingsBody.style.display='';
  emptyState.style.display='none';

  findingsBody.textContent = '';
  for (const f of findings) {
    const catColor = getCategoryColor(f.cat);
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.background = catColor + '12';
    badge.style.color = catColor;
    badge.style.border = '1px solid ' + catColor + '25';
    badge.textContent = f.cat;
    td1.appendChild(badge); tr.appendChild(td1);
    const td2 = document.createElement('td');
    const sevDiv = document.createElement('div');
    sevDiv.className = 'severity-indicator severity-' + f.sev;
    const dot = document.createElement('span'); dot.className = 'severity-dot';
    const sevSpan = document.createElement('span');
    sevSpan.textContent = f.sev.toUpperCase();
    sevDiv.appendChild(dot); sevDiv.appendChild(sevSpan);
    td2.appendChild(sevDiv); tr.appendChild(td2);
    const td3 = document.createElement('td');
    td3.textContent = f.desc;
    tr.appendChild(td3);
    const td4 = document.createElement('td');
    const link = document.createElement('span');
    link.className = 'file-link';
    link.dataset.file = f.file || '';
    link.dataset.line = String(f.line || 1);
    link.textContent = f.file ? (f.file.split(/[\\/]/).pop() + (f.line ? ':' + f.line : '')) : '—';
    link.addEventListener('click', () => {
      if (f.file) vscode.postMessage({ command: 'openFile', file: f.file, line: f.line || 1 });
    });
    td4.appendChild(link); tr.appendChild(td4);
    const td5 = document.createElement('td');
    if (f.patternId && ['debugArtifacts','innerHtmlXss','unhandledPromise','dbAntiPattern','typeSafetyAny','insecureRandom','a11yGap','missingStrictMode','uninitializedVariable','orphanedExport'].includes(f.patternId)) {
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-secondary';
      fixBtn.style.padding = '2px 6px';
      fixBtn.style.fontSize = '.7rem';
      fixBtn.textContent = 'Suggest Fix';
      fixBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'suggestFix', patternId: f.patternId, file: f.file, line: f.line });
      });
      td5.appendChild(fixBtn);
    } else {
      td5.textContent = '—';
    }
    tr.appendChild(td5);
    findingsBody.appendChild(tr);
  }
}

function filterFindings(){
  if (!searchInput || !categoryFilter) return;
  const query=searchInput.value.toLowerCase();
  const category=categoryFilter.value;
  const activeChip=document.querySelector('.chip.active');
  const severity=activeChip?.dataset.severity||'all';

  const filtered=data.filter(f=>{
    const matchesSearch=query===''||f.desc.toLowerCase().includes(query)||f.cat.toLowerCase().includes(query)||f.file.toLowerCase().includes(query);
    const matchesCategory=category==='all'||f.cat===category;
    const matchesSeverity=severity==='all'||f.sev===severity;
    return matchesSearch&&matchesCategory&&matchesSeverity;
  });

  renderFindings(filtered);
}

if (hasFindingsUI) {
  severityChips.forEach(chip=>{
    chip.addEventListener('click',()=>{
      severityChips.forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      filterFindings();
    });
  });

  searchInput.addEventListener('input',filterFindings);
  categoryFilter.addEventListener('change',filterFindings);

  // Initial render
  filterFindings();
}

// Add click handlers for buttons with data-command (action bar + gated CTA)
// Exclude elements with inline onclick (table row buttons handle themselves)
document.querySelectorAll('[data-command]:not([onclick])').forEach(button => {
  button.addEventListener('click', () => {
    const command = button.getAttribute('data-command');
    if (command) {
      vscode.postMessage({ command: command });
    }
  });
});

// Add click handlers for static file-link elements in failing files table
document.querySelectorAll('.file-link').forEach(link => {
  if (!link.dataset.hasListener) {
    link.dataset.hasListener = 'true';
    link.addEventListener('click', () => {
      const file = link.getAttribute('data-file');
      const line = Number(link.getAttribute('data-line')) || 1;
      if (file) {
        vscode.postMessage({ command: 'openFile', file, line });
      }
    });
  }
});

// Animate bars on load
setTimeout(()=>{
  document.querySelectorAll('.bar-fill').forEach(bar=>{
    const target=bar.getAttribute('data-target');
    if(target)bar.style.width=target+'%';
  });
},200);
</script>
</body>
</html>`;
  }

  private extractCategories(report: unknown): { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] = [];

    // ScanResult format: report.categories is Record<string, Finding[]>
    if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
      const severityMap: Record<string, 'pass' | 'fail' | 'warn' | 'info'> = {
        security: 'fail', debug: 'info', aiResidue: 'warn', performance: 'warn',
        typeSafety: 'info', testCoverage: 'info', accessibility: 'info',
        quality: 'warn', other: 'info'
      };
      for (const [cat, items] of Object.entries(r.categories)) {
        if (Array.isArray(items) && items.length > 0) {
          cats.push({ label: cat, count: items.length, severity: severityMap[cat] || 'info' });
        }
      }
      return cats;
    }

    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };

    if (!r.gate?.blockingIssues?.length && !r.credentialHygiene?.secrets?.length && r.rawIssues?.length) {
      const high = r.rawIssues.filter((i: RawIssue) => i.severity === 'high' || i.severity === 'critical');
      const medium = r.rawIssues.filter((i: RawIssue) => i.severity === 'medium');
      const low = r.rawIssues.filter((i: RawIssue) => i.severity === 'low');
      if (high.length) push('Blocking Issues', 'fail', high);
      if (medium.length) push('Warnings', 'warn', medium);
      if (low.length) push('Info', 'info', low);
      return cats;
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

  private extractAllFindings(report: unknown): { cat: string; sev: string; desc: string; file: string; line: number | ''; patternId?: string }[] {
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
            patternId: (it as RawIssue).patternId || ''
          });
        }
      }
      return all;
    }

    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
          file: it.file || it.path || '',
          line: it.line || '',
          patternId: it.patternId || it.type || ''
        });
      });
    };

    if (!r.gate?.blockingIssues?.length && !r.credentialHygiene?.secrets?.length && r.rawIssues?.length) {
      r.rawIssues.forEach((it: RawIssue) => {
        all.push({
          cat: it.type || 'Finding',
          sev: it.severity || 'medium',
          desc: it.description || it.type || 'Finding',
          file: it.file || it.filePath || '',
          line: it.line || '',
          patternId: it.patternId || it.type || ''
        });
      });
      return all;
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

  private extractFailingFiles(report: unknown): { file: string; issues: { severity: string; description: string; line: number }[] }[] {
    const r = report as any;
    const fileMap = new Map<string, { issues: { severity: string; description: string; line: number }[] }>();

    // ScanResult format: report.findings
    if (r.findings && Array.isArray(r.findings)) {
      for (const issue of r.findings) {
        const filePath = issue.file || 'Unknown';
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.message || issue.type || 'Finding',
          line: issue.matches?.[0]?.line || 1
        });
      }
      return Array.from(fileMap.entries())
        .map(([file, data]) => ({ file, ...data }))
        .sort((a, b) => b.issues.length - a.issues.length)
        .slice(0, 20);
    }

    // CLI report format: rawIssues
    if (r.rawIssues && r.rawIssues.length > 0) {
      r.rawIssues.forEach((issue: RawIssue) => {
        const filePath = issue.filePath || issue.file || issue.path || 'Unknown';
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { issues: [] });
        }
        fileMap.get(filePath)!.issues.push({
          severity: issue.severity || 'medium',
          description: issue.description || issue.message || issue.type || 'Finding',
          line: issue.line || 1
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

    return failingFiles.map(file => {
      const severityCounts = file.issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const severityBadges = Object.entries(severityCounts)
        .map(([severity, count]) => {
          const colors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#3B82F6', critical: '#EF4444' };
          const color = colors[severity] || '#3B82F6';
          return `<span style="background:${color}20;color:${color};padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:600;margin-right:4px;">${severity.toUpperCase()} (${count})</span>`;
        }).join('');

      const fileName = file.file.split(/[\\/]/).pop() || file.file;
      const maxIssues = Math.max(...failingFiles.map(f => f.issues.length));
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
    }).join('');
  }

  private buildEnhancedCategoryChart(categories: { label: string; count: number; severity: string }[]): string {
    if (!categories.length) return '<div style="color:var(--muted);font-size:.9rem;text-align:center;padding:20px;">No findings</div>';
    const max = Math.max(...categories.map(c => c.count));
    const colors: Record<string, string> = { fail: '#EF4444', warn: '#F59E0B', pass: '#10B981', info: '#3B82F6' };
    return categories.map((c, i) => {
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
    }).join('');
  }

  private buildEnhancedSeverityChart(findings: { cat: string; sev: string }[]): string {
    const counts = { high: 0, medium: 0, low: 0 };
    findings.forEach(f => { 
      if (f.sev === 'high') counts.high++; 
      else if (f.sev === 'medium') counts.medium++; 
      else counts.low++; 
    });
    const total = findings.length || 1;
    const items = [
      { name: 'High', count: counts.high, color: '#EF4444' },
      { name: 'Medium', count: counts.medium, color: '#F59E0B' },
      { name: 'Low', count: counts.low, color: '#10B981' }
    ];
    return items.map((it, i) => `
      <div class="ring-item">
        <div class="ring" style="--color:${it.color};--pct:${Math.round((it.count / total) * 100)}">
          <span style="color:${it.color}">${it.count}</span>
        </div>
        <div class="ring-label">${it.name}</div>
      </div>
    `).join('');
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  private async handleSuggestFix(patternId: string, filePath: string, line: number) {
    try {
      // Look up the finding in the current report
      const report = this.report as any;
      let finding = null;
      if (report?.categories) {
        for (const cat of Object.values(report.categories) as any[][]) {
          finding = cat.find((f: RawIssue) => f.file === filePath && f.line === line && f.patternId === patternId);
          if (finding) break;
        }
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
        await editor.edit(editBuilder => {
          editBuilder.replace(range, patchedLine);
        });
        vscode.window.showInformationMessage(`Applied fix: ${fix.description}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Fix failed: ${err}`);
    }
  }
}
