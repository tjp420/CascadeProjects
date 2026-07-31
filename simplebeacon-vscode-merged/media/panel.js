const DEFAULT_RELAY_PORT = 3001;
const DEFAULT_API_PORT = 3000;
const CONNECT_TIMEOUT_MS = 3000;
let activeTab = 'welcome';
function getRelayBase() {
  var rp = window._relayPort || DEFAULT_RELAY_PORT;
  return (window.__SB_RELAY_URL__ || 'http://localhost:' + rp).replace(/\/$/, ''); // simplebeacon-ignore config-drift — local relay fallback for VS Code: webview
}
function switchTab(pid) {
  document.querySelectorAll('.tab').forEach((t) => {
    if (t.dataset.page === pid) t.classList.add('active');
    else if (!t.classList.contains('add-tab')) t.classList.remove('active');
  });
  document.querySelectorAll('.page-frame').forEach((f) => f.classList.remove('active'));
  const t = document.getElementById('page-' + pid);
  if (t) {
    t.classList.add('active');
  }
  activeTab = pid;
}
function openPage(pid, title, icon, urlOverride) {
  if (!document.getElementById('page-' + pid)) createPage(pid, title, icon, urlOverride);
  addTab(pid, title, icon);
  switchTab(pid);
}
function openPageAndNotify(pid, title, icon) {
  if (window.parent && window.parent !== window && !window._inVsCodePanel) {
    window.parent.postMessage({ command: 'openTab', page: pid, title: title, icon: icon }, '*');
    if (window.vscode) {
      try {
        window.vscode.postMessage({ command: pid, page: pid });
      } catch (e) {
        /* ignore postMessage failures */
      }
    }
    return;
  }
  openPage(pid, title, icon);
  // In VS Code: panel, createPage already posts openSimpleBrowser — don't double-post to vscode
  if (window.vscode && !window._inVsCodePanel) {
    try {
      window.vscode.postMessage({ command: pid, page: pid });
    } catch (e) {
      /* ignore postMessage failures */
    }
  }
}
function createPage(pid, title, icon, urlOverride) {
  const c = document.getElementById('pageContent');
  if (!c) {
    return;
  }
  const f = document.createElement('div');
  f.className = 'page-frame';
  f.id = 'page-' + pid;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#1e1e1e';
  // External URL override: load directly, skip relay checks
  if (urlOverride) {
    iframe.src = urlOverride;
    f.appendChild(iframe);
    c.appendChild(f);
    return;
  }
  const rp = window._relayPort || DEFAULT_RELAY_PORT;
  var relayBase = (window.__SB_RELAY_URL__ || window.location.origin).replace(/\/$/, '');
  var apiBase = (window.__SB_API_URL__ || window.location.origin)
    .replace(/\/$/, '')
    .replace(':55444', ':' + DEFAULT_API_PORT);
  var knownPages = {
    dashboard: 1,
    analyze: 1,
    report: 1,
    settings: 1,
    roadmap: 1,
    aiContext: 1,
    upload: 1,
    preview: 1,
    audit: 1,
    security: 1,
    trust: 1,
    compliance: 1,
    repositoryHealth: 1,
    quality: 1,
    assessments: 1,
    platform: 1,
    profile: 1,
    analytics: 1,
    certificate: 1,
    codeMap: 1,
    team: 1,
  };
  // Pages that should load from the local relay server instead of the external dashboard API
  var localPages = {
    dashboard: 1,
    analyze: 1,
    report: 1,
    settings: 1,
    certificate: 1,
    codeMap: 1,
    roadmap: 1,
    aiContext: 1,
    audit: 1,
    security: 1,
    trust: 1,
    compliance: 1,
    quality: 1,
    assessments: 1,
    platform: 1,
    profile: 1,
    analytics: 1,
    team: 1,
    upload: 1,
    repositoryHealth: 1,
  };

  function buildUrl(base, pageId) {
    var rp = window._relayPort || DEFAULT_RELAY_PORT;
    var relay = (window.__SB_RELAY_URL__ || window.location.origin).replace(/\/$/, '');
    return relay + '/' + pageId;
  }

  var loadingOverlay =
    '<div class="sb-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1e1e1e;z-index:10;">' +
    '<div style="width:40px;height:40px;border:3px solid #333;border-top-color:#007acc;border-radius:50%;animation:sb-spin 1s linear infinite;margin-bottom:16px;"></div>' +
    '<div style="color:#888;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">Loading page…</div>' +
    '</div>';

  // Append frame immediately so openPage/switchTab can find it before async XHR resolves
  c.appendChild(f);

  function showError(targetUrl) {
    var wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    var icon = document.createElement('div');
    icon.style.cssText = 'font-size:48px;margin-bottom:16px;';
    icon.textContent = '\u1F6AB';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:16px;margin-bottom:8px;color:#fff;font-weight:600;';
    title.textContent = 'Dashboard server not running';
    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:13px;margin-bottom:4px;';
    msg.textContent = 'Cannot connect to ';
    var code = document.createElement('code');
    code.style.cssText = 'background:#252526;padding:2px 6px;border-radius:4px;';
    code.textContent = targetUrl.replace(/\\/g, '/');
    msg.appendChild(code);
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;margin-top:12px;max-width:400px;text-align:center;line-height:1.5;';
    hint.textContent =
      'Start your dashboard server or change SimpleBeacon \u203A API Server URL in VS Code: settings to a running server.';
    wrap.appendChild(icon);
    wrap.appendChild(title);
    wrap.appendChild(msg);
    wrap.appendChild(hint);
    f.textContent = '';
    f.appendChild(wrap);
  }

  function loadIframe(url) {
    var lo = document.createElement('div');
    lo.className = 'sb-loading';
    lo.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1e1e1e;z-index:10;';
    var spin = document.createElement('div');
    spin.style.cssText =
      'width:40px;height:40px;border:3px solid #333;border-top-color:#007acc;border-radius:50%;animation:sb-spin 1s linear infinite;margin-bottom:16px;';
    var txt = document.createElement('div');
    txt.style.cssText =
      'color:#888;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    txt.textContent = 'Loading page…';
    lo.appendChild(spin);
    lo.appendChild(txt);
    f.textContent = '';
    f.appendChild(lo);
    iframe.src = url || 'about:blank';
    f.appendChild(iframe);
    iframe.onload = function () {
      var lo2 = f.querySelector('.sb-loading');
      if (lo2) lo2.remove();
    };
    iframe.onerror = function () {
      var lo2 = f.querySelector('.sb-loading');
      if (lo2) lo2.remove();
    };
  }

  // Preview sends openUrl command to VS Code: extension host for external browser
  if (pid === 'preview') {
    if (window.vscode) {
      try {
        window.vscode.postMessage({ command: 'preview', openUrl: relayBase + '/' });
      } catch (e) {
        /* ignore postMessage failures */
      }
    }
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ command: 'preview', openUrl: relayBase + '/' }, '*');
      } catch (e) {
        /* ignore postMessage failures */
      }
    }
    if (!window.vscode && (!window.parent || window.parent === window)) {
      window.open(relayBase + '/', '_blank');
    }
    return;
  }

  // For all pages, try API server with connectivity check
  var targetUrl = buildUrl(apiBase, pid);
  if (!targetUrl || targetUrl === 'about:blank') {
    loadIframe('about:blank');
    return;
  }

  // Local pages bypass the external dashboard and load from relay directly
  if (localPages[pid]) {
    loadIframe(relayBase + '/' + pid);
    return;
  }

  // VS Code: webview CSP blocks framing external http URLs — use Simple Browser instead
  if (window._inVsCodePanel && window.vscode) {
    try {
      window.vscode.postMessage({ command: 'openSimpleBrowser', openUrl: targetUrl });
    } catch (e) {
      /* ignore postMessage failures */
    }
    // Show placeholder indicating page opened in Simple Browser
    var ph = document.createElement('div');
    ph.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    var phIcon = document.createElement('div');
    phIcon.style.cssText = 'font-size:64px;margin-bottom:16px;';
    phIcon.textContent = '\u1F310';
    var phTitle = document.createElement('div');
    phTitle.style.cssText = 'font-size:16px;margin-bottom:8px;color:#fff;font-weight:600;';
    phTitle.textContent = 'Opened in Simple Browser';
    var phMsg = document.createElement('div');
    phMsg.style.cssText = 'font-size:13px;';
    phMsg.textContent = 'This page was opened in VS Code: Simple Browser tab.';
    ph.appendChild(phIcon);
    ph.appendChild(phTitle);
    ph.appendChild(phMsg);
    f.textContent = '';
    f.appendChild(ph);
    return;
  }

  var CONNECT_TIMEOUT = CONNECT_TIMEOUT_MS;
  var checked = false;
  var checkReq = new XMLHttpRequest();
  checkReq.open('HEAD', apiBase + '/', true);
  checkReq.timeout = CONNECT_TIMEOUT;
  checkReq.onreadystatechange = function () {
    if (checked) return;
    if (checkReq.readyState === 4) {
      checked = true;
      if (checkReq.status >= 200 && checkReq.status < 400) {
        // API server reachable
        loadIframe(targetUrl);
      } else {
        // API server down - try relay server fallback for known pages
        if (knownPages[pid]) {
          var relayFallback = relayBase + '/' + pid;
          loadIframe(relayFallback);
        } else {
          loadIframe('about:blank');
        }
      }
    }
  };
  checkReq.onerror = function () {
    if (checked) return;
    checked = true;
    if (knownPages[pid]) {
      loadIframe(relayBase + '/' + pid);
    } else {
      loadIframe('about:blank');
    }
  };
  checkReq.ontimeout = function () {
    if (checked) return;
    checked = true;
    if (knownPages[pid]) {
      loadIframe(relayBase + '/' + pid);
    } else {
      loadIframe('about:blank');
    }
  };
  checkReq.send();
}
function addTab(pid, title, icon) {
  const ex = document.querySelector('.tab[data-page="' + pid + '"]');
  if (ex) {
    ex.classList.add('active');
    return;
  }
  const tb = document.getElementById('tabBar');
  if (!tb) {
    return;
  }
  const ab = tb.querySelector('.add-tab');
  const t = document.createElement('div');
  t.className = 'tab active';
  t.dataset.page = pid;
  const tabLabel = document.createElement('span');
  tabLabel.textContent = (icon + ' ' + title).replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) {
    return String.fromCodePoint(parseInt(hex, 16));
  });
  const tabClose = document.createElement('span');
  tabClose.className = 'close';
  tabClose.textContent = '\u2715';
  t.appendChild(tabLabel);
  t.appendChild(tabClose);
  tabClose.onclick = function (e) {
    e.stopPropagation();
    closeTab(e, pid);
  };
  t.onclick = function (e) {
    if (!e.target.classList.contains('close')) switchTab(pid);
  };
  tb.insertBefore(t, ab);
}
function closeTab(e, pid) {
  e.stopPropagation();
  const t = document.querySelector('.tab[data-page="' + pid + '"]');
  if (t) t.remove();
  const f = document.getElementById('page-' + pid);
  if (f) f.remove();
  if (activeTab === pid) {
    const r = document.querySelectorAll('.tab:not(.add-tab)');
    if (r.length > 0) switchTab(r[0].dataset.page);
    else switchTab('welcome');
  }
}
function showNewTabMenu() {
  const p = prompt(
    'Enter page: dashboard, analyze, report, settings, certificate, codeMap, roadmap, aiContext, security, trust, compliance, repositoryHealth, upload, preview, audit, quality, assessments, platform, profile, analytics, team:'
  );
  if (p) {
    const t = {
      dashboard: ['Dashboard', '&#x1F4CA;'],
      analyze: ['Analyze', '&#x1F50D;'],
      report: ['Report', '&#x1F4CB;'],
      settings: ['Settings', '&#x2699;'],
      certificate: ['Certificate', '&#x1F3C6;'],
      codeMap: ['Code Map', '&#x1F5FA;'],
      roadmap: ['Roadmap', '&#x1F6E4;'],
      aiContext: ['AI Context', '&#x1F916;'],
      security: ['Security', '&#x1F512;'],
      trust: ['Trust', '&#x2705;'],
      compliance: ['Compliance', '&#x1F6E1;'],
      repositoryHealth: ['Repo Health', '&#x1F4E6;'],
      upload: ['Upload', '&#x1F4E4;'],
      preview: ['Preview', '&#x1F441;'],
      audit: ['Audit', '&#x1F4CB;'],
      quality: ['Quality', '&#x1F3C6;'],
      assessments: ['Assessments', '&#x1F4DD;'],
      platform: ['Platform', '&#x1F4C8;'],
      profile: ['Profile', '&#x1F464;'],
      analytics: ['Analytics', '&#x1F4C8;'],
      team: ['Team', '&#x1F465;'],
    };
    const x = t[p] || [p, '&#x1F4C4;'];
    openPage(p, x[0], x[1]);
  }
}
function bindActionBtn(btn) {
  function activate() {
    const page = btn.dataset.page;
    const title = btn.dataset.title;
    const icon = btn.dataset.icon;
    if (page && title && icon && typeof openPageAndNotify === 'function') {
      openPageAndNotify(page, title, icon);
    }
  }
  btn.addEventListener('click', activate);
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
}
function bindCommandBtn(btn) {
  function activate() {
    const cmd = btn.dataset.command;
    if (!cmd) return;
    if (window.parent && window.parent !== window && !window._inVsCodePanel) {
      window.parent.postMessage({ command: cmd }, '*');
      return;
    }
    if (window.vscode) {
      try {
        window.vscode.postMessage({ command: cmd });
      } catch (e) {
        /* ignore postMessage failures */
      }
    } else {
      const rp = window._relayPort || DEFAULT_RELAY_PORT;
      if (cmd === 'scan' || cmd === 'scanWorkspace') {
        fetch(window.location.origin + '/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, source: 'browser' }),
        }).catch(function (err) {
          /* ignore relay fetch failures */
        });
      } else {
        fetch(window.location.origin + '/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, source: 'browser' }),
        }).catch(function (err) {
          /* ignore relay fetch failures */
        });
      }
    }
  }
  btn.addEventListener('click', activate);
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
}
document.querySelectorAll('.action-btn[data-action="openPage"]').forEach(bindActionBtn);
document.querySelectorAll('.action-btn[data-action="sendCommand"]').forEach(bindCommandBtn);
/* initialization complete */
document.querySelectorAll('.tab[data-action="switchTab"]').forEach(function (tab) {
  tab.addEventListener('click', function () {
    const t = tab.dataset.tab;
    if (t && typeof switchTab === 'function') switchTab(t);
  });
});
const addTabBtn = document.querySelector('.tab.add-tab[data-action="showNewTabMenu"]');
if (addTabBtn) {
  addTabBtn.addEventListener('click', function () {
    if (typeof showNewTabMenu === 'function') showNewTabMenu();
  });
}

