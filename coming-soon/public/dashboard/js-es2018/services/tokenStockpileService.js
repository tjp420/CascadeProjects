// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Client-side token stockpile — store purchased time tokens and load them when needed.
 * Backed by localStorage key sb-token-vault (compatible with Settings vault).
 */

const VAULT_KEY = 'sb-token-vault';
export function BUY_TIME_TOKENS_URL() {
    const env = (typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__) || {};
    const base =
        env.DASHBOARD_BASE_URL || (typeof location !== 'undefined' && location.origin) || 'https://simplebeacon.ai';
    return `${base.replace(/\/$/, '')}/checkout/tokens?ref=dashboard`;
}

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(base64 + padding));
    } catch (_a) {
        return null;
    }
}

export function decodeTokenMeta(token) {
    const payload = decodeJwtPayload(token);
    if (!payload) {
        return {
            tier: 'unknown',
            email: '',
            expiresAt: null,
            expiresLabel: 'Unknown',
            period: '',
            timeTokenId: null
        };
    }
    const expMs = payload.exp ? payload.exp * 1000 : null;
    let expiresLabel = 'No expiry';
    if (expMs) {
        const diff = expMs - Date.now();
        if (diff <= 0) expiresLabel = 'Expired';
        else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            expiresLabel =
                days > 0
                    ? `${days} day${days !== 1 ? 's' : ''}`
                    : `${Math.max(1, Math.floor(diff / (1000 * 60 * 60)))}h`;
        }
    }
    return {
        tier: payload.tier || payload.plan || payload.product || 'team',
        email: payload.email || payload.sub || '',
        expiresAt: expMs ? new Date(expMs).toISOString() : null,
        expiresLabel,
        period: payload.period || '',
        timeTokenId: payload.sub || null,
        accountId: payload.account_id || null
    };
}

export function loadStockpileEntries() {
    try {
        const raw = localStorage.getItem(VAULT_KEY);
        const entries = raw ? JSON.parse(raw) : [];
        return Array.isArray(entries) ? entries : [];
    } catch (_a) {
        return [];
    }
}

function saveStockpileEntries(entries) {
    localStorage.setItem(VAULT_KEY, JSON.stringify(entries));
}

export function isStockpiledEntry(entry, activeToken = '') {
    if (!entry) return false;
    if (entry.token === activeToken) return false;
    if (entry.usedAt || entry.activatedAt) return false;
    return entry.stockpiled !== false;
}

export function listStockpiled(activeToken = '') {
    return loadStockpileEntries()
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => isStockpiledEntry(entry, activeToken));
}

export function stockpileCount(activeToken = '') {
    return listStockpiled(activeToken).length;
}

/**
 * Add a time token to the stockpile without activating the session.
 */
export function addToStockpile(token, user = {}, options = {}) {
    const trimmed = String(token || '').trim();
    if (!trimmed) return { ok: false, error: 'Token is required' };
    const entries = loadStockpileEntries();
    if (entries.some(e => e.token === trimmed)) {
        return { ok: true, duplicate: true, index: entries.findIndex(e => e.token === trimmed) };
    }
    const meta = decodeTokenMeta(trimmed);
    const record = {
        id: `tt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        token: trimmed,
        user: user || { email: meta.email, tier: meta.tier },
        addedAt: new Date().toISOString(),
        stockpiled: options.stockpile !== false,
        usedAt: options.stockpile === false ? new Date().toISOString() : null,
        activatedAt: options.stockpile === false ? new Date().toISOString() : null,
        purchasedAt: options.purchasedAt || new Date().toISOString(),
        product: options.product || null,
        label: options.label || `${meta.tier} · ${meta.expiresLabel}`,
        meta
    };
    entries.unshift(record);
    saveStockpileEntries(entries);
    return { ok: true, index: 0, entry: record };
}

export function removeStockpileEntry(index) {
    const entries = loadStockpileEntries();
    if (index < 0 || index >= entries.length) return false;
    entries.splice(index, 1);
    saveStockpileEntries(entries);
    return true;
}

export function clearStockpile() {
    localStorage.removeItem(VAULT_KEY);
}

export function activateStockpileEntry(index, authService) {
    const entries = loadStockpileEntries();
    const entry = entries[index];
    if (!entry) return { ok: false, error: 'Token not found' };
    const meta = decodeTokenMeta(entry.token);
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() <= Date.now()) {
        return { ok: false, error: 'This time token has expired' };
    }
    const user = entry.user || { email: meta.email || 'token-user', tier: meta.tier, tokenSession: true };
    entry.activatedAt = new Date().toISOString();
    entry.usedAt = entry.usedAt || entry.activatedAt;
    entry.stockpiled = false;
    saveStockpileEntries(entries);
    authService.setSession(entry.token, user);
    return { ok: true, entry, user };
}

export function tokenHint(token) {
    if (!token) return '—';
    return token.length > 24 ? `${token.slice(0, 8)}…${token.slice(-8)}` : token;
}
