/**

 * Shared marketing-site auth: nav sign-in/out for account sessions.

 * Guest scan tokens are issued separately (guest-token-bootstrap.js) and do not count as "signed in".

 */

(function () {

    'use strict';



    var TOKEN_KEYS = [

        'sb-token', 'sb_token', 'cascadeAuthToken', 'cascadeAuthUser',

        'access_token', 'token', 'authToken', 'simplebeacon_token',

        'sb-token-vault', 'sb-account-tokens', 'sb-account-features',

        'sb-user', 'sb_user', 'sb-upgrade-token', 'sb-session'

    ];

    /** JWT storage keys only — excludes user JSON blobs (cascadeAuthUser, sb-user). */

    var SESSION_TOKEN_KEYS = [

        'sb-session', 'cascadeAuthToken', 'sb-token', 'simplebeacon_token',

        'access_token', 'token', 'authToken', 'sb_token', 'sb-upgrade-token'

    ];

    var USER_KEYS = ['sb-user', 'sb_user', 'cascadeAuthUser'];

    var AUTH_BC = 'simplebeacon-auth';

    var FREE_TIERS = ['guest', 'community', 'sandbox', 'instant', 'free', 'developer', 'starter', ''];



    function clearLocalStorageItems(keys) {

        try {

            for (var i = 0; i < keys.length; i++) {

                localStorage.removeItem(keys[i]);

            }

        } catch (_) {}

    }



    function clearCookie(name) {

        document.cookie = name + '=;path=/;max-age=0;SameSite=Lax;';

    }



    function clearCookies(keys) {

        try {

            for (var i = 0; i < keys.length; i++) {

                clearCookie(keys[i]);

            }

        } catch (_) {}

    }



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



    function isJwtExpired(token) {

        var payload = decodeJwtPayload(token);

        return !!(payload && payload.exp && payload.exp * 1000 < Date.now());

    }



    function getCookieVal(name) {

        var m = document.cookie.match('(?:^|; )' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]*)');

        return m ? decodeURIComponent(m[1]) : '';

    }



    function isLikelyJwt(token) {

        if (!token || typeof token !== 'string') return false;

        var parts = token.split('.');

        return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0;

    }



    /** Pull dashboard login cookies into localStorage (audit page does not load authService.js). */

    function syncCrossPortAuth() {

        var i;

        for (i = 0; i < SESSION_TOKEN_KEYS.length; i++) {

            var tKey = SESSION_TOKEN_KEYS[i];

            var tCookie = getCookieVal(tKey);

            if (tCookie && isLikelyJwt(tCookie) && !localStorage.getItem(tKey)) {

                try { localStorage.setItem(tKey, tCookie); } catch (_) {}

            }

        }

        for (i = 0; i < USER_KEYS.length; i++) {

            var uKey = USER_KEYS[i];

            var uCookie = getCookieVal(uKey);

            if (uCookie && uCookie.charAt(0) === '{' && !localStorage.getItem(uKey)) {

                try { localStorage.setItem(uKey, uCookie); } catch (_) {}

            }

        }

    }



    function getStoredToken() {

        for (var i = 0; i < SESSION_TOKEN_KEYS.length; i++) {

            var key = SESSION_TOKEN_KEYS[i];

            var value = localStorage.getItem(key) || getCookieVal(key);

            if (value && isLikelyJwt(value) && !isJwtExpired(value)) {

                return value;

            }

        }

        return '';

    }



    function isGuestJwtPayload(payload) {

        if (!payload) return false;

        if (payload.guestId) return true;

        return String(payload.tier || '').toLowerCase() === 'guest';

    }



    function isGuestJwt(token) {

        return isGuestJwtPayload(decodeJwtPayload(token));

    }



    function findAccountSessionJwt() {

        var keys = ['sb-session', 'cascadeAuthToken', 'sb-token', 'simplebeacon_token', 'access_token', 'token', 'authToken'];

        for (var i = 0; i < keys.length; i++) {

            var token = localStorage.getItem(keys[i]) || getCookieVal(keys[i]) || '';

            if (!isLikelyJwt(token) || isJwtExpired(token)) continue;

            var payload = decodeJwtPayload(token);

            if (!payload || isGuestJwtPayload(payload)) continue;

            if (payload.email || payload.type === 'session' || payload.type === 'license' || payload.type === 'access') {

                if (payload.email || payload.type) return { token: token, payload: payload };

            }

        }

        return null;

    }



    function syncUserStores(user) {

        if (!user) return;

        var json = JSON.stringify(user);

        try {

            localStorage.setItem('sb-user', json);

            localStorage.setItem('cascadeAuthUser', json);

        } catch (_) {}

    }



    function getUserRecord() {

        var best = null;

        for (var i = 0; i < USER_KEYS.length; i++) {

            try {

                var raw = localStorage.getItem(USER_KEYS[i]);

                if (!raw) continue;

                var parsed = JSON.parse(raw);

                if (!parsed) continue;

                if (parsed.email) return parsed;

                if (!best) best = parsed;

            } catch (_) {}

        }

        return best;

    }



    function getUserTier() {

        var parsed = getUserRecord();

        if (parsed) {

            var role = String(parsed.role || '').toLowerCase();

            if (role === 'admin' || role === 'superuser') return 'enterprise';

            var tier = String(parsed.tier || parsed.plan || '').toLowerCase();

            if (tier) return tier;

        }

        var found = findAccountSessionJwt();

        if (found && found.payload) {

            var jwtRole = String(found.payload.role || '').toLowerCase();

            if (jwtRole === 'admin' || jwtRole === 'superuser') return 'enterprise';

            return String(found.payload.tier || found.payload.product || '').toLowerCase();

        }

        return '';

    }



    function hasAnyToken() {

        return !!getStoredToken();

    }



    function isPaidTier() {

        if (isAdminUser()) return true;

        var tier = getUserTier();

        if (tier && FREE_TIERS.indexOf(tier) === -1) return true;

        var token = getStoredToken();

        if (!token) return false;

        var payload = decodeJwtPayload(token);

        if (!payload) return false;

        var tokenTier = String(payload.tier || payload.product || '').toLowerCase();

        return tokenTier && FREE_TIERS.indexOf(tokenTier) === -1;

    }



    /** Nav "signed in" = paid license or email-backed account — not anonymous guest scan token. */

    function isAccountSignedIn() {

        if (isPaidTier()) return true;

        var user = getUserRecord();

        if (user && user.email && !/^token-user@simplebeacon\.ai$/i.test(String(user.email))) return true;

        var found = findAccountSessionJwt();

        if (found && found.payload && found.payload.email) return true;

        return false;

    }



    /** Rebuild sb-user from account session JWT when guest token flow cleared email. */

    function restoreFromSession() {

        var user = getUserRecord();

        var found = findAccountSessionJwt();

        if (user && user.email) {

            if (found) {

                try {

                    if (!localStorage.getItem('sb-session')) localStorage.setItem('sb-session', found.token);

                    var scanToken = localStorage.getItem('sb-token') || '';

                    if (!scanToken || isGuestJwt(scanToken)) localStorage.setItem('sb-token', found.token);

                    var sessionPayload = found.payload;

                    if (sessionPayload) {

                        var merged = Object.assign({}, user);

                        if (sessionPayload.role) merged.role = sessionPayload.role;

                        if (sessionPayload.tier) {

                            merged.tier = sessionPayload.tier;

                            merged.plan = sessionPayload.tier;

                        }

                        if (String(sessionPayload.tier || '').toLowerCase() === 'admin' || String(sessionPayload.role || '').toLowerCase() === 'admin') {

                            merged.role = 'admin';

                            merged.tier = 'admin';

                            merged.plan = 'admin';

                        }

                        syncUserStores(merged);

                        user = merged;

                    }

                } catch (_) {}

            } else {

                syncUserStores(user);

            }

            return false;

        }

        if (!found) return false;

        var payload = found.payload;

        var tier = payload.tier || (user && user.tier) || 'community';

        var merged = {

            email: payload.email,

            tier: tier,

            plan: tier

        };

        if (user && user.name) merged.name = user.name;

        if (user && user.role) merged.role = user.role;

        if (payload.role) merged.role = payload.role;

        try { localStorage.setItem('sb-session', found.token); } catch (_) {}

        syncUserStores(merged);

        return true;

    }



    function issueGuestTokenAfterSignOut() {

        if (typeof window.ensureGuestToken !== 'function') return;

        try {

            window.ensureGuestToken({ force: true }).catch(function () {});

        } catch (_) {}

    }



    function signOut(options) {

        var opts = options || {};

        clearLocalStorageItems(TOKEN_KEYS);

        clearLocalStorageItems(USER_KEYS);

        clearCookies(TOKEN_KEYS);

        clearCookies(USER_KEYS);

        try {

            localStorage.removeItem('simplebeacon_scan_data');

            sessionStorage.clear();

        } catch (_) {}

        try {

            var licenseInput = document.getElementById('licenseToken');

            if (licenseInput) licenseInput.value = '';

            var tokenCard = document.getElementById('tokenStatusCard');

            if (tokenCard) tokenCard.style.display = 'none';

        } catch (_) {}

        try {

            var url = new URL(window.location.href);

            url.searchParams.delete('token');

            url.searchParams.delete('code');

            url.searchParams.delete('session_id');

            window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);

        } catch (_) {}

        try {

            var bc = new BroadcastChannel(AUTH_BC);

            bc.postMessage({ type: 'signed-out' });

            bc.close();

        } catch (_) {}

        updateAuthNav();

        issueGuestTokenAfterSignOut();

        if (!opts.skipReload) {

            window.location.reload();

        }

    }



    function propagateTokenToLinks() {

        try {

            var params = new URLSearchParams(window.location.search);

            var token = params.get('token');

            if (!token) return;

            var links = document.querySelectorAll('.sb-site-nav a, .nav-links a');

            for (var i = 0; i < links.length; i++) {

                var link = links[i];

                var href = link.getAttribute('href') || '';

                if (href.indexOf('#') === -1 && href.indexOf('http') !== 0) {

                    var sep = href.indexOf('?') === -1 ? '?' : '&';

                    link.setAttribute('href', href + sep + 'token=' + encodeURIComponent(token));

                }

            }

        } catch (_) {}

    }



    function isAdminUser() {

        var user = getUserRecord();

        if (user) {

            var role = String(user.role || '').toLowerCase();

            if (role === 'admin' || role === 'superuser') return true;

        }

        var found = findAccountSessionJwt();

        if (found && found.payload) {

            var jwtRole = String(found.payload.role || '').toLowerCase();

            if (jwtRole === 'admin' || jwtRole === 'superuser') return true;

        }

        return false;

    }



    var _auditAudienceKey = '';



    /** Paid/admin audit visitors: hide upsell chrome; guests/free keep marketing. */

    function syncAuditAudienceUi(force) {

        var body = document.body;

        if (!body || !body.classList.contains('audit-page')) return;



        restoreFromSession();

        var paid = isPaidTier();

        var admin = isAdminUser();

        var hideAds = paid || admin;

        var key = (hideAds ? 'paid' : 'guest') + '|' + (isAccountSignedIn() ? 'in' : 'out');

        if (!force && key === _auditAudienceKey) return;

        _auditAudienceKey = key;



        body.classList.toggle('audit-page--signed-in', hideAds);

        body.classList.toggle('audit-page--guest', !hideAds);



        var banner = document.getElementById('simplebeacon-banner');

        if (banner) banner.style.display = hideAds ? 'none' : '';



        if (typeof window.refreshAuditTokenStatus === 'function') {

            try { window.refreshAuditTokenStatus(); } catch (_) {}

        }

    }



    function updateAuthNav() {

        var signinBtn = document.getElementById('nav-signin-btn');

        var signoutBtn = document.getElementById('nav-signout-btn');

        var accountSignedIn = isAccountSignedIn();

        var paid = isPaidTier();

        if (signinBtn) signinBtn.style.display = accountSignedIn ? 'none' : 'inline-block';

        if (signoutBtn) signoutBtn.style.display = accountSignedIn ? 'inline-block' : 'none';

        var pricingLinks = document.querySelectorAll('.sb-nav-more-link[href="/pricing"], .sb-nav-links a[href="/pricing"]');

        for (var i = 0; i < pricingLinks.length; i++) {

            pricingLinks[i].style.display = paid ? 'none' : '';

        }

        syncAuditAudienceUi();

    }



    function bindSignOut() {

        var signoutBtn = document.getElementById('nav-signout-btn');

        if (!signoutBtn) return;

        var clone = signoutBtn.cloneNode(true);

        signoutBtn.parentNode.replaceChild(clone, signoutBtn);

        clone.addEventListener('click', function (e) {

            e.preventDefault();

            if (typeof window.performAuditSignOut === 'function') {

                window.performAuditSignOut();

            } else {

                signOut();

            }

        });

    }



    function openAuthModalOverlay() {

        if (typeof window.openAuditAuthModal === 'function') {

            window.openAuditAuthModal({ mode: 'login' });

            return true;

        }

        var overlay = document.getElementById('auth-modal-overlay');

        if (overlay) {

            overlay.style.display = 'flex';

            overlay.classList.add('active');

            return true;

        }

        var signinOverlay = document.getElementById('signinOverlay');

        if (signinOverlay) {

            signinOverlay.classList.add('active');

            return true;

        }

        return false;

    }



    function bindSignIn() {

        var signinBtn = document.getElementById('nav-signin-btn');

        if (!signinBtn || signinBtn.dataset.sbSiteAuthBound === '1') return;

        signinBtn.dataset.sbSiteAuthBound = '1';

        signinBtn.addEventListener('click', function (e) {

            e.preventDefault();

            if (!openAuthModalOverlay()) {

                window.location.href = '/dashboard/#/signin';

            }

        });

    }



    function initDropdownClose() {

        document.addEventListener('click', function (event) {

            var toggle = document.getElementById('sb-nav-more-toggle');

            if (!toggle || !toggle.checked) return;

            var wrap = toggle.parentNode;

            if (wrap && !wrap.contains(event.target)) toggle.checked = false;

        });

        document.addEventListener('keydown', function (event) {

            if (event.key !== 'Escape') return;

            var toggle = document.getElementById('sb-nav-more-toggle');

            if (toggle) toggle.checked = false;

        });

    }



    function initBroadcast() {

        try {

            var bc = new BroadcastChannel(AUTH_BC);

            bc.onmessage = function (event) {

                if (!event.data) return;

                if (event.data.type === 'signed-out') {

                    clearLocalStorageItems(TOKEN_KEYS);

                    clearLocalStorageItems(USER_KEYS);

                    updateAuthNav();

                    issueGuestTokenAfterSignOut();

                }

                if (event.data.type === 'signed-in') {

                    updateAuthNav();

                }

            };

        } catch (_) {}

    }



    function init() {

        restoreFromSession();

        propagateTokenToLinks();

        bindSignOut();

        bindSignIn();

        initDropdownClose();

        initBroadcast();

        updateAuthNav();

        window.addEventListener('storage', function (event) {

            if (!event.key) return;

            if (TOKEN_KEYS.indexOf(event.key) !== -1 || USER_KEYS.indexOf(event.key) !== -1) {

                updateAuthNav();

            }

        });

    }



    window.SbAuth = {

        signOut: signOut,

        hasAnyToken: hasAnyToken,

        isAccountSignedIn: isAccountSignedIn,

        isPaidTier: isPaidTier,

        restoreFromSession: restoreFromSession,

        getStoredToken: getStoredToken,

        getUserTier: getUserTier,

        getUserRecord: getUserRecord,

        syncCrossPortAuth: syncCrossPortAuth,

        isAdminUser: isAdminUser,

        syncAuditAudienceUi: syncAuditAudienceUi,

        propagateTokenToLinks: propagateTokenToLinks,

        // Legacy aliases (audit page) — no longer block guest tokens

        markSiteSignedOut: function () {},

        isSiteSignedOut: function () { return false; },

        clearSiteSignedOut: function () {},

        markAuditSignedOut: function () {},

        isAuditSignedOut: function () { return false; },

        clearAuditSignedOut: function () {},

        openAuthModal: openAuthModalOverlay

    };

    window.updateAuthNav = updateAuthNav;



    syncCrossPortAuth();

    restoreFromSession();



    // Audit page replaces updateAuthNav — re-sync after full load.

    window.addEventListener('load', function () {

        syncCrossPortAuth();

        if (typeof window.updateAuthNav === 'function') {

            restoreFromSession();

            window.updateAuthNav();

        }

    });



    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', init);

    } else {

        init();

    }

})();


