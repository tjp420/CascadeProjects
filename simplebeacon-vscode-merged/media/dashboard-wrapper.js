// Bridge the VS Code webview host, the extension, and the embedded dashboard iframe.
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const iframe = document.getElementById('dash');
  const overlay = document.getElementById('drag-overlay');
  const urlInput = document.getElementById('sbUrlInput');
  const backBtn = document.getElementById('sbBackBtn');
  const fwdBtn = document.getElementById('sbFwdBtn');
  const reloadBtn = document.getElementById('sbReloadBtn');
  const externalBtn = document.getElementById('sbExternalBtn');

  const browserHistory = { urls: [], index: -1, pendingUrl: null };

  var SITE_PATHS = ['/roadmap', '/audit', '/pricing', '/contact', '/team', '/security', '/terms', '/privacy', '/refund', '/faq'];

  function getIframeOrigin() {
    var src = iframe ? (iframe.getAttribute('src') || iframe.src || '') : '';
    try {
      return new URL(src).origin;
    } catch (e) {
      return 'https://simplebeacon.ai';
    }
  }

  function isSitePath(path) {
    if (!path || path.charAt(0) !== '/') return false;
    return SITE_PATHS.some(function (p) {
      return path === p || path.indexOf(p + '/') === 0 || path.indexOf(p + '?') === 0;
    });
  }

  function isWebsiteModeActive() {
    return window.__SB_WEBSITE_MODE__ === '1' || _embedContext.websiteMode;
  }

  function getDisplayOrigin() {
    if (isWebsiteModeActive()) return 'https://simplebeacon.ai';
    return getIframeOrigin();
  }

  function resolveUrlInput(raw) {
    if (!raw) return '';
    var trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    var origin = getDisplayOrigin();
    if (trimmed.charAt(0) === '/') {
      if (trimmed.indexOf('/dashboard/') === 0 || trimmed === '/dashboard') return origin + trimmed;
      if (isSitePath(trimmed)) return origin + trimmed;
      return origin + '/dashboard' + trimmed;
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return 'https://' + trimmed.replace(/^\/+/, '');
    return origin + '/dashboard/' + trimmed.replace(/^#?\/?/, '');
  }

  function stripEmbedParams(url) {
    if (!url) return url;
    try {
      var parsed = new URL(url);
      ['sb_parent_urlbar', 'sb_notify_base', 'sb_api_base', 'sb_website_mode'].forEach(function (k) {
        parsed.searchParams.delete(k);
      });
      return parsed.toString();
    } catch (e) {
      return url;
    }
  }

  var _embedContext = { notifyBase: '', apiBase: '', websiteMode: window.__SB_WEBSITE_MODE__ === '1' };

  function captureEmbedContext(url) {
    if (!url) return;
    try {
      var parsed = new URL(url);
      var notify = parsed.searchParams.get('sb_notify_base') || '';
      var api = parsed.searchParams.get('sb_api_base') || notify;
      if (notify) _embedContext.notifyBase = notify;
      if (api) {
        if (api.indexOf('/api') === -1 && notify && notify.indexOf('/api') !== -1) {
          api = notify;
        } else if (api.indexOf('/api') === -1) {
          api = api.replace(/\/+$/, '') + '/api';
        }
        _embedContext.apiBase = api;
      }
      var websiteParam = parsed.searchParams.get('sb_website_mode');
      if (websiteParam === '1') {
        _embedContext.websiteMode = true;
        window.__SB_WEBSITE_MODE__ = '1';
      } else if (websiteParam === '0') {
        _embedContext.websiteMode = false;
        window.__SB_WEBSITE_MODE__ = '0';
      } else if (!isWebsiteModeActive() && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) {
        _embedContext.websiteMode = false;
      }
    } catch (e) { /* ignore */ }
  }

  function ensureEmbedParams(url) {
    if (!url || !canEmbed(url)) return url;
    captureEmbedContext(url);
    try {
      var parsed = new URL(url);
      if (!parsed.searchParams.has('sb_parent_urlbar')) {
        parsed.searchParams.set('sb_parent_urlbar', '1');
      }
      if (_embedContext.notifyBase && !parsed.searchParams.has('sb_notify_base')) {
        parsed.searchParams.set('sb_notify_base', _embedContext.notifyBase);
      }
      var path = parsed.pathname || '';
      var isDashboard = path === '/dashboard' || path.indexOf('/dashboard/') === 0;
      if (isDashboard && _embedContext.apiBase && !parsed.searchParams.has('sb_api_base')) {
        parsed.searchParams.set('sb_api_base', _embedContext.apiBase);
      }
      if (_embedContext.websiteMode && !parsed.searchParams.has('sb_website_mode')) {
        parsed.searchParams.set('sb_website_mode', '1');
      }
      return parsed.toString();
    } catch (e) {
      var out = url;
      if (out.indexOf('sb_parent_urlbar=') === -1) {
        out += (out.indexOf('?') === -1 ? '?' : '&') + 'sb_parent_urlbar=1';
      }
      if (_embedContext.notifyBase && out.indexOf('sb_notify_base=') === -1) {
        out += (out.indexOf('?') === -1 ? '?' : '&') + 'sb_notify_base=' + encodeURIComponent(_embedContext.notifyBase);
      }
      if (_embedContext.apiBase && out.indexOf('sb_api_base=') === -1 && out.indexOf('/dashboard') !== -1) {
        out += (out.indexOf('?') === -1 ? '?' : '&') + 'sb_api_base=' + encodeURIComponent(_embedContext.apiBase);
      }
      return out;
    }
  }

  function isWebsiteModeUrl(url) {
    if (!url) return false;
    try {
      var parsed = new URL(url);
      if (parsed.searchParams.get('sb_website_mode') === '1') return true;
      var host = parsed.hostname.toLowerCase();
      return host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai');
    } catch (e) {
      return false;
    }
  }

  function toLocalDashboardIframeUrl(url) {
    var localBase = window.__SB_LOCAL_DASHBOARD_BASE__ || '';
    if (!localBase) return url;
    try {
      var parsed = new URL(url);
      var host = parsed.hostname.toLowerCase();
      var path = parsed.pathname || '';
      var isDashboard = path === '/dashboard' || path.indexOf('/dashboard/') === 0;
      if (!isDashboard) return url;
      if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) {
        return localBase.replace(/\/$/, '') + path + parsed.search + parsed.hash;
      }
    } catch (e) { /* ignore */ }
    return url;
  }

  function toWebsiteDisplayUrl(url) {
    if (!isWebsiteModeActive()) return url;
    try {
      var parsed = new URL(url);
      var host = parsed.hostname.toLowerCase();
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        var path = parsed.pathname || '';
        if (path === '/dashboard' || path.indexOf('/dashboard/') === 0) {
          return 'https://simplebeacon.ai' + path + parsed.search + parsed.hash;
        }
      }
      if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) {
        return url;
      }
    } catch (e) { /* ignore */ }
    return url;
  }

  /** Website mode keeps simplebeacon.ai URLs; localhost mode rewrites remote dashboard routes to the data-server. */
  function preferLocalDashboardUrl(url) {
    if (!url) return url;
    if (isWebsiteModeActive()) {
      return url;
    }
    var localBase = window.__SB_LOCAL_DASHBOARD_BASE__ || '';
    try {
      var parsed = new URL(url);
      var host = parsed.hostname.toLowerCase();
      if ((host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) && parsed.pathname.indexOf('/dashboard') === 0) {
        if (localBase) {
          return localBase.replace(/\/$/, '') + parsed.pathname + parsed.search + parsed.hash;
        }
        var localOrigin = getIframeOrigin();
        if (localOrigin && (localOrigin.indexOf('127.0.0.1') >= 0 || localOrigin.indexOf('localhost') >= 0)) {
          return localOrigin + parsed.pathname + parsed.search + parsed.hash;
        }
      }
    } catch (e) { /* ignore */ }
    return url;
  }

  function applyWrapperTheme(theme) {
    if (!theme) return;
    var isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
    var barBg = isLight ? '#f3f3f3' : '#252526';
    var barBorder = isLight ? '#e0e0e0' : '#1e1e1e';
    var btnColor = isLight ? '#424242' : '#cccccc';
    var inputBg = isLight ? '#ffffff' : '#3c3c3c';
    var inputBorder = isLight ? '#cecece' : '#3c3c3c';
    var inputFg = isLight ? '#333333' : '#cccccc';
    var pageBg = isLight ? '#f3f3f3' : '#1e1e1e';
    document.body.style.background = pageBg;
    var bar = document.querySelector('.sb-url-bar');
    if (bar) {
      bar.style.background = barBg;
      bar.style.borderBottomColor = barBorder;
      bar.querySelectorAll('button').forEach(function (btn) { btn.style.color = btnColor; });
    }
    if (urlInput) {
      urlInput.style.background = inputBg;
      urlInput.style.borderColor = inputBorder;
      urlInput.style.color = inputFg;
    }
  }

  function notifyIframeHideUrlBar() {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ command: 'setParentUrlBar', active: true }, '*');
    }
  }

  function getCurrentUrl() {
    if (browserHistory.index >= 0 && browserHistory.urls[browserHistory.index]) {
      return browserHistory.urls[browserHistory.index];
    }
    if (urlInput && urlInput.value) return urlInput.value;
    if (iframe) return iframe.getAttribute('src') || iframe.src || '';
    return '';
  }

  function updateToolbar() {
    if (urlInput) urlInput.value = browserHistory.urls[browserHistory.index] || '';
    if (backBtn) backBtn.disabled = browserHistory.index <= 0;
    if (fwdBtn) fwdBtn.disabled = browserHistory.index < 0 || browserHistory.index >= browserHistory.urls.length - 1;
  }

  function pushHistory(url) {
    if (!url) return;
    browserHistory.urls = browserHistory.urls.slice(0, browserHistory.index + 1);
    if (browserHistory.urls[browserHistory.index] === url) return;
    browserHistory.urls.push(url);
    browserHistory.index = browserHistory.urls.length - 1;
    updateToolbar();
  }

  function canEmbed(url) {
    try {
      var host = new URL(url).hostname.toLowerCase();
      if (host === 'simplebeacon.ai' || host.endsWith('.simplebeacon.ai')) return true;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      if (host.endsWith('.onrender.com')) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function navigateToUrl(url, push, explicitDisplayUrl) {
    if (!url || !iframe) return;
    var resolved = resolveUrlInput(url) || url;
    var displayUrl = explicitDisplayUrl || toWebsiteDisplayUrl(ensureEmbedParams(resolved));
    var iframeUrl = preferLocalDashboardUrl(displayUrl);
    if (!canEmbed(iframeUrl)) {
      var clean = stripEmbedParams(displayUrl);
      vscode.postMessage({ command: 'openInSimpleBrowser', url: clean });
      if (urlInput) urlInput.value = clean;
      if (push) pushHistory(clean);
      else updateToolbar();
      return;
    }
    iframeUrl = ensureEmbedParams(iframeUrl);
    displayUrl = ensureEmbedParams(displayUrl);
    browserHistory.pendingUrl = iframeUrl;
    iframe.src = iframeUrl;
    if (urlInput) urlInput.value = displayUrl;
    if (push) pushHistory(displayUrl);
    else updateToolbar();
  }

  function goBack() {
    if (browserHistory.index > 0) {
      browserHistory.index--;
      navigateToUrl(browserHistory.urls[browserHistory.index], false);
    }
  }

  function goForward() {
    if (browserHistory.index < browserHistory.urls.length - 1) {
      browserHistory.index++;
      navigateToUrl(browserHistory.urls[browserHistory.index], false);
    }
  }

  function refresh() {
    if (iframe && browserHistory.index >= 0) {
      navigateToUrl(browserHistory.urls[browserHistory.index], false);
    }
  }

  if (iframe) {
    const initialUrl = iframe.getAttribute('src') || iframe.src;
    if (initialUrl) {
      var iframeSrc = preferLocalDashboardUrl(initialUrl);
      iframeSrc = ensureEmbedParams(iframeSrc);
      var displayUrl = window.__SB_DISPLAY_URL__ || toWebsiteDisplayUrl(iframeSrc);
      displayUrl = ensureEmbedParams(displayUrl);
      if (iframeSrc !== initialUrl) {
        iframe.src = iframeSrc;
      }
      browserHistory.urls = [displayUrl];
      browserHistory.index = 0;
      updateToolbar();
      captureEmbedContext(iframeSrc);
    }
  }

  applyWrapperTheme(window.__SB_WRAPPER_THEME__ || 'dark');

  if (backBtn) backBtn.addEventListener('click', goBack);
  if (fwdBtn) fwdBtn.addEventListener('click', goForward);
  if (reloadBtn) reloadBtn.addEventListener('click', refresh);
  if (externalBtn) {
    externalBtn.addEventListener('click', function () {
      const url = stripEmbedParams(getCurrentUrl());
      if (url) vscode.postMessage({ command: 'openExternalUrl', url: url });
    });
  }
  if (urlInput) {
    urlInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var raw = urlInput.value.trim();
      if (!raw) return;
      navigateToUrl(raw, true);
    });
  }

  window.addEventListener('message', function (ev) {
    if (!ev.data || !ev.data.command) return;
    const fromIframe = typeof ev.origin === 'string' && ev.origin.length > 0 && ev.origin.startsWith('http');

    if (fromIframe) {
      if (ev.data.command === 'bridgeFetch' && ev.data.requestId && ev.data.url) {
        var bridgeInit = ev.data.init || {};
        fetch(ev.data.url, {
          method: bridgeInit.method || 'GET',
          headers: bridgeInit.headers || undefined,
          body: bridgeInit.body || undefined
        }).then(function(res) {
          return res.text().then(function(body) {
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                command: 'bridgeFetchResponse',
                requestId: ev.data.requestId,
                status: res.status,
                contentType: res.headers.get('content-type') || 'application/json',
                body: body
              }, '*');
            }
          });
        }).catch(function(err) {
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              command: 'bridgeFetchResponse',
              requestId: ev.data.requestId,
              error: err && err.message ? err.message : String(err)
            }, '*');
          }
        });
        return;
      }
      if (ev.data.command === 'navigateToRoute' && ev.data.url) {
        captureEmbedContext(ev.data.url);
        navigateToUrl(ev.data.url, true, ev.data.displayUrl || null);
        return;
      }
      if (ev.data.command === 'dashboardRouteChanged' && ev.data.url) {
        var iframeUrl = ensureEmbedParams(ev.data.url || '');
        var displayUrl = toWebsiteDisplayUrl(iframeUrl);
        displayUrl = ensureEmbedParams(displayUrl);
        if (browserHistory.pendingUrl === iframeUrl) {
          browserHistory.pendingUrl = null;
          updateToolbar();
        } else {
          pushHistory(displayUrl);
        }
      }
      if (ev.data.command === 'setAuthState' || ev.data.command === 'getAuthState' || ev.data.command === 'dashboardRouteChanged' || ev.data.command === 'scanWorkspace' || ev.data.command === 'downloadComplete' || ev.data.command === 'downloadFile' || ev.data.command === 'openFile' || ev.data.command === 'openFileAtLine') {
        vscode.postMessage(ev.data);
      }
      return;
    }

    if (ev.data.command === 'navigateToRoute' && ev.data.url) {
      captureEmbedContext(ev.data.url);
      navigateToUrl(ev.data.url, true, ev.data.displayUrl || null);
      return;
    }

    if (ev.data.command === 'dashboardModeChanged') {
      var isWebsite = ev.data.mode === 'website';
      window.__SB_WEBSITE_MODE__ = isWebsite ? '1' : '0';
      _embedContext.websiteMode = isWebsite;
      var current = browserHistory.urls[browserHistory.index] || (urlInput && urlInput.value) || '';
      if (!current && iframe) {
        current = iframe.getAttribute('src') || iframe.src || '';
      }
      if (current) {
        navigateToUrl(stripEmbedParams(current), true);
      }
      return;
    }

    if (ev.data.command === 'setAuthState' || ev.data.command === 'setTheme' || ev.data.command === 'getAuthState') {
      if (ev.data.command === 'setTheme' && ev.data.theme) {
        applyWrapperTheme(ev.data.theme);
      }
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(ev.data, '*');
      }
    }
  });

  function requestDashboardAuthState() {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ command: 'getAuthState' }, '*');
    }
  }

  if (iframe) {
    iframe.addEventListener('load', function () {
      notifyIframeHideUrlBar();
      requestDashboardAuthState();
    });
    notifyIframeHideUrlBar();
    setInterval(notifyIframeHideUrlBar, 2000);
  }
  let authPollCount = 0;
  const authPollInterval = setInterval(function () {
    requestDashboardAuthState();
    authPollCount++;
    if (authPollCount >= 3) { clearInterval(authPollInterval); }
  }, 1000);

  let dragDepth = 0;
  function showOverlay() {
    dragDepth++;
    overlay.style.display = 'block';
    if (iframe) iframe.style.pointerEvents = 'none';
  }
  function hideOverlay() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      overlay.style.display = 'none';
      if (iframe) iframe.style.pointerEvents = '';
    }
  }
  function parseFileUri(uri) {
    if (!uri || !uri.startsWith('file:///')) return '';
    let p = uri.slice(8).replace(/\/$/, '');
    try { p = decodeURIComponent(p); } catch (e) {}
    return p;
  }
  function extractDropPath(dt) {
    if (!dt) return { path: '', name: '' };
    let entryName = '';
    try {
      const item = dt.items && dt.items[0];
      if (item && typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) { entryName = entry.name || ''; }
      }
    } catch (e) {}
    const files = dt.files;
    if (files && files.length > 0 && files[0].path) {
      const fp = files[0].path.replace(/\\/g, '/');
      const name = entryName || files[0].name || '';
      if (name) {
        const idx = fp.indexOf('/' + name + '/');
        if (idx >= 0) { return { path: fp.slice(0, idx + name.length + 1), name }; }
        const endIdx = fp.lastIndexOf('/' + name);
        if (endIdx >= 0) { return { path: fp.slice(0, endIdx + name.length + 1), name }; }
      }
      return { path: fp.substring(0, fp.lastIndexOf('/')), name: files[0].name };
    }
    const uriList = (() => { try { return dt.getData('text/uri-list') || ''; } catch (e) { return ''; } })();
    if (uriList) {
      const uri = uriList.trim().split('\n')[0]?.trim();
      const p = parseFileUri(uri);
      if (p) return { path: p, name: p.split('/').pop() || '' };
    }
    const plain = (() => { try { return dt.getData('text/plain') || ''; } catch (e) { return ''; } })();
    if (plain) {
      const p = plain.trim().split('\n')[0]?.trim().replace(/^["']|["']$/g, '');
      if (p && /^[a-zA-Z]:[\\\/]/.test(p)) {
        const normalized = p.replace(/[\\\/]+$/, '').replace(/\\/g, '/');
        return { path: normalized, name: normalized.split('/').pop() || '' };
      }
    }
    return { path: '', name: '' };
  }
  window.addEventListener('dragenter', function (ev) { ev.preventDefault(); showOverlay(); });
  window.addEventListener('dragover', function (ev) { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', function () { hideOverlay(); });
  overlay.addEventListener('dragover', function (ev) { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; });
  overlay.addEventListener('drop', function (ev) {
    ev.preventDefault();
    dragDepth = 0;
    overlay.style.display = 'none';
    const dt = ev.dataTransfer;
    const { path, name } = extractDropPath(dt);
    if (path && iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ command: 'ideDropPath', path: path.replace(/\//g, '\\\\'), name }, '*');
    } else if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ command: 'ideDropFailed', reason: 'Could not read dropped path. Use Browse Folder or type the path.' }, '*');
    }
  });
})();
//# sourceURL=dashboard-wrapper.js
