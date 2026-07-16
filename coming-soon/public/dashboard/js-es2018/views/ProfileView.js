// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, showToast } from '../utils.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';
import { isWebAuthnSupported, listSecurityKeys, registerSecurityKey, removeSecurityKey } from '../services/webauthnService.js?v=20260716cachefix1';
import { userHasJwtForAiKeys } from '../services/aiKeysService.js?v=20260716cachefix1';
import { activateStockpileEntry, addToStockpile, BUY_TIME_TOKENS_URL, decodeTokenMeta, listStockpiled, stockpileCount, tokenHint, } from '../services/tokenStockpileService.js';
function loadProfile() {
    try {
        const raw = localStorage.getItem('sb_profile');
        return raw ? JSON.parse(raw) : {};
    }
    catch (_a) {
        return {};
    }
}
function saveProfile(data) {
    localStorage.setItem('sb_profile', JSON.stringify(data));
}
function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string')
        return null;
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        return JSON.parse(atob(base64 + padding));
    }
    catch (_a) {
        return null;
    }
}
function formatTimeAgo(dateString) {
    if (!dateString)
        return 'Unknown';
    const then = new Date(dateString).getTime();
    if (isNaN(then))
        return 'Unknown';
    const diff = Date.now() - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0)
        return `${years} year${years > 1 ? 's' : ''}`;
    if (months > 0)
        return `${months} month${months > 1 ? 's' : ''}`;
    if (days > 0)
        return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0)
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0)
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}
function formatExpiry(exp) {
    if (!exp)
        return { label: 'Never', color: 'var(--text-muted)' };
    const expiryMs = exp * 1000;
    const diff = expiryMs - Date.now();
    if (diff <= 0)
        return { label: 'Expired', color: 'var(--danger)' };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 30)
        return { label: `${Math.floor(days / 30)} months`, color: 'var(--success)' };
    if (days > 1)
        return { label: `${days} days`, color: days < 7 ? 'var(--warning)' : 'var(--success)' };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return { label: `${hours}h`, color: 'var(--warning)' };
}
function getTokenRegistry() {
    try {
        const raw = localStorage.getItem('sb-token-registry');
        return raw ? JSON.parse(raw) : {};
    }
    catch (_a) {
        return {};
    }
}
export class ProfileView {
    constructor(app) {
        this.app = app;
    }
    mount(container) {
        var _a, _b, _c, _d;
        const user = authService.getUser() || ((_a = this.app.state) === null || _a === void 0 ? void 0 : _a.user) || {};
        const token = authService.getToken() || '';
        const profile = loadProfile();
        const email = user.email || profile.email || '';
        const tier = user.tier || user.plan || profile.tier || 'community';
        const project = user.projectName || profile.projectName || 'default-project';
        const loginMethod = profile.loginMethod || (token && !user.email ? 'token' : 'email');
        // ─── Token & Account analytics ───
        const payload = decodeJwtPayload(token);
        const registry = getTokenRegistry();
        const binding = registry[token] || null;
        const tokenType = token ? (payload ? 'JWT' : 'License Key') : 'None';
        const tokenTier = (payload === null || payload === void 0 ? void 0 : payload.tier) || (payload === null || payload === void 0 ? void 0 : payload.plan) || (payload === null || payload === void 0 ? void 0 : payload.product) || tier;
        const tokenExp = (payload === null || payload === void 0 ? void 0 : payload.exp) || null;
        const tokenIat = (payload === null || payload === void 0 ? void 0 : payload.iat) || null;
        const expiryInfo = formatExpiry(tokenExp);
        const boundAt = (binding === null || binding === void 0 ? void 0 : binding.boundAt) || null;
        const accountAge = boundAt ? formatTimeAgo(boundAt) : (tokenIat ? formatTimeAgo(new Date(tokenIat * 1000).toISOString()) : 'Unknown');
        const isActive = token ? (tokenExp ? tokenExp * 1000 > Date.now() : true) : false;
        const subLabel = (payload === null || payload === void 0 ? void 0 : payload.sub) || (payload === null || payload === void 0 ? void 0 : payload.email) || email || 'Not set';
        const activeToken = token;
        const reservedCount = stockpileCount(activeToken);
        const stockpiledRows = listStockpiled(activeToken).map(({ entry, index }) => {
            const meta = entry.meta || decodeTokenMeta(entry.token);
            return `
          <div class="profile-stockpile-row" data-stockpile-index="${index}">
            <div class="profile-stockpile-meta">
              <code>${escapeHtml(tokenHint(entry.token))}</code>
              <span class="profile-stockpile-tier">${escapeHtml(String(meta.tier))}</span>
              <span class="profile-stockpile-expiry">expires ${escapeHtml(meta.expiresLabel)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm profile-stockpile-load" data-stockpile-load="${index}">Load</button>
          </div>`;
        }).join('');
        const fragment = document.createRange().createContextualFragment(`
      <div class="profile-page">
        <div class="profile-hero-card">
          <div class="profile-hero-main">
            <div class="profile-avatar" aria-hidden="true">${email ? escapeHtml(email[0].toUpperCase()) : '?'}</div>
            <div class="profile-hero-text">
              <h1 class="page-title">Account Profile</h1>
              <p class="page-subtitle">Manage your credentials, license token, and session settings.</p>
            </div>
          </div>
          <div class="profile-hero-badges">
            <span class="profile-tier-badge">${escapeHtml(tokenTier)}</span>
            <span class="profile-status-pill ${isActive ? 'is-active' : 'is-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div class="profile-layout">
          <div class="profile-main">
            <div class="profile-card">
              <div class="profile-card-header">
                <i data-lucide="shield" class="icon-18 profile-card-icon"></i>
                <h2>Preferred Login Method</h2>
              </div>
              <div class="profile-card-body">
                <div class="login-method-grid" id="login-method-options">
                  <label class="login-method-card ${loginMethod === 'email' ? 'active' : ''}">
                    <input type="radio" name="loginMethod" value="email" aria-label="Email login method" ${loginMethod === 'email' ? 'checked' : ''}>
                    <div class="method-icon"><i data-lucide="mail" class="icon-20"></i></div>
                    <div class="method-label">Email</div>
                    <div class="method-desc">Email + Password</div>
                  </label>
                  <label class="login-method-card ${loginMethod === 'token' ? 'active' : ''}">
                    <input type="radio" name="loginMethod" value="token" aria-label="Token login method" ${loginMethod === 'token' ? 'checked' : ''}>
                    <div class="method-icon"><i data-lucide="key-round" class="icon-20"></i></div>
                    <div class="method-label">Token</div>
                    <div class="method-desc">Token + Password</div>
                  </label>
                  <label class="login-method-card ${loginMethod === 'both' ? 'active' : ''}">
                    <input type="radio" name="loginMethod" value="both" aria-label="Both login methods" ${loginMethod === 'both' ? 'checked' : ''}>
                    <div class="method-icon"><i data-lucide="unlock" class="icon-20"></i></div>
                    <div class="method-label">Both</div>
                    <div class="method-desc">Any method works</div>
                  </label>
                  <label class="login-method-card ${loginMethod === 'security-key' ? 'active' : ''}">
                    <input type="radio" name="loginMethod" value="security-key" aria-label="Security key login method" ${loginMethod === 'security-key' ? 'checked' : ''}>
                    <div class="method-icon"><i data-lucide="key" class="icon-20"></i></div>
                    <div class="method-label">Security Key</div>
                    <div class="method-desc">Hardware key / passkey</div>
                  </label>
                </div>
                <p class="profile-help">Choose how you want to authenticate on this device. Your choice is saved locally.</p>
              </div>
            </div>

            <div class="profile-card" id="security-keys-section">
              <div class="profile-card-header">
                <i data-lucide="key-round" class="icon-18 profile-card-icon"></i>
                <h2>Security Keys</h2>
              </div>
              <div class="profile-card-body">
                <p class="profile-help">Register a FIDO2 hardware key (YubiKey, Titan) or a built-in passkey (Windows Hello, Touch ID, Face ID). A regular USB flash drive will not work.</p>
                <p class="profile-help">Click <strong>Add security key</strong>, name the key, then follow the browser prompt — choose your hardware key or <em>This device</em> for a passkey.</p>
                <div id="security-keys-list" class="profile-security-keys-list">Loading security keys…</div>
                <div class="profile-actions" style="margin-top:1rem;">
                  <button type="button" class="btn btn-secondary btn-sm" id="security-key-add-btn"${isWebAuthnSupported() ? '' : ' disabled'}>Add security key</button>
                </div>
                <p id="security-keys-status" class="profile-help"></p>
              </div>
            </div>

            <div class="profile-card">
              <div class="profile-card-header">
                <i data-lucide="mail" class="icon-18 profile-card-icon"></i>
                <h2>Email Credentials</h2>
              </div>
              <div class="profile-card-body">
                <div class="profile-field">
                  <label for="profile-email">Email Address</label>
                  <input type="email" id="profile-email" value="${escapeHtml(email)}" placeholder="you@company.com" autocomplete="email">
                </div>
                <div class="profile-field">
                  <label for="profile-email-password">Email Password</label>
                  <input type="password" id="profile-email-password" value="${escapeHtml(profile.emailPassword || '')}" placeholder="Set a password for email login…" autocomplete="new-password">
                  <p class="profile-help">Used when signing in with Email + Password.</p>
                </div>
              </div>
            </div>

            <div class="profile-card" id="token-section">
              <div class="profile-card-header">
                <i data-lucide="key-round" class="icon-18 profile-card-icon"></i>
                <h2>License Token</h2>
              </div>
              <div class="profile-card-body">
                <div class="profile-field">
                  <label for="profile-token">Token</label>
                  <div class="profile-input-group">
                    <input type="password" id="profile-token" value="${escapeHtml(token)}" placeholder="Paste your license token…" autocomplete="off">
                    <button type="button" class="input-action" id="profile-token-toggle" title="Show token" aria-label="Show token"><i data-lucide="eye" class="icon-16"></i></button>
                    <button type="button" class="input-action" id="profile-token-copy" title="Copy token" aria-label="Copy token"><i data-lucide="copy" class="icon-16"></i></button>
                  </div>
                  <p class="profile-help">Your SimpleBeacon license token. Use the eye icon to reveal or copy to clipboard.</p>
                </div>
                <div class="profile-field">
                  <label for="profile-token-password">Token Password</label>
                  <input type="password" id="profile-token-password" value="${escapeHtml(profile.tokenPassword || '')}" placeholder="Set a password for token login…" autocomplete="new-password">
                  <p class="profile-help">Used when signing in with Token + Password.</p>
                </div>
              </div>
            </div>
          </div>

          <aside class="profile-aside">
            <div class="profile-card">
              <div class="profile-card-header">
                <i data-lucide="badge-check" class="icon-18 profile-card-icon"></i>
                <h2>Account Status</h2>
              </div>
              <div class="profile-card-body">
                <div class="profile-stat-grid">
                  <div class="profile-stat">
                    <div class="label">Token Type</div>
                    <div class="value">${escapeHtml(tokenType)}</div>
                  </div>
                  <div class="profile-stat">
                    <div class="label">Project</div>
                    <div class="value">${escapeHtml(project)}</div>
                  </div>
                  <div class="profile-stat">
                    <div class="label">Account Age</div>
                    <div class="value">${escapeHtml(accountAge)}</div>
                  </div>
                  <div class="profile-stat">
                    <div class="label">Expires In</div>
                    <div class="value" style="color:${expiryInfo.color};">${escapeHtml(expiryInfo.label)}</div>
                  </div>
                  <div class="profile-stat">
                    <div class="label">Subject</div>
                    <div class="value" style="font-size:var(--font-size-xs);">${escapeHtml(subLabel)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="profile-card" id="profile-stockpile-card">
              <div class="profile-card-header">
                <i data-lucide="layers" class="icon-18 profile-card-icon"></i>
                <h2>Token Loader (${reservedCount} reserved)</h2>
              </div>
              <div class="profile-card-body">
                <p class="profile-help" style="margin-top:0;">Buy time tokens now and stockpile them here. They stay inactive until you click Load — useful for renewing before your current token expires.</p>
                <div class="profile-field">
                  <label for="profile-stockpile-input">Paste token to stockpile</label>
                  <div class="profile-input-group">
                    <input type="password" id="profile-stockpile-input" placeholder="Paste purchased time token…" autocomplete="off">
                    <button type="button" class="btn btn-secondary btn-sm" id="profile-stockpile-add">Stockpile</button>
                  </div>
                </div>
                ${reservedCount > 0 ? `<div class="profile-stockpile-list">${stockpiledRows}</div>` : '<p class="profile-help">No reserved tokens yet.</p>'}
                <div class="profile-stockpile-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="profile-buy-tokens"><i data-lucide="shopping-cart" class="icon-16"></i> Buy time tokens</button>
                  <a class="btn btn-ghost btn-sm" href="/dashboard/settings">Manage in Settings</a>
                </div>
              </div>
            </div>

            <div class="profile-card">
              <div class="profile-card-header">
                <i data-lucide="zap" class="icon-18 profile-card-icon"></i>
                <h2>Actions</h2>
              </div>
              <div class="profile-card-body">
                <div class="profile-actions">
                  <button type="button" class="btn btn-primary" id="profile-save-btn"><i data-lucide="save" class="icon-16"></i> Save Changes</button>
                  <button type="button" class="btn btn-secondary" id="profile-clear-cache-btn"><i data-lucide="trash-2" class="icon-16"></i> Clear Cache</button>
                  <button type="button" class="btn btn-danger" id="profile-signout-btn"><i data-lucide="log-out" class="icon-16"></i> Sign Out</button>
                </div>
                <p class="profile-status-msg" id="profile-save-status"></p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `);
        container.innerHTML = '';
        container.appendChild(fragment);
        if (typeof window.lucide !== 'undefined')
            window.lucide.createIcons();
        // Style active login method
        const updateLoginMethodStyles = () => {
            container.querySelectorAll('.login-method-card').forEach((card) => {
                const input = card.querySelector('input[type="radio"]');
                if (input.checked) {
                    card.classList.add('active');
                }
                else {
                    card.classList.remove('active');
                }
            });
        };
        container.querySelectorAll('input[name="loginMethod"]').forEach((radio) => {
            radio.addEventListener('change', updateLoginMethodStyles);
        });
        updateLoginMethodStyles();
        // Track if any sensitive field changed
        let hasChanges = false;
        const watchInputs = ['#profile-email', '#profile-email-password', '#profile-token', '#profile-token-password'];
        watchInputs.forEach((sel) => {
            const el = container.querySelector(sel);
            if (el)
                el.addEventListener('input', () => { hasChanges = true; });
        });
        // Save profile
        (_b = container.querySelector('#profile-save-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a, _b, _c, _d, _e, _f, _g;
            const data = {
                email: ((_b = (_a = container.querySelector('#profile-email')) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.trim()) || '',
                emailPassword: ((_c = container.querySelector('#profile-email-password')) === null || _c === void 0 ? void 0 : _c.value) || '',
                tokenPassword: ((_d = container.querySelector('#profile-token-password')) === null || _d === void 0 ? void 0 : _d.value) || '',
                loginMethod: ((_e = container.querySelector('input[name="loginMethod"]:checked')) === null || _e === void 0 ? void 0 : _e.value) || 'email'
            };
            // Require password confirmation if anything changed
            if (hasChanges) {
                const stored = loadProfile();
                const currentPassword = data.emailPassword || data.tokenPassword || stored.emailPassword || stored.tokenPassword || '';
                const confirmPassword = prompt('Changes detected. Enter your password to confirm save:');
                if (confirmPassword === null) {
                    const status = container.querySelector('#profile-save-status');
                    status.textContent = 'Save cancelled.';
                    status.style.color = 'var(--warning)';
                    setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 3000);
                    return;
                }
                if (confirmPassword !== currentPassword) {
                    const status = container.querySelector('#profile-save-status');
                    status.textContent = 'Password mismatch — changes not saved.';
                    status.style.color = 'var(--danger)';
                    setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 3000);
                    return;
                }
            }
            saveProfile(data);
            hasChanges = false;
            const tokenVal = (_g = (_f = container.querySelector('#profile-token')) === null || _f === void 0 ? void 0 : _f.value) === null || _g === void 0 ? void 0 : _g.trim();
            if (tokenVal) {
                localStorage.setItem('cascadeAuthToken', tokenVal);
            }
            if (data.email) {
                localStorage.setItem('cascadeAuthUser', data.email);
            }
            const status = container.querySelector('#profile-save-status');
            status.textContent = 'Profile saved successfully.';
            status.style.color = 'var(--success)';
            setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 3000);
        });
        // Sign out
        (_c = container.querySelector('#profile-signout-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            const keys = ['cascadeAuthToken', 'cascadeAuthUser', 'access_token', 'token', 'authToken', 'simplebeacon_token', 'sb-token-vault'];
            keys.forEach((k) => { localStorage.removeItem(k); });
            keys.forEach((k) => { document.cookie = k + '=;path=/;max-age=0;SameSite=Lax;'; });
            sessionStorage.clear();
            this.app.navigate('dashboard');
            window.location.reload();
        });
        // Token show/hide toggle
        const toggleBtn = container.querySelector('#profile-token-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                try {
                    const input = container.querySelector('#profile-token');
                    if (!input)
                        return;
                    if (input.type === 'password') {
                        input.type = 'text';
                        toggleBtn.innerHTML = '<i data-lucide="eye-off" class="icon-16"></i>';
                        toggleBtn.title = 'Hide token';
                        toggleBtn.setAttribute('aria-label', 'Hide token');
                    }
                    else {
                        input.type = 'password';
                        toggleBtn.innerHTML = '<i data-lucide="eye" class="icon-16"></i>';
                        toggleBtn.title = 'Show token';
                        toggleBtn.setAttribute('aria-label', 'Show token');
                    }
                    if (typeof window.lucide !== 'undefined')
                        window.lucide.createIcons();
                }
                catch (e) {
                    console.error('[Profile] Toggle failed:', e);
                }
            });
        }
        // Token copy with fallback
        const copyBtn = container.querySelector('#profile-token-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                var _a, _b, _c, _d, _e, _f;
                const input = container.querySelector('#profile-token');
                if (!input || !input.value) {
                    (_b = (_a = this.app).showToast) === null || _b === void 0 ? void 0 : _b.call(_a, 'No token to copy', 'error');
                    return;
                }
                let copied = false;
                // Try modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    try {
                        await navigator.clipboard.writeText(input.value);
                        copied = true;
                    }
                    catch (e) {
                        console.warn('[Profile] Clipboard API failed, trying fallback:', e);
                    }
                }
                // Fallback: select + execCommand
                if (!copied) {
                    try {
                        const prevType = input.type;
                        input.type = 'text';
                        input.focus();
                        input.select();
                        copied = document.execCommand('copy');
                        input.type = prevType;
                    }
                    catch (e) {
                        console.error('[Profile] Fallback copy failed:', e);
                    }
                }
                if (copied) {
                    const original = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i data-lucide="check" class="icon-16"></i>';
                    if (typeof window.lucide !== 'undefined')
                        window.lucide.createIcons();
                    setTimeout(() => {
                        copyBtn.innerHTML = original;
                        if (typeof window.lucide !== 'undefined')
                            window.lucide.createIcons();
                    }, 1500);
                    (_d = (_c = this.app).showToast) === null || _d === void 0 ? void 0 : _d.call(_c, 'Token copied', 'success');
                }
                else {
                    (_f = (_e = this.app).showToast) === null || _f === void 0 ? void 0 : _f.call(_e, 'Copy failed — please select and copy manually', 'error');
                }
            });
        }
        // Clear cache
        (_d = container.querySelector('#profile-clear-cache-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            var _a, _b;
            const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb_') || k.includes('simplebeacon'));
            keys.forEach((k) => localStorage.removeItem(k));
            ((_b = (_a = this.app).showToast) === null || _b === void 0 ? void 0 : _b.call(_a, 'Local cache cleared', 'success')) || alert('Local cache cleared');
        });
        const securityKeysList = container.querySelector('#security-keys-list');
        const securityKeysStatus = container.querySelector('#security-keys-status');
        const renderSecurityKeys = async () => {
            if (!securityKeysList)
                return;
            if (!authService.getToken()) {
                securityKeysList.innerHTML = '<p class="profile-help">Sign in to manage security keys.</p>';
                return;
            }
            if (!userHasJwtForAiKeys()) {
                securityKeysList.innerHTML = '<p class="profile-help">Security keys require email/password sign-in. License-token sessions can use password or passkey sign-in on the Sign in page.</p>';
                return;
            }
            if (!isWebAuthnSupported()) {
                securityKeysList.innerHTML = '<p class="profile-help">This browser does not support security keys.</p>';
                return;
            }
            securityKeysList.textContent = 'Loading security keys…';
            try {
                const keys = await listSecurityKeys();
                if (!keys.length) {
                    securityKeysList.innerHTML = '<p class="profile-help">No security keys registered yet.</p>';
                    return;
                }
                securityKeysList.innerHTML = keys.map((key) => `
            <div class="profile-security-key-row" data-credential-id="${escapeHtml(key.id)}">
              <div class="profile-security-key-meta">
                <strong>${escapeHtml(key.label || 'Security key')}</strong>
                <span class="profile-help">${key.createdAt ? `Added ${escapeHtml(formatTimeAgo(key.createdAt))}` : ''}</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm profile-security-key-remove" data-remove-key="${escapeHtml(key.id)}">Remove</button>
            </div>`).join('');
                securityKeysList.querySelectorAll('[data-remove-key]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const credentialId = btn.getAttribute('data-remove-key');
                        if (!credentialId || !confirm('Remove this security key? You will need to register it again to sign in with it.'))
                            return;
                        btn.disabled = true;
                        try {
                            await removeSecurityKey(credentialId);
                            showToast('Security key removed', 'success');
                            await renderSecurityKeys();
                        }
                        catch (err) {
                            showToast(err.message || 'Failed to remove security key', 'error');
                            btn.disabled = false;
                        }
                    });
                });
            }
            catch (err) {
                securityKeysList.innerHTML = `<p class="profile-help">${escapeHtml(err.message || 'Could not load security keys')}</p>`;
            }
        };
        container.querySelector('#security-key-add-btn')?.addEventListener('click', async () => {
            const addBtn = container.querySelector('#security-key-add-btn');
            if (!authService.getToken()) {
                showToast('Sign in before adding a security key', 'error');
                return;
            }
            const label = prompt('Name this security key (e.g. YubiKey, MacBook Touch ID):', 'Security key');
            if (label === null)
                return;
            if (addBtn)
                addBtn.disabled = true;
            if (securityKeysStatus)
                securityKeysStatus.textContent = 'Waiting for your security key…';
            try {
                await registerSecurityKey({ email, label: label.trim() || 'Security key' });
                showToast('Security key registered', 'success');
                await renderSecurityKeys();
            }
            catch (err) {
                showToast(err.message || 'Security key registration failed', 'error');
            }
            finally {
                if (addBtn)
                    addBtn.disabled = false;
                if (securityKeysStatus)
                    securityKeysStatus.textContent = '';
            }
        });
        renderSecurityKeys();
        container.querySelector('#profile-stockpile-add')?.addEventListener('click', () => {
            const input = container.querySelector('#profile-stockpile-input');
            const value = (input === null || input === void 0 ? void 0 : input.value.trim()) || '';
            if (!value) {
                showToast('Paste a token to stockpile', 'error');
                return;
            }
            const result = addToStockpile(value, { email, tier: tokenTier });
            if (result.ok) {
                showToast(result.duplicate ? 'Token already stockpiled' : 'Time token added to loader', 'success');
                if (input)
                    input.value = '';
                this.mount(container);
            }
            else {
                showToast(result.error || 'Could not stockpile token', 'error');
            }
        });
        container.querySelector('#profile-buy-tokens')?.addEventListener('click', () => {
            window.open(BUY_TIME_TOKENS_URL, '_blank', 'noopener,noreferrer');
        });
        container.querySelectorAll('[data-stockpile-load]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-stockpile-load') || '-1', 10);
                const result = activateStockpileEntry(index, authService);
                if (!result.ok) {
                    showToast(result.error || 'Could not load token', 'error');
                    return;
                }
                showToast('Time token loaded — session updated', 'success');
                this.mount(container);
                if (this.app.updateAuthUi)
                    this.app.updateAuthUi();
            });
        });
    }
    destroy() { }
}
