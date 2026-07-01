// VS Code API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { themeColors } from './designSystem';
import { extractCategories, extractAllFindings, extractFailingFiles } from './dashboardDataExtractor';
import { escapeHtml } from './utils';

/** Safely read a nested property path from an unknown object. */
function getNested<T>(obj: unknown, ...keys: string[]): T | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') { return undefined; }
    current = (current as Record<string, unknown>)[key];
  }
  return current as T | undefined;
}

export interface Dashboard40Report {
  qualityScore?: number;
  gate?: { pass?: boolean; blockingIssues?: unknown[] };
  severityCounts?: Record<string, number>;
  ruleScopedFilesAnalyzed?: number;
  filesAnalyzed?: number;
  totalFiles?: number;
  repositoryFilesTotal?: number;
  repositoryFoldersTotal?: number;
  repositoryInventory?: { totalFolders?: number };
  detectedIssues?: unknown[];
  rawIssues?: unknown[];
  findings?: unknown[];
  categories?: Record<string, unknown[]>;
  projectRoot?: string;
  projectPath?: string;
  scanTarget?: string;
  [key: string]: unknown;
}

/**
 * Dashboard 4.0 — Clean modern panel with bento-grid layout.
 */
export class Dashboard40 {
  private static currentPanel: Dashboard40 | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extUri: vscode.Uri;
  private report: Dashboard40Report | undefined;

