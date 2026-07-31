import * as vscode from 'vscode';

/**
 * ComplianceSidebar — a webview panel that surfaces the Risk Heatmap
 * and Remediation Ledger from the dashboard directly inside VS Code.
 *
 * Communicates with the dashboard via postMessage protocol:
 * - Receives scan results and renders a 3x3 heatmap grid
 * - Sends "triggerRescan" and "triggerRemediation" commands back to the extension
 */

interface HeatmapCell {
  impact: string;
  likelihood: string;
  count: number;
}

interface ScanSummary {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  heatmap: Record<string, Record<string, number>>;
  remediation: { total: number; applied: number; failed: number };
  topFindings: Array<{ type: string; severity: string; filePath: string; description: string; line?: number }>;
}

export class ComplianceSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-compliance-sidebar';
  private view?: vscode.WebviewView;
  private currentSummary: ScanSummary | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'triggerRescan':
          await vscode.commands.executeCommand('simplebeacon.runScan');
          break;
        case 'triggerRemediation':
          await vscode.commands.executeCommand('simplebeacon.remediate', message.payload?.targetFile);
          break;
        case 'refreshData':
          this.pushUpdate();
          break;
        case 'openFile':
          if (message.payload?.filePath) {
            const uri = vscode.Uri.file(message.payload.filePath);
            await vscode.commands.executeCommand('vscode.open', uri);
            if (message.payload?.line) {
              await vscode.commands.executeCommand('revealLine', { lineNumber: message.payload.line, at: 'center' });
            }
          }
          break;
      }
    });

    if (this.currentSummary) {
      this.pushUpdate();
    }
  }

  /** Called by extension.ts when a scan completes — pushes fresh data to the webview. */
  updateScanResults(issues: Array<{ severity?: string; type?: string; filePath?: string; description?: string; line?: number; count?: number }>, remediation?: { total: number; applied: number; failed: number }) {
    const heatmap: Record<string, Record<string, number>> = {
      high: { high: 0, medium: 0, low: 0 },
      medium: { high: 0, medium: 0, low: 0 },
      low: { high: 0, medium: 0, low: 0 },
    };

    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    const topFindings: ScanSummary['topFindings'] = [];

    for (const issue of issues) {
      const sev = (issue.severity || 'low').toLowerCase();
      const impact = sev === 'critical' || sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
      const count = Number(issue.count) || 1;
      const likelihood = count > 5 ? 'high' : count > 1 ? 'medium' : 'low';
      heatmap[impact][likelihood] += count;

      if (sev === 'critical') criticalCount += count;
      else if (sev === 'high') highCount += count;
      else if (sev === 'medium') mediumCount += count;
      else lowCount += count;

      if (topFindings.length < 10 && issue.filePath) {
        topFindings.push({
          type: issue.type || 'unknown',
          severity: sev,
          filePath: issue.filePath,
          description: issue.description || '',
          line: issue.line,
        });
      }
    }

    this.currentSummary = {
      totalIssues: criticalCount + highCount + mediumCount + lowCount,
      criticalCount, highCount, mediumCount, lowCount,
      heatmap,
      remediation: remediation || { total: 0, applied: 0, failed: 0 },
      topFindings,
    };

    this.pushUpdate();
  }

  private pushUpdate() {
    if (this.view && this.currentSummary) {
      this.view.webview.postMessage({ command: 'scanUpdate', payload: this.currentSummary });
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Compliance</title>
<style>
  body { font-family: var(--vscode-font-family, sans-serif); margin: 0; padding: 8px; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-size: 12px; }
  .header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .header h2 { font-size: 14px; margin: 0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-red { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
  .badge-yellow { background: rgba(234,179,8,0.15); color: #eab308; border: 1px solid rgba(234,179,8,0.3); }
  .badge-green { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .summary { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
  .stat { padding: 4px 6px; border-radius: 4px; background: var(--vscode-editor-inactive-selection-background); text-align: center; min-width: 50px; }
  .stat-num { font-size: 16px; font-weight: 700; }
  .stat-label { font-size: 9px; opacity: 0.7; }
  .heatmap { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .heatmap th { font-size: 9px; opacity: 0.6; padding: 2px; text-align: center; }
  .heatmap td { padding: 6px 2px; text-align: center; cursor: pointer; border: 1px solid var(--vscode-panel-border); border-radius: 3px; transition: transform 0.1s; }
  .heatmap td:hover { transform: scale(1.05); }
  .heatmap td.selected { outline: 2px solid var(--vscode-focusBorder); }
  .cell-red { background: rgba(239,68,68,0.15); color: #ef4444; }
  .cell-amber { background: rgba(234,179,8,0.15); color: #eab308; }
  .cell-green { background: rgba(34,197,94,0.15); color: #22c55e; }
  .cell-num { font-size: 14px; font-weight: 700; }
  .cell-label { font-size: 8px; opacity: 0.6; }
  .findings { margin-top: 8px; }
  .finding { padding: 4px 6px; margin-bottom: 3px; border-radius: 3px; cursor: pointer; border-left: 3px solid; }
  .finding:hover { background: var(--vscode-list-hover-background); }
  .finding-critical, .finding-high { border-color: #ef4444; }
  .finding-medium { border-color: #eab308; }
  .finding-low { border-color: #3b82f6; }
  .finding-type { font-weight: 600; font-size: 11px; }
  .finding-file { font-size: 10px; opacity: 0.6; }
  .actions { display: flex; gap: 4px; margin-bottom: 8px; }
  .btn { padding: 4px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .remediation { margin-top: 8px; padding: 6px; border-radius: 4px; background: var(--vscode-editor-inactive-selection-background); }
  .empty { text-align: center; padding: 20px; opacity: 0.5; }
</style>
</head>
<body>
<div class="header">
  <h2>Compliance Dashboard</h2>
</div>
<div id="content">
  <div class="empty">Run a scan to see results.</div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  let currentData = null;
  let selectedCell = null;

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.command === 'scanUpdate') {
      currentData = msg.payload;
      render();
    }
  });

  function render() {
    if (!currentData) return;
    const d = currentData;
    const c = document.getElementById('content');
    const score = { low: 1, medium: 2, high: 3 };

    let html = '<div class="summary">';
    html += stat(d.criticalCount, 'Critical');
    html += stat(d.highCount, 'High');
    html += stat(d.mediumCount, 'Medium');
    html += stat(d.lowCount, 'Low');
    html += '</div>';

    html += '<div class="actions">';
    html += '<button class="btn" onclick="rescan()">Re-Scan</button>';
    html += '<button class="btn btn-secondary" onclick="remediate()">Run Remediation</button>';
    html += '</div>';

    html += '<table class="heatmap"><thead><tr><th></th><th>Low Lk</th><th>Med Lk</th><th>High Lk</th></tr></thead><tbody>';
    ['high','medium','low'].forEach(imp => {
      html += '<tr><th style="text-align:right;font-size:9px;">'+imp+' Imp</th>';
      ['low','medium','high'].forEach(lk => {
        const count = d.heatmap[imp][lk];
        const total = score[imp]*score[lk];
        const cls = total >= 6 ? 'cell-red' : total >= 3 ? 'cell-amber' : 'cell-green';
        const label = total >= 6 ? 'Red' : total >= 3 ? 'Amber' : 'Green';
        const sel = selectedCell && selectedCell.impact===imp && selectedCell.likelihood===lk ? 'selected' : '';
        const title = 'Filter issues by '+imp+' impact and '+lk+' likelihood ('+count+' found)';
        html += '<td class="'+cls+' '+sel+'" role="button" tabindex="0" aria-pressed="'+(sel? 'true':'false')+'" title="'+title.replace(/"/g,'&quot;')+'" onclick="cellClick(\\''+imp+'\\',\\''+lk+'\\')" onkeydown="if(event.key===\\'Enter\\' || event.key===\\' \\') { event.preventDefault(); cellClick(\\''+imp+'\\',\\''+lk+'\\'); }"><div class="cell-num">'+count+'</div><div class="cell-label">'+label+'</div></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (d.remediation && d.remediation.total > 0) {
      html += '<div class="remediation"><strong>Remediation:</strong> '+d.remediation.applied+'/'+d.remediation.total+' applied';
      if (d.remediation.failed > 0) html += ' <span class="badge badge-red">'+d.remediation.failed+' failed</span>';
      html += '</div>';
    }

    if (d.topFindings && d.topFindings.length > 0) {
      html += '<div class="findings">';
      d.topFindings.forEach(f => {
        const cls = 'finding-'+f.severity;
        const file = f.filePath.split('/').pop().split('\\\\').pop();
        html += '<div class="finding '+cls+'" onclick="openFile(\\''+f.filePath.replace(/\\\\/g,'\\\\\\\\')+'\\','+(f.line||0)+')">';
        html += '<div class="finding-type">'+f.type+' <span class="badge badge-'+(f.severity==='critical'||f.severity==='high'?'red':f.severity==='medium'?'yellow':'green')+'">'+f.severity+'</span></div>';
        html += '<div class="finding-file">'+file+(f.line?':'+f.line:'')+'</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    c.innerHTML = html;
  }

  function stat(n, label) {
    return '<div class="stat"><div class="stat-num">'+n+'</div><div class="stat-label">'+label+'</div></div>';
  }

  function cellClick(imp, lk) {
    if (selectedCell && selectedCell.impact===imp && selectedCell.likelihood===lk) {
      selectedCell = null;
    } else {
      selectedCell = { impact: imp, likelihood: lk };
    }
    render();
  }

  function rescan() { vscode.postMessage({ command: 'triggerRescan' }); }
  function remediate() { vscode.postMessage({ command: 'triggerRemediation' }); }
  function openFile(fp, line) { vscode.postMessage({ command: 'openFile', payload: { filePath: fp, line: line } }); }
</script>
</body>
</html>`;
  }
}
