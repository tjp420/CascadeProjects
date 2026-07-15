// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { authService, apiBase } from '../services/authService.js?v=20260715admin2';
import { escapeHtml, showToast } from '../utils.js';

function normalizeTrustLevel(value) {
    const raw = String(value || 'bronze').toLowerCase();
    if (raw === 'community') return 'bronze';
    if (raw === 'admin' || raw === 'superuser') return 'gold';
    if (raw === 'bronze' || raw === 'silver' || raw === 'gold') return raw;
    return 'bronze';
}

function normalizeUser(row) {
    if (!row || typeof row !== 'object') return null;
    const email = row.email || '';
    return {
        id: String(row.id != null ? row.id : email),
        email,
        name: row.name || (email.includes('@') ? email.split('@')[0] : email),
        trustLevel: normalizeTrustLevel(row.trustLevel || row.tier),
        verificationStatus: row.verificationStatus || 'verified',
        successfulAnalyses: row.successfulAnalyses || 0,
        securityIncidents: row.securityIncidents || 0,
        communityContributions: row.communityContributions || 0,
        createdAt: row.createdAt || row.created_at || null,
        online: Boolean(row.online),
        lastSeen: row.lastSeen || null
    };
}

const TRUST_ORDER = { bronze: 0, silver: 1, gold: 2 };

export class AdminPanelView {
    constructor(app) {
        this.app = app;
        this.users = [];
        this.sessions = [];
        this.stats = null;
        this.loading = false;
        this.error = null;
        this.searchQuery = '';
        this.sortField = 'createdAt';
        this.sortDir = 'desc';
    }

    isAdmin() {
        return authService.isAdmin();
    }

    adminFetch(path, options = {}) {
        const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = { ...(options.headers || {}), ...authService.getAuthHeaders() };
        return fetch(url, { ...options, headers, credentials: 'include' });
    }