  public static createOrShow(extUri: vscode.Uri, report?: Dashboard40Report) {
    if (Dashboard40.currentPanel) {
      Dashboard40.currentPanel.panel.reveal(vscode.ViewColumn.One);
      if (report) Dashboard40.currentPanel.update(report);
      return;
    }
    const p = vscode.window.createWebviewPanel('simplebeaconDashboard40', 'SimpleBeacon Dashboard 4.0', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')],
    });
    Dashboard40.currentPanel = new Dashboard40(p, extUri, report);
  }

  public static updateIfOpen(report: Dashboard40Report) {
    if (Dashboard40.currentPanel) {
      Dashboard40.currentPanel.update(report);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri, report?: Dashboard40Report) {
    this.panel = panel;
    this.extUri = extUri;
    this.report = report;
    this.panel.onDidDispose(() => { Dashboard40.currentPanel = undefined; }, null, []);
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.render();
  }

  public update(report: Dashboard40Report) {
    this.report = report;
    this.render();
  }

  private handleMessage(msg: { command: string; file?: string; line?: number }) {
    switch (msg.command) {
      case 'openFile': {
        if (!msg.file) break;
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const resolved = path.isAbsolute(msg.file) ? msg.file : (workspace ? path.join(workspace, msg.file) : msg.file);
        if (fs.existsSync(resolved)) {
          vscode.window.showTextDocument(vscode.Uri.file(resolved), {
            selection: new vscode.Range((msg.line || 1) - 1, 0, (msg.line || 1) - 1, 0)
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
  }

  private getWorkspaceStats(): { files: number; folders: number } {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) { return { files: 0, folders: 0 }; }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const skipDirs = /[\\/]node_modules[\\/]|[\\/]\.git[\\/]|[\\/]dist[\\/]|[\\/]build[\\/]|[\\/]\.next[\\/]|[\\/]out[\\/]|[\\/]coverage[\\/]/;
      let files = 0;
      let folders = 0;
      const stack = [rootPath];
      const visited = new Set<string>();
      while (stack.length > 0) {
        const dir = stack.pop()!;
        if (visited.has(dir)) continue;
        visited.add(dir);
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
            if (skipDirs.test('/' + relPath + '/')) continue;
            if (entry.isDirectory()) { folders++; stack.push(fullPath); }
            else if (entry.isFile()) { files++; }
          }
        } catch { /* skip unreadable */ }
      }
      return { files, folders };
    } catch { return { files: 0, folders: 0 }; }
  }

  private buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const r = this.report || {};
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passClass = g.pass ? 'pass' : 'fail';
    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? themeColors.dark : themeColors.light;

    const workspaceStats = this.getWorkspaceStats();
    const filesAnalyzed = r.ruleScopedFilesAnalyzed || r.filesAnalyzed || r.totalFiles || workspaceStats.files;
    const totalRepoFiles = r.repositoryFilesTotal || workspaceStats.files;
    const files = totalRepoFiles > 0 ? `${filesAnalyzed}/${totalRepoFiles}` : `${filesAnalyzed}`;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || workspaceStats.folders;

    const categories = extractCategories(r as any);
    const allFindings = extractAllFindings(r as any);
    const totalFindings = allFindings.length || categories.reduce((s, c) => s + c.count, 0);
    const findingsJson = JSON.stringify(allFindings.map((f) => ({ ...f, desc: escapeHtml(f.desc), file: escapeHtml(f.file) }))).replace(/</g, '\\u003c');
    const catOptions = categories.map((c) => `<option value="${escapeHtml(c.label)}">${escapeHtml(c.label)}</option>`).join('');

    const sevCounts = this.getSeverityCounts(allFindings);
    const failingFiles = extractFailingFiles(r as any);
    const failingFilesHtml = this.buildFailingFilesTable(failingFiles);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Dashboard 4.0</title>
<style>
:root{--bg:${theme.background};--fg:${theme.foreground};--panel:${theme.panel};--border:${theme.border};--input:${theme.input};--radius-sm:6px;--radius-md:12px;--radius-lg:18px;--radius-xl:24px;--shadow:0 2px 12px rgba(0,0,0,0.08);--shadow-lg:0 8px 32px rgba(0,0,0,0.12);--glow:rgba(99,102,241,0.08);}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--fg);font-size:13px;line-height:1.5;min-height:100vh}
.app{max-width:1100px;margin:0 auto;padding:28px 24px}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px;padding:24px 28px;background:linear-gradient(135deg,var(--panel) 0%,var(--bg) 100%);border:1px solid var(--border);border-radius:var(--radius-xl);box-shadow:var(--shadow)}
.brand{display:flex;align-items:center;gap:16px}
.brand-icon{width:52px;height:52px;border-radius:var(--radius-md);background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:20px;box-shadow:0 4px 16px rgba(99,102,241,0.25)}
.brand-title{font-size:24px;font-weight:800;letter-spacing:-0.02em}
.brand-sub{color:#94a3b8;font-size:12px;margin-top:2px}
.status{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid;text-transform:uppercase;letter-spacing:0.5px}
.status-badge.pass{background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.2)}
.status-badge.fail{background:rgba(239,68,68,0.08);color:#ef4444;border-color:rgba(239,68,68,0.2)}
.score-ring{position:relative;width:80px;height:80px}
.score-ring svg{transform:rotate(-90deg)}
.score-ring-bg{fill:none;stroke:rgba(255,255,255,0.06);stroke-width:6}
.score-ring-fill{fill:none;stroke:${scoreColor};stroke-width:6;stroke-linecap:round;stroke-dasharray:${(score / 100) * 188.5} 188.5;transition:stroke-dasharray 1s ease-out}
.score-text{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:20px;font-weight:800;color:${scoreColor}}

/* Actions */
.actions{display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:var(--radius-md);font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .2s;letter-spacing:0.2px}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,0.25)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(99,102,241,0.35)}
.btn-secondary{background:var(--panel);color:var(--fg);border:1px solid var(--border)}
.btn-secondary:hover{background:var(--input);border-color:#6366f1;transform:translateY(-1px)}

/* Bento Grid */
.bento{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.bento-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;display:flex;flex-direction:column;gap:8px;transition:all .2s;box-shadow:var(--shadow)}
.bento-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.bento-card.wide{grid-column:span 2}
.bento-card.tall{grid-row:span 2}
.bento-icon{font-size:24px}
.bento-value{font-size:22px;font-weight:800}
.bento-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px}
.bento-bar-bg{background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden;margin-top:4px}
.bento-bar-fill{height:100%;border-radius:4px;transition:width .8s ease-out}

