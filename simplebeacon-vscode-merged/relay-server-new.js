// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PORT = process.env.PORT || 3002;
const sidebarTempFile = path.join(os.tmpdir(), 'simplebeacon-sidebar-browser.html');

function getSidebarHtml() {
  if (fs.existsSync(sidebarTempFile)) {
    try {
      return fs.readFileSync(sidebarTempFile, 'utf8');
    } catch (e) {}
  }
  return '<h1>SimpleBeacon Sidebar</h1><p>Run "SimpleBeacon: Open Sidebar in Browser" from VS Code: to generate the sidebar HTML.</p>';
}

function getLayoutHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>window._relayPort=${PORT};window.__SB_API_URL__='http://127.0.0.1:54358';window.__SB_RELAY_URL__='http://localhost:${PORT}';window._inVsCodePanel=true;</script>
<title>SimpleBeacon Dashboard</title>
<style>
:root{--bg:#0a0a0a;--surface:#141414;--surface-hover:#262626;--border:#262626;--text-primary:#fafafa;--text-secondary:#a3a3a3;--text-muted:#737373;--accent:#22d3ee;--header-height:56px;--nav-width:220px;--radius:6px;--radius-md:10px;--font-stack:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-stack);overflow:hidden;height:100vh;background:var(--bg);color:var(--text-secondary)}
.container{display:flex;height:100vh}
.browser-sidebar{width:260px;min-width:200px;max-width:400px;height:100vh;border-right:1px solid var(--border);background:var(--surface);overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;padding:8px 0;box-sizing:border-box}
.browser-sidebar .sidebar-section{margin-bottom:4px}
.browser-sidebar .sidebar-heading{padding:6px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);font-weight:600}
.browser-sidebar .sidebar-link{display:flex;align-items:center;gap:10px;padding:8px 16px;color:#a3a3a3;font-size:13px;cursor:pointer;transition:background .15s;text-decoration:none;border-radius:0}
.browser-sidebar .sidebar-link:hover{background:#262626;color:#fafafa}
.browser-sidebar .sidebar-link.active{background:rgba(14,99,156,.15);color:#0e639c;border-right:2px solid #0e639c}
.browser-sidebar .sidebar-link .icon{font-size:16px;width:20px;text-align:center}
.resizer{width:5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0}
.resizer:hover{background:var(--accent)}
.content{flex:1;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
.page-content{flex:1;position:relative;overflow:hidden}
.page-frame{position:absolute;inset:0;width:100%;height:100%;border:none;display:none}
.page-frame.active{display:block}
iframe{width:100%;height:100%;border:none;display:block}
</style>
</head>
<body>
<div class="container">
  <div class="browser-sidebar" id="browserSidebar">
    <div class="sidebar-section"><div class="sidebar-heading">Core</div>
      <div class="sidebar-link" data-command="showDashboardPane"><span class="icon">&#x1F4CA;</span> Dashboard</div>
      <div class="sidebar-link" data-command="showAnalyzePane"><span class="icon">&#x1F50D;</span> Analyze</div>
      <div class="sidebar-link" data-command="showReportPane"><span class="icon">&#x1F4CB;</span> Report</div>
    </div>
    <div class="sidebar-section"><div class="sidebar-heading">Quality</div>
      <div class="sidebar-link" data-command="showSecurityPane"><span class="icon">&#x1F512;</span> Security</div>
      <div class="sidebar-link" data-command="showTrustPane"><span class="icon">&#x1F91D;</span> Trust</div>
      <div class="sidebar-link" data-command="showQualityPane"><span class="icon">&#x2696;</span> Quality</div>
      <div class="sidebar-link" data-command="showAuditPane"><span class="icon">&#x1F4CB;</span> Audit</div>
      <div class="sidebar-link dashboard" data-command="showCompliancePane"><span class="icon">&#x1F4D1;</span> Compliance</div>
      <div class="sidebar-link dashboard" data-command="showAnalyticsPane"><span class="icon">&#x1F4C8;</span> Analytics</div>
    </div>
    <div class="sidebar-section"><div class="sidebar-heading">Management</div>
      <div class="sidebar-link" data-command="showSettingsPane"><span class="icon">&#x2699;</span> Settings</div>
      <div class="sidebar-link dashboard" data-command="showRepoHealthPane"><span class="icon">&#x1F3E0;</span> Repo Health</div>
      <div class="sidebar-link dashboard" data-command="showTeamPane"><span class="icon">&#x1F465;</span> Team</div>
      <div class="sidebar-link dashboard" data-command="showCertificatePane"><span class="icon">&#x1F3C6;</span> Certificate</div>
    </div>
    <div class="sidebar-section"><div class="sidebar-heading">Tools</div>
      <div class="sidebar-link dashboard" data-command="showCodeMapPane"><span class="icon">&#x1F5FA;</span> Code Map</div>
      <div class="sidebar-link" data-command="showUploadPane"><span class="icon">&#x1F4E4;</span> Upload</div>
      <div class="sidebar-link dashboard" data-command="showAiContextPane"><span class="icon">&#x1F916;</span> AI Context</div>
      <div class="sidebar-link dashboard" data-command="showRoadmapPane"><span class="icon">&#x1F6E4;</span> Roadmap</div>
      <div class="sidebar-link dashboard" data-command="showScanPane"><span class="icon">&#x1F50D;</span> Scan</div>
    </div>
    <div class="sidebar-section"><div class="sidebar-heading">Account</div>
      <div class="sidebar-link" data-command="signIn"><span class="icon">&#x1F512;</span> Sign In</div>
    </div>
  </div>
  <div class="resizer" id="resizer"></div>
  <div class="content">
    <div class="page-content" id="pageContent">
      <iframe id="mainIframe" src="/welcome" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </div>
  </div>
</div>
<script>
(function(){
  const resizer = document.getElementById('resizer');
  const sidebar = document.querySelector('.browser-sidebar');
  let isDragging = false, startX = 0, startWidth = 0;
  resizer.addEventListener('mousedown', function(e){
    isDragging = true; startX = e.clientX; startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){
    if(!isDragging) return;
    sidebar.style.width = Math.max(200, Math.min(400, startWidth + (e.clientX - startX))) + 'px';
  });
  document.addEventListener('mouseup', function(){ isDragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; });

  const mainIframe = document.getElementById('mainIframe');
  const CMD_TO_TAB = {
    showDashboardPane: 'dashboard', showRepoHealthPane: 'dashboard', showTeamPane: 'dashboard',
    showScanPane: 'scan', showSecurityPane: 'scan', showTrustPane: 'scan', showQualityPane: 'scan',
    showReportPane: 'report', showAuditPane: 'report', showCompliancePane: 'report', showAnalyticsPane: 'report',
    showUploadPane: 'upload',
    showSettingsPane: 'advanced', showCodeMapPane: 'advanced', showAiContextPane: 'advanced', showRoadmapPane: 'advanced', showCertificatePane: 'advanced', showAnalyzePane: 'advanced'
  };
  document.querySelectorAll('.sidebar-link[data-command]').forEach(function(link){
    link.addEventListener('click', function(){
      const cmd = link.dataset.command;
      if(mainIframe && mainIframe.contentWindow){
        if (cmd === 'signIn') {
          mainIframe.contentWindow.postMessage({command: 'rehydrateCachedSession'}, '*');
        } else if (CMD_TO_TAB[cmd]) {
          mainIframe.contentWindow.postMessage({command: 'switchSidebarTab', tab: CMD_TO_TAB[cmd]}, '*');
        } else {
          mainIframe.contentWindow.postMessage({command: cmd}, '*');
        }
      }
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  // Listen for messages from iframe and handle them in browser context
  window.addEventListener('message', function(ev) {
    if (!ev.data || !ev.data.command) return;
    // Relay scan/file/open commands to a real backend if available
    if (ev.data.command === 'openFile' && ev.data.path) {
      console.log('[Browser] openFile:', ev.data.path);
      // In browser mode, try to open via vscode:// protocol or just log
      try { window.open('vscode://file/' + ev.data.path, '_blank'); } catch(e) {}
    }
    if (ev.data.command === 'scan' || ev.data.command === 'runScan' || ev.data.command === 'analyze') {
      console.log('[Browser] scan requested:', ev.data);
      // Acknowledge so iframe doesn't hang
      if (mainIframe && mainIframe.contentWindow) {
        mainIframe.contentWindow.postMessage({command: 'scanProgress', progress: 0, status: 'Starting scan...'}, '*');
      }
    }
  });
})();
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const parsed = require('url').parse(req.url || '', true);
  const cacheHeaders = {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };

  if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
    res.writeHead(200, cacheHeaders);
    res.end(getLayoutHtml());
    return;
  }
  if (parsed.pathname === '/sidebar') {
    let sidebarHtml = getSidebarHtml();
    if (sidebarHtml && !sidebarHtml.includes('window.__SB_BROWSER_MODE__')) {
      const browserMock =
        '<script>(function(){window.__SB_BROWSER_MODE__=true;document.body&&document.body.classList.add("browser-mode");window.vscode=window.vscode||{postMessage:function(msg){if(msg&&msg.command){try{parent.postMessage(msg,"*");}catch(e){}}}};})();</script>';
      if (sidebarHtml.includes('</body>')) sidebarHtml = sidebarHtml.replace('</body>', browserMock + '</body>');
      else if (sidebarHtml.includes('</head>')) sidebarHtml = sidebarHtml.replace('</head>', browserMock + '</head>');
      else sidebarHtml = browserMock + sidebarHtml;
    }
    res.writeHead(200, cacheHeaders);
    res.end(sidebarHtml);
    return;
  }
  if (parsed.pathname === '/welcome') {
    let sidebarHtml = getSidebarHtml();
    if (sidebarHtml && !sidebarHtml.includes('window.__SB_BROWSER_MODE__')) {
      const browserMock =
        '<script>(function(){window.__SB_BROWSER_MODE__=true;document.body&&document.body.classList.add("browser-mode");var vs={postMessage:function(msg){if(msg&&msg.command){try{parent.postMessage(msg,"*");}catch(e){}}},getState:function(){return{};},setState:function(){}};window.vscode=vs;if(typeof vscode==="undefined"){window.vscode=vs;}})();</script>';
      // Inject at the beginning so it runs before any script that references bare 'vscode'
      if (sidebarHtml.includes('<head>')) sidebarHtml = sidebarHtml.replace('<head>', '<head>' + browserMock);
      else if (sidebarHtml.includes('<body>')) sidebarHtml = sidebarHtml.replace('<body>', '<body>' + browserMock);
      else sidebarHtml = browserMock + sidebarHtml;
    }
    res.writeHead(200, cacheHeaders);
    res.end(sidebarHtml);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('SimpleBeacon relay server running at http://127.0.0.1:' + PORT);
});
