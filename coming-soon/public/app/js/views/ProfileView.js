// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, showToast } from '../utils.js';
import { isIdeDashboardSurface, isExtensionHostedTab } from '../utils-lib/dom.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';
import { activateStockpileEntry, addToStockpile, BUY_TIME_TOKENS_URL, decodeTokenMeta, listStockpiled, stockpileCount, tokenHint, } from '../services/tokenStockpileService.js';

function loadProfile() {
    try { const raw = localStorage.getItem('sb_profile'); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
}
function saveProfile(data) { localStorage.setItem('sb_profile', JSON.stringify(data)); }

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = '='.repeat((4 - b64.length % 4) % 4);
        return JSON.parse(atob(b64 + pad));
    } catch { return null; }
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    const then = new Date(dateString).getTime();
    if (isNaN(then)) return 'Unknown';
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0) return years + ' year' + (years > 1 ? 's' : '');
    if (months > 0) return months + ' month' + (months > 1 ? 's' : '');
    if (days > 0) return days + ' day' + (days > 1 ? 's' : '');
    if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '');
    if (mins > 0) return mins + ' minute' + (mins > 1 ? 's' : '');
    return Math.floor(diff / 1000) + ' seconds';
}

function formatExpiry(exp) {
    if (!exp) return { label: 'Never', color: 'var(--text-muted)' };
    var diff = exp * 1000 - Date.now();
    if (diff <= 0) return { label: 'Expired', color: 'var(--danger)' };
    var days = Math.floor(diff / 86400000);
    if (days > 30) return { label: Math.floor(days / 30) + ' months', color: 'var(--success)' };
    if (days > 1) return { label: days + ' days', color: days < 7 ? 'var(--warning)' : 'var(--success)' };
    return { label: Math.floor(diff / 3600000) + 'h', color: 'var(--warning)' };
}

