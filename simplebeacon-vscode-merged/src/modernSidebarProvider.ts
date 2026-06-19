import * as vscode from 'vscode';

/**
 * Modern sidebar webview view provider for the SimpleBeacon extension.
 */
export class ModernSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-modern';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      try {
        switch (message.command) {
          case 'scan':
            vscode.commands.executeCommand('simplebeacon.scanWorkspace');
            break;
          case 'clear':
            vscode.commands.executeCommand('simplebeacon.clearResults');
            break;
          case 'settings':
            vscode.commands.executeCommand('simplebeacon.openSettings');
            break;
          case 'report':
            vscode.commands.executeCommand('simplebeacon.showReport');
            break;
          case 'cert':
            vscode.commands.executeCommand('simplebeacon.generateCertificate');
            break;
          case 'enhanced':
            vscode.commands.executeCommand('simplebeacon.enhancedAnalysis');
            break;
          case 'realtime':
            vscode.commands.executeCommand('simplebeacon.realtimeAnalysis');
            break;
          case 'pattern':
            vscode.commands.executeCommand('simplebeacon.patternDetection');
            break;
          case 'health':
            vscode.commands.executeCommand('simplebeacon.modelHealth');
            break;
          case 'codemap':
            vscode.commands.executeCommand('simplebeacon.showCodeMap');
            break;
          case 'dashboard':
            vscode.commands.executeCommand('simplebeacon.openEnhancedDashboard20');
            break;
          case 'analytics':
            vscode.commands.executeCommand('simplebeacon.runAdvancedAnalytics');
            break;
          case 'team':
            vscode.commands.executeCommand('simplebeacon.showTeamDashboard');
            break;
          case 'toggleRealtime':
            vscode.commands.executeCommand('simplebeacon.toggleRealtimeMonitoring');
            break;
          case 'openBrowser':
            vscode.commands.executeCommand('simplebeacon.openBrowser');
            break;
          case 'upload':
            vscode.commands.executeCommand('simplebeacon.uploadReport');
            break;
          case 'analyze':
            vscode.commands.executeCommand('simplebeacon.openAnalyze');
            break;
          case 'sendToAi':
            vscode.commands.executeCommand('simplebeacon.sendToAi');
            break;
          case 'openUpload':
            vscode.commands.executeCommand('simplebeacon.openUpload');
            break;
          case 'preview':
            vscode.commands.executeCommand('simplebeacon.openAnalyze');
            break;
          case 'sendSidebarToAi':
            vscode.commands.executeCommand('simplebeacon.sendSidebarToAi', message.report);
            break;
          case 'setMonitorDir':
            vscode.commands.executeCommand('simplebeacon.setMonitorDirectory', message.value);
            break;
          case 'openCloudInBrowser':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/audit.html');
            break;
          case 'openCloudInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview', '/audit.html');
            break;
          case 'openAiToolsInBrowser':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/dashboard');
            break;
          case 'openAiToolsInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview', '/#/dashboard');
            break;
          case 'openAdvancedInBrowser':
            vscode.commands.executeCommand('simplebeacon.openInBrowser', '/#/dashboard');
            break;
          case 'openAdvancedInPreview':
            vscode.commands.executeCommand('simplebeacon.openInPreview', '/#/dashboard');
            break;
        }
      } catch (err) {
        vscode.window.showErrorMessage('SimpleBeacon sidebar error: ' + (err instanceof Error ? err.message : String(err)));
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--vscode-font-family);
  font-size: 13px;
  color: var(--vscode-foreground);
  background: var(--vscode-sidebar-background, var(--vscode-editor-background));
  padding: 0;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, var(--vscode-activityBar-background) 0%, var(--vscode-sideBar-background) 100%);
  border-bottom: 1px solid var(--vscode-panel-border);
}
.header-icon { 
  font-size: 24px; 
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}
.header-text { display: flex; flex-direction: column; }
.header-title { 
  font-size: 15px; 
  font-weight: 700;
  color: var(--vscode-activityBar-foreground);
}
.header-subtitle { 
  font-size: 11px; 
  color: var(--vscode-activityBar-inactiveForeground);
  margin-top: 2px;
}

/* Status Badge */
.status-container {
  padding: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.status-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  transition: all 0.3s ease;
}
.status-badge.ready { border-left: 3px solid var(--vscode-charts-green); }
.status-badge.scanning { border-left: 3px solid var(--vscode-charts-orange); animation: pulse-border 2s infinite; }
.status-badge.error { border-left: 3px solid var(--vscode-charts-red); }
.status-badge.completed { border-left: 3px solid var(--vscode-charts-blue); }

