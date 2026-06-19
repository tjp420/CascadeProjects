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

export class ReportWebview {
  private static currentPanel: ReportWebview | undefined;
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private report: unknown;
  private highlight: string | null;
  private version: string;

  static createOrShow(extUri: vscode.Uri, report: unknown, highlight?: string) {
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (ReportWebview.currentPanel) {
      ReportWebview.currentPanel.panel.reveal(col);
      ReportWebview.currentPanel.update(report, highlight ?? null);
      return;
    }
    const panel = vscode.window.createWebviewPanel('simplebeaconReport', 'SimpleBeacon Dashboard',
      col || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')] }
    );
    ReportWebview.currentPanel = new ReportWebview(panel, extUri, report, highlight ?? null);
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri, report: unknown, highlight: string | null) {
    this.panel = panel; this.extUri = extUri; this.report = report; this.highlight = highlight;
    this.version = getVersionFromExtUri(extUri);
    this.panel.onDidDispose(() => { ReportWebview.currentPanel = undefined; }, null, []);
    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'openFile') {
        const uri = vscode.Uri.file(msg.file);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(msg.line - 1, 0, msg.line - 1, 0) });
      } else if (msg.command === 'sendToAI') {
        vscode.commands.executeCommand('simplebeacon.exportAIReport');
      }
    });
    this.update(report, highlight);
  }

  update(report: unknown, highlight: string | null = null) {
    this.report = this.normalizeReport(report); this.highlight = highlight;
    this.panel.webview.html = this.buildHtml();
  }

  private normalizeReport(r: unknown): unknown {
    const report = r as any;
    if (!report) return report;
    // Already CLI report format
    if (report.gate && typeof report.qualityScore === 'number') return report;
    // ScanResult format (workspace analyzer)
    if (report.summary) {
      const findings = report.findings || [];
      const severityCounts = report.summary.severityCounts || {};
      const high = severityCounts.high || 0;
      const critical = severityCounts.critical || 0;
      return {
        ...report,
        totalFiles: report.summary.totalFiles || 0,
        filesAnalyzed: report.summary.filesAnalyzed || 0,
        totalFindings: report.summary.totalFindings || findings.length,
        qualityScore: (high + critical) === 0 ? 100 : Math.max(0, 100 - (high + critical) * 5 - severityCounts.medium * 2),
        gate: { pass: (high + critical) === 0, failOn: ['high'], warnOn: ['medium', 'low'], blockingCount: high + critical, warningCount: report.summary.totalFindings || 0 },
        rawIssues: findings.map((f: RawIssue) => ({
          severity: f.severity,
          type: f.type,
          file: f.file,
          line: f.line || 0,
          message: f.message,
          patternId: f.patternId
        }))
      };
    }
    return report;
  }

  private buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const r = this.report as any;
    const g = r.gate || {};
    const score = r.qualityScore ?? 0;
    const pass = g.pass ? 'PASS' : 'FAIL';
    const passColor = g.pass ? '#10B981' : '#EF4444';
    const scoreColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
    const files = r.totalFiles || r.filesAnalyzed || 0;
    const folders = r.repositoryFoldersTotal || r.repositoryInventory?.totalFolders || 0;
    const consistencyScore = r.consistencyScore ?? null;

    // All category extractors with modern naming
    const categories = this.extractCategories(r);
    const allFindings = this.extractAllFindings(r);
    const totalFindings = allFindings.length || categories.reduce((sum, c) => sum + c.count, 0);
    const findingsJson = JSON.stringify(allFindings.map(f => ({ ...f, desc: escapeHtml(f.desc), file: escapeHtml(f.file) })));

    const gaugeSvg = this.buildGauge(score, scoreColor);
    const cardsHtml = categories.map(c => this.buildSummaryCard(c)).join('');
    const categoryChartHtml = this.buildCategoryChart(categories);
    const severityChartHtml = this.buildSeverityChart(allFindings);

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
}
*{box-sizing:border-box}
body{font-family:var(--font);background:var(--bg);color:var(--fg);margin:0;padding:0;min-height:100vh;}
.container{max-width:1200px;margin:0 auto;padding:24px 20px;}