/* Severity mini-cards */
.sev-mini{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--panel)}
.sev-dot{width:8px;height:8px;border-radius:50%}
.sev-dot.critical{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,0.4)}
.sev-dot.high{background:#f97316;box-shadow:0 0 6px rgba(249,115,22,0.4)}
.sev-dot.medium{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,0.4)}
.sev-dot.low{background:#3b82f6;box-shadow:0 0 6px rgba(59,130,246,0.4)}

/* Findings */
.section{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px}
.section-title{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:3px;height:14px;border-radius:2px;background:linear-gradient(180deg,#6366f1,#8b5cf6)}
.search{padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg);font-size:12px;outline:none;min-width:180px}
.search:focus{border-color:#6366f1}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.chip{padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:transparent;transition:all .15s}
.chip.active{background:rgba(99,102,241,0.12);color:#a5b4fc;border-color:rgba(99,102,241,0.25)}
.chip:hover{background:rgba(255,255,255,0.03)}

/* Table */
.table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
.table th{text-align:left;padding:10px 12px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)}
.table td{padding:10px 12px;border-bottom:1px solid var(--border)}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:rgba(255,255,255,0.02)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600}
.file-link{color:#a5b4fc;cursor:pointer;font-family:monospace;font-size:11px}
.file-link:hover{text-decoration:underline}
.empty{text-align:center;padding:40px;color:#94a3b8}

/* Responsive */
@media(max-width:900px){.bento{grid-template-columns:repeat(2,1fr)}.bento-card.wide{grid-column:span 2}}
@media(max-width:600px){.bento{grid-template-columns:1fr}.bento-card.wide{grid-column:span 1}.header{flex-direction:column;text-align:center}.status{align-items:center}}

@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:fadeIn .35s ease-out both}
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}.d4{animation-delay:.2s}
</style>
</head>
<body>
<div class="app">
  <div class="header anim">
    <div class="brand">
      <div class="brand-icon">SB</div>
      <div>
        <div class="brand-title">SimpleBeacon</div>
        <div class="brand-sub">Dashboard 4.0</div>
      </div>
    </div>
    <div class="status">
      <div class="status-badge ${passClass}"><span style="font-size:8px">●</span> Gate ${pass}</div>
      <div class="score-ring">
        <svg width="80" height="80" viewBox="0 0 80 80"><circle class="score-ring-bg" cx="40" cy="40" r="30"/><circle class="score-ring-fill" cx="40" cy="40" r="30"/></svg>
        <div class="score-text">${score}</div>
      </div>
    </div>
  </div>

  <div class="actions anim d1">
    <button class="btn btn-primary" data-cmd="scanWorkspace">🔍 Scan</button>
    <button class="btn btn-secondary" data-cmd="exportReport">📄 Export</button>
    <button class="btn btn-secondary" data-cmd="generateCertificate">✅ Certificate</button>
    <button class="btn btn-secondary" data-cmd="openInBrowser">🌐 Browser</button>
  </div>

  <div class="bento anim d2">
    <div class="bento-card">
      <div class="bento-icon">📁</div>
      <div class="bento-value">${files}</div>
      <div class="bento-label">Files</div>
      <div class="bento-bar-bg"><div class="bento-bar-fill" style="width:${Math.min((filesAnalyzed / Math.max(totalRepoFiles, 1)) * 100, 100)}%;background:linear-gradient(90deg,#6366f1,#8b5cf6)"></div></div>
    </div>
    <div class="bento-card">
      <div class="bento-icon">📂</div>
      <div class="bento-value">${folders}</div>
      <div class="bento-label">Folders</div>
      <div class="bento-bar-bg"><div class="bento-bar-fill" style="width:70%;background:linear-gradient(90deg,#8b5cf6,#ec4899)"></div></div>
    </div>
    <div class="bento-card">
      <div class="bento-icon">🔍</div>
      <div class="bento-value">${totalFindings}</div>
      <div class="bento-label">Findings</div>
      <div class="bento-bar-bg"><div class="bento-bar-fill" style="width:${Math.min(totalFindings * 5, 100)}%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></div></div>
    </div>
    <div class="bento-card">
      <div class="bento-icon">📊</div>
      <div class="bento-value">${categories.length}</div>
      <div class="bento-label">Categories</div>
      <div class="bento-bar-bg"><div class="bento-bar-fill" style="width:${Math.min(categories.length * 15, 100)}%;background:linear-gradient(90deg,#10b981,#3b82f6)"></div></div>
    </div>
  </div>

  <div class="bento anim d3">
    <div class="bento-card wide" style="flex-direction:row;align-items:center;justify-content:space-around">
      <div class="sev-mini"><div class="sev-dot critical"></div><div><div style="font-size:18px;font-weight:800">${sevCounts.critical}</div><div style="font-size:10px;color:#94a3b8">Critical</div></div></div>
      <div class="sev-mini"><div class="sev-dot high"></div><div><div style="font-size:18px;font-weight:800">${sevCounts.high}</div><div style="font-size:10px;color:#94a3b8">High</div></div></div>
      <div class="sev-mini"><div class="sev-dot medium"></div><div><div style="font-size:18px;font-weight:800">${sevCounts.medium}</div><div style="font-size:10px;color:#94a3b8">Medium</div></div></div>
      <div class="sev-mini"><div class="sev-dot low"></div><div><div style="font-size:18px;font-weight:800">${sevCounts.low}</div><div style="font-size:10px;color:#94a3b8">Low</div></div></div>
    </div>
  </div>

  <div class="section anim d4">
    <div class="section-header"><div class="section-title">Findings</div><input type="text" class="search" placeholder="Search..." id="searchInput"></div>
    <div class="chips">
      <span class="chip active" data-sev="all">All</span>
      <span class="chip" data-sev="critical">Critical</span>
      <span class="chip" data-sev="high">High</span>
      <span class="chip" data-sev="medium">Medium</span>
      <span class="chip" data-sev="low">Low</span>
    </div>
    <table class="table"><thead><tr><th>Category</th><th>Severity</th><th>Finding</th><th>Location</th></tr></thead><tbody id="findingsBody"></tbody></table>
    <div id="emptyState" class="empty" style="display:none"><div style="font-size:2rem;margin-bottom:8px">📭</div><div style="font-weight:600">No findings match</div></div>
  </div>

  <div class="section anim d4">
    <div class="section-header"><div class="section-title">Files with Issues</div></div>
    <table class="table"><thead><tr><th>File</th><th>Count</th><th>Breakdown</th><th>Action</th></tr></thead><tbody>${failingFilesHtml}</tbody></table>
  </div>
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
document.querySelectorAll('[data-cmd]').forEach(btn=>{
  btn.addEventListener('click',()=>{const cmd=btn.dataset.cmd;vscode.postMessage({command:cmd});}); // simplebeacon-ignore memory-leak — static UI binding
});
const data=${findingsJson};
const searchInput=document.getElementById('searchInput');
const chips=document.querySelectorAll('.chip');
const findingsBody=document.getElementById('findingsBody');
const emptyState=document.getElementById('emptyState');

function getCatColor(c){
  const map={'Blocking':'#ef4444','Secrets':'#ef4444','AI Indicators':'#f59e0b','Vulnerabilities':'#ef4444','Debug Markers':'#6366f1','AI Residue':'#f59e0b','Performance':'#f59e0b','Type Safety':'#6366f1','Test Coverage':'#10b981','Sensitive Data':'#ef4444','Config Drift':'#f59e0b','Security Headers':'#ef4444','Database Patterns':'#ef4444','Framework Practices':'#f59e0b','Workspace Health':'#6366f1','Unused Deps':'#10b981','Complexity':'#f59e0b','LLM Slop':'#8b5cf6','Token Bleed':'#8b5cf6','Production Leak':'#ef4444','Fiction KPI':'#f59e0b','Security':'#ef4444','Quality':'#f59e0b','Maintainability':'#6366f1'};
  return map[c]||'#6366f1';
}
function getSevColor(s){return s==='critical'||s==='high'?'#ef4444':s==='medium'?'#f59e0b':'#3b82f6';}
function escapeHtml(str){const d=document.createElement('div');d.textContent=str||'';return d.innerHTML;}
function render(rows){
  if(!rows||!rows.length){findingsBody.style.display='none';emptyState.style.display='block';return;}
  findingsBody.style.display='';emptyState.style.display='none';
  findingsBody.textContent='';
  rows.forEach(f=>{
    const cc=getCatColor(f.cat);const sc=getSevColor(f.sev);const cat=escapeHtml(f.cat);const sev=escapeHtml(f.sev);const desc=escapeHtml(f.desc);const file=f.file||'';const line=f.line||1;
    const tr=document.createElement('tr');
    const td1=document.createElement('td');const b1=document.createElement('span');b1.className='badge';b1.style.background=cc+'12';b1.style.color=cc;b1.style.border='1px solid '+cc+'25';b1.textContent=cat;td1.appendChild(b1);
    const td2=document.createElement('td');const b2=document.createElement('span');b2.className='badge';b2.style.background=sc+'12';b2.style.color=sc;b2.style.border='1px solid '+sc+'25';b2.textContent=sev;td2.appendChild(b2);
    const td3=document.createElement('td');td3.textContent=desc;
    const td4=document.createElement('td');const fl=document.createElement('span');fl.className='file-link';fl.dataset.file=escapeHtml(file);fl.dataset.line=String(line);fl.textContent=file?file.split(/[\\/]/).pop()+':'+line:'—';fl.addEventListener('click',()=>{vscode.postMessage({command:'openFile',file:escapeHtml(file),line:parseInt(String(line)||'1',10)});});td4.appendChild(fl);
    tr.append(td1,td2,td3,td4);findingsBody.appendChild(tr);
  });
}
render(data);

let activeSev='all',activeSearch='';
function filter(){
  const rows=data.filter(f=>{
    const sevMatch=activeSev==='all'||f.sev===activeSev;
    const searchMatch=!activeSearch||f.desc.toLowerCase().includes(activeSearch)||f.cat.toLowerCase().includes(activeSearch)||f.file.toLowerCase().includes(activeSearch);
    return sevMatch&&searchMatch;
  });
  render(rows);
}
chips.forEach(c=>c.addEventListener('click',()=>{chips.forEach(x=>x.classList.remove('active'));c.classList.add('active');activeSev=c.dataset.sev;filter();}));
if(searchInput)searchInput.addEventListener('input',e=>{activeSearch=e.target.value.toLowerCase();filter();});
</script>
</body>
</html>`;
  }

  private getSeverityCounts(findings: { sev: string }[]): { critical: number; high: number; medium: number; low: number } {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (counts[f.sev as keyof typeof counts] !== undefined) counts[f.sev as keyof typeof counts]++;
    }
    return counts;
  }

  private buildFailingFilesTable(failingFiles: { file: string; issues: { severity: string }[] }[]): string {
    if (!failingFiles.length) return '<tr><td colspan="4" style="text-align:center;padding:2rem">No issues found</td></tr>';
    return failingFiles.map((f) => {
      const counts = f.issues.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {} as Record<string, number>);
      const badges = Object.entries(counts).map(([sev, c]) => {
        const color = sev === 'high' || sev === 'critical' ? '#ef4444' : sev === 'medium' ? '#f59e0b' : '#3b82f6';
        return `<span style="background:${color}12;color:${color};padding:2px 6px;border-radius:4px;font-size:10px;margin-right:4px">${sev}: ${c}</span>`;
      }).join('');
      const safeFile = escapeHtml(f.file);
      const name = f.file.split(/[/\\]/).pop() || f.file;
      return `<tr><td><span class="file-link" style="cursor:pointer" data-file="${safeFile}" data-line="1">${escapeHtml(name)}</span></td><td>${f.issues.length}</td><td>${badges}</td><td><button class="btn btn-secondary" style="padding:4px 10px;font-size:11px" data-cmd="openFile" data-file="${safeFile}" data-line="1">Open</button></td></tr>`;
    }).join('');
  }
}
