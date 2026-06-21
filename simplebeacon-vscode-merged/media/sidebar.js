var vscodeApi = null;
try {
  vscodeApi = acquireVsCodeApi();
} catch (e) {
  console.error('[SB Sidebar] acquireVsCodeApi() failed:', e);
}
if (!vscodeApi) {
  // Inside iframe (browser preview), forward to parent layout instead of alerting
  if (window.parent && window.parent !== window) {
    window.vscode = {
      postMessage: function(msg) {
        try { window.parent.postMessage(msg, '*'); } catch(e) { console.error('[SB Sidebar] parent postMessage failed:', e); }
      },
      getState: function() { return {}; },
      setState: function() {}
    };
  } else {
    window.vscode = {
      postMessage: function(msg) {
        var feat = (msg && msg.command) || 'This feature';
        alert(feat + ' is only available inside VS Code.');
      },
      getState: function() { return {}; },
      setState: function() {}
    };
  }
} else {
  window.vscode = vscodeApi;
}
var _isRealVsCode = !!vscodeApi;

// Request current server URL from extension
if (window.vscode) {
  try { window.vscode.postMessage({command:'getServerUrl'}); } catch (e) { console.error('[SB Sidebar] getServerUrl postMessage failed:', e); }
}
// When loaded in browser context, read injected initial data immediately
if (window.__SB_INITIAL_DATA__) {
  try { if(window.showResults) window.showResults(window.__SB_INITIAL_DATA__); } catch(e){ console.error('[SB Sidebar] showResults error:', e); }
}
if (window.__SB_INITIAL_STATUS__) {
  try { if(window.setStatus) window.setStatus(window.__SB_INITIAL_STATUS__.status, window.__SB_INITIAL_STATUS__.text); } catch(e){ console.error('[SB Sidebar] setStatus error:', e); }
}
if (window.__SB_API_URL__) {
  try { var el=document.getElementById('serverUrlText'); if(el) el.textContent=window.__SB_API_URL__; } catch(e){ console.error('[SB Sidebar] set serverUrl error:', e); }
}

  function logClick(btnId, cmd) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ['http://','127.0.0.1',':55444'].join('')+'/api/command', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({command:'click',source:'sidebar-debug',btnId:btnId,cmd:cmd,timestamp:Date.now()}));
    } catch(e) { /* ignore relay logging errors */ }
  }
  function routeCommand(cmd, payload) {
    var msg = payload || {command: cmd};
    // Standalone IDE: use vscode API directly (prioritize over parent)
    if (window.vscode) {
      try { window.vscode.postMessage(msg); } catch(e) { console.error('[SB Sidebar] postMessage failed for', cmd, ':', e); }
      return;
    }
    // Browser preview: post to parent layout
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage(msg, '*'); } catch(e) { console.error('[SB Sidebar] parent postMessage failed for', cmd, ':', e); }
      return;
    }
    // Browser fallback: redirect to dashboard pages
    var apiUrl = window.__SB_API_URL__ || ['http://','127.0.0.1',':3000'].join('');
    var base = apiUrl.replace(/\/$/, '');
    var urlMap = {
      dashboard: base + '/simplebeacon-dashboard/#/dashboard',
      report: base + '/simplebeacon-dashboard/#/results',
      settings: base + '/simplebeacon-dashboard/#/settings',
      certificate: base + '/certificate-upload.html',
      codeMap: base + '/simplebeacon-dashboard/#/codeMap',
      roadmap: base + '/simplebeacon-dashboard/#/remediation',
      preview: base + '/simplebeacon-dashboard/#/dashboard',
      openSidebarDebug: base + '/simplebeacon-dashboard/#/dashboard',
      scan: base + '/simplebeacon-dashboard/#/dashboard',
      clear: base + '/simplebeacon-dashboard/#/dashboard',
      analyze: base + '/simplebeacon-dashboard/#/analyze',
      upload: base + '/simplebeacon-dashboard/#/upload',
      openUpload: base + '/simplebeacon-dashboard/#/upload'
    };
    var url = urlMap[cmd];
    if (url) window.open(url, '_blank');
  }
  function bindBtn(id, cmd, before) {
    var el = document.getElementById(id);
    if (!el) { console.warn('[SB Sidebar] Button not found:', id); return; }
    el.addEventListener('click', function() {
      logClick(id, cmd);
      try { if (before) before(); } catch(e) { console.error('[SB Sidebar] before callback error:', e); }
      routeCommand(cmd);
    });
  }

  // Sidebar version: notify VS Code to open the page
  function openPageAndNotify(pid, title, icon) {
    if (window.vscode) {
      try { window.vscode.postMessage({command: pid, page: pid}); } catch (e) { /* VS Code: API unavailable — ignore */ }
      return;
    }
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({command: pid, page: pid}, '*'); } catch (e) { /* Parent postMessage failed — ignore */ }
      return;
    }
    // Browser fallback: redirect to dashboard page
    var apiUrl = window.__SB_API_URL__ || ['http://','127.0.0.1',':3000'].join('');
    var base = apiUrl.replace(/\/$/, '');
    var urlMap = {
      dashboard: base + '/simplebeacon-dashboard/#/dashboard',
      report: base + '/simplebeacon-dashboard/#/results',
      settings: base + '/simplebeacon-dashboard/#/settings',
      certificate: base + '/certificate-upload.html',
      codeMap: base + '/simplebeacon-dashboard/#/codeMap',
      roadmap: base + '/simplebeacon-dashboard/#/remediation'
    };
    var url = urlMap[pid];
    if (url) window.open(url, '_blank');
  }
  // Helper to open a tab in the tab bar for sidebar buttons
  function openTab(pid, title, icon) {
    if (typeof openPageAndNotify === 'function') {
      openPageAndNotify(pid, title, icon);
    }
  }
  bindBtn('scanBtn', 'scan', function() { setStatus('scanning', 'Scanning workspace...'); });
  bindBtn('clearBtn', 'clear', function() { setStatus('ready', 'Ready to scan'); hideResults(); });
  document.getElementById('dashboardBtn').addEventListener('click', function() { openTab('dashboard', 'Dashboard', '\u1F4CA'); });
  document.getElementById('reportBtn').addEventListener('click', function() { openTab('report', 'Report', '\u1F4CB'); });
  document.getElementById('settingsBtn').addEventListener('click', function() { openTab('settings', 'Settings', '\u2699'); });
  document.getElementById('certBtn').addEventListener('click', function() { openTab('certificate', 'Certificate', '\u1F3C6'); });
  document.getElementById('codeMapBtn').addEventListener('click', function() { openTab('codeMap', 'Code Map', '\u1F5FA'); });
  document.getElementById('roadmapBtn').addEventListener('click', function() { openTab('roadmap', 'Roadmap', '\u1F6E4'); });
  bindBtn('previewBtn', 'preview');
  bindBtn('diagnoseBtn', 'diagnose');

  // Bind stat cards and metric rows to open as tabs in the tab bar
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.addEventListener('click', function() {
      var page = el.getAttribute('data-page');
      var title = el.getAttribute('data-title') || page;
      var icon = el.getAttribute('data-icon') || '\u1F4C4';
      if (page && typeof openPageAndNotify === 'function') {
        openPageAndNotify(page, title, icon);
      }
    });
  });

  var sendToAiBtn = document.getElementById('sendToAiBtn');
  if (sendToAiBtn) {
    sendToAiBtn.addEventListener('click', function() {
      var report = window.__currentSidebarReport || null;
      routeCommand('sendSidebarToAi', {command:'sendSidebarToAi', report});
    });
  }

  var serverBadge = document.getElementById('serverBadge');
  if (serverBadge) {
    serverBadge.addEventListener('click', function() { routeCommand('setServerUrl', {command:'setServerUrl'}); });
  }

  // Bind nav toggle button
  var navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', function() { toggleNavMode(); });
  }

  // Bind all buttons with data-command via event delegation
  document.querySelectorAll('[data-command]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      var cmd = this.getAttribute('data-command');
      if (!cmd) return;
      if (cmd === 'hidePage') {
        hidePage();
        return;
      }
      if (cmd === 'clearExplorer') {
        clearExplorer();
        return;
      }
      // Strip 'nav' prefix so navDashboard -> dashboard, navAnalyze -> analyze, etc.
      if (cmd.indexOf('nav') === 0) {
        var navCmd = cmd.slice(3);
        // Preserve camelCase for multi-word commands
        var navMap = {
          'Dashboard':'dashboard','Analyze':'analyze','Results':'report','RepoHealth':'analyze',
          'Audit':'report','Security':'report','Quality':'report','Trust':'report',
          'Assessments':'report','Platform':'report','Roadmap':'roadmap',
          'CodeMap':'codeMap','Settings':'settings','Certificate':'certificate',
          'AiContext':'aiContext','Profile':'settings'
        };
        cmd = navMap[navCmd] || navCmd.toLowerCase();
      }
      // Page-opening commands from collapsible sections should open as tabs in parent layout
      var pageCmdMap = {'codemap':'codeMap','roadmap':'roadmap','analytics':'analytics','team':'team'};
      if (pageCmdMap[cmd] && window.parent !== window) {
        try { window.parent.postMessage({command: cmd}, '*'); } catch(e) { /* Ignore cross-origin postMessage failures — parent may be a different origin */ }
        return;
      }
      routeCommand(cmd);
    });
  });