/* Header */
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);}
.brand{display:flex;align-items:center;gap:12px;}
.brand-icon{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px;box-shadow:0 4px 12px rgba(99,102,241,.4);}
.brand-title{font-size:1.3rem;font-weight:700;letter-spacing:-0.02em;}
.brand-sub{color:var(--muted);font-size:.8rem;}
.status-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--pass);font-size:.8rem;font-weight:700;border:1px solid rgba(16,185,129,.3);box-shadow:0 2px 6px rgba(16,185,129,.1);}
.status-pill.fail{background:rgba(239,68,68,.12);color:var(--fail);border-color:rgba(239,68,68,.3);box-shadow:0 2px 6px rgba(239,68,68,.1);}

/* Hero */
.hero{display:grid;grid-template-columns:200px 1fr;gap:28px;align-items:center;margin-bottom:32px;}
.gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px;background:var(--panel);border:1px solid var(--border);border-radius:12px;}
.gauge-header{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;}
.gauge-label{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600;}
.gauge-score{font-size:2.2rem;font-weight:800;color:${scoreColor};letter-spacing:-0.03em;text-shadow:0 2px 8px ${scoreColor}33;}
.gauge-sub{font-size:.8rem;color:var(--muted);font-weight:500;}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}
.summary-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:6px;transition:all .2s ease;cursor:default;}
.summary-card:hover{transform:translateY(-3px);border-color:var(--vscode-focusBorder);box-shadow:0 8px 24px rgba(0,0,0,.12);}
.summary-card .val{font-size:1.6rem;font-weight:800;letter-spacing:-0.02em;}
.summary-card .lbl{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600;}
.summary-card .sub{font-size:.78rem;color:var(--muted);}
.summary-card.fail .val{color:var(--fail);}
.summary-card.warn .val{color:var(--warn);}
.summary-card.pass .val{color:var(--pass);}
.summary-card.info .val{color:var(--info);}

/* Scope bar */
.scope-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--panel);border:1px solid var(--border);border-radius:10px;margin-bottom:24px;font-size:.82rem;color:var(--muted);flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.04);}
.scope-bar strong{color:var(--fg);font-weight:600;}

/* Toolbar */
.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap;padding:4px;}
.search{flex:1;min-width:220px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--fg);font-family:inherit;font-size:.88rem;outline:none;transition:all .15s;box-shadow:0 1px 4px rgba(0,0,0,.04);}
.search:focus{border-color:var(--vscode-focusBorder);box-shadow:0 2px 8px rgba(59,130,246,.1);}
.category-filter{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--fg);font-family:inherit;font-size:.88rem;outline:none;transition:all .15s;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.04);}
.category-filter:focus{border-color:var(--vscode-focusBorder);box-shadow:0 2px 8px rgba(59,130,246,.1);}
.chip{cursor:pointer;padding:6px 14px;border-radius:999px;background:var(--panel);border:1px solid var(--border);font-size:.78rem;color:var(--muted);transition:all .15s;user-select:none;font-weight:600;}
.chip:hover{border-color:var(--vscode-focusBorder);color:var(--fg);box-shadow:0 2px 6px rgba(0,0,0,.08);}
.chip.on{background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.4);color:var(--info);box-shadow:0 2px 8px rgba(59,130,246,.15);}

