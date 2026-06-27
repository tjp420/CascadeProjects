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
        this._countdownInterval = null;
        this._safetyTimer = null;
    }
    renderSecureReveal(inputId, rawValue, classification) {
        if (!rawValue || rawValue === 'N/A') {
            return `<span class="empty-fallback-text">Unassigned Context</span>`;
        }
        let masked = '••••••••••••••••';
        if (classification === 'email' && rawValue.includes('@')) {
            const [name, domain] = rawValue.split('@');
            masked = `${name.substring(0, 3)}••••@${domain.substring(0, 3)}••••`;
        }
        else if (rawValue.length > 12) {
            masked = `${rawValue.substring(0, 6)}••••••••${rawValue.slice(-4)}`;
        }
        return `
      <div class="secure-reveal-wrapper profile-privacy-box" data-revealed="false">
        <div class="secret-display-canvas">
          <span class="masked-view">${escapeHtml(masked)}</span>
          <span class="unmasked-view raw-code-text">${escapeHtml(rawValue)}</span>
        </div>
        <button class="profile-privacy-eye-toggle" type="button" aria-label="Toggle visibility">
          <i data-lucide="eye" class="icon-14"></i>
        </button>
      </div>
    `;
    }
    synchronizeAdaptiveFormDimming() {
        var _a;
        const activeSelection = ((_a = document.querySelector('input[name="loginMethod"]:checked')) === null || _a === void 0 ? void 0 : _a.value) || 'both';
        const emailCard = document.getElementById('profile-card-email-fields');
        const tokenCard = document.getElementById('profile-card-token-fields');
        if (!emailCard || !tokenCard)
            return;
        emailCard.classList.remove('context-disabled-dim');
        tokenCard.classList.remove('context-disabled-dim');
        if (activeSelection === 'email') {
            tokenCard.classList.add('context-disabled-dim');
        }
        else if (activeSelection === 'token') {
            emailCard.classList.add('context-disabled-dim');
        }
    }
    executeHardCacheCleanup(buttonDomRef) {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb_') || k.includes('simplebeacon'));
        keys.forEach((k) => localStorage.removeItem(k));
        showToast('Workspace state caches cleared successfully. Reloading workspace context layers.', 'success');
        if (buttonDomRef) {
            const textEl = buttonDomRef.querySelector('.btn-text');
            if (textEl)
                textEl.textContent = 'Wiped Clean!';
        }
        setTimeout(() => window.location.reload(), 1200);
    }
    startExpirationCountdown() {
        var _a, _b;
        const token = (typeof authService !== 'undefined' ? authService.getToken() : null) || ((_b = (_a = this.app) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.token) || '';
        if (!token)
            return;
        const payload = decodeJwtPayload(token);
        if (!payload || !payload.exp) {
            this.updateExpirationBadge(null, 'Static Key / Non-JWT');
            return;
        }
        const expirationTimestampMs = payload.exp * 1000;
        if (this._countdownInterval)
            clearInterval(this._countdownInterval);
        this.tickExpiration(expirationTimestampMs);
        this._countdownInterval = setInterval(() => {
            this.tickExpiration(expirationTimestampMs);
        }, 60000);
    }
    tickExpiration(expirationMs) {
        const nowMs = Date.now();
        const remainingMs = expirationMs - nowMs;
        if (remainingMs <= 0) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
            this.updateExpirationBadge('expired', 'Session Expired');
            return;
        }
        const totalHours = remainingMs / (1000 * 60 * 60);
        let state = 'safe';
        let displayString = '';
        if (totalHours <= 2) {
            state = 'critical';
            const mins = Math.max(1, Math.round(remainingMs / (1000 * 60)));
            displayString = `Expires in ${mins}m`;
        }
        else if (totalHours < 24) {
            state = 'warning';
            displayString = `Expires in ${Math.round(totalHours)}h`;
        }
        else {
            const days = Math.floor(totalHours / 24);
            const hoursLeft = Math.round(totalHours % 24);
            displayString = days > 0 ? `${days}d ${hoursLeft}h left` : `${hoursLeft}h left`;
        }
        this.updateExpirationBadge(state, displayString);
    }
    updateExpirationBadge(state, text) {
        const container = document.getElementById('sb-profile-expiration-container');
        if (!container)
            return;
        if (!state) {
            container.innerHTML = `<span class="profile-telemetry-pill neutral">${escapeHtml(text)}</span>`;
            return;
        }
        const refreshLink = state === 'critical'
            ? ` <a href="#" class="profile-session-refresh-link" id="sb-profile-refresh-session-action">Refresh Session</a>`
            : '';
        container.innerHTML = `
      <span class="profile-telemetry-pill pulse-badge-${state}" data-urgency="${state}">${escapeHtml(text)}</span>${refreshLink}
    `;
    }
    mount(container) {
        var _a, _b, _c;
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
        .profile-page { max-width: 720px; margin: 0 auto; padding: var(--space-6) var(--space-4) var(--space-8); }
        .profile-hero { text-align: center; margin-bottom: var(--space-6); }
        .profile-hero h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 var(--space-2); letter-spacing: -0.02em; }
        .profile-hero p { color: var(--text-muted); font-size: 0.95rem; margin: 0 auto; max-width: 420px; }
        .profile-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; margin: 0 auto var(--space-4); color: #fff; font-weight: 700; box-shadow: var(--shadow-lg); }
        .profile-card { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); margin-bottom: var(--space-4); overflow: hidden; }
        .profile-card-header { padding: var(--space-4) var(--space-5) 0; display: flex; align-items: center; gap: var(--space-2); }
        .profile-card-header i { color: var(--primary); }
        .profile-card-header h2 { font-size: var(--font-size-base); font-weight: 700; margin: 0; color: var(--text-primary); }
        .profile-card-body { padding: var(--space-3) var(--space-5) var(--space-4); }
        .profile-field { margin-bottom: var(--space-4); }
        .profile-field:last-child { margin-bottom: 0; }
        .profile-field label { display: block; font-size: var(--font-size-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1); }
        .profile-field input { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text-primary); font-size: var(--font-size-sm); transition: border-color var(--transition), box-shadow var(--transition); }
        .profile-field input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }
        .profile-input-group { display: flex; gap: var(--space-2); align-items: stretch; }
        .profile-input-group input { flex: 1; }
        .profile-input-group .input-action { padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text-secondary); font-size: var(--font-size-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .profile-input-group .input-action:hover { background: var(--surface-hover); color: var(--primary); border-color: var(--primary); }
        .profile-help { font-size: var(--font-size-xs); color: var(--text-muted); margin: var(--space-1) 0 0; }
        .login-method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
        .login-method-card { position: relative; padding: var(--space-3) var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: pointer; text-align: center; transition: all var(--transition); background: var(--surface); }
        .login-method-card:hover { border-color: var(--primary); }
        .login-method-card.active { border-color: var(--primary); background: rgba(99, 102, 241, 0.08); }
        .login-method-card input { position: absolute; top: var(--space-2); right: var(--space-2); accent-color: var(--primary); }
        .login-method-card .method-icon { font-size: 1.3rem; margin-bottom: 6px; }
        .login-method-card .method-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); }
        .login-method-card .method-desc { font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 2px; }
        .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); }
        .session-badge { padding: var(--space-3); border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--border); }
        .session-badge .label { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: var(--space-1); }
        .session-badge .value { font-size: var(--font-size-base); font-weight: 700; color: var(--text-primary); }
        .profile-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; padding: var(--space-3) var(--space-5); }
        .profile-actions .btn { flex: 1; min-width: 120px; }
        .profile-status { padding: 0 var(--space-5) var(--space-4); margin: 0; font-size: var(--font-size-sm); min-height: 1.2em; color: var(--success); }

        /* Live expiration telemetry */
        .profile-telemetry-pill { font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; letter-spacing: 0.2px; }
        .profile-telemetry-pill.neutral { background: var(--surface); color: var(--text-muted); }
        .profile-telemetry-pill.pulse-badge-safe { background: rgba(16,185,129,0.15); color: #34d399; }
        .profile-telemetry-pill.pulse-badge-warning { background: rgba(245,158,11,0.15); color: #fbbf24; }
        .profile-telemetry-pill.pulse-badge-expired { background: rgba(148,163,184,0.15); color: var(--text-muted); text-decoration: line-through; }
        .profile-telemetry-pill.pulse-badge-critical { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); animation: criticalTelemetryFlash 1.5s infinite ease-in-out; }
        .profile-session-refresh-link { font-size: 0.75rem; color: #60a5fa; text-decoration: none; margin-left: 8px; font-weight: 500; }
        .profile-session-refresh-link:hover { color: #3b82f6; text-decoration: underline; }
        @keyframes criticalTelemetryFlash { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { opacity: 0.75; box-shadow: 0 0 8px 2px rgba(239,68,68,0.2); } }

        /* Privacy obfuscation */
        .secure-reveal-wrapper { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .profile-privacy-box { background: var(--surface); border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; width: 100%; }
        .secret-display-canvas { display: flex; align-items: center; min-width: 0; }
        .masked-view { font-family: var(--font-mono); font-size: var(--font-size-sm); color: var(--text-primary); }
        .unmasked-view { display: none; font-family: var(--font-mono); font-size: var(--font-size-sm); color: var(--text-primary); word-break: break-all; }
        .secure-reveal-wrapper[data-revealed="true"] .masked-view { display: none; }
        .secure-reveal-wrapper[data-revealed="true"] .unmasked-view { display: inline; }
        .profile-privacy-eye-toggle { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 4px; display: flex; align-items: center; flex-shrink: 0; }
        .profile-privacy-eye-toggle:hover { color: var(--text-primary); }
        .empty-fallback-text { font-size: var(--font-size-sm); color: var(--text-muted); }

        /* Adaptive form dimming */
        .credentials-section-card { transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s ease; opacity: 1; }
        .credentials-section-card.context-disabled-dim { opacity: 0.3; pointer-events: none; transform: scale(0.99); filter: grayscale(40%); }

        /* Staged safety destruction button */
        .safety-button-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .staged-safety-btn { background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 10px 16px; border-radius: var(--radius-lg); font-size: var(--font-size-sm); font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .staged-safety-btn:hover { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.4); }
        .staged-safety-btn.is-staged-warning { background: rgba(245,158,11,0.15) !important; border-color: #f59e0b !important; color: #fbbf24 !important; cursor: not-allowed; pointer-events: none; }
        .staged-safety-btn.is-fully-unlocked { background: #ef4444 !important; border-color: #ef4444 !important; color: #fff !important; animation: criticalDestructionPulse 1s infinite alternate; }
        @keyframes criticalDestructionPulse { from { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } to { box-shadow: 0 0 12px 3px rgba(239,68,68,0.2); } }
      </style>

      <div class="profile-page">
        <div class="profile-hero">
          <div class="profile-avatar">${email ? escapeHtml(email[0].toUpperCase()) : '?'}</div>
          <h1>Account Profile</h1>
          <p>Manage your credentials, license token, and session settings.</p>
        </div>

        <!-- Login Method -->
        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="lock-keyhole" class="icon-18"></i>
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
            <p class="profile-help" style="margin-top:var(--space-3);">Choose how you want to authenticate on this device. Your choice is saved locally.</p>
          </div>
        </div>

        <!-- Email Credentials -->
        <div class="profile-card credentials-section-card" id="profile-card-email-fields">
          <div class="profile-card-header">
            <i data-lucide="mail" class="icon-18"></i>
            <h2>Email Credentials</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-field">
              <label for="profile-email">Email Address</label>
              ${this.renderSecureReveal('profile-email', email, 'email')}
            </div>
            <div class="profile-field">
              <label for="profile-email-password">Email Password</label>
              <input type="password" id="profile-email-password" value="${escapeHtml(profile.emailPassword || '')}" placeholder="Set a password for email login…" autocomplete="new-password">
              <p class="profile-help">Used when signing in with Email + Password.</p>
            </div>
          </div>
        </div>

        <!-- Token Credentials -->
        <div class="profile-card credentials-section-card" id="profile-card-token-fields">
          <div class="profile-card-header">
            <i data-lucide="key-round" class="icon-18"></i>
            <h2>License Token</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-field">
              <label for="profile-token">Token</label>
              <div class="profile-input-group">
                ${this.renderSecureReveal('profile-token', token, 'token')}
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
            <i data-lucide="ticket-check" class="icon-18"></i>
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
                <div class="value" style="text-transform:capitalize;color:var(--primary);">${escapeHtml(tokenTier)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Account Age</div>
                <div class="value">${escapeHtml(accountAge)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Expires In</div>
                <div class="value" id="sb-profile-expiration-container" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                  <span class="profile-telemetry-pill neutral">Initializing…</span>
                </div>
              </div>
              <div class="session-badge">
                <div class="label">Active</div>
                <div class="value" style="color:${isActive ? 'var(--success)' : 'var(--error)'};">${isActive ? '● Active' : '● Inactive'}</div>
              </div>
              <div class="session-badge">
                <div class="label">Subject</div>
                <div class="value" style="font-size:var(--font-size-xs);">${this.renderSecureReveal('profile-subject', subLabel, 'generic')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="zap" class="icon-18"></i>
            <h2>Actions</h2>
          </div>
          <div class="profile-actions safety-button-row">
            <button type="button" class="btn btn-primary" id="profile-save-btn">💾 Save Changes</button>
            <button type="button" class="staged-safety-btn" id="sb-staged-clear-cache-btn" data-stage="0">
              <i data-lucide="trash-2" class="icon-14"></i>
              <span class="btn-text">Wipe Cache Metadata</span>
            </button>
            <button type="button" class="btn btn-primary" id="profile-signout-btn" style="background:var(--error);border-color:var(--error);">🚪 Sign Out</button>
          </div>
          <p class="profile-status" id="profile-save-status"></p>
        </div>
      </div>

    `);
        container.appendChild(fragment);
        // Start live token expiration countdown
        this.startExpirationCountdown();
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
        // Adaptive form dimming
        this.synchronizeAdaptiveFormDimming();
        container.querySelectorAll('input[name="loginMethod"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                var _a;
                this.synchronizeAdaptiveFormDimming();
                localStorage.setItem('sb_preferred_login_method', ((_a = document.querySelector('input[name="loginMethod"]:checked')) === null || _a === void 0 ? void 0 : _a.value) || 'both');
            });
        });
        // Privacy eye toggle
        container.addEventListener('click', (e) => {
            const eyeToggle = e.target.closest('.profile-privacy-eye-toggle');
            if (!eyeToggle)
                return;
            e.stopPropagation();
            const wrapper = eyeToggle.closest('.secure-reveal-wrapper');
            if (!wrapper)
                return;
            const isRevealed = wrapper.getAttribute('data-revealed') === 'true';
            wrapper.setAttribute('data-revealed', String(!isRevealed));
            const icon = eyeToggle.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isRevealed ? 'eye' : 'eye-off');
            }
        });
        // Staged double-confirmation cache clear
        container.addEventListener('click', (e) => {
            const safetyBtn = e.target.closest('#sb-staged-clear-cache-btn');
            if (!safetyBtn)
                return;
            e.preventDefault();
            e.stopPropagation();
            const currentStage = parseInt(safetyBtn.getAttribute('data-stage'), 10);
            const btnTextElement = safetyBtn.querySelector('.btn-text');
            if (currentStage === 0) {
                safetyBtn.setAttribute('data-stage', '1');
                safetyBtn.classList.add('is-staged-warning');
                let countdownSeconds = 3;
                if (btnTextElement)
                    btnTextElement.textContent = `Confirm Invalidate? (${countdownSeconds}s)`;
                this._safetyTimer = setInterval(() => {
                    countdownSeconds--;
                    if (countdownSeconds > 0) {
                        if (btnTextElement)
                            btnTextElement.textContent = `Confirm Invalidate? (${countdownSeconds}s)`;
                    }
                    else {
                        clearInterval(this._safetyTimer);
                        this._safetyTimer = null;
                        safetyBtn.setAttribute('data-stage', '2');
                        safetyBtn.classList.remove('is-staged-warning');
                        safetyBtn.classList.add('is-fully-unlocked');
                        if (btnTextElement)
                            btnTextElement.textContent = 'Commit Cache Obliteration';
                    }
                }, 1000);
            }
            else if (currentStage === 2) {
                clearInterval(this._safetyTimer);
                this._safetyTimer = null;
                this.executeHardCacheCleanup(safetyBtn);
            }
        });
        // Reset staged button if mouse leaves it
        container.addEventListener('mouseleave', (e) => {
            const safetyBtn = e.target.closest('#sb-staged-clear-cache-btn');
            if (!safetyBtn)
                return;
            clearInterval(this._safetyTimer);
            this._safetyTimer = null;
            safetyBtn.setAttribute('data-stage', '0');
            safetyBtn.classList.remove('is-staged-warning', 'is-fully-unlocked');
            const btnTextElement = safetyBtn.querySelector('.btn-text');
            if (btnTextElement)
                btnTextElement.textContent = 'Wipe Cache Metadata';
        }, true);
        // Refresh session link
        container.addEventListener('click', (e) => {
            const refreshLink = e.target.closest('#sb-profile-refresh-session-action');
            if (!refreshLink)
                return;
            e.preventDefault();
            if (typeof showLoginModal === 'function') {
                showLoginModal({
                    message: 'Your session has reached a critical expiration threshold. Re-authenticate to fortify operations.',
                    onSuccess: () => this.startExpirationCountdown()
                });
            }
            else {
                const vscode = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function' ? window.acquireVsCodeApi() : null;
                if (vscode) {
                    vscode.postMessage({ command: 'refreshToken' });
                }
                else {
                    showToast('Refresh session via the extension login command.', 'info');
                }
            }
        });
    }
    destroy() {
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
        if (this._safetyTimer) {
            clearInterval(this._safetyTimer);
            this._safetyTimer = null;
        }
    }
}
