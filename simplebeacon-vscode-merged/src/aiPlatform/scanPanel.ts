// simplebeacon-ignore memory-leak — static UI bindings and scan result processing
import * as vscode from 'vscode';
import * as path from 'path';
import * as http from 'http';
import { getSbConfig, getNonce } from '../utils/vscode';
import { escapeHtml } from '../utils/string';
import { SimpleBeaconProvider, ScanResult, ScanIssue } from './simplebeaconProvider';
import { DiagnosticsManager } from './diagnostics';
import { provider, diagnosticsManager } from '../extension';

interface ScanOptions {
  mode?: string;
  fullDirectory?: boolean;
  aiProvider?: string;
}

interface ApiScanResponse {
  detectedIssues?: ApiIssue[];
  issues?: ApiIssue[];
  matches?: ApiIssue[];
  severityCounts?: Record<string, number>;
  integrityScore?: number;
  qualityScore?: number;
  generatedAt?: string;
  gate?: { pass?: boolean; score?: number };
  results?: {
    simplebeacon?: {
      findings?: ApiIssue[];
      rawIssues?: ApiIssue[];
      summary?: { severityCounts?: Record<string, number> };
      severityCounts?: Record<string, number>;
      gate?: { score?: number };
    };
    codebase?: {
      findings?: ApiIssue[];
      summary?: { severityCounts?: Record<string, number>; healthScore?: number };
    };
  };
}

interface ApiIssue {
  id?: string;
  type?: string;
  severity?: string;
  description?: string;
  message?: string;
  filePath?: string | string[];
  file?: string | string[];
  line?: number;
  lineNumber?: number;
  column?: number;
  col?: number;
  category?: string;
  effort?: string;
}

/**
 * Webview panel for running and displaying SimpleBeacon scan results.
 */
export class ScanPanel {
  public static currentPanel: ScanPanel | undefined;
  public static readonly viewType = 'simplebeaconScan';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _targetPath: string;

