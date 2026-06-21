import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { provider, diagnosticsManager } from '../extension';

/**
 * Webview view provider for the SimpleBeacon dashboard panel.
 */
export class DashboardPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeaconDashboard';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _pollTimer?: NodeJS.Timeout;
  private _lastLocalReportTime?: number;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Start polling for scan results from server, but don't overwrite fresh local scans
    this._startReportPolling();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'scanWorkspace':
          await vscode.commands.executeCommand('simplebeacon.scanWorkspace');
          return;
        case 'uploadReport':
          await vscode.commands.executeCommand('simplebeacon.uploadReport');
          return;
        case 'openBrowser':
          await vscode.commands.executeCommand('simplebeacon.openBrowser');
          return;
        case 'openReport':
          await vscode.commands.executeCommand('simplebeacon.openReport');
          return;
        case 'openAnalyze':
          await vscode.commands.executeCommand('simplebeacon.openAnalyze');
          return;
        case 'openUpload':
          await vscode.commands.executeCommand('simplebeacon.openUpload');
          return;
        case 'openAiContext':
          await vscode.commands.executeCommand('simplebeacon.openAiContext');
          return;
        case 'sendToAi':
          await vscode.commands.executeCommand('simplebeacon.sendToAi');
          return;
        case 'toggleMonitor':
          await vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
          return;
        case 'clearResults':
          await vscode.commands.executeCommand('simplebeacon.clearResults');
          return;
        case 'refresh':
          await vscode.commands.executeCommand('simplebeacon.refreshResults');
          return;
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'simplebeacon');
          return;
      }
    });
  }

  public updateStats(scanResult?: {
    issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    score: number;
    timestamp?: string;
  }) {
    if (this._view) {
      this._view.webview.postMessage({ command: 'updateStats', ...scanResult });
    }
  }

  public updateReport(report?: Record<string, any>) {
    this._lastLocalReportTime = Date.now();
    if (this._view) {
      this._view.webview.postMessage({ command: 'updateReport', report });
    }
  }

  public clearStats() {
    if (this._view) {
      this._view.webview.postMessage({ command: 'clearStats' });
    }
  }

  private _startReportPolling() {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const apiUrl = (config.get<string>('apiServerUrl') || config.get<string>('apiUrl', '')).trim();
    const apiKey = config.get<string>('apiKey', '');
    if (!apiUrl) { return; }

    const poll = async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      const projectPath = workspaceFolders[0].uri.fsPath;
      let hasData = false;

      let serverOnline = false;
      try {
        const url = `${apiUrl}/api/simplebeacon/report?projectPath=${encodeURIComponent(projectPath)}`;
        const report = await getJson(url, apiKey);
        if (report && typeof report === 'object') {
          const sev = report.severityCounts || {};
          const issues = report.detectedIssues || report.rawIssues || [];
          const score = report.gate?.score ?? report.qualityScore ?? 100;
          const timestamp = report.generatedAt || report.scan_summary?.timestamp || '';
          hasData = issues.length > 0;
          serverOnline = true;

          // Only update from server if local data is older than 2 minutes
          const localDataFresh = this._lastLocalReportTime && (Date.now() - this._lastLocalReportTime) < 120000;
          if (!localDataFresh) {
            this.updateStats({
              issues: issues.length,
              critical: sev.critical || 0,
              high: sev.high || 0,
              medium: sev.medium || 0,
              low: sev.low || 0,
              score,
              timestamp,
            });
          }
        }
      } catch {
        // Server offline or report not found — rely on local scan data
      }

      // Also check if AI context exists from website uploads
      if (!hasData) {
        try {
          const ctxUrl = `${apiUrl}/api/ai-context?projectPath=${encodeURIComponent(projectPath)}`;
          const ctx = await getJson(ctxUrl, apiKey);
          if (ctx && ctx.success && ctx.content) {
            hasData = true;
            this._view?.webview.postMessage({ command: 'hasAiContext' });
          }
        } catch {
          // AI context may not exist yet
        }
      }

      // Notify webview of server status
      this._view?.webview.postMessage({ command: 'serverStatus', online: serverOnline, hasData });
    };

    // Poll immediately, then every 15 seconds
    void poll();
    this._pollTimer = setInterval(poll, 15000);
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const apiUrl = (config.get<string>('apiServerUrl') || config.get<string>('apiUrl', '')).trim();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>SimpleBeacon</title>
    <style>
        :root {
            --glass-bg: rgba(30, 30, 46, 0.6);
            --glass-border: rgba(255, 255, 255, 0.08);
            --glass-highlight: rgba(255, 255, 255, 0.05);
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.3);
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --text: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
            background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: var(--text);
            padding: 16px;
            min-height: 100vh;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--glass-border);
        }
        .logo {
            width: 36px; height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.2rem;
            box-shadow: 0 4px 15px var(--accent-glow);
        }
        .header-text h2 { font-size: 1rem; font-weight: 600; margin: 0; }
        .header-text p { font-size: 0.7rem; color: var(--text-muted); margin: 2px 0 0; }
        .card {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 12px;
            transition: all 0.2s ease;
        }
        .card:hover {
            border-color: var(--accent);
            box-shadow: 0 0 20px var(--accent-glow);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }
        .stat-box {
            background: var(--glass-highlight);
            border-radius: 8px;
            padding: 10px 6px;
            text-align: center;
            border: 1px solid var(--glass-border);
        }
        .stat-value {
            font-size: 1.1rem;
            font-weight: 700;
            line-height: 1.2;
        }
        .stat-label {
            font-size: 0.6rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 4px;
        }
        .actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--glass-border);
            background: var(--glass-highlight);
            color: var(--text);
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            text-decoration: none;
            width: 100%;
        }
        .btn:hover {
            background: var(--accent);
            border-color: var(--accent);
            box-shadow: 0 0 15px var(--accent-glow);
            transform: translateY(-1px);
        }
        .btn-primary {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-color: transparent;
            color: #fff;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #7c3aed, #6366f1);
        }
        .btn-ai {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-color: transparent;
            color: #fff;
            opacity: 0.4;
            pointer-events: none;
            transition: all 0.3s ease;
        }
        .btn-ai.active {
            opacity: 1;
            pointer-events: auto;
            animation: aiPulse 2s infinite;
        }
        .btn-ai.active:hover {
            background: linear-gradient(135deg, #7c3aed, #6366f1);
            box-shadow: 0 0 25px rgba(99, 102, 241, 0.6);
        }
        @keyframes aiPulse {
            0% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.3); }
            50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.6); }
            100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.3); }
        }
        .btn-icon {
            width: 20px; height: 20px;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.9rem;
        }
        .status-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--glass-border);
        }
        .status-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--success);
            box-shadow: 0 0 6px var(--success);
        }
        .status-dot.offline { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
        .section-title {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin-bottom: 8px;
            font-weight: 600;
        }
        .empty-state {
            text-align: center;
            padding: 24px 8px;
            color: var(--text-muted);
        }
        .empty-state .icon { font-size: 2rem; margin-bottom: 8px; opacity: 0.5; }
        .empty-state p { font-size: 0.8rem; margin-bottom: 12px; }
        .score-ring {
            width: 48px; height: 48px;
            border-radius: 50%;
            background: conic-gradient(var(--accent) calc(var(--score) * 1%), var(--glass-border) 0);
            display: flex; align-items: center; justify-content: center;
            position: relative;
        }
        .score-ring::before {
            content: '';
            position: absolute;
            width: 38px; height: 38px;
            border-radius: 50%;
            background: var(--glass-bg);
        }
        .score-ring span {
            position: relative;
            font-size: 0.75rem;
            font-weight: 700;
            z-index: 1;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🛡️</div>
        <div class="header-text">
            <h2>SimpleBeacon</h2>
            <p>AI Safety Scanner</p>
        </div>
    </div>

    <div class="section-title">Scan Stats</div>
    <div class="card" id="statsCard">
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-value" style="color:var(--danger)" id="statCritical">0</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color:var(--warning)" id="statHigh">0</div>
                <div class="stat-label">High</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color:var(--info)" id="statIssues">0</div>
                <div class="stat-label">Issues</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;justify-content:center;padding-top:4px;">
            <div class="score-ring" id="scoreRing" style="--score:0;">
                <span id="scoreValue">--</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);">
                <div style="font-weight:600;color:var(--text-secondary);">Integrity Score</div>
                <div id="scoreLabel">No scan yet</div>
            </div>
        </div>
    </div>

    <div class="section-title">Quick Actions</div>
    <div class="actions">
        <button class="btn btn-primary" id="btn-scanWorkspace">
            <span class="btn-icon">🔍</span>
            <span>Scan Workspace</span>
        </button>
        <button class="btn" id="btn-openBrowser">
            <span class="btn-icon">🌐</span>
            <span>Open Dashboard</span>
        </button>
        <button class="btn btn-primary" id="btn-openReport">
            <span class="btn-icon">📊</span>
            <span>Report</span>
        </button>
        <button class="btn" id="btn-openAnalyze">
            <span class="btn-icon">📊</span>
            <span>Analyze Page</span>
        </button>
        <button class="btn" id="btn-openUpload">
            <span class="btn-icon">📁</span>
            <span>Upload & Validate</span>
        </button>
        <button class="btn btn-ai" id="btn-sendToAi">
            <span class="btn-icon">🤖</span>
            <span>Send Scan to AI Agent</span>
        </button>
        <button class="btn" id="btn-openAiContext">
            <span class="btn-icon">📄</span>
            <span>Open AI Context</span>
        </button>
        <button class="btn" id="btn-toggleMonitor">
            <span class="btn-icon">👁</span>
            <span>Toggle Monitor</span>
        </button>
        <button class="btn" id="btn-clearResults">
            <span class="btn-icon">🗑</span>
            <span>Clear Results</span>
        </button>
    </div>

    <div class="status-row">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Checking server...</span>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        function send(cmd) { vscode.postMessage({ command: cmd }); }

        document.getElementById('btn-scanWorkspace')?.addEventListener('click', () => send('scanWorkspace'));
        document.getElementById('btn-openBrowser')?.addEventListener('click', () => send('openBrowser'));
        document.getElementById('btn-openReport')?.addEventListener('click', () => send('openReport'));
        document.getElementById('btn-openAnalyze')?.addEventListener('click', () => send('openAnalyze'));
        document.getElementById('btn-openUpload')?.addEventListener('click', () => send('openUpload'));
        document.getElementById('btn-sendToAi')?.addEventListener('click', () => send('sendToAi'));
        document.getElementById('btn-openAiContext')?.addEventListener('click', () => send('openAiContext'));
        document.getElementById('btn-toggleMonitor')?.addEventListener('click', () => send('toggleMonitor'));
        document.getElementById('btn-clearResults')?.addEventListener('click', () => send('clearResults'));

        const API_URL = '${apiUrl.replace(/\/+$/, '')}';
        async function checkServer() {
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            if (!API_URL) {
                dot.className = 'status-dot offline';
                text.textContent = 'Server not configured — set simplebeacon.apiUrl';
                return;
            }
            const hasLocal = window.__simplebeaconLastReport && (window.__simplebeaconLastReport.issueCount || window.__simplebeaconLastReport.rawIssues?.length);
            try {
                await fetch(API_URL + '/api/health', { method: 'GET', mode: 'no-cors' });
                dot.className = 'status-dot';
                text.textContent = hasLocal ? 'Server online — local scan data available' : 'Server online';
            } catch {
                dot.className = 'status-dot offline';
                text.textContent = hasLocal ? 'Server offline — local scan data available' : 'Server offline — start with: node server/index.cjs';
            }
        }
        checkServer();
        setInterval(checkServer, 10000);

        window.addEventListener('message', (event) => {
            const msg = event.data;
            const aiBtn = document.getElementById('btn-sendToAi');
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');

            if (msg.command === 'updateStats') {
                document.getElementById('statCritical').textContent = msg.critical || 0;
                document.getElementById('statHigh').textContent = msg.high || 0;
                document.getElementById('statIssues').textContent = msg.issues || 0;
                const score = msg.score || 0;
                document.getElementById('scoreRing').style.setProperty('--score', score);
                document.getElementById('scoreValue').textContent = score + '%';
                document.getElementById('scoreLabel').textContent = score === 100 ? 'Perfect' : score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
                // Enable Send to AI button when scan data exists
                if (aiBtn && msg.issues > 0) {
                    aiBtn.classList.add('active');
                }
            }
            if (msg.command === 'hasAiContext') {
                // Website uploaded scan data — enable the button even if no report issues
                if (aiBtn) aiBtn.classList.add('active');
            }
            if (msg.command === 'serverStatus') {
                if (dot && text) {
                    const hasLocal = window.__simplebeaconLastReport && (window.__simplebeaconLastReport.issueCount || window.__simplebeaconLastReport.rawIssues?.length);
                    if (msg.online) {
                        dot.className = 'status-dot';
                        text.textContent = msg.hasData ? 'Server online — scan data ready' : 'Server online';
                    } else {
                        dot.className = 'status-dot offline';
                        text.textContent = hasLocal ? 'Server offline — local scan data available' : 'Server offline — start with: node server/index.cjs';
                    }
                }
                if (aiBtn && msg.hasData) {
                    aiBtn.classList.add('active');
                }
            }
            if (msg.command === 'clearStats') {
                if (aiBtn) aiBtn.classList.remove('active');
            }
            if (msg.command === 'updateReport') {
                window.__simplebeaconLastReport = msg.report || null;
                if (msg.report) {
                    const sev = msg.report.severityCounts || {};
                    document.getElementById('statCritical').textContent = sev.critical || 0;
                    document.getElementById('statHigh').textContent = sev.high || 0;
                    document.getElementById('statIssues').textContent = msg.report.issueCount || 0;
                    const score = msg.report.qualityScore || 0;
                    document.getElementById('scoreRing').style.setProperty('--score', score);
                    document.getElementById('scoreValue').textContent = score + '%';
                    document.getElementById('scoreLabel').textContent = score === 100 ? 'Perfect' : score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
                    if (aiBtn) aiBtn.classList.add('active');
                }
            }
        });
    </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
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