window.addEventListener('hashchange', function () {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const map = {
    '/': 'welcome',
    '/dashboard': 'dashboard',
    '/analyze': 'analyze',
    '/report': 'report',
    '/settings': 'settings',
    '/certificate': 'certificate',
    '/codemap': 'codeMap',
    '/codeMap': 'codeMap',
    '/roadmap': 'roadmap',
    '/aiContext': 'aiContext',
    '/security': 'security',
    '/trust': 'trust',
    '/compliance': 'compliance',
    '/repositoryHealth': 'repositoryHealth',
    '/upload': 'upload',
    '/preview': 'preview',
    '/audit': 'audit',
    '/quality': 'quality',
    '/assessments': 'assessments',
    '/platform': 'platform',
    '/profile': 'profile',
    '/analytics': 'analytics',
    '/team': 'team',
  };
  const pid = map[hash];
  if (pid) {
    const t = {
      dashboard: ['Dashboard', '\u1F4CA'],
      analyze: ['Analyze', '\u1F50D'],
      report: ['Report', '\u1F4CB'],
      settings: ['Settings', '\u2699'],
      certificate: ['Certificate', '\u1F3C6'],
      codeMap: ['Code Map', '\u1F5FA'],
      audit: ['Audit', '\u1F4CB'],
      security: ['Security', '\u1F512'],
      trust: ['Trust', '\u2705'],
      quality: ['Quality', '\u1F3C6'],
      assessments: ['Assessments', '\u1F4DD'],
      roadmap: ['Roadmap', '\u1F6E4'],
      platform: ['Platform', '\u1F4C8'],
      profile: ['Profile', '\u1F464'],
      repositoryHealth: ['Repo Health', '\u1F4E6'],
      aiContext: ['AI Context', '\u1F916'],
      preview: ['Preview', '\u1F441'],
      upload: ['Upload', '\u1F4E4'],
      analytics: ['Analytics', '\u1F4C8'],
      team: ['Team', '\u1F465'],
    };
    const x = t[pid];
    if (x) openPage(pid, x[0], x[1]);
  }
});