.status-icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.status-icon.ready { background: rgba(59, 165, 93, 0.15); }
.status-icon.scanning { background: rgba(209, 154, 102, 0.15); animation: pulse-bg 1.5s infinite; }
.status-icon.error { background: rgba(244, 67, 54, 0.15); }
.status-icon.completed { background: rgba(100, 149, 237, 0.15); }

.status-text { display: flex; flex-direction: column; }
.status-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
.status-value { font-size: 13px; font-weight: 600; }

@keyframes pulse-bg {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes pulse-border {
  0%, 100% { border-left-width: 3px; }
  50% { border-left-width: 5px; }
}

/* Content */
.content { padding: 16px; }

/* Section */
.section { margin-bottom: 20px; }
.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Primary Actions */
.actions-primary { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.btn {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}
.btn:hover::before { opacity: 1; }
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.btn:active { transform: translateY(0); }

.btn-scan {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}
.btn-scan:hover { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4); }

.btn-action {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: 1px solid var(--vscode-panel-border);
}
.btn-action:hover {
  background: var(--vscode-button-hoverBackground, var(--vscode-button-secondaryBackground));
  border-color: var(--vscode-focusBorder);
}
.btn-icon { font-size: 16px; width: 20px; text-align: center; }
.btn-text { flex: 1; }
.btn-shortcut {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
}

/* Secondary Actions Row */
.actions-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.btn-small {
  padding: 8px;
  font-size: 12px;
  justify-content: center;
}

/* Results - simple rows */
.results-grid { padding: 4px 0; }
.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--vscode-panel-border);
  font-size: 13px;
}
.metric-row:last-child { border-bottom: none; }
.metric-name { color: var(--vscode-descriptionForeground); }
.metric-value {
  font-weight: 700;
  color: var(--vscode-foreground);
  font-variant-numeric: tabular-nums;
}
.metric-value.pass { color: var(--vscode-charts-green); }
.metric-value.fail { color: var(--vscode-charts-red); }