function setStatus(state, text) {
  var badge = document.getElementById('statusBadge');
  var icon = document.getElementById('statusIcon');
  var statusText = document.getElementById('statusText');
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
    var emptyState = document.getElementById('emptyState');
    var resultsSection = document.getElementById('resultsSection');
    if (emptyState) emptyState.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    var totalFiles = document.getElementById('totalFiles');
    if (totalFiles) totalFiles.textContent = report.totalFiles || 0;
    var files = document.getElementById('files');
    if (files) files.textContent = report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0;

    var sev = report.severityCounts || {};
    var statCritical = document.getElementById('statCritical');
    if (statCritical) statCritical.textContent = sev.critical || 0;
    var statHigh = document.getElementById('statHigh');
    if (statHigh) statHigh.textContent = sev.high || 0;
    var statMedium = document.getElementById('statMedium');
    if (statMedium) statMedium.textContent = sev.medium || 0;
    var statLow = document.getElementById('statLow');
    if (statLow) statLow.textContent = sev.low || 0;
    var statIssues = document.getElementById('statIssues');
    if (statIssues) statIssues.textContent = report.issueCount || 0;
    var statScore = document.getElementById('statScore');
    if (statScore) statScore.textContent = report.qualityScore !== null && report.qualityScore !== undefined ? report.qualityScore : '?';

    var gateEl = document.getElementById('gate');
    if (gateEl) {
      var gatePass = report.gate && report.gate.pass;
      gateEl.textContent = gatePass ? 'PASS' : 'FAIL';
      gateEl.className = 'metric-value ' + (gatePass ? 'pass' : 'fail');
    }

    // Populate detail pages
    populatePages(report);

    setStatus('completed', 'Analysis complete — Dashboard ready');
  } catch (err) {
    var statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Error: ' + ((err && err.message) || String(err));
  }
}

