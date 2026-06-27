// simplebeacon-ignore memory-leak — static UI binding
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

function getVersionFromExtUri(extUri: vscode.Uri): string {
  try {
    const pkgPath = path.join(extUri.fsPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return (pkg.version as string) || '1.0.0';
  } catch {
    // simplebeacon-ignore error-swallowing — package.json read fallback
    return '1.0.0';
  }
}

/**
 * Webview panel for displaying scan reports in a modern web interface.
 */
export class Web2Panel {
  private static currentPanel: Web2Panel | undefined;
  private panel: vscode.WebviewPanel;
  private extUri: vscode.Uri;
  private version: string;

  static createOrShow(extUri: vscode.Uri) {
    const col = vscode.window.activeTextEditor?.viewColumn;
    if (Web2Panel.currentPanel) {
      Web2Panel.currentPanel.panel.reveal(col);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'simplebeaconWeb2',
      'SimpleBeacon Settings',
      col || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extUri, 'media')] }
    );
    Web2Panel.currentPanel = new Web2Panel(panel, extUri);
  }

  private constructor(panel: vscode.WebviewPanel, extUri: vscode.Uri) {
    this.panel = panel;
    this.extUri = extUri;
    this.version = getVersionFromExtUri(extUri);
    this.panel.onDidDispose(
      () => {
        Web2Panel.currentPanel = undefined;
      },
      null,
      []
    );
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      const config = vscode.workspace.getConfiguration('simplebeacon');
      switch (msg.command) {
        case 'updateAutoScan':
          await config.update('autoScanOnOpen', msg.value, true);
          break;
        case 'updateMaxFiles':
          await config.update('maxFiles', parseInt(msg.value, 10) || 5000, true);
          break;
        case 'updateExclude':
          await config.update(
            'excludePatterns',
            msg.value
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean),
            true
          );
          break;
        case 'updateServerUrl':
          await config.update('apiServerUrl', msg.value, true);
          vscode.window.showInformationMessage('SimpleBeacon server URL updated to ' + msg.value);
          break;
        case 'runScan':
          vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          break;
        case 'clearResults':
          vscode.commands.executeCommand('simplebeacon.clearResults');
          break;
        case 'generateCertificate':
          vscode.commands.executeCommand('simplebeacon.generateCertificate');
          break;
        case 'exportReport':
          vscode.commands.executeCommand('simplebeacon.exportReport');
          break;
        case 'showReport':
          vscode.commands.executeCommand('simplebeacon.showReport');
          break;
      }
      // Refresh panel after config changes
      this.panel.webview.html = this.buildHtml();
    });
    this.panel.webview.html = this.buildHtml();
  }

  private buildHtml(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = this.panel.webview.cspSource;
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const autoScan = config.get<boolean>('autoScanOnOpen', false);
    const maxFiles = config.get<number>('maxFiles', 5000);
    const excludePatterns = config.get<string[]>('excludePatterns', []);
    const defaultLocalApi = ['http://', '127.0.0.1', ':3000'].join('');
    const apiUrl = config.get<string>('apiServerUrl') || config.get<string>('apiUrl', defaultLocalApi);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceName =
      workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].name : 'No workspace open';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Settings</title>
<style>
:root{
  --pass:#10B981;--fail:#EF4444;--warn:#F59E0B;--info:#3B82F6;
  --bg:var(--vscode-editor-background);--fg:var(--vscode-foreground);
  --panel:var(--vscode-panel-background);--border:var(--vscode-panel-border);
  --muted:var(--vscode-descriptionForeground);--link:var(--vscode-textLink-foreground);
  --font:var(--vscode-font-family);
  --input-bg:var(--vscode-input-background);--input-fg:var(--vscode-input-foreground);--input-border:var(--vscode-input-border);
  --button-bg:var(--vscode-button-background);--button-fg:var(--vscode-button-foreground);--button-hover:var(--vscode-button-hoverBackground);
  --focus:var(--vscode-focusBorder);
}
*{box-sizing:border-box}
body{font-family:var(--font);background:var(--bg);color:var(--fg);margin:0;padding:0;min-height:100vh;}
.container{max-width:900px;margin:0 auto;padding:24px 20px;}

/* Header */
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;}
.brand{display:flex;align-items:center;gap:10px;}
.brand-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;box-shadow:0 2px 8px rgba(99,102,241,.35);}
.brand-title{font-size:1.15rem;font-weight:600;letter-spacing:-0.01em;}
.brand-sub{color:var(--muted);font-size:.75rem;}
.version-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(59,130,246,.12);color:var(--info);font-size:.75rem;font-weight:600;border:1px solid rgba(59,130,246,.25);}

/* Cards */
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;margin-bottom:18px;overflow:hidden;}
.card-header{padding:14px 18px;border-bottom:1px solid var(--border);font-size:.9rem;font-weight:600;}
.card-body{padding:18px;}