/* Dashboard stat cards */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.stat-card {
  background: var(--vscode-panel-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  transition: all 0.2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.stat-card.critical { border-top: 3px solid #ef4444; }
.stat-card.high { border-top: 3px solid #f59e0b; }
.stat-card.medium { border-top: 3px solid #3b82f6; }
.stat-card.low { border-top: 3px solid #10b981; }
.stat-card.score { border-top: 3px solid #6366f1; }
.stat-card.issues { border-top: 3px solid #8b5cf6; }
.stat-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--vscode-foreground);
  margin-bottom: 2px;
}
.stat-label {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Collapsible */
.collapsible { border: 1px solid var(--vscode-panel-border); border-radius: 8px; overflow: hidden; }
.collapsible-header {
  padding: 12px 14px;
  background: var(--vscode-panel-background);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;
}
.collapsible-header:hover { background: var(--vscode-list-hoverBackground); }
.collapsible-arrow { transition: transform 0.3s; font-size: 10px; }
.open-browser-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
}
.open-browser-btn:hover { opacity: 1; background: var(--vscode-button-secondaryBackground); }
.collapsible.expanded .collapsible-arrow { transform: rotate(180deg); }
.collapsible-content {
  padding: 10px 14px;
  display: none;
  border-top: 1px solid var(--vscode-panel-border);
}
.collapsible.expanded .collapsible-content { display: block; }
.collapsible-btn {
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  transition: all 0.15s;
}
.collapsible-btn:hover { background: var(--vscode-button-hoverBackground); }
.collapsible-btn:last-child { margin-bottom: 0; }

/* Empty State */
.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
.empty-state-icon { font-size: 32px; margin-bottom: 8px; opacity: 0.5; }

/* Divider */
.divider {
  height: 1px;
  background: var(--vscode-panel-border);
  margin: 16px 0;
}
</style>
</head>
<body>
<div class="header">
  <div class="header-icon">🛡️</div>
  <div class="header-text">
    <div class="header-title">SimpleBeacon</div>
    <div class="header-subtitle">AI Slop Cop</div>
  </div>
</div>

<div class="status-container">
  <div class="status-badge ready" id="statusBadge">
    <div class="status-icon ready" id="statusIcon">✓</div>
    <div class="status-text">
      <div class="status-label">Status</div>
      <div class="status-value" id="statusText">Ready to scan</div>
    </div>
  </div>
</div>

<div class="content">
  <!-- Primary Actions -->
  <div class="section">
    <div class="section-title">
      <span>Quick Actions</span>
    </div>
    <div class="actions-primary">
      <button class="btn btn-scan" id="scanBtn">
        <span class="btn-icon">🔍</span>
        <span class="btn-text">Scan Workspace</span>
      </button>
    </div>
    <div class="actions-secondary">
      <button class="btn btn-action btn-small" id="clearBtn">
        <span class="btn-icon">🗑️</span>
        <span>Clear</span>
      </button>
      <button class="btn btn-action btn-small" id="reportBtn">
        <span class="btn-icon">📊</span>
        <span>Report</span>
      </button>
      <button class="btn btn-action btn-small" id="settingsBtn">
        <span class="btn-icon">⚙️</span>
        <span>Settings</span>
      </button>
      <button class="btn btn-action btn-small" id="certBtn">
        <span class="btn-icon">🏆</span>
        <span>Certificate</span>
      </button>
      <button class="btn btn-action btn-small" id="previewBtn">
        <span class="btn-icon">🌐</span>
        <span>Preview</span>
      </button>
    </div>
  </div>

  <!-- Results Dashboard -->
  <div class="section" id="resultsSection" style="display:none;">
    <div class="section-title">
      <span>Dashboard</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:10px; color:var(--vscode-descriptionForeground);">Analysis Complete</span>
        <button class="btn btn-action btn-small" id="sendToAiBtn" style="padding:2px 8px;font-size:11px;" title="Copy scan summary to clipboard for AI chatbot">
          <span>🤖</span>
          <span>Send to AI</span>
        </button>
      </div>
    </div>
    <!-- Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card critical">
        <div class="stat-count" id="statCritical">0</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card high">
        <div class="stat-count" id="statHigh">0</div>
        <div class="stat-label">High</div>
      </div>
      <div class="stat-card medium">
        <div class="stat-count" id="statMedium">0</div>
        <div class="stat-label">Medium</div>
      </div>
      <div class="stat-card low">
        <div class="stat-count" id="statLow">0</div>
        <div class="stat-label">Low</div>
      </div>
      <div class="stat-card issues">
        <div class="stat-count" id="statIssues">0</div>
        <div class="stat-label">Issues</div>
      </div>
      <div class="stat-card score">
        <div class="stat-count" id="statScore">-</div>
        <div class="stat-label">Score</div>
      </div>
    </div>
    <!-- Summary rows -->
    <div class="results-grid">
      <div class="metric-row">
        <span class="metric-name">Repository Files</span>
        <span class="metric-value" id="totalFiles">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-name">Gate Checked</span>
        <span class="metric-value" id="files">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-name">Gate Status</span>
        <span class="metric-value" id="gate">-</span>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div class="empty-state" id="emptyState">
    <div class="empty-state-icon">📋</div>
    <div>No scan results yet</div>
    <div style="font-size:11px; margin-top:4px; opacity:0.7;">Run a scan to see dashboard</div>
  </div>

  <div class="divider"></div>

  <!-- aiPlatform Tools -->
  <div class="section">
    <div class="collapsible" id="aiPlatformTools">
      <div class="collapsible-header" onclick="toggleCollapsible('aiPlatformTools')">
        <span>☁️ Cloud & AI Tools</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openCloudInPreview'})" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openCloudInBrowser'})" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'upload'})">☁️ Upload & Validate Report</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'analyze'})">📊 Open Analyze Page</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'openUpload'})">📤 Open Upload Page</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'sendToAi'})">🤖 Send Scan to AI Agent</button>
      </div>
    </div>
  </div>

  <!-- Advanced Tools (Collapsed by default) -->
  <div class="section">
    <div class="collapsible" id="aiTools">
      <div class="collapsible-header" onclick="toggleCollapsible('aiTools')">
        <span>🤖 AI Analysis Tools</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openAiToolsInPreview'})" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openAiToolsInBrowser'})" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'enhanced'})">✨ Enhanced Analysis</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'realtime'})">⚡ Real-time Analysis</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'pattern'})">🔍 Pattern Detection</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'health'})">❤️ Model Health</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'toggleRealtime'})">👁️ Toggle AI Slop Monitor</button>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="collapsible" id="advancedFeatures">
      <div class="collapsible-header" onclick="toggleCollapsible('advancedFeatures')">
        <span>🚀 Advanced Features</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="collapsible-arrow">▼</span>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openAdvancedInPreview'})" title="Open in Preview">👁️</button>
          <button class="open-browser-btn" onclick="event.stopPropagation();vscode.postMessage({command:'openAdvancedInBrowser'})" title="Open in Browser">🌐</button>
        </div>
      </div>
      <div class="collapsible-content">
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'codemap'})">🗺️ Code Map</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'dashboard'})">📊 Dashboard 2.0</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'analytics'})">📈 Analytics</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'team'})">👥 Team Dashboard</button>
        <button class="collapsible-btn" onclick="vscode.postMessage({command:'openBrowser'})">🌐 Open Browser</button>
      </div>
    </div>
  </div>