function populatePages(report) {
  // Extract findings from report categories
  var allFindings = [];
  if (report.categories && typeof report.categories === 'object') {
    var _cats = Object.keys(report.categories);
    for (var _ci = 0; _ci < _cats.length; _ci++) {
      var cat = _cats[_ci];
      var items = report.categories[cat];
      if (Array.isArray(items)) {
        for (var _ii = 0; _ii < items.length; _ii++) {
          var item = items[_ii];
          allFindings.push({
            cat: cat,
            desc: item.description || item.message || item.type || 'Issue',
            sev: (item.severity || 'low').toLowerCase(),
            file: item.file || item.path || '',
            line: item.line || 1
          });
        }
      }
    }
  }
  if (Array.isArray(report.findings)) {
    for (var _fi = 0; _fi < report.findings.length; _fi++) {
      var f = report.findings[_fi];
      allFindings.push({
        cat: f.category || 'Finding',
        desc: f.description || f.message || f.type || 'Issue',
        sev: (f.severity || 'low').toLowerCase(),
        file: f.file || f.path || '',
        line: f.line || 1
      });
    }
  }
  if (Array.isArray(report.rawIssues)) {
    for (var _ri = 0; _ri < report.rawIssues.length; _ri++) {
      var f = report.rawIssues[_ri];
      allFindings.push({
        cat: f.category || 'Issue',
        desc: f.description || f.message || f.type || 'Issue',
        sev: (f.severity || 'low').toLowerCase(),
        file: f.file || f.path || '',
        line: f.line || 1
      });
    }
  }

  window.__sidebarFindings = allFindings;

  // Populate severity pages
  var severities = ['critical', 'high', 'medium', 'low'];
  for (var _si = 0; _si < severities.length; _si++) {
    var s = severities[_si];
    var container = document.getElementById('list-' + s);
    if (!container) continue;
    var items = allFindings.filter(function(f) { return f.sev === s; });
    container.textContent = '';
    if (items.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'page-empty';
      emptyDiv.textContent = 'No ' + s + ' findings';
      container.appendChild(emptyDiv);
      continue;
    }
    for (var _fi2 = 0; _fi2 < items.length; _fi2++) {
      var f = items[_fi2];
      var itemDiv = document.createElement('div');
      itemDiv.className = 'page-item';
      itemDiv.setAttribute('data-file', f.file || '');
      itemDiv.setAttribute('data-line', String(f.line || 1));
      itemDiv.addEventListener('click', function() {
        try { window.vscode.postMessage({command:'openFile', file: this.getAttribute('data-file'), line: parseInt(this.getAttribute('data-line'), 10)}); } catch (e) { console.error(e); }
      });
      var fileDiv = document.createElement('div');
      fileDiv.className = 'item-file';
      fileDiv.textContent = f.file ? f.file.split(/[\\/]/).pop() + ':' + f.line : '';
      itemDiv.appendChild(fileDiv);
      var descDiv = document.createElement('div');
      descDiv.className = 'item-desc';
      descDiv.textContent = f.desc || '';
      itemDiv.appendChild(descDiv);
      container.appendChild(itemDiv);
    }
  }

  // Populate issues page
  var listIssues = document.getElementById('list-issues');
  if (listIssues) {
    listIssues.textContent = '';
    if (allFindings.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'page-empty';
      emptyDiv.textContent = 'No issues found';
      listIssues.appendChild(emptyDiv);
    } else {
      for (var _ai = 0; _ai < allFindings.length; _ai++) {
        var f = allFindings[_ai];
        var itemDiv = document.createElement('div');
        itemDiv.className = 'page-item';
        itemDiv.setAttribute('data-file', f.file || '');
        itemDiv.setAttribute('data-line', String(f.line || 1));
        itemDiv.addEventListener('click', function() {
          try { window.vscode.postMessage({command:'openFile', file: this.getAttribute('data-file'), line: parseInt(this.getAttribute('data-line'), 10)}); } catch (e) { console.error(e); }
        });
        var fileDiv = document.createElement('div');
        fileDiv.className = 'item-file';
        var fileText = f.file ? f.file.split(/[\\/]/).pop() + ':' + f.line : '';
        fileDiv.textContent = fileText + ' ';
        var sevSpan = document.createElement('span');
        sevSpan.style.textTransform = 'uppercase';
        sevSpan.style.fontSize = '10px';
        sevSpan.style.color = '#999';
        sevSpan.textContent = f.sev;
        fileDiv.appendChild(sevSpan);
        itemDiv.appendChild(fileDiv);
        var descDiv = document.createElement('div');
        descDiv.className = 'item-desc';
        descDiv.textContent = f.desc || '';
        itemDiv.appendChild(descDiv);
        listIssues.appendChild(itemDiv);
      }
    }
  }

  // Populate score page
  var listScore = document.getElementById('list-score');
  if (listScore) {
    listScore.textContent = '';
    var score = report.qualityScore != null ? report.qualityScore : '?';
    var gate = report.gate && report.gate.pass ? 'PASS' : 'FAIL';
    var scoreItem = document.createElement('div'); scoreItem.className = 'page-item'; scoreItem.textContent = 'Quality Score: ' + score + '/100'; listScore.appendChild(scoreItem);
    var gateItem = document.createElement('div'); gateItem.className = 'page-item'; gateItem.textContent = 'Gate Status: ' + gate; listScore.appendChild(gateItem);
    var findingsItem = document.createElement('div'); findingsItem.className = 'page-item'; findingsItem.textContent = 'Total Findings: ' + (report.issueCount || 0); listScore.appendChild(findingsItem);
    var filesItem = document.createElement('div'); filesItem.className = 'page-item'; filesItem.textContent = 'Files Analyzed: ' + (report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0); listScore.appendChild(filesItem);
  }

  // Populate files page
  var listFiles = document.getElementById('list-files');
  if (listFiles) {
    listFiles.textContent = '';
    function addStatItem(container, label, value) {
      var div = document.createElement('div');
      div.className = 'page-item';
      div.textContent = label + ' ';
      var strong = document.createElement('strong');
      strong.textContent = value;
      div.appendChild(strong);
      container.appendChild(div);
    }
    addStatItem(listFiles, 'Total Repository Files:', report.totalFiles || 0);
    addStatItem(listFiles, 'Files Checked:', report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0);
    addStatItem(listFiles, 'Folders:', report.repositoryFoldersTotal || 0);
  }

  // Populate gate page
  var listGate = document.getElementById('list-gate');
  if (listGate) {
    listGate.textContent = '';
    var gatePass = report.gate && report.gate.pass;
    function addGateItem(container, label, value) {
      var div = document.createElement('div');
      div.className = 'page-item';
      div.textContent = label + ' ';
      var strong = document.createElement('strong');
      strong.textContent = value;
      div.appendChild(strong);
      container.appendChild(div);
    }
    addGateItem(listGate, 'Gate:', gatePass ? 'PASS' : 'FAIL');
    addGateItem(listGate, 'Quality Score:', (report.qualityScore != null ? report.qualityScore : '?') + '/100');
    addGateItem(listGate, 'Blocking Issues:', (report.gate && report.gate.blockingCount) || 0);
    addGateItem(listGate, 'Warning Issues:', (report.gate && report.gate.warningCount) || 0);
  }
}