(function () {
  const STORAGE_KEY = 'sb_show_welcome';
  const checkbox = document.getElementById('show-welcome-check');
  const saved = localStorage.getItem(STORAGE_KEY);
  const showWelcome = saved === null ? true : saved === 'true';
  if (checkbox) {
    checkbox.checked = showWelcome;
    checkbox.addEventListener('change', function () {
      localStorage.setItem(STORAGE_KEY, checkbox.checked ? 'true' : 'false');
    });
  }
  // Auto-open welcome page on first load if enabled
  if (showWelcome && typeof openPage === 'function') {
    try {
      openPage('welcome', 'Welcome', '\u1F3E0');
    } catch (e) {
      /* ignore openPage errors */
    }
  }
})();

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
let resizing = false;
let startX = 0;
let startWidth = 0;
const rz = document.getElementById('resizer'),
  sb = document.getElementById('sidebar');
if (rz) {
  rz.addEventListener('mousedown', (e) => {
    resizing = true;
    startX = e.clientX;
    startWidth = sb.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
}
document.addEventListener('mousemove', (e) => {
  if (!resizing) return;
  const dx = e.clientX - startX;
  const nw = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + dx));
  sb.style.width = nw + 'px';
});
document.addEventListener('mouseup', () => {
  resizing = false;
  document.body.style.cursor = 'default';
  document.body.style.userSelect = '';
});