</div>

<script>
try {
  const vscode = acquireVsCodeApi();
  window.vscode = vscode;

  // Primary buttons
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) scanBtn.onclick = () => {
    setStatus('scanning', 'Scanning workspace...');
    vscode.postMessage({command:'scan'});
  };
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.onclick = () => {
    setStatus('ready', 'Ready to scan');
    hideResults();
    vscode.postMessage({command:'clear'});
  };
  const reportBtn = document.getElementById('reportBtn');
  if (reportBtn) reportBtn.onclick = () => vscode.postMessage({command:'report'});
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.onclick = () => vscode.postMessage({command:'settings'});
  const certBtn = document.getElementById('certBtn');
  if (certBtn) certBtn.onclick = () => vscode.postMessage({command:'cert'});
  const previewBtn = document.getElementById('previewBtn');
  if (previewBtn) previewBtn.onclick = () => vscode.postMessage({command:'preview'});
  const sendToAiBtn = document.getElementById('sendToAiBtn');
  if (sendToAiBtn) sendToAiBtn.onclick = () => {
    const report = window.__currentSidebarReport || null;
    vscode.postMessage({command:'sendSidebarToAi', report});
  };

} catch (e) {
  console.error('Sidebar init error:', e);
}

function setStatus(state, text) {
  const badge = document.getElementById('statusBadge');
  const icon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  if (!badge || !icon || !statusText) return;
  badge.className = 'status-badge ' + state;
  icon.className = 'status-icon ' + state;
  if (state === 'ready') { icon.textContent = '✓'; }
  else if (state === 'scanning') { icon.textContent = '⟳'; }
  else if (state === 'error') { icon.textContent = '✕'; }
  else if (state === 'completed') { icon.textContent = '✓'; }
  statusText.textContent = text;
}

function showResults(report) {
  try {
    window.__currentSidebarReport = report;
    const emptyState = document.getElementById('emptyState');
    const resultsSection = document.getElementById('resultsSection');
    if (emptyState) emptyState.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    const totalFiles = document.getElementById('totalFiles');
    if (totalFiles) totalFiles.textContent = report.totalFiles || 0;
    const files = document.getElementById('files');
    if (files) files.textContent = report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0;

    const sev = report.severityCounts || {};
    const statCritical = document.getElementById('statCritical');
    if (statCritical) statCritical.textContent = sev.critical || 0;
    const statHigh = document.getElementById('statHigh');
    if (statHigh) statHigh.textContent = sev.high || 0;
    const statMedium = document.getElementById('statMedium');
    if (statMedium) statMedium.textContent = sev.medium || 0;
    const statLow = document.getElementById('statLow');
    if (statLow) statLow.textContent = sev.low || 0;
    const statIssues = document.getElementById('statIssues');
    if (statIssues) statIssues.textContent = report.issueCount || 0;
    const statScore = document.getElementById('statScore');
    if (statScore) statScore.textContent = report.qualityScore !== null && report.qualityScore !== undefined ? report.qualityScore : '?';

    const gateEl = document.getElementById('gate');
    if (gateEl) {
      const gatePass = report.gate?.pass;
      gateEl.textContent = gatePass ? 'PASS' : 'FAIL';
      gateEl.className = 'metric-value ' + (gatePass ? 'pass' : 'fail');
    }

    setStatus('completed', 'Analysis complete — Dashboard ready');
  } catch (err) {
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Error: ' + (err?.message || String(err));
  }
}

function hideResults() {
  const emptyState = document.getElementById('emptyState');
  const resultsSection = document.getElementById('resultsSection');
  if (emptyState) emptyState.style.display = 'block';
  if (resultsSection) resultsSection.style.display = 'none';
}

function toggleCollapsible(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}

window.addEventListener('message', e => {
  try {
    const msg = e.data;
    if (msg.command === 'updateReport') {
      if (msg.report) {
        showResults(msg.report);
      } else {
        hideResults();
      }
    }
    if (msg.command === 'updateStatus') {
      setStatus(msg.status, msg.text);
    }
  } catch (err) {
    console.error('Sidebar message error:', err);
  }
});
</script>
</body>
</html>`;
  }

  public updateReport(report: Record<string, unknown> | null) {
    this._view?.webview.postMessage({ command: 'updateReport', report });
  }

  public updateStatus(status: string, text: string) {
    this._view?.webview.postMessage({ command: 'updateStatus', status, text });
  }
}