var currentPage = null;
function showPage(page) {
  currentPage = page;
  var normalContent = document.getElementById('normalContent');
  var pageEl = document.getElementById('page-' + page);
  if (normalContent) normalContent.style.display = 'none';
  if (pageEl) pageEl.classList.add('active');
}

function hidePage() {
  if (currentPage) {
    var pageEl = document.getElementById('page-' + currentPage);
    if (pageEl) pageEl.classList.remove('active');
  }
  currentPage = null;
  var normalContent = document.getElementById('normalContent');
  if (normalContent) normalContent.style.display = 'block';
}

function hideResults() {
  var emptyState = document.getElementById('emptyState');
  var resultsSection = document.getElementById('resultsSection');
  if (emptyState) emptyState.style.display = 'block';
  if (resultsSection) resultsSection.style.display = 'none';
}

function toggleCollapsible(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}

// Bind collapsible headers via addEventListener (avoids CSP inline-handler issues in VS Code webviews)
document.querySelectorAll('.collapsible-header').forEach(function(header) {
    header.addEventListener('click', function(e) {
        // Don't toggle if a button inside the header was clicked (those have their own actions)
        if (e.target.closest('button')) return;
        var id = this.parentElement.id;
        if (id) toggleCollapsible(id);
    });
});

var navMode = false;
function toggleNavMode() {
  navMode = !navMode;
  var normalContent = document.getElementById('normalContent');
  var navMenu = document.getElementById('navMenu');
  var toggleText = document.getElementById('navToggleText');
  var toggleIcon = document.getElementById('navToggleIcon');
  if (normalContent) normalContent.style.display = navMode ? 'none' : 'block';
  if (navMenu) navMenu.style.display = navMode ? 'block' : 'none';
  if (toggleText) toggleText.textContent = navMode ? 'Show Normal Menu' : 'Show Nav Menu';
  if (toggleIcon) toggleIcon.textContent = navMode ? '🔙' : '🧭';
  // navMode toggled
}