  public static createOrShow(extensionUri: vscode.Uri, targetPath: string): ScanPanel {
    const column = vscode.ViewColumn.One;

    if (ScanPanel.currentPanel) {
      ScanPanel.currentPanel._panel.reveal(column);
      ScanPanel.currentPanel._targetPath = targetPath;
      ScanPanel.currentPanel._update();
      return ScanPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(ScanPanel.viewType, 'SimpleBeacon Scan', column, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    });

    ScanPanel.currentPanel = new ScanPanel(panel, extensionUri, targetPath);
    return ScanPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, targetPath: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._targetPath = targetPath;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'scan':
            await this._runScan(message.path || this._targetPath, message.options || {});
            return;
          case 'browse':
            const uri = await vscode.window.showOpenDialog({
              canSelectFolders: true,
              canSelectFiles: false,
              canSelectMany: false,
              openLabel: 'Select Folder to Scan',
            });
            if (uri && uri[0]) {
              this._targetPath = uri[0].fsPath;
              this._panel.webview.postMessage({ command: 'setPath', path: this._targetPath });
            }
            return;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'simplebeacon');
            return;
          case 'openIssue':
            if (message.issue && message.issue.filePath && message.issue.line) {
              const docUri = vscode.Uri.file(message.issue.filePath);
              vscode.workspace.openTextDocument(docUri).then(
                (doc) => {
                  vscode.window.showTextDocument(doc).then(
                    (editor) => {
                      const position = new vscode.Position(message.issue.line - 1, message.issue.column || 0);
                      editor.selection = new vscode.Selection(position, position);
                      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    },
                    () => {}
                  );
                },
                () => {}
              );
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private _pollTimer?: NodeJS.Timeout;

  private async _runScan(targetPath: string, options: ScanOptions) {
    this._panel.webview.postMessage({ command: 'scanning', status: 'initializing' });
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }

    const config = getSbConfig();
    const apiUrl = (config.get<string>('apiServerUrl') || config.get<string>('apiUrl', '')).trim();
    const apiKey = config.get<string>('apiKey', '');
    if (!apiUrl) {
      this._panel.webview.postMessage({
        command: 'error',
        message: 'API URL not configured. Run "Set API Server URL" command first.',
      });
      return;
    }

    try {
      this._panel.webview.postMessage({ command: 'scanning', status: 'running', path: targetPath });

      // Call the server's synchronous scan endpoint
      const payload = {
        projectPath: targetPath,
        mode: options.mode || 'full',
        fullDirectoryScan: options.fullDirectory !== false,
        analysisType: (options.mode || 'full') === 'full' ? 'complete' : options.mode || 'simplebeacon',
        ...(options.aiProvider ? { aiProvider: options.aiProvider } : {}),
      };
      const data = (await postJson(`${apiUrl}/api/scan-directory`, payload, apiKey)) as ApiScanResponse;
      if (!data) {
        throw new Error('Server returned empty scan result');
      }

      // 3. Transform API response to ScanResult
      const simplebeaconResults = data.results?.simplebeacon;
      const codebaseResults = data.results?.codebase;
      const rawIssues =
        data.detectedIssues ||
        data.issues ||
        data.matches ||
        simplebeaconResults?.findings ||
        simplebeaconResults?.rawIssues ||
        codebaseResults?.findings ||
        [];
      const qualityScore =
        data.integrityScore ||
        data.qualityScore ||
        data.gate?.score ||
        simplebeaconResults?.gate?.score ||
        codebaseResults?.summary?.healthScore ||
        0;
      const mappedIssues = rawIssues.map((issue: ApiIssue): ScanIssue => {
        const sev = (issue.severity || 'low').toLowerCase();
        const rawPath = issue.filePath || issue.file;
        return {
          id: issue.id || `${issue.type}-${Math.random().toString(36).slice(2, 8)}`,
          type: issue.type || 'unknown',
          severity: (['critical', 'high', 'medium', 'low', 'info'].includes(sev)
            ? sev
            : 'low') as ScanIssue['severity'],
          description: issue.description || issue.message || 'No description',
          filePath: Array.isArray(rawPath) ? rawPath[0] : rawPath,
          line: issue.line || issue.lineNumber,
          column: issue.column || issue.col,
          category: issue.category || 'General',
          effort: issue.effort || '20 min',
        };
      });
      // Derive severityCounts from actual issues array so they always match
      const derivedSevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const issue of mappedIssues) {
        const band = issue.severity;
        derivedSevCounts[band] = (derivedSevCounts[band] || 0) + 1;
      }
      const result: ScanResult = {
        projectPath: targetPath,
        issues: mappedIssues,
        severityCounts: {
          critical: derivedSevCounts.critical,
          high: derivedSevCounts.high,
          medium: derivedSevCounts.medium,
          low: derivedSevCounts.low,
          info: derivedSevCounts.info,
        },
        integrityScore: qualityScore,
        timestamp: data.generatedAt || new Date().toISOString(),
      };

      this._panel.webview.postMessage({ command: 'scanComplete', result });

      if (diagnosticsManager) {
        diagnosticsManager.updateDiagnostics(result.issues);
      }
      if (provider) {
        provider.setResult(result);
      }
      vscode.commands.executeCommand('simplebeacon.refreshDashboard', {
        issues: result.issues.length,
        critical: result.severityCounts.critical,
        high: result.severityCounts.high,
        medium: result.severityCounts.medium,
        low: result.severityCounts.low,
        score: result.integrityScore,
      });
    } catch (err) {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
      }
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : '';
      this._panel.webview.postMessage({
        command: 'scanError',
        error: message + (stack ? '\n' + stack.slice(0, 500) : ''),
      });
    }
  }

  private _update() {
    const webview = this._panel.webview;
    webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const config = getSbConfig();
    const apiUrl = (config.get<string>('apiServerUrl') || config.get<string>('apiUrl', '')).trim();
    const connectSrc = apiUrl ? `connect-src ${apiUrl};` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; ${connectSrc}">
    <title>SimpleBeacon Scan</title>
    <style>
        :root {
            --primary: var(--vscode-button-background, #0ea5e9);
            --primary-hover: var(--vscode-button-hoverBackground, #38bdf8);
            --success: var(--vscode-testing-iconPassed, #22c55e);
            --warning: var(--vscode-editorWarning-foreground, #f59e0b);
            --danger: var(--vscode-editorError-foreground, #ef4444);
            --info: var(--vscode-editorInfo-foreground, #3b82f6);
            --bg: var(--vscode-editor-background, #0a0a0a);
            --surface: var(--vscode-panel-background, #141414);
            --border: var(--vscode-panel-border, #262626);
            --text: var(--vscode-foreground, #fafafa);
            --text-secondary: var(--vscode-descriptionForeground, #a3a3a3);
            --text-muted: var(--vscode-disabledForeground, #737373);
            --font: var(--vscode-font-family, 'Inter', system-ui, sans-serif);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: var(--font);
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            padding: 20px;
        }
        h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 16px; }
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            background: var(--surface);
            margin-bottom: 16px;
        }
        .input-row {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 12px;
        }
        input[type="text"] {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            color: var(--text);
            font-size: 0.875rem;
        }
        select {
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            color: var(--text);
            font-size: 0.875rem;
        }
        button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 0.875rem;
            cursor: pointer;
            border: none;
            background: var(--primary);
            color: #fff;
        }
        button:hover { filter: brightness(1.1); }
        button.secondary {
            background: var(--surface);
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .dropzone {
            border: 2px dashed var(--border);
            border-radius: 8px;
            padding: 32px;
            text-align: center;
            background: var(--surface);
            transition: all 150ms;
            cursor: pointer;
            margin-bottom: 16px;
        }
        .dropzone:hover, .dropzone.drag-active {
            border-color: var(--primary);
            background: rgba(99,102,241,0.05);
        }
        .dropzone .icon { font-size: 2rem; margin-bottom: 8px; }
        .dropzone p { color: var(--text-secondary); margin: 0; }
        .progress {
            display: none;
            margin-bottom: 16px;
        }
        .progress.active { display: block; }
        .progress-bar {
            height: 6px;
            background: var(--border);
            border-radius: 3px;
            overflow: hidden;
        }
        .progress-bar .fill {
            height: 100%;
            background: var(--primary);
            width: 0%;
            transition: width 300ms;
            border-radius: 3px;
        }
        .progress-status {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 6px;
        }
        .file-log {
            display: none;
            margin-top: 10px;
            max-height: 180px;
            overflow-y: auto;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.7rem;
            line-height: 1.4;
            color: var(--text-secondary);
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 8px 10px;
        }
        .file-log.active { display: block; }
        .file-log .entry {
            display: flex;
            gap: 8px;
            opacity: 0.7;
            animation: fadeIn 200ms forwards;
        }
        .file-log .entry.current { opacity: 1; color: var(--primary); }
        .file-log .entry .check { flex-shrink: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 0.7; transform: none; } }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .metric-box {
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            text-align: center;
        }
        .metric-value { font-size: 1.1rem; font-weight: 700; }
        .metric-label { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .issue-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .issue-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg);
            cursor: pointer;
        }
        .issue-item:hover { border-color: var(--primary); }
        .issue-severity {
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .severity-critical { background: rgba(239,68,68,0.15); color: var(--danger); }
        .severity-high { background: rgba(239,68,68,0.15); color: var(--danger); }
        .severity-medium { background: rgba(245,158,11,0.15); color: var(--warning); }
        .severity-low { background: rgba(59,130,246,0.15); color: var(--info); }
        .severity-info { background: rgba(107,114,128,0.15); color: var(--text-muted); }
        .issue-text { flex: 1; min-width: 0; font-size: 0.8rem; }
        .issue-file { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .hidden { display: none !important; }
        .error-banner {
            padding: 12px;
            border-radius: 6px;
            background: rgba(239,68,68,0.08);
            border: 1px solid var(--danger);
            color: var(--text-secondary);
            margin-bottom: 16px;
        }
        .empty { text-align: center; padding: 32px; color: var(--text-muted); }
    </style>
</head>
<body>
    <h1>🔍 SimpleBeacon Scan</h1>

    <div class="panel">
        <div class="input-row">
            <input type="text" id="pathInput" placeholder="Project path..." value="${escapeHtml(this._targetPath)}">
            <button class="secondary" id="browseBtn">📁 Browse</button>
        </div>
        <div class="input-row">
            <select id="modeSelect" aria-label="Scan mode">
                <option value="full">Full Analysis</option>
                <option value="gate">Gate Only</option>
                <option value="security">Security Focus</option>
                <option value="quality">Quality Focus</option>
            </select>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
                <input type="checkbox" id="fullTreeCheck" aria-label="Full tree scan" checked> Full tree scan
            </label>
        </div>
        <button id="scanBtn" style="width:100%;">▶ Start Scan</button>
    </div>

    <div class="progress" id="progressPanel">
        <div class="progress-bar"><div class="fill" id="progressFill"></div></div>
        <div class="progress-status" id="progressStatus">Initializing...</div>
        <div class="file-log" id="fileLog"></div>
    </div>

    <div id="results"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const pathInput = document.getElementById('pathInput');
        const browseBtn = document.getElementById('browseBtn');
        const scanBtn = document.getElementById('scanBtn');
        const modeSelect = document.getElementById('modeSelect');
        const fullTreeCheck = document.getElementById('fullTreeCheck');
        const progressPanel = document.getElementById('progressPanel');
        const progressFill = document.getElementById('progressFill');
        const progressStatus = document.getElementById('progressStatus');
        const fileLog = document.getElementById('fileLog');
        const results = document.getElementById('results');

        browseBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'browse' });
        });

        scanBtn.addEventListener('click', () => {
            const path = pathInput.value.trim();
            if (!path) {
                results.textContent = '';
                const errDiv = document.createElement('div');
                errDiv.className = 'error-banner';
                errDiv.textContent = 'Please enter a project path.';
                results.appendChild(errDiv);
                return;
            }
            vscode.postMessage({
                command: 'scan',
                path,
                options: {
                    mode: modeSelect.value,
                    fullDirectory: fullTreeCheck.checked
                }
            });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.command) {
                case 'setPath':
                    pathInput.value = message.path || '';
                    return;
                case 'scanning':
                    progressPanel.classList.add('active');
                    fileLog.classList.add('active');
                    progressFill.style.width = message.status === 'running' ? '10%' : '5%';
                    progressStatus.textContent = message.status === 'running'
                        ? 'Scanning ' + (message.path || '') + '...'
                        : 'Initializing scan...';
                    fileLog.textContent = '';
                    results.textContent = '';
                    scanBtn.disabled = true;
                    return;
                case 'scanProgress':
                    progressFill.style.width = (message.percent || 0) + '%';
                    progressStatus.textContent = (message.filename || 'Scanning...') +
                        ' (' + (message.current || 0) + '/' + (message.total || 0) + ')';
                    // Append engine/file to log
                    const entry = document.createElement('div');
                    entry.className = 'entry current';
                    const check = message.percent >= 100 ? '✓' : '◐';
                    const checkSpan = document.createElement('span'); checkSpan.className = 'check'; checkSpan.textContent = check;
                    const txtSpan = document.createElement('span'); txtSpan.textContent = escapeHtml(message.engine || message.filename || 'Scanning...');
                    entry.append(checkSpan, document.createTextNode(' '), txtSpan);
                    fileLog.appendChild(entry);
                    fileLog.scrollTop = fileLog.scrollHeight;
                    // Fade previous entries
                    for (const e of fileLog.querySelectorAll('.entry')) { e.classList.remove('current'); }
                    return;
                case 'scanComplete':
                    progressPanel.classList.remove('active');
                    fileLog.classList.remove('active');
                    scanBtn.disabled = false;
                    renderResults(message.result);
                    return;
                case 'scanError':
                    progressPanel.classList.remove('active');
                    fileLog.classList.remove('active');
                    scanBtn.disabled = false;
                    results.textContent = '';
                    const errDiv = document.createElement('div'); errDiv.className = 'error-banner'; errDiv.textContent = '❌ ' + message.error;
                    const hintP = document.createElement('p'); hintP.style.color = 'var(--text-muted)'; hintP.style.fontSize = '0.8rem'; hintP.style.marginTop = '8px';
                    hintP.textContent = 'Make sure the SimpleBeacon server is running at the configured API URL. ';
                    const openLink = document.createElement('a'); openLink.href = '#'; openLink.id = 'openSettings'; openLink.style.color = 'var(--primary)'; openLink.textContent = 'Open Settings';
                    hintP.appendChild(openLink); results.append(errDiv, hintP);
                    document.getElementById('openSettings')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        vscode.postMessage({ command: 'openSettings' });
                    });
                    return;
            }
        });

        function renderResults(result) {
            const sev = result.severityCounts || {};
            const issues = result.issues || [];
            const score = result.integrityScore || 0;
            results.textContent = '';

            const panel = document.createElement('div'); panel.className = 'panel';
            const header = document.createElement('div'); header.style.display = 'flex'; header.style.alignItems = 'center'; header.style.justifyContent = 'space-between'; header.style.marginBottom = '12px';
            const title = document.createElement('span'); title.style.fontWeight = '600'; title.textContent = 'Scan Results';
            const pathSpan = document.createElement('span'); pathSpan.style.fontSize = '0.75rem'; pathSpan.style.color = 'var(--text-muted)'; pathSpan.textContent = escapeHtml(result.projectPath || '');
            header.append(title, pathSpan); panel.appendChild(header);
            const grid = document.createElement('div'); grid.className = 'metric-grid';
            const metrics = [
                { label: 'Critical', value: sev.critical || 0, color: 'var(--danger)' },
                { label: 'High', value: sev.high || 0, color: 'var(--danger)' },
                { label: 'Medium', value: sev.medium || 0, color: 'var(--warning)' },
                { label: 'Low', value: sev.low || 0, color: 'var(--info)' },
                { label: 'Issues', value: issues.length, color: '' },
                { label: 'Integrity', value: score + '%', color: score === 100 ? 'var(--success)' : score >= 80 ? 'var(--warning)' : 'var(--danger)' }
            ];
            metrics.forEach(m => {
                const box = document.createElement('div'); box.className = 'metric-box';
                const val = document.createElement('div'); val.className = 'metric-value'; if (m.color) val.style.color = m.color; val.textContent = String(m.value);
                const lbl = document.createElement('div'); lbl.className = 'metric-label'; lbl.textContent = m.label;
                box.append(val, lbl); grid.appendChild(box);
            });
            panel.appendChild(grid); results.appendChild(panel);

            const ctrlPanel = document.createElement('div'); ctrlPanel.className = 'panel'; ctrlPanel.style.display = 'flex'; ctrlPanel.style.gap = '10px'; ctrlPanel.style.alignItems = 'center'; ctrlPanel.style.flexWrap = 'wrap'; ctrlPanel.style.marginBottom = '12px';
            const fmtSel = document.createElement('select'); fmtSel.id = 'scanExportFormat'; fmtSel.style.padding = '6px 10px'; fmtSel.style.borderRadius = '4px'; fmtSel.style.border = '1px solid var(--border)'; fmtSel.style.background = 'var(--bg)'; fmtSel.style.color = 'var(--fg)'; fmtSel.style.fontSize = '12px';
            ['csv','json','txt'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v.toUpperCase(); fmtSel.appendChild(o); });
            const expBtn = document.createElement('button'); expBtn.id = 'scanExportBtn'; expBtn.style.padding = '6px 14px'; expBtn.style.borderRadius = '4px'; expBtn.style.border = 'none'; expBtn.style.background = 'var(--primary)'; expBtn.style.color = '#fff'; expBtn.style.fontSize = '12px'; expBtn.style.cursor = 'pointer'; expBtn.textContent = 'Export';
            ctrlPanel.append(fmtSel, expBtn); results.appendChild(ctrlPanel);

            if (issues.length === 0) {
                const empty = document.createElement('div'); empty.className = 'panel empty'; empty.textContent = '✅ No issues found!'; results.appendChild(empty);
            } else {
                const issuePanel = document.createElement('div'); issuePanel.className = 'panel';
                const issueTitle = document.createElement('div'); issueTitle.style.fontWeight = '600'; issueTitle.style.marginBottom = '10px'; issueTitle.textContent = 'Issues (' + issues.length + ')';
                issuePanel.appendChild(issueTitle);
                const list = document.createElement('div'); list.className = 'issue-list';
                for (const issue of issues.slice(0, 50)) {
                    const item = document.createElement('div'); item.className = 'issue-item';
                    const sevText = escapeHtml(issue.severity || '');
                    const sevSpan = document.createElement('span'); sevSpan.className = 'issue-severity severity-' + sevText; sevSpan.textContent = sevText;
                    const body = document.createElement('div'); body.className = 'issue-text'; body.textContent = escapeHtml(issue.description);
                    if (issue.filePath) {
                        const fp = document.createElement('div'); fp.className = 'issue-file'; fp.textContent = escapeHtml(issue.filePath.split(/[\\/]/).pop()) + (issue.line ? ':' + issue.line : '');
                        body.appendChild(fp);
                    }
                    item.append(sevSpan, body);
                    item.addEventListener('click', () => openIssue(issue));
                    list.appendChild(item);
                }
                if (issues.length > 50) {
                    const more = document.createElement('div'); more.style.textAlign = 'center'; more.style.color = 'var(--text-muted)'; more.style.fontSize = '0.75rem'; more.style.padding = '8px'; more.textContent = '... and ' + (issues.length - 50) + ' more issues';
                    list.appendChild(more);
                }
                issuePanel.appendChild(list); results.appendChild(issuePanel);
            }
        }

        function openIssue(issue) {
            vscode.postMessage({ command: 'openIssue', issue });
        }

        function downloadFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType || 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportScanResults() {
            const fmt = document.getElementById('scanExportFormat').value;
            const date = new Date().toISOString().slice(0, 10);
            const fname = 'simplebeacon-scan-' + date;
            if (!lastResult || !lastResult.issues || lastResult.issues.length === 0) {
                return;
            }
            const issues = lastResult.issues;
            if (fmt === 'json') {
                const content = JSON.stringify({ exportDate: date, issues: issues }, null, 2);
                downloadFile(content, fname + '.json', 'application/json');
                return;
            }
            if (fmt === 'txt') {
                let txt = 'SimpleBeacon Scan Report\nDate: ' + date + '\nIssues: ' + issues.length + '\n\n';
                for (let i = 0; i < issues.length; i++) {
                    const iss = issues[i];
                    txt += (i + 1) + '. [' + (iss.severity || 'low').toUpperCase() + '] ' + (iss.description || 'Issue') + '\n  File: ' + (iss.filePath || '-') + '\n';
                }
                downloadFile(txt, fname + '.txt', 'text/plain');
                return;
            }
            let csv = 'Severity,Description,File,Line\n';
            for (const iss of issues) {
                csv += '"' + (iss.severity || 'low') + '","' + (iss.description || '').replace(/"/g, '""') + '","' + (iss.filePath || '-') + '","' + (iss.line || '') + '"\n';
            }
            downloadFile(csv, fname + '.csv', 'text/csv');
        }

        let lastResult = null;
        const origRenderResults = renderResults;
        renderResults = function(result) {
            lastResult = result;
            origRenderResults(result);
            const exportBtn = document.getElementById('scanExportBtn');
            if (exportBtn) {
                exportBtn.onclick = exportScanResults;
            }
        };

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
  }

  public dispose() {
    ScanPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}

function postJson(url: string, payload: Record<string, unknown>, apiKey?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(payload);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function getJson(url: string, apiKey?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}
