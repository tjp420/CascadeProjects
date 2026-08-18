/**

 * Site-wide free gate-scan token bootstrap.

 * Issues a device-bound guest token for anyone without a paid license.

 * Tokens are upgradeable via checkout + /api/token/upgrade.

 */

(function () {

    'use strict';



    var STORAGE_KEYS = ['sb-token', 'simplebeacon_token', 'cascadeAuthToken'];

    var DEVICE_KEY = 'sb_device_id';

    var FREE_TIERS = ['guest', 'community', 'sandbox', 'instant', 'free', 'developer', 'starter', ''];

    var guestPromise = null;



    function decodeJwtPayload(token) {

        if (!token || typeof token !== 'string') return null;

        var parts = token.split('.');

        if (parts.length !== 2 && parts.length !== 3) return null;

        var payloadB64 = parts.length === 2 ? parts[0] : parts[1];

        try {

            var base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');

            var pad = base64.length % 4;

            if (pad) base64 += '='.repeat(4 - pad);

            return JSON.parse(atob(base64));

        } catch (_) {

            return null;

        }

    }



    function isExpired(token) {

        var p = decodeJwtPayload(token);

        return !!(p && p.exp && p.exp * 1000 < Date.now());

    }



    function isPaidToken(token) {

        var p = decodeJwtPayload(token);

        if (!p) return false;

        var tier = String(p.tier || p.product || '').toLowerCase();

        return tier && FREE_TIERS.indexOf(tier) === -1;

    }



    function getStoredToken() {

        for (var i = 0; i < STORAGE_KEYS.length; i++) {

            var t = localStorage.getItem(STORAGE_KEYS[i]);

            if (t && t.includes('.') && !isExpired(t)) return t;

        }

        return '';

    }



    function getDeviceId() {

        try {

            if (window.TokenFileSystem && typeof window.TokenFileSystem.getDeviceId === 'function') {

                return window.TokenFileSystem.getDeviceId();

            }

        } catch (_) {}

        var id = localStorage.getItem(DEVICE_KEY);

        if (!id) {

            id = 'sb-dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

            localStorage.setItem(DEVICE_KEY, id);

        }

        return id;

    }



    function persistToken(token, meta, options) {

        var opts = options || {};

        if (!token) return;

        if (!opts.paid && typeof window.SbAuth !== 'undefined') {

            if (typeof window.SbAuth.restoreFromSession === 'function') window.SbAuth.restoreFromSession();

            if (typeof window.SbAuth.isAccountSignedIn === 'function' && window.SbAuth.isAccountSignedIn()) return;

        }

        var tier = (meta && meta.tier) || (opts.paid ? 'pro' : 'guest');

        var existingUser = null;

        if (typeof window.SbAuth !== 'undefined' && typeof window.SbAuth.getUserRecord === 'function') {

            existingUser = window.SbAuth.getUserRecord();

        }

        localStorage.setItem('sb-token', token);

        localStorage.setItem('simplebeacon_token', token);

        if (!existingUser || !existingUser.email) {

            localStorage.setItem('cascadeAuthToken', token);

        }

        localStorage.setItem('sb-upgrade-token', token);

        var userPayload = {

            plan: tier,

            tier: tier,

            email: (meta && (meta.userEmail || meta.email)) || (existingUser && existingUser.email) || null,

            upgradeable: !opts.paid

        };

        if (existingUser && existingUser.email) {

            userPayload.email = existingUser.email;

            if (existingUser.plan) userPayload.plan = existingUser.plan;

            if (existingUser.tier) userPayload.tier = existingUser.tier;

            if (existingUser.role) userPayload.role = existingUser.role;

        }

        localStorage.setItem('sb-user', JSON.stringify(userPayload));

        var lic = document.getElementById('licenseToken');

        if (lic && (opts.forceInput || !lic.value.trim())) {

            lic.value = token;

            try { lic.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}

        }

        if (typeof window.applyProductFromToken === 'function') {

            try { window.applyProductFromToken(token); } catch (_) {}

        }

        if (typeof window.updateAuthNav === 'function') {

            try { window.updateAuthNav(); } catch (_) {}

        }

        if (typeof window.SbAuth !== 'undefined' && typeof window.SbAuth.syncAuditAudienceUi === 'function') {

            try { window.SbAuth.syncAuditAudienceUi(); } catch (_) {}

        }

    }



    function persistGuestToken(token, meta) {

        if (typeof window.SbAuth !== 'undefined' && typeof window.SbAuth.isAccountSignedIn === 'function' && window.SbAuth.isAccountSignedIn()) {

            return;

        }

        persistToken(token, meta, { paid: false });

    }



    function applyLicenseToken(token, meta) {

        persistToken(token, meta, { paid: true, forceInput: true });

    }



    function ensureGuestToken(options) {

        var opts = options || {};

        if (typeof window.SbAuth !== 'undefined' && typeof window.SbAuth.isAccountSignedIn === 'function' && window.SbAuth.isAccountSignedIn()) {

            var accountToken = localStorage.getItem('sb-session') || localStorage.getItem('sb-token') || localStorage.getItem('simplebeacon_token') || '';

            if (accountToken && accountToken.indexOf('.') !== -1) {

                return Promise.resolve({ token: accountToken, cached: true, account: true });

            }

        }

        var existing = getStoredToken();

        if (existing && isPaidToken(existing)) {

            return Promise.resolve({ token: existing, cached: true, paid: true });

        }

        if (existing && !opts.force && !isExpired(existing)) {

            localStorage.setItem('sb-upgrade-token', existing);

            return Promise.resolve({ token: existing, cached: true });

        }

        if (guestPromise && !opts.force) return guestPromise;



        guestPromise = fetch('/api/tokens/guest', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ guestId: getDeviceId() })

        })

            .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })

            .then(function (_ref) {

                var res = _ref.res;

                var data = _ref.data;

                if (!res.ok || !data.success || !data.token) {

                    throw new Error(data.error || data.message || 'Guest token request failed');

                }

                if (typeof window.SbAuth !== 'undefined' && typeof window.SbAuth.isAccountSignedIn === 'function' && window.SbAuth.isAccountSignedIn()) {

                    return { token: data.token, cached: !!data.cached, meta: data, skipped: 'account-signed-in' };

                }

                persistGuestToken(data.token, data);

                return { token: data.token, cached: !!data.cached, meta: data };

            })

            .catch(function (err) {

                guestPromise = null;

                throw err;

            });



        return guestPromise;

    }



    function stripCheckoutParams() {

        try {

            var u = new URL(window.location.href);

            if (!u.searchParams.has('session_id') && !u.searchParams.has('token')) return;

            u.searchParams.delete('session_id');

            u.searchParams.delete('token');

            u.searchParams.delete('code');

            window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);

        } catch (_) {}

    }



    function handleCheckoutSessionReturn() {

        var params = new URLSearchParams(window.location.search);

        var sessionId = params.get('session_id');

        if (!sessionId) return Promise.resolve(null);



        var apiBase = (window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.apiBase) || '';

        return fetch(apiBase + '/api/session-token/' + encodeURIComponent(sessionId))

            .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })

            .then(function (_ref) {

                var res = _ref.res;

                var data = _ref.data;

                if (!res.ok || !data.success || !data.token) return null;

                applyLicenseToken(data.token, data);

                stripCheckoutParams();

                var banner = document.getElementById('paymentSuccessBanner');

                if (banner) banner.classList.add('is-visible');

                if (typeof window.showToast === 'function') {

                    window.showToast('License applied — you are ready to generate your certificate', 'success');

                }

                return { token: data.token, meta: data };

            })

            .catch(function () { return null; });

    }



    window.getGuestDeviceId = getDeviceId;

    if (!window.ensureGuestToken) {

        window.ensureGuestToken = ensureGuestToken;

    }

    window.applyLicenseToken = applyLicenseToken;

    window.getUpgradeToken = function () {

        return localStorage.getItem('sb-upgrade-token')

            || localStorage.getItem('sb-token')

            || localStorage.getItem('simplebeacon_token')

            || '';

    };



    function boot() {

        if (window.SB_SKIP_GUEST_TOKEN === true) return;

        window.__guestBootstrapLoaded = true;



        handleCheckoutSessionReturn().then(function (paid) {

            if (paid && paid.token) return;

            var existing = getStoredToken();

            if (existing && isPaidToken(existing)) return;

            return ensureGuestToken().catch(function () { /* silent */ });

        });

    }



    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', boot);

    } else {

        boot();

    }

})();


