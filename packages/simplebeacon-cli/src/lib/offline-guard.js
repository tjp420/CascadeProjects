'use strict';

/**
 * Offline Guard — hardens the zero-custody boundary by intercepting all
 * outbound network escape paths when --offline or SIMPLEBEACON_OFFLINE is active.
 *
 * Patched modules:
 *   - http.request / http.get
 *   - https.request / https.get
 *   - globalThis.fetch (when available)
 *   - net.connect / net.createConnection (raw TCP)
 *   - dns.lookup / dns.resolve (DNS resolution)
 *
 * Localhost (127.0.0.1, ::1, localhost) connections are ALLOWED in offline
 * mode so local LLM runtimes like Ollama continue to work. Only non-local
 * outbound connections are blocked.
 *
 * Usage:
 *   const guard = createOfflineGuard({ offline: true });
 *   // ... run scan ...
 *   guard.assertNoViolations();
 *   guard.dispose();
 *
 * Or via environment activation:
 *   activateOfflineGuard(); // checks SIMPLEBEACON_OFFLINE / --offline env
 *   deactivateOfflineGuard();
 */

const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0']);

/**
 * Extract host/target from various http.request argument shapes.
 * @returns {{host: string, target: string}}
 */
function extractTarget(args) {
    const first = args[0];
    if (typeof first === 'string') {
        try {
            const parsed = new URL(first);
            return { host: parsed.hostname, target: first };
        } catch {
            return { host: 'unknown', target: first };
        }
    }
    if (first && typeof first === 'object') {
        if (first.href) return { host: first.hostname || 'unknown', target: first.href };
        const host = first.hostname || first.host || 'unknown';
        const protocol = first.protocol || 'http:';
        const port = first.port ? `:${first.port}` : '';
        return { host, target: `${protocol}//${host}${port}` };
    }
    return { host: 'unknown', target: 'unknown' };
}

/**
 * Check if a host is local (loopback).
 */
function isLocalhost(host) {
    if (!host || typeof host !== 'string') return false;
    return LOCAL_HOSTS.has(host.toLowerCase()) || host.endsWith('.localhost');
}

/**
 * Create an offline guard that patches all network escape paths.
 *
 * @param {Object} options
 * @param {boolean} [options.offline=false] — when true, blocks non-local outbound connections
 * @param {boolean} [options.allowLocalhost=true] — allow loopback connections (Ollama, etc.)
 * @returns {{ offline: boolean, violations: Array, assertNoViolations: Function, dispose: Function }}
 */