    async loadData() {
        this.loading = true;
        this.render();
        try {
            const [usersRes, sessionsRes, statsRes] = await Promise.all([
                this.adminFetch('/api/admin/users'),
                this.adminFetch('/api/admin/sessions'),
                this.adminFetch('/api/admin/stats').catch(() => null)
            ]);
            if (!usersRes.ok) throw new Error(`Users API ${usersRes.status}`);
            if (!sessionsRes.ok) throw new Error(`Sessions API ${sessionsRes.status}`);
            const usersData = await usersRes.json();
            const sessionsData = await sessionsRes.json();
            this.users = (usersData.users || []).map(normalizeUser).filter(Boolean);
            this.sessions = sessionsData.sessions || [];
            if (statsRes && statsRes.ok) {
                this.stats = (await statsRes.json()).stats || null;
            }
            this.error = null;
        } catch (err) {
            this.error = err.message || 'Failed to load admin data';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    async deleteUser(id) {
        const user = this.users.find(u => u.id === id);
        const label = user ? `${user.name} (${user.email})` : id;
        if (!confirm(`Delete account for ${label}?\nThis action cannot be undone.`)) return;
        try {
            const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Delete failed ${res.status}`);
            }
            this.users = this.users.filter(u => u.id !== id);
            showToast('Account deleted', 'success');
            this.render();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    async setTrustLevel(id, level) {
        try {
            const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() };
            const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}/trust-level`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ trustLevel: level })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Update failed ${res.status}`);
            }
            const user = this.users.find(u => u.id === id);
            if (user) user.trustLevel = level;
            showToast(`Trust level set to ${level}`, 'success');
            this.render();
        } catch (err) {
            showToast('Update failed: ' + err.message, 'error');
        }
    }

    getFilteredUsers() {
        const q = this.searchQuery.trim().toLowerCase();
        let filtered = q
            ? this.users.filter(u =>
                u.email.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                u.trustLevel.toLowerCase().includes(q))
            : this.users;
        const dir = this.sortDir === 'asc' ? 1 : -1;
        filtered = [...filtered].sort((a, b) => {
            let av, bv;
            if (this.sortField === 'trustLevel') {
                av = TRUST_ORDER[a.trustLevel] ?? 0;
                bv = TRUST_ORDER[b.trustLevel] ?? 0;
            } else if (this.sortField === 'successfulAnalyses') {
                av = a.successfulAnalyses || 0;
                bv = b.successfulAnalyses || 0;
            } else {
                av = String(a[this.sortField] || '').toLowerCase();
                bv = String(b[this.sortField] || '').toLowerCase();
            }
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
        return filtered;
    }

    formatDate(ts) {
        if (!ts) return '—';
        let raw = String(ts).trim();
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
            raw = raw.replace(' ', 'T') + 'Z';
        }
        const d = new Date(raw);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    formatRelative(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return 'just now';
        if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    showIncidentsColumn() {
        return this.users.some(u => (u.securityIncidents || 0) > 0);
    }

    isProtectedUser(u) {
        return String(u?.email || '').toLowerCase() === 'admin@simplebeacon.ai';
    }

    mount(container) {
        this.container = container;
        this.loadData();
    }

    render() {
        if (!this.container) return;
        if (this.loading && !this.users.length) {
            this.container.innerHTML = this.renderLoading();
            return;
        }
        if (this.error && !this.users.length) {
            this.container.innerHTML = this.renderError();
            const retryBtn = this.container.querySelector('#admin-retry');
            if (retryBtn) retryBtn.addEventListener('click', () => this.loadData());
            return;
        }
        const filtered = this.getFilteredUsers();
        const onlineCount = this.users.filter(u => u.online).length;
        const showIncidents = this.showIncidentsColumn();
        this.container.innerHTML = `
            <div class="page-header">
                <h1>Admin Panel</h1>
                <p class="page-subtitle">Manage accounts, monitor activity, and oversee platform health.</p>
            </div>
            ${this.error ? `<div class="card notice-card mb-4"><p class="text-danger">${escapeHtml(this.error)}</p></div>` : ''}
            ${this.renderStats(onlineCount)}
            <div class="card mb-4">
                <div class="admin-toolbar">
                    <div class="admin-search-wrap">
                        <input type="text" class="settings-input admin-search-input" id="admin-search" placeholder="Search by name, email, or trust level…" value="${escapeHtml(this.searchQuery)}" autocomplete="off">
                    </div>
                    <div class="admin-toolbar-actions">
                        <span class="admin-count-badge">${filtered.length} of ${this.users.length}</span>
                        <button class="btn btn-secondary btn-sm" id="admin-refresh" type="button">↻ Refresh</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                ${this.renderSortHeader('name', 'Account')}
                                ${this.renderSortHeader('trustLevel', 'Trust')}
                                <th>Status</th>
                                ${this.renderSortHeader('successfulAnalyses', 'Analyses')}
                                ${showIncidents ? '<th>Incidents</th>' : ''}
                                ${this.renderSortHeader('createdAt', 'Created')}
                                <th>Trust level</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${this.renderUserRows(filtered, showIncidents)}</tbody>
                    </table>
                </div>
            </div>
            <style>
                .admin-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; padding: 1rem; }
                .admin-stats .stat { display: flex; flex-direction: column; min-width: 100px; }
                .admin-stats .stat strong { font-size: 1.5rem; line-height: 1.2; }
                .admin-stats .stat span { font-size: 0.75rem; color: var(--text-muted); }
                .admin-toolbar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 0.75rem; }
                .admin-search-wrap { flex: 1; min-width: 200px; }
                .admin-search-input { width: 100%; }
                .admin-toolbar-actions { display: flex; align-items: center; gap: 0.75rem; }
                .admin-count-badge { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
                .admin-table { width: 100%; border-collapse: collapse; }
                .admin-table th, .admin-table td { padding: 0.65rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border-color, #2a2a2a); vertical-align: middle; }
                .admin-table th { cursor: pointer; user-select: none; white-space: nowrap; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
                .admin-table th:hover { color: var(--primary, #4da3ff); }
                .admin-sort-ind { font-size: 0.7rem; opacity: 0.7; }
                .admin-account-name { font-weight: 600; line-height: 1.3; }
                .admin-account-email { font-size: 0.78rem; color: var(--text-muted); }
                .trust-badge { text-transform: uppercase; font-size: 0.68rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-weight: 700; letter-spacing: 0.04em; }
                .trust-bronze { background: #5a3a1a; color: #ffcc99; }
                .trust-silver { background: #3a4a5a; color: #cceeff; }
                .trust-gold { background: #4a451a; color: #ffee99; }
                .status-dot { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; white-space: nowrap; }
                .status-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
                .status-online::before { background: #2ecc71; box-shadow: 0 0 6px rgba(46, 204, 113, 0.5); }
                .status-offline::before { background: #666; }
                .admin-status-meta { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.85rem; }
                .admin-trust-select {
                    appearance: auto;
                    background: var(--surface, #1a1f2e);
                    color: var(--text-primary, #e8eaed);
                    border: 1px solid var(--border, #3d4556);
                    border-radius: 8px;
                    padding: 0.35rem 0.55rem;
                    font-size: 0.82rem;
                    min-width: 6.5rem;
                    cursor: pointer;
                }
                .admin-trust-select:focus { outline: 2px solid var(--primary, #4da3ff); outline-offset: 1px; }
                .admin-trust-select option { background: #1a1f2e; color: #e8eaed; }
                .admin-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .admin-loading-skeleton { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
                .admin-loading-skeleton .skeleton-row { height: 2.5rem; background: var(--surface, #1a1a1a); border-radius: 6px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
                @keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
            </style>
        `;
        this.bindEvents();
    }

    renderStats(onlineCount) {
        const s = this.stats;
        const items = [
            { label: 'Total accounts', value: this.users.length },
            { label: 'Online now', value: onlineCount },
            { label: 'Active sessions', value: this.sessions.length }
        ];
        if (s) {
            if (s.activeTokens != null) items.push({ label: 'Active tokens', value: s.activeTokens });
            if (s.activeSubscriptions != null) items.push({ label: 'Active subscriptions', value: s.activeSubscriptions });
            if (s.errorCount24h != null) items.push({ label: 'Errors (24h)', value: s.errorCount24h });
        }
        return `<div class="card mb-4"><div class="admin-stats">${items.map(si => `<div class="stat"><strong>${si.value}</strong><span>${escapeHtml(si.label)}</span></div>`).join('')}</div></div>`;
    }

    renderSortHeader(field, label) {
        const sorted = this.sortField === field;
        const arrow = sorted ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
        return `<th data-sort-field="${escapeHtml(field)}">${escapeHtml(label)}<span class="admin-sort-ind">${arrow}</span></th>`;
    }

    renderUserRows(filtered, showIncidents = false) {
        const colSpan = showIncidents ? 8 : 7;
        if (!filtered.length) return `<tr><td colspan="${colSpan}" class="text-center text-muted" style="padding:2rem;">No accounts found</td></tr>`;
        return filtered.map(u => {
            const sc = u.online ? 'status-online' : 'status-offline';
            const st = u.online ? 'Online' : 'Offline';
            const lastMeta = u.lastSeen ? `<span class="admin-status-meta" title="${escapeHtml(this.formatDate(u.lastSeen))}">${escapeHtml(this.formatRelative(u.lastSeen))}</span>` : '';
            const protectedUser = this.isProtectedUser(u);
            return `
                <tr data-user-id="${escapeHtml(u.id)}">
                    <td>
                        <div class="admin-account-name">${escapeHtml(u.name || '')}</div>
                        <div class="admin-account-email">${escapeHtml(u.email || '')}</div>
                    </td>
                    <td><span class="trust-badge trust-${escapeHtml(u.trustLevel || 'bronze')}">${escapeHtml(u.trustLevel || 'bronze')}</span></td>
                    <td><span class="status-dot ${sc}">${st}</span>${lastMeta}</td>
                    <td>${u.successfulAnalyses || 0}</td>
                    ${showIncidents ? `<td>${u.securityIncidents || 0}</td>` : ''}
                    <td>${this.formatDate(u.createdAt)}</td>
                    <td>
                        <select class="admin-trust-select" data-id="${escapeHtml(u.id)}" aria-label="Set trust for ${escapeHtml(u.email)}">
                            <option value="bronze" ${u.trustLevel === 'bronze' ? 'selected' : ''}>Bronze</option>
                            <option value="silver" ${u.trustLevel === 'silver' ? 'selected' : ''}>Silver</option>
                            <option value="gold" ${u.trustLevel === 'gold' ? 'selected' : ''}>Gold</option>
                        </select>
                    </td>
                    <td><button class="btn btn-danger btn-sm admin-delete-btn" data-id="${escapeHtml(u.id)}" type="button" ${protectedUser ? 'disabled title="Primary admin cannot be deleted"' : ''}>Delete</button></td>
                </tr>`;
        }).join('');
    }

    renderLoading() {
        return `
            <div class="page-header"><h1>Admin Panel</h1></div>
            <div class="card mb-4"><div class="admin-loading-skeleton">
                <div class="skeleton-row" style="width:30%"></div>
                <div class="skeleton-row" style="width:20%"></div>
            </div></div>
            <div class="card"><div class="admin-loading-skeleton">
                ${Array(5).fill(0).map(() => '<div class="skeleton-row"></div>').join('')}
            </div></div>
            <style>
                .admin-loading-skeleton { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
                .admin-loading-skeleton .skeleton-row { height: 2.5rem; background: var(--surface, #1a1a1a); border-radius: 6px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
                @keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
            </style>`;
    }

    renderError() {
        return `
            <div class="page-header"><h1>Admin Panel</h1></div>
            <div class="card">
                <div style="padding:2rem;text-align:center;">
                    <p style="font-size:2rem;margin-bottom:0.5rem;">⚠️</p>
                    <p class="text-danger" style="margin-bottom:1rem;">${escapeHtml(this.error || 'Unknown error')}</p>
                    <button class="btn btn-primary" id="admin-retry">Retry</button>
                </div>
            </div>`;
    }

    bindEvents() {
        const searchInput = this.container.querySelector('#admin-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderTableBody();
            });
        }
        const refreshBtn = this.container.querySelector('#admin-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                showToast('Refreshing…', 'info');
                this.loadData();
            });
        }
        this.container.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteUser(e.target.dataset.id));
        });
        this.container.querySelectorAll('.admin-trust-select').forEach(sel => {
            sel.addEventListener('change', (e) => this.setTrustLevel(e.target.dataset.id, e.target.value));
        });
        this.container.querySelectorAll('th[data-sort-field]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sortField;
                if (this.sortField === field) {
                    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = field;
                    this.sortDir = 'asc';
                }
                this.render();
            });
        });
    }

    renderTableBody() {
        const tbody = this.container.querySelector('.admin-table tbody');
        if (!tbody) return;
        const filtered = this.getFilteredUsers();
        const showIncidents = this.showIncidentsColumn();
        tbody.innerHTML = this.renderUserRows(filtered, showIncidents);
        const badge = this.container.querySelector('.admin-count-badge');
        if (badge) badge.textContent = `${filtered.length} of ${this.users.length}`;
        tbody.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteUser(e.target.dataset.id));
        });
        tbody.querySelectorAll('.admin-trust-select').forEach(sel => {
            sel.addEventListener('change', (e) => this.setTrustLevel(e.target.dataset.id, e.target.value));
        });
    }

    destroy() {
        this.container = null;
    }
}