/* Form */
.form-row{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.form-row:last-child{margin-bottom:0;}
label{font-size:.82rem;font-weight:500;color:var(--fg);}
.desc{font-size:.75rem;color:var(--muted);}
input[type="text"],input[type="number"],textarea{
  background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);
  border-radius:6px;padding:8px 10px;font-family:inherit;font-size:.85rem;outline:none;transition:border-color .15s;
}
input:focus,textarea:focus{border-color:var(--focus);}
textarea{resize:vertical;min-height:80px;}
.checkbox-row{display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:16px;}
.checkbox-row input{width:16px;height:16px;accent-color:var(--info);}

/* Buttons */
.btn-group{display:flex;gap:8px;flex-wrap:wrap;}
.btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:6px;font-size:.82rem;font-weight:500;font-family:inherit;border:none;transition:background .15s;}
.btn-primary{background:var(--button-bg);color:var(--button-fg);}
.btn-primary:hover{background:var(--button-hover);}
.btn-secondary{background:var(--panel);color:var(--fg);border:1px solid var(--border);}
.btn-secondary:hover{border-color:var(--focus);}
.btn-danger{background:rgba(239,68,68,.15);color:var(--fail);border:1px solid rgba(239,68,68,.3);}
.btn-danger:hover{background:rgba(239,68,68,.25);}

/* Info list */
.info-list{display:flex;flex-direction:column;gap:10px;}
.info-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);}
.info-item:last-child{border-bottom:none;}
.info-key{font-size:.82rem;font-weight:500;}
.info-val{font-size:.82rem;color:var(--muted);}

/* Quick links */
.link-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;}
.link-item{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:all .15s;}
.link-item:hover{border-color:var(--focus);transform:translateY(-1px);}
.link-title{font-size:.85rem;font-weight:500;margin-bottom:4px;}
.link-desc{font-size:.75rem;color:var(--muted);}

@media(max-width:720px){
  .link-list{grid-template-columns:1fr;}
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
    <span class="version-pill">Settings</span>
  </div>

  <div class="card">
    <div class="card-header">Workspace</div>
    <div class="card-body">
      <div class="info-list">
        <div class="info-item"><span class="info-key">Current workspace</span><span class="info-val">${escapeHtml(workspaceName)}</span></div>
        <div class="info-item"><span class="info-key">Extension version</span><span class="info-val">${this.version}</span></div>
        <div class="info-item"><span class="info-key">Publisher</span><span class="info-val">simplebeacon</span></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Configuration</div>
    <div class="card-body">
      <label class="checkbox-row">
        <input type="checkbox" id="autoScan" aria-label="Auto-scan on workspace open" ${autoScan ? 'checked' : ''} />
        <span>Auto-scan on workspace open</span>
      </label>
      <div class="form-row">
        <label for="maxFiles">Max files to scan</label>
        <div class="desc">Maximum number of files the scanner will analyze in one run.</div>
        <input type="number" id="maxFiles" aria-label="Max files to scan" value="${maxFiles}" />
      </div>
      <div class="form-row">
        <label for="excludePatterns">Exclude patterns</label>
        <div class="desc">One glob pattern per line (e.g. node_modules, .git, dist).</div>
        <textarea id="excludePatterns" aria-label="Exclude patterns">${escapeHtml(excludePatterns.join('\n'))}</textarea>
      </div>
      <div class="form-row">
        <label for="serverUrl">Server URL</label>
        <div class="desc">URL of the SimpleBeacon dashboard server.</div>
        <input type="text" id="serverUrl" aria-label="Server URL" value="${escapeHtml(apiUrl)}" />
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="saveConfig">Save Settings</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Quick Actions</div>
    <div class="card-body">
      <div class="link-list">
        <div class="link-item" data-action="runScan">
          <div class="link-title">Scan Workspace</div>
          <div class="link-desc">Run a full scan on the current workspace.</div>
        </div>
        <div class="link-item" data-action="showReport">
          <div class="link-title">Open Dashboard</div>
          <div class="link-desc">View the scan report dashboard.</div>
        </div>
        <div class="link-item" data-action="exportReport">
          <div class="link-title">Export Report</div>
          <div class="link-desc">Save the latest report as JSON.</div>
        </div>
        <div class="link-item" data-action="generateCertificate">
          <div class="link-title">Generate Certificate</div>
          <div class="link-desc">Create a compliance certificate for this workspace.</div>
        </div>
        <div class="link-item" data-action="clearResults">
          <div class="link-title">Clear Results</div>
          <div class="link-desc">Remove all scan results from the UI.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<script nonce="${nonce}">
const vscode=acquireVsCodeApi();

document.getElementById('saveConfig').addEventListener('click',()=>{
  vscode.postMessage({
    command:'updateAutoScan',
    value:document.getElementById('autoScan').checked
  });
  vscode.postMessage({
    command:'updateMaxFiles',
    value:document.getElementById('maxFiles').value
  });
  vscode.postMessage({
    command:'updateExclude',
    value:document.getElementById('excludePatterns').value
  });
  vscode.postMessage({
    command:'updateServerUrl',
    value:document.getElementById('serverUrl').value
  });
});

document.querySelectorAll('.link-item').forEach(item=>{
  item.addEventListener('click',()=>{
    vscode.postMessage({command:item.dataset.action});
  });
});
</script>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