window.addEventListener('message',function(e) {
  try {
    var msg = e.data;
    if (msg.command === 'updateReport') {
      if (msg.report) {
        showResults(msg.report);
      } else {
        hideResults();
      }
    }
    if (msg.command === 'showDashboard') {
      var report = window.__currentSidebarReport;
      if (report) {
        showResults(report);
      } else {
        setStatus('ready', 'No scan results yet — run a scan to see the dashboard');
      }
    }
    if (msg.command === 'updateStatus') {
      setStatus(msg.status, msg.text);
    }
    if (msg.command === 'updateServerUrl') {
      var el = document.getElementById('serverUrlText');
      if (el) el.textContent = msg.url || 'Default';
    }
    if (msg.command === 'diagnoseResult' && msg.lines) {
      var statusText = document.getElementById('statusText');
      if (statusText) statusText.textContent = 'Diagnose complete — see output';
      // Diagnose output shown inline below, no console needed
      // Show a simple inline report by creating a temporary page
      var container = document.getElementById('list-issues');
      if (container) {
        container.textContent = '';
        msg.lines.forEach(function(line) {
          var div = document.createElement('div');
          div.className = 'page-item';
          div.style.fontFamily = 'monospace';
          div.style.fontSize = '11px';
          div.textContent = line;
          container.appendChild(div);
        });
        showPage('issues');
      }
    }
    if (msg.command === 'addDownloadedFile') {
      addDownloadedFile(msg.name, msg.path, msg.time);
    }
    if (msg.command === 'clearDownloadedFiles') {
      clearExplorer();
    }
    if (msg.command === 'navigateToPage' && msg.page) {
      if (typeof openPageAndNotify === 'function') {
        openPageAndNotify(msg.page, msg.page, '');
      }
    }
    if (msg.command === 'relayCommand' && msg.relayCommand) {
      // Browser initiated command via relay — reflect in sidebar UI
      var badge = document.getElementById('statusBadge');
      var statusText = document.getElementById('statusText');
      if (badge) { badge.className = 'status-badge completed'; }
      if (statusText) { statusText.textContent = 'Browser: ' + msg.relayCommand; }
    }
  } catch (err) {
    console.error('Sidebar message error:', err);
  }
});