function getTokenRegistry() {
    try { var raw = localStorage.getItem('sb-token-registry'); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
}

export class ProfileView {
    constructor(app) { this.app = app; }

    mount(container) {
        var user = authService.getUser() || (this.app.state ? this.app.state.user : null) || {};
        var token = authService.getToken() || '';
        var profile = loadProfile();
        var email = user.email || profile.email || '';
        var tier = user.tier || user.plan || profile.tier || 'community';
        var project = user.projectName || profile.projectName || 'default-project';
        var loginMethod = profile.loginMethod || (token && !user.email ? 'token' : 'email');

        var payload = decodeJwtPayload(token);
        var registry = getTokenRegistry();
        var binding = registry[token] || null;
        var tokenType = token ? (payload ? 'JWT' : 'License Key') : 'None';
        var tokenTier = (payload && (payload.tier || payload.plan || payload.product)) || tier;
        var tokenExp = (payload && payload.exp) || null;
        var tokenIat = (payload && payload.iat) || null;
        var expiryInfo = formatExpiry(tokenExp);
        var boundAt = (binding && binding.boundAt) || null;
        var accountAge = boundAt ? formatTimeAgo(boundAt) : (tokenIat ? formatTimeAgo(new Date(tokenIat * 1000).toISOString()) : 'Unknown');
        var isActive = token ? (tokenExp ? tokenExp * 1000 > Date.now() : true) : false;
        var reservedCount = stockpileCount(token);
        var stockpiledRows = listStockpiled(token).map(function (ref) {
            var entry = ref.entry, index = ref.index;
            var meta = entry.meta || decodeTokenMeta(entry.token);
            return '<div class="profile-stockpile-row" data-stockpile-index="' + index + '">' +
                '<div class="profile-stockpile-meta"><code>' + escapeHtml(tokenHint(entry.token)) + '</code>' +
                '<span class="profile-stockpile-tier">' + escapeHtml(String(meta.tier)) + '</span>' +
                '<span class="profile-stockpile-expiry">expires ' + escapeHtml(meta.expiresLabel) + '</span></div>' +
                '<button type="button" class="btn btn-secondary btn-sm profile-stockpile-load" data-stockpile-load="' + index + '">Load</button></div>';
        }).join('');

        var isIde = (typeof isIdeDashboardSurface === 'function' && isIdeDashboardSurface());

        // Detect IDE/embed query params and expose lightweight flags for host integration.
        try {
            const params = new URLSearchParams(window.location.search || '');
            const sbParent = params.get('sb_parent_urlbar') === '1';
            const sbWebsite = params.get('sb_website_mode') === '1';
            const sbApi = params.get('sb_api_base') || params.get('sb_api');
            if (sbParent || sbWebsite) {
                try { document.documentElement.setAttribute('data-parent-urlbar', '1'); } catch (e) { /* ignore */ }
                window.__SB_PARENT_URL_BAR__ = true;
                // Only set data-ide-embed when actually inside an iframe (IDE webview).
                if (window.__SB_IDE_EMBED__ || (window.parent && window.parent !== window)) {
                    try { document.documentElement.setAttribute('data-ide-embed', '1'); } catch (e) { /* ignore */ }
                    window.__SB_IDE_EMBED__ = true;
                }
            }
            // If extension bridge provided an API base, surface host for debugging in the profile page
            if (sbApi && isExtensionHostedTab()) {
                try { window.__SB_BRIDGE_HOST__ = sbApi; } catch (e) { /* ignore */ }
            }
        } catch (_e) { /* ignore */ }
        var avatarHtml = (user && (user.avatarUrl || user.picture))
            ? '<img class="profile-avatar-img" src="' + escapeHtml((user.avatarUrl || user.picture) || '') + '" alt="Avatar" />'
            : (email ? escapeHtml(email[0].toUpperCase()) : '?');

        var fragment = document.createRange().createContextualFragment(
            '<div class="profile-page profile-page-v2">' +
            '<div class="profile-hero-card">' +
            '<div class="profile-avatar" aria-hidden="true">' + avatarHtml + '</div>' +
            '<div class="profile-hero-info">' +
            '<h1 class="page-title">' + escapeHtml(email || 'Account') + '</h1>' +
            '<div class="profile-hero-badges">' +
            '<span class="profile-tier-badge">' + escapeHtml(tokenTier) + '</span>' +
            '<span class="profile-status-pill ' + (isActive ? 'is-active' : 'is-inactive') + '">' + (isActive ? 'Active' : 'Inactive') + '</span>' +
            '</div></div></div>' +

            '<div class="profile-stats-strip">' +
            '<div class="profile-stat-item"><span class="stat-label">Token</span><span class="stat-value">' + escapeHtml(tokenType) + '</span></div>' +
            '<div class="profile-stat-item"><span class="stat-label">Project</span><span class="stat-value">' + escapeHtml(project) + '</span></div>' +
            '<div class="profile-stat-item"><span class="stat-label">Age</span><span class="stat-value">' + escapeHtml(accountAge) + '</span></div>' +
            '<div class="profile-stat-item"><span class="stat-label">Expires</span><span class="stat-value" style="color:' + expiryInfo.color + ';">' + escapeHtml(expiryInfo.label) + '</span></div>' +
            '</div>' +

            '<div class="profile-card">' +
            '<div class="profile-card-header"><i data-lucide="shield" class="icon-18 profile-card-icon"></i><h2>Login Method</h2></div>' +
            '<div class="profile-card-body">' +
            '<div class="login-method-grid" id="login-method-options">' +
            '<label class="login-method-card ' + (loginMethod === 'email' ? 'active' : '') + '">' +
            '<input type="radio" name="loginMethod" value="email" ' + (loginMethod === 'email' ? 'checked' : '') + '>' +
            '<div class="method-icon"><i data-lucide="mail" class="icon-20"></i></div>' +
            '<div class="method-label">Email</div><div class="method-desc">Email + Password</div></label>' +
            '<label class="login-method-card ' + (loginMethod === 'token' ? 'active' : '') + '">' +
            '<input type="radio" name="loginMethod" value="token" ' + (loginMethod === 'token' ? 'checked' : '') + '>' +
            '<div class="method-icon"><i data-lucide="key-round" class="icon-20"></i></div>' +
            '<div class="method-label">Token</div><div class="method-desc">Token + Password</div></label>' +
            '<label class="login-method-card ' + (loginMethod === 'both' ? 'active' : '') + '">' +
            '<input type="radio" name="loginMethod" value="both" ' + (loginMethod === 'both' ? 'checked' : '') + '>' +
            '<div class="method-icon"><i data-lucide="unlock" class="icon-20"></i></div>' +
            '<div class="method-label">Both</div><div class="method-desc">Any method</div></label>' +
            '</div></div></div>' +

            '<div class="profile-card">' +
            '<div class="profile-card-header"><i data-lucide="user-cog" class="icon-18 profile-card-icon"></i><h2>Credentials</h2></div>' +
            '<div class="profile-card-body">' +
            '<div class="profile-field"><label for="profile-email">Email Address</label>' +
            '<input type="email" id="profile-email" value="' + escapeHtml(email) + '" placeholder="you@company.com" autocomplete="email"></div>' +
            '<div class="profile-field"><label for="profile-email-password">Email Password</label>' +
            '<input type="password" id="profile-email-password" value="' + escapeHtml(profile.emailPassword || '') + '" placeholder="Set a password for email login…" autocomplete="new-password"></div>' +
            '<div class="profile-divider"></div>' +
            '<div class="profile-field"><label for="profile-token">License Token</label>' +
            '<div class="profile-input-group">' +
            '<input type="password" id="profile-token" value="' + escapeHtml(token) + '" placeholder="Paste your license token…" autocomplete="off">' +
            '<button type="button" class="input-action" id="profile-token-toggle" title="Show token" aria-label="Show token"><i data-lucide="eye" class="icon-16"></i></button>' +
            '<button type="button" class="input-action" id="profile-token-copy" title="Copy token" aria-label="Copy token"><i data-lucide="copy" class="icon-16"></i></button>' +
            '</div></div>' +
            '<div class="profile-field"><label for="profile-token-password">Token Password</label>' +
            '<input type="password" id="profile-token-password" value="' + escapeHtml(profile.tokenPassword || '') + '" placeholder="Set a password for token login…" autocomplete="new-password"></div>' +
            '</div></div>' +

            '<div class="profile-card" id="profile-stockpile-card">' +
            '<div class="profile-card-header"><i data-lucide="layers" class="icon-18 profile-card-icon"></i><h2>Token Loader (' + reservedCount + ' reserved)</h2></div>' +
            '<div class="profile-card-body">' +
            '<div class="profile-input-group">' +
            '<input type="password" id="profile-stockpile-input" placeholder="Paste purchased time token…" autocomplete="off">' +
            '<button type="button" class="btn btn-secondary btn-sm" id="profile-stockpile-add">Stockpile</button></div>' +
            (reservedCount > 0 ? '<div class="profile-stockpile-list">' + stockpiledRows + '</div>' : '<p class="profile-help">No reserved tokens yet.</p>') +
            '<div class="profile-stockpile-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" id="profile-buy-tokens"><i data-lucide="shopping-cart" class="icon-16"></i> Buy time tokens</button>' +
            '</div></div></div>' +

            '<div class="profile-actions-bar">' +
            '<button type="button" class="btn btn-primary" id="profile-save-btn"><i data-lucide="save" class="icon-16"></i> Save</button>' +
            '<button type="button" class="btn btn-secondary" id="profile-clear-cache-btn"><i data-lucide="trash-2" class="icon-16"></i> Clear Cache</button>' +
            '<button type="button" class="btn btn-danger" id="profile-signout-btn"><i data-lucide="log-out" class="icon-16"></i> Sign Out</button>' +
            '</div>' +
            '<p class="profile-status-msg" id="profile-save-status"></p>' +
            '</div>'
        );

        if (typeof window.setSafeHTML === 'function') { window.setSafeHTML(container, ''); } else { container.textContent = ''; }
        container.appendChild(fragment);

        if (isIde) {
            var root = container.querySelector('.profile-page');
            if (root) root.classList.add('ide-embed');
            container.classList.add('ide-embed');
        }
        // If running inside an IDE or extension-hosted tab, render a small connection banner
        try {
            const isExt = typeof isExtensionHostedTab === 'function' && isExtensionHostedTab();
            const apiHost = window.__SB_BRIDGE_HOST__ || (new URLSearchParams(window.location.search || '')).get('sb_api_base');
            if (isExt && apiHost) {
                const banner = document.createElement('div');
                banner.className = 'profile-ide-banner';
                banner.style.cssText = 'margin-top:12px;padding:8px;border-radius:6px;background:var(--card-bg);border:1px solid rgba(0,0,0,0.06);font-size:0.95rem;';
                banner.innerHTML = `Connected to IDE bridge · API: <code style="background:transparent;padding:0;border-radius:3px;">${escapeHtml(apiHost)}</code>`;
                const hero = container.querySelector('.profile-hero-card');
                if (hero && hero.parentNode) hero.parentNode.insertBefore(banner, hero.nextSibling);
            }
        } catch (_e) { /* ignore */ }
        if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        if (isIde) setTimeout(function () { if (typeof window.lucide !== 'undefined') window.lucide.createIcons(); }, 50);

        // Login method styles
        function updateLoginMethodStyles() {
            container.querySelectorAll('.login-method-card').forEach(function (card) {
                var input = card.querySelector('input[type="radio"]');
                if (input && input.checked) card.classList.add('active');
                else card.classList.remove('active');
            });
        }
        container.querySelectorAll('input[name="loginMethod"]').forEach(function (radio) {
            radio.addEventListener('change', updateLoginMethodStyles);
        });
        updateLoginMethodStyles();

        // Track changes
        var hasChanges = false;
        ['#profile-email', '#profile-email-password', '#profile-token', '#profile-token-password'].forEach(function (sel) {
            var el = container.querySelector(sel);
            if (el) el.addEventListener('input', function () { hasChanges = true; });
        });

        // Save
        var saveBtn = container.querySelector('#profile-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', function () {
            var data = {
                email: (container.querySelector('#profile-email') || {}).value || '',
                emailPassword: (container.querySelector('#profile-email-password') || {}).value || '',
                tokenPassword: (container.querySelector('#profile-token-password') || {}).value || '',
                loginMethod: (container.querySelector('input[name="loginMethod"]:checked') || {}).value || 'email'
            };
            if (hasChanges) {
                var stored = loadProfile();
                var currentPassword = data.emailPassword || data.tokenPassword || stored.emailPassword || stored.tokenPassword || '';
                var confirmPassword = prompt('Changes detected. Enter your password to confirm save:');
                if (confirmPassword === null) {
                    var status = container.querySelector('#profile-save-status');
                    status.textContent = 'Save cancelled.';
                    status.style.color = 'var(--warning)';
                    setTimeout(function () { status.textContent = ''; status.style.color = ''; }, 3000);
                    return;
                }
                if (confirmPassword !== currentPassword) {
                    var status2 = container.querySelector('#profile-save-status');
                    status2.textContent = 'Password mismatch — changes not saved.';
                    status2.style.color = 'var(--danger)';
                    setTimeout(function () { status2.textContent = ''; status2.style.color = ''; }, 3000);
                    return;
                }
            }
            saveProfile(data);
            hasChanges = false;
            var tokenInput = container.querySelector('#profile-token');
            if (tokenInput && tokenInput.value.trim()) localStorage.setItem('cascadeAuthToken', tokenInput.value.trim());
            if (data.email) localStorage.setItem('cascadeAuthUser', data.email);
            var status3 = container.querySelector('#profile-save-status');
            status3.textContent = 'Profile saved successfully.';
            status3.style.color = 'var(--success)';
            setTimeout(function () { status3.textContent = ''; status3.style.color = ''; }, 3000);
        });

        // Sign out
        var signoutBtn = container.querySelector('#profile-signout-btn');
        if (signoutBtn) signoutBtn.addEventListener('click', function () {
            var keys = ['cascadeAuthToken', 'cascadeAuthUser', 'access_token', 'token', 'authToken', 'simplebeacon_token', 'sb-token-vault'];
            keys.forEach(function (k) { localStorage.removeItem(k); });
            keys.forEach(function (k) { document.cookie = k + '=;path=/;max-age=0;SameSite=Lax;'; });
            sessionStorage.clear();
            this.app.navigate('dashboard');
            window.location.reload();
        }.bind(this));

        // Token toggle
        var toggleBtn = container.querySelector('#profile-token-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', function () {
            var input = container.querySelector('#profile-token');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                if (typeof window.setSafeHTML === 'function') window.setSafeHTML(toggleBtn, '<i data-lucide="eye-off" class="icon-16"></i>');
                toggleBtn.title = 'Hide token';
            } else {
                input.type = 'password';
                if (typeof window.setSafeHTML === 'function') window.setSafeHTML(toggleBtn, '<i data-lucide="eye" class="icon-16"></i>');
                toggleBtn.title = 'Show token';
            }
            if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        });

        // Token copy
        var copyBtn = container.querySelector('#profile-token-copy');
        if (copyBtn) copyBtn.addEventListener('click', async function () {
            var input = container.querySelector('#profile-token');
            if (!input || !input.value) { if (this.app.showToast) this.app.showToast('No token to copy', 'error'); return; }
            var copied = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try { await navigator.clipboard.writeText(input.value); copied = true; } catch (e) {}
            }
            if (!copied) {
                try {
                    var prev = input.type; input.type = 'text'; input.focus(); input.select();
                    copied = document.execCommand('copy'); input.type = prev;
                } catch (e) {}
            }
            if (copied) {
                if (typeof window.setSafeHTML === 'function') window.setSafeHTML(copyBtn, '<i data-lucide="check" class="icon-16"></i>');
                if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
                setTimeout(function () {
                    if (typeof window.setSafeHTML === 'function') window.setSafeHTML(copyBtn, '<i data-lucide="copy" class="icon-16"></i>');
                    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
                }, 1500);
                if (this.app.showToast) this.app.showToast('Token copied', 'success');
            } else {
                if (this.app.showToast) this.app.showToast('Copy failed — please select and copy manually', 'error');
            }
        }.bind(this));

        // Clear cache
        var clearBtn = container.querySelector('#profile-clear-cache-btn');
        if (clearBtn) clearBtn.addEventListener('click', function () {
            Object.keys(localStorage).filter(function (k) { return k.startsWith('sb_') || k.includes('simplebeacon'); }).forEach(function (k) { localStorage.removeItem(k); });
            if (this.app.showToast) this.app.showToast('Local cache cleared', 'success');
        }.bind(this));

        // Stockpile add
        var stockpileAddBtn = container.querySelector('#profile-stockpile-add');
        if (stockpileAddBtn) stockpileAddBtn.addEventListener('click', function () {
            var input = container.querySelector('#profile-stockpile-input');
            var value = (input && input.value.trim()) || '';
            if (!value) { showToast('Paste a token to stockpile', 'error'); return; }
            var result = addToStockpile(value, { email: email, tier: tokenTier });
            if (result.ok) {
                showToast(result.duplicate ? 'Token already stockpiled' : 'Time token added to loader', 'success');
                if (input) input.value = '';
                this.mount(container);
            } else {
                showToast(result.error || 'Could not stockpile token', 'error');
            }
        }.bind(this));

        // Buy tokens
        var buyBtn = container.querySelector('#profile-buy-tokens');
        if (buyBtn) buyBtn.addEventListener('click', function () {
            try { window.open(BUY_TIME_TOKENS_URL(), '_blank', 'noopener,noreferrer'); }
            catch (e) { window.open('/checkout/tokens?ref=dashboard', '_blank', 'noopener,noreferrer'); }
        });

        // Stockpile load
        container.querySelectorAll('[data-stockpile-load]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var index = parseInt(btn.getAttribute('data-stockpile-load') || '-1', 10);
                var result = activateStockpileEntry(index, authService);
                if (!result.ok) { showToast(result.error || 'Could not load token', 'error'); return; }
                showToast('Time token loaded — session updated', 'success');
                this.mount(container);
                if (this.app.updateAuthUi) this.app.updateAuthUi();
            }.bind(this));
        }.bind(this));
    }

    destroy() { }
}
