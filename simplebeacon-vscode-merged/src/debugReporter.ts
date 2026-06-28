import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface DebugEntry {
  timestamp: string;
  type: 'command' | 'message' | 'relay' | 'panel' | 'error' | 'lifecycle' | 'state';
  source: string;
  detail: Record<string, unknown>;
}

export interface ErrorIssue {
  id: string;
  timestamp: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  context: string;
  stack?: string;
}

export class DebugReporter {
  private static _instance: DebugReporter;
  private _entries: DebugEntry[] = [];
  private _maxEntries = 2000;
  private _outputPath: string;
  private _enabled = false;
  public static errorIssues: ErrorIssue[] = [];

  private constructor() {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      const dir = path.join(folders[0].uri.fsPath, '.simplebeacon');
      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
      this._outputPath = path.join(dir, 'debug-report.json');
    } else {
      this._outputPath = path.join(require('os').tmpdir(), 'simplebeacon-debug-report.json');
    }
    this._enabled = vscode.workspace.getConfiguration('simplebeacon').get<boolean>('enableDebugReporter', true);
  }

  public static getInstance(): DebugReporter {
    if (!DebugReporter._instance) { DebugReporter._instance = new DebugReporter(); }
    return DebugReporter._instance;
  }

  public log(type: DebugEntry['type'], source: string, detail: Record<string, unknown>) {
    if (!this._enabled) { return; }
    const entry: DebugEntry = {
      timestamp: new Date().toISOString(),
      type,
      source,
      detail
    };
    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) {
      this._entries = this._entries.slice(-this._maxEntries);
    }
    // Flush async so we don't block the UI
    setTimeout(() => this._flush(), 0); // simplebeacon-ignore memory-leak — one-shot async flush to avoid blocking UI
  }

  public logCommand(command: string, args?: unknown[]) {
    this.log('command', 'extension', { command, args: args ?? [] });
  }

  public logMessage(direction: 'to-webview' | 'from-webview', webviewId: string, message: unknown) {
    this.log('message', 'webview', { direction, webviewId, message });
  }

  public logRelay(method: string, url: string, status?: number, body?: unknown) {
    // Redact body and URL to avoid logging PII/sensitive data
    const safeBody = typeof body === 'string' && body.length > 200 ? body.substring(0, 200) + '...' : body;
    const safeUrl = url ? url.split('?')[0] : url;
    this.log('relay', 'relay-server', { method, url: safeUrl, status, bodySize: typeof safeBody === 'string' ? safeBody.length : 0 });
  }

  public logPanel(action: 'create' | 'reveal' | 'dispose' | 'update' | 'reuse', panelId: string, extra?: Record<string, unknown>) {
    this.log('panel', 'panel-manager', { action, panelId, ...extra });
  }

  public async logError(err: Error, context?: string) {
    this.log('error', context ?? 'unknown', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    // Flag as issue in reporting system
    const issue: ErrorIssue = {
      id: `err-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      type: 'runtime-error',
      severity: 'high',
      message: err.message,
      context: context ?? 'unknown',
      stack: err.stack
    };
    DebugReporter.errorIssues.push(issue);
    // Also write to a dedicated error-issues file for the scanner to pick up
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const dir = path.join(folders[0].uri.fsPath, '.simplebeacon');
        const errorFile = path.join(dir, 'error-issues.json');
        await fs.promises.writeFile(errorFile, JSON.stringify(DebugReporter.errorIssues, null, 2), 'utf8');
      }
    } catch { /* ignore write failures */ }
  }

  public logState(label: string, state: Record<string, unknown>) {
    this.log('state', 'snapshot', { label, state });
  }

  public snapshotWebviewHtml(webviewId: string, html: string) {
    // Store a truncated hash + length so we can detect changes without bloating the file
    const hash = require('crypto').createHash('sha256').update(html).digest('hex').substring(0, 8);
    this.log('state', 'webview-html', { webviewId, htmlLength: html.length, htmlHash: hash });
  }

  public dumpReport(): string {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      extensionVersion: vscode.extensions.getExtension('simplebeacon.simplebeacon-vscode')?.packageJSON?.version ?? 'unknown',
      vscodeVersion: vscode.version,
      entryCount: this._entries.length,
      entries: this._entries
    }, null, 2);
  }

  private _flush() {
    try {
      fs.writeFileSync(this._outputPath, this.dumpReport(), 'utf8');
    } catch {
      // simplebeacon-ignore error-swallowing — debug reporter disk write best-effort
    }
  }

  public getOutputPath(): string {
    return this._outputPath;
  }

  public show() {
    const panel = vscode.window.createWebviewPanel('simplebeaconDebug', 'SimpleBeacon Debug Report', vscode.ViewColumn.Three, { enableScripts: true });
    panel.webview.html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:system-ui,sans-serif;margin:20px;background:#1e1e1e;color:#ccc}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #333}
th{background:#252526;color:#fff;position:sticky;top:0}
tr:hover{background:#2a2d2e}
.command{color:#89d185}.message{color:#75beff}.relay{color:#d18616}
.panel{color:#ce9178}.error{color:#f48771;font-weight:700}
.lifecycle{color:#b5cea8}.state{color:#dcdcaa}
.filter-btn{padding:4px 12px;margin:2px;border:none;border-radius:4px;background:#333;color:#ccc;cursor:pointer}
.filter-btn.active{background:#007acc;color:#fff}
#toolbar{margin-bottom:12px}
</style></head>
<body>
<h2>SimpleBeacon Debug Report</h2>
<div id="toolbar"></div>
<table id="logTable"><thead><tr><th>Time</th><th>Type</th><th>Source</th><th>Detail</th></tr></thead><tbody id="tbody"></tbody></table>
<script>
const entries=${JSON.stringify(this._entries)};
const tbody=document.getElementById('tbody');
const toolbar=document.getElementById('toolbar');
const types=['all','command','message','relay','panel','error','lifecycle','state'];
let active='all';
function render(){
  while(tbody.lastChild){tbody.removeChild(tbody.lastChild);}
  entries.filter(e=>active==='all'||e.type===active).slice(-500).forEach(e=>{
    const tr=document.createElement('tr');
    const td1=document.createElement('td');td1.textContent=e.timestamp.split('T')[1].replace('Z','');tr.appendChild(td1);
    const td2=document.createElement('td');td2.className=e.type;td2.textContent=e.type;tr.appendChild(td2);
    const td3=document.createElement('td');td3.textContent=e.source;tr.appendChild(td3);
    const td4=document.createElement('td');
    const pre=document.createElement('pre');pre.style.margin='0';pre.style.whiteSpace='pre-wrap';
    pre.textContent=JSON.stringify(e.detail,null,2).substring(0,400);
    td4.appendChild(pre);tr.appendChild(td4);
    tbody.appendChild(tr);
  });
}
types.forEach(t=>{
  const b=document.createElement('button');b.className='filter-btn'+(t==='all'?' active':'');b.textContent=t;
  b.onclick=()=>{active=t;document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');render();};
  toolbar.appendChild(b);
});
render();
setInterval(()=>location.reload(),3000); // simplebeacon-ignore memory-leak — intentional auto-refresh for debug reporter page
</script>
</body></html>`;
  }
}
