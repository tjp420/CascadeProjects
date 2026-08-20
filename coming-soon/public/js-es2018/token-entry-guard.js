// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Restrict audit/certificate token fields to unused (new) license tokens.
 * Tracks consumed tokens locally and rejects vault entries marked used.
 */
(function () {
    'use strict';
    const CONSUMED_KEY = 'sb-audit-consumed-tokens';
    const VAULT_KEY = 'sb-token-vault';
    const freshFingerprints = new Set();
    function decodeJwtPayload(token) {
        if (!token || typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length !== 2 && parts.length !== 3) return null;
        const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
        if (!payloadBase64url) return null;
        const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
        const rem = base64.length % 4;
        if (rem === 1) return null;
        const padded = base64 + '='.repeat((4 - rem) % 4);
        try {
            const binary = atob(padded);
            let decoded;
            if (typeof TextDecoder !== 'undefined') {
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                decoded = new TextDecoder().decode(bytes);
            } else {
                decoded = decodeURIComponent(escape(binary));
            }
            return JSON.parse(decoded);
        } catch (_e) {
            return null;
        }
    }
    function tokenFingerprint(token) {
        const trimmed = String(token || '').trim();
        if (!trimmed) return '';
        const payload = decodeJwtPayload(trimmed);
        if (payload && payload.jti) return 'jti:' + payload.jti;
        if (payload && payload.email && payload.exp) {
            return 'exp:' + String(payload.email).toLowerCase() + ':' + payload.exp;
        }
        if (trimmed.length > 32) {
            return 'raw:' + trimmed.slice(0, 16) + trimmed.slice(-16);
        }
        return 'raw:' + trimmed;
    }
    function loadConsumed() {
        try {
            const raw = sessionStorage.getItem(CONSUMED_KEY) || localStorage.getItem(CONSUMED_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            return [];
        }
    }
    function saveConsumed(list) {
        const json = JSON.stringify(list);
        sessionStorage.setItem(CONSUMED_KEY, json);
        localStorage.setItem(CONSUMED_KEY, json);
    }
    function isVaultTokenUsed(token) {
        try {
            const raw = localStorage.getItem(VAULT_KEY);
            if (!raw) return false;
            const vault = JSON.parse(raw);
            if (!Array.isArray(vault)) return false;
            const entry = vault.find(function (v) {
                return v && v.token === token;
            });
            return !!(entry && (entry.usedAt || entry.activatedAt));
        } catch (_e) {
            return false;
        }
    }
    function isTokenAlreadyUsed(token) {
        const trimmed = String(token || '').trim();
        if (!trimmed) return false;
        const fp = tokenFingerprint(trimmed);
        if (!fp) return false;
        if (freshFingerprints.has(fp)) return false;
        if (loadConsumed().includes(fp)) return true;
        return isVaultTokenUsed(trimmed);
    }
    function registerFreshToken(token) {
        const fp = tokenFingerprint(token);
        if (fp) freshFingerprints.add(fp);
    }
    function markTokenConsumed(token) {
        const trimmed = String(token || '').trim();
        const fp = tokenFingerprint(trimmed);
        if (!fp) return;
        freshFingerprints.delete(fp);
        const list = loadConsumed();
        if (!list.includes(fp)) {
            list.push(fp);
            saveConsumed(list);
        }
    }
    function isTokenInLocalStorage(token) {
        const keys = ['sb-token', 'sb_token', 'simplebeacon_token', 'cascadeAuthToken', 'auth_token'];
        for (let i = 0; i < keys.length; i++) {
            try {
                if (localStorage.getItem(keys[i]) === token) return true;
            } catch (_e) {
                /* ignore */
            }
        }
        return false;
    }
    function validateNewTokenEntry(token, options) {
        const opts = options || {};
        const trimmed = String(token || '').trim();
        if (!trimmed) {
            return { ok: false, error: 'Please paste a new license token from your email.' };
        }
        if (trimmed.length < 20 || !trimmed.includes('.')) {
            return { ok: false, error: 'That does not look like a valid license token.' };
        }
        const fp = tokenFingerprint(trimmed);
        if (opts.allowFresh && fp && freshFingerprints.has(fp)) {
            return { ok: true };
        }
        // Allow re-entry of a token that is already stored in localStorage (e.g. after page refresh)
        if (isTokenInLocalStorage(trimmed)) {
            return { ok: true };
        }
        if (isTokenAlreadyUsed(trimmed)) {
            return {
                ok: false,
                error: 'This token was already used on this device. Request a new token via email (Try for Free / Send a Token).'
            };
        }
        return { ok: true };
    }
    function applyTokenToInput(input, token, options) {
        if (!input) return { ok: false, error: 'Token field not found.' };
        const check = validateNewTokenEntry(token, options);
        if (!check.ok) {
            input.value = '';
            return check;
        }
        input.value = String(token || '').trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return { ok: true };
    }
    function bindLicenseTokenInput(input, errorEl) {
        if (!input || input.dataset.newTokenGuard === '1') return;
        input.dataset.newTokenGuard = '1';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        function showError(msg) {
            if (!errorEl) return;
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden-display');
            errorEl.style.display = 'block';
        }
        function clearError() {
            if (!errorEl) return;
            errorEl.textContent = '';
            errorEl.classList.add('hidden-display');
            errorEl.style.display = 'none';
        }
        input.addEventListener('input', function () {
            const token = input.value.trim();
            if (!token) {
                clearError();
                return;
            }
            if (token.length < 20 || !token.includes('.')) return;
            const check = validateNewTokenEntry(token);
            if (!check.ok) {
                input.value = '';
                showError(check.error);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                clearError();
            }
        });
    }
    window.TokenEntryGuard = {
        decodeJwtPayload: decodeJwtPayload,
        tokenFingerprint: tokenFingerprint,
        isTokenAlreadyUsed: isTokenAlreadyUsed,
        registerFreshToken: registerFreshToken,
        markTokenConsumed: markTokenConsumed,
        validateNewTokenEntry: validateNewTokenEntry,
        applyTokenToInput: applyTokenToInput,
        bindLicenseTokenInput: bindLicenseTokenInput
    };
})();