/* Table */
.table-wrap{background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);}
.table-header{display:grid;grid-template-columns:130px 80px 1fr 180px;padding:12px 18px;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);background:rgba(128,128,128,.04);font-weight:600;}
.table-row{display:grid;grid-template-columns:130px 80px 1fr 180px;padding:12px 18px;align-items:center;border-bottom:1px solid var(--border);font-size:.84rem;transition:all .12s;}
.table-row:last-child{border-bottom:none;}
.table-row:hover{background:var(--vscode-list-hoverBackground);transform:translateX(2px);}
.cat-badge{display:inline-block;padding:4px 10px;border-radius:8px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
.sev-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;}
.sev-critical .sev-dot,.sev-high .sev-dot{background:var(--fail);box-shadow:0 0 6px rgba(239,68,68,.3);}
.sev-medium .sev-dot{background:var(--warn);box-shadow:0 0 6px rgba(245,158,11,.3);}
.sev-low .sev-dot{background:var(--pass);box-shadow:0 0 6px rgba(16,185,129,.3);}
.sev-text{font-size:.74rem;font-weight:700;}
.sev-high .sev-text{color:var(--fail);}
.sev-medium .sev-text{color:var(--warn);}
.sev-low .sev-text{color:var(--pass);}
.desc-cell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;}
.file-cell{color:var(--link);font-size:.78rem;cursor:pointer;text-decoration:underline;text-decoration-color:transparent;transition:all .15s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;}
.file-cell:hover{text-decoration-color:var(--link);color:var(--vscode-textLink-activeForeground);}
.empty-state{text-align:center;padding:56px 24px;color:var(--muted);}
.empty-state h3{margin:0 0 8px;font-size:1.1rem;color:var(--fg);font-weight:600;}
.empty-state p{margin:0;font-size:.9rem;}
.hidden{display:none !important;}

/* Charts */
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;}
.chart-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);}
.chart-title{font-size:.85rem;font-weight:700;color:var(--fg);margin-bottom:16px;text-transform:uppercase;letter-spacing:.04em;}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.bar-label{width:120px;font-size:.78rem;color:var(--muted);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bar-track{flex:1;height:20px;background:rgba(128,128,128,.08);border-radius:999px;overflow:hidden;position:relative;}
.bar-fill{height:100%;border-radius:999px;transition:width 1s cubic-bezier(.4,0,.2,1);position:relative;}
.bar-fill::after{content:attr(data-count);position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.65rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3);}
.bar-val{font-size:.78rem;font-weight:600;color:var(--fg);min-width:28px;text-align:right;}

.sev-breakdown{display:flex;gap:16px;align-items:center;justify-content:space-around;padding:8px 0;}
.sev-item{display:flex;flex-direction:column;align-items:center;gap:6px;}
.sev-ring{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;position:relative;background:conic-gradient(var(--color) calc(var(--pct)*1%),rgba(128,128,128,.08) 0);}
.sev-ring::before{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--panel);}
.sev-ring span{position:relative;z-index:1;}
.sev-name{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600;}

/* Animations */
@keyframes fadeInUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.7;}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
.animate-in{animation:fadeInUp .4s ease both;}
.gauge-wrap .gauge-score{animation:pulse 2s ease-in-out infinite;}

