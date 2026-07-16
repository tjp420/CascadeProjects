// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code — bridge for VS Code sidebar
/**
 * Notify the SimpleBeacon VS Code extension when audit-page actions complete.
 * Uses postMessage when embedded in the IDE iframe, plus POST /api/notify when sb_notify_base is set.
 */
(function () {
  'use strict';

  var _downloadNotifyId = 0;

  var EMBED_PARAM_KEYS = ['sb_notify_base', 'sb_api_base', 'sb_website_mode', 'sb_parent_urlbar'];

  function persistEmbedParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      EMBED_PARAM_KEYS.forEach(function (key) {
        var value = params.get(key);
        if (value) {
          sessionStorage.setItem(key, value);
        }
      });
    } catch (e) { /* ignore */ }
  }

  function getEmbedParams() {
    var out = new URLSearchParams();
    try {
      var params = new URLSearchParams(window.location.search);
      EMBED_PARAM_KEYS.forEach(function (key) {
        var value = params.get(key) || sessionStorage.getItem(key);
        if (value) {
          out.set(key, value);
          sessionStorage.setItem(key, value);
        }
      });
    } catch (e) { /* ignore */ }
    return out;
  }

  function buildEmbeddedUrl(path) {
    var rawPath = String(path || '/');
    var base = rawPath;
    var pathQuery = '';
    var qIndex = rawPath.indexOf('?');
    if (qIndex >= 0) {
      base = rawPath.slice(0, qIndex);
      pathQuery = rawPath.slice(qIndex + 1);
    }
    var merged = getEmbedParams();
    if (pathQuery) {
      var pathParams = new URLSearchParams(pathQuery);
      pathParams.forEach(function (value, key) {
        merged.set(key, value);
      });
    }
    var qs = merged.toString();
    return base + (qs ? '?' + qs : '');
  }

  function navigateEmbeddedRoute(path) {
    var targetPath = buildEmbeddedUrl(path);
    var absoluteUrl;
    try {
      absoluteUrl = new URL(targetPath, window.location.origin).toString();
    } catch (e) {
      absoluteUrl = targetPath;
    }

    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          command: 'navigateToRoute',
          url: absoluteUrl,
          displayUrl: absoluteUrl
        }, '*');
        return;
      } catch (e) { /* fall through */ }
    }

    window.location.href = targetPath;
  }

  function stashReportForRoadmap(report) {
    if (!report || typeof report !== 'object') return false;
    try {
      sessionStorage.setItem('sb_audit_report', JSON.stringify(report));
      return true;
    } catch (e) {
      return false;
    }
  }

  function notifyUrlFromBase(notifyBase) {
    var base = String(notifyBase || '').replace(/\/+$/, '');
    if (!base) return null;
    var hostRoot = base.replace(/\/api\/?$/, '');
    return hostRoot + '/api/notify';
  }

  function getNotifyBase() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('sb_notify_base') || sessionStorage.getItem('sb_notify_base') || '';
    } catch (e) {
      return '';
    }
  }

  function notifyVSCode(entry) {
    if (!entry || typeof entry.type !== 'string') return;

    if (window.parent && window.parent !== window) {
      try {
        if (entry.type === 'downloadComplete' && entry.payload && entry.payload.filename) {
          window.parent.postMessage({
            command: 'downloadComplete',
            filename: entry.payload.filename,
            filePath: entry.payload.filePath || ''
          }, '*');
        }
      } catch (e) { /* ignore */ }
    }

    var notifyBase = getNotifyBase();
    if (!notifyBase || !window.fetch) return;
    var url = notifyUrlFromBase(notifyBase);
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(function (err) {
      // HTTPS pages cannot fetch local HTTP endpoints due to mixed-content rules.
      // Fall back to a tiny image beacon because passive mixed content is usually allowed.
      try {
        var payload = entry.payload || {};
        var beaconUrl = url.replace(/\/api\/notify\/?$/, '/api/notify/beacon')
          + '?type=' + encodeURIComponent(entry.type)
          + '&payload=' + encodeURIComponent(JSON.stringify(payload));
        var img = new Image();
        img.src = beaconUrl;
      } catch (beaconErr) { /* ignore */ }
      console.warn('[vscode-notify-bridge] POST to /api/notify failed, tried image beacon:', err && err.message ? err.message : err);
    });
  }

  window.notifyDownloadComplete = function (filename, filePath) {
    if (typeof filename !== 'string' || !filename) return;
    var pseudoPath = filePath || ('browser://' + filename + '?t=' + Date.now() + '.' + (++_downloadNotifyId));
    notifyVSCode({
      type: 'downloadComplete',
      payload: { filename: filename, filePath: pseudoPath }
    });
  };

  window.navigateEmbeddedRoute = navigateEmbeddedRoute;
  window.stashReportForRoadmap = stashReportForRoadmap;
  window.buildEmbeddedUrl = buildEmbeddedUrl;

  persistEmbedParams();
})();
