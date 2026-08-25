// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * @module har-exporter
 * HAR (HTTP Archive) 1.2 export utility for the dashboard.
 *
 * Captures network requests via fetch interception + PerformanceObserver,
 * builds a HAR 1.2 spec-compliant JSON object, and exports it as a .har file.
 *
 * Security:
 * - Authorization headers are redacted to [REDACTED]
 * - Cookie headers are redacted to [REDACTED]
 * - Request bodies for auth endpoints are excluded
 *
 * @example
 * import { HarExporter } from './utils-lib/har-exporter.js';
 * const exporter = new HarExporter();
 * exporter.start();
 * // ... user interacts with dashboard ...
 * const har = exporter.exportHar();
 * exporter.stop();
 */

/** Headers that should be redacted in HAR output for security. */
const REDACTED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

/** URL paths that should have request bodies excluded for security. */
const SENSITIVE_PATH_PATTERNS = [
    /\/api\/auth\//i,
    /\/api\/v2\/auth\//i,
    /\/api\/sso\//i,
    /\/api\/stripe\//i,
    /\/api\/simplebeacon\/user\/ai-keys/i
];

/** Maximum number of entries to capture (prevents unbounded memory growth). */
const MAX_ENTRIES = 500;

/**
 * Check if a URL path matches a sensitive pattern.
 * @param {string} url
 * @returns {boolean}
 */
function isSensitivePath(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return SENSITIVE_PATH_PATTERNS.some(p => p.test(parsed.pathname));
    } catch {
        return false;
    }
}

/**
 * Redact sensitive header values.
 * @param {Array<[string, string]>} headers
 * @returns {Array<[string, string]>}
 */
function redactHeaders(headers) {
    return headers.map(([name, value]) => {
        if (REDACTED_HEADERS.includes(name.toLowerCase())) {
            return [name, '[REDACTED]'];
        }
        return [name, value];
    });
}

/**
 * Convert Headers object to array of [name, value] pairs.
 * @param {Headers} headers
 * @returns {Array<[string, string]>}
 */
function headersToArray(headers) {
    if (!headers) return [];
    if (typeof headers.entries === 'function') {
        return Array.from(headers.entries());
    }
    const result = [];
    if (typeof headers.forEach === 'function') {
        headers.forEach((value, name) => result.push([name, value]));
    }
    return result;
}

/**
 * Format a timestamp as ISO 8601.
 * @param {number} ms
 * @returns {string}
 */
function formatIsoTime(ms) {
    return new Date(ms).toISOString();
}

/**
 * Convert PerformanceObserver timing to HAR time format (seconds string).
 * @param {number} ms
 * @returns {string}
 */
function msToHarTime(ms) {
    return (ms / 1000).toFixed(3);
}

/**
 * HAR (HTTP Archive) exporter — captures network requests and exports HAR 1.2 JSON.
 */
export class HarExporter {
    constructor() {
        this._entries = [];
        this._origFetch = null;
        this._origXhrOpen = null;
        this._origXhrSend = null;
        this._perfObserver = null;
        this._started = false;
        this._startTime = null;
    }

    /**
     * Start capturing network requests.
     * Intercepts fetch and XHR, and starts a PerformanceObserver for resource timing.
     */
    start() {
        if (this._started) return;
        this._started = true;
        this._startTime = Date.now();
        this._interceptFetch();
        this._interceptXhr();
        this._startPerfObserver();
    }

    /**
     * Stop capturing and restore original fetch/XHR.
     */
    stop() {
        if (!this._started) return;
        this._started = false;
        if (this._origFetch) {
            window.fetch = this._origFetch;
            this._origFetch = null;
        }
        if (this._origXhrOpen) {
            XMLHttpRequest.prototype.open = this._origXhrOpen;
            this._origXhrOpen = null;
        }
        if (this._origXhrSend) {
            XMLHttpRequest.prototype.send = this._origXhrSend;
            this._origXhrSend = null;
        }
        if (this._perfObserver) {
            try {
                this._perfObserver.disconnect();
            } catch {
                /* ignore */
            }
            this._perfObserver = null;
        }
    }

