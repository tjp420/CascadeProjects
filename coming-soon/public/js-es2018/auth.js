// SimpleBeacon shared auth utilities for coming-soon pages
(function () {
    'use strict';
    var TOKEN_KEYS = [
        'cascadeAuthToken',
        'cascadeAuthUser',
        'access_token',
        'token',
        'authToken',
        'simplebeacon_token',
        'sb-token-vault'
    ];
    function clearLocalStorageItems(keys) {
        try {
            for (var i = 0; i < keys.length; i++) {
                localStorage.removeItem(keys[i]);
            }
        }
        catch (_) { }
    }
    function clearCookies(keys) {
        try {
            for (var i = 0; i < keys.length; i++) {
                document.cookie = keys[i] + '=;path=/;max-age=0;SameSite=Lax;';
            }
        }
        catch (_) { }
    }
    function signOut() {
        clearLocalStorageItems(TOKEN_KEYS);
        clearCookies(TOKEN_KEYS);
        try {
            sessionStorage.clear();
        }
        catch (_) { }
        window.location.reload();
    }
    function propagateTokenToLinks() {
        try {
            var params = new URLSearchParams(window.location.search);
            var token = params.get('token');
            if (!token)
                return;
            var links = document.querySelectorAll('.nav-links a');
            for (var i = 0; i < links.length; i++) {
                var a = links[i];
                var href = a.getAttribute('href') || '';
                if (href.indexOf('#') === -1 && href.indexOf('http') !== 0) {
                    var sep = href.indexOf('?') === -1 ? '?' : '&';
                    a.setAttribute('href', href + sep + 'token=' + encodeURIComponent(token));
                }
            }
        }
        catch (e) { }
    }
    // Expose to global scope for inline onclick handlers during migration
    window.SbAuth = {
        signOut: signOut,
        propagateTokenToLinks: propagateTokenToLinks
    };
})();