var downloadedFiles = [];
function addDownloadedFile(name, path, time) {
  downloadedFiles.unshift({ name, path, time: time || new Date().toLocaleTimeString() });
  renderExplorer();
}
function clearExplorer() {
  downloadedFiles = [];
  renderExplorer();
}
function renderExplorer() {
  var section = document.getElementById('explorerSection');
  var divider = document.getElementById('explorerDivider');
  var tree = document.getElementById('explorerTree');
  if (!section || !tree) return;
  if (downloadedFiles.length === 0) {
    section.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  if (divider) divider.style.display = 'block';
  while (tree.firstChild) { tree.removeChild(tree.firstChild); }
  downloadedFiles.forEach(function(f) {
    var item = document.createElement('div');
    item.className = 'explorer-item';
    item.title = f.path;
    item.addEventListener('click', function() {
      try {
        window.vscode.postMessage({ command: 'openFile', file: f.path, line: 1 });
      } catch (e) {
        console.error(e);
      }
    });
    var icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📄';
    var name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = f.name || 'file';
    var time = document.createElement('span');
    time.className = 'file-time';
    time.textContent = f.time;
    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(time);
    tree.appendChild(item);
  });
}

// Handle hash routes for SPA-style navigation inside standalone panel
window.addEventListener('hashchange', function() {
  var hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  var map = {'/':'dashboard','/dashboard':'dashboard','/analyze':'analyze','/report':'report','/settings':'settings','/certificate':'certificate','/codemap':'codeMap','/codeMap':'codeMap','/roadmap':'roadmap','/aiContext':'aiContext','/preview':'preview','/upload':'upload'};
  var pid = map[hash];
  if (pid && typeof openPageAndNotify === 'function') {
    openPageAndNotify(pid, pid, '');
  }
});
if (location.hash) { window.dispatchEvent(new Event('hashchange')); }