/**
 * @module notify
 *
 * Browser-side notification helpers for the VS Code: extension's local bridge.
 */

import { apiBaseUrl, apiUrl } from './url.js';

let _notifyQueue = [];
let _notifyTimer = null;
let _downloadNotifyId = 0;

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
        payload: { filename, filePath: pseudoPath }
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
    notifyVSCode({
        type: 'setAuthState',
        payload: {
            signedIn: signedIn === true,
            tier: tier || '',
            token: token || '',
            isAdmin: isAdmin === true
        }
    });
}

function _isLocalhost() {
    if (typeof window === 'undefined' || !window.location) return false;
    return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}
function _postNotify(entry) {
    if (typeof window === 'undefined' || !window.fetch) {
        return;
    }
    let url = apiUrl('/api/notify');
    let notifyBase = null;
    try {
        const params = new URLSearchParams(window.location.search);
        notifyBase = params.get('sb_notify_base');
        if (notifyBase) {
            url = notifyBase.replace(/\/+$/, '') + '/notify';
        }
    }
    catch (_a) { /* ignore malformed bridge URL */ }
    if (!notifyBase && apiBaseUrl() === '/') {
        return;
    }
    try {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        }).then((res) => {
            if (!res.ok) {
                console.warn('[notifyVSCode] /api/notify returned', res.status, url);
            }
        }).catch((err) => {
            console.warn('[notifyVSCode] /api/notify unreachable:', err && err.message ? err.message : err, url);
        });
    }
    catch (_a) {
        // Ignore serialization/fetch errors.
    }
}