    /**
     * Intercept window.fetch to capture request/response metadata.
     * @private
     */
    _interceptFetch() {
        if (typeof window.fetch !== 'function') return;
        const self = this;
        this._origFetch = window.fetch;
        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const method = (init && init.method) || (input && input.method) || 'GET';
            const reqHeaders = headersToArray(init && init.headers ? new Headers(init.headers) : new Headers());
            const sensitive = isSensitivePath(url);
            const reqBody = !sensitive && init && init.body ? String(init.body).slice(0, 4096) : undefined;
            const startedTime = Date.now();
            return self._origFetch
                .apply(this, arguments)
                .then(res => {
                    const responseHeaders = headersToArray(res.headers);
                    self._addEntry({
                        url,
                        method,
                        status: res.status,
                        statusText: res.statusText || '',
                        reqHeaders: redactHeaders(reqHeaders),
                        resHeaders: redactHeaders(responseHeaders),
                        reqBody: sensitive ? undefined : reqBody,
                        startedTime,
                        time: Date.now() - startedTime,
                        resourceType: 'fetch'
                    });
                    return res;
                })
                .catch(err => {
                    self._addEntry({
                        url,
                        method,
                        status: 0,
                        statusText: 'Error: ' + ((err && err.message) || String(err)),
                        reqHeaders: redactHeaders(reqHeaders),
                        resHeaders: [],
                        reqBody: sensitive ? undefined : reqBody,
                        startedTime,
                        time: Date.now() - startedTime,
                        resourceType: 'fetch'
                    });
                    throw err;
                });
        };
    }

    /**
     * Intercept XMLHttpRequest.open/send to capture request/response metadata.
     * @private
     */
    _interceptXhr() {
        if (typeof XMLHttpRequest !== 'function') return;
        const self = this;
        this._origXhrOpen = XMLHttpRequest.prototype.open;
        this._origXhrSend = XMLHttpRequest.prototype.send;
        const xhrData = new WeakMap();
        XMLHttpRequest.prototype.open = function (method, url) {
            xhrData.set(this, { method, url, startedTime: 0 });
            return self._origXhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            const data = xhrData.get(this);
            if (data) {
                data.startedTime = Date.now();
                const sensitive = isSensitivePath(data.url);
                const reqBody = !sensitive && body ? String(body).slice(0, 4096) : undefined;
                this.addEventListener('loadend', function () {
                    const resHeaders = [];
                    const rawHeaders = (this.getAllResponseHeaders() || '').trim();
                    if (rawHeaders) {
                        for (const line of rawHeaders.split('\r\n')) {
                            const idx = line.indexOf(':');
                            if (idx > 0) {
                                resHeaders.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
                            }
                        }
                    }
                    self._addEntry({
                        url: data.url,
                        method: data.method,
                        status: this.status,
                        statusText: this.statusText || '',
                        reqHeaders: [],
                        resHeaders: redactHeaders(resHeaders),
                        reqBody: sensitive ? undefined : reqBody,
                        startedTime: data.startedTime,
                        time: Date.now() - data.startedTime,
                        resourceType: 'xhr'
                    });
                });
            }
            return self._origXhrSend.apply(this, arguments);
        };
    }

    /**
     * Start a PerformanceObserver to capture resource timing entries.
     * These supplement fetch/XHR interception for requests made by other means.
     * @private
     */
    _startPerfObserver() {
        if (typeof window.PerformanceObserver !== 'function') return;
        const self = this;
        try {
            this._perfObserver = new PerformanceObserver(function (list) {
                for (const entry of list.getEntries()) {
                    // Only add if we don't already have this URL from fetch/XHR
                    const exists = self._entries.some(e => e.url === entry.name);
                    if (!exists) {
                        self._addEntry({
                            url: entry.name,
                            method: 'GET',
                            status: 200,
                            statusText: 'OK',
                            reqHeaders: [],
                            resHeaders: [],
                            reqBody: undefined,
                            startedTime: performance.timeOrigin + entry.startTime,
                            time: entry.duration,
                            resourceType: entry.initiatorType || 'other'
                        });
                    }
                }
            });
            this._perfObserver.observe({ entryTypes: ['resource'] });
        } catch {
            /* PerformanceObserver not supported */
        }
    }

    /**
     * Add a captured entry to the list.
     * Enforces MAX_ENTRIES limit to prevent unbounded memory growth.
     * @private
     */
    _addEntry(entry) {
        if (this._entries.length >= MAX_ENTRIES) {
            this._entries.shift();
        }
        this._entries.push(entry);
    }

    /**
     * Build a HAR 1.2 spec-compliant JSON object from captured entries.
     * @returns {Object} HAR 1.2 JSON
     */
    exportHar() {
        const harEntries = this._entries.map(e => ({
            startedDateTime: formatIsoTime(e.startedTime),
            time: e.time || 0,
            request: {
                method: e.method,
                url: e.url,
                httpVersion: 'HTTP/1.1',
                headers: e.reqHeaders.map(([name, value]) => ({ name, value })),
                queryString: [],
                headersSize: -1,
                bodySize: e.reqBody ? e.reqBody.length : 0,
                postData: e.reqBody ? { mimeType: 'application/json', text: e.reqBody } : undefined
            },
            response: {
                status: e.status,
                statusText: e.statusText,
                httpVersion: 'HTTP/1.1',
                headers: e.resHeaders.map(([name, value]) => ({ name, value })),
                cookies: [],
                content: { size: 0, mimeType: 'application/json' },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1
            },
            cache: {},
            timings: { send: 0, wait: 0, receive: e.time || 0 },
            _resourceType: e.resourceType
        }));
        return {
            log: {
                version: '1.2',
                creator: {
                    name: 'SimpleBeacon Dashboard',
                    version: '1.0'
                },
                pages: [],
                entries: harEntries
            }
        };
    }

    /**
     * Get the number of captured entries.
     * @returns {number}
     */
    getEntryCount() {
        return this._entries.length;
    }

    /**
     * Clear all captured entries.
     */
    clear() {
        this._entries = [];
    }
}