var __vscodeApi = null;
try {
  __vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
} catch (e) {
  __vscodeApi = window.vscode || null;
}
window.vscode = __vscodeApi;
window.addEventListener('message', (e) => {
  const m = e.data;
  if (m && m.command) {
    if (
      __vscodeApi &&
      (m.command === 'updateAutoScan' ||
        m.command === 'updateMaxFiles' ||
        m.command === 'updateExclude' ||
        m.command === 'updateServerUrl')
    ) {
      __vscodeApi.postMessage(m);
      return;
    }
    if (m.command === 'getServerUrl') {
      const iframe = document.getElementById('sidebarFrame');
      const apiUrl = window.__SB_API_URL__ || window.location.origin;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ command: 'updateServerUrl', url: apiUrl }, '*');
      }
      if (!window._inVsCodePanel) {
        const rp = window._relayPort || DEFAULT_RELAY_PORT;
        fetch(window.location.origin + '/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: m.command, source: 'browser' }),
        }).catch(function (err) {
          /* ignore relay fetch failures */
        });
      }
      return;
    }
    if (m.command === 'requestData') {
      function buildCodeMapData(data) {
        const files = [],
          issues = [],
          seen = new Set();
        const raw = data.rawIssues || data.detectedIssues || data.findings || [];
        raw.forEach(function (issue) {
          const fp = issue.file || issue.filePath || issue.path || 'unknown';
          if (['unknown'].indexOf(fp) < 0 && !seen.has(fp)) {
            seen.add(fp);
            files.push({
              id: fp,
              name: fp.split(/[\\\/]/).pop(),
              path: fp,
              size: 0,
              lines: 0,
              language: 'unknown',
              complexity: 0,
              issues: [],
              patterns: [],
              metrics: {},
            });
          }
          const sev = (issue.severity || 'low').toLowerCase();
          const issueObj = {
            id: (issue.type || 'issue') + '-' + (issue.line || 0),
            type: issue.type || 'Unknown',
            severity: sev,
            file: fp,
            line: issue.line || 0,
            description: issue.description || issue.message || '',
            category: issue.category || issue.type || 'Unknown',
          };
          issues.push(issueObj);
          const file = files.find(function (f) {
            return f.path === fp;
          });
          if (file) file.issues.push(issueObj);
        });
        const sc = issues.reduce(function (acc, i) {
          acc[i.severity] = (acc[i.severity] || 0) + 1;
          return acc;
        }, {});
        return {
          files: files,
          dependencies: [],
          patterns: [],
          issues: issues,
          metrics: {
            totalFiles: files.length,
            totalIssues: issues.length,
            totalPatterns: 0,
            totalDependencies: 0,
            severityCounts: sc,
            languageCounts: {},
            avgComplexity: 0,
            healthScore: data.qualityScore || 100,
          },
          layout: { nodes: [], edges: [] },
        };
      }
      if (__vscodeApi) {
        __vscodeApi.postMessage({ command: 'requestData' });
        const handleDataResponse = function (ev) {
          if (ev.data && ev.data.command === 'updateData') {
            window.removeEventListener('message', handleDataResponse);
            if (e.source) e.source.postMessage({ command: 'updateData', data: ev.data.data || {} }, '*');
          }
        };
        window.addEventListener('message', handleDataResponse);
        return;
      }
      const relayData = window.__sbData;
      if (relayData && e.source) {
        e.source.postMessage({ command: 'updateData', data: buildCodeMapData(relayData) }, '*');
        return;
      }
      const rp = window._relayPort || 3001;
      fetch(window.location.origin + '/api/data')
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (e.source) e.source.postMessage({ command: 'updateData', data: buildCodeMapData(data || {}) }, '*');
        })
        .catch(function (err) {
          if (window.__vscodeApi)
            window.__vscodeApi.postMessage({
              command: 'logError',
              message: 'CodeMap relay fetch failed: ' + (err && err.message) || String(err),
            });
        });
      return;
    }
    if (m.command === 'openTab' && m.page) {
      if (m.source === 'extension') {
        openPage(m.page, m.title || m.page, m.icon || '', m.url);
        return;
      }
      if (m.url) {
        openPage(m.page, m.title || m.page, m.icon || '', m.url);
        return;
      }
      var sidebarNative = { welcome: 1, codemap: 1, analyze: 1, report: 1, settings: 1, dashboard: 1 };
      var sidebarEl = document.getElementById('sidebar');
      var sidebarHidden =
        sidebarEl && (getComputedStyle(sidebarEl).display === 'none' || sidebarEl.offsetParent === null);
      if (sidebarNative[m.page] && !sidebarHidden) {
        var sf = document.getElementById('sidebarFrame');
        if (sf && sf.contentWindow) sf.contentWindow.postMessage({ command: 'switchTab', pageId: m.page }, '*');
        return;
      }
      openPage(m.page, m.title || m.page, m.icon || '');
      return;
    }
    const map = {
      navDashboard: 'dashboard',
      navAnalyze: 'analyze',
      navResults: 'report',
      navRepoHealth: 'repositoryHealth',
      navAudit: 'audit',
      navSecurity: 'security',
      navQuality: 'quality',
      navTrust: 'trust',
      navAssessments: 'assessments',
      navRoadmap: 'roadmap',
      navPlatform: 'platform',
      navProfile: 'profile',
      navCodeMap: 'codeMap',
      navSettings: 'settings',
      navCertificate: 'certificate',
      navAiContext: 'aiContext',
      dashboard: 'dashboard',
      analyze: 'analyze',
      report: 'report',
      settings: 'settings',
      openSettings: 'settings',
      generateCertificate: 'certificate',
      showReport: 'report',
      codemap: 'codeMap',
      showCodeMap: 'codeMap',
      codeMap: 'codeMap',
      openBrowser: 'preview',
      openUpload: 'upload',
      openDashboard: 'dashboard',
      cert: 'certificate',
      openSidebarDebug: 'preview',
      sendSidebarToAi: 'aiContext',
      scan: 'dashboard',
      clear: 'dashboard',
      openInIde: 'welcome',
      analytics: 'analytics',
      team: 'team',
      enhanced: 'report',
      realtime: 'dashboard',
      pattern: 'analyze',
      health: 'dashboard',
      toggleRealtime: 'dashboard',
      sendToAi: 'aiContext',
    };
    const pid = map[m.command];
    if (pid) {
      // Preview opens in external browser — don't create an IDE tab
      if (pid === 'preview') {
        if (window.vscode) {
          var rb = getRelayBase();
          try {
            window.vscode.postMessage({ command: 'preview', openUrl: rb + '/' });
          } catch (e) {
            /* ignore postMessage failures */
          }
        }
        if (window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ command: 'preview', openUrl: rb + '/' }, '*');
          } catch (e) {
            /* ignore postMessage failures */
          }
        }
        // Browser context fallback: open relay URL directly
        if (!window.vscode && (!window.parent || window.parent === window)) {
          var rpb = window._relayPort || DEFAULT_RELAY_PORT;
          var rb = (window.__SB_RELAY_URL__ || window.location.origin).replace(/\/$/, '');
          window.open(rb + '/', '_blank');
        }
        return;
      }
      var sidebarNative2 = { welcome: 1, codemap: 1, analyze: 1, report: 1, settings: 1, dashboard: 1 };
      var sidebarEl2 = document.getElementById('sidebar');
      var sidebarHidden2 =
        sidebarEl2 && (getComputedStyle(sidebarEl2).display === 'none' || sidebarEl2.offsetParent === null);
      if (sidebarNative2[pid] && !sidebarHidden2) {
        var sf2 = document.getElementById('sidebarFrame');
        if (sf2 && sf2.contentWindow) sf2.contentWindow.postMessage({ command: 'switchTab', pageId: pid }, '*');
        return;
      }
      const t = {
        dashboard: ['Dashboard', '&#x1F4CA;'],
        analyze: ['Analyze', '&#x1F50D;'],
        report: ['Report', '&#x1F4CB;'],
        settings: ['Settings', '&#x2699;'],
        certificate: ['Certificate', '&#x1F3C6;'],
        codeMap: ['Code Map', '&#x1F5FA;'],
        audit: ['Audit', '&#x1F4CB;'],
        security: ['Security', '&#x1F512;'],
        trust: ['Trust', '&#x2705;'],
        quality: ['Quality', '&#x1F3C6;'],
        assessments: ['Assessments', '&#x1F4DD;'],
        roadmap: ['Roadmap', '&#x1F6E4;'],
        platform: ['Platform', '&#x1F4C8;'],
        profile: ['Profile', '&#x1F464;'],
        upload: ['Upload', '&#x1F4E4;'],
        repositoryHealth: ['Repo Health', '&#x1F4E6;'],
        aiContext: ['AI Context', '&#x1F916;'],
        analytics: ['Analytics', '&#x1F4C8;'],
        team: ['Team', '&#x1F465;'],
        welcome: ['Welcome', '&#x1F3E0;'],
      };
      const x = t[pid];
      if (x) openPage(pid, x[0], x[1]);
    }
    const navigationCommands = {
      dashboard: 1,
      report: 1,
      settings: 1,
      certificate: 1,
      codeMap: 1,
      roadmap: 1,
      aiContext: 1,
      upload: 1,
      welcome: 1,
      navDashboard: 1,
      navResults: 1,
      navRepoHealth: 1,
      navAudit: 1,
      navSecurity: 1,
      navQuality: 1,
      navTrust: 1,
      navAssessments: 1,
      navRoadmap: 1,
      navPlatform: 1,
      navProfile: 1,
      navCodeMap: 1,
      navSettings: 1,
      navCertificate: 1,
      navAiContext: 1,
      generateCertificate: 1,
      showReport: 1,
      showCodeMap: 1,
      openInIde: 1,
      openUpload: 1,
      openDashboard: 1,
      cert: 1,
      openSidebarDebug: 1,
      sendSidebarToAi: 1,
      openTab: 1,
      enhanced: 1,
      realtime: 1,
      pattern: 1,
      health: 1,
      toggleRealtime: 1,
      sendToAi: 1,
    };
    if (__vscodeApi && e.source && e.source !== window && !navigationCommands[m.command]) {
      __vscodeApi.postMessage(m);
    }
    if (!window._inVsCodePanel) {
      const rp = window._relayPort || DEFAULT_RELAY_PORT;
      var scanCmd = m.command;
      if (scanCmd === 'scan' || scanCmd === 'scanWorkspace') {
        fetch(window.location.origin + '/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: scanCmd, source: 'browser' }),
        }).catch(function (err) {
          /* ignore relay fetch failures */
        });
      } else {
        var relayCmd = pid || m.command;
        fetch(window.location.origin + '/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: relayCmd, source: 'browser' }),
        }).catch(function (err) {
          /* ignore relay fetch failures */
        });
      }
    }
  }
});