/* Section badges for new categories */
.cat-aiResidue{color:#F59E0B;}
.cat-performance{color:#F59E0B;}
.cat-typeSafety{color:#3B82F6;}
.cat-testCoverage{color:#10B981;}
.cat-accessibility{color:#8B5CF6;}
.cat-i18n{color:#EC4899;}
.cat-sensitiveData{color:#EF4444;}
.cat-configDrift{color:#F59E0B;}
.cat-securityHeaders{color:#EF4444;}
.cat-databasePatterns{color:#EF4444;}
.cat-frameworkPractices{color:#F59E0B;}
.cat-workspaceHealth{color:#3B82F6;}
.cat-unusedDeps{color:#10B981;}
.cat-apiContract{color:#3B82F6;}
.cat-complexity{color:#F59E0B;}
.cat-llmSlop{color:#8B5CF6;}
.cat-tokenBleed{color:#EC4899;}
.cat-productionLeak{color:#EF4444;}
.cat-fictionKpi{color:#F59E0B;}
.cat-security{color:#EF4444;}
.cat-quality{color:#F59E0B;}
.cat-maintainability{color:#3B82F6;}

@media(max-width:720px){
  .hero{grid-template-columns:1fr;text-align:center;}
  .summary-grid{grid-template-columns:repeat(2,1fr);}
  .charts-row{grid-template-columns:1fr;}
  .table-header,.table-row{grid-template-columns:100px 60px 1fr 120px;}
  .bar-label{width:90px;}
}
</style>
</head>
<body>
<div class="container">
  <div class="topbar">
    <div class="brand">
      <div class="brand-icon">SB</div>
      <div>
        <div class="brand-title">SimpleBeacon</div>
        <div class="brand-sub">AI Slop Cop &mdash; v${this.version}</div>
      </div>
    </div>
    <span class="status-pill ${g.pass?'':'fail'}"><span style="font-size:.6rem;">&#9679;</span> Gate ${pass}</span>
  </div>

  <div class="hero">
    <div class="gauge-wrap">
      <div class="gauge-header">
        <div class="gauge-label">Quality Score</div>
        <div class="gauge-score">${score}/100</div>
        ${consistencyScore != null ? `<div class="gauge-sub">Consistency: ${consistencyScore}/100</div>` : ''}
      </div>
      ${gaugeSvg}
    </div>
    <div class="summary-grid">
      <div class="summary-card pass">
        <div class="val">${files}</div>
        <div class="lbl">Files Scanned</div>
        ${folders ? `<div class="sub">${folders} folders</div>` : ''}
      </div>
      ${cardsHtml}
    </div>
  </div>

  <div class="scope-bar">
    <strong>Scan scope:</strong> ${files} files${folders ? `, ${folders} folders` : ''} &middot; ${totalFindings} total findings &middot; ${categories.length} categories checked
  </div>

  <div class="charts-row">
    <div class="chart-card">
      <div class="chart-title">Category Breakdown</div>
      ${categoryChartHtml}
    </div>
    <div class="chart-card">
      <div class="chart-title">Severity Distribution</div>
      ${severityChartHtml}
    </div>
  </div>

  <div class="toolbar">
    <input class="search" id="search" placeholder="Search findings..." />
    <select class="category-filter" id="categoryFilter">
      <option value="all">All Categories</option>
      <option value="Blocking Issues">Blocking Issues</option>
      <option value="Secrets">Secrets</option>
      <option value="AI Indicators">AI Indicators</option>
      <option value="EU AI Act">EU AI Act</option>
      <option value="Vulnerabilities">Vulnerabilities</option>
      <option value="Debug Markers">Debug Markers</option>
      <option value="AI Residue">AI Residue</option>
      <option value="Performance">Performance</option>
      <option value="Type Safety">Type Safety</option>
      <option value="Test Coverage">Test Coverage</option>
      <option value="Accessibility">Accessibility</option>
      <option value="i18n">i18n</option>
      <option value="Sensitive Data">Sensitive Data</option>
      <option value="Config Drift">Config Drift</option>
      <option value="Security Headers">Security Headers</option>
      <option value="Database Patterns">Database Patterns</option>
      <option value="Framework Practices">Framework Practices</option>
      <option value="Workspace Health">Workspace Health</option>
      <option value="Unused Deps">Unused Deps</option>
      <option value="API Contract">API Contract</option>
      <option value="Complexity">Complexity</option>
      <option value="LLM Slop">LLM Slop</option>
      <option value="Token Bleed">Token Bleed</option>
      <option value="Production Leak">Production Leak</option>
      <option value="Fiction KPI">Fiction KPI</option>
      <option value="Security">Security</option>
      <option value="Quality">Quality</option>
      <option value="Maintainability">Maintainability</option>
    </select>
    <span class="chip on" data-filter="all">All</span>
    <span class="chip" data-filter="high">High</span>
    <span class="chip" data-filter="medium">Medium</span>
    <span class="chip" data-filter="low">Low</span>
  </div>

  <div class="table-wrap">
    <div class="table-header"><div>Category</div><div>Severity</div><div>Finding</div><div>Location</div></div>
    <div id="rows"></div>
  </div>

  <div id="empty" class="empty-state hidden">
    <h3>No findings match your filters</h3>
    <div>Try adjusting the search or severity filters</div>
  </div>
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const rowsEl=document.getElementById('rows');
const emptyEl=document.getElementById('empty');
const searchEl=document.getElementById('search');
const categoryEl=document.getElementById('categoryFilter');
const chips=document.querySelectorAll('.chip');
const data=${findingsJson};

function render(list){
  rowsEl.innerHTML='';
  if(!list.length){rowsEl.classList.add('hidden');emptyEl.classList.remove('hidden');return;}
  rowsEl.classList.remove('hidden');emptyEl.classList.add('hidden');
  list.forEach(f=>{
    const row=document.createElement('div');row.className='table-row';
    const catClass='cat-'+f.cat.replace(/\s+/g,'').replace(/^./,m=>m.toLowerCase());
    const c=catColor(f.cat);
    const d1=document.createElement('div');
    const badge=document.createElement('span');
    badge.className='cat-badge '+catClass;
    badge.style.background=c+'12';badge.style.color=c;
    badge.style.border='1px solid '+c+'25';
    badge.textContent=f.cat;
    d1.appendChild(badge);row.appendChild(d1);
    const d2=document.createElement('div');d2.className='sev-'+f.sev;
    const dot=document.createElement('span');dot.className='sev-dot';
    const st=document.createElement('span');st.className='sev-text';st.textContent=f.sev;
    d2.appendChild(dot);d2.appendChild(st);row.appendChild(d2);
    const d3=document.createElement('div');d3.className='desc-cell';
    d3.title=f.desc;d3.textContent=f.desc;row.appendChild(d3);
    const d4=document.createElement('div');d4.className='file-cell';
    d4.dataset.file=f.file||'';d4.dataset.line=String(f.line||1);
    d4.title=f.file||'';
    d4.textContent=f.file?(f.file.split(/[\\/]/).pop()+(f.line?':'+f.line:'')):'—';
    row.appendChild(d4);
    rowsEl.appendChild(row);
  });
  rowsEl.querySelectorAll('.file-cell').forEach(c=>{
    c.addEventListener('click',e=>{const file=e.target.dataset.file,line=parseInt(e.target.dataset.line,10)||1;if(file)vscode.postMessage({command:'openFile',file,line});});
  });
}
function catColor(c){
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
  return map[c]||'#3B82F6';
}
function applyFilter(){
  const q=searchEl.value.toLowerCase();
  const category=categoryEl.value;
  const active=document.querySelector('.chip.on')?.dataset.filter||'all';
  const filtered=data.filter(f=>{
    const matchesSearch=q===''||f.desc.toLowerCase().includes(q)||f.cat.toLowerCase().includes(q)||f.file.toLowerCase().includes(q);
    const matchesCategory=category==='all'||f.cat===category;
    const matchesSeverity=active==='all'||f.sev===active;
    return matchesSearch&&matchesCategory&&matchesSeverity;
  });
  render(filtered);
}
chips.forEach(c=>c.addEventListener('click',()=>{chips.forEach(x=>x.classList.remove('on'));c.classList.add('on');applyFilter();}));
searchEl.addEventListener('input',applyFilter);
categoryEl.addEventListener('change',applyFilter);
render(data);

// Animate bar charts on load
setTimeout(()=>{
  document.querySelectorAll('.bar-fill[data-target]').forEach(bar=>{
    const target=bar.getAttribute('data-target');
    if(target)(bar as HTMLElement).style.width=target+'%';
  });
},200);
</script>
</body>
</html>`;
  }

  private extractCategories(report: unknown): { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] {
    const r = report as any;
    const cats: { label: string; count: number; severity: 'pass' | 'fail' | 'warn' | 'info' }[] = [];

    const push = (label: string, sev: 'pass' | 'fail' | 'warn' | 'info', items: RawIssue[]) => {
      if (items?.length) cats.push({ label, count: items.length, severity: sev });
    };

    // Fallback: if no structured categories but rawIssues exist, group by severity
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

    // New analyzer sections from REPORT_SECTION_SCHEMA
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

    // Fallback: flat rawIssues (common in CLI JSON reports)
    if (cats.length === 0 && r.rawIssues?.length) {
      const high = r.rawIssues.filter((i: RawIssue) => i.severity === 'high' || i.severity === 'critical');
      const medium = r.rawIssues.filter((i: RawIssue) => i.severity === 'medium');
      const low = r.rawIssues.filter((i: RawIssue) => i.severity === 'low');
      if (high.length) push('Blocking Issues', 'fail', high);
      if (medium.length) push('Warnings', 'warn', medium);
      if (low.length) push('Info', 'info', low);
    }

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

  private extractAllFindings(report: unknown): { cat: string; sev: string; desc: string; file: string; line: number | '' }[] {
    const r = report as any;
    const all: { cat: string; sev: string; desc: string; file: string; line: number | '' }[] = [];

    const push = (cat: string, sev: string, items: RawIssue[]) => {
      items?.forEach((it: RawIssue) => {
        all.push({
          cat,
          sev: it.severity || sev,
          desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
          file: it.file || it.path || '',
          line: it.line || ''
        });
      });
    };

    // Fallback: if no structured findings but rawIssues exist, use them
    if (!r.gate?.blockingIssues?.length && !r.credentialHygiene?.secrets?.length && r.rawIssues?.length) {
      r.rawIssues.forEach((it: RawIssue) => {
        all.push({
          cat: it.type || 'Finding',
          sev: it.severity || 'medium',
          desc: it.description || it.type || 'Finding',
          file: it.file || it.filePath || '',
          line: it.line || ''
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

  private buildSummaryCard(c: { label: string; count: number; severity: string }): string {
    return `<div class="summary-card ${c.severity} animate-in"><div class="val">${c.count}</div><div class="lbl">${c.label}</div></div>`;
  }

  private buildGauge(score: number, color: string): string {
    const r = 52;
    const c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;
    return `<svg width="140" height="140" viewBox="0 0 140 140" style="filter:drop-shadow(0 2px 6px ${color}40);"><defs><linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${color};stop-opacity:1"/><stop offset="100%" style="stop-color:${color};stop-opacity:.6"/></defs><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--vscode-panel-border)" stroke-width="10" opacity=".3"/><circle cx="70" cy="70" r="${r}" fill="none" stroke="url(#ggrad)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 70 70)"><animate attributeName="stroke-dashoffset" from="${c}" to="${offset}" dur="1s" fill="freeze" calcMode="easeOut"/></circle><text x="70" y="75" text-anchor="middle" font-size="14" font-weight="700" fill="var(--vscode-foreground)">${score}</text></svg>`;
  }

  private buildCategoryChart(categories: { label: string; count: number; severity: string }[]): string {
    if (!categories.length) return '<div style="color:var(--muted);font-size:.85rem;text-align:center;padding:20px;">No findings</div>';
    const max = Math.max(...categories.map(c => c.count));
    const colors: Record<string, string> = { fail: '#EF4444', warn: '#F59E0B', pass: '#10B981', info: '#3B82F6' };
    return categories.slice(0, 8).map((c, i) => {
      const pct = Math.round((c.count / max) * 100);
      const color = colors[c.severity] || '#3B82F6';
      return `<div class="bar-row" style="animation:fadeInUp .4s ease ${i * .06}s both;"><div class="bar-label">${c.label}</div><div class="bar-track"><div class="bar-fill" style="width:0%;background:${color};" data-count="${c.count}" data-target="${pct}"></div></div><div class="bar-val">${c.count}</div></div>`;
    }).join('');
  }

  private buildSeverityChart(findings: { cat: string; sev: string }[]): string {
    const counts = { high: 0, medium: 0, low: 0 };
    findings.forEach(f => { if (f.sev === 'high') counts.high++; else if (f.sev === 'medium') counts.medium++; else counts.low++; });
    const total = findings.length || 1;
    const items = [
      { name: 'High', count: counts.high, color: '#EF4444' },
      { name: 'Medium', count: counts.medium, color: '#F59E0B' },
      { name: 'Low', count: counts.low, color: '#10B981' }
    ];
    return `<div class="sev-breakdown">${items.map((it, i) => `<div class="sev-item" style="animation:fadeInUp .4s ease ${i * .15}s both;"><div class="sev-ring" style="--color:${it.color};--pct:${Math.round((it.count / total) * 100)}"><span style="color:${it.color}">${it.count}</span></div><div class="sev-name">${it.name}</div></div>`).join('')}</div>`;
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
