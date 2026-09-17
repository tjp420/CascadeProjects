/**
 * Stripe Checkout return handling for certificate-upload.html.
 * Browser + Node. Does not upload scan reports.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CertificateSession = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    var SESSION_ID_RE = /^cs_(test_|live_)?[A-Za-z0-9]{8,200}$/;

    function isStripeCheckoutSessionId(value) {
        return typeof value === 'string' && SESSION_ID_RE.test(value);
    }

    function isHydratableLicenseToken(token) {
        if (typeof token !== 'string') return false;
        var trimmed = token.trim();
        if (trimmed.length < 20 || trimmed.length > 4096) return false;
        if (trimmed.indexOf('.') === -1) return false;
        if (/[<>\s]/.test(trimmed)) return false;
        return true;
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    async function fetchSessionToken(apiBase, sessionId, options) {
        var opts = options || {};
        if (!isStripeCheckoutSessionId(sessionId)) {
            return { ok: false, reason: 'invalid_session_id' };
        }
        var attempts = typeof opts.attempts === 'number' ? opts.attempts : 5;
        var delays = opts.delaysMs || [400, 800, 1600, 2400];
        var fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
        if (!fetchImpl) {
            return { ok: false, reason: 'no_fetch' };
        }
        var base = typeof apiBase === 'string' ? apiBase : '';
        var url = base + '/api/session-token/' + encodeURIComponent(sessionId);
        var lastReason = 'unreachable';
        for (var i = 0; i < attempts; i++) {
            try {
                var controller = typeof AbortController === 'function' ? new AbortController() : null;
                var timer =
                    controller &&
                    setTimeout(function () {
                        controller.abort();
                    }, opts.timeoutMs || 8000);
                var res = await fetchImpl(url, {
                    method: 'GET',
                    credentials: 'include',
                    signal: controller ? controller.signal : undefined
                });
                if (timer) clearTimeout(timer);
                if (res.status === 400) {
                    return { ok: false, reason: 'invalid_session_id' };
                }
                if (res.ok) {
                    var data = await res.json().catch(function () {
                        return {};
                    });
                    if (data && data.success && isHydratableLicenseToken(data.token)) {
                        return { ok: true, token: String(data.token).trim() };
                    }
                    return { ok: false, reason: 'missing_token' };
                }
                lastReason = res.status === 404 ? 'not_ready' : 'http_' + res.status;
                if (res.status !== 404 && res.status < 500) {
                    return { ok: false, reason: lastReason };
                }
            } catch (_err) {
                lastReason = 'network';
            }
            if (i < attempts - 1) {
                await sleep(delays[Math.min(i, delays.length - 1)]);
            }
        }
        return { ok: false, reason: lastReason };
    }

    return {
        isStripeCheckoutSessionId: isStripeCheckoutSessionId,
        isHydratableLicenseToken: isHydratableLicenseToken,
        fetchSessionToken: fetchSessionToken
    };
});
