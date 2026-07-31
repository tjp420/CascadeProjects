// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * @module notify
 *
 * Browser-side notification helpers for the VS Code: extension's local bridge.
 */

import { apiBaseUrl, apiUrl } from './url.js';
import { fetchApi } from '../lib/recoverable-fetch.js';

let _notifyQueue = [];
let _notifyTimer = null;
let _downloadNotifyId = 0;
let _notifyDisabledUntil = 0;

/**
 * Best-effort POST a generic event to the local data-server /api/notify bridge.
 * This lets the dashboard communicate with the VS Code: extension when running
 * in an external browser or Simple Browser webview (where window.acquireVsCodeApi
 * is unavailable and direct postMessage cannot be used).
 *
 * The call is fire-and-forget; failures are silently ignored.
 *
 * @param {{type:string,payload?:any,ts?:number}} entry
 */
export function notifyVSCode(entry) {
  if (!entry || typeof entry.type !== 'string') {
    return;
  }
  _notifyQueue.push({ ...entry, ts: entry.ts || Date.now() });
  if (_notifyTimer) {
    return;
  }
  _notifyTimer = setTimeout(() => {
    const batch = _notifyQueue;
    _notifyQueue = [];
    _notifyTimer = null;
    for (const item of batch) {
      _postNotify(item);
    }
  }, 0);
}

/**
 * Best-effort POST a download-complete event to the extension's notify bridge.
 *
 * @param {string} filename
 * @param {string} [filePath]
 */
export function notifyDownloadComplete(filename, filePath) {
  if (typeof filename !== 'string' || !filename) {
    return;
  }
  // Browser downloads don't know the final OS save path, so generate a unique
  // pseudo-path so the VS Code: sidebar keeps each download as a distinct entry
  // even when the OS appends (1), (2), etc.
  const pseudoPath = filePath || `browser://${filename}?t=${Date.now()}.${++_downloadNotifyId}`;
  notifyVSCode({
    type: 'downloadComplete',
    payload: { filename, filePath: pseudoPath },
  });
}

/**
 * Best-effort POST an auth-state change to the extension's notify bridge.
 *
 * @param {boolean} signedIn
 * @param {string} [tier]
 * @param {string} [token]
 * @param {boolean} [isAdmin]
 */
export function notifyAuthState(signedIn, tier, token, isAdmin) {
  // Never send the actual JWT/license token through the notify bridge. The extension
  // only needs to know sign-in state, tier, and admin flag to update the sidebar UI.
  notifyVSCode({
    type: 'setAuthState',
    payload: {
      signedIn: signedIn === true,
      tier: tier || '',
      isAdmin: isAdmin === true,
    },
  });
}

function _isLocalhost() {
  if (typeof window === 'undefined' || !window.location) return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}
function _notifyUrlFromBase(notifyBase) {
  const base = String(notifyBase || '').replace(/\/+$/, '');
  if (!base) return null;
  const hostRoot = base.replace(/\/api\/?$/, '');
  return `${hostRoot}/api/notify`;
}
function _isHostedHttps() {
  if (typeof window === 'undefined' || !window.location) return false;
  if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return false;
  return window.location.protocol === 'https:';
}
function _isLoopbackNotifyUrl(url) {
  try {
    const parsed = new URL(String(url || ''), window.location.href);
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);
  } catch (_a) {
    return false;
  }
}
function _redactPayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_redactPayload);
  const out = {};
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    if (
      lower === 'token' ||
      lower === 'password' ||
      lower === 'apikey' ||
      lower === 'api_key' ||
      lower === 'secret'
    ) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = _redactPayload(obj[key]);
    }
  }
  return out;
}
function _postNotifyBeacon(url, entry) {
  try {
    const payload = _redactPayload(entry.payload || {});
    const beaconUrl =
      String(url).replace(/\/api\/notify\/?$/, '/api/notify/beacon') +
      '?type=' +
      encodeURIComponent(entry.type) +
      '&payload=' +
      encodeURIComponent(JSON.stringify(payload));
    const img = new Image();
    img.src = beaconUrl;
  } catch (_a) {
    /* ignore */
  }
}
function _isIdeIframe() {
  if (typeof window === 'undefined') return false;
  return window.self !== window.top;
}
function _postNotifyViaParent(entry) {
  if (!_isIdeIframe() || !window.parent) return false;
  try {
    if (entry.type === 'setAuthState') {
      const payload = entry.payload || {};
      window.parent.postMessage(
        {
          command: 'setAuthState',
          signedIn: payload.signedIn === true,
          tier: payload.tier || '',
          isAdmin: payload.isAdmin === true,
        },
        '*'
      );
      return true;
    }
    if (entry.type === 'downloadComplete') {
      const payload = entry.payload || {};
      window.parent.postMessage(
        {
          command: 'downloadComplete',
          filename: payload.filename,
          filePath: payload.filePath,
        },
        '*'
      );
      return true;
    }
    window.parent.postMessage(
      {
        command: 'notifyBridge',
        type: entry.type,
        payload: _redactPayload(entry.payload || {}),
      },
      '*'
    );
    return true;
  } catch (_a) {
    return false;
  }
}
function _postNotify(entry) {
  if (_postNotifyViaParent(entry)) {
    return;
  }
  if (typeof window === 'undefined' || !window.fetch) {
    return;
  }
  let url = apiUrl('/api/notify');
  let notifyBase = null;
  try {
    const params = new URLSearchParams(window.location.search);
    notifyBase = params.get('sb_notify_base');
    if (!notifyBase && typeof sessionStorage !== 'undefined') {
      notifyBase = sessionStorage.getItem('sb_notify_base');
    }
    if (notifyBase) {
      url = _notifyUrlFromBase(notifyBase) || url;
    }
  } catch (_a) {
    /* ignore malformed bridge URL */
  }
  if (!notifyBase && apiBaseUrl() === '/') {
    return;
  }
  // Public HTTPS sites cannot reach loopback bridges (Local Network Access). IDE iframes use postMessage.
  if (_isHostedHttps() && _isLoopbackNotifyUrl(url)) {
    return;
  }
  // short-circuit if we recently discovered that notify is unavailable
  if (Date.now() < _notifyDisabledUntil) return;
  (async () => {
    try {
      const resp = await fetchApi(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (resp === null) {
        // network failure — mark disabled briefly to avoid tight retry loops
        _notifyDisabledUntil = Date.now() + 5 * 60 * 1000;
        if (!_isHostedHttps()) _postNotifyBeacon(url, entry);
        return;
      }
      if (!resp.ok) {
        if (resp.status === 404) {
          // Not found — disable further attempts for a while
          _notifyDisabledUntil = Date.now() + 5 * 60 * 1000;
        }
      }
    } catch (err) {}
  })();
}
