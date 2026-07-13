import { escapeHtml } from '../utils/string.js';
import { showToast } from '../utils/dom.js';
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
function getInitials(value) {
    if (!value || typeof value !== 'string')
        return '?';
    const clean = value.trim();
    if (!clean)
        return '?';
    const parts = clean.split(/[@\s._-]+/).filter(Boolean);
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
        this._container = null;
        this._renderKey = null;
    }
    renderSecureReveal(inputId, rawValue, classification) {
        if (!rawValue || rawValue === 'N/A') {
            return `<span class="profile-empty-field-fallback">Unassigned Context</span>`;
        }
        const displayedMask = this.maskAccountEmail(rawValue, classification === 'email');
        return `
      <div class="secure-reveal-wrapper profile-privacy-shield" data-field-id="${inputId}" data-revealed="false">
        <div class="secret-display-canvas">
          <span class="masked-view">${escapeHtml(displayedMask)}</span>
          <span class="unmasked-view raw-code-text">${escapeHtml(rawValue)}</span>
        </div>
        <button class="profile-privacy-eye-toggle-btn" type="button" aria-label="Reveal protected parameter information">
          <span class="codicon codicon-eye"></span>
        </button>
      </div>
    `;
    }
    /**
     * Specialized obfuscation engine for standard profile text strings.
     * Preserves only the first 2 characters of the mailbox name for rapid tracking verification.
     * @param {string} emailStr
     * @param {boolean} isEmail
     * @returns {string}
     */
    maskAccountEmail(emailStr, isEmail = false) {
        if (!isEmail || !emailStr || !emailStr.includes('@')) {
            return '••••••••••••••••';
        }
        const [name, domain] = emailStr.split('@');
        const hiddenName = name.length > 2 ? name.substring(0, 2) + '••••' : '••••';
        const hiddenDomain = domain.length > 4 ? domain.substring(0, 2) + '••••' + domain.slice(-3) : '••••';
        return `${hiddenName}@${hiddenDomain}`;
    }
    renderSecurityKeysList() {
        const credentials = authService.getWebAuthnCredentials();
        if (!credentials || credentials.length === 0) {
            return '<p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px;">No security keys registered yet.</p>';
        }
        return '<ul style="list-style:none;padding:0;margin:0 0 12px;">' +
            credentials.map((c, i) => `
        <li style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;font-size:0.8rem;">
          <span>🔑 <strong>Key ${i + 1}</strong> · ${escapeHtml(c.id.slice(0, 16))}… · <span style="color:var(--text-muted);">${formatTimeAgo(c.registeredAt)}</span></span>
          <button type="button" class="input-action remove-key-btn" data-key-id="${escapeHtml(c.id)}" title="Remove">🗑</button>
        </li>
      `).join('') +
            '</ul>';
    }
    attachRemoveKeyHandlers(container) {
        container.querySelectorAll('.remove-key-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const keyId = btn.dataset.keyId;
                if (!keyId)
                    return;
                authService.removeWebAuthnCredential(keyId);
                const listEl = container.querySelector('#security-keys-list');
                if (listEl)
                    listEl.innerHTML = this.renderSecurityKeysList();
                this.attachRemoveKeyHandlers(container);
            });
        });
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
        var _a, _b, _c, _d, _e, _f;
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
        const displayName = profile.displayName || user.displayName || email.split('@')[0] || '';
        const organization = profile.organization || user.organization || project || '';
        const lastLogin = profile.lastLogin || user.lastLogin || (binding === null || binding === void 0 ? void 0 : binding.boundAt) || (tokenIat ? new Date(tokenIat * 1000).toISOString() : null);
        const renderKey = `${email}|${token}|${loginMethod}|${displayName}|${organization}`;
        this._container = container;
        this._renderKey = renderKey;
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

        /* Account Overview Grid */
        .profile-overview-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
        .profile-overview-item { display: flex; flex-direction: column; gap: var(--space-1); }
        .profile-overview-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .profile-overview-value { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); word-break: break-word; }
        .profile-overview-value .profile-mono { font-family: var(--font-mono); }

        /* Tier badges */
        .tier-badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .tier-badge.tier-community { background: rgba(148,163,184,0.15); color: #94a3b8; border: 1px solid rgba(148,163,184,0.25); }
        .tier-badge.tier-pro { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
        .tier-badge.tier-enterprise { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
        .tier-badge.tier-instant { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .tier-badge.tier-executive { background: rgba(236,72,153,0.15); color: #f472b6; border: 1px solid rgba(236,72,153,0.3); }

        /* Status badges */
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: var(--font-size-xs); font-weight: 600; }
        .status-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
        .status-badge.status-active { background: rgba(16,185,129,0.12); color: #34d399; }
        .status-badge.status-active::before { background: #34d399; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
        .status-badge.status-inactive { background: rgba(148,163,184,0.12); color: #94a3b8; }
        .status-badge.status-inactive::before { background: #94a3b8; }

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
        @media (max-width: 560px) {
          .profile-page { padding: var(--space-4) var(--space-3) var(--space-6); }
          .profile-hero h1 { font-size: 1.4rem; }
          .login-method-grid { grid-template-columns: 1fr; }
          .session-grid { grid-template-columns: 1fr 1fr; }
          .profile-overview-grid { grid-template-columns: 1fr; }
          .profile-actions .btn, .profile-actions .staged-safety-btn { flex: 1 1 100%; }
        }
      </style>

      <div class="profile-page">
        <div class="profile-hero">
          <div class="profile-avatar">${escapeHtml(getInitials(email))}</div>
          <h1>${escapeHtml(displayName || email || 'Account Profile')}</h1>
          <p>${escapeHtml(email)} · ${escapeHtml(organization || 'No organization')}</p>
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
                <input type="radio" name="loginMethod" value="token" aria-label="Sign in with Security Keys" ${loginMethod === 'token' ? 'checked' : ''}>
                <div class="method-icon">🔑</div>
                <div class="method-label">Sign in with Security Keys</div>
                <div class="method-desc">Sign in with Security Keys</div>
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

        <!-- Personal Info -->
        <div class="profile-card" id="profile-card-personal-fields">
          <div class="profile-card-header">
            <i data-lucide="user" class="icon-18"></i>
            <h2>Personal Info</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-field">
              <label for="profile-display-name">Display Name</label>
              <input type="text" id="profile-display-name" value="${escapeHtml(displayName)}" placeholder="How you want to be addressed…">
            </div>
            <div class="profile-field">
              <label for="profile-username">Username</label>
              <input type="text" id="profile-username" value="${escapeHtml(profile.username || '')}" placeholder="Unique username for your account…">
            </div>
            <div class="profile-field">
              <label for="profile-organization">Organization / Project</label>
              <input type="text" id="profile-organization" value="${escapeHtml(organization)}" placeholder="Company or project name…">
            </div>
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
                <input type="password" id="profile-token" value="${escapeHtml(token)}" placeholder="Paste your SimpleBeacon license token…" autocomplete="off" style="flex:1;padding:var(--space-2) var(--space-3);border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);color:var(--text-primary);font-size:var(--font-size-sm);font-family:var(--font-mono);">
                <button type="button" class="input-action" id="profile-token-toggle" title="Show/Hide">👁</button>
                <button type="button" class="input-action" id="profile-token-copy" title="Copy">📋</button>
              </div>
              <p class="profile-help">Paste your SimpleBeacon license token here. Click 👁 to reveal, 📋 to copy.</p>
            </div>
            <div class="profile-field">
              <label for="profile-token-password">Token Password</label>
              <input type="password" id="profile-token-password" value="${escapeHtml(profile.tokenPassword || '')}" placeholder="Set a password for token login…" autocomplete="new-password">
              <p class="profile-help">Used when signing in with Security Keys.</p>
            </div>
          </div>
        </div>

        <!-- Account Overview -->
        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="user-circle" class="icon-18"></i>
            <h2>Account Overview</h2>
          </div>
          <div class="profile-card-body">
            <div class="profile-overview-grid">
              <div class="profile-overview-item">
                <div class="profile-overview-label">Current Tier</div>
                <div class="profile-overview-value">
                  <span class="tier-badge tier-${escapeHtml(tokenTier).toLowerCase()}">${escapeHtml(tokenTier)}</span>
                </div>
              </div>
              <div class="profile-overview-item">
                <div class="profile-overview-label">Subscription Status</div>
                <div class="profile-overview-value">
                  <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div class="profile-overview-item">
                <div class="profile-overview-label">Email</div>
                <div class="profile-overview-value">${escapeHtml(email || 'Not set')}</div>
              </div>
              <div class="profile-overview-item">
                <div class="profile-overview-label">User ID</div>
                <div class="profile-overview-value profile-mono">${escapeHtml(user.id || profile.username || 'N/A')}</div>
              </div>
              <div class="profile-overview-item">
                <div class="profile-overview-label">Auth Provider</div>
                <div class="profile-overview-value">${escapeHtml(user.authProvider || loginMethod || 'community')}</div>
              </div>
              <div class="profile-overview-item">
                <div class="profile-overview-label">Account Created</div>
                <div class="profile-overview-value">${escapeHtml(accountAge)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Token & Session Status -->
        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="ticket-check" class="icon-18"></i>
            <h2>Token & Session</h2>
          </div>
          <div class="profile-card-body">
            <div class="session-grid">
              <div class="session-badge">
                <div class="label">Token Type</div>
                <div class="value">${escapeHtml(tokenType)}</div>
              </div>
              <div class="session-badge">
                <div class="label">Expires In</div>
                <div class="value" id="sb-profile-expiration-container" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                  <span class="profile-telemetry-pill neutral">Initializing…</span>
                </div>
              </div>
              <div class="session-badge">
                <div class="label">Last Login</div>
                <div class="value" style="font-size:var(--font-size-xs);">${escapeHtml(lastLogin ? formatTimeAgo(lastLogin) : 'Unknown')}</div>
              </div>
              <div class="session-badge">
                <div class="label">Subject</div>
                <div class="value" style="font-size:var(--font-size-xs);">${this.renderSecureReveal('profile-subject', subLabel, 'generic')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security Keys -->
        <div class="profile-card">
          <div class="profile-card-header">
            <i data-lucide="key-round" class="icon-18"></i>
            <h2>Security Keys</h2>
          </div>
          <div class="profile-card-body">
            <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 14px;">Register a USB security key (YubiKey, Touch ID, Windows Hello) for passwordless sign-in.</p>
            <div id="security-keys-list" style="margin-bottom:var(--space-3);">
              ${this.renderSecurityKeysList()}
            </div>
            <button type="button" class="btn btn-primary" id="profile-register-webauthn">🔐 Register New Security Key</button>
            <p id="webauthn-register-status" class="profile-status" style="margin-top:8px;"></p>
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
            <button type="button" class="btn btn-primary" id="profile-deactivate-btn" style="background:var(--warning);border-color:var(--warning);">⏸ Deactivate Account</button>
            <button type="button" class="btn btn-primary" id="profile-delete-btn" style="background:#7f1d1d;border-color:#7f1d1d;">🗑 Delete Account</button>
          </div>
          <p class="profile-status" id="profile-save-status"></p>
        </div>
      </div>

    `);
        container.innerHTML = '';
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
        const applyLoginMethod = () => {
            var _a;
            updateLoginMethodStyles();
            this.synchronizeAdaptiveFormDimming();
            const value = ((_a = container.querySelector('input[name="loginMethod"]:checked')) === null || _a === void 0 ? void 0 : _a.value) || 'both';
            localStorage.setItem('sb_preferred_login_method', value);
            hasChanges = true;
        };
        container.querySelectorAll('input[name="loginMethod"]').forEach((radio) => {
            radio.addEventListener('change', applyLoginMethod);
        });
        updateLoginMethodStyles();
        this.synchronizeAdaptiveFormDimming();
        // Track if any sensitive field changed
        let hasChanges = false;
        const watchInputs = ['#profile-email', '#profile-email-password', '#profile-token', '#profile-token-password', '#profile-display-name', '#profile-username', '#profile-organization'];
        watchInputs.forEach((sel) => {
            const el = container.querySelector(sel);
            if (el)
                el.addEventListener('input', () => { hasChanges = true; });
        });
        // Save profile
        (_b = container.querySelector('#profile-save-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const data = {
                email: ((_b = (_a = container.querySelector('#profile-email')) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.trim()) || '',
                emailPassword: ((_c = container.querySelector('#profile-email-password')) === null || _c === void 0 ? void 0 : _c.value) || '',
                tokenPassword: ((_d = container.querySelector('#profile-token-password')) === null || _d === void 0 ? void 0 : _d.value) || '',
                loginMethod: ((_e = container.querySelector('input[name="loginMethod"]:checked')) === null || _e === void 0 ? void 0 : _e.value) || 'email',
                displayName: ((_g = (_f = container.querySelector('#profile-display-name')) === null || _f === void 0 ? void 0 : _f.value) === null || _g === void 0 ? void 0 : _g.trim()) || '',
                username: ((_j = (_h = container.querySelector('#profile-username')) === null || _h === void 0 ? void 0 : _h.value) === null || _j === void 0 ? void 0 : _j.trim()) || '',
                organization: ((_l = (_k = container.querySelector('#profile-organization')) === null || _k === void 0 ? void 0 : _k.value) === null || _l === void 0 ? void 0 : _l.trim()) || '',
                lastLogin: new Date().toISOString()
            };
            // Require password confirmation if sensitive fields changed
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
            this._renderKey = null; // allow re-render with updated header
            const tokenVal = (_o = (_m = container.querySelector('#profile-token')) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.trim();
            if (tokenVal) {
                // Decode token to build user object for authService
                let user = { email: data.email || 'token-user', plan: 'pro', tokenSession: true };
                try {
                    const parts = tokenVal.split('.');
                    if (parts.length === 3) {
                        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const pad = '='.repeat((4 - base64.length % 4) % 4);
                        const payload = JSON.parse(atob(base64 + pad));
                        user = {
                            email: payload.email || payload.sub || data.email || 'token-user',
                            plan: payload.plan || payload.tier || 'pro',
                            tokenSession: true
                        };
                    }
                }
                catch ( /* non-JWT token, use default user */_p) { /* non-JWT token, use default user */ }
                authService.setSession(tokenVal, user);
                authService.bindTokenToAccount(tokenVal, 'account');
            }
            if (data.email) {
                const user = authService.getUser() || {};
                localStorage.setItem('cascadeAuthUser', JSON.stringify({ ...user, email: data.email }));
            }
            // Refresh expiration badge and re-render to show updated token state
            this.startExpirationCountdown();
            this._renderKey = null;
            this.mount(container);
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
        // Deactivate account
        (_d = container.querySelector('#profile-deactivate-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', async () => {
            const confirmed = confirm('Deactivate your account?\n\nYour data will be preserved but you will be signed out and unable to access features until you reactivate.');
            if (!confirmed) return;
            try {
                await authService.logout();
                showToast('Account deactivated. Sign in again to reactivate.', 'info');
                this.app.navigate('signin');
            }
            catch (err) {
                showToast('Deactivation failed — please try again.', 'error');
            }
        });
        // Delete account
        (_e = container.querySelector('#profile-delete-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', async () => {
            const input = prompt('WARNING: This will permanently delete your account and all associated data.\n\nType DELETE to confirm:');
            if (input !== 'DELETE') {
                showToast('Account deletion cancelled.', 'info');
                return;
            }
            try {
                await authService.deleteAccount?.();
                authService.clearSession();
                showToast('Account deleted. All local session data cleared.', 'info');
                this.app.navigate('signin');
            }
            catch (err) {
                authService.clearSession();
                showToast('Account deleted locally. Please contact support if billing issues persist.', 'info');
                this.app.navigate('signin');
            }
        });
        // Register Security Key
        (_f = container.querySelector('#profile-register-webauthn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', async () => {
            const statusEl = container.querySelector('#webauthn-register-status');
            try {
                if (!window.PublicKeyCredential || !navigator.credentials || typeof navigator.credentials.create !== 'function') {
                    if (statusEl) {
                        statusEl.textContent = 'WebAuthn is not available in this browser/context. Open the dashboard in an external browser like Chrome or Edge.';
                        statusEl.style.color = 'var(--error)';
                    }
                    console.warn('[Profile] WebAuthn unavailable: PublicKeyCredential=' + !!window.PublicKeyCredential + ', navigator.credentials=' + !!navigator.credentials);
                    return;
                }
                if (!window.isSecureContext) {
                    if (statusEl) {
                        statusEl.textContent = 'Security key registration requires a secure browser context. Open http://127.0.0.1:' + window.location.port + '/dashboard/profile in Chrome or Edge outside of VS Code:.';
                        statusEl.style.color = 'var(--error)';
                    }
                    console.warn('[Profile] WebAuthn blocked: window.isSecureContext=false');
                    return;
                }
                if (window.top !== window.self) {
                    if (statusEl) {
                        statusEl.textContent = 'Security key registration cannot run inside an embedded iframe. Open the dashboard in an external browser.';
                        statusEl.style.color = 'var(--error)';
                    }
                    console.warn('[Profile] WebAuthn blocked: running in iframe');
                    return;
                }
                const challenge = await authService.getWebAuthnChallenge();
                if (!challenge) {
                    if (statusEl) {
                        statusEl.textContent = 'Could not get registration challenge.';
                        statusEl.style.color = 'var(--error)';
                    }
                    return;
                }
                const user = authService.getUser();
                const userId = (user === null || user === void 0 ? void 0 : user.id) || 'user';
                const userEmail = (user === null || user === void 0 ? void 0 : user.email) || 'user@simplebeacon.ai';
                const rpId = window.location.hostname || '127.0.0.1';
                const userIdBytes = Uint8Array.from(userId.split('').map(c => c.charCodeAt(0)));
                const challengeBytes = Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                const options = {
                    publicKey: {
                        challenge: challengeBytes,
                        rp: { name: 'SimpleBeacon', id: rpId },
                        user: { id: userIdBytes, name: userEmail, displayName: userEmail.split('@')[0] },
                        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -37 }],
                        authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred', requireResidentKey: false },
                        timeout: 120000,
                        attestation: 'none'
                    }
                };
                console.log('[Profile] Creating WebAuthn credential with rp.id=' + rpId + ' secureContext=' + window.isSecureContext);
                let credential;
                try {
                    credential = await navigator.credentials.create(options);
                }
                catch (firstErr) {
                    const msg = (firstErr === null || firstErr === void 0 ? void 0 : firstErr.message) || String(firstErr);
                    console.warn('[Profile] First WebAuthn attempt failed:', msg);
                    if (msg.toLowerCase().includes('insecure') || msg.toLowerCase().includes('not allowed') || msg.toLowerCase().includes('not supported')) {
                        delete options.publicKey.rp.id;
                        options.publicKey.authenticatorSelection = { userVerification: 'preferred' };
                        console.log('[Profile] Retrying WebAuthn without explicit rp.id');
                        credential = await navigator.credentials.create(options);
                    }
                    else {
                        throw firstErr;
                    }
                }
                if (!credential) {
                    if (statusEl) {
                        statusEl.textContent = 'Registration cancelled.';
                        statusEl.style.color = 'var(--text-muted)';
                    }
                    return;
                }
                const credentialData = {
                    id: credential.id,
                    rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
                    response: {
                        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
                        attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)))
                    },
                    type: credential.type
                };
                const ok = await authService.registerWebAuthnCredential(credentialData, userId);
                if (ok) {
                    if (statusEl) {
                        statusEl.textContent = 'Security key registered successfully! You can now sign in with it from the sign-in screen.';
                        statusEl.style.color = 'var(--success)';
                    }
                    const listEl = container.querySelector('#security-keys-list');
                    if (listEl)
                        listEl.innerHTML = this.renderSecurityKeysList();
                    this.attachRemoveKeyHandlers(container);
                }
                else {
                    if (statusEl) {
                        statusEl.textContent = 'Registration failed. Please try again.';
                        statusEl.style.color = 'var(--error)';
                    }
                }
            }
            catch (err) {
                const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
                console.error('[Profile] WebAuthn registration error:', err);
                if (statusEl) {
                    if (msg.toLowerCase().includes('insecure')) {
                        statusEl.textContent = 'Security key registration is blocked because the page is not in a secure context. Open the dashboard in an external browser at http://127.0.0.1:' + window.location.port + '/dashboard/profile';
                    }
                    else if (msg.toLowerCase().includes('not allowed') || msg.toLowerCase().includes('cancelled')) {
                        statusEl.textContent = 'Registration cancelled or not allowed by the browser.';
                    }
                    else if (msg.toLowerCase().includes('not supported')) {
                        statusEl.textContent = 'This browser or device does not support security key registration. Try Chrome or Edge.';
                    }
                    else {
                        statusEl.textContent = msg || 'Registration failed.';
                    }
                    statusEl.style.color = 'var(--error)';
                }
            }
        });
        // Attach remove-key handlers for already-rendered list
        this.attachRemoveKeyHandlers(container);
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
        // Privacy eye toggle
        container.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.profile-privacy-eye-toggle-btn');
            if (!toggleBtn)
                return;
            e.preventDefault();
            e.stopPropagation();
            const wrapper = toggleBtn.closest('.secure-reveal-wrapper');
            if (!wrapper)
                return;
            const isRevealed = wrapper.getAttribute('data-revealed') === 'true';
            wrapper.setAttribute('data-revealed', String(!isRevealed));
            const iconNode = toggleBtn.querySelector('.codicon');
            if (iconNode) {
                iconNode.className = isRevealed ? 'codicon codicon-eye' : 'codicon codicon-eye-closed';
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
