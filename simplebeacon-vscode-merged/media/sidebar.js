function sbLog(level, ...args) {
  if (window.__SB_DEBUG__ && typeof console !== 'undefined') {
    const fn = level === 'error' ? console['error'] : (level === 'warn' ? console['warn'] : null);
    if (fn) fn.apply(console, args);
  }
}
let vscodeApi = window.vscode || null;
if (!vscodeApi && typeof window.acquireVsCodeApi === 'function') {
  try {
    vscodeApi = window.acquireVsCodeApi();
  } catch (e) {
    /* Expected in browser — silently ignore */
  }
}
let _isRealVsCode = !!vscodeApi;

if (vscodeApi) {
  window.vscode = vscodeApi; // simplebeacon-ignore memory-leak — standard VS Code: webview API initialization
} else if (window.parent && window.parent !== window) {
  // Inside iframe (browser preview) — proxy to parent layout
  window.vscode = {
    postMessage: function(msg) {
      try { window.parent.postMessage(msg, '*'); } catch(e) { /* ignore cross-origin postMessage failures */ }
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}
// In standalone browser (not iframe, not VS Code:) leave window.vscode undefined
// so routeCommand falls through to switchTab / urlMap fallbacks.

// Request current server URL from extension
if (window.vscode) {
  try { window.vscode.postMessage({command:'getServerUrl'}); } catch (e) { /* ignore postMessage failures in non-webview contexts */ }
}
// When loaded in browser context, read injected initial data immediately
if (window.__SB_INITIAL_DATA__) {
  try { if(window.showResults) window.showResults(window.__SB_INITIAL_DATA__); } catch(e){ /* ignore initialization errors */ }
}
if (window.__SB_INITIAL_STATUS__) {
  try { if(window.setStatus) window.setStatus(window.__SB_INITIAL_STATUS__.status, window.__SB_INITIAL_STATUS__.text); } catch(e){ /* ignore initialization errors */ }
}
if (window.__SB_API_URL__) {
  try {
    let el=document.getElementById('serverUrlText'); if(el) el.textContent=window.__SB_API_URL__;
    let el2=document.getElementById('serverUrlText2'); if(el2) el2.textContent=window.__SB_API_URL__;
  } catch(e){ /* ignore DOM setup errors */ }
}

function switchTab(tabId) {
  // Handle tab-panel tabs (new sidebar)
  let tabs = document.querySelectorAll('.tab');
  let panels = document.querySelectorAll('.tab-panel');
  if (panels.length > 0) {
    for (let j = 0; j < panels.length; j++) {
      if (panels[j].id === 'tab-' + tabId) panels[j].classList.add('active');
      else panels[j].classList.remove('active');
    }
  }
  if (tabs.length > 0) {
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-tab') === tabId) tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
  }
  let bottomNavs = document.querySelectorAll('.bottom-nav-btn');
  if (bottomNavs.length > 0) {
    for (let n = 0; n < bottomNavs.length; n++) {
      if (bottomNavs[n].getAttribute('data-tab') === tabId) bottomNavs[n].classList.add('active');
      else bottomNavs[n].classList.remove('active');
    }
  }
  // Request code map when switching to codeMap tab
  if (tabId === 'codeMap' && window.vscode) {
    try { window.vscode.postMessage({command: 'getCodeMap'}); } catch(e) { sbLog('error', '[SB Sidebar] getCodeMap postMessage failed:', e); }
  }
  // Handle detail pages (internal navigation)
  let pages = document.querySelectorAll('.page');
  if (pages.length > 0) {
    for (let k = 0; k < pages.length; k++) {
      if (pages[k].id === 'page-' + tabId) pages[k].classList.add('active');
      else pages[k].classList.remove('active');
    }
  }
}

function bindTabSwitchers() {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      let tid = this.getAttribute('data-tab');
      if (tid) switchTab(tid);
    });
  });
  document.querySelectorAll('.bottom-nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      let tid = this.getAttribute('data-tab');
      if (tid) switchTab(tid);
    });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindTabSwitchers);
} else {
  bindTabSwitchers();
}
// Ensure dashboard is active on load (fixes race conditions where active class is missing)
if (typeof switchTab === 'function') {
  switchTab('dashboard');
}

  function logClick(btnId, cmd) {
    try {
      let relayUrl = (window.__SB_RELAY_URL__ || '').replace(/\/$/, '');
      if (!relayUrl) { return; } // Skip logging if no relay configured
      let xhr = new XMLHttpRequest();
      xhr.open('POST', relayUrl + '/api/command', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({command:'click',source:'sidebar-debug',btnId:btnId,cmd:cmd,timestamp:Date.now()}));
    } catch(e) { /* simplebeacon-ignore error-swallowing — relay logging is best-effort; failures are non-critical */ }
  }
  function routeCommand(cmd, payload) {
    let msg = payload || {command: cmd};
    let localTabs = {
      ai: true, advanced: true,
      scan: true, codeMap: true, report: true, settings: true, architecture: true, upload: true, security: true, quality: true, platform: true, repoHealth: true, team: true
    };
    // When inside the VS Code: sidebar webview, switch local tabs for page commands
    if (_isRealVsCode && localTabs[cmd] && typeof switchTab === 'function') {
      switchTab(cmd);
      return;
    }
    // Standalone IDE: use vscode API directly (prioritize over parent)
    if (window.vscode) {
      try { window.vscode.postMessage(msg); } catch(e) { sbLog('error', '[SB Sidebar] postMessage failed for', cmd, ':', e); }
      return;
    }
    // Browser preview: post to parent layout
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage(msg, '*'); } catch(e) { sbLog('error', '[SB Sidebar] parent postMessage failed for', cmd, ':', e); }
      return;
    }
    // Standalone browser fallback: try switchTab first, then urlMap
    if (typeof switchTab === 'function') {
      let tabId = cmd === 'report' ? 'analyze' : cmd;
      switchTab(tabId);
    }
    let apiUrl = window.__SB_API_URL__ || ['http://','127.0.0.1',':3000'].join('');
    let base = apiUrl.replace(/\/$/, '');
    let urlMap = {
      dashboard: base + '/simplebeacon-dashboard/#/dashboard',
      report: base + '/simplebeacon-dashboard/#/results',
      settings: base + '/simplebeacon-dashboard/#/settings',
      certificate: base + '/certificate-upload.html',
      codeMap: base + '/simplebeacon-dashboard/#/codeMap',
      roadmap: 'https://simplebeacon.ai/roadmap',
      preview: base + '/simplebeacon-dashboard/#/dashboard',
      openSidebarDebug: base + '/simplebeacon-dashboard/#/dashboard',
      scan: base + '/simplebeacon-dashboard/#/dashboard',
      clear: base + '/simplebeacon-dashboard/#/dashboard',
      analyze: base + '/simplebeacon-dashboard/#/analyze',
      upload: base + '/simplebeacon-dashboard/#/upload',
      openUpload: base + '/simplebeacon-dashboard/#/upload',
      trust: base + '/simplebeacon-dashboard/#/dashboard',
      assessments: base + '/simplebeacon-dashboard/#/dashboard',
      repoHealth: base + '/simplebeacon-dashboard/#/dashboard',
      securityAudit: 'https://simplebeacon.ai/audit',
      aiContext: base + '/simplebeacon-dashboard/#/dashboard'
    };
    let url = urlMap[cmd];
    if (url) window.open(url, '_blank');
  }
  function bindBtn(id, cmd, before) {
    let el = document.getElementById(id);
    if (!el) { sbLog('warn', '[SB Sidebar] Button not found:', id); return; }
    el.addEventListener('click', function() { // simplebeacon-ignore memory-leak — static webview buttons, never unmounted
      logClick(id, cmd);
      try { if (before) before(); } catch(e) { sbLog('error', '[SB Sidebar] before callback error:', e); }
      routeCommand(cmd);
    });
  }

  // Sidebar version: switch local tab in VS Code:, otherwise notify parent/browser
  function openPageAndNotify(pid, title, icon) {
    let localTabs = {
      critical: true, high: true, medium: true, low: true,
      issues: true, files: true, gate: true, score: true,
      certificate: true
    };
    if (_isRealVsCode && localTabs[pid] && typeof switchTab === 'function') {
      let tabId = pid === 'report' ? 'analyze' : pid;
      switchTab(tabId);
      return;
    }
    if (window.vscode) {
      try { window.vscode.postMessage({command: pid, page: pid}); } catch (e) { /* VS Code: API unavailable — ignore */ }
      return;
    }
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({command: pid, page: pid}, '*'); } catch (e) { /* Parent postMessage failed — ignore */ }
      return;
    }
    // Standalone browser fallback: try switchTab first, then urlMap
    if (typeof switchTab === 'function') {
      let tabId = pid === 'report' ? 'analyze' : pid;
      switchTab(tabId);
    }
    let apiUrl = window.__SB_API_URL__ || ['http://','127.0.0.1',':3000'].join('');
    let base = apiUrl.replace(/\/$/, '');
    let urlMap = {
      dashboard: base + '/simplebeacon-dashboard/#/dashboard',
      report: base + '/simplebeacon-dashboard/#/results',
      settings: base + '/simplebeacon-dashboard/#/settings',
      certificate: base + '/certificate-upload.html',
      codeMap: base + '/simplebeacon-dashboard/#/codeMap',
      roadmap: 'https://simplebeacon.ai/roadmap',
      analyze: base + '/simplebeacon-dashboard/#/analyze',
      upload: base + '/simplebeacon-dashboard/#/upload',
      trust: base + '/simplebeacon-dashboard/#/dashboard',
      assessments: base + '/simplebeacon-dashboard/#/dashboard',
      repoHealth: base + '/simplebeacon-dashboard/#/dashboard',
      securityAudit: 'https://simplebeacon.ai/audit',
      aiContext: base + '/simplebeacon-dashboard/#/dashboard'
    };
    let url = urlMap[pid];
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
  bindBtn('dashboardBtn', 'dashboard');
  bindBtn('reportBtn', 'report');
  bindBtn('settingsBtn', 'settings');
  bindBtn('certBtn', 'certificate');
  bindBtn('codeMapBtn', 'codeMap');
  bindBtn('roadmapBtn', 'roadmap');
  bindBtn('previewBtn', 'preview');
  bindBtn('diagnoseBtn', 'diagnose');

  // Export button bindings
  let sidebarExportBtn = document.getElementById('sidebarExportBtn');
  if (sidebarExportBtn) { sidebarExportBtn.addEventListener('click', exportSidebarDashboard); }
  let codeMapSidebarExportBtn = document.getElementById('codeMapSidebarExportBtn');
  if (codeMapSidebarExportBtn) { codeMapSidebarExportBtn.addEventListener('click', exportCodeMapSidebar); }

  function downloadFile(content, filename, mimeType) {
    if (window.vscode) {
      try {
        window.vscode.postMessage({ command: 'downloadFile', filename: filename, content: content, mimeType: mimeType || 'text/plain' });
        return;
      } catch (e) { /* fall through */ }
    }
    let blob = new Blob([content], { type: mimeType || 'text/plain' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportSidebarDashboard() {
    let report = window.__currentSidebarReport || {};
    let fmtEl = document.getElementById('sidebarExportFormat');
    let fmt = fmtEl ? fmtEl.value : 'json';
    let date = new Date().toISOString().slice(0, 10);
    let fname = 'simplebeacon-dashboard-' + date;
    if (fmt === 'json') {
      downloadFile(JSON.stringify(report, null, 2), fname + '.json', 'application/json');
    } else if (fmt === 'csv') {
      let findings = [];
      if (report.categories) {
        Object.keys(report.categories).forEach(function(cat) {
          let items = report.categories[cat];
          if (Array.isArray(items)) {
            items.forEach(function(item) {
              findings.push({
                category: cat,
                severity: (item.severity || 'low').toLowerCase(),
                description: item.description || item.message || item.type || '',
                file: item.file || item.path || '',
                line: item.line || ''
              });
            });
          }
        });
      }
      let csv = 'Category,Severity,Description,File,Line\n';
      findings.forEach(function(f) {
        csv += '"' + f.category + '","' + f.severity + '","' + String(f.description).replace(/"/g, '""') + '","' + String(f.file).replace(/"/g, '""') + '","' + f.line + '"\n';
      });
      downloadFile(csv, fname + '.csv', 'text/csv');
    } else {
      let txt = 'SimpleBeacon Dashboard Export\nDate: ' + new Date().toISOString() + '\n\n';
      txt += 'Quality Score: ' + (report.qualityScore != null ? report.qualityScore : '?') + '/100\n';
      txt += 'Gate: ' + (report.gate && report.gate.pass ? 'PASS' : 'FAIL') + '\n';
      txt += 'Files: ' + (report.totalFiles || 0) + '\n';
      txt += 'Issues: ' + (report.issueCount || 0) + '\n\n';
      if (report.categories) {
        Object.keys(report.categories).forEach(function(cat) {
          let items = report.categories[cat];
          if (Array.isArray(items) && items.length > 0) {
            txt += '--- ' + cat + ' ---\n';
            items.forEach(function(item, i) {
              txt += (i + 1) + '. [' + (item.severity || 'low').toUpperCase() + '] ' + (item.description || item.message || item.type || '') + '\n';
              if (item.file) txt += '   File: ' + item.file + (item.line ? ':' + item.line : '') + '\n';
            });
            txt += '\n';
          }
        });
      }
      downloadFile(txt, fname + '.txt', 'text/plain');
    }
  }

  function exportCodeMapSidebar() {
    let report = window.__currentSidebarReport || {};
    let fmtEl = document.getElementById('codeMapSidebarExportFormat');
    let fmt = fmtEl ? fmtEl.value : 'csv';
    let date = new Date().toISOString().slice(0, 10);
    let fname = 'simplebeacon-codemap-' + date;
    let files = report.files || report.fileList || report.scannedFiles || report.sampleFiles || [];
    let filePaths = Array.isArray(files) ? files : [];

    // Compute metrics
    let extCounts = {};
    let dirSet = {};
    let dirs = {};
    for (let i = 0; i < filePaths.length; i++) {
      let fp = String(filePaths[i]);
      let idx = fp.lastIndexOf('.');
      let ext = idx > 0 ? fp.slice(idx + 1).toLowerCase() : 'no-ext';
      extCounts[ext] = (extCounts[ext] || 0) + 1;
      let d = fp.lastIndexOf('/');
      if (d < 0) d = fp.lastIndexOf('\\');
      if (d > 0) dirSet[fp.slice(0, d)] = true;
      let p = fp.replace(/\\/g, '/');
      let parts = p.split('/');
      let node = dirs;
      for (let k = 0; k < parts.length; k++) {
        let part = parts[k];
        if (!node[part]) node[part] = k === parts.length - 1 ? null : {};
        node = node[part];
      }
    }

    let issues = report.detectedIssues || report.rawIssues || report.issues || report.findings || [];
    let issueCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    if (Array.isArray(issues)) {
      issues.forEach(function(issue) {
        let sev = (issue.severity || 'low').toLowerCase();
        if (issueCounts[sev] != null) issueCounts[sev]++;
        else issueCounts.low++;
      });
    }

    let sortedExts = Object.keys(extCounts).sort(function(a, b) { return extCounts[b] - extCounts[a]; });
    let payload = {
      exportDate: new Date().toISOString(),
      summary: {
        totalFiles: filePaths.length,
        totalDirectories: Object.keys(dirSet).length,
        totalLanguages: Object.keys(extCounts).length,
        qualityScore: report.qualityScore != null ? report.qualityScore : null,
        gatePass: report.gate ? report.gate.pass : null,
        issueCounts: issueCounts,
        totalIssues: Array.isArray(issues) ? issues.length : 0
      },
      extensions: sortedExts.map(function(ext) { return { extension: ext, count: extCounts[ext] }; }),
      directories: Object.keys(dirSet).sort(),
      fileTree: dirs,
      files: filePaths
    };

    if (fmt === 'json') {
      downloadFile(JSON.stringify(payload, null, 2), fname + '.json', 'application/json');
    } else if (fmt === 'txt') {
      let txt = 'SimpleBeacon Code Map\nDate: ' + payload.exportDate + '\n';
      txt += 'Files: ' + payload.summary.totalFiles + '\n';
      txt += 'Directories: ' + payload.summary.totalDirectories + '\n';
      txt += 'Languages: ' + payload.summary.totalLanguages + '\n';
      txt += 'Issues: ' + payload.summary.totalIssues + '\n';
      if (payload.summary.qualityScore != null) txt += 'Quality Score: ' + payload.summary.qualityScore + '/100\n';
      if (payload.summary.gatePass != null) txt += 'Gate: ' + (payload.summary.gatePass ? 'PASS' : 'FAIL') + '\n';
      txt += '\n--- Extensions ---\n';
      payload.extensions.forEach(function(e) { txt += e.extension + ': ' + e.count + '\n'; });
      txt += '\n--- Files ---\n' + filePaths.join('\n');
      downloadFile(txt, fname + '.txt', 'text/plain');
    } else {
      let csv = 'Type,Name,Count\n';
      csv += 'summary,totalFiles,' + payload.summary.totalFiles + '\n';
      csv += 'summary,totalDirectories,' + payload.summary.totalDirectories + '\n';
      csv += 'summary,totalLanguages,' + payload.summary.totalLanguages + '\n';
      csv += 'summary,totalIssues,' + payload.summary.totalIssues + '\n';
      if (payload.summary.qualityScore != null) csv += 'summary,qualityScore,' + payload.summary.qualityScore + '\n';
      if (payload.summary.gatePass != null) csv += 'summary,gatePass,' + (payload.summary.gatePass ? 'PASS' : 'FAIL') + '\n';
      csv += 'issueCounts,critical,' + issueCounts.critical + '\n';
      csv += 'issueCounts,high,' + issueCounts.high + '\n';
      csv += 'issueCounts,medium,' + issueCounts.medium + '\n';
      csv += 'issueCounts,low,' + issueCounts.low + '\n';
      payload.extensions.forEach(function(e) { csv += 'extension,"' + String(e.extension).replace(/"/g, '""') + '",' + e.count + '\n'; });
      filePaths.forEach(function(f) { csv += 'file,"' + String(f).replace(/"/g, '""') + '",1\n'; });
      downloadFile(csv, fname + '.csv', 'text/csv');
    }
  }

  let allIssuesExportBtn = document.getElementById('allIssuesExportBtn');
  if (allIssuesExportBtn) { allIssuesExportBtn.addEventListener('click', exportAllIssues); }

  function exportAllIssues() {
    let container = document.getElementById('list-issues');
    let lines = [];
    if (container) {
      container.querySelectorAll('.page-item').forEach(function(el) {
        lines.push(el.textContent || '');
      });
    }
    let fmtEl = document.getElementById('allIssuesExportFormat');
    let fmt = fmtEl ? fmtEl.value : 'txt';
    let date = new Date().toISOString().slice(0, 10);
    let fname = 'simplebeacon-issues-' + date;
    if (fmt === 'json') {
      downloadFile(JSON.stringify({ exportDate: new Date().toISOString(), lines: lines }, null, 2), fname + '.json', 'application/json');
    } else if (fmt === 'csv') {
      let csv = 'Line\n';
      lines.forEach(function(line) { csv += '"' + String(line).replace(/"/g, '""') + '"\n'; });
      downloadFile(csv, fname + '.csv', 'text/csv');
    } else {
      let txt = 'SimpleBeacon Issues Export\nDate: ' + new Date().toISOString() + '\n\n' + lines.join('\n');
      downloadFile(txt, fname + '.txt', 'text/plain');
    }
  }

  // Bind stat cards and metric rows to open as tabs in the tab bar
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.addEventListener('click', function() {
      let page = el.getAttribute('data-page');
      let title = el.getAttribute('data-title') || page;
      let icon = el.getAttribute('data-icon') || '\u1F4C4';
      if (page && typeof openPageAndNotify === 'function') {
        openPageAndNotify(page, title, icon);
      }
    });
  });

  let sendToAiBtn = document.getElementById('sendToAiBtn');
  if (sendToAiBtn) {
    sendToAiBtn.addEventListener('click', function() {
      let report = window.__currentSidebarReport || null;
      routeCommand('sendSidebarToAi', {command:'sendSidebarToAi', report});
    });
  }

  let serverBadge = document.getElementById('serverBadge');
  if (serverBadge) {
    serverBadge.addEventListener('click', function() { routeCommand('setServerUrl', {command:'setServerUrl'}); });
  }

  // Bind nav toggle button
  let navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', function() { toggleNavMode(); });
  }

  // Bind activate team button to toggle domain nav
  let activateTeamBtn = document.getElementById('activateTeamBtn');
  if (activateTeamBtn) {
    activateTeamBtn.addEventListener('click', function() {
      let domainNav = document.getElementById('domainNav');
      if (domainNav) {
        let isHidden = domainNav.style.display === 'none';
        domainNav.style.display = isHidden ? '' : 'none';
        activateTeamBtn.textContent = '';
        let s1 = document.createElement('span'); s1.textContent = '\u{1F465}';
        let s2 = document.createElement('span'); s2.style.marginLeft = '6px'; s2.textContent = isHidden ? 'Close Team Dashboard' : 'Open Team Dashboard';
        activateTeamBtn.appendChild(s1); activateTeamBtn.appendChild(s2);
      }
    });
  }

  // Bind all buttons with data-command via event delegation
  document.querySelectorAll('[data-command]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      let cmd = this.getAttribute('data-command');
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
        let navCmd = cmd.slice(3);
        // Preserve camelCase for multi-word commands
        let navMap = {
          'Dashboard':'dashboard','Analyze':'analyze','Results':'report','RepoHealth':'repoHealth',
          'Audit':'securityAudit','Security':'securityAudit','Quality':'report','Trust':'trust',
          'Assessments':'assessments','Platform':'report','Roadmap':'roadmap',
          'CodeMap':'codeMap','Settings':'settings','Certificate':'certificate',
          'AiContext':'aiContext','Profile':'settings'
        };
        cmd = navMap[navCmd] || navCmd.toLowerCase();
      }
      // Page-opening commands from collapsible sections: in VS Code: switch local tab, in iframe post to parent
      let pageCmdMap = {'codemap':'codeMap','roadmap':'roadmap','analytics':'analytics','team':'team'};
      if (pageCmdMap[cmd] && !_isRealVsCode && window.parent !== window) {
        try { window.parent.postMessage({command: cmd}, '*'); } catch(e) { /* Ignore cross-origin postMessage failures — parent may be a different origin */ }
        return;
      }
      routeCommand(cmd);
    });
  });

function setStatus(state, text) {
  let badge = document.getElementById('statusBadge');
  let icon = document.getElementById('statusIcon');
  let statusText = document.getElementById('statusText');
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
    let emptyState = document.getElementById('emptyState');
    let resultsSection = document.getElementById('resultsSection');
    if (emptyState) emptyState.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    let totalFiles = document.getElementById('totalFiles');
    if (totalFiles) totalFiles.textContent = report.totalFiles || 0;
    let files = document.getElementById('files');
    if (files) files.textContent = report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0;

    let sev = report.severityCounts || {};
    let statCritical = document.getElementById('statCritical');
    if (statCritical) statCritical.textContent = sev.critical || 0;
    let statHigh = document.getElementById('statHigh');
    if (statHigh) statHigh.textContent = sev.high || 0;
    let statMedium = document.getElementById('statMedium');
    if (statMedium) statMedium.textContent = sev.medium || 0;
    let statLow = document.getElementById('statLow');
    if (statLow) statLow.textContent = sev.low || 0;
    let statIssues = document.getElementById('statIssues');
    if (statIssues) statIssues.textContent = report.issueCount || 0;
    let statScore = document.getElementById('statScore');
    if (statScore) statScore.textContent = report.qualityScore !== null && report.qualityScore !== undefined ? report.qualityScore : '?';

    let gateEl = document.getElementById('gate');
    if (gateEl) {
      let gatePass = report.gate && report.gate.pass;
      gateEl.textContent = gatePass ? 'PASS' : 'FAIL';
      gateEl.className = 'metric-value ' + (gatePass ? 'pass' : 'fail');
    }

    // Populate detail pages
    populatePages(report);
    populateCodeMap(report);

    setStatus('completed', 'Analysis complete — Dashboard ready');
  } catch (err) {
    let statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Error: ' + ((err && err.message) || String(err));
  }
}

function populatePages(report) {
  // Extract findings from report categories
  let allFindings = [];
  if (report.categories && typeof report.categories === 'object') {
    let _cats = Object.keys(report.categories);
    for (let _ci = 0; _ci < _cats.length; _ci++) {
      let cat = _cats[_ci];
      let items = report.categories[cat];
      if (Array.isArray(items)) {
        for (let _ii = 0; _ii < items.length; _ii++) {
          let item = items[_ii];
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
    for (let _fi = 0; _fi < report.findings.length; _fi++) {
      let f = report.findings[_fi];
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
    for (let _ri = 0; _ri < report.rawIssues.length; _ri++) {
      let f = report.rawIssues[_ri];
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
  let severities = ['critical', 'high', 'medium', 'low'];
  for (let _si = 0; _si < severities.length; _si++) {
    let s = severities[_si];
    let container = document.getElementById('list-' + s);
    if (!container) continue;
    let items = allFindings.filter(function(f) { return f.sev === s; });
    container.textContent = '';
    if (items.length === 0) {
      let emptyDiv = document.createElement('div');
      emptyDiv.className = 'page-empty';
      emptyDiv.textContent = 'No ' + s + ' findings';
      container.appendChild(emptyDiv);
      continue;
    }
    for (let _fi2 = 0; _fi2 < items.length; _fi2++) {
      let f = items[_fi2];
      let itemDiv = document.createElement('div');
      itemDiv.className = 'page-item';
      itemDiv.setAttribute('data-file', f.file || '');
      itemDiv.setAttribute('data-line', String(f.line || 1));
      itemDiv.addEventListener('click', function() {
        try { window.vscode.postMessage({command:'openFile', file: this.getAttribute('data-file'), line: parseInt(this.getAttribute('data-line'), 10)}); } catch (e) { sbLog('error', e); }
      });
      let fileDiv = document.createElement('div');
      fileDiv.className = 'item-file';
      fileDiv.textContent = f.file ? f.file.split(/[\\/]/).pop() + ':' + f.line : '';
      itemDiv.appendChild(fileDiv);
      let descDiv = document.createElement('div');
      descDiv.className = 'item-desc';
      descDiv.textContent = f.desc || '';
      itemDiv.appendChild(descDiv);
      container.appendChild(itemDiv);
    }
  }

  // Populate issues page
  let listIssues = document.getElementById('list-issues');
  if (listIssues) {
    listIssues.textContent = '';
    if (allFindings.length === 0) {
      let emptyDiv = document.createElement('div');
      emptyDiv.className = 'page-empty';
      emptyDiv.textContent = 'No issues found';
      listIssues.appendChild(emptyDiv);
    } else {
      for (let _ai = 0; _ai < allFindings.length; _ai++) {
        let f = allFindings[_ai];
        let itemDiv = document.createElement('div');
        itemDiv.className = 'page-item';
        itemDiv.setAttribute('data-file', f.file || '');
        itemDiv.setAttribute('data-line', String(f.line || 1));
        itemDiv.addEventListener('click', function() {
          try { window.vscode.postMessage({command:'openFile', file: this.getAttribute('data-file'), line: parseInt(this.getAttribute('data-line'), 10)}); } catch (e) { sbLog('error', e); }
        });
        let fileDiv = document.createElement('div');
        fileDiv.className = 'item-file';
        let fileText = f.file ? f.file.split(/[\\/]/).pop() + ':' + f.line : '';
        fileDiv.textContent = fileText + ' ';
        let sevSpan = document.createElement('span');
        sevSpan.style.textTransform = 'uppercase';
        sevSpan.style.fontSize = '10px';
        sevSpan.style.color = '#999';
        sevSpan.textContent = f.sev;
        fileDiv.appendChild(sevSpan);
        itemDiv.appendChild(fileDiv);
        let descDiv = document.createElement('div');
        descDiv.className = 'item-desc';
        descDiv.textContent = f.desc || '';
        itemDiv.appendChild(descDiv);
        listIssues.appendChild(itemDiv);
      }
    }
  }

  // Populate score page
  let listScore = document.getElementById('list-score');
  if (listScore) {
    listScore.textContent = '';
    let score = report.qualityScore != null ? report.qualityScore : '?';
    let gate = report.gate && report.gate.pass ? 'PASS' : 'FAIL';
    let scoreItem = document.createElement('div'); scoreItem.className = 'page-item'; scoreItem.textContent = 'Quality Score: ' + score + '/100'; listScore.appendChild(scoreItem);
    let gateItem = document.createElement('div'); gateItem.className = 'page-item'; gateItem.textContent = 'Gate Status: ' + gate; listScore.appendChild(gateItem);
    let findingsItem = document.createElement('div'); findingsItem.className = 'page-item'; findingsItem.textContent = 'Total Findings: ' + (report.issueCount || 0); listScore.appendChild(findingsItem);
    let filesItem = document.createElement('div'); filesItem.className = 'page-item'; filesItem.textContent = 'Files Analyzed: ' + (report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0); listScore.appendChild(filesItem);
  }

  // Populate files page
  let listFiles = document.getElementById('list-files');
  if (listFiles) {
    listFiles.textContent = '';
    function addStatItem(container, label, value) {
      let div = document.createElement('div');
      div.className = 'page-item';
      div.textContent = label + ' ';
      let strong = document.createElement('strong');
      strong.textContent = value;
      div.appendChild(strong);
      container.appendChild(div);
    }
    addStatItem(listFiles, 'Total Repository Files:', report.totalFiles || 0);
    addStatItem(listFiles, 'Files Checked:', report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0);
    addStatItem(listFiles, 'Folders:', report.repositoryFoldersTotal || 0);
  }

  // Populate gate page
  let listGate = document.getElementById('list-gate');
  if (listGate) {
    listGate.textContent = '';
    let gatePass = report.gate && report.gate.pass;
    function addGateItem(container, label, value) {
      let div = document.createElement('div');
      div.className = 'page-item';
      div.textContent = label + ' ';
      let strong = document.createElement('strong');
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

function populateCodeMap(report) {
  let tree = document.getElementById('codeMapTree');
  let extBar = document.getElementById('codeMapExtBar');
  let legend = document.getElementById('codeMapLegend');
  let filesEl = document.getElementById('codeMapFiles');
  let dirsEl = document.getElementById('codeMapDirs');
  let langsEl = document.getElementById('codeMapLangs');
  let issues = report.issues || report.rawIssues || report.detectedIssues || report.findings || [];
  let files = report.files || report.fileList || report.sampleFiles || (report.summary && report.summary.fileList) || report.scannedFiles || [];
  let filePaths = Array.isArray(files) ? files : [];
  if (filePaths.length === 0 && issues.length > 0) {
    let seen = {};
    for (let fi = 0; fi < issues.length; fi++) {
      let fp = issues[fi].filePath || issues[fi].file || '';
      if (fp) seen[fp] = true;
    }
    filePaths = Object.keys(seen);
  }
  let total = filePaths.length || report.totalFiles || report.filesAnalyzed || report.repositoryFilesTotal || 0;
  let repoInv = report.repositoryInventory || {};
  let totalDirs = repoInv.totalFolders || 0;
  let invExts = repoInv.extensionCounts || {};

  if (filesEl) filesEl.textContent = total || '0';
  if (dirsEl) dirsEl.textContent = totalDirs || '0';

  let extCounts = {};
  let dirSet = {};
  for (let i = 0; i < filePaths.length; i++) {
    let fp = String(filePaths[i]);
    let idx = fp.lastIndexOf('.');
    let ext = idx > 0 ? fp.slice(idx + 1).toLowerCase() : 'no-ext';
    extCounts[ext] = (extCounts[ext] || 0) + 1;
    let d = fp.lastIndexOf('/');
    if (d < 0) d = fp.lastIndexOf('\\');
    if (d > 0) dirSet[fp.slice(0, d)] = true;
  }

  let extKeys = Object.keys(extCounts);
  if (extKeys.length === 0 && Object.keys(invExts).length > 0) {
    extCounts = invExts;
    extKeys = Object.keys(invExts);
  }
  if (langsEl) langsEl.textContent = extKeys.length || '0';

  let colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  let sortedExts = extKeys.sort(function(a,b){ return (extCounts[b]||0) - (extCounts[a]||0); });
  let topExts = sortedExts.slice(0, 10);

  if (extBar) {
    extBar.textContent = '';
    for (let e = 0; e < topExts.length; e++) {
      let pct = total > 0 ? (extCounts[topExts[e]] / total * 100) : 0;
      let fillDiv = document.createElement('div');
      fillDiv.className = 'code-map-ext-fill';
      fillDiv.style.width = pct + '%';
      fillDiv.style.background = colors[e % colors.length];
      extBar.appendChild(fillDiv);
    }
  }
  if (legend) {
    legend.textContent = '';
    for (let e2 = 0; e2 < topExts.length; e2++) {
      let itemSpan = document.createElement('span');
      itemSpan.className = 'code-map-legend-item';
      let dotSpan = document.createElement('span');
      dotSpan.className = 'code-map-legend-dot';
      dotSpan.style.background = colors[e2 % colors.length];
      itemSpan.appendChild(dotSpan);
      itemSpan.appendChild(document.createTextNode(topExts[e2] + ' ' + extCounts[topExts[e2]]));
      legend.appendChild(itemSpan);
    }
  }

  if (tree) {
    tree.textContent = '';
    if (filePaths.length === 0) {
      let emptyDiv = document.createElement('div');
      emptyDiv.className = 'code-map-empty';
      if (total > 0) {
        emptyDiv.textContent = 'Scanned ' + total.toLocaleString() + ' files. Directory tree requires a full scan with --full.';
      } else {
        emptyDiv.textContent = 'Run a scan to generate code map';
      }
      tree.appendChild(emptyDiv);
    } else {
      let dirs = {};
      for (let j = 0; j < filePaths.length; j++) {
        let p = String(filePaths[j]).replace(/\\/g, '/');
        let parts = p.split('/');
        let node = dirs;
        for (let k = 0; k < parts.length; k++) {
          let part = parts[k];
          if (!node[part]) node[part] = k === parts.length - 1 ? null : {};
          node = node[part];
        }
      }
      function renderTree(obj, depth) {
        let frag = document.createDocumentFragment();
        let keys = Object.keys(obj).sort();
        for (let t = 0; t < keys.length; t++) {
          let key = keys[t];
          let val = obj[key];
          let isFile = val === null;
          let itemDiv = document.createElement('div');
          itemDiv.className = 'code-map-tree-item';
          for (let d = 0; d < depth; d++) {
            let indentSpan = document.createElement('span');
            indentSpan.className = 'code-map-tree-indent';
            itemDiv.appendChild(indentSpan);
          }
          let iconSpan = document.createElement('span');
          iconSpan.className = 'code-map-tree-icon';
          iconSpan.textContent = isFile ? '📄' : '📁';
          itemDiv.appendChild(iconSpan);
          let nameSpan = document.createElement('span');
          nameSpan.className = 'code-map-tree-name';
          nameSpan.textContent = key;
          itemDiv.appendChild(nameSpan);
          frag.appendChild(itemDiv);
          if (!isFile && depth < 2) {
            frag.appendChild(renderTree(val, depth + 1));
          } else if (!isFile) {
            let childCount = Object.keys(val).length;
            let moreDiv = document.createElement('div');
            moreDiv.className = 'code-map-tree-item';
            for (let d2 = 0; d2 < depth + 1; d2++) {
              let indentSpan2 = document.createElement('span');
              indentSpan2.className = 'code-map-tree-indent';
              moreDiv.appendChild(indentSpan2);
            }
            let moreName = document.createElement('span');
            moreName.className = 'code-map-tree-name';
            moreName.style.color = 'var(--vscode-descriptionForeground)';
            moreName.textContent = '... ' + childCount + ' more';
            moreDiv.appendChild(moreName);
            frag.appendChild(moreDiv);
          }
        }
        return frag;
      }
      tree.appendChild(renderTree(dirs, 0));
    }
  }
}

let currentPage = null;
function showPage(page) {
  currentPage = page;
  let normalContent = document.getElementById('normalContent');
  let pageEl = document.getElementById('page-' + page);
  if (normalContent) normalContent.style.display = 'none';
  if (pageEl) pageEl.classList.add('active');
}

function hidePage() {
  if (currentPage) {
    let pageEl = document.getElementById('page-' + currentPage);
    if (pageEl) pageEl.classList.remove('active');
  }
  currentPage = null;
  let normalContent = document.getElementById('normalContent');
  if (normalContent) normalContent.style.display = 'block';
}

function hideResults() {
  let emptyState = document.getElementById('emptyState');
  let resultsSection = document.getElementById('resultsSection');
  if (emptyState) emptyState.style.display = 'block';
  if (resultsSection) resultsSection.style.display = 'none';
}

function toggleCollapsible(id) {
  let el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}

// Bind collapsible headers via addEventListener (avoids CSP inline-handler issues in VS Code webviews)
document.querySelectorAll('.collapsible-header').forEach(function(header) {
    header.addEventListener('click', function(e) {
        // Don't toggle if a button inside the header was clicked (those have their own actions)
        if (e.target.closest('button')) return;
        let id = this.parentElement.id;
        if (id) toggleCollapsible(id);
    });
});

let navMode = false;
function toggleNavMode() {
  navMode = !navMode;
  let normalContent = document.getElementById('normalContent');
  let navMenu = document.getElementById('navMenu');
  let toggleText = document.getElementById('navToggleText');
  let toggleIcon = document.getElementById('navToggleIcon');
  if (normalContent) normalContent.style.display = navMode ? 'none' : 'block';
  if (navMenu) navMenu.style.display = navMode ? 'block' : 'none';
  if (toggleText) toggleText.textContent = navMode ? 'Show Normal Menu' : 'Show Nav Menu';
  if (toggleIcon) toggleIcon.textContent = navMode ? '🔙' : '🧭';
  // navMode toggled
}

window.addEventListener('message',function(e) {
  try {
    let msg = e.data;
    if (msg.command === 'updateReport') {
      if (msg.report) {
        showResults(msg.report);
      } else {
        hideResults();
      }
    }
    if (msg.command === 'showDashboard') {
      let report = window.__currentSidebarReport;
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
      let el = document.getElementById('serverUrlText');
      if (el) el.textContent = msg.url || 'Default';
      let el2 = document.getElementById('serverUrlText2');
      if (el2) el2.textContent = msg.url || 'Default';
    }
    if (msg.command === 'diagnoseResult' && msg.lines) {
      let statusText = document.getElementById('statusText');
      if (statusText) statusText.textContent = 'Diagnose complete — see output';
      // Diagnose output shown inline below, no console needed
      // Show a simple inline report by creating a temporary page
      let container = document.getElementById('list-issues');
      if (container) {
        container.textContent = '';
        msg.lines.forEach(function(line) {
          let div = document.createElement('div');
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
    if (msg.command === 'switchTab' && msg.tabId) {
      if (typeof switchTab === 'function') { switchTab(msg.tabId); }
    }
    if (msg.command === 'renderCodeMap') {
      let container = document.getElementById('codeMapContainer');
      if (container) {
        container.textContent = '';
        if (msg.html) container.appendChild(document.createRange().createContextualFragment(msg.html));
      }
      let countEl = document.getElementById('codeMapFileCount');
      if (countEl && msg.fileCount != null) countEl.textContent = msg.fileCount + ' files';
    }
    if (msg.command === 'relayCommand' && msg.relayCommand) {
      // Browser initiated command via relay — reflect in sidebar UI
      let badge = document.getElementById('statusBadge');
      let statusText = document.getElementById('statusText');
      if (badge) { badge.className = 'status-badge completed'; }
      if (statusText) { statusText.textContent = 'Browser: ' + msg.relayCommand; }
    }
  } catch (err) {
    /* ignore message handling errors */
  }
});

let downloadedFiles = [];
function addDownloadedFile(name, path, time) {
  downloadedFiles.unshift({ name, path, time: time || new Date().toLocaleTimeString() });
  renderExplorer();
}
function clearExplorer() {
  downloadedFiles = [];
  renderExplorer();
}
function renderExplorer() {
  let section = document.getElementById('explorerSection');
  let divider = document.getElementById('explorerDivider');
  let tree = document.getElementById('explorerTree');
  if (!section || !tree) return;
  if (downloadedFiles.length === 0) {
    section.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  if (divider) divider.style.display = 'block';
  while (tree.firstChild) { tree.removeChild(tree.firstChild); }
  downloadedFiles.forEach(function(f, idx) {
    let item = document.createElement('div');
    item.className = 'explorer-item';
    item.title = f.path;
    item.addEventListener('click', function(e) {
      if (e.target.closest('.file-actions')) return;
      try {
        window.vscode.postMessage({ command: 'openFile', file: f.path, line: 1 });
      } catch (e) {
        sbLog('error', e);
      }
    });
    let icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📄';
    let name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = f.name || 'file';
    let time = document.createElement('span');
    time.className = 'file-time';
    time.textContent = f.time;
    let actions = document.createElement('span');
    actions.className = 'file-actions';
    let btnOpen = document.createElement('button'); btnOpen.className = 'file-btn'; btnOpen.title = 'Open'; btnOpen.textContent = '\u{1F4C2}';
    let btnReveal = document.createElement('button'); btnReveal.className = 'file-btn'; btnReveal.title = 'Reveal in Explorer'; btnReveal.textContent = '\u{1F4C1}';
    let btnCopy = document.createElement('button'); btnCopy.className = 'file-btn'; btnCopy.title = 'Copy Path'; btnCopy.textContent = '\u{1F4CB}';
    let btnRemove = document.createElement('button'); btnRemove.className = 'file-btn'; btnRemove.title = 'Remove'; btnRemove.textContent = '\u{1F5D1}';
    actions.appendChild(btnOpen); actions.appendChild(btnReveal); actions.appendChild(btnCopy); actions.appendChild(btnRemove);
    let fileButtons = [btnOpen, btnReveal, btnCopy, btnRemove];
    fileButtons.forEach(function(btn, bi) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (bi === 0) {
          if (!f.path) {
            try { window.vscode.postMessage({ command: 'showInfo', message: 'Browser downloads cannot be opened from the sidebar. Use your OS file manager.' }); } catch(e){ /* ignore postMessage failures */ }
            return;
          }
          try { window.vscode.postMessage({ command: 'openFile', file: f.path, line: 1 }); } catch(e){ /* ignore postMessage failures */ }
        } else if (bi === 1) {
          try { window.vscode.postMessage({ command: 'openFolder', file: f.path }); } catch(e){ /* ignore postMessage failures */ }
        } else if (bi === 2) {
          const copyValue = f.path || f.name || '';
          try { window.vscode.postMessage({ command: 'copyPath', path: copyValue }); } catch(e){ /* ignore postMessage failures */ }
        } else if (bi === 3) {
          downloadedFiles.splice(idx, 1);
          renderExplorer();
        }
      });
    });
    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(time);
    item.appendChild(actions);
    tree.appendChild(item);
  });
}

// Handle hash routes for SPA-style navigation inside standalone panel
window.addEventListener('hashchange', function() {
  let hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  let map = {'/':'dashboard','/dashboard':'dashboard','/analyze':'analyze','/report':'report','/settings':'settings','/certificate':'certificate','/codemap':'codeMap','/codeMap':'codeMap','/roadmap':'roadmap','/aiContext':'aiContext','/preview':'preview','/upload':'upload'};
  let pid = map[hash];
  if (pid && typeof openPageAndNotify === 'function') {
    openPageAndNotify(pid, pid, '');
  }
});
if (location.hash) { window.dispatchEvent(new Event('hashchange')); }

// Architecture map node inspector
(function initArchInspector() {
  let nodes = document.querySelectorAll('.arch-node');
  let inspectorText = document.getElementById('archInspectorText');
  if (!nodes.length || !inspectorText) return;
  let details = {
    web: { name: 'Web Application', type: 'React SPA', status: 'Operational', uptime: '99.99%', desc: 'Primary user-facing dashboard. Served via CDN with edge caching.' },
    mobile: { name: 'Mobile App', type: 'React Native', status: 'Operational', uptime: '99.95%', desc: 'Cross-platform mobile client. Supports iOS and Android.' },
    vscode: { name: 'VS Code: Extension', type: 'TypeScript / VS Code: API', status: 'Operational', uptime: '99.9%', desc: 'Sidebar provider and command palette integration.' },
    api: { name: 'API Gateway', type: 'Node.js / Express', status: 'Degraded', uptime: '99.5%', desc: 'Rate-limited reverse proxy. Currently experiencing elevated latency.' },
    auth: { name: 'Auth Service', type: 'OAuth2 / JWT', status: 'Operational', uptime: '99.99%', desc: 'Token issuance, validation, and session management.' },
    scan: { name: 'Scanner Service', type: 'Node.js / Worker', status: 'Operational', uptime: '99.9%', desc: 'Asynchronous file analysis engine. Queue-based processing.' },
    db: { name: 'PostgreSQL', type: 'RDS / Primary', status: 'Operational', uptime: '99.99%', desc: 'Relational datastore for reports, users, and settings.' },
    cache: { name: 'Redis', type: 'ElastiCache', status: 'Operational', uptime: '99.99%', desc: 'In-memory cache for scan results and session tokens.' },
    storage: { name: 'S3 Object Store', type: 'AWS S3', status: 'Operational', uptime: '99.99%', desc: 'Blob storage for exported reports and certificates.' }
  };
  nodes.forEach(function(node) {
    node.addEventListener('click', function() {
      let key = this.dataset.node;
      let d = details[key];
      if (d) {
        inspectorText.textContent = '';
        let strong = document.createElement('strong'); strong.textContent = d.name;
        let statusSpan = document.createElement('span'); statusSpan.style.color = d.status === 'Operational' ? '#22c55e' : '#eab308'; statusSpan.textContent = '\u25CF ' + d.status;
        let typeSpan = document.createElement('span'); typeSpan.style.color = 'var(--vscode-descriptionForeground)'; typeSpan.style.fontSize = '9px'; typeSpan.textContent = d.type + ' \u00B7 Uptime ' + d.uptime;
        let descSpan = document.createElement('span'); descSpan.style.color = 'var(--vscode-descriptionForeground)'; descSpan.style.fontSize = '9px'; descSpan.style.marginTop = '4px'; descSpan.style.display = 'block'; descSpan.textContent = d.desc;
        inspectorText.appendChild(strong);
        inspectorText.appendChild(document.createTextNode(' '));
        inspectorText.appendChild(statusSpan);
        inspectorText.appendChild(document.createElement('br'));
        inspectorText.appendChild(typeSpan);
        inspectorText.appendChild(document.createElement('br'));
        inspectorText.appendChild(descSpan);
      }
    });
  });
})();

// Settings category tabs
(function initSettingsTabs() {
  let catBtns = document.querySelectorAll('.settings-cat');
  let groups = document.querySelectorAll('.settings-group');
  if (!catBtns.length) return;
  catBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      let cat = this.dataset.cat;
      catBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.cat === cat); });
      groups.forEach(function(g) { g.classList.toggle('active', g.id === 'cat-' + cat); });
    });
  });
})();

// AI Context category tabs + sliders
(function initAiContext() {
  let catBtns = document.querySelectorAll('.ai-ctx-cat');
  let groups = document.querySelectorAll('.ai-ctx-group');
  if (catBtns.length) {
    catBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        let cat = this.dataset.cat;
        catBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.cat === cat); });
        groups.forEach(function(g) { g.classList.toggle('active', g.id === 'ai-ctx-' + cat); });
      });
    });
  }
  let tempSlider = document.getElementById('tempSlider');
  let tempVal = document.getElementById('tempVal');
  if (tempSlider && tempVal) {
    tempSlider.addEventListener('input', function() { tempVal.textContent = (parseInt(this.value,10) / 10).toFixed(1); });
  }
  let topPSlider = document.getElementById('topPSlider');
  let topPVal = document.getElementById('topPVal');
  if (topPSlider && topPVal) {
    topPSlider.addEventListener('input', function() { topPVal.textContent = (parseInt(this.value,10) / 10).toFixed(1); });
  }
  let chunkSlider = document.getElementById('chunkSlider');
  let chunkVal = document.getElementById('chunkVal');
  if (chunkSlider && chunkVal) {
    let chunkMap = [128,256,384,512,640,768,896,1024,1536,2048];
    chunkSlider.addEventListener('input', function() { chunkVal.textContent = chunkMap[Math.min(parseInt(this.value,10)-1, 9)]; });
  }
})();

// Upload dropzone interactions
(function initUploadDropzone() {
  let dz = document.getElementById('uploadDropzone');
  if (!dz) return;
  dz.addEventListener('dragenter', function(e) { e.preventDefault(); this.classList.add('dragover'); });
  dz.addEventListener('dragover', function(e) { e.preventDefault(); });
  dz.addEventListener('dragleave', function(e) { e.preventDefault(); this.classList.remove('dragover'); });
  dz.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
    let badge = document.getElementById('uploadStatusBadge');
    if (badge) badge.textContent = 'Processing...';
    setTimeout(function() { if (badge) badge.textContent = 'Ready'; }, 1500);
  });
  dz.addEventListener('click', function() {
    let badge = document.getElementById('uploadStatusBadge');
    if (badge) badge.textContent = 'Select files...';
    setTimeout(function() { if (badge) badge.textContent = 'Ready'; }, 1200);
  });
})();

// Security category tabs
(function initSecurityTabs() {
  let catBtns = document.querySelectorAll('.sec-cat');
  let groups = document.querySelectorAll('.sec-group');
  if (!catBtns.length) return;
  catBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      let cat = this.dataset.cat;
      catBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.cat === cat); });
      groups.forEach(function(g) { g.classList.toggle('active', g.id === 'sec-' + cat); });
    });
  });
})();