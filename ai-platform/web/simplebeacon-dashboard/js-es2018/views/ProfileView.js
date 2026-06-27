import { escapeHtml, showToast } from '../utils.js';
import { authService } from '../services/authService.js';
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
        return { label: 'Expired', color: 'var(--error)' };
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
        const fragment = document.createRange().createContextualFragment(`
      <style>
        .profile-page { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
        .profile-hero { text-align: center; margin-bottom: 32px; }
        .profile-hero h1 { font-size: 1.75rem; font-weight: 700; margin: 0 0 8px; background: linear-gradient(135deg, var(--accent), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .profile-hero p { color: var(--text-muted); font-size: 0.9rem; margin: 0; }
        .profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-secondary)); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 16px; color: #fff; font-weight: 600; }
        .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 20px; overflow: hidden; }
        .profile-card-header { padding: 18px 24px 0; display: flex; align-items: center; gap: 10px; }
        .profile-card-header .icon { font-size: 1.1rem; }
        .profile-card-header h2 { font-size: 0.95rem; font-weight: 600; margin: 0; color: var(--text-main); }
        .profile-card-body { padding: 16px 24px 20px; }
        .profile-field { margin-bottom: 16px; }
        .profile-field:last-child { margin-bottom: 0; }
        .profile-field label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .profile-field input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-input); color: var(--text-main); font-size: 0.9rem; transition: border-color 150ms, box-shadow 150ms; }
        .profile-field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
        .profile-input-group { display: flex; gap: 8px; align-items: stretch; }
        .profile-input-group input { flex: 1; }
        .profile-input-group .input-action { padding: 0 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-secondary); font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 150ms; }
        .profile-input-group .input-action:hover { background: var(--primary-subtle); color: var(--accent); border-color: var(--accent); }
        .profile-help { font-size: 0.75rem; color: var(--text-muted); margin: 6px 0 0; }
        .login-method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .login-method-card { position: relative; padding: 14px 12px; border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer; text-align: center; transition: all 150ms; background: var(--surface); }
        .login-method-card:hover { border-color: var(--accent); }
        .login-method-card.active { border-color: var(--accent); background: var(--primary-subtle); }
        .login-method-card input { position: absolute; top: 8px; right: 8px; accent-color: var(--accent); }
        .login-method-card .method-icon { font-size: 1.3rem; margin-bottom: 6px; }
        .login-method-card .method-label { font-size: 0.8rem; font-weight: 600; color: var(--text-main); }
        .login-method-card .method-desc { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
        .session-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .session-badge { padding: 10px 14px; border-radius: 10px; background: var(--bg-input); border: 1px solid var(--border); }
        .session-badge .label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 4px; }
        .session-badge .value { font-size: 0.9rem; font-weight: 600; color: var(--text-main); }
        .profile-actions { display: flex; gap: 10px; flex-wrap: wrap; padding: 20px 24px; }
        .profile-actions .btn { flex: 1; min-width: 120px; }
        .profile-status { padding: 0 24px 20px; margin: 0; font-size: 0.85rem; min-height: 1.2em; color: var(--success); }
      </style>

      <div class="profile-page">
        <div class="profile-hero">
          <div class="profile-avatar">${email ? escapeHtml(email[0].toUpperCase()) : '?'}</div>
          <h1>Account Profile</h1>
          <p>Manage your credentials, license token, and session settings</p>
        </div>

        <!-- Login Method -->
        <div class="profile-card">
          <div class="profile-card-header">
            <span class="icon">🔐</span>
            <h2>Preferred Login Method</h2>
          </div>
          <div class="profile-card-body">
            <div class="login-method-grid" id="login-method-options">
              <label class="login-method-card ${loginMethod === 'email' ? 'active' : ''}">
                <input type="radio" name="loginMethod" value="email" aria-label="Email login method" ${loginMethod === 'email' ? 'checked' : ''}>
                <div class="method-icon">📧</div>
                <div class="method-label">Email</div>
                <div class="method-desc">Email + Password</div>
              </label>
              <label class="login-method-card ${loginMethod === 'token' ? 'active' : ''}">
                <input type="radio" name="loginMethod" value="token" aria-label="Token login method" ${loginMethod === 'token' ? 'checked' : ''}>
                <div class="method-icon">🔑</div>
                <div class="method-label">Token</div>
                <div class="method-desc">Token + Password</div>
              </label>
              <label class="login-method-card ${loginMethod === 'both' ? 'active' : ''}">
                <input type="radio" name="loginMethod" value="both" aria-label="Both login methods" ${loginMethod === 'both' ? 'checked' : ''}>
                <div class="method-icon">🔓</div>
                <div class="method-label">Both</div>
                <div class="method-desc">Any method works</div>
              </label>
            </div>
            <p class="profile-help" style="margin-top:12px;">Choose how you want to authenticate on this device. Your choice is saved locally.</p>
          </div>
        </div>

        <!-- Email Credentials -->
        <div class="profile-card">
          <div class="profile-card-header">
            <span class="icon">📧</span>
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

        <!-- Token Credentials -->
        <div class="profile-card" id="token-section">
          <div class="profile-card-header">
            <span class="icon">🔑</span>
            <h2>License Token</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-field">
              <label for="profile-token">Token</label>
              <div class="profile-input-group">
                <input type="password" id="profile-token" value="${escapeHtml(token)}" placeholder="Paste your license token…" autocomplete="off">
                <button type="button" class="input-action" id="profile-token-toggle" title="Show/Hide">👁</button>
                <button type="button" class="input-action" id="profile-token-copy" title="Copy">📋</button>
              </div>
              <p class="profile-help">Your SimpleBeacon license token. Click 👁 to reveal, 📋 to copy.</p>
            </div>
            <div class="profile-field">
              <label for="profile-token-password">Token Password</label>
              <input type="password" id="profile-token-password" value="${escapeHtml(profile.tokenPassword || '')}" placeholder="Set a password for token login…" autocomplete="new-password">
              <p class="profile-help">Used when signing in with Token + Password.</p>
            </div>
          </div>
        </div>

        <!-- Account & Token Status -->
        <div class="profile-card">
          <div class="profile-card-header">
            <span class="icon">🎫</span>
            <h2>Account & Token Status</h2>
          </div>
          <div class="profile-card-body">
            <div class="session-grid">
              <div class="session-badge">
                <div class="label">Token Type</div>
                <div class="value">${escapeHtml(tokenType)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Tier</div>
                <div class="value" style="text-transform:capitalize;color:var(--accent);">${escapeHtml(tokenTier)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Account Age</div>
                <div class="value">${escapeHtml(accountAge)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Expires In</div>
                <div class="value" style="color:${expiryInfo.color};">${escapeHtml(expiryInfo.label)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Active</div>
                <div class="value" style="color:${isActive ? 'var(--success)' : 'var(--error)'};">${isActive ? '● Active' : '● Inactive'}</div>
              </div>
              <div class="session-badge">
                <div class="label">Subject</div>
                <div class="value" style="font-size:0.75rem;">${escapeHtml(subLabel)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="profile-card">
          <div class="profile-card-header">
            <span class="icon">⚡</span>
            <h2>Actions</h2>
          </div>
          <div class="profile-actions">
            <button type="button" class="btn btn-primary" id="profile-save-btn">💾 Save Changes</button>
            <button type="button" class="btn btn-secondary" id="profile-clear-cache-btn">🗑️ Clear Cache</button>
            <button type="button" class="btn btn-primary" id="profile-signout-btn" style="background:var(--error);border-color:var(--error);">🚪 Sign Out</button>
          </div>
          <p class="profile-status" id="profile-save-status"></p>
        </div>
      </div>

    `);
        container.appendChild(fragment);
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
                    status.style.color = 'var(--error)';
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
                        toggleBtn.textContent = '🙈';
                        toggleBtn.title = 'Hide token';
                    }
                    else {
                        input.type = 'password';
                        toggleBtn.textContent = '👁';
                        toggleBtn.title = 'Show token';
                    }
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
                    const original = copyBtn.textContent;
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = original; }, 1500);
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
    }
    destroy() { }
}