function createOfflineGuard(options = {}) {
    const offline = options.offline === true || process.env.SIMPLEBEACON_OFFLINE === '1' || process.env.SIMPLEBEACON_OFFLINE === 'true';
    const _allowLocalhost = options.allowLocalhost !== false;
    const violations = [];

    // Save originals
    const originals = {
        httpRequest: http.request,
        httpGet: http.get,
        httpsRequest: https.request,
        httpsGet: https.get,
        fetch: typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
        netConnect: net.connect,
        netCreateConnection: net.createConnection,
        dnsLookup: dns.lookup,
        dnsResolve: dns.resolve
    };

    function recordViolation(kind, host, target) {
        const entry = { kind, host, target, at: new Date().toISOString() };
        violations.push(entry);
        if (offline && !isLocalhost(host)) {
            const err = new Error(
                `Offline guard blocked ${kind} to ${target} (host: ${host}). ` +
                'Use --offline without network-dependent features, or remove --offline to allow outbound connections.'
            );
            err.code = 'OFFLINE_GUARD_BLOCKED';
            err.violation = entry;
            throw err;
        }
    }

    // --- Patch http.request ---
    http.request = function patchedHttpRequest(...args) {
        const { host, target } = extractTarget(args);
        recordViolation('http.request', host, target);
        return originals.httpRequest.apply(this, args);
    };

    // --- Patch http.get ---
    http.get = function patchedHttpGet(...args) {
        const { host, target } = extractTarget(args);
        recordViolation('http.get', host, target);
        return originals.httpGet.apply(this, args);
    };

    // --- Patch https.request ---
    https.request = function patchedHttpsRequest(...args) {
        const { host, target } = extractTarget(args);
        recordViolation('https.request', host, target);
        return originals.httpsRequest.apply(this, args);
    };

    // --- Patch https.get ---
    https.get = function patchedHttpsGet(...args) {
        const { host, target } = extractTarget(args);
        recordViolation('https.get', host, target);
        return originals.httpsGet.apply(this, args);
    };

    // --- Patch globalThis.fetch ---
    if (originals.fetch) {
        globalThis.fetch = async function patchedFetch(input, init) {
            let host = 'unknown';
            let target = 'fetch:unknown';
            if (typeof input === 'string') {
                try {
                    const parsed = new URL(input);
                    host = parsed.hostname;
                    target = input;
                } catch {
                    target = input;
                }
            } else if (input && typeof input === 'object' && input.url) {
                try {
                    const parsed = new URL(input.url);
                    host = parsed.hostname;
                    target = input.url;
                } catch {
                    target = input.url;
                }
            } else if (input && typeof input === 'object' && input.href) {
                host = input.hostname || 'unknown';
                target = input.href;
            }
            recordViolation('fetch', host, target);
            return originals.fetch(input, init);
        };
    }

    // --- Patch net.connect / net.createConnection ---
    net.connect = function patchedNetConnect(...args) {
        const opts = typeof args[0] === 'object' ? args[0] : {};
        const host = opts.host || opts.hostname || (typeof args[0] === 'number' ? 'unknown' : 'unknown');
        const port = opts.port || (typeof args[0] === 'number' ? args[0] : '?');
        recordViolation('net.connect', host, `net:${host}:${port}`);
        return originals.netConnect.apply(this, args);
    };

    net.createConnection = function patchedNetCreateConnection(...args) {
        const opts = typeof args[0] === 'object' ? args[0] : {};
        const host = opts.host || opts.hostname || 'unknown';
        const port = opts.port || (typeof args[0] === 'number' ? args[0] : '?');
        recordViolation('net.createConnection', host, `net:${host}:${port}`);
        return originals.netCreateConnection.apply(this, args);
    };

    // --- Patch dns.lookup / dns.resolve ---
    dns.lookup = function patchedDnsLookup(hostname, ...rest) {
        const host = typeof hostname === 'string' ? hostname : 'unknown';
        recordViolation('dns.lookup', host, `dns:lookup:${host}`);
        return originals.dnsLookup.call(this, hostname, ...rest);
    };

    dns.resolve = function patchedDnsResolve(hostname, ...rest) {
        const host = typeof hostname === 'string' ? hostname : 'unknown';
        recordViolation('dns.resolve', host, `dns:resolve:${host}`);
        return originals.dnsResolve.call(this, hostname, ...rest);
    };

    return {
        offline,
        get violations() {
            return violations.slice();
        },
        /**
         * Assert that no non-local network violations occurred.
         * Throws if any non-local outbound connection was attempted.
         */
        assertNoViolations() {
            const nonLocal = violations.filter(v => !isLocalhost(v.host));
            if (nonLocal.length > 0) {
                const sample = nonLocal[0];
                throw new Error(
                    `Offline guarantee violated: ${nonLocal.length} non-local network call(s) detected. ` +
                    `First: ${sample.kind} → ${sample.target} (host: ${sample.host})`
                );
            }
        },
        /**
         * Restore all patched modules to their original state.
         */
        dispose() {
            http.request = originals.httpRequest;
            http.get = originals.httpGet;
            https.request = originals.httpsRequest;
            https.get = originals.httpsGet;
            if (originals.fetch) {
                globalThis.fetch = originals.fetch;
            }
            net.connect = originals.netConnect;
            net.createConnection = originals.netCreateConnection;
            dns.lookup = originals.dnsLookup;
            dns.resolve = originals.dnsResolve;
        }
    };
}

// --- Module-level singleton for env-based activation ---
let activeGuard = null;

/**
 * Activate the offline guard based on environment variables.
 * Checks SIMPLEBEACON_OFFLINE and SB_OFFLINE.
 * @returns {Object|null} The guard instance, or null if not activated.
 */
function activateOfflineGuard() {
    if (activeGuard) return activeGuard;
    const envOffline = process.env.SIMPLEBEACON_OFFLINE === '1' ||
                       process.env.SIMPLEBEACON_OFFLINE === 'true' ||
                       process.env.SB_OFFLINE === '1' ||
                       process.env.SB_OFFLINE === 'true';
    if (!envOffline) return null;
    activeGuard = createOfflineGuard({ offline: true });
    return activeGuard;
}

/**
 * Deactivate and dispose the module-level offline guard.
 */
function deactivateOfflineGuard() {
    if (activeGuard) {
        activeGuard.dispose();
        activeGuard = null;
    }
}

/**
 * Get the active guard (if any).
 * @returns {Object|null}
 */
function getActiveGuard() {
    return activeGuard;
}

module.exports = {
    createOfflineGuard,
    activateOfflineGuard,
    deactivateOfflineGuard,
    getActiveGuard,
    isLocalhost
};
